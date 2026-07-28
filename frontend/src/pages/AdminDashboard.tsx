import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Link } from 'react-router';
import Back3DButton from '../components/Back3DButton.jsx';
import AccessMatrix from '../components/admin/AccessMatrix';
import UserStats from '../components/admin/UserStats';
import ActivityLog from '../components/admin/ActivityLog';
import PushSubscribersList from '../components/admin/PushSubscribersList';
import EmpleadosStatusList from '../components/admin/EmpleadosStatusList';
import PortalDocumentosGeneralesAdmin from '../components/admin/PortalDocumentosGeneralesAdmin';
// ServerMonitor eliminat
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import { useAdminApi } from '../hooks/useAdminApi';

export default function AdminDashboard() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { getPermissions } = useAdminApi();
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Verifică dacă utilizatorul este admin (fallback pentru cazuri vechi)
  const isAdmin = authUser?.GRUPO === 'Admin' || authUser?.grupo === 'Admin';
  const isDeveloper = authUser?.GRUPO === 'Developer' || authUser?.grupo === 'Developer';
  const isManager = authUser?.isManager || false;
  const isSupervisor =
    authUser?.GRUPO === 'Supervisor' || authUser?.grupo === 'Supervisor';
  const userGrupo = authUser?.GRUPO || authUser?.grupo || '';
  /** Mismo criterio que el backend para /api/admin/portal-documentos-generales */
  const canPortalDocsAdmin = ['Developer', 'Admin', 'Manager', 'Supervisor'].includes(
    String(userGrupo).trim(),
  );

  // Funcție helper pentru a găsi cheia corectă a grupului în permisiuni
  const findGrupoKey = useCallback((grupo, permissions) => {
    if (!grupo || !permissions) return null;
    const grupoLower = grupo.toLowerCase();
    for (const key of Object.keys(permissions)) {
      if (key.toLowerCase() === grupoLower) return key;
    }
    return null;
  }, []);

  // Funcție helper pentru a verifica permisiunile din backend
  const hasPermission = useCallback((module) => {
    if (!userPermissions || !userGrupo) {
      return false;
    }
    
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) {
      return false;
    }
    
    const grupoPermissions = userPermissions[grupoKey];
    if (!grupoPermissions) {
      return false;
    }
    
    return grupoPermissions[module] === true;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || authUser?.isDemo) {
        setLoadingPermissions(false);
        return;
      }
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };
    loadPermissions();
  }, [userGrupo, authUser?.isDemo, getPermissions]);

  // Verifică dacă utilizatorul are acces (din GRUPO sau din permisiuni backend)
  const hasAdminAccess = useMemo(() => {
    // Verifică dacă sistemul de permisiuni backend există
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
    const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
    const shouldUseBackend = useBackendPermissions && grupoKeyExists;

    // Dacă sistemul de permisiuni backend există, verifică permisiunea 'admin'
    if (shouldUseBackend) {
      return hasPermission('admin');
    }

    // Fallback: verifică GRUPO (pentru cazuri vechi sau când backend-ul nu returnează permisiuni)
    return isAdmin || isDeveloper || isManager || isSupervisor;
  }, [
    userPermissions,
    loadingPermissions,
    userGrupo,
    findGrupoKey,
    hasPermission,
    isAdmin,
    isDeveloper,
    isManager,
    isSupervisor,
  ]);

  useEffect(() => {
    // Așteaptă până când authUser este încărcat complet
    if (authLoading) {
      return;
    }

    // Așteaptă până când permisiunile sunt încărcate (sau s-a determinat că nu există sistem backend)
    if (loadingPermissions) {
      return;
    }

    // După ce authUser este încărcat, verifică permisiunile
    if (!authUser) {
      setError('No se pudo cargar la información del usuario.');
      setLoading(false);
      return;
    }

    if (!hasAdminAccess) {
      setError('Acceso restringido. Solo los administradores pueden acceder a esta página.');
      setLoading(false);
      return;
    }
    
    // Dacă are permisiuni, oprește loading-ul
    setLoading(false);
  }, [authUser, authLoading, loadingPermissions, hasAdminAccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Cargando Panel de Administración...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <div className="text-red-600 font-bold text-xl mb-4">Acceso Restringido</div>
          <div className="text-gray-600 mb-6">{error}</div>
          <Link 
            to="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            <span className="mr-2">←</span>
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header modern */}
      <div className="bg-gradient-to-br from-red-600 to-red-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Back3DButton to="/dashboard" title="Regresar al Dashboard" />
              <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Panel</h1>
                <p className="text-red-100 text-sm">{isDeveloper ? 'Developer Tools' : 'Administración del sistema'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/90">
                Conectado como: <span className="font-semibold">{authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Botón Reportar Error */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => {
              // Date relevante pentru pagina de admin
              const tabNames = {
                'stats': 'Estadísticas',
                'permissions': 'Permisos',
                'activity': 'Activity Logs',
                'push': 'Push Subscribers',
                'empleados': 'Estado Empleados',
                'portal-docs': 'Docs portal (empresa)',
              };
              
              const pageData = {
                additionalInfo: [
                  `[TAB ACTIVO] ${tabNames[activeTab] || activeTab}`,
                  isAdmin ? '[ROL] Admin' : isDeveloper ? '[ROL] Developer' : null,
                ].filter(Boolean),
              };
              
              const message = buildErrorReportMessage({
                authUser,
                pageName: "Panel de Administración",
                pageData,
              });
              
              openWhatsAppErrorReport(message);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="text-base">📱</span>
            Reportar error
          </button>
        </div>

        {/* Enlaces admin: analytics (también Manager), leads (Admin/Developer). Super-admin tenants: ruta directa /superadmin/tenants (no menú). */}
        {(isAdmin || isDeveloper || isManager) && (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              📈 Analytics chat IA
            </Link>
            {(isAdmin || isDeveloper) && (
              <Link
                to="/admin/leads"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow border border-red-100 hover:bg-red-50 transition-colors"
              >
                📇 Leads (España)
              </Link>
            )}
          </div>
        )}

        {/* Tabs de navigare */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              📊 Estadísticas
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'access'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              🔐 Control de Acceso
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'activity'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              📝 Registro de Actividad
            </button>
            <button
              onClick={() => setActiveTab('push-subscribers')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'push-subscribers'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              🔔 Suscriptores Push
            </button>
            <button
              onClick={() => setActiveTab('empleados-status')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'empleados-status'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              👥 Estado Empleados
            </button>
            {canPortalDocsAdmin && (
              <button
                onClick={() => setActiveTab('portal-docs')}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'portal-docs'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                📁 Docs portal (empresa)
              </button>
            )}
            {/* Servere eliminat */}
          </div>
        </div>

        {/* Conținut tab-uri */}
        <div className="space-y-8">
          {activeTab === 'stats' && (
            <UserStats />
          )}
          
          {activeTab === 'access' && (
            <>
              <AccessMatrix />
            </>
          )}
          
          {activeTab === 'activity' && <ActivityLog />}

          {activeTab === 'push-subscribers' && <PushSubscribersList />}

          {activeTab === 'empleados-status' && <EmpleadosStatusList />}

          {activeTab === 'portal-docs' && canPortalDocsAdmin && (
            <PortalDocumentosGeneralesAdmin />
          )}

          {/* Conținut pentru tabul Servere a fost eliminat */}
        </div>
      </div>
    </div>
  );
} 