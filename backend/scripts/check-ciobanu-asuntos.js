require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCiobanu() {
  try {
    const codigo = '10000092'; // CIOBANU MIHAELA
    
    console.log(`🔍 Verificare pentru ${codigo} - CIOBANU MIHAELA\n`);

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
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS (raw): ${emp.vacaciones_personalizadas} (type: ${typeof emp.vacaciones_personalizadas}, isNull: ${emp.vacaciones_personalizadas === null}, isUndefined: ${emp.vacaciones_personalizadas === undefined})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS (raw): ${emp.asuntos_personalizados} (type: ${typeof emp.asuntos_personalizados}, isNull: ${emp.asuntos_personalizados === null}, isUndefined: ${emp.asuntos_personalizados === undefined})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS (cast): ${emp.asuntos_cast} (type: ${typeof emp.asuntos_cast}, isNull: ${emp.asuntos_cast === null})`);
      console.log('');
      
      // Verifică dacă valoarea este 0 sau NULL
      if (emp.asuntos_personalizados === null || emp.asuntos_personalizados === undefined) {
        console.log('⚠️ PROBLEMA: ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS este NULL/undefined - se folosește convenio!');
        console.log('   Trebuie setat la 0 explicit pentru a folosi 0 în loc de convenio.');
      } else if (emp.asuntos_personalizados === 0 || Number(emp.asuntos_personalizados) === 0) {
        console.log('✅ ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS este 0 - ar trebui să fie folosit 0');
      } else {
        console.log(`⚠️ ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS este ${emp.asuntos_personalizados} - nu este 0`);
      }
    }

    // Verifică convenio pentru grupul acestui angajat
    if (empleado && empleado[0]) {
      const convenio = await prisma.$queryRawUnsafe(`
        SELECT 
          cg.grupo_nombre,
          c.nombre as convenio_nombre,
          cc.dias_vacaciones_anuales,
          cc.dias_asuntos_propios_anuales
        FROM convenio_grupo cg
        INNER JOIN convenios c ON cg.convenio_id = c.id
        LEFT JOIN convenio_config cc ON c.id = cc.convenio_id AND cc.activo = TRUE
        WHERE LOWER(TRIM(cg.grupo_nombre)) = LOWER('${empleado[0].grupo}')
          AND cg.activo = TRUE
          AND c.activo = TRUE
        LIMIT 1
      `);

      if (convenio && convenio[0]) {
        const conv = convenio[0];
        console.log('\n📊 Valori din convenio:');
        console.log(`   GRUPO: ${conv.grupo_nombre}`);
        console.log(`   CONVENIO: ${conv.convenio_nombre}`);
        console.log(`   dias_asuntos_propios_anuales: ${conv.dias_asuntos_propios_anuales}`);
        console.log('');
        console.log('🔍 CONCLUZIE:');
        if (empleado[0].asuntos_personalizados === null || empleado[0].asuntos_personalizados === undefined) {
          console.log(`   Valoarea personalizată este NULL → se folosește convenio: ${conv.dias_asuntos_propios_anuales}`);
          console.log(`   Pentru a folosi 0, trebuie setat explicit: UPDATE DatosEmpleados SET \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` = 0 WHERE CODIGO = '${codigo}'`);
        } else {
          console.log(`   Valoarea personalizată este ${empleado[0].asuntos_personalizados} → ar trebui să fie folosită această valoare`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkCiobanu();
