/**
 * Trabajos de mantenimiento + Tratamientos y conservación del PDF Jardinería.
 * Orden = JARDINERIA_DECAMINO / JARDINERIA_HERA en presupuesto-documento.service.ts
 */

const decamino = {
  trabajos: [
    { id: 'jar_dcm_tr_01', text: 'Eliminación de malas hierbas mediante medios manuales o mecánicos según superficie' },
    { id: 'jar_dcm_tr_02', text: 'Recorte y perfilado de zonas verdes' },
    { id: 'jar_dcm_tr_03', text: 'Limpieza de hojas y restos vegetales' },
    { id: 'jar_dcm_tr_04', text: 'Retirada de brotes no deseados (chupones)' },
    { id: 'jar_dcm_tr_05', text: 'Control y revisión del sistema de riego' },
    { id: 'jar_dcm_tr_06', text: 'Aviso de averías y posibilidad de reparación (materiales no incluidos)' },
  ],
  tratamientos: [
    { id: 'jar_dcm_tt_01', text: 'Dos tratamientos fitosanitarios preventivos anuales con productos homologados (incluidos)' },
    { id: 'jar_dcm_tt_02', text: 'Abonado orgánico anual incluido' },
    { id: 'jar_dcm_tt_03', text: 'Poda anual de arbolado hasta 3 metros de altura' },
  ],
};

const hera = {
  trabajos: [
    { id: 'jar_her_tr_01', text: 'Eliminación de malas hierbas mediante técnicas manuales o mecánicas según las necesidades' },
    { id: 'jar_her_tr_02', text: 'Recorte y perfilado de césped y zonas ajardinadas' },
    { id: 'jar_her_tr_03', text: 'Limpieza general de hojas, ramas y residuos vegetales' },
    { id: 'jar_her_tr_04', text: 'Eliminación de brotes no deseados en árboles y arbustos' },
    { id: 'jar_her_tr_05', text: 'Revisión periódica del sistema de riego' },
    { id: 'jar_her_tr_06', text: 'Detección y comunicación de averías, con opción de reparación (materiales no incluidos)' },
  ],
  tratamientos: [
    { id: 'jar_her_tt_01', text: 'Aplicación de tratamientos fitosanitarios preventivos anuales con productos autorizados' },
    { id: 'jar_her_tt_02', text: 'Abonado orgánico para mejorar la salud del suelo y las plantas' },
    { id: 'jar_her_tt_03', text: 'Poda anual de árboles y arbustos hasta una altura máxima de 3 metros' },
    { id: 'jar_her_tt_04', text: 'Seguimiento del estado general de la vegetación' },
  ],
};

export function getJardineriaOperativaCatalog(isHera) {
  return isHera ? hera : decamino;
}

export function getDefaultJardineriaOperativaSelection(isHera) {
  const c = getJardineriaOperativaCatalog(isHera);
  return {
    trabajosIds: c.trabajos.map((x) => x.id),
    tratamientosIds: c.tratamientos.map((x) => x.id),
  };
}

export function mergeJardineriaOperativaFromPayload(raw, isHera) {
  const c = getJardineriaOperativaCatalog(isHera);
  const def = getDefaultJardineriaOperativaSelection(isHera);
  if (!raw || typeof raw !== 'object') return def;

  const validT = new Set(c.trabajos.map((x) => x.id));
  const validTr = new Set(c.tratamientos.map((x) => x.id));

  const pick = (arr, validSet, fallbackIds) => {
    if (!Array.isArray(arr)) return fallbackIds;
    if (arr.length === 0) return [];
    const filtered = arr.filter((id) => typeof id === 'string' && validSet.has(id));
    return filtered.length > 0 ? filtered : fallbackIds;
  };

  return {
    trabajosIds: pick(raw.trabajosIds, validT, def.trabajosIds),
    tratamientosIds: pick(raw.tratamientosIds, validTr, def.tratamientosIds),
  };
}
