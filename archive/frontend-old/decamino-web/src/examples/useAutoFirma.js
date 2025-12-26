import { useEffect, useState } from 'react';

/**
 * Hook personalizat pentru AutoFirma
 */
export const useAutoFirma = () => {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = () => {
      try {
        const available = window.MiniApplet?.isAvailable?.() || false;
        setIsAvailable(available);
      } catch (err) {
        setIsAvailable(false);
      }
    };

    // Verifică la încărcare
    checkAvailability();

    // Verifică periodic (opțional)
    const interval = setInterval(checkAvailability, 5000);

    return () => clearInterval(interval);
  }, []);

  const signDocument = async (data, options = {}) => {
    if (!isAvailable) {
      throw new Error('AutoFirma nu este disponibil');
    }

    try {
      return await window.MiniApplet.sign(data, options);
    } catch (err) {
      console.error('Eroare la semnare:', err);
      throw err;
    }
  };

  const getCertificates = async () => {
    if (!isAvailable) {
      throw new Error('AutoFirma nu este disponibil');
    }

    try {
      return await window.MiniApplet.getCertificates();
    } catch (err) {
      console.error('Eroare la obținerea certificatelor:', err);
      throw err;
    }
  };

  return {
    isAvailable,
    signDocument,
    getCertificates
  };
};

export default useAutoFirma;

