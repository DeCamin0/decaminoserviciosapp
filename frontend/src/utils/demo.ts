/**
 * DEMO Mode Utilities
 * Safe and non-invasive DEMO mode implementation
 */

/**
 * Check if DEMO mode is active
 * Returns true if any of these conditions are met:
 * - VITE_DEMO=true in environment
 * - ?demo=true in URL
 * - localStorage.app_demo='1'
 */
export function isDemoMode(): boolean {
  // Environment flag
  const envFlag = String(import.meta.env.VITE_DEMO ?? '').toLowerCase() === 'true';
  
  // LocalStorage flag (most reliable)
  const lsFlag = typeof window !== 'undefined' && localStorage.getItem('app_demo') === '1';
  
  // URL query parameter (only check once)
  let queryFlag = false;
  if (typeof window !== 'undefined') {
    try {
      queryFlag = new URLSearchParams(window.location.search).get('demo') === 'true';
    } catch (e) {
      // Ignore URL parsing errors
    }
  }
  
  const isDemo = envFlag || queryFlag || lsFlag;
  
  console.log('🎭 isDemoMode result:', { isDemo, envFlag, queryFlag, lsFlag });
  
  return isDemo;
}

/**
 * Set DEMO mode on/off
 * Updates localStorage and reloads the page
 */
export function setDemoMode(on: boolean) {
  console.log('🎭 setDemoMode called with:', on);
  
  if (typeof window === 'undefined') {
    console.log('🎭 Window is undefined, returning');
    return;
  }
  
  try {
    if (on) {
      localStorage.setItem('app_demo', '1');
      console.log('🎭 DEMO mode activated in localStorage');
    } else {
      localStorage.removeItem('app_demo');
      console.log('🎭 DEMO mode deactivated in localStorage');
    }
    
    console.log('🎭 Reloading page...');
    window.location.reload();
  } catch (error) {
    console.error('🎭 Error in setDemoMode:', error);
  }
}

/**
 * Reset DEMO data (clears localStorage demo store)
 */
export function resetDemoData() {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('__demo_store__');
  window.location.reload();
}

/**
 * Get DEMO mode status for debugging
 */
export function getDemoStatus() {
  return {
    isDemo: isDemoMode(),
    envFlag: String(import.meta.env.VITE_DEMO ?? '').toLowerCase() === 'true',
    queryFlag: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('demo') === 'true' : false,
    lsFlag: typeof window !== 'undefined' ? localStorage.getItem('app_demo') === '1' : false,
    hasDemoStore: typeof window !== 'undefined' ? localStorage.getItem('__demo_store__') !== null : false
  };
}
