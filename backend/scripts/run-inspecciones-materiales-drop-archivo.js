/**
 * DROP archivo on InspeccionesDocumentos + MaterialesDocumentos after R2 backfill.
 * Note: InspeccionesDocumentos.storage_key stays NULLABLE (solicitudes without PDF).
 *
 * Usage: node scripts/run-inspecciones-materiales-drop-archivo.js .env.decamino.local
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.decamino.local';
const envPath = path.resolve(__dirname, '..', envFile);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv(envPath);

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function dropArchivo(conn, table, { requireKeyOnBlobRowsOnly }) {
  console.log('---', table);
  if (!(await columnExists(conn, table, 'archivo'))) {
    console.log('archivo already dropped');
    return;
  }

  const [withBlob] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`archivo\` IS NOT NULL`,
  );
  const blobCount = Number(withBlob[0]?.c || 0);
  console.log('rows with archivo blob:', blobCount);

  if (requireKeyOnBlobRowsOnly) {
    const [blobNoKey] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`${table}\`
       WHERE \`archivo\` IS NOT NULL
         AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
    );
    const n = Number(blobNoKey[0]?.c || 0);
    console.log('blob rows without storage_key:', n);
    if (blobCount > 0 || n > 0) {
      throw new Error(
        `ABORT ${table}: backfill incomplete (blob=${blobCount}, blobNoKey=${n})`,
      );
    }
  } else {
    const [noKey] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`${table}\`
       WHERE \`storage_key\` IS NULL OR \`storage_key\` = ''`,
    );
    const noKeyCount = Number(noKey[0]?.c || 0);
    console.log('rows without storage_key:', noKeyCount);
    if (blobCount > 0 || noKeyCount > 0) {
      throw new Error(
        `ABORT ${table}: backfill incomplete (blob=${blobCount}, noKey=${noKeyCount})`,
      );
    }
  }

  await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`archivo\``);
  console.log('Dropped archivo');

  if (!requireKeyOnBlobRowsOnly) {
    await conn.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`storage_key\` VARCHAR(700) NOT NULL`,
    );
    console.log('storage_key NOT NULL');
  } else {
    console.log('storage_key stays NULLABLE (solicitudes without PDF)');
  }
}

async function main() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  if (!config.host || !config.user || !config.database) {
    console.error('Missing DB_*');
    process.exit(1);
  }
  const conn = await mysql.createConnection(config);
  console.log('Connected to', config.database);

  // Solicitudes: no PDF → storage_key NULL allowed
  await dropArchivo(conn, 'InspeccionesDocumentos', {
    requireKeyOnBlobRowsOnly: true,
  });
  // Materiales: every row with file must have key; after backfill set NOT NULL
  await dropArchivo(conn, 'MaterialesDocumentos', {
    requireKeyOnBlobRowsOnly: false,
  });

  await conn.end();
  console.log('OK:', config.database);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
