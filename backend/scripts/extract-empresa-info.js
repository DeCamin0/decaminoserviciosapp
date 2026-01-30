const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS para firma.docx');

console.log('🔍 Analizând documentul pentru a extrage informațiile firmei...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Caută informațiile firmei în text
  const empresaPatterns = [
    /DE CAMINO SERVICIOS AUXILIARES/i,
    /Andalucía.*?4.*?Local.*?5/i,
    /San Sebastián de los Reyes/i,
    /B-85524536/i,
  ];
  
  console.log('\n📋 Căutând informații despre firmă...');
  
  for (const pattern of empresaPatterns) {
    const match = xml.match(pattern);
    if (match) {
      console.log(`✅ Găsit: ${match[0]}`);
    }
  }
  
  // Extrage toate textul pentru a vedea structura
  const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (textMatches) {
    console.log('\n📝 Text găsit în document (primele 50 de fragmente):');
    textMatches.slice(0, 50).forEach((match, index) => {
      const text = match.replace(/<[^>]+>/g, '');
      if (text.trim().length > 0) {
        console.log(`${index + 1}. ${text.trim()}`);
      }
    });
  }
  
  // Caută rândul care conține "EMPRESA:" sau "Firma" pentru a vedea unde trebuie să fie
  const empresaRowPattern = /<w:tr[^>]*>.*?EMPRESA.*?<\/w:tr>/s;
  const empresaRowMatch = xml.match(empresaRowPattern);
  
  if (empresaRowMatch) {
    console.log('\n=== RÂND CU EMPRESA ===');
    console.log(empresaRowMatch[0].substring(0, 500));
  }
  
  // Caută și în documentul final pentru a vedea unde este placeholder-ul {{EMPRESA}}
  const finalDocxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
  if (require('fs').existsSync(finalDocxPath)) {
    const finalZip = new AdmZip(finalDocxPath);
    const finalXml = finalZip.readAsText('word/document.xml');
    
    const empresaPlaceholderMatch = finalXml.match(/<w:tr[^>]*>.*?EMPRESA.*?\{\{EMPRESA\}\}.*?<\/w:tr>/s);
    if (empresaPlaceholderMatch) {
      console.log('\n=== RÂND CU {{EMPRESA}} ÎN DOCUMENTUL FINAL ===');
      console.log(empresaPlaceholderMatch[0].substring(0, 500));
    }
  }
  
  // Salvează XML-ul pentru analiză
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'epis-para-firma-xml.txt'),
    xml.substring(0, 5000),
    'utf8'
  );
  console.log('\n✅ XML salvat în epis-para-firma-xml.txt (primele 5000 caractere)');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
