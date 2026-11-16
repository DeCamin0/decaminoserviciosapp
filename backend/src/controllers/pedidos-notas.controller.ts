import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  Res,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { contentDisposition } from '../services/content-disposition';
import { PedidosNotasService } from '../services/pedidos-notas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadosService } from '../services/empleados.service';
import {
  canReadPedidosNotas,
  canWritePedidosNotas,
  permissionFlag,
  resolvePedidosAccessFromUser,
} from '../services/pedidos-access-policy';

@UseGuards(JwtAuthGuard)
/** Polling periodic din Pedidos; limita globală per IP provoca 429 la birou. */
@SkipThrottle()
@Controller('api/pedidos-notas')
export class PedidosNotasController {
  private readonly logger = new Logger(PedidosNotasController.name);

  constructor(
    private readonly pedidosNotasService: PedidosNotasService,
    private readonly prisma: PrismaService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  private async accessFor(user: any) {
    return resolvePedidosAccessFromUser(
      user,
      async (grupo) => {
        const rows = await this.prisma.permissions.findMany({
          where: {
            grupo_module: {
              in: [
                `${grupo}_pedidos-admin`,
                `${grupo}_pedidos-empleados`,
                `${grupo}_pedidos`,
              ],
            },
          },
          select: { grupo_module: true, permitted: true },
        });
        let pedidosAdmin = false;
        let pedidosEmpleados = false;
        let pedidosLegacy = false;
        for (const row of rows) {
          if (!permissionFlag(row.permitted)) continue;
          if (row.grupo_module.endsWith('_pedidos-admin')) pedidosAdmin = true;
          else if (row.grupo_module.endsWith('_pedidos-empleados')) {
            pedidosEmpleados = true;
          } else if (row.grupo_module.endsWith('_pedidos')) {
            pedidosLegacy = true;
          }
        }
        return { pedidosAdmin, pedidosEmpleados, pedidosLegacy };
      },
      async (codigo) => {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        return String(
          empleado?.['CENTRO TRABAJO'] ||
            empleado?.CENTRO_TRABAJO ||
            empleado?.CENTRO ||
            '',
        );
      },
    );
  }

  private async requireRead(user: any) {
    const access = await this.accessFor(user);
    if (!canReadPedidosNotas(access.scope)) {
      throw new ForbiddenException('No puedes acceder a las notas de pedidos');
    }
    return access;
  }

  private async requireWrite(user: any) {
    const access = await this.accessFor(user);
    if (!canWritePedidosNotas(access.scope)) {
      throw new ForbiddenException('No puedes modificar las notas de pedidos');
    }
    return access;
  }

  /**
   * GET /api/pedidos-notas
   * Obține toate notele active
   */
  @Get()
  async getAllNotas(@CurrentUser() user: any) {
    await this.requireRead(user);
    this.logger.log('Getting all notas');
    return this.pedidosNotasService.getAllNotas();
  }

  /**
   * GET /api/pedidos-notas/imagenes/:imagenId/archivo
   * Stream imagine from R2 (or disk dual-read). Declared before :id.
   */
  @Get('imagenes/:imagenId/archivo')
  async getImagenArchivo(
    @Param('imagenId', ParseIntPipe) imagenId: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    await this.requireRead(user);
    this.logger.log(`Streaming imagen archivo id=${imagenId}`);
    const result = await this.pedidosNotasService.getImagenArchivo(imagenId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      contentDisposition('inline', result.nombre_archivo),
    );
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(result.buffer);
  }

  /**
   * GET /api/pedidos-notas/:id
   * Obține o notă specifică cu poze
   */
  @Get(':id')
  async getNotaById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    await this.requireRead(user);
    this.logger.log(`Getting nota with id=${id}`);
    return this.pedidosNotasService.getNotaById(id);
  }

  /**
   * POST /api/pedidos-notas
   * Creează o notă nouă
   */
  @Post()
  async createNota(
    @Body() body: { titulo?: string; contenido: string },
    @CurrentUser() user: any,
  ) {
    await this.requireWrite(user);
    this.logger.log(`Creating nota: ${body.titulo || 'Sin título'}`);
    const creadoPor =
      user?.CODIGO ||
      user?.codigo ||
      user?.userId ||
      user?.['NOMBRE / APELLIDOS'] ||
      user?.nombre ||
      null;
    return this.pedidosNotasService.createNota({
      ...body,
      creado_por: creadoPor,
    });
  }

  /**
   * PUT /api/pedidos-notas/:id
   * Actualizează o notă existentă
   */
  @Put(':id')
  async updateNota(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { titulo?: string; contenido?: string },
    @CurrentUser() user: any,
  ) {
    await this.requireWrite(user);
    this.logger.log(`Updating nota with id=${id}`);
    return this.pedidosNotasService.updateNota(id, body);
  }

  /**
   * DELETE /api/pedidos-notas/:id
   * Șterge o notă (soft delete)
   */
  @Delete(':id')
  async deleteNota(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    await this.requireWrite(user);
    this.logger.log(`Deleting nota with id=${id}`);
    await this.pedidosNotasService.deleteNota(id);
    return { success: true, message: 'Nota eliminada correctamente' };
  }

  /**
   * POST /api/pedidos-notas/:id/imagenes
   * Adaugă poze la o notă
   */
  @Post(':id/imagenes')
  @UseInterceptors(FilesInterceptor('imagenes', 10)) // Max 10 poze
  async addImagenesToNota(
    @Param('id', ParseIntPipe) notaId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    await this.requireWrite(user);
    this.logger.log(`Adding ${files?.length || 0} imagenes to nota ${notaId}`);
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos');
    }
    return this.pedidosNotasService.addImagenesToNota(notaId, files);
  }

  /**
   * DELETE /api/pedidos-notas/imagenes/:imagenId
   * Șterge o poză
   */
  @Delete('imagenes/:imagenId')
  async deleteImagen(
    @Param('imagenId', ParseIntPipe) imagenId: number,
    @CurrentUser() user: any,
  ) {
    await this.requireWrite(user);
    this.logger.log(`Deleting imagen with id=${imagenId}`);
    await this.pedidosNotasService.deleteImagen(imagenId);
    return { success: true, message: 'Imagen eliminada correctamente' };
  }
}
