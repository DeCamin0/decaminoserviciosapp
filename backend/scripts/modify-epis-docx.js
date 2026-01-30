const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

async function modifyEPISDocx() {
  const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026.docx');
  const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_MODIFIED.docx');
  
  if (!fs.existsSync(docxPath)) {
    console.log('❌ Fișierul nu există:', docxPath);
    return;
  }

  console.log('📄 Modificând documentul:', docxPath);
  
  try {
    // .docx este un fișier ZIP
    const zip = new AdmZip(docxPath);
    
    // Extrage document.xml (conține textul principal)
    const documentXml = zip.readAsText('word/document.xml');
    
    console.log('📝 Document XML original (primele 2000 caractere):');
    console.log(documentXml.substring(0, 2000));
    console.log('\n');
    
    // Înlocuiește câmpurile goale cu placeholder-uri
    // Caută pattern-uri comune pentru câmpuri goale în Word XML
    let modifiedXml = documentXml;
    
    // Pattern 1: TRABAJADOR: (fără text după)
    // În Word XML, textul apare în <w:t> tags
    modifiedXml = modifiedXml.replace(
      /(<w:t[^>]*>TRABAJADOR:<\/w:t>)(\s*<w:t[^>]*><\/w:t>)/gi,
      '$1<w:t xml:space="preserve"> {{TRABAJADOR}}</w:t>'
    );
    
    // Pattern 2: D.N.I.: (fără text după)
    modifiedXml = modifiedXml.replace(
      /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)(\s*<w:t[^>]*><\/w:t>)/gi,
      '$1<w:t xml:space="preserve"> {{DNI}}</w:t>'
    );
    
    // Pattern 3: PUESTO DE TRABAJO: (structură complexă)
    // Pattern: <w:t>PUESTO</w:t><w:t> </w:t><w:t>DE</w:t><w:t xml:space="preserve"> TRABAJO:</w:t></w:r>
    // Adaugă un nou <w:r> cu placeholder înainte de </w:r>
    modifiedXml = modifiedXml.replace(
      /(<w:t[^>]*xml:space="preserve"> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
      '<w:t xml:space="preserve"> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
    );
    
    // Alternativ: dacă nu are xml:space
    modifiedXml = modifiedXml.replace(
      /(<w:t[^>]*> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
      '<w:t> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
    );
    
    // Pattern 4: EMPRESA: (fără text după)
    modifiedXml = modifiedXml.replace(
      /(<w:t[^>]*>EMPRESA:<\/w:t>)(\s*<w:t[^>]*><\/w:t>)/gi,
      '$1<w:t xml:space="preserve"> {{EMPRESA}}</w:t>'
    );
    
    // Alternativ: dacă nu găsește pattern-urile de mai sus, încercă să găsească textul și să adauge placeholder după
    // Caută "TRABAJADOR:" și adaugă placeholder după dacă nu există deja
    if (!modifiedXml.includes('{{TRABAJADOR}}')) {
      modifiedXml = modifiedXml.replace(
        /(<w:t[^>]*>TRABAJADOR:<\/w:t>)/gi,
        '$1<w:t xml:space="preserve"> {{TRABAJADOR}}</w:t>'
      );
    }
    
    if (!modifiedXml.includes('{{DNI}}')) {
      modifiedXml = modifiedXml.replace(
        /(<w:t[^>]*>D\.N\.I\.:<\/w:t>)/gi,
        '$1<w:t xml:space="preserve"> {{DNI}}</w:t>'
      );
    }
    
    if (!modifiedXml.includes('{{PUESTO_TRABAJO}}')) {
      // Adaugă placeholder după "TRABAJO:" într-un nou <w:r>
      modifiedXml = modifiedXml.replace(
        /(<w:t[^>]*xml:space="preserve"> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
        '<w:t xml:space="preserve"> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
      );
      
      // Alternativ fără xml:space
      modifiedXml = modifiedXml.replace(
        /(<w:t[^>]*> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
        '<w:t> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
      );
    }
    
    if (!modifiedXml.includes('{{EMPRESA}}')) {
      modifiedXml = modifiedXml.replace(
        /(<w:t[^>]*>EMPRESA:<\/w:t>)/gi,
        '$1<w:t xml:space="preserve"> {{EMPRESA}}</w:t>'
      );
    }
    
    // Verifică dacă s-au făcut modificări
    const hasChanges = modifiedXml !== documentXml;
    
    if (hasChanges) {
      console.log('✅ Modificări găsite!');
      console.log('📝 Document XML modificat (primele 2000 caractere):');
      console.log(modifiedXml.substring(0, 2000));
      console.log('\n');
      
      // Verifică dacă placeholder-urile au fost adăugate
      const hasTRABAJADOR = modifiedXml.includes('{{TRABAJADOR}}');
      const hasDNI = modifiedXml.includes('{{DNI}}');
      const hasPUESTO = modifiedXml.includes('{{PUESTO_TRABAJO}}');
      const hasEMPRESA = modifiedXml.includes('{{EMPRESA}}');
      
      console.log('🔍 Verificare placeholder-uri:');
      console.log(`  {{TRABAJADOR}}: ${hasTRABAJADOR ? '✅' : '❌'}`);
      console.log(`  {{DNI}}: ${hasDNI ? '✅' : '❌'}`);
      console.log(`  {{PUESTO_TRABAJO}}: ${hasPUESTO ? '✅' : '❌'}`);
      console.log(`  {{EMPRESA}}: ${hasEMPRESA ? '✅' : '❌'}`);
      console.log('\n');
      
      // Actualizează document.xml în ZIP
      zip.updateFile('word/document.xml', Buffer.from(modifiedXml, 'utf8'));
      
      // Salvează documentul modificat
      zip.writeZip(outputPath);
      
      console.log('✅ Documentul a fost salvat:', outputPath);
    } else {
      console.log('⚠️ Nu s-au găsit modificări necesare.');
      console.log('💡 Poate placeholder-urile există deja sau structura XML este diferită.');
      console.log('\n📋 Încercând abordare alternativă...\n');
      
      // Abordare alternativă: caută direct textul și adaugă placeholder-uri
      let altModifiedXml = documentXml;
      
      // Caută secțiunea cu "TRABAJADOR:" și adaugă placeholder
      altModifiedXml = altModifiedXml.replace(
        /(TRABAJADOR:)(\s*<\/w:t>)/gi,
        '$1 {{TRABAJADOR}}$2'
      );
      
      altModifiedXml = altModifiedXml.replace(
        /(D\.N\.I\.:)(\s*<\/w:t>)/gi,
        '$1 {{DNI}}$2'
      );
      
      // Adaugă placeholder după "TRABAJO:"
      altModifiedXml = altModifiedXml.replace(
        /(<w:t[^>]*xml:space="preserve"> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
        '<w:t xml:space="preserve"> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
      );
      
      // Alternativ
      altModifiedXml = altModifiedXml.replace(
        /(<w:t[^>]*> TRABAJO:<\/w:t>\s*<\/w:r>)/gi,
        '<w:t> TRABAJO:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>'
      );
      
      altModifiedXml = altModifiedXml.replace(
        /(EMPRESA:)(\s*<\/w:t>)/gi,
        '$1 {{EMPRESA}}$2'
      );
      
      if (altModifiedXml !== documentXml) {
        console.log('✅ Modificări găsite cu abordare alternativă!');
        
        // Verifică placeholder-uri
        const hasTRABAJADOR = altModifiedXml.includes('{{TRABAJADOR}}');
        const hasDNI = altModifiedXml.includes('{{DNI}}');
        const hasPUESTO = altModifiedXml.includes('{{PUESTO_TRABAJO}}');
        const hasEMPRESA = altModifiedXml.includes('{{EMPRESA}}');
        
        console.log('🔍 Verificare placeholder-uri:');
        console.log(`  {{TRABAJADOR}}: ${hasTRABAJADOR ? '✅' : '❌'}`);
        console.log(`  {{DNI}}: ${hasDNI ? '✅' : '❌'}`);
        console.log(`  {{PUESTO_TRABAJO}}: ${hasPUESTO ? '✅' : '❌'}`);
        console.log(`  {{EMPRESA}}: ${hasEMPRESA ? '✅' : '❌'}`);
        console.log('\n');
        
        zip.updateFile('word/document.xml', Buffer.from(altModifiedXml, 'utf8'));
        zip.writeZip(outputPath);
        
        console.log('✅ Documentul a fost salvat:', outputPath);
      } else {
        console.log('❌ Nu s-au putut face modificări. Structura XML poate fi diferită.');
        console.log('💡 Sugestie: Deschide documentul în Word și adaugă manual placeholder-urile.');
      }
    }
    
  } catch (error) {
    console.error('❌ Eroare la modificarea documentului:', error);
    throw error;
  }
}

modifyEPISDocx();
