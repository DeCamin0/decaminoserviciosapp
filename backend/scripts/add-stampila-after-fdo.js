const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const stampilaPath = path.join(__dirname, '..', '..', 'stampila-2-image2.jpeg');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând stampila după "Fdo."...');

try {
  // Verifică dacă stampila există
  if (!fs.existsSync(stampilaPath)) {
    console.log(`❌ Stampila nu există: ${stampilaPath}`);
    process.exit(1);
  }
  
  const stampilaData = fs.readFileSync(stampilaPath);
  console.log(`✅ Stampila citită: ${stampilaData.length} bytes`);
  
  // Citește documentul
  const zip = new AdmZip(docxPath);
  let documentXml = zip.readAsText('word/document.xml');
  let relsXml = zip.readAsText('word/_rels/document.xml.rels');
  
  // Găsește ultimul rId disponibil
  const rIdMatches = relsXml.match(/rId(\d+)/g);
  let maxRId = 0;
  if (rIdMatches) {
    rIdMatches.forEach(match => {
      const id = parseInt(match.replace('rId', ''));
      if (id > maxRId) maxRId = id;
    });
  }
  const newRId = `rId${maxRId + 1}`;
  
  // Adaugă imaginea în ZIP
  const imageName = 'image2.jpeg'; // Păstrăm numele original
  const imagePath = `word/media/${imageName}`;
  zip.addFile(imagePath, stampilaData);
  console.log(`✅ Imagine adăugată: ${imagePath}`);
  
  // Adaugă relația
  const newRelationship = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
  relsXml = relsXml.replace('</Relationships>', `${newRelationship}\n</Relationships>`);
  console.log(`✅ Relație adăugată: ${newRId} -> media/${imageName}`);
  
  // Găsește "Fdo." și adaugă stampila după el
  // Pattern: găsește paragraful care conține "Fdo." și adaugă imaginea după
  const fdoPattern = /(<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)/s;
  
  if (fdoPattern.test(documentXml)) {
    // Adaugă stampila după "Fdo."
    const imageDrawing = `
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="2000000" cy="800000"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${maxRId + 1}" name="Empresa Stamp"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${maxRId + 1}" name="Empresa Stamp"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${newRId}"/>
                  <a:stretch>
                    <a:fillRect/>
                  </a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="2000000" cy="800000"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect">
                    <a:avLst/>
                  </a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>`;
    
    documentXml = documentXml.replace(
      fdoPattern,
      `$1${imageDrawing}`
    );
    
    console.log('✅ Stampila adăugată după "Fdo."');
  } else {
    console.log('❌ Nu s-a găsit pattern-ul pentru "Fdo."');
    process.exit(1);
  }
  
  // Actualizează fișierele
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
  
  // Salvează
  zip.writeZip(outputPath);
  console.log(`\n✅ Documentul a fost salvat: ${outputPath}`);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
