const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

console.log('🔍 Căutând "POR LA EMPRESA" în document...');

// Caută textul
const porLaEmpresaIndex = xml.indexOf('POR LA EMPRESA');
if (porLaEmpresaIndex !== -1) {
  console.log('✅ Găsit "POR LA EMPRESA"');
  
  // Extrage contextul
  const context = xml.substring(Math.max(0, porLaEmpresaIndex - 200), Math.min(xml.length, porLaEmpresaIndex + 1000));
  console.log('\n=== Context "POR LA EMPRESA" ===');
  console.log(context);
  
  // Găsește rândul complet
  const rowPattern = /<w:tr[^>]*>.*?POR LA EMPRESA.*?<\/w:tr>/s;
  const rowMatch = xml.match(rowPattern);
  
  if (rowMatch) {
    console.log('\n=== RÂND COMPLET ===');
    console.log(rowMatch[0]);
    
    // Salvează pentru analiză
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'por-la-empresa-row.txt'),
      rowMatch[0],
      'utf8'
    );
    console.log('\n✅ Rând salvat în por-la-empresa-row.txt');
  }
} else {
  console.log('❌ Nu s-a găsit "POR LA EMPRESA"');
  
  // Caută variante
  const variants = ['POR LA EMPRESA', 'POR LA', 'Fdo.', 'Fdo'];
  variants.forEach(variant => {
    if (xml.includes(variant)) {
      console.log(`✅ Găsit variantă: "${variant}"`);
    }
  });
}
