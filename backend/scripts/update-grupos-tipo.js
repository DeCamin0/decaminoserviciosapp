require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateGruposTipo() {
  try {
    console.log('🔄 Actualizando tipo de grupos existentes...');
    
    // Actualizar todos los grupos existentes a 'grupo_empleado'
    const result = await prisma.$executeRawUnsafe(`
      UPDATE servicios_referencia 
      SET tipo = 'servicio_presupuesto' 
      WHERE tipo IS NULL OR tipo = ''
    `);
    
    console.log(`✅ ${result} grupos actualizados a 'grupo_empleado'`);
    
    // Verificar
    const grupos = await prisma.$queryRawUnsafe(`
      SELECT id, nombre, tipo, activo 
      FROM servicios_referencia 
      ORDER BY nombre
    `);
    
    console.log(`\n📋 Total de grupos: ${grupos.length}`);
    grupos.forEach(g => {
      console.log(`   - ${g.nombre} (tipo: ${g.tipo || 'NULL'}, activo: ${g.activo})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateGruposTipo();
