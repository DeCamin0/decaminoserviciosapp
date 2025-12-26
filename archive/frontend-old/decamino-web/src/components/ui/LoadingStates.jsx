import { Loader2, RefreshCw, Database, FileText, BarChart3 } from 'lucide-react';

/**
 * Componente de loading consistente pentru toată aplicația
 */

// Loading spinner de bază
export const LoadingSpinner = ({ 
  size = 'md', 
  color = 'red', 
  text = '', 
  className = '',
  icon: Icon = Loader2 
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colors = {
    red: 'text-red-600',
    white: 'text-white',
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    green: 'text-green-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Icon className={`animate-spin ${sizes[size]} ${colors[color]} mb-2`} />
      {text && (
        <p className={`${colors[color]} font-medium text-sm`}>
          {text}
        </p>
      )}
    </div>
  );
};

// Loading pentru pagini întregi
export const PageLoading = ({ 
  title = 'Se încarcă...', 
  subtitle = 'Vă rugăm să așteptați',
  icon: Icon = Database 
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4 flex items-center justify-center">
        <Icon className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{subtitle}</p>
    </div>
  </div>
);

// Loading pentru secțiuni
export const SectionLoading = ({ 
  title = 'Se încarcă...', 
  className = '',
  icon: Icon = RefreshCw 
}) => (
  <div className={`flex items-center justify-center py-8 ${className}`}>
    <div className="text-center">
      <Icon className="animate-spin h-8 w-8 text-red-600 mx-auto mb-2" />
      <p className="text-gray-600 font-medium">{title}</p>
    </div>
  </div>
);

// Loading pentru tabele
export const TableLoading = ({ 
  columns = 4, 
  rows = 5,
  className = '' 
}) => (
  <div className={`overflow-hidden ${className}`}>
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded"></div>
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 mb-2">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Loading pentru carduri
export const CardLoading = ({ 
  title = 'Se încarcă...',
  className = '' 
}) => (
  <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
    <div className="animate-pulse">
      <span className="sr-only">{title}</span>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  </div>
);

// Loading pentru butoane
export const ButtonLoading = ({ 
  children, 
  loading = false, 
  loadingText = 'Se încarcă...',
  className = '' 
}) => (
  <button 
    disabled={loading}
    className={`flex items-center justify-center ${className}`}
  >
    {loading ? (
      <>
        <Loader2 className="animate-spin h-4 w-4 mr-2" />
        {loadingText}
      </>
    ) : (
      children
    )}
  </button>
);

// Loading pentru liste
export const ListLoading = ({ 
  items = 3,
  className = '' 
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Loading pentru formulare
export const FormLoading = ({ 
  fields = 3,
  className = '' 
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    ))}
  </div>
);

// Loading pentru statistici
export const StatsLoading = ({ 
  cards = 4,
  className = '' 
}) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    ))}
  </div>
);

// Loading pentru modale
export const ModalLoading = ({ 
  title = 'Se încarcă...',
  className = '' 
}) => (
  <div className={`flex items-center justify-center p-8 ${className}`}>
    <div className="text-center">
      <Loader2 className="animate-spin h-8 w-8 text-red-600 mx-auto mb-2" />
      <p className="text-gray-600 font-medium">{title}</p>
    </div>
  </div>
);

// Loading pentru dropdown-uri
export const DropdownLoading = ({ 
  className = '' 
}) => (
  <div className={`p-2 ${className}`}>
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
);

// Loading pentru imagini
export const ImageLoading = ({ 
  width = 'w-full',
  height = 'h-48',
  className = '' 
}) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`}>
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
    </div>
  </div>
);

// Loading pentru grafice
export const ChartLoading = ({ 
  className = '' 
}) => (
  <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </div>
);

// Loading pentru fișiere
export const FileLoading = ({ 
  className = '' 
}) => (
  <div className={`flex items-center space-x-3 p-4 ${className}`}>
    <FileText className="h-8 w-8 text-gray-400 animate-pulse" />
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
    </div>
  </div>
);

// Loading pentru utilizatori
export const UsersLoading = ({ 
  className = '' 
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-3 animate-pulse">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);

// Loading pentru statistici
export const StatisticsLoading = ({ 
  className = '' 
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <BarChart3 className="h-5 w-5 text-gray-400" />
        </div>
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    ))}
  </div>
);

export default {
  LoadingSpinner,
  PageLoading,
  SectionLoading,
  TableLoading,
  CardLoading,
  ButtonLoading,
  ListLoading,
  FormLoading,
  StatsLoading,
  ModalLoading,
  DropdownLoading,
  ImageLoading,
  ChartLoading,
  FileLoading,
  UsersLoading,
  StatisticsLoading
};
