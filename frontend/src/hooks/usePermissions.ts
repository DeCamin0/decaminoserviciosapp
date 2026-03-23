import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useAdminApi } from './useAdminApi';

/**
 * Tipuri pentru permisiuni
 */
interface Permissions {
  [module: string]: boolean;
}

interface UserPermissions {
  [grupo: string]: Permissions;
}

interface UserForPermissions {
  isManager?: boolean;
  GRUPO?: string;
  grupo?: string;
}

/**
 * Hook centralizat pentru gestionarea permisiunilor
 * 
 * Features:
 * - Încarcă permisiunile din backend pentru grupul utilizatorului
 * - Cache în memory
 * - Logging comparativ (sistem nou vs vechi)
 * - Feature flag pentru activare/dezactivare graduală
 * - Fallback la sistemul vechi dacă e necesar
 */
export const usePermissions = () => {
  const { user, isAuthenticated } = useAuth();
  const { getPermissions } = useAdminApi();
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Feature flag pentru a activa/dezactiva sistemul nou
  const USE_NEW_PERMISSIONS = import.meta.env.VITE_USE_NEW_PERMISSIONS === 'true';

  // Extrage grupul utilizatorului
  const userGrupo = useMemo(() => user?.GRUPO || user?.grupo || 'Empleado', [user?.GRUPO, user?.grupo]);

  // Funcție helper pentru a găsi cheia corectă în permisiuni bazat pe numele grupului
  const findGrupoKey = useCallback((grupo: string, permissions: UserPermissions | null): string | null => {
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
    
    return null;
  }, []);

  // Cache pentru permisiuni - evită apeluri duplicate
  const permissionsCacheRef = useRef<{ grupo: string; permissions: UserPermissions | null; timestamp: number } | null>(null);
  const CACHE_DURATION = 30000; // 30 secunde cache
  const loadingRef = useRef(false);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      // Nu încărca permisiunile dacă utilizatorul nu este autentificat
      // Verifică și token-ul pentru a preveni request-uri după logout
      const token = localStorage.getItem('auth_token');
      // DEMO: no omitir la carga — sin matriz del backend, hasBackendPermissions queda false y páginas
      // como Fichaje hacen `hasBackendPermissions ? hasPermission(...) : false` → acceso denegado siempre.
      if (!isAuthenticated || !user || !userGrupo || !token) {
        setLoading(false);
        setUserPermissions(null);
        permissionsCacheRef.current = null;
        return;
      }

      // Verifică cache-ul
      const now = Date.now();
      if (permissionsCacheRef.current && 
          permissionsCacheRef.current.grupo === userGrupo &&
          (now - permissionsCacheRef.current.timestamp) < CACHE_DURATION) {
        // Folosește cache-ul
        setUserPermissions(permissionsCacheRef.current.permissions);
        setLoading(false);
        return;
      }

      // Evită apeluri duplicate simultane
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      setLoading(true);
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
        // Actualizează cache-ul
        permissionsCacheRef.current = {
          grupo: userGrupo,
          permissions,
          timestamp: now,
        };
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(null);
        permissionsCacheRef.current = null;
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    loadPermissions();
  }, [isAuthenticated, user, userGrupo, getPermissions]);

  // Funcție helper pentru sistemul vechi (pentru comparație și fallback)
  const calculateOldPermission = useCallback((user: UserForPermissions | null | undefined, module: string): boolean => {
    const isManager = user?.isManager || false;
    const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
    const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
    const isSupervisor = user?.GRUPO === 'Supervisor' || user?.grupo === 'Supervisor';
    
    // Logica veche (fallback-uri)
    if (isAdmin || isDeveloper) return true;
    
    // Modulele care necesită manager/supervisor
    if (module === 'admin' && !isAdmin) return false;
    if (module === 'empleados' && !isManager && !isSupervisor) return false;
    if (module === 'cuadrantes' && !isManager && !isSupervisor) return false;
    if (module === 'estadisticas' && !isManager && !isSupervisor) return false;
    if (module === 'clientes' && !isManager && !isSupervisor) return false;
    // Verificările vechi cu isManager/isSupervisor au fost eliminate - folosim doar permisiunile din backend
    // if (module === 'aprobaciones' && !isManager && !isSupervisor) return false; // ELIMINAT - folosim doar backend
    // if (module === 'inspecciones' && !isManager && !isSupervisor) return false; // ELIMINAT - folosim doar backend
    // if (module === 'documentos-empleados' && !isManager && !isSupervisor) return false; // ELIMINAT - folosim doar backend
    // if (module === 'proveedores' && !isManager && !isSupervisor) return false; // ELIMINAT - folosim doar backend
    
    // Modulele publice sau pentru toți
    // comunicados a fost eliminat - folosește doar permisiunile din backend
    if (['dashboard', 'datos', 'fichar', 'solicitudes', 'documentos', 
         'cuadrantes-empleado', 'mis-inspecciones', 'cuadernos', 
         'hall-of-fame'].includes(module)) {
      return true;
    }
    
    // Default: permite accesul pentru modulele de bază
    return true;
  }, []);

  // Funcție principală pentru verificarea permisiunilor
  const hasPermission = useCallback((module: string): boolean => {
    // Verifică dacă există permisiuni în backend
    const hasBackendData = userPermissions !== null && Object.keys(userPermissions).length > 0;
    
    // Dacă sistemul nou e activat SAU există date în backend, folosește sistemul nou
    const shouldUseNewSystem = USE_NEW_PERMISSIONS || hasBackendData;
    
    if (shouldUseNewSystem && hasBackendData) {
      // Folosește sistemul nou (backend)
      if (!userGrupo) {
        return false;
      }
      
      const grupoKey = findGrupoKey(userGrupo, userPermissions);
      if (!grupoKey) {
        // Dacă nu găsește grupul, folosește fallback
        return calculateOldPermission(user, module);
      }
      
      const grupoPermissions = userPermissions[grupoKey];
      const newResult = grupoPermissions && grupoPermissions[module] === true;
      
      // 🔍 LOGGING COMPARATIV - compară cu sistemul vechi (doar în development)
      // ⚠️ IGNORĂ modulele noi care nu există în sistemul vechi (nu are sens să comparăm)
      const newModules = [
        'fichar-admin', 'fichar-empleados',
        'pedidos-admin', 'pedidos-empleados',
        'solicitudes-admin', 'solicitudes-empleados',
      ];
      const isNewModule = newModules.includes(module);
      
      if (import.meta.env.DEV && !isNewModule) {
        const oldResult = calculateOldPermission(user, module);
        
        if (newResult !== oldResult) {
          console.warn(`⚠️ PERMISSION DISCREPANCY [${module}]:`, {
            userGrupo,
            grupoKey,
            module,
            newSystem: newResult,
            oldSystem: oldResult,
            grupoPermissions: grupoPermissions ? Object.keys(grupoPermissions) : [],
            usingNewSystem: true,
          });
          
          // Log în backend pentru analiză (opțional)
          if (import.meta.env.VITE_LOG_PERMISSION_DISCREPANCIES === 'true') {
            fetch('/api/logs/permission-discrepancy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userGrupo,
                grupoKey,
                module,
                newResult,
                oldResult,
                timestamp: new Date().toISOString(),
              }),
            }).catch(() => {}); // Silent fail
          }
        }
      }
      
      return newResult;
    } else {
      // Folosește sistemul vechi (fallback) - doar dacă nu există date în backend
      return calculateOldPermission(user, module);
    }
  }, [userPermissions, userGrupo, findGrupoKey, user, USE_NEW_PERMISSIONS, calculateOldPermission]);

  // Returnează permisiunile pentru grupul utilizatorului curent
  const getCurrentGroupPermissions = useCallback((): Permissions => {
    if (!userPermissions || !userGrupo) {
      return {};
    }
    
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) {
      return {};
    }
    
    return userPermissions[grupoKey] || {};
  }, [userPermissions, userGrupo, findGrupoKey]);

  return { 
    hasPermission, 
    loading, 
    permissions: getCurrentGroupPermissions(),
    // Helper pentru debugging - returnează toate permisiunile (toate grupurile)
    getAllPermissions: () => userPermissions,
    // Helper pentru a obține permisiunile grupului curent
    getCurrentGroupPermissions,
    // Helper pentru a verifica dacă sistemul backend există
    hasBackendPermissions: userPermissions !== null && Object.keys(userPermissions).length > 0,
  };
};
