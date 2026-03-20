import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';

import { Button, Modal, Input } from '../components/ui';

import Back3DButton from '../components/Back3DButton.jsx';

import CalendarDayCell from '../components/CalendarDayCell.jsx';

import DeclararNoPunchModal from '../components/DeclararNoPunchModal.jsx';

import { routes } from '../utils/routes.js';
import { config } from '../config/env';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import activityLogger from '../utils/activityLogger';



// Helper functions

function getDaysInMonth(month, year) {

  return new Date(year, month + 1, 0).getDate();

}



function pad2(n) { 

  return n < 10 ? '0' + n : n; 

}



function formatDateYMD(year, month, day) {

  return year + '-' + pad2(month) + '-' + pad2(day);

}



function excelDateToYYYYMM(serial) {

  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));

  const year = date.getUTCFullYear();

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;

}


function excelSerialToYMD(serial) {

  if (typeof serial !== 'number' || Number.isNaN(serial)) return null;

  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));

  const year = date.getUTCFullYear();

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;

}


function normalizeDateInput(value) {

  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {

    const year = value.getFullYear();

    const month = String(value.getMonth() + 1).padStart(2, '0');

    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  if (typeof value === 'number') {

    return excelSerialToYMD(value);

  }

  const str = String(value).trim();

  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {

    return str.slice(0, 10);

  }

  if (/^\d{4}\/\d{2}\/\d{2}/.test(str)) {

    const [year, month, day] = str.split('/');

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  }

  // Format DD/MM/YYYY sau DD-MM-YYYY (cu 2 cifre)
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(str)) {

    const [day, month, year] = str.split(/[-/]/);

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  }

  // Format D/M/YYYY sau D-M-YYYY (cu 1-2 cifre pentru zi și lună) - ex: "8/2/2026"
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {

    const [day, month, year] = str.split(/[-/]/);

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  }

  if (str.includes('T')) {

    return str.split('T')[0];

  }

  const parsed = new Date(str);

  if (!Number.isNaN(parsed.getTime())) {

    const year = parsed.getFullYear();

    const month = String(parsed.getMonth() + 1).padStart(2, '0');

    const day = String(parsed.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  return null;

}


function parseFlexibleDate(value) {

  if (value instanceof Date) {

    return Number.isNaN(value.getTime()) ? null : value;

  }

  if (typeof value === 'number') {

    const asSerial = excelSerialToYMD(value);

    if (!asSerial) return null;

    const [year, month, day] = asSerial.split('-').map(Number);

    const serialDate = new Date(year, month - 1, day);

    return Number.isNaN(serialDate.getTime()) ? null : serialDate;

  }

  const normalized = normalizeDateInput(value);

  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);

  const parsed = new Date(year, month - 1, day);

  return Number.isNaN(parsed.getTime()) ? null : parsed;

}


function toDateObject(dateStr) {

  if (!dateStr || typeof dateStr !== 'string') return null;

  const parts = dateStr.split('-').map(Number);

  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

  const [year, month, day] = parts;

  return new Date(year, month - 1, day);

}



// Funcție pentru a converti formatul numeric al lunilor în numele lunilor

function formatMonthName(monthString) {

  const [, month] = monthString.split('-').map(Number);

  const monthNames = [

    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',

    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'

  ];

  return monthNames[month - 1];

}

// Función para obtener el día actual con formato "DD MMM"
function getCurrentDayFormatted() {
  const now = new Date();
  const day = now.getDate();
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const month = monthNames[now.getMonth()];
  return `${day} ${month}`;
}



export default function CuadrantesEmpleadoPage() {

  const { user: authUser } = useAuth();
  const { getCurrentLocation, getAddressFromCoords } = useLocation();

  // const { t } = useTranslation(); // Unused variable

  const emailLogat = authUser?.['CORREO ELECTRONICO'] || authUser?.EMAIL || authUser?.email || '';

  const codigoEmpleado = authUser?.CODIGO || authUser?.codigo || '';

  const nombreEmpleado = authUser?.['NOMBRE / APELLIDOS'] || authUser?.NOMBRE || authUser?.nombre || '';

  const identidadDisplay = emailLogat || codigoEmpleado || nombreEmpleado || '';

  

  const [cuadrantesUser, setCuadrantesUser] = useState([]);
  
  // State pentru orarul asignat
  const [horarioAsignado, setHorarioAsignado] = useState(null);
  
  // State pentru horario_multicentro asignat (toate înregistrările pentru luna selectată)
  const [horarioMulticentroAsignado, setHorarioMulticentroAsignado] = useState(null);
  const [horariosMulticentroLista, setHorariosMulticentroLista] = useState([]); // Toate horarios_multicentro pentru luna selectată
  const [loadingHorarioMulticentro, setLoadingHorarioMulticentro] = useState(false);
  const lastHorarioMulticentroFetchRef = useRef({ codigo: null, month: null });
  
  // State pentru datele complete ale utilizatorului
  const [userData, setUserData] = useState(null);
  const lastBajasRequestKey = useRef('');

  const empleadoCodigo = useMemo(() => 
    String(userData?.['CODIGO'] || codigoEmpleado || '').trim(),
    [userData?.['CODIGO'], codigoEmpleado]
  );
  const empleadoNombre = useMemo(() => 
    String(
      userData?.['NOMBRE / APELLIDOS'] ||
      nombreEmpleado ||
      ''
    ).trim(),
    [userData?.['NOMBRE / APELLIDOS'], nombreEmpleado]
  );

  // Funcție pentru încărcarea datelor complete ale utilizatorului
  const fetchUserData = useCallback(async () => {
    try {
      const email = authUser?.email;
      if (!email) return;

      // Skip real data fetch in DEMO mode
      if (authUser?.isDemo) {
        setUserData(authUser);
        return;
      }

      const res = await fetch(routes.getEmpleados, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      const data = await res.json();
      const users = Array.isArray(data) ? data : [data];
      
      // Normalizo el email a lowercase y sin espacios
      const normEmail = (email || '').trim().toLowerCase();
      let found = users.find(u => ((u['CORREO ELECTRONICO'] || '').trim().toLowerCase()) === normEmail);
      if (!found && users.length > 0) {
        found = users.find(u => (u[8] || '').trim().toLowerCase() === normEmail);
      }
      
      // Mapeo robusto de campos - verificamos múltiples variaciones
      if (found) {
        const mappedUser = {
          'CODIGO': found['CODIGO'] || found.codigo || found.CODIGO || '',
          'NOMBRE / APELLIDOS': found['NOMBRE / APELLIDOS'] || found.nombre || found.NOMBRE || '',
          'CORREO ELECTRONICO': found['CORREO ELECTRONICO'] || found.email || found.EMAIL || found['CORREO ELECTRÓNICO'] || '',
          'NACIONALIDAD': found['NACIONALIDAD'] || found.nacionalidad || '',
          'DIRECCION': found['DIRECCION'] || found.direccion || found['DIRECCIÓN'] || '',
          'D.N.I. / NIE': found['D.N.I. / NIE'] || found.dni || found.DNI || found.nie || found.NIE || '',
          'SEG. SOCIAL': found['SEG. SOCIAL'] || found['SEGURIDAD SOCIAL'] || found.seguridad_social || found.seg_social || '',
          'Nº Cuenta': found['Nº Cuenta'] || found.cuenta || found.CUENTA || found.numero_cuenta || '',
          'TELEFONO': found['TELEFONO'] || found.telefono || found.TELEFONO || found.phone || '',
          'FECHA NACIMIENTO': found['FECHA NACIMIENTO'] || found.fecha_nacimiento || found.fechaNacimiento || found['FECHA DE NACIMIENTO'] || '',
          'FECHA DE ALTA': found['FECHA DE ALTA'] || found['FECHA_DE_ALTA'] || found.fecha_alta || found.fechaAlta || found.fecha_de_alta || '',
          'CENTRO TRABAJO': found['CENTRO TRABAJO'] || found.centro_trabajo || found.centroTrabajo || found.centro || '',
          'TIPO DE CONTRATO': found['TIPO DE CONTRATO'] || found.tipo_contrato || found.tipoContrato || found['TIPO_DE_CONTRATO'] || '',
          'SUELDO BRUTO MENSUAL': found['SUELDO BRUTO MENSUAL'] || found.sueldo || found.SUELDO || found.sueldo_bruto || '',
          'HORAS DE CONTRATO': found['HORAS DE CONTRATO'] || found.horas_contrato || found.horasContrato || found['HORAS_DE_CONTRATO'] || '',
          'EMPRESA': found['EMPRESA'] || found.empresa || found.EMPRESA || '',
          'GRUPO': found['GRUPO'] || found.grupo || found.GRUPO || '',
          'ESTADO': found['ESTADO'] || found.estado || found.ESTADO || '',
          'FECHA BAJA': found['FECHA BAJA'] || found.fecha_baja || found.fechaBaja || found['FECHA_BAJA'] || '',
          'Fecha Antigüedad': found['Fecha Antigüedad'] || found.fecha_antiguedad || found.fechaAntiguedad || '',
          'Antigüedad': found['Antigüedad'] || found.antiguedad || '',
        };
        setUserData(mappedUser);
      } else {
        setUserData(found);
      }
    } catch {
      // Error fetching user data
    }
  }, [authUser]);

  const [selectedLuna, setSelectedLuna] = useState(() => {

    const currentDate = new Date();

    const currentYear = currentDate.getFullYear();

    const currentMonth = currentDate.getMonth() + 1;

    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [fichajes, setFichajes] = useState([]);

  const [loadingFichajes, setLoadingFichajes] = useState(true);

  const [loadingRegularizaciones, setLoadingRegularizaciones] = useState(true);

  const [ausencias, setAusencias] = useState([]);

  const [bajasMedicas, setBajasMedicas] = useState([]);

  const [ziSelectata, setZiSelectata] = useState(null);

  const [totalOreMunca, setTotalOreMunca] = useState('');

  // State pentru aviso horarios
  const [showAvisoModal, setShowAvisoModal] = useState(false);
  // bannerDismissed și bannerStatusLoading - setter-urile sunt folosite dar state-urile nu (pentru viitor folosire)
  // eslint-disable-next-line no-unused-vars
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [bannerStatusLoading, setBannerStatusLoading] = useState(true);

  

  // State pentru rezolvarea alertelor

  const [showFichajeModal, setShowFichajeModal] = useState(false);

  const [selectedDayForFichaje, setSelectedDayForFichaje] = useState(null);

  const [fichajeType, setFichajeType] = useState('Entrada');

  const [fichajeTime, setFichajeTime] = useState('');

  const [fichajeAddress, setFichajeAddress] = useState('');

  const [submittingFichaje, setSubmittingFichaje] = useState(false);

  const [pendingFichajes, setPendingFichajes] = useState([]);

  // State pentru modal "Indicar motivo"
  const [showNoPunchModal, setShowNoPunchModal] = useState(false);
  const [selectedDayForNoPunch, setSelectedDayForNoPunch] = useState(null);

  // State pentru regularizări confirmate (din MonthlyAlerts)
  const [regularizacionesConfirmadas, setRegularizacionesConfirmadas] = useState(new Map());
  const [planFuenteMap, setPlanFuenteMap] = useState(new Map()); // Map pentru plan_fuente (fiesta, etc.)
  const [detaliiZilnice, setDetaliiZilnice] = useState([]); // Stocăm detalii_zilnice pentru a le folosi direct în calendarCells

  

  // Demo data for CuadrantesEmpleadoPage

  const setDemoCuadrantes = () => {

    const currentDate = new Date();

    const currentYear = currentDate.getFullYear();

    const currentMonth = currentDate.getMonth() + 1;

    

    const demoCuadrantes = [

      {

        LUNA: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,

        CODIGO: 'ADM001',

        NOMBRE: 'Carlos Antonio Rodríguez',

        '1': 'Mañana',

        '2': 'Mañana',

        '3': 'Mañana',

        '4': 'Tarde',

        '5': 'Tarde',

        '6': 'Libre',

        '7': 'Libre',

        '8': 'Mañana',

        '9': 'Mañana',

        '10': 'Mañana',

        '11': 'Tarde',

        '12': 'Tarde',

        '13': 'Tarde',

        '14': 'Libre',

        '15': 'Libre',

        '16': 'Mañana',

        '17': 'Mañana',

        '18': 'Mañana',

        '19': 'Tarde',

        '20': 'Tarde',

        '21': 'Tarde',

        '22': 'Libre',

        '23': 'Libre',

        '24': 'Mañana',

        '25': 'Mañana',

        '26': 'Mañana',

        '27': 'Tarde',

        '28': 'Tarde',

        '29': 'Tarde',

        '30': 'Libre',

        '31': 'Libre'

      }

    ];



    setCuadrantesUser(demoCuadrantes);

    

    // Set current month as selected

    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    setSelectedLuna(currentMonthFormatted);

  };



  // Demo data pentru toate tipurile

  const setDemoFichajes = () => {

    const currentDate = new Date();

    const currentYear = currentDate.getFullYear();

    const currentMonth = currentDate.getMonth() + 1;

    

    const demoFichajes = [

      {

        id: 'DEMO_FICHAJE_001',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,

        hora: '08:30:00',

        tipo: 'Entrada',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio Rodríguez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_002',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,

        hora: '17:30:00',

        tipo: 'Salida',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio Rodríguez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_003',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,

        hora: '08:15:00',

        tipo: 'Entrada',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio Rodríguez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_004',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,

        hora: '17:45:00',

        tipo: 'Salida',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio Rodríguez',

        ubicacion: 'Madrid Centro'

      }

    ];



    setFichajes(demoFichajes);

  };



  // Demo ausencias data

  const setDemoAusencias = () => {

    const currentYear = new Date().getFullYear();

    

    const demoAusencias = [

      {

        id: 'DEMO_AUS_001',

        tipo: 'Vacaciones',

        fecha_inicio: `${currentYear}-10-11`,

        fecha_fin: `${currentYear}-10-25`,

        FECHA_INICIO: `${currentYear}-10-11`,

        FECHA_FIN: `${currentYear}-10-25`,

        motivo: 'Vacaciones de otoño',

        duracion: '08:00:00'

      },

      {

        id: 'DEMO_AUS_002',

        tipo: 'Asunto Propio',

        fecha_inicio: `${currentYear}-10-09`,

        fecha_fin: `${currentYear}-10-10`,

        FECHA_INICIO: `${currentYear}-10-09`,

        FECHA_FIN: `${currentYear}-10-10`,

        motivo: 'Cita médica',

        duracion: '04:00:00'

      },

      {

        id: 'DEMO_AUS_003',

        tipo: 'Asunto Propio',

        fecha_inicio: `${currentYear}-10-27`,

        fecha_fin: `${currentYear}-10-30`,

        FECHA_INICIO: `${currentYear}-10-27`,

        FECHA_FIN: `${currentYear}-10-30`,

        motivo: 'Asuntos personales',

        duracion: '08:00:00'

      },

      {

        id: 'DEMO_AUS_004',

        tipo: 'Vacaciones',

        FECHA: `${currentYear}-12-23`,

        motivo: 'Vacaciones de Navidad',

        duracion: '08:00:00'

      }

    ];



    setAusencias(demoAusencias);

  };



  // OPTIMIZARE: Fetch cuadrantes și userData în paralel pentru performanță mai bună
  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      setDemoCuadrantes();
      setDemoAusencias();
      setLoading(false);
      return;
    }

    if (!codigoEmpleado && !authUser?.email) return;

    setLoading(true);
    setError('');

    // Paralelizăm request-urile critice
    const token = localStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Request 1: Cuadrantes (critic pentru calendar)
    const fetchCuadrantesPromise = codigoEmpleado ? fetch(routes.getCuadrantes, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ codigo: codigoEmpleado })
    }).then(res => res.json()).then(data => {
      const lista = Array.isArray(data) ? data : [data];
      setCuadrantesUser(lista);
      
      // Detectez luna curentă și o setez imediat
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      setSelectedLuna(currentMonthFormatted);
      
      return lista;
    }).catch(() => {
      setError('No se pudieron cargar los cuadrantes.');
      return null;
    }) : Promise.resolve(null);

    // Request 2: UserData (critic pentru alte date)
    const fetchUserDataPromise = authUser?.email ? fetchUserData().catch(() => null) : Promise.resolve(null);

    // Așteptăm ambele request-uri să se termine, apoi setăm loading false
    Promise.all([fetchCuadrantesPromise, fetchUserDataPromise]).finally(() => {
      setLoading(false);
    });
  }, [codigoEmpleado, authUser?.email, authUser?.isDemo, fetchUserData]);

  // Funcție pentru a încărca orarul asignat
  // Memoizăm și optimizăm pentru a preveni apeluri repetate
  const centroUsuario = useMemo(() => 
    userData?.['CENTRO TRABAJO'] || authUser?.['CENTRO TRABAJO'] || authUser?.centroTrabajo || authUser?.['CENTRO'] || authUser?.centro || authUser?.role || '',
    [userData?.['CENTRO TRABAJO'], authUser?.['CENTRO TRABAJO'], authUser?.centroTrabajo, authUser?.['CENTRO'], authUser?.centro, authUser?.role]
  );
  
  const grupoUsuario = useMemo(() => 
    userData?.['GRUPO'] || authUser?.['GRUPO'] || authUser?.grupo || '',
    [userData?.['GRUPO'], authUser?.['GRUPO'], authUser?.grupo]
  );
  
  // Flag pentru a preveni apeluri duplicate
  const horarioFetchedRef = useRef(false);
  
  const fetchHorarioAsignado = useCallback(async () => {
    if (!centroUsuario || !grupoUsuario || horarioFetchedRef.current) return;
    
    horarioFetchedRef.current = true;
    
    try {
      const { listSchedules } = await import('../api/schedules');
      const response = await listSchedules(null);
      
      if (response.success && Array.isArray(response.data)) {
        const horarioMatch = response.data.find(horario => 
          horario.centroNombre === centroUsuario && 
          horario.grupoNombre === grupoUsuario
        );
        
        if (horarioMatch) {
          // Verificăm dacă horarioAsignado s-a schimbat înainte de a-l seta
          setHorarioAsignado(prev => {
            if (prev?.id === horarioMatch.id) return prev; // Nu schimbăm dacă este același
            return horarioMatch;
          });
        }
      }
    } catch {
      // Error loading assigned schedule
      horarioFetchedRef.current = false; // Resetăm flag-ul în caz de eroare
    }
  }, [centroUsuario, grupoUsuario]);

  useEffect(() => {
    if (authUser && !authUser.isDemo && centroUsuario && grupoUsuario && !horarioFetchedRef.current) {
      fetchHorarioAsignado();
    }
  }, [authUser?.isDemo, centroUsuario, grupoUsuario, fetchHorarioAsignado]);

  // Funcție pentru a încărca horario_multicentro asignat
  const fetchHorarioMulticentroAsignado = useCallback(async () => {
    if (authUser?.isDemo) {
      setHorarioMulticentroAsignado(null);
      return;
    }

    const codigoParaHorario = authUser?.CODIGO || authUser?.codigo || userData?.['CODIGO'] || '';
    const emailParaHorario = authUser?.email || authUser?.EMAIL || authUser?.['CORREO ELECTRONICO'] || userData?.['CORREO ELECTRONICO'] || emailLogat || '';
    
    // Dacă nu avem nici codigo, nici email, nu putem căuta
    if (!codigoParaHorario && !emailParaHorario) {
      setHorarioMulticentroAsignado(null);
      return;
    }

    // Găsește horario_multicentro pentru luna selectată
    const selectedLunaNorm = typeof selectedLuna === 'number' 
      ? excelDateToYYYYMM(selectedLuna)
      : (typeof selectedLuna === 'string' 
        ? (() => {
            const [year, month] = selectedLuna.split('-');
            return year && month ? `${year}-${month.padStart(2, '0')}` : selectedLuna;
          })()
        : (() => {
            const currentDate = new Date();
            return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          })());
    
    // Previne re-apelurile inutile dacă codigo/email și luna nu s-au schimbat
    const identificatorActual = codigoParaHorario || emailParaHorario;
    if (lastHorarioMulticentroFetchRef.current.codigo === identificatorActual && 
        lastHorarioMulticentroFetchRef.current.month === selectedLunaNorm &&
        !loadingHorarioMulticentro) {
      return;
    }
    
    lastHorarioMulticentroFetchRef.current = { codigo: identificatorActual, month: selectedLunaNorm };
    
    setLoadingHorarioMulticentro(true);
    try {
      const token = localStorage.getItem('auth_token');
      // Construiește URL-ul cu codigo sau email
      let url = `${routes.baseUrl}/api/horarios/multicentro?mes=${selectedLunaNorm}`;
      if (codigoParaHorario) {
        url += `&codigo=${encodeURIComponent(codigoParaHorario)}`;
      } else if (emailParaHorario) {
        url += `&email=${encodeURIComponent(emailParaHorario)}`;
      }
      
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      if (!res.ok) {
        setHorarioMulticentroAsignado(null);
        return;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setHorarioMulticentroAsignado(null);
        return;
      }

      const data = await res.json();
      const lista = Array.isArray(data.horarios) ? data.horarios : [];
      
      if (lista.length > 0) {
        // Filtrează toate horarios_multicentro pentru luna selectată
        const horariosForMonth = lista.filter(horario => {
          const horarioLuna = horario.LUNA || horario.luna;
          const horarioLunaNorm = typeof horarioLuna === 'number' 
            ? excelDateToYYYYMM(horarioLuna)
            : (typeof horarioLuna === 'string' 
              ? (() => {
                  const [year, month] = horarioLuna.split('-');
                  return year && month ? `${year}-${month.padStart(2, '0')}` : horarioLuna;
                })()
              : '');
          return horarioLunaNorm === selectedLunaNorm;
        });
        
        if (horariosForMonth.length > 0) {
          // Stochează toate horarios_multicentro pentru luna selectată
          setHorariosMulticentroLista(horariosForMonth);
          
          // Găsește horario_multicentro care are orar pentru ziua curentă (dacă este luna curentă)
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;
          const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          
          let horarioForCurrentDay = null;
          if (selectedLunaNorm === currentMonthFormatted) {
            const today = new Date().getDate();
            const dayKey = `ZI_${today}`;
            
            // Găsește primul horario_multicentro care are orar pentru ziua curentă (nu LIBRE)
            horarioForCurrentDay = horariosForMonth.find(horario => {
              const daySchedule = horario[dayKey] || horario[dayKey.toLowerCase()] || horario[dayKey.toUpperCase()];
              if (daySchedule) {
                const trimmed = String(daySchedule).trim();
                return trimmed !== '' && trimmed !== 'LIBRE' && trimmed !== '0' && trimmed !== '0h';
              }
              return false;
            });
          }
          
          // Folosește horario-ul pentru ziua curentă dacă există, altfel folosește primul din listă
          setHorarioMulticentroAsignado(horarioForCurrentDay || horariosForMonth[0]);
        } else {
          setHorariosMulticentroLista([]);
          setHorarioMulticentroAsignado(null);
        }
      } else {
        setHorariosMulticentroLista([]);
        setHorarioMulticentroAsignado(null);
      }
    } catch (error) {
      console.error('Eroare la încărcarea horario_multicentro asignat:', error);
      setHorarioMulticentroAsignado(null);
    } finally {
      setLoadingHorarioMulticentro(false);
    }
  }, [authUser, userData, selectedLuna, loadingHorarioMulticentro]);

  // Încarcă horario_multicentro când se schimbă utilizatorul sau luna selectată
  useEffect(() => {
    if (authUser?.isDemo) return;
    
    const codigoParaHorario = authUser?.CODIGO || authUser?.codigo || userData?.['CODIGO'] || '';
    const emailParaHorario = authUser?.email || authUser?.EMAIL || authUser?.['CORREO ELECTRONICO'] || userData?.['CORREO ELECTRONICO'] || emailLogat || '';
    
    // Dacă avem codigo sau email și luna selectată, încărcăm horario_multicentro
    if (authUser && selectedLuna && (codigoParaHorario || emailParaHorario)) {
      fetchHorarioMulticentroAsignado();
    }
  }, [authUser, userData, selectedLuna, emailLogat, fetchHorarioMulticentroAsignado]);

  // Fetch fichajes pentru angajatul curent

  useEffect(() => {

    // Skip real data fetch in DEMO mode

    if (authUser?.isDemo) {

      setDemoFichajes();

      setLoadingFichajes(false);

      return;

    }



    async function fetchFichajes() {
      const codigoParaFichajes = codigoEmpleado || authUser?.CODIGO || authUser?.codigo || userData?.['CODIGO'] || '';
      if (!codigoParaFichajes || !selectedLuna) return;

      setLoadingFichajes(true);

      try {


        

        // Normalizez luna selectată pentru a o trimite la backend

        let selectedLunaNorm = selectedLuna;

        if (typeof selectedLuna === 'number') {

          selectedLunaNorm = excelDateToYYYYMM(selectedLuna);

        } else if (typeof selectedLuna === 'string') {

          // Asigur că luna are formatul corect YYYY-MM

          const [year, month] = selectedLuna.split('-');

          if (year && month) {

            selectedLunaNorm = `${year}-${month.padStart(2, '0')}`;

          }

        }


        

        // Folosim backend-ul nou pentru registros/fichajes (nu n8n)
        const fichajesEndpoint = routes.getRegistros;
        // Backend-ul folosește CODIGO și MES (cu majuscule)
        const separator = fichajesEndpoint.includes('?') ? '&' : '?';
        const fichajesUrl = `${fichajesEndpoint}${separator}CODIGO=${encodeURIComponent(codigoParaFichajes)}&MES=${encodeURIComponent(selectedLunaNorm)}`;
        
        const token = localStorage.getItem('auth_token');
        const fetchHeaders = {};
        if (token) {
          fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(fichajesUrl, {
          headers: fetchHeaders
        });

        const data = await res.json();

        // Asigură că data este întotdeauna un array
        const fichajesUser = Array.isArray(data) ? data : (data ? [data] : []);

        // Nu mai trebuie să filtrăm în frontend, backend-ul returnează deja doar luna selectată

        setFichajes(fichajesUser);

      } catch {

        setFichajes([]);

      } finally {

        setLoadingFichajes(false);

      }

    }

    

    fetchFichajes();

  }, [codigoEmpleado, selectedLuna, authUser?.isDemo]);



  // OPTIMIZARE: Lazy load regularizaciones - se încarcă după ce calendarul e afișat
  useEffect(() => {
    if (authUser?.isDemo) {
      return;
    }

    // Lazy load: așteptăm ca pagina principală să fie încărcată
    if (loading) {
      return;
    }

    async function fetchRegularizacionesConfirmadas() {
      if (!codigoEmpleado || !selectedLuna) return;

      setLoadingRegularizaciones(true);
      // Fetch regularizaciones

      // Normalizez luna selectată (la fel ca în codul principal)
      let selectedLunaNorm = selectedLuna;
      if (typeof selectedLuna === 'number') {
        selectedLunaNorm = excelDateToYYYYMM(selectedLuna);
      } else if (typeof selectedLuna === 'string') {
        const [year, month] = selectedLuna.split('-');
        if (year && month) {
          selectedLunaNorm = `${year}-${month.padStart(2, '0')}`;
        }
      }

      try {
        const token = localStorage.getItem('auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `${routes.getMonthlyAlertsResumen}?tipo=mensual&lunaselectata=${selectedLunaNorm}&t=${Date.now()}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          setRegularizacionesConfirmadas(new Map());
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          setRegularizacionesConfirmadas(new Map());
          return;
        }

        // Găsim empleado-ul curent
        const empleado = data.find(emp => {
          const codigo = emp.CODIGO || emp.codigo || emp.empleadoId || emp.id;
          return `${codigo}` === `${codigoEmpleado}`;
        });

        if (!empleado) {
          setRegularizacionesConfirmadas(new Map());
          return;
        }

        // Extragem detalii_zilnice
        let detalii = empleado.detalii_zilnice || empleado.detaliiZilnice || [];
        if (typeof detalii === 'string') {
          try {
            detalii = JSON.parse(detalii);
          } catch {
            detalii = [];
          }
        }

        if (!Array.isArray(detalii)) {
          detalii = [];
        }

        // Creează un Map cu zilele care au regularizare confirmată
        const regularizacionesMap = new Map();
        // Creează un Map cu plan_fuente pentru fiecare zi (pentru fiesta, etc.)
        const planFuenteMapLocal = new Map();
        detalii.forEach(d => {
          if (d?.fecha) {
            const fechaStr = typeof d.fecha === 'string' ? d.fecha.split('T')[0] : d.fecha;
            
            // Verifică regularizare confirmată
            if (d?.has_regularizacion_confirmada === 1 || 
                d?.has_regularizacion_confirmada === true || 
                d?.has_regularizacion_confirmada === '1') {
              regularizacionesMap.set(fechaStr, true);
            }
            
            // Extrage plan_fuente (fiesta, cuadrante, horario, etc.)
            if (d?.plan_fuente) {
              planFuenteMapLocal.set(fechaStr, d.plan_fuente);
            }
          }
        });

        setRegularizacionesConfirmadas(regularizacionesMap);
        setPlanFuenteMap(planFuenteMapLocal);
        setDetaliiZilnice(detalii); // Stocăm detalii_zilnice pentru a le folosi direct în calendarCells
      } catch {
        setRegularizacionesConfirmadas(new Map());
      } finally {
        setLoadingRegularizaciones(false);
      }
    }

    // Delay mic pentru a nu bloca render-ul calendarului
    const timeoutId = setTimeout(() => {
      fetchRegularizacionesConfirmadas();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [codigoEmpleado, selectedLuna, authUser?.isDemo, loading]);

  // OPTIMIZARE: Banner check după ce pagina e afișată (lazy load)
  useEffect(() => {
    // Lazy load: așteptăm ca pagina principală să fie încărcată
    if (loading) {
      return;
    }

    if (!authUser?.CODIGO && !authUser?.email && !authUser?.CORREO_ELECTRONICO) return;
    
    const checkBannerStatus = async () => {
      setBannerStatusLoading(true);
      try {
        const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';
        const token = localStorage.getItem('auth_token');
        
        const userEmail = authUser?.email || authUser?.CORREO_ELECTRONICO;
        const userCodigo = authUser?.CODIGO || authUser?.codigo;
        
        if (!userEmail && !userCodigo) {
          setBannerStatusLoading(false);
          return;
        }
        
        const queryParams = new URLSearchParams();
        if (userEmail) queryParams.append('email', userEmail);
        if (userCodigo) queryParams.append('codigo', userCodigo);
        
        const response = await fetch(`${baseUrl}/api/monitoring/banner-horarios-status?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setBannerDismissed(data.dismissed || false);
          // Dacă nu a fost dismissat, arată modal-ul
          if (!data.dismissed) {
            setShowAvisoModal(true);
          }
        } else {
          // Fallback la localStorage
          const localDismissed = localStorage.getItem('avisoHorariosAceptado') === 'true';
          setBannerDismissed(localDismissed);
          if (!localDismissed) {
            setShowAvisoModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking banner status:', error);
        // Fallback la localStorage
        const localDismissed = localStorage.getItem('avisoHorariosAceptado') === 'true';
        setBannerDismissed(localDismissed);
        if (!localDismissed) {
          setShowAvisoModal(true);
        }
      } finally {
        setBannerStatusLoading(false);
      }
    };
    
    // Delay mic pentru a nu bloca render-ul calendarului
    const timeoutId = setTimeout(() => {
      checkBannerStatus();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [authUser?.email, authUser?.CORREO_ELECTRONICO, authUser?.CODIGO, authUser?.codigo, loading]);

  // Handler pentru închidere modal fără salvare (X button)
  const handleCerrarAviso = () => {
    setShowAvisoModal(false);
    // Nu salvează - modal-ul va apărea din nou la următoarea intrare
  };

  // Handler pentru acceptare aviso (buton Aceptar)
  const handleAceptarAviso = async () => {
    setBannerDismissed(true);
    setShowAvisoModal(false);
    
    // Fallback la localStorage
    localStorage.setItem('avisoHorariosAceptado', 'true');
    
    // Log acțiunea în BD
    if (authUser) {
      try {
        await activityLogger.logBannerHorariosDismissed(authUser);
      } catch (error) {
        console.error('Error logging banner dismissal:', error);
      }
    }
  };

  // OPTIMIZARE: Lazy load ausencias - se încarcă după ce calendarul e afișat (loading = false)
  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      return;
    }

    // Lazy load: așteptăm ca pagina principală să fie încărcată
    if (loading) {
      return;
    }

    async function fetchAusencias() {
      try {
        // Folosim userData în loc de authUser pentru a avea acces la CODIGO
        const userCode = userData?.['CODIGO'] || authUser?.['CODIGO'] || authUser?.codigo || '';
        
        if (!userCode) {
          return;
        }

        // Folosim backend-ul nou pentru ausencias (nu n8n)
        const baseAusenciasUrl = routes.getAusencias;
        const ausenciasSeparator = baseAusenciasUrl.includes('?') ? '&' : '?';
        const url = `${baseAusenciasUrl}${ausenciasSeparator}codigo=${encodeURIComponent(userCode)}`;

        const token = localStorage.getItem('auth_token');
        const fetchHeaders = {};
        if (token) {
          fetchHeaders['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          headers: fetchHeaders
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const ausenciasData = Array.isArray(result) ? result : [result];
        setAusencias(ausenciasData);
      } catch {
        setAusencias([]);
      }
    }
    
    // Delay mic pentru a nu bloca render-ul calendarului
    const timeoutId = setTimeout(() => {
      fetchAusencias();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [authUser?.isDemo, userData?.['CODIGO'], authUser?.['CODIGO'], authUser?.codigo, loading]);



  // OPTIMIZARE: Lazy load bajas médicas - se încarcă după ce calendarul e afișat
  useEffect(() => {
    if (authUser?.isDemo) {
      setBajasMedicas([]);
      lastBajasRequestKey.current = 'demo';
      return;
    }

    // Lazy load: așteptăm ca pagina principală să fie încărcată
    if (loading) {
      return;
    }

    const endpoint = routes.getBajasMedicas;

    if (!endpoint || (!empleadoCodigo && !empleadoNombre)) {
      return;
    }

    const requestKey = `${empleadoCodigo}|${empleadoNombre}`.toLowerCase();

    if (lastBajasRequestKey.current === requestKey) {
      return;
    }

    const controller = new AbortController();



    async function fetchBajasMedicasEmpleado() {

      try {

        // Backend-ul folosește GET cu query param codigo (nu POST cu accion=get)
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${endpoint}${separator}codigo=${encodeURIComponent(empleadoCodigo)}`;

        const token = localStorage.getItem('auth_token');
        const headers = {
          'X-App-Source': 'DeCamino-Web-App'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {

          method: 'GET',

          headers: headers,

          signal: controller.signal

        });



        if (!response.ok) {

          throw new Error(`HTTP ${response.status}`);

        }



        const result = await response.json();

        // Backend-ul returnează direct array (nu {data: [...]})
        const lista = Array.isArray(result)
          ? result
          : (result?.data && Array.isArray(result.data))
            ? result.data

          : Array.isArray(result)

          ? result

          : [];



        const codigoNormalizat = empleadoCodigo.trim();

        const nombreNormalizat = empleadoNombre.toLowerCase();

        const filtradas = lista.filter((item) => {

          const itemCodigo =

            item?.Codigo_Empleado ||

            item?.codigo_empleado ||

            item?.codigoEmpleado ||

            item?.['Código Empleado'] ||

            item?.codigo ||

            '';

          const itemNombre = String(

            item?.Trabajador ||

            item?.trabajador ||

            item?.['Nombre empleado'] ||

            item?.['Nombre Empleado'] ||

            ''

          )

            .trim()

            .toLowerCase();



          const coincideCodigo = codigoNormalizat && String(itemCodigo).trim() === codigoNormalizat;

          const coincideNombre = nombreNormalizat && itemNombre === nombreNormalizat;



          return coincideCodigo || coincideNombre;

        });



        setBajasMedicas(filtradas.length > 0 ? filtradas : lista);

        lastBajasRequestKey.current = requestKey;

      } catch (error) {

        if (error?.name === 'AbortError') return;

        setBajasMedicas([]);

      }

    }



    // Delay mic pentru a nu bloca render-ul calendarului
    const timeoutId = setTimeout(() => {
      fetchBajasMedicasEmpleado();
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [authUser?.isDemo, empleadoCodigo, empleadoNombre, loading]);



  // Normalizez luna selectată pentru afișare

  let selectedLunaNorm = selectedLuna;

  if (typeof selectedLuna === 'number') {

    selectedLunaNorm = excelDateToYYYYMM(selectedLuna);

  } else if (typeof selectedLuna === 'string') {

    // Asigur că luna are formatul corect YYYY-MM

    const [year, month] = selectedLuna.split('-');

    if (year && month) {

      selectedLunaNorm = `${year}-${month.padStart(2, '0')}`;

    }

  }



  // Găsesc cuadrantele pentru luna selectată și utilizatorul curent
  // IMPORTANT: Filtrează doar cuadrantele vizibile (visible === true)

  const cuadrant = cuadrantesUser.find(c => {

    let luna = c.LUNA || c.luna;

    if (typeof luna === 'number') luna = excelDateToYYYYMM(luna);
    
    // Verifică dacă luna se potrivește
    const lunaMatch = luna === selectedLunaNorm;
    
    // Verifică dacă cuadrantul este pentru utilizatorul curent
    const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailLogat.toLowerCase();
    const codigoMatch = (c.CODIGO || '').trim() === codigoEmpleado.trim();
    const nombreMatch = (c.NOMBRE || '').trim() === nombreEmpleado.trim();
    
    // Verifică dacă cuadrantul este vizibil
    // MySQL returnează 1/0 (number) sau true/false (boolean)
    // Compatibilitate: undefined/null = vizibil (pentru cuadrante vechi)
    const visibleValue = c.visible;
    
    // Conversie robustă: orice valoare "truthy" sau undefined/null = vizibil
    // Excludem explicit: false, 0, '0', 'false'
    let isVisible = true; // Default: vizibil (pentru compatibilitate cu cuadrante vechi)
    
    if (visibleValue !== undefined && visibleValue !== null) {
      // Dacă este boolean
      if (typeof visibleValue === 'boolean') {
        isVisible = visibleValue === true;
      }
      // Dacă este number (MySQL returnează 1/0)
      else if (typeof visibleValue === 'number') {
        isVisible = visibleValue === 1;
      }
      // Dacă este string
      else if (typeof visibleValue === 'string') {
        isVisible = visibleValue === '1' || visibleValue.toLowerCase() === 'true';
      }
    }
    
    // Debug logging pentru a vedea ce se întâmplă
    if (lunaMatch && (emailMatch || codigoMatch || nombreMatch)) {
      console.log('🔍 Cuadrante found for user:', {
        CODIGO: c.CODIGO,
        LUNA: luna,
        EMAIL: c.EMAIL,
        emailLogat: emailLogat,
        codigoEmpleado: codigoEmpleado,
        visible: visibleValue,
        visibleType: typeof visibleValue,
        visibleValueString: String(visibleValue),
        isVisible: isVisible,
        emailMatch,
        codigoMatch,
        nombreMatch,
        lunaMatch,
        willMatch: lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible,
        finalResult: lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible ? '✅ MATCH' : '❌ NO MATCH'
      });
    }
    
    // Verificare cuadrant
    
    return lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible;

  });

  // Verifică dacă luna selectată este în viitor (după luna curentă)
  const isFutureMonth = useMemo(() => {
    if (!selectedLunaNorm || typeof selectedLunaNorm !== 'string' || !selectedLunaNorm.includes('-')) return false;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    // Compară luna selectată cu luna curentă
    return selectedLunaNorm > currentMonthFormatted;
  }, [selectedLunaNorm]);

  // Verifică dacă există date pentru luna selectată (cuadrante, horario_multicentro sau horario normal)
  // IMPORTANT: Pentru lunile viitoare, afișăm cuadrantul dacă este vizibil (visible === true)
  // Dacă nu există cuadrante vizibil pentru luna viitoare, afișăm mesajul "pendiente de generación"
  const hasDataForMonth = cuadrant || 
                          (horariosMulticentroLista && horariosMulticentroLista.length > 0) || 
                          horarioAsignado ||
                          // Pentru lunile viitoare, dacă există cuadrante vizibil, îl afișăm
                          (isFutureMonth && cuadrant);



  // Generez lista de luni disponibile din cuadrantes + luni curente

  const luniDinCuadrantes = [...new Set(cuadrantesUser.map(c => {

    let luna = c.LUNA || c.luna;

    if (typeof luna === 'number') luna = excelDateToYYYYMM(luna);

    if (typeof luna === 'string') {

      // Asigur că luna are formatul corect YYYY-MM

      const [year, month] = luna.split('-');

      if (year && month) {

        luna = `${year}-${month.padStart(2, '0')}`;

      }

    }

    return luna;

  }))];



  // Adaug luniile curente: decembrie anul anterior + toate lunile din anul curent

  const currentDate = new Date();

  const currentYear = currentDate.getFullYear();

  const previousYear = currentYear - 1;

  

  const luniCurente = [];

  

  // Adaug ultimele 3 luni din anul anterior: octombrie, noiembrie, decembrie

  for (let month = 10; month <= 12; month++) {

    const yearMonth = `${previousYear}-${String(month).padStart(2, '0')}`;

    luniCurente.push(yearMonth);

  }

  

  // Adaug toate lunile din anul curent (enero = 1 până la decembrie = 12)

  for (let month = 1; month <= 12; month++) {

    const yearMonth = `${currentYear}-${String(month).padStart(2, '0')}`;

    luniCurente.push(yearMonth);

  }

  

  // Combin luniile din cuadrantes cu cele curente și elimin duplicatele

  const luniDisponibileRaw = [...new Set([...luniDinCuadrantes, ...luniCurente])];

  // Găsește horario_multicentro pentru ziua curentă și calculează orarul
  const currentDayHorarioMulticentro = useMemo(() => {
    if (!horariosMulticentroLista || horariosMulticentroLista.length === 0) return null;
    
    // Verifică dacă este luna curentă
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    if (selectedLunaNorm !== currentMonthFormatted) {
      return null;
    }
    
    const today = new Date().getDate();
    const dayKey = `ZI_${today}`;
    
    // Găsește horario_multicentro care are orar pentru ziua curentă
    const horarioForToday = horariosMulticentroLista.find(horario => {
      const daySchedule = horario[dayKey] || horario[dayKey.toLowerCase()] || horario[dayKey.toUpperCase()];
      if (daySchedule) {
        const trimmed = String(daySchedule).trim();
        return trimmed !== '' && trimmed !== 'LIBRE' && trimmed !== '0' && trimmed !== '0h';
      }
      return false;
    });
    
    return horarioForToday || null;
  }, [horariosMulticentroLista, selectedLunaNorm]);
  
  // Calculează orarul zilei curente din horario_multicentro pentru ziua curentă
  const currentDayScheduleFromHorarioMulticentro = useMemo(() => {
    if (!currentDayHorarioMulticentro) return null;
    
    const today = new Date().getDate();
    const dayKey = `ZI_${today}`;
    const daySchedule = currentDayHorarioMulticentro[dayKey] || currentDayHorarioMulticentro[dayKey.toLowerCase()] || currentDayHorarioMulticentro[dayKey.toUpperCase()];
    
    if (!daySchedule) {
      return null;
    }
    
    const dayScheduleStr = String(daySchedule).trim();
    
    // Verifică dacă este LIBRE sau goală
    if (dayScheduleStr === '' || dayScheduleStr.toUpperCase() === 'LIBRE' || dayScheduleStr === '0' || dayScheduleStr === '0h') {
      return null;
    }
    
    // Verifică dacă este un format cu timp (ex: "08:00-17:00" sau "T1 08:00-17:00")
    if (dayScheduleStr.includes('-') && dayScheduleStr.match(/\d{1,2}:\d{2}/)) {
      const match = dayScheduleStr.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
      }
      // Dacă nu găsește match complet, returnează valoarea originală fără prefix T1/T2/T3
      const cleaned = dayScheduleStr.replace(/^T[123]\s*/, '').trim();
      if (cleaned && cleaned !== dayScheduleStr) {
        return cleaned;
      }
      return dayScheduleStr;
    }
    
    // Verifică dacă este un număr (ore)
    if (!isNaN(parseFloat(dayScheduleStr))) {
      const hours = parseFloat(dayScheduleStr);
      return `${hours}h`;
    }
    
    // Pentru orice alt format (ex: "TURNO DIA", "T1", etc.), returnează ca atare
    // dar doar dacă nu este "LIBRE" sau goală
    if (dayScheduleStr && dayScheduleStr.length > 0) {
      // Dacă începe cu T1/T2/T3, returnează fără prefix
      const cleaned = dayScheduleStr.replace(/^T[123]\s*/, '').trim();
      return cleaned || dayScheduleStr;
    }
    
    return null;
  }, [currentDayHorarioMulticentro]);

  

  // Filtrez doar luniile relevante: ultimele 3 luni din anul anterior + toate lunile din anul curent

  // Și le sortez cronologic

  const luniDisponibile = luniDisponibileRaw.filter(luna => {

    const [year, month] = luna.split('-').map(Number);

    // Include ultimele 3 luni din anul anterior (octombrie, noiembrie, decembrie)
    if (year === previousYear && month >= 10 && month <= 12) return true;
    // Include toate lunile din anul curent
    if (year === currentYear && month >= 1 && month <= 12) return true;
    return false;
  }).sort((a, b) => {

    const [yearA, monthA] = a.split('-').map(Number);

    const [yearB, monthB] = b.split('-').map(Number);

    

    // Sortăm cronologic (an, apoi lună)

    if (yearA !== yearB) return yearA - yearB;

    return monthA - monthB;

  });

  

  const isLunaValida = typeof selectedLunaNorm === 'string' && selectedLunaNorm.includes('-');

  

  // Definim zilele săptămânii

  const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];



const getFirstValueWithSource = (record, keys) => {

  for (const key of keys) {

    if (record?.[key] !== undefined && record?.[key] !== null && String(record?.[key]).trim() !== '') {

      return { value: record[key], key };

    }

  }

  return { value: null, key: null };

};



const getFirstValue = (record, keys) => {

  return getFirstValueWithSource(record, keys).value;

};



  const bajasCalendar = bajasMedicas

    .map((baja) => {

      if (!baja || typeof baja !== 'object') return null;

      const rangeRaw = getFirstValue(baja, ['FECHA', 'Fecha']);

      let inicioRaw = getFirstValue(baja, [

        'FECHA_INICIO',

        'fecha_inicio',

        'fechaInicio',

        'Fecha baja',

        'Fecha Baja',

        'fecha_baja',

        'fechaBaja',

        'FECHA BAJA',

        'fechaBajaInicio'

      ]);

      const actualEnd = getFirstValueWithSource(baja, [

        'FECHA_FIN',

        'fecha_fin',

        'fechaFin',

        'Fecha alta',

        'Fecha Alta',

        'fecha_alta',

        'fechaAlta',

        'FECHA ALTA',

        'fechaBajaFin'

      ]);

      let finRaw = actualEnd.value;

      let endSource = actualEnd.key ? 'actual' : null;

      if (!finRaw) {

        const predictedEnd = getFirstValueWithSource(baja, [

          'Fecha de alta prevista SPS',

          'Fecha de alta prevista',

          'Fecha alta prevista',

          'fecha_alta_prevista',

          'fechaAltaPrevista',

          'fecha_alta_prevista_sps',

          'fechaAltaPrevistaSps'

        ]);

        finRaw = predictedEnd.value;

        endSource = predictedEnd.key ? 'predicted' : endSource;

      }



      if ((!inicioRaw || !finRaw) && typeof rangeRaw === 'string' && rangeRaw.includes(' - ')) {

        const [inicioRango, finRango] = rangeRaw.split(' - ');

        if (!inicioRaw) inicioRaw = inicioRango;

        if (!finRaw) finRaw = finRango;

      }



      const inicio = normalizeDateInput(inicioRaw);

      const today = new Date();

      let finNormalizat = normalizeDateInput(finRaw);

      if (!finNormalizat) {

        finNormalizat = normalizeDateInput(today);

        endSource = 'open';

      }

      if (endSource === 'predicted') {

        const predictedDate = toDateObject(finNormalizat);

        if (predictedDate && predictedDate < today) {

          finNormalizat = normalizeDateInput(today);

          endSource = 'open';

        }

      }



      if (!inicio) return null;

      const startObj = toDateObject(inicio);

      const endObj = toDateObject(finNormalizat);

      if (!startObj || !endObj) return null;

      const [rangeStart, rangeEnd] = startObj.getTime() <= endObj.getTime()

        ? [startObj, endObj]

        : [endObj, startObj];



      const situacion =

        baja?.['Situación'] ||

        baja?.Situacion ||

        baja?.situacion ||

        baja?.estado ||

        '';



      const motivo =

        situacion ||

        baja?.motivo ||

        baja?.['Motivo'] ||

        'Baja médica';



      return {

        startDate: inicio,

        endDate: finNormalizat,

        start: rangeStart,

        end: rangeEnd,

        situacion,

        motivo,

        raw: baja

      };

    })

    .filter(Boolean);



  // Generez celulele pentru calendar
  // Folosim useMemo pentru a preveni recalculări inutile și re-render-uri în cascadă
  const calendarCells = useMemo(() => {
    const cells = [];
    
    if (!isLunaValida) return cells;

    const [year, month] = selectedLunaNorm.split('-').map(Number);

    const daysInMonth = getDaysInMonth(month - 1, year);

    

    // Găsesc prima zi a lunii (0 = duminică, 1 = luni, etc.)

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Convertesc la luni = 0

    

    // Adaug celule goale pentru zilele din luna anterioară

    for (let i = 0; i < startDay; i++) {

      cells.push(null);

    }

    

    // Adaug zilele lunii

    let day = 1;

    for (let i = 0; i < daysInMonth; i++) {

      const dataZi = formatDateYMD(year, month, day);

      if (day === 3) {
        // Calculare celulă pentru day 3
      }

      const fechaZi = new Date(year, month - 1, day);

      

      // Verifică absențe și solicitări pentru această zi (prioritate)

      let tip = 'LIBRE';

      let orar = '';

      let motivoAusencia = '';

      let bajaCalendar = null;
      
      // Pentru horario_multicentro, adăugăm informația despre orele programate (ZI_X) pentru această zi
      let horarioMulticentroHours = null;



      if (bajasCalendar.length > 0) {

        bajaCalendar = bajasCalendar.find((baja) => {

          if (!baja?.start || !baja?.end) return false;

          return fechaZi >= baja.start && fechaZi <= baja.end;

        }) || null;

      }

      

      // Caută în ausencias (prioritate 1) - suportă și intervale de date
      // Sortăm lista pentru a priorita înregistrările cu intervale mai mici (mai specifice)
      const ausenciasSorted = [...ausencias].sort((a, b) => {
        const aInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;
        const aFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;
        const bInicio = b.fecha_inicio || b.fechaInicio || b.FECHA_INICIO;
        const bFin = b.fecha_fin || b.fechaFin || b.FECHA_FIN;
        
        const aInicioDate = parseFlexibleDate(aInicio);
        const aFinDate = parseFlexibleDate(aFin);
        const bInicioDate = parseFlexibleDate(bInicio);
        const bFinDate = parseFlexibleDate(bFin);
        
        // Calculează durata intervalului
        const aDuration = aInicioDate && aFinDate ? aFinDate - aInicioDate : Infinity;
        const bDuration = bInicioDate && bFinDate ? bFinDate - bInicioDate : Infinity;
        
        // Prioritizează intervalele mai mici (mai specifice)
        return aDuration - bDuration;
      });

      const ausenciaZi = bajaCalendar
        ? null
        : ausenciasSorted.find(a => {

        const ausenciaFecha = a.FECHA || a.fecha || a.data;

        const fechaInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;

        const fechaFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;

        const fechaZi = new Date(dataZi);

        

        // Debug pentru prima zi din interval

        if (day === 9 || day === 11) {
          // DEBUG Day
        }

        

        // Verifică data exactă (pentru zile individuale)

        if (ausenciaFecha && ausenciaFecha.startsWith(dataZi)) {


          return true;

        }

        

        // Verifică interval de date (pentru perioade)
        // Încearcă mai întâi fecha_inicio/fecha_fin, apoi extrage din FECHA
        let inicio, fin;
        
        if (fechaInicio && fechaFin) {
          inicio = parseFlexibleDate(fechaInicio);
          fin = parseFlexibleDate(fechaFin);
        } else if (ausenciaFecha && ausenciaFecha.includes(' - ')) {
          // Extrage intervalul din FECHA (ex: "2025-10-09 - 2025-10-10")
          const [fechaInicioStr, fechaFinStr] = ausenciaFecha.split(' - ');
          inicio = parseFlexibleDate(fechaInicioStr);
          fin = parseFlexibleDate(fechaFinStr);
        }

        if (inicio && fin) {
          // Normalizează ambele date la începutul zilei (00:00:00) pentru comparare corectă
          const inicioNormalizat = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
          // Setează fin la sfârșitul zilei (23:59:59.999) pentru a include ziua de sfârșit
          const finNormalizat = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59, 999);
          const fechaZiNormalizat = new Date(fechaZi.getFullYear(), fechaZi.getMonth(), fechaZi.getDate());
          
          const isInRange = fechaZiNormalizat >= inicioNormalizat && fechaZiNormalizat <= finNormalizat;

          

          if (day === 9 || day === 11) {
            // Range check
          }

          

          if (isInRange) {


            return true;

          }

        }

        

        return false;

      });

      

      // Eliminată verificarea separată — vacanțele și asuntos propio sunt tratate în ausencias

      

      // Determină tipul zilei
      // Verifică plan_fuente din backend pentru fiesta (prioritate după bajaCalendar și ausenciaZi)
      // Folosim detaliiZilnice direct dacă planFuenteMap este încă gol (pentru a evita flickering)
      let planFuente = planFuenteMap.get(dataZi);
      if (!planFuente && Array.isArray(detaliiZilnice) && detaliiZilnice.length > 0) {
        const detalleZi = detaliiZilnice.find(d => {
          const fechaStr = typeof d?.fecha === 'string' ? d.fecha.split('T')[0] : d?.fecha;
          return fechaStr === dataZi;
        });
        if (detalleZi?.plan_fuente) {
          planFuente = detalleZi.plan_fuente;
        }
      }
      
      // LOG pentru ziua 1
      if (day === 1) {
        console.log('🔍 [DAY 1] Calcul calendarCells:', {
          dataZi,
          planFuenteFromMap: planFuenteMap.get(dataZi),
          planFuente,
          detaliiZilniceLength: detaliiZilnice?.length || 0,
          loadingRegularizaciones,
          hasDetalleZi: Array.isArray(detaliiZilnice) && detaliiZilnice.length > 0 ? detaliiZilnice.find(d => {
            const fechaStr = typeof d?.fecha === 'string' ? d.fecha.split('T')[0] : d?.fecha;
            return fechaStr === dataZi;
          }) : null
        });
      }

      if (bajaCalendar) {

        tip = 'Baja Médica';

        motivoAusencia = bajaCalendar.motivo || 'Baja médica';

      } else if (ausenciaZi) {

        // Încearcă mai întâi TIPO, apoi tipo, apoi fallback la 'AUSENCIA'
        tip = ausenciaZi.TIPO || ausenciaZi.tipo || 'AUSENCIA';

        // Încearcă mai întâi MOTIVO, apoi motivo
        motivoAusencia = ausenciaZi.MOTIVO || ausenciaZi.motivo || '';

      } else if (planFuente === 'fiesta') {
        // Dacă plan_fuente este 'fiesta', setăm tip = 'Fiesta' (prioritate după bajaCalendar și ausenciaZi)
        // Asta previne flickering-ul când datele se încarcă
        tip = 'Fiesta';
        orar = '';
        
        // LOG pentru ziua 1
        if (day === 1) {
          console.log('✅ [DAY 1] Setat tip = Fiesta (din planFuente === fiesta)');
        }
        
        // Continuăm cu push-ul celulei, fără să mai verificăm cuadrant/horario
        cells.push({
          day,
          tip,
          orar,
          alertaFichaj: false, // Fiesta nu are alertaFichaj
          durataMunca: '', // Fiesta nu are durataMunca
          motivoAusencia,
          ausenciaZi,
          bajaCalendar,
          planFuente // Adăugăm planFuente în cell pentru a-l folosi în CalendarDayCell
        });
        day++;
        continue; // Sărim peste restul logicii pentru această zi
      } else if (cuadrant) {

        // Folosește cuadrante dacă nu există absențe - PRIORITATE ABSOLUTĂ

        const ziKey = `ZI_${day}`;

        const tipZi = cuadrant[ziKey] || cuadrant[`zi_${day}`];

        if (tipZi) {
          const tipZiStr = String(tipZi).trim();
          
          // Verifică dacă este LIBRE sau goală
          if (tipZiStr === '' || tipZiStr.toUpperCase() === 'LIBRE' || tipZiStr.toUpperCase() === 'LIB') {
            tip = 'LIBRE';
            orar = '';
          }
          // Verifică formatele T1, T2, T3 (ex: "T1 08:00-17:00" sau "T2 14:00-22:00")
          else if (tipZiStr.startsWith('T1') || tipZiStr.startsWith('T2') || tipZiStr.startsWith('T3')) {
            // Verifică din nou plan_fuente înainte de a seta tip = 'T1'/'T2'/'T3'
            // Dacă datele se încarcă încă și nu știm încă plan_fuente, nu setăm tip definitiv
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
              if (day === 1) {
                console.log('✅ [DAY 1] Setat tip = Fiesta (din cuadrant, planFuente === fiesta)');
              }
            } else if (loadingRegularizaciones && !planFuente) {
              // Dacă datele se încarcă încă, rămâne LIBRE până când datele se încarcă
              tip = 'LIBRE';
              orar = '';
              if (day === 1) {
                console.log('⏳ [DAY 1] Setat tip = LIBRE (loadingRegularizaciones && !planFuente)');
              }
            } else {
              // Extrage tipul (T1, T2, T3)
              const turnMatch = tipZiStr.match(/^(T[123])\s*(.*)$/);
              if (turnMatch) {
                tip = turnMatch[1]; // T1, T2 sau T3
                orar = turnMatch[2] || ''; // Orarul fără prefix
              } else {
                tip = tipZiStr.startsWith('T1') ? 'T1' : tipZiStr.startsWith('T2') ? 'T2' : 'T3';
                orar = tipZiStr.replace(/^T[123]\s*/, '');
              }
              if (day === 1) {
                console.log('⚠️ [DAY 1] Setat tip =', tip, '(din cuadrant, fără planFuente)');
              }
            }
          }
          // Verifică dacă este un orar direct (ex: "08:00-17:00" sau "09:00-15:00 / 16:00-20:00")
          else if (tipZiStr.match(/^\d{1,2}:\d{2}/)) {
            // Verifică din nou plan_fuente înainte de a seta tip = 'T1'
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              tip = 'T1';
              orar = tipZiStr;
            }
          }
          // Altfel, setează ca LIBRE sau Fiesta
          else {
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              tip = 'LIBRE';
              orar = '';
            }
          }
        } else {
          // Dacă cuadrant există dar nu are valoare pentru această zi, rămâne LIBRE (valoarea default)
          tip = 'LIBRE';
          orar = '';
        }

      } else if (horariosMulticentroLista && horariosMulticentroLista.length > 0) {
        // Folosește horario_multicentro DOAR dacă nu există cuadrant pentru luna respectivă
        // Pentru fiecare zi, verifică toate horario_multicentro pentru acea zi specifică
        const ziKey = `ZI_${day}`;
        
        // Pentru horario_multicentro, verificăm dacă există VREUN horario în listă pentru luna respectivă
        // Dacă există horariosMulticentroLista, înseamnă că angajatul are horario_multicentro pentru luna respectivă
        // Pentru fiecare zi, trebuie să verificăm ce valoare are în horario_multicentro
        
        // Găsește toate horario_multicentro care au o valoare (chiar și null/undefined/LIBRE) pentru această zi
        // IMPORTANT: Pentru horario_multicentro, dacă există orice horario în listă, verificăm valoarea pentru acea zi
        let horarioForDay = null;
        let hasHorarioMulticentroForDay = false; // Flag pentru a ști dacă există vreun horario_multicentro care acoperă această zi
        
        for (const horario of horariosMulticentroLista) {
          // Verifică toate variantele de caz (uppercase, lowercase, mixed)
          const daySchedule = horario[ziKey] ?? horario[ziKey.toLowerCase()] ?? horario[ziKey.toUpperCase()] ?? null;
          
          // IMPORTANT: Dacă horario_multicentro există pentru luna respectivă, înseamnă că acoperă TOATE zilele lunii
          // Chiar dacă pentru o zi specifică, ZI_X este null/undefined/LIBRE/gol/0/0h, înseamnă că acea zi este LIBRE din horario_multicentro
          // Setăm hasHorarioMulticentroForDay = true pentru TOATE zilele, pentru că horario_multicentro acoperă întreaga lună
          hasHorarioMulticentroForDay = true;
          
          // Găsește primul horario care are o valoare REALĂ (nu LIBRE/gol/0/0h/null) pentru această zi
          if (daySchedule !== null && daySchedule !== undefined) {
            const dayScheduleStr = String(daySchedule).trim();
            if (dayScheduleStr !== '' && dayScheduleStr.toUpperCase() !== 'LIBRE' && dayScheduleStr !== '0' && dayScheduleStr !== '0h') {
              horarioForDay = horario;
              break; // Folosim primul horario găsit care nu este LIBRE
            }
          }
        }
        
        // Dacă există cel puțin un horario_multicentro care acoperă această zi
        if (hasHorarioMulticentroForDay) {
          // Dacă găsim un horario cu orar real (nu LIBRE)
          if (horarioForDay) {
            const daySchedule = horarioForDay[ziKey] || horarioForDay[ziKey.toLowerCase()] || horarioForDay[ziKey.toUpperCase()];
            const dayScheduleStr = String(daySchedule || '').trim();
            
            // Calculăm orele programate pentru horarioMulticentroHours (folosit mai târziu în CalendarDayCell)
            if (!isNaN(parseFloat(dayScheduleStr)) && isFinite(dayScheduleStr)) {
              horarioMulticentroHours = parseFloat(dayScheduleStr);
            }
            
            // Verifică formatele T1, T2, T3 (ex: "T1 08:00-17:00" sau "T2 14:00-22:00")
            if (dayScheduleStr.startsWith('T1') || dayScheduleStr.startsWith('T2') || dayScheduleStr.startsWith('T3')) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                // Extrage tipul (T1, T2, T3)
                const turnMatch = dayScheduleStr.match(/^(T[123])\s*(.*)$/);
                if (turnMatch) {
                  tip = turnMatch[1]; // T1, T2 sau T3
                  orar = turnMatch[2] || ''; // Orarul fără prefix
                } else {
                  tip = dayScheduleStr.startsWith('T1') ? 'T1' : dayScheduleStr.startsWith('T2') ? 'T2' : 'T3';
                  orar = dayScheduleStr.replace(/^T[123]\s*/, '');
                }
              }
            }
            // Verifică dacă este un orar direct (ex: "08:00-17:00" sau "09:00-15:00 / 16:00-20:00")
            else if (dayScheduleStr.match(/^\d{1,2}:\d{2}/)) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                tip = 'T1';
                orar = dayScheduleStr;
              }
            }
            // Dacă este un număr (ore), afișăm doar numărul de ore (ex: "8h")
            else if (!isNaN(parseFloat(dayScheduleStr)) && isFinite(dayScheduleStr)) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                const hours = parseFloat(dayScheduleStr);
                if (hours > 0) {
                  tip = 'T1';
                  // Pentru horario_multicentro, afișăm doar numărul de ore (ex: "8h" sau "12h")
                  orar = `${hours}h`;
                } else {
                  tip = 'LIBRE';
                  orar = '';
                }
              }
            }
            // Altfel, setează ca LIBRE sau Fiesta
            else {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                tip = 'LIBRE';
                orar = '';
              }
            }
          } else {
            // Nu s-a găsit un horario cu orar real pentru această zi, dar există horario_multicentro care acoperă această zi
            // Înseamnă că toate horario_multicentro pentru această zi sunt LIBRE/gol/0/0h/null
            // Setăm explicit LIBRE (nu verificăm horarioAsignado!)
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              tip = 'LIBRE';
              orar = '';
            }
          }
        } else {
          // Dacă nu există horario_multicentro pentru această zi, verifică horario normal
          if (horarioAsignado) {
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dayOfWeek];
            const daySchedule = horarioAsignado.days?.[dayKey];
            
            if (daySchedule) {
              const intervals = [];
              if (daySchedule.in1 && daySchedule.out1) intervals.push({in: daySchedule.in1, out: daySchedule.out1});
              if (daySchedule.in2 && daySchedule.out2) intervals.push({in: daySchedule.in2, out: daySchedule.out2});
              if (daySchedule.in3 && daySchedule.out3) intervals.push({in: daySchedule.in3, out: daySchedule.out3});
              
              if (intervals.length > 0) {
                if (planFuente !== 'fiesta') {
                  tip = 'T1';
                  orar = intervals.map(interval => `${interval.in}-${interval.out}`).join(', ');
                } else {
                  tip = 'Fiesta';
                  orar = '';
                }
              } else {
                tip = planFuente === 'fiesta' ? 'Fiesta' : 'LIBRE';
                orar = '';
              }
            } else {
              tip = planFuente === 'fiesta' ? 'Fiesta' : 'LIBRE';
              orar = '';
            }
          } else {
            // Default pentru lunile fără cuadrante și fără horario_multicentro: Luni-Vineri = T1, Sâmbătă-Duminică = LIBRE
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              const dayOfWeek = new Date(year, month - 1, day).getDay();
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                tip = 'T1';
                orar = '08:00-17:00';
              } else {
                tip = 'LIBRE';
              }
            }
          }
        }

      } else {

        // Folosește orarul asignat dacă există, altfel default
        if (horarioAsignado) {
          const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Duminică, 1 = Luni, etc.
          const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dayOfWeek]; // Duminică = D, Luni = L, etc.
          
          // Verifică dacă există interval pentru această zi în orarul asignat
          const daySchedule = horarioAsignado.days?.[dayKey];
          
          if (daySchedule) {
            // Extrage intervalele din structura backend (in1/out1, in2/out2, in3/out3)
            const intervals = [];
            
            // Verifică primul interval
            if (daySchedule.in1 && daySchedule.out1) {
              intervals.push({in: daySchedule.in1, out: daySchedule.out1});
            }
            
            // Verifică al doilea interval
            if (daySchedule.in2 && daySchedule.out2) {
              intervals.push({in: daySchedule.in2, out: daySchedule.out2});
            }
            
            // Verifică al treilea interval
            if (daySchedule.in3 && daySchedule.out3) {
              intervals.push({in: daySchedule.in3, out: daySchedule.out3});
            }
            
            if (intervals.length > 0) {
              // Verifică din nou plan_fuente înainte de a seta tip = 'T1'
              // Dacă plan_fuente este 'fiesta', nu setăm tip = 'T1'
              if (planFuente !== 'fiesta') {
                tip = 'T1';
                // Construiește orarul din intervalele complete
                orar = intervals.map(interval => 
                  `${interval.in}-${interval.out}`
                ).join(', ');
              } else {
                tip = 'Fiesta';
                orar = '';
              }
            } else {
              tip = 'LIBRE';
            }
          } else {
            // Nu există interval pentru această zi
            // Verifică din nou plan_fuente înainte de a seta tip = 'LIBRE'
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              tip = 'LIBRE';
            }
          }
          
          // Debug pentru orarul asignat (doar pentru debugging)
          if (day === 10) {
            // DEBUG Ziua
          }
        } else {
          // Default pentru lunile fără cuadrante: Luni-Vineri = T1, Sâmbătă-Duminică = LIBRE
          // Verifică din nou plan_fuente înainte de a seta tip
          if (planFuente === 'fiesta') {
            tip = 'Fiesta';
            orar = '';
          } else {
            const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Duminică, 1 = Luni, etc.
            
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Luni până Vineri
              tip = 'T1';
              orar = '08:00-17:00'; // Program standard
            } else { // Sâmbătă și Duminică
              tip = 'LIBRE';
            }
          }
          
          // Debug pentru default
        }

      }

      

      // Logica pentru alertaFichaj și durataMunca s-a mutat în CalendarDayCell

      // LOG pentru ziua 1 - final
      if (day === 1) {
        console.log('📝 [DAY 1] Final push cell:', {
          day,
          tip,
          orar,
          planFuente,
          loadingRegularizaciones
        });
      }

      cells.push({

        day,

        tip,

        orar,

        // alertaFichaj și durataMunca se calculează în CalendarDayCell
        alertaFichaj: false, // placeholder, se calculează în componentă
        durataMunca: '', // placeholder, se calculează în componentă

        motivoAusencia,

        ausenciaZi,

        bajaCalendar,

        planFuente, // Adăugăm planFuente în cell pentru a-l folosi în CalendarDayCell
        
        // Adăugăm informația despre orele programate din horario_multicentro pentru această zi
        horarioMulticentroHours

      });

      day++;

    }
    
    return cells;
  }, [
    isLunaValida,
    selectedLunaNorm,
    cuadrant,
    fichajes,
    regularizacionesConfirmadas,
    loadingFichajes,
    loadingRegularizaciones,
    ausencias,
    bajasCalendar,
    horarioAsignado,
    horariosMulticentroLista,
    planFuenteMap,
    detaliiZilnice
  ]);



  // Calculez totalul de ore muncite

  useEffect(() => {
    
    // Calculează totalul de ore indiferent dacă există sau nu un cuadrant asignat.
    // Este suficient să avem fișaje (fichajes) pentru luna selectată.
    if (!fichajes || !fichajes.length || !selectedLunaNorm) return;


    const [year, month] = selectedLunaNorm.split('-').map(Number);

    let totalMinute = 0;
    let totalSeconds = 0;

    // Filtrez fichajes pentru luna selectată
    const fichajesLunaSelectata = fichajes.filter(f => {
      const fecha = f["FECHA"] || '';
      // Verific dacă data începe cu YYYY-MM corespunzător lunii selectate
      const fechaPrefix = `${year}-${String(month).padStart(2, '0')}`;
      return fecha.startsWith(fechaPrefix);
    });

    // Calculează orele: dacă există regularizare, folosește regularizarea, altfel folosește DURACION
    const parseHHMMSS = (s) => {
      if (!s || typeof s !== 'string') return 0;
      const parts = s.split(':').map(Number);
      if (parts.length === 3) {
        const [hh, mm, ss] = parts;
        return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
      }
      if (parts.length === 2) {
        const [hh, mm] = parts;
        return (hh || 0) * 3600 + (mm || 0) * 60;
      }
      return 0;
    };

    // Pentru fiecare Salida, folosește regularizarea dacă există, altfel DURACION
    // Pentru turele nocturne, regularizarea este pe workday_date (ziua de început)
    // Dar DURACION este în Salida de pe ziua de sfârșit, deci trebuie să procesăm corect
    fichajesLunaSelectata
      .filter(f => f["TIPO"] === 'Salida')
      .forEach(f => {
        // Prioritate 1: effective_minutes (regularizare confirmată)
        if (f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) {
          const effectiveMinutes = Number(f["effective_minutes"]);
          if (!isNaN(effectiveMinutes) && effectiveMinutes > 0) {
            totalMinute += effectiveMinutes;
            totalSeconds += effectiveMinutes * 60;
          }
        } 
        // Prioritate 2: effective_duration (regularizare confirmată)
        else if (f["effective_duration"] && f["effective_duration"].trim() !== '') {
          const durationStr = f["effective_duration"].trim();
          const secFromDuration = parseHHMMSS(durationStr);
          if (secFromDuration > 0) {
            totalSeconds += secFromDuration;
            totalMinute += Math.floor(secFromDuration / 60);
          }
        }
        // Prioritate 3: DURACION (când nu există regularizare)
        else if (f["DURACION"] && f["DURACION"].trim() !== '' && f["DURACION"] !== '00:00:00') {
          const durationStr = f["DURACION"].trim();
          const secFromDuration = parseHHMMSS(durationStr);
          if (secFromDuration > 0) {
            totalSeconds += secFromDuration;
            totalMinute += Math.floor(secFromDuration / 60);
          }
        }
      });

    // Calculez totalul final din orele reglementate (effective_minutes sau effective_duration)
    if (totalSeconds === 0 && totalMinute > 0) {
      totalSeconds = totalMinute * 60;
    }
    const hh = Math.floor(totalSeconds / 3600);
    const rem = totalSeconds % 3600;
    const mm = Math.floor(rem / 60);
    const ss = rem % 60;
    const totalText = `Total horas trabajadas (${month}/${year}): ${hh}h ${mm}m ${ss}s`;

    setTotalOreMunca(totalText);

  }, [cuadrant, fichajes, selectedLunaNorm]);



  // Registrele pentru ziua selectată

  let registreZi = [];

  if (ziSelectata && ziSelectata.day) {

    const [year, month] = selectedLunaNorm.split('-').map(Number);

    const dataZi = formatDateYMD(year, month, ziSelectata.day);

    registreZi = fichajes.filter(f => (f["FECHA"] || '').startsWith(dataZi));

  }



  // Generez lista de erori

  const erori = [];

  // IMPORTANT: Nu afișăm alerta dacă fichajes sau regularizările sunt încă în proces de încărcare
  if (!loading && !loadingFichajes && !loadingRegularizaciones && cuadrant) {

    const zileCuAlerta = calendarCells.filter(cell => cell && cell.tip === 'T1' && cell.alertaFichaj);

    if (zileCuAlerta.length > 0) {
      erori.push(`Tienes ${zileCuAlerta.length} día${zileCuAlerta.length === 1 ? '' : 's'} laborable${zileCuAlerta.length === 1 ? '' : 's'} con turnos incompletos (falta Entrada o Salida) en el mes seleccionado!`);
    }
  }





  // Funcție pentru obținerea locației automate folosind contextul global
  // Mutată aici pentru a fi disponibilă în handleResolveAlert
  const handleGetCurrentLocation = useCallback(async () => {
    try {
      // Folosim contextul global pentru locație
      const coords = await getCurrentLocation();
      const { latitude, longitude } = coords;

      // Obține adresa folosind funcția din context
      const address = await getAddressFromCoords(latitude, longitude);

      if (address) {
        setFichajeAddress(address);
        alert('¡La ubicación se ha obtenido automáticamente!');
      } else {
        // Fallback la coordonatele GPS
        setFichajeAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        alert('No se pudo obtener la dirección para la ubicación actual.');
      }

    } catch (error) {

      if (error.code === 1) {

        alert('El acceso a la ubicación fue denegado. Por favor permite el acceso en la configuración del navegador.');

      } else if (error.code === 2) {

        alert('No se pudo obtener la ubicación. Por favor verifica tu conexión a internet.');

      } else {

        alert('Error al obtener la ubicación. Por favor intenta de nuevo.');

      }

    }

  }, [getCurrentLocation, getAddressFromCoords]);

  // Funcții pentru rezolvarea alertelor
  // Memoizăm pentru a preveni re-render-uri inutile ale CalendarDayCell

  const handleResolveAlert = useCallback((cell) => {

    if (cell.alertaFichaj) {

      // Verifică dacă ziua este ziua curentă

      const currentDate = new Date();

      const currentYear = currentDate.getFullYear();

      const currentMonth = currentDate.getMonth() + 1;

      const currentDay = currentDate.getDate();

      

      const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);

      

      // Verifică dacă este ziua curentă

      const isCurrentDay = selectedYear === currentYear && 

                          selectedMonth === currentMonth && 

                          cell.day === currentDay;

      

      if (!isCurrentDay) {

        alert('¡Solo puedes modificar el día actual! No puedes añadir fichajes para días anteriores o futuros.');

        return;

      }

      

      setSelectedDayForFichaje(cell);

      setFichajeType('Entrada');

      setFichajeTime('');

      setFichajeAddress('');

      setShowFichajeModal(true);

      

      // Încearcă să obțină locația automată când se deschide modalul

      setTimeout(() => {

        handleGetCurrentLocation();

      }, 500);

    } else {

      setZiSelectata(cell);

    }

  }, [selectedLunaNorm, handleGetCurrentLocation]);



  // Funcție pentru "Indicar motivo" (zile trecute fără fichajes)
  const handleIndicarMotivo = useCallback((cell) => {
    const [year, month] = selectedLunaNorm.split('-').map(Number);
    const dataZi = formatDateYMD(year, month, cell.day);
    
    // Obține orarul planificat din cell (dacă există)
    const scheduled_hours = cell.orar || null;
    
    setSelectedDayForNoPunch({
      workday_date: dataZi,
      scheduled_hours: scheduled_hours,
      employee_codigo: empleadoCodigo || undefined
    });
    setShowNoPunchModal(true);
  }, [selectedLunaNorm, empleadoCodigo]);



  const handleSubmitFichaje = async () => {

    if (!fichajeTime) {

      alert('¡Por favor completa la hora!');

      return;

    }



    setSubmittingFichaje(true);

    try {

      const [year, month] = selectedLunaNorm.split('-').map(Number);

      const dataZi = formatDateYMD(year, month, selectedDayForFichaje.day);

      

      const newFichaje = {

        FECHA: dataZi,

        HORA: fichajeTime,

        TIPO: fichajeType,

        DIRECCION: fichajeAddress || 'Ubicación automática',

        CORREO_ELECTRONICO: emailLogat,

        ESTADO: 'PENDIENTE', // În așteptare de aprobare

        MODIFICADO_POR: authUser?.['NOMBRE / APELLIDOS'] || emailLogat,

        FECHA_CREACION: new Date().toISOString()

      };



      // Adaug la lista de pontaje în așteptare

      setPendingFichajes(prev => [...prev, newFichaje]);

      

      // Salvez în baza de date (în așteptare)

      // Folosim backend-ul nou pentru fichajes (addFichaje poate gestiona și fichajes pendiente)
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.addFichaje, {

        method: 'POST',

        headers: headers,

        body: JSON.stringify(newFichaje)

      });



      if (response.ok) {

        alert(`¡Fichaje ${fichajeType} registrado con éxito! Pendiente de aprobación.`);

        setShowFichajeModal(false);

        // Reîncarc pontaje pentru a actualiza lista

        // fetchFichajes();

      } else {

        alert('¡Error al guardar el fichaje!');

      }

    } catch {

      alert('¡Error al guardar el fichaje!');

    } finally {

      setSubmittingFichaje(false);

    }

  };



  const handleAddAnotherFichaje = () => {

    // Schimb tipul pentru următorul pontaj

    setFichajeType(fichajeType === 'Entrada' ? 'Salida' : 'Entrada');

    setFichajeTime('');

    setFichajeAddress('');

  };




  if (loading) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">

        <div className="text-center">

          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>

          <div className="text-red-600 font-bold text-xl">Cargando...</div>

        </div>

      </div>

    );

  }



  if (error) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">

        <div 

          className="relative text-center max-w-md w-full"

          style={{

            background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',

            backdropFilter: 'blur(10px)',

            borderRadius: '1.5rem',

            border: '2px solid rgba(239, 68, 68, 0.3)',

            boxShadow: '0 15px 40px rgba(239, 68, 68, 0.3)',

            padding: '3rem'

          }}

        >

          {/* Glow animado */}

          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-400 to-pink-400 opacity-20 blur-xl"></div>

          

          <div className="relative">

            {/* Icono animado */}

            <div className="relative inline-block mb-6">

              <div className="absolute inset-0 bg-red-400 rounded-full blur-lg opacity-60 animate-pulse"></div>

              <div 

                className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"

                style={{

                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',

                  boxShadow: '0 20px 40px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)'

                }}

              >

                <span className="text-5xl animate-pulse">⚠️</span>

              </div>

            </div>

            

            <h2 className="text-2xl font-black text-red-800 mb-4">Error</h2>

            <p className="text-gray-700 mb-8 font-medium">{error}</p>

            

            <Back3DButton to="/inicio" title="Regresar al Dashboard" />

          </div>

        </div>

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">

      {/* Header ULTRA WOW 3D modern */}

      <div className="relative overflow-hidden bg-white shadow-lg border-b border-gray-100">

        {/* Glow background animado */}

        <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 opacity-10 blur-3xl"></div>

        

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center justify-between py-6">

            {/* Buton 3D Back */}

            <Back3DButton to="/inicio" title="Regresar al Dashboard" />

            

            <div className="flex items-center space-x-4">

              {/* Icono 3D con animación - Desktop: emoji, Mobile: data actual */}

              <div 

                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-110 hover:rotate-6 transition-all duration-300"

                style={{

                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',

                  boxShadow: '0 12px 30px rgba(239, 68, 68, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3)'

                }}

              >

                {/* Desktop: emoji cu animatie */}
                <span className="text-3xl animate-bounce hidden md:block">📅</span>

                {/* Mobile: data curenta dinamica */}
                <span className="text-lg font-black text-white md:hidden">
                  {getCurrentDayFormatted()}
                </span>

              </div>

              

              <div>

                <h1 

                  className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent"

                  style={{

                    textShadow: '0 2px 20px rgba(239, 68, 68, 0.2)'

                  }}

                >

                  Mi Horario

                </h1>

                {identidadDisplay && (

                  <p className="text-gray-600 text-sm font-medium">

                    <span className="text-gray-500">📧</span> {identidadDisplay}

                  </p>

                )}

                {/* Afișează informațiile despre ce s-a găsit - cuadrant, horario_multicentro sau horario normal */}
                {cuadrant ? (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-sm font-medium">
                      <span className="text-green-600">📋</span> Cuadrante asignado: {selectedLunaNorm}
                    </p>
                    <p className="text-green-700 text-xs mt-1">
                      Empleado: {cuadrant.NOMBRE || cuadrant.NOMBRE_APELLIDOS || 'N/A'}
                    </p>
                    <p className="text-green-700 text-xs mt-1">
                      Centro: {cuadrant.CENTRO || 'N/A'} | Cuadrante personalizado
                    </p>
                    <p className="text-green-600 text-xs mt-1">
                      Fuente: Cuadrante generado
                    </p>
                  </div>
                ) : horarioMulticentroAsignado ? (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-purple-800 text-sm font-medium">
                      <span className="text-purple-600">🏢</span> Horario Multicentro asignado: {selectedLunaNorm}
                    </p>
                    {(() => {
                      // Verifică dacă horario_multicentro este pentru luna curentă
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth() + 1;
                      const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
                      
                      const isCurrentMonth = selectedLunaNorm === currentMonthFormatted;
                      
                      // Dacă este luna curentă, verifică dacă există orar pentru ziua curentă
                      if (isCurrentMonth) {
                        // Dacă există horario pentru ziua curentă, afișează informațiile pentru acel horario
                        if (currentDayHorarioMulticentro) {
                          return (
                            <>
                              <p className="text-purple-700 text-xs mt-1">
                                Cliente: <strong>{currentDayHorarioMulticentro.CLIENTE || 'N/A'}</strong>
                              </p>
                              <p className="text-purple-700 text-xs mt-1">
                                Horario: <strong>{currentDayHorarioMulticentro.HORARIO || 'N/A'}</strong> | Servicio: {currentDayHorarioMulticentro.SERVICIO || 'N/A'}
                              </p>
                              {currentDayScheduleFromHorarioMulticentro ? (
                                <div className="mt-2 pt-2 border-t border-purple-300">
                                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-purple-800 rounded-md">
                                    <span className="text-xs">📅 Hoy:</span>
                                    <span className="text-xs font-semibold">{currentDayScheduleFromHorarioMulticentro}</span>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          );
                        } 
                        // Dacă nu există orar pentru ziua curentă, afișează mesajul de avertisment la CLIENTE și HORARIO
                        else {
                          return (
                            <>
                              <p className="text-purple-700 text-xs mt-1">
                                Cliente: <span className="text-yellow-700 font-semibold">⚠️ No tienes horario asignado para hoy</span>
                              </p>
                              <p className="text-purple-700 text-xs mt-1">
                                Horario: <span className="text-yellow-700 font-semibold">⚠️ No tienes horario asignado para hoy</span>
                              </p>
                            </>
                          );
                        }
                      }
                      // Dacă nu este luna curentă, afișează primul horario din listă
                      else {
                        return (
                          <>
                            <p className="text-purple-700 text-xs mt-1">
                              Cliente: {horarioMulticentroAsignado.CLIENTE || 'N/A'}
                            </p>
                            <p className="text-purple-700 text-xs mt-1">
                              Horario: {horarioMulticentroAsignado.HORARIO || 'N/A'} | Servicio: {horarioMulticentroAsignado.SERVICIO || 'N/A'}
                            </p>
                          </>
                        );
                      }
                    })()}
                    <p className="text-purple-600 text-xs mt-1">
                      Fuente: Horario Multicentro
                    </p>
                  </div>
                ) : horarioAsignado ? (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm font-medium">
                      <span className="text-blue-600">📅</span> Horario asignado: {horarioAsignado.nombre}
                    </p>
                    <p className="text-blue-700 text-xs mt-1">
                      Centro: {horarioAsignado.centroNombre} | Grupo: {horarioAsignado.grupoNombre}
                    </p>
                    {horarioAsignado.vigenteDesde && horarioAsignado.vigenteHasta && (
                      <p className="text-blue-600 text-xs mt-1">
                        Vigente: {horarioAsignado.vigenteDesde} - {horarioAsignado.vigenteHasta}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-gray-800 text-sm font-medium">
                      <span className="text-gray-600">⚠️</span> Sin horario asignado
                    </p>
                    <p className="text-gray-700 text-xs mt-1">
                      No se encontró cuadrante ni horario para este mes
                    </p>
                  </div>
                )}

                {/* Avertisment pentru Baja Médica */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const currentBaja = bajasCalendar.find((baja) => {
                    if (!baja?.start || !baja?.end) return false;
                    
                    // Dacă situacion este "Alta" sau similar, nu afișăm mesajul de baja activă
                    const situacion = (baja.situacion || '').toUpperCase();
                    if (situacion === 'ALTA' || situacion === 'ALTA MÉDICA' || situacion === 'ALTA MEDICA') {
                      return false; // Nu afișăm mesajul dacă este deja "Alta"
                    }
                    
                    // Verifică dacă există fecha_alta reală în trecut (din raw data)
                    // pentru a evita problemele când end este setat la data de astăzi din cauza logicii de fallback
                    if (baja.raw) {
                      const fechaAltaRaw = baja.raw['Fecha alta'] || baja.raw['Fecha Alta'] || baja.raw.fecha_alta || baja.raw.fechaAlta || baja.raw.FECHA_ALTA || baja.raw['FECHA ALTA'] || '';
                      if (fechaAltaRaw) {
                        const fechaAltaDate = new Date(fechaAltaRaw);
                        if (!isNaN(fechaAltaDate.getTime())) {
                          fechaAltaDate.setHours(0, 0, 0, 0);
                          if (fechaAltaDate < today) {
                            return false; // Nu afișăm mesajul dacă data de alta este în trecut
                          }
                        }
                      }
                    }
                    
                    // Verifică dacă endDate (fecha_alta) este în trecut - folosim endDate string, nu end object
                    if (baja.endDate) {
                      const endDateObj = new Date(baja.endDate);
                      if (!isNaN(endDateObj.getTime())) {
                        endDateObj.setHours(0, 0, 0, 0);
                        if (endDateObj < today) {
                          return false; // Nu afișăm mesajul dacă data de alta este în trecut
                        }
                      }
                    }
                    
                    // Verifică dacă ziua curentă este în intervalul de baja
                    const isInRange = today >= baja.start && today <= baja.end;
                    if (!isInRange) return false;
                    
                    return true;
                  });
                  
                  if (currentBaja) {
                    const startDate = currentBaja.startDate || '';
                    const endDate = currentBaja.endDate || '';
                    const situacion = currentBaja.situacion || '';
                    
                    return (
                      <div className="mt-3 p-4 bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl shadow-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                              <span className="text-white text-xl">🏥</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-rose-800 mb-1">
                              ⚠️ Estás en Baja Médica
                            </h3>
                            <p className="text-rose-700 text-sm mb-2">
                              Actualmente estás de baja médica. Por favor, consulta con tu médico y sigue las indicaciones.
                            </p>
                            {startDate && endDate && (
                              <p className="text-rose-600 text-xs">
                                <strong>Período:</strong> {startDate} - {endDate}
                              </p>
                            )}
                            {situacion && (
                              <p className="text-rose-600 text-xs mt-1">
                                <strong>Situación:</strong> {situacion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

              </div>

            </div>

            

            {/* Spațiu pentru echilibrare vizuală */}

            <div className="w-[100px]"></div>

          </div>

        </div>

      </div>



      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Botón Reportar Error */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => {
              // Date relevante pentru pagina de cuadrantes
              const cuadranteActual = cuadrantesUser?.find(c => c.LUNA === selectedLuna) || cuadrantesUser?.[0];
              const horarioInfo = horarioAsignado?.nombre || horarioMulticentroAsignado?.nombre || null;
              
              const pageData = {
                additionalInfo: [
                  selectedLuna ? `[MES] ${selectedLuna}` : null,
                  cuadrantesUser?.length > 0 ? `[CUADRANTES] ${cuadrantesUser.length} cuadrantes disponibles` : null,
                  cuadranteActual ? `[CUADRANTE ACTUAL] ${cuadranteActual.LUNA || 'N/A'}` : null,
                  horarioInfo ? `[HORARIO] ${horarioInfo}` : null,
                ].filter(Boolean),
              };
              
              const message = buildErrorReportMessage({
                authUser,
                userData,
                pageName: "Cuadrantes Empleado",
                pageData,
              });
              
              openWhatsAppErrorReport(message);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="text-base">📱</span>
            Reportar error
          </button>
        </div>

        

        {/* Alerta ULTRA WOW 3D modernizada */}

        {erori.length > 0 && (

          <div 

            className="relative group overflow-hidden mb-8"

            style={{

              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',

              backdropFilter: 'blur(10px)',

              borderRadius: '1.5rem',

              border: '2px solid rgba(251, 191, 36, 0.3)',

              boxShadow: '0 15px 40px rgba(251, 191, 36, 0.25)',

              padding: '1.5rem'

            }}

          >

            {/* Glow animado en hover */}

            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 to-orange-400 opacity-20 blur-xl animate-pulse"></div>

            

            <div className="relative flex items-start gap-4">

              {/* Icono 3D animado */}

              <div className="flex-shrink-0">

                <div className="relative inline-block">

                  <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-60 animate-pulse"></div>

                  <div 

                    className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300"

                    style={{

                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',

                      boxShadow: '0 12px 30px rgba(251, 191, 36, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)'

                    }}

                  >

                    <span className="text-3xl animate-bounce">⚠️</span>

                  </div>

                </div>

              </div>

              

              {/* Contenido */}

              <div className="flex-1 min-w-0">

                <h3 

                  className="text-xl font-black mb-2 bg-gradient-to-r from-yellow-700 via-orange-600 to-red-600 bg-clip-text text-transparent"

                  style={{

                    textShadow: '0 2px 10px rgba(251, 191, 36, 0.2)'

                  }}

                >

                  ¡Atención!

                </h3>

                <p className="text-yellow-800 font-semibold text-base leading-relaxed">

                  Tienes <span className="text-orange-600 font-black text-lg">{erori[0].match(/\d+/)[0]}</span> días laborables con turnos incompletos (falta Entrada o Salida) en el mes seleccionado!

                </p>

              </div>

            </div>

            

            {/* Shimmer effect */}

            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>

          </div>

        )}



        {/* Selector de mes ULTRA WOW 3D modernizado */}

        <div 

          className="relative group overflow-hidden mb-8"

          style={{

            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',

            backdropFilter: 'blur(10px)',

            borderRadius: '1.5rem',

            border: '1px solid rgba(229, 231, 235, 0.5)',

            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.08)',

            padding: '2rem'

          }}

        >

          {/* Glow animado en hover */}

          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-400 to-pink-400 opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500"></div>

          

          <div className="relative">

            {/* Header con icono 3D */}

            <div className="flex items-center justify-between mb-6">

              <div className="flex items-center gap-4">

                <div 

                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"

                  style={{

                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',

                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'

                  }}

                >

                  <span className="text-2xl">📅</span>

                </div>

                <h2 

                  className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"

                  style={{

                    textShadow: '0 2px 10px rgba(99, 102, 241, 0.2)'

                  }}

                >

                  Selecciona el mes

                </h2>

              </div>

              

              {totalOreMunca && (

                <div 

                  className="relative group/badge"

                  style={{

                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%)',

                    backdropFilter: 'blur(8px)',

                    borderRadius: '1rem',

                    border: '2px solid rgba(34, 197, 94, 0.3)',

                    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2)',

                    padding: '0.5rem 1rem'

                  }}

                >

                  <div className="absolute inset-0 rounded-2xl bg-green-400 opacity-0 group-hover/badge:opacity-20 blur-md transition-opacity duration-300"></div>

                  <span className="relative text-green-800 font-black text-sm flex items-center gap-2">

                    <span className="text-lg">⏱️</span>

                    {totalOreMunca}

                  </span>

                </div>

              )}

            </div>

            

            {/* Dropdown de meses modernizado */}

            <div className="relative group/dropdown">

              <select

                id="selected-luna"
                name="selected-luna"
                value={selectedLunaNorm}

                onChange={(e) => setSelectedLuna(e.target.value)}

                className="w-full px-6 py-4 rounded-2xl font-bold text-gray-800 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer appearance-none"

                style={{

                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,

                  backgroundPosition: 'right 1rem center',

                  backgroundRepeat: 'no-repeat',

                  backgroundSize: '1.5rem',

                  paddingRight: '3rem'

                }}

              >

                {luniDisponibile.map(l => (

                  <option key={l} value={l}>

                    {formatMonthName(l)}

                  </option>

                ))}

              </select>

              

              {/* Glow effect en hover */}

              <div className="absolute inset-0 rounded-2xl bg-red-400 opacity-0 group-hover/dropdown:opacity-10 blur-xl transition-opacity duration-300 pointer-events-none"></div>

              

              {/* Shimmer effect */}

              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/dropdown:translate-x-[200%] transition-transform duration-1000 pointer-events-none"></div>

            </div>

          </div>

        </div>

        {/* Modal Aviso Horarios */}
        <Modal
          isOpen={showAvisoModal}
          onClose={handleCerrarAviso}
          title="Aviso importante"
        >
          <div className="p-6 space-y-4">
            <p className="text-gray-700">
              Los horarios de trabajo y turnos asignados pueden estar sujetos a ajustes puntuales por necesidades organizativas o del servicio.
            </p>
            <p className="text-gray-700">
              Cualquier modificación será comunicada con antelación, siempre que sea posible, a través de los canales oficiales de la empresa (correo electrónico, WhatsApp u otros medios habituales).
            </p>
            <p className="text-gray-700 font-semibold">
              Gracias por vuestra comprensión y colaboración.
            </p>
            <div className="flex justify-end pt-4">
              <Button onClick={handleAceptarAviso}>
                Aceptar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Aviso permanente */}
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Aviso:</span> Los horarios y turnos pueden sufrir modificaciones puntuales. Las actualizaciones se comunicarán por los canales oficiales.
              </p>
            </div>
          </div>
        </div>

        {/* Calendar MEGA WOW 3D modernizado */}

        <div 

          className="relative group overflow-hidden mb-8"

          style={{

            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',

            backdropFilter: 'blur(10px)',

            borderRadius: '1.5rem',

            border: '1px solid rgba(229, 231, 235, 0.5)',

            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.08)',

            padding: '2rem'

          }}

        >

          {/* Glow animado en hover */}

          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500"></div>

          

          <div className="relative">

            {/* Header con icono 3D */}

            <div className="flex items-center gap-4 mb-6">

              <div 

                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"

                style={{

                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',

                  boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'

                }}

              >

                <span className="text-3xl">📅</span>

              </div>

              <div>

                <h3 

                  className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent"

                  style={{

                    textShadow: '0 2px 10px rgba(59, 130, 246, 0.2)'

                  }}

                >

                  Horario para {selectedLunaNorm}

                </h3>

                <p className="text-gray-600 text-sm font-medium mt-1">

                  Consulta tus turnos y fichajes

                </p>

              </div>

            </div>

            

            {/* Legend ULTRA WOW modernizada */}

            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">

              {/* Día laborable */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(34, 197, 94, 0.3)',

                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-green-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',

                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.5)'

                    }}

                  ></div>

                  <span className="text-green-800 font-bold text-sm">Día laborable</span>

                </div>

              </div>



              {/* Día libre */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(239, 68, 68, 0.3)',

                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-red-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',

                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)'

                    }}

                  ></div>

                  <span className="text-red-800 font-bold text-sm">Día libre</span>

                </div>

              </div>



              {/* Sin fichar */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(251, 191, 36, 0.3)',

                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-yellow-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',

                      boxShadow: '0 2px 8px rgba(251, 191, 36, 0.5)'

                    }}

                  ></div>

                  <span className="text-yellow-800 font-bold text-sm">Sin fichar</span>

                </div>

              </div>



              {/* Día actual */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(59, 130, 246, 0.3)',

                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md animate-pulse"

                    style={{

                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',

                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)'

                    }}

                  ></div>

                  <span className="text-blue-800 font-bold text-sm">Día actual</span>

                </div>

              </div>



              {/* Vacaciones */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(14, 165, 233, 0.3)',

                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-sky-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',

                      boxShadow: '0 2px 8px rgba(14, 165, 233, 0.5)'

                    }}

                  ></div>

                  <span className="text-sky-800 font-bold text-sm">Vacaciones</span>

                </div>

              </div>



              {/* Asunto Propio */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(168, 85, 247, 0.3)',

                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',

                      boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'

                    }}

                  ></div>

                  <span className="text-purple-800 font-bold text-sm">Asunto Propio</span>

                </div>

              </div>



              {/* Baja Médica */}

              <div 

                className="relative group/legend overflow-hidden"

                style={{

                  background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',

                  backdropFilter: 'blur(8px)',

                  borderRadius: '0.75rem',

                  border: '2px solid rgba(219, 39, 119, 0.35)',

                  boxShadow: '0 4px 12px rgba(219, 39, 119, 0.18)',

                  padding: '0.75rem'

                }}

              >

                <div className="absolute inset-0 rounded-xl bg-rose-400 opacity-0 group-hover/legend:opacity-20 blur-md transition-opacity duration-300"></div>

                <div className="relative flex items-center gap-3">

                  <div 

                    className="w-4 h-4 rounded-full shadow-md"

                    style={{

                      background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',

                      boxShadow: '0 2px 8px rgba(219, 39, 119, 0.5)'

                    }}

                  ></div>

                  <span className="text-rose-800 font-bold text-sm">Baja Médica</span>

                </div>

              </div>

            </div>



            {/* Week days header ULTRA WOW */}

            <div className="grid grid-cols-7 gap-3 mb-4">

              {weekDays.map((wd) => (

                <div 

                  key={wd}

                  className="relative group/day overflow-hidden"

                  style={{

                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)',

                    backdropFilter: 'blur(8px)',

                    borderRadius: '0.75rem',

                    border: '1px solid rgba(99, 102, 241, 0.2)',

                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',

                    padding: '0.75rem'

                  }}

                >

                  <div className="absolute inset-0 rounded-xl bg-indigo-400 opacity-0 group-hover/day:opacity-15 blur-md transition-opacity duration-300"></div>

                  <div className="relative text-center font-black text-sm text-indigo-800">

                    {wd}

                  </div>

                </div>

              ))}

            </div>



          {/* Calendar grid ULTRA WOW 3D */}

          <div className="grid grid-cols-7 gap-3">

            {/* Mesaj profesional când nu există date pentru luna selectată */}
            {!hasDataForMonth && !loading && !loadingHorarioMulticentro && (
              <div className="col-span-7 text-center py-16">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-amber-400 rounded-full blur-lg opacity-20 animate-pulse"></div>
                  <div 
                    className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      boxShadow: '0 15px 30px rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    <span className="text-5xl">⏳</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  Horario pendiente de generación
                </h3>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
                  Tu horario para este mes está en proceso de generación.
                  <br />
                  Por favor, contacta con tu supervisor o el departamento de recursos humanos 
                  si necesitas información sobre tu horario.
                </p>
                <p className="text-gray-500 text-sm mt-4">
                  Te notificaremos cuando esté disponible.
                </p>
              </div>
            )}

            {/* Calendar normal când există date */}
            {hasDataForMonth && calendarCells.length === 0 && (

              <div className="col-span-7 text-center py-12">

                <div 

                  className="relative inline-block mb-6"

                >

                  <div className="absolute inset-0 bg-gray-400 rounded-full blur-lg opacity-30 animate-pulse"></div>

                  <div 

                    className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"

                    style={{

                      background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',

                      boxShadow: '0 15px 30px rgba(156, 163, 175, 0.4)'

                    }}

                  >

                    <span className="text-5xl">📅</span>

                  </div>

                </div>

                <p className="text-gray-700 font-bold text-lg">No hay datos para este mes</p>

              </div>

            )}

            {hasDataForMonth && calendarCells.length > 0 && (

              calendarCells.map((cell, idx) => {

                if (!cell) {

                  return <div key={idx} className="min-h-[100px]"></div>;

                }

                

                return (

                  <CalendarDayCell

                    key={idx}

                    cell={cell}

                    selectedLunaNorm={selectedLunaNorm}

                    ziSelectata={ziSelectata}

                    handleResolveAlert={handleResolveAlert}

                    handleIndicarMotivo={handleIndicarMotivo}

                    regularizacionesConfirmadas={regularizacionesConfirmadas}

                    loadingFichajes={loadingFichajes}

                    loadingRegularizaciones={loadingRegularizaciones}

                    fichajes={fichajes}

                    horariosMulticentroLista={horariosMulticentroLista}

                  />

                );

              })

            )}

          </div>

          

          {/* Nota informativa ULTRA WOW modernizada */}

          <div 

            className="relative group/note overflow-hidden mt-6"

            style={{

              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',

              backdropFilter: 'blur(10px)',

              borderRadius: '1rem',

              border: '2px solid rgba(59, 130, 246, 0.3)',

              boxShadow: '0 6px 18px rgba(59, 130, 246, 0.15)',

              padding: '1rem'

            }}

          >

            {/* Glow animado en hover */}

            <div className="absolute inset-0 rounded-2xl bg-blue-400 opacity-0 group-hover/note:opacity-15 blur-lg transition-opacity duration-300"></div>

            

            <div className="relative flex items-start gap-3">

              <div 

                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-md"

                style={{

                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',

                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'

                }}

              >

                <span className="text-white text-xl">ℹ️</span>

              </div>

              <div className="flex-1">

                <div className="text-sm text-blue-900 font-semibold leading-relaxed">

                  <span className="font-black text-blue-700">Nota:</span> Los días con <span className="inline-block animate-bounce">⚠️</span> necesitan fichajes completos. Solo puedes modificar el <span className="font-black text-blue-700">día actual</span>.

                </div>

              </div>

            </div>

          </div>

          </div>

        </div>



        {/* Detalii registre moderne */}

        {ziSelectata && ziSelectata.day && (

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">

            <div className="flex items-center gap-4 mb-6">

              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">

                <span className="text-white text-xl">📊</span>

              </div>

              <div>

                <h4 className="text-2xl font-bold text-gray-800">

                  Registros para el día {ziSelectata.day}

                </h4>

                <p className="text-gray-500">

                  {ziSelectata.tip || '—'} • {registreZi.length} fichajes

                </p>

              </div>

            </div>

            

            {registreZi.length === 0 ? (

              <div className="text-center py-8">

                <div className="text-gray-400 text-6xl mb-4">📝</div>

                <p className="text-gray-600 font-medium">No hay fichajes para este día</p>

              </div>

            ) : (

              <div className="space-y-3">

                {registreZi.map((r, i) => (

                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200">

                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-4">

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${

                          r["TIPO"] === 'Entrada' 

                            ? 'bg-green-100 text-green-600' 

                            : 'bg-red-100 text-red-600'

                        }`}>

                          <span className="text-lg">

                            {r["TIPO"] === 'Entrada' ? '⬇️' : '⬆️'}

                          </span>

                        </div>

                        <div>

                          <div className="font-bold text-gray-800">

                            {r["TIPO"]} • {r["HORA"]}

                          </div>

                          <div className="text-sm text-gray-600">

                            {r["DIRECCION"]}

                          </div>

                        </div>

                      </div>

                      <div className="text-right">

                        <div className="text-xs text-gray-500 mb-1">

                          {r["MODIFICADO_POR"]}

                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${

                          r["ESTADO"] === 'PENDIENTE' 

                            ? 'bg-yellow-100 text-yellow-800' 

                            : 'bg-green-100 text-green-800'

                        }`}>

                          {r["ESTADO"] === 'PENDIENTE' ? 'Pendiente' : 'Aprobado'}

                        </span>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        )}



        {/* Fichaje în așteptare moderne */}

        {pendingFichajes.length > 0 && (

          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-8 mb-8 shadow-lg">

            <div className="flex items-center gap-4 mb-6">

              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">

                <span className="text-white text-xl">⏳</span>

              </div>

              <div>

                <h4 className="text-2xl font-bold text-white">

                  Fichajes pendientes

                </h4>

                <p className="text-white text-opacity-90">

                  {pendingFichajes.length} fichajes pendientes de aprobación

                </p>

              </div>

            </div>

            

            <div className="space-y-3">

              {pendingFichajes.map((f, i) => (

                <div key={i} className="bg-white bg-opacity-20 rounded-xl p-4 border border-white border-opacity-30">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-4">

                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${

                        f.TIPO === 'Entrada' 

                          ? 'bg-green-100 text-green-600' 

                          : 'bg-red-100 text-red-600'

                      }`}>

                        <span className="text-lg">

                          {f.TIPO === 'Entrada' ? '⬇️' : '⬆️'}

                        </span>

                      </div>

                      <div>

                        <div className="font-bold text-white">

                          {f.TIPO} • {f.HORA} • {f.FECHA}

                        </div>

                        <div className="text-white text-opacity-80 text-sm">

                          {f.DIRECCION}

                        </div>

                      </div>

                    </div>

                    <div className="text-right">

                      <div className="text-white text-opacity-80 text-xs mb-1">

                        {f.MODIFICADO_POR}

                      </div>

                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white bg-opacity-20 text-white">

                        Pendiente

                      </span>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}

      </div>



      {/* Modal pentru rezolvarea alertelor */}

      <Modal

        isOpen={showFichajeModal}

        onClose={() => setShowFichajeModal(false)}

        title={`Resolver alerta para el día ${selectedDayForFichaje?.day}`}

      >

        <div className="space-y-4">

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-2">

              Tipo de fichaje

            </label>

            <select

              value={fichajeType}

              onChange={(e) => setFichajeType(e.target.value)}

              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"

            >

              <option value="Entrada">Entrada</option>

              <option value="Salida">Salida</option>

            </select>

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-2">

              Hora

            </label>

            <Input

              id="fichaje-time"
              name="fichaje-time"
              type="time"

              value={fichajeTime}

              onChange={(e) => setFichajeTime(e.target.value)}

              placeholder="HH:MM"

              required

            />

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-2">

              Dirección

            </label>

            <div className="flex gap-2">

              <Input

                id="fichaje-address"
                name="fichaje-address"
                type="text"

                value={fichajeAddress}

                onChange={(e) => setFichajeAddress(e.target.value)}

                placeholder="Introduce la dirección o usa la ubicación automática"

                className="flex-1"

              />

              <Button

                onClick={getCurrentLocation}

                variant="outline"

                className="px-4 py-2"

                title="Obtener ubicación automática"

              >

                📍

              </Button>

            </div>

          </div>



          <div className="flex gap-3 pt-4">

            <Button

              onClick={handleSubmitFichaje}

              disabled={submittingFichaje || !fichajeTime}

              className="flex-1"

            >

              {submittingFichaje ? 'Guardando...' : 'Guardar fichaje'}

            </Button>

            

            <Button

              onClick={handleAddAnotherFichaje}

              variant="outline"

              className="flex-1"

            >

              Añadir otro fichaje

            </Button>

            

            <Button

              onClick={() => setShowFichajeModal(false)}

              variant="outline"

              className="flex-1"

            >

              Cancelar

            </Button>

          </div>



          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">

            <p className="text-yellow-800 text-sm">

              <strong>Nota:</strong> Los fichajes registrados estarán pendientes de aprobación por el manager/supervisor.

            </p>

          </div>

        </div>

      </Modal>

      {/* Modal pentru "Indicar motivo" (zile trecute fără fichajes) */}
      <DeclararNoPunchModal
        isOpen={showNoPunchModal}
        onClose={() => {
          setShowNoPunchModal(false);
          setSelectedDayForNoPunch(null);
        }}
        onConfirm={async () => {
          setShowNoPunchModal(false);
          setSelectedDayForNoPunch(null);
          // Reîncarcă fichajes pentru a actualiza UI-ul
          // Poți adăuga un callback onRefresh dacă este necesar
        }}
        data={selectedDayForNoPunch || {}}
      />

    </div>

  );

} 