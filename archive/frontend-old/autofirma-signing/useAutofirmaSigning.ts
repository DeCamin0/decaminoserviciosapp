import { useCallback } from 'react';
import { prepare, getStatus } from '../lib/signingApi';
import { SignResult, SigningError } from '../types/signing';
import { AUTOFIRMA_CONFIG } from '../config/autofirma';

const DEFAULT_POLL_MS = Number(import.meta.env.VITE_SIGNING_POLL_MS ?? AUTOFIRMA_CONFIG.TIMEOUTS.POLL);
const DEFAULT_POLL_MAX_MS = Number(import.meta.env.VITE_SIGNING_POLL_MAX_MS ?? AUTOFIRMA_CONFIG.TIMEOUTS.MAX);
const AUTOFIRMA_LAUNCH_TIMEOUT = AUTOFIRMA_CONFIG.TIMEOUTS.LAUNCH;

export function useAutofirmaSigning() {
  const pollMs = DEFAULT_POLL_MS;
  const pollMax = DEFAULT_POLL_MAX_MS;

  const sign = useCallback(async (
    documentId: string, 
    employeeId: string, 
    reason?: string, 
    pdfFile: File
  ): Promise<SignResult> => {
    try {
      // 1. Pregătește semnarea
      const prep = await prepare(documentId, employeeId, reason, pdfFile);

      // 2. Încearcă să lansezi AutoFirma
      const openPromise = new Promise<void>((resolve) => {
        // Încercăm protocol handler
        window.location.href = prep.launchUrl;
        
        // Mic delay după care considerăm că nu s-a deschis
        setTimeout(() => resolve(), AUTOFIRMA_LAUNCH_TIMEOUT);
      });

      let needInstallHint = false;
      await openPromise; // După 2.5s, dacă nu avem semne, arătăm modal
      needInstallHint = true;

      // 3. Polling pentru status
      const startTime = Date.now();
      while (Date.now() - startTime < pollMax) {
        const status = await getStatus(prep.statusUrl);
        
        if (status.status === 'done') {
          // Redirecționează browserul către downloadUrl
          const downloadUrl = prep.downloadUrl.startsWith('http') 
            ? prep.downloadUrl 
            : `${import.meta.env.VITE_API_BASE || 'https://n8n.decaminoservicios.com'}${prep.downloadUrl}`;
          
          window.location.href = downloadUrl;
          return { sessionId: prep.sessionId, installed: !needInstallHint, token: prep.token };
        }
        
        if (status.status === 'error') {
          const error = new SigningError(status.message || 'Semnare eșuată');
          error.code = 'SIGNING_ERROR';
          throw error;
        }
        
        // Așteaptă înainte de următorul poll
        await new Promise(resolve => setTimeout(resolve, pollMs));
      }
      
      // Timeout
      const timeoutError = new SigningError('Timeout semnare - procesul a durat prea mult');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
      
    } catch (error) {
      // Re-throw erorile existente
      if (error instanceof SigningError) {
        throw error;
      }
      
      // Wrap erorile neașteptate
      const signingError = new SigningError(`Eroare neașteptată: ${error instanceof Error ? error.message : 'Unknown error'}`);
      signingError.code = 'UNKNOWN_ERROR';
      throw signingError;
    }
  }, [pollMs, pollMax]);

  return { sign };
}
