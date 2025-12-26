import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { PedidosService } from '../services/pedidos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async savePedido(@Body() body: any) {
    this.logger.log(
      `Received request to save pedido for empleado: ${body.empleado?.id || 'N/A'}`,
    );
    return this.pedidosService.savePedido(body);
  }
}
