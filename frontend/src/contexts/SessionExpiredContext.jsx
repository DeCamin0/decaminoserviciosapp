/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const SessionExpiredContext = createContext({
  showSessionExpired: () => {},
  hideSessionExpired: () => {},
  isSessionExpired: false,
});

export const useSessionExpired = () => {
  const context = useContext(SessionExpiredContext);
  if (!context) {
    throw new Error('useSessionExpired must be used within SessionExpiredProvider');
  }
  return context;
};

export const SessionExpiredProvider = ({ children }) => {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [message, setMessage] = useState('');
  const hasBeenShownRef = useRef(false);

  const showSessionExpired = useCallback((msg = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.') => {
    // Previne apariția multiplă a modalului
    if (hasBeenShownRef.current || isSessionExpired) {
      console.log('[SessionExpired] Modal already shown, ignoring duplicate call');
      return;
    }
    console.log('[SessionExpired] Showing modal');
    setMessage(msg);
    setIsSessionExpired(true);
    hasBeenShownRef.current = true;
  }, [isSessionExpired]);

  const hideSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
    setMessage('');
    // Nu resetăm hasBeenShownRef aici - odată ce a fost afișat, nu mai apare până la re-login
  }, []);

  // Reset flag-ul când utilizatorul se loghează din nou (când token-ul devine valid)
  const resetSessionExpired = useCallback(() => {
    hasBeenShownRef.current = false;
    setIsSessionExpired(false);
    setMessage('');
  }, []);

  // Reset flag-ul când token-ul devine valid (monitorizează auth_token)
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('auth_token');
      if (token && hasBeenShownRef.current) {
        // Token-ul există și modalul a fost afișat anterior - resetăm flag-ul
        // Asta înseamnă că utilizatorul s-a logat din nou
        hasBeenShownRef.current = false;
        setIsSessionExpired(false);
        setMessage('');
      }
    };

    // Verifică imediat
    checkToken();

    // Verifică periodic (la fiecare 5 secunde)
    const interval = setInterval(checkToken, 5000);

    // Ascultă pentru schimbări în localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'auth_token') {
        checkToken();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <SessionExpiredContext.Provider
      value={{
        showSessionExpired,
        hideSessionExpired,
        isSessionExpired,
        message,
        resetSessionExpired,
      }}
    >
      {children}
    </SessionExpiredContext.Provider>
  );
};
