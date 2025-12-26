import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button } from '../components/ui';
import { Link, Navigate } from 'react-router-dom';
import { routes } from '../utils/routes';

export default function EstadisticasFichajesPage() {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('mes');
  const [selectedCentro, setSelectedCentro] = useState('todos');
  const [stats, setStats] = useState({
    totalFichajes: 0,
    entradas: 0,
    salidas: 0,
    sinSalida: 0,
    totalHoras: 0,
    promedioHoras: 0
  });
  const [detailedStats, setDetailedStats] = useState(null);
  const [centros, setCentros] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Verifică permisiunile pentru statistici
  const canViewStatistics = useCallback(() => {
    const grupo = authUser?.GRUPO;
    const isAdmin = authUser?.isAdmin || grupo === 'Admin';
    const isDeveloper = authUser?.isDeveloper || grupo === 'Developer';
    const isSupervisor = grupo === 'Supervisor';
    const isManager = grupo === 'Manager';

    return isAdmin || isDeveloper || isSupervisor || isManager;
  }, [authUser]);

  const fetchFichajesStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch empleados
      const empleadosRes = await fetch(routes.getEmpleados);
      const empleadosData = await empleadosRes.json();
      const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
      
      // Extract centros
      const centrosUnicos = [...new Set(empleadosArray.map(emp => emp['CENTRO TRABAJO']).filter(Boolean))];
      setCentros(['todos', ...centrosUnicos]);

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
      
      setDetailedStats(null);

      // Calculate stats
      const totalFichajes = fichajesFiltrados.length;
      const entradas = fichajesFiltrados.filter(f => f.TIPO === 'Entrada').length;
      const salidas = fichajesFiltrados.filter(f => f.TIPO === 'Salida').length;
      const sinSalida = Math.max(0, entradas - salidas);

      // Calculate hours
      let totalHoras = 0;
      fichajesFiltrados.forEach(f => {
        if (f.DURACION) {
          const match = f.DURACION.match(/(\d+)h\s*(\d+)?m?/);
          if (match) {
            const h = parseInt(match[1], 10) || 0;
            const m = parseInt(match[2], 10) || 0;
            totalHoras += h + m / 60;
          }
        }
      });

      const promedioHoras = totalFichajes > 0 ? Math.round((totalHoras / totalFichajes) * 100) / 100 : 0;

      const statsData = {
        totalFichajes,
        entradas,
        salidas,
        sinSalida,
        totalHoras: Math.round(totalHoras * 100) / 100,
        promedioHoras
      };

      setStats(statsData);

      // Detailed stats
      const fichajesPorDia = {};
      const fichajesPorEmpleado = {};
      const fichajesPorCentro = {};
      const empleadosUnicos = new Set();

      fichajesFiltrados.forEach(f => {
        // Por día
        const fecha = f.FECHA;
        if (!fichajesPorDia[fecha]) {
          fichajesPorDia[fecha] = {
            fecha,
            total: 0,
            entradas: 0,
            salidas: 0,
            horas: 0
          };
        }
        fichajesPorDia[fecha].total++;
        if (f.TIPO === 'Entrada') fichajesPorDia[fecha].entradas++;
        if (f.TIPO === 'Salida') fichajesPorDia[fecha].salidas++;
        
        if (f.DURACION) {
          const match = f.DURACION.match(/(\d+)h\s*(\d+)?m?/);
          if (match) {
            const h = parseInt(match[1], 10) || 0;
            const m = parseInt(match[2], 10) || 0;
            fichajesPorDia[fecha].horas += h + m / 60;
          }
        }

        // Por empleado
        const email = f['CORREO ELECTRONICO'];
        empleadosUnicos.add(email);
        if (!fichajesPorEmpleado[email]) {
          fichajesPorEmpleado[email] = {
            email,
            total: 0,
            entradas: 0,
            salidas: 0,
            horas: 0,
            nombre: empleadosArray.find(emp => emp['CORREO ELECTRONICO'] === email)?.NOMBRE || email
          };
        }
        fichajesPorEmpleado[email].total++;
        if (f.TIPO === 'Entrada') fichajesPorEmpleado[email].entradas++;
        if (f.TIPO === 'Salida') fichajesPorEmpleado[email].salidas++;
        
        if (f.DURACION) {
          const match = f.DURACION.match(/(\d+)h\s*(\d+)?m?/);
          if (match) {
            const h = parseInt(match[1], 10) || 0;
            const m = parseInt(match[2], 10) || 0;
            fichajesPorEmpleado[email].horas += h + m / 60;
          }
        }

        // Por centro
        const empleado = empleadosArray.find(emp => emp['CORREO ELECTRONICO'] === email);
        const centro = empleado?.['CENTRO TRABAJO'] || 'Fără centru';
        if (!fichajesPorCentro[centro]) {
          fichajesPorCentro[centro] = {
            centro,
            total: 0,
            entradas: 0,
            salidas: 0,
            horas: 0
          };
        }
        fichajesPorCentro[centro].total++;
        if (f.TIPO === 'Entrada') fichajesPorCentro[centro].entradas++;
        if (f.TIPO === 'Salida') fichajesPorCentro[centro].salidas++;
        
        if (f.DURACION) {
          const match = f.DURACION.match(/(\d+)h\s*(\d+)?m?/);
          if (match) {
            const h = parseInt(match[1], 10) || 0;
            const m = parseInt(match[2], 10) || 0;
            fichajesPorCentro[centro].horas += h + m / 60;
          }
        }
      });

      // Convert to arrays and sort
      const fichajesPorDiaArray = Object.values(fichajesPorDia).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      const fichajesPorEmpleadoArray = Object.values(fichajesPorEmpleado).sort((a, b) => b.horas - a.horas);
      const fichajesPorCentroArray = Object.values(fichajesPorCentro).sort((a, b) => b.horas - a.horas);

      const detailedStatsData = {
        fichajesPorDia: fichajesPorDiaArray || [],
        fichajesPorEmpleado: fichajesPorEmpleadoArray || [],
        fichajesPorCentro: fichajesPorCentroArray || [],
        empleadosUnicos: empleadosUnicos.size || 0
      };

      setDetailedStats(detailedStatsData);

    } catch (error) {
      console.error('Error fetching fichajes stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedCentro]);

  useEffect(() => {
    if (canViewStatistics()) {
      fetchFichajesStats();
    }
  }, [canViewStatistics, fetchFichajesStats]);

  // Si no tiene permisos, redirige a inicio
  if (!canViewStatistics()) {
    return <Navigate to="/inicio" replace />;
  }

  const periods = [
    { id: 'hoy', label: 'Astăzi', icon: '📅' },
    { id: 'semana', label: 'Această săptămână', icon: '📊' },
    { id: 'mes', label: 'Această lună', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Se încarcă statisticile pontajelor...</div>
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
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⏰</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">
                  Statistici Pontaje
                </h1>
                <p className="text-gray-500 text-sm">Analiză detaliată ore lucrate</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <span>🔍</span>
                Filtre
              </Button>
              <Link 
                to="/estadisticas"
                className="flex items-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <span className="mr-2">←</span>
                Înapoi la Statistici
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtre moderne */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Filtre avansate</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Perioada</label>
                <div className="flex gap-2">
                  {periods.map(period => (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriod(period.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        selectedPeriod === period.id
                          ? 'bg-orange-600 text-white shadow-lg'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Centru</label>
                <select
                  value={selectedCentro}
                  onChange={(e) => setSelectedCentro(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {centros.map(centro => (
                    <option key={centro} value={centro}>
                      {centro === 'todos' ? 'Toate centrele' : centro}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Statistici principale */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📊</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.totalFichajes}</div>
                <div className="text-sm text-gray-500">Total pontaje</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {detailedStats?.empleadosUnicos || 0} angajați activi
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⬇️</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.entradas}</div>
                <div className="text-sm text-gray-500">Intrări</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {Math.round((stats.entradas / stats.totalFichajes) * 100)}% din total
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⬆️</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.salidas}</div>
                <div className="text-sm text-gray-500">Ieșiri</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {Math.round((stats.salidas / stats.totalFichajes) * 100)}% din total
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⚠️</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.sinSalida}</div>
                <div className="text-sm text-gray-500">Fără ieșire</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Necesită atenție
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⏰</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.totalHoras}h</div>
                <div className="text-sm text-gray-500">Ore lucrate</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Total în perioada selectată
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📈</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.promedioHoras}h</div>
                <div className="text-sm text-gray-500">Media/pontaj</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Per pontaj
            </div>
          </div>
        </div>

        {/* Statistici detaliate */}
        {detailedStats && detailedStats.fichajesPorEmpleado && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top angajați */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">👥</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Top angajați</h3>
              </div>
              
              <div className="space-y-4">
                {detailedStats.fichajesPorEmpleado?.slice(0, 5).map((empleado, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{empleado.nombre}</div>
                          <div className="text-sm text-gray-500">{empleado.email}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-orange-600">{Math.round(empleado.horas)}h</div>
                        <div className="text-sm text-gray-500">{empleado.total} pontaje</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Statistici per centru */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">🏢</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Statistici per centru</h3>
              </div>
              
              <div className="space-y-4">
                {detailedStats.fichajesPorCentro?.map((centro, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800">{centro.centro}</h4>
                      <span className="text-sm text-gray-500">{centro.total} pontaje</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-green-600">{centro.entradas}</div>
                        <div className="text-gray-500">Intrări</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-red-600">{centro.salidas}</div>
                        <div className="text-gray-500">Ieșiri</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-orange-600">{Math.round(centro.horas)}h</div>
                        <div className="text-gray-500">Ore</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 