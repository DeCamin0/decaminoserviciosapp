import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../contexts/AuthContextBase';

import ContractSigner from '../components/ContractSigner';
import PDFViewerAndroid from '../components/PDFViewerAndroid';

import { Link } from 'react-router';

import EmailIngestionButton from '../components/EmailIngestionButton';
import FolderIngestionButton from '../components/FolderIngestionButton';

import { LoadingSpinner, PageHeader, AlertBanner, SegmentedControl, Modal } from '../components/ui';

import Notification from '../components/ui/Notification';
import {
  Search, X, RefreshCw, ArrowLeft, Eye, FileSpreadsheet, Wrench,
  FileUp, Archive, GraduationCap, Download, CheckCircle2, AlertTriangle,
} from 'lucide-react';

import { routes } from '../utils/routes.js';
import { fetchAvatarOnce, getCachedAvatar, DEFAULT_AVATAR, mapBulkAvatarsResponse, isRealAvatarUrl } from '../utils/avatarCache';

import activityLogger from '../utils/activityLogger';
import NominasMatrixTab from '../components/gestoria/NominasMatrixTab';
import CostePersonalTab from '../components/gestoria/CostePersonalTab';
import CertificadosRetencionesTab from '../components/gestoria/CertificadosRetencionesTab';
import { isContratoDocumento } from '../constants/contratoPdfSignatureLayout';
import { exportToExcelWithHeader } from '../utils/exportExcel';
import { config } from '../config/env.js';
import { getPdfMake } from '../utils/getPdfMake';

// Branding din config (multi-client)
const rawColor = config.PRIMARY_COLOR || '#CC0000';
const PRIMARY_COLOR = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
if (import.meta.env.DEV) {
  console.log('🎨 [DocumentosEmpleadosPage] PRIMARY_COLOR:', PRIMARY_COLOR, '| from config');
}

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

      const avatarsMap = mapBulkAvatarsResponse(data);

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
  const fetchDocumentosOficialesInProgressRef = useRef(false);
  const activeAvatarRequestsRef = useRef(0);
  const pendingAvatarRequestsRef = useRef(new Set());

  useEffect(() => {
    employeeAvatarsRef.current = employeeAvatars;
  }, [employeeAvatars]);

  useEffect(() => {
    fetchBulkAvatars();
  }, [fetchBulkAvatars]);

  const loadEmployeeAvatar = useCallback(async (codigo, nombre) => {
    if (!codigo) return;

    if (isRealAvatarUrl(employeeAvatarsRef.current[codigo])) {
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
    if (isRealAvatarUrl(employeeAvatarsRef.current[codigo])) return;
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
        !isRealAvatarUrl(employeeAvatarsRef.current[empleado.CODIGO])
      ) {
        enqueueAvatar(empleado.CODIGO, empleado['NOMBRE / APELLIDOS']);
      }
    });
  }, [bulkAvatarsLoaded, empleados, enqueueAvatar]);

  const [activeTab, setActiveTab] = useState('empleados'); // 'empleados', 'gestoria-nominas', 'coste-personal', 'diplomas', 'certificados-retenciones'
  const [activeEmpleadoTab, setActiveEmpleadoTab] = useState('documentos'); // 'documentos', 'nominas', 'documentos-empresa', 'documentos-prl', 'subir-documentos'

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

  // Estado para el sistema de firma de documentos oficiales
  const [showOficialSigner, setShowOficialSigner] = useState(false);
  const [documentoOficialToSign, setDocumentoOficialToSign] = useState(null);
  const [documentoOficialPdfUrl, setDocumentoOficialPdfUrl] = useState(null);



  // Estado para el modal de confirmación de borrado

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  // State pentru modal cu lista de angajați și statusul contractelor
  const [showContratosModal, setShowContratosModal] = useState(false);
  const [empleadosContratos, setEmpleadosContratos] = useState([]);
  const [loadingContratos, setLoadingContratos] = useState(false);

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
  const [aplicandoSelloDocId, setAplicandoSelloDocId] = useState(null);
  const [documentoSelloToConfirm, setDocumentoSelloToConfirm] = useState(null);

  // Estado para documentos PRL del empleado
  const [documentosPrl, setDocumentosPrl] = useState([]);
  const [documentosPrlLoading, setDocumentosPrlLoading] = useState(false);
  const [documentosPrlError, setDocumentosPrlError] = useState(null);
  const fetchDocumentosPrlInProgressRef = useRef(false);

  // Estado para diplomas
  const [diplomasPreview, setDiplomasPreview] = useState(null);
  const [diplomasLoading, setDiplomasLoading] = useState(false);
  const [diplomasError, setDiplomasError] = useState(null);
  const [diplomasZipFile, setDiplomasZipFile] = useState(null);
  const [diplomasSeleccionadas, setDiplomasSeleccionadas] = useState([]);
  const [diplomasGuardando, setDiplomasGuardando] = useState(false);
  
  // Estados para upload individual de PDFs
  const [diplomasPdfsFiles, setDiplomasPdfsFiles] = useState([]);
  const [diplomasPdfsPreview, setDiplomasPdfsPreview] = useState(null);
  const [diplomasPdfsLoading, setDiplomasPdfsLoading] = useState(false);
  const [diplomasPdfsError, setDiplomasPdfsError] = useState(null);
  const [diplomasPdfsSeleccionadas, setDiplomasPdfsSeleccionadas] = useState([]);
  const [diplomasPdfsGuardando, setDiplomasPdfsGuardando] = useState(false);
  
  // Estado para lista de todas las diplomas
  const [todasLasDiplomas, setTodasLasDiplomas] = useState([]);
  const [todasLasDiplomasLoading, setTodasLasDiplomasLoading] = useState(false);
  const [todasLasDiplomasError, setTodasLasDiplomasError] = useState(null);

  // Función para cargar todas las diplomas
  const fetchTodasLasDiplomas = useCallback(async () => {
    setTodasLasDiplomasLoading(true);
    setTodasLasDiplomasError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.diplomasListarTodas, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al cargar diplomas' }));
        throw new Error(errorData.message || 'Error al cargar diplomas');
      }

      const data = await response.json();
      setTodasLasDiplomas(Array.isArray(data.diplomas) ? data.diplomas : []);
    } catch (error) {
      console.error('Error cargando todas las diplomas:', error);
      setTodasLasDiplomasError(error.message);
      setTodasLasDiplomas([]);
    } finally {
      setTodasLasDiplomasLoading(false);
    }
  }, []);

  // Cargar todas las diplomas cuando se accede al tab
  useEffect(() => {
    if (activeTab === 'diplomas') {
      fetchTodasLasDiplomas();
    }
  }, [activeTab, fetchTodasLasDiplomas]);



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
          'X-App-Version': config.APP_VERSION,
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

    } catch {

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

    setActiveEmpleadoTab('documentos'); // Folosim activeEmpleadoTab în loc de activeTab
    setDocumentosPrl([]);
    setDocumentosPrlError(null);

    

    // Cargar documentos reales del empleado desde el backend
    // Delay pentru a evita rate limiting
    await fetchEmpleadoDocumentos(empleado);

    // Delay între apeluri pentru a evita rate limiting (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));

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

      

      const responseData = await response.json();

      console.log('📦 [DocumentosEmpleados] Respuesta del backend:', responseData);
      console.log('📦 [DocumentosEmpleados] Tipo de respuesta:', Array.isArray(responseData) ? 'Array' : typeof responseData);
      
      // Backend retorna {success: true, data: Array} sau direct Array
      const data = responseData?.data || responseData;
      console.log('📦 [DocumentosEmpleados] Data extraída:', data);
      console.log('📦 [DocumentosEmpleados] Tipo de data extraída:', Array.isArray(data) ? 'Array' : typeof data);
      console.log('📦 [DocumentosEmpleados] Cantidad de documentos recibidos:', Array.isArray(data) ? data.length : 'N/A');

      // Procesar los documentos recibidos

      const documentosProcesados = Array.isArray(data) ? data : [];

      console.log('📦 [DocumentosEmpleados] Documentos procesados (antes de filter):', documentosProcesados.length);
      
      if (documentosProcesados.length > 0) {
        console.log('📦 [DocumentosEmpleados] Ejemplo de documento recibido:', documentosProcesados[0]);
        console.log('📦 [DocumentosEmpleados] Campos del primer documento:', Object.keys(documentosProcesados[0]));
      }

      // Mapear los campos del backend a nuestro formato local

      const documentosMapeados = documentosProcesados

        .filter(doc => {

          // Solo incluir documentos que tengan un ID real del backend y al menos un nombre de archivo
          // Backend retorna doc_id, id, etc.
          const hasRealId = doc.doc_id || doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId;
          const hasFileName = doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento;

          if (!hasRealId) {
            console.warn('⚠️ [DocumentosEmpleados] Documento filtrado (sin ID):', doc);
          }
          if (!hasFileName) {
            console.warn('⚠️ [DocumentosEmpleados] Documento filtrado (sin nombre archivo):', doc);
          }

          return hasRealId && hasFileName;

        })

        .map(doc => ({

          // Priorizar doc_id (câmpul returnat de backend)
          id: doc.doc_id || doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId,

          fileName: doc.fileName || doc.nombre_archivo || doc.archivo || doc.nombre || doc.nombreArchivo || doc.file_name || doc.filename || doc.nombre_documento,

          fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes,

          uploadDate: doc.uploadDate || doc.fecha_upload || doc.fecha || doc.created_at || doc.fecha_creacion || doc.fecha_subida || doc.upload_date || doc.createdAt || doc.fecha || doc.date,

          status: doc.status || doc.estado || doc.state || doc.estado_documento,

          tipo: doc.tipo || doc.tipo_documento || doc.categoria || doc.tipoDocumento || doc.categoria_documento || doc.document_type || doc.type || doc.category,

          // Priorizar doc_id pentru backendId
          backendId: doc.doc_id || doc.id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId || null,

          empleadoId: doc.empleado_id || doc.empleadoId || doc.employee_id || doc.id || empleadoId,

          empleadoEmail: doc.empleado_email || doc.empleadoEmail || doc.email || doc.correo_electronico || empleadoEmail,

          uploadedBy: doc.uploaded_by || doc.subido_por || doc.uploadedBy || doc.subidoPor || doc.user || doc.usuario || doc.autor || doc.creador,

          uploadedDate: doc.uploaded_date || doc.fecha_subida || doc.created_at || doc.fecha_creacion || doc.creation_date || doc.fecha_autor,
          // Adăugăm câmpurile pentru ID-uri separate - priorizar doc_id
          doc_id: doc.doc_id || doc.documento_id || doc.documentoId || doc.document_id || doc.documentId,
          // Păstrăm și câmpul original id pentru compatibilitate
          originalId: doc.id || doc.doc_id

        }));

      

      // Ordenar documentos de más reciente a más antiguo

      const documentosOrdenados = documentosMapeados.sort((a, b) => {

        const fechaA = new Date(a.uploadDate || 0);

        const fechaB = new Date(b.uploadDate || 0);

        return fechaB - fechaA; // Orden descendente (más reciente primero)

      });

      

      console.log('✅ [DocumentosEmpleados] Documentos mapeados (después de filter y map):', documentosMapeados.length);
      console.log('✅ [DocumentosEmpleados] Documentos ordenados:', documentosOrdenados.length);
      
      if (documentosOrdenados.length > 0) {
        console.log('✅ [DocumentosEmpleados] Ejemplo de documento mapeado:', documentosOrdenados[0]);
      }

      // ASIGNAR LISTA NUEVA DIRECTAMENTE

      setEmpleadoDocumentos(documentosOrdenados);

      console.log('✅ [DocumentosEmpleados] Estado actualizado con', documentosOrdenados.length, 'documentos');

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

    if (selectedEmpleado && activeEmpleadoTab === 'documentos') {

      fetchEmpleadoDocumentos(selectedEmpleado);

    }

  }, [selectedEmpleado, activeEmpleadoTab, fetchEmpleadoDocumentos]);



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

      // Funcție pentru headers de autentificare (similar cu DocumentosPage.jsx)
      // Definită la început pentru a fi accesibilă pentru toate fetch-urile
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, image/*, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('✅ Token JWT adăugat în headers (length:', token.length, ')');
        } else {
          console.error('❌ Token JWT NU este prezent în localStorage!');
        }
        console.log('🔍 Headers complete:', headers);
        return headers;
      };

    try {

      // Detectar si es una nómina, documento oficial o documento normal

      const isNomina = documento.tipo === 'Nómina';

      

      // Oficial doar dacă e pe tab-ul de Documentos Oficiales sau are flag explicit
      const isDocumentoOficial = activeEmpleadoTab === 'documentos-empresa' || documento.esOficial === true;

      

      let previewUrl;

      if (isNomina) {

        // Usar endpoint de nóminas

        previewUrl = `${routes.downloadNomina}?id=${documento.doc_id || documento.id}&nombre=${encodeURIComponent(selectedEmpleado['NOMBRE / APELLIDOS'] || '')}&preview=true`;

        console.log('📄 Preview nómina (empleados):', previewUrl);

        // Para nóminas, no confiamos en el nombre del archivo (no tiene extensión)
        // Detectamos por Content-Type del endpoint y generamos preview acorde
        try {
          const headers = getAuthHeaders();
          console.log('🔍 Headers para nómina:', headers);
          console.log('🔍 Token presente:', !!headers['Authorization']);
          const resp = await fetch(previewUrl, { headers });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const contentType = resp.headers.get('content-type') || '';
          console.log('🔍 Nómina Content-Type:', contentType);
          const blob = await resp.blob();
          if (blob.size === 0) throw new Error('Blob vacío para nómina');

          // Detectare PDF: Content-Type SAU magic bytes (R2 poate trimite octet-stream)
          const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
          const looksLikePdf =
            head.length >= 4 &&
            head[0] === 0x25 &&
            head[1] === 0x50 &&
            head[2] === 0x44 &&
            head[3] === 0x46; // %PDF

          if (contentType.includes('application/pdf') || looksLikePdf) {
            const pdfBlob =
              contentType.includes('application/pdf')
                ? blob
                : new Blob([blob], { type: 'application/pdf' });
            const url = (isIOS || isAndroid)
              ? `data:application/pdf;base64,${await blobToBase64(pdfBlob)}`
              : URL.createObjectURL(pdfBlob);
            console.log('✅ Nómina PDF -> URL listo');
            setPreviewDocument({
              ...documento,
              previewUrl: url,
              tipo: 'Nómina',
              isPdf: true,
              isImage: false,
              fileName: documento.fileName?.toLowerCase().endsWith('.pdf')
                ? documento.fileName
                : `${documento.fileName || 'nomina'}.pdf`,
            });
          } else if (contentType.startsWith('image/')) {
            const url = URL.createObjectURL(blob);
            console.log('✅ Nómina IMAGEN -> URL listo');
            setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina', isImage: true, isPdf: false });
          } else if (contentType.includes('application/json')) {
            // Intentar segundo fetch forzando Accept según PDF primero y luego imagen
            try {
              const secondPdfHeaders = getAuthHeaders();
              secondPdfHeaders['Accept'] = 'application/pdf';
              const secondPdf = await fetch(previewUrl, { headers: secondPdfHeaders });
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
                const secondImgHeaders = getAuthHeaders();
                secondImgHeaders['Accept'] = 'image/*';
                const secondImg = await fetch(previewUrl, { headers: secondImgHeaders });
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
              setPreviewError(`Error al preparar la nómina: ${secErr.message}`);
              setPreviewDocument({ ...documento, previewUrl: null });
            }
          } else {
            // Fallback: sniff PDF, altfel blob generic
            const headFb = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
            const looksPdfFb =
              headFb.length >= 4 &&
              headFb[0] === 0x25 &&
              headFb[1] === 0x50 &&
              headFb[2] === 0x44 &&
              headFb[3] === 0x46;
            if (looksPdfFb) {
              const pdfBlob = new Blob([blob], { type: 'application/pdf' });
              const url = (isIOS || isAndroid)
                ? `data:application/pdf;base64,${await blobToBase64(pdfBlob)}`
                : URL.createObjectURL(pdfBlob);
              setPreviewDocument({
                ...documento,
                previewUrl: url,
                tipo: 'Nómina',
                isPdf: true,
                isImage: false,
                fileName: documento.fileName?.toLowerCase().endsWith('.pdf')
                  ? documento.fileName
                  : `${documento.fileName || 'nomina'}.pdf`,
              });
            } else {
              const url = URL.createObjectURL(blob);
              setPreviewDocument({ ...documento, previewUrl: url, tipo: 'Nómina' });
            }
          }
          setPreviewLoading(false);
          setPreviewError(null);
          return;
        } catch (errNomina) {
          console.error('❌ Error preparando preview de nómina:', errNomina);
          setPreviewError(`Error al preparar la nómina: ${errNomina.message}`);
          setPreviewDocument({ ...documento, previewUrl: null });
          setPreviewLoading(false);
          return;
        }

      } else if (isDocumentoOficial) {

        // Usar endpoint de documentos oficiales

        // IMPORTANT: id trebuie să fie empleado_id (CODIGO), nu doc_id
        const empleadoIdOficial = selectedEmpleado?.CODIGO || documento.empleadoId || documento.id || documento.empleadoCodigo;
        const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || documento.empleadoEmail || documento.correo_electronico || '';
        previewUrl = `${routes.downloadDocumentoOficial}?id=${empleadoIdOficial}&documentId=${documento.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(documento.fileName || '')}&preview=true`;

        console.log('🔍 Construyendo URL para documento oficial:');

        console.log('  - ID (id din backend):', documento.id);
        console.log('  - Doc ID (doc_id din backend):', documento.doc_id);

        console.log('  - Email:', empleadoEmail);

        console.log('  - FileName:', documento.fileName);

        console.log('  - URL final:', previewUrl);

      } else {

        // Pentru documente normale folosim endpoint-ul standard de descărcare
        // IMPORTANT: id trebuie să fie empleado_id (CODIGO), nu doc_id
        const empleadoId = selectedEmpleado?.CODIGO || documento.empleadoId || documento.id || documento.empleadoCodigo;
        const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || documento.empleadoEmail || documento.correo_electronico || '';
        previewUrl = `${routes.downloadDocumento}?id=${empleadoId}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}&preview=true`;

        console.log('📄 Preview para documento normal (empleados):', previewUrl);
        console.log('  - ID (empleado_id):', empleadoId);
        console.log('  - Doc ID (document_id):', documento.doc_id);
        console.log('  - Email:', empleadoEmail);
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
          
          const headers = getAuthHeaders();
          
          const resp = await fetch(previewUrl, { headers });
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
                    // Ultim fallback: al doilea fetch cu headers de autentificare
                    const secondHeaders = getAuthHeaders();
                    secondHeaders['Accept'] = 'application/pdf';
                    const second = await fetch(previewUrl, { headers: secondHeaders });
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
                  // Al doilea fetch cu headers de autentificare
                  const secondHeaders = getAuthHeaders();
                  secondHeaders['Accept'] = 'application/pdf';
                  const second = await fetch(previewUrl, { headers: secondHeaders });
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
              setPreviewError(`Error al procesar el documento: ${je.message}`);
              setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: null }));
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
          // Nu setăm previewUrl la URL HTTP direct pentru PDF-uri (cauzează 401)
          // În schimb, setăm previewUrl la null și afișăm eroarea
          setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: null }));
          setPreviewLoading(false);
          setPreviewError(`Error al cargar el PDF: ${e.message || 'No se pudo descargar el PDF'}`);
          return;
        }
      }

      

      // Para archivos de texto, intentar obtener el contenido

      if (documento.fileName?.toLowerCase().endsWith('.txt')) {

        const response = await fetch(previewUrl, { headers: getAuthHeaders() });

        if (response.ok) {

          const textContent = await response.text();

          setPreviewDocument({ ...documento, content: textContent, previewUrl });

        } else {

          throw new Error('No se pudo cargar el contenido del archivo');

        }

      }

      

      // Para archivos de imagen, hacer fetch con headers de autentificare y convertir a blob/data URL
      // (igual que en DocumentosPage.jsx)
      if (documento.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log('🖼️ Archivo de imagen detectado, creando blob URL local...');
        try {
          const headers = getAuthHeaders();
          console.log('🔍 Headers para imagen:', headers);
          console.log('🔍 Token presente:', !!headers['Authorization']);
          const response = await fetch(previewUrl, { headers });
          console.log('🔍 Respuesta para imagen:', response.status, response.ok);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('🔍 Content-Type:', contentType);
            
            // Si retorna la imagen directamente como blob
            const blob = await response.blob();
            console.log('🔍 Imagen blob size:', blob.size, 'type:', blob.type);
            
            if (blob.size > 0) {
              // Convertir blob a base64 pentru evitar problemas CORB/CORS
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result;
                if (base64String && typeof base64String === 'string') {
                  const dataUrl = base64String;
                  console.log('✅ Data URL creado para imagen (base64)');
                  console.log('🔍 Data URL length:', dataUrl.length);
                  setPreviewDocument({ ...documento, previewUrl: dataUrl });
                  console.log('🔍 previewDocument actualizado con previewUrl');
                } else {
                  // Fallback a blob URL si base64 falla
                  const blobUrl = URL.createObjectURL(blob);
                  console.log('✅ Blob URL creado para imagen (fallback):', blobUrl);
                  setPreviewDocument({ ...documento, previewUrl: blobUrl });
                }
                setPreviewLoading(false);
              };
              reader.onerror = () => {
                console.error('❌ Error al leer blob como base64');
                // Fallback a blob URL
                const blobUrl = URL.createObjectURL(blob);
                setPreviewDocument({ ...documento, previewUrl: blobUrl });
                setPreviewLoading(false);
              };
              reader.readAsDataURL(blob);
            } else {
              setPreviewError('El archivo de imagen está vacío o no se pudo cargar');
              setPreviewDocument({ ...documento, previewUrl: null });
              setPreviewLoading(false);
            }
          } else {
            setPreviewError(`Error al cargar la imagen: ${response.status}`);
            setPreviewDocument({ ...documento, previewUrl: null });
            setPreviewLoading(false);
          }
        } catch (imgError) {
          console.error('❌ Error al cargar imagen:', imgError);
          setPreviewError(`Error al cargar la imagen: ${imgError.message}`);
          setPreviewDocument({ ...documento, previewUrl: null });
          setPreviewLoading(false);
        }
        return;
      }

      

      // Para PDFs, verificar que se puedan cargar

      if (documento.fileName?.toLowerCase().endsWith('.pdf')) {

        console.log('📄 Archivo PDF detectado, se cargará en iframe');

        

        // Verificar dacă endpoint-ul returnează ceva valid

        try {

          const response = await fetch(previewUrl, { headers: getAuthHeaders() });

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
            console.warn('⚠️ No se pudo crear blob ni parsear JSON para PDF.');
            // Nu setăm previewUrl la URL HTTP direct pentru PDF-uri (cauzează 401)
            // În schimb, setăm previewUrl la null și afișăm eroarea
            setPreviewDocument(prev => ({ ...(prev || documento), previewUrl: null }));
            setPreviewLoading(false);
            setPreviewError('No se pudo cargar el PDF. Por favor, intenta descargarlo directamente.');
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
        showNotification('error', 'AutoFirma', 'AutoScript no está disponible. Por favor, recarga la página.');
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
            showNotification('success', 'AutoFirma', 'El documento ha sido firmado, descargado y enviado al servidor correctamente.');
          })
          .catch(error => {
            console.error('❌ Error al enviar al backend:', error);
            showNotification('warning', 'AutoFirma', 'El documento ha sido firmado y descargado, pero hubo un error al enviarlo al servidor.');
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

    if (selectedEmpleado && activeEmpleadoTab === 'nominas') {

      fetchNominas(selectedEmpleado);

    }

  }, [selectedEmpleado, activeEmpleadoTab, fetchNominas]);



  // Función para obtener documentos oficiales del empleado

  const fetchDocumentosOficiales = useCallback(async (empleado) => {

    if (!empleado || !empleado['NOMBRE / APELLIDOS'] || !empleado['CODIGO']) {

      console.log('❌ No hay empleado seleccionado o datos válidos para documentos oficiales');

      return;

    }

    // Prevenir apeluri simultane
    if (fetchDocumentosOficialesInProgressRef.current) {
      console.log('⏸️ Fetch de documentos oficiales deja en progreso, saltando...');
      return;
    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchDocumentosOficiales for empleado:', empleado['NOMBRE / APELLIDOS']);
      setDocumentosOficialesLoading(false);
      return;
    }

    setDocumentosOficialesLoading(true);
    fetchDocumentosOficialesInProgressRef.current = true;
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

      // Retry logic cu exponential backoff pentru erorile 429
      const maxRetries = 3;
      let response;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          response = await fetch(`${routes.getDocumentosOficiales}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              nombre: String(empleado['NOMBRE / APELLIDOS'] || '').trim(),
              codigo: String(empleado['CODIGO'] ?? '').trim(),
            })
          });

          // Dacă e 429, așteptăm și retry
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter 
              ? parseInt(retryAfter) * 1000 
              : Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
            
            if (attempt < maxRetries - 1) {
              console.log(`⏳ Rate limited (429) pentru documentos oficiales, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          // Dacă nu e 429 sau am terminat retry-urile, iesim din loop
          break;
        } catch (error) {
          if (attempt < maxRetries - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            console.log(`⏳ Error fetching documentos oficiales, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Error HTTP: ${response?.status || 'Unknown'}`);
      }



      const data = await response.json();

      console.log('🏢 Respuesta documentos oficiales:', data);

      

      // Verificar si los documentos oficiales son válidos o solo mensajes de éxito

      const isValidDocumentoOficial = (item) => {

        console.log('🔍 Validando documento oficial:', item);

        

        // Verificar si el objeto contiene campos reales de documento oficial

        const hasValidFields = item && (
          (item.doc_id !== undefined && item.doc_id !== null && item.doc_id !== '') ||
          item.id ||
          item.documento_id ||
          item.documentoId ||
          item.nombre_archivo ||
          item.fileName ||
          item.archivo ||
          item.nombre ||
          item.fecha_creacion ||
          item.uploadDate ||
          item.created_at ||
          item.fecha ||
          item.tipo_documento ||
          item.tipo
        );

        

        console.log('🔍 Documento oficial válido?', hasValidFields);

        return hasValidFields;

      };

      

      // Filtrar solo los documentos oficiales válidos

      let documentosOficialesValidos = [];

      

      if (Array.isArray(data)) {
        documentosOficialesValidos = data.filter(isValidDocumentoOficial);
      } else if (data?.success && Array.isArray(data?.data)) {
        documentosOficialesValidos = data.data.filter(isValidDocumentoOficial);
      } else if (data?.success && Array.isArray(data?.documentos)) {
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

      

      // Procesar documentos válidos (misma lógica para array, { success, data } o { success, documentos })
      const documentosOficialesProcesados = documentosOficialesValidos.map((doc, idx) => ({
        id: doc.id,
        doc_id: doc.doc_id,
        fileName: doc.nombre_archivo || doc.fileName || doc.archivo || doc.nombre || `Documento Oficial ${idx + 1}`,
        fileSize: doc.fileSize || doc.tamaño || doc.size || doc.file_size || doc.tamano || doc.tamanio || doc.filesize || doc.size_bytes || 0,
        uploadDate:
          doc.fecha_creacion ||
          doc.uploadDate ||
          doc.created_at ||
          doc.fecha ||
          doc.fecha_subida ||
          doc.upload_date ||
          doc.creation_date ||
          doc.fecha_autor ||
          new Date().toISOString(),
        tipo: doc.tipo_documento || doc.tipo || doc.categoria || doc.document_type || doc.type || doc.category || 'Documento Oficial',
        empleadoId: empleado['CODIGO'],
        empleadoEmail: empleado['CORREO ELECTRONICO'],
        status: 'disponible',
        correo_electronico: doc.correo_electronico,
        permisso_para_empleado: doc.permisso_para_empleado || null,
        necesita_firma: doc.necesita_firma === true || doc.necesita_firma === 1 || doc.necesita_firma === '1',
        originalData: doc,
      }));

      const documentosOficialesOrdenados = documentosOficialesProcesados.sort((a, b) => {
        const fechaA = new Date(a.uploadDate || 0);
        const fechaB = new Date(b.uploadDate || 0);
        return fechaB - fechaA;
      });

      setDocumentosOficiales(documentosOficialesOrdenados);
      console.log('✅ Documentos oficiales procesados y ordenados:', documentosOficialesOrdenados);

      setEmpleadoDocumentos((prev) =>
        prev.filter((doc) => {
          const tipo = doc.tipo || doc.tipo_documento || '';
          const isDocumentoOficial =
            tipo === 'Documento Oficial' ||
            tipo.toLowerCase() === 'sello' ||
            tipo.toLowerCase() === 'alta' ||
            tipo.toLowerCase() === 'contrato' ||
            tipo.toLowerCase() === 'liquidacion' ||
            (tipo.toLowerCase().includes('oficial') && !tipo.toLowerCase().includes('ficha_empleado')) ||
            (doc.originalData && doc.originalData.tipo_documento);
          return !isDocumentoOficial;
        }),
      );

    } catch (error) {

      console.error('❌ Error obteniendo documentos oficiales:', error);

      setDocumentosOficialesError(error.message);

      setDocumentosOficiales([]);

      

      // Eliminar documentos oficiales de empleadoDocumentos cuando hay error

      setEmpleadoDocumentos(prev => prev.filter(doc => doc.tipo !== 'Documento Oficial'));

    } finally {

      setDocumentosOficialesLoading(false);
      fetchDocumentosOficialesInProgressRef.current = false;

    }

  }, [authUser]);



  // Efecto pentru încărcarea documentelor oficiale când se activează tabul corespunzător
  // IMPORTANT: Nu includem fetchDocumentosOficiales în dependențe pentru a evita apeluri duplicate
  useEffect(() => {
    // Skip dacă nu e tab-ul corect sau nu e angajat selectat
    if (!selectedEmpleado || activeEmpleadoTab !== 'documentos-empresa') {
      return;
    }

    // Skip dacă deja se face un fetch
    if (fetchDocumentosOficialesInProgressRef.current) {
      console.log('⏸️ Fetch de documentos oficiales deja en progreso, saltando useEffect...');
      return;
    }

    console.log('✅ Activando fetchDocumentosOficiales desde useEffect');

    // Delay pentru a evita rate limiting când se schimbă rapid tab-urile
    const timeoutId = setTimeout(() => {
      // Verificăm din nou înainte de a face apelul (poate s-a schimbat tab-ul)
      if (selectedEmpleado && activeEmpleadoTab === 'documentos-empresa' && !fetchDocumentosOficialesInProgressRef.current) {
        fetchDocumentosOficiales(selectedEmpleado);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [selectedEmpleado, activeEmpleadoTab, fetchDocumentosOficiales]);

  const getPrlEstadoColor = (estado, requiereFirma) => {
    if (!requiereFirma && estado !== 'FIRMADO') {
      return 'bg-gray-100 text-gray-700 border-gray-300';
    }
    switch (estado) {
      case 'FIRMADO':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'NO_APLICA':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'INFORMATIVO':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getPrlEstadoLabel = (estado) => {
    switch (estado) {
      case 'FIRMADO':
        return '✅ Firmado';
      case 'PENDIENTE':
        return '⏳ Pendiente';
      case 'NO_APLICA':
        return 'ℹ️ No aplica';
      case 'RECHAZADO':
        return '❌ Rechazado';
      case 'INFORMATIVO':
        return '📄 Informativo';
      default:
        return estado || '—';
    }
  };

  const getPrlTipoLabel = (tipo) => {
    const tipos = {
      EVALUACION_RIESGOS: 'Evaluación de Riesgos Laborales',
      ACTA_INFORMATIVA: 'Acta Informativa del Puesto',
      ENTREGA_EPIS: 'Entrega de EPIs',
      RENUNCIA_RM: 'Renuncia Reconocimiento Médico',
      MANUAL_TEST: 'Manual del Puesto + Test',
    };
    return tipos[tipo] || tipo || 'Documento PRL';
  };

  const fetchDocumentosPrl = useCallback(async (empleado) => {
    if (!empleado?.CODIGO) return;
    if (fetchDocumentosPrlInProgressRef.current) return;
    if (authUser?.isDemo) {
      setDocumentosPrl([]);
      setDocumentosPrlLoading(false);
      return;
    }

    fetchDocumentosPrlInProgressRef.current = true;
    setDocumentosPrlLoading(true);
    setDocumentosPrlError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(routes.prlDocumentosEmpleado(empleado.CODIGO), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data?.documentos)
        ? data.documentos
        : Array.isArray(data)
          ? data
          : [];
      setDocumentosPrl(list);
    } catch (err) {
      console.error('Error cargando documentos PRL:', err);
      setDocumentosPrl([]);
      setDocumentosPrlError(err?.message || 'Error al cargar documentos PRL');
    } finally {
      setDocumentosPrlLoading(false);
      fetchDocumentosPrlInProgressRef.current = false;
    }
  }, [authUser?.isDemo]);

  useEffect(() => {
    if (!selectedEmpleado || activeEmpleadoTab !== 'documentos-prl') return;
    if (fetchDocumentosPrlInProgressRef.current) return;
    fetchDocumentosPrl(selectedEmpleado);
  }, [selectedEmpleado, activeEmpleadoTab, fetchDocumentosPrl]);

  const descargarPrlDocumento = useCallback(async (empleado, doc, firmado = false) => {
    if (!empleado?.CODIGO || !doc?.id) return;
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = firmado
        ? routes.prlDescargarDocumentoFirmadoAdmin(empleado.CODIGO, doc.id)
        : routes.prlDescargarDocumentoEmpleadoAdmin(empleado.CODIGO, doc.id);
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const nombre =
        (firmado ? doc.nombre_archivo_firmado : doc.nombre_archivo_original) ||
        doc.template_nombre ||
        `prl-${doc.id}`;
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Error descargando documento PRL:', err);
      alert('No se pudo descargar el documento PRL');
    }
  }, []);

  // Función para descargar documentos normales

  const handleDownloadDocument = async (documento) => {
    console.log('⬇️ Descargando documento:', documento);

    try {
      // IMPORTANT: id trebuie să fie empleado_id (CODIGO), nu doc_id
      const empleadoIdDownload = selectedEmpleado?.CODIGO || documento.empleadoId || documento.id;
      const downloadUrl = `${routes.downloadDocumento}?id=${empleadoIdDownload}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}&documentId=${documento.doc_id}`;

      console.log('🔗 URL de descarga:', downloadUrl);
      console.log('📋 Datele trimise:', {
        id: empleadoIdDownload,
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
      // IMPORTANT: id trebuie să fie empleado_id (CODIGO), nu doc_id
      const empleadoIdOficialDownload = selectedEmpleado?.CODIGO || documento.empleadoId || documento.id;
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${empleadoIdOficialDownload}&documentId=${documento.doc_id}&email=${encodeURIComponent(selectedEmpleado['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}`;

      

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

  // Funcție pentru toggle necesita_firma
  const handleToggleNecesitaFirma = async (documento) => {
    try {
      if (!documento.doc_id) {
        showNotification('error', 'Error', 'No se pudo identificar el documento');
        return;
      }

      const nuevoEstado = !documento.necesita_firma;
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${routes.updateDocumentoOficialNecesitaFirma}/${documento.doc_id}/necesita-firma`,
        {
          method: 'PATCH',
          headers: fetchHeaders,
          body: JSON.stringify({ necesitaFirma: nuevoEstado }),
        }
      );

      if (response.ok) {
        // Actualizează starea locală
        setDocumentosOficiales((prevDocs) =>
          prevDocs.map((doc) =>
            doc.doc_id === documento.doc_id
              ? { ...doc, necesita_firma: nuevoEstado }
              : doc
          )
        );

        showNotification(
          'success',
          'Actualizado',
          nuevoEstado
            ? 'El documento ahora requiere firma'
            : 'El documento ya no requiere firma'
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error actualizando necesita_firma:', error);
      showNotification(
        'error',
        'Error',
        `No se pudo actualizar el estado de firma: ${error.message}`
      );
    }
  };

  // Funcție pentru a obține lista de angajați cu statusul contractelor
  // Funcție pentru export Excel - Status Contratos
  const handleExportContratosExcel = async () => {
    if (!empleadosContratos || empleadosContratos.length === 0) {
      showNotification('warning', 'Advertencia', 'No hay datos para exportar');
      return;
    }

    try {
      const columns = [
        { key: 'codigo', label: 'Código', width: 12 },
        { key: 'nombre', label: 'Nombre', width: 30 },
        { key: 'email', label: 'Email', width: 30 },
        { key: 'estado', label: 'Estado', width: 12 },
        { key: 'tiene_contrato', label: 'Tiene CONTRATO', width: 15 },
        { key: 'tiene_contrato_firmado', label: 'Tiene CONTRATO Firmado', width: 20 },
        { key: 'fecha_contrato', label: 'Fecha CONTRATO', width: 15 },
        { key: 'fecha_contrato_firmado', label: 'Fecha CONTRATO Firmado', width: 20 },
      ];

      const dataToExport = empleadosContratos.map(emp => ({
        codigo: emp.codigo || '',
        nombre: emp.nombre || 'Sin nombre',
        email: emp.email || 'Sin email',
        estado: emp.estado || 'N/A',
        tiene_contrato: emp.tiene_contrato ? 'Sí' : 'No',
        tiene_contrato_firmado: emp.tiene_contrato_firmado ? 'Sí' : 'No',
        fecha_contrato: emp.fecha_contrato 
          ? new Date(emp.fecha_contrato).toLocaleDateString('es-ES')
          : '',
        fecha_contrato_firmado: emp.fecha_contrato_firmado
          ? new Date(emp.fecha_contrato_firmado).toLocaleDateString('es-ES')
          : '',
      }));

      await exportToExcelWithHeader(
        dataToExport,
        columns,
        'Status Contratos por Empleado',
        'status_contratos_empleados',
        {},
        new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
      );

      showNotification('success', 'Éxito', 'Excel exportado correctamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      showNotification('error', 'Error', `Error al exportar Excel: ${error.message}`);
    }
  };

  // Funcție pentru export PDF - Status Contratos
  const handleExportContratosPDF = async () => {
    if (!empleadosContratos || empleadosContratos.length === 0) {
      showNotification('warning', 'Advertencia', 'No hay datos para exportar');
      return;
    }

    try {
      const pdfMake = await getPdfMake();

      const tableBody = [
        ['Código', 'Nombre', 'Email', 'Estado', 'CONTRATO', 'FIRMADO', 'Fecha CONTRATO', 'Fecha FIRMADO']
      ];

      empleadosContratos.forEach(emp => {
        tableBody.push([
          emp.codigo || '',
          emp.nombre || 'Sin nombre',
          emp.email || 'Sin email',
          emp.estado || 'N/A',
          emp.tiene_contrato ? 'Sí' : 'No',
          emp.tiene_contrato_firmado ? 'Sí' : 'No',
          emp.fecha_contrato 
            ? new Date(emp.fecha_contrato).toLocaleDateString('es-ES')
            : '',
          emp.fecha_contrato_firmado
            ? new Date(emp.fecha_contrato_firmado).toLocaleDateString('es-ES')
            : '',
        ]);
      });

      const docDefinition = {
        content: [
          {
            text: config.COMPANY_NAME,
            style: 'companyName',
            margin: [0, 0, 0, 8]
          },
          {
            text: `NIF: ${config.COMPANY_CIF}`,
            style: 'companyDetails',
            margin: [0, 0, 0, 2]
          },
          {
            text: `Dirección: ${config.COMPANY_ADDRESS}`,
            style: 'companyDetails',
            margin: [0, 0, 0, 2]
          },
          {
            text: `Teléfono: ${config.COMPANY_PHONE} | Email: ${config.COMPANY_EMAIL}`,
            style: 'companyDetails',
            margin: [0, 0, 0, 8]
          },
          {
            text: 'Status Contratos por Empleado',
            style: 'reportTitle',
            margin: [0, 0, 0, 4]
          },
          {
            text: `Período: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            style: 'period',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              headerRows: 1,
              widths: [50, 120, 120, 50, 50, 50, 80, 80],
              body: tableBody
            },
            layout: {
              fillColor: (rowIndex) => {
                if (rowIndex === 0) return '#333333';
                return rowIndex % 2 === 0 ? '#F5F5F5' : null;
              }
            }
          },
          {
            text: `Total: ${empleadosContratos.length} empleados`,
            style: 'totals',
            margin: [0, 8, 0, 0]
          }
        ],
        styles: {
          companyName: {
            fontSize: 18,
            bold: true,
            color: '#FFFFFF',
            fillColor: PRIMARY_COLOR,
            alignment: 'center'
          },
          companyDetails: {
            fontSize: 10,
            bold: true,
            color: '#333333',
            fillColor: '#F0F0F0',
            alignment: 'center'
          },
          reportTitle: {
            fontSize: 14,
            bold: true,
            color: '#FFFFFF',
            fillColor: PRIMARY_COLOR,
            alignment: 'center'
          },
          period: {
            fontSize: 10,
            color: '#333333',
            alignment: 'center'
          },
          totals: {
            fontSize: 10,
            bold: true,
            alignment: 'right'
          }
        },
        defaultStyle: {
          fontSize: 8,
          color: '#333333'
        }
      };

      const filename = `status_contratos_empleados_${new Date().toISOString().split('T')[0]}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);

      showNotification('success', 'Éxito', 'PDF exportado correctamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      showNotification('error', 'Error', `Error al exportar PDF: ${error.message}`);
    }
  };

  // State pentru modalul de selecție contracte
  const [showContratosPreviewModal, setShowContratosPreviewModal] = useState(false);
  const [contratosDisponibles, setContratosDisponibles] = useState([]);
  const [empleadoParaPreview, setEmpleadoParaPreview] = useState(null);
  const [loadingContratosPreview, setLoadingContratosPreview] = useState(false);

  // Funcție pentru a obține toate contractele unui angajat și a deschide modalul de selecție
  const handlePreviewContratoEmpleado = async (empleado) => {
    try {
      if (!empleado.codigo) {
        showNotification('error', 'Error', 'No se pudo identificar el código del empleado');
        return;
      }

      setLoadingContratosPreview(true);
      setEmpleadoParaPreview(empleado);

      // Obține documentele oficiale pentru acest angajat
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Folosim endpoint-ul pentru documentele oficiale (POST cu body)
      const response = await fetch(routes.getDocumentosOficiales, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigo: empleado.codigo,
          nombre: empleado.nombre || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      let documentos = [];
      
      if (result.success && result.data) {
        documentos = Array.isArray(result.data) ? result.data : [];
      } else if (result.success && result.documentos) {
        documentos = Array.isArray(result.documentos) ? result.documentos : [];
      } else if (Array.isArray(result)) {
        documentos = result;
      }

      // Găsește toate contractele (CONTRATO și CONTRATO firmado)
      // Adăugăm log-uri pentru debugging
      console.log('🔍 [Preview Contratos] Total documentos recibidos:', documentos.length);
      console.log('🔍 [Preview Contratos] Ejemplo de documento:', documentos[0]);
      
      const contratos = documentos.filter((doc) => {
        const tipo = (doc.tipo || '').toUpperCase();
        const tipoDocumento = (doc.tipo_documento || '').toUpperCase();
        const nombreArchivo = (doc.nombre_archivo || doc.fileName || '').toUpperCase();
        
        // Verificăm dacă este CONTRATO sau CONTRATO firmado
        const esContrato = tipo.includes('CONTRATO') || tipoDocumento.includes('CONTRATO') || nombreArchivo.includes('CONTRATO');
        
        if (esContrato) {
          console.log('✅ [Preview Contratos] Contrato encontrado:', {
            tipo,
            tipoDocumento,
            nombreArchivo: doc.nombre_archivo || doc.fileName,
            doc_id: doc.doc_id
          });
        }
        
        return esContrato;
      });

      console.log('🔍 [Preview Contratos] Total contratos encontrados:', contratos.length);

      if (contratos.length === 0) {
        console.warn('⚠️ [Preview Contratos] No se encontraron contratos. Documentos recibidos:', documentos);
        showNotification('warning', 'Advertencia', 'No se encontraron contratos para este empleado');
        setLoadingContratosPreview(false);
        return;
      }

      // Formatează contractele pentru afișare
      const contratosFormateados = contratos.map(contrato => ({
        ...contrato,
        id: empleado.codigo,
        empleadoId: empleado.codigo,
        fileName: contrato.nombre_archivo || contrato.fileName || 'CONTRATO.pdf',
        tipo: contrato.tipo || contrato.tipo_documento || 'CONTRATO',
        tipo_documento: contrato.tipo_documento || contrato.tipo || 'CONTRATO',
        esOficial: true,
        doc_id: contrato.doc_id,
        fecha_creacion: contrato.fecha_creacion,
      }));

      setContratosDisponibles(contratosFormateados);
      setShowContratosPreviewModal(true);
      setLoadingContratosPreview(false);

    } catch (error) {
      console.error('❌ Error al obtener contratos:', error);
      showNotification(
        'error',
        'Error',
        `No se pudieron obtener los contratos: ${error.message}`
      );
      setLoadingContratosPreview(false);
    }
  };

  // Funcție pentru a deschide preview-ul unui contract selectat
  const handlePreviewContratoSeleccionado = async (contrato) => {
    try {
      if (!empleadoParaPreview) {
        showNotification('error', 'Error', 'No se pudo identificar el empleado');
        return;
      }

      // Adăugăm datele angajatului direct în obiectul contrato pentru a evita dependența de selectedEmpleado
      contrato.empleadoEmail = empleadoParaPreview.email || '';
      contrato.empleadoCodigo = empleadoParaPreview.codigo;
      contrato.correo_electronico = empleadoParaPreview.email || '';
      
      // Construim obiectul empleado complet pentru preview
      const empleadoTemp = {
        CODIGO: empleadoParaPreview.codigo,
        'CORREO ELECTRONICO': empleadoParaPreview.email || '',
        'NOMBRE / APELLIDOS': empleadoParaPreview.nombre || '',
      };
      
      // Salvăm selectedEmpleado original
      const selectedEmpleadoOriginal = selectedEmpleado;
      
      // Setăm temporar selectedEmpleado
      setSelectedEmpleado(empleadoTemp);
      
      // Închidem modalul de selecție înainte de a deschide preview-ul
      setShowContratosPreviewModal(false);
      
      // Așteptăm puțin pentru ca state-ul să se actualizeze
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Deschide preview-ul folosind funcția existentă
      await handlePreviewDocument(contrato);
      
      // Restaurăm selectedEmpleado original după un mic delay
      setTimeout(() => {
        if (selectedEmpleadoOriginal) {
          setSelectedEmpleado(selectedEmpleadoOriginal);
        } else {
          // Dacă nu există original, setăm la null
          setSelectedEmpleado(null);
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error al abrir preview del contrato:', error);
      showNotification(
        'error',
        'Error',
        `No se pudo abrir el preview del contrato: ${error.message}`
      );
    }
  };

  const fetchEmpleadosConStatusContratos = async () => {
    try {
      setLoadingContratos(true);
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getEmpleadosConStatusContratos, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setEmpleadosContratos(result.data);
        setShowContratosModal(true);
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (error) {
      console.error('❌ Error obteniendo empleados con status contratos:', error);
      showNotification(
        'error',
        'Error',
        `No se pudo obtener la lista de empleados: ${error.message}`
      );
    } finally {
      setLoadingContratos(false);
    }
  };

  // Funcție pentru preview simplu al documentelor oficiale
  const handlePreviewDocumentOficial = async (documento) => {
    try {
      console.log('📄 Abriendo preview para documento oficial:', documento);
      
      const empleadoIdOficial = selectedEmpleado?.CODIGO || documento.id || documento.empleadoId;
      const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || documento.correo_electronico || '';
      const previewUrl = `${routes.downloadDocumentoOficial}?id=${empleadoIdOficial}&documentId=${documento.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔍 URL de preview:', previewUrl);
      
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, image/*, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };
      
      setShowPreviewModal(true);
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Para PDFs, crear blob URL
      if (documento.fileName?.toLowerCase().endsWith('.pdf')) {
        try {
          const response = await fetch(previewUrl, { headers: getAuthHeaders() });
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const url = (isIOS || isAndroid)
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              setPreviewDocument({ ...documento, previewUrl: url, esOficial: true, isPdf: true });
            }
          }
        } catch (error) {
          console.error('❌ Error procesando PDF oficial:', error);
          setPreviewDocument({ ...documento, previewUrl, esOficial: true });
        }
      } else {
        // Para otros archivos, usar URL directa
        setPreviewDocument({ ...documento, previewUrl, esOficial: true });
      }
      
      setPreviewLoading(false);
    } catch (error) {
      console.error('❌ Error abriendo preview:', error);
      setPreviewError('Error al abrir el preview del documento');
      setPreviewLoading(false);
    }
  };

  // Funcție pentru deschiderea sistemului de firmă pentru documente oficiale
  const handleFirmarDocumentoOficial = async (documento) => {
    try {
      console.log('✍️ Abriendo sistema de firma para documento oficial:', documento);
      
      if (!documento.fileName?.toLowerCase().endsWith('.pdf')) {
        showNotification('error', 'Error', 'Solo se pueden firmar documentos PDF');
        return;
      }

      const empleadoIdOficial = selectedEmpleado?.CODIGO || documento.id || documento.empleadoId;
      const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || documento.correo_electronico || '';
      const downloadUrl = `${routes.downloadDocumentoOficial}?id=${empleadoIdOficial}&documentId=${documento.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(documento.fileName || '')}`;
      
      console.log('🔍 URL para firmar:', downloadUrl);
      
      const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Accept': 'application/pdf, application/json, */*',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      };

      setShowOficialSigner(true);
      
      try {
        const response = await fetch(downloadUrl, { headers: getAuthHeaders() });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/pdf')) {
            const blob = await response.blob();
            
            if (blob.size > 0) {
              const url = (isIOS || isAndroid)
                ? `data:application/pdf;base64,${await blobToBase64(blob)}`
                : URL.createObjectURL(blob);
              console.log('✅ URL creado para PDF oficial a firmar');
              console.log('🔍 [DocumentosEmpleados] Documento para firmar:', {
                doc_id: documento.doc_id,
                id: documento.id,
                fileName: documento.fileName,
                tipo: documento.tipo,
                tipo_documento: documento.tipo_documento,
                correo_electronico: documento.correo_electronico,
                nombre_empleado: documento.nombre_empleado
              });
              setDocumentoOficialToSign(documento);
              setDocumentoOficialPdfUrl(url);
            } else {
              throw new Error('Blob vacío para PDF oficial');
            }
          } else {
            throw new Error('Content-Type no es PDF para documento oficial');
          }
        } else {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
      } catch (pdfError) {
        console.error('❌ Error procesando PDF oficial para firmar:', pdfError);
        setShowOficialSigner(false);
        showNotification('error', 'Error', `Error al cargar documento para firmar: ${pdfError.message}`);
      }
    } catch (error) {
      console.error('❌ Error abriendo sistema de firma:', error);
      setShowOficialSigner(false);
      showNotification('error', 'Error', `Error al abrir el sistema de firma: ${error.message}`);
    }
  };

  // Funcție pentru a marca un contract ca fiind semnat
  const handleMarcarContratoComoFirmado = async (documento) => {
    try {
      if (!documento.doc_id) {
        showNotification('error', 'Error', 'No se pudo identificar el documento');
        return;
      }

      // Verifică dacă este deja marcat ca "CONTRATO firmado"
      if (documento.tipo === 'CONTRATO firmado' || documento.tipo_documento === 'CONTRATO firmado') {
        showNotification('info', 'Información', 'Este contrato ya está marcado como firmado');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${routes.marcarContratoComoFirmado}/${documento.doc_id}/marcar-firmado`,
        {
          method: 'POST',
          headers: fetchHeaders,
        }
      );

      if (response.ok) {
        // Actualizează starea locală
        setDocumentosOficiales((prevDocs) =>
          prevDocs.map((doc) =>
            doc.doc_id === documento.doc_id
              ? { 
                  ...doc, 
                  tipo: 'CONTRATO firmado',
                  tipo_documento: 'CONTRATO firmado',
                  necesita_firma: false
                }
              : doc
          )
        );

        showNotification(
          'success',
          'Contrato Marcado',
          'El contrato ha sido marcado como firmado correctamente'
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error marcando contrato como firmado:', error);
      showNotification(
        'error',
        'Error',
        `No se pudo marcar el contrato como firmado: ${error.message}`
      );
    }
  };

  const handleAplicarSelloEmpresa = async (documento) => {
    try {
      if (!documento?.doc_id) {
        showNotification('error', 'Error', 'No se pudo identificar el documento');
        return;
      }
      if (!isContratoDocumento(documento)) {
        showNotification('error', 'Error', 'Solo disponible para contratos');
        return;
      }

      setDocumentoSelloToConfirm(null);
      setAplicandoSelloDocId(documento.doc_id);

      const token = localStorage.getItem('auth_token');
      const fetchHeaders = { 'Content-Type': 'application/json' };
      if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;

      const response = await fetch(routes.aplicarSelloEmpresaContrato(documento.doc_id), {
        method: 'POST',
        headers: fetchHeaders,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `Error HTTP: ${response.status}`);
      }

      showNotification(
        'success',
        'Sello aplicado',
        'El sello de empresa se ha añadido y el archivo se ha reemplazado'
      );

      if (selectedEmpleado) {
        fetchDocumentosOficiales(selectedEmpleado);
      }
    } catch (error) {
      console.error('❌ Error aplicando sello empresa:', error);
      showNotification(
        'error',
        'Error',
        `No se pudo aplicar el sello: ${error.message}`
      );
    } finally {
      setAplicandoSelloDocId(null);
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
      // IMPORTANT: Backend așteaptă doc_id (primary key Int), nu id (CODIGO angajat)
      const deleteData = {
        id: documento.doc_id || documento.id, // Priorizăm doc_id (primary key)
        nombre_archivo: documento.fileName || documento.nombre_archivo || '',
        filename: documento.fileName || documento.nombre_archivo || '' // Fallback pentru compatibilitate
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
        // Folosim doc_id pentru comparare (primary key)
        setDocumentosOficiales(prev => prev.filter(doc => 
          (doc.doc_id || doc.id) !== (documento.doc_id || documento.id)
        ));

        

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
      <div className="app-page documentos-empleados-page">
        <PageHeader title="Acceso restringido" subtitle="Solo los managers pueden acceder a esta página" backTo="/inicio" />
        <AlertBanner variant="danger" title="Permisos insuficientes">
          No tienes permisos para gestionar documentos de empleados.
        </AlertBanner>
        <Link to="/inicio" className="solicitud-admin-btn solicitud-admin-btn--primary inline-flex w-fit">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          <span>Volver al inicio</span>
        </Link>
      </div>
    );
  }

  const mainTabs = [
    { id: 'empleados', label: 'Empleados', shortLabel: 'Emp.' },
    { id: 'gestoria-nominas', label: 'Gestoría Nóminas', shortLabel: 'Gestoría' },
    { id: 'coste-personal', label: 'Coste Personal', shortLabel: 'Coste' },
    { id: 'diplomas', label: 'Diplomas', shortLabel: 'Dipl.' },
    { id: 'certificados-retenciones', label: 'Certificados retenciones', shortLabel: 'Cert.' },
  ];

  const empleadoSubTabs = [
    { id: 'documentos', label: 'Documentos', shortLabel: 'Docs' },
    { id: 'nominas', label: 'Nóminas', shortLabel: 'Nom.' },
    { id: 'documentos-empresa', label: 'Empresa', shortLabel: 'Emp.' },
    { id: 'documentos-prl', label: 'PRL', shortLabel: 'PRL' },
    { id: 'subir-documentos', label: 'Subir', shortLabel: 'Subir' },
  ];

  const handleMainTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedEmpleado(null);
  };

  const getEmpleadoInitials = (empleado) => {
    const name = empleado?.['NOMBRE / APELLIDOS'] || '';
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  const volverEmpleadosBtn = (
    <button
      type="button"
      onClick={() => {
        setActiveTab('empleados');
        setSelectedEmpleado(null);
      }}
      className="solicitud-admin-btn shrink-0"
      title="Volver a la lista de empleados"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden />
      <span className="hidden sm:inline">Volver</span>
    </button>
  );



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
      <div className="app-page documentos-empleados-page">
        <PageHeader title="Documentos por Empleado" backTo="/inicio" />
        <AlertBanner variant="danger" title="Error">{error}</AlertBanner>
        <button type="button" onClick={fetchEmpleados} className="solicitud-admin-btn solicitud-admin-btn--primary w-fit">
          <RefreshCw className="w-4 h-4" aria-hidden />
          <span>Inténtalo de nuevo</span>
        </button>
      </div>
    );
  }



  const canUseAdminTools = isManager || authUser?.GRUPO === 'Admin' || authUser?.GRUPO === 'Developer' || authUser?.GRUPO === 'Supervisor';

  return (
    <>
    <div className="app-page documentos-empleados-page">
      <PageHeader
        title="Documentos por Empleado"
        subtitle="Gestiona documentos, nóminas y certificados por empleado"
        backTo="/inicio"
        className="documentos-empleados-page-header"
      />

      <SegmentedControl
        layout="grid"
        value={activeTab}
        onChange={handleMainTabChange}
        className="documentos-empleados-main-tabs"
        items={mainTabs}
      />

      {canUseAdminTools && (
        <div className="documentos-empleados-admin-toolbar">
          <div className="documentos-empleados-admin-toolbar__desktop hidden sm:flex solicitud-admin-toolbar documentos-actions flex-wrap">
            <button
              type="button"
              onClick={fetchEmpleadosConStatusContratos}
              disabled={loadingContratos}
              className="solicitud-admin-btn"
              title="Ver lista de empleados con status de contratos"
            >
              <FileSpreadsheet className={`w-4 h-4 ${loadingContratos ? 'animate-spin' : ''}`} aria-hidden />
              <span>Status contratos</span>
            </button>
            <EmailIngestionButton variant="toolbar" />
            <FolderIngestionButton variant="toolbar" />
          </div>
          <details className="documentos-empleados-tools-menu sm:hidden">
            <summary className="solicitud-admin-btn documentos-empleados-tools-menu__trigger">
              <Wrench className="w-4 h-4" aria-hidden />
              <span>Herramientas</span>
            </summary>
            <div className="documentos-empleados-tools-menu__panel solicitud-admin-toolbar documentos-actions">
              <button
                type="button"
                onClick={fetchEmpleadosConStatusContratos}
                disabled={loadingContratos}
                className="solicitud-admin-btn w-full"
                title="Ver lista de empleados con status de contratos"
              >
                <FileSpreadsheet className={`w-4 h-4 ${loadingContratos ? 'animate-spin' : ''}`} aria-hidden />
                <span>Status contratos</span>
              </button>
              <EmailIngestionButton variant="toolbar" />
              <FolderIngestionButton variant="toolbar" />
            </div>
          </details>
        </div>
      )}

      {selectedEmpleado && activeTab === 'empleados' && (
        <div className="documentos-empleados-context app-card app-card--pad">
          <div className="documentos-empleados-context__row">
            <div className="documentos-empleados-context__identity min-w-0">
              <div className="documentos-empleados-avatar">
                {employeeAvatars[selectedEmpleado.CODIGO] ? (
                  <img src={employeeAvatars[selectedEmpleado.CODIGO]} alt="" />
                ) : (
                  <span>{getEmpleadoInitials(selectedEmpleado)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="documentos-empleados-context__name truncate">
                  {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                </p>
                <p className="documentos-empleados-context__meta truncate">
                  {selectedEmpleado.CODIGO}
                  {selectedEmpleado['CENTRO TRABAJO'] ? ` · ${selectedEmpleado['CENTRO TRABAJO']}` : ''}
                  {selectedEmpleado.GRUPO ? ` · ${selectedEmpleado.GRUPO}` : ''}
                </p>
              </div>
            </div>
            {volverEmpleadosBtn}
          </div>
          <SegmentedControl
            layout="grid"
            value={activeEmpleadoTab}
            onChange={setActiveEmpleadoTab}
            className="documentos-empleados-sub-tabs"
            items={empleadoSubTabs}
          />
        </div>
      )}

      <div className="documentos-empleados-tab-panel app-card app-card--pad">
{activeTab === 'empleados' && !selectedEmpleado && (
            <div>
              <div className="solicitud-admin-toolbar documentos-empleados-section-head">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Selecciona un empleado</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Busca por nombre, código, email o grupo</p>
                </div>
              </div>

              <div className="documentos-empleados-filter-bar app-card app-card--pad">
                <div className="documentos-empleados-search-wrap">
                  <Search className="documentos-empleados-search-icon w-4 h-4" aria-hidden />
                  <input
                    id="documentos-empleados-search"
                    name="documentos-empleados-search"
                    type="search"
                    placeholder="Buscar empleado…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="documentos-empleados-search-input"
                    aria-label="Buscar empleados"
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')} className="solicitud-admin-btn documentos-empleados-search-clear" aria-label="Limpiar búsqueda">
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>

              {searchTerm && (
                <AlertBanner variant="info" compact className="mb-3">
                  {filteredEmpleados.length} empleado{filteredEmpleados.length !== 1 ? 's' : ''} encontrado{filteredEmpleados.length !== 1 ? 's' : ''}
                </AlertBanner>
              )}

            {filteredEmpleados.length === 0 ? (
                <AlertBanner variant="neutral" title="Sin resultados">
                  {searchTerm ? 'No se encontraron empleados con esa búsqueda.' : 'No hay empleados disponibles.'}
                </AlertBanner>
              ) : (
                <div className="documentos-empleados-employee-list solicitud-admin-mobile-list">
                  {filteredEmpleados.map((empleado, idx) => (
                    <article
                      key={empleado.CODIGO || idx}
                      className="solicitud-admin-mobile-card documentos-empleados-employee-card"
                    >
                      <div className="solicitud-admin-mobile-card__head">
                        <div className="documentos-empleados-avatar">
                          {employeeAvatars[empleado.CODIGO] ? (
                            <img src={employeeAvatars[empleado.CODIGO]} alt="" />
                          ) : (
                            <span>{getEmpleadoInitials(empleado)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="solicitud-admin-mobile-card__title truncate">
                            {empleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {empleado.CODIGO}
                            {empleado['CENTRO TRABAJO'] ? ` · ${empleado['CENTRO TRABAJO']}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{empleado['CORREO ELECTRONICO'] || 'Sin email'}</p>
                        </div>
                        {empleado.GRUPO && (
                          <span className="solicitud-status solicitud-status--neutral shrink-0">{empleado.GRUPO}</span>
                        )}
                      </div>
                      <div className="empleados-card-actions">
                        <button
                          type="button"
                          onClick={() => handleEmpleadoSelect(empleado)}
                          className="solicitud-admin-btn solicitud-admin-btn--primary empleados-card-actions__primary"
                        >
                          <Eye className="w-4 h-4" aria-hidden />
                          <span>Ver documentos</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

            </div>
          )}

          {activeEmpleadoTab === 'documentos' && selectedEmpleado && (

            <div className="space-y-4">

              <div className="solicitud-admin-toolbar mb-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Documentos del empleado</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmpleadoDocumentos([]);
                    fetchEmpleadoDocumentos(selectedEmpleado);
                  }}
                  className="solicitud-admin-btn"
                  title="Actualizar documentos"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>



              {/* Estadísticas para documentos normales */}
              {(() => {
                // Filtrar solo documentos normales (no nóminas ni justificantes ni documentos oficiales)
                const documentosNormales = empleadoDocumentos.filter(doc => {
                  const tipo = doc.tipo || doc.tipo_documento || '';
                  // Excluir Nómina și justificantes
                  if (tipo === 'Nómina' || tipo.toLowerCase().includes('justificantes')) {
                    return false;
                  }
                  // Excluir documentele oficiale: verificăm dacă sunt din DocumentosOficiales
                  // Documentele oficiale au tipuri specifice: sello, alta, contrato (dar NU ficha_empleado care este normal)
                  const isDocumentoOficial = 
                    tipo === 'Documento Oficial' || 
                    (tipo.toLowerCase() === 'sello') ||
                    (tipo.toLowerCase() === 'alta') ||
                    (tipo.toLowerCase() === 'contrato') ||
                    (tipo.toLowerCase() === 'liquidacion') ||
                    (tipo.toLowerCase().includes('oficial') && !tipo.toLowerCase().includes('ficha_empleado')) ||
                    (doc.originalData && doc.originalData.tipo_documento); // Documentele oficiale au originalData cu tipo_documento
                  return !isDocumentoOficial;
                });

                return (
                  <div className="flex justify-center mb-6">
                    {/* Total Documentos Normales */}
                    <div className="app-card app-card--pad documentos-empleados-stat">
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
                // Excluir nóminas, justificantes și documentos oficiales
                const documentosNormales = empleadoDocumentos.filter(doc => {
                  const tipo = doc.tipo || doc.tipo_documento || '';
                  // Excluir Nómina și justificantes
                  if (tipo === 'Nómina' || tipo.toLowerCase().includes('justificantes')) {
                    return false;
                  }
                  // Excluir documentele oficiale: verificăm dacă sunt din DocumentosOficiales
                  // Documentele oficiale au tipuri specifice: sello, alta, contrato (dar NU ficha_empleado care este normal)
                  // De asemenea, documentele oficiale au originalData sau sunt din documentosOficiales
                  const isDocumentoOficial = 
                    tipo === 'Documento Oficial' || 
                    (tipo.toLowerCase() === 'sello') ||
                    (tipo.toLowerCase() === 'alta') ||
                    (tipo.toLowerCase() === 'contrato') ||
                    (tipo.toLowerCase() === 'liquidacion') ||
                    (tipo.toLowerCase().includes('oficial') && !tipo.toLowerCase().includes('ficha_empleado')) ||
                    (doc.originalData && doc.originalData.tipo_documento); // Documentele oficiale au originalData cu tipo_documento
                  return !isDocumentoOficial;
                });
                
                console.log('🔍 [DocumentosEmpleados] Documentos totales:', empleadoDocumentos.length);
                console.log('🔍 [DocumentosEmpleados] Documentos normales (después de filter):', documentosNormales.length);
                if (empleadoDocumentos.length > 0) {
                  console.log('🔍 [DocumentosEmpleados] Ejemplo de documento en empleadoDocumentos:', empleadoDocumentos[0]);
                  console.log('🔍 [DocumentosEmpleados] Tipo del primer documento:', empleadoDocumentos[0]?.tipo || empleadoDocumentos[0]?.tipo_documento || 'N/A');
                }

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
                           className="documentos-empleados-doc-row">

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
                            className="solicitud-admin-btn solicitud-admin-btn--primary text-xs"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="hidden sm:inline">Ver</span>
                          </button>

                          <button
                            onClick={() => handleDownloadDocument(documento)}
                            className="solicitud-admin-btn text-xs"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Descargar</span>
                          </button>

                          <button
                            onClick={() => openDeleteConfirmModalDocumento(documento)}
                            className="solicitud-admin-btn solicitud-admin-btn--danger text-xs"
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
            <div className="documentos-empleados-gestoria-embed">
              <NominasMatrixTab />
            </div>
          )}

          {/* Tab Coste Personal */}
          {activeTab === 'coste-personal' && (
            <div className="documentos-empleados-gestoria-embed">
              <CostePersonalTab />
            </div>
          )}

          {activeTab === 'certificados-retenciones' && (
            <div className="documentos-empleados-gestoria-embed">
              <CertificadosRetencionesTab showNotification={showNotification} />
            </div>
          )}

          {activeTab === 'diplomas' && (
            <div className="documentos-empleados-diplomas-panel">
              <div className="solicitud-admin-toolbar mb-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Diplomas</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gestiona diplomas de empleados</p>
                </div>
              </div>

              {/* Upload PDFs individuales */}
              <div className="app-card app-card--pad">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-gray-500" aria-hidden />
                  Subir PDFs individuales
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Selecciona uno o más archivos PDF de diplomas. El sistema extraerá automáticamente los nombres de los empleados desde el PDF (o desde el nombre del archivo como fallback).
                </p>
                
                <div className="flex flex-col gap-4">
                  <label className="documentos-empleados-upload-zone">
                    <FileUp className="w-8 h-8 text-gray-400 mb-2" aria-hidden />
                    <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Click para seleccionar</span> o arrastra los PDFs aquí
                    </p>
                    <p className="text-xs text-gray-500">Puedes seleccionar múltiples archivos PDF</p>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;

                        setDiplomasPdfsFiles(files);
                        setDiplomasPdfsLoading(true);
                        setDiplomasPdfsError(null);
                        setDiplomasPdfsPreview(null);

                        try {
                          const token = localStorage.getItem('auth_token');
                          const formData = new FormData();
                          files.forEach((file) => {
                            formData.append('pdf_files', file);
                          });

                          const response = await fetch(routes.diplomasUploadPdfsPreview, {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                          });

                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Error al procesar PDFs');
                          }

                          const data = await response.json();
                          setDiplomasPdfsPreview(data);
                          setDiplomasPdfsSeleccionadas(
                            data.diplomas
                              .filter((d) => d.empleadoCodigo)
                              .map((d) => ({
                                nombreArchivo: d.nombreArchivo,
                                empleadoCodigo: d.empleadoCodigo,
                                empleadoNombre: d.empleadoNombre,
                              }))
                          );

                          showNotification('success', 'PDFs procesados', `Se encontraron ${data.diplomas.length} diplomas. ${data.diplomas.filter((d) => d.empleadoCodigo).length} asociados correctamente.`);
                        } catch (error) {
                          setDiplomasPdfsError(error.message);
                          showNotification('error', 'Error', `Error al procesar PDFs: ${error.message}`);
                        } finally {
                          setDiplomasPdfsLoading(false);
                        }
                      }}
                    />
                  </label>

                  {diplomasPdfsLoading && (
                    <AlertBanner variant="info" loading title="Procesando PDFs…" />
                  )}

                  {diplomasPdfsError && (
                    <AlertBanner variant="danger" title="Error">{diplomasPdfsError}</AlertBanner>
                  )}

                  {diplomasPdfsPreview && (
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-900 mb-3">
                        Preview: {diplomasPdfsPreview.diplomas.length} diplomas encontrados
                      </h4>
                      
                      <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                        {diplomasPdfsPreview.diplomas.map((diploma, idx) => (
                          <div
                            key={idx}
                            className={`documentos-empleados-diploma-row ${
                              diploma.empleadoCodigo ? 'documentos-empleados-diploma-row--ok' : 'documentos-empleados-diploma-row--warn'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {diploma.nombreArchivo}
                                </p>
                                {diploma.nombreExtraido && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Nombre extraído: <span className="font-semibold">{diploma.nombreExtraido}</span>
                                    {diploma.fuente && (
                                      <span className="ml-2 text-gray-500">({diploma.fuente === 'pdf' ? 'PDF' : 'Filename'})</span>
                                    )}
                                  </p>
                                )}
                                {diploma.empleadoCodigo ? (
                                  <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden />
                                    Asociado a: {diploma.empleadoNombre} ({diploma.empleadoCodigo})
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                                    No se encontró empleado
                                  </p>
                                )}
                              </div>
                              {diploma.empleadoCodigo && (
                                <input
                                  type="checkbox"
                                  checked={diplomasPdfsSeleccionadas.some(
                                    (d) => d.nombreArchivo === diploma.nombreArchivo
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDiplomasPdfsSeleccionadas([
                                        ...diplomasPdfsSeleccionadas,
                                        {
                                          nombreArchivo: diploma.nombreArchivo,
                                          empleadoCodigo: diploma.empleadoCodigo,
                                          empleadoNombre: diploma.empleadoNombre,
                                        },
                                      ]);
                                    } else {
                                      setDiplomasPdfsSeleccionadas(
                                        diplomasPdfsSeleccionadas.filter(
                                          (d) => d.nombreArchivo !== diploma.nombreArchivo
                                        )
                                      );
                                    }
                                  }}
                                  className="ml-2 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {diplomasPdfsPreview.errores && diplomasPdfsPreview.errores.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-bold text-red-700 mb-2">Errores:</h5>
                          <div className="space-y-1">
                            {diplomasPdfsPreview.errores.map((error, idx) => (
                              <p key={idx} className="text-xs text-red-600">
                                {error.nombreArchivo}: {error.error}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {diplomasPdfsSeleccionadas.length > 0 && (
                        <button
                          onClick={async () => {
                            if (diplomasPdfsFiles.length === 0) return;

                            setDiplomasPdfsGuardando(true);
                            try {
                              const token = localStorage.getItem('auth_token');
                              const formData = new FormData();
                              diplomasPdfsFiles.forEach((file) => {
                                formData.append('pdf_files', file);
                              });
                              formData.append('diplomas', JSON.stringify(diplomasPdfsSeleccionadas));

                              const response = await fetch(routes.diplomasUploadPdfsConfirmar, {
                                method: 'POST',
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                                body: formData,
                              });

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Error al guardar diplomas');
                              }

                              const data = await response.json();
                              showNotification('success', 'Diplomas guardadas', data.message || `Se guardaron ${data.guardados} diplomas correctamente.`);

                              // Reset
                              setDiplomasPdfsFiles([]);
                              setDiplomasPdfsPreview(null);
                              setDiplomasPdfsSeleccionadas([]);
                              // Recargar lista de diplomas
                              fetchTodasLasDiplomas();
                            } catch (error) {
                              showNotification('error', 'Error', `Error al guardar diplomas: ${error.message}`);
                            } finally {
                              setDiplomasPdfsGuardando(false);
                            }
                          }}
                          disabled={diplomasPdfsGuardando || diplomasPdfsSeleccionadas.length === 0}
                          className="solicitud-admin-btn solicitud-admin-btn--primary w-full disabled:opacity-50"
                        >
                          {diplomasPdfsGuardando ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                              <span>Guardando…</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" aria-hidden />
                              <span>Guardar {diplomasPdfsSeleccionadas.length} diplomas seleccionadas</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upload ZIP */}
              <div className="app-card app-card--pad">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-gray-500" aria-hidden />
                  Subir ZIP con diplomas
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Sube un archivo ZIP con diplomas en formato PDF. El sistema extraerá automáticamente los nombres de los empleados desde el PDF (o desde el nombre del archivo como fallback).
                </p>
                
                <div className="flex flex-col gap-4">
                  <label className="documentos-empleados-upload-zone">
                    <Archive className="w-8 h-8 text-gray-400 mb-2" aria-hidden />
                    <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Click para seleccionar</span> o arrastra el ZIP aquí
                    </p>
                    <p className="text-xs text-gray-500">ZIP con archivos PDF</p>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setDiplomasZipFile(file);
                        setDiplomasLoading(true);
                        setDiplomasError(null);
                        setDiplomasPreview(null);

                        try {
                          const token = localStorage.getItem('auth_token');
                          const formData = new FormData();
                          formData.append('zip_file', file);

                          const response = await fetch(routes.diplomasUploadZipPreview, {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                          });

                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Error al procesar ZIP');
                          }

                          const data = await response.json();
                          setDiplomasPreview(data);
                          setDiplomasSeleccionadas(
                            data.diplomas
                              .filter((d) => d.empleadoCodigo)
                              .map((d) => ({
                                nombreArchivo: d.nombreArchivo,
                                empleadoCodigo: d.empleadoCodigo,
                                empleadoNombre: d.empleadoNombre,
                              }))
                          );

                          showNotification('success', 'ZIP procesado', `Se encontraron ${data.diplomas.length} diplomas. ${data.diplomas.filter((d) => d.empleadoCodigo).length} asociados correctamente.`);
                        } catch (error) {
                          setDiplomasError(error.message);
                          showNotification('error', 'Error', `Error al procesar ZIP: ${error.message}`);
                        } finally {
                          setDiplomasLoading(false);
                        }
                      }}
                    />
                  </label>

                  {diplomasLoading && (
                    <AlertBanner variant="info" loading title="Procesando ZIP…" />
                  )}

                  {diplomasError && (
                    <AlertBanner variant="danger" title="Error">{diplomasError}</AlertBanner>
                  )}

                  {diplomasPreview && (
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-900 mb-3">
                        Preview: {diplomasPreview.diplomas.length} diplomas encontrados
                      </h4>
                      
                      <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                        {diplomasPreview.diplomas.map((diploma, idx) => (
                          <div
                            key={idx}
                            className={`documentos-empleados-diploma-row ${
                              diploma.empleadoCodigo ? 'documentos-empleados-diploma-row--ok' : 'documentos-empleados-diploma-row--warn'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {diploma.nombreArchivo}
                                </p>
                                {diploma.nombreExtraido && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Nombre extraído: <span className="font-semibold">{diploma.nombreExtraido}</span>
                                    {diploma.fuente && (
                                      <span className="ml-2 text-gray-500">({diploma.fuente === 'pdf' ? 'PDF' : 'Filename'})</span>
                                    )}
                                  </p>
                                )}
                                {diploma.empleadoCodigo ? (
                                  <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden />
                                    Asociado a: {diploma.empleadoNombre} ({diploma.empleadoCodigo})
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                                    No se encontró empleado
                                  </p>
                                )}
                              </div>
                              {diploma.empleadoCodigo && (
                                <input
                                  type="checkbox"
                                  checked={diplomasSeleccionadas.some(
                                    (d) => d.nombreArchivo === diploma.nombreArchivo
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDiplomasSeleccionadas([
                                        ...diplomasSeleccionadas,
                                        {
                                          nombreArchivo: diploma.nombreArchivo,
                                          empleadoCodigo: diploma.empleadoCodigo,
                                          empleadoNombre: diploma.empleadoNombre,
                                        },
                                      ]);
                                    } else {
                                      setDiplomasSeleccionadas(
                                        diplomasSeleccionadas.filter(
                                          (d) => d.nombreArchivo !== diploma.nombreArchivo
                                        )
                                      );
                                    }
                                  }}
                                  className="ml-2 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {diplomasPreview.errores && diplomasPreview.errores.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-bold text-red-700 mb-2">Errores:</h5>
                          <div className="space-y-1">
                            {diplomasPreview.errores.map((error, idx) => (
                              <p key={idx} className="text-xs text-red-600">
                                {error.nombreArchivo}: {error.error}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {diplomasSeleccionadas.length > 0 && (
                        <button
                          onClick={async () => {
                            if (!diplomasZipFile) return;

                            setDiplomasGuardando(true);
                            try {
                              const token = localStorage.getItem('auth_token');
                              const formData = new FormData();
                              formData.append('zip_file', diplomasZipFile);
                              formData.append('diplomas', JSON.stringify(diplomasSeleccionadas));

                              const response = await fetch(routes.diplomasUploadZipConfirmar, {
                                method: 'POST',
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                                body: formData,
                              });

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Error al guardar diplomas');
                              }

                              const data = await response.json();
                              showNotification('success', 'Diplomas guardadas', data.message || `Se guardaron ${data.guardados} diplomas correctamente.`);

                              // Reset
                              setDiplomasZipFile(null);
                              setDiplomasPreview(null);
                              setDiplomasSeleccionadas([]);
                              // Recargar lista de diplomas
                              fetchTodasLasDiplomas();
                            } catch (error) {
                              showNotification('error', 'Error', `Error al guardar diplomas: ${error.message}`);
                            } finally {
                              setDiplomasGuardando(false);
                            }
                          }}
                          disabled={diplomasGuardando || diplomasSeleccionadas.length === 0}
                          className="solicitud-admin-btn solicitud-admin-btn--primary w-full disabled:opacity-50"
                        >
                          {diplomasGuardando ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                              <span>Guardando…</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" aria-hidden />
                              <span>Guardar {diplomasSeleccionadas.length} diplomas seleccionadas</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de todas las diplomas */}
              <div className="app-card app-card--pad">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-gray-500" aria-hidden />
                    Todas las diplomas
                  </h3>
                  <button
                    onClick={fetchTodasLasDiplomas}
                    disabled={todasLasDiplomasLoading}
                    className="solicitud-admin-btn solicitud-admin-btn--primary inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {todasLasDiplomasLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                        <span>Cargando…</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" aria-hidden />
                        <span>Actualizar</span>
                      </>
                    )}
                  </button>
                </div>

                {todasLasDiplomasLoading ? (
                  <AlertBanner variant="info" loading title="Cargando diplomas…" />
                ) : todasLasDiplomasError ? (
                  <AlertBanner variant="danger" title="Error">{todasLasDiplomasError}</AlertBanner>
                ) : todasLasDiplomas.length === 0 ? (
                  <div className="text-center py-8">
                    <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" aria-hidden />
                    <p className="text-sm text-gray-600 dark:text-gray-400">No hay diplomas en la base de datos</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Total: <span className="font-bold">{todasLasDiplomas.length}</span> diplomas
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {todasLasDiplomas.map((diploma) => (
                        <div key={diploma.id} className="documentos-empleados-diploma-row">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1 truncate">{diploma.nombre_archivo}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-semibold">Empleado:</span> {diploma.nombre_empleado} ({diploma.empleado_id})
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Subido el: {new Date(diploma.uploaded_at).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('auth_token');
                                  const response = await fetch(routes.diplomasDescargar(diploma.id), {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  });

                                  if (!response.ok) {
                                    throw new Error('Error al descargar diploma');
                                  }

                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  const contentDisposition = response.headers.get('Content-Disposition');
                                  const filename = contentDisposition
                                    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || diploma.nombre_archivo
                                    : diploma.nombre_archivo;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(url);
                                } catch (error) {
                                  showNotification('error', 'Error', `Error al descargar diploma: ${error.message}`);
                                }
                              }}
                              className="solicitud-admin-btn solicitud-admin-btn--primary inline-flex items-center gap-2 w-full sm:w-auto shrink-0"
                            >
                              <Download className="w-4 h-4" aria-hidden />
                              <span>Descargar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeEmpleadoTab === 'nominas' && selectedEmpleado && (

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
</div>



              {/* Estadísticas compactas para nóminas */}
              <div className="flex justify-center mb-6">
                {/* Total Nóminas */}
                <div className="app-card app-card--pad documentos-empleados-stat">
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

                    <div key={`nomina-${nomina.id}-${idx}-${nomina.fileName}`} className="documentos-empleados-doc-row">

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
                          className="solicitud-admin-btn solicitud-admin-btn--primary text-xs"
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
                          className="solicitud-admin-btn text-xs"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="hidden sm:inline">Descargar</span>
                        </button>

                        <button
                          onClick={() => openDeleteConfirmModal(nomina)}
                          className="solicitud-admin-btn solicitud-admin-btn--danger text-xs"
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



          {activeEmpleadoTab === 'documentos-empresa' && selectedEmpleado && (

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
</div>

















              {/* Estadísticas compactas para documentos empresa */}
              <div className="flex justify-center mb-6">
                {/* Total Documentos Oficiales */}
                <div className="app-card app-card--pad documentos-empleados-stat w-full max-w-sm">
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

                      <div key={`${documento.id || 'no-id'}-${idx}-${documento.fileName || 'no-name'}`} className="documentos-empleados-doc-row">

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

                        {/* Checkbox para visibilidad del empleado */}
                        <div className="flex items-center gap-2 mb-3 p-2 bg-white/50 rounded-lg border border-purple-200">
                          <input
                            type="checkbox"
                            id={`visible-${documento.doc_id}`}
                            checked={documento.permisso_para_empleado === 'SI' || documento.permisso_para_empleado === 'YES'}
                            onChange={async (e) => {
                              try {
                                const token = localStorage.getItem('auth_token');
                                const headers = {
                                  'Content-Type': 'application/json',
                                };
                                if (token) {
                                  headers['Authorization'] = `Bearer ${token}`;
                                }
                                const response = await fetch(`${routes.updateDocumentoOficialVisibility}/${documento.doc_id}/visible`, {
                                  method: 'POST',
                                  headers,
                                  body: JSON.stringify({ visible: e.target.checked }),
                                });
                                if (!response.ok) {
                                  throw new Error(`Error HTTP: ${response.status}`);
                                }
                                const result = await response.json();
                                if (result.success) {
                                  // Actualizar el estado local inmediatamente para feedback visual
                                  setDocumentosOficiales(prev => prev.map(doc => 
                                    doc.doc_id === documento.doc_id 
                                      ? { ...doc, permisso_para_empleado: e.target.checked ? 'SI' : null }
                                      : doc
                                  ));
                                  showNotification('success', 'Visibilidad actualizada', 'La visibilidad del documento se ha actualizado correctamente');
                                  
                                  // Reîncarcă lista din backend pentru a fi siguri că avem datele corecte
                                  if (selectedEmpleado) {
                                    setTimeout(() => {
                                      fetchDocumentosOficiales(selectedEmpleado);
                                    }, 500); // Mic delay pentru a permite backend-ului să proceseze
                                  }
                                }
                              } catch (error) {
                                console.error('Error actualizando visibilidad:', error);
                                showNotification('error', 'Error', 'No se pudo actualizar la visibilidad del documento');
                              }
                            }}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <label htmlFor={`visible-${documento.doc_id}`} className="text-xs text-gray-700 cursor-pointer">
                            Visible para el empleado
                          </label>
                        </div>

                        {/* Action Buttons - Responsive */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handlePreviewDocumentOficial(documento)}
                            className="solicitud-admin-btn solicitud-admin-btn--primary text-xs"
                            title="Vista previa del documento"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="hidden sm:inline">Preview</span>
                          </button>

                          <button
                            onClick={() => handleFirmarDocumentoOficial(documento)}
                            className="solicitud-admin-btn text-xs"
                            title="Firmar documento"
                          >
                            <span className="text-xs">✍️</span>
                            <span className="hidden sm:inline">Firmar</span>
                          </button>

                          {isContratoDocumento(documento) && (
                            <button
                              onClick={() => setDocumentoSelloToConfirm(documento)}
                              disabled={aplicandoSelloDocId === documento.doc_id}
                              className="solicitud-admin-btn text-xs disabled:opacity-60"
                              title="Añadir sello de empresa y reemplazar el PDF"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="hidden sm:inline">
                                {aplicandoSelloDocId === documento.doc_id ? 'Sellando…' : 'Añadir sello'}
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDownloadDocumentOficial(documento)}
                            className="solicitud-admin-btn text-xs"
                            title="Descargar documento"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Descargar</span>
                          </button>

                          <button
                            onClick={() => openDeleteConfirmModalDocumentoOficial(documento)}
                            className="solicitud-admin-btn solicitud-admin-btn--danger text-xs"
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

                          <button
                            onClick={() => handleToggleNecesitaFirma(documento)}
                            className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1 ${
                              documento.necesita_firma
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-gray-500 hover:bg-gray-600'
                            }`}
                            title={documento.necesita_firma ? 'Documento requiere firma' : 'Documento no requiere firma'}
                          >
                            {documento.necesita_firma ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="hidden sm:inline">✓ Necesita Firma</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="hidden sm:inline">No Firma</span>
                              </>
                            )}
                          </button>

                          {/* Buton pentru a marca contractul ca fiind semnat (doar pentru CONTRATO, nu pentru CONTRATO firmado) */}
                          {(() => {
                            const tipo = (documento.tipo || '').toUpperCase();
                            const tipoDocumento = (documento.tipo_documento || '').toUpperCase();
                            const esContrato = tipo === 'CONTRATO' || tipoDocumento === 'CONTRATO';
                            const esContratoFirmado = tipo === 'CONTRATO FIRMADO' || tipoDocumento === 'CONTRATO FIRMADO' || tipo.includes('CONTRATO FIRMADO') || tipoDocumento.includes('CONTRATO FIRMADO');
                            return esContrato && !esContratoFirmado;
                          })() && (
                            <button
                              onClick={() => handleMarcarContratoComoFirmado(documento)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                              title="Marcar contrato como firmado (ya fue firmado físicamente)"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="hidden sm:inline">Marcar Firmado</span>
                            </button>
                          )}
                        </div>

                      </div>

                    ))}

                  </div>

                )}

            </div>

          )}

          {activeEmpleadoTab === 'documentos-prl' && selectedEmpleado && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-bold text-amber-700 truncate">
                    🦺 Documentos PRL de {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                  </h2>
                  <button
                    onClick={() => fetchDocumentosPrl(selectedEmpleado)}
                    className="p-2 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors duration-200 flex-shrink-0"
                    title="Actualizar documentos PRL"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
</div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="app-card app-card--pad documentos-empleados-stat">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-amber-900">{documentosPrl.length}</p>
                </div>
                <div className="app-card app-card--pad documentos-empleados-stat">
                  <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {documentosPrl.filter((d) => d.estado === 'PENDIENTE').length}
                  </p>
                </div>
                <div className="app-card app-card--pad documentos-empleados-stat">
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Firmados</p>
                  <p className="text-2xl font-bold text-green-900">
                    {documentosPrl.filter((d) => d.estado === 'FIRMADO').length}
                  </p>
                </div>
                <div className="app-card app-card--pad documentos-empleados-stat">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Otros</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {documentosPrl.filter((d) => d.estado !== 'PENDIENTE' && d.estado !== 'FIRMADO').length}
                  </p>
                </div>
              </div>

              {documentosPrlLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando documentos PRL...</p>
                </div>
              ) : documentosPrlError ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">❌</div>
                  <p className="text-red-600 mb-2">Error al cargar documentos PRL</p>
                  <p className="text-gray-600 text-sm">{documentosPrlError}</p>
                  <button
                    onClick={() => fetchDocumentosPrl(selectedEmpleado)}
                    className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : documentosPrl.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🦺</div>
                  <p className="text-gray-600">Este empleado no tiene documentos PRL asignados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documentosPrl.map((doc) => (
                    <div
                      key={doc.id}
                      className={`border rounded-xl p-4 hover:shadow-md transition-shadow ${
                        doc.estado === 'PENDIENTE' && doc.requiere_firma
                          ? 'border-yellow-300 bg-yellow-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {doc.template_nombre || doc.nombre_archivo_original || `Documento #${doc.id}`}
                            </h3>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPrlEstadoColor(
                                doc.estado,
                                doc.requiere_firma,
                              )}`}
                            >
                              {getPrlEstadoLabel(doc.estado)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{getPrlTipoLabel(doc.tipo_documento)}</p>
                          <div className="text-xs text-gray-500 space-y-1">
                            {doc.asignado_en && (
                              <p>
                                📅 Asignado:{' '}
                                {new Date(doc.asignado_en).toLocaleString('es-ES')}
                              </p>
                            )}
                            {doc.fecha_firma && (
                              <p>
                                ✍️ Firmado:{' '}
                                {new Date(doc.fecha_firma).toLocaleString('es-ES')}
                              </p>
                            )}
                            {doc.es_manual_test && (
                              <p>
                                📝 Test:{' '}
                                {doc.test_completado
                                  ? `Completado${
                                      doc.test_puntuacion != null
                                        ? ` (${doc.test_puntuacion} pts)`
                                        : ''
                                    }`
                                  : 'Pendiente'}
                              </p>
                            )}
                            {doc.requiere_firma && (
                              <p>🔏 Requiere firma</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => descargarPrlDocumento(selectedEmpleado, doc, false)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                            title="Descargar original"
                          >
                            Descargar
                          </button>
                          {(doc.estado === 'FIRMADO' || doc.nombre_archivo_firmado) && (
                            <button
                              type="button"
                              onClick={() => descargarPrlDocumento(selectedEmpleado, doc, true)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                              title="Descargar firmado"
                            >
                              Firmado
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeEmpleadoTab === 'subir-documentos' && selectedEmpleado && (

            <div>

              <div className="flex items-center justify-between mb-6">

                <h2 className="text-xl font-bold text-red-600">

                  Subir Documentos para {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}

                </h2>
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
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showUploadModal}
          onClose={handleUploadCancel}
          title="Configurar documentos"
          size="md"
          className="app-modal--form documentos-empleados-upload-modal"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={handleUploadCancel} className="solicitud-admin-btn flex-1">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUploadConfirm}
                disabled={uploading || !Object.values(documentTypes).every((type) => type.trim())}
                className="solicitud-admin-btn solicitud-admin-btn--primary flex-1 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                    Subiendo…
                  </span>
                ) : (
                  'Subir documentos'
                )}
              </button>
            </div>
          )}
        >



            <div className="space-y-4">

              {/* Información de archivos seleccionados */}

              <div className="app-card app-card--pad documentos-empleados-upload-files">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Archivos seleccionados</h4>

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

                  className="app-modal__input w-full"

                  required

                />

                    <p className="text-xs text-gray-500">

                      Describe brevemente el tipo de documento para este archivo

                </p>

                  </div>

                ))}

              </div>

            </div>
        </Modal>,
        document.body
      )}



      {/* Información */}
      <AlertBanner variant="info" compact className="documentos-empleados-info">
        Selecciona un empleado para gestionar documentos, nóminas y certificados. Formatos: PDF, DOC, DOCX, JPG, PNG, TXT.
      </AlertBanner>



      {/* Modal para preview de documentos */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showPreviewModal}
          onClose={handleClosePreview}
          title={`Vista previa: ${previewDocument?.fileName || 'Documento'}${previewDocument?.tipo === 'Nómina' ? ' (Nómina)' : ''}`}
          size="xl"
          className="app-modal--preview documentos-empleados-preview-modal"
          showCloseButton
          footer={(
            <button type="button" onClick={handleClosePreview} className="app-modal__btn solicitud-admin-btn w-full sm:w-auto">
              Cerrar
            </button>
          )}
        >
          <div className="documentos-preview-body relative">
            {previewLoading && (

              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">

                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>

                <p className="text-gray-600 text-sm font-medium">Cargando vista previa...</p>

              </div>

            )}

            {previewError && (

              <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-red-600 text-sm font-semibold">

                {previewError}

              </div>

            )}

            <div className="p-4 flex-1 overflow-y-auto min-h-0">

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
                      // PDF: isPdf flag (nóminas fără extensie în fileName) SAU extensie .pdf
                      previewDocument?.isPdf === true ||
                      previewDocument?.fileName?.toLowerCase().endsWith('.pdf')
                    ) ? (

                      <div className="pdf-preview-container">
                        {/* Nóminas / oficiales: viewer simplu. Altele: ContractSigner pe desktop */}
                        {previewDocument?.esOficial === true || previewDocument?.tipo === 'Nómina' ? (
                          // Viewer simplu (fără sistem de firmă)
                          <div className="w-full h-[75vh]">
                            {isAndroid || isIOS ? (
                              <PDFViewerAndroid 
                                pdfUrl={previewDocument?.previewUrl || ''} 
                                className="w-full h-full"
                              />
                            ) : (
                              <iframe
                                src={previewDocument?.previewUrl || ''}
                                className="w-full h-full border-0"
                                title={previewDocument?.fileName || 'PDF Preview'}
                                style={{ minHeight: '600px' }}
                              />
                            )}
                          </div>
                        ) : (
                          // Pentru documente normale: folosim ContractSigner pe desktop
                          <>
                            {isAndroid || isIOS ? (
                              <PDFViewerAndroid 
                                pdfUrl={previewDocument?.previewUrl || ''} 
                                className="w-full h-full"
                              />
                            ) : (
                              <ContractSigner
                                pdfUrl={previewDocument?.previewUrl || ''}
                                docId={previewDocument?.id || ''}
                                originalFileName={previewDocument?.fileName || ''}
                                autoStampMode={isContratoDocumento(previewDocument)}
                                onClose={handleClosePreview}
                              />
                            )}
                          </>
                        )}
                      </div>

                    ) : previewDocument?.fileName?.toLowerCase().match(/\.(doc|docx)$/i) ? (
                      <div className="p-4 bg-gray-50 text-center py-12">
                        <div className="text-6xl mb-4">📄</div>
                        <p className="text-gray-600 mb-4 font-bold text-lg">Documento Word</p>
                        <p className="text-sm text-gray-500 mb-6">
                          Los archivos .doc/.docx no se pueden previsualizar directamente en el navegador.
                        </p>
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 max-w-md mx-auto">
                          <p className="text-sm text-blue-800 mb-4">
                            💡 <strong>Consejo:</strong> Descarga el archivo y ábrelo con Microsoft Word, LibreOffice o Google Docs
                          </p>
                          <button
                            onClick={() => {
                              const empleadoIdDownload = selectedEmpleado?.CODIGO || previewDocument?.empleadoId || previewDocument?.id;
                              const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || previewDocument?.empleadoEmail || previewDocument?.correo_electronico || '';
                              const downloadUrl = previewDocument?.esOficial
                                ? `${routes.downloadDocumentoOficial}?id=${empleadoIdDownload}&documentId=${previewDocument?.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}`
                                : `${routes.downloadDocumento}?id=${empleadoIdDownload}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}&documentId=${previewDocument?.doc_id}`;
                              
                              const token = localStorage.getItem('auth_token');
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = previewDocument?.fileName || 'documento.doc';
                              if (token) {
                                link.setAttribute('data-token', token);
                              }
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center space-x-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Descargar Documento</span>
                          </button>
                        </div>
                      </div>
                    ) : previewDocument?.fileName?.toLowerCase().match(/\.(xls|xlsx)$/i) ? (
                      <div className="p-4 bg-gray-50 text-center py-12">
                        <div className="text-6xl mb-4">📊</div>
                        <p className="text-gray-600 mb-4 font-bold text-lg">Documento Excel</p>
                        <p className="text-sm text-gray-500 mb-6">
                          Los archivos .xls/.xlsx no se pueden previsualizar directamente en el navegador.
                        </p>
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 max-w-md mx-auto">
                          <p className="text-sm text-blue-800 mb-4">
                            💡 <strong>Consejo:</strong> Descarga el archivo y ábrelo con Microsoft Excel, LibreOffice o Google Sheets
                          </p>
                          <button
                            onClick={() => {
                              const empleadoIdDownload = selectedEmpleado?.CODIGO || previewDocument?.empleadoId || previewDocument?.id;
                              const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || previewDocument?.empleadoEmail || previewDocument?.correo_electronico || '';
                              const downloadUrl = previewDocument?.esOficial
                                ? `${routes.downloadDocumentoOficial}?id=${empleadoIdDownload}&documentId=${previewDocument?.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}`
                                : `${routes.downloadDocumento}?id=${empleadoIdDownload}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}&documentId=${previewDocument?.doc_id}`;
                              
                              const token = localStorage.getItem('auth_token');
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = previewDocument?.fileName || 'documento.xls';
                              if (token) {
                                link.setAttribute('data-token', token);
                              }
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center space-x-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Descargar Documento</span>
                          </button>
                        </div>
                      </div>
                    ) : previewDocument?.fileName?.toLowerCase().match(/\.(ppt|pptx)$/i) ? (
                      <div className="p-4 bg-gray-50 text-center py-12">
                        <div className="text-6xl mb-4">📽️</div>
                        <p className="text-gray-600 mb-4 font-bold text-lg">Documento PowerPoint</p>
                        <p className="text-sm text-gray-500 mb-6">
                          Los archivos .ppt/.pptx no se pueden previsualizar directamente en el navegador.
                        </p>
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 max-w-md mx-auto">
                          <p className="text-sm text-blue-800 mb-4">
                            💡 <strong>Consejo:</strong> Descarga el archivo y ábrelo con Microsoft PowerPoint, LibreOffice o Google Slides
                          </p>
                          <button
                            onClick={() => {
                              const empleadoIdDownload = selectedEmpleado?.CODIGO || previewDocument?.empleadoId || previewDocument?.id;
                              const empleadoEmail = selectedEmpleado?.['CORREO ELECTRONICO'] || previewDocument?.empleadoEmail || previewDocument?.correo_electronico || '';
                              const downloadUrl = previewDocument?.esOficial
                                ? `${routes.downloadDocumentoOficial}?id=${empleadoIdDownload}&documentId=${previewDocument?.doc_id}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}`
                                : `${routes.downloadDocumento}?id=${empleadoIdDownload}&email=${encodeURIComponent(empleadoEmail)}&fileName=${encodeURIComponent(previewDocument?.fileName || '')}&documentId=${previewDocument?.doc_id}`;
                              
                              const token = localStorage.getItem('auth_token');
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = previewDocument?.fileName || 'documento.ppt';
                              if (token) {
                                link.setAttribute('data-token', token);
                              }
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center space-x-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Descargar Documento</span>
                          </button>
                        </div>
                      </div>
                    ) : (

                      <div className="p-4 bg-gray-50 text-center">

                        <p className="text-gray-600 mb-4">📄 Documento disponible para descarga</p>

                        <p className="text-sm text-gray-500">Este tipo de archivo se muestra mejor al descargarlo</p>

                      </div>

                    )}

                  </div>

                </div>

              )}

            </div>
            
            </div>
        </Modal>,
        document.body
      )}







      {/* Modal separado para nóminas */}
      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showNominaUploadModal}
          onClose={() => {
            setShowNominaUploadModal(false);
            setSelectedFiles([]);
            setSelectedMonth(new Date().getMonth());
            setSelectedYear(new Date().getFullYear());
          }}
          title="Configurar nómina"
          size="md"
          className="app-modal--form documentos-empleados-upload-modal"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => {
                setShowNominaUploadModal(false);
                setSelectedFiles([]);
                setSelectedMonth(new Date().getMonth());
                setSelectedYear(new Date().getFullYear());
              }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={handleUploadConfirm} disabled={uploading} className="solicitud-admin-btn solicitud-admin-btn--primary flex-1 disabled:opacity-50">
                {uploading ? 'Subiendo…' : 'Subir nómina'}
              </button>
            </div>
          )}
        >



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

                  className="app-modal__input w-full"

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

                  className="app-modal__input w-full"

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



              </div>



        </Modal>,
        document.body
      )}



      {/* Modal de Confirmare de Borrado de Nómina */}

      {showDeleteConfirmModal && nominaToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!nominaToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setNominaToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setNominaToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteConfirmModal(false);
                  await handleDeleteNomina(nominaToDelete);
                  setNominaToDelete(null);
                }}
                className="solicitud-admin-btn solicitud-admin-btn--danger flex-1"
              >
                Borrar nómina
              </button>
            </div>
          )}
        >
          <AlertBanner variant="danger" title="Acción irreversible">
            ¿Estás seguro de que quieres borrar <strong>{nominaToDelete.fileName}</strong>? Esta acción no se puede deshacer.
          </AlertBanner>
        </Modal>,
        document.body
      )}



      {/* Modal de Confirmare de Borrado de Documento Normal */}
      {showDeleteConfirmModal && documentoToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!documentoToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setDocumentoToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setDocumentoToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={async () => { setShowDeleteConfirmModal(false); await handleDeleteDocumento(documentoToDelete); setDocumentoToDelete(null); }} className="solicitud-admin-btn solicitud-admin-btn--danger flex-1">Borrar documento</button>
            </div>
          )}
        >
          <AlertBanner variant="danger" title="Acción irreversible">
            ¿Estás seguro de que quieres borrar <strong>{documentoToDelete.fileName}</strong>? Esta acción no se puede deshacer.
          </AlertBanner>
        </Modal>,
        document.body
      )}



      {/* Modal de Confirmare de Borrado de Documento Oficial */}
      {showDeleteConfirmModal && documentoOficialToDelete && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showDeleteConfirmModal && !!documentoOficialToDelete}
          onClose={() => { setShowDeleteConfirmModal(false); setDocumentoOficialToDelete(null); }}
          title="Confirmar borrado"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => { setShowDeleteConfirmModal(false); setDocumentoOficialToDelete(null); }} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={async () => { setShowDeleteConfirmModal(false); await handleDeleteDocumentoOficial(documentoOficialToDelete); setDocumentoOficialToDelete(null); }} className="solicitud-admin-btn solicitud-admin-btn--danger flex-1">Borrar documento</button>
            </div>
          )}
        >
          <AlertBanner variant="danger" title="Acción irreversible">
            ¿Estás seguro de que quieres borrar el documento oficial <strong>{documentoOficialToDelete.fileName}</strong>? Esta acción no se puede deshacer.
          </AlertBanner>
        </Modal>,
        document.body
      )}

      {documentoSelloToConfirm && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={!!documentoSelloToConfirm}
          onClose={() => !aplicandoSelloDocId && setDocumentoSelloToConfirm(null)}
          title="Añadir sello de empresa"
          size="md"
          className="app-modal--form"
          showCloseButton={false}
          footer={(
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button type="button" onClick={() => setDocumentoSelloToConfirm(null)} disabled={!!aplicandoSelloDocId} className="solicitud-admin-btn flex-1">Cancelar</button>
              <button type="button" onClick={() => handleAplicarSelloEmpresa(documentoSelloToConfirm)} disabled={!!aplicandoSelloDocId} className="solicitud-admin-btn solicitud-admin-btn--primary flex-1 disabled:opacity-50">
                {aplicandoSelloDocId ? 'Aplicando…' : 'Añadir sello'}
              </button>
            </div>
          )}
        >
          <AlertBanner variant="info" title="Reemplaza el PDF actual">
            ¿Añadir el sello de empresa a <strong>{documentoSelloToConfirm.nombre_archivo || documentoSelloToConfirm.fileName}</strong>? Se colocará en la última página y se reemplazará el archivo actual.
          </AlertBanner>
        </Modal>,
        document.body
      )}

      {showContratosModal && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showContratosModal}
          onClose={() => setShowContratosModal(false)}
          title="Status contratos por empleado"
          size="xl"
          className="app-modal--form"
          footer={(
            <div className="flex flex-wrap gap-2 justify-between w-full items-center">
              <p className="text-sm text-gray-600">Total: {empleadosContratos.length} empleados</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleExportContratosExcel} disabled={loadingContratos || empleadosContratos.length === 0} className="solicitud-admin-btn">Excel</button>
                <button type="button" onClick={handleExportContratosPDF} disabled={loadingContratos || empleadosContratos.length === 0} className="solicitud-admin-btn">PDF</button>
                <button type="button" onClick={() => setShowContratosModal(false)} className="solicitud-admin-btn solicitud-admin-btn--primary">Cerrar</button>
              </div>
            </div>
          )}
        >
              {loadingContratos ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" aria-hidden />
                </div>
              ) : empleadosContratos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No se encontraron empleados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {empleadosContratos.map((empleado) => (
                    <div
                      key={empleado.codigo}
                      className="documentos-empleados-diploma-row"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="documentos-empleados-avatar shrink-0">
                              {empleado.nombre?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-bold text-gray-900">{empleado.nombre || 'Sin nombre'}</h3>
                                {/* Badge pentru statusul angajatului */}
                                {empleado.estado && (
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    empleado.estado.toUpperCase() === 'ACTIVO' 
                                      ? 'bg-green-100 text-green-700' 
                                      : empleado.estado.toUpperCase() === 'INACTIVO'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {empleado.estado}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{empleado.email || 'Sin email'}</p>
                              <p className="text-xs text-gray-500">Código: {empleado.codigo}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {/* Status CONTRATO */}
                          <div className="flex items-center space-x-2">
                            {empleado.tiene_contrato ? (
                              <div className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-semibold">CONTRATO</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-xs font-semibold">Sin CONTRATO</span>
                              </div>
                            )}
                          </div>

                          {/* Status CONTRATO firmado */}
                          <div className="flex items-center space-x-2">
                            {empleado.tiene_contrato_firmado ? (
                              <div className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span className="text-xs font-semibold">FIRMADO</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-xs font-semibold">Pendiente</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {empleado.fecha_contrato && (
                        <p className="text-xs text-gray-500 mt-2 ml-13">
                          CONTRATO: {new Date(empleado.fecha_contrato).toLocaleDateString('es-ES')}
                        </p>
                      )}
                      {empleado.fecha_contrato_firmado && (
                        <p className="text-xs text-gray-500 mt-1 ml-13">
                          FIRMADO: {new Date(empleado.fecha_contrato_firmado).toLocaleDateString('es-ES')}
                        </p>
                      )}
                      {/* Buton Preview pentru contracte - apare dacă are CONTRATO sau CONTRATO firmado */}
                      {(empleado.tiene_contrato || empleado.tiene_contrato_firmado) && (
                        <div className="mt-3 ml-13">
                          <button
                            onClick={() => handlePreviewContratoEmpleado(empleado)}
                            disabled={loadingContratosPreview}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1"
                            title="Ver preview de contratos"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>{loadingContratosPreview ? 'Cargando...' : 'Preview'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
        </Modal>,
        document.body
      )}

      {showContratosPreviewModal && empleadoParaPreview && typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showContratosPreviewModal}
          onClose={() => {
            setShowContratosPreviewModal(false);
            setContratosDisponibles([]);
            setEmpleadoParaPreview(null);
          }}
          title={`Seleccionar contrato — ${empleadoParaPreview.nombre || 'Sin nombre'}`}
          size="lg"
          className="app-modal--form"
          footer={(
            <button
              type="button"
              onClick={() => {
                setShowContratosPreviewModal(false);
                setContratosDisponibles([]);
                setEmpleadoParaPreview(null);
              }}
              className="solicitud-admin-btn solicitud-admin-btn--primary w-full sm:w-auto"
            >
              Cerrar
            </button>
          )}
        >
              {loadingContratosPreview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
              ) : contratosDisponibles.length === 0 ? (
                <AlertBanner variant="neutral">No se encontraron contratos</AlertBanner>
              ) : (
                <div className="space-y-3">
                  {contratosDisponibles.map((contrato, index) => {
                    const esFirmado = contrato.tipo === 'CONTRATO firmado' || contrato.tipo_documento === 'CONTRATO firmado';
                    return (
                      <div
                        key={contrato.doc_id || index}
                        className="documentos-empleados-doc-row"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`solicitud-status ${esFirmado ? 'solicitud-status--approved' : 'solicitud-status--neutral'}`}>
                                {esFirmado ? 'CONTRATO FIRMADO' : 'CONTRATO'}
                              </span>
                              {contrato.fecha_creacion && (
                                <span className="text-xs text-gray-500">
                                  {new Date(contrato.fecha_creacion).toLocaleDateString('es-ES')}
                                </span>
                              )}
                            </div>
                            <p className="documentos-empleados-doc-row__title">
                              {contrato.fileName || contrato.nombre_archivo || 'CONTRATO.pdf'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePreviewContratoSeleccionado(contrato)}
                            className="solicitud-admin-btn solicitud-admin-btn--primary text-sm shrink-0"
                          >
                            Ver preview
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
        </Modal>,
        document.body
      )}


      {/* ContractSigner pentru documente oficiale */}
      {showOficialSigner && documentoOficialToSign && documentoOficialPdfUrl && (
        <ContractSigner
          pdfUrl={documentoOficialPdfUrl}
          docId={documentoOficialToSign.id || documentoOficialToSign.empleadoId || selectedEmpleado?.CODIGO || ''}
          originalFileName={documentoOficialToSign.fileName || ''}
          // Props pentru UPDATE (înlocuiește documentul existent, nu creează unul nou)
          empleadoId={documentoOficialToSign.id || documentoOficialToSign.empleadoId || selectedEmpleado?.CODIGO || null}
          empleadoEmail={documentoOficialToSign.correo_electronico || selectedEmpleado?.['CORREO ELECTRONICO'] || null}
          empleadoNombre={documentoOficialToSign.nombre_empleado || selectedEmpleado?.['NOMBRE / APELLIDOS'] || null}
          documentoDocId={documentoOficialToSign.doc_id ? Number(documentoOficialToSign.doc_id) : null}
          updateExisting={!!(documentoOficialToSign.doc_id && Number(documentoOficialToSign.doc_id) > 0)} // Face UPDATE doar dacă există doc_id valid
          tipoDocumento={documentoOficialToSign.tipo || documentoOficialToSign.tipo_documento || null} // Păstrează tipo_documento original
          autoStampMode={isContratoDocumento(documentoOficialToSign)}
          onClose={() => {
            setShowOficialSigner(false);
            setDocumentoOficialToSign(null);
            if (documentoOficialPdfUrl && !documentoOficialPdfUrl.startsWith('data:')) {
              window.URL.revokeObjectURL(documentoOficialPdfUrl);
            }
            setDocumentoOficialPdfUrl(null);
          }}
          onSignComplete={async () => {
            // Esperar un momento para que el documento se guarde completamente en la base de datos
            await new Promise(resolve => setTimeout(resolve, 500));
            // Actualizar lista de documentos oficiales
            if (selectedEmpleado) {
              setTimeout(() => {
                fetchDocumentosOficiales(selectedEmpleado);
              }, 500);
            }
            setShowOficialSigner(false);
            setDocumentoOficialToSign(null);
            if (documentoOficialPdfUrl && !documentoOficialPdfUrl.startsWith('data:')) {
              window.URL.revokeObjectURL(documentoOficialPdfUrl);
            }
            setDocumentoOficialPdfUrl(null);
            showNotification('success', 'Documento Firmado', 'El documento oficial ha sido firmado exitosamente por la empresa');
          }}
        />
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
    </>
  );
}
