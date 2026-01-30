const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_MODIFIED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_MODIFIED.docx');

if (!require('fs').existsSync(docxPath)) {
  console.log('❌ Fișierul nu există:', docxPath);
  process.exit(1);
}

console.log('🔧 Corectând duplicarea {{PUESTO_TRABAJO}}...');

try {
  const zip = new AdmZip(docxPath);
  const documentXml = zip.readAsText('word/document.xml');
  
  // Verifică dacă există duplicat
  const matches = documentXml.match(/\{\{PUESTO_TRABAJO\}\}/g);
  console.log(`📊 Găsite ${matches ? matches.length : 0} apariții de {{PUESTO_TRABAJO}}`);
  
  if (matches && matches.length > 1) {
    console.log('⚠️ Duplicat detectat! Corectând...');
    
    // Elimină duplicatul - păstrează doar prima apariție
    // Caută pattern-ul care conține duplicatul: {{PUESTO_TRABAJO}} {{PUESTO_TRABAJO}}
    let modifiedXml = documentXml.replace(
      /\{\{PUESTO_TRABAJO\}\}\s*\{\{PUESTO_TRABAJO\}\}/g,
      '{{PUESTO_TRABAJO}}'
    );
    
    // Verifică dacă s-a corectat
    const newMatches = modifiedXml.match(/\{\{PUESTO_TRABAJO\}\}/g);
    console.log(`✅ După corecție: ${newMatches ? newMatches.length : 0} apariții`);
    
    if (newMatches && newMatches.length === 1) {
      zip.updateFile('word/document.xml', Buffer.from(modifiedXml, 'utf8'));
      zip.writeZip(outputPath);
      console.log('✅ Documentul a fost corectat și salvat!');
    } else {
      console.log('⚠️ Încă există probleme. Verificând structura...');
      
      // Caută contextul exact al duplicatului
      const duplicateIndex = documentXml.indexOf('{{PUESTO_TRABAJO}} {{PUESTO_TRABAJO}}');
      if (duplicateIndex !== -1) {
        const context = documentXml.substring(Math.max(0, duplicateIndex - 100), duplicateIndex + 200);
        console.log('Context duplicat:');
        console.log(context);
        console.log('\n');
        
        // Elimină duplicatul - sunt două tag-uri <w:r> consecutive cu același conținut
        // Folosim un pattern mai simplu care găsește exact structura
        const duplicatePattern = '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> {{PUESTO_TRABAJO}}</w:t></w:r>';
        const doublePattern = duplicatePattern + duplicatePattern;
        
        if (modifiedXml.includes(doublePattern)) {
          modifiedXml = modifiedXml.replace(doublePattern, duplicatePattern);
          console.log('✅ Duplicat eliminat folosind pattern exact');
        } else {
          // Încearcă pattern flexibil cu regex
          modifiedXml = modifiedXml.replace(
            /(<w:r><w:rPr><w:sz w:val="24"\/><\/w:rPr><w:t xml:space="preserve"> \{\{PUESTO_TRABAJO\}\}<\/w:t><\/w:r>)\s*<w:r><w:rPr><w:sz w:val="24"\/><\/w:rPr><w:t xml:space="preserve"> \{\{PUESTO_TRABAJO\}\}<\/w:t><\/w:r>/g,
            '$1'
          );
        }
        
        const finalMatches = modifiedXml.match(/\{\{PUESTO_TRABAJO\}\}/g);
        console.log(`✅ După corecție finală: ${finalMatches ? finalMatches.length : 0} apariții`);
        
        if (finalMatches && finalMatches.length === 1) {
          zip.updateFile('word/document.xml', Buffer.from(modifiedXml, 'utf8'));
          zip.writeZip(outputPath);
          console.log('✅ Documentul a fost corectat și salvat!');
        } else {
          console.log('❌ Nu s-a putut corecta automat. Trebuie corectat manual în Word.');
        }
      }
    }
  } else {
    console.log('✅ Nu există duplicat. Documentul este corect.');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
