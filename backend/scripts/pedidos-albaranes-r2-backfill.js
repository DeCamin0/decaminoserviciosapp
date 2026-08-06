/**
 * Backfill PedidosAlbaranes LONGBLOB (archivo) → Cloudflare R2.
 *
 * Selects rows where archivo IS NOT NULL and storage_key IS NULL.
 * Puts file to R2, sets storage_key / storage_bucket / tamano_bytes, then clears archivo.
 *
 * Usage (from backend/):
 *   node scripts/pedidos-albaranes-r2-backfill.js .env.decamino.local --dry-run
 *   node scripts/pedidos-albaranes-r2-backfill.js .env.decamino.local --limit=50
 *   node scripts/pedidos-albaranes-r2-backfill.js .env.decamino.local --batch=20
 *   node scripts/pedidos-albaranes-r2-backfill.js .env.decamino.local --keep-blob
 *   npm run storage:pedidos-albaranes-backfill
 *   npm run storage:pedidos-albaranes-backfill:both
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

function safeFileName(originalName, fallback = 'albaran') {
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

function sanitizePedidoUid(pedidoUid) {
  return (
    String(pedidoUid || '')
      .trim()
      .replace(/^=+/, '')
      .replace(/[\/\\]+/g, '_')
      .slice(0, 64) || 'sin-pedido'
  );
}

function guessContentType(originalName, mimeHint) {
  if (mimeHint && String(mimeHint).trim()) return String(mimeHint).trim();
  const ext = String(originalName || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return (ext && map[ext]) || 'application/octet-stream';
}

function buildAlbaranKey(tenant, pedidoUid, originalName, at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const id = randomUUID();
  const name = originalName || 'albaran.pdf';
  const safe = safeFileName(name);
  const scope = sanitizePedidoUid(pedidoUid);
  return [
    'decamino',
    tenant,
    'pedidos-albaranes',
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
  console.log('[pedidos-albaranes-backfill] env file:', envRel);
  console.log('[pedidos-albaranes-backfill] dry-run:', flags.dryRun);
  console.log('[pedidos-albaranes-backfill] keep-blob:', flags.keepBlob);
  console.log('[pedidos-albaranes-backfill] batch:', flags.batch);
  console.log('[pedidos-albaranes-backfill] limit:', flags.limit ?? 'none');

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
      '[pedidos-albaranes-backfill] FAIL: R2_ENABLED is not true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[pedidos-albaranes-backfill] FAIL: missing R2 credentials / endpoint / bucket',
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
      '[pedidos-albaranes-backfill] FAIL: missing DB_HOST / DB_USERNAME / DB_NAME',
    );
    process.exit(1);
  }

  const tenant = tenantSlug(dbConfig.database);
  console.log('[pedidos-albaranes-backfill] database:', dbConfig.database);
  console.log('[pedidos-albaranes-backfill] tenant:', tenant);
  console.log('[pedidos-albaranes-backfill] bucket:', bucket);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const conn = await mysql.createConnection(dbConfig);

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM \`PedidosAlbaranes\`
     WHERE \`archivo\` IS NOT NULL
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const pending = Number(countRows[0]?.c || 0);
  console.log('[pedidos-albaranes-backfill] pending rows:', pending);

  if (pending === 0) {
    await conn.end();
    console.log('[pedidos-albaranes-backfill] nothing to do');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let processed = 0;
  const maxTotal = flags.limit ?? pending;
  /** In dry-run, rows stay pending — skip already-seen ids so we don't loop the same batch. */
  const dryRunSeenIds = new Set();

  while (processed < maxTotal) {
    const take = Math.min(flags.batch, maxTotal - processed);
    let rows;
    if (flags.dryRun && dryRunSeenIds.size > 0) {
      const ids = [...dryRunSeenIds];
      const placeholders = ids.map(() => '?').join(',');
      [rows] = await conn.query(
        `SELECT \`id\`, \`pedido_uid\`, \`nombre_archivo\`, \`tipo_mime\`, \`subido_en\`, \`archivo\`
         FROM \`PedidosAlbaranes\`
         WHERE \`archivo\` IS NOT NULL
           AND (\`storage_key\` IS NULL OR \`storage_key\` = '')
           AND \`id\` NOT IN (${placeholders})
         ORDER BY \`id\` ASC
         LIMIT ?`,
        [...ids, take],
      );
    } else {
      [rows] = await conn.query(
        `SELECT \`id\`, \`pedido_uid\`, \`nombre_archivo\`, \`tipo_mime\`, \`subido_en\`, \`archivo\`
         FROM \`PedidosAlbaranes\`
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
        if (!buf || buf.length === 0) {
          throw new Error('empty archivo buffer');
        }
        const at = row.subido_en ? new Date(row.subido_en) : new Date();
        const key = buildAlbaranKey(
          tenant,
          row.pedido_uid,
          row.nombre_archivo || `albaran-${id}.pdf`,
          at,
        );
        const contentType = guessContentType(
          row.nombre_archivo,
          row.tipo_mime,
        );

        if (flags.dryRun) {
          dryRunSeenIds.add(id);
          console.log(
            `[dry-run] id=${id} pedido=${sanitizePedidoUid(row.pedido_uid)} bytes=${buf.length} key=${key}`,
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
              module: 'pedidos-albaranes',
              backfill: '1',
              albaran_id: String(id),
              pedido_uid: sanitizePedidoUid(row.pedido_uid),
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
            `UPDATE \`PedidosAlbaranes\`
             SET \`storage_key\` = ?,
                 \`storage_bucket\` = ?,
                 \`tamano_bytes\` = ?
             WHERE \`id\` = ?
               AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
            [key, bucket, buf.length, id],
          );
        } else {
          await conn.query(
            `UPDATE \`PedidosAlbaranes\`
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
            `[pedidos-albaranes-backfill] ok id=${id} (${migrated} migrated, ${failed} failed)`,
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[pedidos-albaranes-backfill] FAIL id=${id}:`,
          err?.message || err,
        );
      }
    }

    if (rows.length < take) break;
  }

  await conn.end();
  console.log('[pedidos-albaranes-backfill] done');
  console.log('[pedidos-albaranes-backfill] migrated:', migrated);
  console.log('[pedidos-albaranes-backfill] failed:', failed);
  console.log('[pedidos-albaranes-backfill] processed:', processed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[pedidos-albaranes-backfill] fatal:', err?.message || err);
  process.exit(1);
});
