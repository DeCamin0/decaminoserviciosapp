/**
 * Script Node.js pentru adăugarea permisiunilor solicitudes în matrix
 * Rulează: node backend/scripts/add-solicitudes-permissions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addSolicitudesPermissions() {
  try {
    console.log('📝 Adăugare permisiuni solicitudes în matrix...\n');

    const today = new Date().toISOString().split('T')[0];
    const updatedBy = 'admin@decamino.com';

    // Permisiuni solicitudes-admin (pentru manageri/admini - acces complet: toate tab-urile)
    const solicitudesAdminPermissions = [
      { grupo: 'Admin', module: 'solicitudes-admin' },
      { grupo: 'Developer', module: 'solicitudes-admin' },
      { grupo: 'Manager', module: 'solicitudes-admin' },
      { grupo: 'Supervisor', module: 'solicitudes-admin' }, // Dacă vrei ca supervisorii să aibă acces complet
    ];

    console.log('🔐 Adăugare permisiuni solicitudes-admin...');
    for (const perm of solicitudesAdminPermissions) {
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

    // Permisiuni solicitudes-empleados (pentru angajații normali - acces limitat: doar "Mis Solicitudes" și "Nueva Solicitud")
    const solicitudesEmpleadosPermissions = [
      // Adaugă aici grupuri specifice care trebuie să aibă acces limitat
      // Exemplu:
      // { grupo: 'Empleado', module: 'solicitudes-empleados' },
      // { grupo: 'Auxiliar De Servicios - C', module: 'solicitudes-empleados' },
    ];

    console.log('\n👤 Adăugare permisiuni solicitudes-empleados...');
    if (solicitudesEmpleadosPermissions.length > 0) {
      for (const perm of solicitudesEmpleadosPermissions) {
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
    } else {
      console.log('  ⚠️  Nu s-au adăugat permisiuni solicitudes-empleados (lista goală)');
      console.log('  💡 Editează scriptul pentru a adăuga grupuri specifice');
    }

    console.log('\n✅ Permisiuni adăugate cu succes!');
  } catch (error) {
    console.error('❌ Eroare la adăugarea permisiunilor:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează scriptul
addSolicitudesPermissions()
  .then(() => {
    console.log('\n🎉 Script finalizat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script eșuat:', error);
    process.exit(1);
  });
