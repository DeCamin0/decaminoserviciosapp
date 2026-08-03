import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ServiciosPeriodicosService } from '../services/servicios-periodicos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/servicios-periodicos')
export class ServiciosPeriodicosController {
  private readonly logger = new Logger(ServiciosPeriodicosController.name);

  constructor(private readonly service: ServiciosPeriodicosService) {}

  @Get('tipos')
  async listTipos(@Query('all') all?: string) {
    return this.service.listTipos(all === '1' || all === 'true');
  }

  @Post('tipos')
  async createTipo(
    @Body() body: { nombre: string; orden?: number; color?: string },
  ) {
    this.logger.log(`Creating tipo: ${body?.nombre}`);
    return this.service.createTipo(body);
  }

  @Put('tipos/:id')
  async updateTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { nombre?: string; activo?: boolean; orden?: number; color?: string },
  ) {
    this.logger.log(`Updating tipo ${id}`);
    return this.service.updateTipo(id, body);
  }

  @Delete('tipos/:id')
  async deleteTipo(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deactivating tipo ${id}`);
    const tipo = await this.service.deleteTipo(id);
    return { success: true, tipo };
  }

  @Get('matrix')
  async getMatrix(@Query('an') anRaw?: string) {
    const an = parseInt(anRaw || String(new Date().getFullYear()), 10);
    this.logger.log(`Getting matrix for year ${an}`);
    return this.service.getMatrix(an);
  }

  @Get('cliente-config/:clienteId')
  async getClienteConfig(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.service.getClienteConfig(clienteId);
  }

  @Put('cliente-config/:clienteId')
  async setClienteConfig(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body()
    body: {
      servicios_periodicos?: boolean;
      activo?: boolean;
      tipo_ids?: number[];
    },
  ) {
    this.logger.log(`Updating SP config for cliente ${clienteId}`);
    return this.service.setClienteConfig({
      cliente_id: clienteId,
      ...body,
    });
  }

  @Put('checks')
  async upsertCheck(
    @Body()
    body: {
      cliente_id: number;
      tipo_id: number;
      an: number;
      mes: number;
      hecho: boolean;
      nota?: string | null;
    },
    @CurrentUser() user: any,
  ) {
    const hechoPor =
      user?.['NOMBRE / APELLIDOS'] ||
      user?.nombre ||
      user?.name ||
      user?.CODIGO ||
      user?.codigo ||
      user?.userId ||
      null;
    this.logger.log(
      `Upsert check cliente=${body?.cliente_id} tipo=${body?.tipo_id} ${body?.an}-${body?.mes} hecho=${body?.hecho}`,
    );
    return this.service.upsertCheck({ ...body, hecho_por: hechoPor });
  }
}
