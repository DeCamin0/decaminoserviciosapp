/**
 * Copiază ítems din informes_items (Líneas de factura / Informes) din baza Decamino în HERA.
 * La client 2 (HERA) dropdown-ul "Seleccionar item" rămâne gol dacă nu există rânduri în HERA.
 *
 * Cerințe: același server MySQL (sau user cu acces la ambele baze).
 * Sursă: .env (Decamino)
 * Destinație: .env.client2.local (HERA, DB_NAME=hera_facility_db)
 *
 * Rulare din backend: node scripts/import-informes-items-decamino-to-hera.js
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
  if (!envHera || !envHera.DB_NAME) {
    console.error('❌ .env.client2.local lipsește sau nu conține DB_NAME.');
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

  console.log('🔗 Conectare la Decamino', configDecamino.host, configDecamino.database, '...');
  const connDecamino = await mysql.createConnection(configDecamino);

  const [rows] = await connDecamino.query(
    `SELECT item_id, nombre, descripcion, precio, observaciones, activo FROM informes_items`
  );
  await connDecamino.end();

  if (!rows || rows.length === 0) {
    console.log('⚠️ Niciun ítem în Decamino (informes_items). Rulează mai întâi import-informes-items-from-excel.js pe Decamino.');
    return;
  }

  console.log('📦 Ítems în Decamino:', rows.length);
  console.log('🔗 Conectare la HERA', configHera.host, configHera.database, '...');
  const connHera = await mysql.createConnection(configHera);

  const insertSql = `INSERT INTO informes_items (item_id, nombre, descripcion, precio, observaciones, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion), precio = VALUES(precio), observaciones = VALUES(observaciones), activo = VALUES(activo), updated_at = CURRENT_TIMESTAMP`;

  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    try {
      const [res] = await connHera.query(insertSql, [
        r.item_id ?? '',
        r.nombre ?? '',
        r.descripcion ?? null,
        r.precio ?? 0,
        r.observaciones ?? null,
        r.activo != null ? (r.activo ? 1 : 0) : 1,
      ]);
      if (res.affectedRows === 1) inserted++;
      else if (res.affectedRows === 2) updated++;
    } catch (e) {
      console.warn('⚠️', r.item_id, e.message);
    }
  }

  console.log('✅ Inserate în HERA:', inserted, '| Actualizate (după item_id):', updated);
  await connHera.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
