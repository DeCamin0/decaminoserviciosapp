/**
 * Rulează Prisma migrate deploy folosind .env (sau ENV_FILE).
 * Construiește DATABASE_URL din DB_HOST, DB_NAME, DB_USERNAME, DB_PASSWORD dacă lipsește.
 * Util pentru Client 2: pune .env cu DB_NAME=hera_facility_db și rulează din backend:
 *   node scripts/prisma-migrate-deploy.js
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
  console.log('📦 DATABASE_URL built from DB_*:', databaseUrl.replace(/:[^:@]+@/, ':****@'));
} else {
  console.log('📦 Using DATABASE_URL from .env');
}

// Siguranță: nu rula migrări pe bazele client 1 din greșeală (doar hera_facility_db pentru client 2)
const dbNameFromUrl = (databaseUrl.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
if (dbNameFromUrl && (dbNameFromUrl === 'decamino_db' || dbNameFromUrl === 'decamino_facturacion')) {
  console.error('❌ Refuz: migrarea ar rula pe baza client 1 (' + dbNameFromUrl + ').');
  console.error('   Pentru client 2 folosește un .env cu DB_NAME=hera_facility_db (ex. ENV_FILE=.env.client2.local).');
  process.exit(1);
}
console.log('🎯 Bază de date țintă:', dbNameFromUrl || '(din DATABASE_URL)');

// Prisma CLI încarcă .env din cwd și suprascrie DATABASE_URL. Pentru ENV_FILE !== .env,
// scriem temporar doar DATABASE_URL într-un .env în backend ca Prisma să o folosească.
const envBackupPath = path.join(backendDir, '.env.prisma-migrate-backup');
const defaultEnvPath = path.join(backendDir, '.env');
let didBackup = false;

if (envFile !== '.env' && envPath !== defaultEnvPath && fs.existsSync(defaultEnvPath)) {
  fs.copyFileSync(defaultEnvPath, envBackupPath);
  didBackup = true;
  const oneLiner = `DATABASE_URL="${databaseUrl.replace(/"/g, '\\"')}"`;
  fs.writeFileSync(defaultEnvPath, oneLiner + '\n', 'utf-8');
}

try {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  console.log('✅ Prisma migrate deploy completed.');
} catch (err) {
  console.error('❌ prisma migrate deploy failed');
  if (didBackup) {
    fs.copyFileSync(envBackupPath, defaultEnvPath);
    fs.unlinkSync(envBackupPath);
  }
  process.exit(1);
}

if (didBackup) {
  fs.copyFileSync(envBackupPath, defaultEnvPath);
  fs.unlinkSync(envBackupPath);
  console.log('📁 .env restored.');
}
