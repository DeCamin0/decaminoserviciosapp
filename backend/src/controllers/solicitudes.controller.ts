import {
  Controller,
  Get,
  Put,
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
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { contentDisposition } from '../services/content-disposition';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SolicitudesService } from '../services/solicitudes.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import {
  isImplicitAdmin,
  matrixModuleEnabled,
} from '../services/empleados-operation-access';
import {
  isSolicitudStaff,
  type SolicitudActor,
} from '../services/solicitudes-actor-policy';
import { PermisoRetribuidoDurationService } from '../services/permiso-retribuido-duration.service';
import { canConfirmPermisoDuracion } from '../services/permiso-retribuido-duration.logic';

@Controller('api/solicitudes')
@UseGuards(JwtAuthGuard)
export class SolicitudesController {
  private readonly logger = new Logger(SolicitudesController.name);

  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly prisma: PrismaService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly permisoDuracion: PermisoRetribuidoDurationService,
  ) {}

  private async actorOf(user: any): Promise<SolicitudActor> {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    const role = String(user?.role || user?.ROLE || '').trim();
    const solicitudesAdmin =
      isImplicitAdmin({ grupo, role }) ||
      (await matrixModuleEnabled(this.prisma, grupo, 'solicitudes-admin'));
    return {
      userId: String(user?.userId || user?.CODIGO || '').trim(),
      email: user?.email,
      grupo,
      role,
      solicitudesAdmin,
    };
  }

  private async assertSolicitudesAdmin(user: any, message: string) {
    const actor = await this.actorOf(user);
    if (!isSolicitudStaff(actor)) {
      throw new BadRequestException(message);
    }
    return actor;
  }

  /** null = toată firma. [] = niciun rând. Lista = codurile din scope, inclusiv propriul cod. */
  private async listRestriction(user: any): Promise<string[] | null> {
    const actor = await this.actorOf(user);
    const self = String(actor.userId || '').trim();
    if (!isSolicitudStaff(actor)) return self ? [self] : [];
    if (isImplicitAdmin(actor)) return null;
    const scope = await this.empleadoGrupoScopeService.resolveScopeFilter({
      userId: actor.userId,
      grupo: actor.grupo,
      role: actor.role,
    });
    if (!scope?.grupos?.length) return null;
    const allowed =
      await this.empleadoGrupoScopeService.listAllowedCodigosForPayload({
        userId: actor.userId,
        grupo: actor.grupo,
        role: actor.role,
      });
    return allowed ?? [];
  }

  @Get()
  @Throttle({
    short: { ttl: 10000, limit: 50 }, // 50 request-uri / 10 secunde (în loc de 20)
    medium: { ttl: 60000, limit: 200 }, // 200 request-uri / minut (în loc de 100)
  })
  async getSolicitudes(
    @CurrentUser() user: any,
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

      const codigosPermitidos = await this.listRestriction(user);
      const ownOnly =
        Array.isArray(codigosPermitidos) && codigosPermitidos.length === 1
          ? !(await this.actorOf(user)).solicitudesAdmin &&
            !isImplicitAdmin(await this.actorOf(user))
          : false;
      const solicitudes = await this.solicitudesService.getSolicitudes({
        email: ownOnly ? undefined : email,
        codigo: ownOnly ? codigosPermitidos?.[0] : codigo,
        MES: mes,
        TIPO: tipo,
        ESTADO: estado,
        limit: limitNum,
        codigosPermitidos,
        includePermisoDuracion: true,
      });

      return solicitudes;
    } catch (error: any) {
      this.logger.error('❌ Error getting solicitudes:', error);
      throw error;
    }
  }

  @Post('permiso-retribuido/preview')
  async previewPermisoRetribuido(
    @CurrentUser() user: any,
    @Body()
    body: { codigo?: string; fecha_inicio?: string; fecha_fin?: string },
  ) {
    const actor = await this.actorOf(user);
    const codigo = String(body?.codigo || actor.userId || '').trim();
    if (!codigo || !body?.fecha_inicio || !body?.fecha_fin) {
      throw new BadRequestException(
        'codigo, fecha_inicio y fecha_fin son obligatorios',
      );
    }
    if (!canConfirmPermisoDuracion(actor) && codigo !== actor.userId) {
      throw new BadRequestException(
        'No puedes consultar el permiso de otro empleado',
      );
    }
    if (canConfirmPermisoDuracion(actor)) {
      const allowed = await this.listRestriction(user);
      if (Array.isArray(allowed) && !allowed.includes(codigo)) {
        throw new BadRequestException(
          'No puedes consultar el permiso de este empleado',
        );
      }
    }
    return this.permisoDuracion.evaluate(
      codigo,
      body.fecha_inicio,
      body.fecha_fin,
    );
  }

  @Post()
  async createUpdateDeleteSolicitud(
    @Req() req: Request,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      const { accion } = body;

      if (!accion) {
        throw new BadRequestException('La acción es obligatoria');
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

      const actor = await this.actorOf(user);
      const actorGrupo = String(actor.grupo || '').trim();
      const skipCalendarRestrictions = isSolicitudStaff(actor);

      this.logger.log(
        `📝 POST solicitud request - accion: ${accion}, id: ${body.id || 'N/A'}, ip: ${ip}, actorGrupo: ${actorGrupo || 'N/A'}, skipCalendar: ${skipCalendarRestrictions}`,
      );

      if (accion === 'create') {
        // Creează solicitare nouă
        const result = await this.solicitudesService.createSolicitud(
          {
            id: String(body.id),
            email: body.email,
            codigo: body.codigo,
            nombre: body.nombre || '',
            tipo: body.tipo,
            estado: body.estado,
            motivo: body.motivo,
            fecha_inicio: body.fecha_inicio,
            fecha_fin: body.fecha_fin,
            ip: ip,
            fecha_ultimo_dia_trabajo: body.fecha_ultimo_dia_trabajo,
            origen: body.origen,
            creado_por: body.creado_por,
            creado_por_email: body.creado_por_email,
            tipo_justificante: body.tipo_justificante,
            hora_cita: body.hora_cita,
            centro_medico: body.centro_medico,
            descripcion_otro: body.descripcion_otro,
            duracion_confirmada: body.duracion_confirmada,
          },
          actor,
        );

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
            mensajePersonalizado: body.mensajePersonalizado, // Mesaj personalizat opțional pentru rechazar
            skipCalendarRestrictions,
            duracion_confirmada: body.duracion_confirmada,
            forzar_duracion: body.forzar_duracion === true,
          },
          actor,
        );

        return result;
      } else if (accion === 'delete') {
        // Șterge solicitare
        const result = await this.solicitudesService.deleteSolicitud(
          String(body.id),
          body.codigo,
          body.mensajePersonalizado, // Mesaj personalizat opțional
          actor,
        );

        return result;
      } else {
        throw new BadRequestException(
          `Acción no válida: ${accion}. Debe ser 'create', 'update' o 'delete'`,
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
      if (
        !isImplicitAdmin({
          grupo: user?.GRUPO || user?.grupo,
          role: user?.role,
        })
      ) {
        throw new BadRequestException(
          'Acceso restringido. Solo administradores pueden crear despidos improcedentes.',
        );
      }

      // Validări
      if (!body.codigo || !body.nombre || !body.fecha_efectiva) {
        throw new BadRequestException(
          'codigo, nombre y fecha_efectiva son obligatorios',
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
      if (
        !isImplicitAdmin({
          grupo: user?.GRUPO || user?.grupo,
          role: user?.role,
        })
      ) {
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
      await this.assertSolicitudesAdmin(
        user,
        'Acceso restringido. Solo managers pueden ver el preview del PDF.',
      );

      const solicitudes = await this.solicitudesService.getSolicitudes({
        limit: 1000,
        codigosPermitidos: await this.listRestriction(user),
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
        contentDisposition(
          'inline',
          `Baja_Voluntaria_${solicitud.codigo}_preview.pdf`,
        ),
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      this.logger.error('❌ Error generating preview PDF:', error);
      throw error;
    }
  }

  /** % del grupo que puede estar de vacaciones a la vez (1–100). Cualquier usuario autenticado (calendario). */
  @Get('vacaciones-disponibilidad-porcentaje')
  async getVacacionesDisponibilidadPorcentaje() {
    return this.solicitudesService.getVacacionesDisponibilidadPorcentaje();
  }

  /** Actualizar % — solo managers. Body: { porcentaje: number } */
  @Put('vacaciones-disponibilidad-porcentaje')
  async putVacacionesDisponibilidadPorcentaje(
    @CurrentUser() user: any,
    @Body() body: { porcentaje?: number },
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden cambiar el porcentaje de disponibilidad de vacaciones.',
    );
    if (body?.porcentaje === undefined || body?.porcentaje === null) {
      throw new BadRequestException('porcentaje es obligatorio');
    }
    return this.solicitudesService.setVacacionesDisponibilidadPorcentaje(
      Number(body.porcentaje),
    );
  }

  /** Lista perioadelor blocate pentru vacanțe (luni/intervale) – doar manageri. */
  @Get('vacation-blocked-periods')
  async getVacationBlockedPeriods(@CurrentUser() user: any) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden ver los periodos bloqueados.',
    );
    return this.solicitudesService.getVacationBlockedPeriods();
  }

  /** Creare perioadă blocată – doar manageri. Body: { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD' } */
  @Post('vacation-blocked-periods')
  async createVacationBlockedPeriod(
    @CurrentUser() user: any,
    @Body() body: { fecha_inicio: string; fecha_fin: string },
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden crear periodos bloqueados.',
    );
    if (!body?.fecha_inicio || !body?.fecha_fin) {
      throw new BadRequestException(
        'fecha_inicio y fecha_fin son obligatorios',
      );
    }
    return this.solicitudesService.createVacationBlockedPeriod(body);
  }

  /** Ștergere perioadă blocată – doar manageri. */
  @Delete('vacation-blocked-periods/:id')
  async deleteVacationBlockedPeriod(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden eliminar periodos bloqueados.',
    );
    await this.solicitudesService.deleteVacationBlockedPeriod(id);
    return { success: true };
  }

  /**
   * Lista periodos bloqueados para Asuntos Propios — cualquier usuario autenticado
   * (empleados necesitan verlo en el calendario).
   */
  @Get('asunto-propio-blocked-periods')
  async getAsuntoPropioBlockedPeriods() {
    return this.solicitudesService.getAsuntoPropioBlockedPeriods();
  }

  /** Config global Asuntos Propios: cupo diario + días anuales. Cualquier autenticado (GET). */
  @Get('asuntos-propios-max-por-dia')
  async getAsuntosPropiosMaxPorDia() {
    return this.solicitudesService.getAsuntosPropiosMaxPersonasDia();
  }

  @Put('asuntos-propios-max-por-dia')
  async putAsuntosPropiosMaxPorDia(
    @CurrentUser() user: any,
    @Body()
    body: { max_personas_dia?: number; dias_anuales?: number },
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden cambiar la config de Asuntos Propios.',
    );
    const hasPersonas =
      body?.max_personas_dia !== undefined && body?.max_personas_dia !== null;
    const hasDias =
      body?.dias_anuales !== undefined && body?.dias_anuales !== null;
    if (!hasPersonas && !hasDias) {
      throw new BadRequestException('Indica max_personas_dia y/o dias_anuales');
    }
    return this.solicitudesService.setAsuntosPropiosMaxPersonasDia(
      hasPersonas ? Number(body.max_personas_dia) : undefined,
      hasDias ? Number(body.dias_anuales) : undefined,
    );
  }

  @Post('asunto-propio-blocked-periods')
  async createAsuntoPropioBlockedPeriod(
    @CurrentUser() user: any,
    @Body() body: { fecha_inicio: string; fecha_fin: string },
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden crear periodos bloqueados para Asuntos Propios.',
    );
    if (!body?.fecha_inicio || !body?.fecha_fin) {
      throw new BadRequestException(
        'fecha_inicio y fecha_fin son obligatorios',
      );
    }
    return this.solicitudesService.createAsuntoPropioBlockedPeriod(body);
  }

  @Delete('asunto-propio-blocked-periods/:id')
  async deleteAsuntoPropioBlockedPeriod(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertSolicitudesAdmin(
      user,
      'Solo managers pueden eliminar periodos bloqueados para Asuntos Propios.',
    );
    await this.solicitudesService.deleteAsuntoPropioBlockedPeriod(id);
    return { success: true };
  }
}
