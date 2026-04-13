import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PortalDocumentsService } from './portal-documents.service';

function assertCanManagePortalDocs(user: any) {
  const g = String(user?.grupo || user?.GRUPO || '').trim();
  const ok = ['Developer', 'Admin', 'Manager', 'Supervisor'].includes(g);
  if (!ok) {
    throw new ForbiddenException(
      'Solo personal autorizado puede gestionar documentación general del portal.',
    );
  }
}

@Controller('api/admin/portal-documentos-generales')
@UseGuards(JwtAuthGuard)
export class PortalDocumentosAdminController {
  constructor(private readonly portalDocuments: PortalDocumentsService) {}

  @Get()
  async list(@CurrentUser() user: any, @Query('estado') estado?: string) {
    assertCanManagePortalDocs(user);
    const data =
      await this.portalDocuments.adminListDocumentosGenerales(estado);
    return { success: true, data };
  }

  @Get(':id/archivo')
  async archivo(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    assertCanManagePortalDocs(user);
    const { buffer, filename, mime } =
      await this.portalDocuments.adminGetDocumentoGeneralArchivoAnyEstado(id);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async upload(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('tipo_documento') tipo_documento: string,
    @Body('nombre_documento') nombre_documento: string,
    @Body('fecha_validez') fecha_validez?: string,
    @Body('reemplazar_version_anterior') reemplazarRaw?: string,
  ) {
    assertCanManagePortalDocs(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo (campo file)');
    }
    let fv: Date | null = null;
    if (fecha_validez && String(fecha_validez).trim()) {
      const d = new Date(String(fecha_validez).trim());
      fv = Number.isNaN(d.getTime()) ? null : d;
    }
    const reemplazar =
      String(reemplazarRaw ?? 'true').toLowerCase() !== 'false';
    const codigo = String(user?.CODIGO || user?.codigo || '').trim() || null;
    await this.portalDocuments.adminCreateDocumentoGeneral({
      tipo_documento: String(tipo_documento || ''),
      nombre_documento: String(nombre_documento || ''),
      buffer: file.buffer,
      mime_type: file.mimetype || null,
      fecha_validez: fv,
      created_by: codigo,
      reemplazar_version_anterior: reemplazar,
    });
    return { success: true };
  }

  @Patch(':id/estado')
  async patchEstado(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estado?: string },
  ) {
    assertCanManagePortalDocs(user);
    await this.portalDocuments.adminSetEstadoDocumentoGeneral(
      id,
      String(body?.estado || ''),
    );
    return { success: true };
  }
}
