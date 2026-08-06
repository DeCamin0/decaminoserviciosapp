/**
 * After pedidos-notas R2 backfill: clear ruta_archivo and optionally delete disk files.
 *
 * Safety:
 * - Aborts if any row still has ruta_archivo without storage_key
 * - --delete-files removes files under uploads/pedidos-notas/ referenced by rows
 * - --clear-ruta sets ruta_archivo NULL for rows that already have storage_key
 *
 * Usage:
 *   node scripts/run-pedidos-notas-stop-disk.js .env.decamino.local --dry-run
 *   node scripts/run-pedidos-notas-stop-disk.js .env.decamino.local --clear-ruta
 *   node scripts/run-pedidos-notas-stop-disk.js .env.decamino.local --clear-ruta --delete-files
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const backendDir = path.join(__dirname, '..');
const uploadsDir = path.join(backendDir, 'uploads', 'pedidos-notas');

const envFile = process.argv[2] || '.env.decamino.local';
const envPath = path.resolve(backendDir, envFile);
const flags = {
  dryRun: process.argv.includes('--dry-run'),
  clearRuta: process.argv.includes('--clear-ruta'),
  deleteFiles: process.argv.includes('--delete-files'),
};

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

function resolveDiskPath(rutaArchivo) {
  const ruta = String(rutaArchivo || '').trim();
  if (!ruta) return null;
  const fileName = path.basename(ruta);
  if (!fileName || fileName === '.' || fileName === '..') return null;
  return path.join(uploadsDir, fileName);
}

async function main() {
  console.log('[pedidos-notas-stop-disk] env:', envFile);
  console.log('[pedidos-notas-stop-disk] dry-run:', flags.dryRun);
  console.log('[pedidos-notas-stop-disk] clear-ruta:', flags.clearRuta);
  console.log('[pedidos-notas-stop-disk] delete-files:', flags.deleteFiles);

  if (!flags.clearRuta && !flags.deleteFiles) {
    console.error(
      'Specify --clear-ruta and/or --delete-files (add --dry-run to preview).',
    );
    process.exit(1);
  }

  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  if (!config.host || !config.user || !config.database) {
    console.error('Missing DB_* in', envFile);
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  console.log('Connected to', config.database);

  const [withoutKey] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`pedidos_notas_imagen\`
     WHERE \`ruta_archivo\` IS NOT NULL
       AND \`ruta_archivo\` <> ''
       AND (\`storage_key\` IS NULL OR \`storage_key\` = '')`,
  );
  const noKeyCount = Number(withoutKey[0]?.c || 0);
  console.log('disk rows without storage_key:', noKeyCount);

  if (noKeyCount > 0) {
    console.error(
      'ABORT: run backfill first (all disk rows need storage_key before stop-disk).',
    );
    await conn.end();
    process.exit(1);
  }

  const [rows] = await conn.query(
    `SELECT \`id\`, \`ruta_archivo\`, \`storage_key\`
     FROM \`pedidos_notas_imagen\`
     WHERE \`ruta_archivo\` IS NOT NULL AND \`ruta_archivo\` <> ''`,
  );
  console.log('rows with ruta_archivo:', rows.length);

  let deletedFiles = 0;
  let cleared = 0;
  let missingFiles = 0;

  for (const row of rows) {
    if (flags.deleteFiles) {
      const diskPath = resolveDiskPath(row.ruta_archivo);
      if (diskPath && fs.existsSync(diskPath)) {
        if (flags.dryRun) {
          console.log(`[dry-run] delete file ${diskPath}`);
        } else {
          fs.unlinkSync(diskPath);
          console.log(`[deleted] ${diskPath}`);
        }
        deletedFiles += 1;
      } else {
        missingFiles += 1;
      }
    }
  }

  if (flags.clearRuta) {
    if (flags.dryRun) {
      console.log(`[dry-run] would clear ruta_archivo on ${rows.length} rows`);
      cleared = rows.length;
    } else {
      const [result] = await conn.query(
        `UPDATE \`pedidos_notas_imagen\`
         SET \`ruta_archivo\` = NULL
         WHERE \`ruta_archivo\` IS NOT NULL
           AND \`ruta_archivo\` <> ''
           AND \`storage_key\` IS NOT NULL
           AND \`storage_key\` <> ''`,
      );
      cleared = Number(result.affectedRows || 0);
      console.log('cleared ruta_archivo rows:', cleared);
    }
  }

  await conn.end();
  console.log(
    `[pedidos-notas-stop-disk] done cleared=${cleared} deletedFiles=${deletedFiles} missingFiles=${missingFiles}`,
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
