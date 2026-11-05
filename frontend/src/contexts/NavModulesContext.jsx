import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContextBase';
import { useAdminApi } from '../hooks/useAdminApi';
import { useComunicadosApi } from '../hooks/useComunicadosApi';
import { routes } from '../utils/routes';
import { buildNavItems, findGrupoKey } from '../navigation/buildNavItems';

const NavModulesContext = createContext(null);

function useVisibilityPolling(fetchFn, deps, intervalMs = 60000) {
  useEffect(() => {
    let interval = null;
    const run = () => {
      if (!document.hidden) fetchFn();
    };
    run();
    const start = () => {
      if (document.hidden) return;
      interval = setInterval(run, intervalMs);
    };
    start();
    const onVis = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        run();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function NavModulesProvider({ children }) {
  const { user } = useAuth();
  const { getPermissions } = useAdminApi();
  const { getUnreadCount } = useComunicadosApi();

  const userGrupo = user?.GRUPO || user?.grupo || '';
  const isManager = Boolean(user?.isManager);
  const isAdmin =
    user?.GRUPO === 'Admin' ||
    user?.grupo === 'Admin' ||
    userGrupo.toLowerCase() === 'admin';
  const isDeveloper =
    user?.GRUPO === 'Developer' ||
    user?.grupo === 'Developer' ||
    userGrupo.toLowerCase() === 'developer';

  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [comunicadosUnreadCount, setComunicadosUnreadCount] = useState(0);
  const [documentosSolicitadosCount, setDocumentosSolicitadosCount] = useState(0);
  const [documentosPRLPendientesCount, setDocumentosPRLPendientesCount] = useState(0);
  const [documentosOficialesNecesitanFirmaCount, setDocumentosOficialesNecesitanFirmaCount] =
    useState(0);
  const [misTareasPendientesCount, setMisTareasPendientesCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userGrupo || user?.isDemo) {
        if (!cancelled) {
          setUserPermissions(null);
          setLoadingPermissions(false);
        }
        return;
      }
      setLoadingPermissions(false);
      try {
        const permissions = await getPermissions(userGrupo);
        if (!cancelled) setUserPermissions(permissions);
      } catch (err) {
        console.error('[NavModules] permissions error:', err);
        if (!cancelled) setUserPermissions(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userGrupo, user?.isDemo, getPermissions]);

  const hasPermission = useCallback(
    (module) => {
      if (!userPermissions || !userGrupo) return false;
      const grupoKey = findGrupoKey(userGrupo, userPermissions);
      if (!grupoKey) return false;
      const grupoPermissions = userPermissions[grupoKey];
      if (!grupoPermissions) return false;
      return grupoPermissions[module] === true;
    },
    [userPermissions, userGrupo],
  );

  useVisibilityPolling(
    async () => {
      if (!user?.userId && !user?.CODIGO) {
        setComunicadosUnreadCount(0);
        return;
      }
      try {
        const count = await getUnreadCount();
        setComunicadosUnreadCount(count || 0);
      } catch {
        setComunicadosUnreadCount(0);
      }
    },
    [user?.userId, user?.CODIGO, getUnreadCount],
    30000,
  );

  useVisibilityPolling(
    async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setDocumentosSolicitadosCount(0);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.getDocumentosSolicitados(user.CODIGO), {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (!response.ok) {
          setDocumentosSolicitadosCount(0);
          return;
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setDocumentosSolicitadosCount(
            data.data.filter((s) => s.estado === 'pendiente').length,
          );
        } else setDocumentosSolicitadosCount(0);
      } catch {
        setDocumentosSolicitadosCount(0);
      }
    },
    [user?.CODIGO, user?.isDemo],
  );

  useVisibilityPolling(
    async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setDocumentosPRLPendientesCount(0);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.prlMisDocumentos, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (!response.ok) {
          setDocumentosPRLPendientesCount(0);
          return;
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.documentos)) {
          setDocumentosPRLPendientesCount(
            data.documentos.filter((d) => d.estado === 'PENDIENTE' && d.requiere_firma)
              .length,
          );
        } else setDocumentosPRLPendientesCount(0);
      } catch {
        setDocumentosPRLPendientesCount(0);
      }
    },
    [user?.CODIGO, user?.isDemo],
  );

  useVisibilityPolling(
    async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setDocumentosOficialesNecesitanFirmaCount(0);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.countDocumentosNecesitanFirma(user.CODIGO), {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (!response.ok) {
          setDocumentosOficialesNecesitanFirmaCount(0);
          return;
        }
        const data = await response.json();
        setDocumentosOficialesNecesitanFirmaCount(
          data.success && typeof data.count === 'number' ? data.count : 0,
        );
      } catch {
        setDocumentosOficialesNecesitanFirmaCount(0);
      }
    },
    [user?.CODIGO, user?.isDemo],
  );

  useVisibilityPolling(
    async () => {
      if (!user?.CODIGO || user?.isDemo) {
        setMisTareasPendientesCount(0);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.tareasMias, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (response.status === 403 || response.status === 404 || !response.ok) {
          setMisTareasPendientesCount(0);
          return;
        }
        const data = await response.json();
        const list = Array.isArray(data) ? data : data?.data || [];
        setMisTareasPendientesCount(
          list.filter((t) => {
            const e = String(t?.estado || '').toLowerCase();
            return e === 'pendiente' || e === 'en_curso';
          }).length,
        );
      } catch {
        setMisTareasPendientesCount(0);
      }
    },
    [user?.CODIGO, user?.isDemo],
  );

  const hasBackendPermissions =
    Boolean(userPermissions) && Object.keys(userPermissions || {}).length > 0;
  const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
  const grupoKeyExists = useBackendPermissions
    ? findGrupoKey(userGrupo, userPermissions) !== null
    : false;
  const shouldUseBackend = useBackendPermissions && grupoKeyExists;

  const items = useMemo(
    () =>
      buildNavItems({
        shouldUseBackend,
        hasBackendPermissions,
        hasPermission,
        isManager,
        isAdmin,
        isDeveloper,
        userGrupo,
        comunicadosUnreadCount,
        documentosSolicitadosCount,
        documentosPRLPendientesCount,
        documentosOficialesNecesitanFirmaCount,
        misTareasPendientesCount,
        withChildren: true,
      }),
    [
      shouldUseBackend,
      hasBackendPermissions,
      hasPermission,
      isManager,
      isAdmin,
      isDeveloper,
      userGrupo,
      comunicadosUnreadCount,
      documentosSolicitadosCount,
      documentosPRLPendientesCount,
      documentosOficialesNecesitanFirmaCount,
      misTareasPendientesCount,
    ],
  );

  /** Items without tab children — Accesos frecuentes / orb (same modules) */
  const itemsFlat = useMemo(
    () =>
      buildNavItems({
        shouldUseBackend,
        hasBackendPermissions,
        hasPermission,
        isManager,
        isAdmin,
        isDeveloper,
        userGrupo,
        comunicadosUnreadCount,
        documentosSolicitadosCount,
        documentosPRLPendientesCount,
        documentosOficialesNecesitanFirmaCount,
        misTareasPendientesCount,
        withChildren: false,
      }),
    [
      shouldUseBackend,
      hasBackendPermissions,
      hasPermission,
      isManager,
      isAdmin,
      isDeveloper,
      userGrupo,
      comunicadosUnreadCount,
      documentosSolicitadosCount,
      documentosPRLPendientesCount,
      documentosOficialesNecesitanFirmaCount,
      misTareasPendientesCount,
    ],
  );

  const inicioBadgeCounts = useMemo(
    () => ({
      documentos:
        documentosSolicitadosCount +
        documentosPRLPendientesCount +
        documentosOficialesNecesitanFirmaCount,
      misTareas: misTareasPendientesCount,
      comunicados: comunicadosUnreadCount,
    }),
    [
      documentosSolicitadosCount,
      documentosPRLPendientesCount,
      documentosOficialesNecesitanFirmaCount,
      misTareasPendientesCount,
      comunicadosUnreadCount,
    ],
  );

  const value = useMemo(
    () => ({
      items,
      itemsFlat,
      hasPermission,
      findGrupoKey,
      userPermissions,
      loadingPermissions,
      inicioBadgeCounts,
      isManager,
      isAdmin,
      isDeveloper,
      userGrupo,
      shouldUseBackend,
      hasBackendPermissions,
    }),
    [
      items,
      itemsFlat,
      hasPermission,
      userPermissions,
      loadingPermissions,
      inicioBadgeCounts,
      isManager,
      isAdmin,
      isDeveloper,
      userGrupo,
      shouldUseBackend,
      hasBackendPermissions,
    ],
  );

  return (
    <NavModulesContext.Provider value={value}>{children}</NavModulesContext.Provider>
  );
}

export function useNavModules() {
  const ctx = useContext(NavModulesContext);
  if (!ctx) {
    throw new Error('useNavModules must be used within NavModulesProvider');
  }
  return ctx;
}

/** Optional for components that may render outside provider */
export function useNavModulesOptional() {
  return useContext(NavModulesContext);
}
