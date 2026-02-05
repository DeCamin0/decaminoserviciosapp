/**
 * Script pentru a adăuga coloana ausencia_asociada_id în tabelul Ausencias
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Adăugare coloană ausencia_asociada_id în tabelul Ausencias...');

    // Verifică dacă coloana există deja
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Ausencias' 
        AND COLUMN_NAME = 'ausencia_asociada_id'
    `;
    const existingColumn = await prisma.$queryRawUnsafe(checkColumnQuery);

    if (existingColumn && existingColumn.length > 0) {
      console.log('✅ Coloana ausencia_asociada_id există deja în tabelul Ausencias');
      return;
    }

    // Adaugă coloana
    const addColumnQuery = `
      ALTER TABLE Ausencias 
      ADD COLUMN ausencia_asociada_id INT NULL,
      ADD INDEX idx_ausencias_asociada_id (ausencia_asociada_id)
    `;

    await prisma.$executeRawUnsafe(addColumnQuery);

    console.log('✅ Coloana ausencia_asociada_id a fost adăugată cu succes în tabelul Ausencias');
  } catch (error) {
    console.error('❌ Eroare la adăugarea coloanei:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✅ Script finalizat cu succes');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Eroare:', error);
    process.exit(1);
  });
