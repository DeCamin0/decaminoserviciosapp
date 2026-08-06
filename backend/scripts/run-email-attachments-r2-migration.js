/**
 * R2 columns for email_attachments (file_content → storage_key).
 * Usage: node scripts/run-email-attachments-r2-migration.js .env.decamino.local
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

  const table = 'email_attachments';
  if (!(await columnExists(conn, table, 'file_content'))) {
    console.log('skip: no file_content column (already dropped?)');
    await conn.end();
    return;
  }

  await conn.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`file_content\` LONGBLOB NULL`,
  );
  console.log('file_content nullable');

  for (const [col, ddl] of [
    ['storage_key', 'VARCHAR(700) NULL'],
    ['storage_bucket', 'VARCHAR(120) NULL'],
  ]) {
    if (!(await columnExists(conn, table, col))) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${ddl}`);
      console.log('added', col);
    } else {
      console.log(col, 'exists');
    }
  }

  const indexName = 'idx_email_attachment_storage_key';
  if (!(await indexExists(conn, table, indexName))) {
    await conn.query(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (\`storage_key\`)`,
    );
    console.log('created index', indexName);
  } else {
    console.log('index exists', indexName);
  }

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
