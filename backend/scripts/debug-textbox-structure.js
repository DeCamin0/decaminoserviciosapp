const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔍 Analizând structura text box-ului...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Găsește text box-ul cu "POR LA EMPRESA"
  const textBoxPattern = /<wps:txbx>.*?POR LA EMPRESA.*?<\/wps:txbx>/s;
  const textBoxMatch = xml.match(textBoxPattern);
  
  if (textBoxMatch) {
    console.log('✅ Text box găsit!');
    console.log('\n=== STRUCTURA TEXT BOX ===');
    const textBoxContent = textBoxMatch[0];
    console.log(textBoxContent.substring(0, 2000));
    
    // Verifică dacă există stampila
    const hasStampila = textBoxContent.includes('r:embed') || textBoxContent.includes('drawing');
    console.log(`\n📸 Stampila în text box: ${hasStampila ? '✅' : '❌'}`);
    
    // Salvează pentru analiză
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'textbox-structure.txt'),
      textBoxContent,
      'utf8'
    );
    console.log('\n✅ Structura salvată în textbox-structure.txt');
  } else {
    console.log('❌ Text box-ul nu a fost găsit');
    
    // Caută doar "POR LA EMPRESA"
    const porLaEmpresaIndex = xml.indexOf('POR LA EMPRESA');
    if (porLaEmpresaIndex !== -1) {
      const context = xml.substring(Math.max(0, porLaEmpresaIndex - 500), Math.min(xml.length, porLaEmpresaIndex + 2000));
      console.log('\n=== Context "POR LA EMPRESA" ===');
      console.log(context);
    }
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
