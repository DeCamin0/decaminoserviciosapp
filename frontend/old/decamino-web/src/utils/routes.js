// Pentru development folosim proxy-ul Vite, pentru production folosim URL-ul complet al n8n
export const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.decaminoservicios.com');

console.log('🔧 BASE_URL value:', BASE_URL);
console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
console.log('🔧 import.meta.env.VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('🔧 import.meta.env.VITE_PROXY_URL:', import.meta.env.VITE_PROXY_URL);
console.log('🔧 import.meta.env.MODE:', import.meta.env.MODE);
console.log('🔧 import.meta.env.PROD:', import.meta.env.PROD);
console.log('🔧 Final BASE_URL for production:', BASE_URL);

// Debug para ver qué URL se construye
// console.log('🔧 getDocumentosOficiales URL:', `${BASE_URL}/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b`);
// console.log('🔧 Will use proxy?', BASE_URL !== '');

// Debug - verifică ce URL se construiește pentru getUsuarios
const getUsuariosUrl = import.meta.env.DEV ? '/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142' : `${BASE_URL}/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142`;
console.log('🔧 getUsuarios URL constructed:', getUsuariosUrl);
console.log('🔧 import.meta.env.DEV in routes:', import.meta.env.DEV);

// Helper function pentru a construi URL-uri din endpoint-uri
export const getN8nUrl = (endpoint) => {
  if (import.meta.env.DEV) {
    return endpoint; // Folosește proxy-ul Vite în development
  }
  return `${BASE_URL}${endpoint}`;
};

export const routes = {
  // Authentication & Users - Force relative URLs in dev for proxy
  // Revert to dedicated login webhook (expects POST with credentials)
  login: import.meta.env.DEV ? '/webhook/login-yyBov0qVQZEhX2TL' : `${BASE_URL}/webhook/login-yyBov0qVQZEhX2TL`,
  getUsuarios: getUsuariosUrl,
  getEmpleados: import.meta.env.DEV ? '/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142' : `${BASE_URL}/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142`,
  updateUser: `${BASE_URL}/webhook/853e19f8-877a-4c85-b63c-199f3ec84049`,
  // Endpoint de producție pentru creare angajat (PDF + payload complet)
  addUser: `${BASE_URL}/webhook/5c15e864-0bfc-43bb-b398-58bd8fabf3c2`,
  
  // Fichajes (Time tracking)
  getFichajes: `${BASE_URL}/webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7`,
  getRegistros: `${BASE_URL}/webhook/get-registros-EgZjaHJv`,
  getRegistrosEmpleados: `${BASE_URL}/webhook/47305af1-939e-4002-a140-7f581bdaf392`,
  getRegistrosPeriodo: `${BASE_URL}/webhook/v1/e9424047-c9ae-4442-a9b6-2ac9e378eaa2`,
  addFichaje: `${BASE_URL}/webhook/registrohorario-WUqDggA`,
  updateFichaje: `${BASE_URL}/webhook/f8378016-1d88-4c1e-af56-3175d41d1652`,
  deleteFichaje: `${BASE_URL}/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`,
  
  // Cuadrantes (Schedules)
  getCuadrantes: `${BASE_URL}/webhook/get-cuadrantes-yyBov0qVQZEhX2TL`,
  saveCuadrante: `${BASE_URL}/webhook/guardar-cuadrante-yyBov0qVQZEhX2TL`,
  
  // Solicitudes (Requests)
  getSolicitudes: `${BASE_URL}/webhook/lista-solicitudes`,
  getSolicitudesByEmail: `${BASE_URL}/webhook/lista-solicitudes-email-yyBov0qVQZEhX2TL`,
  addSolicitud: `${BASE_URL}/webhook/solicitud-empleados`,
  updateSolicitudStatus: `${BASE_URL}/webhook/actualizar-estado-5Wogblin`,
  uploadBajasMedicas: import.meta.env.VITE_UPLOAD_BAJAS_MEDICAS
    ? import.meta.env.VITE_UPLOAD_BAJAS_MEDICAS
    : `${BASE_URL}/webhook/56981e4c-316e-412d-8c49-99ecb13f2327`,
  getBajasMedicas: import.meta.env.VITE_GET_BAJAS_MEDICAS
    ? import.meta.env.VITE_GET_BAJAS_MEDICAS
    : (import.meta.env.DEV
        ? '/webhook/56981e4c-316e-412d-8c49-99ecb13f2327'
        : `${BASE_URL}/webhook/56981e4c-316e-412d-8c49-99ecb13f2327`),
  
  // Documentos
  getNominas: `${BASE_URL}/webhook/get-nomina-ZeTqQIbs8kwia`,
  downloadNomina: `${BASE_URL}/webhook/93c7df81-4765-4e68-b005-c6a268821e39`, // Endpoint pentru descărcarea nóminas
  deleteNomina: `${BASE_URL}/webhook/e4d49321-6591-4c41-9a50-9347d4411733`, // Endpoint pentru borrar nóminas (TEST)
  uploadNomina: `${BASE_URL}/webhook/de8acf5c-79fa-4e6e-b694-2ce33d9f8f2f`, // Endpoint pentru upload-ul de nóminas
  uploadDocumento: `${BASE_URL}/webhook/886f6dd7-8b4d-479b-85f4-fb888ba8f731`, // Endpoint de producție pentru salvarea documentelor
  uploadDocumentoOficial: `${BASE_URL}/webhook/fc6c99f6-4900-4b42-a2ab-1d67849808f3`, // Endpoint de producție pentru documentele oficiale
  getDocumentosOficiales: `${BASE_URL}/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b`, // Endpoint pentru listarea documentelor oficiales
  downloadDocumentoOficial: `${BASE_URL}/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f`, // Endpoint pentru descărcarea documentelor oficiales
  deleteDocumentoOficial: `${BASE_URL}/webhook/240973b3-a0a2-45da-a436-b142436749d9`, // Endpoint pentru borrar documentele oficiales
  deleteDocumento: `${BASE_URL}/webhook/6df8d233-10e9-4758-9a9d-cd36153860cd`, // Endpoint pentru borrar documentele normale (PRODUCCIÓN)
  guardarDocumentoSemnat: `${BASE_URL}/webhook/715f8808-ca25-4a42-a49f-a7a3337d3eeb`, // Endpoint pentru guardar documentele semnate (PRODUCCIÓN)
  getDocumentos: `${BASE_URL}/webhook/499ffc98-99de-4fcf-9597-25eb7ff8d617`, // Endpoint de producție pentru listarea documentelor per angajat
  downloadDocumento: `${BASE_URL}/webhook/descargar-documento-sWRT8s`, // Endpoint pentru descărcarea documentelor

  // Avatares empleados (folosește proxy în dev pt. CORS)
  getAvatar: import.meta.env.DEV
    ? '/webhook/getavatar/886f6dd7-8b4d-479b-85f4-fb888ba8f731'
    : `${BASE_URL}/webhook/getavatar/886f6dd7-8b4d-479b-85f4-fb888ba8f731`,
  
  // Notificaciones
  getNotificaciones: `${BASE_URL}/webhook/notificaciones`,
  sendNotificacion: `${BASE_URL}/webhook/notificare-email-aec36db4`,

  // Estadisticas
  getTargetOreGrupo: `${BASE_URL}/webhook/get-target-ore-grupo-QZEhX2TL`,

  // Inspecciones (Inspections)
  getMisInspecciones: `${BASE_URL}/webhook/e1590f70-8beb-4c9c-a04c-65fb4d571c90`, // Para "Mis Inspecciones" (usuario actual)
  getInspecciones: `${BASE_URL}/webhook/1ef2caab-fa60-4cf2-922d-e9ba2c5ea398`, // Para "Todas las Inspecciones" (lista completa)
  addInspeccion: `${BASE_URL}/webhook/inspeccion-s6Whscq2`, // Production endpoint
  updateInspeccion: `${BASE_URL}/webhook/update-inspeccion`,
  deleteInspeccion: `${BASE_URL}/webhook/delete-inspeccion`,
  generateInspectionPDF: `${BASE_URL}/webhook/generate-inspection-pdf`, // ✅ Noul endpoint pentru PDF
  getInspectionPDF: '/api/inspections', // ✅ Endpoint pentru descărcarea PDF-urilor
  downloadInspectionDocument: `${BASE_URL}/webhook/f4d97660-c73f-45d3-ba3e-dfaf8eefece5`, // ✅ Endpoint pentru descărcarea documentelor cu ID
  
  // Clientes (Clients)
  getClientes: `${BASE_URL}/webhook/ed97e937-bb85-4b58-967b-d41bbd84ac47`, // ✅ Endpoint pentru lista de clienți
  getProveedores: `${BASE_URL}/webhook/b3fd1c12-bfc0-438f-8246-2e4d63adb291`, // ✅ Endpoint pentru lista de furnizori
  saveCliente: `${BASE_URL}/webhook/save-cliente`, // Endpoint pentru salvarea clienților
  renovarContracto: `${BASE_URL}/webhook/renovar-contracto`, // Endpoint pentru reînnoirea contractelor
  
  // Admin (folosesc backend-ul principal)
  getAdminStats: `${BASE_URL}/webhook/get-admin-stats-ZEhX2TL`,
  logActivity: `${BASE_URL}/webhook/v1/log-activity-yyBov0q`,
  getActivityLog: `${BASE_URL}/webhook/get-activity-log-iM1jIgoWNn2a`,
  getActivityLogDB: `${BASE_URL}/webhook/get-logs-db`, // Endpoint nou pentru loguri din baza de date
  getAllLogs: `${BASE_URL}/webhook/get-all-logs`, // Endpoint pentru toate logurile din baza de date
  getPermissions: `${BASE_URL}/webhook/get-permissions-Rws95`, // Endpoint universal pentru navigare
  getPermissionsAdmin: '/webhook/be960529-6a0b-4a6d-b0b9-2c0eed38576e', // Pentru Control Acces (toate permisiunile)
  savePermissions: '/webhook/save-permissions-2c0ee',
  getFestivos: import.meta.env.DEV
    ? '/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'
    : `${BASE_URL}/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`,
  editFestivo: import.meta.env.DEV
    ? '/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'
    : `${BASE_URL}/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`,
  createFestivo: import.meta.env.DEV
    ? '/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'
    : `${BASE_URL}/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`,
  deleteFestivo: import.meta.env.DEV
    ? '/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'
    : `${BASE_URL}/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`,
  
  // Aprobaciones (Approvals)
  getFichajesPendientes: `${BASE_URL}/webhook/770f63b1-7cc9-46a5-9d8e-e1303201b093`,
  updateEstadoFichaje: `${BASE_URL}/webhook/update-estado-hVhUKz2`,
  getFichajeDetails: `${BASE_URL}/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`,
  getCambiosPendientes: `${BASE_URL}/webhook/lista-solicitudes-e6d15c117779`,
  approveCambio: `${BASE_URL}/webhook/update-8a0c-4f04-96b1-a25adff1b8a1`,
  rejectCambio: import.meta.env.DEV ? '/webhook/rechazada-a2c3f9cb0ffd' : `${BASE_URL}/webhook/rechazada-a2c3f9cb0ffd`,
  getAusenciasEmpleado: `${BASE_URL}/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`,
  saveFichajePendiente: `${BASE_URL}/webhook/save-fichaje-pendiente`,
  
  // Incidencias (Incidents)
  getIncidencias: `${BASE_URL}/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b`, // ✅ Endpoint real pentru lista incidencias
  addIncidencia: `${BASE_URL}/webhook/31f2b085-58f1-4f61-9368-3703566323f9`, // ✅ Endpoint real pentru adăugare incidencia
  updateIncidencia: `${BASE_URL}/webhook/c3a21775-6010-4708-9c0a-dd2f978e54da`, // ✅ Endpoint real pentru editare incidencia
  rejectIncidencia: `${BASE_URL}/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`, // ✅ Endpoint real pentru respingere incidencia
  
  // Chat AI
  chatAI: '/webhook/chat-ai-6Ts3sq',
  
  // Paquete/Control Correo
  getPaquetes: `${BASE_URL}/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9`, // ✅ Endpoint real pentru lista paquetes
  addPaquete: `${BASE_URL}/webhook/028926ba-398d-45a4-96b5-f145fb687fa6`, // ✅ Endpoint real pentru adăugare paquete
  updatePaquete: `${BASE_URL}/webhook/9a16282e-3651-4ac6-a3da-c31ad18c480b`, // ✅ Endpoint real pentru editare paquete
  
  // Tareas (Daily Tasks)
  getTareasCentro: `${BASE_URL}/webhook-test/f2035fa7-7fb7-4a28-bcc9-d24b7cc5294b`, // ✅ Endpoint para tareas por centro
  
  // Contract Downloads
  downloadContract: '/webhook/6cb6b98c-9127-494c-8201-f097d14b9c13',
  
  // AutoFirma Integration - folosesc proxy-ul Vite
  autofirmaPrepare: `${BASE_URL}/webhook/918cd7f3-c0b6-49da-9218-46723702224d`, // Endpoint real pentru AutoFirma
  autofirmaStatus: `${BASE_URL}/webhook-test/status-endpoint-id`, // TODO: Adaugă endpoint-ul de status
  autofirmaDownload: `${BASE_URL}/webhook-test/download-endpoint-id`, // TODO: Adaugă endpoint-ul de download
  autofirmaWebhook: `${BASE_URL}/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4`, // Endpoint pentru webhook AutoFirma
}; 