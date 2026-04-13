import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { HorasTrabajadasService } from '../services/horas-trabajadas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';

@Controller('api/horas-trabajadas')
@UseGuards(JwtAuthGuard)
export class HorasTrabajadasController {
  private readonly logger = new Logger(HorasTrabajadasController.name);

  constructor(
    private readonly horasTrabajadasService: HorasTrabajadasService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
  ) {}

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  @Get()
  async getResumen(
    @CurrentUser() user: any,
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

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );

      // Pentru tipo=anual
      if (tipo === 'anual' && ano) {
        if (codigo?.trim()) {
          this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);
        }
        const resumen = await this.horasTrabajadasService.getResumenAnual(
          ano,
          codigo,
          allowed,
        );
        return resumen;
      }

      // Pentru tipo=mensual
      if (tipo === 'mensual' && lunaselectata) {
        if (codigo?.trim()) {
          this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);
        }
        const resumen = await this.horasTrabajadasService.getResumenMensual(
          lunaselectata,
          codigo,
          allowed,
        );
        return resumen;
      }

      // Pentru tipo=detalleanual (detalii pentru un angajat)
      if (tipo === 'detalleanual' && ano && (codigo || empleadoId)) {
        const codigoEmpleado = codigo || empleadoId;
        if (!codigoEmpleado?.trim()) {
          throw new Error('codigo or empleadoId is required for detalleanual');
        }
        this.empleadoGrupoScopeService.assertCodigoEnAmbito(
          allowed,
          codigoEmpleado,
        );
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
