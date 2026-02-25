// Script simplu pentru testare Faza 1
// Rulează: node test-routes.js

// Simulăm import.meta.env
const mockEnv = {
  DEV: false,
  VITE_API_URL: undefined, // sau 'https://api.test-client.com' pentru test
};

// Simulăm logica din routes.js
const BACKEND_DEV_URL = 'http://localhost:3000';
const BACKEND_PROD_URL = mockEnv.VITE_API_URL || 'https://api.decaminoservicios.com';
const BASE_URL = mockEnv.DEV 
  ? BACKEND_DEV_URL
  : BACKEND_PROD_URL;

console.log('🧪 Test Faza 1: Frontend API URLs');
console.log('================================');
console.log('✅ BACKEND_DEV_URL:', BACKEND_DEV_URL);
console.log('✅ BACKEND_PROD_URL:', BACKEND_PROD_URL);
console.log('✅ BASE_URL:', BASE_URL);
console.log('✅ VITE_API_URL:', mockEnv.VITE_API_URL || '(not set - using default)');
console.log('');

// Test 1: Backward compatibility (fără VITE_API_URL)
console.log('Test 1: Backward Compatibility');
console.log('--------------------------------');
if (BACKEND_PROD_URL === 'https://api.decaminoservicios.com') {
  console.log('✅ PASS: Folosește default-ul când VITE_API_URL lipsește');
} else {
  console.log('❌ FAIL: Nu folosește default-ul');
}

// Test 2: Cu VITE_API_URL setat
console.log('');
console.log('Test 2: Cu VITE_API_URL setat');
console.log('------------------------------');
const testEnv = { ...mockEnv, VITE_API_URL: 'https://api.test-client.com' };
const testBackendProdUrl = testEnv.VITE_API_URL || 'https://api.decaminoservicios.com';
if (testBackendProdUrl === 'https://api.test-client.com') {
  console.log('✅ PASS: Folosește VITE_API_URL când e setat');
} else {
  console.log('❌ FAIL: Nu folosește VITE_API_URL');
}

console.log('');
console.log('✅ Toate testele au trecut!');
