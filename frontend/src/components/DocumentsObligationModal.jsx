import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  FileUp,
  Lock,
  PenLine,
  ClipboardList,
  LogOut,
  X,
  HeartPulse,
  Camera,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import ContractSigner from './ContractSigner';
import PRLDocumentSigner from './PRLDocumentSigner';
import PRLAutoevaluacionModal from './PRLAutoevaluacionModal';
import {
  resolvePrlManualFooterLayout,
  buildPrlManualFooterFields,
} from '../constants/prlManualPdfFooterFields.js';
import { isContratoDocumento } from '../constants/contratoPdfSignatureLayout.js';
import { routes } from '../utils/routes';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('auth_token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Modal soft/hard documente obligatorii — acțiuni 100% în modal.
 * Pe mobil: signerul se deschide pe portal separat (z-index sus), lista se ascunde.
 */
export default function DocumentsObligationModal({
  open,
  items,
  hardLocked,
  snoozeCount,
  snoozeMax,
  user,
  onSnooze,
  onAfterItemDone,
  onLogout,
  onSigningChange,
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  /** Sync ref — evita setTimeout care rupe user-gesture pe mobil */
  const activeSolicitadoRef = useRef(null);
  const [activeSolicitado, setActiveSolicitado] = useState(null);
  const [showUploadSource, setShowUploadSource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const [oficialDoc, setOficialDoc] = useState(null);
  const [oficialPdfUrl, setOficialPdfUrl] = useState(null);

  const [prlDoc, setPrlDoc] = useState(null);
  const [prlPdfUrl, setPrlPdfUrl] = useState(null);

  const [prlTestDoc, setPrlTestDoc] = useState(null);

  const email =
    user?.['CORREO ELECTRONICO'] || user?.email || user?.EMAIL || '';

  const hasActiveSigner = !!(
    (oficialDoc && oficialPdfUrl) ||
    (prlDoc && prlPdfUrl) ||
    prlTestDoc
  );

  useEffect(() => {
    onSigningChange?.(hasActiveSigner);
    if (hasActiveSigner) {
      document.body.classList.add('docs-obligation-signing');
    } else {
      document.body.classList.remove('docs-obligation-signing');
    }
    return () => {
      document.body.classList.remove('docs-obligation-signing');
      onSigningChange?.(false);
    };
  }, [hasActiveSigner, onSigningChange]);

  const closeOficial = useCallback(() => {
    setOficialDoc(null);
    if (oficialPdfUrl && !String(oficialPdfUrl).startsWith('data:')) {
      try {
        URL.revokeObjectURL(oficialPdfUrl);
      } catch {
        /* ignore */
      }
    }
    setOficialPdfUrl(null);
  }, [oficialPdfUrl]);

  const closePrl = useCallback(() => {
    setPrlDoc(null);
    if (prlPdfUrl && !String(prlPdfUrl).startsWith('data:')) {
      try {
        URL.revokeObjectURL(prlPdfUrl);
      } catch {
        /* ignore */
      }
    }
    setPrlPdfUrl(null);
  }, [prlPdfUrl]);

  const handleFirmarOficial = async (item) => {
    setError(null);
    setBusyKey(item.key);
    try {
      const documento = item.raw;
      const fileName = documento.fileName || '';
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        setError('Solo se pueden firmar documentos PDF.');
        return;
      }
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(email)}&fileName=${encodeURIComponent(fileName)}`;
      const res = await fetch(downloadUrl, {
        headers: authHeaders({ Accept: 'application/pdf, */*' }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      if (!blob.size) throw new Error('PDF vacío');
      const url = isIosDevice()
        ? `data:application/pdf;base64,${await blobToBase64(blob)}`
        : URL.createObjectURL(blob);
      setOficialDoc(documento);
      setOficialPdfUrl(url);
    } catch (e) {
      setError(e.message || 'No se pudo abrir el documento para firmar');
    } finally {
      setBusyKey(null);
    }
  };

  const handleFirmarPrl = async (item) => {
    setError(null);
    setBusyKey(item.key);
    try {
      const doc = item.raw;
      if (doc.es_manual_test && !doc.test_completado) {
        setPrlTestDoc(doc);
        return;
      }
      const fileName = doc.nombre_archivo_original || doc.nombre_archivo || '';
      const isDocx =
        fileName.toLowerCase().endsWith('.docx') ||
        fileName.toLowerCase().endsWith('.doc');
      const res = await fetch(routes.prlDescargarMiDocumento(doc.id), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      if (!blob.size) throw new Error('Documento vacío');
      const useDataUrl = isIosDevice() && !isDocx;
      const url = useDataUrl
        ? `data:application/pdf;base64,${await blobToBase64(blob)}`
        : URL.createObjectURL(blob);
      setPrlDoc({ ...doc, isDocx });
      setPrlPdfUrl(url);
    } catch (e) {
      setError(e.message || 'No se pudo abrir el documento PRL');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSolicitarRm = async (item) => {
    setError(null);
    setBusyKey(`${item.key}-quiero`);
    try {
      const doc = item.raw;
      const res = await fetch(routes.prlSolicitarRM(doc.id), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error ${res.status}`);
      }
      await onAfterItemDone?.();
    } catch (e) {
      setError(e.message || 'No se pudo registrar la solicitud de RM');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRenunciarYFirmar = async (item) => {
    setError(null);
    setBusyKey(`${item.key}-firmar`);
    try {
      const doc = item.raw;
      if (doc.estado === 'NO_APLICA') {
        const renunciaRes = await fetch(routes.prlRenunciarRM(doc.id), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
        });
        if (!renunciaRes.ok) {
          const errData = await renunciaRes.json().catch(() => ({}));
          throw new Error(errData.message || `Error ${renunciaRes.status}`);
        }
      }
      await handleFirmarPrl({ ...item, raw: { ...doc, estado: 'PENDIENTE' } });
    } catch (e) {
      setError(e.message || 'No se pudo abrir la renuncia para firmar');
      setBusyKey(null);
    }
  };

  const handleSubir = (item) => {
    setError(null);
    activeSolicitadoRef.current = item.raw;
    setActiveSolicitado(item.raw);
    setShowUploadSource(true);
  };

  const closeUploadSource = () => {
    setShowUploadSource(false);
  };

  const uploadSelectedFile = async (file) => {
    const solicitado = activeSolicitadoRef.current || activeSolicitado;
    if (!file || !solicitado) return;

    setUploading(true);
    setError(null);
    setShowUploadSource(false);
    try {
      const tipoFinal = solicitado.tipo_documento || '';
      const formData = new FormData();
      formData.append('archivo_0', file);
      formData.append('empleado_id', user?.CODIGO || user?.id || '');
      formData.append(
        'empleado_nombre',
        user?.['NOMBRE / APELLIDOS'] || user?.name || '',
      );
      formData.append(
        'empleado_email',
        user?.['CORREO ELECTRONICO'] || user?.email || '',
      );
      formData.append('tipo_documento_0', tipoFinal);
      formData.append('tipo_documento', tipoFinal);
      formData.append('status', 'pendiente');
      formData.append(
        'uploaded_by',
        user?.['NOMBRE / APELLIDOS'] || user?.name || 'Empleado',
      );
      formData.append('uploaded_by_id', user?.CODIGO || user?.id || '');
      formData.append('uploaded_by_role', user?.GRUPO || user?.role || 'EMPLEADOS');
      formData.append('total_archivos', '1');
      formData.append('archivo_0_nombre', file.name);
      formData.append('archivo_0_tamaño', String(file.size));
      formData.append('archivo_0_tipo', file.type);

      const res = await fetch(routes.uploadDocumento, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          Array.isArray(errData.message)
            ? errData.message.join(', ')
            : errData.message || `Error al subir (${res.status})`,
        );
      }
      activeSolicitadoRef.current = null;
      setActiveSolicitado(null);
      await onAfterItemDone?.();
    } catch (e) {
      setError(e.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadSelectedFile(file);
  };

  const handleItemAction = (item) => {
    if (item.kind === 'oficial') return handleFirmarOficial(item);
    if (item.kind === 'prl') return handleFirmarPrl(item);
    if (item.kind === 'prl_test') {
      setPrlTestDoc(item.raw);
      return;
    }
    if (item.kind === 'solicitado') return handleSubir(item);
  };

  const actionLabel = (item) => {
    if (item.action === 'subir') return 'Subir';
    if (item.action === 'test') return 'Hacer test';
    return 'Firmar';
  };

  const ActionIcon = ({ item }) => {
    if (item.action === 'subir') return <FileUp size={16} aria-hidden />;
    if (item.action === 'test') return <ClipboardList size={16} aria-hidden />;
    return <PenLine size={16} aria-hidden />;
  };

  // Păstrează signerul activ chiar dacă lista soft se închide momentan
  if (!open && !hasActiveSigner) return null;

  const showList = open && !hasActiveSigner;

  const listModal = showList ? (
    <div
      className="app-modal-overlay docs-obligation-overlay"
      role="presentation"
      style={{
        zIndex: 12000,
        background: hardLocked ? 'rgba(15, 23, 42, 0.72)' : 'rgba(15, 23, 42, 0.45)',
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="app-modal app-modal--md docs-obligation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-obligation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal__header">
          <div>
            <h2 id="docs-obligation-title" className="app-modal__title">
              {hardLocked ? (
                <span className="inline-flex items-center gap-2">
                  <Lock size={18} aria-hidden /> Documentos obligatorios
                </span>
              ) : (
                'Documentos pendientes'
              )}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {hardLocked
                ? 'Debes completarlos para usar la aplicación.'
                : 'Complétalos desde aquí. Puedes posponer hasta 3 veces.'}
            </p>
          </div>
          {!hardLocked && (
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              Más tarde {snoozeCount}/{snoozeMax}
            </span>
          )}
        </div>

        <div className="app-modal__body">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-700 text-sm">
              <CheckCircle2 size={18} /> Todo completado
            </div>
          ) : (
            <ul className="docs-obligation-list">
              {items.map((item) => (
                <li key={item.key} className="docs-obligation-list__item">
                  <div className="docs-obligation-list__meta">
                    <span className="docs-obligation-list__title">{item.title}</span>
                    {item.subtitle && (
                      <span className="docs-obligation-list__sub">{item.subtitle}</span>
                    )}
                  </div>
                  {item.kind === 'prl_rm' ? (
                    <div className="docs-obligation-list__actions">
                      <button
                        type="button"
                        className="solicitud-admin-btn solicitud-admin-btn--primary"
                        disabled={!!busyKey || uploading}
                        onClick={() => handleSolicitarRm(item)}
                      >
                        <HeartPulse size={16} aria-hidden />
                        <span>
                          {busyKey === `${item.key}-quiero` ? '…' : 'Quiero el RM'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="solicitud-admin-btn"
                        disabled={!!busyKey || uploading}
                        onClick={() => handleRenunciarYFirmar(item)}
                      >
                        <PenLine size={16} aria-hidden />
                        <span>
                          {busyKey === `${item.key}-firmar`
                            ? '…'
                            : 'Renuncio / Firmar'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="solicitud-admin-btn solicitud-admin-btn--primary"
                      disabled={!!busyKey || uploading}
                      onClick={() => handleItemAction(item)}
                    >
                      <ActionIcon item={item} />
                      <span>{busyKey === item.key ? '…' : actionLabel(item)}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="app-modal__footer docs-obligation-footer">
          {hardLocked ? (
            <button
              type="button"
              className="solicitud-admin-btn"
              onClick={() => onLogout?.()}
            >
              <LogOut size={16} aria-hidden /> Salir
            </button>
          ) : (
            <button
              type="button"
              className="solicitud-admin-btn"
              onClick={() => onSnooze?.()}
              disabled={snoozeCount >= snoozeMax}
            >
              <X size={16} aria-hidden /> Más tarde ({snoozeCount}/{snoozeMax})
            </button>
          )}
        </div>
      </div>

      {showUploadSource ? (
        <div
          className="docs-obligation-upload-source"
          role="dialog"
          aria-label="Elegir origen del documento"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)',
            padding: '1rem',
            borderRadius: 'inherit',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!uploading) closeUploadSource();
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-semibold text-slate-900">
              Subir documento
            </p>
            <p className="mb-3 text-xs text-slate-500">
              {(activeSolicitadoRef.current || activeSolicitado)?.tipo_documento ||
                'Selecciona una opción'}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                className="solicitud-admin-btn w-full justify-start"
                disabled={uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon size={18} aria-hidden />
                <span className="text-left">
                  <span className="block font-semibold">Fototeca</span>
                  <span className="block text-xs text-slate-500">
                    Foto o imagen existente
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="solicitud-admin-btn w-full justify-start"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={18} aria-hidden />
                <span className="text-left">
                  <span className="block font-semibold">Hacer foto</span>
                  <span className="block text-xs text-slate-500">
                    Cámara del dispositivo
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="solicitud-admin-btn w-full justify-start"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={18} aria-hidden />
                <span className="text-left">
                  <span className="block font-semibold">Seleccionar archivo</span>
                  <span className="block text-xs text-slate-500">
                    PDF, imagen u otro archivo
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="solicitud-admin-btn w-full"
                disabled={uploading}
                onClick={closeUploadSource}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,image/heic,image/heif"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/heic,image/heif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  ) : null;

  const signerLayer = hasActiveSigner ? (
    <div
      className="docs-obligation-signer-layer"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      {oficialDoc && oficialPdfUrl && (
        <ContractSigner
          pdfUrl={oficialPdfUrl}
          docId={oficialDoc.doc_id || oficialDoc.id || ''}
          originalFileName={oficialDoc.fileName || ''}
          autoStampMode={isContratoDocumento(oficialDoc)}
          onClose={closeOficial}
          onSignComplete={async () => {
            closeOficial();
            await onAfterItemDone?.();
          }}
        />
      )}

      {prlDoc && prlPdfUrl && (
        <PRLDocumentSigner
          pdfUrl={prlPdfUrl}
          documentoId={prlDoc.id}
          originalFileName={prlDoc.nombre_archivo_original}
          isDocx={prlDoc.isDocx || false}
          footerLayout={
            prlDoc.isDocx
              ? null
              : resolvePrlManualFooterLayout(
                  prlDoc.nombre_archivo_original || prlDoc.template_nombre,
                )
          }
          footerFields={
            prlDoc.isDocx
              ? null
              : resolvePrlManualFooterLayout(
                  prlDoc.nombre_archivo_original || prlDoc.template_nombre,
                )
              ? buildPrlManualFooterFields(user)
              : null
          }
          onClose={closePrl}
          onSuccess={async () => {
            closePrl();
            await onAfterItemDone?.();
          }}
        />
      )}

      {prlTestDoc && (
        <PRLAutoevaluacionModal
          documento={prlTestDoc}
          onClose={() => setPrlTestDoc(null)}
          onSuccess={async () => {
            setPrlTestDoc(null);
            await onAfterItemDone?.();
          }}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      {listModal ? createPortal(listModal, document.body) : null}
      {signerLayer ? createPortal(signerLayer, document.body) : null}
    </>
  );
}
