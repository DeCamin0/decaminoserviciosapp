import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Logger,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { PedidosService } from '../services/pedidos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';

@UseGuards(JwtAuthGuard)
@Controller('api/pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(
    private readonly pedidosService: PedidosService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  @Post()
  async savePedido(@Body() body: any) {
    this.logger.log(
      `Received request to save pedido for empleado: ${body.empleado?.id || 'N/A'}`,
    );
    return this.pedidosService.savePedido(body);
  }

  @Get()
  async getAllPedidos(@Query('estado') estado?: string) {
    this.logger.log(
      `📦 [PedidosController] Getting all pedidos${estado ? ` with estado: ${estado}` : ''}`,
    );
    try {
      const result = await this.pedidosService.getAllPedidos(estado);
      this.logger.log(
        `📦 [PedidosController] Returning ${result.length} pedidos`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`❌ [PedidosController] Error getting pedidos:`, error);
      throw error;
    }
  }

  @Get(':pedidoUid')
  async getPedidoByUid(@Param('pedidoUid') pedidoUid: string) {
    const decodedUid = decodeURIComponent(pedidoUid);
    this.logger.log(
      `📦 [PedidosController] Getting pedido with UID: ${decodedUid}`,
    );
    return this.pedidosService.getPedidoByUid(decodedUid);
  }

  @Put(':pedidoUid/estado')
  async updatePedidoEstado(
    @Param('pedidoUid') pedidoUid: string,
    @Body() body: { estado: string; fecha_envio?: string },
    @CurrentUser() user: any,
  ) {
    const decodedUid = decodeURIComponent(pedidoUid);

    // Obține numele și codigo-ul utilizatorului
    let userInfo = 'unknown';
    try {
      const codigo = user?.userId || user?.codigo;
      if (codigo) {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        if (empleado) {
          const nombre = this.empleadosService.getFormattedNombre(empleado);
          userInfo = `${nombre} (${codigo})`;
        } else {
          userInfo = codigo; // Fallback la codigo dacă nu găsește empleado
        }
      } else {
        userInfo = user?.email || 'unknown';
      }
    } catch {
      this.logger.warn(
        `⚠️ Could not fetch empleado info for user: ${user?.userId || user?.codigo || 'unknown'}, using fallback`,
      );
      userInfo = user?.userId || user?.codigo || user?.email || 'unknown';
    }

    this.logger.log(
      `📦 [PedidosController] Updating pedido ${decodedUid} estado to: ${body.estado}${body.fecha_envio ? ` with fecha_envio: ${body.fecha_envio}` : ''} by user: ${userInfo}`,
    );
    return this.pedidosService.updatePedidoEstado(
      decodedUid,
      body.estado,
      body.fecha_envio,
      userInfo,
    );
  }

  @Put(':pedidoUid/direccion-envio')
  async updatePedidoDireccionEnvio(
    @Param('pedidoUid') pedidoUid: string,
    @Body()
    body: {
      direccion_envio?: string;
      codigo_postal_envio?: string;
      localidad_envio?: string;
      provincia_envio?: string;
    },
  ) {
    const decodedUid = decodeURIComponent(pedidoUid);
    this.logger.log(
      `📦 [PedidosController] Updating pedido ${decodedUid} dirección de envío`,
    );
    return this.pedidosService.updatePedidoDireccionEnvio(
      decodedUid,
      body.direccion_envio,
      body.codigo_postal_envio,
      body.localidad_envio,
      body.provincia_envio,
    );
  }

  @Put(':pedidoUid/items')
  async updatePedidoItems(
    @Param('pedidoUid') pedidoUid: string,
    @Body()
    body: { items: any[]; subtotal: number; iva_total: number; total: number },
  ) {
    // Decodează UID-ul dacă este encodat
    const decodedUid = decodeURIComponent(pedidoUid);
    this.logger.log(
      `📦 [PedidosController] Updating pedido ${decodedUid} items (${body.items?.length || 0} items)`,
    );
    this.logger.log(
      `📦 [PedidosController] Original UID: ${pedidoUid}, Decoded UID: ${decodedUid}`,
    );
    return this.pedidosService.updatePedidoItems(
      decodedUid,
      body.items,
      body.subtotal,
      body.iva_total,
      body.total,
    );
  }

  @Post('generar-excel')
  async generarExcelPedidos(
    @Body() body: { pedidos: string[] },
    @Res() res: any,
  ) {
    this.logger.log(
      `📊 [PedidosController] Generando Excel para ${body.pedidos?.length || 0} pedidos`,
    );

    // Generează Excel-ul fără să marcheze ca enviado
    const buffer = await this.pedidosService.generarExcelPedidos(body.pedidos);

    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=PEDIDOS ${fecha}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('enviar-aprobados')
  async enviarPedidosAprobados(
    @Body()
    body: {
      pedidos: string[];
      mensaje?: string;
      enviarProveedor?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `📤 [PedidosController] Enviando ${body.pedidos?.length || 0} pedidos aprobados${body.enviarProveedor ? ' a proveedor' : ''}${body.mensaje ? ' con mensaje' : ''}`,
    );

    // Extrage senderId din user
    const senderId = String(
      user?.CODIGO || user?.codigo || user?.userId || 'system',
    );

    // Trimite mesajul la provider (dacă este specificat) și marchează ca enviado
    return this.pedidosService.enviarPedidosAprobados(
      body.pedidos,
      body.mensaje,
      body.enviarProveedor,
      senderId,
    );
  }
}
