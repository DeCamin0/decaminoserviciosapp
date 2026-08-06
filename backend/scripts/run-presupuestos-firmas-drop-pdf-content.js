/**
 * DROP presupuestos_firmas.pdf_content after R2 backfill.
 * Usage:
 *   node scripts/run-presupuestos-firmas-drop-pdf-content.js .env.decamino.local
 *   node scripts/run-presupuestos-firmas-drop-pdf-content.js .env.hera.local
 *
 * Aborts if any row still has pdf_content, or if any row that previously
 * needed a PDF still lacks storage_key (rows with neither blob nor key nor path
 * are allowed — firma without PDF).
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

  if (!(await columnExists(conn, 'presupuestos_firmas', 'pdf_content'))) {
    console.log('Column pdf_content already dropped — nothing to do');
    await conn.end();
    return;
  }

  const [withBlob] = await conn.query(
    'SELECT COUNT(*) AS c FROM `presupuestos_firmas` WHERE `pdf_content` IS NOT NULL',
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  console.log('rows with pdf_content blob:', blobCount);

  if (blobCount > 0) {
    console.error(
      'ABORT: run backfill first (clear pdf_content; all blobs need storage_key).',
    );
    await conn.end();
    process.exit(1);
  }

  // Rows that still only have disk path and no R2 key should be backfilled first
  const [diskOnly] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`presupuestos_firmas\`
     WHERE (\`storage_key\` IS NULL OR \`storage_key\` = '')
       AND \`pdf_path\` IS NOT NULL
       AND \`pdf_path\` <> ''`,
  );
  const diskOnlyCount = Number(diskOnly[0]?.c || 0);
  console.log('rows with pdf_path but no storage_key:', diskOnlyCount);
  if (diskOnlyCount > 0) {
    console.error(
      'ABORT: backfill disk rows first (or clear orphan pdf_path).',
    );
    await conn.end();
    process.exit(1);
  }

  await conn.query(
    'ALTER TABLE `presupuestos_firmas` DROP COLUMN `pdf_content`',
  );
  console.log('Dropped column pdf_content');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
