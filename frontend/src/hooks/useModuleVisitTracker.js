import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { pathToModuleId } from '../navigation/modulePathMap';
import {
  recordModuleVisit,
  resolveTenantId,
} from '../utils/frequentModulesStorage';

const DEBOUNCE_MS = 45000;

/**
 * Desktop-only (≥1200): count real module navigations into localStorage.
 * Skips: first paint/refresh, same-module nested paths, tab query changes, debounce duplicates.
 *
 * @param {boolean} enabled
 */
export function useModuleVisitTracker(enabled) {
  const location = useLocation();
  const { user } = useAuth();
  const prevPathRef = useRef(null);
  const lastCountedRef = useRef({ moduleId: null, at: 0 });

  const codigo = user?.CODIGO || user?.codigo || '';
  const tenantId = resolveTenantId();

  useEffect(() => {
    if (!enabled || !codigo) return undefined;

    const path = location.pathname || '';

    // Initial mount / remount after refresh — do not count
    if (prevPathRef.current === null) {
      prevPathRef.current = path;
      return undefined;
    }

    // Pathname unchanged (e.g. only search/hash) — ignore
    if (prevPathRef.current === path) return undefined;

    const fromPath = prevPathRef.current;
    prevPathRef.current = path;

    const moduleId = pathToModuleId(path);
    if (!moduleId) return undefined;

    const fromModule = pathToModuleId(fromPath);
    // Still inside same module (e.g. /clientes → /clientes/x) — not a new module access
    if (fromModule && fromModule === moduleId) return undefined;

    const now = Date.now();
    if (
      lastCountedRef.current.moduleId === moduleId &&
      now - lastCountedRef.current.at < DEBOUNCE_MS
    ) {
      return undefined;
    }

    lastCountedRef.current = { moduleId, at: now };
    recordModuleVisit(tenantId, codigo, moduleId);
    return undefined;
  }, [enabled, location.pathname, codigo, tenantId]);
}
