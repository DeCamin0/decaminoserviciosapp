import { useState } from 'react';
import { useAutofirmaSigning } from '../hooks/useAutofirmaSigning';
import InstallAutofirmaModal from './InstallAutofirmaModal';
import { SigningError } from '../types/signing';

interface SignWithAutoFirmaButtonProps {
  documentId: string;
  employeeId: string; // ID-ul angajatului
  reason?: string;
  pdfFile: File; // PDF-ul ca File object
  label?: string;
  className?: string;
  lang?: 'ro' | 'es';
  onSuccess?: (info: { sessionId: string }) => void;
  onError?: (err: Error) => void;
}

type SigningState = 'idle' | 'preparing' | 'opening' | 'waiting' | 'downloading';

export default function SignWithAutoFirmaButton({
  documentId,
  employeeId,
  reason,
  pdfFile,
  label = 'Semnează cu AutoFirma',
  className = '',
  lang = 'ro',
  onSuccess,
  onError
}: SignWithAutoFirmaButtonProps) {
  const [signingState, setSigningState] = useState<SigningState>('idle');
  const [showInstall, setShowInstall] = useState(false);
  const { sign } = useAutofirmaSigning();

  const strings = {
    ro: {
      preparing: 'Pregătesc…',
      opening: 'Deschid AutoFirma…',
      waiting: 'Aștept semnarea…',
      downloading: 'Se descarcă PDF-ul semnat…',
      error: 'Eroare la semnare'
    },
    es: {
      preparing: 'Preparando…',
      opening: 'Abriendo AutoFirma…',
      waiting: 'Esperando la firma…',
      downloading: 'Descargando PDF firmado…',
      error: 'Error al firmar'
    }
  }[lang];

  const getButtonText = () => {
    switch (signingState) {
      case 'preparing':
        return strings.preparing;
      case 'opening':
        return strings.opening;
      case 'waiting':
        return strings.waiting;
      case 'downloading':
        return strings.downloading;
      default:
        return label;
    }
  };

  const getButtonIcon = () => {
    switch (signingState) {
      case 'preparing':
        return '⏳';
      case 'opening':
        return '🚀';
      case 'waiting':
        return '⏳';
      case 'downloading':
        return '📥';
      default:
        return '✍️';
    }
  };

  const isDisabled = signingState !== 'idle';

  async function handleClick() {
    if (isDisabled) return;

    try {
      setSigningState('preparing');
      
      // Simulează delay pentru prepare
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSigningState('opening');
      
      // Simulează delay pentru deschiderea AutoFirma
      await new Promise(resolve => setTimeout(resolve, 2500));
      setSigningState('waiting');
      
      const result = await sign(documentId, employeeId, reason, pdfFile);
      
      setSigningState('downloading');
      
      // Simulează delay pentru download
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (result.installed === false) {
        setShowInstall(true);
      }
      
      onSuccess?.({ sessionId: result.sessionId });
      
    } catch (error) {
      console.error('Signing error:', error);
      
      let errorMessage = strings.error;
      if (error instanceof SigningError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = lang === 'ro' 
              ? 'Eroare de rețea. Verifică conexiunea la internet.'
              : 'Error de red. Verifica la conexión a internet.';
            break;
          case 'TIMEOUT':
            errorMessage = lang === 'ro'
              ? 'Semnarea a durat prea mult. Încearcă din nou.'
              : 'La firma tardó demasiado. Inténtalo de nuevo.';
            break;
          case 'SIGNING_ERROR':
            // Verifică dacă eroarea conține java.lang.Exception
            if (error.message && error.message.includes('java.lang.Exception')) {
              errorMessage = lang === 'ro' 
                ? 'Eroare la semnarea documentului. Verifică că AutoFirma este instalat și funcționează corect.'
                : 'Error al firmar el documento. Verifica que AutoFirma esté instalado y funcionando correctamente.';
            } else {
              errorMessage = error.message || strings.error;
            }
            break;
          default:
            errorMessage = error.message || strings.error;
        }
      }
      
      onError?.(error as Error);
      alert(errorMessage);
      
    } finally {
      setSigningState('idle');
    }
  }

  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 ${className}`}
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isDisabled}
        aria-label={getButtonText()}
      >
        <span className="text-lg">{getButtonIcon()}</span>
        <span>{getButtonText()}</span>
      </button>

      {showInstall && (
        <InstallAutofirmaModal
          lang={lang}
          installUrl={import.meta.env.VITE_AUTOFIRMA_INSTALL_URL}
          onClose={() => setShowInstall(false)}
        />
      )}
    </>
  );
}
