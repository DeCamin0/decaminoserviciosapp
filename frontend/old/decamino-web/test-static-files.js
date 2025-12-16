const { existsSync } = require('fs');
const { join } = require('path');

// Test pentru a verifica dacă fișierele statice există
const staticFiles = [
  '/logo.png',
  '/favicon.ico', 
  '/manifest.json',
  '/registerSW.js',
  '/sw.js',
  '/DeCamino-04.svg'
];

console.log('🔍 Verificare fișiere statice...\n');

staticFiles.forEach(file => {
  // Încearcă din dist
  let filePath = join(process.cwd(), 'dist', file);
  let exists = existsSync(filePath);
  let source = 'dist';
  
  if (!exists) {
    // Încearcă din public
    filePath = join(process.cwd(), 'public', file);
    exists = existsSync(filePath);
    source = 'public';
  }
  
  if (exists) {
    console.log(`✅ ${file} - găsit în ${source}`);
  } else {
    console.log(`❌ ${file} - NU EXISTĂ`);
  }
});

console.log('\n📁 Conținut director public:');
const publicFiles = require('fs').readdirSync(join(process.cwd(), 'public'));
publicFiles.forEach(file => console.log(`  - ${file}`));

console.log('\n📁 Conținut director dist:');
if (existsSync(join(process.cwd(), 'dist'))) {
  const distFiles = require('fs').readdirSync(join(process.cwd(), 'dist'));
  distFiles.forEach(file => console.log(`  - ${file}`));
} else {
  console.log('  - Directorul dist nu există');
}
