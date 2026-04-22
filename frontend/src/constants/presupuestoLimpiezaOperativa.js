/**
 * Tareas habituales del PDF Limpieza (Frecuencia diaria + alterna/periódica).
 * Orden y textos = LIMPIEZA_DECAMINO / LIMPIEZA_HERA en presupuesto-documento.service.ts
 */

const decamino = {
  diaria: [
    { id: 'limp_dcm_d_01', text: 'Barrido y fregado de suelos' },
    { id: 'limp_dcm_d_02', text: 'Limpieza de escaleras interiores' },
    { id: 'limp_dcm_d_03', text: 'Limpieza de ascensor' },
    { id: 'limp_dcm_d_04', text: 'Limpieza de huellas en barandillas, buzones e interruptores' },
    { id: 'limp_dcm_d_05', text: 'Limpieza de cristales de acceso' },
    { id: 'limp_dcm_d_06', text: 'Vaciado de publicidad' },
  ],
  alterna: [
    { id: 'limp_dcm_a_01', text: 'Limpieza de puerta de acceso' },
    { id: 'limp_dcm_a_02', text: 'Desempolvado de puntos de luz' },
    { id: 'limp_dcm_a_03', text: 'Limpieza de elementos decorativos' },
    { id: 'limp_dcm_a_04', text: 'Limpieza de patios' },
  ],
};

const hera = {
  diaria: [
    { id: 'limp_her_d_01', text: 'Limpieza y fregado de suelos en zonas comunes' },
    { id: 'limp_her_d_02', text: 'Limpieza de escaleras y rellanos' },
    { id: 'limp_her_d_03', text: 'Mantenimiento de limpieza en ascensores' },
    { id: 'limp_her_d_04', text: 'Eliminación de huellas en superficies de contacto (barandillas, interruptores, buzones)' },
    { id: 'limp_her_d_05', text: 'Limpieza de accesos y zonas de entrada' },
    { id: 'limp_her_d_06', text: 'Retirada de publicidad y residuos en buzones' },
  ],
  alterna: [
    { id: 'limp_her_a_01', text: 'Limpieza de puertas de acceso y elementos exteriores' },
    { id: 'limp_her_a_02', text: 'Desempolvado de luminarias y puntos de luz' },
    { id: 'limp_her_a_03', text: 'Limpieza de elementos decorativos y mobiliario común' },
    { id: 'limp_her_a_04', text: 'Mantenimiento de patios interiores o zonas abiertas' },
  ],
};

export function getLimpiezaOperativaCatalog(isHera) {
  return isHera ? hera : decamino;
}

export function getDefaultLimpiezaOperativaSelection(isHera) {
  const c = getLimpiezaOperativaCatalog(isHera);
  return {
    diariaIds: c.diaria.map((x) => x.id),
    alternaIds: c.alterna.map((x) => x.id),
  };
}

export function mergeLimpiezaOperativaFromPayload(raw, isHera) {
  const c = getLimpiezaOperativaCatalog(isHera);
  const def = getDefaultLimpiezaOperativaSelection(isHera);
  if (!raw || typeof raw !== 'object') return def;

  const validD = new Set(c.diaria.map((x) => x.id));
  const validA = new Set(c.alterna.map((x) => x.id));

  const pick = (arr, validSet, fallbackIds) => {
    if (!Array.isArray(arr)) return fallbackIds;
    if (arr.length === 0) return [];
    const filtered = arr.filter((id) => typeof id === 'string' && validSet.has(id));
    return filtered.length > 0 ? filtered : fallbackIds;
  };

  return {
    diariaIds: pick(raw.diariaIds, validD, def.diariaIds),
    alternaIds: pick(raw.alternaIds, validA, def.alternaIds),
  };
}
