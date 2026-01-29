// Script de test pentru generarea PDF-ului Lista IBAN
// Rulare: node test-lista-iban-pdf.js

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configurare
const PORT = 3000;
const ENDPOINT = '/api/empleados/lista-iban/export-pdf';

// Token JWT - TREBUIE SĂ ÎL OBȚII DIN BROWSER (localStorage.getItem('auth_token'))
// Sau loghează-te în aplicație și copiază token-ul
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.log('❌ Eroare: Trebuie să setezi JWT_TOKEN!');
  console.log('\n📝 Instrucțiuni:');
  console.log('1. Deschide aplicația în browser (http://localhost:5173)');
  console.log('2. Loghează-te');
  console.log('3. Deschide Console (F12) și rulează: localStorage.getItem("auth_token")');
  console.log('4. Copiază token-ul și rulează:');
  console.log('   set JWT_TOKEN=your_token_here && node test-lista-iban-pdf.js');
  console.log('\nSau setează direct în cod variabila JWT_TOKEN');
  process.exit(1);
}

console.log('🧪 Test generare PDF Lista IBAN...\n');

const options = {
  hostname: 'localhost',
  port: PORT,
  path: ENDPOINT,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Accept': 'application/pdf'
  }
};

const req = http.request(options, (res) => {
  console.log(`📥 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  if (res.statusCode !== 200) {
    console.error('❌ Eroare la generare PDF!');
    res.on('data', (chunk) => {
      console.error('Eroare:', chunk.toString());
    });
    return;
  }

  const chunks = [];
  let totalSize = 0;

  res.on('data', (chunk) => {
    chunks.push(chunk);
    totalSize += chunk.length;
  });

  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const filename = `test-lista-iban-${new Date().toISOString().split('T')[0]}.pdf`;
    const filepath = path.join(__dirname, filename);

    fs.writeFileSync(filepath, buffer);

    console.log('\n✅ PDF generat cu succes!');
    console.log(`📄 Fișier: ${filepath}`);
    console.log(`📊 Dimensiune: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`\n💡 Deschide PDF-ul pentru a verifica formatarea!`);
  });
});

req.on('error', (error) => {
  console.error('❌ Eroare request:', error.message);
  console.log('\n💡 Verifică că:');
  console.log('   - Backend-ul rulează pe localhost:3000');
  console.log('   - Token-ul JWT este valid');
  console.log('   - Ești autentificat în aplicație');
});

req.end();
