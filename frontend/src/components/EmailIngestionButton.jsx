import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail, ChevronDown, RefreshCw, X, Eye, Save, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { routes } from '../utils/routes';
import { Modal, AlertBanner } from './ui';

export default function EmailIngestionButton({ variant = 'toolbar' }) {
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
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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
    { value: 'all', label: 'Todas (leídas + no leídas)' },
    { value: 'read', label: 'Solo leídas' },
    { value: 'unread', label: 'Solo no leídas' },
  ];

  const limitOptions = [
    { value: null, label: 'Todas (sin límite)' },
    { value: 50, label: '50 emails' },
    { value: 100, label: '100 emails' },
    { value: 200, label: '200 emails' },
    { value: 500, label: '500 emails' },
  ];

  const optionsForm = (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Tipo de email</p>
        <div className="space-y-1">
          {readStatusOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                name="readStatus"
                value={option.value}
                checked={readStatus === option.value}
                onChange={(e) => setReadStatus(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Límite de emails</p>
        <div className="space-y-1">
          {limitOptions.map((option) => (
            <label
              key={option.value === null ? 'null' : option.value}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <input
                type="radio"
                name="limit"
                value={option.value === null ? 'all' : option.value}
                checked={limit === option.value}
                onChange={(e) => setLimit(e.target.value === 'all' ? null : parseInt(e.target.value, 10))}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Filtrar por subiect (opcional)
        </label>
        <input
          type="text"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          placeholder="Ej: ALTA OPERARIA/O:"
          className="app-modal__input w-full"
        />
        <p className="text-xs text-gray-500 mt-1">Deja vacío para procesar todos los emails</p>
      </div>
    </div>
  );

  const triggerButton = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      disabled={loading}
      className={variant === 'toolbar'
        ? 'solicitud-admin-btn w-full sm:w-auto disabled:opacity-50'
        : 'relative group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'}
      style={variant === 'toolbar' ? undefined : {
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
        <span className="inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
          <span>Procesando…</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Mail className="w-4 h-4" aria-hidden />
          <span>{variant === 'toolbar' ? 'Extraer emails' : 'Extractar Email-uri'}</span>
          {variant === 'toolbar' ? (
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
          ) : (
            <svg className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      )}
    </button>
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
                {result.saved != null ? (
                  <>
                    <div>Guardados: {result.saved || 0}</div>
                    <div>Duplicados: {result.skipped || 0}</div>
                    {result.errors > 0 && <div>Errores: {result.errors}</div>}
                  </>
                ) : (
                  <>
                    <div>Procesados: {result.processed || 0}</div>
                    <div>Insertados: {result.inserted || 0}</div>
                    <div>Duplicados: {result.skipped || 0}</div>
                  </>
                )}
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

      {triggerButton}

      {isOpen && !loading && typeof document !== 'undefined' && (isMobile ? createPortal(
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Extraer emails"
          size="md"
          className="app-modal--form app-modal--bottom-sheet"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col gap-2 w-full">
              <button type="button" onClick={() => setIsOpen(false)} className="solicitud-admin-btn w-full">
                Cancelar
              </button>
              <button type="button" onClick={handleIngest} className="solicitud-admin-btn solicitud-admin-btn--primary w-full">
                Procesar
              </button>
            </div>
          )}
        >
          {optionsForm}
        </Modal>,
        document.body
      ) : createPortal(
        <div
          ref={dropdownRef}
          className="documentos-empleados-ingestion-popover fixed w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-[99999] p-4"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          {optionsForm}
          <button type="button" onClick={handleIngest} className="solicitud-admin-btn solicitud-admin-btn--primary w-full mt-4">
            Procesar
          </button>
        </div>,
        document.body
      ))}

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
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  disabled={saving}
                  className="solicitud-admin-btn"
                >
                  Cancelar
                </button>
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
              <button type="button" onClick={handleSelectAll} disabled={saving} className="solicitud-admin-btn text-xs">
                Seleccionar todos
              </button>
              <button type="button" onClick={handleDeselectAll} disabled={saving} className="solicitud-admin-btn text-xs">
                Deseleccionar
              </button>
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
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.id)}
                      onChange={() => handleToggleDocument(doc.id)}
                      disabled={doc.isDuplicate || saving}
                      className="mt-1 w-4 h-4 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {doc.size > 1024 * 1024
                          ? `${(doc.size / (1024 * 1024)).toFixed(2)} MB`
                          : `${(doc.size / 1024).toFixed(2)} KB`}
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
                      <div className="text-gray-600 dark:text-gray-400">
                        Tipo: <span className="font-semibold">{doc.classification.tipoDocumento}</span>
                      </div>
                    )}
                    {doc.classification.empleadoId && (
                      <div className="text-gray-600 dark:text-gray-400">
                        <div>Código: <span className="font-semibold">{doc.classification.empleadoId}</span></div>
                        {doc.classification.empleadoNombre && (
                          <div className="mt-1">Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span></div>
                        )}
                        {doc.classification.empleadoNombreFromDb && (
                          <div className="mt-1 text-green-700 dark:text-green-400">
                            Nombre asociado: <span className="font-semibold">{doc.classification.empleadoNombreFromDb}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!doc.classification.empleadoId && doc.classification.empleadoNombre && (
                      <>
                        <div className="text-gray-600 dark:text-gray-400">
                          Nombre extraído: <span className="font-semibold">{doc.classification.empleadoNombre}</span>
                        </div>
                        <div className="text-amber-700 dark:text-amber-400 italic">Código no encontrado</div>
                      </>
                    )}
                    {doc.classification.confidence > 0 && (
                      <div className="text-gray-500">Confianza: {(doc.classification.confidence * 100).toFixed(0)}%</div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    <div className="truncate" title={doc.emailMetadata.from}>De: {doc.emailMetadata.from}</div>
                    <div className="break-words" title={doc.emailMetadata.subject}>
                      <span className="font-semibold">Asunto:</span> {doc.emailMetadata.subject}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <button type="button" onClick={() => setShowModal(false)} className="solicitud-admin-btn solicitud-admin-btn--primary w-full sm:w-auto">
              Cerrar
            </button>
          )}
        >
          {result.success ? (
            <div className="space-y-4">
              <div className="documentos-empleados-ingestion-stats">
                {result.processed != null && (
                  <div className="documentos-empleados-ingestion-stat">
                    <div className="documentos-empleados-ingestion-stat__value">{result.processed || 0}</div>
                    <div className="documentos-empleados-ingestion-stat__label">Procesados</div>
                  </div>
                )}
                {result.inserted != null && (
                  <div className="documentos-empleados-ingestion-stat">
                    <div className="documentos-empleados-ingestion-stat__value">{result.inserted || 0}</div>
                    <div className="documentos-empleados-ingestion-stat__label">Insertados</div>
                  </div>
                )}
                {result.saved != null && (
                  <div className="documentos-empleados-ingestion-stat">
                    <div className="documentos-empleados-ingestion-stat__value">{result.saved || 0}</div>
                    <div className="documentos-empleados-ingestion-stat__label">Guardados</div>
                  </div>
                )}
                <div className="documentos-empleados-ingestion-stat">
                  <div className="documentos-empleados-ingestion-stat__value">{result.skipped || 0}</div>
                  <div className="documentos-empleados-ingestion-stat__label">Duplicados</div>
                </div>
              </div>
              {result.details && (
                <AlertBanner variant="info" title="Detalles adicionales" compact>
                  <div className="space-y-0.5 text-sm">
                    <div>Mensajes obtenidos: {result.details.messagesFetched || 0}</div>
                    <div>Adjuntos extraídos: {result.details.attachmentsExtracted || 0}</div>
                    <div>Documentos creados: {result.details.documentsCreated || 0}</div>
                  </div>
                </AlertBanner>
              )}
              <AlertBanner variant="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}>
                {result.saved != null
                  ? `Documentos guardados (${result.saved || 0}).${result.errors > 0 ? ` Errores: ${result.errors}` : ''}`
                  : 'Los documentos extraídos están disponibles en la sección de revisión.'}
              </AlertBanner>
            </div>
          ) : (
            <AlertBanner variant="danger" title="Error">
              {result.error || 'Error desconocido'}
            </AlertBanner>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
}
