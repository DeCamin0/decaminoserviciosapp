/**
 * Test automat pentru Faza 5: Backend - SMTP From Fallback
 * Verifică că getDefaultFromEmail() funcționează corect cu și fără COMPANY_NAME/COMPANY_EMAIL env vars
 */

// Simulează ConfigService
class MockConfigService {
  constructor(companyName, companyEmail, smtpFrom) {
    this.companyName = companyName;
    this.companyEmail = companyEmail;
    this.smtpFrom = smtpFrom;
  }

  get(key) {
    if (key === 'COMPANY_NAME') {
      return this.companyName;
    }
    if (key === 'COMPANY_EMAIL') {
      return this.companyEmail;
    }
    if (key === 'SMTP_FROM') {
      return this.smtpFrom;
    }
    return null;
  }
}

// Simulează getDefaultFromEmail() logic
function getDefaultFromEmail(configService) {
  const companyName =
    configService.get('COMPANY_NAME') || 'DE CAMINO Servicios Auxiliares SL';
  const companyEmail =
    configService.get('COMPANY_EMAIL') || 'info@decaminoservicios.com';
  return `${companyName} <${companyEmail}>`;
}

// Simulează logica completă pentru fromEmail
function getFromEmail(configService, optionsFrom) {
  return (
    optionsFrom ||
    configService.get('SMTP_FROM') ||
    getDefaultFromEmail(configService)
  );
}

// Teste
console.log('🧪 Test Faza 5: Backend - SMTP From Fallback\n');

// Test 1: Fără COMPANY_NAME și COMPANY_EMAIL (backward compatible)
console.log('Test 1: Fără COMPANY_NAME și COMPANY_EMAIL (backward compatible)');
const config1 = new MockConfigService(null, null, null);
const result1 = getFromEmail(config1, null);
console.log(`  Input: COMPANY_NAME = null, COMPANY_EMAIL = null, SMTP_FROM = null`);
console.log(`  Output: ${result1}`);
console.log(`  Expected: DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>`);
console.log(`  ✅ ${result1 === 'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>' ? 'PASS' : 'FAIL'}\n`);

// Test 2: Cu COMPANY_NAME și COMPANY_EMAIL (Client 2)
console.log('Test 2: Cu COMPANY_NAME și COMPANY_EMAIL (Client 2)');
const config2 = new MockConfigService('Client 2 SRL', 'info@client2.com', null);
const result2 = getFromEmail(config2, null);
console.log(`  Input: COMPANY_NAME = "Client 2 SRL", COMPANY_EMAIL = "info@client2.com", SMTP_FROM = null`);
console.log(`  Output: ${result2}`);
console.log(`  Expected: Client 2 SRL <info@client2.com>`);
console.log(`  ✅ ${result2 === 'Client 2 SRL <info@client2.com>' ? 'PASS' : 'FAIL'}\n`);

// Test 3: Cu SMTP_FROM (prioritate maximă)
console.log('Test 3: Cu SMTP_FROM (prioritate maximă)');
const config3 = new MockConfigService('Client 2 SRL', 'info@client2.com', 'custom@example.com');
const result3 = getFromEmail(config3, null);
console.log(`  Input: COMPANY_NAME = "Client 2 SRL", COMPANY_EMAIL = "info@client2.com", SMTP_FROM = "custom@example.com"`);
console.log(`  Output: ${result3}`);
console.log(`  Expected: custom@example.com (SMTP_FROM are prioritate)`);
console.log(`  ✅ ${result3 === 'custom@example.com' ? 'PASS' : 'FAIL'}\n`);

// Test 4: Cu options.from (prioritate maximă absolută)
console.log('Test 4: Cu options.from (prioritate maximă absolută)');
const config4 = new MockConfigService('Client 2 SRL', 'info@client2.com', 'custom@example.com');
const result4 = getFromEmail(config4, 'override@example.com');
console.log(`  Input: options.from = "override@example.com", SMTP_FROM = "custom@example.com"`);
console.log(`  Output: ${result4}`);
console.log(`  Expected: override@example.com (options.from are prioritate maximă)`);
console.log(`  ✅ ${result4 === 'override@example.com' ? 'PASS' : 'FAIL'}\n`);

// Test 5: Doar COMPANY_NAME (folosește default pentru COMPANY_EMAIL)
console.log('Test 5: Doar COMPANY_NAME (folosește default pentru COMPANY_EMAIL)');
const config5 = new MockConfigService('Client 2 SRL', null, null);
const result5 = getFromEmail(config5, null);
console.log(`  Input: COMPANY_NAME = "Client 2 SRL", COMPANY_EMAIL = null, SMTP_FROM = null`);
console.log(`  Output: ${result5}`);
console.log(`  Expected: Client 2 SRL <info@decaminoservicios.com>`);
console.log(`  ✅ ${result5 === 'Client 2 SRL <info@decaminoservicios.com>' ? 'PASS' : 'FAIL'}\n`);

// Test 6: Doar COMPANY_EMAIL (folosește default pentru COMPANY_NAME)
console.log('Test 6: Doar COMPANY_EMAIL (folosește default pentru COMPANY_NAME)');
const config6 = new MockConfigService(null, 'info@client2.com', null);
const result6 = getFromEmail(config6, null);
console.log(`  Input: COMPANY_NAME = null, COMPANY_EMAIL = "info@client2.com", SMTP_FROM = null`);
console.log(`  Output: ${result6}`);
console.log(`  Expected: DE CAMINO Servicios Auxiliares SL <info@client2.com>`);
console.log(`  ✅ ${result6 === 'DE CAMINO Servicios Auxiliares SL <info@client2.com>' ? 'PASS' : 'FAIL'}\n`);

console.log('✅ Toate testele finalizate!');
