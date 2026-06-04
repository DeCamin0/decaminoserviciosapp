/** Debe coincidir con frontend/src/constants/presupuestoCubosOperativa.js y CUBOS_* en presupuesto-documento.service.ts */

export const CUBOS_OPERATIVA_IDS = {
  decamino: {
    tareas: [
      'cub_dcm_t_01',
      'cub_dcm_t_02',
      'cub_dcm_t_03',
      'cub_dcm_t_04',
      'cub_dcm_t_05',
      'cub_dcm_t_06',
    ],
  },
  hera: {
    tareas: [
      'cub_her_t_01',
      'cub_her_t_02',
      'cub_her_t_03',
      'cub_her_t_04',
      'cub_her_t_05',
      'cub_her_t_06',
    ],
  },
} as const;

export type PresupuestoCubosOperativaPayload = {
  tareasIds?: string[];
  /** LV | SD | LD | PERS — mismo criterio que horario piscina (solo formulario / payload). */
  horarioDiasTipo?: string;
  horarioDiasSemana?: Record<string, boolean>;
  /** true = festivos incluidos en el horario aplicable; false = explícitamente sin festivos. */
  festivosIncluidos?: boolean;
};

const CUBOS_HORARIO_DIA_ORDER = [
  'lun',
  'mar',
  'mie',
  'jue',
  'vie',
  'sab',
  'dom',
] as const;

const CUBOS_HORARIO_DIA_LABEL: Record<
  (typeof CUBOS_HORARIO_DIA_ORDER)[number],
  string
> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
};

function normalizeHorarioDiasTipoCubosPayload(v: unknown): string {
  const u = String(v || 'LV')
    .trim()
    .toUpperCase();
  if (u === 'SD' || u === 'LD' || u === 'PERS') return u;
  return 'LV';
}

function sufijoFestivosHorarioCubos(
  raw: PresupuestoCubosOperativaPayload | null | undefined,
): string {
  if (raw?.festivosIncluidos === false) return ', sin festivos';
  if (raw?.festivosIncluidos === true) return ', festivos incluidos';
  return '';
}

/** Misma leyenda que el desplegable del frontend (oferta económica / PDF si se reconstruye la oferta). */
export function textoHorarioAplicableCubosOferta(
  raw: PresupuestoCubosOperativaPayload | null | undefined,
): string {
  const tipo = normalizeHorarioDiasTipoCubosPayload(raw?.horarioDiasTipo);
  const suf = sufijoFestivosHorarioCubos(raw);
  if (tipo === 'LV') return `Lunes a viernes (L-V)${suf}`;
  if (tipo === 'SD') return `Sábado a domingo (S-D)${suf}`;
  if (tipo === 'LD') return `Lunes a domingo (L-D)${suf}`;
  const ds = raw?.horarioDiasSemana;
  const labels: string[] = [];
  for (const k of CUBOS_HORARIO_DIA_ORDER) {
    if (ds && ds[k]) labels.push(CUBOS_HORARIO_DIA_LABEL[k]);
  }
  if (labels.length === 0) return `Horario personalizado${suf}`;
  return `Personalizada (${labels.join(', ')})${suf}`;
}

export function filterCubosOperativaLines(
  lines: readonly string[],
  selectedIds: string[] | undefined | null,
  catalogIds: readonly string[],
): string[] {
  if (!lines.length) return [];
  if (catalogIds.length !== lines.length) return [...lines];
  if (selectedIds === undefined || selectedIds === null) return [...lines];
  if (selectedIds.length === 0) return [];
  const set = new Set(selectedIds);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (set.has(catalogIds[i])) out.push(lines[i]);
  }
  if (out.length === 0 && selectedIds.length > 0) return [...lines];
  return out;
}
