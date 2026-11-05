/**
 * Deep-link children (tabs / sections) for desktop sidebar.
 * Only params already used or introduced as ?tab= / ?vista= on the same routes.
 * Filter with `when(ctx)` using the same permission flags as buildNavItems.
 */

/**
 * @typedef {{
 *   shouldUseBackend: boolean,
 *   hasBackendPermissions: boolean,
 *   hasPermission: (m: string) => boolean,
 *   isManager: boolean,
 *   isAdmin: boolean,
 *   isDeveloper: boolean,
 *   canAccessAllSolicitudesTabs?: boolean,
 *   isPedidosAdmin?: boolean,
 * }} NavChildrenCtx
 */

/**
 * @param {NavChildrenCtx} ctx
 * @returns {Record<string, Array<{ id: string, label: string, href: string }>>}
 */
export function getNavChildrenByModuleId(ctx) {
  const hp = ctx.hasPermission;
  const canSolicitudesAdmin =
    ctx.shouldUseBackend
      ? hp('solicitudes-admin') || hp('solicitudes')
      : ctx.isManager || ctx.isAdmin || ctx.isDeveloper;

  const canManageEmployees = ctx.shouldUseBackend ? hp('empleados') : ctx.isManager;

  const children = {
    solicitudes: [
      { id: 'solicitudes-lista', label: 'Mis solicitudes', href: '/solicitudes?vista=lista' },
      { id: 'solicitudes-nueva', label: 'Nueva solicitud', href: '/solicitudes?vista=nueva' },
      ...(canSolicitudesAdmin
        ? [
            { id: 'solicitudes-todas', label: 'Todas', href: '/solicitudes?vista=todas' },
            {
              id: 'solicitudes-estadisticas',
              label: 'Estadísticas',
              href: '/solicitudes?vista=estadisticas',
            },
          ]
        : []),
    ],
    aprobaciones: [
      { id: 'aprobaciones-cambios', label: 'Cambios de datos', href: '/aprobaciones?tab=cambios' },
      {
        id: 'aprobaciones-reg',
        label: 'Regularizaciones',
        href: '/aprobaciones?tab=regularizaciones',
      },
      { id: 'aprobaciones-rm', label: 'Registro de jornada', href: '/aprobaciones?tab=rm' },
    ],
    'gestionar-empleados': [
      ...(canManageEmployees
        ? [{ id: 'empleados-lista', label: 'Lista de empleados', href: '/empleados?tab=lista' }]
        : []),
      { id: 'empleados-adauga', label: 'Añadir empleado', href: '/empleados?tab=adauga' },
      ...(canManageEmployees
        ? [
            {
              id: 'empleados-nombres',
              label: 'Corregir nombres',
              href: '/empleados?tab=corregir-nombres',
            },
            {
              id: 'empleados-stats',
              label: 'Estadísticas',
              href: '/empleados?tab=estadisticas',
            },
          ]
        : []),
    ],
    'documentos-empleados': [
      { id: 'docemp-empleados', label: 'Empleados', href: '/documentos-empleados?tab=empleados' },
      {
        id: 'docemp-gestoria',
        label: 'Gestoría Nóminas',
        href: '/documentos-empleados?tab=gestoria-nominas',
      },
      {
        id: 'docemp-coste',
        label: 'Coste Personal',
        href: '/documentos-empleados?tab=coste-personal',
      },
      { id: 'docemp-diplomas', label: 'Diplomas', href: '/documentos-empleados?tab=diplomas' },
      {
        id: 'docemp-cert',
        label: 'Certificados retenciones',
        href: '/documentos-empleados?tab=certificados-retenciones',
      },
    ],
    cuadrantes: [
      { id: 'cuad-generar', label: 'Generar', href: '/cuadrantes?tab=generar' },
      { id: 'cuad-lista', label: 'Lista Cuadrantes', href: '/cuadrantes?tab=lista_cuadrantes' },
      { id: 'cuad-horarios', label: 'Lista Horarios', href: '/cuadrantes?tab=lista_horarios' },
      { id: 'cuad-crear', label: 'Crear Horario', href: '/cuadrantes?tab=horarios' },
      { id: 'cuad-festivos', label: 'Festivos', href: '/cuadrantes?tab=festivos' },
      {
        id: 'cuad-multi',
        label: 'Horario Multicentro',
        href: '/cuadrantes?tab=horario_multicentro',
      },
    ],
    clientes: [
      { id: 'clientes-list', label: 'Clientes', href: '/clientes?tab=clientes' },
      { id: 'clientes-prov', label: 'Proveedores', href: '/clientes?tab=proveedores' },
    ],
    'mensajes-enviados': [
      { id: 'msg-enviar', label: 'Enviar', href: '/mensajes-enviados?tab=enviar' },
      { id: 'msg-historial', label: 'Historial', href: '/mensajes-enviados?tab=historial' },
      { id: 'msg-auto', label: 'Automáticos', href: '/mensajes-enviados?tab=automaticos' },
      {
        id: 'msg-reminders',
        label: 'Recordatorios fichaje',
        href: '/mensajes-enviados?tab=fichajeReminders',
      },
      { id: 'msg-chatai', label: 'Chat AI', href: '/mensajes-enviados?tab=chatAi' },
    ],
    'presupuestos-v2': [
      { id: 'presup-lista', label: 'Lista', href: '/presupuestos-v2?tab=lista' },
      { id: 'presup-nuevo', label: 'Nuevo', href: '/presupuestos-v2?tab=nuevo' },
      { id: 'presup-config', label: 'Configuración', href: '/presupuestos-v2?tab=config' },
    ],
  };

  // Pedidos: admin vs empleado routes differ
  if (ctx.isPedidosAdmin) {
    children.pedidos = [
      { id: 'ped-nuevo', label: 'Nuevo pedido', href: '/pedidos?tab=nuevo-pedido' },
      { id: 'ped-gestionar', label: 'Gestionar pedidos', href: '/pedidos?tab=gestionar-pedidos' },
      { id: 'ped-permisos', label: 'Permisos', href: '/pedidos?tab=permisos' },
      { id: 'ped-catalogo', label: 'Catálogo', href: '/pedidos?tab=catalogo' },
      { id: 'ped-notas', label: 'Notas', href: '/pedidos?tab=notas' },
    ];
  } else {
    children.pedidos = [
      { id: 'ped-mis', label: 'Mis pedidos', href: '/empleado-pedidos?tab=mis-pedidos' },
      { id: 'ped-nuevo-emp', label: 'Nuevo pedido', href: '/empleado-pedidos?tab=nuevo-pedido' },
    ];
  }

  return children;
}

/**
 * Attach `children` arrays to nav items (mutates copies).
 * @param {Array<{ id: string, href: string }>} items
 * @param {NavChildrenCtx} ctx
 */
export function withNavChildren(items, ctx) {
  const map = getNavChildrenByModuleId(ctx);
  return (items || []).map((item) => {
    const kids = map[item.id];
    if (!kids?.length) return item;
    return { ...item, children: kids };
  });
}
