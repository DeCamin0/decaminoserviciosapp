import { Button } from '../ui';
import PDFViewerAndroid from '../PDFViewerAndroid';
import { Loader2, FileText, Download } from 'lucide-react';

function closePreview(previewData, onClose) {
  if (previewData?.pdfUrl && typeof previewData.pdfUrl === 'string' && previewData.pdfUrl.startsWith('blob:')) {
    window.URL.revokeObjectURL(previewData.pdfUrl);
  }
  onClose();
}

export default function InspectionPdfPreviewModal({
  isOpen,
  previewData,
  previewLoading,
  isIOS,
  isAndroid,
  onClose,
  onDownload,
  title = 'Vista previa PDF',
}) {
  if (!isOpen) return null;

  const handleClose = () => closePreview(previewData, onClose);

  return (
    <div className="app-modal-overlay inspecciones-pdf-modal" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        className="app-modal app-modal--preview app-modal--form inspecciones-pdf-modal__panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal__header">
          <div className="min-w-0">
            <h2 className="app-modal__title">{title}</h2>
            {previewData?.id ? (
              <p className="text-xs text-gray-500 truncate mt-0.5">{previewData.id}</p>
            ) : null}
          </div>
          <button type="button" onClick={handleClose} className="app-modal__close" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="app-modal__body inspecciones-pdf-modal__body">
          {previewLoading ? (
            <div className="inspecciones-pdf-modal__state">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-color)]" aria-hidden />
              <p>Cargando PDF…</p>
            </div>
          ) : previewData?.error ? (
            <div className="inspecciones-pdf-modal__state inspecciones-pdf-modal__state--error">
              <p>{previewData.error}</p>
            </div>
          ) : previewData?.pdfUrl ? (
            <div className="inspecciones-pdf-modal__frame">
              {isAndroid || isIOS ? (
                <PDFViewerAndroid pdfUrl={previewData.pdfUrl} className="w-full h-full" onClose={handleClose} />
              ) : (
                <iframe src={previewData.pdfUrl} className="inspecciones-pdf-modal__iframe" title={`Preview ${previewData.id || ''}`} />
              )}
            </div>
          ) : (
            <div className="inspecciones-pdf-modal__state">
              <FileText className="w-10 h-10 text-gray-400" aria-hidden />
              <p>No se encontró el PDF</p>
            </div>
          )}
        </div>

        <div className="app-modal__footer app-modal__actions">
          {onDownload && previewData?.pdfUrl && !previewData?.error ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onDownload(previewData)}>
              <Download className="w-4 h-4" aria-hidden />
              Descargar
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
