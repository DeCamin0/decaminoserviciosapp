/**
 * Preferencias persistentes explícitas (opt-in). No se infieren del chat.
 * Valores resueltos listos para prompts (con defaults seguros).
 */

export type AssistantLocale = 'es' | 'en' | 'ro';

/** Limba efectivă pentru formularea răspunsului (preferințe sau auto-detect). */
export type AssistantAiLanguageContext = {
  responseLocale: AssistantLocale;
};

export type AssistantResponseStyle = 'short' | 'normal' | 'detailed';

export type AssistantTone = 'professional' | 'friendly';

export interface ResolvedAssistantPreferences {
  /** false: mismo comportamiento pre–PAS 8 (defaults internos, sin capa extra en prompt). */
  active: boolean;
  locale: AssistantLocale;
  responseStyle: AssistantResponseStyle;
  tone: AssistantTone;
}

export const DEFAULT_ASSISTANT_PREFERENCES: ResolvedAssistantPreferences = {
  active: false,
  locale: 'es',
  responseStyle: 'normal',
  tone: 'professional',
};
