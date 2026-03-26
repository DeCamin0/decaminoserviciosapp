import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Input, Modal } from '../../components/ui';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../contexts/AuthContextBase';
import { demo, debug } from '../../utils/logger';
import { config } from '../../config/env.js';
import { getPdfMake } from '../../utils/getPdfMake';

const rawColor = config.PRIMARY_COLOR || '#CC0000';
const PRIMARY_COLOR = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

export default function ActivityLog() {
  const { user: authUser } = useAuth();
  const { getActivityLog, getAllUsers } = useAdminApi();
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const isMountedRef = useRef(true);
  const getActivityLogRef = useRef(getActivityLog);
  
  // State pentru modal-ul de exportare logs per angajat
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportedLogs, setExportedLogs] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Demo data for ActivityLog
  const setDemoActivityLog = useCallback(() => {
    const demoLogs = [
      {
        id: 'DEMO_LOG_001',
        user: 'Carlos Antonio Rodríguez',
        email: 'admin@demo.com',
        action: 'login',
        url: '/inicio',
        timestamp: '2024-12-03T09:15:00Z',
        grupo: 'Admin',
        description: 'Inicio de sesión en modo DEMO',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_002',
        user: 'María González López',
        email: 'maria.gonzalez@demo.com',
        action: 'page_access',
        url: '/empleados',
        timestamp: '2024-12-03T09:30:00Z',
        grupo: 'Supervisor',
        description: 'Acceso a página de empleados',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_003',
        user: 'Juan Pérez Martín',
        email: 'juan.perez@demo.com',
        action: 'fichaje',
        url: '/fichaje',
        timestamp: '2024-12-03T10:00:00Z',
        grupo: 'Empleado',
        description: 'Registro de fichaje de entrada',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_004',
        user: 'Ana Sánchez Ruiz',
        email: 'ana.sanchez@demo.com',
        action: 'document_upload',
        url: '/documentos',
        timestamp: '2024-12-03T10:30:00Z',
        grupo: 'Empleado',
        description: 'Subida de documento DEMO',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_005',
        user: 'Pedro Martínez García',
        email: 'pedro.martinez@demo.com',
        action: 'solicitud_create',
        url: '/solicitudes',
        timestamp: '2024-12-03T11:00:00Z',
        grupo: 'Empleado',
        description: 'Creación de solicitud de vacaciones',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_006',
        user: 'Laura Fernández Torres',
        email: 'laura.fernandez@demo.com',
        action: 'cuadrante_access',
        url: '/cuadrantes-empleado',
        timestamp: '2024-12-03T11:30:00Z',
        grupo: 'Empleado',
        description: 'Consulta de cuadrantes',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      },
      {
        id: 'DEMO_LOG_007',
        user: 'Carlos Antonio Rodríguez',
        email: 'admin@demo.com',
        action: 'admin_access',
        url: '/admin',
        timestamp: '2024-12-03T12:00:00Z',
        grupo: 'Admin',
        description: 'Acceso al panel de administración',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (DEMO)'
      }
    ];
    setActivityLog(demoLogs);
    setLoading(false);
  }, []);

  useEffect(() => {
    getActivityLogRef.current = getActivityLog;
  }, [getActivityLog]);

  const fetchActivityLog = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (authUser?.isDemo) {
      demo('DEMO mode: Using demo activity log data instead of fetching from backend');
      setDemoActivityLog();
      return;
    }

    setLoading(true);
    try {
      const filters = {
        user: selectedUser !== 'todos' ? selectedUser : undefined,
        action: selectedAction !== 'todos' ? selectedAction : undefined,
        date: selectedDate || undefined
      };
      const response = await getActivityLogRef.current(filters);
      debug('ActivityLog data received:', response);
      
      if (!isMountedRef.current) return;

      if (Array.isArray(response)) {
        setActivityLog(response);
      } else if (response && Array.isArray(response.data)) {
        setActivityLog(response.data);
      } else if (response && Array.isArray(response.logs)) {
        setActivityLog(response.logs);
      } else if (response && Array.isArray(response.activityLog)) {
        setActivityLog(response.activityLog);
      } else if (response && typeof response === 'object') {
        debug('Converting single log object to array');
        setActivityLog([response]);
      } else {
        console.warn('ActivityLog data is not an array:', response);
        setActivityLog([]);
      }
    } catch (error) {
      console.error('Error fetching activity log:', error);
      if (!isMountedRef.current) return;
      setDemoActivityLog();
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [authUser?.isDemo, selectedUser, selectedAction, selectedDate, setDemoActivityLog]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchActivityLog();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchActivityLog]);

  // Încarcă lista de angajați când se deschide modal-ul
  useEffect(() => {
    if (showExportModal && employees.length === 0) {
      const loadEmployees = async () => {
        try {
          const users = await getAllUsers();
          setEmployees(users || []);
        } catch (error) {
          console.error('Error loading employees:', error);
        }
      };
      loadEmployees();
    }
  }, [showExportModal, getAllUsers, employees.length]);

  // Închide dropdown-ul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest('.employee-dropdown-container')) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmployeeDropdown]);

  // Filtrare angajați pentru dropdown
  const filteredEmployees = employees.filter(emp => {
    const nombre = (emp['NOMBRE / APELLIDOS'] || emp.nombre || emp.NOMBRE || '').toLowerCase();
    const email = (emp['CORREO ELECTRONICO'] || emp['CORREO ELECTRONIC'] || emp.email || emp.EMAIL || '').toLowerCase();
    const codigo = (emp.CODIGO || emp.codigo || '').toString().toLowerCase();
    const search = employeeSearch.toLowerCase();
    return nombre.includes(search) || email.includes(search) || codigo.includes(search);
  });

  // Handler pentru export Excel
  const handleExportExcel = async () => {
    const logsToExport = exportedLogs.length > 0 ? exportedLogs : filteredLog;
    
    if (!logsToExport || logsToExport.length === 0) {
      alert('No hay logs para exportar');
      return;
    }

    try {
      const { exportToExcelWithHeader } = await import('../../utils/exportExcel');
      
      const columns = [
        { key: 'user', label: 'Usuario', width: 25 },
        { key: 'email', label: 'Email', width: 30 },
        { key: 'action', label: 'Acción', width: 20 },
        { key: 'timestamp', label: 'Fecha/Hora', width: 20 },
        { key: 'url', label: 'URL', width: 30 },
        { key: 'ip', label: 'IP', width: 15 },
        { key: 'grupo', label: 'Grupo', width: 15 },
        { key: 'sessionId', label: 'Sesión', width: 20 }
      ];

      const dataToExport = logsToExport.map(log => ({
        user: log.user || log.updateby || 'N/A',
        email: log.email || 'N/A',
        action: getActionDescription(log.action),
        timestamp: formatTimestamp(log.timestamp),
        url: log.url || 'N/A',
        ip: log.ip || 'N/A',
        grupo: log.grupo || 'N/A',
        sessionId: log.sessionId || 'N/A'
      }));

      const employeeName = selectedEmployee 
        ? (selectedEmployee['NOMBRE / APELLIDOS'] || selectedEmployee.nombre || selectedEmployee.NOMBRE || 'empleado')
        : 'todos';
      
      const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `activity_logs_${safeName}_${dateFrom || 'all'}_${dateTo || 'all'}`;
      const reportTitle = `REGISTRO DE ACTIVIDAD${selectedEmployee ? ` - ${employeeName}` : ''}`;
      const period = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'Todos los períodos';

      await exportToExcelWithHeader(
        dataToExport,
        columns,
        reportTitle,
        filename,
        {},
        period
      );

      // Log export
      if (authUser) {
        const { logDataExport } = await import('../../utils/activityLogger');
        await logDataExport('activity_logs_excel', { 
          count: logsToExport.length, 
          employee: employeeName,
          dateFrom,
          dateTo
        }, authUser);
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error al exportar a Excel: ' + error.message);
    }
  };

  // Handler pentru export PDF
  const handleExportPDF = async () => {
    const logsToExport = exportedLogs.length > 0 ? exportedLogs : filteredLog;
    
    if (!logsToExport || logsToExport.length === 0) {
      alert('No hay logs para exportar');
      return;
    }

    try {
      const pdfMake = await getPdfMake();

      const employeeName = selectedEmployee 
        ? (selectedEmployee['NOMBRE / APELLIDOS'] || selectedEmployee.nombre || selectedEmployee.NOMBRE || 'empleado')
        : 'Todos los empleados';
      
      const period = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'Todos los períodos';

      const tableBody = [
        ['Usuario', 'Email', 'Acción', 'Fecha/Hora', 'URL', 'IP', 'Grupo'],
        ...logsToExport.map(log => [
          log.user || log.updateby || 'N/A',
          log.email || 'N/A',
          getActionDescription(log.action),
          formatTimestamp(log.timestamp),
          (log.url || 'N/A').substring(0, 40),
          log.ip || 'N/A',
          log.grupo || 'N/A'
        ])
      ];

      const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        content: [
          {
            text: config.COMPANY_NAME,
            style: 'companyName'
          },
          {
            text: 'Registro de Actividad de Usuarios',
            style: 'reportTitle'
          },
          {
            text: `Empleado: ${employeeName}`,
            style: 'period',
            margin: [0, 4, 0, 2]
          },
          {
            text: `Período: ${period}`,
            style: 'period',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              headerRows: 1,
              widths: [80, 100, 80, 80, 120, 60, 60],
              body: tableBody
            },
            layout: {
              fillColor: (rowIndex) => {
                return rowIndex === 0 ? PRIMARY_COLOR : null;
              },
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 2 : 1,
              vLineWidth: () => 1,
              hLineColor: () => '#aaaaaa',
              vLineColor: () => '#aaaaaa'
            }
          }
        ],
        styles: {
          companyName: { 
            fontSize: 18, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: PRIMARY_COLOR, 
            alignment: 'center', 
            margin: [0, 0, 0, 8]
          },
          reportTitle: { 
            fontSize: 14, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: '#0066CC', 
            alignment: 'center',
            margin: [0, 4, 0, 2]
          },
          period: { 
            fontSize: 10, 
            color: '#333333', 
            alignment: 'center'
          }
        },
        defaultStyle: {
          fontSize: 8,
          color: '#333333'
        }
      };

      const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `activity_logs_${safeName}_${dateFrom || 'all'}_${dateTo || 'all'}.pdf`;

      pdfMake.createPdf(docDefinition).download(filename);

      // Log export
      if (authUser) {
        const { logDataExport } = await import('../../utils/activityLogger');
        await logDataExport('activity_logs_pdf', { 
          count: logsToExport.length, 
          employee: employeeName,
          dateFrom,
          dateTo
        }, authUser);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF: ' + error.message);
    }
  };

  // Handler pentru extragerea logurilor
  const handleExportLogs = async () => {
    if (!selectedEmployee) {
      alert('Por favor, selecciona un empleado');
      return;
    }

    if (!dateFrom || !dateTo) {
      alert('Por favor, selecciona un rango de fechas');
      return;
    }

    setExportLoading(true);
    try {
      const employeeEmail = selectedEmployee['CORREO ELECTRONICO'] || 
                            selectedEmployee['CORREO ELECTRONIC'] || 
                            selectedEmployee.email || 
                            selectedEmployee.EMAIL;
      
      if (!employeeEmail) {
        alert('No se encontró el email del empleado seleccionado');
        setExportLoading(false);
        return;
      }

      const filters = {
        email: employeeEmail,
        dateFrom: dateFrom,
        dateTo: dateTo,
        limit: 10000 // Limit mare pentru a obține toate logurile
      };

      const response = await getActivityLog(filters);
      
      let logs = [];
      if (Array.isArray(response)) {
        logs = response;
      } else if (response && Array.isArray(response.logs)) {
        logs = response.logs;
      } else if (response && Array.isArray(response.data)) {
        logs = response.data;
      }

      setExportedLogs(logs);
      setShowExportModal(false);
      
      // Actualizează lista principală cu logurile exportate
      setActivityLog(logs);
      setSelectedUser(selectedEmployee['NOMBRE / APELLIDOS'] || selectedEmployee.nombre || selectedEmployee.NOMBRE || 'todos');
      setSelectedDate('');
      
      // Scroll la lista de loguri pentru a vedea rezultatele
      setTimeout(() => {
        const logSection = document.querySelector('.activity-log-list-section');
        if (logSection) {
          logSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Error al exportar los logs: ' + error.message);
    } finally {
      setExportLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action) => {
    const colors = {
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      page_access: 'bg-blue-100 text-blue-800',
      data_export: 'bg-purple-100 text-purple-800',
      data_import: 'bg-orange-100 text-orange-800',
      user_created: 'bg-green-100 text-green-800',
      user_updated: 'bg-yellow-100 text-yellow-800',
      fichaje_created: 'bg-blue-100 text-blue-800',
      cuadrante_generated: 'bg-purple-100 text-purple-800',
      report_generated: 'bg-indigo-100 text-indigo-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getActionDescription = (action) => {
    const descriptions = {
      login: 'Inicio de sesión',
      logout: 'Cierre de sesión',
      page_access: 'Acceso a página',
      data_export: 'Exportar datos',
      data_import: 'Importar datos',
      user_created: 'Crear usuario',
      user_updated: 'Actualizar usuario',
      fichaje_created: 'Crear fichaje',
      cuadrante_generated: 'Generar cuadrante',
      report_generated: 'Generar informe',
      // Tipos agregados para estadísticas
      all_actions: 'Todas las acciones',
      active_users: 'Usuarios activos',
      login_summary: 'Resumen de inicios de sesión',
      page_access_summary: 'Resumen de accesos a páginas',
      logout_summary: 'Resumen de cierres de sesión'
    };
    return descriptions[action] || action;
  };

  const openLogDetails = (log) => {
    setSelectedLog(log);
    setShowLogModal(true);
  };

  const closeLogModal = () => {
    setSelectedLog(null);
    setShowLogModal(false);
  };

  // Filtrare log-uri
  const filteredLog = (Array.isArray(activityLog) ? activityLog : []).filter(log => {
    const matchesUser = selectedUser === 'todos' || log.user === selectedUser;
    const matchesAction = selectedAction === 'todos' || log.action === selectedAction;
    const matchesSearch = searchTerm === '' || 
                         (log.user && log.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (log.url && log.url.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (log.page && log.page.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDate = selectedDate === '' || 
                       (log.timestamp && log.timestamp.startsWith(selectedDate));
    
    return matchesUser && matchesAction && matchesSearch && matchesDate;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sortează de la cele mai recente la cele mai vechi

  // Obține utilizatorii unici pentru filtru
  const uniqueUsers = [...new Set((Array.isArray(activityLog) ? activityLog : []).map(log => log.user))];
  
  // Obține acțiunile unice pentru filtru
  const uniqueActions = [...new Set((Array.isArray(activityLog) ? activityLog : []).map(log => log.action))];
  
  // Debug: afișează toate acțiunile disponibile
  debug('Available actions in logs:', uniqueActions);
  debug('All logs:', activityLog);
  debug('Sample log structure:', activityLog[0]);
  debug('Sample log keys:', activityLog[0] ? Object.keys(activityLog[0]) : 'No logs');
  debug('Search term:', searchTerm);
  debug('Filtered logs count:', filteredLog.length);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <div className="text-gray-600">Cargando registro de actividad...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header cu filtre */}
      <div className="flex items-center justify-between gap-4 flex-col md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Registro de Actividad de Usuarios</h2>
          <p className="text-gray-600">Monitorea la actividad de los usuarios en el sistema</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuario, acción o URL"
            className="md:w-64"
          />
          <Button
            onClick={fetchActivityLog}
            variant="outline"
          >
            🔄 Actualizar
          </Button>
          <Button
            onClick={() => setShowExportModal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          >
            📥 Exportar Logs por Empleado
          </Button>
        </div>
      </div>

      {/* Filtre Super Modern */}
      <Card className="relative overflow-hidden border-0 shadow-2xl">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
        
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
        
        <div className="relative p-6">
          {/* Header cu Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Filtros Avanzados
                </h3>
                <p className="text-sm text-gray-600">Personaliza tu búsqueda con precisión</p>
              </div>
            </div>
            
            {/* Toggle Button */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`relative px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-500 transform hover:scale-105 ${
                filtersExpanded 
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/25' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className={`w-5 h-5 transition-transform duration-300 ${filtersExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span>{filtersExpanded ? 'Ocultar' : 'Mostrar'} Filtros</span>
              </div>
            </button>
          </div>

          {/* Filtros Expandibles */}
          <div className={`transition-all duration-500 overflow-hidden ${
            filtersExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
          
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Usuario Filter */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Usuario
                </label>
                <div className="relative">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-300 bg-white/90 backdrop-blur-sm hover:bg-white hover:shadow-lg appearance-none cursor-pointer font-medium"
                  >
                    <option value="todos">Todos los usuarios</option>
                    {uniqueUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Acción Filter */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  Acción
                </label>
                <div className="relative">
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-300 bg-white/90 backdrop-blur-sm hover:bg-white hover:shadow-lg appearance-none cursor-pointer font-medium"
                  >
                    <option value="todos">Todas las acciones</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>{getActionDescription(action)}</option>
                    ))}
                  </select>
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Fecha Filter */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  Fecha
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all duration-300 bg-white/90 backdrop-blur-sm hover:bg-white hover:shadow-lg font-medium"
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filtros Activos */}
            {(selectedUser !== 'todos' || selectedAction !== 'todos' || selectedDate) && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="font-bold text-gray-800">Filtros activos:</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    {selectedUser !== 'todos' && (
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 shadow-sm">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {selectedUser}
                        <button onClick={() => setSelectedUser('todos')} className="ml-2 hover:text-green-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {selectedAction !== 'todos' && (
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border border-purple-200 shadow-sm">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {getActionDescription(selectedAction)}
                        <button onClick={() => setSelectedAction('todos')} className="ml-2 hover:text-purple-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {selectedDate && (
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 border border-orange-200 shadow-sm">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {selectedDate}
                        <button onClick={() => setSelectedDate('')} className="ml-2 hover:text-orange-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedUser('todos');
                      setSelectedAction('todos');
                      setSelectedDate('');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-sm flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Limpiar todo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div 
            className="p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              const allLogs = Array.isArray(activityLog) ? activityLog : [];
              if (allLogs.length > 0) {
                setSelectedLog({
                  action: 'all_actions',
                  user: 'Todos los usuarios',
                  timestamp: new Date().toISOString(),
                  details: {
                    totalActions: allLogs.length,
                    actions: allLogs.map(log => ({
                      action: log.action,
                      user: log.user,
                      timestamp: log.timestamp
                    }))
                  }
                });
                setShowLogModal(true);
              }
            }}
          >
            <div className="text-4xl mb-2">📊</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Total acciones</h4>
            <p className="text-3xl font-bold text-blue-600">{Array.isArray(activityLog) ? activityLog.length : 0}</p>
            <p className="text-sm text-gray-500">En los últimos 7 días</p>
          </div>
        </Card>
        
        <Card>
          <div 
            className="p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              const allLogs = Array.isArray(activityLog) ? activityLog : [];
              if (uniqueUsers.length > 0) {
                setSelectedLog({
                  action: 'active_users',
                  user: 'Usuarios activos',
                  timestamp: new Date().toISOString(),
                  details: {
                    totalUsers: uniqueUsers.length,
                    users: uniqueUsers.map(user => {
                      const userLogs = allLogs.filter(log => log.user === user);
                      const lastActivity = userLogs[0];
                      return {
                        user: user,
                        totalActions: userLogs.length,
                        lastActivity: lastActivity?.timestamp,
                        actions: userLogs.map(log => ({
                          action: log.action,
                          timestamp: log.timestamp
                        }))
                      };
                    })
                  }
                });
                setShowLogModal(true);
              }
            }}
          >
            <div className="text-4xl mb-2">👥</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Usuarios activos</h4>
            <p className="text-3xl font-bold text-green-600">{uniqueUsers.length}</p>
            <p className="text-sm text-gray-500">En los últimos 7 días</p>
          </div>
        </Card>
        
        <Card>
          <div 
            className="p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              const loginLogs = (Array.isArray(activityLog) ? activityLog : []).filter(log => log.action === 'login');
              if (loginLogs.length > 0) {
                setSelectedLog({
                  action: 'login_summary',
                  user: 'Inicios de sesión',
                  timestamp: new Date().toISOString(),
                  details: {
                    totalLogins: loginLogs.length,
                    logins: loginLogs.map(log => ({
                      user: log.user,
                      email: log.email,
                      timestamp: log.timestamp,
                      grupo: log.grupo,
                      role: log.role
                    }))
                  }
                });
                setShowLogModal(true);
              }
            }}
          >
            <div className="text-4xl mb-2">🔐</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Inicios de sesión</h4>
            <p className="text-3xl font-bold text-purple-600">
              {(Array.isArray(activityLog) ? activityLog : []).filter(log => log.action === 'login').length}
            </p>
            <p className="text-sm text-gray-500">En los últimos 7 días</p>
          </div>
        </Card>
        
        <Card>
          <div 
            className="p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              const logoutLogs = (Array.isArray(activityLog) ? activityLog : []).filter(log => log.action === 'logout');
              if (logoutLogs.length > 0) {
                setSelectedLog({
                  action: 'logout_summary',
                  user: 'Cierres de sesión',
                  timestamp: new Date().toISOString(),
                  details: {
                    totalLogouts: logoutLogs.length,
                    logouts: logoutLogs.map(log => ({
                      user: log.user,
                      email: log.email,
                      timestamp: log.timestamp,
                      grupo: log.grupo,
                      role: log.role
                    }))
                  }
                });
                setShowLogModal(true);
              }
            }}
          >
            <div className="text-4xl mb-2">🚪</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Cierres de sesión</h4>
            <p className="text-3xl font-bold text-orange-600">
              {(Array.isArray(activityLog) ? activityLog : []).filter(log => log.action === 'logout').length}
            </p>
            <p className="text-sm text-gray-500">En los últimos 7 días</p>
          </div>
        </Card>
      </div>

      {/* Lista de activitate */}
      <Card className="activity-log-list-section">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">
                Registro de Actividad ({filteredLog.length} registros)
              </h3>
              {exportedLogs.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">📊</span>
                      <span className="text-sm font-medium text-blue-800">
                        Mostrando {exportedLogs.length} logs exportados
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleExportExcel}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3"
                      >
                        📗 Exportar Excel
                      </Button>
                      <Button
                        onClick={handleExportPDF}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-3"
                      >
                        📕 Exportar PDF
                      </Button>
                      <Button
                        onClick={() => {
                          setExportedLogs([]);
                          fetchActivityLog();
                          setSelectedUser('todos');
                          setSelectedDate('');
                        }}
                        variant="outline"
                        className="text-xs py-1 px-3"
                      >
                        🔄 Ver todos los logs
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Mostrando las últimas {filteredLog.length} acciones
            </div>
          </div>
          
          {filteredLog.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <p className="text-gray-600 font-medium">No hay acciones que coincidan con los criterios.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLog.map((log, index) => {
                const fallbackKey = `${log.sessionId || 'session'}-${log.timestamp || index}-${log.action || 'action'}-${log.user || 'user'}`;
                const logKey = typeof log.id !== 'undefined' && log.id !== null ? `log-${log.id}` : fallbackKey;
                return (
                <div 
                  key={logKey} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => openLogDetails(log)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">{log.icon}</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{log.updateby || log?.details?.updated_by || log?.details?.created_by || log.user}</div>
                      <div className="text-sm text-gray-500">
                        {log.action === 'user_updated' && (log?.user || log?.details?.target_user)
                          ? `Usuario objetivo: ${log?.user || log?.details?.target_user}`
                          : (log.page || '')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}>
                      {getActionDescription(log.action)}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div className="text-xs text-gray-500">{log.ip}</div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </Card>

      {/* Detalles de sesiones */}
      <Card>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">Detalles de Sesiones</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última actividad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sesión</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {uniqueUsers.slice(0, 10).map((user, index) => {
                  const userLogs = (Array.isArray(activityLog) ? activityLog : []).filter(log => log.user === user);
                  const lastActivity = userLogs[0];
                  const isOnline = lastActivity && 
                                 new Date(lastActivity.timestamp) > new Date(Date.now() - 30 * 60 * 1000);
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{user}</div>
                        <div className="text-sm text-gray-500">
                          {userLogs.length} acciones en los últimos 7 días
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lastActivity ? formatTimestamp(lastActivity.timestamp) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lastActivity?.ip || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lastActivity?.sessionId || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isOnline 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isOnline ? 'En línea' : 'Desconectado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Modal detalles del log */}
      {showLogModal && selectedLog && (
        <Modal
          isOpen={showLogModal}
          onClose={closeLogModal}
          title="Detalles del Registro de Actividad"
        >
          <div className="space-y-6">
            {/* Encabezado con la acción */}
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">{getActionDescription(selectedLog.action)}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {getActionDescription(selectedLog.action)}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatTimestamp(selectedLog.timestamp)}
                </p>
              </div>
            </div>

            {/* Información del usuario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">
                  👤 Información del Usuario
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usuario:</span>
                    <span className="font-medium">{selectedLog.user || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{selectedLog.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grupo:</span>
                    <span className="font-medium">{selectedLog.grupo || selectedLog.details?.grupo || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">
                  🌐 Información Técnica
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">IP:</span>
                    <span className="font-medium">{selectedLog.ip || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID de Sesión:</span>
                    <span className="font-medium text-xs">{selectedLog.sessionId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">URL:</span>
                    <span className="font-medium text-xs truncate max-w-32">
                      {selectedLog.url || selectedLog.details?.url || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User Agent:</span>
                    <span className="font-medium text-xs truncate max-w-32">
                      {selectedLog.userAgent || selectedLog.details?.userAgent || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cambios de ficha (empleado actualizado) */}
            {selectedLog.action === 'user_updated' &&
              selectedLog.details?.field_changes &&
              Array.isArray(selectedLog.details.field_changes) &&
              selectedLog.details.field_changes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-md font-semibold text-gray-800 border-b pb-2">
                    📝 Campos modificados
                  </h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2 border-b">Campo</th>
                          <th className="text-left p-2 border-b">Valor anterior</th>
                          <th className="text-left p-2 border-b">Valor nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLog.details.field_changes.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-2 font-mono text-xs align-top">{row.campo}</td>
                            <td className="p-2 text-gray-700 align-top break-words max-w-[200px]">
                              {row.valorAnterior}
                            </td>
                            <td className="p-2 text-gray-800 align-top break-words max-w-[200px]">
                              {row.valorNuevo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedLog.details.updated_by && (
                    <p className="text-xs text-gray-500">
                      Editado por: <span className="font-medium">{selectedLog.details.updated_by}</span>
                    </p>
                  )}
                </div>
              )}

            {selectedLog.action === 'user_updated' &&
              (!selectedLog.details?.field_changes ||
                !Array.isArray(selectedLog.details.field_changes) ||
                selectedLog.details.field_changes.length === 0) && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No hay listado de campos modificados para este registro (log anterior a la mejora o sin
                  snapshot de edición).
                </p>
              )}

            {/* Detalles adicionales */}
            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">
                  📋 Detalles Adicionales (JSON)
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={closeLogModal}
              >
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  // Copiar detalles al portapapeles
                  navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                  alert('¡Los detalles se han copiado al portapapeles!');
                }}
              >
                📋 Copiar Detalles
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal pentru exportare logs per angajat */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setSelectedEmployee(null);
          setEmployeeSearch('');
          setDateFrom('');
          setDateTo('');
          setExportedLogs([]);
        }}
        title="Exportar Logs por Empleado"
      >
        <div className="space-y-6">
          {/* Selector angajat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Empleado:
            </label>
            <div className="relative employee-dropdown-container">
              <Input
                type="text"
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Buscar por nombre, email o código..."
                className="w-full"
              />
              {showEmployeeDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredEmployees.slice(0, 20).map((emp, index) => {
                    const nombre = emp['NOMBRE / APELLIDOS'] || emp.nombre || emp.NOMBRE || 'Sin nombre';
                    const email = emp['CORREO ELECTRONICO'] || emp['CORREO ELECTRONIC'] || emp.email || emp.EMAIL || '';
                    const codigo = emp.CODIGO || emp.codigo || '';
                    return (
                      <div
                        key={index}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setEmployeeSearch(nombre);
                          setShowEmployeeDropdown(false);
                        }}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                      >
                        <div className="font-medium text-gray-800">{nombre}</div>
                        <div className="text-sm text-gray-500">{email}</div>
                        {codigo && <div className="text-xs text-gray-400">Código: {codigo}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedEmployee && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800">
                  ✅ Seleccionado: {selectedEmployee['NOMBRE / APELLIDOS'] || selectedEmployee.nombre || selectedEmployee.NOMBRE}
                </div>
                <div className="text-xs text-green-600">
                  {selectedEmployee['CORREO ELECTRONICO'] || selectedEmployee['CORREO ELECTRONIC'] || selectedEmployee.email || selectedEmployee.EMAIL}
                </div>
              </div>
            )}
          </div>

          {/* Selector perioadă */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio:
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin:
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                className="w-full"
              />
            </div>
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowExportModal(false);
                setSelectedEmployee(null);
                setEmployeeSearch('');
                setDateFrom('');
                setDateTo('');
                setExportedLogs([]);
              }}
              disabled={exportLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportLogs}
              disabled={exportLoading || !selectedEmployee || !dateFrom || !dateTo}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </>
              ) : (
                '📥 Exportar Logs'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 