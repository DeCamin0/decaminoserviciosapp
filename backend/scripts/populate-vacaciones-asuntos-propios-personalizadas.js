require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function populatePersonalizadas() {
  try {
    console.log('🔄 Populare zile anuale personalizate pentru toți angajații...\n');

    // 1. Actualizează TOȚI angajații cu 31 zile de vacanțe personalizate
    console.log('📝 Actualizare vacanțe anuale: 31 zile pentru toți angajații...');
    
    const updateVacaciones = await prisma.$executeRawUnsafe(`
      UPDATE DatosEmpleados
      SET \`VACACIONES_ANUALES_PERSONALIZADAS\` = 31
      WHERE ESTADO = 'ACTIVO'
        AND (\`VACACIONES_ANUALES_PERSONALIZADAS\` IS NULL OR \`VACACIONES_ANUALES_PERSONALIZADAS\` != 31)
    `);

    console.log(`✅ Actualizat ${updateVacaciones} angajați cu 31 zile de vacanțe personalizate\n`);

    // 2. Actualizează doar grupul "Limpiador" cu 6 zile de asuntos propios personalizate
    console.log('📝 Actualizare asuntos propios: 6 zile pentru grupul "Limpiador"...');
    
    const updateAsuntosLimpiador = await prisma.$executeRawUnsafe(`
      UPDATE DatosEmpleados
      SET \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` = 6
      WHERE ESTADO = 'ACTIVO'
        AND LOWER(TRIM(\`GRUPO\`)) = LOWER('Limpiador')
        AND (\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` IS NULL OR \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` != 6)
    `);

    console.log(`✅ Actualizat ${updateAsuntosLimpiador} angajați din grupul "Limpiador" cu 6 zile de asuntos propios personalizate\n`);

    // 3. Setează 0 explicit pentru asuntos propios pentru toți ceilalți (nu Limpiador)
    // IMPORTANT: 0 explicit înseamnă "nu are asuntos propios", NULL înseamnă "folosește convenio"
    console.log('📝 Setare 0 explicit pentru asuntos propios pentru ceilalți angajați (nu Limpiador)...');
    
    const updateAsuntosZero = await prisma.$executeRawUnsafe(`
      UPDATE DatosEmpleados
      SET \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` = 0
      WHERE ESTADO = 'ACTIVO'
        AND LOWER(TRIM(\`GRUPO\`)) != LOWER('Limpiador')
        AND (\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` IS NULL OR \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` != 0)
    `);

    console.log(`✅ Setat 0 explicit pentru ${updateAsuntosZero} angajați (nu Limpiador)\n`);

    // 4. Verificare finală - afișează statistici
    console.log('📊 Verificare finală - statistici:\n');
    
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_activos,
        COUNT(\`VACACIONES_ANUALES_PERSONALIZADAS\`) as cu_vacaciones_personalizadas,
        COUNT(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\`) as cu_asuntos_personalizados,
        SUM(CASE WHEN LOWER(TRIM(\`GRUPO\`)) = LOWER('Limpiador') THEN 1 ELSE 0 END) as limpiadores
      FROM DatosEmpleados
      WHERE ESTADO = 'ACTIVO'
    `);

    if (stats && stats.length > 0) {
      const s = stats[0];
      console.log(`Total angajați activi: ${s.total_activos}`);
      console.log(`Cu vacanțe personalizate: ${s.cu_vacaciones_personalizadas}`);
      console.log(`Cu asuntos propios personalizate: ${s.cu_asuntos_personalizados}`);
      console.log(`Limpiadores: ${s.limpiadores}`);
      console.log('');
    }

    // 5. Verificare pe grupuri
    const statsGrupos = await prisma.$queryRawUnsafe(`
      SELECT 
        \`GRUPO\` as grupo,
        COUNT(*) as total,
        COUNT(\`VACACIONES_ANUALES_PERSONALIZADAS\`) as con_vacaciones,
        COUNT(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\`) as con_asuntos
      FROM DatosEmpleados
      WHERE ESTADO = 'ACTIVO'
        AND \`GRUPO\` IS NOT NULL
      GROUP BY \`GRUPO\`
      ORDER BY \`GRUPO\`
      LIMIT 10
    `);

    if (statsGrupos && statsGrupos.length > 0) {
      console.log('📋 Statistici pe grupuri (primele 10):');
      console.log('Grupo | Total | Con Vacaciones | Con Asuntos');
      console.log('---------------------------------------------');
      statsGrupos.forEach(g => {
        console.log(`${(g.grupo || '-').padEnd(30)} | ${String(g.total).padStart(5)} | ${String(g.con_vacaciones).padStart(15)} | ${String(g.con_asuntos).padStart(12)}`);
      });
      console.log('');
    }

    console.log('✅ Populare completă!\n');

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populatePersonalizadas();
