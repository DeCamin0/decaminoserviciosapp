import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const Notification = ({ 
  type = 'success', 
  title, 
  message, 
  duration = 5000, 
  onClose, 
  show = true,
  isConfirmDialog = false,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimating(true);
      
      // Auto-hide after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [show, duration, handleClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      default:
        return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          title: 'text-green-900'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-800',
          title: 'text-red-900'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          title: 'text-yellow-900'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          title: 'text-blue-900'
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          title: 'text-green-900'
        };
    }
  };

  const colors = getColors();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Notification */}
      <div 
        className={`relative bg-white rounded-xl shadow-2xl border-2 ${colors.border} max-w-md w-full transform transition-all duration-300 ${
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className={`${colors.bg} px-6 py-4 rounded-t-xl border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getIcon()}
              <h3 className={`text-lg font-semibold ${colors.title}`}>
                {title || (type === 'success' ? '¡Éxito!' : type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Información')}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              title="Închide notificarea"
              aria-label="Închide notificarea"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className={`text-base ${colors.text}`}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className={`${colors.bg} px-6 py-3 rounded-b-xl border-t ${colors.border}`}>
          <div className="flex justify-end space-x-3">
            {isConfirmDialog ? (
              <>
                <button
                  onClick={onCancel || handleClose}
                  className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm || handleClose}
                  className="px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
                >
                  {confirmText}
                </button>
              </>
            ) : (
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
              >
                Aceptar
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for auto-hide */}
        {duration > 0 && !isConfirmDialog && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-xl overflow-hidden">
            <div 
              className="h-full transition-all duration-300 bg-red-500"
              style={{
                width: isAnimating ? '100%' : '0%',
                transition: `width ${duration}ms linear`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Notification;
