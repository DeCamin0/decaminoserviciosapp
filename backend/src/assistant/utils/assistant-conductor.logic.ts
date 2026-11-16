import {
  IntentType,
  type IntentResult,
} from '../services/intent-classifier.service';
import { parseRouterToolArguments } from '../services/assistant-tool-router';
import { countAssistantDataRows } from './assistant-intent-tools.util';
import {
  answerWithoutModel,
  decideWithoutModel,
  sinModeloLead,
  type OfflineDecision,
} from './assistant-offline.util';
import {
  extractRelativeDayIso,
  messageImpliesWholeMonthSchedule,
} from './month-and-relative-dates.util';
import { messageAsksOwnSchedule } from './assistant-day-schedule.util';
import type { AssistantLocale } from '../types/assistant-preferences.types';
import type {
  AssistantResponseSourceKind,
  AssistantResponseStatus,
  AssistantResponseType,
} from '../dto/message.dto';
import {
  isProcedureId,
  procedureCatalogForPrompt,
  procedureText,
  type ProcedureId,
} from './assistant-procedure-catalog';

export type ConductorChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ConductorHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type PageContext = {
  pagina: string;
  fecha?: string;
  centro?: string;
  asignado?: string;
  horario?: string;
  fichajes?: string;
};

export type ConductorAction = 'reply' | 'tool' | 'procedure' | 'clarify';

export type ConductorDecision = {
  action: ConductorAction;
  intent?: IntentType;
  entidades?: NonNullable<IntentResult['entidades']>;
  procedureId?: ProcedureId;
  texto?: string;
};

export type ConductorTurnResult = {
  respuesta: string;
  responseSource: AssistantResponseSourceKind;
  answerAuthor: 'model' | 'fallback';
  responseType: AssistantResponseType;
  status: AssistantResponseStatus;
  intentLabel: string;
  intentType?: IntentType;
  entidades?: NonNullable<IntentResult['entidades']>;
  tools: string[];
  resultCount: number;
  toolData?: unknown;
  limitations?: string[];
};

const FORBIDDEN_TEMPLATES = [
  'No se encontró información del cuadrante para el período consultado.',
  'Se encontró información del cuadrante.',
  '(Respuesta sin IA.)',
  'Te guío con pasos generales',
  'Para poder ayudarte con los registros de fichaje, necesito que especifiques',
  'registros de fichaje de este mes para todos los empleados activos',
];

function clip(value: string, max: number): string {
  const text = value.replace(/\0/g, '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function lineValue(text: string, label: string): string | undefined {
  const re = new RegExp(`^.*${label}:\\s*(.+)$`, 'im');
  const match = re.exec(text);
  const value = match?.[1]
    ?.replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u, '')
    .trim();
  if (!value) return undefined;
  return clip(value, 180);
}

function sectionAfter(
  text: string,
  start: string,
  end?: string,
): string | undefined {
  const lines = text.split(/\r?\n/);
  const startAt = lines.findIndex((line) =>
    line.toLowerCase().includes(start.toLowerCase()),
  );
  if (startAt < 0) return undefined;
  const endAt = end
    ? lines.findIndex(
        (line, index) =>
          index > startAt && line.toLowerCase().includes(end.toLowerCase()),
      )
    : lines.length;
  const body = lines
    .slice(startAt + 1, endAt < 0 ? lines.length : endAt)
    .join('\n')
    .trim();
  if (!body) return undefined;
  return clip(body, 700);
}

export function isJornadaBootstrap(raw: string): boolean {
  const text = String(raw ?? '').trim();
  return (
    /^hola,\s+tengo un problema con el sistema de registro de jornada\./i.test(
      text,
    ) && /PAGINA:\s*Registro de Jornada/i.test(text)
  );
}

export function splitPageContext(raw: string): {
  pageContext: PageContext | null;
  utterance: string;
} {
  const text = String(raw ?? '')
    .replace(/\0/g, '')
    .trim();
  if (!isJornadaBootstrap(text)) {
    return { pageContext: null, utterance: text };
  }
  const pageContext: PageContext = {
    pagina: 'Registro de Jornada',
    fecha: lineValue(text, 'FECHA'),
    centro: lineValue(text, 'CENTRO'),
    asignado: lineValue(text, 'ASIGNADO'),
    horario: sectionAfter(
      text,
      'HORARIO planificado para hoy',
      'Últimos FICHAJES',
    ),
    fichajes: sectionAfter(text, 'Últimos FICHAJES'),
  };
  return { pageContext, utterance: '' };
}

export function latestPageContext(
  current: PageContext | null,
  history: ConductorHistoryTurn[],
): PageContext | null {
  if (current) return current;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role !== 'user') continue;
    const split = splitPageContext(history[i].content);
    if (split.pageContext) return split.pageContext;
  }
  return null;
}

function historyForModel(
  history: ConductorHistoryTurn[],
): ConductorChatMessage[] {
  return history.slice(-8).map((turn) => {
    if (turn.role === 'user' && isJornadaBootstrap(turn.content)) {
      return {
        role: 'user' as const,
        content:
          '(Abrió el chat desde Registro de Jornada, sin otra pregunta.)',
      };
    }
    return { role: turn.role, content: clip(turn.content, 1200) };
  });
}

export function formatPageContext(ctx: PageContext | null): string {
  if (!ctx) return '';
  return [
    'CONTEXTO DE PÁGINA (no es la pregunta del usuario):',
    `Página: ${ctx.pagina}`,
    ctx.fecha ? `Fecha en pantalla: ${ctx.fecha}` : '',
    ctx.asignado ? `Asignado: ${ctx.asignado}` : '',
    ctx.centro
      ? `Campo CENTRO de la pantalla (puede ser el puesto de trabajo; no lo uses como filtro): ${ctx.centro}`
      : '',
    ctx.horario ? `Horario ya visible en la página:\n${ctx.horario}` : '',
    ctx.fichajes ? `Fichajes ya visibles en la página:\n${ctx.fichajes}` : '',
    'No pidas de nuevo la fecha, el horario ni los fichajes que ya están aquí.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDecisionSystemPrompt(hint: string): string {
  return [
    'Eres el asistente de una aplicación de empleados. Tú conduces la conversación.',
    'El indicio de palabras NO es la decisión. Puedes ignorarlo.',
    `Indicio: ${clip(hint || 'ninguno', 80)}.`,
    'Elige una sola acción:',
    '- reply: conversación general, saludo o pregunta que no pide datos ni un procedimiento. No listas los módulos salvo que pregunten qué sabes hacer.',
    '- clarify: falta un dato que no está en el contexto ni en la conversación. Haz una sola pregunta.',
    '- procedure: explica un procedimiento del catálogo, con su id. No inventes botones.',
    '- tool: hace falta una consulta de solo lectura. No escribas SQL.',
    'Si el usuario aún no ha hecho una pregunta y solo abrió el chat desde la página, action=clarify. No elijas tool.',
    'Un problema de fichaje (se olvidó, no le deja, no funciona, salida mal) es un procedimiento, no un listado de fichajes y no pidas un período que ya conoces.',
    '«quién» no significa fichajes. Un diploma es la herramienta diplomas. Quién trabaja hoy en un centro es cuadrante de ese día. Quién debía trabajar y no fichó es fichajes con quienNoHaFichado=true.',
    'El horario de un día usa fecha YYYY-MM-DD. El mes completo usa mes YYYY-MM y no fecha.',
    'Entiende faltas de ortografía y frases incompletas.',
    'texto solo en reply o clarify, sin inventar horarios, saldos, nombres ni importes.',
    'Catálogo de procedimientos:',
    procedureCatalogForPrompt(),
  ].join('\n');
}

export function buildDecisionMessages(input: {
  mensaje: string;
  history: ConductorHistoryTurn[];
  hint: string;
}): {
  messages: ConductorChatMessage[];
  utterance: string;
  pageContext: PageContext | null;
} {
  const split = splitPageContext(input.mensaje);
  const pageContext = latestPageContext(split.pageContext, input.history);
  const pageBlock = formatPageContext(pageContext);
  const utterance =
    split.utterance ||
    '(El usuario todavía no ha escrito una pregunta. Solo abrió el chat desde la página.)';
  const messages: ConductorChatMessage[] = [
    { role: 'system', content: buildDecisionSystemPrompt(input.hint) },
    ...historyForModel(input.history),
  ];
  if (pageBlock) {
    messages.push({ role: 'user', content: pageBlock });
  }
  messages.push({ role: 'user', content: clip(utterance, 1500) });
  return { messages, utterance: split.utterance, pageContext };
}

function cleanTexto(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = clip(value, 2000);
  return text || undefined;
}

export function parseConductorDecision(raw: unknown): ConductorDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const action = body.action;
  if (
    action !== 'reply' &&
    action !== 'tool' &&
    action !== 'procedure' &&
    action !== 'clarify'
  ) {
    return null;
  }
  if (action === 'tool') {
    const routed = parseRouterToolArguments(body);
    if (!routed) {
      return { action: 'clarify', texto: cleanTexto(body.texto) };
    }
    return {
      action: 'tool',
      intent: routed.intent,
      entidades: routed.entidades,
    };
  }
  if (action === 'procedure') {
    const id =
      typeof body.procedureId === 'string' ? body.procedureId.trim() : '';
    return {
      action: 'procedure',
      procedureId: isProcedureId(id) ? id : 'no_documentada',
    };
  }
  return { action, texto: cleanTexto(body.texto) };
}

export function applyDecisionGuards(
  decision: ConductorDecision,
  utterance: string,
): ConductorDecision {
  if (!utterance.trim()) {
    return { action: 'clarify' };
  }
  if (decision.intent === IntentType.INCIDENCIAS) {
    return { action: 'procedure', procedureId: 'no_documentada' };
  }
  return decision;
}

function samePlace(a: string, b: string): boolean {
  const fold = (value: string) =>
    value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  return fold(a) === fold(b);
}

export function adjustToolEntities(
  utterance: string,
  userId: string,
  intent: IntentType,
  entidades: NonNullable<IntentResult['entidades']> | undefined,
  pageContext: PageContext | null,
): NonNullable<IntentResult['entidades']> {
  const next = { ...(entidades ?? {}) };
  if (intent === IntentType.CUADRANTE) {
    if (messageImpliesWholeMonthSchedule(utterance)) {
      delete next.fecha;
    } else {
      const day = extractRelativeDayIso(utterance);
      if (day) next.fecha = day;
    }
    if (messageAsksOwnSchedule(utterance) && userId) {
      next.codigo = userId;
      delete next.nombre;
    }
    if (
      next.centro &&
      pageContext?.centro &&
      samePlace(next.centro, pageContext.centro)
    ) {
      delete next.centro;
    }
  }
  return next;
}

export function containsForbiddenTemplate(text: string): boolean {
  return FORBIDDEN_TEMPLATES.some((piece) => text.includes(piece));
}

export function honestFallbackText(locale: AssistantLocale): string {
  if (locale === 'ro') {
    return 'Asistentul nu este disponibil acum, pentru că nu am legătură cu modelul. Nu am consultat datele tale. Mesajul acesta nu este un răspuns al modelului. Încearcă din nou peste câteva minute.';
  }
  if (locale === 'en') {
    return 'The assistant is unavailable right now because the model cannot be reached. I did not look up your data. This message is not a model answer. Try again in a few minutes.';
  }
  return 'El asistente no está disponible ahora mismo porque no hay conexión con el modelo. No he consultado tus datos. Este mensaje no es una respuesta del modelo. Vuelve a intentarlo dentro de unos minutos.';
}

function discardedTemplateText(locale: AssistantLocale): string {
  if (locale === 'ro') {
    return 'Nu folosesc un răspuns gata făcut despre cuadrante sau despre lista de pontaje. Spune-mi într-o frază ce ai nevoie.';
  }
  if (locale === 'en') {
    return 'I will not use a fixed schedule or punch-list reply for this. Tell me in one sentence what you need.';
  }
  return 'No voy a usar una respuesta fija de cuadrante o de listado de fichajes para esto. Dime en una frase qué necesitas.';
}

export function buildPhraseMessages(input: {
  locale: AssistantLocale;
  utterance: string;
  pageContext: PageContext | null;
  decision: ConductorDecision;
  data?: unknown;
  toolName?: string | null;
  toolError?: string | null;
}): ConductorChatMessage[] {
  const language =
    input.locale === 'ro'
      ? 'Responde en rumano.'
      : input.locale === 'en'
        ? 'Answer in English.'
        : 'Responde en español.';
  const rules = [
    'Redacta la respuesta al empleado.',
    language,
    'Usa solo el contexto de página, la conversación, el procedimiento o el JSON de la consulta.',
    'No inventes botones, horarios, saldos, nombres ni importes.',
    'Si el JSON está vacío, responde a la pregunta real. Si el horario o los fichajes ya están en el contexto de página, úsalos.',
    'No escribas estas frases: "No se encontró información del cuadrante para el período consultado.", "Se encontró información del cuadrante.", "(Respuesta sin IA.)", ni pidas "registros de hoy" cuando el problema no es un listado.',
    'No digas que eres un texto de reserva.',
  ];
  if (!input.utterance.trim()) {
    rules.push(
      'El usuario todavía no ha preguntado nada. Pregunta qué problema tiene. Puedes mencionar el horario y los fichajes ya visibles. No digas que no existe cuadrante.',
    );
  }
  if (input.decision.action === 'procedure' && input.decision.procedureId) {
    rules.push(
      'Limítate a este procedimiento. Puedes reformularlo. No añadas pasos.',
    );
    rules.push(procedureText(input.decision.procedureId));
  }
  if (input.decision.action === 'tool') {
    rules.push(
      input.toolError
        ? 'La consulta ha fallado. No inventes el resultado.'
        : `Resultado de ${input.toolName || 'la consulta'}:\n${shrinkToolData(input.data)}`,
    );
  }
  const page = formatPageContext(input.pageContext);
  const messages: ConductorChatMessage[] = [
    { role: 'system', content: rules.join('\n') },
  ];
  if (page) messages.push({ role: 'user', content: page });
  messages.push({
    role: 'user',
    content: input.utterance.trim()
      ? clip(input.utterance, 1500)
      : 'Sin pregunta todavía.',
  });
  return messages;
}

function shrinkToolData(data: unknown): string {
  const cleaned = dropSensitive(data, 0);
  let text = 'null';
  try {
    text = JSON.stringify(cleaned) ?? 'null';
  } catch {
    text = 'null';
  }
  return text.length > 7000 ? `${text.slice(0, 7000)}…` : text;
}

function dropSensitive(value: unknown, depth: number): unknown {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => dropSensitive(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      /contrase|password|iban|dni|nss|seguridad|correo|email|direccion|domicilio|salario|motivo/i.test(
        key,
      )
    ) {
      continue;
    }
    out[key] = dropSensitive(item, depth + 1);
  }
  return out;
}

export async function runConductorTurn(input: {
  mensaje: string;
  history: ConductorHistoryTurn[];
  locale: AssistantLocale;
  hint: string;
  userId: string;
  decide: (
    messages: ConductorChatMessage[],
  ) => Promise<unknown | 'unavailable'>;
  phrase: (messages: ConductorChatMessage[]) => Promise<string | 'unavailable'>;
  runTool: (
    intent: IntentType,
    entidades: NonNullable<IntentResult['entidades']>,
  ) => Promise<{ data: unknown; tool: string | null; error: string | null }>;
}): Promise<ConductorTurnResult> {
  const prepared = buildDecisionMessages({
    mensaje: input.mensaje,
    history: input.history,
    hint: input.hint,
  });
  const raw = await input.decide(prepared.messages);
  if (raw === 'unavailable') {
    return finishWithoutModel(
      input,
      prepared,
      decideWithoutModel({
        utterance: prepared.utterance,
        pageContext: prepared.pageContext,
        hint: input.hint,
        locale: input.locale,
      }),
    );
  }
  const parsed = parseConductorDecision(raw);
  if (!parsed) {
    return fallbackResult(input.locale, 'decision_invalida');
  }
  const decision = applyDecisionGuards(parsed, prepared.utterance);

  if (decision.action === 'reply' && decision.texto) {
    return finishText(
      input.locale,
      decision.texto,
      'conversacion',
      'generated_summary',
    );
  }
  if (
    decision.action === 'clarify' &&
    decision.texto &&
    prepared.utterance.trim()
  ) {
    return finishText(
      input.locale,
      decision.texto,
      'aclaracion',
      'clarification',
    );
  }

  let toolData: unknown;
  let toolName: string | null = null;
  let toolError: string | null = null;
  let entidades = decision.entidades;
  if (decision.action === 'tool' && decision.intent) {
    entidades = adjustToolEntities(
      prepared.utterance,
      input.userId,
      decision.intent,
      decision.entidades,
      prepared.pageContext,
    );
    const ran = await input.runTool(decision.intent, entidades);
    toolData = ran.data;
    toolName = ran.tool;
    toolError = ran.error;
  }

  const phrased = await input.phrase(
    buildPhraseMessages({
      locale: input.locale,
      utterance: prepared.utterance,
      pageContext: prepared.pageContext,
      decision:
        decision.action === 'tool' ? { ...decision, entidades } : decision,
      data: toolData,
      toolName,
      toolError,
    }),
  );
  if (phrased === 'unavailable' || !phrased.trim()) {
    return finishWithoutModel(input, prepared, decision, {
      data: toolData,
      tool: toolName,
      error: toolError,
      entidades,
    });
  }
  const intentLabel =
    decision.action === 'procedure'
      ? `procedure:${decision.procedureId}`
      : decision.intent || decision.action;
  const responseType: AssistantResponseType =
    decision.action === 'procedure'
      ? 'knowledge_base'
      : decision.action === 'tool'
        ? 'data'
        : decision.action === 'clarify'
          ? 'clarification'
          : 'generated_summary';
  return finishText(input.locale, phrased, intentLabel, responseType, {
    tools: toolName ? [toolName] : [],
    resultCount: countAssistantDataRows(toolData),
    toolData,
    intentType: decision.intent,
    entidades,
    queryFailed: Boolean(toolError),
  });
}

async function finishWithoutModel(
  input: {
    locale: AssistantLocale;
    userId: string;
    runTool: (
      intent: IntentType,
      entidades: NonNullable<IntentResult['entidades']>,
    ) => Promise<{ data: unknown; tool: string | null; error: string | null }>;
  },
  prepared: { utterance: string; pageContext: PageContext | null },
  decision: OfflineDecision,
  already?: {
    data: unknown;
    tool: string | null;
    error: string | null;
    entidades?: NonNullable<IntentResult['entidades']>;
  },
): Promise<ConductorTurnResult> {
  const answered = await answerWithoutModel({
    locale: input.locale,
    utterance: prepared.utterance,
    pageContext: prepared.pageContext,
    decision,
    runTool: input.runTool,
    adjustEntities: (intent, entidades) =>
      adjustToolEntities(
        prepared.utterance,
        input.userId,
        intent,
        entidades,
        prepared.pageContext,
      ),
    already,
  });
  const text = `${sinModeloLead(input.locale)}\n\n${answered.body}`;
  if (containsForbiddenTemplate(text)) {
    return {
      respuesta: discardedTemplateText(input.locale),
      responseSource: 'fallback',
      answerAuthor: 'fallback',
      responseType: 'fallback',
      status: 'success',
      intentLabel: answered.intentLabel,
      tools: answered.tools,
      resultCount: answered.resultCount,
      toolData: answered.toolData,
      intentType: answered.intentType,
      entidades: answered.entidades,
      limitations: ['respuesta_plantilla_descartada'],
    };
  }
  return {
    respuesta: text,
    responseSource: 'fallback',
    answerAuthor: 'fallback',
    responseType: answered.responseType,
    status: answered.queryFailed ? 'error' : 'success',
    intentLabel: answered.intentLabel,
    tools: answered.tools,
    resultCount: answered.resultCount,
    toolData: answered.toolData,
    intentType: answered.intentType,
    entidades: answered.entidades,
    limitations: answered.queryFailed
      ? ['sin_modelo', 'consulta_no_disponible']
      : ['sin_modelo'],
  };
}

function finishText(
  locale: AssistantLocale,
  text: string,
  intentLabel: string,
  responseType: AssistantResponseType,
  extra?: {
    tools?: string[];
    resultCount?: number;
    toolData?: unknown;
    intentType?: IntentType;
    entidades?: NonNullable<IntentResult['entidades']>;
    queryFailed?: boolean;
  },
): ConductorTurnResult {
  if (containsForbiddenTemplate(text)) {
    return {
      respuesta: discardedTemplateText(locale),
      responseSource: 'fallback',
      answerAuthor: 'fallback',
      responseType: 'fallback',
      status: 'success',
      intentLabel,
      tools: extra?.tools ?? [],
      resultCount: extra?.resultCount ?? 0,
      toolData: extra?.toolData,
      intentType: extra?.intentType,
      entidades: extra?.entidades,
      limitations: ['respuesta_plantilla_descartada'],
    };
  }
  return {
    respuesta: text.trim(),
    responseSource: 'llm',
    answerAuthor: 'model',
    responseType,
    status: extra?.queryFailed ? 'error' : 'success',
    intentLabel,
    tools: extra?.tools ?? [],
    resultCount: extra?.resultCount ?? 0,
    toolData: extra?.toolData,
    intentType: extra?.intentType,
    entidades: extra?.entidades,
    limitations: extra?.queryFailed ? ['consulta_no_disponible'] : undefined,
  };
}

function fallbackResult(
  locale: AssistantLocale,
  limitation: string,
  extra?: {
    tools?: string[];
    resultCount?: number;
    toolData?: unknown;
    intentType?: IntentType;
    entidades?: NonNullable<IntentResult['entidades']>;
  },
): ConductorTurnResult {
  return {
    respuesta: honestFallbackText(locale),
    responseSource: 'fallback',
    answerAuthor: 'fallback',
    responseType: 'fallback',
    status: 'error',
    intentLabel: 'fallback',
    tools: extra?.tools ?? [],
    resultCount: extra?.resultCount ?? 0,
    toolData: extra?.toolData,
    intentType: extra?.intentType,
    entidades: extra?.entidades,
    limitations: [limitation],
  };
}
