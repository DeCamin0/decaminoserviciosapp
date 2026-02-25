/**
 * Test script pentru verificarea configurației SMTP Pedidos
 * Rulează: node test-pedidos-email.js
 */

require('dotenv').config();

// Simulează ConfigService
class MockConfigService {
  constructor() {
    this.env = process.env;
  }

  get(key) {
    return this.env[key];
  }
}

const configService = new MockConfigService();

console.log('🧪 Test Configurație SMTP Pedidos\n');

// Verifică variabilele principale
const smtpHost = configService.get('SMTP_HOST');
const smtpPort = configService.get('SMTP_PORT') || 587;
const smtpSecure = configService.get('SMTP_SECURE') === 'true';

console.log('📧 Configurație SMTP Principal:');
console.log(`   SMTP_HOST: ${smtpHost || '❌ MISSING'}`);
console.log(`   SMTP_PORT: ${smtpPort}`);
console.log(`   SMTP_SECURE: ${smtpSecure}`);
console.log(`   SMTP_USER: ${configService.get('SMTP_USER') ? '✅ Set' : '❌ MISSING'}`);
console.log(`   SMTP_PASSWORD: ${configService.get('SMTP_PASSWORD') ? '✅ Set (hidden)' : '❌ MISSING'}\n`);

// Verifică variabilele pedidos
const pedidosUser = configService.get('SMTP_PEDIDOS_USER');
const pedidosPassword = configService.get('SMTP_PEDIDOS_PASSWORD');
const pedidosFrom = configService.get('SMTP_PEDIDOS_FROM');

console.log('📦 Configurație SMTP Pedidos:');
console.log(`   SMTP_PEDIDOS_USER: ${pedidosUser || '❌ MISSING'}`);
console.log(`   SMTP_PEDIDOS_PASSWORD: ${pedidosPassword ? '✅ Set (hidden)' : '❌ MISSING'}`);
console.log(`   SMTP_PEDIDOS_FROM: ${pedidosFrom || '❌ MISSING'}\n`);

// Verifică dacă configurația e completă
if (pedidosUser && pedidosPassword) {
  console.log('✅ Configurație Pedidos COMPLETĂ');
  console.log('   → Pedidos vor folosi contul:', pedidosUser);
  console.log('   → Email-urile vor fi trimise de la:', pedidosFrom || pedidosUser);
  console.log('   → Folosește același server:', smtpHost);
} else {
  console.log('⚠️  Configurație Pedidos INCOMPLETĂ');
  console.log('   → Pedidos vor folosi SMTP principal (backward compatible)');
  if (!pedidosUser) console.log('   ❌ Lipsește: SMTP_PEDIDOS_USER');
  if (!pedidosPassword) console.log('   ❌ Lipsește: SMTP_PEDIDOS_PASSWORD');
}

console.log('\n📝 Pentru testare completă:');
console.log('   1. Adaugă variabilele în .env');
console.log('   2. Repornește backend-ul');
console.log('   3. Trimite un pedido prin UI sau Postman');
console.log('   4. Verifică logs-urile backend pentru "SMTP pedidos transporter initialized"');
console.log('   5. Verifică că email-ul trimis are "From" = produccion@decaminoservicios.com\n');
