import { useState } from 'react';
import PeriodoSelector from '../../../components/PeriodoSelector';
// import { usePeriodo } from '../../../contexts/PeriodoContext'; // Unused import
import { useNavigate } from 'react-router-dom';
import { GastosProvider, useGastos } from '../contexts/GastosContext';
import GastoPreviewModal from '../components/GastoPreviewModal';
import GastoManualModal from '../components/GastoManualModal';
import GastosTabla from '../components/GastosTabla';
// import GastoLista from '../components/GastoLista'; // Unused import

// Componenta principală care folosește contextul
const GastosPageContent = () => {
  const navigate = useNavigate();
  const { getGastosStats } = useGastos();
  const [view, setView] = useState('upload'); // 'upload', 'lista'
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const stats = getGastosStats();

  const handleModalProcessed = () => {
    setShowPreviewModal(false);
    setView('lista');
  };



  return (
    <div className="space-y-6">
      {/* Header cu statistici */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/inicio-facturacion')}
              className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Regresar al Inicio"
            >
              <span className="text-gray-600 text-lg">←</span>
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-800">Módulo de Gastos</h1>
              <p className="text-gray-600 mt-2">Gestiona los gastos y facturas de proveedores</p>
              <div className="ml-4"><PeriodoSelector /></div>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setView('upload')}
              className={`px-4 py-2 rounded-md transition-colors ${
                view === 'upload'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
                            Cargar Gasto
            </button>
            <button
              onClick={() => setView('lista')}
              className={`px-4 py-2 rounded-md transition-colors ${
                view === 'lista'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Ver Gastos
            </button>
          </div>
        </div>

        {/* Statistici */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 text-xl">📄</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Gastos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-green-600 text-xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Procesados</p>
                <p className="text-2xl font-bold text-green-900">{stats.procesado}</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 rounded-lg">
                <span className="text-amber-600 text-xl">⏳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-amber-600">Pendientes</p>
                <p className="text-2xl font-bold text-amber-900">{stats.pendiente}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-purple-600 text-xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Total Procesado</p>
                <p className="text-2xl font-bold text-purple-900">
                  €{stats.totalProcessed.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Secțiunea detaliată duplicată eliminată pentru claritate */}
      </div>

      {/* Conținut principal */}
      <div className="bg-white rounded-lg shadow-md">
        {view === 'upload' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                             <h2 className="text-2xl font-bold text-gray-800">Cargar Nuevo Gasto</h2>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Cargar vía OCR
              </button>
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cargar Manualmente
              </button>
            </div>
          </div>
        )}

        {view === 'lista' && (
          <div className="p-6">
            <GastosTabla />
          </div>
        )}
      </div>

      {showPreviewModal && (
        <GastoPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onProcessed={handleModalProcessed}
        />
      )}

      {showManualModal && (
        <GastoManualModal
          isOpen={showManualModal}
          onClose={() => setShowManualModal(false)}
          onSaved={() => setView('lista')}
        />
      )}

      {/* Informații despre modul */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Información del Módulo de Gastos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <p><strong>Funcionalidades actuales:</strong></p>
                         <ul className="list-disc list-inside mt-2 space-y-1">
               <li>Carga de cualquier tipo de archivo de proveedores</li>
               <li>Procesamiento automático con IA real</li>
               <li>Extracción automática: total, NIF, fecha, conceptos</li>
               <li>Análisis OCR con endpoint n8n</li>
               <li>Gestión de estados: Cargado, Pendiente, Procesado</li>
               <li>Descarga de archivos originales</li>
             </ul>
          </div>
          <div>
            <p><strong>Integraciones activas:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>✅ OCR real con reconocimiento de texto</li>
              <li>✅ IA para extracción automática de datos</li>
              <li>✅ Endpoint: /webhook/analiza-document-3T2c84S</li>
              <li>🔄 Integración con módulo de Facturación</li>
              <li>🔄 Reportes de gastos mensuales</li>
              <li>🔄 Conciliación automática con facturas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper cu provider
const GastosPage = () => {
  return (
    <GastosProvider>
      <GastosPageContent />
    </GastosProvider>
  );
};

export default GastosPage; 