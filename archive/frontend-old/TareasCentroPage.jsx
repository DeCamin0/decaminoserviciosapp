import { useState, useEffect, useCallback } from 'react';
import Back3DButton from '../../components/Back3DButton';
import Modal from '../../components/ui/Modal';
import Notification from '../../components/ui/Notification';
import { exportToExcelWithHeader } from '../../utils/exportExcel';
import { routes } from '../../utils/routes';

const TareasCentroPage = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('all');
  const [centros, setCentros] = useState([]);
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  // Cargar lista de centros
  useEffect(() => {
    const fetchCentros = async () => {
      setLoadingCentros(true);
      try {
        console.log('🔄 Cargando lista de centros...');
        console.log('Fetching clientes from:', routes.getClientes);
        
        // Use fetch directly like in EmpleadosPage
        const response = await fetch(routes.getClientes);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Clientes data received:', data);
        
        const clientesData = Array.isArray(data) ? data : [];
        // Extract unique centros from clientes data (same logic as EmpleadosPage)
        const soloClientes = clientesData.filter(item => item.tipo !== 'proveedor');
        const uniqueCentros = [...new Set(soloClientes.map(cliente => cliente['NOMBRE O RAZON SOCIAL']).filter(Boolean))];
        console.log('🏢 Centros únicos encontrados:', uniqueCentros);
        setCentros(uniqueCentros.sort());
        setNotification({ type: 'success', message: `${uniqueCentros.length} centros cargados correctamente` });
      } catch (error) {
        console.error('❌ Error loading centros:', error);
        setNotification({ type: 'error', message: 'Error al cargar la lista de centros' });
      } finally {
        setLoadingCentros(false);
      }
    };

    fetchCentros();
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      
      let allTasks = [];

      if (selectedCentro === 'all') {
        // Fetch para todos los centros
        const promises = centros.map(async (centro) => {
          try {
            const url = `${routes.getTareasCentro}?centroTrabajo=${encodeURIComponent(centro)}&fecha=${encodeURIComponent(dateStr)}`;
            console.log('Fetching tasks for centro:', centro, 'URL:', url);
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data.map(task => ({
              ...task,
              id: task.id,
              fecha: task.fecha,
              hora: task.hora,
              horaEdicion: task.horaEdicion,
              descripcion: task.descripcion,
              nombre: task.nombre,
              codigo: task.codigo,
              email: task.email,
              centroTrabajo: task.centroTrabajo,
              loc: task.loc,
              locEdicion: task.locEdicion,
              address: task.address,
              ip: task.ip,
              created_at: task.created_at
            })) : [];
          } catch (error) {
            console.error(`Error fetching tasks for ${centro}:`, error);
            return [];
          }
        });

        const results = await Promise.all(promises);
        allTasks = results.flat();
      } else {
        // Fetch para un centro específico
        const url = `${routes.getTareasCentro}?centroTrabajo=${encodeURIComponent(selectedCentro)}&fecha=${encodeURIComponent(dateStr)}`;
        console.log('Fetching tasks for selected centro:', selectedCentro, 'URL:', url);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          allTasks = Array.isArray(data) ? data.map(task => ({
            ...task,
            id: task.id,
            fecha: task.fecha,
            hora: task.hora,
            horaEdicion: task.horaEdicion,
            descripcion: task.descripcion,
            nombre: task.nombre,
            codigo: task.codigo,
            email: task.email,
            centroTrabajo: task.centroTrabajo,
            loc: task.loc,
            locEdicion: task.locEdicion,
            address: task.address,
            ip: task.ip,
            created_at: task.created_at
          })) : [];
        }
      }

      setTasks(allTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setNotification({ type: 'error', message: 'Error al cargar las tareas' });
    } finally {
      setLoading(false);
    }
  }, [selectedCentro, selectedYear, selectedMonth, selectedDay, centros]);

  // Cargar tareas
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleShowTaskDetails = (task) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  const exportToExcel = () => {
    if (tasks.length === 0) {
      setNotification({ type: 'warning', message: 'No hay tareas para exportar' });
      return;
    }

    const data = tasks.map(task => ({
      'Centro': task.centroTrabajo || '-',
      'Fecha': task.fecha || '-',
      'Hora': task.hora || '-',
      'Nombre': task.nombre || '-',
      'Código': task.codigo || '-',
      'Descripción': task.descripcion || '-',
      'Email': task.email || '-',
      'Dirección': task.address || '-',
      'Hora Edición': task.horaEdicion || '-',
      'Loc Edición': task.locEdicion || '-',
      'IP': task.ip || '-',
      'Creado': task.created_at || '-'
    }));

    const columns = [
      { header: 'Centro', key: 'Centro', width: 30 },
      { header: 'Fecha', key: 'Fecha', width: 12 },
      { header: 'Hora', key: 'Hora', width: 10 },
      { header: 'Nombre', key: 'Nombre', width: 25 },
      { header: 'Código', key: 'Código', width: 12 },
      { header: 'Descripción', key: 'Descripción', width: 40 },
      { header: 'Email', key: 'Email', width: 25 },
      { header: 'Dirección', key: 'Dirección', width: 35 },
      { header: 'Hora Edición', key: 'Hora Edición', width: 12 },
      { header: 'Loc Edición', key: 'Loc Edición', width: 35 },
      { header: 'IP', key: 'IP', width: 15 },
      { header: 'Creado', key: 'Creado', width: 20 }
    ];

    const dateStr = `${String(selectedDay).padStart(2, '0')}-${String(selectedMonth).padStart(2, '0')}-${selectedYear}`;
    const centroName = selectedCentro === 'all' ? 'Todos_Centros' : selectedCentro.replace(/\s+/g, '_');
    const fileName = `Tareas_${centroName}_${dateStr}`;

    exportToExcelWithHeader(
      data,
      columns,
      fileName,
      `Tareas - ${selectedCentro === 'all' ? 'Todos los Centros' : selectedCentro}`,
      `Fecha: ${dateStr}`
    );

    setNotification({ type: 'success', message: 'Exportado a Excel correctamente' });
  };


  const changeDay = (increment) => {
    const date = new Date(selectedYear, selectedMonth - 1, selectedDay);
    date.setDate(date.getDate() + increment);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth() + 1);
    setSelectedDay(date.getDate());
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Back3DButton to="/cuadernos-centro" title="Volver" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">📋</span>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Tareas Diarias Por Centro
                </h1>
                <p className="text-gray-600 font-medium">Visualiza todas las tareas de los diferentes centros de trabajo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm">🔍</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selector de Centro */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Centro de Trabajo
                {loadingCentros && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(Cargando...)</span>
                )}
              </label>
              <select
                value={selectedCentro}
                onChange={(e) => setSelectedCentro(e.target.value)}
                disabled={loadingCentros}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300 bg-white/50 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">📊 Todos los Centros</option>
                {loadingCentros ? (
                  <option value="" disabled>Cargando centros...</option>
                ) : (
                  centros.map(centro => (
                    <option key={centro} value={centro}>
                      🏢 {centro}
                    </option>
                  ))
                )}
              </select>
              {!loadingCentros && centros.length > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✅ {centros.length} centros disponibles
                </p>
              )}
            </div>

            {/* Navegación de Fecha */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Fecha</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => changeDay(-1)}
                  className="px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  ←
                </button>
                <div className="flex-1 text-center font-bold text-lg bg-gradient-to-r from-emerald-100 to-green-100 rounded-xl py-3 px-4 border-2 border-emerald-200">
                  {String(selectedDay).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}/{selectedYear}
                </div>
                <button
                  onClick={() => changeDay(1)}
                  className="px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  →
                </button>
                <button
                  onClick={goToToday}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                >
                  Hoy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={exportToExcel}
            className="group relative px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-semibold"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-red-400 to-red-500 opacity-30 group-hover:opacity-50 blur-md transition-all"></div>
            <div className="relative flex items-center gap-3">
              <span className="text-xl">📊</span>
              <span>Exportar Excel</span>
            </div>
          </button>
          
          <button
            onClick={fetchTasks}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-semibold"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-400 to-indigo-500 opacity-30 group-hover:opacity-50 blur-md transition-all"></div>
            <div className="relative flex items-center gap-3">
              <span className="text-xl">🔄</span>
              <span>Refrescar</span>
            </div>
          </button>
        </div>

        {/* Tabla de Tareas */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-emerald-500 to-green-600">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">📋</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                {loading ? 'Cargando...' : `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''} encontrada${tasks.length !== 1 ? 's' : ''}`}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-emerald-600 to-green-700 text-white">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-lg">Centro</th>
                  <th className="text-left py-4 px-6 font-semibold text-lg">Fecha</th>
                  <th className="text-left py-4 px-6 font-semibold text-lg">Hora</th>
                  <th className="text-left py-4 px-6 font-semibold text-lg">Nombre</th>
                  <th className="text-left py-4 px-6 font-semibold text-lg">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        <span className="text-lg font-medium">Cargando tareas...</span>
                      </div>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                          <span className="text-2xl">📝</span>
                        </div>
                        <span className="text-lg font-medium">No hay tareas para esta fecha</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, index) => (
                    <tr
                      key={task.id}
                      onClick={() => handleShowTaskDetails(task)}
                      className={`border-b border-gray-100 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 cursor-pointer transition-all duration-200 transform hover:scale-[1.01] ${index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'}`}
                    >
                      <td className="py-4 px-6 text-gray-900 font-medium">{task.centroTrabajo || '-'}</td>
                      <td className="py-4 px-6 text-gray-700">{task.fecha || '-'}</td>
                      <td className="py-4 px-6 text-gray-700 font-mono">{task.hora || '-'}</td>
                      <td className="py-4 px-6 text-gray-900 font-semibold">{task.nombre || '-'}</td>
                      <td className="py-4 px-6 text-gray-600">{task.descripcion || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Detalles Tarea */}
      <Modal
        isOpen={showTaskDetails}
        onClose={() => setShowTaskDetails(false)}
        title="Detalles de la Tarea"
      >
        {selectedTask && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📋</span>
                </div>
                <h3 className="text-xl font-bold text-emerald-900">Información Principal</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-emerald-100">
                  <span className="text-sm font-semibold text-emerald-700">ID:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.id}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-100">
                  <span className="text-sm font-semibold text-emerald-700">Centro:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.centroTrabajo || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-100">
                  <span className="text-sm font-semibold text-emerald-700">Fecha:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.fecha || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-100">
                  <span className="text-sm font-semibold text-emerald-700">Hora:</span>
                  <p className="text-gray-900 font-medium font-mono">{selectedTask.hora || '-'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">👤</span>
                </div>
                <h3 className="text-xl font-bold text-blue-900">Información del Empleado</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <span className="text-sm font-semibold text-blue-700">Nombre:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.nombre || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <span className="text-sm font-semibold text-blue-700">Código:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.codigo || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100 md:col-span-2">
                  <span className="text-sm font-semibold text-blue-700">Email:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.email || '-'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📝</span>
                </div>
                <h3 className="text-xl font-bold text-purple-900">Descripción</h3>
              </div>
              <div className="bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-gray-900">{selectedTask.descripcion || '-'}</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📍</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Información Técnica</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Dirección:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.address || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Hora Edición:</span>
                  <p className="text-gray-900 font-medium font-mono">{selectedTask.horaEdicion || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Loc Edición:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.locEdicion || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">IP:</span>
                  <p className="text-gray-900 font-medium font-mono">{selectedTask.ip || '-'}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 md:col-span-2">
                  <span className="text-sm font-semibold text-gray-700">Creado:</span>
                  <p className="text-gray-900 font-medium">{selectedTask.created_at || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Notificaciones */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default TareasCentroPage;

