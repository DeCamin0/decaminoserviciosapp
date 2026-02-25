/**
 * Inserează în template etichetele {#mostrar_auxiliares} ... {/mostrar_auxiliares} etc.
 * Rulează o singură dată din backend: node scripts/add-mostrar-tags-to-template.js
 * Face backup la presupuesto-template.docx în presupuesto-template.docx.bak
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'assets', 'presupuesto-template.docx');
if (!fs.existsSync(templatePath)) {
  console.error('Nu există presupuesto-template.docx în backend/assets/');
  process.exit(1);
}

const zip = new AdmZip(templatePath);
const docEntry = zip.getEntry('word/document.xml');
if (!docEntry) {
  console.error('word/document.xml nu există în DOCX');
  process.exit(1);
}

let xml = docEntry.getData().toString('utf8');

if (xml.includes('{#mostrar_auxiliares}')) {
  console.log('Etichetele există deja în template. Nimic de făcut.');
  process.exit(0);
}

function insertParagraphBefore(xml, beforeText, tagContent) {
  const idx = xml.indexOf(beforeText);
  if (idx === -1) return xml;
  const paraStart = xml.lastIndexOf('<w:p', idx);
  if (paraStart === -1) return xml;
  const tagPara = `<w:p><w:r><w:t>${tagContent}</w:t></w:r></w:p>`;
  return xml.slice(0, paraStart) + tagPara + xml.slice(paraStart);
}

function insertParagraphAfter(xml, afterText, tagContent) {
  const idx = xml.indexOf(afterText);
  if (idx === -1) return xml;
  const paraEnd = xml.indexOf('</w:p>', idx);
  if (paraEnd === -1) return xml;
  const end = paraEnd + '</w:p>'.length;
  const tagPara = `<w:p><w:r><w:t>${tagContent}</w:t></w:r></w:p>`;
  return xml.slice(0, end) + tagPara + xml.slice(end);
}

// 1) Înainte de "AUXILIARES DE SERVICIOS"
xml = insertParagraphBefore(xml, '<w:t>AUXILIARES DE SERVICIOS</w:t>', '{#mostrar_auxiliares}');

// 2) Înainte de "LIMPIEZA": ordine {/mostrar_auxiliares} apoi {#mostrar_limpieza} (inserăm în ordine inversă)
xml = insertParagraphBefore(xml, '<w:t>LIMPIEZA</w:t>', '{#mostrar_limpieza}');
xml = insertParagraphBefore(xml, '<w:t>LIMPIEZA</w:t>', '{/mostrar_auxiliares}');

// 3) Înainte de "JARDINERIA": ordine {/mostrar_limpieza} apoi {#mostrar_jardineria}
xml = insertParagraphBefore(xml, '<w:t>JARDINERIA</w:t>', '{#mostrar_jardineria}');
xml = insertParagraphBefore(xml, '<w:t>JARDINERIA</w:t>', '{/mostrar_limpieza}');

// 4) După sfârșitul blocului Jardineria (după "cuenta del cliente")
const cuentaIdx = xml.indexOf('cuenta del cliente');
if (cuentaIdx !== -1) {
  const paraEnd = xml.indexOf('</w:p>', cuentaIdx);
  if (paraEnd !== -1) {
    const end = paraEnd + '</w:p>'.length;
    const tagPara = '<w:p><w:r><w:t>{/mostrar_jardineria}</w:t></w:r></w:p>';
    xml = xml.slice(0, end) + tagPara + xml.slice(end);
  }
}

// Backup
const bakPath = templatePath + '.bak';
fs.copyFileSync(templatePath, bakPath);
console.log('Backup salvat:', bakPath);

zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
zip.writeZip(templatePath);
console.log('Template actualizat:', templatePath);
console.log('Etichete adăugate: {#mostrar_auxiliares}, {/mostrar_auxiliares}, {#mostrar_limpieza}, {/mostrar_limpieza}, {#mostrar_jardineria}, {/mostrar_jardineria}');
