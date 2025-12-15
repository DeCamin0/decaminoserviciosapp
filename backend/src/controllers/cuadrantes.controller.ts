import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CuadrantesService } from '../services/cuadrantes.service';

@Controller('api/cuadrantes')
@UseGuards(JwtAuthGuard) // Apply JwtAuthGuard to all routes in this controller
export class CuadrantesController {
  private readonly logger = new Logger(CuadrantesController.name);

  constructor(private readonly cuadrantesService: CuadrantesService) {}

  /**
   * GET endpoint pentru cuadrantes cu query params (pentru compatibilitate cu workflow-ul n8n original)
   */
  @Get()
  async getCuadrantes(
    @Query('centro') centro?: string,
    @Query('empleado') empleado?: string,
    @Query('nombre') nombre?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get cuadrantes request - centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}`,
      );

      const cuadrantes = await this.cuadrantesService.getCuadrantes(
        centro,
        empleado,
        nombre,
      );

      return cuadrantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting cuadrantes:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru cuadrantes (pentru compatibilitate cu frontend-ul actual)
   * Acceptă body cu { codigo: string } sau { centro?, empleado?, nombre? }
   */
  @Post()
  async getCuadrantesPost(@Body() body: any) {
    try {
      // Frontend-ul trimite { codigo: string }
      // Workflow-ul n8n original folosea query params: centro, empleado (CODIGO), nombre
      const empleado = body.codigo || body.empleado;
      const centro = body.centro;
      const nombre = body.nombre;

      this.logger.log(
        `📝 Get cuadrantes POST request - centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}`,
      );

      const cuadrantes = await this.cuadrantesService.getCuadrantes(
        centro,
        empleado,
        nombre,
      );

      return cuadrantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting cuadrantes:', error);
      throw error;
    }
  }
}
