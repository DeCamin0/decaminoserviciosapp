const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL_FIXED.docx');

console.log('🔧 Reparând PUESTO_TRABAJO...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Găsește rândul care conține PUESTO (nu TRABAJADOR)
  // Trebuie să fie mai specific - caută rândul care are PUESTO dar NU are TRABAJADOR
  const puestoIndex = xml.indexOf('<w:t>PUESTO</w:t>');
  if (puestoIndex === -1) {
    console.log('❌ Nu s-a găsit PUESTO');
    process.exit(1);
  }
  
  // Găsește începutul rândului (caută înapoi până la <w:tr)
  let rowStart = puestoIndex;
  while (rowStart > 0) {
    if (xml.substring(rowStart, rowStart + 5) === '<w:tr') {
      break;
    }
    rowStart--;
    if (rowStart < puestoIndex - 3000) {
      console.log('❌ Nu s-a găsit începutul rândului');
      process.exit(1);
    }
  }
  
  // Găsește sfârșitul rândului
  let rowEnd = puestoIndex;
  let trCount = 0;
  let foundStart = false;
  for (let i = rowStart; i < Math.min(xml.length, rowStart + 5000); i++) {
    if (xml.substring(i, i + 5) === '<w:tr') {
      foundStart = true;
      trCount++;
    }
    if (xml.substring(i, i + 6) === '</w:tr>') {
      trCount--;
      if (trCount === 0 && foundStart) {
        rowEnd = i + 6;
        break;
      }
    }
  }
  
  const fullRow = xml.substring(rowStart, rowEnd);
  console.log('📋 Rând găsit, lungime:', fullRow.length);
  
  // Verifică că este rândul corect (conține PUESTO dar nu TRABAJADOR)
  if (fullRow.includes('TRABAJADOR:')) {
    console.log('⚠️ Rândul găsit este TRABAJADOR, nu PUESTO. Căutând altul...');
    // Caută următorul rând care conține PUESTO
    const nextPuestoIndex = xml.indexOf('<w:t>PUESTO</w:t>', puestoIndex + 1);
    if (nextPuestoIndex === -1) {
      console.log('❌ Nu s-a găsit alt rând cu PUESTO');
      process.exit(1);
    }
    // Repetă procesul pentru următorul rând
    rowStart = nextPuestoIndex;
    while (rowStart > 0 && !xml.substring(rowStart, rowStart + 5).match(/<w:tr/)) {
      rowStart--;
      if (rowStart < nextPuestoIndex - 3000) break;
    }
    rowEnd = nextPuestoIndex;
    trCount = 0;
    foundStart = false;
    for (let i = rowStart; i < Math.min(xml.length, rowStart + 5000); i++) {
      if (xml.substring(i, i + 5) === '<w:tr') {
        foundStart = true;
        trCount++;
      }
      if (xml.substring(i, i + 6) === '</w:tr>') {
        trCount--;
        if (trCount === 0 && foundStart) {
          rowEnd = i + 6;
          break;
        }
      }
    }
    const newFullRow = xml.substring(rowStart, rowEnd);
    if (!newFullRow.includes('TRABAJADOR:')) {
      // Acum adaugă placeholder-ul
      const newRow = newFullRow.replace(
        /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
        '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
      );
      xml = xml.substring(0, rowStart) + newRow + xml.substring(rowEnd);
      console.log('✅ Placeholder adăugat');
    }
  } else {
    // Adaugă placeholder-ul direct
    const newRow = fullRow.replace(
      /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>/s,
      '$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{PUESTO_TRABAJO}}</w:t></w:r></w:p>'
    );
    xml = xml.substring(0, rowStart) + newRow + xml.substring(rowEnd);
    console.log('✅ Placeholder adăugat');
  }
  
  // Verifică rezultatul
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  console.log(`\n✅ {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  
  // Validează XML-ul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  console.log(`📊 Validare XML: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise`);
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
