const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Găsește rândul care conține "PUESTO"
const puestoIndex = xml.indexOf('<w:t>PUESTO</w:t>');
if (puestoIndex === -1) {
  console.log('❌ Nu s-a găsit "PUESTO"');
  process.exit(1);
}

// Găsește începutul rândului
let rowStart = puestoIndex;
while (rowStart > 0 && !xml.substring(rowStart, rowStart + 5).match(/<w:tr/)) {
  rowStart--;
  if (rowStart < puestoIndex - 2000) break;
}

// Găsește sfârșitul rândului
let rowEnd = puestoIndex;
let trCount = 0;
let inTr = false;
for (let i = rowStart; i < Math.min(xml.length, rowStart + 3000); i++) {
  if (xml.substring(i, i + 5) === '<w:tr') {
    inTr = true;
    trCount++;
  }
  if (xml.substring(i, i + 6) === '</w:tr>') {
    trCount--;
    if (trCount === 0 && inTr) {
      rowEnd = i + 6;
      break;
    }
  }
}

const fullRow = xml.substring(rowStart, rowEnd);
console.log('=== RÂND COMPLET PUESTO ===');
console.log(fullRow);
console.log('\n=== LUNGIME ===');
console.log(`Start: ${rowStart}, End: ${rowEnd}, Length: ${fullRow.length}`);

// Salvează pentru analiză
const fs = require('fs');
fs.writeFileSync(
  path.join(__dirname, '..', '..', 'puesto-row.txt'),
  fullRow,
  'utf8'
);
console.log('\n✅ Rând salvat în puesto-row.txt');
