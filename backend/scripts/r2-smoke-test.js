/**
 * READ/WRITE smoke test against Cloudflare R2 only (prefix decamino/_smoke/...).
 * Does not touch MariaDB, Prisma, or business modules.
 *
 * Usage (from backend/):
 *   npm run storage:r2-smoke
 *   npm run storage:r2-smoke -- .env.hera.local
 *
 * Requires R2_ENABLED=true and R2_* credentials in the env file.
 * Never prints secret values.
 */
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const dns = require('dns');
const https = require('https');

const R2_DEFAULT_EDGE_FALLBACK_IPS = [
  '172.64.148.235',
  '172.64.155.209',
  '104.16.132.229',
  '104.19.192.174',
];

function parseEdgeFallbackIps(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  if (['false', 'off', '0', 'no'].includes(trimmed.toLowerCase())) return [];
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveEdgeFallbackIps(explicit) {
  const parsed = parseEdgeFallbackIps(explicit);
  if (parsed.length) return parsed;
  if (process.env.NODE_ENV === 'production') return [];
  return [...R2_DEFAULT_EDGE_FALLBACK_IPS];
}

function createR2RequestHandler(endpoint, fallbackIps) {
  if (!fallbackIps.length) return undefined;
  let endpointHost = '';
  try {
    endpointHost = new URL(endpoint).hostname;
  } catch {
    return undefined;
  }

  const httpsAgent = new https.Agent({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      const isR2 =
        hostname === endpointHost ||
        String(hostname).endsWith('.r2.cloudflarestorage.com');
      if (!isR2) {
        dns.lookup(hostname, options, callback);
        return;
      }
      const addresses = fallbackIps.map((address) => ({
        address,
        family: 4,
      }));
      if (options.all) {
        callback(null, addresses);
        return;
      }
      callback(null, addresses[0].address, 4);
    },
  });

  return new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 30_000,
    requestTimeout: 120_000,
  });
}

const backendDir = path.join(__dirname, '..');
const envRel = process.argv[2] || process.env.ENV_FILE || '.env.decamino.local';
const envFile = path.resolve(backendDir, envRel);

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

function redactHost(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.host;
  } catch {
    return '(invalid-endpoint)';
  }
}

function buildSmokeKey() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = randomUUID();
  return `decamino/_smoke/r2-test/cli/${yyyy}/${mm}/${id}__smoke.txt`;
}

async function main() {
  console.log('[r2-smoke] env file:', envRel);
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
      '[r2-smoke] FAIL: R2_ENABLED is not true. Set R2_ENABLED=true in',
      envRel,
    );
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    console.error(
      '[r2-smoke] FAIL: missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET',
    );
    process.exit(1);
  }

  console.log('[r2-smoke] bucket:', bucket);
  console.log('[r2-smoke] endpoint host:', redactHost(endpoint));
  console.log('[r2-smoke] region:', region);

  const edgeIps = resolveEdgeFallbackIps(env.R2_CONNECT_VIA_EDGE_IP);
  if (edgeIps.length) {
    console.log('[r2-smoke] edge fallback IPs:', edgeIps.join(', '));
  }

  const requestHandler = createR2RequestHandler(endpoint, edgeIps);
  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    ...(requestHandler ? { requestHandler } : {}),
  });

  const key = buildSmokeKey();
  const payload = `decamino-r2-smoke ${new Date().toISOString()} ${randomUUID()}\n`;
  const body = Buffer.from(payload, 'utf8');

  console.log('[r2-smoke] key:', key);
  console.log('[r2-smoke] 1/5 put…');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain; charset=utf-8',
      Metadata: { purpose: 'r2-smoke' },
    }),
  );
  console.log('[r2-smoke] put OK');

  console.log('[r2-smoke] 2/5 exists (HeadObject)…');
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log('[r2-smoke] exists OK');

  console.log('[r2-smoke] 3/5 presigned GET…');
  const presigned = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 },
  );
  const presignHost = redactHost(presigned);
  console.log('[r2-smoke] presign OK (host:', presignHost + ', ttl=60s)');

  console.log('[r2-smoke] 4/5 get…');
  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const gotBytes = Buffer.from(await got.Body.transformToByteArray());
  if (gotBytes.toString('utf8') !== payload) {
    throw new Error('downloaded body does not match uploaded payload');
  }
  console.log('[r2-smoke] get OK (bytes=', gotBytes.length + ')');

  console.log('[r2-smoke] 5/5 delete…');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('[r2-smoke] delete OK');

  let stillThere = false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    stillThere = true;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    const name = err?.name;
    if (status !== 404 && name !== 'NotFound' && name !== 'NoSuchKey') {
      throw err;
    }
  }
  if (stillThere) {
    throw new Error('object still present after delete');
  }
  console.log('[r2-smoke] post-delete exists=false OK');

  console.log('[r2-smoke] SUCCESS — all steps passed');
}

main().catch((err) => {
  console.error('[r2-smoke] FAIL:', err?.message || String(err));
  process.exit(1);
});
