import { looksLikeAppHelpDatosPersonales } from './assistant-app-help.util';

describe('looksLikeAppHelpDatosPersonales', () => {
  it('detecta dirección + no me deja (caso real)', () => {
    expect(
      looksLikeAppHelpDatosPersonales(
        'Quiero poner la direccion de mi casa y no me deja',
      ),
    ).toBe(true);
  });

  it('detecta datos personales + dónde', () => {
    expect(
      looksLikeAppHelpDatosPersonales('¿Dónde están mis datos personales?'),
    ).toBe(true);
  });

  it('detecta no me deja + guardar', () => {
    expect(
      looksLikeAppHelpDatosPersonales('No me deja guardar mis datos'),
    ).toBe(true);
  });

  it('no activa en consulta genérica de fichajes sin datos personales', () => {
    expect(looksLikeAppHelpDatosPersonales('¿Cómo ficho hoy?')).toBe(false);
  });
});
