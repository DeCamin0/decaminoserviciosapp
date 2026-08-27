import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/pages/InspeccionesPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

const hubCards = [
  ['limpieza', 'Inspeccion de Limpieza', '17 zonas, evaluacion de calidad, firmas digitales.'],
  ['servicios', 'Servicios Auxiliares', '6 zonas de inspeccion para servicios auxiliares.'],
  ['personalizada', 'Inspeccion Personalizada', 'Puntos personalizables y configuracion flexible.'],
  ['entrega-materiales', 'Entrega de Materiales', 'Registro de materiales y suministros por centro.'],
  ['pdf-generator', 'Lista de Inspecciones', 'Consultar inspecciones y descargar PDFs.'],
  ['solicitudes', 'Inspecciones Solicitadas', 'Solicitudes pendientes de completar.'],
].map(([id, title, desc]) => `          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('${id}')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="${id}" className="w-5 h-5" /></span>
            <span>
              <span className="inspecciones-hub-card__title">${title}</span>
              <span className="inspecciones-hub-card__desc">${desc}</span>
            </span>
          </button>`).join('\n');

const selectionBlock = `  if (!selectedType) {
    return (
      <div className="inspecciones-page app-page">
        <PageHeader
          title="Inspecciones"
          subtitle="Selecciona el tipo de inspeccion que deseas realizar"
          backTo="/inicio"
          backTitle="Volver al inicio"
          actions={(
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openWhatsAppErrorReport(buildErrorReportMessage({ authUser, pageName: 'Inspecciones', pageData: {} }))}
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Reportar error
            </Button>
          )}
        />
        <div className="inspecciones-hub-grid">
${hubCards}
        </div>
        <section className="mt-4">
          <h2 className="inspecciones-section-title mb-2">Estadisticas del sistema</h2>
          <div className="solicitud-admin-stat-grid">
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Centros</p><p className="solicitud-admin-stat__value">{centrosStats.totalCentros}</p></div>
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Empleados</p><p className="solicitud-admin-stat__value">{centrosStats.totalEmpleados}</p></div>
            <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Activos</p><p className="solicitud-admin-stat__value">{centrosStats.centrosActivos}</p></div>
          </div>
        </section>
        <section className="mt-4"><RecentInspections /></section>
      </div>
    );
  }`;

src = src.replace(/\n  if \(!selectedType\) \{[\s\S]*?\n  \}\n\n  return \(/, `\n${selectionBlock}\n\n  return (`);

const formReturn = `  const formTitles = {
    limpieza: 'Inspeccion de Limpieza',
    servicios: 'Inspeccion de Servicios Auxiliares',
    personalizada: 'Inspeccion Personalizada',
    'entrega-materiales': 'Entrega de Materiales',
  };

  return (
    <div className="inspecciones-page app-page">
      {selectedType === 'pdf-generator' || selectedType === 'solicitudes' ? (
        <InspectionList
          onBackToSelection={() => setSelectedType(null)}
          onlySolicitudes={selectedType === 'solicitudes'}
          onStartInspection={(tipo, data) => { setSolicitudData(data); setSelectedType(tipo); }}
        />
      ) : (
        <>
          <PageHeader
            title={formTitles[selectedType] || 'Inspeccion'}
            subtitle="Completa todos los campos y envia la inspeccion"
            actions={(
              <Button type="button" variant="secondary" size="sm" onClick={() => { setSelectedType(null); setSolicitudData(null); }}>
                Volver
              </Button>
            )}
          />
          <InspectionForm type={selectedType} solicitudData={solicitudData} />
        </>
      )}
    </div>
  );
}`;

src = src.replace(/\n  return \([\s\S]*?\n\}\n\n\/\/ Component to show recent inspections/, `\n${formReturn}\n\n// Component to show recent inspections`);

src = src.replace(
  /function RecentInspections\(\) \{[\s\S]*?\n\}/,
  `function RecentInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers.Authorization = \`Bearer \${token}\`;
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
}`,
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('OK InspeccionesPage');
