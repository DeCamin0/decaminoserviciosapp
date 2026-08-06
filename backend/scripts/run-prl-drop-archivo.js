/**
 * DROP PRL LONGBLOB columns after R2 backfill.
 * - prl_document_templates.archivo
 * - prl_employee_documents.archivo_original
 * - prl_employee_documents.archivo_firmado
 *
 * Makes storage_key / storage_key_original NOT NULL when tables have rows
 * (templates always keyed; originals always keyed; firmado stays nullable).
 *
 * Usage:
 *   node scripts/run-prl-drop-archivo.js .env.decamino.local
 *   node scripts/run-prl-drop-archivo.js .env.hera.local
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

async function dropIfExists(connection, table, column) {
  if (!(await columnExists(connection, table, column))) {
    console.log(`Column ${table}.${column} already dropped`);
    return;
  }
  await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  console.log(`Dropped ${table}.${column}`);
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

  let tplBlobN = 0;
  let origBlobN = 0;
  let firmBlobN = 0;

  if (await columnExists(conn, 'prl_document_templates', 'archivo')) {
    const [tplBlob] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`prl_document_templates\` WHERE \`archivo\` IS NOT NULL`,
    );
    tplBlobN = Number(tplBlob[0]?.c || 0);
  }
  const [tplNoKey] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`prl_document_templates\`
     WHERE \`storage_key\` IS NULL OR \`storage_key\` = ''`,
  );
  const tplNoKeyN = Number(tplNoKey[0]?.c || 0);

  if (await columnExists(conn, 'prl_employee_documents', 'archivo_original')) {
    const [origBlob] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`prl_employee_documents\` WHERE \`archivo_original\` IS NOT NULL`,
    );
    origBlobN = Number(origBlob[0]?.c || 0);
  }
  const [origNoKey] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`prl_employee_documents\`
     WHERE \`storage_key_original\` IS NULL OR \`storage_key_original\` = ''`,
  );
  const origNoKeyN = Number(origNoKey[0]?.c || 0);

  if (await columnExists(conn, 'prl_employee_documents', 'archivo_firmado')) {
    const [firmBlob] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`prl_employee_documents\` WHERE \`archivo_firmado\` IS NOT NULL`,
    );
    firmBlobN = Number(firmBlob[0]?.c || 0);
  }

  console.log('templates with blob:', tplBlobN, '| without storage_key:', tplNoKeyN);
  console.log('emp original with blob:', origBlobN, '| without storage_key_original:', origNoKeyN);
  console.log('emp firmado with blob:', firmBlobN);

  if (
    tplBlobN > 0 ||
    tplNoKeyN > 0 ||
    origBlobN > 0 ||
    origNoKeyN > 0 ||
    firmBlobN > 0
  ) {
    console.error(
      'ABORT: run backfill first (no LONGBLOB left; templates + originals need storage keys).',
    );
    await conn.end();
    process.exit(1);
  }

  await dropIfExists(conn, 'prl_document_templates', 'archivo');
  await dropIfExists(conn, 'prl_employee_documents', 'archivo_original');
  await dropIfExists(conn, 'prl_employee_documents', 'archivo_firmado');

  // Empty Hera tables: MODIFY NOT NULL is still fine.
  if (await columnExists(conn, 'prl_document_templates', 'storage_key')) {
    await conn.query(
      `ALTER TABLE \`prl_document_templates\` MODIFY COLUMN \`storage_key\` VARCHAR(700) NOT NULL`,
    );
    console.log('prl_document_templates.storage_key set NOT NULL');
  }

  if (await columnExists(conn, 'prl_employee_documents', 'storage_key_original')) {
    await conn.query(
      `ALTER TABLE \`prl_employee_documents\` MODIFY COLUMN \`storage_key_original\` VARCHAR(700) NOT NULL`,
    );
    console.log('prl_employee_documents.storage_key_original set NOT NULL');
  }

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
