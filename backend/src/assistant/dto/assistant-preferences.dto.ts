/**
 * Body PUT /api/assistant/preferences — solo campos enviados se actualizan (merge).
 * Primera vez: crear fila; opted_in true activa la capa de personalización.
 */
export class UpdateAssistantPreferencesDto {
  /** Debe ser true para aplicar locale/estilo/tono en el asistente. */
  opted_in?: boolean;
  /** es | en | ro */
  locale?: string | null;
  /** short | normal | detailed */
  response_style?: string | null;
  /** professional | friendly */
  tone?: string | null;
}
