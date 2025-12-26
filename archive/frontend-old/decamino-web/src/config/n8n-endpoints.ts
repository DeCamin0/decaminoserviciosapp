// Configurare endpoint-uri n8n pentru AutoFirma
export const N8N_CONFIG = {
  // Base URL pentru n8n
  BASE_URL: 'https://n8n.decaminoservicios.com',
  
  // Endpoint-uri AutoFirma
  AUTOFIRMA: {
    PREPARE: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d', // Endpoint de producție
    STATUS: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d', // Folosește același endpoint pentru status
    DOWNLOAD: '/webhook/918cd7f3-c0b6-49da-9218-46723702224d' // Folosește același endpoint pentru download
  },
  
  // Headers pentru n8n
  HEADERS: {
    'Content-Type': 'application/json',
    'User-Agent': 'DeCamino-Web/1.0'
  }
};

// Funcții helper pentru n8n
export function getN8nUrl(endpoint: string): string {
  return `${N8N_CONFIG.BASE_URL}${endpoint}`;
}

export function getAutofirmaPrepareUrl(): string {
  return getN8nUrl(N8N_CONFIG.AUTOFIRMA.PREPARE);
}

export function getAutofirmaStatusUrl(sessionId: string): string {
  return getN8nUrl(`${N8N_CONFIG.AUTOFIRMA.STATUS}?sid=${sessionId}`);
}

export function getAutofirmaDownloadUrl(sessionId: string): string {
  return getN8nUrl(`${N8N_CONFIG.AUTOFIRMA.DOWNLOAD}?sid=${sessionId}`);
}
