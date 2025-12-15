import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { GruposService } from '../services/grupos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/grupos')
@UseGuards(JwtAuthGuard)
export class GruposController {
  private readonly logger = new Logger(GruposController.name);

  constructor(private readonly gruposService: GruposService) {}

  @Get()
  async getGrupos() {
    try {
      this.logger.log('📝 Get grupos request');

      const grupos = await this.gruposService.getGrupos();

      return grupos;
    } catch (error: any) {
      this.logger.error('❌ Error getting grupos:', error);
      throw error;
    }
  }
}
