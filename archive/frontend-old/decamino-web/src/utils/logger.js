/**
 * Logger utility pentru aplicația DeCamino
 * Dezactivează console.log-urile în production pentru performanță
 */

// Detectează dacă suntem în development sau production
const isDevelopment = import.meta.env.DEV;

/**
 * Logger principal - afișează doar în development
 * @param {string} message - Mesajul de log
 * @param {...any} args - Argumente suplimentare
 */
export const log = (message, ...args) => {
  if (isDevelopment) {
    console.log(message, ...args);
  }
};

/**
 * Logger pentru debug - afișează doar în development
 * @param {string} message - Mesajul de debug
 * @param {...any} args - Argumente suplimentare
 */
export const debug = (message, ...args) => {
  if (isDevelopment) {
    console.log(`🔍 DEBUG: ${message}`, ...args);
  }
};

/**
 * Logger pentru info - afișează doar în development
 * @param {string} message - Mesajul de info
 * @param {...any} args - Argumente suplimentare
 */
export const info = (message, ...args) => {
  if (isDevelopment) {
    console.log(`ℹ️ INFO: ${message}`, ...args);
  }
};

/**
 * Logger pentru warning - afișează întotdeauna
 * @param {string} message - Mesajul de warning
 * @param {...any} args - Argumente suplimentare
 */
export const warn = (message, ...args) => {
  console.warn(`⚠️ WARNING: ${message}`, ...args);
};

/**
 * Logger pentru error - afișează întotdeauna
 * @param {string} message - Mesajul de error
 * @param {...any} args - Argumente suplimentare
 */
export const error = (message, ...args) => {
  console.error(`❌ ERROR: ${message}`, ...args);
};

/**
 * Logger pentru success - afișează doar în development
 * @param {string} message - Mesajul de success
 * @param {...any} args - Argumente suplimentare
 */
export const success = (message, ...args) => {
  if (isDevelopment) {
    console.log(`✅ SUCCESS: ${message}`, ...args);
  }
};

/**
 * Logger pentru auth - afișează doar în development
 * @param {string} message - Mesajul de auth
 * @param {...any} args - Argumente suplimentare
 */
export const auth = (message, ...args) => {
  if (isDevelopment) {
    console.log(`🔐 AUTH: ${message}`, ...args);
  }
};

/**
 * Logger pentru API calls - afișează doar în development
 * @param {string} message - Mesajul de API
 * @param {...any} args - Argumente suplimentare
 */
export const api = (message, ...args) => {
  if (isDevelopment) {
    console.log(`🌐 API: ${message}`, ...args);
  }
};

/**
 * Logger pentru performance - afișează doar în development
 * @param {string} message - Mesajul de performance
 * @param {...any} args - Argumente suplimentare
 */
export const perf = (message, ...args) => {
  if (isDevelopment) {
    console.log(`⚡ PERF: ${message}`, ...args);
  }
};

/**
 * Logger pentru demo mode - afișează doar în development
 * @param {string} message - Mesajul de demo
 * @param {...any} args - Argumente suplimentare
 */
export const demo = (message, ...args) => {
  if (isDevelopment) {
    console.log(`🎭 DEMO: ${message}`, ...args);
  }
};

// Export default pentru compatibilitate
export default {
  log,
  debug,
  info,
  warn,
  error,
  success,
  auth,
  api,
  perf,
  demo
};
