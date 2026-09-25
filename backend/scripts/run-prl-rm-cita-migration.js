/**
 * Adaugă coloane rm_cita_* pe prl_employee_documents.
 *
 * Uso:
 *   node scripts/run-prl-rm-cita-migration.js .env.decamino.local
 *   node scripts/run-prl-rm-cita-migration.js .env.hera.local
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
          '  node scripts/run-prl-rm-cita-migration.js .env.decamino.local',
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
      'rm_cita_fecha',
    );

    if (!exists) {
      const migrationPath = path.join(
        __dirname,
        '../prisma/migrations/20260925140000_prl_rm_cita/migration.sql',
      );
      const sql = fs
        .readFileSync(migrationPath, 'utf8')
        .replace(/^\uFEFF/, '');
      console.log(
        '📄 Ejecutando migración: rm_cita_* en prl_employee_documents...',
      );
      await connection.query(sql);
      console.log('✅ Columnas rm_cita_* aplicadas.');
    } else {
      console.log('ℹ️ La columna rm_cita_fecha ya existe. Nada que hacer.');
    }

    console.log('✅ Migración completada.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Las columnas ya existen. Nada que hacer.');
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
