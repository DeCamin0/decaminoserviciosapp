const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Caută "En" și "2026" pentru a găsi textul cu data
const enIndex = xml.indexOf('En');
const yearIndex = xml.indexOf('2026');

console.log('🔍 Căutând textul cu data...');

if (enIndex !== -1) {
  // Extrage contextul în jurul "En"
  const context = xml.substring(Math.max(0, enIndex - 100), Math.min(xml.length, enIndex + 200));
  console.log('\n=== Context "En" ===');
  console.log(context);
}

if (yearIndex !== -1) {
  // Extrage contextul în jurul "2026"
  const context = xml.substring(Math.max(0, yearIndex - 200), Math.min(xml.length, yearIndex + 100));
  console.log('\n=== Context "2026" ===');
  console.log(context);
}

// Caută pattern-uri comune pentru data
const patterns = [
  /En\s+a\s+de\s+de\s+2026/i,
  /En.*?2026/i,
  /<w:t[^>]*>En.*?2026.*?<\/w:t>/i,
];

for (const pattern of patterns) {
  const match = xml.match(pattern);
  if (match) {
    console.log(`\n✅ Pattern găsit: ${pattern}`);
    console.log('Match:', match[0]);
  }
}

// Caută rândul complet care conține "En" și "2026"
const rowPattern = /<w:tr[^>]*>.*?En.*?2026.*?<\/w:tr>/s;
const rowMatch = xml.match(rowPattern);
if (rowMatch) {
  console.log('\n=== RÂND COMPLET CU DATA ===');
  console.log(rowMatch[0].substring(0, 500));
  
  // Salvează pentru analiză
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'fecha-row.txt'),
    rowMatch[0],
    'utf8'
  );
  console.log('\n✅ Rând salvat în fecha-row.txt');
}
