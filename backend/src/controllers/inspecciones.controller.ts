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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InspeccionesService } from '../services/inspecciones.service';

@Controller('api/inspecciones')
@UseGuards(JwtAuthGuard)
export class InspeccionesController {
  private readonly logger = new Logger(InspeccionesController.name);

  constructor(private readonly inspeccionesService: InspeccionesService) {}

  /**
   * GET endpoint pentru inspecciones
   * - GET /api/inspecciones?codigo_empleado=10000001 -> "Mis Inspecciones" (pentru un empleado specific)
   * - GET /api/inspecciones -> "Todas las Inspecciones" (lista completă pentru manageri/supervizori)
   */
  @Get()
  async getInspecciones(@Query('codigo_empleado') codigoEmpleado?: string) {
    try {
      // Dacă există codigo_empleado, returnează inspecțiile pentru acel empleado
      if (codigoEmpleado) {
        this.logger.log(
          `📝 Get mis inspecciones request - codigo_empleado: ${codigoEmpleado}`,
        );

        const inspecciones =
          await this.inspeccionesService.getMisInspecciones(codigoEmpleado);

        return inspecciones; // Return array directly (matching n8n response format)
      }

      // Dacă nu există codigo_empleado, returnează lista completă
      this.logger.log('📝 Get all inspecciones request (lista completă)');

      const inspecciones = await this.inspeccionesService.getAllInspecciones();

      return inspecciones; // Return array directly (matching n8n response format)
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.getInspecciones:',
        error,
      );
      if (error instanceof BadRequestException) {
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
  async createInspeccion(@Body() body: any) {
    try {
      this.logger.log('📝 Create inspeccion request received');

      const result = await this.inspeccionesService.createInspeccion(body);

      return result;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.createInspeccion:',
        error,
      );
      if (error instanceof BadRequestException) {
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
  async createSolicitudInspeccion(@Body() body: any) {
    try {
      this.logger.log('📝 Create solicitud inspeccion request received');

      const result =
        await this.inspeccionesService.createSolicitudInspeccion(body);

      return result;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.createSolicitudInspeccion:',
        error,
      );
      if (error instanceof BadRequestException) {
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
  async downloadInspeccion(@Query('id') id: string, @Res() res: Response) {
    try {
      this.logger.log(`📥 Download inspeccion request - id: ${id}`);

      const { archivo, tipo_mime, nombre_archivo } =
        await this.inspeccionesService.downloadInspeccion(id);

      // Setează headers pentru download
      res.setHeader('Content-Type', tipo_mime);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombre_archivo}"`,
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
  async getMaterialesDocumentos(@Query('inspeccion_id') inspeccionId: string) {
    try {
      this.logger.log(
        `📦 Get materiales documentos request - inspeccion_id: ${inspeccionId}`,
      );

      const documentos =
        await this.inspeccionesService.getMaterialesDocumentos(inspeccionId);

      return documentos;
    } catch (error: any) {
      this.logger.error(
        'Error in InspeccionesController.getMaterialesDocumentos:',
        error,
      );
      if (error instanceof BadRequestException) {
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

      const { archivo, tipo_mime, nombre_archivo } =
        await this.inspeccionesService.downloadMaterialDocumento(docIdNumber);

      // Setează headers pentru download
      res.setHeader('Content-Type', tipo_mime);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombre_archivo}"`,
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
