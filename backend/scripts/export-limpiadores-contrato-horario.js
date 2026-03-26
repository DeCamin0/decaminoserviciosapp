/**
 * Lista Limpiador + Auxiliar De Servicios - L (ACTIVO): codigo, nombre, centro,
 * horas contrato (raw), h/săpt din contract (ca SolicitudesPage), h/săpt din horario (catalog).
 *
 * Dacă --out se termină în .xlsx: generează Excel cu ExcelJS — rânduri unde h/sem contrato ≠ h/sem horario
 * (toleranță 0,25 h) au text roșu pe cele două celule și fundal roz deschis pe rând.
 * Altfel: CSV cu coloană «diff» (ATENCION când difera).
 *
 * Usage:
 *   node scripts/export-limpiadores-contrato-horario.js --out=exports/limpiadores.csv
 *   node scripts/export-limpiadores-contrato-horario.js --out=exports/limpiadores.xlsx
 */
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

const backendDir = path.join(__dirname, '..');

function loadDatabaseUrlFromEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === 'DATABASE_URL') {
      process.env.DATABASE_URL = val;
      return true;
    }
  }
  return false;
}

const args = process.argv.slice(2);
let envPath = path.join(backendDir, '.env');
for (const a of args) {
  if (a.endsWith('.env') || a.includes('.env.')) {
    envPath = path.isAbsolute(a) ? a : path.join(backendDir, a);
    break;
  }
}
if (!process.env.DATABASE_URL) {
  loadDatabaseUrlFromEnvFile(envPath) || loadDatabaseUrlFromEnvFile(path.join(backendDir, '.env'));
}

const LIMPIADOR_GROUPS = new Set(['Limpiador', 'Auxiliar De Servicios - L']);
/** Diferencia h/sem tolerada antes de marcar mismatch */
const DIFF_TOL_H_SEM = 0.25;
/** Referencia tope semanal para columna «puede subir» */
const MAX_H_SEMANALES_REF = 40;

function parseHorasContrato(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(String(m[1]).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** h/săpt din contract: >12 → valoarea e săptămânală; altfel zilnic × 5 */
function horasSemanalesDesdeContratoParsed(num) {
  if (num == null || !Number.isFinite(num)) return null;
  if (num > 12) return num;
  return num * 5;
}

function diffiereContratoVsHorario(hSemContrato, hSemHorario) {
  if (
    hSemContrato == null ||
    !Number.isFinite(hSemContrato) ||
    hSemHorario == null ||
    !Number.isFinite(hSemHorario)
  ) {
    return false;
  }
  return Math.abs(hSemContrato - hSemHorario) > DIFF_TOL_H_SEM;
}

function parseDateMs(d) {
  if (d == null || d === '') return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function horasSemanalesDesdeHorario(h) {
  if (!h) return null;
  const th = Number(h.total_horas_semanales ?? h.totalHorasSemanales);
  if (Number.isFinite(th) && th > 0) return th;
  const tm = Number(h.total_minutos_semanales ?? h.totalMinutosSemanales);
  if (Number.isFinite(tm) && tm > 0) return tm / 60;
  return null;
}

function findHorarioVigente(horariosCatalog, centro, grupo) {
  const c = String(centro || '').trim().toLowerCase();
  const g = String(grupo || '').trim().toLowerCase();
  if (!c || !g || !horariosCatalog?.length) return null;
  const t = Date.now();
  const candidates = horariosCatalog.filter((h) => {
    const hc = String(h.centro_nombre ?? h.centroNombre ?? '').trim().toLowerCase();
    const hg = String(h.grupo_nombre ?? h.grupoNombre ?? '').trim().toLowerCase();
    return hc === c && hg === g;
  });
  const valid = candidates.filter((h) => {
    const vd = parseDateMs(h.vigente_desde ?? h.vigenteDesde);
    const vh = parseDateMs(h.vigente_hasta ?? h.vigenteHasta);
    const vdOk = vd == null || t >= vd;
    const vhOk = vh == null || t <= vh;
    return vdOk && vhOk;
  });
  const pool = valid.length ? valid : candidates;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r;]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Lipsește DATABASE_URL în .env');
    process.exit(1);
  }

  const outArg = args.find((a) => a.startsWith('--out='));
  const outPath = outArg
    ? path.isAbsolute(outArg.slice(6))
      ? outArg.slice(6)
      : path.join(backendDir, outArg.slice(6))
    : null;

  const prisma = new PrismaClient();

  let empleados;
  let horariosRows;
  try {
    empleados = await prisma.$queryRawUnsafe(`
      SELECT CODIGO,
             TRIM(\`NOMBRE / APELLIDOS\`) AS nombre,
             TRIM(COALESCE(\`CENTRO TRABAJO\`, '')) AS centro,
             TRIM(COALESCE(GRUPO, '')) AS grupo,
             TRIM(COALESCE(\`HORAS DE CONTRATO\`, '')) AS horas_contrato,
             TRIM(COALESCE(ESTADO, '')) AS estado
      FROM DatosEmpleados
      WHERE UPPER(TRIM(COALESCE(ESTADO, ''))) = 'ACTIVO'
    `);
    horariosRows = await prisma.horarios.findMany();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  const limpiadores = empleados.filter((e) => LIMPIADOR_GROUPS.has(String(e.grupo || '').trim()));

  const rows = [];
  const header = [
    'codigo',
    'nombre',
    'centro',
    'grupo',
    'horas_contrato',
    'horas_semanales_contrato',
    'puede_subir_hasta_40_h_sem',
    'horas_semanales_horario',
    'h_dia_horario',
    'horario_id',
    'horario_nombre',
    'diff_contr_vs_hor',
    'notas',
  ];

  for (const e of limpiadores) {
    const hRec = findHorarioVigente(horariosRows, e.centro, e.grupo);
    const hs = horasSemanalesDesdeHorario(hRec);
    const numContr = parseHorasContrato(e.horas_contrato);
    const hSemContr = horasSemanalesDesdeContratoParsed(numContr);
    const hDia =
      hs != null ? Math.round((hs / 5) * 100) / 100 : '';

    const mismatch = diffiereContratoVsHorario(hSemContr, hs);
    const diffLabel =
      hSemContr != null && hs != null
        ? String(Math.round((hs - hSemContr) * 100) / 100)
        : '';
    const puedeSubir40Sem =
      hSemContr != null && Number.isFinite(hSemContr)
        ? Math.round(Math.max(0, MAX_H_SEMANALES_REF - hSemContr) * 100) / 100
        : null;

    const notas = [];
    if (!String(e.horas_contrato || '').trim()) notas.push('FALTA HORAS CONTRATO');
    if (!String(e.centro || '').trim()) notas.push('sin centro');
    if (!hRec) notas.push('sin horario catalogo (centro+grupo)');
    else if (hs == null) notas.push('horario sin total semanal');
    if (mismatch) notas.push('ATENCION: h/sem contrato ≠ h/sem horario');

    rows.push({
      codigo: e.CODIGO,
      nombre: e.nombre,
      centro: e.centro,
      grupo: e.grupo,
      horas_contrato: e.horas_contrato,
      hSemContr,
      puedeSubir40Sem,
      hs,
      hDia,
      horarioId: hRec ? String(hRec.id) : '',
      horarioNombre: hRec ? String(hRec.nombre || '').replace(/\r?\n/g, ' ') : '',
      mismatch,
      diffLabel,
      notas: notas.join(' | '),
    });
  }

  rows.sort((a, b) =>
    String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
  );

  const sep = ';';
  const lines = [
    header.join(sep),
    ...rows.map((r) =>
      [
        r.codigo,
        r.nombre,
        r.centro,
        r.grupo,
        r.horas_contrato,
        r.hSemContr != null ? String(r.hSemContr) : '',
        r.puedeSubir40Sem != null ? String(r.puedeSubir40Sem) : '',
        r.hs != null ? String(r.hs) : '',
        r.hDia !== '' ? String(r.hDia) : '',
        r.horarioId,
        r.horarioNombre,
        r.mismatch ? `SI (${r.diffLabel})` : '',
        r.notas,
      ]
        .map(csvEscape)
        .join(sep),
    ),
  ];
  const text = lines.join('\r\n') + '\r\n';

  const writeXlsx = outPath && outPath.toLowerCase().endsWith('.xlsx');

  if (writeXlsx && outPath) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Limpiadores', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = [
      { header: 'codigo', key: 'codigo', width: 12 },
      { header: 'nombre', key: 'nombre', width: 36 },
      { header: 'centro', key: 'centro', width: 42 },
      { header: 'grupo', key: 'grupo', width: 28 },
      { header: 'horas_contrato', key: 'horas_contrato', width: 14 },
      { header: 'h/sem contrato', key: 'hSemContr', width: 16 },
      {
        header: `puede subir hasta ${MAX_H_SEMANALES_REF} h/sem`,
        key: 'puedeSubir40Sem',
        width: 22,
      },
      { header: 'h/sem horario', key: 'hs', width: 16 },
      { header: 'h/dia horario', key: 'hDia', width: 14 },
      { header: 'horario_id', key: 'horarioId', width: 10 },
      { header: 'horario_nombre', key: 'horarioNombre', width: 28 },
      { header: 'diff (hor-contr)', key: 'diffLabel', width: 14 },
      { header: 'notas', key: 'notas', width: 50 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const fontRed = { color: { argb: 'FFB71C1C' }, bold: true };
    const fillRow = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEBEE' },
    };

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;
      const row = ws.addRow({
        codigo: r.codigo,
        nombre: r.nombre,
        centro: r.centro,
        grupo: r.grupo,
        horas_contrato: r.horas_contrato,
        hSemContr:
          r.hSemContr != null ? Math.round(r.hSemContr * 100) / 100 : '',
        puedeSubir40Sem:
          r.puedeSubir40Sem != null
            ? Math.round(r.puedeSubir40Sem * 100) / 100
            : '',
        hs: r.hs != null ? Math.round(r.hs * 100) / 100 : '',
        hDia: r.hDia !== '' ? r.hDia : '',
        horarioId: r.horarioId,
        horarioNombre: r.horarioNombre,
        diffLabel: r.mismatch ? r.diffLabel : '',
        notas: r.notas,
      });

      if (r.mismatch) {
        row.fill = fillRow;
        const cContr = 6; // h/sem contrato
        const cHor = 8; // h/sem horario (tras «puede subir»)
        row.getCell(cContr).font = fontRed;
        row.getCell(cHor).font = fontRed;
      }
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await wb.xlsx.writeFile(outPath);
    console.error(
      `Escrito (Excel): ${outPath} (${rows.length} filas; filas en rojo: ${rows.filter((x) => x.mismatch).length})`,
    );
  } else {
    process.stdout.write(text);
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, text, 'utf8');
      console.error(`Escrito (CSV): ${outPath} (${rows.length} filas)`);
    } else {
      console.error(
        `(stdout: ${rows.length} filas; --out=...csv o ...xlsx para guardar)`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
