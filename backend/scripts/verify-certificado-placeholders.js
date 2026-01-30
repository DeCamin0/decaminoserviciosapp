const AdmZip = require('adm-zip');
const path = require('path');

const docxPath = path.join(__dirname, '..', '..', 'Certificado renuncia reconocimiento médico 2026_FINAL.docx');

console.log('🔍 Verificând placeholder-urile din document...');

try {
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  
  // Caută toate placeholder-urile (format {{...}})
  const placeholderPattern = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  
  while ((match = placeholderPattern.exec(xml)) !== null) {
    matches.push(match[1]);
  }
  
  // Numără fiecare placeholder
  const placeholderCounts = {};
  matches.forEach(p => {
    placeholderCounts[p] = (placeholderCounts[p] || 0) + 1;
  });
  
  console.log('\n📋 Placeholder-uri găsite în document:');
  console.log('─'.repeat(50));
  
  if (Object.keys(placeholderCounts).length === 0) {
    console.log('❌ Nu s-au găsit placeholder-uri în format {{...}}');
  } else {
    for (const [placeholder, count] of Object.entries(placeholderCounts)) {
      console.log(`  ✅ {{${placeholder}}} - ${count} ${count === 1 ? 'dată' : 'ori'}`);
    }
  }
  
  // Extrage contextul pentru fiecare placeholder
  console.log('\n📝 Context pentru fiecare placeholder:');
  console.log('─'.repeat(50));
  
  const uniquePlaceholders = [...new Set(matches)];
  for (const placeholder of uniquePlaceholders) {
    const pattern = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
    let index = xml.indexOf(`{{${placeholder}}}`);
    
    if (index !== -1) {
      const context = xml.substring(Math.max(0, index - 150), Math.min(xml.length, index + 200));
      // Extrage doar textul vizibil (fără XML tags)
      const textContext = context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`\n  {{${placeholder}}}:`);
      console.log(`    Context: ...${textContext.substring(0, 100)}...`);
    }
  }
  
  // Verifică placeholder-urile așteptate
  console.log('\n\n✅ Verificare completă:');
  console.log('─'.repeat(50));
  
  const expectedPlaceholders = ['TRABAJADOR', 'DNI', 'EMPRESA', 'CIF', 'FECHA'];
  const foundPlaceholders = Object.keys(placeholderCounts);
  
  for (const expected of expectedPlaceholders) {
    const found = foundPlaceholders.includes(expected);
    const count = placeholderCounts[expected] || 0;
    console.log(`  ${found ? '✅' : '❌'} {{${expected}}} ${found ? `(${count} ${count === 1 ? 'dată' : 'ori'})` : '- LIPSĂ'}`);
  }
  
  // Verifică dacă există placeholder-uri neașteptate
  const unexpected = foundPlaceholders.filter(p => !expectedPlaceholders.includes(p));
  if (unexpected.length > 0) {
    console.log('\n⚠️ Placeholder-uri neașteptate (dar valide):');
    for (const p of unexpected) {
      console.log(`  ℹ️ {{${p}}} - ${placeholderCounts[p]} ${placeholderCounts[p] === 1 ? 'dată' : 'ori'}`);
    }
  }
  
  // Salvează rezumatul
  const fs = require('fs');
  const summary = {
    total: matches.length,
    unique: uniquePlaceholders.length,
    placeholders: placeholderCounts,
    allFound: expectedPlaceholders.every(p => foundPlaceholders.includes(p))
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'certificado-placeholders-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
  
  console.log('\n✅ Rezumat salvat în certificado-placeholders-summary.json');
  
  if (summary.allFound) {
    console.log('\n🎉 Toate placeholder-urile așteptate sunt prezente!');
  } else {
    console.log('\n⚠️ Unele placeholder-uri așteptate lipsesc.');
  }
  
} catch (error) {
  console.error('❌ Eroare:', error);
  process.exit(1);
}
