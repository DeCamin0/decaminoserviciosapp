require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    // Conectare la baza de date
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.log('✅ Conectat la baza de date');

    // Citește fișierul de migrare
    const migrationPath = path.join(__dirname, '../prisma/migrations/20251228_add_assistant_tables/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executând migrația...');

    // Execută SQL-ul
    await connection.query(sql);

    console.log('✅ Migrația executată cu succes!');
    console.log('✅ Tabele create: assistant_audit_log, kb_articles, tickets_ai');

  } catch (error) {
    console.error('❌ Eroare la executarea migrației:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexiunea închisă');
    }
  }
}

runMigration();

