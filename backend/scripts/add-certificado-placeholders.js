const AdmZip = require('adm-zip');
const path = require('path');

const inputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('🔧 Adăugând placeholder-uri în documentul "Certificado renuncia reconocimiento médico"...');

try {
  const zip = new AdmZip(inputPath);
  let xml = zip.readAsText('word/document.xml');
  
  const originalLength = xml.length;
  
  // 1. Numele angajatului - după "con DNI " (în locul spațiului gol)
  // Caută: "con DNI " urmat de tab-uri și spații goale
  xml = xml.replace(
    /(<w:t xml:space="preserve">con DNI <\/w:t>)(<w:r><w:rPr><w:u w:val="single"\/><\/w:rPr><w:tab\/><\/w:r><w:r><w:rPr><w:u w:val="single"\/><\/w:rPr><w:tab\/><\/w:r>)/,
    '$1<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r>$2'
  );
  
  // 2. DNI - după tab-urile de după "con DNI"
  // Dacă nu s-a găsit mai sus, încercăm o altă variantă
  if (xml.length === originalLength) {
    // Variantă alternativă: după "con DNI " direct
    xml = xml.replace(
      /(<w:t xml:space="preserve">con DNI <\/w:t>)(<w:r><w:rPr><w:u[^>]*><\/w:rPr><w:tab\/><\/w:r>)/,
      '$1<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{TRABAJADOR}}</w:t></w:r>$2'
    );
  }
  
  // 3. EMPRESA - după "empresa" și tab
  xml = xml.replace(
    /(<w:t>empresa<\/w:t>)(<w:r><w:tab\/><\/w:r><w:r><w:tab\/><w:t>con CIF<\/w:t>)/,
    '$1<w:r><w:t xml:space="preserve"> {{EMPRESA}}</w:t></w:r>$2'
  );
  
  // 4. CIF - după "con CIF" și tab
  xml = xml.replace(
    /(<w:t>con CIF<\/w:t>)(<\/w:r><\/w:p>)/,
    '$1<w:r><w:t xml:space="preserve"> {{CIF}}</w:t></w:r>$2'
  );
  
  // 5. FECHA - în locul "En a de 2026"
  // Caută pattern-ul exact pentru data
  xml = xml.replace(
    /(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s,
    '$1{{FECHA}}$2'
  );
  
  // Variantă simplificată dacă nu s-a găsit
  if (xml.length === originalLength || !xml.includes('{{FECHA}}')) {
    xml = xml.replace(
      /(<w:t>En<\/w:t>.*?<w:t>a<\/w:t>.*?<w:t>de<\/w:t>.*?<w:t>de<\/w:t>.*?<w:t>)2026(<\/w:t>)/s,
      '$1{{FECHA}}$2'
    );
  }
  
  // 6. FIRMA (nume angajat) - în locul punctelor după "D/Dª"
  xml = xml.replace(
    /(<w:t>D\/Dª)(………………………………)(<\/w:t>)/,
    '$1 {{TRABAJADOR}}$3'
  );
  
  // Verifică dacă s-au făcut modificări
  const hasChanges = xml.includes('{{TRABAJADOR}}') || 
                     xml.includes('{{EMPRESA}}') || 
                     xml.includes('{{CIF}}') || 
                     xml.includes('{{FECHA}}');
  
  if (!hasChanges) {
    console.log('⚠️ Nu s-au găsit toate pattern-urile. Încercăm variante alternative...');
    
    // Variante alternative mai simple
    xml = xml.replace(/con DNI\s+como/, 'con DNI {{TRABAJADOR}} como');
    xml = xml.replace(/de la\s+empresa/, 'de la empresa {{EMPRESA}}');
    xml = xml.replace(/con CIF\s*MANIFIESTA/, 'con CIF {{CIF}} MANIFIESTA');
    xml = xml.replace(/En a de 2026/, 'En {{FECHA}}');
    xml = xml.replace(/D\/Dª[\.]+/, 'D/Dª {{TRABAJADOR}}');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  
  // Verifică rezultatul
  const finalXml = zip.readAsText('word/document.xml');
  const placeholders = {
    '{{TRABAJADOR}}': finalXml.includes('{{TRABAJADOR}}'),
    '{{EMPRESA}}': finalXml.includes('{{EMPRESA}}'),
    '{{CIF}}': finalXml.includes('{{CIF}}'),
    '{{FECHA}}': finalXml.includes('{{FECHA}}'),
  };
  
  console.log('\n✅ Documentul salvat: Certificado renuncia reconocimiento médico 2026_FINAL.docx');
  console.log('\n📋 Placeholder-uri adăugate:');
  for (const [placeholder, found] of Object.entries(placeholders)) {
    console.log(`  ${found ? '✅' : '❌'} ${placeholder}`);
  }
  
  if (Object.values(placeholders).every(v => v)) {
    console.log('\n✅ Toate placeholder-urile au fost adăugate cu succes!');
  } else {
    console.log('\n⚠️ Unele placeholder-uri nu au fost găsite. Verifică manual documentul.');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
