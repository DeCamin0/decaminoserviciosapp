const AdmZip = require('adm-zip');
const path = require('path');

// Folosim documentul ORIGINAL complet
const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri DIRECT în casuța din dreapta (fără modificări în stânga)...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Strategie: găsește fiecare rând de tabel și adaugă placeholder-ul în a doua celulă (goală)
  // Fără să modificăm prima celulă deloc!
  
  // 1. TRABAJADOR - găsește rândul care conține "TRABAJADOR:" și adaugă placeholder în a doua celulă
  const trabajadorRow = xml.match(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s);
  if (trabajadorRow) {
    const newRow = trabajadorRow[0].replace(
      /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p></w:tc>'
    );
    xml = xml.replace(trabajadorRow[0], newRow);
    console.log('✅ {{TRABAJADOR}} adăugat');
  }
  
  // 2. D.N.I.
  const dniRow = xml.match(/<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s);
  if (dniRow) {
    const newRow = dniRow[0].replace(
      /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p></w:tc>'
    );
    xml = xml.replace(dniRow[0], newRow);
    console.log('✅ {{DNI}} adăugat');
  }
  
  // 3. PUESTO DE TRABAJO - găsește rândul care conține "PUESTO" și "TRABAJO"
  const puestoRow = xml.match(/<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s);
  if (puestoRow) {
    const newRow = puestoRow[0].replace(
      /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p></w:tc>'
    );
    xml = xml.replace(puestoRow[0], newRow);
    console.log('✅ {{PUESTO_TRABAJO}} adăugat');
  }
  
  // 4. EMPRESA
  const empresaRow = xml.match(/<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s);
  if (empresaRow) {
    const newRow = empresaRow[0].replace(
      /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{EMPRESA}}</w:t></w:r></w:p></w:tc>'
    );
    xml = xml.replace(empresaRow[0], newRow);
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
  
  // Validează XML-ul - trebuie să fie perfect echilibrat
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`\n📊 Validare XML: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise`);
  
  if (Math.abs(openTags - closeTags) > 2) {
    console.log('⚠️ Atenție: Diferență între tag-uri!');
    console.log(`   Diferență: ${Math.abs(openTags - closeTags)}`);
  } else {
    console.log('✅ Structura XML pare corectă!');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
