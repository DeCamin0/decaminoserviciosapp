import { useState, useCallback } from 'react';
import { useErrorHandler } from './useErrorHandler';
import { api } from '../utils/logger';

/**
 * Hook pentru API calls cu error handling automat
 */
export const useApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const { handleApiError } = useErrorHandler();

  /**
   * Execută un API call cu error handling automat
   */
  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      onSuccess,
      onError,
      context = '',
      showLoading = true,
      retries = 0,
      retryDelay = 1000
    } = options;

    if (showLoading) {
      setLoading(true);
    }

    try {
      api(`API Call: ${context}`);
      const result = await apiCall();
      
      setData(result);
      onSuccess?.(result);
      
      api(`API Success: ${context}`, result);
      return result;
    } catch (error) {
      api(`API Error: ${context}`, error);
      
      // Gestionează eroarea
      const errorMessage = handleApiError(error, context);
      
      // Încearcă retry dacă e configurat
      if (retries > 0 && shouldRetry(error)) {
        api(`Retrying API call: ${context} (${retries} retries left)`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        return execute(apiCall, {
          ...options,
          retries: retries - 1,
          retryDelay: retryDelay * 2 // Exponential backoff
        });
      }
      
      onError?.(error, errorMessage);
      throw error;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [handleApiError]);

  /**
   * Execută un GET request
   */
  const get = useCallback(async (url, options = {}) => {
    return execute(async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, { ...options, context: `GET ${url}` });
  }, [execute]);

  /**
   * Execută un POST request
   */
  const post = useCallback(async (url, body, options = {}) => {
    return execute(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(body),
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, { ...options, context: `POST ${url}` });
  }, [execute]);

  /**
   * Execută un PUT request
   */
  const put = useCallback(async (url, body, options = {}) => {
    return execute(async () => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(body),
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, { ...options, context: `PUT ${url}` });
  }, [execute]);

  /**
   * Execută un DELETE request
   */
  const del = useCallback(async (url, options = {}) => {
    return execute(async () => {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }, { ...options, context: `DELETE ${url}` });
  }, [execute]);

  /**
   * Resetează state-ul
   */
  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
  }, []);

  return {
    loading,
    data,
    execute,
    get,
    post,
    put,
    delete: del,
    reset
  };
};

/**
 * Determină dacă o eroare merită retry
 */
const shouldRetry = (error) => {
  // Retry pentru erori de network
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  // Retry pentru erori de timeout
  if (error.message.includes('timeout')) {
    return true;
  }
  
  // Retry pentru erori 5xx (server errors)
  if (error.message.includes('HTTP 5')) {
    return true;
  }
  
  // Nu retry pentru erori 4xx (client errors)
  if (error.message.includes('HTTP 4')) {
    return false;
  }
  
  return false;
};

export default useApiCall;
