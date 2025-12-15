import { useAppVersion } from '../hooks/useAppVersion';
import { usePWAUpdate } from '../hooks/usePWAUpdate';

const BrowserUpdatePrompt = () => {
  const { needsRefresh, forceRefresh, dismissUpdate } = useAppVersion();
  const { updateAvailable: pwaUpdateAvailable } = usePWAUpdate();

  // Nu afișa BrowserUpdatePrompt dacă PWAUpdatePrompt este activ
  // pentru a evita duplicate-urile
  if (!needsRefresh || pwaUpdateAvailable) return null;

  return (
    <div className="fixed top-4 left-4 z-50 max-w-sm">
      <div className="bg-white/95 backdrop-blur-sm border border-blue-200 rounded-xl shadow-2xl p-4 animate-slide-in">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Nueva Versión Disponible
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Hay una nueva versión de la aplicación. ¿Quieres actualizarla ahora?
            </p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={forceRefresh}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Actualizar Ahora
              </button>
              <button
                onClick={dismissUpdate}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
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
              aria-label="Închide notificarea de actualizare browser"
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

export default BrowserUpdatePrompt;
