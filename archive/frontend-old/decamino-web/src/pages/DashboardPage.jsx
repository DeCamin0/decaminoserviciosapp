import { useAuth } from '../contexts/AuthContextBase';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Notification } from '../components/ui';
import { routes, getN8nUrl } from '../utils/routes';
import QuickAccessOrb from '../components/QuickAccessOrb';
import { useAdminApi } from '../hooks/useAdminApi';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Folder,
  Settings,
  ShoppingCart,
  UserCircle,
  Users,
} from 'lucide-react';
import {
  getCurrentMonthKey,
  getStoredMonthlyAlerts,
  isMonthlyAlertsNotified,
  markMonthlyAlertsNotified,
  normalizeDetalles,
  fetchMonthlyAlerts as fetchMonthlyAlertsData
} from '../utils/monthlyAlerts';

const InicioPage = () => {
  const { user } = useAuth();
  const { getPermissions } = useAdminApi();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const avatarLoadedRef = useRef(false);
  const currentUserIdRef = useRef(null);
  const [monthlyAlerts, setMonthlyAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertNotification, setAlertNotification] = useState(null);
  const alertsFetchedRef = useRef({ userId: null, month: null, fetched: false });
  const [empleadoCompleto, setEmpleadoCompleto] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Extrage informațiile corecte din obiectul user
  const userName = user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator';
  const userGrupo = user?.GRUPO || user?.grupo || 'Empleado';
  const isManager = user?.isManager || user?.GRUPO === 'Manager' || user?.GRUPO === 'Supervisor';
  const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
  const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';

  const pedidosAccess = useMemo(() => {
    const empleado = empleadoCompleto || user || {};
    const grupo = empleado?.GRUPO || user?.GRUPO;

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

    const allowedRoles = [
      'Admin',
      'Developer',
      'Manager',
      'Supervisor',
      'Operario',
      'Auxiliar',
    ];

    const hasRolePermission = grupo ? allowedRoles.includes(grupo) : false;
    const hasSpecialAccess = isManager || isAdmin || isDeveloper;

    const canAccess =
      hasFieldPermission ||
      hasGenericPermission ||
      hasRolePermission ||
      hasSpecialAccess;

    const hint = hasSpecialAccess
      ? 'Gestionar pedidos y permisos de productos'
      : canAccess
        ? 'Crear nuevos pedidos'
        : 'No tienes permisos para crear pedidos';

    return {
      canAccess,
      hint,
      href: hasSpecialAccess ? '/pedidos' : '/empleado-pedidos',
      role: hasSpecialAccess ? 'manager' : undefined,
    };
  }, [empleadoCompleto, user, isManager, isAdmin, isDeveloper]);

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
    
    // Returnează permisiunea pentru modulul specificat
    const hasAccess = grupoPermissions[module] === true;
    console.log(`🔐 DashboardPage: Checking permission for grupo "${userGrupo}" (key: "${grupoKey}"), module "${module}":`, hasAccess);
    return hasAccess;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || user?.isDemo) {
        setLoadingPermissions(false);
        return;
      }

      try {
        setLoadingPermissions(true);
        console.log('🔐 DashboardPage: Loading permissions for grupo:', userGrupo);
        const permissions = await getPermissions(userGrupo);
        console.log('✅ DashboardPage: Permissions loaded:', permissions);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('❌ DashboardPage: Error loading permissions:', error);
        // În caz de eroare, folosim permisiunile implicite
        setUserPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [userGrupo, user?.isDemo, getPermissions]);

  const quickAccessItems = useMemo(() => {
    // Dacă permisiunile nu sunt încă încărcate, folosim verificările hardcodate ca fallback
    const useBackendPermissions = userPermissions && !loadingPermissions;
    
    // Verifică dacă există permisiuni pentru grupul utilizatorului în backend
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    
    console.log('🔐 DashboardPage: Building menu items.');
    console.log('  - useBackendPermissions:', useBackendPermissions);
    console.log('  - userGrupo:', userGrupo);
    console.log('  - grupoKeyExists:', grupoKeyExists);
    console.log('  - userPermissions keys:', userPermissions ? Object.keys(userPermissions) : 'null');
    
    const list = [];
    
    // Elemente de bază - verifică permisiunile din backend sau folosește fallback
    // Dacă folosim permisiunile din backend și grupul există, verificăm DOAR permisiunile din backend
    // Dacă nu folosim permisiunile din backend sau grupul nu există, folosim fallback-ul
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;
    
    const canAccessDatos = shouldUseBackend ? (hasPermission('datos') || hasPermission('dashboard')) : true;
    const canAccessFichar = shouldUseBackend ? (hasPermission('fichar') || hasPermission('dashboard')) : true;
    const canAccessSolicitudes = shouldUseBackend ? (hasPermission('solicitudes') || hasPermission('dashboard')) : true;
    const canAccessDocumentos = shouldUseBackend ? (hasPermission('documentos') || hasPermission('dashboard')) : true;
    const canAccessCuadrantesEmpleado = shouldUseBackend ? (hasPermission('cuadrantes-empleado') || hasPermission('cuadrantes') || hasPermission('dashboard')) : true;
    const canAccessMisInspecciones = shouldUseBackend ? (hasPermission('mis-inspecciones') || hasPermission('dashboard')) : true;

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
        label: 'Fichar',
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

    if (canAccessDocumentos) {
      list.push({
        id: 'documentos',
        label: 'Documentos',
        hint: 'Nóminas y archivos',
        icon: <FileText className="h-6 w-6 text-white" />,
        gradient: 'from-orange-500 via-amber-500 to-yellow-500',
        href: '/documentos',
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

    // Elemente pentru manager - verifică permisiunile din backend sau folosește fallback
    const canManageEmployees = shouldUseBackend ? hasPermission('empleados') : isManager;
    const canManageDocuments = shouldUseBackend ? hasPermission('documentos-empleados') : isManager;
    const canManageCuadrantes = shouldUseBackend ? hasPermission('cuadrantes') : isManager;
    const canApprove = shouldUseBackend ? hasPermission('aprobaciones') : isManager;
    const canInspect = shouldUseBackend ? hasPermission('inspecciones') : isManager;

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

    if ((!useBackendPermissions && isManager) || canManageCuadrantes) {
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

    if ((!useBackendPermissions && isManager) || canApprove) {
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

    if ((!useBackendPermissions && isManager) || canInspect) {
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

    if (pedidosAccess.canAccess) {
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
      list.push({
        id: 'pedidos',
        label: 'Pedidos',
        hint: pedidosAccess.hint,
        icon: <ShoppingCart className="h-6 w-6 text-white" />,
        gradient: 'from-amber-500 via-orange-500 to-yellow-500',
        disabled: true,
      });
    }

    const canAccessAdmin = shouldUseBackend ? hasPermission('admin') : (isAdmin || isDeveloper);
    const canAccessStats = shouldUseBackend ? hasPermission('estadisticas') : (isAdmin || isDeveloper || user?.GRUPO === 'Supervisor');
    const canAccessClientes = shouldUseBackend ? hasPermission('clientes') : (isAdmin || isDeveloper || user?.GRUPO === 'Supervisor');

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
  ]);

  // Încarcă datele complete despre angajat din backend (ca în DatosPage.jsx)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const searchParams = new URLSearchParams();
        if (user?.email) {
          searchParams.append('email', user.email);
        }
        if (user?.CODIGO) {
          searchParams.append('codigo', user.CODIGO);
        }
        const nombreCompleto = user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.nombre;
        if (nombreCompleto) {
          searchParams.append('nombre', nombreCompleto);
        }
        const endpoint = searchParams.toString()
          ? `${routes.getEmpleados}${routes.getEmpleados.includes('?') ? '&' : '?'}${searchParams.toString()}`
          : routes.getEmpleados;

        const res = await fetch(endpoint, {
          headers: {
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
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
        const users = Array.isArray(data) ? data : [data];
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
          } else {
            console.warn('⚠️ [Dashboard] Angajatul curent nu a fost găsit în backend');
            setEmpleadoCompleto(null);
          }
        }
      } catch (error) {
        console.error('❌ [Dashboard] Error fetching empleado:', error);
      }
    };
    
    fetchUser();
  }, [user?.CODIGO, user?.email, user]);

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

    const empleadoId = user?.CODIGO || user?.codigo;
    const empleadoNombre = user?.['NOMBRE / APELLIDOS'] || user?.name || '';

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
          month,
          getUrl: getN8nUrl
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
  }, [user]);

  // Cargar avatar existente - folosind același endpoint ca în DatosPage
  const loadExistingAvatar = useCallback(async () => {
    if (!user?.CODIGO) return;
    
    // Evitar cargar múltiples veces para el mismo usuario
    if (avatarLoadedRef.current && currentUserIdRef.current === user?.CODIGO) {
      console.log('🔄 [Inicio] Avatar ya cargado para este usuario, saltando...');
      return;
    }

    setLoadingAvatar(true);
    currentUserIdRef.current = user?.CODIGO;

    try {
      const formData = new FormData();
      formData.append('motivo', 'get');
      formData.append('CODIGO', user.CODIGO);
      formData.append('nombre', userName || '');

      const response = await fetch(routes.getAvatar, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('ℹ️ [Inicio] No se encontró avatar para este usuario');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Verifică dacă răspunsul este JSON valid pentru avatar
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ [Dashboard] Avatar endpoint returned non-JSON response:', {
          status: response.status,
          contentType,
          response: textResponse.substring(0, 200) + '...'
        });
        throw new Error(`Avatar endpoint returned ${contentType || 'unknown content type'} instead of JSON. Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [Inicio] Avatar cargado:', result);
      
      // Backend retorna un array con el avatar
      let avatarData = null;
      
      if (Array.isArray(result) && result.length > 0) {
        avatarData = result[0];
      } else if (result && typeof result === 'object') {
        avatarData = result;
      }
      
      console.log('🔍 [Inicio] Avatar data procesado:', avatarData);
      
      // Verificar si tiene AVATAR_B64 (base64) o URL
      if (avatarData) {
        let avatarUrl = null;
        
        if (avatarData.AVATAR_B64) {
          // Convertir base64 a data URL
          const base64Clean = avatarData.AVATAR_B64.replace(/\n/g, ''); // Limpiar saltos de línea
          avatarUrl = `data:image/jpeg;base64,${base64Clean}`;
          console.log('✅ [Inicio] Avatar B64 convertido a data URL');
        } else if (avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR) {
          avatarUrl = avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR;
          console.log('✅ [Inicio] Avatar URL encontrado:', avatarUrl);
        }
        
        if (avatarUrl) {
          setAvatarUrl(avatarUrl);
          console.log('✅ [Inicio] Avatar seteado en state');
        } else {
          console.log('ℹ️ [Inicio] No se encontró AVATAR_B64 ni URL en la respuesta');
        }
      } else {
        console.log('ℹ️ [Inicio] No se encontró data de avatar en la respuesta');
      }
      
    } catch (error) {
      console.error('❌ [Inicio] Error cargando avatar:', error);
    } finally {
      setLoadingAvatar(false);
      avatarLoadedRef.current = true;
    }
  }, [user?.CODIGO, userName]);

  // Cargar avatar al montar el componente
  useEffect(() => {
    if (user?.CODIGO && !user?.isDemo) {
      loadExistingAvatar();
    }
  }, [loadExistingAvatar, user?.CODIGO, user?.isDemo]);

  return (
    <div className="space-y-6">
      {alertNotification && (
        <Notification
          type={alertNotification.type}
          title={alertNotification.title}
          message={alertNotification.message}
          onClose={() => setAlertNotification(null)}
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
              Tienes {monthlyAlerts.total} días con alertas este mes: <span className="font-semibold text-red-600">+{monthlyAlerts.positivos}</span> con exceso y <span className="font-semibold text-yellow-600">-{monthlyAlerts.negativos}</span> con déficit. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
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