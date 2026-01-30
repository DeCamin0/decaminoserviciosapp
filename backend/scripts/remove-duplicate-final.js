const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const docxPath = path.join(__dirname, '..', '..', 'EPIS 2026_MODIFIED.docx');
const outputPath = path.join(__dirname, '..', '..', 'EPIS 2026_FIXED.docx');

console.log('🔧 Eliminând duplicatul {{PUESTO_TRABAJO}}...');

try {
  const zip = new AdmZip(docxPath);
  let xml = zip.readAsText('word/document.xml');
  
  // Găsește prima apariție
  const firstIndex = xml.indexOf('{{PUESTO_TRABAJO}}');
  if (firstIndex === -1) {
    console.log('❌ Nu s-a găsit {{PUESTO_TRABAJO}}');
    process.exit(1);
  }
  
  // Găsește a doua apariție (după prima)
  const secondIndex = xml.indexOf('{{PUESTO_TRABAJO}}', firstIndex + 18);
  
  if (secondIndex === -1) {
    console.log('✅ Nu există duplicat');
    process.exit(0);
  }
  
  console.log(`📊 Prima apariție: ${firstIndex}, A doua apariție: ${secondIndex}`);
  
  // Verifică contextul din jurul celei de-a doua apariții
  const contextBefore = xml.substring(Math.max(0, secondIndex - 100), secondIndex);
  const contextAfter = xml.substring(secondIndex, Math.min(xml.length, secondIndex + 100));
  
  console.log('\nContext înainte de a doua apariție:');
  console.log(contextBefore);
  console.log('\nContext după a doua apariție:');
  console.log(contextAfter);
  console.log('\n');
  
  // Găsește începutul și sfârșitul tag-ului <w:r> care conține a doua apariție
  // Caută înapoi pentru <w:r> și înainte pentru </w:r>
  const tagStart = xml.lastIndexOf('<w:r>', secondIndex);
  const tagEnd = xml.indexOf('</w:r>', secondIndex) + 6;
  
  if (tagStart !== -1 && tagEnd > tagStart) {
    console.log(`🗑️ Eliminând tag-ul de la ${tagStart} la ${tagEnd}`);
    
    // Elimină tag-ul complet
    xml = xml.substring(0, tagStart) + xml.substring(tagEnd);
    
    // Verifică rezultatul
    const finalMatches = xml.match(/\{\{PUESTO_TRABAJO\}\}/g);
    console.log(`✅ După eliminare: ${finalMatches ? finalMatches.length : 0} apariții`);
    
    if (finalMatches && finalMatches.length === 1) {
      zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
      zip.writeZip(outputPath);
      console.log('✅ Documentul a fost corectat și salvat!');
    } else {
      console.log('❌ Eroare: numărul de apariții nu este corect');
    }
  } else {
    console.log('❌ Nu s-a putut găsi tag-ul complet');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
