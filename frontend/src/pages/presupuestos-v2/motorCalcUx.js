/**
 * Display-only helpers for Presupuestos V2 calc forms.
 * Mirrors motor formulas for live subtotals; prefer resultado.breakdown when present.
 * Does NOT change backend calculation.
 */

import { moneyEs } from './v2UiHelpers.js';

export function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function bc(v, fb = { b: 0, c: 0 }) {
  if (!v || typeof v !== 'object') return { b: fb.b, c: fb.c };
  return { b: n(v.b, fb.b), c: n(v.c, fb.c) };
}

export function moneyYear(v) {
  return `${moneyEs(v)} €/año`;
}

export function moneyMonth(v) {
  return `${moneyEs(v)} €/mes`;
}

export function fmtQty(v, digits = 2) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Prefer motor breakdown value when available. */
export function fromBreakdown(resultado, key, fallback) {
  const raw = resultado?.breakdown?.[key];
  if (raw == null || raw === '') return fallback;
  const x = Number(raw);
  return Number.isFinite(x) ? x : fallback;
}

export function paramsFromResultado(resultado) {
  const p = resultado?.params_usados || {};
  return {
    meses_anio: n(p.meses_anio, 12),
    semanas_mes: n(p.semanas_mes, 4.33),
    aux_horas_semana_legal: n(p.aux_horas_semana_legal, 40),
  };
}

/** Same counting rules as auxiliares-coste.motor.ts (display). */
export function auxiliaresHeadcount(inputs, resultado) {
  const { aux_horas_semana_legal: legal } = paramsFromResultado(resultado);
  const horas = n(inputs.horasACubrirPorSemana, 168);
  const numConserjeNecesarios = fromBreakdown(
    resultado,
    'numConserjeNecesarios',
    legal > 0 ? horas / legal : 0,
  );
  const autoUnif = inputs.aplicaUniformidadAuto !== false;
  const autoGest = inputs.aplicaGestoriaAuto !== false;
  const unif = bc(inputs.uniformidad, { b: 150, c: 2 });
  const gest = bc(inputs.gestoria, { b: 120, c: 2 });

  const numEmpleados = fromBreakdown(
    resultado,
    'numEmpleados',
    autoUnif ? Math.floor(numConserjeNecesarios) : n(inputs.numEmpleadosManual),
  );
  const numUniformes = fromBreakdown(
    resultado,
    'numUniformes',
    autoUnif ? numEmpleados + 1 : unif.c,
  );
  const numEmpleadosGestoria = fromBreakdown(
    resultado,
    'numEmpleadosGestoria',
    autoGest ? Math.floor(numConserjeNecesarios) : gest.c,
  );

  const costeUnif = fromBreakdown(resultado, 'D24', unif.b * numUniformes);
  const costeGest = fromBreakdown(resultado, 'D26', gest.b * numEmpleadosGestoria);

  return {
    numConserjeNecesarios,
    numEmpleados,
    numUniformes,
    numEmpleadosGestoria,
    costeUnif,
    costeGest,
    precioUniforme: unif.b,
    precioGestoria: gest.b,
  };
}

export function auxiliaresB4(inputs, resultado) {
  return fromBreakdown(
    resultado,
    'B4',
    n(inputs.horasDiarias) * n(inputs.diasPorSemana),
  );
}

export function limpiezaB4(inputs, resultado) {
  return fromBreakdown(
    resultado,
    'B4',
    n(inputs.numOperarias) *
      n(inputs.horasPorDiaPorOperaria) *
      n(inputs.diasLaborablesSemana),
  );
}

/** Pair subtotal lines for UI (informational). */
export function pairSubtotalSimple(b, c, unitLabel, resultadoKey, resultado) {
  const product = fromBreakdown(resultado, resultadoKey, n(b) * n(c));
  const unit = unitLabel ? ` ${unitLabel}` : '';
  return {
    product,
    text: `${moneyEs(b)} € × ${fmtQty(c, 4)}${unit} = ${moneyYear(product)}`,
  };
}

export function pairSubtotalMensualAnual(
  b,
  c,
  unitLabel,
  resultadoKey,
  resultado,
) {
  const { meses_anio } = paramsFromResultado(resultado);
  const product = fromBreakdown(
    resultado,
    resultadoKey,
    n(b) * n(c) * meses_anio,
  );
  const unit = unitLabel ? ` ${unitLabel}` : '';
  return {
    product,
    text: `${moneyEs(b)} €/mes × ${fmtQty(c, 4)}${unit} × ${meses_anio} meses = ${moneyYear(product)}`,
  };
}

export function pairSubtotalBeneficio(b, c, resultadoKey, resultado) {
  const { meses_anio } = paramsFromResultado(resultado);
  const product = fromBreakdown(
    resultado,
    resultadoKey,
    n(b) * n(c) * meses_anio,
  );
  return {
    product,
    text: `${moneyEs(b)} €/mes × ${fmtQty(c, 4)} × ${meses_anio} meses = ${moneyYear(product)}`,
  };
}

export function pairSubtotalGastosFijoAux(b, c, resultado) {
  const { meses_anio, semanas_mes } = paramsFromResultado(resultado);
  const product = fromBreakdown(
    resultado,
    'D42',
    n(b) * n(c) * semanas_mes * meses_anio,
  );
  return {
    product,
    text: `${moneyEs(b)} €/h × ${fmtQty(c, 4)} h/sem × ${fmtQty(semanas_mes, 2)} × ${meses_anio} = ${moneyYear(product)}`,
  };
}

export function pairSubtotalGastosFijoLimp(b, B4, resultado) {
  const { meses_anio, semanas_mes } = paramsFromResultado(resultado);
  const product = fromBreakdown(
    resultado,
    'D38',
    n(b) * n(B4) * semanas_mes * meses_anio,
  );
  return {
    product,
    text: `${moneyEs(b)} €/h × ${fmtQty(B4, 4)} h/sem × ${fmtQty(semanas_mes, 2)} × ${meses_anio} = ${moneyYear(product)}`,
  };
}

export function pairSubtotalNoctOrFds(b, c, resultadoKey, resultado) {
  const product = fromBreakdown(resultado, resultadoKey, n(b) * n(c));
  return {
    product,
    text: `${fmtQty(b, 4)} × ${fmtQty(c, 4)} = ${moneyYear(product)}`,
  };
}
