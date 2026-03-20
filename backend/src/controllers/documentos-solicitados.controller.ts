import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DocumentosSolicitadosService } from '../services/documentos-solicitados.service';
import { RbacService, AccessLevel } from '../assistant/services/rbac.service';

@Controller('api/documentos-solicitados')
@UseGuards(JwtAuthGuard)
export class DocumentosSolicitadosController {
  private readonly logger = new Logger(DocumentosSolicitadosController.name);

  constructor(
    private readonly documentosSolicitadosService: DocumentosSolicitadosService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * GET /api/documentos-solicitados?empleadoId=XXX
   * Obține cererile pentru un angajat sau toate (pentru admin)
   */
  @Get()
  @Throttle({
    short: { ttl: 10000, limit: 1000 }, // 1000 request-uri / 10 secunde (foarte generos pentru manageri în tab-ul "todas")
    medium: { ttl: 60000, limit: 5000 }, // 5000 request-uri / minut (foarte generos pentru manageri în tab-ul "todas")
  })
  async getSolicitudes(
    @Query('empleadoId') empleadoId?: string,
    @CurrentUser() currentUser?: any,
  ) {
    try {
      const grupo = currentUser?.GRUPO || currentUser?.grupo || '';
      const accessLevel = this.rbacService.getAccessLevel(grupo);

      // Dacă nu e admin/manager, poate vedea doar propriile cereri
      if (accessLevel === AccessLevel.OWN_DATA_ONLY) {
        const userEmpleadoId =
          currentUser?.CODIGO || currentUser?.userId || currentUser?.empleadoId;
        if (!userEmpleadoId) {
          throw new BadRequestException(
            'No se pudo identificar el empleado del usuario',
          );
        }
        // Force own empleadoId
        empleadoId = userEmpleadoId;
      }

      const result =
        await this.documentosSolicitadosService.getSolicitudes(empleadoId);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error obteniendo solicitudes:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener solicitudes: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/documentos-solicitados
   * Creează o cerere nouă (doar admin/manager/supervisor)
   */
  @Post()
  async crearSolicitud(
    @Body()
    body: {
      empleado_id: string;
      tipo_documento: string;
      notas?: string;
      aplicar_a_nuevos?: boolean;
      ausencia_id?: number;
    },
    @CurrentUser() currentUser?: any,
  ) {
    try {
      const grupo = currentUser?.GRUPO || currentUser?.grupo || '';
      const accessLevel = this.rbacService.getAccessLevel(grupo);

      const solicitadoPor =
        currentUser?.CODIGO ||
        currentUser?.userId ||
        currentUser?.empleadoId ||
        'system';

      const currentUserEmpleadoId =
        currentUser?.CODIGO ||
        currentUser?.userId ||
        currentUser?.empleadoId ||
        '';

      if (!body.empleado_id || !body.tipo_documento) {
        throw new BadRequestException(
          'Se requieren empleado_id y tipo_documento',
        );
      }

      // Permitem angajatului să creeze cereri doar pentru el însuși
      if (accessLevel === AccessLevel.OWN_DATA_ONLY) {
        if (body.empleado_id !== currentUserEmpleadoId) {
          throw new BadRequestException(
            'No tienes permisos para crear solicitudes de documentos para otros empleados',
          );
        }
        // Angajatul poate crea cereri pentru el însuși
      }

      const result = await this.documentosSolicitadosService.crearSolicitud({
        empleado_id: body.empleado_id,
        tipo_documento: body.tipo_documento,
        solicitado_por: solicitadoPor,
        notas: body.notas,
        aplicar_a_nuevos: body.aplicar_a_nuevos || false,
        ausencia_id: body.ausencia_id,
      });

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error creando solicitud:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear solicitud: ${error.message}`,
      );
    }
  }

  /**
   * PUT /api/documentos-solicitados/completar
   * Marchează o cerere ca completată (automat sau manual)
   */
  @Put('completar')
  async marcarCompletado(
    @Body()
    body: {
      empleado_id: string;
      tipo_documento: string;
    },
    @CurrentUser() currentUser?: any,
  ) {
    try {
      if (!body.empleado_id || !body.tipo_documento) {
        throw new BadRequestException(
          'Se requieren empleado_id y tipo_documento',
        );
      }

      const grupo = currentUser?.GRUPO || currentUser?.grupo || '';
      const accessLevel = this.rbacService.getAccessLevel(grupo);

      // Verifică permisiuni: doar admin/manager sau angajatul însuși
      if (accessLevel === AccessLevel.OWN_DATA_ONLY) {
        const userEmpleadoId =
          currentUser?.CODIGO || currentUser?.userId || currentUser?.empleadoId;
        if (userEmpleadoId !== body.empleado_id) {
          throw new BadRequestException(
            'No tienes permisos para marcar esta solicitud como completada',
          );
        }
      }

      const result = await this.documentosSolicitadosService.marcarCompletado(
        body.empleado_id,
        body.tipo_documento,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error marcando solicitud como completada:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al marcar solicitud como completada: ${error.message}`,
      );
    }
  }
}
