import { useNavigate } from 'react-router-dom';
import { ImpuestosProvider, useImpuestos } from '../contexts/ImpuestosContext';
import { Card, Badge } from '../../../components/ui';

const ImpuestosDashboardContent = () => {
  const navigate = useNavigate();
  const { stats, loading } = useImpuestos();

  const taxModules = [
    {
      id: 'resumen',
      title: 'Resumen',
      description: 'Vista general de todos los impuestos',
      icon: '📊',
      color: 'bg-blue-500',
      route: '/impuestos/resumen'
    },
    {
      id: 'calendario-fiscal',
      title: 'Calendario Fiscal',
      description: 'Fechas importantes y vencimientos',
      icon: '📅',
      color: 'bg-green-500',
      route: '/impuestos/calendario-fiscal'
    },
    {
      id: 'iva',
      title: 'IVA (303, 390)',
      description: 'Declaraciones de IVA trimestrales y anuales',
      icon: '💰',
      color: 'bg-purple-500',
      route: '/impuestos/iva'
    },
    {
      id: 'irpf',
      title: 'IRPF (130, 100)',
      description: 'Pagos fraccionados y declaración anual',
      icon: '📋',
      color: 'bg-orange-500',
      route: '/impuestos/irpf'
    },
    {
      id: 'retenciones',
      title: 'Retenciones (111, 190)',
      description: 'Retenciones de IRPF e IVA',
      icon: '🔒',
      color: 'bg-red-500',
      route: '/impuestos/retenciones'
    },
    {
      id: 'retenciones-alquileres',
      title: 'Ret. Alquileres (115, 180)',
      description: 'Retenciones por alquileres',
      icon: '🏠',
      color: 'bg-indigo-500',
      route: '/impuestos/retenciones-alquileres'
    },
    {
      id: 'operaciones-terceras',
      title: 'Op. Terceras Personas (347)',
      description: 'Operaciones con terceras personas',
      icon: '👥',
      color: 'bg-teal-500',
      route: '/impuestos/operaciones-terceras'
    },
    {
      id: 'operaciones-intracomunitarias',
      title: 'Op. Intracomunitarias (349)',
      description: 'Operaciones intracomunitarias',
      icon: '🌍',
      color: 'bg-pink-500',
      route: '/impuestos/operaciones-intracomunitarias'
    }
  ];

  const handleModuleClick = (route) => {
    navigate(route);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando módulo de impuestos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/inicio')}
                className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Volver al inicio"
              >
                <span className="text-gray-600 text-lg">←</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Módulo de Impuestos</h1>
                <p className="text-gray-600 mt-2">Gestión completa de impuestos y obligaciones fiscales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-white">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-blue-600 text-2xl">💰</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total IVA</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalIVA}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-orange-600 text-2xl">📋</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total IRPF</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalIRPF}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-red-600 text-2xl">🔒</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingDeclarations}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-green-600 text-2xl">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedDeclarations}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tax Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {taxModules.map((module) => (
            <Card 
              key={module.id}
              className="p-6 bg-white hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleModuleClick(module.route)}
            >
              <div className="text-center">
                <div className={`w-16 h-16 ${module.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                  <span className="text-white text-3xl">{module.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                <p className="text-sm text-gray-600">{module.description}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Acciones Rápidas</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/impuestos/iva')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📝 Nueva Declaración IVA
            </button>
            <button
              onClick={() => navigate('/impuestos/irpf')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              📋 Nuevo Pago IRPF
            </button>
            <button
              onClick={() => navigate('/impuestos/calendario-fiscal')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📅 Ver Calendario Fiscal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImpuestosDashboard = () => {
  return (
    <ImpuestosProvider>
      <ImpuestosDashboardContent />
    </ImpuestosProvider>
  );
};

export default ImpuestosDashboard;
