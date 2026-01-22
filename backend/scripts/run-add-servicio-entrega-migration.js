const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add SERVICIO ENTREGA to Clientes...');
    
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260122160000_add_servicio_entrega_to_clientes/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing SQL:', migrationSQL);
    
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added column: SERVICIO ENTREGA to Clientes table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
