/**
 * Upload company stamp PNG to Decamino R2 branding prefix.
 * Usage: node scripts/upload-sello-empresa-r2.js [.env.decamino.local]
 */
const path = require('path');
const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const backendDir = path.join(__dirname, '..');
const envRel = process.argv[2] || '.env.decamino.local';
const envFile = path.resolve(backendDir, envRel);
const stampPath = path.resolve(
  backendDir,
  '..',
  'frontend',
  'public',
  'assets',
  'sello-decamino-empresa.png',
);
const KEY = 'decamino/decamino/branding/sello-empresa/sello-decamino-empresa.png';

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

async function main() {
  console.log('[sello-r2] env:', envRel);
  console.log('[sello-r2] file:', stampPath);
  if (!fs.existsSync(stampPath)) {
    throw new Error('Stamp PNG not found: ' + stampPath);
  }

  const env = { ...parseEnvFile(envFile), ...process.env };
  if (String(env.R2_ENABLED || '').toLowerCase() !== 'true') {
    throw new Error('R2_ENABLED is not true in ' + envRel);
  }

  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (env.R2_BUCKET || '').trim() || 'dc-files-prod';
  const endpoint =
    (env.R2_ENDPOINT || '').trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const region = (env.R2_REGION || '').trim() || 'auto';

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Missing R2 credentials / endpoint');
  }

  const body = fs.readFileSync(stampPath);
  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: KEY,
      Body: body,
      ContentType: 'image/png',
      Metadata: {
        module: 'branding',
        tenant: 'decamino',
        kind: 'sello-empresa',
        source: 'contrato-anisoara-extract',
      },
    }),
  );

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: KEY }),
  );
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: KEY }),
    { expiresIn: 3600 },
  );

  console.log('[sello-r2] OK bucket:', bucket);
  console.log('[sello-r2] OK key:', KEY);
  console.log(
    '[sello-r2] OK size:',
    head.ContentLength,
    'type:',
    head.ContentType,
  );
  console.log('[sello-r2] presigned 1h (truncated):', url.slice(0, 96) + '...');
}

main().catch((err) => {
  console.error('[sello-r2] FAIL:', err.message || err);
  process.exit(1);
});
