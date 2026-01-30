const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Caută contextul complet pentru "PUESTO DE TRABAJO:"
const puestoIndex = xml.indexOf('PUESTO');
if (puestoIndex !== -1) {
  const context = xml.substring(Math.max(0, puestoIndex - 100), puestoIndex + 200);
  console.log('Context pentru PUESTO:');
  console.log(context);
  console.log('\n');
}

// Caută toate aparițiile "PUESTO" cu context
const puestoMatches = [];
let searchIndex = 0;
while ((searchIndex = xml.indexOf('PUESTO', searchIndex)) !== -1) {
  const context = xml.substring(Math.max(0, searchIndex - 50), Math.min(xml.length, searchIndex + 150));
  puestoMatches.push({ index: searchIndex, context });
  searchIndex += 6;
}

console.log(`\n=== Găsite ${puestoMatches.length} apariții de "PUESTO" ===\n`);
puestoMatches.forEach((match, i) => {
  console.log(`Match ${i + 1} (index ${match.index}):`);
  console.log(match.context);
  console.log('\n---\n');
});
