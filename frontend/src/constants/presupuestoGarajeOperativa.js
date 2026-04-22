/**
 * «Tareas operativas» del PDF Limpieza de garajes (orden = GARAJE_DECAMINO en backend).
 * Mismos textos HERA (copia literal del bloque garaje).
 */

const decamino = {
  tareas: [
    { id: 'gar_dcm_t_01', text: 'Desempolvado de paredes' },
    {
      id: 'gar_dcm_t_02',
      text: 'Limpieza de tuberías, puntos de luz, extintores, elementos decorativos',
    },
    {
      id: 'gar_dcm_t_03',
      text: 'Limpieza del suelo con máquina de hombre sentado',
    },
    { id: 'gar_dcm_t_04', text: 'Limpieza del suelo con Karcher' },
  ],
};

/** HERA reutiliza los mismos textos operativos de garaje. */
const hera = { tareas: decamino.tareas.map((t) => ({ ...t })) };

export function getGarajeOperativaCatalog(isHera) {
  return isHera ? hera : decamino;
}

/** IDs de suelo (índices 2 y 3) para derivar modoGaraje en payload/oferta. */
export function garajeOperativaIdsSuelo(catalog) {
  const t = catalog.tareas;
  return { idFregadora: t[2].id, idKarcher: t[3].id };
}

export function modoGarajeDesdeTareasIds(tareasIds, isHera) {
  const c = getGarajeOperativaCatalog(isHera);
  const { idFregadora, idKarcher } = garajeOperativaIdsSuelo(c);
  const set = new Set(Array.isArray(tareasIds) ? tareasIds : []);
  const hasF = set.has(idFregadora);
  const hasK = set.has(idKarcher);
  if (hasF && hasK) return 'ambos';
  if (hasK) return 'karcher';
  return 'fregadora';
}

function tareasIdsDesdeModoGaraje(modo, catalog) {
  const m = String(modo || 'fregadora').toLowerCase().trim();
  const t = catalog.tareas;
  const base = [t[0].id, t[1].id];
  if (m === 'ambos' || m === 'both') return [...base, t[2].id, t[3].id];
  if (m === 'karcher') return [...base, t[3].id];
  return [...base, t[2].id];
}

export function getDefaultGarajeOperativaSelection(isHera) {
  const c = getGarajeOperativaCatalog(isHera);
  return { tareasIds: tareasIdsDesdeModoGaraje('fregadora', c) };
}

/**
 * @param {object|null|undefined} raw
 * @param {boolean} isHera
 * @param {string} [modoFallback] fregadora | karcher | ambos — si no hay payload guardado
 */
export function mergeGarajeOperativaFromPayload(raw, isHera, modoFallback = 'fregadora') {
  const c = getGarajeOperativaCatalog(isHera);
  const def = { tareasIds: tareasIdsDesdeModoGaraje(modoFallback, c) };
  if (!raw || typeof raw !== 'object') return def;

  const valid = new Set(c.tareas.map((x) => x.id));
  const arr = raw.tareasIds;
  if (!Array.isArray(arr)) return def;
  if (arr.length === 0) return { tareasIds: [...def.tareasIds] };
  const filtered = arr.filter((id) => typeof id === 'string' && valid.has(id));
  return {
    tareasIds: filtered.length > 0 ? filtered : def.tareasIds,
  };
}
