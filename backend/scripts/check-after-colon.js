const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Găsește "PUESTO" și afișează tot contextul până la următorul câmp
const puestoIndex = xml.indexOf('PUESTO');
if (puestoIndex !== -1) {
  const context = xml.substring(puestoIndex, puestoIndex + 500);
  console.log('Context complet pentru PUESTO DE TRABAJO:');
  console.log(context);
  console.log('\n');
  
  // Caută după ":"
  const colonIndex = context.indexOf(':');
  if (colonIndex !== -1) {
    const afterColon = context.substring(colonIndex, colonIndex + 200);
    console.log('După ":" (următoarele 200 caractere):');
    console.log(afterColon);
  }
}
