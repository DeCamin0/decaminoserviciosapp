import { useEffect, useState } from 'react';
import PeriodoSelector from '../../../components/PeriodoSelector';
import { usePeriodo } from '../../../contexts/PeriodoContext';
import { useNavigate } from 'react-router-dom';
import { FacturasProvider, useFacturas } from '../contexts/FacturasContext';
import FacturaForm from '../components/FacturaForm';
import FacturaPreview from '../components/FacturaPreview';
import FacturaLista from '../components/FacturaLista';

// Componenta principală care folosește contextul
const FacturasPageContent = () => {
  const navigate = useNavigate();
  // const { from, to } = usePeriodo(); // Unused variables
  const { getFacturasStats } = useFacturas();
  const [view, setView] = useState('lista'); // 'lista', 'form', 'preview'
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [facturaToEdit, setFacturaToEdit] = useState(null);

  const stats = getFacturasStats();

  // Deschide formularul direct când se intră cu ?view=form
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'form') {
        setView('form');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Gestionează crearea unei facturi noi
  const handleCreateNew = () => {
    setFacturaToEdit(null);
    setSelectedFactura(null);
    setView('form');
  };

  // Gestionează salvarea unei facturi
  const handleSave = (factura) => {
    setSelectedFactura(factura);
    setView('preview');
  };

  // Gestionează editarea unei facturi
  const handleEdit = (factura) => {
    setFacturaToEdit(factura);
    setSelectedFactura(null);
    setView('form');
  };

  // Gestionează vizualizarea unei facturi
  const handleView = (factura) => {
    setSelectedFactura(factura);
    setFacturaToEdit(null);
    setView('preview');
  };

  // Gestionează închiderea preview-ului
  const handleClosePreview = () => {
    setSelectedFactura(null);
    setView('lista');
  };

  // Gestionează anularea formularului
  const handleCancelForm = () => {
    setFacturaToEdit(null);
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
              <h1 className="text-3xl font-bold text-gray-800">Módulo de Facturación</h1>
              <p className="text-gray-600 mt-2">Gestiona las facturas de DeCamino Servicios Auxiliares SL</p>
              <div className="ml-4"><PeriodoSelector /></div>
            </div>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            + Nueva Factura
          </button>
        </div>

        {/* Statistici */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 text-xl">🏦</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Pendientes de pagos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.pendiente}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-green-600 text-xl">📤</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Enviadas</p>
                <p className="text-2xl font-bold text-green-900">{stats.enviado}/{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 rounded-lg">
                <span className="text-amber-600 text-xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-amber-600">Pagadas</p>
                <p className="text-2xl font-bold text-amber-900">{stats.pagado}/{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <span className="text-red-600 text-xl">💳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Pendiente</p>
                <p className="text-2xl font-bold text-red-900">
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(stats.pendingAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Secțiunea detaliată duplicată eliminată pentru claritate */}
      </div>

      {/* Conținut principal */}
      <div className="bg-white rounded-lg shadow-md">
        {view === 'lista' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Lista de Facturas</h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleCreateNew}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  + Nueva Factura
                </button>
              </div>
            </div>
            <FacturaLista
              onEdit={handleEdit}
              onView={handleView}
              onDelete={true}
            />
          </div>
        )}

        {view === 'form' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {facturaToEdit ? 'Editar Factura' : 'Nueva Factura'}
              </h2>
              <button
                onClick={() => setView('lista')}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Volver a la lista
              </button>
            </div>
            <FacturaForm
              facturaToEdit={facturaToEdit}
              onSave={handleSave}
              onCancel={handleCancelForm}
            />
          </div>
        )}

        {view === 'preview' && selectedFactura && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Vista Previa de Factura</h2>
              <button
                onClick={handleClosePreview}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Volver a la lista
              </button>
            </div>
            <FacturaPreview
              factura={selectedFactura}
              onEdit={handleEdit}
              onClose={handleClosePreview}
            />
          </div>
        )}
      </div>

      {/* Informații despre modul */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Información del Módulo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <p><strong>Funcionalidades actuales:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Creación y edición de facturas</li>
              <li>Generación automática de PDF</li>
              <li>Gestión de estados (Borrador, Enviado, eFactura Pendiente, Pagado)</li>
              <li>Filtrado y búsqueda avanzada</li>
              <li>Estadísticas en tiempo real</li>
            </ul>
          </div>
          <div>
            <p><strong>Próximas integraciones:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Conexión con módulo de Clientes</li>
              <li>Integración con sistema eFactura</li>
              <li>Envío automático por email</li>
              <li>Recordatorios de vencimiento</li>
              <li>Reportes avanzados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper cu provider
const FacturasPage = () => {
  return (
    <FacturasProvider>
      <FacturasPageContent />
    </FacturasProvider>
  );
};

export default FacturasPage; 