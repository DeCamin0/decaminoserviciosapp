const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând PUESTO_TRABAJO separat...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Caută PUESTO DE TRABAJO în document
  const puestoIndex = xml.indexOf('PUESTO');
  if (puestoIndex === -1) {
    console.log('❌ Nu s-a găsit "PUESTO" în document');
    process.exit(1);
  }
  
  // Extrage contextul pentru a vedea structura
  const context = xml.substring(Math.max(0, puestoIndex - 200), puestoIndex + 500);
  console.log('📋 Context PUESTO:');
  console.log(context.substring(0, 300));
  
  // Încearcă mai multe pattern-uri pentru PUESTO
  // Pattern 1: "PUESTO DE TRABAJO:" sau "PUESTO" + "DE TRABAJO:"
  const patterns = [
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?PUESTO.*?TRABAJO.*?:.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>.*?PUESTO.*?<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
  ];
  
  let found = false;
  for (const pattern of patterns) {
    if (xml.match(pattern)) {
      xml = xml.replace(pattern, (match, firstCell, secondCell) => {
        found = true;
        // Adaugă placeholder-ul în a doua celulă
        const secondCellWithPlaceholder = secondCell.replace(
          /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
          '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
        );
        return firstCell + secondCellWithPlaceholder + '</w:tc></w:tr>';
      });
      break;
    }
  }
  
  if (!found) {
    // Încearcă să găsească rândul manual
    const rowMatch = xml.match(/<w:tr[^>]*>.*?PUESTO.*?TRABAJO.*?<\/w:tr>/s);
    if (rowMatch) {
      console.log('📋 Rând găsit, dar pattern-ul nu a funcționat');
      console.log(rowMatch[0].substring(0, 500));
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
