import { useAuth } from '../contexts/AuthContextBase';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Notification } from '../components/ui';
import { routes } from '../utils/routes';
import { getCachedAvatar, setCachedAvatar, DEFAULT_AVATAR } from '../utils/avatarCache';
import QuickAccessOrb from '../components/QuickAccessOrb';
import { useAdminApi } from '../hooks/useAdminApi';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import SendNotificationModal from '../components/SendNotificationModal';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Folder,
  Mail,
  Settings,
  ShoppingCart,
  Trophy,
  UserCircle,
  Users,
  ShieldCheck,
} from 'lucide-react';
import {
  getCurrentMonthKey,
  getStoredMonthlyAlerts,
  isMonthlyAlertsNotified,
  markMonthlyAlertsNotified,
  normalizeDetalles,
  fetchMonthlyAlerts as fetchMonthlyAlertsData
} from '../utils/monthlyAlerts';
import activityLogger from '../utils/activityLogger';

const InicioPage = () => {
  const { user } = useAuth();
  const { getPermissions } = useAdminApi();
  const { getUnreadCount } = useComunicadosApi();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [uiReady, setUiReady] = useState(false); // decuplează UX de fetch-uri lente
  const avatarLoadedRef = useRef(false);
  const currentUserIdRef = useRef(null);
  const [monthlyAlerts, setMonthlyAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertNotification, setAlertNotification] = useState(null);
  const [notification, setNotification] = useState(null);
  const alertsFetchedRef = useRef({ userId: null, month: null, fetched: false });
  const [empleadoCompleto, setEmpleadoCompleto] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [comunicadosUnreadCount, setComunicadosUnreadCount] = useState(0);
  const [documentosSolicitadosCount, setDocumentosSolicitadosCount] = useState(0);
  const [documentosPRLPendientesCount, setDocumentosPRLPendientesCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bannerStatusLoading, setBannerStatusLoading] = useState(true);

  // Skeleton UI pentru percepție rapidă de încărcare
  const renderSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <div className="p-6 flex flex-col md:flex-row md:items-start gap-6">
          <div className="h-28 w-28 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-64 bg-gray-200 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );

  // Extrage informațiile corecte din obiectul user (memoizat pentru a evita re-render-uri)
  // Extract user name fields for dependency tracking
  const userNombre = user?.['NOMBRE / APELLIDOS'];
  const userNombreApellidos = user?.NOMBRE_APELLIDOS;
  const userEmpleadoNombre = user?.empleadoNombre;
  const userNameField = user?.name;
  const userEmail = user?.email;
  const userCorreoElectronico = user?.CORREO_ELECTRONICO;
  
  const userName = useMemo(() => 
    userNombre || 
    userNombreApellidos || 
    userEmpleadoNombre ||
    userNameField || 
    userEmail || 
    userCorreoElectronico || 
    'Utilizator',
    [userNombre, userNombreApellidos, userEmpleadoNombre, userNameField, userEmail, userCorreoElectronico]
  );
  
  // Debug: log pentru a vedea ce câmpuri există (doar o dată când user se schimbă)
  useEffect(() => {
    if (user) {
      console.log('🔍 [Dashboard] User object keys:', Object.keys(user));
      console.log('🔍 [Dashboard] NOMBRE / APELLIDOS:', user['NOMBRE / APELLIDOS']);
      console.log('🔍 [Dashboard] NOMBRE_APELLIDOS:', user.NOMBRE_APELLIDOS);
      console.log('🔍 [Dashboard] empleadoNombre:', user.empleadoNombre);
      console.log('🔍 [Dashboard] Final userName:', userName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.CODIGO, user?.email]); // Intentionally only track CODIGO and email to avoid excessive re-renders
  
  const userGrupo = useMemo(() => user?.GRUPO || user?.grupo || 'Empleado', [user?.GRUPO, user?.grupo]);
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = useMemo(() => user?.isManager || false, [user?.isManager]);
  const isAdmin = useMemo(() => user?.GRUPO === 'Admin' || user?.grupo === 'Admin', [user?.GRUPO, user?.grupo]);
  const isDeveloper = useMemo(() => user?.GRUPO === 'Developer' || user?.grupo === 'Developer', [user?.GRUPO, user?.grupo]);

  // Funcție helper pentru a găsi cheia corectă în permisiuni bazat pe numele grupului
  const findGrupoKey = useCallback((grupo, permissions) => {
    if (!grupo || !permissions) return null;
    
    const grupoStr = String(grupo).trim();
    
    // 1. Încearcă match exact
    if (permissions[grupoStr]) {
      return grupoStr;
    }
    
    // 2. Încearcă match case-insensitive
    const exactMatch = Object.keys(permissions).find(key => 
      key.toLowerCase() === grupoStr.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch;
    }
    
    // 3. Pentru grupuri compuse (ex: "Auxiliar De Servicios - C"), 
    // backend-ul returnează doar primul cuvânt (ex: "Auxiliar")
    // Extrage primul cuvânt și încearcă să găsească match
    const firstWord = grupoStr.split(/\s+/)[0];
    if (permissions[firstWord]) {
      return firstWord;
    }
    
    // 4. Caută match parțial (dacă grupul conține un cuvânt cheie)
    const partialMatch = Object.keys(permissions).find(key => {
      const keyLower = key.toLowerCase();
      const grupoLower = grupoStr.toLowerCase();
      return grupoLower.includes(keyLower) || keyLower.includes(grupoLower);
    });
    if (partialMatch) {
      return partialMatch;
    }
    
    // 5. Pentru grupuri care conțin "Auxiliar", "Manager", "Administrativ", etc., caută după cuvântul cheie
    const keywords = ['Administrativ', 'Auxiliar', 'Manager', 'Supervisor', 'Admin', 'Developer', 'Operario', 'Empleado'];
    for (const keyword of keywords) {
      // Verifică dacă grupul conține keyword-ul (case-insensitive)
      if (grupoStr.toLowerCase().includes(keyword.toLowerCase())) {
        // Încearcă match exact pentru keyword
        if (permissions[keyword]) {
          return keyword;
        }
        // Caută și variante (case-insensitive)
        const keywordMatch = Object.keys(permissions).find(key => 
          key.toLowerCase() === keyword.toLowerCase() ||
          key.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(key.toLowerCase())
        );
        if (keywordMatch) {
          return keywordMatch;
        }
      }
    }
    
    // 6. Ultimă încercare: caută orice cheie care se potrivește parțial cu numele grupului
    const finalMatch = Object.keys(permissions).find(key => {
      const keyLower = key.toLowerCase();
      const grupoLower = grupoStr.toLowerCase();
      // Verifică dacă cheia este conținută în numele grupului sau invers
      return grupoLower.includes(keyLower) || keyLower.includes(grupoLower);
    });
    if (finalMatch) {
      return finalMatch;
    }
    
    return null;
  }, []);

  // Funcție helper pentru a verifica permisiunile din backend
  const hasPermission = useCallback((module) => {
    if (!userPermissions || !userGrupo) {
      console.log('⚠️ DashboardPage: Missing userPermissions or userGrupo');
      return false;
    }
    
    // Găsește cheia corectă pentru grupul utilizatorului
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    
    if (!grupoKey) {
      console.warn('⚠️ DashboardPage: No matching grupo key found for:', userGrupo, 'Available keys:', Object.keys(userPermissions));
      return false;
    }
    
    const grupoPermissions = userPermissions[grupoKey];
    if (!grupoPermissions) {
      console.warn('⚠️ DashboardPage: No permissions found for grupo key:', grupoKey);
      return false;
    }
    
    // DEBUG: Log toate permisiunile pentru acest grup
    if (module === 'datos' || module === 'dashboard' || module.includes('pedidos')) {
      console.log(`🔍 [DashboardPage] All permissions for grupo "${grupoKey}":`, grupoPermissions);
      console.log(`🔍 [DashboardPage] Checking module "${module}":`, grupoPermissions[module], 'type:', typeof grupoPermissions[module]);
    }
    
    // Returnează permisiunea pentru modulul specificat
    const hasAccess = grupoPermissions[module] === true;
    // Log pentru toate modulele pedidos
    if (module.includes('pedidos') || module === 'admin' || module === 'empleados' || hasAccess) {
      console.log(`🔐 DashboardPage: Checking permission for grupo "${userGrupo}" (key: "${grupoKey}"), module "${module}":`, hasAccess, {
        module,
        grupoPermissions: {
          ...grupoPermissions,
          // Log explicit pentru pedidos
          'pedidos-empleados': grupoPermissions['pedidos-empleados'],
          'pedidos-admin': grupoPermissions['pedidos-admin'],
          pedidos: grupoPermissions.pedidos,
        },
        allKeys: Object.keys(grupoPermissions),
      });
    }
    return hasAccess;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Calculează accesul la pedidos (după definirea funcțiilor helper)
  const pedidosAccess = useMemo(() => {
    const empleado = empleadoCompleto || user || {};
    const grupo = empleado?.GRUPO || user?.GRUPO;

    // 🔍 LOG: Datele din DatosEmpleados
    console.log('🔍 [DashboardPage] ===== PEDIDOS ACCESS DEBUG =====');
    console.log('📋 [DashboardPage] User object (DatosEmpleados):', {
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
      PEDIDOS_HABILITADO: empleado?.PEDIDOS_HABILITADO,
      HABILITADO_PEDIDOS: empleado?.HABILITADO_PEDIDOS,
      PEDIDOS_ACTIVO: empleado?.PEDIDOS_ACTIVO,
      ACTIVO_PEDIDOS: empleado?.ACTIVO_PEDIDOS,
      DerechoPedidos: empleado?.DerechoPedidos,
      derechoPedidos: empleado?.derechoPedidos,
      derecho_pedidos: empleado?.derecho_pedidos,
      // Toate câmpurile care conțin "pedido"
      allPedidoFields: Object.keys(empleado || {}).filter(key => 
        key.toLowerCase().includes('pedido')
      ).reduce((acc, key) => {
        acc[key] = empleado[key];
        return acc;
      }, {}),
    });
    
    // 🔍 LOG: Datele din Permisos
    console.log('🔐 [DashboardPage] Permissions object (Permisos table):', {
      userPermissions,
      loadingPermissions,
      userGrupo,
      hasBackendPermissions: userPermissions && Object.keys(userPermissions).length > 0,
      permissionsKeys: userPermissions ? Object.keys(userPermissions) : [],
    });

    const checkField = (value) => {
      if (!value) return false;
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
      if (typeof normalized === 'boolean') {
        return normalized;
      }
      if (typeof normalized === 'number') {
        return normalized === 1;
      }
      if (typeof normalized === 'string') {
        return ['s', 'si', 'sí', '1', 'y', 'yes', 'true'].includes(normalized);
      }
      return false;
    };

    const pedidosFields = [
      'derechopedido',
      'DERECHO_PEDIDO',
      'pedidos_permitido',
      'canMakePedidos',
      'PEDIDOS_PERMITIDO',
      'DERECHO_PEDIDOS',
      'PEDIDOS_ACCESO',
      'ACCESO_PEDIDOS',
      'PEDIDOS_HABILITADO',
      'HABILITADO_PEDIDOS',
      'PEDIDOS_ACTIVO',
      'ACTIVO_PEDIDOS',
      'DerechoPedidos',
      'derechoPedidos',
      'derecho_pedidos',
    ];

    const hasFieldPermission = pedidosFields.some((field) =>
      checkField(empleado?.[field]),
    );

    const hasGenericPermission = Object.keys(empleado || {}).some(
      (key) =>
        key.toLowerCase().includes('pedido') && checkField(empleado[key]),
    );

    const hasSpecialAccess = isManager || isAdmin || isDeveloper;

    // ✅ Verifică permisiunile din backend (permissos)
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;
    
    // ✅ ACTUALIZAT: Verifică ambele tipuri de permisiuni pedidos
    // pedidos-empleados = acces limitat (doar Nuevo Pedido, doar centrul lor)
    // pedidos-admin = acces complet (toate tab-urile, toate comunitățile)
    const hasDashboardPermission = shouldUseBackend ? hasPermission('dashboard') : false;
    const hasPedidosEmpleadosPermission = shouldUseBackend ? hasPermission('pedidos-empleados') : false;
    const hasPedidosAdminPermission = shouldUseBackend ? hasPermission('pedidos-admin') : false;
    
    // Fallback: verifică și permisiunea veche 'pedidos' (pentru compatibilitate)
    const hasPedidosPermissionOld = shouldUseBackend ? hasPermission('pedidos') : false;
    
    // Dacă are 'dashboard', verifică individual (din DatosEmpleados) - DOAR pentru fallback strict
    const hasIndividualPedidosAccess = hasDashboardPermission && (hasFieldPermission || hasGenericPermission);
    
    // ✅ CORECTAT: Acces complet dacă are 'pedidos-admin' SAU permisiunea veche 'pedidos'
    // Acces limitat dacă are 'pedidos-empleados' ȘI verifică și DerechoPedidos din DatosEmpleados
    // NU mai folosim hasIndividualPedidosAccess aici - doar pentru fallback strict
    const hasBackendPedidosPermission = hasPedidosAdminPermission || hasPedidosPermissionOld;
    
    // ✅ ACTUALIZAT: Verifică dacă are permisiune în matrix (pentru a afișa link-ul)
    // Link-ul apare dacă are permisiune în matrix, dar este enabled doar dacă are și DerechoPedidos
    const hasMatrixPedidosEmpleadosPermission = hasPedidosEmpleadosPermission; // Doar permisiunea din matrix
    const hasBackendPedidosEmpleadosPermission = hasPedidosEmpleadosPermission && (hasFieldPermission || hasGenericPermission); // Matrix + DerechoPedidos
    
    // ✅ ACTUALIZAT: Link-ul apare dacă are permisiune în matrix (pentru pedidos-empleados sau pedidos-admin)
    // Link-ul este enabled (canAccess = true) doar dacă are și DerechoPedidos: SI
    const hasAnyMatrixPedidosPermission = hasPedidosAdminPermission || hasPedidosPermissionOld || hasMatrixPedidosEmpleadosPermission;
    
    // 🔍 LOG: Rezultatele verificărilor
    const grupoKey = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) : null;
    const grupoPermissions = grupoKey && userPermissions ? userPermissions[grupoKey] : null;
    console.log('🔍 [DashboardPage] Permission checks:', {
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
        'pedidos-empleados': grupoPermissions['pedidos-empleados'],
        'pedidos-admin': grupoPermissions['pedidos-admin'],
        pedidos: grupoPermissions.pedidos, // Fallback pentru compatibilitate
        dashboard: grupoPermissions.dashboard,
        // Toate cheile disponibile
        allKeys: Object.keys(grupoPermissions),
      } : null,
      shouldUseBackend,
      hasDashboardPermission,
      hasPedidosEmpleadosPermission,
      hasPedidosAdminPermission,
      hasPedidosPermissionOld,
      hasIndividualPedidosAccess,
      hasBackendPedidosPermission,
      hasMatrixPedidosEmpleadosPermission,
      hasBackendPedidosEmpleadosPermission,
      hasAnyMatrixPedidosPermission,
      hasFieldPermission,
      hasGenericPermission,
      // Log pentru verificarea combinată
      pedidosEmpleadosCheck: {
        hasMatrixPermission: hasPedidosEmpleadosPermission,
        hasDerechoPedidos: hasFieldPermission || hasGenericPermission,
        finalResult: hasPedidosEmpleadosPermission && (hasFieldPermission || hasGenericPermission),
      },
      backendSystemExists: userPermissions !== null || loadingPermissions === true,
    });

    // ✅ CORECTAT STRICT: Pentru angajații normali, verificăm DOAR permisiunile din backend
    // Managerii/Adminii/Developerii au acces complet (hasSpecialAccess)
    // Fallback-ul este doar pentru cazuri în care sistemul de permisiuni backend nu există deloc
    // (de exemplu, dacă userPermissions este null și loadingPermissions este false - sistemul nu a încercat să încarce permisiuni)
    const backendSystemExists = userPermissions !== null || loadingPermissions === true;
    
    const canAccess =
      hasSpecialAccess || // Manager/Admin/Developer au acces complet
      hasBackendPedidosPermission || // Sau au permisiunea 'pedidos-admin' sau 'pedidos' (veche) în backend
      hasBackendPedidosEmpleadosPermission || // Sau au permisiunea 'pedidos-empleados' în backend ȘI DerechoPedidos: SI
      (!backendSystemExists && hasIndividualPedidosAccess) || // Fallback STRICT: doar dacă sistemul de permisiuni backend nu există deloc (dashboard + DerechoPedidos)
      (!backendSystemExists && hasFieldPermission) || // Fallback STRICT: doar dacă sistemul de permisiuni backend nu există deloc
      (!backendSystemExists && hasGenericPermission); // Fallback STRICT: doar dacă sistemul de permisiuni backend nu există deloc

    // 🔍 LOG: Rezultatul final cu toate valorile
    console.log('✅ [DashboardPage] Final decision - ALL VALUES:', {
      // Valori individuale
      hasSpecialAccess,
      hasPedidosAdminPermission,
      hasPedidosEmpleadosPermission,
      hasPedidosPermissionOld,
      hasBackendPedidosPermission,
      hasBackendPedidosEmpleadosPermission,
      backendSystemExists,
      hasIndividualPedidosAccess,
      hasFieldPermission,
      hasGenericPermission,
      // Calculul final
      canAccess,
      // Breakdown al calculului
      canAccessBreakdown: {
        fromSpecialAccess: hasSpecialAccess,
        fromPedidosAdmin: hasBackendPedidosPermission,
        fromPedidosEmpleados: hasBackendPedidosEmpleadosPermission,
        fromFallbackIndividual: !backendSystemExists && hasIndividualPedidosAccess,
        fromFallbackField: !backendSystemExists && hasFieldPermission,
        fromFallbackGeneric: !backendSystemExists && hasGenericPermission,
      },
      reason: hasSpecialAccess ? 'hasSpecialAccess (Manager/Admin/Developer)' :
               hasPedidosAdminPermission ? 'hasPedidosAdminPermission (permisiune pedidos-admin pe grup)' :
               hasPedidosPermissionOld ? 'hasPedidosPermissionOld (permisiune pedidos veche - compatibilitate)' :
               hasBackendPedidosEmpleadosPermission ? 'hasBackendPedidosEmpleadosPermission (pedidos-empleados în matrix ȘI DerechoPedidos: SI în DatosEmpleados)' :
               (!backendSystemExists && hasIndividualPedidosAccess) ? 'Fallback STRICT: hasIndividualPedidosAccess (dashboard + DerechoPedidos - sistem backend nu există)' :
               (!backendSystemExists && hasFieldPermission) ? 'Fallback STRICT: hasFieldPermission (câmpuri în DatosEmpleados - sistem backend nu există)' :
               (!backendSystemExists && hasGenericPermission) ? 'Fallback STRICT: hasGenericPermission (câmpuri generice - sistem backend nu există)' :
               'NO ACCESS',
      href: (hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld) ? '/pedidos' : 
            (hasBackendPedidosEmpleadosPermission ? '/empleado-pedidos' : null),
      role: (hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld) ? 'manager' : 
            (hasBackendPedidosEmpleadosPermission ? 'empleado' : undefined),
    });
    console.log('🔍 [DashboardPage] ===== END PEDIDOS ACCESS DEBUG =====\n');

    const hint = (hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld)
      ? 'Gestionar pedidos y permisos de productos'
      : hasBackendPedidosEmpleadosPermission
        ? 'Crear nuevos pedidos'
        : canAccess
          ? 'Crear nuevos pedidos'
          : 'No tienes permisos para crear pedidos';

    // ✅ ACTUALIZAT: Link-ul apare dacă are permisiune în matrix, dar este enabled doar dacă are și DerechoPedidos
    // hasAnyMatrixPedidosPermission = link-ul apare (enabled sau disabled)
    // canAccess = link-ul este enabled (colorat, funcțional)
    return {
      canAccess, // canAccess = true dacă are permisiune în matrix ȘI DerechoPedidos: SI
      hasAnyMatrixPermission: hasAnyMatrixPedidosPermission, // Link-ul apare dacă are permisiune în matrix (chiar dacă nu are DerechoPedidos)
      hint,
      href: (hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld) ? '/pedidos' : 
            (hasBackendPedidosEmpleadosPermission ? '/empleado-pedidos' : null),
      role: (hasSpecialAccess || hasPedidosAdminPermission || hasPedidosPermissionOld) ? 'manager' : 
            (hasBackendPedidosEmpleadosPermission ? 'empleado' : undefined),
    };
  }, [empleadoCompleto, user, isManager, isAdmin, isDeveloper, userPermissions, loadingPermissions, userGrupo, findGrupoKey, hasPermission]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || user?.isDemo) {
        setLoadingPermissions(false);
        return;
      }

      // Nu blocăm UI; marcăm loading false imediat și populăm când sosesc
      setLoadingPermissions(false);
      try {
        console.log('🔐 DashboardPage: Loading permissions for grupo (non-blocking):', userGrupo);
        const permissions = await getPermissions(userGrupo);
        console.log('✅ DashboardPage: Permissions loaded:', permissions);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('❌ DashboardPage: Error loading permissions:', error);
        setUserPermissions(null);
      }
    };

    loadPermissions();
  }, [userGrupo, user?.isDemo, getPermissions]);

  // Obține numărul de solicitări de documente
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

        // Dacă endpoint-ul nu există sau dacă e eroare 404/500, nu aruncăm eroare
        if (response.status === 404 || response.status === 500) {
          // Endpoint nu există încă sau eroare de server - nu afișăm badge
          setDocumentosSolicitadosCount(0);
          return;
        }

        if (!response.ok) {
          // Pentru alte erori, logăm dar nu aruncăm
          console.warn(`Warning: Error HTTP ${response.status} al obtener documentos solicitados`);
          setDocumentosSolicitadosCount(0);
          return;
        }

        const data = await response.json();
        
        if (data.success && data.data && Array.isArray(data.data)) {
          // Filtrează doar cererile pendiente
          const pendientes = data.data.filter((s) => s.estado === 'pendiente');
          setDocumentosSolicitadosCount(pendientes.length);
        } else {
          setDocumentosSolicitadosCount(0);
        }
      } catch (error) {
        // Nu logăm ca eroare critică - doar ca warning
        console.warn('Warning: Error obteniendo documentos solicitados:', error);
        setDocumentosSolicitadosCount(0);
      }
    };

    fetchDocumentosSolicitadosCount();
    
    // Reîncarcă la fiecare 60 de secunde pentru a actualiza badge-ul (optimizat pentru a reduce traficul)
    // Oprește polling-ul când tab-ul nu este activ
    let interval = null;
    const startPolling = () => {
      if (document.hidden) return; // Nu face polling când tab-ul este inactiv
      interval = setInterval(() => {
        if (!document.hidden) { // Verifică din nou înainte de fiecare request
          fetchDocumentosSolicitadosCount();
        }
      }, 60000); // 60 secunde în loc de 30
    };
    
    startPolling();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        fetchDocumentosSolicitadosCount(); // Reîncarcă imediat când tab-ul devine activ
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.CODIGO, user?.isDemo]);

  // Fetch documente PRL pendiente pentru badge
  useEffect(() => {
    const fetchDocumentosPRLPendientesCount = async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setDocumentosPRLPendientesCount(0);
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.prlMisDocumentos, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        // Dacă endpoint-ul nu există sau dacă e eroare 404/500, nu aruncăm eroare
        if (response.status === 404 || response.status === 500) {
          setDocumentosPRLPendientesCount(0);
          return;
        }

        if (!response.ok) {
          console.warn(`Warning: Error HTTP ${response.status} al obtener documentos PRL`);
          setDocumentosPRLPendientesCount(0);
          return;
        }

        const data = await response.json();
        
        if (data.success && data.documentos && Array.isArray(data.documentos)) {
          // Filtrează doar documentele pendiente care necesită semnătură
          const pendientes = data.documentos.filter(
            (d) => d.estado === 'PENDIENTE' && d.requiere_firma
          );
          setDocumentosPRLPendientesCount(pendientes.length);
        } else {
          setDocumentosPRLPendientesCount(0);
        }
      } catch (error) {
        console.warn('Warning: Error obteniendo documentos PRL pendientes:', error);
        setDocumentosPRLPendientesCount(0);
      }
    };

    // Debounce pentru a evita request-uri duplicate
    let timeoutId = null;
    const debouncedFetch = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchDocumentosPRLPendientesCount();
      }, 100); // Așteaptă 100ms înainte de a face request-ul
    };
    
    debouncedFetch();
    
    // Reîncarcă la fiecare 60 de secunde pentru a actualiza badge-ul
    let interval = null;
    const startPolling = () => {
      if (document.hidden) return;
      interval = setInterval(() => {
        if (!document.hidden) {
          debouncedFetch();
        }
      }, 60000); // 60 secunde
    };
    
    startPolling();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
        if (timeoutId) clearTimeout(timeoutId);
      } else {
        debouncedFetch();
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.CODIGO, user?.isDemo]);

  const quickAccessItems = useMemo(() => {
    // Dacă permisiunile nu sunt încă încărcate, folosim verificările hardcodate ca fallback
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
    
    // Verifică dacă există permisiuni pentru grupul utilizatorului în backend
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    
    // Log doar când se schimbă ceva relevant (nu la fiecare render)
    if (useBackendPermissions || grupoKeyExists) {
      console.log('🔐 DashboardPage: Building menu items.');
      console.log('  - useBackendPermissions:', useBackendPermissions);
      console.log('  - userGrupo:', userGrupo);
      console.log('  - grupoKeyExists:', grupoKeyExists);
      console.log('  - userPermissions keys:', userPermissions ? Object.keys(userPermissions) : 'null');
    }
    
    const list = [];
    
    // Elemente de bază - verifică permisiunile din backend sau folosește fallback
    // Dacă folosim permisiunile din backend și grupul există, verificăm DOAR permisiunile din backend
    // Dacă nu folosim permisiunile din backend sau grupul nu există, folosim fallback-ul
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;
    
    // Fiecare buton necesită permisiunea sa specifică - "dashboard" nu mai acordă acces la toate funcționalitățile
    const canAccessDatos = shouldUseBackend ? hasPermission('datos') : true;
    // Pentru fichar, verifică ambele variante (empleados și admin)
    const canAccessFichar = shouldUseBackend 
      ? (hasPermission('fichar-empleados') || hasPermission('fichar-admin'))
      : true;
    // Pentru solicitudes, verifică ambele variante (empleados și admin), similar cu pedidos
    const canAccessSolicitudes = shouldUseBackend 
      ? (hasPermission('solicitudes-empleados') || hasPermission('solicitudes-admin') || hasPermission('solicitudes'))
      : true;
    const canAccessDocumentos = shouldUseBackend ? hasPermission('documentos') : true; // Documentos necesită permisiune explicită
    // Pentru cuadrantes-empleado, folosim DOAR permisiunile din backend (fără fallback)
    const canAccessCuadrantesEmpleado = hasBackendPermissions ? hasPermission('cuadrantes-empleado') : false;
    // Pentru mis-inspecciones, folosim DOAR permisiunile din backend (fără fallback)
    const canAccessMisInspecciones = hasBackendPermissions ? hasPermission('mis-inspecciones') : false;
    // Pentru comunicados, folosim DOAR permisiunile din backend (fără fallback)
    const canAccessComunicados = hasBackendPermissions ? hasPermission('comunicados') : false;

    if (canAccessDatos) {
      list.push({
        id: 'datos-personales',
        label: 'Datos personales',
        hint: 'Información del empleado',
        icon: <UserCircle className="h-6 w-6 text-white" />,
        gradient: 'from-blue-500 via-sky-500 to-indigo-500',
        href: '/datos',
      });
    }

    if (canAccessFichar) {
      list.push({
        id: 'fichar',
        label: 'Registro de Jornada',
        hint: 'Control de horarios',
        icon: <Clock className="h-6 w-6 text-white" />,
        gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        href: '/fichaje',
      });
    }

    if (canAccessSolicitudes) {
      list.push({
        id: 'solicitudes',
        label: 'Solicitudes',
        hint: 'Gestionar peticiones',
        icon: <ClipboardList className="h-6 w-6 text-white" />,
        gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
        href: '/solicitudes',
      });
    }

    // Calculează totalul de notificări (documentos solicitados + PRL pendientes)
    const totalNotifications = documentosSolicitadosCount + documentosPRLPendientesCount;
    
    if (canAccessDocumentos) {
      list.push({
        id: 'documentos',
        label: 'Documentos',
        hint: 'Nóminas y archivos',
        icon: <FileText className="h-6 w-6 text-white" />,
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
        icon: <Calendar className="h-6 w-6 text-white" />,
        gradient: 'from-sky-500 via-blue-500 to-indigo-500',
        href: '/cuadrantes-empleado',
      });
    }

    if (canAccessMisInspecciones) {
      list.push({
        id: 'mis-inspecciones',
        label: 'Mis inspecciones',
        hint: 'Inspecciones asignadas',
        icon: <ClipboardCheck className="h-6 w-6 text-white" />,
        gradient: 'from-cyan-500 via-sky-500 to-blue-500',
        href: '/mis-inspecciones',
      });
    }

    if (canAccessComunicados) {
      list.push({
        id: 'comunicados',
        label: 'Comunicados',
        hint: 'Anuncios y comunicaciones oficiales',
        icon: <FileText className="h-6 w-6 text-white" />,
        gradient: 'from-green-500 via-emerald-500 to-teal-500',
        href: '/comunicados',
        notificationCount: comunicadosUnreadCount > 0 ? comunicadosUnreadCount : undefined,
      });
    }

    // Elemente pentru manager - verifică permisiunile din backend sau folosește fallback
    const canManageEmployees = shouldUseBackend ? hasPermission('empleados') : isManager;
    const canManageDocuments = shouldUseBackend ? hasPermission('documentos-empleados') : isManager;
    // Pentru cuadrantes, folosim DOAR permisiunile din backend (fără fallback)
    const canManageCuadrantes = hasBackendPermissions ? hasPermission('cuadrantes') : false;
    // Pentru aprobaciones, folosim DOAR permisiunile din backend (fără fallback)
    const canApprove = hasBackendPermissions ? hasPermission('aprobaciones') : false;
    // Pentru inspecciones, folosim DOAR permisiunile din backend (fără fallback)
    const canInspect = hasBackendPermissions ? hasPermission('inspecciones') : false;

    if (canManageEmployees) {
      list.push({
        id: 'gestionar-empleados',
        label: 'Gestionar empleados',
        hint: 'Administrar equipo',
        icon: <Users className="h-6 w-6 text-white" />,
        gradient: 'from-indigo-500 via-violet-500 to-purple-500',
        href: '/empleados',
        role: 'manager',
      });
    }

    if ((!useBackendPermissions && isManager) || canManageDocuments) {
      list.push({
        id: 'documentos-empleados',
        label: 'Documentos empleados',
        hint: 'Archivos por empleado',
        icon: <Folder className="h-6 w-6 text-white" />,
        gradient: 'from-teal-500 via-cyan-500 to-sky-500',
        href: '/documentos-empleados',
        role: 'manager',
      });
    }

    // PRL Documentos - doar pentru manageri/admini
    if ((!useBackendPermissions && isManager) || canManageDocuments) {
      list.push({
        id: 'prl-documentos',
        label: 'Documentos PRL',
        hint: 'Gestión documentos PRL por puesto',
        icon: <ShieldCheck className="h-6 w-6 text-white" />,
        gradient: 'from-red-500 via-rose-500 to-pink-500',
        href: '/prl-documentos',
        role: 'manager',
      });
    }

    if (canManageCuadrantes) {
      list.push({
        id: 'cuadrantes',
        label: 'Cuadrantes',
        hint: 'Gestión de horarios del equipo',
        icon: <Calendar className="h-6 w-6 text-white" />,
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
        icon: <CheckCircle className="h-6 w-6 text-white" />,
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
        icon: <ClipboardCheck className="h-6 w-6 text-white" />,
        gradient: 'from-amber-500 via-orange-500 to-yellow-500',
        href: '/inspecciones',
        role: 'manager',
      });
    }

    // 🔍 DEBUG: Verifică valoarea exactă înainte de a adăuga link-ul
    console.log('🔍 [DashboardPage] Before adding Pedidos link:', {
      pedidosAccessCanAccess: pedidosAccess.canAccess,
      pedidosAccessHasAnyMatrixPermission: pedidosAccess.hasAnyMatrixPermission,
      pedidosAccess: pedidosAccess,
      willAddEnabled: pedidosAccess.canAccess,
      willAddDisabled: pedidosAccess.hasAnyMatrixPermission && !pedidosAccess.canAccess,
      willNotAdd: !pedidosAccess.hasAnyMatrixPermission,
    });
    
    // ✅ ACTUALIZAT: Link-ul apare dacă are permisiune în matrix
    // Este enabled dacă are și DerechoPedidos: SI, disabled dacă nu are
    if (pedidosAccess.hasAnyMatrixPermission) {
      if (pedidosAccess.canAccess) {
        console.log('✅ [DashboardPage] Adding ENABLED Pedidos link (has matrix permission + DerechoPedidos)');
        list.push({
          id: 'pedidos',
          label: 'Pedidos',
          hint: pedidosAccess.hint,
          icon: <ShoppingCart className="h-6 w-6 text-white" />,
          gradient: 'from-amber-500 via-orange-500 to-yellow-500',
          href: pedidosAccess.href,
          role: pedidosAccess.role,
        });
      } else {
        console.log('⚠️ [DashboardPage] Adding DISABLED Pedidos link (has matrix permission but NO DerechoPedidos)');
        list.push({
          id: 'pedidos',
          label: 'Pedidos',
          hint: pedidosAccess.hint || 'No tienes permisos para crear pedidos',
          icon: <ShoppingCart className="h-6 w-6 text-white" />,
          gradient: 'from-amber-500 via-orange-500 to-yellow-500',
          disabled: true, // Link-ul apare dar este disabled (gri)
        });
      }
    } else {
      console.log('❌ [DashboardPage] NOT adding Pedidos link (no matrix permission)');
    }

    const canAccessAdmin = shouldUseBackend ? hasPermission('admin') : (isAdmin || isDeveloper);
    const canAccessStats = shouldUseBackend ? hasPermission('estadisticas') : (isAdmin || isDeveloper || user?.GRUPO === 'Supervisor');
    // Pentru clientes, folosim DOAR permisiunile din backend (fără fallback)
    const canAccessClientes = hasBackendPermissions ? hasPermission('clientes') : false;

    if (canAccessAdmin) {
      list.push({
        id: 'admin-panel',
        label: 'Admin Panel',
        hint: 'Control del sistema y estadísticas avanzadas',
        icon: <Settings className="h-6 w-6 text-white" />,
        gradient: 'from-slate-500 via-slate-600 to-slate-700',
        href: '/admin',
        role: 'manager',
      });
    }

    // Mensajes Enviados - doar pentru admini/developeri
    if (canAccessAdmin) {
      list.push({
        id: 'mensajes-enviados',
        label: 'Mensajes Enviados',
        hint: 'Gestiona y visualiza todos los mensajes enviados',
        icon: <Mail className="h-6 w-6 text-white" />,
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
        icon: <BarChart3 className="h-6 w-6 text-white" />,
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
        icon: <Users className="h-6 w-6 text-white" />,
        gradient: 'from-teal-500 via-cyan-500 to-sky-500',
        href: '/clientes',
        role: 'manager',
      });
    }

    // Salón de la Fama - verifică permisiunea din backend
    const canAccessHallOfFame = shouldUseBackend ? hasPermission('hall-of-fame') : true;
    
    if (canAccessHallOfFame) {
      list.push({
        id: 'hall-of-fame',
        label: 'Salón de la Fama',
        hint: 'Clasament lunar',
        icon: <Trophy className="h-6 w-6 text-white" />,
        gradient: 'from-yellow-400 via-amber-500 to-orange-500',
        href: '/hall-of-fame',
      });
    }

    return list;
  }, [
    isManager,
    pedidosAccess,
    isAdmin,
    isDeveloper,
    user?.GRUPO,
    userGrupo,
    userPermissions,
    loadingPermissions,
    hasPermission,
    findGrupoKey,
    comunicadosUnreadCount,
    documentosSolicitadosCount,
    documentosPRLPendientesCount,
  ]);

  // Încarcă datele complete despre angajat din backend (ca în DatosPage.jsx)
  const userCodigoRef = useRef(null);
  const userEmailRef = useRef(null);
  const empleadoCacheRef = useRef({ codigo: null, email: null, data: null, timestamp: 0 });
  const CACHE_DURATION = 60000; // 60 secunde cache
  const fetchingEmpleadoRef = useRef(false);
  
  useEffect(() => {
    // Verifică dacă s-a schimbat ceva relevant
    const codigoChanged = userCodigoRef.current !== user?.CODIGO;
    const emailChanged = userEmailRef.current !== user?.email;
    
    // Verifică cache-ul
    const now = Date.now();
    const cache = empleadoCacheRef.current;
    if (!codigoChanged && !emailChanged && empleadoCompleto) {
      // Nu s-a schimbat nimic relevant și avem deja date, skip
      return;
    }
    
    // Verifică cache-ul bazat pe timp
    if (cache.data && 
        (cache.codigo === user?.CODIGO || cache.email === user?.email) &&
        (now - cache.timestamp) < CACHE_DURATION) {
      // Folosește cache-ul
      setEmpleadoCompleto(cache.data);
      userCodigoRef.current = user?.CODIGO;
      userEmailRef.current = user?.email;
      return;
    }
    
    // Actualizează ref-urile
    userCodigoRef.current = user?.CODIGO;
    userEmailRef.current = user?.email;
    
    // Evită apeluri duplicate simultane
    if (fetchingEmpleadoRef.current) {
      return;
    }
    
    const fetchUser = async () => {
      try {
        // Prioritizează backend-ul nou (getEmpleadoMe) - folosește n8n (getEmpleados) doar dacă getEmpleadoMe nu există
        // Folosim DOAR backend-ul nou (getEmpleadoMe) - nu mai folosim n8n (getEmpleados) ca fallback
        // getEmpleadoMe este implementat în backend și ar trebui să fie întotdeauna disponibil
        const endpoint = routes.getEmpleadoMe;
        
        if (!endpoint) {
          console.error('❌ [Dashboard] routes.getEmpleadoMe nu este definit! Nu putem continua.');
          return;
        }
        
        console.log('✅ [Dashboard] Folosind backend-ul nou (getEmpleadoMe):', endpoint);

        // Adaugă token-ul JWT dacă există
        const headers = {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        };
        
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(endpoint, {
          headers
        });

        // Verifică dacă răspunsul este JSON valid
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const textResponse = await res.text();
          console.error('❌ [Dashboard] Server returned non-JSON response:', {
            status: res.status,
            contentType,
            response: textResponse.substring(0, 200) + '...'
          });
          throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON. Status: ${res.status}`);
        }

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        
        // Extrage utilizatorii din răspuns (suportă multiple formate)
        let users = [];
        if (Array.isArray(data)) {
          users = data;
        } else if (data?.empleado) {
          users = [data.empleado];
        } else if (data && Array.isArray(data.data)) {
          users = data.data;
        } else if (data && Array.isArray(data.body)) {
          users = data.body;
        } else if (data && Array.isArray(data.result)) {
          users = data.result;
        } else if (data && typeof data === 'object') {
          // Verifică dacă este un răspuns de tip "not-modified" sau alt mesaj de status
          if (data.status === 'not-modified' || data.status || data.message || data.error) {
            // Ignoră răspunsurile de status, nu sunt utilizatori
            users = [];
          } else if (data.CODIGO || data['CORREO ELECTRONICO'] || data.CORREO_ELECTRONICO) {
            // Este un singur obiect utilizator, îl punem într-un array
            users = [data];
          } else {
            users = [];
          }
        } else {
          users = [];
        }
        
        // Verifică dacă răspunsul este de tip "not-modified" (datele nu s-au schimbat)
        const isNotModified = data && typeof data === 'object' && data.status === 'not-modified';
        
        if (isNotModified) {
          // Răspuns valid - datele nu s-au schimbat, nu trebuie să facem nimic
          console.log('ℹ️ [Dashboard] Backend-ul a returnat "not-modified" - datele nu s-au schimbat');
          return; // Ieșim fără să schimbăm starea
        }
        
        // Filtrează doar obiectele care sunt utilizatori (au CODIGO sau CORREO ELECTRONICO)
        users = users.filter(u => 
          u && typeof u === 'object' && 
          (u.CODIGO || u['CORREO ELECTRONICO'] || u.CORREO_ELECTRONICO)
        );
        
        // Debug: log datele primite
        console.log('🔍 [Dashboard] Date primite de la backend:', {
          rawDataType: Array.isArray(data) ? 'array' : typeof data,
          rawDataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
          rawDataPreview: data && typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data,
          usersCount: users.length,
          userCODIGO: user?.CODIGO,
          userEmail: user?.email,
          firstUserKeys: users[0] ? Object.keys(users[0]) : [],
          firstUserPreview: users[0] ? JSON.stringify(users[0]).substring(0, 200) : null
        });
        
        // Caută angajatul curent logat în listă
        if (users.length > 0) {
          const empleadoCurent = users.find(emp => 
            emp.CODIGO === user?.CODIGO || 
            emp['CORREO ELECTRONICO'] === user?.email ||
            emp.CORREO_ELECTRONICO === user?.email
          );
          
          if (empleadoCurent) {
            console.log('✅ [Dashboard] Angajat găsit - DerechoPedidos:', empleadoCurent.DerechoPedidos);
            setEmpleadoCompleto(empleadoCurent);
            // Actualizează cache-ul
            empleadoCacheRef.current = {
              codigo: user?.CODIGO,
              email: user?.email,
              data: empleadoCurent,
              timestamp: Date.now(),
            };
          } else {
            console.warn('⚠️ [Dashboard] Angajatul curent nu a fost găsit în backend', {
              searchingFor: { CODIGO: user?.CODIGO, email: user?.email },
              availableUsers: users.map(u => ({ CODIGO: u.CODIGO, email: u['CORREO ELECTRONICO'] || u.CORREO_ELECTRONICO }))
            });
            // Nu resetăm empleadoCompleto dacă deja există (păstrăm datele existente)
            if (!empleadoCompleto) {
              setEmpleadoCompleto(null);
            }
          }
        } else {
          // Nu afișăm warning dacă nu avem utilizatori - poate fi un răspuns valid
          // Doar resetăm dacă nu avem deja date salvate
          if (!empleadoCompleto) {
            console.warn('⚠️ [Dashboard] Backend-ul nu a returnat niciun utilizator');
            setEmpleadoCompleto(null);
          }
        }
      } catch (error) {
        console.error('❌ [Dashboard] Error fetching empleado:', error);
      } finally {
        fetchingEmpleadoRef.current = false;
      }
    };
    
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.CODIGO, user?.email]); // Intentionally only track CODIGO and email, empleadoCompleto is set inside

  // Log pentru a vedea toate datele despre angajat din backend
  useEffect(() => {
    console.log('🔍 [Dashboard] User loaded - DerechoPedidos:', user?.DerechoPedidos);
  }, [user]);


  useEffect(() => {
    console.debug('[Dashboard] Checking monthly alerts for login');

    if (!user || user?.isDemo) {
      setMonthlyAlerts(null);
      setAlertNotification(null);
      setLoadingAlerts(false);
      alertsFetchedRef.current = { userId: null, month: null, fetched: false };
      return;
    }

    const month = getCurrentMonthKey();
    const cachedAlerts = getStoredMonthlyAlerts(month);

    if (cachedAlerts) {
      console.debug('[Dashboard] Found cached monthly alerts:', cachedAlerts);
      setMonthlyAlerts(cachedAlerts);
      if (cachedAlerts.total > 0) {
        setAlertNotification({
          type: 'warning',
          title: 'Alertas de horas mensuales',
          message: `Tienes ${cachedAlerts.total} días con alerta este mes (${cachedAlerts.positivos} con exceso y ${cachedAlerts.negativos} con déficit). Revisa el apartado Horas Trabajadas → Alertas.`
        });
      }
    } else {
      setMonthlyAlerts(null);
    }

    const empleadoId =
      empleadoCompleto?.CODIGO ||
      user?.empleadoId ||
      user?.CODIGO ||
      user?.codigo;

    const empleadoNombre =
      empleadoCompleto?.['NOMBRE / APELLIDOS'] ||
      user?.empleadoNombre ||
      user?.NOMBRE_APELLIDOS ||
      user?.['NOMBRE / APELLIDOS'] ||
      user?.name ||
      user?.CORREO_ELECTRONICO ||
      user?.email ||
      user?.CODIGO ||
      '';

    if (!empleadoId || !empleadoNombre) {
      console.debug('[Dashboard] Missing empleadoId or empleadoNombre. Skipping alert fetch.');
      return;
    }

    if (
      alertsFetchedRef.current.userId !== empleadoId ||
      alertsFetchedRef.current.month !== month
    ) {
      alertsFetchedRef.current = { userId: empleadoId, month, fetched: false };
    }

    if (alertsFetchedRef.current.fetched) {
      console.debug('[Dashboard] Alerts already fetched for this user/month. Skipping.');
      return;
    }

    setLoadingAlerts(true);
    console.debug('[Dashboard] Fetching monthly alerts from server', { empleadoId, empleadoNombre, month });

    (async () => {
      try {
        const { data, summary } = await fetchMonthlyAlertsData({
          empleadoId,
          empleadoNombre,
          month
        });

        console.debug('[Dashboard] Raw alerts data:', data);
        if (data) {
          const normalized = normalizeDetalles(data);
          console.debug('[Dashboard] Normalized detalles:', normalized);
          if (Array.isArray(normalized) && normalized.length > 0) {
            console.debug('[Dashboard] First detalle keys:', Object.keys(normalized[0] || {}));
            console.debug('[Dashboard] First detalle item:', normalized[0]);
          }
        }

        if (!summary) {
          console.debug('[Dashboard] No summary returned. Using empty defaults.');
          setMonthlyAlerts({ total: 0, positivos: 0, negativos: 0 });
          setAlertNotification(null);
          return;
        }

        console.debug('[Dashboard] Alerts summary received:', summary);
        setMonthlyAlerts(summary);

        if (summary.total > 0 && !isMonthlyAlertsNotified(month)) {
          setAlertNotification({
            type: 'warning',
            title: 'Alertas de horas mensuales',
            message: `Tienes ${summary.total} días con alerta este mes (${summary.positivos} con exceso y ${summary.negativos} con déficit). Revisa el apartado Horas Trabajadas → Alertas.`
          });
          markMonthlyAlertsNotified(month);
          console.debug('[Dashboard] Alert notification triggered for user.');
        } else if (summary.total === 0) {
          setAlertNotification(null);
          console.debug('[Dashboard] No alerts found for user.');
        }
      } catch (error) {
        console.error('❌ [Dashboard] Error obteniendo alertas mensuales:', error);
      } finally {
        setLoadingAlerts(false);
        alertsFetchedRef.current.fetched = true;
        console.debug('[Dashboard] Alert fetch completed.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.CODIGO, user?.isDemo, empleadoCompleto?.CODIGO]); // Intentionally limited dependencies to avoid excessive re-fetches

  // Cargar avatar existente - folosind backend nou (GET /api/avatar/me)
  const loadExistingAvatar = useCallback(async () => {
    if (!user?.CODIGO) return;
    
    // Evitar fetch-uri multiple pentru același user
    if (avatarLoadedRef.current && currentUserIdRef.current === user?.CODIGO) {
      console.log('🔄 [Inicio] Avatar ya cargado para este usuario, saltando (cache en memoria).');
      return;
    }

    setLoadingAvatar(true);
    currentUserIdRef.current = user?.CODIGO;

    try {
      // 1) Verifică cache local
      const cachedPayload = getCachedAvatar(user.CODIGO);
      const cachedUrl = cachedPayload?.url || cachedPayload || null;
      if (cachedUrl) {
        setAvatarUrl(cachedUrl);
        avatarLoadedRef.current = true;
        console.log('✅ [Inicio] Avatar tomado din cache (localStorage).');
        return;
      }

      // 2) Fetch din backend nou (GET /api/avatar/me)
      const token = localStorage.getItem('auth_token');
      const headers = {
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const endpoint = routes.getAvatarMe || routes.getAvatar;
      console.log('🔍 [Dashboard] Fetching avatar:', {
        endpoint,
        hasToken: !!token,
        tokenLength: token?.length || 0
      });
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        cache: 'no-store', // Forțează request fresh, fără cache
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('ℹ️ [Inicio] No se encontró avatar para este usuario.');
          setAvatarUrl(DEFAULT_AVATAR);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.AVATAR_B64) {
        const avatarUrl = `data:image/jpeg;base64,${data.AVATAR_B64.replace(/\n/g, '')}`;
        setAvatarUrl(avatarUrl);
        setCachedAvatar(user.CODIGO, avatarUrl, user?.avatarVersion || Date.now());
        console.log('✅ [Inicio] Avatar obtinut și salvat în cache.');
      } else {
        console.log('ℹ️ [Inicio] No se encontró avatar para este usuario.');
        setAvatarUrl(DEFAULT_AVATAR);
      }
    } catch (error) {
      console.error('❌ [Inicio] Error cargando avatar (con cache):', error);
      setAvatarUrl((prev) => prev || DEFAULT_AVATAR);
    } finally {
      setLoadingAvatar(false);
      avatarLoadedRef.current = true;
    }
  }, [user?.CODIGO, user?.avatarVersion]);

  // Cargar avatar al montar el componente
  useEffect(() => {
    if (user?.CODIGO && !user?.isDemo) {
      loadExistingAvatar();
    }
  }, [loadExistingAvatar, user?.CODIGO, user?.isDemo]);

  // UI ready fallback: afișează skeleton după max 700ms chiar dacă fetch-urile rulează
  useEffect(() => {
    const timeout = setTimeout(() => setUiReady(true), 700);
    return () => clearTimeout(timeout);
  }, []);

  // Dacă nu mai încărcăm datele principale, marcăm UI ready mai devreme
  useEffect(() => {
    if (!loadingAvatar && !loadingAlerts) {
      setUiReady(true);
    }
  }, [loadingAvatar, loadingAlerts]);

  // Obține numărul de comunicados necitite
  useEffect(() => {
    if (!user?.userId && !user?.CODIGO) return;

    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setComunicadosUnreadCount(count);
      } catch (err) {
        console.error('[Dashboard] Error loading unread comunicados count:', err);
        setComunicadosUnreadCount(0);
      }
    };

    // Debounce pentru a evita request-uri duplicate
    let timeoutId = null;
    const debouncedLoad = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadUnreadCount();
      }, 100); // Așteaptă 100ms înainte de a face request-ul
    };
    
    debouncedLoad();
    // Reîncarcă la fiecare 60 de secunde pentru a actualiza badge-ul (optimizat pentru a reduce traficul)
    // Oprește polling-ul când tab-ul nu este activ
    let interval = null;
    const startPolling = () => {
      if (document.hidden) return; // Nu face polling când tab-ul este inactiv
      interval = setInterval(() => {
        if (!document.hidden) { // Verifică din nou înainte de fiecare request
          debouncedLoad();
        }
      }, 60000); // 60 secunde în loc de 30
    };
    
    startPolling();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
        if (timeoutId) clearTimeout(timeoutId);
      } else {
        debouncedLoad(); // Reîncarcă imediat când tab-ul devine activ
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.userId, user?.CODIGO, getUnreadCount]);

  // Watchdog + logging pentru state-urile de gating
  useEffect(() => {
    console.info('[Inicio] gating states', {
      uiReady,
      loadingAvatar,
      loadingAlerts,
      loadingPermissions,
      hasUser: !!user,
    });
    const watchdog = setTimeout(() => {
      if (!uiReady) {
        console.warn('[Inicio] watchdog forcing uiReady=true (timeout fallback)');
        setUiReady(true);
      }
    }, 1200);
    return () => clearTimeout(watchdog);
  }, [uiReady, loadingAvatar, loadingAlerts, loadingPermissions, user]);

  // Verifică starea banner-ului din baza de date
  useEffect(() => {
    const checkBannerStatus = async () => {
      if (!user) {
        setBannerStatusLoading(false);
        return;
      }

      try {
        const baseUrl = import.meta.env.DEV 
          ? 'http://localhost:3000' 
          : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
        const token = localStorage.getItem('auth_token');
        
        const userEmail = user.email || user.CORREO_ELECTRONICO;
        const userCodigo = user.CODIGO || user.codigo;

        if (!userEmail && !userCodigo) {
          setBannerStatusLoading(false);
          return;
        }

        const queryParams = new URLSearchParams();
        if (userEmail) queryParams.append('email', userEmail);
        if (userCodigo) queryParams.append('codigo', userCodigo);

        const response = await fetch(`${baseUrl}/api/monitoring/banner-baja-medica-status?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBannerDismissed(data.dismissed || false);
        } else {
          // Dacă eșuează, folosește localStorage ca fallback
          const localDismissed = localStorage.getItem('bajaMedicaBannerDismissed') === 'true';
          setBannerDismissed(localDismissed);
        }
      } catch (error) {
        console.error('Error checking banner status:', error);
        // Fallback la localStorage
        const localDismissed = localStorage.getItem('bajaMedicaBannerDismissed') === 'true';
        setBannerDismissed(localDismissed);
      } finally {
        setBannerStatusLoading(false);
      }
    };

    checkBannerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.CORREO_ELECTRONICO, user?.CODIGO, user?.codigo]);

  // Verifică dacă banner-ul trebuie afișat (până pe 15 februarie 2026)
  // IMPORTANT: Hook-ul trebuie să fie apelat ÎNAINTE de orice return condiționat
  const shouldShowBajaMedicaBanner = useMemo(() => {
    // Așteaptă până se încarcă starea din BD
    if (bannerStatusLoading) {
      return false;
    }
    
    // Verifică dacă utilizatorul a închis banner-ul
    if (bannerDismissed) {
      return false;
    }
    
    const today = new Date();
    const endDate = new Date('2026-02-15');
    endDate.setHours(23, 59, 59, 999); // Până la sfârșitul zilei de 15 februarie
    return today <= endDate;
  }, [bannerDismissed, bannerStatusLoading]);

  if (!uiReady) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-6">
      {/* Banner Recordatorio - Baja Médica */}
      {shouldShowBajaMedicaBanner && (
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-xl shadow-lg border border-rose-300 p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl md:text-3xl">🩺</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                Recordatorio importante
              </h3>
              <p className="text-sm md:text-base text-white/95 leading-relaxed mb-3">
                En caso de baja médica, es <strong>obligatorio</strong> comunicarlo a la empresa lo antes posible a través de la aplicación.
              </p>
              <div className="flex items-center gap-2 text-xs md:text-sm text-white/90">
                <span>📍</span>
                <span>Puedes hacerlo desde la página <strong>Fichaje</strong> → botón <strong>&quot;Anunciar Baja Médica&quot;</strong></span>
              </div>
            </div>
            <button
              onClick={async () => {
                // Marchează banner-ul ca închis (se va salva în BD prin activityLogger)
                setBannerDismissed(true);
                // Fallback la localStorage pentru compatibilitate
                localStorage.setItem('bajaMedicaBannerDismissed', 'true');
                setNotification({
                  type: 'info',
                  message: 'Banner cerrado. Recuerda comunicar tu baja médica cuando sea necesario.',
                });

                // Log acțiunea
                if (user) {
                  try {
                    await activityLogger.logBannerBajaMedicaDismissed(user);
                  } catch (error) {
                    console.error('Error logging banner dismissal:', error);
                  }

                  // Trimite email de confirmare către angajat (cu BCC la info@decaminoservicios.com)
                  try {
                    const baseUrl = import.meta.env.DEV 
                      ? 'http://localhost:3000' 
                      : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
                    const token = localStorage.getItem('auth_token');
                    
                    const userName = user['NOMBRE / APELLIDOS'] || user.NOMBRE_APELLIDOS || user.nombre || 'Usuario';
                    const userEmail = user.email || user.CORREO_ELECTRONICO;
                    const userGrupo = user.GRUPO || user.grupo || 'N/A';
                    const userCodigo = user.CODIGO || user.codigo || 'N/A';

                    // Doar dacă există email valid
                    if (userEmail && userEmail.includes('@')) {
                      const emailResponse = await fetch(`${baseUrl}/api/monitoring/banner-baja-medica-confirmation`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({
                          userEmail: userEmail,
                          userName: userName,
                          userCodigo: userCodigo,
                          userGrupo: userGrupo,
                        }),
                      });

                      if (!emailResponse.ok) {
                        const errorText = await emailResponse.text();
                        console.warn('Failed to send confirmation email:', errorText);
                      } else {
                        console.log('✅ Confirmation email sent successfully');
                      }
                    } else {
                      console.warn('⚠️ No valid email found for employee, skipping email confirmation');
                    }
                  } catch (error) {
                    console.error('Error sending confirmation email:', error);
                  }
                }
              }}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
              title="Cerrar banner"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>
      )}
      {/* Modal pentru trimiterea notificărilor */}
      <SendNotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        currentUser={user}
      />

      {alertNotification && (
        <Notification
          type={alertNotification.type}
          title={alertNotification.title}
          message={alertNotification.message}
          onClose={() => setAlertNotification(null)}
        />
      )}

      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          duration={notification.duration}
          onClose={() => setNotification(null)}
        />
      )}

      {loadingAlerts && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-sm text-yellow-700">
          <div className="h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Comprobando alertas mensuales...</span>
        </div>
      )}

      {!loadingAlerts && monthlyAlerts && monthlyAlerts.total > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-md flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">Alertas mensuales detectadas</h3>
            <p className="text-sm text-yellow-700">
              {(() => {
                const parts = [];
                if (monthlyAlerts.positivos > 0) {
                  parts.push(
                    <span key="exceso">
                      <span className="font-semibold text-red-600">{monthlyAlerts.positivos} día{monthlyAlerts.positivos > 1 ? 's' : ''}</span> con exceso (has trabajado más horas de las previstas)
                    </span>
                  );
                }
                if (monthlyAlerts.negativos > 0) {
                  parts.push(
                    <span key="deficit">
                      <span className="font-semibold text-yellow-600">{monthlyAlerts.negativos} día{monthlyAlerts.negativos > 1 ? 's' : ''}</span> con déficit (no has fichado o has trabajado menos horas de las previstas)
                    </span>
                  );
                }
                if (parts.length === 0) {
                  return (
                    <>
                      Tienes {monthlyAlerts.total} días con alertas este mes. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
                    </>
                  );
                }
                return (
                  <>
                    Tienes {monthlyAlerts.total} día{monthlyAlerts.total > 1 ? 's' : ''} con alertas este mes: {parts.length > 1 ? (
                      <>
                        {parts[0]} y {parts[1]}
                      </>
                    ) : parts[0]}. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
                  </>
                );
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Mensaje de bienvenida - Subtile și elegant */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-lg transition-all duration-300 hover:shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 to-purple-50/30" />

        <div className="relative p-6">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
            <div className="relative group">
              <div 
                className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl transition-all duration-300 group-hover:scale-105 md:h-28 md:w-28"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                }}
              >
                {loadingAvatar ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                  </div>
                ) : avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={userName}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                ) : (
                  <span className="text-3xl font-bold uppercase text-white drop-shadow-lg">
                    {userName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              
              <Link 
                to="/datos" 
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-blue-600 shadow-md ring-1 ring-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-white"
              >
                Ver perfil
              </Link>
          </div>
          
            <div className="flex-1 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                ¡Bienvenido, {userName}!
              </h1>
              <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base md:mx-0">
                Este es tu panel en{' '}
                <span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                  DE CAMINO SERVICIOS AUXILIARES
                </span>
                . Aquí tienes acceso directo a todo lo que necesitas:{' '}
                <span className="inline-flex items-center gap-1 font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  empleados
                </span>
                ,{' '}
                <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  cuadrantes
                </span>
                ,{' '}
                <span className="inline-flex items-center gap-1 font-medium text-orange-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  nóminas
                </span>
                ,{' '}
                <span className="inline-flex items-center gap-1 font-medium text-pink-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                  solicitudes
                </span>{' '}
                y mucho más.
              </p>
              
              {/* Butoane pentru notificări (doar pentru developeri, supervizori și manageri) */}
              {(isDeveloper || isManager) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowNotificationModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <span>📨</span>
                    Enviar Notificación
                  </button>
                  
                  {isDeveloper && (
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('auth_token');
                          const baseUrl = import.meta.env.DEV 
                            ? 'http://localhost:3000' 
                            : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
                          const response = await fetch(`${baseUrl}/api/notifications/test`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                          });
                          const data = await response.json();
                          if (data.success) {
                            setNotification({
                              type: 'success',
                              title: '¡Notificación enviada!',
                              message: 'Verifica el icono de notificaciones para ver el mensaje.',
                              duration: 4000
                            });
                          } else {
                            setNotification({
                              type: 'error',
                              title: 'Error',
                              message: data.message || 'No se pudo enviar la notificación',
                              duration: 5000
                            });
                          }
                        } catch (error) {
                          console.error('Error sending test notification:', error);
                          setNotification({
                            type: 'error',
                            title: 'Error al enviar',
                            message: error.message || 'Ocurrió un error al enviar la notificación',
                            duration: 5000
                          });
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      <span>🔔</span>
                      Probar Notificación Push
                    </button>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-center md:justify-start">
                <div className="h-px flex-1 max-w-xs bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                <div className="mx-3 h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 opacity-60" />
                <div className="h-px flex-1 max-w-xs bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acceso rápido - Quick Access Orb */}
      <div className="card relative overflow-visible py-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-50/30 via-white to-purple-50/30"></div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-2xl text-white shadow-lg">
                ⚡
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Acceso rápido</h2>
                <p className="text-sm text-gray-600">
                  Funcionalidades principales del sistema
                </p>
              </div>
                </div>
              </div>

          <QuickAccessOrb
            items={quickAccessItems}
            ringSize={540}
            innerSize={240}
            onSelect={(id) => {
              console.debug('[Dashboard] Acceso rápido selección:', id);
            }}
            className="mx-auto w-full max-w-[900px] py-10"
          />
        </div>
      </div>
    </div>
  );
};

export default InicioPage;