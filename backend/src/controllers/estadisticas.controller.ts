import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { EstadisticasService } from '../services/estadisticas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/estadisticas')
@UseGuards(JwtAuthGuard)
export class EstadisticasController {
  private readonly logger = new Logger(EstadisticasController.name);

  constructor(private readonly estadisticasService: EstadisticasService) {}

  /**
   * POST endpoint pentru statistici
   * Acceptă body cu:
   *   - tipo: 'mensual' | 'anual' | 'rango'
   *   - ano: number (pentru mensual/anual)
   *   - mes: number (pentru mensual)
   *   - desde: string (pentru rango, format YYYY-MM-DD)
   *   - hasta: string (pentru rango, format YYYY-MM-DD)
   *   - centro: string (opțional, 'todos' pentru toate)
   *   - tipoRaport: 'horasTrabajadasMensuales' | 'fichajes'
   */
  @Post()
  async getEstadisticas(@Body() body: any) {
    try {
      const { tipo, ano, mes, desde, hasta, centro, tipoRaport } = body;

      this.logger.log(
        `📝 Get estadisticas request - tipo: ${tipo}, tipoRaport: ${tipoRaport}, centro: ${centro || 'todos'}`,
      );

      if (!tipoRaport) {
        throw new BadRequestException('tipoRaport is required');
      }

      if (tipoRaport === 'horasTrabajadasMensuales') {
        if (!tipo || (tipo !== 'mensual' && tipo !== 'anual')) {
          throw new BadRequestException(
            'tipo must be "mensual" or "anual" for horasTrabajadasMensuales',
          );
        }

        if (tipo === 'mensual' && (!ano || !mes)) {
          throw new BadRequestException(
            'ano and mes are required for tipo mensual',
          );
        }

        if (tipo === 'anual' && !ano) {
          throw new BadRequestException('ano is required for tipo anual');
        }

        const data = await this.estadisticasService.getHorasTrabajadasMensuales(
          tipo,
          ano,
          mes,
          centro,
        );

        return data;
      }

      if (tipoRaport === 'fichajes') {
        if (
          !tipo ||
          (tipo !== 'mensual' && tipo !== 'anual' && tipo !== 'rango')
        ) {
          throw new BadRequestException(
            'tipo must be "mensual", "anual", or "rango" for fichajes',
          );
        }

        const data = await this.estadisticasService.getFichajesAgregados(
          tipo,
          ano,
          mes,
          desde,
          hasta,
          centro,
        );

        // Returnează într-un array pentru compatibilitate cu frontend
        return [data];
      }

      throw new BadRequestException(
        'tipoRaport must be "horasTrabajadasMensuales" or "fichajes"',
      );
    } catch (error: any) {
      this.logger.error('❌ Error getting estadisticas:', error);
      throw error;
    }
  }
}
