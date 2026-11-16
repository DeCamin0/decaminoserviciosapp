/**
 * Plasa de siguranta pentru codul comun DeCamino / HERA.
 * Opreste doar segmente care chiar invoca o comanda periculoasa.
 * Daca textul doar mentioneaza comanda, sau daca scriptul esueaza,
 * lasa executia sa treaca. Nu este singura protectie.
 */
const fs = require('fs');

const PROJECT = 'decaminoserviciosapp';

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function deny(why) {
  const text =
    'Oprit de plasa decaminoserviciosapp: ' +
    why +
    ' DeCamino si HERA folosesc acelasi cod. Nu rula comanda fara aprobare explicita. Plasa nu acopera toate variantele.';
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      user_message: text,
      agent_message: text,
    }),
  );
  process.exit(2);
}

function inProject(command, cwd) {
  const blob = `${cwd}\n${command}`.replace(/\\/g, '/').toLowerCase();
  return blob.includes(PROJECT);
}

function segments(command) {
  return command
    .split(/\r?\n|&&|\|\||;|\|/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalize(segment) {
  let s = segment.trim();
  s = s.replace(/^[&\s]+/, '');
  while (/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/.test(s)) {
    s = s.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, '');
  }
  s = s.replace(/^(?:sudo|cmd(?:\.exe)?\s+\/c)\s+/i, '');
  return s.trim();
}

function reason(segment) {
  const s = normalize(segment);
  const body = s.replace(
    /^(?:npx|bunx)(?:\.cmd|\.exe)?\s+|^(?:pnpm|yarn)(?:\.cmd)?(?:\s+(?:exec|dlx))?\s+|^(?:npm(?:\.cmd)?\s+exec)\s+/i,
    '',
  );

  if (
    /^prisma(?:@[\w.-]+)?(?:\.cmd|\.exe)?\s+migrate\s+(dev|deploy|reset|resolve)\b/i.test(
      body,
    )
  ) {
    return 'Prisma migrate scrie schema in baza.';
  }
  if (
    /^prisma(?:@[\w.-]+)?(?:\.cmd|\.exe)?\s+db\s+(push|execute)\b/i.test(body)
  ) {
    return 'Prisma db push/execute scrie in baza.';
  }
  if (
    /^node(?:\.exe|\.cmd)?\s+\S*run-[^\s"']*migration\.js\b/i.test(body)
  ) {
    return 'Scriptul de migrare scrie in baza.';
  }
  if (/^git(?:\.exe)?\s+push\b/i.test(s)) {
    return 'git push nu pleaca fara cerere explicita.';
  }
  if (/^git(?:\.exe)?\s+reset\s+--hard\b/i.test(s)) {
    return 'git reset --hard sterge lucrul local.';
  }
  if (/^(?:mysql|mariadb|mysqladmin)(?:\.exe)?(?:\s|$)/i.test(s)) {
    return 'Clientul SQL poate scrie in DeCamino sau HERA.';
  }
  return null;
}

function main() {
  let parsed;
  try {
    parsed = JSON.parse(readStdin() || '{}');
  } catch {
    allow();
    return;
  }

  const command = String(parsed.command || parsed.cmd || '');
  const cwd = String(
    parsed.cwd || parsed.working_directory || parsed.workingDirectory || '',
  );

  if (!command.trim() || !inProject(command, cwd)) {
    allow();
    return;
  }

  for (const segment of segments(command)) {
    const why = reason(segment);
    if (why) {
      deny(why);
      return;
    }
  }

  allow();
}

main();
