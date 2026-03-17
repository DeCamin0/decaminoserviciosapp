/**
 * Așteaptă câteva secunde apoi pornește HERA (client2).
 * Folosit în dev:both ca Decamino să pornească primul și să nu vadă sentinelul .env.client2.active.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const delayMs = 12000; // 12s – timp ca Decamino să treacă de main.ts
console.log('[delay-then-client2] Pornesc Decamino (3000) + HERA (3002). Aștept', delayMs / 1000, 's apoi pornesc HERA...');
setTimeout(() => {
  console.log('[delay-then-client2] Pornesc HERA pe 3002 (Decamino rămâne pe 3000).');
  const backendDir = path.join(__dirname, '..');
  const r = spawnSync('npm', ['run', 'client2'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  process.exit(r.status != null ? r.status : 0);
}, delayMs);
