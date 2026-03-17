/**
 * Importă angajați din Excel (empleados_04-02-2026.xlsx) în hera_facility_db.DatosEmpleados.
 * Coloanele Excel sunt foarte asemănătoare cu tabelul; scriptul mapează și formatează datele.
 *
 * Rulare: node scripts/import-empleados-excel-to-hera.js [cale.xlsx]
 * Default: empleados_04-02-2026.xlsx din root proiect.
 *
 * Cerințe: .env.client2.local cu DB_NAME=hera_facility_db, tabelul DatosEmpleados există.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

const backendDir = path.join(__dirname, '..');
const rootDir = path.join(backendDir, '..');
const defaultPath = path.join(rootDir, 'empleados_04-02-2026.xlsx');
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

/** Nume coloane în MySQL (DatosEmpleados) – cum apar în DB */
const DB_COLUMNS = [
  'CODIGO',
  'NOMBRE / APELLIDOS',
  'NOMBRE_APELLIDOS_BACKUP',
  'NOMBRE',
  'APELLIDO1',
  'APELLIDO2',
  'NOMBRE_SPLIT_CONFIANZA',
  'NACIONALIDAD',
  'DIRECCION',
  'D.N.I. / NIE',
  'SEG. SOCIAL',
  'Nº Cuenta',
  'TELEFONO',
  'CORREO ELECTRONICO',
  'FECHA NACIMIENTO',
  'FECHA DE ALTA',
  'CENTRO TRABAJO',
  'TIPO DE CONTRATO',
  'SUELDO BRUTO MENSUAL',
  'HORAS DE CONTRATO',
  'EMPRESA',
  'GRUPO',
  'ESTADO',
  'FECHA BAJA',
  'Fecha Antigüedad',
  'Antigüedad',
  'Contraseña',
  'DerechoPedidos',
  'TrabajaFestivos',
  'VACACIONES_RESTANTES_ANO_ANTERIOR',
  'VACACIONES_ANUALES_PERSONALIZADAS',
  'ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS',
  'certificado_handicap_confirmado',
  'fecha_baja_programada',
];

function toStr(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v.text) return String(v.text).trim() || null;
  if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim() || null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim() || null;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Generează parolă aleatorie (litere + cifre, 10 caractere) */
function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

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

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error('❌ Niciun sheet în Excel.');
    process.exit(1);
  }

  const headerByIndex = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const name = toStr(cell.value);
    if (name) headerByIndex[colNumber] = name;
  });

  const excelToDb = {
    'CODIGO': 'CODIGO',
    'NOMBRE': 'NOMBRE / APELLIDOS',
    'APELLIDOS': null,
    'CORREO ELECTRONICO': 'CORREO ELECTRONICO',
    'D.N.I. / NIE': 'D.N.I. / NIE',
    'TELEFONO': 'TELEFONO',
    'NACIONALIDAD': 'NACIONALIDAD',
    'DIRECCION': 'DIRECCION',
    'SEG. SOCIAL': 'SEG. SOCIAL',
    'Nº Cuenta': 'Nº Cuenta',
    'FECHA NACIMIENTO': 'FECHA NACIMIENTO',
    'FECHA DE ALTA': 'FECHA DE ALTA',
    'FECHA BAJA': 'FECHA BAJA',
    'CENTRO TRABAJO': 'CENTRO TRABAJO',
    'TIPO DE CONTRATO': 'TIPO DE CONTRATO',
    'HORAS DE CONTRATO': 'HORAS DE CONTRATO',
    'SUELDO BRUTO MENSUAL': 'SUELDO BRUTO MENSUAL',
    'EMPRESA': 'EMPRESA',
    'GRUPO': 'GRUPO',
    'ESTADO': 'ESTADO',
    'Antigüedad': 'Antigüedad',
    'Contraseña': 'Contraseña',
    'DerechoPedidos': 'DerechoPedidos',
    'Fecha Antigüedad': 'Fecha Antigüedad',
  };

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headerByIndex[colNumber];
      if (header) raw[header] = cell.value;
    });

    const dni = toStr(raw['D.N.I. / NIE']);
    const nombreCompleto = toStr(raw['NOMBRE']) || '';
    const apellidos = toStr(raw['APELLIDOS']);

    const rowData = {
      'CODIGO': null,
      'NOMBRE / APELLIDOS': nombreCompleto || apellidos || null,
      'NOMBRE_APELLIDOS_BACKUP': null,
      'NOMBRE': nombreCompleto ? nombreCompleto.split(/\s+/)[0] || null : null,
      'APELLIDO1': apellidos ? apellidos.split(/\s+/)[0] || null : null,
      'APELLIDO2': apellidos ? apellidos.split(/\s+/).slice(1).join(' ') || null : null,
      'NOMBRE_SPLIT_CONFIANZA': 2,
      'NACIONALIDAD': toStr(raw['NACIONALIDAD']),
      'DIRECCION': toStr(raw['DIRECCION']),
      'D.N.I. / NIE': dni,
      'SEG. SOCIAL': toStr(raw['SEG. SOCIAL']),
      'Nº Cuenta': toStr(raw['Nº Cuenta']),
      'TELEFONO': toStr(raw['TELEFONO']),
      'CORREO ELECTRONICO': toStr(raw['CORREO ELECTRONICO']),
      'FECHA NACIMIENTO': raw['FECHA NACIMIENTO'] instanceof Date ? raw['FECHA NACIMIENTO'].toISOString().slice(0, 10) : toStr(raw['FECHA NACIMIENTO']),
      'FECHA DE ALTA': raw['FECHA DE ALTA'] instanceof Date ? raw['FECHA DE ALTA'].toISOString().slice(0, 10) : toStr(raw['FECHA DE ALTA']),
      'CENTRO TRABAJO': toStr(raw['CENTRO TRABAJO']),
      'TIPO DE CONTRATO': toStr(raw['TIPO DE CONTRATO']),
      'SUELDO BRUTO MENSUAL': toStr(raw['SUELDO BRUTO MENSUAL']),
      'HORAS DE CONTRATO': toStr(raw['HORAS DE CONTRATO']),
      'EMPRESA': toStr(raw['EMPRESA']),
      'GRUPO': toStr(raw['GRUPO']),
      'ESTADO': 'ACTIVO',
      'FECHA BAJA': raw['FECHA BAJA'] instanceof Date ? raw['FECHA BAJA'].toISOString().slice(0, 10) : toStr(raw['FECHA BAJA']),
      'Fecha Antigüedad': raw['Fecha Antigüedad'] instanceof Date ? raw['Fecha Antigüedad'].toISOString().slice(0, 10) : toStr(raw['Fecha Antigüedad']),
      'Antigüedad': raw['Antigüedad'] instanceof Date ? raw['Antigüedad'].toISOString().slice(0, 10) : toStr(raw['Antigüedad']),
      'Contraseña': (() => {
        const p = toStr(raw['Contraseña']);
        if (p && p.length > 0) return p;
        return randomPassword();
      })(),
      'DerechoPedidos': toStr(raw['DerechoPedidos']),
      'TrabajaFestivos': null,
      'VACACIONES_RESTANTES_ANO_ANTERIOR': null,
      'VACACIONES_ANUALES_PERSONALIZADAS': null,
      'ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS': null,
      'certificado_handicap_confirmado': null,
      'fecha_baja_programada': null,
    };

    if (!rowData['NOMBRE / APELLIDOS'] && !rowData['CORREO ELECTRONICO'] && !rowData['D.N.I. / NIE']) return;
    if (!toStr(raw['Contraseña'])) rowData._passwordGenerated = true;
    rows.push(rowData);
  });

  console.log('📂 Excel:', xlsxPath);
  console.log('📋 Rânduri de importat:', rows.length);
  if (rows.length === 0) {
    console.log('Niciun rând valid.');
    return;
  }

  const config = {
    host: envHera.DB_HOST,
    port: parseInt(envHera.DB_PORT || '3306', 10),
    user: envHera.DB_USERNAME,
    password: envHera.DB_PASSWORD || '',
    database: envHera.DB_NAME,
    charset: 'utf8mb4',
  };

  console.log('🔗 Conectare la HERA', config.host, '...');
  const conn = await mysql.createConnection(config);

  const [maxRows] = await conn.query(
    "SELECT MAX(CAST(CODIGO AS UNSIGNED)) AS maxCodigo FROM DatosEmpleados WHERE CODIGO REGEXP '^[0-9]+$'"
  );
  let nextCode = (maxRows && maxRows[0] && maxRows[0].maxCodigo != null)
    ? Number(maxRows[0].maxCodigo) + 1
    : 10000001;

  const columns = DB_COLUMNS;
  const colList = columns.map((c) => '`' + String(c).replace(/`/g, '``') + '`').join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const updateSet = columns.filter((c) => c !== 'CODIGO').map((c) => '`' + String(c).replace(/`/g, '``') + '`=?').join(', ');
  const sqlInsert = `INSERT INTO DatosEmpleados (${colList}) VALUES (${placeholders})`;
  const sqlUpdate = `UPDATE DatosEmpleados SET ${updateSet} WHERE \`CODIGO\` = ?`;

  let inserted = 0, updated = 0, err = 0;
  for (const row of rows) {
    const dni = row['D.N.I. / NIE'] || null;
    const email = row['CORREO ELECTRONICO'] || null;
    let existingCodigo = null;
    if (dni || email) {
      const [existing] = await conn.query(
        'SELECT CODIGO FROM DatosEmpleados WHERE (? IS NOT NULL AND `D.N.I. / NIE` = ?) OR (? IS NOT NULL AND `CORREO ELECTRONICO` = ?) LIMIT 1',
        [dni, dni, email, email]
      );
      if (existing && existing.length > 0) existingCodigo = String(existing[0].CODIGO);
    }
    if (existingCodigo) {
      row.CODIGO = existingCodigo;
      const updateValues = columns.filter((c) => c !== 'CODIGO').map((c) => row[c] ?? null);
      try {
        await conn.query(sqlUpdate, [...updateValues, existingCodigo]);
        updated++;
      } catch (e) {
        console.warn('⚠️ UPDATE', existingCodigo, e.message);
        err++;
      }
    } else {
      row.CODIGO = String(nextCode++);
      const values = columns.map((col) => row[col] ?? null);
      try {
        await conn.query(sqlInsert, values);
        inserted++;
      } catch (e) {
        console.warn('⚠️ INSERT', row.CODIGO, e.message);
        err++;
      }
    }
  }

  const withGeneratedPassword = rows.filter((r) => r._passwordGenerated);
  if (withGeneratedPassword.length > 0) {
    const passPath = path.join(rootDir, `import-passwords-hera-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.txt`);
    const lines = ['CODIGO\tEmail\tContraseña', ...withGeneratedPassword.map((r) => [r.CODIGO, r['CORREO ELECTRONICO'] || '', r.Contraseña].join('\t'))];
    fs.writeFileSync(passPath, lines.join('\n'), 'utf8');
    console.log('🔑 Parole generate:', withGeneratedPassword.length, '→', passPath);
  }

  console.log('✅ Inserați:', inserted, '| Actualizați:', updated);
  if (err) console.log('❌ Erori:', err);
  await conn.end();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
