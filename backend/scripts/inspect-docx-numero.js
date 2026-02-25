/**
 * Citește template-ul presupuesto și arată EXACT cum apare "MAD260216C" / "260216" în XML.
 * Rulează: node scripts/inspect-docx-numero.js
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'assets', 'presupuesto-template.docx'),
  path.join(__dirname, '..', '..', 'DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - AUXILIAR DE SERVICIOS, LIMPIEZA Y JARDINERIA.docx'),
  path.join(__dirname, '..', '..', 'presupuesto-template.docx'),
];

let docPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    docPath = p;
    break;
  }
}

if (!docPath) {
  console.error('Nu s-a găsit niciun .docx. Pune template-ul în backend/assets/presupuesto-template.docx');
  process.exit(1);
}

console.log('Fișier:', docPath, '\n');

const zip = new AdmZip(docPath);
const entries = zip.getEntries();

for (const entry of entries) {
  if (!entry.entryName.startsWith('word/') || !entry.entryName.endsWith('.xml')) continue;
  const xml = entry.getData().toString('utf8');
  const search = ['260216', 'MAD260216C', 'MAD260216', 'PRESUPUESTO', 'Nº', 'N&#186;', '&#186;'];
  for (const s of search) {
    const idx = xml.indexOf(s);
    if (idx === -1) continue;
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Fișier:', entry.entryName, '| Căutare:', JSON.stringify(s));
    console.log('═══════════════════════════════════════════════════════════');
    const start = Math.max(0, idx - 250);
    const end = Math.min(xml.length, idx + s.length + 250);
    let snippet = xml.slice(start, end);
    snippet = snippet.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    console.log(snippet);
    console.log('\n');
  }
}

// Dacă nu am găsit nimic, afișăm toate <w:t> care conțin cifre sau MAD
console.log('═══════════════════════════════════════════════════════════');
console.log('Toate <w:t>...</w:t> care conțin MAD sau 260216:');
console.log('═══════════════════════════════════════════════════════════');
for (const entry of entries) {
  if (!entry.entryName.startsWith('word/') || !entry.entryName.endsWith('.xml')) continue;
  const xml = entry.getData().toString('utf8');
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  if (!matches) continue;
  for (const m of matches) {
    const text = m.replace(/<[^>]+>/g, '');
    if (/MAD|260216|PRESUPUESTO|Nº|&#186;/.test(text)) {
      console.log(entry.entryName, '|', JSON.stringify(text));
    }
  }
}
