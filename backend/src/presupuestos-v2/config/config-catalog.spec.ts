import {
  PARAM_CATALOG,
  paramToDisplay,
  paramFromDisplay,
  resolveSerieFormato,
  normalizeContenidoComercial,
} from './config-catalog';
import { formatNumeroSerie } from '../emit/numero.util';

describe('Presupuestos V2 config catalog', () => {
  it('converts IVA percent display ↔ stored', () => {
    const iva = PARAM_CATALOG.find((p) => p.clave === 'iva_pct')!;
    expect(paramToDisplay(iva, 0.21)).toBe(21);
    expect(paramFromDisplay(iva, 21)).toBe(0.21);
  });

  it('resolves controlled serie formats', () => {
    expect(resolveSerieFormato('pref_year_seq')).toBe('{PREF}-{YYYY}-{SEQ}');
    expect(resolveSerieFormato('{PREF}-{YYYY}-{SEQ}')).toBe(
      '{PREF}-{YYYY}-{SEQ}',
    );
    expect(() => resolveSerieFormato('{HACK}')).toThrow();
    expect(() => resolveSerieFormato('{PREF}-{YYYY}')).toThrow();
  });

  it('previews serie numbers', () => {
    const n = formatNumeroSerie({
      prefijo: 'MAD',
      formato: '{PREF}-{YYYY}-{SEQ}',
      padding: 4,
      anio: 2026,
      secuencia: 1,
    });
    expect(n).toBe('MAD-2026-0001');
  });

  it('normalizes contenido comercial from textarea lines', () => {
    const c = normalizeContenidoComercial(
      {
        titulo_comercial: 'Limpieza',
        operativa: 'A\nB',
        tareas: ['T1', ''],
      },
      'Fallback',
    );
    expect(c.titulo_comercial).toBe('Limpieza');
    expect(c.operativa).toEqual(['A', 'B']);
    expect(c.tareas).toEqual(['T1']);
  });
});
