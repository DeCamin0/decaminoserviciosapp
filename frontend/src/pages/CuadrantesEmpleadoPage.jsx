import { useState, useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';

import { Button, Modal, Input } from '../components/ui';

import Back3DButton from '../components/Back3DButton.jsx';

import { routes } from '../utils/routes.js';



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


function formatDateForDebug(date) {

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {

    return 'invalid-date';

  }

  return date.toISOString().split('T')[0];

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
  
  // State pentru datele complete ale utilizatorului
  const [userData, setUserData] = useState(null);
  const lastBajasRequestKey = useRef('');

  const empleadoCodigo = String(userData?.['CODIGO'] || codigoEmpleado || '').trim();
  const empleadoNombre = String(
    userData?.['NOMBRE / APELLIDOS'] ||
    nombreEmpleado ||
    ''
  ).trim();

  // Funcție pentru încărcarea datelor complete ale utilizatorului
  const fetchUserData = useCallback(async () => {
    try {
      const email = authUser?.email;
      if (!email) return;

      // Skip real data fetch in DEMO mode
      if (authUser?.isDemo) {
        console.log('🎭 DEMO mode: Using demo user data instead of fetching from backend');
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
      console.log('CuadrantesEmpleadoPage raw data from backend:', users);
      
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
        console.log('CuadrantesEmpleadoPage mapped user:', mappedUser);
        setUserData(mappedUser);
      } else {
        setUserData(found);
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
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

  const [ausencias, setAusencias] = useState([]);

  const [bajasMedicas, setBajasMedicas] = useState([]);

  const [ziSelectata, setZiSelectata] = useState(null);

  const [totalOreMunca, setTotalOreMunca] = useState('');

  

  // State pentru rezolvarea alertelor

  const [showFichajeModal, setShowFichajeModal] = useState(false);

  const [selectedDayForFichaje, setSelectedDayForFichaje] = useState(null);

  const [fichajeType, setFichajeType] = useState('Entrada');

  const [fichajeTime, setFichajeTime] = useState('');

  const [fichajeAddress, setFichajeAddress] = useState('');

  const [submittingFichaje, setSubmittingFichaje] = useState(false);

  const [pendingFichajes, setPendingFichajes] = useState([]);



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



  // Fetch cuadrantes pentru angajatul curent

  useEffect(() => {

    // Skip real data fetch in DEMO mode

    if (authUser?.isDemo) {

      console.log('🎭 DEMO mode: Using demo data instead of fetching from backend');

      setDemoCuadrantes();

      setDemoAusencias();

      setLoading(false);

      return;

    }



    async function fetchCuadrantes() {

      setLoading(true);

      setError('');

      try {
        const token = localStorage.getItem('auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(routes.getCuadrantes, {

          method: 'POST',

          headers: headers,

          body: JSON.stringify({ codigo: codigoEmpleado })

        });

        const data = await res.json();

        const lista = Array.isArray(data) ? data : [data];

        setCuadrantesUser(lista);

        

        // Generez lista de luni disponibile

        const luni = [...new Set(lista.map(c => c.LUNA || c.luna))];

        

        // Detectez luna curentă

        const currentDate = new Date();

        const currentYear = currentDate.getFullYear();

        const currentMonth = currentDate.getMonth() + 1;

        const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        

        // Normalizez toate lunile disponibile pentru comparație

        const luniNormalizate = luni.map(l => {

          if (typeof l === 'number') {

            return excelDateToYYYYMM(l);

          } else if (typeof l === 'string') {

            // Asigur că luna are formatul corect YYYY-MM

            const [year, month] = l.split('-');

            if (year && month) {

              return `${year}-${month.padStart(2, '0')}`;

            }

          }

          return l;

        });

        

        // Încerc să selectez luna curentă, dacă nu există, selectez prima lună disponibilă

        const indexLunaCurenta = luniNormalizate.findIndex(luna => luna === currentMonthFormatted);

        

        if (indexLunaCurenta !== -1) {

          setSelectedLuna(luni[indexLunaCurenta]);

        } else {

          // Încerc să găsesc luna cea mai apropiată de luna curentă

          const currentMonthNum = currentMonth;

          let closestMonth = null;

          let minDifference = Infinity;

          

          luniNormalizate.forEach((luna, index) => {

            const [year, month] = luna.split('-').map(Number);

            if (year === currentYear) {

              const difference = Math.abs(month - currentMonthNum);

              if (difference < minDifference) {

                minDifference = difference;

                closestMonth = luni[index];

              }

            }

          });

          

          if (closestMonth) {

            setSelectedLuna(closestMonth);

          } else if (luni.length > 0) {

            setSelectedLuna(luni[0]);

          }

        }

      } catch (e) {

        setError('No se pudieron cargar los cuadrantes.');

      }

      setLoading(false);

    }

    

    if (codigoEmpleado) {

      fetchCuadrantes();

    }

  }, [codigoEmpleado, authUser?.isDemo]);

  // Încarcă datele complete ale utilizatorului
  useEffect(() => {
    if (authUser?.email) {
      fetchUserData();
    }
  }, [authUser?.email, fetchUserData]);

  // Funcție pentru a încărca orarul asignat
  const fetchHorarioAsignado = useCallback(async () => {
    try {
      const { listSchedules } = await import('../api/schedules');
      const response = await listSchedules(null);
      
      if (response.success && Array.isArray(response.data)) {
        const centroUsuario = userData?.['CENTRO TRABAJO'] || authUser?.['CENTRO TRABAJO'] || authUser?.centroTrabajo || authUser?.['CENTRO'] || authUser?.centro || authUser?.role || '';
        const grupoUsuario = userData?.['GRUPO'] || authUser?.['GRUPO'] || authUser?.grupo || '';
        
        console.log('🔍 DEBUG - Utilizator:', { centroUsuario, grupoUsuario });
        console.log('🔍 DEBUG - Toate câmpurile utilizatorului:', userData || authUser);
        console.log('🔍 DEBUG - Orare din backend:', response.data.map(h => ({ 
          nombre: h.nombre, 
          centroNombre: h.centroNombre, 
          grupoNombre: h.grupoNombre 
        })));
        
        const horarioMatch = response.data.find(horario => 
          horario.centroNombre === centroUsuario && 
          horario.grupoNombre === grupoUsuario
        );
        
        if (horarioMatch) {
          console.log('✅ Orar găsit:', horarioMatch);
          setHorarioAsignado(horarioMatch);
        } else {
          console.log('❌ Nu s-a găsit orar pentru:', { centroUsuario, grupoUsuario });
        }
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea orarului asignat:', error);
    }
  }, [authUser, userData]);

  useEffect(() => {
    if (authUser && !authUser.isDemo) {
      fetchHorarioAsignado();
    }
  }, [authUser, fetchHorarioAsignado]);

  // Fetch fichajes pentru angajatul curent

  useEffect(() => {

    // Skip real data fetch in DEMO mode

    if (authUser?.isDemo) {

      console.log('🎭 DEMO mode: Using demo fichajes data instead of fetching from backend');

      setDemoFichajes();

      return;

    }



    async function fetchFichajes() {

      if (!codigoEmpleado || !selectedLuna) return;

      try {

        console.log('DEBUG FETCH FICHAJES:');

        console.log('codigoEmpleado:', codigoEmpleado);

        console.log('selectedLuna:', selectedLuna);

        

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

        

        console.log('selectedLunaNorm normalized:', selectedLunaNorm);

        

        // Folosim backend-ul nou pentru registros/fichajes (nu n8n)
        const fichajesEndpoint = routes.getRegistros;
        // Backend-ul folosește CODIGO și MES (cu majuscule)
        const separator = fichajesEndpoint.includes('?') ? '&' : '?';
        const fichajesUrl = `${fichajesEndpoint}${separator}CODIGO=${encodeURIComponent(codigoEmpleado)}&MES=${encodeURIComponent(selectedLunaNorm)}`;
        
        const token = localStorage.getItem('auth_token');
        const fetchHeaders = {};
        if (token) {
          fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(fichajesUrl, {
          headers: fetchHeaders
        });

        const data = await res.json();

        

        console.log('Raw data from fichajes API (filtered by month):', data);

        // Asigură că data este întotdeauna un array
        const fichajesUser = Array.isArray(data) ? data : (data ? [data] : []);
        
        if (fichajesUser.length > 0) {
          console.log('First fichaje complete:', JSON.stringify(fichajesUser[0], null, 2));
        }

        

        // Nu mai trebuie să filtrăm în frontend, backend-ul returnează deja doar luna selectată

        console.log('Fichajes filtered for month:', fichajesUser);

        if (fichajesUser.length > 0) {
          console.log('Sample fichaje:', fichajesUser[0]);
        }

        

        setFichajes(fichajesUser);

      } catch (e) {

        console.error('Error fetching fichajes:', e);

        setFichajes([]);

      }

    }

    

    fetchFichajes();

  }, [codigoEmpleado, selectedLuna, authUser?.isDemo]);



  // Fetch ausencias pentru angajatul curent

  useEffect(() => {

    // Skip real data fetch in DEMO mode

    if (authUser?.isDemo) {

      return;

    }



    async function fetchAusencias() {

      try {

        // Folosim userData în loc de authUser pentru a avea acces la CODIGO
        const userCode = userData?.['CODIGO'] || authUser?.['CODIGO'] || authUser?.codigo || '';

        

        if (!userCode) {

          console.error('No user code available for fetching ausencias');

          return;

        }



        // Folosim backend-ul nou pentru ausencias (nu n8n)
        const baseAusenciasUrl = routes.getAusencias;
        const ausenciasSeparator = baseAusenciasUrl.includes('?') ? '&' : '?';
        const url = `${baseAusenciasUrl}${ausenciasSeparator}codigo=${encodeURIComponent(userCode)}`;

        console.log('🔍 Fetching ausencias, URL:', url);

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

        console.log('Ausencias data received:', result);

        

        const ausenciasData = Array.isArray(result) ? result : [result];

        console.log('🔍 AUSENCIAS structure:', ausenciasData.map(a => ({

          id: a.id,

          tipo: a.tipo,

          FECHA: a.FECHA,

          fecha_inicio: a.fecha_inicio,

          fecha_fin: a.fecha_fin,

          FECHA_INICIO: a.FECHA_INICIO,

          FECHA_FIN: a.FECHA_FIN,

          motivo: a.motivo,

          allKeys: Object.keys(a)

        })));

        console.log('🔍 DEBUG - Raw ausencias data:', ausenciasData);

        setAusencias(ausenciasData);

      } catch (error) {

        console.error('Error fetching ausencias:', error);

        setAusencias([]);

      }

    }

    

    fetchAusencias();

  }, [authUser, userData]);



  // Fetch bajas médicas pentru angajatul curent

  useEffect(() => {

    if (authUser?.isDemo) {

      setBajasMedicas([]);

      lastBajasRequestKey.current = 'demo';

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

        console.error('Error fetching bajas médicas para calendario:', error);

        setBajasMedicas([]);

      }

    }



    fetchBajasMedicasEmpleado();



    return () => controller.abort();

  }, [authUser?.isDemo, empleadoCodigo, empleadoNombre]);



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

  const cuadrant = cuadrantesUser.find(c => {

    let luna = c.LUNA || c.luna;

    if (typeof luna === 'number') luna = excelDateToYYYYMM(luna);
    
    // Verifică dacă luna se potrivește
    const lunaMatch = luna === selectedLunaNorm;
    
    // Verifică dacă cuadrantul este pentru utilizatorul curent
    const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailLogat.toLowerCase();
    const codigoMatch = (c.CODIGO || '').trim() === codigoEmpleado.trim();
    const nombreMatch = (c.NOMBRE || '').trim() === nombreEmpleado.trim();
    
    console.log(`🔍 Verificare cuadrant pentru ${emailLogat}:`, {
      cuadrant: c,
      lunaMatch,
      emailMatch,
      codigoMatch,
      nombreMatch,
      selectedLunaNorm,
      emailLogat,
      codigoEmpleado,
      nombreEmpleado
    });
    
    return lunaMatch && (emailMatch || codigoMatch || nombreMatch);

  });



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

  

  // Adaug decembrie din anul anterior (primul în listă)

  const decembrieAnterior = `${previousYear}-12`;

  luniCurente.push(decembrieAnterior);

  

  // Adaug toate lunile din anul curent (enero = 1 până la decembrie = 12)

  for (let month = 1; month <= 12; month++) {

    const yearMonth = `${currentYear}-${String(month).padStart(2, '0')}`;

    luniCurente.push(yearMonth);

  }

  

  // Combin luniile din cuadrantes cu cele curente și elimin duplicatele

  const luniDisponibileRaw = [...new Set([...luniDinCuadrantes, ...luniCurente])];

  

  // Filtrez doar luniile relevante: decembrie anul anterior + toate lunile din anul curent

  // Și le sortez astfel: decembrie anul anterior primul, apoi lunile din anul curent în ordine

  const luniDisponibile = luniDisponibileRaw.filter(luna => {

    const [year, month] = luna.split('-').map(Number);

    // Include decembrie anul anterior
    if (year === previousYear && month === 12) return true;
    // Include toate lunile din anul curent
    if (year === currentYear && month >= 1 && month <= 12) return true;
    return false;
  }).sort((a, b) => {

    const [yearA, monthA] = a.split('-').map(Number);

    const [yearB, monthB] = b.split('-').map(Number);

    

    // Decembrie anul anterior este întotdeauna primul

    if (yearA === previousYear && monthA === 12) return -1;

    if (yearB === previousYear && monthB === 12) return 1;

    

    // Apoi sortăm cronologic (an, apoi lună)

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

  const calendarCells = [];

  if (isLunaValida) {

    const [year, month] = selectedLunaNorm.split('-').map(Number);

    const daysInMonth = getDaysInMonth(month - 1, year);

    

    // Găsesc prima zi a lunii (0 = duminică, 1 = luni, etc.)

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Convertesc la luni = 0

    

    // Adaug celule goale pentru zilele din luna anterioară

    for (let i = 0; i < startDay; i++) {

      calendarCells.push(null);

    }

    

    // Adaug zilele lunii

    let day = 1;

    for (let i = 0; i < daysInMonth; i++) {

      const dataZi = formatDateYMD(year, month, day);

      const fichajesZi = Array.isArray(fichajes) ? fichajes.filter(f => (f["FECHA"] || '').startsWith(dataZi)) : [];

      const fechaZi = new Date(year, month - 1, day);

      

      // Verifică absențe și solicitări pentru această zi (prioritate)

      let tip = 'LIBRE';

      let orar = '';

      let motivoAusencia = '';

      let bajaCalendar = null;



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

          console.log(`🔍 DEBUG Day ${day} (${dataZi}):`, {

            ausencia: a,

            ausenciaFecha,

            fechaInicio,

            fechaFin,

            fechaZi: formatDateForDebug(fechaZi)

          });

        }

        

        // Verifică data exactă (pentru zile individuale)

        if (ausenciaFecha && ausenciaFecha.startsWith(dataZi)) {

          console.log(`✅ Found exact match for day ${day}:`, a);

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

            console.log(`🔍 Range check for day ${day}:`, {

              fechaInicio,

              fechaFin,

              inicio: formatDateForDebug(inicio),

              fin: formatDateForDebug(fin),

              fechaZi: formatDateForDebug(fechaZi),

              isInRange

            });

          }

          

          if (isInRange) {

            console.log(`✅ Found range match for day ${day}:`, a);

            return true;

          }

        }

        

        return false;

      });

      

      // Eliminată verificarea separată — vacanțele și asuntos propio sunt tratate în ausencias

      

      // Determină tipul zilei

      if (bajaCalendar) {

        tip = 'Baja Médica';

        motivoAusencia = bajaCalendar.motivo || 'Baja médica';

      } else if (ausenciaZi) {

        // Încearcă mai întâi TIPO, apoi tipo, apoi fallback la 'AUSENCIA'
        tip = ausenciaZi.TIPO || ausenciaZi.tipo || 'AUSENCIA';

        // Încearcă mai întâi MOTIVO, apoi motivo
        motivoAusencia = ausenciaZi.MOTIVO || ausenciaZi.motivo || '';

        

        // Debug pentru tipul determinat

        if (day === 9 || day === 11) {

          console.log(`🎯 Day ${day} - Tip determinat:`, {

            ausenciaZi,

            TIPO: ausenciaZi.TIPO,

            tipo: ausenciaZi.tipo,

            finalTip: tip,

            MOTIVO: ausenciaZi.MOTIVO,

            motivo: ausenciaZi.motivo,

            finalMotivo: motivoAusencia

          });

        }

      } else if (cuadrant) {

        // Folosește cuadrante dacă nu există absențe

        console.log(`🔍 Day ${day} - FOLOSESTE cuadrantul din backend`);

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
            // Extrage tipul (T1, T2, T3)
            const turnMatch = tipZiStr.match(/^(T[123])\s*(.*)$/);
            if (turnMatch) {
              tip = turnMatch[1]; // T1, T2 sau T3
              orar = turnMatch[2] || ''; // Orarul fără prefix
            } else {
              tip = tipZiStr.startsWith('T1') ? 'T1' : tipZiStr.startsWith('T2') ? 'T2' : 'T3';
              orar = tipZiStr.replace(/^T[123]\s*/, '');
            }
          }
          // Verifică dacă este un orar direct (ex: "08:00-17:00" sau "09:00-15:00 / 16:00-20:00")
          else if (tipZiStr.match(/^\d{1,2}:\d{2}/)) {
            tip = 'T1';
            orar = tipZiStr;
          }
          // Altfel, setează ca LIBRE
          else {
            tip = 'LIBRE';
            orar = '';
          }
        } else {
          // Dacă nu există valoare pentru această zi, rămâne LIBRE (valoarea default)
          tip = 'LIBRE';
          orar = '';
        }

      } else {

        // Folosește orarul asignat dacă există, altfel default
        console.log(`🔍 Day ${day} - FOLOSESTE orarul asignat (nu există cuadrant)`);
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
              tip = 'T1';
              // Construiește orarul din intervalele complete
              orar = intervals.map(interval => 
                `${interval.in}-${interval.out}`
              ).join(', ');
            } else {
              tip = 'LIBRE';
            }
          } else {
            // Nu există interval pentru această zi
            tip = 'LIBRE';
          }
          
          // Debug pentru orarul asignat (doar pentru debugging)
          if (day === 10) {
            console.log(`📅 DEBUG Ziua ${day}:`, {
              dayKey,
              daySchedule,
              hasCompleteInterval: daySchedule?.intervals?.some(i => i.in && i.out),
              tip,
              orar
            });
          }
        } else {
          // Default pentru lunile fără cuadrante: Luni-Vineri = T1, Sâmbătă-Duminică = LIBRE
          const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Duminică, 1 = Luni, etc.
          
          if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Luni până Vineri
            tip = 'T1';
            orar = '08:00-17:00'; // Program standard
          } else { // Sâmbătă și Duminică
            tip = 'LIBRE';
          }
          
          // Debug pentru default
          if (day <= 7) {
            console.log(`📅 Default pentru ziua ${day} (${weekDays[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}):`, {
              dayOfWeek,
              tip,
              orar
            });
          }
        }

      }

      

      // Verific dacă există alertă pentru această zi

      let alertaFichaj = false;

      let durataMunca = '';

      

      if (tip === 'T1') {

        const entradas = fichajesZi.filter(f => f["TIPO"] === 'Entrada');

        const salidas = fichajesZi.filter(f => f["TIPO"] === 'Salida');

        
        // Verifică dacă ziua este trecută înainte de a afișa avertizarea
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const currentDay = currentDate.getDate();
        
        const isPastDay = year < currentYear || 
                         (year === currentYear && month < currentMonth) || 
                         (year === currentYear && month === currentMonth && day < currentDay);

        if ((entradas.length === 0 || salidas.length === 0) && isPastDay) {

          alertaFichaj = true;

        } else {

          // Calculez durata muncii

          const entradasSorted = entradas.sort((a, b) => a["HORA"].localeCompare(b["HORA"]));

          const salidasSorted = salidas.sort((a, b) => a["HORA"].localeCompare(b["HORA"]));

          

          const perioade = Math.min(entradas.length, salidas.length);

          let durataTotala = 0;

          

          for (let j = 0; j < perioade; j++) {

            const entrada = entradasSorted[j]["HORA"];

            const salida = salidasSorted[j]["HORA"];

            

            const [h1, m1] = entrada.split(':').map(Number);

            const [h2, m2] = salida.split(':').map(Number);

            

            let durataMinute = (h2 * 60 + m2) - (h1 * 60 + m1);

            if (durataMinute < 0) durataMinute += 24 * 60;

            

            durataTotala += durataMinute;

          }

          

          if (durataTotala > 0) {

            const ore = Math.floor(durataTotala / 60);

            const minute = durataTotala % 60;

            durataMunca = `${ore}h ${minute}m`;

          }

        }

      }

      

      calendarCells.push({

        day,

        tip,

        orar,

        alertaFichaj,

        durataMunca,

        motivoAusencia,

        ausenciaZi,

        bajaCalendar

      });

      day++;

    }

  }



  // Calculez totalul de ore muncite

  useEffect(() => {
    
    // Calculează totalul de ore indiferent dacă există sau nu un cuadrant asignat.
    // Este suficient să avem fișaje (fichajes) pentru luna selectată.
    if (!fichajes || !fichajes.length || !selectedLunaNorm) return;

    console.log('DEBUG CALCUL ORE:');
    console.log('cuadrant:', cuadrant);
    console.log('fichajes:', fichajes);
    console.log('selectedLunaNorm:', selectedLunaNorm);

    const [year, month] = selectedLunaNorm.split('-').map(Number);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();

    console.log('year:', year, 'month:', month);
    console.log('currentYear:', currentYear, 'currentMonth:', currentMonth, 'currentDay:', currentDay);

    let totalMinute = 0;
    let totalSeconds = 0;

    // Filtrez fichajes pentru luna selectată
    const fichajesLunaSelectata = fichajes.filter(f => {
      const fecha = f["FECHA"] || '';
      // Verific dacă data începe cu YYYY-MM corespunzător lunii selectate
      const fechaPrefix = `${year}-${String(month).padStart(2, '0')}`;
      return fecha.startsWith(fechaPrefix);
    });

    console.log('Fichajes pentru luna selectată:', fichajesLunaSelectata.length, 'din total:', fichajes.length);

    // Prefer suma directă a câmpului DURACION (HH:MM:SS) din backend, doar pentru înregistrările de tip Salida
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

    const totalSecFromDuraciones = fichajesLunaSelectata
      .filter(f => f["TIPO"] === 'Salida' && typeof f["DURACION"] === 'string')
      .reduce((acc, f) => acc + parseHHMMSS(f["DURACION"]), 0);

    if (totalSecFromDuraciones > 0) {
      totalSeconds = totalSecFromDuraciones;
      totalMinute = Math.floor(totalSecFromDuraciones / 60);
    } else {
      // Fallback: calculez din perechi Entrada/Salida dacă lipsesc duraciones
      const daysInMonth = new Date(year, month, 0).getDate();
      const maxDay = daysInMonth;

      console.log('daysInMonth:', daysInMonth, 'maxDay:', maxDay);

      for (let day = 1; day <= maxDay; day++) {
        const dataZi = formatDateYMD(year, month, day);
        const fichajesZi = fichajesLunaSelectata.filter(f => (f["FECHA"] || '').startsWith(dataZi));

        console.log(`Day ${day}, dataZi: ${dataZi}, fichajesZi:`, fichajesZi);

        if (fichajesZi.length > 0) {
          const entradas = fichajesZi.filter(f => f["TIPO"] === 'Entrada');
          const salidas = fichajesZi.filter(f => f["TIPO"] === 'Salida');

          console.log(`  Entradas:`, entradas);
          console.log(`  Salidas:`, salidas);

          if (entradas.length > 0 && salidas.length > 0) {
            const entradasSorted = [...entradas].sort((a, b) => a["HORA"].localeCompare(b["HORA"]));
            const salidasSorted = [...salidas].sort((a, b) => a["HORA"].localeCompare(b["HORA"]));

            // Pair each entrada with the next salida after it (skips unmatched/out-of-order items)
            let idxE = 0;
            let idxS = 0;
            let pairIndex = 1;

            while (idxE < entradasSorted.length && idxS < salidasSorted.length) {
              const entradaStr = entradasSorted[idxE]["HORA"];
              const salidaStr = salidasSorted[idxS]["HORA"];

              // advance salida until it is after entrada
              if (salidaStr.localeCompare(entradaStr) <= 0) { idxS++; continue; }

              const [h1, m1] = entradaStr.split(':').map(Number);
              const [h2, m2] = salidaStr.split(':').map(Number);
              let durataMinute = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (durataMinute < 0) durataMinute += 24 * 60;

              console.log(`    Perioada ${pairIndex}: ${entradaStr} - ${salidaStr} = ${durataMinute} minute`);
              totalMinute += durataMinute;
              totalSeconds += durataMinute * 60;
              pairIndex++;

              idxE++;
              idxS++;
            }
          }
        }
      }
    }

    console.log('Total minute calculate:', totalMinute);

    // Dacă am folosit DURACION, bazez formatul pe totalSeconds; altfel deriv din totalMinute
    if (totalSeconds === 0) {
      totalSeconds = totalMinute * 60;
    }
    const hh = Math.floor(totalSeconds / 3600);
    const rem = totalSeconds % 3600;
    const mm = Math.floor(rem / 60);
    const ss = rem % 60;
    const totalText = `Total horas trabajadas (${month}/${year}): ${hh}h ${mm}m ${ss}s`;

    console.log('Total text:', totalText);
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

  if (!loading && cuadrant) {

    const zileCuAlerta = calendarCells.filter(cell => cell && cell.tip === 'T1' && cell.alertaFichaj);

    if (zileCuAlerta.length > 0) {

      erori.push(`Tienes ${zileCuAlerta.length} día${zileCuAlerta.length === 1 ? '' : 's'} laborable${zileCuAlerta.length === 1 ? '' : 's'} con turnos incompletos (falta Entrada o Salida) en el mes seleccionado!`);

    }

  }





  // Funcții pentru rezolvarea alertelor

  const handleResolveAlert = (cell) => {

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

  };



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

        DIRECCION: fichajeAddress || 'Locație automată',

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

    } catch (error) {

      console.error('Error saving fichaje:', error);

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



  // Funcție pentru obținerea locației automate folosind contextul global

  const handleGetCurrentLocation = async () => {

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

      console.error('Error getting location:', error);

      if (error.code === 1) {

        alert('El acceso a la ubicación fue denegado. Por favor permite el acceso en la configuración del navegador.');

      } else if (error.code === 2) {

        alert('La ubicación no pudo ser determinada. Por favor inténtalo de nuevo.');

      } else if (error.code === 3) {

        alert('Tiempo de espera agotado al obtener la ubicación. Por favor inténtalo de nuevo.');

      } else {

        alert('Error al obtener la ubicación. Por favor inténtalo de nuevo.');

      }

    }

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

                {/* Afișează informațiile despre ce s-a găsit - cuadrant sau orar */}
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
                    return today >= baja.start && today <= baja.end;
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
            onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de cuadrantes', '_blank')}
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

            {calendarCells.length === 0 && (

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

            {calendarCells.length > 0 && (

              calendarCells.map((cell, idx) => {

                if (!cell) {

                  return <div key={idx} className="min-h-[100px]"></div>;

                }

                

                // Verifică dacă este ziua curentă

                const currentDate = new Date();

                const currentYear = currentDate.getFullYear();

                const currentMonth = currentDate.getMonth() + 1;

                const currentDay = currentDate.getDate();

                

                const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);

                const isCurrentDay = selectedYear === currentYear && 

                                    selectedMonth === currentMonth && 

                                    cell.day === currentDay;

                

                const canModify = isCurrentDay && cell.alertaFichaj;

                

                // Determină tipul și culorile

                let bgGradient, borderColor, textColor, shadowColor, glowColor;

                

                // Determină culorile pe baza tipului zilei

                if (isCurrentDay) {

                  // Ziua curentă - prioritate maximă

                  if (cell.tip === 'Vacaciones') {

                    bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.4) 100%)';

                    borderColor = 'rgba(59, 130, 246, 0.7)';

                    textColor = '#1e40af';

                    shadowColor = 'rgba(59, 130, 246, 0.3)';

                    glowColor = '#3b82f6';

                  } else if (cell.tip === 'Asunto Propio') {

                    bgGradient = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(147, 51, 234, 0.4) 100%)';

                    borderColor = 'rgba(168, 85, 247, 0.7)';

                    textColor = '#7c3aed';

                    shadowColor = 'rgba(168, 85, 247, 0.3)';

                    glowColor = '#a855f7';

                  } else if (cell.tip === 'Baja Médica') {

                    bgGradient = 'linear-gradient(135deg, rgba(232, 121, 249, 0.45) 0%, rgba(217, 70, 239, 0.45) 100%)';

                    borderColor = 'rgba(192, 38, 211, 0.8)';

                    textColor = '#86198f';

                    shadowColor = 'rgba(192, 38, 211, 0.35)';

                    glowColor = '#e879f9';

                  } else {

                    bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.4) 100%)';

                    borderColor = 'rgba(59, 130, 246, 0.7)';

                    textColor = '#1e40af';

                    shadowColor = 'rgba(59, 130, 246, 0.3)';

                    glowColor = '#3b82f6';

                  }

                } else if (cell.tip === 'Vacaciones') {

                  bgGradient = 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(14, 165, 233, 0.3) 100%)';

                  borderColor = 'rgba(14, 165, 233, 0.5)';

                  textColor = '#075985';

                  shadowColor = 'rgba(14, 165, 233, 0.2)';

                  glowColor = '#0ea5e9';

                } else if (cell.tip === 'Asunto Propio') {

                  bgGradient = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)';

                  borderColor = 'rgba(168, 85, 247, 0.5)';

                  textColor = '#7c3aed';

                  shadowColor = 'rgba(168, 85, 247, 0.2)';

                  glowColor = '#a855f7';

                } else if (cell.tip === 'Baja Médica') {

                  bgGradient = 'linear-gradient(135deg, rgba(244, 114, 182, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)';

                  borderColor = 'rgba(219, 39, 119, 0.6)';

                  textColor = '#9d174d';

                  shadowColor = 'rgba(219, 39, 119, 0.25)';

                  glowColor = '#f472b6';

                } else if (cell.alertaFichaj) {

                  bgGradient = 'linear-gradient(135deg, rgba(254, 240, 138, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)';

                  borderColor = 'rgba(251, 191, 36, 0.5)';

                  textColor = '#92400e';

                  shadowColor = 'rgba(251, 191, 36, 0.25)';

                  glowColor = '#fbbf24';

                } else if (cell.tip === 'T1') {

                  bgGradient = 'linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(74, 222, 128, 0.2) 100%)';

                  borderColor = 'rgba(34, 197, 94, 0.4)';

                  textColor = '#15803d';

                  shadowColor = 'rgba(34, 197, 94, 0.15)';

                  glowColor = '#22c55e';

                } else if (cell.tip === 'LIBRE') {

                  bgGradient = 'linear-gradient(135deg, rgba(254, 202, 202, 0.2) 0%, rgba(252, 165, 165, 0.2) 100%)';

                  borderColor = 'rgba(239, 68, 68, 0.4)';

                  textColor = '#991b1b';

                  shadowColor = 'rgba(239, 68, 68, 0.15)';

                  glowColor = '#ef4444';

                } else {

                  bgGradient = 'linear-gradient(135deg, rgba(243, 244, 246, 0.5) 0%, rgba(229, 231, 235, 0.5) 100%)';

                  borderColor = 'rgba(156, 163, 175, 0.3)';

                  textColor = '#4b5563';

                  shadowColor = 'rgba(0, 0, 0, 0.05)';

                  glowColor = '#9ca3af';

                }

                

                return (

                  <div

                    key={idx}

                    onClick={() => handleResolveAlert(cell)}

                    className={`group/cell relative overflow-hidden min-h-[100px] transition-all duration-300 ${

                      canModify ? 'cursor-pointer' : 'cursor-default'

                    } ${!canModify && cell.alertaFichaj ? 'opacity-60' : ''}`}

                    style={{

                      background: bgGradient,

                      backdropFilter: 'blur(8px)',

                      borderRadius: '0.75rem',

                      border: `2px solid ${borderColor}`,

                      boxShadow: `0 4px 12px ${shadowColor}${

                        isCurrentDay ? `, 0 0 0 3px rgba(59, 130, 246, 0.4)` : ''

                      }`,

                      transform: ziSelectata && ziSelectata.day === cell.day ? 'scale(1.02)' : 'scale(1)',

                      padding: '0.75rem'

                    }}

                    onMouseEnter={(e) => {

                      if (canModify || !cell.alertaFichaj || isCurrentDay) {

                        e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';

                        e.currentTarget.style.boxShadow = `0 8px 20px ${shadowColor.replace('0.15', '0.25').replace('0.25', '0.35')}${

                          isCurrentDay ? `, 0 0 0 4px rgba(59, 130, 246, 0.6)` : ''

                        }`;

                      }

                    }}

                    onMouseLeave={(e) => {

                      if (ziSelectata && ziSelectata.day === cell.day) {

                        e.currentTarget.style.transform = 'scale(1.02)';

                      } else {

                        e.currentTarget.style.transform = 'scale(1)';

                      }

                      e.currentTarget.style.boxShadow = `0 4px 12px ${shadowColor}${

                        isCurrentDay ? `, 0 0 0 3px rgba(59, 130, 246, 0.4)` : ''

                      }`;

                    }}

                    title={canModify ? '✅ Click para resolver alerta' : 

                           cell.alertaFichaj ? '⚠️ Solo puedes modificar el día actual' : ''}

                  >

                    {/* Glow animado para alertas și ziua curentă */}

                    {(cell.alertaFichaj || isCurrentDay) && (

                      <div 

                        className="absolute inset-0 rounded-xl animate-pulse"

                        style={{

                          background: `radial-gradient(circle at center, ${glowColor}20 0%, transparent 70%)`,

                          opacity: isCurrentDay ? 0.7 : 0.5

                        }}

                      ></div>

                    )}

                    

                    {/* Shimmer effect en hover */}

                    {(canModify || isCurrentDay) && (

                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/cell:translate-x-[200%] transition-transform duration-1000"></div>

                    )}

                    

                    {/* Contenido */}

                    <div className="relative text-center h-full flex flex-col justify-between">

                      {/* Día */}

                      <div 

                        className="font-black text-2xl mb-2"

                        style={{ color: textColor }}

                      >

                        {cell.day}

                        {isCurrentDay && (

                          <span className="ml-2 text-blue-600 text-lg animate-bounce">📍</span>

                        )}

                      </div>

                      

                      {/* Tipo */}

                      <div 

                        className="font-bold text-xs mb-1 px-2 py-1 rounded-lg"

                        style={{

                          background: `${glowColor}30`,

                          color: textColor

                        }}

                      >

                        {cell.tip}

                      </div>

                      

                      {/* Horario */}

                      {cell.orar && (

                        <div 

                          className="text-xs font-semibold rounded px-2 py-1 mb-1"

                          style={{

                            background: 'rgba(255, 255, 255, 0.7)',

                            color: textColor

                          }}

                        >

                          ⏰ {cell.orar}

                        </div>

                      )}

                      

                      {/* Alerta */}

                      {cell.alertaFichaj && (

                        <div className="text-2xl animate-bounce mb-1">⚠️</div>

                      )}

                      

                      {/* Duración */}

                      {cell.durataMunca && (

                        <div 

                          className="text-xs font-bold rounded px-2 py-1"

                          style={{

                            background: 'rgba(255, 255, 255, 0.8)',

                            color: textColor

                          }}

                        >

                          ⏱️ {cell.durataMunca}

                        </div>

                      )}

                      

                      {/* Motivo de ausencia */}

                      {cell.motivoAusencia && (

                        <div 

                          className="text-xs font-medium rounded px-2 py-1 mt-1"

                          style={{

                            background: 'rgba(255, 255, 255, 0.9)',

                            color: textColor,

                            border: `1px solid ${glowColor}40`

                          }}

                          title={cell.motivoAusencia}

                        >

                          📝 {cell.motivoAusencia.length > 15 ? 

                            cell.motivoAusencia.substring(0, 15) + '...' : 

                            cell.motivoAusencia}

                        </div>

                      )}

                    </div>

                  </div>

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

                          {r["ESTADO"] === 'PENDIENTE' ? 'În așteptare' : 'Aprobat'}

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

                        În așteptare

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

    </div>

  );

} 