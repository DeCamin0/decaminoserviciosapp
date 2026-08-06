/**
 * Backfill informes_firmas PDF (disk pdf_path) → Cloudflare R2.
 *
 * Selects rows where storage_key IS NULL and pdf_path IS NOT NULL.
 * Reads file from disk, puts to R2, sets storage metadata,
 * then clears pdf_path (unless --keep-path).
 *
 * Usage (from backend/):
 *   node scripts/informes-firmas-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/informes-firmas-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/informes-firmas-r2-backfill.js .env.decamino.local --keep-path
 *   npm run storage:informes-firmas-backfill
 *   npm run storage:informes-firmas-backfill:both
 *
 * Requires R2_ENABLED=true and R2_* credentials. Never prints secrets.
 * Does NOT migrate firma_imagen_base64.
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

function parseArgs(argv) {
  const positional = [];
  const flags = {
    dryRun: false,
    keepPath: false,
    limit: null,
    batch: 25,
  };
  for (const a of argv) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--keep-path') flags.keepPath = true;
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

function safeFileName(originalName, fallback = 'informe-firmado') {
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

function buildFirmaKey(tenant, informeId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  let name = originalName || 'informe-firmado.pdf';
  if (!String(name).toLowerCase().endsWith('.pdf')) name = `${name}.pdf`;
  const safe = safeFileName(name);
  const scope = String(informeId || '').trim() || 'sin-id';
  return [
    'decamino',
    tenant,
    'informes-firmas',
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

function readDiskPdf(pdfPath) {
  const rel = pdfPath ? String(pdfPath).trim() : '';
  if (!rel) return null;
  const absolute = path.isAbsolute(rel) ? rel : path.join(backendDir, rel);
  if (!fs.existsSync(absolute)) return null;
  try {
    const buf = fs.readFileSync(absolute);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[informes-firmas-backfill] env file:', envRel);
  console.log('[informes-firmas-backfill] dry-run:', flags.dryRun);
  console.log('[informes-firmas-backfill] keep-path:', flags.keepPath);
  console.log('[informes-firmas-backfill] batch:', flags.batch);
  console.log('[informes-firmas-backfill] limit:', flags.limit ?? 'none');

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
      '[informes-firmas-backfill] FAIL: R2_ENABLED is not true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[informes-firmas-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
      '[informes-firmas-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[informes-firmas-backfill] database:', dbConfig.database);
  console.log('[informes-firmas-backfill] tenant:', tenant);
  console.log('[informes-firmas-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`informes_firmas\`
     WHERE (\`storage_key\` IS NULL OR \`storage_key\` = '')
       AND \`pdf_path\` IS NOT NULL
       AND \`pdf_path\` <> ''`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[informes-firmas-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[informes-firmas-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    const [rows] = await conn.query(
      `SELECT \`id\`, \`informe_id\`, \`pdf_path\`, \`created_at\`
       FROM \`informes_firmas\`
       WHERE (\`storage_key\` IS NULL OR \`storage_key\` = '')
         AND \`pdf_path\` IS NOT NULL
         AND \`pdf_path\` <> ''
       ORDER BY \`id\` ASC
       LIMIT ?`,
      [take],
    );

    if (!rows.length) break;

    for (const row of rows) {
      const id = Number(row.id);
      processed += 1;
      try {
        const buf = readDiskPdf(row.pdf_path);
        if (!buf || buf.length === 0) {
          throw new Error(`disk file missing or empty: ${row.pdf_path}`);
        }

        const at = row.created_at ? new Date(row.created_at) : new Date();
        const diskName = path.basename(String(row.pdf_path));
        const key = buildFirmaKey(tenant, row.informe_id, diskName, at);

        if (flags.dryRun) {
          console.log(
            `[dry-run] id=${id} informe=${row.informe_id} bytes=${buf.length} key=${key}`,
          );
          migrated += 1;
          continue;
        }

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buf,
            ContentType: 'application/pdf',
            Metadata: {
              module: 'informes-firmas',
              backfill: '1',
              firma_id: String(id),
              informe_id: String(row.informe_id || ''),
              source: 'disk',
            },
          }),
        );

        await s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        if (flags.keepPath) {
          await conn.query(
            `UPDATE \`informes_firmas\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`informes_firmas\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`pdf_path\` = NULL
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        migrated += 1;
        if (migrated % 10 === 0 || migrated === 1) {
          console.log(
            `[informes-firmas-backfill] ok id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[informes-firmas-backfill] FAIL id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }

  await conn.end();
  console.log('[informes-firmas-backfill] done');
  console.log('[informes-firmas-backfill] migrated:', migrated);
  console.log('[informes-firmas-backfill] failed:', failed);
  console.log('[informes-firmas-backfill] processed:', processed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[informes-firmas-backfill] fatal:', err?.message || err);
  process.exit(1);
});
