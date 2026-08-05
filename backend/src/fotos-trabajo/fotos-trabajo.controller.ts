import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FotosTrabajoService } from './fotos-trabajo.service';

/** Photos + short work videos (memory → R2). */
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const UPLOAD_MAX_FILES = 100;

@Controller('api/fotos-trabajo')
@UseGuards(JwtAuthGuard)
export class FotosTrabajoController {
  constructor(private readonly service: FotosTrabajoService) {}

  private codigo(user: any): string {
    return String(user?.userId || user?.codigo || user?.CODIGO || '').trim();
  }

  @Get('comunidades')
  async comunidades(
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('conFotos') conFotos?: string,
  ) {
    await this.service.assertCanAccess(user);
    const onlyWithPhotos =
      conFotos === '1' || conFotos === 'true' || conFotos === 'yes';
    const comunidades = await this.service.listComunidades(q, onlyWithPhotos);
    return { success: true, comunidades, conFotos: onlyWithPhotos };
  }

  @Get('albumes')
  async albumes(
    @CurrentUser() user: any,
    @Query('clienteId', ParseIntPipe) clienteId: number,
  ) {
    await this.service.assertCanAccess(user);
    const albumes = await this.service.listAlbumes(clienteId);
    return { success: true, albumes };
  }

  @Post('albumes')
  async createAlbum(@CurrentUser() user: any, @Body() body: any) {
    await this.service.assertCanAccess(user);
    const album = await this.service.createAlbum(
      {
        cliente_id: Number(body.cliente_id),
        titulo: body.titulo,
        fecha_servicio: body.fecha_servicio,
        notas: body.notas,
      },
      this.codigo(user),
    );
    return { success: true, album };
  }

  @Patch('albumes/:id')
  async updateAlbum(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanAccess(user);
    const album = await this.service.updateAlbum(id, body);
    return { success: true, album };
  }

  @Delete('albumes/:id')
  async deleteAlbum(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(user);
    const result = await this.service.deleteAlbum(id);
    return { success: true, ...result };
  }

  @Get('albumes/:id/fotos')
  async listFotos(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(user);
    const data = await this.service.listFotos(id);
    return { success: true, ...data };
  }

  @Post('albumes/:id/fotos')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: UPLOAD_MAX_BYTES,
        files: UPLOAD_MAX_FILES,
        parts: UPLOAD_MAX_FILES + 20,
        fields: 20,
      },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (mime.startsWith('image/') || mime.startsWith('video/')) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            `Tipo no permitido: ${file.mimetype || 'unknown'}. Solo imagen o vídeo.`,
          ),
          false,
        );
      },
    }),
  )
  async uploadFotos(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await this.service.assertCanAccess(user);
    if ((files || []).length > UPLOAD_MAX_FILES) {
      throw new BadRequestException(
        `Demasiados archivos (máx. ${UPLOAD_MAX_FILES} por subida)`,
      );
    }
    const result = await this.service.uploadFotos(
      id,
      files || [],
      this.codigo(user),
    );
    return { success: true, ...result };
  }

  @Get('fotos/:id/url')
  async fotoUrl(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(user);
    const data = await this.service.getPresignedUrl(id, 300);
    return { success: true, ...data };
  }

  @Delete('fotos/:id')
  async deleteFoto(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(user);
    const result = await this.service.deleteFoto(id);
    return { success: true, ...result };
  }
}
