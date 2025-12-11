const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

async function createChatMessageReadsTable() {
  const backendDir = path.resolve(__dirname, '..');
  const envPath = path.join(backendDir, '.env');

  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  } else {
    console.error('❌ .env file not found in backend directory.');
    process.exit(1);
  }

  const envVars = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  };

  if (!envVars.DB_HOST || !envVars.DB_USERNAME || !envVars.DB_PASSWORD || !envVars.DB_NAME) {
    console.error('❌ Missing one or more database environment variables (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME).');
    process.exit(1);
  }

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
    
    // Check if table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'chat_message_reads'
    `, [envVars.DB_NAME || 'decaminoservicios']);

    if (tables.length > 0) {
      console.log('⚠️  Table chat_message_reads already exists.');
      console.log('✅ Skipping creation');
      return;
    }

    const sql = fs.readFileSync(path.join(backendDir, 'prisma', 'migrations', '20251211_add_chat_message_reads', 'migration.sql'), 'utf8');
    console.log('🚀 Creating chat_message_reads table...');
    await connection.query(sql);
    console.log('✅ chat_message_reads table created successfully!');
  } catch (error) {
    console.error('❌ Error creating chat_message_reads table:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createChatMessageReadsTable();

