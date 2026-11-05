/** Category order for «Todos los módulos» */
export const MODULE_CATEGORY_ORDER = [
  'personal',
  'equipo',
  'operacion',
  'admin',
  'otros',
];

export const MODULE_CATEGORY_LABELS = {
  personal: 'Personal',
  equipo: 'Equipo',
  operacion: 'Operación',
  admin: 'Administración',
  otros: 'Otros',
};

const CATEGORY_BY_ID = {
  'datos-personales': 'personal',
  fichar: 'personal',
  solicitudes: 'personal',
  documentos: 'personal',
  'mi-horario': 'personal',
  'mis-inspecciones': 'personal',
  'mis-tareas': 'personal',
  comunicados: 'personal',
  'hall-of-fame': 'personal',
  'gestionar-empleados': 'equipo',
  'documentos-empleados': 'equipo',
  cuadrantes: 'equipo',
  aprobaciones: 'equipo',
  tareas: 'equipo',
  'fotos-trabajo': 'equipo',
  inspecciones: 'operacion',
  pedidos: 'operacion',
  clientes: 'operacion',
  'servicios-periodicos': 'operacion',
  'prl-documentos': 'operacion',
  'presupuestos-informes': 'operacion',
  'presupuestos-v2': 'operacion',
  'admin-panel': 'admin',
  'mensajes-enviados': 'admin',
  estadisticas: 'admin',
};

/**
 * @param {Array<{ id: string }>} items
 * @returns {Record<string, typeof items>}
 */
export function groupQuickAccessByCategory(items) {
  const groups = {};
  for (const cat of MODULE_CATEGORY_ORDER) groups[cat] = [];
  for (const item of items || []) {
    const cat = CATEGORY_BY_ID[item.id] || 'otros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

/** Prefer items with badges, then personal essentials — max 6 for «Accesos frecuentes» */
export const FREQUENT_PRIORITY = [
  'fichar',
  'mi-horario',
  'solicitudes',
  'aprobaciones',
  'documentos',
  'mis-tareas',
  'comunicados',
  'cuadrantes',
  'gestionar-empleados',
  'inspecciones',
  'pedidos',
  'datos-personales',
];

/**
 * Top modules for Accesos frecuentes.
 * 1) rankedIds from local visit history (already permission-filtered via `items`)
 * 2) badges
 * 3) FREQUENT_PRIORITY defaults
 * 4) remaining authorized items
 *
 * @param {Array<{ id: string, notificationCount?: number }>} items authorized modules only
 * @param {number} [limit=6]
 * @param {string[]} [rankedIds=[]] most-visited module ids (30d)
 */
export function pickFrequentAccess(items, limit = 6, rankedIds = []) {
  if (!items?.length) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const picked = [];
  const seen = new Set();

  const pushId = (id) => {
    if (picked.length >= limit || seen.has(id)) return;
    const item = byId.get(id);
    if (!item) return;
    picked.push(item);
    seen.add(id);
  };

  for (const id of rankedIds || []) pushId(id);

  const withBadge = items
    .filter((i) => Number(i.notificationCount) > 0)
    .sort((a, b) => (b.notificationCount || 0) - (a.notificationCount || 0));
  for (const item of withBadge) pushId(item.id);

  for (const id of FREQUENT_PRIORITY) pushId(id);

  for (const item of items) pushId(item.id);

  return picked;
}
