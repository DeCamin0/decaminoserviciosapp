/**
 * DROP empty unused BLOB columns (0 rows with data):
 *   Clientes.CONTRACTO
 *   SignSessions.original / signed
 *   prl_employee_documents.certificado_archivo
 *
 * Usage: node scripts/run-drop-empty-blob-columns.js .env.decamino.local
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

async function dropIfEmpty(conn, table, column) {
  console.log(`--- ${table}.${column}`);
  if (!(await columnExists(conn, table, column))) {
    console.log('already dropped');
    return;
  }
  const [r] = await conn.query(
    `SELECT COUNT(*) AS total,
            SUM(\`${column}\` IS NOT NULL) AS with_blob
     FROM \`${table}\``,
  );
  const withBlob = Number(r[0]?.with_blob || 0);
  console.log('rows with blob:', withBlob, 'total:', Number(r[0]?.total || 0));
  if (withBlob > 0) {
    throw new Error(
      `ABORT ${table}.${column}: still has ${withBlob} non-null blob(s)`,
    );
  }
  await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  console.log('Dropped');
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

  await dropIfEmpty(conn, 'Clientes', 'CONTRACTO');
  await dropIfEmpty(conn, 'SignSessions', 'original');
  await dropIfEmpty(conn, 'SignSessions', 'signed');
  await dropIfEmpty(conn, 'prl_employee_documents', 'certificado_archivo');

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
