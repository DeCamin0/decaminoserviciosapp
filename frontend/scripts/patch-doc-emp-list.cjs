const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Employee list header + search
const listPattern = /{activeTab === 'empleados' && !selectedEmpleado && \(\s*<div>\s*{\/\* Section Title and Search Bar[\s\S]*?{filteredEmpleados\.length === 0 \? \(\s*<div[\s\S]*?No hay empleados disponibles\.'\}\s*<\/p>\s*<\/div>\s*\) : \(\s*<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">/;

const listReplacement = `{activeTab === 'empleados' && !selectedEmpleado && (
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

if (!listPattern.test(src)) { console.error('list pattern'); process.exit(1); }
src = src.replace(listPattern, listReplacement);

// Employee cards
const cardPattern = /{filteredEmpleados\.map\(\(empleado, idx\) => \(\s*<div[\s\S]*?onClick=\{\(\) => handleEmpleadoSelect\(empleado\)\}[\s\S]*?<\/div>\s*\)\)\}/;
const cardReplacement = `{filteredEmpleados.map((empleado, idx) => (
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

if (!cardPattern.test(src)) { console.error('card pattern'); process.exit(1); }
src = src.replace(cardPattern, cardReplacement);

// ChangeEmployee3DButton
src = src.replace(/<ChangeEmployee3DButton[\s\S]*?\/>/g, '{volverEmpleadosBtn}');

fs.writeFileSync(filePath, src, 'utf8');
console.log('list OK');
