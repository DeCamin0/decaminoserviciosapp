import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { HorasAsignadasService } from '../services/horas-asignadas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/horas-asignadas')
@UseGuards(JwtAuthGuard)
export class HorasAsignadasController {
  private readonly logger = new Logger(HorasAsignadasController.name);

  constructor(private readonly horasAsignadasService: HorasAsignadasService) {}

  @Get()
  async getHorasAsignadas(@Query('grupo') grupo: string) {
    try {
      this.logger.log(
        `📝 Get horas asignadas request - grupo: ${grupo || 'missing'}`,
      );

      const result = await this.horasAsignadasService.getHorasAsignadas(grupo);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error getting horas asignadas:', error);
      throw error;
    }
  }
}
