/**
 * Script Node.js pentru ștergerea logurilor din anul trecut
 * Rulează: node backend/scripts/delete-old-logs.js [--dry-run] [--year=2024]
 * 
 * Opțiuni:
 *   --dry-run    : Doar afișează ce ar șterge, fără să șteargă efectiv
 *   --year=2024  : Specifică anul pentru ștergere (implicit: anul trecut)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parsează argumentele din linia de comandă
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const yearArg = args.find(arg => arg.startsWith('--year='));
const targetYear = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear() - 1;

async function deleteOldLogs() {
  try {
    console.log('📝 Ștergere loguri din anul trecut...\n');
    console.log(`📅 An țintă: ${targetYear}`);
    console.log(`🔍 Mod: ${isDryRun ? 'DRY-RUN (doar afișează, nu șterge)' : 'ȘTERGERE EFECTIVĂ'}\n`);

    // Calculează datele pentru anul țintă
    const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    console.log(`📊 Interval: ${startOfYear.toISOString()} - ${endOfYear.toISOString()}\n`);

    // Numără totalul de loguri înainte
    const totalLogs = await prisma.logs.count();
    console.log(`📈 Total loguri în baza de date: ${totalLogs}`);

    // Funcție helper pentru a parsa timestamp-ul
    const parseTimestamp = (timestampStr) => {
      if (!timestampStr) return null;
      
      try {
        // Încearcă să parseze ca ISO string
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) {
          return null;
        }
        return date;
      } catch (error) {
        return null;
      }
    };

    // Obține toate logurile (pentru a le filtra în memorie, deoarece timestamp este String)
    console.log('\n🔍 Se citesc toate logurile...');
    const allLogs = await prisma.logs.findMany({
      select: {
        id: true,
        timestamp: true,
        action: true,
        user: true,
        email: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    console.log(`✅ S-au citit ${allLogs.length} loguri\n`);

    // Filtrează logurile din anul țintă
    const logsToDelete = [];
    const logsWithInvalidTimestamp = [];
    const logsOutsideTargetYear = [];

    for (const log of allLogs) {
      const logDate = parseTimestamp(log.timestamp);
      
      if (!logDate) {
        logsWithInvalidTimestamp.push(log);
        continue;
      }

      if (logDate >= startOfYear && logDate <= endOfYear) {
        logsToDelete.push(log);
      } else {
        logsOutsideTargetYear.push(log);
      }
    }

    // Statistici
    console.log('📊 Statistici:');
    console.log(`   ✅ Loguri din ${targetYear}: ${logsToDelete.length}`);
    console.log(`   ⚠️  Loguri cu timestamp invalid: ${logsWithInvalidTimestamp.length}`);
    console.log(`   📅 Loguri din alți ani: ${logsOutsideTargetYear.length}`);
    console.log(`   📈 Total loguri: ${allLogs.length}\n`);

    if (logsWithInvalidTimestamp.length > 0) {
      console.log('⚠️  Loguri cu timestamp invalid (nu vor fi șterse):');
      logsWithInvalidTimestamp.slice(0, 5).forEach(log => {
        console.log(`   - ID: ${log.id}, timestamp: "${log.timestamp}"`);
      });
      if (logsWithInvalidTimestamp.length > 5) {
        console.log(`   ... și încă ${logsWithInvalidTimestamp.length - 5} loguri`);
      }
      console.log('');
    }

    if (logsToDelete.length === 0) {
      console.log('✅ Nu există loguri de șters din anul specificat.\n');
      return;
    }

    // Afișează primele 10 loguri care vor fi șterse
    console.log('📋 Primele 10 loguri care vor fi șterse:');
    logsToDelete.slice(0, 10).forEach(log => {
      const date = parseTimestamp(log.timestamp);
      console.log(`   - ID: ${log.id}, Data: ${date?.toISOString()}, Action: ${log.action || 'N/A'}, User: ${log.user || 'N/A'}`);
    });
    if (logsToDelete.length > 10) {
      console.log(`   ... și încă ${logsToDelete.length - 10} loguri\n`);
    } else {
      console.log('');
    }

    if (isDryRun) {
      console.log('🔍 DRY-RUN: Nu s-au șters loguri (folosește fără --dry-run pentru ștergere efectivă)\n');
      return;
    }

    // Confirmare
    console.log(`⚠️  ATENȚIE: Se vor șterge ${logsToDelete.length} loguri din anul ${targetYear}!`);
    console.log('   Apasă Ctrl+C în următoarele 5 secunde pentru a anula...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Șterge logurile în batch-uri pentru performanță
    console.log('🗑️  Se șterg logurile...');
    const batchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < logsToDelete.length; i += batchSize) {
      const batch = logsToDelete.slice(i, i + batchSize);
      const ids = batch.map(log => log.id);

      await prisma.logs.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      deletedCount += batch.length;
      console.log(`   ✅ Șterse ${deletedCount} / ${logsToDelete.length} loguri...`);
    }

    // Verifică rezultatul
    const remainingLogs = await prisma.logs.count();
    console.log('\n✅ Ștergere finalizată!');
    console.log(`   📊 Loguri șterse: ${deletedCount}`);
    console.log(`   📈 Loguri rămase: ${remainingLogs}`);
    console.log(`   📉 Reducere: ${totalLogs - remainingLogs} loguri\n`);

  } catch (error) {
    console.error('❌ Eroare la ștergerea logurilor:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează scriptul
deleteOldLogs()
  .then(() => {
    console.log('🎉 Script finalizat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script eșuat:', error);
    process.exit(1);
  });
