import { useState, useEffect } from 'react';

/**
 * Hook pentru a detecta starea online/offline
 * Foarte simplu și sigur - nu modifică nimic din aplicația existentă
 */
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Conexión restaurada');
      setIsOnline(true);
      setWasOffline(true);
      
      // Resetează flag-ul după 3 secunde
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      console.log('🔴 Sin conexión - modo offline');
      setIsOnline(false);
    };

    // Adaugă event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    isOffline: !isOnline
  };
};
