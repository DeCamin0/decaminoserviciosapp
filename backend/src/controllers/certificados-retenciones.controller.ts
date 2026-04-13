import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Param,
  Body,
  Res,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CertificadosRetencionesService } from '../services/certificados-retenciones.service';
import { Response } from 'express';

@Controller('api/certificados-retenciones')
export class CertificadosRetencionesController {
  private readonly logger = new Logger(CertificadosRetencionesController.name);

  constructor(
    private readonly certificadosService: CertificadosRetencionesService,
  ) {}

  @Post('upload-zip-preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('zip_file'))
  async previewZipUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo ZIP');
      }

      this.logger.log(`📦 Preview ZIP certificados retenciones`);

      const result =
        await this.certificadosService.procesarZipCertificadosRetenciones(
          file.buffer,
          user.userId || user.CODIGO || user.codigo,
        );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error en preview ZIP:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  @Post('upload-pdfs-preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('pdf_files', 50))
  async previewPdfsUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No se proporcionaron archivos PDF');
      }

      this.logger.log(
        `📄 Preview PDFs certificados retenciones (${files.length} archivos)`,
      );

      const pdfs = files.map((file) => ({
        nombreArchivo: file.originalname,
        archivoBuffer: file.buffer,
      }));

      const result =
        await this.certificadosService.procesarPdfCertificadosRetenciones(
          pdfs,
          user.userId || user.CODIGO || user.codigo,
        );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error en preview PDFs:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando PDFs: ${error.message}`);
    }
  }

  @Post('upload-pdfs-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('pdf_files', 50))
  async confirmarUploadPdfs(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('certificados') certificadosJson: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No se proporcionaron archivos PDF');
      }

      if (!certificadosJson) {
        throw new BadRequestException('certificados es requerido');
      }

      this.logger.log(
        `💾 Confirmar PDFs certificados retenciones (${files.length} archivos)`,
      );

      let seleccion: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
      }> = [];

      try {
        seleccion =
          typeof certificadosJson === 'string'
            ? JSON.parse(certificadosJson)
            : certificadosJson;
      } catch {
        throw new BadRequestException('certificados debe ser un JSON válido');
      }

      const previewResult =
        await this.certificadosService.procesarPdfCertificadosRetenciones(
          files.map((file) => ({
            nombreArchivo: file.originalname,
            archivoBuffer: file.buffer,
          })),
          user.userId || user.CODIGO || user.codigo,
        );

      const bufferMap = new Map<string, Buffer>();
      for (const c of previewResult.certificados) {
        bufferMap.set(c.nombreArchivo, c.archivoBuffer);
      }

      const paraGuardar: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
        archivoBuffer: Buffer;
      }> = [];

      for (const sel of seleccion) {
        const buffer = bufferMap.get(sel.nombreArchivo);
        if (buffer && sel.empleadoCodigo) {
          paraGuardar.push({
            nombreArchivo: sel.nombreArchivo,
            empleadoCodigo: sel.empleadoCodigo,
            empleadoNombre: sel.empleadoNombre,
            archivoBuffer: buffer,
          });
        }
      }

      const result =
        await this.certificadosService.guardarCertificadosRetenciones(
          paraGuardar,
          user.userId || user.CODIGO || user.codigo,
        );

      return {
        success: true,
        message: `Certificados guardados: ${result.guardados} guardados, ${result.errores} errores`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error confirmando PDFs:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error guardando certificados: ${error.message}`,
      );
    }
  }

  @Post('upload-zip-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('zip_file'))
  async confirmarUploadZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('certificados') certificadosJson: string,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo ZIP');
      }

      if (!certificadosJson) {
        throw new BadRequestException('certificados es requerido');
      }

      this.logger.log(`💾 Confirmar ZIP certificados retenciones`);

      let seleccion: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
      }> = [];

      try {
        seleccion =
          typeof certificadosJson === 'string'
            ? JSON.parse(certificadosJson)
            : certificadosJson;
      } catch {
        throw new BadRequestException('certificados debe ser un JSON válido');
      }

      const previewResult =
        await this.certificadosService.procesarZipCertificadosRetenciones(
          file.buffer,
          user.userId || user.CODIGO || user.codigo,
        );

      const bufferMap = new Map<string, Buffer>();
      for (const c of previewResult.certificados) {
        bufferMap.set(c.nombreArchivo, c.archivoBuffer);
      }

      const paraGuardar: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
        archivoBuffer: Buffer;
      }> = [];

      for (const sel of seleccion) {
        const buffer = bufferMap.get(sel.nombreArchivo);
        if (buffer && sel.empleadoCodigo) {
          paraGuardar.push({
            nombreArchivo: sel.nombreArchivo,
            empleadoCodigo: sel.empleadoCodigo,
            empleadoNombre: sel.empleadoNombre,
            archivoBuffer: buffer,
          });
        }
      }

      const result =
        await this.certificadosService.guardarCertificadosRetenciones(
          paraGuardar,
          user.userId || user.CODIGO || user.codigo,
        );

      return {
        success: true,
        message: `Certificados guardados: ${result.guardados} guardados, ${result.errores} errores`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error confirmando ZIP:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error guardando certificados: ${error.message}`,
      );
    }
  }

  /** Un solo PDF con muchos certificados: análisis por páginas (ejercicio + nombre) */
  @Post('upload-compuesto-preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf_file'))
  async previewPdfCompuesto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó PDF');
    }
    if (!file.originalname?.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('El archivo debe ser PDF');
    }
    const result =
      await this.certificadosService.procesarPdfCompuestoCertificadosRetenciones(
        file.buffer,
        user.userId || user.CODIGO || user.codigo,
      );
    return { success: true, ...result };
  }

  @Post('upload-compuesto-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf_file'))
  async confirmarPdfCompuesto(
    @UploadedFile() file: Express.Multer.File,
    @Body('certificados') certificadosJson: string,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó PDF');
    }
    if (!certificadosJson) {
      throw new BadRequestException('certificados es requerido');
    }
    let seleccion: Array<{
      pageFrom: number;
      pageTo: number;
      empleadoCodigo: string;
      empleadoNombre: string;
      ejercicio?: string | null;
    }>;
    try {
      seleccion =
        typeof certificadosJson === 'string'
          ? JSON.parse(certificadosJson)
          : certificadosJson;
    } catch {
      throw new BadRequestException('certificados debe ser JSON válido');
    }
    if (!Array.isArray(seleccion) || seleccion.length === 0) {
      throw new BadRequestException('certificados debe ser un array no vacío');
    }
    const result =
      await this.certificadosService.guardarPdfCompuestoCertificadosRetenciones(
        file.buffer,
        seleccion,
        user.userId || user.CODIGO || user.codigo,
      );
    return {
      success: true,
      message: `Certificados guardados: ${result.guardados} guardados, ${result.errores} errores`,
      ...result,
    };
  }

  @Get('todas')
  @UseGuards(JwtAuthGuard)
  async listarTodas() {
    try {
      const certificados =
        await this.certificadosService.listarTodosLosCertificadosRetenciones();

      return {
        success: true,
        certificados,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error listando certificados:`, error);
      throw new BadRequestException(
        `Error listando certificados: ${error.message}`,
      );
    }
  }

  @Get('empleado/:empleadoId')
  @UseGuards(JwtAuthGuard)
  async listarPorEmpleado(
    @Param('empleadoId') empleadoId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const grupo = user.grupo || user.GRUPO || '';
      const isAdminOrDeveloper = grupo === 'Admin' || grupo === 'Developer';
      const myCodigo = String(
        user.CODIGO || user.codigo || user.userId || '',
      ).trim();
      if (!isAdminOrDeveloper && myCodigo !== String(empleadoId || '').trim()) {
        throw new ForbiddenException(
          'No puede consultar certificados de otro empleado',
        );
      }

      const certificados =
        await this.certificadosService.listarCertificadosRetencionesEmpleado(
          empleadoId,
        );

      return {
        success: true,
        certificados,
      };
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `❌ Error listando certificados empleado ${empleadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando certificados: ${error.message}`,
      );
    }
  }

  @Get(':certificadoId/descargar')
  @UseGuards(JwtAuthGuard)
  async descargar(
    @Param('certificadoId') certificadoId: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    try {
      const idNum = parseInt(certificadoId, 10);
      if (isNaN(idNum)) {
        throw new BadRequestException('certificadoId debe ser un número');
      }

      const grupo = user.grupo || user.GRUPO || '';
      const isAdminOrDeveloper = grupo === 'Admin' || grupo === 'Developer';
      const empleadoId = isAdminOrDeveloper
        ? null
        : user.CODIGO || user.codigo || user.userId;

      this.logger.log(
        `📥 Descargando certificado ${idNum} empleado ${empleadoId ?? '(admin)'}`,
      );

      const doc = await this.certificadosService.descargarCertificadoRetencion(
        idNum,
        empleadoId,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${doc.nombre_archivo}"`,
      );

      res.send(doc.archivo);
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando certificado ${certificadoId}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando certificado: ${error.message}`,
      );
    }
  }
}
