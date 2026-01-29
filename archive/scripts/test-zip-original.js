const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const zipPath = path.join(__dirname, '../../PUESTO LIMPIADOR Y PERSONAL LIMPIEZA.zip');

if (!fs.existsSync(zipPath)) {
  console.error('❌ ZIP file not found:', zipPath);
  process.exit(1);
}

console.log('📦 Reading ZIP file:', zipPath);
const zip = new AdmZip(zipPath);

const entries = zip.getEntries();

console.log(`\n📋 Found ${entries.length} entries:\n`);

entries.forEach((entry, index) => {
  if (entry.isDirectory) {
    return;
  }
  
  console.log(`\n--- Entry ${index + 1}: ${entry.entryName} ---`);
  console.log('entry.entryName (string):', entry.entryName);
  console.log('entry.entryName (bytes):', Buffer.from(entry.entryName).toString('hex'));
  console.log('entry.entryName (length):', entry.entryName.length);
  
  // Verifică dacă există rawEntryName
  if (entry.rawEntryName) {
    console.log('entry.rawEntryName (bytes):', entry.rawEntryName.toString('hex'));
  }
  
  // Verifică encoding-ul
  const hasReplacement = entry.entryName.includes('\uFFFD') || entry.entryName.includes('');
  console.log('Has replacement char:', hasReplacement);
  
  // Încearcă decodări alternative
  if (entry.rawEntryName) {
    try {
      const decodedLatin1 = entry.rawEntryName.toString('latin1');
      console.log('Decoded as latin1:', decodedLatin1);
      console.log('Decoded latin1 (bytes):', Buffer.from(decodedLatin1, 'utf8').toString('hex'));
    } catch (e) {
      console.log('Error decoding as latin1:', e.message);
    }
    
    try {
      const decodedUtf8 = entry.rawEntryName.toString('utf8');
      console.log('Decoded as utf8:', decodedUtf8);
      console.log('Decoded utf8 (bytes):', Buffer.from(decodedUtf8, 'utf8').toString('hex'));
    } catch (e) {
      console.log('Error decoding as utf8:', e.message);
    }
  }
  
  // Verifică dacă conține "médico" sau variante
  const lower = entry.entryName.toLowerCase();
  if (lower.includes('medico') || lower.includes('mdico') || lower.includes('médico')) {
    console.log('⚠️ Contains medico/mdico/médico pattern');
    console.log('Original bytes around "medico":', Buffer.from(entry.entryName).toString('hex').match(/.{0,20}(?:6d|4d).{0,40}/)?.[0]);
  }
});
