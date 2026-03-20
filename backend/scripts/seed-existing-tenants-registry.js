/**
 * Adaugă în tabela `tenants` instanțele deja existente (ex. decamino_db, hera_facility_db)
 * fără CREATE DATABASE — doar registry pentru panoul super-admin.
 *
 * Idempotent: UNIQUE(slug) → ON DUPLICATE KEY UPDATE.
 *
 * Usage (din folder backend):
 *   node scripts/seed-existing-tenants-registry.js .env.decamino.local
 *   node scripts/seed-existing-tenants-registry.js .env.hera.local
 *
 * Sau ambele:
 *   npm run db:seed-existing-tenants
 */
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/** UUID fix per slug ca INSERT-ul să fie idempotent pe `id` dacă e nevoie */
const SLUG_FIXED_ID = {
  decamino: 'a1000000-0000-4000-8000-0000000000d1',
  hera: 'a2000000-0000-4000-8000-0000000000h1',
};

function parseMysqlUrl(urlStr) {
  const u = new URL(urlStr);
  if (!u.protocol.startsWith('mysql')) {
    throw new Error('TENANT_REGISTRY_DATABASE_URL must start with mysql://');
  }
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  if (!database) {
    throw new Error('TENANT_REGISTRY_DATABASE_URL must include database in path');
  }
  return {
    host: u.hostname,
    port: parseInt(u.port || '3306', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}

function encryptDbPassword(plain, keyHex) {
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error('TENANT_DB_PASSWORD_ENCRYPTION_KEY must be 64 hex chars');
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function slugFromDbName(dbName) {
  const d = String(dbName || '').toLowerCase();
  if (d.includes('hera')) return 'hera';
  if (d.includes('decamino')) return 'decamino';
  return d.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 24) || 'tenant';
}

async function main() {
  const envRel = process.argv[2] || '.env.decamino.local';
  const envFile = path.resolve(process.cwd(), envRel);
  require('dotenv').config({ path: envFile });

  const registryUrl = process.env.TENANT_REGISTRY_DATABASE_URL?.trim();
  const keyHex = process.env.TENANT_DB_PASSWORD_ENCRYPTION_KEY?.trim();
  const dbName = process.env.DB_NAME?.trim();
  const dbUser = process.env.DB_USERNAME?.trim();
  const dbPass = process.env.DB_PASSWORD ?? '';
  const companyName = (
    process.env.COMPANY_LEGAL_NAME ||
    process.env.COMPANY_NAME ||
    dbName
  ).trim();

  if (!registryUrl) {
    console.error('Lipsește TENANT_REGISTRY_DATABASE_URL în', envFile);
    process.exit(1);
  }
  if (!dbName || !dbUser) {
    console.error('Lipsește DB_NAME sau DB_USERNAME în', envFile);
    process.exit(1);
  }

  const slug = slugFromDbName(dbName);
  const id = SLUG_FIXED_ID[slug] || crypto.randomUUID();

  const passwordEnc = encryptDbPassword(dbPass, keyHex);
  const cfg = parseMysqlUrl(registryUrl);
  const conn = await mysql.createConnection(cfg);

  const notes =
    'Instanță existentă (creată înainte de panoul de provisioning). Nu s-a rulat CREATE DATABASE din wizard.';

  await conn.execute(
    `INSERT INTO tenants (
      id, name, slug, timezone, notes, plan, database_name, database_user, database_password_enc, status, last_error
    ) VALUES (?, ?, ?, 'Europe/Madrid', ?, NULL, ?, ?, ?, 'active', NULL)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      database_name = VALUES(database_name),
      database_user = VALUES(database_user),
      database_password_enc = VALUES(database_password_enc),
      status = 'active',
      last_error = NULL,
      notes = VALUES(notes),
      updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      companyName,
      slug,
      notes,
      dbName,
      dbUser,
      passwordEnc,
    ],
  );

  console.log(
    `OK: tenant registry — slug="${slug}" → DB "${dbName}" (din ${path.basename(envFile)})`,
  );
  await conn.end();
}

main().catch((e) => {
  console.error('Eroare:', e.message);
  process.exit(1);
});
