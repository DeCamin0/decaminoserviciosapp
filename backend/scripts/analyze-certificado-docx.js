const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');

console.log('🔍 Analizând documentul "Certificado renuncia reconocimiento médico"...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Extrage toate textul din document
  const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  
  if (textMatches) {
    console.log('\n📝 Text găsit în document:');
    const allText = textMatches
      .map(match => match.replace(/<[^>]+>/g, ''))
      .filter(text => text.trim().length > 0)
      .join(' ');
    
    // Afișează primele 2000 de caractere
    console.log(allText.substring(0, 2000));
    
    // Caută câmpuri comune care pot fi autocompletate
    console.log('\n\n🔍 Căutând câmpuri pentru autocompletare...');
    
    const fields = {
      nombre: /nombre|trabajador|empleado/i,
      dni: /d\.?n\.?i\.?|documento.*identidad|nif/i,
      fecha: /fecha|día|día.*mes|año/i,
      empresa: /empresa|compañía/i,
      puesto: /puesto|trabajo|cargo/i,
      centro: /centro|trabajo|sede/i,
    };
    
    for (const [field, pattern] of Object.entries(fields)) {
      if (pattern.test(allText)) {
        const matches = allText.match(new RegExp(pattern.source, 'gi'));
        console.log(`  ✅ ${field.toUpperCase()}: găsit (${matches ? matches.length : 0} ori)`);
        // Găsește contextul
        const contextMatch = allText.match(new RegExp(`.{0,50}${pattern.source}.{0,50}`, 'i'));
        if (contextMatch) {
          console.log(`     Context: ${contextMatch[0].substring(0, 80)}...`);
        }
      }
    }
    
    // Caută și structura tabelului sau câmpurilor goale
    console.log('\n📋 Structura documentului:');
    
    // Verifică dacă are tabele
    const hasTables = xml.includes('<w:tbl>');
    console.log(`  Tabele: ${hasTables ? '✅' : '❌'}`);
    
    // Verifică dacă are text box-uri
    const hasTextBoxes = xml.includes('<wps:txbx>') || xml.includes('wps:txbx');
    console.log(`  Text box-uri: ${hasTextBoxes ? '✅' : '❌'}`);
    
    // Salvează textul complet pentru analiză
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-text.txt'),
      allText,
      'utf8'
    );
    console.log('\n✅ Text complet salvat în certificado-text.txt');
    
    // Salvează și XML-ul pentru analiză
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-xml.txt'),
      xml.substring(0, 5000),
      'utf8'
    );
    console.log('✅ XML (primele 5000 caractere) salvat în certificado-xml.txt');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
