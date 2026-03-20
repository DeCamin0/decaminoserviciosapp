import { IntentType } from '../services/intent-classifier.service';
import type { IntentResult } from '../services/intent-classifier.service';
import { AccessLevel } from '../services/rbac.service';
import {
  type BusinessLexiconSignals,
  normalizeAssistantText,
} from './assistant-business-signals.util';
import {
  hasIntentToolConflict,
  intentHasReadTools,
} from './assistant-recovery.util';

export type AssistantOutcomeLevel = 'good' | 'recoverable' | 'alert_worthy';

export type AssistantFailureKind =
  | 'none'
  | 'desconocido_con_negocio'
  | 'sin_tool'
  | 'query_error'
  | 'mapping_conflict'
  | 'datos_vacios_sospechoso'
  | 'clarificacion_innecesaria'
  | 'recovery_failed'
  | 'coverage_gap'
  | 'repeated_similar';

export interface OutcomeEvaluationInput {
  mensaje: string;
  initialIntent: IntentType;
  finalIntent: IntentType;
  entidades?: IntentResult['entidades'];
  executedTools: string[];
  resultCount: number;
  queryError: boolean;
  responseType?: string;
  status?: string;
  /** Răspuns înainte de query (clarificare fichajes / nóminas). */
  skippedQuery: boolean;
  accessLevel: AccessLevel;
  recoveryAttempted: boolean;
  recoverySucceeded: boolean;
  signals: BusinessLexiconSignals;
}

export interface OutcomeEvaluationResult {
  level: AssistantOutcomeLevel;
  failureKind: AssistantFailureKind;
  reasons: string[];
}

function hasTemporalEntity(entidades?: IntentResult['entidades']): boolean {
  if (!entidades) return false;
  return Boolean(
    entidades.fecha ||
    entidades.mes ||
    entidades.year ||
    entidades.proximos_dias != null,
  );
}

/**
 * Eșantion: întrebare operațională cu filtru temporal plauzibil.
 */
function looksOperationalTemporalQuery(
  signals: BusinessLexiconSignals,
  entidades?: IntentResult['entidades'],
): boolean {
  if (!hasTemporalEntity(entidades)) return false;
  return (
    signals.fichajes ||
    signals.ausenciasOperativas ||
    signals.vacaciones ||
    signals.nomina ||
    signals.pedido ||
    signals.cuadranteHorario
  );
}

export function evaluateAssistantOutcome(
  ctx: OutcomeEvaluationInput,
): OutcomeEvaluationResult {
  const reasons: string[] = [];
  let failureKind: AssistantFailureKind = 'none';

  if (ctx.queryError) {
    return {
      level: 'alert_worthy',
      failureKind: 'query_error',
      reasons: ['query_error'],
    };
  }

  if (ctx.finalIntent === IntentType.DESCONOCIDO && ctx.signals.anyBusiness) {
    failureKind = 'desconocido_con_negocio';
    reasons.push('desconocido_con_terminos_negocio');
    return { level: 'alert_worthy', failureKind, reasons };
  }

  if (
    ctx.finalIntent !== IntentType.DESCONOCIDO &&
    !intentHasReadTools(ctx.finalIntent)
  ) {
    /** INCIDENCIAS / PROCEDIMIENTOS au tool-uri */
    if (
      ctx.finalIntent !== IntentType.INCIDENCIAS &&
      ctx.finalIntent !== IntentType.PROCEDIMIENTOS
    ) {
      failureKind = 'sin_tool';
      reasons.push('intent_fara_tool_read');
      return { level: 'alert_worthy', failureKind, reasons };
    }
  }

  if (
    hasIntentToolConflict(ctx.finalIntent, ctx.signals, ctx.mensaje) &&
    !ctx.recoverySucceeded
  ) {
    failureKind = 'mapping_conflict';
    reasons.push('semnal_lexical_vs_intent');
    if (ctx.recoveryAttempted) {
      return { level: 'alert_worthy', failureKind: 'recovery_failed', reasons };
    }
    return { level: 'recoverable', failureKind: 'mapping_conflict', reasons };
  }

  const emptyOftenOk = new Set([
    IntentType.DIPLOMAS,
    IntentType.DOCUMENTOS,
    IntentType.DOCUMENTOS_SOLICITADOS,
    IntentType.COMUNICADOS,
    IntentType.PROCEDIMIENTOS,
    IntentType.NOMINAS,
  ]);

  if (
    ctx.accessLevel === AccessLevel.FULL_ACCESS &&
    ctx.resultCount === 0 &&
    !ctx.skippedQuery &&
    !emptyOftenOk.has(ctx.finalIntent) &&
    looksOperationalTemporalQuery(ctx.signals, ctx.entidades) &&
    ctx.status !== 'clarification'
  ) {
    failureKind = 'datos_vacios_sospechoso';
    reasons.push('full_access_cero_resultados_query_operativa');
    return { level: 'alert_worthy', failureKind, reasons };
  }

  if (
    ctx.finalIntent === IntentType.FICHAJES &&
    ctx.responseType === 'clarification' &&
    hasTemporalEntity(ctx.entidades)
  ) {
    failureKind = 'clarificacion_innecesaria';
    reasons.push('clarificacion_fichajes_cu_temporal');
    return { level: 'alert_worthy', failureKind, reasons };
  }

  if (
    ctx.recoveryAttempted &&
    !ctx.recoverySucceeded &&
    ctx.resultCount === 0 &&
    ctx.signals.anyBusiness &&
    !ctx.skippedQuery
  ) {
    return {
      level: 'alert_worthy',
      failureKind: 'recovery_failed',
      reasons: ['recovery_sin_datos'],
    };
  }

  /** Coverage gap: semnal diplomă dar intent final nu e DIPLOMAS/DOCUMENTOS și nu s-a recuperat */
  if (
    ctx.signals.diploma &&
    ctx.finalIntent !== IntentType.DIPLOMAS &&
    ctx.finalIntent !== IntentType.DOCUMENTOS &&
    ctx.finalIntent !== IntentType.DOCUMENTOS_SOLICITADOS &&
    !ctx.recoverySucceeded &&
    ctx.finalIntent !== IntentType.DESCONOCIDO
  ) {
    const t = normalizeAssistantText(ctx.mensaje);
    if (
      /\b(diploma|certificacion|prl)\b/.test(t) &&
      ctx.finalIntent === IntentType.FICHAJES
    ) {
      failureKind = 'coverage_gap';
      reasons.push('diploma_vs_fichajes');
      return ctx.recoveryAttempted
        ? { level: 'alert_worthy', failureKind: 'recovery_failed', reasons }
        : { level: 'recoverable', failureKind: 'coverage_gap', reasons };
    }
  }

  return { level: 'good', failureKind: 'none', reasons: [] };
}

export interface TelegramAlertDecisionInput {
  evaluation: OutcomeEvaluationResult;
  finalIntent: IntentType;
  recoverySucceeded: boolean;
  queryErrorTicketSent: boolean;
  signals: BusinessLexiconSignals;
  similarFailureCountInWindow: number;
}

/**
 * Decizie pură (fără dedup temporal). Dedup-ul e în serviciu.
 */
export function shouldSendTelegramAlertPure(
  input: TelegramAlertDecisionInput,
): { send: boolean; reason: string | null } {
  if (input.recoverySucceeded) {
    return { send: false, reason: null };
  }

  if (input.evaluation.level === 'good') {
    return { send: false, reason: null };
  }

  if (
    input.evaluation.failureKind === 'query_error' &&
    input.queryErrorTicketSent
  ) {
    return { send: false, reason: null };
  }

  if (input.evaluation.level === 'recoverable') {
    if (input.similarFailureCountInWindow >= 3) {
      return { send: true, reason: 'repeated_similar_failures' };
    }
    return { send: false, reason: null };
  }

  if (input.evaluation.level === 'alert_worthy') {
    if (
      input.evaluation.failureKind === 'desconocido_con_negocio' &&
      input.signals.anyBusiness
    ) {
      return { send: true, reason: 'desconocido_con_negocio' };
    }
    if (
      input.evaluation.failureKind === 'query_error' &&
      !input.queryErrorTicketSent
    ) {
      return { send: true, reason: 'query_error_sin_ticket' };
    }
    if (
      input.evaluation.failureKind === 'mapping_conflict' ||
      input.evaluation.failureKind === 'recovery_failed'
    ) {
      return { send: true, reason: input.evaluation.failureKind };
    }
    if (input.evaluation.failureKind === 'datos_vacios_sospechoso') {
      return { send: true, reason: 'cero_resultados_admin' };
    }
    if (input.evaluation.failureKind === 'clarificacion_innecesaria') {
      return { send: true, reason: 'clarificacion_sospechosa' };
    }
    if (input.evaluation.failureKind === 'sin_tool') {
      return { send: true, reason: 'coverage_gap_tool' };
    }
    if (input.evaluation.failureKind === 'coverage_gap') {
      return { send: true, reason: 'coverage_gap' };
    }
  }

  if (input.similarFailureCountInWindow >= 3) {
    return { send: true, reason: 'repeated_similar_failures' };
  }

  return { send: false, reason: null };
}

export function buildAssistantAlertPayload(input: {
  reason: string;
  userId: string;
  /** Nu include textul complet al utilizatorului în producție dacă e lung */
  mensajePreview: string;
  initialIntent: string;
  finalIntent: string;
  tools: string[];
  resultCount: number;
  recoveryAttempted: boolean;
  recoverySucceeded: boolean;
  evaluationReasons: string[];
  clientLabel?: string | null;
}): string {
  const head = input.clientLabel
    ? `[Assistant:${input.clientLabel}]`
    : '[Assistant]';
  return (
    `${head} ⚠️ Revisión sugerida\n\n` +
    `Motivo: ${input.reason}\n` +
    `Usuario: ${input.userId}\n` +
    `Intent inicial/final: ${input.initialIntent} → ${input.finalIntent}\n` +
    `Tools: ${input.tools.join(', ') || '-'}\n` +
    `Filas: ${input.resultCount}\n` +
    `Recovery: ${input.recoveryAttempted ? 'sí' : 'no'} / ` +
    `${input.recoverySucceeded ? 'ok' : 'no'}\n` +
    `Detalle: ${input.evaluationReasons.join('; ') || '-'}\n` +
    `Mensaje (recorte): ${input.mensajePreview.slice(0, 160)}`
  );
}
