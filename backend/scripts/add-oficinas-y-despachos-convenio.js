require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function addOficinasYDespachosConvenio() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('✅ Conectado a la base de datos');

    // 1. Crear convenio "Oficinas y Despachos"
    console.log('📄 Creando convenio "Oficinas y Despachos"...');
    await connection.execute(`
      INSERT INTO \`convenios\` (\`nombre\`, \`activo\`) 
      VALUES ('Oficinas y Despachos', TRUE)
      ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
    `);

    // 2. Crear configuración del convenio (30 días vacaciones, 0 asuntos propios)
    console.log('📄 Configurando convenio: 30 días vacaciones, 0 asuntos propios...');
    await connection.execute(`
      INSERT INTO \`convenio_config\` (\`convenio_id\`, \`dias_vacaciones_anuales\`, \`dias_asuntos_propios_anuales\`, \`activo\`)
      SELECT \`id\`, 30, 0, TRUE FROM \`convenios\` WHERE \`nombre\` = 'Oficinas y Despachos'
      ON DUPLICATE KEY UPDATE 
        \`dias_vacaciones_anuales\` = 30,
        \`dias_asuntos_propios_anuales\` = 0,
        \`activo\` = TRUE;
    `);

    // 3. Adăugăm grupul "Developer" la conveniul "Oficinas y Despachos"
    console.log('📄 Adăugând grupul "Developer" la conveniul "Oficinas y Despachos"...');
    await connection.execute(`
      INSERT INTO \`convenio_grupo\` (\`convenio_id\`, \`grupo_nombre\`, \`activo\`) 
      SELECT \`id\`, 'Developer', TRUE FROM \`convenios\` WHERE \`nombre\` = 'Oficinas y Despachos'
      ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
    `);

    // 4. Verificăm ce alte grupuri există (mai puțin "Administrativ")
    console.log('📄 Verificando otros grupos en la base de datos...');
    const [grupos] = await connection.execute(`
      SELECT DISTINCT \`GRUPO\` as grupo 
      FROM \`DatosEmpleados\` 
      WHERE \`GRUPO\` IS NOT NULL 
        AND \`GRUPO\` != '' 
        AND \`GRUPO\` != 'Administrativ'
        AND \`GRUPO\` NOT IN (
          SELECT \`grupo_nombre\` FROM \`convenio_grupo\` WHERE \`activo\` = TRUE
        )
      ORDER BY \`GRUPO\`;
    `);

    console.log(`📊 Grupos encontrados sin convenio (excepto Administrativ): ${grupos.length}`);
    
    // 5. Adăugăm toate grupurile găsite (mai puțin "Administrativ") la conveniul "Oficinas y Despachos"
    if (grupos.length > 0) {
      console.log('📄 Adăugând grupurile la conveniul "Oficinas y Despachos"...');
      for (const grupo of grupos) {
        const grupoNombre = grupo.grupo;
        if (grupoNombre && grupoNombre.trim() !== '' && grupoNombre !== 'Administrativ') {
          try {
            await connection.execute(`
              INSERT INTO \`convenio_grupo\` (\`convenio_id\`, \`grupo_nombre\`, \`activo\`) 
              SELECT \`id\`, ?, TRUE FROM \`convenios\` WHERE \`nombre\` = 'Oficinas y Despachos'
              ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
            `, [grupoNombre]);
            console.log(`  ✅ Adăugat: ${grupoNombre}`);
          } catch (error) {
            console.log(`  ⚠️ Eroare adăugând ${grupoNombre}: ${error.message}`);
          }
        }
      }
    }

    console.log('✅ Convenio "Oficinas y Despachos" creato y configurado exitosamente');
    console.log('✅ Grupos adăugate: Developer + alte grupuri (mai puțin Administrativ)');
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

addOficinasYDespachosConvenio();

