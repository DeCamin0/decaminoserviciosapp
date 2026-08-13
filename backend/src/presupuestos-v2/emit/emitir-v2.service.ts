import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculadoraV2Service } from '../calculadora/calculadora-v2.service';
import { getMotorDefinition } from '../calculadora/motor-registry';
import { normalizeContenidoComercial } from '../config/config-catalog';
import { resolveContenidoEfectivo } from './contenido-local.util';
import { allocateNextNumero } from './numero.util';
import {
  buildWorkingFromFicha,
  detectFichaStale,
  mapClienteRowToFicha,
  refreshWorkingFicha,
  resolveClienteEfectivo,
  ClienteOverrides,
  ClienteWorking,
} from './cliente.util';
import {
  computeDocumentTotales,
  extractSavedTotalesFromLineas,
  normalizeTotales,
  totalesDiffer,
  TotalesMoney,
} from './totales.util';
import { normalizeJornada } from './jornada.util';
import {
  normalizeServiciosDigitales,
  resolveAllDigitales,
  sumDigitalesCobrables,
  digitalesFromBrandConfig,
} from './digitales.util';

type AuthUser = {
  grupo?: string;
  GRUPO?: string;
  CODIGO?: string;
  codigo?: string;
};

export type LineaCalcOpcion = {
  opcion_id: number;
  etiqueta: string;
  orden: number;
  seleccion_tipo: string;
  descripcion_local: string | null;
  jornada: ReturnType<typeof normalizeJornada>;
  codigo_motor: string;
  version_motor: string;
  inputs: Record<string, unknown>;
  resultado: any;
  params_usados: unknown;
};

export type LineaCalcServicio = {
  linea_id: number;
  servicio_comercial_id: number;
  nombre: string;
  descripcion: string | null;
  codigo_motor: string;
  version_motor: string;
  defaults_json: unknown;
  contenido_comercial: ReturnType<typeof normalizeContenidoComercial>;
  opciones: LineaCalcOpcion[];
  /** Primary option mirror (compat). */
  inputs: Record<string, unknown>;
  resultado: any;
};

@Injectable()
export class EmitirV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly calculadora: CalculadoraV2Service,
  ) {}

  private codigoOf(user: AuthUser): string | null {
    const c = user?.CODIGO ?? user?.codigo;
    return c != null ? String(c) : null;
  }

  async audit(
    presupuestoId: number,
    eventType: string,
    payload: unknown,
    actor: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    await db.v2PresupuestoAudit.create({
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

  async loadClienteFicha(clienteId: number) {
    const row = await this.prisma.clientes.findUnique({
      where: { id: clienteId },
      include: {
        contactos: {
          where: { estado: 'activo' },
          orderBy: [{ es_principal: 'desc' }, { id: 'asc' }],
          take: 10,
        },
      },
    });
    if (!row) return null;
    return mapClienteRowToFicha(row);
  }

  async buildInitialWorking(clienteId: number | null | undefined) {
    if (clienteId == null) {
      return buildWorkingFromFicha(null, null);
    }
    const ficha = await this.loadClienteFicha(clienteId);
    return buildWorkingFromFicha(ficha, clienteId);
  }

  assertBorradorEditable(estado: string) {
    if (estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Presupuesto EMITIDO: no se pueden modificar datos económicos ni de cliente de trabajo',
      );
    }
  }

  async refreshClienteDesdeFicha(
    user: AuthUser,
    presupuestoId: number,
  ) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    this.assertBorradorEditable(p.estado);
    if (p.cliente_id == null) {
      throw new BadRequestException('El borrador no tiene cliente_id');
    }
    const live = await this.loadClienteFicha(p.cliente_id);
    if (!live) throw new BadRequestException('Cliente no encontrado');

    const prev = (p.cliente_working_json as ClienteWorking) || null;
    const next = refreshWorkingFicha(prev, live);
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: {
        cliente_working_json: next as unknown as Prisma.InputJsonValue,
        updated_by: this.codigoOf(user),
      },
    });
    await this.audit(
      presupuestoId,
      'cliente_refreshed',
      { previous_fingerprint: prev?.ficha_fingerprint, next_fingerprint: next.ficha_fingerprint },
      this.codigoOf(user),
    );
    return next;
  }

  async updateClienteOverrides(
    user: AuthUser,
    presupuestoId: number,
    overrides: ClienteOverrides,
  ) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    this.assertBorradorEditable(p.estado);
    const merged = {
      ...((p.cliente_overrides_json as ClienteOverrides) || {}),
      ...overrides,
    };
    await this.prisma.v2Presupuesto.update({
      where: { id: presupuestoId },
      data: {
        cliente_overrides_json: merged as unknown as Prisma.InputJsonValue,
        updated_by: this.codigoOf(user),
      },
    });
    await this.audit(
      presupuestoId,
      'cliente_override_changed',
      { overrides: merged },
      this.codigoOf(user),
    );
    return merged;
  }

  private enrichCompanySnapshot(company: {
    id: number;
    codigo: string;
    legal_name: string;
    cif: string | null;
    direccion_fiscal: string | null;
    datos_fiscales_json: unknown;
    logo_ref: string | null;
  }) {
    const cfg = (this.configService.get('company') as any) || {};
    const fiscales = (company.datos_fiscales_json || {}) as Record<string, any>;
    return {
      company_id: company.id,
      codigo: company.codigo,
      legal_name: company.legal_name,
      cif: company.cif || cfg.cif || null,
      direccion_fiscal:
        company.direccion_fiscal ||
        fiscales.direccion ||
        cfg.address ||
        cfg.addressLine1 ||
        null,
      cp: fiscales.cp || null,
      poblacion: fiscales.poblacion || null,
      provincia: fiscales.provincia || null,
      pais: fiscales.pais || 'España',
      cp_poblacion:
        [fiscales.cp, fiscales.poblacion].filter(Boolean).join(' ') ||
        cfg.cpPoblacion ||
        null,
      phone: fiscales.telefono || fiscales.phone || cfg.phone || null,
      email: fiscales.email || cfg.email || null,
      website: fiscales.web || fiscales.website || cfg.website || null,
      logo_ref: company.logo_ref || cfg.logoPath || null,
      datos_fiscales: company.datos_fiscales_json || null,
      legal_registry_text: cfg.legalRegistryText || null,
    };
  }

  /**
   * Recalculate all active opciones (and optionally persist).
   * Syncs first opción onto the parent line for legacy mirrors.
   */
  async recalcularLineas(
    presupuestoId: number,
    persist: boolean,
    actor: string | null,
  ) {
    const existing = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
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
    if (existing.servicios.length === 0) {
      throw new BadRequestException('El presupuesto no tiene servicios');
    }

    const lineasCalc: LineaCalcServicio[] = [];

    for (const line of existing.servicios) {
      const svc = line.servicio;
      if (!getMotorDefinition(svc.codigo_motor)) {
        throw new BadRequestException(
          `Motor "${svc.codigo_motor}" sin implementación en código`,
        );
      }

      let opciones = line.opciones || [];
      // Compat: line without opciones yet → treat line inputs as Opción 1
      if (!opciones.length) {
        if (persist) {
          const created = await this.prisma.v2PresupuestoServicioOpcion.create({
            data: {
              presupuesto_servicio_id: line.id,
              etiqueta: 'Opción 1',
              orden: 0,
              seleccion_tipo: 'ACUMULABLE',
              codigo_motor: svc.codigo_motor,
              version_motor: line.version_motor,
              inputs_json: (line.inputs_json as Prisma.InputJsonValue) ?? {},
              resultado_json: (line.resultado_json as Prisma.InputJsonValue) ?? undefined,
              params_usados_json:
                (line.params_usados_json as Prisma.InputJsonValue) ?? undefined,
              calculated_at: line.calculated_at,
              activo: true,
            },
          });
          opciones = [created];
        } else {
          opciones = [
            {
              id: 0,
              presupuesto_servicio_id: line.id,
              etiqueta: 'Opción 1',
              orden: 0,
              seleccion_tipo: 'ACUMULABLE',
              descripcion_local: null,
              codigo_motor: svc.codigo_motor,
              version_motor: line.version_motor,
              inputs_json: line.inputs_json,
              resultado_json: line.resultado_json,
              params_usados_json: line.params_usados_json,
              calculated_at: line.calculated_at,
              activo: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as any,
          ];
        }
      }

      const opcionesCalc: LineaCalcOpcion[] = [];

      for (const op of opciones) {
        const { inputs_efectivos, resultado } =
          await this.calculadora.calculateLine({
            codigoMotor: svc.codigo_motor,
            versionMotorDb: op.version_motor || line.version_motor,
            servicioDefaults: svc.defaults_json,
            inputs: (op.inputs_json as Record<string, unknown>) || {},
          });

        if (persist && op.id > 0) {
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

        opcionesCalc.push({
          opcion_id: op.id,
          etiqueta: op.etiqueta,
          orden: op.orden,
          seleccion_tipo: op.seleccion_tipo,
          descripcion_local: op.descripcion_local,
          jornada: normalizeJornada((op as any).jornada_json),
          codigo_motor: svc.codigo_motor,
          version_motor: resultado.version_motor,
          inputs: inputs_efectivos,
          resultado,
          params_usados: resultado.params_usados,
        });
      }

      const primary = opcionesCalc[0];
      if (persist && primary) {
        await this.prisma.v2PresupuestoServicio.update({
          where: { id: line.id },
          data: {
            codigo_motor: svc.codigo_motor,
            version_motor: primary.version_motor,
            inputs_json: this.calculadora.jsonValue(primary.inputs),
            resultado_json: this.calculadora.jsonValue(primary.resultado),
            params_usados_json: this.calculadora.jsonValue(
              primary.params_usados,
            ),
            calculated_at: new Date(),
          },
        });
      }

      const contenido = resolveContenidoEfectivo({
        local: (line as any).contenido_comercial_json,
        plantilla: (svc as any).contenido_comercial_json,
        nombre: svc.nombre,
      });

      lineasCalc.push({
        linea_id: line.id,
        servicio_comercial_id: svc.id,
        nombre: svc.nombre,
        descripcion: svc.descripcion,
        codigo_motor: svc.codigo_motor,
        version_motor: primary?.version_motor || line.version_motor || '1',
        defaults_json: svc.defaults_json,
        contenido_comercial: contenido,
        opciones: opcionesCalc,
        inputs: primary?.inputs || {},
        resultado: primary?.resultado || null,
      });
    }

    const docTotales = computeDocumentTotales(
      lineasCalc.map((l) => ({
        nombre: l.nombre,
        servicio_comercial_id: l.servicio_comercial_id,
        opciones: l.opciones.map((o) => ({
          id: o.opcion_id,
          etiqueta: o.etiqueta,
          seleccion_tipo: o.seleccion_tipo,
          activo: true,
          resultado: o.resultado,
        })),
      })),
    );

    return {
      existing,
      lineasCalc,
      totales: docTotales.totales_sin_alternativas,
      totalesDocumento: docTotales,
      actor,
    };
  }

  async emitir(
    user: AuthUser,
    presupuestoId: number,
    opts: { confirm_changed_totals?: boolean } = {},
  ) {
    const actor = this.codigoOf(user);

    const pre = await this.prisma.v2Presupuesto.findUnique({
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
    if (!pre) throw new NotFoundException('Presupuesto V2 no encontrado');
    if (pre.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede emitir un BORRADOR');
    }
    if (!pre.servicios.length) {
      throw new BadRequestException('Debe haber al menos un servicio');
    }
    for (const line of pre.servicios) {
      const ops =
        line.opciones?.length > 0
          ? line.opciones
          : line.inputs_json
            ? [{ inputs_json: line.inputs_json, etiqueta: 'Opción 1' }]
            : [];
      if (!ops.length) {
        throw new BadRequestException(
          `La línea "${line.servicio.nombre}" no tiene opciones. Calcule antes de emitir.`,
        );
      }
      for (const op of ops) {
        if (!(op as any).inputs_json) {
          throw new BadRequestException(
            `La opción "${(op as any).etiqueta || '?'}" de "${line.servicio.nombre}" no tiene inputs. Calcule antes de emitir.`,
          );
        }
      }
    }

    const savedTotales = extractSavedTotalesFromLineas(
      pre.servicios.map((s) => ({
        nombre: s.servicio.nombre,
        servicio_comercial_id: s.servicio_comercial_id,
        resultado_json: s.resultado_json,
        opciones: (s.opciones || []).map((o) => ({
          id: o.id,
          etiqueta: o.etiqueta,
          seleccion_tipo: o.seleccion_tipo,
          activo: o.activo,
          resultado_json: o.resultado_json as any,
        })),
      })),
    );

    const {
      lineasCalc,
      totales: freshTotales,
      totalesDocumento,
    } = await this.recalcularLineas(presupuestoId, false, actor);

    if (
      totalesDiffer(savedTotales, freshTotales) &&
      !opts.confirm_changed_totals
    ) {
      await this.audit(
        presupuestoId,
        'calculation_changed_before_emit',
        {
          total_anterior: savedTotales,
          total_actual: freshTotales,
          ambiguo: totalesDocumento.ambiguo,
        },
        actor,
      );
      throw new ConflictException({
        code: 'CALCULATION_CHANGED',
        message:
          'El cálculo vigente difiere del último resultado guardado. Revise totales y confirme para emitir.',
        total_anterior: savedTotales,
        total_actual: freshTotales,
        totales_documento: totalesDocumento,
      });
    }

    const emitted = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: number;
          codigo: string;
          prefijo: string;
          formato: string;
          padding: number;
          reset_anual: number | boolean;
          anio_actual: number | null;
          siguiente_numero: number;
          activo: number | boolean;
          brand_id: number;
        }>
      >`
        SELECT id, codigo, prefijo, formato, padding, reset_anual, anio_actual,
               siguiente_numero, activo, brand_id
        FROM v2_series_numeracion
        WHERE brand_id = ${pre.brand_id} AND activo = 1
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE
      `;

      if (!locked.length) {
        throw new BadRequestException(
          'No hay serie de numeración activa para este brand',
        );
      }
      const serieRow = locked[0];
      const allocated = allocateNextNumero({
        id: serieRow.id,
        codigo: serieRow.codigo,
        prefijo: serieRow.prefijo,
        formato: serieRow.formato,
        padding: serieRow.padding,
        reset_anual: Boolean(serieRow.reset_anual),
        anio_actual: serieRow.anio_actual,
        siguiente_numero: serieRow.siguiente_numero,
      });

      await tx.v2SeriesNumeracion.update({
        where: { id: serieRow.id },
        data: {
          anio_actual: allocated.nextAnio,
          siguiente_numero: allocated.nextSiguiente,
        },
      });

      const working = (pre.cliente_working_json as ClienteWorking) || null;
      const overrides =
        (pre.cliente_overrides_json as ClienteOverrides) || null;
      const snapshotCliente = resolveClienteEfectivo(working, overrides);

      const snapshotCompany = this.enrichCompanySnapshot(pre.company);
      const snapshotBrand = {
        brand_id: pre.brand.id,
        codigo: pre.brand.codigo,
        nombre: pre.brand.nombre,
        logo_ref: pre.brand.logo_ref,
        config: pre.brand.config_json,
        company_id: pre.brand.company_id,
      };

      const digitalesSnap = normalizeServiciosDigitales(
        pre.servicios_digitales_json ??
          digitalesFromBrandConfig(pre.brand.config_json),
      );
      const digitalesResolved = resolveAllDigitales(digitalesSnap);
      const digCob = sumDigitalesCobrables(digitalesSnap);
      // Digitals with 100% discount do not enter economic totals.
      const totalesConDigitales = {
        ...freshTotales,
        mensualidad_sin_iva:
          Math.round(
            (freshTotales.mensualidad_sin_iva + digCob.mensualidad_sin_iva) *
              100,
          ) / 100,
        anualidad_sin_iva:
          Math.round(
            (freshTotales.anualidad_sin_iva + digCob.anualidad_sin_iva) * 100,
          ) / 100,
      };

      const snapshotEconomico = {
        lineas: lineasCalc.map((l) => ({
          linea_id: l.linea_id,
          servicio_comercial_id: l.servicio_comercial_id,
          nombre: l.nombre,
          descripcion: l.descripcion,
          codigo_motor: l.codigo_motor,
          version_motor: l.version_motor,
          defaults_json: l.defaults_json,
          contenido_comercial: l.contenido_comercial,
          opciones: l.opciones.map((o) => ({
            opcion_id: o.opcion_id,
            etiqueta: o.etiqueta,
            orden: o.orden,
            seleccion_tipo: o.seleccion_tipo,
            descripcion_local: o.descripcion_local,
            jornada: o.jornada || null,
            codigo_motor: o.codigo_motor,
            version_motor: o.version_motor,
            inputs: o.inputs,
            resultado: o.resultado,
            params_usados: o.params_usados,
          })),
          inputs: l.inputs,
          resultado: l.resultado,
          params_usados: l.resultado?.params_usados,
        })),
        totales: freshTotales,
        totales_con_digitales_cobrables: totalesConDigitales,
        totales_documento: {
          ambiguo: totalesDocumento.ambiguo,
          totales_sin_alternativas: totalesDocumento.totales_sin_alternativas,
          alternativas: totalesDocumento.alternativas,
          digitales_cobrables: digCob,
        },
        servicios_digitales: digitalesResolved,
        calculated_at_emit: new Date().toISOString(),
        note_d48Manual:
          'V2: d48Manual override is applied to final totals (intentional correction vs Legacy)',
      };

      for (const l of lineasCalc) {
        for (const o of l.opciones) {
          if (o.opcion_id > 0) {
            await tx.v2PresupuestoServicioOpcion.update({
              where: { id: o.opcion_id },
              data: {
                codigo_motor: o.codigo_motor,
                version_motor: o.version_motor,
                inputs_json: o.inputs as Prisma.InputJsonValue,
                resultado_json: o.resultado as Prisma.InputJsonValue,
                params_usados_json: o.params_usados as Prisma.InputJsonValue,
                calculated_at: new Date(),
              },
            });
          }
        }
        await tx.v2PresupuestoServicio.update({
          where: { id: l.linea_id },
          data: {
            codigo_motor: l.codigo_motor,
            version_motor: l.version_motor,
            inputs_json: l.inputs as Prisma.InputJsonValue,
            resultado_json: l.resultado as Prisma.InputJsonValue,
            params_usados_json: l.resultado
              ?.params_usados as Prisma.InputJsonValue,
            calculated_at: new Date(),
          },
        });
      }

      const now = new Date();
      const updated = await tx.v2Presupuesto.update({
        where: { id: presupuestoId },
        data: {
          estado: 'EMITIDO',
          numero: allocated.snapshot.numero,
          serie_id: allocated.snapshot.serie_id,
          root_id: pre.root_id ?? presupuestoId,
          snapshot_cliente_json:
            (snapshotCliente as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          snapshot_company_json: snapshotCompany as Prisma.InputJsonValue,
          snapshot_brand_json: snapshotBrand as Prisma.InputJsonValue,
          snapshot_serie_json: allocated.snapshot as unknown as Prisma.InputJsonValue,
          snapshot_economico_json:
            snapshotEconomico as unknown as Prisma.InputJsonValue,
          snapshot_servicios_digitales_json:
            digitalesResolved as unknown as Prisma.InputJsonValue,
          totales_emitidos_json: {
            ...freshTotales,
            ambiguo: totalesDocumento.ambiguo,
            alternativas: totalesDocumento.alternativas,
            digitales_cobrables: digCob,
            con_digitales_cobrables: totalesConDigitales,
          } as unknown as Prisma.InputJsonValue,
          emitted_at: now,
          emitted_by: actor,
          updated_by: actor,
        },
      });

      // Link parent history: revisado por nueva versión (if any parent)
      if (pre.parent_id) {
        await this.audit(
          pre.parent_id,
          'revisado_por',
          {
            child_id: presupuestoId,
            child_numero: allocated.snapshot.numero,
          },
          actor,
          tx,
        );
      }

      await this.audit(
        presupuestoId,
        'number_assigned',
        { numero: allocated.snapshot.numero, serie: allocated.snapshot },
        actor,
        tx,
      );
      await this.audit(
        presupuestoId,
        'snapshot_created',
        {
          cliente: snapshotCliente,
          company_id: snapshotCompany.company_id,
          brand_id: snapshotBrand.brand_id,
          totales: freshTotales,
          ambiguo: totalesDocumento.ambiguo,
          opciones_count: lineasCalc.reduce(
            (n, l) => n + l.opciones.length,
            0,
          ),
        },
        actor,
        tx,
      );
      await this.audit(
        presupuestoId,
        'emitted',
        {
          numero: allocated.snapshot.numero,
          totales: freshTotales,
          ambiguo: totalesDocumento.ambiguo,
          confirmed_changed_totals: Boolean(opts.confirm_changed_totals),
        },
        actor,
        tx,
      );

      return updated;
    });

    return {
      id: emitted.id,
      numero: emitted.numero,
      estado: emitted.estado,
      emitted_at: emitted.emitted_at,
      totales: freshTotales,
      totales_documento: totalesDocumento,
      snapshot_summary: {
        cliente: emitted.snapshot_cliente_json,
        company: emitted.snapshot_company_json,
        brand: emitted.snapshot_brand_json,
        serie: emitted.snapshot_serie_json,
        lineas:
          (emitted.snapshot_economico_json as any)?.lineas?.length ??
          lineasCalc.length,
      },
    };
  }

  async clienteStatus(presupuestoId: number) {
    const p = await this.prisma.v2Presupuesto.findUnique({
      where: { id: presupuestoId },
    });
    if (!p) throw new NotFoundException('Presupuesto V2 no encontrado');
    const working = (p.cliente_working_json as ClienteWorking) || null;
    const overrides = (p.cliente_overrides_json as ClienteOverrides) || null;
    let stale = false;
    let live: ReturnType<typeof mapClienteRowToFicha> | null = null;
    if (p.cliente_id != null && p.estado === 'BORRADOR') {
      live = await this.loadClienteFicha(p.cliente_id);
      stale = detectFichaStale(working, live);
    }
    return {
      estado: p.estado,
      cliente_id: p.cliente_id,
      working,
      overrides,
      efectivo:
        p.estado === 'EMITIDO'
          ? p.snapshot_cliente_json
          : resolveClienteEfectivo(working, overrides),
      ficha_stale: stale,
      snapshot_cliente: p.snapshot_cliente_json,
    };
  }
}

export type { TotalesMoney };
export { normalizeTotales };
