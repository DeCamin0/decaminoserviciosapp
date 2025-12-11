import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonthlyAlertsService } from '../services/monthly-alerts.service';

@Controller('api/monthly-alerts')
@UseGuards(JwtAuthGuard)
export class MonthlyAlertsController {
  private readonly logger = new Logger(MonthlyAlertsController.name);

  constructor(private readonly monthlyAlertsService: MonthlyAlertsService) {}

  @Get()
  async getMonthlyAlerts(
    @Query('empleadoId') empleadoId: string,
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('tipo') tipo: string,
    @Request() req: any,
  ) {
    // For monthly alerts, we need empleadoId and mes
    if (tipo === 'detallemensual' || tipo === 'mensual' || mes) {
      if (!empleadoId) {
        // If no empleadoId provided, try to get it from the authenticated user
        empleadoId =
          req.user?.CODIGO || req.user?.codigo || req.user?.empleadoId;
      }

      if (!empleadoId) {
        return { error: 'empleadoId is required' };
      }

      if (!mes) {
        // If no mes provided, use current month
        const now = new Date();
        mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      const records = await this.monthlyAlertsService.getMonthlyRecords(
        empleadoId,
        mes,
      );
      return records;
    }

    // For annual records
    if (tipo === 'anual' || ano) {
      if (!empleadoId) {
        empleadoId =
          req.user?.CODIGO || req.user?.codigo || req.user?.empleadoId;
      }

      if (!empleadoId) {
        return { error: 'empleadoId is required' };
      }

      if (!ano) {
        // If no ano provided, use current year
        ano = String(new Date().getFullYear());
      }

      const records = await this.monthlyAlertsService.getAnnualRecords(
        empleadoId,
        ano,
      );
      return records;
    }

    return { error: 'tipo must be detallemensual, mensual, or anual' };
  }

  @Get('resumen')
  async getResumenMensual(
    @Query('lunaselectata') lunaselectata: string,
    @Query('tipo') tipo: string,
  ) {
    try {
      if (tipo !== 'mensual' && !lunaselectata) {
        return { error: 'lunaselectata is required for tipo=mensual' };
      }

      if (!lunaselectata) {
        // If no lunaselectata provided, use current month
        const now = new Date();
        lunaselectata = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      this.logger.debug(
        `🔍 [MonthlyAlerts Controller] Calling getResumenMensual with lunaselectata: ${lunaselectata}`,
      );
      const result =
        await this.monthlyAlertsService.getResumenMensual(lunaselectata);

      this.logger.debug(
        '🔍 [MonthlyAlerts Controller] Result type:',
        Array.isArray(result) ? 'array' : typeof result,
      );
      this.logger.debug(
        '🔍 [MonthlyAlerts Controller] Result length:',
        Array.isArray(result) ? result.length : 'N/A',
      );
      if (Array.isArray(result) && result.length > 0) {
        this.logger.debug(
          '🔍 [MonthlyAlerts Controller] First empleado keys:',
          Object.keys(result[0]),
        );
        this.logger.debug(
          '🔍 [MonthlyAlerts Controller] First empleado sample:',
          JSON.stringify(result[0]).substring(0, 300),
        );
      } else {
        this.logger.warn(
          '⚠️ [MonthlyAlerts Controller] Empty result from service',
        );
      }

      // Return in the same format as n8n: array of empleados or { empleados: [...] }
      return result;
    } catch (error) {
      this.logger.error(
        '❌ [MonthlyAlerts Controller] Error in getResumenMensual:',
        error.message,
      );
      this.logger.error(
        '❌ [MonthlyAlerts Controller] Error stack:',
        error.stack,
      );
      throw error;
    }
  }
}
