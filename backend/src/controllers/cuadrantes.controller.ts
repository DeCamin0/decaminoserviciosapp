import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
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
   * POST endpoint pentru cuadrantes (pentru compatibilitate cu frontend-ul actual și n8n)
   * Acceptă body cu:
   *   - { email: string } - pentru verificare cuadrantes după email (compatibil cu n8n get-cuadrantes-yyBov0qVQZEhX2TL)
   *   - { codigo: string } sau { centro?, empleado?, nombre? }
   */
  @Post()
  async getCuadrantesPost(@Body() body: any) {
    try {
      // Suport pentru { email: string } - compatibil cu n8n endpoint get-cuadrantes-yyBov0qVQZEhX2TL
      const email = body.email;
      
      // Frontend-ul trimite { codigo: string }
      // Workflow-ul n8n original folosea query params: centro, empleado (CODIGO), nombre
      const empleado = body.codigo || body.empleado;
      const centro = body.centro;
      const nombre = body.nombre;

      this.logger.log(
        `📝 Get cuadrantes POST request - centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}, email: ${email || 'all'}`,
      );

      const cuadrantes = await this.cuadrantesService.getCuadrantes(
        centro,
        empleado,
        nombre,
        email,
      );

      return cuadrantes;
    } catch (error: any) {
      this.logger.error('❌ Error getting cuadrantes:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru salvare cuadrante
   * Acceptă body cu toate câmpurile cuadrante (CODIGO, EMAIL, NOMBRE, LUNA, CENTRO, ZI_1-ZI_31)
   * Compatibil cu n8n endpoint guardar-cuadrante-yyBov0qVQZEhX2TL
   */
  @Post('save')
  async saveCuadrante(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Save cuadrante request - CODIGO: ${body.CODIGO || 'N/A'}, LUNA: ${body.LUNA || 'N/A'}, NOMBRE: ${body.NOMBRE || 'N/A'}`,
      );

      const result = await this.cuadrantesService.saveCuadrante(body);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error saving cuadrante:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru update bulk cuadrantes
   * Acceptă body cu { cuadrantes: [...], centro?, mesAno?, action?, timestamp?, user? }
   * Compatibil cu n8n endpoint update/bce8a5c5-1ca7-4005-9646-22d6016945ab
   */
  @Post('update')
  async updateCuadrantesBulk(@Body() body: any) {
    try {
      const cuadrantes = body.cuadrantes;

      if (!Array.isArray(cuadrantes) || cuadrantes.length === 0) {
        throw new BadRequestException(
          'cuadrantes must be a non-empty array in body',
        );
      }

      this.logger.log(
        `📝 Update cuadrantes bulk request - count: ${cuadrantes.length}, centro: ${body.centro || 'N/A'}, mesAno: ${body.mesAno || 'N/A'}`,
      );

      const result = await this.cuadrantesService.updateCuadrantesBulk(
        cuadrantes,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating cuadrantes bulk:', error);
      throw error;
    }
  }
}
