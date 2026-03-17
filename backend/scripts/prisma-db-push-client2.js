/**
 * Pentru baza goală (ex. hera_facility_db): creează toate tabelele din schema.prisma (db push),
 * apoi marchează migrările ca aplicate ca să nu se mai ruleze la următorul migrate deploy.
 * Rulează: ENV_FILE=.env.client2.local node scripts/prisma-db-push-client2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.join(__dirname, '..');
const envFile = process.env.ENV_FILE || '.env';
const envPath = path.join(backendDir, envFile);

if (!fs.existsSync(envPath)) {
  console.error('❌ .env not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      envVars[key] = value;
    }
  }
});

let databaseUrl = envVars.DATABASE_URL;
if (!databaseUrl) {
  const host = envVars.DB_HOST || 'localhost';
  const port = envVars.DB_PORT || '3306';
  const user = envVars.DB_USERNAME || 'root';
  const password = envVars.DB_PASSWORD || '';
  const database = envVars.DB_NAME || 'decaminoservicios';
  databaseUrl = `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  if (!databaseUrl.includes('charset=')) {
    databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'charset=utf8mb4';
  }
}
const dbNameFromUrl = (databaseUrl.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
if (dbNameFromUrl && (dbNameFromUrl === 'decamino_db' || dbNameFromUrl === 'decamino_facturacion')) {
  console.error('❌ Refuz: doar pentru baza client 2 (DB_NAME=hera_facility_db).');
  process.exit(1);
}

console.log('🎯 Bază țintă:', dbNameFromUrl);
console.log('📦 Rulare prisma db push...');
const env = { ...process.env, DATABASE_URL: databaseUrl };

try {
  execSync('npx prisma db push', { stdio: 'inherit', cwd: backendDir, env });
} catch (err) {
  console.error('❌ prisma db push failed');
  process.exit(1);
}

const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
const dirs = fs.readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log('📌 Marcare', dirs.length, 'migrări ca aplicate...');
for (const name of dirs) {
  try {
    execSync(`npx prisma migrate resolve --applied "${name}"`, { stdio: 'inherit', cwd: backendDir, env });
  } catch (e) {
    console.warn('⚠️ resolve --applied', name, e.message || '');
  }
}
console.log('✅ Gata. Baza', dbNameFromUrl, 'are toate tabelele și istoricul de migrări sincronizat.');