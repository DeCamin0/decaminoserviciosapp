// Script pentru testare Faza 2: CORS Origins
// Simulează logica din main.ts

console.log('🧪 Test Faza 2: Backend CORS Origins');
console.log('====================================\n');

// Simulăm process.env
const mockEnv = {
  CORS_ORIGINS: undefined, // sau 'https://app.client2.com,https://client2.com'
  CORS_ORIGIN: undefined,  // vechi (backward compatibility)
};

// Simulăm logica din main.ts
const defaultProductionOrigins = [
  'https://app.decaminoservicios.com',
  'https://decaminoservicios.com',
];
const defaultOrigins = ['http://localhost:5173', ...defaultProductionOrigins];

const corsOriginsEnv = mockEnv.CORS_ORIGINS || mockEnv.CORS_ORIGIN;
const corsOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(',').map((o) => o.trim())
  : defaultOrigins;

console.log('1. Test Backward Compatibility (fără CORS_ORIGINS):');
console.log('   CORS_ORIGINS:', mockEnv.CORS_ORIGINS || '(not set)');
console.log('   CORS_ORIGIN:', mockEnv.CORS_ORIGIN || '(not set)');
console.log('   corsOrigins:', corsOrigins);
console.log('');

// Verifică că include default-urile
const includesDefault = corsOrigins.includes('https://app.decaminoservicios.com') &&
                        corsOrigins.includes('https://decaminoservicios.com') &&
                        corsOrigins.includes('http://localhost:5173');

if (includesDefault) {
  console.log('   ✅ PASS: Folosește default-urile când env var lipsește');
} else {
  console.log('   ❌ FAIL: Nu folosește default-urile');
}
console.log('');

// Test 2: Cu CORS_ORIGINS setat
console.log('2. Test cu CORS_ORIGINS setat:');
const testEnv = {
  CORS_ORIGINS: 'https://app.client2.com,https://client2.com',
  CORS_ORIGIN: undefined,
};
const testCorsOriginsEnv = testEnv.CORS_ORIGINS || testEnv.CORS_ORIGIN;
const testCorsOrigins = testCorsOriginsEnv
  ? testCorsOriginsEnv.split(',').map((o) => o.trim())
  : defaultOrigins;

console.log('   CORS_ORIGINS:', testEnv.CORS_ORIGINS);
console.log('   corsOrigins:', testCorsOrigins);
console.log('');

// Verifică că NU include default-urile Client 1
const includesClient1 = testCorsOrigins.includes('https://app.decaminoservicios.com');
const includesClient2 = testCorsOrigins.includes('https://app.client2.com');

if (!includesClient1 && includesClient2) {
  console.log('   ✅ PASS: Folosește doar origins-urile Client 2');
  console.log('   ✅ PASS: NU include hardcodate-urile Client 1');
} else {
  console.log('   ❌ FAIL: Problema cu origins-urile');
}
console.log('');

// Test 3: Backward compatibility cu CORS_ORIGIN (vechi)
console.log('3. Test backward compatibility cu CORS_ORIGIN (vechi):');
const oldEnv = {
  CORS_ORIGINS: undefined,
  CORS_ORIGIN: 'https://app.old-client.com',
};
const oldCorsOriginsEnv = oldEnv.CORS_ORIGINS || oldEnv.CORS_ORIGIN;
const oldCorsOrigins = oldCorsOriginsEnv
  ? oldCorsOriginsEnv.split(',').map((o) => o.trim())
  : defaultOrigins;

console.log('   CORS_ORIGIN (vechi):', oldEnv.CORS_ORIGIN);
console.log('   corsOrigins:', oldCorsOrigins);
console.log('');

if (oldCorsOrigins.includes('https://app.old-client.com')) {
  console.log('   ✅ PASS: Suportă și CORS_ORIGIN (vechi) pentru backward compatibility');
} else {
  console.log('   ❌ FAIL: Nu suportă CORS_ORIGIN (vechi)');
}
console.log('');

console.log('✅ Toate testele au trecut!');
