import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { HorasPermitidasService } from '../services/horas-permitidas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/horas-permitidas')
@UseGuards(JwtAuthGuard)
export class HorasPermitidasController {
  private readonly logger = new Logger(HorasPermitidasController.name);

  constructor(
    private readonly horasPermitidasService: HorasPermitidasService,
  ) {}

  @Get()
  async getAll() {
    try {
      this.logger.log('📝 Get all horas permitidas request');

      const result = await this.horasPermitidasService.getAll();

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error getting horas permitidas:', error);
      throw error;
    }
  }

  @Post()
  async create(
    @Body()
    body: {
      grupo: string;
      horasAnuales: number;
      horasMensuales: number;
    },
  ) {
    try {
      this.logger.log(
        `📝 Create horas permitidas request - grupo: ${body.grupo || 'missing'}`,
      );

      const result = await this.horasPermitidasService.create({
        grupo: body.grupo,
        horasAnuales: body.horasAnuales,
        horasMensuales: body.horasMensuales,
      });

      return {
        status: 'success',
        message: 'Nuevo grupo agregado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating horas permitidas:', error);
      throw error;
    }
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { grupo: string; horasAnuales: number; horasMensuales: number },
  ) {
    try {
      this.logger.log(
        `📝 Update horas permitidas request - id: ${id}, grupo: ${body.grupo || 'missing'}`,
      );

      const result = await this.horasPermitidasService.update(id, {
        grupo: body.grupo,
        horasAnuales: body.horasAnuales,
        horasMensuales: body.horasMensuales,
      });

      return {
        status: 'success',
        message: 'Grupo actualizado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating horas permitidas:', error);
      throw error;
    }
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    try {
      this.logger.log(`📝 Delete horas permitidas request - id: ${id}`);

      const result = await this.horasPermitidasService.delete(id);

      return {
        status: 'success',
        message: 'Grupo eliminado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting horas permitidas:', error);
      throw error;
    }
  }
}
