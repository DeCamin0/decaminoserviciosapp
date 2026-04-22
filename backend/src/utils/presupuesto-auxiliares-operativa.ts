/** Debe coincidir con frontend/src/constants/presupuestoAuxiliaresOperativa.js y con el orden de AUXILIARES_* en presupuesto-documento.service.ts */

export const AUXILIARES_OPERATIVA_IDS = {
  decamino: {
    funciones: [
      'aux_dcm_fn_01',
      'aux_dcm_fn_02',
      'aux_dcm_fn_03',
      'aux_dcm_fn_04',
      'aux_dcm_fn_05',
      'aux_dcm_fn_06',
      'aux_dcm_fn_07',
      'aux_dcm_fn_08',
    ],
    apoyo: ['aux_dcm_ap_01', 'aux_dcm_ap_02', 'aux_dcm_ap_03', 'aux_dcm_ap_04'],
  },
  hera: {
    funciones: [
      'aux_her_fn_01',
      'aux_her_fn_02',
      'aux_her_fn_03',
      'aux_her_fn_04',
      'aux_her_fn_05',
      'aux_her_fn_06',
      'aux_her_fn_07',
      'aux_her_fn_08',
      'aux_her_fn_09',
    ],
    apoyo: [
      'aux_her_ap_01',
      'aux_her_ap_02',
      'aux_her_ap_03',
      'aux_her_ap_04',
      'aux_her_ap_05',
    ],
  },
} as const;

export type PresupuestoAuxiliaresOperativaPayload = {
  funcionesIds?: string[];
  apoyoIds?: string[];
};

/**
 * undefined/null en selectedIds → mostrar todas las líneas (presupuestos antiguos).
 * [] → ninguna línea.
 * Si tras filtrar no queda ninguna pero había ids enviados (ids corruptos) → todas.
 */
export function filterAuxiliaresOperativaLines(
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
