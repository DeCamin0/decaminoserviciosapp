const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Simplify documentos tab header
src = src.replace(
  /{\/\* Header compacto y responsive \*\/}\s*<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">\s*<div className="flex items-center gap-3">\s*<h2 className="text-lg sm:text-xl font-bold text-red-600 truncate">\s*Documentos de \{selectedEmpleado\['NOMBRE \/ APELLIDOS'\] \|\| 'Empleado'\}\s*<\/h2>\s*<button[\s\S]*?fetchEmpleadoDocumentos\(selectedEmpleado\);[\s\S]*?<\/button>\s*<\/div>\s*\{volverEmpleadosBtn\}\s*<\/div>/,
  `<div className="solicitud-admin-toolbar mb-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Documentos del empleado</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmpleadoDocumentos([]);
                    fetchEmpleadoDocumentos(selectedEmpleado);
                  }}
                  className="solicitud-admin-btn"
                  title="Actualizar documentos"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>`
);

// Remove standalone volverEmpleadosBtn lines in tab headers (duplicate of context bar)
src = src.replace(/\s*\{volverEmpleadosBtn\}\s*/g, '\n');

// Stats cards gradient -> app-card compact
src = src.replace(
  /className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200\/50 hover:shadow-md transition-all duration-200 w-full max-w-sm"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);
src = src.replace(
  /className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200\/50 hover:shadow-md transition-all duration-200 w-full max-w-sm"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);

// Yellow gradient buttons -> solicitud-admin-btn
src = src.replace(
  /className="w-full px-5 py-2\.5 rounded-lg font-medium text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"/g,
  'className="solicitud-admin-btn solicitud-admin-btn--primary w-full disabled:opacity-50"'
);
src = src.replace(
  /className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"/g,
  'className="solicitud-admin-btn solicitud-admin-btn--primary disabled:opacity-50"'
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('polish OK');
