import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook pentru cleanup automat al timeout-urilor și interval-urilor
 * Previne memory leaks în aplicație
 */
export const useCleanup = () => {
  const timeoutsRef = useRef(new Set());
  const intervalsRef = useRef(new Set());

  // Adaugă timeout la lista de cleanup
  const addTimeout = useCallback((timeoutId) => {
    if (timeoutId) {
      timeoutsRef.current.add(timeoutId);
    }
    return timeoutId;
  }, []);

  // Adaugă interval la lista de cleanup
  const addInterval = useCallback((intervalId) => {
    if (intervalId) {
      intervalsRef.current.add(intervalId);
    }
    return intervalId;
  }, []);

  // Cleanup manual pentru un timeout specific
  const clearTimeoutRef = useCallback((timeoutId) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(timeoutId);
    }
  }, []);

  // Cleanup manual pentru un interval specific
  const clearIntervalRef = useCallback((intervalId) => {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalsRef.current.delete(intervalId);
    }
  }, []);

  // Cleanup automat când componenta se unmount
  useEffect(() => {
    const timeoutsSet = timeoutsRef.current;
    const intervalsSet = intervalsRef.current;

    return () => {
      timeoutsSet.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      timeoutsSet.clear();

      intervalsSet.forEach(intervalId => {
        window.clearInterval(intervalId);
      });
      intervalsSet.clear();
    };
  }, []);

  return {
    addTimeout,
    addInterval,
    clearTimeout: clearTimeoutRef,
    clearInterval: clearIntervalRef,
    timeouts: timeoutsRef.current,
    intervals: intervalsRef.current
  };
};

/**
 * Hook pentru setTimeout cu cleanup automat
 * @param {Function} callback - Funcția de executat
 * @param {number} delay - Delay-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 */
export const useSafeTimeout = (callback, delay, dependencies = []) => {
  const { addTimeout, clearTimeout: removeTimeout } = useCleanup();
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Setează timeout-ul
  useEffect(() => {
    if (delay !== null && delay !== undefined) {
      // Cleanup timeout-ul anterior
      if (timeoutRef.current) {
        removeTimeout(timeoutRef.current);
      }
      
      // Creează timeout-ul nou
      timeoutRef.current = setTimeout(() => {
        callbackRef.current();
      }, delay);
      
      // Adaugă la lista de cleanup
      addTimeout(timeoutRef.current);
    }

    // Cleanup când dependencies se schimbă
    return () => {
      if (timeoutRef.current) {
        removeTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [addTimeout, removeTimeout, delay, dependencies]);

  return removeTimeout;
};

/**
 * Hook pentru setInterval cu cleanup automat
 * @param {Function} callback - Funcția de executat
 * @param {number} interval - Interval-ul în milisecunde
 * @param {Array} dependencies - Dependencies pentru re-executare
 */
export const useSafeInterval = (callback, interval, dependencies = []) => {
  const { addInterval, clearInterval: removeInterval } = useCleanup();
  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);

  // Actualizează callback-ul când se schimbă
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Setează interval-ul
  useEffect(() => {
    if (interval !== null && interval !== undefined) {
      // Cleanup interval-ul anterior
      if (intervalRef.current) {
        removeInterval(intervalRef.current);
      }
      
      // Creează interval-ul nou
      intervalRef.current = setInterval(() => {
        callbackRef.current();
      }, interval);
      
      // Adaugă la lista de cleanup
      addInterval(intervalRef.current);
    }

    // Cleanup când dependencies se schimbă
    return () => {
      if (intervalRef.current) {
        removeInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [addInterval, removeInterval, interval, dependencies]);

  return removeInterval;
};

export default useCleanup;
