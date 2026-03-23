import {
  getVagueAppHelpClarificationReply,
  messageIsVeryVagueAppHelp,
} from './assistant-vague-message.util';

describe('assistant-vague-message.util', () => {
  it('no funciona → vago', () => {
    expect(messageIsVeryVagueAppHelp('no funciona')).toBe(true);
  });

  it('quiero cambiar algo → vago', () => {
    expect(messageIsVeryVagueAppHelp('quiero cambiar algo')).toBe(true);
  });

  it('no funciona el fichaje → no vago (tema concreto)', () => {
    expect(messageIsVeryVagueAppHelp('no funciona el fichaje')).toBe(false);
  });

  it('texto de clarificación en español', () => {
    const t = getVagueAppHelpClarificationReply('es');
    expect(t).toContain('aplicación');
    expect(t).not.toMatch(/no se encontró/i);
  });
});
