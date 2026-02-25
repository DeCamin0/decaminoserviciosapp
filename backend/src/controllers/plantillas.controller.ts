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
import {
  PlantillasService,
  CreatePlantillaDto,
  UpdatePlantillaDto,
} from '../services/plantillas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/plantillas')
@UseGuards(JwtAuthGuard)
export class PlantillasController {
  private readonly logger = new Logger(PlantillasController.name);

  constructor(private readonly plantillasService: PlantillasService) {}

  @Get()
  async getPlantillas() {
    try {
      const plantillas = await this.plantillasService.getPlantillas();
      return {
        success: true,
        data: plantillas,
      };
    } catch (error) {
      this.logger.error('❌ Error in getPlantillas:', error);
      throw error;
    }
  }

  @Get(':id')
  async getPlantillaById(@Param('id', ParseIntPipe) id: number) {
    try {
      const plantilla = await this.plantillasService.getPlantillaById(id);
      return {
        success: true,
        data: plantilla,
      };
    } catch (error) {
      this.logger.error(`❌ Error in getPlantillaById ${id}:`, error);
      throw error;
    }
  }

  @Post()
  async createPlantilla(@Body() dto: CreatePlantillaDto) {
    try {
      const plantilla = await this.plantillasService.createPlantilla(dto);
      return {
        success: true,
        data: plantilla,
      };
    } catch (error) {
      this.logger.error('❌ Error in createPlantilla:', error);
      throw error;
    }
  }

  @Put(':id')
  async updatePlantilla(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlantillaDto,
  ) {
    try {
      const plantilla = await this.plantillasService.updatePlantilla(id, dto);
      return {
        success: true,
        data: plantilla,
      };
    } catch (error) {
      this.logger.error(`❌ Error in updatePlantilla ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  async deletePlantilla(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.plantillasService.deletePlantilla(id);
      return {
        success: true,
        message: 'Plantilla eliminada correctamente',
      };
    } catch (error) {
      this.logger.error(`❌ Error in deletePlantilla ${id}:`, error);
      throw error;
    }
  }
}
