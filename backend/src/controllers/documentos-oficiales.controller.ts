import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  Res,
  UseInterceptors,
  UploadedFiles,
  Param,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentosOficialesService } from '../services/documentos-oficiales.service';

@Controller('api/documentos-oficiales')
@UseGuards(JwtAuthGuard)
export class DocumentosOficialesController {
  private readonly logger = new Logger(DocumentosOficialesController.name);

  constructor(
    private readonly documentosOficialesService: DocumentosOficialesService,
  ) {}

  /**
   * GET endpoint - acceptă query params pentru codigo și/sau nombre
   */
  @Get()
  async getDocumentosOficiales(
    @Query('codigo') codigo?: string,
    @Query('nombre') nombre?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get documentos oficiales request (GET) - codigo: ${codigo || 'N/A'}, nombre: ${nombre || 'N/A'}`,
      );

      const documentos =
        await this.documentosOficialesService.getDocumentosOficiales(
          codigo,
          nombre,
        );

      return {
        success: true,
        data: documentos,
      };
    } catch (error: any) {
      this.logger.error(
        'Error in DocumentosOficialesController.getDocumentosOficiales (GET):',
        error,
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Error al obtener los documentos oficiales');
    }
  }

  /**
   * POST endpoint - acceptă body cu codigo și/sau nombre (pentru compatibilitate cu n8n)
   * Mărită limită pentru a evita rate limiting când se încarcă documentele pentru un angajat
   */
  @Post()
  @Throttle({
    short: { ttl: 10000, limit: 200 }, // 200 request-uri / 10 secunde (în loc de 100)
    medium: { ttl: 60000, limit: 1000 }, // 1000 request-uri / minut (în loc de 500)
  })
  async getDocumentosOficialesPost(@Body() body: any) {
    try {
      const codigo = body.codigo;
      const nombre = body.nombre;

      this.logger.log(
        `📝 Get documentos oficiales request (POST) - codigo: ${codigo || 'N/A'}, nombre: ${nombre || 'N/A'}`,
      );

      const documentos =
        await this.documentosOficialesService.getDocumentosOficiales(
          codigo,
          nombre,
        );

      return documentos; // Returnează direct array-ul pentru compatibilitate cu n8n
    } catch (error: any) {
      this.logger.error(
        'Error in DocumentosOficialesController.getDocumentosOficiales (POST):',
        error,
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Error al obtener los documentos oficiales');
    }
  }

  /**
   * Endpoint pentru descărcarea unui document oficial
   * GET /api/documentos-oficiales/download?documentId=123&id=10000001&email=user@example.com&fileName=document.pdf
   */
  @Get('download')
  async downloadDocumentoOficial(
    @Res() res: Response,
    @Query('documentId') documentId: string,
    @Query('id') id?: string,
    @Query('email') email?: string,
    @Query('fileName') fileName?: string,
    @Query('preview') preview?: string,
  ) {
    try {
      const documentIdNumber = parseInt(documentId, 10);

      if (isNaN(documentIdNumber)) {
        throw new BadRequestException(
          `Parámetro "documentId" inválido: ${documentId}`,
        );
      }

      const isPreview = preview === 'true' || preview === '1';

      this.logger.log(
        `📥 Download documento oficial request - documentId: ${documentIdNumber}, id: ${id || 'N/A'}, email: ${email || 'N/A'}, fileName: ${fileName || 'N/A'}, preview: ${isPreview}`,
      );

      const { archivo, tipo_mime, nombre_archivo } =
        await this.documentosOficialesService.downloadDocumentoOficial(
          documentIdNumber,
          id,
          email,
          fileName,
        );

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
      this.logger.error(
        'Error in DocumentosOficialesController.downloadDocumentoOficial:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al descargar el documento oficial');
    }
  }

  /**
   * Endpoint pentru upload-ul de documente oficiale
   * POST /api/documentos-oficiales/upload
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - id (empleado_id), correo_electronico, nombre_empleado
   * - fecha_creacion, tipo_documento_0, tipo_documento_1, ...
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
  async uploadDocumentoOficial(
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
        `📤 Upload documentos oficiales request - ${allFiles.length} archivo(s), id: ${body.id || body.empleado_id || 'N/A'}`,
      );

      const result =
        await this.documentosOficialesService.uploadDocumentoOficial(
          allFiles,
          body,
        );

      return {
        success: true,
        message: `Documentos oficiales procesados: ${result.processed} procesados, ${result.inserted} insertados`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading documentos oficiales:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al subir documentos oficiales: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru actualizarea vizibilității documentului pentru angajat
   * POST /api/documentos-oficiales/:docId/visible
   * Body: { visible: boolean | string | number }
   * IMPORTANT: Această rută trebuie definită înainte de rutele cu parametri mai generali (ex: @Delete(':id'))
   */
  @Post(':docId/visible')
  async updateDocumentVisibility(
    @Param('docId') docId: string,
    @Body() body: { visible: boolean | string | number },
  ) {
    try {
      const visible =
        body.visible === true ||
        String(body.visible).toLowerCase() === 'true' ||
        body.visible === 1;
      const permissoValue = visible ? 'SI' : null;

      this.logger.log(
        `🔄 Update document visibility request - docId: ${docId}, visible: ${visible}`,
      );

      const result =
        await this.documentosOficialesService.updatePermissoParaEmpleado(
          docId,
          permissoValue,
        );

      return {
        success: true,
        message: result.message,
        affectedRows: result.affectedRows,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.updateDocumentVisibility:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar la visibilidad del documento: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru actualizarea flag-ului necesita_firma
   * PATCH /api/documentos-oficiales/:docId/necesita-firma
   * Body: { necesitaFirma: boolean }
   * IMPORTANT: Această rută trebuie definită înainte de rutele cu parametri mai generali
   */
  @Patch(':docId/necesita-firma')
  @UseGuards(JwtAuthGuard)
  async updateNecesitaFirma(
    @Param('docId') docId: string,
    @Body() body: { necesitaFirma: boolean | string | number },
  ) {
    try {
      const necesitaFirma =
        body.necesitaFirma === true ||
        String(body.necesitaFirma).toLowerCase() === 'true' ||
        body.necesitaFirma === 1;

      this.logger.log(
        `🔄 Update necesita_firma request - docId: ${docId}, necesitaFirma: ${necesitaFirma}`,
      );

      const result = await this.documentosOficialesService.updateNecesitaFirma(
        docId,
        necesitaFirma,
      );

      return {
        success: true,
        message: result.message,
        affectedRows: result.affectedRows,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.updateNecesitaFirma:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar necesita_firma: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru a marca un contract ca fiind semnat
   * POST /api/documentos-oficiales/:docId/marcar-firmado
   * IMPORTANT: Această rută trebuie definită înainte de rutele cu parametri mai generali
   */
  @Post(':docId/marcar-firmado')
  @UseGuards(JwtAuthGuard)
  async marcarContratoComoFirmado(@Param('docId') docId: string) {
    try {
      this.logger.log(
        `🔄 Marcar contrato como firmado request - docId: ${docId}`,
      );

      const result =
        await this.documentosOficialesService.marcarContratoComoFirmado(docId);

      return {
        success: true,
        message: result.message,
        affectedRows: result.affectedRows,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.marcarContratoComoFirmado:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al marcar el contrato como firmado: ${error.message}`,
      );
    }
  }

  /**
   * Aplica sello de empresa en la última página del contrato y reemplaza el archivo.
   * POST /api/documentos-oficiales/:docId/aplicar-sello-empresa
   */
  @Post(':docId/aplicar-sello-empresa')
  @UseGuards(JwtAuthGuard)
  async aplicarSelloEmpresa(@Param('docId') docId: string) {
    try {
      this.logger.log(`🔏 Aplicar sello empresa - docId: ${docId}`);
      const result =
        await this.documentosOficialesService.aplicarSelloEmpresa(docId);
      return {
        success: true,
        message: result.message,
        doc_id: result.doc_id,
        nombre_archivo: result.nombre_archivo,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.aplicarSelloEmpresa:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al aplicar el sello de empresa: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru a obține lista de angajați cu statusul contractelor
   * GET /api/documentos-oficiales/empleados-contratos
   */
  @Get('empleados-contratos')
  @UseGuards(JwtAuthGuard)
  async getEmpleadosConStatusContratos() {
    try {
      this.logger.log(`📝 Get empleados con status contratos request`);

      const result =
        await this.documentosOficialesService.getEmpleadosConStatusContratos();

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.getEmpleadosConStatusContratos:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener empleados con status de contratos: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru ștergerea unui documento oficial
   * POST /api/documentos-oficiales/delete (pentru compatibilitate cu n8n)
   * Accepts body: { id: number, nombre_archivo?: string, filename?: string, fileName?: string }
   */
  @Post('delete')
  async deleteDocumentoOficialPost(@Body() body: any) {
    try {
      // Extract id (required) - this is doc_id (Int primary key)
      const id = body.id || body.facturald || body.facturaId;
      if (!id) {
        throw new BadRequestException('Se requiere "id" (doc_id)');
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
        `🗑️ Delete documento oficial request (POST) - id: ${id}, nombre_archivo: "${nombreArchivo}"`,
      );

      const result =
        await this.documentosOficialesService.deleteDocumentoOficial(
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
        '❌ Error in DocumentosOficialesController.deleteDocumentoOficialPost:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento oficial: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint REST standard pentru ștergerea unui documento oficial
   * DELETE /api/documentos-oficiales/:id?nombre_archivo=...
   */
  @Delete(':id')
  async deleteDocumentoOficial(
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
        `🗑️ Delete documento oficial request (DELETE) - id: ${id}, nombre_archivo: "${nombreArchivo}"`,
      );

      const result =
        await this.documentosOficialesService.deleteDocumentoOficial(
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
        '❌ Error in DocumentosOficialesController.deleteDocumentoOficial:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento oficial: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint pentru salvarea unui document semnat cu AutoFirma
   * POST /api/documentos-oficiales/save-signed
   * Compatible with n8n webhook: /webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4
   */
  @Post('save-signed')
  async saveSignedDocument(@Body() body: any) {
    try {
      this.logger.log(
        `💾 Save signed document request - id: ${body.id || 'N/A'}, nombre_archivo: "${body.nombre_archivo || 'N/A'}"`,
      );

      const result =
        await this.documentosOficialesService.saveSignedDocument(body);

      // Return format compatible with n8n response
      return {
        success: true,
        message: result.message,
        doc_id: result.doc_id,
        id: body.id,
        nombre_archivo: body.nombre_archivo,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.saveSignedDocument:',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al guardar el documento firmado: ${error.message}`,
      );
    }
  }

  /**
   * Alias endpoint pentru compatibilitate cu n8n webhook path
   * POST /api/documentos-oficiales/autofirma/save
   */
  @Post('autofirma/save')
  async saveSignedDocumentAlias(@Body() body: any) {
    return this.saveSignedDocument(body);
  }

  /**
   * Endpoint pentru a număra documentele oficiale care necesită firmă și sunt vizibile pentru angajat
   * GET /api/documentos-oficiales/count-necesitan-firma?codigo=XXX
   */
  @Get('count-necesitan-firma')
  async countDocumentosNecesitanFirma(@Query('codigo') codigo: string) {
    try {
      if (!codigo) {
        throw new BadRequestException('Se requiere codigo');
      }

      this.logger.log(
        `📊 Count documentos que necesitan firma request - codigo: ${codigo}`,
      );

      const count =
        await this.documentosOficialesService.countDocumentosNecesitanFirma(
          codigo,
        );

      return {
        success: true,
        count,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error in DocumentosOficialesController.countDocumentosNecesitanFirma:',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al contar documentos que necesitan firma: ${error.message}`,
      );
    }
  }
}
