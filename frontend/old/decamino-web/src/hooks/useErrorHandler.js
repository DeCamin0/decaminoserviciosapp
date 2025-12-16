import { useState, useCallback } from 'react';
import { error as logError, warn as logWarn } from '../utils/logger';

/**
 * Hook pentru error handling consistent
 * Gestionează erorile într-un mod uniform în toată aplicația
 */
export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gestionează erorile de API
   */
  const handleApiError = useCallback((err, context = '') => {
    const errorMessage = getErrorMessage(err);
    const fullContext = context ? `${context}: ` : '';
    
    // Loghează eroarea
    logError(`${fullContext}${errorMessage}`, err);
    
    // Adaugă eroarea la lista de erori
    setErrors(prev => [...prev, {
      id: Date.now(),
      message: errorMessage,
      context,
      timestamp: new Date(),
      type: 'api'
    }]);

    return errorMessage;
  }, []);

  /**
   * Gestionează erorile de validare
   */
  const handleValidationError = useCallback((field, message) => {
    const errorMessage = `${field}: ${message}`;
    
    logWarn(`Validation error: ${errorMessage}`);
    
    setErrors(prev => [...prev, {
      id: Date.now(),
      message: errorMessage,
      field,
      timestamp: new Date(),
      type: 'validation'
    }]);

    return errorMessage;
  }, []);

  /**
   * Gestionează erorile de network
   */
  const handleNetworkError = useCallback((err, context = '') => {
    let errorMessage = 'Error de conexión';
    
    if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
      errorMessage = 'No se pudo conectar al servidor. Verifica la conexión a internet.';
    } else if (err?.message?.includes('timeout')) {
      errorMessage = 'La solicitud ha expirado. Intenta de nuevo.';
    } else if (err?.message?.includes('CORS')) {
      errorMessage = 'Error de seguridad. Contacta al administrador.';
    }

    const fullContext = context ? `${context}: ` : '';
    logError(`${fullContext}${errorMessage}`, err);
    
    setErrors(prev => [...prev, {
      id: Date.now(),
      message: errorMessage,
      context,
      timestamp: new Date(),
      type: 'network'
    }]);

    return errorMessage;
  }, []);

  /**
   * Gestionează erorile generice
   */
  const handleError = useCallback((err, context = '') => {
    const errorMessage = getErrorMessage(err);
    const fullContext = context ? `${context}: ` : '';
    
    logError(`${fullContext}${errorMessage}`, err);
    
    setErrors(prev => [...prev, {
      id: Date.now(),
      message: errorMessage,
      context,
      timestamp: new Date(),
      type: 'general'
    }]);

    return errorMessage;
  }, []);

  /**
   * Șterge o eroare specifică
   */
  const clearError = useCallback((errorId) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  /**
   * Șterge toate erorile
   */
  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  /**
   * Șterge erorile mai vechi de X minute
   */
  const clearOldErrors = useCallback((minutes = 5) => {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    setErrors(prev => prev.filter(err => err.timestamp > cutoff));
  }, []);

  /**
   * Wrapper pentru async operations cu error handling
   */
  const safeAsync = useCallback(async (asyncFn, context = '') => {
    setIsLoading(true);
    try {
      const result = await asyncFn();
      return result;
    } catch (err) {
      handleError(err, context);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  return {
    errors,
    isLoading,
    handleApiError,
    handleValidationError,
    handleNetworkError,
    handleError,
    clearError,
    clearAllErrors,
    clearOldErrors,
    safeAsync
  };
};

/**
 * Extrage mesajul de eroare din diferite tipuri de erori
 */
const getErrorMessage = (err) => {
  if (typeof err === 'string') {
    return err;
  }
  
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  
  if (err?.message) {
    return err.message;
  }
  
  if (err?.statusText) {
    return err.statusText;
  }
  
  if (err?.status) {
    return `Error ${err.status}`;
  }
  
  return 'Ha ocurrido un error inesperado';
};

export default useErrorHandler;
