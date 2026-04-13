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
import { CurrentUser } from '../auth/current-user.decorator';
import { FichajesService } from '../services/fichajes.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';

@Controller('api/registros')
export class FichajesController {
  private readonly logger = new Logger(FichajesController.name);

  constructor(
    private readonly fichajesService: FichajesService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
  ) {}

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getRegistros(
    @CurrentUser() user: any,
    @Query('CODIGO') codigo: string,
    @Query('MES') mes: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros request - codigo: ${codigo || 'missing'}, mes: ${mes || 'missing'}`,
      );

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );
      this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);

      const registros = await this.fichajesService.getRegistros(codigo, mes);

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros:', error);
      throw error;
    }
  }

  @Get('ultimo')
  @UseGuards(JwtAuthGuard)
  async getUltimoRegistro(
    @CurrentUser() user: any,
    @Query('codigo') codigo: string,
  ) {
    try {
      this.logger.log(
        `📝 Get ultimo registro request - codigo: ${codigo || 'missing'}`,
      );

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );
      this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);

      const ultimoRegistro =
        await this.fichajesService.getUltimoRegistro(codigo);

      // Returnează întotdeauna un obiect JSON valid, chiar dacă nu există registru
      return ultimoRegistro || null;
    } catch (error: any) {
      this.logger.error('❌ Error getting ultimo registro:', error);
      throw error;
    }
  }

  @Get('empleados')
  @UseGuards(JwtAuthGuard)
  async getRegistrosEmpleados(
    @CurrentUser() user: any,
    @Query('mes') mes: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros empleados request - mes: ${mes || 'missing'}`,
      );

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );
      const registros = await this.fichajesService.getRegistrosEmpleados(
        mes,
        allowed,
      );

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros empleados:', error);
      throw error;
    }
  }

  @Get('periodo')
  @UseGuards(JwtAuthGuard)
  async getRegistrosPeriodo(
    @CurrentUser() user: any,
    @Query('fecha_inicio') fechaInicio: string,
    @Query('fecha_fin') fechaFin: string,
    @Query('codigo') codigo?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros periodo request - fecha_inicio: ${fechaInicio || 'missing'}, fecha_fin: ${fechaFin || 'missing'}, codigo: ${codigo || 'all'}`,
      );

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );
      if (codigo?.trim()) {
        this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);
      }

      const registros = await this.fichajesService.getRegistrosPeriodo(
        fechaInicio,
        fechaFin,
        codigo,
        allowed,
      );

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros periodo:', error);
      throw error;
    }
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAllFichajes(@CurrentUser() user: any) {
    try {
      this.logger.log('📝 Get all fichajes request (for statistics)');

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );
      const fichajes = await this.fichajesService.getAllFichajes(allowed);

      return fichajes;
    } catch (error: any) {
      this.logger.error('❌ Error getting all fichajes:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Add fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );

      const result = await this.fichajesService.addFichaje(
        {
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
        },
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error adding fichaje:', error);
      throw error;
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Update fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for update');
      }

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );

      const result = await this.fichajesService.updateFichaje(
        body.id,
        {
          codigo: body.codigo,
          nombre: body.empleado || body.nombre,
          email: body.email,
          tipo: body.tipo,
          hora: body.hora,
          address: body.address,
          modificatDe: body.modificatDe,
          data: body.data,
          duration: body.duration,
        },
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating fichaje:', error);
      throw error;
    }
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Delete fichaje request - ID: ${body.id || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for delete');
      }

      const allowed =
        await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
          this.scopePayload(user),
        );

      const result = await this.fichajesService.deleteFichaje(body.id, allowed);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error deleting fichaje:', error);
      throw error;
    }
  }
}
