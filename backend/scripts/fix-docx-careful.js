const AdmZip = require('adm-zip');
const path = require('path');

// Folosim documentul original (FIXED) care funcționa
const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând documentul cu grijă...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Abordare: găsim exact structura fiecărui rând și mutăm placeholder-ul fără să stricăm tag-urile
  
  // 1. TRABAJADOR - găsește rândul complet
  const trabajadorPattern = /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s;
  
  xml = xml.replace(trabajadorPattern, (match, labelPart, secondCellPart) => {
    // Elimină placeholder-ul din prima celulă (după labelPart)
    const firstCellFixed = labelPart + '</w:t></w:r></w:p></w:tc>';
    // Adaugă placeholder-ul în a doua celulă (înainte de </w:p>)
    const secondCellFixed = secondCellPart.replace(
      /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p>'
    );
    // Reconstruiește rândul
    const rowStart = match.match(/<w:tr[^>]*>/)[0];
    const rowEnd = '</w:tr>';
    return rowStart + firstCellFixed + secondCellFixed + rowEnd;
  });
  
  // 2. D.N.I.
  const dniPattern = /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s;
  
  xml = xml.replace(dniPattern, (match, labelPart, secondCellPart) => {
    const firstCellFixed = labelPart + '</w:t></w:r></w:p></w:tc>';
    const secondCellFixed = secondCellPart.replace(
      /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p>'
    );
    const rowStart = match.match(/<w:tr[^>]*>/)[0];
    const rowEnd = '</w:tr>';
    return rowStart + firstCellFixed + secondCellFixed + rowEnd;
  });
  
  // 3. PUESTO DE TRABAJO
  const puestoPattern = /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*> TRABAJO:<\/w:t>)\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s;
  
  xml = xml.replace(puestoPattern, (match, labelPart, secondCellPart) => {
    const firstCellFixed = labelPart + '</w:t></w:r></w:p></w:tc>';
    const secondCellFixed = secondCellPart.replace(
      /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
    );
    const rowStart = match.match(/<w:tr[^>]*>/)[0];
    const rowEnd = '</w:tr>';
    return rowStart + firstCellFixed + secondCellFixed + rowEnd;
  });
  
  // 4. EMPRESA
  const empresaPattern = /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s;
  
  xml = xml.replace(empresaPattern, (match, labelPart, secondCellPart) => {
    const firstCellFixed = labelPart + '</w:t></w:r></w:p></w:tc>';
    const secondCellFixed = secondCellPart.replace(
      /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{EMPRESA}}</w:t></w:r></w:p>'
    );
    const rowStart = match.match(/<w:tr[^>]*>/)[0];
    const rowEnd = '</w:tr>';
    return rowStart + firstCellFixed + secondCellFixed + rowEnd;
  });
  
  // Verifică rezultatul
  const trabajadorInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{TRABAJADOR\}\}<\/w:t>/s);
  const dniInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{DNI\}\}<\/w:t>/s);
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  const empresaInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{EMPRESA\}\}<\/w:t>/s);
  
  const trabajadorInLeft = xml.match(/TRABAJADOR:.*?\{\{TRABAJADOR\}\}/);
  const dniInLeft = xml.match(/D\.N\.I\.:.*?\{\{DNI\}\}/);
  
  console.log('✅ Verificare rezultate:');
  console.log(`  {{TRABAJADOR}} în dreapta: ${trabajadorInRight ? '✅' : '❌'}`);
  console.log(`  {{DNI}} în dreapta: ${dniInRight ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}} în dreapta: ${empresaInRight ? '✅' : '❌'}`);
  console.log(`  {{TRABAJADOR}} în stânga: ${trabajadorInLeft ? '❌' : '✅'}`);
  console.log(`  {{DNI}} în stânga: ${dniInLeft ? '❌' : '✅'}`);
  
  // Validează XML-ul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`\n📊 Validare XML: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise`);
  
  if (Math.abs(openTags - closeTags) > 5) {
    console.log('⚠️ Atenție: Diferență între tag-uri deschise/închise!');
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
