/**
 * Centre extra pe angajat (horario), pe lângă CENTRO TRABAJO.
 *
 *   node scripts/run-empleado-centros-migration.js .env.decamino.local
 *   node scripts/run-empleado-centros-migration.js .env.hera.local
 */
const path = require('path');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

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
  });
  console.log('DB', process.env.DB_NAME);

  if (!(await tableExists(conn, 'empleado_centros'))) {
    await conn.query(`
      CREATE TABLE empleado_centros (
        id INT NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(50) NOT NULL,
        centro VARCHAR(300) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_empleado_centro (codigo, centro)
      )
    `);
    console.log('empleado_centros creada');
  } else {
    console.log('empleado_centros ya existe');
  }

  if (!(await tableExists(conn, 'fichaje_centro_dia'))) {
    await conn.query(`
      CREATE TABLE fichaje_centro_dia (
        id INT NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(50) NOT NULL,
        fecha DATE NOT NULL,
        centro VARCHAR(300) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_fichaje_centro_dia (codigo, fecha)
      )
    `);
    console.log('fichaje_centro_dia creada');
  } else {
    console.log('fichaje_centro_dia ya existe');
  }

  await conn.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
