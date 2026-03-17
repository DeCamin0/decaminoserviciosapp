/**
 * Adds horario_entrega and telefono_entrega columns to PedidosTodos.
 * Usage:
 *   node scripts/run-horario-telefono-entrega-migration.js
 *   node scripts/run-horario-telefono-entrega-migration.js .env.hera.local
 *   node scripts/run-horario-telefono-entrega-migration.js .env.decamino.local
 */
const path = require('path');

// Load env: default .env, or file from argv (e.g. .env.hera.local)
const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
  let connection;

  try {
    const config = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    };

    if (!config.host || !config.user || !config.database) {
      console.error('❌ Missing DB_HOST, DB_USERNAME or DB_NAME. Set them in .env or pass env file: node scripts/run-horario-telefono-entrega-migration.js .env.hera.local');
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('✅ Connected to', config.database, 'at', config.host);

    const migrationPath = path.join(__dirname, '../migrations/add_horario_telefono_entrega_to_pedidos.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: add horario_entrega, telefono_entrega to PedidosTodos...');

    await connection.query(sql);

    console.log('✅ Migration completed successfully.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ Columns already exist. Nothing to do.');
      process.exit(0);
      return;
    }
    console.error('❌ Migration failed:', error.message);
    if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
  }
}

runMigration();
