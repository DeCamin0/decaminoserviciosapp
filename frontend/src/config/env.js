// Configuration file for environment variables.
// Multi-client: set all VITE_* in .env per build. No hardcoded fallbacks.

const inferApiBase = () => {
  const fromEnv = import.meta.env.VITE_API_BASE;
  if (fromEnv && typeof fromEnv === 'string') return fromEnv;
  return '/api';
};

const fromEnv = (key) => (import.meta.env[key] != null && String(import.meta.env[key]).trim() !== '' ? String(import.meta.env[key]).trim() : '');

// API URLs. HERA (mode client2 | hera): dacă VITE_API_URL/VITE_API_BASE_URL sunt setate (prod) le folosim, altfel localhost:3002.
const isHera = typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.MODE === 'client2' || import.meta.env.MODE === 'hera');
const HERA_BASE = 'http://localhost:3002';
const API_URL_RAW = fromEnv('VITE_API_URL');
const API_BASE_URL_RAW = fromEnv('VITE_API_BASE_URL') || API_URL_RAW;
let API_URL = isHera ? (API_URL_RAW || HERA_BASE) : API_URL_RAW;
let API_BASE_URL_FULL = isHera ? (API_BASE_URL_RAW || HERA_BASE) : API_BASE_URL_RAW;
const API_BASE_RELATIVE = inferApiBase();
const devFallback = isHera ? HERA_BASE : 'http://localhost:3000';
const BACKEND_BASE =
  API_BASE_URL_FULL ||
  API_URL ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
    ? devFallback
    : '');
if (BACKEND_BASE) {
  API_URL = BACKEND_BASE;
  API_BASE_URL_FULL = BACKEND_BASE;
}

export const config = {
  API_URL,
  API_BASE_URL: API_BASE_URL_FULL,
  API_BASE: API_BASE_RELATIVE,
  BACKEND_BASE,
  /** true când MODE=client2|hera (presupuesto/informe folosesc logo și stamp HERA) */
  IS_HERA: isHera,

  BASE_PATH: fromEnv('VITE_BASE_PATH') || '/',
  LOGO_PATH: fromEnv('VITE_LOGO_PATH') || 'logo.svg',

  COMPANY_NAME: fromEnv('VITE_COMPANY_NAME'),
  COMPANY_NAME_LEGAL: fromEnv('VITE_COMPANY_NAME_LEGAL'),
  COMPANY_EMAIL: fromEnv('VITE_COMPANY_EMAIL'),
  /** Email gestoria (destinatatar default la "Enviar a gestoria"). Decamino vs HERA din .env per build. */
  COMPANY_GESTORIA_EMAIL: fromEnv('VITE_COMPANY_GESTORIA_EMAIL') || fromEnv('VITE_COMPANY_EMAIL'),
  COMPANY_PHONE: fromEnv('VITE_COMPANY_PHONE'),
  COMPANY_CIF: fromEnv('VITE_COMPANY_CIF'),
  COMPANY_ADDRESS: fromEnv('VITE_COMPANY_ADDRESS'),
  COMPANY_CP_POBLACION: fromEnv('VITE_COMPANY_CP_POBLACION'),
  /** Număr WhatsApp pentru raportare erori / contact (E.164 fără +, ex: 34600522737). La HERA: 600 52 27 37 */
  WHATSAPP_PHONE: fromEnv('VITE_WHATSAPP_PHONE') || '34635289087',

  PRIMARY_COLOR: fromEnv('VITE_PRIMARY_COLOR') || '#CC0000',

  APP_NAME: fromEnv('VITE_APP_NAME') || fromEnv('VITE_COMPANY_NAME'),
  APP_VERSION: fromEnv('VITE_APP_VERSION') || '1.0.0',
  /** URL de la aplicación interna (email bienvenida). Por build: Decamino → app.decaminoservicios.com, HERA → app.herafs.com; o VITE_APP_URL */
  APP_URL: fromEnv('VITE_APP_URL'),

  N8N_BASE_URL: fromEnv('VITE_N8N_BASE_URL'),

  EXTERNAL_SITE_URL: fromEnv('VITE_EXTERNAL_SITE_URL'),

  SIGNING_MOCK: import.meta.env.VITE_SIGNING_MOCK === '1',
  ENABLE_EINVOICE_XML: import.meta.env.VITE_ENABLE_EINVOICE_XML === 'true' || true,
  UPLOAD_BAJAS_MEDICAS: import.meta.env.VITE_UPLOAD_BAJAS_MEDICAS === 'true',

  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true' || false,
  PDF_QUALITY: fromEnv('VITE_PDF_QUALITY') || 'high',
  MAX_FILE_SIZE: import.meta.env.VITE_MAX_FILE_SIZE ? parseInt(import.meta.env.VITE_MAX_FILE_SIZE, 10) : 30 * 1024 * 1024,

  /** Etiqueta sección nóminas: Decamino = "Nóminas", HERA = "Hojas de salario" (sin tocar lógica) */
  NOMINAS_LABEL: fromEnv('VITE_NOMINAS_LABEL') || (isHera ? 'Hojas de salario' : 'Nóminas'),
  /** Singular para mensajes: "subir nómina" / "hoja de salario" */
  NOMINAS_LABEL_SINGULAR: fromEnv('VITE_NOMINAS_LABEL_SINGULAR') || (isHera ? 'hoja de salario' : 'nómina'),

  /**
   * Asistente IA: si es 'false', solo Manager/Supervisor/Developer ven el chat.
   * Por defecto true (empleados autenticados con JWT; permisos reales en backend).
   */
  ASSISTANT_FOR_EMPLOYEES:
    String(import.meta.env.VITE_ASSISTANT_FOR_EMPLOYEES || 'true').toLowerCase() !==
    'false',
};

/**
 * URL pública de acceso al portal de una comunidad (enlace dedicado + QR).
 * Usa VITE_APP_URL en producción si está definida; si no, `window.location.origin`.
 */
export function buildPortalClienteUrl(portalToken) {
  const t = String(portalToken || '').trim();
  if (!t) return '';
  const origin =
    config.APP_URL && /^https?:\/\//i.test(String(config.APP_URL).trim())
      ? String(config.APP_URL).trim().replace(/\/$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  const rawBase =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/';
  const baseSeg =
    rawBase === '/' ? '' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
  if (!origin) {
    return `${baseSeg ? `${baseSeg}` : ''}/portal/${t}`.replace(/^\/{2,}/, '/');
  }
  return `${origin}${baseSeg}/portal/${t}`.replace(/([^:])\/{2,}/g, '$1/');
}

/** URL del portal para administradores con varias comunidades (sin token en la ruta). */
export function buildPortalGestoresUrl() {
  const origin =
    config.APP_URL && /^https?:\/\//i.test(String(config.APP_URL).trim())
      ? String(config.APP_URL).trim().replace(/\/$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  const rawBase =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/';
  const baseSeg =
    rawBase === '/' ? '' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
  const path = `${baseSeg}/portal/gestores`.replace(/^\/{2,}/, '/');
  if (!origin) return path.startsWith('/') ? path : `/${path}`;
  return `${origin}${path}`.replace(/([^:])\/{2,}/g, '$1/');
}

export const isEInvoiceXMLEnabled = () => config.ENABLE_EINVOICE_XML;
export const getApiUrl = (endpoint) => `${config.API_BASE}${endpoint}`;
