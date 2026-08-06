/**
 * Backfill firma_imagen_base64 (LongText) → R2 PNG for presupuestos_firmas + informes_firmas.
 *
 * Usage:
 *   node scripts/firmas-imagen-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/firmas-imagen-r2-backfill.js .env.decamino.local
 *   npm run storage:firmas-imagen-backfill:both
 */
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const mysql = require('mysql2/promise');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function parseArgs(argv) {
  const positional = [];
  const flags = { dryRun: false, keepBlob: false, limit: null, batch: 25 };
  for (const a of argv) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--keep-blob') flags.keepBlob = true;
    else if (a.startsWith('--limit='))
      flags.limit = Math.max(1, parseInt(a.slice(8), 10) || 0);
    else if (a.startsWith('--batch='))
      flags.batch = Math.max(1, parseInt(a.slice(8), 10) || 25);
    else if (!a.startsWith('-')) positional.push(a);
  }
  return {
    envRel: positional[0] || process.env.ENV_FILE || '.env.decamino.local',
    flags,
  };
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

function tenantSlug(dbName) {
  const db = String(dbName || '')
    .trim()
    .toLowerCase();
  if (db === 'hera_facility_db' || db.includes('hera')) return 'hera';
  if (db === 'decamino_db' || db.includes('decamino')) return 'decamino';
  if (db.startsWith('tenant_')) return db.replace(/^tenant_/, '') || 'tenant';
  return 'decamino';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildKey(tenant, domain, scopeId) {
  const d = new Date();
  return [
    'decamino',
    tenant,
    domain,
    String(scopeId || '').trim() || 'sin-id',
    String(d.getUTCFullYear()),
    pad2(d.getUTCMonth() + 1),
    `${randomUUID()}__firma-cliente.png`,
  ].join('/');
}

function parseBase64(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
  if (!s) return null;
  try {
    const buf = Buffer.from(s, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function backfillTable(connection, s3, bucket, tenant, flags, table, domain, scopeCol) {
  const [pending] = await connection.query(
    `SELECT COUNT(*) AS c FROM \`${table}\`
     WHERE (firma_imagen_storage_key IS NULL OR firma_imagen_storage_key = '')
       AND firma_imagen_base64 IS NOT NULL
       AND LENGTH(firma_imagen_base64) > 32`,
  );
  let remaining = Number(pending[0]?.c || 0);
  if (flags.limit != null) remaining = Math.min(remaining, flags.limit);
  console.log(`[${table}] pending: ${remaining}`);
  if (remaining === 0) return { migrated: 0, failed: 0 };

  let migrated = 0;
  let failed = 0;
  let processed = 0;

  while (processed < remaining) {
    const take = Math.min(flags.batch, remaining - processed);
    const [rows] = await connection.query(
      `SELECT id, \`${scopeCol}\` AS scope_id, firma_imagen_base64
       FROM \`${table}\`
       WHERE (firma_imagen_storage_key IS NULL OR firma_imagen_storage_key = '')
         AND firma_imagen_base64 IS NOT NULL
         AND LENGTH(firma_imagen_base64) > 32
       ORDER BY id ASC
       LIMIT ${take}`,
    );
    if (!rows.length) break;

    for (const row of rows) {
      processed += 1;
      const buf = parseBase64(row.firma_imagen_base64);
      if (!buf) {
        failed += 1;
        console.warn(`[${table}] skip id=${row.id}: invalid base64`);
        continue;
      }
      const key = buildKey(tenant, domain, row.scope_id);
      if (flags.dryRun) {
        migrated += 1;
        console.log(`[${table}] dry-run id=${row.id} → ${key} (${buf.length}b)`);
        continue;
      }
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buf,
            ContentType: 'image/png',
          }),
        );
        if (flags.keepBlob) {
          await connection.query(
            `UPDATE \`${table}\` SET firma_imagen_storage_key = ? WHERE id = ?`,
            [key, row.id],
          );
        } else {
          await connection.query(
            `UPDATE \`${table}\`
             SET firma_imagen_storage_key = ?, firma_imagen_base64 = NULL
             WHERE id = ?`,
            [key, row.id],
          );
        }
        migrated += 1;
        console.log(`[${table}] ok id=${row.id} (${migrated} migrated, ${failed} failed)`);
      } catch (err) {
        failed += 1;
        console.error(`[${table}] fail id=${row.id}:`, err.message || err);
      }
    }
  }
  return { migrated, failed };
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(__dirname, '..', envRel);
  const env = { ...parseEnvFile(envFile), ...process.env };
  console.log('[firmas-imagen-backfill] env:', envRel, 'dry-run:', flags.dryRun);

  if (String(env.R2_ENABLED || '').toLowerCase() !== 'true') {
    throw new Error('R2_ENABLED is not true');
  }
  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (env.R2_BUCKET || '').trim() || 'dc-files-prod';
  const endpoint =
    (env.R2_ENDPOINT || '').trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Missing R2 credentials / endpoint');
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const tenant = tenantSlug(env.DB_NAME);
  console.log('[firmas-imagen-backfill] db:', env.DB_NAME, 'tenant:', tenant);

  const s3 = new S3Client({
    region: (env.R2_REGION || '').trim() || 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const a = await backfillTable(
    connection,
    s3,
    bucket,
    tenant,
    flags,
    'presupuestos_firmas',
    'presupuestos-firmas',
    'presupuesto_id',
  );
  const b = await backfillTable(
    connection,
    s3,
    bucket,
    tenant,
    flags,
    'informes_firmas',
    'informes-firmas',
    'informe_id',
  );
  await connection.end();
  console.log('[firmas-imagen-backfill] done', {
    presupuestos: a,
    informes: b,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
