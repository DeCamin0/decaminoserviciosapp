/**
 * Crea app_settings y renta_campana_solicitudes.
 * Usage:
 *   node scripts/run-renta-campana-2025-migration.js .env.decamino.local
 *   node scripts/run-renta-campana-2025-migration.js .env.hera.local
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
        '❌ Missing DB_HOST, DB_USERNAME or DB_NAME. Example: node scripts/run-renta-campana-2025-migration.js .env.hera.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('✅ Connected to', config.database, 'at', config.host);

    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/manual_renta_campana_2025.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running: manual_renta_campana_2025.sql');

    await connection.query(sql);

    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
