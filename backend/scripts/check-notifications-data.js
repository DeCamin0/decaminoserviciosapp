const mysql = require('mysql2/promise');

async function checkData() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '217.154.102.115',
    user: process.env.DB_USERNAME || 'facturacion_user',
    password: process.env.DB_PASSWORD || 'ParolaTare123!',
    database: process.env.DB_NAME || 'decamino_db',
  });

  const [rows] = await conn.query(`
    SELECT 
      id, 
      data, 
      LENGTH(data) as len, 
      data = '{}' as is_empty_json,
      data IS NULL as is_null,
      QUOTE(data) as data_quoted,
      HEX(data) as data_hex
    FROM notifications 
    ORDER BY created_at DESC 
    LIMIT 5
  `);

  console.log('=== NOTIFICATIONS DATA CHECK ===');
  rows.forEach((row, i) => {
    console.log(`\n${i + 1}. ID: ${row.id}`);
    console.log(`   data: ${row.data}`);
    console.log(`   length: ${row.len}`);
    console.log(`   is_empty_json: ${row.is_empty_json}`);
    console.log(`   is_null: ${row.is_null}`);
    console.log(`   quoted: ${row.data_quoted}`);
    console.log(`   hex: ${row.data_hex}`);
  });

  await conn.end();
}

checkData().catch(console.error);
