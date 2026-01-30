const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder pentru dată (FECHA)...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  const originalXml = xml;
  
  // Găsește textul "En a de de 2026" și înlocuiește "a de de 2026" cu {{FECHA}}
  // Pattern: <w:t>En</w:t> ... <w:t>a</w:t> ... <w:t>de</w:t> ... <w:t>de</w:t> ... <w:t>2026</w:t>
  // Înlocuiește tot de la "a" până la "2026" cu {{FECHA}}
  
  // Abordare: găsește rândul care conține "En" și "2026" și înlocuiește partea cu data
  const fechaPattern = /(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s;
  
  if (fechaPattern.test(xml)) {
    xml = xml.replace(
      fechaPattern,
      '$1{{FECHA}}$2'
    );
    console.log('✅ Placeholder {{FECHA}} adăugat');
  } else {
    // Încearcă un pattern mai simplu - doar să găsească "2026" după "En"
    const simplePattern = /(<w:t>En<\/w:t>.*?<w:t>)2026(<\/w:t>)/s;
    if (simplePattern.test(xml)) {
      xml = xml.replace(
        simplePattern,
        '$1{{FECHA}}$2'
      );
      console.log('✅ Placeholder {{FECHA}} adăugat (pattern simplu)');
    } else {
      // Încearcă să găsească doar "2026" în contextul "En"
      const contextPattern = /(En.*?)(a.*?de.*?de.*?2026)/s;
      const contextMatch = xml.match(contextPattern);
      if (contextMatch) {
        // Înlocuiește doar partea cu data
        xml = xml.replace(
          /(a.*?de.*?de.*?)2026/s,
          '{{FECHA}}'
        );
        console.log('✅ Placeholder {{FECHA}} adăugat (context pattern)');
      } else {
        console.log('⚠️ Nu s-a găsit pattern-ul pentru dată');
        // Caută manual "2026" în contextul "En"
        const enIndex = xml.indexOf('<w:t>En</w:t>');
        if (enIndex !== -1) {
          const context = xml.substring(enIndex, Math.min(xml.length, enIndex + 500));
          console.log('Context "En":', context.substring(0, 300));
        }
      }
    }
  }
  
  // Verifică rezultatul
  const fechaInXml = xml.includes('{{FECHA}}');
  const stillHas2026 = xml.match(/En.*?2026/s);
  
  console.log('\n✅ Verificare rezultate:');
  console.log(`  {{FECHA}} în XML: ${fechaInXml ? '✅' : '❌'}`);
  console.log(`  Mai are "2026" după "En": ${stillHas2026 ? '❌' : '✅'}`);
  
  // Validează XML-ul
  const openTags = (xml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpenTags = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalCloseTags = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  console.log(`\n📊 Validare XML:`);
  console.log(`  Original: ${originalOpenTags} deschise, ${originalCloseTags} închise`);
  console.log(`  Modificat: ${openTags} deschise, ${closeTags} închise`);
  console.log(`  Diferență: ${openTags - originalOpenTags} deschise, ${closeTags - originalCloseTags} închise`);
  
  if (Math.abs(openTags - originalOpenTags) <= 2 && 
      Math.abs(closeTags - originalCloseTags) <= 2) {
    console.log('✅ Structura XML pare corectă!');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
