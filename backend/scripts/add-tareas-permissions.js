/**
 * Adaugă în DB cheile de permisiuni pentru Tareas.
 * Rulează din backend: node scripts/add-tareas-permissions.js
 *
 * - mis-tareas: angajați (vezi/confirmă sarcinile proprii)
 * - tareas: supervisor/manager (gestionează toate)
 *
 * Nu activează automat pe toate grupurile de angajați —
 * pentru Limpiador etc. se setează din Admin → Access Matrix.
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
      updated_by: 'add-tareas-permissions.js',
    },
    create: {
      grupo_module: grupoModule,
      permitted: permitted ? 'true' : 'false',
      last_updated: new Date().toISOString().split('T')[0],
      updated_by: 'add-tareas-permissions.js',
    },
  });
  console.log(`  ✅ ${grupoModule} = ${permitted}`);
}

async function main() {
  console.log('📝 Permisiuni Tareas / Mis Tareas...\n');

  const manageGroups = ['Developer', 'Admin', 'Manager', 'Supervisor'];
  console.log('🔐 tareas (gestión):');
  for (const g of manageGroups) {
    await upsertPerm(g, 'tareas', true);
    await upsertPerm(g, 'mis-tareas', true);
  }

  // Grupuri tipice de teren — doar Mis tareas (opțional; poți dezactiva din matrix)
  const employeeGroups = [
    'Limpiador',
    'Auxiliar De Servicios - C',
    'Auxiliar De Servicios - L',
    'Socorrista',
    'Especialista',
  ];
  console.log('\n👤 mis-tareas (empleado):');
  for (const g of employeeGroups) {
    await upsertPerm(g, 'mis-tareas', true);
    await upsertPerm(g, 'tareas', false);
  }

  console.log('\n✅ Listo. Revisa/ajusta en Admin → Matriz de permisos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
