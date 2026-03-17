/**
 * Copiază datele din CatologoProductos (catalog) din baza Decamino în HERA.
 * Același catalog pe ambele baze.
 *
 * Cerințe: același server MySQL (sau user cu acces la ambele baze).
 * Sursă: .env (Decamino, DB_NAME=decaminoservicios sau decamino_db)
 * Destinație: .env.client2.local (HERA, DB_NAME=hera_facility_db)
 *
 * Rulare: node scripts/import-catalogo-decamino-to-hera.js
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
  const envDecamino = loadEnv('.env');
  const envHera = loadEnv('.env.client2.local');

  if (!envDecamino || !envDecamino.DB_HOST) {
    console.error('❌ .env (Decamino) lipsește sau nu conține DB_HOST.');
    process.exit(1);
  }
  if (!envHera || envHera.DB_NAME !== 'hera_facility_db') {
    console.error('❌ .env.client2.local lipsește sau DB_NAME nu e hera_facility_db.');
    process.exit(1);
  }

  const decaminoDb = envDecamino.DB_NAME || 'decaminoservicios';

  const configDecamino = {
    host: envDecamino.DB_HOST,
    port: parseInt(envDecamino.DB_PORT || '3306', 10),
    user: envDecamino.DB_USERNAME,
    password: envDecamino.DB_PASSWORD || '',
    database: decaminoDb,
    charset: 'utf8mb4',
  };

  const configHera = {
    host: envHera.DB_HOST,
    port: parseInt(envHera.DB_PORT || '3306', 10),
    user: envHera.DB_USERNAME,
    password: envHera.DB_PASSWORD || '',
    database: envHera.DB_NAME,
    charset: 'utf8mb4',
  };

  console.log('🔗 Conectare la Decamino', configDecamino.host, '...');
  const connDecamino = await mysql.createConnection(configDecamino);

  const [rows] = await connDecamino.query(
    `SELECT \`Número de artículo\`, \`Descripción de artículo\`, \`Precio por unidad\`, fotoproducto FROM CatologoProductos`
  );
  await connDecamino.end();

  if (!rows || rows.length === 0) {
    console.log('⚠️ Niciun produs în catalogul Decamino (' + decaminoDb + '.CatologoProductos).');
    return;
  }

  console.log('📦 Produse în Decamino:', rows.length);
  console.log('🔗 Conectare la HERA', configHera.host, '...');
  const connHera = await mysql.createConnection(configHera);

  const sql = `INSERT INTO CatologoProductos (\`Número de artículo\`, \`Descripción de artículo\`, \`Precio por unidad\`, fotoproducto) VALUES (?, ?, ?, ?)`;

  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    try {
      const [existing] = await connHera.query(
        'SELECT id FROM CatologoProductos WHERE `Número de artículo` = ? LIMIT 1',
        [r['Número de artículo']]
      );
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      await connHera.query(sql, [
        r['Número de artículo'] ?? '',
        r['Descripción de artículo'] ?? '',
        r['Precio por unidad'] ?? 0,
        r.fotoproducto ?? null,
      ]);
      inserted++;
    } catch (e) {
      console.warn('⚠️', r['Número de artículo'], e.message);
    }
  }

  console.log('✅ Inserate în HERA:', inserted, '| Deja existente (omise):', skipped);
  await connHera.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
