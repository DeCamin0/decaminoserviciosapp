const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('🔍 Verificând placeholder-ul {{FECHA}} în document...\n');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Caută toate aparițiile lui FECHA
  const fechaMatches = xml.match(/\{\{FECHA\}\}/g);
  console.log(`📋 Apariții {{FECHA}}: ${fechaMatches ? fechaMatches.length : 0}`);
  
  // Caută contextul în jurul lui FECHA
  const fechaIndex = xml.indexOf('{{FECHA}}');
  if (fechaIndex !== -1) {
    const context = xml.substring(Math.max(0, fechaIndex - 200), Math.min(xml.length, fechaIndex + 200));
    console.log('\n📝 Context în jurul {{FECHA}}:');
    console.log(context);
    
    // Extrage textul vizibil
    const textContext = context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('\n📝 Text vizibil:');
    console.log(textContext);
  }
  
  // Caută "San Sebastián" sau "Reyes"
  const sanSebastianIndex = xml.indexOf('San Sebastián');
  if (sanSebastianIndex !== -1) {
    const context = xml.substring(Math.max(0, sanSebastianIndex - 100), Math.min(xml.length, sanSebastianIndex + 300));
    console.log('\n📝 Context "San Sebastián":');
    console.log(context.substring(0, 400));
  }
  
  // Caută pattern-ul "En" urmat de "a" și apoi FECHA
  const enPattern = /En.*?a.*?\{\{FECHA\}\}/s;
  if (enPattern.test(xml)) {
    console.log('\n✅ Pattern "En ... a {{FECHA}}" găsit!');
    const match = xml.match(enPattern);
    if (match) {
      console.log('Match:', match[0].substring(0, 200));
    }
  } else {
    console.log('\n❌ Pattern "En ... a {{FECHA}}" NU a fost găsit!');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
