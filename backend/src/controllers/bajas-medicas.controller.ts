import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { BajasMedicasService } from '../services/bajas-medicas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/bajas-medicas')
@UseGuards(JwtAuthGuard)
export class BajasMedicasController {
  private readonly logger = new Logger(BajasMedicasController.name);

  constructor(private readonly bajasMedicasService: BajasMedicasService) {}

  @Get()
  async getBajasMedicas(@Query('codigo') codigo?: string) {
    try {
      this.logger.log(
        `📝 Get bajas médicas request - codigo: ${codigo || 'all'}`,
      );

      const bajasMedicas =
        await this.bajasMedicasService.getBajasMedicas(codigo);

      return bajasMedicas;
    } catch (error: any) {
      this.logger.error('❌ Error getting bajas médicas:', error);
      throw error;
    }
  }
}
