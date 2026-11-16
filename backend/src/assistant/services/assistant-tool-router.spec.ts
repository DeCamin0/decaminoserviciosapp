import { IntentType } from './intent-classifier.service';
import { parseRouterToolArguments } from './assistant-tool-router';

describe('assistant tool router', () => {
  it('traduce o unealtă cunoscută și păstrează doar câmpurile valide', () => {
    const choice = parseRouterToolArguments({
      tool: 'fichajes',
      fecha: '2026-11-10',
      codigo: '10000003',
      nombre: 'Ian cu',
      quienNoHaFichado: true,
      mes: 'no',
    });
    expect(choice?.intent).toBe(IntentType.FICHAJES);
    expect(choice?.entidades.fecha).toBe('2026-11-10');
    expect(choice?.entidades.codigo).toBe('10000003');
    expect(choice?.entidades.tipo).toBe('fichajes_faltantes');
    expect(choice?.entidades.mes).toBeUndefined();
  });

  it('ninguna și uneltele inventate nu schimbă fluxul', () => {
    expect(parseRouterToolArguments({ tool: 'ninguna' })).toBeNull();
    expect(parseRouterToolArguments({ tool: 'DROP TABLE' })).toBeNull();
    expect(parseRouterToolArguments(null)).toBeNull();
  });

  it('refuză codul și filtrul care nu sunt din lista închisă', () => {
    const choice = parseRouterToolArguments({
      tool: 'empleados',
      codigo: "1' OR 1=1",
      filtro: 'todos',
    });
    expect(choice?.intent).toBe(IntentType.EMPLEADOS);
    expect(choice?.entidades.codigo).toBeUndefined();
    expect(choice?.entidades.filtro).toBeUndefined();
  });
});
