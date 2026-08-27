import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/pages/InspeccionesPage.jsx');
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

const hubCards = [
  ['limpieza', 'Inspeccion de Limpieza', '17 zonas, evaluacion de calidad, firmas digitales.'],
  ['servicios', 'Servicios Auxiliares', '6 zonas de inspeccion.'],
  ['personalizada', 'Inspeccion Personalizada', 'Puntos personalizables.'],
  ['entrega-materiales', 'Entrega de Materiales', 'Registro de materiales por centro.'],
  ['pdf-generator', 'Lista de Inspecciones', 'Consultar y descargar PDFs.'],
  ['solicitudes', 'Inspecciones Solicitadas', 'Solicitudes pendientes.'],
].map(([id, title, desc]) => `          <button type="button" className="inspecciones-hub-card" onClick={() => setSelectedType('${id}')}>
            <span className="inspecciones-hub-card__icon"><InspectionTypeIcon type="${id}" className="w-5 h-5" /></span>
            <span><span className="inspecciones-hub-card__title">${title}</span><span className="inspecciones-hub-card__desc">${desc}</span></span>
          </button>`).join('\n');

const selectionLines = `  if (!selectedType) {
    return (
      <div className="inspecciones-page app-page">
        <PageHeader title="Inspecciones" subtitle="Selecciona el tipo de inspeccion" backTo="/inicio"
          actions={(<Button type="button" variant="secondary" size="sm" onClick={() => openWhatsAppErrorReport(buildErrorReportMessage({ authUser, pageName: 'Inspecciones', pageData: {} }))}><MessageCircle className="w-4 h-4" /> Reportar</Button>)} />
        <div className="inspecciones-hub-grid">${''}
${hubCards}
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
  }`.split('\n');

const formLines = `  const formTitles = { limpieza: 'Inspeccion de Limpieza', servicios: 'Inspeccion de Servicios Auxiliares', personalizada: 'Inspeccion Personalizada', 'entrega-materiales': 'Entrega de Materiales' };

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
}`.split('\n');

const startSel = lines.findIndex((l) => l.trim() === 'if (!selectedType) {');
let endSel = startSel;
while (endSel < lines.length && !(lines[endSel].trim() === '}' && lines[endSel + 1] === '' && lines[endSel + 2]?.trim() === 'return (')) {
  endSel += 1;
}
const retIdx = endSel + 2;
let endMain = retIdx;
while (endMain < lines.length && lines[endMain].trim() !== '}') endMain += 1;

const head = lines.slice(0, startSel);
const tail = lines.slice(endMain + 1);
const out = [...head, ...selectionLines, '', ...formLines, ...tail];
fs.writeFileSync(filePath, out.join('\n'), 'utf8');
console.log('Fixed InspeccionesPage', { startSel, endSel, retIdx, endMain });
