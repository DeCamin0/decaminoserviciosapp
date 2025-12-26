/**
 * Console Override pentru Production
 * Dezactivează console.log-urile în production pentru performanță
 */

// Salvează console-ul original
const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};

// Supression Google Maps errors în ORICE mod (dev și production)
const originalError = console.error;
console.error = (...args) => {
  const msg = args[0];
  const msgStr = typeof msg === 'string' ? msg : '';
  const stackStr = args[1]?.stack || '';
  
  // Suprimă erorile Google Maps: 'get', 'CJ', 'google is not defined'
  const isGoogleMapsError = 
    (msgStr.includes('google is not defined') || stackStr.includes('google is not defined')) ||
    ((msgStr.includes('Cannot read properties of undefined') || stackStr.includes('Cannot read properties of undefined')) && 
     (msgStr.includes('reading \'get\'') || msgStr.includes('reading \'CJ\'') || 
      stackStr.includes('reading \'get\'') || stackStr.includes('reading \'CJ\'')));
  
  if (isGoogleMapsError) {
    // COMPLET SILENT - nu afișa nimic
    return;
  }
  originalError.apply(console, args);
};

// Detectează dacă suntem în production
const isProduction = import.meta.env.PROD;

// Export pentru debugging manual dacă e nevoie
window.__originalConsole = originalConsole;

if (isProduction) {
  // Console.log-urile sunt ACTIVE pentru debugging în producție
  // Păstrăm active pentru a putea identifica probleme în timp real
  // console.log = () => {}; // Dezactivează complet dacă e nevoie
  // console.debug = () => {}; // Dezactivează complet dacă e nevoie
  
  // Păstrează warn și error pentru debugging important
  // console.warn și console.error rămân active

  // Opțional: păstrează doar error-urile critice
  // console.info = () => {}; // Dezactivează info dacă vrei
  
  console.log('✅ Console.log-urile sunt ACTIVE în production pentru debugging');
  console.log('📊 Poți dezactiva din vite.config.js și consoleOverride.js dacă e nevoie');
}
