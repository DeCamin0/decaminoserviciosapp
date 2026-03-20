/**
 * Creează tabelele assistant_conversations și assistant_messages (arhivă chat).
 * Rulează pe AMBELE baze:
 *   node scripts/run-assistant-conversations-migration.js .env.decamino.local
 *   node scripts/run-assistant-conversations-migration.js .env.hera.local
 */
const path = require('path');
const fs = require('fs');

const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📝 Migration: assistant_conversations + assistant_messages\n');
    console.log(`   DB: ${process.env.DB_NAME || 'N/A'} (from ${envFile})\n`);

    const sqlPath = path.join(
      __dirname,
      '../migrations/create_assistant_conversations_tables.sql',
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const blocks = sql
      .split(/\n(?=CREATE TABLE)/i)
      .map((b) =>
        b
          .split('\n')
          .filter((line) => !/^\s*--/.test(line))
          .join('\n')
          .trim(),
      )
      .filter(Boolean);

    for (const stmt of blocks) {
      await prisma.$executeRawUnsafe(stmt.endsWith(';') ? stmt : `${stmt};`);
    }

    console.log('✅ Assistant conversation tables OK.');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
