const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');

console.log('🔍 Căutând "POR LA EMPRESA" în documentul original...');

try {
  const zip = new AdmZip(originalPath);
  const xml = zip.readAsText('word/document.xml');
  
  const porIndex = xml.indexOf('POR LA EMPRESA');
  if (porIndex !== -1) {
    console.log('✅ Găsit "POR LA EMPRESA" la index:', porIndex);
    
    // Extrage contextul larg
    const context = xml.substring(Math.max(0, porIndex - 1000), Math.min(xml.length, porIndex + 3000));
    
    // Verifică dacă este în text box
    const isInTextBox = context.includes('<wps:txbx>') || context.includes('wps:txbx');
    console.log(`\n📦 Este în text box: ${isInTextBox ? '✅' : '❌'}`);
    
    // Găsește începutul și sfârșitul structurii care conține "POR LA EMPRESA"
    // Caută înapoi până la <wps:txbx> sau <w:p>
    let start = porIndex;
    let depth = 0;
    let foundStart = false;
    
    // Caută începutul text box-ului sau paragrafului
    for (let i = porIndex; i >= Math.max(0, porIndex - 5000); i--) {
      if (xml.substring(i, i + 10) === '<wps:txbx>') {
        start = i;
        foundStart = true;
        break;
      }
      if (xml.substring(i, i + 4) === '<w:p' && !foundStart) {
        start = i;
        break;
      }
    }
    
    // Caută sfârșitul
    let end = porIndex;
    for (let i = porIndex; i < Math.min(xml.length, porIndex + 5000); i++) {
      if (xml.substring(i, i + 11) === '</wps:txbx>') {
        end = i + 11;
        break;
      }
      if (xml.substring(i, i + 5) === '</w:p>' && !foundStart) {
        end = i + 5;
        break;
      }
    }
    
    const structure = xml.substring(start, end);
    console.log(`\n=== STRUCTURA COMPLETĂ (${structure.length} caractere) ===`);
    console.log(structure);
    
    // Salvează
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'por-la-empresa-structure.txt'),
      structure,
      'utf8'
    );
    console.log('\n✅ Structura salvată în por-la-empresa-structure.txt');
    
  } else {
    console.log('❌ "POR LA EMPRESA" nu a fost găsit');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
