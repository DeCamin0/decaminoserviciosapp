const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri (versiunea FINALĂ corectă)...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  const originalXml = xml;
  
  // Funcție helper - adaugă placeholder păstrând structura XML corectă
  const addPlaceholderToRow = (rowXml, placeholder) => {
    // Pattern: găsește a doua celulă goală (după prima </w:tc>)
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    
    if (pattern.test(rowXml)) {
      // Adaugă placeholder-ul cu structura corectă
      // <w:rFonts> și <w:sz> sunt self-closing în Word XML, deci folosim <w:rFonts .../> și <w:sz .../>
      return rowXml.replace(
        pattern,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`
      );
    }
    return rowXml;
  };
  
  // 1. TRABAJADOR
  const trabajadorRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s;
  const trabajadorMatch = xml.match(trabajadorRowPattern);
  if (trabajadorMatch) {
    xml = xml.replace(trabajadorRowPattern, (match) => addPlaceholderToRow(match, '{{TRABAJADOR}}'));
    console.log('✅ {{TRABAJADOR}} adăugat');
  }
  
  // 2. D.N.I.
  const dniRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s;
  const dniMatch = xml.match(dniRowPattern);
  if (dniMatch) {
    xml = xml.replace(dniRowPattern, (match) => addPlaceholderToRow(match, '{{DNI}}'));
    console.log('✅ {{DNI}} adăugat');
  }
  
  // 3. PUESTO DE TRABAJO
  const puestoRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s;
  const puestoMatch = xml.match(puestoRowPattern);
  if (puestoMatch) {
    xml = xml.replace(puestoRowPattern, (match) => addPlaceholderToRow(match, '{{PUESTO_TRABAJO}}'));
    console.log('✅ {{PUESTO_TRABAJO}} adăugat');
  }
  
  // 4. EMPRESA
  const empresaRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s;
  const empresaMatch = xml.match(empresaRowPattern);
  if (empresaMatch) {
    xml = xml.replace(empresaRowPattern, (match) => addPlaceholderToRow(match, '{{EMPRESA}}'));
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
  
  // Validează XML-ul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpenTags = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalCloseTags = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  console.log(`\n📊 Validare XML:`);
  console.log(`  Original: ${originalOpenTags} deschise, ${originalCloseTags} închise`);
  console.log(`  Modificat: ${openTags} deschise, ${closeTags} închise`);
  console.log(`  Diferență: ${openTags - originalOpenTags} deschise, ${closeTags - originalCloseTags} închise`);
  
  // Ar trebui să adăugăm pentru fiecare placeholder:
  // <w:r>, <w:rPr>, <w:rFonts/>, <w:sz/>, <w:t> (5 deschise)
  // </w:rPr>, </w:t>, </w:r> (3 închise)
  // Total per placeholder: 5 deschise, 3 închise
  // Pentru 4 placeholder-uri: 20 deschise, 12 închise
  const expectedOpenDiff = 20;
  const expectedCloseDiff = 12;
  
  if (Math.abs((openTags - originalOpenTags) - expectedOpenDiff) <= 2 && 
      Math.abs((closeTags - originalCloseTags) - expectedCloseDiff) <= 2) {
    console.log('✅ Structura XML pare corectă!');
  } else {
    console.log(`⚠️ Diferența nu corespunde (așteptat: ${expectedOpenDiff} deschise, ${expectedCloseDiff} închise)`);
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
