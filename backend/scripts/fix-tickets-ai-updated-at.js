/**
 * Aliniază tickets_ai.updated_at cu Decamino.
 *   node scripts/fix-tickets-ai-updated-at.js .env.hera.local
 *   node scripts/fix-tickets-ai-updated-at.js .env.decamino.local
 */
const path = require('path');
const fs = require('fs');

const envArg = process.argv[2] || '.env';
const envPath = path.isAbsolute(envArg)
  ? envArg
  : path.join(__dirname, '..', envArg);
if (!fs.existsSync(envPath)) {
  console.error('No existe:', envPath);
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq <= 0) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}
console.log('Env:', envPath);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const before = await prisma.$queryRawUnsafe(
    "SHOW COLUMNS FROM tickets_ai LIKE 'updated_at'",
  );
  console.log('before:', JSON.stringify(before[0] || null));

  await prisma.$executeRawUnsafe(`
    ALTER TABLE tickets_ai
      MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `);

  const after = await prisma.$queryRawUnsafe(
    "SHOW COLUMNS FROM tickets_ai LIKE 'updated_at'",
  );
  console.log('after:', JSON.stringify(after[0] || null));
  await prisma.$disconnect();
  console.log('✅ OK');
}

run().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
