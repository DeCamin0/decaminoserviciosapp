import { usePWAUpdate } from '../hooks/usePWAUpdate';
import { useState } from 'react';

const PWAUpdatePrompt = () => {
  const { updateAvailable, updateApp, dismissUpdate } = usePWAUpdate();
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setError('');
    
    try {
      console.log('🔄 Starting PWA update...');
      await updateApp();
      console.log('✅ PWA update completed');
    } catch (err) {
      console.error('❌ PWA update error:', err);
      setError(err.message || 'Error al actualizar');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white/95 backdrop-blur-sm border border-red-200 rounded-xl shadow-2xl p-4 animate-slide-in">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Actualización Disponible
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Hay una nueva versión de la aplicación. ¿Quieres actualizarla ahora?
            </p>
            
            {error && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Actualizando...' : 'Actualizar Ahora'}
              </button>
              <button
                onClick={dismissUpdate}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Más Tarde
              </button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={dismissUpdate}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              title="Închide notificarea"
              aria-label="Închide notificarea de actualizare"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
