/**
 * Script Node.js pentru adăugarea permisiunilor pedidos în matrix
 * Rulează: node backend/scripts/add-pedidos-permissions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPedidosPermissions() {
  try {
    console.log('📝 Adăugare permisiuni pedidos în matrix...\n');

    const today = new Date().toISOString().split('T')[0];
    const updatedBy = 'admin@decamino.com';

    // Permisiuni pedidos-admin (pentru manageri/admini - acces complet)
    const pedidosAdminPermissions = [
      { grupo: 'Admin', module: 'pedidos-admin' },
      { grupo: 'Developer', module: 'pedidos-admin' },
      { grupo: 'Manager', module: 'pedidos-admin' },
      { grupo: 'Supervisor', module: 'pedidos-admin' }, // Dacă vrei ca supervisorii să aibă acces complet
    ];

    console.log('🔐 Adăugare permisiuni pedidos-admin...');
    for (const perm of pedidosAdminPermissions) {
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

    // Permisiuni pedidos-empleados (pentru angajații normali - acces limitat)
    const pedidosEmpleadosPermissions = [
      // Adaugă aici grupuri specifice care trebuie să aibă acces limitat
      // Exemplu:
      // { grupo: 'Empleado', module: 'pedidos-empleados' },
      // { grupo: 'Auxiliar De Servicios - C', module: 'pedidos-empleados' },
    ];

    console.log('\n👤 Adăugare permisiuni pedidos-empleados...');
    if (pedidosEmpleadosPermissions.length > 0) {
      for (const perm of pedidosEmpleadosPermissions) {
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
      console.log('  ⚠️  Nu s-au adăugat permisiuni pedidos-empleados (lista goală)');
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
addPedidosPermissions()
  .then(() => {
    console.log('\n🎉 Script finalizat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script eșuat:', error);
    process.exit(1);
  });
