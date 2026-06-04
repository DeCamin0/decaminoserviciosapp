/**
 * «Tareas incluidas» del PDF Gestión cubos de basura.
 * Orden = CUBOS_DECAMINO / CUBOS_HERA en presupuesto-documento.service.ts
 */

const decamino = {
  tareas: [
    { id: 'cub_dcm_t_01', text: 'Salida de cubos en horario permitido' },
    { id: 'cub_dcm_t_02', text: 'Entrada de cubos tras la recogida municipal' },
    { id: 'cub_dcm_t_03', text: 'Colocación correcta en la zona asignada' },
    { id: 'cub_dcm_t_04', text: 'Cierre de tapas y ordenación del área de residuos' },
    { id: 'cub_dcm_t_05', text: 'Limpieza básica del entorno inmediato' },
    { id: 'cub_dcm_t_06', text: 'Aviso de incidencias (roturas, suciedad excesiva, vandalismo)' },
  ],
};

const hera = {
  tareas: [
    { id: 'cub_her_t_01', text: 'Colocación de los contenedores en la vía pública dentro del horario autorizado' },
    { id: 'cub_her_t_02', text: 'Retirada de los cubos una vez realizada la recogida municipal' },
    { id: 'cub_her_t_03', text: 'Ubicación correcta en la zona designada por la comunidad' },
    { id: 'cub_her_t_04', text: 'Verificación del cierre de tapas y orden general del área' },
    { id: 'cub_her_t_05', text: 'Mantenimiento básico de limpieza en la zona de residuos' },
    { id: 'cub_her_t_06', text: 'Comunicación de incidencias como daños, suciedad o uso indebido' },
  ],
};

export function getCubosOperativaCatalog(isHera) {
  return isHera ? hera : decamino;
}

const HORARIO_DIAS_SEMANA_EMPTY = {
  lun: false,
  mar: false,
  mie: false,
  jue: false,
  vie: false,
  sab: false,
  dom: false,
};

function normalizeHorarioDiasSemanaCubos(d) {
  const base = { ...HORARIO_DIAS_SEMANA_EMPTY };
  if (!d || typeof d !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (Object.prototype.hasOwnProperty.call(d, k)) base[k] = !!d[k];
  }
  return base;
}

function normalizeHorarioDiasTipoCubos(v) {
  const u = String(v || 'LV').trim().toUpperCase();
  if (u === 'SD' || u === 'LD' || u === 'PERS') return u;
  return 'LV';
}

/** @returns {boolean|undefined} */
function normalizeFestivosIncluidosCubos(v) {
  if (v === false || v === 'false') return false;
  if (v === true || v === 'true') return true;
  return undefined;
}

function festivosIncluidosFromPayload(raw, def) {
  if (!raw || typeof raw !== 'object') return def.festivosIncluidos;
  if (!Object.prototype.hasOwnProperty.call(raw, 'festivosIncluidos')) return undefined;
  const n = normalizeFestivosIncluidosCubos(raw.festivosIncluidos);
  return n === undefined ? def.festivosIncluidos : n;
}

export function getDefaultCubosOperativaSelection(isHera) {
  const c = getCubosOperativaCatalog(isHera);
  return {
    tareasIds: c.tareas.map((x) => x.id),
    horarioDiasTipo: 'LV',
    horarioDiasSemana: { ...HORARIO_DIAS_SEMANA_EMPTY },
    festivosIncluidos: true,
  };
}

export function mergeCubosOperativaFromPayload(raw, isHera) {
  const c = getCubosOperativaCatalog(isHera);
  const def = getDefaultCubosOperativaSelection(isHera);
  const horarioDiasTipo = normalizeHorarioDiasTipoCubos(raw?.horarioDiasTipo);
  const horarioDiasSemana = normalizeHorarioDiasSemanaCubos(raw?.horarioDiasSemana);
  const festivosIncluidos = festivosIncluidosFromPayload(raw, def);

  if (!raw || typeof raw !== 'object') {
    return { ...def, horarioDiasTipo, horarioDiasSemana, festivosIncluidos };
  }

  const valid = new Set(c.tareas.map((x) => x.id));
  const arr = raw.tareasIds;
  if (!Array.isArray(arr)) {
    return { ...def, horarioDiasTipo, horarioDiasSemana, festivosIncluidos };
  }
  if (arr.length === 0) {
    return { tareasIds: [], horarioDiasTipo, horarioDiasSemana, festivosIncluidos };
  }
  const filtered = arr.filter((id) => typeof id === 'string' && valid.has(id));
  return {
    tareasIds: filtered.length > 0 ? filtered : def.tareasIds,
    horarioDiasTipo,
    horarioDiasSemana,
    festivosIncluidos,
  };
}

const CUBOS_HORARIO_DIAS_FILA_LABELS = [
  { key: 'lun', label: 'Lun' },
  { key: 'mar', label: 'Mar' },
  { key: 'mie', label: 'Mié' },
  { key: 'jue', label: 'Jue' },
  { key: 'vie', label: 'Vie' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

/**
 * Texto legible del bloque «Días (horario aplicable)» para oferta económica / PDF.
 * @param {object|null|undefined} raw — presupuestoCubosOperativa o fragmento con horarioDiasTipo / horarioDiasSemana
 */
function sufijoFestivosHorarioCubos(raw) {
  if (raw?.festivosIncluidos === false) return ', sin festivos';
  if (raw?.festivosIncluidos === true) return ', festivos incluidos';
  return '';
}

export function textoHorarioAplicableCubosOperativa(raw) {
  const tipo = normalizeHorarioDiasTipoCubos(raw?.horarioDiasTipo);
  const suf = sufijoFestivosHorarioCubos(raw);
  if (tipo === 'LV') return `Lunes a viernes (L-V)${suf}`;
  if (tipo === 'SD') return `Sábado a domingo (S-D)${suf}`;
  if (tipo === 'LD') return `Lunes a domingo (L-D)${suf}`;
  const ds = normalizeHorarioDiasSemanaCubos(raw?.horarioDiasSemana);
  const labels = CUBOS_HORARIO_DIAS_FILA_LABELS.filter((r) => ds[r.key]).map((r) => r.label);
  if (labels.length === 0) return `Horario personalizado${suf}`;
  return `Personalizada (${labels.join(', ')})${suf}`;
}
