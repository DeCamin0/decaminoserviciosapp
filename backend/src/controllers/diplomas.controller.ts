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
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DiplomasService } from '../services/diplomas.service';
import { Response } from 'express';

@Controller('api/diplomas')
export class DiplomasController {
  private readonly logger = new Logger(DiplomasController.name);

  constructor(private readonly diplomasService: DiplomasService) {}

  /**
   * Preview ZIP cu diplome (extrage informații fără a salva)
   */
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

      this.logger.log(`📦 Preview ZIP upload de diplomas`);

      const result = await this.diplomasService.procesarZipDiplomas(
        file.buffer,
        user.userId || user.CODIGO || user.codigo,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error en preview ZIP upload:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  /**
   * Preview PDF-uri individuale (extrage informații fără a salva)
   */
  @Post('upload-pdfs-preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('pdf_files', 50)) // Max 50 PDF-uri
  async previewPdfsUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No se proporcionaron archivos PDF');
      }

      this.logger.log(
        `📄 Preview PDFs upload de diplomas (${files.length} archivos)`,
      );

      // Convertește fișierele la formatul așteptat de service
      const pdfs = files.map((file) => ({
        nombreArchivo: file.originalname,
        archivoBuffer: file.buffer,
      }));

      const result = await this.diplomasService.procesarPdfDiplomas(
        pdfs,
        user.userId || user.CODIGO || user.codigo,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error en preview PDFs upload:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando PDFs: ${error.message}`);
    }
  }

  /**
   * Confirma și salvează PDF-urile individuale
   */
  @Post('upload-pdfs-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('pdf_files', 50)) // Max 50 PDF-uri
  async confirmarUploadPdfs(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('diplomas') diplomasJson: string, // JSON string cu diplomas seleccionadas
    @CurrentUser() user: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No se proporcionaron archivos PDF');
      }

      if (!diplomasJson) {
        throw new BadRequestException('diplomas es requerido');
      }

      this.logger.log(
        `💾 Confirmar y guardar PDFs de diplomas (${files.length} archivos)`,
      );

      // Parse diplomas seleccionadas
      let diplomasSeleccionadas: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
      }> = [];

      try {
        diplomasSeleccionadas =
          typeof diplomasJson === 'string'
            ? JSON.parse(diplomasJson)
            : diplomasJson;
      } catch {
        throw new BadRequestException('diplomas debe ser un JSON válido');
      }

      // Procesează PDF-urile pentru a obține buffer-urile
      const previewResult = await this.diplomasService.procesarPdfDiplomas(
        files.map((file) => ({
          nombreArchivo: file.originalname,
          archivoBuffer: file.buffer,
        })),
        user.userId || user.CODIGO || user.codigo,
      );

      // Creează mapă de buffer-uri după nume
      const bufferMap = new Map<string, Buffer>();
      for (const diploma of previewResult.diplomas) {
        bufferMap.set(diploma.nombreArchivo, diploma.archivoBuffer);
      }

      // Construiește lista de diplomas pentru salvare
      const diplomasParaGuardar: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
        archivoBuffer: Buffer;
      }> = [];

      for (const diplomaSel of diplomasSeleccionadas) {
        const buffer = bufferMap.get(diplomaSel.nombreArchivo);
        if (buffer && diplomaSel.empleadoCodigo) {
          diplomasParaGuardar.push({
            nombreArchivo: diplomaSel.nombreArchivo,
            empleadoCodigo: diplomaSel.empleadoCodigo,
            empleadoNombre: diplomaSel.empleadoNombre,
            archivoBuffer: buffer,
          });
        }
      }

      // Salvează diplomele
      const result = await this.diplomasService.guardarDiplomas(
        diplomasParaGuardar,
        user.userId || user.CODIGO || user.codigo,
      );

      return {
        success: true,
        message: `Diplomas guardadas: ${result.guardados} guardadas, ${result.errores} errores`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error confirmando PDFs upload:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error guardando diplomas: ${error.message}`,
      );
    }
  }

  /**
   * Confirma și salvează diplomele din ZIP
   */
  @Post('upload-zip-confirmar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('zip_file'))
  async confirmarUploadZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('diplomas') diplomasJson: string, // JSON string cu diplomas seleccionadas
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó archivo ZIP');
      }

      if (!diplomasJson) {
        throw new BadRequestException('diplomas es requerido');
      }

      this.logger.log(`💾 Confirmar y guardar ZIP de diplomas`);

      // Parse diplomas seleccionadas
      let diplomasSeleccionadas: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
      }> = [];

      try {
        diplomasSeleccionadas =
          typeof diplomasJson === 'string'
            ? JSON.parse(diplomasJson)
            : diplomasJson;
      } catch {
        throw new BadRequestException('diplomas debe ser un JSON válido');
      }

      // Procesează ZIP-ul pentru a obține buffer-urile
      const previewResult = await this.diplomasService.procesarZipDiplomas(
        file.buffer,
        user.userId || user.CODIGO || user.codigo,
      );

      // Creează mapă de buffer-uri după nume
      const bufferMap = new Map<string, Buffer>();
      for (const diploma of previewResult.diplomas) {
        bufferMap.set(diploma.nombreArchivo, diploma.archivoBuffer);
      }

      // Construiește lista de diplomas pentru salvare
      const diplomasParaGuardar: Array<{
        nombreArchivo: string;
        empleadoCodigo: string;
        empleadoNombre: string;
        archivoBuffer: Buffer;
      }> = [];

      for (const diplomaSel of diplomasSeleccionadas) {
        const buffer = bufferMap.get(diplomaSel.nombreArchivo);
        if (buffer && diplomaSel.empleadoCodigo) {
          diplomasParaGuardar.push({
            nombreArchivo: diplomaSel.nombreArchivo,
            empleadoCodigo: diplomaSel.empleadoCodigo,
            empleadoNombre: diplomaSel.empleadoNombre,
            archivoBuffer: buffer,
          });
        }
      }

      // Salvează diplomele
      const result = await this.diplomasService.guardarDiplomas(
        diplomasParaGuardar,
        user.userId || user.CODIGO || user.codigo,
      );

      return {
        success: true,
        message: `Diplomas guardadas: ${result.guardados} guardadas, ${result.errores} errores`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error confirmando ZIP upload:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error guardando diplomas: ${error.message}`,
      );
    }
  }

  /**
   * Listează toate diplomas (pentru admin)
   * IMPORTANT: Această rută trebuie să fie definită înaintea rutelor cu parametri dinamici
   */
  @Get('todas')
  @UseGuards(JwtAuthGuard)
  async listarTodasLasDiplomas() {
    try {
      const diplomas = await this.diplomasService.listarTodasLasDiplomas();

      return {
        success: true,
        diplomas,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error listando todas las diplomas:`, error);
      throw new BadRequestException(
        `Error listando diplomas: ${error.message}`,
      );
    }
  }

  /**
   * Listează diplomele unui angajat
   */
  @Get('empleado/:empleadoId')
  @UseGuards(JwtAuthGuard)
  async listarDiplomasEmpleado(@Param('empleadoId') empleadoId: string) {
    try {
      const diplomas =
        await this.diplomasService.listarDiplomasEmpleado(empleadoId);

      return {
        success: true,
        diplomas,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando diplomas para empleado ${empleadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando diplomas: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă o diplomă
   */
  @Get(':diplomaId/descargar')
  @UseGuards(JwtAuthGuard)
  async descargarDiploma(
    @Param('diplomaId') diplomaId: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    try {
      const diplomaIdNum = parseInt(diplomaId, 10);
      if (isNaN(diplomaIdNum)) {
        throw new BadRequestException('diplomaId debe ser un número');
      }

      // Angajații pot descărca doar propriile diplome; Admin/Developer pot descărca orice diplomă
      const grupo = user.grupo || user.GRUPO || '';
      const isAdminOrDeveloper = grupo === 'Admin' || grupo === 'Developer';
      const empleadoId = isAdminOrDeveloper
        ? null
        : user.CODIGO || user.codigo || user.userId;

      this.logger.log(
        `📥 Descargando diploma ${diplomaIdNum} para empleado ${empleadoId ?? '(admin)'}`,
      );

      const diploma = await this.diplomasService.descargarDiploma(
        diplomaIdNum,
        empleadoId,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${diploma.nombre_archivo}"`,
      );

      res.send(diploma.archivo);
    } catch (error: any) {
      this.logger.error(`❌ Error descargando diploma ${diplomaId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando diploma: ${error.message}`,
      );
    }
  }
}
