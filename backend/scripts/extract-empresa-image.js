const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS para firma.docx');

console.log('🔍 Extrăgând imaginea/stampila firmei din document...');

try {
  const zip = new AdmZip(docxPath);
  
  // Listează toate fișierele din ZIP
  const zipEntries = zip.getEntries();
  console.log('\n📁 Fișiere găsite în document:');
  
  const images = [];
  zipEntries.forEach(entry => {
    if (entry.entryName.startsWith('word/media/')) {
      console.log(`  - ${entry.entryName} (${entry.header.size} bytes)`);
      images.push(entry);
    }
  });
  
  if (images.length === 0) {
    console.log('⚠️ Nu s-au găsit imagini în document');
  } else {
    console.log(`\n✅ Găsite ${images.length} imagine(i)`);
    
    // Extrage prima imagine (probabil stampila firmei)
    const firstImage = images[0];
    const imageData = zip.readFile(firstImage);
    
    // Salvează imaginea pentru verificare
    const outputImagePath = path.join(__dirname, '..', '..', 'empresa-stampila.png');
    fs.writeFileSync(outputImagePath, imageData);
    console.log(`✅ Imagine salvată: ${outputImagePath}`);
    
    // Verifică tipul de fișier
    const extension = firstImage.entryName.split('.').pop();
    console.log(`📄 Tip imagine: ${extension}`);
  }
  
  // Verifică și în document.xml unde este folosită imaginea
  const xml = zip.readAsText('word/document.xml');
  
  // Caută referințe la imagini (r:embed)
  const imageRefs = xml.match(/r:embed="[^"]+"/g);
  if (imageRefs) {
    console.log('\n🖼️ Referințe la imagini găsite:');
    imageRefs.forEach(ref => {
      const imageId = ref.match(/r:embed="([^"]+)"/)[1];
      console.log(`  - Image ID: ${imageId}`);
    });
  }
  
  // Caută și în relationships pentru a vedea ce imagini sunt
  if (zip.getEntry('word/_rels/document.xml.rels')) {
    const relsXml = zip.readAsText('word/_rels/document.xml.rels');
    console.log('\n📋 Relationships XML:');
    console.log(relsXml.substring(0, 1000));
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
