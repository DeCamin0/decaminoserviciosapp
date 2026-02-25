import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseIntPipe,
  Request,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';
import { PresupuestoDocumentoService } from '../services/presupuesto-documento.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/presupuestos-guardados')
@UseGuards(JwtAuthGuard)
export class PresupuestosGuardadosController {
  private readonly logger = new Logger(PresupuestosGuardadosController.name);

  constructor(
    private readonly presupuestosGuardadosService: PresupuestosGuardadosService,
    private readonly presupuestoDocumentoService: PresupuestoDocumentoService,
  ) {}

  @Get(':id/pdf-firmado')
  async getPdfFirmado(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfPath =
      await this.presupuestosGuardadosService.getSignedPdfPath(id);
    if (!pdfPath) {
      throw new NotFoundException(
        'No existe PDF firmado para este presupuesto',
      );
    }
    const absolutePath = path.join(process.cwd(), pdfPath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Archivo PDF firmado no encontrado');
    }
    const filename = `presupuesto-${id}-firmado.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.sendFile(absolutePath);
  }

  @Get(':id/generar-documento')
  async generarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const wantDocx = (format || 'docx').toLowerCase() !== 'pdf';
    const { buffer, filename } = wantDocx
      ? await this.presupuestoDocumentoService.generarDocx(id)
      : await this.presupuestoDocumentoService.generarPdf(id);
    const safeName = encodeURIComponent(filename);
    const mime = wantDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${safeName}`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Get()
  async getAll() {
    const data = await this.presupuestosGuardadosService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.presupuestosGuardadosService.findOne(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() body: any, @Request() req: any) {
    const createdBy = req?.user?.CODIGO ?? req?.user?.codigo ?? null;
    const data = await this.presupuestosGuardadosService.create({
      nombre: body.nombre,
      cliente_id: body.cliente_id ?? null,
      cliente_nombre: body.cliente_nombre ?? null,
      payload: body.payload ?? {},
      created_by: createdBy,
    });
    return { success: true, data };
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.presupuestosGuardadosService.update(id, {
      nombre: body.nombre,
      cliente_id: body.cliente_id,
      cliente_nombre: body.cliente_nombre,
      numero_presupuesto: body.numero_presupuesto,
      payload: body.payload,
    });
    return { success: true, data };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    const result = await this.presupuestosGuardadosService.remove(id);
    return result;
  }
}
