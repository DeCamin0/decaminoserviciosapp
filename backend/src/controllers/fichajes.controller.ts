import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FichajesService } from '../services/fichajes.service';

@Controller('api/registros')
export class FichajesController {
  private readonly logger = new Logger(FichajesController.name);

  constructor(private readonly fichajesService: FichajesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getRegistros(
    @Query('CODIGO') codigo: string,
    @Query('MES') mes: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros request - codigo: ${codigo || 'missing'}, mes: ${mes || 'missing'}`,
      );

      const registros = await this.fichajesService.getRegistros(codigo, mes);

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros:', error);
      throw error;
    }
  }

  @Get('empleados')
  @UseGuards(JwtAuthGuard)
  async getRegistrosEmpleados(@Query('mes') mes: string) {
    try {
      this.logger.log(
        `📝 Get registros empleados request - mes: ${mes || 'missing'}`,
      );

      const registros = await this.fichajesService.getRegistrosEmpleados(mes);

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros empleados:', error);
      throw error;
    }
  }

  @Get('periodo')
  @UseGuards(JwtAuthGuard)
  async getRegistrosPeriodo(
    @Query('fecha_inicio') fechaInicio: string,
    @Query('fecha_fin') fechaFin: string,
    @Query('codigo') codigo?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros periodo request - fecha_inicio: ${fechaInicio || 'missing'}, fecha_fin: ${fechaFin || 'missing'}, codigo: ${codigo || 'all'}`,
      );

      const registros = await this.fichajesService.getRegistrosPeriodo(
        fechaInicio,
        fechaFin,
        codigo,
      );

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros periodo:', error);
      throw error;
    }
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAllFichajes() {
    try {
      this.logger.log('📝 Get all fichajes request (for statistics)');

      const fichajes = await this.fichajesService.getAllFichajes();

      return fichajes;
    } catch (error: any) {
      this.logger.error('❌ Error getting all fichajes:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addFichaje(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Add fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      const result = await this.fichajesService.addFichaje({
        id: body.id,
        codigo: body.codigo,
        nombre: body.nombre || body.empleado, // Acceptă ambele: nombre sau empleado
        email: body.email,
        tipo: body.tipo,
        hora: body.hora,
        address: body.address,
        modificatDe: body.modificatDe,
        data: body.data,
        motivo: body.motivo || '',
      });

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error adding fichaje:', error);
      throw error;
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateFichaje(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Update fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for update');
      }

      const result = await this.fichajesService.updateFichaje(body.id, {
        codigo: body.codigo,
        nombre: body.empleado || body.nombre,
        email: body.email,
        tipo: body.tipo,
        hora: body.hora,
        address: body.address,
        modificatDe: body.modificatDe,
        data: body.data,
        duration: body.duration,
      });

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating fichaje:', error);
      throw error;
    }
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteFichaje(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Delete fichaje request - ID: ${body.id || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for delete');
      }

      const result = await this.fichajesService.deleteFichaje(body.id);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error deleting fichaje:', error);
      throw error;
    }
  }
}
