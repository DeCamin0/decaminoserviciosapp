import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContextBase';
import { useAdminApi } from '../hooks/useAdminApi';
import { routes } from '../utils/routes';
import { Link } from 'react-router-dom';
import { isDemoMode } from '../utils/demo';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';

// ===== TIPURI TYPESCRIPT =====

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

type ComunidadDetalle = {
  id?: number;
  nombre?: string;
  'NOMBRE O RAZON SOCIAL'?: string;
  NIF?: string;
  TELEFONO?: string;
  DIRECCION?: string;
  DIRECCIÓN?: string;
  'CODIGO POSTAL'?: string;
  POBLACION?: string;
  PROVINCIA?: string;
  PAIS?: string;
  LATITUD?: number | null;
  LONGITUD?: number | null;
  productos?: Producto[];
  datosCompletos?: {
    'NOMBRE O RAZON SOCIAL'?: string;
    NIF?: string;
    TELEFONO?: string;
    DIRECCION?: string;
    'CODIGO POSTAL'?: string;
    POBLACION?: string;
    PROVINCIA?: string;
    PAIS?: string;
    LATITUD?: number | null;
    LONGITUD?: number | null;
  };
  [key: string]: unknown;
};

// ===== API ENDPOINT PENTRU PRODUSE =====
// ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
const CATALOGO_API_URL = routes.getCatalogo;
const ADD_PRODUCT_API_URL = routes.addProducto;
const EDIT_DELETE_PRODUCT_API_URL = routes.editDeleteProducto;
const PERMISOS_API_URL = routes.savePermisos;

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
  const { getPermissions } = useAdminApi();
  const [activeTab, setActiveTab] = useState<'nuevo-pedido' | 'permisos' | 'catalogo'>('nuevo-pedido');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const userGrupo = useMemo(() => user?.GRUPO || user?.grupo || 'Empleado', [user?.GRUPO, user?.grupo]);

  // Helper pentru verificarea permisiunilor
  const findGrupoKey = useCallback((grupo: string, permissions: any) => {
    if (!grupo || !permissions) return null;
    const grupoStr = String(grupo).trim();
    if (permissions[grupoStr]) return grupoStr;
    const exactMatch = Object.keys(permissions).find(key => 
      key.toLowerCase() === grupoStr.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    const firstWord = grupoStr.split(/\s+/)[0];
    if (permissions[firstWord]) return firstWord;
    return null;
  }, []);

  const hasPermission = useCallback((module: string) => {
    if (!userPermissions || !userGrupo) return false;
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return false;
    const grupoPermissions = userPermissions[grupoKey];
    return grupoPermissions && grupoPermissions[module] === true;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || user?.isDemo) {
        setLoadingPermissions(false);
        return;
      }
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };
    loadPermissions();
  }, [userGrupo, user?.isDemo, getPermissions]);

  // Verifică rolul utilizatorului pentru restricționarea tab-urilor
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = user?.isManager || false;
  const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
  const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
  
  // ✅ Verifică permisiunile din backend (permissos) pentru acces complet
  const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
  const useBackendPermissions = hasBackendPermissions && !loadingPermissions;
  const grupoKeyExists = useBackendPermissions ? findGrupoKey(userGrupo, userPermissions) !== null : false;
  const shouldUseBackend = useBackendPermissions && grupoKeyExists;
  
  // Verifică permisiunea 'pedidos' din backend (DOAR 'pedidos', NU 'dashboard')
  const hasBackendPedidosPermission = shouldUseBackend ? hasPermission('pedidos') : false;
  
  // Doar managerii, adminii, developerii sau utilizatorii cu permisiunea 'pedidos' din backend pot accesa toate tab-urile
  const canAccessAllTabs = isManager || isAdmin || isDeveloper || hasBackendPedidosPermission;

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
            onClick={() => {
              // Date relevante pentru pagina de pedidos
              const tabNames = {
                'nuevo-pedido': 'Nuevo Pedido',
                'permisos': 'Permisos',
                'catalogo': 'Catálogo'
              };
              
              const pageData = {
                additionalInfo: [
                  `[TAB ACTIVO] ${tabNames[activeTab] || activeTab}`,
                  canAccessAllTabs ? '[PERMISOS] Acceso completo' : '[PERMISOS] Acceso limitado',
                ].filter(Boolean),
              };
              
              const message = buildErrorReportMessage({
                authUser: user,
                pageName: "Pedidos",
                pageData,
              });
              
              openWhatsAppErrorReport(message);
            }}
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
                  onClick={() => setActiveTab('gestionar-pedidos')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                    activeTab === 'gestionar-pedidos'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                      : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    activeTab === 'gestionar-pedidos' 
                      ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                      : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <span>Gestionar Pedidos</span>
                  </div>
                </button>
                
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
          <TabNuevoPedido addToast={addToast} canAccessAllTabs={canAccessAllTabs} />
        ) : canAccessAllTabs && activeTab === 'gestionar-pedidos' ? (
          <TabGestionarPedidos addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'permisos' ? (
          <TabPermisosComunidad addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'catalogo' ? (
          <TabCatalogo addToast={addToast} />
        ) : (
          <TabNuevoPedido addToast={addToast} canAccessAllTabs={canAccessAllTabs} />
        )}
      </div>
      
      {/* Container pentru notificări */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

// ===== TAB NUEVO PEDIDO =====
const TabNuevoPedido: React.FC<{ 
  addToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  canAccessAllTabs?: boolean;
}> = ({ addToast, canAccessAllTabs = false }) => {
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [notas, setNotas] = useState('');
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<ComunidadDetalle | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos] = useState(false);
  
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
        
        // ✅ AUTO-SELECT: Pentru angajații normali (fără permisiunea 'pedidos' pe grup), 
        // auto-selectează centrul lor de lucru
        if (!canAccessAllTabs && user) {
          const centroTrabajo = user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO;
          
          if (centroTrabajo) {
            
            // Caută comunitatea care se potrivește cu centrul de lucru
            const comunidadEncontrada = centrosFromClientes.find(com => {
              const matchExactNombre = com.nombre === centroTrabajo;
              const matchExactDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL'] === centroTrabajo;
              const matchCaseInsensitiveNombre = com.nombre?.toLowerCase() === centroTrabajo?.toLowerCase();
              const matchCaseInsensitiveDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL']?.toLowerCase() === centroTrabajo?.toLowerCase();
              
              return matchExactNombre || matchExactDatos || matchCaseInsensitiveNombre || matchCaseInsensitiveDatos;
            });
            
            if (comunidadEncontrada) {
              setComunidadSeleccionada(comunidadEncontrada.id);
              setComunidadSearchTerm(comunidadEncontrada.nombre); // ✅ Setează numele în câmp
              setComunidadDetalles({
                id: comunidadEncontrada.id,
                nombre: comunidadEncontrada.nombre,
                datosCompletos: comunidadEncontrada.datosCompletos,
                productos: []
              });
              
              // Încarcă detaliile comunității după un mic delay
              setTimeout(() => {
                handleComunidadChange(comunidadEncontrada.id);
              }, 100);
            } else {
              // Încercare căutare parțială
              const comunidadParcial = centrosFromClientes.find(com => {
                const nombre = com.nombre?.toLowerCase() || '';
                const datosNombre = com.datosCompletos?.['NOMBRE O RAZON SOCIAL']?.toLowerCase() || '';
                const centroLower = centroTrabajo?.toLowerCase() || '';
                
                return nombre.includes(centroLower) || centroLower.includes(nombre) ||
                       datosNombre.includes(centroLower) || centroLower.includes(datosNombre);
              });
              
              if (comunidadParcial) {
                setComunidadSeleccionada(comunidadParcial.id);
                setComunidadSearchTerm(comunidadParcial.nombre); // ✅ Setează numele în câmp
                setComunidadDetalles({
                  id: comunidadParcial.id,
                  nombre: comunidadParcial.nombre,
                  datosCompletos: comunidadParcial.datosCompletos,
                  productos: []
                });
                addToast('info', 'Centro encontrado parcialmente', `Se encontró una comunidad similar: "${comunidadParcial.nombre}"`);
                
                setTimeout(() => {
                  handleComunidadChange(comunidadParcial.id);
                }, 100);
              } else {
                addToast('warning', 'Centro no encontrado', `No se encontró la comunidad "${centroTrabajo}" en la lista.`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading comunidades:', error);
      } finally {
        setLoadingComunidades(false);
      }
    };

    loadComunidades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessAllTabs, user?.['CENTRO TRABAJO'], user?.CENTRO_TRABAJO, user?.CENTRO]); // Re-execută când se schimbă permisiunile sau centrul de lucru

  // ✅ Asigură-te că numele comunității este afișat în câmp când se selectează
  useEffect(() => {
    if (comunidadDetalles && comunidadDetalles.nombre && !canAccessAllTabs) {
      setComunidadSearchTerm(comunidadDetalles.nombre);
    }
  }, [comunidadDetalles, canAccessAllTabs]);

  // Nu încarcă produsele la început - doar când se selectează o comunitate
  // Produsele se vor încărca în handleComunidadChange

  // Obține datele utilizatorului conectat
  const usuarioActual = {
    id: user?.CODIGO || user?.id || 'N/A',
    nombre: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.nombre || 'Usuario',
    comunidad: user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO || 'Sin centro'
  };

  // ✅ Pentru angajații normali (fără permisiunea 'pedidos' pe grup), 
  // filtrează lista să arate doar centrul lor de lucru
  const comunidadesDisponibles = useMemo(() => {
    if (canAccessAllTabs) {
      // Managerii/Adminii pot vedea toate comunitățile
      return comunidades;
    }
    
    // Angajații normali pot vedea doar centrul lor de lucro
    const centroTrabajo = user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO;
    if (!centroTrabajo) {
      return comunidades; // Fallback: dacă nu găsește centrul, arată toate (nu ar trebui să se întâmple)
    }
    
    const comunidadDelCentro = comunidades.find(com => {
      const matchExactNombre = com.nombre === centroTrabajo;
      const matchExactDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL'] === centroTrabajo;
      const matchCaseInsensitiveNombre = com.nombre?.toLowerCase() === centroTrabajo?.toLowerCase();
      const matchCaseInsensitiveDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL']?.toLowerCase() === centroTrabajo?.toLowerCase();
      
      return matchExactNombre || matchExactDatos || matchCaseInsensitiveNombre || matchCaseInsensitiveDatos;
    });
    
    if (comunidadDelCentro) {
      return [comunidadDelCentro]; // Doar centrul lor de lucru
    }
    
    // Fallback: dacă nu găsește exact, caută parțial
    const comunidadParcial = comunidades.find(com => {
      const nombre = com.nombre?.toLowerCase() || '';
      const datosNombre = com.datosCompletos?.['NOMBRE O RAZON SOCIAL']?.toLowerCase() || '';
      const centroLower = centroTrabajo?.toLowerCase() || '';
      
      return nombre.includes(centroLower) || centroLower.includes(nombre) ||
             datosNombre.includes(centroLower) || centroLower.includes(datosNombre);
    });
    
    return comunidadParcial ? [comunidadParcial] : comunidades; // Fallback
  }, [comunidades, canAccessAllTabs, user?.['CENTRO TRABAJO'], user?.CENTRO_TRABAJO, user?.CENTRO]);

  // Flag pentru a preveni request-urile duplicate în handleComunidadChange
  const isLoadingComunidadRef = React.useRef(false);
  const lastComunidadIdRef = React.useRef<number | null>(null);
  const lastCallTimeRef = React.useRef<number>(0);

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = async (comunidadId: number) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    
    // Previne request-urile duplicate pentru aceeași comunitate sau apeluri prea rapide (< 500ms)
    if (isLoadingComunidadRef.current || (lastComunidadIdRef.current === comunidadId && timeSinceLastCall < 500)) {
      console.log('⏭️ Skipping duplicate request for comunidad:', comunidadId, 'timeSinceLastCall:', timeSinceLastCall);
      return;
    }

    isLoadingComunidadRef.current = true;
    lastComunidadIdRef.current = comunidadId;
    lastCallTimeRef.current = now;
    setComunidadSeleccionada(comunidadId);
    
    try {
      // Găsește comunitatea selectată pentru a obține numele
      const comunidad = comunidades.find(c => c.id === comunidadId);
      const nombreComunidad = comunidad?.nombre || comunidad?.['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada';
      
      // ✅ Setează numele în câmp imediat
      if (nombreComunidad && nombreComunidad !== 'Comunidad no encontrada') {
        setComunidadSearchTerm(nombreComunidad);
      }
      
      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const url = `${routes.getCatalogo}?cliente_id=${comunidadId}&cliente_nombre=${encodeURIComponent(nombreComunidad)}`;
      console.log('🌐 URL generat:', url);
      
      console.log('🚀 Making request to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Procesează răspunsul (obiect sau array de produse cu permisiuni)
      
      if (data && (Array.isArray(data) || typeof data === 'object')) {
        let productosConPermisos;
        
        // Interface pentru produs din API
        interface ProductoAPI {
          producto_id: number;
          numero_articulo: string;
          descripcion?: string;
          precio?: string | number;
          permitido?: number | boolean;
          imagen_base64?: string;
          fotoproducto?: {
            data: number[];
          };
          [key: string]: unknown; // Pentru alte proprietăți dinamic
        }

        if (Array.isArray(data)) {
          // Dacă este array, mapează toate produsele
          productosConPermisos = data.map((item: ProductoAPI) => {
            // Folosește imagen_base64 direct din backend
            let imagenBase64 = '';
            if (item.imagen_base64) {
              imagenBase64 = `data:image/jpeg;base64,${item.imagen_base64}`;
            } else if (item.fotoproducto && item.fotoproducto.data && Array.isArray(item.fotoproducto.data)) {
              imagenBase64 = bufferToBase64(item.fotoproducto.data);
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
            imagenBase64 = `data:image/jpeg;base64,${data.imagen_base64}`;
          } else if (data.fotoproducto && data.fotoproducto.data && Array.isArray(data.fotoproducto.data)) {
            imagenBase64 = bufferToBase64(data.fotoproducto.data);
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
    } finally {
      isLoadingComunidadRef.current = false;
    }
  };

  // Filtrare comunități pentru searchable dropdown (folosește comunidadesDisponibles)
  const comunidadesFiltradas = useMemo(() => {
    if (!comunidadSearchTerm) return comunidadesDisponibles.slice(0, 10); // Primele 10 dacă nu se caută
    return comunidadesDisponibles.filter(com => 
      com.nombre.toLowerCase().includes(comunidadSearchTerm.toLowerCase()) ||
      com.id.toString().includes(comunidadSearchTerm)
    ).slice(0, 20); // Maxim 20 rezultate
  }, [comunidadesDisponibles, comunidadSearchTerm]);

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
      descuento_linea: 0, // Păstrăm în structură pentru compatibilitate, dar nu se mai folosește
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
    const ivaCalculat = subtotalLinea * (linea.iva_porcentaje / 100);
    const totalLinea = subtotalLinea + ivaCalculat;
    
    return {
      subtotal: subtotalLinea,
      iva: ivaCalculat,
      total: totalLinea
    };
  };

  // Calcule finale
  const subtotal = lineasPedido.reduce((sum, linea) => {
    const calc = calcularLinea(linea);
    return sum + calc.subtotal;
  }, 0);

  // Calculează automat impuestos (IVA) din toate produsele
  const impuestosCalculados = lineasPedido.reduce((sum, linea) => {
    const calc = calcularLinea(linea);
    return sum + calc.iva;
  }, 0);

  const total = subtotal + impuestosCalculados;

  // Guardar borrador
  const guardarBorrador = async () => {
    if (!comunidadSeleccionada) {
      addToast('warning', 'Selecciona comunidad', 'Por favor selecciona una comunidad primero');
      return;
    }

    if (lineasPedido.length === 0) {
      addToast('warning', 'Sin productos', 'Por favor añade al menos un producto al pedido');
      return;
    }

    const comunidadNombre = comunidades.find(c => c.id === comunidadSeleccionada)?.nombre || 'Sin comunidad';
    const comunidadDetalle = comunidades.find(c => c.id === comunidadSeleccionada);
    
    const payload = {
      // Datele angajatului
      empleado: {
        id: usuarioActual.id,
        nombre: usuarioActual.nombre,
        email: user?.email || user?.['CORREO ELECTRONICO'] || 'N/A',
        centro_trabajo: usuarioActual.comunidad
      },
      
      // Datele comunității
      comunidad: {
        id: comunidadSeleccionada,
        nombre: comunidadNombre,
        direccion: comunidadDetalle?.datosCompletos?.DIRECCION || 'N/A',
        codigo_postal: comunidadDetalle?.datosCompletos?.['CODIGO POSTAL'] || 'N/A',
        localidad: comunidadDetalle?.datosCompletos?.LOCALIDAD || comunidadDetalle?.datosCompletos?.POBLACION || 'N/A',
        provincia: comunidadDetalle?.datosCompletos?.PROVINCIA || 'N/A',
        telefono: comunidadDetalle?.datosCompletos?.TELEFONO || 'N/A',
        email: comunidadDetalle?.datosCompletos?.EMAIL || 'N/A',
        nif: comunidadDetalle?.datosCompletos?.NIF || 'N/A',
        limite_gasto: 0
      },
      
      // Comanda cerută
      pedido: {
        fecha: new Date().toISOString(),
        moneda: 'EUR',
        descuento_global: 0,
        impuestos: impuestosCalculados,
        notas: notas,
        subtotal: subtotal,
        iva_total: impuestosCalculados,
        total: total,
        limite_excedido: false,
        exceso_limite: 0,
        estado: 'pendiente',
        items: lineasPedido.map(linea => {
          const producto = productos.find(p => p.id === linea.producto_id);
          const subtotalLinea = linea.cantidad * linea.precio_unitario;
          const ivaLinea = subtotalLinea * (linea.iva_porcentaje / 100);
          return {
            producto_id: linea.producto_id,
            numero_articulo: producto?.numero || 'N/A',
            descripcion: producto?.descripcion || 'N/A',
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal_linea: subtotalLinea,
            descuento_linea: linea.descuento_linea,
            iva_porcentaje: linea.iva_porcentaje,
            iva_linea: ivaLinea,
            total_linea: subtotalLinea + ivaLinea
          };
        })
      }
    };

    try {
      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.savePedido, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('📡 Backend response:', responseData);
        
        if (responseData.status === 'ok') {
          addToast('success', 'Pedido guardado', 
            `Pedido ${responseData.pedido_uid} guardado correctamente. Está pendiente de aprobación.`
          );
          
          // Resetează comanda după salvarea cu succes
          setLineasPedido([]);
          setNotas('');
        } else {
          addToast('warning', 'Pedido guardado con advertencias', responseData.message || 'El pedido se guardó pero con algunas advertencias.');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
    } catch (error) {
      console.error('Error guardando borrador:', error);
      addToast('error', 'Error', 'No se pudo guardar el borrador. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Informații utilizator */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Información del Pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="block text-sm font-medium text-gray-700 mb-1">Empleado</div>
              <p className="text-lg font-semibold text-gray-900">{usuarioActual.nombre}</p>
            </div>
            <div>
              <label htmlFor="comunidad-search" className="block text-sm font-medium text-gray-700 mb-1">
                Comunidad
                {!canAccessAllTabs && (
                  <span className="ml-2 text-xs text-gray-500">(Solo tu centro de trabajo)</span>
                )}
              </label>
              <div className="relative">
                <input
                  id="comunidad-search"
                  name="comunidad-search"
                  type="text"
                  placeholder={canAccessAllTabs ? "Escribe para buscar comunidad..." : "Tu centro de trabajo está seleccionado"}
                  value={comunidadSearchTerm}
                  onChange={(e) => canAccessAllTabs && setComunidadSearchTerm(e.target.value)}
                  onFocus={() => canAccessAllTabs && setShowComunidadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowComunidadDropdown(false), 200)}
                  disabled={!canAccessAllTabs}
                  readOnly={!canAccessAllTabs}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    !canAccessAllTabs ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  aria-label="Buscar comunidad"
                />
                {showComunidadDropdown && canAccessAllTabs && (
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
              <div className="block text-sm font-medium text-gray-700 mb-1">Fecha</div>
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
                <div className="block text-sm font-medium text-gray-700 mb-1">Nombre</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['NOMBRE O RAZON SOCIAL'] || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.NIF || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Teléfono</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.TELEFONO || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Dirección</div>
                <p className="text-sm font-semibold text-gray-900">
                  {comunidadDetalles.DIRECCION || comunidadDetalles.DIRECCIÓN || 'N/A'}
                </p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Código Postal</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['CODIGO POSTAL'] || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Población</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.POBLACION || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Provincia</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PROVINCIA || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">País</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PAIS || 'N/A'}</p>
              </div>
              {comunidadDetalles.LATITUD && comunidadDetalles.LONGITUD && (
                <div className="md:col-span-2 lg:col-span-3">
                  <div className="block text-sm font-medium text-gray-700 mb-1">Coordenadas GPS</div>
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
                          <label htmlFor={`cantidad-${index}`} className="sr-only">Cantidad</label>
                          <Input
                            id={`cantidad-${index}`}
                            name={`cantidad-${index}`}
                            type="number"
                            value={linea.cantidad}
                            onChange={(e) => actualizarLinea(index, 'cantidad', Number(e.target.value))}
                            className="w-20"
                            aria-label={`Cantidad para ${producto?.numero || 'producto'}`}
                          />
                        </td>
                        <td className="p-2">{formatMoney(linea.precio_unitario)}</td>
                        <td className="p-2">
                          <label htmlFor={`iva-${index}`} className="sr-only">IVA porcentaje</label>
                          <Input
                            id={`iva-${index}`}
                            name={`iva-${index}`}
                            type="number"
                            value={linea.iva_porcentaje}
                            onChange={(e) => actualizarLinea(index, 'iva_porcentaje', Number(e.target.value))}
                            className="w-16"
                            aria-label={`IVA porcentaje para ${producto?.numero || 'producto'}`}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
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
                  <span>Impuestos:</span>
                  <span>{formatMoney(impuestosCalculados)}</span>
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

// ===== TAB GESTIONAR PEDIDOS =====
const TabGestionarPedidos: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('all');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [pedidoEditando, setPedidoEditando] = useState<string | null>(null);
  const [mostrarAgregarProducto, setMostrarAgregarProducto] = useState<string | null>(null);
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([]);
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  const [searchProductoTerm, setSearchProductoTerm] = useState('');
  const [fechasEnvio, setFechasEnvio] = useState<Record<string, string>>({});
  const [mostrarPreviewEnvio, setMostrarPreviewEnvio] = useState(false);
  const [pedidosParaEnviar, setPedidosParaEnviar] = useState<any[]>([]);
  const [mostrarModalExcel, setMostrarModalExcel] = useState(false);
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null);
  const [mensajeProveedor, setMensajeProveedor] = useState('');
  const [enviandoProveedor, setEnviandoProveedor] = useState(false);
  const [mostrarModalConfirmacionEnvio, setMostrarModalConfirmacionEnvio] = useState(false);
  const [excelBlobUrl, setExcelBlobUrl] = useState<string | null>(null);
  const [generandoExcel, setGenerandoExcel] = useState(false);

  // Funcție pentru formatarea banilor
  const formatMoney = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '0,00 €';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0,00 €';
    return `${num.toFixed(2).replace('.', ',')} €`;
  };

  // Funcție pentru formatarea datei
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  // Încarcă comenzile
  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = filtroEstado !== 'all' 
        ? `${routes.getPedidos}?estado=${filtroEstado}`
        : routes.getPedidos;

      console.log('📡 [Frontend] Fetching pedidos from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📡 [Frontend] Response status:', response.status);
      console.log('📡 [Frontend] Response ok?', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 [Frontend] Pedidos loaded:', data);
      console.log('📦 [Frontend] Is array?', Array.isArray(data));
      console.log('📦 [Frontend] Data length:', Array.isArray(data) ? data.length : 'N/A');
      console.log('📦 [Frontend] Data type:', typeof data);
      
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.warn('⚠️ [Frontend] Data is object but not array, keys:', Object.keys(data));
      }
      
      setPedidos(Array.isArray(data) ? data : []);
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('⚠️ No pedidos found or invalid response format');
      }
    } catch (error) {
      console.error('❌ Error loading pedidos:', error);
      addToast('error', 'Error', 'No se pudieron cargar los pedidos.');
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, addToast]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  // Încarcă produsele pentru o comunitate specifică
  const loadProductosParaComunidad = async (comunidadId: number) => {
    setBuscandoProductos(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${routes.getCatalogo}?cliente_id=${comunidadId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const productosArray = Array.isArray(data) ? data : [data];
      
      const productosMapeados = productosArray.map((item: any) => ({
        id: item.producto_id,
        numero: item.numero_articulo,
        descripcion: item.descripcion,
        precio: parseFloat(item.precio) || 0,
        permitido: item.permitido === 1 || item.permitido === true,
      }));

      setProductosDisponibles(productosMapeados);
    } catch (error) {
      console.error('Error loading productos:', error);
      addToast('error', 'Error', 'No se pudieron cargar los productos.');
      setProductosDisponibles([]);
    } finally {
      setBuscandoProductos(false);
    }
  };

  // Adaugă un produs nou la comandă și salvează direct în baza de date
  const agregarProductoAPedido = async (pedidoUid: string, producto: Producto) => {
    const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
    if (!pedido) return;

    // Verifică dacă produsul există deja în comandă
    const productoExistente = pedido.items?.find((item: any) => item.numero_articulo === producto.numero);
    if (productoExistente) {
      addToast('warning', 'Producto ya existe', 'Este producto ya está en el pedido. Puedes modificar la cantidad.');
      return;
    }

    // Creează un nou item
    const nuevoItem = {
      numero_articulo: producto.numero,
      descripcion: producto.descripcion,
      cantidad: 1,
      precio_unitario: producto.precio,
      subtotal_linea: producto.precio,
      descuento_linea: 0,
      iva_porcentaje: 21,
      iva_linea: producto.precio * 0.21,
      total_linea: producto.precio * 1.21,
      producto_id: producto.id,
    };

    // Actualizează lista local
    const newItems = [...(pedido.items || []), nuevoItem];
    const nuevoSubtotal = newItems.reduce((sum: number, item: any) => sum + (item.subtotal_linea || 0), 0);
    const nuevoIvaTotal = newItems.reduce((sum: number, item: any) => sum + (item.iva_linea || 0), 0);
    const nuevoTotal = nuevoSubtotal + nuevoIvaTotal;

    // Salvează direct în baza de date
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('📡 [Frontend] Updating pedido items:', { pedidoUid, itemsCount: newItems.length });
      
      const response = await fetch(routes.updatePedidoItems(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          items: newItems,
          subtotal: nuevoSubtotal,
          iva_total: nuevoIvaTotal,
          total: nuevoTotal,
        }),
      });

      console.log('📡 [Frontend] Update response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Recargar pedidos pentru a obține datele actualizate din baza de date
      await loadPedidos();
      
      addToast('success', 'Producto añadido', `${producto.numero} - ${producto.descripcion} añadido y guardado en el pedido.`);
      setMostrarAgregarProducto(null);
      setSearchProductoTerm('');
    } catch (error) {
      console.error('Error adding producto to pedido:', error);
      addToast('error', 'Error', 'No se pudo guardar el producto. Inténtalo de nuevo.');
    }
  };

  // Salvează modificările făcute la o comandă (items modificate, șterse, etc.)
  const guardarCambios = async (pedidoUid: string) => {
    const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
    if (!pedido || !pedido.items) {
      addToast('error', 'Error', 'No se encontró el pedido o no tiene items.');
      return;
    }

    try {
      // Calculează totalurile din items-urile modificate
      const nuevoSubtotal = pedido.items.reduce((sum: number, item: any) => sum + (item.subtotal_linea || 0), 0);
      const nuevoIvaTotal = pedido.items.reduce((sum: number, item: any) => sum + (item.iva_linea || 0), 0);
      const nuevoTotal = nuevoSubtotal + nuevoIvaTotal;

      console.log('💾 [Frontend] Guardando cambios para pedido:', { 
        pedidoUid, 
        itemsCount: pedido.items.length,
        nuevoSubtotal,
        nuevoIvaTotal,
        nuevoTotal
      });

      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.updatePedidoItems(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          items: pedido.items,
          subtotal: nuevoSubtotal,
          iva_total: nuevoIvaTotal,
          total: nuevoTotal,
        }),
      });

      console.log('💾 [Frontend] Guardar cambios response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Recargar pedidos pentru a obține datele actualizate din baza de date
      await loadPedidos();
      
      addToast('success', 'Cambios guardados', `Los cambios del pedido ${pedidoUid} se han guardado correctamente.`);
      setPedidoEditando(null);
    } catch (error) {
      console.error('Error guardando cambios:', error);
      addToast('error', 'Error', 'No se pudieron guardar los cambios. Inténtalo de nuevo.');
    }
  };

  // Salvează doar fecha_envio fără să schimbe statusul
  const guardarFechaEnvio = async (pedidoUid: string) => {
    if (!fechasEnvio[pedidoUid]) {
      addToast('warning', 'Fecha requerida', 'Debes seleccionar una fecha de envío.');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Actualizează doar fecha_envio, păstrând statusul actual
      const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
      const estadoActual = pedido?.estado || 'pendiente';

      const response = await fetch(routes.updatePedidoEstado(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
          estado: estadoActual,
          fecha_envio: fechasEnvio[pedidoUid]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addToast('success', 'Fecha guardada', 'La fecha de envío se ha guardado correctamente.');
      
      // Recargar pedidos pentru a actualiza fecha_envio în UI
      await loadPedidos();
    } catch (error) {
      console.error('Error guardando fecha_envio:', error);
      addToast('error', 'Error', 'No se pudo guardar la fecha de envío.');
    }
  };

  // Actualizează statusul comenzii
  const updateEstado = async (pedidoUid: string, nuevoEstado: string) => {
    try {
      // Dacă se aprobă, verifică dacă există fecha_envio (fie în state, fie deja salvată în pedido)
      const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
      const tieneFechaEnvio = fechasEnvio[pedidoUid] || pedido?.fecha_envio;
      
      if (nuevoEstado === 'aprobado' && !tieneFechaEnvio) {
        addToast('warning', 'Fecha de envío requerida', 'Debes seleccionar y guardar una fecha de envío antes de aprobar el pedido.');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body: { estado: string; fecha_envio?: string } = { estado: nuevoEstado };
      // Folosește fecha_envio din state dacă există, altfel folosește cea salvată în pedido
      if (fechasEnvio[pedidoUid]) {
        body.fecha_envio = fechasEnvio[pedidoUid];
      } else if (pedido?.fecha_envio) {
        body.fecha_envio = new Date(pedido.fecha_envio).toISOString();
      }

      const response = await fetch(routes.updatePedidoEstado(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const estadoTexto = nuevoEstado === 'aprobado' ? 'aprobado' : nuevoEstado === 'rechazado' ? 'rechazado' : 'pendiente';
      addToast('success', 'Estado actualizado', `El pedido ha sido ${estadoTexto} correctamente.`);
      
      // Șterge fecha_envio din state dacă s-a salvat cu succes
      if (fechasEnvio[pedidoUid]) {
        setFechasEnvio(prev => {
          const newState = { ...prev };
          delete newState[pedidoUid];
          return newState;
        });
      }
      
      // Recargar pedidos
      await loadPedidos();
    } catch (error) {
      console.error('Error updating estado:', error);
      addToast('error', 'Error', 'No se pudo actualizar el estado del pedido.');
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'enviado':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return '✅ Aprobado';
      case 'rechazado':
        return '❌ Rechazado';
      case 'pendiente':
        return '⏳ Pendiente';
      case 'enviado':
        return '📦 Enviado';
      default:
        return estado;
    }
  };

  // Deschide modalul de preview pentru comenzile aprobate
  const abrirPreviewEnvio = () => {
    const pedidosAprobados = pedidos.filter(p => p.estado === 'aprobado');
    
    if (pedidosAprobados.length === 0) {
      addToast('info', 'Sin pedidos aprobados', 'No hay pedidos aprobados para enviar.');
      return;
    }

    setPedidosParaEnviar(pedidosAprobados);
    setMostrarPreviewEnvio(true);
  };

  // Generează Excel-ul și deschide modalul pentru preview și trimitere
  const confirmarEnvioPedidos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('📤 [Frontend] Generando Excel para:', pedidosParaEnviar.length, 'pedidos');

      // Generează Excel-ul (fără să marcheze ca enviado încă)
      const response = await fetch(routes.generarExcelPedidos, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pedidos: pedidosParaEnviar.map(p => p.pedido_uid)
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Verifică dacă răspunsul este Excel (blob)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const blob = await response.blob();
        setExcelBlob(blob);
        
        // Închide modalul de preview și deschide modalul Excel
        setMostrarPreviewEnvio(false);
        setMostrarModalExcel(true);
      } else {
        throw new Error('Respuesta no es un archivo Excel válido');
      }
    } catch (error) {
      console.error('Error generando Excel:', error);
      addToast('error', 'Error', 'No se pudo generar el Excel. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Descarcă Excel-ul
  const descargarExcel = () => {
    if (!excelBlob) return;
    
    const url = window.URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    a.download = `PEDIDOS ${fecha}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    addToast('success', 'Excel descargado', 'El archivo Excel ha sido descargado correctamente.');
  };

  // Trimite mesajul la provider și marchează comenzile ca enviado
  const enviarProveedor = async () => {
    if (!excelBlob) return;

    try {
      setEnviandoProveedor(true);
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('📤 [Frontend] Enviando a proveedor:', pedidosParaEnviar.length, 'pedidos', mensajeProveedor ? 'con mensaje' : 'sin mensaje');

      // Trimite mesajul și marchează comenzile ca enviado
      const response = await fetch(routes.enviarPedidosAprobados, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pedidos: pedidosParaEnviar.map(p => p.pedido_uid),
          mensaje: mensajeProveedor.trim() || undefined,
          enviarProveedor: true
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [Frontend] Pedidos enviados a proveedor:', result);

      addToast('success', 'Pedidos enviados', `${result.enviados || pedidosParaEnviar.length} pedido(s) han sido enviados al proveedor${mensajeProveedor.trim() ? ' con mensaje' : ''} y marcados como "enviado".`);
      
      // Închide modalul și resetează state-ul
      setMostrarModalExcel(false);
      if (excelBlob) {
        window.URL.revokeObjectURL(window.URL.createObjectURL(excelBlob));
      }
      setExcelBlob(null);
      setMensajeProveedor('');
      setPedidosParaEnviar([]);
      
      // Recargar pedidos pentru a actualiza statusurile
      await loadPedidos();
    } catch (error) {
      console.error('Error enviando a proveedor:', error);
      addToast('error', 'Error', 'No se pudieron enviar los pedidos al proveedor. Inténtalo de nuevo.');
    } finally {
      setEnviandoProveedor(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtre și header */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Gestionar Pedidos</h2>
            
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm font-medium text-gray-700">Filtrar por estado:</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="aprobado">Aprobados</option>
                <option value="rechazado">Rechazados</option>
                <option value="enviado">Enviados</option>
              </select>
              
              <Button
                onClick={loadPedidos}
                variant="primary"
                disabled={loading}
              >
                {loading ? '🔄 Cargando...' : '🔄 Actualizar'}
              </Button>

              {pedidos.filter(p => p.estado === 'aprobado').length > 0 && (
                <Button
                  onClick={abrirPreviewEnvio}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading}
                  title="Ver preview y enviar todas las órdenes aprobadas. Se generará un Excel y se marcarán como 'enviado'."
                >
                  📤 Enviar Todos los Aprobados ({pedidos.filter(p => p.estado === 'aprobado').length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de pedidos */}
      {loading ? (
        <Card>
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando pedidos...</p>
          </div>
        </Card>
      ) : pedidos.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay pedidos</h3>
            <p className="text-gray-500">No se encontraron pedidos con los filtros seleccionados.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => (
            <Card key={pedido.pedido_uid} className="overflow-hidden">
              <div className="p-6">
                {/* Header del pedido */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4 pb-4 border-b">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-800">Pedido: {pedido.pedido_uid}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(pedido.estado)}`}>
                        {getEstadoTexto(pedido.estado)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div><strong>Empleado:</strong> {pedido.empleado?.nombre || 'N/A'}</div>
                      <div><strong>Comunidad:</strong> {pedido.comunidad?.nombre || 'N/A'}</div>
                      <div><strong>Fecha:</strong> {formatDate(pedido.fecha)}</div>
                      <div><strong>Total:</strong> <span className="font-bold text-purple-600">{formatMoney(pedido.total)}</span></div>
                      {pedido.fecha_envio && (
                        <div><strong>Fecha de Envío:</strong> {formatDate(pedido.fecha_envio)}</div>
                      )}
                    </div>
                    {pedido.notas && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Notas:</strong> {pedido.notas}
                      </div>
                    )}
                  </div>
                  
                  {/* Butoane de acțiune */}
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => {
                        setPedidoEditando(pedidoEditando === pedido.pedido_uid ? null : pedido.pedido_uid);
                        // Deschide și detaliile dacă nu sunt deja deschise
                        if (pedidoSeleccionado !== pedido.pedido_uid) {
                          setPedidoSeleccionado(pedido.pedido_uid);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      {pedidoEditando === pedido.pedido_uid ? '❌ Cancelar Edición' : '✏️ Editar'}
                    </Button>
                    {pedido.estado === 'pendiente' && (
                      <>
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Fecha de Envío:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="datetime-local"
                              value={fechasEnvio[pedido.pedido_uid] || pedido.fecha_envio ? new Date(pedido.fecha_envio).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                setFechasEnvio(prev => ({
                                  ...prev,
                                  [pedido.pedido_uid]: e.target.value
                                }));
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              min={new Date().toISOString().slice(0, 16)}
                            />
                            <Button
                              onClick={() => guardarFechaEnvio(pedido.pedido_uid)}
                              className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
                              size="sm"
                              disabled={!fechasEnvio[pedido.pedido_uid] && !pedido.fecha_envio}
                            >
                              💾 Guardar
                            </Button>
                          </div>
                        </div>
                        <Button
                          onClick={() => updateEstado(pedido.pedido_uid, 'aprobado')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          ✅ Aprobar
                        </Button>
                        <Button
                          onClick={() => updateEstado(pedido.pedido_uid, 'rechazado')}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          size="sm"
                        >
                          ❌ Rechazar
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={() => setPedidoSeleccionado(
                        pedidoSeleccionado === pedido.pedido_uid ? null : pedido.pedido_uid
                      )}
                      variant="outline"
                      size="sm"
                    >
                      {pedidoSeleccionado === pedido.pedido_uid ? '👁️ Ocultar' : '👁️ Ver Detalles'}
                    </Button>
                  </div>
                </div>

                {/* Detalii produse (expandable) */}
                {pedidoSeleccionado === pedido.pedido_uid && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-700">Productos ({pedido.num_items || pedido.items?.length || 0}):</h4>
                      {pedidoEditando === pedido.pedido_uid && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setMostrarAgregarProducto(mostrarAgregarProducto === pedido.pedido_uid ? null : pedido.pedido_uid);
                              if (mostrarAgregarProducto !== pedido.pedido_uid && pedido.comunidad?.id) {
                                loadProductosParaComunidad(pedido.comunidad.id);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            ➕ Añadir Producto
                          </Button>
                          <Button
                            onClick={() => guardarCambios(pedido.pedido_uid)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            💾 Guardar Cambios
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Formular pentru adăugare produs nou */}
                    {pedidoEditando === pedido.pedido_uid && mostrarAgregarProducto === pedido.pedido_uid && (
                      <Card className="mb-4 bg-blue-50 border-blue-200">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-700">Añadir Nuevo Producto</h5>
                            <Button
                              onClick={() => setMostrarAgregarProducto(null)}
                              variant="outline"
                              size="sm"
                            >
                              ✕ Cerrar
                            </Button>
                          </div>
                          <Input
                            label="Buscar producto por número o descripción"
                            value={searchProductoTerm}
                            onChange={(e) => setSearchProductoTerm(e.target.value)}
                            placeholder="Ej: 70000123 o AMBIENTADOR"
                            className="mb-3"
                          />
                          {buscandoProductos ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Buscando productos...</p>
                            </div>
                          ) : productosDisponibles.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto border rounded-lg bg-white">
                              {productosDisponibles
                                .filter(p => 
                                  !searchProductoTerm || 
                                  p.numero.toLowerCase().includes(searchProductoTerm.toLowerCase()) ||
                                  p.descripcion.toLowerCase().includes(searchProductoTerm.toLowerCase())
                                )
                                .map(producto => (
                                  <div 
                                    key={producto.id} 
                                    className="flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer"
                                    onClick={() => agregarProductoAPedido(pedido.pedido_uid, producto)}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{producto.numero}</div>
                                      <div className="text-sm text-gray-600">{producto.descripcion}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-semibold text-blue-600">{formatMoney(producto.precio)}</div>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          agregarProductoAPedido(pedido.pedido_uid, producto);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white mt-1"
                                        size="sm"
                                      >
                                        ➕ Añadir
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              No se encontraron productos. Asegúrate de que la comunidad tenga productos asignados.
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2">Artículo</th>
                            <th className="text-left p-2">Descripción</th>
                            <th className="text-right p-2">Cantidad</th>
                            <th className="text-right p-2">Precio Unit.</th>
                            <th className="text-right p-2">Subtotal</th>
                            <th className="text-right p-2">IVA</th>
                            <th className="text-right p-2">Total</th>
                            <th className="text-left p-2">Fecha de Envío</th>
                            {pedidoEditando === pedido.pedido_uid && (
                              <th className="text-center p-2">Acción</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items?.map((item: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{item.numero_articulo}</td>
                              <td className="p-2">{item.descripcion}</td>
                              <td className="p-2 text-right">
                                {pedidoEditando === pedido.pedido_uid ? (
                                  <Input
                                    type="number"
                                    value={item.cantidad}
                                    onChange={(e) => {
                                      // TODO: Actualizar cantidad en el estado
                                      const newItems = [...pedido.items];
                                      newItems[index].cantidad = parseFloat(e.target.value) || 0;
                                      // Recalcular subtotal, IVA și total pentru acest item
                                      const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                      const iva = subtotal * 0.21;
                                      newItems[index].subtotal_linea = subtotal;
                                      newItems[index].iva_linea = iva;
                                      newItems[index].total_linea = subtotal + iva;
                                      
                                      // Actualizar pedido în lista
                                      const updatedPedidos = pedidos.map(p => 
                                        p.pedido_uid === pedido.pedido_uid 
                                          ? { ...p, items: newItems }
                                          : p
                                      );
                                      setPedidos(updatedPedidos);
                                    }}
                                    className="w-20 text-right"
                                    min="0"
                                    step="0.01"
                                  />
                                ) : (
                                  item.cantidad
                                )}
                              </td>
                              <td className="p-2 text-right">
                                {pedidoEditando === pedido.pedido_uid ? (
                                  <Input
                                    type="number"
                                    value={item.precio_unitario}
                                    onChange={(e) => {
                                      // TODO: Actualizar precio en el estado
                                      const newItems = [...pedido.items];
                                      newItems[index].precio_unitario = parseFloat(e.target.value) || 0;
                                      // Recalcular subtotal, IVA și total pentru acest item
                                      const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                      const iva = subtotal * 0.21;
                                      newItems[index].subtotal_linea = subtotal;
                                      newItems[index].iva_linea = iva;
                                      newItems[index].total_linea = subtotal + iva;
                                      
                                      // Actualizar pedido în lista
                                      const updatedPedidos = pedidos.map(p => 
                                        p.pedido_uid === pedido.pedido_uid 
                                          ? { ...p, items: newItems }
                                          : p
                                      );
                                      setPedidos(updatedPedidos);
                                    }}
                                    className="w-24 text-right"
                                    min="0"
                                    step="0.01"
                                  />
                                ) : (
                                  formatMoney(item.precio_unitario)
                                )}
                              </td>
                              <td className="p-2 text-right">{formatMoney(item.subtotal_linea)}</td>
                              <td className="p-2 text-right">{formatMoney(item.iva_linea)}</td>
                              <td className="p-2 text-right font-semibold">{formatMoney(item.total_linea)}</td>
                              <td className="p-2 text-left">
                                {pedido.fecha_envio ? formatDate(pedido.fecha_envio) : 'No asignada'}
                              </td>
                              {pedidoEditando === pedido.pedido_uid && (
                                <td className="p-2 text-center">
                                  <Button
                                    onClick={() => {
                                      // Eliminar item
                                      const newItems = pedido.items.filter((_: any, i: number) => i !== index);
                                      const updatedPedidos = pedidos.map(p => 
                                        p.pedido_uid === pedido.pedido_uid 
                                          ? { ...p, items: newItems, num_items: newItems.length }
                                          : p
                                      );
                                      setPedidos(updatedPedidos);
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    size="sm"
                                  >
                                    🗑️
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={4} className="p-2 text-right">Total:</td>
                            <td className="p-2 text-right">
                              {formatMoney(pedido.items?.reduce((sum: number, item: any) => sum + (item.subtotal_linea || 0), 0) || pedido.subtotal)}
                            </td>
                            <td className="p-2 text-right">
                              {formatMoney(pedido.items?.reduce((sum: number, item: any) => sum + (item.iva_linea || 0), 0) || pedido.iva_total)}
                            </td>
                            <td className="p-2 text-right text-purple-600">
                              {formatMoney(pedido.items?.reduce((sum: number, item: any) => sum + (item.total_linea || 0), 0) || pedido.total)}
                            </td>
                            <td></td>
                            {pedidoEditando === pedido.pedido_uid && <td></td>}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Preview pentru Envio */}
      {mostrarPreviewEnvio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                Preview - Enviar Pedidos Aprobados ({pedidosParaEnviar.length})
              </h2>
              <Button
                onClick={() => {
                  setMostrarPreviewEnvio(false);
                  setPedidosParaEnviar([]);
                }}
                variant="outline"
                size="sm"
              >
                ✕ Cerrar
              </Button>
            </div>

            {/* Preview pentru fiecare comandă */}
            <div className="flex-1 overflow-y-auto">
              {pedidosParaEnviar.map((pedido, index) => (
                <div key={pedido.pedido_uid} className="mb-6 border-b pb-6 last:border-b-0">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {pedido.comunidad?.nombre || `Pedido ${index + 1}`}
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div><strong>Pedido UID:</strong> {pedido.pedido_uid}</div>
                      <div><strong>Empleado:</strong> {pedido.empleado?.nombre || 'N/A'}</div>
                      <div><strong>Fecha:</strong> {formatDate(pedido.fecha)}</div>
                      <div><strong>Fecha Envío:</strong> {formatDate(pedido.fecha_envio) || 'No asignada'}</div>
                      <div><strong>Total:</strong> {formatMoney(pedido.total)}</div>
                      <div><strong>Items:</strong> {pedido.items?.length || 0}</div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-200">
                            <th className="border p-2 text-left">Nº Artículo</th>
                            <th className="border p-2 text-left">Descripción</th>
                            <th className="border p-2 text-right">Cantidad</th>
                            <th className="border p-2 text-right">Precio Unit.</th>
                            <th className="border p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items?.map((item: any, itemIndex: number) => (
                            <tr key={itemIndex}>
                              <td className="border p-2">{item.numero_articulo}</td>
                              <td className="border p-2">{item.descripcion}</td>
                              <td className="border p-2 text-right">{item.cantidad}</td>
                              <td className="border p-2 text-right">{formatMoney(item.precio_unitario)}</td>
                              <td className="border p-2 text-right">{formatMoney(item.total_linea)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-semibold">
                            <td colSpan={4} className="border p-2 text-right">Total:</td>
                            <td className="border p-2 text-right">{formatMoney(pedido.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Butoane de acțiune */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
              <Button
                onClick={() => {
                  setMostrarPreviewEnvio(false);
                  setPedidosParaEnviar([]);
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarEnvioPedidos}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={loading}
              >
                {loading ? '⏳ Enviando...' : '📤 Enviar y Generar Excel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru Excel și trimitere la provider */}
      {mostrarModalExcel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                Excel Generado - Enviar a Proveedor
              </h2>
              <Button
                onClick={() => {
                  setMostrarModalExcel(false);
                  setExcelBlob(null);
                  setMensajeProveedor('');
                }}
                variant="outline"
                size="sm"
              >
                ✕ Cerrar
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold mb-2">Resumen:</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>Pedidos:</strong> {pedidosParaEnviar.length}</li>
                  <li><strong>Total items:</strong> {pedidosParaEnviar.reduce((sum, p) => sum + (p.items?.length || 0), 0)}</li>
                  <li><strong>Total valor:</strong> {formatMoney(pedidosParaEnviar.reduce((sum, p) => sum + (p.total || 0), 0))}</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje para el proveedor (opcional):
                </label>
                <textarea
                  value={mensajeProveedor}
                  onChange={(e) => setMensajeProveedor(e.target.value)}
                  placeholder="Escribe un mensaje que se enviará junto con el pedido al proveedor..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={4}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>📋 Nota:</strong> El Excel ha sido generado con éxito. Puedes descargarlo para verificar antes de enviarlo al proveedor.
                  {mensajeProveedor && (
                    <span className="block mt-2">
                      <strong>Mensaje que se enviará:</strong> "{mensajeProveedor}"
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Butoane de acțiune */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                onClick={descargarExcel}
                variant="outline"
                disabled={!excelBlob}
              >
                📥 Descargar Excel
              </Button>
              <Button
                onClick={() => {
                  setMostrarModalExcel(false);
                  setExcelBlob(null);
                  setMensajeProveedor('');
                  setMostrarPreviewEnvio(true);
                }}
                variant="outline"
              >
                ← Volver
              </Button>
              <Button
                onClick={enviarProveedor}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={enviandoProveedor || !excelBlob}
              >
                {enviandoProveedor ? '⏳ Enviando...' : '📤 Enviar a Proveedor y Marcar como Enviado'}
              </Button>
            </div>
          </div>
        </div>
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
  const [, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<ComunidadDetalle | null>(null);
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
      } catch (error) {
        console.error('Error loading comunidades:', error);
      } finally {
        setLoadingComunidades(false);
      }
    };

    loadComunidades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Execută doar o dată la mount

  // Flag pentru a preveni request-urile duplicate
  const isLoadingRef = React.useRef(false);
  const productosLoadedRef = React.useRef(false);

  // Încarcă produsele din API sau demo
  useEffect(() => {
    // Previne request-urile duplicate
    if (isLoadingRef.current || productosLoadedRef.current) {
      return;
    }

    const loadProductos = async () => {
      isLoadingRef.current = true;
      setLoadingProductos(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo productos data instead of fetching from backend');
        const demoProductos = getDemoProductos();
        setProductos(demoProductos);
        setLoadingProductos(false);
        isLoadingRef.current = false;
        productosLoadedRef.current = true;
        return;
      }
      
      try {
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(CATALOGO_API_URL, {
          method: 'GET',
          headers
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ✅ Backend-ul returnează deja datele în formatul corect (id, numero, descripcion, precio, imagen)
        // Nu mai trebuie să facem conversie de buffer, backend-ul returnează deja base64
        const productosMapeados = Array.isArray(data) ? data : [data];
        
        setProductos(productosMapeados);
        productosLoadedRef.current = true;
        
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
        productosLoadedRef.current = true;
      } finally {
        setLoadingProductos(false);
        isLoadingRef.current = false;
      }
    };

    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flag pentru a preveni request-urile duplicate în handleComunidadChange
  const isLoadingComunidadRef = React.useRef(false);
  const lastComunidadIdRef = React.useRef<number | null>(null);

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = async (comunidadId: number) => {
    // Previne request-urile duplicate pentru aceeași comunitate
    if (isLoadingComunidadRef.current || lastComunidadIdRef.current === comunidadId) {
      console.log('⏭️ Skipping duplicate request for comunidad:', comunidadId);
      return;
    }

    isLoadingComunidadRef.current = true;
    lastComunidadIdRef.current = comunidadId;
    setComunidadSeleccionada(comunidadId);
    
    try {
      // Găsește comunitatea selectată pentru a obține numele
      const comunidad = comunidades.find(c => c.id === comunidadId);
      const nombreComunidad = comunidad?.nombre || comunidad?.['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada';
      
      
      // Construiește URL-ul pentru încărcarea permisiunilor
      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const url = `${routes.getCatalogo}?cliente_id=${comunidadId}&cliente_nombre=${encodeURIComponent(nombreComunidad)}`;
      console.log('🌐 URL permisos:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
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
          [key: string]: unknown; // Pentru alte proprietăți dinamic
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
    } finally {
      isLoadingComunidadRef.current = false;
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
  const obtenerPermiso = useCallback((productoId: number): boolean => {
    if (!comunidadSeleccionada) return false;
    const permiso = permisos[comunidadSeleccionada]?.[productoId] || false;
    return permiso;
  }, [comunidadSeleccionada, permisos]);

  // Contorizare produse permise
  const productosPermitidos = useMemo(() => {
    if (!comunidadSeleccionada) return 0;
    return productos.filter(producto => obtenerPermiso(producto.id)).length;
  }, [comunidadSeleccionada, productos, obtenerPermiso]);

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

      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(PERMISOS_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

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
              <label htmlFor="comunidad-search-permisos" className="block text-sm font-medium text-gray-700 mb-1">Comunidad / Centro de Trabajo</label>
              <div className="relative">
                <input
                  id="comunidad-search-permisos"
                  name="comunidad-search-permisos"
                  type="text"
                  placeholder="Escribe para buscar comunidad..."
                  value={comunidadSearchTerm}
                  onChange={(e) => setComunidadSearchTerm(e.target.value)}
                  onFocus={() => setShowComunidadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowComunidadDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Buscar comunidad para permisos"
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
                <div className="block text-sm font-medium text-gray-700 mb-1">Nombre</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['NOMBRE O RAZON SOCIAL'] || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.NIF || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Teléfono</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.TELEFONO || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Dirección</div>
                <p className="text-sm font-semibold text-gray-900">
                  {comunidadDetalles.DIRECCION || comunidadDetalles.DIRECCIÓN || 'N/A'}
                </p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Código Postal</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles['CODIGO POSTAL'] || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Población</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.POBLACION || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Provincia</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PROVINCIA || 'N/A'}</p>
              </div>
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">País</div>
                <p className="text-sm font-semibold text-gray-900">{comunidadDetalles.PAIS || 'N/A'}</p>
              </div>
              {comunidadDetalles.LATITUD && comunidadDetalles.LONGITUD && (
                <div className="md:col-span-2 lg:col-span-3">
                  <div className="block text-sm font-medium text-gray-700 mb-1">Coordenadas GPS</div>
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
                            <label htmlFor={`permiso-${producto.id}`} className="sr-only">
                              Permitido para {producto.numero}
                            </label>
                            <input
                              id={`permiso-${producto.id}`}
                              name={`permiso-${producto.id}`}
                              type="checkbox"
                              checked={obtenerPermiso(producto.id)}
                              onChange={(e) => actualizarPermiso(producto.id, e.target.checked)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              aria-label={`Permitido para ${producto.numero} - ${producto.descripcion}`}
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

  // Flag pentru a preveni request-urile duplicate
  const isLoadingRef = React.useRef(false);
  const productosLoadedRef = React.useRef(false);

  // Încarcă produsele din API sau demo
  useEffect(() => {
    // Previne request-urile duplicate
    if (isLoadingRef.current || productosLoadedRef.current) {
      return;
    }

    const loadProductos = async () => {
      isLoadingRef.current = true;
      setLoadingProductos(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo productos data for catalog instead of fetching from backend');
        const demoProductos = getDemoProductos();
        setProductos(demoProductos);
        setLoadingProductos(false);
        isLoadingRef.current = false;
        productosLoadedRef.current = true;
        return;
      }
      
      try {
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(CATALOGO_API_URL, {
          method: 'GET',
          headers
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ✅ Backend-ul returnează deja datele în formatul corect (id, numero, descripcion, precio, imagen)
        // Nu mai trebuie să facem conversie de buffer, backend-ul returnează deja base64
        const productosMapeados = Array.isArray(data) ? data : [data];
        
        setProductos(productosMapeados);
        productosLoadedRef.current = true;
        
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
        productosLoadedRef.current = true;
      } finally {
        setLoadingProductos(false);
        isLoadingRef.current = false;
      }
    };

    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(EDIT_DELETE_PRODUCT_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

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

      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(ADD_PRODUCT_API_URL, {
        method: 'POST',
        headers,
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

      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(EDIT_DELETE_PRODUCT_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

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
                    name="image-upload"
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
                    name="new-image-upload"
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
