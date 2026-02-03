/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';

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

  const showSessionExpired = useCallback((msg = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.') => {
    setMessage(msg);
    setIsSessionExpired(true);
  }, []);

  const hideSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
    setMessage('');
  }, []);

  return (
    <SessionExpiredContext.Provider
      value={{
        showSessionExpired,
        hideSessionExpired,
        isSessionExpired,
        message,
      }}
    >
      {children}
    </SessionExpiredContext.Provider>
  );
};
