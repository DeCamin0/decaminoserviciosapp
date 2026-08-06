/**
 * Backfill CatologoProductos LONGBLOB (fotoproducto) → Cloudflare R2.
 *
 * Selects rows where fotoproducto IS NOT NULL and storage_key IS NULL.
 * Puts image to R2, sets storage_key / storage_bucket / tamano_bytes, then clears fotoproducto.
 *
 * Usage (from backend/):
 *   node scripts/catalogo-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/catalogo-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/catalogo-r2-backfill.js .env.decamino.local --batch=20
 *   node scripts/catalogo-r2-backfill.js .env.decamino.local --keep-blob
 *   npm run storage:catalogo-backfill
 *   npm run storage:catalogo-backfill:both
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

function safeFileName(originalName, fallback = 'producto') {
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

function detectImageExt(buf) {
  if (!buf || buf.length < 4) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return 'gif';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return 'jpg';
}

function contentTypeForExt(ext) {
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function buildCatalogoKey(tenant, productoId, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const safe = safeFileName(originalName || 'producto.jpg');
  const scope = String(productoId || '').trim() || 'sin-id';
  return [
    'decamino',
    tenant,
    'catalogo',
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

function toBuffer(fotoproducto) {
  if (fotoproducto == null) return null;
  if (Buffer.isBuffer(fotoproducto)) return fotoproducto;
  if (fotoproducto instanceof Uint8Array) return Buffer.from(fotoproducto);
  if (typeof fotoproducto === 'string') return Buffer.from(fotoproducto, 'base64');
  return null;
}

async function main() {
  const { envRel, flags } = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(backendDir, envRel);
  console.log('[catalogo-backfill] env file:', envRel);
  console.log('[catalogo-backfill] dry-run:', flags.dryRun);
  console.log('[catalogo-backfill] keep-blob:', flags.keepBlob);
  console.log('[catalogo-backfill] batch:', flags.batch);
  console.log('[catalogo-backfill] limit:', flags.limit ?? 'none');

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
    console.error('[catalogo-backfill] FAIL: R2_ENABLED is not true in', envRel);
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[catalogo-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
      '[catalogo-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[catalogo-backfill] database:', dbConfig.database);
  console.log('[catalogo-backfill] tenant:', tenant);
  console.log('[catalogo-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`CatologoProductos\`
     WHERE \`fotoproducto\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[catalogo-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[catalogo-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  let lastId = 0;
  const maxTotal = flags.limit ?? pending;

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    // Cursor by id so --dry-run (no UPDATE) does not re-fetch the same batch
    const [rows] = await conn.query(
      `SELECT \`id\`, \`fotoproducto\`
       FROM \`CatologoProductos\`
       WHERE \`fotoproducto\` IS NOT NULL
         AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
         AND \`id\` > ?
       ORDER BY \`id\` ASC
       LIMIT ?`,
      [lastId, take],
    );

    if (!rows.length) break;

    for (const row of rows) {
      const id = Number(row.id);
      lastId = id;
      processed += 1;
      try {
        const buf = toBuffer(row.fotoproducto);
        if (!buf || buf.length === 0) {
          throw new Error('empty fotoproducto buffer');
        }
        const ext = detectImageExt(buf);
        const contentType = contentTypeForExt(ext);
        const key = buildCatalogoKey(
          tenant,
          id,
          `producto-${id}.${ext}`,
          new Date(),
        );

        if (flags.dryRun) {
          console.log(`[dry-run] id=${id} bytes=${buf.length} key=${key}`);
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
              module: 'catalogo',
              backfill: '1',
              producto_id: String(id),
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
            `UPDATE \`CatologoProductos\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`CatologoProductos\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?,
                 \`fotoproducto\` = NULL
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        }

        migrated += 1;
        if (migrated % 10 === 0 || migrated === 1) {
          console.log(
            `[catalogo-backfill] ok id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[catalogo-backfill] FAIL id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }

  await conn.end();
  console.log('[catalogo-backfill] done');
  console.log('[catalogo-backfill] migrated:', migrated);
  console.log('[catalogo-backfill] failed:', failed);
  console.log('[catalogo-backfill] processed:', processed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[catalogo-backfill] fatal:', err?.message || err);
  process.exit(1);
});
