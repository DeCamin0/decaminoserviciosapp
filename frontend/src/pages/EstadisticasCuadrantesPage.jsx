import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button } from '../components/ui';
import { Link, Navigate } from 'react-router-dom';
import { routes } from '../utils/routes';

export default function EstadisticasCuadrantesPage() {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    mesesGenerados: 0,
    enGeneracion: 0,
    sinGenerar: 0,
    total: 12
  });
  const [detailedStats, setDetailedStats] = useState(null);
  const [cuadrantesData, setCuadrantesData] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  // Verifică permisiunile pentru statistici
  const hasStatisticsPermission = useCallback(() => {
    const grupo = authUser?.GRUPO;
    const isAdmin = authUser?.isAdmin || grupo === 'Admin';
    const isDeveloper = authUser?.isDeveloper || grupo === 'Developer';
    const isSupervisor = grupo === 'Supervisor';
    const isManager = grupo === 'Manager';

    return isAdmin || isDeveloper || isSupervisor || isManager;
  }, [authUser]);

  const fetchCuadrantesStats = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ MIGRAT: Fetch cuadrantes din backend în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getCuadrantes, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      const cuadrantesArray = Array.isArray(data) ? data : [data];
      
      // Group by month
      const cuadrantesPorMes = {};
      const meses = [
        'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
        'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
      ];
      
      cuadrantesArray.forEach(cuadrante => {
        const lunaProps = [
          cuadrante.LUNA, cuadrante.luna, cuadrante.MES, cuadrante.mes,
          cuadrante['LUNA'], cuadrante['MES'], cuadrante['PERIODO']
        ];
        
        const luna = lunaProps.find(prop => prop);
        if (!luna) return;
        
        let lunaFormateada = luna.toString();
        
        if (typeof luna === 'number') {
          const date = new Date(Math.round((luna - 25569) * 86400 * 1000));
          lunaFormateada = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        }
        
        const anSelectat = selectedYear.toString();
        if (!lunaFormateada.includes(anSelectat)) return;
        
        const [, lunaNum] = lunaFormateada.split('-');
        const mesIndex = parseInt(lunaNum) - 1;
        const nombreMes = meses[mesIndex];
        
        if (!nombreMes) return;
        
        if (!cuadrantesPorMes[nombreMes]) {
          cuadrantesPorMes[nombreMes] = {
            mes: nombreMes,
            estado: 'Generat',
            empleados: 0,
            horasTotales: 0,
            fechaGeneracion: new Date(lunaFormateada),
            cuadrantes: []
          };
        }
        
        cuadrantesPorMes[nombreMes].empleados++;
        cuadrantesPorMes[nombreMes].cuadrantes.push(cuadrante);
        
        // Calculate hours
        let ore = 0;
        for (let zi = 1; zi <= 31; zi++) {
          const ziVal = cuadrante[`ZI_${zi}`] || cuadrante[`zi_${zi}`];
          if (!ziVal) continue;
          if (typeof ziVal === 'string' && ziVal.startsWith('T1')) {
            const match = ziVal.match(/T1 (\d{2}):(\d{2})-(\d{2}):(\d{2})/);
            if (match) {
              const start = parseInt(match[1]) * 60 + parseInt(match[2]);
              const end = parseInt(match[3]) * 60 + parseInt(match[4]);
              let diff = end - start;
              if (diff < 0) diff += 24 * 60;
              ore += diff / 60;
            } else {
              ore += 8;
            }
          }
        }
        cuadrantesPorMes[nombreMes].horasTotales += ore;
      });
      
      const cuadrantesSimulados = meses.map(mes => {
        const datosMes = cuadrantesPorMes[mes];
        if (datosMes) {
          return {
            mes: datosMes.mes,
            estado: datosMes.estado,
            empleados: datosMes.empleados,
            horasTotales: datosMes.horasTotales,
            fechaGeneracion: datosMes.fechaGeneracion
          };
        } else {
          return {
            mes,
            estado: 'Fără generare',
            empleados: 0,
            horasTotales: 0,
            fechaGeneracion: null
          };
        }
      });
      
      setCuadrantesData(cuadrantesSimulados);

      // Calculate stats
      const mesesGenerados = cuadrantesSimulados.filter(m => m.estado === 'Generat').length;
      const enGeneracion = cuadrantesSimulados.filter(m => m.estado === 'En generación').length;
      const sinGenerar = cuadrantesSimulados.filter(m => m.estado === 'Fără generare').length;

      setStats({
        mesesGenerados,
        enGeneracion,
        sinGenerar,
        total: 12
      });

      const cuadrantesGenerados = cuadrantesSimulados.filter(c => c.estado === 'Generat');
      const cuadrantesEnGeneracion = cuadrantesSimulados.filter(c => c.estado === 'În generare');
      const cuadrantesSinGenerar = cuadrantesSimulados.filter(c => c.estado === 'Fără generare');

      const empleadosUnicos = new Set();
      Object.values(cuadrantesPorMes).forEach(mesData => {
        if (mesData.cuadrantes && mesData.cuadrantes.length > 0) {
          mesData.cuadrantes.forEach(cuadrante => {
            const email = cuadrante.EMAIL || cuadrante.email || cuadrante['CORREO ELECTRONICO'];
            if (email) {
              empleadosUnicos.add(email);
            }
          });
        }
      });
      
      const totalEmpleados = empleadosUnicos.size;
      const totalHoras = cuadrantesSimulados.reduce((sum, c) => sum + c.horasTotales, 0);
      const promedioEmpleados = totalEmpleados / 12;

      setDetailedStats({
        cuadrantesGenerados: cuadrantesGenerados || [],
        cuadrantesEnGeneracion: cuadrantesEnGeneracion || [],
        cuadrantesSinGenerar: cuadrantesSinGenerar || [],
        totalEmpleados: totalEmpleados || 0,
        totalHoras: totalHoras || 0,
        promedioEmpleados: promedioEmpleados || 0,
        mesesGenerados: mesesGenerados || 0,
        enGeneracion: enGeneracion || 0,
        sinGenerar: sinGenerar || 0,
        cuadrantesPorMes: cuadrantesPorMes || {}
      });

    } catch (error) {
      console.error('Error fetching cuadrantes stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (hasStatisticsPermission()) {
      fetchCuadrantesStats();
    }
  }, [fetchCuadrantesStats, hasStatisticsPermission]);

  // Si no tiene permisos, redirige a inicio
  if (!hasStatisticsPermission()) {
          return <Navigate to="/inicio" replace />;
  }

  const years = [2023, 2024, 2025];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Se încarcă statisticile cuadrantelor...</div>
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
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                  Statistici Cuadrante
                </h1>
                <p className="text-gray-500 text-sm">Analiză detaliată programe de lucru</p>
              </div>
            </div>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selector de an */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Anul {selectedYear}</h2>
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <span>{showDetails ? '📊' : '📈'}</span>
              {showDetails ? 'Vizualizare simplă' : 'Detalii avansate'}
            </Button>
          </div>
          
          <div className="flex gap-3">
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
                  selectedYear === year
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Statistici principale */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">✅</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.mesesGenerados}</div>
                <div className="text-sm text-gray-500">Luni generate</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {Math.round((stats.mesesGenerados / stats.total) * 100)}% completat
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⏳</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.enGeneracion}</div>
                <div className="text-sm text-gray-500">În generare</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Procesare activă
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⚠️</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.sinGenerar}</div>
                <div className="text-sm text-gray-500">Fără generare</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Necesită atenție
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📅</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-sm text-gray-500">Total luni</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Anul {selectedYear}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Progres general</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${(stats.mesesGenerados / stats.total) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{stats.mesesGenerados} luni generate</span>
            <span>{stats.total - stats.mesesGenerados} rămase</span>
          </div>
        </div>

        {/* Detalii lunare */}
        {showDetails && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Detalii lunare</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cuadrantesData.map((mes, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                    mes.estado === 'Generat' 
                      ? 'border-green-200 bg-green-50' 
                      : mes.estado === 'În generare'
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-800">{mes.mes}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      mes.estado === 'Generat'
                        ? 'bg-green-100 text-green-800'
                        : mes.estado === 'În generare'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {mes.estado}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Angajați: {mes.empleados}</div>
                    <div>Ore totale: {Math.round(mes.horasTotales)}h</div>
                    {mes.fechaGeneracion && (
                      <div>Generat: {mes.fechaGeneracion.toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistici detaliate */}
        {detailedStats && detailedStats.cuadrantesGenerados && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">👥</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Statistici angajați</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total angajați</span>
                  <span className="text-2xl font-bold text-blue-600">{detailedStats.totalEmpleados || 0}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <span className="font-medium text-gray-700">Media angajați/lună</span>
                  <span className="text-2xl font-bold text-green-600">{Math.round(detailedStats.promedioEmpleados || 0)}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total ore programate</span>
                  <span className="text-2xl font-bold text-orange-600">{Math.round(detailedStats.totalHoras || 0)}h</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Statistici generare</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <span className="font-medium text-gray-700">Cuadrante generate</span>
                  <span className="text-2xl font-bold text-green-600">{detailedStats.cuadrantesGenerados?.length || 0}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <span className="font-medium text-gray-700">În generare</span>
                  <span className="text-2xl font-bold text-orange-600">{detailedStats.cuadrantesEnGeneracion?.length || 0}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <span className="font-medium text-gray-700">Fără generare</span>
                  <span className="text-2xl font-bold text-red-600">{detailedStats.cuadrantesSinGenerar?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 