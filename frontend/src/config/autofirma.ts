// Configurare endpoint-uri AutoFirma
// ⚠️ DEAD CODE: Endpoint-urile n8n nu mai sunt folosite (signingApi.ts mutat în archive/frontend-old/autofirma-signing/)
// Păstrăm doar PROTOCOL și TIMEOUTS pentru referință viitoare
// Endpoint-urile n8n eliminate:
// - PREPARE: '/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f'
// - STATUS: '/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4'
// - DOWNLOAD: '/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4'
// signingApi.ts, useAutofirmaSigning.ts și SignWithAutoFirmaButton.tsx au fost mutate în archive/frontend-old/autofirma-signing/
export const AUTOFIRMA_CONFIG = {
  
  // Protocol handler pentru AutoFirma
  PROTOCOL: 'afirma://',
  
  // Timeout-uri
  TIMEOUTS: {
    LAUNCH: 2500, // 2.5 secunde pentru a detecta dacă AutoFirma s-a deschis
    POLL: 2000,   // 2 secunde între verificări de status
    MAX: 180000   // 3 minute maxim pentru întregul proces
  },
  
  // URL-uri de instalare
  INSTALL_URLS: {
    ES: 'https://firmaelectronica.gob.es/Home/Descargas.html',
    RO: 'https://www.certisign.ro/autofirma'
  }
};

// Funcții helper pentru construirea URL-urilor
// ⚠️ DEAD CODE: Aceste funcții nu mai sunt folosite (signingApi.ts mutat în archive/frontend-old/autofirma-signing/)
// Păstrăm doar buildLaunchUrl pentru referință viitoare
// export function buildStatusUrl(sessionId: string): string {
//   return `${AUTOFIRMA_CONFIG.ENDPOINTS.STATUS}?sid=${sessionId}`;
// }

// export function buildDownloadUrl(sessionId: string): string {
//   return `${AUTOFIRMA_CONFIG.ENDPOINTS.DOWNLOAD}?sid=${sessionId}`;
// }

export function buildLaunchUrl(action: string, sessionId: string): string {
  return `${AUTOFIRMA_CONFIG.PROTOCOL}${action}?sid=${sessionId}`;
}
