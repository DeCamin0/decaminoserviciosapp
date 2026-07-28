import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AusenciasService } from '../services/ausencias.service';
import { AusenciasProximasCronService } from '../services/ausencias-proximas-cron.service';

@Controller('api/ausencias')
export class AusenciasController {
  private readonly logger = new Logger(AusenciasController.name);

  constructor(
    private readonly ausenciasService: AusenciasService,
    private readonly ausenciasProximasCronService: AusenciasProximasCronService,
  ) {}

  /** Fără rate limit: apelat în batch pentru fiecare ausencia (Mis Solicitudes + Todas > Ausencias) */
  @SkipThrottle()
  @Get(':id/justificantes')
  @UseGuards(JwtAuthGuard)
  async getJustificantesByAusenciaId(@Param('id') id: string) {
    try {
      const justificantes =
        await this.ausenciasService.getJustificantesByAusenciaId(Number(id));
      return justificantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting justificantes:', error);
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { ttl: 10000, limit: 50 }, // 50 request-uri / 10 secunde
    medium: { ttl: 60000, limit: 200 }, // 200 request-uri / minut
  })
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteAusencia(@Param('id') id: string) {
    try {
      this.logger.log(`📝 Delete ausencia request - id: ${id}`);

      const result = await this.ausenciasService.deleteAusencia(Number(id));

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error deleting ausencia:', error);
      throw error;
    }
  }

  @Patch(':id/no-necesita-justificante')
  @UseGuards(JwtAuthGuard)
  async updateNoNecesitaJustificante(
    @Param('id') id: string,
    @Body() body: { no_necesita_justificante: boolean },
  ) {
    try {
      this.logger.log(
        `📝 Update no_necesita_justificante request - id: ${id}, value: ${body.no_necesita_justificante}`,
      );

      const result = await this.ausenciasService.updateNoNecesitaJustificante(
        Number(id),
        body.no_necesita_justificante,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating no_necesita_justificante:', error);
      throw error;
    }
  }

  @Post(':id/recordar-justificante')
  @UseGuards(JwtAuthGuard)
  async recordarJustificante(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📋 Recordar justificante request - ausencia ID: ${id}, manager: ${user?.CODIGO || user?.codigo || 'system'}`,
      );

      const managerCodigo =
        user?.CODIGO || user?.codigo || user?.userId || undefined;
      const managerNombre =
        user?.NOMBRE_APELLIDOS || user?.NOMBRE || user?.nombre || undefined;

      const result = await this.ausenciasService.recordarJustificante(
        Number(id),
        managerCodigo,
        managerNombre,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error sending recordatorio:', error);
      throw error;
    }
  }

  @Patch(':id/tipo')
  @UseGuards(JwtAuthGuard)
  async updateTipo(
    @Param('id') id: string,
    @Body()
    body: {
      tipo: string;
      mensaje?: string;
      fecha_inicio?: string;
      fecha_fin?: string;
    },
  ) {
    try {
      this.logger.log(
        `📝 Update tipo request - id: ${id}, nuevo tipo: ${body.tipo}, mensaje: ${body.mensaje ? 'yes' : 'no'}, fecha_inicio: ${body.fecha_inicio || 'no'}, fecha_fin: ${body.fecha_fin || 'no'}`,
      );

      const result = await this.ausenciasService.updateTipo(
        Number(id),
        body.tipo,
        body.mensaje,
        body.fecha_inicio,
        body.fecha_fin,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating tipo:', error);
      throw error;
    }
  }

  @Patch(':id/asociar')
  @UseGuards(JwtAuthGuard)
  async asociarAusencia(
    @Param('id') id: string,
    @Body() body: { ausencia_asociada_id: number | null },
  ) {
    try {
      this.logger.log(
        `🔗 Asociar ausencia request - id: ${id}, ausencia_asociada_id: ${body.ausencia_asociada_id || 'null'}`,
      );

      const result = await this.ausenciasService.asociarAusencia(
        Number(id),
        body.ausencia_asociada_id,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error asociando ausencia:', error);
      throw error;
    }
  }

  @Patch(':id/marcar-sin-ausencia')
  @UseGuards(JwtAuthGuard)
  async marcarSinAusencia(@Param('id') id: string) {
    try {
      this.logger.log(`✅ Marcar sin ausencia request - id: ${id}`);

      const result = await this.ausenciasService.marcarSinAusencia(Number(id));

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error marcando ausencia como sin ausencia:', error);
      throw error;
    }
  }

  @Patch(':id/recalcular-duracion')
  @UseGuards(JwtAuthGuard)
  async recalcularDuracion(@Param('id') id: string) {
    try {
      this.logger.log(`🔄 Recalcular duración request - id: ${id}`);

      const result = await this.ausenciasService.recalcularDuracion(Number(id));

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error recalculando duración:', error);
      throw error;
    }
  }

  @Patch(':id/duracion')
  @UseGuards(JwtAuthGuard)
  async updateDuracion(
    @Param('id') id: string,
    @Body() body: { duracion: number | string; unidad?: 'dias' | 'horas' },
  ) {
    try {
      this.logger.log(
        `✏️ Update duración manual request - id: ${id}, duracion: ${body.duracion}, unidad: ${body.unidad || 'dias'}`,
      );

      const result = await this.ausenciasService.updateDuracion(
        Number(id),
        body.duracion,
        body.unidad || 'dias',
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error actualizando duración manualmente:', error);
      throw error;
    }
  }

  /**
   * Declanșează manual cron-ul „absențe următoarele 10 zile → Telegram”
   * (fără să aștepți 09:15 / 19:30). Doar Developer / Admin.
   */
  @Post('cron-proximas/test-trigger')
  @UseGuards(JwtAuthGuard)
  async testTriggerCronProximas(@CurrentUser() user: any) {
    try {
      const grupo = user?.GRUPO || user?.grupo || '';
      if (!['Developer', 'Admin'].includes(grupo)) {
        throw new BadRequestException(
          'Nu ai permisiunea de a testa cron job-ul',
        );
      }

      this.logger.log('🧪 Manual trigger: cron absente próximas 10 días');
      const result =
        await this.ausenciasProximasCronService.processProximasAusencias({
          throwOnTelegramError: true,
        });

      return {
        success: true,
        message: `Cron OK: ${result.count} aprobadas (${result.chunks} msg) + ${result.pendientesCount} pendientes (${result.pendientesChunks} msg) en Telegram.`,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error triggering cron absente manually:', error);
      throw new BadRequestException(
        `Error al trigger cron absente: ${error.message}`,
      );
    }
  }
}
