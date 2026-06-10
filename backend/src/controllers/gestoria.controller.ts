import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Logger,
  Res,
  ConflictException,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GestoriaService } from '../services/gestoria.service';
import { NominasService } from '../services/nominas.service';
import { Response, Request } from 'express';
import { memoryStorage } from 'multer';

@Controller('api/gestoria')
@UseGuards(JwtAuthGuard)
export class GestoriaController {
  private readonly logger = new Logger(GestoriaController.name);

  constructor(
    private readonly gestoriaService: GestoriaService,
    private readonly nominasService: NominasService,
  ) {}

  /**
   * GET /api/gestoria/stats?ano=2025
   * Returnează statistici pentru anul dat
   */
  @Get('stats')
  async getStats(@Query('ano') ano: string) {
    try {
      const anoNum = parseInt(ano, 10);
      if (isNaN(anoNum) || anoNum < 2000 || anoNum > 2100) {
        throw new BadRequestException('Año inválido');
      }

      const stats = await this.gestoriaService.getStats(anoNum);
      return {
        success: true,
        ...stats,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting stats:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/gestoria/empleados?ano=2025&pendientes=0&q=...&centro=...
   * Returnează lista de angajați cu status nómina
   */
  @Get('empleados')
  async getEmpleados(
    @Query('ano') ano: string,
    @Query('pendientes') pendientes?: string,
    @Query('q') q?: string,
    @Query('centro') centro?: string,
  ) {
    try {
      const anoNum = parseInt(ano, 10);
      if (isNaN(anoNum) || anoNum < 2000 || anoNum > 2100) {
        throw new BadRequestException('Año inválido');
      }

      const empleados = await this.gestoriaService.getEmpleadosMatrix(anoNum, {
        pendientes: pendientes === '1' || pendientes === 'true',
        q: q || undefined,
        centro: centro || undefined,
      });

      return {
        success: true,
        empleados,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting empleados:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener empleados: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/gestoria/nominas?employeeNombre=...&mes=..&ano=..
   * Returnează lista de nóminas pentru un angajat
   */
  @Get('nominas')
  async getNominas(
    @Query('employeeNombre') employeeNombre: string,
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
  ) {
    try {
      if (!employeeNombre) {
        throw new BadRequestException('employeeNombre es requerido');
      }

      const mesNum = mes ? parseInt(mes, 10) : undefined;
      const anoNum = ano ? parseInt(ano, 10) : undefined;

      if (mesNum !== undefined && (mesNum < 1 || mesNum > 12)) {
        throw new BadRequestException('Mes inválido (debe ser 1-12)');
      }

      if (anoNum !== undefined && (anoNum < 2000 || anoNum > 2100)) {
        throw new BadRequestException('Año inválido');
      }

      const nominas = await this.gestoriaService.getNominasForEmpleado(
        employeeNombre,
        mesNum,
        anoNum,
      );

      return {
        success: true,
        nominas,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting nominas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener nóminas: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/gestoria/nominas/upload
   * Upload single nómina
   */
  @Post('nominas/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadNomina(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Archivo es requerido');
      }

      const mes = parseInt(body.mes, 10);
      const ano = parseInt(body.ano, 10);
      const preview = body.preview === 'true' || body.preview === true;

      if (isNaN(mes) || mes < 1 || mes > 12) {
        throw new BadRequestException('Mes inválido (debe ser 1-12)');
      }

      if (isNaN(ano) || ano < 2000 || ano > 2100) {
        throw new BadRequestException('Año inválido');
      }

      const nombre = body.nombre || '';
      const codigo = body.codigo || undefined;

      const result = await this.gestoriaService.uploadNomina(
        file,
        nombre,
        mes,
        ano,
        codigo,
        preview,
      );

      this.logger.log(
        `✅ Nómina uploaded by ${user?.userId || 'unknown'}: ${result.nombre} - ${mes}/${ano}`,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading nómina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error al subir nómina: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/nominas/upload-bulk
   * Upload PDF cu multiple pagini (fiecare pagină = o nómina)
   */
  @Post('nominas/upload-bulk')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBulkNominas(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Archivo es requerido');
      }

      const mes = body.mes ? parseInt(body.mes, 10) : undefined;
      const ano = body.ano ? parseInt(body.ano, 10) : undefined;
      const preview = body.preview === 'true' || body.preview === true;

      // Parse forceReplace list (JSON string)
      let forceReplace: Array<{
        pagina: number;
        codigo: string;
        nombre: string;
      }> = [];
      if (body.forceReplace) {
        try {
          forceReplace =
            typeof body.forceReplace === 'string'
              ? JSON.parse(body.forceReplace)
              : body.forceReplace;
        } catch (e) {
          this.logger.warn('⚠️ Error parsing forceReplace:', e);
        }
      }

      // Parse forceFechaBaja list (JSON string)
      let forceFechaBaja: Array<{
        pagina: number;
        codigo: string;
        nombre: string;
      }> = [];
      if (body.forceFechaBaja) {
        try {
          forceFechaBaja =
            typeof body.forceFechaBaja === 'string'
              ? JSON.parse(body.forceFechaBaja)
              : body.forceFechaBaja;
        } catch (e) {
          this.logger.warn('⚠️ Error parsing forceFechaBaja:', e);
        }
      }

      if (mes !== undefined && (isNaN(mes) || mes < 1 || mes > 12)) {
        throw new BadRequestException('Mes inválido (debe ser 1-12)');
      }

      if (ano !== undefined && (isNaN(ano) || ano < 2000 || ano > 2100)) {
        throw new BadRequestException('Año inválido');
      }

      const result = await this.gestoriaService.uploadBulkNominas(
        file,
        mes,
        ano,
        preview,
        forceReplace,
        forceFechaBaja,
      );

      this.logger.log(
        `✅ Bulk upload by ${user?.userId || 'unknown'}: ${result.procesadas}/${result.total_paginas} procesadas`,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error in bulk upload:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al procesar PDF masivo: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/gestoria/nominas/download-all?employeeNombre=...&ano=2026
   * Descarcă toate nóminas unui angajat pentru un an (ZIP)
   */
  @Get('nominas/download-all')
  async downloadAllNominas(
    @Query('employeeNombre') employeeNombre: string,
    @Query('ano') ano: string,
    @Res() res: Response,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    try {
      if (!employeeNombre?.trim()) {
        throw new BadRequestException('employeeNombre es requerido');
      }
      const anoNum = parseInt(ano, 10);
      if (isNaN(anoNum) || anoNum < 2000 || anoNum > 2100) {
        throw new BadRequestException('Año inválido');
      }

      const { stream, filename, count } =
        await this.gestoriaService.downloadAllNominasZip(
          employeeNombre.trim(),
          anoNum,
        );

      const empleadoCodigo = user?.userId || user?.CODIGO || user?.codigo || '';
      const empleadoNombre =
        user?.['NOMBRE / APELLIDOS'] || user?.nombre || employeeNombre;
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      this.logger.log(
        `📦 Download all nóminas (${count}) - empleado: ${employeeNombre}, año: ${anoNum}`,
      );

      if (empleadoCodigo && this.nominasService) {
        try {
          const nominas = await this.gestoriaService.getNominasForEmpleado(
            employeeNombre.trim(),
            undefined,
            anoNum,
          );
          for (const nomina of nominas) {
            await this.nominasService.logNominaAcceso(
              nomina.id,
              empleadoCodigo,
              empleadoNombre,
              'download',
              ip,
              userAgent,
            );
          }
        } catch (logError: any) {
          this.logger.warn(
            `⚠️ Error logueando accesos bulk download: ${logError.message}`,
          );
        }
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      stream.pipe(res);
    } catch (error: any) {
      this.logger.error('❌ Error downloading all nóminas:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar nóminas: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/gestoria/nominas/:id/download
   * Descarcă nómina
   */
  @Get('nominas/:id/download')
  @UseGuards(JwtAuthGuard)
  async downloadNomina(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    try {
      const idNum = parseInt(id, 10);
      if (isNaN(idNum)) {
        throw new BadRequestException('ID inválido');
      }

      const nomina = await this.gestoriaService.getNominaById(idNum);

      // Loghează accesul (download) - folosim NominasService pentru logging
      const empleadoCodigo = user?.userId || user?.CODIGO || user?.codigo || '';
      const empleadoNombre =
        user?.['NOMBRE / APELLIDOS'] || user?.nombre || nomina.nombre || '';
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      this.logger.log(
        `📥 Download nómina ${idNum} - empleado: ${empleadoCodigo}, nombre: ${empleadoNombre}`,
      );

      if (empleadoCodigo && this.nominasService) {
        // Așteptăm logging-ul pentru a ne asigura că se face
        try {
          await this.nominasService.logNominaAcceso(
            idNum,
            empleadoCodigo,
            empleadoNombre,
            'download',
            ip,
            userAgent,
          );
          this.logger.log(`✅ Acces logat pentru download nómina ${idNum}`);
        } catch (logError: any) {
          this.logger.error(
            `❌ Eroare la logarea accesului (non-blocking): ${logError.message}`,
            logError.stack,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ Nu s-a putut loga accesul: empleadoCodigo=${empleadoCodigo}, nominasService=${!!this.nominasService}`,
        );
      }

      res.setHeader('Content-Type', nomina.tipo_mime);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nomina.nombre}_${id}.pdf"`,
      );
      res.send(nomina.archivo);
    } catch (error: any) {
      this.logger.error(`❌ Error downloading nómina ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar nómina: ${error.message}`,
      );
    }
  }

  /**
   * DELETE /api/gestoria/nominas/:id
   * Șterge nómina
   */
  @Delete('nominas/:id')
  async deleteNomina(@Param('id') id: string, @CurrentUser() user: any) {
    try {
      const idNum = parseInt(id, 10);
      if (isNaN(idNum)) {
        throw new BadRequestException('ID inválido');
      }

      await this.gestoriaService.deleteNomina(idNum);

      this.logger.log(
        `✅ Nómina ${idNum} deleted by ${user?.userId || 'unknown'}`,
      );

      return {
        success: true,
        message: 'Nómina eliminada correctamente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting nómina ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar nómina: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/gestoria/coste-personal/upload
   * Încarcă și procesează un fișier Excel Coste Personal
   */
  @Post('coste-personal/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.xlsx') ||
          file.originalname.endsWith('.xls')
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Solo se permiten archivos Excel (.xlsx, .xls)',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadCostePersonal(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    this.logger.log(
      `📤 Upload Coste Personal por ${user.email || user.CODIGO}: ${file.originalname}`,
    );

    try {
      const result = await this.gestoriaService.procesarCostePersonal(
        file.buffer,
      );
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando Coste Personal:`, error);
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/gestoria/coste-personal
   * Obține datele Coste Personal pentru o lună și an
   */
  @Get('coste-personal')
  @UseGuards(JwtAuthGuard)
  async getCostePersonal(@Query('mes') mes: string, @Query('ano') ano: string) {
    try {
      if (!mes || !ano) {
        throw new BadRequestException('Mes y año son requeridos');
      }

      const anoNum = parseInt(ano, 10);
      if (isNaN(anoNum)) {
        throw new BadRequestException('Año inválido');
      }

      const data = await this.gestoriaService.getCostePersonal(
        mes.toUpperCase(),
        anoNum,
      );
      return { success: true, data };
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo Coste Personal:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener datos: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/coste-personal
   * Salvează sau actualizează date Coste Personal
   */
  @Post('coste-personal')
  @UseGuards(JwtAuthGuard)
  async saveCostePersonal(@Body() body: any) {
    try {
      const result = await this.gestoriaService.saveCostePersonal(body);
      return { success: true, ...result };
    } catch (error: any) {
      this.logger.error(`❌ Error guardando Coste Personal:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/coste-personal/save-from-excel
   * Salvează date Coste Personal din Excel procesat
   */
  @Post('coste-personal/save-from-excel')
  @UseGuards(JwtAuthGuard)
  async saveCostePersonalFromExcel(
    @Body()
    body: {
      mes: string;
      ano: number;
      data: Array<any>;
    },
  ) {
    try {
      const result = await this.gestoriaService.saveCostePersonalFromExcel(
        body.mes,
        body.ano,
        body.data,
      );
      return { success: true, ...result };
    } catch (error: any) {
      this.logger.error(
        `❌ Error guardando Coste Personal desde Excel:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * PUT /api/gestoria/coste-personal/:id/field
   * Actualizează un câmp specific pentru Coste Personal
   */
  @Put('coste-personal/:id/field')
  @UseGuards(JwtAuthGuard)
  async updateCostePersonalField(
    @Param('id') id: string,
    @Body() body: { field: string; value: number },
  ) {
    try {
      const result = await this.gestoriaService.updateCostePersonalField(
        parseInt(id, 10),
        body.field,
        body.value,
      );
      return { success: true, ...result };
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando campo Coste Personal:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/coste-personal/upload-pdfs
   * Încarcă PDF-uri pentru popularea Coste Personal (nu salvează în Nominas)
   */
  @Post('coste-personal/upload-pdfs')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/pdf' ||
          file.originalname.endsWith('.pdf')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
      },
    }),
  )
  async uploadPDFsParaCostePersonal(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { mes?: string; ano?: number },
    @CurrentUser() user: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No se proporcionaron archivos PDF');
      }

      this.logger.log(
        `📤 Upload PDFs para Coste Personal por ${user.email || user.CODIGO}: ${files.length} archivos`,
      );

      const result = await this.gestoriaService.procesarPDFsParaCostePersonal(
        files,
        body.mes,
        body.ano,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando PDFs para Coste Personal:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al procesar PDFs: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/coste-personal/save-from-preview
   * Salvează date Coste Personal din preview (după confirmare)
   */
  @Post('coste-personal/save-from-preview')
  @UseGuards(JwtAuthGuard)
  async saveCostePersonalFromPreview(
    @Body()
    body: {
      mes: string;
      ano: number;
      preview: Array<any>;
    },
  ) {
    try {
      if (!body.mes || !body.ano || !body.preview) {
        throw new BadRequestException('Mes, año y preview son requeridos');
      }

      const result = await this.gestoriaService.saveCostePersonalFromPreview(
        body.mes,
        body.ano,
        body.preview,
      );

      return { success: true, ...result };
    } catch (error: any) {
      this.logger.error(
        `❌ Error guardando Coste Personal desde preview:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al guardar datos: ${error.message}`);
    }
  }

  /**
   * POST /api/gestoria/coste-personal/poblar-desde-nominas
   * Populează tabelul Coste Personal din nóminas pentru o lună și an
   */
  @Post('coste-personal/poblar-desde-nominas')
  @UseGuards(JwtAuthGuard)
  async poblarCostePersonalDesdeNominas(
    @Body() body: { mes: string; ano: number; preview?: boolean },
  ) {
    try {
      if (!body.mes || !body.ano) {
        throw new BadRequestException('Mes y año son requeridos');
      }

      const preview =
        body.preview === true ||
        (typeof body.preview === 'string' && body.preview === 'true');

      if (preview) {
        // Preview mode - procesează dar nu salvează
        const result =
          await this.gestoriaService.previewPoblarCostePersonalDesdeNominas(
            body.mes,
            body.ano,
          );
        return { success: true, preview: true, ...result };
      } else {
        // Save mode - procesează și salvează
        const result =
          await this.gestoriaService.poblarCostePersonalDesdeNominas(
            body.mes,
            body.ano,
          );
        return { success: true, preview: false, ...result };
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error poblando Coste Personal desde nóminas:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al poblar datos: ${error.message}`);
    }
  }

  /**
   * Caută un angajat după nume (pentru actualizare automată în preview)
   */
  @Get('coste-personal/buscar-empleado')
  @UseGuards(JwtAuthGuard)
  async buscarEmpleadoPorNombre(@Query('nombre') nombre: string) {
    try {
      if (!nombre || nombre.trim().length === 0) {
        return {
          encontrado: false,
          codigo: null,
          nombre_bd: null,
          confianza: 0,
        };
      }

      const empleadoEncontrado =
        await this.gestoriaService.findEmpleadoFlexible(
          nombre.trim(),
          null,
          null,
        );

      if (empleadoEncontrado) {
        return {
          encontrado: true,
          codigo: empleadoEncontrado.CODIGO,
          nombre_bd: empleadoEncontrado['NOMBRE / APELLIDOS'],
          confianza: empleadoEncontrado.confianza || 0,
          matchType: empleadoEncontrado.matchType || 'unknown',
        };
      } else {
        return {
          encontrado: false,
          codigo: null,
          nombre_bd: null,
          confianza: 0,
        };
      }
    } catch (error: any) {
      this.logger.error(`❌ Error buscando empleado por nombre:`, error);
      throw new BadRequestException(
        `Error al buscar empleado: ${error.message}`,
      );
    }
  }

  /**
   * DELETE /api/gestoria/coste-personal/limpiar-mes
   * Șterge toate înregistrările Coste Personal pentru o lună și an
   */
  @Delete('coste-personal/limpiar-mes')
  @UseGuards(JwtAuthGuard)
  async limpiarCostePersonalMes(
    @Body() body: { mes: string; ano: number },
    @CurrentUser() user: any,
  ) {
    try {
      if (!body.mes || !body.ano) {
        throw new BadRequestException('Mes y año son requeridos');
      }

      this.logger.log(
        `🗑️ Limpiando Coste Personal para ${body.mes} ${body.ano} por ${user.email || user.CODIGO}`,
      );

      const result = await this.gestoriaService.deleteCostePersonalByMesAno(
        body.mes.toUpperCase(),
        body.ano,
      );

      return {
        success: true,
        message: `Se eliminaron ${result.deleted} registros`,
        deleted: result.deleted,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error limpiando Coste Personal:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al limpiar datos: ${error.message}`);
    }
  }

  /**
   * GET /api/gestoria/coste-personal/export-excel
   * Exportă datele Coste Personal în format Excel
   */
  @Get('coste-personal/export-excel')
  @UseGuards(JwtAuthGuard)
  async exportCostePersonalExcel(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Res() res: Response,
  ) {
    try {
      if (!mes || !ano) {
        throw new BadRequestException('Mes y año son requeridos');
      }

      const buffer = await this.gestoriaService.exportCostePersonalToExcel(
        mes,
        parseInt(ano),
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Coste_Personal_${mes}_${ano}.xlsx"`,
      );
      res.send(buffer);
    } catch (error: any) {
      this.logger.error(`❌ Error exportando Coste Personal a Excel:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al exportar: ${error.message}`);
    }
  }

  /**
   * GET /api/gestoria/coste-personal/export-pdf
   * Exportă datele Coste Personal în format PDF
   */
  @Get('coste-personal/export-pdf')
  @UseGuards(JwtAuthGuard)
  async exportCostePersonalPDF(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Res() res: Response,
  ) {
    try {
      if (!mes || !ano) {
        throw new BadRequestException('Mes y año son requeridos');
      }

      const buffer = await this.gestoriaService.exportCostePersonalToPDF(
        mes,
        parseInt(ano),
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Coste_Personal_${mes}_${ano}.pdf"`,
      );
      res.send(buffer);
    } catch (error: any) {
      this.logger.error(`❌ Error exportando Coste Personal a PDF:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al exportar: ${error.message}`);
    }
  }
}
