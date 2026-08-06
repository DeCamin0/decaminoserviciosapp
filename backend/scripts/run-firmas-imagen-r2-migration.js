/**
 * Add firma_imagen_storage_key + make firma_imagen_base64 nullable
 * on presupuestos_firmas and informes_firmas.
 *
 * Usage:
 *   node scripts/run-firmas-imagen-r2-migration.js .env.decamino.local
 *   node scripts/run-firmas-imagen-r2-migration.js .env.hera.local
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

async function migrateTable(connection, table, indexName) {
  await connection.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`firma_imagen_base64\` LONGTEXT NULL`,
  );
  console.log(`[${table}] firma_imagen_base64 set nullable`);

  if (!(await columnExists(connection, table, 'firma_imagen_storage_key'))) {
    await connection.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`firma_imagen_storage_key\` VARCHAR(700) NULL`,
    );
    console.log(`[${table}] Added firma_imagen_storage_key`);
  } else {
    console.log(`[${table}] firma_imagen_storage_key already exists`);
  }

  if (!(await indexExists(connection, table, indexName))) {
    await connection.query(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (\`firma_imagen_storage_key\`)`,
    );
    console.log(`[${table}] Created index ${indexName}`);
  } else {
    console.log(`[${table}] Index ${indexName} already exists`);
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
    console.error('Missing DB_* env');
    process.exit(1);
  }
  const connection = await mysql.createConnection(config);
  console.log('Connected to', config.database);
  await migrateTable(
    connection,
    'presupuestos_firmas',
    'idx_presupuestos_firmas_firma_img_key',
  );
  await migrateTable(
    connection,
    'informes_firmas',
    'idx_informes_firmas_firma_img_key',
  );
  await connection.end();
  console.log('OK: firma imagen R2 columns ready on', config.database);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
