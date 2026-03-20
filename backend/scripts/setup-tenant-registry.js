/**
 * Creează tabelele registry în baza indicată (fără CREATE DATABASE).
 * Implicit folosește DB_NAME din .env (ex. decamino_db) — util când userul MySQL
 * nu are drepturi să creeze baze noi.
 *
 * Opțional: TENANT_REGISTRY_DB=alt_nume pentru altă bază pe același server (trebuie creată de DBA).
 *
 * Usage (din folder backend):
 *   node scripts/setup-tenant-registry.js .env.decamino.local
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const envRel = process.argv[2] || '.env.decamino.local';
const envFile = path.resolve(process.cwd(), envRel);
require('dotenv').config({ path: envFile });

async function main() {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD ?? '';
  const database =
    (process.env.TENANT_REGISTRY_DB || process.env.DB_NAME || '').trim();

  if (!host || !user || !database) {
    console.error(
      'Lipsește DB_HOST, DB_USERNAME sau DB_NAME (sau TENANT_REGISTRY_DB) în',
      envFile,
    );
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  const sqlPath = path.join(__dirname, '../migrations/tenant_registry_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await conn.query(sql);

  console.log(
    `OK: tabele tenant registry create în baza "${database}" (fără CREATE DATABASE).`,
  );
  await conn.end();
}

main().catch((e) => {
  console.error('Eroare setup tenant_registry:', e.message);
  process.exit(1);
});
