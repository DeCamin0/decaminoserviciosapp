import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AusenciasService } from '../services/ausencias.service';

@Controller('api/ausencias')
export class AusenciasController {
  private readonly logger = new Logger(AusenciasController.name);

  constructor(private readonly ausenciasService: AusenciasService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAusencias(
    @Query('codigo') codigo?: string,
    @Query('MES') mes?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get ausencias request - codigo: ${codigo || 'all'}, mes: ${mes || 'all'}`,
      );

      const ausencias = await this.ausenciasService.getAusencias(codigo, mes);

      return ausencias;
    } catch (error: any) {
      this.logger.error('❌ Error getting ausencias:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addAusencia(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Add ausencia request - CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}, solicitud_id: ${body.solicitud_id || 'missing'}`,
      );

      const result = await this.ausenciasService.addAusencia({
        solicitud_id: body.solicitud_id,
        codigo: body.codigo,
        nombre: body.nombre,
        tipo: body.tipo,
        data: body.data,
        permiso_fecha_inicio: body.permiso_fecha_inicio,
        permiso_fecha_fin: body.permiso_fecha_fin,
        hora: body.hora,
        locatia: body.locatia,
        motivo: body.motivo,
        cuadrante_asignado: body.cuadrante_asignado,
        horario_asignado: body.horario_asignado,
        sin_horario_asignado: body.sin_horario_asignado,
      });

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error adding ausencia:', error);
      throw error;
    }
  }
}
