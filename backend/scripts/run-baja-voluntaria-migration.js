const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📋 Running migration: Add Baja Voluntaria fields...');

    // Check and add columns to solicitudes
    const solicitudesColumns = [
      { name: 'fecha_ultimo_dia_trabajo', type: 'DATE', default: 'NULL' },
      { name: 'dias_preaviso', type: 'INT', default: 'NULL' },
      { name: 'cumple_preaviso_15', type: 'BOOLEAN', default: 'FALSE' },
    ];

    console.log('🔧 Checking solicitudes table...');
    for (const col of solicitudesColumns) {
      const checkColumnQuery = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitudes'
          AND COLUMN_NAME = '${col.name}'
      `;
      const existingColumn = await prisma.$queryRawUnsafe(checkColumnQuery);

      if (existingColumn && existingColumn.length > 0) {
        console.log(`⚠️ Column solicitudes.${col.name} already exists. Skipping ALTER TABLE...`);
      } else {
        console.log(`🔧 Adding column solicitudes.${col.name}...`);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE \`solicitudes\` ADD COLUMN \`${col.name}\` ${col.type} NULL DEFAULT ${col.default}
        `);
        console.log(`✅ Column solicitudes.${col.name} added successfully!`);
      }
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
