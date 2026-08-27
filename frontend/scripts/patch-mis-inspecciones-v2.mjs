import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/pages/MisInspeccionesPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

src = src.replace(
  `import { Button, Card, LoadingSpinner } from '../components/ui';
import PDFViewerAndroid from '../components/PDFViewerAndroid';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants';
import activityLogger from '../utils/activityLogger';
import Back3DButton from '../components/Back3DButton.jsx';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';`,
  `import { Button, LoadingSpinner, PageHeader, AlertBanner } from '../components/ui';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants';
import activityLogger from '../utils/activityLogger';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import MisInspeccionesList from '../components/inspections/MisInspeccionesList';
import InspectionPdfPreviewModal from '../components/inspections/InspectionPdfPreviewModal';
import { MessageCircle, RefreshCw } from 'lucide-react';`,
);

const idx = src.search(/  return \(\r?\n    <div className="space-y-6">/);
if (idx < 0) throw new Error('return not found');
const end = src.lastIndexOf('\n}');

const tail = `  const weekCount = inspections.filter((inspection) => {
    const d = new Date(inspection.originalDate);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && !Number.isNaN(d.getTime());
  }).length;
  const monthCount = inspections.filter((inspection) => {
    const d = new Date(inspection.originalDate);
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    return d >= monthAgo && !Number.isNaN(d.getTime());
  }).length;
  const closePreviewModal = () => {
    if (previewData?.pdfUrl?.startsWith?.('blob:')) window.URL.revokeObjectURL(previewData.pdfUrl);
    setShowPreviewModal(false); setPreviewData(null);
  };

  return (
    <div className="mis-inspecciones-page app-page space-y-4">
      <PageHeader title="Mis Inspecciones" subtitle="Revisa y descarga tus inspecciones" backTo="/inicio"
        actions={(<><Button type="button" variant="secondary" size="sm" onClick={() => openWhatsAppErrorReport(buildErrorReportMessage({ authUser, pageName: 'Mis Inspecciones', pageData: {} }))}><MessageCircle className="w-4 h-4" /></Button><Button type="button" variant="secondary" size="sm" onClick={fetchInspections} disabled={loadingInspections}><RefreshCw className={\`w-4 h-4\${loadingInspections ? ' animate-spin' : ''}\`} /></Button></>)} />
      {!loadingInspections && !errorInspections ? (
        <div className="solicitud-admin-stat-grid">
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Total</p><p className="solicitud-admin-stat__value">{inspections.length}</p></div>
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Semana</p><p className="solicitud-admin-stat__value">{weekCount}</p></div>
          <div className="solicitud-admin-stat"><p className="solicitud-admin-stat__label">Mes</p><p className="solicitud-admin-stat__value">{monthCount}</p></div>
        </div>
      ) : null}
      {loadingInspections ? <div className="app-card app-card--pad flex justify-center py-10"><LoadingSpinner size="lg" text="Cargando..." /></div>
      : errorInspections ? <AlertBanner variant="error" title="Error">{errorInspections}<div className="mt-2"><Button size="sm" onClick={fetchInspections}>Reintentar</Button></div></AlertBanner>
      : <MisInspeccionesList items={inspections} onPreview={handlePreview} onDownload={handleDownload} />}
      <InspectionPdfPreviewModal isOpen={showPreviewModal} previewData={previewData} previewLoading={previewLoading} isIOS={isIOS} isAndroid={isAndroid} onClose={closePreviewModal} onDownload={handleDownload} />
    </div>
  );
}`;

src = src.slice(0, idx) + tail + src.slice(end);
fs.writeFileSync(filePath, src, 'utf8');
console.log('OK MisInspeccionesPage');
