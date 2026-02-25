/**
 * Citește COSTE 2026 limpieza.xlsx și afișează structura, conținutul și formulele.
 * Rulează din root: node backend/scripts/read-coste-limpieza.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

const xlsxPath = path.join(__dirname, '..', '..', 'COSTE 2026 limpieza.xlsx');

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function getCellDisplayValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const v = cell.value;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (v.result !== undefined && v.result !== null) return String(v.result);
    if (v.formula) return `[formula: ${v.formula}]`;
    if (v.richText && Array.isArray(v.richText)) return v.richText.map((t) => t.text || '').join('');
    if (v.text) return String(v.text);
  }
  return String(v);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  console.log('=== COSTE 2026 limpieza.xlsx ===\n');
  console.log('Foi:', workbook.worksheets.map((s, i) => `${i + 1}. "${s.name}"`).join(', '));
  console.log('');

  for (const sheet of workbook.worksheets) {
    console.log('========== Foaie:', sheet.name, '==========\n');

    const rowCount = sheet.rowCount || 0;
    let maxCol = 0;
    for (let r = 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      if (row.cellCount > maxCol) maxCol = row.cellCount;
    }

    const headerLetters = [];
    for (let c = 0; c < maxCol; c++) headerLetters.push(colLetter(c));
    console.log('     | ' + headerLetters.join(' | ') + '\n');

    for (let r = 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      const cells = [];
      for (let colNumber = 1; colNumber <= maxCol; colNumber++) {
        const cell = row.getCell(colNumber);
        const disp = getCellDisplayValue(cell);
        cells.push(disp.slice(0, 45));
      }
      const line = cells.join(' | ');
      if (line.trim()) console.log(String(r).padStart(4) + ' | ' + line);
    }
    console.log('');

    const formulas = [];
    for (let r = 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const v = cell.value;
        if (v && typeof v === 'object' && v.formula) {
          const addr = colLetter(colNumber - 1) + r;
          formulas.push({
            addr,
            formula: v.formula,
            result: v.result !== undefined && v.result !== null ? v.result : '(fără result)',
          });
        }
      });
    }
    if (formulas.length > 0) {
      console.log('--- FORMULE (adresă | formulă | result) ---');
      formulas.forEach((f) => console.log(`  ${f.addr}: ${f.formula}  =>  ${f.result}`));
      console.log('');
    }

    console.log('--- Rezumat coloane (primele 6 rânduri) ---');
    for (let c = 0; c < maxCol; c++) {
      const colVals = [];
      for (let r = 1; r <= Math.min(6, rowCount); r++) {
        const cell = sheet.getRow(r).getCell(c + 1);
        colVals.push(getCellDisplayValue(cell).slice(0, 30));
      }
      console.log(`  ${colLetter(c)}: ${colVals.join(' | ')}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
