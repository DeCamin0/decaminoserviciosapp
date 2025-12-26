import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Card, Button, Modal, Notification } from '../components/ui';
import { Link } from 'react-router-dom';
import Back3DButton from '../components/Back3DButton.jsx';
import { API_ENDPOINTS } from '../utils/constants';


export default function AprobacionesPage() {
  const { user: authUser } = useAuth();
  
  // State pentru cambios de datos
  const [pendingCambios, setPendingCambios] = useState([]);
  const [loadingCambios, setLoadingCambios] = useState(true);
  const [errorCambios, setErrorCambios] = useState('');
  
  // State comun
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  
  // State pentru modal de respingere
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cambioToReject, setCambioToReject] = useState(null);
  
  // State pentru notificări
  const [notification, setNotification] = useState(null);

  // Verific dacă utilizatorul este manager
  const isManager = authUser?.isManager || authUser?.GRUPO === 'Manager' || authUser?.GRUPO === 'Supervisor';

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
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
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
    if (!isManager) {
      setLoadingCambios(false);
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo aprobaciones data instead of fetching from backend');
      setDemoAprobaciones();
      return;
    }

    fetchPendingCambios();
  }, [isManager, authUser?.isDemo, fetchPendingCambios]);

  const handleApproveCambio = async (cambio) => {
    // Skip real backend call in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Simulating cambio approval');
      setNotification({
        type: 'success',
        title: '¡Éxito! (DEMO)',
        message: 'Modificación aprobada con éxito! (Simulación DEMO)'
      });
      // Remove from demo list (simulate approval)
      setPendingCambios(prev => prev.filter(c => c.id !== cambio.id));
      return;
    }

    setProcessingAction(true);
    try {
      // Pregătesc datele în formatul cerut pentru backend
      const approvalData = {
        id: cambio.id || cambio.ID,
        codigo: cambio.codigo || cambio.CODIGO,
        email: cambio.CORREO_ELECTRONICO,
        nombre: cambio.NOMBRE,
        campo: cambio.CAMPO_MODIFICADO || cambio.campo,
        valor: cambio.VALOR_NUEVO || cambio.valoare_noua
      };

      console.log('Sending approval data:', approvalData);

      console.log('Making request to:', API_ENDPOINTS.APPROVE_CAMBIO);
      
      const response = await fetch(API_ENDPOINTS.APPROVE_CAMBIO, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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

      // Construiesc URL-ul cu query parameters pentru GET request
      const params = new URLSearchParams(rejectionData);
      const url = `${API_ENDPOINTS.REJECT_CAMBIO}?${params.toString()}`;
      
      console.log('Full URL with params:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        mode: 'cors'
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

  if (!isManager) {
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