/**
 * Script Node.js pentru rularea migrației no_necesita_justificante
 * Rulează: node backend/scripts/run-no-necesita-justificante-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('📝 Running migration: add_no_necesita_justificante_to_ausencias\n');

    // Citește SQL-ul din fișier
    const sqlFile = path.join(__dirname, '../migrations/add_no_necesita_justificante_to_ausencias.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 SQL Content:');
    console.log(sqlContent);
    console.log('\n');

    // Verifică dacă câmpul există deja
    const checkColumnQuery = `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Ausencias'
        AND COLUMN_NAME = 'no_necesita_justificante'
    `;

    const columnExists = await prisma.$queryRawUnsafe(checkColumnQuery);
    const exists = columnExists[0]?.count > 0;

    if (exists) {
      console.log('⚠️  Column no_necesita_justificante already exists. Skipping migration.');
      return;
    }

    console.log('✅ Column does not exist. Running migration...\n');

    // Rulează migrația - fiecare statement separat
    console.log('   Step 1: Adding column no_necesita_justificante...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Ausencias\`
        ADD COLUMN \`no_necesita_justificante\` BOOLEAN NOT NULL DEFAULT FALSE
        AFTER \`UNIDAD_DURACION\`
    `);
    console.log('   ✅ Column added');

    // Verifică dacă index-ul există deja
    const checkIndexQuery = `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Ausencias'
        AND INDEX_NAME = 'idx_ausencias_no_necesita_justificante'
    `;

    const indexExists = await prisma.$queryRawUnsafe(checkIndexQuery);
    const indexExistsCount = indexExists[0]?.count > 0;

    if (!indexExistsCount) {
      console.log('   Step 2: Adding index idx_ausencias_no_necesita_justificante...');
      await prisma.$executeRawUnsafe(`
        CREATE INDEX \`idx_ausencias_no_necesita_justificante\` ON \`Ausencias\` (\`no_necesita_justificante\`)
      `);
      console.log('   ✅ Index added');
    } else {
      console.log('   ⚠️  Index already exists. Skipping.');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('   - Added column: no_necesita_justificante');
    console.log('   - Added index: idx_ausencias_no_necesita_justificante');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    
    // Verifică dacă eroarea este că câmpul există deja
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('⚠️  Column already exists. Migration may have been run before.');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
