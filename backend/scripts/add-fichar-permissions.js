/**
 * Script Node.js pentru adăugarea permisiunilor fichar în matrix
 * Rulează: node backend/scripts/add-fichar-permissions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addFicharPermissions() {
  try {
    console.log('📝 Adăugare permisiuni fichar în matrix...\n');

    const today = new Date().toISOString().split('T')[0];
    const updatedBy = 'admin@decamino.com';

    // Permisiuni fichar-admin (pentru manageri/admini - acces complet cu toate tab-urile)
    const ficharAdminPermissions = [
      { grupo: 'Admin', module: 'fichar-admin' },
      { grupo: 'Developer', module: 'fichar-admin' },
      { grupo: 'Manager', module: 'fichar-admin' },
      { grupo: 'Supervisor', module: 'fichar-admin' },
    ];

    console.log('🔐 Adăugare permisiuni fichar-admin...');
    for (const perm of ficharAdminPermissions) {
      const grupoModule = `${perm.grupo}_${perm.module}`;
      await prisma.permissions.upsert({
        where: { grupo_module: grupoModule },
        update: {
          permitted: 'true',
          last_updated: today,
          updated_by: updatedBy,
        },
        create: {
          grupo_module: grupoModule,
          permitted: 'true',
          last_updated: today,
          updated_by: updatedBy,
        },
      });
      console.log(`  ✅ ${grupoModule}`);
    }

    // Permisiuni fichar-empleados (pentru angajații normali - doar tab-urile de bază)
    // Acestea vor fi adăugate manual prin AccessMatrix pentru grupuri specifice
    console.log('\n👤 Permisiuni fichar-empleados vor fi adăugate manual prin AccessMatrix');
    console.log('  💡 Folosește AccessMatrix pentru a adăuga permisiuni pentru grupuri specifice');

    console.log('\n✅ Permisiuni adăugate cu succes!');
  } catch (error) {
    console.error('❌ Eroare la adăugarea permisiunilor:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează scriptul
addFicharPermissions()
  .then(() => {
    console.log('\n🎉 Script finalizat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script eșuat:', error);
    process.exit(1);
  });
