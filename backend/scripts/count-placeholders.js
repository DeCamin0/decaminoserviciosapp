const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔍 Verificând câte placeholder-uri sunt în document...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  const trabajadorCount = (xml.match(/\{\{TRABAJADOR\}\}/g) || []).length;
  const dniCount = (xml.match(/\{\{DNI\}\}/g) || []).length;
  const puestoCount = (xml.match(/\{\{PUESTO_TRABAJO\}\}/g) || []).length;
  const empresaCount = (xml.match(/\{\{EMPRESA\}\}/g) || []).length;
  const fechaCount = (xml.match(/\{\{FECHA\}\}/g) || []).length;
  
  console.log(`\n📊 Număr placeholder-uri:`);
  console.log(`  {{TRABAJADOR}}: ${trabajadorCount} (așteptat: 1)`);
  console.log(`  {{DNI}}: ${dniCount} (așteptat: 1)`);
  console.log(`  {{PUESTO_TRABAJO}}: ${puestoCount} (așteptat: 1)`);
  console.log(`  {{EMPRESA}}: ${empresaCount} (așteptat: 1)`);
  console.log(`  {{FECHA}}: ${fechaCount} (așteptat: 1)`);
  
  if (trabajadorCount > 1 || dniCount > 1 || puestoCount > 1 || empresaCount > 1) {
    console.log('\n⚠️ Placeholder-uri duplicate!');
  }
  
  // Verifică structura exactă a unui placeholder
  const trabajadorMatch = xml.match(/<w:t[^>]*>\{\{TRABAJADOR\}\}<\/w:t>/);
  if (trabajadorMatch) {
    const context = xml.substring(Math.max(0, xml.indexOf(trabajadorMatch[0]) - 200), Math.min(xml.length, xml.indexOf(trabajadorMatch[0]) + 200));
    console.log('\n📋 Context {{TRABAJADOR}}:');
    console.log(context);
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
