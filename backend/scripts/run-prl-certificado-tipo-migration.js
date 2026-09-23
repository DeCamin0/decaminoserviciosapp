/**
 * Adaugă CERTIFICADO la enum PRL.
 * Usage:
 *   node scripts/run-prl-certificado-tipo-migration.js .env.decamino.local
 *   node scripts/run-prl-certificado-tipo-migration.js .env.hera.local
 */
const path = require('path');
const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
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
      console.error('Missing DB config');
      process.exit(1);
    }
    connection = await mysql.createConnection(config);
    console.log('Connected to', config.database);
    const sql = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/manual_prl_certificado_tipo.sql'),
      'utf8',
    );
    await connection.query(sql);
    console.log('Migration OK — CERTIFICADO added to PRL enums');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}
run();
