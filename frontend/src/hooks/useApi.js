import { useState, useCallback } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callApi = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      console.log('useApi calling:', url);
      
      // Construiește headers-urile de bază
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0',
        ...options.headers,
      };

      // Adaugă JWT token pentru endpoint-uri backend (/api/*)
      // Sau URL-uri care conțin 'localhost:3000/api' sau 'api.decaminoservicios.com/api'
      const isBackendEndpoint = 
        url.includes('/api/') || 
        url.includes('localhost:3000/api') || 
        url.includes('api.decaminoservicios.com/api');
      
      if (isBackendEndpoint) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        headers,
        ...options,
      });

      console.log('useApi response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Verifică tipul de conținut al răspunsului
      const contentType = response.headers.get('content-type');
      console.log('useApi content-type:', contentType);
      
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('text/html')) {
        // Pentru răspunsuri HTML, încercăm să extragem JSON-ul
        const htmlText = await response.text();
        console.log('useApi HTML response length:', htmlText.length);
        
        try {
          const jsonMatch = htmlText.match(/\{.*\}/s);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Nu s-a găsit JSON în răspunsul HTML');
          }
        } catch (error) {
          console.error('useApi HTML parsing error:', error);
          throw new Error('Răspuns HTML nevalid de la server');
        }
      } else {
        // Încercăm să parsez ca JSON oricum
        try {
          data = await response.json();
        } catch (error) {
          console.error('useApi JSON parsing error:', error);
          throw new Error('Răspuns nevalid de la server');
        }
      }
      
      console.log('useApi response data:', data);
      return { success: true, data };
    } catch (err) {
      console.error('useApi error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    callApi,
    clearError: () => setError(null),
  };
}; 