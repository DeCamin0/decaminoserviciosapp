import { createContext, useContext, useReducer, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';

// Initial state
const initialState = {
  facturasRecibidas: [],
  loading: false,
  error: null,
  filters: {
    search: '',
    proveedor: '',
    fechaDesde: '',
    fechaHasta: '',
    estado: ''
  },
  sortBy: 'fecha',
  sortOrder: 'desc'
};

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_FACTURAS_RECIBIDAS: 'SET_FACTURAS_RECIBIDAS',
  ADD_FACTURA_RECIBIDA: 'ADD_FACTURA_RECIBIDA',
  UPDATE_FACTURA_RECIBIDA: 'UPDATE_FACTURA_RECIBIDA',
  DELETE_FACTURA_RECIBIDA: 'DELETE_FACTURA_RECIBIDA',
  SET_FILTERS: 'SET_FILTERS',
  RESET_FILTERS: 'RESET_FILTERS',
  SET_SORT: 'SET_SORT'
};

// Reducer
function facturasRecibidasReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ACTIONS.SET_FACTURAS_RECIBIDAS:
      return { ...state, facturasRecibidas: action.payload };
    
    case ACTIONS.ADD_FACTURA_RECIBIDA:
      return { 
        ...state, 
        facturasRecibidas: [...state.facturasRecibidas, action.payload] 
      };
    
    case ACTIONS.UPDATE_FACTURA_RECIBIDA:
      return {
        ...state,
        facturasRecibidas: state.facturasRecibidas.map(factura =>
          factura.id === action.payload.id ? action.payload : factura
        )
      };
    
    case ACTIONS.DELETE_FACTURA_RECIBIDA:
      return {
        ...state,
        facturasRecibidas: state.facturasRecibidas.filter(factura => 
          factura.id !== action.payload
        )
      };
    
    case ACTIONS.SET_FILTERS:
      return { 
        ...state, 
        filters: { ...state.filters, ...action.payload } 
      };
    
    case ACTIONS.RESET_FILTERS:
      return { ...state, filters: initialState.filters };
    
    case ACTIONS.SET_SORT:
      return { 
        ...state, 
        sortBy: action.payload.field,
        sortOrder: action.payload.order
      };
    
    default:
      return state;
  }
}

// Create context
const FacturasRecibidasContext = createContext();

// Provider component
export function FacturasRecibidasProvider({ children }) {
  const [state, dispatch] = useReducer(facturasRecibidasReducer, initialState);
  const { user: authUser } = useAuth();

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Funcție pentru a converti datele din format spaniol în format ISO
  // NU mai parsez datele - le afișez exact cum vin din backend

  // Process webhook data into facturas recibidas format
  const processFacturasRecibidasFromWebhook = (webhookData) => {
    try {
      
      // Handle both array and single object responses
      let dataArray = webhookData;
      if (!Array.isArray(webhookData)) {
        dataArray = [webhookData];
      }
      
      if (dataArray.length === 0) {
        return [];
      }
      
      // Returnează datele exact cum vin din backend, fără procesare
      return dataArray;
      
    } catch (error) {
      console.error('❌ Error processing webhook data:', error);
      return [];
    }
  };

  // Demo data for FacturasRecibidasContext
  const setDemoFacturasRecibidas = () => {
    const demoFacturasRecibidas = [
      {
        id: 'DEMO_FR_001',
        numero: 'FR-2024-001',
        proveedor: 'Limpiezas Profesionales SL',
        fecha: '2024-11-10T08:30:00Z',
        fecha_vencimiento: '2024-12-10T23:59:59Z',
        total: 1200.00,
        subtotal: 991.74,
        iva: 208.26,
        estado: 'pagado',
        concepto: 'Productos de limpieza y equipos',
        observaciones: 'Materiales para limpieza profesional',
        created_at: '2024-11-10T08:30:00Z',
        updated_at: '2024-11-10T08:30:00Z'
      },
      {
        id: 'DEMO_FR_002',
        numero: 'FR-2024-002',
        proveedor: 'Seguridad Total Madrid',
        fecha: '2024-11-15T10:15:00Z',
        fecha_vencimiento: '2024-12-15T23:59:59Z',
        total: 4500.00,
        subtotal: 3719.01,
        iva: 780.99,
        estado: 'pendiente',
        concepto: 'Servicios de vigilancia y alarmas',
        observaciones: 'Contrato mensual de seguridad',
        created_at: '2024-11-15T10:15:00Z',
        updated_at: '2024-11-15T10:15:00Z'
      },
      {
        id: 'DEMO_FR_003',
        numero: 'FR-2024-003',
        proveedor: 'Suministros Industriales Madrid',
        fecha: '2024-11-20T14:45:00Z',
        fecha_vencimiento: '2024-12-20T23:59:59Z',
        total: 850.00,
        subtotal: 702.48,
        iva: 147.52,
        estado: 'borrador',
        concepto: 'Materiales de oficina y consumibles',
        observaciones: 'Pedido trimestral de material',
        created_at: '2024-11-20T14:45:00Z',
        updated_at: '2024-11-20T14:45:00Z'
      },
      {
        id: 'DEMO_FR_004',
        numero: 'FR-2024-004',
        proveedor: 'Mantenimiento Integral SL',
        fecha: '2024-11-25T09:20:00Z',
        fecha_vencimiento: '2024-12-25T23:59:59Z',
        total: 2200.00,
        subtotal: 1818.18,
        iva: 381.82,
        estado: 'enviado',
        concepto: 'Mantenimiento de equipos y maquinaria',
        observaciones: 'Revisión y mantenimiento preventivo',
        created_at: '2024-11-25T09:20:00Z',
        updated_at: '2024-11-25T09:20:00Z'
      },
      {
        id: 'DEMO_FR_005',
        numero: 'FR-2024-005',
        proveedor: 'Servicios Informáticos Madrid',
        fecha: '2024-11-30T16:10:00Z',
        fecha_vencimiento: '2024-12-30T23:59:59Z',
        total: 1800.00,
        subtotal: 1487.60,
        iva: 312.40,
        estado: 'pendiente',
        concepto: 'Licencias de software y soporte técnico',
        observaciones: 'Renovación anual de licencias',
        created_at: '2024-11-30T16:10:00Z',
        updated_at: '2024-11-30T16:10:00Z'
      }
    ];
    dispatch({ type: ACTIONS.SET_FACTURAS_RECIBIDAS, payload: demoFacturasRecibidas });
    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
  };

  const loadInitialData = async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo facturas recibidas data instead of fetching from backend');
      setDemoFacturasRecibidas();
      return;
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      // Fetch data from n8n webhook through Vite proxy
      const endpoint = import.meta.env.DEV 
        ? '/webhook/963f5b0f-21ae-4258-bdbf-09cc38ad9e2e'
        : 'https://n8n.decaminoservicios.com/webhook/963f5b0f-21ae-4258-bdbf-09cc38ad9e2e';
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const webhookData = await response.json();
      // Process webhook data
      const processedFacturasRecibidas = processFacturasRecibidasFromWebhook(webhookData);
      
      dispatch({ type: ACTIONS.SET_FACTURAS_RECIBIDAS, payload: processedFacturasRecibidas });
      
    } catch (error) {
      console.error('❌ Error loading facturas recibidas from webhook:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      
      // No fallback data - just set empty array if webhook fails
      dispatch({ type: ACTIONS.SET_FACTURAS_RECIBIDAS, payload: [] });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // CRUD actions
  const addFacturaRecibida = async (facturaData) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const newFactura = {
        ...facturaData,
        id: Date.now(),
        createdAt: new Date().toISOString()
      };
      
      dispatch({ type: ACTIONS.ADD_FACTURA_RECIBIDA, payload: newFactura });
      return newFactura;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const updateFacturaRecibida = async (facturaId, updates) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const updatedFactura = {
        ...state.facturasRecibidas.find(f => f.id === facturaId),
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      dispatch({ type: ACTIONS.UPDATE_FACTURA_RECIBIDA, payload: updatedFactura });
      return updatedFactura;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const deleteFacturaRecibida = async (facturaId) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.DELETE_FACTURA_RECIBIDA, payload: facturaId });
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

  const setSort = (field, order) => {
    dispatch({ type: ACTIONS.SET_SORT, payload: { field, order } });
  };

  // Refresh data from webhook
  const refreshFromWebhook = async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping refreshFromWebhook in FacturasRecibidasContext');
      return;
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.SET_ERROR, payload: null });
      
      const endpoint = import.meta.env.DEV 
        ? '/webhook/963f5b0f-21ae-4258-bdbf-09cc38ad9e2e'
        : 'https://n8n.decaminoservicios.com/webhook/963f5b0f-21ae-4258-bdbf-09cc38ad9e2e';
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const webhookData = await response.json();
      
      const processedFacturasRecibidas = processFacturasRecibidasFromWebhook(webhookData);
      dispatch({ type: ACTIONS.SET_FACTURAS_RECIBIDAS, payload: processedFacturasRecibidas });
      
    } catch (error) {
      console.error('❌ Error refreshing from webhook:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Error refreshing: ${error.message}` });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Computed values
  const filteredFacturasRecibidas = state.facturasRecibidas.filter(factura => {
    const matchesSearch = !state.filters.search || 
      (factura.numar_operatiune && factura.numar_operatiune.toLowerCase().includes(state.filters.search.toLowerCase())) ||
      (factura.magazin && factura.magazin.toLowerCase().includes(state.filters.search.toLowerCase())) ||
      (factura.Descripcion && factura.Descripcion.toLowerCase().includes(state.filters.search.toLowerCase()));
    
    const matchesProveedor = !state.filters.proveedor || 
      (factura.magazin && factura.magazin === state.filters.proveedor);
    
    const matchesEstado = !state.filters.estado || 
      (factura.Estado && factura.Estado === state.filters.estado);
    
    const matchesFechaDesde = !state.filters.fechaDesde || 
      (factura.data && new Date(factura.data.split('/').reverse().join('-')) >= new Date(state.filters.fechaDesde));
    
    const matchesFechaHasta = !state.filters.fechaHasta || 
      (factura.data && new Date(factura.data.split('/').reverse().join('-')) <= new Date(state.filters.fechaHasta));
    
    return matchesSearch && matchesProveedor && matchesEstado && 
           matchesFechaDesde && matchesFechaHasta;
  });

  // Sortare - folosește proprietățile corecte din backend
  const sortedFacturasRecibidas = [...filteredFacturasRecibidas].sort((a, b) => {
    let aValue, bValue;
    
    switch (state.sortBy) {
      case 'numar_operatiune':
        aValue = a.numar_operatiune || '';
        bValue = b.numar_operatiune || '';
        break;
      case 'magazin':
        aValue = a.magazin || '';
        bValue = b.magazin || '';
        break;
      case 'baza_impozabila':
        aValue = parseFloat(a.baza_impozabila) || 0;
        bValue = parseFloat(b.baza_impozabila) || 0;
        break;
      case 'total_platit':
        aValue = parseFloat(a.total_platit) || 0;
        bValue = parseFloat(b.total_platit) || 0;
        break;
      case 'Estado':
        aValue = a.Estado || '';
        bValue = b.Estado || '';
        break;
      default:
        // Pentru data, convertește formatul DD/MM/YYYY în YYYY-MM-DD pentru sortare
        aValue = a.data ? new Date(a.data.split('/').reverse().join('-')) : new Date(0);
        bValue = b.data ? new Date(b.data.split('/').reverse().join('-')) : new Date(0);
    }

    if (state.sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getStats = () => {
    const total = state.facturasRecibidas.length;
    const pendientes = state.facturasRecibidas.filter(f => f.Estado === 'Pendiente').length;
    const pagadas = state.facturasRecibidas.filter(f => f.Estado === 'Pagada').length;
    const totalImporte = state.facturasRecibidas.reduce((sum, f) => sum + (parseFloat(f.total_platit) || 0), 0);
    const totalPendiente = state.facturasRecibidas
      .filter(f => f.Estado === 'Pendiente')
      .reduce((sum, f) => sum + (parseFloat(f.total_platit) || 0), 0);

    return {
      total,
      pendientes,
      pagadas,
      totalImporte,
      totalPendiente
    };
  };

  // Obține data ultimei facturi primite (pentru validare)
  const getLastFacturaRecibidaDate = () => {
    if (state.facturasRecibidas.length === 0) return null;
    
    // Sortează facturile după dată și returnează data ultimei
    const sortedFacturas = [...state.facturasRecibidas].sort((a, b) => {
      const dateA = a.data ? new Date(a.data.split('/').reverse().join('-')) : new Date(0);
      const dateB = b.data ? new Date(b.data.split('/').reverse().join('-')) : new Date(0);
      return dateB - dateA; // Descending order
    });
    
    return sortedFacturas[0].data;
  };

  const value = {
    ...state,
    filteredFacturasRecibidas: sortedFacturasRecibidas,
    addFacturaRecibida,
    updateFacturaRecibida,
    deleteFacturaRecibida,
    setFilters,
    resetFilters,
    setSort,
    refreshFromWebhook,
    getStats,
    getLastFacturaRecibidaDate
  };

  return (
    <FacturasRecibidasContext.Provider value={value}>
      {children}
    </FacturasRecibidasContext.Provider>
  );
}

// Custom hook
export function useFacturasRecibidas() {
  const context = useContext(FacturasRecibidasContext);
  if (!context) {
    throw new Error('useFacturasRecibidas must be used within a FacturasRecibidasProvider');
  }
  return context;
}
