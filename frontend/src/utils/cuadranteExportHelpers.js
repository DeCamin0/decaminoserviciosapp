/**
 * Export cuadrante din assistant: rezumat (TotalHoras) + detaliu pe zile (ZI_*).
 */

/** @param {string|undefined} luna ex. "2026-03" */
export function getDaysInCuadranteMonth(luna) {
  if (!luna || typeof luna !== 'string') return 31;
  const m = luna.trim().match(/^(\d{4})[-/](\d{1,2})/);
  if (!m) return 31;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return 31;
  return new Date(y, mo, 0).getDate();
}

const RESUMEN_KEYS = ['id', 'CODIGO', 'NOMBRE', 'LUNA', 'CENTRO', 'TotalHoras'];

/** @param {Record<string, unknown>} row */
export function pickCuadranteResumenRow(row) {
  if (!row || typeof row !== 'object') return {};
  const o = {};
  for (const k of RESUMEN_KEYS) {
    if (row[k] != null && row[k] !== '') o[k] = row[k];
  }
  return o;
}

/**
 * O filă per angajat: câte o linie pe zi din lună (după LUNA), cu valoarea din ZI_d.
 * @param {Record<string, unknown>[]} datos rânduri cu ZI_1…ZI_31
 * @returns {Record<string, unknown>[]}
 */
export function buildCuadranteDetallePorDiaRows(datos) {
  if (!Array.isArray(datos)) return [];
  const out = [];
  for (const row of datos) {
    const luna = row.LUNA;
    const maxD = getDaysInCuadranteMonth(
      typeof luna === 'string' ? luna : String(luna ?? ''),
    );
    const codigo = row.CODIGO ?? '';
    const nombre = row.NOMBRE ?? '';
    const lunaStr = luna != null ? String(luna) : '';
    for (let d = 1; d <= maxD; d++) {
      const key = `ZI_${d}`;
      const valor = row[key];
      out.push({
        CODIGO: codigo,
        NOMBRE: nombre,
        LUNA: lunaStr,
        Dia: d,
        Valor_celda: valor != null && String(valor).trim() !== '' ? String(valor) : '—',
      });
    }
  }
  return out;
}
