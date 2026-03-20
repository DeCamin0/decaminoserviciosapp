/**
 * Normaliza el texto del usuario en términos cortos para LIKE sobre titulo/contenido.
 * No sustituye full-text / RAG; es un paso pragmático v1.
 */

const STOP_ES = new Set([
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'y',
  'o',
  'a',
  'en',
  'un',
  'una',
  'que',
  'por',
  'con',
  'para',
  'como',
  'su',
  'se',
  'no',
  'al',
  'lo',
  'le',
  'da',
  'me',
  'te',
  'es',
  'son',
  'hay',
  'mi',
  'tu',
  'sus',
  'qué',
  'cual',
  'cuando',
  'donde',
  'sobre',
  'este',
  'esta',
  'estos',
  'estas',
  'uno',
  'dos',
]);

function stripCombiningMarks(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lista de términos para AND en SQL (sin exponer el mensaje crudo en APIs).
 */
export function normalizeKbSearchTerms(
  raw: string | undefined,
  maxTerms: number,
): string[] {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const lower = stripCombiningMarks(trimmed.toLowerCase());
  const parts = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.length >= 2 ? p : '';
    if (!t || STOP_ES.has(t) || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
    if (out.length >= maxTerms) {
      break;
    }
  }
  return out;
}
