const AdmZip = require('adm-zip');
const path = require('path');

// Folosim documentul original și refacem modificările corect
const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând documentul corupt...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Strategie: găsim fiecare rând de tabel și mutăm placeholder-ul corect
  // Fiecare rând are: <w:tr> ... <w:tc> (eticheta) ... </w:tc> <w:tc> (valoare goală) ... </w:tc> </w:tr>
  
  // 1. TRABAJADOR - mută din prima celulă în a doua
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      // Elimină placeholder-ul din prima celulă
      const withoutPlaceholder = match.replace(/\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/, '');
      // Adaugă placeholder-ul în a doua celulă (înainte de </w:p>)
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // 2. D.N.I.
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      const withoutPlaceholder = match.replace(/\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>/, '');
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // 3. PUESTO DE TRABAJO (mai complex, poate fi pe mai multe linii)
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*> TRABAJO:<\/w:t>)\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      const withoutPlaceholder = match.replace(/\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>/, '</w:r>');
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // 4. EMPRESA
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      const withoutPlaceholder = match.replace(/\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>/, '');
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{EMPRESA}}</w:t></w:r></w:p>'
      );
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
  
  // Validează XML-ul (verifică că nu am stricat tag-urile)
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`\n📊 Validare XML: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise`);
  
  if (Math.abs(openTags - closeTags) > 10) {
    console.log('⚠️ Atenție: Diferență mare între tag-uri deschise/închise!');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost reparat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
