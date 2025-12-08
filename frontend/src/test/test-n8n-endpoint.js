// Test script pentru endpoint-ul n8n AutoFirma
const testN8nEndpoint = async () => {
  const endpoint = '/webhook-test/171d8236-6ef1-4b97-8605-096476bc1d8b';
  
  // Creează un PDF mock pentru test
  const createMockPdf = () => {
    const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 595 842]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000111 00000 n \n0000000206 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF';
    return new File([pdfContent], 'test-document.pdf', { type: 'application/pdf' });
  };

  const pdfFile = createMockPdf();
  
  try {
    console.log('🧪 Testez endpoint-ul n8n cu FormData...');
    console.log('📤 Trimite PDF:', {
      fileName: pdfFile.name,
      fileSize: `${(pdfFile.size / 1024).toFixed(2)} KB`,
      fileType: pdfFile.type
    });
    
    // Folosim FormData pentru a trimite fișierul
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('documentId', 'TEST_DOC_123');
    formData.append('employeeId', 'EMP_456');
    formData.append('reason', 'Test semnare AutoFirma');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      // Nu setăm Content-Type - browserul îl setează automat pentru FormData
      body: formData
    });
    
    console.log('📥 Status response:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Response:', data);
      
      // Verifică structura response-ului
      if (data.sessionId && data.launchUrl && data.statusUrl && data.downloadUrl) {
        console.log('🎯 Structura corectă! Toate câmpurile sunt prezente.');
      } else {
        console.log('⚠️  Structura incompletă. Câmpuri lipsă:', {
          sessionId: !!data.sessionId,
          launchUrl: !!data.launchUrl,
          statusUrl: !!data.statusUrl,
          downloadUrl: !!data.downloadUrl
        });
      }
      
      // Verifică câmpurile trimise
      console.log('📋 Date trimise la n8n:', {
        documentId: 'TEST_DOC_123',
        employeeId: 'EMP_456',
        reason: 'Test semnare AutoFirma',
        fileName: pdfFile.name,
        fileSize: `${(pdfFile.size / 1024).toFixed(2)} KB`
      });
    } else {
      console.error('❌ Error! Status:', response.status);
      const errorText = await response.text();
      console.error('📄 Error body:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Network error:', error.message);
  }
};

// Rulează testul
testN8nEndpoint();
