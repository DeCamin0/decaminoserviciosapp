/** Debe coincidir con frontend/src/constants/presupuestoLimpiezaOperativa.js y LIMPIEZA_* en presupuesto-documento.service.ts */

export const LIMPIEZA_OPERATIVA_IDS = {
  decamino: {
    diaria: [
      'limp_dcm_d_01',
      'limp_dcm_d_02',
      'limp_dcm_d_03',
      'limp_dcm_d_04',
      'limp_dcm_d_05',
      'limp_dcm_d_06',
    ],
    alterna: [
      'limp_dcm_a_01',
      'limp_dcm_a_02',
      'limp_dcm_a_03',
      'limp_dcm_a_04',
    ],
  },
  hera: {
    diaria: [
      'limp_her_d_01',
      'limp_her_d_02',
      'limp_her_d_03',
      'limp_her_d_04',
      'limp_her_d_05',
      'limp_her_d_06',
    ],
    alterna: [
      'limp_her_a_01',
      'limp_her_a_02',
      'limp_her_a_03',
      'limp_her_a_04',
    ],
  },
} as const;

export type PresupuestoLimpiezaOperativaPayload = {
  diariaIds?: string[];
  alternaIds?: string[];
};

export function filterLimpiezaOperativaLines(
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
