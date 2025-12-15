/**
 * Script pentru crearea tabelului push_subscriptions în baza de date
 * Rulează: node scripts/create-push-subscriptions-table.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function createPushSubscriptionsTable() {
  const config = {
    host: process.env.DB_HOST || '217.154.102.115',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'facturacion_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'decamino_db',
  };

  console.log('🔌 Conectându-se la baza de date...');
  console.log('   Host:', config.host);
  console.log('   Database:', config.database);
  console.log('   User:', config.user);

  const connection = await mysql.createConnection(config);

  try {
    console.log('✅ Conectat la baza de date!');
    console.log('🔨 Creând tabelul push_subscriptions...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_push_subscription_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.query(createTableSQL);
    console.log('✅ Tabelul push_subscriptions a fost creat cu succes!');
    
    // Verifică dacă tabelul există
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'push_subscriptions'"
    );
    
    if (tables.length > 0) {
      console.log('✅ Verificare: Tabelul push_subscriptions există în baza de date!');
    }
  } catch (error) {
    console.error('❌ Eroare la crearea tabelului:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  Tabelul există deja.');
    }
    throw error;
  } finally {
    await connection.end();
    console.log('🔌 Conexiunea închisă.');
  }
}

// Rulează scriptul
createPushSubscriptionsTable()
  .then(() => {
    console.log('✅ Script finalizat cu succes');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script eșuat:', error);
    process.exit(1);
  });

