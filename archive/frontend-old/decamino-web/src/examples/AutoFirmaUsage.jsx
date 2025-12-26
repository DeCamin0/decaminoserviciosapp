import { useEffect, useState } from 'react';

/**
 * Exemplu de utilizare AutoFirma în React
 */
export const AutoFirmaUsage = () => {
  const [isAutoFirmaAvailable, setIsAutoFirmaAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Verifică dacă AutoFirma este disponibil
    checkAutoFirmaAvailability();
  }, []);

  const checkAutoFirmaAvailability = () => {
    try {
      // Verifică dacă obiectul global există
      const available = window.MiniApplet?.isAvailable?.() || false;
      setIsAutoFirmaAvailable(available);
    } catch (err) {
      console.error('Eroare la verificarea AutoFirma:', err);
      setIsAutoFirmaAvailable(false);
    }
  };

  const handleSignDocument = async (documentData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Verifică din nou disponibilitatea
      if (!window.MiniApplet?.isAvailable?.()) {
        throw new Error('AutoFirma nu este disponibil');
      }

      // Semnează documentul
      const signedData = await window.MiniApplet.sign(documentData, {
        // Opțiuni pentru semnare
        format: 'PDF',
        // Alte opțiuni...
      });

      console.log('Document semnat cu succes:', signedData);
      return signedData;

    } catch (err) {
      console.error('Eroare la semnarea documentului:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCertificates = async () => {
    try {
      if (!window.MiniApplet?.getCertificates) {
        throw new Error('Funcția getCertificates nu este disponibilă');
      }

      const certificates = await window.MiniApplet.getCertificates();
      console.log('Certificat disponibile:', certificates);
      return certificates;

    } catch (err) {
      console.error('Eroare la obținerea certificatelor:', err);
      setError(err.message);
      throw err;
    }
  };

  return {
    isAutoFirmaAvailable,
    isLoading,
    error,
    signDocument: handleSignDocument,
    getCertificates: handleGetCertificates,
    checkAvailability: checkAutoFirmaAvailability
  };
};

export default AutoFirmaUsage;
