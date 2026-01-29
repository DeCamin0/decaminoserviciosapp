import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextBase';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useComunicadosApi } from '../../hooks/useComunicadosApi';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserCircle,
  Clock,
  ClipboardList,
  FileText,
  Calendar,
  ClipboardCheck,
  Users,
  Folder,
  CheckCircle,
  ShoppingCart,
  Settings,
  Mail,
  BarChart3,
  Trophy,
  ShieldCheck,
} from 'lucide-react';
import { routes } from '../../utils/routes';

/**
 * MobileMoreDrawer - Drawer pentru butonul "Más" cu toate paginile din Acceso rápido
 * Afișează toate itemele disponibile, filtrate după permisiuni
 */
const MobileMoreDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPermissions } = useAdminApi();
  const { getUnreadCount } = useComunicadosApi();
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [comunicadosUnreadCount, setComunicadosUnreadCount] = useState(0);
  const [documentosSolicitadosCount, setDocumentosSolicitadosCount] = useState(0);

  const userGrupo = useMemo(() => user?.GRUPO || user?.grupo || 'Empleado', [user?.GRUPO, user?.grupo]);
  const isManager = useMemo(() => user?.isManager || false, [user?.isManager]);
  const isAdmin = useMemo(() => user?.GRUPO === 'Admin' || user?.grupo === 'Admin', [user?.GRUPO, user?.grupo]);
  const isDeveloper = useMemo(() => user?.GRUPO === 'Developer' || user?.grupo === 'Developer', [user?.GRUPO, user?.grupo]);

  // Helper pentru verificarea permisiunilor
  const findGrupoKey = useCallback((grupo, permissions) => {
    if (!grupo || !permissions) return null;
    const grupoStr = String(grupo).trim();
    if (permissions[grupoStr]) return grupoStr;
    const exactMatch = Object.keys(permissions).find(key => 
      key.toLowerCase() === grupoStr.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    const firstWord = grupoStr.split(/\s+/)[0];
    if (permissions[firstWord]) return firstWord;
    return null;
  }, []);

  const hasPermission = useCallback((module) => {
    if (!userPermissions || !userGrupo) return false;
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return false;
    const grupoPermissions = userPermissions[grupoKey];
    return grupoPermissions && grupoPermissions[module] === true;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || user?.isDemo) {
        setLoadingPermissions(false);
        return;
      }
      setLoadingPermissions(false);
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(null);
      }
    };
    loadPermissions();
  }, [userGrupo, user?.isDemo, getPermissions]);

  // Obține numărul de comunicados necitite
  useEffect(() => {
    if (!user?.userId && !user?.CODIGO) return;
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setComunicadosUnreadCount(count);
      } catch (err) {
        console.error('Error loading unread comunicados count:', err);
        setComunicadosUnreadCount(0);
      }
    };
    loadUnreadCount();
    // Reîncarcă la fiecare 60 de secunde (optimizat pentru a reduce traficul)
    // Oprește polling-ul când tab-ul nu este activ
    let interval = null;
    const startPolling = () => {
      if (document.hidden) return;
      interval = setInterval(() => {
        if (!document.hidden) {
          loadUnreadCount();
        }
      }, 60000); // 60 secunde în loc de 30
    };
    
    startPolling();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        loadUnreadCount();
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.userId, user?.CODIGO, getUnreadCount]);

  // Obține numărul de documente solicitate
  useEffect(() => {
    const fetchDocumentosSolicitadosCount = async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setDocumentosSolicitadosCount(0);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const empleadoId = user.CODIGO;
        const url = routes.getDocumentosSolicitados(empleadoId);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && Array.isArray(data.data)) {
            const pendientes = data.data.filter((s) => s.estado === 'pendiente');
            setDocumentosSolicitadosCount(pendientes.length);
          }
        }
      } catch (error) {
        setDocumentosSolicitadosCount(0);
      }
    };
    fetchDocumentosSolicitadosCount();
    // Reîncarcă la fiecare 60 de secunde (optimizat pentru a reduce traficul)
    // Oprește polling-ul când tab-ul nu este activ
    let interval = null;
    const startPolling = () => {
      if (document.hidden) return;
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchDocumentosSolicitadosCount();
        }
      }, 60000); // 60 secunde în loc de 30
    };
    
    startPolling();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        fetchDocumentosSolicitadosCount();
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.CODIGO, user?.isDemo]);

  // Calculează pedidosAccess
  const pedidosAccess = useMemo(() => {
    const empleado = user || {};
    const grupo = empleado?.GRUPO || user?.GRUPO;
    
    // 🔍 LOG: Datele din DatosEmpleados
    console.log('🔍 [MobileMoreDrawer] ===== PEDIDOS ACCESS DEBUG =====');
    console.log('📋 [MobileMoreDrawer] User object (DatosEmpleados):', {
      CODIGO: empleado?.CODIGO,
      GRUPO: empleado?.GRUPO || grupo,
      NOMBRE: empleado?.['NOMBRE / APELLIDOS'] || empleado?.NOMBRE,
      isManager: empleado?.isManager,
      isDemo: empleado?.isDemo,
      // Câmpuri relevante pentru pedidos
      derechopedido: empleado?.derechopedido,
      DERECHO_PEDIDO: empleado?.DERECHO_PEDIDO,
      pedidos_permitido: empleado?.pedidos_permitido,
      canMakePedidos: empleado?.canMakePedidos,
      PEDIDOS_PERMITIDO: empleado?.PEDIDOS_PERMITIDO,
      DERECHO_PEDIDOS: empleado?.DERECHO_PEDIDOS,
      PEDIDOS_ACCESO: empleado?.PEDIDOS_ACCESO,
      ACCESO_PEDIDOS: empleado?.ACCESO_PEDIDOS,
      // Toate câmpurile care conțin "pedido"
      allPedidoFields: Object.keys(empleado || {}).filter(key => 
        key.toLowerCase().includes('pedido')
      ).reduce((acc, key) => {
        acc[key] = empleado[key];
        return acc;
      }, {}),
    });
    
    // 🔍 LOG: Datele din Permisos
    console.log('🔐 [MobileMoreDrawer] Permissions object (Permisos table):', {
      userPermissions,
      loadingPermissions,
      userGrupo,
      hasBackendPermissions: userPermissions && Object.keys(userPermissions).length > 0,
      permissionsKeys: userPermissions ? Object.keys(userPermissions) : [],
    });
    
    const checkField = (value) => {
      if (!value) return false;
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
      if (typeof normalized === 'boolean') return normalized;
      if (typeof normalized === 'number') return normalized === 1;
      if (typeof normalized === 'string') {
        return ['s', 'si', 'sí', '1', 'y', 'yes', 'true'].includes(normalized);
      }
      return false;
    };
    const pedidosFields = [
      'derechopedido', 'DERECHO_PEDIDO', 'pedidos_permitido', 'canMakePedidos',
      'PEDIDOS_PERMITIDO', 'DERECHO_PEDIDOS', 'PEDIDOS_ACCESO', 'ACCESO_PEDIDOS',
    ];
    const hasFieldPermission = pedidosFields.some((field) => checkField(empleado?.[field]));
    const hasGenericPermission = Object.keys(empleado || {}).some(
      (key) => key.toLowerCase().includes('pedido') && checkField(empleado[key]),
    );
    const hasSpecialAccess = isManager || isAdmin || isDeveloper;

    // ✅ Verifică permisiunile din backend (permissos)
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;
    
    // ✅ CORECTAT: 'dashboard' verifică INDIVIDUAL (din DatosEmpleados), nu pe grup
    // Dacă are 'dashboard: true', verifică dacă utilizatorul are 'DerechoPedidos' în datele personale
    // Dacă are 'pedidos: true', are acces complet (manager-level)
    const hasDashboardPermission = shouldUseBackend ? hasPermission('dashboard') : false;
    const hasPedidosPermission = shouldUseBackend ? hasPermission('pedidos') : false;
    
    // Dacă are 'dashboard', verifică individual (din DatosEmpleados)
    const hasIndividualPedidosAccess = hasDashboardPermission && (hasFieldPermission || hasGenericPermission);
    
    // Acces complet dacă are 'pedidos' în permisiuni SAU 'dashboard' + DerechoPedidos individual
    const hasBackendPedidosPermission = hasPedidosPermission || hasIndividualPedidosAccess;
    
    // 🔍 LOG: Rezultatele verificărilor
    const grupoKey = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) : null;
    const grupoPermissions = grupoKey && userPermissions ? userPermissions[grupoKey] : null;
    console.log('🔍 [MobileMoreDrawer] Permission checks:', {
      hasSpecialAccess,
      isManager,
      isAdmin,
      isDeveloper,
      hasBackendPermissions,
      useBackendPermissions,
      grupoKeyExists,
      grupoKey,
      grupoPermissions: grupoPermissions ? {
        ...grupoPermissions,
        // Log explicit pentru pedidos și dashboard
        pedidos: grupoPermissions.pedidos,
        dashboard: grupoPermissions.dashboard,
        // Toate cheile disponibile
        allKeys: Object.keys(grupoPermissions),
      } : null,
      shouldUseBackend,
      hasDashboardPermission,
      hasPedidosPermission,
      hasIndividualPedidosAccess,
      hasBackendPedidosPermission,
      hasFieldPermission,
      hasGenericPermission,
      backendSystemExists: userPermissions !== null || loadingPermissions === true,
    });

    // ✅ CORECTAT STRICT: Pentru angajații normali, verificăm DOAR permisiunile din backend
    // Managerii/Adminii/Developerii au acces complet (hasSpecialAccess)
    // Fallback-ul este doar pentru cazuri în care sistemul de permisiuni backend nu există deloc
    // (de exemplu, dacă userPermissions este null și loadingPermissions este false - sistemul nu a încercat să încarce permisiuni)
    const backendSystemExists = userPermissions !== null || loadingPermissions === true;
    const canAccess =
      hasSpecialAccess || // Manager/Admin/Developer au acces complet
      hasBackendPedidosPermission || // Sau au permisiunea 'pedidos' în backend
      (!backendSystemExists && hasFieldPermission) || // Fallback STRICT: doar dacă sistemul de permisiuni backend nu există deloc
      (!backendSystemExists && hasGenericPermission); // Fallback STRICT: doar dacă sistemul de permisiuni backend nu există deloc
    
    // 🔍 LOG: Rezultatul final
    console.log('✅ [MobileMoreDrawer] Final decision:', {
      canAccess,
      reason: hasSpecialAccess ? 'hasSpecialAccess (Manager/Admin/Developer)' :
               hasPedidosPermission ? 'hasPedidosPermission (permisiune pedidos pe grup)' :
               hasIndividualPedidosAccess ? 'hasIndividualPedidosAccess (dashboard + DerechoPedidos individual)' :
               (!backendSystemExists && hasFieldPermission) ? 'Fallback: hasFieldPermission (câmpuri în DatosEmpleados)' :
               (!backendSystemExists && hasGenericPermission) ? 'Fallback: hasGenericPermission (câmpuri generice)' :
               'NO ACCESS',
      href: (hasSpecialAccess || hasPedidosPermission) ? '/pedidos' : '/empleado-pedidos',
      role: (hasSpecialAccess || hasPedidosPermission) ? 'manager' : undefined,
    });
    console.log('🔍 [MobileMoreDrawer] ===== END PEDIDOS ACCESS DEBUG =====\n');
    
    return {
      canAccess,
      hint: (hasSpecialAccess || hasPedidosPermission) ? 'Gestionar pedidos y permisos' : canAccess ? 'Crear nuevos pedidos' : 'No tienes permisos',
      href: (hasSpecialAccess || hasPedidosPermission) ? '/pedidos' : '/empleado-pedidos',
      role: (hasSpecialAccess || hasPedidosPermission) ? 'manager' : undefined,
    };
  }, [user, isManager, isAdmin, isDeveloper, userPermissions, loadingPermissions, userGrupo, findGrupoKey, hasPermission]);

  // Construiește lista de iteme (similar cu DashboardPage)
  const allItems = useMemo(() => {
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;

    const canAccessDatos = shouldUseBackend ? (hasPermission('datos') || hasPermission('dashboard')) : true;
    const canAccessFichar = shouldUseBackend ? (hasPermission('fichar') || hasPermission('dashboard')) : true;
    const canAccessSolicitudes = shouldUseBackend ? (hasPermission('solicitudes') || hasPermission('dashboard')) : true;
    const canAccessDocumentos = shouldUseBackend ? (hasPermission('documentos') || hasPermission('dashboard')) : true;
    const canAccessCuadrantesEmpleado = shouldUseBackend ? (hasPermission('cuadrantes-empleado') || hasPermission('cuadrantes') || hasPermission('dashboard')) : true;
    const canAccessMisInspecciones = shouldUseBackend ? (hasPermission('mis-inspecciones') || hasPermission('dashboard')) : true;
    const canAccessComunicados = true;
    const canManageEmployees = shouldUseBackend ? hasPermission('empleados') : isManager;
    const canManageDocuments = shouldUseBackend ? hasPermission('documentos-empleados') : isManager;
    const canManageCuadrantes = shouldUseBackend ? hasPermission('cuadrantes') : isManager;
    const canApprove = shouldUseBackend ? hasPermission('aprobaciones') : isManager;
    const canInspect = shouldUseBackend ? hasPermission('inspecciones') : isManager;
    const canAccessAdmin = shouldUseBackend ? hasPermission('admin') : (isAdmin || isDeveloper);
    const canAccessStats = shouldUseBackend ? hasPermission('estadisticas') : (isAdmin || isDeveloper || user?.GRUPO === 'Supervisor');
    const canAccessClientes = shouldUseBackend ? hasPermission('clientes') : (isAdmin || isDeveloper || user?.GRUPO === 'Supervisor');

    const list = [];

    if (canAccessDatos) {
      list.push({ id: 'datos-personales', label: 'Datos personales', hint: 'Información del empleado', icon: UserCircle, href: '/datos', gradient: 'from-blue-500 via-sky-500 to-indigo-500' });
    }
    if (canAccessFichar) {
      list.push({ id: 'fichar', label: 'Registro de Jornada', hint: 'Control de horarios', icon: Clock, href: '/fichaje', gradient: 'from-emerald-500 via-teal-500 to-cyan-500' });
    }
    if (canAccessSolicitudes) {
      list.push({ id: 'solicitudes', label: 'Solicitudes', hint: 'Gestionar peticiones', icon: ClipboardList, href: '/solicitudes', gradient: 'from-purple-500 via-fuchsia-500 to-pink-500' });
    }
    if (canAccessDocumentos) {
      list.push({ id: 'documentos', label: 'Documentos', hint: 'Nóminas y archivos', icon: FileText, href: '/documentos', notificationCount: documentosSolicitadosCount > 0 ? documentosSolicitadosCount : undefined, gradient: 'from-orange-500 via-amber-500 to-yellow-500' });
    }
    if (canAccessCuadrantesEmpleado) {
      list.push({ id: 'mi-horario', label: 'Mi horario', hint: 'Consulta tu cuadrante', icon: Calendar, href: '/cuadrantes-empleado', gradient: 'from-sky-500 via-blue-500 to-indigo-500' });
    }
    if (canAccessMisInspecciones) {
      list.push({ id: 'mis-inspecciones', label: 'Mis inspecciones', hint: 'Inspecciones asignadas', icon: ClipboardCheck, href: '/mis-inspecciones', gradient: 'from-cyan-500 via-sky-500 to-blue-500' });
    }
    if (canAccessComunicados) {
      list.push({ id: 'comunicados', label: 'Comunicados', hint: 'Anuncios y comunicaciones oficiales', icon: FileText, href: '/comunicados', notificationCount: comunicadosUnreadCount > 0 ? comunicadosUnreadCount : undefined, gradient: 'from-green-500 via-emerald-500 to-teal-500' });
    }
    if (canManageEmployees) {
      list.push({ id: 'gestionar-empleados', label: 'Gestionar empleados', hint: 'Administrar equipo', icon: Users, href: '/empleados', role: 'manager', gradient: 'from-indigo-500 via-violet-500 to-purple-500' });
    }
    if (canManageDocuments) {
      list.push({ id: 'documentos-empleados', label: 'Documentos empleados', hint: 'Archivos por empleado', icon: Folder, href: '/documentos-empleados', role: 'manager', gradient: 'from-teal-500 via-cyan-500 to-sky-500' });
      list.push({ id: 'prl-documentos', label: 'Documentos PRL', hint: 'Gestión documentos PRL por puesto', icon: ShieldCheck, href: '/prl-documentos', role: 'manager', gradient: 'from-red-500 via-rose-500 to-pink-500' });
    }
    if (canManageCuadrantes) {
      list.push({ id: 'cuadrantes', label: 'Cuadrantes', hint: 'Gestión de horarios del equipo', icon: Calendar, href: '/cuadrantes', role: 'manager', gradient: 'from-slate-500 via-gray-500 to-zinc-500' });
    }
    if (canApprove) {
      list.push({ id: 'aprobaciones', label: 'Aprobaciones', hint: 'Aprobar solicitudes de empleados', icon: CheckCircle, href: '/aprobaciones', role: 'manager', gradient: 'from-yellow-500 via-amber-500 to-orange-500' });
    }
    if (canInspect) {
      list.push({ id: 'inspecciones', label: 'Inspecciones', hint: 'Realizar auditorías', icon: ClipboardCheck, href: '/inspecciones', role: 'manager', gradient: 'from-amber-500 via-orange-500 to-yellow-500' });
    }
    if (pedidosAccess.canAccess) {
      list.push({ id: 'pedidos', label: 'Pedidos', hint: pedidosAccess.hint, icon: ShoppingCart, href: pedidosAccess.href, role: pedidosAccess.role, gradient: 'from-amber-500 via-orange-500 to-yellow-500' });
    }
    if (canAccessAdmin) {
      list.push({ id: 'admin-panel', label: 'Admin Panel', hint: 'Control del sistema y estadísticas avanzadas', icon: Settings, href: '/admin', role: 'manager', gradient: 'from-slate-500 via-slate-600 to-slate-700' });
    }
    if (canAccessAdmin) {
      list.push({ id: 'mensajes-enviados', label: 'Mensajes Enviados', hint: 'Gestiona y visualiza todos los mensajes enviados', icon: Mail, href: '/mensajes-enviados', role: 'manager', gradient: 'from-purple-500 via-violet-500 to-fuchsia-500' });
    }
    if (canAccessStats) {
      list.push({ id: 'estadisticas', label: 'Estadísticas', hint: 'Análisis y reportes avanzados', icon: BarChart3, href: '/estadisticas', role: 'manager', gradient: 'from-fuchsia-500 via-purple-500 to-cyan-500' });
    }
    if (canAccessClientes) {
      list.push({ id: 'clientes', label: 'Clientes', hint: 'Gestión de clientes y proveedores', icon: Users, href: '/clientes', role: 'manager', gradient: 'from-teal-500 via-cyan-500 to-sky-500' });
    }
    list.push({ id: 'hall-of-fame', label: 'Salón de la Fama', hint: 'Clasament lunar', icon: Trophy, href: '/hall-of-fame', gradient: 'from-yellow-400 via-amber-500 to-orange-500' });

    return list;
  }, [
    userPermissions, loadingPermissions, userGrupo, findGrupoKey, hasPermission,
    isManager, isAdmin, isDeveloper, pedidosAccess, user?.GRUPO,
    comunicadosUnreadCount, documentosSolicitadosCount
  ]);

  // Filtrează itemele care sunt deja în bottom nav
  const filteredItems = useMemo(() => {
    const bottomNavPaths = ['/inicio', '/fichaje', '/solicitudes', '/empleados', '/comunicados'];
    return allItems.filter(item => !bottomNavPaths.includes(item.href));
  }, [allItems]);

  const handleItemClick = (href) => {
    navigate(href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Más opciones</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.href)}
                  className="relative p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex flex-col items-start gap-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient || 'from-gray-400 to-gray-500'} shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {item.hint}
                      </div>
                    </div>
                  </div>
                  {/* Badge pentru notificări */}
                  {item.notificationCount && item.notificationCount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-5 flex items-center justify-center px-1.5 shadow-md">
                      {item.notificationCount > 99 ? '99+' : item.notificationCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMoreDrawer;
