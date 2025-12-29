const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function executeMigration() {
  let connection;

  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '217.154.102.115',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || 'facturacion_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'decamino_db',
      multipleStatements: true,
    });

    console.log('✅ Conectado a la base de datos');

    // Leer el archivo SQL de migración
    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/20251228125301_add_convenios_system/migration.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando migración...');

    // Ejecutar la migración completa de una vez (mejor para CREATE TABLE con FOREIGN KEY)
    try {
      await connection.query(sql);
      console.log('✅ Migración SQL ejecutada exitosamente');
    } catch (error) {
      // Si falla, intentar ejecutar sentencia por sentencia
      console.log('⚠️  Error en ejecución completa, intentando sentencia por sentencia...');
      
      // Dividir por punto y coma, pero mantener comentarios y múltiples líneas
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.match(/^--/));

      for (const statement of statements) {
        if (statement.trim() && !statement.match(/^--/)) {
          try {
            await connection.execute(statement + ';');
            console.log(`✅ Ejecutado: ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
          } catch (error) {
            // Ignorar errores de "ya existe" para tablas e índices
            if (
              error.message.includes('already exists') ||
              error.message.includes('Duplicate key') ||
              error.message.includes('Duplicate entry')
            ) {
              console.log(`⚠️  Ya existe: ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
            } else {
              console.error(`❌ Error en: ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
              console.error(`   Mensaje: ${error.message}`);
              // Continuar con la siguiente sentencia
            }
          }
        }
      }
    }

    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

executeMigration();

