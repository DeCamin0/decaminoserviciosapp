/**
 * Body POST /api/assistant/message
 * - `usuario` es opcional: la autorización y el RBAC usan solo JWT (servidor).
 * - Los campos dentro de `usuario` del cliente no deben usarse para permisos.
 */
export class MessageDto {
  mensaje: string;
  /** Continuă o conversație salvată (arhivă); lipsă → conversație nouă. */
  conversationId?: string;
  usuario?: {
    id?: string;
    nombre?: string;
    rol?: string;
  };
}

/** Estado semántico del mensaje (UI premium / analytics). */
export type AssistantResponseStatus =
  | 'success'
  | 'no_data'
  | 'no_access'
  | 'unsupported'
  | 'error'
  | 'escalated';

/**
 * Tipo de pipeline de respuesta (no confundir con IntentType).
 * - `data`: datos tabulares / agregados de la app
 * - `knowledge_base`: artículos KB
 * - `generated_summary`: texto asistido sin filas propias (o solo redacción)
 * - `fallback`: respaldo explícito (poco usado; preferir generated_summary)
 * - `error` / `escalation`: fallos o ticket
 * - `clarification`: se pide más contexto al usuario
 */
export type AssistantResponseType =
  | 'data'
  | 'knowledge_base'
  | 'generated_summary'
  | 'fallback'
  | 'error'
  | 'escalation'
  | 'clarification';

export type AssistantSourceType =
  | 'live_data'
  | 'knowledge_base'
  | 'generated_summary'
  | 'escalation_ticket';

/** Proveniență răspuns (arhivă DB); opțional în JSON pentru client. */
export type AssistantResponseSourceKind =
  | 'validated_faq'
  | 'read_tools'
  | 'llm'
  | 'no_data';

export interface AssistantResponseSource {
  type: AssistantSourceType;
  /** Etiqueta corta para chips en UI (ej. "Datos en vivo") */
  label?: string;
  /** Detalle técnico o id (ej. tabla, ticket) */
  detail?: string;
}

/**
 * Metadatos KB no sensibles (sin términos de búsqueda ni contenido).
 * Solo para intent procedimientos / knowledge_base.
 */
export interface AssistantKnowledgeBaseMeta {
  articleCount: number;
  /** true si se aplicó búsqueda por términos (vs listado reciente). */
  searchActive: boolean;
}

/** Metadatos cuando hay export tabular: filas totales vs máximo en vista previa de texto. */
export interface AssistantTabularExportMeta {
  totalRows: number;
  previewMax: number;
}

/**
 * Respuesta POST /api/assistant/message
 * - Campos sin marcar "premium" son el contrato histórico (ChatBot actual).
 * - Campos premium son opcionales y seguros para clientes que los ignoren.
 */
export class AssistantResponseDto {
  /** Texto principal (legacy; obligatorio) */
  respuesta: string;
  acciones?: Array<{
    tipo: string;
    label: string;
    payload?: any;
  }>;
  confianza?: number;
  escalado?: boolean;
  ticket_id?: string;

  /** Premium: estado normalizado */
  status?: AssistantResponseStatus;
  /** Premium: tipo de respuesta */
  responseType?: AssistantResponseType;
  /** Premium: procedencia de la información */
  sources?: AssistantResponseSource[];
  /** Premium: límites o advertencias (ej. "0 filas", "sin distinguir acceso") */
  limitations?: string[];
  /** Premium: sugerencias de siguiente pregunta */
  followUps?: string[];
  /** Cuando hay descarga tabular: totales vs preview en texto (el dataset completo está en acciones). */
  tabularExportMeta?: AssistantTabularExportMeta;
  /** Espejo camelCase de `escalado === true` (opcional si false) */
  escalated?: boolean;
  /** Espejo camelCase de `ticket_id` */
  ticketId?: string;
  /** Premium: resumen de consulta KB (opcional) */
  knowledgeBaseMeta?: AssistantKnowledgeBaseMeta;
  /** Id conversație arhivă (pentru mesaje ulterioare) */
  conversationId?: string;
  /** Id mesaj assistant salvat în arhivă (pentru feedback UI); absent dacă nu s-a putut salva */
  assistantMessageId?: string;
  /** Opțional: cum s-a obținut textul principal (legacy: absent). */
  responseSource?: AssistantResponseSourceKind;
}
