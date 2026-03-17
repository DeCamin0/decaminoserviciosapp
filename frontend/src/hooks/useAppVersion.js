import { useState, useEffect, useCallback, useRef } from 'react';

export const useAppVersion = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false); // Ref pentru a preveni apelurile multiple simultane
  const lastCheckRef = useRef(0); // Ref pentru a preveni verificări prea frecvente

  const checkForUpdates = useCallback(async () => {
    // Previne apelurile multiple simultane
    if (isCheckingRef.current || needsRefresh) return;
    
    // Debounce: nu permite verificări mai frecvente decât la 5 secunde
    const now = Date.now();
    if (now - lastCheckRef.current < 5000) {
      return;
    }
    lastCheckRef.current = now;
    
    isCheckingRef.current = true;
    setIsChecking(true);
    
    // Verifică dacă ServiceWorker-ul este într-o stare validă înainte de a continua
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
          // ServiceWorker-ul este activ - continuă cu verificarea
        } else {
          // ServiceWorker-ul nu este activ - continuă cu verificarea normală (fără log)
        }
      } catch {
        // Dacă nu poate obține registration, continuă cu verificarea normală (fără log)
      }
    }
    
    try {
      // Detectează dacă e Chrome Mobile sau PWA
      const isChromeMobile = /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      
      // Pentru Chrome Mobile și PWA - cache busting mai agresiv
      let fetchUrl, fetchOptions;
      
      if (isChromeMobile || isPWA) {
        fetchUrl = `/index.html?t=${timestamp}&nocache=${timestamp}&_=${randomId}&chrome_mobile=${timestamp}&pwa=${timestamp}&force=${Date.now()}`;
        fetchOptions = {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'If-Modified-Since': '0',
            'If-None-Match': '*',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Chrome-Mobile': 'true'
          }
        };
        
        // Pentru Chrome Mobile - încearcă și cu XMLHttpRequest ca fallback
        if (isChromeMobile) {
          try {
            const xhrResponse = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', fetchUrl, true);
              xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              xhr.setRequestHeader('Pragma', 'no-cache');
              xhr.setRequestHeader('Expires', '0');
              xhr.setRequestHeader('If-Modified-Since', '0');
              xhr.setRequestHeader('X-Chrome-Mobile', 'true');
              xhr.onload = () => resolve(xhr);
              xhr.onerror = () => reject(new Error('XHR failed'));
              xhr.send();
            });
            
              if (xhrResponse.status === 200) {
              const html = xhrResponse.responseText;
              const versionMatch = html.match(/data-version="([^"]+)"/);
              const serverVersion = versionMatch ? versionMatch[1] : null;
              
              // Log doar în dev sau dacă versiunea s-a schimbat
              if (import.meta.env.DEV || serverVersion !== localStorage.getItem('app-version')) {
                console.log('🔍 Chrome Mobile XHR version:', serverVersion);
              }
              
              if (serverVersion) {
                const storedVersion = localStorage.getItem('app-version');
                if (serverVersion !== storedVersion) {
                  console.info('Nouă versiune disponibilă:', serverVersion);
                  setNeedsRefresh(true);
                  return;
                }
              }
            }
          } catch (xhrError) {
            console.log('⚠️ Chrome Mobile XHR fallback failed:', xhrError);
          }
        }
      } else {
        // Logica normală pentru alte browser-e
        fetchUrl = `/index.html?t=${timestamp}&nocache=${timestamp}&_=${randomId}`;
        fetchOptions = {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'If-Modified-Since': '0'
          }
        };
      }
      
      const response = await fetch(fetchUrl, fetchOptions);
      
      if (response.ok) {
        const html = await response.text();

        // Caută versiunea în HTML (din build-ul Vite)
        const versionMatch = html.match(/data-version="([^"]+)"/);
        const serverVersion = versionMatch ? versionMatch[1] : null;

        // Verifică dacă versiunea din localStorage este diferită
        const storedVersion = localStorage.getItem('app-version');

        if (serverVersion && serverVersion !== storedVersion) {
          console.info('Nouă versiune disponibilă:', serverVersion);
          setNeedsRefresh(true);
          // Nu actualiza localStorage până când utilizatorul confirmă
        } else if (serverVersion && !storedVersion) {
          localStorage.setItem('app-version', serverVersion);
          console.log('✅ Initial version stored:', serverVersion);
        }
      } else {
        console.warn('⚠️ Failed to fetch index.html for version check:', response.status);
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [needsRefresh]); // Elimină isChecking din dependențe pentru a evita loop-ul

  const forceRefresh = async () => {
    console.log('🔄 Forcing refresh to new version...');
    
    // Obține versiunea curentă de pe server înainte de ștergere
    let serverVersion = null;
    try {
      // Detectează automat calea corectă bazată pe URL-ul curent
      const response = await fetch(`/index.html?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const versionMatch = html.match(/data-version="([^"]+)"/);
        serverVersion = versionMatch ? versionMatch[1] : null;
        console.log('🔍 Server version detected:', serverVersion);
      }
    } catch (error) {
      console.error('❌ Error getting server version:', error);
    }
    
    // Salvează versiunea serverului pentru a o marca ca acceptată
    if (serverVersion) {
      localStorage.setItem('app-version', serverVersion);
      sessionStorage.setItem('accepted-version', serverVersion);
    }
    
    // Folosește PWA update system în loc de custom ServiceWorker management
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Folosește PWA standard update
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          
          // Așteaptă ca noul controller să devină activ
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          }, { once: true });
          
          // Dacă nu există waiting worker, forțează update
          if (!registration.waiting) {
            await registration.update();
            // Dacă încă nu există waiting după update, reîncarcă direct
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } else {
          // Dacă nu există registration, reîncarcă direct
          window.location.reload();
        }
      } catch (error) {
        console.error('❌ Error with PWA update:', error);
        // Fallback la reload simplu
        window.location.reload();
      }
    } else {
      // Fallback pentru browser-e fără ServiceWorker
      window.location.reload();
    }
  };

  const dismissUpdate = async () => {
    setNeedsRefresh(false);
    // Actualizează versiunea stocată când utilizatorul respinge actualizarea
    try {
      const response = await fetch(`/index.html?t=${Date.now()}`, {
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const html = await response.text();
        const versionMatch = html.match(/data-version="([^"]+)"/);
        const serverVersion = versionMatch ? versionMatch[1] : null;
        
        if (serverVersion) {
          localStorage.setItem('app-version', serverVersion);
          console.log('✅ Version updated in localStorage:', serverVersion);
        }
      }
    } catch (error) {
      console.error('❌ Error getting version for dismiss:', error);
    }
  };

  // Verifică pentru actualizări la încărcarea paginii
  useEffect(() => {
    // Restaurează versiunea acceptată după refresh forțat
    const acceptedVersion = sessionStorage.getItem('accepted-version');
    if (acceptedVersion) {
      localStorage.setItem('app-version', acceptedVersion);
      sessionStorage.removeItem('accepted-version');
      console.log('✅ Accepted version restored after refresh:', acceptedVersion);
    }
    
    // Delay mic pentru a evita apeluri imediate la mount
    const timeoutId = setTimeout(() => {
      checkForUpdates();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Rulează doar o dată la mount

  // Verifică pentru actualizări la fiecare 5 minute (redus de la 2 minute)
  useEffect(() => {
    const interval = setInterval(() => {
      checkForUpdates();
    }, 300000); // 5 minute (redus frecvența)
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Nu depinde de checkForUpdates pentru a evita loop-ul

  // Verifică pentru actualizări când utilizatorul revine pe tab (cu debounce mai agresiv)
  useEffect(() => {
    let timeoutId;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Debounce mai agresiv: 10 secunde delay
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          checkForUpdates();
        }, 10000); // 10 secunde delay (mărit de la 2)
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Nu depinde de checkForUpdates pentru a evita loop-ul

  return {
    needsRefresh,
    isChecking,
    forceRefresh,
    dismissUpdate,
    checkForUpdates
  };
};
