import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Sync a page tab with a URL search param (refresh + Back/Forward).
 *
 * @param {string} paramName e.g. 'tab' | 'vista'
 * @param {string[]} allowedValues
 * @param {string} defaultValue
 * @param {{ replace?: boolean, keepDefaultInUrl?: boolean }} [options]
 * @returns {[string, (next: string) => void]}
 */
export function useSyncedTab(
  paramName,
  allowedValues,
  defaultValue,
  { replace = true, keepDefaultInUrl = true } = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedRef = useRef(allowedValues);
  allowedRef.current = allowedValues;
  const allowedKey = allowedValues.join('|');

  const activeTab = useMemo(() => {
    const raw = searchParams.get(paramName);
    const allowed = allowedKey.split('|');
    if (raw && allowed.includes(raw)) return raw;
    return defaultValue;
  }, [searchParams, paramName, allowedKey, defaultValue]);

  const setActiveTab = useCallback(
    (next) => {
      const allowed = allowedRef.current;
      const value = allowed.includes(next) ? next : defaultValue;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (!keepDefaultInUrl && value === defaultValue) {
            p.delete(paramName);
          } else {
            p.set(paramName, value);
          }
          return p;
        },
        { replace },
      );
    },
    [defaultValue, keepDefaultInUrl, paramName, replace, setSearchParams],
  );

  return [activeTab, setActiveTab];
}
