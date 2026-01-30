const AdmZip = require('adm-zip');
const path = require('path');

const inputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri (versiune îmbunătățită)...');

try {
  const zip = new AdmZip(inputPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Salvează o copie pentru debugging
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'certificado-before.xml'),
    xml.substring(0, 10000),
    'utf8'
  );
  
  // 1. Numele angajatului - după "con DNI "
  // Caută exact structura: "con DNI " urmat de tab-uri
  xml = xml.replace(
    /(<w:t xml:space="preserve">con DNI <\/w:t>)(<w:r><w:rPr><w:u w:val="single"\/><\/w:rPr><w:tab\/><\/w:r>)/,
    '$1<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r>$2'
  );
  
  // 2. EMPRESA - după "empresa" (trebuie să fie în același paragraf)
  // Caută: "empresa</w:t></w:r><w:r><w:tab/>" urmat de "con CIF"
  xml = xml.replace(
    /(<w:t>empresa<\/w:t><\/w:r><w:r><w:tab\/><\/w:r><w:r><w:tab\/><w:t>con CIF<\/w:t>)/,
    '<w:t>empresa</w:t></w:r><w:r><w:t xml:space="preserve"> {{EMPRESA}}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:tab/><w:t>con CIF</w:t>'
  );
  
  // 3. CIF - după "con CIF"
  xml = xml.replace(
    /(<w:t>con CIF<\/w:t>)(<\/w:r><\/w:p>)/,
    '$1<w:r><w:t xml:space="preserve"> {{CIF}}</w:t></w:r>$2'
  );
  
  // 4. FECHA - în locul "En a de 2026"
  // Caută pattern-ul complet pentru data
  const fechaPattern = /(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s;
  
  if (fechaPattern.test(xml)) {
    xml = xml.replace(fechaPattern, '$1{{FECHA}}$2');
  } else {
    // Variantă simplificată
    xml = xml.replace(/(<w:t>En<\/w:t>.*?<w:t>a<\/w:t>.*?<w:t>de<\/w:t>.*?<w:t>de<\/w:t>.*?<w:t>)2026(<\/w:t>)/s, '$1{{FECHA}}$2');
  }
  
  // 5. FIRMA (nume angajat) - în locul punctelor după "D/Dª"
  xml = xml.replace(
    /(<w:t>D\/Dª)([\.]+)(<\/w:t>)/,
    '$1 {{TRABAJADOR}}$3'
  );
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  
  // Verifică rezultatul
  const finalZip = new AdmZip(outputPath);
  const finalXml = finalZip.readAsText('word/document.xml');
  
  const placeholders = {
    '{{TRABAJADOR}}': (finalXml.match(/\{\{TRABAJADOR\}\}/g) || []).length,
    '{{EMPRESA}}': (finalXml.match(/\{\{EMPRESA\}\}/g) || []).length,
    '{{CIF}}': (finalXml.match(/\{\{CIF\}\}/g) || []).length,
    '{{FECHA}}': (finalXml.match(/\{\{FECHA\}\}/g) || []).length,
  };
  
  console.log('\n✅ Documentul salvat: Certificado renuncia reconocimiento médico 2026_FINAL.docx');
  console.log('\n📋 Placeholder-uri adăugate:');
  for (const [placeholder, count] of Object.entries(placeholders)) {
    console.log(`  ${count > 0 ? '✅' : '❌'} ${placeholder} (${count} ori)`);
  }
  
  // Verifică dacă toate sunt prezente
  const allPresent = Object.values(placeholders).every(v => v > 0);
  
  if (allPresent) {
    console.log('\n✅ Toate placeholder-urile au fost adăugate cu succes!');
  } else {
    console.log('\n⚠️ Unele placeholder-uri lipsesc. Verifică manual documentul.');
    console.log('\n💡 Deschide documentul în Word și verifică:');
    console.log('   1. {{TRABAJADOR}} - după "con DNI" și la final după "D/Dª"');
    console.log('   2. {{EMPRESA}} - după "de la empresa"');
    console.log('   3. {{CIF}} - după "con CIF"');
    console.log('   4. {{FECHA}} - în locul "2026" din "En a de 2026"');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
