/**
 * Creează presupuesto-template.docx PORNIND DE LA DOCUMENTUL TĂU ORIGINAL
 * (cu fundal roșu, logo, filigrane, culori). Doar înlocuim textele variabile cu placeholders.
 *
 * Scriptul caută automat documentul original în:
 * 1. backend/assets/presupuesto-original.docx
 * 2. backend/assets/ – orice .docx al cărui nume conține "PRESUPUESTO" sau "presupuesto"
 * 3. rădăcina proiectului – același criteriu (ex: DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS....docx)
 *
 * Rulează:  npm run presupuesto:create-from-original
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const projectRoot = path.join(__dirname, '..', '..');
const outputPath = path.join(assetsDir, 'presupuesto-template.docx');

function findOriginalDocx() {
  // 1) Nume fix în assets
  const fixed = path.join(assetsDir, 'presupuesto-original.docx');
  if (fs.existsSync(fixed)) return fixed;

  // 2) Cale exactă din rădăcina proiectului (documentul CP LOS JUNCOS)
  const exactName = path.join(projectRoot, 'DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - AUXILIAR DE SERVICIOS, LIMPIEZA Y JARDINERIA.docx');
  if (fs.existsSync(exactName)) return exactName;

  // 3) Orice .docx în assets care conține PRESUPUESTO/presupuesto în nume
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const docx = files.find((f) => f.endsWith('.docx') && /presupuesto/i.test(f) && !f.startsWith('~$'));
    if (docx) return path.join(assetsDir, docx);
  }

  // 4) Rădăcina proiectului – orice .docx cu PRESUPUESTO în nume
  if (fs.existsSync(projectRoot)) {
    const files = fs.readdirSync(projectRoot);
    const docx = files.find((f) => f.endsWith('.docx') && /presupuesto/i.test(f) && !f.startsWith('~$'));
    if (docx) return path.join(projectRoot, docx);
  }

  return null;
}

const originalPath = findOriginalDocx();
if (!originalPath) {
  console.error('❌ Nu s-a găsit niciun document original.');
  console.error('   Pune un .docx (cu fundal roșu, logo, filigrane) în una dintre:');
  console.error('   - backend/assets/presupuesto-original.docx');
  console.error('   - backend/assets/  (nume care conține PRESUPUESTO)');
  console.error('   - rădăcina proiectului  (ex: DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS....docx)');
  process.exit(1);
}

console.log('📄 Folosesc documentul:', originalPath);

const zip = new AdmZip(originalPath);
let xml = zip.readAsText('word/document.xml');

// Înlocuiri: mai întâi exacte, apoi flexibile (regex) ca să găsească textul și în XML-ul Word
let changed = false;

const exactReplacements = [
  ['COMUNIDAD DE PROPRIETARIOS LOS JUNCOS I, Madrid', '{cliente_nombre}'],
  ['COMUNIDAD DE PROPRIETARIOS LOS JUNCOS I , Madrid', '{cliente_nombre}'],
  ['MAD260216C', '{numero_presupuesto}'],
];

for (const [from, to] of exactReplacements) {
  if (xml.includes(from)) {
    xml = xml.split(from).join(to);
    changed = true;
    console.log('   Înlocuit (exact):', from.substring(0, 50) + (from.length > 50 ? '...' : ''), '→', to);
  }
}

// Fallback: în XML textul poate fi împărțit; înlocuim pe părți
if (!xml.includes('{cliente_nombre}')) {
  if (xml.includes(' LOS JUNCOS I') || xml.includes(' LOS JUNCOS I,')) {
    xml = xml.replace(/\s*LOS JUNCOS I\s*,?\s*Madrid/g, '');
    console.log('   Eliminat " LOS JUNCOS I, Madrid" (fallback)');
  }
  if (xml.includes('COMUNIDAD DE PROPRIETARIOS')) {
    xml = xml.split('COMUNIDAD DE PROPRIETARIOS').join('{cliente_nombre}');
    changed = true;
    console.log('   Înlocuit (fallback): COMUNIDAD DE PROPRIETARIOS → {cliente_nombre}');
  }
}

if (!xml.includes('{numero_presupuesto}') && /MAD[0-9A-Z]{5,12}/.test(xml)) {
  xml = xml.replace(/(MAD)([0-9A-Z]{5,12})/, '{numero_presupuesto}');
  changed = true;
  console.log('   Înlocuit (regex): MAD... → {numero_presupuesto}');
}

if (!changed && !xml.includes('{cliente_nombre}')) {
  console.log('⚠️ Niciun text găsit pentru client. Verifică dacă documentul conține "COMUNIDAD DE PROPRIETARIOS" sau "LOS JUNCOS".');
}

zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
zip.writeZip(outputPath);

console.log('✅ Template salvat:', outputPath);
console.log('');
console.log('Următorul pas (opțional): deschide presupuesto-template.docx în Word.');
console.log('În tabelul OFERTA ECONOMICA, la rândurile de date (Auxiliar, Limpieza, Jardinería):');
console.log('  - Șterge rândurile 2 și 3, lasă un singur rând de date.');
console.log('  - În celulele acelui rând pune:');
console.log('    Coloana 1: {#filas_oferta}{descripcion}');
console.log('    Coloana 2: {mensualidad_sin_iva}  și pe rând nou {mensualidad_con_iva}');
console.log('    Coloana 3: {anualidad_sin_iva}  și pe rând nou {anualidad_con_iva}{/filas_oferta}');
console.log('  - Salvează. După asta, documentul generat va avea același design și tabelul dinamic.');
