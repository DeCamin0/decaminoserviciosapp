/**
 * Curăță coloana SEG. SOCIAL în HERA: păstrează doar cifre.
 * Ex: 28/02568956-02 → 280256895602
 *
 * Rulare: node scripts/cleanup-seg-social-hera.js
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

function onlyDigits(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.replace(/\D/g, '');
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

  const [rows] = await conn.query(
    'SELECT CODIGO, `SEG. SOCIAL` AS segSocial FROM DatosEmpleados WHERE `SEG. SOCIAL` IS NOT NULL AND TRIM(`SEG. SOCIAL`) != \'\''
  );

  let updated = 0;
  for (const r of rows) {
    const codigo = String(r.CODIGO);
    const original = String(r.segSocial || '').trim();
    const cleaned = onlyDigits(original);
    if (cleaned === original || cleaned === '') continue;
    await conn.query('UPDATE DatosEmpleados SET `SEG. SOCIAL` = ? WHERE CODIGO = ?', [cleaned, codigo]);
    updated++;
    console.log('  ', original, '→', cleaned, '(CODIGO', codigo + ')');
  }

  console.log('✅ Actualizate', updated, 'înregistrări (SEG. SOCIAL = doar cifre).');
  await conn.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
