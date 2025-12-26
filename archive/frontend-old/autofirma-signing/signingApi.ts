import { PrepareResponse, StatusResponse, SigningError } from '../types/signing';
import { AUTOFIRMA_CONFIG } from '../config/autofirma';
import { N8N_CONFIG } from '../config/n8n-endpoints'; // getN8nUrl nu este folosit în acest fișier

const API_BASE = import.meta.env.VITE_API_BASE || N8N_CONFIG.BASE_URL;

// Mock mode pentru development - dezactivat implicit pentru a folosi AutoFirma reală
const isMockMode = import.meta.env.VITE_SIGNING_MOCK === '1';

// Mock data pentru development (doar când VITE_SIGNING_MOCK=1)
const mockPrepareResponse: PrepareResponse = {
  sessionId: 'mock-session-123',
  launchUrl: 'afirma://mock-sign',
  statusUrl: '/sign/autofirma/status?sid=mock-session-123',
  downloadUrl: '/sign/autofirma/download?sid=mock-session-123'
};

export async function prepare(
  documentId: string, 
  employeeId: string, 
  reason?: string, 
  pdfFile: File
): Promise<PrepareResponse> {
  if (isMockMode) {
    // Simulează delay pentru mock
    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockPrepareResponse;
  }

  // ENDPOINT REAL: POST /webhook-test/171d8236-6ef1-4b97-8605-096476bc1d8b (n8n prin proxy Vite)
  try {
    // Folosim FormData pentru a trimite fișierul
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('documentId', documentId);
    formData.append('employeeId', employeeId);
    if (reason) {
      formData.append('reason', reason);
    }

    console.log('📤 Trimite la n8n:', { 
      documentId, 
      employeeId, 
      reason, 
      fileName: pdfFile.name,
      fileSize: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`
    });

    console.log('🔍 AutoFirma PREPARE endpoint:', AUTOFIRMA_CONFIG.ENDPOINTS.PREPARE);
    console.log('🔍 FormData contents:', {
      file: pdfFile.name,
      documentId,
      employeeId,
      reason
    });

    // Folosește proxy-ul Vite pentru a evita CORS
    const res = await fetch(AUTOFIRMA_CONFIG.ENDPOINTS.PREPARE, {
      method: 'POST',
      // Nu mai setăm Content-Type - browserul îl setează automat pentru FormData
      body: formData
    });

    console.log('🔍 Response status:', res.status);
    console.log('🔍 Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const error = new SigningError(`Prepare failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const response = await res.json();
    
    console.log('🔍 Răspuns primit de la prepare endpoint:', response);
    
    // Mapează răspunsul din backend la interfața PrepareResponse
    if (response.ok && response.sid && response.links) {
      // Extrage token-ul din URL-ul fileFetch
      const fileFetchUrl = response.links.fileFetch;
      const tokenMatch = fileFetchUrl.match(/[?&]token=([^&]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      
      const mappedResponse = {
        sessionId: response.sid,
        launchUrl: response.links.openAutoFirma,
        statusUrl: response.links.callback, // Folosește callback pentru status
        downloadUrl: response.links.fileFetch, // Folosește fileFetch pentru download
        token: token // Token pentru accesarea PDF-ului original
      };
      console.log('✅ Răspuns mappat:', mappedResponse);
      return mappedResponse;
    } else {
      console.error('❌ Răspuns invalid:', response);
      throw new SigningError('Invalid response format from prepare endpoint');
    }
  } catch (error) {
    console.error('❌ Error in prepare function:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    if (error instanceof SigningError) {
      throw error;
    }
    
    const signingError = new SigningError(`Network error during prepare: ${error.message}`);
    signingError.code = 'NETWORK_ERROR';
    signingError.originalError = error;
    throw signingError;
  }
}

export async function getStatus(statusUrl: string): Promise<StatusResponse> {
  if (isMockMode) {
    // Simulează progresul în mock mode
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulează că semnarea se termină după ~3-5 secunde
    // Folosim un timestamp static pentru a simula progresul
    const mockProgress = Math.random();
    
    if (mockProgress > 0.7) {
      return { status: 'done' };
    } else if (mockProgress > 0.3) {
      return { status: 'waiting_signer' };
    } else {
      return { status: 'pending' };
    }
  }

  try {
    // ENDPOINT REAL: GET /sign/autofirma/status?sid=<sessionId>
    const fullUrl = statusUrl.startsWith('http') ? statusUrl : `${API_BASE}${statusUrl}`;
    const res = await fetch(fullUrl);
    
    if (!res.ok) {
      const error = new SigningError(`Status failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }

    return res.json() as Promise<StatusResponse>;
  } catch (error) {
    if (error instanceof SigningError) {
      throw error;
    }
    
    const signingError = new SigningError('Network error during status check');
    signingError.code = 'NETWORK_ERROR';
    throw signingError;
  }
}
