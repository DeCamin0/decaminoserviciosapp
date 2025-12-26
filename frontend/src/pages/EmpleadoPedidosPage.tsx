import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import { Link } from 'react-router-dom';

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

// ===== API ENDPOINT PENTRU PRODUSE =====
// ✅ MIGRAT: Folosim backend-ul nou în loc de n8n
const CATALOGO_API_URL = routes.getCatalogo;

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
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

// ===== FUNCȚII UTILITARE =====
const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat("es-ES", { 
    style: "currency", 
    currency: "EUR" 
  }).format(amount);
};

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
  const [toasts, setToasts] = useState<Toast[]>([]);

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Nuevo Pedido</h1>
            <p className="text-gray-600">Crea un nuevo pedido para tu centro de trabajo</p>
          </div>
        </div>

        {/* Content */}
        <TabNuevoPedido addToast={addToast} />
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
  const [notas, setNotas] = useState('');
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [comunidadSeleccionada, setComunidadSeleccionada] = useState<number | null>(null);
  const [loadingComunidades, setLoadingComunidades] = useState(false);
  const [comunidadDetalles, setComunidadDetalles] = useState<any>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [cantidadesProductos, setCantidadesProductos] = useState<{[key: number]: number}>({});
  
  // Nu mai avem nevoie de state pentru dropdown - comunitatea se selectează automat

  // Încarcă centrele de trabajo (comunidades) și datele complete ale angajatului
  useEffect(() => {
    const loadComunidadesAndUserData = async () => {
      setLoadingComunidades(true);
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
            return {
              id: index + 1,
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
          
          if (found) {
            const centroTrabajo = found['CENTRO TRABAJO'];
            
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
        }
      } catch (error) {
        console.error('Error loading comunidades and user data:', error);
      } finally {
        setLoadingComunidades(false);
      }
    };

    loadComunidadesAndUserData();
  }, [routes.getClientes, user]);

  // Încarcă produsele din API
  useEffect(() => {
    const loadProductos = async () => {
      setLoadingProductos(true);
      try {
        const response = await fetch(CATALOGO_API_URL, {
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
        // Productos cargados exitosamente
        
        if (data && Array.isArray(data)) {
          // ✅ Backend-ul returnează deja datele în formatul corect (id, numero, descripcion, precio, imagen)
          // Nu mai trebuie să facem conversie de buffer, backend-ul returnează deja base64
          setProductos(data);
        }
      } catch (error) {
        console.error('❌ Error loading productos:', error);
        addToast('error', 'Error', 'No se pudieron cargar los productos.');
      } finally {
        setLoadingProductos(false);
      }
    };

    loadProductos();
  }, []);

  // Actualizează detaliile comunității când se selectează una
  const handleComunidadChange = async (comunidadId: number) => {
    setComunidadSeleccionada(comunidadId);
    
    try {
      // NU schimbăm numele comunității - folosim numele corect din comunidadDetalles
      let nombreComunidad = comunidadDetalles?.nombre || 'Comunidad no encontrada';
      
      // Verifică dacă numele este corect
      if (nombreComunidad === 'Comunidad no encontrada') {
        // Încearcă să găsești în lista de comunități
        const comunidad = comunidades.find(c => c.id === comunidadId);
        if (comunidad) {
          nombreComunidad = comunidad.nombre || comunidad['NOMBRE O RAZON SOCIAL'] || 'Comunidad no encontrada';
        }
      }
      
      // Cargando detalles para la comunidad
      
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
          productosConPermisos = data.map((item: any) => {
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
              precio: parseFloat(item.precio || 0),
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
            precio: parseFloat(data.precio || 0),
            permitido: data.permitido === 1 || data.permitido === true || data.permitido === '1',
            imagen: imagenBase64 || undefined
          }];
        }
        
        // Log pentru imagini
        const productosConImagen = productosConPermisos.filter(p => p.imagen).length;
        // Productos con imagen procesados
        
        // Actualizează produsele cu permisiunile lor
        setProductos(productosConPermisos);
        
        // NU schimbăm numele comunității - păstrăm numele corect
        setComunidadDetalles(prev => ({
          ...prev!,
          id: comunidadId,
          productos: productosConPermisos,
          // Include datele complete ale comunității
          'NOMBRE O RAZON SOCIAL': prev?.datosCompletos?.['NOMBRE O RAZON SOCIAL'] || prev?.nombre || 'N/A',
          NIF: prev?.datosCompletos?.NIF || 'N/A',
          TELEFONO: prev?.datosCompletos?.TELEFONO || 'N/A',
          DIRECCION: prev?.datosCompletos?.DIRECCION || 'N/A',
          'CODIGO POSTAL': prev?.datosCompletos?.['CODIGO POSTAL'] || 'N/A',
          POBLACION: prev?.datosCompletos?.POBLACION || 'N/A',
          PROVINCIA: prev?.datosCompletos?.PROVINCIA || 'N/A',
          PAIS: prev?.datosCompletos?.PAIS || 'N/A',
          LATITUD: prev?.datosCompletos?.LATITUD || null,
          LONGITUD: prev?.datosCompletos?.LONGITUD || null
        }));
        
        addToast('success', 'Detalles cargados', `Detalles de "${nombreComunidad}" (ID: ${comunidadId}) cargados correctamente. ${productosConPermisos.length} productos con permisos.`);
      } else {
        throw new Error('Respuesta vacía o inválida');
      }
      
    } catch (error) {
      console.error('❌ Error cargando detalles de comunidad:', error);
      addToast('error', 'Error', 'No se pudieron cargar los detalles de la comunidad.');
    }
  };

  // Nu mai avem nevoie de filtrare - comunitatea se selectează automat

  // Filtrare produse pentru căutare
  const productosFiltrados = useMemo(() => {
    if (!searchTerm) return productos.slice(0, 20);
    return productos.filter(producto => 
      producto.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 20);
  }, [productos, searchTerm]);

  // Funcție pentru a obține limita de cheltuieli a comunității
  const getLimiteGasto = () => {
    if (!comunidadDetalles?.datosCompletos) return null;
    
    const limite = comunidadDetalles.datosCompletos.CuantoPuedeGastar;
    if (limite && !isNaN(parseFloat(limite))) {
      return parseFloat(limite);
    }
    return null;
  };

  // Funcție pentru a verifica dacă se poate adăuga produsul fără a depăși limita
  const puedeAgregarProducto = (producto: Producto, cantidad: number = 1) => {
    const limite = getLimiteGasto();
    if (!limite) return true; // Dacă nu există limită, se poate adăuga
    
    const precioTotal = producto.precio * cantidad;
    const totalActual = lineasPedido.reduce((sum, linea) => {
      const prod = productos.find(p => p.id === linea.producto_id);
      return sum + (prod ? prod.precio * linea.cantidad : 0);
    }, 0);
    
    return (totalActual + precioTotal) <= limite;
  };

  // Actualizează cantitatea pentru un produs
  const actualizarCantidadProducto = (productoId: number, cantidad: number) => {
    setCantidadesProductos(prev => ({
      ...prev,
      [productoId]: Math.max(1, cantidad) // Minimum 1
    }));
  };

  // Adaugă produs în comandă
  const agregarProducto = (producto: Producto, cantidad: number = 1) => {
    // Verifică limita de cheltuieli
    if (!puedeAgregarProducto(producto, cantidad)) {
      const limite = getLimiteGasto();
      addToast('error', 'Límite excedido', `No se puede agregar este producto. Has superado el límite de gasto permitido.`);
      return;
    }

    const nuevaLinea: LineaPedido = {
      producto_id: producto.id,
      cantidad: cantidad,
      precio_unitario: producto.precio,
      descuento_linea: 0,
      iva_porcentaje: 21
    };
    
    setLineasPedido(prev => [...prev, nuevaLinea]);
    addToast('success', 'Producto añadido', `${producto.descripcion} (${cantidad} unidades) añadido al pedido.`);
  };

  // Elimină linia din comandă
  const eliminarLinea = (index: number) => {
    const producto = productos.find(p => p.id === lineasPedido[index]?.producto_id);
    const nombreProducto = producto?.descripcion || 'este producto';
    
    if (window.confirm(`¿Estás seguro de que quieres eliminar ${nombreProducto} del pedido?`)) {
      setLineasPedido(prev => prev.filter((_, i) => i !== index));
      addToast('info', 'Línea eliminada', 'Producto eliminado del pedido.');
    }
  };

  // Actualizează cantitatea
  const actualizarCantidad = (index: number, cantidad: number) => {
    setLineasPedido(prev => prev.map((linea, i) => 
      i === index ? { ...linea, cantidad } : linea
    ));
  };

  // Calculează totalul unei linii
  const calcularLinea = (linea: LineaPedido) => {
    const subtotal = linea.cantidad * linea.precio_unitario;
    const iva = subtotal * 0.21; // IVA fix la 21%
    return subtotal + iva;
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
    console.log('🔍 IVA Calculation:', { subtotal, iva, percentage: (iva / subtotal) * 100 });
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
        id: comunidadDetalles?.id || 'N/A',
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
        impuestos: 0,
        notas: notas,
        subtotal: calcularSubtotal(),
        iva_total: calcularIVA(),
        total: calcularTotal(),
        limite_excedido: getLimiteGasto() ? calcularSubtotal() > getLimiteGasto() : false,
        exceso_limite: getLimiteGasto() ? (calcularSubtotal() > getLimiteGasto() ? 1 : 0) : 0,
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
            `Pedido ${responseData.pedido_uid} guardado correctamente.`
          );
          
          // Resetează comanda după salvarea cu succes
          setLineasPedido([]);
          setNotas('');
          setCantidadesProductos({});
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
    comunidad: user?.['CENTRO TRABAJO'] || user?.CENTRO_TRABAJO || user?.CENTRO || 'Sin centro'
  };

  return (
    <div className="space-y-6">
      {/* Informații pedido */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-900">Información del Pedido</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Căutare produse */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-green-900">
            Buscar Productos ({productos.length} productos cargados)
          </h3>
          <div className="mb-4">
            <Input
              id="search-productos"
              type="text"
              placeholder="Buscar por número o descripción (Ej: A-100 o Pintura blanca)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              aria-label="Buscar productos"
            />
          </div>
          
          {loadingProductos ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Cargando productos...</p>
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
                    </div>
                    
                    {/* Cantidad y Buton Añadir */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <label htmlFor={`cantidad-${producto.id}`} className="text-xs text-gray-600">Cant:</label>
                        <Input
                          id={`cantidad-${producto.id}`}
                          type="number"
                          min="1"
                          value={cantidadesProductos[producto.id] || 1}
                          onChange={(e) => actualizarCantidadProducto(producto.id, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-sm"
                          aria-label={`Cantidad para ${producto.descripcion}`}
                        />
                      </div>
                      <Button
                        onClick={() => agregarProducto(producto, cantidadesProductos[producto.id] || 1)}
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

      {/* Liniile din comandă */}
      {lineasPedido.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-purple-900">Líneas del Pedido</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-left py-2">Cantidad</th>
                    <th className="text-left py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasPedido.map((linea, index) => {
                    const producto = productos.find(p => p.id === linea.producto_id);
                    return (
                      <tr key={index} className="border-b">
                        <td className="py-2">
                          <div>
                            <div className="font-medium">{producto?.numero || 'N/A'}</div>
                            <div className="text-sm text-gray-600">{producto?.descripcion || 'N/A'}</div>
                          </div>
                        </td>
                        <td className="py-2">
                          <label htmlFor={`cantidad-pedido-${index}`} className="sr-only">Cantidad</label>
                          <Input
                            id={`cantidad-pedido-${index}`}
                            name={`cantidad-pedido-${index}`}
                            type="number"
                            min="1"
                            value={linea.cantidad}
                            onChange={(e) => actualizarCantidad(index, parseInt(e.target.value) || 1)}
                            className="w-20"
                            aria-label={`Cantidad para ${producto?.descripcion || 'producto'}`}
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            onClick={() => eliminarLinea(index)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            Eliminar
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
            <h3 className="text-lg font-semibold mb-4 text-orange-900">Resumen</h3>
            <div className="mt-4">
              <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">Horario Entrega</label>
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Especifica el horario de entrega deseado..."
              />
            </div>
            {getLimiteGasto() && calcularSubtotal() > getLimiteGasto() ? (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 mb-2">
                    ⚠️ Límite excedido
                  </div>
                  <div className="text-lg text-red-700 mb-2">
                    Has superado el límite de gasto permitido
                  </div>
                  <div className="text-sm text-red-600">
                    💡 Sugerencia: Reduce las cantidades de los productos para ajustarte al límite
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    ✅ Pedido válido
                  </div>
                  <div className="text-sm text-green-700">
                    El pedido está dentro del límite permitido
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-4">
              <Button
                onClick={guardarBorrador}
                className="bg-blue-600 hover:bg-blue-700 text-white"
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

export default EmpleadoPedidosPage;
