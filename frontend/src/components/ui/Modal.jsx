const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '',
  showCloseButton = true,
  closeOnBackdrop = true
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col w-full ${sizes[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all active:scale-95"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <span className="text-3xl sm:text-4xl leading-none">×</span>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 relative">
          {children}
        </div>
        {showCloseButton && (
          <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors active:scale-95 shadow-md"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal; 