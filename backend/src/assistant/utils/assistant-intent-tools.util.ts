import { IntentType } from '../services/intent-classifier.service';

/**
 * Nombres alineados con AssistantReadToolsService (solo metadatos de auditoría).
 */
export function resolveAssistantTools(
  intent: IntentType,
  entidades?: {
    tipo?: string;
    mes?: string;
    year?: string;
    fecha?: string;
    soloPendientes?: boolean;
    proximos_dias?: number;
    faltan_nominas?: boolean;
  },
): string[] {
  switch (intent) {
    case IntentType.FICHAJES:
      return entidades?.tipo === 'fichajes_faltantes'
        ? ['fichajes_ausencias_plan']
        : ['fichajes_registro'];
    case IntentType.CUADRANTE:
      return entidades?.fecha ? ['plan_trabajo_dia'] : ['cuadrante_mes'];
    case IntentType.PEDIDOS:
      return ['pedidos_resumen'];
    case IntentType.VACACIONES:
      return entidades?.mes || entidades?.year || entidades?.soloPendientes
        ? ['vacaciones_solicitudes']
        : ['vacaciones_saldo'];
    case IntentType.EMPLEADOS:
      return ['empleados_resumen_operativo'];
    case IntentType.NOMINAS:
      return ['nominas_metadatos'];
    case IntentType.DIPLOMAS:
      return ['diplomas_metadatos'];
    case IntentType.DOCUMENTOS:
      return ['documentos_inspeccion_metadatos'];
    case IntentType.DOCUMENTOS_SOLICITADOS:
      return ['documentos_solicitados_metadatos'];
    case IntentType.SOLICITUDES:
      return ['solicitudes_tabla', 'ausencias_calendario'];
    case IntentType.COMUNICADOS:
      return ['comunicados_list'];
    case IntentType.PROCEDIMIENTOS:
      return ['knowledge_base_articulos'];
    case IntentType.INCIDENCIAS:
      return ['escalation_ticket'];
    default:
      return [];
  }
}

export function countAssistantDataRows(data: unknown): number {
  if (data === null || data === undefined) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === 'object' && data !== null) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.solicitudes) && Array.isArray(o.ausencias_calendario)) {
      return o.solicitudes.length + o.ausencias_calendario.length;
    }
    return Object.keys(o).length > 0 ? 1 : 0;
  }
  return 0;
}

/** Intents con filas tabulares exportables (Excel/TXT/PDF), salvo PROCEDIMIENTOS/KB. */
export function isAssistantTabularExportIntent(intent: IntentType): boolean {
  switch (intent) {
    case IntentType.FICHAJES:
    case IntentType.CUADRANTE:
    case IntentType.PEDIDOS:
    case IntentType.VACACIONES:
    case IntentType.EMPLEADOS:
    case IntentType.NOMINAS:
    case IntentType.DIPLOMAS:
    case IntentType.DOCUMENTOS:
    case IntentType.DOCUMENTOS_SOLICITADOS:
    case IntentType.SOLICITUDES:
    case IntentType.COMUNICADOS:
      return true;
    default:
      return false;
  }
}
