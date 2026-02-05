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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PedidosNotasService } from '../services/pedidos-notas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/pedidos-notas')
export class PedidosNotasController {
  private readonly logger = new Logger(PedidosNotasController.name);

  constructor(private readonly pedidosNotasService: PedidosNotasService) {}

  /**
   * GET /api/pedidos-notas
   * Obține toate notele active
   */
  @Get()
  async getAllNotas() {
    this.logger.log('📝 Getting all notas');
    return this.pedidosNotasService.getAllNotas();
  }

  /**
   * GET /api/pedidos-notas/:id
   * Obține o notă specifică cu poze
   */
  @Get(':id')
  async getNotaById(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`📝 Getting nota with id=${id}`);
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
    this.logger.log(`📝 Creating nota: ${body.titulo || 'Sin título'}`);
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
  ) {
    this.logger.log(`📝 Updating nota with id=${id}`);
    return this.pedidosNotasService.updateNota(id, body);
  }

  /**
   * DELETE /api/pedidos-notas/:id
   * Șterge o notă (soft delete)
   */
  @Delete(':id')
  async deleteNota(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`📝 Deleting nota with id=${id}`);
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
  ) {
    this.logger.log(
      `📝 Adding ${files?.length || 0} imagenes to nota ${notaId}`,
    );
    if (!files || files.length === 0) {
      throw new Error('No se proporcionaron archivos');
    }
    return this.pedidosNotasService.addImagenesToNota(notaId, files);
  }

  /**
   * DELETE /api/pedidos-notas/imagenes/:imagenId
   * Șterge o poză
   */
  @Delete('imagenes/:imagenId')
  async deleteImagen(@Param('imagenId', ParseIntPipe) imagenId: number) {
    this.logger.log(`📝 Deleting imagen with id=${imagenId}`);
    await this.pedidosNotasService.deleteImagen(imagenId);
    return { success: true, message: 'Imagen eliminada correctamente' };
  }
}
