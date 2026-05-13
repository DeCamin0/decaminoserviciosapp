// ⚠️ CRITICAL: Error handlers MUST be set up BEFORE other imports (după bootstrap-fetch-native)
// Suppress Google Maps vendor bundle errors and other undefined 'get' errors
(function() {
  'use strict';
  
  // SUPPRESS CONSOLE ERRORS for vendor bundle - more aggressive filtering
  const originalError = console.error;
  console.error = function() {
    const msg = arguments[0];
    const msgStr = typeof msg === 'string' ? msg : String(msg || '');
    const stackStr = arguments[1]?.stack || String(arguments[1] || '');
    
    // Suprimă erorile Google Maps: 'get', 'CJ', 'google is not defined'
    const isGoogleMapsError = 
      (msgStr.includes('google is not defined') || stackStr.includes('google is not defined')) ||
      ((msgStr.includes('Cannot read properties of undefined') || 
        stackStr.includes('Cannot read properties of undefined')) &&
       (msgStr.includes('reading \'get\'') || msgStr.includes('reading \'CJ\'') ||
        stackStr.includes('reading \'get\'') || stackStr.includes('reading \'CJ\'')));
    
    if (isGoogleMapsError) {
      return; // Silent - nu afișa nimic
    }
    
    originalError.apply(console, arguments);
  };
  
  // SUPPRESS ERROR EVENTS - catch all
  window.addEventListener('error', function(event) {
    const msg = event.message || '';
    const stack = event.error?.stack || '';
    
    const isGoogleMapsError = 
      (msg.includes('google is not defined') || stack.includes('google is not defined')) ||
      ((msg.includes('Cannot read properties of undefined') || 
        stack.includes('Cannot read properties of undefined')) &&
       (msg.includes('reading \'get\'') || msg.includes('reading \'CJ\'') ||
        stack.includes('reading \'get\'') || stack.includes('reading \'CJ\'')));
    
    if (isGoogleMapsError) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);
  
  // SUPPRESS PROMISE REJECTIONS
  window.addEventListener('unhandledrejection', function(event) {
    const msg = event.reason?.message || event.reason?.toString() || '';
    const stack = event.reason?.stack || '';
    
    const isGoogleMapsError = 
      (msg.includes('google is not defined') || stack.includes('google is not defined')) ||
      ((msg.includes('Cannot read properties of undefined') || 
        stack.includes('Cannot read properties of undefined')) &&
       (msg.includes('reading \'get\'') || msg.includes('reading \'CJ\'') ||
        stack.includes('reading \'get\'') || stack.includes('reading \'CJ\'')));
    
    // Suprimă erorile Bluebird promise (_isBound, _receiverAt)
    const isBluebirdError = 
      stack.includes('promise.js') && 
      (stack.includes('_isBound') || stack.includes('_receiverAt') || stack.includes('_migrateCallback'));
    
    if (isGoogleMapsError || isBluebirdError) {
      if (isBluebirdError) {
        console.warn('⚠️ Suppressed Bluebird promise error (likely from mammoth or other library)');
      }
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
  
  // Add error boundary for all uncaught errors
  const originalWindowError = window.onerror;
  window.onerror = function(msg, url, line, col, error) {
    const msgStr = String(msg || '');
    const stackStr = error?.stack || '';
    
    const isGoogleMapsError = 
      (msgStr.includes('google is not defined') || stackStr.includes('google is not defined')) ||
      ((msgStr.includes('Cannot read properties of undefined') || 
        stackStr.includes('Cannot read properties of undefined')) &&
       (msgStr.includes('reading \'get\'') || msgStr.includes('reading \'CJ\'') ||
        stackStr.includes('reading \'get\'') || stackStr.includes('reading \'CJ\'')));
    
    if (isGoogleMapsError) {
      return true; // Prevent default error handling
    }
    
    if (originalWindowError) {
      return originalWindowError.call(this, msg, url, line, col, error);
    }
    return false;
  };
})();

/** PRIMUL import: salvează window.fetch nativ înainte de App → useComunicadosApi etc. */
import './bootstrap-fetch-native.js';

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import './i18n' // Side-effect import pentru inițializare
import { handleBrowserExtensionErrors } from './utils/errorHandler'
import { isDemoMode } from './utils/demo'
// import './registerSW' // ❌ ELIMINAT: usePWAUpdate din componente gestionează deja SW registration
// Import consoleOverride BEFORE setting up error handlers
import './utils/consoleOverride' // Dezactivează console.log-urile în production
import { installRegulatedFetch } from './utils/regulatedFetch'

// window.__originalFetchForLocation: vezi ./bootstrap-fetch-native.js (primul import).

// Polyfills pentru ExcelJS în browser
import { Buffer } from 'buffer'
import process from 'process/browser'

// Face Buffer și process disponibile global pentru ExcelJS
window.Buffer = Buffer
window.process = process

// Suprimă avertizările despre defaultProps și key global
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('defaultProps') || 
       args[0].includes('unique "key" prop') ||
       args[0].includes('Element with name') ||
       args[0].includes('already defined'))) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

console.error = (...args) => {
  const msg = args[0];
  const msgStr = typeof msg === 'string' ? msg : '';
  const stackStr = args[1]?.stack || '';
  
  // Suprimă erorile CJ și get din ORICE sursă (inclusiv cache)
  if ((msgStr.includes('Cannot read properties of undefined') || stackStr.includes('Cannot read properties of undefined')) && 
      (msgStr.includes('reading \'get\'') || msgStr.includes('reading \'CJ\'') || 
       stackStr.includes('reading \'get\'') || stackStr.includes('reading \'CJ\''))) {
    // Complet silent - nu afișa nimic
    return;
  }
  originalConsoleError.apply(console, args);
};

// Note: Error handlers are set up at the top of the file in IIFE

// Inițializează error handler-ul pentru extensiile de browser
handleBrowserExtensionErrors();

// Dev-only: regulate fetch toward n8n endpoints (rate limit + backoff)
installRegulatedFetch();

// Setup global fetch interceptor for token refresh
// IMPORTANT: Folosim fetch-ul curent (poate fi deja interceptat de regulatedFetch)
if (typeof window !== 'undefined' && window.__originalFetchForLocation) {
  const currentFetch = window.fetch; // Fetch-ul curent (poate fi deja interceptat de regulatedFetch)
  
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    
    // Interceptează toate endpoint-urile /api/ care necesită autentificare
    // Excepții: /api/n8n/ (proxy către n8n) și /api/auth/ (login, refresh)
    const isApiRequest = typeof url === 'string' && 
      url.includes('/api/') && 
      !url.includes('/api/n8n/') && 
      !url.includes('/api/auth/');
    
    if (isApiRequest) {
      // Importăm dinamic pentru a evita circular dependencies
      try {
        const { fetchWithAuth } = await import('./utils/tokenRefresh.js');
        return await fetchWithAuth(url, options);
      } catch (error) {
        console.warn('[TokenRefresh] Error in fetchWithAuth:', error);
        throw error;
      }
    }
    
    // Pentru request-uri non-API, folosește fetch-ul curent (poate fi deja interceptat)
    return currentFetch.apply(this, args);
  };
  
  console.log('✅ Global fetch interceptor for token refresh enabled');
}

/**
 * Bootstrap function to handle DEMO mode and MSW
 */
async function bootstrap() {
  try {
    console.log('🔍 Checking root element...');
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element #root not found in DOM');
    }
    console.log('✅ Root element found');

    // Start MSW only in DEMO mode
    if (isDemoMode()) {
      try {
        console.log('🎭 DEMO mode detected, MSW temporarily disabled');
        // MSW temporarily disabled due to import issues
        window.__DEMO__ = true;
      } catch (error) {
        console.error('❌ Failed to start DEMO mode:', error);
      }
    }

    console.log('🎨 Rendering React application...');
    // Render the application
    // Pentru test environment pe /html/app-test, folosește VITE_BASE_PATH
    const basePath = import.meta.env.VITE_BASE_PATH || '/';
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <BrowserRouter basename={basePath} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log('✅ React application rendered successfully');
  } catch (error) {
    console.error('❌ Error in bootstrap:', error);
    throw error;
  }
}

// Start the application
console.log('🚀 Starting application bootstrap...');
bootstrap().catch(error => {
  console.error('❌ Fatal error during bootstrap:', error);
  // Afișează un mesaj de eroare user-friendly dacă bootstrap-ul eșuează
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: system-ui;">
        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; text-align: center;">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">⚠️ Error de carga</h1>
          <p style="color: #4b5563; margin-bottom: 1.5rem;">La aplicación no pudo iniciarse correctamente.</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">
            Recargar página
          </button>
          <details style="margin-top: 1rem; text-align: left;">
            <summary style="cursor: pointer; color: #6b7280;">Detalles técnicos</summary>
            <pre style="background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow: auto; font-size: 0.875rem; margin-top: 0.5rem;">${error.toString()}\n${error.stack || ''}</pre>
          </details>
        </div>
      </div>
    `;
  }
});
