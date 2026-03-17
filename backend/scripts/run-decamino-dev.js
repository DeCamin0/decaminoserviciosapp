/**
 * Pornește backend DeCamino (client 1) pe 3000.
 * Șterge sentinelul HERA dacă există, ca să nu pornească greșit ca client 2.
 * Usage: node scripts/run-decamino-dev.js [--watch]
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const backendDir = path.join(__dirname, '..');
const sentinelPath = path.join(backendDir, 'node_modules', '.decamino-client2-active');

if (fs.existsSync(sentinelPath)) {
  fs.unlinkSync(sentinelPath);
  console.log('[run-decamino-dev] Șters sentinel HERA → pornește DeCamino (client 1) pe 3000.');
}

const watch = process.argv.includes('--watch');
const args = ['nest', 'start'];
if (watch) args.push('--watch');

const r = spawnSync('npx', args, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});
process.exit(r.status != null ? r.status : 0);
