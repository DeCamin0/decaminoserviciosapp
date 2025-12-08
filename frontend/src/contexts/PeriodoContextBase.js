import { createContext, useContext } from 'react';

export const PeriodoContext = createContext(null);

export const usePeriodo = () => {
  const ctx = useContext(PeriodoContext);
  if (!ctx) {
    throw new Error('usePeriodo must be used within a PeriodoProvider');
  }
  return ctx;
};

