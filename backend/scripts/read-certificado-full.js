const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('📖 Citind documentul complet "Certificado renuncia reconocimiento médico"...\n');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Extrage toate textul din document
  const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  
  if (textMatches) {
    const allText = textMatches
      .map(match => match.replace(/<[^>]+>/g, ''))
      .filter(text => text.trim().length > 0)
      .join(' ');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 CONȚINUTUL COMPLET AL DOCUMENTULUI:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(allText);
    console.log('\n═══════════════════════════════════════════════════════════');
    
    // Analizează structura
    console.log('\n📋 ANALIZĂ STRUCTURĂ:\n');
    
    // Caută placeholder-uri
    const placeholders = allText.match(/\{\{([^}]+)\}\}/g);
    if (placeholders) {
      console.log('✅ Placeholder-uri găsite:');
      placeholders.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p}`);
      });
    }
    
    // Caută secțiuni importante
    console.log('\n📝 Secțiuni importante:');
    
    if (allText.includes('RENUNCIA')) {
      console.log('   ✅ RENUNCIA - Document de renunțare');
    }
    
    if (allText.includes('RECONOCIMIENTO MÉDICO')) {
      console.log('   ✅ RECONOCIMIENTO MÉDICO - Despre recunoașterea medicală');
    }
    
    if (allText.includes('TRABAJADOR')) {
      console.log('   ✅ TRABAJADOR - Informații despre angajat');
    }
    
    if (allText.includes('EMPRESA')) {
      console.log('   ✅ EMPRESA - Informații despre firmă');
    }
    
    if (allText.includes('CIF')) {
      console.log('   ✅ CIF - CIF-ul firmei');
    }
    
    if (allText.includes('Firma')) {
      console.log('   ✅ Firma - Secțiune pentru semnătură');
    }
    
    if (allText.includes('D/Dª')) {
      console.log('   ✅ D/Dª - Secțiune pentru semnătură angajat');
    }
    
    // Salvează textul complet
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-full-text.txt'),
      allText,
      'utf8'
    );
    console.log('\n✅ Text complet salvat în certificado-full-text.txt');
    
  } else {
    console.log('❌ Nu s-a găsit text în document');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
