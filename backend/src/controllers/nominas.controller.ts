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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  ) {
    try {
      const idNumber = parseInt(id, 10);

      if (isNaN(idNumber)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      this.logger.log(
        `📥 Download nomina request - id: ${idNumber}, nombre: ${nombre || 'N/A'}`,
      );

      const { archivo, tipo_mime, nombre_archivo } =
        await this.nominasService.downloadNomina(idNumber, nombre || '');

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
}
