const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');

console.log('🔍 Verificând exact ce adaug...');

try {
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  
  // Găsește rândul TRABAJADOR
  const trabajadorRow = documentXml.match(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s);
  if (trabajadorRow) {
    const originalRow = trabajadorRow[0];
    console.log('📋 Rând original (lungime):', originalRow.length);
    
    // Numără tag-urile în rândul original
    const originalOpen = (originalRow.match(/<w:[^>]+>/g) || []).length;
    const originalClose = (originalRow.match(/<\/w:[^>]+>/g) || []).length;
    console.log(`  Tag-uri: ${originalOpen} deschise, ${originalClose} închise`);
    
    // Adaugă placeholder-ul
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    const newRow = originalRow.replace(pattern, `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p></w:tc>`);
    
    // Numără tag-urile în rândul nou
    const newOpen = (newRow.match(/<w:[^>]+>/g) || []).length;
    const newClose = (newRow.match(/<\/w:[^>]+>/g) || []).length;
    console.log(`\n📋 Rând modificat:`);
    console.log(`  Tag-uri: ${newOpen} deschise, ${newClose} închise`);
    console.log(`  Diferență: ${newOpen - originalOpen} deschise, ${newClose - originalClose} închise`);
    
    // Verifică structura adăugată
    const addedPart = newRow.replace(originalRow.substring(0, originalRow.indexOf('</w:p></w:tc>')), '');
    console.log(`\n📝 Partea adăugată:`);
    console.log(addedPart.substring(0, 200));
    
    // Numără tag-urile în partea adăugată
    const addedOpen = (addedPart.match(/<w:[^>]+>/g) || []).length;
    const addedClose = (addedPart.match(/<\/w:[^>]+>/g) || []).length;
    console.log(`\n  Tag-uri adăugate: ${addedOpen} deschise, ${addedClose} închise`);
    
    // Verifică dacă <w:rFonts> și <w:sz> sunt self-closing
    const hasSelfClosing = addedPart.includes('<w:rFonts') && addedPart.includes('/>');
    console.log(`  <w:rFonts> self-closing: ${hasSelfClosing ? '✅' : '❌'}`);
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
