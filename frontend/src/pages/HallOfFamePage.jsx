import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useApi } from '../hooks/useApi';
import Back3DButton from '../components/Back3DButton.jsx';
import { Card, LoadingSpinner } from '../components/ui';
import { routes } from '../utils/routes.js';
import { Trophy, Medal, Award, Info, Calendar, RefreshCw } from 'lucide-react';
import Notification from '../components/ui/Notification.jsx';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getBadgeIcon = (position) => {
  if (position === 1) {
    return (
      <div className="relative">
        <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-lg" strokeWidth={2.5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-yellow-900">1</span>
        </div>
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="relative">
        <Medal className="w-8 h-8 text-gray-300 drop-shadow-lg" strokeWidth={2.5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700">2</span>
        </div>
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="relative">
        <Award className="w-8 h-8 text-amber-500 drop-shadow-lg" strokeWidth={2.5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-amber-900">3</span>
        </div>
      </div>
    );
  }
  return <span className="text-lg font-bold text-gray-500">#{position}</span>;
};

const getBadgeColor = (position) => {
  if (position === 1) return 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50';
  if (position === 2) return 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 shadow-lg shadow-gray-400/50';
  if (position === 3) return 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 shadow-lg shadow-amber-500/50';
  if (position <= 10) return 'bg-gradient-to-r from-blue-400 to-blue-600';
  return 'bg-gradient-to-r from-gray-200 to-gray-400';
};

const formatScore = (score) => {
  if (score === null || score === undefined) return '-';
  return parseFloat(score).toFixed(2);
};

const HallOfFamePage = () => {
  const { user: authUser } = useAuth(); // Folosim 'user' ca în DashboardPage
  const { callApi } = useApi();
  const [loading, setLoading] = useState(false);
  
  // Verifică dacă utilizatorul este manager/admin/developer
  const isManager = authUser?.isManager || false;
  const userGrupo = (authUser?.GRUPO || authUser?.grupo || '').trim();
  
  // Verificare robustă pentru permisiuni de calcul
  // Include Manager, Supervisor, Developer, Admin (case-sensitive)
  const canCalculate = isManager || 
    userGrupo === 'Admin' || 
    userGrupo === 'Developer' || 
    userGrupo === 'Manager' || 
    userGrupo === 'Supervisor';
  
  // Debug log (doar în development)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 [HallOfFame] Permission check:', {
        isManager,
        userGrupo,
        canCalculate,
        authUserKeys: authUser ? Object.keys(authUser) : [],
        authUser: authUser ? { 
          GRUPO: authUser.GRUPO, 
          grupo: authUser.grupo, 
          isManager: authUser.isManager,
          CODIGO: authUser.CODIGO 
        } : null,
      });
    }
  }, [isManager, userGrupo, canCalculate, authUser]);
  const [ranking, setRanking] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  // Pentru angajați normali: Top 15, pentru admin: toți (0) sau selectat manual
  const [limit, setLimit] = useState(canCalculate ? 0 : 15);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [notification, setNotification] = useState(null);

  // Initialize month/year și limit - pentru admin folosim luna curentă, pentru angajați luna curentă și Top 15
  useEffect(() => {
    const initializeMonth = () => {
      // Atât admin cât și angajați folosesc luna curentă ca default
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(currentMonth);
      
      // Pentru angajați normali: Top 15
      if (!canCalculate) {
        setLimit(15);
      }
    };
    initializeMonth();
  }, [canCalculate]);

  // Fetch ranking
  const fetchRanking = useCallback(async () => {
    if (!selectedMonth) return;

    setLoading(true);
    try {
      const url = `${routes.getHallOfFame}?mes=${selectedMonth}&limit=${limit}`;
      const result = await callApi(url, { method: 'GET' });
      
      if (result.success && result.data?.ranking) {
        setRanking(result.data.ranking);
      } else if (result.success && result.ranking) {
        // Fallback pentru format direct
        setRanking(result.ranking);
      }
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, limit, callApi]);

  // Fetch breakdown for employee (admin only)
  const fetchBreakdown = async (codigo) => {
    if (!codigo || !selectedMonth) return;

    // Verifică permisiuni - doar manager/admin/developer pot vedea detalii
    if (!canCalculate) {
      setNotification({
        type: 'error',
        title: 'Acceso restringido',
        message: 'Solo los administradores pueden ver los detalles del breakdown',
        duration: 3000
      });
      return;
    }

    setLoading(true);
    try {
      const url = `${routes.getHallOfFameEmployee(codigo)}?mes=${selectedMonth}`;
      const result = await callApi(url, { method: 'GET' });
      
      if (result.success && result.data?.data) {
        setBreakdown(result.data.data);
        setSelectedEmployee(codigo);
      } else if (result.success && result.data) {
        // Fallback pentru format direct
        setBreakdown(result.data);
        setSelectedEmployee(codigo);
      }
    } catch (error) {
      console.error('Error fetching breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate scores (admin only)
  const calculateScores = async () => {
    if (!selectedMonth) return;

    setLoading(true);
    try {
      const url = `${routes.calculateHallOfFame}?mes=${selectedMonth}`;
      const result = await callApi(url, { method: 'POST' });
      
      if (result.success) {
        const processed = result.data?.processed || result.processed || 0;
        setNotification({
          type: 'success',
          title: '¡Cálculo completado!',
          message: `Se han calculado ${processed} scores para ${selectedMonth}`,
          duration: 4000
        });
        fetchRanking();
      } else {
        setNotification({
          type: 'error',
          title: 'Error al calcular',
          message: result.message || 'No se pudieron calcular los scores',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error calculating scores:', error);
      setNotification({
        type: 'error',
        title: 'Error al calcular',
        message: error.message || 'Ocurrió un error al calcular los scores',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate score for a single employee (admin only)
  const calculateEmployeeScore = async (codigo, e) => {
    e.stopPropagation(); // Previne deschiderea modalului
    if (!selectedMonth || !codigo) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Por favor selecciona un mes primero',
        duration: 3000
      });
      return;
    }

    console.log(`🔄 [HallOfFame] Recalculando score para ${codigo}, mes: ${selectedMonth}`);
    setLoading(true);
    try {
      const url = `${routes.calculateHallOfFameEmployee(codigo)}?mes=${selectedMonth}`;
      console.log(`🔄 [HallOfFame] URL: ${url}`);
      const result = await callApi(url, { method: 'POST' });
      
      if (result.success) {
        setNotification({
          type: 'success',
          title: '¡Cálculo completado!',
          message: `Score recalculado para ${codigo}`,
          duration: 3000
        });
        fetchRanking();
      } else {
        setNotification({
          type: 'error',
          title: 'Error al calcular',
          message: result.message || 'No se pudo calcular el score',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error calculating employee score:', error);
      setNotification({
        type: 'error',
        title: 'Error al calcular',
        message: error.message || 'Ocurrió un error al calcular el score',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      fetchRanking();
    }
  }, [selectedMonth, fetchRanking]);

  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (value) {
      setSelectedMonth(value);
    }
  };

  const getMonthName = (mes) => {
    if (!mes) return '';
    const [year, month] = mes.split('-');
    return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Back3DButton />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                🏆 Salón de la Fama
              </h1>
              <p className="text-gray-600 mt-1">Clasificación mensual de empleados</p>
            </div>
          </div>
        </div>

        {/* Bloc de explicație - compact */}
        <Card className="mb-4 p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                🏆 Salón de la Fama
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Este espacio reconoce el compromiso, la constancia y la implicación de nuestros equipos.
                Aquí se reflejan los resultados mensuales basados en distintos indicadores de trabajo y actitud profesional.
                En el futuro, este ranking podrá estar vinculado a reconocimientos, beneficios y recompensas internas.
              </p>
            </div>
          </div>
        </Card>

        {/* Badge "En desarrollo" */}
        <div className="mb-4 flex justify-end">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-300">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
            🔧 Funcionalidad en evolución
          </span>
        </div>

        {/* Filters - doar pentru admin */}
        {canCalculate && (
          <Card className="mb-6 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label htmlFor="hall-of-fame-month" className="text-sm font-medium text-gray-700">Mes:</label>
                <input
                  id="hall-of-fame-month"
                  name="hall-of-fame-month"
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="hall-of-fame-top" className="text-sm font-medium text-gray-700">Top:</label>
                <select
                  id="hall-of-fame-top"
                  name="hall-of-fame-top"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                  <option value={0}>Todos</option>
                </select>
              </div>
              <button
                onClick={calculateScores}
                disabled={loading}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Calcular Scores
              </button>
            </div>
          </Card>
        )}
        
        {/* Pentru angajați normali: afișează luna selectată și buton pentru luna anterioară */}
        {!canCalculate && selectedMonth && (() => {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const isCurrentMonth = selectedMonth === currentMonth;
          
          // Calculează luna anterioară
          const [year, month] = selectedMonth.split('-').map(Number);
          const prevMonthDate = new Date(year, month - 2, 1); // month - 2 pentru că month este 1-based
          const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
          
          return (
            <Card className="mb-6 p-4 bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Mostrando resultados para: <strong>{getMonthName(selectedMonth)}</strong>
                  </span>
                </div>
                {isCurrentMonth && (
                  <button
                    onClick={() => setSelectedMonth(prevMonth)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Ver {getMonthName(prevMonth)}
                  </button>
                )}
                {!isCurrentMonth && (
                  <button
                    onClick={() => setSelectedMonth(currentMonth)}
                    className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Volver a {getMonthName(currentMonth)}
                  </button>
                )}
              </div>
            </Card>
          );
        })()}

        {/* Ranking */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner />
          </div>
        ) : ranking.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-gray-50 to-white">
            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-3">
                ✨ Aún no hay datos para este mes
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Cuando se calculen los resultados, aquí aparecerán los empleados destacados.
              </p>
              <p className="text-gray-500 text-sm">
                Este espacio servirá para reconocer el esfuerzo y la implicación del equipo.
              </p>
              {canCalculate && (
                <div className="mt-6">
                  <button
                    onClick={calculateScores}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Calcular Scores para {getMonthName(selectedMonth)}
                  </button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {/* Podium 3D pentru primii 3 */}
            {ranking.length >= 3 && ranking.slice(0, 3).length === 3 && (
              <div className="mb-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                    🏆 Top 3 del Mes
                  </h2>
                </div>
                <div className="flex items-end justify-center gap-4 mb-6 perspective-1000" style={{ perspective: '1000px' }}>
                  {/* Locul 2 (stânga) */}
                  <div 
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="relative">
                      {/* Podium base */}
                      <div className="bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 rounded-t-lg p-5 shadow-2xl flex flex-col" style={{ 
                        minHeight: '260px',
                        transform: 'rotateX(5deg)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3), inset 0 -10px 20px rgba(0,0,0,0.2)'
                      }}>
                        <div className="text-center text-white flex-1 flex flex-col justify-between">
                          <div>
                            <div className="mb-2">
                              <Medal className="w-10 h-10 mx-auto text-gray-200 drop-shadow-2xl" strokeWidth={2.5} />
                            </div>
                            <div className="text-2xl font-bold mb-1">2</div>
                            <div className="text-sm font-semibold line-clamp-2 px-2">{ranking[1]?.empleadoNombre || ranking[1]?.empleado_codigo}</div>
                            <div className="text-xs opacity-90 mb-2">{ranking[1]?.grupo || '-'}</div>
                          </div>
                          <div className="bg-white/25 backdrop-blur-sm rounded-xl px-4 py-3 border-2 border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mt-auto">
                            <div className="text-xs text-white/90 mb-1 font-semibold">Puntuación Final</div>
                            <div className="text-3xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{formatScore(ranking[1]?.score_final)}</div>
                          </div>
                        </div>
                      </div>
                      {/* Podium side */}
                      <div className="bg-gradient-to-br from-gray-400 to-gray-600 h-8 rounded-b-lg" style={{
                        transform: 'skewX(-10deg) translateX(5px)',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                      }}></div>
                    </div>
                  </div>

                  {/* Locul 1 (centru - cel mai înalt) */}
                  <div 
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-110 hover:-translate-y-3 z-10"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="relative">
                      {/* Podium base - cel mai înalt */}
                      <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-t-lg p-6 shadow-2xl relative overflow-hidden flex flex-col" style={{ 
                        minHeight: '340px',
                        transform: 'rotateX(5deg)',
                        boxShadow: '0 30px 60px rgba(255,215,0,0.4), inset 0 -15px 30px rgba(0,0,0,0.2), 0 0 40px rgba(255,215,0,0.3)'
                      }}>
                        {/* Efect de strălucire */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"></div>
                        <div className="text-center text-white relative z-10 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="mb-3 animate-bounce">
                              <Trophy className="w-14 h-14 mx-auto text-yellow-200 drop-shadow-2xl" strokeWidth={2.5} />
                            </div>
                            <div className="text-3xl font-bold mb-1 drop-shadow-lg">1</div>
                            <div className="text-base font-bold line-clamp-2 px-2">{ranking[0]?.empleadoNombre || ranking[0]?.empleado_codigo}</div>
                            <div className="text-xs opacity-90 mb-2">{ranking[0]?.grupo || '-'}</div>
                          </div>
                          <div className="bg-white/30 backdrop-blur-sm rounded-xl px-5 py-4 border-2 border-white/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)] mt-auto">
                            <div className="text-xs text-white/90 mb-1 font-semibold">Puntuación Final</div>
                            <div className="text-4xl font-extrabold text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.6)]">{formatScore(ranking[0]?.score_final)}</div>
                          </div>
                        </div>
                      </div>
                      {/* Podium side */}
                      <div className="bg-gradient-to-br from-yellow-500 to-yellow-700 h-10 rounded-b-lg" style={{
                        transform: 'skewX(-10deg) translateX(5px)',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.3)'
                      }}></div>
                    </div>
                  </div>

                  {/* Locul 3 (dreapta) */}
                  <div 
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="relative">
                      {/* Podium base - cel mai jos */}
                      <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-t-lg p-4 shadow-2xl flex flex-col" style={{ 
                        minHeight: '220px',
                        transform: 'rotateX(5deg)',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.3), inset 0 -8px 15px rgba(0,0,0,0.2)'
                      }}>
                        <div className="text-center text-white flex-1 flex flex-col justify-between">
                          <div>
                            <div className="mb-2">
                              <Award className="w-9 h-9 mx-auto text-amber-200 drop-shadow-2xl" strokeWidth={2.5} />
                            </div>
                            <div className="text-2xl font-bold mb-1">3</div>
                            <div className="text-sm font-semibold line-clamp-2 px-2">{ranking[2]?.empleadoNombre || ranking[2]?.empleado_codigo}</div>
                            <div className="text-xs opacity-90 mb-2">{ranking[2]?.grupo || '-'}</div>
                          </div>
                          <div className="bg-white/25 backdrop-blur-sm rounded-xl px-3 py-3 border-2 border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mt-auto">
                            <div className="text-xs text-white/90 mb-1 font-semibold">Puntuación Final</div>
                            <div className="text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{formatScore(ranking[2]?.score_final)}</div>
                          </div>
                        </div>
                      </div>
                      {/* Podium side */}
                      <div className="bg-gradient-to-br from-amber-600 to-amber-800 h-6 rounded-b-lg" style={{
                        transform: 'skewX(-10deg) translateX(5px)',
                        boxShadow: '0 8px 15px rgba(0,0,0,0.2)'
                      }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Restul clasamentului (de la poziția 4 în sus) */}
            {ranking.slice(3).map((item, index) => {
              const position = item.ranking || index + 4;
              const breakdownData = item.breakdown_json || {};

              return (
                <Card
                  key={item.empleado_codigo || index}
                  className={`p-4 transition-shadow ${canCalculate ? 'hover:shadow-lg cursor-pointer' : ''}`}
                  onClick={canCalculate ? () => fetchBreakdown(item.empleado_codigo) : undefined}
                >
                  <div className="flex items-center gap-4">
                    {/* Position Badge */}
                    <div className={`${getBadgeColor(position)} text-white rounded-full ${position <= 3 ? 'w-20 h-20 ring-2 ring-white/50' : 'w-16 h-16'} flex items-center justify-center shadow-lg transition-transform hover:scale-105`}>
                      {getBadgeIcon(position)}
                    </div>

                    {/* Employee Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800">
                        {item.empleadoNombre || item.empleado_codigo}
                      </h3>
                      <p className="text-sm text-gray-500">{item.grupo || '-'}</p>
                    </div>

                    {/* Scores */}
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatScore(item.score_final)}
                        </div>
                        <div className="text-xs text-gray-500">Puntuación Final</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          {formatScore(item.score_indeplinire)}
                        </div>
                        <div className="text-xs text-gray-500">Horas (55%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {formatScore(item.score_calitate)}
                        </div>
                        <div className="text-xs text-gray-500">Calidad (20%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-600">
                          {formatScore(item.score_punctualitate)}
                        </div>
                        <div className="text-xs text-gray-500">Puntualidad (15%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-pink-600">
                          {formatScore(item.score_uso_app)}
                        </div>
                        <div className="text-xs text-gray-500">Uso App (10%)</div>
                      </div>
                    </div>

                    {/* Info Icon */}
                    <div className="relative group">
                      <Info className="w-5 h-5 text-gray-400 hover:text-blue-600 cursor-pointer" />
                      <div className="absolute right-0 top-8 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <div className="text-xs space-y-1">
                          <div><strong>Horas fichadas:</strong> {formatScore(breakdownData.horas_pontate)}h</div>
                          <div><strong>Objetivo:</strong> {formatScore(breakdownData.target_ajustat)}h</div>
                          <div><strong>Días neutros:</strong> {breakdownData.dias_neutre || 0}</div>
                          <div><strong>Fichajes incompletos:</strong> {breakdownData.fichajes_incompleto || 0}</div>
                          <div><strong>Acciones:</strong> {formatScore(breakdownData.acciones_totales)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Recalculate Button (admin only) */}
                    {canCalculate && (
                      <button
                        onClick={(e) => calculateEmployeeScore(item.empleado_codigo, e)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Recalcular score para este empleado"
                      >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Recalcular
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Mini-bloc "¿Cómo funciona?" - Mutat sub lista */}
        <Card className="mt-6 p-4 bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                📊 ¿Cómo funciona?
              </h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• El ranking se calcula de forma mensual</li>
                <li>• Se tienen en cuenta distintos factores de desempeño</li>
                <li>• La posición puede variar cada mes</li>
                <li>• El objetivo es reconocer el esfuerzo y la mejora continua</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Breakdown Modal */}
        {breakdown && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Breakdown - {breakdown.empleadoNombre || selectedEmployee}</h2>
                  <button
                    onClick={() => {
                      setBreakdown(null);
                      setSelectedEmployee(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Puntuación Final</div>
                      <div className="text-2xl font-bold text-blue-600">{formatScore(breakdown.score_final)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Ranking</div>
                      <div className="text-2xl font-bold">#{breakdown.ranking || '-'}</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">Detalles KPI:</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Cumplimiento horas (55%):</strong> {formatScore(breakdown.score_indeplinire)}</div>
                      <div><strong>Calidad fichaje (20%):</strong> {formatScore(breakdown.score_calitate)}</div>
                      <div><strong>Puntualidad (15%):</strong> {formatScore(breakdown.score_punctualitate)}</div>
                      <div><strong>Uso de la aplicación (10%):</strong> {formatScore(breakdown.score_uso_app)}</div>
                    </div>
                  </div>
                  {breakdown.breakdown_json && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold mb-2">Desglose JSON:</h3>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(breakdown.breakdown_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Notificări moderne */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          duration={notification.duration}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default HallOfFamePage;

