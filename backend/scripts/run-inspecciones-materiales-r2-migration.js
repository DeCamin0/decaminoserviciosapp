/**
 * R2 columns for InspeccionesDocumentos + MaterialesDocumentos.
 * Usage: node scripts/run-inspecciones-materiales-r2-migration.js .env.decamino.local
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

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function migrateTable(connection, table, indexName) {
  console.log('---', table);
  if (!(await columnExists(connection, table, 'archivo'))) {
    console.log('skip (no archivo)');
    return;
  }
  await connection.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`archivo\` LONGBLOB NULL`,
  );
  console.log('archivo nullable');

  for (const [col, ddl] of [
    ['storage_key', 'VARCHAR(700) NULL'],
    ['storage_bucket', 'VARCHAR(120) NULL'],
    ['tamano_bytes', 'INT NULL'],
  ]) {
    if (!(await columnExists(connection, table, col))) {
      await connection.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${ddl}`,
      );
      console.log('added', col);
    } else {
      console.log(col, 'exists');
    }
  }

  if (!(await indexExists(connection, table, indexName))) {
    await connection.query(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (\`storage_key\`)`,
    );
    console.log('created index', indexName);
  } else {
    console.log('index exists', indexName);
  }
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
  await migrateTable(
    conn,
    'InspeccionesDocumentos',
    'idx_inspecciones_doc_storage_key',
  );
  await migrateTable(conn, 'MaterialesDocumentos', 'idx_materiales_doc_storage_key');
  await conn.end();
  console.log('OK:', config.database);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
