import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Card, Button, Modal, Notification } from '../components/ui';
import { Link } from 'react-router-dom';
import Back3DButton from '../components/Back3DButton.jsx';
import { API_ENDPOINTS } from '../utils/constants';
import { useAdminApi } from '../hooks/useAdminApi';
import activityLogger from '../utils/activityLogger';


export default function AprobacionesPage() {
  const { user: authUser } = useAuth();
  const { getPermissions } = useAdminApi();
  
  // State pentru cambios de datos
  const [pendingCambios, setPendingCambios] = useState([]);
  const [loadingCambios, setLoadingCambios] = useState(true);
  const [errorCambios, setErrorCambios] = useState('');
  
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

  const userGrupo = useMemo(() => authUser?.GRUPO || authUser?.grupo || 'Empleado', [authUser?.GRUPO, authUser?.grupo]);
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = useMemo(() => authUser?.isManager || false, [authUser?.isManager]);
  
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

  // Verifică dacă utilizatorul are permisiunea de acces
  const canAccess = useMemo(() => {
    // Dacă permisiunile sunt încă încărcare, așteaptă
    if (loadingPermissions) {
      return null; // null = încă verificăm
    }
    
    // Dacă avem permisiuni din backend, verificăm permisiunea 'aprobaciones'
    const hasBackendPermissions = userPermissions && Object.keys(userPermissions).length > 0;
    if (hasBackendPermissions) {
      const grupoKey = findGrupoKey(userGrupo, userPermissions);
      if (grupoKey) {
        return hasPermission('aprobaciones');
      }
    }
    
    // Fallback la verificarea veche (Manager/Supervisor)
    return isManager;
  }, [loadingPermissions, userPermissions, userGrupo, findGrupoKey, hasPermission, isManager]);

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
      setErrorCambios('Eroare la încărcarea modificărilor în așteptare.');
      setPendingCambios([]);
    } finally {
      setLoadingCambios(false);
    }
  }, [authUser?.isDemo]);

  useEffect(() => {
    // Așteaptă până când permisiunile sunt verificate
    if (canAccess === null) {
      return;
    }

    if (!canAccess) {
      setLoadingCambios(false);
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo aprobaciones data instead of fetching from backend');
      setDemoAprobaciones();
      return;
    }

    fetchPendingCambios();
  }, [canAccess, authUser?.isDemo, fetchPendingCambios]);

  const handleApproveCambio = (cambio) => {
    // Deschide modalul de confirmare
    setCambioToApprove(cambio);
    setShowApproveModal(true);
  };

  // Helper pentru a extrage numele câmpului din string-ul formatat
  const extractCampoName = (campoString) => {
    if (!campoString) return campoString;
    
    // Dacă string-ul conține ":" sau "→", extrage doar partea dinainte
    // Ex: "D.N.I. / NIE: \"Demo2024\" → \"DemoDNI\"" => "D.N.I. / NIE"
    if (campoString.includes(':')) {
      return campoString.split(':')[0].trim();
    }
    
    // Dacă string-ul conține "→", extrage doar partea dinainte
    if (campoString.includes('→')) {
      return campoString.split('→')[0].trim();
    }
    
    // Altfel, returnează string-ul original
    return campoString.trim();
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
      // Extrage numele câmpului curat (fără formatare)
      const campoRaw = cambioToApprove.CAMPO_MODIFICADO || cambioToApprove.campo || '';
      const campoName = extractCampoName(campoRaw);
      
      // Pregătesc datele în formatul cerut pentru backend
      const approvalData = {
        id: cambioToApprove.id || cambioToApprove.ID,
        codigo: cambioToApprove.codigo || cambioToApprove.CODIGO,
        email: cambioToApprove.CORREO_ELECTRONICO,
        nombre: cambioToApprove.NOMBRE,
        campo: campoName, // Numele câmpului curat, fără formatare
        valor: cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua
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
          message: `Eroare la aprobarea modificării! Status: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error approving cambio:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Eroare la aprobarea modificării!'
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
          message: `Eroare la respingerea modificării! Status: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error rejecting cambio:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Eroare la respingerea modificării!'
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
        <div className="text-center">
          <div className="text-red-600 font-bold text-xl mb-4">No tienes permisos para esta página.</div>
          <Link to="/inicio" className="text-red-600 hover:text-red-700 underline">
            ← Volver al Inicio
          </Link>
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
          onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de aprobaciones', '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          title="Reportar error"
        >
          <span className="text-lg">📱</span>
          <span>Reportar error</span>
        </button>
      </div>

      {/* Chip de secțiune: doar Cambios de Datos */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-600 text-white text-sm font-semibold shadow">
          <span>📝</span> Cambios de Datos
        </span>
      </div>

      {/* Secțiunea Fichajes a fost eliminată */}

      {/* Conținut pentru Cambios de Datos */}
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input
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
      >
        {cambioToApprove && (
          <div className="space-y-4">
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
                <p className="text-gray-900 font-semibold">{cambioToApprove.CAMPO_MODIFICADO || cambioToApprove.campo || 'N/A'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor anterior</label>
                  <p className="text-gray-500 line-through">{cambioToApprove.VALOR_ANTERIOR || cambioToApprove.valor_anterior || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor nuevo</label>
                  <p className="text-green-600 font-bold">{cambioToApprove.VALOR_NUEVO || cambioToApprove.valoare_noua || '—'}</p>
                </div>
              </div>
              
              {cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Motivo del cambio</label>
                  <p className="text-gray-700">{cambioToApprove.MOTIVO_CAMBIO || cambioToApprove.razon || cambioToApprove.RAZON}</p>
                </div>
              ) : null}
            </div>
            
            {/* Checkbox "Enviar a Gestoria" în modalul de confirmare */}
            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
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
            
            <div className="flex gap-3 pt-4">
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