const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând PUESTO_TRABAJO (abordare finală)...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Găsește rândul complet folosind regex - caută de la <w:tr până la </w:tr> care conține PUESTO
  const rowPattern = /<w:tr[^>]*>.*?<w:t>PUESTO<\/w:t>.*?<\/w:tr>/s;
  const rowMatch = xml.match(rowPattern);
  
  if (!rowMatch) {
    console.log('❌ Rândul nu a fost găsit');
    process.exit(1);
  }
  
  const fullRow = rowMatch[0];
  console.log('📋 Rând găsit, lungime:', fullRow.length);
  
  // Verifică dacă există a doua celulă goală
  // Caută pattern-ul: </w:tc> urmat de <w:tc> cu o celulă goală (doar <w:pPr> și </w:p>)
  const secondCellPattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
  
  if (secondCellPattern.test(fullRow)) {
    // Adaugă placeholder-ul în a doua celulă
    const newRow = fullRow.replace(
      secondCellPattern,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p></w:tc>'
    );
    
    // Înlocuiește rândul în XML
    xml = xml.replace(rowPattern, newRow);
    
    console.log('✅ Placeholder adăugat în a doua celulă');
  } else {
    // Încearcă un pattern mai simplu - doar să găsească </w:p> în a doua celulă
    const simplePattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*)<\/w:p>/s;
    if (simplePattern.test(fullRow)) {
      const newRow = fullRow.replace(
        simplePattern,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
      xml = xml.replace(rowPattern, newRow);
      console.log('✅ Placeholder adăugat (pattern simplu)');
    } else {
      console.log('⚠️ Nu s-a găsit pattern-ul pentru a doua celulă');
      // Afișează o parte din rând pentru debugging
      console.log('Prima parte:', fullRow.substring(0, 500));
      console.log('Ultima parte:', fullRow.substring(fullRow.length - 500));
    }
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
