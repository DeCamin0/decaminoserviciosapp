const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const episPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');

console.log('🔧 Adăugând placeholder {{FIRMA}} în caseta de semnătură EPIS...');

try {
  if (!fs.existsSync(episPath)) {
    console.log(`❌ Documentul EPIS nu există: ${episPath}`);
    process.exit(1);
  }

  const zip = new AdmZip(episPath);
  let documentXml = zip.readAsText('word/document.xml');

  // Verifică dacă placeholder-ul există deja
  if (documentXml.includes('{{FIRMA}}')) {
    console.log('⚠️ Placeholder {{FIRMA}} există deja în document');
    process.exit(0);
  }

  // Caută tabelul cu "Firma Trabajador" - coloana 3 (ultima coloană)
  // Pattern: găsește prima celulă goală din coloana 3 (după header-ul "Firma Trabajador")
  // Structură: 3 coloane, ultima este "Firma Trabajador", apoi rânduri cu celule goale
  const celulaGoalaPattern = /(<w:tr[^>]*>.*?<w:tc[^>]*>.*?<w:p[^>]*><\/w:p>.*?<\/w:tc>.*?<w:tc[^>]*>.*?<w:p[^>]*><\/w:p>.*?<\/w:tc>.*?<w:tc[^>]*>.*?<w:p[^>]*><\/w:p>)(.*?<\/w:tc>.*?<\/w:tr>)/s;
  
  if (celulaGoalaPattern.test(documentXml)) {
    console.log('✅ Celulă goală din coloana "Firma Trabajador" găsită');
    
    // Înlocuiește prima celulă goală cu placeholder-ul
    documentXml = documentXml.replace(celulaGoalaPattern, (match, before, after) => {
      // Adaugă placeholder-ul în celula goală
      const placeholderContent = `
        <w:p w14:paraId="FIRMA_PLACEHOLDER" w14:textId="88888888" w:rsidR="0056363A" w:rsidRDefault="0056363A">
          <w:pPr>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman"/>
              <w:sz w:val="20"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman"/>
              <w:sz w:val="20"/>
            </w:rPr>
            <w:t>{{FIRMA}}</w:t>
          </w:r>
        </w:p>`;
      
      return before + placeholderContent + after;
    }, 1); // Doar prima înlocuire
    
    console.log('✅ Placeholder {{FIRMA}} adăugat în prima celulă goală din coloana "Firma Trabajador"');
  } else {
    // Încearcă să găsească orice text box sau paragraf cu "Fdo" sau "Firma"
    console.log('⚠️ Text box standard nu a fost găsit, căutând alternative...');
    
    // Pattern mai general pentru paragraf cu "Fdo"
    const fdoPattern = /(<w:p[^>]*>.*?<w:t[^>]*>(?:Fdo\.?|Fdo|Fdo:)<\/w:t>.*?<\/w:r>.*?<\/w:p>)(\s*)(<w:p[^>]*>)/s;
    
    if (fdoPattern.test(documentXml)) {
      console.log('✅ Paragraf cu "Fdo" găsit');
      
      documentXml = documentXml.replace(fdoPattern, (match, fdoPara, spacing, nextPara) => {
        const placeholderPara = `
    <w:p w14:paraId="FIRMA_PLACEHOLDER" w14:textId="88888888" w:rsidR="0056363A" w:rsidRDefault="0056363A">
      <w:pPr>
        <w:spacing w:before="120"/>
        <w:ind w:left="64"/>
        <w:jc w:val="left"/>
      </w:pPr>
      <w:r>
        <w:t>{{FIRMA}}</w:t>
      </w:r>
    </w:p>`;
        
        return fdoPara + spacing + placeholderPara + spacing + nextPara;
      });
      
      console.log('✅ Placeholder {{FIRMA}} adăugat după "Fdo"');
    } else {
      console.log('❌ Nu s-a găsit niciun pattern pentru caseta de semnătură');
      console.log('📋 Căutând în document pentru a identifica structura...');
      
      // Salvează XML-ul pentru analiză
      const debugPath = path.join(__dirname, '..', '..', 'epis-debug.xml');
      fs.writeFileSync(debugPath, documentXml);
      console.log(`📄 XML salvat pentru analiză: ${debugPath}`);
      
      // Caută orice mențiune de "Fdo" sau "Firma"
      const fdoMatches = documentXml.match(/<w:t[^>]*>.*?(?:Fdo|Firma|Fdo\.).*?<\/w:t>/gi);
      if (fdoMatches) {
        console.log(`\n📋 Găsite ${fdoMatches.length} mențiuni de "Fdo" sau "Firma":`);
        fdoMatches.forEach((match, idx) => {
          console.log(`  ${idx + 1}. ${match.substring(0, 100)}...`);
        });
      }
      
      process.exit(1);
    }
  }

  // Actualizează fișierul în ZIP
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));

  // Salvează documentul
  zip.writeZip(outputPath);
  console.log(`\n✅ Documentul EPIS a fost actualizat: ${outputPath}`);
  console.log('📝 Placeholder {{FIRMA}} a fost adăugat în caseta de semnătură');

} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
