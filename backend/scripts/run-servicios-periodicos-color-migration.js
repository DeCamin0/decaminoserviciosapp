/**
 * Añade columna color a servicios_periodicos_tipos.
 * Usage:
 *   node scripts/run-servicios-periodicos-color-migration.js .env.decamino.local
 */
const path = require('path');

const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');

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
      console.error('Missing DB_HOST, DB_USERNAME or DB_NAME.');
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('Connected to', config.database, 'at', config.host);

    // MySQL older versions may not support ADD COLUMN IF NOT EXISTS — check first
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'servicios_periodicos_tipos' AND COLUMN_NAME = 'color'`,
      [config.database],
    );

    if (!cols.length) {
      await connection.query(
        `ALTER TABLE \`servicios_periodicos_tipos\`
         ADD COLUMN \`color\` VARCHAR(20) NOT NULL DEFAULT '#0ea5e9' AFTER \`nombre\``,
      );
      console.log('Column color added.');
    } else {
      console.log('Column color already exists — OK.');
    }

    await connection.query(
      `UPDATE \`servicios_periodicos_tipos\` SET \`color\` = '#0ea5e9' WHERE \`nombre\` = 'Limpieza de cristales'`,
    );
    await connection.query(
      `UPDATE \`servicios_periodicos_tipos\` SET \`color\` = '#f59e0b' WHERE \`nombre\` = 'Garajes'`,
    );
    await connection.query(
      `UPDATE \`servicios_periodicos_tipos\` SET \`color\` = '#a855f7' WHERE \`nombre\` = 'Abrillantado'`,
    );
    await connection.query(
      `UPDATE \`servicios_periodicos_tipos\` SET \`color\` = '#14b8a6' WHERE \`nombre\` = 'Limpieza de patio'`,
    );
    console.log('Default colors applied.');
    console.log('Migration completed successfully.');
  } catch (error) {
    const msg = error.message || '';
    const dup =
      error.code === 'ER_DUP_FIELDNAME' ||
      error.errno === 1060 ||
      /Duplicate column name/i.test(msg);
    if (dup) {
      console.log('Column already exists — OK.');
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
