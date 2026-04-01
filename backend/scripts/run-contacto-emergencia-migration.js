/**
 * Añade columnas CONTACTO_EMERGENCIA_* en DatosEmpleados.
 * Usage:
 *   node scripts/run-contacto-emergencia-migration.js .env.decamino.local
 *   node scripts/run-contacto-emergencia-migration.js .env.hera.local
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
        'Missing DB_HOST, DB_USERNAME or DB_NAME. Example: node scripts/run-contacto-emergencia-migration.js .env.hera.local',
      );
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('Connected to', config.database, 'at', config.host);

    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/manual_contacto_emergencia_datos_empleados.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running: manual_contacto_emergencia_datos_empleados.sql');
    await connection.query(sql);
    console.log('Migration completed successfully.');
  } catch (error) {
    const msg = error.message || '';
    const dup =
      error.code === 'ER_DUP_FIELDNAME' ||
      error.errno === 1060 ||
      /Duplicate column name/i.test(msg);
    if (dup) {
      console.log(
        'Columns already exist (duplicate column) — migration skipped, OK.',
      );
      process.exit(0);
      return;
    }
    console.error('Migration failed:', msg);
    if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
