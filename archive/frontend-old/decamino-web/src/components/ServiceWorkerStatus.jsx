import { useState, useEffect } from 'react';
import { getServiceWorkerStatus, resolveServiceWorkerConflicts } from '../utils/swConflictResolver';

/**
 * Component pentru afișarea status-ului ServiceWorker
 * Util pentru debugging conflicts
 */
export const ServiceWorkerStatus = ({ show = false }) => {
  const [status, setStatus] = useState(null);
  const [conflicts, setConflicts] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const swStatus = await getServiceWorkerStatus();
      setStatus(swStatus);
      
      // Verifică conflicts
      const hasConflicts = await resolveServiceWorkerConflicts();
      setConflicts(hasConflicts);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!show || !status) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-300 rounded-lg p-3 shadow-lg text-xs max-w-xs z-50">
      <div className="font-semibold text-gray-700 mb-2">ServiceWorker Status</div>
      
      {status.error && (
        <div className="text-red-600 mb-1">❌ Error: {status.error}</div>
      )}
      
      {!status.supported && (
        <div className="text-yellow-600 mb-1">⚠️ Not supported</div>
      )}
      
      {status.registered && (
        <div className="space-y-1">
          <div className={`flex items-center ${status.controller ? 'text-green-600' : 'text-yellow-600'}`}>
            {status.controller ? '✅' : '⚠️'} Controller: {status.controller ? 'Active' : 'Inactive'}
          </div>
          
          {status.installing && (
            <div className="text-blue-600">🔄 Installing: {status.installing}</div>
          )}
          
          {status.waiting && (
            <div className="text-orange-600">⏳ Waiting: {status.waiting}</div>
          )}
          
          {status.active && (
            <div className="text-green-600">✅ Active: {status.active}</div>
          )}
          
          {conflicts && (
            <div className="text-red-600">⚠️ Conflicts detected</div>
          )}
        </div>
      )}
      
      {!status.registered && status.supported && (
        <div className="text-gray-600">📝 Not registered</div>
      )}
    </div>
  );
};

export default ServiceWorkerStatus;
