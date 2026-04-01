/**
 * Cuadrante "visible" para empleado (fichaje, Mi horario).
 * - undefined / null → visible (compatibilidad registros antiguos sin columna).
 * - false, 0, '0', 'false' → no visible.
 * - true, 1, '1', 'true' → visible.
 */
export function isCuadranteRowVisible(c) {
  if (!c) {
    return false;
  }
  const visibleValue = c.visible;

  if (visibleValue === undefined || visibleValue === null) {
    return true;
  }
  if (typeof visibleValue === 'boolean') {
    return visibleValue === true;
  }
  if (typeof visibleValue === 'number') {
    return visibleValue === 1;
  }
  if (typeof visibleValue === 'string') {
    return visibleValue === '1' || visibleValue.toLowerCase() === 'true';
  }
  return false;
}
