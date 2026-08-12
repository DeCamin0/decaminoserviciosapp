import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, Input } from '../components/ui';
import ConfirmModal from '../components/ui/ConfirmModal';
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
import { useAdminApi } from '../hooks/useAdminApi';
import { routes } from '../utils/routes';
import { Link, Navigate } from 'react-router';
import { isDemoMode } from '../utils/demo';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import { config } from '../config/env';
import heic2any from 'heic2any';
import {
  parseLimiteGastoCliente,
  pedidoLimiteExcedidoFlags,
  shouldEnforcePedidoLimiteGasto,
  subtotalExceedsLimiteGasto,
} from '../utils/pedidosLimiteGasto';

/** Mensaje para el usuario desde el cuerpo de error API (Nest: `{ message: string }`). */
function messageFromApiErrorBody(body: string): string | null {
  if (body == null || typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const j = JSON.parse(trimmed) as { message?: unknown };
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
  } catch {
    /* no es JSON */
  }
  return trimmed;
}

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
  numero_articulo?: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  iva_porcentaje: number;
  subtotal_linea?: number;
  iva_linea?: number;
  total_linea?: number;
};

type PermisosState = {
  [comunidadId: number]: {
    [productoId: number]: boolean;
  };
};

type UserPermissions = Record<string, unknown> | null;

type Pedido = {
  pedido_uid: string;
  empleado?: {
    id?: string;
    nombre?: string;
    email?: string;
  };
  comunidad?: {
    id?: number;
    nombre?: string;
    direccion?: string;
    codigo_postal?: string;
    localidad?: string;
    provincia?: string;
    telefono?: string;
    email?: string;
    nif?: string;
    limite_gasto?: number | null;
  };
  fecha?: string;
  fecha_envio?: string;
  direccion_envio?: string;
  codigo_postal_envio?: string;
  localidad_envio?: string;
  provincia_envio?: string;
  aprobado_por?: string;
  aprobado_en?: string;
  rechazado_por?: string;
  rechazado_en?: string;
  total?: number;
  estado?: string;
  horario_entrega?: string;
  telefono_entrega?: string;
  items?: LineaPedido[];
  [key: string]: unknown;
};

type ProductoAPI = {
  producto_id?: number;
  numero_articulo?: string;
  descripcion?: string;
  precio?: number | string;
  permitido?: boolean | number;
  imagen?: string;
  imagen_base64?: string;
  fotoproducto?: {
    data?: number[];
  };
};

type PedidosNotasImagen = {
  id: number;
  nota_id: number;
  nombre_archivo: string;
  ruta_archivo?: string | null;
  url_archivo?: string | null;
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

type Cliente = {
  id?: number;
  ID?: number;
  NIF?: string;
  'NOMBRE O RAZON SOCIAL'?: string;
  'NOMBRE O RAZÓN SOCIAL'?: string;
  NOMBRE_O_RAZON_SOCIAL?: string;
  DIRECCION?: string;
  'CODIGO POSTAL'?: string;
  LOCALIDAD?: string;
  PROVINCIA?: string;
  TELEFONO?: string;
  EMAIL?: string;
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
    CuantoPuedeGastar?: string | number | null;
    limite_gasto?: string | number | null;
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] flex flex-col items-stretch gap-2 p-4 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] max-md:items-center md:inset-x-auto md:bottom-auto md:left-auto md:right-4 md:top-4 md:max-w-sm md:pb-4 md:pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 md:ml-auto">
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
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
  const [activeTab, setActiveTab] = useState<'nuevo-pedido' | 'permisos' | 'catalogo' | 'notas'>('nuevo-pedido');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const userGrupo = useMemo(() => user?.GRUPO || user?.grupo || 'Empleado', [user?.GRUPO, user?.grupo]);

  // Helper pentru verificarea permisiunilor
  const findGrupoKey = useCallback((grupo: string, permissions: UserPermissions) => {
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

  // 🔍 DEBUG: Log permisiunile încărcate
  useEffect(() => {
    console.log('🔍 [PedidosPage] ===== PERMISSIONS DEBUG =====');
    console.log('📋 [PedidosPage] User info:', {
      CODIGO: user?.CODIGO,
      GRUPO: user?.GRUPO || user?.grupo,
      NOMBRE: user?.['NOMBRE / APELLIDOS'] || user?.NOMBRE,
      isManager: user?.isManager,
    });
    console.log('🔐 [PedidosPage] Permissions state:', {
      userPermissions,
      loadingPermissions,
      userGrupo,
      hasBackendPermissions: userPermissions && Object.keys(userPermissions).length > 0,
      permissionsKeys: userPermissions ? Object.keys(userPermissions) : [],
    });
    
    if (userPermissions && userGrupo) {
      const grupoKey = findGrupoKey(userGrupo, userPermissions);
      const grupoPermissions = grupoKey ? userPermissions[grupoKey] : null;
      console.log('🔐 [PedidosPage] Grupo permissions:', {
        grupoKey,
        grupoPermissions: grupoPermissions ? {
          ...grupoPermissions,
          'pedidos-empleados': grupoPermissions['pedidos-empleados'],
          'pedidos-admin': grupoPermissions['pedidos-admin'],
          pedidos: grupoPermissions.pedidos, // Fallback
          allKeys: Object.keys(grupoPermissions),
        } : null,
      });
    }
    console.log('🔍 [PedidosPage] ===== END PERMISSIONS DEBUG =====\n');
  }, [userPermissions, loadingPermissions, userGrupo, user, findGrupoKey]);

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
  
  // ✅ ACTUALIZAT: Verifică ambele tipuri de permisiuni pedidos
  const hasPedidosEmpleadosPermission = shouldUseBackend ? hasPermission('pedidos-empleados') : false;
  const hasPedidosAdminPermission = shouldUseBackend ? hasPermission('pedidos-admin') : false;
  const hasPedidosPermissionOld = shouldUseBackend ? hasPermission('pedidos') : false; // Fallback pentru compatibilitate
  
  // ✅ Verifică DerechoPedidos din DatosEmpleados (similar cu DashboardPage)
  const checkField = (value: string | number | boolean | null | undefined) => {
    if (!value) return false;
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (typeof normalized === 'boolean') return normalized;
    if (typeof normalized === 'number') return normalized === 1;
    if (typeof normalized === 'string') {
      return ['s', 'si', 'sí', '1', 'y', 'yes', 'true'].includes(normalized);
    }
    return false;
  };

  const pedidosFields = [
    'derechopedido', 'DERECHO_PEDIDO', 'pedidos_permitido', 'canMakePedidos',
    'PEDIDOS_PERMITIDO', 'DERECHO_PEDIDOS', 'PEDIDOS_ACCESO', 'ACCESO_PEDIDOS',
    'PEDIDOS_HABILITADO', 'HABILITADO_PEDIDOS', 'PEDIDOS_ACTIVO', 'ACTIVO_PEDIDOS',
    'DerechoPedidos', 'derechoPedidos', 'derecho_pedidos',
  ];

  const hasFieldPermission = pedidosFields.some((field) => checkField(user?.[field]));
  const hasGenericPermission = Object.keys(user || {}).some(
    (key) => key.toLowerCase().includes('pedido') && checkField(user[key])
  );
  
  // ✅ CORECTAT: Permisiunea veche 'pedidos' este tratată ca acces limitat (pedidos-empleados), nu acces total
  // Doar managerii, adminii, developerii sau utilizatorii cu permisiunea 'pedidos-admin' pot accesa toate tab-urile
  // hasPedidosPermissionOld este folosită doar pentru a determina dacă utilizatorul are acces la pagina (dar cu acces limitat)
  const canAccessAllTabs = isManager || isAdmin || isDeveloper || hasPedidosAdminPermission;
  
  // ✅ NOU: Acces la "Mis Pedidos" pentru utilizatorii cu pedidos-empleados care au și DerechoPedidos
  const canAccessMisPedidos = hasPedidosEmpleadosPermission && (hasFieldPermission || hasGenericPermission);
  
  // 🔍 DEBUG: Log decizia finală
  console.log('🔍 [PedidosPage] Access decision:', {
    isManager,
    isAdmin,
    isDeveloper,
    hasPedidosEmpleadosPermission,
    hasPedidosAdminPermission,
    hasPedidosPermissionOld,
    hasFieldPermission,
    hasGenericPermission,
    canAccessAllTabs,
    canAccessMisPedidos,
    reason: isManager || isAdmin || isDeveloper ? 'isManager/isAdmin/isDeveloper' :
            hasPedidosAdminPermission ? 'hasPedidosAdminPermission (acces complet)' :
            canAccessMisPedidos ? 'hasPedidosEmpleadosPermission + DerechoPedidos (acces Mis Pedidos)' :
            (hasPedidosEmpleadosPermission || hasPedidosPermissionOld) ? 'hasPedidosEmpleadosPermission/hasPedidosPermissionOld (doar Nuevo Pedido)' :
            'NO ACCESS',
  });

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

  // ✅ Verificare acces: Dacă are pedidos-empleados dar NU are DerechoPedidos, nu are acces
  const hasAccess = useMemo(() => {
    // Acces complet: manager/admin/developer sau pedidos-admin
    if (canAccessAllTabs) {
      return true;
    }
    
    // Acces limitat: pedidos-empleados + DerechoPedidos
    if (canAccessMisPedidos) {
      return true;
    }
    
    // Permisiune veche 'pedidos' (pentru compatibilitate) - verifică și DerechoPedidos
    if (hasPedidosPermissionOld) {
      const hasOldPermissionWithDerecho = hasFieldPermission || hasGenericPermission;
      if (hasOldPermissionWithDerecho) {
        return true;
      }
    }
    
    // Nu are acces
    return false;
  }, [canAccessAllTabs, canAccessMisPedidos, hasPedidosPermissionOld, hasFieldPermission, hasGenericPermission]);

  // Dacă nu are acces, redirect la inicio
  if (!loadingPermissions && !hasAccess) {
    console.warn('🚫 [PedidosPage] Access denied - redirecting to /inicio');
    return <Navigate to="/inicio" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
      {/* Banner cu instrucțiuni pentru utilizatorii cu acces limitat */}
      {/* Se afișează pentru utilizatorii care au pedidos-empleados dar NU au pedidos-admin */}
      {(() => {
        // Banner-ul apare pentru utilizatorii cu acces limitat (pedidos-empleados, fără acces complet)
        const shouldShow = !canAccessAllTabs && (hasPedidosEmpleadosPermission || hasPedidosPermissionOld || canAccessMisPedidos);
        console.log('📝 [PedidosPage] Banner check:', { 
          canAccessAllTabs, 
          hasPedidosEmpleadosPermission,
          hasPedidosPermissionOld,
          canAccessMisPedidos,
          shouldShow 
        });
        return shouldShow ? <BannerNotasInstrucciones /> : null;
      })()}
      
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
            {/* Tab "Gestionar Pedidos" apare pentru canAccessAllTabs SAU canAccessMisPedidos */}
            {(canAccessAllTabs || canAccessMisPedidos) && (
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
                    <span>{canAccessAllTabs ? 'Gestionar Pedidos' : 'Mis Pedidos'}</span>
                  </div>
                </button>
                
                {/* Tab-uri doar pentru acces complet (canAccessAllTabs) */}
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
                    
                    <button
                      onClick={() => setActiveTab('notas')}
                      className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                        activeTab === 'notas'
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                          : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                        activeTab === 'notas' 
                          ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                          : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
                      }`}></div>
                      <div className="relative flex items-center gap-2">
                        <span className="text-xl">📝</span>
                        <span>Notas</span>
                      </div>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Content */}
        {activeTab === 'nuevo-pedido' ? (
          <TabNuevoPedido addToast={addToast} canAccessAllTabs={canAccessAllTabs} />
        ) : (canAccessAllTabs || canAccessMisPedidos) && activeTab === 'gestionar-pedidos' ? (
          <TabGestionarPedidos addToast={addToast} canAccessAllTabs={canAccessAllTabs} />
        ) : canAccessAllTabs && activeTab === 'permisos' ? (
          <TabPermisosComunidad addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'catalogo' ? (
          <TabCatalogo addToast={addToast} />
        ) : canAccessAllTabs && activeTab === 'notas' ? (
          <TabNotas addToast={addToast} />
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
  const enforceLimiteGasto = shouldEnforcePedidoLimiteGasto(user);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'id' | 'numero' | 'descripcion' | 'precio'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [notas, setNotas] = useState('');
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<ComunidadDetalle | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos] = useState(false);
  const [recentHistoryPedidos, setRecentHistoryPedidos] = useState<Pedido[]>([]);
  const [recentPedidoSourceReady, setRecentPedidoSourceReady] = useState(false);
  const [nuevoPedidoStep, setNuevoPedidoStep] = useState<'products' | 'review'>('products');
  const [pedidoSubmitLoading, setPedidoSubmitLoading] = useState(false);

  // State pentru searchable dropdown
  const [comunidadSearchTerm, setComunidadSearchTerm] = useState('');
  const [showComunidadDropdown, setShowComunidadDropdown] = useState(false);
  
  // State pentru Horario Entrega y Teléfono Entrega
  const [horarioEntrega, setHorarioEntrega] = useState('');
  const [horarioEntregaTipo, setHorarioEntregaTipo] = useState<'24horas' | '12horas' | 'personalizado' | ''>('');
  const [telefonoEntrega, setTelefonoEntrega] = useState('');
  const [loadingHorario, setLoadingHorario] = useState(false);

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
          .map((cliente, index) => {
            // Folosește ID-ul real din baza de date, nu index + 1
            const clienteId = cliente.id || cliente.ID || (index + 1);
            return {
              id: clienteId,
              nombre: cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || 'Sin nombre',
              datosCompletos: cliente // Păstrăm datele complete ale clientului
            };
          })
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
                    setHorarioEntregaTipo('personalizado');
                    setHorarioEntrega(servicioStr);
                  } else {
                    setHorarioEntregaTipo('');
                    setHorarioEntrega('');
                  }
                } else {
                  setHorarioEntregaTipo('');
                  setHorarioEntrega('');
                }
                const telEnt = comunidadParcial.datosCompletos?.['TELEFONO ENTREGA'] ||
                  comunidadParcial.datosCompletos?.TELEFON_ENTREGA ||
                  comunidadParcial.datosCompletos?.telefono_entrega || '';
                setTelefonoEntrega(telEnt ? String(telEnt).trim() : '');
                
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
  }, [comunidades, canAccessAllTabs, user]);

  // Flag pentru a preveni request-urile duplicate în handleComunidadChange
  const isLoadingComunidadRef = React.useRef(false);
  const lastComunidadIdRef = React.useRef<number | null>(null);
  const lastCallTimeRef = React.useRef<number>(0);

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
            // Folosește imagen_base64 sau imagen direct din backend
            let imagenBase64 = '';
            // Verifică dacă există deja imagen cu prefix (din getCatalogo)
            if (item.imagen && item.imagen.trim() !== '') {
              imagenBase64 = item.imagen;
            } else if (item.imagen_base64 && item.imagen_base64 !== null && item.imagen_base64.trim() !== '') {
              // Backend returnează base64 fără prefix, adăugăm prefixul
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
          // Verifică dacă există deja imagen cu prefix (din getCatalogo)
          let imagenBase64Single = '';
          if (data.imagen && data.imagen.trim() !== '') {
            imagenBase64Single = data.imagen;
          } else if (data.imagen_base64 && data.imagen_base64 !== null && data.imagen_base64.trim() !== '') {
            imagenBase64Single = `data:image/jpeg;base64,${data.imagen_base64}`;
          } else if (data.fotoproducto && data.fotoproducto.data && Array.isArray(data.fotoproducto.data)) {
            imagenBase64Single = bufferToBase64(data.fotoproducto.data);
          }
          
          productosConPermisos = [{
            id: data.producto_id || data.id,
            numero: data.numero_articulo || data.numero,
            descripcion: data.descripcion,
            precio: parseFloat(data.precio),
            permitido: data.permitido === 1 || data.permitido === true || true, // Dacă vine din getCatalogo, toate sunt permise
            imagen: imagenBase64Single || undefined
          }];
        }
        
        console.log('📦 Productos con permisos mapeados:', productosConPermisos);
        
        // Log pentru imagini
        const productosConImagen = productosConPermisos.filter(p => p.imagen).length;
        console.log(`📸 Productos con imagen: ${productosConImagen}/${productosConPermisos.length}`);
        
        // Actualizează produsele cu permisiunile lor
        setProductos(productosConPermisos);
        
        // Actualizează horarioEntrega din datosCompletos
        const servicioEntrega = comunidad?.datosCompletos?.['SERVICIO ENTREGA'] || 
                               comunidad?.datosCompletos?.SERVICIO_ENTREGA || 
                               comunidad?.datosCompletos?.servicio_entrega || '';
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
        const telefonoEntregaCliente = comunidad?.datosCompletos?.['TELEFONO ENTREGA'] ||
          comunidad?.datosCompletos?.TELEFON_ENTREGA ||
          comunidad?.datosCompletos?.telefono_entrega || '';
        setTelefonoEntrega(telefonoEntregaCliente ? String(telefonoEntregaCliente).trim() : '');
        
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

  // Filtrare și sortare produse
  const productosFiltrados = useMemo(() => {
    // Filtrare
    let filtered = productos;
    if (searchTerm) {
      filtered = productos.filter(producto => 
        producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sortare
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'numero':
          aValue = a.numero || '';
          bValue = b.numero || '';
          break;
        case 'descripcion':
          aValue = a.descripcion || '';
          bValue = b.descripcion || '';
          break;
        case 'precio':
          aValue = a.precio || 0;
          bValue = b.precio || 0;
          break;
        case 'id':
        default:
          aValue = a.id || 0;
          bValue = b.id || 0;
          break;
      }
      
      // Comparare
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'es', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
    
    return sorted;
  }, [searchTerm, productos, sortField, sortDirection]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (comunidadSeleccionada == null) {
        if (!cancelled) {
          setRecentHistoryPedidos([]);
          setRecentPedidoSourceReady(true);
        }
        return;
      }
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
        const arr = Array.isArray(data) ? data : [];
        const filtered = arr.filter((p) => Number(p.comunidad?.id) === Number(comunidadSeleccionada));
        const source = filtered.length > 0 ? filtered : arr;
        if (!cancelled) {
          setRecentHistoryPedidos(source);
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
  }, [comunidadSeleccionada]);

  React.useEffect(() => {
    if (lineasPedido.length === 0 && nuevoPedidoStep === 'review') {
      setNuevoPedidoStep('products');
    }
  }, [lineasPedido.length, nuevoPedidoStep]);

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

  const getLimiteGastoCliente = (): number | null => {
    const c = comunidades.find((x) => x.id === comunidadSeleccionada) as
      | { datosCompletos?: Record<string, unknown> }
      | undefined;
    const d = c?.datosCompletos;
    const raw = d?.CuantoPuedeGastar ?? d?.limite_gasto;
    return parseLimiteGastoCliente(raw);
  };

  const setCantidadProductoEnPedido = (producto: Producto, newQty: number) => {
    const q = Math.max(0, Math.floor(Number(newQty) || 0));
    const current = sumQtyForProduct(lineasPedido, producto.id);
    if (q === current) return;
    const delta = q - current;
    if (delta > 0) {
      const limite = getLimiteGastoCliente();
      if (enforceLimiteGasto && limite != null) {
        const totalActual = lineasPedido.reduce(
          (sum, linea) => sum + linea.cantidad * linea.precio_unitario,
          0,
        );
        if (subtotalExceedsLimiteGasto(totalActual + delta * producto.precio, limite)) {
          addToast(
            'error',
            'Límite excedido',
            'No se puede superar el límite de gasto del cliente.',
          );
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

    const limiteClienteGuardar = getLimiteGastoCliente();
    if (enforceLimiteGasto && limiteClienteGuardar != null) {
      if (subtotalExceedsLimiteGasto(subtotal, limiteClienteGuardar)) {
        addToast(
          'error',
          'Límite excedido',
          `El subtotal (${subtotal.toFixed(2)} €) supera el límite de gasto (${limiteClienteGuardar.toFixed(2)} €).`,
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

      const comunidadDetalle = comunidades.find(c => c.id === comunidadSeleccionada);
      const comunidadId = comunidadDetalle?.datosCompletos?.id || comunidadSeleccionada;
      const comunidadNombre = comunidadDetalle?.nombre || 'Sin comunidad';

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

    const comunidadNombre = comunidades.find(c => c.id === comunidadSeleccionada)?.nombre || 'Sin comunidad';
    const comunidadDetalle = comunidades.find(c => c.id === comunidadSeleccionada);
    const limiteClientePayload = getLimiteGastoCliente();
    const limiteFlags = pedidoLimiteExcedidoFlags(subtotal, limiteClientePayload);

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
        // Folosește ID-ul real din datosCompletos dacă există, altfel folosește comunidadSeleccionada
        id: comunidadDetalle?.datosCompletos?.id || comunidadSeleccionada,
        nombre: comunidadNombre,
        direccion: comunidadDetalle?.datosCompletos?.DIRECCION || 'N/A',
        codigo_postal: comunidadDetalle?.datosCompletos?.['CODIGO POSTAL'] || 'N/A',
        localidad: comunidadDetalle?.datosCompletos?.LOCALIDAD || comunidadDetalle?.datosCompletos?.POBLACION || 'N/A',
        provincia: comunidadDetalle?.datosCompletos?.PROVINCIA || 'N/A',
        telefono: comunidadDetalle?.datosCompletos?.TELEFONO || 'N/A',
        email: comunidadDetalle?.datosCompletos?.EMAIL || 'N/A',
        nif: comunidadDetalle?.datosCompletos?.NIF || 'N/A',
        limite_gasto: limiteClientePayload ?? 0
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
        limite_excedido: limiteFlags.limite_excedido,
        exceso_limite: limiteFlags.exceso_limite,
        estado: 'pendiente',
        horario_entrega: horarioEntrega.trim(),
        telefono_entrega: telefonoEntrega.trim(),
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
          let servicioActualizado = false;
          if (horarioEntrega.trim() && (comunidadDetalles?.id || comunidadSeleccionada)) {
            try {
              const clienteId = typeof comunidadDetalles?.id === 'number' 
                ? comunidadDetalles.id 
                : typeof comunidadDetalles?.datosCompletos?.id === 'number'
                  ? comunidadDetalles.datosCompletos.id
                  : comunidadSeleccionada;
              
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
                  const updateData = await updateResponse.json();
                  if (updateData.status === 'ok' || updateResponse.status === 200) {
                    servicioActualizado = true;
                    console.log('✅ SERVICIO_ENTREGA actualizado en Clientes:', horarioEntrega.trim());
                  } else {
                    console.warn('⚠️ No se pudo actualizar SERVICIO_ENTREGA:', updateData);
                  }
                } else {
                  const errorText = await updateResponse.text();
                  console.warn('⚠️ Error actualizando SERVICIO_ENTREGA:', errorText);
                }
              }
            } catch (error) {
              console.error('Error actualizando SERVICIO_ENTREGA:', error);
            }
          }
          
          const mensaje = servicioActualizado 
            ? `Pedido ${responseData.pedido_uid} guardado correctamente. Horario Entrega actualizado en Clientes. Está pendiente de aprobación.`
            : `Pedido ${responseData.pedido_uid} guardado correctamente. Está pendiente de aprobación.`;
          
          addToast('success', 'Pedido guardado', mensaje);
          
          // Resetează comanda după salvarea cu succes
          setLineasPedido([]);
          setNotas('');
          setNuevoPedidoStep('products');
          // Nu resetăm horarioEntrega pentru a păstra valoarea pentru următorul pedido
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

  const handleEnviarPedido = async () => {
    setPedidoSubmitLoading(true);
    try {
      await guardarBorrador();
    } finally {
      setPedidoSubmitLoading(false);
    }
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

  return (
    <div
      className={`space-y-6 ${!isReviewStep && cartProductCount > 0 ? 'pb-24 max-md:pb-28' : ''}`}
    >
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
          limiteGasto={getLimiteGastoCliente()}
          enforceLimiteGasto={enforceLimiteGasto}
          subtotal={subtotal}
          entregaAlert={entregaPendienteMensaje}
        />
      ) : (
        <>
      {/* Informații utilizator */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Información del Pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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

      {/* Catálogo: zona clară, +/- sincroniza líneas (sin botón Añadir) */}
      <section
        className="-mx-1 border-y border-zinc-200/90 bg-zinc-50 px-3 py-5 text-zinc-900 sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:py-6 dark:border-zinc-200/80 dark:bg-zinc-50 dark:text-zinc-900 [&_input]:text-zinc-900 [&_label]:text-zinc-700"
        style={{ colorScheme: 'light' }}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold !text-zinc-800" style={{ color: '#27272a' }}>
            Buscar productos
            {productos.length > 0 && (
              <span className="ml-2 text-sm font-normal !text-zinc-500" style={{ color: '#71717a' }}>
                ({productos.length} en catálogo)
              </span>
            )}
          </h3>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <Input
                label="Buscar por número o descripción"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ej: A-100 o Pintura blanca"
              />
            </div>
            <div className="flex shrink-0 items-end gap-2">
              <div className="flex flex-col">
                <label className="mb-1 text-sm font-medium text-zinc-600">Ordenar por</label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as 'id' | 'numero' | 'descripcion' | 'precio')}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/40"
                >
                  <option value="id">ID</option>
                  <option value="numero">Número</option>
                  <option value="descripcion">Descripción</option>
                  <option value="precio">Precio</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-100"
                title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {loadingProductos ? (
          <div className="flex justify-center py-10">
            <div className="text-center">
              <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-400" />
              <p className="text-zinc-600">Cargando productos...</p>
            </div>
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
                productosFiltrados.map((producto, index) => (
                  <ProductListItem
                    key={producto.id || `producto-${index}`}
                    product={{
                      id: producto.id,
                      numero: producto.numero,
                      descripcion: producto.descripcion,
                      imagen: producto.imagen,
                      precio: producto.precio,
                    }}
                    quantityInCart={sumQtyForProduct(lineasPedido, producto.id)}
                    onQuantityInCartChange={(n) => setCantidadProductoEnPedido(producto, n)}
                    showPrice
                    formatPrice={formatMoney}
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

/** ID comunitate din pedido (listă API: nested sau rădăcină). */
function pedidoComunidadIdStable(p: Pedido): number | null {
  const nested = p.comunidad?.id;
  if (nested != null && String(nested).trim() !== '') {
    const n = Number(nested);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const top = (p as Record<string, unknown>).comunidad_id;
  if (top != null && String(top).trim() !== '') {
    const n = Number(top);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function normalizeNif(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .toUpperCase();
}

/**
 * Cheie stabilă pentru filtrul «Filtrar por centro»: nu depinde de ortografia numelui.
 * Prioritate: id client > NIF/CIF > nume (ultimul recurs).
 */
function pedidoCentroFiltroKey(p: Pedido): string {
  const id = pedidoComunidadIdStable(p);
  if (id != null) return `id:${id}`;
  const nif = normalizeNif(p.comunidad?.nif);
  if (nif) return `nif:${nif}`;
  const name = (p.comunidad?.nombre || '').trim();
  return name ? `name:${name}` : '';
}

// ===== TAB GESTIONAR PEDIDOS =====
const TabGestionarPedidos: React.FC<{ 
  addToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  canAccessAllTabs?: boolean;
}> = ({ addToast, canAccessAllTabs = false }) => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('all');
  const [filtroCentro, setFiltroCentro] = useState<string>('all');
  const [filtroAn, setFiltroAn] = useState<string>('all');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [pedidoEditando, setPedidoEditando] = useState<string | null>(null);
  const [mostrarAgregarProducto, setMostrarAgregarProducto] = useState<string | null>(null);
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([]);
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  const [searchProductoTerm, setSearchProductoTerm] = useState('');
  const [sortFieldProductos, setSortFieldProductos] = useState<'id' | 'numero' | 'descripcion' | 'precio'>('id');
  const [sortDirectionProductos, setSortDirectionProductos] = useState<'asc' | 'desc'>('asc');
  const [fechasEnvio, setFechasEnvio] = useState<Record<string, string>>({});
  const [direccionesEnvio, setDireccionesEnvio] = useState<Record<string, {
    direccion_envio?: string;
    codigo_postal_envio?: string;
    localidad_envio?: string;
    provincia_envio?: string;
    telefono_entrega?: string;
  }>>({});
  const [horariosEntrega, setHorariosEntrega] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteSearchTerms, setClienteSearchTerms] = useState<Record<string, string>>({});
  const [showClienteDropdowns, setShowClienteDropdowns] = useState<Record<string, boolean>>({});
  const [addressSuggestions, setAddressSuggestions] = useState<Record<string, Array<{ display_name: string; address?: { road?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string; state?: string } }>>>({});
  const [showAddressSuggestions, setShowAddressSuggestions] = useState<Record<string, boolean>>({});
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState<Record<string, boolean>>({});
  const addressSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mostrarPreviewEnvio, setMostrarPreviewEnvio] = useState(false);
  const [mostrarSeleccionEnvio, setMostrarSeleccionEnvio] = useState(false);
  const [uidsSeleccionadosEnvio, setUidsSeleccionadosEnvio] = useState<Record<string, boolean>>({});
  const [pedidosParaEnviar, setPedidosParaEnviar] = useState<Pedido[]>([]);
  const [mostrarModalExcel, setMostrarModalExcel] = useState(false);
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null);
  const [mensajeProveedor, setMensajeProveedor] = useState('');
  const [enviandoProveedor, setEnviandoProveedor] = useState(false);
  const [serviciosEntrega, setServiciosEntrega] = useState<Record<number, string>>({});
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [pedidoCargandoAlbaran, setPedidoCargandoAlbaran] = useState<string | null>(null);
  const [copiandoPedidoUid, setCopiandoPedidoUid] = useState<string | null>(null);
  const [copiaConfirmPedido, setCopiaConfirmPedido] = useState<Pedido | null>(null);
  const [deleteConfirmUid, setDeleteConfirmUid] = useState<string | null>(null);
  const [albaranDeleteConfirm, setAlbaranDeleteConfirm] = useState(false);
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
  /** Data URL pentru preview la imagini (mai fiabil decât blob URL în <img>) */
  const [albaranViewPreviewUrl, setAlbaranViewPreviewUrl] = useState<string | null>(null);
  const [albaranViewMime, setAlbaranViewMime] = useState<string>('');
  const [albaranViewName, setAlbaranViewName] = useState<string>('');
  const [albaranViewLoading, setAlbaranViewLoading] = useState(false);
  const [albaranViewDeleting, setAlbaranViewDeleting] = useState(false);
  const [albaranViewError, setAlbaranViewError] = useState<string | null>(null);
  const albaranViewBlobUrlRef = React.useRef<string | null>(null);
  const albaranViewPreviewUrlRef = React.useRef<string | null>(null);

  /** Opțiuni dropdown: o intrare per client real (id sau NIF), etichetă = numele cel mai recent. */
  const opcionesCentroFiltro = useMemo(() => {
    const agg = new Map<string, { label: string; ts: number }>();
    for (const p of pedidos) {
      const key = pedidoCentroFiltroKey(p);
      if (!key) continue;
      const nombre = (p.comunidad?.nombre || '').trim() || '—';
      const ts =
        Date.parse(String(p.fecha || p.fecha_envio || (p as Record<string, unknown>).creado_en || '')) || 0;
      const cur = agg.get(key);
      if (!cur || ts > cur.ts || (ts === cur.ts && nombre.length > cur.label.length)) {
        agg.set(key, { label: nombre, ts });
      }
    }
    return Array.from(agg.entries())
      .map(([value, { label }]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [pedidos]);

  // Migrează filtru vechi (doar după nume exact) la cheie stabilă când se încarcă pedidos
  React.useEffect(() => {
    if (filtroCentro === 'all') return;
    if (filtroCentro.startsWith('id:') || filtroCentro.startsWith('nif:') || filtroCentro.startsWith('name:')) {
      const ok = opcionesCentroFiltro.some((o) => o.value === filtroCentro);
      if (!ok) setFiltroCentro('all');
      return;
    }
    const byLabel = opcionesCentroFiltro.find((o) => o.label === filtroCentro);
    if (byLabel) {
      setFiltroCentro(byLabel.value);
      return;
    }
    const fromPedido = pedidos.find((p) => (p.comunidad?.nombre || '').trim() === filtroCentro.trim());
    if (fromPedido) {
      setFiltroCentro(pedidoCentroFiltroKey(fromPedido));
      return;
    }
    setFiltroCentro('all');
  }, [pedidos, opcionesCentroFiltro, filtroCentro]);

  // Pedidos filtrate după estado, centro și an
  const pedidosFiltrados = useMemo(() => {
    let filtered = pedidos;

    // Filtrare după estado
    if (filtroEstado !== 'all') {
      filtered = filtered.filter(p => p.estado === filtroEstado);
    }

    // Filtrare după centro: cheie stabilă (id / NIF), nu string-ul numelui
    if (filtroCentro !== 'all') {
      filtered = filtered.filter((p) => pedidoCentroFiltroKey(p) === filtroCentro);
    }

    // Filtrare după an
    if (filtroAn !== 'all') {
      filtered = filtered.filter(p => {
        if (!p.fecha) return false;
        const date = new Date(p.fecha);
        const an = date.getFullYear().toString();
        return an === filtroAn;
      });
    }

    return filtered;
  }, [pedidos, filtroEstado, filtroCentro, filtroAn]);

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
        const isHeic = mime === 'image/heic' || mime === 'image/heif' || nameLower.endsWith('.heic') || nameLower.endsWith('.heif');
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
            .catch(() => { if (!revoked) setAlbaranViewPreviewUrl(null); })
            .finally(() => { if (!revoked) setAlbaranViewLoading(false); });
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

  // Produse disponibile filtrate și sortate
  const productosDisponiblesFiltrados = useMemo(() => {
    // Filtrare
    let filtered = productosDisponibles;
    if (searchProductoTerm) {
      filtered = productosDisponibles.filter(p => 
        p.numero.toLowerCase().includes(searchProductoTerm.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(searchProductoTerm.toLowerCase())
      );
    }
    
    // Sortare
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortFieldProductos) {
        case 'numero':
          aValue = a.numero || '';
          bValue = b.numero || '';
          break;
        case 'descripcion':
          aValue = a.descripcion || '';
          bValue = b.descripcion || '';
          break;
        case 'precio':
          aValue = a.precio || 0;
          bValue = b.precio || 0;
          break;
        case 'id':
        default:
          aValue = a.id || 0;
          bValue = b.id || 0;
          break;
      }
      
      // Comparare
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirectionProductos === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'es', { numeric: true, sensitivity: 'base' });
        return sortDirectionProductos === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
    
    return sorted;
  }, [productosDisponibles, searchProductoTerm, sortFieldProductos, sortDirectionProductos]);

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

  // Format doar dată (zi/lună/an) pentru afișare - Fecha de Envío fără oră
  const formatDateOnly = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  // Format pentru input type="date" (YYYY-MM-DD) - Fecha de Envío fără oră
  const formatDateOnlyForInput = (date: string | Date | null | undefined): string => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Încarcă comenzile
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
      
      let pedidosArray = Array.isArray(data) ? data : [];
      
      // ✅ Filtrează pedidosurile după comunitate dacă utilizatorul nu are acces complet
      if (!canAccessAllTabs && user) {
        const userComunidadNombre = user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO;
        if (userComunidadNombre) {
          pedidosArray = pedidosArray.filter((pedido: Pedido) => {
            const pedidoComunidadNombre = pedido.comunidad?.nombre || '';
            const match = userComunidadNombre && pedidoComunidadNombre && (
              String(userComunidadNombre).trim().toLowerCase() === String(pedidoComunidadNombre).trim().toLowerCase()
            );
            return match;
          });
          console.log('🔍 [TabGestionarPedidos] Filtered pedidos by comunidad:', userComunidadNombre, 'Result:', pedidosArray.length);
        }
      }
      
      setPedidos(pedidosArray);
      
      // Încarcă SERVICIO_ENTREGA din Clientes pentru fiecare pedido
      if (pedidosArray.length > 0) {
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

          // Obține toate ID-urile unice de comunități
          const comunidadIds = [...new Set(pedidosArray
            .map((p: Pedido) => p.comunidad?.id)
            .filter((id): id is number | string => id !== undefined && id !== null)
          )];

          if (comunidadIds.length > 0) {
            // Încarcă toți clienții o singură dată
            const response = await fetch(routes.getClientes, {
              method: 'GET',
              headers,
            });
            
            if (response.ok) {
              const clientes = await response.json();
              const clientesArray = Array.isArray(clientes) ? clientes : [clientes];
              
              // Creează un map cu horariosEntrega pentru fiecare comunidadId
              const horariosMap: Record<string, string> = {};
              
              for (const comunidadId of comunidadIds) {
                const cliente = clientesArray.find((c: Cliente) => 
                  (c.id || c.ID) == comunidadId
                );
                
                if (cliente) {
                  const servicioEntrega = cliente['SERVICIO ENTREGA'] || 
                                         cliente.SERVICIO_ENTREGA || 
                                         cliente.servicio_entrega || '';
                  if (servicioEntrega) {
                    horariosMap[String(comunidadId)] = String(servicioEntrega).trim();
                  }
                }
              }
              
              setHorariosEntrega(horariosMap);
            }
          }
        } catch (error) {
          console.error('Error loading horarios entrega:', error);
        }
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('⚠️ No pedidos found or invalid response format');
      }
    } catch (error) {
      console.error('❌ Error loading pedidos:', error);
      const isTimeout =
        error instanceof Error &&
        (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
      addToast(
        'error',
        isTimeout ? 'Tiempo de espera agotado' : 'Error',
        isTimeout
          ? 'La carga de pedidos tardó demasiado. Comprueba la conexión y pulsa «Actualizar». Si persiste, cierra sesión y vuelve a entrar.'
          : 'No se pudieron cargar los pedidos. Pulsa «Actualizar» o inicia sesión de nuevo.',
      );
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, addToast, canAccessAllTabs, user]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  // Șterge un pedido
  const handleDeletePedido = async (pedidoUid: string) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.deletePedido(pedidoUid), {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      addToast('success', 'Pedido eliminado', result.message || `Pedido ${pedidoUid} eliminado correctamente (${result.deletedRows || 0} fila(s) eliminada(s))`);
      
      // Recargar pedidos
      await loadPedidos();
    } catch (error: unknown) {
      console.error('Error eliminando pedido:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `No se pudo eliminar el pedido: ${errorMessage}`);
    }
  };

  const inferIvaPorcentajeItem = (item: LineaPedido): number => {
    if (item.iva_porcentaje != null && !Number.isNaN(item.iva_porcentaje)) {
      return item.iva_porcentaje;
    }
    const sub =
      item.subtotal_linea ??
      (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
    if (sub > 0 && item.iva_linea != null) {
      return Math.round((item.iva_linea / sub) * 10000) / 100;
    }
    return 21;
  };

  const handleCopiarPedido = async (source: Pedido) => {
    const uid = source.pedido_uid;
    setCopiandoPedidoUid(uid);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Siempre recargar el pedido completo (la lista puede traer items sin producto_id)
      const res = await fetch(routes.getPedidoByUid(uid), { headers });
      if (!res.ok) throw new Error(await res.text());
      const pedido: Pedido = await res.json();

      let items = [...(pedido.items || [])];
      if (!items.length) {
        addToast('warning', 'Sin productos', 'El pedido no tiene productos para copiar.');
        return;
      }

      // Catálogo actual: resolver IDs faltantes + precios/descripciones nuevos
      type CatalogEntry = {
        id: number;
        numero: string;
        descripcion: string;
        precio: number;
      };
      const byId = new Map<number, CatalogEntry>();
      const byNumero = new Map<string, CatalogEntry>();
      try {
        const catRes = await fetch(routes.getCatalogo, { headers });
        if (catRes.ok) {
          const catalogRaw = await catRes.json();
          const catalog = Array.isArray(catalogRaw)
            ? catalogRaw
            : Array.isArray(catalogRaw?.data)
              ? catalogRaw.data
              : [];
          for (const p of catalog) {
            const id = Number(p.id ?? p.producto_id);
            const numero = String(p.numero ?? p.numero_articulo ?? '').trim();
            const precio = Number(
              p.precio ?? p.Precio ?? p['Precio'] ?? p.precio_unitario ?? 0,
            );
            const descripcion = String(
              p.descripcion ?? p.Descripcion ?? p['Descripción'] ?? '',
            ).trim();
            if (!Number.isFinite(id) || id <= 0) continue;
            const entry: CatalogEntry = {
              id,
              numero,
              descripcion: descripcion || numero || `Producto ${id}`,
              precio: Number.isFinite(precio) ? precio : 0,
            };
            byId.set(id, entry);
            if (numero) byNumero.set(numero.toLowerCase(), entry);
          }
        }
      } catch (e) {
        console.warn('[Pedidos] No se pudo cargar catálogo para copia:', e);
      }

      items = items.map((item) => {
        let productoId = item.producto_id ? Number(item.producto_id) : 0;
        let cat =
          productoId > 0 ? byId.get(productoId) : undefined;
        if (!cat) {
          const num = String(item.numero_articulo || '')
            .trim()
            .toLowerCase();
          cat = num ? byNumero.get(num) : undefined;
          if (cat) productoId = cat.id;
        }
        return {
          ...item,
          producto_id: cat?.id || (productoId > 0 ? productoId : undefined),
          numero_articulo: cat?.numero || item.numero_articulo,
          descripcion: cat?.descripcion || item.descripcion,
          // Precio vigente del catálogo (si no hay match, fallback al del pedido)
          precio_unitario:
            cat != null ? cat.precio : Number(item.precio_unitario) || 0,
        };
      });

      const sinProductoId = items.filter((i) => !i.producto_id);
      if (sinProductoId.length > 0) {
        const arts = sinProductoId
          .map((i) => i.numero_articulo || i.descripcion || '?')
          .slice(0, 5)
          .join(', ');
        addToast(
          'warning',
          'No se puede copiar',
          `No se encontró en el catálogo: ${arts}${sinProductoId.length > 5 ? '…' : ''}. Añádelos al catálogo o edita el pedido.`,
        );
        return;
      }

      const horario =
        String(pedido.horario_entrega || '').trim() ||
        (pedido.comunidad?.id != null
          ? String(horariosEntrega[String(pedido.comunidad.id)] || '').trim()
          : '');
      const telefono =
        String(pedido.telefono_entrega || '').trim() ||
        String(pedido.comunidad?.telefono || '').trim();

      if (!horario) {
        addToast(
          'warning',
          'Horario obligatorio',
          'El pedido original no tiene horario de entrega. Complétalo antes de copiar.',
        );
        return;
      }
      if (!telefono) {
        addToast(
          'warning',
          'Teléfono obligatorio',
          'El pedido original no tiene teléfono de entrega. Complétalo antes de copiar.',
        );
        return;
      }

      const mappedItems = items.map((item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precio_unitario) || 0;
        const descuento = Number(item.descuento_linea) || 0;
        const ivaPct = inferIvaPorcentajeItem(item);
        const subtotalLinea = Math.max(0, cantidad * precio - descuento);
        const ivaLinea = subtotalLinea * (ivaPct / 100);
        return {
          producto_id: item.producto_id as number,
          numero_articulo: item.numero_articulo || 'N/A',
          descripcion: item.descripcion || 'N/A',
          cantidad,
          precio_unitario: precio,
          subtotal_linea: subtotalLinea,
          descuento_linea: descuento,
          iva_porcentaje: ivaPct,
          iva_linea: ivaLinea,
          total_linea: subtotalLinea + ivaLinea,
        };
      });

      const subtotal = mappedItems.reduce((s, i) => s + i.subtotal_linea, 0);
      const ivaTotal = mappedItems.reduce((s, i) => s + i.iva_linea, 0);
      const total = subtotal + ivaTotal;
      const limiteCliente =
        pedido.comunidad?.limite_gasto != null
          ? Number(pedido.comunidad.limite_gasto)
          : 0;
      const limiteFlags = pedidoLimiteExcedidoFlags(subtotal, limiteCliente);

      const empleadoId =
        pedido.empleado?.id ||
        (user as { CODIGO?: string; codigo?: string })?.CODIGO ||
        (user as { CODIGO?: string; codigo?: string })?.codigo ||
        '';
      const empleadoNombre =
        pedido.empleado?.nombre ||
        (user as { 'NOMBRE / APELLIDOS'?: string })?.['NOMBRE / APELLIDOS'] ||
        'Empleado';
      const empleadoEmail =
        pedido.empleado?.email ||
        (user as { email?: string })?.email ||
        (user as { 'CORREO ELECTRONICO'?: string })?.['CORREO ELECTRONICO'] ||
        '';

      const payload = {
        empleado: {
          id: String(empleadoId),
          nombre: empleadoNombre,
          email: empleadoEmail,
          centro_trabajo: pedido.comunidad?.nombre || '',
        },
        comunidad: {
          id: pedido.comunidad?.id ?? 'N/A',
          nombre: pedido.comunidad?.nombre || '',
          direccion: pedido.comunidad?.direccion || pedido.direccion_envio || '',
          codigo_postal:
            pedido.comunidad?.codigo_postal || pedido.codigo_postal_envio || '',
          localidad: pedido.comunidad?.localidad || pedido.localidad_envio || '',
          provincia: pedido.comunidad?.provincia || pedido.provincia_envio || '',
          telefono: pedido.comunidad?.telefono || telefono,
          email: pedido.comunidad?.email || '',
          nif: pedido.comunidad?.nif || '',
          limite_gasto: limiteCliente,
        },
        pedido: {
          fecha: new Date().toISOString(),
          moneda: 'EUR',
          descuento_global: 0,
          impuestos: ivaTotal,
          notas: pedido.notas
            ? `Copia de ${uid}. ${String(pedido.notas)}`
            : `Copia de ${uid}`,
          subtotal,
          iva_total: ivaTotal,
          total,
          limite_excedido: limiteFlags.limite_excedido,
          exceso_limite: limiteFlags.exceso_limite,
          estado: 'pendiente',
          horario_entrega: horario,
          telefono_entrega: telefono,
          direccion_envio: pedido.direccion_envio || pedido.comunidad?.direccion || '',
          codigo_postal_envio:
            pedido.codigo_postal_envio || pedido.comunidad?.codigo_postal || '',
          localidad_envio: pedido.localidad_envio || pedido.comunidad?.localidad || '',
          provincia_envio: pedido.provincia_envio || pedido.comunidad?.provincia || '',
          items: mappedItems,
        },
      };

      const response = await fetch(routes.savePedido, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'ok') {
        addToast(
          'success',
          'Pedido copiado',
          `Nuevo pedido ${result.pedido_uid || ''} creado en estado pendiente.`,
        );
        await loadPedidos();
      } else {
        throw new Error(result.message || 'Error al copiar el pedido');
      }
    } catch (error: unknown) {
      console.error('Error copiando pedido:', error);
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error al copiar', msg);
    } finally {
      setCopiandoPedidoUid(null);
    }
  };

  const handleDeleteAlbaran = async () => {
    if (!pedidoViendoAlbaran || albaranViewSelectedId == null) return;

    setAlbaranViewDeleting(true);
    try {
      const uid = (pedidoViendoAlbaran || '').replace(/^=+/, '');
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(routes.deleteAlbaran(uid, albaranViewSelectedId), {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error ${response.status}`);
      }
      const result = await response.json();
      addToast('success', 'Albarán eliminado', result.message || 'Albarán eliminado correctamente.');

      if (albaranViewBlobUrlRef.current) {
        URL.revokeObjectURL(albaranViewBlobUrlRef.current);
        albaranViewBlobUrlRef.current = null;
      }
      if (albaranViewPreviewUrlRef.current) {
        URL.revokeObjectURL(albaranViewPreviewUrlRef.current);
        albaranViewPreviewUrlRef.current = null;
      }
      setAlbaranViewBlobUrl(null);
      setAlbaranViewPreviewUrl(null);
      setAlbaranViewMime('');
      setAlbaranViewName('');

      const base = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
      const listRes = await fetch(`${base}/api/pedidos/${encodeURIComponent(uid)}/albaranes`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!listRes.ok) {
        throw new Error('No se pudo actualizar la lista de albaranes');
      }
      const listData = await listRes.json();
      const list = Array.isArray(listData) ? listData : [];
      setAlbaranesListaMeta(list);
      if (list.length === 0) {
        setAlbaranViewSelectedId(null);
        setAlbaranViewError('No hay albaranes guardados para este pedido.');
      } else {
        setAlbaranViewSelectedId(list[0].id);
      }

      await loadPedidos();
    } catch (error: unknown) {
      console.error('Error eliminando albarán:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `No se pudo eliminar el albarán: ${errorMessage}`);
    } finally {
      setAlbaranViewDeleting(false);
    }
  };

  // Încarcă lista de clienți pentru selector
  useEffect(() => {
    const loadClientes = async () => {
      setLoadingClientes(true);
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

        const response = await fetch(routes.getClientes, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const clientesArray = Array.isArray(data) ? data : [data];
        
        // Filtrează doar clienții care au adresă completă
        const clientesConDireccion = clientesArray.filter((cliente: Cliente) => {
          const direccion = cliente.DIRECCION || cliente.direccion || '';
          const codigoPostal = cliente['CODIGO POSTAL'] || cliente.CODIGO_POSTAL || cliente.codigo_postal || '';
          const localidad = cliente.LOCALIDAD || cliente.localidad || '';
          const provincia = cliente.PROVINCIA || cliente.provincia || '';
          return direccion || codigoPostal || localidad || provincia;
        });
        
        setClientes(clientesConDireccion);
      } catch (error) {
        console.error('Error loading clientes:', error);
        setClientes([]);
      } finally {
        setLoadingClientes(false);
      }
    };

    loadClientes();
  }, []);

  // Încarcă produsele pentru o comunitate specifică
  const loadProductosParaComunidad = async (comunidadId: number) => {
    setBuscandoProductos(true);
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
      
      const productosMapeados = productosArray.map((item: ProductoAPI) => ({
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
    const productoExistente = pedido.items?.find((item: LineaPedido) => item.numero_articulo === producto.numero);
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
    const nuevoSubtotal = newItems.reduce((sum: number, item: LineaPedido) => sum + (item.subtotal_linea || 0), 0);
    const nuevoIvaTotal = newItems.reduce((sum: number, item: LineaPedido) => sum + (item.iva_linea || 0), 0);
    const nuevoTotal = nuevoSubtotal + nuevoIvaTotal;

    // Salvează direct în baza de date
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
        const detail =
          messageFromApiErrorBody(errorText) ??
          'No se pudo guardar el producto. Inténtalo de nuevo.';
        addToast('error', 'Error', detail);
        return;
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
      const nuevoSubtotal = pedido.items.reduce((sum: number, item: LineaPedido) => sum + (item.subtotal_linea || 0), 0);
      const nuevoIvaTotal = pedido.items.reduce((sum: number, item: LineaPedido) => sum + (item.iva_linea || 0), 0);
      const nuevoTotal = nuevoSubtotal + nuevoIvaTotal;

      console.log('💾 [Frontend] Guardando cambios para pedido:', { 
        pedidoUid, 
        itemsCount: pedido.items.length,
        nuevoSubtotal,
        nuevoIvaTotal,
        nuevoTotal,
        notas: pedido.notas || '(sin notas)'
      });

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

      const response = await fetch(routes.updatePedidoItems(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          items: pedido.items,
          subtotal: nuevoSubtotal,
          iva_total: nuevoIvaTotal,
          total: nuevoTotal,
          notas: pedido.notas || null,
        }),
      });

      console.log('💾 [Frontend] Guardar cambios response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        const detail =
          messageFromApiErrorBody(errorText) ??
          'No se pudieron guardar los cambios. Inténtalo de nuevo.';
        addToast('error', 'Error', detail);
        return;
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

  // Salvează doar nota pentru o comandă
  const guardarNotas = async (pedidoUid: string) => {
    const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
    if (!pedido) {
      addToast('error', 'Error', 'No se encontró el pedido.');
      return;
    }

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

      const response = await fetch(routes.updatePedidoNotas(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          notas: pedido.notas || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Frontend] Error response:', errorText);
        const detail =
          messageFromApiErrorBody(errorText) ??
          'No se pudo guardar la nota. Inténtalo de nuevo.';
        addToast('error', 'Error', detail);
        return;
      }

      // Recargar pedidos pentru a obține datele actualizate din baza de date
      await loadPedidos();
      
      addToast('success', 'Nota guardada', `La nota del pedido ${pedidoUid} se ha guardado correctamente.`);
    } catch (error) {
      console.error('Error guardando notas:', error);
      addToast('error', 'Error', 'No se pudo guardar la nota. Inténtalo de nuevo.');
    }
  };

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
          headers: { Authorization: `Bearer ${token}` },
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
      addToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo subir el albarán');
    } finally {
      setUploadingAlbaran(false);
    }
  };

  // Salvează doar fecha_envio fără să schimbe statusul
  const guardarFechaEnvio = async (pedidoUid: string) => {
    const pedido = pedidos.find(p => p.pedido_uid === pedidoUid);
    const fechaParaGuardar =
      fechasEnvio[pedidoUid] ||
      (pedido?.fecha_envio ? formatDateOnlyForInput(pedido.fecha_envio) : '');
    if (!fechaParaGuardar) {
      addToast('warning', 'Fecha requerida', 'Debes seleccionar una fecha de envío.');
      return;
    }

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

      // Actualizează doar fecha_envio, păstrând statusul actual
      const estadoActual = pedido?.estado || 'pendiente';

      const response = await fetch(routes.updatePedidoEstado(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
          estado: estadoActual,
          fecha_envio: fechaParaGuardar,
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

  // Guarda dirección de envío
  // Autocompletare dirección de envío (Nominatim / OpenStreetMap, gratuit)
  const fetchAddressSuggestions = React.useCallback(async (query: string, pedidoUid: string) => {
    const q = query.trim();
    if (q.length < 3) {
      setAddressSuggestions(prev => ({ ...prev, [pedidoUid]: [] }));
      setAddressSuggestionsLoading(prev => ({ ...prev, [pedidoUid]: false }));
      return;
    }
    setAddressSuggestionsLoading(prev => ({ ...prev, [pedidoUid]: true }));
    try {
      const searchQuery = encodeURIComponent(q + (q.toLowerCase().includes('españa') || q.toLowerCase().includes('spain') ? '' : ' España'));
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&addressdetails=1&limit=5`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'DeCaminoPedidosApp/1.0' } }
      );
      const data = await res.json();
      setAddressSuggestions(prev => ({ ...prev, [pedidoUid]: data || [] }));
    } catch {
      setAddressSuggestions(prev => ({ ...prev, [pedidoUid]: [] }));
    } finally {
      setAddressSuggestionsLoading(prev => ({ ...prev, [pedidoUid]: false }));
    }
  }, []);

  const guardarDireccionEnvio = async (pedidoUid: string) => {
    const direccion = direccionesEnvio[pedidoUid];
    const hasAddress = direccion?.direccion_envio || direccion?.codigo_postal_envio || direccion?.localidad_envio || direccion?.provincia_envio;
    const hasPhone = direccion?.telefono_entrega != null && String(direccion.telefono_entrega).trim() !== '';
    if (!direccion || (!hasAddress && !hasPhone)) {
      addToast('warning', 'Datos requeridos', 'Debes completar al menos un campo de dirección de envío o teléfono de envío.');
      return;
    }

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

      const response = await fetch(routes.updatePedidoDireccionEnvio(pedidoUid), {
        method: 'PUT',
        headers,
        body: JSON.stringify(direccion),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addToast('success', 'Dirección guardada', 'La dirección de envío se ha guardado correctamente.');
      
      // Recargar pedidos pentru a actualiza dirección de envío în UI
      await loadPedidos();
    } catch (error) {
      console.error('Error guardando dirección de envío:', error);
      addToast('error', 'Error', 'No se pudo guardar la dirección de envío.');
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
      const headers: Record<string, string> = {
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
    switch (estado?.toLowerCase()) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'enviado':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'entregado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
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
      case 'enviado':
        return '📦 Enviado';
      case 'entregado':
        return '📬 Entregado';
      default:
        return estado || '—';
    }
  };

  // Lista aprobados según filtros actuales (lo que ves en pantalla)
  const pedidosAprobadosFiltrados = useMemo(
    () => pedidosFiltrados.filter(p => p.estado === 'aprobado'),
    [pedidosFiltrados],
  );

  // Paso 1: elegir qué pedidos aprobados enviar (urgentes vs periódicos, etc.)
  const abrirSeleccionEnvio = () => {
    if (pedidosAprobadosFiltrados.length === 0) {
      addToast(
        'info',
        'Sin pedidos aprobados',
        'No hay pedidos aprobados en la lista actual. Prueba a cambiar el filtro de estado o centro.',
      );
      return;
    }
    const initial: Record<string, boolean> = {};
    pedidosAprobadosFiltrados.forEach(p => {
      initial[p.pedido_uid] = true;
    });
    setUidsSeleccionadosEnvio(initial);
    setMostrarSeleccionEnvio(true);
  };

  const cerrarSeleccionEnvio = () => {
    setMostrarSeleccionEnvio(false);
    setUidsSeleccionadosEnvio({});
  };

  const continuarSeleccionAlPreview = () => {
    const seleccionados = pedidosAprobadosFiltrados.filter(
      p => uidsSeleccionadosEnvio[p.pedido_uid],
    );
    if (seleccionados.length === 0) {
      addToast(
        'warning',
        'Selecciona pedidos',
        'Marca al menos un pedido para continuar.',
      );
      return;
    }
    setPedidosParaEnviar(seleccionados);
    setMostrarSeleccionEnvio(false);
    setUidsSeleccionadosEnvio({});
    setMostrarPreviewEnvio(true);
  };

  const toggleTodosSeleccionEnvio = (marcar: boolean) => {
    const next: Record<string, boolean> = {};
    pedidosAprobadosFiltrados.forEach(p => {
      next[p.pedido_uid] = marcar;
    });
    setUidsSeleccionadosEnvio(next);
  };

  // Încarcă SERVICIO_ENTREGA pentru toate pedidos
  const cargarServiciosEntrega = async () => {
    if (pedidosParaEnviar.length === 0) return;

    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Obține toate clientes pentru a găsi SERVICIO_ENTREGA
      const response = await fetch(routes.getClientes, { headers });
      if (!response.ok) {
        console.warn('⚠️ No se pudieron cargar clientes para servicios');
        return;
      }

      const clientes = await response.json();
      const serviciosMap: Record<number, string> = {};

      // Pentru fiecare pedido, găsește servicio_entrega folosind comunidad.id
      pedidosParaEnviar.forEach((pedido) => {
        const comunidadId = pedido.comunidad?.id;
        if (comunidadId) {
          // Normalizează ID-ul pentru comparație (string vs number)
          const comunidadIdNum = typeof comunidadId === 'string' ? parseInt(comunidadId, 10) : comunidadId;
          
          const cliente = Array.isArray(clientes) 
            ? clientes.find((c: Cliente) => {
                const cId = c.id || c.ID || c.Id;
                const cIdNum = typeof cId === 'string' ? parseInt(cId, 10) : cId;
                return cIdNum === comunidadIdNum && !isNaN(cIdNum);
              })
            : null;
          
          if (cliente) {
            const servicio = cliente['SERVICIO ENTREGA'] || cliente.SERVICIO_ENTREGA || cliente.servicio_entrega || '';
            // Setează servicio chiar dacă este gol, pentru a permite editarea
            serviciosMap[comunidadIdNum] = servicio ? String(servicio).trim() : '';
            console.log(`✅ [Servicios] Pedido ${pedido.pedido_uid}: comunidad_id=${comunidadIdNum}, servicio="${serviciosMap[comunidadIdNum] || '(vacío)'}"`);
          } else {
            // Dacă nu găsește cliente, setează gol pentru a permite editarea
            serviciosMap[comunidadIdNum] = '';
            console.warn(`⚠️ [Servicios] No se encontró cliente para pedido ${pedido.pedido_uid} con comunidad_id=${comunidadIdNum}`);
          }
        } else {
          console.warn(`⚠️ [Servicios] Pedido ${pedido.pedido_uid} no tiene comunidad.id`);
        }
      });

      setServiciosEntrega(serviciosMap);
    } catch (error) {
      console.error('Error cargando servicios entrega:', error);
    } finally {
      setLoadingServicios(false);
    }
  };

  // Generează Excel-ul și deschide modalul pentru preview și trimitere
  const confirmarEnvioPedidos = async () => {
    try {
      setLoading(true);
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
        
        // Încarcă servicios entrega când se deschide modalul
        await cargarServiciosEntrega();
        
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

  // Actualizează SERVICIO_ENTREGA pentru un cliente
  const actualizarServicioEntrega = async (clienteId: number, servicio: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getClientes, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'edit',
          id: clienteId,
          'SERVICIO ENTREGA': servicio.trim() || null
        }),
      });

      if (!response.ok) {
        console.warn(`⚠️ No se pudo actualizar SERVICIO_ENTREGA para cliente ${clienteId}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error actualizando SERVICIO_ENTREGA para cliente ${clienteId}:`, error);
      return false;
    }
  };

  // Trimite mesajul la provider și marchează comenzile ca enviado
  const enviarProveedor = async () => {
    if (!excelBlob) return;

    try {
      setEnviandoProveedor(true);
      
      // Actualizează SERVICIO_ENTREGA pentru toate pedidos modificate
      const actualizacionesPromesas = pedidosParaEnviar.map(async (pedido) => {
        const comunidadId = pedido.comunidad?.id;
        if (comunidadId && serviciosEntrega[comunidadId] !== undefined) {
          const servicioActual = serviciosEntrega[comunidadId];
          // Actualizează SERVICIO_ENTREGA în backend
          await actualizarServicioEntrega(comunidadId, servicioActual || '');
        }
      });
      
      await Promise.all(actualizacionesPromesas);

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
      setServiciosEntrega({});
      
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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800">Gestionar Pedidos</h2>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
                {pedidosFiltrados.length !== pedidos.length && (
                  <span className="text-gray-500 ml-1">
                    (de {pedidos.length} total)
                  </span>
                )}
              </span>
            </div>
            
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
                <option value="entregado">Entregados</option>
              </select>

              <label className="text-sm font-medium text-gray-700">Filtrar por centro:</label>
              <select
                value={filtroCentro}
                onChange={(e) => setFiltroCentro(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-w-[200px]"
                title="Agrupado por ID o NIF del cliente; correcciones de nombre no duplican el centro."
              >
                <option value="all">Todos</option>
                {opcionesCentroFiltro.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="text-sm font-medium text-gray-700">Filtrar por año:</label>
              <select
                value={filtroAn}
                onChange={(e) => setFiltroAn(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">Todos</option>
                {Array.from(new Set(pedidos.map(p => {
                  if (!p.fecha) return null;
                  const date = new Date(p.fecha);
                  return date.getFullYear().toString();
                }).filter(Boolean))).sort((a, b) => (b || '').localeCompare(a || '')).map(an => (
                  <option key={an} value={an}>{an}</option>
                ))}
              </select>
              
              <Button
                onClick={loadPedidos}
                variant="primary"
                disabled={loading}
              >
                {loading ? '🔄 Cargando...' : '🔄 Actualizar'}
              </Button>

              {pedidosAprobadosFiltrados.length > 0 && (
                <Button
                  onClick={abrirSeleccionEnvio}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading}
                  title="Elige qué pedidos aprobados (de la lista filtrada) enviar al proveedor: urgentes, periódicos, etc."
                >
                  📤 Seleccionar pedidos a enviar ({pedidosAprobadosFiltrados.length})
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
      ) : pedidosFiltrados.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay pedidos</h3>
            <p className="text-gray-500">No se encontraron pedidos con los filtros seleccionados.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => (
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
                      <div>
                        <strong>Comunidad:</strong> {pedido.comunidad?.nombre || 'N/A'}
                        {pedido.comunidad?.direccion && (
                          <div className="mt-1 text-xs text-gray-500">
                            📍 {pedido.comunidad.direccion}
                            {pedido.comunidad.codigo_postal && `, ${pedido.comunidad.codigo_postal}`}
                            {pedido.comunidad.localidad && `, ${pedido.comunidad.localidad}`}
                            {pedido.comunidad.provincia && `, ${pedido.comunidad.provincia}`}
                          </div>
                        )}
                      </div>
                      <div><strong>Fecha:</strong> {formatDate(pedido.fecha)}</div>
                      <div><strong>Total:</strong> <span className="font-bold text-purple-600">{formatMoney(pedido.total)}</span></div>
                      {pedido.fecha_envio && (
                        <div><strong>Fecha de Envío:</strong> {formatDateOnly(pedido.fecha_envio)}</div>
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
                      {(pedido.horario_entrega || (pedido.comunidad?.id && horariosEntrega[String(pedido.comunidad.id)])) && (
                        <div>
                          <strong>🕐 Horario Entrega:</strong> <span className="text-blue-600 font-medium">{pedido.horario_entrega || horariosEntrega[String(pedido.comunidad?.id)]}</span>
                        </div>
                      )}
                      {pedido.telefono_entrega && (
                        <div>
                          <strong>📞 Teléfono Entrega:</strong> <span className="text-blue-600 font-medium">{pedido.telefono_entrega}</span>
                        </div>
                      )}
                      {(pedido.direccion_envio || pedido.codigo_postal_envio || pedido.localidad_envio || pedido.provincia_envio) && (
                        <div className="md:col-span-2">
                          <strong>📍 Dirección de Envío:</strong>
                          <div className="mt-1 text-xs text-blue-600 font-medium">
                            {pedido.direccion_envio || ''}
                            {pedido.codigo_postal_envio && `, ${pedido.codigo_postal_envio}`}
                            {pedido.localidad_envio && `, ${pedido.localidad_envio}`}
                            {pedido.provincia_envio && `, ${pedido.provincia_envio}`}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {pedidoEditando === pedido.pedido_uid ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Notas</label>
                            <Button
                              onClick={() => guardarNotas(pedido.pedido_uid)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              💾 Guardar Nota
                            </Button>
                          </div>
                          <textarea
                            value={pedido.notas || ''}
                            onChange={(e) => {
                              const updatedPedidos = pedidos.map(p => 
                                p.pedido_uid === pedido.pedido_uid 
                                  ? { ...p, notas: e.target.value }
                                  : p
                              );
                              setPedidos(updatedPedidos);
                            }}
                            className="w-full p-3 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            rows={4}
                            placeholder="Notas adicionales..."
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700">
                          <strong className="text-gray-800">Notas:</strong> <span className="ml-1">{pedido.notas || '(sin notas)'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Butoane de acțiune */}
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const noEditable = pedido.estado === 'enviado' || pedido.estado === 'entregado';
                      return (
                        <Button
                          onClick={() => {
                            if (noEditable) return;
                            setPedidoEditando(pedidoEditando === pedido.pedido_uid ? null : pedido.pedido_uid);
                            if (pedidoSeleccionado !== pedido.pedido_uid) {
                              setPedidoSeleccionado(pedido.pedido_uid);
                            }
                          }}
                          disabled={noEditable}
                          title={noEditable ? 'No se puede editar un pedido ya enviado al proveedor' : undefined}
                          className={noEditable ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                          size="sm"
                        >
                          {pedidoEditando === pedido.pedido_uid ? '❌ Cancelar Edición' : '✏️ Editar'}
                        </Button>
                      );
                    })()}
                    {(pedido.estado === 'pendiente' ||
                      (pedidoEditando === pedido.pedido_uid && pedido.estado === 'aprobado')) && (
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Fecha de Envío (solo fecha; el horario está en Horario Entrega)
                            {pedido.estado === 'aprobado' && (
                              <span className="text-gray-500 font-normal"> — puedes corregir la fecha si faltaba o estaba mal</span>
                            )}
                            :
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={fechasEnvio[pedido.pedido_uid] || formatDateOnlyForInput(pedido.fecha_envio)}
                              onChange={(e) => {
                                setFechasEnvio(prev => ({
                                  ...prev,
                                  [pedido.pedido_uid]: e.target.value
                                }));
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              min={
                                pedido.estado === 'aprobado'
                                  ? undefined
                                  : formatDateOnlyForInput(new Date())
                              }
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
                    )}
                    {(pedido.estado === 'pendiente' ||
                      (pedidoEditando === pedido.pedido_uid && pedido.estado === 'aprobado')) && (
                      <>
                        <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            📍 Dirección de Envío{' '}
                            {pedido.estado === 'aprobado'
                              ? '(añade o corrige teléfono de envío si faltaba)'
                              : '(Opcional)'}
                            :
                          </label>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Seleccionar Cliente (para cargar dirección automáticamente):
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Escribe para buscar cliente..."
                                  value={clienteSearchTerms[pedido.pedido_uid] || ''}
                                  onChange={(e) => {
                                    setClienteSearchTerms(prev => ({
                                      ...prev,
                                      [pedido.pedido_uid]: e.target.value
                                    }));
                                    setShowClienteDropdowns(prev => ({
                                      ...prev,
                                      [pedido.pedido_uid]: true
                                    }));
                                  }}
                                  onFocus={() => {
                                    setShowClienteDropdowns(prev => ({
                                      ...prev,
                                      [pedido.pedido_uid]: true
                                    }));
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setShowClienteDropdowns(prev => ({
                                        ...prev,
                                        [pedido.pedido_uid]: false
                                      }));
                                    }, 200);
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  disabled={loadingClientes}
                                />
                                {showClienteDropdowns[pedido.pedido_uid] && (
                                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {(() => {
                                      const searchTerm = (clienteSearchTerms[pedido.pedido_uid] || '').toLowerCase();
                                      const clientesFiltrados = clientes.filter((cliente: Cliente) => {
                                        const nombre = (cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.NOMBRE_O_RAZON_SOCIAL || '').toLowerCase();
                                        return nombre.includes(searchTerm);
                                      }).slice(0, 20); // Limitează la 20 rezultate
                                      
                                      return clientesFiltrados.length > 0 ? (
                                        clientesFiltrados.map((cliente: Cliente, index: number) => {
                                          const nombre = cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.NOMBRE_O_RAZON_SOCIAL || `Cliente ${index + 1}`;
                                          const clienteId = cliente.id || cliente.NIF || `cliente-${index}`;
                                          
                                          return (
                                            <div
                                              key={clienteId}
                                              onClick={() => {
                                                const direccion = cliente.DIRECCION || cliente.direccion || '';
                                                const codigoPostal = cliente['CODIGO POSTAL'] || cliente.CODIGO_POSTAL || cliente.codigo_postal || '';
                                                const localidad = cliente.LOCALIDAD || cliente.localidad || cliente.POBLACION || '';
                                                const provincia = cliente.PROVINCIA || cliente.provincia || '';
                                                
                                                setDireccionesEnvio(prev => ({
                                                  ...prev,
                                                  [pedido.pedido_uid]: {
                                                    ...prev[pedido.pedido_uid],
                                                    direccion_envio: direccion,
                                                    codigo_postal_envio: codigoPostal,
                                                    localidad_envio: localidad,
                                                    provincia_envio: provincia,
                                                  }
                                                }));
                                                
                                                setClienteSearchTerms(prev => ({
                                                  ...prev,
                                                  [pedido.pedido_uid]: nombre
                                                }));
                                                setShowClienteDropdowns(prev => ({
                                                  ...prev,
                                                  [pedido.pedido_uid]: false
                                                }));
                                              }}
                                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                            >
                                              <div className="font-medium text-gray-900">{nombre}</div>
                                              {cliente.DIRECCION && (
                                                <div className="text-xs text-gray-500">{cliente.DIRECCION}</div>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="px-3 py-2 text-gray-500 text-sm">No se encontraron clientes</div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Dirección (escribe para buscar y autocompletar)"
                                value={direccionesEnvio[pedido.pedido_uid]?.direccion_envio || pedido.direccion_envio || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDireccionesEnvio(prev => ({
                                    ...prev,
                                    [pedido.pedido_uid]: {
                                      ...prev[pedido.pedido_uid],
                                      direccion_envio: value
                                    }
                                  }));
                                  if (addressSearchTimeoutRef.current) clearTimeout(addressSearchTimeoutRef.current);
                                  addressSearchTimeoutRef.current = setTimeout(() => {
                                    setShowAddressSuggestions(prev => ({ ...prev, [pedido.pedido_uid]: true }));
                                    fetchAddressSuggestions(value, pedido.pedido_uid);
                                  }, 400);
                                }}
                                onFocus={() => {
                                  const list = addressSuggestions[pedido.pedido_uid];
                                  if (list && list.length > 0) setShowAddressSuggestions(prev => ({ ...prev, [pedido.pedido_uid]: true }));
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setShowAddressSuggestions(prev => ({ ...prev, [pedido.pedido_uid]: false }));
                                  }, 200);
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              {addressSuggestionsLoading[pedido.pedido_uid] && (
                                <div className="absolute right-3 top-2.5 text-gray-400">
                                  <span className="animate-pulse text-xs">Buscando...</span>
                                </div>
                              )}
                              {showAddressSuggestions[pedido.pedido_uid] && (addressSuggestions[pedido.pedido_uid]?.length > 0) && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {addressSuggestions[pedido.pedido_uid].map((item: { display_name: string; address?: { road?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string; state?: string } }, idx: number) => {
                                    const addr = item.address || {};
                                    const localidad = addr.city || addr.town || addr.village || '';
                                    const provincia = addr.state || '';
                                    const cp = addr.postcode || '';
                                    const calle = [addr.road, addr.house_number].filter(Boolean).join(' ') || item.display_name;
                                    return (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          setDireccionesEnvio(prev => ({
                                            ...prev,
                                            [pedido.pedido_uid]: {
                                              ...prev[pedido.pedido_uid],
                                              direccion_envio: calle || item.display_name,
                                              codigo_postal_envio: cp,
                                              localidad_envio: localidad,
                                              provincia_envio: provincia,
                                            }
                                          }));
                                          setShowAddressSuggestions(prev => ({ ...prev, [pedido.pedido_uid]: false }));
                                          setAddressSuggestions(prev => ({ ...prev, [pedido.pedido_uid]: [] }));
                                        }}
                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-left"
                                      >
                                        <div className="text-sm font-medium text-gray-900">{item.display_name}</div>
                                        {(cp || localidad || provincia) && (
                                          <div className="text-xs text-gray-500">{[cp, localidad, provincia].filter(Boolean).join(', ')}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Código Postal"
                                value={direccionesEnvio[pedido.pedido_uid]?.codigo_postal_envio || pedido.codigo_postal_envio || ''}
                                onChange={(e) => {
                                  setDireccionesEnvio(prev => ({
                                    ...prev,
                                    [pedido.pedido_uid]: {
                                      ...prev[pedido.pedido_uid],
                                      codigo_postal_envio: e.target.value
                                    }
                                  }));
                                }}
                                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <input
                                type="text"
                                placeholder="Localidad"
                                value={direccionesEnvio[pedido.pedido_uid]?.localidad_envio || pedido.localidad_envio || ''}
                                onChange={(e) => {
                                  setDireccionesEnvio(prev => ({
                                    ...prev,
                                    [pedido.pedido_uid]: {
                                      ...prev[pedido.pedido_uid],
                                      localidad_envio: e.target.value
                                    }
                                  }));
                                }}
                                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <input
                                type="text"
                                placeholder="Provincia"
                                value={direccionesEnvio[pedido.pedido_uid]?.provincia_envio || pedido.provincia_envio || ''}
                                onChange={(e) => {
                                  setDireccionesEnvio(prev => ({
                                    ...prev,
                                    [pedido.pedido_uid]: {
                                      ...prev[pedido.pedido_uid],
                                      provincia_envio: e.target.value
                                    }
                                  }));
                                }}
                                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Teléfono (envío){' '}
                                {pedido.estado === 'aprobado' && (
                                  <span className="text-amber-700 font-medium">*</span>
                                )}
                              </label>
                              <input
                                type="tel"
                                placeholder="Ej: 612 345 678"
                                value={direccionesEnvio[pedido.pedido_uid]?.telefono_entrega ?? (pedido as { telefono_entrega?: string }).telefono_entrega ?? ''}
                                onChange={(e) => {
                                  setDireccionesEnvio(prev => ({
                                    ...prev,
                                    [pedido.pedido_uid]: {
                                      ...prev[pedido.pedido_uid],
                                      telefono_entrega: e.target.value
                                    }
                                  }));
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <Button
                              onClick={() => guardarDireccionEnvio(pedido.pedido_uid)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                              size="sm"
                            >
                              💾 Guardar Dirección de Envío
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                    {pedido.estado === 'pendiente' && (
                      <>
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
                    <Button
                      onClick={() => setCopiaConfirmPedido(pedido)}
                      disabled={copiandoPedidoUid === pedido.pedido_uid}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      size="sm"
                      title="Crear un pedido nuevo con los mismos productos y comunidad"
                    >
                      {copiandoPedidoUid === pedido.pedido_uid
                        ? '⏳ Copiando...'
                        : '📋 Crear por copia'}
                    </Button>
                    <Button
                      onClick={() => setPedidoSeleccionado(
                        pedidoSeleccionado === pedido.pedido_uid ? null : pedido.pedido_uid
                      )}
                      variant="outline"
                      size="sm"
                    >
                      {pedidoSeleccionado === pedido.pedido_uid ? '👁️ Ocultar' : '👁️ Ver Detalles'}
                    </Button>
                    <Button
                      onClick={() => setDeleteConfirmUid(pedido.pedido_uid)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                      title="Eliminar pedido permanentemente"
                    >
                      🗑️ Borrar
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
                          <div className="mb-3">
                            <Input
                              label="Buscar producto por número o descripción"
                              value={searchProductoTerm}
                              onChange={(e) => setSearchProductoTerm(e.target.value)}
                              placeholder="Ej: 70000123 o AMBIENTADOR"
                              className="mb-3"
                            />
                            <div className="flex gap-2 items-end">
                              <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700 mb-1">
                                  Ordenar por
                                </label>
                                <select
                                  value={sortFieldProductos}
                                  onChange={(e) => setSortFieldProductos(e.target.value as 'id' | 'numero' | 'descripcion' | 'precio')}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                  <option value="id">ID</option>
                                  <option value="numero">Número</option>
                                  <option value="descripcion">Descripción</option>
                                  <option value="precio">Precio</option>
                                </select>
                              </div>
                              
                              <button
                                onClick={() => setSortDirectionProductos(sortDirectionProductos === 'asc' ? 'desc' : 'asc')}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                title={sortDirectionProductos === 'asc' ? 'Ascendente' : 'Descendente'}
                              >
                                {sortDirectionProductos === 'asc' ? '↑' : '↓'}
                              </button>
                            </div>
                          </div>
                          {buscandoProductos ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Buscando productos...</p>
                            </div>
                          ) : productosDisponibles.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto border rounded-lg bg-white">
                              {productosDisponiblesFiltrados.map(producto => (
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
                            <th className="text-right p-2 min-w-[11rem] whitespace-nowrap">Cantidad</th>
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
                          {pedido.items?.map((item: LineaPedido, index: number) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{item.numero_articulo}</td>
                              <td className="p-2">{item.descripcion}</td>
                              <td className="p-2 text-right min-w-[11rem]">
                                {pedidoEditando === pedido.pedido_uid ? (
                                  <div className="flex items-center justify-end gap-1.5 w-fit ml-auto max-w-none">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="!min-w-8 !w-8 !p-0 h-9 shrink-0"
                                      aria-label="Restar cantidad"
                                      onClick={() => {
                                        const newItems = [...pedido.items];
                                        newItems[index].cantidad = Math.max(0, (newItems[index].cantidad || 0) - 1);
                                        const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                        const iva = subtotal * 0.21;
                                        newItems[index].subtotal_linea = subtotal;
                                        newItems[index].iva_linea = iva;
                                        newItems[index].total_linea = subtotal + iva;
                                        setPedidos(pedidos.map(p =>
                                          p.pedido_uid === pedido.pedido_uid ? { ...p, items: newItems } : p
                                        ));
                                      }}
                                    >
                                      −
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={item.cantidad === 0 ? '' : item.cantidad}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        const newItems = [...pedido.items];
                                        newItems[index].cantidad = v === '' ? 0 : (parseInt(v, 10) ?? 0);
                                        if (newItems[index].cantidad < 0) newItems[index].cantidad = 0;
                                        const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                        const iva = subtotal * 0.21;
                                        newItems[index].subtotal_linea = subtotal;
                                        newItems[index].iva_linea = iva;
                                        newItems[index].total_linea = subtotal + iva;
                                        setPedidos(pedidos.map(p =>
                                          p.pedido_uid === pedido.pedido_uid ? { ...p, items: newItems } : p
                                        ));
                                      }}
                                      onBlur={() => {
                                        const newItems = [...pedido.items];
                                        if (newItems[index].cantidad === 0) {
                                          newItems[index].cantidad = 1;
                                          const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                          const iva = subtotal * 0.21;
                                          newItems[index].subtotal_linea = subtotal;
                                          newItems[index].iva_linea = iva;
                                          newItems[index].total_linea = subtotal + iva;
                                          setPedidos(pedidos.map(p =>
                                            p.pedido_uid === pedido.pedido_uid ? { ...p, items: newItems } : p
                                          ));
                                        }
                                      }}
                                      className="!min-w-[5.5rem] !w-28 text-right shrink-0 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="!min-w-8 !w-8 !p-0 h-9 shrink-0"
                                      aria-label="Sumar cantidad"
                                      onClick={() => {
                                        const newItems = [...pedido.items];
                                        newItems[index].cantidad = (newItems[index].cantidad || 0) + 1;
                                        const subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
                                        const iva = subtotal * 0.21;
                                        newItems[index].subtotal_linea = subtotal;
                                        newItems[index].iva_linea = iva;
                                        newItems[index].total_linea = subtotal + iva;
                                        setPedidos(pedidos.map(p =>
                                          p.pedido_uid === pedido.pedido_uid ? { ...p, items: newItems } : p
                                        ));
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
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
                                {pedido.fecha_envio ? formatDateOnly(pedido.fecha_envio) : 'No asignada'}
                              </td>
                              {pedidoEditando === pedido.pedido_uid && (
                                <td className="p-2 text-center">
                                  <Button
                                    onClick={() => {
                                      // Eliminar item
                                      const newItems = pedido.items.filter((_item: LineaPedido, i: number) => i !== index);
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
                              {formatMoney(pedido.items?.reduce((sum: number, item: LineaPedido) => sum + (item.subtotal_linea || 0), 0) || pedido.subtotal)}
                            </td>
                            <td className="p-2 text-right">
                              {formatMoney(pedido.items?.reduce((sum: number, item: LineaPedido) => sum + (item.iva_linea || 0), 0) || pedido.iva_total)}
                            </td>
                            <td className="p-2 text-right text-purple-600">
                              {formatMoney(pedido.items?.reduce((sum: number, item: LineaPedido) => sum + (item.total_linea || 0), 0) || pedido.total)}
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

      {/* Paso 1: selección de pedidos aprobados a enviar */}
      {mostrarSeleccionEnvio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="mb-4 pb-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                Seleccionar pedidos a enviar al proveedor
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Solo se listan los pedidos <strong>aprobados</strong> que coinciden con los filtros actuales (estado, centro, año).
                Desmarca los que no quieras enviar ahora (por ejemplo deja los periódicos para más tarde).
              </p>
              <p className="text-sm text-purple-700 mt-2 font-medium">
                Seleccionados:{' '}
                {pedidosAprobadosFiltrados.filter(p => uidsSeleccionadosEnvio[p.pedido_uid]).length}{' '}
                de {pedidosAprobadosFiltrados.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => toggleTodosSeleccionEnvio(true)}
              >
                Seleccionar todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => toggleTodosSeleccionEnvio(false)}
              >
                Quitar selección
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10"></th>
                    <th className="p-2 text-left">Pedido</th>
                    <th className="p-2 text-left">Empleado</th>
                    <th className="p-2 text-left">Comunidad</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Fecha envío</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosAprobadosFiltrados.map(p => (
                    <tr
                      key={p.pedido_uid}
                      className={`border-t border-gray-100 ${uidsSeleccionadosEnvio[p.pedido_uid] ? 'bg-green-50/50' : 'bg-white'}`}
                    >
                      <td className="p-2 align-middle">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          checked={uidsSeleccionadosEnvio[p.pedido_uid] ?? false}
                          onChange={() =>
                            setUidsSeleccionadosEnvio(prev => ({
                              ...prev,
                              [p.pedido_uid]: !prev[p.pedido_uid],
                            }))
                          }
                        />
                      </td>
                      <td className="p-2 font-mono text-xs align-middle">{p.pedido_uid}</td>
                      <td className="p-2 align-middle">{p.empleado?.nombre || '—'}</td>
                      <td className="p-2 align-middle max-w-[200px] truncate" title={p.comunidad?.nombre || ''}>
                        {p.comunidad?.nombre || '—'}
                      </td>
                      <td className="p-2 text-right align-middle">{formatMoney(p.total)}</td>
                      <td className="p-2 align-middle whitespace-nowrap">
                        {p.fecha_envio ? formatDateOnly(p.fecha_envio) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={cerrarSeleccionEnvio}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={continuarSeleccionAlPreview}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Continuar al preview →
              </Button>
            </div>
          </div>
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
                      <div><strong>Fecha Envío:</strong> {formatDateOnly(pedido.fecha_envio) || 'No asignada'}</div>
                      <div><strong>Total:</strong> {formatMoney(pedido.total)}</div>
                      <div><strong>Items:</strong> {pedido.items?.length || 0}</div>
                      {pedido.aprobado_por && (
                        <div><strong>Inspector:</strong> {pedido.aprobado_por}</div>
                      )}
                      <div className="col-span-2">
                        <strong>📍 Dirección de Envío:</strong>{' '}
                        {(pedido.direccion_envio || pedido.codigo_postal_envio || pedido.localidad_envio || pedido.provincia_envio) ? (
                          <span>
                            {pedido.direccion_envio || ''}
                            {pedido.codigo_postal_envio && `, ${pedido.codigo_postal_envio}`}
                            {pedido.localidad_envio && `, ${pedido.localidad_envio}`}
                            {pedido.provincia_envio && `, ${pedido.provincia_envio}`}
                          </span>
                        ) : (
                          <span>
                            {pedido.comunidad?.direccion || ''}
                            {pedido.comunidad?.codigo_postal && `, ${pedido.comunidad.codigo_postal}`}
                            {pedido.comunidad?.localidad && `, ${pedido.comunidad.localidad}`}
                            {pedido.comunidad?.provincia && `, ${pedido.comunidad.provincia}`}
                            {(!pedido.comunidad?.direccion && !pedido.comunidad?.codigo_postal && !pedido.comunidad?.localidad && !pedido.comunidad?.provincia) && 'No especificada'}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2">
                        <strong>📞 Teléfono (envío):</strong>{' '}
                        <span>{(pedido as { telefono_entrega?: string }).telefono_entrega || 'No especificado'}</span>
                      </div>
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
                          {pedido.items?.map((item: LineaPedido, itemIndex: number) => (
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

              {/* Lista detaliată de pedidos cu servicio asignat */}
              <div className="mb-4">
                <h3 className="font-semibold mb-3 text-gray-800">Lista de Pedidos:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left">Pedido UID</th>
                        <th className="border border-gray-300 px-3 py-2 text-left">Comunidad</th>
                        <th className="border border-gray-300 px-3 py-2 text-left">Servicio Asignado</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingServicios ? (
                        <tr>
                          <td colSpan={5} className="border border-gray-300 px-3 py-4 text-center text-gray-500">
                            Cargando servicios...
                          </td>
                        </tr>
                      ) : (
                        pedidosParaEnviar.map((pedido) => {
                          const comunidadId = pedido.comunidad?.id;
                          const servicio = comunidadId ? serviciosEntrega[comunidadId] : null;
                          return (
                            <tr key={pedido.pedido_uid} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-3 py-2 font-mono text-xs">
                                {pedido.pedido_uid}
                              </td>
                              <td className="border border-gray-300 px-3 py-2">
                                {pedido.comunidad?.nombre || 'N/A'}
                              </td>
                              <td className="border border-gray-300 px-3 py-2">
                                <input
                                  type="text"
                                  value={servicio || ''}
                                  onChange={(e) => {
                                    if (comunidadId) {
                                      setServiciosEntrega(prev => ({
                                        ...prev,
                                        [comunidadId]: e.target.value
                                      }));
                                    }
                                  }}
                                  placeholder="Sin servicio"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                                {formatMoney(pedido.total)}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-right">
                                {pedido.items?.length || 0}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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
                      <strong>Mensaje que se enviará:</strong> &quot;{mensajeProveedor}&quot;
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

      {/* Modal Ver Albarán (vizualizare când pedido ya entregado) */}
      {pedidoViendoAlbaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">📄 Ver Albarán</h2>
              <button
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
                      const isHeic = mime === 'image/heic' || mime === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
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
                            <p className="text-gray-600 mb-2">📄 <strong>{albaranViewName}</strong></p>
                            <p className="text-sm text-gray-500 mb-4">
                              Vista previa no disponible para este formato (p. ej. HEIC). Use el botón <strong>Descargar</strong> para ver el archivo en su dispositivo.
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
                  <div className="flex flex-wrap gap-3 justify-end">
                    <a
                      href={albaranViewBlobUrl}
                      download={albaranViewName}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                    >
                      📥 Descargar
                    </a>
                    <Button
                      onClick={() => setAlbaranDeleteConfirm(true)}
                      disabled={albaranViewDeleting || albaranViewSelectedId == null}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {albaranViewDeleting ? '⏳ Eliminando...' : '🗑️ Borrar albarán'}
                    </Button>
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

      {/* Modal upload albarán (firma) */}
      {pedidoCargandoAlbaran && (
        <div className="fixed inset-0 z-[10060] flex items-end landscape:items-center justify-center bg-black/50 p-0 landscape:p-2 sm:p-4">
          <div className="bg-white rounded-t-2xl landscape:rounded-lg sm:rounded-lg shadow-xl max-w-2xl landscape:max-w-4xl w-full max-h-[min(92dvh,100%)] landscape:max-h-[min(96dvh,100%)] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex justify-between items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">📄 Cargar Albarán</h2>
              <button
                type="button"
                onClick={() => {
                  setPedidoCargandoAlbaran(null);
                  setAlbaranFiles([]);
                  setAlbaranPreview(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none shrink-0"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 landscape:py-2">
              <div className="landscape:flex landscape:gap-4 landscape:items-start">
                <div className="landscape:flex-1 landscape:min-w-0">
                  <div className="mb-4 landscape:mb-2">
                    <p className="text-sm text-gray-600 mb-2">
                      Pedido: <strong>{pedidoCargandoAlbaran}</strong>
                    </p>
                    <p className="text-sm text-gray-600">
                      Puedes subir uno o varios archivos (foto o PDF). El pedido será marcado como &quot;Entregado&quot; automáticamente.
                    </p>
                  </div>
                  <div className="mb-4 landscape:mb-0">
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
                  {albaranFiles.length > 0 && !albaranPreview && (
                    <div className="mb-2">
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
                </div>
                {albaranPreview && (
                  <div className="mb-2 landscape:mb-0 landscape:flex-1 landscape:min-w-0">
                    <p className="text-sm font-medium text-gray-700 mb-2">Vista previa (primera imagen):</p>
                    <div className="border border-gray-300 rounded-lg p-2">
                      <img
                        src={albaranPreview}
                        alt="Preview albarán"
                        className="max-w-full h-auto max-h-40 sm:max-h-56 landscape:max-h-[48dvh] mx-auto object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 py-3 flex flex-col gap-2 landscape:flex-row landscape:justify-end sm:flex-row sm:justify-end sm:gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                onClick={handleUploadAlbaran}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white order-1 sm:order-2"
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
              <Button
                onClick={() => {
                  setPedidoCargandoAlbaran(null);
                  setAlbaranFiles([]);
                  setAlbaranPreview(null);
                }}
                variant="outline"
                className="w-full sm:w-auto order-2 sm:order-1"
                disabled={uploadingAlbaran}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!copiaConfirmPedido}
        onClose={() => setCopiaConfirmPedido(null)}
        onConfirm={() => {
          if (!copiaConfirmPedido || copiandoPedidoUid) return;
          void handleCopiarPedido(copiaConfirmPedido);
        }}
        title="Crear pedido por copia"
        message={
          copiaConfirmPedido
            ? `¿Crear un pedido nuevo copiando productos y comunidad de #${copiaConfirmPedido.pedido_uid}? Se usarán los precios actuales del catálogo. El nuevo pedido quedará en estado «pendiente» con la fecha de hoy.`
            : '¿Confirmas crear el pedido por copia?'
        }
        confirmText="Crear copia"
        cancelText="Cancelar"
        type="info"
        overlayZIndex={10050}
      />

      <ConfirmModal
        isOpen={!!deleteConfirmUid}
        onClose={() => setDeleteConfirmUid(null)}
        onConfirm={() => {
          if (!deleteConfirmUid) return;
          void handleDeletePedido(deleteConfirmUid);
        }}
        title="Eliminar pedido"
        message={
          deleteConfirmUid
            ? `¿Estás seguro de que quieres eliminar el pedido #${deleteConfirmUid}? Esta acción no se puede deshacer y eliminará todos los datos asociados.`
            : '¿Confirmas eliminar el pedido?'
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        overlayZIndex={10050}
      />

      <ConfirmModal
        isOpen={albaranDeleteConfirm}
        onClose={() => setAlbaranDeleteConfirm(false)}
        onConfirm={() => {
          void handleDeleteAlbaran();
        }}
        title="Eliminar albarán"
        message={(() => {
          const selected = albaranesListaMeta?.find((a) => a.id === albaranViewSelectedId);
          const label = selected?.nombre_archivo || 'este albarán';
          const unico =
            albaranesListaMeta && albaranesListaMeta.length <= 1
              ? ' Si era el único albarán, el pedido volverá a «enviado».'
              : '';
          return `¿Eliminar «${label}»? Esta acción no se puede deshacer.${unico}`;
        })()}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        overlayZIndex={10060}
      />
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
  
  // State pentru filtrare și sortare produse
  const [productoSearchTerm, setProductoSearchTerm] = useState('');
  const [productoSortBy, setProductoSortBy] = useState<'descripcion' | 'numero' | 'precio'>('descripcion');
  const [productoSortOrder, setProductoSortOrder] = useState<'asc' | 'desc'>('asc');

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
          .map((cliente, index) => {
            // Folosește ID-ul real din baza de date, nu index + 1
            const clienteId = cliente.id || cliente.ID || (index + 1);
            return {
              id: clienteId,
              nombre: cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre || 'Sin nombre',
              datosCompletos: cliente // Păstrăm datele complete ale clientului
            };
          })
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
        const headers: Record<string, string> = {
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

  // Filtrare și sortare produse
  const productosFiltradosYOrdenados = useMemo(() => {
    let filtered = [...productos];
    
    // Filtrare după termenul de căutare
    if (productoSearchTerm.trim()) {
      const searchLower = productoSearchTerm.toLowerCase();
      filtered = filtered.filter(producto => 
        producto.numero.toLowerCase().includes(searchLower) ||
        producto.descripcion.toLowerCase().includes(searchLower)
      );
    }
    
    // Sortare
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (productoSortBy) {
        case 'descripcion':
          comparison = a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
          break;
        case 'numero':
          comparison = a.numero.localeCompare(b.numero, 'es', { sensitivity: 'base' });
          break;
        case 'precio':
          comparison = a.precio - b.precio;
          break;
        default:
          comparison = 0;
      }
      
      return productoSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [productos, productoSearchTerm, productoSortBy, productoSortOrder]);

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
      const headers: Record<string, string> = {
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

      await response.json();

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
                {productosFiltradosYOrdenados.length > 0 && (
                  <span className="text-sm font-normal text-green-600 ml-2">
                    ({productosFiltradosYOrdenados.length} de {productos.length} productos)
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
                    productosFiltradosYOrdenados.forEach(producto => {
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
                    productosFiltradosYOrdenados.forEach(producto => {
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
            
            {/* Filtrare și sortare */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Buscar por número o descripción..."
                  value={productoSearchTerm}
                  onChange={(e) => setProductoSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={productoSortBy}
                  onChange={(e) => setProductoSortBy(e.target.value as 'descripcion' | 'numero' | 'precio')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="descripcion">Ordenar por Descripción</option>
                  <option value="numero">Ordenar por Número</option>
                  <option value="precio">Ordenar por Precio</option>
                </select>
                <button
                  onClick={() => setProductoSortOrder(productoSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center space-x-1"
                  title={productoSortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                >
                  {productoSortOrder === 'asc' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
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
                    {productosFiltradosYOrdenados.length > 0 ? (
                      productosFiltradosYOrdenados.map(producto => (
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
  const [sortField, setSortField] = useState<'id' | 'numero' | 'descripcion' | 'precio'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
        const headers: Record<string, string> = {
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

  // Filtrare și sortare produse
  const productosFiltrados = useMemo(() => {
    // Filtrare
    let filtered = productos;
    if (searchTerm) {
      filtered = productos.filter(producto => 
        producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sortare
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'numero':
          aValue = a.numero || '';
          bValue = b.numero || '';
          break;
        case 'descripcion':
          aValue = a.descripcion || '';
          bValue = b.descripcion || '';
          break;
        case 'precio':
          aValue = a.precio || 0;
          bValue = b.precio || 0;
          break;
        case 'id':
        default:
          aValue = a.id || 0;
          bValue = b.id || 0;
          break;
      }
      
      // Comparare
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'es', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
    
    return sorted;
  }, [searchTerm, productos, sortField, sortDirection]);

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
      const headers: Record<string, string> = {
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
      const headers: Record<string, string> = {
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
      const headers: Record<string, string> = {
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
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 max-w-md">
              <Input
                label="Buscar productos"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número o descripción..."
              />
            </div>
            
            <div className="flex gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Ordenar por
                </label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as 'id' | 'numero' | 'descripcion' | 'precio')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="id">ID</option>
                  <option value="numero">Número</option>
                  <option value="descripcion">Descripción</option>
                  <option value="precio">Precio</option>
                </select>
              </div>
              
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
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

// ===== TAB NOTAS =====
const TabNotas: React.FC<{ 
  addToast: (type: ToastType, title: string, message: string, duration?: number) => void;
}> = ({ addToast }) => {
  const [notas, setNotas] = useState<PedidosNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingNota, setEditingNota] = useState<PedidosNota | null>(null);
  const [formData, setFormData] = useState({ titulo: '', contenido: '' });
  const [uploadingImagenes, setUploadingImagenes] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Încarcă notele
  const loadNotas = useCallback(async () => {
    setLoading(true);
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
        setNotas(data);
      } else {
        addToast('error', 'Error', 'No se pudieron cargar las notas');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `Error al cargar notas: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadNotas();
  }, [loadNotas]);

  // Formatare dată
  const formatDate = (date: string | Date) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  // Deschide modal pentru notă nouă
  const handleNewNota = () => {
    setEditingNota(null);
    setFormData({ titulo: '', contenido: '' });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setShowModal(true);
  };

  // Deschide modal pentru editare
  const handleEditNota = (nota: PedidosNota) => {
    setEditingNota(nota);
    setFormData({
      titulo: nota.titulo || '',
      contenido: nota.contenido || '',
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setShowModal(true);
  };

  // Salvează notă (creare sau actualizare)
  const handleSaveNota = async () => {
    if (!formData.contenido.trim()) {
      addToast('error', 'Error', 'El contenido es requerido');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      let notaId: number;

      if (editingNota) {
        // Actualizare
        const response = await fetch(routes.updatePedidosNota(editingNota.id), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error('Error al actualizar nota');
        notaId = editingNota.id;
        addToast('success', 'Éxito', 'Nota actualizada correctamente');
      } else {
        // Creare
        const response = await fetch(routes.createPedidosNota, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error('Error al crear nota');
        const data = await response.json();
        notaId = data.id;
        addToast('success', 'Éxito', 'Nota creada correctamente');
      }

      // Upload poze dacă există
      if (selectedFiles.length > 0) {
        await uploadImagenes(notaId);
      }

      setShowModal(false);
      loadNotas();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `Error: ${errorMessage}`);
    }
  };

  // Upload poze
  const uploadImagenes = async (notaId: number) => {
    if (selectedFiles.length === 0) return;

    setUploadingImagenes(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const formData = new FormData();
      
      selectedFiles.forEach((file) => {
        formData.append('imagenes', file);
      });

      const response = await fetch(routes.uploadPedidosNotaImagenes(notaId), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Error al subir imágenes');
      
      addToast('success', 'Éxito', 'Imágenes subidas correctamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `Error al subir imágenes: ${errorMessage}`);
    } finally {
      setUploadingImagenes(false);
    }
  };

  // Șterge notă
  const handleDeleteNota = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) return;

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(routes.deletePedidosNota(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al eliminar nota');
      
      addToast('success', 'Éxito', 'Nota eliminada correctamente');
      loadNotas();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `Error: ${errorMessage}`);
    }
  };

  // Șterge poză
  const handleDeleteImagen = async (imagenId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta imagen?')) return;

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(routes.deletePedidosNotaImagen(imagenId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al eliminar imagen');
      
      addToast('success', 'Éxito', 'Imagen eliminada correctamente');
      loadNotas();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addToast('error', 'Error', `Error: ${errorMessage}`);
    }
  };

  // Gestionează selecția de fișiere
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    
    // Creează preview-uri
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  // URL API (R2/disk stream) + token for <img src> / window.open
  const getImagenUrl = (imagen: PedidosNotasImagen) => {
    const pathOrUrl =
      imagen.url_archivo ||
      `/api/pedidos-notas/imagenes/${imagen.id}/archivo`;
    const baseUrl = pathOrUrl.startsWith('http')
      ? ''
      : config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
    const full = `${baseUrl}${pathOrUrl}`;
    const token =
      localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) return full;
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}token=${encodeURIComponent(token)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Notas</h2>
            <Button onClick={handleNewNota} variant="primary">
              ➕ Añadir Nota Nueva
            </Button>
          </div>
        </div>
      </Card>

      {/* Listă note */}
      {loading ? (
        <Card>
          <div className="p-6 text-center">
            <span className="text-gray-500">Cargando notas...</span>
          </div>
        </Card>
      ) : notas.length === 0 ? (
        <Card>
          <div className="p-6 text-center">
            <span className="text-gray-500">No hay notas aún</span>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notas.map((nota) => (
            <Card key={nota.id} className="hover:shadow-lg transition-shadow">
              <div className="p-6">
                {nota.titulo && (
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {nota.titulo}
                  </h3>
                )}
                <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                  {nota.contenido}
                </p>
                
                {/* Poze */}
                {nota.imagenes && nota.imagenes.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {nota.imagenes.map((imagen: PedidosNotasImagen) => (
                      <div key={imagen.id} className="relative group">
                        <img
                          src={getImagenUrl(imagen)}
                          alt={imagen.nombre_archivo}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleDeleteImagen(imagen.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>Creado: {formatDate(nota.creado_en)}</span>
                  {nota.creado_por && <span>por {nota.creado_por}</span>}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEditNota(nota)}
                    variant="outline"
                    className="flex-1"
                  >
                    ✏️ Editar
                  </Button>
                  <Button
                    onClick={() => handleDeleteNota(nota.id)}
                    variant="outline"
                    className="flex-1 text-red-600 hover:bg-red-50"
                  >
                    🗑️ Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal creare/editare */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingNota ? 'Editar Nota' : 'Nueva Nota'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título (opcional)
                  </label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ej: No comprar limpiacristales"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contenido *
                  </label>
                  <textarea
                    value={formData.contenido}
                    onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                    placeholder="Escribe el contenido de la nota..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imágenes (opcional)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  
                  {/* Preview poze */}
                  {previewUrls.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleSaveNota}
                  variant="primary"
                  className="flex-1"
                  disabled={uploadingImagenes}
                >
                  {uploadingImagenes ? 'Subiendo...' : 'Guardar'}
                </Button>
                <Button
                  onClick={() => setShowModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
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

  // Dacă loading, nu afișăm nimic (sau poți afișa un spinner)
  if (loading) {
    return null;
  }

  // Dacă nu există note, nu afișăm banner-ul
  if (notas.length === 0) {
    console.log('📝 [BannerNotas] No notas found, not showing banner');
    return null;
  }

  // URL API (R2/disk stream) + token for <img src> / window.open
  const getImagenUrl = (imagen: PedidosNotasImagen) => {
    const pathOrUrl =
      imagen.url_archivo ||
      `/api/pedidos-notas/imagenes/${imagen.id}/archivo`;
    const baseUrl = pathOrUrl.startsWith('http')
      ? ''
      : config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
    const full = `${baseUrl}${pathOrUrl}`;
    const token =
      localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) return full;
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}token=${encodeURIComponent(token)}`;
  };

  return (
    <div className="mb-6 space-y-4">
      {notas.map((nota) => (
        <Card key={nota.id} className="border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-white shadow-lg">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
              </div>
              <div className="flex-1">
                {nota.titulo && (
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {nota.titulo}
                  </h3>
                )}
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {nota.contenido}
                </div>
                
                {/* Poze */}
                {nota.imagenes && nota.imagenes.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {nota.imagenes.map((imagen: PedidosNotasImagen) => (
                      <div key={imagen.id} className="relative group">
                        <img
                          src={getImagenUrl(imagen)}
                          alt={imagen.nombre_archivo}
                          className="w-full h-32 object-cover rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                          onClick={() => {
                            // Deschide imaginea în modal/fullscreen
                            window.open(getImagenUrl(imagen), '_blank');
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded-lg flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-sm">🔍 Ver más grande</span>
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
  );
};

export default PedidosPage;
