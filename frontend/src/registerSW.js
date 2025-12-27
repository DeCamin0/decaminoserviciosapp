// ServiceWorker registration for Vite PWA
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('🔄 New content available, refresh needed');
  },
  onOfflineReady() {
    console.log('📱 App ready to work offline');
  },
  onRegistered(r) {
    // Log registrarea și atașează hooks de debug
    console.log('✅ SW Registered:', r);
    
    // Forțează verificarea actualizărilor la fiecare încărcare a aplicației
    if (r) {
      // Verifică actualizări imediat și apoi periodic
      r.update().catch(err => {
        console.log('⚠️ SW update check failed (ignored):', err);
      });
      
      // Verifică actualizări periodic (la fiecare 5 minute)
      setInterval(() => {
        r.update().catch(err => {
          console.log('⚠️ SW periodic update check failed (ignored):', err);
        });
      }, 5 * 60 * 1000); // 5 minute
    }
    
    try {
      if (r && typeof r === 'object') {
        const logSW = (sw) => {
          if (!sw) return;
          console.log('🧩 SW state:', sw.state);
          sw.addEventListener('statechange', () => {
            console.log('🧩 SW statechange →', sw.state);
          });
        };

        // updatefound: când există o nouă versiune
        r.addEventListener?.('updatefound', () => {
          console.log('🆕 updatefound: a new ServiceWorker is installing');
          logSW(r.installing || r.waiting || r.active);
          
          // Dacă există un waiting worker, activează-l automat
          if (r.waiting) {
            console.log('🔄 Activating waiting Service Worker automatically...');
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });

        // log stările curente
        logSW(r.installing);
        logSW(r.waiting);
        logSW(r.active);
      }

      // controllerchange: când noul SW devine activ
      navigator.serviceWorker?.addEventListener('controllerchange', () => {
        console.log('🧭 controllerchange: new ServiceWorker took control');
      });

      // primiți mesaje din SW (ex: RELOAD_PAGE)
      navigator.serviceWorker?.addEventListener('message', (event) => {
        console.log('📨 SW message:', event?.data);
        if (event?.data?.type === 'RELOAD_PAGE') {
          // Nu forțăm reload aici, doar logăm ca să observăm fluxul
          console.log('🔁 SW requested page reload (debug log)');
        }
      });

      // expune utilitare simple pentru debug rapid în consola browserului
      window.__pwaDebug = {
        async status() {
          const reg = await navigator.serviceWorker?.getRegistration();
          return {
            hasRegistration: !!reg,
            installing: reg?.installing?.state,
            waiting: reg?.waiting?.state,
            active: reg?.active?.state,
            controller: !!navigator.serviceWorker?.controller,
          };
        },
        async pingUpdate() {
          const reg = await navigator.serviceWorker?.getRegistration();
          try {
            await reg?.update();
            console.log('📡 pingUpdate done');
          } catch (e) {
            console.log('⚠️ pingUpdate error (ignored):', e?.message || e);
          }
        }
      };
    } catch (e) {
      console.log('⚠️ SW debug hooks attach failed:', e);
    }
  },
  onRegisterError(error) {
    console.log('❌ SW registration error', error);
  }
})

export { updateSW }
