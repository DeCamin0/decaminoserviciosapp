/**
 * Script pentru a rula migrația SQL pentru câmpurile Despido Improcedente
 * Rulează: node scripts/run-despido-improcedente-migration.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📋 Running migration: Add Despido Improcedente fields...');
    
    // 1. Verificăm și adăugăm câmpurile în solicitudes
    console.log('🔧 Checking solicitudes table...');
    
    const checkSolicitudesColumns = [
      'origen',
      'fecha_efectiva',
      'comentario_empresa',
      'created_by_user_id',
      'enviado_gestoria',
      'fecha_envio_gestoria'
    ];
    
    for (const column of checkSolicitudesColumns) {
      const checkQuery = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'solicitudes' 
          AND COLUMN_NAME = '${column}'
      `;
      
      const existing = await prisma.$queryRawUnsafe(checkQuery);
      
      if (existing && existing.length > 0) {
        console.log(`⚠️ Column solicitudes.${column} already exists. Skipping...`);
      } else {
        console.log(`🔧 Adding column solicitudes.${column}...`);
        
        let alterQuery = '';
        switch (column) {
          case 'origen':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`origen\` VARCHAR(50) NULL DEFAULT 'EMPLEADO'`;
            break;
          case 'fecha_efectiva':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`fecha_efectiva\` DATE NULL`;
            break;
          case 'comentario_empresa':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`comentario_empresa\` TEXT NULL`;
            break;
          case 'created_by_user_id':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`created_by_user_id\` VARCHAR(50) NULL`;
            break;
          case 'enviado_gestoria':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`enviado_gestoria\` BOOLEAN NULL DEFAULT FALSE`;
            break;
          case 'fecha_envio_gestoria':
            alterQuery = `ALTER TABLE \`solicitudes\` ADD COLUMN \`fecha_envio_gestoria\` DATETIME(0) NULL`;
            break;
        }
        
        if (alterQuery) {
          await prisma.$executeRawUnsafe(alterQuery);
          console.log(`✅ Column solicitudes.${column} added successfully!`);
        }
      }
    }
    
    // 2. Verificăm și adăugăm fecha_baja_programada în DatosEmpleados
    console.log('🔧 Checking DatosEmpleados table...');
    
    const checkFechaBajaQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'DatosEmpleados' 
        AND COLUMN_NAME = 'fecha_baja_programada'
    `;
    
    const existingFechaBaja = await prisma.$queryRawUnsafe(checkFechaBajaQuery);
    
    if (existingFechaBaja && existingFechaBaja.length > 0) {
      console.log('⚠️ Column DatosEmpleados.fecha_baja_programada already exists. Skipping...');
    } else {
      console.log('🔧 Adding column DatosEmpleados.fecha_baja_programada...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`DatosEmpleados\` ADD COLUMN \`fecha_baja_programada\` VARCHAR(100) NULL
      `);
      console.log('✅ Column DatosEmpleados.fecha_baja_programada added successfully!');
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
