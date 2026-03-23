import type { AssistantResponseSourceKind } from '../dto/message.dto';

/**
 * Parametri pentru maparea `response_source` (arhivă / analytics).
 * Ramurile error / incidencias / catch nu folosesc această funcție — rămân fără câmp (NULL în DB).
 */
export type ResolveAssistantResponseSourceParams =
  | { kind: 'validated_faq' }
  /** DESCONOCIDO, clarificare FICHAJES, etc.: doar LLM */
  | { kind: 'llm_only' }
  /** După read tools: date non-goale */
  | { kind: 'pipeline_with_data' }
  /** KB procedimientos sin artículos; text generat LLM fără rânduri KB */
  | { kind: 'pipeline_empty_kb' }
  /** Read tools goale, mesaj no_data generic */
  | { kind: 'pipeline_empty_no_data' };

/**
 * Mapare unică spre cele 4 valori permise: validated_faq | read_tools | llm | no_data
 */
export function resolveAssistantResponseSource(
  params: ResolveAssistantResponseSourceParams,
): AssistantResponseSourceKind {
  switch (params.kind) {
    case 'validated_faq':
      return 'validated_faq';
    case 'llm_only':
      return 'llm';
    case 'pipeline_with_data':
      return 'read_tools';
    case 'pipeline_empty_kb':
      return 'llm';
    case 'pipeline_empty_no_data':
      return 'no_data';
    default: {
      const _exhaustive: never = params;
      return _exhaustive;
    }
  }
}
