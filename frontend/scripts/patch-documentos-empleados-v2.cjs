/**
 * Visual Refresh V2 — Documentos Empleados
 * UTF-8 safe patch script
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

function replaceOnce(haystack, search, replacement, label) {
  if (!haystack.includes(search)) {
    console.error(`MISSING: ${label}`);
    process.exit(1);
  }
  return haystack.replace(search, replacement);
}

// 1. Imports
src = replaceOnce(src,
`import { useState, useEffect, useRef, useCallback } from 'react';

import { useAuth } from '../contexts/AuthContextBase';

import ContractSigner from '../components/ContractSigner';
import PDFViewerAndroid from '../components/PDFViewerAndroid';

import { Link } from 'react-router';

import Back3DButton from '../components/Back3DButton.jsx';
import ChangeEmployee3DButton from '../components/ChangeEmployee3DButton.jsx';
import EmailIngestionButton from '../components/EmailIngestionButton';
import FolderIngestionButton from '../components/FolderIngestionButton';

import { Button, Card, LoadingSpinner } from '../components/ui';

import Notification from '../components/ui/Notification';`,
`import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../contexts/AuthContextBase';

import ContractSigner from '../components/ContractSigner';
import PDFViewerAndroid from '../components/PDFViewerAndroid';

import { Link } from 'react-router';

import EmailIngestionButton from '../components/EmailIngestionButton';
import FolderIngestionButton from '../components/FolderIngestionButton';

import { Button, Card, LoadingSpinner, PageHeader, AlertBanner, SegmentedControl, Modal } from '../components/ui';
import Notification from '../components/ui/Notification';
import {
  Users, Briefcase, Wallet, GraduationCap, FileText, Building2, HardHat, Upload,
  Search, X, RefreshCw, ArrowLeft, Eye, FileSpreadsheet,
} from 'lucide-react';`,
'imports');

// 2. Access restricted screen
src = replaceOnce(src,
`  if (!isManager) {

    return (

      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <h1 className="text-2xl font-bold text-red-600 mb-4">

            Acceso Restringido

          </h1>

          <p className="text-gray-600 mb-6">

            Solo los managers pueden acceder a esta página.

          </p>

          <Link 

            to="/inicio"

            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"

          >

            ← Volver al Inicio

          </Link>

        </div>

      </div>

    );

  }`,
`  if (!isManager) {
    return (
      <div className="app-page documentos-empleados-page">
        <PageHeader title="Acceso restringido" subtitle="Solo los managers pueden acceder a esta página" backTo="/inicio" />
        <AlertBanner variant="danger" title="Permisos insuficientes">
          No tienes permisos para gestionar documentos de empleados.
        </AlertBanner>
        <Link to="/inicio" className="solicitud-admin-btn solicitud-admin-btn--primary inline-flex w-fit">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          <span>Volver al inicio</span>
        </Link>
      </div>
    );
  }

  const mainTabs = [
    { id: 'empleados', label: 'Empleados', shortLabel: 'Emp.' },
    { id: 'gestoria-nominas', label: 'Gestoría Nóminas', shortLabel: 'Gestoría' },
    { id: 'coste-personal', label: 'Coste Personal', shortLabel: 'Coste' },
    { id: 'diplomas', label: 'Diplomas', shortLabel: 'Dipl.' },
    { id: 'certificados-retenciones', label: 'Certificados retenciones', shortLabel: 'Cert.' },
  ];

  const empleadoSubTabs = [
    { id: 'documentos', label: 'Documentos', shortLabel: 'Docs' },
    { id: 'nominas', label: 'Nóminas', shortLabel: 'Nom.' },
    { id: 'documentos-empresa', label: 'Empresa', shortLabel: 'Emp.' },
    { id: 'documentos-prl', label: 'PRL', shortLabel: 'PRL' },
    { id: 'subir-documentos', label: 'Subir', shortLabel: 'Subir' },
  ];

  const handleMainTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedEmpleado(null);
  };

  const getEmpleadoInitials = (empleado) => {
    const name = empleado?.['NOMBRE / APELLIDOS'] || '';
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  const volverEmpleadosBtn = (
    <button
      type="button"
      onClick={() => {
        setActiveTab('empleados');
        setSelectedEmpleado(null);
      }}
      className="solicitud-admin-btn shrink-0"
      title="Volver a la lista de empleados"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden />
      <span className="hidden sm:inline">Volver</span>
    </button>
  );`,
'access-restricted-and-helpers');

// 3. Replace outer shell start through content panel opening
const shellStart = `  return (
    <>
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-red-50">`;

const shellEndMarker = `        {/* Contenido de tabs */}
        <div 
          className="p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(229, 231, 235, 0.3)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          }}
        >`;

const shellStartIdx = src.indexOf(shellStart);
const shellEndIdx = src.indexOf(shellEndMarker);
if (shellStartIdx === -1 || shellEndIdx === -1) {
  console.error('MISSING: shell markers');
  process.exit(1);
}

const newShell = `  return (
    <>
    <div className="app-page documentos-empleados-page">
      <PageHeader
        title="Documentos por Empleado"
        subtitle="Gestiona documentos, nóminas y certificados por empleado"
        backTo="/inicio"
        actions={
          (isManager || authUser?.GRUPO === 'Admin' || authUser?.GRUPO === 'Developer' || authUser?.GRUPO === 'Supervisor') ? (
            <div className="documentos-empleados-header-actions flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={fetchEmpleadosConStatusContratos}
                disabled={loadingContratos}
                className="solicitud-admin-btn"
                title="Ver lista de empleados con status de contratos"
              >
                <FileSpreadsheet className={\`w-4 h-4 \${loadingContratos ? 'animate-spin' : ''}\`} aria-hidden />
                <span className="hidden sm:inline">Status contratos</span>
              </button>
              <EmailIngestionButton />
              <FolderIngestionButton />
            </div>
          ) : null
        }
      />

      <SegmentedControl
        layout="grid"
        value={activeTab}
        onChange={handleMainTabChange}
        className="documentos-empleados-main-tabs"
        items={mainTabs}
      />

      {selectedEmpleado && activeTab === 'empleados' && (
        <div className="documentos-empleados-context app-card app-card--pad">
          <div className="documentos-empleados-context__row">
            <div className="documentos-empleados-context__identity min-w-0">
              <div className="documentos-empleados-avatar">
                {employeeAvatars[selectedEmpleado.CODIGO] ? (
                  <img src={employeeAvatars[selectedEmpleado.CODIGO]} alt="" />
                ) : (
                  <span>{getEmpleadoInitials(selectedEmpleado)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="documentos-empleados-context__name truncate">
                  {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                </p>
                <p className="documentos-empleados-context__meta truncate">
                  {selectedEmpleado.CODIGO}
                  {selectedEmpleado['CENTRO TRABAJO'] ? \` · \${selectedEmpleado['CENTRO TRABAJO']}\` : ''}
                  {selectedEmpleado.GRUPO ? \` · \${selectedEmpleado.GRUPO}\` : ''}
                </p>
              </div>
            </div>
            {volverEmpleadosBtn}
          </div>
          <SegmentedControl
            layout="grid"
            value={activeEmpleadoTab}
            onChange={setActiveEmpleadoTab}
            className="documentos-empleados-sub-tabs"
            items={empleadoSubTabs}
          />
        </div>
      )}

      <div className="documentos-empleados-tab-panel app-card app-card--pad">`;

src = src.slice(0, shellStartIdx) + newShell + src.slice(shellEndIdx + shellEndMarker.length);

// 4. Replace employee list section
const empListStart = `          {activeTab === 'empleados' && !selectedEmpleado && (
            <div>
              {/* Section Title and Search Bar - Side by Side */}
              <div className="flex items-center justify-between mb-8">`;

const empListEnd = `            {filteredEmpleados.length === 0 ? (
                <div 
                  className="text-center py-16"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '1.5rem',
                    border: '2px solid rgba(239, 68, 68, 0.1)',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                  }}
                >
                  <div className="text-6xl mb-4">🔍</div>
                  <p 
                    className="text-gray-600 font-medium text-lg"
                    style={{
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {searchTerm ? 'No se encontraron empleados con esa búsqueda.' : 'No hay empleados disponibles.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">`;

const empListStartIdx = src.indexOf(empListStart);
const empListEndIdx = src.indexOf(empListEnd);
if (empListStartIdx === -1 || empListEndIdx === -1) {
  console.error('MISSING: employee list markers');
  process.exit(1);
}

const newEmpList = `          {activeTab === 'empleados' && !selectedEmpleado && (
            <div>
              <div className="solicitud-admin-toolbar documentos-empleados-section-head">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Selecciona un empleado</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Busca por nombre, código, email o grupo</p>
                </div>
              </div>

              <div className="documentos-empleados-filter-bar app-card app-card--pad">
                <div className="documentos-empleados-search-wrap">
                  <Search className="documentos-empleados-search-icon w-4 h-4" aria-hidden />
                  <input
                    id="documentos-empleados-search"
                    name="documentos-empleados-search"
                    type="search"
                    placeholder="Buscar empleado…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="documentos-empleados-search-input"
                    aria-label="Buscar empleados"
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')} className="solicitud-admin-btn documentos-empleados-search-clear" aria-label="Limpiar búsqueda">
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>

              {searchTerm && (
                <AlertBanner variant="info" compact className="mb-3">
                  {filteredEmpleados.length} empleado{filteredEmpleados.length !== 1 ? 's' : ''} encontrado{filteredEmpleados.length !== 1 ? 's' : ''}
                </AlertBanner>
              )}

            {filteredEmpleados.length === 0 ? (
                <AlertBanner variant="neutral" title="Sin resultados">
                  {searchTerm ? 'No se encontraron empleados con esa búsqueda.' : 'No hay empleados disponibles.'}
                </AlertBanner>
              ) : (
                <div className="documentos-empleados-employee-list solicitud-admin-mobile-list">`;

src = src.slice(0, empListStartIdx) + newEmpList + src.slice(empListEndIdx + empListEnd.length);

// 5. Replace employee cards
const oldCardPattern = /                  \{filteredEmpleados\.map\(\(empleado, idx\) => \(\s*<div[\s\S]*?<\/div>\s*\)\)\}/;
const newCards = `                  {filteredEmpleados.map((empleado, idx) => (
                    <article
                      key={empleado.CODIGO || idx}
                      className="solicitud-admin-mobile-card documentos-empleados-employee-card"
                    >
                      <div className="solicitud-admin-mobile-card__head">
                        <div className="documentos-empleados-avatar">
                          {employeeAvatars[empleado.CODIGO] ? (
                            <img src={employeeAvatars[empleado.CODIGO]} alt="" />
                          ) : (
                            <span>{getEmpleadoInitials(empleado)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="solicitud-admin-mobile-card__title truncate">
                            {empleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {empleado.CODIGO}
                            {empleado['CENTRO TRABAJO'] ? \` · \${empleado['CENTRO TRABAJO']}\` : ''}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{empleado['CORREO ELECTRONICO'] || 'Sin email'}</p>
                        </div>
                        {empleado.GRUPO && (
                          <span className="solicitud-status solicitud-status--neutral shrink-0">{empleado.GRUPO}</span>
                        )}
                      </div>
                      <div className="empleados-card-actions">
                        <button
                          type="button"
                          onClick={() => handleEmpleadoSelect(empleado)}
                          className="solicitud-admin-btn solicitud-admin-btn--primary empleados-card-actions__primary"
                        >
                          <Eye className="w-4 h-4" aria-hidden />
                          <span>Ver documentos</span>
                        </button>
                      </div>
                    </article>
                  ))}`;

if (!oldCardPattern.test(src)) {
  console.error('MISSING: employee card pattern');
  process.exit(1);
}
src = src.replace(oldCardPattern, newCards);

// 6. Replace ChangeEmployee3DButton globally
src = src.replace(/<ChangeEmployee3DButton[\s\S]*?\/>/g, '{volverEmpleadosBtn}');

// 7. Replace upload modal
src = replaceOnce(src,
`      {/* Modal para selección de tipo de documento */}
      {showUploadModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-lg font-bold text-gray-900">

                📋 Configurar Documentos

              </h3>

              <button

                onClick={handleUploadCancel}

                className="text-gray-400 hover:text-gray-600"

              >

                ✕

              </button>

            </div>`,
`      {/* Modal para selección de tipo de documento */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showUploadModal}
          onClose={handleUploadCancel}
          title="Configurar documentos"
          size="md"
          className="app-modal--form documentos-empleados-upload-modal"
        >`,
'upload-modal-start');

src = replaceOnce(src,
`              <div className="flex space-x-3 pt-4">

                <button

                  onClick={handleUploadCancel}

                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"

                >

                  Cancelar

                </button>

                <button

                  onClick={handleUploadConfirm}

                  disabled={uploading || !Object.values(documentTypes).every(type => type.trim())}

                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"

                >

                  {uploading ? (

                    <span className="flex items-center justify-center">

                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>

                      Subiendo...

                    </span>

                  ) : (

                    'Subir Documentos'

                  )}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}`,
`            </div>
        </Modal>,
        document.body
      )}`,
'upload-modal-end');

// Fix upload modal inner - selected files box
src = src.replace(
`              <div className="bg-gray-50 rounded-lg p-4">

                <h4 className="font-medium text-gray-900 mb-2">Archivos Seleccionados:</h4>`,
`              <div className="app-card app-card--pad documentos-empleados-upload-files">

                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Archivos seleccionados</h4>`);

src = src.replace(
`                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"`,
`                  className="app-modal__input w-full"`);

// 8. Replace info Card with compact banner
src = replaceOnce(src,
`      {/* Información */}

      <Card>

        <h3 className="text-lg font-bold text-red-600 mb-3">Información</h3>

        <div className="space-y-2 text-sm text-gray-600">

          <p>• Selecciona un empleado para ver sus documentos</p>

          <p>• Visualiza estadísticas de documentos y nóminas</p>

          <p>• Accede a la lista completa de documentos del empleado</p>

          <p>• Gestiona nóminas y recibos de salario</p>

          <p>• Visualiza y descarga documentos existentes</p>

          <p>• Sube nuevos documentos para cada empleado</p>

          <p>• Formatos soportados: PDF, DOC, DOCX, JPG, PNG, TXT</p>

        </div>

      </Card>`,
`      <AlertBanner variant="info" compact className="documentos-empleados-info">
        Selecciona un empleado para gestionar documentos, nóminas y certificados. Formatos: PDF, DOC, DOCX, JPG, PNG, TXT.
      </AlertBanner>`,
'info-card');

// 9. Preview modal outer wrapper
src = replaceOnce(src,
`      {/* Modal para preview de documentos */}

      {showPreviewModal && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-0 sm:p-4">

          <div className="bg-white rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-auto sm:max-h-[95vh] overflow-hidden shadow-2xl border-0 sm:border border-gray-200 animate-in fade-in duration-300 relative flex flex-col">

            {/* Header moderno */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-blue-200 relative flex-shrink-0">

              <div className="flex items-center justify-between gap-2 pr-16 sm:pr-0">

                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">

                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">

                    <span className="text-white text-lg sm:text-xl">👁️</span>

                  </div>

                  <div className="min-w-0 flex-1">

                    <h3 className="text-base sm:text-xl font-bold text-gray-900 break-all leading-tight truncate">

                      Vista Previa: {previewDocument?.fileName || 'Documento'}

                      {previewDocument?.tipo === 'Nómina' && <span className="ml-2 text-sm text-green-600">(Nómina)</span>}

                    </h3>

                    <p className="text-xs sm:text-sm text-blue-600 font-medium hidden sm:block">Visualización de documento</p>

                  </div>

                </div>

                {/* Buton de închidere în header - ascuns pe mobil, vizibil pe desktop */}

                <button

                  onClick={handleClosePreview}

                  className="hidden sm:flex w-10 h-10 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group flex-shrink-0 touch-manipulation"

                  aria-label="Cerrar preview"

                >

                  <span className="text-gray-400 group-hover:text-red-500 text-xl">✕</span>

                </button>

              </div>

            </div>`,
`      {/* Modal para preview de documentos */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showPreviewModal}
          onClose={handleClosePreview}
          title={\`Vista previa: \${previewDocument?.fileName || 'Documento'}\${previewDocument?.tipo === 'Nómina' ? ' (Nómina)' : ''}\`}
          size="xl"
          className="app-modal--preview documentos-empleados-preview-modal"
          showCloseButton
          footer={(
            <button type="button" onClick={handleClosePreview} className="app-modal__btn solicitud-admin-btn w-full sm:w-auto">
              Cerrar
            </button>
          )}
        >
          <div className="documentos-preview-body relative">`,
'preview-modal-start');

src = replaceOnce(src,
`            {/* Buton de închidere fixat jos - VIZIBIL PE MOBIL */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white sm:hidden" style={{ zIndex: 10001, marginBottom: '64px' }}>
              <button
                onClick={handleClosePreview}
                className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold text-lg rounded-none transition-all duration-200 shadow-lg touch-manipulation"
                aria-label="Cerrar preview"
                style={{ 
                  paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
                  position: 'relative',
                  zIndex: 10001
                }}
              >
                Cerrar preview
              </button>
            </div>

          </div>

        </div>

      )}`,
`          </div>
        </Modal>,
        document.body
      )}`,
'preview-modal-end');

// 10. Fix closing outer page div - remove extra closing from old structure
// Notification should be outside page div
src = src.replace(
`      {/* Component de notificare */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        duration={notification.duration}
        onClose={hideNotification}
      />
    </div>
    </>`,
`    </div>

      {/* Component de notificare */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        duration={notification.duration}
        onClose={hideNotification}
      />
    </>`);

fs.writeFileSync(filePath, src, 'utf8');
console.log('OK: DocumentosEmpleadosPage V2 patched');
