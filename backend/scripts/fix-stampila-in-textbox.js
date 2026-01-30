const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');
const stampilaPath = path.join(__dirname, '..', '..', 'stampila-2-image2.jpeg');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Reparând stampila în text box...');

try {
  if (!fs.existsSync(stampilaPath)) {
    console.log(`❌ Stampila nu există: ${stampilaPath}`);
    process.exit(1);
  }
  
  const stampilaData = fs.readFileSync(stampilaPath);
  console.log(`✅ Stampila citită: ${stampilaData.length} bytes`);
  
  const zip = new AdmZip(docxPath);
  let documentXml = zip.readAsText('word/document.xml');
  let relsXml = zip.readAsText('word/_rels/document.xml.rels');
  
  // Găsește rId disponibil
  const rIdMatches = relsXml.match(/rId(\d+)/g);
  let maxRId = 0;
  if (rIdMatches) {
    rIdMatches.forEach(match => {
      const id = parseInt(match.replace('rId', ''));
      if (id > maxRId) maxRId = id;
    });
  }
  const newRId = `rId${maxRId + 1}`;
  
  // Verifică dacă imaginea există deja
  const imageName = 'image2.jpeg';
  const imagePath = `word/media/${imageName}`;
  
  if (!zip.getEntry(imagePath)) {
    zip.addFile(imagePath, stampilaData);
    console.log(`✅ Imagine adăugată: ${imagePath}`);
    
    // Adaugă relația
    const newRelationship = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
    relsXml = relsXml.replace('</Relationships>', `${newRelationship}\n</Relationships>`);
    console.log(`✅ Relație adăugată: ${newRId}`);
  } else {
    console.log(`✅ Imagine există deja: ${imagePath}`);
    // Găsește rId-ul existent
    const existingRel = relsXml.match(new RegExp(`rId\\d+.*?Target="media/${imageName}"`));
    if (existingRel) {
      const existingRId = existingRel[0].match(/rId(\d+)/)[0];
      console.log(`✅ Folosind rId existent: ${existingRId}`);
    }
  }
  
  // Găsește text box-ul cu "POR LA EMPRESA:" și "Fdo."
  // Trebuie să găsim exact structura text box-ului
  const textBoxPattern = /(<wps:txbx>.*?<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)(<\/w:txbxContent>)/s;
  
  if (textBoxPattern.test(documentXml)) {
    console.log('✅ Text box găsit');
    
    // Verifică dacă stampila există deja în text box
    const hasStampila = documentXml.match(/<wps:txbx>.*?r:embed.*?<\/wps:txbx>/s);
    if (hasStampila) {
      console.log('⚠️ Stampila există deja în text box, înlocuind...');
      // Șterge stampila veche
      documentXml = documentXml.replace(
        /<w:p[^>]*>.*?<w:drawing>.*?r:embed.*?<\/w:drawing>.*?<\/w:r>.*?<\/w:p>/s,
        ''
      );
    }
    
    // Adaugă stampila ca paragraf nou în text box, după "Fdo."
    // Structură simplificată și corectă pentru text box
    const imagePara = `
    <w:p w14:paraId="STAMP_${Date.now()}" w14:textId="77777777" w:rsidR="0056363A" w:rsidRDefault="0056363A">
      <w:pPr>
        <w:spacing w:before="120"/>
        <w:ind w:left="64"/>
        <w:jc w:val="left"/>
      </w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="3000000" cy="1200000"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${maxRId + 1}" name="Empresa Stamp" descr="Stampila firmei"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
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
                      <a:ext cx="3000000" cy="1200000"/>
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
      </w:r>
    </w:p>`;
    
    documentXml = documentXml.replace(
      textBoxPattern,
      `$1${imagePara}$2`
    );
    
    console.log('✅ Stampila adăugată în text box după "Fdo."');
  } else {
    console.log('❌ Text box-ul nu a fost găsit');
    // Încearcă să găsească doar "Fdo." și să adauge după
    const fdoPattern = /(<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)/s;
    if (fdoPattern.test(documentXml)) {
      console.log('✅ Găsit "Fdo." fără text box, adăugând stampila...');
      // Similar cu mai sus
    }
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
