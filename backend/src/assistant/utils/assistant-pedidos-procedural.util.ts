import { IntentType } from '../services/intent-classifier.service';
import type { AssistantLocale } from '../types/assistant-preferences.types';
import {
  getAlbaranProceduralReply,
  messageIsAlbaranUploadProcedure,
} from './assistant-albaran-procedural.util';

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * El usuario pide ver/listar/recuento explícito de pedidos → debe usar read_tools.
 * Excluye preguntas «cómo ver…» (van a respuesta procedural).
 */
export function messageExplicitlyRequestsPedidosListOrData(
  mensaje: string,
): boolean {
  const raw = stripAccents(String(mensaje ?? '').toLowerCase());
  if (!/pedido/.test(raw)) return false;

  if (/\b(cuantos|cuantas)\b/.test(raw)) return true;
  if (/\b(lista|listado)\b/.test(raw)) return true;

  const hasHowWhere = /\b(como|donde)\b/.test(raw);

  if (/\bver\s+(el\s+|los\s+|mis\s+)?pedidos\b/.test(raw) && !hasHowWhere) {
    return true;
  }
  if (/\b(mis|los)\s+pedidos\b/.test(raw) && !hasHowWhere) {
    return true;
  }
  return false;
}

/**
 * PEDIDOS + cómo/dónde sin pedir lista explícita → no read_tools (guía corta).
 */
export function messageIsPedidosHowToWithoutDataRequest(
  mensaje: string,
): boolean {
  const raw = stripAccents(String(mensaje ?? '').toLowerCase());
  if (!/pedido/.test(raw)) return false;
  if (messageExplicitlyRequestsPedidosListOrData(mensaje)) return false;
  return /\b(como|donde)\b/.test(raw);
}

const PEDIDOS_HOWTO_ES =
  'Los **pedidos de material** se gestionan en **Pedidos** (`/pedidos` o `/empleado-pedidos`): catálogo, crear pedidos, subir albarán y ver estado. Si quieres un **listado** concreto, indica el mes o escribe «ver mis pedidos».';

const PEDIDOS_HOWTO_RO =
  '**Comenzile de materiale** sunt în **Pedidos** (`/pedidos` sau `/empleado-pedidos`): catalog, comenzi, albarán și status. Pentru un **listă** anume, spune luna sau „vezi comenzile mele”.';

const PEDIDOS_HOWTO_EN =
  '**Material orders** live under **Pedidos** (`/pedidos` or `/empleado-pedidos`): catalogue, place orders, upload delivery notes, and check status. For a concrete **list**, say the month or ask to “see my orders”.';

function getPedidosGeneralHowToReply(locale: AssistantLocale = 'es'): string {
  switch (locale) {
    case 'ro':
      return PEDIDOS_HOWTO_RO;
    case 'en':
      return PEDIDOS_HOWTO_EN;
    default:
      return PEDIDOS_HOWTO_ES;
  }
}

export type PedidosProceduralKind = 'albaran' | 'pedidos_howto';

export function resolvePedidosProceduralStaticReply(
  mensaje: string,
  intent: IntentType,
  locale: AssistantLocale = 'es',
): { reply: string; kind: PedidosProceduralKind } | null {
  if (intent !== IntentType.PEDIDOS) return null;

  if (messageIsAlbaranUploadProcedure(mensaje)) {
    return { reply: getAlbaranProceduralReply(locale), kind: 'albaran' };
  }

  if (messageIsPedidosHowToWithoutDataRequest(mensaje)) {
    return {
      reply: getPedidosGeneralHowToReply(locale),
      kind: 'pedidos_howto',
    };
  }

  return null;
}
