import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalculadoraV2Service } from './calculadora/calculadora-v2.service';
import { EmitirV2Service } from './emit/emitir-v2.service';
import { getMotorDefinition, mergeInputs } from './calculadora/motor-registry';
import {
  ClienteOverrides,
} from './emit/cliente.util';
import { normalizeContenidoComercial } from './config/config-catalog';
import {
  computeDocumentTotales,
  deepCloneJson,
} from './emit/totales.util';
import {
  applyJornadaToMotorInputs,
  normalizeJornada,
} from './emit/jornada.util';
import {
  digitalesFromBrandConfig,
  normalizeServiciosDigitales,
  resolveAllDigitales,
  sumDigitalesCobrables,
} from './emit/digitales.util';
import {
  cloneContenidoFromPlantilla,
  isContenidoPersonalizado,
  resolveContenidoEfectivo,
} from './emit/contenido-local.util';
import { ContenidoSeedService } from './config/contenido-seed.service';

const MODULE_ACCESS = 'presupuestos-v2';
const MODULE_CONFIG = 'presupuestos-v2-config';

type AuthUser = {
  grupo?: string;
  GRUPO?: string;
  CODIGO?: string;
  codigo?: string;
};

@Injectable()
export class PresupuestosV2Service implements OnModuleInit {
  private readonly logger = new Logger(PresupuestosV2Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly calculadora: CalculadoraV2Service,
    private readonly emitirService: EmitirV2Service,
    private readonly contenidoSeed: ContenidoSeedService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultCompanyBrandSerie();
      await this.contenidoSeed.ensureLegacyContentSeeded();
    } catch (e: any) {
      this.logger.warn(
        `V2 bootstrap company/brand/serie/content skipped: ${e?.message || e}`,
      );
    }
  }

  private grupoOf(user: AuthUser): string {
    return String(user?.grupo || user?.GRUPO || '').trim();
  }

  private codigoOf(user: AuthUser): string | null {
    const c = user?.CODIGO ?? user?.codigo;
    return c != null ? String(c) : null;
  }

  private async assertModule(
    user: AuthUser,
    moduleKey: string,
    label: string,
  ): Promise<void> {
    const grupo = this.grupoOf(user);
    if (!grupo) throw new ForbiddenException('Sin grupo de usuario');

    const ops =
      grupo === 'Developer' ||
      grupo === 'Admin' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    const row = await this.prisma.permissions.findFirst({
      where: { grupo_module: `${grupo}_${moduleKey}` },
    });

    if (ops) {
      if (row && String(row.permitted).toLowerCase() === 'false') {
        throw new ForbiddenException(`Sin permiso para ${label}`);
      }
      return;
    }

    if (!row || String(row.permitted).toLowerCase() !== 'true') {
      throw new ForbiddenException(`Sin permiso para ${label}`);
    }
  }

  async assertCanAccess(user: AuthUser) {
    await this.assertModule(user, MODULE_ACCESS, 'Presupuestos V2');
  }

  async assertCanConfig(user: AuthUser) {
    await this.assertModule(user, MODULE_CONFIG, 'Config Presupuestos V2');
  }

  /** Ensures at least one company + brand + series exist (tenant defaults from env). */
  async ensureDefaultCompanyBrandSerie() {
    const existing = await this.prisma.v2Company.findFirst({
      where: { activo: true },
      include: { brands: { where: { activo: true }, take: 1 } },
    });
    if (existing?.brands?.length) return existing;

    const companyCfg = (this.configService.get('company') as any) || {};
    const presentacion = String(
      companyCfg.presupuestoPresentacionKey || 'decamino',
    )
      .trim()
      .toLowerCase();
    const isHera = presentacion === 'hera';
    const companyCodigo = isHera ? 'hera' : 'decamino';
    const brandCodigo = companyCodigo;
    const legalName =
      String(companyCfg.legalName || '').trim() ||
      (isHera ? 'HERA Facility' : 'De Camino Servicios Auxiliares S.L.');
    const cif = companyCfg.cif ? String(companyCfg.cif).trim() : null;
    const brandNombre =
      String(companyCfg.legalNameShort || '').trim() ||
      (isHera ? 'HERA' : 'De Camino');
    const prefijo = isHera ? 'HER' : 'MAD';

    const company = await this.prisma.v2Company.upsert({
      where: { codigo: companyCodigo },
      create: {
        codigo: companyCodigo,
        legal_name: legalName,
        cif,
        activo: true,
      },
      update: {
        legal_name: legalName,
        cif,
        activo: true,
      },
    });

    let brand = await this.prisma.v2Brand.findFirst({
      where: { company_id: company.id, codigo: brandCodigo },
    });
    if (!brand) {
      brand = await this.prisma.v2Brand.create({
        data: {
          company_id: company.id,
          codigo: brandCodigo,
          nombre: brandNombre,
          activo: true,
        },
      });
    }

    const serie = await this.prisma.v2SeriesNumeracion.findFirst({
      where: { brand_id: brand.id, codigo: 'presupuestos' },
    });
    if (!serie) {
      await this.prisma.v2SeriesNumeracion.create({
        data: {
          brand_id: brand.id,
          codigo: 'presupuestos',
          prefijo,
          formato: '{PREF}-{YYYY}-{SEQ}',
          padding: 4,
          reset_anual: true,
          anio_actual: new Date().getFullYear(),
          siguiente_numero: 1,
          activo: true,
        },
      });
    }

    this.logger.log(
      `V2 bootstrap OK: company=${company.codigo} brand=${brand.codigo} prefijo=${prefijo}`,
    );
    return company;
  }

  // ——— Motors ———
  async listMotores(soloActivos = true) {
    const rows = await this.prisma.v2MotorCalculo.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
    });
    const implemented = new Set<string>(
      this.calculadora.listCodeMotors().map((m) => m.codigo),
    );
    return rows.map((r) => ({
      ...r,
      implementado: implemented.has(r.codigo),
    }));
  }

  getMotorSchema(codigo: string) {
    return this.calculadora.getMotorSchema(codigo);
  }

  // ——— Brands / series (read) ———
  async listBrands() {
    await this.ensureDefaultCompanyBrandSerie();
    return this.prisma.v2Brand.findMany({
      where: { activo: true },
      include: {
        company: { select: { id: true, codigo: true, legal_name: true } },
        series: {
          where: { activo: true },
          select: {
            id: true,
            codigo: true,
            prefijo: true,
            formato: true,
            padding: true,
            reset_anual: true,
            activo: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async getBrand(id: number) {
    const brand = await this.prisma.v2Brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  async listSeries() {
    await this.ensureDefaultCompanyBrandSerie();
    return this.prisma.v2SeriesNumeracion.findMany({
      include: {
        brand: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            company_id: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  // ——— Servicios comerciales ———
  async listServicios(opts?: { activos?: boolean; brandId?: number }) {
    const where: Prisma.V2ServicioComercialWhereInput = {};
    if (opts?.activos === true) where.activo = true;
    if (opts?.brandId != null) {
      where.OR = [{ brand_id: null }, { brand_id: opts.brandId }];
    }
    return this.prisma.v2ServicioComercial.findMany({
      where,
      include: {
        motor: {
          select: { codigo: true, label_ui: true, activo: true },
        },
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async getServicio(id: number) {
    const row = await this.prisma.v2ServicioComercial.findUnique({
      where: { id },
      include: { motor: true },
    });
    if (!row) throw new NotFoundException('Servicio comercial no encontrado');
    return row;
  }

  async createServicio(dto: {
    codigo_interno: string;
    nombre: string;
    descripcion?: string | null;
    categoria?: string | null;
    codigo_motor: string;
    brand_id?: number | null;
    activo?: boolean;
    orden?: number;
    defaults_json?: Prisma.InputJsonValue;
    contenido_comercial_json?: Prisma.InputJsonValue | Record<string, unknown> | null;
  }) {
    const codigo = String(dto.codigo_interno || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!codigo) throw new BadRequestException('codigo_interno requerido');
    if (!String(dto.nombre || '').trim()) {
      throw new BadRequestException('nombre requerido');
    }
    const motor = await this.prisma.v2MotorCalculo.findUnique({
      where: { codigo: dto.codigo_motor },
    });
    if (!motor || !motor.activo) {
      throw new BadRequestException('Motor de cálculo inválido o inactivo');
    }
    if (dto.brand_id != null) {
      const brand = await this.prisma.v2Brand.findUnique({
        where: { id: dto.brand_id },
      });
      if (!brand) throw new BadRequestException('Brand no encontrado');
    }
    const contenido = normalizeContenidoComercial(
      dto.contenido_comercial_json,
      String(dto.nombre).trim(),
    );
    try {
      return await this.prisma.v2ServicioComercial.create({
        data: {
          codigo_interno: codigo,
          nombre: String(dto.nombre).trim(),
          descripcion: dto.descripcion ?? null,
          categoria: dto.categoria ?? null,
          codigo_motor: dto.codigo_motor,
          brand_id: dto.brand_id ?? null,
          activo: dto.activo !== false,
          orden: dto.orden ?? 0,
          defaults_json: dto.defaults_json ?? undefined,
          contenido_comercial_json: contenido as unknown as Prisma.InputJsonValue,
        },
        include: { motor: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('codigo_interno ya existe');
      }
      throw e;
    }
  }

  async updateServicio(
    id: number,
    dto: {
      nombre?: string;
      descripcion?: string | null;
      categoria?: string | null;
      codigo_motor?: string;
      brand_id?: number | null;
      activo?: boolean;
      orden?: number;
      defaults_json?: Prisma.InputJsonValue | null;
      contenido_comercial_json?: Prisma.InputJsonValue | Record<string, unknown> | null;
    },
  ) {
    const current = await this.getServicio(id);
    if (dto.codigo_motor) {
      const motor = await this.prisma.v2MotorCalculo.findUnique({
        where: { codigo: dto.codigo_motor },
      });
      if (!motor || !motor.activo) {
        throw new BadRequestException('Motor de cálculo inválido o inactivo');
      }
    }
    const contenido =
      dto.contenido_comercial_json !== undefined
        ? normalizeContenidoComercial(
            dto.contenido_comercial_json,
            dto.nombre || current.nombre,
          )
        : undefined;
    return this.prisma.v2ServicioComercial.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: String(dto.nombre).trim() }),
        ...(dto.descripcion !== undefined && {
          descripcion: dto.descripcion,
        }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.codigo_motor !== undefined && {
          codigo_motor: dto.codigo_motor,
        }),
        ...(dto.brand_id !== undefined && { brand_id: dto.brand_id }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.orden !== undefined && { orden: dto.orden }),
        ...(dto.defaults_json !== undefined && {
          defaults_json:
            dto.defaults_json === null
              ? Prisma.JsonNull
              : dto.defaults_json,
        }),
        ...(contenido !== undefined && {
          contenido_comercial_json: contenido as unknown as Prisma.InputJsonValue,
        }),
      },
      include: { motor: true },
    });
  }

  // ——— Presupuestos (borrador) ———
  async listPresupuestos() {
    const rows = await this.prisma.v2Presupuesto.findMany({
      orderBy: { updated_at: 'desc' },
      include: {
        brand: { select: { id: true, codigo: true, nombre: true } },
        company: { select: { id: true, codigo: true, legal_name: true } },
        parent: { select: { id: true, numero: true } },
        servicios: {
          orderBy: { orden: 'asc' },
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                codigo_interno: true,
                codigo_motor: true,
              },
            },
          },
        },
      },
    });

    const clienteIds = [
      ...new Set(
        rows
          .map((r) => r.cliente_id)
          .filter((id): id is number => id != null),
      ),
    ];
    const clientes =
      clienteIds.length > 0
        ? await this.prisma.clientes.findMany({
            where: { id: { in: clienteIds } },
            select: { id: true, NOMBRE_O_RAZON_SOCIAL: true },
          })
        : [];
    const nombreById = new Map(
      clientes.map((c) => [
        c.id,
        c.NOMBRE_O_RAZON_SOCIAL?.trim() || `Cliente #${c.id}`,
      ]),
    );

    return rows.map((r) => ({
      id: r.id,
      estado: r.estado,
      numero: r.numero,
      parent_id: r.parent_id,
      root_id: r.root_id,
      parent_numero: r.parent?.numero || null,
      cliente_id: r.cliente_id,
      cliente_nombre: r.cliente_id != null ? nombreById.get(r.cliente_id) ?? null : null,
      company: r.company,
      brand: r.brand,
      created_by: r.created_by,
      updated_by: r.updated_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      servicios: r.servicios.map((s) => ({
        id: s.servicio.id,
        nombre: s.servicio.nombre,
        codigo_interno: s.servicio.codigo_interno,
        codigo_motor: s.servicio.codigo_motor,
        orden: s.orden,
      })),
      totales:
        (r.totales_emitidos_json as any) ||
        null,
      emitted_at: r.emitted_at,
      identificador_ui:
        r.numero ||
        (r.estado === 'BORRADOR'
          ? r.parent?.numero
            ? `Revisión de ${r.parent.numero}`
            : `Borrador #${r.id}`
          : `#${r.id}`),
    }));
  }

  async getPresupuesto(id: number) {
    const r = await this.prisma.v2Presupuesto.findUnique({
      where: { id },
      include: {
        brand: true,
        company: true,
        parent: { select: { id: true, numero: true, estado: true } },
        servicios: {
          orderBy: { orden: 'asc' },
          include: {
            servicio: true,
            opciones: { where: { activo: true }, orderBy: { orden: 'asc' } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Presupuesto V2 no encontrado');

    let cliente_nombre: string | null = null;
    if (r.cliente_id != null) {
      const c = await this.prisma.clientes.findUnique({
        where: { id: r.cliente_id },
        select: { NOMBRE_O_RAZON_SOCIAL: true },
      });
      cliente_nombre = c?.NOMBRE_O_RAZON_SOCIAL?.trim() || null;
    }

    const rootId = r.root_id ?? r.id;
    const versiones = await this.prisma.v2Presupuesto.findMany({
      where: { OR: [{ root_id: rootId }, { id: rootId }] },
      select: {
        id: true,
        numero: true,
        estado: true,
        parent_id: true,
        root_id: true,
        emitted_at: true,
        created_at: true,
      },
      orderBy: { id: 'asc' },
    });

    const revisadoPor = await this.prisma.v2PresupuestoAudit.findMany({
      where: { presupuesto_id: id, event_type: 'revisado_por' },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const serviciosMapped = r.servicios.map((s) => {
      const opciones =
        s.opciones?.length > 0
          ? s.opciones
          : [
              {
                id: 0,
                etiqueta: 'Opción 1',
                orden: 0,
                seleccion_tipo: 'ACUMULABLE',
                descripcion_local: null,
                codigo_motor: s.codigo_motor || s.servicio.codigo_motor,
                version_motor: s.version_motor,
                inputs_json: s.inputs_json,
                resultado_json: s.resultado_json,
                params_usados_json: s.params_usados_json,
                calculated_at: s.calculated_at,
                activo: true,
              },
            ];
      const primary = opciones[0];
      return {
        linea_id: s.id,
        orden: s.orden,
        codigo_motor: s.codigo_motor || s.servicio.codigo_motor,
        version_motor: s.version_motor,
        inputs_json: primary?.inputs_json ?? s.inputs_json,
        resultado_json: primary?.resultado_json ?? s.resultado_json,
        params_usados_json:
          primary?.params_usados_json ?? s.params_usados_json,
        calculated_at: primary?.calculated_at ?? s.calculated_at,
        opciones: opciones.map((o) => ({
          id: o.id,
          etiqueta: o.etiqueta,
          orden: o.orden,
          seleccion_tipo: o.seleccion_tipo,
          descripcion_local: o.descripcion_local,
          jornada_json: normalizeJornada((o as any).jornada_json) || (o as any).jornada_json || null,
          codigo_motor: o.codigo_motor,
          version_motor: o.version_motor,
          inputs_json: o.inputs_json,
          resultado_json: o.resultado_json,
          params_usados_json: o.params_usados_json,
          calculated_at: o.calculated_at,
          activo: o.activo !== false,
        })),
        servicio: {
          id: s.servicio.id,
          codigo_interno: s.servicio.codigo_interno,
          nombre: s.servicio.nombre,
          descripcion: s.servicio.descripcion,
          categoria: s.servicio.categoria,
          codigo_motor: s.servicio.codigo_motor,
          defaults_json: s.servicio.defaults_json,
          contenido_comercial_json: (s.servicio as any).contenido_comercial_json,
          activo: s.servicio.activo,
          orden: s.servicio.orden,
        },
        contenido_comercial: resolveContenidoEfectivo({
          local: (s as any).contenido_comercial_json,
          plantilla: (s.servicio as any).contenido_comercial_json,
          nombre: s.servicio.nombre,
        }),
        contenido_plantilla: normalizeContenidoComercial(
          (s.servicio as any).contenido_comercial_json,
          s.servicio.nombre,
        ),
        contenido_personalizado: isContenidoPersonalizado(
          (s as any).contenido_comercial_json,
          (s.servicio as any).contenido_comercial_json,
          s.servicio.nombre,
        ),
        id: s.servicio.id,
        nombre: s.servicio.nombre,
        codigo_interno: s.servicio.codigo_interno,
      };
    });

    const totalesDocumento = computeDocumentTotales(
      serviciosMapped.map((s) => ({
        nombre: s.nombre,
        servicio_comercial_id: s.id,
        opciones: s.opciones.map((o) => ({
          id: o.id,
          etiqueta: o.etiqueta,
          seleccion_tipo: o.seleccion_tipo,
          activo: o.activo,
          resultado_json: o.resultado_json as any,
        })),
      })),
    );

    const parentNumero = r.parent?.numero || null;
    const identificadorUi =
      r.numero ||
      (r.estado === 'BORRADOR'
        ? parentNumero
          ? `Revisión de ${parentNumero}`
          : `Borrador #${r.id}`
        : `#${r.id}`);

    const digitalesWorking =
      r.estado === 'EMITIDO'
        ? normalizeServiciosDigitales(r.snapshot_servicios_digitales_json)
        : normalizeServiciosDigitales(
            r.servicios_digitales_json ??
              digitalesFromBrandConfig(r.brand?.config_json),
          );
    const digitalesResolved = resolveAllDigitales(digitalesWorking);
    const digCob = sumDigitalesCobrables(digitalesWorking);

    return {
      ...r,
      cliente_nombre,
      identificador_ui: identificadorUi,
      parent_numero: parentNumero,
      versiones,
      revisado_por: revisadoPor.map((a) => a.payload_json),
      totales_documento: {
        ...totalesDocumento,
        digitales_cobrables: digCob,
      },
      servicios_digitales: digitalesResolved,
      servicios_digitales_json: digitalesWorking,
      snapshot_servicios_digitales_json: r.snapshot_servicios_digitales_json,
      cliente_working_json: r.cliente_working_json,
      cliente_overrides_json: r.cliente_overrides_json,
      snapshot_cliente_json: r.snapshot_cliente_json,
      snapshot_company_json: r.snapshot_company_json,
      snapshot_brand_json: r.snapshot_brand_json,
      snapshot_serie_json: r.snapshot_serie_json,
      snapshot_economico_json: r.snapshot_economico_json,
      totales_emitidos_json: r.totales_emitidos_json,
      emitted_at: r.emitted_at,
      emitted_by: r.emitted_by,
      cliente_status:
        r.estado === 'BORRADOR'
          ? await this.emitirService.clienteStatus(id).catch(() => null)
          : {
              estado: r.estado,
              efectivo: r.snapshot_cliente_json,
              ficha_stale: false,
              snapshot_cliente: r.snapshot_cliente_json,
            },
      servicios: serviciosMapped,
    };
  }

  private initialInputsForServicio(servicio: {
    codigo_motor: string;
    defaults_json: unknown;
  }): Prisma.InputJsonValue {
    const motor = getMotorDefinition(servicio.codigo_motor);
    const merged = mergeInputs(
      motor?.defaultInputs() || {},
      (servicio.defaults_json as Record<string, unknown>) || null,
    );
    return merged as Prisma.InputJsonValue;
  }

  async createBorrador(
    user: AuthUser,
    dto: {
      cliente_id?: number | null;
      brand_id?: number | null;
      servicio_ids: number[];
    },
  ) {
    await this.ensureDefaultCompanyBrandSerie();

    if (!Array.isArray(dto.servicio_ids) || dto.servicio_ids.length === 0) {
      throw new BadRequestException('Seleccione al menos un servicio comercial');
    }

    let brand =
      dto.brand_id != null
        ? await this.prisma.v2Brand.findFirst({
            where: { id: dto.brand_id, activo: true },
          })
        : null;

    if (!brand) {
      const brands = await this.prisma.v2Brand.findMany({
        where: { activo: true },
        orderBy: { id: 'asc' },
        take: 2,
      });
      if (brands.length === 0) {
        throw new BadRequestException('No hay brand activo configurado');
      }
      if (brands.length > 1 && dto.brand_id == null) {
        throw new BadRequestException('Debe seleccionar un brand');
      }
      brand = brands[0];
    }

    if (dto.cliente_id != null) {
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: dto.cliente_id },
        select: { id: true },
      });
      if (!cliente) throw new BadRequestException('Cliente no encontrado');
    }

    const servicios = await this.prisma.v2ServicioComercial.findMany({
      where: {
        id: { in: dto.servicio_ids },
        activo: true,
        OR: [{ brand_id: null }, { brand_id: brand.id }],
      },
    });
    if (servicios.length !== dto.servicio_ids.length) {
      throw new BadRequestException(
        'Uno o más servicios comerciales no son válidos o no estánonen a este brand',
      );
    }

    const ordenMap = new Map(dto.servicio_ids.map((id, i) => [id, i]));
    const clienteWorking = await this.emitirService.buildInitialWorking(
      dto.cliente_id ?? null,
    );
    const digitales = digitalesFromBrandConfig(brand.config_json);

    const created = await this.prisma.v2Presupuesto.create({
      data: {
        estado: 'BORRADOR',
        cliente_id: dto.cliente_id ?? null,
        company_id: brand.company_id,
        brand_id: brand.id,
        created_by: this.codigoOf(user),
        updated_by: this.codigoOf(user),
        cliente_working_json:
          clienteWorking as unknown as Prisma.InputJsonValue,
        cliente_overrides_json: {} as Prisma.InputJsonValue,
        servicios_digitales_json: digitales as unknown as Prisma.InputJsonValue,
        servicios: {
          create: servicios.map((s) => {
            const inputs = this.initialInputsForServicio(s);
            const version =
              getMotorDefinition(s.codigo_motor)?.version || '1';
            const contenido = cloneContenidoFromPlantilla(
              (s as any).contenido_comercial_json,
              s.nombre,
            );
            return {
              servicio_comercial_id: s.id,
              orden: ordenMap.get(s.id) ?? 0,
              codigo_motor: s.codigo_motor,
              version_motor: version,
              inputs_json: inputs,
              contenido_comercial_json:
                contenido as unknown as Prisma.InputJsonValue,
              opciones: {
                create: [
                  {
                    etiqueta: 'Opción 1',
                    orden: 0,
                    seleccion_tipo: 'ACUMULABLE',
                    codigo_motor: s.codigo_motor,
                    version_motor: version,
                    inputs_json: inputs,
                    activo: true,
                  },
                ],
              },
            };
          }),
        },
      },
    });

    await this.prisma.v2Presupuesto.update({
      where: { id: created.id },
      data: { root_id: created.id },
    });

    return this.getPresupuesto(created.id);
  }

  async updateBorrador(
    user: AuthUser,
    id: number,
    dto: {
      cliente_id?: number | null;
      brand_id?: number;
      servicio_ids?: number[];
    },
  ) {
    const existing = await this.prisma.v2Presupuesto.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (existing.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se pueden modificar datos económicos ni de cliente de trabajo',
      );
    }

    let brandId = existing.brand_id;
    let companyId = existing.company_id;

    if (dto.brand_id != null && dto.brand_id !== existing.brand_id) {
      const brand = await this.prisma.v2Brand.findFirst({
        where: { id: dto.brand_id, activo: true },
      });
      if (!brand) throw new BadRequestException('Brand no encontrado');
      brandId = brand.id;
      companyId = brand.company_id;
    }

    if (dto.cliente_id !== undefined && dto.cliente_id != null) {
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: dto.cliente_id },
        select: { id: true },
      });
      if (!cliente) throw new BadRequestException('Cliente no encontrado');
    }

    let clienteWorkingUpdate: Prisma.InputJsonValue | undefined;
    if (
      dto.cliente_id !== undefined &&
      dto.cliente_id !== existing.cliente_id
    ) {
      const working = await this.emitirService.buildInitialWorking(
        dto.cliente_id,
      );
      clienteWorkingUpdate = working as unknown as Prisma.InputJsonValue;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.v2Presupuesto.update({
        where: { id },
        data: {
          ...(dto.cliente_id !== undefined && { cliente_id: dto.cliente_id }),
          ...(clienteWorkingUpdate !== undefined && {
            cliente_working_json: clienteWorkingUpdate,
          }),
          brand_id: brandId,
          company_id: companyId,
          updated_by: this.codigoOf(user),
        },
      });

      if (Array.isArray(dto.servicio_ids)) {
        if (dto.servicio_ids.length === 0) {
          throw new BadRequestException(
            'Seleccione al menos un servicio comercial',
          );
        }
        const servicios = await tx.v2ServicioComercial.findMany({
          where: {
            id: { in: dto.servicio_ids },
            activo: true,
            OR: [{ brand_id: null }, { brand_id: brandId }],
          },
        });
        if (servicios.length !== dto.servicio_ids.length) {
          throw new BadRequestException(
            'Uno o más servicios comerciales no son válidos',
          );
        }

        const prev = await tx.v2PresupuestoServicio.findMany({
          where: { presupuesto_id: id },
          include: {
            opciones: { orderBy: { orden: 'asc' } },
          },
        });
        const prevBySvc = new Map(
          prev.map((p) => [p.servicio_comercial_id, p]),
        );

        await tx.v2PresupuestoServicio.deleteMany({
          where: { presupuesto_id: id },
        });

        for (let orden = 0; orden < dto.servicio_ids.length; orden++) {
          const sid = dto.servicio_ids[orden];
          const svc = servicios.find((s) => s.id === sid)!;
          const old = prevBySvc.get(sid);
          const version =
            old?.version_motor ||
            getMotorDefinition(svc.codigo_motor)?.version ||
            '1';
          const inputs =
            (old?.inputs_json as Prisma.InputJsonValue) ??
            this.initialInputsForServicio(svc);
          const contenido =
            (old as any)?.contenido_comercial_json != null
              ? (deepCloneJson(
                  (old as any).contenido_comercial_json,
                ) as Prisma.InputJsonValue)
              : (cloneContenidoFromPlantilla(
                  (svc as any).contenido_comercial_json,
                  svc.nombre,
                ) as unknown as Prisma.InputJsonValue);

          const line = await tx.v2PresupuestoServicio.create({
            data: {
              presupuesto_id: id,
              servicio_comercial_id: sid,
              orden,
              codigo_motor: svc.codigo_motor,
              version_motor: version,
              inputs_json: inputs,
              contenido_comercial_json: contenido,
              resultado_json:
                (old?.resultado_json as Prisma.InputJsonValue) ?? undefined,
              params_usados_json:
                (old?.params_usados_json as Prisma.InputJsonValue) ??
                undefined,
              calculated_at: old?.calculated_at ?? undefined,
            },
          });

          if (old?.opciones?.length) {
            for (const op of old.opciones) {
              await tx.v2PresupuestoServicioOpcion.create({
                data: {
                  presupuesto_servicio_id: line.id,
                  etiqueta: op.etiqueta,
                  orden: op.orden,
                  seleccion_tipo: op.seleccion_tipo,
                  descripcion_local: op.descripcion_local,
                  jornada_json: (op as any).jornada_json
                    ? (deepCloneJson(
                        (op as any).jornada_json,
                      ) as Prisma.InputJsonValue)
                    : undefined,
                  codigo_motor: op.codigo_motor || svc.codigo_motor,
                  version_motor: op.version_motor || version,
                  inputs_json: deepCloneJson(
                    op.inputs_json,
                  ) as Prisma.InputJsonValue,
                  resultado_json: op.resultado_json
                    ? (deepCloneJson(
                        op.resultado_json,
                      ) as Prisma.InputJsonValue)
                    : undefined,
                  params_usados_json: op.params_usados_json
                    ? (deepCloneJson(
                        op.params_usados_json,
                      ) as Prisma.InputJsonValue)
                    : undefined,
                  calculated_at: op.calculated_at,
                  activo: op.activo,
                },
              });
            }
          } else {
            await tx.v2PresupuestoServicioOpcion.create({
              data: {
                presupuesto_servicio_id: line.id,
                etiqueta: 'Opción 1',
                orden: 0,
                seleccion_tipo: 'ACUMULABLE',
                codigo_motor: svc.codigo_motor,
                version_motor: version,
                inputs_json: deepCloneJson(inputs) as Prisma.InputJsonValue,
                resultado_json: old?.resultado_json
                  ? (deepCloneJson(
                      old.resultado_json,
                    ) as Prisma.InputJsonValue)
                  : undefined,
                params_usados_json: old?.params_usados_json
                  ? (deepCloneJson(
                      old.params_usados_json,
                    ) as Prisma.InputJsonValue)
                  : undefined,
                calculated_at: old?.calculated_at ?? undefined,
                activo: true,
              },
            });
          }
        }
      }
    });

    return this.getPresupuesto(id);
  }

  async calcularPresupuesto(
    user: AuthUser,
    id: number,
    body: {
      lineas?: Array<{
        servicio_comercial_id: number;
        opcion_id?: number;
        inputs?: Record<string, unknown>;
      }>;
      persist?: boolean;
    } = {},
  ) {
    const existing = await this.prisma.v2Presupuesto.findUnique({
      where: { id },
      include: {
        servicios: {
          orderBy: { orden: 'asc' },
          include: {
            servicio: true,
            opciones: { where: { activo: true }, orderBy: { orden: 'asc' } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (existing.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede calcular un BORRADOR');
    }

    const persist = body.persist !== false;

    // Overrides keyed by opcion_id OR servicio_comercial_id (applies to all/primary)
    const overrideByOpcion = new Map<number, Record<string, unknown>>();
    const overrideByServicio = new Map<number, Record<string, unknown>>();
    for (const l of body.lineas || []) {
      if (l.opcion_id != null && l.inputs !== undefined) {
        overrideByOpcion.set(l.opcion_id, l.inputs);
      } else if (l.inputs !== undefined) {
        overrideByServicio.set(l.servicio_comercial_id, l.inputs);
      }
    }

    const lineasOut: any[] = [];

    for (const line of existing.servicios) {
      const svc = line.servicio;
      if (!getMotorDefinition(svc.codigo_motor)) {
        throw new BadRequestException(
          `Motor "${svc.codigo_motor}" sin implementación en código`,
        );
      }

      let opciones = line.opciones || [];
      if (!opciones.length) {
        const created = await this.prisma.v2PresupuestoServicioOpcion.create({
          data: {
            presupuesto_servicio_id: line.id,
            etiqueta: 'Opción 1',
            orden: 0,
            seleccion_tipo: 'ACUMULABLE',
            codigo_motor: svc.codigo_motor,
            version_motor: line.version_motor,
            inputs_json: (line.inputs_json as Prisma.InputJsonValue) ?? {},
            activo: true,
          },
        });
        opciones = [created];
      }

      const opcionesOut: any[] = [];

      for (const op of opciones) {
        let inputsBase: Record<string, unknown>;
        if (overrideByOpcion.has(op.id)) {
          inputsBase = overrideByOpcion.get(op.id)!;
        } else if (
          overrideByServicio.has(svc.id) &&
          opciones.length === 1
        ) {
          inputsBase = overrideByServicio.get(svc.id)!;
        } else {
          inputsBase = (op.inputs_json as Record<string, unknown>) || {};
        }

        const { inputs_efectivos, resultado } =
          await this.calculadora.calculateLine({
            codigoMotor: svc.codigo_motor,
            versionMotorDb: op.version_motor || line.version_motor,
            servicioDefaults: svc.defaults_json,
            inputs: inputsBase,
          });

        if (persist) {
          await this.prisma.v2PresupuestoServicioOpcion.update({
            where: { id: op.id },
            data: {
              codigo_motor: svc.codigo_motor,
              version_motor: resultado.version_motor,
              inputs_json: this.calculadora.jsonValue(inputs_efectivos),
              resultado_json: this.calculadora.jsonValue(resultado),
              params_usados_json: this.calculadora.jsonValue(
                resultado.params_usados,
              ),
              calculated_at: new Date(),
            },
          });
        }

        opcionesOut.push({
          opcion_id: op.id,
          etiqueta: op.etiqueta,
          orden: op.orden,
          seleccion_tipo: op.seleccion_tipo,
          inputs: inputs_efectivos,
          resultado,
        });
      }

      const primary = opcionesOut[0];
      if (persist && primary) {
        await this.prisma.v2PresupuestoServicio.update({
          where: { id: line.id },
          data: {
            codigo_motor: svc.codigo_motor,
            version_motor: primary.resultado.version_motor,
            inputs_json: this.calculadora.jsonValue(primary.inputs),
            resultado_json: this.calculadora.jsonValue(primary.resultado),
            params_usados_json: this.calculadora.jsonValue(
              primary.resultado.params_usados,
            ),
            calculated_at: new Date(),
          },
        });
      }

      lineasOut.push({
        linea_id: line.id,
        servicio_comercial_id: svc.id,
        nombre: svc.nombre,
        codigo_motor: svc.codigo_motor,
        opciones: opcionesOut,
        inputs: primary?.inputs,
        resultado: primary?.resultado,
      });
    }

    if (persist) {
      await this.prisma.v2Presupuesto.update({
        where: { id },
        data: { updated_by: this.codigoOf(user) },
      });
    }

    const totalesDocumento = computeDocumentTotales(
      lineasOut.map((l) => ({
        nombre: l.nombre,
        servicio_comercial_id: l.servicio_comercial_id,
        opciones: (l.opciones || []).map((o: any) => ({
          id: o.opcion_id,
          etiqueta: o.etiqueta,
          seleccion_tipo: o.seleccion_tipo,
          activo: true,
          resultado: o.resultado,
        })),
      })),
    );

    return {
      presupuesto_id: id,
      lineas: lineasOut,
      totales: totalesDocumento.totales_sin_alternativas,
      totales_documento: totalesDocumento,
      persisted: persist,
    };
  }

  async updateLineaInputs(
    user: AuthUser,
    presupuestoId: number,
    servicioComercialId: number,
    inputs: Record<string, unknown>,
    recalcular = true,
    opcionId?: number,
  ) {
    const line = await this.prisma.v2PresupuestoServicio.findFirst({
      where: {
        presupuesto_id: presupuestoId,
        servicio_comercial_id: servicioComercialId,
      },
      include: {
        presupuesto: true,
        servicio: true,
        opciones: { where: { activo: true }, orderBy: { orden: 'asc' } },
      },
    });
    if (!line) throw new NotFoundException('Línea de presupuesto no encontrada');
    if (line.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se pueden modificar inputs ni cálculo',
      );
    }

    let op =
      opcionId != null
        ? line.opciones.find((o) => o.id === opcionId)
        : line.opciones[0];

    if (!op) {
      op = await this.prisma.v2PresupuestoServicioOpcion.create({
        data: {
          presupuesto_servicio_id: line.id,
          etiqueta: 'Opción 1',
          orden: 0,
          seleccion_tipo: 'ACUMULABLE',
          codigo_motor: line.servicio.codigo_motor,
          version_motor: line.version_motor,
          inputs_json: (line.inputs_json as Prisma.InputJsonValue) ?? {},
          activo: true,
        },
      });
    }

    const merged = mergeInputs(
      getMotorDefinition(line.servicio.codigo_motor)?.defaultInputs() || {},
      (line.servicio.defaults_json as Record<string, unknown>) || null,
      (op.inputs_json as Record<string, unknown>) || null,
      inputs,
    );

    await this.prisma.v2PresupuestoServicioOpcion.update({
      where: { id: op.id },
      data: {
        inputs_json: this.calculadora.jsonValue(merged),
        codigo_motor: line.servicio.codigo_motor,
      },
    });
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });

    if (recalcular) {
      return this.calcularPresupuesto(user, presupuestoId, {
        lineas: [
          {
            servicio_comercial_id: servicioComercialId,
            opcion_id: op.id,
            inputs: merged,
          },
        ],
        persist: true,
      });
    }
    return this.getPresupuesto(presupuestoId);
  }

  private async assertBorradorLine(
    presupuestoId: number,
    lineaId: number,
  ) {
    const line = await this.prisma.v2PresupuestoServicio.findFirst({
      where: { id: lineaId, presupuesto_id: presupuestoId },
      include: {
        presupuesto: true,
        servicio: true,
        opciones: { where: { activo: true }, orderBy: { orden: 'asc' } },
      },
    });
    if (!line) throw new NotFoundException('Servicio del presupuesto no encontrado');
    if (line.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se pueden modificar opciones',
      );
    }
    return line;
  }

  /** + Variante: deep-copy inputs from source (or last) opción. */
  async addVariante(
    user: AuthUser,
    presupuestoId: number,
    lineaId: number,
    dto: {
      etiqueta?: string;
      source_opcion_id?: number;
      seleccion_tipo?: string;
    } = {},
  ) {
    const line = await this.assertBorradorLine(presupuestoId, lineaId);
    const source =
      (dto.source_opcion_id != null
        ? line.opciones.find((o) => o.id === dto.source_opcion_id)
        : null) ||
      line.opciones[line.opciones.length - 1] ||
      null;

    const nextOrden =
      line.opciones.reduce((m, o) => Math.max(m, o.orden), -1) + 1;
    const n = line.opciones.length + 1;
    const etiqueta = (dto.etiqueta || `Opción ${n}`).trim().slice(0, 200);

    // When adding a second option, promote group to EXCLUSIVE by default
    let seleccionTipo = (dto.seleccion_tipo || '').toUpperCase();
    if (seleccionTipo !== 'EXCLUSIVE' && seleccionTipo !== 'ACUMULABLE') {
      seleccionTipo = line.opciones.length >= 1 ? 'EXCLUSIVE' : 'ACUMULABLE';
    }

    const inputsClone = deepCloneJson(
      source?.inputs_json ?? line.inputs_json ?? {},
    );

    const created = await this.prisma.$transaction(async (tx) => {
      if (line.opciones.length === 1 && seleccionTipo === 'EXCLUSIVE') {
        await tx.v2PresupuestoServicioOpcion.update({
          where: { id: line.opciones[0].id },
          data: { seleccion_tipo: 'EXCLUSIVE' },
        });
      }

      return tx.v2PresupuestoServicioOpcion.create({
        data: {
          presupuesto_servicio_id: line.id,
          etiqueta,
          orden: nextOrden,
          seleccion_tipo: seleccionTipo,
          descripcion_local: source?.descripcion_local ?? null,
          codigo_motor: line.servicio.codigo_motor,
          version_motor:
            source?.version_motor ||
            line.version_motor ||
            getMotorDefinition(line.servicio.codigo_motor)?.version ||
            '1',
          inputs_json: inputsClone as Prisma.InputJsonValue,
          jornada_json: source?.jornada_json
            ? (deepCloneJson(source.jornada_json) as Prisma.InputJsonValue)
            : undefined,
          activo: true,
        },
      });
    });

    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });
    await this.emitirService.audit(
      presupuestoId,
      'opcion_added',
      {
        linea_id: lineaId,
        opcion_id: created.id,
        etiqueta,
        seleccion_tipo: seleccionTipo,
      },
      this.codigoOf(user),
    );

    return this.getPresupuesto(presupuestoId);
  }

  async updateOpcion(
    user: AuthUser,
    presupuestoId: number,
    opcionId: number,
    dto: {
      etiqueta?: string;
      seleccion_tipo?: string;
      descripcion_local?: string | null;
      orden?: number;
      inputs?: Record<string, unknown>;
      jornada?: unknown;
    },
  ) {
    const op = await this.prisma.v2PresupuestoServicioOpcion.findUnique({
      where: { id: opcionId },
      include: {
        presupuestoServicio: { include: { presupuesto: true, servicio: true } },
      },
    });
    if (!op || op.presupuestoServicio.presupuesto_id !== presupuestoId) {
      throw new NotFoundException('Opción no encontrada');
    }
    if (op.presupuestoServicio.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException('Presupuesto EMITIDO: opciones inmutables');
    }

    let seleccion = dto.seleccion_tipo
      ? String(dto.seleccion_tipo).toUpperCase()
      : undefined;
    if (
      seleccion != null &&
      seleccion !== 'EXCLUSIVE' &&
      seleccion !== 'ACUMULABLE'
    ) {
      throw new BadRequestException(
        'seleccion_tipo debe ser EXCLUSIVE o ACUMULABLE',
      );
    }

    const jornadaNorm =
      dto.jornada !== undefined ? normalizeJornada(dto.jornada) : undefined;

    let inputsBase =
      (op.inputs_json as Record<string, unknown>) ||
      ({} as Record<string, unknown>);
    if (dto.inputs) {
      inputsBase = mergeInputs(
        getMotorDefinition(op.presupuestoServicio.servicio.codigo_motor)
          ?.defaultInputs() || {},
        (op.presupuestoServicio.servicio.defaults_json as Record<
          string,
          unknown
        >) || null,
        inputsBase,
        dto.inputs,
      );
    }
    if (jornadaNorm) {
      inputsBase = applyJornadaToMotorInputs(inputsBase, jornadaNorm);
    }

    const inputsJson =
      dto.inputs !== undefined || jornadaNorm
        ? this.calculadora.jsonValue(inputsBase)
        : undefined;

    await this.prisma.v2PresupuestoServicioOpcion.update({
      where: { id: opcionId },
      data: {
        ...(dto.etiqueta != null && {
          etiqueta: String(dto.etiqueta).trim().slice(0, 200) || op.etiqueta,
        }),
        ...(seleccion != null && { seleccion_tipo: seleccion }),
        ...(dto.descripcion_local !== undefined && {
          descripcion_local: dto.descripcion_local,
        }),
        ...(dto.orden != null && { orden: Number(dto.orden) || 0 }),
        ...(jornadaNorm !== undefined && {
          jornada_json:
            (jornadaNorm as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        }),
        ...(inputsJson !== undefined && { inputs_json: inputsJson }),
      },
    });
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });

    return this.getPresupuesto(presupuestoId);
  }

  async updateServiciosDigitales(
    user: AuthUser,
    presupuestoId: number,
    digitales: unknown,
  ) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (p.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se pueden modificar servicios digitales',
      );
    }
    const normalized = normalizeServiciosDigitales(digitales);
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: {
        servicios_digitales_json: normalized as unknown as Prisma.InputJsonValue,
        updated_by: this.codigoOf(user),
      },
    });
    await this.emitirService.audit(
      presupuestoId,
      'digitales_updated',
      { count: normalized.length },
      this.codigoOf(user),
    );
    return this.getPresupuesto(presupuestoId);
  }

  async deleteOpcion(
    user: AuthUser,
    presupuestoId: number,
    opcionId: number,
  ) {
    const op = await this.prisma.v2PresupuestoServicioOpcion.findUnique({
      where: { id: opcionId },
      include: {
        presupuestoServicio: {
          include: {
            presupuesto: true,
            opciones: { where: { activo: true } },
          },
        },
      },
    });
    if (!op || op.presupuestoServicio.presupuesto_id !== presupuestoId) {
      throw new NotFoundException('Opción no encontrada');
    }
    if (op.presupuestoServicio.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException('Presupuesto EMITIDO: opciones inmutables');
    }
    if (op.presupuestoServicio.opciones.length <= 1) {
      throw new BadRequestException(
        'No se puede eliminar la única opción del servicio',
      );
    }

    await this.prisma.v2PresupuestoServicioOpcion.delete({
      where: { id: opcionId },
    });
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });
    await this.emitirService.audit(
      presupuestoId,
      'opcion_deleted',
      { opcion_id: opcionId },
      this.codigoOf(user),
    );
    return this.getPresupuesto(presupuestoId);
  }

  async reorderOpciones(
    user: AuthUser,
    presupuestoId: number,
    lineaId: number,
    ordenIds: number[],
  ) {
    const line = await this.assertBorradorLine(presupuestoId, lineaId);
    const idSet = new Set(line.opciones.map((o) => o.id));
    if (
      !Array.isArray(ordenIds) ||
      ordenIds.length === 0 ||
      ordenIds.some((id) => !idSet.has(id))
    ) {
      throw new BadRequestException('orden de opciones inválido');
    }
    await this.prisma.$transaction(
      ordenIds.map((oid, orden) =>
        this.prisma.v2PresupuestoServicioOpcion.update({
          where: { id: oid },
          data: { orden },
        }),
      ),
    );
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });
    return this.getPresupuesto(presupuestoId);
  }

  async duplicateOpcion(
    user: AuthUser,
    presupuestoId: number,
    opcionId: number,
  ) {
    const op = await this.prisma.v2PresupuestoServicioOpcion.findUnique({
      where: { id: opcionId },
      include: {
        presupuestoServicio: { include: { presupuesto: true } },
      },
    });
    if (!op || op.presupuestoServicio.presupuesto_id !== presupuestoId) {
      throw new NotFoundException('Opción no encontrada');
    }
    return this.addVariante(user, presupuestoId, op.presupuesto_servicio_id, {
      etiqueta: `${op.etiqueta} (copia)`,
      source_opcion_id: op.id,
      seleccion_tipo: op.seleccion_tipo,
    });
  }

  /**
   * EMITIDO → Nueva versión → BORRADOR (parent/root lineage).
   * Policy (5.4): copies commercial content personalizations from the previous
   * version (line copy → snapshot line → catalog). Does NOT silently refresh
   * from live catalog. User can "Restaurar desde plantilla" on the new draft.
   */
  async crearNuevaVersion(user: AuthUser, sourceId: number) {
    const source = await this.prisma.v2Presupuesto.findUnique({
      where: { id: sourceId },
      include: {
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
    if (!source) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (source.estado !== 'EMITIDO') {
      throw new BadRequestException(
        'Solo se puede crear una nueva versión desde un presupuesto EMITIDO',
      );
    }

    const actor = this.codigoOf(user);
    const rootId = source.root_id ?? source.id;
    const snapLineas = Array.isArray(
      (source.snapshot_economico_json as any)?.lineas,
    )
      ? ((source.snapshot_economico_json as any).lineas as any[])
      : [];

    // Cliente: from snapshot efectivo into working (current commercial rules: working copy)
    const snapCliente = source.snapshot_cliente_json as any;
    const clienteWorking = await this.emitirService.buildInitialWorking(
      source.cliente_id,
    );
    // Keep snapshot overrides feel: seed working from snapshot if present
    if (snapCliente && typeof snapCliente === 'object') {
      (clienteWorking as any).ficha = {
        ...((clienteWorking as any).ficha || {}),
        nombre: snapCliente.nombre,
        nif: snapCliente.nif,
        direccion: snapCliente.direccion,
        email: snapCliente.email,
        telefono: snapCliente.telefono,
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.v2Presupuesto.create({
        data: {
          estado: 'BORRADOR',
          numero: null,
          cliente_id: source.cliente_id,
          company_id: source.company_id,
          brand_id: source.brand_id,
          parent_id: source.id,
          root_id: rootId,
          created_by: actor,
          updated_by: actor,
          cliente_working_json:
            clienteWorking as unknown as Prisma.InputJsonValue,
          cliente_overrides_json:
            (source.cliente_overrides_json as Prisma.InputJsonValue) ??
            ({} as Prisma.InputJsonValue),
          servicios_digitales_json: (deepCloneJson(
            source.snapshot_servicios_digitales_json ||
              source.servicios_digitales_json ||
              digitalesFromBrandConfig(source.brand?.config_json),
          ) as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      for (const s of source.servicios) {
        const liveSvc = s.servicio;
        const snapLine =
          snapLineas.find(
            (l) =>
              l.servicio_comercial_id === s.servicio_comercial_id ||
              l.linea_id === s.id,
          ) || null;
        const contenido = resolveContenidoEfectivo({
          local: (s as any).contenido_comercial_json,
          snapshot: snapLine?.contenido_comercial,
          plantilla: (liveSvc as any).contenido_comercial_json,
          nombre: liveSvc.nombre,
        });

        const line = await tx.v2PresupuestoServicio.create({
          data: {
            presupuesto_id: nuevo.id,
            servicio_comercial_id: s.servicio_comercial_id,
            orden: s.orden,
            codigo_motor: liveSvc.codigo_motor,
            version_motor:
              getMotorDefinition(liveSvc.codigo_motor)?.version ||
              s.version_motor ||
              '1',
            inputs_json: deepCloneJson(
              s.inputs_json,
            ) as Prisma.InputJsonValue,
            contenido_comercial_json:
              contenido as unknown as Prisma.InputJsonValue,
          },
        });

        const ops =
          s.opciones?.length > 0
            ? s.opciones
            : [
                {
                  etiqueta: 'Opción 1',
                  orden: 0,
                  seleccion_tipo: 'ACUMULABLE',
                  descripcion_local: null,
                  codigo_motor: liveSvc.codigo_motor,
                  version_motor: s.version_motor,
                  inputs_json: s.inputs_json,
                },
              ];

        for (const op of ops as any[]) {
          await tx.v2PresupuestoServicioOpcion.create({
            data: {
              presupuesto_servicio_id: line.id,
              etiqueta: op.etiqueta || 'Opción 1',
              orden: op.orden ?? 0,
              seleccion_tipo: op.seleccion_tipo || 'ACUMULABLE',
              descripcion_local: op.descripcion_local ?? null,
              codigo_motor: liveSvc.codigo_motor,
              version_motor:
                getMotorDefinition(liveSvc.codigo_motor)?.version ||
                op.version_motor ||
                '1',
              inputs_json: deepCloneJson(
                op.inputs_json ?? {},
              ) as Prisma.InputJsonValue,
              jornada_json: op.jornada_json
                ? (deepCloneJson(op.jornada_json) as Prisma.InputJsonValue)
                : undefined,
              activo: true,
            },
          });
        }
      }

      await this.emitirService.audit(
        nuevo.id,
        'version_created',
        {
          parent_id: source.id,
          parent_numero: source.numero,
          root_id: rootId,
          contenido_policy: 'preserve_previous_version',
        },
        actor,
        tx,
      );
      await this.emitirService.audit(
        source.id,
        'version_spawned',
        {
          child_id: nuevo.id,
          parent_numero: source.numero,
        },
        actor,
        tx,
      );

      return nuevo;
    });

    return this.getPresupuesto(created.id);
  }

  async updateLineaContenido(
    user: AuthUser,
    presupuestoId: number,
    lineaId: number,
    contenidoRaw: unknown,
  ) {
    const line = await this.prisma.v2PresupuestoServicio.findFirst({
      where: { id: lineaId, presupuesto_id: presupuestoId },
      include: { presupuesto: true, servicio: true },
    });
    if (!line) throw new NotFoundException('Línea de servicio no encontrada');
    if (line.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: el contenido comercial es inmutable',
      );
    }
    const contenido = normalizeContenidoComercial(
      contenidoRaw,
      line.servicio.nombre,
    );
    await this.prisma.v2PresupuestoServicio.update({
      where: { id: lineaId },
      data: {
        contenido_comercial_json:
          contenido as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });
    return this.getPresupuesto(presupuestoId);
  }

  async restoreLineaContenido(
    user: AuthUser,
    presupuestoId: number,
    lineaId: number,
  ) {
    const line = await this.prisma.v2PresupuestoServicio.findFirst({
      where: { id: lineaId, presupuesto_id: presupuestoId },
      include: { presupuesto: true, servicio: true },
    });
    if (!line) throw new NotFoundException('Línea de servicio no encontrada');
    if (line.presupuesto.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se puede restaurar la plantilla',
      );
    }
    const contenido = cloneContenidoFromPlantilla(
      (line.servicio as any).contenido_comercial_json,
      line.servicio.nombre,
    );
    await this.prisma.v2PresupuestoServicio.update({
      where: { id: lineaId },
      data: {
        contenido_comercial_json:
          contenido as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: { updated_by: this.codigoOf(user) },
    });
    return this.getPresupuesto(presupuestoId);
  }

  async emitirPresupuesto(
    user: AuthUser,
    id: number,
    opts: { confirm_changed_totals?: boolean } = {},
  ) {
    return this.emitirService.emitir(user, id, opts);
  }

  async refreshCliente(user: AuthUser, id: number) {
    await this.emitirService.refreshClienteDesdeFicha(user, id);
    return this.getPresupuesto(id);
  }

  async updateClienteOverrides(
    user: AuthUser,
    id: number,
    overrides: ClienteOverrides,
  ) {
    await this.emitirService.updateClienteOverrides(user, id, overrides);
    return this.getPresupuesto(id);
  }

  async getClienteStatus(id: number) {
    return this.emitirService.clienteStatus(id);
  }

  async deletePresupuesto(id: number) {
    const existing = await this.prisma.v2Presupuesto.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Presupuesto V2 no encontrado');
    // Probe / cleanup: allow deleting BORRADOR and EMITIDO (cascade opciones/audit/docs).
    await this.prisma.v2Presupuesto.delete({ where: { id } });
    return { success: true, deleted_id: id, estado: existing.estado };
  }

  /** @deprecated alias */
  async deleteBorrador(id: number) {
    return this.deletePresupuesto(id);
  }
}
