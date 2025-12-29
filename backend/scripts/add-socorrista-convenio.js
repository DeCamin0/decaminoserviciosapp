require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function addSocorristaConvenio() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('✅ Conectado a la base de datos');

    // 1. Crear convenio "Socorrista / Monitor acuático" sau folosim "Oficinas y Despachos" dacă are aceleași drepturi
    // Deoarece are aceleași drepturi (30 zile, 0 asuntos propios), putem folosi același conveniu
    // SAU creăm unul separat pentru claritate - voi crea unul separat pentru "Socorrista"
    
    console.log('📄 Creando convenio "Socorrista / Monitor acuático"...');
    await connection.execute(`
      INSERT INTO \`convenios\` (\`nombre\`, \`activo\`) 
      VALUES ('Socorrista / Monitor acuático', TRUE)
      ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
    `);

    // 2. Crear configuración del convenio (30 días vacaciones, 0 asuntos propios)
    console.log('📄 Configurando convenio: 30 días vacaciones, 0 asuntos propios...');
    await connection.execute(`
      INSERT INTO \`convenio_config\` (\`convenio_id\`, \`dias_vacaciones_anuales\`, \`dias_asuntos_propios_anuales\`, \`activo\`)
      SELECT \`id\`, 30, 0, TRUE FROM \`convenios\` WHERE \`nombre\` = 'Socorrista / Monitor acuático'
      ON DUPLICATE KEY UPDATE 
        \`dias_vacaciones_anuales\` = 30,
        \`dias_asuntos_propios_anuales\` = 0,
        \`activo\` = TRUE;
    `);

    // 3. Adăugăm grupul "Socorrista" și variantele posibile
    const gruposSocorrista = [
      'Socorrista',
      'Monitor acuático',
      'Socorrista / Monitor acuático',
      'Socorrista/Monitor acuático'
    ];

    console.log('📄 Adăugând grupurile la conveniul "Socorrista / Monitor acuático"...');
    for (const grupoNombre of gruposSocorrista) {
      try {
        await connection.execute(`
          INSERT INTO \`convenio_grupo\` (\`convenio_id\`, \`grupo_nombre\`, \`activo\`) 
          SELECT \`id\`, ?, TRUE FROM \`convenios\` WHERE \`nombre\` = 'Socorrista / Monitor acuático'
          ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
        `, [grupoNombre]);
        console.log(`  ✅ Adăugat: ${grupoNombre}`);
      } catch (error) {
        console.log(`  ⚠️ Eroare adăugând ${grupoNombre}: ${error.message}`);
      }
    }

    // 4. Verificăm dacă există deja grupul "Socorrista" în baza de date
    console.log('📄 Verificando si existe grupo "Socorrista" en la base de datos...');
    const [gruposExistentes] = await connection.execute(`
      SELECT DISTINCT \`GRUPO\` as grupo 
      FROM \`DatosEmpleados\` 
      WHERE \`GRUPO\` IS NOT NULL 
        AND \`GRUPO\` != '' 
        AND (\`GRUPO\` LIKE '%Socorrista%' OR \`GRUPO\` LIKE '%Monitor%' OR \`GRUPO\` LIKE '%acuático%')
      ORDER BY \`GRUPO\`;
    `);

    if (gruposExistentes.length > 0) {
      console.log(`📊 Grupos encontrados relacionados con Socorrista: ${gruposExistentes.length}`);
      for (const grupo of gruposExistentes) {
        const grupoNombre = grupo.grupo;
        if (grupoNombre && grupoNombre.trim() !== '') {
          try {
            await connection.execute(`
              INSERT INTO \`convenio_grupo\` (\`convenio_id\`, \`grupo_nombre\`, \`activo\`) 
              SELECT \`id\`, ?, TRUE FROM \`convenios\` WHERE \`nombre\` = 'Socorrista / Monitor acuático'
              ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
            `, [grupoNombre]);
            console.log(`  ✅ Adăugat grupul existent: ${grupoNombre}`);
          } catch (error) {
            console.log(`  ⚠️ Eroare adăugând ${grupoNombre}: ${error.message}`);
          }
        }
      }
    }

    console.log('✅ Convenio "Socorrista / Monitor acuático" creato y configurado exitosamente');
    console.log('✅ Configuración: 30 días vacaciones, 0 asuntos propios');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

addSocorristaConvenio();

