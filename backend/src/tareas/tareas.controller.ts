import {
  BadRequestException,
  Body,
  Controller,
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
import { TareasService } from './tareas.service';

@Controller('api/tareas')
@UseGuards(JwtAuthGuard)
export class TareasController {
  constructor(private readonly tareasService: TareasService) {}

  @Get()
  async listAll(
    @CurrentUser() user: any,
    @Query('estado') estado?: string,
    @Query('codigo_asignado') codigo_asignado?: string,
    @Query('q') q?: string,
  ) {
    return this.tareasService.listAll(user, { estado, codigo_asignado, q });
  }

  @Get('mias')
  async listMine(@CurrentUser() user: any) {
    return this.tareasService.listMine(user);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    return this.tareasService.create(user, body || {});
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.tareasService.update(user, id, body || {});
  }

  @Post(':id/completar')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024, files: 8 },
    }),
  )
  async completar(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const list = (files || []).filter((f) => f?.buffer?.length);
    const imageFiles = list.filter((f) =>
      String(f.mimetype || '').startsWith('image/'),
    );
    if (list.length && imageFiles.length !== list.length) {
      throw new BadRequestException('Solo se permiten imágenes');
    }
    return this.tareasService.completar(
      user,
      id,
      body?.nota_completado || body?.nota,
      imageFiles,
    );
  }

  @Get(':id/fotos/:fotoId/url')
  async fotoUrl(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.tareasService.getFotoUrl(user, id, fotoId);
  }
}
