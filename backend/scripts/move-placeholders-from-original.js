const AdmZip = require('adm-zip');
const path = require('path');

// Folosim documentul ORIGINAL
const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Mutând placeholder-urile din documentul ORIGINAL...');

try {
  const zip = new AdmZip(originalPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Verifică dacă placeholder-urile există deja
  const hasTrabajador = xml.includes('{{TRABAJADOR}}');
  const hasDNI = xml.includes('{{DNI}}');
  const hasPuesto = xml.includes('{{PUESTO_TRABAJO}}');
  const hasEmpresa = xml.includes('{{EMPRESA}}');
  
  console.log('📋 Status placeholder-uri în original:');
  console.log(`  {{TRABAJADOR}}: ${hasTrabajador ? '✅' : '❌'}`);
  console.log(`  {{DNI}}: ${hasDNI ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}}: ${hasPuesto ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}}: ${hasEmpresa ? '✅' : '❌'}`);
  
  // Dacă nu există placeholder-urile, le adăugăm mai întâi
  if (!hasTrabajador) {
    // Adaugă {{TRABAJADOR}} după "TRABAJADOR:"
    xml = xml.replace(
      /(<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*(<\/w:r>)/g,
      '$1<w:t xml:space="preserve"> {{TRABAJADOR}}</w:t>$2'
    );
  }
  
  if (!hasDNI) {
    // Adaugă {{DNI}} după "D.N.I.:"
    xml = xml.replace(
      /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*(<\/w:r>)/g,
      '$1<w:t xml:space="preserve"> {{DNI}}</w:t>$2'
    );
  }
  
  if (!hasPuesto) {
    // Adaugă {{PUESTO_TRABAJO}} după "PUESTO DE TRABAJO:"
    xml = xml.replace(
      /(<w:t[^>]*> TRABAJO:<\/w:t>)\s*(<\/w:r>)/g,
      '$1<w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t>$2'
    );
  }
  
  if (!hasEmpresa) {
    // Adaugă {{EMPRESA}} după "EMPRESA:"
    xml = xml.replace(
      /(<w:t[^>]*>EMPRESA:<\/w:t>)\s*(<\/w:r>)/g,
      '$1<w:t xml:space="preserve"> {{EMPRESA}}</w:t>$2'
    );
  }
  
  // Acum mută placeholder-urile în casuța din dreapta
  // Strategie: găsește rândul complet și mută placeholder-ul
  
  // 1. TRABAJADOR - mută din prima celulă în a doua
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      // Elimină placeholder-ul din prima celulă
      let fixed = match.replace(/\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/, '');
      // Adaugă placeholder-ul în a doua celulă (înainte de </w:p>)
      fixed = fixed.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p>'
      );
      return fixed;
    }
  );
  
  // 2. D.N.I.
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      let fixed = match.replace(/\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>/, '');
      fixed = fixed.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p>'
      );
      return fixed;
    }
  );
  
  // 3. PUESTO DE TRABAJO
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*> TRABAJO:<\/w:t>)\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      let fixed = match.replace(/\s*<\/w:r>\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>/, '</w:r>');
      fixed = fixed.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
      return fixed;
    }
  );
  
  // 4. EMPRESA
  xml = xml.replace(
    /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:p>.*?<\/w:tc>\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>.*?<\/w:tr>/s,
    (match) => {
      let fixed = match.replace(/\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>/, '');
      fixed = fixed.replace(
        /(<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{EMPRESA}}</w:t></w:r></w:p>'
      );
      return fixed;
    }
  );
  
  // Verifică rezultatul
  const trabajadorInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{TRABAJADOR\}\}<\/w:t>/s);
  const dniInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{DNI\}\}<\/w:t>/s);
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  const empresaInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{EMPRESA\}\}<\/w:t>/s);
  
  const trabajadorInLeft = xml.match(/TRABAJADOR:.*?\{\{TRABAJADOR\}\}/);
  const dniInLeft = xml.match(/D\.N\.I\.:.*?\{\{DNI\}\}/);
  
  console.log('\n✅ Verificare rezultate:');
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
