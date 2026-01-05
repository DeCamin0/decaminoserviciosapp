require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runMigration() {
  let connection;

  try {
    console.log('🔄 Running aplicar_a_nuevos migration...');

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

    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
    });

    console.log('✅ Connected to database');

    const migrationPath = path.join(__dirname, '../prisma/migrations/20260104180001_add_aplicar_a_nuevos/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    await connection.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('✅ Column added: aplicar_a_nuevos');

    console.log('🔄 Regenerating Prisma Client...');
    try {
      execSync('npx prisma generate', {
        cwd: path.join(__dirname, '..'), // Run from backend root
        stdio: 'inherit'
      });
      console.log('✅ Prisma Client regenerated successfully!');
    } catch (prismaError) {
      console.warn('⚠️ Failed to regenerate Prisma Client. This might happen if the backend is running and locking files. Please run `npx prisma generate` manually if needed after stopping the backend.');
      console.warn(`Prisma error: ${prismaError.message}`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

runMigration();

