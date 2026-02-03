require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyCiobanu() {
  try {
    const codigo = '10000092'; // CIOBANU MIHAELA
    
    console.log(`🔍 Verificare valori pentru ${codigo} - CIOBANU MIHAELA\n`);

    // Verifică valorile din baza de date
    const empleado = await prisma.$queryRawUnsafe(`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\` as nombre,
        GRUPO,
        \`VACACIONES_ANUALES_PERSONALIZADAS\` as vacaciones_personalizadas,
        \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` as asuntos_personalizados,
        CAST(\`VACACIONES_ANUALES_PERSONALIZADAS\` AS DECIMAL(10,1)) as vacaciones_cast,
        CAST(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` AS DECIMAL(10,1)) as asuntos_cast
      FROM DatosEmpleados
      WHERE CODIGO = '${codigo}'
      LIMIT 1
    `);

    if (empleado && empleado[0]) {
      const emp = empleado[0];
      console.log('📊 Valori din DatosEmpleados:');
      console.log(`   CODIGO: ${emp.CODIGO}`);
      console.log(`   NOMBRE: ${emp.nombre}`);
      console.log(`   GRUPO: ${emp.grupo}`);
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS (raw): ${emp.vacaciones_personalizadas} (type: ${typeof emp.vacaciones_personalizadas})`);
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS (cast): ${emp.vacaciones_cast} (type: ${typeof emp.vacaciones_cast})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS (raw): ${emp.asuntos_personalizados} (type: ${typeof emp.asuntos_personalizados})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS (cast): ${emp.asuntos_cast} (type: ${typeof emp.asuntos_cast})`);
      console.log('');
      
      // Verifică dacă valorile sunt NULL
      if (emp.vacaciones_personalizadas === null || emp.vacaciones_personalizadas === undefined) {
        console.log('⚠️ PROBLEMA: VACACIONES_ANUALES_PERSONALIZADAS este NULL - trebuie populat!');
        console.log('   Rulează: node backend/scripts/populate-vacaciones-asuntos-propios-personalizadas.js');
      } else {
        console.log(`✅ VACACIONES_ANUALES_PERSONALIZADAS este setat: ${emp.vacaciones_personalizadas}`);
      }
      
      if (emp.asuntos_personalizados === null || emp.asuntos_personalizados === undefined) {
        console.log('✅ ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS este NULL - va folosi convenio (corect pentru grupul "Auxiliar De Servicios - L")');
      } else {
        console.log(`⚠️ ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS este setat: ${emp.asuntos_personalizados} (ar trebui să fie NULL pentru acest grup)`);
      }
    }

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyCiobanu();
