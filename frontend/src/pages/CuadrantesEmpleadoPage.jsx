import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';

import { PageHeader, AlertBanner } from '../components/ui';
import CuadrantesEmpleadoShell from './cuadrantes-empleado/CuadrantesEmpleadoShell.jsx';

import { routes } from '../utils/routes.js';
import { config } from '../config/env';
import activityLogger from '../utils/activityLogger';
import { isCuadranteRowVisible } from '../utils/cuadranteVisible';
import {
  formatCuadranteIntervalsForDisplay,
  isCuadranteTurnoCompartidoDisplay,
} from '../utils/cuadrante-hours-helper.js';

// Helper functions

/** Pentru CalendarDayCell / turno compartido: "HH:MM-HH:MM / â€¦" din in/out horario */
function ziRawFromHorarioIntervals(intervals) {
  if (!intervals || intervals.length === 0) return null;
  return intervals
    .map(({ in: a, out: b }) => {
      const tin = (a || '').toString().substring(0, 5);
      const tout = (b || '').toString().substring(0, 5);
      return `${tin}-${tout}`;
    })
    .join(' / ');
}

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

  // Format D/M/YYYY sau D-M-YYYY (cu 1-2 cifre pentru zi È™i lunÄƒ) - ex: "8/2/2026"
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



// FuncÈ›ie pentru a converti formatul numeric al lunilor Ã®n numele lunilor

function formatMonthName(monthString) {

  const [, month] = monthString.split('-').map(Number);

  const monthNames = [

    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',

    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'

  ];

  return monthNames[month - 1];

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
  
  // State pentru horario_multicentro asignat (toate Ã®nregistrÄƒrile pentru luna selectatÄƒ)
  const [horarioMulticentroAsignado, setHorarioMulticentroAsignado] = useState(null);
  const [horariosMulticentroLista, setHorariosMulticentroLista] = useState([]); // Toate horarios_multicentro pentru luna selectatÄƒ
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

  // FuncÈ›ie pentru Ã®ncÄƒrcarea datelor complete ale utilizatorului
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
      
      // Mapeo robusto de campos - verificamos mÃºltiples variaciones
      if (found) {
        const mappedUser = {
          'CODIGO': found['CODIGO'] || found.codigo || found.CODIGO || '',
          'NOMBRE / APELLIDOS': found['NOMBRE / APELLIDOS'] || found.nombre || found.NOMBRE || '',
          'CORREO ELECTRONICO': found['CORREO ELECTRONICO'] || found.email || found.EMAIL || found['CORREO ELECTRÃ“NICO'] || '',
          'NACIONALIDAD': found['NACIONALIDAD'] || found.nacionalidad || '',
          'DIRECCION': found['DIRECCION'] || found.direccion || found['DIRECCIÃ“N'] || '',
          'D.N.I. / NIE': found['D.N.I. / NIE'] || found.dni || found.DNI || found.nie || found.NIE || '',
          'SEG. SOCIAL': found['SEG. SOCIAL'] || found['SEGURIDAD SOCIAL'] || found.seguridad_social || found.seg_social || '',
          'NÂº Cuenta': found['NÂº Cuenta'] || found.cuenta || found.CUENTA || found.numero_cuenta || '',
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
          'Fecha AntigÃ¼edad': found['Fecha AntigÃ¼edad'] || found.fecha_antiguedad || found.fechaAntiguedad || '',
          'AntigÃ¼edad': found['AntigÃ¼edad'] || found.antiguedad || '',
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
  // bannerDismissed È™i bannerStatusLoading - setter-urile sunt folosite dar state-urile nu (pentru viitor folosire)
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

  // State pentru regularizÄƒri confirmate (din MonthlyAlerts)
  const [regularizacionesConfirmadas, setRegularizacionesConfirmadas] = useState(new Map());
  const [planFuenteMap, setPlanFuenteMap] = useState(new Map()); // Map pentru plan_fuente (fiesta, etc.)
  const [detaliiZilnice, setDetaliiZilnice] = useState([]); // StocÄƒm detalii_zilnice pentru a le folosi direct Ã®n calendarCells

  

  // Demo data for CuadrantesEmpleadoPage

  const setDemoCuadrantes = () => {

    const currentDate = new Date();

    const currentYear = currentDate.getFullYear();

    const currentMonth = currentDate.getMonth() + 1;

    

    const demoCuadrantes = [

      {

        LUNA: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,

        CODIGO: 'ADM001',

        NOMBRE: 'Carlos Antonio RodrÃ­guez',

        '1': 'MaÃ±ana',

        '2': 'MaÃ±ana',

        '3': 'MaÃ±ana',

        '4': 'Tarde',

        '5': 'Tarde',

        '6': 'Libre',

        '7': 'Libre',

        '8': 'MaÃ±ana',

        '9': 'MaÃ±ana',

        '10': 'MaÃ±ana',

        '11': 'Tarde',

        '12': 'Tarde',

        '13': 'Tarde',

        '14': 'Libre',

        '15': 'Libre',

        '16': 'MaÃ±ana',

        '17': 'MaÃ±ana',

        '18': 'MaÃ±ana',

        '19': 'Tarde',

        '20': 'Tarde',

        '21': 'Tarde',

        '22': 'Libre',

        '23': 'Libre',

        '24': 'MaÃ±ana',

        '25': 'MaÃ±ana',

        '26': 'MaÃ±ana',

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

        nombre: 'Carlos Antonio RodrÃ­guez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_002',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,

        hora: '17:30:00',

        tipo: 'Salida',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio RodrÃ­guez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_003',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,

        hora: '08:15:00',

        tipo: 'Entrada',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio RodrÃ­guez',

        ubicacion: 'Madrid Centro'

      },

      {

        id: 'DEMO_FICHAJE_004',

        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,

        hora: '17:45:00',

        tipo: 'Salida',

        codigo: 'ADM001',

        nombre: 'Carlos Antonio RodrÃ­guez',

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

        motivo: 'Vacaciones de otoÃ±o',

        duracion: '08:00:00'

      },

      {

        id: 'DEMO_AUS_002',

        tipo: 'Asunto Propio',

        fecha_inicio: `${currentYear}-10-09`,

        fecha_fin: `${currentYear}-10-10`,

        FECHA_INICIO: `${currentYear}-10-09`,

        FECHA_FIN: `${currentYear}-10-10`,

        motivo: 'Cita mÃ©dica',

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



  // OPTIMIZARE: Fetch cuadrantes È™i userData Ã®n paralel pentru performanÈ›Äƒ mai bunÄƒ
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

    // ParalelizÄƒm request-urile critice
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
      
      // Detectez luna curentÄƒ È™i o setez imediat
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

    // AÈ™teptÄƒm ambele request-uri sÄƒ se termine, apoi setÄƒm loading false
    Promise.all([fetchCuadrantesPromise, fetchUserDataPromise]).finally(() => {
      setLoading(false);
    });
  }, [codigoEmpleado, authUser?.email, authUser?.isDemo, fetchUserData]);

  // FuncÈ›ie pentru a Ã®ncÄƒrca orarul asignat
  // MemoizÄƒm È™i optimizÄƒm pentru a preveni apeluri repetate
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
          // VerificÄƒm dacÄƒ horarioAsignado s-a schimbat Ã®nainte de a-l seta
          setHorarioAsignado(prev => {
            if (prev?.id === horarioMatch.id) return prev; // Nu schimbÄƒm dacÄƒ este acelaÈ™i
            return horarioMatch;
          });
        }
      }
    } catch {
      // Error loading assigned schedule
      horarioFetchedRef.current = false; // ResetÄƒm flag-ul Ã®n caz de eroare
    }
  }, [centroUsuario, grupoUsuario]);

  useEffect(() => {
    if (authUser && !authUser.isDemo && centroUsuario && grupoUsuario && !horarioFetchedRef.current) {
      fetchHorarioAsignado();
    }
  }, [authUser?.isDemo, centroUsuario, grupoUsuario, fetchHorarioAsignado]);

  // FuncÈ›ie pentru a Ã®ncÄƒrca horario_multicentro asignat
  const fetchHorarioMulticentroAsignado = useCallback(async () => {
    if (authUser?.isDemo) {
      setHorarioMulticentroAsignado(null);
      return;
    }

    const codigoParaHorario = authUser?.CODIGO || authUser?.codigo || userData?.['CODIGO'] || '';
    const emailParaHorario = authUser?.email || authUser?.EMAIL || authUser?.['CORREO ELECTRONICO'] || userData?.['CORREO ELECTRONICO'] || emailLogat || '';
    
    // DacÄƒ nu avem nici codigo, nici email, nu putem cÄƒuta
    if (!codigoParaHorario && !emailParaHorario) {
      setHorarioMulticentroAsignado(null);
      return;
    }

    // GÄƒseÈ™te horario_multicentro pentru luna selectatÄƒ
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
    
    // Previne re-apelurile inutile dacÄƒ codigo/email È™i luna nu s-au schimbat
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
      // ConstruieÈ™te URL-ul cu codigo sau email
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
        // FiltreazÄƒ toate horarios_multicentro pentru luna selectatÄƒ
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
          // StocheazÄƒ toate horarios_multicentro pentru luna selectatÄƒ
          setHorariosMulticentroLista(horariosForMonth);
          
          // GÄƒseÈ™te horario_multicentro care are orar pentru ziua curentÄƒ (dacÄƒ este luna curentÄƒ)
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;
          const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          
          let horarioForCurrentDay = null;
          if (selectedLunaNorm === currentMonthFormatted) {
            const today = new Date().getDate();
            const dayKey = `ZI_${today}`;
            
            // GÄƒseÈ™te primul horario_multicentro care are orar pentru ziua curentÄƒ (nu LIBRE)
            horarioForCurrentDay = horariosForMonth.find(horario => {
              const daySchedule = horario[dayKey] || horario[dayKey.toLowerCase()] || horario[dayKey.toUpperCase()];
              if (daySchedule) {
                const trimmed = String(daySchedule).trim();
                return trimmed !== '' && trimmed !== 'LIBRE' && trimmed !== '0' && trimmed !== '0h';
              }
              return false;
            });
          }
          
          // FoloseÈ™te horario-ul pentru ziua curentÄƒ dacÄƒ existÄƒ, altfel foloseÈ™te primul din listÄƒ
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
      console.error('Eroare la Ã®ncÄƒrcarea horario_multicentro asignat:', error);
      setHorarioMulticentroAsignado(null);
    } finally {
      setLoadingHorarioMulticentro(false);
    }
  }, [authUser, userData, selectedLuna, loadingHorarioMulticentro]);

  // ÃŽncarcÄƒ horario_multicentro cÃ¢nd se schimbÄƒ utilizatorul sau luna selectatÄƒ
  useEffect(() => {
    if (authUser?.isDemo) return;
    
    const codigoParaHorario = authUser?.CODIGO || authUser?.codigo || userData?.['CODIGO'] || '';
    const emailParaHorario = authUser?.email || authUser?.EMAIL || authUser?.['CORREO ELECTRONICO'] || userData?.['CORREO ELECTRONICO'] || emailLogat || '';
    
    // DacÄƒ avem codigo sau email È™i luna selectatÄƒ, Ã®ncÄƒrcÄƒm horario_multicentro
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


        

        // Normalizez luna selectatÄƒ pentru a o trimite la backend

        let selectedLunaNorm = selectedLuna;

        if (typeof selectedLuna === 'number') {

          selectedLunaNorm = excelDateToYYYYMM(selectedLuna);

        } else if (typeof selectedLuna === 'string') {

          // Asigur cÄƒ luna are formatul corect YYYY-MM

          const [year, month] = selectedLuna.split('-');

          if (year && month) {

            selectedLunaNorm = `${year}-${month.padStart(2, '0')}`;

          }

        }


        

        // Folosim backend-ul nou pentru registros/fichajes (nu n8n)
        const fichajesEndpoint = routes.getRegistros;
        // Backend-ul foloseÈ™te CODIGO È™i MES (cu majuscule)
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

        // AsigurÄƒ cÄƒ data este Ã®ntotdeauna un array
        const fichajesUser = Array.isArray(data) ? data : (data ? [data] : []);

        // Nu mai trebuie sÄƒ filtrÄƒm Ã®n frontend, backend-ul returneazÄƒ deja doar luna selectatÄƒ

        setFichajes(fichajesUser);

      } catch {

        setFichajes([]);

      } finally {

        setLoadingFichajes(false);

      }

    }

    

    fetchFichajes();

  }, [codigoEmpleado, selectedLuna, authUser?.isDemo]);



  // OPTIMIZARE: Lazy load regularizaciones - se Ã®ncarcÄƒ dupÄƒ ce calendarul e afiÈ™at
  useEffect(() => {
    if (authUser?.isDemo) {
      return;
    }

    // Lazy load: aÈ™teptÄƒm ca pagina principalÄƒ sÄƒ fie Ã®ncÄƒrcatÄƒ
    if (loading) {
      return;
    }

    async function fetchRegularizacionesConfirmadas() {
      if (!codigoEmpleado || !selectedLuna) return;

      setLoadingRegularizaciones(true);
      // Fetch regularizaciones

      // Normalizez luna selectatÄƒ (la fel ca Ã®n codul principal)
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

        // GÄƒsim empleado-ul curent
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

        // CreeazÄƒ un Map cu zilele care au regularizare confirmatÄƒ
        const regularizacionesMap = new Map();
        // CreeazÄƒ un Map cu plan_fuente pentru fiecare zi (pentru fiesta, etc.)
        const planFuenteMapLocal = new Map();
        detalii.forEach(d => {
          if (d?.fecha) {
            const fechaStr = typeof d.fecha === 'string' ? d.fecha.split('T')[0] : d.fecha;
            
            // VerificÄƒ regularizare confirmatÄƒ
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
        setDetaliiZilnice(detalii); // StocÄƒm detalii_zilnice pentru a le folosi direct Ã®n calendarCells
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

  // OPTIMIZARE: Banner check dupÄƒ ce pagina e afiÈ™atÄƒ (lazy load)
  useEffect(() => {
    // Lazy load: aÈ™teptÄƒm ca pagina principalÄƒ sÄƒ fie Ã®ncÄƒrcatÄƒ
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
          // DacÄƒ nu a fost dismissat, aratÄƒ modal-ul
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

  // Handler pentru Ã®nchidere modal fÄƒrÄƒ salvare (X button)
  const handleCerrarAviso = () => {
    setShowAvisoModal(false);
    // Nu salveazÄƒ - modal-ul va apÄƒrea din nou la urmÄƒtoarea intrare
  };

  // Handler pentru acceptare aviso (buton Aceptar)
  const handleAceptarAviso = async () => {
    setBannerDismissed(true);
    setShowAvisoModal(false);
    
    // Fallback la localStorage
    localStorage.setItem('avisoHorariosAceptado', 'true');
    
    // Log acÈ›iunea Ã®n BD
    if (authUser) {
      try {
        await activityLogger.logBannerHorariosDismissed(authUser);
      } catch (error) {
        console.error('Error logging banner dismissal:', error);
      }
    }
  };

  // OPTIMIZARE: Lazy load ausencias - se Ã®ncarcÄƒ dupÄƒ ce calendarul e afiÈ™at (loading = false)
  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      return;
    }

    // Lazy load: aÈ™teptÄƒm ca pagina principalÄƒ sÄƒ fie Ã®ncÄƒrcatÄƒ
    if (loading) {
      return;
    }

    async function fetchAusencias() {
      try {
        // Folosim userData Ã®n loc de authUser pentru a avea acces la CODIGO
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



  // OPTIMIZARE: Lazy load bajas mÃ©dicas - se Ã®ncarcÄƒ dupÄƒ ce calendarul e afiÈ™at
  useEffect(() => {
    if (authUser?.isDemo) {
      setBajasMedicas([]);
      lastBajasRequestKey.current = 'demo';
      return;
    }

    // Lazy load: aÈ™teptÄƒm ca pagina principalÄƒ sÄƒ fie Ã®ncÄƒrcatÄƒ
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

        // Backend-ul foloseÈ™te GET cu query param codigo (nu POST cu accion=get)
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

        // Backend-ul returneazÄƒ direct array (nu {data: [...]})
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

            item?.['CÃ³digo Empleado'] ||

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



  // Normalizez luna selectatÄƒ pentru afiÈ™are

  let selectedLunaNorm = selectedLuna;

  if (typeof selectedLuna === 'number') {

    selectedLunaNorm = excelDateToYYYYMM(selectedLuna);

  } else if (typeof selectedLuna === 'string') {

    // Asigur cÄƒ luna are formatul corect YYYY-MM

    const [year, month] = selectedLuna.split('-');

    if (year && month) {

      selectedLunaNorm = `${year}-${month.padStart(2, '0')}`;

    }

  }



  // GÄƒsesc cuadrantele pentru luna selectatÄƒ È™i utilizatorul curent
  // IMPORTANT: FiltreazÄƒ doar cuadrantele vizibile (visible === true)

  const cuadrant = cuadrantesUser.find(c => {

    let luna = c.LUNA || c.luna;

    if (typeof luna === 'number') luna = excelDateToYYYYMM(luna);
    
    // VerificÄƒ dacÄƒ luna se potriveÈ™te
    const lunaMatch = luna === selectedLunaNorm;
    
    // VerificÄƒ dacÄƒ cuadrantul este pentru utilizatorul curent
    const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailLogat.toLowerCase();
    const codigoMatch = (c.CODIGO || '').trim() === codigoEmpleado.trim();
    const nombreMatch = (c.NOMBRE || '').trim() === nombreEmpleado.trim();
    
    const isVisible = isCuadranteRowVisible(c);

    if (lunaMatch && (emailMatch || codigoMatch || nombreMatch)) {
      console.log('ðŸ” Cuadrante found for user:', {
        CODIGO: c.CODIGO,
        LUNA: luna,
        EMAIL: c.EMAIL,
        emailLogat: emailLogat,
        codigoEmpleado: codigoEmpleado,
        visible: c.visible,
        isVisible,
        emailMatch,
        codigoMatch,
        nombreMatch,
        lunaMatch,
        willMatch: lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible,
        finalResult:
          lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible
            ? 'âœ… MATCH'
            : 'âŒ NO MATCH',
      });
    }

    return lunaMatch && (emailMatch || codigoMatch || nombreMatch) && isVisible;

  });

  // VerificÄƒ dacÄƒ luna selectatÄƒ este Ã®n viitor (dupÄƒ luna curentÄƒ)
  const isFutureMonth = useMemo(() => {
    if (!selectedLunaNorm || typeof selectedLunaNorm !== 'string' || !selectedLunaNorm.includes('-')) return false;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    // ComparÄƒ luna selectatÄƒ cu luna curentÄƒ
    return selectedLunaNorm > currentMonthFormatted;
  }, [selectedLunaNorm]);

  // VerificÄƒ dacÄƒ existÄƒ date pentru luna selectatÄƒ (cuadrante, horario_multicentro sau horario normal)
  // IMPORTANT: Pentru lunile viitoare, afiÈ™Äƒm cuadrantul dacÄƒ este vizibil (visible === true)
  // DacÄƒ nu existÄƒ cuadrante vizibil pentru luna viitoare, afiÈ™Äƒm mesajul "pendiente de generaciÃ³n"
  const hasDataForMonth = cuadrant || 
                          (horariosMulticentroLista && horariosMulticentroLista.length > 0) || 
                          horarioAsignado ||
                          // Pentru lunile viitoare, dacÄƒ existÄƒ cuadrante vizibil, Ã®l afiÈ™Äƒm
                          (isFutureMonth && cuadrant);



  // Generez lista de luni disponibile din cuadrantes + luni curente

  const luniDinCuadrantes = [...new Set(cuadrantesUser.map(c => {

    let luna = c.LUNA || c.luna;

    if (typeof luna === 'number') luna = excelDateToYYYYMM(luna);

    if (typeof luna === 'string') {

      // Asigur cÄƒ luna are formatul corect YYYY-MM

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

  

  // Adaug toate lunile din anul curent (enero = 1 pÃ¢nÄƒ la decembrie = 12)

  for (let month = 1; month <= 12; month++) {

    const yearMonth = `${currentYear}-${String(month).padStart(2, '0')}`;

    luniCurente.push(yearMonth);

  }

  

  // Combin luniile din cuadrantes cu cele curente È™i elimin duplicatele

  const luniDisponibileRaw = [...new Set([...luniDinCuadrantes, ...luniCurente])];

  // GÄƒseÈ™te horario_multicentro pentru ziua curentÄƒ È™i calculeazÄƒ orarul
  const currentDayHorarioMulticentro = useMemo(() => {
    if (!horariosMulticentroLista || horariosMulticentroLista.length === 0) return null;
    
    // VerificÄƒ dacÄƒ este luna curentÄƒ
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    if (selectedLunaNorm !== currentMonthFormatted) {
      return null;
    }
    
    const today = new Date().getDate();
    const dayKey = `ZI_${today}`;
    
    // GÄƒseÈ™te horario_multicentro care are orar pentru ziua curentÄƒ
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
  
  // CalculeazÄƒ orarul zilei curente din horario_multicentro pentru ziua curentÄƒ
  const currentDayScheduleFromHorarioMulticentro = useMemo(() => {
    if (!currentDayHorarioMulticentro) return null;
    
    const today = new Date().getDate();
    const dayKey = `ZI_${today}`;
    const daySchedule = currentDayHorarioMulticentro[dayKey] || currentDayHorarioMulticentro[dayKey.toLowerCase()] || currentDayHorarioMulticentro[dayKey.toUpperCase()];
    
    if (!daySchedule) {
      return null;
    }
    
    const dayScheduleStr = String(daySchedule).trim();
    
    // VerificÄƒ dacÄƒ este LIBRE sau goalÄƒ
    if (dayScheduleStr === '' || dayScheduleStr.toUpperCase() === 'LIBRE' || dayScheduleStr === '0' || dayScheduleStr === '0h') {
      return null;
    }
    
    // VerificÄƒ dacÄƒ este un format cu timp (ex: "08:00-17:00" sau "T1 08:00-17:00")
    if (dayScheduleStr.includes('-') && dayScheduleStr.match(/\d{1,2}:\d{2}/)) {
      const match = dayScheduleStr.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
      }
      // DacÄƒ nu gÄƒseÈ™te match complet, returneazÄƒ valoarea originalÄƒ fÄƒrÄƒ prefix T1/T2/T3
      const cleaned = dayScheduleStr.replace(/^T[123]\s*/, '').trim();
      if (cleaned && cleaned !== dayScheduleStr) {
        return cleaned;
      }
      return dayScheduleStr;
    }
    
    // VerificÄƒ dacÄƒ este un numÄƒr (ore)
    if (!isNaN(parseFloat(dayScheduleStr))) {
      const hours = parseFloat(dayScheduleStr);
      return `${hours}h`;
    }
    
    // Pentru orice alt format (ex: "TURNO DIA", "T1", etc.), returneazÄƒ ca atare
    // dar doar dacÄƒ nu este "LIBRE" sau goalÄƒ
    if (dayScheduleStr && dayScheduleStr.length > 0) {
      // DacÄƒ Ã®ncepe cu T1/T2/T3, returneazÄƒ fÄƒrÄƒ prefix
      const cleaned = dayScheduleStr.replace(/^T[123]\s*/, '').trim();
      return cleaned || dayScheduleStr;
    }
    
    return null;
  }, [currentDayHorarioMulticentro]);

  

  // Filtrez doar luniile relevante: ultimele 3 luni din anul anterior + toate lunile din anul curent

  // È˜i le sortez cronologic

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

    

    // SortÄƒm cronologic (an, apoi lunÄƒ)

    if (yearA !== yearB) return yearA - yearB;

    return monthA - monthB;

  });

  

  const isLunaValida = typeof selectedLunaNorm === 'string' && selectedLunaNorm.includes('-');



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

        // MutuaCasos / MySQL: coloana realÄƒ este Â«Fecha de altaÂ», nu Â«Fecha altaÂ»
        'Fecha de alta',

        'Fecha De Alta',

        'Fecha alta',

        'Fecha Alta',

        'fecha_de_alta',

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

        baja?.['SituaciÃ³n'] ||

        baja?.Situacion ||

        baja?.situacion ||

        baja?.estado ||

        '';



      const motivo =

        situacion ||

        baja?.motivo ||

        baja?.['Motivo'] ||

        'Baja mÃ©dica';



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
  // Folosim useMemo pentru a preveni recalculÄƒri inutile È™i re-render-uri Ã®n cascadÄƒ
  const calendarCells = useMemo(() => {
    const cells = [];
    
    if (!isLunaValida) return cells;

    const [year, month] = selectedLunaNorm.split('-').map(Number);

    const daysInMonth = getDaysInMonth(month - 1, year);

    

    // GÄƒsesc prima zi a lunii (0 = duminicÄƒ, 1 = luni, etc.)

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Convertesc la luni = 0

    

    // Adaug celule goale pentru zilele din luna anterioarÄƒ

    for (let i = 0; i < startDay; i++) {

      cells.push(null);

    }

    

    // Adaug zilele lunii

    let day = 1;

    for (let i = 0; i < daysInMonth; i++) {

      const dataZi = formatDateYMD(year, month, day);

      if (day === 3) {
        // Calculare celulÄƒ pentru day 3
      }

      const fechaZi = new Date(year, month - 1, day);

      

      // VerificÄƒ absenÈ›e È™i solicitÄƒri pentru aceastÄƒ zi (prioritate)

      let tip = 'LIBRE';

      let orar = '';

      let motivoAusencia = '';

      let bajaCalendar = null;
      
      // Pentru horario_multicentro, adÄƒugÄƒm informaÈ›ia despre orele programate (ZI_X) pentru aceastÄƒ zi
      let horarioMulticentroHours = null;
      /** Valoarea brutÄƒ ZI (cuadrante / horario) pentru parsare turno compartido Ã®n CalendarDayCell */
      let ziRaw = null;



      if (bajasCalendar.length > 0) {

        bajaCalendar = bajasCalendar.find((baja) => {

          if (!baja?.start || !baja?.end) return false;

          return fechaZi >= baja.start && fechaZi <= baja.end;

        }) || null;

      }

      

      // CautÄƒ Ã®n ausencias (prioritate 1) - suportÄƒ È™i intervale de date
      // SortÄƒm lista pentru a priorita Ã®nregistrÄƒrile cu intervale mai mici (mai specifice)
      const ausenciasSorted = [...ausencias].sort((a, b) => {
        const aInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;
        const aFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;
        const bInicio = b.fecha_inicio || b.fechaInicio || b.FECHA_INICIO;
        const bFin = b.fecha_fin || b.fechaFin || b.FECHA_FIN;
        
        const aInicioDate = parseFlexibleDate(aInicio);
        const aFinDate = parseFlexibleDate(aFin);
        const bInicioDate = parseFlexibleDate(bInicio);
        const bFinDate = parseFlexibleDate(bFin);
        
        // CalculeazÄƒ durata intervalului
        const aDuration = aInicioDate && aFinDate ? aFinDate - aInicioDate : Infinity;
        const bDuration = bInicioDate && bFinDate ? bFinDate - bInicioDate : Infinity;
        
        // PrioritizeazÄƒ intervalele mai mici (mai specifice)
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

        

        // VerificÄƒ data exactÄƒ (pentru zile individuale)

        if (ausenciaFecha && ausenciaFecha.startsWith(dataZi)) {


          return true;

        }

        

        // VerificÄƒ interval de date (pentru perioade)
        // ÃŽncearcÄƒ mai Ã®ntÃ¢i fecha_inicio/fecha_fin, apoi extrage din FECHA
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
          // NormalizeazÄƒ ambele date la Ã®nceputul zilei (00:00:00) pentru comparare corectÄƒ
          const inicioNormalizat = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
          // SeteazÄƒ fin la sfÃ¢rÈ™itul zilei (23:59:59.999) pentru a include ziua de sfÃ¢rÈ™it
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

      

      // EliminatÄƒ verificarea separatÄƒ â€” vacanÈ›ele È™i asuntos propio sunt tratate Ã®n ausencias

      

      // DeterminÄƒ tipul zilei
      // VerificÄƒ plan_fuente din backend pentru fiesta (prioritate dupÄƒ bajaCalendar È™i ausenciaZi)
      // Folosim detaliiZilnice direct dacÄƒ planFuenteMap este Ã®ncÄƒ gol (pentru a evita flickering)
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
        console.log('ðŸ” [DAY 1] Calcul calendarCells:', {
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

        tip = 'Baja MÃ©dica';

        motivoAusencia = bajaCalendar.motivo || 'Baja mÃ©dica';

      } else if (ausenciaZi) {

        // ÃŽncearcÄƒ mai Ã®ntÃ¢i TIPO, apoi tipo, apoi fallback la 'AUSENCIA'
        tip = ausenciaZi.TIPO || ausenciaZi.tipo || 'AUSENCIA';

        // ÃŽncearcÄƒ mai Ã®ntÃ¢i MOTIVO, apoi motivo
        motivoAusencia = ausenciaZi.MOTIVO || ausenciaZi.motivo || '';

      } else if (planFuente === 'fiesta') {
        // DacÄƒ plan_fuente este 'fiesta', setÄƒm tip = 'Fiesta' (prioritate dupÄƒ bajaCalendar È™i ausenciaZi)
        // Asta previne flickering-ul cÃ¢nd datele se Ã®ncarcÄƒ
        tip = 'Fiesta';
        orar = '';
        
        // LOG pentru ziua 1
        if (day === 1) {
          console.log('âœ… [DAY 1] Setat tip = Fiesta (din planFuente === fiesta)');
        }
        
        // ContinuÄƒm cu push-ul celulei, fÄƒrÄƒ sÄƒ mai verificÄƒm cuadrant/horario
        cells.push({
          day,
          tip,
          orar,
          alertaFichaj: false, // Fiesta nu are alertaFichaj
          durataMunca: '', // Fiesta nu are durataMunca
          motivoAusencia,
          ausenciaZi,
          bajaCalendar,
          planFuente // AdÄƒugÄƒm planFuente Ã®n cell pentru a-l folosi Ã®n CalendarDayCell
        });
        day++;
        continue; // SÄƒrim peste restul logicii pentru aceastÄƒ zi
      } else if (cuadrant) {

        // FoloseÈ™te cuadrante dacÄƒ nu existÄƒ absenÈ›e - PRIORITATE ABSOLUTÄ‚

        const ziKey = `ZI_${day}`;

        const tipZi = cuadrant[ziKey] || cuadrant[`zi_${day}`];

        if (tipZi) {
          const tipZiStr = String(tipZi).trim();
          
          // VerificÄƒ dacÄƒ este LIBRE sau goalÄƒ
          if (tipZiStr === '' || tipZiStr.toUpperCase() === 'LIBRE' || tipZiStr.toUpperCase() === 'LIB') {
            tip = 'LIBRE';
            orar = '';
          }
          // VerificÄƒ formatele T1, T2, T3 (ex: "T1 08:00-17:00" sau "T2 14:00-22:00")
          else if (tipZiStr.startsWith('T1') || tipZiStr.startsWith('T2') || tipZiStr.startsWith('T3')) {
            // VerificÄƒ din nou plan_fuente Ã®nainte de a seta tip = 'T1'/'T2'/'T3'
            // DacÄƒ datele se Ã®ncarcÄƒ Ã®ncÄƒ È™i nu È™tim Ã®ncÄƒ plan_fuente, nu setÄƒm tip definitiv
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
              if (day === 1) {
                console.log('âœ… [DAY 1] Setat tip = Fiesta (din cuadrant, planFuente === fiesta)');
              }
            } else if (loadingRegularizaciones && !planFuente) {
              // DacÄƒ datele se Ã®ncarcÄƒ Ã®ncÄƒ, rÄƒmÃ¢ne LIBRE pÃ¢nÄƒ cÃ¢nd datele se Ã®ncarcÄƒ
              tip = 'LIBRE';
              orar = '';
              if (day === 1) {
                console.log('â³ [DAY 1] Setat tip = LIBRE (loadingRegularizaciones && !planFuente)');
              }
            } else {
              ziRaw = tipZiStr;
              const turnMatch = tipZiStr.match(/^(T[123])\s*(.*)$/);
              if (isCuadranteTurnoCompartidoDisplay(tipZiStr)) {
                tip = 'TC';
                orar =
                  formatCuadranteIntervalsForDisplay(tipZiStr) ||
                  (turnMatch ? (turnMatch[2] || '').trim() : '') ||
                  tipZiStr;
              } else if (turnMatch) {
                tip = turnMatch[1];
                orar = turnMatch[2] || '';
              } else {
                tip = tipZiStr.startsWith('T1') ? 'T1' : tipZiStr.startsWith('T2') ? 'T2' : 'T3';
                orar = tipZiStr.replace(/^T[123]\s*/, '');
              }
              if (day === 1) {
                console.log('âš ï¸ [DAY 1] Setat tip =', tip, '(din cuadrant, fÄƒrÄƒ planFuente)');
              }
            }
          }
          // VerificÄƒ dacÄƒ este un orar direct (ex: "08:00-17:00" sau "09:00-15:00 / 16:00-20:00")
          else if (tipZiStr.match(/^\d{1,2}:\d{2}/)) {
            // VerificÄƒ din nou plan_fuente Ã®nainte de a seta tip = 'T1'
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              ziRaw = tipZiStr;
              if (isCuadranteTurnoCompartidoDisplay(tipZiStr)) {
                tip = 'TC';
                orar = formatCuadranteIntervalsForDisplay(tipZiStr) || tipZiStr;
              } else {
                tip = 'T1';
                orar = tipZiStr;
              }
            }
          }
          // Altfel, seteazÄƒ ca LIBRE sau Fiesta
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
          // DacÄƒ cuadrant existÄƒ dar nu are valoare pentru aceastÄƒ zi, rÄƒmÃ¢ne LIBRE (valoarea default)
          tip = 'LIBRE';
          orar = '';
        }

      } else if (horariosMulticentroLista && horariosMulticentroLista.length > 0) {
        // FoloseÈ™te horario_multicentro DOAR dacÄƒ nu existÄƒ cuadrant pentru luna respectivÄƒ
        // Pentru fiecare zi, verificÄƒ toate horario_multicentro pentru acea zi specificÄƒ
        const ziKey = `ZI_${day}`;
        
        // Pentru horario_multicentro, verificÄƒm dacÄƒ existÄƒ VREUN horario Ã®n listÄƒ pentru luna respectivÄƒ
        // DacÄƒ existÄƒ horariosMulticentroLista, Ã®nseamnÄƒ cÄƒ angajatul are horario_multicentro pentru luna respectivÄƒ
        // Pentru fiecare zi, trebuie sÄƒ verificÄƒm ce valoare are Ã®n horario_multicentro
        
        // GÄƒseÈ™te toate horario_multicentro care au o valoare (chiar È™i null/undefined/LIBRE) pentru aceastÄƒ zi
        // IMPORTANT: Pentru horario_multicentro, dacÄƒ existÄƒ orice horario Ã®n listÄƒ, verificÄƒm valoarea pentru acea zi
        let horarioForDay = null;
        let hasHorarioMulticentroForDay = false; // Flag pentru a È™ti dacÄƒ existÄƒ vreun horario_multicentro care acoperÄƒ aceastÄƒ zi
        
        for (const horario of horariosMulticentroLista) {
          // VerificÄƒ toate variantele de caz (uppercase, lowercase, mixed)
          const daySchedule = horario[ziKey] ?? horario[ziKey.toLowerCase()] ?? horario[ziKey.toUpperCase()] ?? null;
          
          // IMPORTANT: DacÄƒ horario_multicentro existÄƒ pentru luna respectivÄƒ, Ã®nseamnÄƒ cÄƒ acoperÄƒ TOATE zilele lunii
          // Chiar dacÄƒ pentru o zi specificÄƒ, ZI_X este null/undefined/LIBRE/gol/0/0h, Ã®nseamnÄƒ cÄƒ acea zi este LIBRE din horario_multicentro
          // SetÄƒm hasHorarioMulticentroForDay = true pentru TOATE zilele, pentru cÄƒ horario_multicentro acoperÄƒ Ã®ntreaga lunÄƒ
          hasHorarioMulticentroForDay = true;
          
          // GÄƒseÈ™te primul horario care are o valoare REALÄ‚ (nu LIBRE/gol/0/0h/null) pentru aceastÄƒ zi
          if (daySchedule !== null && daySchedule !== undefined) {
            const dayScheduleStr = String(daySchedule).trim();
            if (dayScheduleStr !== '' && dayScheduleStr.toUpperCase() !== 'LIBRE' && dayScheduleStr !== '0' && dayScheduleStr !== '0h') {
              horarioForDay = horario;
              break; // Folosim primul horario gÄƒsit care nu este LIBRE
            }
          }
        }
        
        // DacÄƒ existÄƒ cel puÈ›in un horario_multicentro care acoperÄƒ aceastÄƒ zi
        if (hasHorarioMulticentroForDay) {
          // DacÄƒ gÄƒsim un horario cu orar real (nu LIBRE)
          if (horarioForDay) {
            const daySchedule = horarioForDay[ziKey] || horarioForDay[ziKey.toLowerCase()] || horarioForDay[ziKey.toUpperCase()];
            const dayScheduleStr = String(daySchedule || '').trim();
            
            // CalculÄƒm orele programate pentru horarioMulticentroHours (folosit mai tÃ¢rziu Ã®n CalendarDayCell)
            if (!isNaN(parseFloat(dayScheduleStr)) && isFinite(dayScheduleStr)) {
              horarioMulticentroHours = parseFloat(dayScheduleStr);
            }
            
            // VerificÄƒ formatele T1, T2, T3 (ex: "T1 08:00-17:00" sau "T2 14:00-22:00")
            if (dayScheduleStr.startsWith('T1') || dayScheduleStr.startsWith('T2') || dayScheduleStr.startsWith('T3')) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                ziRaw = dayScheduleStr;
                const turnMatch = dayScheduleStr.match(/^(T[123])\s*(.*)$/);
                if (isCuadranteTurnoCompartidoDisplay(dayScheduleStr)) {
                  tip = 'TC';
                  orar =
                    formatCuadranteIntervalsForDisplay(dayScheduleStr) ||
                    (turnMatch ? (turnMatch[2] || '').trim() : '') ||
                    dayScheduleStr;
                } else if (turnMatch) {
                  tip = turnMatch[1];
                  orar = turnMatch[2] || '';
                } else {
                  tip = dayScheduleStr.startsWith('T1') ? 'T1' : dayScheduleStr.startsWith('T2') ? 'T2' : 'T3';
                  orar = dayScheduleStr.replace(/^T[123]\s*/, '');
                }
              }
            }
            // VerificÄƒ dacÄƒ este un orar direct (ex: "08:00-17:00" sau "09:00-15:00 / 16:00-20:00")
            else if (dayScheduleStr.match(/^\d{1,2}:\d{2}/)) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                ziRaw = dayScheduleStr;
                if (isCuadranteTurnoCompartidoDisplay(dayScheduleStr)) {
                  tip = 'TC';
                  orar = formatCuadranteIntervalsForDisplay(dayScheduleStr) || dayScheduleStr;
                } else {
                  tip = 'T1';
                  orar = dayScheduleStr;
                }
              }
            }
            // DacÄƒ este un numÄƒr (ore), afiÈ™Äƒm doar numÄƒrul de ore (ex: "8h")
            else if (!isNaN(parseFloat(dayScheduleStr)) && isFinite(dayScheduleStr)) {
              if (planFuente === 'fiesta') {
                tip = 'Fiesta';
                orar = '';
              } else {
                const hours = parseFloat(dayScheduleStr);
                if (hours > 0) {
                  tip = 'T1';
                  // Pentru horario_multicentro, afiÈ™Äƒm doar numÄƒrul de ore (ex: "8h" sau "12h")
                  orar = `${hours}h`;
                } else {
                  tip = 'LIBRE';
                  orar = '';
                }
              }
            }
            // Altfel, seteazÄƒ ca LIBRE sau Fiesta
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
            // Nu s-a gÄƒsit un horario cu orar real pentru aceastÄƒ zi, dar existÄƒ horario_multicentro care acoperÄƒ aceastÄƒ zi
            // ÃŽnseamnÄƒ cÄƒ toate horario_multicentro pentru aceastÄƒ zi sunt LIBRE/gol/0/0h/null
            // SetÄƒm explicit LIBRE (nu verificÄƒm horarioAsignado!)
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              tip = 'LIBRE';
              orar = '';
            }
          }
        } else {
          // DacÄƒ nu existÄƒ horario_multicentro pentru aceastÄƒ zi, verificÄƒ horario normal
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
                  ziRaw = ziRawFromHorarioIntervals(intervals);
                  if (intervals.length > 1) {
                    tip = 'TC';
                    orar = formatCuadranteIntervalsForDisplay(ziRaw) || ziRaw;
                  } else {
                    tip = 'T1';
                    orar = intervals.map(interval => `${interval.in}-${interval.out}`).join(', ');
                  }
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
            // Default pentru lunile fÄƒrÄƒ cuadrante È™i fÄƒrÄƒ horario_multicentro: Luni-Vineri = T1, SÃ¢mbÄƒtÄƒ-DuminicÄƒ = LIBRE
            if (planFuente === 'fiesta') {
              tip = 'Fiesta';
              orar = '';
            } else {
              const dayOfWeek = new Date(year, month - 1, day).getDay();
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                tip = 'T1';
                orar = '08:00-17:00';
                ziRaw = '08:00-17:00';
              } else {
                tip = 'LIBRE';
              }
            }
          }
        }

      } else {

        // FoloseÈ™te orarul asignat dacÄƒ existÄƒ, altfel default
        if (horarioAsignado) {
          const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = DuminicÄƒ, 1 = Luni, etc.
          const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dayOfWeek]; // DuminicÄƒ = D, Luni = L, etc.
          
          // VerificÄƒ dacÄƒ existÄƒ interval pentru aceastÄƒ zi Ã®n orarul asignat
          const daySchedule = horarioAsignado.days?.[dayKey];
          
          if (daySchedule) {
            // Extrage intervalele din structura backend (in1/out1, in2/out2, in3/out3)
            const intervals = [];
            
            // VerificÄƒ primul interval
            if (daySchedule.in1 && daySchedule.out1) {
              intervals.push({in: daySchedule.in1, out: daySchedule.out1});
            }
            
            // VerificÄƒ al doilea interval
            if (daySchedule.in2 && daySchedule.out2) {
              intervals.push({in: daySchedule.in2, out: daySchedule.out2});
            }
            
            // VerificÄƒ al treilea interval
            if (daySchedule.in3 && daySchedule.out3) {
              intervals.push({in: daySchedule.in3, out: daySchedule.out3});
            }
            
            if (intervals.length > 0) {
              // VerificÄƒ din nou plan_fuente Ã®nainte de a seta tip = 'T1'
              // DacÄƒ plan_fuente este 'fiesta', nu setÄƒm tip = 'T1'
              if (planFuente !== 'fiesta') {
                ziRaw = ziRawFromHorarioIntervals(intervals);
                if (intervals.length > 1) {
                  tip = 'TC';
                  orar = formatCuadranteIntervalsForDisplay(ziRaw) || ziRaw;
                } else {
                  tip = 'T1';
                  orar = intervals.map(interval => `${interval.in}-${interval.out}`).join(', ');
                }
              } else {
                tip = 'Fiesta';
                orar = '';
              }
            } else {
              tip = 'LIBRE';
            }
          } else {
            // Nu existÄƒ interval pentru aceastÄƒ zi
            // VerificÄƒ din nou plan_fuente Ã®nainte de a seta tip = 'LIBRE'
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
          // Default pentru lunile fÄƒrÄƒ cuadrante: Luni-Vineri = T1, SÃ¢mbÄƒtÄƒ-DuminicÄƒ = LIBRE
          // VerificÄƒ din nou plan_fuente Ã®nainte de a seta tip
          if (planFuente === 'fiesta') {
            tip = 'Fiesta';
            orar = '';
          } else {
            const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = DuminicÄƒ, 1 = Luni, etc.
            
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Luni pÃ¢nÄƒ Vineri
              tip = 'T1';
              orar = '08:00-17:00'; // Program standard
              ziRaw = '08:00-17:00';
            } else { // SÃ¢mbÄƒtÄƒ È™i DuminicÄƒ
              tip = 'LIBRE';
            }
          }
          
          // Debug pentru default
        }

      }

      

      // Logica pentru alertaFichaj È™i durataMunca s-a mutat Ã®n CalendarDayCell

      // LOG pentru ziua 1 - final
      if (day === 1) {
        console.log('ðŸ“ [DAY 1] Final push cell:', {
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

        // alertaFichaj È™i durataMunca se calculeazÄƒ Ã®n CalendarDayCell
        alertaFichaj: false, // placeholder, se calculeazÄƒ Ã®n componentÄƒ
        durataMunca: '', // placeholder, se calculeazÄƒ Ã®n componentÄƒ

        motivoAusencia,

        ausenciaZi,

        bajaCalendar,

        planFuente, // AdÄƒugÄƒm planFuente Ã®n cell pentru a-l folosi Ã®n CalendarDayCell
        
        // AdÄƒugÄƒm informaÈ›ia despre orele programate din horario_multicentro pentru aceastÄƒ zi
        horarioMulticentroHours,

        ...(ziRaw ? { ziRaw } : {})

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
    
    // CalculeazÄƒ totalul de ore indiferent dacÄƒ existÄƒ sau nu un cuadrant asignat.
    // Este suficient sÄƒ avem fiÈ™aje (fichajes) pentru luna selectatÄƒ.
    if (!fichajes || !fichajes.length || !selectedLunaNorm) return;


    const [year, month] = selectedLunaNorm.split('-').map(Number);

    let totalMinute = 0;
    let totalSeconds = 0;

    // Filtrez fichajes pentru luna selectatÄƒ
    const fichajesLunaSelectata = fichajes.filter(f => {
      const fecha = f["FECHA"] || '';
      // Verific dacÄƒ data Ã®ncepe cu YYYY-MM corespunzÄƒtor lunii selectate
      const fechaPrefix = `${year}-${String(month).padStart(2, '0')}`;
      return fecha.startsWith(fechaPrefix);
    });

    // CalculeazÄƒ orele: dacÄƒ existÄƒ regularizare, foloseÈ™te regularizarea, altfel foloseÈ™te DURACION
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

    // Pentru fiecare Salida, foloseÈ™te regularizarea dacÄƒ existÄƒ, altfel DURACION
    // Pentru turele nocturne, regularizarea este pe workday_date (ziua de Ã®nceput)
    // Dar DURACION este Ã®n Salida de pe ziua de sfÃ¢rÈ™it, deci trebuie sÄƒ procesÄƒm corect
    fichajesLunaSelectata
      .filter(f => f["TIPO"] === 'Salida')
      .forEach(f => {
        // Prioritate 1: effective_minutes (regularizare confirmatÄƒ)
        if (f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) {
          const effectiveMinutes = Number(f["effective_minutes"]);
          if (!isNaN(effectiveMinutes) && effectiveMinutes > 0) {
            totalMinute += effectiveMinutes;
            totalSeconds += effectiveMinutes * 60;
          }
        } 
        // Prioritate 2: effective_duration (regularizare confirmatÄƒ)
        else if (f["effective_duration"] && f["effective_duration"].trim() !== '') {
          const durationStr = f["effective_duration"].trim();
          const secFromDuration = parseHHMMSS(durationStr);
          if (secFromDuration > 0) {
            totalSeconds += secFromDuration;
            totalMinute += Math.floor(secFromDuration / 60);
          }
        }
        // Prioritate 3: DURACION (cÃ¢nd nu existÄƒ regularizare)
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



  // Registrele pentru ziua selectatÄƒ

  let registreZi = [];

  if (ziSelectata && ziSelectata.day) {

    const [year, month] = selectedLunaNorm.split('-').map(Number);

    const dataZi = formatDateYMD(year, month, ziSelectata.day);

    registreZi = fichajes.filter(f => (f["FECHA"] || '').startsWith(dataZi));

  }



  // Generez lista de erori

  const erori = [];

  // IMPORTANT: Nu afiÈ™Äƒm alerta dacÄƒ fichajes sau regularizÄƒrile sunt Ã®ncÄƒ Ã®n proces de Ã®ncÄƒrcare
  if (!loading && !loadingFichajes && !loadingRegularizaciones && cuadrant) {

    const zileCuAlerta = calendarCells.filter(
      (cell) =>
        cell && ['T1', 'T2', 'T3', 'TC'].includes(cell.tip) && cell.alertaFichaj
    );

    if (zileCuAlerta.length > 0) {
      erori.push(`Tienes ${zileCuAlerta.length} dÃ­a${zileCuAlerta.length === 1 ? '' : 's'} laborable${zileCuAlerta.length === 1 ? '' : 's'} con turnos incompletos (falta Entrada o Salida) en el mes seleccionado!`);
    }
  }





  // FuncÈ›ie pentru obÈ›inerea locaÈ›iei automate folosind contextul global
  // MutatÄƒ aici pentru a fi disponibilÄƒ Ã®n handleResolveAlert
  const handleGetCurrentLocation = useCallback(async () => {
    try {
      // Folosim contextul global pentru locaÈ›ie
      const coords = await getCurrentLocation();
      const { latitude, longitude } = coords;

      // ObÈ›ine adresa folosind funcÈ›ia din context
      const address = await getAddressFromCoords(latitude, longitude);

      if (address) {
        setFichajeAddress(address);
        alert('Â¡La ubicaciÃ³n se ha obtenido automÃ¡ticamente!');
      } else {
        // Fallback la coordonatele GPS
        setFichajeAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        alert('No se pudo obtener la direcciÃ³n para la ubicaciÃ³n actual.');
      }

    } catch (error) {

      if (error.code === 1) {

        alert('El acceso a la ubicaciÃ³n fue denegado. Por favor permite el acceso en la configuraciÃ³n del navegador.');

      } else if (error.code === 2) {

        alert('No se pudo obtener la ubicaciÃ³n. Por favor verifica tu conexiÃ³n a internet.');

      } else {

        alert('Error al obtener la ubicaciÃ³n. Por favor intenta de nuevo.');

      }

    }

  }, [getCurrentLocation, getAddressFromCoords]);

  // FuncÈ›ii pentru rezolvarea alertelor
  // MemoizÄƒm pentru a preveni re-render-uri inutile ale CalendarDayCell

  const handleResolveAlert = useCallback((cell) => {

    if (cell.alertaFichaj) {

      // VerificÄƒ dacÄƒ ziua este ziua curentÄƒ

      const currentDate = new Date();

      const currentYear = currentDate.getFullYear();

      const currentMonth = currentDate.getMonth() + 1;

      const currentDay = currentDate.getDate();

      

      const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);

      

      // VerificÄƒ dacÄƒ este ziua curentÄƒ

      const isCurrentDay = selectedYear === currentYear && 

                          selectedMonth === currentMonth && 

                          cell.day === currentDay;

      

      if (!isCurrentDay) {

        alert('Â¡Solo puedes modificar el dÃ­a actual! No puedes aÃ±adir fichajes para dÃ­as anteriores o futuros.');

        return;

      }

      

      setSelectedDayForFichaje(cell);

      setFichajeType('Entrada');

      setFichajeTime('');

      setFichajeAddress('');

      setShowFichajeModal(true);

      

      // ÃŽncearcÄƒ sÄƒ obÈ›inÄƒ locaÈ›ia automatÄƒ cÃ¢nd se deschide modalul

      setTimeout(() => {

        handleGetCurrentLocation();

      }, 500);

    } else {

      setZiSelectata(cell);

    }

  }, [selectedLunaNorm, handleGetCurrentLocation]);



  // FuncÈ›ie pentru "Indicar motivo" (zile trecute fÄƒrÄƒ fichajes)
  const handleIndicarMotivo = useCallback((cell) => {
    const [year, month] = selectedLunaNorm.split('-').map(Number);
    const dataZi = formatDateYMD(year, month, cell.day);
    
    // ObÈ›ine orarul planificat din cell (dacÄƒ existÄƒ)
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

      alert('Â¡Por favor completa la hora!');

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

        DIRECCION: fichajeAddress || 'UbicaciÃ³n automÃ¡tica',

        CORREO_ELECTRONICO: emailLogat,

        ESTADO: 'PENDIENTE', // ÃŽn aÈ™teptare de aprobare

        MODIFICADO_POR: authUser?.['NOMBRE / APELLIDOS'] || emailLogat,

        FECHA_CREACION: new Date().toISOString()

      };



      // Adaug la lista de pontaje Ã®n aÈ™teptare

      setPendingFichajes(prev => [...prev, newFichaje]);

      

      // Salvez Ã®n baza de date (Ã®n aÈ™teptare)

      // Folosim backend-ul nou pentru fichajes (addFichaje poate gestiona È™i fichajes pendiente)
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

        alert(`Â¡Fichaje ${fichajeType} registrado con Ã©xito! Pendiente de aprobaciÃ³n.`);

        setShowFichajeModal(false);

        // ReÃ®ncarc pontaje pentru a actualiza lista

        // fetchFichajes();

      } else {

        alert('Â¡Error al guardar el fichaje!');

      }

    } catch {

      alert('Â¡Error al guardar el fichaje!');

    } finally {

      setSubmittingFichaje(false);

    }

  };



  const handleAddAnotherFichaje = () => {

    // Schimb tipul pentru urmÄƒtorul pontaj

    setFichajeType(fichajeType === 'Entrada' ? 'Salida' : 'Entrada');

    setFichajeTime('');

    setFichajeAddress('');

  };




  const isCurrentMonthSelected = useMemo(() => {
    const now = new Date();
    const [y, m] = selectedLunaNorm.split('-').map(Number);
    return y === now.getFullYear() && m === now.getMonth() + 1;
  }, [selectedLunaNorm]);

  const todayCell = useMemo(() => {
    if (!isCurrentMonthSelected) return null;
    const now = new Date();
    return calendarCells.find((c) => c && c.day === now.getDate()) || null;
  }, [calendarCells, isCurrentMonthSelected]);

  const currentBaja = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bajasCalendar.find((baja) => {
      if (!baja?.start || !baja?.end) return false;
      const situacion = (baja.situacion || '').toUpperCase();
      if (situacion === 'ALTA' || situacion === 'ALTA MÃ‰DICA' || situacion === 'ALTA MEDICA') {
        return false;
      }
      if (baja.raw) {
        const fechaAltaRaw =
          baja.raw['Fecha de alta'] ||
          baja.raw['Fecha De Alta'] ||
          baja.raw['Fecha alta'] ||
          baja.raw['Fecha Alta'] ||
          baja.raw.fecha_de_alta ||
          baja.raw.fecha_alta ||
          baja.raw.fechaAlta ||
          baja.raw.FECHA_ALTA ||
          baja.raw['FECHA ALTA'] ||
          '';
        if (fechaAltaRaw) {
          const fechaAltaDate = new Date(fechaAltaRaw);
          if (!Number.isNaN(fechaAltaDate.getTime())) {
            fechaAltaDate.setHours(0, 0, 0, 0);
            if (fechaAltaDate < today) return false;
          }
        }
      }
      if (baja.endDate) {
        const endDateObj = new Date(baja.endDate);
        if (!Number.isNaN(endDateObj.getTime())) {
          endDateObj.setHours(0, 0, 0, 0);
          if (endDateObj < today) return false;
        }
      }
      return today >= baja.start && today <= baja.end;
    }) || null;
  }, [bajasCalendar]);


  if (loading) {
    return (
      <div className="app-page mi-horario-page">
        <PageHeader title="Mi Horario" backTo="/inicio" />
        <AlertBanner variant="loading" loading>Cargando horario...</AlertBanner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page mi-horario-page">
        <PageHeader title="Mi Horario" backTo="/inicio" />
        <AlertBanner variant="danger" title="Error">{error}</AlertBanner>
      </div>
    );
  }

  return (
    <CuadrantesEmpleadoShell
      identidadDisplay={identidadDisplay}
      authUser={authUser}
      userData={userData}
      cuadrantesUser={cuadrantesUser}
      cuadrant={cuadrant}
      horarioMulticentroAsignado={horarioMulticentroAsignado}
      horarioAsignado={horarioAsignado}
      selectedLunaNorm={selectedLunaNorm}
      selectedLuna={selectedLuna}
      setSelectedLuna={setSelectedLuna}
      luniDisponibile={luniDisponibile}
      formatMonthName={formatMonthName}
      currentDayHorarioMulticentro={currentDayHorarioMulticentro}
      currentDayScheduleFromHorarioMulticentro={currentDayScheduleFromHorarioMulticentro}
      currentBaja={currentBaja}
      erori={erori}
      totalOreMunca={totalOreMunca}
      showAvisoModal={showAvisoModal}
      handleCerrarAviso={handleCerrarAviso}
      handleAceptarAviso={handleAceptarAviso}
      hasDataForMonth={hasDataForMonth}
      loading={loading}
      loadingHorarioMulticentro={loadingHorarioMulticentro}
      calendarCells={calendarCells}
      ziSelectata={ziSelectata}
      registreZi={registreZi}
      pendingFichajes={pendingFichajes}
      handleResolveAlert={handleResolveAlert}
      handleIndicarMotivo={handleIndicarMotivo}
      regularizacionesConfirmadas={regularizacionesConfirmadas}
      loadingFichajes={loadingFichajes}
      loadingRegularizaciones={loadingRegularizaciones}
      fichajes={fichajes}
      horariosMulticentroLista={horariosMulticentroLista}
      todayCell={todayCell}
      isCurrentMonthSelected={isCurrentMonthSelected}
      showFichajeModal={showFichajeModal}
      setShowFichajeModal={setShowFichajeModal}
      selectedDayForFichaje={selectedDayForFichaje}
      fichajeType={fichajeType}
      setFichajeType={setFichajeType}
      fichajeTime={fichajeTime}
      setFichajeTime={setFichajeTime}
      fichajeAddress={fichajeAddress}
      setFichajeAddress={setFichajeAddress}
      submittingFichaje={submittingFichaje}
      handleSubmitFichaje={handleSubmitFichaje}
      handleAddAnotherFichaje={handleAddAnotherFichaje}
      getCurrentLocation={getCurrentLocation}
      showNoPunchModal={showNoPunchModal}
      setShowNoPunchModal={setShowNoPunchModal}
      selectedDayForNoPunch={selectedDayForNoPunch}
      setSelectedDayForNoPunch={setSelectedDayForNoPunch}
    />
  );

}
