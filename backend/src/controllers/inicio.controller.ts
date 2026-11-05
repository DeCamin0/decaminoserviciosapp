import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InicioResumenOperativoService } from '../services/inicio-resumen-operativo.service';

@Controller('api/inicio')
@UseGuards(JwtAuthGuard)
export class InicioController {
  private readonly logger = new Logger(InicioController.name);

  constructor(
    private readonly inicioResumenOperativoService: InicioResumenOperativoService,
  ) {}

  /**
   * Aggregated KPIs for Inicio «Resumen operativo».
   * Phase E: programadosHoy + pendientesFichar (Madrid today).
   * Query:
   * - periodo=hoy|mes (punch KPIs always reflect Madrid «hoy»)
   * - includeCodigos=1|true → optional CODIGO lists (requires empleados|fichar-admin)
   */
  @Get('resumen-operativo')
  async getResumenOperativo(
    @CurrentUser() user: any,
    @Query('periodo') periodo?: string,
    @Query('includeCodigos') includeCodigos?: string,
  ) {
    this.logger.debug(
      `resumen-operativo periodo=${periodo || 'hoy'} includeCodigos=${includeCodigos || '0'} user=${user?.userId || user?.CODIGO || '?'}`,
    );
    return this.inicioResumenOperativoService.getResumen(
      user,
      periodo,
      includeCodigos,
    );
  }
}
