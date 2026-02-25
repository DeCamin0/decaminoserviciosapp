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
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { InformePdfService } from '../services/informe-pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const CONFIG_ID = 1;

@Controller('api/informes/factura-config')
@UseGuards(JwtAuthGuard)
export class InformesFacturaConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly informePdfService: InformePdfService,
  ) {}

  /** Lista todos los informes guardados (con última firma si existe) */
  @Get('list')
  async list() {
    const rows = await this.prisma.informes_factura_config.findMany({
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
