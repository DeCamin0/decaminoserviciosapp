/**
 * Copiază DOAR userul cu GRUPO = 'Developer' din decamino_db.DatosEmpleados
 * în hera_facility_db.DatosEmpleados (pentru login pe HERA).
 *
 * Cerințe:
 * - Ambele baze pe același server MySQL (același DB_HOST / user).
 * - Tabelul DatosEmpleados există deja în HERA (ex. după prisma db push sau migrate).
 *
 * Rulare:
 *   node scripts/import-developer-user-to-hera.js
 *
 * Folosește .env pentru Decamino (sursă) și .env.client2.local pentru HERA (destinație).
 * Conexiunea se face cu userul Decamino (același user are acces la ambele baze pe server).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const backendDir = path.join(__dirname, '..');

function loadEnv(envFile) {
  const envPath = path.join(backendDir, envFile);
  if (!fs.existsSync(envPath)) {
    return null;
  }
  const env = {};
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) {
          const key = t.slice(0, eq).trim();
          let value = t.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
  return env;
}

async function main() {
  const envDecamino = loadEnv('.env');
  const envHera = loadEnv('.env.client2.local');

  if (!envDecamino || !envDecamino.DB_HOST) {
    console.error('❌ .env (Decamino) lipsește sau nu conține DB_*.');
    process.exit(1);
  }
  if (!envHera || envHera.DB_NAME !== 'hera_facility_db') {
    console.error('❌ .env.client2.local lipsește sau DB_NAME nu e hera_facility_db.');
    process.exit(1);
  }

  const decaminoDb = envDecamino.DB_NAME || 'decamino_db';
  const heraDb = envHera.DB_NAME;

  const config = {
    host: envDecamino.DB_HOST,
    port: parseInt(envDecamino.DB_PORT || '3306', 10),
    user: envDecamino.DB_USERNAME,
    password: envDecamino.DB_PASSWORD || '',
    database: decaminoDb,
    charset: 'utf8mb4',
  };

  console.log('🔗 Conectare la', config.host, '...');
  const conn = await mysql.createConnection(config);

  try {
    const [rows] = await conn.query(
      "SELECT * FROM DatosEmpleados WHERE GRUPO = 'Developer' LIMIT 1"
    );

    if (!rows || rows.length === 0) {
      console.log('⚠️ Nu există niciun user cu GRUPO = \'Developer\' în', decaminoDb);
      return;
    }

    const user = rows[0];
    const codigo = user.CODIGO;
    console.log('👤 Găsit Developer:', codigo, user['NOMBRE / APELLIDOS'] || user.NOMBRE_APELLIDOS || '');

    const columns = Object.keys(user).filter((k) => k !== undefined);
    const placeholders = columns.map(() => '?').join(', ');
    const colList = columns.map((c) => '`' + String(c).replace(/`/g, '``') + '`').join(', ');
    const updateSet = columns.filter((c) => c !== 'CODIGO').map((c) => '`' + String(c).replace(/`/g, '``') + '`=?').join(', ');
    const sqlInsert = `INSERT INTO \`${heraDb}\`.DatosEmpleados (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSet}`;

    const values = columns.map((c) => user[c]);
    const updateValues = columns.filter((c) => c !== 'CODIGO').map((c) => user[c]);
    await conn.query(sqlInsert, [...values, ...updateValues]);
    console.log('✅ User Developer copiat/actualizat în', heraDb + '.DatosEmpleados (CODIGO:', codigo + ').');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
