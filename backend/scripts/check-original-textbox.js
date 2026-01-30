const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');

console.log('🔍 Verificând structura text box-ului în documentul ORIGINAL...');

try {
  const zip = new AdmZip(originalPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Găsește text box-ul cu "POR LA EMPRESA"
  const textBoxPattern = /<wps:txbx>.*?POR LA EMPRESA.*?<\/wps:txbx>/s;
  const textBoxMatch = xml.match(textBoxPattern);
  
  if (textBoxMatch) {
    console.log('✅ Text box găsit în original!');
    const textBoxContent = textBoxMatch[0];
    
    // Salvează pentru analiză
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'original-textbox.txt'),
      textBoxContent,
      'utf8'
    );
    console.log('✅ Structura salvată în original-textbox.txt');
    console.log('\nLungime text box:', textBoxContent.length);
    console.log('Primele 500 caractere:');
    console.log(textBoxContent.substring(0, 500));
  } else {
    console.log('❌ Text box-ul nu a fost găsit');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
