const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Mutând placeholder-urile (abordare simplă și sigură)...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Strategie: găsim placeholder-ul în prima celulă și îl mutăm în a doua celulă goală
  // Folosim o abordare foarte conservatoare - doar mutăm textul, păstrând toate tag-urile
  
  // 1. TRABAJADOR
  // Găsește: TRABAJADOR: {{TRABAJADOR}} în prima celulă, apoi a doua celulă goală
  xml = xml.replace(
    /(<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  // Adaugă în a doua celulă (găsește prima celulă goală după TRABAJADOR)
  xml = xml.replace(
    /(<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
    (match, firstCell, secondCell) => {
      // Adaugă placeholder-ul în a doua celulă
      const secondCellWithPlaceholder = secondCell.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p>'
      );
      return firstCell + secondCellWithPlaceholder + '</w:tc>';
    }
  );
  
  // 2. D.N.I.
  xml = xml.replace(
    /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  xml = xml.replace(
    /(<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
    (match, firstCell, secondCell) => {
      const secondCellWithPlaceholder = secondCell.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p>'
      );
      return firstCell + secondCellWithPlaceholder + '</w:tc>';
    }
  );
  
  // 3. PUESTO DE TRABAJO
  xml = xml.replace(
    /(<w:t[^>]*> TRABAJO:<\/w:t>)\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>/g,
    '$1</w:t></w:r>'
  );
  
  xml = xml.replace(
    /(<w:t[^>]*> TRABAJO:<\/w:t>.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
    (match, firstCell, secondCell) => {
      const secondCellWithPlaceholder = secondCell.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
      return firstCell + secondCellWithPlaceholder + '</w:tc>';
    }
  );
  
  // 4. EMPRESA
  xml = xml.replace(
    /(<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  xml = xml.replace(
    /(<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tc>)\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s,
    (match, firstCell, secondCell) => {
      const secondCellWithPlaceholder = secondCell.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{EMPRESA}}</w:t></w:r></w:p>'
      );
      return firstCell + secondCellWithPlaceholder + '</w:tc>';
    }
  );
  
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
    console.log('⚠️ Atenție: Diferență între tag-uri!');
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
