/**
 * Añade dias_anuales a asuntos_propios_disponibilidad_config
 * y seed del permiso Access Matrix `asuntos-propios`.
 *
 *   node scripts/run-asuntos-propios-config-migration.js .env.decamino.local
 *   node scripts/run-asuntos-propios-config-migration.js .env.hera.local
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

async function upsertPerm(grupo, module, permitted) {
  const grupoModule = `${grupo}_${module}`;
  await prisma.permissions.upsert({
    where: { grupo_module: grupoModule },
    update: {
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'run-asuntos-propios-config-migration.js',
    },
    create: {
      grupo_module: grupoModule,
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'run-asuntos-propios-config-migration.js',
    },
  });
  console.log(`  ✅ ${grupoModule} = ${permitted}`);
}

async function run() {
  console.log('\n1) Columna dias_anuales...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE asuntos_propios_disponibilidad_config
        ADD COLUMN dias_anuales INT NOT NULL DEFAULT 6
        COMMENT 'Días de Asunto Propio por empleado/año (global empresa)'
    `);
    console.log('  ✅ columna añadida');
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('Duplicate column') || msg.includes('1060')) {
      console.log('  ℹ️  columna ya existe');
    } else {
      throw e;
    }
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO asuntos_propios_disponibilidad_config (id, max_personas_dia, dias_anuales)
    VALUES (1, 3, 6)
    ON DUPLICATE KEY UPDATE id = id
  `);
  console.log('  ✅ fila id=1 ok');

  console.log('\n2) Permisos asuntos-propios (comportamiento anterior)...');
  for (const g of ['Limpiador', 'Developer', 'Auxiliar De Servicios - L']) {
    await upsertPerm(g, 'asuntos-propios', true);
  }

  await prisma.$disconnect();
  console.log('\n✅ Listo.\n');
}

run().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
