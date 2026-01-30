const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

console.log('🔍 Căutând contextul "Fdo."...');

const fdoIndex = xml.indexOf('Fdo.');
if (fdoIndex !== -1) {
  console.log('✅ Găsit "Fdo."');
  
  // Extrage contextul mai larg
  const context = xml.substring(Math.max(0, fdoIndex - 500), Math.min(xml.length, fdoIndex + 1000));
  console.log('\n=== Context "Fdo." ===');
  console.log(context);
  
  // Caută și "POR" sau "EMPRESA" în apropiere
  const beforeContext = xml.substring(Math.max(0, fdoIndex - 1000), fdoIndex);
  const afterContext = xml.substring(fdoIndex, Math.min(xml.length, fdoIndex + 1000));
  
  if (beforeContext.includes('POR') || beforeContext.includes('EMPRESA')) {
    console.log('\n✅ Găsit "POR" sau "EMPRESA" înainte de "Fdo."');
    const fullContext = xml.substring(Math.max(0, fdoIndex - 1000), Math.min(xml.length, fdoIndex + 500));
    console.log('\n=== Context complet ===');
    console.log(fullContext);
  }
  
  // Găsește rândul complet sau paragraful
  const rowPattern = /<w:tr[^>]*>.*?Fdo\..*?<\/w:tr>/s;
  const paraPattern = /<w:p[^>]*>.*?Fdo\..*?<\/w:p>/s;
  
  const rowMatch = xml.match(rowPattern);
  const paraMatch = xml.match(paraPattern);
  
  if (rowMatch) {
    console.log('\n=== RÂND COMPLET ===');
    console.log(rowMatch[0].substring(0, 1000));
  } else if (paraMatch) {
    console.log('\n=== PARAGRAF COMPLET ===');
    console.log(paraMatch[0].substring(0, 1000));
  }
  
  // Salvează pentru analiză
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'fdo-context.txt'),
    context,
    'utf8'
  );
  console.log('\n✅ Context salvat în fdo-context.txt');
}
