const mysql = require('mysql2/promise');
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

async function listTables() {
  const connection = await mysql.createConnection({
    host: envVars.DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(envVars.DB_PORT || process.env.DB_PORT || '3306'),
    user: envVars.DB_USERNAME || process.env.DB_USERNAME || 'root',
    password: envVars.DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: envVars.DB_NAME || process.env.DB_NAME || 'decaminoservicios',
  });

  try {
    console.log('📋 Listing all tables in database...\n');
    
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME ASC
    `, [envVars.DB_NAME || process.env.DB_NAME || 'decaminoservicios']);

    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.TABLE_NAME}`);
    });

    console.log('\n📊 Tables in current Prisma schema:');
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const modelMatches = schemaContent.match(/model\s+(\w+)/g);
    if (modelMatches) {
      modelMatches.forEach((match, index) => {
        const modelName = match.replace('model ', '').trim();
        console.log(`${index + 1}. ${modelName}`);
      });
    }

    console.log('\n🔍 Missing tables (in DB but not in schema):');
    const schemaModels = modelMatches ? modelMatches.map(m => m.replace('model ', '').trim().toLowerCase()) : [];
    const dbTables = tables.map(t => t.TABLE_NAME.toLowerCase());
    
    const missing = dbTables.filter(table => {
      // Check if table is mapped in schema (look for @@map)
      const tableLower = table.toLowerCase();
      return !schemaModels.some(model => {
        // Check if model maps to this table
        const modelRegex = new RegExp(`model\\s+${model}\\s*\\{[\\s\\S]*?@@map\\(["']${table}["']\\)`, 'i');
        return modelRegex.test(schemaContent);
      });
    });

    if (missing.length > 0) {
      missing.forEach(table => {
        console.log(`  - ${table}`);
      });
    } else {
      console.log('  ✅ All tables are mapped in schema!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

listTables();

