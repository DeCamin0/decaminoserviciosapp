const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col w-full ${sizes[size]} ${className}`}>
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Închide modalul"
              aria-label="Închide modalul"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal; 