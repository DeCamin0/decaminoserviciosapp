/**
 * Script de test pentru trimiterea unui email de test folosind SMTP Pedidos
 * 
 * Utilizare:
 *   node test-send-pedidos-email.js your-email@example.com
 * 
 * Sau editează TEST_EMAIL din script
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Email-ul de test - poți modifica aici sau pasa ca argument
const TEST_EMAIL = process.argv[2] || 'your-email@example.com';

console.log('🧪 Test Trimite Email Pedidos\n');

// Verifică configurația
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const smtpSecure = process.env.SMTP_SECURE === 'true';

const pedidosUser = process.env.SMTP_PEDIDOS_USER;
const pedidosPassword = process.env.SMTP_PEDIDOS_PASSWORD;
const pedidosFrom = process.env.SMTP_PEDIDOS_FROM || `De Camino Pedidos <${pedidosUser}>`;

console.log('📧 Configurație:');
console.log(`   SMTP_HOST: ${smtpHost}`);
console.log(`   SMTP_PORT: ${smtpPort}`);
console.log(`   SMTP_SECURE: ${smtpSecure}`);
console.log(`   SMTP_PEDIDOS_USER: ${pedidosUser || '❌ MISSING'}`);
console.log(`   SMTP_PEDIDOS_PASSWORD: ${pedidosPassword ? '✅ Set' : '❌ MISSING'}`);
console.log(`   SMTP_PEDIDOS_FROM: ${pedidosFrom}`);
console.log(`   Email destinatar test: ${TEST_EMAIL}\n`);

if (!smtpHost || !pedidosUser || !pedidosPassword) {
  console.error('❌ EROARE: Configurație incompletă!');
  console.error('   Asigură-te că ai setat în .env:');
  console.error('   - SMTP_HOST');
  console.error('   - SMTP_PEDIDOS_USER');
  console.error('   - SMTP_PEDIDOS_PASSWORD');
  process.exit(1);
}

if (TEST_EMAIL === 'your-email@example.com') {
  console.error('❌ EROARE: Specifică un email de test!');
  console.error('   Utilizare: node test-send-pedidos-email.js your-email@example.com');
  process.exit(1);
}

// Creează transporter pentru pedidos
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: pedidosUser,
    pass: pedidosPassword,
  },
});

// Trimite email de test
async function sendTestEmail() {
  try {
    console.log('📤 Trimitere email de test...\n');

    const mailOptions = {
      from: pedidosFrom,
      to: TEST_EMAIL,
      subject: '🧪 Test Email Pedidos - SMTP Configurație',
      html: `
        <h2>Test Email Pedidos</h2>
        <p>Acest email a fost trimis folosind configurația SMTP Pedidos.</p>
        <p><strong>From:</strong> ${pedidosFrom}</p>
        <p><strong>User SMTP:</strong> ${pedidosUser}</p>
        <p><strong>Server:</strong> ${smtpHost}:${smtpPort}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString('ro-RO')}</p>
        <hr>
        <p><em>Dacă ai primit acest email, configurația SMTP Pedidos funcționează corect! ✅</em></p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email trimis cu succes!');
    console.log(`   MessageId: ${info.messageId}`);
    console.log(`   From: ${pedidosFrom}`);
    console.log(`   To: ${TEST_EMAIL}`);
    console.log(`\n📬 Verifică inbox-ul pentru ${TEST_EMAIL}`);
    console.log('   (Verifică și spam-ul dacă nu apare în inbox)\n');
    
  } catch (error) {
    console.error('❌ EROARE la trimiterea email-ului:');
    console.error(`   ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('💡 Posibile cauze:');
      console.error('   - User sau password incorect');
      console.error('   - Contul nu are permisiuni de trimitere');
    } else if (error.code === 'ECONNECTION') {
      console.error('💡 Posibile cauze:');
      console.error('   - Server SMTP nu este accesibil');
      console.error('   - Port sau host incorect');
    }
    
    process.exit(1);
  }
}

sendTestEmail();
