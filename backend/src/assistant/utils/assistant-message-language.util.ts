import { normalizeForMatch } from './month-and-relative-dates.util';
import type {
  AssistantLocale,
  ResolvedAssistantPreferences,
} from '../types/assistant-preferences.types';

export type AssistantLanguageSource = 'preferences' | 'auto-detect';

/**
 * Detectare simplă ro / es / en din cuvinte frecvente (fără biblioteci externe).
 * La egalitate sau lipsă de semnale → `es` (fallback aliniat produsului).
 */
export function detectAssistantMessageLanguage(raw: string): AssistantLocale {
  const n = normalizeForMatch(raw);
  if (!n.trim()) {
    return 'es';
  }

  let ro = 0;
  let es = 0;

  /** Pattern-uri pe text deja normalizat (fără diacritice, lower). */
  const roPatterns: RegExp[] = [
    /\bce\b/,
    /\bcine\b/,
    /\bazi\b/,
    /\bastazi\b/,
    /\bmaine\b/,
    /\bvacanta\b/,
    /\bangajat/i,
    /\bconcediu\b/,
    /\blista\b/,
    /\bmultumesc\b/,
    /\bvreau\b/,
    /\bpoti\b/,
    /\bimi\b/,
    /\bnu\s+mi\b/,
    /\bda-?mi\b/,
    /\bpentru\s+mine\b/,
    /\bce\s+registre/i,
    /\bpontaj/i,
    /\bfacut\b/,
    /\babsent\w*\b/,
    /\bluna\s+asta\b/,
    /\banul\s+asta\b/,
    /\banu\s+asta\b/,
    /\borarul\b/,
    /\bprogramul\b/,
    /\babsente\b/,
  ];

  const esPatterns: RegExp[] = [
    /\bquien\b/,
    /\bque\s+(tal|hora|es|son|dias|dia|pasa)\b/,
    /\bhoy\b/,
    /\bmanana\b/,
    /\bvacaciones\b/,
    /\bempleados\b/,
    /\blista\b/,
    /\bpuedes\b/,
    /\bpuede\b/,
    /\bgracias\b/,
    /\bhola\b/,
    /\bnecesito\b/,
    /\bquiero\b/,
    /\bque\s+registros/i,
    /\bfichajes\b/,
    /\bnomina\b/,
  ];

  const enPatterns: RegExp[] = [
    /\bwhat\b/,
    /\bwho\b/,
    /\bwhen\b/,
    /\btoday\b/,
    /\btomorrow\b/,
    /\bthanks\b/,
    /\bplease\b/,
    /\bemployees\b/,
    /\bvacation\b/,
  ];

  const countMatches = (patterns: RegExp[]): number => {
    let t = 0;
    for (const re of patterns) {
      const m = n.match(new RegExp(re.source, 'gi'));
      if (m) {
        t += m.length;
      }
    }
    return t;
  };

  ro += countMatches(roPatterns);
  es += countMatches(esPatterns);
  const enScore = countMatches(enPatterns);

  if (enScore > ro && enScore > es) {
    return 'en';
  }
  if (ro === 0 && es === 0) {
    return 'es';
  }
  if (ro > es) {
    return 'ro';
  }
  if (es > ro) {
    return 'es';
  }
  return 'es';
}

export function resolveAssistantResponseLanguage(
  mensaje: string,
  prefs: ResolvedAssistantPreferences,
): { responseLocale: AssistantLocale; source: AssistantLanguageSource } {
  if (prefs.active) {
    return { responseLocale: prefs.locale, source: 'preferences' };
  }
  return {
    responseLocale: detectAssistantMessageLanguage(mensaje),
    source: 'auto-detect',
  };
}
