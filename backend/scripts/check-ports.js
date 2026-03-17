/**
 * Verifică dacă Decamino (3000) și HERA (3002) ascultă.
 * Rulează: node scripts/check-ports.js
 */
const { execSync } = require('child_process');

function portInUse(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.includes('LISTENING');
  } catch {
    return false;
  }
}

const p3000 = portInUse(3000);
const p3002 = portInUse(3002);

console.log('');
console.log('  Decamino (3000):', p3000 ? 'OK (pornit)' : 'NU (nu asculta)');
console.log('  HERA (3002):   ', p3002 ? 'OK (pornit)' : 'NU (nu asculta)');
console.log('');

if (p3000 && p3002) {
  console.log('  Ambele backend-uri ruleaza.');
} else if (!p3000 && !p3002) {
  console.log('  Niciun backend nu ruleaza. Porneste: npm run dev:both');
} else {
  console.log('  Porneste ambele cu: npm run dev:both');
}
console.log('');

process.exit(p3000 && p3002 ? 0 : 1);
