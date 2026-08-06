/**
 * DROP comunicados.archivo after R2 backfill (all rows have storage_key when they had blobs).
 * Usage:
 *   node scripts/run-comunicados-drop-archivo.js .env.decamino.local
 *   node scripts/run-comunicados-drop-archivo.js .env.hera.local
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

  if (!(await columnExists(conn, 'comunicados', 'archivo'))) {
    console.log('Column archivo already dropped — nothing to do');
    await conn.end();
    return;
  }

  const [withBlob] = await conn.query(
    'SELECT COUNT(*) AS c FROM `comunicados` WHERE `archivo` IS NOT NULL',
  );
  // Rows that have a file (nombre_archivo set) must have storage_key;
  // rows without any attachment may keep storage_key NULL.
  const [withoutKey] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`comunicados\`
     WHERE \`archivo\` IS NOT NULL
        AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  const noKeyCount = Number(withoutKey[0]?.c || 0);
  console.log('rows with archivo blob:', blobCount);
  console.log('blob rows without storage_key:', noKeyCount);

  if (blobCount > 0 || noKeyCount > 0) {
    console.error(
      'ABORT: run backfill first (all blob rows need storage_key, none should keep LONGBLOB).',
    );
    await conn.end();
    process.exit(1);
  }

  await conn.query('ALTER TABLE `comunicados` DROP COLUMN `archivo`');
  console.log('Dropped column archivo');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
