import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  resolveClienteEfectivo,
  ClienteOverrides,
  ClienteWorking,
} from '../emit/cliente.util';
import { computeDocumentTotales } from '../emit/totales.util';
import { normalizeContenidoComercial } from '../config/config-catalog';
import {
  digitalesFromBrandConfig,
  resolveAllDigitales,
} from '../emit/digitales.util';
import {
  applyDescuentoFidelidadToTotales,
  clampDescuentoFidelidadPct,
} from '../emit/descuento-fidelidad.util';
import { PresupuestosV2StorageService } from './presupuestos-v2-storage.service';
import {
  DatosFirmaAceptacion,
  PresupuestoDocumentoService,
  expandOfertaInvernalPiscinaDesdePayload,
} from '../../services/presupuesto-documento.service';
import { clampPresupuestoDescuentoGlobalPct } from '../../utils/presupuesto-descuento-pct';
import {
  ibanEnGrupos,
  normalizeCuentasCobro,
} from '../emit/cuentas-cobro.util';

/** Stored in document metadata / audit only — never printed on client PDF. */
const TEMPLATE_VERSION = 'v2-pdf-8';
/** Legacy presupuesto commercial validity (hardcoded 60 in Legacy PDF). */
const DEFAULT_VALIDEZ_DIAS = 60;

type AuthUser = { CODIGO?: string; codigo?: string };

function resolveValidezDias(
  brandLike: Record<string, any> | null | undefined,
): number {
  const cfg = (brandLike?.config || brandLike?.config_json || {}) as Record<
    string,
    unknown
  >;
  const raw = cfg.validez_dias ?? cfg.validezDias;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_VALIDEZ_DIAS;
}

@Injectable()
export class PresupuestosV2PdfService {
  private readonly logger = new Logger(PresupuestosV2PdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PresupuestosV2StorageService,
    private readonly plantillaV1: PresupuestoDocumentoService,
  ) {}

  private actor(user: AuthUser | null): string | null {
    const c = user?.CODIGO ?? user?.codigo;
    return c != null ? String(c) : null;
  }

  private async attachLogoBuffer(payload: any): Promise<any> {
    const ref = payload?.brand?.logo_ref || payload?.company?.logo_ref || null;
    if (!ref || typeof ref !== 'string') return payload;
    // R2 keys from uploadBrandLogo use domain "v2-brands" or multi-segment paths.
    const looksLikeR2Key =
      ref.includes('v2-brands') ||
      (ref.includes('/') &&
        !ref.startsWith('assets/') &&
        !/^[a-zA-Z]:\\/.test(ref) &&
        !ref.startsWith('./'));
    if (!looksLikeR2Key) return payload;
    const buf = await this.storage.getObjectBuffer(ref);
    if (buf) return { ...payload, logoBuffer: buf };
    return payload;
  }

  private async audit(
    presupuestoId: number,
    eventType: string,
    payload: unknown,
    actor: string | null,
  ) {
    await this.prisma.v2PresupuestoAudit.create({
      data: {
        presupuesto_id: presupuestoId,
        event_type: eventType,
        payload_json:
          payload == null
            ? Prisma.JsonNull
            : (payload as Prisma.InputJsonValue),
        actor,
      },
    });
  }

  private normalizeLineaPdf(l: any) {
    const opcionesSrc =
      Array.isArray(l.opciones) && l.opciones.length > 0 ? l.opciones : null;
    const opciones = opcionesSrc
      ? opcionesSrc.map((o: any) => ({
          etiqueta: o.etiqueta || 'Opción',
          seleccion_tipo: o.seleccion_tipo || 'ACUMULABLE',
          descripcion_local: o.descripcion_local || null,
          jornada: o.jornada || o.jornada_json || null,
          inputs: o.inputs || o.inputs_json || {},
          totales:
            o.resultado?.totales ||
            o.totales ||
            (o.resultado_json as any)?.totales,
          resultado: o.resultado || o.resultado_json,
        }))
      : [
          {
            etiqueta: 'Opción única',
            seleccion_tipo: 'ACUMULABLE',
            descripcion_local: null,
            jornada: null,
            inputs: l.inputs || l.inputs_json || {},
            totales:
              l.resultado?.totales ||
              l.totales ||
              (l.resultado_json as any)?.totales,
            resultado: l.resultado || l.resultado_json,
          },
        ];

    const rawCc = l.contenido_comercial || l.contenido_comercial_json || null;
    return {
      nombre: l.nombre,
      descripcion: l.descripcion,
      codigo_motor: l.codigo_motor,
      inputs: opciones[0]?.inputs || l.inputs || {},
      contenido_comercial: normalizeContenidoComercial(rawCc, l.nombre),
      totales: opciones.length === 1 ? opciones[0].totales : undefined,
      resultado: opciones.length === 1 ? opciones[0].resultado : l.resultado,
      opciones,
    };
  }

  private buildPayloadFromEmitido(p: any) {
    const economico = (p.snapshot_economico_json || {}) as any;
    const lineas = (economico.lineas || []).map((l: any) =>
      this.normalizeLineaPdf(l),
    );
    const docTot =
      economico.totales_documento ||
      computeDocumentTotales(
        lineas.map((l: any) => ({
          nombre: l.nombre,
          opciones: l.opciones,
        })),
      );
    const totales =
      economico.totales_documento?.totales_sin_alternativas ||
      p.totales_emitidos_json ||
      economico.totales ||
      docTot.totales_sin_alternativas;

    const brand = (p.snapshot_brand_json || {}) as any;
    const digitales = resolveAllDigitales(
      p.snapshot_servicios_digitales_json ||
        economico.servicios_digitales ||
        [],
    );
    const dtoPct = clampDescuentoFidelidadPct(
      economico.descuento_fidelidad_pct ??
        p.descuento_fidelidad_pct ??
        (p.totales_emitidos_json as any)?.descuento_fidelidad_pct,
    );
    const brutoSnap =
      economico.totales_brutos ||
      economico.totales_documento?.totales_brutos_sin_alternativas ||
      (p.totales_emitidos_json as any)?.totales_brutos ||
      null;
    // Snapshot stores neto in totales*; prefer bruto for re-derive, else trust snapshot neto.
    let neto = totales as any;
    let brutosShown = null as any;
    if (dtoPct > 0 && brutoSnap) {
      const applied = applyDescuentoFidelidadToTotales(brutoSnap, dtoPct);
      neto = applied.neto;
      brutosShown = applied.bruto;
    } else if (dtoPct > 0 && !brutoSnap) {
      // Old emit without bruto snapshot: do not double-apply if totales already neto.
      // Treat stored totales as neto and skip footer bruto note.
      neto = totales as any;
      brutosShown = null;
    } else {
      neto = totales as any;
    }
    return {
      mode: 'EMITIDO' as const,
      numero: p.numero,
      emittedAt: p.emitted_at ? new Date(p.emitted_at).toISOString() : null,
      validezDias: resolveValidezDias(brand),
      company: (p.snapshot_company_json || {}) as any,
      brand,
      cliente: (p.snapshot_cliente_json || null) as any,
      lineas,
      totales: neto,
      totalesBrutos: brutosShown,
      descuentoFidelidadPct: dtoPct,
      totalesAmbiguo: Boolean(
        economico.totales_documento?.ambiguo ?? docTot.ambiguo,
      ),
      serviciosDigitales: digitales,
    };
  }

  private async buildPayloadFromBorrador(p: any) {
    const working = (p.cliente_working_json as ClienteWorking) || null;
    const overrides = (p.cliente_overrides_json as ClienteOverrides) || null;
    const cliente = resolveClienteEfectivo(working, overrides);

    const lineas = (p.servicios || []).map((s: any) => {
      const svc = s.servicio || {};
      const ops = (s.opciones || []).map((o: any) => ({
        etiqueta: o.etiqueta,
        seleccion_tipo: o.seleccion_tipo,
        descripcion_local: o.descripcion_local,
        jornada: o.jornada_json,
        inputs: o.inputs_json || {},
        totales: (o.resultado_json as any)?.totales,
        resultado: o.resultado_json,
      }));
      return this.normalizeLineaPdf({
        nombre: svc.nombre || s.nombre,
        descripcion: svc.descripcion || null,
        codigo_motor: s.codigo_motor || svc.codigo_motor,
        inputs: s.inputs_json || {},
        contenido_comercial:
          s.contenido_comercial_json ?? svc.contenido_comercial_json ?? null,
        totales: (s.resultado_json as any)?.totales,
        resultado: s.resultado_json,
        opciones: ops.length ? ops : undefined,
      });
    });
    const docTot = computeDocumentTotales(
      lineas.map((l: any) => ({
        nombre: l.nombre,
        opciones: l.opciones,
      })),
    );

    const fiscales = (p.company?.datos_fiscales_json || {}) as Record<
      string,
      any
    >;
    const brand = {
      brand_id: p.brand?.id,
      codigo: p.brand?.codigo,
      nombre: p.brand?.nombre,
      logo_ref: p.brand?.logo_ref,
      config: p.brand?.config_json,
    };
    const digitales = resolveAllDigitales(
      p.servicios_digitales_json ??
        digitalesFromBrandConfig(p.brand?.config_json),
    );
    const dtoPct = clampDescuentoFidelidadPct(p.descuento_fidelidad_pct);
    const applied = applyDescuentoFidelidadToTotales(
      docTot.totales_sin_alternativas,
      dtoPct,
    );
    return {
      mode: 'BORRADOR' as const,
      numero: null,
      emittedAt: null,
      validezDias: resolveValidezDias(brand),
      company: {
        company_id: p.company?.id,
        codigo: p.company?.codigo,
        legal_name: p.company?.legal_name,
        cif: p.company?.cif,
        direccion_fiscal: p.company?.direccion_fiscal,
        logo_ref: p.company?.logo_ref || p.brand?.logo_ref,
        phone: fiscales.telefono || fiscales.phone || null,
        email: fiscales.email || null,
        website: fiscales.web || fiscales.website || null,
        datos_fiscales: p.company?.datos_fiscales_json,
      },
      brand,
      cliente,
      lineas,
      totales: applied.neto,
      totalesBrutos: dtoPct > 0 ? applied.bruto : null,
      descuentoFidelidadPct: dtoPct,
      totalesAmbiguo: docTot.ambiguo,
      serviciosDigitales: digitales,
    };
  }

  /** Portada, índice y resto de páginas: la plantilla de Presupuestos v1. */
  private async renderPlantillaV1(
    v2: any,
    row: any,
    extra?: {
      datosFirma?: DatosFirmaAceptacion;
      evidencias?: {
        original_pdf_sha256: string;
        original_pdf_size_bytes: number;
        signed_pdf_sha256?: string;
        signed_pdf_size_bytes?: number;
      };
      payload?: Record<string, unknown>;
    },
  ): Promise<Buffer> {
    const cliente = v2.cliente || {};
    const companyCodigo = String(
      v2.company?.codigo || row?.company?.codigo || '',
    ).toLowerCase();
    const companyKey = companyCodigo.includes('hera') ? 'hera' : 'decamino';
    const numero =
      v2.mode === 'EMITIDO' && v2.numero
        ? String(v2.numero)
        : 'BORRADOR';
    const { buffer } = await this.plantillaV1.generarPdf(Number(row?.id) || 0, {
      companyKey,
      enlaceFirma: 'v2',
      datosFirma: extra?.datosFirma,
      evidencias: extra?.evidencias,
      virtual: {
        numero,
        cliente_nombre: String(cliente.nombre || 'Cliente'),
        cliente_id: null,
        nombre: String(cliente.nombre || 'Presupuesto'),
        created_at: row?.created_at || v2.emittedAt || new Date(),
        payload: extra?.payload || this.toLegacyPayload(v2),
      },
    });
    return buffer;
  }

  private toLegacyPayload(v2: any): Record<string, unknown> {
    const selected: Array<{ nombre: string }> = [];
    const oferta: Array<Record<string, unknown>> = [];
    const aux: Record<string, unknown>[] = [];
    const limp: Record<string, unknown>[] = [];
    const jardin: Record<string, unknown>[] = [];
    const cubos: Record<string, unknown>[] = [];
    const piscina: Record<string, unknown>[] = [];
    const garaje: Record<string, unknown>[] = [];

    const pushCalc = (tipo: string, inputs: Record<string, unknown>) => {
      if (tipo === 'limpieza') limp.push(inputs);
      else if (tipo === 'jardineria') jardin.push(inputs);
      else if (tipo === 'cubos') cubos.push(inputs);
      else if (tipo === 'piscina') piscina.push(inputs);
      else if (tipo === 'garaje') garaje.push(inputs);
      else aux.push(inputs);
    };

    for (const line of v2.lineas || []) {
      const tipo = this.tipoServicio(line);
      const nombre = this.nombreServicioLegacy(tipo, line?.nombre);
      const opciones = Array.isArray(line.opciones) && line.opciones.length
        ? line.opciones
        : [line];
      opciones.forEach((op: any, idx: number) => {
        selected.push({ nombre });
        const tot = op.totales || op.resultado?.totales || {};
        const etiqueta =
          opciones.length > 1 && op.etiqueta
            ? `${nombre} — ${op.etiqueta}`
            : nombre;
        oferta.push({
          descripcion: etiqueta,
          mensualidadSinIva: Number(tot.mensualidad_sin_iva) || 0,
          mensualidadConIva: Number(tot.mensualidad_con_iva) || 0,
          anualidadSinIva: Number(tot.anualidad_sin_iva) || 0,
          anualidadConIva: Number(tot.anualidad_con_iva) || 0,
          tipoOferta: tipo,
        });
        pushCalc(tipo, (op.inputs || line.inputs || {}) as Record<string, unknown>);
        void idx;
      });
    }

    const c = v2.cliente || {};
    const contenidoComercialV2 = (v2.lineas || []).map((line: any) => ({
      tipo: this.tipoServicio(line),
      titulo:
        line?.contenido_comercial?.titulo_comercial ||
        line?.nombre ||
        'Servicio',
      contenido: line?.contenido_comercial || {},
    }));
    return {
      selectedServiciosPresupuesto: selected,
      ofertaEconomica: oferta,
      presupuestoDescuentoGlobalPct: v2.descuentoFidelidadPct || 0,
      presupuestoCalculo: aux[0] || {},
      presupuestoCalculoAuxiliaresRest: aux.slice(1),
      presupuestoCalculoLimpieza: limp[0] || {},
      presupuestoCalculoLimpiezaRest: limp.slice(1),
      presupuestoCalculoJardineria: jardin[0] || {},
      presupuestoCalculoJardineriaRest: jardin.slice(1),
      presupuestoCalculoCubos: cubos[0] || {},
      presupuestoCalculoCubosRest: cubos.slice(1),
      presupuestoCalculoPiscina: piscina[0] || {},
      presupuestoCalculoPiscinaRest: piscina.slice(1),
      presupuestoCalculoGaraje: garaje[0] || {},
      presupuestoCalculoGarajeRest: garaje.slice(1),
      presupuestoClienteDireccion:
        c.direccion_servicio || c.direccion || '',
      presupuestoClienteCodigoPostal: c.codigo_postal || '',
      presupuestoClientePoblacion: c.poblacion || '',
      presupuestoClienteProvincia: c.provincia || '',
      presupuestoClienteNif: c.nif || '',
      contenidoComercialV2,
      ...(Array.isArray(c.condiciones_economicas)
        ? { condicionesEconomicasOferta: c.condiciones_economicas }
        : {}),
    };
  }

  private tipoServicio(line: any): string {
    const motor = String(line?.codigo_motor || '');
    const nombre = String(line?.nombre || '').toLowerCase();
    if (motor === 'limpieza_coste' || /limpieza/.test(nombre)) {
      if (/garaje/.test(nombre)) return 'garaje';
      return 'limpieza';
    }
    if (motor === 'piscina' || /piscina/.test(nombre)) return 'piscina';
    if (/garaje/.test(nombre)) return 'garaje';
    if (/jardin/.test(nombre)) return 'jardineria';
    if (/cubos|basura/.test(nombre)) return 'cubos';
    if (motor === 'auxiliares_coste') return 'auxiliares';
    return 'auxiliares';
  }

  private nombreServicioLegacy(tipo: string, nombre: unknown): string {
    const raw = String(nombre || '').trim();
    if (tipo === 'limpieza') return raw || 'LIMPIEZA';
    if (tipo === 'piscina') return raw || 'PISCINA';
    if (tipo === 'jardineria') return raw || 'JARDINERÍA';
    if (tipo === 'cubos') return raw || 'GESTIÓN CUBOS DE BASURA';
    if (tipo === 'garaje') return raw || 'LIMPIEZA DE GARAJES';
    return raw || 'AUXILIARES DE SERVICIOS';
  }

  async generatePreviewPdf(user: AuthUser, presupuestoId: number) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
      include: {
        company: true,
        brand: true,
        servicios: {
          orderBy: { orden: 'asc' },
          include: {
            servicio: true,
            opciones: { where: { activo: true }, orderBy: { orden: 'asc' } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (p.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Use el endpoint PDF oficial para presupuestos EMITIDOS',
      );
    }

    const payload = await this.attachLogoBuffer(
      await this.buildPayloadFromBorrador(p),
    );
    const buffer = await this.renderPlantillaV1(payload, p);
    const sha = this.storage.sha256(buffer);
    const filename = `borrador-${presupuestoId}.pdf`;
    const actor = this.actor(user);

    let stored: {
      storage_key: string | null;
      storage_bucket: string | null;
    } = { storage_key: null, storage_bucket: null };

    if (this.storage.isEnabled()) {
      try {
        const put = await this.storage.putPdf({
          presupuestoId,
          buffer,
          filename,
          kind: 'borrador',
        });
        stored = {
          storage_key: put.storage_key,
          storage_bucket: put.storage_bucket,
        };
        await this.prisma.v2PresupuestoDocumento.create({
          data: {
            presupuesto_id: presupuestoId,
            tipo: 'BORRADOR_PREVIEW',
            version: 1,
            es_oficial: false,
            storage_key: put.storage_key,
            storage_bucket: put.storage_bucket,
            sha256: put.sha256,
            size_bytes: put.size_bytes,
            filename,
            template_version: TEMPLATE_VERSION,
            created_by: actor,
          },
        });
      } catch (e: any) {
        await this.audit(
          presupuestoId,
          'pdf_storage_failed',
          { mode: 'BORRADOR', error: e?.message || String(e) },
          actor,
        );
      }
    }

    await this.audit(
      presupuestoId,
      'draft_pdf_generated',
      { sha256: sha, size: buffer.length, stored: Boolean(stored.storage_key) },
      actor,
    );

    return { buffer, filename, sha256: sha, contentType: 'application/pdf' };
  }

  async getOrCreateEmitidoPdf(
    user: AuthUser,
    presupuestoId: number,
    opts: { forceNewVersion?: boolean } = {},
  ) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (p.estado === 'BORRADOR') {
      throw new BadRequestException(
        'Solo presupuestos emitidos tienen PDF oficial',
      );
    }
    if (!p.snapshot_economico_json || !p.snapshot_cliente_json) {
      throw new BadRequestException(
        'Faltan snapshots para generar el PDF oficial',
      );
    }

    const actor = this.actor(user);

    let templateStale = false;
    if (!opts.forceNewVersion) {
      const firmado = await this.prisma.v2PresupuestoDocumento.findFirst({
        where: { presupuesto_id: presupuestoId, tipo: 'FIRMADO' },
        orderBy: { id: 'desc' },
      });
      if (firmado?.storage_key && this.storage.isEnabled()) {
        try {
          const buffer = await this.storage.getPdf(firmado.storage_key);
          return {
            buffer,
            filename: firmado.filename,
            sha256: firmado.sha256,
            contentType: firmado.content_type,
            from_storage: true,
            documento_id: firmado.id,
          };
        } catch (e: any) {
          this.logger.warn(
            `PDF firmado no disponible, se usa el oficial: ${e?.message}`,
          );
        }
      }

      const existing = await this.prisma.v2PresupuestoDocumento.findFirst({
        where: {
          presupuesto_id: presupuestoId,
          tipo: 'EMITIDO_OFICIAL',
          es_oficial: true,
        },
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
      });
      templateStale = Boolean(
        existing && existing.template_version !== TEMPLATE_VERSION,
      );
      if (
        existing?.storage_key &&
        this.storage.isEnabled() &&
        existing.template_version === TEMPLATE_VERSION
      ) {
        try {
          const buffer = await this.storage.getPdf(existing.storage_key);
          await this.audit(
            presupuestoId,
            'pdf_downloaded',
            { documento_id: existing.id, sha256: existing.sha256 },
            actor,
          );
          return {
            buffer,
            filename: existing.filename,
            sha256: existing.sha256,
            contentType: existing.content_type,
            from_storage: true,
            documento_id: existing.id,
          };
        } catch (e: any) {
          this.logger.warn(
            `Stored PDF missing, will regenerate from snapshot: ${e?.message}`,
          );
        }
      }
    }

    // Generate strictly from snapshots (never re-read live brand logo for stored docs;
    // logo_ref inside snapshot_brand_json is frozen; only fetch that key's bytes).
    const payload = await this.attachLogoBuffer(
      this.buildPayloadFromEmitido(p),
    );
    const buffer = await this.renderPlantillaV1(payload, p);
    const sha = this.storage.sha256(buffer);
    const filename = `${p.numero || `emitido-${presupuestoId}`}.pdf`.replace(
      /[^\w.-]+/g,
      '_',
    );

    const last = await this.prisma.v2PresupuestoDocumento.findFirst({
      where: { presupuesto_id: presupuestoId, tipo: 'EMITIDO_OFICIAL' },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version || 0) + 1;

    let storage_key: string | null = null;
    let storage_bucket: string | null = null;

    if (this.storage.isEnabled()) {
      try {
        // Mark previous official as non-primary if regenerating admin version
        if (opts.forceNewVersion || templateStale) {
          await this.prisma.v2PresupuestoDocumento.updateMany({
            where: {
              presupuesto_id: presupuestoId,
              tipo: 'EMITIDO_OFICIAL',
              es_oficial: true,
            },
            data: { es_oficial: false },
          });
        }
        const put = await this.storage.putPdf({
          presupuestoId,
          buffer,
          filename,
          kind: 'emitido',
        });
        storage_key = put.storage_key;
        storage_bucket = put.storage_bucket;
      } catch (e: any) {
        await this.audit(
          presupuestoId,
          'pdf_storage_failed',
          { mode: 'EMITIDO', error: e?.message || String(e) },
          actor,
        );
      }
    }

    // Avoid unique sha collision on identical regen
    const dup = await this.prisma.v2PresupuestoDocumento.findFirst({
      where: { presupuesto_id: presupuestoId, sha256: sha },
    });
    let docRow = dup;
    if (!dup) {
      docRow = await this.prisma.v2PresupuestoDocumento.create({
        data: {
          presupuesto_id: presupuestoId,
          tipo: 'EMITIDO_OFICIAL',
          version: nextVersion,
          es_oficial: true,
          storage_key,
          storage_bucket,
          sha256: sha,
          size_bytes: buffer.length,
          filename,
          numero_presupuesto: p.numero,
          template_version: TEMPLATE_VERSION,
          created_by: actor,
        },
      });
    } else if (storage_key && !dup.storage_key) {
      docRow = await this.prisma.v2PresupuestoDocumento.update({
        where: { id: dup.id },
        data: {
          storage_key,
          storage_bucket,
          es_oficial: true,
        },
      });
    }

    await this.audit(
      presupuestoId,
      opts.forceNewVersion ? 'pdf_regenerated_admin' : 'emitted_pdf_generated',
      {
        documento_id: docRow?.id,
        sha256: sha,
        size: buffer.length,
        stored: Boolean(storage_key),
        version: nextVersion,
      },
      actor,
    );

    return {
      buffer,
      filename,
      sha256: sha,
      contentType: 'application/pdf',
      from_storage: false,
      documento_id: docRow?.id,
    };
  }

  /** Datos públicos para firmar.html. Solo presupuestos V2 emitidos. */
  async datosFirmaPublicos(id: number) {
    const p = await this.prisma.v2Presupuesto.findUnique({ where: { id } });
    if (!p || p.estado === 'BORRADOR') {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    const firma = await this.prisma.v2PresupuestoDocumento.findFirst({
      where: { presupuesto_id: id, tipo: 'FIRMADO' },
      select: { id: true },
    });
    const rechazo = rechazoGuardado(p);
    const yaFirmado = p.estado === 'FIRMADO' || Boolean(firma);
    const v2 = this.buildPayloadFromEmitido(p);
    const legacy = this.toLegacyPayload(v2);
    const cliente = (v2.cliente || {}) as Record<string, unknown>;

    let cif =
      cliente.nif != null ? String(cliente.nif).trim() || null : null;
    let iban: string | null = null;
    if (p.cliente_id != null) {
      const row = await this.prisma.clientes.findUnique({
        where: { id: p.cliente_id },
        select: { NIF: true, CUENTAS_BANCARIAS: true },
      });
      if (!cif && row?.NIF != null) cif = String(row.NIF).trim() || null;
      if (row?.CUENTAS_BANCARIAS != null) {
        const raw = String(row.CUENTAS_BANCARIAS).trim();
        iban = raw ? raw.split(/\r?\n/)[0]?.trim() || raw : null;
      }
    }

    const parts: string[] = [];
    const dir = String(legacy.presupuestoClienteDireccion || '').trim();
    if (dir) parts.push(dir);
    const cp = String(legacy.presupuestoClienteCodigoPostal || '').trim();
    const pob = String(legacy.presupuestoClientePoblacion || '').trim();
    if (cp || pob) parts.push([cp, pob].filter(Boolean).join(' '));
    const prov = String(legacy.presupuestoClienteProvincia || '').trim();
    if (prov) parts.push(prov);

    const raw = Array.isArray(legacy.ofertaEconomica)
      ? legacy.ofertaEconomica
      : [];
    let oferta = raw.map((row: any) => ({
      descripcion:
        row?.descripcion != null ? String(row.descripcion).trim() : '',
      mensualidadSinIva: Number(row?.mensualidadSinIva) || 0,
      mensualidadConIva: Number(row?.mensualidadConIva) || 0,
      anualidadSinIva: Number(row?.anualidadSinIva) || 0,
      anualidadConIva: Number(row?.anualidadConIva) || 0,
    }));
    oferta = expandOfertaInvernalPiscinaDesdePayload(oferta, legacy);
    const esSoloPiscina =
      oferta.length > 0 &&
      oferta.every((r) => /piscina/i.test(r.descripcion));
    const tienePiscina = oferta.some((r) => {
      const d = r.descripcion.toLowerCase();
      if (d.includes('invernal')) return false;
      if (d.includes('recuperación') || d.includes('recuperacion')) return false;
      return d.includes('piscina') || d.includes('verano');
    });

    return {
      numero_presupuesto: p.numero || String(id),
      cliente_nombre: cliente.nombre ? String(cliente.nombre).trim() : null,
      cif,
      direccion: parts.length ? parts.join(', ') : null,
      iban,
      oferta_economica: oferta.length ? oferta : null,
      es_solo_piscina: oferta.length ? esSoloPiscina : null,
      recuperacion_agua_precio: 650,
      presupuesto_descuento_global_pct: clampPresupuestoDescuentoGlobalPct(
        legacy.presupuestoDescuentoGlobalPct,
      ),
      piscina_horarios_firma: tienePiscina
        ? horariosPiscinaDesdePayload(legacy)
        : null,
      cuenta_transferencia: cuentaTransferenciaDe(p),
      ya_firmado: yaFirmado,
      puede_rechazar: !yaFirmado && p.estado !== 'RECHAZADO',
      rechazo,
    };
  }

  /**
   * El cliente rechaza la oferta. No modifica el PDF enviado y cierra la firma.
   */
  async rechazarOferta(
    id: number,
    motivoRaw: string,
    meta: { ip: string; userAgent: string },
  ): Promise<{
    numero: string;
    companyName: string;
    notifyEmail: string;
    clienteNombre: string;
    motivo: string;
  }> {
    const motivo = String(motivoRaw || '').trim().slice(0, 2000);
    if (motivo.length < 3) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }
    const p = await this.prisma.v2Presupuesto.findUnique({ where: { id } });
    if (!p || p.estado === 'BORRADOR') {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    if (p.estado === 'FIRMADO') {
      throw new BadRequestException('Este presupuesto ya está firmado');
    }
    const firma = await this.prisma.v2PresupuestoDocumento.findFirst({
      where: { presupuesto_id: id, tipo: 'FIRMADO' },
      select: { id: true },
    });
    if (firma) {
      throw new BadRequestException('Este presupuesto ya está firmado');
    }
    if (p.estado === 'RECHAZADO') {
      throw new BadRequestException('Esta oferta ya fue rechazada');
    }
    const prev = (p.cliente_overrides_json || {}) as Record<string, unknown>;
    const rechazo = { motivo, at: new Date().toISOString() };
    await this.prisma.v2Presupuesto.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
        cliente_overrides_json: {
          ...prev,
          rechazo,
        } as Prisma.InputJsonValue,
      },
    });
    await this.audit(
      id,
      'oferta_rechazada',
      { motivo, ip: meta.ip, user_agent: meta.userAgent },
      'cliente',
    );
    const company = (p.snapshot_company_json || {}) as Record<string, unknown>;
    const cliente = (p.snapshot_cliente_json || {}) as Record<string, unknown>;
    let notifyEmail =
      typeof company.email === 'string' ? company.email.trim() : '';
    if (!notifyEmail && p.company_id) {
      const empresa = await this.prisma.v2Company.findUnique({
        where: { id: p.company_id },
        select: { datos_fiscales_json: true },
      });
      const fiscales = (empresa?.datos_fiscales_json || {}) as {
        email?: unknown;
      };
      notifyEmail =
        typeof fiscales.email === 'string' ? fiscales.email.trim() : '';
    }
    return {
      numero: p.numero || String(id),
      companyName: String(
        company.legal_name || 'De Camino Servicios Auxiliares S.L.',
      ),
      notifyEmail,
      clienteNombre:
        typeof cliente.nombre === 'string' ? cliente.nombre.trim() : '',
      motivo,
    };
  }

  /**
   * Genera el PDF firmado de un emitido V2 y lo guarda en v2_presupuesto_documentos.
   * No escribe en presupuestos_guardados ni en presupuestos_firmas.
   */
  async generarYGuardarFirmado(
    id: number,
    body: Record<string, any>,
    meta: { ip: string; userAgent: string },
  ): Promise<{ buffer: Buffer; filename: string; numero: string; companyName: string }> {
    const p = await this.prisma.v2Presupuesto.findUnique({ where: { id } });
    if (!p || p.estado === 'BORRADOR') {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    if (p.estado === 'RECHAZADO') {
      throw new BadRequestException('Esta oferta ya fue rechazada');
    }
    if (!p.snapshot_economico_json || !p.snapshot_cliente_json) {
      throw new BadRequestException('Faltan snapshots para generar el PDF firmado');
    }
    const v2 = await this.attachLogoBuffer(this.buildPayloadFromEmitido(p));
    let payload = this.toLegacyPayload(v2);
    const indices = Array.isArray(body.selected_oferta_indices)
      ? body.selected_oferta_indices.filter(
          (i: unknown) => typeof i === 'number' && i >= 0,
        )
      : undefined;
    if (indices) payload.selectedOfertaIndices = indices;
    if (body.selected_oferta_index !== undefined) {
      payload.selectedOfertaIndex = body.selected_oferta_index;
    }
    const direccion = String(body.direccion || '').trim();
    if (direccion) payload.presupuestoClienteDireccion = direccion;
    if (body.recuperacion_agua === true) payload.recuperacion_agua = true;
    if (
      Array.isArray(body.piscina_horario_firma) &&
      body.piscina_horario_firma.length > 0
    ) {
      payload = mergeHorarioPiscina(payload, body.piscina_horario_firma);
    }

    const formaPago =
      body.forma_pago === 'transferencia'
        ? 'transferencia'
        : body.forma_pago === 'domiciliacion' || String(body.iban || '').trim()
          ? 'domiciliacion'
          : '';
    const cuenta = cuentaTransferenciaDe(p);
    if (formaPago === 'transferencia' && !cuenta) {
      throw new BadRequestException(
        'Este presupuesto no tiene una cuenta para pago por transferencia',
      );
    }
    if (formaPago === 'domiciliacion' && !String(body.iban || '').trim()) {
      throw new BadRequestException(
        'El IBAN es obligatorio cuando el pago es por domiciliación',
      );
    }
    if (!formaPago) {
      throw new BadRequestException('Indica la forma de pago');
    }

    const original = await this.renderPlantillaV1(v2, p, { payload });
    const datosFirma: DatosFirmaAceptacion = {
      fecha_hora: String(body.fecha_hora || ''),
      nombre_representante: String(body.nombre_representante || '').trim(),
      cargo: String(body.cargo || '').trim() || undefined,
      nombre_comunidad: String(body.nombre_comunidad || '').trim(),
      firma_base64: String(body.firma_base64 || ''),
      direccion: direccion || undefined,
      cif: String(body.cif || '').trim() || undefined,
      iban:
        formaPago === 'domiciliacion'
          ? String(body.iban || '').trim() || undefined
          : undefined,
      forma_pago: formaPago,
      banco_cobro: formaPago === 'transferencia' ? cuenta?.banco : undefined,
      iban_cobro: formaPago === 'transferencia' ? cuenta?.iban : undefined,
      fecha_inicio_servicio:
        String(body.fecha_inicio_servicio || '').trim() || undefined,
      telefono: String(body.telefono || '').trim() || undefined,
      nombre_presidente: String(body.nombre_presidente || '').trim() || undefined,
      dni_presidente: String(body.dni_presidente || '').trim() || undefined,
      n_viviendas: String(body.n_viviendas || '').trim() || undefined,
      recogida_llaves: String(body.recogida_llaves || '').trim() || undefined,
    };
    const firmadoSin = await this.renderPlantillaV1(v2, p, {
      payload,
      datosFirma,
    });
    const buffer = await this.renderPlantillaV1(v2, p, {
      payload,
      datosFirma,
      evidencias: {
        original_pdf_sha256: this.storage.sha256(original),
        original_pdf_size_bytes: original.length,
        signed_pdf_sha256: this.storage.sha256(firmadoSin),
        signed_pdf_size_bytes: firmadoSin.length,
      },
    });

    const numero = p.numero || String(id);
    const filename = `presupuesto-${numero}-firmado.pdf`.replace(
      /[^\w.-]+/g,
      '_',
    );
    const sha = this.storage.sha256(buffer);
    const company = (p.snapshot_company_json || {}) as Record<string, unknown>;
    const companyName = String(
      company.legal_name || 'De Camino Servicios Auxiliares S.L.',
    );

    let storage_key: string | null = null;
    let storage_bucket: string | null = null;
    if (this.storage.isEnabled()) {
      try {
        const put = await this.storage.putPdf({
          presupuestoId: id,
          buffer,
          filename,
          kind: 'firmado',
        });
        storage_key = put.storage_key;
        storage_bucket = put.storage_bucket;
      } catch (e: any) {
        this.logger.warn(
          `No se pudo guardar el PDF firmado en almacenamiento: ${e?.message || e}`,
        );
      }
    }

    const dup = await this.prisma.v2PresupuestoDocumento.findFirst({
      where: { presupuesto_id: id, sha256: sha },
    });
    if (!dup) {
      const last = await this.prisma.v2PresupuestoDocumento.findFirst({
        where: { presupuesto_id: id, tipo: 'FIRMADO' },
        orderBy: { version: 'desc' },
      });
      await this.prisma.v2PresupuestoDocumento.create({
        data: {
          presupuesto_id: id,
          tipo: 'FIRMADO',
          version: (last?.version || 0) + 1,
          es_oficial: false,
          storage_key,
          storage_bucket,
          sha256: sha,
          size_bytes: buffer.length,
          filename,
          numero_presupuesto: p.numero,
          template_version: TEMPLATE_VERSION,
          created_by: 'cliente',
        },
      });
    }

    await this.audit(
      id,
      'firma_recibida',
      {
        sha256: sha,
        email: String(body.email || '').trim(),
        nombre_representante: datosFirma.nombre_representante,
        nombre_comunidad: datosFirma.nombre_comunidad,
        ip: meta.ip,
        user_agent: meta.userAgent,
        stored: Boolean(storage_key),
        forma_pago: formaPago,
      },
      'cliente',
    );
    if (p.estado !== 'FIRMADO') {
      await this.prisma.v2Presupuesto.update({
        where: { id },
        data: { estado: 'FIRMADO' },
      });
    }

    return { buffer, filename, numero, companyName };
  }
}

function rechazoGuardado(p: {
  estado: string;
  cliente_overrides_json?: unknown;
}): { motivo: string; at: string } | null {
  if (p.estado !== 'RECHAZADO') return null;
  const raw = (
    p.cliente_overrides_json as {
      rechazo?: { motivo?: unknown; at?: unknown };
    } | null
  )?.rechazo;
  const motivo = typeof raw?.motivo === 'string' ? raw.motivo.trim() : '';
  const at = typeof raw?.at === 'string' ? raw.at : '';
  return { motivo, at };
}

function cuentaTransferenciaDe(p: {
  cliente_overrides_json?: unknown;
}): { id: string; banco: string; iban: string } | null {
  const overrides = (p.cliente_overrides_json || {}) as {
    cuenta_cobro?: { id?: unknown; banco?: unknown; iban?: unknown };
  };
  const cuentas = normalizeCuentasCobro(
    overrides.cuenta_cobro ? [overrides.cuenta_cobro] : [],
  );
  const cuenta = cuentas[0];
  if (!cuenta) return null;
  return { ...cuenta, iban: ibanEnGrupos(cuenta.iban) };
}

function horariosPiscinaDesdePayload(payload: Record<string, unknown>) {
  const principal = (payload.presupuestoCalculoPiscina || {}) as Record<
    string,
    unknown
  >;
  const rest = (payload.presupuestoCalculoPiscinaRest || []) as Record<
    string,
    unknown
  >[];
  const out: { piscina_variant_index: number; horario_por_periodos: unknown[] }[] =
    [];
  const hp0 = principal.horarioPorPeriodos;
  if (Array.isArray(hp0) && hp0.length > 0) {
    out.push({ piscina_variant_index: 0, horario_por_periodos: hp0 });
  } else {
    out.push({ piscina_variant_index: 0, horario_por_periodos: [] });
  }
  rest.forEach((row, i) => {
    const hp = row?.horarioPorPeriodos;
    out.push({
      piscina_variant_index: i + 1,
      horario_por_periodos: Array.isArray(hp) ? hp : [],
    });
  });
  return out;
}

function mergeHorarioPiscina(
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
    ...((next.presupuestoCalculoPiscinaRest || []) as Record<string, unknown>[]),
  ];
  for (const entry of entries) {
    const vi = entry?.piscina_variant_index;
    const hp = entry?.horario_por_periodos;
    if (typeof vi !== 'number' || vi < 0 || !Array.isArray(hp)) continue;
    if (vi === 0) principal.horarioPorPeriodos = hp;
    else {
      while (rest.length < vi) rest.push({});
      rest[vi - 1] = { ...(rest[vi - 1] || {}), horarioPorPeriodos: hp };
    }
  }
  next.presupuestoCalculoPiscina = principal;
  next.presupuestoCalculoPiscinaRest = rest;
  return next;
}
