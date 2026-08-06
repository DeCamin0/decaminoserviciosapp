/**
 * DROP Avatar.AVATAR after R2 backfill (all rows have storage_key).
 * Column name is AVATAR (not archivo) — abort if any blob or missing key remains.
 *
 * Usage:
 *   node scripts/run-avatar-drop-avatar-column.js .env.decamino.local
 *   node scripts/run-avatar-drop-avatar-column.js .env.hera.local
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

async function main() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  if (!config.host || !config.user || !config.database) {
    console.error('Missing DB_* in', envFile);
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  console.log('Connected to', config.database);

  if (!(await columnExists(conn, 'Avatar', 'AVATAR'))) {
    console.log('Column AVATAR already dropped — nothing to do');
    await conn.end();
    return;
  }

  if (!(await columnExists(conn, 'Avatar', 'storage_key'))) {
    console.error(
      'ABORT: storage_key column missing — run avatar R2 migration first.',
    );
    await conn.end();
    process.exit(1);
  }

  const [withBlob] = await conn.query(
    'SELECT COUNT(*) AS c FROM `Avatar` WHERE `AVATAR` IS NOT NULL',
  );
  const [withoutKey] = await conn.query(
    "SELECT COUNT(*) AS c FROM `Avatar` WHERE `storage_key` IS NULL OR `storage_key` = ''",
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  const noKeyCount = Number(withoutKey[0]?.c || 0);
  console.log('rows with AVATAR blob:', blobCount);
  console.log('rows without storage_key:', noKeyCount);

  if (blobCount > 0 || noKeyCount > 0) {
    console.error(
      'ABORT: run backfill first (all rows need storage_key, none should keep AVATAR LONGBLOB).',
    );
    await conn.end();
    process.exit(1);
  }

  // Explicit column name AVATAR (table Avatar) — do not confuse with other tables
  await conn.query('ALTER TABLE `Avatar` DROP COLUMN `AVATAR`');
  console.log('Dropped column Avatar.AVATAR');

  await conn.query(
    'ALTER TABLE `Avatar` MODIFY COLUMN `storage_key` VARCHAR(700) NOT NULL',
  );
  console.log('storage_key set NOT NULL');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
