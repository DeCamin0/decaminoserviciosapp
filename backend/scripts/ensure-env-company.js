/**
 * Adaugă în backend/.env variabilele COMPANY_* și FRONTEND_APP_URL dacă lipsesc.
 * Rulează din backend: node scripts/ensure-env-company.js
 * Firma 1 (DeCamino) merge fără fallback-uri după ce rulezi asta o dată.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const block = `
# ========== Company (DeCamino – obligatoriu fără fallback) ==========
COMPANY_LEGAL_NAME=DE CAMINO SERVICIOS AUXILIARES, S.L.
COMPANY_LEGAL_NAME_SHORT=DE CAMINO SERVICIOS AUXILIARES SL
COMPANY_ADDRESS_LINE1=Avda. Euzkadi 14, Local 5
COMPANY_CIF=B-85524536
COMPANY_EMAIL=info@decaminoservicios.com
FRONTEND_APP_URL=https://app.decaminoservicios.com
COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastián de los Reyes (Madrid)
COMPANY_PHONE=645 111 999
COMPANY_EMAIL_BCC=decamino.rrhh@gmail.com
COMPANY_SOLICITUDES_EMAIL=info@decaminoservicios.com
COMPANY_EMAIL_FROM_NAME=DE CAMINO Servicios Auxiliares SL
COMPANY_WEBSITE=www.decaminoservicios.com
COMPANY_BRAND_RED=#CC0000
# CORS și API (producție)
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com
API_URL=https://api.decaminoservicios.com
`;

if (!fs.existsSync(envPath)) {
  console.error('Nu există backend/.env. Copiază din .env.example și rulează din nou.');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
if (content.includes('COMPANY_LEGAL_NAME=')) {
  console.log('Variabilele COMPANY_* sunt deja în .env.');
  process.exit(0);
}

// Adaugă la final
content = content.trimEnd();
if (!content.endsWith('\n')) content += '\n';
content += block;
fs.writeFileSync(envPath, content);
console.log('Am adăugat COMPANY_* și FRONTEND_APP_URL în backend/.env. Repornește backend-ul.');
process.exit(0);
