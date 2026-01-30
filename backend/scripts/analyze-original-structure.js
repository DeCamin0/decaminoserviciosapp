const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(originalPath);
const xml = zip.readAsText('word/document.xml');

// Găsește rândul TRABAJADOR complet
const trabajadorIndex = xml.indexOf('TRABAJADOR:');
if (trabajadorIndex !== -1) {
  // Găsește începutul rândului
  let rowStart = trabajadorIndex;
  while (rowStart > 0 && !xml.substring(rowStart, rowStart + 5).match(/<w:tr/)) {
    rowStart--;
    if (rowStart < trabajadorIndex - 2000) break;
  }
  
  // Găsește sfârșitul rândului
  let rowEnd = trabajadorIndex;
  let trCount = 0;
  let foundStart = false;
  for (let i = rowStart; i < Math.min(xml.length, rowStart + 2000); i++) {
    if (xml.substring(i, i + 5) === '<w:tr') {
      foundStart = true;
      trCount++;
    }
    if (xml.substring(i, i + 6) === '</w:tr>') {
      trCount--;
      if (trCount === 0 && foundStart) {
        rowEnd = i + 6;
        break;
      }
    }
  }
  
  const fullRow = xml.substring(rowStart, rowEnd);
  
  console.log('=== RÂND COMPLET TRABAJADOR (ORIGINAL) ===');
  console.log(fullRow);
  console.log('\n=== LUNGIME ===');
  console.log(`Start: ${rowStart}, End: ${rowEnd}, Length: ${fullRow.length}`);
  
  // Numără tag-urile în acest rând
  const openInRow = (fullRow.match(/<w:[^>]+>/g) || []).length;
  const closeInRow = (fullRow.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`\n📊 Tag-uri în rând: ${openInRow} deschise, ${closeInRow} închise`);
  
  // Verifică dacă a doua celulă este goală
  const secondCellMatch = fullRow.match(/<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s);
  if (secondCellMatch) {
    console.log('\n✅ A doua celulă este goală (doar <w:pPr> și </w:p>)');
    console.log('Fragment a doua celulă:');
    console.log(secondCellMatch[0].substring(0, 300));
  } else {
    console.log('\n⚠️ A doua celulă nu este în formatul așteptat');
    // Caută orice a doua celulă
    const anySecondCell = fullRow.match(/<\/w:tc>\s*<w:tc[^>]*>.*?<\/w:tc>/s);
    if (anySecondCell) {
      console.log('Fragment găsit:');
      console.log(anySecondCell[0].substring(0, 500));
    }
  }
  
  // Salvează pentru analiză
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'trabajador-row-original.txt'),
    fullRow,
    'utf8'
  );
  console.log('\n✅ Rând salvat în trabajador-row-original.txt');
}
