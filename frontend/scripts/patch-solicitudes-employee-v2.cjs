/**
 * Visual Refresh V2 — Solicitudes employee block (UI only).
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/SolicitudesPage.jsx');
let c = fs.readFileSync(filePath, 'utf8');
const hadCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

function tryReplace(label, from, to) {
  if (!c.includes(from)) {
    if (c.includes(to)) {
      console.log(`SKIP: ${label} (already applied)`);
      return;
    }
    console.warn(`WARN: ${label} — pattern not found`);
    return;
  }
  c = c.replace(from, to);
  console.log(`OK: ${label}`);
}

// --- imports & helpers ---
tryReplace(
  'imports',
  `import Back3DButton from '../components/Back3DButton.jsx';
import { Card, LoadingSpinner } from '../components/ui';`,
  `import { Card, LoadingSpinner, PageHeader, AlertBanner, SegmentedControl } from '../components/ui';`
);

tryReplace(
  'getStatusIndicatorColor',
  `const getStatusIndicatorColor = (estado) => {
  switch (estado) {
    case 'Aprobada':
      return 'bg-green-500';
    case 'Pendiente':
      return 'bg-yellow-500';
    case 'Rechazada':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};`,
  `const getStatusIndicatorColor = (estado) => {
  switch (estado) {
    case 'Aprobada':
      return 'solicitud-status-dot solicitud-status-dot--ok';
    case 'Pendiente':
      return 'solicitud-status-dot solicitud-status-dot--pendiente';
    case 'Rechazada':
      return 'solicitud-status-dot solicitud-status-dot--rechazada';
    case 'Anulada':
    case 'Cancelada':
      return 'solicitud-status-dot solicitud-status-dot--anulada';
    default:
      return 'solicitud-status-dot solicitud-status-dot--neutral';
  }
};`
);

tryReplace(
  'getStatusColor',
  `  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Aprobada':
        return 'bg-green-100 text-green-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rechazada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };`,
  `  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Aprobada':
        return 'solicitud-status solicitud-status--ok';
      case 'Pendiente':
        return 'solicitud-status solicitud-status--pendiente';
      case 'Rechazada':
        return 'solicitud-status solicitud-status--rechazada';
      case 'Anulada':
      case 'Cancelada':
        return 'solicitud-status solicitud-status--anulada';
      default:
        return 'solicitud-status solicitud-status--neutral';
    }
  };`
);

// --- mobile row ---
tryReplace(
  'MobileSolicitudItem wrapper',
  `    <div className="relative">`,
  `    <div className="solicitud-row">`
);

tryReplace(
  'MobileSolicitudItem row',
  `      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/galben/roșu) */}
        <div className={\`w-2 h-2 rounded-full flex-shrink-0 \${getStatusIndicatorColor(solicitud.estado)}\`}></div>`,
  `      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="solicitud-row__main"
        aria-expanded={isExpanded}
      >
        <span className={getStatusIndicatorColor(solicitud.estado)} aria-hidden />`
);

tryReplace(
  'MobileSolicitudItem chevron',
  `        <span className={\`text-gray-400 text-[10px] transition-transform flex-shrink-0 \${isExpanded ? 'rotate-180' : ''}\`}>
          ▼
        </span>
      </div>`,
  `        <span className={\`solicitud-row__chev \${isExpanded ? 'is-open' : ''}\`} aria-hidden>
          ▼
        </span>
      </button>`
);

tryReplace(
  'MobileSolicitudItem details',
  `        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">`,
  `        <div className="solicitud-row__details space-y-2">`
);

// --- page shell ---
if (c.includes('className="app-page solicitud-page"')) {
  console.log('SKIP: page shell (already applied)');
} else {
  const headerRe = /  return \(\n    <div className="space-y-6">[\s\S]*?\{canAccessAllTabs && \(/;
  const headerMatch = c.match(headerRe);
  if (!headerMatch) {
    console.warn('WARN: page shell — could not match header block');
  } else {
    const adminStart = headerMatch.index + headerMatch[0].length;
    const newPrefix = `  return (
    <div className="app-page solicitud-page">
      <PageHeader
        className="solicitud-page-header"
        title="Gestión de Solicitudes"
        subtitle="Solicita días de asuntos propios o vacaciones"
        backTo="/inicio"
        backTitle="Regresar al Dashboard"
        actions={
          <button
            type="button"
            onClick={() => {
              const solicitudesActivas = solicitudes?.filter(s =>
                s.estado === 'Pendiente' || s.estado === 'Aprobada'
              ) || [];
              const tiposSolicitudes = [...new Set(solicitudesActivas.map(s => s.tipo || s.TIPO))].filter(Boolean);
              const pageData = {
                additionalInfo: [
                  solicitudesActivas.length > 0 ? \`[SOLICITUDES] Total activas: \${solicitudesActivas.length}\` : null,
                  tiposSolicitudes.length > 0 ? \`[TIPOS] \${tiposSolicitudes.join(", ")}\` : null,
                  allSolicitudes?.length > 0 ? \`[TOTAL] \${allSolicitudes.length} solicitudes en total\` : null,
                ].filter(Boolean),
              };
              const message = buildErrorReportMessage({
                authUser,
                userData: empleadoCompleto,
                pageName: "Gestión de Solicitudes",
                pageData,
              });
              openWhatsAppErrorReport(message);
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm,0.65rem)] border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            Reportar error
          </button>
        }
      />

      {loadingPermissions && (
        <AlertBanner loading title="Cargando permisos..." />
      )}

      {!loadingPermissions && !canAccessPage && (
        <AlertBanner variant="warning" title="No tienes acceso a esta página">
          No tienes permisos configurados para acceder a la página de Solicitudes. Por favor, contacta con tu supervisor.
        </AlertBanner>
      )}

      {!loadingPermissions && canAccessPage && (
      <>
        <SegmentedControl
          value={activeTab === 'lista' || activeTab === 'nueva' ? activeTab : ''}
          onChange={setActiveTab}
          items={[
            { id: 'lista', label: 'Mis solicitudes', shortLabel: 'Mis' },
            { id: 'nueva', label: 'Nueva solicitud', shortLabel: 'Nueva' },
          ]}
          className="solicitud-employee-tabs"
        />

        {canAccessAllTabs && (
          <div className="solicitud-admin-tabs-legacy flex flex-wrap gap-4">`;
    c = c.slice(0, headerMatch.index) + newPrefix + c.slice(adminStart);
    console.log('OK: page shell header');
  }
}

// Remove employee glow tabs (keep admin buttons)
const employeeTabsRe = /          <button\n            onClick=\{\(\) => setActiveTab\('lista'\)\}[\s\S]*?          <\/button>\n\n          <button\n            onClick=\{\(\) => setActiveTab\('nueva'\)\}[\s\S]*?          <\/button>\n\n          \{canAccessAllTabs && \(/;
if (employeeTabsRe.test(c) && !c.includes('solicitud-admin-tabs-legacy')) {
  c = c.replace(employeeTabsRe, '{canAccessAllTabs && (');
  console.log('OK: remove employee glow tabs');
} else if (c.includes('solicitud-admin-tabs-legacy')) {
  console.log('SKIP: employee glow tabs');
}

tryReplace(
  'admin tabs wrapper close',
  `            </>
          )}
        </div>

        {activeTab === 'lista' ? (`,
  `            </>
          )}
        </div>
        )}

        <div className="app-card app-card--pad solicitud-panel">
        {activeTab === 'lista' ? (`
);

tryReplace(
  'close panel',
  `        )}
      </Card>
      )}`,
  `        )}
        </div>
      </>
      )}`
);

// --- lista ---
tryReplace(
  'lista header',
  `            <div className={\`flex \${isMobile ? 'flex-col' : 'items-center justify-between'} \${isMobile ? 'gap-2 mb-4' : 'mb-6'}\`}>
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <h2 className={\`\${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900\`}>
                  Mis Solicitudes
                </h2>
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <span>Año:</span>
                  <select
                    value={misSolicitudesYear}
                    onChange={(e) => setMisSolicitudesYear(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >`,
  `            <div className="solicitud-list-header">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h2 className="solicitud-list-header__title">Mis solicitudes</h2>
                <label className="fichaje-month inline-flex items-center gap-1.5 mb-0">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Año</span>
                  <select
                    value={misSolicitudesYear}
                    onChange={(e) => setMisSolicitudesYear(Number(e.target.value))}
                    className="fichaje-month__select"
                    style={{ flex: '0 1 auto', minWidth: '5.5rem' }}
                  >`
);

tryReplace(
  'lista metrics',
  `              <div className={\`flex \${isMobile ? 'flex-wrap gap-1.5 mt-1' : 'gap-3'}\`}>
                {totalAsuntoPropioDaysForYear > 0 && (
                  <span className={\`inline-flex items-center \${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'} font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200\`}>
                    📅 Asunto Propio: {totalAsuntoPropioDaysForYear} días
                  </span>
                )}
                {totalVacacionesDaysForYear > 0 && (
                  <span className={\`inline-flex items-center \${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'} font-medium rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200\`}>
                    🏖️ Vacaciones: {totalVacacionesDaysForYear} días
                  </span>
                )}
              </div>`,
  `              <div className="fichaje-metrics">
                {totalAsuntoPropioDaysForYear > 0 && (
                  <span className="fichaje-metric">Asunto propio: {totalAsuntoPropioDaysForYear} días</span>
                )}
                {totalVacacionesDaysForYear > 0 && (
                  <span className="fichaje-metric fichaje-metric--ok">Vacaciones: {totalVacacionesDaysForYear} días</span>
                )}
              </div>`
);

tryReplace(
  'lista loading',
  `            {isOperationLoading('solicitudes') ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text="Cargando solicitudes..." />
              </div>
            ) : solicitudesForYear.length === 0 ? (
              <div className={\`text-center \${isMobile ? 'py-4 text-sm' : 'py-8'} text-gray-500\`}>
                {solicitudes.length === 0 ? 'No tienes solicitudes aún.' : \`No tienes solicitudes en \${misSolicitudesYear}.\`}
              </div>
            ) : (
              <div className={isMobile ? "space-y-2" : "space-y-3"}>`,
  `            {isOperationLoading('solicitudes') ? (
              <AlertBanner loading title="Cargando solicitudes..." />
            ) : solicitudesForYear.length === 0 ? (
              <AlertBanner variant="info" title={solicitudes.length === 0 ? 'Sin solicitudes' : \`Sin solicitudes en \${misSolicitudesYear}\`}>
                {solicitudes.length === 0 ? 'No tienes solicitudes aún.' : \`No tienes solicitudes en \${misSolicitudesYear}.\`}
              </AlertBanner>
            ) : (
              <div className="solicitud-list">`
);

tryReplace(
  'desktop card outer',
  `                  <div key={solicitud.id || index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-red-500">`,
  `                  <div key={solicitud.id || index} className="solicitud-row solicitud-row--desktop">`
);

tryReplace(
  'desktop card header',
  `                    {/* Header compact pe mobil, complet pe ecrane mari */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                          <span className="text-white text-lg">
                            {solicitud.tipo === 'Vacaciones' ? '🏖️' : '📅'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">{solicitud.tipo}</h3>
                          {/* ID și Codigo: mutat sub tip pe mobil */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              ID: {solicitud.id}
                            </span>
                            {solicitud.codigo && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                Código: {solicitud.codigo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={\`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full \${getStatusColor(solicitud.estado)}\`}>
                              {solicitud.estado === 'Aprobada' ? '✅' : solicitud.estado === 'Pendiente' ? '⏳' : '❌'} {solicitud.estado}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>`,
  `                    <div className="solicitud-row__head">
                      <div className="min-w-0 flex-1">
                        <h3 className="solicitud-row__tipo">{solicitud.tipo}</h3>
                        <div className="solicitud-row__meta flex flex-wrap items-center gap-2 mt-1">
                          <span>ID: {solicitud.id}</span>
                          {solicitud.codigo ? <span>Código: {solicitud.codigo}</span> : null}
                        </div>
                      </div>
                      <span className={getStatusColor(solicitud.estado)}>{solicitud.estado}</span>
                    </div>`
);

// --- nueva form hero ---
if (!c.includes('className="solicitud-form max-w-3xl mx-auto"')) {
  const heroRe = /          \/\/ Formulario para nueva solicitud[\s\S]*?<div className="space-y-6">/;
  if (heroRe.test(c)) {
    c = c.replace(heroRe, `          <div className="solicitud-form max-w-3xl mx-auto">
            {editingSolicitud && (
              <button
                type="button"
                onClick={() => {
                  setEditingSolicitud(null);
                  setOriginalSolicitudData(null);
                  setTipo('Asuntos Propios');
                  setFechaInicio('');
                  setFechaFin('');
                  setMotivo('');
                  setTipoJustificante('');
                  setHoraCita('');
                  setCentroMedico('');
                  setDescripcionOtro('');
                  setArchivoJustificante(null);
                  if (isManager) {
                    setActiveTab('todas');
                  } else {
                    setActiveTab('lista');
                  }
                }}
                className="solicitud-form__back"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M19 12H6" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
                Volver a solicitudes
              </button>
            )}
            <div className="solicitud-form__intro">
              <h2 className="solicitud-form__title">
                {editingSolicitud ? 'Editar solicitud' : 'Nueva solicitud'}
              </h2>
              <p className="solicitud-form__subtitle">
                {editingSolicitud ? 'Modifica los datos de la solicitud' : 'Completa el formulario para enviar tu solicitud'}
              </p>
            </div>
            <div className="solicitud-form__sections">`);
    console.log('OK: nueva hero');
  } else {
    console.warn('WARN: nueva hero');
  }
} else {
  console.log('SKIP: nueva hero');
}

// Strip gradient wrappers in form
if (!c.includes('solicitud-form__section')) {
  const n1 = (c.match(/backdropFilter: 'blur\(10px\)'/g) || []).length;
  c = c.replace(
    /<div\s*\n\s*className="relative group[^"]*"\s*\n\s*style=\{\{[\s\S]*?backdropFilter: 'blur\(10px\)'[\s\S]*?\}\}\s*\n\s*>/g,
    '<div className="app-card app-card--pad solicitud-form__section">'
  );
  console.log(`OK: strip wrappers (had ${n1} blur sections)`);
}
c = c.replace(/\s*\{\/\* Glow animado[^*]*\*\/\}\s*\n\s*<div className="absolute inset-0 rounded-2xl[^/]*\/><\/div>\s*\n/g, '\n');

// Submit button via regex
if (!c.includes('solicitud-form__submit')) {
  const submitRe = /\{\/\* Botón Enviar[\s\S]*?\{\/\* Mensajes de feedback - Modernizados \*\//;
  if (submitRe.test(c)) {
    c = c.replace(submitRe, `{/* Botón Enviar */}
                <div className="solicitud-form__submit">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isOperationLoading('submit')}
                    className="app-modal__btn app-modal__btn--primary"
                  >
                    {isOperationLoading('submit')
                      ? (editingSolicitud ? 'Actualizando...' : 'Enviando...')
                      : (editingSolicitud ? 'Actualizar solicitud' : 'Enviar solicitud')}
                  </button>
                </div>

                {/* Mensajes de feedback - Modernizados */`);
    console.log('OK: submit button');
  } else {
    console.warn('WARN: submit button');
  }
}

tryReplace(
  'errorMsg banner',
  `                {errorMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',
                      borderColor: '#fca5a5',
                      boxShadow: '0 8px 20px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">❌</span>
                      <p className="text-red-800 font-semibold">{errorMsg}</p>
                    </div>
                  </div>
                )}`,
  `                {errorMsg && (
                  <AlertBanner compact variant="danger">{errorMsg}</AlertBanner>
                )}`
);

tryReplace(
  'successMsg banner',
  `                {successMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.8) 0%, rgba(187, 247, 208, 0.8) 100%)',
                      borderColor: '#86efac',
                      boxShadow: '0 8px 20px rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">✅</span>
                      <p className="text-green-800 font-semibold">{successMsg}</p>
                    </div>
                  </div>
                )}`,
  `                {successMsg && (
                  <AlertBanner compact variant="success">{successMsg}</AlertBanner>
                )}`
);

// --- modals ---
tryReplace(
  'delete modal',
  `      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
        title=""
        size="md"
        className="max-w-lg"
      >
        <div className="py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            ¿Eliminar solicitud?
          </h3>
          
          {/* Mesaj de confirmare */}
          <p className="text-gray-600 mb-4 text-center">
            ¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.
          </p>

          {/* Câmp pentru mesaj personalizat */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para el empleado (opcional):
            </label>
            <textarea
              value={deleteConfirm.mensaje}
              onChange={(e) => setDeleteConfirm({ ...deleteConfirm, mensaje: e.target.value })}
              placeholder="Escribe un mensaje que se enviará al empleado por email junto con la confirmación de eliminación..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje se enviará por email al empleado junto con la confirmación de que se ha eliminado su solicitud.
            </p>
          </div>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (deleteConfirm.solicitudId) {
                  handleDelete(deleteConfirm.solicitudId, deleteConfirm.mensaje);
                }
              }}
              disabled={isOperationLoading('delete')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('delete') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>`,
  `      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
        title="¿Eliminar solicitud?"
        size="md"
        showCloseButton={false}
      >
        <div className="app-modal__body">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            ¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.
          </p>
          <label className="app-modal__label" htmlFor="delete-confirm-mensaje">
            Mensaje para el empleado (opcional)
          </label>
          <textarea
            id="delete-confirm-mensaje"
            value={deleteConfirm.mensaje}
            onChange={(e) => setDeleteConfirm({ ...deleteConfirm, mensaje: e.target.value })}
            placeholder="Mensaje opcional para el email de confirmación..."
            rows={4}
            className="app-modal__input w-full resize-none"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Este mensaje se enviará por email al empleado junto con la confirmación de eliminación.
          </p>
        </div>
        <div className="app-modal__actions">
          <button
            type="button"
            onClick={() => setDeleteConfirm({ isOpen: false, solicitudId: null, mensaje: '' })}
            className="app-modal__btn app-modal__btn--secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteConfirm.solicitudId) {
                handleDelete(deleteConfirm.solicitudId, deleteConfirm.mensaje);
              }
            }}
            disabled={isOperationLoading('delete')}
            className="app-modal__btn app-modal__btn--danger"
          >
            {isOperationLoading('delete') ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>`
);

tryReplace(
  'upload modal info',
  `            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📄</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {selectedAusenciaForUpload.tipo || selectedAusenciaForUpload.TIPO || 'Ausencia'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Fecha: {selectedAusenciaForUpload.FECHA || selectedAusenciaForUpload.fecha || selectedAusenciaForUpload.fecha_inicio || '-'}
                  </p>
                </div>
              </div>
            </div>`,
  `            <div className="solicitud-modal-info">
              <p className="solicitud-modal-info__title">
                {selectedAusenciaForUpload.tipo || selectedAusenciaForUpload.TIPO || 'Ausencia'}
              </p>
              <p className="solicitud-modal-info__meta">
                Fecha: {selectedAusenciaForUpload.FECHA || selectedAusenciaForUpload.fecha || selectedAusenciaForUpload.fecha_inicio || '-'}
              </p>
            </div>`
);

tryReplace(
  'upload file input',
  `                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white"`,
  `                className="app-modal__input w-full"`
);

tryReplace(
  'upload modal buttons',
  `            <div className="flex gap-4 justify-center mt-8">
              <button
                onClick={() => {
                  setShowUploadJustificanteModal(false);
                  setSelectedAusenciaForUpload(null);
                  setUploadJustificanteFile(null);
                  setUploadJustificanteError(null);
                }}
                className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors duration-200"
              >
                <span className="mr-2">✖️</span>
                Cancelar
              </button>
              <button
                onClick={handleUploadJustificante}
                disabled={uploadJustificanteLoading || !uploadJustificanteFile}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadJustificanteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Cargando...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📤</span>
                    Cargar Justificante
                  </>
                )}
              </button>
            </div>`,
  `            <div className="app-modal__actions mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowUploadJustificanteModal(false);
                  setSelectedAusenciaForUpload(null);
                  setUploadJustificanteFile(null);
                  setUploadJustificanteError(null);
                }}
                className="app-modal__btn app-modal__btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUploadJustificante}
                disabled={uploadJustificanteLoading || !uploadJustificanteFile}
                className="app-modal__btn app-modal__btn--primary"
              >
                {uploadJustificanteLoading ? 'Cargando...' : 'Cargar justificante'}
              </button>
            </div>`
);

tryReplace(
  'preview modal footer',
  `            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (justificantePreview.blobUrl) URL.revokeObjectURL(justificantePreview.blobUrl);
                  setJustificantePreview({ isOpen: false, blobUrl: null, fileName: '', mimeType: '' });
                }}
                className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>`,
  `            <div className="app-modal__actions">
              <button
                type="button"
                onClick={() => {
                  if (justificantePreview.blobUrl) URL.revokeObjectURL(justificantePreview.blobUrl);
                  setJustificantePreview({ isOpen: false, blobUrl: null, fileName: '', mimeType: '' });
                }}
                className="app-modal__btn app-modal__btn--secondary"
              >
                Cerrar
              </button>
            </div>`
);

// Tipo select — add app-modal__input class if not present
if (c.includes('id="solicitud-tipo"') && !c.includes('id="solicitud-tipo"') === false) {
  c = c.replace(
    /id="solicitud-tipo"[\s\S]*?className="[^"]*"/,
    (m) => {
      if (m.includes('app-modal__input')) return m;
      return m.replace(/className="[^"]*"/, 'className="app-modal__input w-full sm:max-w-xs min-h-[44px]"');
    }
  );
  console.log('OK: tipo select class');
}

fs.writeFileSync(filePath, hadCRLF ? c.replace(/\n/g, '\r\n') : c);
console.log('Done.');
