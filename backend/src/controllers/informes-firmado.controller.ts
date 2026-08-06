import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { InformePdfService } from '../services/informe-pdf.service';
import { EmailService } from '../services/email.service';
import { InformesFirmasStorageService } from '../services/informes-firmas-storage.service';

export interface InformeFirmadoDto {
  informe_id: number;
  fecha_hora: string;
  nombre_comunidad: string;
  cif: string;
  direccion: string;
  nombre_representante: string;
  cargo: string;
  email: string;
  telefono: string;
  firma_base64: string;
  ip?: string;
  user_agent?: string;
}

@Controller('api/informes-firma')
export class InformesFirmadoController {
  private readonly logger = new Logger(InformesFirmadoController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly informePdfService: InformePdfService,
    private readonly emailService: EmailService,
    private readonly informesFirmasStorage: InformesFirmasStorageService,
  ) {}

  /** Endpoint público (sin JWT): devuelve numero_informe, cliente_nombre, cif, direccion para prellenar la página de firma. */
  @Get(':id/datos-firma')
  async getDatosFirma(@Param('id', ParseIntPipe) id: number) {
    const informe = await this.prisma.informes_factura_config.findUnique({
      where: { id },
      select: { id: true, cliente_id: true },
    });
    if (!informe) throw new NotFoundException('Informe no encontrado');

    const anio = new Date().getFullYear();
    const numeroInforme = `INF-${anio}-${String(id).padStart(4, '0')}`;
    let clienteNombre: string | null = null;
    let cif: string | null = null;
    let direccion: string | null = null;

    if (informe.cliente_id != null) {
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: informe.cliente_id },
        select: {
          NOMBRE_O_RAZON_SOCIAL: true,
          NIF: true,
          DIRECCION: true,
          CODIGO_POSTAL: true,
          POBLACION: true,
          PROVINCIA: true,
        },
      });
      if (cliente) {
        clienteNombre =
          cliente.NOMBRE_O_RAZON_SOCIAL != null
            ? String(cliente.NOMBRE_O_RAZON_SOCIAL).trim()
            : null;
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
      }
    }

    return {
      numero_informe: numeroInforme,
      cliente_nombre: clienteNombre,
      cif: cif ?? '',
      direccion: direccion ?? '',
    };
  }

  /** Endpoint público: recibe la firma y guarda en informes_firmas + genera PDF firmado. */
  @Post('firmado')
  async firmado(@Body() body: InformeFirmadoDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = req.headers['user-agent'] || '';

    const informeId = body.informe_id;
    if (!informeId) throw new BadRequestException('Falta informe_id');

    const existe = await this.prisma.informes_factura_config.findUnique({
      where: { id: informeId },
      select: { id: true },
    });
    if (!existe) throw new BadRequestException('Informe no encontrado');

    let pdfPath: string | null = null;
    let pdfBuffer: Buffer | null = null;
    let storageKey: string | null = null;
    let storageBucket: string | null = null;
    let tamanoBytes: number | null = null;

    const datosFirma = {
      fecha_hora: body.fecha_hora || new Date().toISOString(),
      firma_base64: body.firma_base64 || '',
      nombre_representante: body.nombre_representante?.trim(),
      nombre_comunidad: body.nombre_comunidad?.trim(),
      cif: body.cif?.trim(),
      direccion: body.direccion?.trim(),
      cargo: body.cargo?.trim(),
      email: body.email?.trim(),
      telefono: body.telefono?.trim(),
    };

    try {
      // 1) PDF original (sin firma) → huella SHA-256
      const { buffer: originalBuffer } =
        await this.informePdfService.generatePdf(informeId);
      const originalPdfSha256 = crypto
        .createHash('sha256')
        .update(originalBuffer)
        .digest('hex');

      // 2) PDF firmado sin bloque Evidencias → huella del documento firmado
      const { buffer: signedBufferSinEvidencias } =
        await this.informePdfService.generatePdf(informeId, {
          datosFirma,
        });
      const signedPdfSha256 = crypto
        .createHash('sha256')
        .update(signedBufferSinEvidencias)
        .digest('hex');

      // 3) PDF firmado con bloque Evidencias (hashes reales)
      const { buffer } = await this.informePdfService.generatePdf(informeId, {
        datosFirma,
        evidencias: {
          original_pdf_sha256: originalPdfSha256,
          signed_pdf_sha256: signedPdfSha256,
        },
      });
      pdfBuffer = buffer;
      const fileName = `informe-${informeId}-firmado-${Date.now()}.pdf`;

      if (this.informesFirmasStorage.isWriteEnabled()) {
        try {
          const put = await this.informesFirmasStorage.putFirmaPdf(
            pdfBuffer,
            informeId,
            fileName,
          );
          storageKey = put.storage_key;
          storageBucket = put.storage_bucket;
          tamanoBytes = put.tamano_bytes;
          this.logger.log(
            `PDF informe firmado en R2: ${pdfBuffer.length} bytes, key=${put.storage_key}`,
          );
        } catch (r2Err: any) {
          this.logger.warn(
            'R2 put falló para informe firmado; fallback a disco: ' +
              (r2Err?.message || r2Err),
          );
        }
      }

      if (!storageKey) {
        const dir = path.join(process.cwd(), 'uploads', 'informes-firmas');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);
        pdfPath = `uploads/informes-firmas/${fileName}`;
      }
    } catch {
      // log but continue to save firma
    }

    let firmaImagenStorageKey: string | null = null;
    const imgBuf = this.informesFirmasStorage.parseFirmaImagenBase64(
      body.firma_base64,
    );
    if (imgBuf) {
      if (!this.informesFirmasStorage.isWriteEnabled()) {
        throw new BadRequestException(
          'R2 no está habilitado; no se puede guardar la imagen de firma',
        );
      }
      const imgPut = await this.informesFirmasStorage.putFirmaImagenPng(
        imgBuf,
        informeId,
      );
      firmaImagenStorageKey = imgPut.storage_key;
    }

    await this.prisma.informes_firmas.create({
      data: {
        informe_id: informeId,
        fecha_hora: body.fecha_hora || new Date().toISOString(),
        nombre_comunidad: (body.nombre_comunidad || '').trim() || '—',
        cif: (body.cif || '').trim() || '—',
        direccion: (body.direccion || '').trim() || '—',
        nombre_representante: (body.nombre_representante || '').trim() || '—',
        cargo: (body.cargo || '').trim() || '—',
        email: (body.email || '').trim() || '—',
        telefono: (body.telefono || '').trim() || '—',
        firma_imagen_storage_key: firmaImagenStorageKey,
        ip: ip || null,
        user_agent: userAgent || null,
        pdf_path: pdfPath,
        storage_key: storageKey,
        storage_bucket: storageBucket,
        tamano_bytes: tamanoBytes,
      },
    });

    const emailTo = (body.email || '').trim();
    let emailEnviado = false;
    if (pdfBuffer && pdfBuffer.length > 0 && emailTo) {
      try {
        const anio = new Date().getFullYear();
        const numeroInforme = `INF-${anio}-${String(informeId).padStart(4, '0')}`;
        const fileName = `informe-${numeroInforme}-firmado.pdf`;
        await this.emailService.sendEmailWithAttachment(
          emailTo,
          `Aceptación informe nº ${numeroInforme} - De Camino Servicios`,
          `<p>Estimado/a ${(body.nombre_representante || '').trim() || 'cliente'},</p><p>Adjuntamos el informe nº <strong>${numeroInforme}</strong> firmado electrónicamente.</p><p>Saludos cordiales,<br/><strong>De Camino Servicios Auxiliares</strong></p>`,
          pdfBuffer,
          fileName,
        );
        emailEnviado = true;
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: 'Firma registrada correctamente',
      informe_id: informeId,
      email_enviado: emailEnviado,
      pdf_base64:
        pdfBuffer && pdfBuffer.length > 0
          ? pdfBuffer.toString('base64')
          : undefined,
    };
  }
}
