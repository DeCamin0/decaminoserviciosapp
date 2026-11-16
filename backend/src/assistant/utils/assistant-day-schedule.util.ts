import {
  extractRelativeDayIso,
  messageImpliesWholeMonthSchedule,
} from './month-and-relative-dates.util';

function fold(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** „qué horario tengo” = programul celui care întreabă, nu tot centrul. */
export function messageAsksOwnSchedule(raw: string): boolean {
  const n = fold(raw);
  if (/\b(tiene|tienen|empleado|empleados|compa[nñ]ero)\b/.test(n))
    return false;
  return /\b(tengo|mi horario|mi cuadrante|mi turno|orarul meu|programul meu)\b/.test(
    n,
  );
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is Record<string, unknown> =>
      row != null && typeof row === 'object' && !Array.isArray(row),
  );
}

function dayLabel(fechaIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso.trim());
  if (!m) return fechaIso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function cellText(row: Record<string, unknown>): string {
  const cell = String(row.valor_celula_cuadrante ?? '').trim();
  const horasRaw = row.horas_plan ?? row.horas_cuadrante_dia;
  const horas =
    horasRaw != null && String(horasRaw).trim() !== '' ? String(horasRaw) : '';
  const trabaja = Number(row.trabaja_este_dia) === 1 || Number(horas) > 0;
  const estado = cell || (trabaja ? 'trabaja' : 'libre');
  const centro = String(row.centro ?? row.CENTRO ?? '').trim();
  const horasBit = horas ? `, ${horas} h` : '';
  const centroBit = centro ? ` — ${centro}` : '';
  return `${estado}${horasBit}${centroBit}`;
}

/**
 * Răspuns fix pentru „hoy”: o zi, din rândurile deja citite. Fără model.
 * null dacă întrebarea nu e o singură zi.
 */
export function replyForSingleDaySchedule(
  mensaje: string,
  fecha: string | undefined,
  data: unknown,
  locale: 'es' | 'ro' | 'en' = 'es',
): string | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  if (messageImpliesWholeMonthSchedule(mensaje)) return null;
  if (!extractRelativeDayIso(mensaje)) return null;

  const label = dayLabel(fecha);
  const rows = asRows(data);
  if (rows.length === 0) {
    if (locale === 'ro') return `Nu există program încărcat pentru ${label}.`;
    if (locale === 'en') return `No schedule is loaded for ${label}.`;
    return `No hay horario cargado para el ${label}.`;
  }

  const lines = rows.slice(0, 12).map((row, i) => {
    const nombre = String(row.nombre ?? row.NOMBRE ?? '').trim() || '—';
    return `${i + 1}. ${nombre}: ${cellText(row)}`;
  });
  const extra =
    rows.length > lines.length
      ? locale === 'ro'
        ? `\n… și încă ${rows.length - lines.length}.`
        : `\n… y ${rows.length - lines.length} más.`
      : '';
  if (locale === 'ro') {
    return `Programul din ${label} (doar ziua asta):\n${lines.join('\n')}${extra}`;
  }
  if (locale === 'en') {
    return `Schedule for ${label} (that day only):\n${lines.join('\n')}${extra}`;
  }
  return `Horario del ${label} (solo ese día):\n${lines.join('\n')}${extra}`;
}
