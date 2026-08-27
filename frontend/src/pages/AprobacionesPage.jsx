import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { PageHeader, AlertBanner, SegmentedControl, Modal, Notification } from '../components/ui';
import { RefreshCw, Check, X, Eye, MessageCircleWarning } from 'lucide-react';
import { API_ENDPOINTS } from '../utils/constants';
import { useAdminApi } from '../hooks/useAdminApi';
import activityLogger from '../utils/activityLogger';
import { routes } from '../utils/routes';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';

const REGULARIZACION_REASON_LABELS = {
  employee_confirmed_no_extra: 'Empleado confirmó: No trabajó de más',
  employee_confirmed_punch_error: 'Empleado confirmó: Error de fichaje',
  employee_confirmed_worked_less: 'Empleado confirmó: Trabajó de menos',
  employee_declares_extra: 'Empleado declara: Trabajó de más',
  employee_declares_less: 'Empleado declara: Trabajó de menos',
  AUSENCIA_INJUSTIFICADA: 'Ausencia injustificada',
  OLVIDO_FICHAR: 'Olvidó fichar',
  OTRO: 'Otro motivo',
};

const getRegularizacionReasonLabel = (code) => REGULARIZACION_REASON_LABELS[code] || code || '';


export default function AprobacionesPage() {
  const { user: authUser } = useAuth();
  const { getPermissions } = useAdminApi();
  
  // State pentru tab-uri
  const [activeTab, setActiveTab] = useState('cambios'); // 'cambios' sau 'regularizaciones'
  
  // State pentru cambios de datos
  const [pendingCambios, setPendingCambios] = useState([]);
  const [loadingCambios, setLoadingCambios] = useState(true);
  const [errorCambios, setErrorCambios] = useState('');
  
  // State pentru regularizaciones de fichajes
  const [activeRegularizacionSubtab, setActiveRegularizacionSubtab] = useState('pending'); // 'pending' sau 'confirmed'
  const [pendingRegularizaciones, setPendingRegularizaciones] = useState([]);
  const [loadingRegularizaciones, setLoadingRegularizaciones] = useState(true);
  const [errorRegularizaciones, setErrorRegularizaciones] = useState('');
  const [confirmedRegularizaciones, setConfirmedRegularizaciones] = useState([]);
  const [loadingConfirmedRegularizaciones, setLoadingConfirmedRegularizaciones] = useState(true);
  const [errorConfirmedRegularizaciones, setErrorConfirmedRegularizaciones] = useState('');
  const [regularizacionToReject, setRegularizacionToReject] = useState(null);
  const [rejectRegularizacionReason, setRejectRegularizacionReason] = useState('');
  const [createAusenciaOnReject, setCreateAusenciaOnReject] = useState(false);
  const [showRejectRegularizacionModal, setShowRejectRegularizacionModal] = useState(false);
  const [showApproveRegularizacionModal, setShowApproveRegularizacionModal] = useState(false);
  const [regularizacionToApprove, setRegularizacionToApprove] = useState(null);
  
  // State pentru permisiuni
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  
  // State comun
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  
  // State pentru modal de respingere
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cambioToReject, setCambioToReject] = useState(null);
  
  // State pentru modal de confirmare aprobare
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [cambioToApprove, setCambioToApprove] = useState(null);
  
  // State pentru notificări
  const [notification, setNotification] = useState(null);
  
  // State pentru checkbox-uri "enviar a gestoria" pentru fiecare cambio
  const [enviarAGestoriaMap, setEnviarAGestoriaMap] = useState({});

  // State pentru lista de angajați (pentru a afișa numele lângă cod)
  const [empleados, setEmpleados] = useState([]);

  const userGrupo = useMemo(() => authUser?.GRUPO || authUser?.grupo || 'Empleado', [authUser?.GRUPO, authUser?.grupo]);
  
  // Funcție helper pentru a găsi cheia corectă pentru grup în permisiuni
  const findGrupoKey = useCallback((grupo, permissions) => {
    if (!grupo || !permissions) return null;
    
    // Caută exact match
    if (permissions[grupo]) return grupo;
    
    // Caută case-insensitive
    const normalizedGrupo = grupo.toLowerCase();
    for (const key of Object.keys(permissions)) {
      if (key.toLowerCase() === normalizedGrupo) {
        return key;
      }
    }
    
    return null;
  }, []);

  // Funcție helper pentru a verifica permisiunile din backend
  const hasPermission = useCallback((module) => {
    if (!userPermissions || !userGrupo) {
      return false;
    }
    
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) {
      return false;
    }
    
    const grupoPermissions = userPermissions[grupoKey];
    if (!grupoPermissions) {
      return false;
    }
    
    return grupoPermissions[module] === true;
  }, [userPermissions, userGrupo, findGrupoKey]);

  // Încarcă permisiunile din backend
  useEffect(() => {
    const loadPermissions = async () => {
      if (!userGrupo || authUser?.isDemo) {
        setLoadingPermissions(false);
        return;
      }

      setLoadingPermissions(true);
      try {
        const permissions = await getPermissions(userGrupo);
        setUserPermissions(permissions);
      } catch (error) {
        console.error('❌ AprobacionesPage: Error loading permissions:', error);
        setUserPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [userGrupo, authUser?.isDemo, getPermissions]);

  // Verifică dacă utilizatorul are permisiunea de acces - folosim DOAR permisiunile din backend (fără fallback)
  const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
  const canAccess = useMemo(() => {
    // Dacă permisiunile sunt încă încărcare, așteaptă
    if (loadingPermissions) {
      return null; // null = încă verificăm
    }
    
    // Folosim DOAR permisiunile din backend - fără fallback la isManager
    if (hasBackendPermissions) {
      const grupoKey = findGrupoKey(userGrupo, userPermissions);
      if (grupoKey) {
        return hasPermission('aprobaciones');
      }
    }
    
    // Dacă nu există permisiuni în backend, nu permitem accesul
    return false;
  }, [loadingPermissions, userPermissions, userGrupo, findGrupoKey, hasPermission, hasBackendPermissions]);

  // Demo data for AprobacionesPage
  const setDemoAprobaciones = () => {
    const demoCambios = [
      {
        id: 'DEMO_CAMBIO_001',
        codigo: 'EMP005',
        CODIGO: 'EMP005',
        nombre: 'Pedro Martínez García',
        NOMBRE: 'Pedro Martínez García',
        email: 'pedro.martinez@demo.com',
        CORREO_ELECTRONICO: 'pedro.martinez@demo.com',
        CAMPO_MODIFICADO: 'telefono',
        campo_modificado: 'telefono',
        VALOR_ANTERIOR: '+34 600 567 890',
        valor_anterior: '+34 600 567 890',
        VALOR_NUEVO: '+34 600 999 888',
        valor_nuevo: '+34 600 999 888',
        RAZON: 'Cambio de número de teléfono',
        razon: 'Cambio de número de teléfono',
        ESTADO: 'pendiente',
        estado: 'pendiente',
        FECHA_SOLICITUD: '2024-11-28T14:20:00Z',
        fecha_solicitud: '2024-11-28T14:20:00Z'
      },
      {
        id: 'DEMO_CAMBIO_002',
        codigo: 'EMP006',
        CODIGO: 'EMP006',
        nombre: 'Laura Fernández Torres',
        NOMBRE: 'Laura Fernández Torres',
        email: 'laura.fernandez@demo.com',
        CORREO_ELECTRONICO: 'laura.fernandez@demo.com',
        CAMPO_MODIFICADO: 'direccion',
        campo_modificado: 'direccion',
        VALOR_ANTERIOR: 'Calle Anterior, 123, Madrid',
        valor_anterior: 'Calle Anterior, 123, Madrid',
        VALOR_NUEVO: 'Calle Nueva, 456, Madrid',
        valor_nuevo: 'Calle Nueva, 456, Madrid',
        RAZON: 'Cambio de domicilio',
        razon: 'Cambio de domicilio',
        ESTADO: 'pendiente',
        estado: 'pendiente',
        FECHA_SOLICITUD: '2024-11-27T10:15:00Z',
        fecha_solicitud: '2024-11-27T10:15:00Z'
      }
    ];

    setPendingCambios(demoCambios);
    setLoadingCambios(false);
  };

  const fetchPendingCambios = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchPendingCambios in AprobacionesPage');
      return;
    }

    setLoadingCambios(true);
    setErrorCambios('');
    try {
      const url = API_ENDPOINTS.GET_CAMBIOS_PENDIENTES;
      console.log('[Aprobaciones] Fetching cambios from:', url);
      
      // Adaugă JWT token pentru backend
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log('[Aprobaciones] Raw response text:', text);
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.warn('[Aprobaciones] Failed to parse JSON, setting empty list. Error:', e);
        data = null;
      }
      console.log('[Aprobaciones] Parsed data type:', typeof data, 'isArray:', Array.isArray(data));
      
      // Verifică dacă este răspuns "not-modified" - păstrează lista existentă
      if (data && typeof data === 'object' && data.status === 'not-modified') {
        console.log('[Aprobaciones] Response is "not-modified", keeping existing list');
        return; // Nu schimba lista, păstrează cea existentă
      }
      
      if (Array.isArray(data)) console.log('[Aprobaciones] First item sample:', data[0]);
      
      if (data && typeof data === 'object') {
        const rawArray = Array.isArray(data) ? data : [data];
        const cambiosArray = (rawArray || []).filter(item => {
          if (!item || typeof item !== 'object') return false;
          const keys = Object.keys(item || {});
          if (keys.length === 0) return false;
          const hasUseful = item.NOMBRE || item.nombre || item.CAMPO_MODIFICADO || item.campo || item.VALOR_NUEVO || item.valoare_noua || item.CORREO_ELECTRONICO || item.email;
          return Boolean(hasUseful);
        });
        console.log('[Aprobaciones] Filtered cambios length:', cambiosArray.length);
        setPendingCambios(cambiosArray);
      } else {
        console.log('[Aprobaciones] No valid data received, setting empty list');
        setPendingCambios([]);
      }
    } catch (error) {
      console.error('Error fetching pending cambios:', error);
      setErrorCambios('Error al cargar las modificaciones pendientes.');
      setPendingCambios([]);
    } finally {
      setLoadingCambios(false);
    }
  }, [authUser?.isDemo]);

  // Funcție pentru fetch regularizări pending
  const fetchPendingRegularizaciones = useCallback(async () => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchPendingRegularizaciones');
      return;
    }

    setLoadingRegularizaciones(true);
    setErrorRegularizaciones('');
    try {
      const url = routes.getRegularizacionesPendientes;
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Aprobaciones] Regularizaciones pending data:', data);
      
      if (data.success && Array.isArray(data.pendientes)) {
        setPendingRegularizaciones(data.pendientes);
      } else {
        setPendingRegularizaciones([]);
      }
    } catch (error) {
      console.error('Error fetching pending regularizaciones:', error);
      setErrorRegularizaciones('Error al cargar las regularizaciones pendientes.');
      setPendingRegularizaciones([]);
    } finally {
      setLoadingRegularizaciones(false);
    }
  }, [authUser?.isDemo]);

  // Funcție pentru fetch regularizări confirmed
  const fetchConfirmedRegularizaciones = useCallback(async () => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchConfirmedRegularizaciones');
      return;
    }

    setLoadingConfirmedRegularizaciones(true);
    setErrorConfirmedRegularizaciones('');
    try {
      const url = routes.getRegularizacionesConfirmed;
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Aprobaciones] Regularizaciones confirmed data:', data);
      
      if (data.success && Array.isArray(data.regularizaciones)) {
        setConfirmedRegularizaciones(data.regularizaciones);
      } else {
        setConfirmedRegularizaciones([]);
      }
    } catch (error) {
      console.error('Error fetching confirmed regularizaciones:', error);
      setErrorConfirmedRegularizaciones('Error al cargar las regularizaciones confirmadas.');
      setConfirmedRegularizaciones([]);
    } finally {
      setLoadingConfirmedRegularizaciones(false);
    }
  }, [authUser?.isDemo]);

  // Funcție pentru fetch lista de angajați
  const fetchEmpleados = useCallback(async () => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchEmpleados');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getEmpleados, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const empleadosList = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
      setEmpleados(empleadosList);
    } catch (error) {
      console.error('Error fetching empleados:', error);
      setEmpleados([]);
    }
  }, [authUser?.isDemo]);

  // Funcție helper pentru a găsi numele angajatului după cod
  const getEmpleadoNombre = useCallback((codigo) => {
    if (!codigo || !empleados.length) return null;
    
    const empleado = empleados.find(emp => {
      const empCodigo = emp.CODIGO || emp.codigo;
      return empCodigo && empCodigo.toString() === codigo.toString();
    });
    
    if (empleado) {
      return empleado['NOMBRE / APELLIDOS'] || empleado.nombre || empleado.NOMBRE || null;
    }
    
    return null;
  }, [empleados]);

  useEffect(() => {
    // Așteaptă până când permisiunile sunt verificate
    if (canAccess === null) {
      return;
    }

    if (!canAccess) {
      setLoadingCambios(false);
      setLoadingRegularizaciones(false);
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo aprobaciones data instead of fetching from backend');
      setDemoAprobaciones();
      setLoadingRegularizaciones(false);
      return;
    }

    fetchPendingCambios();
    fetchPendingRegularizaciones();
    fetchConfirmedRegularizaciones();
    fetchEmpleados();
  }, [canAccess, authUser?.isDemo, fetchPendingCambios, fetchPendingRegularizaciones, fetchConfirmedRegularizaciones, fetchEmpleados]);

  // Funcție pentru aprobare regularizare
  const handleApproveRegularizacion = (regularizacion) => {
    setRegularizacionToApprove(regularizacion);
    setShowApproveRegularizacionModal(true);
  };

  const confirmApproveRegularizacion = async () => {
    if (!regularizacionToApprove) return;

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Simulating regularizacion approval');
      setNotification({
        type: 'success',
        title: '¡Éxito! (DEMO)',
        message: 'Regularización aprobada con éxito! (Simulación DEMO)'
      });
      setPendingRegularizaciones(prev => prev.filter(r => r.id !== regularizacionToApprove.id));
      setShowApproveRegularizacionModal(false);
      setRegularizacionToApprove(null);
      return;
    }

    setProcessingAction(true);
    try {
      const url = routes.aprobarRegularizacion(regularizacionToApprove.id);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Response data:', responseData);
        setNotification({
          type: 'success',
          title: '¡Éxito!',
          message: 'Regularización aprobada correctamente.'
        });
        
        setShowApproveRegularizacionModal(false);
        setRegularizacionToApprove(null);
        
        fetchPendingRegularizaciones();
        fetchConfirmedRegularizaciones();
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        setNotification({
          type: 'error',
          title: 'Error',
          message: `Error al aprobar la regularización! Estado: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error approving regularizacion:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al aprobar la regularización!'
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Funcție pentru respingere regularizare
  const handleRejectRegularizacion = (regularizacion) => {
    setRegularizacionToReject(regularizacion);
    setRejectRegularizacionReason('');
    setCreateAusenciaOnReject(false); // Reset checkbox
    setShowRejectRegularizacionModal(true);
  };

  const confirmRejectRegularizacion = async () => {
    if (!rejectRegularizacionReason.trim()) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Por favor, introduce un motivo para el rechazo'
      });
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Simulating regularizacion rejection');
      setNotification({
        type: 'success',
        title: '¡Éxito! (DEMO)',
        message: `Regularización rechazada con motivo: ${rejectRegularizacionReason} (Simulación DEMO)`
      });
      setPendingRegularizaciones(prev => prev.filter(r => r.id !== regularizacionToReject.id));
      setShowRejectRegularizacionModal(false);
      setRejectRegularizacionReason('');
      setRegularizacionToReject(null);
      return;
    }

    setProcessingAction(true);
    try {
      const url = routes.rechazarRegularizacion(regularizacionToReject.id);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          notes: rejectRegularizacionReason,
          create_ausencia: createAusenciaOnReject // Trimite flag-ul pentru crearea ausencia
        })
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Response data:', responseData);
        setNotification({
          type: 'success',
          title: '¡Éxito!',
          message: 'Regularización rechazada correctamente.'
        });
        
        setShowRejectRegularizacionModal(false);
        setRejectRegularizacionReason('');
        setCreateAusenciaOnReject(false);
        setRegularizacionToReject(null);
        
        fetchPendingRegularizaciones();
        fetchConfirmedRegularizaciones();
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        setNotification({
          type: 'error',
          title: 'Error',
          message: `Error al rechazar la regularización! Estado: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error rejecting regularizacion:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al rechazar la regularización!'
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Helper pentru formatare ore (Xh Ym)
  const formatMinutesToHoursMinutes = (totalMinutes) => {
    if (totalMinutes === 0) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let formatted = '';
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0 || hours === 0) formatted += `${minutes}m`;
    return formatted.trim();
  };

  const handleApproveCambio = (cambio) => {
    // Deschide modalul de confirmare
    setCambioToApprove(cambio);
    setShowApproveModal(true);
  };

  // Helper pentru a parsea și extrage toate câmpurile modificate din cambio.campo
  const parseCamposModificados = (campoString) => {
    if (!campoString) return [];
    
    // Parsează formatul: "campo: \"valoare_veche\" → \"valoare_noua\"\n..."
    const lineas = campoString.split('\n').filter(l => l.trim());
    const campos = [];
    
    for (const linea of lineas) {
      // Format: "campo: \"valoare_veche\" → \"valoare_noua\""
      const match = linea.match(/^([^:]+):\s*"[^"]*"\s*→\s*"([^"]*)"/);
      if (match) {
        const campo = match[1].trim();
        campos.push(campo);
      }
    }
    
    return campos;
  };

  // Helper pentru a formata lista de câmpuri pentru afișare
  const formatCamposForDisplay = (campoString) => {
    const campos = parseCamposModificados(campoString);
    if (campos.length > 0) {
      return campos.join(', ');
    }
    // Fallback la valoarea originală dacă nu se poate parsea
    return campoString || 'N/A';
  };

  const confirmApproveCambio = async () => {
    if (!cambioToApprove) return;

    // Skip real backend call in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Simulating cambio approval');
      setNotification({
        type: 'success',
        title: '¡Éxito! (DEMO)',
        message: 'Modificación aprobada con éxito! (Simulación DEMO)'
      });
      // Remove from demo list (simulate approval)
      setPendingCambios(prev => prev.filter(c => c.id !== cambioToApprove.id));
      // Reset checkbox pentru acest cambio
      setEnviarAGestoriaMap(prev => {
        const newMap = { ...prev };
        delete newMap[cambioToApprove.id || cambioToApprove.ID];
        return newMap;
      });
      // Închide modalul
      setShowApproveModal(false);
      setCambioToApprove(null);
      return;
    }

    setProcessingAction(true);
    try {
      // Parsează lista de câmpuri din cambio.campo pentru a o trimite la backend
      const camposList = parseCamposModificados(
        cambioToApprove.campo || cambioToApprove.CAMPO_MODIFICADO || ''
      );
      
      // Pregătesc datele în formatul cerut pentru backend
      // Backend-ul va parsea cambio.campo pentru a obține lista de câmpuri,
      // dar trimitem și lista de câmpuri ca fallback
      const approvalData = {
        id: cambioToApprove.id || cambioToApprove.ID,
        codigo: cambioToApprove.codigo || cambioToApprove.CODIGO,
        email: cambioToApprove.CORREO_ELECTRONICO,
        nombre: cambioToApprove.NOMBRE,
        // Trimitem lista de câmpuri parseată (separată prin virgulă) ca fallback
        campo: camposList.length > 0 
          ? camposList.join(', ') 
          : (cambioToApprove.campo || cambioToApprove.CAMPO_MODIFICADO || ''),
        valor: cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua || ''
      };

      // Dacă checkbox-ul este bifat, adaugă parametrii pentru email la gestoria
      const cambioId = cambioToApprove.id || cambioToApprove.ID;
      if (enviarAGestoriaMap[cambioId]) {
        approvalData.enviarAGestoria = 'true';
        
        // Construiește mesajul email similar cu EmpleadosPage
        const mensajeEmail = `Se ha aprobado y actualizado la información del empleado:\n\n` +
                           `Empleado: ${cambioToApprove.NOMBRE || 'N/A'}\n` +
                           `Código: ${cambioToApprove.CODIGO || cambioToApprove.codigo || 'N/A'}\n` +
                           `Email: ${cambioToApprove.CORREO_ELECTRONICO || 'N/A'}\n\n` +
                           `Campo modificado: ${cambioToApprove.CAMPO_MODIFICADO || cambioToApprove.campo || 'N/A'}\n` +
                           `  - Valor anterior: ${cambioToApprove.VALOR_ANTERIOR || cambioToApprove.valor_anterior || '(vacío)'}\n` +
                           `  - Valor nuevo: ${cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua || '(vacío)'}\n\n` +
                           `Motivo del cambio: ${cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON || 'N/A'}\n\n` +
                           `Aprobado por: ${authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Sistema'}\n` +
                           `Fecha: ${new Date().toLocaleString('es-ES')}`;

        approvalData.emailBody = mensajeEmail;
        approvalData.emailSubject = `Aprobación de cambio de datos - ${cambioToApprove.NOMBRE || cambioToApprove.CODIGO || 'Empleado'}`;
        approvalData.updatedBy = authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Sistema';
      }

      console.log('Sending approval data:', approvalData);

      console.log('Making request to:', API_ENDPOINTS.APPROVE_CAMBIO);
      
      // Adaugă JWT token pentru backend
      const token = localStorage.getItem('auth_token');
      const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(API_ENDPOINTS.APPROVE_CAMBIO, {
        method: 'POST',
        headers,
        body: JSON.stringify(approvalData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Response data:', responseData);
        setNotification({
          type: 'success',
          title: '¡Éxito!',
          message: '¡Modificación aprobada correctamente!'
        });
        
        // Log aprobarea cambio
        await activityLogger.logAprobacionCambioApproved(approvalData, authUser);
        
        // Reset checkbox pentru acest cambio după aprobare
        setEnviarAGestoriaMap(prev => {
          const newMap = { ...prev };
          delete newMap[cambioId];
          return newMap;
        });
        
        // Închide modalul
        setShowApproveModal(false);
        setCambioToApprove(null);
        
        fetchPendingCambios();
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        setNotification({
          type: 'error',
          title: 'Error',
          message: `Error al aprobar la modificación! Estado: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error approving cambio:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al aprobar la modificación!'
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRejectCambio = (cambio) => {
    setCambioToReject(cambio);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmRejectCambio = async () => {
    if (!rejectReason.trim()) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Por favor, introduce un motivo para el rechazo'
      });
      return;
    }

    // Skip real backend call in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Simulating cambio rejection');
      setNotification({
        type: 'success',
        title: '¡Éxito! (DEMO)',
        message: `Modificación rechazada con motivo: ${rejectReason} (Simulación DEMO)`
      });
      // Remove from demo list (simulate rejection)
      setPendingCambios(prev => prev.filter(c => c.id !== cambioToReject.id));
      setShowRejectModal(false);
      setRejectReason('');
      setCambioToReject(null);
      return;
    }

    setProcessingAction(true);
    try {
      // Pregătesc datele în formatul cerut pentru backend
      const rejectionData = {
        id: cambioToReject.id,
        codigo: cambioToReject.codigo,
        email: cambioToReject.CORREO_ELECTRONICO,
        nombre: cambioToReject.NOMBRE,
        campo: cambioToReject.campo,
        valor: cambioToReject.valoare_veche, // valoarea veche pentru reject
        // Adaug toate datele disponibile despre solicitare
        valoare_noua: cambioToReject.valoare_noua,
        motiv: rejectReason, // motivul introdus de utilizator
        status: 'rechazada',
        data_creare: cambioToReject.data_creare,
        data_aprobare: new Date().toISOString()
      };

      console.log('🔍 Raw cambio object:', cambioToReject);
      console.log('🔍 Available cambio keys:', Object.keys(cambioToReject));
      console.log('Sending rejection data:', rejectionData);
      console.log('Making request to:', API_ENDPOINTS.REJECT_CAMBIO);

      // Adaugă JWT token pentru backend
      const token = localStorage.getItem('auth_token');
      const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.REJECT_CAMBIO, {
        method: 'POST',
        headers,
        body: JSON.stringify(rejectionData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Response data:', responseData);
        setNotification({
          type: 'success',
          title: '¡Éxito!',
          message: '¡Modificación rechazada correctamente!'
        });
        
        // Log respingerea cambio
        await activityLogger.logAprobacionCambioRejected(
          rejectionData,
          rejectReason,
          authUser
        );
        
        // Închid modal-ul
        setShowRejectModal(false);
        setRejectReason('');
        setCambioToReject(null);
        
        fetchPendingCambios();
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        setNotification({
          type: 'error',
          title: 'Error',
          message: `Error al rechazar la modificación! Estado: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error rejecting cambio:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al rechazar la modificación!'
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const handleReportError = () => {
    const pageData = {
      additionalInfo: [
        `[TAB ACTIVO] ${activeTab === 'cambios' ? 'Cambios de Datos' : 'Regularizaciones'}`,
        pendingCambios?.length > 0 ? `[CAMBIOS PENDIENTES] ${pendingCambios.length}` : null,
        activeTab === 'regularizaciones' ? (
          activeRegularizacionSubtab === 'pending'
            ? (pendingRegularizaciones?.length > 0 ? `[REGULARIZACIONES PENDIENTES] ${pendingRegularizaciones.length}` : null)
            : (confirmedRegularizaciones?.length > 0 ? `[REGULARIZACIONES CONFIRMADAS] ${confirmedRegularizaciones.length}` : null)
        ) : null,
      ].filter(Boolean),
    };
    const message = buildErrorReportMessage({
      authUser,
      pageName: 'Aprobaciones',
      pageData,
    });
    openWhatsAppErrorReport(message);
  };

  const renderCambioActions = (cambio) => (
    <div className="solicitud-admin-toolbar aprobaciones-actions">
      <button type="button" onClick={() => handleViewDetails(cambio)} className="solicitud-admin-btn">
        <Eye className="w-4 h-4" aria-hidden />
        <span>Detalles</span>
      </button>
      <button
        type="button"
        onClick={() => handleApproveCambio(cambio)}
        disabled={processingAction}
        className="solicitud-admin-icon-btn solicitud-admin-icon-btn--approve"
        aria-label="Aprobar"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => handleRejectCambio(cambio)}
        disabled={processingAction}
        className="solicitud-admin-icon-btn solicitud-admin-icon-btn--reject"
        aria-label="Rechazar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const renderRegularizacionActions = (regularizacion) => (
    <div className="solicitud-admin-toolbar aprobaciones-actions">
      <button
        type="button"
        onClick={() => handleApproveRegularizacion(regularizacion)}
        disabled={processingAction}
        className="solicitud-admin-btn solicitud-admin-btn--primary"
      >
        <Check className="w-4 h-4" aria-hidden />
        <span>Aprobar</span>
      </button>
      <button
        type="button"
        onClick={() => handleRejectRegularizacion(regularizacion)}
        disabled={processingAction}
        className="solicitud-admin-btn"
      >
        <X className="w-4 h-4" aria-hidden />
        <span>Rechazar</span>
      </button>
    </div>
  );

  if (canAccess === null || loadingPermissions) {
    return (
      <div className="app-page aprobaciones-page">
        <PageHeader title="Aprobaciones" subtitle="Gestiona aprobaciones" backTo="/inicio" />
        <AlertBanner variant="loading" loading>Cargando permisos...</AlertBanner>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="app-page aprobaciones-page">
        <PageHeader title="Aprobaciones" backTo="/inicio" />
        <AlertBanner variant="danger" title="Acceso Restringido">
          No tienes permisos configurados para acceder a la página de Aprobaciones. Contacta con tu supervisor.
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className="app-page aprobaciones-page">
      <PageHeader
        title="Aprobaciones"
        subtitle="Cambios de datos y regularizaciones de fichajes"
        backTo="/inicio"
        actions={(
          <button type="button" onClick={handleReportError} className="solicitud-admin-btn" title="Reportar error">
            <MessageCircleWarning className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">Reportar error</span>
          </button>
        )}
      />

      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        className="solicitud-admin-tabs"
        items={[
          { id: 'cambios', label: `Cambios (${pendingCambios.length})`, shortLabel: `Datos (${pendingCambios.length})` },
          { id: 'regularizaciones', label: `Fichajes (${pendingRegularizaciones.length})`, shortLabel: `Fich. (${pendingRegularizaciones.length})` },
        ]}
      />

      {activeTab === 'cambios' && (
        <div className="app-card app-card--pad aprobaciones-section">
          <div className="solicitud-admin-toolbar">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Cambios de Datos Pendientes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Revisa y aprueba las propuestas de actualización</p>
            </div>
            <button type="button" onClick={fetchPendingCambios} disabled={loadingCambios} className="solicitud-admin-btn" title="Actualizar lista">
              <RefreshCw className={`w-4 h-4 ${loadingCambios ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {errorCambios && <AlertBanner variant="danger" className="mt-3">{errorCambios}</AlertBanner>}

          {loadingCambios ? (
            <AlertBanner variant="loading" loading className="mt-3">Cargando cambios...</AlertBanner>
          ) : (pendingCambios || []).length === 0 ? (
            <AlertBanner variant="success" title="No hay solicitudes pendientes" className="mt-3">
              Cuando haya solicitudes de cambio, aparecerán aquí.
            </AlertBanner>
          ) : (
            <div className="solicitud-admin-mobile-list mt-3">
              {pendingCambios.map((cambio, index) => (
                <article key={cambio.id || cambio.ID || index} className="solicitud-admin-mobile-card">
                  <div className="solicitud-admin-mobile-card__head">
                    <div className="min-w-0">
                      <h3 className="solicitud-admin-mobile-card__title">{cambio.NOMBRE || cambio.nombre || 'Sin nombre'}</h3>
                      <p className="text-xs text-gray-500 truncate">{cambio.CORREO_ELECTRONICO || cambio.correo_electronico}</p>
                    </div>
                    <span className="solicitud-status solicitud-status--pendiente">Pendiente</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                    <span className="font-medium">{cambio.CAMPO_MODIFICADO || cambio.campo}:</span>
                    <span className="ml-1 line-through text-gray-400">{cambio.VALOR_ANTERIOR || '—'}</span>
                    <span className="ml-1 text-green-700 dark:text-green-400 font-semibold">{cambio.VALOR_NUEVO || cambio.valoare_noua}</span>
                  </p>
                  {cambio.FECHA_SOLICITUD && (
                    <p className="text-xs text-gray-500 mt-1">
                      Solicitud: {new Date(cambio.FECHA_SOLICITUD).toLocaleString('es-ES')}
                    </p>
                  )}
                  {renderCambioActions(cambio)}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'regularizaciones' && (
        <div className="app-card app-card--pad aprobaciones-section">
          <div className="solicitud-admin-toolbar">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Regularizaciones de Fichajes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gestiona las jornadas regularizadas</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeRegularizacionSubtab === 'pending') fetchPendingRegularizaciones();
                else fetchConfirmedRegularizaciones();
              }}
              disabled={activeRegularizacionSubtab === 'pending' ? loadingRegularizaciones : loadingConfirmedRegularizaciones}
              className="solicitud-admin-btn"
              title="Actualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${(activeRegularizacionSubtab === 'pending' ? loadingRegularizaciones : loadingConfirmedRegularizaciones) ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          <SegmentedControl
            value={activeRegularizacionSubtab}
            onChange={setActiveRegularizacionSubtab}
            className="solicitud-admin-subtabs mt-3"
            items={[
              { id: 'pending', label: `Pendientes (${pendingRegularizaciones.length})`, shortLabel: `Pend. (${pendingRegularizaciones.length})` },
              { id: 'confirmed', label: `Confirmadas (${confirmedRegularizaciones.length})`, shortLabel: `OK (${confirmedRegularizaciones.length})` },
            ]}
          />

          {activeRegularizacionSubtab === 'pending' && (
            <>
              {errorRegularizaciones && <AlertBanner variant="danger" className="mt-3">{errorRegularizaciones}</AlertBanner>}
              {loadingRegularizaciones ? (
                <AlertBanner variant="loading" loading className="mt-3">Cargando regularizaciones pendientes...</AlertBanner>
              ) : (pendingRegularizaciones || []).length === 0 ? (
                <AlertBanner variant="success" title="No hay regularizaciones pendientes" className="mt-3">
                  Cuando haya jornadas con horas extra declaradas, aparecerán aquí.
                </AlertBanner>
              ) : (
                <div className="solicitud-admin-mobile-list mt-3">
                  {pendingRegularizaciones.map((regularizacion) => {
                    const deltaMinutes = regularizacion.punched_minutes - regularizacion.scheduled_minutes;
                    const deltaFormatted = formatMinutesToHoursMinutes(Math.abs(deltaMinutes));
                    const isMore = deltaMinutes > 0;
                    const workdayDate = new Date(regularizacion.workday_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
                    return (
                      <article key={regularizacion.id} className="solicitud-admin-mobile-card">
                        <div className="solicitud-admin-mobile-card__head">
                          <div className="min-w-0">
                            <h3 className="solicitud-admin-mobile-card__title">
                              {regularizacion.employee_codigo}
                              {getEmpleadoNombre(regularizacion.employee_codigo) && (
                                <span className="font-normal text-gray-600"> — {getEmpleadoNombre(regularizacion.employee_codigo)}</span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500">{workdayDate}</p>
                          </div>
                          <span className="solicitud-status solicitud-status--pendiente">Pendiente</span>
                        </div>
                        <dl className="solicitud-admin-kv mt-2">
                          <div><dt>Fichadas</dt><dd>{formatMinutesToHoursMinutes(regularizacion.punched_minutes)}</dd></div>
                          <div><dt>Previstas</dt><dd>{formatMinutesToHoursMinutes(regularizacion.scheduled_minutes)}</dd></div>
                          <div><dt>Diferencia</dt><dd className={isMore ? 'text-orange-600' : 'text-red-600'}>{isMore ? '+' : '-'}{deltaFormatted}</dd></div>
                        </dl>
                        {regularizacion.reason_code && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            <span className="font-medium">Motivo:</span> {getRegularizacionReasonLabel(regularizacion.reason_code)}
                          </p>
                        )}
                        {regularizacion.notes && (
                          <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Notas:</span> {regularizacion.notes}</p>
                        )}
                        {renderRegularizacionActions(regularizacion)}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeRegularizacionSubtab === 'confirmed' && (
            <>
              {errorConfirmedRegularizaciones && <AlertBanner variant="danger" className="mt-3">{errorConfirmedRegularizaciones}</AlertBanner>}
              {loadingConfirmedRegularizaciones ? (
                <AlertBanner variant="loading" loading className="mt-3">Cargando regularizaciones confirmadas...</AlertBanner>
              ) : (confirmedRegularizaciones || []).length === 0 ? (
                <AlertBanner variant="info" title="No hay regularizaciones confirmadas" className="mt-3">
                  Las regularizaciones confirmadas aparecerán aquí.
                </AlertBanner>
              ) : (
                <div className="solicitud-admin-mobile-list mt-3">
                  {confirmedRegularizaciones.map((regularizacion) => {
                    const workdayDate = new Date(regularizacion.workday_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
                    const confirmedDate = regularizacion.confirmed_at
                      ? new Date(regularizacion.confirmed_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                      : 'N/A';
                    return (
                      <article key={regularizacion.id} className="solicitud-admin-mobile-card">
                        <div className="solicitud-admin-mobile-card__head">
                          <div className="min-w-0">
                            <h3 className="solicitud-admin-mobile-card__title">
                              {regularizacion.employee_codigo}
                              {getEmpleadoNombre(regularizacion.employee_codigo) && (
                                <span className="font-normal text-gray-600"> — {getEmpleadoNombre(regularizacion.employee_codigo)}</span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500">{workdayDate} · Confirmada {confirmedDate}</p>
                          </div>
                          <span className="solicitud-status solicitud-status--ok">Confirmada</span>
                        </div>
                        <dl className="solicitud-admin-kv mt-2">
                          <div><dt>Fichadas</dt><dd>{formatMinutesToHoursMinutes(regularizacion.punched_minutes)}</dd></div>
                          <div><dt>Previstas</dt><dd>{formatMinutesToHoursMinutes(regularizacion.scheduled_minutes)}</dd></div>
                          <div><dt>Efectivas</dt><dd>{regularizacion.effective_minutes ? formatMinutesToHoursMinutes(regularizacion.effective_minutes) : 'N/A'}</dd></div>
                        </dl>
                        {regularizacion.reason_code && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            <span className="font-medium">Motivo:</span> {getRegularizacionReasonLabel(regularizacion.reason_code)}
                          </p>
                        )}
                        {regularizacion.notes && (
                          <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Notas:</span> {regularizacion.notes}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Detalles de modificación"
        showCloseButton={false}
        size="lg"
        className="app-modal--form"
        footer={selectedItem ? (
          <div className="app-modal__actions">
            <button type="button" onClick={() => setShowDetailsModal(false)} className="app-modal__btn">Cerrar</button>
            <button type="button" onClick={() => handleRejectCambio(selectedItem)} disabled={processingAction} className="app-modal__btn">Rechazar</button>
            <button type="button" onClick={() => handleApproveCambio(selectedItem)} disabled={processingAction} className="app-modal__btn app-modal__btn--ok">Aprobar</button>
          </div>
        ) : null}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="app-modal__field">
                <span className="app-modal__label">Empleado</span>
                <p className="app-modal__meta">{selectedItem.NOMBRE || selectedItem.nombre || selectedItem.CORREO_ELECTRONICO || selectedItem.email || 'N/A'}</p>
              </div>
              <div className="app-modal__field">
                <span className="app-modal__label">Campo modificado</span>
                <p className="app-modal__meta font-semibold">{selectedItem.CAMPO_MODIFICADO || selectedItem.campo}</p>
              </div>
              <div className="app-modal__field">
                <span className="app-modal__label">Valor anterior</span>
                <p className="app-modal__meta line-through">{selectedItem.VALOR_ANTERIOR || selectedItem.valor_anterior || '—'}</p>
              </div>
              <div className="app-modal__field">
                <span className="app-modal__label">Valor nuevo</span>
                <p className="app-modal__meta text-green-700 dark:text-green-400 font-semibold">{selectedItem.VALOR_NUEVO || selectedItem.valor_nuevo || selectedItem.valoare_noua}</p>
              </div>
              <div className="app-modal__field sm:col-span-2">
                <span className="app-modal__label">Motivo del cambio</span>
                <p className="app-modal__meta">{selectedItem.MOTIVO_CAMBIO || selectedItem.razon || selectedItem.RAZON || 'N/A'}</p>
              </div>
              <div className="app-modal__field">
                <span className="app-modal__label">Fecha solicitud</span>
                <p className="app-modal__meta">
                  {selectedItem.FECHA_SOLICITUD ? new Date(selectedItem.FECHA_SOLICITUD).toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <label htmlFor="enviar-gestoria-checkbox" className="flex items-center gap-3 cursor-pointer">
              <input
                id="enviar-gestoria-checkbox"
                name="enviar-gestoria"
                type="checkbox"
                checked={enviarAGestoriaMap[selectedItem.id || selectedItem.ID] || false}
                onChange={(e) => {
                  const cambioId = selectedItem.id || selectedItem.ID;
                  setEnviarAGestoriaMap(prev => ({ ...prev, [cambioId]: e.target.checked }));
                }}
                className="w-5 h-5"
              />
              <span className="app-modal__label mb-0">Enviar a Gestoria</span>
            </label>
          </div>
        )}
      </Modal>,
      document.body
      )}

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setCambioToApprove(null); }}
        title="Confirmar aprobación"
        showCloseButton={false}
        size="lg"
        className="app-modal--form"
        footer={cambioToApprove ? (
          <div className="app-modal__actions flex-col sm:flex-row gap-3">
            <label htmlFor="enviar-gestoria-confirm-checkbox" className="flex items-center gap-3 cursor-pointer w-full sm:mr-auto">
              <input
                id="enviar-gestoria-confirm-checkbox"
                name="enviar-gestoria-confirm"
                type="checkbox"
                checked={enviarAGestoriaMap[cambioToApprove.id || cambioToApprove.ID] || false}
                onChange={(e) => {
                  const cambioId = cambioToApprove.id || cambioToApprove.ID;
                  setEnviarAGestoriaMap(prev => ({ ...prev, [cambioId]: e.target.checked }));
                }}
                className="w-5 h-5"
              />
              <span className="app-modal__label mb-0">Enviar a Gestoria</span>
            </label>
            <button type="button" onClick={() => { setShowApproveModal(false); setCambioToApprove(null); }} disabled={processingAction} className="app-modal__btn">Cancelar</button>
            <button type="button" onClick={confirmApproveCambio} disabled={processingAction} className="app-modal__btn app-modal__btn--ok">
              {processingAction ? 'Procesando...' : 'Sí, aprobar'}
            </button>
          </div>
        ) : null}
      >
        {cambioToApprove && (
          <div className="space-y-4">
            <AlertBanner variant="warning" title="¿Confirmar aprobación?">
              Esta acción actualizará los datos del empleado y no se puede deshacer.
            </AlertBanner>
            <div className="space-y-3">
              <div className="app-modal__field">
                <span className="app-modal__label">Empleado</span>
                <p className="app-modal__meta font-semibold">{cambioToApprove.NOMBRE || cambioToApprove.nombre || 'N/A'}</p>
              </div>
              <div className="app-modal__field">
                <span className="app-modal__label">Campo modificado</span>
                <p className="app-modal__meta font-semibold break-words">{formatCamposForDisplay(cambioToApprove.campo || cambioToApprove.CAMPO_MODIFICADO)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="app-modal__field">
                  <span className="app-modal__label">Valor anterior</span>
                  <p className="app-modal__meta line-through break-words">{cambioToApprove.VALOR_ANTERIOR || cambioToApprove.valor_anterior || '—'}</p>
                </div>
                <div className="app-modal__field">
                  <span className="app-modal__label">Valor nuevo</span>
                  <p className="app-modal__meta text-green-700 font-semibold break-words">{cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua || '—'}</p>
                </div>
              </div>
              {(cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON) && (
                <div className="app-modal__field">
                  <span className="app-modal__label">Motivo del cambio</span>
                  <p className="app-modal__meta break-words">{cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>,
      document.body
      )}

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); setCambioToReject(null); }}
        title="Motivo del rechazo"
        showCloseButton={false}
        className="app-modal--form"
        footer={(
          <div className="app-modal__actions">
            <button type="button" onClick={() => { setShowRejectModal(false); setRejectReason(''); setCambioToReject(null); }} className="app-modal__btn">Cancelar</button>
            <button type="button" onClick={confirmRejectCambio} disabled={processingAction || !rejectReason.trim()} className="app-modal__btn app-modal__btn--primary">
              {processingAction ? 'Procesando...' : 'Confirmar rechazo'}
            </button>
          </div>
        )}
      >
        <div className="app-modal__field">
          <label htmlFor="reject-reason-cambio" className="app-modal__label">Explica por qué rechazas esta solicitud</label>
          <textarea
            id="reject-reason-cambio"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Introduce el motivo del rechazo..."
            className="app-modal__input min-h-[6rem] resize-y"
            rows={4}
            required
          />
        </div>
      </Modal>,
      document.body
      )}
      
      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showApproveRegularizacionModal}
        onClose={() => { setShowApproveRegularizacionModal(false); setRegularizacionToApprove(null); }}
        title="Confirmar aprobación de regularización"
        showCloseButton={false}
        size="lg"
        className="app-modal--form"
        footer={regularizacionToApprove ? (
          <div className="app-modal__actions">
            <button type="button" onClick={() => { setShowApproveRegularizacionModal(false); setRegularizacionToApprove(null); }} disabled={processingAction} className="app-modal__btn">Cancelar</button>
            <button type="button" onClick={confirmApproveRegularizacion} disabled={processingAction} className="app-modal__btn app-modal__btn--ok">
              {processingAction ? 'Procesando...' : 'Sí, aprobar'}
            </button>
          </div>
        ) : null}
      >
        {regularizacionToApprove && (() => {
          // Logica pentru effective_minutes la aprobare:
          // 1. Dacă regularization_type = NO_EXTRA → păstrează effective_minutes (deja setat la scheduled_minutes)
          // 2. Dacă regularization_type = DECLARES_EXTRA → păstrează effective_minutes (deja setat la punched_minutes)
          //    Excepție: dacă punched_minutes = 0 → folosește scheduled_minutes
          // 3. Dacă regularization_type = NO_PUNCH:
          //    - Dacă reason_code = 'OLVIDO_FICHAR' și punched_minutes = 0 → folosește scheduled_minutes (8h, nu 0)
          //    - Pentru alte reason_code-uri (VACACIONES, BAJA, PERMISO, AUSENCIA_INJUSTIFICADA) → rămâne 0
          
          // DEBUG: Log pentru a vedea valorile
          console.log('🔍 [Approve Modal] Regularizacion data:', {
            id: regularizacionToApprove.id,
            regularization_type: regularizacionToApprove.regularization_type,
            reason_code: regularizacionToApprove.reason_code,
            punched_minutes: regularizacionToApprove.punched_minutes,
            scheduled_minutes: regularizacionToApprove.scheduled_minutes,
            effective_minutes: regularizacionToApprove.effective_minutes
          });
          
          let effectiveMinutes = regularizacionToApprove.effective_minutes || 0; // Păstrează valoarea existentă by default
          let willUseScheduledMinutes = false;
          
          if (regularizacionToApprove.regularization_type === 'NO_EXTRA') {
            // Când user a zis "No", păstrăm effective_minutes așa cum e (deja setat la scheduled_minutes)
            effectiveMinutes = regularizacionToApprove.effective_minutes || regularizacionToApprove.scheduled_minutes;
            willUseScheduledMinutes = true;
          } else if (regularizacionToApprove.regularization_type === 'DECLARES_EXTRA') {
            // Când user a zis "Sí", păstrăm effective_minutes așa cum e (deja setat la punched_minutes)
            // Excepție: dacă punched_minutes = 0, folosim scheduled_minutes
            if (regularizacionToApprove.punched_minutes === 0 && regularizacionToApprove.scheduled_minutes > 0) {
              effectiveMinutes = regularizacionToApprove.scheduled_minutes;
              willUseScheduledMinutes = true;
            } else {
              effectiveMinutes = regularizacionToApprove.effective_minutes || regularizacionToApprove.punched_minutes;
            }
          } else if (regularizacionToApprove.regularization_type === 'NO_PUNCH') {
            // Pentru NO_PUNCH, verificăm reason_code pentru a determina effective_minutes
            console.log('🔍 [Approve Modal] NO_PUNCH detected:', {
              reason_code: regularizacionToApprove.reason_code,
              punched_minutes: regularizacionToApprove.punched_minutes,
              scheduled_minutes: regularizacionToApprove.scheduled_minutes
            });
            
            // Pentru OLVIDO_FICHAR, AUSENCIA_INJUSTIFICADA și OTRO cu punched_minutes = 0 → aprobă orele previste
            const shouldUseScheduled = (
              (regularizacionToApprove.reason_code === 'OLVIDO_FICHAR' ||
               regularizacionToApprove.reason_code === 'AUSENCIA_INJUSTIFICADA' ||
               regularizacionToApprove.reason_code === 'OTRO') &&
              regularizacionToApprove.punched_minutes === 0 &&
              regularizacionToApprove.scheduled_minutes > 0
            );
            
            console.log('🔍 [Approve Modal] NO_PUNCH condition check:', {
              reason_code: regularizacionToApprove.reason_code,
              is_olvido: regularizacionToApprove.reason_code === 'OLVIDO_FICHAR',
              is_ausencia: regularizacionToApprove.reason_code === 'AUSENCIA_INJUSTIFICADA',
              is_otro: regularizacionToApprove.reason_code === 'OTRO',
              punched_minutes: regularizacionToApprove.punched_minutes,
              scheduled_minutes: regularizacionToApprove.scheduled_minutes,
              shouldUseScheduled
            });
            
            if (shouldUseScheduled) {
              // "Olvidó fichar", "Ausencia injustificada" sau "Otro" → aprobă orele previste (scheduled_minutes) ca ore efective
              effectiveMinutes = regularizacionToApprove.scheduled_minutes;
              willUseScheduledMinutes = true;
              console.log(`✅ [Approve Modal] NO_PUNCH with ${regularizacionToApprove.reason_code}: using scheduled_minutes =`, effectiveMinutes);
            } else {
              // Pentru VACACIONES, BAJA, PERMISO → rămâne 0
              effectiveMinutes = 0;
              console.log(`⚠️ [Approve Modal] NO_PUNCH with ${regularizacionToApprove.reason_code}: keeping effectiveMinutes = 0 (conditions not met)`);
            }
          } else {
            console.log('⚠️ [Approve Modal] Unknown regularization_type:', regularizacionToApprove.regularization_type);
          }
          
          console.log('📊 [Approve Modal] Final calculation:', {
            effectiveMinutes,
            willUseScheduledMinutes,
            scheduled_minutes: regularizacionToApprove.scheduled_minutes,
            punched_minutes: regularizacionToApprove.punched_minutes
          });
          
          return (
            <div className="space-y-4">
              <AlertBanner variant="warning" title="¿Confirmar aprobación de regularización?">
                {willUseScheduledMinutes 
                  ? `Se aprobarán las horas previstas (${formatMinutesToHoursMinutes(effectiveMinutes)}) como horas efectivas trabajadas.`
                  : effectiveMinutes > 0
                    ? `Se aprobarán las horas fichadas (${formatMinutesToHoursMinutes(effectiveMinutes)}) como horas efectivas trabajadas.`
                    : 'Se aprobarán 0 horas efectivas trabajadas.'}
              </AlertBanner>
            
            <div className="space-y-3">
              <div className="app-modal__field">
                <span className="app-modal__label">Empleado</span>
                <p className="app-modal__meta font-semibold">{regularizacionToApprove.employee_codigo}</p>
              </div>
              
              <div className="app-modal__field">
                <span className="app-modal__label">Fecha</span>
                <p className="app-modal__meta">
                  {new Date(regularizacionToApprove.workday_date).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="app-modal__field">
                  <span className="app-modal__label">Horas fichadas</span>
                  <p className="app-modal__meta text-blue-700 font-semibold">{formatMinutesToHoursMinutes(regularizacionToApprove.punched_minutes)}</p>
                </div>
                <div className="app-modal__field">
                  <span className="app-modal__label">Horas previstas</span>
                  <p className="app-modal__meta text-green-700 font-semibold">{formatMinutesToHoursMinutes(regularizacionToApprove.scheduled_minutes)}</p>
                </div>
              </div>
              
              <div className="app-modal__field">
                <span className="app-modal__label">Diferencia</span>
                <p className={`app-modal__meta font-semibold ${regularizacionToApprove.punched_minutes > regularizacionToApprove.scheduled_minutes ? 'text-orange-600' : 'text-red-600'}`}>
                  {regularizacionToApprove.punched_minutes > regularizacionToApprove.scheduled_minutes ? '+' : '-'}
                  {formatMinutesToHoursMinutes(Math.abs(regularizacionToApprove.punched_minutes - regularizacionToApprove.scheduled_minutes))}
                </p>
              </div>
            </div>
          </div>
          );
        })()}
      </Modal>,
      document.body
      )}

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showRejectRegularizacionModal}
        onClose={() => { setShowRejectRegularizacionModal(false); setRejectRegularizacionReason(''); setCreateAusenciaOnReject(false); setRegularizacionToReject(null); }}
        title="Motivo del rechazo de regularización"
        showCloseButton={false}
        className="app-modal--form"
        footer={(
          <div className="app-modal__actions">
            <button type="button" onClick={() => { setShowRejectRegularizacionModal(false); setRejectRegularizacionReason(''); setCreateAusenciaOnReject(false); setRegularizacionToReject(null); }} className="app-modal__btn">Cancelar</button>
            <button type="button" onClick={confirmRejectRegularizacion} disabled={processingAction || !rejectRegularizacionReason.trim()} className="app-modal__btn app-modal__btn--primary">
              {processingAction ? 'Procesando...' : 'Confirmar rechazo'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          {regularizacionToReject && (
            <div className="solicitud-admin-callout space-y-1">
              <p className="app-modal__meta"><span className="font-medium">Empleado:</span> {regularizacionToReject.employee_codigo}</p>
              <p className="app-modal__meta"><span className="font-medium">Fecha:</span> {new Date(regularizacionToReject.workday_date).toLocaleDateString('es-ES')}</p>
              <p className="app-modal__meta"><span className="font-medium">Horas fichadas:</span> {formatMinutesToHoursMinutes(regularizacionToReject.punched_minutes)}</p>
              <p className="app-modal__meta"><span className="font-medium">Horas previstas:</span> {formatMinutesToHoursMinutes(regularizacionToReject.scheduled_minutes)}</p>
            </div>
          )}
          
          <div className="app-modal__field">
            <label htmlFor="reject-reason-regularizacion" className="app-modal__label">Explica por qué rechazas esta regularización</label>
            <textarea
              id="reject-reason-regularizacion"
              value={rejectRegularizacionReason}
              onChange={(e) => setRejectRegularizacionReason(e.target.value)}
              placeholder="Introduce el motivo del rechazo..."
              className="app-modal__input min-h-[6rem] resize-y"
              rows={4}
              required
            />
          </div>
          
          <label htmlFor="createAusenciaOnReject" className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="createAusenciaOnReject"
              checked={createAusenciaOnReject}
              onChange={(e) => setCreateAusenciaOnReject(e.target.checked)}
              className="mt-1 w-5 h-5"
            />
            <span>
              <span className="app-modal__label mb-0 block">Registrar como Ausencia Injustificada</span>
              <span className="app-modal__meta text-sm">
                Si marcas esta opción, se creará automáticamente una ausencia injustificada para esta fecha.
              </span>
            </span>
          </label>
        </div>
      </Modal>,
      document.body
      )}

      {/* Componenta de Notificări */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
} 