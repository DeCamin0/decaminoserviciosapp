require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEstadisticas() {
  try {
    console.log('🔍 Test statistici cu valorile personalizate...\n');

    // Test cu un angajat din Limpiador (ar trebui să aibă 31 vacaciones și 6 asuntos propios)
    const testCodigo = '10000006'; // AGRAZ MARTIN NOELIA
    
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
      console.log('📊 Valori din DatosEmpleados:');
      console.log(`   CODIGO: ${emp.CODIGO}`);
      console.log(`   NOMBRE: ${emp.nombre}`);
      console.log(`   GRUPO: ${emp.grupo}`);
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS: ${emp.vacaciones_personalizadas} (type: ${typeof emp.vacaciones_personalizadas})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS: ${emp.asuntos_personalizados} (type: ${typeof emp.asuntos_personalizados})`);
      console.log('');
    }

    // 2. Simulează logica din calcularSaldo
    const empleadoPersonalizado = await prisma.$queryRawUnsafe(`
      SELECT 
        \`VACACIONES_ANUALES_PERSONALIZADAS\` as vacaciones_personalizadas,
        \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` as asuntos_personalizados
      FROM DatosEmpleados
      WHERE CODIGO = '${testCodigo}'
      LIMIT 1
    `);

    console.log('📊 Rezultat query personalizado:');
    console.log(JSON.stringify(empleadoPersonalizado, null, 2));
    console.log('');

    // 3. Procesează valorile (simulare logica din calcularSaldo)
    let vacacionesPersonalizadas = null;
    let asuntosPersonalizados = null;

    if (empleadoPersonalizado && empleadoPersonalizado[0]) {
      const vac = empleadoPersonalizado[0].vacaciones_personalizadas;
      const asu = empleadoPersonalizado[0].asuntos_personalizados;

      console.log(`   vac type: ${typeof vac}, value: ${vac}`);
      console.log(`   asu type: ${typeof asu}, value: ${asu}`);

      if (vac !== null && vac !== undefined && vac !== 'NULL' && vac !== '') {
        if (typeof vac === 'object' && vac !== null) {
          vacacionesPersonalizadas = typeof vac.toNumber === 'function' 
            ? vac.toNumber() 
            : (typeof vac.valueOf === 'function' ? Number(vac.valueOf()) : Number(vac));
        } else {
          vacacionesPersonalizadas = typeof vac === 'number' ? vac : Number(vac);
        }
        if (isNaN(vacacionesPersonalizadas)) {
          vacacionesPersonalizadas = null;
        }
      }

      if (asu !== null && asu !== undefined && asu !== 'NULL' && asu !== '') {
        if (typeof asu === 'object' && asu !== null) {
          asuntosPersonalizados = typeof asu.toNumber === 'function' 
            ? asu.toNumber() 
            : (typeof asu.valueOf === 'function' ? Number(asu.valueOf()) : Number(asu));
        } else {
          asuntosPersonalizados = typeof asu === 'number' ? asu : Number(asu);
        }
        if (isNaN(asuntosPersonalizados)) {
          asuntosPersonalizados = null;
        }
      }
    }

    console.log('📊 Valori procesate:');
    console.log(`   vacacionesPersonalizadas: ${vacacionesPersonalizadas} (${typeof vacacionesPersonalizadas})`);
    console.log(`   asuntosPersonalizados: ${asuntosPersonalizados} (${typeof asuntosPersonalizados})`);
    console.log('');

    // 4. Verifică convenio
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
      console.log(`   dias_vacaciones_anuales: ${conv.dias_vacaciones_anuales}`);
      console.log(`   dias_asuntos_propios_anuales: ${conv.dias_asuntos_propios_anuales}`);
      console.log('');
    }

    // 5. Valori finale care ar trebui folosite
    const diasVacacionesAnuales = vacacionesPersonalizadas !== null 
      ? vacacionesPersonalizadas 
      : (convenio[0]?.dias_vacaciones_anuales || 0);
    
    const diasAsuntosPropiosAnuales = asuntosPersonalizados !== null 
      ? asuntosPersonalizados 
      : (convenio[0]?.dias_asuntos_propios_anuales || 0);

    console.log('📊 VALORI FINALE (ce ar trebui folosite):');
    console.log(`   Vacaciones anuales: ${diasVacacionesAnuales} ${vacacionesPersonalizadas !== null ? '[PERSONALIZAT]' : '[CONVENIO]'}`);
    console.log(`   Asuntos propios anuales: ${diasAsuntosPropiosAnuales} ${asuntosPersonalizados !== null ? '[PERSONALIZAT]' : '[CONVENIO]'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEstadisticas();
