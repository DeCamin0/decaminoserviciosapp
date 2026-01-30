import { useState, useEffect, useCallback } from 'react';
import { useOfflineStatus } from './useOfflineStatus';

/**
 * Hook pentru gestionarea sync queue-ului offline
 * Foarte simplu și sigur - nu modifică nimic din aplicația existentă
 */
export const useSyncQueue = () => {
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, wasOffline } = useOfflineStatus();

  // Încarcă sync queue-ul din localStorage la inițializare
  useEffect(() => {
    const savedQueue = localStorage.getItem('syncQueue');
    if (savedQueue) {
      try {
        // Folosim setTimeout pentru a evita apelarea sincronă a setState
        const timer = setTimeout(() => {
          setSyncQueue(JSON.parse(savedQueue));
        }, 0);
        
        return () => clearTimeout(timer);
      } catch (error) {
        console.warn('⚠️ Error loading sync queue:', error);
        localStorage.removeItem('syncQueue');
      }
    }
  }, []);

  // Salvează sync queue-ul în localStorage când se schimbă
  useEffect(() => {
    if (syncQueue.length > 0) {
      localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
    } else {
      localStorage.removeItem('syncQueue');
    }
  }, [syncQueue]);

  // Adaugă o acțiune în sync queue
  const addToSyncQueue = useCallback((action, endpoint, data) => {
    const syncItem = {
      id: Date.now() + Math.random(),
      action,
      endpoint,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    setSyncQueue(prev => [...prev, syncItem]);
    console.log('📝 Agregado a cola de sincronización:', action);
  }, []);

  // Sincronizează acțiunile pendiente
  const syncPendingChanges = useCallback(async () => {
    if (syncQueue.length === 0 || isSyncing) return [];

    setIsSyncing(true);
    console.log(`🔄 Sincronizando ${syncQueue.length} cambios...`);

    const results = [];
    
    for (const item of syncQueue) {
      try {
        const response = await fetch(item.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.data)
        });

        if (response.ok) {
          // ✅ Succes - șterge din coadă
          setSyncQueue(prev => prev.filter(i => i.id !== item.id));
          results.push({ success: true, action: item.action });
          console.log(`✅ Sincronizado: ${item.action}`);
        } else {
          // ❌ Eroare - incrementează retry count
          const updatedItem = { ...item, retryCount: item.retryCount + 1 };
          
          if (updatedItem.retryCount >= 3) {
            // Prea multe încercări - șterge din coadă
            setSyncQueue(prev => prev.filter(i => i.id !== item.id));
            results.push({ success: false, action: item.action, error: 'Max retries exceeded' });
            console.error(`❌ Max reintentos alcanzados: ${item.action}`);
          } else {
            // Actualizează item-ul cu noul retry count
            setSyncQueue(prev => prev.map(i => i.id === item.id ? updatedItem : i));
            results.push({ success: false, action: item.action, error: 'Will retry later' });
            console.warn(`⚠️ Error sincronizando ${item.action}, reintentando...`);
          }
        }
      } catch (error) {
        // Eroare de rețea - incrementează retry count
        const updatedItem = { ...item, retryCount: item.retryCount + 1 };
        
        if (updatedItem.retryCount >= 3) {
          setSyncQueue(prev => prev.filter(i => i.id !== item.id));
          results.push({ success: false, action: item.action, error: error.message });
          console.error(`❌ Error de red: ${item.action}`, error);
        } else {
          setSyncQueue(prev => prev.map(i => i.id === item.id ? updatedItem : i));
          results.push({ success: false, action: item.action, error: 'Network error' });
          console.warn(`⚠️ Error de red ${item.action}, reintentando...`);
        }
      }
    }

    setIsSyncing(false);
    
    // Log rezultatele
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`📊 Sincronización completada: ${successCount} exitosos, ${errorCount} errores`);
    
    return results;
  }, [isSyncing, syncQueue]);

  // Sincronizează automat când revii online
  useEffect(() => {
    if (isOnline && wasOffline && syncQueue.length > 0) {
      console.log('🔄 Sincronizando cambios pendientes...');
      // Folosim setTimeout pentru a evita apelarea sincronă a setState
      const timer = setTimeout(() => {
        syncPendingChanges();
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, syncPendingChanges, syncQueue.length]);

  // Golește sync queue-ul manual
  const clearSyncQueue = useCallback(() => {
    setSyncQueue([]);
    localStorage.removeItem('syncQueue');
    console.log('🗑️ Cola de sincronización limpiada');
  }, []);

  return {
    syncQueue,
    isSyncing,
    addToSyncQueue,
    syncPendingChanges,
    clearSyncQueue,
    pendingCount: syncQueue.length
  };
};
