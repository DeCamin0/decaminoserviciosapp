/**
 * Crea vacaciones_disponibilidad_config (% grupo en vacaciones simultáneas).
 * Aplicar en AMBAS bases:
 *   node scripts/run-vacaciones-disponibilidad-config-migration.js .env.decamino.local
 *   node scripts/run-vacaciones-disponibilidad-config-migration.js .env.hera.local
 */
const path = require('path');
const fs = require('fs');

const envArg = process.argv[2] || '.env';
const envPath = path.isAbsolute(envArg)
  ? envArg
  : path.join(__dirname, '..', envArg);
if (!fs.existsSync(envPath)) {
  console.error('No existe:', envPath);
  process.exit(1);
}
const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
for (const line of lines) {
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
console.log('Env:', envPath);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS \`vacaciones_disponibilidad_config\` (
  \`id\` INT NOT NULL PRIMARY KEY DEFAULT 1,
  \`porcentaje_grupo\` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const INSERT_SQL = `
INSERT IGNORE INTO \`vacaciones_disponibilidad_config\` (\`id\`, \`porcentaje_grupo\`) VALUES (1, 10.00)
`;

async function run() {
  await prisma.$executeRawUnsafe(CREATE_SQL);
  console.log('✅ CREATE TABLE vacaciones_disponibilidad_config');
  await prisma.$executeRawUnsafe(INSERT_SQL);
  console.log('✅ INSERT default row (si no existía)');
  await prisma.$disconnect();
  console.log('Listo.');
}

run().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
