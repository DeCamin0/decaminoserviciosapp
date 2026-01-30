const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const sourceDocxPath = path.join(__dirname, '..', '..', 'EPIS para firma.docx');
const finalDocxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Adăugând stampila firmei în documentul final...');

try {
  // 1. Extrage toate imaginile din documentul sursă
  const sourceZip = new AdmZip(sourceDocxPath);
  const sourceImages = sourceZip.getEntries().filter(e => e.entryName.startsWith('word/media/'));
  
  console.log(`\n📸 Găsite ${sourceImages.length} imagini în documentul sursă:`);
  sourceImages.forEach((img, index) => {
    console.log(`  ${index + 1}. ${img.entryName} (${img.header.size} bytes)`);
  });
  
  // 2. Identifică stampila (probabil cea mai mare sau prima)
  // image1.png este cea mai mare (22170 bytes) - probabil stampila
  const stampilaImage = sourceImages.find(img => img.entryName.includes('image1.png')) || sourceImages[0];
  console.log(`\n✅ Folosind stampila: ${stampilaImage.entryName}`);
  
  // 3. Citește documentul final
  const finalZip = new AdmZip(finalDocxPath);
  let documentXml = finalZip.readAsText('word/document.xml');
  let relsXml = finalZip.readAsText('word/_rels/document.xml.rels');
  
  // 4. Găsește unde trebuie să adaug stampila (în rândul cu EMPRESA)
  const empresaRowPattern = /<w:tr[^>]*>.*?EMPRESA.*?\{\{EMPRESA\}\}.*?<\/w:tr>/s;
  const empresaRowMatch = documentXml.match(empresaRowPattern);
  
  if (!empresaRowMatch) {
    console.log('❌ Nu s-a găsit rândul cu {{EMPRESA}}');
    process.exit(1);
  }
  
  console.log('\n✅ Rândul cu {{EMPRESA}} a fost găsit');
  
  // 5. Extrage imaginea din documentul sursă
  const imageData = sourceZip.readFile(stampilaImage);
  const imageName = stampilaImage.entryName.split('/').pop(); // image1.png
  
  // 6. Adaugă imaginea în documentul final
  const finalImagePath = `word/media/${imageName}`;
  finalZip.addFile(finalImagePath, imageData);
  console.log(`✅ Imagine adăugată: ${finalImagePath}`);
  
  // 7. Adaugă relația în document.xml.rels
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
  
  // Adaugă relația nouă
  const newRelationship = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
  relsXml = relsXml.replace('</Relationships>', `${newRelationship}\n</Relationships>`);
  console.log(`✅ Relație adăugată: ${newRId} -> media/${imageName}`);
  
  // 8. Înlocuiește {{EMPRESA}} cu imaginea în document.xml
  // Trebuie să adaug un element <w:drawing> cu imaginea în locul placeholder-ului
  const imageDrawing = `
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="3000000" cy="1000000"/>
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
                    <a:ext cx="3000000" cy="1000000"/>
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
  
  // Înlocuiește placeholder-ul {{EMPRESA}} cu imaginea
  documentXml = documentXml.replace(
    /<w:t[^>]*>\{\{EMPRESA\}\}<\/w:t>/,
    imageDrawing
  );
  
  console.log('✅ Placeholder {{EMPRESA}} înlocuit cu stampila');
  
  // 9. Actualizează fișierele în ZIP
  finalZip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  finalZip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
  
  // 10. Salvează documentul
  finalZip.writeZip(outputPath);
  console.log(`\n✅ Documentul final a fost salvat: ${outputPath}`);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
