/**
 * Crea tablas fotos_trabajo_albumes + fotos_trabajo_fotos.
 * Usage:
 *   node scripts/run-fotos-trabajo-migration.js .env.decamino.local
 *   node scripts/run-fotos-trabajo-migration.js .env.hera.local
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

async function runMigration() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  };

  if (!config.host || !config.user || !config.database) {
    console.error(
      'Missing DB_HOST, DB_USERNAME or DB_NAME. Example: node scripts/run-fotos-trabajo-migration.js .env.decamino.local',
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection(config);
  console.log('Connected to', config.database, 'at', config.host);

  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/manual_fotos_trabajo.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await connection.query(sql);
  await connection.end();
  console.log('OK: fotos_trabajo tables ready on', config.database);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
