/**
 * DROP CatologoProductos.fotoproducto after R2 backfill
 * (no remaining LONGBLOB values; images optional so storage_key stays nullable).
 * Usage:
 *   node scripts/run-catalogo-drop-fotoproducto.js .env.decamino.local
 *   node scripts/run-catalogo-drop-fotoproducto.js .env.hera.local
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

  const table = 'CatologoProductos';

  if (!(await columnExists(conn, table, 'fotoproducto'))) {
    console.log('Column fotoproducto already dropped — nothing to do');
    await conn.end();
    return;
  }

  if (!(await columnExists(conn, table, 'storage_key'))) {
    console.error(
      'ABORT: storage_key column missing. Run db:migrate:catalogo-r2 first.',
    );
    await conn.end();
    process.exit(1);
  }

  const [withBlob] = await conn.query(
    'SELECT COUNT(*) AS c FROM `CatologoProductos` WHERE `fotoproducto` IS NOT NULL',
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  console.log('rows with fotoproducto blob:', blobCount);

  if (blobCount > 0) {
    console.error(
      'ABORT: run backfill first (no rows should keep LONGBLOB fotoproducto).',
    );
    await conn.end();
    process.exit(1);
  }

  await conn.query('ALTER TABLE `CatologoProductos` DROP COLUMN `fotoproducto`');
  console.log('Dropped column fotoproducto');

  // storage_key stays nullable: products without images are valid
  console.log('storage_key left nullable (images optional on catalogo)');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
