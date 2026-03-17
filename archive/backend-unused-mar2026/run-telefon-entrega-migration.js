const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add TELEFON ENTREGA to Clientes...');
    
    const migrationSQL = `
      ALTER TABLE \`Clientes\` 
      ADD COLUMN \`TELEFON ENTREGA\` VARCHAR(50) NULL AFTER \`SERVICIO ENTREGA\`;
    `;
    
    console.log('📝 Executing SQL:', migrationSQL);
    
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added column: TELEFON ENTREGA to Clientes table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('ℹ️ Column already exists, skipping...');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
