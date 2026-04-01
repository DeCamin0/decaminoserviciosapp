import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CuadrantesService } from '../services/cuadrantes.service';
import { memoryStorage } from 'multer';

@Controller('api/cuadrantes')
@UseGuards(JwtAuthGuard) // Apply JwtAuthGuard to all routes in this controller
export class CuadrantesController {
  private readonly logger = new Logger(CuadrantesController.name);

  constructor(private readonly cuadrantesService: CuadrantesService) {}

  /**
   * GET endpoint pentru cuadrantes cu query params (pentru compatibilitate cu workflow-ul n8n original)
   */
  @Get()
  async getCuadrantes(
    @Query('centro') centro?: string,
    @Query('empleado') empleado?: string,
    @Query('nombre') nombre?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get cuadrantes request - centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}`,
      );

      const cuadrantes = await this.cuadrantesService.getCuadrantes(
        centro,
        empleado,
        nombre,
      );

      return cuadrantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting cuadrantes:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru cuadrantes (pentru compatibilitate cu frontend-ul actual și n8n)
   * Acceptă body cu:
   *   - { email: string } - pentru verificare cuadrantes după email (compatibil cu n8n get-cuadrantes-yyBov0qVQZEhX2TL)
   *   - { codigo: string } sau { centro?, empleado?, nombre? }
   */
  @Post()
  async getCuadrantesPost(@Body() body: any) {
    try {
      // Suport pentru { email: string } - compatibil cu n8n endpoint get-cuadrantes-yyBov0qVQZEhX2TL
      const email = body.email;

      // Frontend-ul trimite { codigo: string }
      // Workflow-ul n8n original folosea query params: centro, empleado (CODIGO), nombre
      const empleado = body.codigo || body.empleado;
      const centro = body.centro;
      const nombre = body.nombre;

      this.logger.log(
        `📝 Get cuadrantes POST request - centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}, email: ${email || 'all'}`,
      );

      const cuadrantes = await this.cuadrantesService.getCuadrantes(
        centro,
        empleado,
        nombre,
        email,
      );

      return cuadrantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting cuadrantes:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru salvare cuadrante
   * Acceptă body cu toate câmpurile cuadrante (CODIGO, EMAIL, NOMBRE, LUNA, CENTRO, ZI_1-ZI_31)
   * Compatibil cu n8n endpoint guardar-cuadrante-yyBov0qVQZEhX2TL
   */
  @Post('save')
  async saveCuadrante(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Save cuadrante request - CODIGO: ${body.CODIGO || 'N/A'}, LUNA: ${body.LUNA || 'N/A'}, NOMBRE: ${body.NOMBRE || 'N/A'}`,
      );

      const result = await this.cuadrantesService.saveCuadrante(body);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error saving cuadrante:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru update bulk cuadrantes
   * Acceptă body cu { cuadrantes: [...], centro?, mesAno?, action?, timestamp?, user? }
   * Compatibil cu n8n endpoint update/bce8a5c5-1ca7-4005-9646-22d6016945ab
   */
  @Post('update')
  async updateCuadrantesBulk(@Body() body: any) {
    try {
      const cuadrantes = body.cuadrantes;

      if (!Array.isArray(cuadrantes) || cuadrantes.length === 0) {
        throw new BadRequestException(
          'cuadrantes must be a non-empty array in body',
        );
      }

      this.logger.log(
        `📝 Update cuadrantes bulk request - count: ${cuadrantes.length}, centro: ${body.centro || 'N/A'}, mesAno: ${body.mesAno || 'N/A'}`,
      );

      const result =
        await this.cuadrantesService.updateCuadrantesBulk(cuadrantes);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating cuadrantes bulk:', error);
      throw error;
    }
  }

  /**
   * PATCH endpoint pentru toggle vizibilitate cuadrante
   * Acceptă body cu: { id: number, visible: boolean } sau { CODIGO: string, LUNA: string, visible: boolean }
   */
  @Post('toggle-visible')
  async toggleVisible(
    @Body()
    body: {
      id?: number;
      CODIGO?: string;
      LUNA?: string;
      visible: boolean;
    },
  ) {
    try {
      const { id, CODIGO, LUNA, visible } = body;

      if (id) {
        // Update by ID
        await this.cuadrantesService.toggleVisibleById(id, visible);
      } else if (CODIGO && LUNA) {
        // Update by CODIGO and LUNA
        await this.cuadrantesService.toggleVisibleByCodigoLuna(
          CODIGO,
          LUNA,
          visible,
        );
      } else {
        throw new BadRequestException(
          'Either id or (CODIGO and LUNA) must be provided',
        );
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error('❌ Error toggling cuadrante visibility:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru upload Excel cu cuadrantes
   * Acceptă multipart/form-data cu:
   *   - file: Excel file (.xlsx, .xls)
   *   - mes: luna în format "YYYY-MM" (ex: "2025-01")
   *   - centro: centrul de lucru
   *   - excelFormat (opcional): "auto" | "he_hs" | "celdas_multilinea" | "turno_horas_tabla"
   */
  @Post('upload-excel')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'application/octet-stream', // Sometimes Excel files come as this
        ];
        if (allowedMimes.includes(file.mimetype)) {
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
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { mes?: string; centro?: string; excelFormat?: string },
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó ningún archivo');
      }

      const mes = body.mes;
      const centro = body.centro;
      const excelFormat =
        body.excelFormat === 'auto'
          ? 'auto'
          : body.excelFormat === 'celdas_multilinea'
            ? 'celdas_multilinea'
            : body.excelFormat === 'turno_horas_tabla'
              ? 'turno_horas_tabla'
              : 'he_hs';

      if (!mes || !mes.match(/^\d{4}-\d{2}$/)) {
        throw new BadRequestException(
          'Mes inválido. Debe ser en formato YYYY-MM (ej: 2025-01)',
        );
      }

      if (!centro || centro.trim() === '') {
        throw new BadRequestException('Centro es requerido');
      }

      this.logger.log(
        `📝 Upload Excel cuadrantes request - mes: ${mes}, centro: ${centro || 'N/A'}, file: ${file.originalname}`,
      );

      const result = await this.cuadrantesService.procesarCuadrantesExcel(
        file.buffer,
        mes,
        centro,
        { excelFormat },
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error uploading Excel:', error);
      throw error;
    }
  }

  /**
   * GET /api/cuadrantes/check-existing?codigo=XXX&mes=YYYY-MM&centro=XXX
   * Verifică dacă există deja cuadrante sau horario_multicentro pentru un angajat, lună și centru
   */
  @Get('check-existing')
  async checkExistingCuadrante(
    @Query('codigo') codigo: string,
    @Query('mes') mes: string,
    @Query('centro') centro?: string,
  ) {
    try {
      if (!codigo) {
        throw new BadRequestException('Se requiere el código del empleado');
      }
      if (!mes) {
        throw new BadRequestException('Se requiere el mes (YYYY-MM)');
      }

      this.logger.log(
        `📝 Check existing cuadrante request - codigo: ${codigo}, mes: ${mes}, centro: ${centro || 'N/A'}`,
      );

      const result = await this.cuadrantesService.checkExistingCuadrante(
        codigo,
        mes,
        centro,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error checking existing cuadrante:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al verificar cuadrante existente: ${error.message}`,
      );
    }
  }
}
