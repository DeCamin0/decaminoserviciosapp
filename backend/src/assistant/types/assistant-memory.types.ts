/**
 * Arquitectura de memoria del asistente (v1 in-process → v2/v3).
 *
 * ## Session memory (esta implementación)
 * - Alcance: una instancia de backend; se pierde al reiniciar o con otro pod.
 * - TTL y límites explícitos; solo apoya follow-ups (intent + entidades + snippet).
 * - No guarda filas crudas de datos en vivo (solo resumen: origen + recuento).
 *
 * ## User preferences (persistente, opt-in — PAS 8)
 * - Tabla `assistant_user_preferences`; API GET/PUT bajo `/api/assistant/preferences`.
 * - Sin inferencia desde el chat; ver `ResolvedAssistantPreferences`.
 *
 * ## Company / curated knowledge (kb_articles + futuro RAG)
 * - Fuente autoritativa ya separada en SQL (`kb_articles`) y en el contrato (`knowledge_base`).
 * - v3 podría añadir embeddings o índice full-text en BD sin cambiar el boundary del read-tool.
 */

/** Resumen seguro para session memory (no payload completo). */
export type SessionDataSource = 'live_data' | 'knowledge_base';

export interface SessionDataSummary {
  source: SessionDataSource;
  rowCount: number;
  /** true si el resultado llegó al límite configurado de filas (p. ej. KB). */
  cappedByLimit: boolean;
}

export type { ResolvedAssistantPreferences } from './assistant-preferences.types';
