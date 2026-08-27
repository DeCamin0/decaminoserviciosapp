/**
 * Descuento por fidelidad (Legacy presupuestoDescuentoGlobalPct).
 * Applied on economic offer presentation/totals; does not change motor formulas.
 */

import { clampPresupuestoDescuentoGlobalPct } from '../../utils/presupuesto-descuento-pct';
import { TotalesMoney, normalizeTotales, round2 } from './totales.util';

export { clampPresupuestoDescuentoGlobalPct as clampDescuentoFidelidadPct };

export type OfertaMoneyRow = {
  descripcion: string;
  mensualidad_sin_iva: number;
  mensualidad_con_iva: number;
  anualidad_sin_iva: number;
  anualidad_con_iva: number;
  tipo?: 'servicio' | 'descuento' | 'total_neto' | string;
};

export type DescuentoFidelidadApplied = {
  pct: number;
  bruto: TotalesMoney;
  descuento: TotalesMoney;
  neto: TotalesMoney;
};

export function scaleTotales(t: TotalesMoney, factor: number): TotalesMoney {
  return normalizeTotales({
    mensualidad_sin_iva: t.mensualidad_sin_iva * factor,
    mensualidad_con_iva: t.mensualidad_con_iva * factor,
    anualidad_sin_iva: t.anualidad_sin_iva * factor,
    anualidad_con_iva: t.anualidad_con_iva * factor,
  });
}

export function subtractTotales(
  a: TotalesMoney,
  b: TotalesMoney,
): TotalesMoney {
  return normalizeTotales({
    mensualidad_sin_iva: a.mensualidad_sin_iva - b.mensualidad_sin_iva,
    mensualidad_con_iva: a.mensualidad_con_iva - b.mensualidad_con_iva,
    anualidad_sin_iva: a.anualidad_sin_iva - b.anualidad_sin_iva,
    anualidad_con_iva: a.anualidad_con_iva - b.anualidad_con_iva,
  });
}

/**
 * Proportional discount on both sin/con IVA (preserves limp pad ratios).
 */
export function applyDescuentoFidelidadToTotales(
  brutoIn: TotalesMoney,
  pctRaw: unknown,
): DescuentoFidelidadApplied {
  const bruto = normalizeTotales(brutoIn);
  const pct = clampPresupuestoDescuentoGlobalPct(pctRaw);
  if (!pct) {
    return {
      pct: 0,
      bruto,
      descuento: normalizeTotales({}),
      neto: bruto,
    };
  }
  const descuento = scaleTotales(bruto, pct / 100);
  const neto = subtractTotales(bruto, descuento);
  return { pct, bruto, descuento, neto };
}

/**
 * After each base offer row, append discount + block total (Legacy rule).
 */
export function expandOfertaRowsConDescuentoFidelidad(
  rows: OfertaMoneyRow[],
  pctRaw: unknown,
): OfertaMoneyRow[] {
  const pct = clampPresupuestoDescuentoGlobalPct(pctRaw);
  if (!pct || !Array.isArray(rows) || rows.length === 0) return rows || [];
  const out: OfertaMoneyRow[] = [];
  for (const r of rows) {
    if (r?.tipo === 'total_neto' || r?.tipo === 'descuento') {
      out.push(r);
      continue;
    }
    out.push({ ...r, tipo: r.tipo || 'servicio' });
    const applied = applyDescuentoFidelidadToTotales(
      {
        mensualidad_sin_iva: Number(r.mensualidad_sin_iva) || 0,
        mensualidad_con_iva: Number(r.mensualidad_con_iva) || 0,
        anualidad_sin_iva: Number(r.anualidad_sin_iva) || 0,
        anualidad_con_iva: Number(r.anualidad_con_iva) || 0,
      },
      pct,
    );
    if (
      applied.descuento.mensualidad_sin_iva !== 0 ||
      applied.descuento.anualidad_sin_iva !== 0
    ) {
      out.push({
        descripcion: `Descuento por fidelidad (${pct}%)`,
        mensualidad_sin_iva: -applied.descuento.mensualidad_sin_iva,
        mensualidad_con_iva: -applied.descuento.mensualidad_con_iva,
        anualidad_sin_iva: -applied.descuento.anualidad_sin_iva,
        anualidad_con_iva: -applied.descuento.anualidad_con_iva,
        tipo: 'descuento',
      });
    }
    const pref = String(r.descripcion || 'Servicio').trim();
    const suf = pref.length > 70 ? `${pref.slice(0, 70)}…` : pref;
    out.push({
      descripcion: `TOTAL (importe neto a pagar, incl. descuento por fidelidad) — ${suf}`,
      mensualidad_sin_iva: applied.neto.mensualidad_sin_iva,
      mensualidad_con_iva: applied.neto.mensualidad_con_iva,
      anualidad_sin_iva: applied.neto.anualidad_sin_iva,
      anualidad_con_iva: applied.neto.anualidad_con_iva,
      tipo: 'total_neto',
    });
  }
  return out;
}

export function roundOfertaMoney(n: number): number {
  return round2(n);
}
