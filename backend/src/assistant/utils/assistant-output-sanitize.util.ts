import {
  ASSISTANT_KB_CONTENIDO_MAX_CHARS,
  ASSISTANT_SENSITIVE_KEY_BLACKLIST,
} from '../constants/assistant-read-tools.registry';

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Devuelve solo claves permitidas; elimina cualquier clave en blacklist si coincidiera.
 */
export function pickAssistantFields(
  row: Record<string, unknown>,
  allowed: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (ASSISTANT_SENSITIVE_KEY_BLACKLIST.has(key)) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      out[key] = serializeValue(row[key]);
    }
  }
  return out;
}

export function pickAssistantRows(
  rows: Record<string, unknown>[],
  allowed: readonly string[],
): Record<string, unknown>[] {
  return rows.map((r) => pickAssistantFields(r, allowed));
}

export function truncateKbContenido(
  rows: Record<string, unknown>[],
  maxChars: number = ASSISTANT_KB_CONTENIDO_MAX_CHARS,
): Record<string, unknown>[] {
  return rows.map((r) => {
    const copy = { ...r };
    if (
      typeof copy.contenido === 'string' &&
      copy.contenido.length > maxChars
    ) {
      copy.contenido =
        copy.contenido.slice(0, maxChars) +
        '\n…[contenido truncado por límite del asistente]';
    }
    return copy;
  });
}
