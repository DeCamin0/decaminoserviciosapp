import { procedimientosAppHelpDatosPersonalesSupplement } from './assistant-procedimientos-app-help-prompt.util';

describe('procedimientosAppHelpDatosPersonalesSupplement', () => {
  it('incluye /datos y motivo en español por defecto', () => {
    const s = procedimientosAppHelpDatosPersonalesSupplement('es');
    expect(s).toContain('/datos');
    expect(s.toLowerCase()).toContain('motivo');
    expect(s.toLowerCase()).toContain('aprobación');
  });

  it('varianta română', () => {
    const s = procedimientosAppHelpDatosPersonalesSupplement('ro');
    expect(s.toLowerCase()).toContain('date personale');
    expect(s).toContain('/datos');
  });
});
