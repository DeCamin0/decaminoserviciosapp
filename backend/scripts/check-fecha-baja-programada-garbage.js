/**
 * Preview garbage values in fecha_baja_programada (DatosEmpleados).
 *   node scripts/check-fecha-baja-programada-garbage.js .env.decamino.local
 *   node scripts/check-fecha-baja-programada-garbage.js .env.hera.local
 */
const path = require('path');
const fs = require('fs');

const envArg = process.argv[2] || '.env';
const envPath = path.isAbsolute(envArg)
  ? envArg
  : path.join(__dirname, '..', envArg);

for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq <= 0) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isGarbage(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return true;
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
  if (!/\d{4}/.test(s)) return true;
  return false;
}

async function run() {
  console.log('Env:', envPath);
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT CODIGO, \`NOMBRE / APELLIDOS\` AS nombre, fecha_baja_programada, ESTADO
      FROM DatosEmpleados
      WHERE fecha_baja_programada IS NOT NULL AND TRIM(CAST(fecha_baja_programada AS CHAR)) <> ''
    `);
  } catch (e) {
    console.error('Query failed (column missing?):', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  const garbage = [];
  const keep = [];
  const samples = {};
  for (const r of rows) {
    const v = r.fecha_baja_programada;
    const key = JSON.stringify(String(v));
    samples[key] = (samples[key] || 0) + 1;
    if (isGarbage(v)) garbage.push(r);
    else keep.push(r);
  }

  console.log(`Total with fecha_baja_programada set: ${rows.length}`);
  console.log(`Keep (looks valid): ${keep.length}`);
  console.log(`Garbage candidates: ${garbage.length}`);
  console.log('Value distribution (top):');
  Object.entries(samples)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, n]) => console.log(`  ${n}x ${k}`));

  for (const g of garbage.slice(0, 30)) {
    console.log(
      `  CODIGO=${g.CODIGO} ESTADO=${g.ESTADO} fecha_baja_programada=${JSON.stringify(String(g.fecha_baja_programada))} | ${g.nombre}`,
    );
  }
  if (garbage.length > 30) console.log(`  ... +${garbage.length - 30} more`);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
