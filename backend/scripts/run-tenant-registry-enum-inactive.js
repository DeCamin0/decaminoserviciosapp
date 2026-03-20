/**
 * Aplică ALTER ENUM pentru status 'inactive' pe tabela tenants.
 * Usage: node scripts/run-tenant-registry-enum-inactive.js .env.decamino.local
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const envFile = path.resolve(process.cwd(), process.argv[2] || '.env.decamino.local');
require('dotenv').config({ path: envFile });

function parseMysqlUrl(urlStr) {
  const u = new URL(urlStr.trim());
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  return {
    host: u.hostname,
    port: parseInt(u.port || '3306', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}

async function main() {
  const url = process.env.TENANT_REGISTRY_DATABASE_URL?.trim();
  if (!url) {
    console.error('Lipsește TENANT_REGISTRY_DATABASE_URL');
    process.exit(1);
  }
  const sqlPath = path.join(
    __dirname,
    '../migrations/tenant_registry_status_inactive_alter.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection(parseMysqlUrl(url));
  await conn.query(sql);
  console.log('OK: tenants.status permite acum și inactive.');
  await conn.end();
}

main().catch((e) => {
  if (String(e.message).includes('Duplicate') || e.code === 'ER_DUP_FIELDNAME') {
    console.log('Deja aplicat sau fără schimbare:', e.message);
    process.exit(0);
  }
  console.error(e.message);
  process.exit(1);
});
