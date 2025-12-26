import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook personalizat pentru setTimeout cu cleanup automat
 * Previne memory leaks când componenta se unmount
 * 
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 * @returns {Function} Funcția de cleanup manual
 */
export const useTimeout = (callback, delay, dependencies = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Setează timeout-ul
  useEffect(() => {
    if (delay === null || delay === undefined) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      callbackRef.current();
    }, delay);

    timeoutRef.current = timeoutId;

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delay, dependencies]);

  // Funcția de cleanup manual
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return clear;
};

/**
 * Hook pentru debounce cu cleanup automat
 * 
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 * @returns {Function} Funcția de cleanup manual
 */
export const useDebounce = (callback, delay, dependencies = []) => {
  return useTimeout(callback, delay, dependencies);
};

/**
 * Hook pentru interval cu cleanup automat
 * 
 * @param {Function} callback - Funcția de executat
 * @param {number} interval - Interval-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 * @returns {Function} Funcția de cleanup manual
 */
export const useInterval = (callback, interval, dependencies = []) => {
  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);

  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Setează interval-ul
  useEffect(() => {
    if (interval === null || interval === undefined) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      callbackRef.current();
    }, interval);

    intervalRef.current = intervalId;

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [interval, dependencies]);

  // Funcția de cleanup manual
  const clear = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return clear;
};

export default useTimeout;
