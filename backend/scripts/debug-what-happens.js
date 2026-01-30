const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(originalPath);
const xml = zip.readAsText('word/document.xml');

// Găsește rândul TRABAJADOR complet folosind regex
const trabajadorRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s;
const trabajadorMatch = xml.match(trabajadorRowPattern);

if (trabajadorMatch) {
  const fullRow = trabajadorMatch[0];
  console.log('=== RÂND COMPLET TRABAJADOR ===');
  console.log('Lungime:', fullRow.length);
  console.log('\nPrima parte (prima celulă):');
  const firstCellEnd = fullRow.indexOf('</w:tc>');
  console.log(fullRow.substring(0, Math.min(firstCellEnd + 50, fullRow.length)));
  
  console.log('\n\nA doua celulă (după prima </w:tc>):');
  const secondCellStart = fullRow.indexOf('</w:tc>') + 7;
  const secondCellEnd = fullRow.indexOf('</w:tc>', secondCellStart);
  if (secondCellEnd > secondCellStart) {
    const secondCell = fullRow.substring(secondCellStart, secondCellEnd + 7);
    console.log(secondCell);
    
    // Verifică dacă este goală
    const isEmpty = /<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>/.test(secondCell);
    console.log(`\nA doua celulă este goală: ${isEmpty ? '✅' : '❌'}`);
    
    // Testează pattern-ul
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    const testMatch = fullRow.match(pattern);
    if (testMatch) {
      console.log('\n✅ Pattern-ul funcționează!');
      console.log('Fragment găsit:');
      console.log(testMatch[1].substring(0, 200));
    } else {
      console.log('\n❌ Pattern-ul NU funcționează!');
      // Încearcă pattern-uri alternative
      const altPattern1 = /<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>/s;
      if (altPattern1.test(fullRow)) {
        console.log('Pattern alternativ 1 funcționează');
      }
    }
  }
  
  // Salvează rândul complet
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'trabajador-full-row.txt'),
    fullRow,
    'utf8'
  );
  console.log('\n✅ Rând complet salvat în trabajador-full-row.txt');
}
