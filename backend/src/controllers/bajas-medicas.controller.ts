import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  Logger,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BajasMedicasService } from '../services/bajas-medicas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/bajas-medicas')
@UseGuards(JwtAuthGuard)
export class BajasMedicasController {
  private readonly logger = new Logger(BajasMedicasController.name);

  constructor(private readonly bajasMedicasService: BajasMedicasService) {}

  @Get()
  async getBajasMedicas(@Query('codigo') codigo?: string) {
    try {
      this.logger.log(
        `📝 Get bajas médicas request - codigo: ${codigo || 'all'}`,
      );

      const bajasMedicas =
        await this.bajasMedicasService.getBajasMedicas(codigo);

      return bajasMedicas;
    } catch (error: any) {
      this.logger.error('❌ Error getting bajas médicas:', error);
      throw error;
    }
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadBajasMedicas(
    @UploadedFile() file: Express.Multer.File,
    @Query('accion') accion?: string,
  ) {
    try {
      // Verifică dacă este accion=guardar_bajas
      if (accion !== 'guardar_bajas') {
        throw new BadRequestException(
          'Para subir bajas médicas, debe incluir ?accion=guardar_bajas',
        );
      }

      if (!file) {
        throw new BadRequestException(
          'Archivo Excel requerido. Use multipart/form-data con campo "file"',
        );
      }

      // Verifică extensia fișierului
      const fileName = file.originalname || '';
      const validExtensions = ['.xlsx', '.xls', '.xml'];
      const fileExtension = fileName
        .toLowerCase()
        .substring(fileName.lastIndexOf('.'));
      if (!validExtensions.includes(fileExtension)) {
        throw new BadRequestException(
          `Formato de archivo no válido. Se aceptan: ${validExtensions.join(', ')}`,
        );
      }

      this.logger.log(
        `📤 Upload bajas médicas - archivo: ${fileName}, tamaño: ${file.size} bytes`,
      );

      const result = await this.bajasMedicasService.uploadBajasMedicas(
        file.buffer,
      );

      return {
        success: true,
        message: `Bajas médicas procesadas: ${result.processed} procesadas, ${result.inserted} insertadas, ${result.updated} actualizadas, ${result.errors} errores`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading bajas médicas:', error);
      throw error;
    }
  }

  @Post('manual')
  async createManualBaja(@Body() body: any) {
    try {
      const { codigoEmpleado, fechaBaja, fechaAlta, situacion, tipo, recaida } =
        body || {};

      if (!codigoEmpleado || String(codigoEmpleado).trim() === '') {
        throw new BadRequestException('codigoEmpleado es obligatorio');
      }
      if (!fechaBaja || String(fechaBaja).trim() === '') {
        throw new BadRequestException('fechaBaja es obligatoria (YYYY-MM-DD)');
      }

      const result = await this.bajasMedicasService.createManualBaja({
        codigoEmpleado: String(codigoEmpleado).trim(),
        fechaBaja: String(fechaBaja).trim(),
        fechaAlta: fechaAlta ? String(fechaAlta).trim() : undefined,
        situacion: situacion ? String(situacion).trim() : undefined,
        tipo: tipo ? String(tipo).trim() : undefined,
        recaida: recaida !== undefined ? Boolean(recaida) : undefined,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating manual baja médica:', error);
      throw error;
    }
  }

  @Post('empleado')
  async createEmpleadoBaja(@CurrentUser() user: any, @Body() body: any) {
    try {
      // Obține codigoEmpleado din token-ul JWT
      // JwtStrategy.validate() returnează { email, userId, role, grupo }
      // userId este CODIGO-ul angajatului
      const codigoEmpleado =
        user?.userId || user?.CODIGO || user?.codigo || user?.id;
      if (!codigoEmpleado) {
        this.logger.error(
          `❌ [createEmpleadoBaja] No se pudo obtener codigoEmpleado del token. User object: ${JSON.stringify(user)}`,
        );
        throw new BadRequestException(
          'No se pudo obtener el código de empleado del token',
        );
      }

      const { fechaBaja, fechaAlta, tipo, recaida } = body || {};

      if (!fechaBaja || String(fechaBaja).trim() === '') {
        throw new BadRequestException('fechaBaja es obligatoria (YYYY-MM-DD)');
      }

      const result = await this.bajasMedicasService.createEmpleadoBaja({
        codigoEmpleado: String(codigoEmpleado).trim(),
        fechaBaja: String(fechaBaja).trim(),
        fechaAlta: fechaAlta ? String(fechaAlta).trim() : undefined,
        tipo: tipo ? String(tipo).trim() : undefined,
        recaida: recaida !== undefined ? Boolean(recaida) : undefined,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating empleado baja médica:', error);
      throw error;
    }
  }

  @Post('resolve-conflicts')
  async resolveConflicts(@Body() body: any) {
    try {
      const resolutions = Array.isArray(body?.resolutions)
        ? body.resolutions
        : [];

      if (resolutions.length === 0) {
        throw new BadRequestException('resolutions debe ser un array no vacío');
      }

      const result =
        await this.bajasMedicasService.resolveConflicts(resolutions);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error resolving bajas médicas conflicts:', error);
      throw error;
    }
  }

  @Put()
  async updateBajaMedica(@Body() body: any) {
    try {
      const { idCaso, idPosicion, fechaBaja, fechaAlta, situacion } = body;

      if (!idCaso || !idPosicion) {
        throw new BadRequestException(
          'Id.Caso și Id.Posición sunt obligatorii',
        );
      }

      if (
        fechaBaja === undefined &&
        fechaAlta === undefined &&
        situacion === undefined
      ) {
        throw new BadRequestException(
          'Trebuie să specifici cel puțin fechaBaja, fechaAlta sau situacion',
        );
      }

      const updates: {
        fechaBaja?: string;
        fechaAlta?: string;
        situacion?: string;
      } = {};
      if (fechaBaja !== undefined) {
        updates.fechaBaja = fechaBaja;
      }
      if (fechaAlta !== undefined) {
        updates.fechaAlta = fechaAlta;
      }
      if (situacion !== undefined) {
        updates.situacion = situacion;
      }

      const result = await this.bajasMedicasService.updateBajaMedica(
        idCaso,
        idPosicion,
        updates,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating baja médica:', error);
      throw error;
    }
  }

  @Post('fix-situacion')
  async fixSituacionForFechaAlta() {
    try {
      this.logger.log(`🔧 Fix Situación pentru cazuri cu Fecha de alta`);

      const result = await this.bajasMedicasService.fixSituacionForFechaAlta();

      return {
        success: true,
        message: `Actualizat "Situación" = "Alta" pentru ${result.updated} cazuri`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error fixing Situación:', error);
      throw error;
    }
  }
}
