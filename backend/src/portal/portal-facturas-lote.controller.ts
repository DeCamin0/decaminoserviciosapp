import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PortalFacturasLoteService } from './portal-facturas-lote.service';

function assertCanManagePortalDocs(user: any) {
  const g = String(user?.grupo || user?.GRUPO || '').trim();
  const ok = ['Developer', 'Admin', 'Manager', 'Supervisor'].includes(g);
  if (!ok) {
    throw new ForbiddenException(
      'Solo personal autorizado puede gestionar facturas del portal.',
    );
  }
}

@Controller('api/admin/portal-facturas-lote')
@UseGuards(JwtAuthGuard)
export class PortalFacturasLoteController {
  constructor(private readonly lote: PortalFacturasLoteService) {}

  @Post('analizar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 35 * 1024 * 1024 } }),
  )
  async analizar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertCanManagePortalDocs(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo PDF (campo file)');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.includes('pdf')) {
      throw new BadRequestException('Solo se admite PDF');
    }
    const result = await this.lote.analizarPdf(file.buffer);
    return { success: true, ...result };
  }

  @Get(':batchId/preview/:pageIndex')
  async preview(
    @CurrentUser() user: any,
    @Param('batchId') batchId: string,
    @Param('pageIndex', ParseIntPipe) pageIndex: number,
    @Res() res: Response,
  ) {
    assertCanManagePortalDocs(user);
    const { buffer, mime } = this.lote.getPagePreview(batchId, pageIndex);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  @Post(':batchId/confirmar')
  async confirmar(
    @CurrentUser() user: any,
    @Param('batchId') batchId: string,
    @Body()
    body: {
      assignments: {
        pageIndex: number;
        cliente_id: number;
        fecha_emision?: string;
        fecha_vencimiento?: string;
        importe?: string;
        numero_factura?: string;
      }[];
      fecha_emision?: string;
    },
  ) {
    assertCanManagePortalDocs(user);
    const result = await this.lote.confirmarLote(batchId, body);
    return { success: true, ...result };
  }
}
