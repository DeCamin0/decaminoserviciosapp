/**
 * Script pentru rularea migration-ului: add_ausencia_asociada_id_to_ausencias
 * Rulează: node scripts/run-ausencia-asociada-migration.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  const host = process.env.DB_HOST || '217.154.102.115';
  const user = process.env.DB_USERNAME || 'facturacion_user';
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'decamino_db';

  if (!password) {
    console.error('❌ DB_PASSWORD must be set in .env file');
    process.exit(1);
  }

  console.log('📋 Running migration: add_ausencia_asociada_id_to_ausencias');
  console.log(`🔗 Connecting to: ${host}`);
  console.log(`📦 Database: ${database}`);

  let connection;
  try {
    // Creează conexiunea
    connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      multipleStatements: true, // Permite multiple statements
    });

    console.log('✅ Connected to database');

    // Citește SQL-ul din fișier
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, '../migrations/add_ausencia_asociada_id_to_ausencias.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Executing migration...');

    // Rulează migration-ul
    await connection.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('✅ Added column: ausencia_asociada_id');
    console.log('✅ Added index: idx_ausencias_asociada_id');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Verifică dacă coloana există deja
    if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
      console.log('⚠️  Column or index might already exist. Checking...');
      try {
        const [rows] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'Ausencias' 
            AND COLUMN_NAME = 'ausencia_asociada_id'
        `, [database]);
        
        if (rows.length > 0) {
          console.log('✅ Column ausencia_asociada_id already exists');
        }
      } catch (checkError) {
        console.error('Error checking column:', checkError.message);
      }
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed');
    }
  }
}

runMigration();
