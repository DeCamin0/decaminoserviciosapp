import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { buildObjectKey } from '../../storage/object-key.util';
import { randomUUID } from 'crypto';
import { formatNumeroSerie } from '../emit/numero.util';
import {
  PARAM_CATALOG,
  catalogByClave,
  paramFromDisplay,
  paramToDisplay,
  unitSuffix,
  resolveSerieFormato,
  SERIE_FORMAT_PRESETS,
  normalizeContenidoComercial,
} from './config-catalog';

type AuthUser = {
  grupo?: string;
  GRUPO?: string;
  CODIGO?: string;
  codigo?: string;
};

@Injectable()
export class PresupuestosV2ConfigAdminService {
  private readonly logger = new Logger(PresupuestosV2ConfigAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private actor(user: AuthUser | null): string | null {
    const c = user?.CODIGO ?? user?.codigo;
    return c != null ? String(c) : null;
  }

  private grupo(user: AuthUser): string {
    return String(user?.grupo || user?.GRUPO || '').trim();
  }

  private isDeveloper(user: AuthUser): boolean {
    return this.grupo(user) === 'Developer';
  }

  async auditConfig(
    entityType: string,
    entityId: string | number,
    eventType: string,
    payload: unknown,
    actor: string | null,
  ) {
    await this.prisma.v2ConfigAudit.create({
      data: {
        entity_type: entityType,
        entity_id: String(entityId),
        event_type: eventType,
        payload_json:
          payload == null
            ? Prisma.JsonNull
            : (payload as Prisma.InputJsonValue),
        actor,
      },
    });
  }

  // ——— Parámetros ———
  async listParametros() {
    const rows = await this.prisma.v2ParametroCalculo.findMany({
      where: { activo: true },
    });
    const byKey = new Map(
      rows.map((r) => [`${r.ambito}|${r.motor_codigo}|${r.clave}`, r]),
    );

    return PARAM_CATALOG.filter((c) => c.adminEditable || c.clave === 'iva_factor').map(
      (cat) => {
        const row = byKey.get(
          `${cat.ambito}|${cat.motor_codigo}|${cat.clave}`,
        );
        const storedRaw = row?.valor_json;
        const stored =
          typeof storedRaw === 'number'
            ? storedRaw
            : Number(storedRaw);
        const value = Number.isFinite(stored) ? stored : 0;
        return {
          id: row?.id ?? null,
          clave: cat.clave,
          ambito: cat.ambito,
          motor_codigo: cat.motor_codigo,
          label: cat.label,
          helper: cat.helper,
          unit: cat.unit,
          unit_suffix: unitSuffix(cat.unit),
          group: cat.group,
          admin_editable: cat.adminEditable,
          valor_almacenado: value,
          valor_display: paramToDisplay(cat, value),
          updated_at: row?.updated_at ?? null,
        };
      },
    ).filter((p) => p.admin_editable);
  }

  async updateParametro(
    user: AuthUser,
    clave: string,
    valorDisplay: number,
  ) {
    const cat = catalogByClave(clave);
    if (!cat || !cat.adminEditable) {
      throw new BadRequestException('Parámetro no editable');
    }
    if (!Number.isFinite(Number(valorDisplay))) {
      throw new BadRequestException('Valor inválido');
    }
    const stored = paramFromDisplay(cat, Number(valorDisplay));
    const actor = this.actor(user);

    const existing = await this.prisma.v2ParametroCalculo.findFirst({
      where: {
        ambito: cat.ambito,
        motor_codigo: cat.motor_codigo,
        clave: cat.clave,
      },
    });
    const oldVal = existing ? Number(existing.valor_json as any) : null;

    const row = existing
      ? await this.prisma.v2ParametroCalculo.update({
          where: { id: existing.id },
          data: {
            valor_json: stored as unknown as Prisma.InputJsonValue,
            descripcion: cat.helper,
            activo: true,
          },
        })
      : await this.prisma.v2ParametroCalculo.create({
          data: {
            ambito: cat.ambito,
            motor_codigo: cat.motor_codigo,
            clave: cat.clave,
            valor_json: stored as unknown as Prisma.InputJsonValue,
            descripcion: cat.helper,
            activo: true,
          },
        });

    // Keep iva_factor in sync when IVA changes
    if (clave === 'iva_pct') {
      const factor = 1 + stored;
      const factorRow = await this.prisma.v2ParametroCalculo.findFirst({
        where: { ambito: 'global', motor_codigo: '', clave: 'iva_factor' },
      });
      if (factorRow) {
        await this.prisma.v2ParametroCalculo.update({
          where: { id: factorRow.id },
          data: {
            valor_json: factor as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await this.prisma.v2ParametroCalculo.create({
          data: {
            ambito: 'global',
            motor_codigo: '',
            clave: 'iva_factor',
            valor_json: factor as unknown as Prisma.InputJsonValue,
            descripcion: 'Factor IVA (1 + IVA)',
            activo: true,
          },
        });
      }
    }

    await this.auditConfig(
      'parametro',
      cat.clave,
      'param_updated',
      {
        clave: cat.clave,
        old: oldVal,
        new: stored,
        display_old:
          oldVal != null ? paramToDisplay(cat, oldVal) : null,
        display_new: paramToDisplay(cat, stored),
      },
      actor,
    );

    return {
      clave: cat.clave,
      valor_almacenado: stored,
      valor_display: paramToDisplay(cat, stored),
      id: row.id,
    };
  }

  async listParamAudit(clave?: string, limit = 50) {
    return this.prisma.v2ConfigAudit.findMany({
      where: {
        entity_type: 'parametro',
        ...(clave ? { entity_id: clave } : {}),
        event_type: 'param_updated',
      },
      orderBy: { created_at: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  // ——— Companies ———
  async listCompanies() {
    return this.prisma.v2Company.findMany({
      include: {
        brands: {
          where: { activo: true },
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async updateCompany(
    user: AuthUser,
    id: number,
    dto: {
      legal_name?: string;
      cif?: string | null;
      direccion_fiscal?: string | null;
      logo_ref?: string | null;
      activo?: boolean;
      datos_fiscales?: Record<string, unknown> | null;
    },
  ) {
    const existing = await this.prisma.v2Company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa no encontrada');
    const actor = this.actor(user);
    const prev = {
      legal_name: existing.legal_name,
      cif: existing.cif,
      direccion_fiscal: existing.direccion_fiscal,
      logo_ref: existing.logo_ref,
      datos_fiscales: existing.datos_fiscales_json,
    };
    const updated = await this.prisma.v2Company.update({
      where: { id },
      data: {
        ...(dto.legal_name !== undefined && {
          legal_name: String(dto.legal_name).trim(),
        }),
        ...(dto.cif !== undefined && { cif: dto.cif }),
        ...(dto.direccion_fiscal !== undefined && {
          direccion_fiscal: dto.direccion_fiscal,
        }),
        ...(dto.logo_ref !== undefined && { logo_ref: dto.logo_ref }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.datos_fiscales !== undefined && {
          datos_fiscales_json:
            dto.datos_fiscales === null
              ? Prisma.JsonNull
              : (dto.datos_fiscales as Prisma.InputJsonValue),
        }),
      },
    });
    await this.auditConfig(
      'company',
      id,
      'company_updated',
      { old: prev, new: dto },
      actor,
    );
    return updated;
  }

  // ——— Brands ———
  async updateBrand(
    user: AuthUser,
    id: number,
    dto: {
      nombre?: string;
      logo_ref?: string | null;
      activo?: boolean;
      config?: Record<string, unknown> | null;
    },
  ) {
    const existing = await this.prisma.v2Brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Marca no encontrada');
    const actor = this.actor(user);
    const prevConfig = existing.config_json;
    const updated = await this.prisma.v2Brand.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && {
          nombre: String(dto.nombre).trim(),
        }),
        ...(dto.logo_ref !== undefined && { logo_ref: dto.logo_ref }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.config !== undefined && {
          config_json:
            dto.config === null
              ? Prisma.JsonNull
              : (dto.config as Prisma.InputJsonValue),
        }),
      },
      include: {
        company: {
          select: {
            id: true,
            codigo: true,
            legal_name: true,
            cif: true,
          },
        },
        series: { where: { activo: true } },
      },
    });
    await this.auditConfig(
      'brand',
      id,
      'brand_updated',
      {
        old: { nombre: existing.nombre, logo_ref: existing.logo_ref, config: prevConfig },
        new: dto,
      },
      actor,
    );
    return updated;
  }

  async uploadBrandLogo(
    user: AuthUser,
    brandId: number,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!this.storage.isEnabled()) {
      throw new BadRequestException(
        'Almacenamiento R2 no habilitado. Puedes indicar una ruta/logo_ref manualmente.',
      );
    }
    const brand = await this.prisma.v2Brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      throw new BadRequestException('Formato de logo no soportado (png/jpg/webp)');
    }
    const key = buildObjectKey({
      app: 'decamino',
      tenant: 'decamino',
      domain: 'v2-brands',
      scopeId: String(brandId),
      originalName: file.originalname,
      ext,
      uuid: randomUUID(),
    });
    await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimetype || `image/${ext}`,
      metadata: { module: 'presupuestos-v2', brand_id: String(brandId) },
    });
    return this.updateBrand(user, brandId, { logo_ref: key });
  }

  // ——— Series ———
  listSeriePresets() {
    return SERIE_FORMAT_PRESETS.map((p) => ({
      id: p.id,
      label: p.label,
      formato: p.formato,
    }));
  }

  async updateSerie(
    user: AuthUser,
    id: number,
    dto: {
      prefijo?: string;
      formato_preset?: string;
      formato?: string;
      padding?: number;
      reset_anual?: boolean;
      activo?: boolean;
      siguiente_numero?: number;
      confirm_counter_change?: boolean;
    },
  ) {
    const existing = await this.prisma.v2SeriesNumeracion.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!existing) throw new NotFoundException('Serie no encontrada');
    const actor = this.actor(user);

    let formato = existing.formato;
    if (dto.formato_preset || dto.formato) {
      try {
        formato = resolveSerieFormato(
          String(dto.formato_preset || dto.formato),
        );
      } catch (e: any) {
        throw new BadRequestException(e.message || 'Formato inválido');
      }
    }

    const prefijo =
      dto.prefijo !== undefined
        ? String(dto.prefijo).trim().toUpperCase().slice(0, 16)
        : existing.prefijo;
    if (!prefijo) throw new BadRequestException('Prefijo requerido');

    const padding =
      dto.padding !== undefined
        ? Math.min(8, Math.max(1, Number(dto.padding) || 4))
        : existing.padding;

    let siguiente = existing.siguiente_numero;
    if (dto.siguiente_numero !== undefined) {
      if (!this.isDeveloper(user)) {
        throw new ForbiddenException(
          'Solo Developer puede ajustar el contador de numeración',
        );
      }
      const next = Math.floor(Number(dto.siguiente_numero));
      if (!Number.isFinite(next) || next < 1) {
        throw new BadRequestException('siguiente_numero inválido');
      }
      if (next < existing.siguiente_numero && !dto.confirm_counter_change) {
        throw new BadRequestException({
          code: 'COUNTER_DECREASE_CONFIRM',
          message:
            'Bajar el contador puede crear números duplicados. Confirma explícitamente.',
          actual: existing.siguiente_numero,
          solicitado: next,
        });
      }
      // Floor: never below numbers already emitted for this prefix/year pattern
      const emitted = await this.prisma.v2Presupuesto.findMany({
        where: {
          estado: 'EMITIDO',
          numero: { not: null },
          brand_id: existing.brand_id,
        },
        select: { numero: true, snapshot_serie_json: true },
      });
      let maxSeq = 0;
      for (const e of emitted) {
        const snap = e.snapshot_serie_json as any;
        if (snap?.serie_id === existing.id && snap?.secuencia != null) {
          maxSeq = Math.max(maxSeq, Number(snap.secuencia));
        }
      }
      if (next <= maxSeq) {
        throw new BadRequestException(
          `El contador no puede ser ≤ ${maxSeq} (ya emitido). Usa al menos ${maxSeq + 1}.`,
        );
      }
      // Unique check for the number that would be produced next
      const preview = formatNumeroSerie({
        prefijo,
        formato,
        padding,
        anio: existing.anio_actual || new Date().getFullYear(),
        secuencia: next,
      });
      const clash = await this.prisma.v2Presupuesto.findFirst({
        where: { numero: preview },
      });
      if (clash) {
        throw new BadRequestException(
          `El número ${preview} ya existe. Elige otro contador.`,
        );
      }
      siguiente = next;
    }

    const updated = await this.prisma.v2SeriesNumeracion.update({
      where: { id },
      data: {
        prefijo,
        formato,
        padding,
        ...(dto.reset_anual !== undefined && {
          reset_anual: Boolean(dto.reset_anual),
        }),
        ...(dto.activo !== undefined && { activo: Boolean(dto.activo) }),
        ...(dto.siguiente_numero !== undefined && {
          siguiente_numero: siguiente,
        }),
      },
      include: { brand: { select: { id: true, nombre: true, codigo: true } } },
    });

    await this.auditConfig(
      'serie',
      id,
      dto.siguiente_numero !== undefined
        ? 'serie_counter_updated'
        : 'serie_updated',
      {
        old: {
          prefijo: existing.prefijo,
          formato: existing.formato,
          padding: existing.padding,
          siguiente_numero: existing.siguiente_numero,
        },
        new: {
          prefijo,
          formato,
          padding,
          siguiente_numero: siguiente,
          reset_anual: dto.reset_anual,
          activo: dto.activo,
        },
      },
      actor,
    );

    const preview = formatNumeroSerie({
      prefijo: updated.prefijo,
      formato: updated.formato,
      padding: updated.padding,
      anio: updated.anio_actual || new Date().getFullYear(),
      secuencia: updated.siguiente_numero,
    });

    return { ...updated, vista_previa: preview };
  }

  previewSerie(opts: {
    prefijo: string;
    formato_preset?: string;
    formato?: string;
    padding?: number;
    secuencia?: number;
  }) {
    const formato = resolveSerieFormato(
      String(opts.formato_preset || opts.formato || '{PREF}-{YYYY}-{SEQ}'),
    );
    const prefijo = String(opts.prefijo || 'MAD').trim().toUpperCase();
    const padding = Math.min(8, Math.max(1, Number(opts.padding) || 4));
    const secuencia = Math.max(1, Number(opts.secuencia) || 1);
    return {
      formato,
      vista_previa: formatNumeroSerie({
        prefijo,
        formato,
        padding,
        anio: new Date().getFullYear(),
        secuencia,
      }),
    };
  }

  // Helpers for servicios commercial content
  normalizeContenido(raw: unknown, nombre?: string) {
    return normalizeContenidoComercial(raw, nombre);
  }

  async listBloques() {
    const bloques = await this.prisma.v2ContenidoBloque.findMany({
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }, { id: 'asc' }],
    });
    const servicios = await this.prisma.v2ServicioComercial.findMany({
      select: {
        id: true,
        codigo_interno: true,
        nombre: true,
        contenido_comercial_json: true,
      },
    });
    return bloques.map((b) => {
      const usados = servicios.filter((s) => {
        const refs = (s.contenido_comercial_json as any)?.bloques_refs;
        return Array.isArray(refs) && refs.includes(b.codigo);
      });
      return {
        ...b,
        usado_en: usados.map((s) => ({
          id: s.id,
          codigo_interno: s.codigo_interno,
          nombre: s.nombre,
        })),
      };
    });
  }

  async updateBloque(
    user: AuthUser,
    id: number,
    dto: {
      nombre?: string;
      categoria?: string | null;
      body_json?: Record<string, unknown>;
      activo?: boolean;
      orden?: number;
    },
  ) {
    const existing = await this.prisma.v2ContenidoBloque.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Bloque no encontrado');
    const updated = await this.prisma.v2ContenidoBloque.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: String(dto.nombre).trim() }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.body_json !== undefined && {
          body_json: dto.body_json as Prisma.InputJsonValue,
        }),
        ...(dto.activo !== undefined && { activo: Boolean(dto.activo) }),
        ...(dto.orden !== undefined && { orden: Number(dto.orden) || 0 }),
      },
    });
    await this.auditConfig(
      'bloque',
      id,
      'bloque_updated',
      { codigo: existing.codigo, changes: dto },
      this.actor(user),
    );
    return updated;
  }
}
