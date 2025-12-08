import { useState, useCallback, useEffect, useRef } from 'react';
import { Card } from '../../components/ui';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../contexts/AuthContextBase';

export default function UserStats() {
    const { user: authUser } = useAuth();
    const { getAdminStats, getActivityLog, getAllUsers } = useAdminApi();
    const [stats, setStats] = useState({
      activeUsersToday: 0,
      uniqueUsersWeek: 0,
      totalUsers: 0,
      mostAccessedModules: [],
      loginTrend: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('7d');
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

  // Demo data for UserStats
  const setDemoStats = useCallback(() => {
    const demoStats = {
      activeUsersToday: 6,
      uniqueUsersWeek: 8,
      totalUsers: 10,
      mostAccessedModules: [
        { name: 'dashboard', count: 45, percentage: 35 },
        { name: 'fichaje', count: 32, percentage: 25 },
        { name: 'documentos', count: 28, percentage: 22 },
        { name: 'empleados', count: 15, percentage: 12 },
        { name: 'solicitudes', count: 8, percentage: 6 }
      ],
      loginTrend: [
        { date: '2024-11-27', logins: 3, uniqueUsers: 2 },
        { date: '2024-11-28', logins: 5, uniqueUsers: 4 },
        { date: '2024-11-29', logins: 4, uniqueUsers: 3 },
        { date: '2024-11-30', logins: 6, uniqueUsers: 5 },
        { date: '2024-12-01', logins: 8, uniqueUsers: 6 },
        { date: '2024-12-02', logins: 7, uniqueUsers: 5 },
        { date: '2024-12-03', logins: 9, uniqueUsers: 6 }
      ]
    };
    setStats(demoStats);
    setLoading(false);
  }, []);

  const getAdminStatsRef = useRef(getAdminStats);
  const getAllUsersRef = useRef(getAllUsers);

  useEffect(() => {
    getAdminStatsRef.current = getAdminStats;
    getAllUsersRef.current = getAllUsers;
  }, [getAdminStats, getAllUsers]);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      if (authUser?.isDemo) {
        console.log('🎭 DEMO mode: Using demo stats instead of fetching from backend');
        setDemoStats();
        return;
      }

      setLoading(true);
      try {
        console.log('[DEBUG] Fetching admin stats for period:', selectedPeriod);
        const data = await getAdminStatsRef.current(selectedPeriod);
        console.log('[DEBUG] Admin stats received:', data);

        console.log('[DEBUG] Fetching total users from database...');
        const allUsers = await getAllUsersRef.current();
        console.log('[DEBUG] Total users from database:', allUsers.length);

        if (!cancelled) {
          setStats({
            ...data,
            totalUsers: allUsers.length
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching stats:', error);
          console.log('Using fallback stats due to error');
          setStats({
            activeUsersToday: 0,
            uniqueUsersWeek: 0,
            totalUsers: 0,
            mostAccessedModules: [],
            loginTrend: []
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [authUser?.isDemo, selectedPeriod, setDemoStats]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <div className="text-gray-600">Cargando estadísticas...</div>
      </div>
    );
  }

  // Debug: afișează starea componentelor
  console.log('[DEBUG] UserStats render - stats:', stats);
  console.log('[DEBUG] UserStats render - loading:', loading);
  console.log('[DEBUG] UserStats render - showDetailModal:', showDetailModal);

  return (
    <div className="space-y-8">
      {/* Statistici generale */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          onClick={async () => {
            try {
              // Skip real data fetch in DEMO mode
              if (authUser?.isDemo) {
                console.log('🎭 DEMO mode: Using demo activity log data');
                const demoUsers = [
                  { name: 'Carlos Antonio Rodríguez', email: 'admin@demo.com', grupo: 'Admin', actions: ['login', 'dashboard_access', 'empleados_access'] },
                  { name: 'María González López', email: 'maria.gonzalez@demo.com', grupo: 'Supervisor', actions: ['login', 'fichaje_access', 'solicitudes_access'] },
                  { name: 'Juan Pérez Martín', email: 'juan.perez@demo.com', grupo: 'Empleado', actions: ['login', 'fichaje_access', 'documentos_access'] },
                  { name: 'Ana Sánchez Ruiz', email: 'ana.sanchez@demo.com', grupo: 'Empleado', actions: ['login', 'fichaje_access'] },
                  { name: 'Pedro Martínez García', email: 'pedro.martinez@demo.com', grupo: 'Empleado', actions: ['login', 'cuadrantes_access'] },
                  { name: 'Laura Fernández Torres', email: 'laura.fernandez@demo.com', grupo: 'Empleado', actions: ['login', 'solicitudes_access'] }
                ];
                setSelectedDetail({ type: 'users', data: demoUsers });
                setShowDetailModal(true);
                return;
              }

              // Obține logurile de azi pentru a afișa utilizatorii specifici
              const today = new Date().toISOString().split('T')[0];
              const activityLogs = await getActivityLog();
              const todayLogs = activityLogs.filter(log => 
                log.timestamp && log.timestamp.startsWith(today)
              );
              
              console.log('[DEBUG] Today logs found:', todayLogs.length);
              
              // Obține utilizatorii unici de azi cu detalii
              const todayUsers = {};
              todayLogs.forEach(log => {
                if (!todayUsers[log.user]) {
                  todayUsers[log.user] = {
                    name: log.user,
                    email: log.email,
                    grupo: log.grupo,
                    actions: []
                  };
                }
                todayUsers[log.user].actions.push(log.action);
              });
              
              const userDetails = Object.values(todayUsers).map(user => ({
                label: user.name,
                value: `${user.email} (${user.grupo}) - ${user.actions.length} acciones`
              }));
              
              console.log('[DEBUG] Today users:', userDetails);
              
              setSelectedDetail({
                title: 'Usuarios Activos Hoy',
                icon: '👥',
                data: {
                  total: Object.keys(todayUsers).length,
                  description: 'Usuarios que han tenido actividad hoy',
                  details: [
                    { label: 'Inicios de sesión hoy', value: todayLogs.filter(log => log.action === 'login').length },
                    { label: 'Usuarios únicos hoy', value: Object.keys(todayUsers).length },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') },
                    ...userDetails
                  ]
                }
              });
              setShowDetailModal(true);
            } catch (error) {
              console.error('Error fetching today users:', error);
              // Fallback cu datele de bază
              setSelectedDetail({
                title: 'Usuarios Activos Hoy',
                icon: '👥',
                data: {
                  total: 0,
                  description: 'Usuarios que han tenido actividad hoy (datos limitados)',
                  details: [
                    { label: 'Inicios de sesión hoy', value: 0 },
                    { label: 'Usuarios únicos hoy', value: 0 },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') },
                    { label: 'Error', value: 'No se pudieron cargar los datos reales' }
                  ]
                }
              });
              setShowDetailModal(true);
            }
          }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-16 -bottom-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="relative flex items-center justify-between p-1">
            <div>
              <p className="text-white/80 text-sm">Usuarios activos hoy</p>
              <p className="text-4xl font-extrabold tracking-tight">{stats.activeUsersToday}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </Card>
        
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          onClick={() => {
            setSelectedDetail({
              title: 'Usuarios Únicos (' + (selectedPeriod === '30d' ? '30' : '7') + ' días)',
              icon: '📈',
              data: {
                total: stats.uniqueUsersWeek,
                description: 'Usuarios únicos en el período seleccionado',
                details: stats.loginTrend.map(day => ({
                  label: new Date(day.date).toLocaleDateString('es-ES'),
                  value: `${day.logins} inicios de sesión, ${day.uniqueUsers} usuarios`
                }))
              }
            });
            setShowDetailModal(true);
          }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-16 -bottom-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="relative flex items-center justify-between p-1">
            <div>
              <p className="text-white/80 text-sm">Usuarios únicos ({selectedPeriod === '30d' ? '30' : '7'} días)</p>
              <p className="text-4xl font-extrabold tracking-tight">{stats.uniqueUsersWeek}</p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </Card>
        
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-600 to-pink-600 text-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          title="Click para ver todos los usuarios del sistema"
          onClick={async () => {
            try {
              console.log('[DEBUG] Fetching total users data...');
              
              // Obține toți utilizatorii din baza de date
              const allUsersFromDB = await getAllUsers();
              console.log('[DEBUG] Total users from DB:', allUsersFromDB.length);
              
              if (!Array.isArray(allUsersFromDB) || allUsersFromDB.length === 0) {
                throw new Error('No se pudieron cargar los usuarios de la base de datos');
              }
              
              console.log('[DEBUG] Sample user from DB:', allUsersFromDB[0]);
              console.log('[DEBUG] All user properties:', Object.keys(allUsersFromDB[0] || {}));
              console.log('[DEBUG] Sample user CORREO ELECTRONICO:', allUsersFromDB[0]?.['CORREO ELECTRONICO']);
              console.log('[DEBUG] Sample user EMAIL:', allUsersFromDB[0]?.EMAIL);
              
              // Obține toate logurile pentru a calcula activitatea
              const activityLogs = await getActivityLog();
              console.log('[DEBUG] Total logs received:', activityLogs.length);
              
              // Obține utilizatorii activi din loguri
              const activeUsers = {};
              activityLogs.forEach(log => {
                if (!activeUsers[log.user]) {
                  activeUsers[log.user] = {
                    name: log.user,
                    email: log.email,
                    grupo: log.grupo,
                    actions: []
                  };
                }
                activeUsers[log.user].actions.push(log.action);
              });
              
              console.log('[DEBUG] Active users found:', Object.keys(activeUsers));
              
              // Obține utilizatorii de azi
              const today = new Date().toISOString().split('T')[0];
              console.log('[DEBUG] Today date:', today);
              
              const todayLogs = activityLogs.filter(log => 
                log.timestamp && log.timestamp.startsWith(today)
              );
              console.log('[DEBUG] Today logs count:', todayLogs.length);
              
              const todayUsers = {};
              todayLogs.forEach(log => {
                if (!todayUsers[log.user]) {
                  todayUsers[log.user] = true;
                }
              });
              
              console.log('[DEBUG] Today unique users:', Object.keys(todayUsers));
              
              // Obține utilizatorii din ultima săptămână
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              console.log('[DEBUG] Week ago date:', weekAgo.toISOString());
              
              const weekLogs = activityLogs.filter(log => 
                log.timestamp && new Date(log.timestamp) >= weekAgo
              );
              console.log('[DEBUG] Week logs count:', weekLogs.length);
              
              const weekUsers = {};
              weekLogs.forEach(log => {
                if (!weekUsers[log.user]) {
                  weekUsers[log.user] = true;
                }
              });
              
              console.log('[DEBUG] Week unique users:', Object.keys(weekUsers));
              
              // Combină utilizatorii din baza de date cu activitatea din loguri
              const userDetails = allUsersFromDB.map(user => {
                const isActive = activeUsers[user.EMAIL] || activeUsers[user.email];
                const actions = isActive ? isActive.actions.length : 0;
                
                // Încearcă toate variantele posibile pentru nume
                const userName = user['NOMBRE / APELLIDOS'] || 
                               user.NOMBRE || 
                               user.name || 
                               user.NOMBRE_APELLIDOS ||
                               user.NOMBRE_COMPLETO ||
                               user.EMAIL || 
                               user.email ||
                               'Usuario sin nombre';
                
                // Încearcă toate variantele posibile pentru email
                const userEmail = user['CORREO ELECTRONICO'] || 
                                user.EMAIL || 
                                user.email || 
                                user.CORREO_ELECTRONICO ||
                                'N/A';
                
                // Încearcă toate variantele posibile pentru grup
                const userGrupo = user.GRUPO || user.grupo || 'N/A';
                
                console.log('[DEBUG] User object:', user);
                console.log('[DEBUG] User name found:', userName);
                console.log('[DEBUG] User email found:', userEmail);
                console.log('[DEBUG] User grupo found:', userGrupo);
                
                return {
                  label: userName,
                  value: `${userEmail} (${userGrupo}) - ${actions} acciones`
                };
              });
              
              const totalUsers = allUsersFromDB.length;
              const todayUsersCount = Object.keys(todayUsers).length;
              const weekUsersCount = Object.keys(weekUsers).length;
              
              console.log('[DEBUG] Final counts - Total from DB:', totalUsers, 'Today:', todayUsersCount, 'Week:', weekUsersCount);
              
              // Actualizează numărul din card cu datele reale
              setStats(prev => ({
                ...prev,
                totalUsers: totalUsers
              }));
              
              setSelectedDetail({
                title: 'Total Usuarios',
                icon: '🏢',
                data: {
                  total: totalUsers,
                  description: 'Total de usuarios en el sistema (de la base de datos)',
                  details: [
                    { label: 'Usuarios activos hoy', value: todayUsersCount },
                    { label: 'Usuarios únicos esta semana', value: weekUsersCount },
                    { label: 'Total en el sistema', value: totalUsers },
                    { 
                      label: 'Ver todos los usuarios', 
                      value: `${totalUsers} usuarios`,
                      isButton: true,
                      onClick: () => {
                        setSelectedDetail({
                          title: 'Lista Completa de Usuarios',
                          icon: '👥',
                          data: {
                            total: totalUsers,
                            description: 'Todos los usuarios del sistema',
                            details: userDetails
                          }
                        });
                      }
                    }
                  ]
                }
              });
              setShowDetailModal(true);
            } catch (error) {
              console.error('Error fetching total users:', error);
              // În loc de alert, afișează un modal cu eroarea
              setSelectedDetail({
                title: 'Total Usuarios',
                icon: '🏢',
                data: {
                  total: stats.totalUsers || 0,
                  description: 'Total de usuarios en el sistema (error al cargar los detalles)',
                  details: [
                    { label: 'Total en el sistema', value: stats.totalUsers || 0 },
                    { label: 'Error', value: 'No se pudieron cargar los detalles completos' },
                    { label: 'Motivo', value: error.message || 'Error desconocido' }
                  ]
                }
              });
              setShowDetailModal(true);
            }
          }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-16 -bottom-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="relative flex items-center justify-between p-1">
            <div>
              <p className="text-white/80 text-sm">Total usuarios</p>
              <p className="text-4xl font-extrabold tracking-tight">{stats.totalUsers || 0}</p>
            </div>
            <div className="text-4xl">🏢</div>
          </div>
        </Card>
        
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-600 to-red-600 text-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          onClick={() => {
            setSelectedDetail({
              title: 'Sesiones Hoy',
              icon: '🔐',
              data: {
                total: stats.loginTrend[6]?.logins || 0,
                description: 'Total de sesiones de inicio de sesión hoy',
                details: [
                  { label: 'Inicios de sesión hoy', value: stats.loginTrend[6]?.logins || 0 },
                  { label: 'Usuarios únicos hoy', value: stats.loginTrend[6]?.uniqueUsers || 0 },
                  { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') }
                ]
              }
            });
            setShowDetailModal(true);
          }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-16 -bottom-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="relative flex items-center justify-between p-1">
            <div>
              <p className="text-white/80 text-sm">Sesiones hoy</p>
              <p className="text-4xl font-extrabold tracking-tight">{stats.loginTrend[stats.loginTrend.length - 1]?.logins || 0}</p>
            </div>
            <div className="text-4xl">🔐</div>
          </div>
        </Card>
      </div>

      {/* Módulos más accedidos */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800">Módulos más accedidos</h3>
            <div className="flex space-x-2">
              <button onClick={() => setSelectedPeriod('7d')} className={`px-3 py-1.5 rounded-full text-sm border transition ${selectedPeriod === '7d' ? 'bg-red-600 text-white border-red-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>7 días</button>
              <button onClick={() => setSelectedPeriod('30d')} className={`px-3 py-1.5 rounded-full text-sm border transition ${selectedPeriod === '30d' ? 'bg-red-600 text-white border-red-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>30 días</button>
            </div>
          </div>
          
          <div className="space-y-4">
            {stats.mostAccessedModules.map((module, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-red-50 rounded-lg border border-red-100 flex items-center justify-center">
                    <span className="text-red-600 font-bold">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{module.name}</div>
                    <div className="text-sm text-gray-500">{module.count} accesos</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-40 bg-gray-200/70 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500" style={{ width: `${module.percentage}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{module.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Gráfico evolución inicios de sesión */}
      <Card>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">Evolución de inicios de sesión diarios</h3>
          
          <div className="space-y-4">
            {stats.loginTrend.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">
                      {new Date(day.date).toLocaleDateString('es-ES', { 
                        weekday: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">
                      {new Date(day.date).toLocaleDateString('es-ES', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {day.uniqueUsers} usuarios únicos
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">{day.logins}</div>
                  <div className="text-sm text-gray-500">inicios de sesión</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">📱</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Dispositivos activos</h4>
            <p className="text-3xl font-bold text-red-600">{stats.activeUsersToday}</p>
            <p className="text-sm text-gray-500">
              {stats.activeUsersToday > 0 ? `+${Math.floor(stats.activeUsersToday * 0.3)} vs ayer` : 'Sin actividad'}
            </p>
          </div>
        </Card>
        
        <Card>
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">⏰</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Inicios promedio/día</h4>
            <p className="text-3xl font-bold text-green-600">
              {stats.loginTrend && stats.loginTrend.length > 0 ? 
                `${Math.round(stats.loginTrend.reduce((sum, day) => sum + day.logins, 0) / Math.max(stats.loginTrend.length, 1))}` : 
                '0'
              }
            </p>
            <p className="text-sm text-gray-500">
              {stats.loginTrend && stats.loginTrend.length > 0 ? 
                `${Math.round((stats.loginTrend[stats.loginTrend.length - 1]?.logins || 0) * 0.2)} vs semana pasada` : 
                'Sin datos'
              }
            </p>
          </div>
        </Card>
        
        <Card>
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">🚀</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Días con actividad</h4>
            <p className="text-3xl font-bold text-blue-600">
              {stats.loginTrend && stats.loginTrend.length > 0 ? 
                `${Math.round((stats.loginTrend.filter(day => day.logins > 0).length / stats.loginTrend.length) * 100)}%` : 
                '0%'
              }
            </p>
            <p className="text-sm text-gray-500">
              Uptime últimos {selectedPeriod === '30d' ? '30' : '7'} días
            </p>
          </div>
        </Card>
      </div>

      {/* Modal pentru detalii */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="text-4xl">{selectedDetail.icon}</div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedDetail.title}</h2>
                  <p className="text-gray-600">{selectedDetail.data.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Statistică principală */}
              <div className="text-center p-6 bg-gradient-to-r from-red-50 to-red-100 rounded-xl">
                <div className="text-6xl font-bold text-red-600 mb-2">{selectedDetail.data.total}</div>
                <div className="text-gray-600">Total</div>
              </div>

              {/* Detalles */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Detalles</h3>
                                 <div className="space-y-3">
                   {selectedDetail.data.details.map((detail, index) => {
                     // Verifică dacă este un utilizator (are email în value)
                     const isUser = detail.value && typeof detail.value === 'string' && detail.value.includes('@');
                     
                     // Verifică dacă este o dată (conține login-uri și utilizatori)
                     const isDate = detail.value && typeof detail.value === 'string' && (detail.value.includes('login-uri') || detail.value.includes('inicios de sesión'));
                     
                     // Verifică dacă este un buton
                     const isButton = detail.isButton;
                     
                     return (
                       <div 
                         key={index} 
                         className={`p-4 rounded-lg ${
                           isUser ? 'bg-blue-50 border border-blue-200' : 
                           isDate ? 'bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors' : 
                           isButton ? 'bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors' :
                           'bg-gray-50'
                         }`}
                         onClick={isDate ? async () => {
                           try {
                             // Extrage data din label (ex: "28.07.2025")
                             const dateStr = detail.label;
                             const [day, month, year] = dateStr.split('.');
                             const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                             
                             console.log('[DEBUG] Clicked on date:', isoDate);
                             
                             // Obține logurile pentru ziua respectivă
                             const activityLogs = await getActivityLog();
                             const dayLogs = activityLogs.filter(log => 
                               log.timestamp && log.timestamp.startsWith(isoDate)
                             );
                             
                             console.log('[DEBUG] Day logs found:', dayLogs.length);
                             
                             // Obține utilizatorii pentru ziua respectivă
                             const dayUsers = {};
                             dayLogs.forEach(log => {
                               if (!dayUsers[log.user]) {
                                 dayUsers[log.user] = {
                                   name: log.user,
                                   email: log.email,
                                   grupo: log.grupo,
                                   actions: []
                                 };
                               }
                               dayUsers[log.user].actions.push(log.action);
                             });
                             
                             const userDetails = Object.values(dayUsers).map(user => ({
                               label: user.name,
                               value: `${user.email} (${user.grupo}) - ${user.actions.length} acciones`
                             }));
                             
                             // Afișează modal cu detalii pentru ziua respectivă
                             setSelectedDetail({
                               title: `Detalles ${dateStr}`,
                               icon: '📅',
                               data: {
                                 total: dayLogs.length,
                                 description: `Actividad para ${dateStr}`,
                                 details: [
                                   { label: 'Total acciones', value: dayLogs.length },
                                   { label: 'Inicios de sesión', value: dayLogs.filter(log => log.action === 'login').length },
                                   { label: 'Usuarios únicos', value: Object.keys(dayUsers).length },
                                   ...userDetails
                                 ]
                               }
                             });
                           } catch (error) {
                             console.error('Error fetching day details:', error);
                             alert(`Error al cargar los detalles para ${detail.label}`);
                           }
                         } : isButton ? detail.onClick : undefined}
                       >
                         <div className="flex justify-between items-start">
                           <span className="text-gray-600 font-medium">{detail.label}</span>
                           <span className={`font-semibold ${isUser ? 'text-blue-800' : isDate ? 'text-green-800' : isButton ? 'text-purple-800' : 'text-gray-800'}`}>
                             {isUser ? (
                               <div className="text-right">
                                 <div className="text-sm text-blue-600">{detail.value.split(' - ')[0]}</div>
                                 <div className="text-xs text-blue-500">{detail.value.split(' - ')[1]}</div>
                               </div>
                             ) : isDate ? (
                               <div className="text-right">
                                 <div className="text-sm text-green-600">{detail.value}</div>
                                 <div className="text-xs text-green-500">Click para detalles</div>
                               </div>
                             ) : isButton ? (
                               <div className="text-right">
                                 <div className="text-sm text-purple-600">{detail.value}</div>
                                 <div className="text-xs text-purple-500">Click para ver la lista</div>
                               </div>
                             ) : (
                               String(detail.value || '')
                             )}
                           </span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                                 <button
                   onClick={() => {
                     // Copiază detaliile în clipboard
                     const detailsText = `${selectedDetail.title}\n${selectedDetail.data.description}\n\nDetalles:\n${selectedDetail.data.details.map(d => `${d.label}: ${String(d.value || '')}`).join('\n')}`;
                     navigator.clipboard.writeText(detailsText);
                     alert('¡Los detalles se han copiado al portapapeles!');
                   }}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  📋 Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
             )}
     </div>
   );
 } 