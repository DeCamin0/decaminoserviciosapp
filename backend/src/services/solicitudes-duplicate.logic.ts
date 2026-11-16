import { madridIsoDate } from './permiso-retribuido-duration.logic';

const ACTIVE_ESTADOS = new Set(['Pendiente', 'Aprobada']);

export type SolicitudIdentity = {
  id?: unknown;
  codigo?: unknown;
  tipo?: unknown;
  estado?: unknown;
  fecha_inicio?: unknown;
  fecha_fin?: unknown;
};

export function canonicalSolicitudTipo(tipo: unknown): string {
  const text = String(tipo ?? '').trim();
  const lower = text.toLowerCase();
  if (text === 'Asuntos Propios' || text === 'Asunto Propio')
    return 'Asunto Propio';
  if (text === 'Vacación' || text === 'Vacaciones') return 'Vacaciones';
  if (lower === 'ausencias justificada' || lower === 'ausencia justificada') {
    return 'Ausencias justificada';
  }
  return text;
}

export function calendarDayCount(inicio: string, fin: string): number {
  const [y1, m1, d1] = inicio.split('-').map(Number);
  const [y2, m2, d2] = fin.split('-').map(Number);
  if (![y1, m1, d1, y2, m2, d2].every((n) => Number.isFinite(n))) return 0;
  return (
    Math.floor(
      (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
    ) + 1
  );
}

export function solicitudCalendarRange(
  inicio: unknown,
  fin: unknown,
): { inicio: string; fin: string; dias: number } | null {
  const start = madridIsoDate(inicio);
  const end = madridIsoDate(fin ?? inicio);
  if (!start || !end) return null;
  const dias = calendarDayCount(start, end);
  if (dias < 1) return null;
  return { inicio: start, fin: end, dias };
}

/** Aceeași cerere = același angajat, același tip, aceleași limite și deci același număr de zile. */
export function isExactSolicitudDuplicate(
  existing: SolicitudIdentity,
  incoming: SolicitudIdentity,
): boolean {
  const existingId = String(existing.id ?? '').trim();
  const incomingId = String(incoming.id ?? '').trim();
  if (incomingId && existingId && incomingId === existingId) return false;
  if (!ACTIVE_ESTADOS.has(String(existing.estado ?? '').trim())) return false;
  if (
    canonicalSolicitudTipo(existing.tipo) !==
    canonicalSolicitudTipo(incoming.tipo)
  ) {
    return false;
  }
  const existingCodigo = String(existing.codigo ?? '').trim();
  const incomingCodigo = String(incoming.codigo ?? '').trim();
  if (!existingCodigo || !incomingCodigo || existingCodigo !== incomingCodigo) {
    return false;
  }
  const left = solicitudCalendarRange(
    existing.fecha_inicio,
    existing.fecha_fin,
  );
  const right = solicitudCalendarRange(
    incoming.fecha_inicio,
    incoming.fecha_fin,
  );
  if (!left || !right) return false;
  return (
    left.inicio === right.inicio &&
    left.fin === right.fin &&
    left.dias === right.dias
  );
}

function formatEs(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function exactDuplicateMessage(
  tipo: string,
  inicio: string,
  fin: string,
  dias: number,
): string {
  const label = canonicalSolicitudTipo(tipo);
  const when =
    inicio === fin
      ? formatEs(inicio)
      : `${formatEs(inicio)} - ${formatEs(fin)}`;
  const dayLabel = `${dias} día${dias === 1 ? '' : 's'}`;
  return `Ya existe una solicitud de ${label} con las mismas fechas (${when}, ${dayLabel}). No se puede registrar otra igual.`;
}
