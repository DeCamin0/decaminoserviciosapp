/**
 * Preview + optional clean of garbage FECHA BAJA values.
 * Only touches clearly invalid values (contains "undefined", "null", "Invalid Date",
 * empty-ish, or not matching DD/MM/YYYY | YYYY-MM-DD).
 *
 *   node scripts/clean-fecha-baja-garbage.js .env.decamino.local
 *   node scripts/clean-fecha-baja-garbage.js .env.hera.local --apply
 */
const path = require('path');
const fs = require('fs');

const envArg = process.argv[2] || '.env';
const apply = process.argv.includes('--apply');
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

function isGarbageFechaBaja(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return true; // empty string → treat as cleanable to NULL
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
  // Valid shapes we keep: DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return false;
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)) return false;
  // Anything else with letters or "undefined" patterns already caught; leftover junk
  if (!/\d{4}/.test(s)) return true;
  return false;
}

async function run() {
  console.log('Env:', envPath, apply ? '(APPLY)' : '(preview only)');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT CODIGO, \`NOMBRE / APELLIDOS\` AS nombre, \`FECHA BAJA\` AS fecha_baja, ESTADO
    FROM DatosEmpleados
    WHERE \`FECHA BAJA\` IS NOT NULL AND TRIM(\`FECHA BAJA\`) <> ''
  `);

  const garbage = [];
  const keep = [];
  for (const r of rows) {
    if (isGarbageFechaBaja(r.fecha_baja)) garbage.push(r);
    else keep.push(r);
  }

  console.log(`Total with FECHA BAJA set: ${rows.length}`);
  console.log(`Keep (looks valid): ${keep.length}`);
  console.log(`Garbage candidates: ${garbage.length}`);
  for (const g of garbage.slice(0, 50)) {
    console.log(
      `  CODIGO=${g.CODIGO} ESTADO=${g.ESTADO} FECHA BAJA=${JSON.stringify(String(g.fecha_baja))} | ${g.nombre}`,
    );
  }
  if (garbage.length > 50) console.log(`  ... +${garbage.length - 50} more`);

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to SET FECHA BAJA = NULL for garbage rows.');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const g of garbage) {
    await prisma.$executeRawUnsafe(
      `UPDATE DatosEmpleados SET \`FECHA BAJA\` = NULL WHERE CODIGO = ? AND \`FECHA BAJA\` = ?`,
      String(g.CODIGO),
      String(g.fecha_baja),
    );
    updated += 1;
  }
  console.log(`\n✅ Cleared FECHA BAJA on ${updated} row(s).`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
