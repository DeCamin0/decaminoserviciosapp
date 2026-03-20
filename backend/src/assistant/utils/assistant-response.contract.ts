import { IntentType } from '../services/intent-classifier.service';
import type {
  AssistantResponseDto,
  AssistantResponseSource,
  AssistantResponseStatus,
  AssistantResponseType,
  AssistantTabularExportMeta,
} from '../dto/message.dto';

/**
 * Construye la respuesta del asistente con campos legacy + contrato premium (opcionales).
 * Mantiene `escalado` / `ticket_id` y añade espejos camelCase cuando aplica.
 */
export function buildAssistantResponse(params: {
  respuesta: string;
  acciones?: AssistantResponseDto['acciones'];
  confianza?: number;
  escalado?: boolean;
  ticket_id?: string;
  status: AssistantResponseStatus;
  responseType: AssistantResponseType;
  sources?: AssistantResponseSource[];
  limitations?: string[];
  followUps?: string[];
  tabularExportMeta?: AssistantTabularExportMeta;
}): AssistantResponseDto {
  const escalado = params.escalado ?? false;
  const dto: AssistantResponseDto = {
    respuesta: params.respuesta,
    acciones: params.acciones,
    confianza: params.confianza,
    escalado,
    ticket_id: params.ticket_id,
    status: params.status,
    responseType: params.responseType,
    sources: params.sources,
    limitations: params.limitations,
    followUps: params.followUps,
    tabularExportMeta: params.tabularExportMeta,
  };
  if (escalado) {
    dto.escalated = true;
  }
  if (params.ticket_id) {
    dto.ticketId = params.ticket_id;
  }
  return dto;
}

/** Fuentes cuando hay filas / payload no vacío y se ha consultado datos o KB. */
export function sourcesForSuccessfulDataIntent(
  intent: IntentType,
  withAiFormatting: boolean,
): { responseType: AssistantResponseType; sources: AssistantResponseSource[] } {
  const isKb = intent === IntentType.PROCEDIMIENTOS;
  const sources: AssistantResponseSource[] = isKb
    ? [
        {
          type: 'knowledge_base',
          label: 'Base de conocimiento (curada)',
          detail: 'tabla: kb_articles · separada de datos en vivo (RBAC)',
        },
      ]
    : [
        {
          type: 'live_data',
          label: 'Datos en vivo',
          detail: 'Consultas internas de solo lectura (RBAC)',
        },
      ];
  if (withAiFormatting) {
    sources.push({
      type: 'generated_summary',
      label: 'Redacción asistida',
      detail:
        'OpenAI formatea el texto; los hechos vienen de las fuentes anteriores',
    });
  }
  return {
    responseType: isKb ? 'knowledge_base' : 'data',
    sources,
  };
}

export function defaultFollowUpsForIntent(
  intent: IntentType,
  entidades?: { nombre?: string; codigo?: string },
): string[] | undefined {
  switch (intent) {
    case IntentType.FICHAJES:
      return ['¿Otra fecha?', '¿Ver el mes completo?'];
    case IntentType.CUADRANTE:
      if (entidades?.nombre || entidades?.codigo) {
        return ['¿Otro día?', '¿Otro empleado (nombre o código)?'];
      }
      return ['¿Otro mes?', '¿Tu cuadrante del mes actual?'];
    case IntentType.PEDIDOS:
      return ['¿Otro mes?', '¿Estado de un pedido concreto?'];
    case IntentType.VACACIONES:
      return ['¿Solicitudes de un mes concreto?', '¿Ver saldo de días?'];
    case IntentType.NOMINAS:
      return ['¿Otro mes?', '¿Descargar desde la sección Nóminas?'];
    case IntentType.DIPLOMAS:
      return ['¿Filtrar por empleado?', '¿Solo los más recientes?'];
    case IntentType.PROCEDIMIENTOS:
      return ['¿Otro tema de la app?', '¿Pasos para fichajes o cuadrante?'];
    case IntentType.COMUNICADOS:
      return ['¿Solo sin leer?', '¿El último comunicado?'];
    case IntentType.SOLICITUDES:
      return ['¿Solo pendientes?', '¿Vacaciones o otro tipo?'];
    case IntentType.DOCUMENTOS_SOLICITADOS:
      return ['¿Solo pendientes de subir?', '¿Qué tipo de documento?'];
    default:
      return undefined;
  }
}
