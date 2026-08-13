/** Shared types for Presupuestos V2 calculation engines. */

export type BcPair = { b: number; c: number };

export type MotorCodigo =
  | 'auxiliares_coste'
  | 'limpieza_coste'
  | 'precio_mensual'
  | 'piscina';

export type CalcParams = {
  iva_factor: number;
  iva_pct: number;
  meses_anio: number;
  divisor_hora_anual: number;
  semanas_mes: number;
  // auxiliares
  aux_ss_pct: number;
  aux_pagas: number;
  aux_horas_semana_legal: number;
  // limpieza
  limp_ss_pct: number;
  limp_pagas: number;
  limp_horas_semana: number;
  limp_vacaciones_dia_num: number;
  limp_vacaciones_dia_den: number;
  limp_pad_mensual: number;
};

/** Formula constants — commercial values live in DB; these are fallbacks matching Legacy. */
export const DEFAULT_CALC_PARAMS: CalcParams = {
  iva_factor: 1.21,
  iva_pct: 0.21,
  meses_anio: 12,
  divisor_hora_anual: 156,
  semanas_mes: 4.33,
  aux_ss_pct: 0.37,
  aux_pagas: 14,
  aux_horas_semana_legal: 40,
  limp_ss_pct: 0.35,
  limp_pagas: 12,
  limp_horas_semana: 39,
  limp_vacaciones_dia_num: 31,
  limp_vacaciones_dia_den: 30,
  limp_pad_mensual: 1.98,
};

export type TotalesOferta = {
  mensualidad_sin_iva: number;
  mensualidad_con_iva: number;
  anualidad_sin_iva: number;
  anualidad_con_iva: number;
};

export type LineaCalcResult = {
  codigo_motor: MotorCodigo | string;
  version_motor: string;
  breakdown: Record<string, number | string | boolean | null>;
  totales: TotalesOferta;
  warnings: string[];
  params_usados: CalcParams;
  descripcion?: string;
};

export type InputFieldSchema = {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'bc_pair';
  required?: boolean;
  default?: unknown;
  group?: string;
  help?: string;
};

export type MotorDefinition = {
  codigo: MotorCodigo;
  version: string;
  label: string;
  inputSchema: InputFieldSchema[];
  defaultInputs: () => Record<string, unknown>;
  calculate: (
    inputs: Record<string, unknown>,
    params: CalcParams,
  ) => LineaCalcResult;
};
