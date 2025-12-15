import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { HorasTrabajadasService } from '../services/horas-trabajadas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/horas-trabajadas')
@UseGuards(JwtAuthGuard)
export class HorasTrabajadasController {
  private readonly logger = new Logger(HorasTrabajadasController.name);

  constructor(
    private readonly horasTrabajadasService: HorasTrabajadasService,
  ) {}

  @Get()
  async getResumen(
    @Query('tipo') tipo?: string,
    @Query('lunaselectata') lunaselectata?: string,
    @Query('ano') ano?: string,
    @Query('codigo') codigo?: string,
    @Query('empleadoId') empleadoId?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get horas trabajadas request - tipo: ${tipo}, lunaselectata: ${lunaselectata}, ano: ${ano}, codigo: ${codigo}`,
      );

      // Pentru tipo=anual
      if (tipo === 'anual' && ano) {
        const resumen = await this.horasTrabajadasService.getResumenAnual(
          ano,
          codigo,
        );
        return resumen;
      }

      // Pentru tipo=mensual
      if (tipo === 'mensual' && lunaselectata) {
        const resumen = await this.horasTrabajadasService.getResumenMensual(
          lunaselectata,
          codigo,
        );
        return resumen;
      }

      // Pentru tipo=detalleanual (detalii pentru un angajat)
      if (tipo === 'detalleanual' && ano && (codigo || empleadoId)) {
        const codigoEmpleado = codigo || empleadoId;
        const detalle = await this.horasTrabajadasService.getDetalleAnual(
          ano,
          codigoEmpleado,
        );
        return detalle;
      }

      throw new Error(
        'Invalid parameters: tipo must be "mensual", "anual", or "detalleanual", and appropriate date/codigo must be provided',
      );
    } catch (error: any) {
      this.logger.error('❌ Error getting horas trabajadas:', error);
      throw error;
    }
  }
}
