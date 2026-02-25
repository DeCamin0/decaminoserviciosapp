const AdmZip = require('adm-zip');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// Încearcă mai întâi .docx, apoi .doc
let docPath = path.join(__dirname, '..', '..', 'DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - AUXILIAR DE SERVICIOS, LIMPIEZA Y JARDINERIA.docx');
if (!fs.existsSync(docPath)) {
  docPath = path.join(__dirname, '..', '..', 'DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - AUXILIAR DE SERVICIOS, LIMPIEZA Y JARDINERIA.doc');
}

console.log('🔍 Analizând documentul de presupuesto...\n');
console.log('📄 Căutând:', docPath);

if (!fs.existsSync(docPath)) {
  console.log('❌ Fișierul nu există:', docPath);
  process.exit(1);
}

async function analyzePresupuesto() {
  try {
    if (docPath.endsWith('.docx')) {
      console.log('✅ Fișier .docx găsit!\n');
      
      // Metoda 1: Cu AdmZip (pentru structură XML)
      console.log('📄 Analizând structura XML...\n');
      const zip = new AdmZip(docPath);
      const xml = zip.readAsText('word/document.xml');
      
      // Extrage toate textul
      const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (textMatches) {
        const allText = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .filter(text => text.trim().length > 0)
          .join(' ');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📄 CONȚINUTUL COMPLET AL DOCUMENTULUI:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(allText);
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // Salvează textul complet
        const outputPath = path.join(__dirname, '..', '..', 'presupuesto-content.txt');
        fs.writeFileSync(outputPath, allText, 'utf8');
        console.log(`✅ Text salvat în: ${outputPath}\n`);
        
        // Caută placeholder-uri
        console.log('🔍 Căutând placeholder-uri...');
        const placeholders = allText.match(/\{\{([^}]+)\}\}/g);
        if (placeholders) {
          console.log('✅ Placeholder-uri găsite:');
          placeholders.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p}`);
          });
        } else {
          console.log('⚠️ Nu s-au găsit placeholder-uri în format {{...}}');
        }
        
        // Caută secțiuni importante
        console.log('\n📝 Secțiuni importante găsite:');
        const sections = [
          'PRESUPUESTO',
          'CLIENTE',
          'SERVICIO',
          'DESCRIPCION',
          'OPERATIVA',
          'PRECIO',
          'IMPORTE',
          'AÑO',
          '2026',
          'DE CAMINO',
          'CP LOS JUNCOS',
          'AUXILIAR',
          'LIMPIEZA',
          'JARDINERIA'
        ];
        
        sections.forEach(section => {
          if (allText.toUpperCase().includes(section.toUpperCase())) {
            const matches = allText.match(new RegExp(`.{0,100}${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,100}`, 'gi'));
            if (matches && matches.length > 0) {
              console.log(`   ✅ ${section}: găsit`);
              console.log(`      Context: ${matches[0].substring(0, 150).trim()}...`);
            }
          }
        });
        
        // Analizează structura
        console.log('\n📋 Structura documentului:');
        const hasTables = xml.includes('<w:tbl>');
        console.log(`   Tabele: ${hasTables ? '✅' : '❌'}`);
        
        const hasTextBoxes = xml.includes('<wps:txbx>') || xml.includes('wps:txbx');
        console.log(`   Text box-uri: ${hasTextBoxes ? '✅' : '❌'}`);
        
        // Analizează linii importante
        console.log('\n📄 Primele 50 de linii (pentru structură):');
        const lines = allText.split('\n').filter(l => l.trim().length > 0);
        lines.slice(0, 50).forEach((line, i) => {
          if (line.trim().length > 3) {
            console.log(`   ${i + 1}. ${line.trim().substring(0, 120)}`);
          }
        });
        
      }
      
      // Metoda 2: Cu mammoth (pentru text curat)
      console.log('\n\n📄 Citind cu mammoth (text curat)...\n');
      const result = await mammoth.extractRawText({ path: docPath });
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📄 TEXT CURAT (mammoth):');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(result.value);
      console.log('\n═══════════════════════════════════════════════════════════\n');
      
      // Salvează și textul curat
      const outputPathClean = path.join(__dirname, '..', '..', 'presupuesto-content-clean.txt');
      fs.writeFileSync(outputPathClean, result.value, 'utf8');
      console.log(`✅ Text curat salvat în: ${outputPathClean}\n`);
      
    } else {
      console.log('❌ Fișierul nu este .docx, este .doc (format vechi)');
      console.log('   Trebuie să salvezi documentul ca "Documento de Word" (.docx)');
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
    console.error(error.stack);
  }
}

analyzePresupuesto();
