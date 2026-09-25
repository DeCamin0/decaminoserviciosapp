/**
 * Închide cereri documentos_solicitados pending unde angajatul
 * are deja un document similar în CarpetasDocumentos (ghosts).
 *
 * Uso:
 *   node scripts/run-close-solicitados-ghosts.js .env.decamino.local
 *   node scripts/run-close-solicitados-ghosts.js .env.hera.local
 *   node scripts/run-close-solicitados-ghosts.js .env.decamino.local --dry-run
 */
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const envFile = args.find((a) => !a.startsWith('--')) || '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const mysql = require('mysql2/promise');

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function typesMatch(solTipo, docTipo) {
  const a = norm(solTipo);
  const b = norm(docTipo);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // DNI variants
  if (
    (a === 'dni' || a.includes('dni')) &&
    (b === 'dni' || b.includes('dni') || b.includes('nie'))
  ) {
    return true;
  }
  // Titularidad
  if (a.includes('titular') && b.includes('titular')) return true;
  // Justificante presencia
  if (
    (a.includes('presencia') || a.includes('justificante')) &&
    (b.includes('presencia') ||
      (b.includes('justificante') && !b.includes('nomina')))
  ) {
    // Avoid matching unrelated "Justificante" too broadly for presencia-only
    if (a.includes('presencia')) {
      return b.includes('presencia') || b.includes('justificante');
    }
    if (a === 'justificante') {
      return b === 'justificante' || b.includes('justificante');
    }
  }
  return false;
}

async function run() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (!config.host || !config.user || !config.database) {
    console.error('❌ Faltan DB_HOST / DB_USERNAME / DB_NAME');
    process.exit(1);
  }

  const connection = await mysql.createConnection(config);
  console.log(
    `✅ Conectado a ${config.database} (${envFile})${dryRun ? ' [DRY-RUN]' : ''}`,
  );

  const [pendientes] = await connection.query(`
    SELECT id, empleado_id, tipo_documento, fecha_solicitud
    FROM documentos_solicitados
    WHERE estado = 'pendiente'
  `);

  console.log(`📋 Pending totales: ${pendientes.length}`);

  const byEmp = new Map();
  for (const row of pendientes) {
    const code = String(row.empleado_id);
    if (!byEmp.has(code)) byEmp.set(code, []);
    byEmp.get(code).push(row);
  }

  const toClose = [];

  for (const [empleadoId, sols] of byEmp.entries()) {
    const [docs] = await connection.query(
      `SELECT doc_id, tipo_documento, nombre_archivo, fecha_creacion
       FROM CarpetasDocumentos
       WHERE id = ?`,
      [empleadoId],
    );

    for (const sol of sols) {
      const match = (docs || []).find((d) =>
        typesMatch(sol.tipo_documento, d.tipo_documento),
      );
      if (match) {
        toClose.push({
          id: sol.id,
          empleado_id: empleadoId,
          tipo_documento: sol.tipo_documento,
          matched_tipo: match.tipo_documento,
          matched_doc_id: match.doc_id,
        });
      }
    }
  }

  console.log(`👻 Ghosts a cerrar: ${toClose.length}`);
  if (toClose.length) {
    console.table(
      toClose.slice(0, 40).map((g) => ({
        id: g.id,
        empleado: g.empleado_id,
        solicitud: g.tipo_documento,
        doc_existente: g.matched_tipo,
      })),
    );
    if (toClose.length > 40) {
      console.log(`… y ${toClose.length - 40} más`);
    }
  }

  if (!dryRun && toClose.length) {
    const ids = toClose.map((g) => g.id);
    const [result] = await connection.query(
      `UPDATE documentos_solicitados
       SET estado = 'completado',
           fecha_completado = CURRENT_TIMESTAMP
       WHERE id IN (?)
         AND estado = 'pendiente'`,
      [ids],
    );
    console.log(`✅ Cerrados: ${result.affectedRows || 0}`);
  } else if (dryRun) {
    console.log('ℹ️ DRY-RUN: no se escribió nada.');
  } else {
    console.log('ℹ️ Nada que cerrar.');
  }

  await connection.end();
}

run().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
