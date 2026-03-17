import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { InformePdfService } from '../services/informe-pdf.service';
import { EmailService } from '../services/email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const CONFIG_ID = 1;

@Controller('api/informes/factura-config')
@UseGuards(JwtAuthGuard)
export class InformesFacturaConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly informePdfService: InformePdfService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /** Lista todos los informes guardados (con última firma si existe). Excluye id=CONFIG_ID que es solo la plantilla del formulario Factura. */
  @Get('list')
  async list() {
    const rows = await this.prisma.informes_factura_config.findMany({
      where: { id: { not: CONFIG_ID } },
      orderBy: { updated_at: 'desc' },
      include: { firmas: { orderBy: { created_at: 'desc' }, take: 1 } },
    });
    return { success: true, data: rows };
  }

  @Get()
  async get() {
    let config = await this.prisma.informes_factura_config.findUnique({
      where: { id: CONFIG_ID },
    });
    if (!config) {
      config = await this.prisma.informes_factura_config.create({
        data: {
          id: CONFIG_ID,
          tasa_iva: 21,
          tasa_descuento: 0,
          incluir_descripcion: true,
          filas_articulo: 3,
        },
      });
    }
    return { success: true, data: config };
  }

  @Patch()
  async update(
    @Body()
    body: {
      tasa_iva?: number;
      tasa_descuento?: number;
      incluir_descripcion?: boolean;
      filas_articulo?: number;
      titulo_empresa?: string;
      direccion_empresa?: string;
      cp_poblacion_empresa?: string;
      email_empresa?: string;
      telefono_empresa?: string;
      cliente_id?: number | null;
      lineas_json?: Array<{
        id?: number;
        itemId?: string | null;
        descripcion?: string;
        precioUnitario?: number | string;
        cantidad?: number;
      }> | null;
      informe_final_temporada?: boolean;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.tasa_iva !== undefined) data.tasa_iva = Number(body.tasa_iva);
    if (body.tasa_descuento !== undefined)
      data.tasa_descuento = Number(body.tasa_descuento);
    if (body.incluir_descripcion !== undefined)
      data.incluir_descripcion = body.incluir_descripcion;
    if (body.filas_articulo !== undefined)
      data.filas_articulo = Number(body.filas_articulo);
    if (body.titulo_empresa !== undefined)
      data.titulo_empresa = body.titulo_empresa?.trim() ?? null;
    if (body.direccion_empresa !== undefined)
      data.direccion_empresa = body.direccion_empresa?.trim() ?? null;
    if (body.cp_poblacion_empresa !== undefined)
      data.cp_poblacion_empresa = body.cp_poblacion_empresa?.trim() ?? null;
    if (body.email_empresa !== undefined)
      data.email_empresa = body.email_empresa?.trim() ?? null;
    if (body.telefono_empresa !== undefined)
      data.telefono_empresa = body.telefono_empresa?.trim() ?? null;
    if (body.cliente_id !== undefined)
      data.cliente_id =
        body.cliente_id == null ? null : Number(body.cliente_id);
    if (body.lineas_json !== undefined) data.lineas_json = body.lineas_json;
    if (body.informe_final_temporada !== undefined)
      data.informe_final_temporada = !!body.informe_final_temporada;

    const config = await this.prisma.informes_factura_config.upsert({
      where: { id: CONFIG_ID },
      create: {
        id: CONFIG_ID,
        tasa_iva: (data.tasa_iva as number) ?? 21,
        tasa_descuento: (data.tasa_descuento as number) ?? 0,
        incluir_descripcion: (data.incluir_descripcion as boolean) ?? true,
        filas_articulo: (data.filas_articulo as number) ?? 3,
        titulo_empresa: (data.titulo_empresa as string) ?? null,
        direccion_empresa: (data.direccion_empresa as string) ?? null,
        cp_poblacion_empresa: (data.cp_poblacion_empresa as string) ?? null,
        email_empresa: (data.email_empresa as string) ?? null,
        telefono_empresa: (data.telefono_empresa as string) ?? null,
        cliente_id: (data.cliente_id as number | null) ?? null,
        lineas_json: (data.lineas_json as object) ?? null,
      },
      update: data,
    });
    return { success: true, data: config };
  }

  /** Crear un nuevo informe (nuevo registro). Cada "Guardar informe" puede llamar a POST para añadir a la lista. */
  @Post()
  async create(
    @Body()
    body: {
      tasa_iva?: number;
      tasa_descuento?: number;
      incluir_descripcion?: boolean;
      filas_articulo?: number;
      titulo_empresa?: string;
      direccion_empresa?: string;
      cp_poblacion_empresa?: string;
      email_empresa?: string;
      telefono_empresa?: string;
      cliente_id?: number | null;
      lineas_json?: Array<{
        id?: number;
        itemId?: string | null;
        descripcion?: string;
        precioUnitario?: number | string;
        cantidad?: number;
      }> | null;
      informe_final_temporada?: boolean;
    },
  ) {
    const data: Record<string, unknown> = {
      tasa_iva: Number.isFinite(Number(body.tasa_iva))
        ? Number(body.tasa_iva)
        : 21,
      tasa_descuento: Number.isFinite(Number(body.tasa_descuento))
        ? Number(body.tasa_descuento)
        : 0,
      incluir_descripcion: body.incluir_descripcion ?? true,
      filas_articulo: Number.isFinite(Number(body.filas_articulo))
        ? Number(body.filas_articulo)
        : 3,
      titulo_empresa: body.titulo_empresa?.trim() ?? null,
      direccion_empresa: body.direccion_empresa?.trim() ?? null,
      cp_poblacion_empresa: body.cp_poblacion_empresa?.trim() ?? null,
      email_empresa: body.email_empresa?.trim() ?? null,
      telefono_empresa: body.telefono_empresa?.trim() ?? null,
      cliente_id: body.cliente_id == null ? null : Number(body.cliente_id),
      lineas_json: body.lineas_json ?? null,
      informe_final_temporada: !!body.informe_final_temporada,
    };
    const row = await this.prisma.informes_factura_config.create({
      data: data as any,
    });
    return { success: true, data: row };
  }

  /** Descargar PDF del informe firmado (última firma guardada) */
  @Get(':id/pdf-firmado')
  async getPdfFirmado(@Param('id') id: string, @Res() res: Response) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    const firma = await this.prisma.informes_firmas.findFirst({
      where: { informe_id: numId },
      orderBy: { created_at: 'desc' },
      select: { pdf_path: true },
    });
    if (!firma?.pdf_path)
      throw new NotFoundException('No hay PDF firmado para este informe');
    const fullPath = path.join(process.cwd(), firma.pdf_path);
    if (!fs.existsSync(fullPath))
      throw new NotFoundException('Archivo PDF no encontrado');
    const filename = `informe-${numId}-firmado.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(fullPath);
  }

  /** Enviar por email el PDF del informe. Body: { email: string, mensaje?: string } */
  @Post(':id/enviar-email')
  async enviarEmail(
    @Param('id') id: string,
    @Body() body: { email?: string; mensaje?: string },
  ) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    const email = (body?.email ?? '').trim();
    if (!email) {
      throw new BadRequestException('El campo email es obligatorio');
    }
    const informe = await this.prisma.informes_factura_config.findUnique({
      where: { id: numId },
    });
    if (!informe) throw new NotFoundException('Informe no encontrado');
    const { buffer, filename } =
      await this.informePdfService.generatePdf(numId);
    const subject = `Informe - De Camino Servicios`;
    const clienteNombre =
      informe.cliente_id != null
        ? ((
            await this.prisma.clientes.findUnique({
              where: { id: informe.cliente_id },
              select: { NOMBRE_O_RAZON_SOCIAL: true },
            })
          )?.NOMBRE_O_RAZON_SOCIAL ?? '')
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
    <h2 style="color: #4CAF50; margin-top: 0;">Informe</h2>
    <p>Estimado/a cliente,</p>
    <p>Adjunto encontrará el informe correspondiente a <strong>${clienteNombre || 'su comunidad'}</strong>.</p>
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
      buffer,
      filename,
    );
    return {
      success: true,
      message: `Informe enviado correctamente a ${email}`,
    };
  }

  /** Descargar PDF del informe (portada igual que presupuesto: PRESUPUESTO año + REPARACIONES VARIAS) */
  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    const { buffer, filename } =
      await this.informePdfService.generatePdf(numId);
    const safeName = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${safeName}`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  /** Obtener un informe por id */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    const row = await this.prisma.informes_factura_config.findUnique({
      where: { id: numId },
    });
    if (!row) throw new NotFoundException('Informe no encontrado');
    return { success: true, data: row };
  }

  /** Actualizar un informe por id */
  @Patch(':id')
  async updateOne(
    @Param('id') id: string,
    @Body()
    body: {
      tasa_iva?: number;
      tasa_descuento?: number;
      incluir_descripcion?: boolean;
      filas_articulo?: number;
      titulo_empresa?: string;
      direccion_empresa?: string;
      cp_poblacion_empresa?: string;
      email_empresa?: string;
      telefono_empresa?: string;
      cliente_id?: number | null;
      lineas_json?: Array<{
        id?: number;
        itemId?: string | null;
        descripcion?: string;
        precioUnitario?: number | string;
        cantidad?: number;
      }> | null;
      informe_final_temporada?: boolean;
    },
  ) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    const data: Record<string, unknown> = {};
    if (body.tasa_iva !== undefined) data.tasa_iva = Number(body.tasa_iva);
    if (body.tasa_descuento !== undefined)
      data.tasa_descuento = Number(body.tasa_descuento);
    if (body.incluir_descripcion !== undefined)
      data.incluir_descripcion = body.incluir_descripcion;
    if (body.filas_articulo !== undefined)
      data.filas_articulo = Number(body.filas_articulo);
    if (body.titulo_empresa !== undefined)
      data.titulo_empresa = body.titulo_empresa?.trim() ?? null;
    if (body.direccion_empresa !== undefined)
      data.direccion_empresa = body.direccion_empresa?.trim() ?? null;
    if (body.cp_poblacion_empresa !== undefined)
      data.cp_poblacion_empresa = body.cp_poblacion_empresa?.trim() ?? null;
    if (body.email_empresa !== undefined)
      data.email_empresa = body.email_empresa?.trim() ?? null;
    if (body.telefono_empresa !== undefined)
      data.telefono_empresa = body.telefono_empresa?.trim() ?? null;
    if (body.cliente_id !== undefined)
      data.cliente_id =
        body.cliente_id == null ? null : Number(body.cliente_id);
    if (body.lineas_json !== undefined) data.lineas_json = body.lineas_json;
    if (body.informe_final_temporada !== undefined)
      data.informe_final_temporada = !!body.informe_final_temporada;
    const row = await this.prisma.informes_factura_config.update({
      where: { id: numId },
      data: data as any,
    });
    return { success: true, data: row };
  }

  /** Eliminar un informe por id */
  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new NotFoundException('ID inválido');
    await this.prisma.informes_factura_config.delete({
      where: { id: numId },
    });
    return { success: true };
  }
}
