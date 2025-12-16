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
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SolicitudesService } from '../services/solicitudes.service';

@Controller('api/solicitudes')
@UseGuards(JwtAuthGuard)
export class SolicitudesController {
  private readonly logger = new Logger(SolicitudesController.name);

  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Get()
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
}
