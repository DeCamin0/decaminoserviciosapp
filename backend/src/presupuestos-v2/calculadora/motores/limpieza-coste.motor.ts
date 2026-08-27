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

export function defaultInputsLimpieza(): Record<string, unknown> {
  return {
    convenioBase: 1485,
    numOperarias: 2,
    horasPorDiaPorOperaria: 4,
    diasLaborablesSemana: 5,
    serviciosExtraHoras: 12,
    uniformidad: { b: 150, c: 2 },
    gestoria: { b: 120, c: 2 },
    productosLimpieza: { b: 150, c: 12 },
    aplicaLimpiezaGajare: true,
    limpiezaGajare: { b: 450, c: 2 },
    acristalado: { b: 250, c: 1 },
    cristalero: { b: 90, c: 0 },
    cubos: { b: 8, c: 0 },
    telefono: { b: 22, c: 0 },
    vigilancia: { b: 8.4, c: 2 },
    gastosFijoHoras: { b: 1.1 },
    beneficioEmpresarial: { b: 150, c: 1 },
    d48Manual: null,
    extra: 0,
  };
}

/**
 * Port of Legacy `calcResultadoLimpieza`.
 * Includes Legacy pad +1.98 on monthly D48 (now params.limp_pad_mensual).
 * Oferta totals use d48ParaPrecio (manual override if set) — intentional V2 fix
 * vs Legacy oferta which ignored d48Manual; flagged in warnings when override used.
 */
export function calculateLimpiezaCoste(
  inputs: Record<string, unknown>,
  params: CalcParams,
): LineaCalcResult {
  const warnings: string[] = [];
  const numOp = n(inputs.numOperarias);
  const hDia = n(inputs.horasPorDiaPorOperaria);
  const dias = n(inputs.diasLaborablesSemana);
  const B4 = numOp * hDia * dias;
  const D4 = n(inputs.convenioBase) * params.limp_pagas;
  const D6 = B4 > 0 ? (D4 / params.limp_horas_semana) * B4 : 0;
  const D8 =
    (D6 / params.meses_anio / params.limp_vacaciones_dia_den) *
    params.limp_vacaciones_dia_num;
  const D10 = D8 / params.meses_anio;
  const D12 =
    (D6 > 0 ? D6 / params.divisor_hora_anual : 0) *
    n(inputs.serviciosExtraHoras);
  const D14 = D6 + D8 + D10 + D12;
  const D16 = (D6 + D8 + D10) * params.limp_ss_pct;
  const D18 = D14 + D16;

  const unif = bc(inputs.uniformidad, { b: 150, c: 2 });
  const gest = bc(inputs.gestoria, { b: 120, c: 2 });
  const prod = bc(inputs.productosLimpieza, { b: 150, c: 12 });
  const gaj = bc(inputs.limpiezaGajare, { b: 450, c: 2 });
  const acr = bc(inputs.acristalado, { b: 250, c: 1 });
  const cris = bc(inputs.cristalero, { b: 90, c: 0 });
  const cub = bc(inputs.cubos, { b: 8, c: 0 });
  const tel = bc(inputs.telefono, { b: 22, c: 0 });
  const vig = bc(inputs.vigilancia, { b: 8.4, c: 2 });
  const gastoB = n(
    (inputs.gastosFijoHoras as { b?: number } | undefined)?.b,
    1.1,
  );
  const benef = bc(inputs.beneficioEmpresarial, { b: 150, c: 1 });

  const D20 = unif.b * unif.c;
  const D22 = gest.b * gest.c;
  const D24 = prod.b * prod.c;
  const D26 = inputs.aplicaLimpiezaGajare !== false ? gaj.b * gaj.c : 0;
  const D28 = acr.b * acr.c;
  const D30 = cris.b * cris.c;
  const D32 = cub.b * cub.c;
  const D34 = tel.b * tel.c * params.meses_anio;
  const D36 = vig.b * vig.c * params.meses_anio;
  const D38 = gastoB * B4 * params.semanas_mes * params.meses_anio;
  const D40 = benef.b * benef.c * params.meses_anio;
  const D42 = D20 + D22 + D24 + D26 + D28 + D30 + D32 + D34 + D36 + D38 + D40;
  const D44 = (D18 + D42) * params.iva_pct;
  const D46 = D18 + D42 + D44;
  const D48 =
    D46 / params.iva_factor / params.meses_anio + params.limp_pad_mensual;

  const d48ManualRaw = inputs.d48Manual;
  const d48ManualNum =
    d48ManualRaw != null && d48ManualRaw !== '' ? Number(d48ManualRaw) : NaN;
  const d48ParaPrecio =
    !Number.isNaN(d48ManualNum) && d48ManualNum >= 0 ? d48ManualNum : D48;
  if (!Number.isNaN(d48ManualNum) && d48ManualNum >= 0) {
    warnings.push(
      'D48 manual override activo (V2 aplica el override también a totales oferta; Legacy UI-only)',
    );
  }

  const precioFinalACliente = d48ParaPrecio * params.meses_anio;
  const horasTot = numOp * hDia;
  const descripcion = `${numOp} operaria${numOp !== 1 ? 's' : ''}, ${horasTot}h de lunes a viernes (festivo no incluido)`;

  const extra = n(inputs.extra);
  const mensualSin = d48ParaPrecio + extra;
  const anualSin = precioFinalACliente + extra * params.meses_anio;

  return {
    codigo_motor: 'limpieza_coste',
    version_motor: '1',
    descripcion,
    breakdown: {
      B4,
      D4,
      D6,
      D8,
      D10,
      D12,
      D14,
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
      d48ParaPrecio,
      precioFinalACliente,
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

export const motorLimpiezaCoste: MotorDefinition = {
  codigo: 'limpieza_coste',
  version: '1',
  label: 'Coste de personal — Limpieza',
  defaultInputs: defaultInputsLimpieza,
  calculate: calculateLimpiezaCoste,
  inputSchema: [
    {
      key: 'convenioBase',
      label: 'Convenio base (€/mes)',
      type: 'number',
      group: 'base',
    },
    {
      key: 'numOperarias',
      label: 'Nº operarias',
      type: 'number',
      group: 'base',
    },
    {
      key: 'horasPorDiaPorOperaria',
      label: 'Horas / día / operaria',
      type: 'number',
      group: 'base',
    },
    {
      key: 'diasLaborablesSemana',
      label: 'Días laborables / semana',
      type: 'number',
      group: 'base',
    },
    {
      key: 'serviciosExtraHoras',
      label: 'Horas servicios extra (anual)',
      type: 'number',
      group: 'base',
    },
    {
      key: 'uniformidad',
      label: 'Uniformidad',
      type: 'bc_pair',
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
      key: 'aplicaLimpiezaGajare',
      label: 'Aplicar limpieza Gajare',
      type: 'boolean',
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
      label: 'Gastos fijo (€/h; C=B4)',
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
      key: 'd48Manual',
      label: 'Precio mensual forzado (opcional)',
      type: 'number',
      group: 'oferta',
    },
    {
      key: 'extra',
      label: 'Extra €/mes (oferta)',
      type: 'number',
      group: 'oferta',
    },
  ],
};
