/**
 * Backfill Comunicados LONGBLOB (archivo) → Cloudflare R2.
 *
 * Selects rows where archivo IS NOT NULL and storage_key IS NULL.
 * Puts file to R2, sets storage_key / storage_bucket / tamano_bytes, then clears archivo.
 *
 * Usage (from backend/):
 *   node scripts/comunicados-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/comunicados-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/comunicados-r2-backfill.js .env.decamino.local --batch=20
 *   node scripts/comunicados-r2-backfill.js .env.decamino.local --keep-blob
 *   npm run storage:comunicados-backfill
 *   npm run storage:comunicados-backfill:both
 *
 * Requires R2_ENABLED=true and R2_* credentials. Never prints secrets.
 */
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const mysql = require('mysql2/promise');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const backendDir = path.join(__dirname, '..');

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function parseArgs(argv) {
  const positional = [];
  const flags = {
    dryRun: false,
    keepBlob: false,
    limit: null,
    batch: 25,
  };
  for (const a of argv) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--keep-blob') flags.keepBlob = true;
    else if (a.startsWith('--limit=')) {
      flags.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 0);
    } else if (a.startsWith('--batch=')) {
      flags.batch = Math.max(1, parseInt(a.slice('--batch='.length), 10) || 25);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
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
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
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

function safeFileName(originalName, fallback = 'comunicado') {
  const base =
    String(originalName || fallback).split(/[/\\]/).pop() || fallback;
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return cleaned || fallback;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function guessContentType(originalName, buf) {
  if (buf && buf.length >= 5) {
    const ascii = buf.slice(0, 5).toString('ascii');
    const hex = buf.slice(0, 4).toString('hex');
    if (ascii.startsWith('%PDF-')) return 'application/pdf';
    if (hex.startsWith('89504e47')) return 'image/png';
    if (hex.startsWith('ffd8ff')) return 'image/jpeg';
    if (hex.startsWith('47494638')) return 'image/gif';
  }
  const ext = String(originalName || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream';
}

function buildComunicadoKey(tenant, comunicadoId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || `comunicado-${comunicadoId}`;
  const safe = safeFileName(name);
  let safeName = safe;
  let ext = '';
  const dot = safe.lastIndexOf('.');
  if (dot > 0) {
    safeName = safe.slice(0, dot);
    ext = safe.slice(dot + 1).toLowerCase();
  }
  const filePart = ext ? `${id}__${safeName}.${ext}` : `${id}__${safeName}`;
  const scope = String(comunicadoId || '').trim() || 'sin-id';
  return [
    'decamino',
    tenant,
    'comunicados',
    scope,
    yyyy,
    mm,
    filePart,
  ]
    .map((p) =>
      String(p)
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '_'),
    )
    .join('/');
}

function toBuffer(archivo) {
  if (archivo == null) return null;
  if (Buffer.isBuffer(archivo)) return archivo;
  if (archivo instanceof Uint8Array) return Buffer.from(archivo);
  if (typeof archivo === 'string') return Buffer.from(archivo, 'base64');
  return null;
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[comunicados-backfill] env file:', envRel);
  console.log('[comunicados-backfill] dry-run:', flags.dryRun);
  console.log('[comunicados-backfill] keep-blob:', flags.keepBlob);
  console.log('[comunicados-backfill] batch:', flags.batch);
  console.log('[comunicados-backfill] limit:', flags.limit ?? 'none');

  const fileEnv = parseEnvFile(envFile);
  const env = { ...fileEnv, ...process.env };

  const enabled = String(env.R2_ENABLED || '').toLowerCase() === 'true';
  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (env.R2_BUCKET || '').trim() || 'dc-files-prod';
  const endpoint =
    (env.R2_ENDPOINT || '').trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const region = (env.R2_REGION || '').trim() || 'auto';

  if (!enabled) {
    console.error(
      '[comunicados-backfill] FAIL: R2_ENABLED is not true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[comunicados-backfill] FAIL: missing R2 credentials / endpoint / bucket',
    );
    process.exit(1);
  }

  const dbConfig = {
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
  if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
    console.error(
      '[comunicados-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[comunicados-backfill] database:', dbConfig.database);
  console.log('[comunicados-backfill] tenant:', tenant);
  console.log('[comunicados-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`comunicados\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[comunicados-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[comunicados-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`id\`, \`nombre_archivo\`, \`created_at\`, \`archivo\`
       FROM \`comunicados\`
       WHERE \`archivo\` IS NOT NULL
         AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
       ORDER BY \`id\` ASC
       LIMIT ?`,
      [take],
    );

    if (!rows.length) break;

    for (const row of rows) {
      const id = Number(row.id);
      processed += 1;
      try {
        const buf = toBuffer(row.archivo);
        if (!buf || buf.length === 0) {
          throw new Error('empty archivo buffer');
        }
        const at = row.created_at ? new Date(row.created_at) : new Date();
        const originalName =
          row.nombre_archivo || `comunicado-${id}.bin`;
        const key = buildComunicadoKey(tenant, id, originalName, at);
        const contentType = guessContentType(originalName, buf);

        if (flags.dryRun) {
          console.log(
            `[dry-run] id=${id} bytes=${buf.length} contentType=${contentType} key=${key}`,
          );
          migrated += 1;
          continue;
        }

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buf,
            ContentType: contentType,
            Metadata: {
              module: 'comunicados',
              backfill: '1',
              comunicado_id: String(id),
            },
          }),
        );

        await s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        if (flags.keepBlob) {
          await conn.query(
            `UPDATE \`comunicados\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`comunicados\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`archivo\` = NULL
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        migrated += 1;
        if (migrated % 10 === 0 || migrated === 1) {
          console.log(
            `[comunicados-backfill] ok id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[comunicados-backfill] FAIL id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }

  await conn.end();
  console.log('[comunicados-backfill] done');
  console.log('[comunicados-backfill] migrated:', migrated);
  console.log('[comunicados-backfill] failed:', failed);
  console.log('[comunicados-backfill] processed:', processed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[comunicados-backfill] fatal:', err?.message || err);
  process.exit(1);
});
