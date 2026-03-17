/**
 * În tabel Clientes (HERA): înlocuiește "C.P." și "CP." cu "COMUNIDAD DE PROPIETARIOS" în NOMBRE O RAZON SOCIAL.
 *
 * Rulare: node scripts/replace-cp-with-comunidad-hera.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const backendDir = path.join(__dirname, '..');

function loadEnv(envFile) {
  const envPath = path.join(backendDir, envFile);
  if (!fs.existsSync(envPath)) return null;
  const env = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
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
  return env;
}

async function main() {
  const envHera = loadEnv('.env.client2.local');
  if (!envHera || envHera.DB_NAME !== 'hera_facility_db') {
    console.error('❌ .env.client2.local lipsește sau DB_NAME nu e hera_facility_db.');
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

  console.log('🔗 Conectare la HERA', config.host, '...');
  const conn = await mysql.createConnection(config);

  // C.P. și CP. → COMUNIDAD DE PROPIETARIOS
  const [r1] = await conn.query(
    "UPDATE Clientes SET `NOMBRE O RAZON SOCIAL` = REPLACE(`NOMBRE O RAZON SOCIAL`, 'C.P.', 'COMUNIDAD DE PROPIETARIOS') WHERE `NOMBRE O RAZON SOCIAL` LIKE '%C.P.%'"
  );
  const [r2] = await conn.query(
    "UPDATE Clientes SET `NOMBRE O RAZON SOCIAL` = REPLACE(`NOMBRE O RAZON SOCIAL`, 'CP.', 'COMUNIDAD DE PROPIETARIOS ') WHERE `NOMBRE O RAZON SOCIAL` LIKE '%CP.%'"
  );
  console.log('✅ C.P. → COMUNIDAD DE PROPIETARIOS:', r1.affectedRows, '| CP. → COMUNIDAD DE PROPIETARIOS:', r2.affectedRows);

  await conn.end();
  console.log('✅ Gata.');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
