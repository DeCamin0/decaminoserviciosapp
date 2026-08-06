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
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FotosTrabajoService } from './fotos-trabajo.service';

/** Photos + short work videos (memory → R2). */
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const UPLOAD_MAX_FILES = 100;
/** ZIP import preview (whole tree in memory once). Prefer batches under ~1.5GB. */
const ZIP_MAX_BYTES = 1536 * 1024 * 1024;

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
        reuse_if_exists: Boolean(body.reuse_if_exists),
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

  /** Stream file bytes (auth). Used for HEIC preview conversion in the browser. */
  @Get('fotos/:id/file')
  async fotoFile(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.service.assertCanAccess(user);
    const { body, mime_type, nombre_original } =
      await this.service.getFotoFile(id);
    const safeName = String(nombre_original || `foto-${id}`).replace(
      /[^\w.-]/g,
      '_',
    );
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(body);
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

  @Get('import/clientes')
  async importClientes(@CurrentUser() user: any) {
    await this.service.assertCanAccess(user);
    const clientes = await this.service.listClientesLite();
    return { success: true, clientes };
  }

  @Post('import/match')
  async importMatch(@CurrentUser() user: any, @Body() body: any) {
    await this.service.assertCanAccess(user);
    const folders = Array.isArray(body?.folders) ? body.folders : [];
    const data = await this.service.matchImportFolders(folders);
    return { success: true, ...data };
  }

  @Post('import/preview-paths')
  async importPreviewPaths(@CurrentUser() user: any, @Body() body: any) {
    await this.service.assertCanAccess(user);
    const paths = Array.isArray(body?.paths) ? body.paths : [];
    const data = await this.service.previewImportFromPaths(paths);
    return { success: true, ...data };
  }

  @Post('import/zip')
  @UseInterceptors(
    FileInterceptor('zip', {
      storage: memoryStorage(),
      limits: { fileSize: ZIP_MAX_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const mime = (file.mimetype || '').toLowerCase();
        if (
          name.endsWith('.zip') ||
          mime === 'application/zip' ||
          mime === 'application/x-zip-compressed' ||
          mime === 'application/octet-stream'
        ) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Solo se aceptan archivos ZIP'), false);
      },
    }),
  )
  async importZipPreview(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.service.assertCanAccess(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('ZIP requerido (campo "zip")');
    }
    const data = await this.service.previewImportZip(file.buffer);
    return { success: true, ...data };
  }

  @Post('import/commit')
  async importCommit(@CurrentUser() user: any, @Body() body: any) {
    await this.service.assertCanAccess(user);
    const jobId = String(body?.job_id || '').trim();
    if (!jobId) throw new BadRequestException('job_id requerido');
    const mapping =
      body?.mapping && typeof body.mapping === 'object' ? body.mapping : {};
    const folder =
      body?.folder != null && String(body.folder).trim()
        ? String(body.folder).trim()
        : undefined;
    const finalize =
      body?.finalize === undefined ? undefined : Boolean(body.finalize);
    const data = await this.service.commitImportJob(
      jobId,
      mapping,
      this.codigo(user),
      { folder, finalize },
    );
    return { success: true, ...data };
  }

  @Post('import/cleanup')
  async importCleanup(@CurrentUser() user: any, @Body() body: any) {
    await this.service.assertCanAccess(user);
    const jobId = String(body?.job_id || '').trim();
    if (!jobId) throw new BadRequestException('job_id requerido');
    const data = await this.service.cleanupImportJob(jobId);
    return { success: true, ...data };
  }
}
