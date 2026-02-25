/**
 * Citește template-ul presupuesto și arată cum apare INDICE / DESCRIPCION OPERATIVA și cele 3 servicii în XML.
 * Rulează din backend: node scripts/inspect-docx-indice.js
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'assets', 'presupuesto-template.docx'),
  path.join(__dirname, '..', '..', 'presupuesto-template.docx'),
  path.join(process.cwd(), 'assets', 'presupuesto-template.docx'),
  path.join(process.cwd(), 'presupuesto-template.docx'),
];

let docPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    docPath = p;
    break;
  }
}

if (!docPath) {
  console.error('Nu s-a găsit presupuesto-template.docx. Căutat în:', candidates);
  process.exit(1);
}

console.log('Template:', docPath, '\n');

const zip = new AdmZip(docPath);
const entries = zip.getEntries();

const searchPhrases = [
  'DESCRIPCION OPERATIVA',
  'DESCRIPCIÓN OPERATIVA',
  'Auxiliar de Servicios',
  'Servicio de Limpieza',
  'Jardineria',
  'Jardinería',
  'indice_descripcion_operativa',
  'INDICE',
];

for (const entry of entries) {
  if (!entry.entryName.startsWith('word/') || !entry.entryName.endsWith('.xml')) continue;
  const xml = entry.getData().toString('utf8');

  for (const phrase of searchPhrases) {
    const idx = xml.indexOf(phrase);
    if (idx === -1) continue;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('Fișier:', entry.entryName, '| Text:', JSON.stringify(phrase));
    console.log('═══════════════════════════════════════════════════════════');

    const start = Math.max(0, idx - 400);
    const end = Math.min(xml.length, idx + phrase.length + 400);
    let snippet = xml.slice(start, end);
    snippet = snippet.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    console.log(snippet);
    console.log('\n');
  }
}

// Afișează toate paragrafele care conțin doar text (extragem <w:p>...</w:p> și textul lor)
console.log('═══════════════════════════════════════════════════════════');
console.log('Paragrafe (w:p) care conțin Auxiliar / Servicio / Jardineria:');
console.log('═══════════════════════════════════════════════════════════');

for (const entry of entries) {
  if (entry.entryName !== 'word/document.xml') continue;
  const xml = entry.getData().toString('utf8');
  const paraRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let m;
  while ((m = paraRegex.exec(xml)) !== null) {
    const inner = m[1];
    const textOnly = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/Auxiliar|Servicio de Limpieza|Jardineria|Jardinería/i.test(textOnly) && textOnly.length < 120) {
      console.log('Paragraf text:', JSON.stringify(textOnly));
    }
  }
}
