const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Nomina rows
src = src.replace(
  /className="group relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200\/50 hover:shadow-md transition-all duration-200"/g,
  'className="documentos-empleados-doc-row"'
);

// Empresa rows
src = src.replace(
  /className="group relative overflow-hidden bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-200\/50 hover:shadow-md transition-all duration-200"/g,
  'className="documentos-empleados-doc-row"'
);

// Documentos normales rows (dynamic style.bg) - simplify outer wrapper
src = src.replace(
  /className=\{`group relative overflow-hidden bg-gradient-to-r \$\{style\.bg\} p-4 rounded-xl border \$\{style\.border\} hover:shadow-md transition-all duration-200`\}/g,
  'className="documentos-empleados-doc-row"'
);

// Preview buttons
src = src.replace(
  /className="group\/btn relative px-3 py-1\.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn solicitud-admin-btn--primary text-xs"'
);
src = src.replace(
  /className="group\/btn relative px-3 py-1\.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn solicitud-admin-btn--primary text-xs"'
);

// Download green buttons
src = src.replace(
  /className="px-3 py-1\.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn text-xs"'
);

// Delete buttons
src = src.replace(
  /className="px-3 py-1\.5 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn solicitud-admin-btn--danger text-xs"'
);

// Other gradient action buttons in empresa tab
src = src.replace(
  /className="px-3 py-1\.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn text-xs"'
);
src = src.replace(
  /className="px-3 py-1\.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"/g,
  'className="solicitud-admin-btn text-xs disabled:opacity-60"'
);

// Stats cards empresa
src = src.replace(
  /className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200\/50 hover:shadow-md transition-all duration-200 w-full max-w-sm"/g,
  'className="app-card app-card--pad documentos-empleados-stat w-full max-w-sm"'
);

// PRL stats
src = src.replace(
  /className="bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-200\/50"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);
src = src.replace(
  /className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-xl border border-yellow-200\/50"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);
src = src.replace(
  /className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-xl border border-green-200\/50"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);
src = src.replace(
  /className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200\/50"/g,
  'className="app-card app-card--pad documentos-empleados-stat"'
);

// Nomina upload modal - wrap with Modal (start)
src = src.replace(
  /{\/\* Modal separado para nóminas \*\/}\s*{showNominaUploadModal && \(\s*<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">\s*<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">\s*<div className="flex items-center justify-between mb-4">\s*<h3 className="text-lg font-bold text-gray-900">\s*💰 Configurar Nómina\s*<\/h3>\s*<button[\s\S]*?className="text-gray-400 hover:text-gray-600"[\s\S]*?<\/button>\s*<\/div>/,
  `{/* Modal separado para nóminas */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showNominaUploadModal}
          onClose={() => {
            setShowNominaUploadModal(false);
            setSelectedFiles([]);
            setSelectedMonth(new Date().getMonth());
            setSelectedYear(new Date().getFullYear());
          }}
          title="Configurar nómina"
          size="md"
          className="app-modal--form documentos-empleados-upload-modal"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => {
                setShowNominaUploadModal(false);
                setSelectedFiles([]);
                setSelectedMonth(new Date().getMonth());
                setSelectedYear(new Date().getFullYear());
              }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={handleUploadConfirm} disabled={uploading} className="solicitud-admin-btn solicitud-admin-btn--primary flex-1 disabled:opacity-50">
                {uploading ? 'Subiendo…' : 'Subir nómina'}
              </button>
            </div>
          )}
        >`
);

// Nomina upload modal end - remove old footer buttons and close divs
src = src.replace(
  /{\/\* Botones de acción \*\/}\s*<div className="flex justify-end space-x-3 pt-4">[\s\S]*?'Subir Nómina'[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}/,
  `</div>
        </Modal>,
        document.body
      )}`
);

// Nomina upload inputs
src = src.replace(
  /className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"/g,
  'className="app-modal__input w-full"'
);

// Delete nomina modal
src = src.replace(
  /{showDeleteConfirmModal && nominaToDelete && \(\s*<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">\s*<div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-4 border-red-100">[\s\S]*?{\/\* Header \*\/}[\s\S]*?<\/div>\s*{\/\* Content \*\/}/,
  `{showDeleteConfirmModal && nominaToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!nominaToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setNominaToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setNominaToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={handleDeleteNomina} className="solicitud-admin-btn solicitud-admin-btn--danger flex-1">Borrar nómina</button>
            </div>
          )}
        >
          <div className="space-y-3">`
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('polish part 1 OK');
