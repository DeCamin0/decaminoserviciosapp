import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../utils/routes';

export default function EmailIngestionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [readStatus, setReadStatus] = useState('all');
  const [limit, setLimit] = useState(null); // null = toate, altfel număr
  const [subjectFilter, setSubjectFilter] = useState(''); // Filtru pentru subiect (text liber)
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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

  const handleIngest = async () => {
    setLoading(true);
    setResult(null);
    setIsOpen(false);
    setSelectedDocuments(new Set());

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.previewEmails, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          readStatus,
          limit: limit || null, // null = toate
          subjectFilter: subjectFilter.trim() || null, // null dacă e gol
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.documents) {
        // Show preview modal
        setPreviewDocuments(data.documents);
        // Pre-select non-duplicate documents
        const nonDuplicates = new Set(
          data.documents
            .filter(doc => !doc.isDuplicate)
            .map(doc => doc.id)
        );
        setSelectedDocuments(nonDuplicates);
        setShowPreviewModal(true);
      } else {
        throw new Error('No documents found or preview failed');
      }
    } catch (error) {
      console.error('Error previewing emails:', error);
      setResult({
        success: false,
        error: error.message || 'Error al procesar emails',
      });
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } finally {
      setLoading(false);
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
      
      // Convert documents to format expected by backend (without content - will be re-fetched only for selected ones)
      // Backend will re-fetch only the selected attachments, not all messages
      const documentsToSave = selectedDocsData.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        normalizedFilename: doc.normalizedFilename,
        contentType: doc.contentType,
        size: doc.size,
        classification: doc.classification,
        emailMetadata: doc.emailMetadata,
        idempotencyKey: doc.idempotencyKey,
      }));

      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.saveSelectedDocuments, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          selectedDocuments: documentsToSave,
          readStatus,
          limit: limit || null,
          subjectFilter: subjectFilter.trim() || null, // null dacă e gol
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

  const readStatusOptions = [
    { value: 'all', label: '📧 Todas (leídas + no leídas)' },
    { value: 'read', label: '✅ Solo leídas' },
    { value: 'unread', label: '📬 Solo no leídas' },
  ];

  const limitOptions = [
    { value: null, label: '🌐 Todas (sin límite)' },
    { value: 50, label: '50 emails' },
    { value: 100, label: '100 emails' },
    { value: 200, label: '200 emails' },
    { value: 500, label: '500 emails' },
  ];

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
                    <div>Procesados: {result.processed || 0}</div>
                    <div>Insertados: {result.inserted || 0}</div>
                    <div>Duplicados: {result.skipped || 0}</div>
                    {result.details && (
                      <div className="mt-1 text-xs opacity-75">
                        Mensajes: {result.details.messagesFetched || 0} | 
                        Adjuntos: {result.details.attachmentsExtracted || 0}
                      </div>
                    )}
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
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="relative group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: loading
            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
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
            <span className="text-lg">📥</span>
            <span>Extractar Email-uri</span>
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

      {/* Dropdown - Using Portal to render directly in body to escape overflow:hidden containers */}
      {isOpen && !loading && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-64 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.98) 100%)',
            border: '2px solid rgba(59, 130, 246, 0.2)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <div className="p-4">
            <div className="font-bold text-gray-800 mb-3 text-sm">Selecciona tipo de email:</div>
            <div className="space-y-2 mb-4">
              {readStatusOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="readStatus"
                    value={option.value}
                    checked={readStatus === option.value}
                    onChange={(e) => setReadStatus(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="font-bold text-gray-800 mb-3 text-sm">Límite de emails:</div>
            <div className="space-y-2 mb-4">
              {limitOptions.map((option) => (
                <label
                  key={option.value === null ? 'null' : option.value}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="limit"
                    value={option.value === null ? 'all' : option.value}
                    checked={limit === option.value}
                    onChange={(e) => setLimit(e.target.value === 'all' ? null : parseInt(e.target.value))}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="font-bold text-gray-800 mb-3 text-sm">Filtros adicionales:</div>
            <div className="space-y-2 mb-4">
              <label className="block">
                <span className="text-sm text-gray-700 mb-1 block">🔍 Filtrar por subiect (opcional):</span>
                <input
                  type="text"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  placeholder="Ej: ALTA OPERARIA/O:"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-xs text-gray-500 mt-1 block">
                  Deja vacío para procesar todos los emails
                </span>
              </label>
            </div>
            <button
              onClick={handleIngest}
              className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-300 transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
              }}
            >
              Procesar
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
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  👁️ Preview Documentos
                </h2>
                <p className="text-blue-100 text-sm">
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
                          ? 'bg-blue-50 border-blue-400 shadow-lg'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={() => handleToggleDocument(doc.id)}
                          disabled={doc.isDuplicate || saving}
                          className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500 rounded"
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
                            {/* Always show extracted name if available */}
                            {doc.classification.empleadoNombre && (
                              <div className="text-sm mt-1 text-gray-500">
                                Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span>
                              </div>
                            )}
                            {/* Show DB name if available (this is the verified/associated name) */}
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

                      {/* Email metadata */}
                      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        <div className="truncate" title={doc.emailMetadata.from}>
                          De: {doc.emailMetadata.from}
                        </div>
                        <div 
                          className="break-words whitespace-normal overflow-wrap-anywhere" 
                          title={doc.emailMetadata.subject}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          <span className="font-semibold">Asunto:</span> {doc.emailMetadata.subject}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedDocuments.size > 0 ? (
                  <span className="font-semibold text-blue-600">
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
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {result.success ? '✅ Procesamiento Completado' : '❌ Error'}
                </h2>
                <p className="text-blue-100 text-sm">
                  {result.success ? 'Resultados de la extracción de emails' : 'Ha ocurrido un error'}
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">{result.processed || 0}</div>
                      <div className="text-sm text-gray-600 mt-1">Procesados</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <div className="text-2xl font-bold text-green-600">{result.inserted || 0}</div>
                      <div className="text-sm text-gray-600 mt-1">Insertados</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-600">{result.skipped || 0}</div>
                      <div className="text-sm text-gray-600 mt-1">Duplicados</div>
                    </div>
                    {result.details && (
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                        <div className="text-2xl font-bold text-purple-600">{result.details.messagesFetched || 0}</div>
                        <div className="text-sm text-gray-600 mt-1">Mensajes</div>
                      </div>
                    )}
                  </div>

                  {result.details && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h3 className="font-bold text-gray-800 mb-2">Detalles Adicionales:</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>📧 Mensajes obtenidos: <span className="font-semibold">{result.details.messagesFetched || 0}</span></div>
                        <div>📎 Adjuntos extraídos: <span className="font-semibold">{result.details.attachmentsExtracted || 0}</span></div>
                        <div>📄 Documentos creados: <span className="font-semibold">{result.details.documentsCreated || 0}</span></div>
                      </div>
                    </div>
                  )}

                  {result.saved !== undefined ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-sm text-green-800 font-semibold mb-2">
                        ✅ Documentos guardados exitosamente
                      </p>
                      <div className="text-xs text-green-700 space-y-1">
                        <div>Guardados: {result.saved || 0}</div>
                        {result.skipped > 0 && <div>Duplicados omitidos: {result.skipped}</div>}
                        {result.errors > 0 && <div className="text-red-600">Errores: {result.errors}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-sm text-green-800">
                        ✅ Los documentos extraídos están disponibles en la sección de revisión de documentos.
                      </p>
                    </div>
                  )}
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
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
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
