import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useApi } from '../hooks/useApi';
import { useBreakpoint } from '../hooks/useBreakpoint';
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
  const { isMobile } = useBreakpoint();
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
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 ${isMobile ? 'px-2 py-2' : 'px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${isMobile ? 'mb-2' : 'mb-4 sm:mb-6'} flex items-center justify-between`}>
          <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-4'} min-w-0 flex-1`}>
            <Back3DButton />
            <div className="min-w-0 flex-1">
              <h1 className={`${isMobile ? 'text-base' : 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'} font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent truncate`}>
                🏆 Salón de la Fama
              </h1>
              <p className={`text-gray-600 mt-0.5 ${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'}`}>Clasificación mensual de empleados</p>
            </div>
          </div>
        </div>

        {/* Bloc de explicație - compact */}
        <Card className={`${isMobile ? 'mb-2 p-2' : 'mb-3 sm:mb-4 p-2.5 sm:p-3 md:p-4'} bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200`}>
          <div className={`flex items-start ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}>
            <div className="flex-shrink-0">
              <Trophy className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-amber-600`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`${isMobile ? 'text-xs mb-0.5' : 'text-base sm:text-lg mb-1 sm:mb-1.5'} font-bold text-gray-900 flex items-center gap-2`}>
                🏆 Salón de la Fama
              </h2>
              <p className={`${isMobile ? 'text-[10px] leading-tight' : 'text-xs sm:text-sm leading-relaxed'} text-gray-700`}>
                Este espacio reconoce el compromiso, la constancia y la implicación de nuestros equipos.
                Aquí se reflejan los resultados mensuales basados en distintos indicadores de trabajo y actitud profesional.
                En el futuro, este ranking podrá estar vinculado a reconocimientos, beneficios y recompensas internas.
              </p>
            </div>
          </div>
        </Card>

        {/* Badge "En desarrollo" */}
        <div className={`${isMobile ? 'mb-2' : 'mb-3 sm:mb-4'} flex justify-end`}>
          <span className={`inline-flex items-center ${isMobile ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 sm:gap-2 px-2 sm:px-3 py-1'} bg-gray-100 text-gray-600 ${isMobile ? 'text-[10px]' : 'text-xs'} rounded-full border border-gray-300`}>
            <span className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-gray-400 rounded-full animate-pulse`}></span>
            <span className="hidden sm:inline">🔧 Funcionalidad en evolución</span>
            <span className="sm:hidden">🔧 En evolución</span>
          </span>
        </div>

        {/* Filters - doar pentru admin */}
        {canCalculate && (
          <Card className={`${isMobile ? 'mb-2 p-2' : 'mb-3 sm:mb-4 md:mb-6 p-2.5 sm:p-3 md:p-4'}`}>
            <div className={`flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center ${isMobile ? 'gap-2' : 'gap-3 sm:gap-4'}`}>
              <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'} flex-1 min-w-0`}>
                <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5'} text-gray-500 flex-shrink-0`} />
                <label htmlFor="hall-of-fame-month" className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-medium text-gray-700 whitespace-nowrap`}>Mes:</label>
                <input
                  id="hall-of-fame-month"
                  name="hall-of-fame-month"
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className={`${isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 min-w-0`}
                />
              </div>
              <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'} flex-1 sm:flex-initial`}>
                <label htmlFor="hall-of-fame-top" className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-medium text-gray-700 whitespace-nowrap`}>Top:</label>
                <select
                  id="hall-of-fame-top"
                  name="hall-of-fame-top"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  className={`${isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 sm:flex-initial`}
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
                className={`w-full sm:w-auto sm:ml-auto ${isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-3 sm:px-4 py-2 text-xs sm:text-sm'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <RefreshCw className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
                <span className="hidden sm:inline">Calcular Scores</span>
                <span className="sm:hidden">Calcular</span>
              </button>
            </div>
          </Card>
        )}
        
        {/* Pentru angajați normali: afișează luna selectată și butoane pentru ultimele luni */}
        {!canCalculate && selectedMonth && (() => {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const isCurrentMonth = selectedMonth === currentMonth;
          
          // Calculează ultimele 3 luni anterioare
          const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
          const previousMonths = [];
          
          for (let i = 1; i <= 3; i++) {
            const prevMonthDate = new Date(currentYear, currentMonthNum - 1 - i, 1);
            const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
            previousMonths.push(prevMonth);
          }
          
          const getShortMonthName = (mes) => {
            if (!mes) return '';
            const [year, month] = mes.split('-');
            const monthIndex = parseInt(month, 10) - 1;
            const shortYear = year.toString().slice(-2);
            return `${MONTHS[monthIndex].slice(0, 3)} ${shortYear}`;
          };
          
          return (
            <Card className={`${isMobile ? 'mb-2 p-2' : 'mb-3 sm:mb-4 md:mb-6 p-2.5 sm:p-3 md:p-4'} bg-blue-50 border border-blue-200`}>
              <div className={`flex flex-col ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}>
                <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                  <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5'} text-blue-600 flex-shrink-0`} />
                  <span className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-medium text-gray-700`}>
                    <span className="hidden sm:inline">Mostrando resultados para: </span>
                    <strong className="break-words">{getMonthName(selectedMonth)}</strong>
                  </span>
                </div>
                <div className={`flex flex-nowrap items-center ${isMobile ? 'gap-1 overflow-x-auto' : 'gap-2'} ${isMobile ? 'pb-1' : ''}`}>
                  {isCurrentMonth ? (
                    <>
                      {previousMonths.map((month) => (
                        <button
                          key={month}
                          onClick={() => setSelectedMonth(month)}
                          className={`${isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center ${isMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}
                        >
                          <Calendar className={isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
                          <span className="hidden sm:inline">{getMonthName(month)}</span>
                          <span className="sm:hidden">{getShortMonthName(month)}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedMonth(currentMonth)}
                        className={`${isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center ${isMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}
                      >
                        <Calendar className={isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
                        <span className="hidden sm:inline">Volver a {getMonthName(currentMonth)}</span>
                        <span className="sm:hidden">Volver</span>
                      </button>
                      {previousMonths.map((month) => (
                        <button
                          key={month}
                          onClick={() => setSelectedMonth(month)}
                          className={`${isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} text-white rounded-lg transition-colors flex items-center ${isMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'} ${
                            selectedMonth === month 
                              ? 'bg-blue-800' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <Calendar className={isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
                          <span className="hidden sm:inline">{getMonthName(month)}</span>
                          <span className="sm:hidden">{getShortMonthName(month)}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Ranking */}
        {loading ? (
          <div className={`flex justify-center items-center ${isMobile ? 'py-12' : 'py-20'}`}>
            <LoadingSpinner />
          </div>
        ) : ranking.length === 0 ? (
          <Card className={`${isMobile ? 'p-4' : 'p-6 sm:p-8 md:p-12'} text-center bg-gradient-to-br from-gray-50 to-white`}>
            <div className="max-w-md mx-auto">
              <div className={isMobile ? 'mb-2' : 'mb-3 sm:mb-4'}>
                <Trophy className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12 sm:w-16 sm:h-16'} text-gray-300 mx-auto`} />
              </div>
              <h3 className={`${isMobile ? 'text-sm mb-1.5' : 'text-lg sm:text-xl mb-2 sm:mb-3'} font-semibold text-gray-700 px-2`}>
                ✨ Aún no hay datos para este mes
              </h3>
              <p className={`${isMobile ? 'text-xs mb-2' : 'text-sm sm:text-base mb-3 sm:mb-4'} text-gray-600 leading-relaxed px-2`}>
                Cuando se calculen los resultados, aquí aparecerán los empleados destacados.
              </p>
              <p className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} text-gray-500 px-2`}>
                Este espacio servirá para reconocer el esfuerzo y la implicación del equipo.
              </p>
              {canCalculate && (
                <div className={isMobile ? 'mt-3' : 'mt-4 sm:mt-6'}>
                  <button
                    onClick={calculateScores}
                    disabled={loading}
                    className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <RefreshCw className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Calcular Scores para {getMonthName(selectedMonth)}</span>
                    <span className="sm:hidden">Calcular Scores</span>
                  </button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className={`grid ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3 md:gap-4'}`}>
            {/* Podium 3D pentru primii 3 */}
            {ranking.length >= 3 && ranking.slice(0, 3).length === 3 && (
              <div className="mb-4 sm:mb-6 md:mb-8">
                <div className={`text-center ${isMobile ? 'mb-2' : 'mb-3 sm:mb-4 md:mb-6'}`}>
                  <h2 className={`${isMobile ? 'text-base' : 'text-xl sm:text-2xl'} font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent`}>
                    🏆 Top 3 del Mes
                  </h2>
                </div>
                {/* Desktop: horizontal, Mobile: vertical */}
                <div className="hidden lg:flex items-end justify-center gap-4 mb-6 perspective-1000" style={{ perspective: '1000px' }}>
                  {/* Locul 2 (stânga) */}
                  <div 
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-105 hover:-translate-y-2 cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={canCalculate && ranking[1]?.empleado_codigo ? () => fetchBreakdown(ranking[1].empleado_codigo) : undefined}
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
                            <div className="text-3xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] mb-2">{formatScore(ranking[1]?.score_final)}</div>
                            <div className="text-[10px] space-y-0.5 text-white/90 border-t border-white/30 pt-2">
                              <div>Horas (30%): {formatScore(ranking[1]?.score_indeplinire)}</div>
                              <div>Calidad (20%): {formatScore(ranking[1]?.score_calitate)}</div>
                              <div>Puntualidad (10%): {formatScore(ranking[1]?.score_punctualitate)}</div>
                              <div>Uso App (10%): {formatScore(ranking[1]?.score_uso_app)}</div>
                              <div>Responsabilidad Digital (30%): {formatScore(ranking[1]?.score_responsabilidad_digital || (ranking[1]?.breakdown_json?.score_responsabilidad_digital))}</div>
                            </div>
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
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-110 hover:-translate-y-3 z-10 cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={canCalculate && ranking[0]?.empleado_codigo ? () => fetchBreakdown(ranking[0].empleado_codigo) : undefined}
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
                            <div className="text-4xl font-extrabold text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.6)] mb-2">{formatScore(ranking[0]?.score_final)}</div>
                            <div className="text-[10px] space-y-0.5 text-white/90 border-t border-white/30 pt-2">
                              <div>Horas (30%): {formatScore(ranking[0]?.score_indeplinire)}</div>
                              <div>Calidad (20%): {formatScore(ranking[0]?.score_calitate)}</div>
                              <div>Puntualidad (10%): {formatScore(ranking[0]?.score_punctualitate)}</div>
                              <div>Uso App (10%): {formatScore(ranking[0]?.score_uso_app)}</div>
                              <div>Responsabilidad Digital (30%): {formatScore(ranking[0]?.score_responsabilidad_digital || (ranking[0]?.breakdown_json?.score_responsabilidad_digital))}</div>
                            </div>
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
                    className="flex-1 max-w-xs transform transition-all duration-500 hover:scale-105 hover:-translate-y-2 cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={canCalculate && ranking[2]?.empleado_codigo ? () => fetchBreakdown(ranking[2].empleado_codigo) : undefined}
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
                            <div className="text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] mb-2">{formatScore(ranking[2]?.score_final)}</div>
                            <div className="text-[10px] space-y-0.5 text-white/90 border-t border-white/30 pt-2">
                              <div>Horas (30%): {formatScore(ranking[2]?.score_indeplinire)}</div>
                              <div>Calidad (20%): {formatScore(ranking[2]?.score_calitate)}</div>
                              <div>Puntualidad (10%): {formatScore(ranking[2]?.score_punctualitate)}</div>
                              <div>Uso App (10%): {formatScore(ranking[2]?.score_uso_app)}</div>
                              <div>Responsabilidad Digital (30%): {formatScore(ranking[2]?.score_responsabilidad_digital || (ranking[2]?.breakdown_json?.score_responsabilidad_digital))}</div>
                            </div>
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
                
                {/* Mobile: Versiune verticală compactă pentru Top 3 */}
                <div className="lg:hidden space-y-1.5 mb-2 sm:mb-3 md:mb-4">
                  {/* Locul 1 */}
                  <div 
                    className={`bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-lg ${isMobile ? 'p-2' : 'p-2.5 sm:p-3'} shadow-lg border-2 border-yellow-300 w-full max-w-full overflow-hidden cursor-pointer hover:shadow-xl transition-shadow`}
                    onClick={canCalculate && ranking[0]?.empleado_codigo ? () => fetchBreakdown(ranking[0].empleado_codigo) : undefined}
                  >
                    <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'} text-white w-full max-w-full`}>
                      <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                        <Trophy className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-yellow-200`} />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 mb-0.5`}>#1</div>
                        <div className={`font-bold ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm md:text-base'} truncate leading-tight w-full`}>{ranking[0]?.empleadoNombre || ranking[0]?.empleado_codigo}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-75 truncate w-full`}>{ranking[0]?.grupo || '-'}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`${isMobile ? 'text-base' : 'text-xl sm:text-2xl'} font-extrabold whitespace-nowrap`}>{formatScore(ranking[0]?.score_final)}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 whitespace-nowrap`}>Puntuación</div>
                      </div>
                    </div>
                    <div className={`mt-2 pt-2 border-t border-white/30 ${isMobile ? 'text-[9px]' : 'text-[10px]'} space-y-0.5 text-white/90`}>
                      <div>Horas (30%): {formatScore(ranking[0]?.score_indeplinire)}</div>
                      <div>Calidad (20%): {formatScore(ranking[0]?.score_calitate)}</div>
                      <div>Puntualidad (10%): {formatScore(ranking[0]?.score_punctualitate)}</div>
                      <div>Uso App (10%): {formatScore(ranking[0]?.score_uso_app)}</div>
                      <div>Responsabilidad Digital (30%): {formatScore(ranking[0]?.score_responsabilidad_digital || (ranking[0]?.breakdown_json?.score_responsabilidad_digital))}</div>
                    </div>
                  </div>
                  
                  {/* Locul 2 */}
                  <div 
                    className={`bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 rounded-lg ${isMobile ? 'p-2' : 'p-2.5 sm:p-3'} shadow-lg border-2 border-gray-400 w-full max-w-full overflow-hidden cursor-pointer hover:shadow-xl transition-shadow`}
                    onClick={canCalculate && ranking[1]?.empleado_codigo ? () => fetchBreakdown(ranking[1].empleado_codigo) : undefined}
                  >
                    <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'} text-white w-full max-w-full`}>
                      <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                        <Medal className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-gray-200`} />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 mb-0.5`}>#2</div>
                        <div className={`font-bold ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm md:text-base'} truncate leading-tight w-full`}>{ranking[1]?.empleadoNombre || ranking[1]?.empleado_codigo}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-75 truncate w-full`}>{ranking[1]?.grupo || '-'}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`${isMobile ? 'text-base' : 'text-xl sm:text-2xl'} font-extrabold whitespace-nowrap`}>{formatScore(ranking[1]?.score_final)}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 whitespace-nowrap`}>Puntuación</div>
                      </div>
                    </div>
                    <div className={`mt-2 pt-2 border-t border-white/30 ${isMobile ? 'text-[9px]' : 'text-[10px]'} space-y-0.5 text-white/90`}>
                      <div>Horas (30%): {formatScore(ranking[1]?.score_indeplinire)}</div>
                      <div>Calidad (20%): {formatScore(ranking[1]?.score_calitate)}</div>
                      <div>Puntualidad (10%): {formatScore(ranking[1]?.score_punctualitate)}</div>
                      <div>Uso App (10%): {formatScore(ranking[1]?.score_uso_app)}</div>
                      <div>Responsabilidad Digital (30%): {formatScore(ranking[1]?.score_responsabilidad_digital || (ranking[1]?.breakdown_json?.score_responsabilidad_digital))}</div>
                    </div>
                  </div>
                  
                  {/* Locul 3 */}
                  <div 
                    className={`bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-lg ${isMobile ? 'p-2' : 'p-2.5 sm:p-3'} shadow-lg border-2 border-amber-500 w-full max-w-full overflow-hidden cursor-pointer hover:shadow-xl transition-shadow`}
                    onClick={canCalculate && ranking[2]?.empleado_codigo ? () => fetchBreakdown(ranking[2].empleado_codigo) : undefined}
                  >
                    <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'} text-white w-full max-w-full`}>
                      <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                        <Award className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-amber-200`} />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 mb-0.5`}>#3</div>
                        <div className={`font-bold ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm md:text-base'} truncate leading-tight w-full`}>{ranking[2]?.empleadoNombre || ranking[2]?.empleado_codigo}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-75 truncate w-full`}>{ranking[2]?.grupo || '-'}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`${isMobile ? 'text-base' : 'text-xl sm:text-2xl'} font-extrabold whitespace-nowrap`}>{formatScore(ranking[2]?.score_final)}</div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-90 whitespace-nowrap`}>Puntuación</div>
                      </div>
                    </div>
                    <div className={`mt-2 pt-2 border-t border-white/30 ${isMobile ? 'text-[9px]' : 'text-[10px]'} space-y-0.5 text-white/90`}>
                      <div>Horas (30%): {formatScore(ranking[2]?.score_indeplinire)}</div>
                      <div>Calidad (20%): {formatScore(ranking[2]?.score_calitate)}</div>
                      <div>Puntualidad (10%): {formatScore(ranking[2]?.score_punctualitate)}</div>
                      <div>Uso App (10%): {formatScore(ranking[2]?.score_uso_app)}</div>
                      <div>Responsabilidad Digital (30%): {formatScore(ranking[2]?.score_responsabilidad_digital || (ranking[2]?.breakdown_json?.score_responsabilidad_digital))}</div>
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
                  padding=""
                  className={`${isMobile ? 'p-2' : 'p-2.5 sm:p-3 md:p-4'} transition-shadow overflow-hidden ${canCalculate ? 'hover:shadow-lg cursor-pointer' : ''}`}
                  onClick={canCalculate ? () => fetchBreakdown(item.empleado_codigo) : undefined}
                >
                  {/* Desktop Layout */}
                  <div className="hidden lg:flex items-center gap-4">
                    {/* Position Badge */}
                    <div className={`${getBadgeColor(position)} text-white rounded-full ${position <= 3 ? 'w-20 h-20 ring-2 ring-white/50' : 'w-16 h-16'} flex items-center justify-center shadow-lg transition-transform hover:scale-105 flex-shrink-0`}>
                      {getBadgeIcon(position)}
                    </div>

                    {/* Employee Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-800 truncate">
                        {item.empleadoNombre || item.empleado_codigo}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{item.grupo || '-'}</p>
                    </div>

                    {/* Scores */}
                    <div className="flex gap-4 xl:gap-6 flex-shrink-0">
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
                        <div className="text-xs text-gray-500">Horas (30%)</div>
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
                        <div className="text-xs text-gray-500">Puntualidad (10%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-pink-600">
                          {formatScore(item.score_uso_app)}
                        </div>
                        <div className="text-xs text-gray-500">Uso App (10%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-teal-600">
                          {formatScore(item.score_responsabilidad_digital || breakdownData?.score_responsabilidad_digital)}
                        </div>
                        <div className="text-xs text-gray-500">Responsabilidad Digital (30%)</div>
                      </div>
                    </div>

                    {/* Info Icon */}
                    <div className="relative group flex-shrink-0">
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
                        className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title="Recalcular score para este empleado"
                      >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Recalcular
                      </button>
                    )}
                  </div>

                  {/* Mobile Layout */}
                  <div className="lg:hidden space-y-1.5 w-full max-w-full">
                    {/* Header cu badge și nume */}
                    <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'} w-full max-w-full`}>
                      <div className={`${getBadgeColor(position)} text-white rounded-full ${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        {position <= 10 ? (
                          isMobile ? (
                            <span className="text-[10px] font-bold">#{position}</span>
                          ) : (
                            getBadgeIcon(position)
                          )
                        ) : (
                          <span className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-bold`}>#{position}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className={`${isMobile ? 'text-[11px]' : 'text-sm sm:text-base'} font-bold text-gray-800 truncate leading-tight w-full`}>
                          {item.empleadoNombre || item.empleado_codigo}
                        </h3>
                        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 truncate leading-tight w-full`}>{item.grupo || '-'}</p>
                      </div>
                      {canCalculate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            calculateEmployeeScore(item.empleado_codigo, e);
                          }}
                          disabled={loading}
                          className={`${isMobile ? 'px-1 py-0.5' : 'px-1.5 py-1'} bg-yellow-500 text-white ${isMobile ? 'text-[10px]' : 'text-xs'} rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0`}
                          title="Recalcular"
                        >
                          <RefreshCw className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${loading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Score Final - destacat */}
                    <div className={`bg-blue-50 rounded-lg ${isMobile ? 'p-1.5' : 'p-2'} border border-blue-200`}>
                      <div className="text-center">
                        <div className={`${isMobile ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-blue-600`}>
                          {formatScore(item.score_final)}
                        </div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600 font-medium`}>Puntuación Final</div>
                      </div>
                    </div>

                    {/* Restul scorurilor în grid 2 coloane - mai compact */}
                    <div className={`grid grid-cols-2 ${isMobile ? 'gap-1' : 'gap-1.5'}`}>
                      <div className={`bg-green-50 rounded-lg ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} border border-green-200 overflow-hidden`}>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-semibold text-green-700 text-center leading-tight break-words`}>
                          {formatScore(item.score_indeplinire)}
                        </div>
                        <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-600 text-center leading-tight mt-0.5 break-words`}>Horas (30%)</div>
                      </div>
                      <div className={`bg-purple-50 rounded-lg ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} border border-purple-200 overflow-hidden`}>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-semibold text-purple-700 text-center leading-tight break-words`}>
                          {formatScore(item.score_calitate)}
                        </div>
                        <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-600 text-center leading-tight mt-0.5 break-words`}>Calidad (20%)</div>
                      </div>
                      <div className={`bg-orange-50 rounded-lg ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} border border-orange-200 overflow-hidden`}>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-semibold text-orange-700 text-center leading-tight break-words`}>
                          {formatScore(item.score_punctualitate)}
                        </div>
                        <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-600 text-center leading-tight mt-0.5 break-words`}>Puntualidad (10%)</div>
                      </div>
                      <div className={`bg-pink-50 rounded-lg ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} border border-pink-200 overflow-hidden`}>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-semibold text-pink-700 text-center leading-tight break-words`}>
                          {formatScore(item.score_uso_app)}
                        </div>
                        <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-600 text-center leading-tight mt-0.5 break-words`}>Uso App (10%)</div>
                      </div>
                      <div className={`bg-teal-50 rounded-lg ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} border border-teal-200 overflow-hidden`}>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} font-semibold text-teal-700 text-center leading-tight break-words`}>
                          {formatScore(item.score_responsabilidad_digital || breakdownData?.score_responsabilidad_digital)}
                        </div>
                        <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-600 text-center leading-tight mt-0.5 break-words`}>Responsabilidad Digital (30%)</div>
                      </div>
                    </div>

                    {/* Info breakdown - expandable pe mobile */}
                    {canCalculate && breakdownData && Object.keys(breakdownData).length > 0 && (
                      <details className={`bg-gray-50 rounded-lg ${isMobile ? 'p-1.5' : 'p-2'} border border-gray-200`}>
                        <summary className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600 font-medium cursor-pointer flex items-center gap-1.5`}>
                          <Info className={isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                          Ver detalles
                        </summary>
                        <div className={`mt-1.5 space-y-0.5 ${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600`}>
                          <div><strong>Horas fichadas:</strong> {formatScore(breakdownData.horas_pontate)}h</div>
                          <div><strong>Objetivo:</strong> {formatScore(breakdownData.target_ajustat)}h</div>
                          <div><strong>Días neutros:</strong> {breakdownData.dias_neutre || 0}</div>
                          <div><strong>Fichajes incompletos:</strong> {breakdownData.fichajes_incompleto || 0}</div>
                          <div><strong>Acciones:</strong> {formatScore(breakdownData.acciones_totales)}</div>
                        </div>
                      </details>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Mini-bloc "¿Cómo funciona?" - Mutat sub lista */}
        <Card className={`${isMobile ? 'mt-2 p-2 mb-2' : 'mt-3 sm:mt-4 md:mt-6 p-2.5 sm:p-3 md:p-4 mb-4 sm:mb-6'} bg-blue-50 border border-blue-200`}>
          <div className={`flex items-start ${isMobile ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}>
            <Info className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5'} text-blue-600 flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <h3 className={`${isMobile ? 'text-xs mb-1' : 'text-sm sm:text-base mb-1.5 sm:mb-2'} font-semibold text-gray-900 flex items-center gap-2`}>
                📊 ¿Cómo funciona?
              </h3>
              <ul className={`${isMobile ? 'text-[10px] space-y-0.5' : 'text-xs sm:text-sm space-y-1'} text-gray-700`}>
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
          <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isMobile ? 'p-2' : 'p-2 sm:p-4'}`}>
            <Card className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto ${isMobile ? 'max-w-full' : ''}`}>
              <div className={isMobile ? 'p-3' : 'p-4 sm:p-6'}>
                <div className={`flex justify-between items-center ${isMobile ? 'mb-3 gap-1.5' : 'mb-4 gap-2'}`}>
                  <h2 className={`${isMobile ? 'text-sm' : 'text-lg sm:text-xl md:text-2xl'} font-bold truncate min-w-0 flex-1`}>
                    Breakdown - {breakdown.empleadoNombre || selectedEmployee}
                  </h2>
                  <button
                    onClick={() => {
                      setBreakdown(null);
                      setSelectedEmployee(null);
                    }}
                    className={`text-gray-500 hover:text-gray-700 flex-shrink-0 ${isMobile ? 'text-lg' : 'text-xl sm:text-2xl'}`}
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>
                <div className={isMobile ? 'space-y-2' : 'space-y-3 sm:space-y-4'}>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${isMobile ? 'gap-2' : 'gap-3 sm:gap-4'}`}>
                    <div>
                      <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} text-gray-500`}>Puntuación Final</div>
                      <div className={`${isMobile ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-blue-600`}>{formatScore(breakdown.score_final)}</div>
                    </div>
                    <div>
                      <div className={`${isMobile ? 'text-[10px]' : 'text-xs sm:text-sm'} text-gray-500`}>Ranking</div>
                      <div className={`${isMobile ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold`}>#{breakdown.ranking || '-'}</div>
                    </div>
                  </div>
                  <div className={`border-t ${isMobile ? 'pt-2' : 'pt-3 sm:pt-4'}`}>
                    <h3 className={`${isMobile ? 'text-xs mb-1.5' : 'text-sm sm:text-base mb-2'} font-bold`}>Detalles KPI:</h3>
                    <div className={`${isMobile ? 'space-y-1 text-[10px]' : 'space-y-2 text-xs sm:text-sm'}`}>
                      <div><strong>Cumplimiento horas (30%):</strong> {formatScore(breakdown.score_indeplinire)}</div>
                      <div><strong>Calidad fichaje (20%):</strong> {formatScore(breakdown.score_calitate)}</div>
                      <div><strong>Puntualidad (10%):</strong> {formatScore(breakdown.score_punctualitate)}</div>
                      <div><strong>Uso de la aplicación (10%):</strong> {formatScore(breakdown.score_uso_app)}</div>
                      <div><strong>Responsabilidad digital (30%):</strong> {formatScore(breakdown.score_responsabilidad_digital)}</div>
                    </div>
                  </div>
                  {breakdown.breakdown_json && (
                    <div className={`border-t ${isMobile ? 'pt-2' : 'pt-3 sm:pt-4'}`}>
                      <h3 className={`${isMobile ? 'text-xs mb-1.5' : 'text-sm sm:text-base mb-2'} font-bold`}>Desglose JSON:</h3>
                      <pre className={`bg-gray-100 ${isMobile ? 'p-1.5' : 'p-2 sm:p-3'} rounded ${isMobile ? 'text-[9px] max-h-32' : 'text-xs max-h-40 sm:max-h-60'} overflow-auto`}>
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

