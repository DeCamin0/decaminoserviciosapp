/** Debe coincidir con frontend/src/constants/presupuestoJardineriaOperativa.js y JARDINERIA_* en presupuesto-documento.service.ts */

export const JARDINERIA_OPERATIVA_IDS = {
  decamino: {
    trabajos: [
      'jar_dcm_tr_01',
      'jar_dcm_tr_02',
      'jar_dcm_tr_03',
      'jar_dcm_tr_04',
      'jar_dcm_tr_05',
      'jar_dcm_tr_06',
    ],
    tratamientos: ['jar_dcm_tt_01', 'jar_dcm_tt_02', 'jar_dcm_tt_03'],
  },
  hera: {
    trabajos: [
      'jar_her_tr_01',
      'jar_her_tr_02',
      'jar_her_tr_03',
      'jar_her_tr_04',
      'jar_her_tr_05',
      'jar_her_tr_06',
    ],
    tratamientos: ['jar_her_tt_01', 'jar_her_tt_02', 'jar_her_tt_03', 'jar_her_tt_04'],
  },
} as const;

export type PresupuestoJardineriaOperativaPayload = {
  trabajosIds?: string[];
  tratamientosIds?: string[];
};

export function filterJardineriaOperativaLines(
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
