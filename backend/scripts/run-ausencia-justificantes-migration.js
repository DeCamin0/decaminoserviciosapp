/**
 * Crea la tabla ausencia_justificantes para vincular ausencias con justificantes (cerere/presencia).
 * Uso (aplica en AMBELE baze - Decamino y HERA):
 *   node scripts/run-ausencia-justificantes-migration.js .env.decamino.local
 *   node scripts/run-ausencia-justificantes-migration.js .env.hera.local
 */
const path = require('path');
const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function runMigration() {
  try {
    console.log('📝 Running migration: create_ausencia_justificantes_table\n');
    console.log(`   DB: ${process.env.DB_NAME || 'N/A'} (from ${envFile})\n`);

    const sqlPath = path.join(__dirname, '../migrations/create_ausencia_justificantes_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as n FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ausencia_justificantes'
    `);
    const exists = (tableCheck[0]?.n ?? 0) > 0;

    if (exists) {
      console.log('⚠️  Table ausencia_justificantes already exists. Skipping.');
      return;
    }

    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Table ausencia_justificantes created successfully.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
