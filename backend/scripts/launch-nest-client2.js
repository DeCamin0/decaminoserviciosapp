/**
 * Încarcă .env.client2.local și pornește Nest cu acest env (HERA – hera_facility_db).
 * Eliberează automat portul 3002 dacă e ocupat (proces vechi) înainte de start.
 * Usage: node scripts/launch-nest-client2.js [--watch]
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const HERA_PORT = 3002;
const backendDir = path.join(__dirname, '..');
// Prefer .env.hera.local; fallback la .env.client2.local (backward compat)
const heraEnvPath = path.join(backendDir, '.env.hera.local');
const envPath = fs.existsSync(heraEnvPath)
  ? heraEnvPath
  : path.join(backendDir, '.env.client2.local');

/** Eliberează doar portul HERA (3002). Nu atinge niciodată 3000 (Decamino). */
function freePortIfInUse(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = out.trim().split(/\r?\n/).filter((l) => l.includes('LISTENING'));
    const pids = new Set();
    for (const line of lines) {
      const m = line.trim().split(/\s+/);
      const pid = m[m.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      console.log(`[launch-nest-client2] Eliberez doar portul ${port} (HERA): opresc PID ${pid}. Decamino (3000) nu e atins.`);
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    }
  } catch (e) {
    if (e.status !== 1 && e.killed !== true) return;
    // findstr returns 1 when no match – port is free
  }
}

if (!fs.existsSync(envPath)) {
  console.error('Missing .env.hera.local or .env.client2.local in backend folder');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).replace(/\\n/g, '\n');
      }
      process.env[key] = value;
    }
  }
});
process.env.ENV_FILE = envPath.endsWith('.env.hera.local') ? '.env.hera.local' : '.env.client2.local';

// Golim doar SMTP general (moștenit din shell) – NU și Telegram; Telegram vine din .env.client2.local (gestoria HERA + general)
['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].forEach((k) => {
  process.env[k] = process.env[k] || '';
});

// Sentinel în node_modules ca Nest --watch (Decamino) să nu vadă modificarea și să nu se restarteze
const sentinelPath = path.join(backendDir, 'node_modules', '.decamino-client2-active');
const oldSentinel = path.join(backendDir, '.env.client2.active');
if (fs.existsSync(oldSentinel)) fs.unlinkSync(oldSentinel);
fs.writeFileSync(sentinelPath, '1', 'utf8');
console.log('[launch-nest-client2] DB_NAME:', process.env.DB_NAME, '| PORT:', process.env.PORT, '| sentinel created');
console.log('[launch-nest-client2] Eliberez doar 3002 (HERA); Decamino pe 3000 nu e atins.');
freePortIfInUse(HERA_PORT);

const watch = process.argv.includes('--watch');
const args = ['nest', 'start'];
if (watch) args.push('--watch');

try {
  const result = spawnSync('npx', args, {
    cwd: backendDir,
    env: { ...process.env },
    stdio: 'inherit',
    shell: true,
  });
  process.exit(result.status != null ? result.status : 0);
} finally {
  if (fs.existsSync(sentinelPath)) fs.unlinkSync(sentinelPath);
}
