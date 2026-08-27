/**
 * Resolve in-app path for a notification click.
 * Prefers data.url; falls back by data.kind (mirrors backend notification-kinds).
 */

const KIND_DEFAULT_URLS = {
  FICHAJE_REMINDER: '/fichaje',
  FICHAJE_REGULARIZACION: '/fichaje',
  FICHAJE_APPROVED: '/fichaje',
  SOLICITUD_CREADA: '/solicitudes',
  SOLICITUD_ESTADO: '/solicitudes',
  AUSENCIA_CONVERTIDA: '/solicitudes',
  TAREA_ASIGNADA: '/mis-tareas',
  TAREA_REASIGNADA: '/mis-tareas',
  COMUNICADO: '/comunicados',
  NOMINA_NUEVA: '/documentos-empleados',
  PRL_DOCS_NUEVOS: '/prl-documentos',
  PRL_DOC_PENDIENTE_FIRMA: '/prl-documentos',
  CORREO_NUEVO: '/inicio',
  DOCUMENTO_SOLICITADO: '/documentos',
  PEDIDO_ACTUALIZADO: '/pedidos',
};

export function parseNotificationData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function urlFromTitle(notification) {
  const text = `${notification.title || ''} ${notification.message || ''} ${notification.content || ''}`.toLowerCase();
  if (text.includes('fichaje') || text.includes('fichar')) return '/fichaje';
  if (text.includes('solicitud')) return '/solicitudes';
  if (text.includes('tarea')) return '/mis-tareas';
  if (text.includes('comunicado')) return '/comunicados';
  if (text.includes('prl')) return '/prl-documentos';
  if (text.includes('nómina') || text.includes('nomina')) return '/documentos-empleados';
  if (text.includes('pedido')) return '/pedidos';
  if (text.includes('documento')) return '/documentos';
  return null;
}

/**
 * @param {object} notification
 * @returns {string|null} path starting with /
 */
export function resolveNotificationUrl(notification) {
  if (!notification) return null;
  const data = parseNotificationData(notification.data);
  let raw =
    (typeof data.url === 'string' && data.url) ||
    (typeof notification.url === 'string' && notification.url) ||
    KIND_DEFAULT_URLS[data.kind] ||
    urlFromTitle(notification) ||
    null;

  if (!raw || typeof raw !== 'string') return null;
  raw = raw.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (typeof window !== 'undefined' && u.origin !== window.location.origin) {
        return null;
      }
      return `${u.pathname}${u.search}${u.hash}` || '/';
    } catch {
      return null;
    }
  }

  if (raw.startsWith('/')) return raw;
  return `/${raw}`;
}
