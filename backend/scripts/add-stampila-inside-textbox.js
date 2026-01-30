const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const stampilaPath = path.join(__dirname, '..', '..', 'stampila-2-image2.jpeg');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând stampila ÎN text box (nu după)...');

try {
  if (!fs.existsSync(stampilaPath)) {
    console.log(`❌ Stampila nu există`);
    process.exit(1);
  }
  
  const stampilaData = fs.readFileSync(stampilaPath);
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  const originalXml = documentXml;
  let relsXml = zip.readAsText('word/_rels/document.xml.rels');
  
  // 1. Placeholder-uri
  const addPlaceholder = (rowXml, placeholder) => {
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    return pattern.test(rowXml) ? rowXml.replace(pattern, `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`) : rowXml;
  };
  
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{TRABAJADOR}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{DNI}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{PUESTO_TRABAJO}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{EMPRESA}}'));
  documentXml = documentXml.replace(/(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s, '$1{{FECHA}}$2');
  
  // 2. Stampila ÎN text box
  const rIdMatches = relsXml.match(/rId(\d+)/g);
  let maxRId = 0;
  if (rIdMatches) {
    rIdMatches.forEach(m => { const id = parseInt(m.replace('rId', '')); if (id > maxRId) maxRId = id; });
  }
  const newRId = `rId${maxRId + 1}`;
  
  zip.addFile('word/media/image2.jpeg', stampilaData);
  const newRel = `  <Relationship Id="${newRId}" Target="media/image2.jpeg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
  relsXml = relsXml.replace('</Relationships>', `${newRel}\n</Relationships>`);
  
  // Găsește text box-ul care conține "Fdo." și adaugă stampila ÎN el, după paragraful cu "Fdo."
  // Pattern: găsește paragraful cu "Fdo." în text box și adaugă stampila DUPĂ el, dar ÎN text box
  const textBoxPattern = /(<wps:txbx>.*?<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)(<\/w:txbxContent>)/s;
  
  if (textBoxPattern.test(documentXml)) {
    const stampilaPara = `<w:p w14:paraId="STAMP" w14:textId="77777777" w:rsidR="0056363A" w:rsidRDefault="0056363A"><w:pPr><w:spacing w:before="120"/><w:ind w:left="64"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="2500000" cy="1000000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${maxRId + 1}" name="Empresa"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${maxRId + 1}" name="Empresa"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${newRId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2500000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    
    documentXml = documentXml.replace(textBoxPattern, `$1${stampilaPara}$2`);
    console.log('✅ Stampila adăugată ÎN text box după "Fdo."');
  } else {
    console.log('⚠️ Text box nu găsit');
  }
  
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
  zip.writeZip(outputPath);
  
  console.log(`\n✅ Documentul salvat: ${outputPath}`);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
