import React from 'react';
import SignWithAutoFirmaButton from '../components/SignWithAutoFirmaButton';

export default function SigningExample() {
  const handleSuccess = (info: { sessionId: string }) => {
    console.log('✅ Document semnat cu succes!', info.sessionId);
    alert(`Document semnat cu succes! Session ID: ${info.sessionId}`);
  };

  const handleError = (error: Error) => {
    console.error('❌ Eroare la semnare:', error);
    alert(`Eroare la semnare: ${error.message}`);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-red-600">Exemplu Semnare cu AutoFirma</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Buton de bază (Română)</h2>
          <SignWithAutoFirmaButton
            documentId="DOC_123"
            reason="Aprobă solicitarea de concediu"
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Buton în spaniolă</h2>
          <SignWithAutoFirmaButton
            documentId="DOC_456"
            reason="Aprobar solicitud de vacaciones"
            label="Firmar con AutoFirma"
            lang="es"
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Buton cu stil personalizat</h2>
          <SignWithAutoFirmaButton
            documentId="DOC_789"
            reason="Semnare contract"
            label="Semnează Contractul"
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg"
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">Configurare necesară în .env:</h3>
        <pre className="text-sm bg-white p-3 rounded border">
{`VITE_API_BASE=https://api.decaminoservicios.com
VITE_AUTOFIRMA_INSTALL_URL=https://firmaelectronica.gob.es/Home/Descargas.html
VITE_SIGNING_POLL_MS=2000
VITE_SIGNING_POLL_MAX_MS=180000
VITE_SIGNING_MOCK=1`}
        </pre>
      </div>
    </div>
  );
}
