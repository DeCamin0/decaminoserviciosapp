// Pentru development folosim backend-ul NestJS local, pentru production backend-ul de pe VPS
const BACKEND_DEV_URL = 'http://localhost:3000';
// Backward compatible: dacă VITE_API_URL lipsește, folosește valoarea veche
const BACKEND_PROD_URL = import.meta.env.VITE_API_URL || 'https://api.decaminoservicios.com';
export const BASE_URL = import.meta.env.DEV 
  ? BACKEND_DEV_URL  // Development: folosește backend NestJS local
  : BACKEND_PROD_URL; // Production: folosește backend NestJS de pe VPS (din env var sau default)

console.log('🔧 BASE_URL value:', BASE_URL);
console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL || '(not set - using default)');
console.log('🔧 BACKEND_PROD_URL:', BACKEND_PROD_URL);
console.log('🔧 Using backend proxy in dev:', import.meta.env.DEV ? 'YES' : 'NO');
console.log('🎨 VITE_PRIMARY_COLOR:', import.meta.env.VITE_PRIMARY_COLOR || '(not set)');

// Helper function pentru a construi URL-uri din endpoint-uri
export const getN8nUrl = (endpoint) => {
  // În development, toate request-urile merg prin backend local (localhost:3000)
  // În production, merg prin backend de pe VPS (api.decaminoservicios.com)
  // Backend-ul face proxy către n8n cu rate limiting și backoff
  return `${BASE_URL}/api/n8n${endpoint}`;
};

export const routes = {
  // Base URL pentru toate endpoint-urile
  baseUrl: import.meta.env.DEV
    ? 'http://localhost:3000'
    : BACKEND_PROD_URL,
  
  // Authentication & Users
  login: import.meta.env.DEV 
    ? 'http://localhost:3000/api/auth/login'
    : `${BACKEND_PROD_URL}/api/auth/login`,
  refresh: import.meta.env.DEV
    ? 'http://localhost:3000/api/auth/refresh'
    : `${BACKEND_PROD_URL}/api/auth/refresh`,
  me: import.meta.env.DEV
    ? 'http://localhost:3000/api/me'
    : `${BACKEND_PROD_URL}/api/me`,
  permissions: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : `${BACKEND_PROD_URL}/api/permissions`,
  getEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : `${BACKEND_PROD_URL}/api/empleados`,
  getEmpleadoMe: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/me'
    : `${BACKEND_PROD_URL}/api/empleados/me`,
  confirmarCertificadoHandicap: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/confirmar-certificado-handicap'
    : `${BACKEND_PROD_URL}/api/empleados/confirmar-certificado-handicap`,
  getEstadisticasEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas'
    : `${BACKEND_PROD_URL}/api/empleados/estadisticas`,
  exportEmployeeDocuments: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/empleados/${codigo}/export`
    : `${BACKEND_PROD_URL}/api/empleados/${codigo}/export`,
  exportAllEmployeesDocuments: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/export-all'
    : `${BACKEND_PROD_URL}/api/empleados/export-all`,
  getHallOfFame: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame'
    : `${BACKEND_PROD_URL}/api/hall-of-fame`,
  getHallOfFameLatestMonth: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/latest-month'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/latest-month`,
  getHallOfFameEmployee: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/hall-of-fame/${codigo}`
    : `${BACKEND_PROD_URL}/api/hall-of-fame/${codigo}`,
  calculateHallOfFame: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/calculate'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/calculate`,
  calculateHallOfFameEmployee: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/hall-of-fame/calculate/employee/${codigo}`
    : `${BACKEND_PROD_URL}/api/hall-of-fame/calculate/employee/${codigo}`,
  getPremios: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/premios'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/premios`,
  createPremio: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/premios'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/premios`,
  getHallOfFameTrimestral: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/trimestral'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/trimestral`,
  getHallOfFameTrimestralLatest: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/trimestral/latest'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/trimestral/latest`,
  calculateHallOfFameTrimestral: import.meta.env.DEV
    ? 'http://localhost:3000/api/hall-of-fame/trimestral/calculate'
    : `${BACKEND_PROD_URL}/api/hall-of-fame/trimestral/calculate`,
  exportEstadisticasEmpleadosExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas/export-excel'
    : `${BACKEND_PROD_URL}/api/empleados/estadisticas/export-excel`,
  exportEstadisticasEmpleadosPDF: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/estadisticas/export-pdf'
    : `${BACKEND_PROD_URL}/api/empleados/estadisticas/export-pdf`,
  updateUser: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : `${BACKEND_PROD_URL}/api/empleados`,
  changePassword: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/change-password'
    : `${BACKEND_PROD_URL}/api/empleados/change-password`,
  getPassword: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/empleados/get-password/${codigo}`
    : `${BACKEND_PROD_URL}/api/empleados/get-password/${codigo}`,
  resetPassword: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/empleados/reset-password/${codigo}`
    : `${BACKEND_PROD_URL}/api/empleados/reset-password/${codigo}`,
  updateNombreSplit: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/empleados/${codigo}/nombre-split`
    : `${BACKEND_PROD_URL}/api/empleados/${codigo}/nombre-split`,
  // Acceptă multipart/form-data cu PDF și toate câmpurile empleado
  addUser: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados'
    : `${BACKEND_PROD_URL}/api/empleados`,
  retrimiteFicha: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/retrimite-ficha'
    : `${BACKEND_PROD_URL}/api/empleados/retrimite-ficha`,
  actualizarIbanPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/iban/preview'
    : `${BACKEND_PROD_URL}/api/empleados/iban/preview`,
  actualizarIbanConfirmar: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/iban/confirmar'
    : `${BACKEND_PROD_URL}/api/empleados/iban/confirmar`,
  
  // Scheduled Messages (Mesaje Automate)
  getScheduledMessages: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages'
    : `${BACKEND_PROD_URL}/api/scheduled-messages`,
  createScheduledMessage: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages'
    : `${BACKEND_PROD_URL}/api/scheduled-messages`,
  updateScheduledMessage: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}`
    : `${BACKEND_PROD_URL}/api/scheduled-messages/${id}`,
  deleteScheduledMessage: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}`
    : `${BACKEND_PROD_URL}/api/scheduled-messages/${id}`,
  testTriggerScheduledMessages: import.meta.env.DEV
    ? 'http://localhost:3000/api/scheduled-messages/test-trigger'
    : `${BACKEND_PROD_URL}/api/scheduled-messages/test-trigger`,
  getScheduledMessageRecipients: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/scheduled-messages/${id}/recipients`
    : `${BACKEND_PROD_URL}/api/scheduled-messages/${id}/recipients`,
  
  // Gestoría Nóminas
  getGestoriaStats: (ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/stats?ano=${ano}`
    : `${BACKEND_PROD_URL}/api/gestoria/stats?ano=${ano}`,
  getGestoriaEmpleados: (ano, options = {}) => {
    const params = new URLSearchParams({ ano: ano.toString() });
    if (options.pendientes) params.append('pendientes', '1');
    if (options.q) params.append('q', options.q);
    if (options.centro) params.append('centro', options.centro);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/gestoria/empleados?${params}`
      : `${BACKEND_PROD_URL}/api/gestoria/empleados?${params}`;
  },
  getGestoriaNominas: (employeeNombre, mes, ano) => {
    const params = new URLSearchParams({ employeeNombre });
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    return import.meta.env.DEV
      ? `http://localhost:3000/api/gestoria/nominas?${params}`
      : `${BACKEND_PROD_URL}/api/gestoria/nominas?${params}`;
  },
  uploadGestoriaNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/nominas/upload'
    : `${BACKEND_PROD_URL}/api/gestoria/nominas/upload`,
  uploadGestoriaBulk: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/nominas/upload-bulk'
    : `${BACKEND_PROD_URL}/api/gestoria/nominas/upload-bulk`,
  downloadGestoriaNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/nominas/${id}/download`
    : `${BACKEND_PROD_URL}/api/gestoria/nominas/${id}/download`,
  deleteGestoriaNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/nominas/${id}`
    : `${BACKEND_PROD_URL}/api/gestoria/nominas/${id}`,
  uploadCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/upload'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/upload`,
  getCostePersonal: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal?mes=${mes}&ano=${ano}`
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal?mes=${mes}&ano=${ano}`,
  saveCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal`,
  saveCostePersonalFromExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/save-from-excel'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/save-from-excel`,
  updateCostePersonalField: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/${id}/field`
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/${id}/field`,
  poblarCostePersonalDesdeNominas: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/poblar-desde-nominas'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/poblar-desde-nominas`,
  uploadPDFsParaCostePersonal: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/upload-pdfs'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/upload-pdfs`,
  saveCostePersonalFromPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/save-from-preview'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/save-from-preview`,
  limpiarCostePersonalMes: import.meta.env.DEV
    ? 'http://localhost:3000/api/gestoria/coste-personal/limpiar-mes'
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/limpiar-mes`,
  exportCostePersonalExcel: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/export-excel?mes=${mes}&ano=${ano}`
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/export-excel?mes=${mes}&ano=${ano}`,
  exportCostePersonalPDF: (mes, ano) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/export-pdf?mes=${mes}&ano=${ano}`
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/export-pdf?mes=${mes}&ano=${ano}`,
  buscarEmpleadoPorNombre: (nombre) => import.meta.env.DEV
    ? `http://localhost:3000/api/gestoria/coste-personal/buscar-empleado?nombre=${encodeURIComponent(nombre)}`
    : `${BACKEND_PROD_URL}/api/gestoria/coste-personal/buscar-empleado?nombre=${encodeURIComponent(nombre)}`,
  cambioAprobacion: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/cambio-aprobacion'
    : `${BACKEND_PROD_URL}/api/empleados/cambio-aprobacion`,
  
  // Fichajes (Time tracking)
  getFichajes: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/all'
    : `${BACKEND_PROD_URL}/api/registros/all`,
  getRegistros: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : `${BACKEND_PROD_URL}/api/registros`,
  getUltimoRegistro: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/ultimo'
    : `${BACKEND_PROD_URL}/api/registros/ultimo`,
  getRegistrosEmpleados: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/empleados'
    : `${BACKEND_PROD_URL}/api/registros/empleados`,
  getRegistrosPeriodo: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/periodo'
    : `${BACKEND_PROD_URL}/api/registros/periodo`,
  addFichaje: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : `${BACKEND_PROD_URL}/api/registros`,
  updateFichaje: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros'
    : `${BACKEND_PROD_URL}/api/registros`,
  deleteFichaje: `${BASE_URL}/api/registros`,
  confirmarJornada: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/confirmar-jornada'
    : `${BACKEND_PROD_URL}/api/registros/confirmar-jornada`,
  checkConfirmation: (codigo, fecha) => import.meta.env.DEV
    ? `http://localhost:3000/api/registros/check-confirmation/${codigo}/${fecha}`
    : `${BACKEND_PROD_URL}/api/registros/check-confirmation/${codigo}/${fecha}`,
  getRegularizacionesPendientes: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/regularizaciones/pendientes'
    : `${BACKEND_PROD_URL}/api/registros/regularizaciones/pendientes`,
  getRegularizacionesConfirmed: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/regularizaciones/confirmed'
    : `${BACKEND_PROD_URL}/api/registros/regularizaciones/confirmed`,
  aprobarRegularizacion: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/registros/regularizaciones/${id}/aprobar`
    : `${BACKEND_PROD_URL}/api/registros/regularizaciones/${id}/aprobar`,
  rechazarRegularizacion: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/registros/regularizaciones/${id}/rechazar`
    : `${BACKEND_PROD_URL}/api/registros/regularizaciones/${id}/rechazar`,
  requestRegularizacion: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/request-regularizacion'
    : `${BACKEND_PROD_URL}/api/registros/request-regularizacion`,
  getNoPunchDays: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString();
    return import.meta.env.DEV
      ? `http://localhost:3000/api/registros/no-punch${query ? `?${query}` : ''}`
      : `${BACKEND_PROD_URL}/api/registros/no-punch${query ? `?${query}` : ''}`;
  },
  declararNoPunch: import.meta.env.DEV
    ? 'http://localhost:3000/api/registros/no-punch/declare'
    : `${BACKEND_PROD_URL}/api/registros/no-punch/declare`,
  
  // Email Ingestion (Admin only)
  ingestEmails: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/ingest-emails'
    : `${BACKEND_PROD_URL}/admin/documents/ingest-emails`,
  previewEmails: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/preview-emails'
    : `${BACKEND_PROD_URL}/admin/documents/preview-emails`,
  saveSelectedDocuments: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/save-selected'
    : `${BACKEND_PROD_URL}/admin/documents/save-selected`,
  // Folder Ingestion (Admin only)
  previewFolder: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/preview-folder'
    : `${BACKEND_PROD_URL}/admin/documents/preview-folder`,
  saveFolderDocuments: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/save-folder-documents'
    : `${BACKEND_PROD_URL}/admin/documents/save-folder-documents`,
  getPendingDocuments: import.meta.env.DEV
    ? 'http://localhost:3000/admin/documents/pending'
    : `${BACKEND_PROD_URL}/admin/documents/pending`,
  approveDocument: (id) => import.meta.env.DEV
    ? `http://localhost:3000/admin/documents/${id}/approve`
    : `${BACKEND_PROD_URL}/admin/documents/${id}/approve`,
  rejectDocument: (id) => import.meta.env.DEV
    ? `http://localhost:3000/admin/documents/${id}/reject`
    : `${BACKEND_PROD_URL}/admin/documents/${id}/reject`,
  reassignDocument: (id) => import.meta.env.DEV
    ? `http://localhost:3000/admin/documents/${id}/reassign`
    : `${BACKEND_PROD_URL}/admin/documents/${id}/reassign`,

  // Cuadrantes (Schedules)
  getCuadrantes: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes'
    : `${BACKEND_PROD_URL}/api/cuadrantes`,
  saveCuadrante: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/save'
    : `${BACKEND_PROD_URL}/api/cuadrantes/save`,
  updateCuadrantes: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/update'
    : `${BACKEND_PROD_URL}/api/cuadrantes/update`,
  toggleCuadranteVisible: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/toggle-visible'
    : `${BACKEND_PROD_URL}/api/cuadrantes/toggle-visible`,
  uploadCuadrantesExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/upload-excel'
    : `${BACKEND_PROD_URL}/api/cuadrantes/upload-excel`,
  
  // Horarios Multicentro
  getHorarioMulticentro: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios/multicentro'
    : `${BACKEND_PROD_URL}/api/horarios/multicentro`,
  uploadHorarioMulticentroExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios/upload-excel-multicentro'
    : `${BACKEND_PROD_URL}/api/horarios/upload-excel-multicentro`,
  saveHorariosMulticentro: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios/save-multicentro'
    : `${BACKEND_PROD_URL}/api/horarios/save-multicentro`,
  updateHorarioMulticentro: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios/multicentro'
    : `${BACKEND_PROD_URL}/api/horarios/multicentro`,
  getTurnosFromCuadrante: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios/multicentro/turnos-from-cuadrante'
    : `${BACKEND_PROD_URL}/api/horarios/multicentro/turnos-from-cuadrante`,
  checkExistingCuadrante: import.meta.env.DEV
    ? 'http://localhost:3000/api/cuadrantes/check-existing'
    : `${BACKEND_PROD_URL}/api/cuadrantes/check-existing`,
  
  // Solicitudes (Requests)
  // Folosește GET pentru listare, POST cu accion: 'create'/'update'/'delete' pentru modificări
  getSolicitudesByEmail: import.meta.env.DEV
    ? 'http://localhost:3000/api/solicitudes'
    : `${BACKEND_PROD_URL}/api/solicitudes`,
  
  // Vacaciones (Vacations & Asuntos Propios)
  getVacacionesSaldo: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/saldo'
    : `${BACKEND_PROD_URL}/api/vacaciones/saldo`,
  getVacacionesSaldoEmpleado: (empleadoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/vacaciones/saldo/${empleadoId}`
    : `${BACKEND_PROD_URL}/api/vacaciones/saldo/${empleadoId}`,
  getVacacionesEstadisticas: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas'
    : `${BACKEND_PROD_URL}/api/vacaciones/estadisticas`,
  exportVacacionesEstadisticasExcel: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas/export-excel'
    : `${BACKEND_PROD_URL}/api/vacaciones/estadisticas/export-excel`,
  exportVacacionesEstadisticasPDF: import.meta.env.DEV
    ? 'http://localhost:3000/api/vacaciones/estadisticas/export-pdf'
    : `${BACKEND_PROD_URL}/api/vacaciones/estadisticas/export-pdf`,
  updateVacacionesRestantesAnoAnterior: (empleadoId) =>
    import.meta.env.DEV
      ? `http://localhost:3000/api/vacaciones/restantes-ano-anterior/${empleadoId}`
      : `${BACKEND_PROD_URL}/api/vacaciones/restantes-ano-anterior/${empleadoId}`,
  updateVacacionesAnualesPersonalizadas: (empleadoId) =>
    import.meta.env.DEV
      ? `http://localhost:3000/api/vacaciones/anuales-personalizadas/${empleadoId}`
      : `${BACKEND_PROD_URL}/api/vacaciones/anuales-personalizadas/${empleadoId}`,
  updateAsuntosPropiosAnualesPersonalizadas: (empleadoId) =>
    import.meta.env.DEV
      ? `http://localhost:3000/api/vacaciones/asuntos-propios-anuales-personalizadas/${empleadoId}`
      : `${BACKEND_PROD_URL}/api/vacaciones/asuntos-propios-anuales-personalizadas/${empleadoId}`,
  
  uploadBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : `${BACKEND_PROD_URL}/api/bajas-medicas`,
  getBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : `${BACKEND_PROD_URL}/api/bajas-medicas`,
  updateBajasMedicas: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas'
    : `${BACKEND_PROD_URL}/api/bajas-medicas`,
  deleteBajaMedica: (idCaso, idPosicion) => import.meta.env.DEV
    ? `http://localhost:3000/api/bajas-medicas/${encodeURIComponent(idCaso)}/${encodeURIComponent(idPosicion)}`
    : `${BACKEND_PROD_URL}/api/bajas-medicas/${encodeURIComponent(idCaso)}/${encodeURIComponent(idPosicion)}`,
  createBajaMedicaManual: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas/manual'
    : `${BACKEND_PROD_URL}/api/bajas-medicas/manual`,
  createBajaMedicaEmpleado: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas/empleado'
    : `${BACKEND_PROD_URL}/api/bajas-medicas/empleado`,
  resolveBajasMedicasConflicts: import.meta.env.DEV
    ? 'http://localhost:3000/api/bajas-medicas/resolve-conflicts'
    : `${BACKEND_PROD_URL}/api/bajas-medicas/resolve-conflicts`,
  
  // Documentos
  getNominas: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas'
    : `${BACKEND_PROD_URL}/api/nominas`,
  downloadNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/download'
    : `${BACKEND_PROD_URL}/api/nominas/download`,
  previewNomina: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/nominas/${id}/preview`
    : `${BACKEND_PROD_URL}/api/nominas/${id}/preview`,
  getNominasAccesos: (nominaId) => import.meta.env.DEV
    ? (nominaId ? `http://localhost:3000/api/nominas/${nominaId}/accesos` : 'http://localhost:3000/api/nominas/accesos')
    : (nominaId ? `${BACKEND_PROD_URL}/api/nominas/${nominaId}/accesos` : `${BACKEND_PROD_URL}/api/nominas/accesos`),
  sendNominaByEmail: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/nominas/${id}/send-email`
    : `${BACKEND_PROD_URL}/api/nominas/${id}/send-email`,
  deleteNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/delete'
    : `${BACKEND_PROD_URL}/api/nominas/delete`,
  uploadNomina: import.meta.env.DEV
    ? 'http://localhost:3000/api/nominas/upload'
    : `${BACKEND_PROD_URL}/api/nominas/upload`,
  uploadDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/upload'
    : `${BACKEND_PROD_URL}/api/documentos/upload`,
  uploadDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/upload'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/upload`,
  getDocumentosOficiales: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales`,
  downloadDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/download'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/download`,
  deleteDocumentoOficial: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/delete'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/delete`,
  updateDocumentoOficialVisibility: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales`,
  updateDocumentoOficialNecesitaFirma: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales`,
  marcarContratoComoFirmado: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales`,
  getEmpleadosConStatusContratos: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/empleados-contratos'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/empleados-contratos`,
  countDocumentosNecesitanFirma: (codigo) => import.meta.env.DEV
    ? `http://localhost:3000/api/documentos-oficiales/count-necesitan-firma?codigo=${codigo}`
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/count-necesitan-firma?codigo=${codigo}`,
  deleteDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/delete'
    : `${BACKEND_PROD_URL}/api/documentos/delete`,
  guardarDocumentoSemnat: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/save-signed'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/save-signed`,
  getDocumentos: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos'
    : `${BACKEND_PROD_URL}/api/documentos`,
  downloadDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos/download'
    : `${BACKEND_PROD_URL}/api/documentos/download`,
  // Documentos Solicitados
  getDocumentosSolicitados: (empleadoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/documentos-solicitados${empleadoId ? `?empleadoId=${empleadoId}` : ''}`
    : `${BACKEND_PROD_URL}/api/documentos-solicitados${empleadoId ? `?empleadoId=${empleadoId}` : ''}`,
  createDocumentoSolicitado: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-solicitados'
    : `${BACKEND_PROD_URL}/api/documentos-solicitados`,
  marcarDocumentoSolicitadoCompletado: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-solicitados/completar'
    : `${BACKEND_PROD_URL}/api/documentos-solicitados/completar`,
  
  // Avatares empleados
  getAvatar: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar'
    : `${BACKEND_PROD_URL}/api/avatar`,
  getAvatarMe: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar/me'
    : `${BACKEND_PROD_URL}/api/avatar/me`,
  getAvatarBulk: import.meta.env.DEV
    ? 'http://localhost:3000/api/avatar/bulk'
    : `${BACKEND_PROD_URL}/api/avatar/bulk`,
  
  // Monthly Alerts
  getMonthlyAlerts: import.meta.env.DEV
    ? 'http://localhost:3000/api/monthly-alerts'
    : `${BACKEND_PROD_URL}/api/monthly-alerts`,
  getMonthlyAlertsResumen: import.meta.env.DEV
    ? 'http://localhost:3000/api/monthly-alerts/resumen'
    : `${BACKEND_PROD_URL}/api/monthly-alerts/resumen`,
  
  // Notificaciones
  sendNotificacion: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/send-email'
    : `${BACKEND_PROD_URL}/api/empleados/send-email`,
  
  // Estadisticas
  getTargetOreGrupo: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-asignadas'
    : `${BACKEND_PROD_URL}/api/horas-asignadas`,
  getHorasPermitidas: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-permitidas'
    : `${BACKEND_PROD_URL}/api/horas-permitidas`,
  getHorasTrabajadas: import.meta.env.DEV
    ? 'http://localhost:3000/api/horas-trabajadas'
    : `${BACKEND_PROD_URL}/api/horas-trabajadas`,
  getEstadisticas: import.meta.env.DEV
    ? 'http://localhost:3000/api/estadisticas'
    : `${BACKEND_PROD_URL}/api/estadisticas`,
  
  // Inspecciones (Inspections)
  getMisInspecciones: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : `${BACKEND_PROD_URL}/api/inspecciones`,
  // GET /api/inspecciones -> lista completă pentru manageri/supervizori
  getInspecciones: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : `${BACKEND_PROD_URL}/api/inspecciones`,
  addInspeccion: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones'
    : `${BACKEND_PROD_URL}/api/inspecciones`,
  createSolicitudInspeccion: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones/solicitud'
    : `${BACKEND_PROD_URL}/api/inspecciones/solicitud`,
  getInspectionPDF: '/api/inspections',
  downloadInspectionDocument: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones/download'
    : `${BACKEND_PROD_URL}/api/inspecciones/download`,
  getMaterialesDocumentos: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones/materiales'
    : `${BACKEND_PROD_URL}/api/inspecciones/materiales`,
  downloadMaterialDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/inspecciones/materiales/download'
    : `${BACKEND_PROD_URL}/api/inspecciones/materiales/download`,
  
  // Clientes (Clients)
  getClientes: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes'
    : `${BACKEND_PROD_URL}/api/clientes`,
  // POST cu action: 'add'|'edit'|'delete'
  crudCliente: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes'
    : `${BACKEND_PROD_URL}/api/clientes`,
  getProveedores: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/proveedores'
    : `${BACKEND_PROD_URL}/api/clientes/proveedores`,
  // POST cu action: 'add'|'edit'|'delete'
  crudProveedor: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/proveedores'
    : `${BACKEND_PROD_URL}/api/clientes/proveedores`,
  // GET /api/clientes/:nif/contracts
  getContratosCliente: (nif) => import.meta.env.DEV
    ? `http://localhost:3000/api/clientes/${encodeURIComponent(nif)}/contracts`
    : `${BACKEND_PROD_URL}/api/clientes/${encodeURIComponent(nif)}/contracts`,
  // POST /api/clientes/contracts cu action: 'upload'|'delete'
  crudContract: import.meta.env.DEV
    ? 'http://localhost:3000/api/clientes/contracts'
    : `${BACKEND_PROD_URL}/api/clientes/contracts`,
  getContractTypes: import.meta.env.DEV
    ? 'http://localhost:3000/api/contract-types'
    : `${BACKEND_PROD_URL}/api/contract-types`,
  // Lista de grupuri din tabelul grupos_referencia
  getGrupos: import.meta.env.DEV
    ? 'http://localhost:3000/api/grupos'
    : `${BACKEND_PROD_URL}/api/grupos`,
  getGruposCompletos: import.meta.env.DEV
    ? 'http://localhost:3000/api/grupos/completos'
    : `${BACKEND_PROD_URL}/api/grupos/completos`,
  getGrupoById: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/grupos/${id}`
    : `${BACKEND_PROD_URL}/api/grupos/${id}`,
  createGrupo: import.meta.env.DEV
    ? 'http://localhost:3000/api/grupos'
    : `${BACKEND_PROD_URL}/api/grupos`,
  updateGrupo: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/grupos/${id}`
    : `${BACKEND_PROD_URL}/api/grupos/${id}`,
  deleteGrupo: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/grupos/${id}`
    : `${BACKEND_PROD_URL}/api/grupos/${id}`,
  
  // Plantillas de presupuesto
  getPlantillas: import.meta.env.DEV
    ? 'http://localhost:3000/api/plantillas'
    : `${BACKEND_PROD_URL}/api/plantillas`,
  getPlantilla: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/plantillas/${id}`
    : `${BACKEND_PROD_URL}/api/plantillas/${id}`,
  createPlantilla: import.meta.env.DEV
    ? 'http://localhost:3000/api/plantillas'
    : `${BACKEND_PROD_URL}/api/plantillas`,
  updatePlantilla: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/plantillas/${id}`
    : `${BACKEND_PROD_URL}/api/plantillas/${id}`,
  deletePlantilla: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/plantillas/${id}`
    : `${BACKEND_PROD_URL}/api/plantillas/${id}`,

  // Presupuestos guardados (guardar/cargar oferta completa)
  getPresupuestosGuardados: import.meta.env.DEV
    ? 'http://localhost:3000/api/presupuestos-guardados'
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados`,
  getPresupuestoGuardado: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}`,
  createPresupuestoGuardado: import.meta.env.DEV
    ? 'http://localhost:3000/api/presupuestos-guardados'
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados`,
  updatePresupuestoGuardado: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}`,
  deletePresupuestoGuardado: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}`,
  getPresupuestoGenerarDocumento: (id, format = 'docx') => (import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}/generar-documento`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}/generar-documento`) + (format ? `?format=${format}` : ''),
  getPresupuestoPdfFirmado: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}/pdf-firmado`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}/pdf-firmado`),
  enviarPresupuestoEmail: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/presupuestos-guardados/${id}/enviar-email`
    : `${BACKEND_PROD_URL}/api/presupuestos-guardados/${id}/enviar-email`),

  getInformesItems: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/items'
    : `${BACKEND_PROD_URL}/api/informes/items`,
  createInformesItem: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/items'
    : `${BACKEND_PROD_URL}/api/informes/items`,
  updateInformesItem: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/items/${id}`
    : `${BACKEND_PROD_URL}/api/informes/items/${id}`),
  getInformesFacturaConfig: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/factura-config'
    : `${BACKEND_PROD_URL}/api/informes/factura-config`,
  getInformesFacturaConfigList: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/factura-config/list'
    : `${BACKEND_PROD_URL}/api/informes/factura-config/list`,
  createInformeFacturaConfig: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/factura-config'
    : `${BACKEND_PROD_URL}/api/informes/factura-config`,
  updateInformesFacturaConfig: import.meta.env.DEV
    ? 'http://localhost:3000/api/informes/factura-config'
    : `${BACKEND_PROD_URL}/api/informes/factura-config`,
  getInformeById: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}`),
  updateInformeById: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}`),
  deleteInformeById: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}`),
  getInformePdf: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}/pdf`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}/pdf`),
  getInformePdfFirmado: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}/pdf-firmado`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}/pdf-firmado`),
  enviarInformeEmail: (id) => (import.meta.env.DEV
    ? `http://localhost:3000/api/informes/factura-config/${id}/enviar-email`
    : `${BACKEND_PROD_URL}/api/informes/factura-config/${id}/enviar-email`),

  // Ausencias
  getAusencias: import.meta.env.DEV
    ? 'http://localhost:3000/api/ausencias'
    : `${BACKEND_PROD_URL}/api/ausencias`,
  deleteAusencia: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}`,
  updateNoNecesitaJustificante: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/no-necesita-justificante`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/no-necesita-justificante`,
  updateAusenciaTipo: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/tipo`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/tipo`,
  recordarJustificante: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/recordar-justificante`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/recordar-justificante`,
  asociarAusencia: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/asociar`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/asociar`,
  marcarSinAusencia: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/marcar-sin-ausencia`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/marcar-sin-ausencia`,
  recalcularDuracion: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/recalcular-duracion`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/recalcular-duracion`,
  updateDuracion: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/ausencias/${id}/duracion`
    : `${BACKEND_PROD_URL}/api/ausencias/${id}/duracion`,
  addAusencia: import.meta.env.DEV
    ? 'http://localhost:3000/api/ausencias'
    : `${BACKEND_PROD_URL}/api/ausencias`,
  
  // Admin - Activity Logs
  logActivity: import.meta.env.DEV
    ? 'http://localhost:3000/api/activity-logs'
    : `${BACKEND_PROD_URL}/api/activity-logs`,
  getActivityLog: import.meta.env.DEV
    ? 'http://localhost:3000/api/activity-logs'
    : `${BACKEND_PROD_URL}/api/activity-logs`,
  getPermissionsAdmin: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : `${BACKEND_PROD_URL}/api/permissions`,
  savePermissions: import.meta.env.DEV
    ? 'http://localhost:3000/api/permissions'
    : `${BACKEND_PROD_URL}/api/permissions`,
  
  // Festivos (Zile Festive)
  getFestivos: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : `${BACKEND_PROD_URL}/api/festivos`,
  editFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : `${BACKEND_PROD_URL}/api/festivos`,
  createFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : `${BACKEND_PROD_URL}/api/festivos`,
  deleteFestivo: import.meta.env.DEV
    ? 'http://localhost:3000/api/festivos'
    : `${BACKEND_PROD_URL}/api/festivos`,
  
  // Aprobaciones (Approvals)
  getCambiosPendientes: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/cambios-pendientes'
    : `${BACKEND_PROD_URL}/api/empleados/cambios-pendientes`,
  approveCambio: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/approve-cambio'
    : `${BACKEND_PROD_URL}/api/empleados/approve-cambio`,
  rejectCambio: import.meta.env.DEV
    ? 'http://localhost:3000/api/empleados/reject-cambio'
    : `${BACKEND_PROD_URL}/api/empleados/reject-cambio`,
  
  // Chat AI - Backend NestJS (nou endpoint)
  chatAI: import.meta.env.DEV
    ? 'http://localhost:3000/api/assistant/message'
    : `${BACKEND_PROD_URL}/api/assistant/message`,
  
  // Chat (REST API - backend NestJS)
  chatRooms: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms'
    : `${BACKEND_PROD_URL}/chat/rooms`,
  chatColleagues: import.meta.env.DEV
    ? 'http://localhost:3000/chat/colleagues'
    : `${BACKEND_PROD_URL}/chat/colleagues`,
  chatSupervisors: import.meta.env.DEV
    ? 'http://localhost:3000/chat/supervisors'
    : `${BACKEND_PROD_URL}/chat/supervisors`,
  chatCreateSupervisorGroup: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/supervisor-group'
    : `${BACKEND_PROD_URL}/chat/rooms/supervisor-group`,
  chatRoomPresence: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/chat/rooms/${roomId}/presence`;
  },
  chatMarkMessagesRead: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/chat/rooms/${roomId}/messages/read`;
  },
  chatRoomMessages: (roomId, after, limit) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    const params = new URLSearchParams();
    if (after) params.append('after', after);
    if (limit) params.append('limit', limit);
    return `${base}/chat/rooms/${roomId}/messages${params.toString() ? '?' + params.toString() : ''}`;
  },
  chatSendMessage: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/chat/rooms/${roomId}/messages`;
  },
  chatCreateCentro: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/centro'
    : `${BACKEND_PROD_URL}/chat/rooms/centro`,
  chatCreateDM: import.meta.env.DEV
    ? 'http://localhost:3000/chat/rooms/dm'
    : `${BACKEND_PROD_URL}/chat/rooms/dm`,
  chatDeleteRoom: (roomId) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/chat/rooms/${roomId}`;
  },

  // Online users (presence) - pentru badge Online/Offline în Admin / Empleados
  getOnlineUsers: import.meta.env.DEV
    ? 'http://localhost:3000/api/online-users'
    : `${BACKEND_PROD_URL}/api/online-users`,
  
  // AutoFirma Integration
  autofirmaWebhook: import.meta.env.DEV
    ? 'http://localhost:3000/api/documentos-oficiales/save-signed'
    : `${BACKEND_PROD_URL}/api/documentos-oficiales/save-signed`,
  
  // Horarios (Schedules)
  // POST /api/horarios cu { action: "create"|"get"|"update"|"delete", payload: {...} }
  // GET /api/horarios pentru listarea tuturor horarios
  getHorarios: import.meta.env.DEV
    ? 'http://localhost:3000/api/horarios'
    : `${BACKEND_PROD_URL}/api/horarios`,
  
  // Catalogo (Product Catalog)
  getCatalogo: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : `${BACKEND_PROD_URL}/api/catalogo`,
  addProducto: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : `${BACKEND_PROD_URL}/api/catalogo`,
  editDeleteProducto: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo'
    : `${BACKEND_PROD_URL}/api/catalogo`,
  savePermisos: import.meta.env.DEV
    ? 'http://localhost:3000/api/catalogo/permisos'
    : `${BACKEND_PROD_URL}/api/catalogo/permisos`,
  
  // Pedidos (Orders)
  savePedido: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos'
    : `${BACKEND_PROD_URL}/api/pedidos`,
  getPedidos: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos'
    : `${BACKEND_PROD_URL}/api/pedidos`,
  getPedidoByUid: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/pedidos/${encodedUid}`
      : `${BACKEND_PROD_URL}/api/pedidos/${encodedUid}`;
  },
  updatePedidoEstado: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/pedidos/${encodedUid}/estado`
      : `${BACKEND_PROD_URL}/api/pedidos/${encodedUid}/estado`;
  },
  updatePedidoDireccionEnvio: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/pedidos/${encodedUid}/direccion-envio`
      : `${BACKEND_PROD_URL}/api/pedidos/${encodedUid}/direccion-envio`;
  },
  updatePedidoItems: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/pedidos/${encodedUid}/items`
      : `${BACKEND_PROD_URL}/api/pedidos/${encodedUid}/items`;
  },
  updatePedidoNotas: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/pedidos/${encodedUid}/notas`
      : `${BACKEND_PROD_URL}/api/pedidos/${encodedUid}/notas`;
  },
  enviarPedidosAprobados: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos/enviar-aprobados'
    : `${BACKEND_PROD_URL}/api/pedidos/enviar-aprobados`,
  generarExcelPedidos: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos/generar-excel'
    : `${BACKEND_PROD_URL}/api/pedidos/generar-excel`,
  deletePedido: (pedidoUid) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos/${encodeURIComponent(pedidoUid)}`
    : `${BACKEND_PROD_URL}/api/pedidos/${encodeURIComponent(pedidoUid)}`,
  
  // Pedidos Notas
  getPedidosNotas: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos-notas'
    : `${BACKEND_PROD_URL}/api/pedidos-notas`,
  getPedidosNota: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos-notas/${id}`
    : `${BACKEND_PROD_URL}/api/pedidos-notas/${id}`,
  createPedidosNota: import.meta.env.DEV
    ? 'http://localhost:3000/api/pedidos-notas'
    : `${BACKEND_PROD_URL}/api/pedidos-notas`,
  updatePedidosNota: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos-notas/${id}`
    : `${BACKEND_PROD_URL}/api/pedidos-notas/${id}`,
  deletePedidosNota: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos-notas/${id}`
    : `${BACKEND_PROD_URL}/api/pedidos-notas/${id}`,
  uploadPedidosNotaImagenes: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos-notas/${id}/imagenes`
    : `${BACKEND_PROD_URL}/api/pedidos-notas/${id}/imagenes`,
  deletePedidosNotaImagen: (imagenId) => import.meta.env.DEV
    ? `http://localhost:3000/api/pedidos-notas/imagenes/${imagenId}`
    : `${BACKEND_PROD_URL}/api/pedidos-notas/imagenes/${imagenId}`,
  
  // Sent Emails (Mensajes Enviados)
  getSentEmails: import.meta.env.DEV
    ? 'http://localhost:3000/api/sent-emails'
    : `${BACKEND_PROD_URL}/api/sent-emails`,
  deleteSentEmail: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/${id}`
    : `${BACKEND_PROD_URL}/api/sent-emails/${id}`,
  getSentEmailById: (id) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/${id}`
    : `${BACKEND_PROD_URL}/api/sent-emails/${id}`,
  sendEmail: import.meta.env.DEV
    ? 'http://localhost:3000/api/sent-emails/send'
    : `${BACKEND_PROD_URL}/api/sent-emails/send`,
  downloadAttachment: (attachmentId) => import.meta.env.DEV
    ? `http://localhost:3000/api/sent-emails/attachments/${attachmentId}`
    : `${BACKEND_PROD_URL}/api/sent-emails/attachments/${attachmentId}`,
  
  // Geocoding - Autocompletare adrese
  searchAddresses: (query, limit = 5) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/api/geocoding/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  },
  getAddressFromCoords: (lat, lon) => {
    const base = import.meta.env.DEV
      ? 'http://localhost:3000'
      : BACKEND_PROD_URL;
    return `${base}/api/geocoding/address-from-coords?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  },
  
  // PRL Documentos
  prlListarGrupos: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/grupos'
    : `${BACKEND_PROD_URL}/api/prl/grupos`,
  prlListarEmpleadosConDocumentos: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/empleados-con-documentos'
    : `${BACKEND_PROD_URL}/api/prl/empleados-con-documentos`,
  prlListarTemplates: (grupoNombre) => {
    const encoded = encodeURIComponent(grupoNombre);
    return import.meta.env.DEV
      ? `http://localhost:3000/api/prl/grupos/${encoded}/templates`
      : `${BACKEND_PROD_URL}/api/prl/grupos/${encoded}/templates`;
  },
  prlUploadZipPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/upload-zip-preview'
    : `${BACKEND_PROD_URL}/api/prl/upload-zip-preview`,
  prlUploadZipConfirmar: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/upload-zip-confirmar'
    : `${BACKEND_PROD_URL}/api/prl/upload-zip-confirmar`,
  prlUploadDocumento: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/upload-documento'
    : `${BACKEND_PROD_URL}/api/prl/upload-documento`,
  prlDescargarTemplate: (templateId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/templates/${templateId}/descargar`
    : `${BACKEND_PROD_URL}/api/prl/templates/${templateId}/descargar`,
  prlEliminarTemplate: (templateId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/templates/${templateId}`
    : `${BACKEND_PROD_URL}/api/prl/templates/${templateId}`,
  prlEliminarTodosTemplates: (grupoNombre) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/grupos/${encodeURIComponent(grupoNombre)}/templates`
    : `${BACKEND_PROD_URL}/api/prl/grupos/${encodeURIComponent(grupoNombre)}/templates`,
  prlEnviarDocumentosAGrupo: (grupoNombre) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/grupos/${encodeURIComponent(grupoNombre)}/enviar`
    : `${BACKEND_PROD_URL}/api/prl/grupos/${encodeURIComponent(grupoNombre)}/enviar`,
  prlMisDocumentos: import.meta.env.DEV
    ? 'http://localhost:3000/api/prl/mis-documentos'
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos`,
  prlDescargarMiDocumento: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/descargar`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/descargar`,
  prlConvertirDocxAHtml: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/convertir-docx-html`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/convertir-docx-html`,
  prlRenunciarRM: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/renunciar-rm`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/renunciar-rm`,
  prlSubirDocumentoFirmado: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/subir-firmado`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/subir-firmado`,
  prlAgregarFirmaADocx: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/agregar-firma-docx`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/agregar-firma-docx`,
  prlDescargarDocumentoFirmado: (documentoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/prl/mis-documentos/${documentoId}/descargar-firmado`
    : `${BACKEND_PROD_URL}/api/prl/mis-documentos/${documentoId}/descargar-firmado`,
  
  // Diplomas
  diplomasUploadZipPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/diplomas/upload-zip-preview'
    : `${BACKEND_PROD_URL}/api/diplomas/upload-zip-preview`,
  diplomasUploadZipConfirmar: import.meta.env.DEV
    ? 'http://localhost:3000/api/diplomas/upload-zip-confirmar'
    : `${BACKEND_PROD_URL}/api/diplomas/upload-zip-confirmar`,
  diplomasUploadPdfsPreview: import.meta.env.DEV
    ? 'http://localhost:3000/api/diplomas/upload-pdfs-preview'
    : `${BACKEND_PROD_URL}/api/diplomas/upload-pdfs-preview`,
  diplomasUploadPdfsConfirmar: import.meta.env.DEV
    ? 'http://localhost:3000/api/diplomas/upload-pdfs-confirmar'
    : `${BACKEND_PROD_URL}/api/diplomas/upload-pdfs-confirmar`,
  diplomasListarEmpleado: (empleadoId) => import.meta.env.DEV
    ? `http://localhost:3000/api/diplomas/empleado/${empleadoId}`
    : `${BACKEND_PROD_URL}/api/diplomas/empleado/${empleadoId}`,
  diplomasListarTodas: import.meta.env.DEV
    ? 'http://localhost:3000/api/diplomas/todas'
    : `${BACKEND_PROD_URL}/api/diplomas/todas`,
  diplomasDescargar: (diplomaId) => import.meta.env.DEV
    ? `http://localhost:3000/api/diplomas/${diplomaId}/descargar`
    : `${BACKEND_PROD_URL}/api/diplomas/${diplomaId}/descargar`,
};
