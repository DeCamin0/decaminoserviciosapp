import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Card, Button, Modal, Notification } from '../components/ui';
import Back3DButton from '../components/Back3DButton.jsx';
import { API_ENDPOINTS } from '../utils/constants';
import { useAdminApi } from '../hooks/useAdminApi';
import activityLogger from '../utils/activityLogger';
import { routes } from '../utils/routes';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';


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
          message: 'Modificare aprobată cu succes!'
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
          message: 'Modificare respinsă cu succes!'
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

  // Așteaptă până când permisiunile sunt verificate
  if (canAccess === null || loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Dacă nu are permisiuni, afișează mesajul de eroare
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            No tienes permisos configurados para acceder a la página de Aprobaciones.
          </p>
          <p className="text-gray-600 mb-6">
            Por favor, contacta con tu supervisor para que te asigne los permisos necesarios.
          </p>
          <Back3DButton to="/inicio" title="Volver al Inicio" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar a Inicio" />
          <div>
            <h1 className="text-2xl font-bold text-red-600">Aprobaciones</h1>
            <p className="text-gray-600">Gestiona aprobaciones de cambios de datos</p>
          </div>
        </div>
        
        {/* Buton Reportar error */}
        <button
          onClick={() => {
            // Date relevante pentru pagina de aprobaciones
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
              pageName: "Aprobaciones",
              pageData,
            });
            
            openWhatsAppErrorReport(message);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          title="Reportar error"
        >
          <span className="text-lg">📱</span>
          <span>Reportar error</span>
        </button>
      </div>

      {/* Tab-uri */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('cambios')}
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              activeTab === 'cambios'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📝</span>
              Cambios de Datos
              {pendingCambios.length > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingCambios.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('regularizaciones')}
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              activeTab === 'regularizaciones'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>⏰</span>
              Regularizaciones de Fichajes
              {pendingRegularizaciones.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingRegularizaciones.length}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Conținut pentru Cambios de Datos */}
      {activeTab === 'cambios' && (
      <div>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow">
                📝
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Cambios de Datos Pendientes</h2>
                <p className="text-gray-500 text-sm">Revisa y aprueba las propuestas de actualización</p>
              </div>
            </div>
            {/* Buton Refresh 3D albastru */}
            <button
              onClick={fetchPendingCambios}
              disabled={loadingCambios}
              className={`group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-blue-500/50 overflow-hidden ${loadingCambios ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              title="Actualizează lista"
            >
              <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="relative flex items-center justify-center h-full">
                <span className={`text-2xl ${loadingCambios ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`}>🔄</span>
              </div>
            </button>
          </div>
          
          {errorCambios && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {errorCambios}
            </div>
          )}

          {loadingCambios ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando cambios...</p>
            </div>
          ) : (pendingCambios || []).length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-2xl">✅</div>
              <div className="text-gray-800 font-semibold">No hay solicitudes pendientes</div>
              <div className="text-gray-500 text-sm">Cuando haya solicitudes de cambio, aparecerán aquí.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCambios.map((cambio, index) => (
                <div key={index} className="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{cambio.NOMBRE || cambio.nombre}</div>
                        <div className="text-xs text-gray-500">{cambio.CORREO_ELECTRONICO || cambio.correo_electronico}</div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">{cambio.CAMPO_MODIFICADO || cambio.campo}:</span>
                          <span className="ml-2 line-through text-gray-400">{cambio.VALOR_ANTERIOR || '—'}</span>
                          <span className="ml-2 text-green-700 font-semibold">{cambio.VALOR_NUEVO || cambio.valoare_noua}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleViewDetails(cambio)} variant="outline" size="sm">Detalles</Button>
                      <Button onClick={() => handleApproveCambio(cambio)} disabled={processingAction} size="sm" className="bg-green-600 hover:bg-green-700">Aprobar</Button>
                      <Button onClick={() => handleRejectCambio(cambio)} disabled={processingAction} variant="outline" size="sm" className="border-red-600 text-red-600 hover:bg-red-50">Rechazar</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      )}

      {/* Conținut pentru Regularizaciones de Fichajes */}
      {activeTab === 'regularizaciones' && (
      <div>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow">
                ⏰
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Regularizaciones de Fichajes</h2>
                <p className="text-gray-500 text-sm">Gestiona las jornadas regularizadas</p>
              </div>
            </div>
            {/* Buton Refresh 3D albastru */}
            <button
              onClick={() => {
                if (activeRegularizacionSubtab === 'pending') {
                  fetchPendingRegularizaciones();
                } else {
                  fetchConfirmedRegularizaciones();
                }
              }}
              disabled={activeRegularizacionSubtab === 'pending' ? loadingRegularizaciones : loadingConfirmedRegularizaciones}
              className={`group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-blue-500/50 overflow-hidden ${(activeRegularizacionSubtab === 'pending' ? loadingRegularizaciones : loadingConfirmedRegularizaciones) ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              title="Actualizar lista"
            >
              <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="relative flex items-center justify-center h-full">
                <span className={`text-2xl ${(activeRegularizacionSubtab === 'pending' ? loadingRegularizaciones : loadingConfirmedRegularizaciones) ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`}>🔄</span>
              </div>
            </button>
          </div>

          {/* Subtab-uri */}
          <div className="mb-6">
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveRegularizacionSubtab('pending')}
                className={`px-6 py-2 font-semibold text-sm transition-colors ${
                  activeRegularizacionSubtab === 'pending'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>⏳</span>
                  Pendientes
                  {pendingRegularizaciones.length > 0 && (
                    <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {pendingRegularizaciones.length}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveRegularizacionSubtab('confirmed')}
                className={`px-6 py-2 font-semibold text-sm transition-colors ${
                  activeRegularizacionSubtab === 'confirmed'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>✅</span>
                  Confirmadas
                  {confirmedRegularizaciones.length > 0 && (
                    <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {confirmedRegularizaciones.length}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
          
          {/* Conținut pentru Pending */}
          {activeRegularizacionSubtab === 'pending' && (
            <>
              {errorRegularizaciones && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {errorRegularizaciones}
                </div>
              )}

              {loadingRegularizaciones ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando regularizaciones pendientes...</p>
                </div>
              ) : (pendingRegularizaciones || []).length === 0 ? (
                <div className="text-center py-10">
                  <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-2xl">✅</div>
                  <div className="text-gray-800 font-semibold">No hay regularizaciones pendientes</div>
                  <div className="text-gray-500 text-sm">Cuando haya jornadas con horas extra declaradas, aparecerán aquí.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRegularizaciones.map((regularizacion, index) => {
                    const deltaMinutes = regularizacion.punched_minutes - regularizacion.scheduled_minutes;
                    const deltaFormatted = formatMinutesToHoursMinutes(Math.abs(deltaMinutes));
                    const isMore = deltaMinutes > 0;
                    const punchedFormatted = formatMinutesToHoursMinutes(regularizacion.punched_minutes);
                    const scheduledFormatted = formatMinutesToHoursMinutes(regularizacion.scheduled_minutes);
                    const workdayDate = new Date(regularizacion.workday_date).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    
                    return (
                      <div key={regularizacion.id} className="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">
                                Empleado: {regularizacion.employee_codigo}
                                {getEmpleadoNombre(regularizacion.employee_codigo) && (
                                  <span className="ml-2 text-gray-600 font-normal">- {getEmpleadoNombre(regularizacion.employee_codigo)}</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">Fecha: {workdayDate}</div>
                              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Horas fichadas:</span>
                                  <span className="ml-2 font-semibold text-blue-600">{punchedFormatted}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Horas previstas:</span>
                                  <span className="ml-2 font-semibold text-green-600">{scheduledFormatted}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Diferencia:</span>
                                  <span className={`ml-2 font-bold ${isMore ? 'text-orange-600' : 'text-red-600'}`}>
                                    {isMore ? '+' : '-'}{deltaFormatted}
                                  </span>
                                </div>
                              </div>
                              {/* Afișează reason_code pentru a ști motivul regularizării */}
                              {regularizacion.reason_code && (
                                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 p-2 rounded">
                                  <span className="font-medium text-blue-800">Motivo:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">
                                    {regularizacion.reason_code === 'employee_confirmed_no_extra' && '✅ Empleado confirmó: No trabajó de más'}
                                    {regularizacion.reason_code === 'employee_confirmed_punch_error' && '✅ Empleado confirmó: Error de fichaje'}
                                    {regularizacion.reason_code === 'employee_confirmed_worked_less' && '✅ Empleado confirmó: Trabajó de menos'}
                                    {regularizacion.reason_code === 'employee_declares_extra' && '⚠️ Empleado declara: Trabajó de más'}
                                    {regularizacion.reason_code === 'employee_declares_less' && '⚠️ Empleado declara: Trabajó de menos'}
                                    {regularizacion.reason_code === 'AUSENCIA_INJUSTIFICADA' && '❌ Ausencia injustificada'}
                                    {regularizacion.reason_code === 'OLVIDO_FICHAR' && '⚠️ Olvidó fichar'}
                                    {regularizacion.reason_code === 'OTRO' && '📝 Otro motivo'}
                                    {!['employee_confirmed_no_extra', 'employee_confirmed_punch_error', 'employee_confirmed_worked_less', 'employee_declares_extra', 'employee_declares_less', 'AUSENCIA_INJUSTIFICADA', 'OLVIDO_FICHAR', 'OTRO'].includes(regularizacion.reason_code) && regularizacion.reason_code}
                                  </span>
                                </div>
                              )}
                              {regularizacion.notes && (
                                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                  <span className="font-medium">Notas:</span> {regularizacion.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleApproveRegularizacion(regularizacion)} 
                              disabled={processingAction} 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Aprobar
                            </Button>
                            <Button 
                              onClick={() => handleRejectRegularizacion(regularizacion)} 
                              disabled={processingAction} 
                              variant="outline" 
                              size="sm" 
                              className="border-red-600 text-red-600 hover:bg-red-50"
                            >
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Conținut pentru Confirmed */}
          {activeRegularizacionSubtab === 'confirmed' && (
            <>
              {errorConfirmedRegularizaciones && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {errorConfirmedRegularizaciones}
                </div>
              )}

              {loadingConfirmedRegularizaciones ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando regularizaciones confirmadas...</p>
                </div>
              ) : (confirmedRegularizaciones || []).length === 0 ? (
                <div className="text-center py-10">
                  <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl">📋</div>
                  <div className="text-gray-800 font-semibold">No hay regularizaciones confirmadas</div>
                  <div className="text-gray-500 text-sm">Las regularizaciones confirmadas aparecerán aquí.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {confirmedRegularizaciones.map((regularizacion, index) => {
                    const punchedFormatted = formatMinutesToHoursMinutes(regularizacion.punched_minutes);
                    const scheduledFormatted = formatMinutesToHoursMinutes(regularizacion.scheduled_minutes);
                    const effectiveFormatted = regularizacion.effective_minutes ? formatMinutesToHoursMinutes(regularizacion.effective_minutes) : 'N/A';
                    const workdayDate = new Date(regularizacion.workday_date).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    const confirmedDate = regularizacion.confirmed_at ? new Date(regularizacion.confirmed_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A';
                    
                    return (
                      <div key={regularizacion.id} className="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">
                                Empleado: {regularizacion.employee_codigo}
                                {getEmpleadoNombre(regularizacion.employee_codigo) && (
                                  <span className="ml-2 text-gray-600 font-normal">- {getEmpleadoNombre(regularizacion.employee_codigo)}</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">Fecha: {workdayDate}</div>
                              <div className="text-xs text-gray-400 mt-1">Confirmada: {confirmedDate}</div>
                              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Horas fichadas:</span>
                                  <span className="ml-2 font-semibold text-blue-600">{punchedFormatted}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Horas previstas:</span>
                                  <span className="ml-2 font-semibold text-green-600">{scheduledFormatted}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Horas efectivas:</span>
                                  <span className="ml-2 font-bold text-green-700">{effectiveFormatted}</span>
                                </div>
                              </div>
                              {/* Afișează reason_code pentru regularizările confirmate */}
                              {regularizacion.reason_code && (
                                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 p-2 rounded">
                                  <span className="font-medium text-blue-800">Motivo:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">
                                    {regularizacion.reason_code === 'employee_confirmed_no_extra' && '✅ Empleado confirmó: No trabajó de más'}
                                    {regularizacion.reason_code === 'employee_confirmed_punch_error' && '✅ Empleado confirmó: Error de fichaje'}
                                    {regularizacion.reason_code === 'employee_confirmed_worked_less' && '✅ Empleado confirmó: Trabajó de menos'}
                                    {regularizacion.reason_code === 'employee_declares_extra' && '⚠️ Empleado declara: Trabajó de más'}
                                    {regularizacion.reason_code === 'employee_declares_less' && '⚠️ Empleado declara: Trabajó de menos'}
                                    {regularizacion.reason_code === 'AUSENCIA_INJUSTIFICADA' && '❌ Ausencia injustificada'}
                                    {regularizacion.reason_code === 'OLVIDO_FICHAR' && '⚠️ Olvidó fichar'}
                                    {regularizacion.reason_code === 'OTRO' && '📝 Otro motivo'}
                                    {!['employee_confirmed_no_extra', 'employee_confirmed_punch_error', 'employee_confirmed_worked_less', 'employee_declares_extra', 'employee_declares_less', 'AUSENCIA_INJUSTIFICADA', 'OLVIDO_FICHAR', 'OTRO'].includes(regularizacion.reason_code) && regularizacion.reason_code}
                                  </span>
                                </div>
                              )}
                              {regularizacion.notes && (
                                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                  <span className="font-medium">Notas:</span> {regularizacion.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center">
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              ✅ Confirmada
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      )}

      {/* Modal de detalles */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Detalles de modificación"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Empleado</label>
                <p className="text-gray-900">{selectedItem.NOMBRE || selectedItem.nombre || selectedItem.CORREO_ELECTRONICO || selectedItem.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Campo modificado</label>
                <p className="text-gray-900 font-bold">{selectedItem.CAMPO_MODIFICADO || selectedItem.campo}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Valor anterior</label>
                <p className="text-gray-500">{selectedItem.VALOR_ANTERIOR || selectedItem.valor_anterior || '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Valor nuevo</label>
                <p className="text-green-600 font-bold">{selectedItem.VALOR_NUEVO || selectedItem.valor_nuevo || selectedItem.valoare_noua}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Motivo del cambio</label>
                <p className="text-gray-900">{selectedItem.MOTIVO_CAMBIO || selectedItem.razon || selectedItem.RAZON || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha solicitud</label>
                <p className="text-gray-900">
                  {selectedItem.FECHA_SOLICITUD ? new Date(selectedItem.FECHA_SOLICITUD).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            {/* Checkbox "Enviar a Gestoria" în modal */}
            <div className="pt-4 border-t border-gray-200">
              <label htmlFor="enviar-gestoria-checkbox" className="flex items-center gap-3 cursor-pointer">
                <input
                  id="enviar-gestoria-checkbox"
                  name="enviar-gestoria"
                  type="checkbox"
                  checked={enviarAGestoriaMap[selectedItem.id || selectedItem.ID] || false}
                  onChange={(e) => {
                    const cambioId = selectedItem.id || selectedItem.ID;
                    setEnviarAGestoriaMap(prev => ({
                      ...prev,
                      [cambioId]: e.target.checked
                    }));
                  }}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  📧 Enviar a Gestoria
                </span>
              </label>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => handleApproveCambio(selectedItem)}
                disabled={processingAction}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Aprobar modificación
              </Button>
              <Button
                onClick={() => handleRejectCambio(selectedItem)}
                disabled={processingAction}
                variant="outline"
                className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
              >
                Rechazar modificación
              </Button>
              <Button
                onClick={() => setShowDetailsModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmare aprobare */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setCambioToApprove(null);
        }}
        title="Confirmar aprobación"
        size="lg"
      >
        {cambioToApprove && (
          <div className="flex flex-col">
            {/* Conținut scrollabil */}
            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-2 -mr-2">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ ¿Estás seguro que deseas aprobar esta modificación?
                </p>
                <p className="text-sm text-yellow-700">
                  Esta acción actualizará los datos del empleado y no se puede deshacer.
                </p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Empleado</label>
                  <p className="text-gray-900 font-semibold">{cambioToApprove.NOMBRE || cambioToApprove.nombre || 'N/A'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Campo modificado</label>
                  <p className="text-gray-900 font-semibold break-words">
                    {formatCamposForDisplay(cambioToApprove.campo || cambioToApprove.CAMPO_MODIFICADO)}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valor anterior</label>
                    <p className="text-gray-500 line-through break-words text-sm">{cambioToApprove.VALOR_ANTERIOR || cambioToApprove.valor_anterior || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valor nuevo</label>
                    <p className="text-green-600 font-bold break-words text-sm">{cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua || '—'}</p>
                  </div>
                </div>
                
                {cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Motivo del cambio</label>
                    <p className="text-gray-700 break-words text-sm">{cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON}</p>
                  </div>
                ) : null}
              </div>
            </div>
            
            {/* Footer fixat cu checkbox și butoane - întotdeauna vizibil */}
            <div className="flex-shrink-0 pt-4 mt-4 border-t border-gray-200 space-y-4 bg-white sticky bottom-0">
              {/* Checkbox "Enviar a Gestoria" în modalul de confirmare */}
              <div>
                <label htmlFor="enviar-gestoria-confirm-checkbox" className="flex items-center gap-3 cursor-pointer">
                  <input
                    id="enviar-gestoria-confirm-checkbox"
                    name="enviar-gestoria-confirm"
                    type="checkbox"
                    checked={enviarAGestoriaMap[cambioToApprove.id || cambioToApprove.ID] || false}
                    onChange={(e) => {
                      const cambioId = cambioToApprove.id || cambioToApprove.ID;
                      setEnviarAGestoriaMap(prev => ({
                        ...prev,
                        [cambioId]: e.target.checked
                      }));
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    📧 Enviar a Gestoria
                  </span>
                </label>
              </div>
              
              <div className="flex gap-3 pb-2">
                <Button
                  onClick={confirmApproveCambio}
                  disabled={processingAction}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processingAction ? 'Procesando...' : '✅ Sí, aprobar'}
                </Button>
                <Button
                  onClick={() => {
                    setShowApproveModal(false);
                    setCambioToApprove(null);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={processingAction}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal para motivo de rechazo */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setCambioToReject(null);
        }}
        title="Motivo del rechazo"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Explica por qué rechazas esta solicitud:</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Introduce el motivo del rechazo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={4}
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              onClick={confirmRejectCambio}
              disabled={processingAction || !rejectReason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {processingAction ? 'Procesando...' : 'Confirmar rechazo'}
            </Button>
            <Button
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
                setCambioToReject(null);
              }}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Modal de confirmare aprobare regularizare */}
      <Modal
        isOpen={showApproveRegularizacionModal}
        onClose={() => {
          setShowApproveRegularizacionModal(false);
          setRegularizacionToApprove(null);
        }}
        title="Confirmar aprobación de regularización"
        size="lg"
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
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ ¿Estás seguro que deseas aprobar esta regularización?
                </p>
                <p className="text-sm text-yellow-700">
                  {willUseScheduledMinutes 
                    ? `Se aprobarán las horas previstas (${formatMinutesToHoursMinutes(effectiveMinutes)}) como horas efectivas trabajadas.`
                    : effectiveMinutes > 0
                      ? `Se aprobarán las horas fichadas (${formatMinutesToHoursMinutes(effectiveMinutes)}) como horas efectivas trabajadas.`
                      : `Se aprobarán 0 horas efectivas trabajadas.`}
                </p>
              </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Empleado</label>
                <p className="text-gray-900 font-semibold">{regularizacionToApprove.employee_codigo}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                <p className="text-gray-900">
                  {new Date(regularizacionToApprove.workday_date).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Horas fichadas</label>
                  <p className="text-blue-600 font-bold">{formatMinutesToHoursMinutes(regularizacionToApprove.punched_minutes)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Horas previstas</label>
                  <p className="text-green-600 font-bold">{formatMinutesToHoursMinutes(regularizacionToApprove.scheduled_minutes)}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Diferencia</label>
                <p className={`font-bold ${regularizacionToApprove.punched_minutes > regularizacionToApprove.scheduled_minutes ? 'text-orange-600' : 'text-red-600'}`}>
                  {regularizacionToApprove.punched_minutes > regularizacionToApprove.scheduled_minutes ? '+' : '-'}
                  {formatMinutesToHoursMinutes(Math.abs(regularizacionToApprove.punched_minutes - regularizacionToApprove.scheduled_minutes))}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={confirmApproveRegularizacion}
                disabled={processingAction}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processingAction ? 'Procesando...' : '✅ Sí, aprobar'}
              </Button>
              <Button
                onClick={() => {
                  setShowApproveRegularizacionModal(false);
                  setRegularizacionToApprove(null);
                }}
                variant="outline"
                className="flex-1"
                disabled={processingAction}
              >
                Cancelar
              </Button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Modal para motivo de rechazo de regularizacion */}
      <Modal
        isOpen={showRejectRegularizacionModal}
        onClose={() => {
          setShowRejectRegularizacionModal(false);
          setRejectRegularizacionReason('');
          setCreateAusenciaOnReject(false);
          setRegularizacionToReject(null);
        }}
        title="Motivo del rechazo de regularización"
      >
        <div className="space-y-4">
          {regularizacionToReject && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Empleado:</span> {regularizacionToReject.employee_codigo}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Fecha:</span> {new Date(regularizacionToReject.workday_date).toLocaleDateString('es-ES')}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Horas fichadas:</span> {formatMinutesToHoursMinutes(regularizacionToReject.punched_minutes)}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Horas previstas:</span> {formatMinutesToHoursMinutes(regularizacionToReject.scheduled_minutes)}
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Explica por qué rechazas esta regularización:</label>
            <textarea
              value={rejectRegularizacionReason}
              onChange={(e) => setRejectRegularizacionReason(e.target.value)}
              placeholder="Introduce el motivo del rechazo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={4}
              required
            />
          </div>
          
          {/* Checkbox pentru crearea ausencia injustificada */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              type="checkbox"
              id="createAusenciaOnReject"
              checked={createAusenciaOnReject}
              onChange={(e) => setCreateAusenciaOnReject(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="createAusenciaOnReject" className="text-sm text-gray-700 cursor-pointer">
              <span className="font-medium">Registrar como Ausencia Injustificada</span>
              <p className="text-xs text-gray-600 mt-1">
                Si marcas esta opción, se creará automáticamente una ausencia injustificada para esta fecha.
              </p>
            </label>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              onClick={confirmRejectRegularizacion}
              disabled={processingAction || !rejectRegularizacionReason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {processingAction ? 'Procesando...' : 'Confirmar rechazo'}
            </Button>
            <Button
              onClick={() => {
                setShowRejectRegularizacionModal(false);
                setRejectRegularizacionReason('');
                setRegularizacionToReject(null);
              }}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

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