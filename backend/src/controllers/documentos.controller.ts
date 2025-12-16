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
import { DocumentosService } from '../services/documentos.service';

@Controller('api/documentos')
@UseGuards(JwtAuthGuard)
export class DocumentosController {
  private readonly logger = new Logger(DocumentosController.name);

  constructor(private readonly documentosService: DocumentosService) {}

  @Get()
  async getDocumentos(
    @Query('empleadoId') empleadoId?: string,
    @Query('email') email?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get documentos request - empleadoId: ${empleadoId || 'N/A'}, email: ${email || 'N/A'}`,
      );

      const documentos = await this.documentosService.getDocumentos(
        empleadoId,
        email,
      );

      return {
        success: true,
        data: documentos,
      };
    } catch (error: any) {
      this.logger.error('Error in DocumentosController.getDocumentos:', error);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Error al obtener los documentos');
    }
  }

  /**
   * Endpoint pentru descărcarea unui document
   * GET /api/documentos/download?documentId=123&id=10000001&email=user@example.com&fileName=document.pdf
   */
  @Get('download')
  async downloadDocumento(
    @Res() res: Response,
    @Query('documentId') documentId: string,
    @Query('id') id?: string,
    @Query('email') email?: string,
    @Query('fileName') fileName?: string,
  ) {
    try {
      const documentIdNumber = parseInt(documentId, 10);

      if (isNaN(documentIdNumber)) {
        throw new BadRequestException(
          `Parámetro "documentId" inválido: ${documentId}`,
        );
      }

      this.logger.log(
        `📥 Download documento request - documentId: ${documentIdNumber}, id: ${id || 'N/A'}, email: ${email || 'N/A'}, fileName: ${fileName || 'N/A'}`,
      );

      const { archivo, tipo_mime, nombre_archivo } =
        await this.documentosService.downloadDocumento(
          documentIdNumber,
          id,
          email,
          fileName,
        );

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
        'Error in DocumentosController.downloadDocumento:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al descargar el documento');
    }
  }

  /**
   * Endpoint pentru upload-ul de documente
   * POST /api/documentos/upload
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - empleado_id, empleado_email, empleado_nombre
   * - fecha_upload, tipo_documento_0, tipo_documento_1, ...
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
  async uploadDocumento(
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
        `📤 Upload documentos request - ${allFiles.length} archivo(s), empleado_id: ${body.empleado_id || 'N/A'}`,
      );

      const result = await this.documentosService.uploadDocumento(
        allFiles,
        body,
      );

      return {
        success: true,
        message: `Documentos procesados: ${result.processed} procesados, ${result.inserted} insertados`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading documentos:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al subir documentos: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru ștergerea unui documento
   * POST /api/documentos/delete (pentru compatibilitate cu n8n)
   * Accepts body: { id: string|number, nombre_archivo?: string, filename?: string, fileName?: string }
   */
  @Post('delete')
  async deleteDocumentoPost(@Body() body: any) {
    try {
      // Extract id (required)
      const id = body.id || body.facturald || body.facturaId;
      if (!id) {
        throw new BadRequestException('Se requiere "id"');
      }

      // Extract nombre_archivo/filename (with fallbacks like n8n snapshot)
      const nombreArchivo =
        body.nombre_archivo ||
        body.filename ||
        body.fileName ||
        body.archivo ||
        null;

      if (!nombreArchivo) {
        throw new BadRequestException(
          'Se requiere "nombre_archivo", "filename" o "fileName"',
        );
      }

      this.logger.log(
        `🗑️ Delete documento request (POST) - id: ${id}, nombre_archivo: "${nombreArchivo}"`,
      );

      const result = await this.documentosService.deleteDocumento(
        id,
        nombreArchivo,
      );

      // Return format matching n8n response
      return {
        ok: true,
        mensaje: result.message,
        id: String(id),
        archivo: nombreArchivo,
        numero_operacion:
          body.numeroOperatiune ||
          body.numar_operatiune ||
          body.numeroOperacion ||
          null,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosController.deleteDocumentoPost:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint REST standard pentru ștergerea unui documento
   * DELETE /api/documentos/:id?nombre_archivo=...
   */
  @Delete(':id')
  async deleteDocumento(
    @Param('id') id: string,
    @Query('nombre_archivo') nombreArchivo: string,
  ) {
    try {
      if (!nombreArchivo) {
        throw new BadRequestException(
          'Se requiere query parameter "nombre_archivo" (nombre del archivo)',
        );
      }

      this.logger.log(
        `🗑️ Delete documento request (DELETE) - id: ${id}, nombre_archivo: "${nombreArchivo}"`,
      );

      const result = await this.documentosService.deleteDocumento(
        id,
        nombreArchivo,
      );

      return {
        success: true,
        message: result.message,
        affectedRows: result.affectedRows,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosController.deleteDocumento:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento: ${error.message}`,
      );
    }
  }
}
