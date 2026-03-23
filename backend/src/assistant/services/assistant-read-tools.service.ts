import { Injectable } from '@nestjs/common';
import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { DataQueryService } from './data-query.service';
import { VacacionesService } from '../../services/vacaciones.service';
import {
  WHITELIST_CUADRANTE,
  WHITELIST_DIPLOMAS_METADATOS,
  WHITELIST_DOCUMENTOS_INSPECCION,
  WHITELIST_EMPLEADOS_LISTADO,
  WHITELIST_EMPLEADO_CONTRATO,
  WHITELIST_FICHAJES_FALTANTES,
  WHITELIST_FICHAJES_REGISTRO,
  WHITELIST_COMUNICADOS,
  WHITELIST_DOCUMENTOS_SOLICITADOS,
  WHITELIST_KB_ARTICULO,
  WHITELIST_NOMINAS_METADATOS,
  WHITELIST_PEDIDOS,
  WHITELIST_PLAN_TRABAJO_DIA,
  WHITELIST_AUSENCIAS_CALENDARIO,
  WHITELIST_SOLICITUDES_TABLA,
  WHITELIST_VACACIONES_SOLICITUDES,
  WHITELIST_VACACIONES_SALDO_FLAT,
} from '../constants/assistant-read-tools.registry';
import {
  pickAssistantFields,
  pickAssistantRows,
  truncateKbContenido,
} from '../utils/assistant-output-sanitize.util';
import type { KbQueryMeta } from '../types/kb-query.types';

/**
 * Capa de herramientas read-only del asistente.
 * Toda lectura de datos para el LLM debe pasar por aquí: SQL ya restringido por RBAC + whitelist explícita.
 *
 * Política de roles:
 * - Todos los métodos requieren userId + rol procedentes del JWT (no del body).
 * - Admin / supervisor / manager / jefe / developer: RBAC = acceso completo a filas permitidas por cada query.
 * - Empleado: RBAC = solo CODIGO propio (misma lógica que RbacService en DataQueryService).
 *
 * Parametrul opțional `dataScope` (ALL | OWN) trebuie aliniat cu rolul JWT; implicit se derivă din `rol`
 * în DataQueryService prin RbacService.effectiveDataScope. Se expune aici pentru consistență API și teste.
 */

@Injectable()
export class AssistantReadToolsService {
  constructor(
    private readonly dataQuery: DataQueryService,
    private readonly vacacionesService: VacacionesService,
  ) {}

  private asRows(raw: unknown): Record<string, unknown>[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((r) =>
      r && typeof r === 'object' ? (r as Record<string, unknown>) : {},
    );
  }

  /**
   * Tool: fichajes_registro
   * Input: userId, rol, entidades opcionales (fecha, mes, codigo).
   * Output: filas fichaje (sin email ni dirección exacta de fichaje).
   */
  async fichajesRegistro(
    userId: string,
    rol: string | null,
    entidades?: {
      codigo?: string;
      fecha?: string;
      mes?: string;
      year?: string;
    },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryFichajes(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_FICHAJES_REGISTRO);
  }

  /**
   * Tool: fichajes_ausencias_plan
   * Input: userId, rol, fecha opcional.
   * Output: empleados con plan del día vs fichaje (operaciones).
   */
  async fichajesAusenciasPlan(
    userId: string,
    rol: string | null,
    fecha?: string,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryFichajesFaltantes(
      userId,
      rol,
      fecha,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_FICHAJES_FALTANTES);
  }

  /**
   * Tool: cuadrante_mes
   * Input: userId, rol, entidades (mes, codigo opcional).
   * Output: resumen cuadrante (sin email).
   */
  async cuadranteMes(
    userId: string,
    rol: string | null,
    entidades?: { codigo?: string; mes?: string; nombre?: string },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryCuadrante(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_CUADRANTE);
  }

  /**
   * Tool: pedidos_resumen
   */
  async pedidosResumen(
    userId: string,
    rol: string | null,
    entidades?: { mes?: string; year?: string },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryPedidosForAssistant(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_PEDIDOS);
  }

  /**
   * Tool: plan_trabajo_dia
   * Mismo daily_plan que fichajes faltantes, sin filtro de fichaje (cuadrante vs horario, 3 segmentos).
   */
  async planTrabajoDia(
    userId: string,
    rol: string | null,
    fecha?: string,
    dataScope?: AssistantDataScope,
    empleado?: { codigo?: string; nombre?: string; centro?: string },
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryDailyPlanDiaForAssistant(
      userId,
      rol,
      fecha,
      dataScope,
      empleado,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_PLAN_TRABAJO_DIA);
  }

  /**
   * Tool: vacaciones_solicitudes
   * Input: userId, rol, entidades (mes, tipo).
   * Output: solicitudes (sin email ni motivo).
   */
  async vacacionesSolicitudes(
    userId: string,
    rol: string | null,
    entidades?: {
      mes?: string;
      year?: string;
      tipo?: string;
      soloPendientes?: boolean;
    },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryVacaciones(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(
      this.asRows(raw),
      WHITELIST_VACACIONES_SOLICITUDES,
    );
  }

  /**
   * Tool: solicitudes_tabla — toate tipurile din `solicitudes` (RBAC pe codigo).
   */
  async solicitudesTabla(
    userId: string,
    rol: string | null,
    entidades?: {
      tipo?: string;
      soloPendientes?: boolean;
      fecha?: string;
      mes?: string;
      year?: string;
      proximos_dias?: number;
    },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.querySolicitudes(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_SOLICITUDES_TABLA);
  }

  /**
   * Tool: ausencias_calendario — tabla `Ausencias` (misma lógica que n8n Cron absente).
   */
  async ausenciasCalendario(
    userId: string,
    rol: string | null,
    entidades?: {
      fecha?: string;
      mes?: string;
      year?: string;
      proximos_dias?: number;
    },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryAusenciasCalendarioForAssistant(
      userId,
      rol,
      entidades,
      dataScope,
    );
    const rows = pickAssistantRows(
      this.asRows(raw),
      WHITELIST_AUSENCIAS_CALENDARIO,
    );
    return rows.map((r) => ({ ...r, fuente: 'ausencias_registro' }));
  }

  /**
   * Tool: comunicados_list
   * Lista publicărilor e comună tuturor; `rol` / `dataScope` nu schimbă rândurile (vezi DataQuery).
   */
  async comunicadosList(
    userId: string,
    rol?: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryComunicadosForAssistant(
      userId,
      rol,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_COMUNICADOS);
  }

  /**
   * Tool: documentos_solicitados_metadatos
   */
  async documentosSolicitadosMetadatos(
    userId: string,
    rol: string | null,
    entidades?: { soloPendientes?: boolean },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryDocumentosSolicitadosForAssistant(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(
      this.asRows(raw),
      WHITELIST_DOCUMENTOS_SOLICITADOS,
    );
  }

  /**
   * Tool: vacaciones_saldo
   * Input: userId (solo el propio empleado; el servicio ya valida existencia).
   * `dataScope`: saldo-ul rămâne mereu al utilizatorului JWT (OWN); ALL nu extinde la alți angajați.
   * Output: objeto plano con saldo de vacaciones (subset explícito, compatible con el asistente actual).
   */
  async vacacionesSaldo(
    userId: string,
    /** Paritate API; saldo-ul este mereu pentru `userId` (JWT), nu se extinde cu ALL. */
    _dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>> {
    const vacacionesData = await this.vacacionesService.calcularSaldo(userId);
    const raw: Record<string, unknown> = {
      dias_anuales: vacacionesData.vacaciones.dias_anuales,
      dias_generados_hasta_hoy:
        vacacionesData.vacaciones.dias_generados_hasta_hoy,
      dias_consumidos_aprobados:
        vacacionesData.vacaciones.dias_consumidos_aprobados,
      dias_restantes: vacacionesData.vacaciones.dias_restantes,
    };
    return pickAssistantFields(raw, WHITELIST_VACACIONES_SALDO_FLAT);
  }

  /**
   * Tool: empleado_mis_datos_contrato
   * Solo fila propia (JWT); campos de contrato sin datos salariales.
   */
  async empleadoMisDatosContrato(
    userId: string,
    rol: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryMisDatosContrato(
      userId,
      rol,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_EMPLEADO_CONTRATO);
  }

  /**
   * Tool: empleados_resumen_operativo
   * Input: userId, rol, filtro opcional.
   * Output: listado operativo (sin email).
   */
  async empleadosResumenOperativo(
    userId: string,
    rol: string | null,
    filtro?: string,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryListadoEmpleados(
      userId,
      rol,
      filtro,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_EMPLEADOS_LISTADO);
  }

  /**
   * Tool: nominas_metadatos
   * Input: userId, rol, entidades (mes).
   * Output: metadatos de nóminas; empleado solo ve filas con su codigo_empleado.
   */
  async nominasMetadatos(
    userId: string,
    rol: string | null,
    entidades?: {
      mes?: string;
      year?: string;
      faltan_nominas?: boolean;
    },
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryNominas(
      userId,
      rol,
      entidades,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_NOMINAS_METADATOS);
  }

  /**
   * Tool: diplomas_metadatos — tabla `diplomas` (sin PDF).
   */
  async diplomasMetadatos(
    userId: string,
    rol: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryDiplomasForAssistant(
      userId,
      rol,
      dataScope,
    );
    return pickAssistantRows(this.asRows(raw), WHITELIST_DIPLOMAS_METADATOS);
  }

  /**
   * Tool: documentos_inspeccion_metadatos
   */
  async documentosInspeccionMetadatos(
    userId: string,
    rol: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const raw = await this.dataQuery.queryDocumentos(userId, rol, dataScope);
    return pickAssistantRows(this.asRows(raw), WHITELIST_DOCUMENTOS_INSPECCION);
  }

  /**
   * Tool: knowledge_base_articulos
   * Input: término de búsqueda / categoría.
   * Output: artículos activos; contenido truncado.
   */
  async knowledgeBaseArticulos(
    searchTerm?: string,
    categoria?: string,
  ): Promise<{
    rows: Record<string, unknown>[];
    meta: KbQueryMeta;
  }> {
    const { rows: rawRows, meta } = await this.dataQuery.queryKbArticles(
      categoria,
      searchTerm,
    );
    const rows = truncateKbContenido(this.asRows(rawRows));
    return {
      rows: rows.map((r) => pickAssistantFields(r, [...WHITELIST_KB_ARTICULO])),
      meta,
    };
  }
}
