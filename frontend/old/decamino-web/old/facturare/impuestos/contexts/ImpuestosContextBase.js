import { createContext, useContext } from 'react';

export const ImpuestosContext = createContext(null);

export const useImpuestos = () => {
  const context = useContext(ImpuestosContext);
  if (!context) {
    throw new Error('useImpuestos must be used within an ImpuestosProvider');
  }
  return context;
};

