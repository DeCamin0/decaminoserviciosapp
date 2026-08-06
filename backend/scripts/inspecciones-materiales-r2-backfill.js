/**
 * Backfill InspeccionesDocumentos + MaterialesDocumentos LONGBLOB → R2.
 * Usage: node scripts/inspecciones-materiales-r2-backfill.js .env.decamino.local [--dry-run]
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

function safeFileName(originalName, fallback = 'doc') {
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

function buildKey(tenant, scopeParts, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const safe = safeFileName(originalName || 'doc.pdf');
  return ['decamino', tenant, 'inspecciones-materiales', ...scopeParts, yyyy, mm, `${id}__${safe}`]
    .map(sanitize)
    .filter(Boolean)
    .join('/');
}

function toBuffer(archivo) {
  if (archivo == null) return null;
  if (Buffer.isBuffer(archivo)) return archivo;
  if (archivo instanceof Uint8Array) return Buffer.from(archivo);
  if (typeof archivo === 'string') return Buffer.from(archivo, 'base64');
  return null;
}

async function backfillInspecciones(conn, s3, bucket, tenant, flags) {
  console.log('\n[InspeccionesDocumentos]');
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`InspeccionesDocumentos\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('pending:', pending);
  if (pending === 0) return { migrated: 0, failed: 0 };

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
        `SELECT id, nombre_archivo, fecha_subida, archivo FROM InspeccionesDocumentos
         WHERE archivo IS NOT NULL AND (storage_key IS NULL OR storage_key='')
           AND id NOT IN (${ph}) ORDER BY id ASC LIMIT ?`,
        [...ids, take],
      );
    } else {
      [rows] = await conn.query(
        `SELECT id, nombre_archivo, fecha_subida, archivo FROM InspeccionesDocumentos
         WHERE archivo IS NOT NULL AND (storage_key IS NULL OR storage_key='')
         ORDER BY id ASC LIMIT ?`,
        [take],
      );
    }
    if (!rows.length) break;

    for (const row of rows) {
      const id = String(row.id);
      processed += 1;
      try {
        const buf = toBuffer(row.archivo);
        if (!buf?.length) throw new Error('empty buffer');
        const at = row.fecha_subida ? new Date(row.fecha_subida) : new Date();
        const name = row.nombre_archivo || `${id}.pdf`;
        const key = buildKey(tenant, ['inspecciones', id], name, at);
        if (flags.dryRun) {
          drySeen.add(id);
          console.log(`[dry-run] insp id=${id} bytes=${buf.length} key=${key}`);
          migrated += 1;
          continue;
        }
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buf,
            ContentType: 'application/pdf',
            Metadata: { module: 'inspecciones', backfill: '1', inspeccion_id: id },
          }),
        );
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (flags.keepBlob) {
          await conn.query(
            `UPDATE InspeccionesDocumentos SET storage_key=?, storage_bucket=?, tamano_bytes=?
             WHERE id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE InspeccionesDocumentos SET storage_key=?, storage_bucket=?, tamano_bytes=?, archivo=NULL
             WHERE id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, id],
          );
        }
        migrated += 1;
        if (migrated % 20 === 0 || migrated === 1) {
          console.log(`ok insp id=${id} (${migrated} migrated, ${failed} failed)`);
        }
      } catch (err) {
        failed += 1;
        console.error(`FAIL insp id=${id}:`, err?.message || err);
      }
    }
    if (rows.length < take) break;
  }
  console.log('done migrated:', migrated, 'failed:', failed);
  return { migrated, failed };
}

async function backfillMateriales(conn, s3, bucket, tenant, flags) {
  console.log('\n[MaterialesDocumentos]');
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`MaterialesDocumentos\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('pending:', pending);
  if (pending === 0) return { migrated: 0, failed: 0 };

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
        `SELECT doc_id, inspeccion_id, nombre_archivo, fecha_creacion, archivo FROM MaterialesDocumentos
         WHERE archivo IS NOT NULL AND (storage_key IS NULL OR storage_key='')
           AND doc_id NOT IN (${ph}) ORDER BY doc_id ASC LIMIT ?`,
        [...ids, take],
      );
    } else {
      [rows] = await conn.query(
        `SELECT doc_id, inspeccion_id, nombre_archivo, fecha_creacion, archivo FROM MaterialesDocumentos
         WHERE archivo IS NOT NULL AND (storage_key IS NULL OR storage_key='')
         ORDER BY doc_id ASC LIMIT ?`,
        [take],
      );
    }
    if (!rows.length) break;

    for (const row of rows) {
      const docId = Number(row.doc_id);
      processed += 1;
      try {
        const buf = toBuffer(row.archivo);
        if (!buf?.length) throw new Error('empty buffer');
        const at = row.fecha_creacion ? new Date(row.fecha_creacion) : new Date();
        const name = row.nombre_archivo || `material-${docId}.pdf`;
        const insp = String(row.inspeccion_id || 'sin-id');
        const key = buildKey(tenant, ['materiales', insp], name, at);
        const ext = name.split('.').pop()?.toLowerCase();
        const contentType =
          ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : 'application/pdf';
        if (flags.dryRun) {
          drySeen.add(docId);
          console.log(
            `[dry-run] mat doc_id=${docId} bytes=${buf.length} key=${key}`,
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
              module: 'materiales',
              backfill: '1',
              doc_id: String(docId),
              inspeccion_id: insp,
            },
          }),
        );
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (flags.keepBlob) {
          await conn.query(
            `UPDATE MaterialesDocumentos SET storage_key=?, storage_bucket=?, tamano_bytes=?
             WHERE doc_id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, docId],
          );
        } else {
          await conn.query(
            `UPDATE MaterialesDocumentos SET storage_key=?, storage_bucket=?, tamano_bytes=?, archivo=NULL
             WHERE doc_id=? AND (storage_key IS NULL OR storage_key='')`,
            [key, bucket, buf.length, docId],
          );
        }
        migrated += 1;
        console.log(`ok mat doc_id=${docId} (${migrated} migrated)`);
      } catch (err) {
        failed += 1;
        console.error(`FAIL mat doc_id=${docId}:`, err?.message || err);
      }
    }
    if (rows.length < take) break;
  }
  console.log('done migrated:', migrated, 'failed:', failed);
  return { migrated, failed };
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const fileEnv = parseEnvFile(path.resolve(backendDir, envRel));
  const env = { ...fileEnv, ...process.env };
  console.log('[inspecciones-materiales-backfill]', envRel, 'dry-run=', flags.dryRun);

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
  const a = await backfillInspecciones(conn, s3, bucket, tenant, flags);
  const b = await backfillMateriales(conn, s3, bucket, tenant, flags);
  await conn.end();
  console.log('\nTOTAL migrated', a.migrated + b.migrated, 'failed', a.failed + b.failed);
  if (a.failed + b.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
