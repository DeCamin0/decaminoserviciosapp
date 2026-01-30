const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');

console.log('🔍 Extrăgând pattern-uri exacte din XML...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  const fs = require('fs');
  
  // 1. Pattern pentru "con DNI"
  const dniIndex = xml.indexOf('con DNI');
  if (dniIndex !== -1) {
    const dniPattern = xml.substring(Math.max(0, dniIndex - 200), Math.min(xml.length, dniIndex + 500));
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-dni-pattern.xml'),
      dniPattern,
      'utf8'
    );
    console.log('✅ Pattern "con DNI" salvat în certificado-dni-pattern.xml');
  }
  
  // 2. Pattern pentru "En a de 2026"
  const fechaIndex = xml.indexOf('En a de 2026');
  if (fechaIndex !== -1) {
    const fechaPattern = xml.substring(Math.max(0, fechaIndex - 300), Math.min(xml.length, fechaIndex + 500));
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-fecha-pattern.xml'),
      fechaPattern,
      'utf8'
    );
    console.log('✅ Pattern "En a de 2026" salvat în certificado-fecha-pattern.xml');
  }
  
  // 3. Pattern pentru "D/Dª"
  const firmaIndex = xml.indexOf('D/Dª');
  if (firmaIndex !== -1) {
    const firmaPattern = xml.substring(Math.max(0, firmaIndex - 200), Math.min(xml.length, firmaIndex + 300));
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-firma-pattern.xml'),
      firmaPattern,
      'utf8'
    );
    console.log('✅ Pattern "D/Dª" salvat în certificado-firma-pattern.xml');
  }
  
  // 4. Pattern pentru "empresa"
  const empresaIndex = xml.indexOf('empresa');
  if (empresaIndex !== -1) {
    const empresaPattern = xml.substring(Math.max(0, empresaIndex - 200), Math.min(xml.length, empresaIndex + 500));
    fs.writeFileSync(
      path.join(__dirname, '..', '..', 'certificado-empresa-pattern.xml'),
      empresaPattern,
      'utf8'
    );
    console.log('✅ Pattern "empresa" salvat în certificado-empresa-pattern.xml');
  }
  
  console.log('\n✅ Pattern-uri extrase! Verifică fișierele pentru structura exactă.');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
