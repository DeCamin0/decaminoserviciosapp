/**
 * Șterge angajații duplicați din HERA (batch CODIGO 10000064–10000125).
 * Rulează o singură dată după ce ai dublat din greșeală la import.
 *
 * Rulare: node scripts/cleanup-duplicate-empleados-hera.js
 * Opțional: node scripts/cleanup-duplicate-empleados-hera.js 10000064 10000125
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
  const fromCodigo = process.argv[2] ? String(process.argv[2]) : '10000064';
  const toCodigo = process.argv[3] ? String(process.argv[3]) : '10000125';

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

  const [rows] = await conn.query(
    'SELECT COUNT(*) AS n FROM DatosEmpleados WHERE CODIGO >= ? AND CODIGO <= ?',
    [fromCodigo, toCodigo]
  );
  const count = rows[0].n;
  if (count === 0) {
    console.log('✅ Nu există înregistrări în intervalul', fromCodigo, '–', toCodigo);
    await conn.end();
    return;
  }

  await conn.query('DELETE FROM DatosEmpleados WHERE CODIGO >= ? AND CODIGO <= ?', [fromCodigo, toCodigo]);
  console.log('🗑️ Șterse', count, 'înregistrări duplicate (CODIGO', fromCodigo, '–', toCodigo, ')');
  await conn.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
