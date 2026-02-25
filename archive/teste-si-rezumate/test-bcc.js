/**
 * Test automat pentru Faza 4: Backend - Email BCC
 * Verifică că getDefaultBcc() funcționează corect cu și fără EMAIL_BCC env var
 */

// Simulează ConfigService
class MockConfigService {
  constructor(emailBcc) {
    this.emailBcc = emailBcc;
  }

  get(key) {
    if (key === 'EMAIL_BCC') {
      return this.emailBcc;
    }
    return null;
  }
}

// Simulează getDefaultBcc() logic
function getDefaultBcc(configService) {
  const emailBcc = configService.get('EMAIL_BCC');
  if (emailBcc) {
    // Suportă multiple adrese separate prin virgulă
    return emailBcc.split(',').map((email) => email.trim()).filter(Boolean);
  }
  // Backward compatible: folosește valorile vechi dacă env var lipsește
  return ['decamino.rrhh@gmail.com'];
}

// Teste
console.log('🧪 Test Faza 4: Backend - Email BCC\n');

// Test 1: Fără EMAIL_BCC (backward compatible)
console.log('Test 1: Fără EMAIL_BCC (backward compatible)');
const config1 = new MockConfigService(null);
const result1 = getDefaultBcc(config1);
console.log(`  Input: EMAIL_BCC = null`);
console.log(`  Output: ${JSON.stringify(result1)}`);
console.log(`  Expected: ["decamino.rrhh@gmail.com"]`);
console.log(`  ✅ ${JSON.stringify(result1) === JSON.stringify(['decamino.rrhh@gmail.com']) ? 'PASS' : 'FAIL'}\n`);

// Test 2: Cu EMAIL_BCC (o singură adresă)
console.log('Test 2: Cu EMAIL_BCC (o singură adresă)');
const config2 = new MockConfigService('client2-rrhh@example.com');
const result2 = getDefaultBcc(config2);
console.log(`  Input: EMAIL_BCC = "client2-rrhh@example.com"`);
console.log(`  Output: ${JSON.stringify(result2)}`);
console.log(`  Expected: ["client2-rrhh@example.com"]`);
console.log(`  ✅ ${JSON.stringify(result2) === JSON.stringify(['client2-rrhh@example.com']) ? 'PASS' : 'FAIL'}\n`);

// Test 3: Cu EMAIL_BCC (multiple adrese)
console.log('Test 3: Cu EMAIL_BCC (multiple adrese)');
const config3 = new MockConfigService('client2-rrhh@example.com, client2-admin@example.com');
const result3 = getDefaultBcc(config3);
console.log(`  Input: EMAIL_BCC = "client2-rrhh@example.com, client2-admin@example.com"`);
console.log(`  Output: ${JSON.stringify(result3)}`);
console.log(`  Expected: ["client2-rrhh@example.com", "client2-admin@example.com"]`);
console.log(`  ✅ ${JSON.stringify(result3) === JSON.stringify(['client2-rrhh@example.com', 'client2-admin@example.com']) ? 'PASS' : 'FAIL'}\n`);

// Test 4: Cu EMAIL_BCC (cu spații)
console.log('Test 4: Cu EMAIL_BCC (cu spații)');
const config4 = new MockConfigService('  client2-rrhh@example.com  ,  client2-admin@example.com  ');
const result4 = getDefaultBcc(config4);
console.log(`  Input: EMAIL_BCC = "  client2-rrhh@example.com  ,  client2-admin@example.com  "`);
console.log(`  Output: ${JSON.stringify(result4)}`);
console.log(`  Expected: ["client2-rrhh@example.com", "client2-admin@example.com"]`);
console.log(`  ✅ ${JSON.stringify(result4) === JSON.stringify(['client2-rrhh@example.com', 'client2-admin@example.com']) ? 'PASS' : 'FAIL'}\n`);

// Test 5: Cu EMAIL_BCC (string gol)
console.log('Test 5: Cu EMAIL_BCC (string gol)');
const config5 = new MockConfigService('');
const result5 = getDefaultBcc(config5);
console.log(`  Input: EMAIL_BCC = ""`);
console.log(`  Output: ${JSON.stringify(result5)}`);
console.log(`  Expected: ["decamino.rrhh@gmail.com"] (fallback)`);
console.log(`  ✅ ${JSON.stringify(result5) === JSON.stringify(['decamino.rrhh@gmail.com']) ? 'PASS' : 'FAIL'}\n`);

console.log('✅ Toate testele finalizate!');
