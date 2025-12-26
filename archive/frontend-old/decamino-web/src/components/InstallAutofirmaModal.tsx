import { useEffect, useRef } from 'react';
import { X, Download, Info, CheckCircle } from 'lucide-react';

interface InstallAutofirmaModalProps {
  lang?: 'ro' | 'es';
  installUrl?: string;
  onClose: () => void;
}

export default function InstallAutofirmaModal({
  lang = 'ro',
  installUrl,
  onClose
}: InstallAutofirmaModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management și click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    // Focus primul element interactiv
    const firstButton = modalRef.current?.querySelector('button, a');
    if (firstButton instanceof HTMLElement) {
      firstButton.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const strings = {
    ro: {
      title: 'Instalează AutoFirma',
      message: 'Nu pare că AutoFirma s-a deschis. Te rugăm să o instalezi și să încerci din nou.',
      download: 'Descarcă AutoFirma',
      close: 'Închide',
      steps: [
        'Descarcă și instalează AutoFirma de pe site-ul oficial',
        'Repornește browserul după instalare',
        'Încearcă din nou să semnezi documentul'
      ]
    },
    es: {
      title: 'Instala AutoFirma',
      message: 'Parece que AutoFirma no se abrió. Instálala y vuelve a intentarlo.',
      download: 'Descargar AutoFirma',
      close: 'Cerrar',
      steps: [
        'Descarga e instala AutoFirma desde el sitio oficial',
        'Reinicia el navegador después de la instalación',
        'Intenta firmar el documento nuevamente'
      ]
    }
  }[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Info className="w-6 h-6 text-yellow-600" />
            </div>
            <h2 id="modal-title" className="text-xl font-bold text-gray-900">
              {strings.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            aria-label={strings.close}
            title={strings.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6 leading-relaxed">
            {strings.message}
          </p>

          {/* Pași de instalare */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              {lang === 'ro' ? 'Pași de instalare:' : 'Pasos de instalación:'}
            </h3>
            <div className="space-y-2">
              {strings.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                  </div>
                  <p className="text-sm text-gray-600">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Buton de descărcare */}
          {installUrl && (
            <div className="mb-6">
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
                {strings.download}
              </a>
            </div>
          )}

          {/* Buton de închidere */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              {strings.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
