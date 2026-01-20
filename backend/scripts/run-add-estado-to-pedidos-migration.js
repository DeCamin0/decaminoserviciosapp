// Script Node.js pentru rularea migrației SQL - Adăugare estado la PedidosTodos
// Rulează: node scripts/run-add-estado-to-pedidos-migration.js

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📋 Running migration: Add estado to PedidosTodos');
    console.log('');

    // Citește fișierul SQL
    const sqlFile = path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20260115150000_add_estado_to_pedidos_todos',
      'migration.sql'
    );

    if (!fs.existsSync(sqlFile)) {
      console.error(`❌ SQL file not found: ${sqlFile}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 SQL Content:');
    console.log(sqlContent);
    console.log('');

    // Execută migrația
    console.log('🚀 Running migration...');
    await prisma.$executeRawUnsafe(sqlContent);

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('✅ Column \'estado\' added to PedidosTodos table');
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
