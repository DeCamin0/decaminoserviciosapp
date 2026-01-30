const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând PUESTO_TRABAJO (abordare completă)...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Găsește rândul care conține "PUESTO" și "TRABAJO"
  const puestoIndex = xml.indexOf('<w:t>PUESTO</w:t>');
  if (puestoIndex === -1) {
    console.log('❌ Nu s-a găsit "PUESTO" în document');
    process.exit(1);
  }
  
  // Găsește începutul rândului (<w:tr)
  let rowStart = puestoIndex;
  let depth = 0;
  while (rowStart > 0) {
    if (xml.substring(rowStart, rowStart + 5) === '<w:tr') {
      break;
    }
    rowStart--;
    if (rowStart < puestoIndex - 2000) break; // Limitează căutarea
  }
  
  // Găsește sfârșitul rândului (</w:tr>)
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
  console.log('📋 Rând complet găsit, lungime:', fullRow.length);
  
  // Verifică dacă a doua celulă este goală (are doar <w:pPr> și </w:p>)
  const secondCellMatch = fullRow.match(/<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s);
  
  if (secondCellMatch) {
    // Adaugă placeholder-ul în a doua celulă
    const newRow = fullRow.replace(
      /(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p></w:tc>'
    );
    
    // Înlocuiește rândul în XML
    xml = xml.substring(0, rowStart) + newRow + xml.substring(rowEnd);
    
    console.log('✅ Placeholder adăugat în a doua celulă');
  } else {
    console.log('⚠️ A doua celulă nu a fost găsită în formatul așteptat');
  }
  
  // Verifică rezultatul
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  console.log(`\n✅ {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  
  // Validează XML-ul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`📊 Validare XML: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise`);
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
