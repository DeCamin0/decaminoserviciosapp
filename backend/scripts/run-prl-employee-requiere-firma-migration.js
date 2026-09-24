/**
 * Adaugă requiere_firma pe prl_employee_documents + backfill din template.
 *
 * Uso:
 *   node scripts/run-prl-employee-requiere-firma-migration.js .env.decamino.local
 *   node scripts/run-prl-employee-requiere-firma-migration.js .env.hera.local
 */
const path = require('path');

const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');
const fs = require('fs');

async function columnExists(connection, database, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [database, table, column],
  );
  return Array.isArray(rows) && rows.length > 0;
}

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
        '❌ Faltan DB_HOST, DB_USERNAME o DB_NAME. Ejemplo:\n' +
          '  node scripts/run-prl-employee-requiere-firma-migration.js .env.decamino.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log(
      '✅ Conectado a',
      config.database,
      'en',
      config.host,
      `(env: ${envFile})`,
    );

    const exists = await columnExists(
      connection,
      config.database,
      'prl_employee_documents',
      'requiere_firma',
    );

    if (!exists) {
      const migrationPath = path.join(
        __dirname,
        '../prisma/migrations/20260923180000_prl_employee_doc_requiere_firma/migration.sql',
      );
      const sql = fs
        .readFileSync(migrationPath, 'utf8')
        .replace(/^\uFEFF/, '');
      console.log(
        '📄 Ejecutando migración: requiere_firma en prl_employee_documents...',
      );
      await connection.query(sql);
      console.log('✅ Columna añadida + backfill completado.');
    } else {
      console.log(
        'ℹ️ La columna requiere_firma ya existe. No se sobrescriben valores (evita pisar toggles admin).',
      );
    }

    console.log('✅ Migración completada.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ La columna requiere_firma ya existe. Nada que hacer.');
      process.exit(0);
      return;
    }
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
