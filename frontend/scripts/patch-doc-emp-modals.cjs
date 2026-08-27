const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Info card
src = src.replace(
  /{\/\* Información \*\/}\s*<Card>[\s\S]*?<\/Card>/,
  `{/* Información */}
      <AlertBanner variant="info" compact className="documentos-empleados-info">
        Selecciona un empleado para gestionar documentos, nóminas y certificados. Formatos: PDF, DOC, DOCX, JPG, PNG, TXT.
      </AlertBanner>`
);

// Upload modal start
src = src.replace(
  /{\/\* Modal para selección de tipo de documento \*\/}\s*{showUploadModal && \(\s*<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">\s*<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">\s*<div className="flex items-center justify-between mb-4">\s*<h3 className="text-lg font-bold text-gray-900">\s*📋 Configurar Documentos\s*<\/h3>\s*<button[\s\S]*?<\/button>\s*<\/div>/,
  `{/* Modal para selección de tipo de documento */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showUploadModal}
          onClose={handleUploadCancel}
          title="Configurar documentos"
          size="md"
          className="app-modal--form documentos-empleados-upload-modal"
        >`
);

// Upload modal end
src = src.replace(
  /<div className="flex space-x-3 pt-4">[\s\S]*?'Subir Documentos'[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}/,
  `</div>
        </Modal>,
        document.body
      )}`
);

src = src.replace(
  /<div className="bg-gray-50 rounded-lg p-4">\s*<h4 className="font-medium text-gray-900 mb-2">Archivos Seleccionados:<\/h4>/,
  `<div className="app-card app-card--pad documentos-empleados-upload-files">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Archivos seleccionados</h4>`
);

src = src.replace(
  /className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"/g,
  'className="app-modal__input w-full"'
);

// Preview modal
src = src.replace(
  /{\/\* Modal para preview de documentos \*\/}\s*{showPreviewModal && \(\s*<div className="fixed inset-0 bg-black\/60 backdrop-blur-sm flex items-center justify-center z-\[9999\] p-0 sm:p-4">\s*<div className="bg-white rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-auto sm:max-h-\[95vh\] overflow-hidden shadow-2xl border-0 sm:border border-gray-200 animate-in fade-in duration-300 relative flex flex-col">\s*{\/\* Header moderno \*\/}[\s\S]*?<\/div>\s*<\/div>\s*{previewLoading &&/,
  `{/* Modal para preview de documentos */}
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
          <div className="documentos-preview-body relative">
            {previewLoading &&`
);

src = src.replace(
  /{\/\* Buton de închidere fixat jos - VIZIBIL PE MOBIL \*\/}[\s\S]*?Cerrar preview\s*<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}/,
  `</div>
        </Modal>,
        document.body
      )}`
);

// Notification outside page div
src = src.replace(
  /{\/\* Component de notificare \*\/}\s*<Notification[\s\S]*?\/>\s*<\/div>\s*<\/>/,
  `</div>

      {/* Component de notificare */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        duration={notification.duration}
        onClose={hideNotification}
      />
    </>`
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('modals OK');
