require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function addEspecialistaToServiciosAuxiliares() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('✅ Conectado a la base de datos');

    // Adăugăm grupul "Especialista" la conveniul "Servicios Auxiliares"
    const query = `
      INSERT INTO \`convenio_grupo\` (\`convenio_id\`, \`grupo_nombre\`, \`activo\`) 
      SELECT \`id\`, 'Especialista', TRUE FROM \`convenios\` WHERE \`nombre\` = 'Servicios Auxiliares'
      ON DUPLICATE KEY UPDATE \`activo\` = TRUE;
    `;

    console.log('📄 Adăugând grupul "Especialista" la conveniul "Servicios Auxiliares"...');
    await connection.execute(query);
    console.log('✅ Grupul "Especialista" a fost adăugat cu succes la conveniul "Servicios Auxiliares"');
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

addEspecialistaToServiciosAuxiliares();

