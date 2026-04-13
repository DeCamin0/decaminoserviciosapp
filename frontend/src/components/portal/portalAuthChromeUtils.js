import { config } from '../../config/env.js';

/** Misma regla que LoginPage (HERA / client 2). */
export function portalIsClient2() {
  return (config.LOGO_PATH || '').toLowerCase().includes('hera');
}

export function portalFieldClass() {
  const isClient2 = portalIsClient2();
  if (isClient2) {
    return 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/40 focus:border-[var(--primary-color)]/50 transition-all';
  }
  return 'w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/50 focus:border-[var(--primary-color)]/50 transition-all';
}

export function portalLabelClass() {
  return portalIsClient2()
    ? 'block text-sm font-semibold text-gray-800 mb-2'
    : 'block text-sm font-medium text-gray-300 mb-2';
}
