import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Link } from 'react-router-dom';
import Back3DButton from '../components/Back3DButton.jsx';
import AccessMatrix from '../components/admin/AccessMatrix';
import UserStats from '../components/admin/UserStats';
import ActivityLog from '../components/admin/ActivityLog';
import PushSubscribersList from '../components/admin/PushSubscribersList';
import EmpleadosStatusList from '../components/admin/EmpleadosStatusList';
// ServerMonitor eliminat

export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Verifică dacă utilizatorul este admin
  const isAdmin = authUser?.GRUPO === 'Admin' || authUser?.grupo === 'Admin';
  const isDeveloper = authUser?.GRUPO === 'Developer' || authUser?.grupo === 'Developer';

  useEffect(() => {
    if (!isAdmin && !isDeveloper) {
      setError('Acceso restringido. Solo los administradores pueden acceder a esta página.');
      return;
    }
    setLoading(false);
  }, [isAdmin, isDeveloper]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Cargando Panel de Administración...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <div className="text-red-600 font-bold text-xl mb-4">Acceso Restringido</div>
          <div className="text-gray-600 mb-6">{error}</div>
          <Link 
            to="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            <span className="mr-2">←</span>
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header modern */}
      <div className="bg-gradient-to-br from-red-600 to-red-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Back3DButton to="/dashboard" title="Regresar al Dashboard" />
              <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Panel</h1>
                <p className="text-red-100 text-sm">{isDeveloper ? 'Developer Tools' : 'Administración del sistema'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/90">
                Conectado como: <span className="font-semibold">{authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Botón Reportar Error */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el panel de administración', '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="text-base">📱</span>
            Reportar error
          </button>
        </div>

        {/* Tabs de navigare */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              📊 Estadísticas
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'access'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              🔐 Control de Acceso
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'activity'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              📝 Registro de Actividad
            </button>
            <button
              onClick={() => setActiveTab('push-subscribers')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'push-subscribers'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              🔔 Suscriptores Push
            </button>
            <button
              onClick={() => setActiveTab('empleados-status')}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'empleados-status'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              👥 Estado Empleados
            </button>
            {/* Servere eliminat */}
          </div>
        </div>

        {/* Conținut tab-uri */}
        <div className="space-y-8">
          {activeTab === 'stats' && (
            <UserStats />
          )}
          
          {activeTab === 'access' && (
            <>
              <AccessMatrix />
            </>
          )}
          
          {activeTab === 'activity' && <ActivityLog />}

          {activeTab === 'push-subscribers' && <PushSubscribersList />}

          {activeTab === 'empleados-status' && <EmpleadosStatusList />}

          {/* Conținut pentru tabul Servere a fost eliminat */}
        </div>
      </div>
    </div>
  );
} 