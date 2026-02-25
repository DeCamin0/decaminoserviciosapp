const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '..', '..', 'DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - AUXILIAR DE SERVICIOS, LIMPIEZA Y JARDINERIA.pdf');

console.log('🔍 Analizând documentul PDF de presupuesto...\n');

if (!fs.existsSync(pdfPath)) {
  console.log('❌ Fișierul PDF nu există:', pdfPath);
  process.exit(1);
}

async function analyzePresupuestoPDF() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 CONȚINUTUL COMPLET AL DOCUMENTULUI:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(data.text);
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    // Salvează textul
    const outputPath = path.join(__dirname, '..', '..', 'presupuesto-content.txt');
    fs.writeFileSync(outputPath, data.text, 'utf8');
    console.log(`✅ Text salvat în: ${outputPath}\n`);
    
    // Analizează structura
    console.log('📋 ANALIZĂ STRUCTURĂ:\n');
    
    const text = data.text.toUpperCase();
    
    // Caută secțiuni importante
    const sections = {
      'PRESUPUESTO': /PRESUPUESTO/gi,
      'CLIENTE': /CLIENTE|CP LOS JUNCOS/gi,
      'SERVICIO': /SERVICIO|AUXILIAR.*SERVICIOS/gi,
      'DESCRIPCION': /DESCRIPCI[OÓ]N/gi,
      'OPERATIVA': /OPERATIVA/gi,
      'PRECIO': /PRECIO|IMPORTE/gi,
      'AÑO': /2026|AÑO/gi,
      'DE CAMINO': /DE CAMINO/gi,
      'LIMPIEZA': /LIMPIEZA/gi,
      'JARDINERIA': /JARDINER[IÍ]A/gi
    };
    
    console.log('📝 Secțiuni găsite:');
    for (const [name, pattern] of Object.entries(sections)) {
      const matches = data.text.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`   ✅ ${name}: găsit ${matches.length} ori`);
        // Găsește contextul
        const contextMatch = data.text.match(new RegExp(`.{0,100}${pattern.source}.{0,100}`, 'i'));
        if (contextMatch) {
          console.log(`      Context: ${contextMatch[0].substring(0, 150).trim()}...`);
        }
      }
    }
    
    // Caută placeholder-uri sau câmpuri goale
    console.log('\n🔍 Căutând placeholder-uri sau câmpuri pentru completare:');
    const placeholderPatterns = [
      /\{\{.*?\}\}/g,
      /\{.*?\}/g,
      /\[.*?\]/g,
      /<.*?>/g,
      /___+/g,
      /_+/g,
      /\.\.\./g
    ];
    
    for (const pattern of placeholderPatterns) {
      const matches = data.text.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`   Pattern ${pattern}: ${matches.length} găsit`);
        matches.slice(0, 5).forEach(m => console.log(`      - ${m}`));
      }
    }
    
    // Analizează linii importante
    console.log('\n📄 Primele 30 de linii (pentru structură):');
    const lines = data.text.split('\n').filter(l => l.trim().length > 0);
    lines.slice(0, 30).forEach((line, i) => {
      if (line.trim().length > 3) {
        console.log(`   ${i + 1}. ${line.trim().substring(0, 100)}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
    console.error(error.stack);
  }
}

analyzePresupuestoPDF();
