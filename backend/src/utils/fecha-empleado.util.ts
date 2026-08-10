/**
 * Normaliza FECHA BAJA (y fechas similares en DatosEmpleados).
 * Evita tratar "undefined/undefined/" u otros basura como fecha real.
 */

export function isGarbageFechaEmpleado(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes('undefined') ||
    lower.includes('null') ||
    lower.includes('invalid') ||
    lower === 'nan' ||
    /^\/+$/.test(s) ||
    /^[\/\-\s.]+$/.test(s)
  ) {
    return true;
  }
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return false;
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)) return false;
  // Sin año de 4 dígitos → basura
  if (!/\d{4}/.test(s)) return true;
  return false;
}

/** null si vacío o basura; string trim si parece fecha válida. */
export function sanitizeFechaEmpleado(
  raw: unknown,
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isGarbageFechaEmpleado(s)) return null;
  return s;
}

/** true solo si hay una fecha de baja real (bloquea nómina). */
export function hasFechaBajaEstablecida(raw: unknown): boolean {
  return sanitizeFechaEmpleado(raw) != null;
}
