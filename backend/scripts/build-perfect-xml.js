const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Construind cu structură XML PERFECTĂ...');

try {
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  const originalXml = documentXml;
  
  // Verifică structura exactă din original
  const sampleRow = documentXml.match(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s);
  if (sampleRow) {
    const secondCell = sampleRow[0].match(/<\/w:tc>\s*<w:tc[^>]*>.*?<\/w:tc>/s);
    if (secondCell) {
      console.log('📋 Structură a doua celulă (original):');
      console.log(secondCell[0].substring(0, 300));
    }
  }
  
  // 1. Placeholder-uri - folosind structura EXACTĂ din original
  console.log('\n📋 Adăugând placeholder-uri...');
  
  // Găsește structura exactă a celei de-a doua celule goale
  // Din original: <w:p><w:pPr>...</w:pPr></w:p> (goală)
  // Trebuie să adaug: <w:r><w:rPr><w:rFonts/><w:sz/></w:rPr><w:t>placeholder</w:t></w:r>
  
  const addPlaceholder = (rowXml, placeholder) => {
    // Pattern: găsește a doua celulă goală
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    if (pattern.test(rowXml)) {
      // Structură EXACTĂ: <w:rFonts/> și <w:sz/> sunt self-closing (fără closing tag)
      // <w:r> ... </w:r> = 1 deschis, 1 închis
      // <w:rPr> ... </w:rPr> = 1 deschis, 1 închis  
      // <w:rFonts/> = self-closing (0)
      // <w:sz/> = self-closing (0)
      // <w:t> ... </w:t> = 1 deschis, 1 închis
      // Total per placeholder: 3 deschise, 3 închise
      return rowXml.replace(pattern, `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`);
    }
    return rowXml;
  };
  
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{TRABAJADOR}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{DNI}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{PUESTO_TRABAJO}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{EMPRESA}}'));
  console.log('  ✅ Placeholder-uri adăugate');
  
  // 2. FECHA
  console.log('\n📋 Adăugând {{FECHA}}...');
  documentXml = documentXml.replace(/(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s, '$1{{FECHA}}$2');
  console.log('  ✅ {{FECHA}} adăugat');
  
  // Validează
  const openTags = (documentXml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (documentXml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpen = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalClose = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  const diffOpen = openTags - originalOpen;
  const diffClose = closeTags - originalClose;
  
  console.log(`\n📊 XML: ${openTags}/${closeTags} (original: ${originalOpen}/${originalClose})`);
  console.log(`   Diferență: ${diffOpen} deschise, ${diffClose} închise`);
  
  // Pentru 4 placeholder-uri: 4 x 3 = 12 deschise, 12 închise
  if (diffOpen === 12 && diffClose === 12) {
    console.log('  ✅ Structura XML PERFECTĂ!');
  } else if (Math.abs(diffOpen - diffClose) <= 2) {
    console.log('  ✅ Tag-uri echilibrate (diferență mică OK)');
  } else {
    console.log(`  ⚠️ Diferență între deschise/închise: ${Math.abs(diffOpen - diffClose)}`);
  }
  
  // Verifică placeholder-urile
  console.log(`\n✅ Verificare placeholder-uri:`);
  console.log(`  {{TRABAJADOR}}: ${documentXml.includes('{{TRABAJADOR}}') ? '✅' : '❌'}`);
  console.log(`  {{DNI}}: ${documentXml.includes('{{DNI}}') ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}}: ${documentXml.includes('{{PUESTO_TRABAJO}}') ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}}: ${documentXml.includes('{{EMPRESA}}') ? '✅' : '❌'}`);
  console.log(`  {{FECHA}}: ${documentXml.includes('{{FECHA}}') ? '✅' : '❌'}`);
  
  // Actualizează
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.writeZip(outputPath);
  
  console.log(`\n✅ Documentul salvat: ${outputPath}`);
  console.log('📝 Deschide documentul și verifică dacă funcționează corect!');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
