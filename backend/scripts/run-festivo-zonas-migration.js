/**
 * Zone de festivo local + alegerea zilei pentru cine nu are centru.
 *
 *   node scripts/run-festivo-zonas-migration.js .env.hera.local
 *   node scripts/run-festivo-zonas-migration.js .env.decamino.local
 */
const path = require('path');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.hera.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(conn, table, index) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.length > 0;
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  console.log('DB', process.env.DB_NAME);

  if (!(await columnExists(conn, 'fiestas', 'municipio_ine'))) {
    await conn.query(
      `ALTER TABLE \`fiestas\`
         ADD COLUMN \`municipio_ine\` VARCHAR(10) NOT NULL DEFAULT '' AFTER \`ccaa_code\`,
         ADD COLUMN \`municipio_nombre\` VARCHAR(160) NULL AFTER \`municipio_ine\``,
    );
    console.log('fiestas: columnas municipio');
  } else {
    console.log('fiestas: columnas municipio ya existen');
  }

  const hasNewUnique = await indexExists(conn, 'fiestas', 'uniq_f');
  if (hasNewUnique) {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiestas' AND INDEX_NAME = 'uniq_f'
       ORDER BY SEQ_IN_INDEX`,
    );
    const names = cols.map((row) => row.COLUMN_NAME).join(',');
    if (names !== 'date,scope,ccaa_code,municipio_ine') {
      await conn.query('ALTER TABLE `fiestas` DROP INDEX `uniq_f`');
      await conn.query(
        'CREATE UNIQUE INDEX `uniq_f` ON `fiestas` (`date`, `scope`, `ccaa_code`, `municipio_ine`)',
      );
      console.log('uniq_f recreado');
    } else {
      console.log('uniq_f ya incluye municipio');
    }
  } else {
    await conn.query(
      'CREATE UNIQUE INDEX `uniq_f` ON `fiestas` (`date`, `scope`, `ccaa_code`, `municipio_ine`)',
    );
    console.log('uniq_f creado');
  }

  if (!(await tableExists(conn, 'festivo_zonas'))) {
    await conn.query(`
      CREATE TABLE \`festivo_zonas\` (
        \`ine\` VARCHAR(10) NOT NULL,
        \`slug\` VARCHAR(120) NOT NULL,
        \`nombre\` VARCHAR(160) NOT NULL,
        \`ccaa_slug\` VARCHAR(20) NOT NULL DEFAULT 'mad',
        \`provincia_slug\` VARCHAR(40) NOT NULL DEFAULT 'madrid',
        \`ccaa_code\` VARCHAR(10) NOT NULL DEFAULT 'ES-MD',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`ine\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('festivo_zonas creada');
  } else {
    console.log('festivo_zonas ya existe');
  }

  if (!(await tableExists(conn, 'fichaje_zona_dia'))) {
    await conn.query(`
      CREATE TABLE \`fichaje_zona_dia\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`codigo\` VARCHAR(50) NOT NULL,
        \`fecha\` DATE NOT NULL,
        \`municipio_ine\` VARCHAR(10) NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_fichaje_zona_dia\` (\`codigo\`, \`fecha\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('fichaje_zona_dia creada');
  } else {
    console.log('fichaje_zona_dia ya existe');
  }

  await conn.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
