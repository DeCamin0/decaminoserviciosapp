const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(originalPath);
let xml = zip.readAsText('word/document.xml');

// Găsește rândul TRABAJADOR
const trabajadorRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s;
const trabajadorMatch = xml.match(trabajadorRowPattern);

if (trabajadorMatch) {
  const originalRow = trabajadorMatch[0];
  console.log('=== RÂND ORIGINAL ===');
  console.log('Lungime:', originalRow.length);
  
  // Testează replace-ul
  const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
  const newRow = originalRow.replace(
    pattern,
    `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p></w:tc>`
  );
  
  console.log('\n=== RÂND MODIFICAT ===');
  console.log('Lungime:', newRow.length);
  
  // Numără tag-urile
  const originalOpen = (originalRow.match(/<w:[^>]+>/g) || []).length;
  const originalClose = (originalRow.match(/<\/w:[^>]+>/g) || []).length;
  const newOpen = (newRow.match(/<w:[^>]+>/g) || []).length;
  const newClose = (newRow.match(/<\/w:[^>]+>/g) || []).length;
  
  console.log(`\n📊 Tag-uri:`);
  console.log(`  Original: ${originalOpen} deschise, ${originalClose} închise`);
  console.log(`  Modificat: ${newOpen} deschise, ${newClose} închise`);
  console.log(`  Diferență: ${newOpen - originalOpen} deschise, ${newClose - originalClose} închise`);
  
  // Ar trebui să adăugăm: <w:r>, <w:rPr>, <w:rFonts>, <w:sz>, <w:t> (5 deschise)
  // Și să închidem: </w:t>, </w:r> (2 închise)
  // Plus tag-urile care erau deja acolo: <w:rFonts> și <w:sz> sunt self-closing sau au closing tags
  // De fapt, <w:rPr> conține <w:rFonts> și <w:sz> care sunt self-closing sau au closing tags
  
  // Verifică dacă structura este corectă
  const isValid = (newOpen - originalOpen) === (newClose - originalClose);
  console.log(`\n✅ Structura echilibrată: ${isValid ? '✅' : '❌'}`);
  
  // Verifică dacă placeholder-ul este în a doua celulă
  const placeholderInSecondCell = /<\/w:tc>\s*<w:tc[^>]*>.*?\{\{TRABAJADOR\}\}/s.test(newRow);
  console.log(`✅ Placeholder în a doua celulă: ${placeholderInSecondCell ? '✅' : '❌'}`);
  
  // Salvează pentru verificare
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'trabajador-modified-row.txt'),
    newRow,
    'utf8'
  );
  console.log('\n✅ Rând modificat salvat în trabajador-modified-row.txt');
}
