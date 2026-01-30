const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔄 Mutând placeholder-urile în casuța din dreapta...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Funcție helper pentru a muta un placeholder
  const movePlaceholder = (label, placeholder) => {
    // Pattern: eticheta + placeholder în prima celulă, apoi a doua celulă goală
    // Găsește rândul care conține eticheta
    const rowPattern = new RegExp(
      `(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:t[^>]*>${label}:<\\/w:t>)\\s*<w:t[^>]*>\\s*${placeholder}\\s*<\\/w:t>.*?<\\/w:tc>\\s*(<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\\/w:pPr>)\\s*<\\/w:p>\\s*<\\/w:tc>`,
      's'
    );
    
    const match = xml.match(rowPattern);
    if (match) {
      // Mută placeholder-ul în a doua celulă
      xml = xml.replace(
        rowPattern,
        `$1</w:t></w:r></w:p></w:tc>$2<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`
      );
      return true;
    }
    return false;
  };
  
  // Abordare mai simplă: găsește fiecare placeholder și mută-l
  // 1. TRABAJADOR
  xml = xml.replace(
    /(<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/g,
    '$1</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="6002" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p w14:paraId="2C33DF92" w14:textId="77777777" w:rsidR="0056363A" w:rsidRDefault="0056363A"><w:pPr><w:pStyle w:val="TableParagraph"/><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p></w:tc>'
  );
  
  // Mai simplu: mută placeholder-ul din prima celulă în a doua celulă goală
  // Găsește pattern-ul: prima celulă cu placeholder, apoi a doua celulă goală
  // TRABAJADOR
  xml = xml.replace(
    /(<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>.*?<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s,
    (match) => {
      // Elimină placeholder-ul din prima celulă
      const withoutPlaceholder = match.replace(/\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/, '');
      // Adaugă placeholder-ul în a doua celulă
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // D.N.I.
  xml = xml.replace(
    /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>.*?<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s,
    (match) => {
      const withoutPlaceholder = match.replace(/\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>/, '');
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{DNI}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // PUESTO DE TRABAJO
  xml = xml.replace(
    /(<w:t[^>]*> TRABAJO:<\/w:t>.*?<\/w:r>)\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>.*?<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s,
    (match) => {
      const withoutPlaceholder = match.replace(/\s*<w:r[^>]*>.*?<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>.*?<\/w:r>/, '');
      return withoutPlaceholder.replace(
        /(<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
    }
  );
  
  // EMPRESA
  xml = xml.replace(
    /(<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>.*?<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>\s*<\/w:p>\s*<\/w:tc>/s,
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
  
  console.log('✅ Verificare rezultate:');
  console.log(`  {{TRABAJADOR}} în dreapta: ${trabajadorInRight ? '✅' : '❌'}`);
  console.log(`  {{DNI}} în dreapta: ${dniInRight ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}} în dreapta: ${empresaInRight ? '✅' : '❌'}`);
  
  // Verifică că nu mai sunt în stânga
  const trabajadorInLeft = xml.match(/TRABAJADOR:.*?\{\{TRABAJADOR\}\}/);
  const dniInLeft = xml.match(/D\.N\.I\.:.*?\{\{DNI\}\}/);
  
  if (trabajadorInLeft || dniInLeft) {
    console.log('\n⚠️ Atenție: Unele placeholder-uri încă sunt în stânga!');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
