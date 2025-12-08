// Pentru development folosim backend-ul NestJS (proxy), pentru production folosim URL-ul complet al n8n
const BACKEND_PROXY_URL = 'http://localhost:3000/api/n8n';
export const BASE_URL = import.meta.env.DEV 
  ? BACKEND_PROXY_URL  // Development: folosește backend NestJS proxy
  : (import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.decaminoservicios.com'); // Production: direct la n8n

console.log('🔧 BASE_URL value:', BASE_URL);
console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
console.log('🔧 Using backend proxy in dev:', import.meta.env.DEV ? 'YES' : 'NO');

// Helper function pentru a construi URL-uri din endpoint-uri
export const getN8nUrl = (endpoint) => {
  // În development, toate request-urile merg prin backend proxy
  // În production, merg direct la n8n
  return `${BASE_URL}${endpoint}`;
};

// Debug - verifică ce URL se construiește pentru getUsuarios
const getUsuariosUrl = getN8nUrl('/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142');
console.log('🔧 getUsuarios URL constructed:', getUsuariosUrl);

export const routes = {
  // Authentication & Users
  // Login: folosește backend-ul în development, n8n direct în production
  login: import.meta.env.DEV 
    ? 'http://localhost:3000/api/auth/login'  // Backend endpoint în development
    : getN8nUrl('/webhook/login-yyBov0qVQZEhX2TL'),  // n8n direct în production
  getUsuarios: getUsuariosUrl,
  getEmpleados: getN8nUrl('/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142'),
  updateUser: getN8nUrl('/webhook/853e19f8-877a-4c85-b63c-199f3ec84049'),
  // Endpoint de producție pentru creare angajat (PDF + payload complet)
  addUser: getN8nUrl('/webhook/5c15e864-0bfc-43bb-b398-58bd8fabf3c2'),
  
  // Fichajes (Time tracking)
  getFichajes: getN8nUrl('/webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7'),
  getRegistros: getN8nUrl('/webhook/get-registros-EgZjaHJv'),
  getRegistrosEmpleados: getN8nUrl('/webhook/47305af1-939e-4002-a140-7f581bdaf392'),
  getRegistrosPeriodo: getN8nUrl('/webhook/v1/e9424047-c9ae-4442-a9b6-2ac9e378eaa2'),
  addFichaje: getN8nUrl('/webhook/registrohorario-WUqDggA'),
  updateFichaje: getN8nUrl('/webhook/f8378016-1d88-4c1e-af56-3175d41d1652'),
  deleteFichaje: getN8nUrl('/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb'),
  
  // Cuadrantes (Schedules)
  getCuadrantes: getN8nUrl('/webhook/get-cuadrantes-yyBov0qVQZEhX2TL'),
  saveCuadrante: getN8nUrl('/webhook/guardar-cuadrante-yyBov0qVQZEhX2TL'),
  
  // Solicitudes (Requests)
  getSolicitudes: getN8nUrl('/webhook/lista-solicitudes'),
  getSolicitudesByEmail: getN8nUrl('/webhook/lista-solicitudes-email-yyBov0qVQZEhX2TL'),
  addSolicitud: getN8nUrl('/webhook/solicitud-empleados'),
  updateSolicitudStatus: getN8nUrl('/webhook/actualizar-estado-5Wogblin'),
  uploadBajasMedicas: import.meta.env.VITE_UPLOAD_BAJAS_MEDICAS
    ? import.meta.env.VITE_UPLOAD_BAJAS_MEDICAS
    : getN8nUrl('/webhook/56981e4c-316e-412d-8c49-99ecb13f2327'),
  getBajasMedicas: import.meta.env.VITE_GET_BAJAS_MEDICAS
    ? import.meta.env.VITE_GET_BAJAS_MEDICAS
    : getN8nUrl('/webhook/56981e4c-316e-412d-8c49-99ecb13f2327'),
  
  // Documentos
  getNominas: getN8nUrl('/webhook/get-nomina-ZeTqQIbs8kwia'),
  downloadNomina: getN8nUrl('/webhook/93c7df81-4765-4e68-b005-c6a268821e39'), // Endpoint pentru descărcarea nóminas
  deleteNomina: getN8nUrl('/webhook/e4d49321-6591-4c41-9a50-9347d4411733'), // Endpoint pentru borrar nóminas (TEST)
  uploadNomina: getN8nUrl('/webhook/de8acf5c-79fa-4e6e-b694-2ce33d9f8f2f'), // Endpoint pentru upload-ul de nóminas
  uploadDocumento: getN8nUrl('/webhook/886f6dd7-8b4d-479b-85f4-fb888ba8f731'), // Endpoint de producție pentru salvarea documentelor
  uploadDocumentoOficial: getN8nUrl('/webhook/fc6c99f6-4900-4b42-a2ab-1d67849808f3'), // Endpoint de producție pentru documentele oficiale
  getDocumentosOficiales: getN8nUrl('/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b'), // Endpoint pentru listarea documentelor oficiales
  downloadDocumentoOficial: getN8nUrl('/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f'), // Endpoint pentru descărcarea documentelor oficiales
  deleteDocumentoOficial: getN8nUrl('/webhook/240973b3-a0a2-45da-a436-b142436749d9'), // Endpoint pentru borrar documentele oficiales
  deleteDocumento: getN8nUrl('/webhook/6df8d233-10e9-4758-9a9d-cd36153860cd'), // Endpoint pentru borrar documentele normale (PRODUCCIÓN)
  guardarDocumentoSemnat: getN8nUrl('/webhook/715f8808-ca25-4a42-a49f-a7a3337d3eeb'), // Endpoint pentru guardar documentele semnate (PRODUCCIÓN)
  getDocumentos: getN8nUrl('/webhook/499ffc98-99de-4fcf-9597-25eb7ff8d617'), // Endpoint de producție pentru listarea documentelor per angajat
  downloadDocumento: getN8nUrl('/webhook/descargar-documento-sWRT8s'), // Endpoint pentru descărcarea documentelor
  
  // Avatares empleados
  getAvatar: getN8nUrl('/webhook/getavatar/886f6dd7-8b4d-479b-85f4-fb888ba8f731'),
  
  // Notificaciones
  getNotificaciones: getN8nUrl('/webhook/notificaciones'),
  sendNotificacion: getN8nUrl('/webhook/notificare-email-aec36db4'),
  
  // Estadisticas
  getTargetOreGrupo: getN8nUrl('/webhook/get-target-ore-grupo-QZEhX2TL'),
  
  // Inspecciones (Inspections)
  getMisInspecciones: getN8nUrl('/webhook/e1590f70-8beb-4c9c-a04c-65fb4d571c90'), // Para "Mis Inspecciones" (usuario actual)
  getInspecciones: getN8nUrl('/webhook/1ef2caab-fa60-4cf2-922d-e9ba2c5ea398'), // Para "Todas las Inspecciones" (lista completa)
  addInspeccion: getN8nUrl('/webhook/inspeccion-s6Whscq2'), // Production endpoint
  updateInspeccion: getN8nUrl('/webhook/update-inspeccion'),
  deleteInspeccion: getN8nUrl('/webhook/delete-inspeccion'),
  generateInspectionPDF: getN8nUrl('/webhook/generate-inspection-pdf'), // ✅ Noul endpoint pentru PDF
  getInspectionPDF: '/api/inspections', // ✅ Endpoint pentru descărcarea PDF-urilor (local, nu prin n8n)
  downloadInspectionDocument: getN8nUrl('/webhook/f4d97660-c73f-45d3-ba3e-dfaf8eefece5'), // ✅ Endpoint pentru descărcarea documentelor cu ID
  
  // Clientes (Clients)
  getClientes: getN8nUrl('/webhook/ed97e937-bb85-4b58-967b-d41bbd84ac47'), // ✅ Endpoint pentru lista de clienți
  getProveedores: getN8nUrl('/webhook/b3fd1c12-bfc0-438f-8246-2e4d63adb291'), // ✅ Endpoint pentru lista de furnizori
  saveCliente: getN8nUrl('/webhook/save-cliente'), // Endpoint pentru salvarea clienților
  renovarContracto: getN8nUrl('/webhook/renovar-contracto'), // Endpoint pentru reînnoirea contractelor
  
  // Admin (folosesc backend-ul principal)
  getAdminStats: getN8nUrl('/webhook/get-admin-stats-ZEhX2TL'),
  logActivity: getN8nUrl('/webhook/v1/log-activity-yyBov0q'),
  getActivityLog: getN8nUrl('/webhook/get-activity-log-iM1jIgoWNn2a'),
  getActivityLogDB: getN8nUrl('/webhook/get-logs-db'), // Endpoint nou pentru loguri din baza de date
  getAllLogs: getN8nUrl('/webhook/get-all-logs'), // Endpoint pentru toate logurile din baza de date
  getPermissions: getN8nUrl('/webhook/get-permissions-Rws95'), // Endpoint universal pentru navigare
  getPermissionsAdmin: '/webhook/be960529-6a0b-4a6d-b0b9-2c0eed38576e', // Pentru Control Acces (toate permisiunile) - local path
  savePermissions: '/webhook/save-permissions-2c0ee', // local path
  getFestivos: getN8nUrl('/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'),
  editFestivo: getN8nUrl('/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'),
  createFestivo: getN8nUrl('/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'),
  deleteFestivo: getN8nUrl('/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0'),
  
  // Aprobaciones (Approvals)
  getFichajesPendientes: getN8nUrl('/webhook/770f63b1-7cc9-46a5-9d8e-e1303201b093'),
  updateEstadoFichaje: getN8nUrl('/webhook/update-estado-hVhUKz2'),
  getFichajeDetails: getN8nUrl('/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb'),
  getCambiosPendientes: getN8nUrl('/webhook/lista-solicitudes-e6d15c117779'),
  approveCambio: getN8nUrl('/webhook/update-8a0c-4f04-96b1-a25adff1b8a1'),
  rejectCambio: getN8nUrl('/webhook/rechazada-a2c3f9cb0ffd'),
  getAusenciasEmpleado: getN8nUrl('/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb'),
  saveFichajePendiente: getN8nUrl('/webhook/save-fichaje-pendiente'),
  
  // Incidencias (Incidents)
  getIncidencias: getN8nUrl('/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b'), // ✅ Endpoint real pentru lista incidencias
  addIncidencia: getN8nUrl('/webhook/31f2b085-58f1-4f61-9368-3703566323f9'), // ✅ Endpoint real pentru adăugare incidencia
  updateIncidencia: getN8nUrl('/webhook/c3a21775-6010-4708-9c0a-dd2f978e54da'), // ✅ Endpoint real pentru editare incidencia
  rejectIncidencia: getN8nUrl('/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb'), // ✅ Endpoint real pentru respingere incidencia
  
  // Chat AI
  chatAI: '/webhook/chat-ai-6Ts3sq', // local path
  
  // Paquete/Control Correo
  getPaquetes: getN8nUrl('/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9'), // ✅ Endpoint real pentru lista paquetes
  addPaquete: getN8nUrl('/webhook/028926ba-398d-45a4-96b5-f145fb687fa6'), // ✅ Endpoint real pentru adăugare paquete
  updatePaquete: getN8nUrl('/webhook/9a16282e-3651-4ac6-a3da-c31ad18c480b'), // ✅ Endpoint real pentru editare paquete
  
  // Tareas (Daily Tasks)
  getTareasCentro: getN8nUrl('/webhook-test/f2035fa7-7fb7-4a28-bcc9-d24b7cc5294b'), // ✅ Endpoint para tareas por centro
  
  // Contract Downloads
  downloadContract: '/webhook/6cb6b98c-9127-494c-8201-f097d14b9c13', // local path
  
  // AutoFirma Integration
  autofirmaPrepare: getN8nUrl('/webhook/918cd7f3-c0b6-49da-9218-46723702224d'), // Endpoint real pentru AutoFirma
  autofirmaStatus: getN8nUrl('/webhook-test/status-endpoint-id'), // TODO: Adaugă endpoint-ul de status
  autofirmaDownload: getN8nUrl('/webhook-test/download-endpoint-id'), // TODO: Adaugă endpoint-ul de download
  autofirmaWebhook: getN8nUrl('/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4'), // Endpoint pentru webhook AutoFirma
}; 