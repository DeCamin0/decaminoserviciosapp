import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  Req,
  UseInterceptors,
  UploadedFiles,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SolicitudesService } from '../services/solicitudes.service';

@Controller('api/solicitudes')
@UseGuards(JwtAuthGuard)
export class SolicitudesController {
  private readonly logger = new Logger(SolicitudesController.name);

  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Get()
  @Throttle({
    short: { ttl: 10000, limit: 50 }, // 50 request-uri / 10 secunde (în loc de 20)
    medium: { ttl: 60000, limit: 200 }, // 200 request-uri / minut (în loc de 100)
  })
  async getSolicitudes(
    @Query('email') email?: string,
    @Query('codigo') codigo?: string,
    @Query('MES') mes?: string,
    @Query('TIPO') tipo?: string,
    @Query('ESTADO') estado?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get solicitudes request - email: ${email || 'all'}, codigo: ${codigo || 'all'}, MES: ${mes || 'all'}, TIPO: ${tipo || 'all'}, ESTADO: ${estado || 'all'}, limit: ${limit || 'default'}`,
      );

      // Parse limit dacă există
      let limitNum: number | undefined;
      if (limit) {
        const parsed = Number(limit);
        if (!isNaN(parsed) && parsed > 0) {
          limitNum = parsed;
        }
      }

      const solicitudes = await this.solicitudesService.getSolicitudes({
        email,
        codigo,
        MES: mes,
        TIPO: tipo,
        ESTADO: estado,
        limit: limitNum,
      });

      return solicitudes;
    } catch (error: any) {
      this.logger.error('❌ Error getting solicitudes:', error);
      throw error;
    }
  }

  @Post()
  async createUpdateDeleteSolicitud(@Req() req: Request, @Body() body: any) {
    try {
      const { accion } = body;

      if (!accion) {
        throw new BadRequestException('accion este obligatoriu');
      }

      // Extrage IP-ul din headers (pentru LOCACION în Ausencias)
      let ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        (req.headers['cf-connecting-ip'] as string) ||
        req.ip ||
        req.socket?.remoteAddress ||
        (req as any).connection?.remoteAddress ||
        '';

      // Normalizează IPv6 localhost la IPv4 localhost
      if (ip === '::1') {
        ip = '127.0.0.1';
      }

      this.logger.log(
        `📝 POST solicitud request - accion: ${accion}, id: ${body.id || 'N/A'}, ip: ${ip}`,
      );

      if (accion === 'create') {
        // Creează solicitare nouă
        const result = await this.solicitudesService.createSolicitud({
          id: String(body.id),
          email: body.email,
          codigo: body.codigo,
          nombre: body.nombre || '',
          tipo: body.tipo,
          estado: body.estado || 'Aprobada',
          motivo: body.motivo,
          fecha_inicio: body.fecha_inicio,
          fecha_fin: body.fecha_fin,
          ip: ip,
          fecha_ultimo_dia_trabajo: body.fecha_ultimo_dia_trabajo,
        });

        return result;
      } else if (accion === 'update') {
        // Actualizează solicitare existentă
        const result = await this.solicitudesService.updateSolicitud(
          String(body.id),
          {
            email: body.email,
            codigo: body.codigo,
            nombre: body.nombre,
            tipo: body.tipo,
            estado: body.estado,
            motivo: body.motivo,
            fecha_inicio: body.fecha_inicio,
            fecha_fin: body.fecha_fin,
            ip: ip,
          },
        );

        return result;
      } else if (accion === 'delete') {
        // Șterge solicitare
        const result = await this.solicitudesService.deleteSolicitud(
          String(body.id),
          body.codigo,
        );

        return result;
      } else {
        throw new BadRequestException(
          `accion invalid: ${accion}. Trebuie să fie 'create', 'update' sau 'delete'`,
        );
      }
    } catch (error: any) {
      this.logger.error('❌ Error in POST solicitud:', error);
      throw error;
    }
  }

  /**
   * Creează o solicitare de despido improcedente (doar ADMIN)
   * Suportă file upload pentru attachments
   */
  @Post('despido-improcedente')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }]),
  )
  async createDespidoImprocedente(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles()
    files?: {
      attachments?: Express.Multer.File[];
    },
  ) {
    try {
      // Verifică permisiuni - doar ADMIN/Developer
      const grupo = user?.GRUPO || user?.grupo || '';
      const allowedGroups = ['Admin', 'Developer'];
      if (!allowedGroups.includes(grupo)) {
        throw new BadRequestException(
          'Acceso restringido. Solo administradores pueden crear despidos improcedentes.',
        );
      }

      // Validări
      if (!body.codigo || !body.nombre || !body.fecha_efectiva) {
        throw new BadRequestException(
          'codigo, nombre și fecha_efectiva sunt obligatorii',
        );
      }

      // Procesează attachments
      const attachments =
        files?.attachments && files.attachments.length > 0
          ? files.attachments.map((file) => ({
              filename: file.originalname || 'attachment',
              content: file.buffer,
              contentType: file.mimetype || 'application/octet-stream',
            }))
          : undefined;

      // Obține created_by_user_id din user
      const created_by_user_id =
        user?.CODIGO || user?.codigo || user?.id || 'system';

      this.logger.log(
        `📝 Create despido improcedente request - codigo: ${body.codigo}, confirmar: ${body.confirmar || false}`,
      );

      const result = await this.solicitudesService.createDespidoImprocedente({
        codigo: body.codigo,
        nombre: body.nombre,
        email: body.email,
        fecha_efectiva: body.fecha_efectiva,
        comentario_empresa: body.comentario_empresa,
        created_by_user_id,
        confirmar: body.confirmar === true || body.confirmar === 'true',
        attachments,
      });

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error creating despido improcedente:', error);
      throw error;
    }
  }

  /**
   * Confirmă o solicitare de despido și trimite email către gestoria
   */
  @Post(':id/confirmar-gestoria')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }]),
  )
  async confirmarYNotificarGestoria(
    @CurrentUser() user: any,
    @Param('id') solicitudId: string,
    @Body() body: any,
    @UploadedFiles()
    files?: {
      attachments?: Express.Multer.File[];
    },
  ) {
    try {
      // Verifică permisiuni - doar ADMIN/Developer
      const grupo = user?.GRUPO || user?.grupo || '';
      const allowedGroups = ['Admin', 'Developer'];
      if (!allowedGroups.includes(grupo)) {
        throw new BadRequestException(
          'Acceso restringido. Solo administradores pueden confirmar despidos.',
        );
      }

      // Obține solicitarea pentru a verifica că este DESPIDO_IMPROCEDENTE
      const solicitudes = await this.solicitudesService.getSolicitudes({
        limit: 1000,
      });
      const solicitud = solicitudes.find((s) => s.id === solicitudId);

      if (!solicitud) {
        throw new BadRequestException('Solicitud no encontrada');
      }

      if (solicitud.tipo !== 'DESPIDO_IMPROCEDENTE') {
        throw new BadRequestException(
          'Este endpoint solo puede usarse para despidos improcedentes',
        );
      }

      // Procesează attachments
      const attachments =
        files?.attachments && files.attachments.length > 0
          ? files.attachments.map((file) => ({
              filename: file.originalname || 'attachment',
              content: file.buffer,
              contentType: file.mimetype || 'application/octet-stream',
            }))
          : undefined;

      this.logger.log(
        `📝 Confirmar y notificar gestoria request - solicitud: ${solicitudId}`,
      );

      await this.solicitudesService.confirmarYNotificarGestoria(
        solicitudId,
        {
          codigo: solicitud.codigo || '',
          nombre: solicitud.nombre || '',
          fecha_efectiva: body.fecha_efectiva || solicitud.fecha_inicio || '',
          comentario_empresa: body.comentario_empresa || solicitud.motivo,
          attachments,
        },
        solicitud.email,
      );

      return {
        success: true,
        message: 'Despido confirmado y notificación enviada a gestoria',
      };
    } catch (error: any) {
      this.logger.error('❌ Error confirming despido:', error);
      throw error;
    }
  }

  /**
   * Generează PDF preview pentru Baja Voluntaria (fără aprobare)
   */
  @Get('baja-voluntaria/:id/preview-pdf')
  async getBajaVoluntariaPreviewPdf(
    @CurrentUser() user: any,
    @Param('id') solicitudId: string,
    @Res() res: Response,
  ) {
    try {
      // Verifică permisiuni - doar manageri
      const grupo = user?.GRUPO || user?.grupo || '';
      const allowedGroups = ['Admin', 'Developer', 'Manager', 'Supervisor'];
      if (!allowedGroups.includes(grupo)) {
        throw new BadRequestException(
          'Acceso restringido. Solo managers pueden ver el preview del PDF.',
        );
      }

      // Obține solicitarea
      const solicitudes = await this.solicitudesService.getSolicitudes({
        limit: 1000,
      });
      const solicitud = solicitudes.find((s) => s.id === solicitudId);

      if (!solicitud) {
        throw new BadRequestException('Solicitud no encontrada');
      }

      if (solicitud.tipo !== 'BAJA_VOLUNTARIA') {
        throw new BadRequestException(
          'Este endpoint solo puede usarse para bajas voluntarias',
        );
      }

      // Generează PDF
      const pdfBuffer =
        await this.solicitudesService.generateBajaVoluntariaPreviewPDF(
          solicitud,
        );

      // Returnează PDF ca response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Baja_Voluntaria_${solicitud.codigo}_preview.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      this.logger.error('❌ Error generating preview PDF:', error);
      throw error;
    }
  }
}
