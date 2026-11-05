/**
 * Accesos frecuentes — local visit history (30 days), keyed by tenant + CODIGO.
 * No backend. Not shared across users on the same browser profile when CODIGO differs.
 */

import { config } from '../config/env.js';

const STORAGE_PREFIX = 'decamino.freqModules.v1';
const RETENTION_DAYS = 30;

/** Stable tenant key for Decamino vs HERA builds (separate local histories). */
export function resolveTenantId() {
  if (config.IS_HERA) return 'hera';
  const cif = String(config.COMPANY_CIF || '').trim();
  if (cif) return `decamino-${cif}`;
  return 'decamino';
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeysToKeep(now = new Date()) {
  const keys = new Set();
  for (let i = 0; i < RETENTION_DAYS; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.add(todayKey(d));
  }
  return keys;
}

/**
 * @param {string} tenantId
 * @param {string} codigo
 */
export function frequentStorageKey(tenantId, codigo) {
  const t = String(tenantId || 'unknown').trim() || 'unknown';
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return null;
  return `${STORAGE_PREFIX}.${t}.${c}`;
}

function readStore(key) {
  if (!key || typeof localStorage === 'undefined') return { v: 1, days: {} };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { v: 1, days: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { v: 1, days: {} };
    const days =
      parsed.days && typeof parsed.days === 'object' && !Array.isArray(parsed.days)
        ? parsed.days
        : {};
    return { v: 1, days };
  } catch {
    return { v: 1, days: {} };
  }
}

function writeStore(key, store) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Drop days older than retention window.
 * @param {{ v: number, days: Record<string, Record<string, number>> }} store
 */
export function pruneStore(store, now = new Date()) {
  const keep = dayKeysToKeep(now);
  const nextDays = {};
  for (const [day, counts] of Object.entries(store.days || {})) {
    if (!keep.has(day)) continue;
    if (counts && typeof counts === 'object') nextDays[day] = counts;
  }
  return { v: 1, days: nextDays };
}

/**
 * Record one module visit for today.
 */
export function recordModuleVisit(tenantId, codigo, moduleId) {
  const key = frequentStorageKey(tenantId, codigo);
  if (!key || !moduleId) return;
  let store = pruneStore(readStore(key));
  const day = todayKey();
  const dayCounts = { ...(store.days[day] || {}) };
  dayCounts[moduleId] = (Number(dayCounts[moduleId]) || 0) + 1;
  store = { v: 1, days: { ...store.days, [day]: dayCounts } };
  writeStore(key, store);
}

/**
 * Aggregated counts last 30 days, highest first.
 * @returns {string[]} moduleIds
 */
export function getTopModuleIds(tenantId, codigo, limit = 6) {
  const key = frequentStorageKey(tenantId, codigo);
  if (!key) return [];
  const store = pruneStore(readStore(key));
  writeStore(key, store); // persist prune

  const totals = {};
  for (const counts of Object.values(store.days)) {
    if (!counts || typeof counts !== 'object') continue;
    for (const [moduleId, n] of Object.entries(counts)) {
      const c = Number(n) || 0;
      if (c <= 0) continue;
      totals[moduleId] = (totals[moduleId] || 0) + c;
    }
  }

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([id]) => id);
}

export { RETENTION_DAYS };
