/**
 * Inventory remaining BLOB / base64 LongText still in MariaDB (R2 backlog).
 * Usage: node scripts/inventory-remaining-blobs.js [.env.decamino.local] [.env.hera.local]
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

function loadEnv(envRel) {
  const env = {};
  const filePath = path.resolve(__dirname, '..', envRel);
  if (!fs.existsSync(filePath)) {
    console.error('Missing env file', envRel);
    process.exit(1);
  }
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
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

async function invent(envRel) {
  const env = loadEnv(envRel);
  const cfg = {
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
  const c = await mysql.createConnection(cfg);
  console.log('\n========', cfg.database, `(${envRel})`, '========');

  const [cols] = await c.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND DATA_TYPE IN ('blob','mediumblob','longblob','tinyblob')
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  console.log('BLOB columns:', cols.length);

  const rows = [];
  for (const col of cols) {
    const t = col.TABLE_NAME;
    const coln = col.COLUMN_NAME;
    try {
      const [r] = await c.query(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN \`${coln}\` IS NOT NULL THEN 1 ELSE 0 END) AS with_blob,
          COALESCE(SUM(CASE WHEN \`${coln}\` IS NOT NULL THEN LENGTH(\`${coln}\`) ELSE 0 END),0) AS bytes
         FROM \`${t}\``,
      );
      const [sk] = await c.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME IN ('storage_key','storage_key_original','storage_key_firmado','firma_imagen_storage_key')`,
        [t],
      );
      rows.push({
        t,
        coln,
        type: col.COLUMN_TYPE,
        total: Number(r[0].total || 0),
        withBlob: Number(r[0].with_blob || 0),
        bytes: Number(r[0].bytes || 0),
        hasKey: Number(sk[0].c) > 0,
      });
    } catch (e) {
      rows.push({ t, coln, type: col.COLUMN_TYPE, error: String(e.message).slice(0, 100) });
    }
  }

  rows.sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  console.log('\n--- BLOBs with data (by size) ---');
  let totalMb = 0;
  for (const r of rows) {
    if (r.error) {
      console.log(`ERR ${r.t}.${r.coln}: ${r.error}`);
      continue;
    }
    const mb = r.bytes / 1024 / 1024;
    totalMb += mb;
    if (r.withBlob === 0) continue;
    console.log(
      `${mb.toFixed(2).padStart(8)} MB | ${String(r.withBlob).padStart(5)}/${r.total} rows | key=${r.hasKey ? 'Y' : 'N'} | ${r.t}.${r.coln}`,
    );
  }
  console.log(`TOTAL blob payload still in DB: ${totalMb.toFixed(2)} MB`);

  console.log('\n--- Empty BLOB columns (already 0) ---');
  for (const r of rows.filter((x) => !x.error && x.withBlob === 0)) {
    console.log(`  ${r.t}.${r.coln} | key=${r.hasKey ? 'Y' : 'N'}`);
  }

  const [lt] = await c.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'longtext'
       AND (
         COLUMN_NAME LIKE '%base64%' OR COLUMN_NAME LIKE '%archivo%'
         OR COLUMN_NAME LIKE '%firma%' OR COLUMN_NAME LIKE '%pdf%'
         OR COLUMN_NAME LIKE '%image%' OR COLUMN_NAME LIKE '%CONTRACTO%'
       )
     ORDER BY TABLE_NAME`,
  );
  console.log('\n--- LongText file-like (non-empty) ---');
  for (const col of lt) {
    const t = col.TABLE_NAME;
    const coln = col.COLUMN_NAME;
    try {
      const [r] = await c.query(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN \`${coln}\` IS NOT NULL AND TRIM(\`${coln}\`) <> '' THEN 1 ELSE 0 END) AS with_data,
          COALESCE(SUM(CASE WHEN \`${coln}\` IS NOT NULL THEN LENGTH(\`${coln}\`) ELSE 0 END),0) AS bytes
         FROM \`${t}\``,
      );
      const withData = Number(r[0].with_data || 0);
      const mb = Number(r[0].bytes || 0) / 1024 / 1024;
      if (withData > 0) {
        console.log(
          `${mb.toFixed(2).padStart(8)} MB | ${withData}/${r[0].total} rows | ${t}.${coln}`,
        );
      }
    } catch (e) {
      console.log(`ERR ${t}.${coln}: ${String(e.message).slice(0, 80)}`);
    }
  }

  await c.end();
}

async function main() {
  const args = process.argv.slice(2);
  const files =
    args.length > 0 ? args : ['.env.decamino.local', '.env.hera.local'];
  for (const f of files) {
    await invent(f);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
