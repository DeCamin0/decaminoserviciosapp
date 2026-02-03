import { useEffect, useRef } from 'react';
import { isTokenFullyExpired, getTokenTimeRemaining, getValidAccessToken } from '../utils/tokenRefresh';
import { useSessionExpired } from '../contexts/SessionExpiredContext';

/**
 * Hook pentru monitorizarea periodică a token-ului
 * Verifică dacă token-ul a expirat și emite evenimentul de sesiune expirată
 * 
 * @param {number} checkInterval - Intervalul de verificare în milisecunde (default: 30 secunde)
 */
export function useTokenMonitor(checkInterval = 30000) {
  const { showSessionExpired } = useSessionExpired();
  const intervalRef = useRef(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Verifică imediat la mount
    const checkToken = async () => {
      // Evită verificări simultane
      if (isCheckingRef.current) return;
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        // Nu avem token, nu facem nimic (poate utilizatorul nu e logat)
        return;
      }

      // Verifică dacă token-ul e complet expirat
      if (isTokenFullyExpired()) {
        // Token-ul a expirat complet, încercăm refresh o ultimă dată
        try {
          isCheckingRef.current = true;
          await getValidAccessToken();
          // Dacă refresh-ul reușește, token-ul e valid acum
          isCheckingRef.current = false;
        } catch (error) {
          // Refresh-ul a eșuat, sesiunea a expirat
          isCheckingRef.current = false;
          console.warn('[TokenMonitor] Token expired and refresh failed:', error);
          showSessionExpired('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        }
      } else {
        // Token-ul e valid, verifică timpul rămas pentru a preveni expirarea bruscă
        const timeRemaining = getTokenTimeRemaining();
        
        // Dacă mai sunt mai puțin de 2 minute, încercă refresh preventiv
        if (timeRemaining > 0 && timeRemaining < 120) {
          try {
            isCheckingRef.current = true;
            await getValidAccessToken();
            isCheckingRef.current = false;
          } catch (error) {
            // Refresh preventiv a eșuat, dar token-ul încă e valid
            // Nu emitem sesiune expirată încă, așteptăm să expire complet
            isCheckingRef.current = false;
            console.warn('[TokenMonitor] Preventive refresh failed:', error);
          }
        }
      }
    };

    // Verifică imediat
    checkToken();

    // Setează intervalul de verificare
    intervalRef.current = setInterval(checkToken, checkInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkInterval, showSessionExpired]);

  // Cleanup la unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}
