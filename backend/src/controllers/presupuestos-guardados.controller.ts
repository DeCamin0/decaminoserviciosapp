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
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';
import { PresupuestoDocumentoService } from '../services/presupuesto-documento.service';
import { EmailService } from '../services/email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/presupuestos-guardados')
@UseGuards(JwtAuthGuard)
export class PresupuestosGuardadosController {
  private readonly logger = new Logger(PresupuestosGuardadosController.name);

  constructor(
    private readonly presupuestosGuardadosService: PresupuestosGuardadosService,
    private readonly presupuestoDocumentoService: PresupuestoDocumentoService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':id/pdf-firmado')
  async getPdfFirmado(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const filename = `presupuesto-${id}-firmado.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    const pdfBuffer =
      await this.presupuestosGuardadosService.getSignedPdfBuffer(id);
    if (pdfBuffer && pdfBuffer.length > 0) {
      res.send(pdfBuffer);
      return;
    }
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
    res.sendFile(absolutePath);
  }

  @Get(':id/generar-documento')
  async generarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Query('company') company: string | undefined,
    @Res() res: Response,
  ) {
    const companyKey =
      company?.toLowerCase() === 'hera' ? ('hera' as const) : undefined;
    const { buffer, filename } =
      await this.presupuestoDocumentoService.generarPdf(id, {
        ...(companyKey && { companyKey }),
      });
    const safeName = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${safeName}`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  /**
   * Mismo PDF que GET, pero el body puede incluir `payload` (oferta en pantalla)
   * para que coincida con el frontend sin guardar antes.
   */
  @Post(':id/generar-documento')
  async generarDocumentoConPayload(
    @Param('id', ParseIntPipe) id: number,
    @Query('company') company: string | undefined,
    @Body() body: { payload?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    const companyKey =
      company?.toLowerCase() === 'hera' ? ('hera' as const) : undefined;
    const snap =
      body?.payload && typeof body.payload === 'object'
        ? body.payload
        : undefined;
    const { buffer, filename } =
      await this.presupuestoDocumentoService.generarPdf(id, {
        ...(companyKey && { companyKey }),
        ...(snap ? { payloadSnapshot: snap } : {}),
      });
    const safeName = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
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

  /** Enviar por email el PDF del presupuesto (firmado si existe, si no el generado). Body: { email: string, mensaje?: string } */
  @Post(':id/enviar-email')
  async enviarEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email?: string; mensaje?: string },
  ) {
    const email = (body?.email ?? '').trim();
    if (!email) {
      throw new BadRequestException('El campo email es obligatorio');
    }
    const presupuesto = await this.presupuestosGuardadosService.findOne(id);
    let pdfBuffer: Buffer | null =
      await this.presupuestosGuardadosService.getSignedPdfBuffer(id);
    const esFirmado = !!(pdfBuffer && pdfBuffer.length > 0);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      const { buffer } = await this.presupuestoDocumentoService.generarPdf(id);
      pdfBuffer = buffer;
    }
    const numeroPresupuesto = presupuesto.numero_presupuesto ?? String(id);
    const filename = esFirmado
      ? `presupuesto-${numeroPresupuesto}-firmado.pdf`
      : `presupuesto-${numeroPresupuesto}.pdf`;
    const subject = esFirmado
      ? `Presupuesto nº ${numeroPresupuesto} firmado - De Camino Servicios`
      : `Presupuesto nº ${numeroPresupuesto} - De Camino Servicios`;
    const tituloDoc = esFirmado ? 'Presupuesto firmado' : 'Presupuesto';
    const textoDoc = esFirmado
      ? `el presupuesto nº <strong>${numeroPresupuesto}</strong> firmado`
      : `el presupuesto nº <strong>${numeroPresupuesto}</strong>`;
    const clienteTexto = presupuesto.cliente_nombre
      ? ` para <strong>${presupuesto.cliente_nombre}</strong>`
      : '';
    const mensajeAdicional = (body?.mensaje ?? '').trim();
    const mensajeHtml = mensajeAdicional
      ? `<div class="additional-message" style="background-color: #e8f4f8; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #2196F3;">💬 Mensaje adicional:</h3>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${mensajeAdicional.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>')}</div>
    </div>`
      : '';
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📄 DE CAMINO SERVICIOS AUXILIARES S.L.</h1>
  </div>
  <div class="content">
    <h2 style="color: #4CAF50; margin-top: 0;">${tituloDoc}</h2>
    <p>Estimado/a cliente,</p>
    <p>Adjunto encontrará ${textoDoc}${clienteTexto}.</p>
    <p>El documento se envía en formato PDF y puede firmarse de cualquiera de las siguientes formas:</p>
    <ul style="margin: 10px 0; padding-left: 25px;">
      <li><strong>Firma electrónica</strong> (válida legalmente)</li>
      <li><strong>Firma manuscrita</strong> y entrega en mano</li>
    </ul>
    <p>Ambas opciones son válidas a efectos administrativos.</p>
    ${mensajeHtml}
    <div class="info-box">
      <p style="margin: 0;">Puede descargar el documento desde los archivos adjuntos del correo.</p>
    </div>
    <p>Quedamos a su disposición para cualquier aclaración.</p>
    <p>Saludos cordiales,</p>
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${(this.configService.get('company') as any)?.emailFromName ?? 'De Camino Servicios Auxiliares S.L.'}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">${(this.configService.get('company') as any)?.email ?? ''} · Tfno. ${(this.configService.get('company') as any)?.phone ?? ''}</p>
    </div>
    <div class="footer">
      <p>Este correo ha sido enviado desde la aplicación de gestión De Camino.</p>
    </div>
  </div>
</body>
</html>`;
    await this.emailService.sendEmailWithAttachment(
      email,
      subject,
      html,
      pdfBuffer,
      filename,
    );
    this.logger.log(
      `Presupuesto ${id} enviado por email a ${email} (${filename})`,
    );
    return {
      success: true,
      message: `Presupuesto enviado correctamente a ${email}`,
    };
  }
}
