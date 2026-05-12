/**
 * Debe coincidir con frontend/src/constants/presupuestoGarajeOperativa.js
 * y GARAJE_DECAMINO / GARAJE_HERA en presupuesto-documento.service.ts
 */

import { filterCubosOperativaLines } from './presupuesto-cubos-operativa';

export type ModoGarajeOperativaFallback = 'fregadora' | 'karcher' | 'ambos';

export const GARAJE_OPERATIVA_IDS = {
  decamino: {
    tareas: ['gar_dcm_t_01', 'gar_dcm_t_02', 'gar_dcm_t_03', 'gar_dcm_t_04'],
  },
  hera: {
    tareas: ['gar_dcm_t_01', 'gar_dcm_t_02', 'gar_dcm_t_03', 'gar_dcm_t_04'],
  },
} as const;

export type PresupuestoGarajeOperativaPayload = {
  tareasIds?: string[];
};

/**
 * Con dos variantes de precio y ambas tareas de suelo marcadas, el PDF debe mostrar
 * en la opción 1 solo fregadora y en la opción 2 solo Karcher (resto de tareas igual).
 * Si no aplica, devuelve `tareasIds` sin cambios (o undefined si venía null/undefined).
 */
export function tareasIdsGarajeParaVariantePdf(
  tareasIds: string[] | undefined | null,
  catalogIds: readonly string[],
  variantIndex: number,
  numGarajeVariants: number,
): string[] | undefined {
  if (!Array.isArray(catalogIds) || catalogIds.length < 4 || variantIndex < 0) {
    return tareasIds ?? undefined;
  }
  const idF = catalogIds[2];
  const idK = catalogIds[3];
  const set = new Set(
    (tareasIds ?? []).filter((id) => catalogIds.includes(id)),
  );
  const hasF = set.has(idF);
  const hasK = set.has(idK);
  if (numGarajeVariants !== 2 || !hasF || !hasK) {
    return tareasIds ?? undefined;
  }
  const out = new Set(set);
  if (variantIndex === 0) out.delete(idK);
  else out.delete(idF);
  return Array.from(out);
}

export function tareasIdsFromModoGarajeFallback(
  modo: ModoGarajeOperativaFallback,
  catalogIds: readonly string[],
): string[] {
  const m = String(modo || 'fregadora')
    .toLowerCase()
    .trim();
  const base = [catalogIds[0], catalogIds[1]];
  if (m === 'ambos' || m === 'both') {
    return [...base, catalogIds[2], catalogIds[3]];
  }
  if (m === 'karcher') {
    return [...base, catalogIds[3]];
  }
  return [...base, catalogIds[2]];
}

/**
 * Filtra líneas del PDF garaje según tareasIds.
 * Si `selectedIds` es undefined/null (presupuesto antiguo sin bloque), usa `modoFallback` para no mostrar ambos suelos cuando solo había fregadora.
 */
export function filterGarajeOperativaLines(
  lines: readonly string[],
  selectedIds: string[] | undefined | null,
  catalogIds: readonly string[],
  modoFallback: ModoGarajeOperativaFallback = 'fregadora',
): string[] {
  if (!lines.length) return [];
  if (catalogIds.length !== lines.length) return [...lines];
  let ids = selectedIds;
  if (ids === undefined || ids === null) {
    ids = tareasIdsFromModoGarajeFallback(modoFallback, catalogIds);
  }
  return filterCubosOperativaLines(lines, ids, catalogIds);
}
