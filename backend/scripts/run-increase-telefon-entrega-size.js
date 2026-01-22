const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Increase TELEFON ENTREGA size to 100...');
    
    const migrationSQL = `
      ALTER TABLE \`Clientes\` 
      MODIFY COLUMN \`TELEFON ENTREGA\` VARCHAR(100) NULL;
    `;
    
    console.log('📝 Executing SQL:', migrationSQL);
    
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ TELEFON ENTREGA column size increased to 100');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('ℹ️ Column already modified, skipping...');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
