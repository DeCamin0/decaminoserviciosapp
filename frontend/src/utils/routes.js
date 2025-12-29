// Pentru development folosim backend-ul NestJS local, pentru production backend-ul de pe VPS
const BACKEND_DEV_URL = 'http://localhost:3000';
const BACKEND_PROD_URL = 'https://api.decaminoservicios.com';
export const BASE_URL = import.meta.env.DEV 
  ? BACKEND_DEV_URL  // Development: folosește backend NestJS local
  : BACKEND_PROD_URL; // Production: folosește backend NestJS de pe VPS

console.log('🔧 BASE_URL value:', BASE_URL);
console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
console.log('🔧 Using backend proxy in dev:', import.meta.env.DEV ? 'YES' : 'NO');

// Helper function pentru a construi URL-uri din endpoint-uri
export const getN8nUrl = (endpoint) => {
  // În development, toate request-urile merg prin backend local (localhost:3000)
  // În production, merg prin backend de pe VPS (api.decaminoservicios.com)
  // Backend-ul face proxy către n8n cu rate limiting și backoff
  return `${BASE_URL}/api/n8n${endpoint}`;
};

export const routes = {
  // Authentication & Users
  login: import.meta.env.DEV 
    ? 'http://localhost:3000/api/auth/login'
    : 'https://api.decaminoservicios.com/api/auth/login',
  me: import.meta.env.DEV
    ? 'http://localhost:3000/api/me'
    : 'https://api.decaminoservicios.com/api/me',
  permissions: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : 'https://api.decaminoservicios.com/api/permissions',
  getEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : 'https://api.decaminoservicios.com/api/empleados',
  getEmpleadoMe: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/me'
    : 'https://api.decaminoservicios.com/api/empleados/me',
  getEstadisticasEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas'
    : 'https://api.decaminoservicios.com/api/empleados/estadisticas',
  exportEstadisticasEmpleadosExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas/export-excel'
    : 'https://api.decaminoservicios.com/api/empleados/estadisticas/export-excel',
  exportEstadisticasEmpleadosPDF: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas/export-pdf'
    : 'https://api.decaminoservicios.com/api/empleados/estadisticas/export-pdf',
  updateUser: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : 'https://api.decaminoservicios.com/api/empleados',
  updateNombreSplit: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/empleados/${codigo}/nombre-split`
    : `https://api.decaminoservicios.com/api/empleados/${codigo}/nombre-split`,
  // Acceptă multipart/form-data cu PDF și toate câmpurile empleado
  addUser: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : 'https://api.decaminoservicios.com/api/empleados',
  retrimiteFicha: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/retrimite-ficha'
    : 'https://api.decaminoservicios.com/api/empleados/retrimite-ficha',
  
  // Scheduled Messages (Mesaje Automate)
  getScheduledMessages: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages'
    : 'https://api.decaminoservicios.com/api/scheduled-messages',
  createScheduledMessage: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages'
    : 'https://api.decaminoservicios.com/api/scheduled-messages',
  updateScheduledMessage: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}`
    : `https://api.decaminoservicios.com/api/scheduled-messages/${id}`,
  deleteScheduledMessage: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}`
    : `https://api.decaminoservicios.com/api/scheduled-messages/${id}`,
  testTriggerScheduledMessages: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages/test-trigger'
    : 'https://api.decaminoservicios.com/api/scheduled-messages/test-trigger',
  getScheduledMessageRecipients: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}/recipients`
    : `https://api.decaminoservicios.com/api/scheduled-messages/${id}/recipients`,
  
  // Gestoría Nóminas
  getGestoriaStats: (ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/stats?ano=${ano}`
    : `https://api.decaminoservicios.com/api/gestoria/stats?ano=${ano}`,
  getGestoriaEmpleados: (ano, options = {}) => {
    const params = new URLSearchParams({ ano: ano.toString() });
    if (options.pendientes) params.append('pendientes', '1');
    if (options.q) params.append('q', options.q);
    if (options.centro) params.append('centro', options.centro);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/gestoria/empleados?${params}`
      : `https://api.decaminoservicios.com/api/gestoria/empleados?${params}`;
  },
  getGestoriaNominas: (employeeNombre, mes, ano) => {
    const params = new URLSearchParams({ employeeNombre });
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    return import.meta.env.DEV
      ? `http://localhost:3000/api/gestoria/nominas?${params}`
      : `https://api.decaminoservicios.com/api/gestoria/nominas?${params}`;
  },
  uploadGestoriaNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/nominas/upload'
    : 'https://api.decaminoservicios.com/api/gestoria/nominas/upload',
  uploadGestoriaBulk: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/nominas/upload-bulk'
    : 'https://api.decaminoservicios.com/api/gestoria/nominas/upload-bulk',
  downloadGestoriaNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/nominas/${id}/download`
    : `https://api.decaminoservicios.com/api/gestoria/nominas/${id}/download`,
  deleteGestoriaNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/nominas/${id}`
    : `https://api.decaminoservicios.com/api/gestoria/nominas/${id}`,
  uploadCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/upload'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/upload',
  getCostePersonal: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal?mes=${mes}&ano=${ano}`
    : `https://api.decaminoservicios.com/api/gestoria/coste-personal?mes=${mes}&ano=${ano}`,
  saveCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal',
  saveCostePersonalFromExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/save-from-excel'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/save-from-excel',
  updateCostePersonalField: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/${id}/field`
    : `https://api.decaminoservicios.com/api/gestoria/coste-personal/${id}/field`,
  poblarCostePersonalDesdeNominas: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/poblar-desde-nominas'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/poblar-desde-nominas',
  uploadPDFsParaCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/upload-pdfs'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/upload-pdfs',
  saveCostePersonalFromPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/save-from-preview'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/save-from-preview',
  limpiarCostePersonalMes: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/limpiar-mes'
    : 'https://api.decaminoservicios.com/api/gestoria/coste-personal/limpiar-mes',
  exportCostePersonalExcel: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/export-excel?mes=${mes}&ano=${ano}`
    : `https://api.decaminoservicios.com/api/gestoria/coste-personal/export-excel?mes=${mes}&ano=${ano}`,
  exportCostePersonalPDF: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/export-pdf?mes=${mes}&ano=${ano}`
    : `https://api.decaminoservicios.com/api/gestoria/coste-personal/export-pdf?mes=${mes}&ano=${ano}`,
  buscarEmpleadoPorNombre: (nombre) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/buscar-empleado?nombre=${encodeURIComponent(nombre)}`
    : `https://api.decaminoservicios.com/api/gestoria/coste-personal/buscar-empleado?nombre=${encodeURIComponent(nombre)}`,
  cambioAprobacion: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/cambio-aprobacion'
    : 'https://api.decaminoservicios.com/api/empleados/cambio-aprobacion',
  
  // Fichajes (Time tracking)
  getFichajes: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/all'
    : 'https://api.decaminoservicios.com/api/registros/all',
  getRegistros: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : 'https://api.decaminoservicios.com/api/registros',
  getRegistrosEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/empleados'
    : 'https://api.decaminoservicios.com/api/registros/empleados',
  getRegistrosPeriodo: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/periodo'
    : 'https://api.decaminoservicios.com/api/registros/periodo',
  addFichaje: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : 'https://api.decaminoservicios.com/api/registros',
  updateFichaje: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : 'https://api.decaminoservicios.com/api/registros',
  deleteFichaje: `${BASE_URL}/api/registros`,
  
  // Cuadrantes (Schedules)
  getCuadrantes: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes'
    : 'https://api.decaminoservicios.com/api/cuadrantes',
  saveCuadrante: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/save'
    : 'https://api.decaminoservicios.com/api/cuadrantes/save',
  updateCuadrantes: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/update'
    : 'https://api.decaminoservicios.com/api/cuadrantes/update',
  
  // Solicitudes (Requests)
  // Folosește GET pentru listare, POST cu accion: 'create'/'update'/'delete' pentru modificări
  getSolicitudesByEmail: import.meta.env.DEV
    ? 'http://localhost:3000/api/solicitudes'
    : 'https://api.decaminoservicios.com/api/solicitudes',
  
  // Vacaciones (Vacations & Asuntos Propios)
  getVacacionesSaldo: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/saldo'
    : 'https://api.decaminoservicios.com/api/vacaciones/saldo',
  getVacacionesSaldoEmpleado: (empleadoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/vacaciones/saldo/${empleadoId}`
    : `https://api.decaminoservicios.com/api/vacaciones/saldo/${empleadoId}`,
  getVacacionesEstadisticas: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas'
    : 'https://api.decaminoservicios.com/api/vacaciones/estadisticas',
  exportVacacionesEstadisticasExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas/export-excel'
    : 'https://api.decaminoservicios.com/api/vacaciones/estadisticas/export-excel',
  exportVacacionesEstadisticasPDF: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas/export-pdf'
    : 'https://api.decaminoservicios.com/api/vacaciones/estadisticas/export-pdf',
  updateVacacionesRestantesAnoAnterior: (empleadoId) =>
    import.meta.env.DEV
      ? `http://localhost:3000/api/vacaciones/restantes-ano-anterior/${empleadoId}`
      : `https://api.decaminoservicios.com/api/vacaciones/restantes-ano-anterior/${empleadoId}`,
  
  uploadBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : 'https://api.decaminoservicios.com/api/bajas-medicas',
  getBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : 'https://api.decaminoservicios.com/api/bajas-medicas',
  updateBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : 'https://api.decaminoservicios.com/api/bajas-medicas',
  
  // Documentos
  getNominas: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas'
    : 'https://api.decaminoservicios.com/api/nominas',
  downloadNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/download'
    : 'https://api.decaminoservicios.com/api/nominas/download',
  previewNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/nominas/${id}/preview`
    : `https://api.decaminoservicios.com/api/nominas/${id}/preview`,
  getNominasAccesos: (nominaId) => import.meta.env.DEV
    ? (nominaId ? `http://localhost:3000/api/nominas/${nominaId}/accesos` : 'http://localhost:3000/api/nominas/accesos')
    : (nominaId ? `https://api.decaminoservicios.com/api/nominas/${nominaId}/accesos` : 'https://api.decaminoservicios.com/api/nominas/accesos'),
  sendNominaByEmail: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/nominas/${id}/send-email`
    : `https://api.decaminoservicios.com/api/nominas/${id}/send-email`,
  deleteNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/delete'
    : 'https://api.decaminoservicios.com/api/nominas/delete',
  uploadNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/upload'
    : 'https://api.decaminoservicios.com/api/nominas/upload',
  uploadDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/upload'
    : 'https://api.decaminoservicios.com/api/documentos/upload',
  uploadDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/upload'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales/upload',
  getDocumentosOficiales: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales',
  downloadDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/download'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales/download',
  deleteDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/delete'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales/delete',
  deleteDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/delete'
    : 'https://api.decaminoservicios.com/api/documentos/delete',
  guardarDocumentoSemnat: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/save-signed'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales/save-signed',
  getDocumentos: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos'
    : 'https://api.decaminoservicios.com/api/documentos',
  downloadDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/download'
    : 'https://api.decaminoservicios.com/api/documentos/download',
  
  // Avatares empleados
  getAvatar: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar'
    : 'https://api.decaminoservicios.com/api/avatar',
  getAvatarMe: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar/me'
    : 'https://api.decaminoservicios.com/api/avatar/me',
  getAvatarBulk: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar/bulk'
    : 'https://api.decaminoservicios.com/api/avatar/bulk',
  
  // Monthly Alerts
  getMonthlyAlerts: import.meta.env.DEV
    ? 'http://localhost:3000/api/monthly-alerts'
    : 'https://api.decaminoservicios.com/api/monthly-alerts',
  getMonthlyAlertsResumen: import.meta.env.DEV
    ? 'http://localhost:3000/api/monthly-alerts/resumen'
    : 'https://api.decaminoservicios.com/api/monthly-alerts/resumen',
  
  // Notificaciones
  sendNotificacion: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/send-email'
    : 'https://api.decaminoservicios.com/api/empleados/send-email',
  
  // Estadisticas
  getTargetOreGrupo: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-asignadas'
    : 'https://api.decaminoservicios.com/api/horas-asignadas',
  getHorasPermitidas: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-permitidas'
    : 'https://api.decaminoservicios.com/api/horas-permitidas',
  getHorasTrabajadas: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-trabajadas'
    : 'https://api.decaminoservicios.com/api/horas-trabajadas',
  getEstadisticas: import.meta.env.DEV
    ? 'http://localhost:3000/api/estadisticas'
    : 'https://api.decaminoservicios.com/api/estadisticas',
  
  // Inspecciones (Inspections)
  getMisInspecciones: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : 'https://api.decaminoservicios.com/api/inspecciones',
  // GET /api/inspecciones -> lista completă pentru manageri/supervizori
  getInspecciones: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : 'https://api.decaminoservicios.com/api/inspecciones',
  addInspeccion: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : 'https://api.decaminoservicios.com/api/inspecciones',
  getInspectionPDF: '/api/inspections',
  downloadInspectionDocument: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones/download'
    : 'https://api.decaminoservicios.com/api/inspecciones/download',
  
  // Clientes (Clients)
  getClientes: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes'
    : 'https://api.decaminoservicios.com/api/clientes',
  // POST cu action: 'add'|'edit'|'delete'
  crudCliente: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes'
    : 'https://api.decaminoservicios.com/api/clientes',
  getProveedores: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/proveedores'
    : 'https://api.decaminoservicios.com/api/clientes/proveedores',
  // POST cu action: 'add'|'edit'|'delete'
  crudProveedor: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/proveedores'
    : 'https://api.decaminoservicios.com/api/clientes/proveedores',
  // GET /api/clientes/:nif/contracts
  getContratosCliente: (nif) => import.meta.env.DEV
    ? `http://localhost:3000/api/clientes/${encodeURIComponent(nif)}/contracts`
    : `https://api.decaminoservicios.com/api/clientes/${encodeURIComponent(nif)}/contracts`,
  // POST /api/clientes/contracts cu action: 'upload'|'delete'
  crudContract: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/contracts'
    : 'https://api.decaminoservicios.com/api/clientes/contracts',
  getContractTypes: import.meta.env.DEV
    ? 'http://localhost:3000/api/contract-types'
    : 'https://api.decaminoservicios.com/api/contract-types',
  // Lista de grupuri din tabelul grupos_referencia
  getGrupos: import.meta.env.DEV
    ? 'http://localhost:3000/api/grupos'
    : 'https://api.decaminoservicios.com/api/grupos',
  // Ausencias
  getAusencias: import.meta.env.DEV
    ? 'http://localhost:3000/api/ausencias'
    : 'https://api.decaminoservicios.com/api/ausencias',
  addAusencia: import.meta.env.DEV
    ? 'http://localhost:3000/api/ausencias'
    : 'https://api.decaminoservicios.com/api/ausencias',
  
  // Admin - Activity Logs
  logActivity: import.meta.env.DEV
    ? 'http://localhost:3000/api/activity-logs'
    : 'https://api.decaminoservicios.com/api/activity-logs',
  getActivityLog: import.meta.env.DEV
    ? 'http://localhost:3000/api/activity-logs'
    : 'https://api.decaminoservicios.com/api/activity-logs',
  getPermissionsAdmin: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : 'https://api.decaminoservicios.com/api/permissions',
  savePermissions: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : 'https://api.decaminoservicios.com/api/permissions',
  
  // Festivos (Zile Festive)
  getFestivos: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : 'https://api.decaminoservicios.com/api/festivos',
  editFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : 'https://api.decaminoservicios.com/api/festivos',
  createFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : 'https://api.decaminoservicios.com/api/festivos',
  deleteFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : 'https://api.decaminoservicios.com/api/festivos',
  
  // Aprobaciones (Approvals)
  getCambiosPendientes: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/cambios-pendientes'
    : 'https://api.decaminoservicios.com/api/empleados/cambios-pendientes',
  approveCambio: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/approve-cambio'
    : 'https://api.decaminoservicios.com/api/empleados/approve-cambio',
  rejectCambio: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/reject-cambio'
    : 'https://api.decaminoservicios.com/api/empleados/reject-cambio',
  
  // Chat AI - Backend NestJS (nou endpoint)
  chatAI: import.meta.env.DEV
    ? 'http://localhost:3000/api/assistant/message'
    : 'https://api.decaminoservicios.com/api/assistant/message',
  
  // Chat (REST API - backend NestJS)
  chatRooms: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms'
    : 'https://api.decaminoservicios.com/chat/rooms',
  chatColleagues: import.meta.env.DEV
    ? 'http://localhost:3000/chat/colleagues'
    : 'https://api.decaminoservicios.com/chat/colleagues',
  chatSupervisors: import.meta.env.DEV
    ? 'http://localhost:3000/chat/supervisors'
    : 'https://api.decaminoservicios.com/chat/supervisors',
  chatCreateSupervisorGroup: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/supervisor-group'
    : 'https://api.decaminoservicios.com/chat/rooms/supervisor-group',
  chatRoomPresence: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/chat/rooms/${roomId}/presence`;
  },
  chatMarkMessagesRead: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/chat/rooms/${roomId}/messages/read`;
  },
  chatRoomMessages: (roomId, after, limit) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    const params = new URLSearchParams();
    if (after) params.append('after', after);
    if (limit) params.append('limit', limit);
    return `${base}/chat/rooms/${roomId}/messages${params.toString() ? '?' + params.toString() : ''}`;
  },
  chatSendMessage: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/chat/rooms/${roomId}/messages`;
  },
  chatCreateCentro: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/centro'
    : 'https://api.decaminoservicios.com/chat/rooms/centro',
  chatCreateDM: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/dm'
    : 'https://api.decaminoservicios.com/chat/rooms/dm',
  chatDeleteRoom: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/chat/rooms/${roomId}`;
  },

  // Online users (presence) - pentru badge Online/Offline în Admin / Empleados
  getOnlineUsers: import.meta.env.DEV
    ? 'http://localhost:3000/api/online-users'
    : 'https://api.decaminoservicios.com/api/online-users',
  
  // AutoFirma Integration
  autofirmaWebhook: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/save-signed'
    : 'https://api.decaminoservicios.com/api/documentos-oficiales/save-signed',
  
  // Horarios (Schedules)
  // POST /api/horarios cu { action: "create"|"get"|"update"|"delete", payload: {...} }
  // GET /api/horarios pentru listarea tuturor horarios
  getHorarios: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios'
    : 'https://api.decaminoservicios.com/api/horarios',
  
  // Catalogo (Product Catalog)
  getCatalogo: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : 'https://api.decaminoservicios.com/api/catalogo',
  addProducto: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : 'https://api.decaminoservicios.com/api/catalogo',
  editDeleteProducto: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : 'https://api.decaminoservicios.com/api/catalogo',
  savePermisos: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo/permisos'
    : 'https://api.decaminoservicios.com/api/catalogo/permisos',
  
  // Pedidos (Orders)
  savePedido: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos'
    : 'https://api.decaminoservicios.com/api/pedidos',
  
  // Sent Emails (Mensajes Enviados)
  getSentEmails: import.meta.env.DEV
    ? 'http://localhost:3000/api/sent-emails'
    : 'https://api.decaminoservicios.com/api/sent-emails',
  deleteSentEmail: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/${id}`
    : `https://api.decaminoservicios.com/api/sent-emails/${id}`,
  getSentEmailById: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/${id}`
    : `https://api.decaminoservicios.com/api/sent-emails/${id}`,
  sendEmail: import.meta.env.DEV
    ? 'http://localhost:3000/api/sent-emails/send'
    : 'https://api.decaminoservicios.com/api/sent-emails/send',
  downloadAttachment: (attachmentId) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/attachments/${attachmentId}`
    : `https://api.decaminoservicios.com/api/sent-emails/attachments/${attachmentId}`,
  
  // Geocoding - Autocompletare adrese
  searchAddresses: (query, limit = 5) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/api/geocoding/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  },
  getAddressFromCoords: (lat, lon) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://api.decaminoservicios.com';
    return `${base}/api/geocoding/address-from-coords?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  },
};
