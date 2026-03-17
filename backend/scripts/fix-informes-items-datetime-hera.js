/**
 * Corectează created_at / updated_at invalide (zi/lună 0) în informes_items în baza HERA.
 * Prisma dă eroare "Value out of range" la citire dacă există astfel de date.
 *
 * Rulare din backend: node scripts/fix-informes-items-datetime-hera.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const backendDir = path.join(__dirname, '..');

function loadEnv(envFile) {
  const envPath = path.join(backendDir, envFile);
  if (!fs.existsSync(envPath)) return null;
  const env = {};
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    raw.split('\n').forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) {
          const key = t.slice(0, eq).trim();
          let value = t.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
          env[key] = value;
        }
      }
    });
  } catch (_) {}
  return env;
}

async function main() {
  const envHera = loadEnv('.env.client2.local');
  if (!envHera || !envHera.DB_HOST) {
    console.error('❌ .env.client2.local lipsește sau nu conține DB_HOST.');
    process.exit(1);
  }

  const config = {
    host: envHera.DB_HOST,
    port: parseInt(envHera.DB_PORT || '3306', 10),
    user: envHera.DB_USERNAME,
    password: envHera.DB_PASSWORD || '',
    database: envHera.DB_NAME,
    charset: 'utf8mb4',
  };

  console.log('🔗 Conectare la HERA', config.host, config.database, '...');
  const conn = await mysql.createConnection(config);

  const [res] = await conn.query(`
    UPDATE informes_items
    SET
      created_at = IF(created_at IS NULL OR created_at = '0000-00-00 00:00:00' OR DAY(created_at) = 0 OR MONTH(created_at) = 0, NOW(), created_at),
      updated_at = IF(updated_at IS NULL OR updated_at = '0000-00-00 00:00:00' OR DAY(updated_at) = 0 OR MONTH(updated_at) = 0, NOW(), updated_at)
  `);
  await conn.end();

  console.log('✅ Actualizate rânduri cu date invalide:', res.affectedRows);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
