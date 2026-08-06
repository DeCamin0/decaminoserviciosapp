/**
 * Backfill portal MVP LONGBLOB → Cloudflare R2.
 * Tables: portal_documentos_generales, cliente_facturas_manuales, cliente_inspeccion_documentos
 *
 * Usage (from backend/):
 *   node scripts/portal-docs-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/portal-docs-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/portal-docs-r2-backfill.js .env.decamino.local --batch=20
 *   node scripts/portal-docs-r2-backfill.js .env.decamino.local --keep-blob
 *   npm run storage:portal-docs-backfill:both
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

const TABLE_SPECS = [
  {
    name: 'portal_documentos_generales',
    kind: 'general',
    selectExtra: '`nombre_documento`, `fecha_subida`',
  },
  {
    name: 'cliente_facturas_manuales',
    kind: 'factura',
    selectExtra: '`cliente_id`, `nombre_archivo`, `created_at`',
  },
  {
    name: 'cliente_inspeccion_documentos',
    kind: 'inspeccion',
    selectExtra: '`cliente_id`, `nombre_archivo`, `created_at`',
  },
];

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

function safeFileName(originalName, fallback = 'documento') {
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

function sanitizeSegment(s) {
  return String(s || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '_');
}

function buildPortalKey(tenant, scopeId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || 'documento.pdf';
  const safe = safeFileName(name);
  const scopeParts = String(scopeId || 'general')
    .split('/')
    .map(sanitizeSegment)
    .filter(Boolean);
  return [
    'decamino',
    tenant,
    'portal',
    ...scopeParts,
    yyyy,
    mm,
    `${id}__${safe}`,
  ]
    .map(sanitizeSegment)
    .join('/');
}

function toBuffer(archivo) {
  if (archivo == null) return null;
  if (Buffer.isBuffer(archivo)) return archivo;
  if (archivo instanceof Uint8Array) return Buffer.from(archivo);
  if (typeof archivo === 'string') return Buffer.from(archivo, 'base64');
  return null;
}

function rowMeta(spec, row) {
  if (spec.kind === 'general') {
    return {
      scopeId: 'general',
      originalName: row.nombre_documento || `documento-${row.id}.pdf`,
      at: row.fecha_subida ? new Date(row.fecha_subida) : new Date(),
      module: 'portal-general',
      meta: { doc_id: String(row.id) },
    };
  }
  if (spec.kind === 'factura') {
    return {
      scopeId: `facturas/cli_${row.cliente_id}`,
      originalName: row.nombre_archivo || `factura-${row.id}.pdf`,
      at: row.created_at ? new Date(row.created_at) : new Date(),
      module: 'portal-facturas',
      meta: {
        factura_id: String(row.id),
        cliente_id: String(row.cliente_id || ''),
      },
    };
  }
  return {
    scopeId: `inspecciones/cli_${row.cliente_id}`,
    originalName: row.nombre_archivo || `inspeccion-${row.id}.pdf`,
    at: row.created_at ? new Date(row.created_at) : new Date(),
    module: 'portal-inspecciones',
    meta: {
      inspeccion_id: String(row.id),
      cliente_id: String(row.cliente_id || ''),
    },
  };
}

async function backfillTable(conn, s3, bucket, tenant, spec, flags) {
  console.log(`\n[${spec.name}]`);
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`${spec.name}\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('pending rows:', pending);
  if (pending === 0) {
    console.log('nothing to do');
    return { migrated: 0, failed: 0, processed: 0 };
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;
  const dryRunSeenIds = new Set();

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    let rows;
    if (flags.dryRun && dryRunSeenIds.size > 0) {
      const ids = [...dryRunSeenIds];
      const placeholders = ids.map(() => '?').join(',');
      [rows] = await conn.query(
        `SELECT \`id\`, \`mime_type\`, \`archivo\`, ${spec.selectExtra}
         FROM \`${spec.name}\`
         WHERE \`archivo\` IS NOT NULL
           AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
           AND \`id\` NOT IN (${placeholders})
         ORDER BY \`id\` ASC
         LIMIT ?`,
        [...ids, take],
      );
    } else {
      [rows] = await conn.query(
        `SELECT \`id\`, \`mime_type\`, \`archivo\`, ${spec.selectExtra}
         FROM \`${spec.name}\`
         WHERE \`archivo\` IS NOT NULL
           AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
         ORDER BY \`id\` ASC
         LIMIT ?`,
        [take],
      );
    }

    if (!rows.length) break;

    for (const row of rows) {
      const id = Number(row.id);
      processed += 1;
      try {
        const buf = toBuffer(row.archivo);
        if (!buf || buf.length === 0) throw new Error('empty archivo buffer');
        const meta = rowMeta(spec, row);
        const key = buildPortalKey(
          tenant,
          meta.scopeId,
          meta.originalName,
          meta.at,
        );
        const contentType =
          (row.mime_type && String(row.mime_type).trim()) || 'application/pdf';

        if (flags.dryRun) {
          dryRunSeenIds.add(id);
          console.log(
            `[dry-run] id=${id} bytes=${buf.length} key=${key}`,
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
              module: meta.module,
              backfill: '1',
              ...meta.meta,
            },
          }),
        );
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

        if (flags.keepBlob) {
          await conn.query(
            `UPDATE \`${spec.name}\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`${spec.name}\`
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
            `ok id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(`FAIL id=${id}:`, err?.message || err);
      }
    }

    if (rows.length < take) break;
  }

  console.log('done migrated:', migrated, 'failed:', failed);
  return { migrated, failed, processed };
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[portal-docs-backfill] env file:', envRel);
  console.log('[portal-docs-backfill] dry-run:', flags.dryRun);
  console.log('[portal-docs-backfill] keep-blob:', flags.keepBlob);

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
    console.error('[portal-docs-backfill] FAIL: R2_ENABLED is not true');
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error('[portal-docs-backfill] FAIL: missing R2 credentials');
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
    console.error('[portal-docs-backfill] FAIL: missing DB_*');
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[portal-docs-backfill] database:', dbConfig.database);
  console.log('[portal-docs-backfill] tenant:', tenant);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);
  let totalFailed = 0;

  for (const spec of TABLE_SPECS) {
    const r = await backfillTable(conn, s3, bucket, tenant, spec, flags);
    totalFailed += r.failed;
  }

  await conn.end();
  console.log('\n[portal-docs-backfill] all tables done');
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[portal-docs-backfill] fatal:', err?.message || err);
  process.exit(1);
});
