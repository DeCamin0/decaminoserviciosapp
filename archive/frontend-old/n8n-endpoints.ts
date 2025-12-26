// Configurare endpoint-uri n8n
export const N8N_CONFIG = {
  // Base URL pentru n8n
  BASE_URL: 'https://n8n.decaminoservicios.com',
  
  // Headers pentru n8n
  HEADERS: {
    'Content-Type': 'application/json',
    'User-Agent': 'DeCamino-Web/1.0'
  }
};

// ⚠️ DEAD CODE ELIMINAT - AutoFirma endpoint-urile nu sunt folosite
// Se folosește AUTOFIRMA_CONFIG.ENDPOINTS din config/autofirma.ts în locul acestora
// AUTOFIRMA: {
//   PREPARE: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d',
//   STATUS: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d',
//   DOWNLOAD: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d'
// }

// Funcție helper pentru construirea URL-urilor n8n
export function getN8nUrl(endpoint: string): string {
  return `${N8N_CONFIG.BASE_URL}${endpoint}`;
}

// ⚠️ DEAD CODE ELIMINAT - Funcțiile helper AutoFirma nu sunt folosite
// Se folosește AUTOFIRMA_CONFIG.ENDPOINTS din config/autofirma.ts în locul acestora
// export function getAutofirmaPrepareUrl(): string {
//   return getN8nUrl(N8N_CONFIG.AUTOFIRMA.PREPARE);
// }
// export function getAutofirmaStatusUrl(sessionId: string): string {
//   return getN8nUrl(`${N8N_CONFIG.AUTOFIRMA.STATUS}?sid=${sessionId}`);
// }
// export function getAutofirmaDownloadUrl(sessionId: string): string {
//   return getN8nUrl(`${N8N_CONFIG.AUTOFIRMA.DOWNLOAD}?sid=${sessionId}`);
// }
