import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Res,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrlDocumentsService } from '../services/prl-documents.service';
import { Response } from 'express';
import AdmZip from 'adm-zip';

@Controller('api/prl')
export class PrlDocumentsController {
  private readonly logger = new Logger(PrlDocumentsController.name);

  constructor(private readonly prlDocumentsService: PrlDocumentsService) {}

  /**
   * Listă toate GRUPO-urile din DatosEmpleados (empleados activos) + numărul de template-uri PRL
   */
  @Get('grupos')
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listarGrupos(@CurrentUser() _user: any) {
    try {
      this.logger.log('📋 Listar todos los grupos de empleados activos');
      const grupos = await this.prlDocumentsService.listarGruposConTemplates();
      return { success: true, grupos };
    } catch (error: any) {
      this.logger.error('❌ Error listando grupos:', error);
      throw new BadRequestException(`Error al listar grupos: ${error.message}`);
    }
  }

  /**
   * Listă template-urile pentru un GRUPO
   */
  @Get('grupos/:grupoNombre/templates')
  @UseGuards(JwtAuthGuard)
  async listarTemplatesPorGrupo(
    @Param('grupoNombre') grupoNombre: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser() _user: any,
  ) {
    try {
      this.logger.log(`📋 Listar templates PRL para GRUPO: ${grupoNombre}`);
      const templates =
        await this.prlDocumentsService.listarTemplatesPorGrupo(grupoNombre);
      return { success: true, templates };
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando templates para GRUPO ${grupoNombre}:`,
        error,
      );
      throw new BadRequestException(
        `Error al listar templates: ${error.message}`,
      );
    }
  }

  /**
   * Preview ZIP upload - detectează documentele din ZIP
   */
  @Post('upload-zip-preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('zip_file'))
  async previewZipUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('grupo_nombre') grupoNombre: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo ZIP');
      }

      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      this.logger.log(`📦 Preview ZIP upload para GRUPO: ${grupoNombre}`);

      const result = await this.prlDocumentsService.procesarZipUpload(
        grupoNombre,
        file.buffer,
        user.userId,
      );

      return {
        success: true,
        grupo_nombre: grupoNombre,
        documentos: result.documentos,
      };
    } catch (error: any) {
      this.logger.error('❌ Error preview ZIP upload:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  /**
   * Confirma și salvează documentele din ZIP
   */
  @Post('upload-zip-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('zip_file'))
  async confirmarUploadZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('grupo_nombre') grupoNombre: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo ZIP');
      }

      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      this.logger.log(`💾 Confirmar y guardar ZIP para GRUPO: ${grupoNombre}`);

      // Procesează ZIP-ul pentru a obține documentele
      const previewResult = await this.prlDocumentsService.procesarZipUpload(
        grupoNombre,
        file.buffer,
        user.userId,
      );

      // Extrage documentele din ZIP
      const zip = new AdmZip(file.buffer);
      const zipEntries = zip.getEntries();

      const documentosParaGuardar: Array<{
        nombreArchivo: string;
        tipo: any;
        archivoBuffer: Buffer;
      }> = [];

      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          continue;
        }

        // Decodează numele corect din ZIP (CP437 -> UTF-8)
        const entryNameDecodificado =
          this.prlDocumentsService.decodificarNombreDesdeZip(entry);

        if (!entryNameDecodificado.toLowerCase().endsWith('.pdf')) {
          continue;
        }

        let nombreArchivo =
          entryNameDecodificado.split('/').pop() || entryNameDecodificado;

        // Normalizează pentru pattern-uri comune (fallback)
        nombreArchivo =
          this.prlDocumentsService.normalizarNombreArchivo(nombreArchivo);

        const docInfo = previewResult.documentos.find((d) => {
          // Compară normalizând ambele nume
          const normalizedEntry = nombreArchivo
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const normalizedDoc = d.nombreArchivo
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return (
            normalizedEntry === normalizedDoc ||
            d.nombreArchivo === nombreArchivo
          );
        });

        if (docInfo) {
          documentosParaGuardar.push({
            nombreArchivo, // Folosim numele normalizat
            tipo: docInfo.tipoDetectado,
            archivoBuffer: entry.getData(),
          });
        }
      }

      // Salvează documentele
      const result = await this.prlDocumentsService.confirmarUploadZip(
        grupoNombre,
        documentosParaGuardar,
        user.userId,
      );

      return {
        success: true,
        grupo_nombre: grupoNombre,
        templates_creados: result.templatesCreados,
        templates_actualizados: result.templatesActualizados,
      };
    } catch (error: any) {
      this.logger.error('❌ Error confirmando ZIP upload:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error guardando documentos: ${error.message}`,
      );
    }
  }

  /**
   * Upload un document individual
   */
  @Post('upload-documento')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('archivo'))
  async uploadDocumentoIndividual(
    @UploadedFile() file: Express.Multer.File,
    @Body('grupo_nombre') grupoNombre: string,
    @Body('tipo_documento') tipoDocumento: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo');
      }

      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      if (!tipoDocumento) {
        throw new BadRequestException('tipo_documento es requerido');
      }

      const tiposValidos = [
        'EVALUACION_RIESGOS',
        'ACTA_INFORMATIVA',
        'ENTREGA_EPIS',
        'RENUNCIA_RM',
        'MANUAL_TEST',
      ];

      if (!tiposValidos.includes(tipoDocumento)) {
        throw new BadRequestException(
          `tipo_documento debe ser uno de: ${tiposValidos.join(', ')}`,
        );
      }

      this.logger.log(
        `📄 Upload documento individual: ${file.originalname} para GRUPO ${grupoNombre}`,
      );

      const result = await this.prlDocumentsService.uploadDocumentoIndividual(
        grupoNombre,
        tipoDocumento as any,
        file.originalname,
        file.buffer,
        user.userId,
      );

      return {
        success: true,
        template_id: result.templateId,
        grupo_nombre: grupoNombre,
        tipo_documento: tipoDocumento,
        nombre_archivo: file.originalname,
      };
    } catch (error: any) {
      this.logger.error('❌ Error upload documento individual:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error subiendo documento: ${error.message}`,
      );
    }
  }

  /**
   * Trimite documentele PRL la toți angajații activi dintr-un grup
   */
  @Post('grupos/:grupoNombre/enviar')
  @UseGuards(JwtAuthGuard)
  async enviarDocumentosAGrupo(
    @Param('grupoNombre') grupoNombre: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      this.logger.log(
        `📤 Enviando documentos PRL al grupo: ${grupoNombre} por usuario ${user.userId || user.CODIGO}`,
      );

      const result = await this.prlDocumentsService.enviarDocumentosAGrupo(
        grupoNombre,
        user.userId || user.CODIGO || 'system',
      );

      return {
        success: true,
        grupo_nombre: grupoNombre,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error enviando documentos al grupo ${grupoNombre}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error enviando documentos: ${error.message}`,
      );
    }
  }

  /**
   * Șterge (dezactivează) toate template-urile pentru un GRUPO
   */
  @Delete('grupos/:grupoNombre/templates')
  @UseGuards(JwtAuthGuard)
  async eliminarTodosTemplatesPorGrupo(
    @Param('grupoNombre') grupoNombre: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      this.logger.log(
        `🗑️ Eliminar todos los templates para GRUPO ${grupoNombre} por usuario ${user.userId}`,
      );

      const result =
        await this.prlDocumentsService.eliminarTodosTemplatesPorGrupo(
          grupoNombre,
          user.userId,
        );

      return {
        success: true,
        message: `${result.eliminados} documentos eliminados permanentemente`,
        eliminados: result.eliminados,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error eliminando templates para GRUPO ${grupoNombre}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error eliminando templates: ${error.message}`,
      );
    }
  }

  /**
   * Șterge (dezactivează) un template
   */
  @Delete('templates/:templateId')
  @UseGuards(JwtAuthGuard)
  async eliminarTemplate(
    @Param('templateId') templateId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const templateIdNum = parseInt(templateId, 10);
      if (isNaN(templateIdNum)) {
        throw new BadRequestException('templateId debe ser un número');
      }

      this.logger.log(
        `🗑️ Eliminar template ${templateIdNum} por usuario ${user.userId}`,
      );

      await this.prlDocumentsService.eliminarTemplate(
        templateIdNum,
        user.userId,
      );

      return {
        success: true,
        message: 'Template eliminado permanentemente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando template ${templateId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error eliminando template: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă un template (pentru preview)
   */
  @Get('templates/:templateId/descargar')
  @UseGuards(JwtAuthGuard)
  async descargarTemplate(
    @Param('templateId') templateId: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    try {
      const templateIdNum = parseInt(templateId, 10);
      if (isNaN(templateIdNum)) {
        throw new BadRequestException('templateId debe ser un número');
      }

      this.logger.log(
        `📥 Descargar template ${templateIdNum} por usuario ${user.userId}`,
      );

      const template = await this.prlDocumentsService.descargarTemplate(
        templateIdNum,
        user.userId,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${template.nombre_archivo}"`,
      );

      res.send(template.archivo);
    } catch (error: any) {
      this.logger.error(`❌ Error descargando template ${templateId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando template: ${error.message}`,
      );
    }
  }

  /**
   * Obține toate documentele PRL ale angajatului curent
   */
  @Get('mis-documentos')
  @UseGuards(JwtAuthGuard)
  async listarMisDocumentos(@CurrentUser() user: any) {
    try {
      const empleadoId = user.CODIGO || user.codigo || user.userId;
      if (!empleadoId) {
        throw new BadRequestException('No se pudo identificar al empleado');
      }

      this.logger.log(
        `📋 Listando documentos PRL para empleado: ${empleadoId}`,
      );

      const documentos =
        await this.prlDocumentsService.listarDocumentosEmpleado(empleadoId);

      return {
        success: true,
        documentos,
      };
    } catch (error: any) {
      this.logger.error('❌ Error listando documentos PRL:', error);
      throw error;
    }
  }

  /**
   * Descarcă un document PRL atribuit angajatului curent
   */
  @Get('mis-documentos/:documentoId/descargar')
  @UseGuards(JwtAuthGuard)
  async descargarMiDocumento(
    @Param('documentoId') documentoId: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    try {
      const documentoIdNum = parseInt(documentoId, 10);
      if (isNaN(documentoIdNum)) {
        throw new BadRequestException('documentoId debe ser un número');
      }

      const empleadoId = user.CODIGO || user.codigo || user.userId;
      if (!empleadoId) {
        throw new BadRequestException('No se pudo identificar al empleado');
      }

      this.logger.log(
        `📥 Descargando documento PRL ${documentoIdNum} para empleado ${empleadoId}`,
      );

      const documento =
        await this.prlDocumentsService.descargarDocumentoEmpleado(
          documentoIdNum,
          empleadoId,
        );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${documento.nombre_archivo}"`,
      );

      res.send(documento.archivo);
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando documento PRL ${documentoId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando documento: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă documentul firmat (dacă există)
   */
  @Get('mis-documentos/:documentoId/descargar-firmado')
  @UseGuards(JwtAuthGuard)
  async descargarDocumentoFirmado(
    @Param('documentoId') documentoId: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    try {
      const documentoIdNum = parseInt(documentoId, 10);
      if (isNaN(documentoIdNum)) {
        throw new BadRequestException('documentoId debe ser un número');
      }

      const empleadoId = user.CODIGO || user.codigo || user.userId;
      if (!empleadoId) {
        throw new BadRequestException('No se pudo identificar al empleado');
      }

      this.logger.log(
        `📥 Descargando documento firmado ${documentoIdNum} para empleado ${empleadoId}`,
      );

      const documento =
        await this.prlDocumentsService.descargarDocumentoFirmado(
          documentoIdNum,
          empleadoId,
        );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${documento.nombre_archivo}"`,
      );

      res.send(documento.archivo);
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando documento firmado ${documentoId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando documento firmado: ${error.message}`,
      );
    }
  }

  /**
   * Marchează că angajatul renunță la Reconocimiento Médico
   */
  @Post('mis-documentos/:documentoId/renunciar-rm')
  @UseGuards(JwtAuthGuard)
  async renunciarReconocimientoMedico(
    @Param('documentoId') documentoId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const documentoIdNum = parseInt(documentoId, 10);
      if (isNaN(documentoIdNum)) {
        throw new BadRequestException('documentoId debe ser un número');
      }

      const empleadoId = user.CODIGO || user.codigo || user.userId;
      if (!empleadoId) {
        throw new BadRequestException('No se pudo identificar al empleado');
      }

      this.logger.log(
        `🔄 Empleado ${empleadoId} renunciando a RM para documento ${documentoIdNum}`,
      );

      await this.prlDocumentsService.renunciarReconocimientoMedico(
        documentoIdNum,
        empleadoId,
      );

      return {
        success: true,
        message:
          'Renuncia a Reconocimiento Médico registrada. Debes subir el documento firmado.',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error renunciando a RM para documento ${documentoId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Încarcă documentul semnat pentru Renuncia RM
   */
  /**
   * Actualizează template-urile MANUAL_TEST existente pentru a seta requiere_firma = true
   */
  @Post('actualizar-manuales-requiere-firma')
  @UseGuards(JwtAuthGuard)
  async actualizarManualesRequiereFirma() {
    try {
      this.logger.log(
        `🔄 Actualizando templates MANUAL_TEST para requerir firma...`,
      );

      const result =
        await this.prlDocumentsService.actualizarManualesRequiereFirma();

      return {
        success: true,
        message: `Se actualizaron ${result.actualizados} templates MANUAL_TEST`,
        actualizados: result.actualizados,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando templates MANUAL_TEST:`, error);
      throw new BadRequestException(
        `Error actualizando templates: ${error.message}`,
      );
    }
  }

  /**
   * Obține toți angajații cu documentele lor PRL organizate pentru tabel/matrix
   */
  @Get('empleados-con-documentos')
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listarEmpleadosConDocumentos(@CurrentUser() _user: any) {
    try {
      this.logger.log(
        `📊 Listando empleados con documentos PRL para tabla/matrix`,
      );

      const result =
        await this.prlDocumentsService.listarEmpleadosConDocumentosPRL();

      return {
        success: true,
        empleados: result,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando empleados con documentos PRL:`,
        error,
      );
      throw new BadRequestException(
        `Error listando empleados con documentos: ${error.message}`,
      );
    }
  }

  @Post('mis-documentos/:documentoId/subir-firmado')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('archivo'))
  async subirDocumentoFirmado(
    @Param('documentoId') documentoId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Se requiere un archivo');
      }

      const documentoIdNum = parseInt(documentoId, 10);
      if (isNaN(documentoIdNum)) {
        throw new BadRequestException('documentoId debe ser un número');
      }

      const empleadoId = user.CODIGO || user.codigo || user.userId;
      if (!empleadoId) {
        throw new BadRequestException('No se pudo identificar al empleado');
      }

      this.logger.log(
        `📤 Subiendo documento firmado ${documentoIdNum} para empleado ${empleadoId}`,
      );

      await this.prlDocumentsService.subirDocumentoFirmado(
        documentoIdNum,
        empleadoId,
        file.buffer,
        file.originalname,
      );

      return {
        success: true,
        message: 'Documento firmado subido exitosamente',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error subiendo documento firmado ${documentoId}:`,
        error,
      );
      throw error;
    }
  }
}
