/**
 * Mueve el derecho a Asuntos Propios a Access Matrix (módulo `asuntos-propios`).
 * Conserva el comportamiento anterior: Limpiador, Developer, Auxiliar De Servicios - L.
 *
 * node scripts/add-asuntos-propios-permissions.js
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
      updated_by: 'add-asuntos-propios-permissions.js',
    },
    create: {
      grupo_module: grupoModule,
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'add-asuntos-propios-permissions.js',
    },
  });
  console.log(`  ✅ ${grupoModule} = ${permitted}`);
}

async function main() {
  console.log('📝 Permiso asuntos-propios (Access Matrix)...\n');

  const allowed = [
    'Limpiador',
    'Developer',
    'Auxiliar De Servicios - L',
  ];

  for (const g of allowed) {
    await upsertPerm(g, 'asuntos-propios', true);
  }

  console.log(
    '\n✅ Listo. Ajusta otros grupos en Admin → Matriz de permisos (Asuntos Propios).',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
