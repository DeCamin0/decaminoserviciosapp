import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook pentru polling cu pause/resume automat când tab-ul nu e activ
 * și jitter pentru a evita sincronizarea request-urilor
 * 
 * @param {Function} callback - Funcția de apelat la fiecare poll
 * @param {number} intervalMs - Intervalul de bază în milisecunde
 * @param {boolean} enabled - Dacă polling-ul e activ (default: true)
 * @param {number} jitterMs - Jitter maxim în ms (default: 20% din interval)
 */
export const usePolling = (callback, intervalMs, enabled = true, jitterMs = null) => {
  const callbackRef = useRef(callback);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const isVisibleRef = useRef(!document.hidden);
  
  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Calculează jitter-ul
  const getJitteredInterval = useCallback(() => {
    const jitter = jitterMs !== null ? jitterMs : Math.floor(intervalMs * 0.2);
    const randomJitter = Math.floor(Math.random() * jitter);
    return intervalMs + randomJitter;
  }, [intervalMs, jitterMs]);

  // Funcție pentru a programa următorul poll
  const scheduleNext = useCallback(() => {
    if (!enabled || !isVisibleRef.current) return;
    
    const nextInterval = getJitteredInterval();
    timeoutRef.current = setTimeout(() => {
      if (isVisibleRef.current && enabled) {
        callbackRef.current();
        scheduleNext();
      }
    }, nextInterval);
  }, [enabled, getJitteredInterval]);

  // Gestionează visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      isVisibleRef.current = isVisible;
      
      if (isVisible && enabled) {
        // Când tab-ul devine activ, rulează imediat și apoi continuă polling-ul
        callbackRef.current();
        scheduleNext();
      } else {
        // Când tab-ul devine inactiv, oprește polling-ul
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, scheduleNext]);

  // Inițializează polling-ul
  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Rulează imediat dacă tab-ul e activ
    if (isVisibleRef.current) {
      callbackRef.current();
      scheduleNext();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, scheduleNext]);

  // Cleanup la unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
};

export default usePolling;
