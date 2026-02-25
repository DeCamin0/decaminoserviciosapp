import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import {
  GruposService,
  CreateGrupoDto,
  UpdateGrupoDto,
} from '../services/grupos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/grupos')
@UseGuards(JwtAuthGuard)
export class GruposController {
  private readonly logger = new Logger(GruposController.name);

  constructor(private readonly gruposService: GruposService) {}

  @Get()
  async getGrupos() {
    try {
      this.logger.log('📝 Get grupos request (nombres only)');

      const grupos = await this.gruposService.getGrupos();

      return grupos;
    } catch (error: any) {
      this.logger.error('❌ Error getting grupos:', error);
      throw error;
    }
  }

  @Get('completos')
  async getGruposCompletos(
    @Query('tipo') tipo?: 'grupo_empleado' | 'servicio_presupuesto',
  ) {
    try {
      this.logger.log(
        `📝 Get grupos completos request${tipo ? ` (tipo: ${tipo})` : ''}`,
      );

      const grupos = await this.gruposService.getGruposCompletos(tipo);

      return { success: true, grupos };
    } catch (error: any) {
      this.logger.error('❌ Error getting grupos completos:', error);
      throw error;
    }
  }

  @Get(':id')
  async getGrupoById(@Param('id', ParseIntPipe) id: number) {
    try {
      this.logger.log(`📝 Get grupo by id request: ${id}`);

      const grupo = await this.gruposService.getGrupoById(id);

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error(`❌ Error getting grupo ${id}:`, error);
      throw error;
    }
  }

  @Post()
  async createGrupo(@Body() body: CreateGrupoDto | { nombre: string }) {
    try {
      // Backward compatibility: dacă primește doar { nombre }, convertește la CreateGrupoDto
      const dto: CreateGrupoDto =
        'nombre' in body && Object.keys(body).length === 1
          ? { nombre: body.nombre }
          : (body as CreateGrupoDto);

      this.logger.log(`📝 Create grupo request: ${dto.nombre}`);

      const grupo = await this.gruposService.createGrupo(dto);

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error('❌ Error creating grupo:', error);
      throw error;
    }
  }

  @Put(':id')
  async updateGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateGrupoDto,
  ) {
    try {
      this.logger.log(`📝 Update grupo request: ${id}`);

      const grupo = await this.gruposService.updateGrupo(id, body);

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error(`❌ Error updating grupo ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  async deleteGrupo(@Param('id', ParseIntPipe) id: number) {
    try {
      this.logger.log(`📝 Delete grupo request: ${id}`);

      await this.gruposService.deleteGrupo(id);

      return { success: true, message: 'Grupo eliminado correctamente' };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting grupo ${id}:`, error);
      throw error;
    }
  }
}
