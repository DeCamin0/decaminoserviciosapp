import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../utils/routes';

export default function FolderIngestionButton() {
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
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const folderInputRef = useRef(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Toast */}
      {showNotification && result && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div
            className={`p-4 rounded-xl shadow-2xl backdrop-blur-xl ${
              result.success
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
            }`}
            style={{
              minWidth: '300px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">
                {result.success ? '✅' : '❌'}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg mb-1">
                  {result.success ? 'Procesamiento completado' : 'Error'}
                </div>
                {result.success ? (
                  <div className="text-sm opacity-90">
                    <div>Guardados: {result.saved || 0}</div>
                    <div>Duplicados: {result.skipped || 0}</div>
                    {result.errors > 0 && <div>Errores: {result.errors}</div>}
                  </div>
                ) : (
                  <div className="text-sm opacity-90">{result.error}</div>
                )}
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && folderInputRef.current) {
            // Small delay to ensure dropdown is visible
            setTimeout(() => {
              folderInputRef.current?.click();
            }, 100);
          }
        }}
        disabled={loading}
        className="relative group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
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
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Procesando...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg">📁</span>
            <span>Cargar Carpeta</span>
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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

      {/* Dropdown - Using Portal to render directly in body to escape overflow:hidden containers */}
      {isOpen && !loading && typeof document !== 'undefined' && createPortal(
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

      {/* Modal de preview cu documente */}
      {showPreviewModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => !saving && setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  👁️ Preview Documentos
                </h2>
                <p className="text-purple-100 text-sm">
                  Selecciona los documentos que deseas guardar ({selectedDocuments.size} de {previewDocuments.filter(d => !d.isDuplicate).length} seleccionados)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  disabled={saving}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Seleccionar todos
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={saving}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Deseleccionar
                </button>
                <button
                  onClick={() => !saving && setShowPreviewModal(false)}
                  className="text-white/80 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewDocuments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No se encontraron documentos
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {previewDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`border-2 rounded-xl p-4 transition-all min-w-0 ${
                        doc.isDuplicate
                          ? 'bg-gray-100 border-gray-300 opacity-60'
                          : selectedDocuments.has(doc.id)
                          ? 'bg-purple-50 border-purple-400 shadow-lg'
                          : 'bg-white border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={() => handleToggleDocument(doc.id)}
                          disabled={doc.isDuplicate || saving}
                          className="mt-1 w-5 h-5 text-purple-600 focus:ring-purple-500 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-800 truncate" title={doc.filename}>
                            {doc.filename}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {doc.size > 1024 * 1024 
                              ? `${(doc.size / (1024 * 1024)).toFixed(2)} MB`
                              : `${(doc.size / 1024).toFixed(2)} KB`}
                            {' • '}
                            {doc.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                          </div>
                          {doc.isDuplicate && (
                            <div className="text-xs text-yellow-600 font-semibold mt-1">
                              ⚠️ Ya existe en la base de datos
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preview */}
                      {doc.preview && (
                        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                          {doc.contentType.startsWith('image/') ? (
                            <img
                              src={doc.preview}
                              alt={doc.filename}
                              className="w-full h-32 object-contain"
                              style={{ maxHeight: '200px' }}
                            />
                          ) : doc.contentType === 'application/pdf' ? (
                            <div className="p-3 text-xs text-gray-600 max-h-32 overflow-y-auto">
                              <div className="font-semibold mb-1">📄 Vista previa PDF:</div>
                              <div className="whitespace-pre-wrap">{doc.preview}</div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Classification info */}
                      <div className="mt-3 text-xs">
                        {doc.classification.tipoDocumento && (
                          <div className="text-gray-600">
                            Tipo: <span className="font-semibold">{doc.classification.tipoDocumento}</span>
                          </div>
                        )}
                        {doc.classification.empleadoId && (
                          <div className="text-gray-600">
                            <div>
                              Código: <span className="font-semibold">{doc.classification.empleadoId}</span>
                            </div>
                            {doc.classification.empleadoNombre && (
                              <div className="text-sm mt-1 text-gray-500">
                                Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span>
                              </div>
                            )}
                            {doc.classification.empleadoNombreFromDb && (
                              <div className="text-sm mt-1 text-green-700">
                                Nombre asociado: <span className="font-semibold">{doc.classification.empleadoNombreFromDb}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {!doc.classification.empleadoId && doc.classification.empleadoNombre && (
                          <div className="text-gray-600">
                            Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span>
                          </div>
                        )}
                        {!doc.classification.empleadoId && doc.classification.empleadoNombre && (
                          <div className="text-yellow-600 italic">
                            ⚠️ Código no encontrado
                          </div>
                        )}
                        {doc.classification.confidence > 0 && (
                          <div className="text-gray-500">
                            Confianza: {(doc.classification.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>

                      {/* Folder metadata */}
                      {doc.folderMetadata && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                          {doc.folderMetadata.employeeFolderName && (
                            <div className="truncate" title={doc.folderMetadata.folderPath}>
                              👤 Empleado: <span className="font-semibold text-blue-600">{doc.folderMetadata.employeeFolderName}</span>
                            </div>
                          )}
                          {doc.folderMetadata.subfolderName && doc.folderMetadata.subfolderName !== doc.folderMetadata.folderName && (
                            <div className="truncate" title={doc.folderMetadata.folderPath}>
                              📁 Subcarpeta: <span className="font-semibold">{doc.folderMetadata.subfolderName}</span>
                            </div>
                          )}
                          <div className="truncate" title={doc.folderMetadata.folderPath}>
                            📂 Carpeta: {doc.folderMetadata.folderName || 'root'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedDocuments.size > 0 ? (
                  <span className="font-semibold text-purple-600">
                    {selectedDocuments.size} documento{selectedDocuments.size !== 1 ? 's' : ''} seleccionado{selectedDocuments.size !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span>No hay documentos seleccionados</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  disabled={saving}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSelected}
                  disabled={saving || selectedDocuments.size === 0}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      💾 Guardar Seleccionados ({selectedDocuments.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dialog de confirmare modern */}
      {showConfirmDialog && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={handleCancelUpload}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'scaleIn 0.3s ease-out',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">📁</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-1">
                    Confirmar Carga de Carpeta
                  </h2>
                  <p className="text-purple-100 text-sm">
                    Se procesarán {pendingFiles.length} archivos
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">ℹ️</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium mb-2">
                      Información de la carpeta seleccionada:
                    </p>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">📊 Total archivos:</span>
                        <span className="bg-white px-2 py-1 rounded-md font-bold text-purple-600">
                          {pendingFiles.length}
                        </span>
                      </div>
                      {pendingFiles.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">📂 Carpeta:</span>
                          <span className="text-gray-600">
                            {(() => {
                              const firstPath = pendingFiles[0]?.webkitRelativePath || pendingFiles[0]?.name || '';
                              const folderName = firstPath.split('/')[0] || 'root';
                              return folderName;
                            })()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">💾 Tamaño aproximado:</span>
                        <span className="text-gray-600">
                          {(() => {
                            const totalSize = pendingFiles.reduce((sum, file) => sum + (file.size || 0), 0);
                            const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
                            return `${sizeMB} MB`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-amber-800 font-medium text-sm mb-1">
                      Advertencia
                    </p>
                    <p className="text-amber-700 text-sm">
                      Se procesarán todos los archivos de la carpeta seleccionada. 
                      Asegúrate de que confías en el origen de estos archivos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelUpload}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUpload}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal cu rezultate detaliate */}
      {showModal && result && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {result.success ? '✅ Procesamiento Completado' : '❌ Error'}
                </h2>
                <p className="text-purple-100 text-sm">
                  {result.success ? 'Resultados de la carga de carpeta' : 'Ha ocurrido un error'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {result.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <div className="text-2xl font-bold text-green-600">{result.saved || 0}</div>
                      <div className="text-sm text-gray-600 mt-1">Guardados</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-600">{result.skipped || 0}</div>
                      <div className="text-sm text-gray-600 mt-1">Duplicados</div>
                    </div>
                    {result.errors > 0 && (
                      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                        <div className="text-2xl font-bold text-red-600">{result.errors}</div>
                        <div className="text-sm text-gray-600 mt-1">Errores</div>
                      </div>
                    )}
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-800">
                      ✅ Los documentos guardados están disponibles en la sección de revisión de documentos.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-800 font-semibold mb-2">Error:</p>
                  <p className="text-red-700">{result.error || 'Error desconocido'}</p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
