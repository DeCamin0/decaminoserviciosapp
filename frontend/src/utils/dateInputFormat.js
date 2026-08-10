/**
 * Convierte valor de <input type="date"> (YYYY-MM-DD) a DD/MM/YYYY.
 * Si el usuario borra la fecha (value === ''), devuelve '' — nunca "undefined/undefined/".
 */
export function dateInputToDdMmYyyy(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const parts = raw.split('-');
  if (parts.length !== 3) return '';
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return '';
  if (!/^\d{4}$/.test(yyyy) || !/^\d{1,2}$/.test(mm) || !/^\d{1,2}$/.test(dd)) {
    return '';
  }
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
}

/**
 * ¿Es una FECHA BAJA usable (no basura tipo "undefined/undefined/")?
 */
export function isValidFechaBajaDisplay(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes('undefined') ||
    lower.includes('null') ||
    lower.includes('invalid') ||
    lower === 'nan'
  ) {
    return false;
  }
  return (
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s) ||
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)
  );
}
