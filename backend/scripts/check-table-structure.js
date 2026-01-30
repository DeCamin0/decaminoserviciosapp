const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');
const zip = new AdmZip(docxPath);
const xml = zip.readAsText('word/document.xml');

// Caută structura tabelului în jurul placeholder-urilor
const trabajadorIndex = xml.indexOf('TRABAJADOR:');
if (trabajadorIndex !== -1) {
  // Extrage contextul mai larg pentru a vedea structura tabelului
  const context = xml.substring(Math.max(0, trabajadorIndex - 500), trabajadorIndex + 1000);
  
  console.log('=== Structură tabel TRABAJADOR ===');
  console.log(context);
  console.log('\n');
  
  // Caută tag-uri de tabel (w:tc = table cell, w:tr = table row)
  const tcMatches = context.match(/<w:tc[^>]*>/g);
  const trMatches = context.match(/<w:tr[^>]*>/g);
  
  console.log(`Găsite ${tcMatches ? tcMatches.length : 0} celule (w:tc)`);
  console.log(`Găsite ${trMatches ? trMatches.length : 0} rânduri (w:tr)`);
  
  // Caută structura exactă: w:tr > w:tc (eticheta) > w:tc (valoare)
  const rowPattern = /<w:tr[^>]*>.*?TRABAJADOR:.*?<\/w:tr>/s;
  const rowMatch = xml.match(rowPattern);
  
  if (rowMatch) {
    console.log('\n=== Rând complet TRABAJADOR ===');
    console.log(rowMatch[0].substring(0, 2000));
  }
}
