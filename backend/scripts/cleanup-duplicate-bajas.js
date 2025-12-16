const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

async function cleanupDuplicates() {
  let connection;

  try {
    // Conectare la baza de date
    connection = await mysql.createConnection({
      host: envVars.DB_HOST || process.env.DB_HOST || '217.154.102.115',
      port: parseInt(envVars.DB_PORT || process.env.DB_PORT || '3306'),
      user: envVars.DB_USERNAME || process.env.DB_USERNAME || 'facturacion_user',
      password: envVars.DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: envVars.DB_NAME || process.env.DB_NAME || 'decamino_db',
    });

    console.log('✅ Connected to database');
    console.log(`   Database: ${envVars.DB_NAME || process.env.DB_NAME || 'decamino_db'}`);

    // Citirea scriptului SQL
    const sqlPath = path.join(__dirname, 'cleanup-duplicate-bajas.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Extrage statement-urile SQL (separate prin ;)
    // Elimină liniile de comentarii care încep cu -- (dar păstrează comentariile inline)
    const lines = sqlContent.split('\n').filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--');
    });
    const cleanedSQL = lines.join('\n');
    
    const statements = cleanedSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length > 10); // Minim 10 caractere pentru a fi un statement valid

    console.log(`\n📋 Found ${statements.length} SQL statements to execute\n`);

    // Rularea fiecărui statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip SELECT-ul de verificare (îl rulăm la final)
      if (statement.trim().toUpperCase().startsWith('SELECT') && statement.includes('HAVING')) {
        continue;
      }

      try {
        console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}...`);
        
        if (statement.toUpperCase().includes('DELETE')) {
          const [result] = await connection.execute(statement);
          console.log(`   ✅ Deleted ${result.affectedRows} duplicate records`);
        } else if (statement.toUpperCase().includes('UPDATE')) {
          const [result] = await connection.execute(statement);
          console.log(`   ✅ Updated ${result.affectedRows} records`);
        } else {
          await connection.execute(statement);
          console.log(`   ✅ Executed successfully`);
        }
      } catch (error) {
        console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
        // Continuăm cu următorul statement
      }
    }

    // Verificare: arată duplicatele rămase
    console.log('\n🔍 Checking for remaining duplicates...');
    const [checkRows] = await connection.execute(`
      SELECT 
        TRIM(LEADING '0' FROM \`Id.Caso\`) as caso_normalizado,
        TRIM(LEADING '0' FROM \`Id.Posición\`) as posicion_normalizada,
        COUNT(*) as count
      FROM \`MutuaCasos\`
      GROUP BY 
        TRIM(LEADING '0' FROM \`Id.Caso\`),
        TRIM(LEADING '0' FROM \`Id.Posición\`)
      HAVING COUNT(*) > 1
    `);

    if (checkRows.length === 0) {
      console.log('   ✅ No duplicates found! All cleaned up.');
    } else {
      console.log(`   ⚠️  Found ${checkRows.length} duplicate groups:`);
      checkRows.forEach((row) => {
        console.log(`      - Caso: ${row.caso_normalizado}, Posición: ${row.posicion_normalizada}, Count: ${row.count}`);
      });
    }

    // Afișează total înregistrări
    const [totalRows] = await connection.execute('SELECT COUNT(*) as total FROM `MutuaCasos`');
    console.log(`\n📊 Total records in MutuaCasos: ${totalRows[0].total}`);

    console.log('\n✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Connection closed');
    }
  }
}

cleanupDuplicates();

