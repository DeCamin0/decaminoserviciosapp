/**
 * Încarcă un fișier .env în process.env și rulează o comandă.
 * Util pentru client 2 pe Windows, unde cross-env poate să nu transmită ENV_FILE.
 * Usage: node scripts/run-with-env.js .env.client2.local npm run start:dev
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.join(__dirname, '..');
const envFile = process.argv[2];
if (!envFile) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  process.exit(1);
}

const envPath = path.resolve(backendDir, envFile);
if (!fs.existsSync(envPath)) {
  console.error('Env file not found:', envPath);
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
process.env.ENV_FILE = envFile;
console.log('[run-with-env] Loaded', envPath, '| DB_NAME:', process.env.DB_NAME || '(not set)');

const cmd = process.argv.slice(3);
if (cmd.length === 0) {
  console.error('No command given. Example: node scripts/run-with-env.js .env.client2.local npm run start:dev');
  process.exit(1);
}

const cmdStr = cmd.join(' ');
execSync(cmdStr, { stdio: 'inherit', cwd: backendDir, env: process.env });