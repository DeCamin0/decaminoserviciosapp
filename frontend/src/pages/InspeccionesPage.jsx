import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, LoadingSpinner, PageHeader } from '../components/ui';
import InspectionForm from '../components/inspections/InspectionForm';
import InspectionList from '../components/inspections/InspectionList';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import { routes } from '../utils/routes';
import { API_ENDPOINTS } from '../utils/constants';
import { usePolling } from '../hooks/usePolling';
import { usePermissions } from '../hooks/usePermissions';
import { InspectionTypeIcon } from '../components/inspections/inspectionUi';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

export default function InspeccionesPage() {
  const { user: authUser } = useAuth();
  const { hasPermission, loading: loadingPermissions, hasBackendPermissions } = usePermissions();
  const [selectedType, setSelectedType] = useState(null);
  const [solicitudData, setSolicitudData] = useState(null); // Datele cererii pentru pre-completare
  const [centrosStats, setCentrosStats] = useState({
    totalCentros: 0,
    totalEmpleados: 0,
    centrosActivos: 0
  });

  // Verifică permisiunile din backend - folosim DOAR permisiunile din backend (fără fallback)
  const canAccessPage = hasBackendPermissions ? hasPermission('inspecciones') : false;

  // Demo data for InspeccionesPage
  const setDemoCentrosStats = () => {
    const demoStats = {
      totalCentros: 3,
      totalEmpleados: 6,
      centrosActivos: 3
    };
    setCentrosStats(demoStats);
  };

  // Încarcă statisticile centrelor
  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo centros stats instead of fetching from backend');
      const timer = setTimeout(() => {
        setDemoCentrosStats();
      }, 0);
      return () => clearTimeout(timer);
    }

    const loadCentrosStats = async () => {
      try {
        const response = await fetch(routes.getEmpleados, {
          headers: {
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });

        if (response.status === 403) {
          console.warn('🚫 403 Forbidden la getEmpleados în InspeccionesPage. Setez statistici 0.');
          setCentrosStats({ totalCentros: 0, totalEmpleados: 0, centrosActivos: 0 });
          return;
        }

        const empleadosData = await response.json();
        const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
        
        // Extrage centrele unice
        const centrosUnicos = [...new Set(empleadosArray.map(emp => {
          const centroProps = [
            emp['CENTRO TRABAJO'], 
            emp.CENTRO_TRABAJO, 
            emp.CENTRO, 
            emp.centro,
            emp['CENTRO_DE_TRABAJO'], 
            emp['CENTRO LABORAL']
          ];
          return centroProps.find(prop => prop) || 'Sin centro';
        }).filter(centro => centro && centro !== 'Sin centro'))];
        
        setCentrosStats({
          totalCentros: centrosUnicos.length,
          totalEmpleados: empleadosArray.length,
          centrosActivos: centrosUnicos.length
        });
      } catch (error) {
        console.error('Error loading centros stats:', error);
      }
    };

    loadCentrosStats();
  }, [authUser?.isDemo]);

  // Verifică dacă utilizatorul are acces la pagină
  if (loadingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-gray-600 mt-4">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canAccessPage) {
    return (
      <div className="inspecciones-page app-page flex items-center justify-center min-h-[50vh]">
        <div className="app-card app-card--pad text-center max-w-md w-full">
          <h1 className="text-lg font-bold mb-2">Acceso restringido</h1>
          <p className="text-sm text-gray-600 mb-4">
            No tienes permisos para acceder a Inspecciones. Contacta con tu supervisor.
          </p>
          <Link to="/inicio" className="app-page-header__back inline-flex items-center justify-center hit-44 px-4 rounded-[var(--app-radius-sm)] bg-primary-600 text-white text-sm font-medium">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedType) {
    return (
      <div className="inspecciones-page app-page">
        <PageHeader title="Inspecciones" subtitle="Selecciona el tipo de inspeccion" backTo="/inicio"
          actions={(<Button type="button" variant="secondary" size="sm" onClick={() => openWhatsAppErrorReport(buildErrorReportMessage({ authUser, pageName: 'Inspecciones', pageData: {} }))}><MessageCircle className="w-4 h-4" /> Reportar</Button>)} />
        <div className="inspecciones-hub-grid">
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('limpieza')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="limpieza" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Inspeccion de Limpieza</span><span className="inspecciones-hub-card__desc">17 zonas, evaluacion de calidad, firmas digitales.</span></span>
          </button>
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('servicios')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="servicios" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Servicios Auxiliares</span><span className="inspecciones-hub-card__desc">6 zonas de inspeccion.</span></span>
          </button>
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('personalizada')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="personalizada" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Inspeccion Personalizada</span><span className="inspecciones-hub-card__desc">Puntos personalizables.</span></span>
          </button>
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('entrega-materiales')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="entrega-materiales" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Entrega de Materiales</span><span className="inspecciones-hub-card__desc">Registro de materiales por centro.</span></span>
          </button>
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('pdf-generator')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="pdf-generator" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Lista de Inspecciones</span><span className="inspecciones-hub-card__desc">Consultar y descargar PDFs.</span></span>
          </button>
          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('solicitudes')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="solicitudes" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">Inspecciones Solicitadas</span><span className="inspecciones-hub-card__desc">Solicitudes pendientes.</span></span>
          </button>
        </div>
        <section className="mt-4">
          <h2 className="inspecciones-section-title mb-2">Estadisticas</h2>
          <div className="solicitud-admin-stat-grid">
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Centros</p><p className="solicitud-admin-stat__value">{centrosStats.totalCentros}</p></div>
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Empleados</p><p className="solicitud-admin-stat__value">{centrosStats.totalEmpleados}</p></div>
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Activos</p><p className="solicitud-admin-stat__value">{centrosStats.centrosActivos}</p></div>
          </div>
        </section>
        <section className="mt-4"><RecentInspections /></section>
      </div>
    );
  }

  const formTitles = { limpieza: 'Inspeccion de Limpieza', servicios: 'Inspeccion de Servicios Auxiliares', personalizada: 'Inspeccion Personalizada', 'entrega-materiales': 'Entrega de Materiales' };

  return (
    <div className="inspecciones-page app-page">
      {selectedType === 'pdf-generator' || selectedType === 'solicitudes' ? (
        <InspectionList onBackToSelection={() => setSelectedType(null)} onlySolicitudes={selectedType === 'solicitudes'} onStartInspection={(tipo, data) => { setSolicitudData(data); setSelectedType(tipo); }} />
      ) : (
        <>
          <PageHeader title={formTitles[selectedType] || 'Inspeccion'} subtitle="Completa todos los campos"
            actions={(<Button type="button" variant="secondary" size="sm" onClick={() => { setSelectedType(null); setSolicitudData(null); }}>Volver</Button>)} />
          <InspectionForm type={selectedType} solicitudData={solicitudData} />
        </>
      )}
    </div>
  );
}

// Component to show recent inspections
function RecentInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(API_ENDPOINTS.GET_INSPECCIONES, { method: 'GET', headers });
      if (!response.ok) { setInspections([]); return; }
      const apiInspections = await response.json();
      if (!Array.isArray(apiInspections)) { setInspections([]); return; }
      const mapped = apiInspections.map((i) => ({ id: i.id, trabajador: i.nombre_empleado, centro: i.Centro }));
      setInspections(mapped.filter((x) => x.id && x.trabajador && x.centro).slice(-5).reverse());
    } catch { setInspections([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadInspections(); }, [loadInspections]);
  usePolling(loadInspections, 30000, true, 6000);
  if (loading) return <div className="app-card app-card--pad flex justify-center py-6"><LoadingSpinner text="Cargando..." /></div>;
  if (!inspections.length) return <div className="app-card app-card--pad text-sm text-gray-500 text-center">No hay inspecciones recientes.</div>;
  return (
    <div className="app-card app-card--pad space-y-2">
      <div className="inspecciones-list-toolbar">
        <h3 className="inspecciones-section-title">Inspecciones recientes</h3>
        <button type="button" className="solicitud-admin-icon-btn" onClick={loadInspections} aria-label="Actualizar"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {inspections.map((i, idx) => (
        <div key={i.id || idx} className="inspecciones-recent-row">
          <div className="min-w-0"><p className="text-sm font-semibold truncate">{i.id}</p><p className="text-xs text-gray-500 truncate">{i.trabajador} · {i.centro}</p></div>
          <span className="inspecciones-badge inspecciones-badge--done">Completada</span>
        </div>
      ))}
    </div>
  );
} 