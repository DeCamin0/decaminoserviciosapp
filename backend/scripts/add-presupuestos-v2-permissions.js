/**
 * Permisos Presupuestos V2.
 * node scripts/add-presupuestos-v2-permissions.js
 *
 * - presupuestos-v2: acceso módulo (lista / borradores)
 * - presupuestos-v2-config: config servicios comerciales / series
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function upsertPerm(grupo, module, permitted) {
  const grupoModule = `${grupo}_${module}`;
  await prisma.permissions.upsert({
    where: { grupo_module: grupoModule },
    update: {
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'add-presupuestos-v2-permissions.js',
    },
    create: {
      grupo_module: grupoModule,
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'add-presupuestos-v2-permissions.js',
    },
  });
  console.log(`  ✅ ${grupoModule} = ${permitted}`);
}

async function main() {
  console.log('📝 Permisiuni Presupuestos V2...\n');
  const groups = ['Developer', 'Admin', 'Manager', 'Supervisor'];
  for (const g of groups) {
    await upsertPerm(g, 'presupuestos-v2', true);
    await upsertPerm(g, 'presupuestos-v2-config', true);
  }
  await upsertPerm('Empleado', 'presupuestos-v2', false);
  await upsertPerm('Empleado', 'presupuestos-v2-config', false);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
