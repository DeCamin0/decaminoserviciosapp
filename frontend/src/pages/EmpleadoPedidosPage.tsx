import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, Input } from '../components/ui';
import {
  ProductListItem,
  StickyCartBar,
  RecentPedidoProducts,
  ReviewPedidoScreen,
  extractRecentProductIdsFromPedidos,
  sumQtyForProduct,
  lineasAfterSetProductQty,
  type PedidoCatalogProduct,
} from '../components/pedidos';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { config } from '../config/env';
import heic2any from 'heic2any';

// Funcție pentru a converti Buffer la base64
const bufferToBase64 = (bufferData: number[]): string => {
  try {
    // Convert array of numbers to Uint8Array, then to base64
    const uint8Array = new Uint8Array(bufferData);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting buffer to base64:', error);
    return '';
  }
};

// ===== TIPURI TYPESCRIPT =====
type Usuario = {
  id: string;
  nombre: string;
  comunidad: string;
};

type PedidosNotasImagen = {
  id: number;
  nota_id: number;
  nombre_archivo: string;
  ruta_archivo: string;
  tipo_mime?: string | null;
  tamano_bytes?: number | null;
  orden: number;
  creado_en: string;
};

type PedidosNota = {
  id: number;
  titulo?: string | null;
  contenido: string;
  creado_por?: string | null;
  creado_en: string;
  actualizado_en: string;
  activo: boolean;
  imagenes?: PedidosNotasImagen[];
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
  'NOMBRE O RAZON SOCIAL'?: string;
};

type ComunidadDetalle = {
  id?: number;
  nombre?: string;
  'NOMBRE O RAZON SOCIAL'?: string;
  [key: string]: unknown;
};

type ProductoApiItem = {
  producto_id?: number;
  numero_articulo?: string;
  descripcion?: string;
  precio?: string | number;
  permitido?: number | boolean | string;
  imagen_base64?: string;
  fotoproducto?: {
    data?: number[];
  };
  [key: string]: unknown;
};

type LineaPedido = {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  iva_porcentaje: number;
  numero_articulo?: string;
  descripcion?: string;
  subtotal_linea?: number;
  iva_linea?: number;
  total_linea?: number;
};

function parseLimiteGastoCliente(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Igual que al guardar: fusiona líneas existentes con productos nuevos (suma cantidades si coincide). */
function mergePedidoItemsConProductosNuevos(
  itemsExistentesIn: LineaPedido[],
  productosNuevos: LineaPedido[],
): LineaPedido[] {
  const itemsExistentes: LineaPedido[] = itemsExistentesIn.map((i) => ({ ...i }));
  const itemsNuevosSinDuplicados: LineaPedido[] = [];
  productosNuevos.forEach((productoNuevo: LineaPedido) => {
    const productoId = productoNuevo.producto_id;
    const numeroArticulo = productoNuevo.numero_articulo;
    const itemExistenteIndex = itemsExistentes.findIndex(
      (item: LineaPedido) =>
        (item.producto_id === productoId || item.numero_articulo === numeroArticulo) &&
        (productoId || numeroArticulo),
    );
    if (itemExistenteIndex >= 0) {
      const itemExistente = itemsExistentes[itemExistenteIndex];
      itemExistente.cantidad = (itemExistente.cantidad || 0) + (productoNuevo.cantidad || 1);
      itemExistente.subtotal_linea = itemExistente.precio_unitario * itemExistente.cantidad;
      itemExistente.iva_linea = itemExistente.subtotal_linea * 0.21;
      itemExistente.total_linea = itemExistente.subtotal_linea + itemExistente.iva_linea;
    } else {
      itemsNuevosSinDuplicados.push(productoNuevo);
    }
  });
  return [...itemsExistentes, ...itemsNuevosSinDuplicados];
}

function subtotalPedidoItemsSinIva(items: LineaPedido[]): number {
  const s = items.reduce(
    (sum, item) =>
      sum +
      (item.subtotal_linea != null && !Number.isNaN(item.subtotal_linea)
        ? item.subtotal_linea
        : item.cantidad * item.precio_unitario),
    0,
  );
  return Math.round(s * 100) / 100;
}

type Pedido = {
  pedido_uid: string;
  empleado?: {
    id?: string;
    nombre?: string;
    email?: string;
  };
  comunidad?: {
    id?: number | string;
    nombre?: string;
    direccion?: string;
    codigo_postal?: string;
    localidad?: string;
    provincia?: string;
    telefono?: string;
    limite_gasto?: number | null;
  };
  fecha?: string;
  estado?: string;
  items?: LineaPedido[];
  fecha_envio?: string;
  aprobado_por?: string;
  aprobado_en?: string;
  rechazado_por?: string;
  rechazado_en?: string;
  notas?: string;
  [key: string]: unknown;
};

type HorarioData = {
  days?: {
    [key: string]: {
      in1?: string;
      out1?: string;
      in2?: string;
      out2?: string;
      in3?: string;
      out3?: string;
    };
  };
  centroNombre?: string;
  grupoNombre?: string;
  [key: string]: unknown;
};

type CuadranteData = {
  LUNA?: number | string;
  luna?: number | string;
  CODIGO?: string;
  codigo?: string;
  [key: string]: unknown;
};

// ===== API ENDPOINT PENTRU PRODUSE =====
// ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
// const CATALOGO_API_URL = routes.getCatalogo; // Folosit direct routes.getCatalogo

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
    }, toast.duration || 3000); // Default 3 secunde

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-500 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-500 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-500 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-500 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-500 text-gray-800';
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
      className={`p-4 rounded-lg shadow-lg max-w-sm border-l-4 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      } ${getToastStyles()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <span className="text-lg mr-2">{getIcon()}</span>
          <div>
            <h4 className="font-semibold">{toast.title}</h4>
            <p className="text-sm mt-1">{toast.message}</p>
          </div>
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onClose: (id: string) => void }> = ({ toasts, onClose }) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] flex flex-col items-stretch gap-2 p-4 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] max-md:items-center md:inset-x-auto md:bottom-auto md:left-auto md:right-4 md:top-4 md:max-w-sm md:pb-4 md:pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 md:ml-auto">
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
};

// ===== FUNCȚII UTILITARE =====
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("es-ES", {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

// ===== COMPONENTA PRINCIPAL =====
const EmpleadoPedidosPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'nuevo-pedido' | 'mis-pedidos'>('mis-pedidos'); // Default la "Mis Pedidos"
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasDerechoPedidos, setHasDerechoPedidos] = useState(false);

  // Counter pentru a asigura ID-uri unice pentru toasts
  const toastIdCounter = React.useRef(0);

  // Funcție pentru verificarea câmpului DerechoPedidos
  const checkField = (value: string | number | boolean | null | undefined): boolean => {
    if (!value) return false;
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (typeof normalized === 'boolean') return normalized;
    if (typeof normalized === 'number') return normalized === 1;
    if (typeof normalized === 'string') {
      return ['s', 'si', 'sí', '1', 'y', 'yes', 'true'].includes(normalized);
    }
    return false;
  };

  // Încarcă datele complete ale utilizatorului pentru a verifica DerechoPedidos
  useEffect(() => {
    const fetchEmpleadoCompleto = async () => {
      if (!user?.CODIGO && !user?.email) {
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return;
        }

        const res = await fetch(routes.getEmpleadoMe, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const empleado = data?.empleado || data?.data?.empleado || data;
          if (empleado) {
            // Verifică DerechoPedidos
            const pedidosFields = [
              'derechopedido',
              'DerechoPedidos',
              'derechoPedidos',
              'derecho_pedidos',
              'DERECHO_PEDIDOS',
            ];
            
            const hasFieldPermission = pedidosFields.some(field => 
              checkField(empleado[field])
            );
            
            // Verifică și câmpuri generice care conțin "pedido"
            const hasGenericPermission = Object.keys(empleado || {}).some(
              (key) =>
                key.toLowerCase().includes('pedido') && checkField(empleado[key]),
            );
            
            const hasPermission = hasFieldPermission || hasGenericPermission;
            setHasDerechoPedidos(hasPermission);
            
            // Dacă nu are permisiune, setează tab-ul activ la "Mis Pedidos"
            if (!hasPermission) {
              setActiveTab('mis-pedidos');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching empleado completo:', error);
      }
    };

    fetchEmpleadoCompleto();
  }, [user?.CODIGO, user?.email]);

  // Funcție pentru adăugarea de notificări
  const addToast = (type: ToastType, title: string, message: string, duration?: number) => {
    toastIdCounter.current += 1;
    const id = `${Date.now()}-${toastIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
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
        {/* Banner cu instrucțiuni (note) */}
        <BannerNotasInstrucciones />
        
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/inicio" 
            className="group flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors duration-200 mb-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-110 transition-all duration-200">
                <span className="text-white font-bold text-sm">←</span>
              </div>
            </div>
            <span className="text-sm font-medium">Volver a Inicio</span>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Pedidos</h1>
            <p className="text-gray-600">Gestiona tus pedidos</p>
          </div>
        </div>

        {/* Tabs */}
        <Card className="mb-6">
          <div className="flex flex-wrap gap-3 p-4">
            {/* Tab "Nuevo Pedido" - afișat doar dacă are DerechoPedidos */}
            {hasDerechoPedidos && (
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
            )}
            
            {/* Tab "Mis Pedidos" - mereu vizibil pentru toți */}
            <button
              onClick={() => setActiveTab('mis-pedidos')}
              className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'mis-pedidos'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'mis-pedidos' 
                  ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span>Mis Pedidos</span>
              </div>
            </button>
          </div>
        </Card>

        {/* Content */}
        {activeTab === 'nuevo-pedido' ? (
          <TabNuevoPedido addToast={addToast} />
        ) : (
          <TabMisPedidos addToast={addToast} />
        )}
      </div>
      
      {/* Container pentru notificări */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

// ===== TAB NUEVO PEDIDO =====
// ✅ Helper: Obține centrul de lucru din user object (din AuthContext sau din /api/me)
const getCentroTrabajoFromUser = (u: Record<string, unknown> | null | undefined): string | null => {
  if (!u) return null;
  
  // Caută în toate variantele posibile și returnează prima valoare non-golă
  const variants = [
    u['CENTRO TRABAJO'],
    u['CENTRO_TRABAJO'],
    u['CENTRO'],
    u['CENTRO DE TRABAJO'],
    u['centro_trabajo'],
    u['centroTrabajo']
  ];
  
  for (const variant of variants) {
    if (variant && typeof variant === 'string' && variant.trim()) {
      return variant.trim();
    }
  }
  
  return null;
};

const TabNuevoPedido: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [notas, setNotas] = useState('');
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [comunidadDetalles, setComunidadDetalles] = useState<ComunidadDetalle | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos] = useState(false); // Nu este setat în acest tab
  const [recentHistoryPedidos, setRecentHistoryPedidos] = useState<Pedido[]>([]);
  const [recentPedidoSourceReady, setRecentPedidoSourceReady] = useState(false);
  const [nuevoPedidoStep, setNuevoPedidoStep] = useState<'products' | 'review'>('products');
  const [pedidoSubmitLoading, setPedidoSubmitLoading] = useState(false);
  const [horarioEntrega, setHorarioEntrega] = useState('');
  const [horarioEntregaTipo, setHorarioEntregaTipo] = useState<'24horas' | '12horas' | 'personalizado' | ''>('');
  const [telefonoEntrega, setTelefonoEntrega] = useState('');
  const [loadingHorario, setLoadingHorario] = useState(false);
  
  // Nu mai avem nevoie de state pentru dropdown - comunitatea se selectează automat

  // Protecție pentru duplicate requests
  const isLoadingComunidadRef = React.useRef(false);
  const lastComunidadIdRef = React.useRef<number | null>(null);
  const lastCallTimeRef = React.useRef<number>(0);

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = useCallback(async (comunidadId: number) => {
    // Debounce: previne request-uri duplicate în mai puțin de 500ms
    const now = Date.now();
    if (now - lastCallTimeRef.current < 500) {
      console.log('⏭️ Skipping duplicate request (debounce) for comunidad:', comunidadId);
      return;
    }
    lastCallTimeRef.current = now;

    // Previne request-urile duplicate pentru aceeași comunitate
    if (isLoadingComunidadRef.current || lastComunidadIdRef.current === comunidadId) {
      console.log('⏭️ Skipping duplicate request for comunidad:', comunidadId);
      return;
    }

    isLoadingComunidadRef.current = true;
    lastComunidadIdRef.current = comunidadId;
    setComunidadSeleccionada(comunidadId);
    
    try {
      // ✅ Obține numele comunității din lista de comunități sau din comunidadDetalles
      const comunidad = comunidades.find(c => c.id === comunidadId);
      const nombreComunidad = comunidad?.nombre || comunidad?.['NOMBRE O RAZON SOCIAL'] || comunidadDetalles?.nombre || 'Comunidad no encontrada';
      
      // ✅ Setează inmediatamente comunidadDetalles cu numele corect pentru a evita "Comunidad no encontrada"
      if (comunidad && !comunidadDetalles) {
        setComunidadDetalles({
          id: comunidad.id,
          nombre: comunidad.nombre,
          datosCompletos: comunidad.datosCompletos,
          productos: []
        });
      }
      
      // Cargando detalles para la comunidad
      
      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const url = `${routes.getCatalogo}?cliente_id=${comunidadId}&cliente_nombre=${encodeURIComponent(nombreComunidad)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Procesează răspunsul (obiect sau array de produse cu permisiuni)
      if (data && (Array.isArray(data) || typeof data === 'object')) {
        let productosConPermisos;
        
        if (Array.isArray(data)) {
          // Dacă este array, mapează toate produsele
          productosConPermisos = data.map((item: ProductoApiItem) => {
            // Folosește imagen_base64 direct din backend
            let imagenBase64 = '';
            if (item.imagen_base64) {
              // Dacă este deja base64, adaugă prefixul data:image/jpeg
              imagenBase64 = `data:image/jpeg;base64,${item.imagen_base64}`;
            } else if (item.fotoproducto && item.fotoproducto.data && Array.isArray(item.fotoproducto.data)) {
              // Fallback la conversia din Buffer
              imagenBase64 = bufferToBase64(item.fotoproducto.data);
            }
            
            return {
              id: item.producto_id,
              numero: item.numero_articulo || '',
              descripcion: item.descripcion || '',
              precio: parseFloat(String(item.precio || 0)),
              permitido: item.permitido === 1 || item.permitido === true || item.permitido === '1',
              imagen: imagenBase64 || undefined
            };
          });
        } else {
          // Dacă este obiect singular, creează array cu un singur element
          let imagenBase64 = '';
          if (data.imagen_base64) {
            // Dacă este deja base64, adaugă prefixul data:image/jpeg
            imagenBase64 = `data:image/jpeg;base64,${data.imagen_base64}`;
          } else if (data.fotoproducto && data.fotoproducto.data && Array.isArray(data.fotoproducto.data)) {
            // Fallback la conversia din Buffer
            imagenBase64 = bufferToBase64(data.fotoproducto.data);
          }
          
          productosConPermisos = [{
            id: data.producto_id,
            numero: data.numero_articulo || '',
            descripcion: data.descripcion || '',
            precio: parseFloat(String(data.precio || 0)),
            permitido: data.permitido === 1 || data.permitido === true || data.permitido === '1',
            imagen: imagenBase64 || undefined
          }];
        }
        
        // Actualizează produsele cu permisiunile lor
        setProductos(productosConPermisos);
        
        // ✅ Actualizează comunidadDetalles cu numele corect (nu "Comunidad no encontrada")
        const comunidadEncontrada = comunidades.find(c => c.id === comunidadId);
        const nombreFinal = comunidadEncontrada?.nombre || comunidadEncontrada?.['NOMBRE O RAZON SOCIAL'] || nombreComunidad;
        
        // Actualizează horarioEntrega din datosCompletos
        const servicioEntrega = comunidadEncontrada?.datosCompletos?.['SERVICIO ENTREGA'] || 
                               comunidadEncontrada?.datosCompletos?.SERVICIO_ENTREGA || 
                               comunidadEncontrada?.datosCompletos?.servicio_entrega || '';
        if (servicioEntrega) {
          const servicioStr = String(servicioEntrega).trim();
          if (servicioStr === 'Servicio 24 horas') {
            setHorarioEntregaTipo('24horas');
            setHorarioEntrega('Servicio 24 horas');
          } else if (servicioStr === 'Servicio 12 horas') {
            setHorarioEntregaTipo('12horas');
            setHorarioEntrega('Servicio 12 horas');
          } else if (servicioStr) {
            // Dacă există o valoare personalizată, setează tipul la "personalizado"
            setHorarioEntregaTipo('personalizado');
            setHorarioEntrega(servicioStr);
          } else {
            // Dacă este gol sau null, lasă gol
            setHorarioEntregaTipo('');
            setHorarioEntrega('');
          }
        } else {
          // Dacă nu există valoare în baza de date, lasă gol
          setHorarioEntregaTipo('');
          setHorarioEntrega('');
        }
        const telefonoEntregaCliente = comunidadEncontrada?.datosCompletos?.['TELEFONO ENTREGA'] ||
          comunidadEncontrada?.datosCompletos?.TELEFON_ENTREGA ||
          comunidadEncontrada?.datosCompletos?.telefono_entrega || '';
        setTelefonoEntrega(telefonoEntregaCliente ? String(telefonoEntregaCliente).trim() : '');
        
        // Nu folosim "Comunidad no encontrada" dacă avem numele din lista de comunități
        if (nombreFinal !== 'Comunidad no encontrada' || comunidadEncontrada) {
          setComunidadDetalles({
            id: comunidadId,
            nombre: nombreFinal,
            datosCompletos: comunidadEncontrada?.datosCompletos || null,
            productos: productosConPermisos
          });
        } else {
          // Fallback: păstrăm numele existent dacă este valid
          setComunidadDetalles(prev => prev ? {
            ...prev,
            productos: productosConPermisos
          } : {
            id: comunidadId,
            nombre: nombreComunidad,
            productos: productosConPermisos
          });
        }
      }
    } catch (error) {
      console.error('❌ Error loading comunidad detalles:', error);
      addToast('error', 'Error', 'No se pudieron cargar los detalles de la comunidad.');
    } finally {
      isLoadingComunidadRef.current = false;
    }
  }, [comunidadDetalles, comunidades, addToast]);

  // Funcție pentru a formata orarul într-un format potrivit pentru "Horario Entrega"
  const formatearHorario = (horario: HorarioData | null): string => {
    // Folosește orarul dacă există
    if (horario && horario.days) {
      const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      
      // Grupează zilele cu același orar
      const horariosPorDia: Record<string, string[]> = {};
      
      diasSemana.forEach((diaKey, index) => {
        const daySchedule = horario.days[diaKey];
        if (daySchedule) {
          const intervals: string[] = [];
          const isValidTime = (time: string | number | null | undefined): boolean => 
            typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time);
          
          if (isValidTime(daySchedule.in1) && isValidTime(daySchedule.out1)) {
            const in1 = daySchedule.in1.substring(0, 5);
            const out1 = daySchedule.out1.substring(0, 5);
            intervals.push(`${in1}-${out1}`);
          }
          if (isValidTime(daySchedule.in2) && isValidTime(daySchedule.out2)) {
            const in2 = daySchedule.in2.substring(0, 5);
            const out2 = daySchedule.out2.substring(0, 5);
            intervals.push(`${in2}-${out2}`);
          }
          if (isValidTime(daySchedule.in3) && isValidTime(daySchedule.out3)) {
            const in3 = daySchedule.in3.substring(0, 5);
            const out3 = daySchedule.out3.substring(0, 5);
            intervals.push(`${in3}-${out3}`);
          }
          
          if (intervals.length > 0) {
            const horarioStr = intervals.join(' / ');
            if (!horariosPorDia[horarioStr]) {
              horariosPorDia[horarioStr] = [];
            }
            horariosPorDia[horarioStr].push(nombresDias[index]);
          }
        }
      });
      
      // Formatează rezultatul
      const partes: string[] = [];
      Object.keys(horariosPorDia).forEach(horarioStr => {
        const dias = horariosPorDia[horarioStr];
        if (dias.length === 1) {
          partes.push(`${dias[0]} ${horarioStr}`);
        } else if (dias.length === 5 && dias.includes('Lunes') && dias.includes('Viernes')) {
          // Lunes a Viernes
          partes.push(`Lunes a Viernes ${horarioStr}`);
        } else {
          // Alte combinații
          const primerDia = dias[0];
          const ultimoDia = dias[dias.length - 1];
          if (dias.length === 2) {
            partes.push(`${primerDia} y ${ultimoDia} ${horarioStr}`);
          } else {
            partes.push(`${primerDia}-${ultimoDia} ${horarioStr}`);
          }
        }
      });
      
      if (partes.length > 0) {
        return partes.join(', ');
      }
    }
    
    return '';
  };

  // Funcție pentru a încărca orarul sau cuadrantul când se selectează "Personalizado"
  const cargarHorarioDesdeCentro = async () => {
    if (!user || !comunidadDetalles) return;
    
    setLoadingHorario(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const centroTrabajo = comunidadDetalles.nombre || user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || '';
      const grupoUsuario = user?.['GRUPO'] || user?.grupo || '';
      const codigoEmpleado = user?.CODIGO || user?.codigo || '';

      let horarioEncontrado = null;
      let cuadranteEncontrado = null;

      // 1. Încearcă să obțină orarul normal (horarios)
      if (centroTrabajo && grupoUsuario) {
        try {
          const { listSchedules } = await import('../api/schedules');
          const response = await listSchedules(null);
          
          if (response.success && Array.isArray(response.data)) {
            const horarioMatch = response.data.find((h: HorarioData) => 
              h.centroNombre === centroTrabajo && h.grupoNombre === grupoUsuario
            );
            if (horarioMatch) {
              horarioEncontrado = horarioMatch;
            }
          }
        } catch (error) {
          console.warn('Error fetching horarios:', error);
        }
      }

      // 2. Încearcă să obțină cuadrantul pentru luna curentă
      if (codigoEmpleado && !horarioEncontrado) {
        try {
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;
          const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          
          const response = await fetch(routes.getCuadrantes, {
            method: 'POST',
            headers,
            body: JSON.stringify({ codigo: codigoEmpleado })
          });

          if (response.ok) {
            const data = await response.json();
            const lista = Array.isArray(data) ? data : [data];
            
            const cuadranteMatch = lista.find((c: CuadranteData) => {
              let luna = c.LUNA || c.luna;
              const codigo = c.CODIGO || c.codigo;
              
              if (typeof luna === 'number') {
                const date = new Date(Math.round((luna - 25569) * 86400 * 1000));
                luna = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
              }
              return luna === currentMonthFormatted && codigo === codigoEmpleado;
            });
            
            if (cuadranteMatch) {
              cuadranteEncontrado = cuadranteMatch;
            }
          }
        } catch (error) {
          console.warn('Error fetching cuadrante:', error);
        }
      }

      // 3. Formatează și setează orarul
      if (horarioEncontrado || cuadranteEncontrado) {
        const horarioFormateado = formatearHorario(horarioEncontrado);
        if (horarioFormateado) {
          setHorarioEntrega(horarioFormateado);
        }
      }
    } catch (error) {
      console.error('Error cargando horario desde centro:', error);
    } finally {
      setLoadingHorario(false);
    }
  };

  // Încarcă centrele de trabajo (comunidades) și datele complete ale angajatului
  useEffect(() => {
    const loadComunidadesAndUserData = async () => {
      try {
        // Încarcă comunitățile
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
          .map((cliente, index) => {
            const nombre = cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || 'Sin nombre';
            // Folosește ID-ul real din baza de date, nu index + 1
            const clienteId = cliente.id || cliente.ID || (index + 1);
            return {
              id: clienteId,
              nombre: nombre,
              datosCompletos: cliente // Păstrăm datele complete ale clientului
            };
          })
          .filter(centro => {
            const isValid = centro.nombre && centro.nombre.trim() !== '' && centro.nombre.length > 3;
            return isValid;
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        setComunidades(centrosFromClientes);
        // Comunidades cargadas exitosamente
        
        // Încarcă datele complete ale angajatului din backend (ca în DatosPage)
        const email = user?.email;
        if (email) {
          const empleadosResponse = await fetch(routes.getEmpleados, {
            headers: {
              'X-App-Source': 'DeCamino-Web-App',
              'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
              'X-Client-Type': 'web-browser',
              'User-Agent': 'DeCamino-Web-Client/1.0'
            }
          });
          
          const empleadosData = await empleadosResponse.json();
          const users = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
          
          // Caută angajatul după email (ca în DatosPage)
          const normEmail = (email || '').trim().toLowerCase();
          let found = users.find(u => ((u['CORREO ELECTRONICO'] || '').trim().toLowerCase()) === normEmail);
          if (!found && users.length > 0) {
            found = users.find(u => (u[8] || '').trim().toLowerCase() === normEmail);
          }
          
          // ✅ Încearcă să obțină centrul de lucru din user object (din AuthContext) sau din found
          const centroTrabajoFromUser = getCentroTrabajoFromUser(user);
          const centroTrabajoFromFound = found ? (found['CENTRO TRABAJO'] || found['CENTRO_TRABAJO'] || found['CENTRO'] || found['CENTRO DE TRABAJO']) : null;
          const centroTrabajo = centroTrabajoFromUser || centroTrabajoFromFound;
          
          // ✅ Folosește centrul de lucru din user sau found pentru auto-selectare
          if (centroTrabajo) {
              const comunidadEncontrada = centrosFromClientes.find(com => {
                const matchExactNombre = com.nombre === centroTrabajo;
                const matchExactDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL'] === centroTrabajo;
                const matchCaseInsensitiveNombre = com.nombre?.toLowerCase() === centroTrabajo?.toLowerCase();
                const matchCaseInsensitiveDatos = com.datosCompletos?.['NOMBRE O RAZON SOCIAL']?.toLowerCase() === centroTrabajo?.toLowerCase();
                
                return matchExactNombre || matchExactDatos || matchCaseInsensitiveNombre || matchCaseInsensitiveDatos;
              });
              
              if (comunidadEncontrada) {
                // Comunitatea găsită cu succes
                setComunidadSeleccionada(comunidadEncontrada.id);
                setComunidadDetalles({
                  id: comunidadEncontrada.id,
                  nombre: comunidadEncontrada.nombre,
                  datosCompletos: comunidadEncontrada.datosCompletos,
                  productos: []
                });
                // Actualizează horarioEntrega din datosCompletos
                const servicioEntrega = comunidadEncontrada.datosCompletos?.['SERVICIO ENTREGA'] || 
                                       comunidadEncontrada.datosCompletos?.SERVICIO_ENTREGA || 
                                       comunidadEncontrada.datosCompletos?.servicio_entrega || '';
                if (servicioEntrega) {
                  const servicioStr = String(servicioEntrega).trim();
                  if (servicioStr === 'Servicio 24 horas') {
                    setHorarioEntregaTipo('24horas');
                    setHorarioEntrega('Servicio 24 horas');
                  } else if (servicioStr === 'Servicio 12 horas') {
                    setHorarioEntregaTipo('12horas');
                    setHorarioEntrega('Servicio 12 horas');
                  } else if (servicioStr) {
                    // Dacă există o valoare personalizată, setează tipul la "personalizado"
                    setHorarioEntregaTipo('personalizado');
                    setHorarioEntrega(servicioStr);
                  } else {
                    // Dacă este gol sau null, lasă gol
                    setHorarioEntregaTipo('');
                    setHorarioEntrega('');
                  }
                } else {
                  // Dacă nu există valoare în baza de date, lasă gol
                  setHorarioEntregaTipo('');
                  setHorarioEntrega('');
                }
                
                // Încarcă detaliile comunității
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
                  // Comunitatea găsită prin căutare parțială
                  setComunidadSeleccionada(comunidadParcial.id);
                  setComunidadDetalles({
                    id: comunidadParcial.id,
                    nombre: comunidadParcial.nombre,
                    datosCompletos: comunidadParcial.datosCompletos,
                    productos: []
                  });
                  // Actualizează horarioEntrega din datosCompletos
                  const servicioEntrega = comunidadParcial.datosCompletos?.['SERVICIO ENTREGA'] || 
                                         comunidadParcial.datosCompletos?.SERVICIO_ENTREGA || 
                                         comunidadParcial.datosCompletos?.servicio_entrega || '';
                  if (servicioEntrega) {
                    const servicioStr = String(servicioEntrega).trim();
                    if (servicioStr === 'Servicio 24 horas') {
                      setHorarioEntregaTipo('24horas');
                      setHorarioEntrega('Servicio 24 horas');
                    } else if (servicioStr === 'Servicio 12 horas') {
                      setHorarioEntregaTipo('12horas');
                      setHorarioEntrega('Servicio 12 horas');
                    } else if (servicioStr) {
                      // Dacă există o valoare personalizată, setează tipul la "personalizado"
                      setHorarioEntregaTipo('personalizado');
                      setHorarioEntrega(servicioStr);
                    } else {
                      // Dacă este gol sau null, lasă gol
                      setHorarioEntregaTipo('');
                      setHorarioEntrega('');
                    }
                  } else {
                    // Dacă nu există valoare în baza de date, lasă gol
                    setHorarioEntregaTipo('');
                    setHorarioEntrega('');
                  }
                  addToast('info', 'Centro encontrado parcialmente', `Se encontró una comunidad similar: "${comunidadParcial.nombre}"`);
                  
                  setTimeout(() => {
                    handleComunidadChange(comunidadParcial.id);
                  }, 100);
                } else {
                  // Nu s-a găsit comunitatea pentru centrul de trabajo
                  addToast('warning', 'Centro no encontrado', `No se encontró la comunidad "${centroTrabajo}" en la lista.`);
                }
              }
            }
          }
      } catch (error) {
        console.error('Error loading comunidades and user data:', error);
      }
    };

    loadComunidadesAndUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes.getClientes, user?.email]);

  // ✅ Produsele se încarcă DOAR în handleComunidadChange când se selectează o comunitate
  // Nu mai încărcăm produsele la mount - ele se încarcă automat când se selectează comunitatea
  // Aceasta asigură că produsele au permisiunile corecte pentru comunitatea selectată

  // Nu mai avem nevoie de filtrare - comunitatea se selectează automat

  // Filtrare produse pentru căutare (fără limitare - afișează toate produsele)
  const productosFiltrados = useMemo(() => {
    if (!searchTerm) return productos; // ✅ Afișează toate produsele când nu există căutare
    return productos.filter(producto => 
      producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    ); // ✅ Afișează toate produsele găsite la căutare (fără limitare)
  }, [productos, searchTerm]);

  const recentProductIds = useMemo(
    () => extractRecentProductIdsFromPedidos(recentHistoryPedidos, 16, productos),
    [recentHistoryPedidos, productos],
  );

  const recientesEnCatalogo = useMemo((): PedidoCatalogProduct[] => {
    return recentProductIds
      .map((pid) => productos.find((p) => p.id === pid))
      .filter((p): p is Producto => Boolean(p))
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        numero: p.numero,
        descripcion: p.descripcion,
        imagen: p.imagen,
        precio: p.precio,
      }));
  }, [recentProductIds, productos]);

  const comunidadClienteIdFromDatos = useMemo(
    () =>
      (comunidadDetalles?.datosCompletos as { id?: number } | undefined)?.id,
    [comunidadDetalles?.datosCompletos],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          if (!cancelled) {
            setRecentHistoryPedidos([]);
            setRecentPedidoSourceReady(true);
          }
          return;
        }
        const res = await fetch(routes.getPedidos, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          if (!cancelled) {
            setRecentHistoryPedidos([]);
            setRecentPedidoSourceReady(true);
          }
          return;
        }
        const data = await res.json();
        const arr: Pedido[] = Array.isArray(data) ? data : [];
        const myCodigo = String(user?.CODIGO ?? user?.id ?? '').trim();
        const myMail = String(user?.email ?? '').trim().toLowerCase();
        const mine = arr.filter((p) => {
          const emp = p.empleado;
          if (!emp) return false;
          const id = String(emp.id ?? '').trim();
          const mail = String(emp.email ?? '').trim().toLowerCase();
          if (myCodigo && id && id === myCodigo) return true;
          if (myMail && mail && mail === myMail) return true;
          return false;
        });
        const datosClienteId = comunidadClienteIdFromDatos;
        const comIdRaw =
          comunidadSeleccionada ?? datosClienteId ?? comunidadDetalles?.id ?? null;
        const comId = comIdRaw != null ? Number(comIdRaw) : NaN;
        const byComunidad = (p: Pedido) =>
          Number.isFinite(comId) && Number(p.comunidad?.id) === comId;

        let sourceList: Pedido[] = [];
        if (mine.length > 0) {
          const scoped = Number.isFinite(comId) ? mine.filter(byComunidad) : mine;
          sourceList = scoped.length > 0 ? scoped : mine;
        } else if (Number.isFinite(comId)) {
          sourceList = arr.filter(byComunidad);
        }

        if (!cancelled) {
          setRecentHistoryPedidos(sourceList);
          setRecentPedidoSourceReady(true);
        }
      } catch {
        if (!cancelled) {
          setRecentHistoryPedidos([]);
          setRecentPedidoSourceReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.CODIGO,
    user?.id,
    user?.email,
    comunidadSeleccionada,
    comunidadDetalles?.id,
    comunidadClienteIdFromDatos,
  ]);

  React.useEffect(() => {
    if (lineasPedido.length === 0 && nuevoPedidoStep === 'review') {
      setNuevoPedidoStep('products');
    }
  }, [lineasPedido.length, nuevoPedidoStep]);

  // Funcție pentru a obține limita de cheltuieli a comunității
  const getLimiteGasto = () => {
    if (!comunidadDetalles?.datosCompletos) return null;
    
    const limite = comunidadDetalles.datosCompletos.CuantoPuedeGastar;
    if (limite && !isNaN(parseFloat(limite))) {
      return parseFloat(limite);
    }
    return null;
  };

  /** Cantitate în pedido din +/- (o singură linie consolidată per producto). */
  const setCantidadProductoEnPedido = (producto: Producto, newQty: number) => {
    const q = Math.max(0, Math.floor(Number(newQty) || 0));
    const current = sumQtyForProduct(lineasPedido, producto.id);
    if (q === current) return;
    const delta = q - current;
    if (delta > 0) {
      const limite = getLimiteGasto();
      if (limite != null) {
        const totalActual = lineasPedido.reduce(
          (sum, linea) => sum + linea.cantidad * linea.precio_unitario,
          0,
        );
        if (Math.round((totalActual + delta * producto.precio) * 100) / 100 > Math.round(limite * 100) / 100) {
          addToast('error', 'Límite excedido', 'No se puede superar el límite de gasto del cliente.');
          return;
        }
      }
    }
    const base = lineasAfterSetProductQty(lineasPedido, producto, q);
    setLineasPedido(
      base.map((line) =>
        line.producto_id === producto.id
          ? { ...line, numero_articulo: producto.numero, descripcion: producto.descripcion }
          : line,
      ) as LineaPedido[],
    );
  };

  // Calculează subtotalul (fără IVA)
  const calcularSubtotal = () => {
    return lineasPedido.reduce((sum, linea) => 
      sum + (linea.cantidad * linea.precio_unitario), 0
    );
  };

  // Calculează IVA-ul total (21% din subtotal)
  const calcularIVA = () => {
    const subtotal = calcularSubtotal();
    const iva = subtotal * 0.21;
    return iva;
  };

  // Calculează totalul general (subtotal + IVA)
  const calcularTotal = () => {
    return calcularSubtotal() + calcularIVA();
  };

  // Salvează borrador
  const guardarBorrador = async () => {
    if (!comunidadSeleccionada) {
      addToast('warning', 'Selecciona comunidad', 'Por favor selecciona una comunidad primero');
      return;
    }

    // Validare: Horario Entrega este obligatoriu
    if (!horarioEntregaTipo || !horarioEntrega || horarioEntrega.trim() === '') {
      addToast(
        'error',
        'Horario obligatorio',
        'Por favor selecciona un tipo de horario y complétalo.',
        12000,
      );
      return;
    }
    if (!telefonoEntrega || telefonoEntrega.trim() === '') {
      addToast(
        'error',
        'Teléfono de entrega requerido',
        'Por favor introduce el teléfono de entrega antes de guardar el pedido.',
        12000,
      );
      return;
    }

    const limiteGuardar = getLimiteGasto();
    if (limiteGuardar != null) {
      const sub = calcularSubtotal();
      if (Math.round(sub * 100) / 100 > Math.round(limiteGuardar * 100) / 100) {
        addToast(
          'error',
          'Límite excedido',
          `El subtotal (${sub.toFixed(2)} €) supera el límite de gasto (${limiteGuardar.toFixed(2)} €).`,
        );
        return;
      }
    }

    // Verificare: Limita de 2 pedidos per centru (doar pendiente și aprobado, enviados nu se numără)
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const comunidadId = comunidadDetalles?.datosCompletos?.id || comunidadDetalles?.id || comunidadSeleccionada;
      const comunidadNombre = comunidadDetalles?.nombre || 'Sin comunidad';

      // Obține toate pedidos pentru această comunitate
      const response = await fetch(routes.getPedidos, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const allPedidos = await response.json();
        const pedidosArray = Array.isArray(allPedidos) ? allPedidos : [];

        // Numără doar pedidos cu status "pendiente" sau "aprobado" pentru această comunitate
        const pedidosCount = pedidosArray.filter((p: Pedido) => {
          const pedidoComunidadId = p.comunidad?.id || p.comunidad_id;
          const pedidoEstado = p.estado || '';
          const isSameComunidad = String(pedidoComunidadId) === String(comunidadId);
          const isPendienteOrAprobado = pedidoEstado === 'pendiente' || pedidoEstado === 'aprobado';
          return isSameComunidad && isPendienteOrAprobado;
        }).length;

        if (pedidosCount >= 2) {
          addToast('error', 'Límite de pedidos alcanzado', 
            `Ya tienes ${pedidosCount} pedidos pendientes o aprobados para "${comunidadNombre}". El límite es de 2 pedidos por centro. Los pedidos enviados no cuentan para este límite.`
          );
          return;
        }
      }
    } catch (error) {
      console.error('Error verificando límite de pedidos:', error);
      // Nu blocăm salvarea dacă verificarea eșuează, dar logăm eroarea
    }

    const payload = {
      // Datele angajatului
      empleado: {
        id: user?.CODIGO || user?.id || 'N/A',
        nombre: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.nombre || 'Usuario',
        email: user?.email || 'N/A',
        centro_trabajo: comunidadDetalles?.nombre || user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO || 'Sin centro'
      },
      
      // Datele comunității
      comunidad: {
        // Folosește ID-ul real din datosCompletos dacă există, altfel folosește id-ul din comunidadDetalles
        id: comunidadDetalles?.datosCompletos?.id || comunidadDetalles?.id || 'N/A',
        nombre: comunidadDetalles?.nombre || 'Comunidad no encontrada',
        direccion: comunidadDetalles?.datosCompletos?.DIRECCION || 'N/A',
        codigo_postal: comunidadDetalles?.datosCompletos?.['CODIGO POSTAL'] || 'N/A',
        localidad: comunidadDetalles?.datosCompletos?.LOCALIDAD || 'N/A',
        provincia: comunidadDetalles?.datosCompletos?.PROVINCIA || 'N/A',
        telefono: comunidadDetalles?.datosCompletos?.TELEFONO || 'N/A',
        email: comunidadDetalles?.datosCompletos?.EMAIL || 'N/A',
        nif: comunidadDetalles?.datosCompletos?.NIF || 'N/A',
        dni: comunidadDetalles?.datosCompletos?.['D.N.I. / NIE'] || 'N/A',
        limite_gasto: getLimiteGasto() || 0
      },
      
      // Comanda cerută
      pedido: {
        fecha: new Date().toISOString(),
        moneda: 'EUR',
        descuento_global: 0,
        impuestos: calcularIVA(),
        notas: notas,
        subtotal: calcularSubtotal(),
        iva_total: calcularIVA(),
        total: calcularTotal(),
        limite_excedido: getLimiteGasto() ? calcularSubtotal() > getLimiteGasto() : false,
        exceso_limite: getLimiteGasto() ? (calcularSubtotal() > getLimiteGasto() ? 1 : 0) : 0,
        estado: 'pendiente', // Status pentru aprobare de către supervizor
        horario_entrega: horarioEntrega.trim(),
        telefono_entrega: telefonoEntrega.trim(),
        items: lineasPedido.map(linea => {
          const producto = productos.find(p => p.id === linea.producto_id);
          return {
            producto_id: linea.producto_id,
            numero_articulo: producto?.numero || 'N/A',
            descripcion: producto?.descripcion || 'N/A',
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal_linea: linea.cantidad * linea.precio_unitario,
            descuento_linea: linea.descuento_linea,
            iva_porcentaje: linea.iva_porcentaje,
            iva_linea: (linea.cantidad * linea.precio_unitario) * 0.21,
            total_linea: (linea.cantidad * linea.precio_unitario) + ((linea.cantidad * linea.precio_unitario) * 0.21)
          };
        })
      }
    };

    try {
      // ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
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
          // Actualizează SERVICIO_ENTREGA în Clientes dacă horarioEntrega a fost modificat
          if (horarioEntrega.trim() && comunidadDetalles?.id) {
            try {
              const clienteId = typeof comunidadDetalles.id === 'number' 
                ? comunidadDetalles.id 
                : typeof comunidadDetalles.datosCompletos?.id === 'number'
                  ? comunidadDetalles.datosCompletos.id
                  : null;
              
              if (clienteId) {
                const updateResponse = await fetch(routes.getClientes, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    action: 'edit',
                    id: clienteId,
                    'SERVICIO ENTREGA': horarioEntrega.trim()
                  })
                });
                
                if (updateResponse.ok) {
                  console.log('✅ SERVICIO_ENTREGA actualizado en Clientes');
                } else {
                  console.warn('⚠️ No se pudo actualizar SERVICIO_ENTREGA');
                }
              }
            } catch (error) {
              console.error('Error actualizando SERVICIO_ENTREGA:', error);
            }
          }
          
          addToast('success', 'Pedido guardado', 
            `Pedido ${responseData.pedido_uid} guardado correctamente. Está pendiente de aprobación por un supervisor.`
          );
          
          // Resetează comanda după salvarea cu succes
          setLineasPedido([]);
          setNotas('');
          setNuevoPedidoStep('products');
          // Nu resetăm horarioEntrega pentru a păstra valoarea pentru următorul pedido
        } else {
          addToast('warning', 'Pedido guardado con advertencias', responseData.message || 'El pedido se guardó pero con algunas advertencias.');
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error guardando borrador:', error);
      addToast('error', 'Error', 'No se pudo guardar el borrador. Inténtalo de nuevo.');
    }
  };

  // Informații utilizator curent
  const usuarioActual: Usuario = {
  id: user?.CODIGO || user?.id || 'N/A',
  nombre: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE || user?.nombre || 'Usuario',
  comunidad: getCentroTrabajoFromUser(user) || 'Sin centro'
};


  const cartProductCount = lineasPedido.length;
  const cartUnitCount = lineasPedido.reduce((s, l) => s + (l.cantidad || 0), 0);
  const entregaPendienteMensaje = useMemo(() => {
    if (!horarioEntregaTipo || !horarioEntrega?.trim()) {
      return 'Tienes que elegir y completar el horario de entrega en la pantalla anterior (apartado «Horario Entrega»).';
    }
    if (!telefonoEntrega?.trim()) {
      return 'Tienes que escribir el teléfono de entrega en la pantalla anterior (campo «Teléfono Entrega»).';
    }
    return null;
  }, [horarioEntregaTipo, horarioEntrega, telefonoEntrega]);
  const isReviewStep = nuevoPedidoStep === 'review';

  const handleEnviarPedido = async () => {
    setPedidoSubmitLoading(true);
    try {
      await guardarBorrador();
    } finally {
      setPedidoSubmitLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${!isReviewStep && cartProductCount > 0 ? 'pb-24 max-md:pb-28' : ''}`}>
      {isReviewStep ? (
        <ReviewPedidoScreen
          lineas={lineasPedido}
          products={productos.map((p) => ({
            id: p.id,
            numero: p.numero,
            descripcion: p.descripcion,
            imagen: p.imagen,
          }))}
          notas={notas}
          onNotasChange={setNotas}
          onBack={() => setNuevoPedidoStep('products')}
          onSubmit={handleEnviarPedido}
          submitting={pedidoSubmitLoading}
          onSetProductQty={(productId, qty) => {
            const prod = productos.find((p) => p.id === productId);
            if (prod) setCantidadProductoEnPedido(prod, qty);
          }}
          confirmRemove
          limiteGasto={getLimiteGasto()}
          subtotal={calcularSubtotal()}
          notasLabel="Nota (opcional)"
          notasPlaceholder="Especifica el horario de entrega u otros detalles…"
          entregaAlert={entregaPendienteMensaje}
        />
      ) : (
        <>
      {/* Informații pedido */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-900">Información del Pedido</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="block text-sm font-medium text-gray-700 mb-1">Empleado</div>
              <p className="text-lg font-semibold text-gray-900">{usuarioActual.nombre}</p>
            </div>
            <div>
              <div className="block text-sm font-medium text-gray-700 mb-1">Comunidad</div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-lg font-semibold text-gray-900">
                  {comunidadDetalles?.nombre || 'Cargando...'}
                </p>
                <p className="text-sm text-gray-500">Centro de trabajo asignado</p>
              </div>
            </div>
            <div>
              <div className="block text-sm font-medium text-gray-700 mb-1">Fecha</div>
              <p className="text-lg font-semibold text-gray-900">{formatDate(new Date())}</p>
            </div>
            <div>
              <label htmlFor="horario-entrega-tipo" className="block text-sm font-medium text-gray-700 mb-1">
                Horario Entrega <span className="text-red-500">*</span>
              </label>
              <select
                id="horario-entrega-tipo"
                value={horarioEntregaTipo}
                onChange={(e) => {
                  const nuevoTipo = e.target.value as '24horas' | '12horas' | 'personalizado' | '';
                  setHorarioEntregaTipo(nuevoTipo);
                  if (nuevoTipo === '24horas') {
                    setHorarioEntrega('Servicio 24 horas');
                  } else if (nuevoTipo === '12horas') {
                    setHorarioEntrega('Servicio 12 horas');
                  } else if (nuevoTipo === 'personalizado') {
                    // Când schimbă la "Personalizado", păstrează valoarea existentă dacă nu e unul din serviciile predefinite
                    const currentValue = horarioEntrega;
                    if (currentValue === 'Servicio 24 horas' || currentValue === 'Servicio 12 horas') {
                      setHorarioEntrega('');
                    }
                    // Încarcă automat orarul sau cuadrantul dacă există
                    if (!currentValue || currentValue === 'Servicio 24 horas' || currentValue === 'Servicio 12 horas') {
                      cargarHorarioDesdeCentro();
                    }
                  } else {
                    // Când se selectează "Selecciona..." (gol), resetează totul
                    setHorarioEntrega('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 mb-2"
              >
                <option value="">Selecciona...</option>
                <option value="personalizado">Personalizado</option>
                <option value="24horas">Servicio 24 horas</option>
                <option value="12horas">Servicio 12 horas</option>
              </select>
              {horarioEntregaTipo === 'personalizado' && (
                <div className="relative">
                  <input
                    id="horario-entrega"
                    type="text"
                    value={horarioEntrega}
                    onChange={(e) => setHorarioEntrega(e.target.value)}
                    placeholder={loadingHorario ? "Cargando horario..." : "Ej: Lunes a Viernes 9:00-18:00"}
                    disabled={loadingHorario}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      !horarioEntrega || horarioEntrega.trim() === '' 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300'
                    }`}
                  />
                  {loadingHorario && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {(!horarioEntrega || horarioEntrega.trim() === '') && !loadingHorario && (
                    <p className="mt-1 text-xs text-red-600">Este campo es obligatorio</p>
                  )}
                </div>
              )}
              {(horarioEntregaTipo === '24horas' || horarioEntregaTipo === '12horas') && (
                <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  ✓ {horarioEntrega}
                </div>
              )}
              {!horarioEntregaTipo && (
                <p className="mt-1 text-xs text-red-600">Por favor selecciona un tipo de horario</p>
              )}
            </div>
            <div>
              <label htmlFor="telefono-entrega" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono Entrega <span className="text-red-500">*</span>
              </label>
              <input
                id="telefono-entrega"
                type="tel"
                value={telefonoEntrega}
                onChange={(e) => setTelefonoEntrega(e.target.value)}
                placeholder="Ej: 612 345 678"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                  !telefonoEntrega || telefonoEntrega.trim() === ''
                    ? 'border-gray-300'
                    : 'border-gray-300'
                }`}
                aria-required="true"
              />
              {(!telefonoEntrega || telefonoEntrega.trim() === '') && (
                <p className="mt-1 text-xs text-gray-500">Requerido para la entrega del pedido</p>
              )}
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
                <p className="text-gray-900">{comunidadDetalles.nombre || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Dirección</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.DIRECCION || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Código Postal</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.['CODIGO POSTAL'] || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.NIF || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Teléfono</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.TELEFONO || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Población</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.POBLACION || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Provincia</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.PROVINCIA || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">País</div>
                <p className="text-gray-900">{comunidadDetalles.datosCompletos?.PAIS || 'N/A'}</p>
              </div>
              
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Productos disponibles</div>
                <p className="text-gray-900">{comunidadDetalles.productos?.length || 0} productos</p>
              </div>
              
              {/* Limita de cheltuieli (ascunsă pentru angajați) */}
              {getLimiteGasto() && (
                <div className="hidden">
                  <div className="block text-sm font-medium text-gray-700 mb-1">Límite de gasto</div>
                  <p className="text-gray-900">Configurat intern</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Catálogo: zona clară, full-width, fără carduri în carduri */}
      <section
        className="-mx-1 border-y border-zinc-200/90 bg-zinc-50 px-3 py-5 text-zinc-900 sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:py-6 dark:border-zinc-200/80 dark:bg-zinc-50 dark:text-zinc-900 [&_input]:text-zinc-900 [&_label]:text-zinc-700"
        style={{ colorScheme: 'light' }}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold !text-zinc-800" style={{ color: '#27272a' }}>
            Buscar productos
            <span className="ml-2 text-sm font-normal !text-zinc-500" style={{ color: '#71717a' }}>
              ({productos.length} en catálogo)
            </span>
          </h3>
          <div className="mt-3">
            <Input
              id="search-productos"
              label="Buscar"
              type="text"
              placeholder="Buscar por número o descripción (Ej: A-100 o Pintura blanca)"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full"
              aria-label="Buscar productos"
            />
          </div>
        </div>

        {loadingProductos ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-400" />
            <p className="text-zinc-600">Cargando productos...</p>
          </div>
        ) : productos.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mb-4 text-5xl">📦</div>
            <h3 className="mb-2 text-lg font-semibold text-zinc-700">No se encontraron productos disponibles</h3>
            <p className="text-zinc-600">Esta comunidad no tiene productos asignados en el catálogo.</p>
          </div>
        ) : (
          <>
            <RecentPedidoProducts
              products={recientesEnCatalogo}
              hasHistorySource={recentPedidoSourceReady}
              onQuickAdd={(p) => {
                const prod = productos.find((x) => x.id === p.id);
                if (!prod) return;
                setCantidadProductoEnPedido(prod, sumQtyForProduct(lineasPedido, p.id) + 1);
              }}
            />
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide !text-zinc-600" style={{ color: '#52525b' }}>
              Todos los productos
            </h3>
            <div className="max-h-[min(58vh,560px)] overflow-y-auto rounded-xl border border-zinc-200/80 bg-white px-2 sm:px-3">
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map((producto) => (
                  <ProductListItem
                    key={producto.id}
                    product={{
                      id: producto.id,
                      numero: producto.numero,
                      descripcion: producto.descripcion,
                      imagen: producto.imagen,
                    }}
                    quantityInCart={sumQtyForProduct(lineasPedido, producto.id)}
                    onQuantityInCartChange={(n) => setCantidadProductoEnPedido(producto, n)}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <StickyCartBar
        productCount={cartProductCount}
        unitCount={cartUnitCount}
        ctaLabel="Ver pedido"
        onCtaClick={() => setNuevoPedidoStep('review')}
      />
        </>
      )}
    </div>
  );
};

// ===== TAB MIS PEDIDOS =====
const TabMisPedidos: React.FC<{ addToast: (type: ToastType, title: string, message: string, duration?: number) => void }> = ({ addToast }) => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [pedidoEditando, setPedidoEditando] = useState<string | null>(null);
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([]);
  const [productosNuevos, setProductosNuevos] = useState<LineaPedido[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  /** Límite actual del cliente (GET /clientes) al abrir edición; null = sin límite o no cargado. */
  const [limiteGastoEdicion, setLimiteGastoEdicion] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pedidoCargandoAlbaran, setPedidoCargandoAlbaran] = useState<string | null>(null);
  const [albaranFiles, setAlbaranFiles] = useState<File[]>([]);
  const [albaranPreview, setAlbaranPreview] = useState<string | null>(null);
  const [uploadingAlbaran, setUploadingAlbaran] = useState(false);
  const [pedidoViendoAlbaran, setPedidoViendoAlbaran] = useState<string | null>(null);
  const [albaranesListaMeta, setAlbaranesListaMeta] = useState<
    Array<{
      id: number;
      nombre_archivo: string;
      tipo_mime: string | null;
      tamano_bytes: number | null;
      subido_en: string;
      subido_por: string | null;
    }>
  | null>(null);
  const [albaranViewSelectedId, setAlbaranViewSelectedId] = useState<number | null>(null);
  const [albaranViewBlobUrl, setAlbaranViewBlobUrl] = useState<string | null>(null);
  const [albaranViewPreviewUrl, setAlbaranViewPreviewUrl] = useState<string | null>(null);
  const [albaranViewMime, setAlbaranViewMime] = useState<string>('');
  const [albaranViewName, setAlbaranViewName] = useState<string>('');
  const [albaranViewLoading, setAlbaranViewLoading] = useState(false);
  const [albaranViewError, setAlbaranViewError] = useState<string | null>(null);
  const albaranViewBlobUrlRef = React.useRef<string | null>(null);
  const albaranViewPreviewUrlRef = React.useRef<string | null>(null);

  // Lista albaranes când se deschide "Ver Albarán"
  useEffect(() => {
    if (!pedidoViendoAlbaran) {
      setAlbaranesListaMeta(null);
      setAlbaranViewSelectedId(null);
      setAlbaranViewBlobUrl(null);
      setAlbaranViewPreviewUrl(null);
      setAlbaranViewMime('');
      setAlbaranViewName('');
      setAlbaranViewError(null);
      return;
    }
    let cancelled = false;
    const token = localStorage.getItem('auth_token');
    const base = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
    const uid = (pedidoViendoAlbaran || '').replace(/^=+/, '');
    setAlbaranViewLoading(true);
    setAlbaranViewError(null);
    fetch(`${base}/api/pedidos/${encodeURIComponent(uid)}/albaranes`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Error ${res.status}`);
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setAlbaranesListaMeta(list);
        if (list.length === 0) {
          setAlbaranViewSelectedId(null);
          setAlbaranViewError('No hay albaranes guardados para este pedido.');
          setAlbaranViewLoading(false);
        } else {
          setAlbaranViewSelectedId(list[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAlbaranViewError(err?.message || 'No se pudo cargar la lista de albaranes');
          setAlbaranViewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pedidoViendoAlbaran]);

  // Blob preview pentru albarán selectat (id)
  useEffect(() => {
    if (!pedidoViendoAlbaran || albaranViewSelectedId == null) {
      return;
    }
    let revoked = false;
    let heicHandlesLoading = false;
    setAlbaranViewLoading(true);
    setAlbaranViewError(null);
    setAlbaranViewPreviewUrl(null);
    if (albaranViewBlobUrlRef.current) {
      URL.revokeObjectURL(albaranViewBlobUrlRef.current);
      albaranViewBlobUrlRef.current = null;
    }
    if (albaranViewPreviewUrlRef.current) {
      URL.revokeObjectURL(albaranViewPreviewUrlRef.current);
      albaranViewPreviewUrlRef.current = null;
    }
    setAlbaranViewBlobUrl(null);
    const token = localStorage.getItem('auth_token');
    const base = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
    const uid = (pedidoViendoAlbaran || '').replace(/^=+/, '');
    const url = `${base}/api/pedidos/${encodeURIComponent(uid)}/albaran?preview=1&id=${albaranViewSelectedId}`;
    fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (revoked) return;
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Error ${res.status}`);
        }
        const blob = await res.blob();
        const contentType = res.headers.get('Content-Type') || blob.type || 'application/pdf';
        const disp = res.headers.get('Content-Disposition');
        let name = 'albaran.pdf';
        if (disp) {
          const m = disp.match(/filename="?([^";]+)"?/);
          if (m) name = m[1].trim();
        }
        const blobUrl = URL.createObjectURL(blob);
        albaranViewBlobUrlRef.current = blobUrl;
        setAlbaranViewBlobUrl(blobUrl);
        setAlbaranViewMime(contentType);
        setAlbaranViewName(name);
        const mime = (contentType || '').toLowerCase();
        const nameLower = (name || '').toLowerCase();
        const isHeic =
          mime === 'image/heic' ||
          mime === 'image/heif' ||
          nameLower.endsWith('.heic') ||
          nameLower.endsWith('.heif');
        if (isHeic) {
          heicHandlesLoading = true;
          heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })
            .then((converted: Blob | Blob[]) => {
              if (revoked) return;
              const b = Array.isArray(converted) ? converted[0] : converted;
              if (b) {
                const u = URL.createObjectURL(b);
                albaranViewPreviewUrlRef.current = u;
                setAlbaranViewPreviewUrl(u);
              }
            })
            .catch(() => {
              if (!revoked) setAlbaranViewPreviewUrl(null);
            })
            .finally(() => {
              if (!revoked) setAlbaranViewLoading(false);
            });
        }
        if (contentType.startsWith('image/') && !isHeic) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (!revoked && e.target?.result) setAlbaranViewPreviewUrl(e.target.result as string);
          };
          reader.readAsDataURL(blob);
        }
        if (!heicHandlesLoading && !revoked) setAlbaranViewLoading(false);
      })
      .catch((err) => {
        if (!revoked) setAlbaranViewError(err?.message || 'No se pudo cargar el albarán');
      })
      .finally(() => {
        if (!revoked && !heicHandlesLoading) setAlbaranViewLoading(false);
      });
    return () => {
      revoked = true;
      if (albaranViewBlobUrlRef.current) {
        URL.revokeObjectURL(albaranViewBlobUrlRef.current);
        albaranViewBlobUrlRef.current = null;
      }
      if (albaranViewPreviewUrlRef.current) {
        URL.revokeObjectURL(albaranViewPreviewUrlRef.current);
        albaranViewPreviewUrlRef.current = null;
      }
    };
  }, [pedidoViendoAlbaran, albaranViewSelectedId]);

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

  // Funcții pentru stilizarea stării
  const getEstadoColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'entregado':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'enviado':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'aprobado':
        return '✅ Aprobado';
      case 'rechazado':
        return '❌ Rechazado';
      case 'pendiente':
        return '⏳ Pendiente';
      case 'entregado':
        return '📦 Entregado';
      case 'enviado':
        return '🚚 Enviado';
      default:
        return estado || 'Desconocido';
    }
  };

  // Selecție unul sau mai multe fișiere pentru albarán
  const handleAlbaranFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      const arr = Array.from(files);
      setAlbaranFiles(arr);
      const firstImg = arr.find((f) => f.type.startsWith('image/'));
      if (firstImg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAlbaranPreview(e.target?.result as string);
        };
        reader.readAsDataURL(firstImg);
      } else {
        setAlbaranPreview(null);
      }
    }
  };

  const handleUploadAlbaran = async () => {
    if (!pedidoCargandoAlbaran || albaranFiles.length === 0) {
      addToast('error', 'Error', 'Por favor selecciona al menos un archivo');
      return;
    }

    setUploadingAlbaran(true);
    try {
      const token = localStorage.getItem('auth_token');
      const uidForUpload = (pedidoCargandoAlbaran || '').replace(/^=+/, '');
      const encodedUid = encodeURIComponent(uidForUpload);
      const base = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
      const url = `${base}/api/pedidos/${encodedUid}/albaran`;

      for (const file of albaranFiles) {
        const formData = new FormData();
        formData.append('albaran', file);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        await response.json();
      }

      setPedidos((prev) =>
        prev.map((p) =>
          p.pedido_uid === pedidoCargandoAlbaran ? { ...p, estado: 'entregado' } : p,
        ),
      );

      addToast(
        'success',
        'Albarán(es) subido(s)',
        `${albaranFiles.length} archivo(s) subido(s). El pedido queda como entregado.`,
      );
      setPedidoCargandoAlbaran(null);
      setAlbaranFiles([]);
      setAlbaranPreview(null);
    } catch (error: unknown) {
      console.error('Error uploading albarán:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo subir el albarán';
      addToast('error', 'Error', errorMessage);
    } finally {
      setUploadingAlbaran(false);
    }
  };

  // Încarcă comenzile utilizatorului curent
  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = routes.getPedidos;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const pedidosArray = Array.isArray(data) ? data : [];

      // Obține numele comunității utilizatorului curent
      const userComunidadNombre = getCentroTrabajoFromUser(user);
      
      // Debug: Verifică toate variantele de CENTRO TRABAJO
      const centroVariants = {
        'CENTRO TRABAJO': user?.['CENTRO TRABAJO'],
        'CENTRO_TRABAJO': user?.['CENTRO_TRABAJO'],
        'CENTRO': user?.['CENTRO'],
        'CENTRO DE TRABAJO': user?.['CENTRO DE TRABAJO'],
        'centro_trabajo': user?.['centro_trabajo'],
        'centroTrabajo': user?.['centroTrabajo']
      };
      
      console.log('🔍 [TabMisPedidos] User info:', {
        comunidad_nombre: userComunidadNombre,
        centroVariants,
        userKeys: user ? Object.keys(user).filter(k => k.toLowerCase().includes('centro') || k.toLowerCase().includes('trabajo')) : []
      });
      console.log('🔍 [TabMisPedidos] Total pedidos received:', pedidosArray.length);
      
      // Filtrează comenzile după comunitate (nu după angajat)
      // Dacă utilizatorul nu are centru de lucru setat, nu afișa nimic
      const pedidosFiltrados = userComunidadNombre 
        ? pedidosArray.filter((pedido: Pedido) => {
            const pedidoComunidadNombre = pedido.comunidad?.nombre || '';
            
            // Compară numele comunității (case-insensitive, trim whitespace)
            const match = pedidoComunidadNombre && (
              String(userComunidadNombre).trim().toLowerCase() === String(pedidoComunidadNombre).trim().toLowerCase()
            );
            
            return match;
          })
        : []; // Dacă nu are centru setat, lista goală

      console.log('✅ [TabMisPedidos] Pedidos filtrados:', pedidosFiltrados.length, 'din', pedidosArray.length, 'total');
      setPedidos(pedidosFiltrados);
    } catch (error) {
      console.error('❌ Error loading pedidos:', error);
      addToast('error', 'Error', 'No se pudieron cargar los pedidos.');
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  // Funcție pentru a deschide modalul de editare
  const abrirEditarPedido = async (pedido: Pedido) => {
    if (pedido.estado?.toLowerCase() !== 'pendiente') {
      addToast('warning', 'No se puede editar', 'Solo se pueden editar pedidos con estado "Pendiente"');
      return;
    }

    setLimiteGastoEdicion(null);
    setPedidoEditando(pedido.pedido_uid);
    setProductosNuevos([]);
    
    // Încarcă produsele disponibile pentru comunitate
    if (pedido.comunidad?.id) {
      setLoadingProductos(true);
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `${routes.getCatalogo}?cliente_id=${pedido.comunidad.id}&cliente_nombre=${encodeURIComponent(pedido.comunidad.nombre || '')}`;
        const response = await fetch(url, { method: 'GET', headers });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const productosArray = Array.isArray(data) ? data as ProductoApiItem[] : [];
        // Map ProductoApiItem to Producto
        const productosMapped: Producto[] = productosArray.map((item: ProductoApiItem) => {
          let imagenBase64 = '';
          if (item.imagen_base64) {
            imagenBase64 = `data:image/jpeg;base64,${item.imagen_base64}`;
          } else if (item.fotoproducto?.data && Array.isArray(item.fotoproducto.data)) {
            imagenBase64 = bufferToBase64(item.fotoproducto.data);
          }
          return {
            id: item.producto_id || 0,
            numero: item.numero_articulo || '',
            descripcion: item.descripcion || '',
            precio: parseFloat(String(item.precio || 0)),
            permitido: item.permitido === 1 || item.permitido === true || item.permitido === '1',
            imagen: imagenBase64 || undefined
          };
        });
        setProductosDisponibles(productosMapped);

        try {
          const cr = await fetch(routes.getClientes, { method: 'GET', headers });
          if (cr.ok) {
            const all = await cr.json();
            const arr = Array.isArray(all) ? all : [];
            const cid = Number(pedido.comunidad.id);
            const cli = arr.find(
              (x: Record<string, unknown>) => Number(x.id ?? x.ID) === cid,
            );
            setLimiteGastoEdicion(
              parseLimiteGastoCliente(cli?.CuantoPuedeGastar ?? cli?.limite_gasto),
            );
          }
        } catch {
          setLimiteGastoEdicion(null);
        }
      } catch (error) {
        console.error('❌ Error loading productos:', error);
        addToast('error', 'Error', 'No se pudieron cargar los productos disponibles.');
      } finally {
        setLoadingProductos(false);
      }
    }
  };

  // Funcție pentru a adăuga un produs nou
  const agregarProductoNuevo = (producto: Producto) => {
    const pedidoBase = pedidos.find((p) => p.pedido_uid === pedidoEditando);
    if (!pedidoBase) return;

    const productoId = producto.id || producto.producto_id;
    const numeroArticulo = producto.numero || producto.numero_articulo || '';
    
    // Verifică dacă produsul există deja în lista de produse noi
    const productoExistenteIndex = productosNuevos.findIndex(
      (item) => (item.producto_id === productoId || item.numero_articulo === numeroArticulo) && productoId && numeroArticulo
    );
    
    let siguienteNuevos: LineaPedido[];

    if (productoExistenteIndex >= 0) {
      siguienteNuevos = [...productosNuevos];
      const item = { ...siguienteNuevos[productoExistenteIndex] };
      item.cantidad = (item.cantidad || 0) + 1;
      item.subtotal_linea = item.precio_unitario * item.cantidad;
      item.iva_linea = item.subtotal_linea * 0.21;
      item.total_linea = item.subtotal_linea + item.iva_linea;
      siguienteNuevos[productoExistenteIndex] = item;
    } else {
      const precio = parseFloat(String(producto.precio || 0));
      const nuevoItem: LineaPedido = {
        producto_id: productoId,
        numero_articulo: numeroArticulo,
        descripcion: producto.descripcion || '',
        cantidad: 1,
        precio_unitario: precio,
        subtotal_linea: precio,
        descuento_linea: 0,
        iva_porcentaje: 21,
        iva_linea: precio * 0.21,
        total_linea: precio * 1.21,
      };
      siguienteNuevos = [...productosNuevos, nuevoItem];
    }

    if (limiteGastoEdicion != null) {
      const merged = mergePedidoItemsConProductosNuevos(
        [...(pedidoBase.items || [])],
        siguienteNuevos,
      );
      const sub = subtotalPedidoItemsSinIva(merged);
      if (sub > limiteGastoEdicion + 0.02) {
        addToast(
          'error',
          'Límite excedido',
          `El subtotal (${sub.toFixed(2)} €) superaría el límite de gasto (${limiteGastoEdicion.toFixed(2)} €).`,
        );
        return;
      }
    }

    setProductosNuevos(siguienteNuevos);
    if (productoExistenteIndex >= 0) {
      addToast('info', 'Cantidad actualizada', `Se ha incrementado la cantidad de "${numeroArticulo}"`);
    }
  };

  // Funcție pentru a actualiza cantitatea unui produs nou (permite 0; onBlur pune 1)
  const actualizarCantidadProducto = (index: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 0) return;
    const pedidoBase = pedidos.find((p) => p.pedido_uid === pedidoEditando);
    if (!pedidoBase) return;

    const siguienteNuevos = [...productosNuevos];
    const item = { ...siguienteNuevos[index] };
    item.cantidad = nuevaCantidad;
    item.subtotal_linea = item.precio_unitario * nuevaCantidad;
    item.iva_linea = item.subtotal_linea * 0.21;
    item.total_linea = item.subtotal_linea + item.iva_linea;
    siguienteNuevos[index] = item;

    if (limiteGastoEdicion != null) {
      const merged = mergePedidoItemsConProductosNuevos(
        [...(pedidoBase.items || [])],
        siguienteNuevos,
      );
      const sub = subtotalPedidoItemsSinIva(merged);
      if (sub > limiteGastoEdicion + 0.02) {
        addToast(
          'error',
          'Límite excedido',
          `El subtotal (${sub.toFixed(2)} €) superaría el límite de gasto (${limiteGastoEdicion.toFixed(2)} €).`,
        );
        return;
      }
    }

    setProductosNuevos(siguienteNuevos);
  };

  // Funcție pentru a elimina un produs nou
  const eliminarProductoNuevo = (index: number) => {
    setProductosNuevos(productosNuevos.filter((_, i) => i !== index));
  };

  // Funcție pentru a salva modificările
  const guardarEdicionPedido = async () => {
    if (!pedidoEditando || productosNuevos.length === 0) {
      addToast('warning', 'Sin productos', 'Debes agregar al menos un producto nuevo');
      return;
    }

    setGuardando(true);
    try {
      const pedido = pedidos.find(p => p.pedido_uid === pedidoEditando);
      if (!pedido) {
        throw new Error('Pedido no encontrado');
      }

      const todosItems = mergePedidoItemsConProductosNuevos(
        [...(pedido.items || [])],
        productosNuevos,
      );

      const subtotal = subtotalPedidoItemsSinIva(todosItems);
      if (limiteGastoEdicion != null && subtotal > limiteGastoEdicion + 0.02) {
        addToast(
          'error',
          'Límite excedido',
          `El subtotal (${subtotal.toFixed(2)} €) supera el límite de gasto (${limiteGastoEdicion.toFixed(2)} €).`,
        );
        return;
      }

      // Calculează totalurile
      const iva_total = todosItems.reduce((sum, item) => sum + (item.iva_linea || 0), 0);
      const total = subtotal + iva_total;

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Decodează UID-ul dacă este encodat
      const pedidoUid = pedidoEditando.startsWith('=') ? pedidoEditando.substring(1) : pedidoEditando;
      const encodedUid = encodeURIComponent(pedidoUid);
      
      const base = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
      const url = `${base}/api/pedidos/${encodedUid}/items`;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          items: todosItems,
          subtotal,
          iva_total,
          total,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      addToast('success', 'Pedido actualizado', 'Los productos se han agregado correctamente al pedido');
      setPedidoEditando(null);
      setLimiteGastoEdicion(null);
      setProductosNuevos([]);
      setProductosDisponibles([]);
      
      // Reîncarcă comenzile
      await loadPedidos();
    } catch (error: unknown) {
      console.error('❌ Error saving pedido:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo actualizar el pedido';
      addToast('error', 'Error', errorMessage);
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  return (
    <div className="space-y-6">
      {/* Buton de actualizare */}
      <div className="flex justify-end">
        <button
          onClick={() => loadPedidos()}
          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
          title="Actualizar pedidos"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Lista de pedidos */}
      {loading ? (
        <Card>
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
          {pedidos.map((pedido: Pedido) => (
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
                      <div><strong>Comunidad:</strong> {pedido.comunidad?.nombre || 'N/A'}</div>
                      <div><strong>Fecha:</strong> {formatDate(pedido.fecha)}</div>
                      {pedido.fecha_envio && (
                        <div><strong>Fecha de Envío:</strong> {formatDate(pedido.fecha_envio)}</div>
                      )}
                      {pedido.aprobado_por && (
                        <div className="text-green-600">
                          <strong>✅ Aprobado por:</strong> {pedido.aprobado_por}
                          {pedido.aprobado_en && ` el ${formatDate(pedido.aprobado_en)}`}
                        </div>
                      )}
                      {pedido.rechazado_por && (
                        <div className="text-red-600">
                          <strong>❌ Rechazado por:</strong> {pedido.rechazado_por}
                          {pedido.rechazado_en && ` el ${formatDate(pedido.rechazado_en)}`}
                        </div>
                      )}
                    </div>
                    {pedido.notas && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Notas:</strong> {pedido.notas}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalii produse */}
                {pedidoSeleccionado === pedido.pedido_uid && pedido.items && pedido.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-gray-700 mb-3">Productos:</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Artículo</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items.map((item: LineaPedido, index: number) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2">{item.numero_articulo || 'N/A'}</td>
                              <td className="px-3 py-2">{item.descripcion || 'N/A'}</td>
                              <td className="px-3 py-2 text-right">{item.cantidad || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Butoane pentru a vedea/ascunde detalii și editare */}
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      setPedidoSeleccionado(pedidoSeleccionado === pedido.pedido_uid ? null : pedido.pedido_uid);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white"
                    size="sm"
                  >
                    {pedidoSeleccionado === pedido.pedido_uid ? '👁️ Ocultar Detalles' : '👁️ Ver Detalles'}
                  </Button>
                  {pedido.estado?.toLowerCase() === 'pendiente' && (
                    <Button
                      onClick={() => abrirEditarPedido(pedido)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      ✏️ Editar
                    </Button>
                  )}
                  {/* Ver albarán (entregado) vs Cargar albarán (aprobado/enviado) */}
                  {(pedido.estado?.toLowerCase() === 'aprobado' || pedido.estado?.toLowerCase() === 'enviado' || pedido.estado?.toLowerCase() === 'entregado') && (
                    <Button
                      onClick={() => {
                        if (pedido.estado?.toLowerCase() === 'entregado') {
                          setPedidoViendoAlbaran(pedido.pedido_uid);
                        } else {
                          setPedidoCargandoAlbaran(pedido.pedido_uid);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      📄 {pedido.estado?.toLowerCase() === 'entregado' ? 'Ver Albarán' : 'Cargar Albarán'}
                    </Button>
                  )}
                  {pedido.estado?.toLowerCase() === 'entregado' && (
                    <Button
                      onClick={() => setPedidoCargandoAlbaran(pedido.pedido_uid)}
                      className="bg-white border-2 border-green-600 text-green-800 hover:bg-green-50"
                      size="sm"
                      title="Subir más documentos de albarán"
                    >
                      ➕ Añadir albarán
                    </Button>
                  )}
                </div>

                {/* Avis de atenționare pentru albarán */}
                {(pedido.estado?.toLowerCase() === 'aprobado' || pedido.estado?.toLowerCase() === 'enviado' || pedido.estado?.toLowerCase() === 'entregado') && (
                  <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <span className="text-yellow-600 text-lg">⚠️</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-800 font-medium">
                          Importante: Antes de firmar el albarán, verifica que:
                        </p>
                        <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside space-y-1">
                          <li>Los productos recibidos coinciden con el pedido</li>
                          <li>Las cantidades son correctas</li>
                          <li>El estado de los productos es adecuado</li>
                          <li>No hay daños ni faltantes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de editare pentru comenzile pendiente */}
      {pedidoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">✏️ Editar Pedido: {pedidoEditando}</h2>
                <button
                  onClick={() => {
                    setPedidoEditando(null);
                    setLimiteGastoEdicion(null);
                    setProductosNuevos([]);
                    setProductosDisponibles([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Produse existente */}
              {(() => {
                const pedido = pedidos.find(p => p.pedido_uid === pedidoEditando);
                if (!pedido) return null;
                return (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Productos existentes:</h3>
                    {pedido.items && pedido.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-200">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Artículo</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Descripción</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Cantidad</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Precio</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pedido.items.map((item: LineaPedido, index: number) => (
                              <tr key={index} className="border-b">
                                <td className="px-3 py-2">{item.numero_articulo || 'N/A'}</td>
                                <td className="px-3 py-2">{item.descripcion || 'N/A'}</td>
                                <td className="px-3 py-2 text-right">{item.cantidad || 0}</td>
                                <td className="px-3 py-2 text-right">{formatMoney(item.precio_unitario)}</td>
                                <td className="px-3 py-2 text-right font-semibold">{formatMoney(item.total_linea || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No hay productos existentes</p>
                    )}
                  </div>
                );
              })()}

              {/* Produse noi de adăugat */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Agregar productos nuevos:</h3>
                
                {loadingProductos ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando productos...</p>
                  </div>
                ) : productosDisponibles.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay productos disponibles</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {productosDisponibles.map((producto) => (
                      <div
                        key={producto.id || producto.producto_id}
                        className="flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => agregarProductoNuevo(producto)}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{producto.numero || producto.numero_articulo || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{producto.descripcion || 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">{formatMoney(producto.precio || 0)}</div>
                          <button className="mt-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                            + Agregar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista produselor noi adăugate */}
              {productosNuevos.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Productos nuevos a agregar:</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Artículo</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Descripción</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Cantidad</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Precio</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">Total</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productosNuevos.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="px-3 py-2">{item.numero_articulo || 'N/A'}</td>
                            <td className="px-3 py-2">{item.descripcion || 'N/A'}</td>
                            <td className="px-3 py-2 text-right min-w-[11rem]">
                              <div className="flex items-center justify-end gap-1.5 w-fit ml-auto">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="!min-w-8 !w-8 !p-0 h-9 shrink-0"
                                  aria-label="Restar cantidad"
                                  onClick={() => actualizarCantidadProducto(index, Math.max(0, (item.cantidad || 0) - 1))}
                                >
                                  −
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.cantidad === 0 ? '' : item.cantidad}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '') actualizarCantidadProducto(index, 0);
                                    else { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) actualizarCantidadProducto(index, n); }
                                  }}
                                  onBlur={() => { if (item.cantidad === 0) actualizarCantidadProducto(index, 1); }}
                                  className="min-w-[5.5rem] w-28 px-2 py-1 border border-gray-300 rounded text-right shrink-0 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="!min-w-8 !w-8 !p-0 h-9 shrink-0"
                                  aria-label="Sumar cantidad"
                                  onClick={() => actualizarCantidadProducto(index, (item.cantidad || 0) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">{formatMoney(item.precio_unitario)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatMoney(item.total_linea)}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => eliminarProductoNuevo(index)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-right">
                    <div className="text-lg font-semibold text-gray-800">
                      Total nuevos productos: {formatMoney(productosNuevos.reduce((sum, item) => sum + item.total_linea, 0))}
                    </div>
                  </div>
                </div>
              )}

              {/* Butoane de acțiune */}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  onClick={() => {
                    setPedidoEditando(null);
                    setLimiteGastoEdicion(null);
                    setProductosNuevos([]);
                    setProductosDisponibles([]);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                  size="sm"
                  disabled={guardando}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={guardarEdicionPedido}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                  disabled={guardando || productosNuevos.length === 0}
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Albarán (vizualizare când pedido ya entregado) */}
      {pedidoViendoAlbaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">📄 Ver Albarán</h2>
              <button
                type="button"
                onClick={() => {
                  if (albaranViewBlobUrlRef.current) {
                    URL.revokeObjectURL(albaranViewBlobUrlRef.current);
                    albaranViewBlobUrlRef.current = null;
                  }
                  if (albaranViewPreviewUrlRef.current) {
                    URL.revokeObjectURL(albaranViewPreviewUrlRef.current);
                    albaranViewPreviewUrlRef.current = null;
                  }
                  setPedidoViendoAlbaran(null);
                  setAlbaranesListaMeta(null);
                  setAlbaranViewSelectedId(null);
                  setAlbaranViewBlobUrl(null);
                  setAlbaranViewPreviewUrl(null);
                  setAlbaranViewMime('');
                  setAlbaranViewName('');
                  setAlbaranViewError(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <p className="text-sm text-gray-600 mb-3">
                Pedido: <strong>{pedidoViendoAlbaran}</strong>
              </p>
              {albaranesListaMeta && albaranesListaMeta.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {albaranesListaMeta.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAlbaranViewSelectedId(a.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        albaranViewSelectedId === a.id
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                      }`}
                      title={a.nombre_archivo}
                    >
                      {i + 1}. {a.nombre_archivo.length > 28 ? `${a.nombre_archivo.slice(0, 28)}…` : a.nombre_archivo}
                    </button>
                  ))}
                </div>
              )}
              {albaranViewLoading && (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 inline-block"></span>
                  <span className="ml-3">Cargando albarán...</span>
                </div>
              )}
              {albaranViewError && !albaranViewLoading && (
                <div className="py-6 text-center">
                  <p className="text-red-600 mb-4">{albaranViewError}</p>
                  <Button
                    onClick={() => {
                      setPedidoViendoAlbaran(null);
                      setAlbaranesListaMeta(null);
                      setAlbaranViewSelectedId(null);
                      setAlbaranViewError(null);
                    }}
                    variant="outline"
                  >
                    Cerrar
                  </Button>
                </div>
              )}
              {albaranViewBlobUrl && !albaranViewLoading && !albaranViewError && (
                <>
                  <div className="mb-4 rounded-lg border border-gray-300 overflow-hidden bg-gray-100">
                    {(() => {
                      const mime = (albaranViewMime || '').toLowerCase();
                      const name = (albaranViewName || '').toLowerCase();
                      const isHeic =
                        mime === 'image/heic' || mime === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
                      const isPreviewableImage = mime.startsWith('image/') && !isHeic;
                      if (isHeic && albaranViewPreviewUrl) {
                        return (
                          <img
                            src={albaranViewPreviewUrl}
                            alt="Albarán"
                            className="max-w-full h-auto max-h-[70vh] mx-auto block"
                          />
                        );
                      }
                      if (isHeic && !albaranViewPreviewUrl) {
                        return (
                          <div className="p-8 text-center">
                            <p className="text-gray-600 mb-2">
                              📄 <strong>{albaranViewName}</strong>
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                              Vista previa no disponible para este formato (p. ej. HEIC). Use el botón{' '}
                              <strong>Descargar</strong> para ver el archivo en su dispositivo.
                            </p>
                            <a
                              href={albaranViewBlobUrl}
                              download={albaranViewName}
                              className="inline-flex items-center px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                            >
                              📥 Descargar albarán
                            </a>
                          </div>
                        );
                      }
                      if (isPreviewableImage) {
                        return (
                          <img
                            src={albaranViewPreviewUrl || albaranViewBlobUrl}
                            alt="Albarán"
                            className="max-w-full h-auto max-h-[70vh] mx-auto block"
                          />
                        );
                      }
                      return (
                        <iframe
                          title="Albarán"
                          src={albaranViewBlobUrl}
                          className="w-full h-[70vh] min-h-[400px] border-0"
                        />
                      );
                    })()}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <a
                      href={albaranViewBlobUrl}
                      download={albaranViewName}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                    >
                      📥 Descargar
                    </a>
                    <Button
                      onClick={() => {
                        if (albaranViewBlobUrlRef.current) {
                          URL.revokeObjectURL(albaranViewBlobUrlRef.current);
                          albaranViewBlobUrlRef.current = null;
                        }
                        if (albaranViewPreviewUrlRef.current) {
                          URL.revokeObjectURL(albaranViewPreviewUrlRef.current);
                          albaranViewPreviewUrlRef.current = null;
                        }
                        setPedidoViendoAlbaran(null);
                        setAlbaranesListaMeta(null);
                        setAlbaranViewSelectedId(null);
                        setAlbaranViewBlobUrl(null);
                        setAlbaranViewPreviewUrl(null);
                      }}
                      variant="outline"
                    >
                      Cerrar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru upload albarán */}
      {pedidoCargandoAlbaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">📄 Cargar Albarán</h2>
                <button
                  type="button"
                  onClick={() => {
                    setPedidoCargandoAlbaran(null);
                    setAlbaranFiles([]);
                    setAlbaranPreview(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Pedido: <strong>{pedidoCargandoAlbaran}</strong>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Puedes subir uno o varios archivos (foto o PDF). El pedido será marcado como &quot;Entregado&quot; automáticamente.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivos (PDF, JPG, PNG) — múltiples permitidos
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                  onChange={handleAlbaranFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {albaranPreview && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa (primera imagen):</p>
                  <div className="border border-gray-300 rounded-lg p-2">
                    <img 
                      src={albaranPreview} 
                      alt="Preview albarán" 
                      className="max-w-full h-auto max-h-64 mx-auto"
                    />
                  </div>
                </div>
              )}

              {albaranFiles.length > 0 && !albaranPreview && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    {albaranFiles.length} archivo(s) seleccionado(s):
                  </p>
                  <ul className="mt-1 text-sm list-disc list-inside text-gray-700 max-h-32 overflow-y-auto">
                    {albaranFiles.map((f) => (
                      <li key={`${f.name}-${f.size}`}>
                        <strong>{f.name}</strong> ({(f.size / 1024).toFixed(2)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    setPedidoCargandoAlbaran(null);
                    setAlbaranFiles([]);
                    setAlbaranPreview(null);
                  }}
                  variant="outline"
                  disabled={uploadingAlbaran}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadAlbaran}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={albaranFiles.length === 0 || uploadingAlbaran}
                >
                  {uploadingAlbaran ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                      Subiendo...
                    </>
                  ) : (
                    '📤 Subir albarán(es)'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== BANNER NOTAS INSTRUCCIONES =====
const BannerNotasInstrucciones: React.FC = () => {
  const [notas, setNotas] = useState<PedidosNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);

  // Încarcă notele
  const loadNotas = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(routes.getPedidosNotas, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📝 [BannerNotas] Loaded notas:', data.length);
        setNotas(data);
      } else {
        console.error('📝 [BannerNotas] Error response:', response.status, response.statusText);
      }
    } catch (error: unknown) {
      console.error('📝 [BannerNotas] Error loading notas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Încarcă notele la mount și actualizează periodic (la 30 secunde)
  useEffect(() => {
    console.log('📝 [BannerNotas] Component mounted, loading notas...');
    loadNotas();
    const interval = setInterval(loadNotas, 30000); // Actualizează la 30 secunde
    return () => clearInterval(interval);
  }, [loadNotas]);

  // Debug logging
  useEffect(() => {
    console.log('📝 [BannerNotas] State:', { loading, notasCount: notas.length, notas });
  }, [loading, notas]);

  // Dacă loading, nu afișăm nimic
  if (loading) {
    return null;
  }

  // Dacă nu există note, nu afișăm banner-ul
  if (notas.length === 0) {
    console.log('📝 [BannerNotas] No notas found, not showing banner');
    return null;
  }

  // Obține URL-ul complet pentru o poză
  const getImagenUrl = (rutaArchivo: string) => {
    if (rutaArchivo.startsWith('http')) return rutaArchivo;
    const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
    return `${baseUrl}${rutaArchivo}`;
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setAvisosAbiertos((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-purple-200/90 bg-gradient-to-r from-purple-50/95 to-white px-4 py-3 text-left shadow-sm transition hover:from-purple-100/90 hover:to-purple-50/80 dark:border-purple-900/50 dark:from-zinc-900 dark:to-zinc-900/95 dark:hover:from-zinc-800 dark:hover:to-zinc-900"
        aria-expanded={avisosAbiertos}
        id="avisos-pedidos-toggle"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-base" aria-hidden>
            📝
          </span>
          <span className="truncate font-semibold text-purple-900 dark:text-purple-200">
            Avisos importantes
          </span>
          <span className="shrink-0 rounded-full bg-purple-200/90 px-2 py-0.5 text-xs font-semibold text-purple-900 dark:bg-purple-800/80 dark:text-purple-100">
            {notas.length}
          </span>
        </span>
        <span className="shrink-0 text-purple-800 dark:text-purple-300" aria-hidden>
          {avisosAbiertos ? (
            <ChevronUp className="h-5 w-5" strokeWidth={2.25} />
          ) : (
            <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
          )}
        </span>
      </button>

      {avisosAbiertos && (
        <div className="mt-3 space-y-3" role="region" aria-labelledby="avisos-pedidos-toggle">
          {notas.map((nota) => (
            <Card
              key={nota.id}
              className="border-l-[3px] border-purple-400 bg-gradient-to-r from-purple-50/80 to-white shadow-sm transition-shadow dark:border-l-purple-500 dark:from-zinc-900/90 dark:to-zinc-950 dark:shadow-none"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/80">
                      <span className="text-base">📝</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {nota.titulo && (
                      <h3 className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-zinc-100">{nota.titulo}</h3>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
                      {nota.contenido}
                    </div>

                    {nota.imagenes && nota.imagenes.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                        {nota.imagenes.map((imagen: PedidosNotasImagen) => (
                          <div key={imagen.id} className="group relative">
                            <img
                              src={getImagenUrl(imagen.ruta_archivo)}
                              alt={imagen.nombre_archivo}
                              className="h-20 w-full cursor-pointer rounded border border-purple-200 object-cover transition-colors hover:border-purple-400 dark:border-zinc-600 dark:hover:border-zinc-500"
                              onClick={() => {
                                window.open(getImagenUrl(imagen.ruta_archivo), '_blank');
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-black bg-opacity-0 transition-opacity group-hover:bg-opacity-10">
                              <span className="text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                🔍
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmpleadoPedidosPage;
