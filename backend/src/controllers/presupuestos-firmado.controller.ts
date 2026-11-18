import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  Query,
  Logger,
  BadRequestException,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { clampPresupuestoDescuentoGlobalPct } from '../utils/presupuesto-descuento-pct';
import { EmailService } from '../services/email.service';
import {
  PresupuestoDocumentoService,
  expandOfertaInvernalPiscinaDesdePayload,
} from '../services/presupuesto-documento.service';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';
import { PresupuestosFirmasStorageService } from '../services/presupuestos-firmas-storage.service';
import {
  FIRMA_PURPOSE_PRESUPUESTO_V2,
  readPresupuestoFirmaConfig,
  resolveFirmaAccess,
  verifyFirmaToken,
} from '../services/presupuesto-firma-access';
import { PresupuestosV2PdfService } from '../presupuestos-v2/pdf/presupuestos-v2-pdf.service';
import * as fs from 'fs';
import * as path from 'path';

/** Datos de horario por variante piscina para prellenar el editor en firmar.html */
function buildPiscinaHorariosFirmaDesdePayload(
  payload: Record<string, unknown>,
): { piscina_variant_index: number; horario_por_periodos: unknown[] }[] {
  const principal = (payload.presupuestoCalculoPiscina || {}) as Record<
    string,
    unknown
  >;
  const rest = (payload.presupuestoCalculoPiscinaRest || []) as Record<
    string,
    unknown
  >[];
  const out: {
    piscina_variant_index: number;
    horario_por_periodos: unknown[];
  }[] = [];
  const hp0 = principal.horarioPorPeriodos;
  if (Array.isArray(hp0) && hp0.length > 0) {
    out.push({ piscina_variant_index: 0, horario_por_periodos: hp0 });
  } else {
    const leg = payload.presupuestoHorarioPiscina;
    if (Array.isArray(leg) && leg.length > 0) {
      out.push({ piscina_variant_index: 0, horario_por_periodos: leg });
    } else {
      out.push({ piscina_variant_index: 0, horario_por_periodos: [] });
    }
  }
  for (let i = 0; i < rest.length; i++) {
    const hp = rest[i]?.horarioPorPeriodos;
    out.push({
      piscina_variant_index: i + 1,
      horario_por_periodos: Array.isArray(hp) ? hp : [],
    });
  }
  return out;
}

function mergePiscinaHorarioFirmaEnPayload(
  payload: Record<string, unknown>,
  entries: Array<{
    piscina_variant_index: number;
    horario_por_periodos: unknown[];
  }>,
): Record<string, unknown> {
  const next = { ...payload };
  const principal = {
    ...((next.presupuestoCalculoPiscina || {}) as Record<string, unknown>),
  };
  const rest = [
    ...((next.presupuestoCalculoPiscinaRest || []) as Record<
      string,
      unknown
    >[]),
  ];
  for (const entry of entries) {
    const vi = entry.piscina_variant_index;
    const hp = entry.horario_por_periodos;
    if (typeof vi !== 'number' || vi < 0 || !Array.isArray(hp)) continue;
    if (vi === 0) {
      Object.assign(principal, { horarioPorPeriodos: hp });
    } else {
      while (rest.length < vi) rest.push({});
      rest[vi - 1] = {
        ...(rest[vi - 1] || {}),
        horarioPorPeriodos: hp,
      };
    }
  }
  next.presupuestoCalculoPiscina = principal;
  next.presupuestoCalculoPiscinaRest = rest;
  const hp0 = principal.horarioPorPeriodos;
  next.presupuestoHorarioPiscina = Array.isArray(hp0)
    ? hp0
    : ((next.presupuestoHorarioPiscina as unknown[]) ?? []);
  return next;
}

/** DTO enviado por la página de firma (firmar.html) */
export interface PresupuestoFirmadoDto {
  quotation_id?: number;
  fecha_hora: string;
  nombre_comunidad: string;
  cif: string;
  direccion: string;
  nombre_representante: string;
  cargo: string;
  email: string;
  telefono: string;
  iban?: string;
  forma_pago?: 'domiciliacion' | 'transferencia';
  /** Fecha de inicio del servicio (YYYY-MM-DD desde el formulario de firma). */
  fecha_inicio_servicio?: string;
  firma_base64: string;
  /** Tokenul din linkul nou. Absent la linkurile vechi, care au doar id-ul. */
  firma_token?: string;
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
  /** Si el cliente desmarcó Mantenimiento invernal y acepta Recuperación de Agua (650 € sin IVA). */
  recuperacion_agua?: boolean;
  /**
   * Horarios por periodos confirmados al firmar (solo variantes piscina verano que el cliente edita).
   * Cada entrada actualiza `presupuestoCalculoPiscina` (índice 0) o `presupuestoCalculoPiscinaRest[i-1]`.
   */
  piscina_horario_firma?: Array<{
    piscina_variant_index: number;
    horario_por_periodos: unknown[];
  }>;
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
    private readonly presupuestosFirmasStorage: PresupuestosFirmasStorageService,
    private readonly pdfV2: PresupuestosV2PdfService,
  ) {}

  /** Token de Presupuestos V2. Un token V1 no verifica con este propósito. */
  private v2IdFromToken(token: string | null | undefined): number | null {
    if (!token) return null;
    const result = verifyFirmaToken(
      token,
      readPresupuestoFirmaConfig(process.env),
      new Date(),
      FIRMA_PURPOSE_PRESUPUESTO_V2,
    );
    return result.ok ? result.id : null;
  }

  private presentedToken(value: unknown): string | null | undefined {
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : '';
  }

  private parseRequestedId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
      return parseInt(value.trim(), 10);
    }
    return null;
  }

  /**
   * Token prezent: se verifică doar tokenul. Nu există fallback la linkul vechi.
   * Token absent: link vechi, după data creării bugetului și fereastra de 90 de zile.
   */
  private async authorizedPresupuestoId(
    token: string | undefined,
    requestedId: number | null,
  ): Promise<number> {
    const config = readPresupuestoFirmaConfig(process.env);
    const now = new Date();
    let decision = resolveFirmaAccess({
      token: token === undefined ? null : token,
      requestedId,
      createdAt: null,
      config,
      now,
    });
    if (
      decision.ok === false &&
      decision.reason === 'needs-row' &&
      requestedId
    ) {
      const row = await this.prisma.presupuestos_guardados.findUnique({
        where: { id: requestedId },
        select: { created_at: true },
      });
      if (!row) {
        throw new NotFoundException('Presupuesto no encontrado');
      }
      decision = resolveFirmaAccess({
        token: null,
        requestedId,
        createdAt: row.created_at,
        config,
        now,
      });
    }
    if (decision.ok === false) {
      this.logger.warn(`Acceso firma rechazado: ${decision.reason}`);
      throw new NotFoundException('Presupuesto no encontrado');
    }
    return decision.id;
  }

  /** Link nou: /api/presupuestos/datos-firma?t=... Id-ul nu este în URL. */
  @Get('datos-firma')
  async getDatosFirmaByToken(@Query('t') token?: string) {
    if (typeof token !== 'string') {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    const v2Id = this.v2IdFromToken(token);
    if (v2Id) return this.pdfV2.datosFirmaPublicos(v2Id);
    const id = await this.authorizedPresupuestoId(token, null);
    return this.loadDatosFirma(id);
  }

  /** Endpoint público (sin JWT): devuelve numero_presupuesto, cliente_nombre, cif y direccion para prellenar la página de firma. */
  @Get(':id/datos-firma')
  async getDatosFirma(
    @Param('id', ParseIntPipe) id: number,
    @Query('t') token?: string,
  ) {
    const authorizedId = await this.authorizedPresupuestoId(
      this.presentedToken(token),
      id,
    );
    return this.loadDatosFirma(authorizedId);
  }

  private async loadDatosFirma(id: number) {
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
    let recuperacion_agua_precio = 650;
    let presupuesto_descuento_global_pct = 0;
    if (p.payload && typeof p.payload === 'object') {
      const payload = p.payload as Record<string, unknown>;
      const rawPct = payload.presupuestoDescuentoGlobalPct;
      if (
        rawPct !== undefined &&
        rawPct !== null &&
        String(rawPct).trim() !== ''
      ) {
        presupuesto_descuento_global_pct =
          clampPresupuestoDescuentoGlobalPct(rawPct);
      }
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
        oferta_economica = expandOfertaInvernalPiscinaDesdePayload(
          oferta_economica,
          payload,
        );
        const hasPiscina = (d: string) => /piscina/i.test(d);
        es_solo_piscina = oferta_economica.every((r) =>
          hasPiscina(r.descripcion),
        );
      }
      // Precio Recuperación de Agua (€ sin IVA) definido en el presupuesto; por defecto 650
      const rawRecuperacion = payload.recuperacionAguaPrecio;
      recuperacion_agua_precio =
        typeof rawRecuperacion === 'number'
          ? rawRecuperacion
          : Number(String(rawRecuperacion ?? '').trim()) || 650;
    }

    const tienePiscinaVeranoEnOferta = oferta_economica.some((r) => {
      const d = (r.descripcion || '').toLowerCase();
      if (d.includes('invernal')) return false;
      if (d.includes('recuperación') || d.includes('recuperacion'))
        return false;
      return d.includes('piscina') || d.includes('verano');
    });
    let piscina_horarios_firma: ReturnType<
      typeof buildPiscinaHorariosFirmaDesdePayload
    > | null = null;
    if (
      tienePiscinaVeranoEnOferta &&
      p.payload &&
      typeof p.payload === 'object'
    ) {
      piscina_horarios_firma = buildPiscinaHorariosFirmaDesdePayload(
        p.payload as Record<string, unknown>,
      );
    }

    return {
      numero_presupuesto: numeroPresupuesto,
      cliente_nombre: p.cliente_nombre ? String(p.cliente_nombre).trim() : null,
      cif: cif || null,
      direccion: direccion || null,
      iban: iban || null,
      oferta_economica: oferta_economica.length ? oferta_economica : null,
      es_solo_piscina: oferta_economica.length > 0 ? es_solo_piscina : null,
      recuperacion_agua_precio,
      presupuesto_descuento_global_pct,
      piscina_horarios_firma,
    };
  }

  /** El cliente rechaza un presupuesto V2. No modifica el PDF enviado. */
  @Post('rechazar')
  async rechazar(
    @Body() body: { firma_token?: string; motivo?: string },
    @Req() req: Request,
  ) {
    const v2Id = this.v2IdFromToken(this.presentedToken(body?.firma_token));
    if (!v2Id) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.pdfV2.rechazarOferta(v2Id, body?.motivo || '', {
      ip,
      userAgent,
    });
    let emailEnviado = false;
    if (result.notifyEmail) {
      const escape = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const cliente = result.clienteNombre
        ? ` de <strong>${escape(result.clienteNombre)}</strong>`
        : '';
      try {
        await this.emailService.sendEmail(
          result.notifyEmail,
          `Oferta rechazada — presupuesto nº ${result.numero}`,
          `<p>El cliente ha rechazado el presupuesto nº <strong>${escape(result.numero)}</strong>${cliente}.</p>
           <p><strong>Motivo:</strong></p>
           <p style="white-space:pre-wrap;">${escape(result.motivo)}</p>
           <p>El documento enviado no se ha modificado. El enlace de firma queda cerrado.</p>`,
          {
            record: {
              senderId: 'sistema',
              recipientName: result.companyName,
              attachmentNote: 'Rechazo de oferta',
            },
          },
        );
        emailEnviado = true;
      } catch (err: any) {
        this.logger.warn(
          'No se pudo avisar del rechazo: ' + (err?.message || String(err)),
        );
      }
    } else {
      this.logger.warn(
        `Rechazo del presupuesto ${result.numero} sin email de empresa`,
      );
    }
    return {
      success: true,
      message: 'Rechazo registrado',
      email_enviado: emailEnviado,
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

    const token = this.presentedToken(body.firma_token);
    const v2Id = this.v2IdFromToken(token);
    if (v2Id) return this.firmadoV2(v2Id, body, ip, userAgent);

    const requestedId = this.parseRequestedId(body.quotation_id);
    if (token === undefined && requestedId === null) {
      throw new BadRequestException('Falta quotation_id');
    }
    const presupuestoId = await this.authorizedPresupuestoId(
      token,
      requestedId,
    );

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
        if (body.recuperacion_agua === true)
          newPayload.recuperacion_agua = true;
        if (
          Array.isArray(body.piscina_horario_firma) &&
          body.piscina_horario_firma.length > 0
        ) {
          const cleaned = body.piscina_horario_firma.filter(
            (
              x,
            ): x is {
              piscina_variant_index: number;
              horario_por_periodos: unknown[];
            } =>
              x != null &&
              typeof x.piscina_variant_index === 'number' &&
              x.piscina_variant_index >= 0 &&
              Array.isArray(x.horario_por_periodos),
          );
          if (cleaned.length > 0) {
            Object.assign(
              newPayload,
              mergePiscinaHorarioFirmaEnPayload(newPayload, cleaned),
            );
          }
        }
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
    let signedFilename: string | null = null;
    let storageKey: string | null = null;
    let storageBucket: string | null = null;
    let tamanoBytes: number | null = null;
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
        forma_pago:
          body.forma_pago === 'transferencia' ||
          body.forma_pago === 'domiciliacion'
            ? body.forma_pago
            : undefined,
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
      const fileName = `presupuesto-${presupuestoId}-firmado-${Date.now()}.pdf`;
      signedFilename = fileName;

      if (this.presupuestosFirmasStorage.isWriteEnabled()) {
        try {
          const put = await this.presupuestosFirmasStorage.putFirmaPdf(
            pdfBuffer,
            presupuestoId,
            fileName,
          );
          storageKey = put.storage_key;
          storageBucket = put.storage_bucket;
          tamanoBytes = put.tamano_bytes;
          this.logger.log(
            `PDF presupuesto firmado en R2: ${pdfBuffer.length} bytes, key=${put.storage_key}; original_sha256=${originalPdfSha256.slice(0, 16)}..., signed_sha256=${signedPdfSha256.slice(0, 16)}...`,
          );
        } catch (r2Err: any) {
          this.logger.warn(
            'R2 put falló para presupuesto firmado; fallback a disco/LONGBLOB: ' +
              (r2Err?.message || r2Err),
          );
        }
      }

      if (!storageKey) {
        const dir = path.join(process.cwd(), 'uploads', 'presupuestos-firmas');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);
        pdfPath = `uploads/presupuestos-firmas/${fileName}`;
        this.logger.log(
          `PDF presupuesto con firma generado: ${pdfBuffer.length} bytes, guardado en ${fileName}; original_sha256=${originalPdfSha256.slice(0, 16)}..., signed_sha256=${signedPdfSha256.slice(0, 16)}...`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        'No se pudo generar o guardar el PDF de aceptación',
        err?.message || err,
      );
    }

    let firmaImagenStorageKey: string | null = null;
    const imgBuf = this.presupuestosFirmasStorage.parseFirmaImagenBase64(
      body.firma_base64,
    );
    if (imgBuf) {
      if (!this.presupuestosFirmasStorage.isWriteEnabled()) {
        throw new BadRequestException(
          'R2 no está habilitado; no se puede guardar la imagen de firma',
        );
      }
      const imgPut = await this.presupuestosFirmasStorage.putFirmaImagenPng(
        imgBuf,
        presupuestoId,
      );
      firmaImagenStorageKey = imgPut.storage_key;
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
        firma_imagen_storage_key: firmaImagenStorageKey,
        ip: ip || null,
        user_agent: userAgent || null,
        pdf_path: pdfPath,
        // Prefer R2: skip LONGBLOB when storage_key is set
        pdf_content:
          !storageKey && pdfBuffer && pdfBuffer.length > 0
            ? pdfBuffer
            : undefined,
        storage_key: storageKey,
        storage_bucket: storageBucket,
        tamano_bytes: tamanoBytes,
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
          {
            record: {
              senderId: 'sistema',
              recipientType: 'cliente',
              recipientName: (body.nombre_representante || '').trim() || 'Cliente',
              attachmentNote: `Adjunto: ${fileName}`,
            },
          },
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
      filename: signedFilename,
      pdf_base64: pdfBuffer?.length ? pdfBuffer.toString('base64') : null,
    };
  }

  /** Firma de un presupuesto V2. El PDF queda en v2_presupuesto_documentos. */
  private async firmadoV2(
    presupuestoId: number,
    body: PresupuestoFirmadoDto,
    ip: string,
    userAgent: string,
  ) {
    const result = await this.pdfV2.generarYGuardarFirmado(
      presupuestoId,
      body as unknown as Record<string, any>,
      { ip, userAgent },
    );
    const emailCliente = (body.email || '').trim();
    let emailEnviado = false;
    if (result.buffer?.length && emailCliente) {
      try {
        const nombre = (body.nombre_representante || '').trim() || 'cliente';
        const subject = `Aceptación de presupuesto nº ${result.numero} - ${result.companyName}`;
        const html = `
          <p>Estimado/a ${nombre},</p>
          <p>Adjuntamos el documento de aceptación del presupuesto nº <strong>${result.numero}</strong>, firmado electrónicamente.</p>
          <p>Puede conservar este PDF como comprobante.</p>
          <p>Saludos cordiales,<br/><strong>${result.companyName}</strong></p>
        `;
        await this.emailService.sendEmailWithAttachment(
          emailCliente,
          subject,
          html,
          result.buffer,
          result.filename,
          {
            record: {
              senderId: 'sistema',
              recipientType: 'cliente',
              recipientName: nombre,
              attachmentNote: `Adjunto: ${result.filename}`,
            },
          },
        );
        emailEnviado = true;
      } catch (err: any) {
        this.logger.warn(
          'No se pudo enviar el PDF firmado V2: ' + (err?.message || String(err)),
        );
      }
    }
    return {
      success: true,
      message: 'Firma registrada correctamente',
      quotation_id: presupuestoId,
      email_enviado: emailEnviado,
      filename: result.filename,
      pdf_base64: result.buffer?.length ? result.buffer.toString('base64') : null,
    };
  }
}
