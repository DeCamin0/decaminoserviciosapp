require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function populateVacacionesAsuntosPropios() {
  try {
    console.log('🔄 Populare zile anuale de vacanțe și asuntos propios...\n');

    // 1. Actualizează TOATE convenio-urile cu 31 zile de vacanțe
    console.log('📝 Actualizare vacanțe anuale: 31 zile pentru toate convenio-urile...');
    
    const updateVacaciones = await prisma.$executeRawUnsafe(`
      UPDATE convenio_config
      SET dias_vacaciones_anuales = 31,
          updated_at = NOW()
      WHERE activo = TRUE
    `);

    console.log(`✅ Actualizat ${updateVacaciones} convenio-uri cu 31 zile de vacanțe\n`);

    // 2. Găsește convenio-ul asociat cu grupul "Limpiador"
    console.log('🔍 Căutare convenio pentru grupul "Limpiador"...');
    
    const limpiadorConvenio = await prisma.$queryRawUnsafe(`
      SELECT 
        cg.convenio_id,
        c.nombre as convenio_nombre
      FROM convenio_grupo cg
      INNER JOIN convenios c ON cg.convenio_id = c.id
      WHERE LOWER(TRIM(cg.grupo_nombre)) = LOWER('Limpiador')
        AND cg.activo = TRUE
        AND c.activo = TRUE
      LIMIT 1
    `);

    if (!limpiadorConvenio || limpiadorConvenio.length === 0) {
      console.log('⚠️ Nu s-a găsit convenio pentru grupul "Limpiador"');
      console.log('   Verifică dacă grupul este asociat cu un convenio în convenio_grupo\n');
    } else {
      const convenioId = limpiadorConvenio[0].convenio_id;
      const convenioNombre = limpiadorConvenio[0].convenio_nombre;
      
      console.log(`✅ Găsit convenio: ${convenioNombre} (ID: ${convenioId})`);
      
      // 3. Actualizează asuntos propios pentru convenio-ul "Limpiador" cu 6 zile
      console.log('📝 Actualizare asuntos propios: 6 zile pentru convenio-ul "Limpiador"...');
      
      const updateAsuntosPropios = await prisma.$executeRawUnsafe(`
        UPDATE convenio_config
        SET dias_asuntos_propios_anuales = 6,
            updated_at = NOW()
        WHERE convenio_id = ${convenioId}
          AND activo = TRUE
      `);

      if (updateAsuntosPropios > 0) {
        console.log(`✅ Actualizat convenio "${convenioNombre}" cu 6 zile de asuntos propios\n`);
      } else {
        console.log(`⚠️ Nu există convenio_config pentru convenio_id ${convenioId}`);
        console.log('   Creând configurație nouă...\n');
        
        // Creează configurație dacă nu există
        await prisma.$executeRawUnsafe(`
          INSERT INTO convenio_config (
            convenio_id,
            dias_vacaciones_anuales,
            dias_asuntos_propios_anuales,
            activo,
            created_at,
            updated_at
          ) VALUES (
            ${convenioId},
            31,
            6,
            TRUE,
            NOW(),
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            dias_asuntos_propios_anuales = 6,
            updated_at = NOW()
        `);
        
        console.log(`✅ Creat/actualizat convenio_config pentru "${convenioNombre}"\n`);
      }
    }

    // 4. Verificare finală - afișează toate configurațiile
    console.log('📊 Verificare finală - configurații convenio:\n');
    
    const allConfigs = await prisma.$queryRawUnsafe(`
      SELECT 
        c.id,
        c.nombre as convenio_nombre,
        cc.dias_vacaciones_anuales,
        cc.dias_asuntos_propios_anuales,
        GROUP_CONCAT(cg.grupo_nombre ORDER BY cg.grupo_nombre SEPARATOR ', ') as grupos
      FROM convenios c
      LEFT JOIN convenio_config cc ON c.id = cc.convenio_id AND cc.activo = TRUE
      LEFT JOIN convenio_grupo cg ON c.id = cg.convenio_id AND cg.activo = TRUE
      WHERE c.activo = TRUE
      GROUP BY c.id, c.nombre, cc.dias_vacaciones_anuales, cc.dias_asuntos_propios_anuales
      ORDER BY c.nombre
    `);

    if (allConfigs && allConfigs.length > 0) {
      console.log('Convenio | Vacaciones | Asuntos Propios | Grupos');
      console.log('---------------------------------------------------');
      allConfigs.forEach(config => {
        const vacaciones = config.dias_vacaciones_anuales || 0;
        const asuntos = config.dias_asuntos_propios_anuales || 0;
        const grupos = config.grupos || '(sin grupos)';
        console.log(`${config.convenio_nombre.padEnd(20)} | ${String(vacaciones).padStart(10)} | ${String(asuntos).padStart(15)} | ${grupos}`);
      });
      console.log('');
    } else {
      console.log('⚠️ Nu s-au găsit configurații de convenio\n');
    }

    console.log('✅ Populare completă!\n');

  } catch (error) {
    console.error('❌ Eroare:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populateVacacionesAsuntosPropios();
