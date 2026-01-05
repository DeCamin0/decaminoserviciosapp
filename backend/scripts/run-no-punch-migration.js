/**
 * Script pentru a adăuga NO_PUNCH în enum-ul FichajeRegularizacionType
 * Usage: node scripts/run-no-punch-migration.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Running NO_PUNCH enum migration...');
    
    // Folosește variabilele de mediu pentru conexiune (ca în scriptul existent)
    const host = process.env.DB_HOST;
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USERNAME;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      throw new Error('DB_HOST, DB_USERNAME, DB_PASSWORD, and DB_NAME must be set in .env file');
    }

    console.log(`📝 Database: ${database} on ${host}:${port}`);
    console.log(`👤 User: ${user}`);

    // Creează conexiunea
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
    });

    console.log('✅ Connected to database');

    // Rulează migrația
    const migrationSQL = `
      ALTER TABLE \`FichajeRegularizacion\` 
      MODIFY COLUMN \`regularization_type\` ENUM('NO_EXTRA', 'DECLARES_EXTRA', 'PUNCH_ERROR', 'AUTO_CLOSE', 'LEGACY', 'NO_PUNCH') NOT NULL;
    `;

    console.log('🔄 Executing migration SQL...');
    await connection.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('🔄 Regenerating Prisma Client...');
    
    // Regenerăm Prisma Client
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { 
      cwd: process.cwd(),
      stdio: 'inherit' 
    });
    
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Verifică dacă enum-ul conține deja NO_PUNCH (migrația a fost deja rulată)
    if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
      console.log('ℹ️  NO_PUNCH already exists in enum. Migration may have already been run.');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

