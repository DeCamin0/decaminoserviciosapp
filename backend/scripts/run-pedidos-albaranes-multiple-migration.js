/**
 * Elimină UNIQUE pe pedido_uid în PedidosAlbaranes (mai multe albaranes per pedido).
 * Usage:
 *   node scripts/run-pedidos-albaranes-multiple-migration.js .env.decamino.local
 *   node scripts/run-pedidos-albaranes-multiple-migration.js .env.hera.local
 */
const path = require('path');

const envFile = process.argv[2] || '.env.decamino.local';
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
      console.error(
        '❌ Missing DB_HOST, DB_USERNAME or DB_NAME. Example: node scripts/run-pedidos-albaranes-multiple-migration.js .env.hera.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('✅ Connected to', config.database, 'at', config.host);

    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/manual_allow_multiple_pedidos_albaranes.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running: manual_allow_multiple_pedidos_albaranes.sql');

    await connection.query(sql);

    console.log('✅ Migration completed successfully.');
  } catch (error) {
    // 1091: Can't DROP INDEX — deja aplicat
    if (error.errno === 1091 || error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.log(
        '⚠️ Índice UNIQUE en pedido_uid ya no existe (migración ya aplicada). OK.',
      );
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
