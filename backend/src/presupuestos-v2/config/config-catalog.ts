/**
 * Catalog of calculation params exposed to Config UI.
 * Keys not listed here stay internal (not editable via Admin UI).
 */

export type ParamUnit = 'percent' | 'factor' | 'number' | 'days' | 'hours';

export type ParamCatalogEntry = {
  clave: string;
  ambito: 'global' | 'motor';
  motor_codigo: string;
  label: string;
  helper: string;
  unit: ParamUnit;
  /** How to display: percent multiplies by 100 for UI when stored as 0.21 */
  display: 'percent_0_1' | 'percent_0_100' | 'raw';
  group: string;
  adminEditable: boolean;
};

export const PARAM_CATALOG: ParamCatalogEntry[] = [
  {
    clave: 'iva_pct',
    ambito: 'global',
    motor_codigo: '',
    label: 'IVA',
    helper: 'Porcentaje de IVA aplicado a la oferta económica.',
    unit: 'percent',
    display: 'percent_0_1',
    group: 'Fiscal',
    adminEditable: true,
  },
  {
    clave: 'iva_factor',
    ambito: 'global',
    motor_codigo: '',
    label: 'Factor IVA',
    helper: 'Debe ser 1 + IVA (ej. 1,21). Se sincroniza al guardar el IVA.',
    unit: 'factor',
    display: 'raw',
    group: 'Fiscal',
    adminEditable: false, // derived from iva_pct
  },
  {
    clave: 'meses_anio',
    ambito: 'global',
    motor_codigo: '',
    label: 'Meses por año',
    helper: 'Usado para anualizar importes mensuales.',
    unit: 'number',
    display: 'raw',
    group: 'Generales',
    adminEditable: true,
  },
  {
    clave: 'divisor_hora_anual',
    ambito: 'global',
    motor_codigo: '',
    label: 'Divisor hora anual',
    helper: 'Divisor Legacy para derivar €/hora (D6/156).',
    unit: 'number',
    display: 'raw',
    group: 'Generales',
    adminEditable: true,
  },
  {
    clave: 'semanas_mes',
    ambito: 'global',
    motor_codigo: '',
    label: 'Semanas por mes',
    helper: 'Factor de semanas/mes en gastos fijos.',
    unit: 'number',
    display: 'raw',
    group: 'Generales',
    adminEditable: true,
  },
  {
    clave: 'aux_ss_pct',
    ambito: 'motor',
    motor_codigo: 'auxiliares_coste',
    label: 'Seguridad Social — Auxiliares',
    helper: 'Porcentaje de SS en el motor de auxiliares.',
    unit: 'percent',
    display: 'percent_0_1',
    group: 'Auxiliares',
    adminEditable: true,
  },
  {
    clave: 'aux_pagas',
    ambito: 'motor',
    motor_codigo: 'auxiliares_coste',
    label: 'Pagas — Auxiliares',
    helper: 'Número de pagas de convenio (auxiliares).',
    unit: 'number',
    display: 'raw',
    group: 'Auxiliares',
    adminEditable: true,
  },
  {
    clave: 'aux_horas_semana_legal',
    ambito: 'motor',
    motor_codigo: 'auxiliares_coste',
    label: 'Horas semanales legales — Auxiliares',
    helper: 'Jornada semanal de referencia.',
    unit: 'hours',
    display: 'raw',
    group: 'Auxiliares',
    adminEditable: true,
  },
  {
    clave: 'limp_ss_pct',
    ambito: 'motor',
    motor_codigo: 'limpieza_coste',
    label: 'Seguridad Social — Limpieza',
    helper: 'Porcentaje de SS en el motor de limpieza.',
    unit: 'percent',
    display: 'percent_0_1',
    group: 'Limpieza',
    adminEditable: true,
  },
  {
    clave: 'limp_pagas',
    ambito: 'motor',
    motor_codigo: 'limpieza_coste',
    label: 'Pagas — Limpieza',
    helper: 'Número de pagas de convenio (limpieza).',
    unit: 'number',
    display: 'raw',
    group: 'Limpieza',
    adminEditable: true,
  },
  {
    clave: 'limp_horas_semana',
    ambito: 'motor',
    motor_codigo: 'limpieza_coste',
    label: 'Horas semanales — Limpieza',
    helper: 'Divisor de horas semanales del motor limpieza.',
    unit: 'hours',
    display: 'raw',
    group: 'Limpieza',
    adminEditable: true,
  },
  {
    clave: 'limp_pad_mensual',
    ambito: 'motor',
    motor_codigo: 'limpieza_coste',
    label: 'Ajuste mensual limpieza',
    helper: 'Pad mensual Legacy (+1,98 €) aplicado al precio.',
    unit: 'number',
    display: 'raw',
    group: 'Limpieza',
    adminEditable: true,
  },
];

export function catalogByClave(clave: string): ParamCatalogEntry | undefined {
  return PARAM_CATALOG.find((p) => p.clave === clave);
}

/** Convert DB stored value → UI display number */
export function paramToDisplay(
  entry: ParamCatalogEntry,
  stored: number,
): number {
  if (entry.display === 'percent_0_1') return Math.round(stored * 10000) / 100;
  return stored;
}

/** Convert UI display → DB stored value */
export function paramFromDisplay(
  entry: ParamCatalogEntry,
  display: number,
): number {
  if (entry.display === 'percent_0_1') return display / 100;
  return display;
}

export function unitSuffix(unit: ParamUnit): string {
  switch (unit) {
    case 'percent':
      return '%';
    case 'hours':
      return 'h';
    case 'days':
      return 'días';
    case 'factor':
      return '';
    default:
      return '';
  }
}

/** Controlled series format presets (no free-form dangerous tokens). */
export const SERIE_FORMAT_PRESETS = [
  {
    id: 'pref_year_seq',
    label: 'Prefijo - Año - Secuencia',
    formato: '{PREF}-{YYYY}-{SEQ}',
    example: (pref: string, pad: number) =>
      `${pref}-${new Date().getFullYear()}-${String(1).padStart(pad, '0')}`,
  },
  {
    id: 'pref_year_seq_compact',
    label: 'Prefijo + Año + Secuencia',
    formato: '{PREF}{YYYY}-{SEQ}',
    example: (pref: string, pad: number) =>
      `${pref}${new Date().getFullYear()}-${String(1).padStart(pad, '0')}`,
  },
  {
    id: 'pref_seq',
    label: 'Prefijo - Secuencia',
    formato: '{PREF}-{SEQ}',
    example: (pref: string, pad: number) =>
      `${pref}-${String(1).padStart(pad, '0')}`,
  },
] as const;

export function resolveSerieFormato(presetIdOrFormato: string): string {
  const preset = SERIE_FORMAT_PRESETS.find(
    (p) => p.id === presetIdOrFormato || p.formato === presetIdOrFormato,
  );
  if (preset) return preset.formato;
  // Only allow known tokens
  const allowed = /^(\{PREF\}|\{YYYY\}|\{YY\}|\{SEQ\}|[-_/.\s])+$/;
  if (!allowed.test(presetIdOrFormato)) {
    throw new Error('Formato de serie no permitido');
  }
  if (!presetIdOrFormato.includes('{SEQ}')) {
    throw new Error('El formato debe incluir la secuencia ({SEQ})');
  }
  return presetIdOrFormato;
}

export type ServicioPeriodicoIncluido = {
  nombre: string;
  periodicidad: string;
  descripcion?: string | null;
  orden?: number;
};

export type ContenidoComercial = {
  titulo_comercial?: string | null;
  descripcion_comercial?: string | null;
  operativa?: string[];
  /** Flat tareas (compat / simple services). */
  tareas?: string[];
  /** Split sections for combined services. */
  tareas_auxiliares?: string[];
  tareas_limpieza?: string[];
  /** Reusable block codes from v2_contenido_bloques. */
  bloques_refs?: string[];
  servicios_periodicos?: ServicioPeriodicoIncluido[];
  condiciones_especificas?: string[];
  imagen_ref?: string | null;
  periodicidad?: string | null;
  template_key?: string | null;
};

export function normalizeServiciosPeriodicos(
  raw: unknown,
): ServicioPeriodicoIncluido[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any, i: number) => ({
      nombre: String(row?.nombre || '').trim(),
      periodicidad: String(row?.periodicidad || '').trim(),
      descripcion:
        row?.descripcion != null ? String(row.descripcion).trim() : null,
      orden:
        row?.orden != null && Number.isFinite(Number(row.orden))
          ? Number(row.orden)
          : i,
    }))
    .filter((r) => r.nombre)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export function normalizeContenidoComercial(
  raw: unknown,
  fallbackNombre?: string,
): ContenidoComercial {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x || '').trim()).filter(Boolean)
      : typeof v === 'string' && v.trim()
        ? v
            .split(/\n+/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
  return {
    titulo_comercial:
      (o.titulo_comercial && String(o.titulo_comercial).trim()) ||
      fallbackNombre ||
      null,
    descripcion_comercial: o.descripcion_comercial
      ? String(o.descripcion_comercial)
      : null,
    operativa: arr(o.operativa),
    tareas: arr(o.tareas),
    tareas_auxiliares: arr(o.tareas_auxiliares),
    tareas_limpieza: arr(o.tareas_limpieza),
    bloques_refs: Array.isArray(o.bloques_refs)
      ? o.bloques_refs.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [],
    servicios_periodicos: normalizeServiciosPeriodicos(o.servicios_periodicos),
    condiciones_especificas: arr(o.condiciones_especificas),
    imagen_ref: o.imagen_ref ? String(o.imagen_ref) : null,
    periodicidad: o.periodicidad ? String(o.periodicidad) : null,
    template_key: o.template_key ? String(o.template_key) : null,
  };
}
