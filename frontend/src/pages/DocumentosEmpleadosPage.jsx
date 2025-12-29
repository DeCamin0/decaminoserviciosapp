import { useState, useEffect, useRef, useCallback } from 'react';

import { useAuth } from '../contexts/AuthContextBase';

import ContractSigner from '../components/ContractSigner';

import { Link } from 'react-router-dom';

import Back3DButton from '../components/Back3DButton.jsx';
import ChangeEmployee3DButton from '../components/ChangeEmployee3DButton.jsx';

import { Button, Card, LoadingSpinner } from '../components/ui';

import Notification from '../components/ui/Notification';

import { routes } from '../utils/routes.js';
import { fetchAvatarOnce, getCachedAvatar, setCachedAvatar, DEFAULT_AVATAR } from '../utils/avatarCache';

import activityLogger from '../utils/activityLogger';
import NominasMatrixTab from '../components/gestoria/NominasMatrixTab';
import CostePersonalTab from '../components/gestoria/CostePersonalTab';

// Funcție pentru formatarea datelor în format frumos și consistent

const formatDate = (dateString) => {

  if (!dateString) return 'Sin fecha';

  

  try {

    // Încearcă să parsezi data în diferite formate

    let date;

    

    // Verifică dacă este deja un obiect Date

    if (dateString instanceof Date) {

      date = dateString;

    } else if (typeof dateString === 'string') {

      // Verifică dacă este un timestamp ISO

      if (dateString.includes('T') && dateString.includes('Z')) {

        date = new Date(dateString);

      } else if (dateString.includes('-') && dateString.includes(':')) {

        // Format: "2025-07-31 15:12:49"

        date = new Date(dateString.replace(' ', 'T'));

      } else {

        // Încearcă să parsezi ca Date normal

        date = new Date(dateString);

      }

    } else {

      date = new Date(dateString);

    }

    

    // Verifică dacă data este validă

    if (isNaN(date.getTime())) {

      return 'Fecha inválida';

    }

    

    // Formatează data în format românesc: dd/MM/yyyy HH:mm

    return date.toLocaleString('ro-RO', {

      year: 'numeric',

      month: '2-digit',

      day: '2-digit',

      hour: '2-digit',

      minute: '2-digit'

    });

  } catch (error) {

    console.error('Error formatting date:', error);

    return 'Fecha inválida';

  }

};


// Funcție pentru formatarea perioadei nóminas (luna + anul)

const formatPeriodo = (mes, año) => {



  

  if (!mes && !año) return null;

  if (!mes || !año) return `${mes || ''} ${año || ''}`.trim() || null;

  

  const nombresMeses = [

    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',

    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'

  ];

  

  // Dacă mes este un număr (0-11), îl convertim în nume

  if (typeof mes === 'number' && mes >= 0 && mes <= 11) {

    return `${nombresMeses[mes]} ${año}`;

  }

  

  // Dacă mes este deja un nume, îl folosim direct

  if (typeof mes === 'string' && mes.trim()) {

    return `${mes.trim()} ${año}`;

  }

  

  // Fallback

  return `${mes} ${año}`;

};



export default function DocumentosEmpleadosPage() {

  const { user: authUser } = useAuth();

  // Detectare platformă pentru PDF preview (aliniat cu DocumentosPage)
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);

  const [empleados, setEmpleados] = useState([]);

  const [selectedEmpleado, setSelectedEmpleado] = useState(null);

  const [empleadoDocumentos, setEmpleadoDocumentos] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  // State pentru avatares de empleados
  const [employeeAvatars, setEmployeeAvatars] = useState({});
  const [bulkAvatarsLoaded, setBulkAvatarsLoaded] = useState(false);
  const employeeAvatarsRef = useRef(employeeAvatars);
  const bulkAvatarsLoadedRef = useRef(false);

  const fetchBulkAvatars = useCallback(async () => {
    if (bulkAvatarsLoadedRef.current) {
      console.debug('[DocumentosEmpleados] Bulk avatars already loaded, skipping fetch');
      return;
    }

    if (authUser?.isDemo) {
      bulkAvatarsLoadedRef.current = true;
      setBulkAvatarsLoaded(true);
      return;
    }

    console.debug('[DocumentosEmpleados] Fetching bulk avatars...');
    try {
      // Adaugă token-ul JWT dacă există
      const headers = {
        'Content-Type': 'application/json'
      };
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getAvatarBulk, {
        method: 'POST',
        headers,
        body: JSON.stringify({ motivo: 'get' })
      });

      if (!response.ok) {
        console.warn('[DocumentosEmpleados] Bulk avatar fetch failed:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.debug('[DocumentosEmpleados] Bulk avatar response count:', Array.isArray(data) ? data.length : 'non-array');

      if (!Array.isArray(data) || data.length === 0) {
        return;
      }

      const avatarsMap = {};

      data.forEach(item => {
        if (!item) return;

        const codigo = item.CODIGO || item.codigo || item.codEmpleado || item.employeeCode;
        if (!codigo) return;

        const avatarB64 = item.AVATAR_B64 || item.avatar_b64 || item.avatarBase64;
        const avatarUrlField = item.AVATAR || item.avatar || item.url || item.imageUrl || item.imagen;

        let avatarUrl = null;

        if (avatarB64) {
          avatarUrl = `data:image/jpeg;base64,${String(avatarB64).replace(/\n/g, '')}`;
        } else if (avatarUrlField) {
          avatarUrl = avatarUrlField;
        }

        if (avatarUrl) {
          avatarsMap[codigo] = avatarUrl;
          setCachedAvatar(codigo, avatarUrl);
        } else {
          avatarsMap[codigo] = DEFAULT_AVATAR;
        }
      });

      console.debug('[DocumentosEmpleados] Bulk avatars mapped:', Object.keys(avatarsMap).length);

      if (Object.keys(avatarsMap).length > 0) {
        setEmployeeAvatars(prev => ({ ...avatarsMap, ...prev }));
      }
    } catch (error) {
      console.error('❌ [DocumentosEmpleados] Error fetching bulk avatars:', error);
    } finally {
      bulkAvatarsLoadedRef.current = true;
      setBulkAvatarsLoaded(true);
    }
  }, [authUser]);

  // Coada pentru încărcarea avatarurilor cu concurență limitată
  const AVATAR_CONCURRENCY = 2;
  const avatarQueueRef = useRef([]);
  const activeAvatarRequestsRef = useRef(0);
  const pendingAvatarRequestsRef = useRef(new Set());

  useEffect(() => {
    employeeAvatarsRef.current = employeeAvatars;
  }, [employeeAvatars]);

  useEffect(() => {
    fetchBulkAvatars();
  }, [fetchBulkAvatars]);

  useEffect(() => {
    if (!bulkAvatarsLoaded) return;

    empleados?.forEach(empleado => {
      if (!empleado?.CODIGO) return;

      const codigo = empleado.CODIGO;

      if (!Object.prototype.hasOwnProperty.call(employeeAvatarsRef.current, codigo)) {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: null }));
      }
    });
  }, [bulkAvatarsLoaded, empleados]);

  const loadEmployeeAvatar = useCallback(async (codigo, nombre) => {
    if (!codigo) return;

    if (Object.prototype.hasOwnProperty.call(employeeAvatarsRef.current, codigo)) {
      return;
    }
    if (pendingAvatarRequestsRef.current.has(codigo)) return;
    if (!bulkAvatarsLoadedRef.current) return;

    pendingAvatarRequestsRef.current.add(codigo);

    // Skip real avatar loading in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping loadEmployeeAvatar');
      pendingAvatarRequestsRef.current.delete(codigo);
      return;
    }

    try {
      const cachedPayload = getCachedAvatar(codigo);
      const cachedUrl = cachedPayload?.url || cachedPayload || null;
      if (cachedUrl) {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: cachedUrl }));
        return;
      }

      const avatarUrl = await fetchAvatarOnce({
        codigo,
        nombre: nombre || '',
        endpoint: routes.getAvatar,
      });

      if (avatarUrl) {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: avatarUrl }));
      } else {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: DEFAULT_AVATAR }));
      }
    } catch (error) {
      console.error(`❌ Error al cargar avatar para ${codigo}:`, error);
      setEmployeeAvatars(prev => ({ ...prev, [codigo]: DEFAULT_AVATAR }));
    } finally {
      pendingAvatarRequestsRef.current.delete(codigo);
    }
  }, [authUser]);

  const processAvatarQueue = useCallback(() => {
    if (!avatarQueueRef.current) return;
    while (activeAvatarRequestsRef.current < AVATAR_CONCURRENCY && avatarQueueRef.current.length > 0) {
      const next = avatarQueueRef.current.shift();
      if (!next) break;
      const { codigo, nombre } = next;
      activeAvatarRequestsRef.current += 1;
      loadEmployeeAvatar(codigo, nombre)
        .catch(() => {})
        .finally(() => {
          activeAvatarRequestsRef.current -= 1;
          processAvatarQueue();
        });
    }
  }, [loadEmployeeAvatar]);

  const enqueueAvatar = useCallback((codigo, nombre) => {
    if (!codigo) return;
    if (Object.prototype.hasOwnProperty.call(employeeAvatarsRef.current, codigo)) return;
    if (pendingAvatarRequestsRef.current.has(codigo)) return;
    if (avatarQueueRef.current.some(item => item.codigo === codigo)) return;
    console.debug('[DocumentosEmpleados] enqueueAvatar → fallback individual request for', codigo, nombre);
    avatarQueueRef.current.push({ codigo, nombre });
    processAvatarQueue();
  }, [processAvatarQueue]);

  useEffect(() => {
    if (!bulkAvatarsLoaded) return;

    empleados?.forEach(empleado => {
      if (
        empleado?.CODIGO &&
        !Object.prototype.hasOwnProperty.call(employeeAvatarsRef.current, empleado.CODIGO)
      ) {
        enqueueAvatar(empleado.CODIGO, empleado['NOMBRE / APELLIDOS']);
      }
    });
  }, [bulkAvatarsLoaded, empleados, enqueueAvatar]);

  const [activeTab, setActiveTab] = useState('empleados'); // 'empleados', 'gestoria-nominas', 'coste-personal', 'documentos', 'nominas', 'documentos-empresa', 'subir-documentos'

  const [uploading, setUploading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [documentType, setDocumentType] = useState('');

  const [documentTypes, setDocumentTypes] = useState({}); // Para tipos individuales por archivo

  

  // Estado para el modal de preview

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [previewDocument, setPreviewDocument] = useState(null);

  const [previewLoading, setPreviewLoading] = useState(false);

  const [previewError, setPreviewError] = useState(null);



  // Estado para el modal de confirmación de borrado

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const [nominaToDelete, setNominaToDelete] = useState(null);

  const [documentoToDelete, setDocumentoToDelete] = useState(null);

  const [documentoOficialToDelete, setDocumentoOficialToDelete] = useState(null);



    // Estado para nóminas

  const [nominas, setNominas] = useState([]);

  const [nominasLoading, setNominasLoading] = useState(false);

  const [nominasError, setNominasError] = useState(null);



  // Estado para documentos oficiales

  const [documentosOficiales, setDocumentosOficiales] = useState([]);

  const [documentosOficialesLoading, setDocumentosOficialesLoading] = useState(false);

  const [documentosOficialesError, setDocumentosOficialesError] = useState(null);



  // Estado para búsqueda de empleados

  const [searchTerm, setSearchTerm] = useState('');

  const [filteredEmpleados, setFilteredEmpleados] = useState([]);



  // Estado para diferentes tipos de upload

  const [uploadType, setUploadType] = useState('normal'); // 'normal', 'nomina' o 'oficial'

  const [showNominaUploadModal, setShowNominaUploadModal] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());



  // Estado para notificări

  const [notification, setNotification] = useState({

    show: false,

    type: 'success',

    title: '',

    message: '',

    duration: 5000

  });



  const fileInputRef = useRef(null);



  // Verifica si el usuario es manager o supervisor
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;



  // Funcție helper pentru afișarea notificărilor

  const showNotification = useCallback((type, title, message, duration = 5000) => {

    setNotification({

      show: true,

      type,

      title,

      message,

      duration

    });

  }, []);



  const hideNotification = () => {

    setNotification(prev => ({ ...prev, show: false }));

  };



  // Efecto para filtrar empleados cuando cambia el término de búsqueda

  useEffect(() => {

    if (empleados && empleados.length > 0) {

      if (!searchTerm.trim()) {

        setFilteredEmpleados(empleados);

      } else {

        const filtered = empleados.filter(empleado => {

          const searchLower = searchTerm.toLowerCase();

          const nombre = (empleado['NOMBRE / APELLIDOS'] || '').toLowerCase();

          const email = (empleado['CORREO ELECTRONICO'] || '').toLowerCase();

          const codigo = (empleado['CODIGO'] || '').toLowerCase();

          const grupo = (empleado['GRUPO'] || '').toLowerCase();

          

          return nombre.includes(searchLower) || 

                 email.includes(searchLower) || 

                 codigo.includes(searchLower) || 

                 grupo.includes(searchLower);

        });

        setFilteredEmpleados(filtered);

      }

    }

  }, [searchTerm, empleados]);



  // Demo empleados data for DocumentosEmpleadosPage
  const setDemoEmpleados = useCallback(() => {
    const demoEmpleados = [
      {
        'NOMBRE / APELLIDOS': 'Carlos Antonio Rodríguez',
        'CODIGO': 'ADM001',
        'CORREO ELECTRONICO': 'admin@demo.com',
        'GRUPO': 'Admin',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 123 456',
        'FECHA DE ALTA': '2023-01-15',
        'CARGO': 'Administrador del Sistema',
        'DEPARTAMENTO': 'Administración'
      },
      {
        'NOMBRE / APELLIDOS': 'María González López',
        'CODIGO': 'SUP002',
        'CORREO ELECTRONICO': 'maria.gonzalez@demo.com',
        'GRUPO': 'Supervisor',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 234 567',
        'FECHA DE ALTA': '2023-02-01',
        'CARGO': 'Supervisora de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Juan Pérez Martín',
        'CODIGO': 'EMP003',
        'CORREO ELECTRONICO': 'juan.perez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 345 678',
        'FECHA DE ALTA': '2023-03-15',
        'CARGO': 'Técnico de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Ana Sánchez Ruiz',
        'CODIGO': 'EMP004',
        'CORREO ELECTRONICO': 'ana.sanchez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 456 789',
        'FECHA DE ALTA': '2023-04-01',
        'CARGO': 'Técnica de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Pedro Martínez García',
        'CODIGO': 'EMP005',
        'CORREO ELECTRONICO': 'pedro.martinez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 567 890',
        'FECHA DE ALTA': '2023-05-15',
        'CARGO': 'Técnico de Mantenimiento',
        'DEPARTAMENTO': 'Mantenimiento'
      },
      {
        'NOMBRE / APELLIDOS': 'Laura Fernández Torres',
        'CODIGO': 'EMP006',
        'CORREO ELECTRONICO': 'laura.fernandez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 678 901',
        'FECHA DE ALTA': '2023-06-01',
        'CARGO': 'Técnica de Jardinería',
        'DEPARTAMENTO': 'Jardinería'
      }
    ];

    setEmpleados(demoEmpleados);
    setFilteredEmpleados(demoEmpleados);
  }, []);

  const fetchEmpleados = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo empleados data instead of fetching from backend');
      setDemoEmpleados();
      setLoading(false);
      return;
    }

    setLoading(true);

    setError(null);

    try {

      const response = await fetch(routes.getEmpleados, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });

      const data = await response.json();

      const empleadosData = Array.isArray(data) ? data : [];
      setEmpleados(empleadosData);

      // Cargar avatares para cada empleado (cu coadă)
      empleadosData.forEach(empleado => {
        if (empleado.CODIGO && empleado['NOMBRE / APELLIDOS']) {
          enqueueAvatar(empleado.CODIGO, empleado['NOMBRE / APELLIDOS']);
        }
      });

    } catch (e) {

      setEmpleados([]);

      setError('¡Error al cargar los empleados!');

    }

    setLoading(false);

  }, [authUser, setDemoEmpleados, enqueueAvatar]);



  useEffect(() => {

    if (!isManager) {

      setError('Acceso restringido. Solo los managers pueden acceder a esta página.');

      setLoading(false);

      return;

    }



    fetchEmpleados();

    activityLogger.logPageAccess('documentos-empleados', authUser);

  }, [authUser, isManager, fetchEmpleados]);



  const handleEmpleadoSelect = async (empleado) => {

    setSelectedEmpleado(empleado);

    setActiveTab('documentos');

    

    // Cargar documentos reales del empleado desde el backend

    await fetchEmpleadoDocumentos(empleado);

    

    // Cargar también nóminas del empleado para que aparezcan en el contador

    await fetchNominas(empleado);

  };



  const fetchEmpleadoDocumentos = useCallback(async (empleado) => {

    // Resetear la lista de documentos al inicio para evitar mostrar documentos de empleados anteriores

    setEmpleadoDocumentos([]);

    

    // Pequeña pausa para asegurar que el reset se ejecute antes del fetch

    await new Promise(resolve => setTimeout(resolve, 100));

    

    try {

      // Realizar llamada real al backend de PRODUCCIÓN para obtener documentos del empleado

      const empleadoId = empleado.CODIGO || empleado.id;

      const empleadoEmail = empleado['CORREO ELECTRONICO'] || empleado.email;

      

      if (!empleadoId && !empleadoEmail) {

        console.warn('No se puede obtener documentos: falta ID o email del empleado');

        setEmpleadoDocumentos([]);

        return;

      }



      // Enviar tanto ID como email al backend para mayor robustez

      let response;

      let url;

      

      if (empleadoId && empleadoEmail) {

        // Enviar ambos parámetros si están disponibles

        url = `${routes.getDocumentos}?empleadoId=${encodeURIComponent(empleadoId)}&email=${encodeURIComponent(empleadoEmail)}`;

      } else if (empleadoId) {

        // Solo ID si no hay email

        url = `${routes.getDocumentos}?empleadoId=${encodeURIComponent(empleadoId)}`;

      } else if (empleadoEmail) {

        // Solo email si no hay ID

        url = `${routes.getDocumentos}?email=${encodeURIComponent(empleadoEmail)}`;

      } else {

        // No hay ni ID ni email

        console.warn('No se puede obtener documentos: falta ID y email del empleado');

        setEmpleadoDocumentos([]);

        return;

      }
      

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {

        if (response.status === 404) {

          // No hay documentos para este empleado

          setEmpleadoDocumentos([]);

          return;

        }

        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);

      }

      

      const data = await response.json();



      

      // Procesar los documentos recibidos

      const documentosProcesados = Array.isArray(data) ? data : [];

      

      // Mapear los campos del backend a nuestro formato local

      const documentosMapeados = documentosProcesados

        .filter(doc => {

          // Solo incluir documentos que tengan un ID real del backend y al menos un nombre de archivo

          const hasRealId = doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId;

          const hasFileName = doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento;

          return hasRealId && hasFileName;

        })

        .map(doc => ({

          id: doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId,

          fileName: doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento,

          fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes,

          uploadDate: doc.uploadDate || doc.fecha_upload || doc.fecha || doc.created_at || doc.fecha_creacion || doc.fecha_subida || doc.upload_date || doc.createdAt || doc.fecha || doc.date,

          status: doc.status || doc.estado || doc.state || doc.estado_documento,

          tipo: doc.tipo || doc.tipo_documento || doc.categoria || doc.tipoDocumento || doc.categoria_documento || doc.document_type || doc.type || doc.category,

          backendId: doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId || null,

          empleadoId: doc.empleado_id || doc.empleadoId || doc.employee_id || empleadoId,

          empleadoEmail: doc.empleado_email || doc.empleadoEmail || doc.email || empleadoEmail,

          uploadedBy: doc.uploaded_by || doc.subido_por || doc.uploadedBy || doc.subidoPor || doc.user || doc.usuario || doc.autor || doc.creador,

          uploadedDate: doc.uploaded_date || doc.fecha_subida || doc.created_at || doc.fecha_creacion || doc.creation_date || doc.fecha_autor,
          // Adăugăm câmpurile pentru ID-uri separate
          doc_id: doc.doc_id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId,
          // Păstrăm și câmpul original id pentru compatibilitate
          originalId: doc.id

        }));

      

      // Ordenar documentos de más reciente a más antiguo

      const documentosOrdenados = documentosMapeados.sort((a, b) => {

        const fechaA = new Date(a.uploadDate || 0);

        const fechaB = new Date(b.uploadDate || 0);

        return fechaB - fechaA; // Orden descendente (más reciente primero)

      });

      

      // ASIGNAR LISTA NUEVA DIRECTAMENTE

      setEmpleadoDocumentos(documentosOrdenados);

      

      // Log de la acción

      await activityLogger.logAction('documentos_fetched', {

        empleado: empleado,

        totalDocumentos: documentosMapeados.length,

        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre

      });

      

    } catch (error) {

      console.error('Error cargando documentos:', error);

      

      // Log del error

      await activityLogger.logAction('documentos_fetch_error', {

        empleado: empleado,

        error: error.message,

        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre

      });

      

      setEmpleadoDocumentos([]);

      

      // Mostrar mensaje de error solo si no es un 404 (no hay documentos)

      if (!error.message.includes('404')) {

        showNotification('error', 'Error al cargar documentos', error.message);

      }

    }

  }, [authUser, showNotification]);



  const handleFileUpload = useCallback(async (event) => {

    const files = event.target.files;

    if (!files || files.length === 0) return;



    // Guardar los archivos seleccionados

    setSelectedFiles(Array.from(files));

    

    // Mostrar el modal correcto según el tipo de upload

    if (uploadType === 'nomina') {

      setShowNominaUploadModal(true);

    } else if (uploadType === 'oficial') {

      setShowUploadModal(true);

    } else {

      setShowUploadModal(true);

    }

    

    // Limpiar el input

    if (fileInputRef.current) {

      fileInputRef.current.value = '';

    }

  }, [uploadType]);



  // Efecto pentru încărcarea documentelor când se selectează un angajat

  useEffect(() => {

    if (selectedEmpleado && activeTab === 'empleados') {

      fetchEmpleadoDocumentos(selectedEmpleado);

    }

  }, [selectedEmpleado, activeTab, fetchEmpleadoDocumentos]);



  const handleUploadConfirm = async () => {



    

    // Verificări diferite pentru nóminas vs documente

    if (uploadType === 'nomina') {



      if (!selectedFiles || selectedFiles.length === 0) {

        showNotification('warning', 'Archivo requerido', 'Por favor selecciona al menos un archivo de nómina');

      return;

      }

      if (selectedMonth === undefined || selectedMonth === null) {

        showNotification('warning', 'Mes requerido', 'Por favor selecciona el mes de la nómina');

        return;

      }

      if (selectedYear === undefined || selectedYear === null) {

        showNotification('warning', 'Año requerido', 'Por favor selecciona el año de la nómina');

        return;

      }



    } else if (uploadType === 'oficial') {



      if (!selectedFiles || selectedFiles.length === 0) {

        showNotification('warning', 'Archivo requerido', 'Por favor selecciona al menos un archivo oficial');

        return;

      }

      // Verificar que todos los tipos estén completados

      if (!Object.values(documentTypes).every(type => type.trim())) {

        showNotification('warning', 'Tipos requeridos', 'Por favor completa el tipo de documento para todos los archivos');

        return;

      }



    } else {



      // Verificar que todos los tipos estén completados

      if (!Object.values(documentTypes).every(type => type && type.trim())) {

        showNotification('warning', 'Tipos requeridos', 'Por favor completa el tipo de documento para todos los archivos');

        return;

      }



    }



    setUploading(true);

    try {

      // Crear FormData con el mismo formato que usa DocumentosPage.jsx

      const formData = new FormData();

      

      // Agregar el archivo PRIMERO (esto es lo más importante)

      selectedFiles.forEach((file, index) => {

        formData.append(`archivo_${index}`, file);

      });

      

      // Agregar metadatos del empleado

      formData.append('empleado_id', selectedEmpleado.CODIGO || selectedEmpleado.id);

      formData.append('empleado_nombre', selectedEmpleado['NOMBRE / APELLIDOS'] || 'Nombre no disponible');

      formData.append('empleado_email', selectedEmpleado['CORREO ELECTRONICO'] || '');

      // Agregar tipos individuales por archivo

      selectedFiles.forEach((file, index) => {

        formData.append(`tipo_documento_${index}`, documentTypes[index] || 'Sin especificar');

      });

      formData.append('fecha_upload', new Date().toLocaleString('es-ES', {

        year: 'numeric',

        month: '2-digit',

        day: '2-digit',

        hour: '2-digit',

        minute: '2-digit',

        second: '2-digit',

        timeZone: 'Europe/Madrid'

      }));

      formData.append('status', 'disponible');

      formData.append('uploaded_by', authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Empleado');

      formData.append('uploaded_by_id', authUser?.CODIGO || authUser?.id || 'N/A');

      formData.append('uploaded_by_role', authUser?.GRUPO || authUser?.role || 'EMPLEADOS');

      

      // Agregar información adicional del empleado

      formData.append('empleado_grupo', authUser?.GRUPO || '');

      formData.append('empleado_centro', authUser?.['CENTRO TRABAJO'] || authUser?.CENTRO || '');

      formData.append('empleado_departamento', authUser?.DEPARTAMENTO || '');

      

      // Agregar metadatos del archivo

      formData.append('total_archivos', selectedFiles.length.toString());

      selectedFiles.forEach((file, index) => {

        formData.append(`archivo_${index}_nombre`, file.name);

        formData.append(`archivo_${index}_tamaño`, file.size.toString());

        formData.append(`archivo_${index}_tipo`, file.type);

        formData.append(`archivo_${index}_ultima_modificacion`, new Date(file.lastModified).toISOString());

      });



      // Realizar la llamada al backend según el tipo de upload

      let endpoint;

      let formDataToSend;

      

      if (uploadType === 'nomina') {

        // Para nóminas, usar endpoint específico y FormData diferente

        endpoint = routes.uploadNomina;

        

        

        // Crear FormData específico para nóminas

        formDataToSend = new FormData();

        formDataToSend.append('nombre_empleado', selectedEmpleado['NOMBRE / APELLIDOS'] || 'Nombre no disponible');

        formDataToSend.append('fecha_upload', new Date().toLocaleString('es-ES', {

          year: 'numeric',

          month: '2-digit',

          day: '2-digit',

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit',

          timeZone: 'Europe/Madrid'

        }));

        

        // Convertir el índice del mes (0-11) al nombre del mes en español

        const nombresMeses = [

          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',

          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'

        ];

        const nombreMes = nombresMeses[selectedMonth || 0];

        formDataToSend.append('mes', nombreMes);

        formDataToSend.append('año', selectedYear);

        

        // Agregar cada archivo

        selectedFiles.forEach((file, index) => {

          formDataToSend.append(`archivo_${index}`, file);

        });

        

        console.log('📤 Datos de nómina enviados:', {

          nombre_empleado: selectedEmpleado['NOMBRE / APELLIDOS'],

          fecha_upload: new Date().toLocaleString('es-ES', {

            year: 'numeric',

            month: '2-digit',

            day: '2-digit',

            hour: '2-digit',

            minute: '2-digit',

            second: '2-digit',

            timeZone: 'Europe/Madrid'

          }),

          mes_indice: selectedMonth,

          mes_nombre: nombreMes,

          año: selectedYear,

          archivos: selectedFiles.map(f => f.name)

        });

        

        // Log del FormData para debugging

        for (let [key, value] of formDataToSend.entries()) {

          console.log(`FormData - ${key}:`, value);

        }

      } else if (uploadType === 'oficial') {

        // Para documentos oficiales, usar endpoint específico y FormData similar a nóminas

        endpoint = routes.uploadDocumentoOficial;

        console.log('🏢 Enviando DOCUMENTO OFICIAL al endpoint:', endpoint);

        console.log('🔧 routes.uploadDocumentoOficial value:', routes.uploadDocumentoOficial);

        console.log('🔧 BASE_URL debug:', import.meta.env.DEV ? 'DEVELOPMENT (empty)' : 'PRODUCTION');

        console.log('👤 Empleado seleccionado:', selectedEmpleado);

        console.log('📁 Archivos seleccionados:', selectedFiles);

        

        // Crear FormData específico para documentos oficiales

        formDataToSend = new FormData();

        formDataToSend.append('empleado_id', selectedEmpleado.CODIGO || selectedEmpleado.id || '');

        formDataToSend.append('correo_electronico', selectedEmpleado['CORREO ELECTRONICO'] || '');

        formDataToSend.append('nombre_empleado', selectedEmpleado['NOMBRE / APELLIDOS'] || 'Nombre no disponible');

        formDataToSend.append('fecha_creacion', new Date().toLocaleString('es-ES', {

          year: 'numeric',

          month: '2-digit',

          day: '2-digit',

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit',

          timeZone: 'Europe/Madrid'

        }));

        

        // Agregar cada archivo con nombre específico y tipo individual

        selectedFiles.forEach((file, index) => {

          formDataToSend.append(`nombre_archivo_${index}`, file.name);

          formDataToSend.append(`tipo_documento_${index}`, documentTypes[index] || 'Sin especificar');

          formDataToSend.append(`archivo_${index}`, file);

        });

        

        const fechaCreacion = new Date().toLocaleString('es-ES', {

          year: 'numeric',

          month: '2-digit',

          day: '2-digit',

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit',

          timeZone: 'Europe/Madrid'

        });

        

        console.log('📤 Datos de documento oficial enviados:', {

          empleado_id: selectedEmpleado.CODIGO || selectedEmpleado.id,

          correo_electronico: selectedEmpleado['CORREO ELECTRONICO'],

          nombre_empleado: selectedEmpleado['NOMBRE / APELLIDOS'],

          fecha_creacion: fechaCreacion,

          archivos: selectedFiles.map((f, index) => ({

            nombre: f.name,

            tipo: documentTypes[index] || 'Sin especificar'

          }))

        });

        

        // Log del FormData para debugging

        for (let [key, value] of formDataToSend.entries()) {

          console.log(`FormData - ${key}:`, value);

        }

      } else {

        // Para documentos normales, usar endpoint y FormData original

        endpoint = routes.uploadDocumento;

        formDataToSend = formData;

        console.log('📄 Enviando documento NORMAL al endpoint:', endpoint);

        console.log('📤 FormData para documentos normales:', formData);

      }



      console.log('🌐 Enviando request al endpoint:', endpoint);

      console.log('📤 FormData a enviar:', formDataToSend);

      console.log('🚀 About to fetch URL:', endpoint);

      console.log('🚀 URL type:', typeof endpoint);

      console.log('🚀 URL length:', endpoint?.length);

      // Add JWT token to headers for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {};
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }
      // Don't set Content-Type - browser will set it automatically for FormData with boundary

      const response = await fetch(endpoint, {

        method: 'POST',

        headers: fetchHeaders,

        body: formDataToSend,

        // No incluir Content-Type header, dejar que el navegador lo establezca automáticamente para FormData

      });

      

      console.log('📥 Response status:', response.status);

      console.log('📥 Response ok:', response.ok);



      console.log('🌐 Enviando documentos al endpoint:', endpoint);

      console.log('📤 Datos enviados:', {

        empleado: selectedEmpleado['NOMBRE / APELLIDOS'],

        empleado_id: selectedEmpleado.CODIGO || selectedEmpleado.id,

        empleado_email: selectedEmpleado['CORREO ELECTRONICO'] || 'No disponible',

        tipos: Object.values(documentTypes),

        uploadType: uploadType,

        archivos: selectedFiles.map((f, index) => ({

          nombre: f.name,

          tipo: documentTypes[index] || 'Sin especificar'

        })),

        totalArchivos: selectedFiles.length

      });

      console.log('🔗 Endpoint utilizado:', endpoint);



      if (!response.ok) {

        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);

      }



      const result = await response.json();

      console.log('Respuesta del backend:', result);



      // Crear objetos de documento para el estado local

      const uploadedFilesArray = selectedFiles.map((file, index) => ({

        id: result.documento_ids?.[index] || result.documentoIds?.[index] || result.document_ids?.[index] || result.documentIds?.[index],

        fileName: file.name,

        fileSize: file.size,

        uploadDate: result.fecha_upload || result.fecha_subida || result.created_at || result.fecha_creacion,

        status: result.status || result.estado || 'No especificado',

        tipo: uploadType === 'nomina' ? 'Nómina' : (result.tipo || result.tipo_documento || result.categoria || documentTypes[index] || 'Sin especificar'),

        // Adăugăm mes și año pentru nóminas

        ...(uploadType === 'nomina' && {

          mes: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth],

          año: selectedYear

        }),

        originalFile: file,

        backendId: result.documento_ids?.[index] || result.documentoIds?.[index] || result.document_ids?.[index] || result.documentIds?.[index] || null,

        empleadoId: result.empleado_id || result.empleadoId || selectedEmpleado.CODIGO || selectedEmpleado.id

      }));



      // Actualizar el estado local

      setEmpleadoDocumentos(prev => [...prev, ...uploadedFilesArray]);

      

      // Log la acción

      await activityLogger.logAction('documento_upload', {

        action: 'upload_success',

        empleado: selectedEmpleado,

        files: uploadedFilesArray.map(f => f.fileName),

        documentType: documentType,

        uploadType: uploadType,

        backendResponse: result,

        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre

      });



      if (uploadType === 'nomina') {

        showNotification('success', '¡Nómina subida!', 'La nómina se ha subido correctamente al servidor');

      } else if (uploadType === 'oficial') {

        showNotification('success', '¡Documentos oficiales subidos!', 'Los documentos oficiales se han subido correctamente al servidor');

      } else {

        showNotification('success', '¡Documentos subidos!', 'Los documentos se han subido correctamente al servidor');

      }

      

      // Limpiar el modal según el tipo de upload

      if (uploadType === 'nomina') {

        setShowNominaUploadModal(false);

        setSelectedMonth(new Date().getMonth());

        setSelectedYear(new Date().getFullYear());

      } else if (uploadType === 'oficial') {

      setShowUploadModal(false);

      setDocumentType('');

      } else {

        setShowUploadModal(false);

        setDocumentType('');

      }

      setSelectedFiles([]);

      

    } catch (error) {

      console.error('Error subiendo documentos:', error);

      

      // Log del error

      await activityLogger.logAction('documento_upload_error', {

        action: 'upload_error',

        empleado: selectedEmpleado,

        files: selectedFiles.map(f => f.name),

        documentType: documentType,

          uploadType: uploadType,

        error: error.message,

        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre

      });



      if (uploadType === 'nomina') {

        showNotification('error', 'Error al subir nómina', error.message);

      } else if (uploadType === 'oficial') {

        showNotification('error', 'Error al subir documentos oficiales', error.message);

      } else {

        showNotification('error', 'Error al subir documentos', error.message);

      }

    } finally {

      setUploading(false);

    }

  };



  const handleUploadCancel = () => {

    setShowUploadModal(false);

    setSelectedFiles([]);

    setDocumentType('');

    setDocumentTypes({});

  };



  // Función para abrir el preview de un documento

  const handlePreviewDocument = async (documento) => {

    setPreviewDocument(documento);

    setShowPreviewModal(true);

    setPreviewLoading(true);

    setPreviewError(null);

    

    try {

      // Detectar si es una nómina, documento oficial o documento normal

      const isNomina = documento.tipo === 'Nómina';

      

      // Oficial doar dacă e pe tab-ul de Documentos Oficiales sau are flag explicit
      const isDocumentoOficial = activeTab === 'documentos-empresa' || documento.esOficial === true;

      

      let previewUrl;

      if (isNomina) {

        // Usar endpoint de nóminas

        previewUrl = `${routes.downloadNomina}?id=${documento.doc_id || documento.id}&nombre=${encodeURIComponent(selectedEmpleado['NOMBRE / APELLIDOS'] || '')}`;

        console.log('📄 Preview nómina (empleados):', previewUrl);

        // Para nóminas, no confiamos en el nombre del archivo (no tiene extensión)
        // Detectamos por Content-Type del endpoint y generamos preview acorde
        try {
          // Add JWT token for backend API calls
          const token = localStorage.getItem('auth_token');
          const fetchHeaders = { 'cache': 'no-store' };
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
          }
          const resp = await fetch(previewUrl, { headers: fetchHeaders });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const contentType = resp.headers.get('content-type') || '';
          console.log('🔍 Nómina Content-Type:', contentType);
          const blob = await resp.blob();
          if (blob.size === 0) throw new Error('Blob vacío para nómina');

          if (contentType.includes('application/pdf')) {
            const url = (isIOS || isAndroid)
              ? `data:application/pdf;base64,${await blobToBase64(blob)}`
              : URL.createObjectURL(blob);
            console.log('✅ Nómina PDF -> URL listo');
            setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina', isPdf: true, isImage: false });
          } else if (contentType.startsWith('image/')) {
            const url = URL.createObjectURL(blob);
            console.log('✅ Nómina IMAGEN -> URL listo');
            setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina', isImage: true, isPdf: false });
          } else if (contentType.includes('application/json')) {
            // Intentar segundo fetch forzando Accept según PDF primero y luego imagen
            try {
              const secondPdf = await fetch(previewUrl, { headers: { 'Accept': 'application/pdf' }, cache: 'no-store' });
              if (secondPdf.ok) {
                const b2 = await secondPdf.blob();
                if (b2.size > 0) {
                  const url = (isIOS || isAndroid)
                    ? `data:application/pdf;base64,${await blobToBase64(b2)}`
                    : URL.createObjectURL(b2);
                  setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina', isPdf: true, isImage: false });
                } else {
                  throw new Error('Blob vacío tras segundo fetch PDF');
                }
              } else {
                const secondImg = await fetch(previewUrl, { headers: { 'Accept': 'image/*' }, cache: 'no-store' });
                if (secondImg.ok) {
                  const b3 = await secondImg.blob();
                  if (b3.size > 0) {
                    const url = URL.createObjectURL(b3);
                    setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina', isImage: true, isPdf: false });
                  } else {
                    throw new Error('Blob vacío tras segundo fetch imagen');
                  }
                } else {
                  throw new Error(`HTTP ${secondImg.status} en segundo fetch imagen`);
                }
              }
            } catch (secErr) {
              console.error('❌ Error preparando nómina desde JSON:', secErr);
              setPreviewDocument({ ...documento, previewUrl });
            }
          } else {
            // Fallback genérico: mostrar blob como objeto
            const url = URL.createObjectURL(blob);
            setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina' });
          }
          setPreviewLoading(false);
          setPreviewError(null);
          return;
        } catch (errNomina) {
          console.error('❌ Error preparando preview de nómina:', errNomina);
          setPreviewDocument({ ...documento, previewUrl });
          setPreviewLoading(false);
          return;
        }

      } else if (isDocumentoOficial) {

        // Usar endpoint de documentos oficiales

        previewUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}`;

        console.log('🔍 Construyendo URL para documento oficial:');

        console.log('  - ID (id din backend):', documento.id);
        console.log('  - Doc ID (doc_id din backend):', documento.doc_id);

        console.log('  - Email:', selectedEmpleado['CORREO ELECTRONICO']);

        console.log('  - FileName:', documento.fileName);

        console.log('  - URL final:', previewUrl);

      } else {

        // Pentru documente normale folosim endpoint-ul standard de descărcare

        previewUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;

        console.log('📄 Preview para documento normal (empleados):', previewUrl);
        console.log('  - ID (empleado_id):', documento.id);
        console.log('  - Doc ID (document_id):', documento.doc_id);
        console.log('  - Email:', selectedEmpleado['CORREO ELECTRONICO']);
        console.log('  - FileName:', documento.fileName);

      }

      

      console.log('🔍 Abriendo preview del documento:', previewUrl);

      console.log('🔍 Tipo de documento detectado:', documento.tipo);

      console.log('🔍 isDocumentoOficial:', isDocumentoOficial);

      console.log('🔍 isNomina:', isNomina);

      console.log('🔍 Documento completo:', documento);

      

      // Guardar el previewUrl en el documento para que el modal lo use
      // NOTA: pentru PDF amânăm setarea până după validare (evităm iframe pe URL greșit)
      const isPdfFile = documento.fileName?.toLowerCase().endsWith('.pdf');
      if (!isPdfFile) {
        setPreviewDocument({ ...documento, previewUrl });
      }

      // PDF: descargar como blob (igual que en otras secciones) y crear URL local
      if (isPdfFile) {
        try {
          console.log('📄 PDF detectado: descargando como blob para preview (mismo flujo que DocumentosPage)...');
          
          // Add JWT token for backend API calls
          const token = localStorage.getItem('auth_token');
          const fetchHeaders = { 'cache': 'no-store' };
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
          }
          
          const resp = await fetch(previewUrl, { headers: fetchHeaders });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          const contentType = resp.headers.get('content-type');
          console.log('🔍 Content-Type detectado:', contentType);
          if (contentType && contentType.includes('application/pdf')) {
            const blob = await resp.blob();
            console.log('🔍 Blob size:', blob.size);
            if (blob.size === 0) throw new Error('PDF vacío (0 bytes)');
            // Pentru Android, folosim blob URL (mai stabil decât base64)
            // Pentru iOS, încă folosim base64 pentru compatibilitate
            const url = isIOS 
              ? `data:application/pdf;base64,${await blobToBase64(blob)}`
              : URL.createObjectURL(blob);
            console.log('✅ URL creado para PDF:', isIOS ? 'base64' : 'blob');
            setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
          } else if (contentType && contentType.includes('application/json')) {
            console.warn('⚠️ El endpoint retorna JSON en lugar de PDF!');
            try {
              // Clonăm răspunsul pentru a putea citi atât text/JSON cât și blob ulterior
              const cloneForBlob = resp.clone();
              const responseText = await resp.text();
              if (responseText && responseText.trim().length > 0) {
                const data = JSON.parse(responseText);
                if (data?.success && data?.pdfUrl) {
                  setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: data.pdfUrl }));
                } else {
                  // Dacă JSON-ul nu conține URL, încearcă să creezi blob din clonă
                  const blob = await cloneForBlob.blob();
                  if (blob.size > 0) {
                    const url = (isIOS || isAndroid)
                      ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                      : URL.createObjectURL(blob);
                    setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
                  } else {
                    // Ultim fallback: al doilea fetch cu Accept: application/pdf
                    const second = await fetch(previewUrl, { headers: { 'Accept': 'application/pdf' }, cache: 'no-store' });
                    if (second.ok) {
                      const b2 = await second.blob();
                      if (b2.size > 0) {
                        const url = (isIOS || isAndroid)
                          ? `data:application/pdf;base64,${await blobToBase64(b2)}`
                          : URL.createObjectURL(b2);
                        setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
                      } else {
                        throw new Error('Blob vacío tras segundo fetch');
                      }
                    } else {
                      throw new Error(`HTTP ${second.status} en segundo fetch`);
                    }
                  }
                }
              } else {
                // JSON gol: încearcă blob din clonă sau al doilea fetch
                const blob = await cloneForBlob.blob();
                if (blob.size > 0) {
                  const url = (isIOS || isAndroid)
                    ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                    : URL.createObjectURL(blob);
                  setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
                } else {
                  const second = await fetch(previewUrl, { headers: { 'Accept': 'application/pdf' }, cache: 'no-store' });
                  if (second.ok) {
                    const b2 = await second.blob();
                    if (b2.size > 0) {
                      const url = (isIOS || isAndroid)
                        ? `data:application/pdf;base64,${await blobToBase64(b2)}`
                        : URL.createObjectURL(b2);
                      setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
                    } else {
                      throw new Error('Blob vacío tras segundo fetch');
                    }
                  } else {
                    throw new Error(`HTTP ${second.status} en segundo fetch`);
                  }
                }
              }
            } catch (je) {
              console.error('❌ Error procesando JSON/segundo fetch:', je);
              setPreviewDocument(prev => ({ ...(prev || documento), previewUrl }));
            }
          } else {
            // Fallback como en DocumentosPage
            const blob = await resp.blob();
            if (blob.size > 0) {
              const url = (isIOS || isAndroid)
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              console.log('✅ Fallback URL creado para PDF:', isIOS || isAndroid ? 'base64' : 'blob');
              setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: url }));
            } else {
              throw new Error('Blob vacío');
            }
          }
          setPreviewLoading(false);
          setPreviewError(null);
          return;
        } catch (e) {
          console.error('Error al descargar PDF como blob:', e);
          // Fallback: abrir URL directo por si el navegador lo maneja
          setPreviewDocument(prev => ({ ...(prev || documento), previewUrl }));
          setPreviewLoading(false);
          setPreviewError(null);
          return;
        }
      }

      

      // Para archivos de texto, intentar obtener el contenido

      if (documento.fileName?.toLowerCase().endsWith('.txt')) {

        const response = await fetch(previewUrl);

        if (response.ok) {

          const textContent = await response.text();

          setPreviewDocument({ ...documento, content: textContent, previewUrl });

        } else {

          throw new Error('No se pudo cargar el contenido del archivo');

        }

      }

      

      // Para archivos de imagen, verificar que se puedan cargar

      if (documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {

        // Las imágenes se cargan directamente en el img tag

        console.log('🖼️ Archivo de imagen detectado, se cargará en preview');

      }

      

      // Para PDFs, verificar que se puedan cargar

      if (documento.fileName?.toLowerCase().endsWith('.pdf')) {

        console.log('📄 Archivo PDF detectado, se cargará en iframe');

        

        // Verificar dacă endpoint-ul returnează ceva valid

        try {

          const response = await fetch(previewUrl);

          console.log('🔍 Răspuns de la endpoint PDF:', response);

          console.log('🔍 Status:', response.status);

          console.log('🔍 OK:', response.ok);

          console.log('🔍 Headers:', Object.fromEntries(response.headers.entries()));

          

          if (response.ok) {

            // Verifică Content-Type pentru a detecta dacă returnează JSON în loc de PDF

            const contentType = response.headers.get('content-type');

            console.log('🔍 Content-Type detectado:', contentType);

            
            // EXACT CA ÎN DocumentosPage.jsx - verificăm dacă e PDF
            if (contentType && contentType.includes('application/pdf')) {
              // Para PDF direct, creează un blob URL pentru preview
              const blob = await response.blob();
              console.log('🔍 Blob size:', blob.size);
              console.log('🔍 Blob type:', blob.type);
              
              if (blob.size > 0) {
                const url = URL.createObjectURL(blob);
                console.log('✅ URL creado para PDF:', url);
                setPreviewDocument(prev => ({
                  ...(prev || documento),
                  previewUrl: url,
                  isPdf: true,
                  isImage: false
                }));
                setPreviewError(null);
                return;
              } else {
                console.warn('⚠️ El blob está vacío! El endpoint no retorna el archivo!');
              }
            } else if (contentType && contentType.includes('application/json')) {
              console.warn('⚠️ El endpoint retorna JSON en lugar de PDF!');
              // Încearcă să proceseze JSON pentru a obține URL-ul PDF
              try {
                const data = await response.json();
                if (data.success && data.pdfUrl) {
                  setPreviewDocument(prev => ({
                    ...(prev || documento),
                    previewUrl: data.pdfUrl,
                    isPdf: true,
                    isImage: false
                  }));
                  setPreviewError(null);
                  return;
                }
              } catch (jsonError) {
                console.error('❌ Error parsing JSON:', jsonError);
              }
            } else {
              // FALLBACK: încearcă să creeze un blob URL (EXACT CA ÎN DocumentosPage.jsx)
              console.log('🔄 Content-Type necunoscut, încercăm fallback la blob...');
              const blob = await response.blob();
              if (blob.size > 0) {
                const url = URL.createObjectURL(blob);
                console.log('✅ Fallback blob URL creado:', url);
                setPreviewDocument(prev => ({
                  ...(prev || documento),
                  previewUrl: url,
                  isPdf: true,
                  isImage: false
                }));
                setPreviewError(null);
                return;
              }
            }
            
            // Dacă am ajuns aici, înseamnă că niciuna din metodele de mai sus nu a funcționat
            console.warn('⚠️ No se pudo crear blob ni parsear JSON. Intentando cargar URL directo en iframe...');
            // Ultimul fallback: setează direct URL-ul construit ca previewUrl în obiectul documentului
            // (același comportament ca în DocumentosPage.jsx)
            setPreviewDocument(prev => ({ ...(prev || documento), previewUrl }));
            setPreviewLoading(false);
            setPreviewError(null);
            return;

          } else {

            console.error('❌ Endpoint-ul nu returnează OK:', response.status, response.statusText);

            setPreviewError(`Error del servidor: ${response.status} ${response.statusText}`);

          }

        } catch (error) {

          console.error('❌ Error al verificar el endpoint del PDF:', error);

          setPreviewError('Error al verificar el archivo PDF');

        }

      }

      

      // Log adicional para debugging

      console.log('🔍 Tipo de archivo:', documento.fileName?.split('.').pop()?.toLowerCase());

      console.log('🔍 Es imagen?', documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'SÍ' : 'NO');

      console.log('🔍 Es PDF?', documento.fileName?.toLowerCase().endsWith('.pdf') ? 'SÍ' : 'NO');

      

      setPreviewLoading(false);

    } catch (error) {

      console.error('❌ Error cargando preview:', error);

      setPreviewError(error.message);

      setPreviewLoading(false);

    }

  };



  // Función para cerrar el modal de preview

  const handleClosePreview = () => {

    setShowPreviewModal(false);

    setPreviewDocument(null);

    setPreviewLoading(false);

    setPreviewError(null);

  };



  // Funcție helper pentru conversia blob în Base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Funcție pentru semnarea cu AutoFirma

  const handleSignWithAutoFirma = async (documento) => {

    try {

      console.log('🔍 Inițiere semnare AutoFirma pentru:', documento);

      console.log('🔍 Documento complet:', documento);

      console.log('🔍 SelectedEmpleado:', selectedEmpleado);
      
      // Verifică dacă este PDF

      if (!documento.fileName?.toLowerCase().endsWith('.pdf')) {

        showNotification('error', 'Error AutoFirma', 'Solo se pueden firmar documentos PDF');

        return;

      }
      
      // Construiește URL-ul pentru descărcarea PDF-ului

      let downloadUrl;
      
      // Debug pentru tipul de document
      console.log('🔍 AutoFirma - Analiza tipului document:');
      console.log('  - documento.tipo:', documento.tipo);
      console.log('  - documento.tipo_documento:', documento.tipo_documento);
      console.log('  - documento.tipo === "Nómina":', documento.tipo === 'Nómina');
      console.log('  - documento.tipo.toLowerCase().includes("contrato"):', documento.tipo?.toLowerCase().includes('contrato'));
      
      if (documento.tipo === 'Nómina') {
        console.log('🔍 AutoFirma - Folosind endpoint pentru Nómina');
        downloadUrl = `${routes.downloadNomina}?id=${documento.doc_id || documento.id}&nombre=${encodeURIComponent(selectedEmpleado['NOMBRE / APELLIDOS'] || '')}`;
      } else {
        // Pentru toate celelalte documente, folosim endpoint-ul de documente oficiale
        console.log('🔍 AutoFirma - Folosind endpoint pentru Documento Oficial (universal)');
        downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      }
      
      console.log('🔍 Descărcare PDF pentru AutoFirma:', downloadUrl);

      console.log('🔍 Debug - documento.id:', documento.id);

      console.log('🔍 Debug - documento.doc_id:', documento.doc_id);

      console.log('🔍 Debug - ID folosit pentru download:', documento.doc_id || documento.id);

      console.log('🔍 Debug - documento.tipo:', documento.tipo);

      console.log('🔍 Debug - documento.tipo_documento:', documento.tipo_documento);

      console.log('🔍 Debug - selectedEmpleado:', selectedEmpleado);

      console.log('🔍 Debug - routes.downloadDocumentoOficial:', routes.downloadDocumentoOficial);
      console.log('🔍 Debug - URL final pentru download:', downloadUrl);
      
      // Debug detaliat pentru detectarea tipului de document
      const isDocumentoOficial = documento.tipo === 'Documento Oficial' || 
        documento.tipo?.toLowerCase().includes('contrato') || 
        documento.tipo?.toLowerCase().includes('alta') || 
        documento.tipo?.toLowerCase().includes('oficial') || 
        documento.tipo?.toLowerCase().includes('sello') ||
        documento.tipo?.toLowerCase().includes('certificado') ||
        documento.tipo_documento?.toLowerCase().includes('contrato') ||
        documento.tipo_documento?.toLowerCase().includes('alta') ||
        documento.tipo_documento?.toLowerCase().includes('oficial') ||
        documento.tipo_documento?.toLowerCase().includes('sello') ||
        documento.tipo_documento?.toLowerCase().includes('certificado');
        
      console.log('🔍 Debug - Este document oficial?', isDocumentoOficial);
      console.log('🔍 Debug - Verificari detaliate:');
      console.log('  - documento.tipo === "Documento Oficial":', documento.tipo === 'Documento Oficial');
      console.log('  - documento.tipo.toLowerCase().includes("contrato"):', documento.tipo?.toLowerCase().includes('contrato'));
      console.log('  - documento.tipo.toLowerCase().includes("oficial"):', documento.tipo?.toLowerCase().includes('oficial'));
      console.log('  - documento.tipo_documento?.toLowerCase().includes("contrato"):', documento.tipo_documento?.toLowerCase().includes('contrato'));
      console.log('  - documento.tipo_documento?.toLowerCase().includes("oficial"):', documento.tipo_documento?.toLowerCase().includes('oficial'));
      
      // Descarcă PDF-ul ca File object

      console.log('🔍 Începe fetch-ul la:', downloadUrl);

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {};
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      console.log('🔍 Fetch method:', 'GET');

      console.log('🔍 Fetch headers:', fetchHeaders);
      
      const response = await fetch(downloadUrl, { headers: fetchHeaders });

      console.log('🔍 Response status:', response.status, response.statusText);

      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));

      console.log('🔍 Response ok:', response.ok);

      console.log('🔍 Response url:', response.url);
      
      if (!response.ok) {

        throw new Error(`Error al descargar PDF: ${response.status} ${response.statusText}`);

      }
      
      const blob = await response.blob();

      console.log('🔍 Blob size:', blob.size, 'bytes');

      console.log('🔍 Blob type:', blob.type);
      
      if (blob.size === 0) {

        throw new Error('El archivo PDF está vacío o no se pudo cargar');

      }
      
      // Creează File object din blob

      const pdfFile = new File([blob], documento.fileName || 'documento.pdf', { type: 'application/pdf' });

      console.log('✅ PDF descargado para AutoFirma:', { fileName: pdfFile.name, size: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` });
      
      // Debug: afișează structura obiectelor

      console.log('🔍 Debug AutoFirma - documento:', documento);

      console.log('🔍 Debug AutoFirma - selectedEmpleado:', selectedEmpleado);

      console.log('🔍 Debug AutoFirma - documento.id:', documento.id);

      console.log('🔍 Debug AutoFirma - selectedEmpleado.CODIGO:', selectedEmpleado?.CODIGO);
      
      // Verifică dacă AutoScript este disponibil
      console.log('🔍 AutoScript disponibil:', typeof window !== 'undefined' && !!window.AutoScript);
      
      if (typeof window === 'undefined' || !window.AutoScript) {
        showNotification('error', 'AutoFirma', 'AutoScript nu este disponibil. Te rugăm să reîncărci pagina.');
        return;
      }
      
      // Convertim PDF-ul în Base64
      const pdfBase64 = await blobToBase64(blob);
      console.log('📄 PDF convertit în Base64, lungime:', pdfBase64.length);
      
      // Inițializăm AutoScript
      console.log('🔧 Inițializare AutoScript...');
      window.AutoScript.cargarAppAfirma();
      
      // Parametrii pentru semnarea PAdES
      const extraParamsString = 
        "signaturePositionOnPageLowerLeftX=400\n" +
        "signaturePositionOnPageLowerLeftY=50\n" +
        "signaturePositionOnPageUpperRightX=600\n" +
        "signaturePositionOnPageUpperRightY=150\n" +
        "layer2Text=Firmado por $$SUBJECTCN$$ el día $$SIGNDATE=dd/MM/yyyy$$ con un certificado emitido por $$ISSUERCN$$\n" +
        "layer2FontSize=11\n" +
        "layer2FontColorRGB=255,0,0\n";
      
      console.log('⚙️ Parametrii AutoScript:', {
        fileName: documento.fileName,
        base64Length: pdfBase64.length,
        format: "PAdES",
        algorithm: "SHA256withRSA",
        extraParams: extraParamsString
      });
      
      // Apelăm AutoScript.sign()
      window.AutoScript.sign(
        pdfBase64,           // dataB64 - string Base64
        "SHA256withRSA",     // algorithm
        "PAdES",             // format
        extraParamsString,   // extraParams - string
        (result) => {
          console.log("✅ Document semnat:", result);
          
          // Descărcăm documentul semnat
          const signedBlob = new Blob([Uint8Array.from(atob(result), c => c.charCodeAt(0))], { type: 'application/pdf' });
          const url = URL.createObjectURL(signedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = documento.fileName.replace('.pdf', '_SIGNED.pdf');
          a.click();
          URL.revokeObjectURL(url);
          
          // 🚀 TRIMITEM AUTOMAT LA BACKEND
          console.log('🚀 Documento firmado, enviando automáticamente al backend...');
          const payload = {
            "doc_id": documento.doc_id,
            "id": selectedEmpleado?.CODIGO,
            "correo_electronico": selectedEmpleado?.['CORREO ELECTRONICO'],
            "tipo_documento": documento.tipo_documento || documento.tipo || 'Documento',
            "nombre_archivo": documento.fileName.replace('.pdf', '_FIRMADO_DIGITAL.pdf'),
            "nombre_empleado": selectedEmpleado?.['NOMBRE / APELLIDOS'],
            "fecha_creacion": new Date().toISOString(),
            "mime": "application/pdf",
            "signed_b64": result
          };
          
          // Add JWT token to headers for backend API calls
          const token = localStorage.getItem('auth_token');
          const fetchHeaders = {
            'Content-Type': 'application/json',
          };
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
          }

          fetch(routes.autofirmaWebhook, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(payload)
          })
          .then(response => {
            console.log('📥 Răspuns de la backend:', response.status, response.statusText);
            return response.json();
          })
          .then(data => {
            console.log('✅ Document trimis cu succes la backend:', data);
            showNotification('success', 'AutoFirma', 'Documentul a fost semnat, descărcat și trimis la server cu succes!');
          })
          .catch(error => {
            console.error('❌ Error al enviar al backend:', error);
            showNotification('warning', 'AutoFirma', 'Documentul a fost semnat și descărcat, dar a existat o eroare la trimiterea la server.');
          });
        }
      );
      
    } catch (error) {

      console.error('❌ Error la semnare AutoFirma:', error);

      console.error('❌ Error stack:', error.stack);

      console.error('❌ Error details:', {

        message: error.message,

        name: error.name,

        code: error.code,

        status: error.status

      });

      showNotification('error', 'Error AutoFirma', `Error al firmar con AutoFirma: ${error.message}`);

    }

  };







  // Funcționalitate pentru canvas-ul de semnături

  useEffect(() => {

    if (showPreviewModal && previewDocument?.fileName?.toLowerCase().endsWith('.pdf')) {

      const canvas = document.getElementById('signatureCanvas');

      if (canvas) {

        const ctx = canvas.getContext('2d');

        let isDrawing = false;

        let lastX = 0;

        let lastY = 0;



        // Inițializează canvas-ul

        ctx.strokeStyle = '#000000';

        ctx.lineWidth = 3;

        ctx.lineCap = 'round';

        ctx.lineJoin = 'round';



        // Funcții pentru mouse

        const startDrawing = (e) => {

          isDrawing = true;

          const rect = canvas.getBoundingClientRect();

          lastX = e.clientX - rect.left;

          lastY = e.clientY - rect.top;

        };



        const draw = (e) => {

          if (!isDrawing) return;

          const rect = canvas.getBoundingClientRect();

          const currentX = e.clientX - rect.left;

          const currentY = e.clientY - rect.top;



          ctx.beginPath();

          ctx.moveTo(lastX, lastY);

          ctx.lineTo(currentX, currentY);

          ctx.stroke();



          lastX = currentX;

          lastY = currentY;

        };



        const stopDrawing = () => {

          isDrawing = false;

        };



        // Funcții pentru touch

        const startDrawingTouch = (e) => {

          e.preventDefault();

          const touch = e.touches[0];

          const rect = canvas.getBoundingClientRect();

          lastX = touch.clientX - rect.left;

          lastY = touch.clientY - rect.top;

          isDrawing = true;

        };



        const drawTouch = (e) => {

          e.preventDefault();

          if (!isDrawing) return;

          const touch = e.touches[0];

          const rect = canvas.getBoundingClientRect();

          const currentX = touch.clientX - rect.left;

          const currentY = touch.clientY - rect.top;



          ctx.beginPath();

          ctx.moveTo(lastX, lastY);

          ctx.lineTo(currentX, currentY);

          ctx.stroke();



          lastX = currentX;

          lastY = currentY;

        };



        const stopDrawingTouch = () => {

          isDrawing = false;

        };



        // Adaugă event listeners

        canvas.addEventListener('mousedown', startDrawing);

        canvas.addEventListener('mousemove', draw);

        canvas.addEventListener('mouseup', stopDrawing);

        canvas.addEventListener('mouseout', stopDrawing);



        canvas.addEventListener('touchstart', startDrawingTouch);

        canvas.addEventListener('touchmove', drawTouch);

        canvas.addEventListener('touchend', stopDrawingTouch);



        // Cleanup

        return () => {

          canvas.removeEventListener('mousedown', startDrawing);

          canvas.removeEventListener('mousemove', draw);

          canvas.removeEventListener('mouseup', stopDrawing);

          canvas.removeEventListener('mouseout', stopDrawing);



          canvas.removeEventListener('touchstart', startDrawingTouch);

          canvas.removeEventListener('touchmove', drawTouch);

          canvas.removeEventListener('touchend', stopDrawingTouch);

        };

      }

    }

  }, [showPreviewModal, previewDocument]);







  // Función para obtener nóminas del empleado

  const fetchNominas = useCallback(async (empleado) => {

    if (!empleado || !empleado['NOMBRE / APELLIDOS'] || !empleado['CODIGO']) {

      console.log('❌ No hay empleado seleccionado o datos válidos');

      return;

    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchNominas for empleado:', empleado['NOMBRE / APELLIDOS']);
      setNominasLoading(false);
      return;
    }

    setNominasLoading(true);

    setNominasError(null);



    try {

      console.log('🔄 Obteniendo nóminas para:', empleado['NOMBRE / APELLIDOS'], 'ID:', empleado['CODIGO']);

      

      const queryParams = new URLSearchParams({

        nombre: empleado['NOMBRE / APELLIDOS'],

        codigo: empleado['CODIGO']

      });



      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${routes.getNominas}?${queryParams}`, {
        method: 'GET',
        headers,
      });



      if (!response.ok) {

        throw new Error(`Error HTTP: ${response.status}`);

      }



      const data = await response.json();

      console.log('📊 Respuesta nóminas:', data);

      

      // Verificar si las nóminas son válidas o solo mensajes de éxito

      const isValidNomina = (item) => {

        console.log('🔍 Validando nómina:', item);

        

        // Verificar si el objeto contiene campos reales de nómina

        const hasValidFields = item && (

          item.id || item.nomina_id || item.documento_id ||

          item.mes || item.periodo || item.año || item.ano || item.an || item.year ||

          item.fecha_subida || item.uploadDate || item.created_at || item.fecha ||

          item.salario || item.importe || item.cantidad ||

          item.archivo || item.fileName || item.nombre_archivo || item.filename

        );

        

        console.log('🔍 Nómina válida?', hasValidFields);

        return hasValidFields;

      };

      

      // Filtrar solo las nóminas válidas

      let nominasValidas = [];

      

      if (Array.isArray(data)) {

        nominasValidas = data.filter(isValidNomina);

      } else if (data.success && data.nominas) {

        nominasValidas = data.nominas.filter(isValidNomina);

      }

      

      console.log('🔍 Nóminas válidas encontradas:', nominasValidas.length);

      console.log('🔍 Data original:', data);

      console.log('🔍 Data filtrada:', nominasValidas);

      

      if (nominasValidas.length === 0) {

        console.log('ℹ️ No se encontraron nóminas válidas');

        setNominas([]);

        // Eliminar nóminas de empleadoDocumentos cuando no hay nóminas válidas

        setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Nómina'));

        setNominasLoading(false);

        return;

      }

      

      // Log detallado de la primera nómina válida para debugging

      if (nominasValidas.length > 0) {

        console.log('🔍 Primera nómina válida:', nominasValidas[0]);

        console.log('🔍 Campos disponibles:', Object.keys(nominasValidas[0]));

        console.log('🔍 Valor de mes:', nominasValidas[0].mes);

        console.log('🔍 Valor de periodo:', nominasValidas[0].periodo);

        console.log('🔍 Valor de año:', nominasValidas[0].año);

      }



      // Procesar solo las nóminas válidas

      if (Array.isArray(data)) {

        // Si la respuesta es directamente un array

        const nominasProcesadas = nominasValidas.map((nomina, idx) => ({

          id: nomina.id || nomina.nomina_id || nomina.documento_id || `nomina_${idx}`,

          fileName: nomina.archivo || nomina.fileName || nomina.nombre_archivo || nomina.filename || `nómina_${idx + 1}`,

          fileSize: nomina.fileSize || nomina.tamaño || nomina.size || 0,

          uploadDate: nomina.fecha_subida || nomina.uploadDate || nomina.created_at || nomina.fecha || new Date().toISOString(),

          tipo: nomina.tipo || 'Nómina',

          empleadoId: empleado['CODIGO'],

          empleadoEmail: empleado['CORREO ELECTRONICO'],

          periodo: nomina.mes || nomina.periodo || nomina.año || 'Sin especificar',

          // Extraer mes y año del periodo si existe

          mes: nomina.mes || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[0] : null),

          año: nomina.año || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[1] : null),

          salario: nomina.salario || nomina.importe || nomina.cantidad || 0,

          status: 'disponible'

        }));



        // Ordenar nóminas de más reciente a más antigua

        const nominasOrdenadas = nominasProcesadas.sort((a, b) => {

          const fechaA = new Date(a.uploadDate || 0);

          const fechaB = new Date(b.uploadDate || 0);

          return fechaB - fechaA; // Orden descendente (más reciente primero)

        });

        

        setNominas(nominasOrdenadas);

        console.log('✅ Nóminas procesadas y ordenadas (array directo):', nominasOrdenadas);

        

        // Sincronizar nóminas con empleadoDocumentos para que aparezcan en el contador

        setEmpleadoDocumentos(prev => {

          // Filtrar documentos existentes que nu sunt nóminas

          const documentosNoNominas = prev.filter(doc => doc.tipo !== 'Nómina');

          // Adăugăm nóminas ordenadas la lista de documente

          return [...documentosNoNominas, ...nominasOrdenadas];

        });

      } else if (data.success && data.nominas) {

        // Si la respuesta tiene estructura {success: true, nominas: [...]}

        const nominasProcesadas = nominasValidas.map((nomina, idx) => ({

          id: nomina.id || nomina.nomina_id || nomina.documento_id || `nomina_${idx}`,

          fileName: nomina.fileName || nomina.nombre_archivo || nomina.filename || `nómina_${idx + 1}`,

          fileSize: nomina.fileSize || nomina.tamaño || nomina.size || 0,

          uploadDate: nomina.uploadDate || nomina.fecha_subida || nomina.created_at || nomina.fecha || new Date().toISOString(),

          tipo: nomina.tipo || 'Nómina',

          empleadoId: empleado['CODIGO'],

          empleadoEmail: empleado['CORREO ELECTRONICO'],

          periodo: nomina.periodo || nomina.mes || nomina.año || 'Sin especificar',

          // Extraer mes y año del periodo si existe

          mes: nomina.mes || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[0] : null),

          año: nomina.año || (nomina.periodo && nomina.periodo.includes(' ') ? nomina.periodo.split(' ')[1] : null),

          salario: nomina.salario || nomina.importe || nomina.cantidad || 0,

          status: 'disponible'

        }));



        // Ordenar nóminas de más reciente a más antigua

        const nominasOrdenadas = nominasProcesadas.sort((a, b) => {

          const fechaA = new Date(a.uploadDate || 0);

          const fechaB = new Date(b.uploadDate || 0);

          return fechaB - fechaA; // Orden descendente (más reciente primero)

        });

        

        setNominas(nominasOrdenadas);

        console.log('✅ Nóminas procesadas y ordenadas (estructura success):', nominasOrdenadas);

        

        // Sincronizar nóminas con empleadoDocumentos para que aparezcan en el contador

        setEmpleadoDocumentos(prev => {

          // Filtrar documentos existentes que nu sunt nóminas

          const documentosNoNominas = prev.filter(doc => doc.tipo !== 'Nómina');

          // Adăugăm nóminas ordenadas la lista de documente

          return [...documentosNoNominas, ...nominasOrdenadas];

        });

      } else {

        setNominas([]);

        console.log('ℹ️ No se encontraron nóminas o respuesta inválida');

        

        // Eliminar nóminas de empleadoDocumentos cuando no hay nóminas

        setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Nómina'));

      }

    } catch (error) {

      console.error('❌ Error obteniendo nóminas:', error);

      setNominasError(error.message);

      setNominas([]);

      

      // Eliminar nóminas de empleadoDocumentos cuando hay error

      setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Nómina'));

    } finally {

      setNominasLoading(false);

    }

  }, [authUser]);



  // Efecto pentru încărcarea nóminas când se activează tabul corespunzător

  useEffect(() => {

    if (selectedEmpleado && activeTab === 'nominas') {

      fetchNominas(selectedEmpleado);

    }

  }, [selectedEmpleado, activeTab, fetchNominas]);



  // Función para obtener documentos oficiales del empleado

  const fetchDocumentosOficiales = useCallback(async (empleado) => {

    if (!empleado || !empleado['NOMBRE / APELLIDOS'] || !empleado['CODIGO']) {

      console.log('❌ No hay empleado seleccionado o datos válidos para documentos oficiales');

      return;

    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchDocumentosOficiales for empleado:', empleado['NOMBRE / APELLIDOS']);
      setDocumentosOficialesLoading(false);
      return;
    }

    setDocumentosOficialesLoading(true);

    setDocumentosOficialesError(null);



    try {

      console.log('🏢 Obteniendo documentos oficiales para:', empleado['NOMBRE / APELLIDOS'], 'ID:', empleado['CODIGO']);

      

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${routes.getDocumentosOficiales}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nombre: empleado['NOMBRE / APELLIDOS'],
          codigo: empleado['CODIGO']
        })
      });



      if (!response.ok) {

        throw new Error(`Error HTTP: ${response.status}`);

      }



      const data = await response.json();

      console.log('🏢 Respuesta documentos oficiales:', data);

      

      // Verificar si los documentos oficiales son válidos o solo mensajes de éxito

      const isValidDocumentoOficial = (item) => {

        console.log('🔍 Validando documento oficial:', item);

        

        // Verificar si el objeto contiene campos reales de documento oficial

        const hasValidFields = item && (

          item.id || item.documento_id || item.documentoId ||

          item.nombre_archivo || item.fileName || item.archivo || item.nombre ||

          item.fecha_creacion || item.uploadDate || item.created_at || item.fecha ||

          item.tipo_documento || item.tipo

        );

        

        console.log('🔍 Documento oficial válido?', hasValidFields);

        return hasValidFields;

      };

      

      // Filtrar solo los documentos oficiales válidos

      let documentosOficialesValidos = [];

      

      if (Array.isArray(data)) {

        documentosOficialesValidos = data.filter(isValidDocumentoOficial);

      } else if (data.success && data.documentos) {

        documentosOficialesValidos = data.documentos.filter(isValidDocumentoOficial);

      }

      

      console.log('🔍 Documentos oficiales válidos encontrados:', documentosOficialesValidos.length);

      console.log('🔍 Data original:', data);

      console.log('🔍 Data filtrada:', documentosOficialesValidos);

      
      // Debug: Log un document complet pentru a vedea structura
      if (documentosOficialesValidos.length > 0) {
        console.log('🔍 Ejemplo de documento original:', documentosOficialesValidos[0]);
        console.log('🔍 Campos disponibles:', Object.keys(documentosOficialesValidos[0]));
      }
      

      if (documentosOficialesValidos.length === 0) {

        console.log('ℹ️ No se encontraron documentos oficiales válidos');

        setDocumentosOficiales([]);

        // Eliminar documentos oficiales de empleadoDocumentos cuando no hay documentos oficiales válidos

        setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Documento Oficial'));

        setDocumentosOficialesLoading(false);

        return;

      }

      

      // Procesar solo los documentos oficiales válidos

      if (Array.isArray(data)) {

        // Si la respuesta es directamente un array

        const documentosOficialesProcesados = documentosOficialesValidos.map((doc, idx) => {
          // Debug: Log mapping-ul pentru fiecare document
          console.log(`🔍 Mapeando documento ${idx + 1}:`);
          console.log(`  - doc.id (id din backend): ${doc.id}`);
          console.log(`  - doc.doc_id (doc_id din backend): ${doc.doc_id}`);
          console.log(`  - ID final asignado: ${doc.id}`);
          console.log(`  - Doc ID final asignado: ${doc.doc_id}`);
          
          return {
            id: doc.id, // id din backend
            doc_id: doc.doc_id, // doc_id din backend
            fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
            fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes || 0,
            uploadDate: doc.fecha_creacion || doc.uploadDate || doc.created_at || doc.fecha || doc.fecha_subida || doc.upload_date || doc.creation_date || doc.fecha_autor || new Date().toISOString(),
            tipo: doc.tipo_documento || doc.tipo || doc.categoria || doc.document_type || doc.type || doc.category || 'Documento Oficial',
            empleadoId: empleado['CODIGO'],
            empleadoEmail: empleado['CORREO ELECTRONICO'],
            status: 'disponible',
            // Câmpuri suplimentare din backend - păstrăm toate câmpurile originale
            correo_electronico: doc.correo_electronico,
            // Adăugăm și alte câmpuri care pot fi utile
            originalData: doc // Păstrăm întregul obiect original pentru debugging
          };
        });


        // Ordenar documentos oficiales de más reciente a más antiguo

        const documentosOficialesOrdenados = documentosOficialesProcesados.sort((a, b) => {

          const fechaA = new Date(a.uploadDate || 0);

          const fechaB = new Date(b.uploadDate || 0);

          return fechaB - fechaA; // Orden descendente (más reciente primero)

        });

        

        setDocumentosOficiales(documentosOficialesOrdenados);

        console.log('✅ Documentos oficiales procesados y ordenados:', documentosOficialesOrdenados);
        
        // Debug: Log un document procesat pentru a vedea mapping-ul
        if (documentosOficialesOrdenados.length > 0) {
          console.log('🔍 Ejemplo de documento procesado:', documentosOficialesOrdenados[0]);
          console.log('🔍 Campos mapeados:', Object.keys(documentosOficialesOrdenados[0]));
          console.log('🔍 Verificación de IDs:');
          console.log('  - documento.id (principal):', documentosOficialesOrdenados[0].id);
          console.log('  - documento.doc_id:', documentosOficialesOrdenados[0].doc_id);
          console.log('  - documento.id (empleado):', documentosOficialesOrdenados[0].id);
        }

        

        // Sincronizar documentos oficiales con empleadoDocumentos para que aparezcan en el contador

        setEmpleadoDocumentos(prev => {

          // Filtrar documentos existentes que nu sunt documentos oficiales

          const documentosNoOficiales = prev.filter(doc => doc.tipo !== 'Documento Oficial');

          // Adăugăm documentos oficiales ordenados la lista de documente

          return [...documentosNoOficiales, ...documentosOficialesOrdenados];

        });

      } else if (data.success && data.documentos) {

        // Si la respuesta tiene estructura {success: true, documentos: [...]}

        const documentosOficialesProcesados = documentosOficialesValidos.map((doc, idx) => ({
          id: doc.id, // id din backend
          doc_id: doc.doc_id, // doc_id din backend
          fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
          fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes || 0,
          uploadDate: doc.uploadDate || doc.fecha_creacion || doc.created_at || doc.fecha || doc.fecha_subida || doc.upload_date || doc.creation_date || doc.fecha_autor || new Date().toISOString(),
          tipo: doc.tipo_documento || doc.tipo || doc.categoria || doc.document_type || doc.type || doc.category || 'Documento Oficial',
          empleadoId: empleado['CODIGO'],

          empleadoEmail: empleado['CORREO ELECTRONICO'],

          status: 'disponible',

          // Câmpuri suplimentare din backend - păstrăm toate câmpurile originale
          correo_electronico: doc.correo_electronico,
          // Adăugăm și alte câmpuri care pot fi utile
          originalData: doc // Păstrăm întregul obiect original pentru debugging
        }));



        // Ordenar documentos oficiales de más reciente a más antiguo

        const documentosOficialesOrdenados = documentosOficialesProcesados.sort((a, b) => {

          const fechaA = new Date(a.uploadDate || 0);

          const fechaB = new Date(b.uploadDate || 0);

          return fechaB - fechaA; // Orden descendente (más reciente primero)

        });

        

        setDocumentosOficiales(documentosOficialesOrdenados);

        console.log('✅ Documentos oficiales procesados y ordenados (estructura success):', documentosOficialesOrdenados);
        
        // Debug: Log un document procesat pentru a vedea mapping-ul
        if (documentosOficialesOrdenados.length > 0) {
          console.log('🔍 Ejemplo de documento procesado:', documentosOficialesOrdenados[0]);
          console.log('🔍 Campos mapeados:', Object.keys(documentosOficialesOrdenados[0]));
          console.log('🔍 Verificación de IDs:');
          console.log('  - documento.id (principal):', documentosOficialesOrdenados[0].id);
          console.log('  - documento.doc_id:', documentosOficialesOrdenados[0].doc_id);
          console.log('  - documento.id (empleado):', documentosOficialesOrdenados[0].id);
        }

        

        // Sincronizar documentos oficiales con empleadoDocumentos para que aparezcan en el contador

        setEmpleadoDocumentos(prev => {

          // Filtrar documentos existentes que nu sunt documentos oficiales

          const documentosNoOficiales = prev.filter(doc => doc.tipo !== 'Documento Oficial');

          // Adăugăm documentos oficiales ordenados la lista de documente

          return [...documentosNoOficiales, ...documentosOficialesOrdenados];

        });

      } else {

        setDocumentosOficiales([]);

        console.log('ℹ️ No se encontraron documentos oficiales o respuesta inválida');

        

        // Eliminar documentos oficiales de empleadoDocumentos cuando no hay documentos oficiales

        setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Documento Oficial'));

      }

    } catch (error) {

      console.error('❌ Error obteniendo documentos oficiales:', error);

      setDocumentosOficialesError(error.message);

      setDocumentosOficiales([]);

      

      // Eliminar documentos oficiales de empleadoDocumentos cuando hay error

      setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Documento Oficial'));

    } finally {

      setDocumentosOficialesLoading(false);

    }

  }, [authUser]);



  // Efecto pentru încărcarea documentelor oficiale când se activează tabul corespunzător

  useEffect(() => {

    console.log('🔍 useEffect documentos oficiales - activeTab:', activeTab);

    console.log('🔍 useEffect documentos oficiales - selectedEmpleado:', selectedEmpleado);

    if (selectedEmpleado && activeTab === 'documentos-empresa') {

      console.log('✅ Activando fetchDocumentosOficiales');

      fetchDocumentosOficiales(selectedEmpleado);

    }

  }, [selectedEmpleado, activeTab, fetchDocumentosOficiales]);



  // Función para descargar documentos normales

  const handleDownloadDocument = async (documento) => {
    console.log('⬇️ Descargando documento:', documento);

    try {
      const downloadUrl = `${routes.downloadDocumento}?id=${documento.id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;

      console.log('🔗 URL de descarga:', downloadUrl);
      console.log('📋 Datele trimise:', {
        id: documento.id,
        email: selectedEmpleado['CORREO ELECTRONICO'],
        fileName: documento.fileName,
        documentId: documento.doc_id
      });

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        Accept: 'application/pdf, application/json, */*'
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: fetchHeaders
      });

      if (!response.ok) {
        console.error('❌ Error en respuesta del servidor:', response.status, response.statusText);
        showNotification('error', 'Error al descargar', `Error al descargar el documento. Status: ${response.status}`);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.fileName || `documento_${documento.id}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Documento descargado exitosamente');

      await activityLogger.logAction('documento_downloaded', {
        documento_id: documento.id,
        nombre_archivo: documento.fileName,
        empleado: selectedEmpleado,
        user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre
      });

      showNotification('success', 'Descarga exitosa', 'El documento se ha descargado correctamente');
    } catch (error) {
      console.error('❌ Error descargando documento:', error);
      showNotification('error', 'Error al descargar', 'Error al descargar el documento. Por favor, inténtalo más tarde.');
    }
  };



  // Función para descargar documentos oficiales

  const handleDownloadDocumentOficial = async (documento) => {

    try {

      console.log('⬇️ Descargando documento oficial:', documento);

      

      // Construir URL para descarga

              const downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}`;

      

      console.log('🔗 URL de descarga:', downloadUrl);
      console.log('🔍 Parámetros:', { 
        id: documento.id,
        documentId: documento.doc_id,
        email: selectedEmpleado['CORREO ELECTRONICO'],
        fileName: documento.fileName
      });

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {};
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(downloadUrl, { headers: fetchHeaders });

      if (response.ok) {

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = documento.fileName || 'documento-oficial';

        a.style.display = 'none';

        document.body.appendChild(a);

        a.click();

        window.URL.revokeObjectURL(url);

        document.body.removeChild(a);

        

        showNotification('success', 'Descarga exitosa', 'El documento oficial se ha descargado correctamente');

      } else {

        throw new Error(`Error HTTP: ${response.status}`);

      }

    } catch (error) {

      console.error('❌ Error descargando documento oficial:', error);

      showNotification('error', 'Error de descarga', 'No se pudo descargar el documento oficial');

    }

  };



  // Función para abrir modal de confirmación de borrado de nómina

  const openDeleteConfirmModal = (nomina) => {

    setNominaToDelete(nomina);

    setShowDeleteConfirmModal(true);

  };



  // Función para borrar nómina

  const handleDeleteNomina = async (nomina) => {

    try {

      console.log('🗑️ Borrando nómina:', nomina);

      

      // Preparar datos para enviar en el body

      const deleteData = {

        id: nomina.id,

        filename: nomina.fileName || ''

      };

      

      console.log('🔗 URL de borrado:', routes.deleteNomina);

      console.log('🔍 Datos enviados:', deleteData);

      

      // Borrar nómina

      // Add JWT token to headers for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.deleteNomina, {

        method: 'POST', // ✅ Backend-ul așteaptă POST, nu DELETE

        headers: fetchHeaders,

        body: JSON.stringify(deleteData)

      });

      

      if (response.ok) {

        console.log('✅ Nómina borrada exitosamente');

        

        // Actualizar lista de nóminas localmente

        setNominas(prev => prev.filter(n => n.id !== nomina.id));

        

        // Re-fetch la lista completa din backend pentru sincronizare

        if (selectedEmpleado) {

          console.log('🔄 Re-fetching nóminas después del borrado...');

          await fetchNominas(selectedEmpleado);

        }

        

        showNotification('success', 'Borrado Exitoso', 'La nómina se ha borrado correctamente');

      } else {

        const errorText = await response.text();

        throw new Error(`Error HTTP: ${response.status} - ${errorText}`);

      }

    } catch (error) {

      console.error('❌ Error borrando nómina:', error);

      showNotification('error', 'Error de Borrado', 'No se pudo borrar la nómina');

    }

  };



  // Función para abrir modal de confirmación de borrado de documento normal

  const openDeleteConfirmModalDocumento = (documento) => {

    setDocumentoToDelete(documento);

    setShowDeleteConfirmModal(true);

  };



  // Función para abrir modal de confirmación de borrado de documento oficial

  const openDeleteConfirmModalDocumentoOficial = (documento) => {

    setDocumentoOficialToDelete(documento);

    setShowDeleteConfirmModal(true);

  };



  // Función para borrar documento normal

  const handleDeleteDocumento = async (documento) => {

    try {

      console.log('🗑️ Borrando documento normal:', documento);

      

      // Preparar datos para enviar en el body

      const deleteData = {

        id: documento.id,

        filename: documento.fileName || ''

      };

      

      console.log('🔗 URL de borrado:', routes.deleteDocumento);

      console.log('🔍 Datos enviados:', deleteData);

      

      // Borrar documento normal

      // Add JWT token to headers for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.deleteDocumento, {

        method: 'POST', // ✅ Backend-ul așteaptă POST, nu DELETE

        headers: fetchHeaders,

        body: JSON.stringify(deleteData)

      });

      

      console.log('📡 Response status:', response.status);

      console.log('📡 Response ok:', response.ok);

      console.log('📡 Response headers:', response.headers);

      

      if (response.ok) {

        console.log('✅ Documento normal borrado exitosamente');

        

        // Actualizar lista de documentos normales localmente

        setEmpleadoDocumentos(prev => prev.filter(doc => doc.id !== documento.id));

        

        // Re-fetch la lista completa din backend pentru sincronizare

        if (selectedEmpleado) {

          console.log('🔄 Re-fetching documentos normales después del borrado...');

          await fetchEmpleadoDocumentos(selectedEmpleado);

        }

        

        showNotification('success', 'Borrado Exitoso', 'El documento se ha borrado correctamente');

      } else {

        const errorText = await response.text();

        console.log('❌ Response body:', errorText);

        

        // Verificar si el backend devuelve un mensaje de éxito aunque el status no sea 200

        if (response.status === 200 || response.status === 204 || errorText.includes('success') || errorText.includes('exitoso') || errorText.includes('deleted')) {

          console.log('✅ Documento borrado exitosamente (verificación de contenido)');

          

          // Actualizar lista de documentos normales localmente

          setEmpleadoDocumentos(prev => prev.filter(doc => doc.id !== documento.id));

          

          // Re-fetch la lista completa din backend pentru sincronizare

          if (selectedEmpleado) {

            console.log('🔄 Re-fetching documentos normales después del borrado...');

            await fetchEmpleadoDocumentos(selectedEmpleado);

          }

          

          showNotification('success', 'Borrado Exitoso', 'El documento se ha borrado correctamente');

        } else {

          throw new Error(`Error HTTP: ${response.status} - ${errorText}`);

        }

      }

    } catch (error) {

      console.error('❌ Error borrando documento normal:', error);

      showNotification('error', 'Error de Borrado', 'No se pudo borrar el documento');

    }

  };



  // Función para borrar documento oficial

  const handleDeleteDocumentoOficial = async (documento) => {

    try {

      console.log('🗑️ Borrando documento oficial:', documento);

      

      // Preparar datos para enviar en el body

      const deleteData = {

        id: documento.id,

        filename: documento.fileName || ''

      };

      

      console.log('🔗 URL de borrado:', routes.deleteDocumentoOficial);

      console.log('🔍 Datos enviados:', deleteData);

      

      // Borrar documento oficial

      // Add JWT token to headers for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.deleteDocumentoOficial, {

        method: 'POST', // ✅ Backend-ul așteaptă POST, nu DELETE

        headers: fetchHeaders,

        body: JSON.stringify(deleteData)

      });

      

      if (response.ok) {

        console.log('✅ Documento oficial borrado exitosamente');

        

        // Actualizar lista de documentos oficiales localmente

        setDocumentosOficiales(prev => prev.filter(doc => doc.id !== documento.id));

        

        // Re-fetch la lista completa din backend pentru sincronizare

        if (selectedEmpleado) {

          console.log('🔄 Re-fetching documentos oficiales después del borrado...');

          await fetchDocumentosOficiales(selectedEmpleado);

        }

        

        showNotification('success', 'Borrado Exitoso', 'El documento oficial se ha borrado correctamente');

      } else {

        const errorText = await response.text();

        throw new Error(`Error HTTP: ${response.status} - ${errorText}`);

      }

    } catch (error) {

      console.error('❌ Error borrando documento oficial:', error);

      showNotification('error', 'Error de Borrado', 'No se pudo borrar el documento oficial');

    }

  };



  const handleUploadClick = () => {

    console.log('📄 Botón de documentos normales clickeado');

    setUploadType('normal');

    console.log('📝 UploadType establecido a:', 'normal');

    if (fileInputRef.current) {

      console.log('📁 Abriendo selector de archivos');

      fileInputRef.current.click();

    }

  };















  if (!isManager) {

    return (

      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <h1 className="text-2xl font-bold text-red-600 mb-4">

            Acceso Restringido

          </h1>

          <p className="text-gray-600 mb-6">

            Solo los managers pueden acceder a esta página.

          </p>

          <Link 

            to="/inicio"

            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"

          >

            ← Volver al Inicio

          </Link>

        </div>

      </div>

    );

  }



  if (loading) {

    return (

      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <LoadingSpinner size="lg" text="Cargando..." />

        </div>

      </div>

    );

  }



  if (error) {

    return (

      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <h1 className="text-2xl font-bold text-red-600 mb-4">

            {error}

          </h1>

          <Button

            onClick={fetchEmpleados}

            variant="primary"

            size="lg"

          >

            Inténtalo de nuevo

          </Button>

        </div>

      </div>

    );

  }



  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Background Effects ULTRA WOW */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating blobs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-red-100 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        
        {/* Floating particles */}
        <div className="absolute top-20 left-1/4 w-4 h-4 bg-red-300 rounded-full opacity-30 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-40 right-1/3 w-3 h-3 bg-red-400 rounded-full opacity-25 animate-pulse" style={{animationDelay: '2.5s'}}></div>
        <div className="absolute bottom-32 left-1/3 w-5 h-5 bg-red-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-60 right-1/4 w-2 h-2 bg-red-500 rounded-full opacity-35 animate-pulse" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute bottom-20 right-20 w-3 h-3 bg-red-300 rounded-full opacity-25 animate-pulse" style={{animationDelay: '3s'}}></div>
        <div className="absolute top-80 left-20 w-4 h-4 bg-red-400 rounded-full opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
        
        {/* Geometric shapes */}
        <div className="absolute top-32 right-32 w-8 h-8 bg-red-200 opacity-10 rotate-45 animate-pulse" style={{animationDelay: '2.2s'}}></div>
        <div className="absolute bottom-40 left-16 w-6 h-6 bg-red-300 opacity-15 rotate-12 animate-pulse" style={{animationDelay: '3.8s'}}></div>
        <div className="absolute top-1/2 right-16 w-10 h-10 bg-red-100 opacity-8 rotate-90 animate-pulse" style={{animationDelay: '1.8s'}}></div>
        
        {/* Gradient orbs */}
        <div className="absolute top-1/3 left-1/5 w-32 h-32 bg-gradient-to-r from-red-200 to-red-300 rounded-full opacity-5 blur-2xl animate-pulse" style={{animationDelay: '2.8s'}}></div>
        <div className="absolute bottom-1/3 right-1/5 w-24 h-24 bg-gradient-to-r from-red-300 to-red-400 rounded-full opacity-8 blur-xl animate-pulse" style={{animationDelay: '4.2s'}}></div>
      </div>

      <div className="relative z-10 space-y-8 p-6">
        {/* Header ULTRA WOW 3D */}
        <div className="relative group overflow-hidden">
          <div 
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1.5rem',
              border: '1px solid rgba(229, 231, 235, 0.3)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              padding: '2rem'
            }}
          >
            {/* Glow animado en hover */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500"></div>
            
            <div className="relative flex items-center justify-between">
              {/* Back Button - Left Side */}
              <Back3DButton to="/inicio" title="Volver al Inicio" />

              {/* Title Section - Center */}
              <div className="flex items-center gap-6">
                <div 
                  className="relative group/icon overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    borderRadius: '1rem',
                    boxShadow: '0 15px 35px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    padding: '1rem',
                    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'perspective(1000px) rotateX(-5deg) rotateY(5deg) translateZ(10px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/icon:translate-x-[200%] transition-transform duration-1000"></div>
                  <span className="text-white text-3xl relative z-10">📄</span>
                </div>
                
                <div>
                  <h1 
                    className="text-4xl font-black mb-2 bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent"
                    style={{
                      textShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
                      filter: 'drop-shadow(0 2px 10px rgba(239, 68, 68, 0.2))'
                    }}
                  >
                    Documentos por Empleado
                  </h1>
                  <p 
                    className="text-gray-600 font-medium text-lg"
                    style={{
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    Gestiona documentos por empleado con estilo
                  </p>
                </div>
              </div>

              {/* Empty space to balance layout */}
              <div className="w-16"></div>
            </div>
          </div>
        </div>



        {/* Tabs de navegación ULTRA MODERN */}
        <div className="relative mb-6">
          {/* Background glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-2 border border-gray-200/50 shadow-xl">
            <div className="flex flex-wrap gap-2">
              
              {/* Tab Empleados */}
              <button
                onClick={() => setActiveTab('empleados')}
                className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'empleados'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-200'
                    : 'text-gray-600 hover:text-red-600 hover:bg-red-50/50'
                }`}
              >
                {/* Active glow */}
                {activeTab === 'empleados' && (
                  <div className="absolute inset-0 bg-red-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                )}
                <div className="relative flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <span>Empleados</span>
                </div>
              </button>

              {/* Tab Gestoría Nóminas */}
              <button
                onClick={() => setActiveTab('gestoria-nominas')}
                className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'gestoria-nominas'
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-200'
                    : 'text-gray-600 hover:text-teal-600 hover:bg-teal-50/50'
                }`}
              >
                {activeTab === 'gestoria-nominas' && (
                  <div className="absolute inset-0 bg-teal-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                )}
                <div className="relative flex items-center gap-2">
                  <span className="text-base">💼</span>
                  <span>Gestoría Nóminas</span>
                </div>
              </button>

              {/* Tab Coste Personal */}
              <button
                onClick={() => setActiveTab('coste-personal')}
                className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'coste-personal'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/50'
                }`}
              >
                {activeTab === 'coste-personal' && (
                  <div className="absolute inset-0 bg-indigo-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                )}
                <div className="relative flex items-center gap-2">
                  <span className="text-base">💰</span>
                  <span>Coste Personal</span>
                </div>
              </button>

              {selectedEmpleado && (
                <>
                  {/* Tab Documentos */}
                  <button
                    onClick={() => setActiveTab('documentos')}
                    className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                      activeTab === 'documentos'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50/50'
                    }`}
                  >
                    {activeTab === 'documentos' && (
                      <div className="absolute inset-0 bg-blue-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span>Documentos</span>
                    </div>
                  </button>

                  {/* Tab Nóminas */}
                  <button
                    onClick={() => setActiveTab('nominas')}
                    className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                      activeTab === 'nominas'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-200'
                        : 'text-gray-600 hover:text-green-600 hover:bg-green-50/50'
                    }`}
                  >
                    {activeTab === 'nominas' && (
                      <div className="absolute inset-0 bg-green-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center gap-2">
                      <span className="text-base">💰</span>
                      <span>Nóminas</span>
                    </div>
                  </button>

                  {/* Tab Documentos Empresa */}
                  <button
                    onClick={() => setActiveTab('documentos-empresa')}
                    className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                      activeTab === 'documentos-empresa'
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-200'
                        : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50/50'
                    }`}
                  >
                    {activeTab === 'documentos-empresa' && (
                      <div className="absolute inset-0 bg-purple-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <span>Empresa</span>
                    </div>
                  </button>

                  {/* Tab Subir Documentos */}
                  <button
                    onClick={() => setActiveTab('subir-documentos')}
                    className={`group relative px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                      activeTab === 'subir-documentos'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                        : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/50'
                    }`}
                  >
                    {activeTab === 'subir-documentos' && (
                      <div className="absolute inset-0 bg-orange-400 rounded-xl blur-md opacity-40 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center gap-2">
                      <span className="text-base">📤</span>
                      <span>Subir</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contenido de tabs */}
        <div 
          className="p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(229, 231, 235, 0.3)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          }}
        >

          {activeTab === 'empleados' && (
            <div>
              {/* Section Title and Search Bar - Side by Side */}
              <div className="flex items-center justify-between mb-8">
                {/* Section Title */}
                <div className="relative">
                  <h2 
                    className="text-2xl font-black bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent mb-2"
                    style={{
                      textShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
                      filter: 'drop-shadow(0 2px 10px rgba(239, 68, 68, 0.2))'
                    }}
                  >
                    Selecciona un Empleado
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-red-500 to-red-600 rounded-full"></div>
                </div>

                {/* Barra de búsqueda ULTRA WOW */}
                <div 
                  className="relative max-w-md group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '1rem',
                    border: '2px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 15px 35px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Glow animado en hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500"></div>
                  
                  <div className="relative flex items-center">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg 
                        className="h-6 w-6 text-red-400 group-hover:text-red-500 transition-colors duration-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))'
                        }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    <input
                      type="text"
                      placeholder="Buscar por nombre, email, código o grupo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 font-medium text-lg"
                      style={{
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                      }}
                    />

                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 group/clear"
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                        }}
                      >
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover/clear:bg-red-100 group-hover/clear:scale-110"
                        >
                          <svg 
                            className="h-5 w-5 text-red-400 group-hover/clear:text-red-600 transition-colors duration-300" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Search Results Counter */}
              {searchTerm && (
                <div className="mb-6">
                  <div 
                    className="inline-block px-4 py-2 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
                  }}
                >
                  <p 
                    className="text-sm font-bold text-red-700"
                    style={{
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {filteredEmpleados.length} empleado{filteredEmpleados.length !== 1 ? 's' : ''} encontrado{filteredEmpleados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {filteredEmpleados.length === 0 ? (
                <div 
                  className="text-center py-16"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '1.5rem',
                    border: '2px solid rgba(239, 68, 68, 0.1)',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                  }}
                >
                  <div className="text-6xl mb-4">🔍</div>
                  <p 
                    className="text-gray-600 font-medium text-lg"
                    style={{
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {searchTerm ? 'No se encontraron empleados con esa búsqueda.' : 'No hay empleados disponibles.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredEmpleados.map((empleado, idx) => (
                    <div 
                      key={empleado.CODIGO || idx}
                      className="group relative overflow-hidden cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '1.5rem',
                        border: '2px solid rgba(239, 68, 68, 0.1)',
                        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => handleEmpleadoSelect(empleado)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'perspective(1000px) rotateX(-5deg) rotateY(5deg) translateZ(20px)';
                        e.currentTarget.style.boxShadow = '0 25px 50px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
                        e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.1)';
                      }}
                    >
                      {/* Glow animado en hover */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500"></div>
                      
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                      
                      <div className="relative p-4 sm:p-6">
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <div 
                            className="relative group/avatar overflow-hidden flex-shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              borderRadius: '1rem',
                              boxShadow: '0 8px 25px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                              width: '2.5rem',
                              height: '2.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'perspective(1000px) rotateX(-10deg) rotateY(10deg) translateZ(10px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/avatar:translate-x-[200%] transition-transform duration-1000"></div>
                            {employeeAvatars[empleado.CODIGO] ? (
                              <img 
                                src={employeeAvatars[empleado.CODIGO]} 
                                alt={empleado['NOMBRE / APELLIDOS']} 
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <span className="text-white text-2xl relative z-10">
                                {empleado['NOMBRE / APELLIDOS']?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '👤'}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h3 
                              className="font-bold text-gray-900 text-base sm:text-lg mb-1 break-words"
                              style={{
                                textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              {empleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                            </h3>
                            <p 
                              className="text-xs sm:text-sm text-gray-600 mb-2 break-words"
                              style={{
                                textShadow: '0 1px 5px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              {empleado['CORREO ELECTRONICO'] || 'Sin email'}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <div 
                                className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-bold"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#dc2626',
                                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                }}
                              >
                                {empleado.GRUPO || 'Sin grupo'}
                              </div>
                              <div 
                                className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-bold"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',
                                  border: '1px solid rgba(34, 197, 94, 0.2)',
                                  color: '#16a34a',
                                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                }}
                              >
                                🎯 {calculateAntiguedad(empleado['FECHA DE ALTA'])}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {activeTab === 'documentos' && selectedEmpleado && (

            <div className="space-y-4">

              {/* Header compacto y responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">

                <div className="flex items-center gap-3">

                  <h2 className="text-lg sm:text-xl font-bold text-red-600 truncate">

                    Documentos de {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}

                  </h2>

                  <button

                    onClick={() => {

                      console.log('🔄 Refresh button clicked for:', selectedEmpleado);

                      setEmpleadoDocumentos([]);

                      fetchEmpleadoDocumentos(selectedEmpleado);

                    }}

                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 flex-shrink-0"

                    title="Actualizar documentos"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />

                    </svg>

                  </button>

                </div>

                <ChangeEmployee3DButton
                  onClick={() => setActiveTab('empleados')}
                  title="Cambiar Empleado"
                />

              </div>



              {/* Estadísticas para documentos normales */}
              {(() => {
                // Filtrar solo documentos normales (no nóminas ni justificantes)
                const documentosNormales = empleadoDocumentos.filter(doc => 
                  doc.tipo && 
                  doc.tipo !== 'Nómina' && 
                  !doc.tipo.includes('justificantes')
                );

                return (
                  <div className="flex justify-center mb-6">
                    {/* Total Documentos Normales */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200/50 hover:shadow-md transition-all duration-200 w-full max-w-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Documentos</p>
                          <p className="text-2xl font-bold text-blue-900">{documentosNormales.length}</p>
                        </div>
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}





              

              {/* Lista de documentos normales */}
              {(() => {
                // Filtrar solo documentos normales para la lista
                const documentosNormales = empleadoDocumentos.filter(doc => 
                  doc.tipo && 
                  doc.tipo !== 'Nómina' && 
                  !doc.tipo.includes('justificantes')
                );

                return documentosNormales.length === 0 ? (

                <div className="text-center text-gray-500 py-8">

                  <div className="text-4xl mb-4">📁</div>

                  <p className="text-lg font-medium mb-2">

                    No hay documentos

                  </p>

                  <p className="text-sm">

                    Este empleado no tiene documentos subidos

                  </p>

                </div>

              ) : (

                <div className="space-y-3">

                  {documentosNormales.map((documento, idx) => {

                    // Determinar el color del documento basado en el tipo
                    const getDocumentTypeStyle = (tipo) => {
                      if (tipo === 'Nómina') {
                        return {
                          bg: 'from-green-50 to-emerald-50',
                          border: 'border-green-200/50',
                          icon: 'from-green-500 to-green-600',
                          badge: 'bg-green-100 text-green-800 border-green-200'
                        };
                      } else if (tipo && tipo.includes('justificantes')) {
                        return {
                          bg: 'from-orange-50 to-amber-50',
                          border: 'border-orange-200/50',
                          icon: 'from-orange-500 to-orange-600',
                          badge: 'bg-orange-100 text-orange-800 border-orange-200'
                        };
                      } else {
                        return {
                          bg: 'from-blue-50 to-indigo-50',
                          border: 'border-blue-200/50',
                          icon: 'from-blue-500 to-blue-600',
                          badge: 'bg-blue-100 text-blue-800 border-blue-200'
                        };
                      }
                    };

                    const style = getDocumentTypeStyle(documento.tipo);

                    return (
                      <div key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} 
                           className={`group relative overflow-hidden bg-gradient-to-r ${style.bg} p-4 rounded-xl border ${style.border} hover:shadow-md transition-all duration-200`}>

                        {/* Header del documento */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                              <span className="text-gray-600 text-sm">📄</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-gray-900 truncate text-sm">{documento.fileName}</h3>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                                  {documento.tipo || 'Sin especificar'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(documento.uploadDate)}
                                </span>
                                {documento.tipo === 'Nómina' && documento.mes && documento.año && (
                                  <span className="text-xs text-blue-600">
                                    📊 {formatPeriodo(documento.mes, documento.año)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Información adicional compacta */}
                        <div className="flex flex-wrap text-xs text-gray-500 gap-2 mb-3">
                          {documento.correo_electronico && (
                            <span>📧 {documento.correo_electronico}</span>
                          )}
                          {documento.doc_id && (
                            <span>ID: {documento.doc_id}</span>
                          )}
                          {documento.id && (
                            <span>Emp: {documento.id}</span>
                          )}
                        </div>

                      

                        {/* Action Buttons - Responsive */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handlePreviewDocument(documento)}
                            className="group/btn relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="hidden sm:inline">Ver</span>
                          </button>

                          <button
                            onClick={() => handleDownloadDocument(documento)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Descargar</span>
                          </button>

                          <button
                            onClick={() => openDeleteConfirmModalDocumento(documento)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">Borrar</span>
                          </button>

                          <button
                            onClick={() => handleSignWithAutoFirma(documento)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                            title="Semnează cu AutoFirma"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="hidden sm:inline">AutoFirma</span>
                          </button>

                        </div>

                      </div>
                    );
                  })}

                </div>

              );
              })()}

            </div>

          )}



          {/* Tab Gestoría Nóminas (matriz) */}
          {activeTab === 'gestoria-nominas' && (
            <NominasMatrixTab />
          )}

          {/* Tab Coste Personal */}
          {activeTab === 'coste-personal' && (
            <CostePersonalTab />
          )}

          {activeTab === 'nominas' && selectedEmpleado && (

            <div className="space-y-4">

              {/* Header compacto y responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">

                <div className="flex items-center gap-3">

                  <h2 className="text-lg sm:text-xl font-bold text-red-600 truncate">

                    💰 Nóminas de {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}

                  </h2>

                  <button

                    onClick={() => fetchNominas(selectedEmpleado)}

                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 flex-shrink-0"

                    title="Actualizar nóminas"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />

                    </svg>

                  </button>

                </div>

                <ChangeEmployee3DButton
                  onClick={() => setActiveTab('empleados')}
                  title="Cambiar Empleado"
                />

              </div>



              {/* Estadísticas compactas para nóminas */}
              <div className="flex justify-center mb-6">
                {/* Total Nóminas */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200/50 hover:shadow-md transition-all duration-200 w-full max-w-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total Nóminas</p>
                      <p className="text-2xl font-bold text-green-900">{nominas.length}</p>
                    </div>
                    <div className="p-2 bg-green-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>



              {/* Lista de nóminas */}

              {nominasLoading ? (

                <div className="bg-gray-50 rounded-lg p-8 text-center">

                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>

                  <p className="text-gray-600">Cargando nóminas...</p>

                </div>

              ) : nominasError ? (

                <div className="bg-red-50 rounded-lg p-8 text-center">

                  <div className="text-6xl mb-4">❌</div>

                  <h3 className="text-xl font-medium text-red-900 mb-2">

                    Error al cargar nóminas

                  </h3>

                  <p className="text-red-600 mb-4">{nominasError}</p>

                  <button

                    onClick={() => fetchNominas(selectedEmpleado)}

                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"

                  >

                    Reintentar

                  </button>

                </div>

              ) : nominas.length === 0 ? (

                <div className="text-center py-12">

                  <div className="text-gray-300 text-8xl mb-6">💰</div>

                  <h3 className="text-2xl font-bold text-gray-600 mb-3">No se encontraron nóminas</h3>

                  <p className="text-gray-500 text-lg mb-2">No hay nóminas disponibles para este empleado</p>

                  <p className="text-gray-400 text-sm">Las nóminas aparecerán aquí cuando estén disponibles</p>

                </div>

              ) : (

                <div className="space-y-3">

                  {nominas.map((nomina, idx) => (

                    <div key={`nomina-${nomina.id}-${idx}-${nomina.fileName}`} className="group relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200/50 hover:shadow-md transition-all duration-200">

                      {/* Header de la nómina */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="text-green-600 text-sm">💰</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-gray-900 truncate text-sm">{nomina.fileName}</h4>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                Nómina
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(nomina.uploadDate)}
                              </span>
                              {(formatPeriodo(nomina.mes, nomina.año) || nomina.periodo) && (
                                <span className="text-xs text-green-600">
                                  📊 {formatPeriodo(nomina.mes, nomina.año) || nomina.periodo}
                                </span>
                              )}
                              {nomina.salario > 0 && (
                                <span className="text-xs text-green-600">
                                  💵 €{nomina.salario.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Responsive */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handlePreviewDocument(nomina)}
                          className="group/btn relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center space-x-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="hidden sm:inline">Ver</span>
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              const downloadUrl = `${routes.downloadNomina}?id=${nomina.id}&nombre=${encodeURIComponent(selectedEmpleado['NOMBRE / APELLIDOS'] || '')}`;
                              // Add JWT token for backend API calls
                              const token = localStorage.getItem('auth_token');
                              const fetchHeaders = {};
                              if (token) {
                                fetchHeaders['Authorization'] = `Bearer ${token}`;
                              }
                              const response = await fetch(downloadUrl, { headers: fetchHeaders });

                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = nomina.fileName || 'nomina';
                                a.style.display = 'none';
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              }
                            } catch (error) {
                              console.error('Error descargando nómina:', error);
                            }
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="hidden sm:inline">Descargar</span>
                        </button>

                        <button
                          onClick={() => openDeleteConfirmModal(nomina)}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="hidden sm:inline">Borrar</span>
                        </button>
                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

          )}



          {activeTab === 'documentos-empresa' && selectedEmpleado && (

            <div className="space-y-4">

              {/* Header compacto y responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">

                <div className="flex items-center gap-3">

                  <h2 className="text-lg sm:text-xl font-bold text-red-600 truncate">

                    🏢 Documentos Empresa de {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}

                  </h2>

                  <button

                    onClick={() => fetchDocumentosOficiales(selectedEmpleado)}

                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 flex-shrink-0"

                    title="Actualizar documentos empresa"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />

                    </svg>

                  </button>

                </div>

                <ChangeEmployee3DButton
                  onClick={() => setActiveTab('empleados')}
                  title="Cambiar Empleado"
                />

              </div>

















              {/* Estadísticas compactas para documentos empresa */}
              <div className="flex justify-center mb-6">
                {/* Total Documentos Oficiales */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200/50 hover:shadow-md transition-all duration-200 w-full max-w-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Documentos Oficiales</p>
                      <p className="text-2xl font-bold text-purple-900">{documentosOficiales.length}</p>
                    </div>
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de documentos empresa */}
              {documentosOficialesLoading ? (

                  <div className="text-center py-8">

                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>

                    <p className="text-gray-600">Cargando documentos oficiales...</p>

                    </div>

                ) : documentosOficialesError ? (

                  <div className="text-center py-8">

                    <div className="text-4xl mb-4">❌</div>

                    <p className="text-red-600 mb-2">Error al cargar documentos oficiales</p>

                    <p className="text-gray-600 text-sm">{documentosOficialesError}</p>

                    <button

                      onClick={() => fetchDocumentosOficiales(selectedEmpleado)}

                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"

                    >

                      Reintentar

                    </button>

                    </div>

                ) : documentosOficiales.length === 0 ? (

                  <div className="text-center py-12">

                    <div className="text-gray-300 text-8xl mb-6">🏢</div>

                    <h3 className="text-2xl font-bold text-gray-600 mb-3">No se encontraron documentos oficiales</h3>

                    <p className="text-gray-500 text-lg mb-2">No hay documentos oficiales disponibles para este empleado</p>

                    <p className="text-gray-400 text-sm">Los documentos oficiales aparecerán aquí cuando estén disponibles</p>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {documentosOficiales.map((documento, idx) => (

                      <div key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} className="group relative overflow-hidden bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-200/50 hover:shadow-md transition-all duration-200">

                        {/* Header del documento */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                              <span className="text-purple-600 text-sm">📄</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate text-sm">
                                {documento.fileName || `Documento Oficial ${idx + 1}`}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                  {documento.tipo || 'Sin especificar'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(documento.uploadDate)}
                                </span>
                                {documento.fileSize > 0 && (
                                  <span className="text-xs text-gray-500">
                                    {(documento.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Información adicional compacta */}
                        <div className="flex flex-wrap text-xs text-gray-500 gap-2 mb-3">
                          {documento.correo_electronico && (
                            <span>📧 {documento.correo_electronico}</span>
                          )}
                          {documento.doc_id && (
                            <span>ID: {documento.doc_id}</span>
                          )}
                          {documento.id && (
                            <span>Emp: {documento.id}</span>
                          )}
                        </div>


                        {/* Action Buttons - Responsive */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handlePreviewDocument(documento)}
                            className="group/btn relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="hidden sm:inline">Ver</span>
                          </button>

                          <button
                            onClick={() => handleDownloadDocumentOficial(documento)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Descargar</span>
                          </button>

                          <button
                            onClick={() => openDeleteConfirmModalDocumentoOficial(documento)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">Borrar</span>
                          </button>

                          <button
                            onClick={() => handleSignWithAutoFirma(documento)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                            title="Semnează cu AutoFirma"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="hidden sm:inline">AutoFirma</span>
                          </button>
                        </div>

                      </div>

                    ))}

                  </div>

                )}

            </div>

          )}



          {activeTab === 'subir-documentos' && selectedEmpleado && (

            <div>

              <div className="flex items-center justify-between mb-6">

                <h2 className="text-xl font-bold text-red-600">

                  Subir Documentos para {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}

                </h2>

                <ChangeEmployee3DButton
                  onClick={() => setActiveTab('empleados')}
                  title="Cambiar Empleado"
                />

              </div>



              <div className="bg-gray-50 rounded-lg p-8 text-center">

                <div className="text-6xl mb-4">📤</div>

                <h3 className="text-xl font-medium text-gray-900 mb-2">

                  Subir Documentos

                </h3>

                <p className="text-gray-600 mb-6">

                  Selecciona uno o varios archivos para subir como documentos del empleado

                </p>

                

                              <div className="space-y-6">

                <input

                  ref={fileInputRef}

                  type="file"

                  multiple

                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"

                  onChange={handleFileUpload}

                  className="hidden"

                />

                

                {/* Botón para documentos normales */}

                <div className="text-center">

                  <h4 className="text-lg font-medium text-gray-900 mb-3">📄 Documentos Normales</h4>

                  <p className="text-sm text-gray-600 mb-4">

                    Documentos personales, justificantes, certificados, etc.

                  </p>

                  <button

                    onClick={handleUploadClick}

                    disabled={uploading}

                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-3 px-8 rounded-lg transition-colors"

                  >

                    {uploading ? (

                      <span className="flex items-center">

                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>

                        Subiendo...

                      </span>

                    ) : (

                      '📁 Subir Documentos Normales'

                    )}

                  </button>

                </div>



                {/* Separador visual */}

                <div className="flex items-center">

                  <div className="flex-1 border-t border-gray-300"></div>

                  <span className="px-4 text-sm text-gray-500">o</span>

                  <div className="flex-1 border-t border-gray-300"></div>

                </div>



                {/* Botón para documentos oficiales de empresa */}

                <div className="text-center">

                  <h4 className="text-lg font-medium text-gray-900 mb-3">🏢 Documentos Oficiales de Empresa</h4>

                  <p className="text-sm text-gray-600 mb-4">

                    Contratos, certificados oficiales, etc.

                  </p>

                  <button

                    onClick={() => {

                      console.log('🏢 Botón de documentos oficiales clickeado');

                      setUploadType('oficial');

                      console.log('📝 UploadType establecido a:', 'oficial');

                      // Pequeña pausa para asegurar que el estado se actualice

                      setTimeout(() => {

                        if (fileInputRef.current) {

                          console.log('📁 Abriendo selector de archivos');

                          fileInputRef.current.click();

                        }

                      }, 100);

                    }}

                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"

                  >

                    🏢 Subir Documentos Oficiales

                  </button>

                  <p className="text-xs text-blue-600 mt-2">

                    📄 Endpoint dedicado para documentos oficiales

                  </p>

                </div>



                {/* Separador */}

                <div className="flex items-center">

                  <div className="flex-1 border-t border-gray-300"></div>

                  <span className="px-4 text-sm text-gray-500">o</span>

                  <div className="flex-1 border-t border-gray-300"></div>

                </div>



                {/* Botón para nóminas */}

                <div className="text-center">

                  <h4 className="text-lg font-medium text-gray-900 mb-3">💰 Subir Nóminas</h4>

                  <p className="text-sm text-gray-600 mb-4">

                    Nóminas de salario, recibos de nómina, etc.

                  </p>

                  <button

                    onClick={() => {

                      console.log('💰 Botón de nóminas clickeado');

                      setUploadType('nomina');

                      console.log('📝 UploadType establecido a:', 'nomina');

                      // Pequeña pausa para asegurar que el estado se actualice

                      setTimeout(() => {

                      if (fileInputRef.current) {

                          console.log('📁 Abriendo selector de archivos');

                        fileInputRef.current.click();

                      }

                      }, 100);

                    }}

                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"

                  >

                    💰 Subir Nómina

                  </button>

                  <p className="text-xs text-green-600 mt-2">

                    📄 Endpoint dedicado para nóminas

                  </p>

                </div>

                

                <p className="text-sm text-gray-500 text-center">

                  Formatos soportados: PDF, DOC, DOCX, JPG, PNG, TXT

                </p>

              </div>

              </div>



              {/* Lista de archivos recién subidos */}

              {empleadoDocumentos.length > 0 && (

                <div className="mt-8">

                  <h4 className="text-lg font-medium text-gray-900 mb-4">Documentos Recién Subidos</h4>

                                      <div className="space-y-3">

                      {empleadoDocumentos.map((documento, idx) => (

                        <div key={`uploaded-${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">

                        <div className="flex items-center space-x-3">

                          <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">

                            <span className="text-green-600 text-xs">✅</span>

                          </div>

                          <div>

                            <p className="font-medium text-gray-900">{documento.fileName}</p>

                            <p className="text-xs text-gray-500">

                              {documento.fileSize ? `${(documento.fileSize / 1024).toFixed(1)} KB` : ''} • 

                              {formatDate(documento.uploadDate)} • Tipo: {documento.tipo || 'Sin especificar'}

                            </p>

                          </div>

                        </div>



                      </div>

                    ))}

                  </div>

                </div>

              )}

            </div>

          )}

        </div>

      </div>

      {/* Modal para selección de tipo de documento */}
      {showUploadModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-lg font-bold text-gray-900">

                📋 Configurar Documentos

              </h3>

              <button

                onClick={handleUploadCancel}

                className="text-gray-400 hover:text-gray-600"

              >

                ✕

              </button>

            </div>



            <div className="space-y-4">

              {/* Información de archivos seleccionados */}

              <div className="bg-gray-50 rounded-lg p-4">

                <h4 className="font-medium text-gray-900 mb-2">Archivos Seleccionados:</h4>

                <div className="space-y-2">

                  {selectedFiles.map((file, index) => (

                    <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">

                      <span className="text-blue-600">📄</span>

                      <span className="truncate">{file.name}</span>

                      <span className="text-gray-400">

                        ({(file.size / 1024).toFixed(1)} KB)

                      </span>

                    </div>

                  ))}

                </div>

              </div>



              {/* Campos individuales para tipo de documento por archivo */}

              <div className="space-y-4">

                <h4 className="font-medium text-gray-900 mb-2">Tipos de Documento por Archivo:</h4>

                {selectedFiles.map((file, index) => (

                  <div key={index} className="space-y-2">

                    <label className="block text-sm font-medium text-gray-700">

                      📄 {file.name} *

                </label>

                <input

                  type="text"

                  placeholder="Ej: Justificante médico, Certificado de estudios, Contrato laboral, etc."

                      value={documentTypes[index] || ''}

                      onChange={(e) => setDocumentTypes(prev => ({

                        ...prev,

                        [index]: e.target.value

                      }))}

                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"

                  required

                />

                    <p className="text-xs text-gray-500">

                      Describe brevemente el tipo de documento para este archivo

                </p>

                  </div>

                ))}

              </div>



              {/* Botones de acción */}

              <div className="flex space-x-3 pt-4">

                <button

                  onClick={handleUploadCancel}

                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"

                >

                  Cancelar

                </button>

                <button

                  onClick={handleUploadConfirm}

                  disabled={uploading || !Object.values(documentTypes).every(type => type.trim())}

                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"

                >

                  {uploading ? (

                    <span className="flex items-center justify-center">

                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>

                      Subiendo...

                    </span>

                  ) : (

                    'Subir Documentos'

                  )}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



      {/* Información */}

      <Card>

        <h3 className="text-lg font-bold text-red-600 mb-3">Información</h3>

        <div className="space-y-2 text-sm text-gray-600">

          <p>• Selecciona un empleado para ver sus documentos</p>

          <p>• Visualiza estadísticas de documentos y nóminas</p>

          <p>• Accede a la lista completa de documentos del empleado</p>

          <p>• Gestiona nóminas y recibos de salario</p>

          <p>• Visualiza y descarga documentos existentes</p>

          <p>• Sube nuevos documentos para cada empleado</p>

          <p>• Formatos soportados: PDF, DOC, DOCX, JPG, PNG, TXT</p>

          <p>• Todas las acciones son registradas en el sistema</p>

        </div>

      </Card>



      {/* Modal para preview de documentos */}

      {showPreviewModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">

            <div className="flex items-center justify-between mb-4">

                             <h3 className="text-lg font-bold text-gray-900">

                 👁️ Preview: {previewDocument?.fileName || 'Documento'}

                 {previewDocument?.tipo === 'Nómina' && <span className="ml-2 text-sm text-green-600">(Nómina)</span>}

               </h3>

              <button

                onClick={handleClosePreview}

                className="text-gray-400 hover:text-gray-600 text-xl"

              >

                ✕

              </button>

            </div>



            <div className="flex-1 overflow-hidden">

              {previewLoading ? (

                <div className="flex items-center justify-center py-12">

                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>

                  <span className="ml-3 text-gray-600">Cargando preview...</span>

                </div>

              ) : previewError ? (

                <div className="text-center py-12">

                  <div className="text-6xl mb-4">❌</div>

                  <p className="text-lg font-medium text-gray-900 mb-2">

                    Error al cargar el preview

                  </p>

                  <p className="text-gray-600 mb-4">{previewError}</p>

                  <button

                    onClick={handleClosePreview}

                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"

                  >

                    Cerrar

                  </button>

                </div>

              ) : (

                <div className="space-y-4">

                  {/* Información del documento */}

                  <div className="bg-gray-50 rounded-lg p-4">

                    <div className="grid grid-cols-2 gap-4 text-sm">

                      <div>

                        <span className="font-medium text-gray-700">Nombre:</span>

                        <p className="text-gray-900">{previewDocument?.fileName}</p>

                      </div>

                      <div>

                        <span className="font-medium text-gray-700">Tipo:</span>

                        <p className="text-gray-900">{previewDocument?.tipo || 'Sin especificar'}</p>

                      </div>

                      <div>

                        <span className="font-medium text-gray-700">Fecha:</span>

                        <p className="text-gray-900">{previewDocument?.uploadDate ? formatDate(previewDocument.uploadDate) : 'N/A'}</p>

                      </div>

                      <div>

                        <span className="font-medium text-gray-700">Tamaño:</span>

                        <p className="text-gray-900">{previewDocument?.fileSize ? `${(previewDocument.fileSize / 1024).toFixed(1)} KB` : 'N/A'}</p>

                      </div>

                      {previewDocument?.tipo === 'Nómina' && previewDocument?.mes && previewDocument?.año && (

                        <div>

                          <span className="font-medium text-gray-700">Período:</span>

                          <p className="text-gray-900 text-primary-600">{formatPeriodo(previewDocument.mes, previewDocument.año)}</p>

                        </div>

                      )}

                    </div>

                  </div>



                  {/* Contenido del documento */}

                  <div className="border border-gray-200 rounded-lg overflow-hidden">

                    {previewDocument?.fileName?.toLowerCase().endsWith('.txt') && previewDocument?.content ? (

                      <div className="p-4 bg-gray-50 max-h-96 overflow-y-auto">

                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{previewDocument.content}</pre>

                      </div>

                    ) : (previewDocument?.isImage === true) || previewDocument?.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (

                      <div className="p-4 bg-gray-50 max-h-96 overflow-y-auto">

                        <img 

                          src={previewDocument?.previewUrl || ''}

                          alt={previewDocument?.fileName || 'Documento'}

                          className={`max-w-full h-auto mx-auto rounded-lg shadow-2xl ${
                            isIOS ? 'brightness-100 contrast-100' : ''
                          }`}

                          style={{

                            ...(isIOS && {

                              filter: 'none',

                              WebkitFilter: 'none',

                              imageRendering: 'auto',

                              WebkitImageRendering: 'auto',

                              backgroundColor: 'transparent'

                            })

                          }}

                          onError={(e) => {

                            e.target.style.display = 'none';

                            e.target.nextSibling.style.display = 'block';

                          }}

                        />

                        <div className="hidden text-center">

                          <p className="text-gray-600 mb-4">🖼️ Error al cargar la imagen</p>

                          <p className="text-sm text-gray-500">La imagen no se pudo cargar, usa el botón de descarga</p>

                        </div>

                      </div>

                    ) : (
                      // PDF viewer activ doar dacă știm că e PDF (flag sau extensie),
                      // pentru a evita trimiterea imaginilor prin PDF.js
                      previewDocument?.isPdf === true ||
                      previewDocument?.fileName?.toLowerCase().endsWith('.pdf') ||
                      activeTab === 'oficiales' ||
                      previewDocument?.tipo === 'Documento Oficial' ||
                      previewDocument?.tipo === 'sello' ||
                      previewDocument?.tipo?.startsWith('contrato') ||
                      previewDocument?.tipo?.startsWith('alta') ||
                      previewDocument?.tipo?.includes('alta') ||
                      previewDocument?.tipo?.includes('contrato') ||
                      previewDocument?.tipo?.includes('oficial') ||
                      previewDocument?.tipo?.includes('sello')
                    ) ? (

                      <div className="pdf-preview-container">

                        <ContractSigner

                          pdfUrl={previewDocument?.previewUrl || ''}

                          docId={previewDocument?.id || ''}

                          originalFileName={previewDocument?.fileName || ''}

                          onClose={handleClosePreview}

                        />

                      </div>

                    ) : previewDocument?.fileName?.toLowerCase().match(/\.(doc|docx)$/i) ? (

                      <div className="p-4 bg-gray-50 text-center">

                        <div className="text-6xl mb-4">📄</div>

                        <p className="text-gray-600 mb-4">Documento Word disponible para descarga</p>

                        <p className="text-sm text-gray-500">Los archivos .doc/.docx se abren mejor con Microsoft Word o LibreOffice</p>

                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">

                          <p className="text-sm text-blue-800">

                            💡 <strong>Consejo:</strong> Descarga el archivo y ábrelo con tu aplicación de procesamiento de texto preferida

                          </p>

                        </div>

                      </div>

                    ) : (

                      <div className="p-4 bg-gray-50 text-center">

                        <p className="text-gray-600 mb-4">📄 Documento disponible para descarga</p>

                        <p className="text-sm text-gray-500">Este tipo de archivo se muestra mejor al descargarlo</p>

                      </div>

                    )}

                  </div>



                  {/* Butoanele de jos eliminate - se folosește doar X-ul din dreapta sus */}





                </div>

              )}

            </div>

          </div>

        </div>

      )}







      {/* Modal separado para nóminas */}

      {showNominaUploadModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-lg font-bold text-gray-900">

                💰 Configurar Nómina

              </h3>

              <button

                onClick={() => {

                  setShowNominaUploadModal(false);

                  setSelectedFiles([]);

                  setSelectedMonth(new Date().getMonth());

                    setSelectedYear(new Date().getFullYear());

                }}

                className="text-gray-400 hover:text-gray-600"

              >

                ✕

              </button>

            </div>



            <div className="space-y-4">

              {/* Información de archivos seleccionados */}

              <div className="bg-gray-50 rounded-lg p-4">

                <h4 className="font-medium text-gray-900 mb-2">Archivos Seleccionados:</h4>

                <div className="space-y-2">

                  {selectedFiles.map((file, index) => (

                    <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">

                      <span className="text-green-600">💰</span>

                      <span className="truncate">{file.name}</span>

                      <span className="text-gray-400">

                        ({(file.size / 1024).toFixed(1)} KB)

                      </span>

                    </div>

                  ))}

                </div>

              </div>



              {/* Selector de mes para la nómina */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-2">

                  Mes de la Nómina *

                </label>

                <select

                  value={selectedMonth}

                  onChange={(e) => {

                    const monthValue = parseInt(e.target.value);

                    console.log('📅 Mes seleccionado (índice):', monthValue);

                    console.log('📅 Mes seleccionado (número real):', monthValue + 1);

                    setSelectedMonth(monthValue);

                  }}

                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"

                >

                  <option value={0}>Enero (1)</option>

                  <option value={1}>Febrero (2)</option>

                  <option value={2}>Marzo (3)</option>

                  <option value={3}>Abril (4)</option>

                  <option value={4}>Mayo (5)</option>

                  <option value={5}>Junio (6)</option>

                  <option value={6}>Julio (7)</option>

                  <option value={7}>Agosto (8)</option>

                  <option value={8}>Septiembre (9)</option>

                  <option value={9}>Octubre (10)</option>

                  <option value={10}>Noviembre (11)</option>

                  <option value={11}>Diciembre (12)</option>

                </select>

                <p className="text-xs text-gray-500 mt-1">

                  Selecciona el mes al que corresponde esta nómina. 

                  <br />

                  <span className="text-blue-600 font-medium">

                    💡 El backend recibirá el número real del mes (1-12)

                  </span>

                </p>

              </div>



              {/* Selector de año para la nómina */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-2">

                  Año de la Nómina *

                </label>

                <select

                  value={selectedYear}

                  onChange={(e) => {

                    const yearValue = parseInt(e.target.value);

                    console.log('📅 Año seleccionado:', yearValue);

                    setSelectedYear(yearValue);

                  }}

                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"

                >

                  {Array.from({ length: 10 }, (_, i) => {

                    const year = new Date().getFullYear() - 2 + i;

                    return (

                      <option key={year} value={year}>

                        {year}

                      </option>

                    );

                  })}

                </select>

                <p className="text-xs text-gray-500 mt-1">

                  Selecciona el año al que corresponde esta nómina.

                  <br />

                  <span className="text-blue-600 font-medium">

                    💡 El backend recibirá el año completo (ej: 2025)

                  </span>

                </p>

              </div>



              {/* Botones de acción */}

              <div className="flex justify-end space-x-3 pt-4">

                <button

                  onClick={() => {

                    setShowNominaUploadModal(false);

                    setSelectedFiles([]);

                    setSelectedMonth(new Date().getMonth());

                    setSelectedYear(new Date().getFullYear());

                  }}

                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"

                >

                  Cancelar

                </button>

                <button

                  onClick={handleUploadConfirm}

                  disabled={uploading}

                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"

                >

                  {uploading ? 'Subiendo...' : '💰 Subir Nómina'}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



      {/* Modal de Confirmare de Borrado de Nómina */}

      {showDeleteConfirmModal && nominaToDelete && (

        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-4 border-red-100">

            {/* Header */}

            <div className="flex items-center justify-between p-6 border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-white">

              <div className="flex items-center gap-3">

                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">

                  <span className="text-red-600 text-2xl">🗑️</span>

                </div>

                <div>

                  <h3 className="text-xl font-bold text-gray-900">Confirmar Borrado</h3>

                  <p className="text-sm text-red-600 font-medium">Acción irreversible</p>

                </div>

              </div>

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setNominaToDelete(null);

                }}

                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110"

              >

                ×

              </button>

            </div>



            {/* Content */}

            <div className="p-6">

              <div className="text-center mb-6">

                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">

                  <span className="text-red-600 text-4xl">⚠️</span>

                </div>

                <h4 className="text-lg font-semibold text-gray-900 mb-2">

                  ¿Estás seguro de que quieres borrar esta nómina?

                </h4>

                <p className="text-gray-600 mb-4">

                  <span className="font-medium text-red-600">{nominaToDelete.fileName}</span>

                </p>

                <p className="text-sm text-gray-500">

                  Esta acción no se puede deshacer. La nómina será eliminada permanentemente del sistema.

                </p>

              </div>

            </div>



            {/* Footer */}

            <div className="flex justify-between items-center p-6 border-t-2 border-red-200 bg-gradient-to-r from-white to-red-50">

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setNominaToDelete(null);

                }}

                className="px-6 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-lg font-medium transition-all duration-200"

              >

                ✕ Cancelar

              </button>

              <button

                onClick={async () => {

                  setShowDeleteConfirmModal(false);

                  await handleDeleteNomina(nominaToDelete);

                  setNominaToDelete(null);

                }}

                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"

              >

                🗑️ Sí, Borrar

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Modal de Confirmare de Borrado de Documento Normal */}

      {showDeleteConfirmModal && documentoToDelete && (

        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-4 border-red-100">

            {/* Header */}

            <div className="flex items-center justify-between p-6 border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-white">

              <div className="flex items-center gap-3">

                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">

                  <span className="text-red-600 text-2xl">🗑️</span>

                </div>

                <div>

                  <h3 className="text-xl font-bold text-gray-900">Confirmar Borrado</h3>

                  <p className="text-sm text-red-600 font-medium">Acción irreversible</p>

                </div>

              </div>

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setDocumentoToDelete(null);

                }}

                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110"

              >

                ×

              </button>

            </div>



            {/* Content */}

            <div className="p-6">

              <div className="text-center mb-6">

                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">

                  <span className="text-red-600 text-4xl">⚠️</span>

                </div>

                <h4 className="text-lg font-semibold text-gray-900 mb-2">

                  ¿Estás seguro de que quieres borrar este documento?

                </h4>

                <p className="text-gray-600 mb-4">

                  <span className="font-medium text-red-600">{documentoToDelete.fileName}</span>

                </p>

                <p className="text-sm text-gray-500">

                  Esta acción no se puede deshacer. El documento será eliminado permanentemente del sistema.

                </p>

              </div>

            </div>



            {/* Footer */}

            <div className="flex justify-between items-center p-6 border-t-2 border-red-200 bg-gradient-to-r from-white to-red-50">

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setDocumentoToDelete(null);

                }}

                className="px-6 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-lg font-medium transition-all duration-200"

              >

                ✕ Cancelar

              </button>

              <button

                onClick={async () => {

                  setShowDeleteConfirmModal(false);

                  await handleDeleteDocumento(documentoToDelete);

                  setDocumentoToDelete(null);

                }}

                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"

              >

                🗑️ Sí, Borrar

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Modal de Confirmare de Borrado de Documento Oficial */}

      {showDeleteConfirmModal && documentoOficialToDelete && (

        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-4 border-red-100">

            {/* Header */}

            <div className="flex items-center justify-between p-6 border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-white">

              <div className="flex items-center gap-3">

                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">

                  <span className="text-red-600 text-2xl">🗑️</span>

                </div>

                <div>

                  <h3 className="text-xl font-bold text-gray-900">Confirmar Borrado</h3>

                  <p className="text-sm text-red-600 font-medium">Acción irreversible</p>

                </div>

              </div>

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setDocumentoOficialToDelete(null);

                }}

                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110"

              >

                ×

              </button>

            </div>



            {/* Content */}

            <div className="p-6">

              <div className="text-center mb-6">

                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">

                  <span className="text-red-600 text-4xl">⚠️</span>

                </div>

                <h4 className="text-lg font-semibold text-gray-900 mb-2">

                  ¿Estás seguro de que quieres borrar este documento oficial?

                </h4>

                <p className="text-gray-600 mb-4">

                  <span className="font-medium text-red-600">{documentoOficialToDelete.fileName}</span>

                </p>

                <p className="text-sm text-gray-500">

                  Esta acción no se puede deshacer. El documento oficial será eliminado permanentemente del sistema.

                </p>

              </div>

            </div>



            {/* Footer */}

            <div className="flex justify-between items-center p-6 border-t-2 border-red-200 bg-gradient-to-r from-white to-red-50">

              <button

                onClick={() => {

                  setShowDeleteConfirmModal(false);

                  setDocumentoOficialToDelete(null);

                }}

                className="px-6 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-lg font-medium transition-all duration-200"

              >

                ✕ Cancelar

              </button>

              <button

                onClick={async () => {

                  setShowDeleteConfirmModal(false);

                  await handleDeleteDocumentoOficial(documentoOficialToDelete);

                  setDocumentoOficialToDelete(null);

                }}

                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"

              >

                🗑️ Sí, Borrar

              </button>

            </div>

          </div>

        </div>

      )}

      {/* Component de notificare */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        duration={notification.duration}
        onClose={hideNotification}
      />
    </div>
  );
} 

function calculateAntiguedad(fechaAlta) {
  if (!fechaAlta) return 'Sin fecha';

  try {
    const altaDate = new Date(fechaAlta);
    const now = new Date();
    const diffTime = Math.abs(now - altaDate);
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
    const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));

    if (diffYears > 0) {
      return `${diffYears} año${diffYears !== 1 ? 's' : ''}${diffMonths > 0 ? ` y ${diffMonths} mes${diffMonths !== 1 ? 'es' : ''}` : ''}`;
    } else if (diffMonths > 0) {
      return `${diffMonths} mes${diffMonths !== 1 ? 'es' : ''}`;
    } else {
      return 'Menos de 1 mes';
    }
  } catch (error) {
    console.error('Error calculating antigüedad:', error);
    return 'Sin fecha';
  }
}
