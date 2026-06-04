/**
 * Añade columna test_respuestas a prl_employee_documents.
 *
 * Uso:
 *   node scripts/run-prl-test-respuestas-migration.js .env.decamino.local
 *   node scripts/run-prl-test-respuestas-migration.js .env.hera.local
 */
const path = require('path');

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
      console.error(
        '❌ Faltan DB_HOST, DB_USERNAME o DB_NAME. Ejemplo:\n' +
          '  node scripts/run-prl-test-respuestas-migration.js .env.decamino.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a', config.database, 'en', config.host, `(env: ${envFile})`);

    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/20260604150000_prl_test_respuestas/migration.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando migración: test_respuestas en prl_employee_documents...');
    await connection.query(sql);

    console.log('✅ Migración completada.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ La columna test_respuestas ya existe. Nada que hacer.');
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
