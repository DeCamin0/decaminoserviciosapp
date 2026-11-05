/**
 * Map pathname → nav module id (same ids as buildNavItems).
 * Query/tabs are ignored — only pathname is used by the caller.
 */

const EXACT = {
  '/datos': 'datos-personales',
  '/fichaje': 'fichar',
  '/solicitudes': 'solicitudes',
  '/documentos': 'documentos',
  '/cuadrantes-empleado': 'mi-horario',
  '/mis-inspecciones': 'mis-inspecciones',
  '/mis-tareas': 'mis-tareas',
  '/comunicados': 'comunicados',
  '/empleados': 'gestionar-empleados',
  '/documentos-empleados': 'documentos-empleados',
  '/prl-documentos': 'prl-documentos',
  '/cuadrantes': 'cuadrantes',
  '/aprobaciones': 'aprobaciones',
  '/inspecciones': 'inspecciones',
  '/tareas': 'tareas',
  '/fotos-trabajo': 'fotos-trabajo',
  '/pedidos': 'pedidos',
  '/empleado-pedidos': 'pedidos',
  '/admin': 'admin-panel',
  '/mensajes-enviados': 'mensajes-enviados',
  '/estadisticas': 'estadisticas',
  '/estadisticas-cuadrantes': 'estadisticas',
  '/estadisticas-empleados': 'estadisticas',
  '/estadisticas-fichajes': 'estadisticas',
  '/clientes': 'clientes',
  '/presupuestos-informes': 'presupuestos-informes',
  '/presupuestos-v2': 'presupuestos-v2',
  '/servicios-periodicos': 'servicios-periodicos',
  '/hall-of-fame': 'hall-of-fame',
};

/**
 * @param {string} pathname
 * @returns {string|null} moduleId or null if not a trackable module
 */
export function pathToModuleId(pathname) {
  if (!pathname || typeof pathname !== 'string') return null;
  let path = pathname.split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  if (EXACT[path]) return EXACT[path];

  // Nested routes that belong to a module (not tabs — path segments)
  if (path.startsWith('/clientes/')) return 'clientes';
  if (path.startsWith('/comunicados/')) return 'comunicados';
  if (path.startsWith('/admin/')) return 'admin-panel';

  return null;
}
