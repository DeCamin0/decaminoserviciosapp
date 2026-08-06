/**
 * Backfill PRL LONGBLOB → Cloudflare R2.
 *
 * Covers:
 *   - prl_document_templates.archivo → storage_key
 *   - prl_employee_documents.archivo_original → storage_key_original
 *   - prl_employee_documents.archivo_firmado → storage_key_firmado
 *
 * Usage (from backend/):
 *   node scripts/prl-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/prl-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/prl-r2-backfill.js .env.decamino.local --batch=20
 *   node scripts/prl-r2-backfill.js .env.decamino.local --keep-blob
 *   npm run storage:prl-backfill
 *   npm run storage:prl-backfill:both
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

function safeFileName(originalName, fallback = 'file') {
  const base = String(originalName || fallback).split(/[/\\]/).pop() || fallback;
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return cleaned || fallback;
}

function slugGrupo(grupoNombre) {
  const cleaned = String(grupoNombre || '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || 'grupo';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function sanitizeSegment(p) {
  return String(p)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '_');
}

/**
 * Matches PrlDocumentsStorageService + buildObjectKey (nested scope segments).
 */
function buildPrlKey(tenant, scopeId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || 'documento-prl';
  const safe = safeFileName(name);
  const scopeParts = String(scopeId || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(sanitizeSegment);
  return ['decamino', tenant, 'prl', ...scopeParts, yyyy, mm, `${id}__${safe}`]
    .map(sanitizeSegment)
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

async function putAndVerify(s3, bucket, key, buf, contentType, metadata) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );
  await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

async function backfillTemplates(conn, s3, bucket, tenant, flags, counters) {
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`prl_document_templates\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[prl-backfill] templates pending:', pending);
  if (pending === 0) return;

  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`id\`, \`grupo_nombre\`, \`nombre_archivo\`, \`created_at\`, \`archivo\`
       FROM \`prl_document_templates\`
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
        if (!buf || buf.length === 0) throw new Error('empty archivo buffer');
        const fileName = row.nombre_archivo || `template-${id}`;
        const key = buildPrlKey(
          tenant,
          `templates/${slugGrupo(row.grupo_nombre)}`,
          fileName,
          parseFecha(row.created_at),
        );
        const contentType = guessContentType(fileName);

        if (flags.dryRun) {
          console.log(
            `[dry-run] template id=${id} bytes=${buf.length} key=${key}`,
          );
          counters.migrated += 1;
          continue;
        }

        await putAndVerify(s3, bucket, key, buf, contentType, {
          module: 'prl',
          kind: 'template',
          backfill: '1',
          id: String(id),
        });

        if (flags.keepBlob) {
          await conn.query(
            `UPDATE \`prl_document_templates\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`prl_document_templates\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`archivo\` = NULL
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        counters.migrated += 1;
        if (counters.migrated % 10 === 0 || counters.migrated === 1) {
          console.log(
            `[prl-backfill] ok template id=${id} (${counters.migrated} migrated, ${counters.failed} failed)`,
          );
        }
      } catch (err) {
        counters.failed += 1;
        console.error(
          `[prl-backfill] FAIL template id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }
}

async function backfillEmployeeBlobs(
  conn,
  s3,
  bucket,
  tenant,
  flags,
  counters,
  kind,
) {
  const blobCol = kind === 'original' ? 'archivo_original' : 'archivo_firmado';
  const keyCol =
    kind === 'original' ? 'storage_key_original' : 'storage_key_firmado';
  const bucketCol =
    kind === 'original' ? 'storage_bucket_original' : 'storage_bucket_firmado';
  const tamanoCol =
    kind === 'original' ? 'tamano_bytes_original' : 'tamano_bytes_firmado';
  const nameCol =
    kind === 'original' ? 'nombre_archivo_original' : 'nombre_archivo_firmado';
  const scopeSuffix = kind === 'original' ? 'original' : 'firmado';

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`prl_employee_documents\`
     WHERE \`${blobCol}\` IS NOT NULL
       AND (\`${keyCol}\` IS NULL OR \`${keyCol}\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log(`[prl-backfill] employee ${kind} pending:`, pending);
  if (pending === 0) return;

  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`id\`, \`empleado_id\`, \`${nameCol}\` AS nombre_archivo,
              \`asignado_en\`, \`${blobCol}\` AS archivo
       FROM \`prl_employee_documents\`
       WHERE \`${blobCol}\` IS NOT NULL
         AND (\`${keyCol}\` IS NULL OR \`${keyCol}\` = '')
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
        if (!buf || buf.length === 0) throw new Error(`empty ${blobCol} buffer`);
        const emp = String(row.empleado_id || '').trim() || 'sin-codigo';
        const fileName = row.nombre_archivo || `prl-${kind}-${id}`;
        const key = buildPrlKey(
          tenant,
          `employees/${emp}/${scopeSuffix}`,
          fileName,
          parseFecha(row.asignado_en),
        );
        const contentType = guessContentType(fileName);

        if (flags.dryRun) {
          console.log(
            `[dry-run] emp-${kind} id=${id} bytes=${buf.length} key=${key}`,
          );
          counters.migrated += 1;
          continue;
        }

        await putAndVerify(s3, bucket, key, buf, contentType, {
          module: 'prl',
          kind,
          backfill: '1',
          id: String(id),
          empleado: emp,
        });

        if (flags.keepBlob) {
          await conn.query(
            `UPDATE \`prl_employee_documents\`
             SET \`${keyCol}\` = ?,
                 \`${bucketCol}\` = ?,
                 \`${tamanoCol}\` = ?
             WHERE \`id\` = ?
               AND (\`${keyCol}\` IS NULL OR \`${keyCol}\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`prl_employee_documents\`
             SET \`${keyCol}\` = ?,
                 \`${bucketCol}\` = ?,
                 \`${tamanoCol}\` = ?,
                 \`${blobCol}\` = NULL
             WHERE \`id\` = ?
               AND (\`${keyCol}\` IS NULL OR \`${keyCol}\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        counters.migrated += 1;
        if (counters.migrated % 10 === 0 || counters.migrated === 1) {
          console.log(
            `[prl-backfill] ok emp-${kind} id=${id} (${counters.migrated} migrated, ${counters.failed} failed)`,
          );
        }
      } catch (err) {
        counters.failed += 1;
        console.error(
          `[prl-backfill] FAIL emp-${kind} id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[prl-backfill] env file:', envRel);
  console.log('[prl-backfill] dry-run:', flags.dryRun);
  console.log('[prl-backfill] keep-blob:', flags.keepBlob);
  console.log('[prl-backfill] batch:', flags.batch);
  console.log('[prl-backfill] limit:', flags.limit ?? 'none');

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
    console.error('[prl-backfill] FAIL: R2_ENABLED is not true in', envRel);
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[prl-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
    console.error('[prl-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME');
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[prl-backfill] database:', dbConfig.database);
  console.log('[prl-backfill] tenant:', tenant);
  console.log('[prl-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);
  const counters = { migrated: 0, failed: 0 };

  await backfillTemplates(conn, s3, bucket, tenant, flags, counters);
  await backfillEmployeeBlobs(
    conn,
    s3,
    bucket,
    tenant,
    flags,
    counters,
    'original',
  );
  await backfillEmployeeBlobs(
    conn,
    s3,
    bucket,
    tenant,
    flags,
    counters,
    'firmado',
  );

  await conn.end();
  console.log('[prl-backfill] done');
  console.log('[prl-backfill] migrated:', counters.migrated);
  console.log('[prl-backfill] failed:', counters.failed);
  if (counters.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[prl-backfill] fatal:', err?.message || err);
  process.exit(1);
});
