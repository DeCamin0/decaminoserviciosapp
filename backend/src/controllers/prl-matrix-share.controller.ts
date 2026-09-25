import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import { PrlMatrixShareGuard } from '../auth/prl-matrix-share.guard';
import { PrlMatrixShareService } from '../services/prl-matrix-share.service';

@Controller('api/prl/matrix-share')
export class PrlMatrixShareController {
  private readonly logger = new Logger(PrlMatrixShareController.name);

  constructor(private readonly shareService: PrlMatrixShareService) {}

  /** POST /api/prl/matrix-share/login */
  @Public()
  @Post('login')
  async login(@Body() body: { password?: string }) {
    try {
      return await this.shareService.login(body?.password || '');
    } catch (error: any) {
      this.logger.warn(`Matrix share login failed: ${error?.message || error}`);
      throw error;
    }
  }

  @Public()
  @Get('me')
  @UseGuards(PrlMatrixShareGuard)
  me() {
    return {
      success: true,
      displayName: this.shareService.getDisplayName(),
      allowed_actions: ['procesado', 'subir_diploma', 'asignar_cita'],
      enabled: this.shareService.isEnabled(),
    };
  }

  @Public()
  @Get('matrix')
  @UseGuards(PrlMatrixShareGuard)
  async matrix() {
    try {
      return await this.shareService.getMatrix();
    } catch (error: any) {
      this.logger.error(`Matrix share fetch error: ${error?.message || error}`);
      throw new BadRequestException(
        error?.message || 'Error al cargar la matrix',
      );
    }
  }

  /** Solo acción permitida: checkbox procesado */
  @Public()
  @Patch('empleados/:empleadoId/procesado')
  @UseGuards(PrlMatrixShareGuard)
  async setProcesado(
    @Param('empleadoId') empleadoId: string,
    @Body() body: { procesado?: boolean | string | number },
  ) {
    const procesado =
      body?.procesado === true ||
      String(body?.procesado).toLowerCase() === 'true' ||
      body?.procesado === 1;
    const result = await this.shareService.setProcesado(empleadoId, procesado);
    return { success: true, empleado_id: empleadoId, ...result };
  }

  /** Asignar / actualizar cita RM (Noemi / Ancara) */
  @Public()
  @Post('documentos/:documentoId/asignar-cita')
  @UseGuards(PrlMatrixShareGuard)
  async asignarRmCita(
    @Param('documentoId') documentoId: string,
    @Body() body: { fecha?: string; hora?: string },
  ) {
    const documentoIdNum = parseInt(documentoId, 10);
    if (isNaN(documentoIdNum)) {
      throw new BadRequestException('documentoId debe ser un número');
    }
    const fecha = String(body?.fecha || '').trim();
    const hora = String(body?.hora || '').trim();
    if (!fecha || !hora) {
      throw new BadRequestException('fecha y hora son requeridos');
    }
    const result = await this.shareService.asignarRmCita(
      documentoIdNum,
      fecha,
      hora,
    );
    return { success: true, message: 'Cita RM asignada', ...result };
  }

  /** Solo acción permitida: subir diploma PDF */
  @Public()
  @Post('empleados/:empleadoId/diploma')
  @UseGuards(PrlMatrixShareGuard)
  @UseInterceptors(FileInterceptor('archivo'))
  async uploadDiploma(
    @Param('empleadoId') empleadoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Se requiere un archivo PDF');
    }
    const result = await this.shareService.uploadDiploma(empleadoId, file);
    return {
      success: true,
      message: 'Diploma subida correctamente',
      ...result,
    };
  }
}
