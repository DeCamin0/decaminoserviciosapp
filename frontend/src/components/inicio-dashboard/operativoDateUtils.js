/** Date helpers for Resumen operativo (local calendar, YYYY-MM-DD). */

export function toYmd(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentMonthKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse flexible fecha / "YYYY-MM-DD - YYYY-MM-DD" → { start, end } YMD */
export function parseFechaRange(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(
    /(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})/,
  );
  if (!m) return null;
  if (m[1] && m[2]) return { start: m[1], end: m[2] };
  if (m[3]) return { start: m[3], end: m[3] };
  return null;
}

export function ymdInRange(ymd, start, end) {
  if (!ymd || !start || !end) return false;
  return ymd >= start && ymd <= end;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Inclusive day count between two YMD (approx calendar days). */
export function countDaysInclusive(start, end) {
  if (!start || !end || start > end) return 0;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/** Days of [start,end] that fall inside [winStart, winEnd]. */
export function countDaysInWindow(start, end, winStart, winEnd) {
  if (!rangesOverlap(start, end, winStart, winEnd)) return 0;
  const s = start < winStart ? winStart : start;
  const e = end > winEnd ? winEnd : end;
  return countDaysInclusive(s, e);
}

export function monthWindow(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m) return null;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

export function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
