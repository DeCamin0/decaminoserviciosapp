const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Găsește rândul TRABAJADOR complet
const trabajadorIndex = xml.indexOf('TRABAJADOR:');
if (trabajadorIndex !== -1) {
  // Găsește începutul rândului (<w:tr)
  let rowStart = trabajadorIndex;
  while (rowStart > 0 && !xml.substring(rowStart, rowStart + 5).match(/<w:tr/)) {
    rowStart--;
  }
  
  // Găsește sfârșitul rândului (</w:tr>)
  let rowEnd = trabajadorIndex;
  let trCount = 0;
  let inTr = false;
  for (let i = rowStart; i < xml.length; i++) {
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
  
  console.log('=== RÂND COMPLET TRABAJADOR ===');
  console.log(fullRow);
  console.log('\n=== LUNGIME ===');
  console.log(`Start: ${rowStart}, End: ${rowEnd}, Length: ${fullRow.length}`);
  
  // Salvează într-un fișier pentru analiză
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'row-structure.txt'),
    fullRow,
    'utf8'
  );
  console.log('\n✅ Structura salvată în row-structure.txt');
}
