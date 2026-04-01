/**
 * Adds api_public_url + environment to registry table `tenants`.
 * Target DB: TENANT_REGISTRY_DATABASE_URL if set, else DB_HOST/DB_NAME (same as other run-* scripts).
 *
 * Usage (apply on every env that points to a DB hosting `tenants`):
 *   node scripts/run-tenant-registry-v1-columns-migration.js .env.decamino.local
 *   node scripts/run-tenant-registry-v1-columns-migration.js .env.hera.local
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

function parseMysqlUrl(urlStr) {
  const u = new URL(urlStr.trim());
  if (!u.protocol.startsWith('mysql')) {
    throw new Error('URL must start with mysql://');
  }
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  if (!database) {
    throw new Error('URL must include database name');
  }
  return {
    host: u.hostname,
    port: parseInt(u.port || '3306', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}

async function main() {
  let cfg;
  const regUrl = process.env.TENANT_REGISTRY_DATABASE_URL?.trim();
  if (regUrl) {
    cfg = parseMysqlUrl(regUrl);
  } else {
    cfg = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME,
    };
  }

  if (!cfg.host || !cfg.user || !cfg.database) {
    console.error(
      'Missing DB config. Set TENANT_REGISTRY_DATABASE_URL or DB_HOST/DB_USERNAME/DB_NAME in',
      envFile,
    );
    process.exit(1);
  }

  const sqlPath = path.join(
    __dirname,
    '../migrations/tenant_registry_add_v1_columns.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  let conn;
  try {
    conn = await mysql.createConnection({
      ...cfg,
      multipleStatements: true,
    });
    console.log(
      `[${path.basename(envFile)}] Connected → ${cfg.database} @ ${cfg.host}`,
    );
    await conn.query(sql);
    console.log(`[${path.basename(envFile)}] ✅ Migration applied.`);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log(
        `[${path.basename(envFile)}] ⚠️ Columns already exist — skip.`,
      );
      process.exit(0);
    }
    if (e.code === 'ER_NO_SUCH_TABLE') {
      console.error(
        `[${path.basename(envFile)}] ❌ Table tenants not found in ${cfg.database}. Run tenant_registry_tables.sql first.`,
      );
      process.exit(1);
    }
    console.error(`[${path.basename(envFile)}] ❌`, e.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
