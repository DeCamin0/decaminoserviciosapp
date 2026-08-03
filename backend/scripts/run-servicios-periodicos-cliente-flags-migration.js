/**
 * Añade servicios_periodicos en clientes + tabla servicios_periodicos_cliente_tipos.
 * Usage:
 *   node scripts/run-servicios-periodicos-cliente-flags-migration.js .env.decamino.local
 *   node scripts/run-servicios-periodicos-cliente-flags-migration.js .env.client2
 */
const path = require('path');

const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');

async function columnExists(connection, database, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [database, table, column],
  );
  return rows.length > 0;
}

async function tableExists(connection, database, table) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [database, table],
  );
  return rows.length > 0;
}

async function runMigration() {
  let connection;
  try {
    const config = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    };

    if (!config.host || !config.user || !config.database) {
      console.error('Missing DB_HOST, DB_USERNAME or DB_NAME.');
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log('Connected to', config.database, 'at', config.host);

    const clientesTable = 'Clientes';

    const hasCol = await columnExists(
      connection,
      config.database,
      clientesTable,
      'servicios_periodicos',
    );
    if (!hasCol) {
      await connection.query(
        `ALTER TABLE \`${clientesTable}\`
         ADD COLUMN \`servicios_periodicos\` TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log(`Column ${clientesTable}.servicios_periodicos added.`);
    } else {
      console.log(`Column ${clientesTable}.servicios_periodicos already exists — OK.`);
    }

    const hasTable = await tableExists(
      connection,
      config.database,
      'servicios_periodicos_cliente_tipos',
    );
    if (!hasTable) {
      await connection.query(`
        CREATE TABLE \`servicios_periodicos_cliente_tipos\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`cliente_id\` INT NOT NULL,
          \`tipo_id\` INT NOT NULL,
          \`creado_en\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_sp_cli_tipo\` (\`cliente_id\`, \`tipo_id\`),
          INDEX \`idx_sp_cli_tipo_cliente\` (\`cliente_id\`),
          INDEX \`idx_sp_cli_tipo_tipo\` (\`tipo_id\`),
          CONSTRAINT \`fk_sp_cli_tipo_cliente\` FOREIGN KEY (\`cliente_id\`) REFERENCES \`${clientesTable}\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT,
          CONSTRAINT \`fk_sp_cli_tipo_tipo\` FOREIGN KEY (\`tipo_id\`) REFERENCES \`servicios_periodicos_tipos\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Table servicios_periodicos_cliente_tipos created.');
    } else {
      console.log('Table servicios_periodicos_cliente_tipos already exists — OK.');
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message || error);
    if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
