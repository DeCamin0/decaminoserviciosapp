/**
 * Script de test pentru normalizarea numelor de fișiere PRL din ZIP
 * Testează cum AdmZip extrage numele și cum funcționează normalizarea
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

// Test pe fișierele din folder - creează ZIP și testează
console.log('🧪 TEST NORMALIZACIÓN PRL - Din ZIP (simulare)\n');
console.log('='.repeat(80));

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

// Creează ZIP temporar
const zipPath = path.join(projectRoot, 'test-prl-temp.zip');
const zip = new AdmZip();

files.forEach(file => {
  const filePath = path.join(folderPath, file);
  zip.addLocalFile(filePath, '', file);
});

zip.writeZip(zipPath);
console.log(`✅ ZIP creat: ${zipPath}\n`);

// Testează extragerea din ZIP
const testZip = new AdmZip(zipPath);
const entries = testZip.getEntries();

console.log(`\n📦 Testare extragere din ZIP (${entries.length} entries):\n`);

entries.forEach((entry, index) => {
  if (entry.isDirectory) return;
  
  const originalName = entry.entryName.split('/').pop() || entry.entryName;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Entry ${index + 1}/${entries.length}: ${originalName}`);
  console.log('='.repeat(80));
  
  const originalBytes = Buffer.from(originalName).toString('hex');
  console.log(`📊 DIN ZIP (entry.entryName):`);
  console.log(`   String: "${originalName}"`);
  console.log(`   Length: ${originalName.length}`);
  console.log(`   Bytes: ${originalBytes.substring(0, 100)}`);
  console.log(`   Contine "é" (c3a9): ${originalBytes.includes('c3a9') ? '✅ DA' : '❌ NU'}`);
  console.log(`   Contine replacement (efbfbd): ${originalBytes.includes('efbfbd') ? '⚠️ DA' : '✅ NU'}`);
  
  const normalized = normalizarNombreArchivo(originalName);
  const normalizedBytes = Buffer.from(normalized).toString('hex');
  
  console.log(`\n📊 DUPĂ NORMALIZARE:`);
  console.log(`   String: "${normalized}"`);
  console.log(`   Bytes: ${normalizedBytes.substring(0, 100)}`);
  console.log(`   Contine "médico": ${normalized.includes('médico') ? '✅ DA' : '❌ NU'}`);
  console.log(`   Contine "é" (c3a9): ${normalizedBytes.includes('c3a9') ? '✅ DA' : '❌ NU'}`);
  console.log(`   Contine replacement (efbfbd): ${normalizedBytes.includes('efbfbd') ? '⚠️ DA' : '✅ NU'}`);
});

// Șterge ZIP temporar
fs.unlinkSync(zipPath);
console.log(`\n🗑️ ZIP temporar șters`);

console.log(`\n${'='.repeat(80)}`);
console.log('✅ Test finalizat!');
console.log('='.repeat(80));
