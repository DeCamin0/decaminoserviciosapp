// Config central din env.js (multi-client: BACKEND_BASE = 3002 pentru client2, 3000 pentru Decamino)
import { config } from '../config/env.js';

const BACKEND_BASE = config.BACKEND_BASE || '';
export const BASE_URL = BACKEND_BASE;

if (import.meta.env.DEV || config.DEBUG_MODE) {
  console.log('🔧 BASE_URL value:', BASE_URL);
  console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
  console.log('🔧 API_URL (from config):', config.API_URL);
  console.log('🎨 VITE_PRIMARY_COLOR:', config.PRIMARY_COLOR || '(not set)');
}

// Helper function pentru a construi URL-uri din endpoint-uri
export const getN8nUrl = (endpoint) => {
  // În development, toate request-urile merg prin backend local (localhost:3000)
  // În production, merg prin backend de pe VPS (api.decaminoservicios.com)
  // Backend-ul face proxy către n8n cu rate limiting și backoff
  return `${BASE_URL}/api/n8n${endpoint}`;
};

export const routes = {
  // Base URL pentru toate endpoint-urile (respectă config: client2 = 3001 în dev)
  baseUrl: BACKEND_BASE,

  // Authentication & Users
  login: `${BACKEND_BASE}/api/auth/login`,
  refresh: `${BACKEND_BASE}/api/auth/refresh`,
  me: `${BACKEND_BASE}/api/me`,
  permissions: `${BACKEND_BASE}/api/permissions`,

  /** Super-admin (Developer): tenant registry + DB provisioning */
  superAdminTenants: `${BACKEND_BASE}/api/super-admin/tenants`,
  superAdminTenant: (id) => `${BACKEND_BASE}/api/super-admin/tenants/${id}`,
  superAdminTenantLogs: (id) =>
    `${BACKEND_BASE}/api/super-admin/tenants/${id}/logs`,
  superAdminTenantRetry: (id) =>
    `${BACKEND_BASE}/api/super-admin/tenants/${id}/retry`,
  getEmpleados: `${BACKEND_BASE}/api/empleados`,
  /** Ámbito RRHH: grupos de empleado que puede gestionar un usuario (Admin/Developer). */
  empleadoGrupoScopeMe: `${BACKEND_BASE}/api/empleados/scope/me`,
  empleadoGrupoScopeUser: (codigo) =>
    `${BACKEND_BASE}/api/empleados/scope/${encodeURIComponent(codigo)}`,
  getEmpleadoMe: `${BACKEND_BASE}/api/empleados/me`,
  confirmarCertificadoHandicap: `${BACKEND_BASE}/api/empleados/confirmar-certificado-handicap`,
  getEstadisticasEmpleados: `${BACKEND_BASE}/api/empleados/estadisticas`,
  exportEmployeeDocuments: (codigo) => `${BACKEND_BASE}/api/empleados/${codigo}/export`,
  exportAllEmployeesDocuments: `${BACKEND_BASE}/api/empleados/export-all`,
  getHallOfFame: `${BACKEND_BASE}/api/hall-of-fame`,
  getHallOfFameLatestMonth: `${BACKEND_BASE}/api/hall-of-fame/latest-month`,
  getHallOfFameEmployee: (codigo) => `${BACKEND_BASE}/api/hall-of-fame/${codigo}`,
  calculateHallOfFame: `${BACKEND_BASE}/api/hall-of-fame/calculate`,
  calculateHallOfFameEmployee: (codigo) => `${BACKEND_BASE}/api/hall-of-fame/calculate/employee/${codigo}`,
  getPremios: `${BACKEND_BASE}/api/hall-of-fame/premios`,
  createPremio: `${BACKEND_BASE}/api/hall-of-fame/premios`,
  getHallOfFameTrimestral: `${BACKEND_BASE}/api/hall-of-fame/trimestral`,
  getHallOfFameTrimestralLatest: `${BACKEND_BASE}/api/hall-of-fame/trimestral/latest`,
  calculateHallOfFameTrimestral: `${BACKEND_BASE}/api/hall-of-fame/trimestral/calculate`,
  exportEstadisticasEmpleadosExcel: `${BACKEND_BASE}/api/empleados/estadisticas/export-excel`,
  exportEstadisticasEmpleadosPDF: `${BACKEND_BASE}/api/empleados/estadisticas/export-pdf`,
  updateUser: `${BACKEND_BASE}/api/empleados`,
  changePassword: `${BACKEND_BASE}/api/empleados/change-password`,
  getPassword: (codigo) => `${BACKEND_BASE}/api/empleados/get-password/${codigo}`,
  resetPassword: (codigo) => `${BACKEND_BASE}/api/empleados/reset-password/${codigo}`,
  updateNombreSplit: (codigo) => `${BACKEND_BASE}/api/empleados/${codigo}/nombre-split`,
  addUser: `${BACKEND_BASE}/api/empleados`,
  retrimiteFicha: `${BACKEND_BASE}/api/empleados/retrimite-ficha`,
  actualizarIbanPreview: `${BACKEND_BASE}/api/empleados/iban/preview`,
  actualizarIbanConfirmar: `${BACKEND_BASE}/api/empleados/iban/confirmar`,

  // Scheduled Messages (Mesaje Automate)
  getScheduledMessages: `${BACKEND_BASE}/api/scheduled-messages`,
  createScheduledMessage: `${BACKEND_BASE}/api/scheduled-messages`,
  updateScheduledMessage: (id) => `${BACKEND_BASE}/api/scheduled-messages/${id}`,
  deleteScheduledMessage: (id) => `${BACKEND_BASE}/api/scheduled-messages/${id}`,
  testTriggerScheduledMessages: `${BACKEND_BASE}/api/scheduled-messages/test-trigger`,
  getScheduledMessageRecipients: (id) => `${BACKEND_BASE}/api/scheduled-messages/${id}/recipients`,
  
  // Gestoría Nóminas
  getGestoriaStats: (ano) => `${BACKEND_BASE}/api/gestoria/stats?ano=${ano}`,
  getGestoriaEmpleados: (ano, options = {}) => {
    const params = new URLSearchParams({ ano: ano.toString() });
    if (options.pendientes) params.append('pendientes', '1');
    if (options.q) params.append('q', options.q);
    if (options.centro) params.append('centro', options.centro);
    return `${BACKEND_BASE}/api/gestoria/empleados?${params}`;
  },
  getGestoriaNominas: (employeeNombre, mes, ano) => {
    const params = new URLSearchParams({ employeeNombre });
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    return `${BACKEND_BASE}/api/gestoria/nominas?${params}`;
  },
  uploadGestoriaNomina: `${BACKEND_BASE}/api/gestoria/nominas/upload`,
  uploadGestoriaBulk: `${BACKEND_BASE}/api/gestoria/nominas/upload-bulk`,
  downloadGestoriaNomina: (id) => `${BACKEND_BASE}/api/gestoria/nominas/${id}/download`,
  deleteGestoriaNomina: (id) => `${BACKEND_BASE}/api/gestoria/nominas/${id}`,
  uploadCostePersonal: `${BACKEND_BASE}/api/gestoria/coste-personal/upload`,
  getCostePersonal: (mes, ano) => `${BACKEND_BASE}/api/gestoria/coste-personal?mes=${mes}&ano=${ano}`,
  saveCostePersonal: `${BACKEND_BASE}/api/gestoria/coste-personal`,
  saveCostePersonalFromExcel: `${BACKEND_BASE}/api/gestoria/coste-personal/save-from-excel`,
  updateCostePersonalField: (id) => `${BACKEND_BASE}/api/gestoria/coste-personal/${id}/field`,
  poblarCostePersonalDesdeNominas: `${BACKEND_BASE}/api/gestoria/coste-personal/poblar-desde-nominas`,
  uploadPDFsParaCostePersonal: `${BACKEND_BASE}/api/gestoria/coste-personal/upload-pdfs`,
  saveCostePersonalFromPreview: `${BACKEND_BASE}/api/gestoria/coste-personal/save-from-preview`,
  limpiarCostePersonalMes: `${BACKEND_BASE}/api/gestoria/coste-personal/limpiar-mes`,
  exportCostePersonalExcel: (mes, ano) => `${BACKEND_BASE}/api/gestoria/coste-personal/export-excel?mes=${mes}&ano=${ano}`,
  exportCostePersonalPDF: (mes, ano) => `${BACKEND_BASE}/api/gestoria/coste-personal/export-pdf?mes=${mes}&ano=${ano}`,
  buscarEmpleadoPorNombre: (nombre) => `${BACKEND_BASE}/api/gestoria/coste-personal/buscar-empleado?nombre=${encodeURIComponent(nombre)}`,
  cambioAprobacion: `${BACKEND_BASE}/api/empleados/cambio-aprobacion`,
  
  // Fichajes (Time tracking)
  getFichajes: `${BACKEND_BASE}/api/registros/all`,
  getRegistros: `${BACKEND_BASE}/api/registros`,
  getUltimoRegistro: `${BACKEND_BASE}/api/registros/ultimo`,
  getRegistrosEmpleados: `${BACKEND_BASE}/api/registros/empleados`,
  getRegistrosPeriodo: `${BACKEND_BASE}/api/registros/periodo`,
  addFichaje: `${BACKEND_BASE}/api/registros`,
  updateFichaje: `${BACKEND_BASE}/api/registros`,
  deleteFichaje: `${BASE_URL}/api/registros`,
  confirmarJornada: `${BACKEND_BASE}/api/registros/confirmar-jornada`,
  checkConfirmation: (codigo, fecha) => `${BACKEND_BASE}/api/registros/check-confirmation/${codigo}/${fecha}`,
  getRegularizacionesPendientes: `${BACKEND_BASE}/api/registros/regularizaciones/pendientes`,
  getRegularizacionesConfirmed: `${BACKEND_BASE}/api/registros/regularizaciones/confirmed`,
  aprobarRegularizacion: (id) => `${BACKEND_BASE}/api/registros/regularizaciones/${id}/aprobar`,
  rechazarRegularizacion: (id) => `${BACKEND_BASE}/api/registros/regularizaciones/${id}/rechazar`,
  requestRegularizacion: `${BACKEND_BASE}/api/registros/request-regularizacion`,
  getNoPunchDays: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString();
    return `${BACKEND_BASE}/api/registros/no-punch${query ? `?${query}` : ''}`;
  },
  declararNoPunch: `${BACKEND_BASE}/api/registros/no-punch/declare`,
  
  // Email Ingestion (Admin only)
  ingestEmails: `${BACKEND_BASE}/admin/documents/ingest-emails`,
  previewEmails: `${BACKEND_BASE}/admin/documents/preview-emails`,
  saveSelectedDocuments: `${BACKEND_BASE}/admin/documents/save-selected`,
  // Folder Ingestion (Admin only)
  previewFolder: `${BACKEND_BASE}/admin/documents/preview-folder`,
  saveFolderDocuments: `${BACKEND_BASE}/admin/documents/save-folder-documents`,
  getPendingDocuments: `${BACKEND_BASE}/admin/documents/pending`,
  approveDocument: (id) => `${BACKEND_BASE}/admin/documents/${id}/approve`,
  rejectDocument: (id) => `${BACKEND_BASE}/admin/documents/${id}/reject`,
  reassignDocument: (id) => `${BACKEND_BASE}/admin/documents/${id}/reassign`,

  // Cuadrantes (Schedules)
  getCuadrantes: `${BACKEND_BASE}/api/cuadrantes`,
  saveCuadrante: `${BACKEND_BASE}/api/cuadrantes/save`,
  updateCuadrantes: `${BACKEND_BASE}/api/cuadrantes/update`,
  toggleCuadranteVisible: `${BACKEND_BASE}/api/cuadrantes/toggle-visible`,
  uploadCuadrantesExcel: `${BACKEND_BASE}/api/cuadrantes/upload-excel`,
  
  // Horarios Multicentro
  getHorarioMulticentro: `${BACKEND_BASE}/api/horarios/multicentro`,
  uploadHorarioMulticentroExcel: `${BACKEND_BASE}/api/horarios/upload-excel-multicentro`,
  saveHorariosMulticentro: `${BACKEND_BASE}/api/horarios/save-multicentro`,
  updateHorarioMulticentro: `${BACKEND_BASE}/api/horarios/multicentro`,
  getTurnosFromCuadrante: `${BACKEND_BASE}/api/horarios/multicentro/turnos-from-cuadrante`,
  checkExistingCuadrante: `${BACKEND_BASE}/api/cuadrantes/check-existing`,
  
  // Solicitudes (Requests)
  // Folosește GET pentru listare, POST cu accion: 'create'/'update'/'delete' pentru modificări
  getSolicitudesByEmail: `${BACKEND_BASE}/api/solicitudes`,
  getVacationBlockedPeriods: `${BACKEND_BASE}/api/solicitudes/vacation-blocked-periods`,
  createVacationBlockedPeriod: `${BACKEND_BASE}/api/solicitudes/vacation-blocked-periods`,
  deleteVacationBlockedPeriod: (id) => `${BACKEND_BASE}/api/solicitudes/vacation-blocked-periods/${id}`,
  getAsuntoPropioBlockedPeriods: `${BACKEND_BASE}/api/solicitudes/asunto-propio-blocked-periods`,
  createAsuntoPropioBlockedPeriod: `${BACKEND_BASE}/api/solicitudes/asunto-propio-blocked-periods`,
  deleteAsuntoPropioBlockedPeriod: (id) =>
    `${BACKEND_BASE}/api/solicitudes/asunto-propio-blocked-periods/${id}`,
  getVacacionesDisponibilidadPorcentaje: `${BACKEND_BASE}/api/solicitudes/vacaciones-disponibilidad-porcentaje`,
  putVacacionesDisponibilidadPorcentaje: `${BACKEND_BASE}/api/solicitudes/vacaciones-disponibilidad-porcentaje`,
  getAsuntosPropiosMaxPorDia: `${BACKEND_BASE}/api/solicitudes/asuntos-propios-max-por-dia`,
  putAsuntosPropiosMaxPorDia: `${BACKEND_BASE}/api/solicitudes/asuntos-propios-max-por-dia`,
  
  // Vacaciones (Vacations & Asuntos Propios)
  getVacacionesSaldo: `${BACKEND_BASE}/api/vacaciones/saldo`,
  getVacacionesSaldoEmpleado: (empleadoId) => `${BACKEND_BASE}/api/vacaciones/saldo/${empleadoId}`,
  getVacacionesEstadisticas: `${BACKEND_BASE}/api/vacaciones/estadisticas`,
  exportVacacionesEstadisticasExcel: `${BACKEND_BASE}/api/vacaciones/estadisticas/export-excel`,
  exportVacacionesEstadisticasPDF: `${BACKEND_BASE}/api/vacaciones/estadisticas/export-pdf`,
  updateVacacionesRestantesAnoAnterior: (empleadoId) =>
    `${BACKEND_BASE}/api/vacaciones/restantes-ano-anterior/${empleadoId}`,
  updateVacacionesAnualesPersonalizadas: (empleadoId) =>
    `${BACKEND_BASE}/api/vacaciones/anuales-personalizadas/${empleadoId}`,
  updateAsuntosPropiosAnualesPersonalizadas: (empleadoId) =>
    `${BACKEND_BASE}/api/vacaciones/asuntos-propios-anuales-personalizadas/${empleadoId}`,
  
  uploadBajasMedicas: `${BACKEND_BASE}/api/bajas-medicas`,
  getBajasMedicas: `${BACKEND_BASE}/api/bajas-medicas`,
  updateBajasMedicas: `${BACKEND_BASE}/api/bajas-medicas`,
  deleteBajaMedica: (idCaso, idPosicion) => `${BACKEND_BASE}/api/bajas-medicas/${encodeURIComponent(idCaso)}/${encodeURIComponent(idPosicion)}`,
  createBajaMedicaManual: `${BACKEND_BASE}/api/bajas-medicas/manual`,
  createBajaMedicaEmpleado: `${BACKEND_BASE}/api/bajas-medicas/empleado`,
  resolveBajasMedicasConflicts: `${BACKEND_BASE}/api/bajas-medicas/resolve-conflicts`,
  
  // Documentos
  getNominas: `${BACKEND_BASE}/api/nominas`,
  downloadNomina: `${BACKEND_BASE}/api/nominas/download`,
  previewNomina: (id) => `${BACKEND_BASE}/api/nominas/${id}/preview`,
  getNominasAccesos: (nominaId) => (nominaId ? `${BACKEND_BASE}/api/nominas/${nominaId}/accesos` : `${BACKEND_BASE}/api/nominas/accesos`),
  sendNominaByEmail: (id) => `${BACKEND_BASE}/api/nominas/${id}/send-email`,
  deleteNomina: `${BACKEND_BASE}/api/nominas/delete`,
  uploadNomina: `${BACKEND_BASE}/api/nominas/upload`,
  uploadDocumento: `${BACKEND_BASE}/api/documentos/upload`,
  uploadDocumentoOficial: `${BACKEND_BASE}/api/documentos-oficiales/upload`,
  getDocumentosOficiales: `${BACKEND_BASE}/api/documentos-oficiales`,
  downloadDocumentoOficial: `${BACKEND_BASE}/api/documentos-oficiales/download`,
  deleteDocumentoOficial: `${BACKEND_BASE}/api/documentos-oficiales/delete`,
  updateDocumentoOficialVisibility: `${BACKEND_BASE}/api/documentos-oficiales`,
  updateDocumentoOficialNecesitaFirma: `${BACKEND_BASE}/api/documentos-oficiales`,
  marcarContratoComoFirmado: `${BACKEND_BASE}/api/documentos-oficiales`,
  getEmpleadosConStatusContratos: `${BACKEND_BASE}/api/documentos-oficiales/empleados-contratos`,
  countDocumentosNecesitanFirma: (codigo) => `${BACKEND_BASE}/api/documentos-oficiales/count-necesitan-firma?codigo=${codigo}`,
  deleteDocumento: `${BACKEND_BASE}/api/documentos/delete`,
  guardarDocumentoSemnat: `${BACKEND_BASE}/api/documentos-oficiales/save-signed`,
  getDocumentos: `${BACKEND_BASE}/api/documentos`,
  downloadDocumento: `${BACKEND_BASE}/api/documentos/download`,
  // Documentos Solicitados
  getDocumentosSolicitados: (empleadoId) => `${BACKEND_BASE}/api/documentos-solicitados${empleadoId ? `?empleadoId=${empleadoId}` : ''}`,
  createDocumentoSolicitado: `${BACKEND_BASE}/api/documentos-solicitados`,
  marcarDocumentoSolicitadoCompletado: `${BACKEND_BASE}/api/documentos-solicitados/completar`,
  
  // Avatares empleados
  getAvatar: `${BACKEND_BASE}/api/avatar`,
  getAvatarMe: `${BACKEND_BASE}/api/avatar/me`,
  getAvatarBulk: `${BACKEND_BASE}/api/avatar/bulk`,
  
  // Monthly Alerts
  getMonthlyAlerts: `${BACKEND_BASE}/api/monthly-alerts`,
  getMonthlyAlertsResumen: `${BACKEND_BASE}/api/monthly-alerts/resumen`,
  
  // Notificaciones
  sendNotificacion: `${BACKEND_BASE}/api/empleados/send-email`,
  
  // Estadisticas
  getTargetOreGrupo: `${BACKEND_BASE}/api/horas-asignadas`,
  getHorasPermitidas: `${BACKEND_BASE}/api/horas-permitidas`,
  getHorasTrabajadas: `${BACKEND_BASE}/api/horas-trabajadas`,
  getEstadisticas: `${BACKEND_BASE}/api/estadisticas`,
  
  // Inspecciones (Inspections)
  getMisInspecciones: `${BACKEND_BASE}/api/inspecciones`,
  // GET /api/inspecciones -> lista completă pentru manageri/supervizori
  getInspecciones: `${BACKEND_BASE}/api/inspecciones`,
  addInspeccion: `${BACKEND_BASE}/api/inspecciones`,
  createSolicitudInspeccion: `${BACKEND_BASE}/api/inspecciones/solicitud`,
  getInspectionPDF: '/api/inspections',
  downloadInspectionDocument: `${BACKEND_BASE}/api/inspecciones/download`,
  getMaterialesDocumentos: `${BACKEND_BASE}/api/inspecciones/materiales`,
  downloadMaterialDocumento: `${BACKEND_BASE}/api/inspecciones/materiales/download`,
  
  // Clientes (Clients)
  getClientes: `${BACKEND_BASE}/api/clientes`,
  // POST cu action: 'add'|'edit'|'delete'
  crudCliente: `${BACKEND_BASE}/api/clientes`,
  getProveedores: `${BACKEND_BASE}/api/clientes/proveedores`,
  // POST cu action: 'add'|'edit'|'delete'
  crudProveedor: `${BACKEND_BASE}/api/clientes/proveedores`,
  // GET /api/clientes/:nif/contracts
  /** CRUD contactos (JWT). clienteId = id numérico Clientes */
  clienteContactos: (clienteId) =>
    `${BACKEND_BASE}/api/clientes/${encodeURIComponent(clienteId)}/contactos`,
  clientePortalInviteToken: (clienteId) =>
    `${BACKEND_BASE}/api/clientes/${encodeURIComponent(clienteId)}/portal-invite-token`,
  portalPublicComunidad: (token) =>
    `${BACKEND_BASE}/api/portal/public/comunidad/${encodeURIComponent(token)}`,
  /** Sesión portal: comunidad activa (nombre fiscal, NIF, ids). */
  portalMe: `${BACKEND_BASE}/api/portal/me`,
  portalAuthRequestCode: `${BACKEND_BASE}/api/portal/auth/request-code`,
  portalAuthVerifyCode: `${BACKEND_BASE}/api/portal/auth/verify-code`,
  portalAuthRequestAdminCode: `${BACKEND_BASE}/api/portal/auth/request-admin-code`,
  portalAuthVerifyAdminCode: `${BACKEND_BASE}/api/portal/auth/verify-admin-code`,
  portalAuthSelectAdminComunidad: `${BACKEND_BASE}/api/portal/auth/select-admin-comunidad`,
  /** Documentación empresa (portal): misma lista para todos los contactos; no filtra por comunidad. */
  portalDocumentosGenerales: `${BACKEND_BASE}/api/portal/documentos/generales`,
  portalDocumentoGeneralArchivo: (id) =>
    `${BACKEND_BASE}/api/portal/documentos/generales/${encodeURIComponent(id)}/archivo`,
  /** Personal vinculado a la comunidad (horario_multicentro + empleados). JWT portal. */
  portalTrabajadores: `${BACKEND_BASE}/api/portal/trabajadores`,
  /** Contratos laborales en DocumentosOficiales (Permiso empleado = SI), solo personal de la comunidad. */
  portalEmpleadosContratos: `${BACKEND_BASE}/api/portal/empleados/contratos`,
  portalEmpleadoContratoPdf: (docId) =>
    `${BACKEND_BASE}/api/portal/empleados/contratos/${encodeURIComponent(docId)}/pdf`,
  /** Presupuestos guardados del cliente (portal JWT, por cliente_id). */
  portalPresupuestos: `${BACKEND_BASE}/api/portal/presupuestos`,
  portalPresupuestoPdfFirmado: (id) =>
    `${BACKEND_BASE}/api/portal/presupuestos/${encodeURIComponent(id)}/pdf-firmado`,
  /** Panel interno: documentación general del portal (JWT app). */
  adminPortalDocumentosGenerales: `${BACKEND_BASE}/api/admin/portal-documentos-generales`,
  adminPortalDocumentoGeneralArchivo: (id) =>
    `${BACKEND_BASE}/api/admin/portal-documentos-generales/${encodeURIComponent(id)}/archivo`,
  adminPortalDocumentoGeneralEstado: (id) =>
    `${BACKEND_BASE}/api/admin/portal-documentos-generales/${encodeURIComponent(id)}/estado`,
  getContratosCliente: (nif) => `${BACKEND_BASE}/api/clientes/${encodeURIComponent(nif)}/contracts`,
  // POST /api/clientes/contracts cu action: 'upload'|'delete'
  crudContract: `${BACKEND_BASE}/api/clientes/contracts`,
  getContractTypes: `${BACKEND_BASE}/api/contract-types`,
  // Lista de grupuri din tabelul grupos_referencia
  getGrupos: `${BACKEND_BASE}/api/grupos`,
  getGruposCompletos: `${BACKEND_BASE}/api/grupos/completos`,
  getGrupoById: (id) => `${BACKEND_BASE}/api/grupos/${id}`,
  createGrupo: `${BACKEND_BASE}/api/grupos`,
  updateGrupo: (id) => `${BACKEND_BASE}/api/grupos/${id}`,
  deleteGrupo: (id) => `${BACKEND_BASE}/api/grupos/${id}`,
  
  // Plantillas de presupuesto
  getPlantillas: `${BACKEND_BASE}/api/plantillas`,
  getPlantilla: (id) => `${BACKEND_BASE}/api/plantillas/${id}`,
  createPlantilla: `${BACKEND_BASE}/api/plantillas`,
  updatePlantilla: (id) => `${BACKEND_BASE}/api/plantillas/${id}`,
  deletePlantilla: (id) => `${BACKEND_BASE}/api/plantillas/${id}`,

  // Presupuestos guardados (guardar/cargar oferta completa)
  getPresupuestosGuardados: `${BACKEND_BASE}/api/presupuestos-guardados`,
  getPresupuestoGuardado: (id) => `${BACKEND_BASE}/api/presupuestos-guardados/${id}`,
  createPresupuestoGuardado: `${BACKEND_BASE}/api/presupuestos-guardados`,
  updatePresupuestoGuardado: (id) => `${BACKEND_BASE}/api/presupuestos-guardados/${id}`,
  deletePresupuestoGuardado: (id) => `${BACKEND_BASE}/api/presupuestos-guardados/${id}`,
  getPresupuestoGenerarDocumento: (id, format = 'pdf', company = null) => {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (company === 'hera') params.set('company', 'hera');
    const q = params.toString();
    return `${BACKEND_BASE}/api/presupuestos-guardados/${id}/generar-documento` + (q ? `?${q}` : '');
  },
  /** PDF con payload en vivo (misma URL, POST) — alineado con la pantalla de edición. */
  postPresupuestoGenerarDocumento: (id, company = null) => {
    const params = new URLSearchParams();
    if (company === 'hera') params.set('company', 'hera');
    const q = params.toString();
    return `${BACKEND_BASE}/api/presupuestos-guardados/${id}/generar-documento` + (q ? `?${q}` : '');
  },
  getPresupuestoPdfFirmado: (id) => (`${BACKEND_BASE}/api/presupuestos-guardados/${id}/pdf-firmado`),
  enviarPresupuestoEmail: (id) => (`${BACKEND_BASE}/api/presupuestos-guardados/${id}/enviar-email`),

  getInformesItems: `${BACKEND_BASE}/api/informes/items`,
  createInformesItem: `${BACKEND_BASE}/api/informes/items`,
  updateInformesItem: (id) => (`${BACKEND_BASE}/api/informes/items/${id}`),
  getInformesFacturaConfig: `${BACKEND_BASE}/api/informes/factura-config`,
  getInformesFacturaConfigList: `${BACKEND_BASE}/api/informes/factura-config/list`,
  createInformeFacturaConfig: `${BACKEND_BASE}/api/informes/factura-config`,
  updateInformesFacturaConfig: `${BACKEND_BASE}/api/informes/factura-config`,
  getInformeById: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}`),
  updateInformeById: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}`),
  deleteInformeById: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}`),
  getInformePdf: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}/pdf`),
  getInformePdfFirmado: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}/pdf-firmado`),
  enviarInformeEmail: (id) => (`${BACKEND_BASE}/api/informes/factura-config/${id}/enviar-email`),

  // Ausencias
  getAusencias: `${BACKEND_BASE}/api/ausencias`,
  getAusenciaJustificantes: (id) => `${BACKEND_BASE}/api/ausencias/${id}/justificantes`,
  deleteAusencia: (id) => `${BACKEND_BASE}/api/ausencias/${id}`,
  updateNoNecesitaJustificante: (id) => `${BACKEND_BASE}/api/ausencias/${id}/no-necesita-justificante`,
  updateAusenciaTipo: (id) => `${BACKEND_BASE}/api/ausencias/${id}/tipo`,
  recordarJustificante: (id) => `${BACKEND_BASE}/api/ausencias/${id}/recordar-justificante`,
  asociarAusencia: (id) => `${BACKEND_BASE}/api/ausencias/${id}/asociar`,
  marcarSinAusencia: (id) => `${BACKEND_BASE}/api/ausencias/${id}/marcar-sin-ausencia`,
  recalcularDuracion: (id) => `${BACKEND_BASE}/api/ausencias/${id}/recalcular-duracion`,
  updateDuracion: (id) => `${BACKEND_BASE}/api/ausencias/${id}/duracion`,
  addAusencia: `${BACKEND_BASE}/api/ausencias`,
  
  // Admin - Activity Logs
  logActivity: `${BACKEND_BASE}/api/activity-logs`,
  getActivityLog: `${BACKEND_BASE}/api/activity-logs`,
  getPermissionsAdmin: `${BACKEND_BASE}/api/permissions`,
  savePermissions: `${BACKEND_BASE}/api/permissions`,
  
  // Festivos (Zile Festive)
  getFestivos: `${BACKEND_BASE}/api/festivos`,
  editFestivo: `${BACKEND_BASE}/api/festivos`,
  createFestivo: `${BACKEND_BASE}/api/festivos`,
  deleteFestivo: `${BACKEND_BASE}/api/festivos`,
  
  // Aprobaciones (Approvals)
  getCambiosPendientes: `${BACKEND_BASE}/api/empleados/cambios-pendientes`,
  approveCambio: `${BACKEND_BASE}/api/empleados/approve-cambio`,
  rejectCambio: `${BACKEND_BASE}/api/empleados/reject-cambio`,
  
  // Chat AI - Backend NestJS (nou endpoint)
  chatAI: `${BACKEND_BASE}/api/assistant/message`,
  assistantPreferences: `${BACKEND_BASE}/api/assistant/preferences`,
  assistantConversations: `${BACKEND_BASE}/api/assistant/conversations`,
  assistantConversationMessages: (id) =>
    `${BACKEND_BASE}/api/assistant/conversations/${encodeURIComponent(id)}`,
  assistantMessageFeedback: (messageId) =>
    `${BACKEND_BASE}/api/assistant/messages/${encodeURIComponent(messageId)}/feedback`,
  /** Arhivă chat AI per empleado (Developer / Admin / Manager / Supervisor) */
  assistantAdminEmpleadosConConversaciones: `${BACKEND_BASE}/api/assistant/admin/empleados-con-conversaciones`,
  assistantAdminEmpleadoConversations: (codigo) =>
    `${BACKEND_BASE}/api/assistant/admin/empleado/${encodeURIComponent(codigo)}/conversations`,
  assistantAdminEmpleadoConversationMessages: (codigo, conversationId) =>
    `${BACKEND_BASE}/api/assistant/admin/empleado/${encodeURIComponent(codigo)}/conversations/${encodeURIComponent(conversationId)}/messages`,
  /** KPIs y feedback negativo (Developer / Admin / Manager / Supervisor) */
  assistantAdminAnalyticsSummary: `${BACKEND_BASE}/api/assistant/admin/analytics/summary`,
  assistantAdminAnalyticsFeedbackNegative: `${BACKEND_BASE}/api/assistant/admin/analytics/feedback-negative`,
  assistantAdminAnalyticsAppHelpInsights: `${BACKEND_BASE}/api/assistant/admin/analytics/app-help-insights`,
  /** GET/PUT FAQ validada (Developer / Admin / Manager / Supervisor) */
  assistantAdminValidatedFaq: `${BACKEND_BASE}/api/assistant/admin/validated-faq`,

  // Chat (REST API - backend NestJS)
  chatRooms: `${BACKEND_BASE}/chat/rooms`,
  chatColleagues: `${BACKEND_BASE}/chat/colleagues`,
  chatSupervisors: `${BACKEND_BASE}/chat/supervisors`,
  chatCreateSupervisorGroup: `${BACKEND_BASE}/chat/rooms/supervisor-group`,
  chatRoomPresence: (roomId) => {
    const base = BACKEND_BASE;
    return `${base}/chat/rooms/${roomId}/presence`;
  },
  chatMarkMessagesRead: (roomId) => {
    const base = BACKEND_BASE;
    return `${base}/chat/rooms/${roomId}/messages/read`;
  },
  chatRoomMessages: (roomId, after, limit) => {
    const base = BACKEND_BASE;
    const params = new URLSearchParams();
    if (after) params.append('after', after);
    if (limit) params.append('limit', limit);
    return `${base}/chat/rooms/${roomId}/messages${params.toString() ? '?' + params.toString() : ''}`;
  },
  chatSendMessage: (roomId) => {
    const base = BACKEND_BASE;
    return `${base}/chat/rooms/${roomId}/messages`;
  },
  chatCreateCentro: `${BACKEND_BASE}/chat/rooms/centro`,
  chatCreateDM: `${BACKEND_BASE}/chat/rooms/dm`,
  chatDeleteRoom: (roomId) => {
    const base = BACKEND_BASE;
    return `${base}/chat/rooms/${roomId}`;
  },

  // Online users (presence) - pentru badge Online/Offline în Admin / Empleados
  getOnlineUsers: `${BACKEND_BASE}/api/online-users`,
  
  // AutoFirma Integration
  autofirmaWebhook: `${BACKEND_BASE}/api/documentos-oficiales/save-signed`,
  
  // Horarios (Schedules)
  // POST /api/horarios cu { action: "create"|"get"|"update"|"delete", payload: {...} }
  // GET /api/horarios pentru listarea tuturor horarios
  getHorarios: `${BACKEND_BASE}/api/horarios`,
  
  // Catalogo (Product Catalog)
  getCatalogo: `${BACKEND_BASE}/api/catalogo`,
  addProducto: `${BACKEND_BASE}/api/catalogo`,
  editDeleteProducto: `${BACKEND_BASE}/api/catalogo`,
  savePermisos: `${BACKEND_BASE}/api/catalogo/permisos`,
  
  // Pedidos (Orders)
  savePedido: `${BACKEND_BASE}/api/pedidos`,
  getPedidos: `${BACKEND_BASE}/api/pedidos`,
  getPedidoByUid: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return `${BACKEND_BASE}/api/pedidos/${encodedUid}`;
  },
  updatePedidoEstado: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return `${BACKEND_BASE}/api/pedidos/${encodedUid}/estado`;
  },
  updatePedidoDireccionEnvio: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return `${BACKEND_BASE}/api/pedidos/${encodedUid}/direccion-envio`;
  },
  updatePedidoItems: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return `${BACKEND_BASE}/api/pedidos/${encodedUid}/items`;
  },
  updatePedidoNotas: (uid) => {
    const encodedUid = encodeURIComponent(uid);
    return `${BACKEND_BASE}/api/pedidos/${encodedUid}/notas`;
  },
  enviarPedidosAprobados: `${BACKEND_BASE}/api/pedidos/enviar-aprobados`,
  generarExcelPedidos: `${BACKEND_BASE}/api/pedidos/generar-excel`,
  deletePedido: (pedidoUid) => `${BACKEND_BASE}/api/pedidos/${encodeURIComponent(pedidoUid)}`,
  
  // Pedidos Notas
  getPedidosNotas: `${BACKEND_BASE}/api/pedidos-notas`,
  getPedidosNota: (id) => `${BACKEND_BASE}/api/pedidos-notas/${id}`,
  createPedidosNota: `${BACKEND_BASE}/api/pedidos-notas`,
  updatePedidosNota: (id) => `${BACKEND_BASE}/api/pedidos-notas/${id}`,
  deletePedidosNota: (id) => `${BACKEND_BASE}/api/pedidos-notas/${id}`,
  uploadPedidosNotaImagenes: (id) => `${BACKEND_BASE}/api/pedidos-notas/${id}/imagenes`,
  deletePedidosNotaImagen: (imagenId) => `${BACKEND_BASE}/api/pedidos-notas/imagenes/${imagenId}`,
  
  // Sent Emails (Mensajes Enviados)
  getSentEmails: `${BACKEND_BASE}/api/sent-emails`,
  deleteSentEmail: (id) => `${BACKEND_BASE}/api/sent-emails/${id}`,
  getSentEmailById: (id) => `${BACKEND_BASE}/api/sent-emails/${id}`,
  sendEmail: `${BACKEND_BASE}/api/sent-emails/send`,
  downloadAttachment: (attachmentId) => `${BACKEND_BASE}/api/sent-emails/attachments/${attachmentId}`,
  
  // Geocoding - Autocompletare adrese
  searchAddresses: (query, limit = 5) => {
    const base = BACKEND_BASE;
    return `${base}/api/geocoding/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  },
  getAddressFromCoords: (lat, lon) => {
    const base = BACKEND_BASE;
    return `${base}/api/geocoding/address-from-coords?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  },
  
  // PRL Documentos
  prlListarGrupos: `${BACKEND_BASE}/api/prl/grupos`,
  prlListarEmpleadosConDocumentos: `${BACKEND_BASE}/api/prl/empleados-con-documentos`,
  prlListarTemplates: (grupoNombre) => {
    const encoded = encodeURIComponent(grupoNombre);
    return `${BACKEND_BASE}/api/prl/grupos/${encoded}/templates`;
  },
  prlUploadZipPreview: `${BACKEND_BASE}/api/prl/upload-zip-preview`,
  prlUploadZipConfirmar: `${BACKEND_BASE}/api/prl/upload-zip-confirmar`,
  prlUploadDocumento: `${BACKEND_BASE}/api/prl/upload-documento`,
  prlDescargarTemplate: (templateId) => `${BACKEND_BASE}/api/prl/templates/${templateId}/descargar`,
  prlEliminarTemplate: (templateId) => `${BACKEND_BASE}/api/prl/templates/${templateId}`,
  prlEliminarTodosTemplates: (grupoNombre) => `${BACKEND_BASE}/api/prl/grupos/${encodeURIComponent(grupoNombre)}/templates`,
  prlEnviarDocumentosAGrupo: (grupoNombre) => `${BACKEND_BASE}/api/prl/grupos/${encodeURIComponent(grupoNombre)}/enviar`,
  prlMisDocumentos: `${BACKEND_BASE}/api/prl/mis-documentos`,
  prlDescargarMiDocumento: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/descargar`,
  prlConvertirDocxAHtml: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/convertir-docx-html`,
  prlRenunciarRM: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/renunciar-rm`,
  prlSubirDocumentoFirmado: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/subir-firmado`,
  prlAgregarFirmaADocx: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/agregar-firma-docx`,
  prlDescargarDocumentoFirmado: (documentoId) => `${BACKEND_BASE}/api/prl/mis-documentos/${documentoId}/descargar-firmado`,
  
  // Diplomas
  diplomasUploadZipPreview: `${BACKEND_BASE}/api/diplomas/upload-zip-preview`,
  diplomasUploadZipConfirmar: `${BACKEND_BASE}/api/diplomas/upload-zip-confirmar`,
  diplomasUploadPdfsPreview: `${BACKEND_BASE}/api/diplomas/upload-pdfs-preview`,
  diplomasUploadPdfsConfirmar: `${BACKEND_BASE}/api/diplomas/upload-pdfs-confirmar`,
  diplomasListarEmpleado: (empleadoId) => `${BACKEND_BASE}/api/diplomas/empleado/${empleadoId}`,
  diplomasListarTodas: `${BACKEND_BASE}/api/diplomas/todas`,
  diplomasDescargar: (diplomaId) => `${BACKEND_BASE}/api/diplomas/${diplomaId}/descargar`,

  // Certificados de retenciones (IRPF / nómina)
  certificadosRetencionesUploadZipPreview: `${BACKEND_BASE}/api/certificados-retenciones/upload-zip-preview`,
  certificadosRetencionesUploadZipConfirmar: `${BACKEND_BASE}/api/certificados-retenciones/upload-zip-confirmar`,
  certificadosRetencionesUploadPdfsPreview: `${BACKEND_BASE}/api/certificados-retenciones/upload-pdfs-preview`,
  certificadosRetencionesUploadPdfsConfirmar: `${BACKEND_BASE}/api/certificados-retenciones/upload-pdfs-confirmar`,
  certificadosRetencionesListarEmpleado: (empleadoId) =>
    `${BACKEND_BASE}/api/certificados-retenciones/empleado/${empleadoId}`,
  certificadosRetencionesListarTodas: `${BACKEND_BASE}/api/certificados-retenciones/todas`,
  certificadosRetencionesDescargar: (id) =>
    `${BACKEND_BASE}/api/certificados-retenciones/${id}/descargar`,
  certificadosRetencionesCompuestoPreview: `${BACKEND_BASE}/api/certificados-retenciones/upload-compuesto-preview`,
  certificadosRetencionesCompuestoConfirmar: `${BACKEND_BASE}/api/certificados-retenciones/upload-compuesto-confirmar`,
};
