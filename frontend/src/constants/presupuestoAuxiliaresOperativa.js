/**
 * Textos y ids para «Funciones principales» y «Apoyo al mantenimiento» del PDF de Auxiliares.
 * Deben coincidir en orden y número con AUXILIARES_DECAMINO / AUXILIARES_HERA en presupuesto-documento.service.ts
 */

const decamino = {
  funciones: [
    { id: 'aux_dcm_fn_01', text: 'Control de accesos y supervisión de personas ajenas a la finca.' },
    { id: 'aux_dcm_fn_02', text: 'Supervisión y seguimiento de trabajos realizados por proveedores.' },
    { id: 'aux_dcm_fn_03', text: 'Atención y asistencia a residentes que requieran su presencia.' },
    { id: 'aux_dcm_fn_04', text: 'Realización de rondas preventivas en diferentes horarios.' },
    { id: 'aux_dcm_fn_05', text: 'Comunicación inmediata de desperfectos o averías a la administración.' },
    { id: 'aux_dcm_fn_06', text: 'Aviso a servicios técnicos o de emergencia cuando sea necesario.' },
    { id: 'aux_dcm_fn_07', text: 'Apoyo en situaciones de molestias o incidencias vecinales.' },
    { id: 'aux_dcm_fn_08', text: 'Supervisión básica de instalaciones comunes (garajes, zonas comunes, sistemas comunitarios).' },
  ],
  apoyo: [
    { id: 'aux_dcm_ap_01', text: 'Sustitución de bombillas y luminarias (material a cargo de la comunidad).' },
    { id: 'aux_dcm_ap_02', text: 'Revisión y limpieza básica de rejillas de desagüe obstruidas.' },
    { id: 'aux_dcm_ap_03', text: 'Conocimiento de la ubicación de llaves de corte de agua, luz y gas para casos de emergencia.' },
    { id: 'aux_dcm_ap_04', text: 'Información periódica a la Junta de Gobierno sobre incidencias y estado general de la finca.' },
  ],
};

const hera = {
  funciones: [
    { id: 'aux_her_fn_01', text: 'Control y registro de accesos a la comunidad.' },
    { id: 'aux_her_fn_02', text: 'Supervisión de entradas y salidas de personal externo.' },
    { id: 'aux_her_fn_03', text: 'Apoyo y atención a vecinos ante incidencias cotidianas.' },
    { id: 'aux_her_fn_04', text: 'Realización de rondas periódicas para detectar posibles anomalías.' },
    { id: 'aux_her_fn_05', text: 'Seguimiento de trabajos realizados por empresas externas.' },
    { id: 'aux_her_fn_06', text: 'Comunicación de incidencias, averías o desperfectos a la administración.' },
    { id: 'aux_her_fn_07', text: 'Gestión de avisos a servicios técnicos cuando sea necesario.' },
    { id: 'aux_her_fn_08', text: 'Intervención básica ante conflictos o molestias entre residentes.' },
    { id: 'aux_her_fn_09', text: 'Vigilancia general del estado de zonas comunes e instalaciones.' },
  ],
  apoyo: [
    { id: 'aux_her_ap_01', text: 'Sustitución de elementos básicos de iluminación en zonas comunes.' },
    { id: 'aux_her_ap_02', text: 'Limpieza y revisión de puntos críticos como desagües o accesos.' },
    { id: 'aux_her_ap_03', text: 'Conocimiento operativo de instalaciones para actuar en emergencias.' },
    { id: 'aux_her_ap_04', text: 'Colaboración en el control del correcto funcionamiento de servicios comunitarios.' },
    { id: 'aux_her_ap_05', text: 'Reporte periódico del estado general del edificio a la administración.' },
  ],
};

export function getAuxiliaresOperativaCatalog(isHera) {
  return isHera ? hera : decamino;
}

export function getDefaultAuxiliaresOperativaSelection(isHera) {
  const c = getAuxiliaresOperativaCatalog(isHera);
  return {
    funcionesIds: c.funciones.map((x) => x.id),
    apoyoIds: c.apoyo.map((x) => x.id),
  };
}

/**
 * Fusiona lo guardado en payload con los ids válidos del tenant actual.
 * Si no hay selección guardada o no queda ningún id válido → todo seleccionado (comportamiento legacy).
 */
export function mergeAuxiliaresOperativaFromPayload(raw, isHera) {
  const c = getAuxiliaresOperativaCatalog(isHera);
  const def = getDefaultAuxiliaresOperativaSelection(isHera);
  if (!raw || typeof raw !== 'object') return def;

  const validFn = new Set(c.funciones.map((x) => x.id));
  const validAp = new Set(c.apoyo.map((x) => x.id));

  const pick = (arr, validSet, fallbackIds) => {
    if (!Array.isArray(arr)) return fallbackIds;
    if (arr.length === 0) return [];
    const filtered = arr.filter((id) => typeof id === 'string' && validSet.has(id));
    return filtered.length > 0 ? filtered : fallbackIds;
  };

  return {
    funcionesIds: pick(raw.funcionesIds, validFn, def.funcionesIds),
    apoyoIds: pick(raw.apoyoIds, validAp, def.apoyoIds),
  };
}
