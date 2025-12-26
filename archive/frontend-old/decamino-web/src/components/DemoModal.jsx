import { useAuth } from '../contexts/AuthContextBase';

const DemoModal = ({ isOpen, onClose }) => {
  const { loginDemo } = useAuth();
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    console.log('🎭 Starting DEMO login...');
    const result = loginDemo();
    if (result.success) {
      console.log('🎭 DEMO login successful');
      onClose();
    } else {
      console.error('🎭 DEMO login failed:', result.error);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop click to close */}
      <div 
        className="absolute inset-0" 
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="relative p-6 text-center border-b border-gray-100">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Modo DEMO
          </h3>
          
          <p className="text-sm text-gray-600 leading-relaxed">
            Entra en modo demostración para explorar todas las funcionalidades con datos simulados
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Datos simulados:</span> Todos los datos son ficticios y de prueba
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Funcionalidad completa:</span> Explora todas las características sin restricciones
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Sin cambios permanentes:</span> No se guardarán datos reales
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Importante:</span> Este es un entorno de demostración. Cualquier acción realizada no afectará los datos reales del sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg hover:from-orange-400 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Entrar en DEMO</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoModal;
