/**
 * Script pentru a crea tabelul grupos_referencia și a popula cu grupuri inițiale
 * Rulare: node scripts/create-grupos-referencia-table.js
 */

require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function createGruposReferenciaTable() {
  let connection;

  try {
    // Conectare la baza de date
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '217.154.102.115',
      user: process.env.DB_USERNAME || 'facturacion_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'decamino_db',
    });

    console.log('✅ Connected to database');

    // Citirea migrației SQL
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '../prisma/migrations/20251215_add_grupos_referencia/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Rularea migrației
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      }
    }

    console.log('✅ Migration completed successfully!');

    // Verificare
    const [rows] = await connection.execute('SELECT * FROM grupos_referencia ORDER BY nombre');
    console.log(`✅ Verified: ${rows.length} grupos inserted:`);
    rows.forEach((row) => {
      console.log(`   - ${row.nombre} (activo: ${row.activo})`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Connection closed');
    }
  }
}

createGruposReferenciaTable();

