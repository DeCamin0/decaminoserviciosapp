import {
  detectAssistantMessageLanguage,
  resolveAssistantResponseLanguage,
} from './assistant-message-language.util';
import {
  DEFAULT_ASSISTANT_PREFERENCES,
  type ResolvedAssistantPreferences,
} from '../types/assistant-preferences.types';

describe('assistant-message-language', () => {
  it('detectează română din cuvinte frecvente', () => {
    expect(detectAssistantMessageLanguage('cine are vacanta in martie?')).toBe(
      'ro',
    );
    expect(detectAssistantMessageLanguage('ce registre am azi')).toBe('ro');
    expect(detectAssistantMessageLanguage('ce absente am anu asta')).toBe('ro');
    expect(detectAssistantMessageLanguage('care e orarul meu azi')).toBe('ro');
  });

  it('detectează spaniolă', () => {
    expect(
      detectAssistantMessageLanguage('quien tiene vacaciones en abril'),
    ).toBe('es');
    expect(detectAssistantMessageLanguage('registros de hoy')).toBe('es');
    expect(detectAssistantMessageLanguage('horario de hoy')).toBe('es');
    expect(detectAssistantMessageLanguage('ausencias este año')).toBe('es');
  });

  it('fallback es când nu există semnale clare (ro/es/en)', () => {
    expect(detectAssistantMessageLanguage('   ')).toBe('es');
    expect(detectAssistantMessageLanguage('ok')).toBe('es');
  });

  it('resolve: opted_in → preferences locale', () => {
    const prefs: ResolvedAssistantPreferences = {
      ...DEFAULT_ASSISTANT_PREFERENCES,
      active: true,
      locale: 'es',
    };
    const r = resolveAssistantResponseLanguage(
      'cine are vacanta in martie',
      prefs,
    );
    expect(r.source).toBe('preferences');
    expect(r.responseLocale).toBe('es');
  });

  it('resolve: fără opt-in → auto-detect', () => {
    const prefs: ResolvedAssistantPreferences = {
      ...DEFAULT_ASSISTANT_PREFERENCES,
      active: false,
    };
    const r = resolveAssistantResponseLanguage(
      'cine are vacanta in martie',
      prefs,
    );
    expect(r.source).toBe('auto-detect');
    expect(r.responseLocale).toBe('ro');
  });
});
