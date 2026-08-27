const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Delete documento normal modal
src = src.replace(
  /{\/\* Modal de Confirmare de Borrado de Documento Normal \*\/}\s*{showDeleteConfirmModal && documentoToDelete && \([\s\S]*?🗑️ Sí, Borrar[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}/,
  `{/* Modal de Confirmare de Borrado de Documento Normal */}
      {showDeleteConfirmModal && documentoToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!documentoToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setDocumentoToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setDocumentoToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={async () => { setShowDeleteConfirmModal(false); await handleDeleteDocumento(documentoToDelete); setDocumentoToDelete(null); }} className="solicitud-admin-btn solicitud-admin-btn--danger flex-1">Borrar documento</button>
            </div>
          )}
        >
          <AlertBanner variant="danger" title="Acción irreversible">
            ¿Estás seguro de que quieres borrar <strong>{documentoToDelete.fileName}</strong>? Esta acción no se puede deshacer.
          </AlertBanner>
        </Modal>,
        document.body
      )}`
);

// Delete documento oficial modal
src = src.replace(
  /{\/\* Modal de Confirmare de Borrado de Documento Oficial \*\/}\s*{showDeleteConfirmModal && documentoOficialToDelete && \([\s\S]*?🗑️ Sí, Borrar[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}/,
  `{/* Modal de Confirmare de Borrado de Documento Oficial */}
      {showDeleteConfirmModal && documentoOficialToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!documentoOficialToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setDocumentoOficialToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setDocumentoOficialToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={async () => { setShowDeleteConfirmModal(false); await handleDeleteDocumentoOficial(documentoOficialToDelete); setDocumentoOficialToDelete(null); }} className="solicitud-admin-btn solicitud-admin-btn--danger flex-1">Borrar documento</button>
            </div>
          )}
        >
          <AlertBanner variant="danger" title="Acción irreversible">
            ¿Estás seguro de que quieres borrar el documento oficial <strong>{documentoOficialToDelete.fileName}</strong>? Esta acción no se puede deshacer.
          </AlertBanner>
        </Modal>,
        document.body
      )}`
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('delete modals OK');
