const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS para firma.docx');

console.log('🔍 Extrăgând stampila firmei...');

try {
  const zip = new AdmZip(docxPath);
  
  // Listează toate imaginile
  const images = zip.getEntries().filter(e => e.entryName.startsWith('word/media/'));
  
  console.log(`\n📸 Găsite ${images.length} imagini:`);
  images.forEach((img, index) => {
    const size = img.header.size;
    const name = img.entryName.split('/').pop();
    console.log(`  ${index + 1}. ${name} (${size} bytes)`);
  });
  
  // Extrage toate imaginile pentru a le vedea
  images.forEach((img, index) => {
    const imageData = zip.readFile(img);
    const fileName = img.entryName.split('/').pop();
    const outputPath = path.join(__dirname, '..', '..', `stampila-${index + 1}-${fileName}`);
    fs.writeFileSync(outputPath, imageData);
    console.log(`✅ Salvat: stampila-${index + 1}-${fileName}`);
  });
  
  // Extrage și image1.png ca "stampila-empresa.png" (cea mai mare, probabil stampila)
  const stampilaImage = images.find(img => img.entryName.includes('image1.png'));
  if (stampilaImage) {
    const imageData = zip.readFile(stampilaImage);
    const outputPath = path.join(__dirname, '..', '..', 'stampila-empresa.png');
    fs.writeFileSync(outputPath, imageData);
    console.log(`\n✅ Stampila principală salvată: stampila-empresa.png`);
  }
  
  console.log('\n✅ Toate imaginile au fost extrase!');
  console.log('📁 Verifică imaginile și spune-mi care este stampila corectă și unde să o pun.');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
