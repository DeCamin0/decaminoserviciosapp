const AdmZip = require('adm-zip');
const path = require('path');

const inputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri (versiune finală cu pattern-uri exacte)...');

try {
  const zip = new AdmZip(inputPath);
  let xml = zip.readAsText('word/document.xml');
  
  // 1. Numele angajatului - după "con DNI " (în locul tab-urilor goale)
  // Pattern: "con DNI </w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:tab/></w:r>"
  xml = xml.replace(
    /(<w:t xml:space="preserve">con DNI <\/w:t><\/w:r>)(<w:r><w:rPr><w:u w:val="single"\/><\/w:rPr><w:tab\/><\/w:r><w:r><w:rPr><w:u w:val="single"\/><\/w:rPr><w:tab\/><\/w:r>)/,
    '$1<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r>$2'
  );
  
  // 2. EMPRESA - după "empresa" (după tab)
  // Pattern: "empresa</w:t></w:r><w:r><w:tab/></w:r><w:r><w:tab/><w:t>con CIF</w:t>"
  xml = xml.replace(
    /(<w:t>empresa<\/w:t><\/w:r><w:r><w:tab\/><\/w:r>)(<w:r><w:tab\/><w:t>con CIF<\/w:t>)/,
    '$1<w:r><w:t xml:space="preserve"> {{EMPRESA}}</w:t></w:r>$2'
  );
  
  // 3. CIF - după "con CIF"
  // Pattern: "con CIF</w:t></w:r></w:p>"
  xml = xml.replace(
    /(<w:t>con CIF<\/w:t><\/w:r>)(<\/w:p>)/,
    '$1<w:r><w:t xml:space="preserve"> {{CIF}}</w:t></w:r>$2'
  );
  
  // 4. FECHA - căutăm "En" în document
  // Să vedem dacă există "En" în text
  const enIndex = xml.indexOf('<w:t>En</w:t>');
  if (enIndex !== -1) {
    // Caută pattern-ul pentru data
    const fechaContext = xml.substring(Math.max(0, enIndex - 100), Math.min(xml.length, enIndex + 800));
    // Înlocuiește "2026" dacă există în context
    if (fechaContext.includes('2026')) {
      xml = xml.replace(
        /(<w:t>En<\/w:t>.*?<w:t>)2026(<\/w:t>)/s,
        '$1{{FECHA}}$2'
      );
    }
  }
  
  // 5. FIRMA (nume angajat) - în locul punctelor după "D/Dª"
  // Pattern: "D/Dª………………………………</w:t>"
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
    console.log('\n⚠️ Unele placeholder-uri lipsesc.');
    if (!placeholders['{{FECHA}}']) {
      console.log('   ℹ️ {{FECHA}} - poate că nu există "En a de 2026" în document. Verifică manual.');
    }
    if (!placeholders['{{TRABAJADOR}}']) {
      console.log('   ℹ️ {{TRABAJADOR}} - verifică dacă s-a adăugat după "con DNI" și după "D/Dª".');
    }
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
