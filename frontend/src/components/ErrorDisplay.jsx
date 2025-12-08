import { X, AlertTriangle, Wifi, Shield, AlertCircle } from 'lucide-react';

/**
 * Component pentru afișarea erorilor într-un mod elegant
 */
const ErrorDisplay = ({ 
  errors = [], 
  onClearError, 
  onClearAll, 
  maxDisplay = 3
}) => {
  if (errors.length === 0) return null;

  const displayErrors = errors.slice(0, maxDisplay);

  const getErrorIcon = (type) => {
    switch (type) {
      case 'network':
        return <Wifi className="w-5 h-5 text-orange-500" />;
      case 'api':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'validation':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'security':
        return <Shield className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  const getErrorColor = (type) => {
    switch (type) {
      case 'network':
        return 'border-orange-200 bg-orange-50';
      case 'api':
        return 'border-red-200 bg-red-50';
      case 'validation':
        return 'border-yellow-200 bg-yellow-50';
      case 'security':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-red-200 bg-red-50';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'acum';
    if (minutes === 1) return 'acum 1 minut';
    if (minutes < 60) return `acum ${minutes} minute`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'acum 1 oră';
    if (hours < 24) return `acum ${hours} ore`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ieri';
    return `acum ${days} zile`;
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {displayErrors.map((error) => (
        <div
          key={error.id}
          className={`
            flex items-start p-3 rounded-lg border shadow-lg
            ${getErrorColor(error.type)}
            animate-in slide-in-from-right duration-300
          `}
        >
          <div className="flex-shrink-0 mr-3">
            {getErrorIcon(error.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {error.message}
              </p>
              
              <button
                onClick={() => onClearError?.(error.id)}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {error.context && (
              <p className="text-xs text-gray-500 mt-1">
                {error.context}
              </p>
            )}
            
            <p className="text-xs text-gray-400 mt-1">
              {formatTime(error.timestamp)}
            </p>
          </div>
        </div>
      ))}
      
      {errors.length > maxDisplay && (
        <div className="text-center">
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Șterge toate erorile ({errors.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;
