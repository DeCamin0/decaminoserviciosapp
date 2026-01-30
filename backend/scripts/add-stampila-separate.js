const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const stampilaPath = path.join(__dirname, '..', '..', 'stampila-2-image2.jpeg');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând stampila separat (fără să stric documentul)...');

try {
  if (!fs.existsSync(stampilaPath)) {
    console.log(`❌ Stampila nu există`);
    process.exit(1);
  }
  
  const stampilaData = fs.readFileSync(stampilaPath);
  console.log(`✅ Stampila: ${stampilaData.length} bytes`);
  
  const zip = new AdmZip(docxPath);
  let documentXml = zip.readAsText('word/document.xml');
  const originalXml = documentXml;
  let relsXml = zip.readAsText('word/_rels/document.xml.rels');
  
  // Verifică dacă stampila există deja
  const hasStampila = documentXml.includes('r:embed="rId') && documentXml.match(/r:embed="rId\d+".*?image2\.jpeg/s);
  if (hasStampila) {
    console.log('⚠️ Stampila pare să existe deja, verificând...');
  }
  
  // Găsește rId disponibil
  const rIdMatches = relsXml.match(/rId(\d+)/g);
  let maxRId = 0;
  if (rIdMatches) {
    rIdMatches.forEach(m => { const id = parseInt(m.replace('rId', '')); if (id > maxRId) maxRId = id; });
  }
  const newRId = `rId${maxRId + 1}`;
  const imageId = maxRId + 1;
  
  // Adaugă imaginea dacă nu există
  const imageName = 'image2.jpeg';
  const imagePath = `word/media/${imageName}`;
  if (!zip.getEntry(imagePath)) {
    zip.addFile(imagePath, stampilaData);
    console.log(`✅ Imagine adăugată: ${imagePath}`);
    
    // Adaugă relația
    const newRel = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
    relsXml = relsXml.replace('</Relationships>', `${newRel}\n</Relationships>`);
    console.log(`✅ Relație adăugată: ${newRId}`);
  } else {
    console.log(`✅ Imagine există deja: ${imagePath}`);
    // Găsește rId-ul existent
    const existingRel = relsXml.match(new RegExp(`rId\\d+.*?Target="media/${imageName}"`));
    if (existingRel) {
      const existingRId = existingRel[0].match(/rId\d+/)[0];
      console.log(`✅ Folosind rId existent: ${existingRId}`);
    }
  }
  
  // Găsește text box-ul cu "Fdo." și adaugă stampila DUPĂ paragraful cu "Fdo."
  // Pattern: găsește paragraful cu "Fdo." în text box
  const textBoxPattern = /(<wps:txbx>.*?<w:txbxContent>.*?<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)(<\/w:txbxContent>)/s;
  
  if (textBoxPattern.test(documentXml)) {
    // Verifică dacă stampila există deja în text box
    const textBoxMatch = documentXml.match(textBoxPattern);
    if (textBoxMatch && textBoxMatch[0].includes('r:embed')) {
      console.log('⚠️ Stampila există deja în text box, înlocuind...');
      // Șterge stampila veche
      documentXml = documentXml.replace(
        /<w:p[^>]*>.*?<w:drawing>.*?r:embed.*?<\/w:drawing>.*?<\/w:r>.*?<\/w:p>/s,
        ''
      );
    }
    
    // Adaugă stampila ca paragraf NOU în text box
    // Structură COMPACTĂ și CORECTĂ
    const stampilaPara = `<w:p w14:paraId="STAMP" w14:textId="77777777" w:rsidR="0056363A" w:rsidRDefault="0056363A"><w:pPr><w:spacing w:before="120"/><w:ind w:left="64"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="2500000" cy="1000000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${imageId}" name="Empresa"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imageId}" name="Empresa"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${newRId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2500000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    
    documentXml = documentXml.replace(textBoxPattern, `$1${stampilaPara}$2`);
    console.log('✅ Stampila adăugată în text box după "Fdo."');
  } else {
    console.log('❌ Text box-ul nu a fost găsit');
    process.exit(1);
  }
  
  // Validează XML
  const openTags = (documentXml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (documentXml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpen = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalClose = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  const diffOpen = openTags - originalOpen;
  const diffClose = closeTags - originalClose;
  
  console.log(`\n📊 XML: ${openTags}/${closeTags} (original: ${originalOpen}/${originalClose})`);
  console.log(`   Diferență: ${diffOpen} deschise, ${diffClose} închise`);
  console.log(`   Diferență netă: ${Math.abs(diffOpen - diffClose)} tag-uri`);
  
  if (Math.abs(diffOpen - diffClose) <= 5) {
    console.log('  ✅ Structura XML pare OK');
  } else {
    console.log('  ⚠️ Diferență mare - verifică manual!');
  }
  
  // Actualizează
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
  zip.writeZip(outputPath);
  
  console.log(`\n✅ Documentul salvat cu stampila: ${outputPath}`);
  console.log('📝 Deschide documentul și verifică dacă stampila apare după "Fdo."!');
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
