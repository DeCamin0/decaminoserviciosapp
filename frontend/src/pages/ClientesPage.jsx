import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import activityLogger from '../utils/activityLogger';
import { Card, Button, Modal, Input } from '../components/ui';
import Notification from '../components/ui/Notification';
import Back3DButton from '../components/Back3DButton';
import { useNavigate } from 'react-router';
import ClienteForm from '../components/clientes/ClienteForm';
import { routes } from '../utils/routes';
import { useLoadingState } from '../hooks/useLoadingState';
import { TableLoading } from '../components/ui/LoadingStates';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';

export default function ClientesPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('clientes'); // 'clientes' o 'proveedores'
  const [density, setDensity] = useState('comfortable'); // 'comfortable' | 'compact'
  const [showFiltersClientes, setShowFiltersClientes] = useState(true);
  const [showFiltersProveedores, setShowFiltersProveedores] = useState(true);
  
  // Loading states centralizate
  const {
    setOperationLoading,
    isOperationLoading
  } = useLoadingState();
  
  // Estado para clientes
  const [clientes, setClientes] = useState([]);
  const [errorClientes, setErrorClientes] = useState('');
  const [searchTermClientes, setSearchTermClientes] = useState('');
  const [selectedActivoClientes, setSelectedActivoClientes] = useState('todos');
  
  // Estado para proveedores
  const [proveedores, setProveedores] = useState([]);
  const [errorProveedores, setErrorProveedores] = useState('');
  const [searchTermProveedores, setSearchTermProveedores] = useState('');
  const [selectedActivoProveedores, setSelectedActivoProveedores] = useState('todos');
  
  // Estado común
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editItem, setEditItem] = useState(null);

  // Endpoint selector: clientes -> backend, proveedores -> backend
  const getCrudEndpoint = (tipo) => {
    if ((tipo || '').toLowerCase() === 'proveedor' || (tipo || '').toLowerCase() === 'proveedores') {
      // Furnizori: folosim backend-ul nou
      return routes.crudProveedor;
    }
    // Clienți: folosim backend-ul nou
    return routes.crudCliente;
  };
  const [tableView, setTableView] = useState('detailed'); // 'detailed' | 'compact'
  const [notif, setNotif] = useState({ open: false, type: 'success', title: '', message: '' });

  // Helper para detectar comunidades de propietarios
  const isComunidad = (cliente) => {
    const nombre = cliente['NOMBRE O RAZON SOCIAL'] || '';
    return nombre.includes('C.P.') || 
           nombre.includes('C.P ') || 
           nombre.includes('CP ') || 
           nombre.includes('CP.') || 
           nombre.includes('COMUNIDAD DE PROPIETARIOS');
  };

  // Datos demo de clientes
  const setDemoClientes = () => {
    const demoClientes = [
      {
        'NOMBRE O RAZON SOCIAL': 'C.P. Residencia Los Pinos',
        'DIRECCION': 'Calle Los Pinos, 15, 28001 Madrid',
        'TELEFONO': '+34 91 123 4567',
        'EMAIL': 'admin@lospinos.com',
        'CONTACTO': 'María González',
        'ACTIVO': 'Sí',
        'TIPO': 'Comunidad',
        'SERVICIOS': 'Limpieza, Jardinería',
        'VALOR CONTRATO': '2.500,00€',
        'LATITUD': '40.4168',
        'LONGITUD': '-3.7038'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Hospital Universitario San Carlos',
        'DIRECCION': 'Calle Profesor Martín Lagos, s/n, 28040 Madrid',
        'TELEFONO': '+34 91 330 3000',
        'EMAIL': 'servicios@hospital.com',
        'CONTACTO': 'Dr. Carlos Rodríguez',
        'ACTIVO': 'Sí',
        'TIPO': 'Centro Sanitario',
        'SERVICIOS': 'Limpieza quirófanos, Limpieza general',
        'VALOR CONTRATO': '15.000,00€',
        'LATITUD': '40.4395',
        'LONGITUD': '-3.7226'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Centro Comercial Plaza Norte',
        'DIRECCION': 'Avenida de la Gran Vía, 85, 28003 Madrid',
        'TELEFONO': '+34 91 555 7777',
        'EMAIL': 'servicios@plazanorte.com',
        'CONTACTO': 'Ana Martínez',
        'ACTIVO': 'Sí',
        'TIPO': 'Centro Comercial',
        'SERVICIOS': 'Limpieza, Seguridad, Mantenimiento',
        'VALOR CONTRATO': '8.500,00€',
        'LATITUD': '40.4656',
        'LONGITUD': '-3.6969'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Colegio Privado San Agustín',
        'DIRECCION': 'Calle San Agustín, 25, 28014 Madrid',
        'TELEFONO': '+34 91 444 8888',
        'EMAIL': 'administracion@sanagustin.edu',
        'CONTACTO': 'Padre Miguel Ángel',
        'ACTIVO': 'Sí',
        'TIPO': 'Educación',
        'SERVICIOS': 'Limpieza, Conserjería',
        'VALOR CONTRATO': '3.200,00€',
        'LATITUD': '40.4168',
        'LONGITUD': '-3.7038'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Oficinas Corporativas TechCorp',
        'DIRECCION': 'Paseo de la Castellana, 200, 28046 Madrid',
        'TELEFONO': '+34 91 777 9999',
        'EMAIL': 'facilities@techcorp.com',
        'CONTACTO': 'Isabel Fernández',
        'ACTIVO': 'Sí',
        'TIPO': 'Oficinas',
        'SERVICIOS': 'Limpieza, Recepción',
        'VALOR CONTRATO': '5.800,00€',
        'LATITUD': '40.4637',
        'LONGITUD': '-3.6889'
      }
    ];

    const demoProveedores = [
      {
        'NOMBRE O RAZON SOCIAL': 'Limpiezas Profesionales SL',
        'DIRECCION': 'Calle Industrial, 45, 28022 Madrid',
        'TELEFONO': '+34 91 666 1111',
        'EMAIL': 'info@limpiezaspro.com',
        'CONTACTO': 'Roberto Silva',
        'ACTIVO': 'Sí',
        'TIPO': 'Proveedor',
        'SERVICIOS': 'Productos limpieza, Equipos',
        'VALOR CONTRATO': '1.200,00€'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Seguridad Total Madrid',
        'DIRECCION': 'Avenida de América, 100, 28028 Madrid',
        'TELEFONO': '+34 91 333 4444',
        'EMAIL': 'contacto@seguridadtotal.com',
        'CONTACTO': 'Carmen López',
        'ACTIVO': 'Sí',
        'TIPO': 'Proveedor',
        'SERVICIOS': 'Vigilancia, Alarmas',
        'VALOR CONTRATO': '4.500,00€'
      }
    ];

    setClientes(demoClientes);
    setProveedores(demoProveedores);
  };

  // Funcție pentru a normaliza coordonatele și a crea link Google Maps
  const getGoogleMapsLink = (lat, lng) => {
    if (!lat || !lng) return null;
    
    // Normalizează coordonatele (înlocuiește virgula cu punct)
    const normalizedLat = lat.toString().replace(',', '.');
    const normalizedLng = lng.toString().replace(',', '.');
    
    return `https://www.google.com/maps?q=${normalizedLat},${normalizedLng}`;
  };

  const fetchClientes = useCallback(async () => {
    // Saltar fetch real en modo DEMO
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchClientes in ClientesPage');
      return;
    }

    setOperationLoading('clientes', true);
    setErrorClientes('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Fetching clientes from:', routes.getClientes);
      const response = await fetch(routes.getClientes, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Clientes data received:', data);
      
      const clientesData = Array.isArray(data) ? data : [];
      // Filtrar solo clientes (no proveedores)
      const soloClientes = clientesData.filter(item => item.tipo !== 'proveedor');
      
      // Debug: verifică coordonatele GPS
      console.log('🔍 Total clientes:', soloClientes.length);
      const clientesConCoords = soloClientes.filter(c => c.LATITUD && c.LONGITUD);
      console.log('📍 Clientes con coordenadas GPS:', clientesConCoords.length);
      console.log('🗺️ Clientes sin coordenadas:', soloClientes.length - clientesConCoords.length);
      
      // Debug: arată primii 3 clienți cu coordonate
      if (clientesConCoords.length > 0) {
        console.log('📍 Primeros 3 clientes con coordenadas:', clientesConCoords.slice(0, 3).map(c => ({
          nombre: c['NOMBRE O RAZON SOCIAL'],
          lat: c.LATITUD,
          lng: c.LONGITUD
        })));
      }
      
      setClientes(soloClientes);
      
      // Log acceso a página
      await activityLogger.logPageAccess('clientes', authUser);
      
    } catch (e) {
      setErrorClientes('No se pudieron cargar los clientes.');
      console.error('Error fetching clientes:', e);
    } finally {
      setOperationLoading('clientes', false);
    }
  }, [authUser, setOperationLoading]);

  const fetchProveedores = useCallback(async () => {
    // Saltar fetch real en modo DEMO
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchProveedores in ClientesPage');
      return;
    }

    setOperationLoading('proveedores', true);
    setErrorProveedores('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Fetching proveedores from:', routes.getProveedores);
      const response = await fetch(routes.getProveedores, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const proveedoresData = Array.isArray(data) ? data : [];
      setProveedores(proveedoresData);
    } catch (e) {
      setErrorProveedores('No se pudieron cargar los proveedores.');
      console.error('Error fetching proveedores:', e);
    } finally {
      setOperationLoading('proveedores', false);
    }
  }, [authUser, setOperationLoading]);

  // Fetch datos
  useEffect(() => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo clientes data instead of fetching from backend');
      setDemoClientes();
      setOperationLoading('clientes', false);
      setOperationLoading('proveedores', false);
      return;
    }

    fetchClientes();
    fetchProveedores();
  }, [authUser?.isDemo, fetchClientes, fetchProveedores, setOperationLoading]);

  // Filtro clientes (memoizat pentru performanță)
  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const matchesSearch = cliente['NOMBRE O RAZON SOCIAL']?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.NIF?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.EMAIL?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.POBLACION?.toLowerCase().includes(searchTermClientes.toLowerCase());
      
      // Pentru moment, toți clienții sunt considerați activi
      const matchesActivo = selectedActivoClientes === 'todos' || 
                           (selectedActivoClientes === 'activo' && true) ||
                           (selectedActivoClientes === 'inactivo' && false);
      
      return matchesSearch && matchesActivo;
    });
  }, [clientes, searchTermClientes, selectedActivoClientes]);

  // Filtro proveedores (memoizat pentru performanță)
  const filteredProveedores = useMemo(() => {
    return proveedores.filter(proveedor => {
      const matchesSearch = proveedor['NOMBRE O RAZÓN SOCIAL']?.toLowerCase().includes(searchTermProveedores.toLowerCase()) ||
                           proveedor.NIF?.toLowerCase().includes(searchTermProveedores.toLowerCase()) ||
                           proveedor.EMAIL?.toLowerCase().includes(searchTermProveedores.toLowerCase());
      
      // Pentru moment, toți furnizorii sunt considerați activi
      const matchesActivo = selectedActivoProveedores === 'todos' || 
                           (selectedActivoProveedores === 'activo' && true) ||
                           (selectedActivoProveedores === 'inactivo' && false);
      
      return matchesSearch && matchesActivo;
    });
  }, [proveedores, searchTermProveedores, selectedActivoProveedores]);

  const handleAddItem = async (itemData) => {
    try {
      // Mapear a claves esperadas por backend (enviar TODO, incluso vacío)
      const d = itemData || {};
      const backendPayload = {
        action: 'add',
        'NIF': d.nif ?? '',
        'NOMBRE O RAZON SOCIAL': d.nombre ?? '',
        'TIPO': d.tipo ?? '',
        'EMAIL': d.email ?? '',
        'TELEFONO': d.telefono ?? '',
        'MOVIL': d.movil ?? '',
        'FAX': d.fax ?? '',
        'DIRECCION': d.direccion ?? '',
        'CODIGO POSTAL': d.cp ?? '',
        'POBLACION': d.ciudad ?? '',
        'PROVINCIA': d.provincia ?? '',
        'PAIS': d.pais ?? '',
        'URL': d.url ?? '',
        'DESCUENTO POR DEFECTO': d.descuento_por_defecto ?? '',
        'CuantoPuedeGastar': d.limite_gasto ?? '',
        'LATITUD': d.latitud ?? '',
        'LONGITUD': d.longitud ?? '',
        'NOTAS PRIVADAS': d.notas ?? '',
        'CUENTAS BANCARIAS': d.cuentas_bancarias ?? '',
        'Fecha Ultima Renovacion': d.fecha_ultima_renovacion ?? '',
        'Fecha Proxima Renovacion': d.fecha_proxima_renovacion ?? '',
        'SERVICIO ENTREGA': d.servicio_entrega ?? '',
        'TELEFON ENTREGA': d.telefon_entrega ?? '',
        'ESTADO': d.activo ?? ''
      };

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const endpoint = getCrudEndpoint(d.tipo);
      console.log('📝 Adding item to:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(backendPayload)
      });
      
      const rawText = await response.text();
      let json;
      try { json = JSON.parse(rawText); } catch { json = null; }

      if (response.ok) {
        // Log crear ítem
        await activityLogger.logClienteCreated(backendPayload, authUser);
        
        setShowAddModal(false);
        if (activeTab === 'clientes') {
          fetchClientes();
        } else {
          fetchProveedores();
        }
        setNotif({
          open: true,
          type: 'success',
          title: 'Operación exitosa',
          message: (json && (json.mensaje || json.message)) || `${activeTab === 'clientes' ? 'Cliente' : 'Proveedor'} añadido con éxito!`
        });
      } else {
        setNotif({
          open: true,
          type: 'error',
          title: 'Error',
          message: (json && (json.mensaje || json.message)) || `Error al guardar ${activeTab === 'clientes' ? 'el cliente' : 'el proveedor'}!`
        });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setNotif({ open: true, type: 'error', title: 'Error', message: `Error al guardar ${activeTab === 'clientes' ? 'el cliente' : 'el proveedor'}!` });
    }
  };

  const handleEditItem = async (itemData) => {
    try {
      const d = itemData || {};
      const backendPayload = {
        action: 'edit',
        id: editItem?.id || d.id || '',
        nif: d.nif ?? '',
        'NIF': d.nif ?? '',
        'NOMBRE O RAZON SOCIAL': d.nombre ?? '',
        'TIPO': d.tipo ?? '',
        'EMAIL': d.email ?? '',
        'TELEFONO': d.telefono ?? '',
        'MOVIL': d.movil ?? '',
        'FAX': d.fax ?? '',
        'DIRECCION': d.direccion ?? '',
        'CODIGO POSTAL': d.cp ?? '',
        'POBLACION': d.ciudad ?? '',
        'PROVINCIA': d.provincia ?? '',
        'PAIS': d.pais ?? '',
        'URL': d.url ?? '',
        'DESCUENTO POR DEFECTO': d.descuento_por_defecto ?? '',
        'CuantoPuedeGastar': d.limite_gasto ?? '',
        'LATITUD': d.latitud ?? '',
        'LONGITUD': d.longitud ?? '',
        'NOTAS PRIVADAS': d.notas ?? '',
        'CUENTAS BANCARIAS': d.cuentas_bancarias ?? '',
        'Fecha Ultima Renovacion': d.fecha_ultima_renovacion ?? '',
        'Fecha Proxima Renovacion': d.fecha_proxima_renovacion ?? '',
        'SERVICIO ENTREGA': d.servicio_entrega ?? '',
        'TELEFON ENTREGA': d.telefon_entrega ?? '',
        'ESTADO': d.activo ?? ''
      };

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const endpoint = getCrudEndpoint(d.tipo);
      console.log('📝 Editing item at:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(backendPayload)
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditItem(null);
        if (activeTab === 'clientes') {
          fetchClientes();
        } else {
          fetchProveedores();
        }
        setNotif({ open: true, type: 'success', title: 'Operación exitosa', message: `${activeTab === 'clientes' ? 'Cliente' : 'Proveedor'} actualizado con éxito!` });
      } else {
        setNotif({ open: true, type: 'error', title: 'Error', message: `Error al actualizar ${activeTab === 'clientes' ? 'el cliente' : 'el proveedor'}!` });
      }
    } catch (error) {
      console.error('Error editing item:', error);
      setNotif({ open: true, type: 'error', title: 'Error', message: 'No se pudo actualizar' });
    }
  };

  const handleDeleteItem = async (item, tipo) => {
    try {
      const payload = { 
        action: 'delete', 
        tipo, 
        nif: item?.NIF || item?.nif,
        id: item?.id || ''
      };
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const endpoint = getCrudEndpoint(tipo);
      console.log('🗑️ Deleting item at:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        if (tipo === 'cliente') {
          fetchClientes();
        } else {
          fetchProveedores();
        }
        setNotif({ open: true, type: 'success', title: 'Eliminado', message: `${tipo === 'cliente' ? 'Cliente' : 'Proveedor'} eliminado` });
      } else {
        setNotif({ open: true, type: 'error', title: 'Error', message: 'No se pudo eliminar' });
      }
    } catch (e) {
      console.error('Error deleting item:', e);
      setNotif({ open: true, type: 'error', title: 'Error', message: 'No se pudo eliminar' });
    }
  };

  const mapRowToForm = (row, tipo) => ({
    id: row.id || '',
    tipo: tipo,
    nombre: row['NOMBRE O RAZON SOCIAL'] || row['NOMBRE O RAZÓN SOCIAL'] || '',
    nif: row.NIF || '',
    telefono: row.TELEFONO || '',
    movil: row.MOVIL || row.MÓVIL || '',
    fax: row.FAX || '',
    email: row.EMAIL || '',
    direccion: row.DIRECCION || row.DIRECCIÓN || '',
    cp: row['CODIGO POSTAL'] || '',
    ciudad: row.POBLACION || row.POBLACIÓN || '',
    provincia: row.PROVINCIA || '',
    pais: row.PAIS || row.PAÍS || 'España',
    url: row.URL || '',
    descuento_por_defecto: row['DESCUENTO POR DEFECTO'] || '',
    limite_gasto: row.CuantoPuedeGastar || '',
    latitud: row.LATITUD || '',
    longitud: row.LONGITUD || '',
    notas: row['NOTAS PRIVADAS'] || row.NOTAS_PRIVADAS || '',
    cuentas_bancarias: row['CUENTAS BANCARIAS'] || '',
    fecha_ultima_renovacion: row['Fecha Ultima Renovacion'] || '',
    fecha_proxima_renovacion: row['Fecha Proxima Renovacion'] || '',
    servicio_entrega: row['SERVICIO ENTREGA'] || row.SERVICIO_ENTREGA || '',
    telefon_entrega: row['TELEFON ENTREGA'] || row.TELEFONO_ENTREGA || '',
    activo: row.ESTADO === null ? 'Sí' : row.ESTADO
  });

  const handleViewDetails = (item) => {
    // Debug: verificar NIF
    console.log('Navigating to details:', item.NIF, item);
    
    if (!item.NIF) {
      console.error('NIF is missing for item:', item);
      setErrorClientes('Error: falta el NIF!');
      return;
    }
    
    // Navegar a la página de detalles según el tipo
    if (activeTab === 'clientes') {
    navigate(`/clientes/${item.NIF}`);
    } else {
      navigate(`/proveedores/${item.NIF}`);
    }
  };

  // Loading state pentru pagina întreagă
  if (isOperationLoading('clientes') && isOperationLoading('proveedores')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Cargando clientes y proveedores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {notif.open && (
        <Notification 
          type={notif.type}
          title={notif.title}
          message={notif.message}
          duration={5000}
          onClose={() => setNotif(prev => ({ ...prev, open: false }))}
          show
        />
      )}
      {/* Header moderno */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Back3DButton to="/inicio" title="Volver al Inicio" />
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                  Gestión de Clientes y Proveedores
                </h1>
                <p className="text-gray-500 text-sm">Administra clientes y proveedores de la empresa</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => {
                  // Date relevante pentru pagina de clientes/proveedores
                  const pageData = {
                    additionalInfo: [
                      `[TAB ACTIVO] ${activeTab === 'clientes' ? 'Clientes' : 'Proveedores'}`,
                      activeTab === 'clientes' && clientes?.length > 0 
                        ? `[CLIENTES] ${clientes.length} clientes disponibles` 
                        : null,
                      activeTab === 'proveedores' && proveedores?.length > 0 
                        ? `[PROVEEDORES] ${proveedores.length} proveedores disponibles` 
                        : null,
                    ].filter(Boolean),
                  };
                  
                  const message = buildErrorReportMessage({
                    authUser,
                    pageName: activeTab === 'clientes' ? "Clientes" : "Proveedores",
                    pageData,
                  });
                  
                  openWhatsAppErrorReport(message);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                <span>Reportar error</span>
              </button>
              <Button
                onClick={() => { setFormMode('add'); setEditItem(null); setShowAddModal(true); }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                + Añadir {activeTab === 'clientes' ? 'Cliente' : 'Proveedor'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs + Density */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'clientes'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            👥 Clientes ({clientes.length})
          </button>
          <button
            onClick={() => setActiveTab('proveedores')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'proveedores'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            🏢 Proveedores ({proveedores.length})
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">Densidad</span>
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                density === 'comfortable' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
              title="Vista cómoda"
            >
              Comfort
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                density === 'compact' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
              title="Vista compacta"
            >
              Compact
            </button>
          </div>
        </div>

        {/* Conținut pentru Clienți */}
        {activeTab === 'clientes' && (
          <div>
            {errorClientes && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-red-600 text-2xl">❌</span>
                  <div>
                    <p className="text-red-800 font-medium">{errorClientes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Filtros clientes */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-0 mb-8 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-red-600">🎯</span>
                  <span className="text-sm font-semibold text-gray-800">Filtros</span>
                  <span className="text-xs text-gray-500">Clientes</span>
                </div>
                <button
                  onClick={() => setShowFiltersClientes(v => !v)}
                  className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 transition"
                >
                  {showFiltersClientes ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showFiltersClientes && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-2">🔎 Buscar clientes</label>
                      <Input
                        type="text"
                        placeholder="Nombre, NIF, email..."
                        value={searchTermClientes}
                        onChange={(e) => setSearchTermClientes(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-2">⚙️ Estado</label>
                      <select
                        value={selectedActivoClientes}
                        onChange={(e) => setSelectedActivoClientes(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="todos">Todos</option>
                        <option value="activo">Activos</option>
                        <option value="inactivo">Inactivos</option>
                      </select>
                    </div>
                    <div className="w-full flex items-end">
                      <Button
                        onClick={fetchClientes}
                        variant="outline"
                        className="w-full"
                        loading={isOperationLoading('clientes')}
                        disabled={isOperationLoading('clientes')}
                      >
                        {isOperationLoading('clientes') ? 'Cargando...' : '🔄 Actualizar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Statistici clienți */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Total Clientes</p>
                    <p className="text-2xl font-bold">{clientes.length}</p>
                  </div>
                  <div className="text-3xl">👥</div>
                </div>
              </Card>
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Activos</p>
                    <p className="text-2xl font-bold">{clientes.length}</p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </Card>
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Comunidades</p>
                    <p className="text-2xl font-bold">{clientes.filter(isComunidad).length}</p>
                  </div>
                  <div className="text-3xl">🏘️</div>
                </div>
              </Card>
              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">Otros clientes</p>
                    <p className="text-2xl font-bold">{clientes.filter(c => !isComunidad(c)).length}</p>
                  </div>
                  <div className="text-3xl">🏢</div>
                </div>
              </Card>
            </div>

            {/* Lista clienți */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  Clientes ({filteredClientes.length})
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-500">
                    📊 Muestra toda la información disponible del endpoint
                  </div>
                  <div className="text-xs text-gray-400">
                    💡 Haz clic en cualquier cliente para ver detalles
                  </div>
                  <div className="text-xs text-gray-400">
                    {filteredClientes.length} clientes
                    {filteredClientes.length > 10 && tableView === 'detailed' && ' (desplázate para más)'}
                    {filteredClientes.length > 12 && tableView === 'compact' && ' (desplázate para más)'}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setTableView('detailed')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        tableView === 'detailed'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      📋 Detallado
                    </button>
                    <button
                      onClick={() => setTableView('compact')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        tableView === 'compact'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      📊 Compacto
                    </button>
                    {/* Tab mapa eliminada */}
                  </div>
                </div>
              </div>
              
              {isOperationLoading('clientes') ? (
                <TableLoading 
                  columns={7} 
                  rows={5}
                  className="p-4"
                />
              ) : filteredClientes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">👥</div>
                  <p className="text-gray-600 font-medium">No hay clientes que coincidan con los criterios.</p>
                </div>
              ) : (
                <>
                  {tableView === 'detailed' ? (
                    <div className={`overflow-x-auto overflow-y-auto custom-scrollbar ${
                      filteredClientes.length > 10 ? 'max-h-96' : 'max-h-full'
                    }`}>
                  <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                              Nombre / NIF
                        </th>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                          Contacto
                        </th>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                              Dirección
                            </th>
                            <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                              Información
                        </th>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                              Contrato
                        </th>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                              💰 Límite Gasto
                        </th>
                        <th className={`px-6 ${density === 'compact' ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredClientes.map((cliente, index) => (
                            <tr 
                              key={index} 
                              className={`hover:bg-gray-50 group cursor-pointer transition-colors ${density === 'compact' ? 'text-[13px]' : ''}`}
                              onClick={() => handleViewDetails(cliente)}
                              title="Haz clic para ver detalles"
                            >
                              <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className={`text-sm font-medium text-gray-900 group-hover:text-red-600 transition-colors ${density === 'compact' ? 'truncate max-w-[280px]' : ''}`}>
                                    {cliente['NOMBRE O RAZON SOCIAL']}
                                  </div>
                                    {isComunidad(cliente) && (
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                        🏘️ Comunidad
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500">NIF: {cliente.NIF}</div>
                                  <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    📍 {cliente.LATITUD && cliente.LONGITUD ? `${cliente.LATITUD}, ${cliente.LONGITUD}` : 'Sin coordenadas'}
                                  </div>
                                </div>
                              </td>
                          <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                            <div>
                                  <div className="text-sm text-gray-900">
                                    📧 {cliente.EMAIL || 'N/D'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    📞 {cliente.TELEFONO || 'N/D'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    📱 {cliente.MOVIL || 'N/D'}
                                  </div>
                            </div>
                          </td>
                          <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                                <div>
                                  <div className="text-sm text-gray-900">{cliente.DIRECCION || 'N/D'}</div>
                                  <div className="text-sm text-gray-500">
                                    {cliente['CODIGO POSTAL']} {cliente.POBLACION}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {cliente.PROVINCIA}, {cliente.PAIS}
                                  </div>
                                </div>
                          </td>
                          <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                            <div>
                                  <div className="text-sm text-gray-900">
                                    🌐 {cliente.URL || 'N/D'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    💰 Discount: {cliente['DESCUENTO POR DEFECTO'] || '0.00'}%
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {cliente.LATITUD && cliente.LONGITUD ? (
                                      <a 
                                        href={getGoogleMapsLink(cliente.LATITUD, cliente.LONGITUD)} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-blue-600 hover:underline"
                                        title={`${cliente.LATITUD}, ${cliente.LONGITUD}`}
                                      >
                                        {cliente.LATITUD}, {cliente.LONGITUD}
                                      </a>
                                    ) : (
                                      <span>📍 N/D</span>
                                    )}
                                  </div>
                            </div>
                          </td>
                              <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                                <div>
                                  <div className="text-sm text-gray-900">
                                    📅 Última: {cliente['Fecha Ultima Renovacion'] ? 
                                      new Date(cliente['Fecha Ultima Renovacion']).toLocaleDateString('es-ES') : 
                                      'N/D'
                                    }
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    📅 Próxima: {cliente['Fecha Proxima Renovacion'] ? 
                                      new Date(cliente['Fecha Proxima Renovacion']).toLocaleDateString('es-ES') : 
                              'N/D'
                            }
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    💳 {cliente['CUENTAS BANCARIAS'] ? 'Cuenta bancaria' : 'N/D'}
                                  </div>
                                  {cliente['NOTAS PRIVADAS'] && (
                                    <div className="text-xs text-orange-600 cursor-help" title={cliente['NOTAS PRIVADAS']}>
                                      📝 Notas privadas
                                    </div>
                                  )}
                                </div>
                          </td>
                          <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                            <div>
                              <div className="text-sm text-gray-900">
                                💰 {cliente.CuantoPuedeGastar ? 
                                  `${parseFloat(cliente.CuantoPuedeGastar).toLocaleString('es-ES', { 
                                    style: 'currency', 
                                    currency: 'EUR' 
                                  })}` : 
                                  'N/D'
                                }
                              </div>
                              <div className="text-xs text-gray-500">
                                Límite de gasto
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 ${density === 'compact' ? 'py-2' : 'py-4'} whitespace-nowrap text-sm font-medium`}>
                            <div className="flex space-x-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(cliente);
                                }}
                                variant="outline"
                                size={density === 'compact' ? 'xs' : 'sm'}
                                className="bg-blue-50 hover:bg-blue-100"
                              >
                                👁️ Detalles
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormMode('edit');
                                  setEditItem(mapRowToForm(cliente, 'cliente'));
                                  setShowAddModal(true);
                                }}
                                variant="outline"
                                size={density === 'compact' ? 'xs' : 'sm'}
                                className="text-amber-600 hover:text-amber-700"
                              >
                                ✏️ Editar
                              </Button>
                              <Button
            onClick={(e) => {
                                  e.stopPropagation();
              if (confirm(`¿Eliminar cliente ${cliente['NOMBRE O RAZON SOCIAL']}?`)) {
                handleDeleteItem(cliente, 'cliente');
              }
                                }}
                                variant="outline"
                                size={density === 'compact' ? 'xs' : 'sm'}
                                className="text-red-600 hover:text-red-700"
                                title="Eliminar cliente"
                              >
                                🗑️ Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                                     ) : (
                     <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-y-auto custom-scrollbar ${
                       filteredClientes.length > 12 ? 'max-h-96' : 'max-h-full'
                     }`}>
                      {filteredClientes.map((cliente, index) => (
                        <div 
                          key={index} 
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-red-300"
                          onClick={() => handleViewDetails(cliente)}
                          title="Haz clic para ver detalles"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 text-sm hover:text-red-600 transition-colors">
                                  {cliente['NOMBRE O RAZON SOCIAL']}
                                </h4>
                                {isComunidad(cliente) && (
                                  <span className="inline-flex px-1 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                    🏘️
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">NIF: {cliente.NIF}</p>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(cliente);
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs bg-blue-50 hover:bg-blue-100"
                              >
                                👁️
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(cliente);
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs text-amber-600 hover:text-amber-700"
                              >
                                ✏️
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`¿Eliminar cliente ${cliente['NOMBRE O RAZON SOCIAL']}?`)) {
                                    console.warn('Delete cliente solicitado:', cliente.NIF);
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs text-red-600 hover:text-red-700"
                                title="Eliminar cliente"
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📧</span>
                              <span className="text-gray-700">{cliente.EMAIL || 'N/D'}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📞</span>
                              <span className="text-gray-700">{cliente.TELEFONO || cliente.MOVIL || 'N/D'}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📍</span>
                              <span className="text-gray-700">
                                {cliente.LATITUD && cliente.LONGITUD ? (
                                  <a 
                                    href={getGoogleMapsLink(cliente.LATITUD, cliente.LONGITUD)} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline"
                                    title={`${cliente.LATITUD}, ${cliente.LONGITUD}`}
                                  >
                                    {cliente.LATITUD}, {cliente.LONGITUD}
                                  </a>
                                ) : (
                                  cliente.POBLACION || 'N/D'
                                )}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">💰</span>
                              <span className="text-gray-700">Discount: {cliente['DESCUENTO POR DEFECTO'] || '0.00'}%</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">💳</span>
                              <span className="text-gray-700">
                                Límite: {cliente.CuantoPuedeGastar ? 
                                  `${parseFloat(cliente.CuantoPuedeGastar).toLocaleString('es-ES', { 
                                    style: 'currency', 
                                    currency: 'EUR' 
                                  })}` : 
                                  'N/D'
                                }
                              </span>
                            </div>
                            {cliente['NOTAS PRIVADAS'] && (
                              <div className="flex items-center">
                                <span className="text-orange-400 mr-2">📝</span>
                                <span className="text-orange-600 cursor-help" title={cliente['NOTAS PRIVADAS']}>
                                  Notas privadas
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Contenido para Proveedores */}
        {activeTab === 'proveedores' && (
          <div>
            {errorProveedores && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-red-600 text-2xl">❌</span>
                  <div>
                    <p className="text-red-800 font-medium">{errorProveedores}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Filtros proveedores */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-0 mb-8 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-fuchsia-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-purple-600">🎯</span>
                  <span className="text-sm font-semibold text-gray-800">Filtros</span>
                  <span className="text-xs text-gray-500">Proveedores</span>
                </div>
                <button
                  onClick={() => setShowFiltersProveedores(v => !v)}
                  className="text-xs px-2 py-1 rounded-lg border border-purple-200 text-purple-600 bg-white hover:bg-purple-50 transition"
                >
                  {showFiltersProveedores ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showFiltersProveedores && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-2">🔎 Buscar proveedores</label>
                      <Input
                        type="text"
                        placeholder="Nombre, NIF, email..."
                        value={searchTermProveedores}
                        onChange={(e) => setSearchTermProveedores(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-2">⚙️ Estado</label>
                      <select
                        value={selectedActivoProveedores}
                        onChange={(e) => setSelectedActivoProveedores(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="todos">Todos</option>
                        <option value="activo">Activos</option>
                        <option value="inactivo">Inactivos</option>
                      </select>
                    </div>
                    <div className="w-full flex items-end">
                      <Button
                        onClick={fetchProveedores}
                        variant="outline"
                        className="w-full"
                        loading={isOperationLoading('proveedores')}
                        disabled={isOperationLoading('proveedores')}
                      >
                        {isOperationLoading('proveedores') ? 'Cargando...' : '🔄 Actualizar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Estadísticas proveedores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Total Proveedores</p>
                    <p className="text-2xl font-bold">{proveedores.length}</p>
                  </div>
                  <div className="text-3xl">🏢</div>
                </div>
              </Card>
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Activos</p>
                    <p className="text-2xl font-bold">{proveedores.length}</p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </Card>
            </div>

            {/* Lista proveedores */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  Proveedores ({filteredProveedores.length})
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setTableView('detailed')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        tableView === 'detailed'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      📋 Detallado
                    </button>
                    <button
                      onClick={() => setTableView('compact')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        tableView === 'compact'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🃏 Compacto
                    </button>
                    {/* Tab mapa eliminada */}
                </div>
                <div className="text-xs text-gray-400">
                  💡 Haz clic en cualquier proveedor para ver detalles
                </div>
                </div>
              </div>
              
            {isOperationLoading('proveedores') ? (
                <TableLoading 
                  columns={6} 
                  rows={5}
                  className="p-4"
                />
              ) : filteredProveedores.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🏢</div>
                  <p className="text-gray-600 font-medium">No hay proveedores que coincidan con los criterios.</p>
                </div>
              ) : (
                <>
                  {tableView === 'detailed' ? (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                  <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Proveedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Contacto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Dirección
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Web y Descuento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Coordenadas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredProveedores.map((proveedor, index) => (
                            <tr 
                              key={index} 
                              className="hover:bg-gray-50 group cursor-pointer transition-colors"
                              onClick={() => handleViewDetails(proveedor)}
                              title="Haz clic para ver detalles"
                            >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                                  <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                                          {proveedor['NOMBRE O RAZÓN SOCIAL']}
                            </div>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                          🏢 Proveedor
                            </span>
                                      </div>
                                      <div className="text-sm text-gray-500">NIF: {proveedor.NIF}</div>
                                      <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        📍 {proveedor.LATITUD && proveedor.LONGITUD ? `${proveedor.LATITUD}, ${proveedor.LONGITUD}` : 'Sin coordenadas'}
                                      </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm text-gray-900">{proveedor.EMAIL || 'N/D'}</div>
                                  <div className="text-sm text-gray-500">{proveedor.TELEFONO || 'N/D'}</div>
                                  {proveedor.MÓVIL && (
                                    <div className="text-xs text-gray-400">Mobil: {proveedor.MÓVIL}</div>
                                  )}
                                </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                                  <div className="text-sm text-gray-900">{proveedor.DIRECCIÓN || 'N/D'}</div>
                                  <div className="text-sm text-gray-500">
                                    {proveedor.CODIGO_POSTAL} {proveedor.POBLACIÓN}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {proveedor.PROVINCIA}, {proveedor.PAÍS}
                                  </div>
                            </div>
                          </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm text-gray-900">
                                    {proveedor.URL ? (
                                      <a href={`https://${proveedor.URL.split(';')[0]}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {proveedor.URL.split(';')[0]}
                                      </a>
                                    ) : 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Discount: {proveedor['DESCUENTO POR DEFECTO']}%
                                  </div>
                                  {proveedor.NOTAS_PRIVADAS && (
                                    <div className="text-xs text-orange-600">📝 {proveedor.NOTAS_PRIVADAS}</div>
                                  )}
                                </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  {proveedor.LATITUD && proveedor.LONGITUD ? (
                                    <div>
                                      <div className="text-sm text-gray-900">
                                        📍 {proveedor.LATITUD}, {proveedor.LONGITUD}
                                      </div>
                                      <a 
                                        href={`https://www.google.com/maps?q=${proveedor.LATITUD},${proveedor.LONGITUD}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline"
                                      >
                                        Ver en mapa
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-400">Sin coordenadas</div>
                                  )}
                                </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(proveedor);
                                }}
                                variant="outline"
                                size="sm"
                                className="bg-purple-50 hover:bg-purple-100"
                              >
                                👁️ Detalles
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormMode('edit');
                                  setEditItem(mapRowToForm(proveedor, 'proveedor'));
                                  setShowAddModal(true);
                                }}
                                variant="outline"
                                size="sm"
                                className="text-amber-600 hover:text-amber-700"
                              >
                                ✏️ Editar
                              </Button>
                                   <Button
                                   onClick={(e) => {
                                       e.stopPropagation();
                                     if (confirm(`¿Eliminar proveedor ${proveedor['NOMBRE O RAZÓN SOCIAL']}?`)) {
                                       handleDeleteItem(proveedor, 'proveedor');
                                     }
                                     }}
                                     variant="outline"
                                     size="sm"
                                     className="text-red-600 hover:text-red-700"
                                     title="Eliminar proveedor"
                                   >
                                     🗑️ Eliminar
                                   </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-y-auto custom-scrollbar ${
                      filteredProveedores.length > 12 ? 'max-h-96' : 'max-h-full'
                    }`}>
                      {filteredProveedores.map((proveedor, index) => (
                        <div 
                          key={index} 
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-purple-300"
                          onClick={() => handleViewDetails(proveedor)}
                          title="Haz clic para ver detalles"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 text-sm hover:text-purple-600 transition-colors">
                                  {proveedor['NOMBRE O RAZÓN SOCIAL']}
                                </h4>
                                <span className="inline-flex px-1 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                  🏢
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">NIF: {proveedor.NIF}</p>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(proveedor);
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs bg-purple-50 hover:bg-purple-100"
                              >
                                👁️
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📧</span>
                              <span className="text-gray-700">{proveedor.EMAIL || 'N/D'}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📞</span>
                              <span className="text-gray-700">{proveedor.TELEFONO || proveedor.MÓVIL || 'N/D'}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">📍</span>
                              <span className="text-gray-700">
                                {proveedor.LATITUD && proveedor.LONGITUD ? (
                                  <a 
                                    href={`https://www.google.com/maps?q=${proveedor.LATITUD},${proveedor.LONGITUD}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline"
                                    title={`${proveedor.LATITUD}, ${proveedor.LONGITUD}`}
                                  >
                                    {proveedor.LATITUD}, {proveedor.LONGITUD}
                                  </a>
                                ) : (
                                  proveedor.POBLACIÓN || 'N/D'
                                )}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">💰</span>
                              <span className="text-gray-700">Discount: {proveedor['DESCUENTO POR DEFECTO'] || '0.00'}%</span>
                            </div>
                            {proveedor.NOTAS_PRIVADAS && (
                              <div className="flex items-center">
                                <span className="text-orange-400 mr-2">📝</span>
                                <span className="text-orange-600 cursor-help" title={proveedor.NOTAS_PRIVADAS}>
                                  Notas privadas
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal añadir ítem */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`${formMode === 'add' ? 'Añadir' : 'Editar'} ${activeTab === 'clientes' ? 'Cliente' : 'Proveedor'}`}
      >
        <ClienteForm
          cliente={formMode === 'edit' ? editItem : null}
          onSubmit={formMode === 'add' ? handleAddItem : handleEditItem}
          onCancel={() => setShowAddModal(false)}
          tipo={activeTab === 'clientes' ? 'cliente' : 'proveedor'}
        />
      </Modal>

    </div>
  );
} 