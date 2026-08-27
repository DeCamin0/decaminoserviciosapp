/**
 * Visual Refresh V2 — Solicitudes admin block (UI only).
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/SolicitudesPage.jsx');
let c = fs.readFileSync(filePath, 'utf8');
const hadCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

function tryReplace(label, from, to) {
  if (!c.includes(from)) {
    if (to && c.includes(to)) {
      console.log(`SKIP: ${label}`);
      return;
    }
    console.warn(`WARN: ${label}`);
    return;
  }
  c = c.replace(from, to);
  console.log(`OK: ${label}`);
}

// 1. Admin main nav: Todas / Estadísticas
const adminNavOld = `{canAccessAllTabs && (
          <div className="solicitud-admin-tabs-legacy flex flex-wrap gap-4">
              <button
                onClick={() => setActiveTab('todas')}
                className={\`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl \${
                  activeTab === 'todas'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                    : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                }\`}
              >
                {/* Glow effect */}
                <div className={\`absolute inset-0 rounded-xl transition-all duration-300 \${
                  activeTab === 'todas' 
                    ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                    : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
                }\`}></div>
                <div className="flex items-center gap-3">
                  <div className={\`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 \${
                    activeTab === 'todas' 
                      ? 'bg-white/20' 
                      : 'bg-blue-100 group-hover:bg-blue-200'
                  }\`}>
                    <span className={\`text-xl \${
                      activeTab === 'todas' ? 'text-white' : 'text-blue-600'
                    }\`}>👥</span>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold">Todas las Solicitudes</div>
                    <div className={\`text-xs \${
                      activeTab === 'todas' ? 'text-white/80' : 'text-blue-500'
                    }\`}>Gestionar equipo</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('estadisticas')}
                className={\`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl \${
                  activeTab === 'estadisticas'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                    : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                }\`}
              >
                {/* Glow effect */}
                <div className={\`absolute inset-0 rounded-xl transition-all duration-300 \${
                  activeTab === 'estadisticas' 
                    ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                    : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
                }\`}></div>
                <div className="flex items-center gap-3">
                  <div className={\`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 \${
                    activeTab === 'estadisticas' 
                      ? 'bg-white/20' 
                      : 'bg-purple-100 group-hover:bg-purple-200'
                  }\`}>
                    <span className={\`text-xl \${
                      activeTab === 'estadisticas' ? 'text-white' : 'text-purple-600'
                    }\`}>📊</span>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold">Estadísticas</div>
                    <div className={\`text-xs \${
                      activeTab === 'estadisticas' ? 'text-white/80' : 'text-purple-500'
                    }\`}>Vacaciones y Asuntos Propios</div>
                  </div>
                </div>
              </button>
          </div>
        )}`;

const adminNavNew = `{canAccessAllTabs && (
          <SegmentedControl
            value={activeTab === 'todas' || activeTab === 'estadisticas' ? activeTab : ''}
            onChange={setActiveTab}
            items={[
              { id: 'todas', label: 'Todas las solicitudes', shortLabel: 'Todas' },
              { id: 'estadisticas', label: 'Estadísticas', shortLabel: 'Stats' },
            ]}
            className="solicitud-admin-tabs"
          />
        )}`;

tryReplace('admin main nav', adminNavOld, adminNavNew);

// 2. Todas subnav — replace glow tabs block via regex
const subnavRe = /\{\/\* Tabs para tipo - Modernos con efectos \*\/\}[\s\S]*?\{\/\* Selector meses y tipo - Dropdowns en línea \*\//;
if (subnavRe.test(c)) {
  c = c.replace(subnavRe, `{/* Subnavegación Todas */}
              {(() => {
                const pendientes = allSolicitudes.filter((s) => {
                  const tipo = (s.tipo || s.TIPO || '').toLowerCase();
                  const estado = (s.estado || s.ESTADO || '').toLowerCase();
                  const esPermisoRetribuido = tipo.includes('permiso') && tipo.includes('retribuido');
                  const esBajaVoluntaria = tipo.includes('baja') && tipo.includes('voluntaria');
                  const esAusenciaJustificada = tipo.includes('ausencias') && tipo.includes('justificada');
                  const esVacaciones = tipo.includes('vacacion');
                  return estado === 'pendiente' && (esPermisoRetribuido || esBajaVoluntaria || esAusenciaJustificada || esVacaciones);
                }).length;
                return (
                  <SegmentedControl
                    value={selectedTab}
                    onChange={setSelectedTab}
                    layout="grid"
                    className="solicitud-admin-subtabs"
                    items={[
                      { id: 'asunto', label: 'Asuntos Propios', shortLabel: 'Asuntos' },
                      { id: 'vacaciones', label: 'Vacaciones', shortLabel: 'Vac.' },
                      { id: 'control_vacaciones', label: 'Control vacaciones', shortLabel: 'Ctrl.' },
                      { id: 'ausencias', label: 'Ausencias', shortLabel: 'Aus.' },
                      { id: 'baja', label: 'Bajas Médicas', shortLabel: 'Bajas' },
                      { id: 'baja_voluntaria', label: 'Bajas Voluntarias', shortLabel: 'Vol.' },
                      {
                        id: 'aprobacion',
                        label: pendientes > 0 ? \`Aprobación (\${pendientes})\` : 'Aprobación',
                        shortLabel: pendientes > 0 ? \`Aprob \${pendientes}\` : 'Aprob',
                      },
                    ]}
                  />
                );
              })()}

              {/* Selector meses y tipo - Dropdowns en línea */`);
  console.log('OK: todas subnav');
} else if (c.includes('solicitud-admin-subtabs')) {
  console.log('SKIP: todas subnav');
} else {
  console.warn('WARN: todas subnav');
}

// 3. Todas header + toolbar
tryReplace(
  'todas header',
  `            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">
              Todas las Solicitudes
            </h2>
            
              {/* Botones export y crear solicitud */}
              <div className="flex gap-3 flex-wrap">`,
  `            <div className="solicitud-list-header mb-4">
              <h2 className="solicitud-list-header__title">Todas las solicitudes</h2>
              <div className="solicitud-admin-toolbar">`
);

// Replace gradient toolbar button classes (admin todas header only - unique strings)
const btnReplacements = [
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white"', 'className="solicitud-admin-btn solicitud-admin-btn--primary"'],
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white"', 'className="solicitud-admin-btn solicitud-admin-btn--primary"'],
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"', 'className="solicitud-admin-btn solicitud-admin-btn--primary"'],
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"', 'className="solicitud-admin-btn solicitud-admin-btn--primary"'],
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"', 'className="solicitud-admin-btn"'],
  ['className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"', 'className="solicitud-admin-btn"'],
];
btnReplacements.forEach(([from, to], i) => {
  if (c.includes(from)) {
    c = c.replace(from, to);
    console.log(`OK: toolbar btn ${i + 1}`);
  }
});

// Simplify toolbar button inner wrappers
c = c.replace(
  /<div className="flex items-center gap-2">\s*<span className="text-sm">[^<]*<\/span>\s*<span className="text-sm">([^<]*)<\/span>\s*<\/div>\s*<\/button>/g,
  '$1</button>'
);

// 4. User filter compact
const filterOld = `              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-2xl border border-gray-200 shadow-lg backdrop-blur-sm user-dropdown-container relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-lg">👥</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Filtrar por Empleado</h3>
                      <p className="text-xs text-gray-500">Busca y selecciona un empleado específico</p>
                    </div>
                  </div>
                  <div className="relative flex-1 max-w-lg">
                    <div className="relative group">`;

const filterNew = `              <div className="solicitud-admin-filter app-card app-card--pad user-dropdown-container relative z-10">
                <label htmlFor="manager-user-search" className="solicitud-admin-filter__label">Filtrar por empleado</label>
                <div className="solicitud-admin-filter__row relative flex-1 max-w-lg">
                    <div className="relative">`;

tryReplace('user filter shell', filterOld, filterNew);

// User search input
c = c.replace(
  /className=\{\`w-full \$\{isMobile \? 'px-3 py-2 pl-10 pr-10 text-xs' : 'px-4 py-3 pl-12 pr-12 text-sm'\} border-2 border-gray-200 \$\{isMobile \? 'rounded-lg' : 'rounded-xl'\} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white\/80 backdrop-blur-sm transition-all duration-300 placeholder-gray-400 shadow-sm group-hover:shadow-md`\}/g,
  'className="app-modal__input w-full min-h-[44px] pl-9 pr-9"'
);

// User dropdown
c = c.replace(
  /className=\{\`absolute z-\[9999\] w-full \$\{isMobile \? 'mt-2' : 'mt-3'\} bg-white border border-gray-200 \$\{isMobile \? 'rounded-lg' : 'rounded-2xl'\} shadow-2xl \$\{isMobile \? 'max-h-60' : 'max-h-80'\} overflow-y-auto`\}/g,
  'className="solicitud-admin-filter__dropdown"'
);

// User option buttons - simplify classes
c = c.replace(
  /className=\{\`w-full text-left \$\{isMobile \? 'px-2\.5 py-2' : 'px-4 py-3'\} hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 flex items-center \$\{isMobile \? 'gap-2' : 'gap-3'\} \$\{isMobile \? 'rounded-lg mb-0\.5' : 'rounded-xl mb-1'\} \$\{\s*selectedUser === user\.email \? 'bg-gradient-to-r from-blue-100 to-purple-100 border-l-4 border-l-blue-500 shadow-sm' : ''\s*\}\`\}/g,
  'className={`solicitud-admin-filter__option${selectedUser === user.email ? \' is-active\' : \'\'}`}'
);

// Remove avatar circles in user dropdown options
c = c.replace(
  /\s*<div className=\{\`\$\{isMobile \? 'w-8 h-8' : 'w-10 h-10'\} \$\{isMobile \? 'rounded-lg' : 'rounded-xl'\} flex items-center justify-center shadow-md transition-all duration-200 \$\{[\s\S]*?\}\`\}>\s*<span className=\{\`text-white[\s\S]*?<\/span>\s*<\/div>\s*/g,
  ''
);

// Close extra divs from old filter layout - remove trailing structure fix
c = c.replace(
  /                  <\/div>\s*<\/div>\s*<\/div>\s*\n\n              \{\/\* Subnavegación Todas \*\//,
  `                  </div>
              </div>

              {/* Subnavegación Todas */`
);

// 5. MobileAusenciaItemTodas — solicitud-row pattern
tryReplace(
  'MobileAusenciaItemTodas wrapper',
  `    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (portocaliu pentru ausencias) */}
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-500"></div>`,
  `    <div className="solicitud-row">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="solicitud-row__main"
        aria-expanded={isExpanded}
      >
        <span className="solicitud-status-dot solicitud-status-dot--pendiente" aria-hidden />`
);

tryReplace(
  'MobileAusenciaItemTodas chevron',
  `        <span className={\`text-gray-400 text-[10px] transition-transform flex-shrink-0 \${isExpanded ? 'rotate-180' : ''}\`}>
          ▼
        </span>
      </div>`,
  `        <span className={\`solicitud-row__chev \${isExpanded ? 'is-open' : ''}\`} aria-hidden>▼</span>
      </button>`
);

tryReplace(
  'MobileAusenciaItemTodas details',
  `        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">`,
  `        <div className="solicitud-row__details space-y-2">`
);

// 6. Desktop todas card shell
tryReplace(
  'todas desktop card',
  `                    <div key={item.id || item.email} className="card hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">
                              {selectedTab === 'ausencias'
                                ? '🚫'
                                : selectedTab === 'baja' || isBajaMedica(item.tipo)
                                ? '🩺'
                                : selectedTab === 'baja_voluntaria' || item.tipo === 'BAJA_VOLUNTARIA'
                                ? '🚪'
                                : item.tipo === 'Vacaciones'
                                ? '🏖️'
                                : '📅'}
                            </span>
                          </div>
                          <div className="flex-1">`,
  `                    <div key={item.id || item.email} className="solicitud-row solicitud-row--desktop">
                      <div className="solicitud-row__head">
                        <div className="flex-1 min-w-0">`
);

// 7. Estadísticas header
tryReplace(
  'estadisticas header',
  `            <div className={\`flex \${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} \${isMobile ? 'mb-3' : 'mb-6'}\`}>
              <h2 className={\`\${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900\`}>
                Estadísticas de Solicitudes
              </h2>
              <button`,
  `            <div className="solicitud-list-header mb-4">
              <h2 className="solicitud-list-header__title">Estadísticas</h2>
              <button
                type="button"`
);

c = c.replace(
  /className=\{\`\$\{isMobile \? 'px-3 py-1\.5 text-xs' : 'px-4 py-2'\} bg-purple-600 hover:bg-purple-700 text-white \$\{isMobile \? 'rounded-lg' : 'rounded-lg'\} font-medium transition-colors disabled:opacity-50 flex items-center gap-2`\}/g,
  'className="solicitud-admin-btn solicitud-admin-btn--primary"'
);

// Estadísticas loading/empty
tryReplace(
  'estadisticas loading',
  `            {estadisticasLoading ? (
              <div className={\`flex justify-center \${isMobile ? 'py-6' : 'py-12'}\`}>
                <LoadingSpinner size={isMobile ? 'md' : 'lg'} text="Cargando estadísticas..." />
              </div>
            ) : estadisticas.length === 0 ? (
              <div className={\`text-center \${isMobile ? 'py-6 px-3' : 'py-12'} bg-gray-50 \${isMobile ? 'rounded-lg' : 'rounded-xl'}\`}>
                <p className={\`\${isMobile ? 'text-sm mb-3' : 'text-gray-600 mb-4'}\`}>No hay estadísticas disponibles</p>`,
  `            {estadisticasLoading ? (
              <AlertBanner loading title="Cargando estadísticas..." />
            ) : estadisticas.length === 0 ? (
              <AlertBanner variant="info" title="Sin estadísticas">
                <p className="mb-3">No hay estadísticas disponibles</p>`
);

// 8. Modals — reject permiso
tryReplace(
  'reject modal',
  `      <Modal
        isOpen={rejectPermisoModal.isOpen}
        onClose={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' })}
        title=""
        size="md"
        className="max-w-lg"
      >
        <div className="py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <span className="text-4xl">❌</span>
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            ¿Rechazar {rejectPermisoModal.tipoSolicitud === 'Ausencias justificada' ? 'ausencia justificada' : 'permiso retribuido'}?
          </h3>
          
          {/* Mesaj de confirmare */}
          <p className="text-gray-600 mb-4 text-center">
            ¿Estás seguro de que deseas rechazar esta solicitud? Esta acción notificará al empleado.
          </p>

          {/* Câmp pentru mesaj personalizat */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para el empleado (opcional):
            </label>
            <textarea
              value={rejectPermisoModal.mensaje}
              onChange={(e) => setRejectPermisoModal({ ...rejectPermisoModal, mensaje: e.target.value })}
              placeholder="Escribe un mensaje que se enviará al empleado por email junto con la notificación de rechazo..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje se enviará por email al empleado junto con la notificación de rechazo.
            </p>
          </div>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '' })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejectSolicitudPendiente}
              disabled={isOperationLoading('reject-permiso')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('reject-permiso') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Rechazando...
                </>
              ) : (
                <>
                  <span className="text-lg">❌</span>
                  Rechazar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>`,
  `      <Modal
        isOpen={rejectPermisoModal.isOpen}
        onClose={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' })}
        title={\`¿Rechazar \${rejectPermisoModal.tipoSolicitud === 'Ausencias justificada' ? 'ausencia justificada' : 'permiso retribuido'}?\`}
        size="md"
        showCloseButton={false}
      >
        <div className="app-modal__body">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            ¿Estás seguro de que deseas rechazar esta solicitud? Esta acción notificará al empleado.
          </p>
          <label className="app-modal__label" htmlFor="reject-permiso-mensaje">Mensaje para el empleado (opcional)</label>
          <textarea
            id="reject-permiso-mensaje"
            value={rejectPermisoModal.mensaje}
            onChange={(e) => setRejectPermisoModal({ ...rejectPermisoModal, mensaje: e.target.value })}
            placeholder="Mensaje opcional para el email de rechazo..."
            rows={4}
            className="app-modal__input w-full resize-none"
          />
        </div>
        <div className="app-modal__actions">
          <button type="button" onClick={() => setRejectPermisoModal({ isOpen: false, solicitud: null, mensaje: '', tipoSolicitud: 'Permiso Retribuido' })} className="app-modal__btn">Cancelar</button>
          <button type="button" onClick={handleRejectSolicitudPendiente} disabled={isOperationLoading('reject-permiso')} className="app-modal__btn app-modal__btn--primary">
            {isOperationLoading('reject-permiso') ? 'Rechazando...' : 'Rechazar'}
          </button>
        </div>
      </Modal>`
);

fs.writeFileSync(filePath, hadCRLF ? c.replace(/\n/g, '\r\n') : c);
console.log('Done admin patch phase 1');
