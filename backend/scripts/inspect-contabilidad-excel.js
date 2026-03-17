/**
 * Afișează structura Excel export contabilitate: toate sheet-urile, header (rând 1),
 * primele rânduri de date. Pentru a studia fișierul înainte de import Clientes/Proveedores HERA.
 *
 * Rulare: node scripts/inspect-contabilidad-excel.js [cale.xlsx]
 * Default: Exportacion_contabilidad_2026-1T.xlsx din root proiect.
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const rootDir = path.join(__dirname, '..', '..');
const defaultPath = path.join(rootDir, 'Exportacion_contabilidad_2026-1T.xlsx');
const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

function toStr(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim();
  if (v instanceof Date) return v.toISOString ? v.toISOString().slice(0, 10) : String(v);
  return String(v).trim();
}

async function main() {
  if (!fs.existsSync(xlsxPath)) {
    console.error('❌ Fișier negăsit:', xlsxPath);
    console.log('   Pune fișierul în root proiect sau indică calea: node scripts/inspect-contabilidad-excel.js "C:\\ruta\\Exportacion_contabilidad_2026-1T.xlsx"');
    process.exit(1);
  }

  console.log('📂 Fișier:', xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const sheetNames = workbook.worksheets.map((s) => s.name);
  console.log('\n📋 Sheet-uri (' + sheetNames.length + '):', sheetNames.join(', '));

  for (const sheet of workbook.worksheets) {
    console.log('\n' + '='.repeat(60));
    console.log('📄 Sheet:', sheet.name);
    console.log('='.repeat(60));

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let v = cell.value;
        if (v && typeof v === 'object' && v.text) v = v.text;
        if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
        cells[colNumber - 1] = v;
      });
      rows.push({ rowNumber, cells });
    });

    if (rows.length === 0) {
      console.log('   (gol)');
      continue;
    }

    const headerRow = rows[0];
    const headers = headerRow.cells.map((c) => toStr(c));
    console.log('\n📌 Coloane (rând 1):');
    headers.forEach((name, i) => {
      if (name !== undefined && name !== '') console.log('   ' + (i + 1) + '. "' + name + '"');
    });

    const dataRows = rows.slice(1).filter((r) => r.cells.some((c) => c != null && toStr(c) !== ''));
    console.log('\n📄 Rânduri de date (excl. gol):', dataRows.length);
    const showRows = Math.min(3, dataRows.length);
    for (let r = 0; r < showRows; r++) {
      const row = dataRows[r];
      console.log('\n--- Rând ' + row.rowNumber + ' ---');
      headers.forEach((h, i) => {
        const val = row.cells[i];
        const s = toStr(val);
        if (s && s.length > 0) console.log('   ' + h + ': ' + (s.length > 80 ? s.slice(0, 80) + '...' : s));
      });
    }
  }

  console.log('\n✅ Inspectare finalizată. Tabele HERA: Clientes (NIF, NOMBRE O RAZON SOCIAL, ...), Proveedores (NIF, NOMBRE O RAZÓN SOCIAL, ...).');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
