/**
 * DROP email_attachments.file_content after R2 backfill.
 * Usage: node scripts/run-email-attachments-drop-file-content.js .env.decamino.local
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
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
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
    console.error('Missing DB_*');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  console.log('Connected to', config.database);

  const table = 'email_attachments';
  if (!(await columnExists(conn, table, 'file_content'))) {
    console.log('file_content already dropped');
    await conn.end();
    return;
  }

  const [withBlob] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`file_content\` IS NOT NULL`,
  );
  const [noKey] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`${table}\`
     WHERE \`storage_key\` IS NULL OR \`storage_key\` = ''`,
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  const noKeyCount = Number(noKey[0]?.c || 0);
  console.log('rows with file_content blob:', blobCount);
  console.log('rows without storage_key:', noKeyCount);

  if (blobCount > 0 || noKeyCount > 0) {
    throw new Error(
      `ABORT: backfill incomplete (blob=${blobCount}, noKey=${noKeyCount})`,
    );
  }

  await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`file_content\``);
  console.log('Dropped file_content');

  await conn.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`storage_key\` VARCHAR(700) NOT NULL`,
  );
  console.log('storage_key NOT NULL');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
