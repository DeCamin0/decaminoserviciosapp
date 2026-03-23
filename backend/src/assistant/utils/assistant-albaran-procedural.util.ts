import type { AssistantLocale } from '../types/assistant-preferences.types';

/** Texto fijo (sin LLM ni read_tools) para subir/adjuntar albarán en Pedidos. */
export const ALBARAN_PROCEDURAL_REPLY_ES =
  'El albarán se sube en Pedidos de material. Abre Pedidos (`/pedidos` o `/empleado-pedidos`), selecciona el pedido correspondiente y usa la opción de subir albarán en ese pedido. No se sube desde Documentos generales.';

const ALBARAN_PROCEDURAL_REPLY_RO =
  'Albaranul se încarcă la **Comenzi materiale (Pedidos)**. Deschide **Pedidos** (`/pedidos` sau `/empleado-pedidos`), deschide comanda potrivită și folosește opțiunea de **încărcare albarán** acolo. **Nu** din Documentos generale.';

const ALBARAN_PROCEDURAL_REPLY_EN =
  'Delivery notes (albarán) are uploaded under **Material orders (Pedidos)**. Open **Pedidos** (`/pedidos` or `/empleado-pedidos`), open the relevant order, and use **upload delivery note** there. **Not** from general Documents.';

export function getAlbaranProceduralReply(
  locale: AssistantLocale = 'es',
): string {
  switch (locale) {
    case 'ro':
      return ALBARAN_PROCEDURAL_REPLY_RO;
    case 'en':
      return ALBARAN_PROCEDURAL_REPLY_EN;
    default:
      return ALBARAN_PROCEDURAL_REPLY_ES;
  }
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** true si el mensaje trata de cómo/dónde subir o adjuntar albarán (flujo Pedidos, no listado SQL). */
export function messageIsAlbaranUploadProcedure(mensaje: string): boolean {
  const raw = stripAccents(String(mensaje ?? '').toLowerCase());
  const hasAlbaran = /\balbaran\b/.test(raw);
  if (!hasAlbaran) return false;
  return (
    /\b(subir|adjuntar|cargar|mandar|mando|mandamos|enviar|envio|enviamos)\b/.test(
      raw,
    ) || /\b(como|donde)\b/.test(raw)
  );
}
