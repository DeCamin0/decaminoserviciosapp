import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { useEffect, useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';

// Mapare rute -> module pentru permisiuni (aliniat cu AccessMatrix + App.jsx)
const ROUTE_TO_MODULE = {
  '/empleados': 'empleados',
  '/fichar': 'fichar',
  '/cuadrantes': 'cuadrantes',
  '/estadisticas': 'estadisticas',
  '/estadisticas-cuadrantes': 'estadisticas',
  '/estadisticas-empleados': 'estadisticas',
  '/estadisticas-fichajes': 'estadisticas',
  '/clientes': 'clientes',
  '/documentos': 'documentos',
  '/solicitudes': 'solicitudes',
  '/aprobaciones': 'aprobaciones',
  '/cuadernos': 'cuadernos',
  '/cuadernos-centro': 'cuadernos',
  '/admin': 'admin',
  '/superadmin/tenants': 'admin',
  '/inspecciones': 'inspecciones',
  '/pedidos': 'pedidos',
  '/empleado-pedidos': 'pedidos',
  '/proveedores': 'proveedores',
  '/comunicados': 'comunicados',
  '/hall-of-fame': 'hall-of-fame',
  '/documentos-empleados': 'documentos-empleados',
  '/prl-documentos': 'prl-documentos',
  '/presupuestos-informes': 'presupuestos-informes',
  '/servicios-periodicos': 'servicios-periodicos',
  '/fotos-trabajo': 'fotos-trabajo',
  '/mensajes-enviados': 'admin',
  '/datos': 'datos',
  '/inicio': 'dashboard',
  '/': 'dashboard',
};

/** Acceso estricto desde matriz; PRL hereda documentos-empleados si no hay clave explícita. */
function hasStrictModuleAccess(module, getCurrentGroupPermissions) {
  const cur = getCurrentGroupPermissions();
  if (module === 'prl-documentos') {
    if (cur['prl-documentos'] === true) return true;
    if (cur['prl-documentos'] === false) return false;
    return cur['documentos-empleados'] === true;
  }
  return cur[module] === true;
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasPermission, loading: permsLoading, hasBackendPermissions, getCurrentGroupPermissions } = usePermissions();
  const location = useLocation();
  const lastCheckedPath = useRef('');

  // Gestionare navigare pentru browser back button
  useEffect(() => {
    if (isAuthenticated && !loading) {
      // Salvează ruta curentă în sessionStorage
      sessionStorage.setItem('lastPath', location.pathname);
      
      // Log pentru debugging
      console.log('Protected route accessed:', location.pathname);
    }
  }, [location, isAuthenticated, loading]);

  // Determină modulul din ruta curentă
  const getModuleFromPath = (path) => {
    // Caută exact match sau prefix match
    for (const [route, module] of Object.entries(ROUTE_TO_MODULE)) {
      if (path === route || path.startsWith(route + '/')) {
        return module;
      }
    }
    return 'dashboard'; // default
  };

  // Verifică permisiunile când se navighează
  useEffect(() => {
    // Se execută doar când se schimbă ruta și utilizatorul este autentificat
    if (isAuthenticated && user && location.pathname !== lastCheckedPath.current) {
      lastCheckedPath.current = location.pathname;
      
      const module = getModuleFromPath(location.pathname);
      
      console.log('🔐 ProtectedRoute: Checking permissions for module:', module);
      console.log('👤 ProtectedRoute: User grupo:', user?.GRUPO);
      console.log('📍 ProtectedRoute: Current path:', location.pathname);
    }
  }, [location.pathname, isAuthenticated, user]);

  if (loading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Salvează ruta curentă pentru a reveni după login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }

  // Verifică permisiunile pentru ruta curentă
  const module = getModuleFromPath(location.pathname);
  const USE_NEW_PROTECTION = import.meta.env.VITE_USE_NEW_PROTECTION === 'true';
  
  // Dacă sistemul nou e activat SAU există permisiuni în backend, verifică permisiunile
  const shouldCheckPermissions = USE_NEW_PROTECTION || hasBackendPermissions;
  
  if (shouldCheckPermissions) {
    // Modulele publice (nu necesită permisiune explicită)
    // "datos", "solicitudes", "fichar", "cuadrantes-empleado" și "mis-inspecciones" au fost eliminate - acum necesită permisiune explicită din backend
    const publicModules = ['dashboard'];
    
    // Verifică permisiunile - folosim DOAR permisiunile din backend (fără fallback-uri)
    let hasAccess = false;
    if (module === 'solicitudes') {
      const hasEmpleados = hasPermission('solicitudes-empleados');
      const hasAdmin = hasPermission('solicitudes-admin');
      hasAccess = hasEmpleados || hasAdmin;
      console.log(`🔐 ProtectedRoute [solicitudes]:`, {
        module,
        hasEmpleados,
        hasAdmin,
        hasAccess,
        userGrupo: user?.GRUPO || user?.grupo,
        hasBackendPermissions,
      });
    } else if (module === 'pedidos') {
      // Pentru pedidos, verifică ambele variante
      hasAccess = hasPermission('pedidos-empleados') || hasPermission('pedidos-admin');
    } else if (module === 'fichar') {
      // Pentru fichar, verifică ambele variante noi și vechea permisiune
      hasAccess = hasPermission('fichar-empleados') || hasPermission('fichar-admin') || hasPermission('fichar');
    } else if (module === 'servicios-periodicos') {
      // Ca Presupuestos: permiso explícito o acceso a Clientes
      if (!hasBackendPermissions) {
        hasAccess = false;
      } else {
        hasAccess =
          hasStrictModuleAccess('servicios-periodicos', getCurrentGroupPermissions) ||
          hasStrictModuleAccess('clientes', getCurrentGroupPermissions);
      }
    } else if (module === 'datos' || module === 'empleados' || module === 'documentos' || module === 'cuadrantes-empleado' || module === 'cuadrantes' || module === 'mis-inspecciones' || module === 'inspecciones' || module === 'aprobaciones' || module === 'clientes' || module === 'proveedores' || module === 'comunicados' || module === 'prl-documentos' || module === 'presupuestos-informes' || module === 'fotos-trabajo') {
      // Matriz: permiso explícito (PRL: ver hasStrictModuleAccess)
      if (!hasBackendPermissions) {
        hasAccess = false;
      } else {
        hasAccess = hasStrictModuleAccess(module, getCurrentGroupPermissions);
      }
    } else {
      hasAccess = hasPermission(module);
    }
    
    if (!publicModules.includes(module) && !hasAccess) {
      console.warn(`🚫 ProtectedRoute: Access denied for module "${module}"`);
      console.warn(`   User grupo: ${user?.GRUPO || user?.grupo}`);
      console.warn(`   Module: ${module}`);
      console.warn(`   Has permission: ${hasAccess}`);
      console.warn(`   hasBackendPermissions: ${hasBackendPermissions}`);
      console.warn(`   permsLoading: ${permsLoading}`);
      return <Navigate to="/inicio" replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 