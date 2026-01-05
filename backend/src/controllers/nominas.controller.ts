import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  Res,
  UseInterceptors,
  UploadedFiles,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NominasService } from '../services/nominas.service';

@Controller('api/nominas')
@UseGuards(JwtAuthGuard)
export class NominasController {
  private readonly logger = new Logger(NominasController.name);

  constructor(private readonly nominasService: NominasService) {}

  @Get()
  async getNominas(@Query('nombre') nombre?: string) {
    try {
      this.logger.log(`📝 Get nominas request - nombre: ${nombre || 'all'}`);

      const nominas = await this.nominasService.getNominas(nombre);

      return nominas;
    } catch (error: any) {
      this.logger.error('❌ Error getting nominas:', error);
      throw error;
    }
  }

  /**
   * Endpoint pentru descărcarea unei nóminas
   * GET /api/nominas/download?id=123&nombre=Juan Perez
   */
  @Get('download')
  async downloadNomina(
    @Query('id') id: string,
    @Query('nombre') nombre: string,
    @Res() res: Response,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('preview') preview?: string,
  ) {
    try {
      const idNumber = parseInt(id, 10);

      if (isNaN(idNumber)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      const isPreview = preview === 'true' || preview === '1';

      this.logger.log(
        `📥 Download nomina request - id: ${idNumber}, nombre: ${nombre || 'N/A'}, preview: ${isPreview}`,
      );

      const { archivo, tipo_mime, nombre_archivo } =
        await this.nominasService.downloadNomina(idNumber, nombre || '');

      // Loghează accesul (download)
      const empleadoCodigo = user?.userId || user?.CODIGO || user?.codigo || '';
      const empleadoNombre =
        user?.['NOMBRE / APELLIDOS'] || user?.nombre || nombre || '';
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      if (empleadoCodigo) {
        // Nu așteptăm răspunsul - logging-ul nu trebuie să blocheze download-ul
        this.nominasService
          .logNominaAcceso(
            idNumber,
            empleadoCodigo,
            empleadoNombre,
            'download',
            ip,
            userAgent,
          )
          .catch((logError: any) => {
            this.logger.warn(
              `⚠️ Eroare la logarea accesului (non-blocking): ${logError.message}`,
            );
          });
      }

      // Setează headers pentru download sau preview
      res.setHeader('Content-Type', tipo_mime);
      // Pentru preview, folosește 'inline' pentru a evita problemele CORB
      // Pentru download, folosește 'attachment'
      res.setHeader(
        'Content-Disposition',
        isPreview
          ? `inline; filename="${nombre_archivo}"`
          : `attachment; filename="${nombre_archivo}"`,
      );
      res.setHeader('Content-Length', archivo.length.toString());

      // Trimite buffer-ul ca răspuns
      res.send(archivo);
    } catch (error: any) {
      this.logger.error('Error in NominasController.downloadNomina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al descargar la nómina');
    }
  }

  /**
   * Endpoint pentru preview nómina (pentru tracking acces)
   * GET /api/nominas/:id/preview?nombre=...
   */
  @Get(':id/preview')
  async previewNomina(
    @Param('id') id: string,
    @Query('nombre') nombre: string,
    @Res() res: Response,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    try {
      const idNumber = parseInt(id, 10);

      if (isNaN(idNumber)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      this.logger.log(
        `👁️ Preview nomina request - id: ${idNumber}, nombre: ${nombre || 'N/A'}`,
      );

      const { archivo, tipo_mime, nombre_archivo } =
        await this.nominasService.downloadNomina(idNumber, nombre || '');

      // Loghează accesul (preview)
      const empleadoCodigo = user?.userId || user?.CODIGO || user?.codigo || '';
      const empleadoNombre =
        user?.['NOMBRE / APELLIDOS'] || user?.nombre || nombre || '';
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      if (empleadoCodigo) {
        // Nu așteptăm răspunsul - logging-ul nu trebuie să blocheze preview-ul
        this.nominasService
          .logNominaAcceso(
            idNumber,
            empleadoCodigo,
            empleadoNombre,
            'preview',
            ip,
            userAgent,
          )
          .catch((logError: any) => {
            this.logger.warn(
              `⚠️ Eroare la logarea accesului (non-blocking): ${logError.message}`,
            );
          });
      }

      // Setează headers pentru preview (inline, nu download)
      res.setHeader('Content-Type', tipo_mime);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${nombre_archivo}"`,
      );
      res.setHeader('Content-Length', archivo.length.toString());

      // Trimite buffer-ul ca răspuns
      res.send(archivo);
    } catch (error: any) {
      this.logger.error('Error in NominasController.previewNomina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al obtener preview de la nómina');
    }
  }

  /**
   * Endpoint pentru upload-ul de nóminas
   * POST /api/nominas/upload
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - nombre_empleado, mes, año (body fields)
   */
  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivo_0', maxCount: 1 },
        { name: 'archivo_1', maxCount: 1 },
        { name: 'archivo_2', maxCount: 1 },
        { name: 'archivo_3', maxCount: 1 },
        { name: 'archivo_4', maxCount: 1 },
        { name: 'archivo_5', maxCount: 1 },
        { name: 'archivo_6', maxCount: 1 },
        { name: 'archivo_7', maxCount: 1 },
        { name: 'archivo_8', maxCount: 1 },
        { name: 'archivo_9', maxCount: 1 },
        { name: 'archivo', maxCount: 10 }, // Fallback: single field with multiple files
      ],
      {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
      },
    ),
  )
  async uploadNomina(
    @UploadedFiles()
    files: {
      archivo_0?: Express.Multer.File[];
      archivo_1?: Express.Multer.File[];
      archivo_2?: Express.Multer.File[];
      archivo_3?: Express.Multer.File[];
      archivo_4?: Express.Multer.File[];
      archivo_5?: Express.Multer.File[];
      archivo_6?: Express.Multer.File[];
      archivo_7?: Express.Multer.File[];
      archivo_8?: Express.Multer.File[];
      archivo_9?: Express.Multer.File[];
      archivo?: Express.Multer.File[]; // Fallback
    },
    @Body() body: any,
  ) {
    try {
      // Collect all files in order
      const allFiles: Express.Multer.File[] = [];

      // First, try indexed files (archivo_0, archivo_1, ...)
      for (let i = 0; i <= 9; i++) {
        const fieldName = `archivo_${i}` as keyof typeof files;
        if (files[fieldName] && files[fieldName].length > 0) {
          allFiles.push(...files[fieldName]);
        }
      }

      // Fallback: if no indexed files, try 'archivo' field
      if (allFiles.length === 0 && files.archivo && files.archivo.length > 0) {
        allFiles.push(...files.archivo);
      }

      if (allFiles.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos un archivo. Use campos "archivo_0", "archivo_1", ... o "archivo"',
        );
      }

      this.logger.log(
        `📤 Upload nóminas request - ${allFiles.length} archivo(s), nombre: ${body.nombre_empleado || body.nombre || 'N/A'}`,
      );

      const result = await this.nominasService.uploadNomina(allFiles, body);

      return {
        success: true,
        message: `Nóminas procesadas: ${result.processed} procesadas, ${result.inserted} insertadas`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading nóminas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al subir nóminas: ${error.message}`);
    }
  }

  /**
   * Endpoint pentru ștergerea unei nóminas
   * POST /api/nominas/delete (pentru compatibilitate cu n8n)
   * Accepts body: { id: number, nombre?: string, filename?: string, fileName?: string }
   */
  @Post('delete')
  async deleteNominaPost(@Body() body: any) {
    try {
      // Extract id (required)
      const id = body.id || body.facturald || body.facturaId;
      if (!id) {
        throw new BadRequestException('Se requiere "id"');
      }

      // Extract nombre/filename (with fallbacks like n8n snapshot)
      const nombre =
        body.nombre || body.filename || body.fileName || body.archivo || null;

      if (!nombre) {
        throw new BadRequestException(
          'Se requiere "nombre", "filename" o "fileName"',
        );
      }

      this.logger.log(
        `🗑️ Delete nomina request (POST) - id: ${id}, nombre: "${nombre}"`,
      );

      const result = await this.nominasService.deleteNomina(id, nombre);

      // Return format matching n8n response
      return {
        ok: true,
        mensaje: result.message,
        id: String(id),
        archivo: nombre,
        numero_operacion:
          body.numeroOperatiune ||
          body.numar_operatiune ||
          body.numeroOperacion ||
          null,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in NominasController.deleteNominaPost:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la nómina: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint REST standard pentru ștergerea unei nóminas
   * DELETE /api/nominas/:id?nombre=...
   */
  @Delete(':id')
  async deleteNomina(@Param('id') id: string, @Query('nombre') nombre: string) {
    try {
      if (!nombre) {
        throw new BadRequestException(
          'Se requiere query parameter "nombre" (nombre del archivo)',
        );
      }

      this.logger.log(
        `🗑️ Delete nomina request (DELETE) - id: ${id}, nombre: "${nombre}"`,
      );

      const result = await this.nominasService.deleteNomina(id, nombre);

      return {
        success: true,
        message: result.message,
        affectedRows: result.affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error in NominasController.deleteNomina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la nómina: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru trimiterea unei nóminas prin email
   * POST /api/nominas/:id/send-email
   * Body: { email: string, nombre: string }
   */
  @Post(':id/send-email')
  async sendNominaByEmail(
    @Param('id') id: string,
    @Body() body: { email: string; nombre: string },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    try {
      const idNumber = parseInt(id, 10);

      if (isNaN(idNumber)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      if (!body.email || !body.nombre) {
        throw new BadRequestException(
          'Se requieren "email" y "nombre" en el body',
        );
      }

      // Obține numele angajatului din user token sau din body
      const empleadoNombre =
        user?.['NOMBRE / APELLIDOS'] ||
        user?.nombre ||
        body.nombre ||
        'Empleado';

      this.logger.log(
        `📧 Send nomina by email request - id: ${idNumber}, email: ${body.email}, nombre: ${body.nombre}`,
      );

      const result = await this.nominasService.sendNominaByEmail(
        idNumber,
        body.nombre,
        body.email,
        empleadoNombre,
      );

      // Loghează accesul (email)
      const empleadoCodigo = user?.userId || user?.CODIGO || user?.codigo || '';
      const ip = req?.ip || req?.socket?.remoteAddress || undefined;
      const userAgent = req?.get('user-agent') || undefined;

      this.logger.log(
        `📧 Send email nómina ${idNumber} - empleado: ${empleadoCodigo}, nombre: ${empleadoNombre}`,
      );

      if (empleadoCodigo) {
        // Așteptăm logging-ul pentru a ne asigura că se face
        try {
          await this.nominasService.logNominaAcceso(
            idNumber,
            empleadoCodigo,
            empleadoNombre,
            'email',
            ip,
            userAgent,
          );
          this.logger.log(`✅ Acces logat pentru email nómina ${idNumber}`);
        } catch (logError: any) {
          this.logger.error(
            `❌ Eroare la logarea accesului (non-blocking): ${logError.message}`,
            logError.stack,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ Nu s-a putut loga accesul: empleadoCodigo=${empleadoCodigo}`,
        );
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in NominasController.sendNominaByEmail:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al enviar la nómina por email: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru obținerea accesurilor la nóminas
   * GET /api/nominas/:id/accesos (pentru accesurile unei nóminas specifice)
   * GET /api/nominas/accesos?nominaId=...&empleadoCodigo=...&tipoAcceso=...
   *
   * IMPORTANT: Ruta cu parametru trebuie să fie PRIMA pentru ca NestJS să o potrivească corect
   */
  @Get(':id/accesos')
  @Get('accesos')
  async getNominasAccesos(
    @Param('id') id: string | undefined,
    @Query('nominaId') nominaId: string | undefined,
    @Query('empleadoCodigo') empleadoCodigo: string | undefined,
    @Query('tipoAcceso')
    tipoAcceso: 'preview' | 'download' | 'email' | undefined,
    @Query('fechaDesde') fechaDesde: string | undefined,
    @Query('fechaHasta') fechaHasta: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: any,
  ) {
    try {
      // Verifică permisiuni (doar admin/manager/developer pot vedea accesurile)
      const grupo = user?.GRUPO || user?.grupo || '';
      const canViewAccesos =
        grupo === 'Admin' ||
        grupo === 'Developer' ||
        grupo === 'Manager' ||
        grupo === 'Supervisor';

      if (!canViewAccesos) {
        throw new BadRequestException(
          'No tienes permisos para ver los accesos a nóminas',
        );
      }

      const filters: any = {};

      // Dacă există id în path, folosește-l (dar ignoră dacă id este "accesos" - înseamnă că e ruta fără parametru)
      if (id && id !== 'accesos') {
        const idNumber = parseInt(id, 10);
        if (!isNaN(idNumber)) {
          filters.nominaId = idNumber;
        }
      } else if (nominaId) {
        const idNumber = parseInt(nominaId, 10);
        if (!isNaN(idNumber)) {
          filters.nominaId = idNumber;
        }
      }

      if (empleadoCodigo) {
        filters.empleadoCodigo = empleadoCodigo;
      }

      if (tipoAcceso && ['preview', 'download', 'email'].includes(tipoAcceso)) {
        filters.tipoAcceso = tipoAcceso;
      }

      if (fechaDesde) {
        filters.fechaDesde = fechaDesde;
      }

      if (fechaHasta) {
        filters.fechaHasta = fechaHasta;
      }

      if (limit) {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          filters.limit = limitNum;
        }
      }

      this.logger.log(
        `📊 [getNominasAccesos] Request - id: ${id}, nominaId: ${nominaId}, filters: ${JSON.stringify(filters)}`,
      );

      const accesos = await this.nominasService.getNominasAccesos(filters);

      this.logger.log(
        `📊 [getNominasAccesos] Returning ${accesos.length} accesos`,
      );

      return {
        success: true,
        total: accesos.length,
        accesos: accesos,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in NominasController.getNominasAccesos:',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener accesos: ${error.message}`,
      );
    }
  }
}
