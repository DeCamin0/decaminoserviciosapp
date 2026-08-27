import {
  applyDescuentoFidelidadToTotales,
  clampDescuentoFidelidadPct,
  expandOfertaRowsConDescuentoFidelidad,
} from './descuento-fidelidad.util';
import { normalizeTotales } from './totales.util';

describe('Descuento por fidelidad V2', () => {
  const t = (m: number) =>
    normalizeTotales({
      mensualidad_sin_iva: m,
      mensualidad_con_iva: m * 1.21,
      anualidad_sin_iva: m * 12,
      anualidad_con_iva: m * 12 * 1.21,
    });

  it('clamps pct 0–100 with 2 decimals', () => {
    expect(clampDescuentoFidelidadPct('7,55')).toBe(7.55);
    expect(clampDescuentoFidelidadPct(150)).toBe(100);
    expect(clampDescuentoFidelidadPct(-1)).toBe(0);
    expect(clampDescuentoFidelidadPct('')).toBe(0);
  });

  it('pct 0 leaves totals unchanged', () => {
    const a = applyDescuentoFidelidadToTotales(t(100), 0);
    expect(a.neto).toEqual(t(100));
    expect(a.descuento.mensualidad_sin_iva).toBe(0);
  });

  it('10% reduces sin and con proportionally', () => {
    const a = applyDescuentoFidelidadToTotales(t(100), 10);
    expect(a.pct).toBe(10);
    expect(a.descuento.mensualidad_sin_iva).toBe(10);
    expect(a.neto.mensualidad_sin_iva).toBe(90);
    expect(a.neto.mensualidad_con_iva).toBeCloseTo(108.9, 5);
    expect(a.neto.anualidad_sin_iva).toBe(1080);
  });

  it('expands oferta rows with discount + block total', () => {
    const rows = expandOfertaRowsConDescuentoFidelidad(
      [
        {
          descripcion: 'Auxiliares — Opción 1',
          ...t(200),
        },
      ],
      10,
    );
    expect(rows).toHaveLength(3);
    expect(rows[1].descripcion).toMatch(/Descuento por fidelidad \(10%\)/);
    expect(rows[1].mensualidad_sin_iva).toBe(-20);
    expect(rows[2].tipo).toBe('total_neto');
    expect(rows[2].mensualidad_sin_iva).toBe(180);
  });

  it('does not expand when pct is 0', () => {
    const base = [{ descripcion: 'X', ...t(50) }];
    expect(expandOfertaRowsConDescuentoFidelidad(base, 0)).toEqual(base);
  });
});
