// Script to create chat tables directly by reading SQL from migration
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Read .env
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found');
  process.exit(1);
}

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

// Read SQL migration
const sqlPath = path.join(__dirname, '../prisma/migrations/20251211_add_chat_tables/migration.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

async function run() {
  const connection = await mysql.createConnection({
    host: envVars.DB_HOST || 'localhost',
    port: parseInt(envVars.DB_PORT || '3306'),
    user: envVars.DB_USERNAME || 'root',
    password: envVars.DB_PASSWORD || '',
    database: envVars.DB_NAME || 'decaminoservicios',
    multipleStatements: true,
  });

  try {
    console.log('📦 Connecting to database...');
    
    // Check if tables exist
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('chat_rooms', 'chat_room_members', 'chat_messages')
    `, [envVars.DB_NAME || 'decaminoservicios']);

    if (tables.length > 0) {
      console.log('⚠️  Tables already exist:', tables.map(t => t.TABLE_NAME).join(', '));
      console.log('✅ Skipping creation');
      return;
    }

    console.log('📝 Running migration SQL...');
    await connection.query(sql);
    console.log('✅ Chat tables created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();

