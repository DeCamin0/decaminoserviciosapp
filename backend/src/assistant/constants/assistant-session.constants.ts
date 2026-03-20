/**
 * Límites de la memoria de sesión (in-process). Ajustar aquí antes de env vars si hace falta.
 */
export const ASSISTANT_SESSION_TTL_MS = 20 * 60 * 1000; // 20 min

/** Snippet del último mensaje del usuario (no guardar conversación completa). */
export const ASSISTANT_SESSION_MAX_MESSAGE_SNIPPET_CHARS = 400;

/**
 * Máximo de usuarios con contexto en memoria; evita crecimiento ilimitado en RAM.
 * Si se supera, se eliminan entradas más antiguas (por `updatedAt`).
 */
export const ASSISTANT_SESSION_MAX_TRACKED_USERS = 2000;

/** Máximo de artículos KB por consulta (read-only). */
export const ASSISTANT_KB_QUERY_LIMIT = 8;

/** Términos de búsqueda KB tras normalizar (AND entre ellos). */
export const ASSISTANT_KB_MAX_SEARCH_TERMS = 5;

/**
 * Filas máximas en plantillas de texto del asistente (fallback) y referencia para meta de export.
 * El dataset completo va en `exportData` en acciones de descarga, no aquí.
 */
export const ASSISTANT_TABULAR_PREVIEW_ROWS = 10;
