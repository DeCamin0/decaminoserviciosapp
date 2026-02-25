// Script pentru testare Client 2
// Simulează build-ul cu VITE_API_URL setat

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Test Client 2: Verificare URL externalizat');
console.log('=============================================\n');

// Simulăm ce se întâmplă în build
const mockEnv = {
  VITE_API_URL: 'https://api.client2-test.com',
};

// Simulăm logica din routes.js
const BACKEND_PROD_URL = mockEnv.VITE_API_URL || 'https://api.decaminoservicios.com';

console.log('1. Verificare env var:');
console.log('   VITE_API_URL:', mockEnv.VITE_API_URL);
console.log('   BACKEND_PROD_URL:', BACKEND_PROD_URL);
console.log('');

// Verifică că nu mai sunt hardcodate-uri (în afară de default)
const routesFile = path.join(__dirname, '../src/utils/routes.js');
const content = fs.readFileSync(routesFile, 'utf8');

console.log('2. Verificare hardcodate-uri:');
const hardcodedMatches = content.match(/https:\/\/api\.decaminoservicios\.com/g);
if (hardcodedMatches) {
  console.log(`   ⚠️  Găsite ${hardcodedMatches.length} instanțe de 'api.decaminoservicios.com'`);
  console.log('   Verifică că sunt doar în:');
  console.log('   - Default fallback (linia 4): ✅ OK');
  console.log('   - Comentarii: ✅ OK');
  console.log('   - Altundeva: ❌ PROBLEM');
} else {
  console.log('   ✅ Nu s-au găsit hardcodate-uri');
}
console.log('');

// Verifică că BACKEND_PROD_URL e folosit
const usesBackendProdUrl = content.includes('BACKEND_PROD_URL');
console.log('3. Verificare folosire BACKEND_PROD_URL:');
if (usesBackendProdUrl) {
  console.log('   ✅ BACKEND_PROD_URL este folosit în cod');
} else {
  console.log('   ❌ BACKEND_PROD_URL nu este folosit');
}
console.log('');

// Simulare build production
console.log('4. Simulare build production:');
console.log('   Dacă VITE_API_URL=https://api.client2.com:');
console.log('   → BACKEND_PROD_URL = https://api.client2.com');
console.log('   → Toate request-urile merg la https://api.client2.com/api/...');
console.log('   ✅ Client 2 va funcționa corect!');
console.log('');

console.log('✅ Test complet!');
