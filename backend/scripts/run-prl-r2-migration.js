/**
 * Adds PRL R2 metadata columns + makes blob columns nullable.
 * Tables: prl_document_templates, prl_employee_documents
 * Usage:
 *   node scripts/run-prl-r2-migration.js .env.decamino.local
 *   node scripts/run-prl-r2-migration.js .env.hera.local
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

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function addColumnIfMissing(connection, table, column, ddl) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`Added column ${table}.${column}`);
  } else {
    console.log(`Column ${table}.${column} already exists`);
  }
}

async function addIndexIfMissing(connection, table, indexName, column) {
  if (!(await indexExists(connection, table, indexName))) {
    await connection.query(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (\`${column}\`)`,
    );
    console.log(`Created index ${indexName}`);
  } else {
    console.log(`Index ${indexName} already exists`);
  }
}

async function runMigration() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (!config.host || !config.user || !config.database) {
    console.error(
      'Missing DB_* . Example: node scripts/run-prl-r2-migration.js .env.decamino.local',
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection(config);
  console.log('Connected to', config.database, 'at', config.host);

  // --- prl_document_templates ---
  const templates = 'prl_document_templates';

  await connection.query(
    `ALTER TABLE \`${templates}\` MODIFY COLUMN \`archivo\` LONGBLOB NULL`,
  );
  console.log(`${templates}.archivo set nullable`);

  await addColumnIfMissing(
    connection,
    templates,
    'storage_key',
    '`storage_key` VARCHAR(700) NULL',
  );
  await addColumnIfMissing(
    connection,
    templates,
    'storage_bucket',
    '`storage_bucket` VARCHAR(120) NULL',
  );
  await addColumnIfMissing(
    connection,
    templates,
    'tamano_bytes',
    '`tamano_bytes` INT NULL',
  );
  await addIndexIfMissing(
    connection,
    templates,
    'idx_prl_template_storage_key',
    'storage_key',
  );

  // --- prl_employee_documents ---
  const empDocs = 'prl_employee_documents';

  await connection.query(
    `ALTER TABLE \`${empDocs}\` MODIFY COLUMN \`archivo_original\` LONGBLOB NULL`,
  );
  console.log(`${empDocs}.archivo_original set nullable`);

  await connection.query(
    `ALTER TABLE \`${empDocs}\` MODIFY COLUMN \`archivo_firmado\` LONGBLOB NULL`,
  );
  console.log(`${empDocs}.archivo_firmado set nullable`);

  await addColumnIfMissing(
    connection,
    empDocs,
    'storage_key_original',
    '`storage_key_original` VARCHAR(700) NULL',
  );
  await addColumnIfMissing(
    connection,
    empDocs,
    'storage_bucket_original',
    '`storage_bucket_original` VARCHAR(120) NULL',
  );
  await addColumnIfMissing(
    connection,
    empDocs,
    'tamano_bytes_original',
    '`tamano_bytes_original` INT NULL',
  );
  await addColumnIfMissing(
    connection,
    empDocs,
    'storage_key_firmado',
    '`storage_key_firmado` VARCHAR(700) NULL',
  );
  await addColumnIfMissing(
    connection,
    empDocs,
    'storage_bucket_firmado',
    '`storage_bucket_firmado` VARCHAR(120) NULL',
  );
  await addColumnIfMissing(
    connection,
    empDocs,
    'tamano_bytes_firmado',
    '`tamano_bytes_firmado` INT NULL',
  );

  await addIndexIfMissing(
    connection,
    empDocs,
    'idx_prl_emp_doc_storage_key_original',
    'storage_key_original',
  );
  await addIndexIfMissing(
    connection,
    empDocs,
    'idx_prl_emp_doc_storage_key_firmado',
    'storage_key_firmado',
  );

  await connection.end();
  console.log('OK: PRL R2 columns ready on', config.database);
}

runMigration().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
