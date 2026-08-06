/**
 * Backfill pedidos_notas_imagen disk files → Cloudflare R2.
 *
 * Reads rows where ruta_archivo is set and storage_key IS NULL,
 * uploads file from uploads/pedidos-notas/, sets storage_key / storage_bucket / tamano_bytes.
 * By default keeps ruta_archivo (dual-read). Use --clear-ruta after verify, or run stop-disk script.
 *
 * Usage (from backend/):
 *   node scripts/pedidos-notas-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/pedidos-notas-r2-backfill.js .env.decamino.local --limit=50
 *   npm run storage:pedidos-notas-backfill
 *   npm run storage:pedidos-notas-backfill:both
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
const uploadsDir = path.join(backendDir, 'uploads', 'pedidos-notas');

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

function parseArgs(argv) {
  const positional = [];
  const flags = {
    dryRun: false,
    clearRuta: false,
    limit: null,
    batch: 25,
  };
  for (const a of argv) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--clear-ruta') flags.clearRuta = true;
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

function safeFileName(originalName, fallback = 'imagen') {
  const base = String(originalName || fallback).split(/[/\\]/).pop() || fallback;
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

function parseFecha(raw) {
  if (!raw) return new Date();
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return new Date();
}

function buildPedidosNotasKey(tenant, notaId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || 'imagen';
  const safe = safeFileName(name);
  const scope = String(notaId || '').trim() || 'sin-nota';
  let safeName = safe;
  let ext = '';
  const dot = safe.lastIndexOf('.');
  if (dot > 0) {
    safeName = safe.slice(0, dot);
    ext = safe.slice(dot + 1).toLowerCase();
  }
  const filePart = ext ? `${id}__${safeName}.${ext}` : `${id}__${safeName}`;
  return ['decamino', tenant, 'pedidos-notas', scope, yyyy, mm, filePart]
    .map((p) =>
      String(p)
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '_'),
    )
    .join('/');
}

function guessContentType(name, mimeHint) {
  if (mimeHint && String(mimeHint).trim()) return String(mimeHint).trim();
  const ext = String(name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream';
}

function resolveDiskPath(rutaArchivo) {
  const ruta = String(rutaArchivo || '').trim();
  if (!ruta) return null;
  const fileName = path.basename(ruta);
  if (!fileName || fileName === '.' || fileName === '..') return null;
  return path.join(uploadsDir, fileName);
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[pedidos-notas-backfill] env file:', envRel);
  console.log('[pedidos-notas-backfill] dry-run:', flags.dryRun);
  console.log('[pedidos-notas-backfill] clear-ruta:', flags.clearRuta);
  console.log('[pedidos-notas-backfill] batch:', flags.batch);
  console.log('[pedidos-notas-backfill] limit:', flags.limit ?? 'none');
  console.log('[pedidos-notas-backfill] uploads dir:', uploadsDir);

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
      '[pedidos-notas-backfill] FAIL: R2_ENABLED is not true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[pedidos-notas-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
      '[pedidos-notas-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[pedidos-notas-backfill] database:', dbConfig.database);
  console.log('[pedidos-notas-backfill] tenant:', tenant);
  console.log('[pedidos-notas-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`pedidos_notas_imagen\`
     WHERE \`ruta_archivo\` IS NOT NULL
       AND \`ruta_archivo\` <> ''
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[pedidos-notas-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[pedidos-notas-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let missing = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`id\`, \`nota_id\`, \`nombre_archivo\`, \`ruta_archivo\`,
              \`tipo_mime\`, \`tamano_bytes\`, \`creado_en\`
       FROM \`pedidos_notas_imagen\`
       WHERE \`ruta_archivo\` IS NOT NULL
         AND \`ruta_archivo\` <> ''
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
        const diskPath = resolveDiskPath(row.ruta_archivo);
        if (!diskPath || !fs.existsSync(diskPath)) {
          missing += 1;
          console.warn(
            `[missing] id=${id} ruta=${row.ruta_archivo} path=${diskPath}`,
          );
          continue;
        }

        const buf = fs.readFileSync(diskPath);
        if (!buf || buf.length === 0) {
          throw new Error('empty file on disk');
        }

        const at = parseFecha(row.creado_en);
        const fileName = row.nombre_archivo || path.basename(diskPath);
        const key = buildPedidosNotasKey(tenant, row.nota_id, fileName, at);
        const contentType = guessContentType(fileName, row.tipo_mime);

        if (flags.dryRun) {
          console.log(
            `[dry-run] id=${id} nota=${row.nota_id} bytes=${buf.length} key=${key}`,
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
              module: 'pedidos-notas',
              backfill: '1',
              imagen_id: String(id),
              nota_id: String(row.nota_id || ''),
            },
          }),
        );

        await s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        if (flags.clearRuta) {
          await conn.query(
            `UPDATE \`pedidos_notas_imagen\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`ruta_archivo\` = NULL
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`pedidos_notas_imagen\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        migrated += 1;
        console.log(`[ok] id=${id} bytes=${buf.length} key=${key}`);
      } catch (err) {
        failed += 1;
        console.error(`[fail] id=${id}:`, (err && err.message) || err);
      }
    }
  }

  await conn.end();
  console.log(
    `[pedidos-notas-backfill] done migrated=${migrated} missing=${missing} failed=${failed} processed=${processed}`,
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
