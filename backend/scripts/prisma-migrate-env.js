/**
 * Rulează `prisma migrate deploy` folosind DATABASE_URL dintr-un fișier .env dat.
 * Usage (din folderul backend):
 *   node scripts/prisma-migrate-env.js .env.decamino.local
 *   node scripts/prisma-migrate-env.js .env.hera.local
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envRel = process.argv[2];
if (!envRel) {
  console.error('Usage: node scripts/prisma-migrate-env.js <env-file>');
  process.exit(1);
}

const backendDir = path.join(__dirname, '..');
const envPath = path.isAbsolute(envRel)
  ? envRel
  : path.join(backendDir, envRel);

if (!fs.existsSync(envPath)) {
  console.error('Missing env file:', envPath);
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
let databaseUrl;
for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const m = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);
  if (m) {
    databaseUrl = m[1].trim().replace(/^["']|["']$/g, '');
    break;
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found in', envPath);
  process.exit(1);
}

console.log('[prisma-migrate-env] Using env file:', path.basename(envPath));

const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
  shell: true,
});

process.exit(r.status !== null && r.status !== undefined ? r.status : 1);
