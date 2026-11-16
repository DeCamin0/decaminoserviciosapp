import {
  IntentType,
  type IntentResult,
} from '../services/intent-classifier.service';
import type { AssistantLocale } from '../types/assistant-preferences.types';
import { looksLikeAppHelpDatosPersonales } from './assistant-app-help.util';
import { replyForSingleDaySchedule } from './assistant-day-schedule.util';
import { procedureText, type ProcedureId } from './assistant-procedure-catalog';
import { countAssistantDataRows } from './assistant-intent-tools.util';

export type OfflineDecision = {
  action: 'reply' | 'tool' | 'procedure' | 'clarify';
  intent?: IntentType;
  entidades?: NonNullable<IntentResult['entidades']>;
  procedureId?: ProcedureId;
  texto?: string;
};

type PageBits = { horario?: string; fichajes?: string } | null;

function fold(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksHow(text: string): boolean {
  return /\b(como|cum|how|unde|donde|where|solicito|solicitar|pido|pedir)\b/.test(
    text,
  );
}

const PUNCH = /\b(fich\w*|pontaj\w*|marcaj\w*|salida|entrada|jornada)\b/;
const PUNCH_PROBLEM =
  /\b(ol[vb]id\w*|uitat\w*|forgot\w*|bateria\w*|baterie\w*|no pude|no puedo|no me deja|no funciona|no marque|sin marcar|no se registra|no me aparecen)\b/;

export function matchOfflineProcedure(utterance: string): ProcedureId | null {
  const text = fold(utterance);
  if (!text) return null;
  if (
    /\b(borrar|eliminar|quitar|sterge)\b/.test(text) &&
    /\bjustificant/.test(text)
  ) {
    return 'justificante_no_borrar';
  }
  if (/\balbaran\b/.test(text)) return 'albaran_pedido';
  if (looksLikeAppHelpDatosPersonales(utterance)) return 'datos_personales';
  if (PUNCH.test(text) && PUNCH_PROBLEM.test(text)) return 'olvido_fichaje';
  if (/\bsalida\b/.test(text) && /\bincidencia\b/.test(text))
    return 'salida_incidencia';
  if (/\bincidencia\b/.test(text)) return 'no_documentada';
  if (asksHow(text) && /\b(vacacion\w*|concediu\w*|vacation\w*)\b/.test(text)) {
    return 'vacaciones_solicitud';
  }
  if (asksHow(text) && /\bpermiso\b/.test(text)) return 'permiso_retribuido';
  if (asksHow(text) && /\basuntos propios\b/.test(text))
    return 'asuntos_propios';
  if (
    /\bjustificant/.test(text) ||
    (asksHow(text) && /\bausencia\b/.test(text))
  ) {
    return 'ausencia_justificada';
  }
  if (/\bbaja voluntaria\b/.test(text)) return 'baja_voluntaria';
  if (asksHow(text) && /\b(jornada|fichar|fichaje|registro)\b/.test(text)) {
    return 'registrar_jornada';
  }
  if (asksHow(text) && /\bpedido/.test(text)) return 'pedidos_material';
  return null;
}

function greetingText(locale: AssistantLocale): string {
  if (locale === 'ro') {
    return 'Salut. Pot să caut programul, pontajele, concediile, cererile și pașii din aplicație.';
  }
  if (locale === 'en') {
    return 'Hello. I can look up the schedule, punches, time off, requests, and the app procedures.';
  }
  return 'Hola. Puedo mirar el horario, los fichajes, las vacaciones, las solicitudes y los procedimientos de la app.';
}

function unclearText(locale: AssistantLocale): string {
  if (locale === 'ro') {
    return 'Nu înțeleg fraza. Spune programul de azi, un pontaj, concediul sau cum se face ceva în aplicație.';
  }
  if (locale === 'en') {
    return 'I do not understand that sentence. Ask for today’s schedule, a punch, time off, or how to do something in the app.';
  }
  return 'No entiendo esa frase. Pregunta por el horario de hoy, un fichaje, las vacaciones o cómo se hace algo en la app.';
}

function pageOpenText(
  ctx: { horario?: string; fichajes?: string },
  locale: AssistantLocale,
): string {
  const horario = ctx.horario || '—';
  const fichajes = ctx.fichajes || '—';
  if (locale === 'ro') {
    return `Ești în Registro de Jornada.\nProgram vizibil: ${horario}\nPontaje vizibile: ${fichajes}\n\nCe problemă ai: intrarea, ieșirea sau programul?`;
  }
  if (locale === 'en') {
    return `You are on Registro de Jornada.\nSchedule on screen: ${horario}\nPunches on screen: ${fichajes}\n\nWhat is the problem: the entrance, the exit, or the schedule?`;
  }
  return `Estás en Registro de Jornada.\nHorario visible: ${horario}\nFichajes visibles: ${fichajes}\n\n¿Qué problema tienes: la entrada, la salida o el horario?`;
}

function isGreeting(text: string): boolean {
  return (
    /^(hola|hello|hi|hey|salut|buna|buenas|buenos dias)\b/.test(text) &&
    text.split(' ').length <= 4
  );
}

function toolFromWords(text: string): {
  intent: IntentType;
  entidades?: NonNullable<IntentResult['entidades']>;
} | null {
  if (/\b(diploma|certific)\w*\b/.test(text)) {
    return { intent: IntentType.DIPLOMAS };
  }
  if (/\b(nomina|nominas|fluturas)\w*\b/.test(text)) {
    return { intent: IntentType.NOMINAS };
  }
  if (
    /\b(vacacion\w*|concediu\w*)\b/.test(text) &&
    /\b(saldo|cuantos|cuantas|quedan|dias|zile)\b/.test(text)
  ) {
    return { intent: IntentType.VACACIONES };
  }
  if (
    /\bpedido/.test(text) &&
    /\b(lista|listado|cuantos|cuantas|ver)\b/.test(text)
  ) {
    return { intent: IntentType.PEDIDOS };
  }
  if (/\b(no ficho|sin fichar|no ha fichado|nu a pontat)\b/.test(text)) {
    return {
      intent: IntentType.FICHAJES,
      entidades: { tipo: 'fichajes_faltantes' },
    };
  }
  if (/\b(horario|cuadrante|turno|program|orar)\w*\b/.test(text)) {
    return { intent: IntentType.CUADRANTE };
  }
  if (
    /\b(quien|quienes|cine)\b/.test(text) &&
    /\b(trabaja|trabajo|turno)\b/.test(text)
  ) {
    return { intent: IntentType.CUADRANTE };
  }
  if (/\b(fichaj\w*|registros?|marcaj\w*)\b/.test(text)) {
    return { intent: IntentType.FICHAJES };
  }
  return null;
}

const DATA_INTENTS = new Set<string>([
  IntentType.FICHAJES,
  IntentType.CUADRANTE,
  IntentType.PEDIDOS,
  IntentType.VACACIONES,
  IntentType.SOLICITUDES,
  IntentType.NOMINAS,
  IntentType.DIPLOMAS,
  IntentType.DOCUMENTOS,
  IntentType.DOCUMENTOS_SOLICITADOS,
  IntentType.COMUNICADOS,
  IntentType.EMPLEADOS,
]);

export function decideWithoutModel(input: {
  utterance: string;
  pageContext: PageBits;
  hint: string;
  locale: AssistantLocale;
}): OfflineDecision {
  if (!input.utterance.trim()) {
    return {
      action: 'clarify',
      texto: input.pageContext
        ? pageOpenText(input.pageContext, input.locale)
        : unclearText(input.locale),
    };
  }
  const procedureId = matchOfflineProcedure(input.utterance);
  if (procedureId) return { action: 'procedure', procedureId };
  const text = fold(input.utterance);
  if (isGreeting(text))
    return { action: 'reply', texto: greetingText(input.locale) };
  const fromWords = toolFromWords(text);
  if (fromWords) return { action: 'tool', ...fromWords };
  const hint = /^([a-z_]+)\s+\(([0-9.]+)\)/.exec(input.hint.trim());
  const hintIntent = hint?.[1];
  const hintScore = hint ? Number(hint[2]) : 0;
  if (hintIntent && DATA_INTENTS.has(hintIntent) && hintScore >= 0.72) {
    return { action: 'tool', intent: hintIntent as IntentType };
  }
  return { action: 'clarify', texto: unclearText(input.locale) };
}

export function sinModeloLead(locale: AssistantLocale): string {
  if (locale === 'ro') {
    return 'Răspund fără model, din datele și procedurile aplicației.';
  }
  if (locale === 'en') {
    return 'I am answering without the model, using the app data and procedures.';
  }
  return 'Respondo sin el modelo, con los datos y los procedimientos de la app.';
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is Record<string, unknown> =>
        row != null && typeof row === 'object' && !Array.isArray(row),
    );
  }
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (
      Array.isArray(body.solicitudes) ||
      Array.isArray(body.ausencias_calendario)
    ) {
      return [
        ...(Array.isArray(body.solicitudes) ? body.solicitudes : []),
        ...(Array.isArray(body.ausencias_calendario)
          ? body.ausencias_calendario
          : []),
      ].filter(
        (row): row is Record<string, unknown> =>
          row != null && typeof row === 'object' && !Array.isArray(row),
      );
    }
    return [body];
  }
  return [];
}

function summarizeRows(data: unknown, locale: AssistantLocale): string {
  const rows = rowsOf(data);
  if (rows.length === 0) {
    if (locale === 'ro') return 'Consulta nu a găsit rânduri.';
    if (locale === 'en') return 'The query found no rows.';
    return 'La consulta no encontró filas.';
  }
  const lines = rows.slice(0, 8).map((row, index) => {
    const bits = Object.entries(row)
      .filter(([key, value]) => {
        if (value == null || value === '') return false;
        return !/contrase|password|iban|dni|nss|seguridad|correo|email|direccion|domicilio|salario|motivo/i.test(
          key,
        );
      })
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${String(value).slice(0, 80)}`);
    return `${index + 1}. ${bits.join(' · ') || '—'}`;
  });
  const more =
    rows.length > lines.length
      ? locale === 'ro'
        ? `\n… și încă ${rows.length - lines.length}.`
        : `\n… y ${rows.length - lines.length} más.`
      : '';
  return `${lines.join('\n')}${more}`;
}

export function offlineBody(input: {
  locale: AssistantLocale;
  utterance: string;
  pageContext: PageBits;
  decision: OfflineDecision;
  data?: unknown;
  toolError?: string | null;
}): string {
  if (input.toolError) {
    if (input.locale === 'ro')
      return 'Consulta nu a putut fi citită. Nu inventez rezultatul.';
    if (input.locale === 'en')
      return 'The query could not be read. I am not inventing the result.';
    return 'No he podido leer la consulta. No invento el resultado.';
  }
  if (input.decision.action === 'procedure' && input.decision.procedureId) {
    return procedureText(input.decision.procedureId);
  }
  if (input.decision.action === 'tool') {
    const day = replyForSingleDaySchedule(
      input.utterance,
      input.decision.entidades?.fecha,
      input.data,
      input.locale,
    );
    if (day) return day;
    if (
      countAssistantDataRows(input.data) === 0 &&
      input.decision.intent === IntentType.CUADRANTE &&
      input.pageContext?.horario
    ) {
      return `La consulta no encontró filas. En la página se ve este horario: ${input.pageContext.horario}`;
    }
    return summarizeRows(input.data, input.locale);
  }
  if (input.decision.texto) return input.decision.texto;
  if (input.pageContext) return pageOpenText(input.pageContext, input.locale);
  return unclearText(input.locale);
}

export async function answerWithoutModel(input: {
  locale: AssistantLocale;
  utterance: string;
  pageContext: PageBits;
  decision: OfflineDecision;
  runTool: (
    intent: IntentType,
    entidades: NonNullable<IntentResult['entidades']>,
  ) => Promise<{ data: unknown; tool: string | null; error: string | null }>;
  adjustEntities?: (
    intent: IntentType,
    entidades: NonNullable<IntentResult['entidades']> | undefined,
  ) => NonNullable<IntentResult['entidades']>;
  already?: {
    data: unknown;
    tool: string | null;
    error: string | null;
    entidades?: NonNullable<IntentResult['entidades']>;
  };
}): Promise<{
  body: string;
  intentLabel: string;
  intentType?: IntentType;
  entidades?: NonNullable<IntentResult['entidades']>;
  tools: string[];
  resultCount: number;
  toolData?: unknown;
  queryFailed: boolean;
  responseType:
    | 'knowledge_base'
    | 'data'
    | 'clarification'
    | 'generated_summary';
}> {
  let decision = input.decision;
  let toolData = input.already?.data;
  let toolName = input.already?.tool ?? null;
  let toolError = input.already?.error ?? null;
  let entidades = input.already?.entidades ?? decision.entidades;
  if (input.already?.entidades) {
    decision = { ...decision, entidades: input.already.entidades };
  }
  if (!input.already && decision.action === 'tool' && decision.intent) {
    entidades = input.adjustEntities
      ? input.adjustEntities(decision.intent, decision.entidades)
      : { ...(decision.entidades ?? {}) };
    decision = { ...decision, entidades };
    const ran = await input.runTool(decision.intent, entidades);
    toolData = ran.data;
    toolName = ran.tool;
    toolError = ran.error;
  }
  const responseType =
    decision.action === 'procedure'
      ? 'knowledge_base'
      : decision.action === 'tool'
        ? 'data'
        : decision.action === 'clarify'
          ? 'clarification'
          : 'generated_summary';
  const intentLabel =
    decision.action === 'procedure'
      ? `procedure:${decision.procedureId}`
      : decision.intent || decision.action;
  return {
    body: offlineBody({
      locale: input.locale,
      utterance: input.utterance,
      pageContext: input.pageContext,
      decision,
      data: toolData,
      toolError,
    }),
    intentLabel,
    intentType: decision.intent,
    entidades,
    tools: toolName ? [toolName] : [],
    resultCount: countAssistantDataRows(toolData),
    toolData,
    queryFailed: Boolean(toolError),
    responseType,
  };
}
