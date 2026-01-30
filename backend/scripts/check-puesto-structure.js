const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Caută toate aparițiile "PUESTO" și "TRABAJO"
const lines = xml.split('\n');
lines.forEach((line, i) => {
  if (line.includes('PUESTO') || line.includes('TRABAJO')) {
    console.log(`Line ${i}: ${line.substring(0, 300)}`);
  }
});

// Caută pattern-uri specifice
console.log('\n=== Căutare pattern-uri ===\n');

const puestoPatterns = [
  /PUESTO[^<]*TRABAJO/gi,
  /<w:t[^>]*>PUESTO[^<]*<\/w:t>/gi,
  /<w:t[^>]*>TRABAJO[^<]*<\/w:t>/gi,
];

puestoPatterns.forEach((pattern, idx) => {
  const matches = xml.match(pattern);
  if (matches) {
    console.log(`Pattern ${idx + 1} matches:`, matches.slice(0, 5));
  }
});
