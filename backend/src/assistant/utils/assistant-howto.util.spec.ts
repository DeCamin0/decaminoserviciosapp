import { proceduralHowToReply } from './assistant-howto.util';

describe('procedural how-to', () => {
  it('cómo solicito vacaciones dă pașii, nu textul general', () => {
    const text = proceduralHowToReply('Cómo solicito vacaciones?', 'es');
    expect(text).toContain('Solicitudes');
    expect(text).toContain('Vacaciones');
    expect(text).not.toContain('Respuesta sin IA');
    expect(text).not.toContain('Cuadrantes');
  });

  it('o literă dublă nu pierde subiectul', () => {
    const text = proceduralHowToReply('como solicito vacaciones', 'es');
    expect(text).toContain('1. Abre Solicitudes');
  });

  it('programul de azi nu este un ghid de concediu', () => {
    expect(
      proceduralHowToReply('que horarrio tengo para hoy ?', 'es'),
    ).toBeNull();
  });

  it('uitat să pontez, cu litere greșite, dă pașii din Mi Horario', () => {
    const text = proceduralHowToReply('que ago si mi se olbido fichar ?', 'es');
    expect(text).toContain('Indicar motivo');
    expect(text).toContain('Olvidé fichar');
    expect(text).toContain('Regularizar');
    expect(text).not.toContain('cuadrante');
  });
});
