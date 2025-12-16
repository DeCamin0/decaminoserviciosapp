import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import { Link } from 'react-router-dom';
import { isDemoMode } from '../utils/demo';

// ===== TIPURI TYPESCRIPT =====
type Usuario = {
  id: string;
  nombre: string;
  comunidad: string;
};

type Producto = {
  id: number;
  numero: string;
  descripcion: string;
  precio: number;
  imagen?: string; // Base64 string pentru imagine
  permitido?: boolean; // Permisiunea pentru comunitatea selectată
};

type Comunidad = {
  id: number;
  nombre: string;
};

type LineaPedido = {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  iva_porcentaje: number;
};

type PermisosState = {
  [comunidadId: number]: {
    [productoId: number]: boolean;
  };
};

// ===== API ENDPOINT PENTRU PRODUSE =====
import { getN8nUrl } from '../utils/routes';

const CATALOGO_API_URL = getN8nUrl('/webhook/catalogo/bae4f329-a1be-4e66-9792-6b35aa2f4a51');
const ADD_PRODUCT_API_URL = getN8nUrl('/webhook/96759745-6289-41d4-9e5e-f253fbfab08c');
const EDIT_DELETE_PRODUCT_API_URL = getN8nUrl('/webhook/5c49e67b-b81c-4187-8d0f-37bb32e9f217');
const PERMISOS_API_URL = getN8nUrl('/webhook/2498ba38-1402-4b73-bb5b-c8b1097ecf4b');
const PERMISOS_LOAD_API_URL = getN8nUrl('/webhook/8c8aa198-5b57-4203-bdd7-7f8ff060bf68');

// ===== SISTEM DE NOTIFICĂRI MODERNE =====
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

const ToastComponent: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`border rounded-xl shadow-lg p-4 ${getToastStyles()}`}>
        <div className="flex items-start gap-3">
          <div className="text-xl">{getIcon()}</div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{toast.title}</div>
            <div className="text-sm opacity-90 mt-1">{toast.message}</div>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onClose(toast.id), 300);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onClose: (id: string) => void }> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};


// Comunidades se vor încărca din backend

// ===== FUNCȚII UTILITARE =====
const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat("es-ES", { 
    style: "currency", 
    currency: "EUR" 
  }).format(amount);
};

// Convertește Buffer-ul la base64 string
const bufferToBase64 = (bufferData: number[]): string => {
  try {
    // Convertește array-ul de numere la Uint8Array
    const uint8Array = new Uint8Array(bufferData);
    
    // Convertește la string binar
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    
    // Convertește la base64
    const base64 = btoa(binary);
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting buffer to base64:', error);
    return '';
  }
};

const formatDate = (): string => {
  return new Date().toLocaleDateString("es-ES", {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ===== DATE DEMO =====
const getDemoComunidades = () => [
  { id: 1, nombre: 'C.P. Residencia Los Pinos', 'NOMBRE O RAZON SOCIAL': 'C.P. Residencia Los Pinos' },
  { id: 2, nombre: 'C.P. Jardines del Norte', 'NOMBRE O RAZON SOCIAL': 'C.P. Jardines del Norte' },
  { id: 3, nombre: 'C.P. Vista Hermosa', 'NOMBRE O RAZON SOCIAL': 'C.P. Vista Hermosa' },
  { id: 4, nombre: 'C.P. Los Laureles', 'NOMBRE O RAZON SOCIAL': 'C.P. Los Laureles' },
  { id: 5, nombre: 'C.P. El Mirador', 'NOMBRE O RAZON SOCIAL': 'C.P. El Mirador' }
];

const getDemoProductos = () => [
  { id: 1, numero: 'PROD-001', descripcion: 'Producto de Limpieza General', precio: 15.50, categoria: 'Limpieza' },
  { id: 2, numero: 'PROD-002', descripcion: 'Detergente Especializado', precio: 22.30, categoria: 'Limpieza' },
  { id: 3, numero: 'PROD-003', descripcion: 'Desinfectante Hospitalario', precio: 45.80, categoria: 'Sanitización' },
  { id: 4, numero: 'PROD-004', descripcion: 'Papel Higiénico Industrial', precio: 8.90, categoria: 'Papel' },
  { id: 5, numero: 'PROD-005', descripcion: 'Jabón de Manos Antibacterial', precio: 12.40, categoria: 'Higiene' }
];

// ===== COMPONENTA PRINCIPAL =====
const PedidosPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'nuevo-pedido' | 'permisos' | 'catalogo'>('nuevo-pedido');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Verifică rolul utilizatorului pentru restricționarea tab-urilor
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = user?.isManager || false;
  const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
  const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
  
  // Doar managerii, adminii și developerii pot accesa toate tab-urile
  const canAccessAllTabs = isManager || isAdmin || isDeveloper;

  // Funcție pentru adăugarea de notificări
  const addToast = (type: ToastType, title: string, message: string, duration?: number) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, title, message, duration };
    setToasts(prev => [...prev, newToast]);
  };

  // Funcție pentru închiderea notificărilor
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link 
            to="/dashboard" 
            className="group flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors duration-200"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-110 transition-all duration-200">
                <span className="text-white font-bold text-sm">←</span>
              </div>
            </div>
            <span className="text-sm font-medium">Volver a Inicio</span>
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedidos</h1>
            <p className="text-gray-600">Gestiona pedidos y permisos de productos</p>
          </div>
          <button 
            onClick={() => window.open('https://wa.me/34635289087?text=Hola, he encontrado un error en la sección de pedidos:', '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <span className="text-lg">📱</span>
            <span>Reportar error</span>
          </button>
        </div>
      </div>

        {/* Tabs */}
        <Card className="mb-6">
          <div className="flex flex-wrap gap-3 p-4">
            <button
              onClick={() => setActiveTab('nuevo-pedido')}
              className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'nuevo-pedido'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                  : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
              }`}
            >
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'nuevo-pedido' 
                  ? 'bg-red-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-red-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <span>Nuevo Pedido</span>
              </div>
            </button>
            
            {/* Tab-uri restricționate pentru manageri, admini și developeri */}
            {canAccessAllTabs && (
              <>
                <button
                  onClick={() => setActiveTab('permisos')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                    activeTab === 'permisos'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                      : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    activeTab === 'permisos' 
                      ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                      : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-xl">🔒</span>
                    <span>Permisos por Comunidad</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                    activeTab === 'catalogo'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                      : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    activeTab === 'catalogo' 
                      ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                      : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <span>Catálogo</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Content */}
        {activeTab === 'nuevo-pedido' ? (
          <TabNuevoPedido addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'permisos' ? (
          <TabPermisosComunidad addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'catalogo' ? (
          <TabCatalogo addToast={addToast} />
        ) : (
          <TabNuevoPedido addToast={addToast} />
        )}
      </div>
      
      {/* Container pentru notificări */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

// ===== TAB NUEVO PEDIDO =====
const TabNuevoPedido: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [impuestos, setImpuestos] = useState(0);
  const [notas, setNotas] = useState('');
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [loadingComunidades, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<any>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  
  // State pentru searchable dropdown
  const [comunidadSearchTerm, setComunidadSearchTerm] = useState('');
  const [showComunidadDropdown, setShowComunidadDropdown] = useState(false);

  // Încarcă centrele de trabajo (comunidades) din backend sau demo
  useEffect(() => {
    const loadComunidades = async () => {
      setLoadingComunidades(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo comunidades data instead of fetching from backend');
        const demoComunidades = getDemoComunidades();
        setComunidades(demoComunidades);
        setLoadingComunidades(false);
        return;
      }
      
      try {
        const response = await fetch(routes.getClientes, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        const data = await response.json();
        const clientesArray = Array.isArray(data) ? data : [data];
        
        // Extrage centrele de trabajo din clienți cu datele complete
        const centrosFromClientes = clientesArray
          .map((cliente, index) => ({
            id: index + 1,
            nombre: cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || 'Sin nombre',
            datosCompletos: cliente // Păstrăm datele complete ale clientului
          }))
          .filter(centro => centro.nombre && centro.nombre.trim() !== '' && centro.nombre.length > 3)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        setComunidades(centrosFromClientes);
        console.log('✅ Comunidades cargadas:', centrosFromClientes.length);
      } catch (error) {
        console.error('Error loading comunidades:', error);
      } finally {
        setLoadingComunidades(false);
      }
    };

    loadComunidades();
  }, [routes.getClientes, user?.isDemo]);

  // Nu încarcă produsele la început - doar când se selectează o comunitate
  // Produsele se vor încărca în handleComunidadChange

  // Obține datele utilizatorului conectat
  const usuarioActual = {
    id: user?.CODIGO || user?.id || 'N/A',
    nombre: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.nombre || 'Usuario',
    comunidad: user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO || 'Sin centro'
  };

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = async (comunidadId: number) => {
    console.log('🎯 handleComunidadChange called with:', comunidadId);
    setComunidadSeleccionada(comunidadId);
    
    try {
      // Găsește comunitatea selectată pentru a obține numele
      const comunidad = comunidades.find(c => c.id === comunidadId);
      const nombreComunidad = comunidad?.nombre || comunidad?.['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada';
      
      console.log('🔍 Cargando detalles para:', { id: comunidadId, nombre: nombreComunidad });
      console.log('🏢 Comunidad encontrada:', comunidad);
      console.log('📋 Comunidades disponibles:', comunidades.length);
      console.log('🔗 routes.getClientes:', routes.getClientes);
      
      // Folosește endpoint-ul pentru toate produsele cu permisiuni pentru comunitatea selectată
      const detallesEndpoint = getN8nUrl('/webhook/b127e72a-df77-4c07-acc3-1e9d931d4f95');
      const url = `${detallesEndpoint}?cliente_id=${comunidadId}&cliente_nombre=${encodeURIComponent(nombreComunidad)}&todos_productos=true`;
      console.log('🌐 URL generat:', url);
      
      console.log('🚀 Making request to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Detalles cargados:', data);
      
      // Procesează răspunsul (obiect sau array de produse cu permisiuni)
      console.log('🔍 Tipo de respuesta:', typeof data, Array.isArray(data));
      
      if (data && (Array.isArray(data) || typeof data === 'object')) {
        let productosConPermisos;
        
        // Interface pentru produs din API
        interface ProductoAPI {
          producto_id: number;
          numero_articulo: string;
          imagen_base64?: string;
          fotoproducto?: {
            data: number[];
          };
          [key: string]: any; // Pentru alte proprietăți dinamic
        }

        if (Array.isArray(data)) {
          // Dacă este array, mapează toate produsele
          productosConPermisos = data.map((item: ProductoAPI) => {
            // Folosește imagen_base64 direct din backend
            let imagenBase64 = '';
            if (item.imagen_base64) {
              console.log('🖼️ Procesando imagen para producto:', item.numero_articulo);
              imagenBase64 = `data:image/jpeg;base64,${item.imagen_base64}`;
              console.log('✅ Imagen base64 directa:', imagenBase64.substring(0, 50) + '...');
            } else if (item.fotoproducto && item.fotoproducto.data && Array.isArray(item.fotoproducto.data)) {
              console.log('🖼️ Procesando imagen Buffer para producto:', item.numero_articulo);
              imagenBase64 = bufferToBase64(item.fotoproducto.data);
              console.log('✅ Imagen convertida din Buffer:', imagenBase64.substring(0, 50) + '...');
            } else {
              console.log('❌ No hay imagen para producto:', item.numero_articulo);
            }
            
            return {
              id: item.producto_id,
              numero: item.numero_articulo,
              descripcion: item.descripcion,
              precio: parseFloat(item.precio),
              permitido: item.permitido === 1 || item.permitido === true,
              imagen: imagenBase64 || undefined
            };
          });
        } else {
          // Dacă este obiect singular, creează array cu un singur element
          let imagenBase64 = '';
          if (data.imagen_base64) {
            console.log('🖼️ Procesando imagen para producto singular:', data.numero_articulo);
            imagenBase64 = `data:image/jpeg;base64,${data.imagen_base64}`;
            console.log('✅ Imagen base64 directa:', imagenBase64.substring(0, 50) + '...');
          } else if (data.fotoproducto && data.fotoproducto.data && Array.isArray(data.fotoproducto.data)) {
            console.log('🖼️ Procesando imagen Buffer para producto singular:', data.numero_articulo);
            imagenBase64 = bufferToBase64(data.fotoproducto.data);
            console.log('✅ Imagen convertida din Buffer:', imagenBase64.substring(0, 50) + '...');
          } else {
            console.log('❌ No hay imagen para producto singular:', data.numero_articulo);
          }
          
          productosConPermisos = [{
            id: data.producto_id,
            numero: data.numero_articulo,
            descripcion: data.descripcion,
            precio: parseFloat(data.precio),
            permitido: data.permitido === 1 || data.permitido === true,
            imagen: imagenBase64 || undefined
          }];
        }
        
        console.log('📦 Productos con permisos mapeados:', productosConPermisos);
        
        // Log pentru imagini
        const productosConImagen = productosConPermisos.filter(p => p.imagen).length;
        console.log(`📸 Productos con imagen: ${productosConImagen}/${productosConPermisos.length}`);
        
        // Actualizează produsele cu permisiunile lor
        setProductos(productosConPermisos);
        
        // Actualizează și detaliile comunității cu datele complete
        setComunidadDetalles({
          id: comunidadId,
          nombre: nombreComunidad,
          productos: productosConPermisos,
          // Include datele complete ale comunității
          'NOMBRE O RAZON SOCIAL': comunidad?.datosCompletos?.['NOMBRE O RAZON SOCIAL'] || nombreComunidad,
          NIF: comunidad?.datosCompletos?.NIF || 'N/A',
          TELEFONO: comunidad?.datosCompletos?.TELEFONO || 'N/A',
          DIRECCION: comunidad?.datosCompletos?.DIRECCION || 'N/A',
          'CODIGO POSTAL': comunidad?.datosCompletos?.['CODIGO POSTAL'] || 'N/A',
          POBLACION: comunidad?.datosCompletos?.POBLACION || 'N/A',
          PROVINCIA: comunidad?.datosCompletos?.PROVINCIA || 'N/A',
          PAIS: comunidad?.datosCompletos?.PAIS || 'N/A',
          LATITUD: comunidad?.datosCompletos?.LATITUD || null,
          LONGITUD: comunidad?.datosCompletos?.LONGITUD || null
        });
        
        addToast('success', 'Detalles cargados', `Detalles de "${nombreComunidad}" (ID: ${comunidadId}) cargados correctamente. ${productosConPermisos.length} productos con permisos.`);
      } else {
        throw new Error('Respuesta vacía o inválida');
      }
      
    } catch (error) {
      console.error('❌ Error cargando detalles de comunidad:', error);
      // Nu afișa notificarea - doar golește lista de produse
      setProductos([]);
      setComunidadDetalles(null);
    }
  };

  // Filtrare comunități pentru searchable dropdown
  const comunidadesFiltradas = useMemo(() => {
    if (!comunidadSearchTerm) return comunidades.slice(0, 10); // Primele 10 dacă nu se caută
    return comunidades.filter(com => 
      com.nombre.toLowerCase().includes(comunidadSearchTerm.toLowerCase()) ||
      com.id.toString().includes(comunidadSearchTerm)
    ).slice(0, 20); // Maxim 20 rezultate
  }, [comunidades, comunidadSearchTerm]);

  // Filtrare produse
  const productosFiltrados = useMemo(() => {
    if (!searchTerm) return productos;
    return productos.filter(producto => 
      producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, productos]);

  // Adăugare produs în pedido
  const agregarProducto = (producto: Producto) => {
    const nuevaLinea: LineaPedido = {
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: producto.precio,
      descuento_linea: 0,
      iva_porcentaje: 21
    };
    setLineasPedido([...lineasPedido, nuevaLinea]);
  };

  // Actualizare linie
  const actualizarLinea = (index: number, campo: keyof LineaPedido, valor: number) => {
    const nuevasLineas = [...lineasPedido];
    nuevasLineas[index] = { ...nuevasLineas[index], [campo]: valor };
    setLineasPedido(nuevasLineas);
  };

  // Ștergere linie
  const eliminarLinea = (index: number) => {
    setLineasPedido(lineasPedido.filter((_, i) => i !== index));
  };

  // Calcule pentru fiecare linie
  const calcularLinea = (linea: LineaPedido) => {
    const subtotalLinea = linea.cantidad * linea.precio_unitario;
    const descuentoAplicado = linea.descuento_linea;
    const ivaCalculat = (subtotalLinea - descuentoAplicado) * (linea.iva_porcentaje / 100);
    const totalLinea = subtotalLinea - descuentoAplicado + ivaCalculat;
    
    return {
      subtotal: subtotalLinea,
      descuento: descuentoAplicado,
      iva: ivaCalculat,
      total: totalLinea
    };
  };

  // Calcule finale
  const subtotal = lineasPedido.reduce((sum, linea) => {
    const calc = calcularLinea(linea);
    return sum + calc.subtotal;
  }, 0);

  const total = subtotal - descuentoGlobal + impuestos;

  // Guardar borrador
  const guardarBorrador = () => {
    if (!comunidadSeleccionada) {
      alert("Por favor, selecciona una comunidad primero");
      return;
    }

    const comunidadNombre = comunidades.find(c => c.id === comunidadSeleccionada)?.nombre || 'Sin comunidad';
    
    const payload = {
      empleado_id: usuarioActual.id,
      empleado_nombre: usuarioActual.nombre,
      comunidad_id: comunidadSeleccionada,
      comunidad_nombre: comunidadNombre,
      fecha: formatDate(),
      moneda: "EUR",
      descuento_global: descuentoGlobal,
      impuestos: impuestos,
      notas: notas,
      items: lineasPedido,
      total_preview: total
    };
    
    console.log('Payload borrador:', payload);
    addToast('success', 'Borrador guardado', 'El borrador del pedido se ha preparado correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Informații utilizator */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Información del Pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
              <p className="text-lg font-semibold text-gray-900">{usuarioActual.nombre}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comunidad</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escribe para buscar comunidad..."
                  value={comunidadSearchTerm}
                  onChange={(e) => setComunidadSearchTerm(e.target.value)}
                  onFocus={() => setShowComunidadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowComunidadDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {showComunidadDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {comunidadesFiltradas.map(com => (
                      <div
                        key={com.id}
                        onClick={() => {
                          setComunidadSearchTerm(com.nombre);
                          setShowComunidadDropdown(false);
                          handleComunidadChange(com.id);
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{com.nombre}</div>
                        <div className="text-sm text-gray-500">ID: {com.id}</div>
                      </div>
                    ))}
                    {comunidadesFiltradas.length === 0 && (
                      <div className="px-3 py-2 text-gray-500 text-sm">No se encontraron comunidades</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <p className="text-lg font-semibold text-gray-900">{formatDate()}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Detalii comunitate selectată */}
      {comunidadDetalles && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-900">Información de la Comunidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['NOMBRE O RAZON SOCIAL'] || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.NIF || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.TELEFONO || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <p className="text-sm font-semibold text-gray-900">
                  {comunidadDetalles.DIRECCION || comunidadDetalles.DIRECCIÓN || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['CODIGO POSTAL'] || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Población</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.POBLACION || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PROVINCIA || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PAIS || 'N/A'}</p>
              </div>
              {comunidadDetalles.LATITUD && comunidadDetalles.LONGITUD && (
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coordenadas GPS</label>
                  <p className="text-sm font-semibold text-gray-900">
                    {comunidadDetalles.LATITUD}, {comunidadDetalles.LONGITUD}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Căutare produse */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Buscar Productos 
              {productos.length > 0 && (
                <span className="text-sm font-normal text-green-600 ml-2">
                  ({productos.length} productos cargados)
                </span>
              )}
            </h3>
          </div>
          <Input
            label="Buscar por número o descripción"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ej: A-100 o Pintura blanca"
            className="mb-4"
          />
          
          {loadingProductos ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Cargando productos...</p>
              </div>
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No se encontraron productos disponibles</h3>
              <p className="text-gray-500 mb-4">
                Esta comunidad no tiene productos asignados en el catálogo.
              </p>
              <div className="text-sm text-gray-400">
                Contacta con el administrador para asignar productos a esta comunidad.
              </div>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map(producto => (
                  <div key={producto.id} className="flex items-center gap-3 p-3 border-b hover:bg-gray-50">
                    {/* Imagine produs - mică în listă */}
                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center">
                      {producto.imagen ? (
                        <img 
                          src={producto.imagen} 
                          alt={producto.descripcion}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          <div className="text-2xl text-gray-300">📷</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Informații produs */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{producto.numero}</div>
                      <div className="text-sm text-gray-600 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>{producto.descripcion}</div>
                      <div className="text-sm font-semibold text-red-600">{formatMoney(producto.precio)}</div>
                    </div>
                    
                    {/* Buton Añadir */}
                    <div className="flex-shrink-0">
                      <Button
                        onClick={() => agregarProducto(producto)}
                        size="sm"
                        variant="primary"
                      >
                        Añadir
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Liniile din pedido */}
      {lineasPedido.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Líneas del Pedido</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Producto</th>
                    <th className="text-left p-2">Cantidad</th>
                    <th className="text-left p-2">Precio Unit.</th>
                    <th className="text-left p-2">Desc. Línea</th>
                    <th className="text-left p-2">IVA %</th>
                    <th className="text-left p-2">Total Línea</th>
                    <th className="text-left p-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasPedido.map((linea, index) => {
                    const producto = productos.find(p => p.id === linea.producto_id);
                    const calc = calcularLinea(linea);
                    
                    return (
                      <tr key={index} className="border-b">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{producto?.numero}</div>
                            <div className="text-sm text-gray-600">{producto?.descripcion}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={linea.cantidad}
                            onChange={(e) => actualizarLinea(index, 'cantidad', Number(e.target.value))}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">{formatMoney(linea.precio_unitario)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={linea.descuento_linea}
                            onChange={(e) => actualizarLinea(index, 'descuento_linea', Number(e.target.value))}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={linea.iva_porcentaje}
                            onChange={(e) => actualizarLinea(index, 'iva_porcentaje', Number(e.target.value))}
                            className="w-16"
                          />
                        </td>
                        <td className="p-2 font-semibold">{formatMoney(calc.total)}</td>
                        <td className="p-2">
                          <Button
                            onClick={() => eliminarLinea(index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Rezumat final */}
      {lineasPedido.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descuento Global (EUR)</label>
                  <Input
                    type="number"
                    value={descuentoGlobal}
                    onChange={(e) => setDescuentoGlobal(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Impuestos (EUR)</label>
                  <Input
                    type="number"
                    value={impuestos}
                    onChange={(e) => setImpuestos(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={3}
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Descuento Global:</span>
                  <span>-{formatMoney(descuentoGlobal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos:</span>
                  <span>{formatMoney(impuestos)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>TOTAL:</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Button
                onClick={guardarBorrador}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Guardar Borrador
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ===== TAB PERMISOS COMUNIDAD =====
const TabPermisosComunidad: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const { user } = useAuth();
  
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [permisos, setPermisos] = useState<PermisosState>({});
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [loadingComunidades, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<any>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  
  // State pentru searchable dropdown
  const [comunidadSearchTerm, setComunidadSearchTerm] = useState('');
  const [showComunidadDropdown, setShowComunidadDropdown] = useState(false);

  // Încarcă centrele de trabajo (comunidades) din backend sau demo
  useEffect(() => {
    const loadComunidades = async () => {
      setLoadingComunidades(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo comunidades data instead of fetching from backend');
        const demoComunidades = getDemoComunidades();
        setComunidades(demoComunidades);
        setLoadingComunidades(false);
        return;
      }
      
      try {
        const response = await fetch(routes.getClientes, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        const data = await response.json();
        const clientesArray = Array.isArray(data) ? data : [data];
        
        // Extrage centrele de trabajo din clienți cu datele complete
        const centrosFromClientes = clientesArray
          .map((cliente, index) => ({
            id: index + 1,
            nombre: cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || 'Sin nombre',
            datosCompletos: cliente // Păstrăm datele complete ale clientului
          }))
          .filter(centro => centro.nombre && centro.nombre.trim() !== '' && centro.nombre.length > 3)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        setComunidades(centrosFromClientes);
        console.log('✅ Comunidades cargadas:', centrosFromClientes.length);
      } catch (error) {
        console.error('Error loading comunidades:', error);
      } finally {
        setLoadingComunidades(false);
      }
    };

    loadComunidades();
  }, [routes.getClientes, user?.isDemo]);

  // Încarcă produsele din API sau demo
  useEffect(() => {
    const loadProductos = async () => {
      setLoadingProductos(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo productos data instead of fetching from backend');
        const demoProductos = getDemoProductos();
        setProductos(demoProductos);
        setLoadingProductos(false);
        return;
      }
      
      try {
        const response = await fetch(CATALOGO_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Verifică dacă răspunsul are conținut
        const responseText = await response.text();
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response from API');
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from API');
        }
        
        // Transformă datele din API în formatul nostru
        const productosFromAPI = Array.isArray(data) ? data : [data];
        const productosMapeados = productosFromAPI.map((producto: ProductoAPI2, index: number) => {
          // Convertește imaginea din Buffer la base64 dacă există
          let imagenBase64 = '';
          if (producto.fotoproducto && producto.fotoproducto.data && Array.isArray(producto.fotoproducto.data)) {
            imagenBase64 = bufferToBase64(producto.fotoproducto.data);
          }

          return {
            id: producto.id || index + 1,
            numero: producto['Número de artículo'] || producto.numero || producto.codigo || `PROD-${index + 1}`,
            descripcion: producto['Descripción de artículo'] || producto.descripcion || producto.nombre || 'Sin descripción',
            precio: parseFloat(producto['Precio por unidad'] || producto.precio || producto.precio_unitario || 0),
            imagen: imagenBase64 || undefined
          };
        });
        
        setProductos(productosMapeados);
        
        // Log pentru imagini
        const productosConImagen = productosMapeados.filter(p => p.imagen).length;
        console.log(`📸 Productos con imagen: ${productosConImagen}/${productosMapeados.length}`);
      } catch (error) {
        console.error('Error loading productos:', error);
        // Fallback la mock data în caz de eroare
        const productosMock: Producto[] = [
          { id: 1, numero: "A-100", descripcion: "Pintura blanca 15L", precio: 29.9 },
          { id: 2, numero: "B-220", descripcion: "Rodillo profesional", precio: 8.5 },
          { id: 3, numero: "C-330", descripcion: "Cinta carrocero 48mm", precio: 2.2 },
          { id: 4, numero: "D-010", descripcion: "Yeso rápido 20kg", precio: 7.9 },
          { id: 5, numero: "E-550", descripcion: "Brocha 4 pulgadas", precio: 12.3 },
          { id: 6, numero: "F-660", descripcion: "Lijadora orbital", precio: 45.7 }
        ];
        setProductos(productosMock);
      } finally {
        setLoadingProductos(false);
      }
    };

    loadProductos();
  }, []);

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = async (comunidadId: number) => {
    console.log('🎯 handleComunidadChange called with:', comunidadId);
    setComunidadSeleccionada(comunidadId);
    
    try {
      // Găsește comunitatea selectată pentru a obține numele
      const comunidad = comunidades.find(c => c.id === comunidadId);
      const nombreComunidad = comunidad?.nombre || comunidad?.['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada';
      
      console.log('🔍 Cargando permisos para:', { id: comunidadId, nombre: nombreComunidad });
      
      // Construiește URL-ul pentru încărcarea permisiunilor
      const url = `${PERMISOS_LOAD_API_URL}?comunidad_id=${comunidadId}&comunidad_nombre=${encodeURIComponent(nombreComunidad)}`;
      console.log('🌐 URL permisos:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Permisos cargados:', data);
      
      // Procesează permisiunile din baza de date
      if (data && Array.isArray(data)) {
        const nuevosPermisos = { ...permisos };
        if (!nuevosPermisos[comunidadId]) {
          nuevosPermisos[comunidadId] = {};
        }
        
        console.log('📊 Procesando permisos:', data.length, 'permisos recibidos');
        
        // Interface pentru permisiuni
        interface PermisoAPI {
          producto_id: number;
          permitido: number | boolean;
          [key: string]: any; // Pentru alte proprietăți dinamic
        }

        // Mapează permisiunile din baza de date
        data.forEach((permiso: PermisoAPI) => {
          if (permiso.producto_id && permiso.permitido !== undefined) {
            const esPermitido = permiso.permitido === 1 || permiso.permitido === true;
            nuevosPermisos[comunidadId][permiso.producto_id] = esPermitido;
            console.log(`🔑 Producto ${permiso.producto_id}: ${esPermitido ? 'PERMITIDO' : 'DENEGADO'}`);
          }
        });
        
        console.log('📋 Permisos finales para comunidad', comunidadId, ':', nuevosPermisos[comunidadId]);
        setPermisos(nuevosPermisos);
        addToast('success', 'Permisos cargados', `Permisos de "${nombreComunidad}" cargados desde la base de datos. ${data.length} productos procesados.`);
      } else {
        // Dacă nu există permisiuni salvate, lasă toate dezactivate
        const nuevosPermisos = { ...permisos };
        if (!nuevosPermisos[comunidadId]) {
          nuevosPermisos[comunidadId] = {};
        }
        setPermisos(nuevosPermisos);
        addToast('info', 'Sin permisos', `No hay permisos guardados para "${nombreComunidad}". Todos los productos están desactivados.`);
      }
      
      // Actualizează detaliile comunității
      if (comunidad?.datosCompletos) {
        setComunidadDetalles(comunidad.datosCompletos);
      } else {
        setComunidadDetalles(null);
      }
      
    } catch (error) {
      console.error('❌ Error cargando permisos:', error);
      addToast('error', 'Error', 'No se pudieron cargar los permisos desde la base de datos.');
      
      // În caz de eroare, lasă toate dezactivate
      const nuevosPermisos = { ...permisos };
      if (!nuevosPermisos[comunidadId]) {
        nuevosPermisos[comunidadId] = {};
      }
      setPermisos(nuevosPermisos);
    }
  };

  // Actualizare permisiune
  const actualizarPermiso = (productoId: number, permitido: boolean) => {
    if (!comunidadSeleccionada) return;
    
    setPermisos(prev => ({
      ...prev,
      [comunidadSeleccionada]: {
        ...prev[comunidadSeleccionada],
        [productoId]: permitido
      }
    }));
  };

  // Obținere permisiune pentru produs
  const obtenerPermiso = (productoId: number): boolean => {
    if (!comunidadSeleccionada) return false;
    const permiso = permisos[comunidadSeleccionada]?.[productoId] || false;
    console.log(`🔍 Verificando permiso para producto ${productoId} en comunidad ${comunidadSeleccionada}: ${permiso ? 'PERMITIDO' : 'DENEGADO'}`);
    return permiso;
  };

  // Contorizare produse permise
  const productosPermitidos = useMemo(() => {
    if (!comunidadSeleccionada) return 0;
    return productos.filter(producto => obtenerPermiso(producto.id)).length;
  }, [comunidadSeleccionada, permisos, productos]);

  // Filtrare comunități pentru searchable dropdown
  const comunidadesFiltradas = useMemo(() => {
    if (!comunidadSearchTerm) return comunidades.slice(0, 10); // Primele 10 dacă nu se caută
    return comunidades.filter(com => 
      com.nombre.toLowerCase().includes(comunidadSearchTerm.toLowerCase()) ||
      com.id.toString().includes(comunidadSearchTerm)
    ).slice(0, 20); // Maxim 20 rezultate
  }, [comunidades, comunidadSearchTerm]);

  // Guardar permisos
  const guardarPermisos = async () => {
    if (!comunidadSeleccionada) {
      addToast('warning', 'Selecciona comunidad', 'Por favor selecciona una comunidad primero');
      return;
    }

    try {
      const payload = {
        comunidad_id: comunidadSeleccionada,
        nombre_comunidad: comunidadDetalles?.['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada',
        permisos: productos.map(producto => ({
          producto_id: producto.id,
          numero_articulo: producto.numero,
          permitido: obtenerPermiso(producto.id)
        }))
      };

      console.log('📤 Enviando permisos:', payload);

      const response = await fetch(PERMISOS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Permisos guardados:', responseData);

      addToast('success', 'Permisos guardados', `Los permisos de la comunidad se han guardado correctamente (${productos.length} productos)`);
    } catch (error) {
      console.error('❌ Error guardando permisos:', error);
      addToast('error', 'Error al guardar', 'No se pudieron guardar los permisos. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selección comunidad */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Seleccionar Comunidad</h2>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comunidad / Centro de Trabajo</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escribe para buscar comunidad..."
                  value={comunidadSearchTerm}
                  onChange={(e) => setComunidadSearchTerm(e.target.value)}
                  onFocus={() => setShowComunidadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowComunidadDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {showComunidadDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {comunidadesFiltradas.map(com => (
                      <div
                        key={com.id}
                        onClick={() => {
                          setComunidadSearchTerm(com.nombre);
                          setShowComunidadDropdown(false);
                          handleComunidadChange(com.id);
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{com.nombre}</div>
                        <div className="text-sm text-gray-500">ID: {com.id}</div>
                      </div>
                    ))}
                    {comunidadesFiltradas.length === 0 && (
                      <div className="px-3 py-2 text-gray-500 text-sm">No se encontraron comunidades</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {comunidadSeleccionada && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <strong>Productos permitidos: {productosPermitidos} / {productos.length}</strong>
              </div>
            )}
          </div>
          
          {comunidadSeleccionada && (
            <p className="mt-3 text-sm text-gray-600">
              Selecciona qué productos puede pedir esta comunidad.
            </p>
          )}
        </div>
      </Card>

      {/* Detalii comunitate selectată */}
      {comunidadDetalles && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-900">Información de la Comunidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['NOMBRE O RAZON SOCIAL'] || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.NIF || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.TELEFONO || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <p className="text-sm font-semibold text-gray-900">
                  {comunidadDetalles.DIRECCION || comunidadDetalles.DIRECCIÓN || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['CODIGO POSTAL'] || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Población</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.POBLACION || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PROVINCIA || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PAIS || 'N/A'}</p>
              </div>
              {comunidadDetalles.LATITUD && comunidadDetalles.LONGITUD && (
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coordenadas GPS</label>
                  <p className="text-sm font-semibold text-gray-900">
                    {comunidadDetalles.LATITUD}, {comunidadDetalles.LONGITUD}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tabel produse */}
      {comunidadSeleccionada && (
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Permisos de Productos
                {productos.length > 0 && (
                  <span className="text-sm font-normal text-green-600 ml-2">
                    ({productos.length} productos disponibles)
                  </span>
                )}
              </h3>
              
              {/* Butoane pentru select all */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const newPermisos = { ...permisos };
                    if (!newPermisos[comunidadSeleccionada]) {
                      newPermisos[comunidadSeleccionada] = {};
                    }
                    productos.forEach(producto => {
                      newPermisos[comunidadSeleccionada][producto.id] = true;
                    });
                    setPermisos(newPermisos);
                    addToast('success', 'Permisos actualizados', 'Todos los productos han sido permitidos');
                  }}
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  ✅ Permitir Todos
                </Button>
                <Button
                  onClick={() => {
                    const newPermisos = { ...permisos };
                    if (!newPermisos[comunidadSeleccionada]) {
                      newPermisos[comunidadSeleccionada] = {};
                    }
                    productos.forEach(producto => {
                      newPermisos[comunidadSeleccionada][producto.id] = false;
                    });
                    setPermisos(newPermisos);
                    addToast('success', 'Permisos actualizados', 'Todos los productos han sido denegados');
                  }}
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  ❌ Denegar Todos
                </Button>
              </div>
            </div>
            {loadingProductos ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Cargando productos...</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Número de Artículo</th>
                      <th className="text-left p-3">Descripción de Artículo</th>
                      <th className="text-left p-3">Precio por Unidad</th>
                      <th className="text-center p-3">Permitido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.length > 0 ? (
                      productos.map(producto => (
                        <tr key={producto.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{producto.numero}</td>
                          <td className="p-3">{producto.descripcion}</td>
                          <td className="p-3">{formatMoney(producto.precio)}</td>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={obtenerPermiso(producto.id)}
                              onChange={(e) => actualizarPermiso(producto.id, e.target.checked)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          No hay productos disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6">
              <Button
                onClick={guardarPermisos}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Guardar Permisos
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ===== TAB CATÁLOGO =====
const TabCatalogo: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const { user } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    numero: '',
    descripcion: '',
    precio: 0
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState<string | null>(null);
  const [editingImageDeleted, setEditingImageDeleted] = useState<boolean>(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // Încarcă produsele din API sau demo
  useEffect(() => {
    const loadProductos = async () => {
      setLoadingProductos(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo productos data for catalog instead of fetching from backend');
        const demoProductos = getDemoProductos();
        setProductos(demoProductos);
        setLoadingProductos(false);
        return;
      }
      
      try {
        const response = await fetch(CATALOGO_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response from API');
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from API');
        }
        
        // Transformă datele din API în formatul nostru
        const productosFromAPI = Array.isArray(data) ? data : [data];
        const productosMapeados = productosFromAPI.map((producto: ProductoAPI2, index: number) => {
          // Convertește imaginea din Buffer la base64 dacă există
          let imagenBase64 = '';
          if (producto.fotoproducto && producto.fotoproducto.data && Array.isArray(producto.fotoproducto.data)) {
            imagenBase64 = bufferToBase64(producto.fotoproducto.data);
          }

          return {
            id: producto.id || index + 1,
            numero: producto['Número de artículo'] || producto.numero || producto.codigo || `PROD-${index + 1}`,
            descripcion: producto['Descripción de artículo'] || producto.descripcion || producto.nombre || 'Sin descripción',
            precio: parseFloat(producto['Precio por unidad'] || producto.precio || producto.precio_unitario || 0),
            imagen: imagenBase64 || undefined
          };
        });
        
        setProductos(productosMapeados);
        
        // Log pentru imagini
        const productosConImagen = productosMapeados.filter(p => p.imagen).length;
        console.log(`📸 Productos con imagen: ${productosConImagen}/${productosMapeados.length}`);
      } catch (error) {
        console.error('Error loading productos:', error);
        // Fallback la mock data în caz de eroare
        const productosMock: Producto[] = [
          { id: 1, numero: "A-100", descripcion: "Pintura blanca 15L", precio: 29.9 },
          { id: 2, numero: "B-220", descripcion: "Rodillo profesional", precio: 8.5 },
          { id: 3, numero: "C-330", descripcion: "Cinta carrocero 48mm", precio: 2.2 },
          { id: 4, numero: "D-010", descripcion: "Yeso rápido 20kg", precio: 7.9 },
          { id: 5, numero: "E-550", descripcion: "Brocha 4 pulgadas", precio: 12.3 },
          { id: 6, numero: "F-660", descripcion: "Lijadora orbital", precio: 45.7 }
        ];
        setProductos(productosMock);
      } finally {
        setLoadingProductos(false);
      }
    };

    loadProductos();
  }, []);

  // Filtrare produse
  const productosFiltrados = useMemo(() => {
    if (!searchTerm) return productos;
    return productos.filter(producto => 
      producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, productos]);

  // Editează produs
  const handleEditProduct = (producto: Producto) => {
    setEditingProduct(producto);
    setEditingImage(null);
    setEditingImagePreview(null);
    setEditingImageDeleted(false);
  };

  // Gestionare imagine pentru editare
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditingImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditingImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Resetează imaginea
  const resetImage = () => {
    setEditingImage(null);
    setEditingImagePreview(null);
  };

  // Gestionare imagine pentru adăugare
  const handleNewImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Resetează imaginea pentru adăugare
  const resetNewImage = () => {
    setNewImage(null);
    setNewImagePreview(null);
  };

  // Salvează modificările cu API
  const handleSaveProduct = async (updatedProduct: Producto) => {
    try {
    const payload = {
      accion: 'edit',
      id: updatedProduct.id,
      "Número de artículo": updatedProduct.numero,
      "Descripción de artículo": updatedProduct.descripcion,
      "Precio por unidad": updatedProduct.precio.toString(),
      ...(editingImagePreview && { imagen_base64: editingImagePreview }),
      ...(editingProduct.imagen && !editingImagePreview && editingImageDeleted && { eliminar_imagen: true })
    };

      console.log('📤 Payload editare:', payload);
      console.log('🖼️ Imagen incluida:', !!editingImagePreview);

      const response = await fetch(EDIT_DELETE_PRODUCT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Producto editado:', responseData);

      // Actualizează produsul local
      setProductos(prev => prev.map(p => 
        p.id === updatedProduct.id 
          ? { 
              ...updatedProduct, 
              imagen: editingImagePreview || (editingProduct.imagen && !editingImagePreview && editingImageDeleted ? undefined : p.imagen)
            }
          : p
      ));
      setEditingProduct(null);
      setEditingImageDeleted(false);
      
      // Afișează notificarea cu ID-ul din backend
      const productId = responseData.id || updatedProduct.id;
      let imageMessage = '';
      if (editingImagePreview) {
        imageMessage = ' con nueva imagen';
      } else if (editingProduct.imagen && !editingImagePreview && editingImageDeleted) {
        imageMessage = ' (imagen eliminada)';
      }
      addToast('success', 'Producto actualizado', `"${updatedProduct.numero}" (ID: ${productId}) ha sido actualizado correctamente${imageMessage}`);
    } catch (error) {
      console.error('❌ Error editing product:', error);
      addToast('error', 'Error al actualizar', 'No se pudo actualizar el producto. Inténtalo de nuevo.');
    }
  };

  // Adaugă produs nou cu API
  const handleAddProduct = async () => {
    if (!newProduct.numero || !newProduct.descripcion || newProduct.precio <= 0) {
      addToast('warning', 'Campos incompletos', 'Por favor completa todos los campos correctamente');
      return;
    }

    setAddingProduct(true);
    try {
      const payload = {
        "Número de artículo": newProduct.numero,
        "Descripción de artículo": newProduct.descripcion,
        "Precio por unidad": newProduct.precio.toString(),
        ...(newImagePreview && { imagen_base64: newImagePreview })
      };

      console.log('📤 Payload adăugare:', payload);
      console.log('🖼️ Imagen incluida:', !!newImagePreview);

      const response = await fetch(ADD_PRODUCT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Producto agregado:', responseData);

      // Adaugă produsul local în lista cu ID-ul din backend
      const backendId = responseData.id || Math.max(...productos.map(p => p.id), 0) + 1;
      const productWithId = {
        id: backendId,
        numero: newProduct.numero,
        descripcion: newProduct.descripcion,
        precio: newProduct.precio
      };
      
      setProductos(prev => [...prev, productWithId]);
      setNewProduct({ numero: '', descripcion: '', precio: 0 });
      setShowAddForm(false);
      
      const imageMessage = newImagePreview ? ' con imagen' : '';
      addToast('success', 'Producto agregado', `"${newProduct.numero}" (ID: ${backendId}) se ha agregado exitosamente al catálogo${imageMessage}`);
      
      // Opțional: Reîncarcă produsele pentru a fi sigur că avem datele cele mai recente
      // loadProductos();
    } catch (error) {
      console.error('❌ Error adding product:', error);
      addToast('error', 'Error al agregar', 'No se pudo agregar el producto. Inténtalo de nuevo.');
    } finally {
      setAddingProduct(false);
    }
  };

  // Șterge produs cu API
  const handleDeleteProduct = async (productId: number) => {
    const product = productos.find(p => p.id === productId);
    if (!product) return;

    // Confirmare pentru ștergerea produsului
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el producto "${product.descripcion}" del catálogo?`)) {
      return;
    }

    try {
      const payload = {
        accion: 'delete',
        id: productId,
        "Número de artículo": product.numero,
        "Descripción de artículo": product.descripcion,
        "Precio por unidad": product.precio.toString()
      };

      const response = await fetch(EDIT_DELETE_PRODUCT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Producto eliminado:', responseData);

      // Elimină produsul local
      setProductos(prev => prev.filter(p => p.id !== productId));
      
      // Afișează notificarea cu ID-ul din backend (dacă există)
      const deletedId = responseData.id || productId;
      addToast('success', 'Producto eliminado', `"${product.numero}" (ID: ${deletedId}) ha sido eliminado del catálogo`);
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      addToast('error', 'Error al eliminar', 'No se pudo eliminar el producto. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header cu statistici */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h2>
            <Button
              onClick={() => setShowAddForm(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <span>➕</span>
              Agregar Producto
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{productos.length}</div>
              <div className="text-sm text-blue-800">Total Productos</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{productosFiltrados.length}</div>
              <div className="text-sm text-green-800">Mostrados</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatMoney(productos.reduce((sum, p) => sum + p.precio, 0))}
              </div>
              <div className="text-sm text-purple-800">Valor Total</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Căutare și filtrare */}
      <Card>
        <div className="p-6">
          <Input
            label="Buscar productos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número o descripción..."
            className="max-w-md"
          />
        </div>
      </Card>

      {/* Lista de produse */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Productos del Catálogo</h3>
          
          {loadingProductos ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Cargando productos...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {productosFiltrados.map(producto => (
                <div key={producto.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                  {/* Imagine produs - mai mare și mai frumoasă */}
                  <div className="relative h-48 bg-gray-50">
                    {producto.imagen ? (
                      <img 
                        src={producto.imagen} 
                        alt={producto.descripcion}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                        <div className="text-center">
                          <div className="text-4xl text-gray-300 mb-2">📷</div>
                          <span className="text-gray-400 text-sm">Sin imagen</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Badge pentru preț */}
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-sm font-semibold shadow-lg">
                      {formatMoney(producto.precio)}
                    </div>
                  </div>
                  
                  {/* Conținut card */}
                  <div className="p-4">
                    {/* Número de artículo */}
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Código</span>
                      <div className="font-bold text-lg text-gray-900">{producto.numero}</div>
                    </div>
                    
                    {/* Descripción */}
                    <div className="mb-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Descripción</span>
                      <div className="text-gray-700 text-sm leading-relaxed mt-1" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {producto.descripcion}
                      </div>
                    </div>
                    
                    {/* Butoane de acțiune */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditProduct(producto)}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                      >
                        <span className="mr-1">✏️</span>
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleDeleteProduct(producto.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {productosFiltrados.length === 0 && !loadingProductos && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos en el catálogo'}
            </div>
          )}
        </div>
      </Card>

      {/* Modal pentru editare produs */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Editar Producto</h3>
            
            <div className="space-y-4">
              <Input
                label="Número de Artículo"
                value={editingProduct.numero}
                onChange={(e) => setEditingProduct({...editingProduct, numero: e.target.value})}
              />
              
              <Input
                label="Descripción"
                value={editingProduct.descripcion}
                onChange={(e) => setEditingProduct({...editingProduct, descripcion: e.target.value})}
              />
              
              <Input
                label="Precio"
                type="number"
                step="0.01"
                value={editingProduct.precio}
                onChange={(e) => setEditingProduct({...editingProduct, precio: parseFloat(e.target.value) || 0})}
              />

              {/* Câmp pentru imagine */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Imagen del Producto
                </label>
                
                {/* Afișează imaginea existentă dacă există */}
                {editingProduct.imagen && !editingImagePreview && !editingImageDeleted && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Imagen actual:</p>
                    <div className="relative inline-block">
                      <img 
                        src={editingProduct.imagen} 
                        alt={editingProduct.descripcion}
                        className="w-32 h-32 object-contain rounded-lg border-2 border-gray-200"
                      />
                      <button
                        onClick={() => {
                          setEditingImagePreview('');
                          setEditingImage(null);
                          setEditingImageDeleted(true);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white border-red-500 hover:bg-red-600 w-6 h-6 p-0 rounded-full flex items-center justify-center text-xs"
                        title="Eliminar imagen actual"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Haz clic en la X para eliminar esta imagen
                    </p>
                  </div>
                )}

                {/* Mesaj când imaginea a fost ștearsă temporar */}
                {editingImageDeleted && !editingImagePreview && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">
                      🗑️ Imagen marcada para eliminar
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      La imagen se eliminará al guardar los cambios
                    </p>
                    <button
                      onClick={() => setEditingImageDeleted(false)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Deshacer eliminación
                    </button>
                  </div>
                )}
                
                {/* Preview pentru imaginea nouă */}
                {editingImagePreview && (
                  <div className="mb-4">
                    <p className="text-sm text-green-600 mb-2">Nueva imagen:</p>
                    <div className="relative inline-block">
                      <img 
                        src={editingImagePreview} 
                        alt="Preview" 
                        className="w-32 h-32 object-contain rounded-lg border-2 border-green-200"
                      />
                      <button
                        onClick={resetImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white border-red-500 hover:bg-red-600 w-6 h-6 p-0 rounded-full flex items-center justify-center text-xs"
                        title="Cancelar nueva imagen"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Upload input */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-center"
                  >
                    {editingImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  </label>
                  {editingImage && (
                    <button
                      onClick={resetImage}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                
                <p className="text-xs text-gray-500">
                  Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 5MB
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => handleSaveProduct(editingProduct)}
                variant="primary"
                className="flex-1"
              >
                💾 Guardar
              </Button>
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setEditingImageDeleted(false);
                  resetImage();
                }}
                variant="outline"
                className="flex-1"
              >
                ❌ Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru adăugare produs */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Agregar Nuevo Producto</h3>
            
            <div className="space-y-4">
              <Input
                label="Número de Artículo"
                placeholder="Ej: A-100"
                value={newProduct.numero}
                onChange={(e) => setNewProduct({...newProduct, numero: e.target.value})}
              />
              
              <Input
                label="Descripción"
                placeholder="Descripción del producto"
                value={newProduct.descripcion}
                onChange={(e) => setNewProduct({...newProduct, descripcion: e.target.value})}
              />
              
              <Input
                label="Precio"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newProduct.precio}
                onChange={(e) => setNewProduct({...newProduct, precio: parseFloat(e.target.value) || 0})}
              />

              {/* Câmp pentru imagine */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Imagen del Producto
                </label>
                
                {/* Preview imagine */}
                {newImagePreview && (
                  <div className="relative">
                    <img 
                      src={newImagePreview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={resetNewImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Upload input */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewImageChange}
                    className="hidden"
                    id="new-image-upload"
                  />
                  <label
                    htmlFor="new-image-upload"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-center"
                  >
                    {newImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  </label>
                  {newImage && (
                    <button
                      onClick={resetNewImage}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                
                <p className="text-xs text-gray-500">
                  Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 5MB
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleAddProduct}
                variant="primary"
                className="flex-1"
                disabled={addingProduct}
              >
                {addingProduct ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Agregando...
                  </>
                ) : (
                  '➕ Agregar'
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setNewProduct({ numero: '', descripcion: '', precio: 0 });
                  resetNewImage();
                }}
                variant="outline"
                className="flex-1"
                disabled={addingProduct}
              >
                ❌ Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosPage;
