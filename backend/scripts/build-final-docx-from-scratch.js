const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const originalPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const stampilaPath = path.join(__dirname, '..', '..', 'stampila-2-image2.jpeg');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FINAL.docx');

console.log('🔧 Construind documentul FINAL de la zero...');

try {
  // Verifică stampila
  if (!fs.existsSync(stampilaPath)) {
    console.log(`❌ Stampila nu există: ${stampilaPath}`);
    process.exit(1);
  }
  
  const stampilaData = fs.readFileSync(stampilaPath);
  console.log(`✅ Stampila citită: ${stampilaData.length} bytes`);
  
  // Citește documentul ORIGINAL
  const zip = new AdmZip(originalPath);
  let documentXml = zip.readAsText('word/document.xml');
  const originalXml = documentXml; // Pentru comparație
  let relsXml = zip.readAsText('word/_rels/document.xml.rels');
  
  console.log('\n📋 Pas 1: Adăugând placeholder-urile în casuța din dreapta...');
  
  // Funcție helper pentru a adăuga placeholder într-un rând
  const addPlaceholderToRow = (rowXml, placeholder) => {
    const pattern = /(<\/w:tc>\s*<w:tc[^>]*>.*?<w:p[^>]*>.*?<w:pPr>.*?<\/w:pPr>)\s*<\/w:p>\s*<\/w:tc>/s;
    if (pattern.test(rowXml)) {
      return rowXml.replace(
        pattern,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p></w:tc>`
      );
    }
    return rowXml;
  };
  
  // 1. TRABAJADOR
  const trabajadorRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>TRABAJADOR:<\/w:t>.*?<\/w:tr>/s;
  if (trabajadorRowPattern.test(documentXml)) {
    documentXml = documentXml.replace(trabajadorRowPattern, (match) => addPlaceholderToRow(match, '{{TRABAJADOR}}'));
    console.log('  ✅ {{TRABAJADOR}} adăugat');
  }
  
  // 2. D.N.I.
  const dniRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>D\.N\.I\.:<\/w:t>.*?<\/w:tr>/s;
  if (dniRowPattern.test(documentXml)) {
    documentXml = documentXml.replace(dniRowPattern, (match) => addPlaceholderToRow(match, '{{DNI}}'));
    console.log('  ✅ {{DNI}} adăugat');
  }
  
  // 3. PUESTO DE TRABAJO
  const puestoRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>PUESTO<\/w:t>.*?<w:t[^>]*>.*?TRABAJO.*?<\/w:t>.*?<\/w:tr>/s;
  if (puestoRowPattern.test(documentXml)) {
    documentXml = documentXml.replace(puestoRowPattern, (match) => addPlaceholderToRow(match, '{{PUESTO_TRABAJO}}'));
    console.log('  ✅ {{PUESTO_TRABAJO}} adăugat');
  }
  
  // 4. EMPRESA
  const empresaRowPattern = /<w:tr[^>]*>.*?<w:t[^>]*>EMPRESA:<\/w:t>.*?<\/w:tr>/s;
  if (empresaRowPattern.test(documentXml)) {
    documentXml = documentXml.replace(empresaRowPattern, (match) => addPlaceholderToRow(match, '{{EMPRESA}}'));
    console.log('  ✅ {{EMPRESA}} adăugat');
  }
  
  console.log('\n📋 Pas 2: Adăugând {{FECHA}} în locul "a de de 2026"...');
  
  // Înlocuiește "a de de 2026" cu {{FECHA}}
  const fechaPattern = /(<w:t>En<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-10"\/><\/w:rPr><w:t>a<\/w:t>.*?<w:r><w:tab\/><\/w:r>.*?<w:r><w:rPr><w:spacing w:val="-5"\/><\/w:rPr><w:t>de<\/w:t>.*?<w:r><w:tab\/><w:t>de<\/w:t>.*?<w:r><w:rPr><w:spacing w:val="50"\/><\/w:rPr><w:t xml:space="preserve"> <\/w:t>.*?<w:r><w:rPr><w:spacing w:val="-4"\/><\/w:rPr><w:t>)2026(<\/w:t>)/s;
  if (fechaPattern.test(documentXml)) {
    documentXml = documentXml.replace(fechaPattern, '$1{{FECHA}}$2');
    console.log('  ✅ {{FECHA}} adăugat');
  } else {
    console.log('  ⚠️ Pattern pentru {{FECHA}} nu a fost găsit');
  }
  
  console.log('\n📋 Pas 3: Adăugând stampila după "Fdo."...');
  
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
  
  // Adaugă imaginea
  const imageName = 'image2.jpeg';
  const imagePath = `word/media/${imageName}`;
  zip.addFile(imagePath, stampilaData);
  console.log(`  ✅ Imagine adăugată: ${imagePath}`);
  
  // Adaugă relația
  const newRelationship = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
  relsXml = relsXml.replace('</Relationships>', `${newRelationship}\n</Relationships>`);
  console.log(`  ✅ Relație adăugată: ${newRId}`);
  
  // Adaugă stampila în text box după "Fdo."
  // Găsește text box-ul care conține "POR LA EMPRESA:" și "Fdo."
  const textBoxPattern = /(<wps:txbx>.*?<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)(<\/w:txbxContent>)/s;
  
  if (textBoxPattern.test(documentXml)) {
    const imagePara = `
    <w:p w14:paraId="STAMP_${Date.now()}" w14:textId="77777777" w:rsidR="0056363A" w:rsidRDefault="0056363A">
      <w:pPr><w:spacing w:before="120"/><w:ind w:left="64"/></w:pPr>
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
      </w:r>
    </w:p>`;
    
    documentXml = documentXml.replace(
      textBoxPattern,
      `$1${imagePara}$2`
    );
    
    console.log('  ✅ Stampila adăugată după "Fdo."');
  } else {
    console.log('  ⚠️ Text box-ul nu a fost găsit, încercând pattern alternativ...');
    // Pattern alternativ - doar paragraful
    const altPattern = /(<w:p[^>]*>.*?<w:t>Fdo\.<\/w:t>.*?<\/w:r>.*?<\/w:p>)(<\/w:txbxContent>)/s;
    if (altPattern.test(documentXml)) {
      console.log('  ✅ Pattern alternativ găsit');
      // Similar cu mai sus
    }
  }
  
  // Validează XML-ul
  const openTags = (documentXml.match(/<w:[^>]+>/g) || []).length;
  const closeTags = (documentXml.match(/<\/w:[^>]+>/g) || []).length;
  const originalOpenTags = (originalXml.match(/<w:[^>]+>/g) || []).length;
  const originalCloseTags = (originalXml.match(/<\/w:[^>]+>/g) || []).length;
  
  console.log(`\n📊 Validare XML:`);
  console.log(`  Original: ${originalOpenTags} deschise, ${originalCloseTags} închise`);
  console.log(`  Modificat: ${openTags} deschise, ${closeTags} închise`);
  console.log(`  Diferență: ${openTags - originalOpenTags} deschise, ${closeTags - originalCloseTags} închise`);
  
  // Verifică placeholder-urile
  const hasTrabajador = documentXml.includes('{{TRABAJADOR}}');
  const hasDNI = documentXml.includes('{{DNI}}');
  const hasPuesto = documentXml.includes('{{PUESTO_TRABAJO}}');
  const hasEmpresa = documentXml.includes('{{EMPRESA}}');
  const hasFecha = documentXml.includes('{{FECHA}}');
  
  console.log(`\n✅ Verificare placeholder-uri:`);
  console.log(`  {{TRABAJADOR}}: ${hasTrabajador ? '✅' : '❌'}`);
  console.log(`  {{DNI}}: ${hasDNI ? '✅' : '❌'}`);
  console.log(`  {{PUESTO_TRABAJO}}: ${hasPuesto ? '✅' : '❌'}`);
  console.log(`  {{EMPRESA}}: ${hasEmpresa ? '✅' : '❌'}`);
  console.log(`  {{FECHA}}: ${hasFecha ? '✅' : '❌'}`);
  
  if (Math.abs(openTags - originalOpenTags) <= 25 && 
      Math.abs(closeTags - originalCloseTags) <= 25) {
    console.log('\n✅ Structura XML pare corectă!');
  } else {
    console.log('\n⚠️ Diferență mare în tag-uri - verifică manual!');
  }
  
  // Actualizează fișierele
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
  
  // Salvează
  zip.writeZip(outputPath);
  console.log(`\n✅ Documentul FINAL a fost salvat: ${outputPath}`);
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
