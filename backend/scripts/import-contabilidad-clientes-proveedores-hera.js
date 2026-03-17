/**
 * Importă Clientes și Proveedores din Exportacion_contabilidad_2026-1T.xlsx în HERA.
 * Excel: sheet "Clientes" și "Proveedores", header la rândul 4, date de la rândul 5.
 *
 * Rulare: node scripts/import-contabilidad-clientes-proveedores-hera.js [cale.xlsx]
 * Default: Exportacion_contabilidad_2026-1T.xlsx din root proiect.
 *
 * Cerințe: .env.client2.local cu DB_NAME=hera_facility_db, tabele Clientes și Proveedores există.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

const backendDir = path.join(__dirname, '..');
const rootDir = path.join(backendDir, '..');
const defaultPath = path.join(rootDir, 'Exportacion_contabilidad_2026-1T.xlsx');
const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

function loadEnv(envFile) {
  const envPath = path.join(backendDir, envFile);
  if (!fs.existsSync(envPath)) return null;
  const env = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const eq = t.indexOf('=');
      if (eq > 0) {
        const key = t.slice(0, eq).trim();
        let value = t.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
          value = value.slice(1, -1);
        env[key] = value;
      }
    }
  });
  return env;
}

function toStr(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v.text) return String(v.text).trim() || null;
  if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim() || null;
  if (v instanceof Date) return v.toISOString ? v.toISOString().slice(0, 10) : String(v);
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Mapează rând Excel la obiect folosind headerRow (array de nume coloane) */
function rowToRecord(rowCells, headerRow, colMap) {
  const rec = {};
  headerRow.forEach((colName, i) => {
    if (!colName) return;
    const key = colMap[colName] || colName;
    const raw = rowCells[i];
    if (key === 'DESCUENTO_POR_DEFECTO' || key === '% DESCUENTO POR DEFECTO') {
      rec[key] = toNum(raw);
    } else {
      rec[key] = toStr(raw);
    }
  });
  return rec;
}

// Excel col 4 (header) -> nume câmp pentru Clientes
const CLIENTES_HEADER_MAP = {
  'NIF': 'NIF',
  'NOMBRE O RAZÓN SOCIAL': 'NOMBRE_O_RAZON_SOCIAL',
  'EMAIL': 'EMAIL',
  'TELF.': 'TELEFONO',
  'MÓVIL': 'MOVIL',
  'FAX': 'FAX',
  'DIRECCIÓN': 'DIRECCION',
  'COD. POSTAL': 'CODIGO_POSTAL',
  'POBLACIÓN': 'POBLACION',
  'PROVINCIA': 'PROVINCIA',
  'PAÍS': 'PAIS',
  'URL': 'URL',
  '% DESCUENTO POR DEFECTO': 'DESCUENTO_POR_DEFECTO',
  'LATITUD': 'LATITUD',
  'LONGITUD': 'LONGITUD',
  'NOTAS PRIVADAS': 'NOTAS_PRIVADAS',
  'Personalizado1': 'Personalizado1',
  'Personalizado2': 'Personalizado2',
};

// La fel pentru Proveedores (aceleași nume de coloane în Excel)
const PROVEEDORES_HEADER_MAP = { ...CLIENTES_HEADER_MAP };

async function main() {
  const envHera = loadEnv('.env.client2.local');
  if (!envHera || envHera.DB_NAME !== 'hera_facility_db') {
    console.error('❌ .env.client2.local lipsește sau DB_NAME nu e hera_facility_db.');
    process.exit(1);
  }

  if (!fs.existsSync(xlsxPath)) {
    console.error('❌ Fișier negăsit:', xlsxPath);
    process.exit(1);
  }

  const config = {
    host: envHera.DB_HOST,
    port: parseInt(envHera.DB_PORT || '3306', 10),
    user: envHera.DB_USERNAME,
    password: envHera.DB_PASSWORD || '',
    database: envHera.DB_NAME,
    charset: 'utf8mb4',
  };

  console.log('📂 Excel:', xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const conn = await mysql.createConnection(config);
  console.log('🔗 Conectat la HERA', config.host);

  // ---- Clientes ----
  const sheetClientes = workbook.getWorksheet('Clientes');
  if (sheetClientes) {
    const headerRowIndex = 4;
    const headerCells = [];
    const headerRow = sheetClientes.getRow(headerRowIndex);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headerCells[colNumber - 1] = toStr(cell.value) || '';
    });
    const clientesRows = [];
    for (let r = headerRowIndex + 1; r <= sheetClientes.rowCount; r++) {
      const row = sheetClientes.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cell.value;
      });
      const rec = rowToRecord(cells, headerCells, CLIENTES_HEADER_MAP);
      const nif = rec.NIF;
      const nombre = rec.NOMBRE_O_RAZON_SOCIAL;
      if (!nif && !nombre) continue;
      clientesRows.push(rec);
    }

    console.log('\n📋 Clientes de importat:', clientesRows.length);
    let clientesOk = 0, clientesErr = 0;
    for (const r of clientesRows) {
      const nif = r.NIF || null;
      const nombre = r.NOMBRE_O_RAZON_SOCIAL || null;
      if (!nif && !nombre) continue;
      try {
        const [existing] = await conn.query('SELECT id FROM Clientes WHERE NIF = ? LIMIT 1', [nif || '']);
        if (existing && existing.length > 0) {
          await conn.query(
            `UPDATE Clientes SET
              \`NOMBRE O RAZON SOCIAL\` = COALESCE(?, \`NOMBRE O RAZON SOCIAL\`),
              EMAIL = COALESCE(?, EMAIL),
              TELEFONO = COALESCE(?, TELEFONO),
              MOVIL = COALESCE(?, MOVIL),
              FAX = COALESCE(?, FAX),
              DIRECCION = COALESCE(?, DIRECCION),
              \`CODIGO POSTAL\` = COALESCE(?, \`CODIGO POSTAL\`),
              POBLACION = COALESCE(?, POBLACION),
              PROVINCIA = COALESCE(?, PROVINCIA),
              PAIS = COALESCE(?, PAIS),
              URL = COALESCE(?, URL),
              \`DESCUENTO POR DEFECTO\` = COALESCE(?, \`DESCUENTO POR DEFECTO\`),
              LATITUD = COALESCE(?, LATITUD),
              LONGITUD = COALESCE(?, LONGITUD),
              \`NOTAS PRIVADAS\` = COALESCE(?, \`NOTAS PRIVADAS\`)
            WHERE NIF = ?`,
            [
              nombre, r.EMAIL, r.TELEFONO, r.MOVIL, r.FAX, r.DIRECCION, r.CODIGO_POSTAL,
              r.POBLACION, r.PROVINCIA, r.PAIS, r.URL, r.DESCUENTO_POR_DEFECTO,
              r.LATITUD, r.LONGITUD, r.NOTAS_PRIVADAS, nif || ''
            ]
          );
        } else {
          await conn.query(
            `INSERT INTO Clientes (NIF, \`NOMBRE O RAZON SOCIAL\`, EMAIL, TELEFONO, MOVIL, FAX, DIRECCION, \`CODIGO POSTAL\`, POBLACION, PROVINCIA, PAIS, URL, \`DESCUENTO POR DEFECTO\`, LATITUD, LONGITUD, \`NOTAS PRIVADAS\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nif, nombre, r.EMAIL, r.TELEFONO, r.MOVIL, r.FAX, r.DIRECCION, r.CODIGO_POSTAL,
              r.POBLACION, r.PROVINCIA, r.PAIS, r.URL, r.DESCUENTO_POR_DEFECTO,
              r.LATITUD, r.LONGITUD, r.NOTAS_PRIVADAS
            ]
          );
        }
        clientesOk++;
      } catch (e) {
        console.warn('⚠️ Cliente', nif || nombre, e.message);
        clientesErr++;
      }
    }
    console.log('✅ Clientes: inserate/actualizate', clientesOk, clientesErr ? ', erori: ' + clientesErr : '');
  } else {
    console.log('⚠️ Sheet "Clientes" negăsit.');
  }

  // ---- Proveedores ----
  const sheetProveedores = workbook.getWorksheet('Proveedores');
  if (sheetProveedores) {
    const headerRowIndex = 4;
    const headerCells = [];
    const headerRow = sheetProveedores.getRow(headerRowIndex);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headerCells[colNumber - 1] = toStr(cell.value) || '';
    });
    const proveedoresRows = [];
    for (let r = headerRowIndex + 1; r <= sheetProveedores.rowCount; r++) {
      const row = sheetProveedores.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cell.value;
      });
      const rec = rowToRecord(cells, headerCells, PROVEEDORES_HEADER_MAP);
      const nif = rec.NIF;
      const nombre = rec.NOMBRE_O_RAZON_SOCIAL;
      if (!nif && !nombre) continue;
      proveedoresRows.push(rec);
    }

    console.log('\n📋 Proveedores de importat:', proveedoresRows.length);
    let provOk = 0, provErr = 0;
    for (const r of proveedoresRows) {
      const nif = r.NIF || null;
      const nombre = r.NOMBRE_O_RAZON_SOCIAL || null;
      if (!nif && !nombre) continue;
      try {
        const [existing] = await conn.query('SELECT id FROM Proveedores WHERE NIF = ? LIMIT 1', [nif || '']);
        if (existing && existing.length > 0) {
          await conn.query(
            `UPDATE Proveedores SET
              \`NOMBRE O RAZÓN SOCIAL\` = COALESCE(?, \`NOMBRE O RAZÓN SOCIAL\`),
              EMAIL = COALESCE(?, EMAIL),
              TELEFONO = COALESCE(?, TELEFONO),
              \`MÓVIL\` = COALESCE(?, \`MÓVIL\`),
              FAX = COALESCE(?, FAX),
              \`DIRECCIÓN\` = COALESCE(?, \`DIRECCIÓN\`),
              \`CODIGO POSTAL\` = COALESCE(?, \`CODIGO POSTAL\`),
              \`POBLACIÓN\` = COALESCE(?, \`POBLACIÓN\`),
              PROVINCIA = COALESCE(?, PROVINCIA),
              \`PAÍS\` = COALESCE(?, \`PAÍS\`),
              URL = COALESCE(?, URL),
              \`DESCUENTO POR DEFECTO\` = COALESCE(?, \`DESCUENTO POR DEFECTO\`),
              LATITUD = COALESCE(?, LATITUD),
              LONGITUD = COALESCE(?, LONGITUD),
              \`NOTAS PRIVADAS\` = COALESCE(?, \`NOTAS PRIVADAS\`)
            WHERE NIF = ?`,
            [
              nombre, r.EMAIL, r.TELEFONO, r.MOVIL, r.FAX, r.DIRECCION, r.CODIGO_POSTAL,
              r.POBLACION, r.PROVINCIA, r.PAIS, r.URL, r.DESCUENTO_POR_DEFECTO,
              r.LATITUD, r.LONGITUD, r.NOTAS_PRIVADAS, nif || ''
            ]
          );
        } else {
          await conn.query(
            `INSERT INTO Proveedores (NIF, \`NOMBRE O RAZÓN SOCIAL\`, EMAIL, TELEFONO, \`MÓVIL\`, FAX, \`DIRECCIÓN\`, \`CODIGO POSTAL\`, \`POBLACIÓN\`, PROVINCIA, \`PAÍS\`, URL, \`DESCUENTO POR DEFECTO\`, LATITUD, LONGITUD, \`NOTAS PRIVADAS\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nif, nombre, r.EMAIL, r.TELEFONO, r.MOVIL, r.FAX, r.DIRECCION, r.CODIGO_POSTAL,
              r.POBLACION, r.PROVINCIA, r.PAIS, r.URL, r.DESCUENTO_POR_DEFECTO,
              r.LATITUD, r.LONGITUD, r.NOTAS_PRIVADAS
            ]
          );
        }
        provOk++;
      } catch (e) {
        console.warn('⚠️ Proveedor', nif || nombre, e.message);
        provErr++;
      }
    }
    console.log('✅ Proveedores: inserate/actualizate', provOk, provErr ? ', erori: ' + provErr : '');
  } else {
    console.log('⚠️ Sheet "Proveedores" negăsit.');
  }

  await conn.end();
  console.log('\n✅ Import finalizat.');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
