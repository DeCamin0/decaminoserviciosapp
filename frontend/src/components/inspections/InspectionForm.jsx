import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { useLocation } from '../../contexts/LocationContextBase';
import { Button, Modal, AlertBanner } from '../ui';
import { FormSection, FormFieldLabel, SignatureActionCard } from './InspectionFormChrome';
import {
  Hash, Calendar, Building2, User, Search, MapPin, CheckCircle2,
  FileText, Plus, Trash2, Package, Loader2, Download, Send, X,
  AlertTriangle, Info, Euro, Lightbulb,
} from 'lucide-react';
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
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../i18n';
import { config } from '../../config/env';
import { validarDniNie, normalizeSpanishDniNie } from '../../utils/spanishId';

/**
 * Watermark PDF: același logo ca în UI (VITE_LOGO_PATH în public), nu asset-ul fix din @/assets.
 */
function getBrandingLogoUrlForPdf() {
  const basePath = config.BASE_PATH || '/';
  const logoPath = config.LOGO_PATH || 'logo.svg';
  const rel = `${basePath}${logoPath}`.replace(/\/+/g, '/');
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(rel, window.location.origin).href;
    } catch {
      return `${window.location.origin}${rel.startsWith('/') ? rel : `/${rel}`}`;
    }
  }
  return rel;
}

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

const InspectionForm = ({ type, solicitudData }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { getCurrentLocation, getAddressFromCoords } = useLocation();
  
  // Pre-completează formData cu datele din cerere dacă există
  const getInitialFormData = () => {
    // Dacă există cerere, folosește ID-ul cererii pentru a transforma cererea în inspecție completă
    const inspeccionId = solicitudData?.id || '';
    
    const baseData = {
      nr: inspeccionId, // Folosește ID-ul cererii dacă există
      data: new Date().toISOString().split('T')[0],
      inspector: {
        nume: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
        semnaturaPng: ''
      },
      trabajador: {
        nume: solicitudData?.trabajador || '',
        semnaturaPng: '',
        codigo: solicitudData?.employeeCode || ''
      },
      locatie: '',
      centro: solicitudData?.centro || '',
      centroTrabajador: solicitudData?.centro || '', // Centru temporar pentru angajații fără centru (doar pentru inspecția curentă)
      supervisor: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
      supervisor_codigo: user?.CODIGO || user?.codigo || null, // Adăugat codigo supervizor
      puncte: [],
      type: type,
      observaciones: solicitudData?.observaciones || '',
      status: 'completada',
      codigo_empleado: solicitudData?.employeeCode || '', // Adăugat la nivel principal
      otraPersona: false
    };
    return baseData;
  };
  
  const [formData, setFormData] = useState(getInitialFormData());

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
            'X-App-Source': (config.APP_NAME || config.COMPANY_NAME || 'Web-App').replace(/\s+/g, '-'),
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': (config.APP_NAME || config.COMPANY_NAME || 'Web-Client') + '/1.0'
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
            'X-App-Source': (config.APP_NAME || config.COMPANY_NAME || 'Web-App').replace(/\s+/g, '-'),
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': (config.APP_NAME || config.COMPANY_NAME || 'Web-Client') + '/1.0'
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
        
        // Pre-completează trabajador și centro dacă există date din cerere
        if (solicitudData && solicitudData.trabajador && solicitudData.employeeCode) {
          // Găsește angajatul în listă
          const empleadoEncontrado = empleadosArray.find(emp => 
            emp.CODIGO === solicitudData.employeeCode || 
            emp.codigo === solicitudData.employeeCode ||
            (emp['NOMBRE / APELLIDOS'] || emp.name) === solicitudData.trabajador
          );
          
          if (empleadoEncontrado) {
            setFormData(prev => ({
              ...prev,
              trabajador: {
                nume: empleadoEncontrado['NOMBRE / APELLIDOS'] || empleadoEncontrado.name || solicitudData.trabajador,
                semnaturaPng: '',
                codigo: empleadoEncontrado.CODIGO || empleadoEncontrado.codigo || solicitudData.employeeCode
              },
              codigo_empleado: empleadoEncontrado.CODIGO || empleadoEncontrado.codigo || solicitudData.employeeCode,
              centro: solicitudData.centro && centrosFromClientes.includes(solicitudData.centro) 
                ? solicitudData.centro 
                : prev.centro,
              centroTrabajador: solicitudData.centro && centrosFromClientes.includes(solicitudData.centro)
                ? solicitudData.centro
                : prev.centroTrabajador
            }));
            console.log('✅ Pre-completat trabajador și centro din cerere:', {
              trabajador: empleadoEncontrado['NOMBRE / APELLIDOS'] || empleadoEncontrado.name,
              centro: solicitudData.centro
            });
          }
        }
        
        // Nu setăm centru-ul automat - utilizatorul trebuie să selecteze manual
        // (Comentat pentru a permite utilizatorului să aleagă centru-ul manual)
        // const userCentro = user?.['CENTRO TRABAJO'] || 
        //                    user?.CENTRO_TRABAJO || 
        //                    user?.CENTRO || 
        //                    user?.centro ||
        //                    user?.['CENTRO_DE_TRABAJO'] || 
        //                    user?.['CENTRO LABORAL'];
        // 
        // if (userCentro && centrosFromClientes.includes(userCentro)) {
        //   setFormData(prev => ({ ...prev, centro: userCentro }));
        // }
      } catch (error) {
        console.error('Error loading centros/empleados:', error);
      } finally {
        setLoadingCentros(false);
      }
    };

    loadCentrosYEmpleados();
  }, [user, solicitudData]);

  // Pre-completează trabajador și centro după ce se încarcă empleados și centros
  useEffect(() => {
    if (solicitudData && empleados.length > 0 && centros.length > 0) {
      // Găsește angajatul în listă
      const empleadoEncontrado = empleados.find(emp => 
        emp.CODIGO === solicitudData.employeeCode || 
        emp.codigo === solicitudData.employeeCode ||
        (emp['NOMBRE / APELLIDOS'] || emp.name) === solicitudData.trabajador
      );
      
      if (empleadoEncontrado) {
        setFormData(prev => ({
          ...prev,
          trabajador: {
            nume: empleadoEncontrado['NOMBRE / APELLIDOS'] || empleadoEncontrado.name || solicitudData.trabajador,
            semnaturaPng: '',
            codigo: empleadoEncontrado.CODIGO || empleadoEncontrado.codigo || solicitudData.employeeCode
          },
          codigo_empleado: empleadoEncontrado.CODIGO || empleadoEncontrado.codigo || solicitudData.employeeCode,
          centro: solicitudData.centro && centros.includes(solicitudData.centro) 
            ? solicitudData.centro 
            : prev.centro,
          centroTrabajador: solicitudData.centro && centros.includes(solicitudData.centro)
            ? solicitudData.centro
            : prev.centroTrabajador
        }));
        console.log('✅ Pre-completat trabajador și centro din cerere:', {
          trabajador: empleadoEncontrado['NOMBRE / APELLIDOS'] || empleadoEncontrado.name,
          centro: solicitudData.centro
        });
      }
    }
  }, [solicitudData, empleados, centros]);

  // Filtrează angajații când se schimbă centru-ul
  useEffect(() => {
    if (formData.centro && empleados.length > 0) {
      // Dacă există centru selectat, filtrează angajații cu acel centru
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
    } else if (empleados.length > 0) {
      // Dacă nu există centru selectat, filtrează angajații activi fără centru asociat
      const empleadosSinCentro = empleados.filter(emp => {
        // Verifică dacă angajatul este activ
        const estado = (emp['ESTADO'] || emp.ESTADO || '').toString().trim().toUpperCase();
        const isActivo = estado === 'ACTIVO';
        
        // Verifică dacă angajatul nu are centru asociat
        const empCentro = emp['CENTRO TRABAJO'] || 
                          emp.CENTRO_TRABAJO || 
                          emp.CENTRO || 
                          emp.centro ||
                          emp['CENTRO_DE_TRABAJO'] || 
                          emp['CENTRO LABORAL'];
        const sinCentro = !empCentro || empCentro.trim() === '';
        
        // Returnează true doar dacă este activ ȘI nu are centru
        return isActivo && sinCentro;
      });
      setEmpleadosFiltrados(empleadosSinCentro);
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

    setFormData(prev => {
      // Păstrează ID-ul cererii dacă există (începe cu "SOL-")
      // Sau dacă există solicitudData, folosește ID-ul din el
      const newNr = (prev.nr && prev.nr.startsWith('SOL-')) 
        ? prev.nr 
        : (solicitudData?.id || prev.nr || generateInspectionNumber());
      
      return {
        ...prev,
        puncte: initialPoints,
        nr: newNr
      };
    });
  }, [ZONES_LIMPIEZA, ZONES_PERSONALIZADA, ZONES_SERVICIOS, generateInspectionNumber, type, solicitudData]);

  const validateForm = () => {
    const newErrors = {};
    const isOtraPersona = type === 'entrega-materiales' && formData.otraPersona;

    // Validări de bază
    if (!formData.data) newErrors.data = 'Data este obligatorie';
    if (!formData.inspector.nume.trim()) newErrors.inspectorName = 'Numele inspectorului este obligatoriu';
    if (!formData.locatie.trim()) newErrors.locatie = 'Locația este obligatorie';
    
    if (isOtraPersona) {
      if (!formData.centro.trim()) {
        newErrors.centro = 'Centro de trabajo es obligatorio';
      }
      if (!formData.trabajador.nume.trim()) {
        newErrors.trabajador = 'Nombre es obligatorio';
      }
      if (!formData.trabajador.codigo?.trim()) {
        newErrors.trabajadorDni = 'required';
      } else if (validarDniNie(formData.trabajador.codigo) !== true) {
        newErrors.trabajadorDni = 'invalid';
      }
    } else {
      // Verifică dacă angajatul selectat are centru
      const selectedEmployee = formData.trabajador.nume 
        ? empleados.find(emp => 
            (emp['NOMBRE / APELLIDOS'] || emp.name || 'Sin nombre') === formData.trabajador.nume
          )
        : null;
      const trabajadorTieneCentro = selectedEmployee ? empleadoTieneCentro(selectedEmployee) : false;
      
      // Centru-ul este obligatoriu doar dacă:
      // 1. Nu există un angajat fără centru selectat SAU
      // 2. Angajatul selectat are centru asociat
      // Dacă angajatul nu are centru, centru-ul devine opțional (poate fi setat prin centroTrabajador)
      if (trabajadorTieneCentro || !formData.trabajador.nume.trim()) {
        // Dacă angajatul are centru sau nu există angajat selectat, centru-ul este obligatoriu
        if (!formData.centro.trim()) {
          newErrors.centro = 'Centro de trabajo es obligatorio';
        }
      }
      // Dacă angajatul nu are centru, centru-ul este opțional (nu adăugăm eroare)
      
      if (!formData.trabajador.nume.trim()) newErrors.trabajador = 'Trabajador es obligatorio';
    }

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
        trabajador: { nume: '', semnaturaPng: '', codigo: '' },
        codigo_empleado: ''
      }));
    }
  };

  const handleOtraPersonaChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      otraPersona: checked,
      trabajador: { nume: '', semnaturaPng: '', codigo: '' },
      codigo_empleado: '',
      centroTrabajador: ''
    }));
  };

  const isEntregaOtraPersona = type === 'entrega-materiales' && formData.otraPersona;
  const dniNieOtraPersonaStatus = isEntregaOtraPersona
    ? validarDniNie(formData.trabajador.codigo)
    : null;

  const handleInspectorChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      inspector: {
        ...prev.inspector,
        [field]: value
      }
    }));
  };

  // Funcție helper pentru a verifica dacă un angajat are centru asociat
  const empleadoTieneCentro = (empleado) => {
    if (!empleado) return false;
    const empCentro = empleado['CENTRO TRABAJO'] || 
                      empleado.CENTRO_TRABAJO || 
                      empleado.CENTRO || 
                      empleado.centro ||
                      empleado['CENTRO_DE_TRABAJO'] || 
                      empleado['CENTRO LABORAL'];
    return empCentro && empCentro.trim() !== '';
  };

  const handleTrabajadorChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        trabajador: {
          ...prev.trabajador,
          [field]: field === 'codigo' && prev.otraPersona
            ? normalizeSpanishDniNie(value)
            : value
        },
        // Actualizează și codigo_empleado la nivel principal
        codigo_empleado: field === 'codigo'
          ? (prev.otraPersona ? normalizeSpanishDniNie(value) : value)
          : prev.codigo_empleado
      };
      
      // Dacă se schimbă numele angajatului, verifică dacă are centru și resetează centroTrabajador dacă are
      if (field === 'nume' && value && !prev.otraPersona) {
        const selectedEmployee = empleados.find(emp => 
          (emp['NOMBRE / APELLIDOS'] || emp.name || 'Sin nombre') === value
        );
        if (selectedEmployee && empleadoTieneCentro(selectedEmployee)) {
          // Dacă angajatul are centru, resetează centroTrabajador
          newData.centroTrabajador = '';
        }
      }
      
      return newData;
    });
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

      const receptorEsOtraPersona = type === 'entrega-materiales' && formData.otraPersona;
      const etiquetaPersonaPdf = receptorEsOtraPersona ? 'Receptor' : 'Empleado';

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
              <Image src={getBrandingLogoUrlForPdf()} style={styles.watermarkLogo} fixed />
              
                             {/* Header */}
               <View style={styles.header}>
                 <Text style={styles.title}>Inspección de {type === 'limpieza' ? 'Limpieza' : type === 'servicios' ? 'Servicios Auxiliares' : type === 'entrega-materiales' ? 'Entrega de Materiales' : 'Personalizada'}</Text>
                 <Text style={styles.inspectionNumber}>Número: {safeText(formData.nr)}</Text>
                 <Text style={styles.date}>Fecha: {safeText(formData.data)}</Text>
                 <Text style={styles.location}>Ubicación: {safeText(formData.locatie)}</Text>
                 <Text style={styles.trabajador}>Centro de Trabajo: {safeText(formData.centroTrabajador || formData.centro)}</Text>
                 <Text style={styles.inspector}>Inspector: {safeText(formData.inspector?.nume)}</Text>
                 <Text style={styles.employee}>
                   {etiquetaPersonaPdf}: {safeText(formData.trabajador?.nume)}
                   {formData.trabajador?.codigo && formData.trabajador.codigo.trim() !== ''
                     ? ` (${receptorEsOtraPersona ? 'DNI/NIE: ' : ''}${safeText(formData.trabajador.codigo)})`
                     : null}
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
                    <Text>Este PDF ha sido generado automáticamente por el sistema {config.APP_NAME || config.COMPANY_NAME || ''}.</Text>
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
                    <Text>Este PDF ha sido generado automáticamente por el sistema {config.APP_NAME || config.COMPANY_NAME || ''}.</Text>
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
                <Image src={getBrandingLogoUrlForPdf()} style={styles.watermarkLogo} fixed />
                
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
                  <Text>Este PDF ha sido generado automáticamente por el sistema {config.APP_NAME || config.COMPANY_NAME || ''}.</Text>
                </View>
              </Page>
            )}

            {/* Servicios Auxiliares: sin segunda página (todo en la primera) */}

            {/* A doua pagină - doar pentru personalizada când sunt > 9 puncte */}
            {type === 'personalizada' && formData.puncte.length > 9 && (
              <Page size="A4" style={styles.page}>
                {/* Watermark logo */}
                <Image src={getBrandingLogoUrlForPdf()} style={styles.watermarkLogo} />
                
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
                  <Text>Este PDF ha sido generado automáticamente por el sistema {config.APP_NAME || config.COMPANY_NAME || ''}.</Text>
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
        
        // Dacă există un angajat fără centru și s-a setat centroTrabajador, folosește-l ca centro pentru backend
        const centroParaBackend = formData.centroTrabajador 
          ? formData.centroTrabajador 
          : formData.centro;
        
        // Salvează datele pentru previzualizare
        setPdfPreviewData({
          ...formData,
          centro: centroParaBackend, // Trimite centroTrabajador ca centro dacă există
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
          'X-App-Source': (config.APP_NAME || config.COMPANY_NAME || 'Web-App').replace(/\s+/g, '-'),
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': (config.APP_NAME || config.COMPANY_NAME || 'Web-Client') + '/1.0'
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
      nr: solicitudData?.id || generateInspectionNumber(), // Folosește ID-ul cererii dacă există, altfel generează unul nou
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
      centroTrabajador: '', // Resetare centru temporar
      supervisor: user?.['NOMBRE / APELLIDOS'] || user?.name || '',
      supervisor_codigo: user?.CODIGO || user?.codigo || null, // Păstrează codigo supervizor
      puncte: [],
      type: type,
      observaciones: '',
      status: 'completada',
      codigo_empleado: '', // Resetare cod
      otraPersona: false
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
      <div className="inspecciones-form max-w-lg mx-auto">
        <section className="app-card app-card--pad text-center inspecciones-form-success">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" aria-hidden />
          <h2 className="text-lg font-bold text-gray-900 mb-1">¡Inspección Enviada!</h2>
          <p className="text-sm text-gray-600 mb-4">
            La inspección ha sido enviada al backend con FormData y los archivos adjuntos.
          </p>
          <Button type="button" variant="primary" onClick={() => setSuccess(false)}>
            Nueva Inspección
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="inspecciones-form space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      {errorNotification ? (
        <AlertBanner
          variant={errorNotification.type === 'duplicate' ? 'warning' : 'danger'}
          title={errorNotification.title}
        >
          {errorNotification.message}
          {errorNotification.details ? (
            <p className="text-xs mt-2 opacity-80">Detalles: {errorNotification.details}</p>
          ) : null}
          <div className="mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setErrorNotification(null)}>Cerrar</Button>
          </div>
        </AlertBanner>
      ) : null}

      <FormSection
        title="Datos de la Inspección"
        subtitle="Completa todos los campos obligatorios"
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Número de Inspección */}
          <div>
            <FormFieldLabel icon={Hash}>Número de Inspección *</FormFieldLabel>
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
            <FormFieldLabel icon={Calendar}>Fecha *</FormFieldLabel>
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
            <FormFieldLabel icon={Building2}>Centro de Trabajo *</FormFieldLabel>
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
                <Search className="w-4 h-4 text-gray-400" aria-hidden />
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
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                <span>Cargando centros...</span>
              </p>
            )}
            {errors.centro && <p className="text-xs text-red-600 mt-1">{errors.centro}</p>}
          </div>
          
          {/* Trabajador */}
          <div>
            <FormFieldLabel icon={User}>{isEntregaOtraPersona ? 'Receptor *' : 'Trabajador *'}</FormFieldLabel>

            {type === 'entrega-materiales' && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!formData.otraPersona}
                  onChange={(e) => handleOtraPersonaChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Otra persona (no es trabajador de la empresa)
                </span>
              </label>
            )}

            {isEntregaOtraPersona ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.trabajador.nume}
                    onChange={(e) => handleTrabajadorChange('nume', e.target.value)}
                    placeholder="Nombre completo de la persona..."
                    className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-orange-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                      errors.trabajador
                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 focus:shadow-orange-500/20'
                    }`}
                  />
                  {errors.trabajador && <p className="text-xs text-red-600 mt-1">{errors.trabajador}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">DNI / NIE *</label>
                  <input
                    type="text"
                    value={formData.trabajador.codigo}
                    onChange={(e) => handleTrabajadorChange('codigo', e.target.value)}
                    placeholder="12345678A (DNI) o X1234567A (NIE)"
                    maxLength={9}
                    className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-orange-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                      formData.trabajador.codigo?.trim()
                        ? dniNieOtraPersonaStatus === true
                          ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                          : dniNieOtraPersonaStatus === false
                            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:ring-orange-500 focus:border-orange-500'
                        : errors.trabajadorDni
                          ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300 focus:shadow-orange-500/20'
                    }`}
                  />
                  {formData.trabajador.codigo?.trim() && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                      {dniNieOtraPersonaStatus === true ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden />
                          <span className="text-green-600 font-medium">DNI/NIE español válido</span>
                        </>
                      ) : dniNieOtraPersonaStatus === false ? (
                        <>
                          <X className="w-4 h-4 text-red-600 shrink-0" aria-hidden />
                          <span className="text-red-600 font-medium">DNI/NIE español inválido</span>
                        </>
                      ) : null}
                    </div>
                  )}
                  {errors.trabajadorDni === 'required' && !formData.trabajador.codigo?.trim() && (
                    <p className="text-xs text-red-600 mt-1">DNI / NIE es obligatorio</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span>Persona externa que recibe los materiales en el centro indicado.</span>
                </p>
              </div>
            ) : (
              <>
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
              disabled={empleadosFiltrados.length === 0}
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-blue-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.trabajador 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 focus:shadow-blue-500/20'
              }`}
            >
              <option value="">
                {formData.centro 
                  ? 'Selecciona un trabajador...' 
                  : empleadosFiltrados.length > 0 
                    ? 'Selecciona un trabajador sin centro...' 
                    : 'Cargando trabajadores...'}
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
            {formData.centro && empleadosFiltrados.length === 0 && type === 'entrega-materiales' && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span>No hay empleados en este centro. Marca &quot;Otra persona&quot; para entregar a alguien externo.</span>
              </p>
            )}
            {formData.centro && empleadosFiltrados.length === 0 && type !== 'entrega-materiales' && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span>No hay empleados en este centro</span>
              </p>
            )}
            {formData.trabajador.codigo && (
              <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span>Código: {formData.trabajador.codigo}</span>
              </p>
            )}
            {errors.trabajador && <p className="text-xs text-red-600 mt-1">{errors.trabajador}</p>}
              </>
            )}
          </div>
          
          {/* Centro para trabajador sin centro (apare doar când angajatul selectat nu are centru) */}
          {formData.trabajador.nume && !formData.otraPersona && (() => {
            const selectedEmployee = empleados.find(emp => 
              (emp['NOMBRE / APELLIDOS'] || emp.name || 'Sin nombre') === formData.trabajador.nume
            );
            const tieneCentro = selectedEmployee ? empleadoTieneCentro(selectedEmployee) : false;
            
            // Afișează câmpul doar dacă angajatul nu are centru
            if (!tieneCentro) {
              return (
                <div>
                  <FormFieldLabel icon={Building2}>Centro para esta inspección (opcional)</FormFieldLabel>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Selecciona un centro para esta inspección..."
                      value={formData.centroTrabajador}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({ ...prev, centroTrabajador: value }));
                        setShowCentroDropdown(true);
                      }}
                      onFocus={() => setShowCentroDropdown(true)}
                      onBlur={() => {
                        setTimeout(() => setShowCentroDropdown(false), 200);
                      }}
                      className={`w-full px-4 py-3 pr-10 border-2 rounded-xl text-gray-800 bg-gradient-to-br from-white to-purple-50/30 focus:outline-none focus:ring-2 transition-all duration-300 shadow-md focus:shadow-xl font-medium ${
                        errors.centroTrabajador 
                          ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-300 focus:shadow-purple-500/20'
                      }`}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-lg">🔍</span>
                    </div>
                    
                    {/* Dropdown de sugerencias */}
                    {showCentroDropdown && formData.centroTrabajador && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {centros
                          .filter(centro => 
                            centro.toLowerCase().includes(formData.centroTrabajador.toLowerCase())
                          )
                          .slice(0, 10)
                          .map((centro, index) => (
                            <button
                              key={`${centro}-${index}`}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, centroTrabajador: centro }));
                                setShowCentroDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{centro}</div>
                            </button>
                          ))}
                        {centros.filter(centro => 
                          centro.toLowerCase().includes(formData.centroTrabajador.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No se encontraron centros
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Este centro se usará solo para esta inspección y no se guardará en el perfil del empleado.
                  </p>
                  {errors.centroTrabajador && <p className="text-xs text-red-600 mt-1">{errors.centroTrabajador}</p>}
                </div>
              );
            }
            return null;
          })()}
          
          {/* Ubicación con GPS - Full width en mobile */}
          <div className="md:col-span-2">
            <FormFieldLabel icon={MapPin}>Ubicación *</FormFieldLabel>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={formData.locatie}
                onChange={(e) => handleInputChange('locatie', e.target.value)}
                placeholder="Ubicación de la inspección..."
                className={`inspecciones-input flex-1 ${
                  errors.locatie 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : ''
                }`}
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] w-full sm:w-auto shrink-0"
                onClick={handleGetCurrentLocation}
                disabled={locationLoading}
                title="Obtener ubicación GPS actual"
              >
                {locationLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <MapPin className="w-4 h-4" aria-hidden />
                )}
                Obtener GPS
              </Button>
            </div>
            {locationLoading && (
              <p className="inspecciones-form-hint mt-1 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                <span>Obteniendo ubicación GPS...</span>
              </p>
            )}
            {locationError && (
              <p className="inspecciones-form-error mt-1 flex items-center gap-1">
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span>{locationError}</span>
              </p>
            )}
            {errors.locatie && <p className="text-xs text-red-600 mt-1">{errors.locatie}</p>}
          </div>
          
          {/* Inspector */}
          <div className="md:col-span-2">
            <FormFieldLabel icon={User}>Inspector *</FormFieldLabel>
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
      </FormSection>

      {/* Puntos / Materiales */}
      <FormSection
        title={type === 'entrega-materiales' ? 'Materiales' : 'Puntos de Inspección'}
        subtitle={
          type === 'limpieza'
            ? `Limpieza — ${formData.puncte.length} zonas`
            : type === 'servicios'
              ? `Servicios Auxiliares — ${formData.puncte.length} zonas`
              : type === 'entrega-materiales'
                ? `${formData.puncte.length} material${formData.puncte.length !== 1 ? 'es' : ''}`
                : `Personalizada — ${formData.puncte.length} zonas`
        }
      >
        {(type === 'personalizada' || type === 'entrega-materiales') && (
          <div className="mb-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-[44px]"
              onClick={() => setShowAddPointModal(true)}
            >
              <Plus className="w-4 h-4" aria-hidden />
              {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {formData.puncte.map((point, index) => (
            <div key={point.id} className="inspecciones-check-row">
              <span className="inspecciones-check-row__badge">
                {type === 'entrega-materiales' ? `Material ${index + 1}` : `Zona ${index + 1}`}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{point.descriere}</p>
                      {type === 'entrega-materiales' && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {point.cantitate ? (
                            <span className="inspecciones-meta-chip">
                              <Package className="w-3.5 h-3.5" aria-hidden />
                              Cantidad: {point.cantitate}
                            </span>
                          ) : null}
                          {point.precio ? (
                            <span className="inspecciones-meta-chip inspecciones-meta-chip--muted">
                              <Euro className="w-3.5 h-3.5" aria-hidden />
                              {parseFloat(point.precio).toFixed(2)} €
                            </span>
                          ) : null}
                          {point.documento ? (
                            <span className="inspecciones-meta-chip inspecciones-meta-chip--muted">
                              <FileText className="w-3.5 h-3.5" aria-hidden />
                              {point.documento.name || 'Documento adjunto'}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {point.tip && type !== 'entrega-materiales' ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Tipo: {point.tip === 'obligatoriu' ? 'Obligatorio' : 'Opcional'}
                        </p>
                      ) : null}
                    </div>
                    {(type === 'personalizada' || type === 'entrega-materiales') && point.isCustom ? (
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(point.id)}
                        className="inspecciones-icon-btn inspecciones-icon-btn--danger"
                        title={type === 'entrega-materiales' ? 'Eliminar material' : 'Eliminar punto'}
                        aria-label={type === 'entrega-materiales' ? 'Eliminar material' : 'Eliminar punto'}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Rango</label>
                  <select
                    value={point.rango}
                    onChange={(e) => handlePointChange(point.id, 'rango', parseInt(e.target.value))}
                    className="inspecciones-input w-full"
                  >
                    {RANGO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Calidad</label>
                  <select
                    value={point.calidad}
                    onChange={(e) => handlePointChange(point.id, 'calidad', parseInt(e.target.value))}
                    className="inspecciones-input w-full"
                  >
                    {RANGO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Observaciones</label>
                  <input
                    type="text"
                    value={point.observatii}
                    onChange={(e) => handlePointChange(point.id, 'observatii', e.target.value)}
                    placeholder="Observaciones opcionales..."
                    className="inspecciones-input w-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {errors.puncte ? (
          <p className="inspecciones-form-error mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>{errors.puncte}</span>
          </p>
        ) : null}
      </FormSection>

      {/* Firmas Digitales */}
      <FormSection
        title="Firmas Digitales"
        subtitle="Firma del inspector y trabajador"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureActionCard
            label="Firma del Inspector"
            signed={!!formData.inspector.semnaturaPng}
            onClick={() => openSignatureModal('inspector')}
            error={errors.inspectorSignature}
          />
          <SignatureActionCard
            label={isEntregaOtraPersona ? 'Firma del Receptor' : 'Firma del Trabajador'}
            signed={!!formData.trabajador.semnaturaPng}
            onClick={() => openSignatureModal('trabajador')}
            disabled={!formData.trabajador.nume || (isEntregaOtraPersona && dniNieOtraPersonaStatus !== true)}
            hint={
              !formData.trabajador.nume
                ? (isEntregaOtraPersona
                  ? 'Primero indica el nombre y DNI/NIE del receptor'
                  : 'Primero selecciona un trabajador')
                : undefined
            }
            error={errors.trabajadorSignature}
          />
        </div>

        {(errors.inspectorSignature || errors.trabajadorSignature) ? (
          <AlertBanner variant="warning" className="mt-4">
            Las firmas son opcionales pero recomendadas para generar un PDF completo.
          </AlertBanner>
        ) : null}
      </FormSection>

      {/* Observaciones Generales */}
      <FormSection
        title="Observaciones Generales"
        subtitle="Comentarios adicionales (opcional)"
      >
        <textarea
          value={formData.observaciones}
          onChange={(e) => handleInputChange('observaciones', e.target.value)}
          placeholder="Escribe observaciones generales sobre la inspección..."
          rows={4}
          className="inspecciones-input w-full resize-y min-h-[120px]"
        />
      </FormSection>

      {/* Footer CTA */}
      <div className="inspecciones-form-footer">
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto min-h-[44px]"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Generando PDF…
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" aria-hidden />
              Generar y previsualizar PDF
            </>
          )}
        </Button>
      </div>

      {/* Modal semnătură */}
      <Modal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        title={
          signatureType === 'inspector'
            ? 'Firma del inspector'
            : isEntregaOtraPersona
              ? 'Firma del receptor'
              : 'Firma del trabajador'
        }
        size="lg"
        showCloseButton={false}
        className="app-modal--form inspecciones-signature-modal"
        footer={(
          <div className="app-modal__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowSignatureModal(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSignatureSave}>
              Guardar firma
            </Button>
          </div>
        )}
      >
        <SignaturePadComponent
          value={signatureDraft}
          onChange={handleSignatureChange}
        />
      </Modal>

      {/* Modal add point / material */}
      <Modal
        isOpen={showAddPointModal}
        onClose={() => setShowAddPointModal(false)}
        title={type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
        size="md"
        showCloseButton={false}
        className="app-modal--form inspecciones-add-point-modal"
        footer={(
          <div className="app-modal__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddPointModal(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleAddCustomPoint}>
              {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <FormFieldLabel>
              {type === 'entrega-materiales' ? 'Descripción del Material *' : 'Descripción del Punto *'}
            </FormFieldLabel>
            <input
              type="text"
              value={newPointData.descriere}
              onChange={(e) => setNewPointData((prev) => ({ ...prev, descriere: e.target.value }))}
              placeholder={
                type === 'entrega-materiales'
                  ? 'Ej: Material de limpieza, Suministros de oficina, Herramientas...'
                  : 'Ej: Estado de las puertas, Limpieza de ventanas...'
              }
              className="app-modal__input w-full"
            />
          </div>

          {type === 'entrega-materiales' ? (
            <>
              <div>
                <FormFieldLabel>Cantidad *</FormFieldLabel>
                <input
                  type="text"
                  value={newPointData.cantitate}
                  onChange={(e) => setNewPointData((prev) => ({ ...prev, cantitate: e.target.value }))}
                  placeholder="Ej: 3, 5 unidades, 10 kg..."
                  className="app-modal__input w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Precio (€)</FormFieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPointData.precio}
                  onChange={(e) => setNewPointData((prev) => ({ ...prev, precio: e.target.value }))}
                  placeholder="Ej: 25.50, 100.00..."
                  className="app-modal__input w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Factura/Albarán (Opcional)</FormFieldLabel>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewPointData((prev) => ({ ...prev, documento: file }));
                  }}
                  className="app-modal__input w-full inspecciones-file-input"
                />
                {newPointData.documento ? (
                  <AlertBanner variant="success" className="mt-2">
                    <span className="flex items-center justify-between gap-2 w-full">
                      <span className="truncate">Archivo: {newPointData.documento.name}</span>
                      <button
                        type="button"
                        onClick={() => setNewPointData((prev) => ({ ...prev, documento: null }))}
                        className="inspecciones-icon-btn shrink-0"
                        aria-label="Eliminar archivo"
                      >
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </span>
                  </AlertBanner>
                ) : null}
              </div>
            </>
          ) : null}

          {type !== 'entrega-materiales' ? (
            <div>
              <FormFieldLabel>Tipo de Punto</FormFieldLabel>
              <select
                value={newPointData.tip}
                onChange={(e) => setNewPointData((prev) => ({ ...prev, tip: e.target.value }))}
                className="app-modal__input w-full"
              >
                <option value="obligatoriu">Obligatorio</option>
                <option value="opcional">Opcional</option>
              </select>
            </div>
          ) : null}

          <div>
            <FormFieldLabel>Observaciones Iniciales (Opcional)</FormFieldLabel>
            <textarea
              value={newPointData.observatii}
              onChange={(e) => setNewPointData((prev) => ({ ...prev, observatii: e.target.value }))}
              placeholder={
                type === 'entrega-materiales'
                  ? 'Observaciones iniciales para este material...'
                  : 'Observaciones iniciales para este punto...'
              }
              rows={3}
              className="app-modal__input w-full resize-y min-h-[96px]"
            />
          </div>
        </div>
      </Modal>

      {/* Modal previsualización PDF */}
      <Modal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Previsualización del PDF"
        size="xl"
        showCloseButton={false}
        className="app-modal--preview app-modal--form inspecciones-pdf-modal__panel"
        footer={(
          <div className="app-modal__actions inspecciones-pdf-form-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = pdfPreviewUrl;
                link.download = `inspeccion-${formData.nr}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="w-4 h-4" aria-hidden />
              Descargar PDF
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowPdfPreview(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSendInspection} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden />
                  Enviar Inspección
                </>
              )}
            </Button>
          </div>
        )}
      >
        <div className="inspecciones-pdf-modal__intro">
          <p className="text-sm font-semibold text-gray-800">PDF Generado: {formData.nr}</p>
          <p className="text-xs text-gray-600 mt-1">
            Revisa el contenido del PDF antes de enviar. Puedes descargar el PDF o enviar la inspección.
          </p>
        </div>

        <div className="inspecciones-pdf-modal__frame inspecciones-pdf-modal__frame--form">
          {isAndroid ? (
            <PDFViewerAndroid pdfUrl={pdfPreviewUrl} className="w-full h-full" />
          ) : isIOS ? (
            <object data={pdfPreviewUrl} type="application/pdf" className="inspecciones-pdf-modal__iframe">
              <div className="inspecciones-pdf-modal__state">
                <p className="mb-3 text-sm">No se puede mostrar el PDF en este visor.</p>
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="solicitud-admin-btn solicitud-admin-btn--secondary min-h-[44px]"
                >
                  Abrir el PDF en una nueva pestaña
                </a>
              </div>
            </object>
          ) : (
            <iframe src={pdfPreviewUrl} title="PDF Preview" className="inspecciones-pdf-modal__iframe" />
          )}
        </div>

        <AlertBanner variant="info" className="mt-3">
          El PDF contiene todos los datos de la inspección y se enviará en formato Base64 al backend.
        </AlertBanner>
      </Modal>
    </div>
  );
};

export default InspectionForm; 