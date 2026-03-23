/**
 * Export cuadrante din assistant: rezumat (TotalHoras) + detaliu pe zile (ZI_*).
 * Suportă două forme:
 * - Cuadrante lunar: NOMBRE, LUNA, ZI_1…ZI_31
 * - plan_trabajo_dia (asistent): nombre, fecha, valor_celula_cuadrante, horas_plan, fuente…
 */

/** @param {unknown} v */
function fechaToYmd(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

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

/**
 * Valoare afișabilă pentru o zi din plan_trabajo_dia (fără coloane ZI_*).
 * @param {Record<string, unknown>} row
 */
function buildValorCeldaFromDailyPlanRow(row) {
  const vc = row.valor_celula_cuadrante ?? row.VALOR_CELULA_CUADRANTE;
  if (vc != null && String(vc).trim() !== '') return String(vc).trim();
  const hp = Number(row.horas_plan);
  if (!Number.isNaN(hp) && hp > 0) {
    const bits = [];
    const fuente = row.fuente ?? row.FUENTE;
    if (fuente) bits.push(String(fuente));
    bits.push(`${hp}h`);
    const mc = row.cliente_horario_multicentro ?? row.CLIENTE_HORARIO_MULTICENTRO;
    if (mc) bits.push(`(${String(mc)})`);
    return bits.join(' ');
  }
  return 'LIBRE';
}

/**
 * Rând plan_trabajo_dia sau similar → formă cu CODIGO, NOMBRE, LUNA, ZI_1… (dacă lipseau).
 * @param {Record<string, unknown>} row
 */
export function normalizeCuadranteExportRow(row) {
  if (!row || typeof row !== 'object') return row;
  const CODIGO = String(row.CODIGO ?? row.empleadoId ?? row.codigo ?? '').trim();
  const NOMBRE = String(
    row.NOMBRE ??
      row.nombre ??
      row['NOMBRE / APELLIDOS'] ??
      row.empleadoNombre ??
      '',
  ).trim();
  let LUNA = row.LUNA ?? row.luna;
  if (LUNA == null || LUNA === '') {
    const fecha = row.fecha ?? row.FECHA;
    if (fecha) {
      const ymd = fechaToYmd(fecha);
      const m = ymd.match(/^(\d{4}-\d{2})/);
      LUNA = m ? m[1] : '';
    } else {
      LUNA = '';
    }
  } else {
    LUNA = String(LUNA);
  }
  const CENTRO = String(
    row.CENTRO ?? row.centro ?? row['CENTRO TRABAJO'] ?? '',
  ).trim();

  const hasZi = Object.keys(row).some((k) => /^ZI_\d+$/i.test(k));
  const out = { ...row, CODIGO, NOMBRE, LUNA, CENTRO };

  const th = row.TotalHoras ?? row.totalHoras;
  if (th != null && th !== '') out.TotalHoras = th;
  else if (row.horas_plan != null && row.horas_plan !== '') {
    out.TotalHoras = String(row.horas_plan);
  }

  if (!hasZi && row.fecha) {
    const fechaStr = fechaToYmd(row.fecha);
    const parts = fechaStr.split('-');
    const dayNum = parts.length >= 3 ? parseInt(parts[2], 10) : NaN;
    if (dayNum >= 1 && dayNum <= 31) {
      const cellVal = buildValorCeldaFromDailyPlanRow(row);
      for (let d = 1; d <= 31; d++) {
        const zk = `ZI_${d}`;
        out[zk] = d === dayNum ? cellVal : row[zk] ?? '';
      }
    }
  }

  return out;
}

const RESUMEN_KEYS = ['id', 'CODIGO', 'NOMBRE', 'LUNA', 'CENTRO', 'TotalHoras'];

/** @param {Record<string, unknown>} row */
export function pickCuadranteResumenRow(row) {
  if (!row || typeof row !== 'object') return {};
  const normalized = normalizeCuadranteExportRow(row);
  const o = {};
  for (const k of RESUMEN_KEYS) {
    if (normalized[k] != null && normalized[k] !== '') o[k] = normalized[k];
  }
  return o;
}

/**
 * O filă per angajat: câte o linie pe zi din lună (după LUNA), cu valoarea din ZI_d.
 * @param {Record<string, unknown>[]} datos rânduri cu ZI_1…ZI_31 sau plan_trabajo_dia
 * @returns {Record<string, unknown>[]}
 */
export function buildCuadranteDetallePorDiaRows(datos) {
  if (!Array.isArray(datos)) return [];
  const out = [];
  for (const raw of datos) {
    const row = normalizeCuadranteExportRow(raw);
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
        Valor_celda:
          valor != null && String(valor).trim() !== ''
            ? String(valor)
            : '—',
      });
    }
  }
  return out;
}
