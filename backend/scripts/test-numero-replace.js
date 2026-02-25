const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const templatePath = path.join(__dirname, '..', 'assets', 'presupuesto-template.docx');
if (!fs.existsSync(templatePath)) {
  console.error('Template not found');
  process.exit(1);
}

const zip = new AdmZip(templatePath);
let xml = zip.readAsText('word/document.xml');
const safeNumero = 'MAD20260001';

const re = /(<w:r[^>]*>)([\s\S]*?)<w:t>PRESUPUESTO N[\u00BA\u00B0º] MAD<\/w:t><\/w:r>((?:\s*<w:r[^>]*>[\s\S]*?<w:t>[0-9A-Z]<\/w:t><\/w:r>){7,8})/g;
const before = xml.includes('PRESUPUESTO N');
const match = re.exec(xml);
console.log('Has PRESUPUESTO N:', before);
console.log('Regex match:', !!match);
if (match) console.log('Group1 (w:r tag) length:', match[1].length, 'Group2 (rPr) length:', match[2].length, 'Group3 length:', match[3].length);

const xml2 = xml.replace(re, `$1$2<w:t>PRESUPUESTO Nº ${safeNumero}</w:t></w:r>`);
const after = xml2.includes(safeNumero);
const stillOld = xml2.includes('260216');
console.log('After replace has safeNumero:', after);
console.log('After replace still has 260216:', stillOld);
// Verificare rapidă XML: număr de <w:r> vs </w:r>
const openR = (xml2.match(/<w:r\s/g) || []).length;
const closeR = (xml2.match(/<\/w:r>/g) || []).length;
console.log('w:r open vs close:', openR, closeR);
