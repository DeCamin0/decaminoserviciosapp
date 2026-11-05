import {
  BarChart3,
  Calendar,
  Camera,
  CheckCircle,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Folder,
  ListTodo,
  Mail,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trophy,
  UserCircle,
  Users,
} from 'lucide-react';
import { createElement } from 'react';
import { withNavChildren } from './navModuleChildren';

function icon(Cmp, className = 'h-5 w-5') {
  return createElement(Cmp, { className, 'aria-hidden': true });
}

/**
 * Shared nav module list (Inicio orb + desktop sidebar).
 * Same permission rules as former DashboardPage.quickAccessItems.
 *
 * @param {object} ctx
 * @param {boolean} ctx.shouldUseBackend
 * @param {boolean} ctx.hasBackendPermissions
 * @param {(m: string) => boolean} ctx.hasPermission
 * @param {boolean} ctx.isManager
 * @param {boolean} ctx.isAdmin
 * @param {boolean} ctx.isDeveloper
 * @param {string} [ctx.userGrupo]
 * @param {number} [ctx.comunicadosUnreadCount]
 * @param {number} [ctx.documentosSolicitadosCount]
 * @param {number} [ctx.documentosPRLPendientesCount]
 * @param {number} [ctx.documentosOficialesNecesitanFirmaCount]
 * @param {number} [ctx.misTareasPendientesCount]
 * @param {boolean} [ctx.withChildren=true]
 */
export function buildNavItems(ctx) {
  const {
    shouldUseBackend,
    hasBackendPermissions,
    hasPermission,
    isManager,
    isAdmin,
    isDeveloper,
    userGrupo,
    comunicadosUnreadCount = 0,
    documentosSolicitadosCount = 0,
    documentosPRLPendientesCount = 0,
    documentosOficialesNecesitanFirmaCount = 0,
    misTareasPendientesCount = 0,
    withChildren = true,
  } = ctx;

  const list = [];

  const canAccessDatos = shouldUseBackend ? hasPermission('datos') : true;
  const canAccessFichar = shouldUseBackend
    ? hasPermission('fichar-empleados') || hasPermission('fichar-admin')
    : true;
  const canAccessSolicitudes = shouldUseBackend
    ? hasPermission('solicitudes-empleados') ||
      hasPermission('solicitudes-admin') ||
      hasPermission('solicitudes')
    : true;
  const canAccessDocumentos = shouldUseBackend ? hasPermission('documentos') : true;
  const canAccessCuadrantesEmpleado = hasBackendPermissions
    ? hasPermission('cuadrantes-empleado')
    : false;
  const canAccessMisInspecciones = hasBackendPermissions
    ? hasPermission('mis-inspecciones')
    : false;
  const canAccessMisTareas = hasBackendPermissions ? hasPermission('mis-tareas') : false;
  const canAccessComunicados = hasBackendPermissions ? hasPermission('comunicados') : false;

  if (canAccessDatos) {
    list.push({
      id: 'datos-personales',
      label: 'Datos personales',
      hint: 'Información del empleado',
      icon: icon(UserCircle),
      gradient: 'from-blue-500 via-sky-500 to-indigo-500',
      href: '/datos',
    });
  }

  if (canAccessFichar) {
    list.push({
      id: 'fichar',
      label: 'Registro de Jornada',
      hint: 'Control de horarios',
      icon: icon(Clock),
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      href: '/fichaje',
    });
  }

  if (canAccessSolicitudes) {
    list.push({
      id: 'solicitudes',
      label: 'Solicitudes',
      hint: 'Gestionar peticiones',
      icon: icon(ClipboardList),
      gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
      href: '/solicitudes',
    });
  }

  const totalNotifications =
    documentosSolicitadosCount +
    documentosPRLPendientesCount +
    documentosOficialesNecesitanFirmaCount;

  if (canAccessDocumentos) {
    list.push({
      id: 'documentos',
      label: 'Documentos',
      hint: 'Nóminas y archivos',
      icon: icon(FileText),
      gradient: 'from-orange-500 via-amber-500 to-yellow-500',
      href: '/documentos',
      notificationCount: totalNotifications > 0 ? totalNotifications : undefined,
    });
  }

  if (canAccessCuadrantesEmpleado) {
    list.push({
      id: 'mi-horario',
      label: 'Mi horario',
      hint: 'Consulta tu cuadrante',
      icon: icon(Calendar),
      gradient: 'from-sky-500 via-blue-500 to-indigo-500',
      href: '/cuadrantes-empleado',
    });
  }

  if (canAccessMisInspecciones) {
    list.push({
      id: 'mis-inspecciones',
      label: 'Mis inspecciones',
      hint: 'Inspecciones asignadas',
      icon: icon(ClipboardCheck),
      gradient: 'from-cyan-500 via-sky-500 to-blue-500',
      href: '/mis-inspecciones',
    });
  }

  if (canAccessMisTareas) {
    list.push({
      id: 'mis-tareas',
      label: 'Mis tareas',
      hint: 'Confirmar y subir fotos',
      icon: icon(CheckSquare),
      gradient: 'from-lime-500 via-green-500 to-emerald-600',
      href: '/mis-tareas',
      notificationCount: misTareasPendientesCount > 0 ? misTareasPendientesCount : undefined,
    });
  }

  if (canAccessComunicados) {
    list.push({
      id: 'comunicados',
      label: 'Comunicados',
      hint: 'Anuncios y comunicaciones oficiales',
      icon: icon(FileText),
      gradient: 'from-green-500 via-emerald-500 to-teal-500',
      href: '/comunicados',
      notificationCount: comunicadosUnreadCount > 0 ? comunicadosUnreadCount : undefined,
    });
  }

  const canManageEmployees = shouldUseBackend ? hasPermission('empleados') : isManager;
  const canManageDocuments = shouldUseBackend ? hasPermission('documentos-empleados') : isManager;
  const canManageCuadrantes = hasBackendPermissions ? hasPermission('cuadrantes') : false;
  const canApprove = hasBackendPermissions ? hasPermission('aprobaciones') : false;
  const canInspect = hasBackendPermissions ? hasPermission('inspecciones') : false;
  const canManageTareas = hasBackendPermissions ? hasPermission('tareas') : false;

  if (canManageEmployees) {
    list.push({
      id: 'gestionar-empleados',
      label: 'Gestionar empleados',
      hint: 'Administrar equipo',
      icon: icon(Users),
      gradient: 'from-indigo-500 via-violet-500 to-purple-500',
      href: '/empleados',
      role: 'manager',
    });
  }

  if ((!shouldUseBackend && isManager) || canManageDocuments) {
    list.push({
      id: 'documentos-empleados',
      label: 'Documentos empleados',
      hint: 'Archivos por empleado',
      icon: icon(Folder),
      gradient: 'from-teal-500 via-cyan-500 to-sky-500',
      href: '/documentos-empleados',
      role: 'manager',
    });
  }

  const canAccessPRL = shouldUseBackend ? hasPermission('prl-documentos') : isManager;
  if (canAccessPRL) {
    list.push({
      id: 'prl-documentos',
      label: 'Documentos PRL',
      hint: 'Gestión documentos PRL por puesto',
      icon: icon(ShieldCheck),
      gradient: 'from-primary-500 via-primary-600 to-primary-700',
      href: '/prl-documentos',
      role: 'manager',
    });
  }

  if (canManageCuadrantes) {
    list.push({
      id: 'cuadrantes',
      label: 'Cuadrantes',
      hint: 'Gestión de horarios del equipo',
      icon: icon(Calendar),
      gradient: 'from-slate-500 via-gray-500 to-zinc-500',
      href: '/cuadrantes',
      role: 'manager',
    });
  }

  if (canApprove) {
    list.push({
      id: 'aprobaciones',
      label: 'Aprobaciones',
      hint: 'Aprobar solicitudes de empleados',
      icon: icon(CheckCircle),
      gradient: 'from-yellow-500 via-amber-500 to-orange-500',
      href: '/aprobaciones',
      role: 'manager',
    });
  }

  if (canInspect) {
    list.push({
      id: 'inspecciones',
      label: 'Inspecciones',
      hint: 'Realizar auditorías',
      icon: icon(ClipboardCheck),
      gradient: 'from-amber-500 via-orange-500 to-yellow-500',
      href: '/inspecciones',
      role: 'manager',
    });
  }

  if (canManageTareas) {
    list.push({
      id: 'tareas',
      label: 'Tareas',
      hint: 'Gestionar tareas del equipo',
      icon: icon(ListTodo),
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      href: '/tareas',
      role: 'manager',
    });
  }

  const canFotosTrabajo = shouldUseBackend
    ? hasPermission('fotos-trabajo')
    : isManager || isAdmin || isDeveloper;
  if (canFotosTrabajo) {
    list.push({
      id: 'fotos-trabajo',
      label: 'Fotos Trabajo',
      hint: 'Fotos por comunidad y servicio',
      icon: icon(Camera),
      gradient: 'from-cyan-500 via-sky-500 to-blue-600',
      href: '/fotos-trabajo',
      role: 'manager',
    });
  }

  const hasSpecialAccess = isManager || isAdmin || isDeveloper;
  const hasPedidosAdminPermission = shouldUseBackend ? hasPermission('pedidos-admin') : false;
  const hasPedidosPermissionOld = shouldUseBackend ? hasPermission('pedidos') : false;
  const isPedidosAdmin =
    hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld;
  const pedidosHref = isPedidosAdmin ? '/pedidos' : '/empleado-pedidos';

  list.push({
    id: 'pedidos',
    label: 'Pedidos',
    hint: 'Gestiona tus pedidos',
    icon: icon(ShoppingCart),
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    href: pedidosHref,
    role: isPedidosAdmin ? 'manager' : 'empleado',
  });

  const canAccessAdmin = shouldUseBackend
    ? hasPermission('admin')
    : isAdmin || isDeveloper;
  const canAccessStats = shouldUseBackend
    ? hasPermission('estadisticas')
    : isAdmin || isDeveloper || userGrupo === 'Supervisor';
  const canAccessClientes = hasBackendPermissions ? hasPermission('clientes') : false;

  if (canAccessAdmin) {
    list.push({
      id: 'admin-panel',
      label: 'Admin Panel',
      hint: 'Control del sistema y estadísticas avanzadas',
      icon: icon(Settings),
      gradient: 'from-slate-500 via-slate-600 to-slate-700',
      href: '/admin',
      role: 'manager',
    });
  }

  if (canAccessAdmin) {
    list.push({
      id: 'mensajes-enviados',
      label: 'Mensajes Enviados',
      hint: 'Gestiona y visualiza todos los mensajes enviados',
      icon: icon(Mail),
      gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
      href: '/mensajes-enviados',
      role: 'manager',
    });
  }

  if (canAccessStats) {
    list.push({
      id: 'estadisticas',
      label: 'Estadísticas',
      hint: 'Análisis y reportes avanzados',
      icon: icon(BarChart3),
      gradient: 'from-fuchsia-500 via-purple-500 to-cyan-500',
      href: '/estadisticas',
      role: 'manager',
    });
  }

  if (canAccessClientes) {
    list.push({
      id: 'clientes',
      label: 'Clientes',
      hint: 'Gestión de clientes y proveedores',
      icon: icon(Users),
      gradient: 'from-teal-500 via-cyan-500 to-sky-500',
      href: '/clientes',
      role: 'manager',
    });
  }

  const canAccessPresupuestos = hasBackendPermissions
    ? hasPermission('presupuestos-informes') || canAccessClientes
    : isAdmin ||
      isDeveloper ||
      isManager ||
      userGrupo === 'Supervisor' ||
      canAccessClientes;

  if (canAccessPresupuestos) {
    list.push({
      id: 'presupuestos-informes',
      label: 'Presupuestos actual (Legacy)',
      hint: 'Sistema actual de presupuestos e informes',
      icon: icon(FileText),
      gradient: 'from-indigo-500 via-purple-500 to-pink-500',
      href: '/presupuestos-informes',
      role: 'manager',
    });
  }

  const canAccessPresupuestosV2 = hasBackendPermissions
    ? hasPermission('presupuestos-v2')
    : isAdmin || isDeveloper || isManager || userGrupo === 'Supervisor';
  if (canAccessPresupuestosV2) {
    list.push({
      id: 'presupuestos-v2',
      label: 'Presupuestos V2',
      hint: 'Nuevo módulo de presupuestos',
      icon: icon(FileText),
      gradient: 'from-slate-600 via-gray-700 to-zinc-800',
      href: '/presupuestos-v2',
      role: 'manager',
    });
  }

  const canAccessServiciosPeriodicos = hasBackendPermissions
    ? hasPermission('servicios-periodicos') || canAccessClientes
    : isAdmin ||
      isDeveloper ||
      isManager ||
      userGrupo === 'Supervisor' ||
      canAccessClientes;
  if (canAccessServiciosPeriodicos) {
    list.push({
      id: 'servicios-periodicos',
      label: 'Servicios periódicos',
      hint: 'Checklist mensual por comunidad',
      icon: icon(Calendar),
      gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
      href: '/servicios-periodicos',
      role: 'manager',
    });
  }

  const canAccessHallOfFame = shouldUseBackend ? hasPermission('hall-of-fame') : true;
  if (canAccessHallOfFame) {
    list.push({
      id: 'hall-of-fame',
      label: 'Salón de la Fama',
      hint: 'Clasament lunar',
      icon: icon(Trophy),
      gradient: 'from-yellow-400 via-amber-500 to-orange-500',
      href: '/hall-of-fame',
    });
  }

  if (!withChildren) return list;

  return withNavChildren(list, {
    shouldUseBackend,
    hasBackendPermissions,
    hasPermission,
    isManager,
    isAdmin,
    isDeveloper,
    isPedidosAdmin,
  });
}

/**
 * Resolve permissions matrix key for an employee GRUPO (same rules as DashboardPage).
 */
export function findGrupoKey(grupo, permissions) {
  if (!grupo || !permissions) return null;

  const grupoStr = String(grupo).trim();

  if (permissions[grupoStr]) return grupoStr;

  const exactMatch = Object.keys(permissions).find(
    (key) => key.toLowerCase() === grupoStr.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  const firstWord = grupoStr.split(/\s+/)[0];
  if (permissions[firstWord]) return firstWord;

  const partialMatch = Object.keys(permissions).find((key) => {
    const keyLower = key.toLowerCase();
    const grupoLower = grupoStr.toLowerCase();
    return grupoLower.includes(keyLower) || keyLower.includes(grupoLower);
  });
  if (partialMatch) return partialMatch;

  const keywords = [
    'Administrativ',
    'Auxiliar',
    'Manager',
    'Supervisor',
    'Admin',
    'Developer',
    'Operario',
    'Empleado',
  ];
  for (const keyword of keywords) {
    if (grupoStr.toLowerCase().includes(keyword.toLowerCase())) {
      if (permissions[keyword]) return keyword;
      const keywordMatch = Object.keys(permissions).find(
        (key) =>
          key.toLowerCase() === keyword.toLowerCase() ||
          key.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(key.toLowerCase()),
      );
      if (keywordMatch) return keywordMatch;
    }
  }

  return (
    Object.keys(permissions).find((key) => {
      const keyLower = key.toLowerCase();
      const grupoLower = grupoStr.toLowerCase();
      return grupoLower.includes(keyLower) || keyLower.includes(grupoLower);
    }) || null
  );
}
