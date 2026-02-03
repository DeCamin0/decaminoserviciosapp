require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addPersonalizadasColumns() {
  try {
    console.log('🔄 Adăugare câmpuri pentru zile anuale personalizate...\n');

    // Verifică dacă câmpurile există deja
    const checkColumns = await prisma.$queryRawUnsafe(`
      SELECT 
        COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'DatosEmpleados'
        AND COLUMN_NAME IN ('VACACIONES_ANUALES_PERSONALIZADAS', 'ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS')
    `);

    if (checkColumns && checkColumns.length > 0) {
      console.log('⚠️ Câmpurile există deja în baza de date\n');
      return;
    }

    // Adaugă VACACIONES_ANUALES_PERSONALIZADAS
    console.log('📝 Adăugare câmp VACACIONES_ANUALES_PERSONALIZADAS...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`DatosEmpleados\` 
      ADD COLUMN \`VACACIONES_ANUALES_PERSONALIZADAS\` DECIMAL(5,1) NULL DEFAULT NULL 
        COMMENT 'Zile anuale de vacanțe personalizate pentru angajat (dacă NULL, folosește convenio)' 
        AFTER \`VACACIONES_RESTANTES_ANO_ANTERIOR\`
    `);
    console.log('✅ Câmp VACACIONES_ANUALES_PERSONALIZADAS adăugat\n');

    // Adaugă ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS
    console.log('📝 Adăugare câmp ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`DatosEmpleados\` 
      ADD COLUMN \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` DECIMAL(5,1) NULL DEFAULT NULL 
        COMMENT 'Zile anuale de asuntos propios personalizate pentru angajat (dacă NULL, folosește convenio)' 
        AFTER \`VACACIONES_ANUALES_PERSONALIZADAS\`
    `);
    console.log('✅ Câmp ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS adăugat\n');

    console.log('✅ Migrare completă!\n');

  } catch (error) {
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('⚠️ Câmpurile există deja în baza de date\n');
    } else {
      console.error('❌ Eroare:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addPersonalizadasColumns();
