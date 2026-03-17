/**
 * Adaugă în backend/.env.client2.local variabilele pentru portada PDF HERA (albastru deschis ca la login)
 * dacă lipsesc. Rulează din backend: node scripts/ensure-env-client2-portada.js
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.client2.local');
const linesToAdd = [
  '',
  '# Portada PDF (presupuestos/informes): fundal albastru deschis ca la login',
  'COMPANY_PORTADA_BG=#9EC9E6',
  'COMPANY_PORTADA_TEXT_COLOR=#1e3a5f',
];

if (!fs.existsSync(envPath)) {
  console.error('Nu există backend/.env.client2.local. Copiază din .env.client2.example și rulează din nou.');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
if (content.includes('COMPANY_PORTADA_BG=')) {
  console.log('COMPANY_PORTADA_BG și COMPANY_PORTADA_TEXT_COLOR sunt deja în .env.client2.local.');
  process.exit(0);
}

content = content.trimEnd();
if (!content.endsWith('\n')) content += '\n';
content += linesToAdd.join('\n') + '\n';
fs.writeFileSync(envPath, content);
console.log('Am adăugat COMPANY_PORTADA_BG și COMPANY_PORTADA_TEXT_COLOR în .env.client2.local. Repornește backend-ul HERA (port 3002).');
process.exit(0);
