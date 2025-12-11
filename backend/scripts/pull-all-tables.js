const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

// Build DATABASE_URL (same logic as PrismaService)
const host = envVars.DB_HOST || process.env.DB_HOST || 'localhost';
const port = envVars.DB_PORT || process.env.DB_PORT || '3306';
const user = envVars.DB_USERNAME || process.env.DB_USERNAME || 'root';
const password = envVars.DB_PASSWORD || process.env.DB_PASSWORD || '';
const database = envVars.DB_NAME || process.env.DB_NAME || 'decaminoservicios';

const databaseUrl = `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

console.log('🔍 Extracting all tables from database...');
console.log(`   Database: ${database}`);
console.log(`   Host: ${host}:${port}\n`);

// Set DATABASE_URL and run prisma db pull
process.env.DATABASE_URL = databaseUrl;

try {
  // Backup current schema
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const backupPath = path.join(__dirname, '../prisma/schema.prisma.backup');
  if (fs.existsSync(schemaPath)) {
    fs.copyFileSync(schemaPath, backupPath);
    console.log('✅ Backed up current schema to schema.prisma.backup\n');
  }

  // Run prisma db pull
  console.log('📥 Running prisma db pull...\n');
  execSync('npx prisma db pull', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });

  console.log('\n✅ Schema extracted successfully!');
  console.log('📝 Review the changes in prisma/schema.prisma');
  console.log('💾 Backup saved to prisma/schema.prisma.backup');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (fs.existsSync(backupPath)) {
    console.log('💾 Restoring backup...');
    fs.copyFileSync(backupPath, schemaPath);
  }
  process.exit(1);
}

