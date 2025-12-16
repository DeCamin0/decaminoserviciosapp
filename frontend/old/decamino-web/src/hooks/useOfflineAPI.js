import { useSyncQueue } from './useSyncQueue';
import { useOfflineStatus } from './useOfflineStatus';

/**
 * Hook pentru a intercepta API calls și a le gestiona offline
 * Foarte simplu și sigur - nu modifică nimic din aplicația existentă
 */
export const useOfflineAPI = () => {
  const { isOffline } = useOfflineStatus();
  const { addToSyncQueue } = useSyncQueue();

  // Funcție pentru a face API calls cu suport offline
  const fetchWithOfflineSupport = async (url, options = {}) => {
    // Dacă ești online, fă request-ul normal
    if (!isOffline) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        console.error('❌ Error en API call:', error);
        throw error;
      }
    }

    // Dacă ești offline, salvează în sync queue
    console.log('📝 Modo offline - guardando en cola de sincronización');
    
    // Extrage datele din body pentru sync queue
    let data = {};
    if (options.body) {
      try {
        data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (error) {
        console.warn('⚠️ No se pudo parsear body para sync queue:', error);
        data = { rawBody: options.body };
      }
    }

    // Adaugă în sync queue
    addToSyncQueue(
      options.method || 'POST', // action
      url,                      // endpoint
      data                      // data
    );

    // Returnează un response mock pentru a nu strica aplicația
    return {
      ok: true,
      status: 202, // Accepted - va fi procesat când revii online
      json: async () => ({ 
        success: true, 
        message: 'Cambio guardado localmente, se sincronizará cuando vuelvas a estar online',
        offline: true 
      })
    };
  };

  return {
    fetchWithOfflineSupport,
    isOffline
  };
};
