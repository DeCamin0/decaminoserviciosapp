/**
 * Migration: add columns to solicitudes for "Ausencia justificada" form.
 * Run on both DBs: node scripts/run-ausencia-justificada-fields-migration.js .env.decamino.local
 *                 node scripts/run-ausencia-justificada-fields-migration.js .env.hera.local
 */
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.argv[2] || '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const columns = [
  { name: 'tipo_justificante', type: 'VARCHAR(80)', default: 'NULL' },
  { name: 'hora_cita', type: 'VARCHAR(20)', default: 'NULL' },
  { name: 'centro_medico', type: 'VARCHAR(255)', default: 'NULL' },
  { name: 'descripcion_otro', type: 'TEXT', default: 'NULL' },
];

async function runMigration() {
  try {
    console.log('📋 Running migration: Ausencia justificada fields on solicitudes...');

    for (const col of columns) {
      const check = await prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitudes' AND COLUMN_NAME = '${col.name}'
      `);
      if (check && check.length > 0) {
        console.log(`⚠️ solicitudes.${col.name} already exists. Skipping.`);
      } else {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE \`solicitudes\` ADD COLUMN \`${col.name}\` ${col.type} NULL
        `);
        console.log(`✅ solicitudes.${col.name} added.`);
      }
    }

    console.log('✅ Migration completed.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
