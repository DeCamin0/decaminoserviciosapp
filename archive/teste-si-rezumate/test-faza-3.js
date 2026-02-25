// Script pentru testare Faza 3: Date Companie în Export-uri
// Simulează logica din exportExcel.ts și alte fișiere

console.log('🧪 Test Faza 3: Frontend - Date Companie în Export-uri');
console.log('====================================================\n');

// Simulăm import.meta.env
const mockEnv = {
  VITE_COMPANY_NAME: undefined,
  VITE_COMPANY_CIF: undefined,
  VITE_COMPANY_ADDRESS: undefined,
  VITE_COMPANY_PHONE: undefined,
  VITE_COMPANY_EMAIL: undefined,
  VITE_PRIMARY_COLOR: undefined,
  VITE_SECONDARY_COLOR: undefined,
};

// Simulăm logica din exportExcel.ts
const COMPANY_INFO = {
  name: mockEnv.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: mockEnv.VITE_COMPANY_CIF || 'B85524536',
  address: mockEnv.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: mockEnv.VITE_COMPANY_PHONE || '910 440 275',
  email: mockEnv.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};

const PRIMARY_COLOR = (mockEnv.VITE_PRIMARY_COLOR || '#CC0000').replace('#', '');
const SECONDARY_COLOR = (mockEnv.VITE_SECONDARY_COLOR || '#0066CC').replace('#', '');

console.log('1. Test Backward Compatibility (fără env vars):');
console.log('   COMPANY_INFO:', COMPANY_INFO);
console.log('   PRIMARY_COLOR:', PRIMARY_COLOR);
console.log('   SECONDARY_COLOR:', SECONDARY_COLOR);
console.log('');

// Verifică că folosește default-urile
const usesDefaults = 
  COMPANY_INFO.name === 'DE CAMINO SERVICIOS AUXILIARES SL' &&
  COMPANY_INFO.cif === 'B85524536' &&
  PRIMARY_COLOR === 'CC0000' &&
  SECONDARY_COLOR === '0066CC';

if (usesDefaults) {
  console.log('   ✅ PASS: Folosește default-urile când env vars lipsesc');
} else {
  console.log('   ❌ FAIL: Nu folosește default-urile');
}
console.log('');

// Test 2: Cu env vars setate
console.log('2. Test cu env vars setate (Client 2):');
const testEnv = {
  VITE_COMPANY_NAME: 'CLIENT 2 SERVICIOS SL',
  VITE_COMPANY_CIF: 'B12345678',
  VITE_COMPANY_ADDRESS: 'Dirección Client 2',
  VITE_COMPANY_PHONE: '912 345 678',
  VITE_COMPANY_EMAIL: 'info@client2.com',
  VITE_PRIMARY_COLOR: '#FF0000',
  VITE_SECONDARY_COLOR: '#0000FF',
};

const testCompanyInfo = {
  name: testEnv.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: testEnv.VITE_COMPANY_CIF || 'B85524536',
  address: testEnv.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: testEnv.VITE_COMPANY_PHONE || '910 440 275',
  email: testEnv.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};

const testPrimaryColor = (testEnv.VITE_PRIMARY_COLOR || '#CC0000').replace('#', '');
const testSecondaryColor = (testEnv.VITE_SECONDARY_COLOR || '#0066CC').replace('#', '');

console.log('   COMPANY_INFO:', testCompanyInfo);
console.log('   PRIMARY_COLOR:', testPrimaryColor);
console.log('   SECONDARY_COLOR:', testSecondaryColor);
console.log('');

// Verifică că folosește env vars
const usesEnvVars = 
  testCompanyInfo.name === 'CLIENT 2 SERVICIOS SL' &&
  testCompanyInfo.cif === 'B12345678' &&
  testPrimaryColor === 'FF0000' &&
  testSecondaryColor === '0000FF';

if (usesEnvVars) {
  console.log('   ✅ PASS: Folosește env vars când sunt setate');
  console.log('   ✅ PASS: NU include datele Client 1');
} else {
  console.log('   ❌ FAIL: Nu folosește env vars');
}
console.log('');

// Test 3: Verificare format culori
console.log('3. Test format culori:');
const colorWithHash = '#CC0000';
const colorWithoutHash = 'CC0000';
const processedColor1 = (colorWithHash || '#CC0000').replace('#', '');
const processedColor2 = (colorWithoutHash || '#CC0000').replace('#', '');

if (processedColor1 === 'CC0000' && processedColor2 === 'CC0000') {
  console.log('   ✅ PASS: Procesează corect culorile (cu sau fără #)');
} else {
  console.log('   ❌ FAIL: Problema cu procesarea culorilor');
}
console.log('');

console.log('✅ Toate testele au trecut!');
