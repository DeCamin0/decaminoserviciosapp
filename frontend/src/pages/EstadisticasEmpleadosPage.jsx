import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button } from '../components/ui';
import { Navigate } from 'react-router-dom';
import { routes } from '../utils/routes';
import EmpleadosChartsSection from '../components/analytics/EmpleadosChartsSection';
import Back3DButton from '../components/Back3DButton.jsx';

export default function EstadisticasEmpleadosPage() {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('mes');
  const [selectedCentro, setSelectedCentro] = useState('todos');
  const [empleados, setEmpleados] = useState([]);
  const [allEmpleados, setAllEmpleados] = useState([]); // Toți angajații pentru distribuție pe centre
  const [fichajes, setFichajes] = useState([]);
  const [centros, setCentros] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const hasStatisticsPermission = useCallback(() => {
    const grupo = authUser?.GRUPO;
    const isAdmin = authUser?.isAdmin || grupo === 'Admin';
    const isDeveloper = authUser?.isDeveloper || grupo === 'Developer';
    const isSupervisor = grupo === 'Supervisor';
    const isManager = grupo === 'Manager';

    return isAdmin || isDeveloper || isSupervisor || isManager;
  }, [authUser]);

  const fetchEmpleadosStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch empleados cu headere pentru a evita 403
      const empleadosRes = await fetch(routes.getEmpleados, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      
      let empleadosArray = [];
      
      if (empleadosRes.status === 403) {
        console.warn('🚫 403 Forbidden la getEmpleados în EstadisticasEmpleadosPage. Setez lista goală.');
        setEmpleados([]);
        setAllEmpleados([]);
        setCentros(['todos']);
        setFichajes([]);
      } else if (!empleadosRes.ok) {
        console.error('Error fetching empleados:', empleadosRes.status);
        setEmpleados([]);
        setAllEmpleados([]);
        setCentros(['todos']);
        setFichajes([]);
      } else {
        const empleadosData = await empleadosRes.json();
        empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
        
        // Extract centros
        const centrosUnicos = [...new Set(empleadosArray.map(emp => emp['CENTRO TRABAJO']).filter(Boolean))];
        setCentros(['todos', ...centrosUnicos]);
        
        // Salvez toți angajații pentru distribuția pe centre
        setAllEmpleados(empleadosArray);
        
        // Filter empleados by centro
        const empleadosFiltrados = selectedCentro === 'todos' 
          ? empleadosArray 
          : empleadosArray.filter(emp => emp['CENTRO TRABAJO'] === selectedCentro);
        
        setEmpleados(empleadosFiltrados);

        // Fetch fichajes (backend nou, fără n8n)
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const fichajesRes = await fetch(routes.getFichajes, { headers });
        const fichajesData = await fichajesRes.json();
        const fichajesArray = Array.isArray(fichajesData) ? fichajesData : [];
        
        // Filter fichajes by period
        let fichajesFiltrados = [];
        const hoy = new Date();
        
        switch (selectedPeriod) {
          case 'hoy': {
            const hoyStr = hoy.toISOString().split('T')[0];
            fichajesFiltrados = fichajesArray.filter(f => f.FECHA === hoyStr);
            break;
          }
          case 'semana': {
            const semanaAtras = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
            fichajesFiltrados = fichajesArray.filter(f => {
              const fecha = new Date(f.FECHA);
              return fecha >= semanaAtras;
            });
            break;
          }
          case 'mes': {
            const mesAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
            fichajesFiltrados = fichajesArray.filter(f => {
              const fecha = new Date(f.FECHA);
              return fecha >= mesAtras;
            });
            break;
          }
        }

        // Filter fichajes by centro if needed
        if (selectedCentro !== 'todos') {
          fichajesFiltrados = fichajesFiltrados.filter(f => {
            const empleado = empleadosArray.find(emp => 
              emp['CORREO ELECTRONICO'] === f['CORREO ELECTRONICO']
            );
            return empleado && empleado['CENTRO TRABAJO'] === selectedCentro;
          });
        }
        
        setFichajes(fichajesFiltrados);
      }
      
    } catch (error) {
      console.error('Error fetching empleados stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCentro, selectedPeriod]);

  useEffect(() => {
    if (hasStatisticsPermission()) {
      fetchEmpleadosStats();
    }
  }, [fetchEmpleadosStats, hasStatisticsPermission]);

  // Si no tiene permisos, redirige a inicio
  if (!hasStatisticsPermission()) {
    return <Navigate to="/inicio" replace />;
  }

  const periods = [
    { id: 'hoy', label: 'Hoy', icon: '📅' },
    { id: 'semana', label: 'Esta Semana', icon: '📊' },
    { id: 'mes', label: 'Este Mes', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Cargando estadísticas de empleados...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header modern */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Back3DButton to="/estadisticas" title="Volver a Estadísticas" />
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                  Estadísticas de Empleados
                </h1>
                <p className="text-gray-500 text-sm">Rendimiento y actividad de empleados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <span>🔍</span>
                Filtros
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtre moderne */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Filtros Avanzados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <div className="flex gap-2">
                  {periods.map(period => (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriod(period.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        selectedPeriod === period.id
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{period.icon}</span>
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Centro</label>
                <select
                  value={selectedCentro}
                  onChange={(e) => setSelectedCentro(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {centros.map(centro => (
                    <option key={centro} value={centro}>
                      {centro === 'todos' ? 'Todos los Centros' : centro}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos Interactivos */}
        <EmpleadosChartsSection 
          empleados={empleados}
          allEmpleados={allEmpleados}
          fichajes={fichajes}
          selectedPeriod={selectedPeriod}
          selectedCentro={selectedCentro}
        />
      </div>
    </div>
  );
} 