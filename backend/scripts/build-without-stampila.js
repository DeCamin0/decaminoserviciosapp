const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Construind documentul FĂRĂ stampila (doar placeholder-uri)...');

try {
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  const originalXml = documentXml;
  
  // 1. Placeholder-uri - structură EXACTĂ din original
  console.log('\n📋 Adăugând placeholder-uri...');
  const addPlaceholder = (rowXml, placeholder) => {
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    if (pattern.test(rowXml)) {
      // Structură EXACTĂ: <w:rFonts/> și <w:sz/> sunt self-closing
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
  
  console.log(`\n📊 XML: ${openTags}/${closeTags} (original: ${originalOpen}/${originalClose})`);
  console.log(`   Diferență: ${openTags - originalOpen} deschise, ${closeTags - originalClose} închise`);
  
  // Pentru 4 placeholder-uri: 4 x (<w:r> + <w:rPr> + <w:t>) = 12 deschise, 12 închise
  // <w:rFonts/> și <w:sz/> sunt self-closing, deci nu contează
  const expectedDiff = 12;
  if (Math.abs((openTags - originalOpen) - expectedDiff) <= 2 && 
      Math.abs((closeTags - originalClose) - expectedDiff) <= 2) {
    console.log('  ✅ Structura XML corectă!');
  } else {
    console.log(`  ⚠️ Diferența nu corespunde (așteptat: ${expectedDiff})`);
  }
  
  // Verifică placeholder-urile
  const hasAll = documentXml.includes('{{TRABAJADOR}}') && 
                 documentXml.includes('{{DNI}}') && 
                 documentXml.includes('{{PUESTO_TRABAJO}}') && 
                 documentXml.includes('{{EMPRESA}}') && 
                 documentXml.includes('{{FECHA}}');
  console.log(`\n✅ Toate placeholder-urile prezente: ${hasAll ? '✅' : '❌'}`);
  
  // Actualizează
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.writeZip(outputPath);
  
  console.log(`\n✅ Documentul salvat FĂRĂ stampila: ${outputPath}`);
  console.log('📝 Deschide documentul și verifică dacă funcționează. Dacă da, adăugăm stampila separat.');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
