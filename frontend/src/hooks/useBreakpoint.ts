import { useState, useEffect } from 'react';

/**
 * Hook pentru detectarea breakpoint-ului de mobile
 * Folosește matchMedia pentru (max-width: 767px)
 * 
 * @returns { isMobile } - true dacă ecranul este sub 768px
 */
export const useBreakpoint = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Verifică inițial dacă window este disponibil (SSR safety)
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    // Verifică dacă window este disponibil
    if (typeof window === 'undefined') {
      return;
    }

    // Creează MediaQueryList
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    
    // Handler pentru schimbarea breakpoint-ului
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Nu setăm valoarea inițială aici - este deja setată corect în useState
    // Adaugă listener (folosind addEventListener dacă e disponibil, altfel addListener pentru compatibilitate)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback pentru browsere vechi
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback pentru browsere vechi
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return { isMobile };
};
