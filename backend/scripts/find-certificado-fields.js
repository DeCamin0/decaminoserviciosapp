const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026.docx');

console.log('🔍 Găsind locurile exacte pentru placeholder-uri...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Caută textul specific
  const patterns = {
    trabajador: /TRABAJADOR/i,
    dni: /con DNI/i,
    empresa: /de la.*?empresa/i,
    cif: /con CIF/i,
    fecha: /En a de 2026/i,
    firma: /Firma de el\/la trabajador/i,
  };
  
  console.log('\n📋 Locuri găsite:');
  
  for (const [field, pattern] of Object.entries(patterns)) {
    const index = xml.search(pattern);
    if (index !== -1) {
      console.log(`\n✅ ${field.toUpperCase()}:`);
      const context = xml.substring(Math.max(0, index - 100), Math.min(xml.length, index + 300));
      console.log(context.substring(0, 200));
    }
  }
  
  // Găsește structura exactă pentru fiecare câmp
  console.log('\n\n📋 Structura exactă pentru placeholder-uri:');
  
  // 1. Numele angajatului - după "TRABAJADOR" sau în locul "TRABAJADOR"
  const trabajadorIndex = xml.indexOf('TRABAJADOR');
  if (trabajadorIndex !== -1) {
    const context = xml.substring(Math.max(0, trabajadorIndex - 50), Math.min(xml.length, trabajadorIndex + 200));
    console.log('\n1. TRABAJADOR:');
    console.log(context);
  }
  
  // 2. DNI - după "con DNI"
  const dniIndex = xml.indexOf('con DNI');
  if (dniIndex !== -1) {
    const context = xml.substring(Math.max(0, dniIndex - 50), Math.min(xml.length, dniIndex + 200));
    console.log('\n2. DNI:');
    console.log(context);
  }
  
  // 3. EMPRESA - după "de la empresa"
  const empresaIndex = xml.indexOf('de la');
  if (empresaIndex !== -1) {
    const context = xml.substring(Math.max(0, empresaIndex - 50), Math.min(xml.length, empresaIndex + 300));
    console.log('\n3. EMPRESA:');
    console.log(context);
  }
  
  // 4. CIF - după "con CIF"
  const cifIndex = xml.indexOf('con CIF');
  if (cifIndex !== -1) {
    const context = xml.substring(Math.max(0, cifIndex - 50), Math.min(xml.length, cifIndex + 200));
    console.log('\n4. CIF:');
    console.log(context);
  }
  
  // 5. FECHA - în locul "En a de 2026"
  const fechaIndex = xml.indexOf('En a de 2026');
  if (fechaIndex !== -1) {
    const context = xml.substring(Math.max(0, fechaIndex - 100), Math.min(xml.length, fechaIndex + 200));
    console.log('\n5. FECHA:');
    console.log(context);
  }
  
  // 6. Firma - după "D/Dª"
  const firmaIndex = xml.indexOf('D/Dª');
  if (firmaIndex !== -1) {
    const context = xml.substring(Math.max(0, firmaIndex - 100), Math.min(xml.length, firmaIndex + 200));
    console.log('\n6. FIRMA (nume angajat):');
    console.log(context);
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
