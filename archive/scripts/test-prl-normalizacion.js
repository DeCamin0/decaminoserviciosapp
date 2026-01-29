/**
 * Script de test pentru normalizarea numelor de fișiere PRL
 * Testează pe fișierele existente din folderul PUESTO
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Funcție de normalizare (copie din service)
function normalizarNombreArchivo(nombreArchivo) {
  if (!nombreArchivo) return nombreArchivo;
  
  try {
    let normalized = String(nombreArchivo);
    const originalBytes = Buffer.from(normalized).toString('hex');
    
    console.log(`\n🔍 Normalizando: "${nombreArchivo}"`);
    console.log(`   Length: ${normalized.length}`);
    console.log(`   Bytes: ${originalBytes.substring(0, 100)}`);
    
    // DETECTARE: Verifică dacă conține replacement character () în contextul "mdico" sau "medico"
    const hasReplacementInMdico = /m[\uFFFD]dico|reconocimiento m[\uFFFD]dico/i.test(normalized);
    const hasReplacementBytes = originalBytes.includes('efbfbd') && originalBytes.includes('6d') && originalBytes.includes('6469636f');
    
    if (hasReplacementInMdico || hasReplacementBytes) {
      console.log(`   ⚠️ Detectado replacement character () en contexto "mdico"`);
      
      // CORECTARE: Înlocuiește pattern-urile cu replacement character
      normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
      normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
      normalized = normalized.replace(/medico/gi, 'médico');
      normalized = normalized.replace(/reconocimiento m[\uFFFD]dico/gi, 'reconocimiento médico');
      normalized = normalized.replace(/reconocimiento medico/gi, 'reconocimiento médico');
      
      if (normalized.includes('') || normalized.includes('')) {
        normalized = normalized.replace(/(reconocimiento )m[\uFFFD]dico/gi, '$1médico');
        normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
      }
      
      console.log(`   🔧 Después de corregir replacement char: "${normalized}"`);
    }
    
    // CORECTARE DIRECTĂ: Pattern-uri comune (fallback)
    const beforePatternFix = normalized;
    normalized = normalized.replace(/mdico/gi, 'médico');
    normalized = normalized.replace(/medico/gi, 'médico');
    normalized = normalized.replace(/reconocimiento mdico/gi, 'reconocimiento médico');
    normalized = normalized.replace(/reconocimiento medico/gi, 'reconocimiento médico');
    
    if (normalized !== beforePatternFix) {
      console.log(`   ✅ Pattern corregido: "${beforePatternFix}" -> "${normalized}"`);
    }
    
    // Verificare finală
    const finalBytes = Buffer.from(normalized).toString('hex');
    if (normalized.includes('médico')) {
      console.log(`   ✅ Nombre final contiene "médico" correctamente`);
      console.log(`   ✅ Bytes finales: ${finalBytes.substring(0, 100)}`);
      console.log(`   ✅ Verificare: ${finalBytes.includes('c3a9') ? 'Contiene "é" (c3a9) ✅' : 'NO contiene "é" ❌'}`);
    } else if (/mdico|medico|m[\uFFFD]dico/i.test(normalized)) {
      console.log(`   ⚠️ Nombre final todavía tiene problemas`);
      console.log(`   ⚠️ Bytes finales: ${finalBytes.substring(0, 100)}`);
      // Ultimă încercare
      normalized = normalized.replace(/m[\uFFFD]?dico/gi, 'médico');
      normalized = normalized.replace(/medico/gi, 'médico');
      console.log(`   🔧 Forzando corrección final: "${normalized}"`);
    }
    
    return normalized;
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    let fallback = String(nombreArchivo);
    fallback = fallback.replace(/m[\uFFFD]?dico/gi, 'médico');
    fallback = fallback.replace(/mdico/gi, 'médico');
    fallback = fallback.replace(/medico/gi, 'médico');
    return fallback;
  }
}

// Test pe fișierele din folder
console.log('🧪 TEST NORMALIZACIÓN PRL - Fișiere existente\n');
console.log('='.repeat(80));

// __dirname este backend/scripts, deci trebuie să mergem 2 nivele sus pentru root
// Dar dacă rulează din root, __dirname va fi diferit
const projectRoot = path.resolve(__dirname, '../..');
const folderPath1 = path.join(projectRoot, 'PUESTO LIMPIADOR Y PERSONAL LIMPIEZA');
const folderPath2 = path.join(__dirname, '../../PUESTO LIMPIADOR Y PERSONAL LIMPIEZA');
const folderPath = fs.existsSync(folderPath1) ? folderPath1 : folderPath2;

if (!fs.existsSync(folderPath)) {
  console.error(`❌ Folder nu există: ${folderPath}`);
  process.exit(1);
}

const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'));

console.log(`\n📁 Fișiere găsite în folder: ${files.length}\n`);

files.forEach((file, index) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Fișier ${index + 1}/${files.length}: ${file}`);
  console.log('='.repeat(80));
  
  const normalized = normalizarNombreArchivo(file);
  
  console.log(`\n📊 REZULTAT:`);
  console.log(`   Original: "${file}"`);
  console.log(`   Normalizat: "${normalized}"`);
  console.log(`   Contine "médico": ${normalized.includes('médico') ? '✅ DA' : '❌ NU'}`);
  
  const originalBytes = Buffer.from(file).toString('hex');
  const normalizedBytes = Buffer.from(normalized).toString('hex');
  
  console.log(`\n📊 BYTES:`);
  console.log(`   Original: ${originalBytes.substring(0, 100)}`);
  console.log(`   Normalizat: ${normalizedBytes.substring(0, 100)}`);
  console.log(`   Contine "é" (c3a9): ${normalizedBytes.includes('c3a9') ? '✅ DA' : '❌ NU'}`);
  console.log(`   Contine replacement (efbfbd): ${normalizedBytes.includes('efbfbd') ? '⚠️ DA' : '✅ NU'}`);
});

console.log(`\n${'='.repeat(80)}`);
console.log('✅ Test finalizat!');
console.log('='.repeat(80));
