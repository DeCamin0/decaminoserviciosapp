/**
 * Inspecționează foaia FACTURA din PRESUPUESTO DECAMINO 2025 (1).xlsm
 * și scrie structura într-un fișier pentru studiu.
 *
 * Rulează din root: node backend/scripts/inspect-factura-sheet.js
 * Excel trebuie să fie în root: PRESUPUESTO DECAMINO 2025 (1).xlsm
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const xlsmPath = path.join(__dirname, '..', '..', 'PRESUPUESTO DECAMINO 2025 (1).xlsm');
const outPath = path.join(__dirname, '..', 'docs', 'FACTURA_SHEET_STRUCTURE.md');

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
    if (v.formula) return `[=${v.formula}]`;
    if (v.richText && Array.isArray(v.richText)) return v.richText.map((t) => t.text || '').join('');
    if (v.text) return String(v.text);
  }
  return String(v);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsmPath);

  const sheetNames = workbook.worksheets.map((s) => s.name);
  const facturaSheet = workbook.worksheets.find(
    (s) => s.name.toUpperCase().replace(/\s+/g, '').includes('FACTURA')
  );

  let out = '# Estructura foii Factura – PRESUPUESTO DECAMINO\n\n';
  out += `**Toate foile din Excel:** ${sheetNames.join(', ')}\n\n`;

  if (!facturaSheet) {
    out += '**Nu s-a găsit o foaie cu nume conținând "FACTURA".**\n';
    out += 'Verifică numele exact al foilor în Excel.\n';
    fs.writeFileSync(outPath, out, 'utf8');
    console.log('Scris:', outPath);
    console.log('Foi existente:', sheetNames.join(', '));
    return;
  }

  const sheet = facturaSheet;
  out += `## Foaie: "${sheet.name}"\n\n`;

  const rowCount = Math.min(sheet.rowCount || 0, 60);
  let maxCol = 0;
  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount > maxCol) maxCol = row.cellCount;
  }
  maxCol = Math.min(maxCol || 20, 25);

  // Header coloane (A, B, C...)
  out += '| # | ';
  for (let c = 0; c < maxCol; c++) {
    out += colLetter(c) + ' | ';
  }
  out += '\n|' + '---|'.repeat(maxCol + 1) + '\n';

  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const cells = [];
    for (let colNumber = 1; colNumber <= maxCol; colNumber++) {
      const cell = row.getCell(colNumber);
      const disp = getCellDisplayValue(cell);
      cells.push(disp.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 35));
    }
    out += `| ${r} | ${cells.join(' | ')} |\n`;
  }

  // Formule (primele 30)
  const formulas = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const v = cell.value;
      if (v && typeof v === 'object' && v.formula) {
        formulas.push({
          addr: colLetter(colNumber - 1) + r,
          formula: v.formula,
          result: v.result,
        });
      }
    });
  }
  if (formulas.length > 0) {
    out += '\n## Formule (primele 30)\n\n';
    formulas.slice(0, 30).forEach((f) => {
      out += `- **${f.addr}**: \`${f.formula}\` => ${f.result}\n`;
    });
    if (formulas.length > 30) out += `\n... și încă ${formulas.length - 30} formule.\n`;
  }

  fs.writeFileSync(outPath, out, 'utf8');
  console.log('Scris:', outPath);
  console.log('Foaie analizată:', sheet.name, '- rânduri:', rowCount, 'coloane:', maxCol);
}

main().catch((err) => {
  console.error(err.message);
  console.error('\nAsigură-te că fișierul PRESUPUESTO DECAMINO 2025 (1).xlsm este în rădăcina proiectului.');
  process.exit(1);
});
