/**
 * Helper functions pentru raportarea erorilor prin WhatsApp
 * Reutilizabil pe toate paginile. Numărul folosit: config.WHATSAPP_PHONE (per client) sau parametrul phone.
 */
import { config } from '../config/env.js';

// Helper: escape safe strings
export const safe = (v) => (v === null || v === undefined ? "" : String(v).trim());

// Helper: format date/time in Spanish (Europe/Madrid)
export const formatDateTimeES = (d = new Date()) => {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    // fallback
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
};

/**
 * Construiește mesajul de raportare eroare pentru WhatsApp
 * @param {Object} options - Opțiuni pentru mesaj
 * @param {Object} options.authUser - Utilizatorul autentificat
 * @param {Object} options.userData - Datele complete ale utilizatorului (opțional)
 * @param {string} options.pageName - Numele paginii (ex: "Registro de Jornada", "Gestión de Solicitudes")
 * @param {Object} options.pageData - Date specifice paginii (opțional)
 * @returns {string} Mesajul formatat pentru WhatsApp
 */
export const buildErrorReportMessage = ({
  authUser,
  userData = null,
  pageName,
  pageData = {},
}) => {
  const now = formatDateTimeES(new Date());

  // User data (best effort - multiple fallbacks)
  const codigo = safe(
    authUser?.CODIGO || 
    authUser?.codigo || 
    userData?.CODIGO || 
    userData?.codigo
  );
  const nombre = safe(
    authUser?.['NOMBRE / APELLIDOS'] || 
    authUser?.NOMBRE || 
    authUser?.nombre || 
    userData?.['NOMBRE / APELLIDOS'] || 
    userData?.NOMBRE || 
    userData?.nombre
  ) || "—";
  const centro = safe(
    authUser?.['CENTRO TRABAJO'] || 
    authUser?.CENTRO_TRABAJO || 
    authUser?.centro || 
    userData?.['CENTRO TRABAJO']
  );
  const grupo = safe(
    authUser?.GRUPO || 
    authUser?.grupo || 
    userData?.GRUPO
  );

  // Build message in Spanish, clear and concise
  const msg = [
    "Hola, tengo un problema con el sistema.",
    "",
    `📋 PAGINA: ${pageName}`,
    `👤 EMPLEADO: ${nombre}${codigo ? ` (Código: ${codigo})` : ""}`,
    `📅 FECHA: ${now}`,
    centro || grupo ? `🏢 CENTRO: ${[centro, grupo].filter(Boolean).join(" / ")}` : null,
    "",
    // Page-specific data
    ...(pageData.additionalInfo || []),
  ]
    .filter(Boolean)
    .join("\n");

  return msg;
};

/**
 * Deschide WhatsApp cu mesajul de raportare eroare
 * @param {string} message - Mesajul formatat
 * @param {string} [phone] - Numărul de telefon (E.164); dacă lipsește, folosește config.WHATSAPP_PHONE (per client)
 */
export const openWhatsAppErrorReport = (message, phone) => {
  const whatsappPhone = phone || config.WHATSAPP_PHONE || '34635289087';
  const text = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${text}`;
  
  // Try WhatsApp Desktop protocol first (opens in app, not browser)
  const whatsappDesktopUrl = `whatsapp://send?phone=${whatsappPhone}&text=${text}`;
  
  // Create a temporary link to try WhatsApp Desktop
  const link = document.createElement('a');
  link.href = whatsappDesktopUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Fallback to web WhatsApp after a delay
  setTimeout(() => {
    if (document.hasFocus()) {
      window.location.href = whatsappUrl;
    }
  }, 1000);
};
