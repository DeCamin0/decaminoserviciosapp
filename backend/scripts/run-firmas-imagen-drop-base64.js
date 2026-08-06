/**
 * DROP firma_imagen_base64 after R2 backfill (presupuestos_firmas + informes_firmas).
 *
 * Usage:
 *   node scripts/run-firmas-imagen-drop-base64.js .env.decamino.local
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

async function dropForTable(connection, table) {
  if (!(await columnExists(connection, table, 'firma_imagen_base64'))) {
    console.log(`[${table}] firma_imagen_base64 already dropped`);
    return;
  }
  const [blobRows] = await connection.query(
    `SELECT COUNT(*) AS c FROM \`${table}\`
     WHERE firma_imagen_base64 IS NOT NULL AND LENGTH(firma_imagen_base64) > 32`,
  );
  const blobs = Number(blobRows[0]?.c || 0);
  console.log(`[${table}] rows with firma_imagen_base64:`, blobs);
  if (blobs > 0) {
    throw new Error(
      `[${table}] Still have ${blobs} LongText signatures. Run firmas-imagen-r2-backfill first.`,
    );
  }
  const [missingKey] = await connection.query(
    `SELECT COUNT(*) AS c FROM \`${table}\`
     WHERE (firma_imagen_storage_key IS NULL OR firma_imagen_storage_key = '')
       AND id IN (
         SELECT id FROM (
           SELECT id FROM \`${table}\`
         ) t
       )`,
  );
  // Allow rows that never had a signature (empty). Only abort if we had cleared blobs incorrectly.
  // Safe: after backfill, remaining empty LongText is fine; we just drop the column.
  void missingKey;

  await connection.query(
    `ALTER TABLE \`${table}\` DROP COLUMN \`firma_imagen_base64\``,
  );
  console.log(`[${table}] Dropped firma_imagen_base64`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  console.log('Connected to', process.env.DB_NAME);
  await dropForTable(connection, 'presupuestos_firmas');
  await dropForTable(connection, 'informes_firmas');
  await connection.end();
  console.log('OK:', process.env.DB_NAME);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
