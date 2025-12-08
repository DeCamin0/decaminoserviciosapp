import { useEffect, useRef } from 'react';

/**
 * Utilitare pentru setTimeout cu cleanup automat
 * Previne memory leaks în aplicație
 */

/**
 * Creează un setTimeout cu cleanup automat
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @returns {Object} { timeoutId, cleanup }
 */
export const createSafeTimeout = (callback, delay) => {
  const timeoutId = setTimeout(callback, delay);
  
  return {
    timeoutId,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
};

/**
 * Hook pentru setTimeout cu cleanup automat în useEffect
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 */
export const useSafeTimeout = (callback, delay, dependencies = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Setează timeout-ul
  useEffect(() => {
    if (delay !== null && delay !== undefined) {
      timeoutRef.current = setTimeout(() => {
        callbackRef.current();
      }, delay);
    }

    // Cleanup automat când componenta se unmount sau dependencies se schimbă
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delay, dependencies]);

  // Funcția de cleanup manual
  const clearScheduledTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return clearScheduledTimeout;
};

/**
 * Wrapper pentru setTimeout cu cleanup automat
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @returns {number} Timeout ID
 */
export const safeSetTimeout = (callback, delay) => {
  const timeoutId = setTimeout(callback, delay);
  
  // Adaugă cleanup la window pentru a preveni memory leaks
  if (typeof window !== 'undefined') {
    if (!window.__timeoutCleanup) {
      window.__timeoutCleanup = new Set();
    }
    window.__timeoutCleanup.add(timeoutId);
  }
  
  return timeoutId;
};

/**
 * Cleanup pentru toate timeout-urile safe
 */
export const cleanupAllSafeTimeouts = () => {
  if (typeof window !== 'undefined' && window.__timeoutCleanup) {
    window.__timeoutCleanup.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    window.__timeoutCleanup.clear();
  }
};

/**
 * Cleanup pentru un timeout specific
 * @param {number} timeoutId - ID-ul timeout-ului
 */
export const cleanupSafeTimeout = (timeoutId) => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    if (typeof window !== 'undefined' && window.__timeoutCleanup) {
      window.__timeoutCleanup.delete(timeoutId);
    }
  }
};

export default {
  createSafeTimeout,
  useSafeTimeout,
  safeSetTimeout,
  cleanupAllSafeTimeouts,
  cleanupSafeTimeout
};
