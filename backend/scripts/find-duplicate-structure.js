const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_MODIFIED.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Găsește toate aparițiile {{PUESTO_TRABAJO}}
let searchIndex = 0;
const positions = [];

while ((searchIndex = xml.indexOf('{{PUESTO_TRABAJO}}', searchIndex)) !== -1) {
  const context = xml.substring(Math.max(0, searchIndex - 150), Math.min(xml.length, searchIndex + 150));
  positions.push({ index: searchIndex, context });
  searchIndex += 18; // length of '{{PUESTO_TRABAJO}}'
}

console.log(`Găsite ${positions.length} apariții:\n`);

positions.forEach((pos, i) => {
  console.log(`=== Apariția ${i + 1} (index ${pos.index}) ===`);
  console.log(pos.context);
  console.log('\n');
});

// Caută pattern-ul exact al duplicatului
const duplicatePattern = xml.match(/\{\{PUESTO_TRABAJO\}\}[^<]*\{\{PUESTO_TRABAJO\}\}/);
if (duplicatePattern) {
  console.log('=== Pattern duplicat găsit ===');
  console.log(duplicatePattern[0]);
  console.log('\n');
  
  // Găsește contextul complet
  const dupIndex = xml.indexOf(duplicatePattern[0]);
  const fullContext = xml.substring(Math.max(0, dupIndex - 200), Math.min(xml.length, dupIndex + duplicatePattern[0].length + 200));
  console.log('Context complet:');
  console.log(fullContext);
}
