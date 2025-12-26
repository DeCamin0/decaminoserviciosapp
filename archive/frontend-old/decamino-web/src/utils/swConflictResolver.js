/**
 * ServiceWorker Conflict Resolver
 * Previne și rezolvă conflicts între ServiceWorker-uri
 */

/**
 * Curăță toate ServiceWorker-urile existente
 */
export const clearAllServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    // Unregister toate ServiceWorker-urile existente
    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
    
    console.log('🧹 Cleared all ServiceWorker registrations');
  } catch (error) {
    console.warn('⚠️ Failed to clear ServiceWorker registrations:', error);
  }
};

/**
 * Verifică și rezolvă conflicts de ServiceWorker
 */
export const resolveServiceWorkerConflicts = async () => {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    if (registrations.length > 1) {
      console.warn('⚠️ Multiple ServiceWorker registrations detected:', registrations.length);
      
      // Păstrează doar cel mai recent
      const sortedRegistrations = registrations.sort((a, b) => {
        return new Date(b.active?.scriptURL || 0) - new Date(a.active?.scriptURL || 0);
      });
      
      // Unregister toate în afară de cel mai recent
      const toUnregister = sortedRegistrations.slice(1);
      await Promise.all(
        toUnregister.map(reg => reg.unregister())
      );
      
      console.log('✅ Resolved ServiceWorker conflicts');
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('⚠️ Failed to resolve ServiceWorker conflicts:', error);
    return false;
  }
};

/**
 * Verifică starea ServiceWorker-ului curent
 */
export const getServiceWorkerStatus = async () => {
  if (!('serviceWorker' in navigator)) {
    return { supported: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return { registered: false };
    }

    return {
      registered: true,
      installing: registration.installing?.state,
      waiting: registration.waiting?.state,
      active: registration.active?.state,
      controller: !!navigator.serviceWorker.controller,
      scope: registration.scope,
      updateViaCache: registration.updateViaCache
    };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Forțează update-ul ServiceWorker-ului
 */
export const forceServiceWorkerUpdate = async () => {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      console.warn('⚠️ No ServiceWorker registration found');
      return false;
    }

    // Forțează update
    await registration.update();
    
    // Dacă există waiting worker, activează-l
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Așteaptă controller change
      return new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          resolve(true);
        }, { once: true });
      });
    }
    
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to force ServiceWorker update:', error);
    return false;
  }
};

/**
 * Monitorizează conflicts de ServiceWorker
 */
export const monitorServiceWorkerConflicts = () => {
  if (!('serviceWorker' in navigator)) return;

  // Monitorizează controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 ServiceWorker controller changed');
  });

  // Monitorizează message-uri din ServiceWorker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'CONFLICT_DETECTED') {
      console.warn('⚠️ ServiceWorker conflict detected:', event.data);
      resolveServiceWorkerConflicts();
    }
  });

  // Monitorizează erori
  navigator.serviceWorker.addEventListener('error', (error) => {
    console.error('❌ ServiceWorker error:', error);
  });
};

export default {
  clearAllServiceWorkers,
  resolveServiceWorkerConflicts,
  getServiceWorkerStatus,
  forceServiceWorkerUpdate,
  monitorServiceWorkerConflicts
};
