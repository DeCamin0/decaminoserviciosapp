import { useEffect, useState } from 'react';

/**
 * matchMedia helper — reliable with DevTools device mode.
 * @param {number} minWidth
 * @returns {boolean}
 */
export function useMediaMinWidth(minWidth) {
  const query = `(min-width: ${minWidth}px)`;
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [query]);

  return matches;
}

/**
 * Phone only: max-width 767px (tablet 768–1199 keeps current UI without Mi resumen).
 */
export function useIsPhone() {
  const query = '(max-width: 767px)';
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return matches;
}
