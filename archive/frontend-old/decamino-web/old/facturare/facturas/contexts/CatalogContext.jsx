import { createContext, useContext, useReducer, useEffect } from 'react';
import { routes } from '../../../utils/routes';
import { useAuth } from '../../../contexts/AuthContext';

// Initial state
const initialState = {
  products: [],
  categories: [],
  loading: false,
  error: null,
  filters: {
    category: '',
    search: '',
    inStock: false
  }
};

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_PRODUCTS: 'SET_PRODUCTS',
  ADD_PRODUCT: 'ADD_PRODUCT',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  SET_CATEGORIES: 'SET_CATEGORIES',
  ADD_CATEGORY: 'ADD_CATEGORY',
  UPDATE_CATEGORY: 'UPDATE_CATEGORY',
  DELETE_CATEGORY: 'DELETE_CATEGORY',
  SET_FILTERS: 'SET_FILTERS',
  RESET_FILTERS: 'RESET_FILTERS'
};

// Reducer
function catalogReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ACTIONS.SET_PRODUCTS:
      return { ...state, products: action.payload };
    
    case ACTIONS.ADD_PRODUCT:
      return { ...state, products: [...state.products, action.payload] };
    
    case ACTIONS.UPDATE_PRODUCT:
      return {
        ...state,
        products: state.products.map(product =>
          product.id === action.payload.id ? action.payload : product
        )
      };
    
    case ACTIONS.DELETE_PRODUCT:
      return {
        ...state,
        products: state.products.filter(product => product.id !== action.payload)
      };
    
    case ACTIONS.SET_CATEGORIES:
      return { ...state, categories: action.payload };
    
    case ACTIONS.ADD_CATEGORY:
      return { ...state, categories: [...state.categories, action.payload] };
    
    case ACTIONS.UPDATE_CATEGORY:
      return {
        ...state,
        categories: state.categories.map(category =>
          category.id === action.payload.id ? action.payload : category
        )
      };
    
    case ACTIONS.DELETE_CATEGORY:
      return {
        ...state,
        categories: state.categories.filter(category => category.id !== action.payload)
      };
    
    case ACTIONS.SET_FILTERS:
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case ACTIONS.RESET_FILTERS:
      return { ...state, filters: initialState.filters };
    
    default:
      return state;
  }
}

// Create context
const CatalogContext = createContext();

// Provider component
export function CatalogProvider({ children }) {
  const [state, dispatch] = useReducer(catalogReducer, initialState);
  const { user: authUser } = useAuth();

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Demo data for CatalogContext
  const setDemoCatalogData = () => {
    const demoCategories = [
      { id: 1, name: 'Servicios de Limpieza', description: 'Servicios profesionales de limpieza' },
      { id: 2, name: 'Servicios de Mantenimiento', description: 'Mantenimiento de instalaciones' },
      { id: 3, name: 'Servicios de Seguridad', description: 'Vigilancia y seguridad' },
      { id: 4, name: 'Productos de Limpieza', description: 'Materiales y productos de limpieza' },
      { id: 5, name: 'Equipos', description: 'Equipos y maquinaria' }
    ];

    const demoProducts = [
      {
        id: 1,
        cod: 'SERV001',
        name: 'Limpieza General',
        description: 'Servicio de limpieza general para oficinas',
        category: 'Servicios de Limpieza',
        categoryId: 1,
        price: 25.00,
        currency: 'EUR',
        unit: 'hora',
        stock: null,
        minStock: null,
        maxStock: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        cod: 'SERV002',
        name: 'Limpieza Quirófanos',
        description: 'Limpieza especializada para quirófanos',
        category: 'Servicios de Limpieza',
        categoryId: 1,
        price: 35.00,
        currency: 'EUR',
        unit: 'hora',
        stock: null,
        minStock: null,
        maxStock: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 3,
        cod: 'SERV003',
        name: 'Mantenimiento Preventivo',
        description: 'Mantenimiento preventivo de instalaciones',
        category: 'Servicios de Mantenimiento',
        categoryId: 2,
        price: 45.00,
        currency: 'EUR',
        unit: 'hora',
        stock: null,
        minStock: null,
        maxStock: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 4,
        cod: 'SERV004',
        name: 'Vigilancia 24h',
        description: 'Servicio de vigilancia las 24 horas',
        category: 'Servicios de Seguridad',
        categoryId: 3,
        price: 15.00,
        currency: 'EUR',
        unit: 'hora',
        stock: null,
        minStock: null,
        maxStock: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 5,
        cod: 'PROD001',
        name: 'Detergente Profesional',
        description: 'Detergente para limpieza profesional',
        category: 'Productos de Limpieza',
        categoryId: 4,
        price: 12.50,
        currency: 'EUR',
        unit: 'litro',
        stock: 50,
        minStock: 10,
        maxStock: 100,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 6,
        cod: 'EQUI001',
        name: 'Aspiradora Industrial',
        description: 'Aspiradora para uso industrial',
        category: 'Equipos',
        categoryId: 5,
        price: 450.00,
        currency: 'EUR',
        unit: 'unidad',
        stock: 3,
        minStock: 1,
        maxStock: 5,
        active: true,
        createdAt: new Date().toISOString()
      }
    ];

    dispatch({ type: ACTIONS.SET_CATEGORIES, payload: demoCategories });
    dispatch({ type: ACTIONS.SET_PRODUCTS, payload: demoProducts });
    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
  };

  const loadInitialData = async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo catalog data instead of fetching from backend');
      setDemoCatalogData();
      return;
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      // Load products from n8n webhook
      console.log('Loading initial data from webhook...');
      const response = await fetch('https://n8n.decaminoservicios.com/webhook/86e28102-8bf2-408b-89fe-9670956d4f5d');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const productsData = await response.json();
      console.log('Initial webhook response:', productsData);
      
      // Process products and create categories from FAMILIA/SUBFAMILIA
      const processedData = processProductsFromWebhook(productsData);
      console.log('Initial processed data:', processedData);
      
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: processedData.categories });
      dispatch({ type: ACTIONS.SET_PRODUCTS, payload: processedData.products });
      
    } catch (error) {
      console.error('Error loading products from webhook:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Error loading products from webhook' });
      
      // Fallback to sample data if webhook fails
      console.log('Falling back to sample data...');
      loadSampleData();
          } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
  };

  const processProductsFromWebhook = (webhookData) => {
    const categoriesMap = new Map();
    const products = [];
    let categoryId = 1;

    // Handle both array and single object responses
    let dataArray = [];
    if (Array.isArray(webhookData)) {
      dataArray = webhookData;
    } else if (webhookData && typeof webhookData === 'object') {
      // If it's a single object, wrap it in an array
      dataArray = [webhookData];
    } else {
      console.warn('Invalid webhook data format:', webhookData);
      return { categories: [], products: [] };
    }

    dataArray.forEach((item, index) => {
      // Extract family/subfamily for category
      const familySubfamily = item['FAMILIA/SUBFAMILIA'] || 'Sin Categoría';
      
      // Create or get existing category
      if (!categoriesMap.has(familySubfamily)) {
        categoriesMap.set(familySubfamily, {
          id: categoryId++,
          name: familySubfamily,
          description: `Categoría: ${familySubfamily}`
        });
      }
      
      const category = categoriesMap.get(familySubfamily);
      
      // Process product data
      const product = {
        id: index + 1,
        cod: item['CÓDIGO DE PRODUCTO (SKU)'] || `PROD${String(index + 1).padStart(3, '0')}`,
        name: item['NOMBRE'] || 'Sin Nombre',
        description: item['DESCRIPCIÓN'] || '',
        categoryId: category.id,
        category: category.name,
        price: parseFloat(item['PRECIO VENTA - BASE IMPONIBLE']?.replace(',', '.') || '0'),
        currency: 'EUR',
        unit: item['TIPO DE UNIDAD'] || 'unidad',
        stock: item['CONTROLAR STOCK'] === 'SI' ? 
          (parseInt(item['STOCK ABSOLUTO']) || 0) : null,
        minStock: item['ACTIVAR ALARMA DE STOCK'] === 'SI' ? 
          (parseInt(item['AVISAR CUANDO EL NÚMERO DE UNIDADES SEA INFERIOR A']) || 0) : null,
        maxStock: null, // Not provided in webhook data
        active: item['PRODUCTO VISIBLE (ACTIVO)'] === 'SI',
        // Additional fields from webhook
        pvp: parseFloat(item['P.V.P.']?.replace(',', '.') || '0'),
        iva: parseFloat(item['PRECIO VENTA - % IVA']?.replace('%', '') || '0'),
        cost: item['COSTE ADQUISICIÓN TOTAL'] ? 
          parseFloat(item['COSTE ADQUISICIÓN TOTAL'].replace(',', '.')) : null,
        reference: item['REFERENCIA PROVEEDOR'] || '',
        notes: item['NOTAS PRIVADAS'] || '',
        createdAt: new Date().toISOString()
      };
      
      products.push(product);
    });

    const categories = Array.from(categoriesMap.values());
    
    return { categories, products };
  };

  const loadSampleData = () => {
    // Sample data as fallback
    const categories = [
      { id: 1, name: 'Servicii', description: 'Servicii oferite clienților' },
      { id: 2, name: 'Produse', description: 'Produse fizice' },
      { id: 3, name: 'Consumabile', description: 'Materiale consumabile' }
    ];

    const products = [
      {
        id: 1,
        cod: 'SERV001',
        name: 'Serviciu de Curățenie',
        description: 'Curățenie generală pentru birouri',
        category: 'Servicii',
        categoryId: 1,
        price: 25.00,
        currency: 'EUR',
        unit: 'oră',
        stock: null,
        minStock: null,
        maxStock: null,
        active: true,
        createdAt: new Date().toISOString()
      }
    ];

    dispatch({ type: ACTIONS.SET_CATEGORIES, payload: categories });
    dispatch({ type: ACTIONS.SET_PRODUCTS, payload: products });
  };

  // Product actions
  const addProduct = async (productData) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const newProduct = {
        ...productData,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        active: true
      };
      
      dispatch({ type: ACTIONS.ADD_PRODUCT, payload: newProduct });
      return newProduct;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const updatedProduct = {
        ...state.products.find(p => p.id === productId),
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      dispatch({ type: ACTIONS.UPDATE_PRODUCT, payload: updatedProduct });
      return updatedProduct;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const deleteProduct = async (productId) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.DELETE_PRODUCT, payload: productId });
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Category actions
  const addCategory = async (categoryData) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const newCategory = {
        ...categoryData,
        id: Date.now()
      };
      
      dispatch({ type: ACTIONS.ADD_CATEGORY, payload: newCategory });
      return newCategory;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const updateCategory = async (categoryId, updates) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const updatedCategory = {
        ...state.categories.find(c => c.id === categoryId),
        ...updates
      };
      
      dispatch({ type: ACTIONS.UPDATE_CATEGORY, payload: updatedCategory });
      return updatedCategory;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.DELETE_CATEGORY, payload: categoryId });
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

  const refreshFromWebhook = async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping refreshFromWebhook in CatalogContext');
      return;
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      console.log('Fetching from webhook...');
      const response = await fetch('https://n8n.decaminoservicios.com/webhook/86e28102-8bf2-408b-89fe-9670956d4f5d');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const productsData = await response.json();
      console.log('Webhook response:', productsData);
      
      const processedData = processProductsFromWebhook(productsData);
      console.log('Processed data:', processedData);
      
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: processedData.categories });
      dispatch({ type: ACTIONS.SET_PRODUCTS, payload: processedData.products });
      
      return { success: true, message: 'Products refreshed successfully' };
    } catch (error) {
      console.error('Error refreshing from webhook:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Error refreshing products' });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Computed values
  const filteredProducts = state.products.filter(product => {
    const matchesCategory = !state.filters.category || product.categoryId === parseInt(state.filters.category);
    const matchesSearch = !state.filters.search || 
      product.name.toLowerCase().includes(state.filters.search.toLowerCase()) ||
      product.cod.toLowerCase().includes(state.filters.search.toLowerCase());
    const matchesStock = !state.filters.inStock || (product.stock !== null && product.stock > 0);
    
    return matchesCategory && matchesSearch && matchesStock;
  });

  const value = {
    ...state,
    filteredProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    setFilters,
    resetFilters,
    refreshFromWebhook
  };

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}

// Custom hook
export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
