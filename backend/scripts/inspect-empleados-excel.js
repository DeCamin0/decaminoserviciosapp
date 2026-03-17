/**
 * Afișează structura unui Excel empleados: sheet-uri, header (rând 1), primele 2 rânduri de date.
 * Rulare: node scripts/inspect-empleados-excel.js [cale.xlsx]
 * Default: empleados_04-02-2026.xlsx din root proiect.
 */
const path = require('path');
const ExcelJS = require('exceljs');

const rootDir = path.join(__dirname, '..', '..');
const defaultPath = path.join(rootDir, 'empleados_04-02-2026.xlsx');
const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

async function main() {
  console.log('📂 Fișier:', xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  console.log('\n📋 Sheet-uri:', workbook.worksheets.map((s) => s.name).join(', '));
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.log('Niciun sheet.');
    return;
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let v = cell.value;
      if (v && typeof v === 'object' && v.text) v = v.text;
      if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
      cells[colNumber - 1] = v == null ? '' : String(v).slice(0, 50);
    });
    rows.push({ rowNumber, cells });
  });

  const headerRow = rows[0];
  if (!headerRow) {
    console.log('Sheet gol.');
    return;
  }

  console.log('\n📌 Coloane (rând 1) – index și nume:');
  headerRow.cells.forEach((name, i) => {
    if (name !== undefined && name !== '') console.log(`  ${i + 1}. "${name}"`);
  });

  console.log('\n📄 Primele 3 rânduri de date (valorile aliniate la header):');
  const headers = headerRow.cells;
  for (let r = 1; r < Math.min(4, rows.length); r++) {
    const row = rows[r];
    console.log(`\n--- Rând ${row.rowNumber} ---`);
    headers.forEach((h, i) => {
      const val = row.cells[i];
      if (h && (val !== undefined && val !== '')) console.log(`  ${h}: ${val}`);
    });
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
