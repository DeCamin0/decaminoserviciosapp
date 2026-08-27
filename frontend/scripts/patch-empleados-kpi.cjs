const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/EmpleadosPage.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const kpiStart = s.indexOf('                {/* Estadísticas SUPER ELEGANTES y compactas */}');
const listaStart = s.indexOf('                {/* Lista empleados */}');
if (kpiStart < 0 || listaStart < 0) throw new Error(`markers not found: ${kpiStart} ${listaStart}`);

const block = `                <div className="empleados-kpi-strip" role="group" aria-label="Resumen de empleados">
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
`;

s = s.slice(0, kpiStart) + block + s.slice(listaStart);
fs.writeFileSync(filePath, s, 'utf8');
console.log('KPI block replaced');
