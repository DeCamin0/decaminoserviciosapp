import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { contentDisposition } from '../services/content-disposition';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InspeccionesService } from '../services/inspecciones.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isImplicitAdmin,
  matrixModuleEnabled,
} from '../services/empleados-operation-access';

@Controller('api/inspecciones')
@UseGuards(JwtAuthGuard)
export class InspeccionesController {
  private readonly logger = new Logger(InspeccionesController.name);

  constructor(
    private readonly inspeccionesService: InspeccionesService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly prisma: PrismaService,
  ) {}

  private async moduleOn(user: any, module: string): Promise<boolean> {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    const role = String(user?.role || user?.ROLE || '').trim();
    if (isImplicitAdmin({ grupo, role })) return true;
    return matrixModuleEnabled(this.prisma, grupo, module);
  }

  /** Lista completă cere `inspecciones`. Propriile inspecții cer `mis-inspecciones`. */
  private async inspectionAudience(
    user: any,
    requestedCodigo?: string,
  ): Promise<string[] | null> {
    const full = await this.moduleOn(user, 'inspecciones');
    const mine = await this.moduleOn(user, 'mis-inspecciones');
    if (!full && !mine) {
      throw new ForbiddenException('Sin permiso para inspecciones');
    }
    const self = String(user?.userId || user?.CODIGO || '').trim();
    const scopeAllowed =
      await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
        this.scopePayload(user),
      );
    if (full) {
      if (
        requestedCodigo &&
        scopeAllowed &&
        !scopeAllowed.includes(String(requestedCodigo).trim())
      ) {
        throw new ForbiddenException('Empleado fuera de ámbito');
      }
      return scopeAllowed;
    }
    if (!self) throw new ForbiddenException('Sin permiso para inspecciones');
    if (requestedCodigo && String(requestedCodigo).trim() !== self) {
      throw new ForbiddenException('Sin permiso para inspecciones');
    }
    if (!scopeAllowed) return [self];
    return scopeAllowed.filter((code) => String(code).trim() === self);
  }

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  /**
   * GET endpoint pentru inspecciones
   * - GET /api/inspecciones?codigo_empleado=10000001 -> "Mis Inspecciones" (pentru un empleado specific)
   * - GET /api/inspecciones -> "Todas las Inspecciones" (lista completă pentru manageri/supervizori)
   */
  @Get()
  async getInspecciones(
    @CurrentUser() user: any,
    @Query('codigo_empleado') codigoEmpleado?: string,
  ) {
    try {
      const allowed = await this.inspectionAudience(user, codigoEmpleado);

      // Dacă există codigo_empleado, returnează inspecțiile pentru acel empleado
      if (codigoEmpleado) {
        this.logger.log(
          `📝 Get mis inspecciones request - codigo_empleado: ${codigoEmpleado}`,
        );

        const inspecciones = await this.inspeccionesService.getMisInspecciones(
          codigoEmpleado,
          allowed,
        );

        return inspecciones; // Return array directly (matching n8n response format)
      }

      // Dacă nu există codigo_empleado, returnează lista completă
      this.logger.log('📝 Get all inspecciones request (lista completă)');

      const inspecciones =
        await this.inspeccionesService.getAllInspecciones(allowed);

      return inspecciones; // Return array directly (matching n8n response format)
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.getInspecciones:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al obtener las inspecciones');
    }
  }

  /**
   * POST endpoint pentru crearea unei inspecții
   * POST /api/inspecciones
   */
  @Post()
  async createInspeccion(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log('📝 Create inspeccion request received');

      const allowed = await this.inspectionAudience(
        user,
        body?.codigo_empleado,
      );

      const result = await this.inspeccionesService.createInspeccion(
        body,
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.createInspeccion:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al crear la inspección');
    }
  }

  /**
   * POST endpoint pentru crearea unei cereri de inspecție (fără PDF)
   * POST /api/inspecciones/solicitud
   */
  @Post('solicitud')
  async createSolicitudInspeccion(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log('📝 Create solicitud inspeccion request received');

      const allowed = await this.inspectionAudience(
        user,
        body?.codigo_empleado,
      );

      const result = await this.inspeccionesService.createSolicitudInspeccion(
        body,
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.createSolicitudInspeccion:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Error al crear la solicitud de inspección',
      );
    }
  }

  /**
   * GET endpoint pentru descărcarea PDF-ului unei inspecții
   * GET /api/inspecciones/download?id=xxx
   */
  @Get('download')
  async downloadInspeccion(
    @CurrentUser() user: any,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`📥 Download inspeccion request - id: ${id}`);

      const allowed = await this.inspectionAudience(user);

      const { archivo, tipo_mime, nombre_archivo } =
        await this.inspeccionesService.downloadInspeccion(id, allowed);

      // Setează headers pentru download
      res.setHeader('Content-Type', tipo_mime);
      res.setHeader(
        'Content-Disposition',
        contentDisposition('attachment', nombre_archivo),
      );
      res.setHeader('Content-Length', archivo.length.toString());

      // Trimite buffer-ul ca răspuns
      res.send(archivo);
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.downloadInspeccion:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al descargar la inspección');
    }
  }

  /**
   * GET endpoint pentru obținerea documentelor materialelor pentru o inspecție
   * GET /api/inspecciones/materiales?inspeccion_id=xxx
   */
  @Get('materiales')
  async getMaterialesDocumentos(
    @CurrentUser() user: any,
    @Query('inspeccion_id') inspeccionId: string,
  ) {
    try {
      this.logger.log(
        `📦 Get materiales documentos request - inspeccion_id: ${inspeccionId}`,
      );

      const allowed = await this.inspectionAudience(user);

      const documentos = await this.inspeccionesService.getMaterialesDocumentos(
        inspeccionId,
        allowed,
      );

      return documentos;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.getMaterialesDocumentos:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Error al obtener los documentos de materiales',
      );
    }
  }

  /**
   * GET endpoint pentru descărcarea unui document de material
   * GET /api/inspecciones/materiales/download?doc_id=xxx
   */
  @Get('materiales/download')
  async downloadMaterialDocumento(
    @CurrentUser() user: any,
    @Query('doc_id') docId: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `📥 Download material document request - doc_id: ${docId}`,
      );

      const docIdNumber = parseInt(docId, 10);
      if (isNaN(docIdNumber)) {
        throw new BadRequestException('doc_id debe ser un número válido');
      }

      const allowed = await this.inspectionAudience(user);

      const { archivo, tipo_mime, nombre_archivo } =
        await this.inspeccionesService.downloadMaterialDocumento(
          docIdNumber,
          allowed,
        );

      // Setează headers pentru download
      res.setHeader('Content-Type', tipo_mime);
      res.setHeader(
        'Content-Disposition',
        contentDisposition('attachment', nombre_archivo),
      );
      res.setHeader('Content-Length', archivo.length.toString());

      // Trimite buffer-ul ca răspuns
      res.send(archivo);
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.downloadMaterialDocumento:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Error al descargar el documento de material',
      );
    }
  }
}
