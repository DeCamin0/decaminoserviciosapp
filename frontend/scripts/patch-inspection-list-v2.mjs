import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/components/inspections/InspectionList.jsx');
let src = fs.readFileSync(filePath, 'utf8');

src = src.replace(
  `import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';

import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { routes } from '../../utils/routes';
import { API_ENDPOINTS } from '../../utils/constants';
import Back3DButton from '../Back3DButton.jsx';
import PDFViewerAndroid from '../PDFViewerAndroid.jsx';`,
  `import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';

import { Button, LoadingSpinner, Modal, PageHeader } from '../ui';
import { routes } from '../../utils/routes';
import { API_ENDPOINTS } from '../../utils/constants';
import { RefreshCw } from 'lucide-react';
import InspectionFiltersPanel from './InspectionFiltersPanel';
import InspectionsAdminList from './InspectionsAdminList';
import InspectionPdfPreviewModal from './InspectionPdfPreviewModal';
import { InspectionTypeIcon } from './inspectionUi';`,
);

const helperBlock = `
  const filteredEmployees = useMemo(() => employees.filter((emp) =>
    (!selectedCentro || emp.centro === selectedCentro)
    && (employeeSearchTerm === ''
      || emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      || emp.code.toLowerCase().includes(employeeSearchTerm.toLowerCase())),
  ), [employees, selectedCentro, employeeSearchTerm]);

  const filteredCentros = useMemo(() => centros.filter((centro) =>
    centroSearchTerm === '' || centro.toLowerCase().includes(centroSearchTerm.toLowerCase()),
  ), [centros, centroSearchTerm]);

  const monthYearOptions = useMemo(() => getAvailableMonths().map((monthYear) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return { value: monthYear, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }), [inspections]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setSelectedEmployee('');
    setSelectedCentro('');
    setEmployeeSearchTerm('');
    setCentroSearchTerm('');
    setInspectorSearchTerm('');
    setSelectedMonthYear('all');
    setSortBy('fecha');
    setSortOrder('desc');
    setShowEmployeeDropdown(false);
    setShowCentroDropdown(false);
  };

  const handleStartSolicitud = (inspection) => {
    setSelectedSolicitud(inspection);
    setShowTipoModal(true);
  };

  const closePreviewModal = () => {
    if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewData.pdfUrl);
    }
    setShowPreviewModal(false);
    setPreviewData(null);
  };
`;

if (!src.includes('const filteredEmployees = useMemo')) {
  src = src.replace(
    '  const sortedAndFilteredInspections = sortInspections(filteredInspections);\n',
    `  const sortedAndFilteredInspections = sortInspections(filteredInspections);\n${helperBlock}\n`,
  );
}

src = src.replace(/\n  const getTypeLabel = [\s\S]*?return type \|\| 'Desconocido';\n  };\n\n/, '\n');

const tail = `
  if (loading) {
    return (
      <div className="app-card app-card--pad flex justify-center py-10">
        <LoadingSpinner size="lg" text="Cargando inspecciones..." />
      </div>
    );
  }

  return (
    <div className="inspecciones-list space-y-4">
      <PageHeader
        title={onlySolicitudes ? 'Inspecciones solicitadas' : 'Lista de inspecciones'}
        subtitle={onlySolicitudes
          ? 'Solicitudes pendientes de completar'
          : 'Consulta inspecciones existentes y descarga PDFs'}
        className="inspecciones-list__header"
        actions={(
          <button
            type="button"
            className="solicitud-admin-icon-btn"
            onClick={onBackToSelection}
            aria-label="Volver a seleccion"
          >
            &larr;
          </button>
        )}
      />

      <InspectionFiltersPanel
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        selectedEmployee={selectedEmployee}
        onSelectedEmployeeChange={setSelectedEmployee}
        employeeSearchTerm={employeeSearchTerm}
        onEmployeeSearchTermChange={setEmployeeSearchTerm}
        showEmployeeDropdown={showEmployeeDropdown}
        onShowEmployeeDropdownChange={setShowEmployeeDropdown}
        filteredEmployees={filteredEmployees}
        selectedCentro={selectedCentro}
        onSelectedCentroChange={setSelectedCentro}
        centroSearchTerm={centroSearchTerm}
        onCentroSearchTermChange={setCentroSearchTerm}
        showCentroDropdown={showCentroDropdown}
        onShowCentroDropdownChange={setShowCentroDropdown}
        filteredCentros={filteredCentros}
        inspectorSearchTerm={inspectorSearchTerm}
        onInspectorSearchTermChange={setInspectorSearchTerm}
        selectedMonthYear={selectedMonthYear}
        onSelectedMonthYearChange={setSelectedMonthYear}
        monthYearOptions={monthYearOptions}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onResetFilters={resetFilters}
        loadingEmployees={loadingEmployees}
        onlySolicitudes={onlySolicitudes}
      />

      <section className="app-card app-card--pad">
        <div className="inspecciones-list-toolbar">
          <h2 className="inspecciones-section-title">
            Inspecciones ({sortedAndFilteredInspections.length})
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={fetchInspections} disabled={loading}>
            <RefreshCw className={\`w-4 h-4\${loading ? ' animate-spin' : ''}\`} aria-hidden />
            Actualizar
          </Button>
        </div>

        <InspectionsAdminList
          items={sortedAndFilteredInspections}
          materialesDocumentos={materialesDocumentos}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onStartSolicitud={handleStartSolicitud}
          onLoadDocs={fetchMaterialesDocumentos}
          onDownloadDoc={handleDownloadMaterialDocumento}
        />
      </section>

      <InspectionPdfPreviewModal
        isOpen={showPreviewModal}
        previewData={previewData}
        previewLoading={previewLoading}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onClose={closePreviewModal}
        onDownload={(data) => handleDownload(data)}
      />

      <Modal
        isOpen={showTipoModal}
        onClose={() => {
          setShowTipoModal(false);
          setSelectedSolicitud(null);
        }}
        title="Seleccionar tipo de inspeccion"
        size="md"
        showCloseButton={false}
        className="app-modal--form"
        footer={(
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowTipoModal(false);
              setSelectedSolicitud(null);
            }}
          >
            Cancelar
          </Button>
        )}
      >
        {selectedSolicitud ? (
          <div className="space-y-4">
            <div className="app-card app-card--pad inspecciones-solicitud-info">
              <p className="text-sm font-semibold mb-2">Informacion de la solicitud</p>
              <p className="text-sm"><span className="font-semibold">Empleado:</span> {selectedSolicitud.trabajador} ({selectedSolicitud.employeeCode})</p>
              <p className="text-sm"><span className="font-semibold">Centro:</span> {selectedSolicitud.centro}</p>
              {selectedSolicitud.observaciones ? (
                <p className="text-sm mt-2"><span className="font-semibold">Observaciones:</span> {selectedSolicitud.observaciones}</p>
              ) : null}
            </div>

            <div className="inspecciones-tipo-modal-grid">
              {[
                { type: 'limpieza', title: 'Limpieza', desc: 'Inspeccion de limpieza' },
                { type: 'servicios', title: 'Servicios Auxiliares', desc: 'Inspeccion de servicios' },
                { type: 'personalizada', title: 'Personalizada', desc: 'Inspeccion personalizada' },
                { type: 'entrega-materiales', title: 'Entrega de Materiales', desc: 'Registro de entrega' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  className="inspecciones-tipo-option"
                  onClick={() => {
                    if (onStartInspection) {
                      onStartInspection(opt.type, selectedSolicitud);
                    }
                    setShowTipoModal(false);
                    setSelectedSolicitud(null);
                  }}
                >
                  <InspectionTypeIcon type={opt.type} className="w-5 h-5 shrink-0 text-[var(--primary-color)]" />
                  <span>
                    <span className="block font-semibold text-sm">{opt.title}</span>
                    <span className="block text-xs text-gray-500">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default InspectionList;
`;

const marker = '\n  if (loading) {';
const idx = src.indexOf(marker);
if (idx === -1) {
  throw new Error('Could not find loading block');
}
src = src.slice(0, idx) + tail;
fs.writeFileSync(filePath, src, 'utf8');
console.log('Patched InspectionList.jsx');
