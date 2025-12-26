import { useReducer, useEffect, useCallback } from 'react';
import { ImpuestosContext } from './ImpuestosContextBase';

// Initial state
const initialState = {
  impuestos: [],
  loading: false,
  error: null,
  filters: {
    year: new Date().getFullYear(),
    type: '',
    status: ''
  },
  stats: {
    totalIVA: 0,
    totalIRPF: 0,
    totalRetenciones: 0,
    totalOperaciones: 0,
    pendingDeclarations: 0,
    completedDeclarations: 0
  }
};

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_IMPUESTOS: 'SET_IMPUESTOS',
  ADD_IMPUESTO: 'ADD_IMPUESTO',
  UPDATE_IMPUESTO: 'UPDATE_IMPUESTO',
  DELETE_IMPUESTO: 'DELETE_IMPUESTO',
  SET_FILTERS: 'SET_FILTERS',
  RESET_FILTERS: 'RESET_FILTERS',
  UPDATE_STATS: 'UPDATE_STATS'
};

// Reducer
function impuestosReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ACTIONS.SET_IMPUESTOS:
      return { ...state, impuestos: action.payload };
    
    case ACTIONS.ADD_IMPUESTO:
      return { 
        ...state, 
        impuestos: [...state.impuestos, action.payload] 
      };
    
    case ACTIONS.UPDATE_IMPUESTO:
      return {
        ...state,
        impuestos: state.impuestos.map(impuesto =>
          impuesto.id === action.payload.id ? action.payload : impuesto
        )
      };
    
    case ACTIONS.DELETE_IMPUESTO:
      return {
        ...state,
        impuestos: state.impuestos.filter(impuesto => 
          impuesto.id !== action.payload
        )
      };
    
    case ACTIONS.SET_FILTERS:
      return { 
        ...state, 
        filters: { ...state.filters, ...action.payload } 
      };
    
    case ACTIONS.RESET_FILTERS:
      return { ...state, filters: initialState.filters };
    
    case ACTIONS.UPDATE_STATS:
      return { ...state, stats: action.payload };
    
    default:
      return state;
  }
}

// Provider component
export function ImpuestosProvider({ children }) {
  const [state, dispatch] = useReducer(impuestosReducer, initialState);

  const updateStats = useCallback((impuestos = state.impuestos) => {
    const stats = {
      totalIVA: impuestos.filter(i => i.type === 'IVA').length,
      totalIRPF: impuestos.filter(i => i.type === 'IRPF').length,
      totalRetenciones: impuestos.filter(i => i.type === 'Retenciones').length,
      totalOperaciones: impuestos.filter(i => i.type === 'Operaciones').length,
      pendingDeclarations: impuestos.filter(i => i.status === 'pendiente').length,
      completedDeclarations: impuestos.filter(i => i.status === 'presentado').length
    };

    dispatch({ type: ACTIONS.UPDATE_STATS, payload: stats });
  }, [dispatch, state.impuestos]);

  const loadInitialData = useCallback(async () => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      // Sample data - replace with real API call
      const sampleImpuestos = [
        {
          id: 1,
          type: 'IVA',
          model: '303',
          period: 'Q1 2024',
          year: 2024,
          status: 'presentado',
          fechaPresentacion: '2024-04-20',
          fechaVencimiento: '2024-04-20',
          baseImponible: 15000.00,
          ivaRepercutido: 3150.00,
          ivaSoportado: 2100.00,
          resultado: 1050.00,
          notes: 'Declaración trimestral Q1'
        },
        {
          id: 2,
          type: 'IRPF',
          model: '130',
          period: 'Q1 2024',
          year: 2024,
          status: 'pendiente',
          fechaPresentacion: null,
          fechaVencimiento: '2024-04-20',
          baseImponible: 12000.00,
          retencion: 1800.00,
          resultado: 1800.00,
          notes: 'Pago fraccionado Q1'
        }
      ];

      dispatch({ type: ACTIONS.SET_IMPUESTOS, payload: sampleImpuestos });
      updateStats(sampleImpuestos);
      
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  }, [dispatch, updateStats]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // CRUD actions
  const addImpuesto = async (impuestoData) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const newImpuesto = {
        ...impuestoData,
        id: Date.now(),
        createdAt: new Date().toISOString()
      };
      
      dispatch({ type: ACTIONS.ADD_IMPUESTO, payload: newImpuesto });
      updateStats([...state.impuestos, newImpuesto]);
      return newImpuesto;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const updateImpuesto = async (impuestoId, updates) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const updatedImpuesto = {
        ...state.impuestos.find(i => i.id === impuestoId),
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      dispatch({ type: ACTIONS.UPDATE_IMPUESTO, payload: updatedImpuesto });
      updateStats(state.impuestos.map(i => i.id === impuestoId ? updatedImpuesto : i));
      return updatedImpuesto;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const deleteImpuesto = async (impuestoId) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.DELETE_IMPUESTO, payload: impuestoId });
      updateStats(state.impuestos.filter(i => i.id !== impuestoId));
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Filter actions
  const setFilters = (filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  };

  const resetFilters = () => {
    dispatch({ type: ACTIONS.RESET_FILTERS });
  };

  // Update statistics
  const updateStats = (impuestos = state.impuestos) => {
    const stats = {
      totalIVA: impuestos.filter(i => i.type === 'IVA').length,
      totalIRPF: impuestos.filter(i => i.type === 'IRPF').length,
      totalRetenciones: impuestos.filter(i => i.type === 'Retenciones').length,
      totalOperaciones: impuestos.filter(i => i.type === 'Operaciones').length,
      pendingDeclarations: impuestos.filter(i => i.status === 'pendiente').length,
      completedDeclarations: impuestos.filter(i => i.status === 'presentado').length
    };
    
    dispatch({ type: ACTIONS.UPDATE_STATS, payload: stats });
  };

  // Computed values
  const filteredImpuestos = state.impuestos.filter(impuesto => {
    const matchesYear = !state.filters.year || impuesto.year === state.filters.year;
    const matchesType = !state.filters.type || impuesto.type === state.filters.type;
    const matchesStatus = !state.filters.status || impuesto.status === state.filters.status;
    
    return matchesYear && matchesType && matchesStatus;
  });

  const getImpuestosByType = (type) => {
    return state.impuestos.filter(impuesto => impuesto.type === type);
  };

  const getImpuestosByYear = (year) => {
    return state.impuestos.filter(impuesto => impuesto.year === year);
  };

  const getPendingDeclarations = () => {
    return state.impuestos.filter(impuesto => impuesto.status === 'pendiente');
  };

  const value = {
    ...state,
    filteredImpuestos,
    addImpuesto,
    updateImpuesto,
    deleteImpuesto,
    setFilters,
    resetFilters,
    getImpuestosByType,
    getImpuestosByYear,
    getPendingDeclarations
  };

  return (
    <ImpuestosContext.Provider value={value}>
      {children}
    </ImpuestosContext.Provider>
  );
}

// Custom hook
export function useImpuestos() {
  const context = useContext(ImpuestosContext);
  if (!context) {
    throw new Error('useImpuestos must be used within an ImpuestosProvider');
  }
  return context;
}
