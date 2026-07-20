/**
 * Backfill DURACION pe Fichaje (perechi Entrada → Salida).
 * Implicit HERA (.env.client2.local sau .env.client2).
 *
 * Rulare pe VPS / local:
 *   node scripts/backfill-fichaje-duracion.js
 *   ENV_FILE=.env.client2 node scripts/backfill-fichaje-duracion.js
 *   node scripts/backfill-fichaje-duracion.js --dry-run
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const backendDir = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function loadEnv(envFile) {
  const envPath = path.join(backendDir, envFile);
  if (!fs.existsSync(envPath)) return null;
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
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
  return env;
}

function normalizeFecha(fecha) {
  if (!fecha) return '';
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(fecha).trim();
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

function normalizeHora(hora) {
  if (hora == null || hora === '') return '00:00:00';
  if (hora instanceof Date && !Number.isNaN(hora.getTime())) {
    return `${String(hora.getHours()).padStart(2, '0')}:${String(hora.getMinutes()).padStart(2, '0')}:${String(hora.getSeconds()).padStart(2, '0')}`;
  }
  const s = String(hora).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '00:00:00';
  return `${m[1].padStart(2, '0')}:${m[2]}:${(m[3] || '00').padStart(2, '0')}`;
}

function formatDurationHms(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function isEntradaTipo(tipo) {
  return String(tipo || '').trim() === 'Entrada';
}

function isSalidaTipo(tipo) {
  const t = String(tipo || '').trim();
  return t === 'Salida' || t.startsWith('Salida');
}

async function recalculateForCodigo(conn, codigo) {
  const [rows] = await conn.query(
    `SELECT ID, TIPO, FECHA, HORA, DURACION
     FROM Fichaje
     WHERE CODIGO = ?
     ORDER BY FECHA ASC, HORA ASC, ID ASC`,
    [codigo],
  );

  let openEntrada = null;
  const planned = new Map();

  for (const row of rows) {
    const id = String(row.ID);
    const tipo = String(row.TIPO || '').trim();
    const fecha = normalizeFecha(row.FECHA);
    const hora = normalizeHora(row.HORA);

    if (isEntradaTipo(tipo)) {
      openEntrada = { id, fecha, hora };
      planned.set(id, null);
      continue;
    }

    if (isSalidaTipo(tipo)) {
      if (openEntrada) {
        const start = new Date(`${openEntrada.fecha}T${openEntrada.hora}`);
        const end = new Date(`${fecha}T${hora}`);
        const ms = end.getTime() - start.getTime();
        planned.set(
          id,
          Number.isFinite(ms) && ms >= 0 ? formatDurationHms(ms / 1000) : null,
        );
        openEntrada = null;
      } else {
        planned.set(id, null);
      }
    }
  }

  let updated = 0;
  for (const row of rows) {
    const id = String(row.ID);
    if (!planned.has(id)) continue;
    const nextDuracion = planned.get(id);
    const prev = row.DURACION == null ? null : String(row.DURACION).trim();
    const prevNorm = !prev || prev === '' ? null : prev;
    if (prevNorm === nextDuracion) continue;

    if (!dryRun) {
      await conn.query('UPDATE Fichaje SET DURACION = ? WHERE ID = ?', [
        nextDuracion,
        id,
      ]);
    }
    updated += 1;
  }

  return updated;
}

async function main() {
  const envFile =
    process.env.ENV_FILE ||
    (fs.existsSync(path.join(backendDir, '.env.client2.local'))
      ? '.env.client2.local'
      : '.env.client2');

  const env = loadEnv(envFile);
  if (!env) {
    console.error('❌ Nu găsesc', envFile);
    process.exit(1);
  }

  console.log('📦 ENV_FILE:', envFile, '| DB_NAME:', env.DB_NAME);
  if (dryRun) console.log('🔎 DRY-RUN — nu se scriu modificări');

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    charset: 'utf8mb4',
  });

  const [codigos] = await conn.query(
    `SELECT DISTINCT CODIGO FROM Fichaje
     WHERE CODIGO IS NOT NULL AND TRIM(CODIGO) <> ''
     ORDER BY CODIGO`,
  );

  let updatedTotal = 0;
  for (const row of codigos) {
    const codigo = String(row.CODIGO);
    const n = await recalculateForCodigo(conn, codigo);
    if (n > 0) {
      console.log(`  CODIGO ${codigo}: ${n} registre ${dryRun ? '(dry-run)' : 'actualizate'}`);
    }
    updatedTotal += n;
  }

  console.log(
    `✅ Gata. Angajați: ${codigos.length}. Registre ${dryRun ? 'de actualizat' : 'actualizate'}: ${updatedTotal}`,
  );
  await conn.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
