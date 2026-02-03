require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCiobanu() {
  try {
    const codigo = '10000092'; // CIOBANU MIHAELA
    
    console.log(`🔍 Test pentru ${codigo} - CIOBANU MIHAELA\n`);

    // 1. Verifică valorile din baza de date
    const empleado = await prisma.$queryRawUnsafe(`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\` as nombre,
        GRUPO,
        \`VACACIONES_ANUALES_PERSONALIZADAS\` as vacaciones_personalizadas,
        \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` as asuntos_personalizados
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
      console.log(`   VACACIONES_ANUALES_PERSONALIZADAS: ${emp.vacaciones_personalizadas} (type: ${typeof emp.vacaciones_personalizadas})`);
      console.log(`   ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS: ${emp.asuntos_personalizados} (type: ${typeof emp.asuntos_personalizados})`);
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

    // 3. Simulează exact logica din calcularSaldo
    const empleadoPersonalizado = await prisma.$queryRawUnsafe(`
      SELECT 
        \`VACACIONES_ANUALES_PERSONALIZADAS\` as vacaciones_personalizadas,
        \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` as asuntos_personalizados
      FROM DatosEmpleados
      WHERE CODIGO = '${codigo}'
      LIMIT 1
    `);

    console.log('📊 Raw query result:');
    console.log(JSON.stringify(empleadoPersonalizado, null, 2));
    console.log('');

    // Procesează valorile EXACT ca în calcularSaldo
    let vacacionesPersonalizadas = null;
    let asuntosPersonalizados = null;

    if (empleadoPersonalizado && empleadoPersonalizado[0]) {
      const vac = empleadoPersonalizado[0].vacaciones_personalizadas;
      const asu = empleadoPersonalizado[0].asuntos_personalizados;

      console.log(`   vac raw: ${vac}, type: ${typeof vac}, isNull: ${vac === null}, isUndefined: ${vac === undefined}`);
      console.log(`   asu raw: ${asu}, type: ${typeof asu}, isNull: ${asu === null}, isUndefined: ${asu === undefined}`);

      if (vac !== null && vac !== undefined && vac !== 'NULL' && vac !== '') {
        if (typeof vac === 'object' && vac !== null) {
          console.log(`   vac este object, verifică metode...`);
          console.log(`   vac.toNumber: ${typeof vac.toNumber}`);
          console.log(`   vac.valueOf: ${typeof vac.valueOf}`);
          console.log(`   vac.toString: ${typeof vac.toString}`);
          
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
          console.log(`   asu este object, verifică metode...`);
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

    // 4. Valori finale
    const diasVacacionesAnuales = vacacionesPersonalizadas !== null 
      ? vacacionesPersonalizadas 
      : (convenio[0]?.dias_vacaciones_anuales || 0);
    
    const diasAsuntosPropiosAnuales = asuntosPersonalizados !== null 
      ? asuntosPersonalizados 
      : (convenio[0]?.dias_asuntos_propios_anuales || 0);

    console.log('📊 VALORI FINALE (ce ar trebui folosite):');
    console.log(`   Vacaciones anuales: ${diasVacacionesAnuales} ${vacacionesPersonalizadas !== null ? '[✅ PERSONALIZAT]' : '[❌ CONVENIO]'}`);
    console.log(`   Asuntos propios anuales: ${diasAsuntosPropiosAnuales} ${asuntosPersonalizados !== null ? '[✅ PERSONALIZAT]' : '[❌ CONVENIO]'}`);
    console.log('');

    console.log('🔍 CONCLUZIE:');
    if (vacacionesPersonalizadas === null) {
      console.log('   ❌ PROBLEMA: vacacionesPersonalizadas este NULL - nu se folosește valoarea din tabel!');
    } else {
      console.log(`   ✅ vacacionesPersonalizadas este ${vacacionesPersonalizadas} - se folosește valoarea din tabel`);
    }
    if (asuntosPersonalizados === null) {
      console.log('   ❌ PROBLEMA: asuntosPersonalizados este NULL - nu se folosește valoarea din tabel!');
    } else {
      console.log(`   ✅ asuntosPersonalizados este ${asuntosPersonalizados} - se folosește valoarea din tabel`);
    }

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCiobanu();
