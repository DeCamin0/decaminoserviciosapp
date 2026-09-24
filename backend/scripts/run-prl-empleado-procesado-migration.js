/**
 * Creează prl_empleado_procesado (checkbox Matrix PRL / Ancara).
 *
 * Uso:
 *   node scripts/run-prl-empleado-procesado-migration.js .env.decamino.local
 *   node scripts/run-prl-empleado-procesado-migration.js .env.hera.local
 */
const path = require('path');

const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');
const fs = require('fs');

async function tableExists(connection, database, table) {
  const [rows] = await connection.query(
    `SELECT 1 AS ok
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     LIMIT 1`,
    [database, table],
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
        '❌ Faltan DB_HOST, DB_USERNAME o DB_NAME.\n' +
          '  node scripts/run-prl-empleado-procesado-migration.js .env.decamino.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log(
      '✅ Conectado a',
      config.database,
      `(env: ${envFile})`,
    );

    const exists = await tableExists(
      connection,
      config.database,
      'prl_empleado_procesado',
    );

    if (!exists) {
      const migrationPath = path.join(
        __dirname,
        '../prisma/migrations/20260924150000_prl_empleado_procesado/migration.sql',
      );
      const sql = fs
        .readFileSync(migrationPath, 'utf8')
        .replace(/^\uFEFF/, '');
      console.log('📄 Creando tabla prl_empleado_procesado...');
      await connection.query(sql);
      console.log('✅ Tabla creada.');
    } else {
      console.log('ℹ️ Tabla prl_empleado_procesado ya existe.');
    }

    console.log('✅ Migración completada.');
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
