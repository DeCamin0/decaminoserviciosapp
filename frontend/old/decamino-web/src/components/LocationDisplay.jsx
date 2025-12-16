import { useLocation } from '../contexts/LocationContextBase';

const LocationDisplay = () => {
  const { currentAddress, isLoading, error } = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Obteniendo ubicación...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-md border border-red-200 dark:border-red-800 max-w-xs">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-red-600 dark:text-red-400">Error de ubicación</span>
      </div>
    );
  }

  if (!currentAddress) {
    return (
      <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-w-xs">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ubicación no disponible</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200 max-w-xs">
      {/* Icon modernizat cu fundal circular */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
      
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
          Ubicación actual:
        </span>
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={currentAddress}>
          {currentAddress}
        </div>
      </div>
    </div>
  );
};

export default LocationDisplay;
