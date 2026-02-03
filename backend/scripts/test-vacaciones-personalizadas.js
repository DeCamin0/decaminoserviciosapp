require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPersonalizadas() {
  try {
    console.log('🔍 Test valorile personalizate...\n');

    // Test cu un angajat din Limpiador
    const testCodigo = '10000006'; // AGRAZ MARTIN NOELIA (Limpiador)
    
    console.log(`📋 Test pentru CODIGO: ${testCodigo}\n`);

    // 1. Verifică valorile din baza de date
    const empleado = await prisma.$queryRawUnsafe(`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\` as nombre,
        GRUPO,
        \`VACACIONES_ANUALES_PERSONALIZADAS\` as vacaciones_personalizadas,
        \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` as asuntos_personalizados
      FROM DatosEmpleados
      WHERE CODIGO = '${testCodigo}'
      LIMIT 1
    `);

    if (empleado && empleado[0]) {
      const emp = empleado[0];
      console.log('📊 Valori din baza de date:');
      console.log(`   CODIGO: ${emp.CODIGO}`);
      console.log(`   NOMBRE: ${emp.nombre}`);
      console.log(`   GRUPO: ${emp.grupo}`);
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS: ${emp.vacaciones_personalizadas} (${typeof emp.vacaciones_personalizadas})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS: ${emp.asuntos_personalizados} (${typeof emp.asuntos_personalizados})`);
      console.log('');
    }

    // 2. Verifică convenio pentru grupul acestui angajat
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
      console.log('📊 Valori din convenio:');
      console.log(`   GRUPO: ${conv.grupo_nombre}`);
      console.log(`   CONVENIO: ${conv.convenio_nombre}`);
      console.log(`   dias_vacaciones_anuales: ${conv.dias_vacaciones_anuales}`);
      console.log(`   dias_asuntos_propios_anuales: ${conv.dias_asuntos_propios_anuales}`);
      console.log('');
    }

    // 3. Verifică ce valori ar trebui să fie folosite
    const vacacionesPersonalizadas = empleado[0].vacaciones_personalizadas 
      ? Number(empleado[0].vacaciones_personalizadas) 
      : null;
    const asuntosPersonalizados = empleado[0].asuntos_personalizados 
      ? Number(empleado[0].asuntos_personalizados) 
      : null;

    const diasVacacionesAnuales = vacacionesPersonalizadas !== null 
      ? vacacionesPersonalizadas 
      : (convenio[0]?.dias_vacaciones_anuales || 0);
    
    const diasAsuntosPropiosAnuales = asuntosPersonalizados !== null 
      ? asuntosPersonalizados 
      : (convenio[0]?.dias_asuntos_propios_anuales || 0);

    console.log('📊 Valori finale care ar trebui folosite:');
    console.log(`   Vacaciones anuales: ${diasVacacionesAnuales} ${vacacionesPersonalizadas !== null ? '[PERSONALIZAT]' : '[CONVENIO]'}`);
    console.log(`   Asuntos propios anuales: ${diasAsuntosPropiosAnuales} ${asuntosPersonalizados !== null ? '[PERSONALIZAT]' : '[CONVENIO]'}`);
    console.log('');

    // 4. Verifică toți angajații - câți au valori personalizate
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total,
        COUNT(\`VACACIONES_ANUALES_PERSONALIZADAS\`) as con_vacaciones,
        COUNT(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\`) as con_asuntos,
        AVG(\`VACACIONES_ANUALES_PERSONALIZADAS\`) as avg_vacaciones,
        AVG(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\`) as avg_asuntos
      FROM DatosEmpleados
      WHERE ESTADO = 'ACTIVO'
    `);

    if (stats && stats[0]) {
      console.log('📊 Statistici generale:');
      console.log(`   Total activi: ${stats[0].total}`);
      console.log(`   Cu vacaciones personalizadas: ${stats[0].con_vacaciones}`);
      console.log(`   Cu asuntos personalizados: ${stats[0].con_asuntos}`);
      console.log(`   Media vacaciones: ${stats[0].avg_vacaciones || 0}`);
      console.log(`   Media asuntos: ${stats[0].avg_asuntos || 0}`);
    }

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPersonalizadas();
