import { useState, useCallback } from 'react';

/**
 * Hook centralizat pentru loading states
 * Oferă funcționalități consistente pentru toate componentele
 */
export const useLoadingState = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  const [loadingStates, setLoadingStates] = useState({});

  /**
   * Setează loading-ul principal
   */
  const setMainLoading = useCallback((isLoading) => {
    setLoading(isLoading);
  }, []);

  /**
   * Setează loading pentru o operație specifică
   */
  const setOperationLoading = useCallback((operation, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [operation]: isLoading
    }));
  }, []);

  /**
   * Verifică dacă o operație specifică este în loading
   */
  const isOperationLoading = useCallback((operation) => {
    return loadingStates[operation] || false;
  }, [loadingStates]);

  /**
   * Verifică dacă orice operație este în loading
   */
  const isAnyLoading = useCallback(() => {
    return loading || Object.values(loadingStates).some(state => state);
  }, [loading, loadingStates]);

  /**
   * Oprește toate loading states
   */
  const clearAllLoading = useCallback(() => {
    setLoading(false);
    setLoadingStates({});
  }, []);

  /**
   * Wrapper pentru async operations cu loading automat
   */
  const withLoading = useCallback(async (asyncFn, operation = 'default') => {
    setOperationLoading(operation, true);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      setOperationLoading(operation, false);
    }
  }, [setOperationLoading]);

  return {
    loading,
    loadingStates,
    setMainLoading,
    setOperationLoading,
    isOperationLoading,
    isAnyLoading,
    clearAllLoading,
    withLoading
  };
};

export default useLoadingState;
