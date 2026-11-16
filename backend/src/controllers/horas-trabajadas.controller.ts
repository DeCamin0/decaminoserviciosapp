import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { HorasTrabajadasService } from '../services/horas-trabajadas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  loadEmpleadoModuleFlags,
  resolvePunchReadCodigos,
  toEmpleadoActor,
} from '../services/empleados-operation-access';

@Controller('api/horas-trabajadas')
@UseGuards(JwtAuthGuard)
export class HorasTrabajadasController {
  private readonly logger = new Logger(HorasTrabajadasController.name);

  constructor(
    private readonly horasTrabajadasService: HorasTrabajadasService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly prisma: PrismaService,
  ) {}

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  private async readCodigos(user: any) {
    const actor = toEmpleadoActor(user);
    const flags = await loadEmpleadoModuleFlags(user?.grupo, (keys) =>
      this.prisma.permissions.findMany({
        where: { grupo_module: { in: keys } },
        select: { grupo_module: true, permitted: true },
      }),
    );
    const payload = this.scopePayload(user);
    return resolvePunchReadCodigos({
      actor,
      flags,
      bypass: this.empleadoGrupoScopeService.bypassesScope(payload),
      scope: await this.empleadoGrupoScopeService.resolveScopeFilter(payload),
      listScopeCodigos: () =>
        this.empleadoGrupoScopeService.listAllowedCodigosForPayload(payload),
    });
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

      const allowed = await this.readCodigos(user);
      const selfOnly =
        Array.isArray(allowed) &&
        allowed.length === 1 &&
        allowed[0] === String(user?.userId || '').trim();
      if (selfOnly && !String(codigo || empleadoId || '').trim()) {
        codigo = String(user?.userId || '').trim();
      }

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
