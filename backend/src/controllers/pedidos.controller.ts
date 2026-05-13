import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Logger,
  UseGuards,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { PedidosService } from '../services/pedidos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';

@UseGuards(JwtAuthGuard)
/** Fără rate limit global: listări/refetch frecvente pe Pedidos (mai multe GET /api/pedidos per tab) + NAT birou → 429. */
@SkipThrottle()
@Controller('api/pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(
    private readonly pedidosService: PedidosService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  @Post()
  async savePedido(@Body() body: any, @CurrentUser() user: any) {
    this.logger.log(
      `Received request to save pedido for empleado: ${body.empleado?.id || 'N/A'}`,
    );
    return this.pedidosService.savePedido(body, {
      actorGrupo: user?.grupo,
    });
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

  /**
   * DELETE /api/pedidos/:pedidoUid
   * Șterge un pedido complet (toate rândurile asociate)
   * IMPORTANT: Trebuie să fie înainte de @Get(':pedidoUid') pentru a evita conflicte de routing
   */
  @Delete(':pedidoUid')
  async deletePedido(@Param('pedidoUid') pedidoUid: string) {
    this.logger.log(
      `🗑️ [PedidosController] Deleting pedido with UID: ${pedidoUid}`,
    );
    try {
      // Decode UID dacă este URL-encoded
      const decodedUid = decodeURIComponent(pedidoUid);
      return await this.pedidosService.deletePedido(decodedUid);
    } catch (error: any) {
      this.logger.error(`❌ [PedidosController] Error deleting pedido:`, error);
      throw error;
    }
  }

  /**
   * GET /api/pedidos/:pedidoUid/albaranes
   * Lista metadatelor albaranes (fără fișiere).
   */
  @Get(':pedidoUid/albaranes')
  async listAlbaranes(@Param('pedidoUid') pedidoUid: string) {
    const decodedUid = decodeURIComponent(pedidoUid);
    return this.pedidosService.listAlbaranes(decodedUid);
  }

  /**
   * GET /api/pedidos/:pedidoUid/albaran
   * Descarcă sau vizualizează un albarán. ?id= pentru un document anume; fără id = primul (id asc).
   * ?preview=1 pentru inline (ver), altfel attachment.
   */
  @Get(':pedidoUid/albaran')
  async getAlbaran(
    @Param('pedidoUid') pedidoUid: string,
    @Query('preview') preview: string | undefined,
    @Query('id') albaranIdParam: string | undefined,
    @Res() res: Response,
  ) {
    const decodedUid = decodeURIComponent(pedidoUid);
    const parsed = albaranIdParam ? parseInt(albaranIdParam, 10) : NaN;
    const albaranId = !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
    const { archivo, nombre_archivo, tipo_mime } =
      await this.pedidosService.getAlbaran(decodedUid, albaranId);
    const isPreview = preview === '1' || preview === 'true';
    const safeName = nombre_archivo.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader(
      'Content-Disposition',
      isPreview
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`,
    );
    res.send(archivo);
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
      telefono_entrega?: string;
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
      body.telefono_entrega,
    );
  }

  @Put(':pedidoUid/items')
  async updatePedidoItems(
    @Param('pedidoUid') pedidoUid: string,
    @Body()
    body: {
      items: any[];
      subtotal: number;
      iva_total: number;
      total: number;
      notas?: string | null;
    },
    @CurrentUser() user: any,
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
      body.notas,
      user?.grupo,
    );
  }

  @Put(':pedidoUid/notas')
  async updatePedidoNotas(
    @Param('pedidoUid') pedidoUid: string,
    @Body()
    body: { notas?: string | null },
  ) {
    const decodedUid = decodeURIComponent(pedidoUid);
    this.logger.log(
      `📝 [PedidosController] Updating notas for pedido ${decodedUid}`,
    );
    return this.pedidosService.updatePedidoNotas(decodedUid, body.notas);
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

  @Post(':pedidoUid/albaran')
  @UseInterceptors(FileInterceptor('albaran'))
  async uploadAlbaran(
    @Param('pedidoUid') pedidoUid: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const decodedUid = decodeURIComponent(pedidoUid);

    if (!file) {
      throw new BadRequestException('Se requiere un archivo para el albarán');
    }

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
          userInfo = codigo;
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
      `📦 [PedidosController] Uploading albarán for pedido ${decodedUid} by user: ${userInfo}`,
    );

    return this.pedidosService.uploadAlbaran(decodedUid, file, userInfo);
  }
}
