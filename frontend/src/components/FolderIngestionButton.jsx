import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderUp, RefreshCw, X, Eye, Save, CheckCircle2, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { routes } from '../utils/routes';
import { Modal, AlertBanner } from './ui';
export default function FolderIngestionButton({ variant = 'toolbar' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleFolderSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    // Show confirmation dialog first
    setPendingFiles(files);
    setShowConfirmDialog(true);
    setIsOpen(false);
    
    // Reset input to allow re-selection
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    const files = pendingFiles;
    if (files.length === 0) {
      setShowConfirmDialog(false);
      return;
    }

    setLoading(true);
    setResult(null);
    setShowConfirmDialog(false);
    setSelectedDocuments(new Set());

    try {
      // Organize files by folder structure
      // Files from webkitdirectory have webkitRelativePath property
      const folderStructure = {};
      files.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        const parts = path.split('/');
        const folderName = parts.length > 1 ? parts[0] : 'root';
        
        if (!folderStructure[folderName]) {
          folderStructure[folderName] = [];
        }
        folderStructure[folderName].push(file);
      });

      // Create FormData with all files
      const formData = new FormData();
      files.forEach((file) => {
        formData.append(`files`, file);
        formData.append(`paths`, file.webkitRelativePath || file.name);
      });

      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.previewFolder, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.documents) {
        // Convert base64 content back to ArrayBuffer for storage
        // Backend sends content as base64, we need to keep it for saving
        const documentsWithContent = data.documents.map(doc => {
          // Keep content as base64 string for later saving
          let contentBase64 = null;
          if (doc.content) {
            if (typeof doc.content === 'string') {
              // Already base64
              contentBase64 = doc.content;
            } else if (doc.content instanceof ArrayBuffer) {
              const bytes = new Uint8Array(doc.content);
              contentBase64 = btoa(String.fromCharCode(...bytes));
            } else if (doc.content.data) {
              // Buffer from backend
              contentBase64 = Buffer.from(doc.content.data).toString('base64');
            }
          }
          
          return {
            ...doc,
            contentBase64: contentBase64, // Store for saving
          };
        });
        
        // Show preview modal
        setPreviewDocuments(documentsWithContent);
        // Pre-select non-duplicate documents
        const nonDuplicates = new Set(
          documentsWithContent
            .filter(doc => !doc.isDuplicate)
            .map(doc => doc.id)
        );
        setSelectedDocuments(nonDuplicates);
        setShowPreviewModal(true);
      } else {
        throw new Error('No documents found or preview failed');
      }
    } catch (error) {
      console.error('Error previewing folder:', error);
      setResult({
        success: false,
        error: error.message || 'Error al procesar carpeta',
      });
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } finally {
      setLoading(false);
      setPendingFiles([]);
      // Reset input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const handleCancelUpload = () => {
    setShowConfirmDialog(false);
    setPendingFiles([]);
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const handleToggleDocument = (docId) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    const nonDuplicates = new Set(
      previewDocuments
        .filter(doc => !doc.isDuplicate)
        .map(doc => doc.id)
    );
    setSelectedDocuments(nonDuplicates);
  };

  const handleDeselectAll = () => {
    setSelectedDocuments(new Set());
  };

  const handleSaveSelected = async () => {
    if (selectedDocuments.size === 0) {
      alert('Por favor, selecciona al menos un documento para guardar.');
      return;
    }

    setSaving(true);
    try {
      // Get selected documents with all their data
      const selectedDocsData = previewDocuments.filter(doc => selectedDocuments.has(doc.id));
      
      // Calculate total size of base64 content (approximate)
      // Check individual file sizes (5MB limit per file)
      const MAX_FILE_SIZE_MB = 5;
      const oversizedFiles = selectedDocsData.filter(doc => (doc.size || 0) > MAX_FILE_SIZE_MB * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        const fileNames = oversizedFiles.map(doc => doc.filename).join(', ');
        alert(
          `⚠️ Los siguientes archivos son demasiado grandes (máximo 5MB por archivo):\n${fileNames}\n\nPor favor, deselecciona estos archivos o comprímelos antes de continuar.`,
        );
        return;
      }
      
      const totalSizeMB = selectedDocsData.reduce((sum, doc) => {
        const contentSize = doc.contentBase64 ? (doc.contentBase64.length * 3) / 4 / (1024 * 1024) : 0;
        return sum + contentSize;
      }, 0);
      
      // Warn if total size is very large (> 400MB to leave room for JSON overhead)
      if (totalSizeMB > 400) {
        const proceed = confirm(
          `⚠️ Advertencia: El tamaño total de los documentos seleccionados es muy grande (${totalSizeMB.toFixed(1)}MB). ` +
          `Esto puede causar problemas. ¿Deseas continuar?`
        );
        if (!proceed) {
          setSaving(false);
          return;
        }
      }
      
      // Convert documents to format expected by backend
      // Include content as base64 for saving
      const documentsToSave = selectedDocsData.map(doc => {
        // Use stored base64 content
        const contentBase64 = doc.contentBase64 || null;
        
        return {
          id: doc.id,
          filename: doc.filename,
          normalizedFilename: doc.normalizedFilename,
          contentType: doc.contentType,
          size: doc.size,
          classification: doc.classification,
          folderMetadata: doc.folderMetadata,
          idempotencyKey: doc.idempotencyKey,
          contentBase64: contentBase64, // Send as base64
        };
      });

      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.saveFolderDocuments, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          selectedDocuments: documentsToSave,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setResult({
        success: true,
        saved: data.saved,
        skipped: data.skipped,
        errors: data.errors,
      });
      setShowPreviewModal(false);
      setShowModal(true);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } catch (error) {
      console.error('Error saving documents:', error);
      setResult({
        success: false,
        error: error.message || 'Error al guardar documentos',
      });
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } finally {
      setSaving(false);
    }
  };

  const openPicker = () => {
    setIsOpen(false);
    setTimeout(() => folderInputRef.current?.click(), 50);
  };

  const folderHelp = (
    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
      <p>Selecciona una carpeta con subcarpetas por empleado.</p>
      <p className="text-xs text-gray-500">Ejemplo: Personal DeCamino 2025 → Juan Pérez / María García</p>
    </div>
  );

  return (
    <div className={variant === 'toolbar' ? 'documentos-empleados-ingestion-trigger' : 'relative'} ref={dropdownRef}>
      {showNotification && result && (
        <div className="documentos-empleados-ingestion-toast">
          <AlertBanner
            variant={result.success ? 'success' : 'danger'}
            title={result.success ? 'Procesamiento completado' : 'Error'}
            className="documentos-empleados-ingestion-toast__banner"
          >
            {result.success ? (
              <div className="space-y-0.5 text-sm">
                <div>Guardados: {result.saved || 0}</div>
                <div>Duplicados: {result.skipped || 0}</div>
                {result.errors > 0 && <div>Errores: {result.errors}</div>}
              </div>
            ) : (
              <p>{result.error}</p>
            )}
          </AlertBanner>
          <button
            type="button"
            onClick={() => setShowNotification(false)}
            className="documentos-empleados-ingestion-toast__close"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (variant === 'toolbar') {
            setIsOpen(true);
          } else {
            setIsOpen(!isOpen);
            if (!isOpen) openPicker();
          }
        }}
        disabled={loading}
        className={variant === 'toolbar'
          ? 'solicitud-admin-btn w-full sm:w-auto disabled:opacity-50'
          : 'relative group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'}
        style={variant === 'toolbar' ? undefined : {
          background: loading
            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(124, 58, 237, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 10px 25px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          color: 'white',
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
            <span>Procesando…</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <FolderUp className="w-4 h-4" aria-hidden />
            <span>{variant === 'toolbar' ? 'Cargar carpeta' : 'Cargar Carpeta'}</span>
          </span>
        )}
      </button>

      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
      />

      {isOpen && !loading && variant === 'toolbar' && typeof document !== 'undefined' && (isMobile ? createPortal(
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Cargar carpeta"
          size="md"
          className="app-modal--form app-modal--bottom-sheet"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col gap-2 w-full">
              <button type="button" onClick={() => setIsOpen(false)} className="solicitud-admin-btn w-full">Cancelar</button>
              <button type="button" onClick={openPicker} className="solicitud-admin-btn solicitud-admin-btn--primary w-full">Seleccionar carpeta</button>
            </div>
          )}
        >
          {folderHelp}
        </Modal>,
        document.body
      ) : createPortal(
        <div
          ref={dropdownRef}
          className="documentos-empleados-ingestion-popover fixed w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-[99999] p-4"
          style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
        >
          {folderHelp}
          <button type="button" onClick={openPicker} className="solicitud-admin-btn solicitud-admin-btn--primary w-full mt-4">
            Seleccionar carpeta
          </button>
        </div>,
        document.body
      ))}

      {isOpen && !loading && variant !== 'toolbar' && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-80 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.98) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <div className="p-4">
            <div className="font-bold text-gray-800 mb-3 text-sm">📁 Cargar desde Carpeta</div>
            <div className="text-xs text-gray-600 mb-4">
              Selecciona un folder que contenga subfolders para cada empleado.
              <br />
              <span className="font-semibold">Ejemplo:</span> Personal DeCamino 2025/
              <br />
              <span className="text-purple-600">→ Juan Perez/</span>
              <br />
              <span className="text-purple-600">→ Maria Garcia/</span>
            </div>
            <button
              onClick={() => {
                folderInputRef.current?.click();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-300 transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              }}
            >
              Seleccionar Carpeta
            </button>
          </div>
        </div>,
        document.body
      )}

      {showPreviewModal && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showPreviewModal}
          onClose={() => !saving && setShowPreviewModal(false)}
          title="Preview documentos"
          size="xl"
          className="app-modal--preview documentos-empleados-ingestion-preview"
          closeOnBackdrop={!saving}
          footer={(
            <div className="documentos-empleados-ingestion-preview__footer">
              <p className="documentos-empleados-ingestion-preview__count">
                {selectedDocuments.size > 0
                  ? `${selectedDocuments.size} documento${selectedDocuments.size !== 1 ? 's' : ''} seleccionado${selectedDocuments.size !== 1 ? 's' : ''}`
                  : 'No hay documentos seleccionados'}
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setShowPreviewModal(false)} disabled={saving} className="solicitud-admin-btn">Cancelar</button>
                <button
                  type="button"
                  onClick={handleSaveSelected}
                  disabled={saving || selectedDocuments.size === 0}
                  className="solicitud-admin-btn solicitud-admin-btn--primary inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" aria-hidden />
                      Guardar ({selectedDocuments.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        >
          <div className="documentos-empleados-ingestion-preview__toolbar">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Selecciona los documentos que deseas guardar ({selectedDocuments.size} de {previewDocuments.filter((d) => !d.isDuplicate).length})
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSelectAll} disabled={saving} className="solicitud-admin-btn text-xs">Seleccionar todos</button>
              <button type="button" onClick={handleDeselectAll} disabled={saving} className="solicitud-admin-btn text-xs">Deseleccionar</button>
            </div>
          </div>
          {previewDocuments.length === 0 ? (
            <div className="documentos-empleados-ingestion-preview__empty">
              <Eye className="w-8 h-8 text-gray-400 mb-2" aria-hidden />
              <p>No se encontraron documentos</p>
            </div>
          ) : (
            <div className="documentos-empleados-ingestion-preview__grid">
              {previewDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={`documentos-empleados-ingestion-card${
                    doc.isDuplicate
                      ? ' documentos-empleados-ingestion-card--duplicate'
                      : selectedDocuments.has(doc.id)
                        ? ' documentos-empleados-ingestion-card--selected'
                        : ''
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <input type="checkbox" checked={selectedDocuments.has(doc.id)} onChange={() => handleToggleDocument(doc.id)} disabled={doc.isDuplicate || saving} className="mt-1 w-4 h-4 rounded border-gray-300" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate" title={doc.filename}>{doc.filename}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {doc.size > 1024 * 1024 ? `${(doc.size / (1024 * 1024)).toFixed(2)} MB` : `${(doc.size / 1024).toFixed(2)} KB`}
                        {' · '}
                        {doc.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                      </div>
                      {doc.isDuplicate && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" aria-hidden />
                          Ya existe en la base de datos
                        </p>
                      )}
                    </div>
                  </div>
                  {doc.preview && (
                    <div className="documentos-empleados-ingestion-card__preview">
                      {doc.contentType.startsWith('image/') ? (
                        <img src={doc.preview} alt={doc.filename} className="w-full h-32 object-contain max-h-[200px]" />
                      ) : doc.contentType === 'application/pdf' ? (
                        <div className="p-3 text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                          <div className="font-semibold mb-1">Vista previa PDF</div>
                          <div className="whitespace-pre-wrap">{doc.preview}</div>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-3 text-xs space-y-0.5">
                    {doc.classification.tipoDocumento && (
                      <div className="text-gray-600 dark:text-gray-400">Tipo: <span className="font-semibold">{doc.classification.tipoDocumento}</span></div>
                    )}
                    {doc.classification.empleadoId && (
                      <div className="text-gray-600 dark:text-gray-400">
                        <div>Código: <span className="font-semibold">{doc.classification.empleadoId}</span></div>
                        {doc.classification.empleadoNombre && <div className="mt-1">Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span></div>}
                        {doc.classification.empleadoNombreFromDb && <div className="mt-1 text-green-700 dark:text-green-400">Nombre asociado: <span className="font-semibold">{doc.classification.empleadoNombreFromDb}</span></div>}
                      </div>
                    )}
                    {!doc.classification.empleadoId && doc.classification.empleadoNombre && (
                      <>
                        <div className="text-gray-600 dark:text-gray-400">Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span></div>
                        <div className="text-amber-700 dark:text-amber-400 italic">Código no encontrado</div>
                      </>
                    )}
                    {doc.classification.confidence > 0 && <div className="text-gray-500">Confianza: {(doc.classification.confidence * 100).toFixed(0)}%</div>}
                  </div>
                  {doc.folderMetadata && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                      {doc.folderMetadata.employeeFolderName && (
                        <div className="truncate" title={doc.folderMetadata.folderPath}>Empleado: <span className="font-semibold">{doc.folderMetadata.employeeFolderName}</span></div>
                      )}
                      {doc.folderMetadata.subfolderName && doc.folderMetadata.subfolderName !== doc.folderMetadata.folderName && (
                        <div className="truncate" title={doc.folderMetadata.folderPath}>Subcarpeta: <span className="font-semibold">{doc.folderMetadata.subfolderName}</span></div>
                      )}
                      <div className="truncate" title={doc.folderMetadata.folderPath}>Carpeta: {doc.folderMetadata.folderName || 'root'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>,
        document.body
      )}

      {showConfirmDialog && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showConfirmDialog}
          onClose={handleCancelUpload}
          title="Confirmar carga de carpeta"
          size="md"
          className="app-modal--form"
          footer={(
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-end">
              <button type="button" onClick={handleCancelUpload} className="solicitud-admin-btn w-full sm:w-auto">Cancelar</button>
              <button type="button" onClick={handleConfirmUpload} className="solicitud-admin-btn solicitud-admin-btn--primary w-full sm:w-auto inline-flex items-center justify-center gap-2">
                <FolderUp className="w-4 h-4" aria-hidden />
                Continuar
              </button>
            </div>
          )}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Se procesarán <strong>{pendingFiles.length}</strong> archivos.
          </p>
          <div className="app-card app-card--pad mb-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-gray-600 dark:text-gray-400">Total archivos</span>
              <span className="font-semibold">{pendingFiles.length}</span>
            </div>
            {pendingFiles.length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Carpeta</span>
                <span className="font-medium truncate max-w-[60%] text-right">
                  {(() => {
                    const firstPath = pendingFiles[0]?.webkitRelativePath || pendingFiles[0]?.name || '';
                    return firstPath.split('/')[0] || 'root';
                  })()}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-gray-600 dark:text-gray-400">Tamaño aprox.</span>
              <span className="font-medium">
                {((pendingFiles.reduce((sum, file) => sum + (file.size || 0), 0) / (1024 * 1024)).toFixed(2))} MB
              </span>
            </div>
          </div>
          <AlertBanner variant="warning" icon={<AlertTriangle className="w-4 h-4" aria-hidden />} title="Advertencia">
            Se procesarán todos los archivos de la carpeta seleccionada. Asegúrate de que confías en el origen de estos archivos.
          </AlertBanner>
        </Modal>,
        document.body
      )}

      {showModal && result && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={result.success ? 'Procesamiento completado' : 'Error'}
          size="md"
          className="app-modal--form"
          footer={(
            <button type="button" onClick={() => setShowModal(false)} className="solicitud-admin-btn solicitud-admin-btn--primary w-full sm:w-auto">Cerrar</button>
          )}
        >
          {result.success ? (
            <div className="space-y-4">
              <div className="documentos-empleados-ingestion-stats">
                <div className="documentos-empleados-ingestion-stat">
                  <div className="documentos-empleados-ingestion-stat__value">{result.saved || 0}</div>
                  <div className="documentos-empleados-ingestion-stat__label">Guardados</div>
                </div>
                <div className="documentos-empleados-ingestion-stat">
                  <div className="documentos-empleados-ingestion-stat__value">{result.skipped || 0}</div>
                  <div className="documentos-empleados-ingestion-stat__label">Duplicados</div>
                </div>
                {result.errors > 0 && (
                  <div className="documentos-empleados-ingestion-stat">
                    <div className="documentos-empleados-ingestion-stat__value">{result.errors}</div>
                    <div className="documentos-empleados-ingestion-stat__label">Errores</div>
                  </div>
                )}
              </div>
              <AlertBanner variant="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}>
                Los documentos guardados están disponibles en la sección de revisión de documentos.
              </AlertBanner>
            </div>
          ) : (
            <AlertBanner variant="danger" title="Error">{result.error || 'Error desconocido'}</AlertBanner>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
}
