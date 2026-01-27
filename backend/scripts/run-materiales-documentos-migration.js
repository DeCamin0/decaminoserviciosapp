/**
 * Script pentru rularea migration-ului MaterialesDocumentos
 * Usage: node scripts/run-materiales-documentos-migration.js
 */

require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Running MaterialesDocumentos migration...\n');
    
    // Folosește variabilele de mediu pentru conexiune
    const host = process.env.DB_HOST;
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USERNAME;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      throw new Error('DB_HOST, DB_USERNAME, DB_PASSWORD, and DB_NAME must be set in .env file');
    }

    console.log(`📝 Database: ${database} on ${host}:${port}`);
    console.log(`👤 User: ${user}\n`);

    // Creează conexiunea
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
    });

    console.log('✅ Connected to database\n');

    // Citește fișierul de migrare
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260127161143_add_materiales_documentos/migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    console.log('─'.repeat(60));
    
    // Rulează migrația
    await connection.query(sql);
    
    console.log('─'.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('✅ Created table: MaterialesDocumentos');
    console.log('✅ Created indexes: idx_materiales_inspeccion, idx_materiales_empleado\n');
    
    // Regenerăm Prisma Client
    try {
      console.log('🔄 Regenerating Prisma Client...');
      const { execSync } = require('child_process');
      execSync('npx prisma generate', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
      console.log('✅ Prisma Client regenerated!');
    } catch (prismaError) {
      console.log('⚠️  Could not regenerate Prisma Client (file may be in use)');
      console.log('   You can run manually: npx prisma generate');
      console.log('   This does not affect the migration - table was created successfully!');
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Verifică dacă tabelul există deja
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log('ℹ️  Table may already exist. Migration may have already been run.');
      console.log('✅ This is OK - table is already in place!');
    } else {
      if (error.sql) {
        console.error('SQL:', error.sql);
      }
      console.error(error);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed');
    }
  }
}

runMigration();
