import { useState, useCallback } from 'react';

const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');

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
      if (comunicadoData instanceof FormData) {
        body = comunicadoData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(comunicadoData);
      }

      const response = await fetch(`${BASE_URL}/api/comunicados`, {
        method: 'POST',
        headers,
        body,
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
      if (comunicadoData instanceof FormData) {
        body = comunicadoData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(comunicadoData);
      }

      const response = await fetch(`${BASE_URL}/api/comunicados/${id}`, {
        method: 'PUT',
        headers,
        body,
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
    getUnreadCount,
    loading,
    error,
  };
};

