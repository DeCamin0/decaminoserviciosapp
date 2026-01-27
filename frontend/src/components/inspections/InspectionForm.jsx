import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { useLocation } from '../../contexts/LocationContextBase';
import { Button, Card, Modal } from '../ui';
import SignaturePadComponent from '../../shared/components/SignaturePad';
import PDFViewerAndroid from '../PDFViewerAndroid';
import { routes } from '../../utils/routes';
import { isDemoMode } from '../../utils/demo';
import activityLogger from '../../utils/activityLogger';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf,
  Image,
  Font
} from '@react-pdf/renderer';
import logoImg from '@/assets/logo.svg';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../i18n';

// Polyfill pentru Buffer în browser
if (typeof window !== 'undefined' && !window.Buffer) {
  // Simple Buffer polyfill pentru browser
  window.Buffer = {
    from: (data) => new Uint8Array(data),
    isBuffer: (obj) => obj instanceof Uint8Array
  };
}

// Înregistrează fonturile pentru PDF
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfB.ttf', fontWeight: 'bold' }
  ]
});

// Stiluri pentru PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica'
  },
  header: {
    marginBottom: 15, // Redus de la 20
    borderBottom: '2 solid #e53e3e',
    paddingBottom: 8 // Redus de la 10
  },
  title: {
    fontSize: 16, // Redus de la 18
    fontWeight: 'bold',
    color: '#e53e3e',
    marginBottom: 6 // Redus de la 8
  },
  date: {
    fontSize: 11, // Redus de la 12
    color: '#4a5568',
    marginBottom: 3 // Redus de la 4
  },
  location: {
    fontSize: 11, // Redus de la 12
    color: '#4a5568',
    marginBottom: 3 // Redus de la 4
  },
  inspector: {
    fontSize: 11, // Redus de la 12
    color: '#4a5568',
    marginBottom: 3 // Redus de la 4
  },
  employee: {
    fontSize: 11, // Redus de la 12
    color: '#4a5568',
    marginBottom: 3 // Redus de la 4
  },
  trabajador: {
    fontSize: 12,
    color: '#4a5568',
    marginBottom: 4
  },
  inspectionNumber: {
    fontSize: 12,
    color: '#4a5568',
    marginBottom: 4
  },
  section: {
    marginBottom: 15 // Redus de la 20
  },
  sectionTitle: {
    fontSize: 13, // Redus de la 14
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8, // Redus de la 10
    borderBottom: '1 solid #e2e8f0',
    paddingBottom: 4 // Redus de la 5
  },
  pointItem: {
    marginBottom: 10,
    padding: 8,
    border: '1 solid #e2e8f0',
    borderRadius: 4
  },
  pointNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e53e3e'
  },
  pointDescription: {
    fontSize: 10,
    color: '#2d3748',
    marginBottom: 4
  },
  pointStatus: {
    fontSize: 9,
    color: '#718096',
    marginBottom: 2
  },
  pointObservations: {
    fontSize: 9,
    color: '#718096',
    fontStyle: 'italic'
  },
  generalObservations: {
    fontSize: 10,
    color: '#2d3748',
    lineHeight: 1.4
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTop: '1 solid #e2e8f0',
    fontSize: 9,
    color: '#718096'
  },
  companyFooter: {
    position: 'absolute',
    left: 30,
    right: 30,
    bottom: 22,
    borderTop: '1 solid #e2e8f0',
    paddingTop: 6,
    fontSize: 9,
    color: '#718096'
  },
  footerText: {
    marginBottom: 4
  },
  finalNote: {
    position: 'absolute',
    left: 30,
    right: 30,
    bottom: 18,
    fontSize: 9,
    color: '#718096',
    textAlign: 'center'
  },
  signaturesSection: {
    marginTop: 20,
    marginBottom: 20,
    borderTop: '1 solid #e2e8f0',
    paddingTop: 10
  },
  signaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  signatureItem: {
    alignItems: 'center',
    width: '48%' // Adjust as needed for two columns
  },
  signatureLabel: {
    fontSize: 10,
    color: '#4a5568',
    marginBottom: 4
  },
  signatureImage: {
    width: '100%',
    height: 50, // Adjust height as needed
    objectFit: 'contain'
  },
  noSignature: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 4
  },
  noSignatureText: {
    fontSize: 10,
    color: '#718096'
  },
  signatureName: {
    fontSize: 10,
    color: '#4a5568',
    marginTop: 4,
    textAlign: 'center'
  },
  watermarkLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%', // Centrat perfect
    width: 500, // Mărit pentru mai bună vizibilitate
    height: 250, // Mărit pentru mai bună vizibilitate
    opacity: 0.06, // Mărit puțin pentru vizibilitate
    zIndex: -1, // Ensure it's behind other content
    marginLeft: '-250px', // Jumătate din width pentru centrare
    marginTop: '-125px', // Jumătate din height pentru centrare
    objectFit: 'contain' // Pentru scalare corectă
  },
  // Stiluri pentru puncte de inspecție
  point: {
    marginBottom: 6, // Redus de la 10
    padding: 4, // Redus de la 8
    border: '1 solid #e2e8f0',
    borderRadius: 4
  },
  pointTitle: {
    fontSize: 9, // Redus de la 10
    fontWeight: 'bold',
    color: '#e53e3e',
    marginBottom: 2 // Redus de la 4
  },
  pointDetails: {
    marginTop: 2 // Redus de la 4
  },
  pointDetail: {
    fontSize: 8, // Redus de la 9
    color: '#718096',
    marginBottom: 1 // Redus de la 2
  },
  // Stiluri pentru semnături
  signaturesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 10
  },
  signature: {
    alignItems: 'center',
    width: '48%'
  },
  signatureImageContainer: {
    width: '100%',
    height: 50,
    objectFit: 'contain'
  },
  noSignatureTextItalic: {
    fontSize: 10,
    color: '#718096',
    fontStyle: 'italic'
  }
});

// Funcție pentru conversia Blob în Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper function pentru a preveni string-uri goale în PDF
const safeText = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const str = String(value).trim();
  return str === '' ? fallback : str;
};

// Date demo pentru centrele și angajații
const getDemoCentros = () => [
  'C.P. Residencia Los Pinos',
  'C.P. Jardines del Norte', 
  'C.P. Vista Hermosa',
  'C.P. Los Laureles',
  'C.P. El Mirador',
  'Hospital Universitario San Carlos',
  'Centro Comercial Plaza Norte'
];

const getDemoEmpleados = () => [
  {
    'NOMBRE / APELLIDOS': 'Carlos Antonio Rodríguez',
    'CODIGO': 'EMP001',
    'CENTRO TRABAJO': 'C.P. Residencia Los Pinos',
    'CORREO ELECTRONICO': 'carlos.rodriguez@demo.com'
  },
  {
    'NOMBRE / APELLIDOS': 'María González López',
    'CODIGO': 'EMP002', 
    'CENTRO TRABAJO': 'C.P. Jardines del Norte',
    'CORREO ELECTRONICO': 'maria.gonzalez@demo.com'
  },
  {
    'NOMBRE / APELLIDOS': 'Ana Fernández Torres',
    'CODIGO': 'EMP003',
    'CENTRO TRABAJO': 'C.P. Vista Hermosa', 
    'CORREO ELECTRONICO': 'ana.fernandez@demo.com'
  },
  {
    'NOMBRE / APELLIDOS': 'José Luis Martín',
    'CODIGO': 'EMP004',
    'CENTRO TRABAJO': 'C.P. Los Laureles',
    'CORREO ELECTRONICO': 'jose.martin@demo.com'
  },
  {
    'NOMBRE / APELLIDOS': 'Laura Sánchez Ruiz',
    'CODIGO': 'EMP005',
    'CENTRO TRABAJO': 'C.P. El Mirador',
    'CORREO ELECTRONICO': 'laura.sanchez@demo.com'
  }
];

const InspectionForm = ({ type }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { getCurrentLocation, getAddressFromCoords } = useLocation();
  const [formData, setFormData] = useState({
    nr: '',
    data: new Date().toISOString().split('T')[0],
    inspector: {
      nume: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
      semnaturaPng: ''
    },
    trabajador: {
      nume: '',
      semnaturaPng: '',
      codigo: '' // Adăugat codigo_empleado
    },
    locatie: '',
    centro: '',
    supervisor: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
    supervisor_codigo: user?.CODIGO || user?.codigo || null, // Adăugat codigo supervizor
    puncte: [],
    type: type,
    observaciones: '',
    status: 'completada',
    codigo_empleado: '' // Adăugat la nivel principal
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorNotification, setErrorNotification] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureType, setSignatureType] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewData, setPdfPreviewData] = useState(null);
  const [showCentroDropdown, setShowCentroDropdown] = useState(false);
  
  // Detectare iOS/Android/Safari pentru fallback de previzualizare PDF
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);
  
  // State pentru modalul de adăugare puncte personalizate
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  const [newPointData, setNewPointData] = useState({
    descriere: '',
    tip: 'obligatoriu', // obligatoriu sau opcional
    observatii: '',
    cantitate: '', // Pentru materiale
    precio: '', // Pentru materiale
    documento: null // Pentru materiale - factură/albarán (File object)
  });
  const [signatureDraft, setSignatureDraft] = useState('');
  
  // State pentru centrele și angajații
  const [centros, setCentros] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [empleadosFiltrados, setEmpleadosFiltrados] = useState([]);
  const [loadingCentros, setLoadingCentros] = useState(false);
  
  // State pentru geolocație
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Zonele de inspecție în funcție de tip
  const ZONES_LIMPIEZA = useMemo(() => [
    'CUARTO DE LIMPIEZA',
    'ESQUINAS/ANGULOS',
    'PASAMANOS',
    'RODAPIES',
    'VENTANAS/CRISTALES',
    'POMOS Y TIRADORES',
    'LAMPARAS E INTERRUPTORES',
    'PORTAL',
    'PUERTA DEL PORTAL',
    'BUZONES',
    'ESCALERAS',
    'PAREDES',
    'SOTANO',
    'EXTINTORES',
    'GARAJE',
    'PATIO INTERIOR',
    'ACENSORES'
  ], []);

  const ZONES_SERVICIOS = useMemo(() => [
    'HORARIO',
    'REGISTRO',
    'VIGILANT',
    'LIMPIEZA/ORDEN',
    'LOGISTICA',
    'OTROS'
  ], []);

  const ZONES_PERSONALIZADA = useMemo(() => [], []);

  const RANGO_OPTIONS = useMemo(() => [
    { value: 1, label: '1 - Muy malo' },
    { value: 2, label: '2 - Malo' },
    { value: 3, label: '3 - Regular' },
    { value: 4, label: '4 - Bueno' },
    { value: 5, label: '5 - Excelente' }
  ], []);

  const generateInspectionNumber = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const typePrefix = type === 'limpieza' ? 'LIMP' :
                      type === 'servicios' ? 'SERV' :
                      type === 'entrega-materiales' ? 'ENTR' : 'PERS';
    const timestamp = `${year}${month}${day}-${hours}${minutes}`;

    return `${typePrefix}-${timestamp}`;
  }, [type]);

  // Funcție pentru obținerea geolocației în timp real folosind contextul global
  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError('');

    try {
      const coords = await getCurrentLocation();
      const { latitude, longitude } = coords;
          
      // Încearcă să obțină adresa din coordonatele GPS folosind funcția din context
      try {
        const address = await getAddressFromCoords(latitude, longitude);
        const fullAddress = address || `${latitude}, ${longitude}`;
            
            setFormData(prev => ({
              ...prev,
          locatie: `${fullAddress} (GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)})`
            }));
        setLocationError(''); // Clear any previous error
        } catch (error) {
          console.error('Error getting address:', error);
          // Fallback la coordonatele GPS
          setFormData(prev => ({
            ...prev,
            locatie: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          }));
        setLocationError(''); // Clear error since we have coordinates
        }
        
        setLocationLoading(false);
      setLocationError(''); // Clear any previous error
    } catch (error) {
        console.error('Error getting location:', error);
        let errorMessage = 'Error al obtener la ubicación';
        
      if (error.code !== undefined) {
        // Check for GeolocationPositionError codes (1, 2, 3)
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Permiso de ubicación denegado. Por favor permite el acceso en la configuración del navegador.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Información de ubicación no disponible';
            break;
          case 3: // TIMEOUT
            errorMessage = 'Tiempo de espera agotado. Por favor intenta de nuevo.';
            break;
          default:
            errorMessage = 'Error desconocido al obtener ubicación';
        }
      } else if (error.message) {
        errorMessage = error.message;
        }
        
        setLocationError(errorMessage);
        setLocationLoading(false);
      
      // Set error message in form location field
      setFormData(prev => ({
        ...prev,
        locatie: errorMessage
      }));
    }
  };

  // Obține locația automat când se deschide formularul (la mount)
  // Deschiderea formularului este considerată un "user gesture" valid
  useEffect(() => {
    // Obține locația automat când componenta se montează
    handleGetCurrentLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Funcție pentru retry cu backoff
  const fetchWithRetry = async (url, options, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        
        // Pentru erori 4xx (client errors), nu retry - returnează direct
        // pentru ca handler-ul principal să gestioneze mesajele specifice
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        // Pentru erori 5xx (server errors), retry cu backoff
        if (response.status >= 500) {
          if (i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 1000; // Exponential backoff
            console.log(`⚠️ Server error ${response.status}, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        return response;
      } catch (error) {
        // Pentru erori de rețea, retry
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.log(`⚠️ Network error, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // Dacă toate retry-urile au eșuat, aruncă eroarea
        throw error;
      }
    }
  };

  // Încarcă centrele de trabajo (CLIENȚI) și empleados
  useEffect(() => {
    const loadCentrosYEmpleados = async () => {
      setLoadingCentros(true);
      
      // Skip real data fetch in DEMO mode
      if (user?.isDemo || isDemoMode()) {
        console.log('🎭 DEMO mode: Using demo centros and empleados data instead of fetching from backend');
        const demoCentros = getDemoCentros();
        const demoEmpleados = getDemoEmpleados();
        setCentros(demoCentros);
        setEmpleados(demoEmpleados);
        setLoadingCentros(false);
        return;
      }
      
      try {
        // Încarcă empleados cu header-uri speciale
        const responseEmpleados = await fetch(routes.getEmpleados, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        const empleadosData = await responseEmpleados.json();
        const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
        setEmpleados(empleadosArray);
        
        // Încarcă CLIENȚI pentru centre de trabajo cu header-uri speciale
        const responseClientes = await fetch(routes.getClientes, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });
        const clientesData = await responseClientes.json();
        const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
        
        // Extrage numele clienților ca centre de trabajo și elimină duplicatele
        const centrosFromClientes = clientesArray
          .map(cliente => cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre)
          .filter(nombre => nombre && nombre.trim() !== '' && nombre.length > 3)
          .filter((nombre, index, array) => array.indexOf(nombre) === index) // Elimină duplicatele
          .sort(); // Sortează alfabetic
        
        setCentros(centrosFromClientes);
        
        console.log('✅ Centros de Trabajo (Clientes) cargados:', centrosFromClientes.length);
        console.log('✅ Empleados cargados:', empleadosArray.length);
        
        // Setează centru-ul automat dacă utilizatorul are un centru
        const userCentro = user?.['CENTRO TRABAJO'] || 
                           user?.CENTRO_TRABAJO || 
                           user?.CENTRO || 
                           user?.centro ||
                           user?.['CENTRO_DE_TRABAJO'] || 
                           user?.['CENTRO LABORAL'];
        
        if (userCentro && centrosFromClientes.includes(userCentro)) {
          setFormData(prev => ({ ...prev, centro: userCentro }));
        }
      } catch (error) {
        console.error('Error loading centros/empleados:', error);
      } finally {
        setLoadingCentros(false);
      }
    };

    loadCentrosYEmpleados();
  }, [user]);

  // Filtrează angajații când se schimbă centru-ul
  useEffect(() => {
    if (formData.centro && empleados.length > 0) {
      const empleadosDelCentro = empleados.filter(emp => {
        const empCentro = emp['CENTRO TRABAJO'] || 
                          emp.CENTRO_TRABAJO || 
                          emp.CENTRO || 
                          emp.centro ||
                          emp['CENTRO_DE_TRABAJO'] || 
                          emp['CENTRO LABORAL'];
        return empCentro === formData.centro;
      });
      setEmpleadosFiltrados(empleadosDelCentro);
    } else {
      setEmpleadosFiltrados([]);
    }
  }, [formData.centro, empleados]);

  // Inițializează punctele de inspecție și numărul automat
  useEffect(() => {
    let zones = [];
    if (type === 'limpieza') {
      zones = ZONES_LIMPIEZA;
    } else if (type === 'servicios') {
      zones = ZONES_SERVICIOS;
    } else if (type === 'personalizada' || type === 'entrega-materiales') {
      zones = ZONES_PERSONALIZADA; // Va fi gol inițial, se vor adăuga manual
    }

    const initialPoints = zones.map((zone) => ({
      id: `point_${Math.random().toString(36).substr(2, 9)}`,
      descriere: zone,
      status: 'OK',
      observatii: '',
      rango: 3,
      calidad: 3
    }));

    setFormData(prev => ({
      ...prev,
      puncte: initialPoints,
      nr: generateInspectionNumber() // Generează numărul automat
    }));
  }, [ZONES_LIMPIEZA, ZONES_PERSONALIZADA, ZONES_SERVICIOS, generateInspectionNumber, type]);

  const validateForm = () => {
    const newErrors = {};

    // Validări de bază
    if (!formData.data) newErrors.data = 'Data este obligatorie';
    if (!formData.inspector.nume.trim()) newErrors.inspectorName = 'Numele inspectorului este obligatoriu';
    if (!formData.locatie.trim()) newErrors.locatie = 'Locația este obligatorie';
    if (!formData.centro.trim()) newErrors.centro = 'Centro de trabajo es obligatorio';
    if (!formData.trabajador.nume.trim()) newErrors.trabajador = 'Trabajador es obligatorio';

    // Validări pentru semnături (opționale - doar warning)
    if (!formData.inspector.semnaturaPng) {
      // Semnătura inspectorului lipsește - va fi opțională
    }
    if (!formData.trabajador.semnaturaPng) {
      // Semnătura angajatului lipsește - va fi opțională
    }

    // Validări pentru puncte de inspecție
    if (formData.puncte.length === 0) {
      newErrors.puncte = 'Trebuie să adaugi cel puțin un punct de inspecție';
    }

    // Validări pentru geolocație (opțională pentru testare)
    const gpsMatch = formData.locatie.match(/GPS: ([\d.-]+), ([\d.-]+)/);
    if (!gpsMatch) {
      // Geolocația GPS lipsește - va fi opțională pentru testare
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Reset trabajador când se schimbă centru-ul
    if (field === 'centro') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        trabajador: { nume: '', semnaturaPng: '', codigo: '' }
      }));
    }
  };

  const handleInspectorChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      inspector: {
        ...prev.inspector,
        [field]: value
      }
    }));
  };

  const handleTrabajadorChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      trabajador: {
        ...prev.trabajador,
        [field]: value
      },
      // Actualizează și codigo_empleado la nivel principal
      codigo_empleado: field === 'codigo' ? value : prev.codigo_empleado
    }));
  };

  const handlePointChange = (pointId, field, value) => {
    setFormData(prev => ({
      ...prev,
      puncte: prev.puncte.map(point => 
        point.id === pointId ? { ...point, [field]: value } : point
      )
    }));
  };

  // Funcție pentru adăugarea unui punct personalizat sau material
  const handleAddCustomPoint = () => {
    if (!newPointData.descriere.trim()) {
      const message = type === 'entrega-materiales' 
        ? 'Por favor, introduce una descripción para el material.'
        : 'Por favor, introduce una descripción para el punto de inspección.';
      alert(message);
      return;
    }

    const newPoint = {
      id: `point_${Math.random().toString(36).substr(2, 9)}`,
      descriere: newPointData.descriere.trim(),
      status: 'OK',
      observatii: newPointData.observatii.trim(),
      rango: 3,
      calidad: 3,
      tip: newPointData.tip,
      isCustom: true, // Marchează că este un punct personalizat
      // Câmpuri specifice pentru materiale
      ...(type === 'entrega-materiales' && {
        cantitate: newPointData.cantitate.trim() || '',
        precio: newPointData.precio.trim() || '',
        documento: newPointData.documento || null // Fișier factură/albarán
      })
    };

    setFormData(prev => ({
      ...prev,
      puncte: [...prev.puncte, newPoint]
    }));

    // Reset formularul pentru noul punct/material
    setNewPointData({
      descriere: '',
      tip: 'obligatoriu',
      observatii: '',
      cantitate: '',
      precio: '',
      documento: null
    });

    setShowAddPointModal(false);
  };

  // Funcție pentru eliminarea unui punct
  const handleRemovePoint = (pointId) => {
    setFormData(prev => ({
      ...prev,
      puncte: prev.puncte.filter(point => point.id !== pointId)
    }));
  };

  const handleSignatureSave = () => {
    if (signatureType === 'inspector') {
      handleInspectorChange('semnaturaPng', signatureDraft);
    } else if (signatureType === 'trabajador') {
      handleTrabajadorChange('semnaturaPng', signatureDraft);
    }
    setShowSignatureModal(false);
  };

  const openSignatureModal = (type) => {
    setSignatureType(type);
    const existingSignature = type === 'inspector'
      ? formData.inspector.semnaturaPng
      : formData.trabajador.semnaturaPng;
    setSignatureDraft(existingSignature || '');
    setShowSignatureModal(true);
  };

  const handleSignatureChange = (signatureData) => {
    setSignatureDraft(signatureData);
  };

  const handleSubmit = async () => {
    // Forțează limba spaniolă pentru generarea PDF-ului
    let originalLanguage = 'ro';
    try {
      // Obține limba curentă din i18nInstance dacă este disponibil
      if (i18nInstance && i18nInstance.language) {
        originalLanguage = i18nInstance.language;
      }
    } catch (error) {
      console.warn('Eroare la obținerea limbii curente:', error);
    }

    try {
      // Schimbă limba la spaniolă pentru PDF - folosim doar i18nInstance
      if (i18nInstance && i18nInstance.changeLanguage && typeof i18nInstance.changeLanguage === 'function') {
        try {
          await i18nInstance.changeLanguage('es');
        } catch (error) {
          console.warn('Eroare la schimbarea limbii la es:', error);
          // Continuăm fără schimbarea limbii dacă apare o eroare
        }
      } else {
        console.warn('i18nInstance.changeLanguage nu este disponibil, continuăm fără schimbarea limbii');
      }
      
      if (!validateForm()) {
        // Restaurează limba dacă validarea eșuează
        if (i18nInstance && i18nInstance.changeLanguage && typeof i18nInstance.changeLanguage === 'function' && originalLanguage) {
          try {
            await i18nInstance.changeLanguage(originalLanguage);
          } catch (error) {
            console.warn('Eroare la restaurarea limbii:', error);
          }
        }
        return;
      }

      setLoading(true);

      // Adaugă timeout pentru generarea PDF-ului
      const pdfGenerationPromise = (async () => {
        // Generează UUID pentru inspeccionId
        // const inspeccionId = generateUUID();

        // Pregătește datele pentru trimitere
        // const payload = {
        //   inspeccionId: inspeccionId,
        //   timestamp: new Date().toISOString(),
        //   empleado: {
        //     nume: formData.trabajador.nume,
        //     semnaturaPng: formData.trabajador.semnaturaPng || undefined,
        //     codigo: formData.trabajador.codigo || undefined
        //   },
        //   vehicul: formData.vehicul || undefined,
        //   locatie: formData.locatie,
        //   observatii: formData.observatii || undefined,
        //   items: formData.puncte,
        //   meta: {
        //     semnaturaInspector: formData.inspector.semnaturaPng || undefined,
        //     numeroInspeccion: inspeccionId
        //   },
        //   codigo_empleado: formData.trabajador.codigo || formData.codigo_empleado || undefined
        // };

        // Generează PDF-ul
        
        const pdfContent = (
          <Document>
            {/* Prima pagină */}
            <Page size="A4" style={styles.page}>
              {/* Watermark logo */}
              <Image src={logoImg} style={styles.watermarkLogo} fixed />
              
                             {/* Header */}
               <View style={styles.header}>
                 <Text style={styles.title}>Inspección de {type === 'limpieza' ? 'Limpieza' : type === 'servicios' ? 'Servicios Auxiliares' : type === 'entrega-materiales' ? 'Entrega de Materiales' : 'Personalizada'}</Text>
                 <Text style={styles.inspectionNumber}>Número: {safeText(formData.nr)}</Text>
                 <Text style={styles.date}>Fecha: {safeText(formData.data)}</Text>
                 <Text style={styles.location}>Ubicación: {safeText(formData.locatie)}</Text>
                 <Text style={styles.trabajador}>Centro de Trabajo: {safeText(formData.centro)}</Text>
                 <Text style={styles.inspector}>Inspector: {safeText(formData.inspector?.nume)}</Text>
                 <Text style={styles.employee}>
                   Empleado: {safeText(formData.trabajador?.nume)}
                   {formData.trabajador?.codigo && formData.trabajador.codigo.trim() !== '' ? ` (${safeText(formData.trabajador.codigo)})` : null}
                 </Text>
                 <Text style={styles.inspector}>Supervisor: {safeText(formData.supervisor)}</Text>
                 {/* Scor total calculat din toate punctele */}
                 {formData.puncte && formData.puncte.length > 0 && (() => {
                   const totalScoruri = formData.puncte.reduce((sum, punct) => {
                     return sum + (punct.rango || 0) + (punct.calidad || 0);
                   }, 0);
                   const scorTotal = totalScoruri / (formData.puncte.length * 2);
                   return (
                     <Text style={{...styles.inspector, fontWeight: 'bold', color: '#e53e3e'}}>
                       ⭐ Puntuación Total: {scorTotal.toFixed(2)}/5
                     </Text>
                   );
                 })()}
               </View>

              {/* Puncte de inspecție */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {safeText(t('pdf.inspectionPoints'), 'Puntos de Inspección')} - {type === 'limpieza' ? safeText(t('pdf.limpieza'), 'Limpieza') : type === 'servicios' ? safeText(t('pdf.serviciosAuxiliares'), 'Servicios Auxiliares') : safeText(t('pdf.personalizada'), 'Personalizada')}
                </Text>
                {type === 'limpieza' ? (
                  // Limpieza: doar primele 9 puncte pe prima pagină ca să păstrăm doar aici footerul
                  formData.puncte.slice(0, 9).map((punct) => {
                    return (
                      <View key={punct.id} style={styles.point}>
                        <Text style={styles.pointTitle}>{safeText(punct.descriere)}</Text>
                        <View style={styles.pointDetails}>
                          <Text style={styles.pointDetail}>Status: {safeText(punct.status)}</Text>
                          <Text style={styles.pointDetail}>Rango: {punct.rango || 0}/5</Text>
                          <Text style={styles.pointDetail}>Calidad: {punct.calidad || 0}/5</Text>
                          {punct.observatii && punct.observatii.trim() !== '' && (
                            <Text style={styles.pointDetail}>Observaciones: {punct.observatii}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : type === 'servicios' ? (
                  // Servicios: limitar puntos para garantizar una sola página
                  formData.puncte.slice(0, 12).map((punct) => {
                    return (
                      <View key={punct.id} style={styles.point}>
                        <Text style={styles.pointTitle}>{safeText(punct.descriere)}</Text>
                        <View style={styles.pointDetails}>
                          <Text style={styles.pointDetail}>Status: {safeText(punct.status)}</Text>
                          <Text style={styles.pointDetail}>Rango: {punct.rango || 0}/5</Text>
                          <Text style={styles.pointDetail}>Calidad: {punct.calidad || 0}/5</Text>
                          {punct.observatii && punct.observatii.trim() !== '' && (
                            <Text style={styles.pointDetail}>Observaciones: {punct.observatii}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : type === 'entrega-materiales' ? (
                  // Entrega de Materiales: afișează materialele cu cantitate, preț și document
                  formData.puncte.map((punct) => {
                    return (
                      <View key={punct.id} style={styles.point}>
                        <Text style={styles.pointTitle}>{safeText(punct.descriere)}</Text>
                        <View style={styles.pointDetails}>
                          {punct.cantitate && punct.cantitate.trim() !== '' && (
                            <Text style={styles.pointDetail}>Cantidad: {safeText(punct.cantitate)}</Text>
                          )}
                          {punct.precio && punct.precio.trim() !== '' && (
                            <Text style={styles.pointDetail}>Precio: {parseFloat(punct.precio).toFixed(2)} €</Text>
                          )}
                          {punct.documento && (
                            <Text style={styles.pointDetail}>Documento: {punct.documento.name || 'Adjunto'}</Text>
                          )}
                          {punct.observatii && punct.observatii.trim() !== '' && (
                            <Text style={styles.pointDetail}>Observaciones: {punct.observatii}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  // Personalizada: afișează punctele; dacă sunt ≤9, adăugăm și Observaciones/ Firmas pe prima pagină
                  formData.puncte.map((punct) => {
                    return (
                      <View key={punct.id} style={styles.point}>
                        <Text style={styles.pointTitle}>{safeText(punct.descriere)}</Text>
                        <View style={styles.pointDetails}>
                          <Text style={styles.pointDetail}>Status: {safeText(punct.status)}</Text>
                          <Text style={styles.pointDetail}>Rango: {punct.rango || 0}/5</Text>
                          <Text style={styles.pointDetail}>Calidad: {punct.calidad || 0}/5</Text>
                          {punct.tip && punct.tip.trim() !== '' && (
                            <Text style={styles.pointDetail}>Tipo: {punct.tip}</Text>
                          )}
                          {punct.observatii && punct.observatii.trim() !== '' && (
                            <Text style={styles.pointDetail}>Observaciones: {punct.observatii}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Personalizada: dacă sunt ≤9 puncte, includem Observaciones + Firmas pe prima pagină */}
              {type === 'personalizada' && formData.puncte.length <= 9 && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Observaciones Generales</Text>
                    <Text style={styles.generalObservations}>{safeText(formData.observaciones, 'No se agregaron observaciones generales.')}</Text>
                  </View>
                  <View style={styles.signaturesSection}>
                    <Text style={styles.signaturesTitle}>Firmas</Text>
                    <View style={styles.signaturesContainer}>
                      <View style={styles.signature}>
                        <Text style={styles.signatureLabel}>Inspector:</Text>
                        {formData.inspector.semnaturaPng ? (
                          <Image src={formData.inspector.semnaturaPng} style={styles.signatureImage} />
                        ) : (
                          <Text style={styles.noSignature}>No Agregada</Text>
                        )}
                      </View>
                      <View style={styles.signature}>
                        <Text style={styles.signatureLabel}>Trabajador:</Text>
                        {formData.trabajador.semnaturaPng ? (
                          <Image src={formData.trabajador.semnaturaPng} style={styles.signatureImage} />
                        ) : (
                          <Text style={styles.noSignature}>No Agregada</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {/* Nota final pentru personalizata pe prima pagină */}
                  <View style={styles.finalNote} fixed>
                    <Text>Este PDF ha sido generado automáticamente por el sistema DeCamino.</Text>
                  </View>
                </>
              )}

              {/* Observaciones y Firmas en la misma página para Servicios Auxiliares */}
              {type === 'servicios' && (
                <>
                  {/* Observaciones generales */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Observaciones Generales</Text>
                    <Text style={styles.generalObservations}>{safeText(formData.observaciones, 'No se agregaron observaciones generales.')}</Text>
                  </View>

                  {/* Firmas */}
                  <View style={styles.signaturesSection}>
                    <Text style={styles.signaturesTitle}>Firmas</Text>
                    <View style={styles.signaturesContainer}>
                      <View style={styles.signature}>
                        <Text style={styles.signatureLabel}>Inspector:</Text>
                        {formData.inspector.semnaturaPng ? (
                          <Image src={formData.inspector.semnaturaPng} style={styles.signatureImage} />
                        ) : (
                          <Text style={styles.noSignature}>No Agregada</Text>
                        )}
                      </View>
                      <View style={styles.signature}>
                        <Text style={styles.signatureLabel}>Trabajador:</Text>
                        {formData.trabajador.semnaturaPng ? (
                          <Image src={formData.trabajador.semnaturaPng} style={styles.signatureImage} />
                        ) : (
                          <Text style={styles.noSignature}>No Agregada</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Nota final */}
                  <View style={styles.finalNote} fixed>
                    <Text>Este PDF ha sido generado automáticamente por el sistema DeCamino.</Text>
                  </View>
                </>
              )}

              {/* Footer companie eliminat - rămâne doar antetul inspecției pe prima pagină */}
            </Page>

            {/* A doua pagină eliminată pentru limpieza pentru a evita pagină goală */}

            {/* Pagină finală - Observaciones y Firmas para limpieza */}
            {type === 'limpieza' && (
              <Page size="A4" style={styles.page}>
                {/* Watermark logo */}
                <Image src={logoImg} style={styles.watermarkLogo} fixed />
                
                {/* Fără antet pe paginile următoare */}
                {/* Continuación de puntos en la segunda página si existen */}
                {formData.puncte.slice(9).length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Puntos de Inspección - Limpieza (continuación)</Text>
                    {formData.puncte.slice(9).map((punct) => (
                      <View key={punct.id} style={styles.point}>
                        <Text style={styles.pointTitle}>{safeText(punct.descriere)}</Text>
                        <View style={styles.pointDetails}>
                          <Text style={styles.pointDetail}>Status: {safeText(punct.status)}</Text>
                          <Text style={styles.pointDetail}>Rango: {punct.rango || 0}/5</Text>
                          <Text style={styles.pointDetail}>Calidad: {punct.calidad || 0}/5</Text>
                          {punct.observatii && punct.observatii.trim() !== '' && (
                            <Text style={styles.pointDetail}>Observaciones: {punct.observatii}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Observaciones generales */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Observaciones Generales</Text>
                  <Text style={styles.generalObservations}>{formData.observaciones || 'No se agregaron observaciones generales.'}</Text>
                </View>

                {/* Firmas */}
                <View style={styles.signaturesSection}>
                  <Text style={styles.signaturesTitle}>Firmas</Text>
                  <View style={styles.signaturesContainer}>
                    <View style={styles.signature}>
                      <Text style={styles.signatureLabel}>Inspector:</Text>
                      {formData.inspector.semnaturaPng ? (
                        <Image src={formData.inspector.semnaturaPng} style={styles.signatureImage} />
                      ) : (
                        <Text style={styles.noSignature}>No Agregada</Text>
                      )}
                    </View>
                    <View style={styles.signature}>
                      <Text style={styles.signatureLabel}>Trabajador:</Text>
                      {formData.trabajador.semnaturaPng ? (
                        <Image src={formData.trabajador.semnaturaPng} style={styles.signatureImage} />
                      ) : (
                        <Text style={styles.noSignature}>No Agregada</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Nota final */}
                <View style={styles.finalNote} fixed>
                  <Text>Este PDF ha sido generado automáticamente por el sistema DeCamino.</Text>
                </View>
              </Page>
            )}

            {/* Servicios Auxiliares: sin segunda página (todo en la primera) */}

            {/* A doua pagină - doar pentru personalizada când sunt > 9 puncte */}
            {type === 'personalizada' && formData.puncte.length > 9 && (
              <Page size="A4" style={styles.page}>
                {/* Watermark logo */}
                <Image src={logoImg} style={styles.watermarkLogo} />
                
                {/* Fără antet pe paginile următoare */}

                {/* Observaciones generales */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Observaciones Generales</Text>
                  <Text style={styles.generalObservations}>{formData.observaciones || 'No se agregaron observaciones generales.'}</Text>
                </View>

                {/* Firmas */}
                <View style={styles.signaturesSection}>
                  <Text style={styles.signaturesTitle}>Firmas</Text>
                  <View style={styles.signaturesContainer}>
                    <View style={styles.signature}>
                      <Text style={styles.signatureLabel}>Inspector:</Text>
                      {formData.inspector.semnaturaPng ? (
                        <Image src={formData.inspector.semnaturaPng} style={styles.signatureImage} />
                      ) : (
                        <Text style={styles.noSignature}>No Agregada</Text>
                      )}
                    </View>
                    <View style={styles.signature}>
                      <Text style={styles.signatureLabel}>Trabajador:</Text>
                      {formData.trabajador.semnaturaPng ? (
                        <Image src={formData.trabajador.semnaturaPng} style={styles.signatureImage} />
                      ) : (
                        <Text style={styles.noSignature}>No Agregada</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Nota final */}
                <View style={styles.finalNote} fixed>
                  <Text>Este PDF ha sido generado automáticamente por el sistema DeCamino.</Text>
                </View>
              </Page>
            )}
          </Document>
        );

        // Convertește PDF-ul în blob
        const blob = await pdf(pdfContent).toBlob();
        
        // Convertește blob-ul în Base64
        const base64 = await blobToBase64(blob);
        
        // Calculează scorul total: media tuturor scorurilor (rango + calidad) pentru toate punctele
        let scorTotal = 0;
        if (formData.puncte && formData.puncte.length > 0) {
          const totalScoruri = formData.puncte.reduce((sum, punct) => {
            const rango = punct.rango || 0;
            const calidad = punct.calidad || 0;
            return sum + rango + calidad;
          }, 0);
          // Media: suma tuturor (rango + calidad) / (număr_puncte * 2)
          scorTotal = totalScoruri / (formData.puncte.length * 2);
        }
        
        // Convertește documentele (facturi/albaranes) în base64 pentru materiale
        const puncteConDocumentos = await Promise.all(
          formData.puncte.map(async (punct) => {
            if (type === 'entrega-materiales' && punct.documento && punct.documento instanceof File) {
              try {
                const documentoBase64 = await blobToBase64(punct.documento);
                return {
                  ...punct,
                  documentoBase64: documentoBase64,
                  documentoNombre: punct.documento.name,
                  documentoType: punct.documento.type
                };
              } catch (error) {
                console.error('Error converting document to base64:', error);
                return punct; // Returnează punctul fără document dacă conversia eșuează
              }
            }
            return punct;
          })
        );
        
        // Salvează datele pentru previzualizare
        setPdfPreviewData({
          ...formData,
          puncte: puncteConDocumentos,
          pdfBase64: base64,
          scor_total: Math.round(scorTotal * 100) / 100 // Rotunjire la 2 zecimale
        });
        
        // Pentru mobile (iOS/Android), folosim base64 direct în loc de blob URL
        // Pentru desktop, folosim blob URL (mai eficient)
        const pdfUrl = (isIOS || isAndroid) 
          ? `data:application/pdf;base64,${base64}`
          : URL.createObjectURL(blob);
        setPdfPreviewUrl(pdfUrl);
        
        setShowPdfPreview(true);
      })();

      // Timeout de 10 de secunde pentru generarea PDF-ului
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF generation timeout after 10 seconds'));
        }, 10000);
      });

      await Promise.race([pdfGenerationPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      console.error('❌ Error stack:', error.stack);
      alert('Error al generar el PDF: ' + error.message);
    } finally {
      // Restaurează limba originală - folosim doar i18nInstance
      if (originalLanguage && i18nInstance && typeof i18nInstance.changeLanguage === 'function') {
        try {
          await i18nInstance.changeLanguage(originalLanguage);
        } catch (error) {
          console.warn('Eroare la restaurarea limbii:', error);
        }
      }
      setLoading(false);
    }
  };

  // Funcție helper pentru a extrage mesajul de eroare din răspuns
  const extractErrorMessage = async (response) => {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        // Backend-ul returnează erori în formatul: { message: "...", statusCode: 400 }
        return errorData.message || errorData.error || JSON.stringify(errorData);
      } else {
        const errorText = await response.text();
        return errorText || response.statusText;
      }
    } catch (parseError) {
      console.warn('⚠️ Error parsing error response:', parseError);
      return response.statusText || 'Error desconocido';
    }
  };

  // Funcție helper pentru a determina mesajul utilizatorului bazat pe eroare
  const getUserFriendlyMessage = (statusCode, backendMessage, error) => {
    // Verifică status code-ul
    if (statusCode === 401) {
      return {
        title: 'Sesión expirada',
        message: 'Tu sesión ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión.',
        type: 'auth'
      };
    }

    if (statusCode === 413 || (backendMessage && backendMessage.toLowerCase().includes('too large'))) {
      return {
        title: 'Archivo demasiado grande',
        message: 'El PDF de la inspección es demasiado grande. El tamaño máximo es de 5MB. Por favor, intenta reducir el tamaño del PDF o comprimirlo.',
        type: 'size'
      };
    }

    // Verifică mesajele specifice din backend
    if (backendMessage) {
      const lowerMessage = backendMessage.toLowerCase();
      
      if (lowerMessage.includes('ya existe') || lowerMessage.includes('already exists') || lowerMessage.includes('duplicate')) {
        return {
          title: 'Inspección duplicada',
          message: 'Esta inspección ya fue enviada anteriormente. No es necesario enviarla de nuevo.',
          type: 'duplicate'
        };
      }

      if (lowerMessage.includes('se requiere') || lowerMessage.includes('required') || lowerMessage.includes('missing')) {
        if (lowerMessage.includes('pdf') || lowerMessage.includes('pdfbase64')) {
          return {
            title: 'PDF faltante',
            message: 'No se pudo generar el PDF de la inspección. Por favor, intenta generar el PDF nuevamente.',
            type: 'validation'
          };
        }
        if (lowerMessage.includes('nr') || lowerMessage.includes('inspeccionid') || lowerMessage.includes('id')) {
          return {
            title: 'ID faltante',
            message: 'Falta el identificador de la inspección. Por favor, intenta generar el PDF nuevamente.',
            type: 'validation'
          };
        }
        return {
          title: 'Datos incompletos',
          message: `Faltan datos requeridos: ${backendMessage}`,
          type: 'validation'
        };
      }

      if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
        return {
          title: 'Tiempo de espera agotado',
          message: 'La operación tardó demasiado tiempo. Por favor, verifica tu conexión e intenta de nuevo.',
          type: 'timeout'
        };
      }

      if (lowerMessage.includes('connection') || lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
        return {
          title: 'Error de conexión',
          message: 'No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet e intenta de nuevo.',
          type: 'network'
        };
      }
    }

    // Mesaj generic cu detalii pentru debugging
    return {
      title: 'Error al enviar la inspección',
      message: backendMessage 
        ? `Error: ${backendMessage}\n\nPor favor, intenta de nuevo. Si el problema persiste, contacta al administrador.`
        : 'Ocurrió un error inesperado al enviar la inspección. Por favor, intenta de nuevo.',
      type: 'generic',
      details: error?.message || 'Error desconocido'
    };
  };

  // Funcție separată pentru trimiterea efectivă
  const handleSendInspection = async () => {
    if (!pdfPreviewData) return;

    setLoading(true);
    let response = null;
    let statusCode = null;
    let backendMessage = null;

    try {
      // Curăță payload-ul - elimină câmpurile undefined
      const cleanPayload = JSON.parse(JSON.stringify(pdfPreviewData, (key, value) => 
        value === undefined ? undefined : value
      ));

      // Calculează dimensiunea aproximativă a PDF-ului pentru logging
      const pdfSize = cleanPayload.pdfBase64 || cleanPayload.pdf;
      const pdfSizeMB = pdfSize ? (pdfSize.length * 3 / 4 / 1024 / 1024).toFixed(2) : 'N/A';

      // Add JWT token for backend API calls
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Log detaliat pentru debugging
      console.log('📤 Enviando inspección:', {
        inspeccionId: cleanPayload.nr || cleanPayload.inspeccionId || 'N/A',
        tipo: cleanPayload.type || 'N/A',
        pdfSize: `${pdfSizeMB} MB`,
        hasPdf: !!(cleanPayload.pdfBase64 || cleanPayload.pdf),
        hasToken: !!token
      });

      // Trimite totul ca JSON simplu cu header-uri speciale
      response = await fetchWithRetry(routes.addInspeccion, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(cleanPayload)
      });

      statusCode = response.status;

      if (response.ok) {
        console.log('✅ Inspección enviada exitosamente');
        
        setSuccess(true);
        
        // Log inspeccion created
        if (user) {
          activityLogger.logInspeccionCreated(
            {
              tipo: formData.tipo || type,
              fecha: formData.data,
              inspector: formData.inspector?.nume || user['NOMBRE / APELLIDOS'] || '',
              ubicacion: formData.ubicacion || '',
            },
            user
          );
        }
        
        resetForm();
        setShowPdfPreview(false);
        setPdfPreviewData(null);
      } else {
        // Extrage mesajul de eroare din backend
        backendMessage = await extractErrorMessage(response);
        
        // Log detaliat pentru debugging
        console.error('❌ Server error:', {
          status: statusCode,
          statusText: response.statusText,
          message: backendMessage,
          inspeccionId: cleanPayload.nr || cleanPayload.inspeccionId || 'N/A',
          pdfSize: `${pdfSizeMB} MB`
        });

        throw new Error(`HTTP ${statusCode}: ${backendMessage}`);
      }
    } catch (error) {
      // Log detaliat pentru debugging
      console.error('❌ Error submitting inspection:', {
        error: error.message,
        statusCode: statusCode || 'N/A',
        backendMessage: backendMessage || 'N/A',
        stack: error.stack
      });

      // Determină mesajul utilizatorului
      const userMessage = getUserFriendlyMessage(statusCode, backendMessage, error);

      // Afișează mesajul specific
      if (userMessage.type === 'auth') {
        // Pentru erori de autentificare, sugestie de reconectare
        if (confirm(`${userMessage.title}\n\n${userMessage.message}\n\n¿Deseas cerrar sesión ahora?`)) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
      } else {
        // Afișează toast notification în loc de alert
        setErrorNotification({
          title: userMessage.title,
          message: userMessage.message,
          type: userMessage.type,
          details: userMessage.details
        });
        
        // Auto-închide după 8 secunde
        setTimeout(() => {
          setErrorNotification(null);
        }, 8000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Funcție pentru resetarea formularului
  const resetForm = () => {
    setFormData({
      nr: generateInspectionNumber(), // Generează numărul nou
      data: new Date().toISOString().split('T')[0],
      inspector: {
        nume: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
        semnaturaPng: ''
      },
      trabajador: {
        nume: '',
        semnaturaPng: '',
        codigo: '' // Resetare cod
      },
      locatie: '',
      centro: '',
      supervisor: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
      supervisor_codigo: user?.CODIGO || user?.codigo || null, // Păstrează codigo supervizor
      puncte: [],
      type: type,
      observaciones: '',
      status: 'completada',
      codigo_empleado: '' // Resetare cod
    });
    
    // Reload puncte
    let zones = [];
    if (type === 'limpieza') {
      zones = ZONES_LIMPIEZA;
    } else if (type === 'servicios') {
      zones = ZONES_SERVICIOS;
    } else if (type === 'personalizada' || type === 'entrega-materiales') {
      zones = ZONES_PERSONALIZADA; // Va fi gol pentru personalizada/entrega-materiales
    }
    
    const initialPoints = zones.map((zone) => ({
      id: `point_${Math.random().toString(36).substr(2, 9)}`,
      descriere: zone,
      status: 'OK',
      observatii: '',
      rango: 3,
      calidad: 3
    }));
    setFormData(prev => ({ ...prev, puncte: initialPoints }));
  };

  if (success) {
    return (
      <Card className="p-8 text-center">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          ¡Inspección Enviada!
        </h2>
        <p className="text-gray-600 mb-6">
          La inspección ha sido enviada al backend con FormData și fișierele atașate.
        </p>
        <Button
          onClick={() => setSuccess(false)}
          className="bg-red-600 hover:bg-red-700"
        >
          Noua Inspección
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      {/* Error Toast Notification */}
      {errorNotification && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div
            className="p-4 rounded-xl shadow-2xl backdrop-blur-xl bg-gradient-to-r from-red-500 to-rose-500 text-white"
            style={{
              minWidth: '350px',
              maxWidth: '500px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {errorNotification.type === 'duplicate' ? '⚠️' : 
                 errorNotification.type === 'auth' ? '🔒' :
                 errorNotification.type === 'size' ? '📦' :
                 errorNotification.type === 'timeout' ? '⏱️' :
                 errorNotification.type === 'network' ? '🌐' : '❌'}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg mb-1">
                  {errorNotification.title}
                </div>
                <div className="text-sm opacity-90 whitespace-pre-line">
                  {errorNotification.message}
                </div>
                {errorNotification.details && (
                  <div className="text-xs opacity-75 mt-2 pt-2 border-t border-white/20">
                    Detalles técnicos: {errorNotification.details}
                  </div>
                )}
              </div>
              <button
                onClick={() => setErrorNotification(null)}
                className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header ULTRA MODERN con Glassmorphism */}
      <div className="relative group">
        {/* Glow effect */}
        <div className={`absolute -inset-1 rounded-3xl opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500 ${
          type === 'limpieza' 
            ? 'bg-gradient-to-r from-red-500 via-pink-500 to-red-600'
            : type === 'servicios'
            ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600'
            : 'bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600'
        }`}></div>
        
        <Card className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-4 sm:p-6"
              style={{ backdropFilter: 'blur(20px)' }}>
          {/* Header con icon 3D */}
          <div className="flex items-center gap-3 sm:gap-4 mb-6">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ${
              type === 'limpieza'
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : type === 'servicios'
                ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                : 'bg-gradient-to-br from-purple-500 to-purple-700'
            }`}
                 style={{
                   boxShadow: type === 'limpieza'
                     ? '0 10px 25px rgba(239, 68, 68, 0.4)'
                     : type === 'servicios'
                     ? '0 10px 25px rgba(59, 130, 246, 0.4)'
                     : '0 10px 25px rgba(139, 92, 246, 0.4)'
                 }}>
              <span className="text-2xl sm:text-3xl">{type === 'limpieza' ? '🧹' : type === 'servicios' ? '🛡️' : '⚙️'}</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                Datos de la Inspección
        </h2>
              <p className="text-sm sm:text-base text-gray-600 font-medium">
                Completa todos los campos obligatorios
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Número de Inspección */}
          <div>
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">🆔</span>
              <span>Número de Inspección *</span>
            </label>
            <input
              type="text"
            value={formData.nr}
              disabled={true}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gray-50 cursor-not-allowed font-medium shadow-md"
              placeholder="Se genera automáticamente"
            />
          </div>
          
          {/* Data */}
          <div>
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">📅</span>
              <span>Fecha *</span>
            </label>
            <input
            type="date"
            value={formData.data}
            onChange={(e) => handleInputChange('data', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                errors.data 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 focus:shadow-blue-500/20'
              }`}
            />
            {errors.data && <p className="text-xs text-red-600 mt-1">{errors.data}</p>}
          </div>
          
          {/* Centro de Trabajo */}
          <div>
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>Centro de Trabajo *</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar centro de trabajo..."
                value={formData.centro}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange('centro', value);
                  setShowCentroDropdown(true);
                }}
                onFocus={() => setShowCentroDropdown(true)}
                onBlur={() => {
                  // Delay to allow clicking on dropdown items
                  setTimeout(() => setShowCentroDropdown(false), 200);
                }}
                disabled={loadingCentros}
                className={`w-full px-4 py-3 pr-10 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-green-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.centro 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500 hover:border-green-300 focus:shadow-green-500/20'
                }`}
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="text-gray-400 text-lg">🔍</span>
              </div>
              
              {/* Dropdown de sugerencias */}
              {showCentroDropdown && formData.centro && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {centros
                    .filter(centro => 
                      centro.toLowerCase().includes(formData.centro.toLowerCase())
                    )
                    .slice(0, 10) // Limitar a 10 resultados
                    .map((centro, index) => (
                      <button
                        key={`${centro}-${index}`}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          handleInputChange('centro', centro);
                          setShowCentroDropdown(false);
                        }}
                      >
                        <div className="font-medium text-gray-900">{centro}</div>
                      </button>
                    ))}
                  {centros.filter(centro => 
                    centro.toLowerCase().includes(formData.centro.toLowerCase())
                  ).length === 0 && (
                    <div className="px-4 py-3 text-gray-500 text-center">
                      No se encontraron centros
                    </div>
                  )}
                </div>
              )}
            </div>
            {loadingCentros && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <span className="animate-spin">⏳</span>
                <span>Cargando centros...</span>
              </p>
            )}
            {errors.centro && <p className="text-xs text-red-600 mt-1">{errors.centro}</p>}
          </div>
          
          {/* Trabajador */}
          <div>
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">👷</span>
              <span>Trabajador *</span>
            </label>
            <select
              value={formData.trabajador.nume}
              onChange={(e) => {
                const selectedEmployee = empleadosFiltrados.find(emp => 
                  (emp['NOMBRE / APELLIDOS'] || emp.name || 'Sin nombre') === e.target.value
                );
                handleTrabajadorChange('nume', e.target.value);
                if (selectedEmployee) {
                  const codigo = selectedEmployee.codigo || 
                                selectedEmployee.CODIGO || 
                                selectedEmployee.codigo_empleado || 
                                selectedEmployee['CODIGO EMPLEADO'] ||
                                selectedEmployee.NIE || 
                                selectedEmployee['D.N.I. / NIE'] || 
                                selectedEmployee.DNI || '';
                  handleTrabajadorChange('codigo', codigo);
                }
              }}
              disabled={!formData.centro || empleadosFiltrados.length === 0}
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-blue-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.trabajador 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 focus:shadow-blue-500/20'
              }`}
            >
              <option value="">
                {formData.centro ? 'Selecciona un trabajador...' : 'Primero selecciona un centro'}
              </option>
              {empleadosFiltrados.map(emp => {
                const codigo = emp.codigo || emp.CODIGO || emp.codigo_empleado || emp['CODIGO EMPLEADO'] || emp.NIE || emp['D.N.I. / NIE'] || emp.DNI || 'N/A';
                const nombre = emp['NOMBRE / APELLIDOS'] || emp.name || 'Sin nombre';
                return (
                  <option key={codigo} value={nombre}>
                    {nombre} ({codigo})
                  </option>
                );
              })}
            </select>
            {formData.centro && empleadosFiltrados.length === 0 && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                <span>⚠️</span>
                <span>No hay empleados en este centro</span>
              </p>
            )}
            {formData.trabajador.codigo && (
              <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                <span>✅</span>
                <span>Código: {formData.trabajador.codigo}</span>
              </p>
            )}
            {errors.trabajador && <p className="text-xs text-red-600 mt-1">{errors.trabajador}</p>}
          </div>
          
          {/* Ubicación con GPS - Full width en mobile */}
          <div className="md:col-span-2">
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">📍</span>
              <span>Ubicación *</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={formData.locatie}
                onChange={(e) => handleInputChange('locatie', e.target.value)}
                placeholder="Ubicación de la inspección..."
                className={`flex-1 px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                  errors.locatie 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-300 focus:shadow-purple-500/20'
                }`}
              />
              <button
                onClick={handleGetCurrentLocation}
                disabled={locationLoading}
                className="group relative px-4 sm:px-6 py-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden w-full sm:w-auto"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)'
                }}
                title="Obtener ubicación GPS actual"
              >
                <div className="absolute inset-0 bg-purple-400 opacity-0 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className={`text-lg ${locationLoading ? 'animate-pulse' : ''}`}>📍</span>
                  <span className="text-sm">Obtener GPS</span>
                </div>
              </button>
            </div>
            {locationLoading && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
                <span className="animate-spin">⏳</span>
                <span>Obteniendo ubicación GPS...</span>
              </p>
            )}
            {locationError && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <span>❌</span>
                <span>{locationError}</span>
              </p>
            )}
            {errors.locatie && <p className="text-xs text-red-600 mt-1">{errors.locatie}</p>}
          </div>
          
          {/* Inspector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">👨‍💼</span>
              <span>Inspector *</span>
            </label>
            <input
              type="text"
            value={formData.inspector.nume}
            onChange={(e) => handleInspectorChange('nume', e.target.value)}
              placeholder="Nombre del inspector"
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                errors.inspectorName 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 focus:shadow-orange-500/20'
              }`}
            />
            {errors.inspectorName && <p className="text-xs text-red-600 mt-1">{errors.inspectorName}</p>}
          </div>
        </div>
      </Card>
      </div>

      {/* Puncte de inspecție ULTRA MODERN */}
      <div className="relative group">
        {/* Glow effect */}
        <div className={`absolute -inset-1 rounded-3xl opacity-15 group-hover:opacity-25 blur-xl transition-all duration-500 ${
          type === 'limpieza' 
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
            : type === 'servicios'
            ? 'bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500'
            : 'bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600'
        }`}></div>
        
        <Card className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-4 sm:p-6"
              style={{ backdropFilter: 'blur(20px)' }}>
          {/* Header con icon */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
              type === 'limpieza'
                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                : type === 'servicios'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600'
                : type === 'entrega-materiales'
                ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                : 'bg-gradient-to-br from-purple-500 to-purple-600'
            }`}>
              <span className="text-2xl">{type === 'entrega-materiales' ? '📦' : '✅'}</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900">
                {type === 'entrega-materiales' ? 'Materiales' : 'Puntos de Inspección'}
        </h2>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                {type === 'limpieza' ? 'Limpieza' : 
                 type === 'servicios' ? 'Servicios Auxiliares' : 
                 type === 'entrega-materiales' ? `${formData.puncte.length} material${formData.puncte.length !== 1 ? 'es' : ''}` :
                 'Personalizada'} - {type !== 'entrega-materiales' ? `${formData.puncte.length} zonas` : ''}
              </p>
            </div>
          </div>
          
          {/* Add Point/Material Button for Personalizada and Entrega de Materiales */}
          {(type === 'personalizada' || type === 'entrega-materiales') && (
            <div className="mb-6">
              <button
                onClick={() => setShowAddPointModal(true)}
                className="group relative w-full px-6 py-4 rounded-2xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden"
                style={{
                  background: type === 'entrega-materiales' 
                    ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  boxShadow: type === 'entrega-materiales'
                    ? '0 8px 20px rgba(249, 115, 22, 0.3)'
                    : '0 8px 20px rgba(139, 92, 246, 0.3)'
                }}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity ${
                  type === 'entrega-materiales' ? 'bg-orange-400' : 'bg-purple-400'
                }`}></div>
                <div className="relative flex items-center justify-center gap-3">
                  <span className="text-2xl">➕</span>
                  <span className="text-lg">
                    {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
                  </span>
                </div>
              </button>
            </div>
          )}
          
          <div className="space-y-3 sm:space-y-4">
          {formData.puncte.map((point, index) => (
              <div key={point.id}               className={`group/point relative border-2 rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:shadow-lg ${
                type === 'limpieza'
                  ? 'border-red-200 bg-gradient-to-br from-red-50/50 to-orange-50/30 hover:border-red-300'
                  : type === 'servicios'
                  ? 'border-blue-200 bg-gradient-to-br from-blue-50/50 to-cyan-50/30 hover:border-blue-300'
                  : type === 'entrega-materiales'
                  ? 'border-orange-200 bg-gradient-to-br from-orange-50/50 to-amber-50/30 hover:border-orange-300'
                  : 'border-purple-200 bg-gradient-to-br from-purple-50/50 to-violet-50/30 hover:border-purple-300'
              }`}>
                {/* Número de zona/material destacado */}
                <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-black shadow-md ${
                  type === 'limpieza'
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                    : type === 'servicios'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : type === 'entrega-materiales'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                }`}>
                    {type === 'entrega-materiales' ? `Material ${index + 1}` : `Zona ${index + 1}`}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-2">
                  {/* Descripción */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm sm:text-base font-bold text-gray-900">{point.descriere}</p>
                        {/* Afișează cantitatea, prețul și documentul pentru materiale */}
                        {type === 'entrega-materiales' && (
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                            {point.cantitate && (
                              <span className="text-xs sm:text-sm text-orange-700 font-semibold bg-orange-100 px-2 py-1 rounded-lg">
                                📦 Cantidad: {point.cantitate}
                              </span>
                            )}
                            {point.precio && (
                              <span className="text-xs sm:text-sm text-green-700 font-semibold bg-green-100 px-2 py-1 rounded-lg">
                                💰 Precio: {parseFloat(point.precio).toFixed(2)} €
                              </span>
                            )}
                            {point.documento && (
                              <span className="text-xs sm:text-sm text-blue-700 font-semibold bg-blue-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                📄 {point.documento.name || 'Documento adjunto'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {(type === 'personalizada' || type === 'entrega-materiales') && point.isCustom && (
                        <button
                          onClick={() => handleRemovePoint(point.id)}
                          className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                          title={type === 'entrega-materiales' ? 'Eliminar material' : 'Eliminar punto'}
                        >
                          <span className="text-lg">🗑️</span>
                        </button>
                      )}
                    </div>
                    {point.tip && type !== 'entrega-materiales' && (
                      <p className="text-xs text-purple-600 font-medium mt-1">
                        Tipo: {point.tip === 'obligatoriu' ? 'Obligatorio' : 'Opcional'}
                      </p>
                    )}
                  </div>

                  {/* Rango */}
                <div>
                    <label className="block text-xs sm:text-sm font-black text-gray-800 mb-2">
                    Rango
                  </label>
                    <select
                    value={point.rango}
                    onChange={(e) => handlePointChange(point.id, 'rango', parseInt(e.target.value))}
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 hover:border-amber-300 shadow-md focus:shadow-xl focus:shadow-amber-500/20 font-medium text-sm cursor-pointer"
                    >
                      {RANGO_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                </div>

                  {/* Calidad */}
                <div>
                    <label className="block text-xs sm:text-sm font-black text-gray-800 mb-2">
                      Calidad
                  </label>
                    <select
                    value={point.calidad}
                    onChange={(e) => handlePointChange(point.id, 'calidad', parseInt(e.target.value))}
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-gradient-to-br from-white to-green-50/30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 hover:border-green-300 shadow-md focus:shadow-xl focus:shadow-green-500/20 font-medium text-sm cursor-pointer"
                    >
                      {RANGO_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
              </div>

                  {/* Observaciones */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-black text-gray-800 mb-2">
                      Observaciones
                </label>
                    <input
                      type="text"
                  value={point.observatii}
                  onChange={(e) => handlePointChange(point.id, 'observatii', e.target.value)}
                      placeholder="Observaciones opcionales..."
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all duration-300 hover:border-gray-400 shadow-md focus:shadow-lg font-medium text-sm"
                />
                  </div>
              </div>
            </div>
          ))}
        </div>
        {errors.puncte && (
            <p className="text-xs text-red-600 mt-4 flex items-center gap-1">
              <span>⚠️</span>
              <span>{errors.puncte}</span>
            </p>
        )}
      </Card>
      </div>

      {/* Firmas Digitales ULTRA MODERN */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-15 group-hover:opacity-25 blur-xl transition-all duration-500"></div>
        
        <Card className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-4 sm:p-6"
              style={{ backdropFilter: 'blur(20px)' }}>
          {/* Header con icon */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">✍️</span>
            </div>
          <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900">
                Firmas Digitales
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                Firma del inspector y trabajador
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Firma Inspector */}
            <div className="group/sign relative">
              <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">👨‍💼</span>
                <span>Firma del Inspector</span>
            </h3>
              <button
              onClick={() => openSignatureModal('inspector')}
                className={`group/btn relative w-full px-4 sm:px-6 py-4 sm:py-5 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden ${
                  formData.inspector.semnaturaPng 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 hover:from-indigo-200 hover:to-purple-200'
                }`}
                style={{
                  boxShadow: formData.inspector.semnaturaPng 
                    ? '0 10px 25px rgba(34, 197, 94, 0.3)'
                    : '0 8px 20px rgba(99, 102, 241, 0.2)'
                }}
              >
                <div className={`absolute inset-0 opacity-0 group-hover/btn:opacity-30 transition-opacity ${
                  formData.inspector.semnaturaPng ? 'bg-green-400' : 'bg-indigo-400'
                }`}></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className="text-xl sm:text-2xl">{formData.inspector.semnaturaPng ? '✅' : '✍️'}</span>
                  <span className="text-sm sm:text-base">
                    {formData.inspector.semnaturaPng ? 'Firma Agregada' : 'Agregar Firma'}
                  </span>
                </div>
              </button>
            {errors.inspectorSignature && (
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{errors.inspectorSignature}</span>
                </p>
            )}
          </div>
          
            {/* Firma Trabajador */}
            <div className="group/sign relative">
              <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">👷</span>
                <span>Firma del Trabajador</span>
            </h3>
              <button
              onClick={() => openSignatureModal('trabajador')}
              disabled={!formData.trabajador.nume}
                className={`group/btn relative w-full px-4 sm:px-6 py-4 sm:py-5 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  formData.trabajador.semnaturaPng 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 hover:from-blue-200 hover:to-cyan-200'
                }`}
                style={{
                  boxShadow: formData.trabajador.semnaturaPng 
                    ? '0 10px 25px rgba(34, 197, 94, 0.3)'
                    : '0 8px 20px rgba(59, 130, 246, 0.2)'
                }}
              >
                <div className={`absolute inset-0 opacity-0 group-hover/btn:opacity-30 transition-opacity ${
                  formData.trabajador.semnaturaPng ? 'bg-green-400' : 'bg-blue-400'
                }`}></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className="text-xl sm:text-2xl">{formData.trabajador.semnaturaPng ? '✅' : '✍️'}</span>
                  <span className="text-sm sm:text-base">
                    {formData.trabajador.semnaturaPng ? 'Firma Agregada' : 'Agregar Firma'}
                  </span>
                </div>
              </button>
            {!formData.trabajador.nume && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>Primero selecciona un trabajador</span>
                </p>
            )}
            {errors.trabajadorSignature && (
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{errors.trabajadorSignature}</span>
                </p>
            )}
          </div>
        </div>
        
        {/* Afișează erorile generale pentru semnături */}
        {(errors.inspectorSignature || errors.trabajadorSignature) && (
            <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
              <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <span><strong>Nota:</strong> Las firmas son opcionales pero recomendadas para generar un PDF completo.</span>
            </p>
          </div>
        )}
      </Card>
      </div>

      {/* Observaciones Generales ULTRA MODERN */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-gray-400 via-gray-500 to-gray-600 rounded-3xl opacity-10 group-hover:opacity-20 blur-xl transition-all duration-500"></div>
        
        <Card className="relative bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-gray-200/50 rounded-3xl p-4 sm:p-6"
              style={{ backdropFilter: 'blur(20px)' }}>
          {/* Header con icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900">
                Observaciones Generales
        </h2>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                Comentarios adicionales (opcional)
              </p>
            </div>
          </div>
          
          <textarea
          value={formData.observaciones}
          onChange={(e) => handleInputChange('observaciones', e.target.value)}
            placeholder="Escribe observaciones generales sobre la inspección..."
          rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-300 hover:border-gray-400 shadow-md focus:shadow-xl focus:shadow-gray-500/20 font-medium resize-none"
        />
      </Card>
      </div>

      {/* Botón Submit MEGA WOW */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 sticky bottom-4 sm:bottom-6 z-10">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="group relative px-6 sm:px-8 py-4 sm:py-5 rounded-2xl font-black text-white transition-all duration-700 transform hover:scale-110 hover:-translate-y-2 shadow-2xl hover:shadow-red-500/50 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #b91c1c 60%, #991b1b 100%)',
            boxShadow: '0 20px 50px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
          }}
        >
          {/* Animated glow ultra potente */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-400 via-rose-500 to-red-600 opacity-60 group-hover:opacity-90 blur-2xl transition-all duration-700 animate-pulse"></div>
          
          {/* Shimmer mega effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          
          {/* Particles effect */}
          {!loading && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute top-2 left-6 w-2 h-2 bg-white rounded-full animate-ping"></div>
              <div className="absolute bottom-3 right-8 w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
              <div className="absolute top-4 right-12 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
          
          {/* Content */}
          <div className="relative flex items-center justify-center gap-3">
            {loading ? (
              <>
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-base sm:text-lg">Generando PDF...</span>
              </>
            ) : (
              <>
                <span className="text-2xl sm:text-3xl transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500">📄</span>
                <div className="flex flex-col items-start">
                  <span className="text-base sm:text-lg tracking-wide">GENERAR</span>
                  <span className="text-xs opacity-90">y Previsualizar PDF</span>
                </div>
              </>
            )}
          </div>
          
          {/* Borde brillante animado */}
          <div className="absolute inset-0 rounded-2xl border-2 border-white/30 group-hover:border-white/60 transition-all duration-700"></div>
        </button>
      </div>

      {/* Modal pentru semnături */}
      <Modal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        title={t('inspections.addSignature')}
      >
        <div className="flex flex-col gap-6">
          <SignaturePadComponent
            value={signatureDraft}
            onChange={handleSignatureChange}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowSignatureModal(false)}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSignatureSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
            >
              Guardar firma
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru adăugarea punctelor personalizate/materialelor */}
      <Modal
        isOpen={showAddPointModal}
        onClose={() => setShowAddPointModal(false)}
        title={type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {type === 'entrega-materiales' ? 'Descripción del Material *' : 'Descripción del Punto *'}
            </label>
            <input
              type="text"
              value={newPointData.descriere}
              onChange={(e) => setNewPointData(prev => ({ ...prev, descriere: e.target.value }))}
              placeholder={type === 'entrega-materiales' 
                ? 'Ej: Material de limpieza, Suministros de oficina, Herramientas...'
                : 'Ej: Estado de las puertas, Limpieza de ventanas...'}
              className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                type === 'entrega-materiales'
                  ? 'focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 focus:shadow-orange-500/20'
                  : 'focus:ring-purple-500 focus:border-purple-500 hover:border-purple-300 focus:shadow-purple-500/20'
              }`}
            />
          </div>
          
          {/* Câmpuri specifice pentru materiale */}
          {type === 'entrega-materiales' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Cantidad *
                </label>
                <input
                  type="text"
                  value={newPointData.cantitate}
                  onChange={(e) => setNewPointData(prev => ({ ...prev, cantitate: e.target.value }))}
                  placeholder="Ej: 3, 5 unidades, 10 kg..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 shadow-md focus:shadow-xl focus:shadow-orange-500/20 font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Precio (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPointData.precio}
                  onChange={(e) => setNewPointData(prev => ({ ...prev, precio: e.target.value }))}
                  placeholder="Ej: 25.50, 100.00..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 shadow-md focus:shadow-xl focus:shadow-orange-500/20 font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Factura/Albarán (Opcional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewPointData(prev => ({ ...prev, documento: file }));
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 shadow-md focus:shadow-xl focus:shadow-orange-500/20 font-medium text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
                {newPointData.documento && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <span>✅</span>
                    <span>Archivo seleccionado: {newPointData.documento.name}</span>
                    <button
                      onClick={() => setNewPointData(prev => ({ ...prev, documento: null }))}
                      className="ml-2 text-red-500 hover:text-red-700"
                      title="Eliminar archivo"
                    >
                      ✕
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
          
          {/* Tipo de Punto - doar pentru inspecții personalizate (nu pentru materiale) */}
          {type !== 'entrega-materiales' && (
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Tipo de Punto
              </label>
              <select
                value={newPointData.tip}
                onChange={(e) => setNewPointData(prev => ({ ...prev, tip: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 hover:border-purple-300 shadow-md focus:shadow-xl focus:shadow-purple-500/20 font-medium cursor-pointer"
              >
                <option value="obligatoriu">Obligatorio</option>
                <option value="opcional">Opcional</option>
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Observaciones Iniciales (Opcional)
            </label>
            <textarea
              value={newPointData.observatii}
              onChange={(e) => setNewPointData(prev => ({ ...prev, observatii: e.target.value }))}
              placeholder={type === 'entrega-materiales'
                ? 'Observaciones iniciales para este material...'
                : 'Observaciones iniciales para este punto...'}
              rows={3}
              className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium resize-none ${
                type === 'entrega-materiales'
                  ? 'focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 focus:shadow-orange-500/20'
                  : 'focus:ring-purple-500 focus:border-purple-500 hover:border-purple-300 focus:shadow-purple-500/20'
              }`}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowAddPointModal(false)}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddCustomPoint}
              className={`px-6 py-3 text-white font-bold rounded-xl transition-colors ${
                type === 'entrega-materiales'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal previsualización PDF */}
      <Modal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Previsualización del PDF"
      >
        <div className="p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              PDF Generado: {formData.nr}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Revisa el contenido del PDF antes de enviar. Puedes descargar el PDF o enviar la inspección.
            </p>
          </div>
          
          <div className="mb-4">
            {/* Android: PDF.js rendering | iOS: <object> | Desktop: <iframe> */}
            { isAndroid ? (
              <PDFViewerAndroid 
                pdfUrl={pdfPreviewUrl} 
                className="w-full border border-gray-200 rounded-lg"
                style={{ height: '75vh' }}
              />
            ) : isIOS ? (
              <object
                data={pdfPreviewUrl}
                type="application/pdf"
                className="w-full border border-gray-200 rounded-lg"
                style={{ height: '75vh' }}
              >
                <div className="p-4 text-center text-gray-600">
                  <p className="mb-3">No se puede mostrar el PDF en este visor.</p>
                  <a
                    href={pdfPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                  >
                    Abrir el PDF en una nueva pestaña
                  </a>
                </div>
              </object>
            ) : (
              <iframe
                src={pdfPreviewUrl}
                title="PDF Preview"
                className="w-full border border-gray-200 rounded-lg"
                style={{ height: '75vh' }}
              />
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfPreviewUrl;
                  link.download = `inspeccion-${formData.nr}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                📥 Descargar PDF
              </Button>
              
              <Button
                onClick={() => setShowPdfPreview(false)}
                variant="outline"
                className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
              >
                ❌ Cancelar
              </Button>
            </div>
            
            <Button
              onClick={handleSendInspection}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enviando...
                </div>
              ) : (
                '✅ Enviar Inspección'
              )}
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Información:</strong> El PDF contiene todos los datos de la inspección y se enviará en formato Base64 al backend.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InspectionForm; 