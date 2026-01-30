const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri corect (folosind regex pentru rânduri complete)...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Salvează XML-ul original pentru comparație
  const originalXml = xml;
  
  // Funcție helper pentru a adăuga placeholder într-un rând
  const addPlaceholderToRow = (rowXml, placeholder) => {
    // Găsește a doua celulă (după prima </w:tc>)
    // Pattern: </w:tc> urmat de <w:tc> cu o celulă goală
    const secondCellPattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    
    if (secondCellPattern.test(rowXml)) {
      return rowXml.replace(
        secondCellPattern,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`
      );
    }
    return rowXml; // Nu modifică dacă nu găsește pattern-ul
  };
  
  // 1. TRABAJADOR - găsește rândul complet
  const trabajadorRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s;
  const trabajadorMatch = xml.match(trabajadorRowPattern);
  if (trabajadorMatch) {
    const newRow = addPlaceholderToRow(trabajadorMatch[0], '{{TRABAJADOR}}');
    xml = xml.replace(trabajadorRowPattern, newRow);
    console.log('✅ {{TRABAJADOR}} adăugat');
  }
  
  // 2. D.N.I.
  const dniRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s;
  const dniMatch = xml.match(dniRowPattern);
  if (dniMatch) {
    const newRow = addPlaceholderToRow(dniMatch[0], '{{DNI}}');
    xml = xml.replace(dniRowPattern, newRow);
    console.log('✅ {{DNI}} adăugat');
  }
  
  // 3. PUESTO DE TRABAJO
  const puestoRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s;
  const puestoMatch = xml.match(puestoRowPattern);
  if (puestoMatch) {
    const newRow = addPlaceholderToRow(puestoMatch[0], '{{PUESTO_TRABAJO}}');
    xml = xml.replace(puestoRowPattern, newRow);
    console.log('✅ {{PUESTO_TRABAJO}} adăugat');
  }
  
  // 4. EMPRESA
  const empresaRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s;
  const empresaMatch = xml.match(empresaRowPattern);
  if (empresaMatch) {
    const newRow = addPlaceholderToRow(empresaMatch[0], '{{EMPRESA}}');
    xml = xml.replace(empresaRowPattern, newRow);
    console.log('✅ {{EMPRESA}} adăugat');
  }
  
  // Verifică rezultatul
  const trabajadorInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{TRABAJADOR\}\}<\/w:t>/s);
  const dniInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{DNI\}\}<\/w:t>/s);
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  const empresaInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{EMPRESA\}\}<\/w:t>/s);
  
  console.log('\n✅ Verificare rezultate:');
  console.log(`  {{TRABAJADOR}} în dreapta: ${trabajadorInRight ? '✅' : '❌'}`);
  console.log(`  {{DNI}} în dreapta: ${dniInRight ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}} în dreapta: ${empresaInRight ? '✅' : '❌'}`);
  
  // Validează XML-ul - compară cu originalul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpenTags = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalCloseTags = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  console.log(`\n📊 Validare XML:`);
  console.log(`  Original: ${originalOpenTags} deschise, ${originalCloseTags} închise`);
  console.log(`  Modificat: ${openTags} deschise, ${closeTags} închise`);
  console.log(`  Diferență deschise: ${openTags - originalOpenTags}`);
  console.log(`  Diferență închise: ${closeTags - originalCloseTags}`);
  
  // Ar trebui să adăugăm exact 4 tag-uri <w:r> și 4 tag-uri <w:t> (8 deschise, 8 închise)
  // Plus 4 tag-uri <w:rPr> (4 deschise, 4 închise)
  // Total: 12 deschise, 12 închise
  const expectedDiff = 12;
  if (Math.abs((openTags - originalOpenTags) - expectedDiff) <= 2 && 
      Math.abs((closeTags - originalCloseTags) - expectedDiff) <= 2) {
    console.log('✅ Structura XML pare corectă!');
  } else {
    console.log('⚠️ Diferența nu corespunde cu așteptările (ar trebui ~12 tag-uri noi)');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
