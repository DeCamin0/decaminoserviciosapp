/**
 * Script Node.js pentru ștergerea logurilor unui angajat pentru o anumită dată
 * Rulează: node backend/scripts/delete-employee-logs.js [--email=EMAIL] [--user=USER] [--id=ID] [--date=YYYY-MM-DD] [--dry-run] [--list]
 * 
 * Opțiuni:
 *   --email=EMAIL    : Email-ul angajatului (ex: user@example.com) - căutare exactă sau parțială
 *   --user=USER      : Numele utilizatorului (ex: JOHN DOE) - căutare exactă sau parțială
 *   --id=ID          : ID-ul specific al unui log (ex: 123)
 *   --date=YYYY-MM-DD: Data pentru care să șteargă (implicit: astăzi)
 *   --dry-run        : Doar afișează ce ar șterge, fără să șteargă efectiv
 *   --list           : Afișează toate logurile de astăzi (sau data specificată) fără să șteargă
 * 
 * Exemple:
 *   node backend/scripts/delete-employee-logs.js --list                    # Afișează toate logurile de astăzi
 *   node backend/scripts/delete-employee-logs.js --email=user@example.com   # Șterge logurile pentru email
 *   node backend/scripts/delete-employee-logs.js --user="JOHN"              # Șterge logurile pentru user (căutare parțială)
 *   node backend/scripts/delete-employee-logs.js --id=123                   # Șterge un log specific
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parsează argumentele din linia de comandă
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isListOnly = args.includes('--list');
const emailArg = args.find(arg => arg.startsWith('--email='));
const userArg = args.find(arg => arg.startsWith('--user='));
const idArg = args.find(arg => arg.startsWith('--id='));
const dateArg = args.find(arg => arg.startsWith('--date='));

const targetEmail = emailArg ? emailArg.split('=')[1] : null;
const targetUser = userArg ? decodeURIComponent(userArg.split('=')[1]) : null;
const targetId = idArg ? parseInt(idArg.split('=')[1]) : null;
const targetDate = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0]; // Astăzi

async function deleteEmployeeLogs() {
  try {
    console.log('📝 Ștergere loguri angajat pentru o anumită dată...\n');

    // Dacă e doar --list, afișează toate logurile și iese
    if (isListOnly) {
      await listLogsForDate();
      return;
    }

    // Validare: trebuie să fie specificat cel puțin un criteriu
    if (!targetEmail && !targetUser && !targetId) {
      console.error('❌ Eroare: Trebuie să specifici cel puțin un criteriu:');
      console.error('   --email=EMAIL    : Email-ul angajatului');
      console.error('   --user=USER      : Numele utilizatorului');
      console.error('   --id=ID          : ID-ul unui log specific');
      console.error('   --list           : Afișează toate logurile pentru data specificată');
      console.error('\n   Exemplu: node backend/scripts/delete-employee-logs.js --list');
      console.error('   Exemplu: node backend/scripts/delete-employee-logs.js --email=user@example.com');
      console.error('   Exemplu: node backend/scripts/delete-employee-logs.js --user="JOHN DOE"');
      process.exit(1);
    }

    console.log(`📅 Dată țintă: ${targetDate}`);
    if (targetId !== null) {
      console.log(`👤 Criteriu: ID: ${targetId}`);
    } else {
      console.log(`👤 Criteriu: ${targetEmail ? `Email: ${targetEmail}` : `User: ${targetUser}`}`);
    }
    console.log(`🔍 Mod: ${isDryRun ? 'DRY-RUN (doar afișează, nu șterge)' : 'ȘTERGERE EFECTIVĂ'}\n`);

    // Calculează intervalul pentru ziua specificată
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    console.log(`📊 Interval: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}\n`);

    // Funcție helper pentru a parsa timestamp-ul
    const parseTimestamp = (timestampStr) => {
      if (!timestampStr) return null;
      
      try {
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) {
          return null;
        }
        return date;
      } catch (error) {
        return null;
      }
    };

    // Obține toate logurile
    console.log('🔍 Se citesc logurile...');
    const allLogs = await prisma.logs.findMany({
      select: {
        id: true,
        timestamp: true,
        action: true,
        user: true,
        email: true,
        grupo: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    console.log(`✅ S-au citit ${allLogs.length} loguri\n`);

    // Filtrează logurile care se potrivesc criteriilor
    const logsToDelete = [];
    const logsWithInvalidTimestamp = [];

    for (const log of allLogs) {
      // Verifică dacă se potrivește cu criteriul
      let matches = false;

      // Dacă e specificat ID, verifică doar ID-ul
      if (targetId !== null) {
        matches = log.id === targetId;
      } else {
        // Verifică email (căutare parțială, case-insensitive)
        const matchesEmail = targetEmail && log.email && 
          log.email.toLowerCase().includes(targetEmail.toLowerCase());
        
        // Verifică user (căutare parțială, case-insensitive)
        const matchesUser = targetUser && log.user && 
          log.user.toLowerCase().includes(targetUser.toLowerCase());

        matches = matchesEmail || matchesUser;
      }

      if (!matches) {
        continue; // Nu se potrivește cu criteriul
      }

      // Verifică data
      const logDate = parseTimestamp(log.timestamp);
      
      if (!logDate) {
        logsWithInvalidTimestamp.push(log);
        continue;
      }

      // Verifică dacă este în intervalul zilei specificate
      if (logDate >= startOfDay && logDate <= endOfDay) {
        logsToDelete.push(log);
      }
    }

    // Statistici
    console.log('📊 Statistici:');
    console.log(`   ✅ Loguri găsite pentru ${targetDate}: ${logsToDelete.length}`);
    if (logsWithInvalidTimestamp.length > 0) {
      console.log(`   ⚠️  Loguri cu timestamp invalid: ${logsWithInvalidTimestamp.length}`);
    }
    console.log('');

    if (logsToDelete.length === 0) {
      console.log('✅ Nu există loguri de șters pentru criteriile specificate.\n');
      return;
    }

    // Afișează toate logurile care vor fi șterse
    console.log('📋 Loguri care vor fi șterse:');
    logsToDelete.forEach((log, index) => {
      const date = parseTimestamp(log.timestamp);
      console.log(`   ${index + 1}. ID: ${log.id}, Data: ${date?.toISOString()}, Action: ${log.action || 'N/A'}, User: ${log.user || 'N/A'}, Email: ${log.email || 'N/A'}`);
    });
    console.log('');

    if (isDryRun) {
      console.log('🔍 DRY-RUN: Nu s-au șters loguri (folosește fără --dry-run pentru ștergere efectivă)\n');
      return;
    }

    // Confirmare
    console.log(`⚠️  ATENȚIE: Se vor șterge ${logsToDelete.length} loguri pentru ${targetEmail || targetUser} din data ${targetDate}!`);
    console.log('   Apasă Ctrl+C în următoarele 5 secunde pentru a anula...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Șterge logurile
    console.log('🗑️  Se șterg logurile...');
    const ids = logsToDelete.map(log => log.id);

    const result = await prisma.logs.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    console.log('\n✅ Ștergere finalizată!');
    console.log(`   📊 Loguri șterse: ${result.count}`);
    if (targetId !== null) {
      console.log(`   🆔 ID: ${targetId}`);
    } else {
      console.log(`   👤 Angajat: ${targetEmail || targetUser}`);
    }
    console.log(`   📅 Dată: ${targetDate}\n`);

  } catch (error) {
    console.error('❌ Eroare la ștergerea logurilor:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Funcție pentru a afișa toate logurile pentru o dată
async function listLogsForDate() {
  try {
    console.log(`📋 Listare loguri pentru data: ${targetDate}\n`);

    // Calculează intervalul pentru ziua specificată
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    console.log(`📊 Interval: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}\n`);

    // Funcție helper pentru a parsa timestamp-ul
    const parseTimestamp = (timestampStr) => {
      if (!timestampStr) return null;
      
      try {
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) {
          return null;
        }
        return date;
      } catch (error) {
        return null;
      }
    };

    // Obține toate logurile
    console.log('🔍 Se citesc logurile...');
    const allLogs = await prisma.logs.findMany({
      select: {
        id: true,
        timestamp: true,
        action: true,
        user: true,
        email: true,
        grupo: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    console.log(`✅ S-au citit ${allLogs.length} loguri\n`);

    // Filtrează logurile pentru data specificată
    const logsForDate = [];
    const logsWithInvalidTimestamp = [];

    for (const log of allLogs) {
      const logDate = parseTimestamp(log.timestamp);
      
      if (!logDate) {
        logsWithInvalidTimestamp.push(log);
        continue;
      }

      if (logDate >= startOfDay && logDate <= endOfDay) {
        logsForDate.push(log);
      }
    }

    // Statistici
    console.log('📊 Statistici:');
    console.log(`   ✅ Loguri pentru ${targetDate}: ${logsForDate.length}`);
    if (logsWithInvalidTimestamp.length > 0) {
      console.log(`   ⚠️  Loguri cu timestamp invalid: ${logsWithInvalidTimestamp.length}`);
    }
    console.log('');

    if (logsForDate.length === 0) {
      console.log('✅ Nu există loguri pentru data specificată.\n');
      return;
    }

    // Grupează după user/email pentru a afișa statistici
    const byUser = {};
    logsForDate.forEach(log => {
      const key = log.email || log.user || 'Necunoscut';
      if (!byUser[key]) {
        byUser[key] = [];
      }
      byUser[key].push(log);
    });

    console.log('📋 Loguri grupate după utilizator:');
    Object.keys(byUser).sort().forEach(key => {
      console.log(`\n   👤 ${key}: ${byUser[key].length} loguri`);
      byUser[key].slice(0, 5).forEach(log => {
        const date = parseTimestamp(log.timestamp);
        console.log(`      - ID: ${log.id}, ${date?.toISOString()}, Action: ${log.action || 'N/A'}`);
      });
      if (byUser[key].length > 5) {
        console.log(`      ... și încă ${byUser[key].length - 5} loguri`);
      }
    });

    console.log('\n💡 Pentru a șterge logurile unui utilizator, folosește:');
    console.log(`   node backend/scripts/delete-employee-logs.js --email=EMAIL --date=${targetDate}`);
    console.log(`   node backend/scripts/delete-employee-logs.js --user="USER" --date=${targetDate}`);
    console.log(`   node backend/scripts/delete-employee-logs.js --id=ID --date=${targetDate}\n`);

  } catch (error) {
    console.error('❌ Eroare la listarea logurilor:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează scriptul
deleteEmployeeLogs()
  .then(() => {
    console.log('🎉 Script finalizat!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script eșuat:', error);
    process.exit(1);
  });
