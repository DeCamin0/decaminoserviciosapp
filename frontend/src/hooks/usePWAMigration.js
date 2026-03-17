import { useEffect } from 'react';
import { config } from '../config/env';

/** Production host from env (EXTERNAL_SITE_URL); no hardcoded domain. */
const getProductionHost = () => {
  const u = config.EXTERNAL_SITE_URL || '';
  if (!u) return '';
  try { return new URL(u).hostname; } catch { return ''; }
};

/**
 * Hook pentru migrarea automată PWA de la rădăcină la /app
 * Detectează dacă PWA-ul rulează pe rădăcină și face redirect automat
 */
export const usePWAMigration = () => {
  useEffect(() => {
    const handlePWAMigration = () => {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone === true;
      const prodHost = getProductionHost();
      const isProduction = prodHost ? window.location.hostname === prodHost : false;
      
      // Detectează dacă e pe rădăcină (nu pe /app)
      const isOnRoot = window.location.pathname === '/' || 
                       window.location.pathname === '/index.html';
      
      if (import.meta.env.DEV) {
        console.debug('PWA Migration Check:', { isPWA, isProduction, isOnRoot, currentPath: window.location.pathname });
      }
      
      // Nou: nu mai redirecționăm PWA-ul către /app, aplicația rulează în root
      // Păstrăm doar logging-ul pentru diagnostic
      if (import.meta.env.DEV && isPWA && isProduction && isOnRoot) {
        console.debug('PWA Migration disabled: app serves from root "/"');
      }
    };

    // Rulează migrarea la încărcarea paginii
    handlePWAMigration();

    // Rulează migrarea și când PWA devine activ
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handlePWAMigration();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};

/**
 * Hook pentru a afișa notificare de migrare (opțional)
 */
export const usePWAMigrationNotification = () => {
  useEffect(() => {
    const showMigrationNotification = () => {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true;
      
      const prodHost = getProductionHost();
      const isProduction = prodHost ? window.location.hostname === prodHost : false;
      const hasMigrated = sessionStorage.getItem('pwa-migrated');
      
      if (isPWA && isProduction && !hasMigrated) {
        // Afișează notificare că PWA-ul se va actualiza
        console.log('📱 PWA will be updated to new location');
        
        // Poți adăuga aici o notificare vizuală dacă vrei
        // toast.info('Actualizando PWA a nueva ubicación...');
      }
    };

    showMigrationNotification();
  }, []);
};
