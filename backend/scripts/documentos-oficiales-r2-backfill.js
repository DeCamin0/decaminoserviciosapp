/**
 * Backfill DocumentosOficiales LONGBLOB (archivo) → Cloudflare R2.
 *
 * Usage (from backend/):
 *   node scripts/documentos-oficiales-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/documentos-oficiales-r2-backfill.js .env.decamino.local --limit=50
 *   npm run storage:documentos-oficiales-backfill
 *   npm run storage:documentos-oficiales-backfill:both
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

function safeFileName(originalName, fallback = 'documento-oficial') {
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

function parseFechaCreacion(raw) {
  if (!raw) return new Date();
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return new Date();
}

function buildDocsOficialesKey(tenant, empleadoId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || 'documento-oficial';
  const safe = safeFileName(name);
  const scope = String(empleadoId || '').trim() || 'sin-codigo';
  return [
    'decamino',
    tenant,
    'docs-oficiales',
    scope,
    yyyy,
    mm,
    `${id}__${safe}`,
  ]
    .map((p) =>
      String(p)
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '_'),
    )
    .join('/');
}

function guessContentType(name) {
  const ext = String(name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream';
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
  console.log('[documentos-oficiales-backfill] env file:', envRel);
  console.log('[documentos-oficiales-backfill] dry-run:', flags.dryRun);
  console.log('[documentos-oficiales-backfill] keep-blob:', flags.keepBlob);
  console.log('[documentos-oficiales-backfill] batch:', flags.batch);
  console.log('[documentos-oficiales-backfill] limit:', flags.limit ?? 'none');

  const fileEnv = parseEnvFile(path.resolve(backendDir, envRel));
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
      '[documentos-oficiales-backfill] FAIL: R2_ENABLED is not true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[documentos-oficiales-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
      '[documentos-oficiales-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[documentos-oficiales-backfill] database:', dbConfig.database);
  console.log('[documentos-oficiales-backfill] tenant:', tenant);
  console.log('[documentos-oficiales-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`DocumentosOficiales\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[documentos-oficiales-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[documentos-oficiales-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`doc_id\`, \`nombre_archivo\`, \`id\` AS empleado_id, \`fecha_creacion\`, \`archivo\`
       FROM \`DocumentosOficiales\`
       WHERE \`archivo\` IS NOT NULL
         AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
       ORDER BY \`doc_id\` ASC
       LIMIT ?`,
      [take],
    );

    if (!rows.length) break;

    for (const row of rows) {
      const id = Number(row.doc_id);
      processed += 1;
      try {
        const buf = toBuffer(row.archivo);
        if (!buf || buf.length === 0) {
          throw new Error('empty archivo buffer');
        }
        const at = parseFechaCreacion(row.fecha_creacion);
        const fileName = row.nombre_archivo || `documento-oficial-${id}`;
        const key = buildDocsOficialesKey(tenant, row.empleado_id, fileName, at);
        const contentType = guessContentType(fileName);

        if (flags.dryRun) {
          console.log(`[dry-run] doc_id=${id} bytes=${buf.length} key=${key}`);
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
              module: 'docs-oficiales',
              backfill: '1',
              doc_id: String(id),
              empleado: String(row.empleado_id || ''),
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
            `UPDATE \`DocumentosOficiales\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`doc_id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`DocumentosOficiales\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`archivo\` = NULL
             WHERE \`doc_id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        migrated += 1;
        if (migrated % 10 === 0 || migrated === 1) {
          console.log(
            `[documentos-oficiales-backfill] ok doc_id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[documentos-oficiales-backfill] FAIL doc_id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }

  await conn.end();
  console.log('[documentos-oficiales-backfill] done');
  console.log('[documentos-oficiales-backfill] migrated:', migrated);
  console.log('[documentos-oficiales-backfill] failed:', failed);
  console.log('[documentos-oficiales-backfill] processed:', processed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[documentos-oficiales-backfill] fatal:', err?.message || err);
  process.exit(1);
});
