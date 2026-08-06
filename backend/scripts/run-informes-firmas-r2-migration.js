/**
 * Adds informes_firmas R2 metadata columns.
 * Usage:
 *   node scripts/run-informes-firmas-r2-migration.js .env.decamino.local
 *   node scripts/run-informes-firmas-r2-migration.js .env.hera.local
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.decamino.local';
const envPath = path.resolve(__dirname, '..', envFile);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv(envPath);

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function runMigration() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (!config.host || !config.user || !config.database) {
    console.error(
      'Missing DB_HOST, DB_USERNAME or DB_NAME. Example: node scripts/run-informes-firmas-r2-migration.js .env.decamino.local',
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection(config);
  console.log('Connected to', config.database, 'at', config.host);

  const table = 'informes_firmas';

  if (!(await columnExists(connection, table, 'storage_key'))) {
    await connection.query(
      'ALTER TABLE `informes_firmas` ADD COLUMN `storage_key` VARCHAR(700) NULL',
    );
    console.log('Added column storage_key');
  } else {
    console.log('Column storage_key already exists');
  }

  if (!(await columnExists(connection, table, 'storage_bucket'))) {
    await connection.query(
      'ALTER TABLE `informes_firmas` ADD COLUMN `storage_bucket` VARCHAR(120) NULL',
    );
    console.log('Added column storage_bucket');
  } else {
    console.log('Column storage_bucket already exists');
  }

  if (!(await columnExists(connection, table, 'tamano_bytes'))) {
    await connection.query(
      'ALTER TABLE `informes_firmas` ADD COLUMN `tamano_bytes` INT NULL',
    );
    console.log('Added column tamano_bytes');
  } else {
    console.log('Column tamano_bytes already exists');
  }

  if (
    !(await indexExists(connection, table, 'idx_informes_firmas_storage_key'))
  ) {
    await connection.query(
      'CREATE INDEX `idx_informes_firmas_storage_key` ON `informes_firmas` (`storage_key`)',
    );
    console.log('Created index idx_informes_firmas_storage_key');
  } else {
    console.log('Index idx_informes_firmas_storage_key already exists');
  }

  await connection.end();
  console.log('OK: informes_firmas R2 columns ready on', config.database);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
