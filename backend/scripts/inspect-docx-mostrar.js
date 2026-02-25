/**
 * Verifică dacă în template există etichetele {#mostrar_auxiliares}, {/mostrar_auxiliares}, etc.
 * Rulează din backend: node scripts/inspect-docx-mostrar.js
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'assets', 'presupuesto-template.docx'),
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
  console.error('Nu s-a găsit presupuesto-template.docx');
  process.exit(1);
}

const zip = new AdmZip(docPath);
const entries = zip.getEntries();

const tags = [
  'mostrar_auxiliares',
  'mostrar_limpieza',
  'mostrar_jardineria',
  '{#',
  '{/',
  'AUXILIARES DE SERVICIOS',
  'TAREAS OPERATIVAS',
  'LIMPIEZA',
  'JARDINERIA',
  'TAREAS JARDINERIA',
];

console.log('Template:', docPath, '\n');
console.log('Căutare etichete condiționale și secțiuni:\n');

for (const entry of entries) {
  if (!entry.entryName.startsWith('word/') || !entry.entryName.endsWith('.xml')) continue;
  const xml = entry.getData().toString('utf8');

  for (const tag of tags) {
    const idx = xml.indexOf(tag);
    if (idx === -1) continue;

    const start = Math.max(0, idx - 80);
    const end = Math.min(xml.length, idx + tag.length + 80);
    let snippet = xml.slice(start, end);
    snippet = snippet.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    console.log('---', entry.entryName, '| Căutare:', JSON.stringify(tag), '---');
    console.log(snippet);
    console.log('');
  }
}

// Verificare explicită: există {#mostrar_ ?
const docXml = entries.find((e) => e.entryName === 'word/document.xml');
if (docXml) {
  const xml = docXml.getData().toString('utf8');
  const hasOpenAux = xml.includes('{#mostrar_auxiliares}') || xml.includes('{# mostrar_auxiliares }');
  const hasCloseAux = xml.includes('{/mostrar_auxiliares}') || xml.includes('{/ mostrar_auxiliares }');
  const hasOpenLimp = xml.includes('{#mostrar_limpieza}') || xml.includes('{# mostrar_limpieza }');
  const hasCloseLimp = xml.includes('{/mostrar_limpieza}') || xml.includes('{/ mostrar_limpieza }');
  const hasOpenJard = xml.includes('{#mostrar_jardineria}') || xml.includes('{# mostrar_jardineria }');
  const hasCloseJard = xml.includes('{/mostrar_jardineria}') || xml.includes('{/ mostrar_jardineria }');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('REZUMAT ETICHETE ÎN document.xml:');
  console.log('  {#mostrar_auxiliares}   :', hasOpenAux ? 'DA' : 'NU');
  console.log('  {/mostrar_auxiliares}  :', hasCloseAux ? 'DA' : 'NU');
  console.log('  {#mostrar_limpieza}     :', hasOpenLimp ? 'DA' : 'NU');
  console.log('  {/mostrar_limpieza}    :', hasCloseLimp ? 'DA' : 'NU');
  console.log('  {#mostrar_jardineria}   :', hasOpenJard ? 'DA' : 'NU');
  console.log('  {/mostrar_jardineria}  :', hasCloseJard ? 'DA' : 'NU');
  console.log('═══════════════════════════════════════════════════════════');
}
