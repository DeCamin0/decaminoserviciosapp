import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import activityLogger from '../utils/activityLogger';
import { Button, Modal, PageHeader, SegmentedControl, AlertBanner } from '../components/ui';
import Notification from '../components/ui/Notification';
import {
  ClientesFiltersPanel,
  ClientesListSection,
  ClientesStatsStrip,
  isComunidadCliente,
} from '../components/clientes';
import { MessageCircleWarning, Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import ClienteForm from '../components/clientes/ClienteForm';
import { routes } from '../utils/routes';
import { useLoadingState } from '../hooks/useLoadingState';
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
  
  // Estado comÃºn
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editItem, setEditItem] = useState(null);

  // Endpoint selector: clientes -> backend, proveedores -> backend
  const getCrudEndpoint = (tipo) => {
    if ((tipo || '').toLowerCase() === 'proveedor' || (tipo || '').toLowerCase() === 'proveedores') {
      // Furnizori: folosim backend-ul nou
      return routes.crudProveedor;
    }
    // ClienÈ›i: folosim backend-ul nou
    return routes.crudCliente;
  };
  const [tableView, setTableView] = useState('detailed'); // 'detailed' | 'compact'
  const [notif, setNotif] = useState({ open: false, type: 'success', title: '', message: '' });

  const isComunidad = isComunidadCliente;

  // Datos demo de clientes
  const setDemoClientes = () => {
    const demoClientes = [
      {
        'NOMBRE O RAZON SOCIAL': 'C.P. Residencia Los Pinos',
        'DIRECCION': 'Calle Los Pinos, 15, 28001 Madrid',
        'TELEFONO': '+34 91 123 4567',
        'EMAIL': 'admin@lospinos.com',
        'CONTACTO': 'MarÃ­a GonzÃ¡lez',
        'ACTIVO': 'SÃ­',
        'TIPO': 'Comunidad',
        'SERVICIOS': 'Limpieza, JardinerÃ­a',
        'VALOR CONTRATO': '2.500,00â‚¬',
        'LATITUD': '40.4168',
        'LONGITUD': '-3.7038'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Hospital Universitario San Carlos',
        'DIRECCION': 'Calle Profesor MartÃ­n Lagos, s/n, 28040 Madrid',
        'TELEFONO': '+34 91 330 3000',
        'EMAIL': 'servicios@hospital.com',
        'CONTACTO': 'Dr. Carlos RodrÃ­guez',
        'ACTIVO': 'SÃ­',
        'TIPO': 'Centro Sanitario',
        'SERVICIOS': 'Limpieza quirÃ³fanos, Limpieza general',
        'VALOR CONTRATO': '15.000,00â‚¬',
        'LATITUD': '40.4395',
        'LONGITUD': '-3.7226'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Centro Comercial Plaza Norte',
        'DIRECCION': 'Avenida de la Gran VÃ­a, 85, 28003 Madrid',
        'TELEFONO': '+34 91 555 7777',
        'EMAIL': 'servicios@plazanorte.com',
        'CONTACTO': 'Ana MartÃ­nez',
        'ACTIVO': 'SÃ­',
        'TIPO': 'Centro Comercial',
        'SERVICIOS': 'Limpieza, Seguridad, Mantenimiento',
        'VALOR CONTRATO': '8.500,00â‚¬',
        'LATITUD': '40.4656',
        'LONGITUD': '-3.6969'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Colegio Privado San AgustÃ­n',
        'DIRECCION': 'Calle San AgustÃ­n, 25, 28014 Madrid',
        'TELEFONO': '+34 91 444 8888',
        'EMAIL': 'administracion@sanagustin.edu',
        'CONTACTO': 'Padre Miguel Ãngel',
        'ACTIVO': 'SÃ­',
        'TIPO': 'EducaciÃ³n',
        'SERVICIOS': 'Limpieza, ConserjerÃ­a',
        'VALOR CONTRATO': '3.200,00â‚¬',
        'LATITUD': '40.4168',
        'LONGITUD': '-3.7038'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Oficinas Corporativas TechCorp',
        'DIRECCION': 'Paseo de la Castellana, 200, 28046 Madrid',
        'TELEFONO': '+34 91 777 9999',
        'EMAIL': 'facilities@techcorp.com',
        'CONTACTO': 'Isabel FernÃ¡ndez',
        'ACTIVO': 'SÃ­',
        'TIPO': 'Oficinas',
        'SERVICIOS': 'Limpieza, RecepciÃ³n',
        'VALOR CONTRATO': '5.800,00â‚¬',
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
        'ACTIVO': 'SÃ­',
        'TIPO': 'Proveedor',
        'SERVICIOS': 'Productos limpieza, Equipos',
        'VALOR CONTRATO': '1.200,00â‚¬'
      },
      {
        'NOMBRE O RAZON SOCIAL': 'Seguridad Total Madrid',
        'DIRECCION': 'Avenida de AmÃ©rica, 100, 28028 Madrid',
        'TELEFONO': '+34 91 333 4444',
        'EMAIL': 'contacto@seguridadtotal.com',
        'CONTACTO': 'Carmen LÃ³pez',
        'ACTIVO': 'SÃ­',
        'TIPO': 'Proveedor',
        'SERVICIOS': 'Vigilancia, Alarmas',
        'VALOR CONTRATO': '4.500,00â‚¬'
      }
    ];

    setClientes(demoClientes);
    setProveedores(demoProveedores);
  };

  // FuncÈ›ie pentru a normaliza coordonatele È™i a crea link Google Maps
  const fetchClientes = useCallback(async () => {
    // Saltar fetch real en modo DEMO
    if (authUser?.isDemo) {
      console.log('ðŸŽ­ DEMO mode: Skipping fetchClientes in ClientesPage');
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
      
      // Debug: verificÄƒ coordonatele GPS
      console.log('ðŸ” Total clientes:', soloClientes.length);
      const clientesConCoords = soloClientes.filter(c => c.LATITUD && c.LONGITUD);
      console.log('ðŸ“ Clientes con coordenadas GPS:', clientesConCoords.length);
      console.log('ðŸ—ºï¸ Clientes sin coordenadas:', soloClientes.length - clientesConCoords.length);
      
      // Debug: aratÄƒ primii 3 clienÈ›i cu coordonate
      if (clientesConCoords.length > 0) {
        console.log('ðŸ“ Primeros 3 clientes con coordenadas:', clientesConCoords.slice(0, 3).map(c => ({
          nombre: c['NOMBRE O RAZON SOCIAL'],
          lat: c.LATITUD,
          lng: c.LONGITUD
        })));
      }
      
      setClientes(soloClientes);
      
      // Log acceso a pÃ¡gina
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
      console.log('ðŸŽ­ DEMO mode: Skipping fetchProveedores in ClientesPage');
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
      console.log('ðŸŽ­ DEMO mode: Using demo clientes data instead of fetching from backend');
      setDemoClientes();
      setOperationLoading('clientes', false);
      setOperationLoading('proveedores', false);
      return;
    }

    fetchClientes();
    fetchProveedores();
  }, [authUser?.isDemo, fetchClientes, fetchProveedores, setOperationLoading]);

  // Filtro clientes (memoizat pentru performanÈ›Äƒ)
  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const matchesSearch = cliente['NOMBRE O RAZON SOCIAL']?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.NIF?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.EMAIL?.toLowerCase().includes(searchTermClientes.toLowerCase()) ||
                           cliente.POBLACION?.toLowerCase().includes(searchTermClientes.toLowerCase());
      
      // Pentru moment, toÈ›i clienÈ›ii sunt consideraÈ›i activi
      const matchesActivo = selectedActivoClientes === 'todos' || 
                           (selectedActivoClientes === 'activo' && true) ||
                           (selectedActivoClientes === 'inactivo' && false);
      
      return matchesSearch && matchesActivo;
    });
  }, [clientes, searchTermClientes, selectedActivoClientes]);

  // Filtro proveedores (memoizat pentru performanÈ›Äƒ)
  const filteredProveedores = useMemo(() => {
    return proveedores.filter(proveedor => {
      const matchesSearch = proveedor['NOMBRE O RAZÓN SOCIAL']?.toLowerCase().includes(searchTermProveedores.toLowerCase()) ||
                           proveedor.NIF?.toLowerCase().includes(searchTermProveedores.toLowerCase()) ||
                           proveedor.EMAIL?.toLowerCase().includes(searchTermProveedores.toLowerCase());
      
      // Pentru moment, toÈ›i furnizorii sunt consideraÈ›i activi
      const matchesActivo = selectedActivoProveedores === 'todos' || 
                           (selectedActivoProveedores === 'activo' && true) ||
                           (selectedActivoProveedores === 'inactivo' && false);
      
      return matchesSearch && matchesActivo;
    });
  }, [proveedores, searchTermProveedores, selectedActivoProveedores]);

  const handleAddItem = async (itemData) => {
    try {
      // Mapear a claves esperadas por backend (enviar TODO, incluso vacÃ­o)
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
      console.log('ðŸ“ Adding item to:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(backendPayload)
      });
      
      const rawText = await response.text();
      let json;
      try { json = JSON.parse(rawText); } catch { json = null; }

      if (response.ok) {
        // Log crear Ã­tem
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
          title: 'OperaciÃ³n exitosa',
          message: (json && (json.mensaje || json.message)) || `${activeTab === 'clientes' ? 'Cliente' : 'Proveedor'} aÃ±adido con Ã©xito!`
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
      console.log('ðŸ“ Editing item at:', endpoint);
      
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
        setNotif({ open: true, type: 'success', title: 'OperaciÃ³n exitosa', message: `${activeTab === 'clientes' ? 'Cliente' : 'Proveedor'} actualizado con Ã©xito!` });
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
      console.log('ðŸ—‘ï¸ Deleting item at:', endpoint);
      
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
    movil: row.MOVIL || row['MÓVIL'] || '',
    fax: row.FAX || '',
    email: row.EMAIL || '',
    direccion: row.DIRECCION || row['DIRECCIÓN'] || '',
    cp: row['CODIGO POSTAL'] || '',
    ciudad: row.POBLACION || row['POBLACIÓN'] || '',
    provincia: row.PROVINCIA || '',
    pais: row.PAIS || row['PAÍS'] || 'España',
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
    
    // Navegar a la pÃ¡gina de detalles segÃºn el tipo
    if (activeTab === 'clientes') {
    navigate(`/clientes/${item.NIF}`);
    } else {
      navigate(`/proveedores/${item.NIF}`);
    }
  };

  const openAddModal = () => {
    setFormMode('add');
    setEditItem(null);
    setShowAddModal(true);
  };

  const openEditModal = (row) => {
    setFormMode('edit');
    setEditItem(mapRowToForm(row, activeTab === 'clientes' ? 'cliente' : 'proveedor'));
    setShowAddModal(true);
  };

  const confirmDelete = (row, tipo) => {
    const nombre = row['NOMBRE O RAZON SOCIAL'] || row['NOMBRE O RAZÓN SOCIAL'] || row.NIF;
    if (window.confirm(`¿Eliminar ${tipo === 'cliente' ? 'cliente' : 'proveedor'} ${nombre}?`)) {
      handleDeleteItem(row, tipo);
    }
  };

  const tabItems = [
    { id: 'clientes', label: `Clientes (${clientes.length})`, shortLabel: `Cli. (${clientes.length})` },
    { id: 'proveedores', label: `Proveedores (${proveedores.length})`, shortLabel: `Prov. (${proveedores.length})` },
  ];

  // Loading state pentru pagina Ã®ntreagÄƒ
  if (isOperationLoading('clientes') && isOperationLoading('proveedores')) {
    return (
      <div className="clientes-page app-page">
        <div className="clientes-state clientes-state--page">
          <div className="clientes-state__spinner" aria-hidden />
          <p className="clientes-state__title">Cargando clientes y proveedoresâ€¦</p>
        </div>
      </div>
    );
  }

  return (
    <div className="clientes-page app-page">
      {notif.open && (
        <Notification
          type={notif.type}
          title={notif.title}
          message={notif.message}
          duration={5000}
          onClose={() => setNotif((prev) => ({ ...prev, open: false }))}
          show
        />
      )}

      <PageHeader
        title="Clientes y proveedores"
        subtitle="Administración de clientes y proveedores"
        backTo="/inicio"
        backTitle="Volver al inicio"
        actions={(
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
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
                  pageName: activeTab === 'clientes' ? 'Clientes' : 'Proveedores',
                  pageData,
                });
                openWhatsAppErrorReport(message);
              }}
            >
              <MessageCircleWarning className="w-4 h-4" aria-hidden />
              <span>Reportar error</span>
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={openAddModal}>
              <Plus className="w-4 h-4" aria-hidden />
              <span>
                Añadir
                {' '}
                {activeTab === 'clientes' ? 'cliente' : 'proveedor'}
              </span>
            </Button>
          </>
        )}
      />

      <SegmentedControl
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        className="clientes-page__tabs"
      />

      <div className="clientes-page__toolbar">
        <div className="clientes-density">
          <span className="clientes-density__label">Densidad</span>
          <SegmentedControl
            items={[
              { id: 'comfortable', label: 'Comfort', shortLabel: 'Comf.' },
              { id: 'compact', label: 'Compact', shortLabel: 'Comp.' },
            ]}
            value={density}
            onChange={setDensity}
          />
        </div>
      </div>

      <div className="clientes-page__content">
        {activeTab === 'clientes' && (
          <>
            {errorClientes ? (
              <AlertBanner variant="danger" title="Error al cargar clientes">
                {errorClientes}
              </AlertBanner>
            ) : null}

            <ClientesFiltersPanel
              variant="clientes"
              searchTerm={searchTermClientes}
              onSearchChange={setSearchTermClientes}
              selectedActivo={selectedActivoClientes}
              onActivoChange={setSelectedActivoClientes}
              onRefresh={fetchClientes}
              loading={isOperationLoading('clientes')}
              resultCount={filteredClientes.length}
              collapsed={!showFiltersClientes}
              onToggleCollapsed={() => setShowFiltersClientes((v) => !v)}
            />

            <ClientesStatsStrip
              variant="clientes"
              total={clientes.length}
              activos={clientes.length}
              comunidades={clientes.filter(isComunidad).length}
              otros={clientes.filter((c) => !isComunidad(c)).length}
            />

            <ClientesListSection
              variant="clientes"
              rows={filteredClientes}
              loading={isOperationLoading('clientes')}
              tableView={tableView}
              onTableViewChange={setTableView}
              density={density}
              onViewDetails={handleViewDetails}
              onEdit={(row) => openEditModal(row)}
              onDelete={(row) => confirmDelete(row, 'cliente')}
            />
          </>
        )}

        {activeTab === 'proveedores' && (
          <>
            {errorProveedores ? (
              <AlertBanner variant="danger" title="Error al cargar proveedores">
                {errorProveedores}
              </AlertBanner>
            ) : null}

            <ClientesFiltersPanel
              variant="proveedores"
              searchTerm={searchTermProveedores}
              onSearchChange={setSearchTermProveedores}
              selectedActivo={selectedActivoProveedores}
              onActivoChange={setSelectedActivoProveedores}
              onRefresh={fetchProveedores}
              loading={isOperationLoading('proveedores')}
              resultCount={filteredProveedores.length}
              collapsed={!showFiltersProveedores}
              onToggleCollapsed={() => setShowFiltersProveedores((v) => !v)}
            />

            <ClientesStatsStrip
              variant="proveedores"
              total={proveedores.length}
              activos={proveedores.length}
            />

            <ClientesListSection
              variant="proveedores"
              rows={filteredProveedores}
              loading={isOperationLoading('proveedores')}
              tableView={tableView}
              onTableViewChange={setTableView}
              density={density}
              onViewDetails={handleViewDetails}
              onEdit={(row) => openEditModal(row)}
              onDelete={(row) => confirmDelete(row, 'proveedor')}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`${formMode === 'add' ? 'Añadir' : 'Editar'} ${activeTab === 'clientes' ? 'cliente' : 'proveedor'}`}
        className="app-modal--form clientes-form-modal"
        size="lg"
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
