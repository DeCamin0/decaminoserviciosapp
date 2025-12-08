/**
 * Script pentru a crea tabelul notifications în baza de date
 * Rulează: node scripts/create-notifications-table.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createTable() {
  // Citește configurația din .env sau folosește valorile default
  const config = {
    host: process.env.DB_HOST || '217.154.102.115',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'facturacion_user',
    password: process.env.DB_PASSWORD || 'ParolaTare123!',
    database: process.env.DB_NAME || 'decamino_db',
  };

  console.log('🔌 Conectându-se la baza de date...');
  console.log('   Host:', config.host);
  console.log('   Database:', config.database);
  console.log('   User:', config.user);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Conectat la baza de date!');

    // Citește scriptul SQL
    const sqlPath = path.join(__dirname, '../migrations/create_notifications_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executând scriptul SQL...');
    await connection.query(sql);
    
    console.log('✅ Tabelul `notifications` a fost creat cu succes!');
    
    // Verifică dacă tabelul există
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'notifications'"
    );
    
    if (tables.length > 0) {
      console.log('✅ Verificare: Tabelul `notifications` există în baza de date!');
      
      // Arată structura tabelului
      const [columns] = await connection.query(
        "DESCRIBE notifications"
      );
      console.log('\n📋 Structura tabelului:');
      console.table(columns);
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  Tabelul există deja. Dacă vrei să-l recreezi, șterge-l mai întâi.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexiunea închisă.');
    }
  }
}

// Rulează scriptul
createTable();
