/**
 * Generează parole pentru toți angajații HERA care nu au parolă.
 * Salvează bcrypt în DB; fișierul local conține parola one-shot în clar.
 *
 * Rulare: node scripts/generate-passwords-hera.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const backendDir = path.join(__dirname, '..');
const rootDir = path.join(backendDir, '..');
const BCRYPT_COST = 12;

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

function randomPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const nums = '23456789';
  const special = '!@#$%&*';
  let s =
    upper[Math.floor(Math.random() * upper.length)] +
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    nums[Math.floor(Math.random() * nums.length)] +
    nums[Math.floor(Math.random() * nums.length)] +
    special[Math.floor(Math.random() * special.length)] +
    special[Math.floor(Math.random() * special.length)];
  const all = upper + lower + nums + special;
  while (s.length < 12) s += all[Math.floor(Math.random() * all.length)];
  return s
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
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
    "SELECT CODIGO, `CORREO ELECTRONICO` AS email FROM DatosEmpleados WHERE (Contraseña IS NULL OR Contraseña = '') AND CODIGO IS NOT NULL"
  );

  if (rows.length === 0) {
    console.log('✅ Toți angajații au deja parolă.');
    await conn.end();
    return;
  }

  const list = [];
  for (const r of rows) {
    const codigo = String(r.CODIGO);
    const email = r.email ? String(r.email).trim() : '';
    const pass = randomPassword();
    const hash = await bcrypt.hash(pass, BCRYPT_COST);
    await conn.query(
      'UPDATE DatosEmpleados SET Contraseña = ?, AUTH_VERSION = AUTH_VERSION + 1 WHERE CODIGO = ?',
      [hash, codigo],
    );
    list.push({ codigo, email, pass });
  }

  const passPath = path.join(rootDir, `passwords-hera-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.txt`);
  const lines = ['CODIGO\tEmail\tContraseña', ...list.map((o) => [o.codigo, o.email, o.pass].join('\t'))];
  fs.writeFileSync(passPath, lines.join('\n'), 'utf8');

  console.log('🔑 Parole generate (bcrypt în DB):', list.length);
  console.log('📄 Fișier one-shot:', passPath);
  await conn.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
