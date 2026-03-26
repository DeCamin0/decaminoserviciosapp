/**
 * Compară doi angajați (CODIGO) pentru logica tabelului violet (Limpiador / Auxiliar L &lt; 8 h/día).
 * Usage (din folder backend, cu .env care are DATABASE_URL):
 *   node scripts/compare-empleados-violet-list.js 10000139 10000095
 *
 * Opțional: fișier env
 *   node scripts/compare-empleados-violet-list.js 10000139 10000095 .env
 */
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

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

const envArg = process.argv[4];
const envPath = envArg
  ? path.isAbsolute(envArg)
    ? envArg
    : path.join(backendDir, envArg)
  : path.join(backendDir, '.env');
if (!process.env.DATABASE_URL) {
  loadDatabaseUrlFromEnvFile(envPath) || loadDatabaseUrlFromEnvFile(path.join(backendDir, '.env'));
}

const normalizeGroup = (groupName) => {
  if (!groupName || typeof groupName !== 'string') return groupName || '';
  const trimmed = groupName.trim();
  const groupMapping = {
    Limpiador: 'Limpiador',
    'Auxiliar De Servicios - L': 'Limpiador',
  };
  return groupMapping[trimmed] || trimmed;
};

const parseHorasContrato = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(String(m[1]).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const inferDailyMonFri = (n) => {
  if (n > 12) return n / 5;
  return n;
};

const TARGET_DAILY = 8;

function diagnose(row) {
  const rawGrupo = String(row['GRUPO'] || row.grupo || '').trim();
  const ng = normalizeGroup(rawGrupo);
  const activo =
    String(row?.ESTADO ?? row?.estado ?? '')
      .trim()
      .toUpperCase() === 'ACTIVO';

  const rawHoras =
    row['HORAS DE CONTRATO'] ??
    row.HORAS_DE_CONTRATO ??
    row.horas_contrato ??
    row.horasContrato;
  const num = parseHorasContrato(rawHoras);
  const horasDia = num != null ? inferDailyMonFri(num) : null;
  const inVioletGroup = ng === 'Limpiador';
  const under8 =
    horasDia != null && horasDia < TARGET_DAILY - 1e-6;
  const included =
    activo && inVioletGroup && num != null && under8;

  let excludeReason = null;
  if (!activo) excludeReason = 'ESTADO no es ACTIVO';
  else if (!inVioletGroup)
    excludeReason = `GRUPO no mapea a Limpiador (raw: "${rawGrupo}")`;
  else if (num == null)
    excludeReason = 'HORAS DE CONTRATO vacío o no parseable';
  else if (!under8)
    excludeReason = `h/día implicada ${horasDia?.toFixed(2)} ≥ 8 (contrato parseado: ${num})`;

  return {
    activo,
    rawGrupo,
    normalizedGrupo: ng,
    rawHoras: rawHoras == null ? '(null)' : String(rawHoras),
    parsedNum: num,
    horasDia,
    inVioletGroup,
    under8,
    included,
    excludeReason,
  };
}

async function main() {
  const a = process.argv[2] || '10000139';
  const b = process.argv[3] || '10000095';
  if (!process.env.DATABASE_URL) {
    console.error(
      'Lipsește DATABASE_URL. Rulează din backend cu fișier .env (ex: copiază .env.example și completează).',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const sql = `
    SELECT CODIGO,
           \`NOMBRE / APELLIDOS\` AS nombre,
           ESTADO,
           GRUPO,
           \`CENTRO TRABAJO\` AS centro,
           \`HORAS DE CONTRATO\` AS horas_contrato
    FROM DatosEmpleados
    WHERE CODIGO IN (${[a, b].map((c) => `'${String(c).replace(/'/g, "''")}'`).join(',')})
  `;

  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(sql);
  } catch (e) {
    console.error('Query error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  const byCod = {};
  for (const r of rows) {
    byCod[String(r.CODIGO)] = r;
  }

  console.log('=== Comparación empleados → lista violeta (< 8 h/día Limpiador/L) ===\n');
  for (const cod of [a, b]) {
    const row = byCod[cod];
    console.log(`--- CODIGO ${cod} ---`);
    if (!row) {
      console.log('NO ENCONTRADO en DatosEmpleados (no existe fila o CODIGO distinto).\n');
      continue;
    }
    console.log('Nombre:', row.nombre);
    console.log('ESTADO:', row.ESTADO);
    console.log('GRUPO (raw):', JSON.stringify(row.GRUPO));
    console.log('CENTRO TRABAJO:', row.centro);
    console.log('HORAS DE CONTRATO (raw):', JSON.stringify(row.horas_contrato));

    const d = diagnose(row);
    console.log('\nDiagnóstico (misma lógica que SolicitudesPage.jsx):');
    console.log('  ACTIVO:', d.activo);
    console.log('  Grupo normalizado:', d.normalizedGrupo, d.inVioletGroup ? '→ OK' : '→ NO');
    console.log('  Primer número parseado:', d.parsedNum);
    console.log('  h/día inferida (Lun–Vie):', d.horasDia != null ? d.horasDia.toFixed(4) : '—');
    console.log('  ¿Entraría en tabla violeta?:', d.included ? 'SÍ' : 'NO');
    if (!d.included) console.log('  Motivo:', d.excludeReason);
    console.log('');
  }

  const ra = byCod[a];
  const rb = byCod[b];
  if (ra && rb) {
    console.log('=== DIFERENCIAS campo a campo (raw) ===');
    const keys = ['ESTADO', 'GRUPO', 'horas_contrato', 'centro'];
    for (const k of keys) {
      const va = ra[k] ?? ra[k === 'horas_contrato' ? 'horas_contrato' : k];
      const vb = rb[k] ?? rb[k];
      const same =
        String(va ?? '').trim() === String(vb ?? '').trim();
      console.log(
        `${same ? ' ' : '*'} ${k}: [${a}] ${JSON.stringify(va)}  |  [${b}] ${JSON.stringify(vb)}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
