import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useSyncQueue } from '../hooks/useSyncQueue';

/**
 * Component pentru afișarea indicatorilor offline/online
 * Foarte simplu și sigur - nu modifică nimic din aplicația existentă
 */
const OfflineIndicator = () => {
  const { isOnline, isOffline, wasOffline } = useOfflineStatus();
  const { pendingCount, isSyncing } = useSyncQueue();

  // Nu afișa nimic dacă ești online și nu ai sincronizări
  if (isOnline && !wasOffline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Indicator offline */}
      {isOffline && (
        <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Sin conexión</span>
        </div>
      )}

      {/* Indicator sincronizare */}
      {isOnline && (isSyncing || pendingCount > 0) && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mb-2">
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Sincronizando...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
              <span className="text-sm font-medium">
                {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      )}

      {/* Indicator conexiune restaurată */}
      {isOnline && wasOffline && pendingCount === 0 && (
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          <span className="text-sm font-medium">Conectado</span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
