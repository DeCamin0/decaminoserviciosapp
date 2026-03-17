import { useState, useCallback } from 'react';
import { config } from '../config/env';

const BASE_URL = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

// Interceptor pentru a loga toate request-urile (inclusiv OPTIONS preflight)
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    const method = options.method || 'GET';
    
    // Log doar pentru comunicados endpoint-uri
    if (typeof url === 'string' && url.includes('/api/comunicados')) {
      const logData = {
        method,
        headers: options.headers ? (options.headers instanceof Headers ? Object.fromEntries(options.headers.entries()) : options.headers) : {},
        hasBody: !!options.body,
        bodyType: options.body ? (options.body instanceof FormData ? 'FormData' : typeof options.body) : null,
        credentials: options.credentials,
        mode: options.mode,
        origin: window.location.origin,
      };
      
      // Pentru FormData, încercăm să obținem info despre fișier
      if (options.body instanceof FormData) {
        try {
          const file = options.body.get('archivo');
          if (file instanceof File) {
            logData.fileInfo = { 
              name: file.name, 
              size: file.size, 
              sizeMB: (file.size / (1024 * 1024)).toFixed(2), 
              type: file.type 
            };
          }
        } catch {
          // FormData poate fi consumat doar o dată
        }
      }
      
      console.log(`[Fetch Interceptor] ${method} ${url}`, logData);
      
      // Pentru OPTIONS, logăm explicit
      if (method === 'OPTIONS') {
        console.log(`[Fetch Interceptor] 🔍 OPTIONS preflight detected for ${url}`);
      }
    }
    
    try {
      const response = await originalFetch.apply(this, args);
      
      if (typeof url === 'string' && url.includes('/api/comunicados')) {
        const corsHeaders = {};
        try {
          corsHeaders['access-control-allow-origin'] = response.headers.get('access-control-allow-origin');
          corsHeaders['access-control-allow-credentials'] = response.headers.get('access-control-allow-credentials');
          corsHeaders['access-control-allow-methods'] = response.headers.get('access-control-allow-methods');
          corsHeaders['access-control-allow-headers'] = response.headers.get('access-control-allow-headers');
        } catch {
          // Headers pot fi read-only în unele cazuri
        }
        
        console.log(`[Fetch Interceptor] Response for ${method} ${url}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: corsHeaders,
        });
      }
      
      return response;
    } catch (error) {
      if (typeof url === 'string' && url.includes('/api/comunicados')) {
        console.error(`[Fetch Interceptor] Error for ${method} ${url}:`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
          // Verifică dacă este o eroare de rețea sau CORS
          isNetworkError: error.message === 'Failed to fetch',
          isCORSError: error.message.includes('CORS') || error.message.includes('cors'),
        });
      }
      throw error;
    }
  };
}

export const useComunicadosApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchComunicados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.comunicados || [];
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComunicado = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados/${id}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.comunicado;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createComunicado = useCallback(async (comunicadoData) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      // Dacă este FormData, nu adăugăm Content-Type (browser-ul o setează automat cu boundary)
      // Dacă este obiect normal, folosim JSON
      let body;
      let fileInfo = null;
      if (comunicadoData instanceof FormData) {
        body = comunicadoData;
        // Log info despre fișier dacă există
        const archivo = comunicadoData.get('archivo');
        if (archivo instanceof File) {
          fileInfo = {
            name: archivo.name,
            size: archivo.size,
            sizeMB: (archivo.size / (1024 * 1024)).toFixed(2),
            type: archivo.type,
          };
          console.log('[Comunicados] 📤 Upload file info:', fileInfo);
        }
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(comunicadoData);
      }

      const url = `${BASE_URL}/api/comunicados`;
      console.log('[Comunicados] 📤 Starting upload request:', {
        url,
        method: 'POST',
        hasFile: !!fileInfo,
        fileInfo,
        origin: window.location.origin,
        headers: Object.keys(headers),
      });

      // Log preflight OPTIONS request (dacă este trimis automat de browser)
      console.log('[Comunicados] 🔍 Browser will send preflight OPTIONS request before POST');

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          credentials: 'include', // Include cookies and credentials for CORS
          mode: 'cors', // Explicitly enable CORS
        });
      } catch (fetchError) {
        console.error('[Comunicados] ❌ Fetch error caught:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack,
          // Verifică dacă este o eroare de rețea sau CORS
          isNetworkError: fetchError.message === 'Failed to fetch',
        });
        throw fetchError;
      }

      console.log('[Comunicados] 📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Error ${response.status}: ${response.statusText}` };
        }
        console.error('[Comunicados] ❌ Upload error:', errorData);
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log('[Comunicados] ✅ Upload success:', data);
      return data.comunicado;
    } catch (err) {
      console.error('[Comunicados] ❌ Upload exception:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateComunicado = useCallback(async (id, comunicadoData) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      // Dacă este FormData, nu adăugăm Content-Type (browser-ul o setează automat cu boundary)
      // Dacă este obiect normal, folosim JSON
      let body;
      let fileInfo = null;
      if (comunicadoData instanceof FormData) {
        body = comunicadoData;
        // Log info despre fișier dacă există
        const archivo = comunicadoData.get('archivo');
        if (archivo instanceof File) {
          fileInfo = {
            name: archivo.name,
            size: archivo.size,
            sizeMB: (archivo.size / (1024 * 1024)).toFixed(2),
            type: archivo.type,
          };
          console.log('[Comunicados] 📤 Update file info:', fileInfo);
        }
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(comunicadoData);
      }

      const url = `${BASE_URL}/api/comunicados/${id}`;
      console.log('[Comunicados] 📤 Starting update request:', {
        url,
        method: 'PUT',
        id,
        hasFile: !!fileInfo,
        fileInfo,
        origin: window.location.origin,
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body,
        credentials: 'include', // Include cookies and credentials for CORS
        mode: 'cors', // Explicitly enable CORS
      });

      console.log('[Comunicados] 📥 Update response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Error ${response.status}: ${response.statusText}` };
        }
        console.error('[Comunicados] ❌ Update error:', errorData);
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log('[Comunicados] ✅ Update success:', data);
      return data.comunicado;
    } catch (err) {
      console.error('[Comunicados] ❌ Update exception:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteComunicado = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados/${id}/marcar-leido`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const publicarComunicado = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados/${id}/publicar`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      return data.comunicado;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const notifyComunicado = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/api/comunicados/${id}/notificar`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUnreadCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/comunicados/unread-count`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      return data.count || 0;
    } catch (err) {
      setError(err.message);
      return 0; // Returnează 0 în caz de eroare
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    fetchComunicados,
    fetchComunicado,
    createComunicado,
    updateComunicado,
    deleteComunicado,
    markAsRead,
    publicarComunicado,
    notifyComunicado,
    getUnreadCount,
    loading,
    error,
  };
};

