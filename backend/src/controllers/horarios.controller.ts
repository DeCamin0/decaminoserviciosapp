import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HorariosService } from '../services/horarios.service';

@Controller('api/horarios')
@UseGuards(JwtAuthGuard)
export class HorariosController {
  private readonly logger = new Logger(HorariosController.name);

  constructor(private readonly horariosService: HorariosService) {}

  /**
   * POST endpoint pentru toate acțiunile (create, get, update, delete)
   * POST /api/horarios
   * Body: { action: "create" | "get" | "update" | "delete", payload: {...} }
   */
  @Post()
  async handleHorarioAction(@Body() body: any) {
    try {
      const action = body?.action || body?.body?.action;

      this.logger.log(`📝 Horario action request: ${action}`);

      switch (action) {
        case 'create': {
          const result = await this.horariosService.createHorario(body);
          return result;
        }

        case 'get': {
          const horarios = await this.horariosService.getAllHorarios();
          return horarios;
        }

        case 'update': {
          this.logger.log(
            `📝 Update horario body structure: ${JSON.stringify({ action: body?.action, hasPayload: !!body?.payload, hasId: !!body?.payload?.id, idValue: body?.payload?.id })}`,
          );
          const result = await this.horariosService.updateHorario(body);
          return result;
        }

        case 'delete': {
          const payload = body?.body?.payload || body?.payload || body;
          const id = payload?.id;
          const centroNombre = payload?.centroNombre;

          if (!id) {
            throw new BadRequestException(
              'Se requiere el ID del horario para eliminar.',
            );
          }

          if (!centroNombre) {
            throw new BadRequestException(
              'Se requiere el centroNombre del horario para eliminar.',
            );
          }

          const result = await this.horariosService.deleteHorario(
            Number(id),
            centroNombre,
          );
          return result;
        }

        default:
          throw new BadRequestException(
            `Acción no válida: ${action}. Acciones permitidas: create, get, update, delete.`,
          );
      }
    } catch (error: any) {
      this.logger.error(
        'Error in HorariosController.handleHorarioAction:',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al procesar la acción: ${error.message}`,
      );
    }
  }

  /**
   * GET endpoint pentru listarea tuturor horarios (compatibilitate REST)
   * GET /api/horarios
   */
  @Get()
  async getAllHorarios() {
    try {
      this.logger.log('📝 Get all horarios request (GET)');
      const horarios = await this.horariosService.getAllHorarios();
      return horarios;
    } catch (error: any) {
      this.logger.error('Error in HorariosController.getAllHorarios:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener los horarios: ${error.message}`,
      );
    }
  }

  /**
   * GET endpoint pentru verificarea existenței orarului pentru un angajat
   * Verifică cuadrante, horario_multicentro, și horarios normal
   * GET /api/horarios/has-schedule?codigo=XXX&mes=YYYY-MM
   */
  @Get('has-schedule')
  async hasSchedule(
    @Query('codigo') codigo: string,
    @Query('mes') mes?: string,
  ) {
    try {
      if (!codigo) {
        throw new BadRequestException('Se requiere el código del empleado');
      }

      this.logger.log(
        `📝 Check schedule request - codigo: ${codigo}, mes: ${mes || 'current'}`,
      );

      const hasSchedule = await this.horariosService.hasSchedule(codigo, mes);
      return {
        success: true,
        hasSchedule,
      };
    } catch (error: any) {
      this.logger.error('❌ Error checking schedule:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al verificar el horario: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/horarios/upload-excel-multicentro
   * Upload Excel pentru horario_multicentro
   */
  @Post('upload-excel-multicentro')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcelMulticentro(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se ha enviado ningún archivo');
      }

      // Validăm tipul fișierului
      const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Tipo de archivo no permitido. Solo se permiten archivos Excel (.xlsx, .xls)`,
        );
      }

      const mes = body.mes || null; // Opțional - se detectează din Excel

      this.logger.log(
        `📝 Upload Excel horario_multicentro request - mes: ${mes || 'auto-detect'}, file: ${file.originalname}`,
      );

      const result = await this.horariosService.procesarHorarioMulticentroExcel(
        file.buffer,
        mes,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error uploading Excel horario_multicentro:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/horarios/save-multicentro
   * Salvează horarios_multicentro în baza de date
   */
  @Post('save-multicentro')
  async saveHorariosMulticentro(@Body() body: any) {
    try {
      const horarios = body.horarios;

      if (!Array.isArray(horarios) || horarios.length === 0) {
        throw new BadRequestException(
          'horarios must be a non-empty array in body',
        );
      }

      this.logger.log(
        `📝 Save horarios_multicentro bulk request - count: ${horarios.length}, mes: ${body.mes || 'N/A'}`,
      );

      const result =
        await this.horariosService.saveHorariosMulticentroBulk(horarios);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error saving horarios_multicentro bulk:', error);
      throw error;
    }
  }

  /**
   * GET endpoint pentru obținerea horario_multicentro pentru un angajat sau toate pentru o lună
   * GET /api/horarios/multicentro?codigo=XXX&mes=YYYY-MM
   * GET /api/horarios/multicentro?email=XXX@example.com&mes=YYYY-MM
   * GET /api/horarios/multicentro?mes=YYYY-MM (toate pentru luna respectivă)
   */
  @Get('multicentro')
  async getHorarioMulticentro(
    @Query('codigo') codigo?: string,
    @Query('email') email?: string,
    @Query('mes') mes?: string,
  ) {
    try {
      this.logger.debug(
        `🔍 [getHorarioMulticentro] Request primit - codigo: ${codigo || 'N/A'}, email: ${email || 'N/A'}, mes: ${mes || 'current'}`,
      );

      this.logger.log(
        `📝 Get horario_multicentro request - codigo: ${codigo || 'ALL'}, email: ${email || 'ALL'}, mes: ${mes || 'current'}`,
      );

      const horarios = await this.horariosService.getHorarioMulticentro(
        codigo,
        email,
        mes,
      );

      return {
        success: true,
        horarios,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting horario_multicentro:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener el horario_multicentro: ${error.message}`,
      );
    }
  }
}
