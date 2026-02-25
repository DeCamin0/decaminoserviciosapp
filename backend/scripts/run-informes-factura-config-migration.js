/**
 * Crea la tabla informes_factura_config y el registro por defecto.
 * Ejecutar desde backend: node scripts/run-informes-factura-config-migration.js
 */
require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.log('Conectado a la base de datos');

    const migrationPath = path.join(__dirname, '../prisma/migrations/20250224000000_add_informes_factura_config/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando migración informes_factura_config...');

    await connection.query(sql);

    console.log('Migración ejecutada correctamente. Tabla informes_factura_config creada.');
  } catch (error) {
    const alreadyExists = error.errno === 1050 || error.code === 'ER_TABLE_EXISTS_ERROR' || (error.message && error.message.includes('already exists'));
    if (alreadyExists) {
      console.log('La tabla informes_factura_config ya existe. Nada que hacer.');
      process.exit(0);
      return;
    }
    console.error('Error en la migración:', error.message);
    if (error.sql) console.error('SQL:', error.sql);
    if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexión cerrada');
    }
  }
}

runMigration();
