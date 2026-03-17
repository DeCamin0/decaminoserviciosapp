/**
 * Token Refresh Utility
 * Gestionează refresh automat al access token-ului când expiră.
 * Multi-client: BASE_URL din config (env), fără fallback.
 */
import { config } from '../config/env';

const BASE_URL = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

// Event emitter pentru session expired
let sessionExpiredCallback = null;

/**
 * Setează callback-ul pentru când sesiunea expiră
 */
export function setSessionExpiredCallback(callback) {
  sessionExpiredCallback = callback;
}

/**
 * Emite evenimentul de sesiune expirată
 */
function emitSessionExpired(message) {
  if (sessionExpiredCallback) {
    sessionExpiredCallback(message);
  }
}

// Salvează fetch-ul original pentru a evita loop-uri cu interceptor-ul global
const originalFetch = typeof window !== 'undefined' && window.__originalFetchForLocation 
  ? window.__originalFetchForLocation 
  : (typeof window !== 'undefined' ? window.fetch : fetch);

let isRefreshing = false;
let refreshPromise = null;

/**
 * Verifică dacă un JWT token este expirat sau aproape de expirare
 */
function isTokenExpiredOrNearExpiry(token) {
  if (!token) return true;
  
  try {
    // Decode JWT token (fără verificare semnătură, doar pentru a citi payload-ul)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = exp - now;
    
    // Considerăm token-ul „aproape expirat” dacă mai are mai puțin de 10 minute
    // (refresh mai devreme = utilizatorul activ nu e deconectat la 30 min)
    return timeUntilExpiry < 10 * 60 * 1000; // 10 minutes
  } catch (error) {
    console.error('[TokenRefresh] Error decoding token:', error);
    return true; // Considerăm expirat dacă nu putem decoda
  }
}

/**
 * Face refresh al access token-ului folosind refresh token-ul
 * @param {boolean} forceLogoutOnError - Dacă true, face logout chiar dacă token-ul curent e valid
 */
async function refreshAccessToken(forceLogoutOnError = false) {
  const refreshToken = localStorage.getItem('refresh_token');
  const currentToken = localStorage.getItem('auth_token');
  const isCurrentTokenValid = currentToken && !isTokenFullyExpired();
  
  if (!refreshToken) {
    // Dacă nu avem refresh token, dar token-ul curent e valid, nu facem logout
    if (isCurrentTokenValid && !forceLogoutOnError) {
      // Nu afișăm warning - e normal să nu avem refresh token dacă token-ul e încă valid
      throw new Error('No refresh token available');
    }
    // Dacă token-ul curent e expirat sau forțăm logout, atunci facem logout
    throw new Error('No refresh token available');
  }

  try {
    // Folosim originalFetch pentru a evita loop-uri cu interceptor-ul global
    const response = await originalFetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to refresh token');
    }

    const data = await response.json();
    
    if (data.success && data.accessToken) {
      // Salvează noul access token
      localStorage.setItem('auth_token', data.accessToken);
      return data.accessToken;
    } else {
      throw new Error('Invalid refresh response');
    }
  } catch (error) {
    console.error('[TokenRefresh] Refresh error:', error);
    
    // Verifică dacă token-ul curent e încă valid
    const stillValid = currentToken && !isTokenFullyExpired();
    
    // Dacă token-ul curent e încă valid și nu forțăm logout, nu facem logout
    if (stillValid && !forceLogoutOnError) {
      console.warn('[TokenRefresh] Refresh failed, but current token is still valid. Will retry later.');
      throw error; // Aruncă eroarea fără să facă logout
    }
    
    // Dacă token-ul curent e expirat sau forțăm logout, facem logout
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    
    // Emite evenimentul de sesiune expirată
    const errorMessage = error.message || 'No se pudo renovar la sesión';
    emitSessionExpired(errorMessage.includes('expired') || errorMessage.includes('expirado')
      ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      : 'No se pudo renovar la sesión. Por favor, inicia sesión nuevamente.');
    
    throw error;
  }
}

/**
 * Obține access token-ul, făcând refresh dacă e necesar
 * @param {boolean} forceRefresh - Dacă true, forțează refresh chiar dacă token-ul e valid
 */
export async function getValidAccessToken(forceRefresh = false) {
  let accessToken = localStorage.getItem('auth_token');
  const isFullyExpired = !accessToken || isTokenFullyExpired();
  const isNearExpiry = accessToken && isTokenExpiredOrNearExpiry(accessToken);
  const hasRefreshToken = !!localStorage.getItem('refresh_token');
  
  // Dacă token-ul e complet expirat, forțăm logout la eroare
  const forceLogoutOnError = isFullyExpired;
  
  // Dacă nu există token sau e expirat/aproape de expirare, face refresh
  // DAR doar dacă avem refresh token (altfel folosim token-ul curent până expiră complet)
  if ((!accessToken || isNearExpiry || forceRefresh) && hasRefreshToken) {
    // Dacă deja se face refresh, așteaptă să se termine
    if (isRefreshing && refreshPromise) {
      try {
        accessToken = await refreshPromise;
        return accessToken;
      } catch (error) {
      // Dacă refresh-ul eșuează, verifică dacă token-ul curent e încă valid
      const currentToken = localStorage.getItem('auth_token');
      if (currentToken && !isTokenFullyExpired() && !forceLogoutOnError) {
        // Nu afișăm warning - e normal să folosim token-ul curent dacă e încă valid
        return currentToken; // Folosește token-ul curent
      }
        // Dacă token-ul e expirat, aruncă eroarea
        throw error;
      }
    }
    
    // Începe procesul de refresh
    isRefreshing = true;
    refreshPromise = refreshAccessToken(forceLogoutOnError);
    
    try {
      accessToken = await refreshPromise;
      return accessToken;
    } catch (error) {
      // Dacă refresh-ul eșuează, verifică dacă token-ul curent e încă valid
      const currentToken = localStorage.getItem('auth_token');
      if (currentToken && !isTokenFullyExpired() && !forceLogoutOnError) {
        // Nu afișăm warning - e normal să folosim token-ul curent dacă e încă valid
        return currentToken; // Folosește token-ul curent
      }
      // Dacă token-ul e expirat, re-throw eroarea
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }
  
  return accessToken;
}

/**
 * Interceptor pentru fetch care gestionează automat refresh-ul token-ului
 * Trebuie apelat înainte de orice fetch care necesită autentificare
 */
export async function fetchWithAuth(url, options = {}) {
  // Verifică dacă există token-uri înainte de a face request-ul
  const hasToken = localStorage.getItem('auth_token');
  const hasRefreshToken = localStorage.getItem('refresh_token');
  const isTokenValid = hasToken && !isTokenFullyExpired();
  
  // Dacă nu există token valid și nu există refresh token, înseamnă că utilizatorul s-a deconectat
  // În acest caz, nu facem request-ul și facem logout imediat pentru a evita spam-ul de erori
  if (!isTokenValid && !hasRefreshToken) {
    console.warn('[TokenRefresh] No valid token and no refresh token available. User is logged out. Skipping request to:', url);
    
    // Face logout imediat pentru a evita spam-ul de request-uri
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    emitSessionExpired('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    
    // Returnăm un Response mock cu 401 pentru a evita spam-ul de erori în console
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized', message: 'User is logged out' }),
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Obține token-ul valid (face refresh dacă e necesar)
  let accessToken;
  try {
    accessToken = await getValidAccessToken();
  } catch (error) {
    // Verifică dacă token-ul curent e încă valid înainte de a emite sesiune expirată
    const currentToken = localStorage.getItem('auth_token');
    if (currentToken && !isTokenFullyExpired()) {
      // Token-ul e încă valid, folosește-l chiar dacă refresh-ul eșuează
      console.warn('[TokenRefresh] Cannot refresh token, but current token is still valid');
      accessToken = currentToken;
    } else {
      // Token-ul e expirat, emite evenimentul de sesiune expirată
      console.error('[TokenRefresh] Cannot get valid token');
      const errorMessage = error.message || 'Token no válido';
      emitSessionExpired(errorMessage.includes('expired') || errorMessage.includes('expirado')
        ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        : 'No se pudo validar la sesión. Por favor, inicia sesión nuevamente.');
      throw error;
    }
  }

  // Adaugă token-ul în header-uri
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };

  // Face request-ul folosind originalFetch pentru a evita loop-uri
  let response = await originalFetch(url, {
    ...options,
    headers,
  });

  // Dacă primim 401 (Unauthorized), încercăm refresh o dată
  if (response.status === 401) {
    try {
      // Obține un token nou (forțează refresh, cu logout forțat la eroare)
      const newToken = await refreshAccessToken(true);
      
      // Reîncearcă request-ul cu noul token folosind originalFetch
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await originalFetch(url, {
        ...options,
        headers,
      });
    } catch (refreshError) {
      // Dacă refresh-ul eșuează după 401, token-ul e sigur expirat
      // (refreshAccessToken cu forceLogoutOnError=true deja a gestionat logout-ul)
      console.error('[TokenRefresh] Refresh failed after 401');
      throw refreshError;
    }
  }

  return response;
}

/**
 * Verifică dacă token-ul curent este valid
 */
export function isTokenValid() {
  const token = localStorage.getItem('auth_token');
  return token && !isTokenExpiredOrNearExpiry(token);
}

/**
 * Verifică dacă token-ul este expirat complet (nu doar aproape de expirare)
 * Folosit pentru detectarea expirării înainte de request-uri
 */
export function isTokenFullyExpired() {
  const token = localStorage.getItem('auth_token');
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    return now >= exp; // Token-ul a expirat complet
  } catch (error) {
    console.error('[TokenRefresh] Error decoding token:', error);
    return true; // Considerăm expirat dacă nu putem decoda
  }
}

/**
 * Obține timpul rămas până la expirarea token-ului (în secunde)
 * Returnează 0 dacă token-ul e expirat sau invalid
 */
export function getTokenTimeRemaining() {
  const token = localStorage.getItem('auth_token');
  if (!token) return 0;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeRemaining = Math.max(0, Math.floor((exp - now) / 1000)); // În secunde
    return timeRemaining;
  } catch (error) {
    console.error('[TokenRefresh] Error decoding token:', error);
    return 0;
  }
}
