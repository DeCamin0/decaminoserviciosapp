require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function checkRegularizacion() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Conectat la baza de date');

    // Verifică regularizări pentru 10000001 în ianuarie 2026
    const [regularizaciones] = await connection.query(`
      SELECT 
        id,
        employee_codigo,
        workday_date,
        status,
        effective_minutes,
        punched_minutes,
        scheduled_minutes,
        regularization_type,
        created_at,
        confirmed_at
      FROM FichajeRegularizacion
      WHERE employee_codigo = '10000001'
        AND workday_date >= '2026-01-01'
        AND workday_date < '2026-02-01'
      ORDER BY workday_date DESC
    `);

    console.log(`\n📊 Găsite ${regularizaciones.length} regularizări pentru 10000001 în ianuarie 2026:\n`);
    
    if (regularizaciones.length === 0) {
      console.log('❌ NU EXISTĂ regularizări confirmate pentru această dată!');
    } else {
      regularizaciones.forEach((reg, index) => {
        console.log(`${index + 1}. ID: ${reg.id}`);
        console.log(`   Employee: ${reg.employee_codigo}`);
        console.log(`   Workday Date: ${reg.workday_date}`);
        console.log(`   Status: ${reg.status}`);
        console.log(`   Effective Minutes: ${reg.effective_minutes}`);
        console.log(`   Punched Minutes: ${reg.punched_minutes}`);
        console.log(`   Scheduled Minutes: ${reg.scheduled_minutes}`);
        console.log(`   Type: ${reg.regularization_type}`);
        console.log(`   Created: ${reg.created_at}`);
        console.log(`   Confirmed: ${reg.confirmed_at || 'NULL'}`);
        console.log('');
      });
    }

    // Verifică fichajes pentru 2026-01-04
    console.log('\n📋 Verifică fichajes pentru 2026-01-04:\n');
    const [fichajes] = await connection.query(`
      SELECT 
        ID,
        CODIGO,
        FECHA,
        HORA,
        TIPO,
        DURACION
      FROM Fichaje
      WHERE CODIGO = '10000001'
        AND FECHA = '2026-01-04'
      ORDER BY HORA ASC
    `);

    console.log(`Găsite ${fichajes.length} fichajes pentru 2026-01-04:\n`);
    fichajes.forEach((f, index) => {
      console.log(`${index + 1}. ${f.TIPO} - ${f.HORA} (DURACION: ${f.DURACION || 'NULL'})`);
    });

    // Test JOIN între Fichaje și FichajeRegularizacion
    console.log('\n🔍 Test JOIN între Fichaje și FichajeRegularizacion pentru 2026-01-04:\n');
    const [joinTest] = await connection.query(`
      SELECT 
        f.ID,
        f.CODIGO,
        f.FECHA,
        f.HORA,
        f.TIPO,
        f.DURACION,
        STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha_parsed,
        fr.id AS regularizacion_id,
        fr.workday_date,
        fr.status,
        fr.effective_minutes,
        CASE 
          WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL 
          THEN CONCAT(
            LPAD(FLOOR(fr.effective_minutes / 60), 2, '0'), ':',
            LPAD(fr.effective_minutes % 60, 2, '0'), ':00'
          )
          ELSE NULL
        END AS effective_duration
      FROM Fichaje f
      LEFT JOIN FichajeRegularizacion fr
        ON fr.employee_codigo = f.CODIGO
        AND fr.workday_date = STR_TO_DATE(f.FECHA, '%Y-%m-%d')
        AND fr.status = 'CONFIRMED'
      WHERE f.CODIGO = '10000001'
        AND f.FECHA = '2026-01-04'
      ORDER BY f.HORA ASC
    `);

    console.log(`Rezultate JOIN (${joinTest.length} rânduri):\n`);
    joinTest.forEach((row, index) => {
      console.log(`${index + 1}. ${row.TIPO} - ${row.HORA}`);
      console.log(`   DURACION: ${row.DURACION || 'NULL'}`);
      console.log(`   FECHA parsed: ${row.fecha_parsed}`);
      console.log(`   Regularizacion ID: ${row.regularizacion_id || 'NULL'}`);
      console.log(`   Workday Date: ${row.workday_date || 'NULL'}`);
      console.log(`   Status: ${row.status || 'NULL'}`);
      console.log(`   Effective Minutes: ${row.effective_minutes || 'NULL'}`);
      console.log(`   Effective Duration: ${row.effective_duration || 'NULL'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Eroare:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexiunea închisă');
    }
  }
}

checkRegularizacion();

