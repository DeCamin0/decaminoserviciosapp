/**
 * Reporte de incidencias: Telegram (bot general) + abrir el asistente del portal.
 * Ya no se usa WhatsApp.
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
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
};

/**
 * Construiește mesajul de raportare (asistente + Telegram)
 */
export const buildErrorReportMessage = ({
  authUser,
  userData = null,
  pageName,
  pageData = {},
}) => {
  const now = formatDateTimeES(new Date());

  const codigo = safe(
    authUser?.CODIGO ||
      authUser?.codigo ||
      userData?.CODIGO ||
      userData?.codigo
  );
  const nombre =
    safe(
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
    authUser?.GRUPO || authUser?.grupo || userData?.GRUPO
  );

  const msg = [
    "Hola, tengo un problema con el sistema.",
    "",
    `📋 PAGINA: ${pageName}`,
    `👤 EMPLEADO: ${nombre}${codigo ? ` (Código: ${codigo})` : ""}`,
    `📅 FECHA: ${now}`,
    centro || grupo ? `🏢 CENTRO: ${[centro, grupo].filter(Boolean).join(" / ")}` : null,
    "",
    ...(pageData.additionalInfo || []),
  ]
    .filter(Boolean)
    .join("\n");

  return msg;
};

/** Evento: ChatBot abre el panel y rellena el mensaje */
export const DECAMINO_OPEN_ASSISTANT_EVENT = 'decamino-open-assistant';

function telegramPayload(message) {
  return `🐞 Reporte de incidencia (portal)\n\n${message}`;
}

/**
 * Envía el texto al bot Telegram "general" (mismo criterio que otros avisos de error).
 */
export async function sendErrorReportToTelegram(message) {
  const baseUrl =
    config.BACKEND_BASE || config.API_URL || config.API_BASE_URL || '';
  if (!baseUrl) return false;
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${baseUrl}/api/monitoring/telegram`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: telegramPayload(message),
        botType: 'general',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Flujo unificado: Telegram (sin email) + abrir asistente con el texto en el compositor.
 * Si algún código antiguo pasa un segundo argumento (teléfono), JavaScript lo ignora.
 */
export const openWhatsAppErrorReport = (message) => {
  void sendErrorReportToTelegram(message).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DECAMINO_OPEN_ASSISTANT_EVENT, {
        detail: {
          initialMessage: typeof message === 'string' ? message : '',
          /** Envía el informe al API del asistente sin pedir Enter (mismo contexto que Telegram). */
          autoSend: true,
        },
      }),
    );
  }
};
