const AdmZip = require('adm-zip');
const path = require('path');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Restaurând versiunea care funcționa (fără stampila)...');

try {
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  
  // 1. Placeholder-uri
  const addPlaceholder = (rowXml, placeholder) => {
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    if (pattern.test(rowXml)) {
      return rowXml.replace(pattern, `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`);
    }
    return rowXml;
  };
  
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{TRABAJADOR}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{DNI}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{PUESTO_TRABAJO}}'));
  documentXml = documentXml.replace(/<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s, m => addPlaceholder(m, '{{EMPRESA}}'));
  
  // 2. FECHA
  documentXml = documentXml.replace(/(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s, '$1{{FECHA}}$2');
  
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.writeZip(outputPath);
  
  console.log('✅ Documentul restaurat (fără stampila)');
  console.log('📝 Documentul ar trebui să funcționeze acum.');
  console.log('📝 Pentru stampila, poți să o adaugi manual în Word sau să folosim o altă metodă.');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
