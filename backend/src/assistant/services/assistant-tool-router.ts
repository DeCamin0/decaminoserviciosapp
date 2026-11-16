import { IntentType, type IntentResult } from './intent-classifier.service';

/** Unelte deja implementate. Modelul alege una. Nu primește SQL. */
export const ASSISTANT_ROUTER_TOOLS = [
  'fichajes',
  'cuadrante',
  'pedidos',
  'vacaciones',
  'solicitudes',
  'nominas',
  'diplomas',
  'documentos',
  'documentos_solicitados',
  'comunicados',
  'procedimientos',
  'incidencias',
  'empleados',
  'ninguna',
] as const;

export type AssistantRouterTool = (typeof ASSISTANT_ROUTER_TOOLS)[number];

const FILTROS = new Set([
  'sin_cuadrante',
  'sin_horario',
  'sin_centro',
  'sin_cuadrante_ni_horario',
  'sin_cuadrante_o_horario',
  'sin_centro_ni_cuadrante_ni_horario',
]);

const TOOL_TO_INTENT: Record<
  Exclude<AssistantRouterTool, 'ninguna'>,
  IntentType
> = {
  fichajes: IntentType.FICHAJES,
  cuadrante: IntentType.CUADRANTE,
  pedidos: IntentType.PEDIDOS,
  vacaciones: IntentType.VACACIONES,
  solicitudes: IntentType.SOLICITUDES,
  nominas: IntentType.NOMINAS,
  diplomas: IntentType.DIPLOMAS,
  documentos: IntentType.DOCUMENTOS,
  documentos_solicitados: IntentType.DOCUMENTOS_SOLICITADOS,
  comunicados: IntentType.COMUNICADOS,
  procedimientos: IntentType.PROCEDIMIENTOS,
  incidencias: IntentType.INCIDENCIAS,
  empleados: IntentType.EMPLEADOS,
};

export type AssistantRouterChoice = {
  intent: IntentType;
  confianza: number;
  entidades: NonNullable<IntentResult['entidades']>;
};

function stripControls(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) <= 31) continue;
    out += value[i];
  }
  return out;
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = stripControls(value).trim();
  if (!text || text.length > max) return undefined;
  return text;
}

function cleanDate(value: unknown): string | undefined {
  const text = cleanText(value, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  return text;
}

function cleanMonth(value: unknown): string | undefined {
  const text = cleanText(value, 7);
  if (!text || !/^\d{4}-\d{2}$/.test(text)) return undefined;
  return text;
}

function cleanYear(value: unknown): string | undefined {
  const text = cleanText(value, 4);
  if (!text || !/^\d{4}$/.test(text)) return undefined;
  return text;
}

function cleanCodigo(value: unknown): string | undefined {
  const text = cleanText(value, 50);
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return undefined;
  return text;
}

/**
 * Validează argumentele alese de model. `ninguna` și uneltele necunoscute
 * nu schimbă fluxul vechi.
 */
export function parseRouterToolArguments(
  raw: unknown,
): AssistantRouterChoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const tool = cleanText(body.tool, 40);
  if (!tool || tool === 'ninguna') return null;
  if (!ASSISTANT_ROUTER_TOOLS.includes(tool as AssistantRouterTool))
    return null;
  const intent =
    TOOL_TO_INTENT[tool as Exclude<AssistantRouterTool, 'ninguna'>];
  if (!intent) return null;

  const entidades: NonNullable<IntentResult['entidades']> = {};
  const fecha = cleanDate(body.fecha);
  const mes = cleanMonth(body.mes);
  const year = cleanYear(body.year);
  const codigo = cleanCodigo(body.codigo);
  const nombre = cleanText(body.nombre, 80);
  const centro = cleanText(body.centro, 80);
  const filtro = cleanText(body.filtro, 48);
  if (fecha) entidades.fecha = fecha;
  if (mes) entidades.mes = mes;
  if (year) entidades.year = year;
  if (codigo) entidades.codigo = codigo;
  if (nombre) entidades.nombre = nombre;
  if (centro) entidades.centro = centro;
  if (filtro && FILTROS.has(filtro)) entidades.filtro = filtro;
  if (body.soloPendientes === true) entidades.soloPendientes = true;
  if (body.faltanNominas === true) entidades.faltan_nominas = true;
  if (body.quienNoHaFichado === true) entidades.tipo = 'fichajes_faltantes';

  return { intent, confianza: 0.74, entidades };
}
