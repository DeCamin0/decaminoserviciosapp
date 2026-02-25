import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  Logger,
  BadRequestException,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email.service';
import { PresupuestoDocumentoService } from '../services/presupuesto-documento.service';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';
import * as fs from 'fs';
import * as path from 'path';

/** DTO enviado por la página de firma (firmar.html) */
export interface PresupuestoFirmadoDto {
  quotation_id: number;
  fecha_hora: string;
  nombre_comunidad: string;
  cif: string;
  direccion: string;
  nombre_representante: string;
  cargo: string;
  email: string;
  telefono: string;
  iban?: string;
  /** Fecha de inicio del servicio (YYYY-MM-DD desde el formulario de firma). */
  fecha_inicio_servicio?: string;
  firma_base64: string;
  pdf_base64?: string; // opcional: PDF de confirmación generado en el cliente para guardarlo en servidor
  numero_presupuesto?: string; // opcional: número legible del presupuesto (ej. MAD20260001)
  /** Índice de la fila de oferta económica aceptada (cuando hay varias variantes). */
  selected_oferta_index?: number;
  /** Índices de las filas de oferta aceptadas (permite selección múltiple de servicios). */
  selected_oferta_indices?: number[];
  /** Solo piscina: nombre del presidente. */
  nombre_presidente?: string;
  /** Solo piscina: DNI del presidente. */
  dni_presidente?: string;
  /** Solo piscina: número de viviendas. */
  n_viviendas?: string;
  /** Solo piscina: recogida llaves instalaciones. */
  recogida_llaves?: string;
  ip?: string;
  user_agent?: string;
}

@Controller('api/presupuestos')
export class PresupuestosFirmadoController {
  private readonly logger = new Logger(PresupuestosFirmadoController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly presupuestoDocumentoService: PresupuestoDocumentoService,
    private readonly presupuestosGuardadosService: PresupuestosGuardadosService,
  ) {}

  /** Endpoint público (sin JWT): devuelve numero_presupuesto, cliente_nombre, cif y direccion para prellenar la página de firma. */
  @Get(':id/datos-firma')
  async getDatosFirma(@Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.presupuestos_guardados.findUnique({
      where: { id },
      select: {
        numero_presupuesto: true,
        cliente_nombre: true,
        cliente_id: true,
        payload: true,
      },
    });
    if (!p) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    let cif: string | null = null;
    let direccion: string | null = null;
    let iban: string | null = null;

    if (p.cliente_id != null) {
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: p.cliente_id },
        select: {
          NIF: true,
          DIRECCION: true,
          CODIGO_POSTAL: true,
          POBLACION: true,
          PROVINCIA: true,
          CUENTAS_BANCARIAS: true,
        },
      });
      if (cliente) {
        cif = cliente.NIF != null ? String(cliente.NIF).trim() : null;
        const parts: string[] = [];
        if (cliente.DIRECCION != null && String(cliente.DIRECCION).trim())
          parts.push(String(cliente.DIRECCION).trim());
        const cp =
          cliente.CODIGO_POSTAL != null
            ? String(cliente.CODIGO_POSTAL).trim()
            : '';
        const pob =
          cliente.POBLACION != null ? String(cliente.POBLACION).trim() : '';
        if (cp || pob) parts.push([cp, pob].filter(Boolean).join(' '));
        if (cliente.PROVINCIA != null && String(cliente.PROVINCIA).trim())
          parts.push(String(cliente.PROVINCIA).trim());
        direccion = parts.length > 0 ? parts.join(', ') : null;
        if (cliente.CUENTAS_BANCARIAS != null) {
          const raw = String(cliente.CUENTAS_BANCARIAS).trim();
          iban = raw ? raw.split(/\r?\n/)[0]?.trim() || raw : null;
        }
      }
    }

    if (direccion == null && p.payload && typeof p.payload === 'object') {
      const payload = p.payload as Record<string, unknown>;
      const parts: string[] = [];
      const dir =
        payload.presupuestoClienteDireccion != null
          ? String(payload.presupuestoClienteDireccion).trim()
          : '';
      if (dir) parts.push(dir);
      const cp =
        payload.presupuestoClienteCodigoPostal != null
          ? String(payload.presupuestoClienteCodigoPostal).trim()
          : '';
      const pob =
        payload.presupuestoClientePoblacion != null
          ? String(payload.presupuestoClientePoblacion).trim()
          : '';
      if (cp || pob) parts.push([cp, pob].filter(Boolean).join(' '));
      const prov =
        payload.presupuestoClienteProvincia != null
          ? String(payload.presupuestoClienteProvincia).trim()
          : '';
      if (prov) parts.push(prov);
      if (parts.length > 0) direccion = parts.join(', ');
    }

    const numeroPresupuesto =
      p.numero_presupuesto && String(p.numero_presupuesto).trim()
        ? String(p.numero_presupuesto).trim()
        : `MAD${new Date().getFullYear()}${String(id).padStart(4, '0')}`;

    let oferta_economica: Array<{
      descripcion: string;
      mensualidadSinIva: number;
      mensualidadConIva: number;
      anualidadSinIva: number;
      anualidadConIva: number;
    }> = [];
    let es_solo_piscina = false;
    if (p.payload && typeof p.payload === 'object') {
      const payload = p.payload as Record<string, unknown>;
      const raw = payload.ofertaEconomica;
      if (Array.isArray(raw) && raw.length > 0) {
        oferta_economica = raw.map((row: any) => ({
          descripcion:
            row?.descripcion != null ? String(row.descripcion).trim() : '',
          mensualidadSinIva: Number(row?.mensualidadSinIva) || 0,
          mensualidadConIva: Number(row?.mensualidadConIva) || 0,
          anualidadSinIva: Number(row?.anualidadSinIva) || 0,
          anualidadConIva: Number(row?.anualidadConIva) || 0,
        }));
        const hasPiscina = (d: string) => /piscina/i.test(d);
        es_solo_piscina = oferta_economica.every((r) =>
          hasPiscina(r.descripcion),
        );
      }
    }

    return {
      numero_presupuesto: numeroPresupuesto,
      cliente_nombre: p.cliente_nombre ? String(p.cliente_nombre).trim() : null,
      cif: cif || null,
      direccion: direccion || null,
      iban: iban || null,
      oferta_economica: oferta_economica.length ? oferta_economica : null,
      es_solo_piscina: oferta_economica.length > 0 ? es_solo_piscina : null,
    };
  }

  /** Endpoint público (sin JWT): recibe los datos de la firma y los guarda en BD + opcionalmente el PDF en disco. */
  @Post('firmado')
  async firmado(@Body() body: PresupuestoFirmadoDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = req.headers['user-agent'] || '';

    const presupuestoId = body.quotation_id;
    if (!presupuestoId) {
      throw new BadRequestException('Falta quotation_id');
    }

    const existe = await this.prisma.presupuestos_guardados.findUnique({
      where: { id: presupuestoId },
      select: { id: true },
    });
    if (!existe) {
      throw new BadRequestException('Presupuesto no encontrado');
    }

    // Actualizar presupuesto con nombre, dirección y variantes aceptadas del formulario ANTES de generar el PDF
    const nombreCliente = (body.nombre_comunidad || '').trim();
    const direccion = (body.direccion || '').trim();
    const selectedOfertaIndices = Array.isArray(body.selected_oferta_indices)
      ? body.selected_oferta_indices.filter(
          (i: unknown) => typeof i === 'number' && i >= 0,
        )
      : undefined;
    const selectedOfertaIndex = body.selected_oferta_index;
    if (
      nombreCliente ||
      direccion ||
      selectedOfertaIndices !== undefined ||
      selectedOfertaIndex !== undefined
    ) {
      try {
        const presupuesto =
          await this.presupuestosGuardadosService.findOne(presupuestoId);
        const payload = (presupuesto.payload || {}) as Record<string, unknown>;
        const newPayload = { ...payload };
        if (direccion) newPayload.presupuestoClienteDireccion = direccion;
        if (selectedOfertaIndices !== undefined)
          newPayload.selectedOfertaIndices = selectedOfertaIndices;
        if (selectedOfertaIndex !== undefined)
          newPayload.selectedOfertaIndex = selectedOfertaIndex;
        await this.presupuestosGuardadosService.update(presupuestoId, {
          ...(nombreCliente && { cliente_nombre: nombreCliente }),
          payload: newPayload,
        });
        this.logger.log(
          `Presupuesto ${presupuestoId} actualizado con datos del formulario de firma (cliente/dirección/variantes)`,
        );
      } catch (err: any) {
        this.logger.warn(
          'No se pudo actualizar el presupuesto con datos del formulario de firma',
          err?.message || err,
        );
      }
    }

    let pdfPath: string | null = null;
    let pdfBuffer: Buffer | null = null;
    let originalPdfSha256: string | null = null;
    let originalPdfSizeBytes: number | null = null;
    let signedPdfSha256: string | null = null;
    let signedPdfSizeBytes: number | null = null;

    try {
      // 1) Generar PDF original (sin firma) y calcular huella SHA-256 y tamaño
      const { buffer: originalBuffer } =
        await this.presupuestoDocumentoService.generarPdf(presupuestoId);
      originalPdfSha256 = crypto
        .createHash('sha256')
        .update(originalBuffer)
        .digest('hex');
      originalPdfSizeBytes = originalBuffer.length;

      const datosFirma = {
        fecha_hora: body.fecha_hora || '',
        nombre_representante: (body.nombre_representante || '').trim(),
        cargo: (body.cargo || '').trim() || undefined,
        nombre_comunidad: (body.nombre_comunidad || '').trim(),
        firma_base64: body.firma_base64 || '',
        direccion: direccion || undefined,
        cif: (body.cif || '').trim() || undefined,
        iban: (body.iban || '').trim() || undefined,
        fecha_inicio_servicio:
          (body.fecha_inicio_servicio || '').trim() || undefined,
        telefono: (body.telefono || '').trim() || undefined,
        nombre_presidente: (body.nombre_presidente || '').trim() || undefined,
        dni_presidente: (body.dni_presidente || '').trim() || undefined,
        n_viviendas: (body.n_viviendas || '').trim() || undefined,
        recogida_llaves: (body.recogida_llaves || '').trim() || undefined,
      };

      // 2) Generar PDF firmado SIN bloque Evidencias para calcular su huella
      const { buffer: signedBufferSinEvidencias } =
        await this.presupuestoDocumentoService.generarPdf(presupuestoId, {
          datosFirma,
        });
      signedPdfSha256 = crypto
        .createHash('sha256')
        .update(signedBufferSinEvidencias)
        .digest('hex');
      signedPdfSizeBytes = signedBufferSinEvidencias.length;

      // 3) Generar de nuevo el PDF firmado CON bloque Evidencias (ya con el hash real del documento firmado)
      const { buffer: pdfBufferFinal } =
        await this.presupuestoDocumentoService.generarPdf(presupuestoId, {
          datosFirma,
          evidencias: {
            original_pdf_sha256: originalPdfSha256,
            original_pdf_size_bytes: originalPdfSizeBytes,
            signed_pdf_sha256: signedPdfSha256,
            signed_pdf_size_bytes: signedPdfSizeBytes ?? undefined,
          },
        });

      pdfBuffer = pdfBufferFinal;
      const dir = path.join(process.cwd(), 'uploads', 'presupuestos-firmas');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const fileName = `presupuesto-${presupuestoId}-firmado-${Date.now()}.pdf`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      pdfPath = `uploads/presupuestos-firmas/${fileName}`;
      this.logger.log(
        `PDF presupuesto con firma generado: ${pdfBuffer.length} bytes, guardado en ${fileName}; original_sha256=${originalPdfSha256.slice(0, 16)}..., signed_sha256=${signedPdfSha256.slice(0, 16)}...`,
      );
    } catch (err: any) {
      this.logger.warn(
        'No se pudo generar o guardar el PDF de aceptación',
        err?.message || err,
      );
    }

    await this.prisma.presupuestos_firmas.create({
      data: {
        presupuesto_id: presupuestoId,
        fecha_hora: body.fecha_hora,
        nombre_comunidad: (body.nombre_comunidad || '').trim() || '—',
        cif: (body.cif || '').trim() || '—',
        direccion: (body.direccion || '').trim() || '—',
        nombre_representante: (body.nombre_representante || '').trim() || '—',
        cargo: (body.cargo || '').trim() || '—',
        email: (body.email || '').trim() || '—',
        telefono: (body.telefono || '').trim() || '—',
        firma_imagen_base64: body.firma_base64 || '',
        ip: ip || null,
        user_agent: userAgent || null,
        pdf_path: pdfPath,
        original_pdf_sha256: originalPdfSha256 ?? undefined,
        original_pdf_size_bytes: originalPdfSizeBytes ?? undefined,
        signed_pdf_sha256: signedPdfSha256 ?? undefined,
        signed_pdf_size_bytes: signedPdfSizeBytes ?? undefined,
      },
    });

    const emailCliente = (body.email || '').trim();
    let emailEnviado = false;

    if (pdfBuffer && pdfBuffer.length > 0 && emailCliente) {
      this.logger.log(
        `Intentando enviar email con PDF de aceptación a ${emailCliente} (presupuesto ${presupuestoId}), PDF size=${pdfBuffer.length}`,
      );
      try {
        const numeroPresupuesto =
          (body.numero_presupuesto || '').trim() || String(presupuestoId);
        const fileName = `presupuesto-${numeroPresupuesto}-firmado.pdf`;
        const subject = `Aceptación de presupuesto nº ${numeroPresupuesto} - De Camino Servicios`;
        const html = `
          <p>Estimado/a ${(body.nombre_representante || '').trim() || 'cliente'},</p>
          <p>Adjuntamos el documento de aceptación del presupuesto nº <strong>${numeroPresupuesto}</strong>, firmado electrónicamente.</p>
          <p>Puede conservar este PDF como comprobante.</p>
          <p>Saludos cordiales,<br/><strong>De Camino Servicios Auxiliares</strong></p>
        `;
        await this.emailService.sendEmailWithAttachment(
          emailCliente,
          subject,
          html,
          pdfBuffer,
          fileName,
        );
        emailEnviado = true;
        this.logger.log(
          `Email con PDF de aceptación enviado correctamente a ${emailCliente}`,
        );
      } catch (err: any) {
        this.logger.warn(
          'No se pudo enviar el email con el PDF de aceptación al cliente: ' +
            (err?.message || String(err)),
        );
      }
    } else {
      if (!emailCliente) {
        this.logger.log(
          'No se envía email: no hay dirección de correo en el formulario',
        );
      }
      if (!pdfBuffer || pdfBuffer.length === 0) {
        this.logger.log(
          'No se envía email: no hay PDF válido (body truncado o base64 inválido). Comprueba que el cliente envía el PDF completo.',
        );
      }
    }

    this.logger.log(
      `Presupuesto firmado: id=${presupuestoId}, comunidad=${body.nombre_comunidad}, IP=${ip}, PDF guardado=${!!pdfPath}, email enviado=${emailEnviado}`,
    );
    return {
      success: true,
      message: 'Firma registrada correctamente',
      quotation_id: presupuestoId,
      email_enviado: emailEnviado,
    };
  }
}
