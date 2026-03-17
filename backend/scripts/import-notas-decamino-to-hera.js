/**
 * Copiază pedidos_notas și pedidos_notas_imagen din Decamino în HERA.
 *
 * Sursă: .env (Decamino)
 * Destinație: .env.client2.local (HERA)
 *
 * Rulare: node scripts/import-notas-decamino-to-hera.js
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

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v.toISOString) return v.toISOString().slice(0, 19).replace('T', ' ');
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 19).replace('T', ' ');
  return s;
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

  const configDecamino = {
    host: envDecamino.DB_HOST,
    port: parseInt(envDecamino.DB_PORT || '3306', 10),
    user: envDecamino.DB_USERNAME,
    password: envDecamino.DB_PASSWORD || '',
    database: envDecamino.DB_NAME || 'decaminoservicios',
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

  const [notasRows] = await connDecamino.query(
    'SELECT id, titulo, contenido, creado_por, creado_en, actualizado_en, activo FROM pedidos_notas ORDER BY id'
  );
  await connDecamino.end();

  if (!notasRows || notasRows.length === 0) {
    console.log('⚠️ Niciună notă în Decamino (pedidos_notas).');
    return;
  }

  console.log('📝 Note în Decamino:', notasRows.length);

  console.log('🔗 Conectare la HERA', configHera.host, '...');
  const connHera = await mysql.createConnection(configHera);

  const idMap = {}; // old id -> new id
  let insertedNotas = 0;

  for (const r of notasRows) {
    const [result] = await connHera.query(
      `INSERT INTO pedidos_notas (titulo, contenido, creado_por, creado_en, actualizado_en, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        r.titulo ?? null,
        r.contenido ?? '',
        r.creado_por ?? null,
        toDate(r.creado_en) || r.creado_en,
        toDate(r.actualizado_en) || r.actualizado_en,
        r.activo ? 1 : 0,
      ]
    );
    const newId = result.insertId;
    idMap[r.id] = newId;
    insertedNotas++;
  }

  console.log('✅ Note inserate în HERA:', insertedNotas);

  // Imagini: le citim din Decamino și le inserăm în HERA cu noul nota_id
  const connDecamino2 = await mysql.createConnection(configDecamino);
  const [imgRows] = await connDecamino2.query(
    'SELECT nota_id, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes, orden, creado_en FROM pedidos_notas_imagen ORDER BY id'
  );
  await connDecamino2.end();

  let insertedImgs = 0;
  for (const row of imgRows) {
    const newNotaId = idMap[row.nota_id];
    if (newNotaId == null) continue;
    await connHera.query(
      `INSERT INTO pedidos_notas_imagen (nota_id, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes, orden, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newNotaId,
        row.nombre_archivo ?? '',
        row.ruta_archivo ?? '',
        row.tipo_mime ?? null,
        row.tamano_bytes ?? null,
        row.orden ?? 0,
        toDate(row.creado_en) || row.creado_en,
      ]
    );
    insertedImgs++;
  }

  console.log('✅ Imagini note inserate în HERA:', insertedImgs);
  await connHera.end();
  console.log('✅ Gata.');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
