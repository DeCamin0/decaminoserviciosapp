const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add aprobado/rechazado tracking fields to PedidosTodos...');
    
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260122150000_add_aprobado_rechazado_to_pedidos/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing SQL:', migrationSQL);
    
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added columns: aprobado_por, aprobado_en, rechazado_por, rechazado_en');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
