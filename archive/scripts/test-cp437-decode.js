const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
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
  
  console.log(`\n--- Entry ${index + 1} ---`);
  
  // Metoda veche (entryName)
  console.log('entryName (original):', entry.entryName);
  console.log('entryName (bytes):', Buffer.from(entry.entryName).toString('hex').substring(0, 100));
  
  // Metoda nouă (decodare CP437)
  let decoded = entry.entryName;
  if (entry.rawEntryName && Buffer.isBuffer(entry.rawEntryName)) {
    try {
      decoded = iconv.decode(entry.rawEntryName, 'cp437');
      console.log('✅ Decodificado desde CP437:', decoded);
      console.log('Decoded bytes:', Buffer.from(decoded, 'utf8').toString('hex').substring(0, 100));
      
      // Verifică dacă conține "médico" corect
      if (decoded.includes('médico')) {
        console.log('✅✅✅ Contiene "médico" CORRECTAMENTE!');
      } else if (decoded.includes('mdico') || decoded.includes('medico')) {
        console.log('⚠️ Todavía tiene mdico/medico (necesita normalización adicional)');
      }
    } catch (e) {
      console.log('❌ Error decodificando:', e.message);
    }
  } else {
    console.log('⚠️ No rawEntryName disponible, usando entryName');
  }
  
  // Extrage doar numele fișierului (fără path)
  const fileName = decoded.split('/').pop() || decoded;
  console.log('Nombre archivo final:', fileName);
});
