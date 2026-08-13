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
  normalizeServiciosDigitales,
} from '../emit/digitales.util';
import { buildPresupuestoV2Pdf } from './pdf-v2.builder';
import { PresupuestosV2StorageService } from './presupuestos-v2-storage.service';

/** Stored in document metadata / audit only — never printed on client PDF. */
const TEMPLATE_VERSION = 'v2-pdf-6';
/** Legacy presupuesto commercial validity (hardcoded 60 in Legacy PDF). */
const DEFAULT_VALIDEZ_DIAS = 60;

type AuthUser = { CODIGO?: string; codigo?: string };

function resolveValidezDias(brandLike: Record<string, any> | null | undefined): number {
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
  ) {}

  private actor(user: AuthUser | null): string | null {
    const c = user?.CODIGO ?? user?.codigo;
    return c != null ? String(c) : null;
  }

  private async attachLogoBuffer(payload: any): Promise<any> {
    const ref =
      payload?.brand?.logo_ref || payload?.company?.logo_ref || null;
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
      Array.isArray(l.opciones) && l.opciones.length > 0
        ? l.opciones
        : null;
    const opciones = opcionesSrc
      ? opcionesSrc.map((o: any) => ({
          etiqueta: o.etiqueta || 'Opción',
          seleccion_tipo: o.seleccion_tipo || 'ACUMULABLE',
          descripcion_local: o.descripcion_local || null,
          jornada: o.jornada || o.jornada_json || null,
          inputs: o.inputs || o.inputs_json || {},
          totales: o.resultado?.totales || o.totales || (o.resultado_json as any)?.totales,
          resultado: o.resultado || o.resultado_json,
        }))
      : [
          {
            etiqueta: 'Opción única',
            seleccion_tipo: 'ACUMULABLE',
            descripcion_local: null,
            jornada: null,
            inputs: l.inputs || l.inputs_json || {},
            totales: l.resultado?.totales || l.totales || (l.resultado_json as any)?.totales,
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
      (economico.totales_documento?.totales_sin_alternativas) ||
      p.totales_emitidos_json ||
      economico.totales ||
      docTot.totales_sin_alternativas;

    const brand = (p.snapshot_brand_json || {}) as any;
    const digitales = resolveAllDigitales(
      p.snapshot_servicios_digitales_json ||
        economico.servicios_digitales ||
        [],
    );
    return {
      mode: 'EMITIDO' as const,
      numero: p.numero,
      emittedAt: p.emitted_at ? new Date(p.emitted_at).toISOString() : null,
      validezDias: resolveValidezDias(brand),
      company: (p.snapshot_company_json || {}) as any,
      brand,
      cliente: (p.snapshot_cliente_json || null) as any,
      lineas,
      totales,
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
      totales: docTot.totales_sin_alternativas,
      totalesAmbiguo: docTot.ambiguo,
      serviciosDigitales: digitales,
    };
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
    const buffer = await buildPresupuestoV2Pdf(payload);
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
    if (p.estado !== 'EMITIDO') {
      throw new BadRequestException(
        'Solo presupuestos EMITIDOS tienen PDF oficial',
      );
    }
    if (!p.snapshot_economico_json || !p.snapshot_cliente_json) {
      throw new BadRequestException(
        'Faltan snapshots para generar el PDF oficial',
      );
    }

    const actor = this.actor(user);

    if (!opts.forceNewVersion) {
      const existing = await this.prisma.v2PresupuestoDocumento.findFirst({
        where: {
          presupuesto_id: presupuestoId,
          tipo: 'EMITIDO_OFICIAL',
          es_oficial: true,
        },
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
      });
      if (existing?.storage_key && this.storage.isEnabled()) {
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
    const payload = await this.attachLogoBuffer(this.buildPayloadFromEmitido(p));
    const buffer = await buildPresupuestoV2Pdf(payload);
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
        if (opts.forceNewVersion) {
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
}
