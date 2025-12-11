// Script to run chat migration by reading .env and constructing DATABASE_URL
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Build DATABASE_URL
const host = envVars.DB_HOST || 'localhost';
const port = envVars.DB_PORT || '3306';
const user = envVars.DB_USERNAME || 'root';
const password = envVars.DB_PASSWORD || '';
const database = envVars.DB_NAME || 'decaminoservicios';

const databaseUrl = `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
console.log('📦 DATABASE_URL constructed:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

// Set DATABASE_URL and run migration
process.env.DATABASE_URL = databaseUrl;
try {
  execSync('npx prisma migrate deploy', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

