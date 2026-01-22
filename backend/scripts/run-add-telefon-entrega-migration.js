const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add TELEFON ENTREGA to Clientes...');
    
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260122170000_add_telefon_entrega_to_clientes/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing SQL:', migrationSQL);
    
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added column: TELEFON ENTREGA to Clientes table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
