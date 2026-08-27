/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/EmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

if (src.includes('app-page empleados-page')) {
  console.log('Empleados V2 shell already applied, skipping header/tabs/KPI');
} else {
  const headerStart = src.indexOf('  return (\n    <div className="space-y-6">');
  const listaMarker = "        {activeTab === 'lista' && canManageEmployees ? (";
  const listaIdx = src.indexOf(listaMarker);
  if (headerStart < 0 || listaIdx < 0) throw new Error('header/lista markers not found');

  const beforeReturn = src.slice(0, headerStart);
  const afterLista = src.slice(listaIdx);

  const shell = `  const empleadosTabs = useMemo(() => {
    const tabs = [];
    if (canManageEmployees) tabs.push({ id: 'lista', label: 'Lista de empleados', shortLabel: 'Lista' });
    tabs.push({ id: 'adauga', label: 'Añadir empleado', shortLabel: 'Añadir' });
    if (canManageEmployees) {
      tabs.push({ id: 'corregir-nombres', label: 'Corregir nombres', shortLabel: 'Nombres' });
      tabs.push({ id: 'estadisticas', label: 'Estadísticas empleados', shortLabel: 'Stats' });
    }
    return tabs;
  }, [canManageEmployees]);

  const activosCount = users.filter((u) => (u.ESTADO || u['ESTADO'] || '').toString().trim().toUpperCase() === 'ACTIVO').length;
  const inactivosCount = users.filter((u) => (u.ESTADO || u['ESTADO'] || '').toString().trim().toUpperCase() === 'INACTIVO').length;
  const pendientesCount = users.filter((u) => (u.ESTADO || u['ESTADO'] || '').toString().trim().toUpperCase() === 'PENDIENTE').length;

  return (
    <div className="app-page empleados-page">
      <PageHeader
        title={canManageEmployees ? 'Gestión de Empleados' : 'Mis Inspecciones'}
        subtitle={canManageEmployees
          ? 'Administra la lista de empleados y añade nuevos usuarios'
          : 'Consulta tus inspecciones programadas'}
        backTo="/inicio"
      />
      <SegmentedControl items={empleadosTabs} value={activeTab} onChange={setActiveTab} layout="grid" />
      <div className="empleados-tab-panel">
`;

  src = beforeReturn + shell + afterLista;
  console.log('Applied header/tabs shell');
}

if (!src.includes('empleados-kpi-strip')) {
  const kpiStart = src.indexOf('                {/* Estadísticas SUPER ELEGANTES y compactas */}');
  const listaStart = src.indexOf('                {/* Lista empleados */}');
  if (kpiStart < 0 || listaStart < 0) throw new Error('KPI/lista markers not found');

  const listaBlock = `                <div className="empleados-kpi-strip" role="group" aria-label="Resumen de empleados">
                  <button type="button" className={\`empleados-kpi \${statusFilter === 'ALL' ? 'empleados-kpi--active' : ''}\`} onClick={() => setStatusFilter('ALL')}>
                    <span className="empleados-kpi__value">{searchTerm ? getFilteredUsers.length : users.length}</span>
                    <span className="empleados-kpi__label">{searchTerm ? \`de \${users.length}\` : 'Total'}</span>
                  </button>
                  <button type="button" className={\`empleados-kpi \${statusFilter === 'ACTIVO' ? 'empleados-kpi--active' : ''}\`} onClick={() => setStatusFilter('ACTIVO')}>
                    <span className="empleados-kpi__value">{activosCount}</span>
                    <span className="empleados-kpi__label">Activos</span>
                  </button>
                  <button type="button" className={\`empleados-kpi \${statusFilter === 'INACTIVO' ? 'empleados-kpi--active' : ''}\`} onClick={() => setStatusFilter('INACTIVO')}>
                    <span className="empleados-kpi__value">{inactivosCount}</span>
                    <span className="empleados-kpi__label">Inactivos</span>
                  </button>
                  <button type="button" className={\`empleados-kpi \${statusFilter === 'PENDIENTE' ? 'empleados-kpi--active' : ''}\`} onClick={() => setStatusFilter('PENDIENTE')}>
                    <span className="empleados-kpi__value">{pendientesCount}</span>
                    <span className="empleados-kpi__label">Pendientes</span>
                  </button>
                  <button type="button" className={\`empleados-kpi \${statusFilter === 'ONLINE' ? 'empleados-kpi--active' : ''}\`} onClick={() => setStatusFilter('ONLINE')}>
                    <span className="empleados-kpi__value">{onlineUserIds.size}</span>
                    <span className="empleados-kpi__label">Online</span>
                  </button>
                </div>
                <div className="empleados-filter-bar app-card app-card--pad">
                  <input id="search-empleados" name="searchTerm" type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchBy === 'sin_fecha_alta' ? 'Empleados sin Fecha Alta…' : searchBy === 'certificado_handicap' ? 'Con certificado discapacidad…' : searchBy === 'fecha_alta' ? 'Buscar por fecha…' : 'Buscar empleados…'}
                    disabled={searchBy === 'sin_fecha_alta' || searchBy === 'certificado_handicap'} aria-label="Buscar empleados" />
                  <select id="search-by-empleados" name="searchBy" value={searchBy} onChange={(e) => setSearchBy(e.target.value)} aria-label="Tipo de búsqueda">
                    <option value="nombre">Nombre</option><option value="codigo">Código</option><option value="email">Email</option>
                    <option value="grupo">Grupo</option><option value="estado">Estado</option><option value="centro">Centro</option>
                    <option value="fecha_alta">Fecha Alta</option><option value="sin_fecha_alta">Sin Fecha Alta</option>
                    <option value="certificado_handicap">Certificado discapacidad</option><option value="activos_sin_iban">Activos sin IBAN</option><option value="todos">Todos</option>
                  </select>
                  {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="solicitud-admin-btn" aria-label="Limpiar"><X className="w-4 h-4" /></button>}
                </div>
                {searchTerm && <AlertBanner variant="info" compact>{getFilteredUsers.length} resultados para &quot;{searchTerm}&quot;</AlertBanner>}
                <div className="solicitud-admin-toolbar documentos-actions flex-wrap mb-3">
                  <button type="button" onClick={handleExportExcel} className="solicitud-admin-btn"><FileSpreadsheet className="w-4 h-4" /><span>Excel</span></button>
                  <button type="button" onClick={handleExportPDF} className="solicitud-admin-btn"><FileText className="w-4 h-4" /><span>PDF</span></button>
                  <button type="button" onClick={openConfirmSendActiveEmployeesList} disabled={emailListPrepareLoading} className="solicitud-admin-btn"><Mail className="w-4 h-4" /><span>Lista activos</span></button>
                  <button type="button" onClick={openConfirmSendListaIban} disabled={emailListPrepareLoading} className="solicitud-admin-btn"><FileText className="w-4 h-4" /><span>Lista IBAN</span></button>
                  <button type="button" onClick={fetchUsers} className="solicitud-admin-btn"><RefreshCw className="w-4 h-4" /><span>Actualizar</span></button>
                  <button type="button" onClick={handleExportAllEmployeesZIP} className="solicitud-admin-btn"><Archive className="w-4 h-4" /><span>ZIP todos</span></button>
                  <button type="button" onClick={openIbanModal} className="solicitud-admin-btn"><FileText className="w-4 h-4" /><span>IBAN</span></button>
                  <button type="button" onClick={openSolicitarDocumentoTodosModal} className="solicitud-admin-btn"><File className="w-4 h-4" /><span>Doc. todos</span></button>
                  <button type="button" onClick={openWelcomeEmailModal} className="solicitud-admin-btn solicitud-admin-btn--primary"><Mail className="w-4 h-4" /><span>Bienvenida</span></button>
                </div>
                <div className="empleados-list-wrap solicitud-admin-mobile-list">
`;

  src = src.slice(0, kpiStart) + listaBlock + src.slice(listaStart);

  const mapMarker = '                      {getFilteredUsers.map((user, idx) => {';
  const mapIdx = src.indexOf(mapMarker);
  const oldListOpen = '                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">';
  const oldListIdx = src.lastIndexOf(oldListOpen, mapIdx);
  if (oldListIdx > 0 && oldListIdx < mapIdx) {
    src = src.slice(0, oldListIdx) + '                <div className="empleados-list-wrap solicitud-admin-mobile-list">' + src.slice(mapIdx);
  }
  console.log('Applied KPI/filter/toolbar');
}

src = src.replace(
  '<div className="text-center text-red-600 font-bold py-8">{errorUsers}</div>',
  '<AlertBanner variant="danger" title="Error">{errorUsers}</AlertBanner>',
);

if (src.includes('bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4')) {
  src = src.replace(
    `<div className="bg-white rounded-2xl max-w-4xl w-full max-h-[min(95dvh,calc(100dvh-2rem))] flex flex-col overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in duration-300 mb-[env(safe-area-inset-bottom,0px)]">
            {/* Header ULTRA MODERN */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">✏️</span>
                  </div>
                  <div>
                    <h2 id="edit-empleado-modal-title" className="text-xl font-bold text-gray-900">Detalles del empleado</h2>
                    <p className="text-sm text-blue-600 font-medium">Modificar información del empleado</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-10 h-10 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-blue-500 text-xl">✕</span>
                </button>
              </div>
            </div>`,
    `<div className="app-modal app-modal--form max-w-4xl w-full max-h-[min(95dvh,calc(100dvh-2rem))] flex flex-col overflow-hidden mb-[env(safe-area-inset-bottom,0px)]">
            <div className="app-modal__header flex-shrink-0">
              <h2 id="edit-empleado-modal-title" className="app-modal__title">Detalles del empleado</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="app-modal__close" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>`,
  );
  src = src.replace(
    `<div className="flex-1 min-h-0 overflow-y-auto p-6">`,
    `<div className="app-modal__body flex-1 min-h-0 overflow-y-auto">`,
  );
  console.log('Applied edit modal shell');
}

src = src.replace(
  `className="px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-60 disabled:transform-none"`,
  `className="solicitud-admin-btn solicitud-admin-btn--primary w-full justify-center"`,
);

if (src.includes('      </Card>\n\n      {/* Modal editar empleado')) {
  src = src.replace('      </Card>\n\n      {/* Modal editar empleado', '      </div>\n\n      {/* Modal editar empleado');
}

if (src.includes('<table className="w-full bg-white border border-gray-200 rounded-lg shadow-sm" style={{ minWidth: \'1520px\' }}>')) {
  src = src.replace(
    '<table className="w-full bg-white border border-gray-200 rounded-lg shadow-sm" style={{ minWidth: \'1520px\' }}>',
    '<div className="empleados-stats-table-wrap hidden md:block"><table className="w-full bg-white" style={{ minWidth: \'1520px\' }}>',
  );
  src = src.replace(
    '</table>\n                \n                {/* Butoane de export */}',
    '</table></div>\n                \n                {/* Butoane de export */}',
  );
}

if (!src.includes('empleados-tab-panel') || src.match(/<div className="app-page empleados-page">[\s\S]*<\/div>\s*\);\s*}\s*$/)) {
  // ensure closing wrapper for empleados-page
  const endPattern = /(\s*<\/Modal>\s*\n\s*<\/div>\s*\n\s*\);\s*\n\})/;
  if (endPattern.test(src) && !src.includes('</div>\n    </div>\n  );\n}')) {
    src = src.replace(endPattern, '\n    </div>$1');
  }
}

fs.writeFileSync(filePath, src, 'utf8');
console.log('Empleados V2 patch applied');
