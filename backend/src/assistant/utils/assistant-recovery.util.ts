import { IntentType } from '../services/intent-classifier.service';
import type { IntentResult } from '../services/intent-classifier.service';
import {
  normalizeAssistantText,
  type BusinessLexiconSignals,
} from './assistant-business-signals.util';
import { resolveAssistantTools } from './assistant-intent-tools.util';

const MAX_CANDIDATES = 2;

/**
 * Candidați pentru DESCONOCIDO: ordine stabilă, explicabilă.
 */
export function buildRecoveryCandidatesForDesconocido(
  signals: BusinessLexiconSignals,
): IntentType[] {
  const out: IntentType[] = [];
  const push = (i: IntentType) => {
    if (!out.includes(i) && out.length < MAX_CANDIDATES) out.push(i);
  };

  if (signals.nomina) push(IntentType.NOMINAS);
  if (signals.diploma) push(IntentType.DIPLOMAS);
  if (signals.pedido) push(IntentType.PEDIDOS);
  if (signals.ausenciasOperativas) push(IntentType.SOLICITUDES);
  if (signals.fichajes) push(IntentType.FICHAJES);
  if (signals.vacaciones) push(IntentType.VACACIONES);
  if (signals.cuadranteHorario) push(IntentType.CUADRANTE);
  if (signals.comunicados) push(IntentType.COMUNICADOS);
  if (signals.documentosSolicitados) push(IntentType.DOCUMENTOS_SOLICITADOS);
  if (signals.documentosInspeccion) push(IntentType.DOCUMENTOS);

  return out;
}

export function intentHasReadTools(intent: IntentType): boolean {
  return resolveAssistantTools(intent, {}).length > 0;
}

export function hasIntentToolConflict(
  intent: IntentType,
  signals: BusinessLexiconSignals,
  mensaje: string,
): boolean {
  const t = normalizeAssistantText(mensaje);
  if (intent === IntentType.EMPLEADOS && signals.nomina) return true;
  if (
    intent === IntentType.EMPLEADOS &&
    signals.pedido &&
    /\b(mi|el)\s+centro\b/.test(t)
  ) {
    return true;
  }
  if (intent === IntentType.VACACIONES && signals.ausenciasOperativas) {
    return true;
  }
  if (intent === IntentType.FICHAJES && signals.diploma) return true;
  if (intent === IntentType.FICHAJES && signals.nomina) return true;
  return false;
}

/**
 * O singură alternativă post-query (retry inteligent).
 */
export function pickPostQueryRecoveryIntent(
  currentIntent: IntentType,
  signals: BusinessLexiconSignals,
  mensaje: string,
  dataEmpty: boolean,
  entidades?: IntentResult['entidades'],
): IntentType | null {
  if (currentIntent === IntentType.EMPLEADOS && signals.nomina) {
    return IntentType.NOMINAS;
  }
  if (
    currentIntent === IntentType.EMPLEADOS &&
    signals.pedido &&
    /\b(mi|el)\s+centro\b/.test(normalizeAssistantText(mensaje))
  ) {
    return IntentType.PEDIDOS;
  }
  if (currentIntent === IntentType.VACACIONES && signals.ausenciasOperativas) {
    return IntentType.SOLICITUDES;
  }
  if (currentIntent === IntentType.FICHAJES && signals.diploma) {
    return IntentType.DIPLOMAS;
  }
  if (currentIntent === IntentType.FICHAJES && signals.nomina) {
    return IntentType.NOMINAS;
  }
  /** CUADRANTE + zi + încă gol: încearcă fichajes aceeași zi (dacă există fecha). */
  /** Nu pentru „horario de X / tiene [nombre]”: fichajes ≠ planificare; rămâne clarificare sau alt răspuns. */
  if (
    currentIntent === IntentType.CUADRANTE &&
    dataEmpty &&
    Boolean(entidades?.fecha) &&
    !entidades?.nombre &&
    !entidades?.codigo &&
    (/\b(hoy|manana|mañana|azi)\b/.test(normalizeAssistantText(mensaje)) ||
      signals.fichajes)
  ) {
    return IntentType.FICHAJES;
  }

  return null;
}

export function shouldAttemptPostQueryRecovery(input: {
  recoveryAlreadyUsed: boolean;
  queryError: boolean;
  currentIntent: IntentType;
  signals: BusinessLexiconSignals;
  mensaje: string;
  dataEmpty: boolean;
  entidades?: IntentResult['entidades'];
}): boolean {
  if (input.recoveryAlreadyUsed || input.queryError) return false;
  const alt = pickPostQueryRecoveryIntent(
    input.currentIntent,
    input.signals,
    input.mensaje,
    input.dataEmpty,
    input.entidades,
  );
  if (!alt || alt === input.currentIntent) return false;
  if (
    hasIntentToolConflict(input.currentIntent, input.signals, input.mensaje)
  ) {
    return true;
  }
  if (
    input.dataEmpty &&
    input.currentIntent === IntentType.CUADRANTE &&
    alt === IntentType.FICHAJES
  ) {
    return true;
  }
  return false;
}
