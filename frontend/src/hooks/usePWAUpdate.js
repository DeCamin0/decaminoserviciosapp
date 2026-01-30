import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { resolveServiceWorkerConflicts, monitorServiceWorkerConflicts } from '../utils/swConflictResolver';

export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const { updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      console.log('✅ SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('❌ SW registration error', error);
    },
    onNeedRefresh() {
      console.log('🔄 New content available, refresh needed');
      setNeedRefresh(true);
      setUpdateAvailable(true);
    },
    onOfflineReady() {
      console.log('📱 App ready to work offline');
      setOfflineReady(true);
    },
  });

  // Verifică pentru actualizări automat (dev + prod) într-un mod sigur
  useEffect(() => {
    // Monitorizează conflicts de ServiceWorker
    monitorServiceWorkerConflicts();

    const checkForUpdates = async () => {
      if (!('serviceWorker' in navigator)) return;

      try {
        // Rezolvă conflicts înainte de a verifica updates
        await resolveServiceWorkerConflicts();

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        const pingUpdate = () => {
          try {
            registration.update().catch(() => {
              // Ignoră erorile tranzitorii (ex. InvalidStateError în HMR)
            });
          } catch {
            // Ignoră complet
          }
        };

        // Evită cursele la HMR: rulează când fila e idle
        if ('requestIdleCallback' in window) {
          // @ts-ignore
          window.requestIdleCallback(() => pingUpdate());
        } else {
          setTimeout(() => pingUpdate(), 150);
        }
      } catch (error) {
        console.warn('⚠️ ServiceWorker update check failed:', error);
      }
    };

    // rulează imediat și apoi la interval mai frecvent pentru a detecta actualizările mai rapid
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60000); // 60 secunde (mai frecvent pentru producție)
    
    // Verifică și la focus (când utilizatorul revine la tab)
    const handleFocus = () => {
      checkForUpdates();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const updateApp = () => {
    setNeedRefresh(false);
    setUpdateAvailable(false);
    
    // Cere SW-ului să sară peste waiting și reîncarcă atunci când noul controller e activ
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          // Există un waiting worker - încearcă să-l activeze
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Așteaptă ca noul controller să devină activ
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          }, { once: true });
        } else {
          // Nu există waiting worker - reîncarcă direct
          console.log('🔄 No waiting worker found, reloading directly');
          window.location.reload();
        }
      }).catch((error) => {
        // Dacă nu poate obține registration, reîncarcă direct
        console.log('⚠️ Cannot get ServiceWorker registration, reloading directly:', error);
        window.location.reload();
      });
    } else {
      // Fallback pentru browser-e fără ServiceWorker
      window.location.reload();
    }
    
    // Folosește și PWA update system ca backup
    try {
      updateServiceWorker(true);
    } catch (error) {
      console.log('⚠️ PWA updateServiceWorker failed, using fallback:', error);
    }
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
    setUpdateAvailable(false);
  };

  return {
    needRefresh,
    offlineReady,
    updateAvailable,
    updateApp,
    dismissUpdate,
  };
};
