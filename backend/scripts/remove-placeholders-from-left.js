const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🧹 Eliminând placeholder-urile din stânga...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Elimină placeholder-urile din prima celulă (după etichetă)
  // TRABAJADOR
  xml = xml.replace(
    /(<w:t[^>]*>TRABAJADOR:<\/w:t>)\s*<w:t[^>]*>\s*\{\{TRABAJADOR\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  // D.N.I.
  xml = xml.replace(
    /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)\s*<w:t[^>]*>\s*\{\{DNI\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  // PUESTO DE TRABAJO (poate fi pe mai multe tag-uri)
  xml = xml.replace(
    /(<w:t[^>]*> TRABAJO:<\/w:t>)\s*<\/w:r>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*\{\{PUESTO_TRABAJO\}\}\s*<\/w:t>\s*<\/w:r>/g,
    '$1</w:t></w:r>'
  );
  
  // EMPRESA
  xml = xml.replace(
    /(<w:t[^>]*>EMPRESA:<\/w:t>)\s*<w:t[^>]*>\s*\{\{EMPRESA\}\}\s*<\/w:t>/g,
    '$1</w:t>'
  );
  
  // Verifică rezultatul
  const trabajadorInLeft = xml.match(/TRABAJADOR:.*?\{\{TRABAJADOR\}\}/);
  const dniInLeft = xml.match(/D\.N\.I\.:.*?\{\{DNI\}\}/);
  const puestoInLeft = xml.match(/TRABAJO:.*?\{\{PUESTO_TRABAJO\}\}/);
  const empresaInLeft = xml.match(/EMPRESA:.*?\{\{EMPRESA\}\}/);
  
  console.log('✅ Verificare eliminare din stânga:');
  console.log(`  {{TRABAJADOR}} în stânga: ${trabajadorInLeft ? '❌' : '✅'}`);
  console.log(`  {{DNI}} în stânga: ${dniInLeft ? '❌' : '✅'}`);
  console.log(`  {{PUESTO_TRABAJO}} în stânga: ${puestoInLeft ? '❌' : '✅'}`);
  console.log(`  {{EMPRESA}} în stânga: ${empresaInLeft ? '❌' : '✅'}`);
  
  // Verifică că sunt în dreapta
  const trabajadorInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{TRABAJADOR\}\}<\/w:t>/s);
  const dniInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{DNI\}\}<\/w:t>/s);
  const puestoInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{PUESTO_TRABAJO\}\}<\/w:t>/s);
  const empresaInRight = xml.match(/<w:tc[^>]*>.*?<w:t[^>]*>\{\{EMPRESA\}\}<\/w:t>/s);
  
  console.log('\n✅ Verificare în dreapta:');
  console.log(`  {{TRABAJADOR}} în dreapta: ${trabajadorInRight ? '✅' : '❌'}`);
  console.log(`  {{DNI}} în dreapta: ${dniInRight ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}} în dreapta: ${puestoInRight ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}} în dreapta: ${empresaInRight ? '✅' : '❌'}`);
  
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  zip.writeZip(outputPath);
  console.log('\n✅ Documentul a fost salvat:', outputPath);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
