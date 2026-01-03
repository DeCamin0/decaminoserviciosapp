// API Endpoints - Import from routes.js for centralized management
import { routes } from './routes.js';

export const API_ENDPOINTS = {
  USERS: routes.getEmpleados,
  UPDATE_USER: routes.updateUser,
  CHANGE_PASSWORD: routes.changePassword,
  GET_PASSWORD: routes.getPassword,
  FICHAJE: routes.getFichajes,
  REGISTROS: routes.getRegistros,
  ULTIMO_REGISTRO: routes.getUltimoRegistro,
  REGISTROS_EMPLEADOS: routes.getRegistrosEmpleados,
  REGISTROS_PERIODO: routes.getRegistrosPeriodo,
  FICHAJE_ADD: routes.addFichaje,
  FICHAJE_UPDATE: routes.updateFichaje,
  FICHAJE_DELETE: routes.deleteFichaje,
  
  // Aprobaciones
  GET_CAMBIOS_PENDIENTES: routes.getCambiosPendientes,
  APPROVE_CAMBIO: routes.approveCambio,
  REJECT_CAMBIO: routes.rejectCambio,
  
  // Inspecciones
  GET_INSPECCIONES: routes.getInspecciones,
  ADD_INSPECCION: routes.addInspeccion,
  GET_INSPECTION_PDF: routes.getInspectionPDF,
  DOWNLOAD_INSPECTION_DOCUMENT: routes.downloadInspectionDocument,
};

// User Roles
export const USER_ROLES = {
  EMPLEADOS: 'EMPLEADOS',
  MANAGER: 'MANAGER',
  DEVELOPER: 'DEVELOPER',
};

// Form Fields
export const SHEET_FIELDS = [
  'CODIGO',
  'NOMBRE / APELLIDOS',
  'NACIONALIDAD',
  'DIRECCION',
  'D.N.I. / NIE',
  'SEG. SOCIAL',
  'Nº Cuenta',
  'TELEFONO',
  'CORREO ELECTRONICO',
  'FECHA NACIMIENTO',
  'FECHA DE ALTA',
  'CENTRO TRABAJO',
  'TIPO DE CONTRATO',
  'SUELDO BRUTO MENSUAL',
  'HORAS DE CONTRATO',
  'EMPRESA',
  'GRUPO',
  'ESTADO',
  'FECHA BAJA',
  'Fecha Antigüedad',
  'Antigüedad',
  'DerechoPedidos',
  'TrabajaFestivos',
  'Contraseña',
  'CuantoPuedeGastar',
];

// Routes
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  DATOS: '/datos',
  SOLICITUDES: '/solicitudes',
  EMPLEADOS: '/empleados',
  FICHAJE: '/fichaje',
  DOCUMENTOS: '/documentos',
  CUADRANTES: '/cuadrantes',
  CUADRANTES_EMPLEADO: '/cuadrantes-empleado',
  CLIENTES: '/clientes',
  APROBACIONES: '/aprobaciones',
  ESTADISTICAS: '/estadisticas',
  ESTADISTICAS_EMPLEADOS: '/estadisticas-empleados',
  ESTADISTICAS_FICHAJES: '/estadisticas-fichajes',
  ESTADISTICAS_CUADRANTES: '/estadisticas-cuadrantes',
  INSPECCIONES: '/inspecciones',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'user',
}; 