/**
 * Script pentru a rula migrația SQL pentru câmpul codigo_empleado în tabelul Nominas
 * Rulează: node scripts/run-codigo-empleado-migration.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📋 Running migration: Add codigo_empleado to Nominas table...');
    
    // Verificăm dacă câmpul există deja
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Nominas' 
        AND COLUMN_NAME = 'codigo_empleado'
    `;
    
    const existingColumn = await prisma.$queryRawUnsafe(checkColumnQuery);
    
    if (existingColumn && existingColumn.length > 0) {
      console.log('⚠️ Column codigo_empleado already exists. Skipping ALTER TABLE...');
    } else {
      // Adăugăm câmpul codigo_empleado
      console.log('🔧 Adding codigo_empleado column...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`Nominas\` ADD COLUMN \`codigo_empleado\` VARCHAR(50) NULL
      `);
      console.log('✅ Column codigo_empleado added successfully!');
    }
    
    // Verificăm dacă indexul există deja
    const checkIndexQuery = `
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Nominas' 
        AND INDEX_NAME = 'idx_nominas_codigo_empleado'
    `;
    
    const existingIndex = await prisma.$queryRawUnsafe(checkIndexQuery);
    
    if (existingIndex && existingIndex.length > 0) {
      console.log('⚠️ Index idx_nominas_codigo_empleado already exists. Skipping CREATE INDEX...');
    } else {
      // Creăm indexul
      console.log('🔧 Creating index idx_nominas_codigo_empleado...');
      await prisma.$executeRawUnsafe(`
        CREATE INDEX \`idx_nominas_codigo_empleado\` ON \`Nominas\`(\`codigo_empleado\`)
      `);
      console.log('✅ Index idx_nominas_codigo_empleado created successfully!');
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
