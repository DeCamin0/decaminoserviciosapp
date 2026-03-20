/**
 * Tabla assistant_user_preferences (preferencias explícitas, opt-in).
 * Aplicar en AMBAS bases:
 *   node scripts/run-assistant-user-preferences-migration.js .env.decamino.local
 *   node scripts/run-assistant-user-preferences-migration.js .env.hera.local
 */
const path = require('path');
const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function runMigration() {
  try {
    console.log('📝 Migration: assistant_user_preferences\n');
    console.log(`   DB: ${process.env.DB_NAME || 'N/A'} (from ${envFile})\n`);

    const sqlPath = path.join(
      __dirname,
      '../migrations/create_assistant_user_preferences_table.sql',
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as n FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assistant_user_preferences'
    `);
    const exists = (tableCheck[0]?.n ?? 0) > 0;

    if (exists) {
      console.log('⚠️  Table assistant_user_preferences already exists. Skipping.');
      return;
    }

    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Table assistant_user_preferences created successfully.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
