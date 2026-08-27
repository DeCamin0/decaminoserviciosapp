import { BcPair, CalcParams, LineaCalcResult, MotorDefinition } from '../tipos';

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function bc(v: unknown, fb: BcPair): BcPair {
  if (!v || typeof v !== 'object') return { ...fb };
  const o = v as Record<string, unknown>;
  return { b: n(o.b, fb.b), c: n(o.c, fb.c) };
}

export function defaultInputsAuxiliares(): Record<string, unknown> {
  return {
    convenioBase: 1221,
    horasDiarias: 8,
    diasPorSemana: 7,
    sinFestivos: false,
    horasACubrirPorSemana: 168,
    aplicaNocturnidad: false,
    nocturnidad: { b: 0, c: 0.77 },
    aplicaFinDeSemana: false,
    finDeSemana: { b: 952, c: 0.22 },
    aplicaServiciosExtra: false,
    serviciosExtraHoras: 0,
    aplicaUniformidadAuto: true,
    numEmpleadosManual: 0,
    uniformidad: { b: 150, c: 2 },
    aplicaGestoriaAuto: true,
    gestoria: { b: 120, c: 2 },
    productosLimpieza: { b: 30, c: 12 },
    limpiezaGajare: { b: 300, c: 0 },
    acristalado: { b: 125, c: 0 },
    cristalero: { b: 90, c: 0 },
    cubos: { b: 15, c: 0 },
    telefono: { b: 22, c: 1 },
    vigilancia: { b: 8.4, c: 1 },
    gastosFijoHoras: { b: 1.1, c: 0 },
    beneficioEmpresarial: { b: 0, c: 1 },
    extra: 0,
  };
}

/**
 * Port of Legacy `calcResultadoAuxiliares` (PresupuestosInformesPage.jsx).
 * Economic rules preserved; constants come from CalcParams.
 */
export function calculateAuxiliaresCoste(
  inputs: Record<string, unknown>,
  params: CalcParams,
): LineaCalcResult {
  const warnings: string[] = [];
  const D2 = n(inputs.convenioBase);
  const B4 = n(inputs.horasDiarias) * n(inputs.diasPorSemana);
  const horasACubrir = n(inputs.horasACubrirPorSemana, 168);
  const legal = params.aux_horas_semana_legal;
  const numConserjeNecesarios = legal > 0 ? horasACubrir / legal : 0;

  const D4 = D2 * params.aux_pagas;
  const D6 = legal > 0 ? (D4 / legal) * B4 : 0;
  const D8 = D6 / params.meses_anio;
  const D10 = D8 / params.meses_anio;

  const aplicaNoct = Boolean(inputs.aplicaNocturnidad);
  const noct = bc(inputs.nocturnidad, { b: 0, c: 0.77 });
  const D12 = aplicaNoct ? noct.b * noct.c : 0;

  const aplicaFds = Boolean(inputs.aplicaFinDeSemana);
  const fds = bc(inputs.finDeSemana, { b: 952, c: 0.22 });
  const D14 = aplicaFds ? fds.b * fds.c : 0;

  const C16 = D6 / params.divisor_hora_anual;
  const aplicaExtra = Boolean(inputs.aplicaServiciosExtra);
  const B16 = n(inputs.serviciosExtraHoras);
  const D16 = aplicaExtra ? B16 * C16 : 0;

  const D18 = D6 + D8 + D10 + D12 + D14 + D16;
  const D20 = (D6 + D8 + D10) * params.aux_ss_pct;
  const D22 = D18 + D20;

  const autoUnif = inputs.aplicaUniformidadAuto !== false;
  const unif = bc(inputs.uniformidad, { b: 150, c: 2 });
  const numEmpleados = autoUnif
    ? Math.floor(numConserjeNecesarios)
    : n(inputs.numEmpleadosManual);
  const numUniformes = autoUnif ? numEmpleados + 1 : unif.c;
  const D24 = unif.b * numUniformes;

  const autoGest = inputs.aplicaGestoriaAuto !== false;
  const gest = bc(inputs.gestoria, { b: 120, c: 2 });
  const numEmpleadosGestoria = autoGest
    ? Math.floor(numConserjeNecesarios)
    : gest.c;
  const D26 = gest.b * numEmpleadosGestoria;

  const prod = bc(inputs.productosLimpieza, { b: 30, c: 12 });
  const gaj = bc(inputs.limpiezaGajare, { b: 300, c: 0 });
  const acr = bc(inputs.acristalado, { b: 125, c: 0 });
  const cris = bc(inputs.cristalero, { b: 90, c: 0 });
  const cub = bc(inputs.cubos, { b: 15, c: 0 });
  const tel = bc(inputs.telefono, { b: 22, c: 1 });
  const vig = bc(inputs.vigilancia, { b: 8.4, c: 1 });
  const gasto = bc(inputs.gastosFijoHoras, { b: 1.1, c: 0 });
  const benef = bc(inputs.beneficioEmpresarial, { b: 0, c: 1 });

  const D28 = prod.b * prod.c;
  const D30 = gaj.b * gaj.c;
  const D32 = acr.b * acr.c;
  const D34 = cris.b * cris.c;
  const D36 = cub.b * cub.c;
  const D38 = tel.b * tel.c * params.meses_anio;
  const D40 = vig.b * vig.c * params.meses_anio;
  const D42 = gasto.b * gasto.c * params.semanas_mes * params.meses_anio;
  const D44 = benef.c * benef.b * params.meses_anio;
  const D46 = D24 + D26 + D28 + D30 + D32 + D34 + D36 + D38 + D40 + D42 + D44;
  const D48 = (D22 + D46) * params.iva_pct;
  const D50 = D22 + D46 + D48;
  const D52 = D50 / params.iva_factor / params.meses_anio;
  const precioFinalACliente = D52 * params.meses_anio;
  const costeTotalEmpleadoMesUnifGestoria =
    D22 / params.meses_anio + (D24 + D26) / params.meses_anio;

  const extra = n(inputs.extra);
  const mensualSin = D52 + extra;
  const anualSin = precioFinalACliente + extra * params.meses_anio;

  if (B4 <= 0) warnings.push('Horas semanales (B4) es 0');

  return {
    codigo_motor: 'auxiliares_coste',
    version_motor: '1',
    breakdown: {
      B4,
      numConserjeNecesarios,
      numEmpleados,
      numUniformes,
      numEmpleadosGestoria,
      horasACubrirPorSemana: horasACubrir,
      D4,
      D6,
      D8,
      D10,
      D12,
      D14,
      C16,
      D16,
      D18,
      D20,
      D22,
      D24,
      D26,
      D28,
      D30,
      D32,
      D34,
      D36,
      D38,
      D40,
      D42,
      D44,
      D46,
      D48,
      D50,
      D52,
      precioFinalACliente,
      costeTotalEmpleadoMesUnifGestoria,
      extra,
    },
    totales: {
      mensualidad_sin_iva: mensualSin,
      mensualidad_con_iva: mensualSin * params.iva_factor,
      anualidad_sin_iva: anualSin,
      anualidad_con_iva: anualSin * params.iva_factor,
    },
    warnings,
    params_usados: { ...params },
  };
}

export const motorAuxiliaresCoste: MotorDefinition = {
  codigo: 'auxiliares_coste',
  version: '1',
  label: 'Coste de personal — Auxiliares',
  defaultInputs: defaultInputsAuxiliares,
  calculate: calculateAuxiliaresCoste,
  inputSchema: [
    {
      key: 'convenioBase',
      label: 'Convenio base (€/mes)',
      type: 'number',
      group: 'base',
    },
    {
      key: 'horasDiarias',
      label: 'Horas / día',
      type: 'number',
      group: 'base',
    },
    {
      key: 'diasPorSemana',
      label: 'Días / semana',
      type: 'number',
      group: 'base',
    },
    {
      key: 'horasACubrirPorSemana',
      label: 'Horas a cubrir / semana',
      type: 'number',
      group: 'base',
    },
    {
      key: 'sinFestivos',
      label: 'Sin festivos (texto oferta)',
      type: 'boolean',
      group: 'base',
    },
    {
      key: 'aplicaNocturnidad',
      label: 'Aplicar nocturnidad',
      type: 'boolean',
      group: 'suplementos',
    },
    {
      key: 'nocturnidad',
      label: 'Nocturnidad (B×C)',
      type: 'bc_pair',
      group: 'suplementos',
    },
    {
      key: 'aplicaFinDeSemana',
      label: 'Aplicar fin de semana',
      type: 'boolean',
      group: 'suplementos',
    },
    {
      key: 'finDeSemana',
      label: 'Fin de semana (B×C)',
      type: 'bc_pair',
      group: 'suplementos',
    },
    {
      key: 'aplicaServiciosExtra',
      label: 'Aplicar servicios extra',
      type: 'boolean',
      group: 'suplementos',
    },
    {
      key: 'serviciosExtraHoras',
      label: 'Horas servicios extra',
      type: 'number',
      group: 'suplementos',
    },
    {
      key: 'aplicaUniformidadAuto',
      label: 'Uniformidad auto',
      type: 'boolean',
      group: 'costes',
    },
    {
      key: 'numEmpleadosManual',
      label: 'Nº empleados (manual)',
      type: 'number',
      group: 'costes',
    },
    {
      key: 'uniformidad',
      label: 'Uniformidad',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'aplicaGestoriaAuto',
      label: 'Gestoría auto',
      type: 'boolean',
      group: 'costes',
    },
    { key: 'gestoria', label: 'Gestoría', type: 'bc_pair', group: 'costes' },
    {
      key: 'productosLimpieza',
      label: 'Productos limpieza',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'limpiezaGajare',
      label: 'Limpieza Gajare',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'acristalado',
      label: 'Acristalado',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'cristalero',
      label: 'Cristalero',
      type: 'bc_pair',
      group: 'costes',
    },
    { key: 'cubos', label: 'Cubos', type: 'bc_pair', group: 'costes' },
    { key: 'telefono', label: 'Teléfono', type: 'bc_pair', group: 'costes' },
    {
      key: 'vigilancia',
      label: 'Vigilancia',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'gastosFijoHoras',
      label: 'Gastos fijo horas',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'beneficioEmpresarial',
      label: 'Beneficio empresarial',
      type: 'bc_pair',
      group: 'costes',
    },
    {
      key: 'extra',
      label: 'Extra €/mes (oferta)',
      type: 'number',
      group: 'oferta',
    },
  ],
};
