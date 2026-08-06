/**
 * Backfill email_attachments.file_content → R2.
 * Usage: node scripts/email-attachments-r2-backfill.js .env.decamino.local [--dry-run]
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
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    out[trimmed.slice(0, eq).trim()] = val;
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

function safeFileName(originalName, fallback = 'attachment') {
  const base =
    String(originalName || fallback).split(/[/\\]/).pop() || fallback;
  return (
    base
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 180) || fallback
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function sanitize(s) {
  return String(s || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '_');
}

function buildKey(tenant, emailId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const safe = safeFileName(originalName || 'attachment.bin');
  const scope = sanitize(String(emailId || 'sin-email').slice(0, 64));
  return [
    'decamino',
    tenant,
    'email-attachments',
    scope,
    yyyy,
    mm,
    `${id}__${safe}`,
  ]
    .map(sanitize)
    .filter(Boolean)
    .join('/');
}

function toBuffer(blob) {
  if (blob == null) return null;
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === 'string') return Buffer.from(blob, 'base64');
  return null;
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const fileEnv = parseEnvFile(path.resolve(backendDir, envRel));
  const env = { ...fileEnv, ...process.env };
  console.log('[email-attachments-backfill]', envRel, 'dry-run=', flags.dryRun);

  if (String(env.R2_ENABLED || '').toLowerCase() !== 'true') {
    console.error('FAIL: R2_ENABLED not true');
    process.exit(1);
  }
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();
  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const bucket = (env.R2_BUCKET || '').trim() || 'dc-files-prod';
  const endpoint =
    (env.R2_ENDPOINT || '').trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    console.error('FAIL: missing R2 credentials');
    process.exit(1);
  }

  const dbConfig = {
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
  const tenant = tenantSlug(dbConfig.database);
  console.log('database:', dbConfig.database, 'tenant:', tenant);

  const s3 = new S3Client({
    region: (env.R2_REGION || '').trim() || 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`email_attachments\`
     WHERE \`file_content\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('pending:', pending);
  if (pending === 0) {
    await conn.end();
    console.log('Nothing to backfill');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;
  const drySeen = new Set();

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    let rows;
    if (flags.dryRun && drySeen.size) {
      const ids = [...drySeen];
      const ph = ids.map(() => '?').join(',');
      [rows] = await conn.query(
        `SELECT id, email_id, filename, mime_type, created_at, file_content
         FROM email_attachments
         WHERE file_content IS NOT NULL AND (storage_key IS NULL OR storage_key='')
           AND id NOT IN (${ph})
         ORDER BY created_at ASC LIMIT ?`,
        [...ids, take],
      );
    } else {
      [rows] = await conn.query(
        `SELECT id, email_id, filename, mime_type, created_at, file_content
         FROM email_attachments
         WHERE file_content IS NOT NULL AND (storage_key IS NULL OR storage_key='')
         ORDER BY created_at ASC LIMIT ?`,
        [take],
      );
    }
    if (!rows.length) break;

    for (const row of rows) {
      const id = String(row.id);
      processed += 1;
      try {
        const buf = toBuffer(row.file_content);
        if (!buf?.length) throw new Error('empty buffer');
        const at = row.created_at ? new Date(row.created_at) : new Date();
        const name = row.filename || `${id}.bin`;
        const key = buildKey(tenant, row.email_id, name, at);
        const contentType =
          (row.mime_type && String(row.mime_type).trim()) ||
          'application/octet-stream';

        if (flags.dryRun) {
          drySeen.add(id);
          console.log(
            `[dry-run] id=${id} email=${row.email_id} bytes=${buf.length} key=${key}`,
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
              module: 'email-attachments',
              backfill: '1',
              attachment_id: id,
              email_id: String(row.email_id || ''),
            },
          }),
        );
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

        if (flags.keepBlob) {
          await conn.query(
            `UPDATE email_attachments SET storage_key=?, storage_bucket=?, file_size=?
             WHERE id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE email_attachments SET storage_key=?, storage_bucket=?, file_size=?, file_content=NULL
             WHERE id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, id],
          );
        }
        migrated += 1;
        if (migrated % 25 === 0 || migrated === 1) {
          console.log(`ok id=${id} (${migrated} migrated, ${failed} failed)`);
        }
      } catch (err) {
        failed += 1;
        console.error(`FAIL id=${id}:`, err?.message || err);
      }
    }
    if (rows.length < take) break;
  }

  await conn.end();
  console.log('done migrated:', migrated, 'failed:', failed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
