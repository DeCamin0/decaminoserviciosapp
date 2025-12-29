import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';
import { useApi } from '../hooks/useApi';
import { Card, Button, Modal, LoadingSpinner, Input, Notification } from '../components/ui';
import Back3DButton from '../components/Back3DButton.jsx';
import { API_ENDPOINTS } from '../utils/constants';
import { routes } from '../utils/routes';
import {
  getCurrentMonthKey,
  getStoredMonthlyAlerts,
  isMonthlyAlertsNotified,
  markMonthlyAlertsNotified,
  fetchMonthlyAlerts as fetchMonthlyAlertsData
} from '../utils/monthlyAlerts';
import activityLogger from '../utils/activityLogger';
import HorasTrabajadas from '../components/HorasTrabajadas';
import HorasPermitidas from '../components/HorasPermitidas';
import { calculateCuadranteHours, calculateHorarioHours } from '../utils/cuadrante-hours-helper';


// Agrego función para normalizar hora
function padTime(t) {
  if (!t) return '00:00:00';
  const parts = t.split(':').map(x => x.padStart(2, '0'));
  while (parts.length < 3) parts.push('00');
  return parts.join(':');
}

// Duration calculation removed - now handled by database triggers

// Funcție pentru calculul zilelor din FECHA combinată (ex: "2025-10-09 - 2025-10-23")
function calculateDaysFromCombinedDate(fechaCombinada) {
  console.log('🔍 calculateDaysFromCombinedDate called with:', fechaCombinada);
  if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') {
    console.log('🔍 Empty fecha, returning 0');
    return 0;
  }
  try {
    // Verifică dacă FECHA conține " - " (format combinat)
    if (fechaCombinada.includes(' - ')) {
      const [fechaInicio, fechaFin] = fechaCombinada.split(' - ');
      console.log('🔍 Split dates:', fechaInicio, fechaFin);
      const start = new Date(fechaInicio.trim());
      const end = new Date(fechaFin.trim());
      console.log('🔍 Parsed dates:', start, end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log('🔍 Invalid dates, returning 0');
        return 0;
      }
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      console.log('🔍 Calculated days:', days);
      return days;
    }
    // Dacă nu e format combinat, returnează 1 zi
    console.log('🔍 Not combined format, returning 1');
    return 1;
  } catch (error) {
    console.log('🔍 Error calculating days:', error);
    return 0;
  }
}

// Funcție pentru formatarea datelor cu liniuță
function formatDateRange(fechaCombinada) {
  console.log('🔍 formatDateRange called with:', fechaCombinada);
  if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') {
    console.log('🔍 Empty fecha, returning —');
    return '—';
  }
  try {
    // Normalizează formatul: "2025-12-08- 2025-12-08" -> "2025-12-08 - 2025-12-08"
    let fechaNormalized = fechaCombinada.trim();
    const sameDatePattern = /^(\d{4}-\d{2}-\d{2})-\s*(\1)$/;
    const match = fechaNormalized.match(sameDatePattern);
    if (match) {
      fechaNormalized = `${match[1]} - ${match[1]}`;
    }
    
    // Verifică dacă este interval (cu spații normale)
    if (fechaNormalized.includes(' - ')) {
      const [fechaInicio, fechaFin] = fechaNormalized.split(' - ');
      console.log('🔍 Split dates for formatting:', fechaInicio, fechaFin);
      
      // Verifică dacă este aceeași dată
      if (fechaInicio.trim() === fechaFin.trim()) {
        // Dacă este aceeași dată, returnează doar data formatată o singură dată
        const formatted = fechaInicio.trim().split('-').reverse().join('/');
        console.log('🔍 Single date (same start/end):', formatted);
        return formatted;
      }
      
      const startFormatted = fechaInicio.trim().split('-').reverse().join('/');
      const endFormatted = fechaFin.trim().split('-').reverse().join('/');
      const result = `${startFormatted} - ${endFormatted}`;
      console.log('🔍 Formatted interval result:', result);
      return result;
    }
    
    // Dacă nu e format combinat, formatează data normală
    const result = fechaNormalized.split('-').reverse().join('/');
    console.log('🔍 Single date formatted:', result);
    return result;
  } catch (error) {
    console.log('🔍 Error formatting date:', error);
    return '—';
  }
}

function formatSecondsToHHMMSS(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) {
    return null;
  }
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDecimalDuration(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return formatSecondsToHHMMSS(numeric * 3600);
}

const DAY_BASED_ABSENCE_TYPES = new Set([
  'Vacaciones',
  'Asunto Propio',
  'Permiso Retribuido',
  'Permiso Recuperable',
  'Permiso No Retribuido',
  'Permiso sin sueldo',
  'Permiso médico',
  'Permiso',
]);

function isDayBasedAbsenceType(tipo = '') {
  return DAY_BASED_ABSENCE_TYPES.has((tipo || '').trim());
}

function getApprovedDaysCount(item) {
  if (!item) return 0;
  const rawValue = item.dias_aprobados ?? item.diasAprobados;
  if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
    const numeric = Number(rawValue);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  const fechaInicio = item.fecha_inicio || item.fechaInicio || item.FECHA_INICIO;
  const fechaFin = item.fecha_fin || item.fechaFin || item.FECHA_FIN;
  if (fechaInicio && fechaFin) {
    return calculateDaysFromCombinedDate(`${fechaInicio} - ${fechaFin}`);
  }
  if (item.FECHA) {
    return calculateDaysFromCombinedDate(item.FECHA);
  }
  return 0;
}

function getApprovedHoursLabel(item) {
  if (!item) return null;
  const horas = item.horas_aprobadas ?? item.horasAprobadas;
  if (typeof horas === 'string' && horas.trim() !== '') {
    if (horas.includes(':')) {
      return horas;
    }
    const formatted = formatDecimalDuration(horas);
    if (formatted) {
      return formatted;
    }
    return horas;
  }
  if (horas && typeof horas === 'number') {
    const formatted = formatDecimalDuration(horas);
    if (formatted) {
      return formatted;
    }
    return horas.toString();
  }
  const duracion = item.duracion || item.DURACION;
  if (typeof duracion === 'string' && duracion.trim() !== '') {
    if (duracion.includes(':')) {
      return duracion;
    }
    const unidad = item.unidad_duracion || item.UNIDAD_DURACION;
    if (unidad) {
      return `${duracion} ${unidad}`;
    }
    const formatted = formatDecimalDuration(duracion);
    if (formatted) {
      return formatted;
    }
    return duracion;
  }
  if (typeof duracion === 'number') {
    const formatted = formatDecimalDuration(duracion);
    if (formatted) {
      return formatted;
    }
    return duracion.toString();
  }
  return null;
}

function getAusenciaDurationDisplay(item) {
  const isDayBased = isDayBasedAbsenceType(item?.tipo);
  if (isDayBased) {
    const days = getApprovedDaysCount(item);
    return {
      isDayBased: true,
      text: days
        ? `${days} día${days === 1 ? '' : 's'}`
        : 'Sin días'
    };
  }
  const hours = getApprovedHoursLabel(item);
  return {
    isDayBased: false,
    text: hours || 'Sin duración'
  };
}

// Hook simplu pentru ceas sincronizat cu Europe/Madrid (rezincronizare periodică)
function useMadridClock(resyncIntervalMs = 60000, authUser = null) {
  const [epochMs, setEpochMs] = useState(null);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let baseEpoch = 0;
    let basePerf = 0;
    let tickTimer = null;
    let resyncTimer = null;

    const formatFromMs = (ms) => {
      try {
        const d = new Date(ms);
        const t = d.toLocaleTimeString('es-ES', {
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        const ds = d.toLocaleDateString('es-ES', {
          timeZone: 'Europe/Madrid',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        setTimeStr(t);
        setDateStr(ds);
        setEpochMs(ms);
      } catch (_) {
        const d = new Date();
        setTimeStr(d.toLocaleTimeString());
        setDateStr(d.toLocaleDateString());
        setEpochMs(d.getTime());
      }
    };

    const update = () => {
      const ms = baseEpoch + (performance.now() - basePerf);
      formatFromMs(ms);
    };

    const sync = async () => {
      setSyncing(true);
      
      // Skip real time sync in DEMO mode
      if (authUser?.isDemo) {
        console.log('🎭 DEMO mode: Using local time instead of worldtimeapi');
        baseEpoch = Date.now();
        basePerf = performance.now();
        update();
        setSyncing(false);
        return;
      }
      
      try {
        const resp = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid');
        if (resp.ok) {
          const data = await resp.json();
          baseEpoch = new Date(data.datetime).getTime();
          basePerf = performance.now();
          update();
        } else {
          if (!baseEpoch) {
            baseEpoch = Date.now();
            basePerf = performance.now();
            update();
          }
        }
      } catch (_) {
        if (!baseEpoch) {
          baseEpoch = Date.now();
          basePerf = performance.now();
          update();
        }
      }
      setSyncing(false);
    };

    // start
    sync();
    tickTimer = setInterval(update, 1000);
    resyncTimer = setInterval(sync, resyncIntervalMs);

    return () => {
      if (tickTimer) clearInterval(tickTimer);
      if (resyncTimer) clearInterval(resyncTimer);
    };
  }, [resyncIntervalMs, authUser]);

  return { timeStr, dateStr, epochMs, syncing };
}

// Duration is now calculated by database triggers - no need for frontend calculation
// Función para generar el ID único
function generateUniqueId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `FIC_${timestamp}_${random}`;
}

function generateSolicitudId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6);
  return `SOL_${timestamp}_${random}`;
}

// Componente para el fichaje personal (Mi Fichaje)
function MiFichajeScreen({ onFicharIncidencia, incidenciaMessage, onLogsUpdate, setNotification, horarioAsignado, loadingHorario, cuadranteAsignado, loadingCuadrante, isTimeWithinSchedule, getTimeRestrictionMessage }) {
  const { t } = useTranslation();
  const { user: authUser, isAuthenticated } = useAuth();
  const { callApi } = useApi();
  const [logs, setLogs] = useState([]);
  const [now, setNow] = useState(new Date());
  // Hora oficial Madrid pentru ceasul principal (cu resync periodic)
  const { timeStr: madridTimeStr, epochMs: madridNowMs } = useMadridClock(5 * 60 * 1000, authUser);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [fichando, setFichando] = useState(false);
  const [lastFichaje, setLastFichaje] = useState(null);
  // Folosim locația globală din LocationContext
  const locationContext = useLocation();
  const { currentLocation, currentAddress } = locationContext;
  const fetchedAlertsRef = useRef({});
  const locationContextRef = useRef(locationContext);
  const locationRequestedOnMountRef = useRef(false); // Previne apelurile multiple de locație la mount
  
  // Actualizează ref-ul când locationContext se schimbă
  useEffect(() => {
    locationContextRef.current = locationContext;
  }, [locationContext]);

  // Cere locația automat când se accesează pagina Fichaje
  // Folosim maximumAge mare (10 minute) pentru a folosi cache-ul browser-ului
  // Dacă există locație cached recentă, browser-ul o returnează fără warning
  useEffect(() => {
    // Previne apelurile multiple - cere doar o dată când componenta se montează
    if (locationRequestedOnMountRef.current) {
      return;
    }

    // Dacă deja avem locație cached, nu mai cerem
    if (currentLocation) {
      console.log('📍 Fichaje: Using existing cached location');
      locationRequestedOnMountRef.current = true;
      return;
    }

    const requestLocationOnPageAccess = async () => {
      try {
        locationRequestedOnMountRef.current = true; // Marchează că am cerut deja
        console.log('📍 Fichaje page accessed - requesting location (using cache if available)...');
        // Cere locația folosind contextul global
        // maximumAge: 600000 (10 min) înseamnă că dacă avem locație cache-uită mai recentă de 10 min, o folosește
        // Browser-ul returnează locația cached fără să activeze GPS-ul, reducând warning-urile
        await locationContext.getCurrentLocation();
        console.log('✅ Location obtained on Fichaje page access');
      } catch (error) {
        console.warn('⚠️ Could not get location on page access:', error);
        locationRequestedOnMountRef.current = false; // Permite retry dacă eșuează
        // Nu aruncăm eroare - continuăm fără locație, utilizatorul poate încerca din nou la check-in
      }
    };

    // Cere locația când se montează componenta (la accesarea paginii)
    requestLocationOnPageAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Fără dependențe - doar la mount (o singură dată)

  // State pentru tab-uri și ausencias
  const [activeTab, setActiveTab] = useState('registros');
  const [ausencias, setAusencias] = useState([]);
  const [loadingAusencias, setLoadingAusencias] = useState(false);
  const [totalAusenciaDuration, setTotalAusenciaDuration] = useState(null);
  const [totalFichajeDuration, setTotalFichajeDuration] = useState(null);
  const [totalAsuntoPropioDays, setTotalAsuntoPropioDays] = useState(null);
  const [totalVacacionesDays, setTotalVacacionesDays] = useState(null);
  const [monthlyAlerts, setMonthlyAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // State pentru selectorul de lună
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // State pentru loading când se schimbă luna
  const [changingMonth, setChangingMonth] = useState(false);

  // State pentru a verifica dacă utilizatorul este în vacanță sau asunto propio
  const [isOnVacationOrAbsence, setIsOnVacationOrAbsence] = useState(false);
  const [currentAbsenceType, setCurrentAbsenceType] = useState('');
  
  // State pentru baja médica
  const [bajasMedicas, setBajasMedicas] = useState([]);
  const [isOnBajaMedica, setIsOnBajaMedica] = useState(false);
  const [currentBajaMedica, setCurrentBajaMedica] = useState(null);

  // State pentru modal-ul de confirmare fichaje
  const [showFichajeConfirmModal, setShowFichajeConfirmModal] = useState(false);
  const [fichajeTipo, setFichajeTipo] = useState('');
  const [fichajeCustomMotivo, setFichajeCustomMotivo] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Funcție helper pentru a normaliza datele
  const normalizeDateInput = useCallback((value) => {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }, []);

  // Funcție pentru a verifica dacă utilizatorul este în vacanță, asunto propio sau baja médica
  const checkCurrentAbsenceStatus = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('🔍 Checking absence status for today:', todayStr);
    console.log('🔍 Available ausencias:', ausencias);
    
    // Verifică mai întâi baja médica (prioritate)
    let currentBaja = null;
    if (bajasMedicas && bajasMedicas.length > 0) {
      currentBaja = bajasMedicas.find((baja) => {
        if (!baja || typeof baja !== 'object') return false;
        
        // Verifică dacă Situación este "Alta" - dacă da, nu este activă
        const situacion = baja.Situacion || baja.situacion || baja['Situación'] || baja.estado || baja.ESTADO || '';
        if (situacion && situacion.toLowerCase().includes('alta')) {
          console.log('✅ Baja médica cu Situación "Alta" - nu este activă:', baja);
          return false;
        }
        
        const fechaInicio = baja.fecha_inicio || baja.fechaInicio || baja.FECHA_INICIO || baja['Fecha baja'] || baja['Fecha Baja'] || baja.fecha_baja || baja.fechaBaja || baja['FECHA BAJA'] || '';
        const fechaFin = baja.fecha_fin || baja.fechaFin || baja.FECHA_FIN || baja['Fecha alta'] || baja['Fecha Alta'] || baja.fecha_alta || baja.fechaAlta || baja['FECHA ALTA'] || '';
        
        if (!fechaInicio) return false;
        
        const inicio = normalizeDateInput(fechaInicio);
        const fin = fechaFin ? normalizeDateInput(fechaFin) : null;
        
        if (!inicio) return false;
        
        const inicioDate = new Date(inicio);
        inicioDate.setHours(0, 0, 0, 0);
        
        // Dacă există fechaFin (fecha_alta), verifică dacă este în trecut
        if (fin) {
          const finDate = new Date(fin);
        finDate.setHours(0, 0, 0, 0);
        
          // Dacă fechaFin este în trecut, baja médica nu este activă
          if (today > finDate) {
            console.log('✅ Baja médica cu fecha_alta în trecut - nu este activă:', { fechaFin: fin, today: todayStr });
            return false;
          }
          
          // Verifică dacă ziua curentă este în intervalul [inicio, fin]
        return today >= inicioDate && today <= finDate;
        } else {
          // Dacă nu există fechaFin, consideră activă până în prezent
          return today >= inicioDate;
        }
      });
    }
    
    if (currentBaja) {
      setIsOnBajaMedica(true);
      setIsOnVacationOrAbsence(true);
      setCurrentAbsenceType('Baja Médica');
      setCurrentBajaMedica({
        startDate: normalizeDateInput(currentBaja.fecha_inicio || currentBaja.fechaInicio || currentBaja.FECHA_INICIO || currentBaja['Fecha baja'] || currentBaja.fecha_baja || currentBaja.fechaBaja || currentBaja['FECHA BAJA'] || ''),
        endDate: normalizeDateInput(currentBaja.fecha_fin || currentBaja.fechaFin || currentBaja.FECHA_FIN || currentBaja['Fecha alta'] || currentBaja.fecha_alta || currentBaja.fechaAlta || currentBaja['FECHA ALTA'] || ''),
        situacion: currentBaja.Situacion || currentBaja.situacion || currentBaja['Situación'] || currentBaja.estado || '',
        motivo: currentBaja.Motivo || currentBaja.motivo || 'Baja médica'
      });
      console.log('🚫 Utilizatorul este în baja médica:', currentBaja);
      return;
    }
    
    setIsOnBajaMedica(false);
    setCurrentBajaMedica(null);
    
    // Caută în ausencias pentru ziua curentă
    const currentAbsence = ausencias.find(a => {
      const ausenciaFecha = a.FECHA || a.fecha || a.data;
      const fechaInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;
      const fechaFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;
      
      console.log('🔍 Checking ausencia:', {
        ausenciaFecha,
        fechaInicio,
        fechaFin,
        TIPO: a.TIPO || a.tipo
      });
      
      // Verifică data exactă
      if (ausenciaFecha && ausenciaFecha.startsWith(todayStr)) {
        console.log('✅ Found exact date match:', ausenciaFecha);
        return true;
      }
      
      // Verifică interval de date
      if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const isInRange = today >= inicio && today <= fin;
        console.log('🔍 Range check:', {
          inicio: inicio.toISOString().split('T')[0],
          fin: fin.toISOString().split('T')[0],
          today: todayStr,
          isInRange
        });
        return isInRange;
      }
      
      // Verifică interval din ausenciaFecha (ex: "2025-10-09 - 2025-10-10")
      if (ausenciaFecha && ausenciaFecha.includes(' - ')) {
        const [fechaInicioStr, fechaFinStr] = ausenciaFecha.split(' - ');
        const inicio = new Date(fechaInicioStr);
        const fin = new Date(fechaFinStr);
        
        // Compară doar partea de dată (YYYY-MM-DD) ignorând ora
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const inicioDateOnly = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const finDateOnly = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
        
        const isInRange = todayDateOnly >= inicioDateOnly && todayDateOnly <= finDateOnly;
        console.log('🔍 Range check from ausenciaFecha:', {
          ausenciaFecha,
          fechaInicioStr,
          fechaFinStr,
          today: todayStr,
          todayDateOnly: todayDateOnly.toISOString().split('T')[0],
          inicioDateOnly: inicioDateOnly.toISOString().split('T')[0],
          finDateOnly: finDateOnly.toISOString().split('T')[0],
          isInRange
        });
        return isInRange;
      }
      
      return false;
    });
    
    if (currentAbsence) {
      const absenceType = currentAbsence.TIPO || currentAbsence.tipo || 'AUSENCIA';
      setIsOnVacationOrAbsence(true);
      setCurrentAbsenceType(absenceType);
      console.log('🚫 Utilizatorul este în absență:', absenceType, currentAbsence);
    } else {
      setIsOnVacationOrAbsence(false);
      setCurrentAbsenceType('');
      console.log('✅ Utilizatorul nu este în absență pentru ziua curentă');
    }
  }, [ausencias, bajasMedicas, normalizeDateInput]);

  // Fetch bajas médicas pentru angajatul curent
  useEffect(() => {
    if (authUser?.isDemo) {
      setBajasMedicas([]);
      return;
    }

    const endpoint = routes.getBajasMedicas;
    if (!endpoint) {
      return;
    }

    const empleadoCodigo = String(authUser?.CODIGO || authUser?.codigo || '').trim();
    const empleadoNombre = String(authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || '').trim();

    if (!empleadoCodigo && !empleadoNombre) {
      return;
    }

    async function fetchBajasMedicasEmpleado() {
      try {
        // Folosim backend-ul nou cu GET request
        const token = localStorage.getItem('auth_token');
        const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}codigo=${encodeURIComponent(empleadoCodigo)}`;
        
        console.log('✅ [Fichaje] Folosind backend-ul nou (getBajasMedicas):', url);
        
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const lista = await response.json();
        // Backend-ul filtrează deja după codigo, dar păstrăm filtrarea pentru compatibilitate
        const listaArray = Array.isArray(lista) ? lista : [];

        console.log(`✅ [Fichaje] Bajas médicas primite din backend: ${listaArray.length} items`);
        setBajasMedicas(listaArray);
      } catch (error) {
        console.error('❌ Error fetching bajas médicas:', error);
        setBajasMedicas([]);
      }
    }

    fetchBajasMedicasEmpleado();
  }, [authUser]);

  // Verifică statusul de absență când se încarcă ausencias sau bajas médicas
  useEffect(() => {
    console.log('🔍 Ausencias loaded:', ausencias.length, 'items');
    console.log('🔍 Bajas médicas loaded:', bajasMedicas.length, 'items');
    checkCurrentAbsenceStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausencias, bajasMedicas]); // Eliminat checkCurrentAbsenceStatus din dependențe pentru a evita re-render-uri infinite

  const fetchMonthlyAlerts = useCallback(async (month, notifyOnResult = false) => {
    if (!isAuthenticated || !authUser) return null;
    const empleadoId = authUser?.CODIGO || authUser?.codigo;
    const empleadoNombre = authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || '';
    if (!empleadoId || !empleadoNombre) {
      return null;
    }

    const { summary } = await fetchMonthlyAlertsData({
      empleadoId,
      empleadoNombre,
      month
    });

    if (!summary) {
      return null;
    }

    if (notifyOnResult && summary.total > 0 && !isMonthlyAlertsNotified(month)) {
      setNotification({
        type: 'warning',
        title: 'Alertas de horas mensuales',
        message: `Tienes ${summary.total} días con alerta este mes (${summary.positivos} con exceso y ${summary.negativos} con déficit). Revisa el apartado Horas Trabajadas → Alertas.`
      });
      markMonthlyAlertsNotified(month);
    }

    return summary;
  }, [authUser, isAuthenticated, setNotification]);

  useEffect(() => {
    if (!isAuthenticated || !authUser) {
      setMonthlyAlerts(null);
      return;
    }

    if (authUser?.isDemo) {
      setMonthlyAlerts(null);
      return;
    }

    const month = selectedMonth;
    const currentMonthKey = getCurrentMonthKey();
    const isCurrentMonth = month === currentMonthKey;

    const storedEntry = getStoredMonthlyAlerts(month);
    const storedSummary = storedEntry?.summary;

    if (storedSummary) {
      setMonthlyAlerts(storedSummary);
      setLoadingAlerts(false);

      if (isCurrentMonth && storedSummary.total > 0 && !isMonthlyAlertsNotified(month)) {
        setNotification({
          type: 'warning',
          title: 'Alertas de horas mensuales',
          message: `Tienes ${storedSummary.total} días con alerta este mes (${storedSummary.positivos} con exceso y ${storedSummary.negativos} con déficit). Revisa el apartado Horas Trabajadas → Alertas.`
        });
        markMonthlyAlertsNotified(month);
      }
    } else {
      setMonthlyAlerts(null);
    }

    if (fetchedAlertsRef.current[month] && storedSummary) {
      return;
    }

    const shouldNotifyOnFetch = isCurrentMonth && !isMonthlyAlertsNotified(month);
    const shouldShowLoader = !storedSummary;
    if (shouldShowLoader) {
      setLoadingAlerts(true);
    }

    const run = async () => {
      const summary = await fetchMonthlyAlerts(month, shouldNotifyOnFetch);
      fetchedAlertsRef.current[month] = true;

      if (summary) {
        setMonthlyAlerts(summary);
      } else if (!storedSummary) {
        setMonthlyAlerts({ total: 0, positivos: 0, negativos: 0 });
      }

      if (shouldShowLoader) {
        setLoadingAlerts(false);
      }
    };

    run();
  }, [authUser, fetchMonthlyAlerts, isAuthenticated, selectedMonth, setNotification]);

  // Nu cerem geolocația automat - respectăm browser policies (user gesture required)
  // Geolocația se va cere doar când utilizatorul apasă butonul de fichar (user gesture)
  // Asta respectă GDPR și best practices de confidențialitate

  // Demo fichajes data
  const setDemoFichajes = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Generate demo fichajes for current month
    const demoLogs = [
      {
        id: 'DEMO_LOG001',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
        hora: '08:30:00',
        tipo: 'Entrada',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      },
      {
        id: 'DEMO_LOG002',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
        hora: '17:30:00',
        tipo: 'Salida',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      },
      {
        id: 'DEMO_LOG003',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
        hora: '08:15:00',
        tipo: 'Entrada',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      },
      {
        id: 'DEMO_LOG004',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
        hora: '17:45:00',
        tipo: 'Salida',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      },
      {
        id: 'DEMO_LOG005',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03`,
        hora: '08:45:00',
        tipo: 'Entrada',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      },
      {
        id: 'DEMO_LOG006',
        data: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03`,
        hora: '18:00:00',
        tipo: 'Salida',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        ubicacion: 'Madrid Centro'
      }
    ];

    setLogs(demoLogs);
    setAusencias([]); // Empty ausencias for demo
  };

  // Fetch ausencias pentru tot anul curent
  const fetchAusencias = useCallback(async () => {
    setLoadingAusencias(true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAusencias');
      setLoadingAusencias(false);
      return;
    }
    
    try {
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      if (!userCode) {
        console.error('No user code available for fetching ausencias');
        setAusencias([]);
        setLoadingAusencias(false);
        return;
      }

      // Folosim backend-ul nou (fără n8n)
      const url = `${routes.getAusencias}?codigo=${encodeURIComponent(userCode)}`;
      console.log('✅ [Fichaje] Folosind backend-ul nou (getAusencias):', url);
      
      const token = localStorage.getItem('auth_token');
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const result = await callApi(url, { headers });
      
      if (result.success) {
        const rawData = Array.isArray(result.data) ? result.data : [result.data];
        console.log('Ausencias raw data received:', rawData);
        
        // Mapăm datele pentru a fi siguri că au structura corectă
        const mappedData = rawData.map(item => {
          console.log('🔍 Mapping item:', item);
          
          // Caută câmpul pentru oră în toate variantele posibile
          const hora = item.hora || item.HORA || item.time || item.hora_registro || 
                      item.HORA_REGISTRO || item.TIMESTAMP || item.timestamp || 
                      item.HORA_DE_REGISTRO || item.creado_at || item.CREADO_AT || '';
          
          console.log('🔍 Found hora:', hora);
          
          const fechaCombinada = item.FECHA || item.fecha || item.data || item.DATA || item.date || '';
          console.log('🔍 Found FECHA:', fechaCombinada);
          
          const diasAprobados = item.dias_aprobados ?? item.DIAS_APROBADOS ?? item.diasAprobados ?? null;
          const horasAprobadas = item.horas_aprobadas ?? item.HORAS_APROBADAS ?? item.horasAprobadas ?? null;
          const unidadDuracion = item.UNIDAD_DURACION ?? item.unidad_duracion ?? item.unidadDuracion ?? null;

          return {
            id: item.id || item.ID || item._id || 0,
            tipo: item.tipo || item.TIPO || item.type || 'Ausencia',
            data: item.data || item.DATA || item.date || item.fecha || '',
            FECHA: fechaCombinada,
            hora: hora,
            motivo: item.motivo || item.MOTIVO || item.reason || item.razon || 'Sin motivo especificado',
            locatia: item.locatia || item.LOCATIA || item.location || item.ubicacion || item.address || item.LOCACION || '',
            duracion: item.duracion || item.DURACION || item.duration || null,
            created_at: item.created_at || item.CREATED_AT || item.createdAt || item.fecha_creacion || '',
            dias_aprobados: diasAprobados,
            horas_aprobadas: horasAprobadas,
            unidad_duracion: unidadDuracion
          };
        });
        
        // Sortăm după data și ora - cele mai recente sus
        const sortedData = mappedData.sort((a, b) => {
          // Dacă nu avem oră, sortăm după ID (mai mare = mai recent)
          if (!a.hora || !b.hora) {
            console.log('🔍 Sorting by ID - A:', a.id, 'B:', b.id);
            return (b.id || 0) - (a.id || 0);
          }
          
          // Verifică dacă datele sunt valide
          if (!a.data || !b.data) {
            console.log('🔍 Sorting - invalid data:', { a: a.data, b: b.data });
            return (b.id || 0) - (a.id || 0);
          }
          
          // Combinăm data și ora pentru a crea un timestamp complet
          const dateTimeA = `${a.data} ${a.hora}`;
          const dateTimeB = `${b.data} ${b.hora}`;
          
          console.log('🔍 Sorting - A:', dateTimeA, 'B:', dateTimeB);
          
          // Încearcă să parseze data în format ISO
          let dateA, dateB;
          
          try {
            // Dacă data este în format YYYY-MM-DD, adaugă T pentru ISO
            const isoA = a.data.includes('T') ? dateTimeA : `${a.data}T${a.hora}`;
            const isoB = b.data.includes('T') ? dateTimeB : `${b.data}T${b.hora}`;
            
            dateA = new Date(isoA);
            dateB = new Date(isoB);
            
            console.log('🔍 Sorting - dateA:', dateA, 'dateB:', dateB);
            console.log('🔍 Sorting - dateB - dateA:', dateB - dateA);
            
            // Sortăm descendent (cele mai recente primul)
            return dateB - dateA;
          } catch (error) {
            console.error('🔍 Sorting error:', error);
            // Fallback la sortare după ID
            return (b.id || 0) - (a.id || 0);
          }
        });
        
        console.log('Ausencias mapped and sorted data:', sortedData);
        
        // Calculează totalul de durată pentru ausencias
        let totalSeconds = 0;
        sortedData.forEach(item => {
          if (item.duracion && item.duracion !== null) {
            // Parsează durata în format HH:MM:SS
            const timeParts = item.duracion.split(':');
            if (timeParts.length === 3) {
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseInt(timeParts[2]) || 0;
              totalSeconds += hours * 3600 + minutes * 60 + seconds;
            }
          }
        });
        
        // Convertește înapoi în format HH:MM:SS
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
        const totalSecs = totalSeconds % 60;
        const totalDuration = `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
        
        console.log('🔍 Total ausencia duration:', totalDuration, 'seconds:', totalSeconds);
        setTotalAusenciaDuration(totalDuration);
        
        // Calculează totalul de zile pentru Asunto Propio
        let totalAsuntoPropioDays = 0;
        sortedData.forEach(item => {
          if (item.tipo === 'Asunto Propio') {
            const days = getApprovedDaysCount(item);
            totalAsuntoPropioDays += days;
            console.log('🔍 Asunto Propio item:', item.FECHA, 'approved days:', days);
          }
        });
        
        console.log('🔍 Total Asunto Propio days:', totalAsuntoPropioDays);
        setTotalAsuntoPropioDays(totalAsuntoPropioDays);
        
        // Calculează totalul de zile pentru Vacaciones
        let totalVacacionesDays = 0;
        sortedData.forEach(item => {
          if (item.tipo === 'Vacaciones') {
            const days = getApprovedDaysCount(item);
            totalVacacionesDays += days;
            console.log('🔍 Vacaciones item:', item.FECHA, 'approved days:', days);
          }
        });
        
        console.log('🔍 Total Vacaciones days:', totalVacacionesDays);
        setTotalVacacionesDays(totalVacacionesDays);
        
        // Log all ausencias data
        console.log('🔍 All ausencias loaded:', sortedData.length, 'items');
        
        setAusencias(sortedData);
      } else {
        console.error('Error fetching ausencias:', result.error);
        setAusencias([]);
        setTotalAusenciaDuration(null);
        setTotalAsuntoPropioDays(null);
        setTotalVacacionesDays(null);
      }
    } catch (error) {
      console.error('Error fetching ausencias:', error);
      setAusencias([]);
      setTotalAusenciaDuration(null);
      setTotalAsuntoPropioDays(null);
      setTotalVacacionesDays(null);
    }
    setLoadingAusencias(false);
    setChangingMonth(false);
  }, [authUser, callApi]);

  // Încarcă ausencias imediat când se încarcă componenta pentru a bloca butoanele
  useEffect(() => {
    if (isAuthenticated && authUser) {
      console.log('🔍 Fetching ausencias for button blocking');
      fetchAusencias();
    }
  }, [isAuthenticated, authUser, fetchAusencias]);

  // Încarcă din nou ausencias când se schimbă tab-ul la "ausencias" pentru afișare
  useEffect(() => {
    console.log('🔍 useEffect triggered - activeTab:', activeTab);
    if (activeTab === 'ausencias' && isAuthenticated && authUser) {
      console.log('🔍 Refreshing ausencias for display');
      fetchAusencias();
    }
  }, [activeTab, authUser, fetchAusencias, isAuthenticated]);

  // Notifică componenta părinte când se schimbă logs
  // Folosim useRef pentru a evita loop-uri infinite când onLogsUpdate se schimbă
  const onLogsUpdateRef = useRef(onLogsUpdate);
  const hasLoadedLogsRef = useRef(false);
  
  useEffect(() => {
    onLogsUpdateRef.current = onLogsUpdate;
  }, [onLogsUpdate]);

  useEffect(() => {
    // Nu notifică părintele dacă încă se încarcă datele sau dacă logs este gol și nu a fost încărcat niciodată
    if (onLogsUpdateRef.current && (!loadingLogs || hasLoadedLogsRef.current)) {
      onLogsUpdateRef.current(logs);
      // Marchează că am încărcat logs cel puțin o dată
      if (logs.length > 0) {
        hasLoadedLogsRef.current = true;
      }
    }
  }, [logs, loadingLogs]);

  // Verifică dacă angajatul poate registra incidencia (memoizat pentru a evita re-render-urile)
  const hasCompletedCycle = useMemo(() => {
    if (!logs || logs.length === 0) {
      return false;
    }
    
    // Sortează logs după dată și oră pentru a găsi ultimul marcaj
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(`${a.data} ${a.hora}`);
      const dateB = new Date(`${b.data} ${b.hora}`);
      return dateB - dateA; // Cel mai recent primul
    });
    
    const ultimulMarcaj = sortedLogs[0];
    
    // Permite incidencia doar dacă ultimul marcaj este Salida
    // Asta înseamnă că a terminat jornada și poate anunța incidența
    const canRegisterIncidencia = ultimulMarcaj && ultimulMarcaj.tipo === 'Salida';
    
    return canRegisterIncidencia;
  }, [logs]);

  const fetchLogs = useCallback(async (month = selectedMonth) => {
    setLoadingLogs(true);
    setChangingMonth(month !== selectedMonth);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchLogs');
      setLoadingLogs(false);
      return [];
    }
    
    try {
      const codigo = authUser?.CODIGO || authUser?.codigo || '';
      if (!codigo) {
        setLoadingLogs(false);
        return [];
      }

      // Para managers, obtiene los marcajes para todos los códigos posibles
      let allLogs = [];
      
      // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
      if (authUser?.isManager) {
        // Para managers, obtiene los marcajes para CODIGO y codigo
        const codigos = [];
        if (authUser?.CODIGO) codigos.push(authUser.CODIGO);
        if (authUser?.codigo) codigos.push(authUser.codigo);
        if (codigo && !codigos.includes(codigo)) codigos.push(codigo);
        
        // Obtiene los marcajes para cada código con filtro de mes
        for (const cod of codigos) {
          const url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(cod)}&MES=${encodeURIComponent(month)}`;
          console.log('✅ [Fichaje] Folosind backend-ul nou (getRegistros):', url);
          
          const token = localStorage.getItem('auth_token');
          const headers = {};
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const result = await callApi(url, { headers });
          if (result.success) {
            const data = Array.isArray(result.data) ? result.data : [result.data];
            allLogs.push(...data);
          }
        }
      } else {
        // Pentru empleados, obține marcajele doar pentru codigo-ul principal cu filtro de mes
        const url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(codigo)}&MES=${encodeURIComponent(month)}`;
        console.log('✅ [Fichaje] Folosind backend-ul nou (getRegistros):', url);
        
        const token = localStorage.getItem('auth_token');
        const headers = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const result = await callApi(url, { headers });
        
        if (result.success) {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          allLogs = data;
        }
      }

      if (allLogs.length > 0) {
        // Para managers, calcula la duración para los marcajes existentes
        // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
      if (authUser?.isManager) {
          const codigos = [];
          if (authUser?.CODIGO) codigos.push(authUser.CODIGO);
          if (authUser?.codigo) codigos.push(authUser.codigo);
          if (codigo && !codigos.includes(codigo)) codigos.push(codigo);
          
          // Duration is now calculated by database triggers - no need for frontend calculation
        }
        
        // Mapeo a la estructura UI
        const mapped = allLogs.map(item => ({
          tipo: item.TIPO || item.tipo,
          hora: item.HORA || item.hora,
          address: item.DIRECCION || item.address,
          modificatDe: item.MODIFICADO_POR || item.modificatDe,
          codigo: item.CODIGO || item.codigo,
          duration: item.DURACION || item.duration,
          data: item.FECHA || item.data,
        }));

        // Ordenación correcta: combina fecha y hora para una ordenación cronológica precisa
        const sortedLogs = [...mapped].sort((a, b) => {
          const dataA = a.data || a.fecha || '';
          const dataB = b.data || b.fecha || '';
          const horaA = padTime(a.hora || '');
          const horaB = padTime(b.hora || '');

          if (!dataA || !dataB || !horaA || !horaB) return 0;

          const dateTimeA = new Date(`${dataA}T${horaA}`);
          const dateTimeB = new Date(`${dataB}T${horaB}`);
          return dateTimeB - dateTimeA;
        });

        // Calculează durata totală pentru fichajes
        let totalSeconds = 0;
        sortedLogs.forEach(item => {
          if (item.duration && item.duration !== null && item.duration !== '') {
            // Parsează durata în format HH:MM:SS
            const timeParts = item.duration.split(':');
            if (timeParts.length === 3) {
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseInt(timeParts[2]) || 0;
              totalSeconds += hours * 3600 + minutes * 60 + seconds;
            }
          }
        });
        
        // Convertește înapoi în format HH:MM:SS
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
        const totalSecs = totalSeconds % 60;
        const totalDuration = `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
        
        console.log('🔍 Total fichaje duration:', totalDuration, 'seconds:', totalSeconds);
        setTotalFichajeDuration(totalDuration);

        setLogs(sortedLogs);
        setLoadingLogs(false);
        setChangingMonth(false);
        return sortedLogs;
      } else {
        // Nu există registre pentru această lună
        setLogs([]);
        setTotalFichajeDuration(null);
        setLoadingLogs(false);
        setChangingMonth(false);
        return [];
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
      setTotalFichajeDuration(null);
    }
    setLoadingLogs(false);
    setChangingMonth(false);
    return [];
  }, [authUser, callApi, selectedMonth]);

  // Încarcă marcajele la montarea componentei și când se schimbă luna
  useEffect(() => {
    if (!isAuthenticated || !authUser) {
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo fichajes data instead of fetching from backend');
      setDemoFichajes();
      setLoadingLogs(false);
      return;
    }

    fetchLogs(selectedMonth);
  }, [authUser, fetchLogs, isAuthenticated, selectedMonth]);

  // Calcula las horas mensuales de los marcajes existentes
  // Monthly hours calculation removed - duration is now calculated by database triggers

  // Obtiene las horas asignadas para el grupo del usuario
  const obtenerHorasAsignadas = async () => {
    try {
      const grupo = authUser?.GRUPO || 'Empleado';
      
      // Folosim backend-ul nou
      const url = routes.getTargetOreGrupo 
        ? `${routes.getTargetOreGrupo}?grupo=${encodeURIComponent(grupo)}`
        : `${import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.decaminoservicios.com'}/api/horas-asignadas?grupo=${encodeURIComponent(grupo)}`;
      
      console.log('✅ [Fichaje] Folosind backend-ul nou (getHorasAsignadas):', url);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Backend-ul returnează direct { anuales: ..., mensuales: ... }
      if (data && data.mensuales) {
        return data.mensuales;
      } else {
        return 162; // Default para grupos desconocidos
      }
    } catch (error) {
      console.error('❌ Error fetching horas asignadas:', error);
      return 162; // Default en caso de error
    }
  };

  // Funcție pentru a converti timpul (HH:MM) în minute
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const canUseIncidenceExit = useMemo(() => {
    if (!logs || logs.length === 0) return false;
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(`${a.data} ${a.hora}`);
      const dateB = new Date(`${b.data} ${b.hora}`);
      return dateB - dateA;
    });
    const ultimoMarcaje = sortedLogs[0];
    return ultimoMarcaje && ultimoMarcaje.tipo === 'Entrada';
  }, [logs]);

  const handleFichar = async (tipo, customMotivo = '', options = {}) => {
    const { bypassSchedule = false } = options;
    // Verifică restricțiile de timp dacă există orar SAU cuadrante
    if (!bypassSchedule && (horarioAsignado || cuadranteAsignado) && !isTimeWithinSchedule(tipo)) {
      const restrictionMessage = getTimeRestrictionMessage(tipo);
      const message = restrictionMessage 
        ? `No puedes registrar ${tipo.toLowerCase()} en este momento. ${restrictionMessage}`
        : `No puedes registrar ${tipo.toLowerCase()} en este momento. Consulta tu horario asignado.`;
      
      setNotification({
        type: 'error',
        message: 'Restricción de horario',
        description: message
      });
      return;
    }

    // Deschide modal-ul de confirmare
    setFichajeTipo(tipo);
    setFichajeCustomMotivo(customMotivo || '');
    setShowFichajeConfirmModal(true);
    return; // Oprește execuția aici, va continua în confirmFichaje
  };

  const confirmFichaje = async () => {
    const tipo = fichajeTipo;
    if (!tipo) {
      setShowFichajeConfirmModal(false);
      setFichajeTipo('');
      setFichajeCustomMotivo('');
      return;
    }

    // Verifica si el último marcaje es del mismo tipo
    const ultimoMarcaje = logs[0]; // El primero de la lista es el más reciente
    if (ultimoMarcaje && ultimoMarcaje.tipo === tipo) {
      setNotification({
        type: 'warning',
        title: '¡Atención!',
        message: `No puedes marcar ${tipo === 'Entrada' ? 'la entrada' : 'la salida'} dos veces consecutivas! Último marcaje: ${ultimoMarcaje.tipo} a las ${ultimoMarcaje.hora}`
      });
      setShowFichajeConfirmModal(false);
      setFichajeTipo('');
      setFichajeCustomMotivo('');
      return;
    }
    
    setFichando(true);
    setLastFichaje(null);
    
    // Închide modal-ul imediat după începerea procesului
    setShowFichajeConfirmModal(false);
    setFichajeTipo('');
    setFichajeCustomMotivo('');
    
    // Folosește locația din context (deja cerută la accesarea paginii)
    // Dacă nu avem locație (ex: eroare la accesarea paginii), încercăm din nou
    let loc = currentLocation;
    let address = currentAddress;
    
    // Dacă nu avem locație cached, cere-o acum (fallback pentru cazuri rare)
    if (!loc) {
      try {
        console.log('📍 No location cached, requesting now...');
        loc = await locationContext.getCurrentLocation();
        // Obține adresa prin reverse geocoding folosind funcția din context
        if (loc) {
          try {
            address = await locationContext.getAddressFromCoords(loc.latitude, loc.longitude) || currentAddress;
          } catch (e) {
            // Ignoră erorile de geocodare - continuă fără adresă
            address = currentAddress;
          }
        }
      } catch (error) {
        console.warn('Geolocation not available or denied:', error);
        // Continuă fără locație - marcajul se salvează oricum
      }
    } else {
      // Avem locație cached - folosim-o direct
      console.log('✅ Using cached location from page access');
    }
    
    // Salvează marcajul în backend (cu sau fără locație)
    try {
      await saveFichaje(tipo, loc, address, fichajeCustomMotivo);
    } catch (error) {
      console.error('Error saving fichaje:', error);
      setFichando(false);
    }
  };



  const saveFichaje = async (tipo, loc, address, customMotivo = '') => {
    try {
      // Verifica si tenemos email en ambos formatos posibles
      const userEmail = authUser?.['CORREO ELECTRONIC'] || authUser?.email;
      const userName = authUser?.['NOMBRE / APELLIDOS'] || authUser?.name;
      const userCode = authUser?.['CODIGO'] || authUser?.codigo;
      
      if (!userEmail || !userName || !userCode) {
        console.error('Missing user data:', {
          email: userEmail,
          nombre: userName,
          codigo: userCode
        });
        setNotification({
          type: 'error',
          title: 'Error de Autenticación',
          message: '¡Datos de usuario faltantes! Por favor, inicia sesión nuevamente.'
        });
        setFichando(false);
        return;
      }

      // Calculează orele lunare și verifică limita (cu timeout pentru viteză)
      let horasMensuales = 0;
      let horasAsignadas = 162; // Default
      
      try {
        // Timeout de 3 secunde pentru calculul orelor lunare
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const [horasAsignadasResult] = await Promise.race([
          Promise.all([
            obtenerHorasAsignadas()
          ]),
          timeoutPromise
        ]);
        
        horasMensuales = 0; // Duration is now calculated by database triggers
        horasAsignadas = horasAsignadasResult;
      } catch (error) {
        console.log('Timeout sau eroare la calculul orelor lunare, continuăm cu valori default');
        // Continuă cu valori default
      }
      
      if (horasMensuales >= horasAsignadas) {
        const confirmacion = confirm(
          `⚠️ ATENCIÓN: ¡Has superado las horas mensuales asignadas!\n\n` +
          `Horas trabajadas: ${horasMensuales}h\n` +
          `Horas asignadas: ${horasAsignadas}h\n` +
          `Exceso: ${horasMensuales - horasAsignadas}h\n\n` +
          `¿Estás seguro de que quieres registrar este marcaje?`
        );
        
        if (!confirmacion) {
          setFichando(false);
          return;
        }
      }

      // Duration is now calculated by database triggers - no need for frontend calculation
      const duracion = ''; // Will be calculated by database

      // Hora y fecha oficiales de Madrid (independiente del dispositivo)
      const madridNowDate = new Date(madridNowMs || Date.now());
      const horaMadrid = madridNowDate.toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const fechaMadrid = madridNowDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

      const fichajeData = {
        id: generateUniqueId(),
        codigo: userCode,
        nombre: userName,
        email: userEmail,
        tipo,
        hora: horaMadrid,
        address: address || null,
        modificatDe: authUser?.isManager ? 'Manager' : 'Empleado',
        data: fechaMadrid, // YYYY-MM-DD en zona Europe/Madrid
        duracion: duracion,
        motivo: customMotivo || (tipo === 'Entrada' ? 'Entrada registrada desde web' : 'Salida registrada desde web')
      };

      console.log('✅ [Fichaje] Folosind backend-ul nou (addFichaje):', API_ENDPOINTS.FICHAJE_ADD);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const result = await callApi(API_ENDPOINTS.FICHAJE_ADD, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(fichajeData)
      });

      if (result.success) {
        // Log crearea fichaje (non-blocking pentru viteză)
        activityLogger.logFichajeCreated(fichajeData, authUser).catch(error => {
          console.warn('Error logging activity (non-blocking):', error);
        });
        
        // Actualizează UI-ul instant fără să reîncarcă toate marcajele
        const newFichaje = {
          tipo,
          hora: horaMadrid,
          address,
          data: fechaMadrid,
          duration: duracion,
          codigo: userCode,
          modificatDe: authUser?.isManager ? 'Manager' : 'Empleado'
        };
        
        // Adaugă noul marcaje la începutul listei
        setLogs(prevLogs => [newFichaje, ...prevLogs]);
        setLastFichaje(newFichaje);

        // După orice marcaje, reîncarcă din backend pentru a aduce DURACIÓN calculată de DB
        // Folosim același endpoint ca la inițializare (fetchLogs) pentru consistență
        if (tipo === 'Salida' || tipo === 'Entrada') {
          const start = Date.now();
          const tryReload = async () => {
            try {
              // Reîncarcă lista pentru toată luna folosind același endpoint ca la inițializare
              const updatedLogs = await fetchLogs(selectedMonth);
              
              // Verifică dacă durata a fost calculată (doar pentru Salida)
              if (tipo === 'Salida' && updatedLogs && updatedLogs.length > 0) {
                const hasDuration = updatedLogs.some(r => 
                  r.tipo === 'Salida' && 
                  r.duration && 
                  r.duration !== '' && 
                  r.data === newFichaje.data
                );
                
                // Dacă durata a fost calculată, oprim retrierea
                if (hasDuration) {
                  return;
                }
              } else if (tipo === 'Entrada') {
                // Pentru Entrada, nu trebuie să așteptăm durata, oprim retrierea
                return;
              }
            } catch (error) {
              console.warn('Error reloading logs:', error);
            }

            // Continuă să încerci până la ~30s (DB poate întârzia calculul DURACION)
            if (Date.now() - start < 30000) {
              setTimeout(tryReload, 1200);
            }
          };

          // Delay inițial pentru a permite DB-ului să proceseze
          setTimeout(tryReload, 300);
        }
      } else {
        console.error('Error from API:', result.error);
        setNotification({
          type: 'error',
          title: t('error.saveError'),
          message: t('error.saveErrorDetails')
        });
      }
    } catch (error) {
      console.error('Error saving fichaje:', error);
              setNotification({
          type: 'error',
          title: t('error.saveError'),
          message: t('error.saveErrorDetails')
        });
    } finally {
      // Aseguramos que fichando se resetee SIEMPRE, sin importar el resultado
      setFichando(false);
    }
    
    // Închide modal-ul
    setShowFichajeConfirmModal(false);
    setFichajeTipo('');
  };

  // Funcție pentru a obține orarul zilei curente
  const getCurrentDaySchedule = () => {
    if (cuadranteAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        // IMPORTANT: Suportă multiple ture în formatul "08:00-12:00,14:00-18:00,20:00-00:00"
        if (daySchedule.includes(',')) {
          // Multiple ture separate prin virgulă
          const matches = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g);
          if (matches && matches.length > 0) {
            return matches.map(match => match).join(' / ');
          }
        } else {
          // O singură tură în formatul "T1 08:00-16:00" sau "08:00-16:00"
          const match = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
          if (match) {
            return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
          }
        }
      }
      return null;
    } else if (horarioAsignado && horarioAsignado.days) {
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      
      // Debug logging
      console.log('🔍 DEBUG getCurrentDaySchedule - today:', today, 'dayKey:', dayKey);
      console.log('🔍 DEBUG getCurrentDaySchedule - daySchedule:', daySchedule);
      console.log('🔍 DEBUG getCurrentDaySchedule - horarioAsignado.days:', horarioAsignado.days);
      
      if (daySchedule) {
        const intervals = [];
        // Verifică că valorile sunt string-uri valide în format HH:MM
        const isValidTime = (time) => {
          const isValid = typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time);
          if (!isValid && time) {
            console.log('⚠️ DEBUG - Invalid time format:', time, 'type:', typeof time);
          }
          return isValid;
        };
        
        console.log('🔍 DEBUG - in1:', daySchedule.in1, 'out1:', daySchedule.out1);
        console.log('🔍 DEBUG - in2:', daySchedule.in2, 'out2:', daySchedule.out2);
        console.log('🔍 DEBUG - in3:', daySchedule.in3, 'out3:', daySchedule.out3);
        
        if (isValidTime(daySchedule.in1) && isValidTime(daySchedule.out1)) {
          // Extrage doar HH:MM dacă e în format HH:MM:SS
          const in1 = daySchedule.in1.substring(0, 5);
          const out1 = daySchedule.out1.substring(0, 5);
          intervals.push(`${in1} - ${out1}`);
        }
        if (isValidTime(daySchedule.in2) && isValidTime(daySchedule.out2)) {
          const in2 = daySchedule.in2.substring(0, 5);
          const out2 = daySchedule.out2.substring(0, 5);
          intervals.push(`${in2} - ${out2}`);
        }
        if (isValidTime(daySchedule.in3) && isValidTime(daySchedule.out3)) {
          const in3 = daySchedule.in3.substring(0, 5);
          const out3 = daySchedule.out3.substring(0, 5);
          intervals.push(`${in3} - ${out3}`);
        }
        
        console.log('🔍 DEBUG - intervals:', intervals);
        
        if (intervals.length > 0) {
          return intervals.join(' / ');
        }
      } else {
        console.log('⚠️ DEBUG - daySchedule is null/undefined for dayKey:', dayKey);
      }
    }
    return null;
  };

  // Funcție pentru a calcula orele zilnice din orarul curent
  const getCurrentDayHours = () => {
    if (cuadranteAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        // Folosește helper-ul comun pentru calculul orelor
        const hours = calculateCuadranteHours(daySchedule);
        return hours > 0 ? hours.toFixed(2) : '0.00';
      }
      return '0.00';
    } else if (horarioAsignado && horarioAsignado.days) {
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      
      if (daySchedule) {
        // Folosește helper-ul comun pentru calculul orelor
        const hours = calculateHorarioHours(daySchedule);
        return hours > 0 ? hours.toFixed(2) : '0.00';
      }
    }
    return '0.00';
  };
  const currentDaySchedule = getCurrentDaySchedule();

  // Memoizează rezultatele pentru Entrada și Salida pentru a evita recalculări inutile
  // Recalculează doar când se schimbă horarioAsignado sau cuadranteAsignado

  const isEntradaAllowed = useMemo(() => {
    return isTimeWithinSchedule('Entrada');
  }, [isTimeWithinSchedule]);

  const isSalidaAllowed = useMemo(() => {
    return isTimeWithinSchedule('Salida');
  }, [isTimeWithinSchedule]);

  // Memoizează rezultatul calculului pentru mesajul informativ (evită recalculare la fiecare secundă)
  const timeRestrictionMessage = useMemo(() => {
    if (!horarioAsignado && !cuadranteAsignado) return null;
    
    // Verifică dacă există mai mult de 1 interval în orar (ture partajate)
    let intervalCount = 0;
    const intervals = [];
    
    if (cuadranteAsignado) {
      const todayDay = new Date().getDate();
      const dayKey = `ZI_${todayDay}`;
      const daySchedule = cuadranteAsignado[dayKey];
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        const scheduleIntervals = daySchedule.split(',');
        intervalCount = scheduleIntervals.length;
        scheduleIntervals.forEach(interval => {
          const match = interval.match(/(\d{1,2}):(\d{2})/g);
          if (match && match.length === 2) {
            intervals.push({ start: match[0], end: match[1] });
          }
        });
      }
    } else if (horarioAsignado && horarioAsignado.days) {
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      if (daySchedule) {
        if (daySchedule.in1 && daySchedule.out1) {
          intervals.push({ start: daySchedule.in1, end: daySchedule.out1 });
          intervalCount++;
        }
        if (daySchedule.in2 && daySchedule.out2) {
          intervals.push({ start: daySchedule.in2, end: daySchedule.out2 });
          intervalCount++;
        }
        if (daySchedule.in3 && daySchedule.out3) {
          intervals.push({ start: daySchedule.in3, end: daySchedule.out3 });
          intervalCount++;
        }
      }
    }
    
    const today = new Date().toISOString().split('T')[0];
    const hasEntradaToday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
    });
    const hasSalidaToday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Salida';
    });
    
    // Dacă există mai mult de 1 interval, verifică în ce interval ne aflăm
    if (intervalCount > 1 && intervals.length > 0) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        const start = parseTimeToMinutes(interval.start);
        const end = parseTimeToMinutes(interval.end);
        
        if (currentTime >= start && currentTime <= end) {
          continue;
        }
        
        if (i < intervals.length - 1) {
          const nextInterval = intervals[i + 1];
          const nextStart = parseTimeToMinutes(nextInterval.start);
          
          if (currentTime > end && currentTime < nextStart) {
            return `⏰ Se espera una nueva Entrada a las ${nextInterval.start}. Trabajo completo hasta las ${nextInterval.end}.`;
          }
        }
      }
    }
    
    // Funcție pentru a verifica dacă s-a depășit timpul programat
    const checkTimeExceeded = (entradaLog, salidaLog) => {
      let firstInTime = null;
      let lastOutTime = null;
      
      if (cuadranteAsignado) {
        const todayDay = new Date().getDate();
        const dayKey = `ZI_${todayDay}`;
        const daySchedule = cuadranteAsignado[dayKey];
        
        if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
          const scheduleIntervals = daySchedule.split(',');
          let minStartTime = 1440;
          let maxEndTime = 0;
          scheduleIntervals.forEach(interval => {
            const match = interval.match(/(\d{1,2}):(\d{2})/g);
            if (match && match.length === 2) {
              const startMatch = match[0].match(/(\d{1,2}):(\d{2})/);
              const endMatch = match[1].match(/(\d{1,2}):(\d{2})/);
              if (startMatch) {
                const startMinutes = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
                if (startMinutes < minStartTime) {
                  minStartTime = startMinutes;
                  firstInTime = startMinutes;
                }
              }
              if (endMatch) {
                const endMinutes = parseInt(endMatch[1]) * 60 + parseInt(endMatch[2]);
                if (endMinutes > maxEndTime) {
                  maxEndTime = endMinutes;
                  lastOutTime = endMinutes;
                }
              }
            }
          });
        }
      } else if (horarioAsignado && horarioAsignado.days) {
        const today = new Date().getDay();
        const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
        const daySchedule = horarioAsignado.days[dayKey];
        
        if (daySchedule) {
          const inTimes = [];
          const outTimes = [];
          if (daySchedule.in1) {
            const time = daySchedule.in1.split(':');
            inTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          if (daySchedule.in2) {
            const time = daySchedule.in2.split(':');
            inTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          if (daySchedule.in3) {
            const time = daySchedule.in3.split(':');
            inTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          if (daySchedule.out1) {
            const time = daySchedule.out1.split(':');
            outTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          if (daySchedule.out2) {
            const time = daySchedule.out2.split(':');
            outTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          if (daySchedule.out3) {
            const time = daySchedule.out3.split(':');
            outTimes.push(parseInt(time[0]) * 60 + parseInt(time[1]));
          }
          
          if (inTimes.length > 0) {
            firstInTime = Math.min(...inTimes);
          }
          if (outTimes.length > 0) {
            lastOutTime = Math.max(...outTimes);
          }
        }
      }
      
      if (firstInTime !== null && lastOutTime !== null && entradaLog && salidaLog) {
        const entradaHora = entradaLog.HORA || entradaLog.hora;
        const entradaTime = entradaHora.split(':');
        const entradaMinutes = parseInt(entradaTime[0]) * 60 + parseInt(entradaTime[1]) + (entradaTime[2] ? parseInt(entradaTime[2]) / 60 : 0);
        
        const salidaHora = salidaLog.HORA || salidaLog.hora;
        const salidaTime = salidaHora.split(':');
        const salidaMinutes = parseInt(salidaTime[0]) * 60 + parseInt(salidaTime[1]) + (salidaTime[2] ? parseInt(salidaTime[2]) / 60 : 0);
        
        const tiempoEfectivo = salidaMinutes - entradaMinutes;
        const tiempoProgramado = lastOutTime - firstInTime;
        const diferencia = tiempoEfectivo - tiempoProgramado;
        
        if (diferencia > 5) {
          const minutos = Math.floor(diferencia);
          const segundos = Math.round((diferencia - minutos) * 60);
          const minutosTexto = minutos > 0 ? `${minutos} minuto${minutos !== 1 ? 's' : ''}` : '';
          const segundosTexto = segundos > 0 ? `${segundos} segundo${segundos !== 1 ? 's' : ''}` : '';
          const tiempoTexto = minutos > 0 && segundos > 0 ? `${minutosTexto} y ${segundosTexto}` : minutosTexto || segundosTexto;
          
          return `Has completado tu jornada laboral de hoy. ⚠️ Te recomendamos fichar exact en los horarios asignados para una mejor gestión del tiempo. (Has excedido ${tiempoTexto}).`;
        } else if (diferencia < -5) {
          return 'Has completado tu jornada laboral de hoy.';
        }
      }
      
      return 'Has completado tu jornada laboral de hoy.';
    };
    
    if (hasEntradaToday && hasSalidaToday && (horarioAsignado || cuadranteAsignado)) {
      const entradaLog = logs.find(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
      });
      const salidaLog = logs.find(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Salida';
      });
      
      if (entradaLog && salidaLog && (entradaLog.HORA || entradaLog.hora) && (salidaLog.HORA || salidaLog.hora)) {
        const result = checkTimeExceeded(entradaLog, salidaLog);
        if (result && result !== 'Has completado tu jornada laboral de hoy.') {
          return result;
        }
      }
    }
    
    // Dacă nu s-a completat tura, verifică restricțiile
    if (hasEntradaToday) {
      if (!isSalidaAllowed) {
        return `Salida: ${getTimeRestrictionMessage('Salida') || 'No permitida en este momento'}`;
      }
    } else {
      if (!isEntradaAllowed && !isSalidaAllowed) {
        return `${getTimeRestrictionMessage('Entrada') || 'Consulta tu horario asignado'}`;
      } else if (!isEntradaAllowed) {
        return `Entrada: ${getTimeRestrictionMessage('Entrada') || 'No permitida en este momento'}`;
      } else {
        return `Salida: ${getTimeRestrictionMessage('Salida') || 'No permitida en este momento'}`;
      }
    }
    
    return null;
  }, [logs, cuadranteAsignado, horarioAsignado, isEntradaAllowed, isSalidaAllowed, getTimeRestrictionMessage]);

  // Dacă utilizatorul nu este autentificat, afișează un mesaj
  return (
    <div className="space-y-6">
      {loadingAlerts && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-sm text-yellow-700">
          <div className="h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Comprobando alertas mensuales...</span>
        </div>
      )}

      {!loadingAlerts && monthlyAlerts && monthlyAlerts.total > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-md flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">Alertas mensuales detectadas</h3>
            <p className="text-sm text-yellow-700">
              Tienes {monthlyAlerts.total} días con alertas este mes: <span className="font-semibold text-red-600">+{monthlyAlerts.positivos}</span> con exceso y <span className="font-semibold text-yellow-600">-{monthlyAlerts.negativos}</span> con déficit. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
            </p>
          </div>
        </div>
      )}

      {/* Card cu ceas și butoane */}
      <Card>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">🕒</span>
          </div>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {madridTimeStr || now.toLocaleTimeString()}
          </div>
          <div className="text-xs text-gray-500 mb-6">Hora (Europe/Madrid)</div>
          {/* Locația curentă afișată sub ceas - se obține doar când utilizatorul apasă Fichar (GDPR compliant) */}
          <div className="mb-6 text-sm text-gray-600">
            <div className="flex items-start justify-center gap-2">
              <span className="text-red-600">📍</span>
              <div className="text-center">
                {!currentLocation && (
                  <span className="text-gray-500 italic">
                    La ubicación se obtendrá al fichar (se necesita permiso)
                  </span>
                )}
                {currentLocation && (
                  <>
                    <div>
                      {currentAddress ? (
                        <span>{currentAddress}</span>
                      ) : (
                        <span>
                          {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Informații despre orarul/cuadrantul asignat */}
          <div className="mb-6">
            {loadingCuadrante || loadingHorario ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando horario...</span>
              </div>
            ) : cuadranteAsignado ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">📋</span>
                  <span className="font-semibold text-green-800">Cuadrantes Asignado</span>
                </div>
                <div className="text-sm text-green-700">
                  <div><strong>Empleado:</strong> {cuadranteAsignado.NOMBRE || 'N/A'}</div>
                  <div><strong>Centro:</strong> {cuadranteAsignado.CENTRO || 'N/A'}</div>
                  <div><strong>Mes:</strong> {cuadranteAsignado.LUNA || 'N/A'}</div>
                  <div><strong>Fuente:</strong> Cuadrante generado</div>
                  {currentDaySchedule && (
                    <div className="mt-2 pt-2 border-t border-green-300">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-green-800 rounded-md">
                        <span className="text-xs">📅 Hoy:</span>
                        <span className="text-xs font-semibold">{currentDaySchedule}</span>
                      </div>
                    </div>
                  )}
                  {(() => {
                    // Folosește calculul din orarul curent
                    return (
                      <div><strong>Horas Diarias:</strong> {getCurrentDayHours()}h</div>
                    );
                  })()}
                </div>
              </div>
            ) : horarioAsignado ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600">📅</span>
                  <span className="font-semibold text-blue-800">Horario Asignado</span>
                </div>
                <div className="text-sm text-blue-700">
                  <div><strong>Centro:</strong> {horarioAsignado.centroNombre}</div>
                  <div><strong>Grupo:</strong> {horarioAsignado.grupoNombre}</div>
                  <div><strong>Horario:</strong> {horarioAsignado.nombre}</div>
                  {currentDaySchedule && (
                    <div className="mt-2 pt-2 border-t border-blue-300">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-blue-800 rounded-md">
                        <span className="text-xs">📅 Hoy:</span>
                        <span className="text-xs font-semibold">{currentDaySchedule}</span>
                      </div>
                    </div>
                  )}
                  {(() => {
                    // Folosește calculul din orarul curent
                    return (
                      <div><strong>Horas Diarias:</strong> {getCurrentDayHours()}h</div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-600">⚠️</span>
                  <span className="font-semibold text-yellow-800">Sin Horario Asignado</span>
                </div>
                <div className="text-sm text-yellow-700">
                  No se ha encontrado un horario específico para tu centro y grupo de trabajo.
                </div>
              </div>
            )}
          </div>
          
          {/* Mesaj informativ când butoanele sunt blocate */}
          {/* Avertisment pentru Baja Médica */}
          {isOnBajaMedica && currentBajaMedica && (
            <div className="mb-4 p-4 bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl shadow-lg">
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
                    Actualmente estás de baja médica. No puedes registrar fichajes durante este período. Por favor, consulta con tu médico y sigue las indicaciones.
                  </p>
                  {currentBajaMedica.startDate && (
                    <p className="text-rose-600 text-xs">
                      <strong>Período:</strong> {currentBajaMedica.startDate} - {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endDate = currentBajaMedica.endDate ? new Date(currentBajaMedica.endDate) : null;
                        
                        // Dacă există endDate și este în viitor sau astăzi, afișăm endDate
                        // Dacă endDate este în trecut sau nu există, afișăm "presente"
                        if (endDate && endDate >= today) {
                          return currentBajaMedica.endDate;
                        } else {
                          return 'presente';
                        }
                      })()}
                    </p>
                  )}
                  {currentBajaMedica.situacion && (
                    <p className="text-rose-600 text-xs mt-1">
                      <strong>Situación:</strong> {currentBajaMedica.situacion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Avertisment pentru alte absențe */}
          {isOnVacationOrAbsence && !isOnBajaMedica && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                </div>
                <div>
                  <p className="text-yellow-800 font-semibold">
                    No puedes fichar durante {currentAbsenceType}
                  </p>
                  <p className="text-yellow-600 text-sm">
                    Los botones de Entrada y Salida están deshabilitados
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mesaj informativ când butoanele sunt blocate din cauza orarului SAU când s-a completat tura */}
          {!isOnVacationOrAbsence && (horarioAsignado || cuadranteAsignado) && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-lg">⏰</span>
                </div>
                <div>
                  <p className="text-blue-800 font-semibold">
                    {(() => {
                      // Verifică dacă s-a completat tura de azi
                      const today = new Date().toISOString().split('T')[0];
                      const hasEntradaToday = logs.some(log => {
                        const logDate = log.data || log.FECHA || log.fecha;
                        return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
                      });
                      const hasSalidaToday = logs.some(log => {
                        const logDate = log.data || log.FECHA || log.fecha;
                        return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Salida';
                      });
                      
                      // Dacă s-a completat tura, afișează mesaj de succes
                      // IMPORTANT: Pentru ture partajate, verifică dacă toate turele sunt completate
                      if (hasEntradaToday && hasSalidaToday) {
                        // Dacă există mai mult de 1 interval în orar, verifică dacă toate sunt completate
                        let entradasCount = 0;
                        let salidasCount = 0;
                        
                        logs.forEach(log => {
                          const logDate = log.data || log.FECHA || log.fecha;
                          if (logDate && logDate.startsWith(today)) {
                            if ((log.tipo || log.TIPO) === 'Entrada') entradasCount++;
                            if ((log.tipo || log.TIPO) === 'Salida') salidasCount++;
                          }
                        });
                        
                        // Numără intervalele disponibile în orar (pentru ture partajate)
                        let intervalCount = 0;
                        if (cuadranteAsignado) {
                          const todayDay = new Date().getDate();
                          const dayKey = `ZI_${todayDay}`;
                          const daySchedule = cuadranteAsignado[dayKey];
                          if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
                            // Numără intervalele separate prin virgulă
                            const intervals = daySchedule.split(',');
                            intervalCount = intervals.length;
                          }
                        } else if (horarioAsignado && horarioAsignado.days) {
                          const today = new Date().getDay();
                          const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
                          const daySchedule = horarioAsignado.days[dayKey];
                          if (daySchedule) {
                            let count = 0;
                            if (daySchedule.in1 && daySchedule.out1) count++;
                            if (daySchedule.in2 && daySchedule.out2) count++;
                            if (daySchedule.in3 && daySchedule.out3) count++;
                            intervalCount = count;
                          }
                        }
                        
                        // Dacă există mai mult de 1 interval, verifică dacă toate sunt completate
                        // Pentru fiecare interval, trebuie 1 Entrada și 1 Salida
                        if (intervalCount > 1) {
                          const expectedCyles = intervalCount;
                          // Un ciclu = 1 Entrada + 1 Salida
                          if (entradasCount >= expectedCyles && salidasCount >= expectedCyles) {
                            return '✅ Turno completado hoy con éxito';
                          }
                          // Dacă nu sunt completate toate turele, nu afișa mesajul de succes
                          return 'Fuera del horario asignado';
                        }
                        
                        // Pentru un singur interval sau fără orar, comportamentul normal
                        return '✅ Turno completado hoy con éxito';
                      }
                      
                      return 'Fuera del horario asignado';
                    })()}
                  </p>
                  <p className="text-blue-600 text-sm">
                    {timeRestrictionMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => handleFichar('Entrada')}
              disabled={fichando || isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isEntradaAllowed)}
              className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isEntradaAllowed)
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : ((horarioAsignado || cuadranteAsignado) && !isEntradaAllowed)
                    ? getTimeRestrictionMessage('Entrada') || 'Entrada no permitida en este momento'
                    : 'Iniciar jornada'
              }
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30">
                  <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">🚪</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">{fichando ? 'Marcando...' : 'Entrada'}</div>
                  <div className="text-xs text-white/80">Iniciar jornada</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handleFichar('Salida')}
              disabled={fichando || isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)}
              className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)
                    ? getTimeRestrictionMessage('Salida') || 'Salida no permitida en este momento'
                    : 'Finalizar jornada'
              }
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30">
                  <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">🚪</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">{fichando ? 'Marcando...' : 'Salida'}</div>
                  <div className="text-xs text-white/80">Finalizar jornada</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleFichar('Salida', 'Salida para incidencia', { bypassSchedule: true })}
              disabled={fichando || isOnVacationOrAbsence || !canUseIncidenceExit}
              className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || !canUseIncidenceExit
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : !canUseIncidenceExit
                    ? 'Debes registrar una entrada antes de usar esta salida'
                    : 'Salida imprevista para incidencia'
              }
            >
              <div className="absolute inset-0 rounded-xl bg-amber-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30">
                  <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">⚡</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">{fichando ? 'Marcando...' : 'Salida para incidencia'}</div>
                  <div className="text-xs text-white/80">Salida imprevista</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={hasCompletedCycle ? onFicharIncidencia : null}
              disabled={fichando || !hasCompletedCycle}
              className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                hasCompletedCycle && !fichando
                  ? 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
              }`}
              title={!hasCompletedCycle ? 'Debes hacer Salida primero para poder registrar una ausencia' : 'Registrar ausencia médica o personal'}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl opacity-30 blur-md transition-all duration-300 ${
                hasCompletedCycle && !fichando
                  ? 'bg-orange-400 animate-pulse group-hover:opacity-40'
                  : 'bg-gray-400'
              }`}></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30">
                  <span className={`text-xl transition-transform duration-300 ${
                    hasCompletedCycle && !fichando ? 'group-hover:scale-110' : ''
                  }`}>
                    {!hasCompletedCycle ? '🔒' : '⚠️'}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">
                    Registrar Ausencia
                  </div>
                  <div className="text-xs text-white/80">
                    {!hasCompletedCycle ? 'Completa ciclo primero' : 'Registro especial'}
                  </div>
                </div>
              </div>
            </button>
          </div>
          
          {/* Mensaje explicativo para incidencia */}
          {!hasCompletedCycle && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-amber-600 text-lg mr-3">ℹ️</span>
                <div>
                  <p className="text-amber-800 font-medium">
                    Para registrar una ausencia médica o personal
                  </p>
                  <p className="text-amber-600 text-sm">
                    Primero debes hacer <strong>Salida</strong> para terminar tu jornada
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Feedback pentru ultimul marcaj */}
          {lastFichaje && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-green-600 text-lg mr-2">✅</span>
                <div>
                  <p className="text-green-800 font-medium">
                    {lastFichaje.tipo} marcado a las {lastFichaje.hora}
                  </p>
                  {lastFichaje.address && (
                    <p className="text-green-600 text-sm">{lastFichaje.address}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback pentru incidencia */}
          {incidenciaMessage && (
            <div className={`mt-4 p-4 border rounded-lg ${
              incidenciaMessage.includes('succes') 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <span className={`text-lg mr-2 ${
                  incidenciaMessage.includes('succes') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {incidenciaMessage.includes('succes') ? '✅' : '❌'}
                </span>
                <div>
                  <p className={`font-medium ${
                    incidenciaMessage.includes('succes') ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {incidenciaMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

              {/* Tab switcher pentru Registros/Ausencias */}
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                    changingMonth 
                      ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' 
                      : 'bg-gradient-to-br from-red-500 to-red-600'
                  }`}>
                    <span className="text-white text-xl">
                      {changingMonth ? '⏳' : '📅'}
                    </span>
                  </div>
                  {/* Glow effect */}
                  <div className={`absolute inset-0 w-12 h-12 rounded-xl opacity-20 blur-md animate-pulse transition-all duration-300 ${
                    changingMonth ? 'bg-yellow-400' : 'bg-red-400'
                  }`}></div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {activeTab === 'registros' 
                      ? `Registros de ${new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
                      : activeTab === 'ausencias'
                      ? `Ausencias de ${new Date().getFullYear()}`
                      : 'Horas Trabajadas'
                    }
                  </h2>
                  <p className="text-sm text-gray-600">
                    {changingMonth ? 'Cargando...' : 
                     activeTab === 'registros' ? 'Historial de fichajes del mes seleccionado' : 
                     activeTab === 'ausencias' ? 'Registros de ausencias de todo el año' :
                     'Resumen mensual y anual de tus horas trabajadas'}
                    {activeTab === 'registros' && totalFichajeDuration && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                        ⏱️ Total: {totalFichajeDuration}
                      </span>
                    )}
                    {activeTab === 'ausencias' && totalAusenciaDuration && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        ⏱️ Total: {totalAusenciaDuration}
                      </span>
                    )}
                    {activeTab === 'ausencias' && totalAsuntoPropioDays && totalAsuntoPropioDays > 0 && (
                      <span className={`ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${
                        totalAsuntoPropioDays >= 6 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : 'bg-purple-100 text-purple-800 border-purple-200'
                      }`}>
                        📅 Asunto Propio: {totalAsuntoPropioDays}/6 días
                      </span>
                    )}
                    {activeTab === 'ausencias' && totalVacacionesDays && totalVacacionesDays > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                        🏖️ Vacaciones: {totalVacacionesDays} días
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Tab switcher */}
              <div className="flex w-full flex-wrap sm:flex-nowrap bg-gray-100 rounded-xl p-1 gap-2 sm:w-auto sm:gap-1">
                <button
                  onClick={() => setActiveTab('registros')}
                  className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'registros'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📊 Registros
                </button>
                <button
                  onClick={() => setActiveTab('ausencias')}
                  className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'ausencias'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ⚠️ Ausencias
                </button>
                <button
                  onClick={() => setActiveTab('horas-trabajadas')}
                  className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'horas-trabajadas'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ⏰ Horas Trabajadas
                </button>
              </div>
            </div>
            
            {/* Controls only for registros tab */}
            {activeTab === 'registros' && (
              <div className="grid grid-cols-1 sm:flex sm:items-center gap-3">
                {/* Selector ULTRA MODERN de lună - Glassmorphism + 3D - RESPONSIVE */}
                <div className="relative group flex-1">
                  {/* Background blur effect */}
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl group-hover:shadow-red-200/50 transition-all duration-500"></div>
                  
                  {/* Main container */}
                  <div className="relative">
                    <select
                      id="registros-month-select"
                      name="registros-month"
                      value={selectedMonth}
                      onChange={(e) => {
                        console.log('🔍 Month changed from', selectedMonth, 'to', e.target.value);
                        setSelectedMonth(e.target.value);
                      }}
                      disabled={changingMonth}
                      className={`appearance-none bg-transparent border-0 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 pr-12 sm:pr-16 text-sm sm:text-base font-bold text-gray-800 focus:outline-none transition-all duration-300 w-full ${
                        changingMonth ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      {/* Ultimele 12 luni */}
                      {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - i);
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                        const value = `${year}-${month}`;
                        return (
                          <option key={value} value={value} className="py-2">
                            {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                          </option>
                        );
                      })}
                    </select>
                    
                    {/* Icon spectaculos pentru dropdown */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-6 pointer-events-none">
                      {changingMonth ? (
                        <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 sm:border-3 border-red-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                      ) : (
                        <div className="relative">
                          {/* Glow effect */}
                          <div className="absolute inset-0 bg-red-400/30 rounded-full blur-sm sm:blur-md animate-pulse"></div>
                          {/* Main icon */}
                          <svg className="w-4 h-4 sm:w-6 sm:h-6 text-red-500 group-hover:text-red-600 transition-all duration-300 group-hover:scale-110 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Decorative elements - hidden on mobile */}
                    <div className="hidden sm:block absolute top-2 left-2 w-2 h-2 bg-red-400/60 rounded-full animate-ping"></div>
                    <div className="hidden sm:block absolute bottom-2 right-8 w-1 h-1 bg-red-300/80 rounded-full animate-pulse"></div>
                  </div>
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                  </div>
                </div>
                
                {/* Buton ULTRA MODERN "Hoy" - 3D + Glassmorphism - RESPONSIVE */}
                <button
                  onClick={() => {
                    const currentDate = new Date();
                    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    setSelectedMonth(currentMonth);
                  }}
                  disabled={changingMonth}
                  className={`group relative px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-2xl hover:shadow-red-300/50 w-full sm:w-auto ${
                    changingMonth ? 'opacity-50 cursor-not-allowed transform-none' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                  title="Volver al mes actual"
                >
                  {/* 3D depth effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-red-300 to-red-800 opacity-20 transform translate-y-1 group-active:translate-y-0 transition-transform duration-150"></div>
                  
                  {/* Main content */}
                  <div className="relative flex items-center justify-center gap-2 sm:gap-3">
                    {/* Icon cu animație spectaculoasă */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-pulse"></div>
                      <span className="text-xl sm:text-2xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 relative z-10">🎯</span>
                    </div>
                    
                    {/* Text cu efecte */}
                    <span className="text-base sm:text-lg font-black tracking-wide" style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.2)',
                      background: 'linear-gradient(45deg, #ffffff, #fef2f2, #ffffff)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>
                      Hoy
                    </span>
                  </div>
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                  </div>
                  
                  {/* Ripple effect on click */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 transition-transform duration-300 ease-out"></div>
                  </div>
                </button>
              </div>
            )}
            
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'registros' ? (
                // Lista de registros
                loadingLogs ? (
                  <div className="flex justify-center py-8">
                      <LoadingSpinner size="lg" text={changingMonth ? "Cambiando mes..." : "Cargando marcajes..."} />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                      {changingMonth ? "No hay registros para este mes." : "No se han registrado marcajes aún."}
                  </div>
                ) : (
                <div className="space-y-3">
                  {logs.map((item, index) => (
                <div key={index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
                  {/* Header compact pe mobil */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ${
                        item.tipo === 'Entrada' 
                          ? 'bg-gradient-to-br from-green-500 to-green-600' 
                          : 'bg-gradient-to-br from-red-500 to-red-600'
                      }`}>
                        <span className="text-white text-lg">
                          {item.tipo === 'Entrada' ? '🚪' : '🚪'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-semibold text-lg truncate ${
                          item.tipo === 'Entrada' ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {item.tipo}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-gray-600 font-medium text-sm sm:text-base">{item.hora}</span>
                          {item.duration && item.tipo === 'Salida' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              ⏱️ {item.duration}
                            </span>
                          )}
                          {!item.duration && item.tipo === 'Salida' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                              ⚠️ Sin duración
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Data trunchiată pe mobil */}
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0 ml-2">
                      <span className="hidden sm:inline">{item.data}</span>
                      <span className="sm:hidden">{item.data ? item.data.split('-').reverse().join('/') : '—'}</span>
                    </span>
                  </div>
                  
                  {/* Ubicación cu text wrapping */}
                  {(item.address || item.loc) && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="block text-xs font-medium text-gray-600 mb-1">📍 Ubicación</div>
                      {item.address ? (
                        <p className="text-sm text-gray-800 break-words">{item.address}</p>
                      ) : item.loc ? (
                        <p className="text-sm text-gray-800">
                          {item.loc.latitude.toFixed(5)}, {item.loc.longitude.toFixed(5)}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                ))}
                </div>
              )) : activeTab === 'ausencias' ? (
                // Lista de ausencias
                loadingAusencias ? (
                  <div className="flex justify-center py-8">
                      <LoadingSpinner size="lg" text={changingMonth ? "Cambiando mes..." : "Cargando ausencias..."} />
                  </div>
                ) : ausencias.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                      {changingMonth ? "No hay ausencias para este mes." : "No se han registrado ausencias aún."}
                  </div>
                ) : (
                <div className="space-y-3">
                  {ausencias.map((item, index) => {
                    const durationDisplay = getAusenciaDurationDisplay(item);
                    return (
                <div key={index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
                  {/* Header compact pentru ausencias */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ${
                        item.tipo === 'Salida del Centro' 
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
                          : item.tipo === 'Regreso al Centro'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      }`}>
                        <span className="text-white text-lg">
                          {item.tipo === 'Salida del Centro' ? '🚶‍♂️' : 
                            item.tipo === 'Regreso al Centro' ? '🔄' : '🏠'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg truncate text-gray-900">
                          {item.tipo}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Afișează FECHA în loc de hora pentru toate ausencias */}
                          <span className="text-gray-600 font-medium text-sm sm:text-base">
                            {item.FECHA ? formatDateRange(item.FECHA) : 
                             (item.fecha_inicio && item.fecha_fin ? 
                               formatDateRange(`${item.fecha_inicio} - ${item.fecha_fin}`) :
                               (item.data ? item.data.split('-').reverse().join('/') : '—'))}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${
                            durationDisplay.isDayBased
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-purple-100 text-purple-800 border-purple-200'
                          }`}>
                            {durationDisplay.isDayBased ? `📅 ${durationDisplay.text}` : `⏱️ ${durationDisplay.text}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Eliminat duplicate date display - data este deja afișată mai sus */}
                  </div>
                  
                  {/* Motivo și locație */}
                  <div className="space-y-2">
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="block text-xs font-medium text-orange-700 mb-1">📝 Motivo</div>
                      <p className="text-sm text-orange-800 break-words">{item.motivo || 'Sin motivo especificado'}</p>
                    </div>
                    
                    {item.locatia && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="block text-xs font-medium text-blue-700 mb-1">📍 Ubicación</div>
                        <p className="text-sm text-blue-800 break-words mb-2">{item.locatia}</p>
                        <button
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                          onClick={() => {
                            const encodedAddress = encodeURIComponent(item.locatia);
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                          }}
                        >
                          🌍 Ver en Google Maps
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                  );
                  })}
                </div>
              )) : activeTab === 'horas-trabajadas' ? (
                // Componenta HorasTrabajadas pentru angajatul curent
                <div className="mt-4">
                  {console.log('🔍 HorasTrabajadas props:', { empleadoId: authUser?.CODIGO, soloEmpleado: true, authUser })}
                  {authUser && authUser.CODIGO ? (
                    <HorasTrabajadas 
                      empleadoId={authUser.CODIGO} 
                      soloEmpleado={true}
                      codigo={authUser.CODIGO || authUser.codigo}
                      empleadoNombre={authUser['NOMBRE / APELLIDOS'] || authUser.NOMBRE || authUser.nombre}
                    />
                  ) : (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner size="lg" text="Cargando datos del usuario..." />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Card>

      {/* Modal de confirmare pentru fichaje */}
      {showFichajeConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-md mx-4 shadow-2xl border border-blue-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⏰</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Registro</h3>
                <p className="text-sm text-gray-600">Registro de {fichajeTipo.toLowerCase()}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                ¿Estás seguro de que quieres registrar tu <strong>{fichajeTipo.toLowerCase()}</strong>?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 font-medium">
                  Hora: {madridTimeStr || new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {currentAddress || 'Obteniendo ubicación...'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFichajeConfirmModal(false);
                  setFichajeTipo('');
                  setFichajeCustomMotivo('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmFichaje}
                disabled={fichando}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 font-medium flex items-center gap-2"
              >
                <span>✅</span>
                Confirmar {fichajeTipo}
              </button>
            </div>
            {fichajeCustomMotivo && (
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-3">
                Motivo seleccionado: <strong>{fichajeCustomMotivo}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// Componenta pentru registrele angajaților (pentru manageri)
function RegistrosEmpleadosScreen({ setDeleteConfirmDialog, setNotification, onDeleteRegistroRef }) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { loading: apiLoading, callApi } = useApi();
  const locationContext = useLocation();
  
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [registros, setRegistros] = useState([]);
  const [registrosBrutos, setRegistrosBrutos] = useState([]);
  
  // State pentru selectorul de lună
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // State pentru loading când se schimbă luna
  const [changingMonth, setChangingMonth] = useState(false);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  
  // State pentru selecția perioadei
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [isPeriodMode, setIsPeriodMode] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ empleado: '', tipo: 'Entrada', hora: '', address: '', data: '' });
  const [filterModal, setFilterModal] = useState(null);
  const [filter, setFilter] = useState({ empleado: '', luna: '', an: '', de: '', pana: '' });
  const [filtered, setFiltered] = useState([]);

  // Funcție pentru ștergerea unui registro
  const handleDeleteRegistro = useCallback(async (idx) => {
    if (idx < 0 || idx >= registros.length) {
      throw new Error('Invalid registro index');
    }

    const registro = registros[idx];
    if (!registro || !registro.id) {
      throw new Error('Registro not found or missing ID');
    }

    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(routes.deleteFichaje, {
      method: 'DELETE',
      headers: headers,
      body: JSON.stringify({ id: registro.id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Elimină registro-ul din listă
      const updatedRegistros = registros.filter((_, i) => i !== idx);
      setRegistros(updatedRegistros);
      setFiltered(updatedRegistros);
      
      setNotification({
        type: 'success',
        title: 'Registro Eliminado',
        message: result.message || 'El registro se ha eliminado correctamente'
      });
    } else {
      throw new Error(result.message || 'Error al eliminar registro');
    }
  }, [registros, setRegistros, setFiltered, setNotification]);

  // Actualizează ref-ul când funcția se schimbă
  useEffect(() => {
    if (onDeleteRegistroRef) {
      onDeleteRegistroRef.current = handleDeleteRegistro;
    }
  }, [handleDeleteRegistro, onDeleteRegistroRef]);

  const [showEmpleados, setShowEmpleados] = useState(false);
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState('');
  const [showEmpleadosDropdown, setShowEmpleadosDropdown] = useState(false);
  const [searchEmpleadoDropdown, setSearchEmpleadoDropdown] = useState('');
  // Închide popover-urile când se face click în afara lor
  useEffect(() => {
    const handleClickOutside = (event) => {
      const popovers = document.querySelectorAll('[id^="popover-"]');
      popovers.forEach(popover => {
        if (!popover.contains(event.target) && !event.target.closest('button[title="Click para ver detalles de ubicación"]')) {
          popover.classList.add('hidden');
        }
      });
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Închide dropdown-ul de angajați când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmpleadosDropdown && !event.target.closest('.relative')) {
        setShowEmpleadosDropdown(false);
        setSearchEmpleadoDropdown('');
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showEmpleadosDropdown]);

        // Re-mapează registrele când se schimbă lista de angajați sau registrele brute
      useEffect(() => {
        if (empleados.length > 0 && registrosBrutos.length > 0) {
          
          
          // Re-mapează registrele brute cu noile angajați
          const mapped = registrosBrutos.map((item) => {
            // Caută numele după email în lista de angajați
            let nombreEmpleado = 'Sin nombre';
            
            // Extrage email-ul din registros (toate formatele posibile)
            const emailRegistro = item['CORREO ELECTRONIC'] || item.EMAIL || item.email || item['CORREO ELECTRONICO'];
            
            // Debug: afișează ce email se găsește (comentat pentru a reduce logurile)
            // console.log('🔍 Mapping registro:', {
            //   item: item,
            //   emailRegistro: emailRegistro,
            //   empleadosCount: empleados.length
            // });
            
            if (emailRegistro) {
              // Caută în empleados după email (toate formatele posibile)
              const empleadoEncontrado = empleados.find(emp => {
                const emailEmpleado = emp.email || emp['CORREO ELECTRONIC'] || emp['CORREO ELECTRONICO'] || emp.EMAIL;
                const match = emailEmpleado && emailEmpleado.toLowerCase() === emailRegistro.toLowerCase();
                
                // Debug: afișează comparația (comentat pentru a reduce logurile)
                // if (emailEmpleado) {
                //   console.log('🔍 Comparing emails:', {
                //     emailEmpleado: emailEmpleado.toLowerCase(),
                //     emailRegistro: emailRegistro.toLowerCase(),
                //     match: match
                //   });
                // }
                
                return match;
              });
              
              if (empleadoEncontrado) {
                nombreEmpleado = empleadoEncontrado.nombre || empleadoEncontrado['NOMBRE / APELLIDOS'] || 'Sin nombre';
                // console.log('✅ Empleado encontrado por email:', nombreEmpleado);
              } else {
                // Fallback: caută după CODIGO dacă email-ul nu se găsește
                const codigoRegistro = item.CODIGO || item.codigo;
                if (codigoRegistro) {
                  const empleadoPorCodigo = empleados.find(emp => 
                    emp.codigo && emp.codigo.toString() === codigoRegistro.toString()
                  );
                  
                  if (empleadoPorCodigo) {
                    nombreEmpleado = empleadoPorCodigo.nombre || empleadoPorCodigo['NOMBRE / APELLIDOS'] || 'Sin nombre';
                    // console.log('✅ Empleado encontrado por código:', nombreEmpleado);
                  } else {
                    // console.log('❌ No se encontró empleado ni por email ni por código:', {
                    //   email: emailRegistro,
                    //   codigo: codigoRegistro
                    // });
                  }
                } else {
                  // console.log('❌ No se encontró empleado para email y no hay código:', emailRegistro);
                }
              }
            } else {
              // Fallback: caută după CODIGO dacă nu există email
              const codigoRegistro = item.CODIGO || item.codigo;
              if (codigoRegistro) {
                const empleadoPorCodigo = empleados.find(emp => 
                  emp.codigo && emp.codigo.toString() === codigoRegistro.toString()
                );
                
                if (empleadoPorCodigo) {
                  nombreEmpleado = empleadoPorCodigo.nombre || empleadoPorCodigo['NOMBRE / APELLIDOS'] || 'Sin nombre';
                  console.log('✅ Empleado encontrado por código (sin email):', nombreEmpleado);
                } else {
                  console.log('❌ No se encontró empleado por código:', codigoRegistro);
                }
              } else {
                console.log('❌ No email ni código found in registro:', item);
              }
            }
        
        return {
          id: item.ID || item.id || item._id, // Păstrează ID-ul original din backend
          empleado: nombreEmpleado,
          tipo: item.TIPO || item.tipo || '',
          hora: item.HORA || item.hora || '',
          address: item.DIRECCION || item.address || '',
          modificatDe: item.MODIFICADO_POR || item.modificatDe || '',
          data: item.FECHA || item.data || '',
          codigo: item.CODIGO || item.codigo || '',
          duration: item.DURACION || item.duration || '',
          email: item['CORREO ELECTRONIC'] || item.EMAIL || item.email || item['CORREO ELECTRONICO'] || '' // Păstrează email-ul
        };
      });
      
      // Sortare corectă: combină data și ora pentru o sortare cronologică precisă (mai noi primele)
      const sortedMapped = [...mapped].sort((a, b) => {
        const dataA = a.data || a.fecha || '';
        const dataB = b.data || b.fecha || '';
        const horaA = padTime(a.hora || '');
        const horaB = padTime(b.hora || '');

        if (!dataA || !dataB || !horaA || !horaB) return 0;

        const dateTimeA = new Date(`${dataA}T${horaA}`);
        const dateTimeB = new Date(`${dataB}T${horaB}`);
        return dateTimeB - dateTimeA; // Cele mai noi primele (descending)
      });
      
      setRegistros(sortedMapped);
      setFiltered(sortedMapped);
    }
  }, [empleados, registrosBrutos]);

  const fetchEmpleados = useCallback(async () => {
    setLoadingEmpleados(true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchEmpleados in Fichaje');
      setLoadingEmpleados(false);
      return;
    }
    
    try {
      // Folosește endpoint-ul existent pentru lista completă de angajați
      const result = await callApi(API_ENDPOINTS.USERS);
      
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        
        // Debug: afișează structura datelor primite
        console.log('🔍 Empleados completos raw data:', data);
        
        // Mapează direct angajații din endpoint-ul existent
        const mappedEmpleados = data.map(empleado => ({
          nombre: empleado['NOMBRE / APELLIDOS'] || empleado.nombre || empleado.NOMBRE || 'Sin nombre',
          email: empleado['CORREO ELECTRONIC'] || empleado.EMAIL || empleado.email || empleado['CORREO ELECTRONICO'] || '',
          codigo: empleado.CODIGO || empleado.codigo || '',
          grupo: empleado.GRUPO || empleado.grupo || ''
        }));
        
        // Debug: afișează angajații mappați
        console.log('🔍 Empleados completos mapeados:', mappedEmpleados);
        
        setEmpleados(mappedEmpleados);
      } else {
        console.error('Error fetching empleados:', result.error);
        // Afișează eroarea specifică pentru CORS în producție
        if (result.error && result.error.includes('CORS')) {
          console.error('❌ CORS Error: Lista de angajați nu poate fi încărcată în producție. Verifică configurația CORS în n8n.');
        }
      }
    } catch (error) {
      console.error('Error fetching empleados:', error);
      // Verifică dacă este o eroare de CORS
      if (error.message && (error.message.includes('CORS') || error.message.includes('blocked'))) {
        console.error('❌ CORS Error: Lista de angajați nu poate fi încărcată în producție. Verifică configurația CORS în n8n.');
      }
    }
    setLoadingEmpleados(false);
  }, [authUser, callApi]);



  const fetchRegistros = useCallback(async (month = selectedMonth) => {
    setLoadingRegistros(true);
    setChangingMonth(month !== selectedMonth);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchRegistros');
      setLoadingRegistros(false);
      return;
    }
    
    try {
      // Para manager/supervisor - retorna todos los registros con filtro de mes
      console.log('🔍 Fetching registros for month:', month);
      
      // Verifică dacă month este string înainte de a face split
      let monthNumber, year;
      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        monthNumber = parts[1]; // 08 din 2025-08
        year = parts[0]; // 2025 din 2025-08
      } else {
        // Dacă month nu este în formatul așteptat, folosește luna curentă
        const currentDate = new Date();
        monthNumber = String(currentDate.getMonth() + 1).padStart(2, '0');
        year = currentDate.getFullYear().toString();
        month = `${year}-${monthNumber}`;
        console.log('⚠️ Month parameter invalid, using current month:', month);
      }
      
      console.log('🔍 Month number:', monthNumber, 'Year:', year);
      console.log('🔍 Month parameter:', month);
      
      // Folosim REGISTROS_EMPLEADOS pentru a obține toate registrele pentru luna selectată
      // Trimitem doar luna în format YYYY-MM
      const url = `${API_ENDPOINTS.REGISTROS_EMPLEADOS}?mes=${encodeURIComponent(month)}`;
      console.log('✅ [Fichaje] Folosind backend-ul nou (getRegistrosEmpleados):', url);
      
      const token = localStorage.getItem('auth_token');
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const result = await callApi(url, { headers });
      
      if (result.success) {
        // Verifică dacă răspunsul este "not-modified" - nu șterge datele existente
        if (result.data && typeof result.data === 'object' && result.data.status === 'not-modified') {
          console.log('✅ Registros not-modified - păstrăm datele existente');
          // Nu facem nimic, păstrăm datele existente
          return;
        }
        
        const data = Array.isArray(result.data) ? result.data : [result.data];
        
        // Debug: afișează structura datelor primite
        console.log('🔍 Registros raw data:', data);
        console.log('🔍 Primer registro sample:', data[0]);
        console.log('🔍 Total registros received:', data.length);
        
        // Filtrare pentru elemente goale și pentru răspunsuri "not-modified"
        const validData = data.filter(item => {
          if (!item || typeof item !== 'object') return false;
          // Ignoră răspunsurile "not-modified"
          if (item.status === 'not-modified') return false;
          // Verifică dacă are cel puțin un câmp valid (excluzând status)
          const hasValidField = Object.keys(item).some(key => 
            key !== 'status' && item[key] !== null && item[key] !== undefined && item[key] !== ''
          );
          return hasValidField;
        });
        
        // Dacă nu există date valide după filtrare, păstrăm datele existente
        if (validData.length === 0) {
          console.log('✅ No valid registros after filtering - păstrăm datele existente');
          return;
        }
        
        console.log('🔍 Valid registros after filtering:', validData.length);
        
        // Mapeo a la estructura UI
        const mapped = validData.map(item => {
          // Debug: verifica ce câmpuri există în item (comentat pentru a reduce logurile)
          // console.log('🔍 Mapping item:', item);
          
          return {
            id: item.ID || item.id || item._id || null,
            // Prioriză NOMBRE / APELLIDOS care vine direct din backend
            empleado: item['NOMBRE / APELLIDOS'] || item['NOMBRE'] || item.NOMBRE || item.empleado || item.nombre || 'Sin nombre',
            tipo: item.TIPO || item.tipo,
            hora: item.HORA || item.hora,
            address: item.DIRECCION || item.address,
            modificatDe: item.MODIFICADO_POR || item.modificatDe,
            codigo: item.CODIGO || item.codigo,
            duration: item.DURACION || item.duration,
            data: item.FECHA || item.data,
            email: item['CORREO ELECTRONIC'] || item.EMAIL || item.email || item['CORREO ELECTRONICO'] || ''
          };
        });

        // Filtrare pe lună (dacă API-ul nu filtrează corect)
        const filteredData = mapped.filter(registro => {
          if (!registro.data) return false;
          const registroMonth = registro.data.substring(0, 7); // YYYY-MM
          // console.log('🔍 Registro date:', registro.data, 'Month:', registroMonth, 'Expected:', month);
          return registroMonth === month;
        });

        console.log('🔍 Filtered registros for month', month, ':', filteredData.length);

        // Ordenación correcta: combina fecha y hora para una ordenación cronológica precisa (más reciente primero)
        const sortedRegistros = [...filteredData].sort((a, b) => {
          const dataA = a.data || a.fecha || '';
          const dataB = b.data || b.fecha || '';
          const horaA = padTime(a.hora || '');
          const horaB = padTime(b.hora || '');

          if (!dataA || !dataB || !horaA || !horaB) return 0;

          const dateTimeA = new Date(`${dataA}T${horaA}`);
          const dateTimeB = new Date(`${dataB}T${horaB}`);
          return dateTimeB - dateTimeA; // Más reciente primero (descending)
        });

        console.log('🔍 Sorted registros for month', month, ':', sortedRegistros.length);
        
        // Registros fetched successfully
        
        // IMPORTANT: Actualizează datele doar dacă avem date valide
        // Nu ștergem datele existente dacă nu găsim date pentru luna selectată
        // (poate fi o problemă temporară sau o lună fără registros)
        if (sortedRegistros.length > 0) {
          // Salvează datele mapate și sortate
          setRegistrosBrutos(sortedRegistros);
        } else {
          console.log('⚠️ No registros found for month', month, '- păstrăm datele existente (nu ștergem)');
          // Nu ștergem datele existente - poate fi o problemă temporară sau o lună fără registros
        }
      } else {
        console.error('[DEBUG] fetchRegistros failed:', result.error);
        // Reset și la eroare
        setRegistrosBrutos([]);
        setRegistros([]);
        setFiltered([]);
      }
    } catch (error) {
      console.error('Error fetching registros:', error);
      // Reset și la catch
      setRegistrosBrutos([]);
      setRegistros([]);
      setFiltered([]);
    }
    setLoadingRegistros(false);
    setChangingMonth(false);
  }, [authUser, callApi, selectedMonth]);

  // Încarcă angajații și registrele la montarea componentei
  useEffect(() => {
    if (!authUser) {
      return;
    }

    const loadData = async () => {
      await fetchEmpleados();
      await fetchRegistros(selectedMonth);
    };

    loadData();
  }, [authUser, fetchEmpleados, fetchRegistros, selectedMonth]);

  // Filtrare locală după criterii
  const applyFilter = (f, isEmp) => {
    let lista = registros;
    if (isEmp && f.empleado) lista = lista.filter(r => r.empleado === f.empleado);
    if (f.luna) lista = lista.filter(r => (r.data || '').split('-')[1] === f.luna.padStart(2, '0'));
    if (f.an) lista = lista.filter(r => (r.data || '').split('-')[0] === f.an);
    if (f.de && f.pana) {
      lista = lista.filter(r => r.data >= f.de && r.data <= f.pana);
    }
    setFiltered(lista);
    setFilterModal(null);
  };

  // Funcții pentru selecția perioadei
  const handlePeriodSearch = async () => {
    if (!periodStart || !periodEnd) {
      setNotification({
        type: 'warning',
        title: 'Período Incompleto',
        message: 'Por favor, selecciona fecha de inicio y fecha de fin.'
      });
      return;
    }

    if (periodStart > periodEnd) {
      setNotification({
        type: 'warning',
        title: 'Período Inválido',
        message: 'La fecha de inicio debe ser anterior a la fecha de fin.'
      });
      return;
    }

    setChangingMonth(true);
    setIsPeriodMode(true);
    
    try {
      // Construiește URL-ul cu parametrii (backend nou)
      let url = `${API_ENDPOINTS.REGISTROS_PERIODO}?fecha_inicio=${encodeURIComponent(periodStart)}&fecha_fin=${encodeURIComponent(periodEnd)}`;
      
      // Dacă este selectat un angajat, adaugă codigo
      if (selectedEmpleado) {
        const empleadoSeleccionado = empleados.find(emp => emp.nombre === selectedEmpleado);
        if (empleadoSeleccionado) {
          const codigo = empleadoSeleccionado.codigo || empleadoSeleccionado.CODIGO || '';
          if (codigo) {
            url += `&codigo=${encodeURIComponent(codigo)}`;
          }
        }
      }
      
      console.log('✅ [Fichaje] Folosind backend-ul nou (getRegistrosPeriodo):', url);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
          'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔍 Response from period endpoint:', result);
      console.log('🔍 Response type:', typeof result);
      console.log('🔍 Response is array:', Array.isArray(result));
      
      // Verifică dacă răspunsul conține datele așteptate
      let periodData = [];
      if (result && Array.isArray(result)) {
        periodData = result;
        console.log('✅ Using result directly as array, length:', periodData.length);
      } else if (result && result.data && Array.isArray(result.data)) {
        periodData = result.data;
        console.log('✅ Using result.data as array, length:', periodData.length);
      } else if (result && result.registros && Array.isArray(result.registros)) {
        periodData = result.registros;
        console.log('✅ Using result.registros as array, length:', periodData.length);
      } else {
        console.warn('❌ Unexpected response format:', result);
        console.log('❌ Available keys:', result ? Object.keys(result) : 'result is null/undefined');
        periodData = [];
      }
      
      // Mapează datele la formatul așteptat (folosind câmpurile din backend)
      const mappedData = periodData.map(item => ({
        id: item.ID || item.id || item._id || null, // Păstrează ID-ul original din backend
        empleado: item['NOMBRE / APELLIDOS'] || item.nombre || item.empleado || item.employee || '',
        data: item.FECHA || item.DATA || item.data || item.fecha || item.date || '',
        tipo: item.TIPO || item.tipo || item.type || '',
        hora: item.HORA || item.hora || item.time || '',
        duration: item.DURACION || item.duration || item.duracion || '',
        address: item.DIRECCION || item.address || item.direccion || item.location || '',
        modificatDe: item.MODIFICADO_POR || item.modificatDe || item.modified_by || item.manager || '',
        codigo: item.CODIGO || item.codigo || '',
        email: item['CORREO ELECTRONIC'] || item.EMAIL || item.email || item['CORREO ELECTRONICO'] || '',
        loc: item.LOC || item.loc || item.location_coords || null
      }));
      
      // Sortare corectă: combină data și ora pentru o sortare cronologică precisă (mai noi primele)
      const sortedMappedData = [...mappedData].sort((a, b) => {
        const dataA = a.data || '';
        const dataB = b.data || '';
        const horaA = padTime(a.hora || '');
        const horaB = padTime(b.hora || '');

        if (!dataA || !dataB || !horaA || !horaB) return 0;

        const dateTimeA = new Date(`${dataA}T${horaA}`);
        const dateTimeB = new Date(`${dataB}T${horaB}`);
        return dateTimeB - dateTimeA; // Cele mai noi primele (descending)
      });
      
      console.log('🔄 Mapped data:', sortedMappedData);
      console.log('🔄 Mapped data length:', sortedMappedData.length);
      console.log('🔄 First mapped item:', sortedMappedData[0]);
      console.log('🔄 ID check - First item has ID:', !!sortedMappedData[0]?.id, 'ID value:', sortedMappedData[0]?.id);
      
      setRegistros(sortedMappedData);
      setFiltered(sortedMappedData);
      setShowPeriodSelector(false);
      
      setNotification({
        type: 'success',
        title: 'Período Aplicado',
        message: `Mostrando ${mappedData.length} registros del ${periodStart} al ${periodEnd}`
      });
    } catch (error) {
      console.error('Error fetching period data:', error);
      setNotification({
        type: 'error',
        title: 'Error de Conexión',
        message: 'Error al obtener registros del período seleccionado.'
      });
    } finally {
      setChangingMonth(false);
    }
  };

  const handleResetPeriod = () => {
    setIsPeriodMode(false);
    setPeriodStart('');
    setPeriodEnd('');
    setShowPeriodSelector(false);
    
    // Reîncarcă registrele pentru luna selectată
    fetchRegistros(selectedMonth);
  };

  // Reîncarcă datele la montare și când se schimbă luna/utilizatorul
  // Notă: acest ecran poate fi folosit fără state-ul `activeTab` din altă componentă
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      try {
        await fetchRegistros(selectedMonth);
      } catch (error) {
        console.warn('[Fichaje] No se pudieron recargar los registros actuales:', error);
      }
    })();
  }, [authUser, fetchRegistros, selectedMonth]);

  // Debug: afișează form-ul când se deschide modalul
  useEffect(() => {
    if (modalVisible) {
      console.log('🔍 Modal opened, form content:', form);
      console.log('🔍 editIdx:', editIdx);
    }
  }, [editIdx, form, modalVisible]);

  // Export PDF
  const handleExportPDF = async () => {
    if (!filtered || filtered.length === 0) return;
    
    try {
      // Încarcă pdfMake dinamic
      const ensurePdfMake = () => new Promise((resolve, reject) => {
        if (window.pdfMake) return resolve(window.pdfMake);
        const s1 = document.createElement('script');
        s1.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/pdfmake.min.js';
        s1.onload = () => {
          const s2 = document.createElement('script');
          s2.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/vfs_fonts.js';
          s2.onload = () => resolve(window.pdfMake);
          s2.onerror = () => reject(new Error('Nu s-au putut încărca fonturile pdfMake'));
          document.head.appendChild(s2);
        };
        s1.onerror = () => reject(new Error('Nu s-a putut încărca pdfMake'));
        document.head.appendChild(s1);
      });

      await ensurePdfMake();

      const formatSelectedMonth = (monthStr) => {
        if (!monthStr) return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        const [year, month] = monthStr.split('-');
        const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const monthIndex = parseInt(month) - 1;
        const monthName = monthNames[monthIndex] || 'enero';
        return `${monthName} de ${year}`;
      };

      // Filtrează datele în funcție de angajatul selectat
      const dataToExport = selectedEmpleado 
        ? filtered.filter(item => item.empleado === selectedEmpleado)
        : filtered;

      const tableBody = [
        ['Empleado', 'Tipo', 'Hora', 'Dirección', 'Modificado Por', 'Fecha', 'Duración'],
        ...dataToExport.map(item => [
          item.empleado || '',
          item.tipo || '',
          item.hora || '',
          item.address || '',
          item.modificatDe || '',
          item.data || '',
          item.duration || ''
        ])
      ];

      const docDefinition = {
        pageOrientation: 'landscape',
        content: [
          // Header companie cu tabel pentru a forța afișarea
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'DE CAMINO SERVICIOS AUXILIARES SL', style: 'companyName' }],
                [{ text: 'NIF: B85524536', style: 'companyDetails' }],
                [{ text: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España', style: 'companyDetails' }],
                [{ text: 'Teléfono: +34 91 123 45 67', style: 'companyDetails' }],
                [{ text: 'Email: info@decaminoservicios.com', style: 'companyDetails' }]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 10]
          },
          
          // Datele angajatului selectat (dacă există)
          ...(selectedEmpleado ? [
            { text: 'DATOS DEL EMPLEADO', style: 'employeeHeader' },
            { text: `Nombre: ${selectedEmpleado}`, style: 'employeeDetails' },
            { text: '', margin: [0, 0, 0, 5] }, // Spațiu gol
          ] : []),
          
          // Titlu raport
          { text: selectedEmpleado ? `REGISTRO DE FICHAJES - ${selectedEmpleado}` : 'REGISTRO DE FICHAJES', style: 'reportTitle' },
          { text: `Período: ${formatSelectedMonth(selectedMonth)}`, style: 'period', margin: [0, 0, 0, 10] },
          
          // Tabel cu date
          {
            table: { 
              headerRows: 1, 
              widths: ['*', 70, 60, 220, 110, 70, 80], 
              body: tableBody 
            },
            layout: 'lightHorizontalLines'
          }
        ],
        styles: {
          companyName: { 
            fontSize: 18, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: '#CC0000', 
            alignment: 'center', 
            margin: [0, 0, 0, 8],
            background: '#CC0000'
          },
          companyDetails: { 
            fontSize: 10, 
            bold: true, 
            color: '#333333', 
            fillColor: '#F0F0F0', 
            alignment: 'center',
            margin: [0, 0, 0, 2]
          },
          reportTitle: { 
            fontSize: 12, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: '#0066CC', 
            alignment: 'center',
            margin: [0, 4, 0, 2]
          },
          period: { 
            fontSize: 10, 
            color: '#333333', 
            alignment: 'center'
          },
          employeeHeader: { 
            fontSize: 12, 
            bold: true, 
            color: '#FFFFFF', 
            fillColor: '#0066CC', 
            alignment: 'center',
            margin: [0, 0, 0, 4]
          },
          employeeDetails: { 
            fontSize: 10, 
            bold: true, 
            color: '#333333', 
            fillColor: '#E6F3FF', 
            alignment: 'center',
            margin: [0, 0, 0, 2]
          }
        }
      };

      const safeEmpleado = selectedEmpleado ? selectedEmpleado.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
      const filename = selectedEmpleado ? `registros_${safeEmpleado}.pdf` : `registros_empleados.pdf`;

      window.pdfMake.createPdf(docDefinition).download(filename);

      await activityLogger.logDataExport('fichajes_pdf', { count: dataToExport.length, empleado: selectedEmpleado || undefined }, authUser);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setNotification({
        type: 'error',
        title: 'Error de Exportación',
        message: 'Error al exportar PDF. Inténtalo de nuevo.'
      });
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (!filtered || filtered.length === 0) return;
    
    try {
      // Import funcția de export Excel
      const { exportToExcelWithHeader } = await import('../utils/exportExcel');
      
      // Filtrează datele în funcție de angajatul selectat
      const dataToExport = selectedEmpleado 
        ? filtered.filter(item => item.empleado === selectedEmpleado)
        : filtered;
      
      // Definește coloanele pentru Excel
      const columns = [
        { key: 'empleado', label: 'Empleado', width: 20 },
        { key: 'tipo', label: 'Tipo', width: 12 },
        { key: 'hora', label: 'Hora', width: 10 },
        { key: 'address', label: 'Dirección', width: 30 },
        { key: 'modificatDe', label: 'Modificado Por', width: 20 },
        { key: 'data', label: 'Fecha', width: 12 },
        { key: 'duration', label: 'Duración', width: 15 }
      ];
      
      // Formatează luna selectată pentru afișare
      const formatSelectedMonth = (monthStr) => {
        if (!monthStr) return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        
        const [year, month] = monthStr.split('-');
        const monthNames = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        const monthIndex = parseInt(month) - 1;
        const monthName = monthNames[monthIndex] || 'enero';
        
        return `${monthName} de ${year}`;
      };
      
      // Construiește numele fișierului în funcție de angajatul selectat
      const safeEmpleado = selectedEmpleado
        ? selectedEmpleado.replace(/[^a-zA-Z0-9_-]/g, '_')
        : '';
      const excelFilename = selectedEmpleado
        ? `registros_${safeEmpleado}`
        : 'registros_empleados';

      // Titlul raportului cu numele angajatului dacă este selectat
      const reportTitle = selectedEmpleado 
        ? `REGISTRO DE FICHAJES - ${selectedEmpleado}`
        : 'REGISTRO DE FICHAJES';

      // Export la Excel cu header-ul companiei și luna selectată
      await exportToExcelWithHeader(
        dataToExport,
        columns,
        reportTitle,
        excelFilename,
        {},
        formatSelectedMonth(selectedMonth)
      );
    
    // Log exportar Excel
    await activityLogger.logDataExport('fichajes_excel', { count: dataToExport.length, empleado: selectedEmpleado || undefined }, authUser);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setNotification({
        type: 'error',
        title: 'Error de Exportación',
        message: 'Error al exportar a Excel. Por favor, inténtalo de nuevo.'
      });
    }
  };
  const openAdd = async () => {
    // Deschide modalul imediat cu datele de bază
    setForm({ 
      empleado: empleados[0]?.nombre || '', 
      tipo: 'Entrada', 
      hora: '', 
      address: 'Obteniendo ubicación...', 
      data: new Date().toISOString().slice(0, 10) 
    });
    setEditIdx(null);
    setModalVisible(true);
    
    // Obține locația curentă în background (non-blocking) folosind contextul global
    let currentAddress = null;
    
    try {
        console.log('🔍 Intentando obtener ubicación...');
      const coords = await locationContext.getCurrentLocation();
      console.log('✅ Ubicación obtenida:', coords);
        
      // Obține adresa prin reverse geocoding folosind funcția din context
        try {
          console.log('🔍 Obteniendo dirección...');
        currentAddress = await locationContext.getAddressFromCoords(coords.latitude, coords.longitude);
        if (currentAddress) {
            console.log('✅ Dirección obtenida:', currentAddress);
            // Actualizează form-ul cu noua adresă
            setForm(prev => ({ 
              ...prev, 
              address: currentAddress 
            }));
          } else {
            throw new Error('No se encontró dirección en la respuesta');
          }
        } catch (error) {
          console.log('⚠️ No se pudo obtener la dirección, usando coordenadas');
        currentAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
          setForm(prev => ({ 
            ...prev, 
            address: currentAddress 
          }));
      }
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
      
      // Mesaje specifice pentru diferite tipuri de erori
      let errorMessage = 'Ubicación no disponible';
      
      if (error.code === 1) {
        errorMessage = 'Acceso a ubicación denegado. Permite el acceso en configuración del navegador.';
      } else if (error.code === 2) {
        errorMessage = 'Ubicación no pudo ser determinada. Verifica tu conexión GPS.';
      } else if (error.code === 3) {
        errorMessage = 'Tiempo de espera agotado. Intenta de nuevo.';
      } else if (error.message.includes('Geolocalización no soportada')) {
        errorMessage = 'Geolocalización no soportada por este navegador.';
      }
      
      setForm(prev => ({ 
        ...prev, 
        address: errorMessage
      }));
    }
  };
    
  const openEdit = async (idx) => {
    // Debug: afișează datele registrului
    console.log('🔍 openEdit called with idx:', idx);
    
    // IMPORTANT: Folosește 'filtered' în loc de 'registros' pentru a obține datele corecte din lista afișată
    const displayedRegistros = selectedEmpleado 
      ? filtered.filter(item => item.empleado === selectedEmpleado)
      : filtered;
    
    console.log('🔍 displayedRegistros[idx]:', displayedRegistros[idx]);
    console.log('🔍 selectedEmpleado:', selectedEmpleado);
    console.log('🔍 form.empleado before set:', displayedRegistros[idx]?.empleado);
    
    // Deschide modalul imediat cu datele existente
    const registroData = displayedRegistros[idx];
    
    // Debug: verifică dacă există angajat în form
    if (!registroData) {
      console.error('❌ No data found at index:', idx);
      return;
    }
    
    console.log('🔍 Setting form with:', {
      empleado: registroData.empleado,
      tipo: registroData.tipo,
      hora: registroData.hora,
      data: registroData.data
    });
    
    setForm({ 
      ...registroData
    });
    
    // IMPORTANT: Găsește index-ul real în lista completă de registros
    const realIdx = registros.findIndex(r => r.id === registroData.id);
    setEditIdx(realIdx >= 0 ? realIdx : idx);
    
    setModalVisible(true);

    // Obține locația curentă în background (non-blocking) folosind contextul global
    let currentAddress = null;
    
    try {
      const coords = await locationContext.getCurrentLocation();
        
      // Obține adresa prin reverse geocoding folosind funcția din context
        try {
        currentAddress = await locationContext.getAddressFromCoords(coords.latitude, coords.longitude);
        if (currentAddress) {
            // Actualizează form-ul cu noua adresă
            setForm(prev => ({ 
              ...prev, 
              address: currentAddress 
            }));
          }
        } catch (error) {
          console.log('No se pudo obtener la dirección, usando coordenadas');
        currentAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
          setForm(prev => ({ 
            ...prev, 
            address: currentAddress 
          }));
      }
    } catch (error) {
      console.error('❌ Error obteniendo ubicación para edición:', error);
      
      // Mesaje specifice pentru diferite tipuri de erori
      let errorMessage = 'Ubicación no disponible';
      
      if (error.code === 1) {
        errorMessage = 'Acceso a ubicación denegado. Permite el acceso en configuración del navegador.';
      } else if (error.code === 2) {
        errorMessage = 'Ubicación no pudo ser determinada. Verifica tu conexión GPS.';
      } else if (error.code === 3) {
        errorMessage = 'Tiempo de espera agotado. Intenta de nuevo.';
      } else if (error.message && error.message.includes('Geolocalización no soportada')) {
        errorMessage = 'Geolocalización no soportada por este navegador.';
      }
      
      setForm(prev => ({ 
        ...prev, 
        address: errorMessage
      }));
    }
  };

  const handleSave = async () => {
    if (!form.empleado) {
      setNotification({
        type: 'warning',
        title: 'Selección Requerida',
        message: '¡Por favor, selecciona un empleado!'
      });
      return;
    }
    if (!form.tipo) {
      setNotification({
        type: 'warning',
        title: 'Tipo Requerido',
        message: '¡Por favor, selecciona el tipo de registro!'
      });
      return;
    }
    if (!form.hora) {
      setNotification({
        type: 'warning',
        title: 'Hora Requerida',
        message: '¡Por favor, ingresa la hora!'
      });
      return;
    }
    
    try {
      // Găsește angajatul selectat pentru a obține codigo și email
      const empleadoSeleccionado = empleados.find(emp => emp.nombre === form.empleado);
      if (!empleadoSeleccionado) {
        setNotification({
          type: 'error',
          title: 'Error de Empleado',
          message: '¡No se encontró el empleado seleccionado!'
        });
        return;
      }

      // Preia ID-ul corect pentru editare
      let registroId = null;
      if (editIdx !== null) {
        registroId = form.id || registros[editIdx]?.id || null;
        
        // Debug: verifică dacă ID-ul este inclus
        console.log('🔍 Edit mode - ID check:', {
          formId: form.id,
          registroId: registros[editIdx]?.id,
          finalId: registroId,
          hasId: !!registroId,
          registroOriginal: registros[editIdx]
        });
        
        // Dacă ID-ul lipsește complet, nu putem continua
        if (!registroId) {
          console.error('⚠️ CRITICAL: ID lipsește complet pentru registrul de editat!');
          setNotification({
            type: 'error',
            title: 'Error de Identificación',
            message: 'No se pudo identificar el registro. Por favor, recarga la página e intenta de nuevo.'
          });
          return;
        }
      }
      
      const newReg = { 
        ...form, 
        id: editIdx !== null ? registroId : generateUniqueId(), // ID unic doar pentru înregistrări noi, păstrează ID-ul existent la editare
        modificatDe: authUser?.name || authUser?.['NOMBRE / APELLIDOS'] || 'Manager',
        timestamp: new Date().toISOString(),
        // Adaugă codigo și email-ul angajatului selectat
        codigo: empleadoSeleccionado.codigo || '',
        email: empleadoSeleccionado.email || ''
      };
      
      // Pentru editare, adaugă email-ul dacă nu există
      if (editIdx !== null && !newReg.email) {
        const registroOriginal = registros[editIdx];
        newReg.email = registroOriginal.email || '';
      }
      
      // Pentru editare, dacă se schimbă tipul, calculează durata dacă e necesar
      if (editIdx !== null) {
        const registroOriginal = registros[editIdx];
        const tipoOriginal = registroOriginal.tipo;
        
        // Dacă era "Entrada" și acum e "Salida", calculează durata
        if (tipoOriginal === 'Entrada' && newReg.tipo === 'Salida') {
          // Duration is now calculated de baza de date
          newReg.duration = '';
        }
        
        // Dacă era "Salida" și acum e "Entrada", șterge durata
        if (tipoOriginal === 'Salida' && newReg.tipo === 'Entrada') {
          delete newReg.duration;
          console.log('⏱️ Eliminada duración (Salida → Entrada)');
        }
        
        // Duration is now calculated by database triggers - no need for frontend calculation
        
        // Duration is now calculated by database triggers - no need for frontend calculation
      }
      
      // Debug: afișează datele care se trimit
      console.log('📝 Saving registro:', {
        isEdit: editIdx !== null,
        endpoint: editIdx !== null ? 'UPDATE' : 'ADD',
        data: newReg,
        idIncluded: !!newReg.id,
        idValue: newReg.id,
        empleadoInfo: {
          nombre: empleadoSeleccionado.nombre,
          codigo: empleadoSeleccionado.codigo,
          email: empleadoSeleccionado.email
        }
      });

      // Folosește endpoint-ul specific pentru adăugarea/editarea de registre
      const endpoint = editIdx !== null ? API_ENDPOINTS.FICHAJE_UPDATE : API_ENDPOINTS.FICHAJE_ADD;
      const method = editIdx !== null ? 'PUT' : 'POST'; // PUT pentru update, POST pentru add
      
      console.log(`✅ [Fichaje] Folosind backend-ul nou (${editIdx !== null ? 'updateFichaje' : 'addFichaje'}):`, endpoint);
      console.log('📤 Sending request to:', endpoint, 'Method:', method);
      console.log('📤 Request body:', JSON.stringify(newReg, null, 2));
      console.log('📤 ID in request:', newReg.id);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const result = await callApi(endpoint, {
        method: method,
        headers: headers,
        body: JSON.stringify(newReg)
      });

      // Debug: verifică răspunsul
      console.log('📥 Response received:', result);
      console.log('📥 Response ID:', result?.data?.id || result?.id);

      if (result.success) {
        // Log crear/actualizar el registro
        if (editIdx !== null) {
          await activityLogger.logFichajeUpdated(newReg, authUser);
          
          // Debug: verifică dacă ID-ul din răspuns este diferit
          if (result?.data?.id && result.data.id !== '[Execute previous nodes for preview]') {
            console.log('✅ Update successful, ID from response:', result.data.id);
          } else {
            console.warn('⚠️ Response ID invalid, using original ID:', newReg.id);
          }
        } else {
          await activityLogger.logFichajeCreated(newReg, authUser);
        }
        
        // Reîncarcă registrele după salvare cu luna curentă
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        await fetchRegistros(currentMonth);
        setModalVisible(false);
        
        setNotification({
          type: 'success',
          title: editIdx !== null ? 'Registro Actualizado' : 'Registro Creado',
          message: editIdx !== null ? 'El registro ha sido actualizado correctamente.' : 'El registro ha sido creado correctamente.'
        });
      } else {
        setNotification({
          type: 'error',
          title: 'Error de Guardado',
          message: result.error || 'No se pudo guardar el registro. Por favor, intenta de nuevo.'
        });
      }
    } catch (error) {
      console.error('Error saving registro:', error);
              setNotification({
          type: 'error',
          title: t('error.saveError'),
          message: t('error.saveErrorSimple')
        });
    }
  };

  const handleDelete = async (idx) => {
    // Verificăm dacă registro-ul există
    if (idx < 0 || idx >= registros.length) {
      console.error('Invalid registro index:', idx);
      return;
    }
    
    setDeleteConfirmDialog({
      isOpen: true,
      registroIndex: idx
    });
  };
  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-xl">👥</span>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 w-12 h-12 bg-blue-400 rounded-xl opacity-20 blur-md animate-pulse"></div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Registros de Empleados
          </h1>
          <p className="text-sm text-gray-600">
            Administra y supervisa los marcajes del equipo
          </p>
        </div>
      </div>

      {/* Butoane de export și refresh - Modernos */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => {
            // Actualizează cu luna curentă, nu cu luna selectată
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            console.log('🔄 Actualizando con luna actual:', currentMonth);
            fetchRegistros(currentMonth);
            // Actualizează și selectorul de lună la luna curentă
            setSelectedMonth(currentMonth);
          }}
          className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className="text-lg group-hover:scale-110 transition-transform duration-300">🔄</span>
            <span>Actualizar</span>
          </div>
        </button>
        
        <button
          onClick={handleExportPDF}
          className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className="text-lg group-hover:scale-110 transition-transform duration-300">📄</span>
            <span>Exportar PDF</span>
          </div>
        </button>
        
        <button
          onClick={handleExportExcel}
          className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-emerald-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className="text-lg group-hover:scale-110 transition-transform duration-300">📊</span>
            <span>Exportar Excel</span>
          </div>
        </button>
      </div>

      {/* Buton adăugare - Moderno */}
      <button
        onClick={openAdd}
        className="group relative w-full px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
        <div className="relative flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30">
            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">➕</span>
          </div>
          <div className="text-left">
            <div className="text-lg font-bold">Añadir Registro</div>
            <div className="text-xs text-white/80">Crear nuevo fichaje</div>
          </div>
        </div>
      </button>

      {/* Buton pentru afișarea/ascunderea listei de angajați - Moderno */}
      <button
        onClick={() => setShowEmpleados(!showEmpleados)}
        className="group relative w-full px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-20 blur-md animate-pulse group-hover:opacity-30 transition-all duration-300"></div>
        <div className="relative flex items-center justify-center gap-2">
          <span className="text-lg group-hover:scale-110 transition-transform duration-300">
            {showEmpleados ? '🔼' : '🔽'}
          </span>
          <span>{showEmpleados ? 'Ocultar Lista de Empleados' : 'Mostrar Lista de Empleados'}</span>
        </div>
      </button>

      {/* Lista angajați - ascunsă/afișată */}
      {showEmpleados && (
        <Card>
          <h2 className="text-xl font-bold text-red-600 mb-4">Lista de empleados</h2>
          
          {selectedEmpleado ? (
            // Afișează doar angajatul selectat
            <div className="space-y-3">
              {empleados
                .filter(item => item.nombre === selectedEmpleado)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                    <div>
                      <p className="font-bold text-red-600">{item.nombre}</p>
                      <p className="text-gray-600">{item.email}</p>
                      {item.grupo && (
                        <p className="text-sm text-gray-500">Grupo: {item.grupo}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="text-red-600 text-lg">✓</div>
                      <button
                        onClick={() => setSelectedEmpleado('')}
                        className="text-red-600 hover:text-red-800 text-lg"
                        title="Deselectar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Afișează lista completă cu căutare
            <>
              {/* Căutare angajați */}
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="🔍 Buscar empleado por nombre..."
                  value={searchEmpleado}
                  onChange={(e) => setSearchEmpleado(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-3">
                {loadingEmpleados ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" text="Cargando empleados..." />
                  </div>
                ) : empleados.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      No hay empleados disponibles.
                    </div>
                    {import.meta.env.PROD && (
                      <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 text-sm text-yellow-800">
                        <div className="font-semibold mb-2">⚠️ Problema de CORS en Producción</div>
                        <div className="text-left space-y-1">
                          <div>• La lista de empleados no se puede cargar debido a restricciones CORS</div>
                          <div>• En desarrollo funciona porque usa el proxy de Vite</div>
                          <div>• En producción necesita configuración CORS en n8n</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  empleados
                    .filter(item => 
                      item.nombre.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
                      item.email.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
                      (item.grupo && item.grupo.toLowerCase().includes(searchEmpleado.toLowerCase()))
                    )
                    .map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                        onClick={() => setSelectedEmpleado(item.nombre)}
                      >
                        <div>
                          <p className="font-bold text-red-600">{item.nombre}</p>
                          <p className="text-gray-600">{item.email}</p>
                          {item.grupo && (
                            <p className="text-sm text-gray-500">Grupo: {item.grupo}</p>
                          )}
                        </div>
                      </div>
                    ))
                )}
                
                {/* Mesaj când nu sunt rezultate de căutare */}
                {searchEmpleado && empleados.filter(item => 
                  item.nombre.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
                  item.email.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
                  (item.grupo && item.grupo.toLowerCase().includes(searchEmpleado.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No se encontraron empleados con &quot;{searchEmpleado}&quot;
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Lista registre - Tabel format */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              changingMonth ? 'bg-yellow-100 animate-pulse' : 'bg-red-100'
            }`}>
              <span className={`text-lg transition-all duration-300 ${
                changingMonth ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {changingMonth ? '⏳' : '📊'}
              </span>
            </div>
            <div>
          <h2 className="text-xl font-bold text-red-600">
                {selectedEmpleado ? `Marcajes para: ${selectedEmpleado}` : `Registros de ${new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
                {!changingMonth && filtered.length > 0 && (
                  <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {selectedEmpleado 
                      ? (() => {
                          const empleadoRegistros = filtered.filter(item => item.empleado === selectedEmpleado);
                          return `${empleadoRegistros.length} ${empleadoRegistros.length === 1 ? 'registro' : 'registros'}`;
                        })()
                      : `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`
                    }
                  </span>
                )}
          </h2>
              <p className="text-sm text-gray-500">
                {changingMonth ? 'Cargando registros...' : 'Administra los marcajes de los empleados'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Selector ULTRA MODERN de lună - Glassmorphism + 3D - RESPONSIVE */}
            <div className="relative group flex-1">
              {/* Background blur effect */}
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl group-hover:shadow-red-200/50 transition-all duration-500"></div>
              
              {/* Main container */}
              <div className="relative">
                <select
                  id="fichaje-month-select"
                  name="fichaje-month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={changingMonth}
                  className={`appearance-none bg-transparent border-0 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 pr-12 sm:pr-16 text-sm sm:text-base font-bold text-gray-800 focus:outline-none transition-all duration-300 w-full ${
                    changingMonth ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  style={{
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                >
                  {/* Ultimele 12 luni */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                    const value = `${year}-${month}`;
                    return (
                      <option key={value} value={value} className="py-2">
                        {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                      </option>
                    );
                  })}
                </select>
                
                {/* Icon spectaculos pentru dropdown */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-6 pointer-events-none">
                  {changingMonth ? (
                    <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 sm:border-3 border-red-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                  ) : (
                    <div className="relative">
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-red-400/30 rounded-full blur-sm sm:blur-md animate-pulse"></div>
                      {/* Main icon */}
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-red-500 group-hover:text-red-600 transition-all duration-300 group-hover:scale-110 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Decorative elements - hidden on mobile */}
                <div className="hidden sm:block absolute top-2 left-2 w-2 h-2 bg-red-400/60 rounded-full animate-ping"></div>
                <div className="hidden sm:block absolute bottom-2 right-8 w-1 h-1 bg-red-300/80 rounded-full animate-pulse"></div>
              </div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
              </div>
            </div>

            {/* Buton pentru selecția perioadei */}
            <button
              onClick={() => setShowPeriodSelector(!showPeriodSelector)}
              disabled={changingMonth}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
                changingMonth ? 'opacity-50 cursor-not-allowed transform-none' : ''
              } ${isPeriodMode ? 'ring-2 ring-red-300' : ''}`}
              title={isPeriodMode ? 'Rango de fechas personalizado activo' : 'Seleccionar rango de fechas personalizado'}
            >
              <span className="text-lg">📅</span>
              {isPeriodMode ? 'Rango Activo' : 'Rango de fechas'}
            </button>

            {/* Buton pentru reset perioadă */}
            {isPeriodMode && (
              <button
                onClick={handleResetPeriod}
                disabled={changingMonth}
                className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
                  changingMonth ? 'opacity-50 cursor-not-allowed transform-none' : ''
                }`}
                title="Volver a vista por mes"
              >
                <span className="text-lg">↩️</span>
                Reset
              </button>
            )}
            
            {/* Buton ULTRA MODERN "Hoy" - 3D + Glassmorphism - RESPONSIVE */}
            <button
              onClick={() => {
                const currentDate = new Date();
                const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                setSelectedMonth(currentMonth);
              }}
              disabled={changingMonth}
              className={`group relative px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-2xl hover:shadow-red-300/50 w-full sm:w-auto ${
                changingMonth ? 'opacity-50 cursor-not-allowed transform-none' : ''
              }`}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              title="Volver al mes actual"
            >
              {/* 3D depth effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-red-300 to-red-800 opacity-20 transform translate-y-1 group-active:translate-y-0 transition-transform duration-150"></div>
              
              {/* Main content */}
              <div className="relative flex items-center justify-center gap-2 sm:gap-3">
                {/* Icon cu animație spectaculoasă */}
                <div className="relative">
                  <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-pulse"></div>
                  <span className="text-xl sm:text-2xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 relative z-10">🎯</span>
                </div>
                
                {/* Text cu efecte */}
                <span className="text-base sm:text-lg font-black tracking-wide" style={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.2)',
                  background: 'linear-gradient(45deg, #ffffff, #fef2f2, #ffffff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Hoy
                </span>
              </div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
              </div>
            </button>
            
            {/* Buton pentru a curăța filtrul de angajat */}
          {selectedEmpleado && (
            <Button
              onClick={() => setSelectedEmpleado('')}
              variant="secondary"
              size="sm"
            >
              ✕ Limpiar filtro
            </Button>
          )}
          </div>
        </div>
        
        {loadingRegistros ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" text="Cargando registros..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No se han registrado marcajes aún.
          </div>
        ) : (
          <>
            {/* Desktop: Tabel */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Empleado
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Fecha
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Tipo
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Hora
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Duración
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Dirección
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
                        Modificado por
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedEmpleado 
                      ? filtered.filter(item => item.empleado === selectedEmpleado)
                      : filtered
                    ).map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-medium text-blue-600">{item.empleado}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{item.data}</td>
                        <td className="py-3 px-4">
                          <span className={`font-bold px-2 py-1 rounded text-sm ${
                            item.tipo === 'Entrada' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{item.hora}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                        {item.duration && item.tipo === 'Salida' ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded text-sm whitespace-nowrap">
                            ⏱️ {item.duration}
                          </span>
                        ) : item.tipo === 'Salida' && !item.duration ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium bg-red-100 px-2 py-1 rounded text-sm whitespace-nowrap">
                            ⚠️ No duration
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 w-16 text-center relative">
                        {item.address ? (
                          <div className="relative">
                            <button
                              className="text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1"
                              title="Click para ver detalles de ubicación"
                              onClick={() => {
                                // Toggle popover visibility
                                const popoverId = `popover-${index}`;
                                const popover = document.getElementById(popoverId);
                                if (popover) {
                                  popover.classList.toggle('hidden');
                                }
                              }}
                            >
                              📍
                            </button>
                            
                            {/* Popover modern */}
                            <div
                              id={`popover-${index}`}
                              className="hidden absolute z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl p-4 mt-2 left-1/2 transform -translate-x-1/2"
                              style={{ top: '100%' }}
                            >
                              {/* Arrow pointer */}
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>
                              
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                <span className="text-2xl">📍</span>
                                <div>
                                  <h4 className="font-semibold text-gray-900">Ubicación completa</h4>
                                  <p className="text-sm text-gray-500">Detalles del marcaje</p>
                                </div>
                              </div>
                              
                              {/* Adresa principală */}
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 leading-relaxed">{item.address}</p>
                              </div>
                              
                              {/* Informații suplimentare */}
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="w-5">🕒</span>
                                  <span>Hora: {item.hora}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="w-5">📅</span>
                                  <span>Fecha: {item.data}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="w-5">👤</span>
                                  <span>Empleado: {item.empleado}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="w-5">🏷️</span>
                                  <span>Tipo: {item.tipo}</span>
                                </div>
                              </div>
                              
                              {/* Botones acciones */}
                              <div className="flex gap-2 pt-3 border-t border-gray-100">
                                <button
                                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                  onClick={() => {
                                    // Deschide Google Maps cu adresa
                                    const encodedAddress = encodeURIComponent(item.address);
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                                  }}
                                >
                                  🌍 Ver en Google Maps
                                </button>
                                <button
                                  className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                                  onClick={() => {
                                    // Închide popover-ul
                                    const popoverId = `popover-${index}`;
                                    const popover = document.getElementById(popoverId);
                                    if (popover) {
                                      popover.classList.add('hidden');
                                    }
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400" title="Sin ubicación">❌</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{item.modificatDe}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Editează"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Șterge"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            {/* Mobile: Carduri */}
            <div className="lg:hidden space-y-3">
              {(selectedEmpleado 
                ? filtered.filter(item => item.empleado === selectedEmpleado)
                : filtered
              ).map((item, index) => (
                <div key={index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
                  {/* Header compact */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ${
                        item.tipo === 'Entrada' 
                          ? 'bg-gradient-to-br from-green-500 to-green-600' 
                          : 'bg-gradient-to-br from-red-500 to-red-600'
                      }`}>
                        <span className="text-white text-lg">
                          {item.tipo === 'Entrada' ? '🚪' : '🚪'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">{item.empleado}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`font-bold px-2 py-1 rounded text-xs ${
                            item.tipo === 'Entrada' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.tipo}
                          </span>
                          <span className="text-gray-600 text-sm">{item.hora}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0 ml-2">
                      {item.data ? item.data.split('-').reverse().join('/') : '—'}
                    </span>
                  </div>
                  
                  {/* Informații în grid compact */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="block text-xs font-medium text-gray-600 mb-1">Duración</div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.duration && item.tipo === 'Salida' ? (
                          <span className="text-blue-600">⏱️ {item.duration}</span>
                        ) : item.tipo === 'Salida' && !item.duration ? (
                          <span className="text-red-600">⚠️ Sin duración</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="block text-xs font-medium text-gray-600 mb-1">Modificado por</div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.modificatDe || '-'}</p>
                    </div>
                  </div>
                  
                  {/* Ubicación cu text wrapping */}
                  {item.address && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="block text-xs font-medium text-blue-700 mb-1">📍 Ubicación</div>
                      <p className="text-sm text-blue-800 break-words mb-2">{item.address}</p>
                      <button
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(item.address);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                        }}
                      >
                        🌍 Ver en Google Maps
                      </button>
                    </div>
                  )}
                  
                  {/* Acțiuni pe mobil */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openEdit(index)}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Modal pentru adăugare/editare - Modernizado */}
      <Modal
        isOpen={modalVisible}
        onClose={() => setModalVisible(false)}
        title={`${editIdx !== null ? 'Editar' : 'Añadir'} Registro`}
      >
        <div className="space-y-6">
          {/* Header del modal */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white text-2xl">{editIdx !== null ? '✏️' : '➕'}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {editIdx !== null ? 'Editar Registro' : 'Añadir Nuevo Registro'}
            </h3>
            <p className="text-sm text-gray-600">
              {editIdx !== null ? 'Modifica los datos del fichaje' : 'Crear un nuevo registro de fichaje'}
            </p>
          </div>

          {/* Empleado - Modernizado */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                👤
              </span>
              Seleccionar Empleado
            </h4>
            <div className="relative">
              <input
                id="registro-empleado-input"
                name="empleado"
                type="text"
                value={form.empleado}
                onChange={(e) => setForm(f => ({ ...f, empleado: e.target.value }))}
                onFocus={() => setShowEmpleadosDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowEmpleadosDropdown(false);
                    setSearchEmpleadoDropdown('');
                  }
                }}
                placeholder="Escribe para buscar empleado..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              />
              
              {/* Dropdown cu angajați */}
              {showEmpleadosDropdown && (
                <>
                  {/* Overlay pentru închidere */}
                  <div 
                    className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-sm"
                    onClick={() => {
                      setShowEmpleadosDropdown(false);
                      setSearchEmpleadoDropdown('');
                    }}
                  ></div>
                  
                  {/* Dropdown centrat */}
                  <div className="fixed z-[99999] bg-white border-2 border-gray-300 rounded-xl shadow-2xl max-h-80 overflow-y-auto" style={{
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '500px'
                  }}>
                  <div className="p-4">
                    {/* Header dropdown */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                      <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          👥
                        </span>
                        Seleccionar Empleado
                      </h4>
                      <button
                        onClick={() => {
                          setShowEmpleadosDropdown(false);
                          setSearchEmpleadoDropdown('');
                        }}
                        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                      >
                        ❌
                      </button>
                    </div>
                    
                    <input
                      id="search-empleado-dropdown"
                      name="search-empleado-dropdown"
                      type="text"
                      placeholder="🔍 Buscar empleado..."
                      value={searchEmpleadoDropdown}
                      onChange={(e) => setSearchEmpleadoDropdown(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 focus:bg-white transition-all duration-200"
                      autoFocus
                    />
                    
                    <div className="space-y-2">
                      {empleados
                        .filter(item => 
                          item.nombre.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()) ||
                          item.email.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()) ||
                          (item.grupo && item.grupo.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()))
                        )
                        .map((empleado, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              console.log('🔍 Setting empleado from dropdown:', empleado.nombre);
                              setForm(f => ({ ...f, empleado: empleado.nombre }));
                              setShowEmpleadosDropdown(false);
                              setSearchEmpleadoDropdown('');
                            }}
                            className="group p-3 hover:bg-red-50 cursor-pointer rounded-xl transition-all duration-200 border border-transparent hover:border-red-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                                <span className="text-white text-sm font-bold">
                                  {empleado.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{empleado.nombre}</div>
                                {empleado.email && (
                                  <div className="text-xs text-gray-500">{empleado.email}</div>
                                )}
                                {empleado.grupo && (
                                  <div className="text-xs text-blue-600">Grupo: {empleado.grupo}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                     
                     {empleados.length === 0 ? (
                       <div className="px-3 py-2 text-sm">
                         <div className="text-gray-500 text-center mb-2">
                           No hay empleados disponibles
                         </div>
                         {import.meta.env.PROD && (
                           <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-700">
                             <div className="font-semibold">⚠️ CORS Error</div>
                             <div>Lista no se puede cargar en producción</div>
                           </div>
                         )}
                       </div>
                     ) : empleados.filter(item => 
                       item.nombre.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()) ||
                       item.email.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()) ||
                       (item.grupo && item.grupo.toLowerCase().includes(searchEmpleadoDropdown.toLowerCase()))
                     ).length === 0 && searchEmpleadoDropdown.length > 0 && (
                       <div className="px-3 py-2 text-gray-500 text-sm text-center">
                         No se encontraron empleados
                       </div>
                     )}
                  </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tipo - Modernizado */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                🕒
              </span>
              Tipo de Registro
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Entrada */}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: 'Entrada' }))}
                className={`group relative p-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                  form.tipo === 'Entrada'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                    : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                  form.tipo === 'Entrada' 
                    ? 'bg-green-400 opacity-25 blur-md animate-pulse' 
                    : 'bg-green-400 opacity-0 group-hover:opacity-15 blur-md'
                }`}></div>
                <div className="relative text-center">
                  <span className="text-2xl mb-2 block">🚪</span>
                  <div className="text-sm font-bold">Entrada</div>
                  <div className={`text-xs ${
                    form.tipo === 'Entrada' ? 'text-white/80' : 'text-green-500'
                  }`}>Iniciar jornada</div>
                </div>
              </button>

              {/* Salida */}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: 'Salida' }))}
                className={`group relative p-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                  form.tipo === 'Salida'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                    : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
                }`}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                  form.tipo === 'Salida' 
                    ? 'bg-red-400 opacity-25 blur-md animate-pulse' 
                    : 'bg-red-400 opacity-0 group-hover:opacity-15 blur-md'
                }`}></div>
                <div className="relative text-center">
                  <span className="text-2xl mb-2 block">🚪</span>
                  <div className="text-sm font-bold">Salida</div>
                  <div className={`text-xs ${
                    form.tipo === 'Salida' ? 'text-white/80' : 'text-red-500'
                  }`}>Finalizar jornada</div>
                </div>
              </button>
            </div>
          </div>

          {/* Hora - Modernizado */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                ⏰
              </span>
              Hora del Registro
            </h4>
            <Input
              type="time"
              value={form.hora}
              onChange={(e) => setForm(f => ({ ...f, hora: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 focus:bg-white transition-all duration-200 font-medium text-lg"
            />
          </div>

          {/* Dirección - Modernizado */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                📍
              </span>
              Ubicación del Registro
            </h4>
            <div className={`px-4 py-3 border-2 border-gray-200 rounded-xl transition-all duration-200 ${
              form.address === 'Obteniendo ubicación...' || form.address === 'Ubicación no disponible' || 
              (form.address && form.address.includes('denegado')) || (form.address && form.address.includes('GPS')) ||
              (form.address && form.address.includes('Tiempo de espera')) || (form.address && form.address.includes('no soportada'))
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : 'bg-gray-50 text-gray-700'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {form.address === 'Obteniendo ubicación...' && (
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {(form.address === 'Ubicación no disponible' || (form.address && form.address.includes('denegado')) || 
                    (form.address && form.address.includes('GPS')) || (form.address && form.address.includes('Tiempo de espera')) ||
                    (form.address && form.address.includes('no soportada'))) && (
                    <span className="text-yellow-600">⚠️</span>
                  )}
                  {form.address && form.address !== 'Obteniendo ubicación...' && form.address !== 'Ubicación no disponible' && 
                   !form.address.includes('denegado') && !form.address.includes('GPS') && !form.address.includes('Tiempo de espera') &&
                   !form.address.includes('no soportada') && (
                    <span className="text-green-600">📍</span>
                  )}
                  <span className="text-sm">
                    {form.address || 'Obteniendo ubicación actual...'}
                  </span>
                </div>
                
                {/* Buton pentru reîncercare */}
                {(form.address === 'Ubicación no disponible' || (form.address && form.address.includes('denegado')) || 
                  (form.address && form.address.includes('GPS')) || (form.address && form.address.includes('Tiempo de espera')) ||
                  (form.address && form.address.includes('no soportada'))) && (
                  <button
                    type="button"
                    onClick={async () => {
                      setForm(prev => ({ ...prev, address: 'Obteniendo ubicación...' }));
                      
                      try {
                        const coords = await locationContext.getCurrentLocation();
                          
                          try {
                          const address = await locationContext.getAddressFromCoords(coords.latitude, coords.longitude);
                          if (address) {
                              setForm(prev => ({ 
                                ...prev, 
                              address: address 
                              }));
                            } else {
                              setForm(prev => ({ 
                                ...prev, 
                              address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` 
                              }));
                            }
                          } catch (error) {
                            setForm(prev => ({ 
                              ...prev, 
                            address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` 
                          }));
                        }
                      } catch (error) {
                        let errorMessage = 'Ubicación no disponible';
                        
                        if (error.code === 1) {
                          errorMessage = 'Acceso a ubicación denegado. Permite el acceso en configuración del navegador.';
                        } else if (error.code === 2) {
                          errorMessage = 'Ubicación no pudo ser determinada. Verifica tu conexión GPS.';
                        } else if (error.code === 3) {
                          errorMessage = 'Tiempo de espera agotado. Intenta de nuevo.';
                        }
                        
                        setForm(prev => ({ 
                          ...prev, 
                          address: errorMessage
                        }));
                      }
                    }}
                    className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded border border-yellow-300 transition-colors"
                    title="Reintentar obtener ubicación"
                  >
                    🔄 Reintentar
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {form.address === 'Obteniendo ubicación...' 
                ? 'Obteniendo tu ubicación actual...' 
                : form.address === 'Ubicación no disponible' || (form.address && form.address.includes('denegado')) ||
                  (form.address && form.address.includes('GPS')) || (form.address && form.address.includes('Tiempo de espera')) ||
                  (form.address && form.address.includes('no soportada'))
                ? 'No se pudo obtener la ubicación automáticamente. Haz clic en "Reintentar" o permite el acceso a la ubicación en tu navegador.'
                : 'La ubicación se actualiza automáticamente con tu posición actual'
              }
            </p>
          </div>

          {/* Fecha - Modernizado */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                📅
              </span>
              Fecha del Registro
            </h4>
            <Input
              type="date"
              value={form.data}
              onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 focus:bg-white transition-all duration-200 font-medium text-lg"
            />
          </div>

          {/* Botones modernos */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setModalVisible(false)}
              className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
            >
              <div className="relative flex items-center gap-2">
                <span className="text-lg">❌</span>
                <span>Cancelar</span>
              </div>
            </button>
            
            <button
              onClick={handleSave}
              disabled={apiLoading}
              className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-2">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">
                  {apiLoading ? '⏳' : editIdx !== null ? '💾' : '✅'}
                </span>
                <span>
                  {apiLoading ? 'Guardando...' : editIdx !== null ? 'Guardar Cambios' : 'Guardar Registro'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru selecția perioadei */}
      {showPeriodSelector && (
        <Modal isOpen={showPeriodSelector} onClose={() => setShowPeriodSelector(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Seleccionar Período</h2>
            <p className="text-sm text-gray-600">
              Selecciona un rango de fechas para filtrar los registros
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="period-start-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio
                </label>
                <Input
                  id="period-start-date"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full"
                  max={periodEnd || new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label htmlFor="period-end-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Fin
                </label>
                <Input
                  id="period-end-date"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full"
                  min={periodStart}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="secondary" 
                onClick={() => setShowPeriodSelector(false)}
                disabled={changingMonth}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handlePeriodSearch}
                loading={changingMonth}
                disabled={!periodStart || !periodEnd}
              >
                Aplicar Período
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de filtrare */}
      {filterModal && (
        <Modal
          isOpen={!!filterModal}
          onClose={() => setFilterModal(null)}
          title="Filtreaza Registre"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="filter-empleado" className="block text-sm font-medium text-gray-700 mb-2">Empleado</label>
              <Input
                id="filter-empleado"
                type="text"
                placeholder="🔍 Buscar empleado..."
                value={filter.empleado}
                onChange={(e) => setFilter(f => ({ ...f, empleado: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="filter-luna" className="block text-sm font-medium text-gray-700 mb-2">Luna (MM)</label>
              <Input
                id="filter-luna"
                type="text"
                placeholder="MM"
                value={filter.luna}
                onChange={(e) => setFilter(f => ({ ...f, luna: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="filter-an" className="block text-sm font-medium text-gray-700 mb-2">Año (YYYY)</label>
              <Input
                id="filter-an"
                type="text"
                placeholder="YYYY"
                value={filter.an}
                onChange={(e) => setFilter(f => ({ ...f, an: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="filter-de" className="block text-sm font-medium text-gray-700 mb-2">De (YYYY-MM-DD)</label>
              <Input
                id="filter-de"
                type="date"
                value={filter.de}
                onChange={(e) => setFilter(f => ({ ...f, de: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="filter-pana" className="block text-sm font-medium text-gray-700 mb-2">Pana (YYYY-MM-DD)</label>
              <Input
                id="filter-pana"
                type="date"
                value={filter.pana}
                onChange={(e) => setFilter(f => ({ ...f, pana: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setFilterModal(null)}>Cancelar</Button>
              <Button onClick={() => applyFilter(filter, false)} loading={apiLoading}>Aplicar Filtro</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function FichajePage() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;
  const [activeTab, setActiveTab] = useState('personal');
  const [logs, setLogs] = useState([]);
  
  // Estado para modal incidencia
  const [showIncidenciaModal, setShowIncidenciaModal] = useState(false);
  const [isSubmittingIncidencia, setIsSubmittingIncidencia] = useState(false);
  const [incidenciaMessage, setIncidenciaMessage] = useState('');
  const [incidenciaForm, setIncidenciaForm] = useState({
    tipo: 'Salida del Centro',
    motivo: '',
    motivoPersonalizado: '',
    permisoFechaInicio: '',
    permisoFechaFin: ''
  });
  const incidenciaMessageTimeoutRef = useRef(null);
  
  // State pentru a detecta ce tip de incidentă poate fi înregistrată
  // State pentru notificări
  const [notification, setNotification] = useState(null);
  
  // State pentru orarul asignat
  const [horarioAsignado, setHorarioAsignado] = useState(null);
  // const cuadrantesLogCacheRefAdmin = useRef({}); // Not used currently
  // const logCuadranteOnceAdmin = useCallback((key, ...args) => {
  //   const serialized = JSON.stringify(args);
  //   if (cuadrantesLogCacheRefAdmin.current[key] === serialized) {
  //     return;
  //   }
  //   cuadrantesLogCacheRefAdmin.current[key] = serialized;
  //   console.log(...args);
  // }, []); // Not used currently
  const [loadingHorario, setLoadingHorario] = useState(false);
  
  // State pentru cuadrantul asignat
  const [cuadranteAsignado, setCuadranteAsignado] = useState(null);
  const [loadingCuadrante, setLoadingCuadrante] = useState(false);
  
  // State pentru datele complete ale utilizatorului
  const [userData, setUserData] = useState(null);
  
  // Ref pentru a preveni re-apelurile inutile ale fetchHorarioAsignado
  const lastHorarioFetchRef = useRef({ centro: null, grupo: null });
  
  // Ref pentru a preveni re-apelurile inutile ale fetchCuadranteAsignado
  const lastCuadranteFetchRef = useRef({ codigo: null, month: null });

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
      console.log('FichajePage raw data from backend:', users);
      
      // Normalizo el email a lowercase y sin espacios
      const normEmail = (email || '').trim().toLowerCase();
      let found = users.find(u => ((u['CORREO ELECTRONICO'] || '').trim().toLowerCase()) === normEmail);
      if (!found && users.length > 0) {
        found = users.find(u => (u[8] || '').trim().toLowerCase() === normEmail);
      }
      
      // Mapeo robusto de campos - verificamos múltiples variaciones
      if (found) {
        const mappedUser = {
          'NOMBRE / APELLIDOS': found['NOMBRE / APELLIDOS'] || found.nombre || found.NOMBRE || '',
          'CORREO ELECTRONICO': found['CORREO ELECTRONICO'] || found.email || found.EMAIL || '',
          'CODIGO': found['CODIGO'] || found.codigo || found.CODIGO || '',
          'CENTRO TRABAJO': found['CENTRO TRABAJO'] || found.centro_trabajo || found.centroTrabajo || found['CENTRO_DE_TRABAJO'] || found['CENTRO DE TRABAJO'] || found['CENTRO'] || found.centro || '',
          'GRUPO': found['GRUPO'] || found.grupo || found.GRUPO || '',
          'ESTADO': found['ESTADO'] || found.estado || found.ESTADO || '',
          'FECHA BAJA': found['FECHA BAJA'] || found.fecha_baja || found.fechaBaja || found['FECHA_BAJA'] || '',
          'Fecha Antigüedad': found['Fecha Antigüedad'] || found.fecha_antiguedad || found.fechaAntiguedad || '',
          'Antigüedad': found['Antigüedad'] || found.antiguedad || '',
        };
        console.log('FichajePage mapped user:', mappedUser);
        setUserData(mappedUser);
      } else {
        setUserData(found);
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
    }
  }, [authUser]);

  // Funcție pentru a încărca cuadrantul asignat
  const fetchCuadranteAsignado = useCallback(async () => {
    const codigoEmpleado = authUser?.CODIGO || authUser?.codigo || '';
    if (!codigoEmpleado) {
      console.log('🔍 DEBUG - Nu există codigo pentru cuadrante');
      setCuadranteAsignado(null);
      return;
    }

    // Găsește cuadrantul pentru luna curentă
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    // Previne re-apelurile inutile dacă codigo și luna nu s-au schimbat
    if (lastCuadranteFetchRef.current.codigo === codigoEmpleado && 
        lastCuadranteFetchRef.current.month === currentMonthFormatted &&
        !loadingCuadrante) {
      return;
    }
    
    lastCuadranteFetchRef.current = { codigo: codigoEmpleado, month: currentMonthFormatted };
    
    setLoadingCuadrante(true);
    try {
      // Folosește noul backend endpoint
      const url = routes.getCuadrantes;
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ codigo: codigoEmpleado })
      });

      const data = await res.json();
      const lista = Array.isArray(data) ? data : [data];
      
      console.log('🔍 DEBUG - Cuadrantes primite din backend:', lista);
      console.log('🔍 DEBUG - Primul cuadrante (exemplu):', lista[0]);
      console.log('🔍 DEBUG - Toate câmpurile primului cuadrante:', lista[0] ? Object.keys(lista[0]) : 'Nu există cuadrante');
      
      if (lista.length > 0) {
        console.log('🔍 DEBUG - Căutare cuadrante pentru luna:', currentMonthFormatted);
        console.log('🔍 DEBUG - Toate lunile din cuadrantes:', lista.map(c => ({ 
          luna: c.LUNA || c.luna, 
          nombre: c.NOMBRE || c.nombre,
          codigo: c.CODIGO || c.codigo
        })));
        
        const cuadranteMatch = lista.find(cuadrante => {
          let luna = cuadrante.LUNA || cuadrante.luna;
          const codigo = cuadrante.CODIGO || cuadrante.codigo;
          
          if (typeof luna === 'number') {
            // Convert Excel date to YYYY-MM
            const date = new Date(Math.round((luna - 25569) * 86400 * 1000));
            luna = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
          }
          return luna === currentMonthFormatted && codigo === codigoEmpleado;
        });
        
        if (cuadranteMatch) {
          console.log('✅ Cuadrante găsit pentru luna curentă:', cuadranteMatch);
          setCuadranteAsignado(cuadranteMatch);
        } else {
          console.log('❌ Nu s-a găsit cuadrante pentru luna curentă');
          setCuadranteAsignado(null);
        }
      } else {
        console.log('❌ Nu există cuadrantes pentru acest angajat');
        setCuadranteAsignado(null);
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea cuadrantului asignat:', error);
      setCuadranteAsignado(null);
    } finally {
      setLoadingCuadrante(false);
    }
  }, [authUser, loadingCuadrante]);

  // Funcție pentru a încărca orarul asignat
  const fetchHorarioAsignado = useCallback(async () => {
    // Căutăm orarul care se potrivește cu centrul și grupul utilizatorului
    // Folosim userData în loc de authUser pentru a avea acces la CENTRO TRABAJO
    const centroUsuario = userData?.['CENTRO TRABAJO'] || authUser?.['CENTRO TRABAJO'] || authUser?.centroTrabajo || authUser?.['CENTRO'] || authUser?.centro || authUser?.role || '';
    const grupoUsuario = userData?.['GRUPO'] || authUser?.['GRUPO'] || authUser?.grupo || '';
    
    // Previne re-apelurile inutile dacă centro și grupo nu s-au schimbat
    if (lastHorarioFetchRef.current.centro === centroUsuario && 
        lastHorarioFetchRef.current.grupo === grupoUsuario &&
        !loadingHorario) {
      return;
    }
    
    lastHorarioFetchRef.current = { centro: centroUsuario, grupo: grupoUsuario };
    
    setLoadingHorario(true);
    try {
      // Importăm funcția listSchedules din api/schedules.ts
      const { listSchedules } = await import('../api/schedules');
      
      // Încărcăm toate orarele
      const response = await listSchedules(null); // null pentru callApi, folosim direct fetch
      
      if (response.success && Array.isArray(response.data)) {
        // LOG COMPLET pentru a vedea ce primești din backend
        console.log('🔍 DEBUG - Răspuns complet din backend:', response);
        console.log('🔍 DEBUG - Toate orarele din backend (complet):', response.data);
        console.log('🔍 DEBUG - Primul orar din backend (exemplu):', response.data[0]);
        
        console.log('🔍 DEBUG - Utilizator:', { centroUsuario, grupoUsuario });
        console.log('🔍 DEBUG - Toate câmpurile utilizatorului:', userData || authUser);
        console.log('🔍 DEBUG - Orare din backend (simplificat):', response.data.map(h => ({ 
          nombre: h.nombre, 
          centroNombre: h.centroNombre, 
          grupoNombre: h.grupoNombre,
          days: h.days,
          id: h.id
        })));
        
        const horarioMatch = response.data.find(horario => 
          horario.centroNombre === centroUsuario && 
          horario.grupoNombre === grupoUsuario
        );
        
        if (horarioMatch) {
          console.log('✅ Orar găsit (COMPLET):', horarioMatch);
          console.log('✅ Orar găsit - days:', horarioMatch.days);
          console.log('✅ Orar găsit - Luni:', horarioMatch.days?.L);
          console.log('✅ Orar găsit - Martes:', horarioMatch.days?.M);
          setHorarioAsignado(horarioMatch);
        } else {
          console.log('❌ Nu s-a găsit orar pentru:', { centroUsuario, grupoUsuario });
          console.log('❌ Toate orarele disponibile:', response.data.map(h => ({
            nombre: h.nombre,
            centroNombre: h.centroNombre,
            grupoNombre: h.grupoNombre
          })));
          setHorarioAsignado(null);
        }
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea orarului asignat:', error);
      setHorarioAsignado(null);
    } finally {
      setLoadingHorario(false);
    }
  }, [authUser, userData, loadingHorario]);
  
  // State pentru dialog de confirmare
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    isOpen: false,
    registroIndex: null
  });

  // Ref pentru funcția de ștergere din RegistrosEmpleadosScreen
  const onDeleteRegistroRef = useRef(null);

  // Încarcă datele complete ale utilizatorului
  useEffect(() => {
    if (authUser?.email) {
      fetchUserData();
    }
  }, [authUser, fetchUserData]);

  // Încarcă cuadrantul când se încarcă utilizatorul
  useEffect(() => {
    if (authUser && !authUser?.isDemo) {
      fetchCuadranteAsignado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]); // Eliminat fetchCuadranteAsignado din dependențe pentru a evita re-render-uri infinite

  // Încarcă orarul când se încarcă utilizatorul sau când se schimbă userData
  useEffect(() => {
    if (authUser && !authUser?.isDemo && userData) {
      fetchHorarioAsignado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, userData]); // Eliminat fetchHorarioAsignado din dependențe pentru a evita re-render-uri infinite

  // Funcție pentru a verifica dacă timpul curent este în intervalul permis pentru cuadrante
  // Memoizată pentru a evita recalculări inutile
  const isTimeWithinCuadrante = useCallback((tipo) => {
    if (!cuadranteAsignado) {
      return true;
    }

    const now = new Date();
    const currentDay = now.getDate(); // Ziua din lună (1-31)
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Timpul curent în minute
    
    // Pentru Salida în ture nocturne, verifică și ziua de ieri pentru a găsi începutul turei
    let daySchedule = null;
    let intervals = [];
    
    // Încearcă mai întâi ziua curentă
    const dayKey = `ZI_${currentDay}`;
    daySchedule = cuadranteAsignado[dayKey];
    
    // Dacă ziua nu este definită în cuadrante (nu există cheia), permite fichar
    // Dacă ziua este explicit marcată ca "LIBRE" sau goală, NU permite fichar
    if (daySchedule === undefined || daySchedule === null) {
      return true; // Ziua nu este în cuadrante, permite fichar (nu este restricționată)
    }
    
    if (daySchedule === 'LIBRE' || daySchedule === '') {
      return false; // Zi liberă explicită, NU permite fichar
    }

    // Parsează orarul din cuadrante (format: "T1 09:00-17:00" sau "09:00-12:00,14:00-18:00")
    if (daySchedule.includes('T1') || daySchedule.includes('T2') || daySchedule.includes('T3')) {
      // Format cuadrante: "T1 09:00-17:00"
      const match = daySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
      if (match) {
        intervals = [{ start: match[1], end: match[2] }];
      }
    } else {
      // Format clasic: "08:00-12:00,14:00-18:00"
      intervals = daySchedule.split(',').map(interval => {
        const [start, end] = interval.trim().split('-');
        return { start: start?.trim(), end: end?.trim() };
      }).filter(interval => interval.start && interval.end);
    }

    // Pentru Salida în ture nocturne, verifică ziua de ieri pentru a găsi începutul turei nocturne
    if (tipo === 'Salida' && intervals.length > 0) {
      const lastInterval = intervals[intervals.length - 1];
      const startTime = parseTimeToMinutes(lastInterval.start);
      const endTime = parseTimeToMinutes(lastInterval.end);
      
      // Dacă detectează tură nocturnă (19:00-07:00), verifică și ziua de ieri
      if (endTime < startTime) {
        const yesterdayDay = currentDay - 1;
        const yesterdayKey = `ZI_${yesterdayDay}`;
        const yesterdaySchedule = cuadranteAsignado[yesterdayKey];
        
        if (yesterdaySchedule && yesterdaySchedule !== 'LIBRE' && yesterdaySchedule.trim() !== '') {
          // Extrage intervalele de ieri pentru a obține întregul spectru al turei nocturne
          let yesterdayIntervals = [];
          if (yesterdaySchedule.includes('T1') || yesterdaySchedule.includes('T2') || yesterdaySchedule.includes('T3')) {
            const match = yesterdaySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (match) {
              yesterdayIntervals = [{ start: match[1], end: match[2] }];
            }
          }
          
          // Dacă ieri avea tură care se termină astăzi dimineață
          if (yesterdayIntervals.length > 0) {
            const yesterStartTime = parseTimeToMinutes(yesterdayIntervals[0].start);
            const yesterEndTime = parseTimeToMinutes(yesterdayIntervals[0].end);
            
            if (yesterEndTime < yesterStartTime) {
              // Tură nocturnă continuă de ieri
              intervals = yesterdayIntervals;
            }
          }
        }
      }
    }

    if (intervals.length === 0) {
      return true;
    }

    // Verifică fiecare interval - permite Entrada și Salida în orice interval
    for (const interval of intervals) {
      const startTime = parseTimeToMinutes(interval.start);
      let endTime = parseTimeToMinutes(interval.end);
      
      // Detectează dacă tură este nocturnă (peste miezul nopții)
      const isOvernightShift = endTime < startTime;
      
      if (tipo === 'Entrada') {
        // Pentru Entrada: permite TĂRZIU (după timpul inițial) sau 10 minute înainte
        const marginBefore = 10; // 10 minute înainte
        let allowedStart = startTime - marginBefore;
        let allowedEnd = startTime; // Ultima dată permisă este la timpul inițial (sau după)
        
        // Pentru ture nocturne, normalează range-ul pentru Entrada (se face în ziua curentă)
        if (isOvernightShift && allowedStart < 0) {
          allowedStart = 0;
        }
        if (isOvernightShift && allowedEnd >= 24 * 60) {
          allowedEnd = 24 * 60 - 1;
        }
        
        // Permite dacă este în intervalul permis sau dacă este după timpul permis (târziu)
        if (currentTime >= allowedStart && currentTime <= allowedEnd) {
          return true;
        }
        // Dacă este după timpul permis, permite pentru a putea ficha târziu
        if (currentTime > allowedEnd) {
          return true;
        }
      } else if (tipo === 'Salida') {
        // Pentru Salida: permite TĂRZIU (după timpul final) sau 10 minute înainte
        
        let allowedStart, allowedEnd;
        
        if (isOvernightShift) {
          // Pentru ture nocturne, Salida se face a doua zi
          allowedStart = endTime - 10; // 10 minute înainte
          allowedEnd = endTime; // Timpul sfârșitului turei
          
          // Normalizare pentru cazuri edge
          if (allowedStart < 0) allowedStart = 0;
          if (allowedEnd >= 24 * 60) allowedEnd = 24 * 60 - 1;
        } else {
          // Tură normală în aceeași zi
          allowedStart = endTime - 10; // 10 minute înainte
          allowedEnd = endTime; // Timpul sfârșitului turei
        }
        
        // Permite dacă este în intervalul permis sau dacă este după timpul permis (târziu)
        if (currentTime >= allowedStart && currentTime <= allowedEnd) {
          return true;
        }
        // Dacă este după timpul permis, permite pentru a putea ficha târziu
        if (currentTime > allowedEnd) {
          return true;
        }
      }
    }
    
    return false;
  }, [cuadranteAsignado]);

  // Funcție pentru a verifica dacă timpul curent este în intervalul permis pentru orar
  // Memoizată pentru a evita recalculări inutile
  const isTimeWithinSchedule = useCallback((tipo) => {
    // PRIORITATE: Cuadrante > Horario
    if (cuadranteAsignado) {
      return isTimeWithinCuadrante(tipo);
    }
    
    if (!horarioAsignado) {
      return true; // Dacă nu există orar sau cuadrante, permite orice timp
    }
    
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Duminică, 1 = Luni, etc.
    const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][currentDay];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Timpul curent în minute
    
    // Verifică dacă există orar pentru această zi
    const daySchedule = horarioAsignado.days?.[dayKey];
    if (!daySchedule) {
      return true; // Dacă nu există orar pentru această zi, permite
    }
    
    // Extrage toate intervalele din orar
    const intervals = [];
    if (daySchedule.in1 && daySchedule.out1) {
      intervals.push({in: daySchedule.in1, out: daySchedule.out1});
    }
    if (daySchedule.in2 && daySchedule.out2) {
      intervals.push({in: daySchedule.in2, out: daySchedule.out2});
    }
    if (daySchedule.in3 && daySchedule.out3) {
      intervals.push({in: daySchedule.in3, out: daySchedule.out3});
    }
    
    if (intervals.length === 0) {
      return true; // Dacă nu există intervale, permite
    }
    
    // Verifică fiecare interval - permite Entrada și Salida în orice interval
    for (const interval of intervals) {
      const inTime = parseTimeToMinutes(interval.in);
      const outTime = parseTimeToMinutes(interval.out);
      
      if (tipo === 'Entrada') {
        // Pentru Entrada: permite TĂRZIU (după timpul inițial) sau 10 minute înainte
        const marginBefore = 10; // 10 minute înainte
        const allowedStart = inTime - marginBefore;
        const allowedEnd = inTime; // Ultima dată permisă este la timpul inițial
        
        // Permite dacă este în intervalul permis sau dacă este după timpul permis (târziu)
        if (currentTime >= allowedStart && currentTime <= allowedEnd) {
          return true;
        }
        // Dacă este după timpul permis, permite pentru a putea ficha târziu
        if (currentTime > allowedEnd) {
          return true;
        }
      } else if (tipo === 'Salida') {
        // Pentru Salida: permite TĂRZIU (după timpul final) sau 10 minute înainte
        const marginBefore = 10; // 10 minute înainte
        const allowedStart = outTime - marginBefore;
        const allowedEnd = outTime; // Timpul sfârșitului turei
        
        // Permite dacă este în intervalul permis sau dacă este după timpul permis (târziu)
        if (currentTime >= allowedStart && currentTime <= allowedEnd) {
          return true;
        }
        // Dacă este după timpul permis, permite pentru a putea ficha târziu
        if (currentTime > allowedEnd) {
          return true;
        }
      }
    }
    
    return false;
  }, [cuadranteAsignado, horarioAsignado, isTimeWithinCuadrante]);

  // Funcție pentru a converti timpul (HH:MM) în minute
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  // Funcție pentru a obține mesajul de restricție
  const getTimeRestrictionMessage = (tipo) => {
    if (!horarioAsignado) return null;
    
    const now = new Date();
    const currentDay = now.getDay();
    const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][currentDay];
    const daySchedule = horarioAsignado.days?.[dayKey];
    
    if (!daySchedule) return null;
    
    const intervals = [];
    if (daySchedule.in1 && daySchedule.out1) {
      intervals.push({in: daySchedule.in1, out: daySchedule.out1});
    }
    if (daySchedule.in2 && daySchedule.out2) {
      intervals.push({in: daySchedule.in2, out: daySchedule.out2});
    }
    if (daySchedule.in3 && daySchedule.out3) {
      intervals.push({in: daySchedule.in3, out: daySchedule.out3});
    }
    
    if (intervals.length === 0) return null;
    
    if (tipo === 'Entrada') {
      const nextStart = intervals.find(interval => interval.in);
      if (nextStart) {
        return `Entrada permitida: ${nextStart.in} (±10 min)`;
      }
    } else if (tipo === 'Salida') {
      const nextEnd = intervals.find(interval => interval.out);
      if (nextEnd) {
        return `Salida permitida: ${nextEnd.out} (±10 min)`;
      }
    }
    
    return null;
  };

  // Estado para hora de Madrid y ubicación dentro del modal
  const [madridTime, setMadridTime] = useState('');
  const [madridDate, setMadridDate] = useState('');
  const [madridNowMs, setMadridNowMs] = useState(null);
  const [modalCoords, setModalCoords] = useState(null);
  const [modalAddress, setModalAddress] = useState('');
  const [loadingModalLocation, setLoadingModalLocation] = useState(false);
  const madridTimerRef = useRef(null);

  const updateMadridTimeFromMs = (ms) => {
    try {
      const d = new Date(ms || Date.now());
      const time = d.toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const date = d.toLocaleDateString('es-ES', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      setMadridTime(time);
      setMadridDate(date);
    } catch (e) {
      setMadridTime(new Date().toLocaleTimeString());
      setMadridDate(new Date().toLocaleDateString());
    }
  };

  useEffect(() => {
    if (showIncidenciaModal) {
      // Initialize Madrid time from an authoritative API, not device clock
      (async () => {
        try {
          const resp = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid');
          if (resp.ok) {
            const data = await resp.json();
            // data.datetime example: 2025-10-02T14:21:06.123456+02:00
            const base = new Date(data.datetime).getTime();
            setMadridNowMs(base);
            updateMadridTimeFromMs(base);
          } else {
            // fallback to device time once if API fails
            const base = Date.now();
            setMadridNowMs(base);
            updateMadridTimeFromMs(base);
          }
        } catch (_) {
          const base = Date.now();
          setMadridNowMs(base);
          updateMadridTimeFromMs(base);
        }
      })();
      // Start ticking forward locally each second from base ms
      madridTimerRef.current = setInterval(() => {
        setMadridNowMs(prev => {
          const next = (prev || Date.now()) + 1000;
          updateMadridTimeFromMs(next);
          return next;
        });
      }, 1000);
      // Get location for modal only folosind contextul global
      setLoadingModalLocation(true);
      (async () => {
        // eslint-disable-next-line no-undef
        const ctx = locationContextRef.current;
        try {
          const coords = await ctx.getCurrentLocation();
          setModalCoords(coords);
          try {
            const address = await ctx.getAddressFromCoords(coords.latitude, coords.longitude);
            if (address) {
              setModalAddress(address);
            } else {
              setModalAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
            }
          } catch (_) {
            setModalAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
          }
        } catch (error) {
          let msg = 'Ubicación no disponible';
          if (error && error.code === 1) msg = 'Acceso a ubicación denegado';
          if (error && error.code === 2) msg = 'No se pudo determinar la ubicación';
          if (error && error.code === 3) msg = 'Tiempo de espera agotado';
          setModalAddress(msg);
        } finally {
          setLoadingModalLocation(false);
        }
      })();
    } else {
      if (madridTimerRef.current) {
        clearInterval(madridTimerRef.current);
        madridTimerRef.current = null;
      }
    }
    return () => {
      if (madridTimerRef.current) {
        clearInterval(madridTimerRef.current);
        madridTimerRef.current = null;
      }
    };
  }, [showIncidenciaModal]);

  useEffect(() => {
    return () => {
      if (incidenciaMessageTimeoutRef.current) {
        clearTimeout(incidenciaMessageTimeoutRef.current);
        incidenciaMessageTimeoutRef.current = null;
      }
    };
  }, []);

  // Funcția pentru confirmarea ștergerii
  const confirmDelete = async () => {
    const idx = deleteConfirmDialog.registroIndex;
    if (idx === null) return;

    try {
      // Apelăm callback-ul pentru ștergere (implementat în RegistrosEmpleadosScreen)
      if (onDeleteRegistroRef.current) {
        await onDeleteRegistroRef.current(idx);
      } else {
        throw new Error('Delete handler not available');
      }
      
      setDeleteConfirmDialog({ isOpen: false, registroIndex: null });
    } catch (error) {
      console.error('Error deleting registro:', error);
      setNotification({
        type: 'error',
        title: 'Error de Eliminación',
        message: error.message || t('error.deleteError')
      });
      setDeleteConfirmDialog({ isOpen: false, registroIndex: null });
    }
  };
  // Funciones para incidencia
  const handleFicharIncidencia = async () => {
    
    // Setează automat tipul de incidență în funcție de ultimul marcaj
    console.log('handleFicharIncidencia - logs din componenta principala:', logs);
    console.log('handleFicharIncidencia - logs[0]:', logs[0]);
    
    const ultimoMarcaje = logs[0]; // El primero de la lista es el más reciente
    let tipoIncidencia = 'Entrada'; // Default
    
    if (ultimoMarcaje) {
      // Dacă ultimul marcaj este 'Entrada', atunci incidența va fi 'Salida'
      // Dacă ultimul marcaje este 'Salida', atunci incidența va fi 'Entrada'
      tipoIncidencia = ultimoMarcaje.tipo === 'Entrada' ? 'Salida' : 'Entrada';
      console.log('handleFicharIncidencia - ultimoMarcaje.tipo:', ultimoMarcaje.tipo);
      console.log('handleFicharIncidencia - tipoIncidencia setat:', tipoIncidencia);
    } else {
      console.log('handleFicharIncidencia - nu sunt marcaje, folosesc default:', tipoIncidencia);
    }
    
    setIncidenciaForm(f => ({
      ...f,
      tipo: tipoIncidencia,
      permisoFechaInicio: '',
      permisoFechaFin: ''
    }));
    
    console.log('handleFicharIncidencia - incidenciaForm actualizat:', { tipo: tipoIncidencia });
    
    setShowIncidenciaModal(true);
  };

  const handleSubmitIncidencia = async () => {
    setIsSubmittingIncidencia(true);
    setIncidenciaMessage('');

    try {
      // Verifica si tenemos email en ambos formatos posibles
      const userEmail = authUser?.['CORREO ELECTRONIC'] || authUser?.email;
      const userName = authUser?.['NOMBRE / APELLIDOS'] || authUser?.name;
      const userCode = authUser?.['CODIGO'] || authUser?.codigo;
      
      if (!userEmail || !userName || !userCode) {
        console.error('Missing user data:', {
          email: userEmail,
          nombre: userName,
          codigo: userCode
        });
        setNotification({
          type: 'error',
          title: 'Error de Autenticación',
          message: '¡Datos de usuario faltantes! Por favor, inicia sesión nuevamente.'
        });
        setIsSubmittingIncidencia(false);
        return;
      }

      if (incidenciaForm.tipo === 'Permiso Retribuido') {
        if (!incidenciaForm.permisoFechaInicio || !incidenciaForm.permisoFechaFin) {
          setIncidenciaMessage('Debes indicar la fecha de inicio y fin para el permiso retribuido.');
          setIsSubmittingIncidencia(false);
          return;
        }
        const inicioDate = new Date(incidenciaForm.permisoFechaInicio);
        const finDate = new Date(incidenciaForm.permisoFechaFin);
        if (inicioDate > finDate) {
          setIncidenciaMessage('La fecha de fin no puede ser anterior a la fecha de inicio.');
          setIsSubmittingIncidencia(false);
          return;
        }

        const diffInMs = finDate.getTime() - inicioDate.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
        if (diffInDays > 5) {
          setIncidenciaMessage('El permiso retribuido no puede exceder 5 días consecutivos.');
          setIsSubmittingIncidencia(false);
          return;
        }
      }

      // Obtiene la ubicación (opcional) folosind contextul global
      let loc = null;
      let address = null;
      
      // eslint-disable-next-line no-undef
      const ctx = locationContextRef.current;
      try {
        loc = await ctx.getCurrentLocation();
          
          // Intentamos obtener la dirección a través de geocodificación inversa
          try {
          address = await ctx.getAddressFromCoords(loc.latitude, loc.longitude);
          } catch (e) {
          // No se pudo obtener la dirección, continuamos sin ella
          console.warn('No se pudo obtener la dirección:', e);
        }
      } catch (error) {
        // Error al obtener la ubicación, continuamos sin ella
        console.warn('Error al obtener la ubicación:', error);
      }

      // Determina el motivo final
      let razonFinal = incidenciaForm.motivo;
      if (
        incidenciaForm.motivo === 'Otro motivo' &&
        incidenciaForm.motivoPersonalizado.trim()
      ) {
        razonFinal = incidenciaForm.motivoPersonalizado.trim();
      }

      // Validación: Para "Salida del Centro", el motivo es obligatorio
      if (incidenciaForm.tipo === 'Salida del Centro') {
        if (!razonFinal || razonFinal.trim() === '') {
          setIncidenciaMessage('⚠️ El motivo es obligatorio para "Salida del Centro". Por favor, completa el motivo antes de registrar.');
          setIsSubmittingIncidencia(false);
          return;
        }
      }

      const solicitudId = generateSolicitudId();

      const parseIntervalHours = (start, end) => {
        if (!start || !end) return 0;
        const [sh, sm = '0'] = start.split(':');
        const [eh, em = '0'] = end.split(':');
        const startMinutes = parseInt(sh, 10) * 60 + parseInt(sm, 10);
        let endMinutes = parseInt(eh, 10) * 60 + parseInt(em, 10);
        if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
          return 0;
        }
        // Handle overnight intervals (end next day)
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }
        return (endMinutes - startMinutes) / 60;
      };

      const buildHorarioPayload = () => {
        if (!horarioAsignado) return null;
        const now = new Date();
        const dayIndex = now.getDay();
        const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dayIndex];
        const daySchedule = horarioAsignado.days?.[dayKey];
        const intervalos = [];

        if (daySchedule) {
          const addInterval = (inicio, fin) => {
            if (inicio && fin) {
              intervalos.push({ inicio, fin });
            }
          };
          addInterval(daySchedule.in1, daySchedule.out1);
          addInterval(daySchedule.in2, daySchedule.out2);
          addInterval(daySchedule.in3, daySchedule.out3);
        }

        const horasDiarias = intervalos.reduce(
          (acc, interval) => acc + parseIntervalHours(interval.inicio, interval.fin),
          0
        );

        return {
          nombre: horarioAsignado.nombre || null,
          centro: horarioAsignado.centroNombre || null,
          grupo: horarioAsignado.grupoNombre || null,
          dayKey,
          intervalos: intervalos.length > 0 ? intervalos : null,
          horas_diarias: horasDiarias > 0 ? Number(horasDiarias.toFixed(2)) : null
        };
      };

      const buildCuadrantePayload = () => {
        if (!cuadranteAsignado) return null;
        const today = new Date().getDate();
        const dayKey = `ZI_${today}`;
        const daySchedule = cuadranteAsignado[dayKey];

        const response = {
          nombre: cuadranteAsignado.NOMBRE || cuadranteAsignado.nombre || null,
          mes: cuadranteAsignado.LUNA || cuadranteAsignado.luna || null,
          dayKey,
          dia: daySchedule || null,
          intervalos: null,
          horas_diarias: null
        };

        if (!daySchedule || daySchedule === 'LIBRE' || daySchedule.trim() === '') {
          return response;
        }

        const matches = daySchedule.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g);
        if (matches && matches.length > 0) {
          const intervalos = matches.map(match => {
            const [inicio, fin] = match.split('-').map(str => str.trim());
            return { inicio, fin };
          });
          const horasDiarias = intervalos.reduce(
            (acc, interval) => acc + parseIntervalHours(interval.inicio, interval.fin),
            0
          );
          response.intervalos = intervalos;
          response.horas_diarias = horasDiarias > 0 ? Number(horasDiarias.toFixed(2)) : null;
        }

        return response;
      };

      const horarioPayload = buildHorarioPayload();
      const cuadrantePayload = buildCuadrantePayload();
      const sinHorarioAsignado = !cuadrantePayload && !horarioPayload;

      // Duration is now calculated by database triggers - no need for frontend calculation
      // duracion removed - calculated by database

      // Crea el payload idéntico a un fichaje normal, solo con estado adicional
      // Hora y fecha oficiales de Madrid para incidencias también
      const madridNowDate2 = new Date(madridNowMs || Date.now());
      const horaMadrid2 = madridNowDate2.toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const fechaMadrid2 = madridNowDate2.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

      // Folosim backend-ul nou pentru ausencia
      const ausenciaEndpoint = routes.addAusencia;
      
      // Mapăm tipurile pentru backend
      const tipoParaBackend = incidenciaForm.tipo === 'Salida del Centro' ? 'Salida Centro' : 
                              incidenciaForm.tipo === 'Regreso al Centro' ? 'Entrada Centro' : 
                              incidenciaForm.tipo;
      
      const ausenciaPayload = {
        codigo: userCode,
        nombre: userName,
        tipo: tipoParaBackend,
        data: fechaMadrid2,
        hora: horaMadrid2,
        locatia: address || (loc ? `${loc.latitude},${loc.longitude}` : ''),
        motivo: razonFinal,
        solicitud_id: solicitudId,
        horario_asignado: cuadrantePayload ? null : horarioPayload,
        cuadrante_asignado: cuadrantePayload || null,
        sin_horario_asignado: sinHorarioAsignado
      };
      if (incidenciaForm.tipo === 'Permiso Retribuido') {
        ausenciaPayload.permiso_fecha_inicio = incidenciaForm.permisoFechaInicio;
        ausenciaPayload.permiso_fecha_fin = incidenciaForm.permisoFechaFin;
      }

      console.log('✅ [Fichaje] Folosind backend-ul nou (addAusencia):', ausenciaEndpoint);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Adaugă timeout pentru a preveni blocarea infinită
      const timeoutMs = 30000; // 30 secunde
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await Promise.race([
          callApi(ausenciaEndpoint, {
        method: 'POST',
            headers: headers,
            body: JSON.stringify(ausenciaPayload),
            signal: controller.signal
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: La solicitud tardó demasiado. Inténtalo de nuevo.')), timeoutMs)
          )
        ]);

        clearTimeout(timeoutId);

        if (!result.success) {
          throw new Error(result.error || 'Error desconocido');
        }

        // Log crear ausencia/incidencia
        await activityLogger.logAusenciaCreated(ausenciaPayload, authUser);
        
        setIncidenciaMessage('Incidencia registrada correctamente. Pendiente de aprobación. IMPORTANTE: Hasta que no presentes la justificación documental para esta incidencia, no se procesará. Tienes un plazo de 7 días para presentar la justificación correspondiente.');
        if (incidenciaMessageTimeoutRef.current) {
          clearTimeout(incidenciaMessageTimeoutRef.current);
        }
        incidenciaMessageTimeoutRef.current = setTimeout(() => {
          setIncidenciaMessage('');
          incidenciaMessageTimeoutRef.current = null;
        }, 5000);
        
        // Cierra el modal y resetea el formulario
        setShowIncidenciaModal(false);
        setIncidenciaForm({
          tipo: 'Salida del Centro',
          motivo: '',
          motivoPersonalizado: '',
          permisoFechaInicio: '',
          permisoFechaFin: ''
        });
      } catch (apiError) {
        clearTimeout(timeoutId);
        console.error('Error submitting incidencia:', apiError);
        const errorMessage = apiError instanceof Error && apiError.message.includes('Timeout')
          ? '⏱️ La solicitud tardó demasiado. Por favor, inténtalo de nuevo.'
          : apiError instanceof Error && apiError.message
          ? apiError.message
          : 'Error al registrar la incidencia. Inténtalo de nuevo.';
        setIncidenciaMessage(errorMessage);
    } finally {
        setIsSubmittingIncidencia(false);
      }
    } catch (outerError) {
      // Handle any errors that occur before the API call
      console.error('Error in handleSubmitIncidencia:', outerError);
      setIsSubmittingIncidencia(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Control de Fichajes
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Sistema de registro de horarios para empleados
            </p>
          </div>
        </div>
      </div>

      {/* Botón Reportar Error */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de fichaje', '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span className="text-base">📱</span>
          Reportar error
        </button>
      </div>

      {/* Para empleado - solo MiFichaje */}
      {!isManager && (
        <Card>
          <MiFichajeScreen 
            onFicharIncidencia={handleFicharIncidencia} 
            incidenciaMessage={incidenciaMessage}
            setNotification={setNotification}
            horarioAsignado={horarioAsignado}
            loadingHorario={loadingHorario}
            cuadranteAsignado={cuadranteAsignado}
            loadingCuadrante={loadingCuadrante}
            isTimeWithinSchedule={isTimeWithinSchedule}
            getTimeRestrictionMessage={getTimeRestrictionMessage}
            onLogsUpdate={(logs) => {
              console.log('onLogsUpdate - logs primit:', logs);
              setLogs(logs);
            }}
          />
        </Card>
      )}

      {/* Para manager/supervisor - tabs con MiFichaje y Registros Empleados */}
      {isManager && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 mb-8">
            <button
              onClick={() => setActiveTab('personal')}
              className={`group relative w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'personal'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                  : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'personal' 
                  ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeTab === 'personal' 
                    ? 'bg-white/20' 
                    : 'bg-green-100 group-hover:bg-green-200'
                }`}>
                  <span className={`text-xl ${
                    activeTab === 'personal' ? 'text-white' : 'text-green-600'
                  }`}>⏰</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Mi Fichaje</div>
                  <div className={`text-xs ${
                    activeTab === 'personal' ? 'text-white/80' : 'text-green-500'
                  }`}>Control personal</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('empleados')}
              className={`group relative w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'empleados'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'empleados' 
                  ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeTab === 'empleados' 
                    ? 'bg-white/20' 
                    : 'bg-blue-100 group-hover:bg-blue-200'
                }`}>
                  <span className={`text-xl ${
                    activeTab === 'empleados' ? 'text-white' : 'text-blue-600'
                  }`}>👥</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Registros Empleados</div>
                  <div className={`text-xs ${
                    activeTab === 'empleados' ? 'text-white/80' : 'text-blue-500'
                  }`}>Gestionar equipo</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('horas')}
              className={`group relative w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'horas'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                  : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'horas' 
                  ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeTab === 'horas' 
                    ? 'bg-white/20' 
                    : 'bg-purple-100 group-hover:bg-purple-200'
                }`}>
                  <span className={`text-xl ${
                    activeTab === 'horas' ? 'text-white' : 'text-purple-600'
                  }`}>⏰</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Horas Trabajadas</div>
                  <div className={`text-xs ${
                    activeTab === 'horas' ? 'text-white/80' : 'text-purple-500'
                  }`}>Resumen mensual</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('permitidas')}
              className={`group relative w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'permitidas'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                  : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'permitidas' 
                  ? 'bg-orange-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-orange-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeTab === 'permitidas' 
                    ? 'bg-white/20' 
                    : 'bg-orange-100 group-hover:bg-orange-200'
                }`}>
                  <span className={`text-xl ${
                    activeTab === 'permitidas' ? 'text-white' : 'text-orange-600'
                  }`}>📊</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Horas Permitidas</div>
                  <div className={`text-xs ${
                    activeTab === 'permitidas' ? 'text-white/80' : 'text-orange-500'
                  }`}>Límites por grupo</div>
                </div>
              </div>
            </button>
          </div>

          {activeTab === 'personal' ? (
            <MiFichajeScreen 
              onFicharIncidencia={handleFicharIncidencia} 
              incidenciaMessage={incidenciaMessage}
              setNotification={setNotification}
              horarioAsignado={horarioAsignado}
              loadingHorario={loadingHorario}
              cuadranteAsignado={cuadranteAsignado}
              loadingCuadrante={loadingCuadrante}
              isTimeWithinSchedule={isTimeWithinSchedule}
              getTimeRestrictionMessage={getTimeRestrictionMessage}
              onLogsUpdate={(logs) => {
                console.log('onLogsUpdate - logs primit:', logs);
                setLogs(logs);
              }}
            />
          ) : activeTab === 'empleados' ? (
            <RegistrosEmpleadosScreen 
              setDeleteConfirmDialog={setDeleteConfirmDialog}
              setNotification={setNotification}
              onDeleteRegistroRef={onDeleteRegistroRef}
            />
          ) : activeTab === 'horas' ? (
            <HorasTrabajadas />
          ) : (
            <HorasPermitidas setNotification={setNotification} />
          )}
        </Card>
      )}

      {/* Modal ULTRA MODERN pentru Ausencia - Glassmorphism + 3D */}
      <Modal
        isOpen={showIncidenciaModal}
        onClose={() => setShowIncidenciaModal(false)}
        title="Registrar Ausencia"
      >
        <div className="space-y-8">
          <div className="text-center">
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900">Registro de Ausencia</h3>
            {/* Hora Madrid y ubicación */}
            <div className="mt-3 flex flex-col items-center gap-1 text-sm text-gray-700">
              <div>
                <span className="font-semibold">Hora (Madrid):</span> {madridDate} {madridTime}
              </div>
              <div className="max-w-[720px] px-4">
                <span className="font-semibold">Ubicación:</span> {loadingModalLocation ? 'Obteniendo ubicación...' : (modalAddress || (modalCoords ? `${modalCoords.latitude.toFixed(5)}, ${modalCoords.longitude.toFixed(5)}` : 'Sin ubicación'))}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl bg-white/10">
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-gray-700">Elige el tipo de ausencia que mejor se adapte a tu situación</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() =>
                  setIncidenciaForm(f => ({
                    ...f,
                    tipo: 'Salida del Centro',
                    permisoFechaInicio: '',
                    permisoFechaFin: ''
                  }))
                }
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl ${incidenciaForm.tipo === 'Salida del Centro' ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white' : 'bg-white/90 text-orange-700 border-2 border-orange-300/50 hover:border-orange-400'}`}>
                <div className="text-center">
                  <span className="text-3xl block mb-2">🚶‍♂️</span>
                  <div className="text-lg font-extrabold">Salida del Centro</div>
                  <div className={`text-xs mt-1 ${incidenciaForm.tipo === 'Salida del Centro' ? 'text-white/90' : 'text-orange-600'}`}>Salir temporalmente</div>
                </div>
              </button>
              <button
                onClick={() =>
                  setIncidenciaForm(f => ({
                    ...f,
                    tipo: 'Regreso al Centro',
                    permisoFechaInicio: '',
                    permisoFechaFin: ''
                  }))
                }
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl ${incidenciaForm.tipo === 'Regreso al Centro' ? 'bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 text-white' : 'bg-white/90 text-blue-700 border-2 border-blue-300/50 hover:border-blue-400'}`}>
                <div className="text-center">
                  <span className="text-3xl block mb-2">🔄</span>
                  <div className="text-lg font-extrabold">Regreso al Centro</div>
                  <div className={`text-xs mt-1 ${incidenciaForm.tipo === 'Regreso al Centro' ? 'text-white/90' : 'text-blue-600'}`}>Ya regresé</div>
                </div>
              </button>
              <button
                onClick={() =>
                  setIncidenciaForm(f => ({
                    ...f,
                    tipo: 'Salida Sin Regreso',
                    permisoFechaInicio: '',
                    permisoFechaFin: ''
                  }))
                }
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl ${incidenciaForm.tipo === 'Salida Sin Regreso' ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white' : 'bg-white/90 text-purple-700 border-2 border-purple-300/50 hover:border-purple-400'}`}>
                <div className="text-center">
                  <span className="text-3xl block mb-2">🏠</span>
                  <div className="text-lg font-extrabold">Salida Sin Regreso</div>
                  <div className={`text-xs mt-1 ${incidenciaForm.tipo === 'Salida Sin Regreso' ? 'text-white/90' : 'text-purple-600'}`}>No regresa hoy</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setIncidenciaForm(f => ({
                    ...f,
                    tipo: 'Permiso Retribuido',
                    permisoFechaInicio: f.permisoFechaInicio || today,
                    permisoFechaFin: f.permisoFechaFin || today
                  }));
                }}
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl ${
                  incidenciaForm.tipo === 'Permiso Retribuido'
                    ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 text-white'
                    : 'bg-white/90 text-emerald-700 border-2 border-emerald-300/50 hover:border-emerald-400'
                }`}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">💼</span>
                  <div className="text-lg font-extrabold">Permiso Retribuido</div>
                  <div
                    className={`text-xs mt-1 ${
                      incidenciaForm.tipo === 'Permiso Retribuido'
                        ? 'text-white/90'
                        : 'text-emerald-600'
                    }`}
                  >
                    Ausencia aprobada y remunerada
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          {/* Info message despre Asunto Propio */}
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-xl">ℹ️</span>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  <strong>Asunto Propio:</strong> No requiere un registro suplementario si se ha solicitado correctamente en el sistema de solicitudes.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl bg-white/10">
            <div className="text-center mb-6">
              <h4 className="text-xl sm:text-2xl font-black text-gray-900">Motivo de la Ausencia</h4>
              <p className="text-sm text-gray-600 font-medium">Describe el motivo de tu ausencia</p>
            </div>
            <div className="mt-2">
              <label htmlFor="incidencia-motivo-textarea" className="block text-sm font-bold text-gray-700 mb-2">
                Escribe el motivo {incidenciaForm.tipo === 'Salida del Centro' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="incidencia-motivo-textarea"
                name="motivo"
                value={incidenciaForm.motivo}
                onChange={(e) => setIncidenciaForm(f => ({ ...f, motivo: e.target.value }))}
                placeholder={incidenciaForm.tipo === 'Salida del Centro' ? "El motivo es obligatorio para Salida del Centro..." : "Describe el motivo de la ausencia..."}
                className={`w-full px-4 py-2 border-2 rounded-xl focus:outline-none focus:ring-4 focus:border-orange-400 bg-white/80 backdrop-blur-sm focus:bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg resize-none ${
                  incidenciaForm.tipo === 'Salida del Centro' 
                    ? 'border-orange-400 focus:ring-orange-300/50' 
                    : 'border-orange-200/50 focus:ring-orange-300/50'
                }`}
                rows="2"
                required={incidenciaForm.tipo === 'Salida del Centro'}
              />
              {incidenciaForm.tipo === 'Salida del Centro' && (
                <p className="text-xs text-red-600 mt-1 font-medium">* Campo obligatorio</p>
              )}
            </div>
            {incidenciaForm.tipo === 'Permiso Retribuido' && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="permiso-fecha-inicio" className="block text-sm font-bold text-gray-700 mb-2">
                    Fecha inicio del permiso
                  </label>
                  <Input
                    id="permiso-fecha-inicio"
                    type="date"
                    value={incidenciaForm.permisoFechaInicio}
                    onChange={(e) =>
                      setIncidenciaForm(f => ({
                        ...f,
                        permisoFechaInicio: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2 border-2 border-emerald-200/50 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-300/50 focus:border-emerald-400 bg-white/80 backdrop-blur-sm focus:bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg"
                  />
                </div>
                <div>
                  <label htmlFor="permiso-fecha-fin" className="block text-sm font-bold text-gray-700 mb-2">
                    Fecha fin del permiso
                  </label>
                  <Input
                    id="permiso-fecha-fin"
                    type="date"
                    value={incidenciaForm.permisoFechaFin}
                    min={incidenciaForm.permisoFechaInicio || undefined}
                    onChange={(e) =>
                      setIncidenciaForm(f => ({
                        ...f,
                        permisoFechaFin: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2 border-2 border-emerald-200/50 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-300/50 focus:border-emerald-400 bg-white/80 backdrop-blur-sm focus:bg-white transition-all duration-300 font-medium text-gray-800 shadow-lg"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-2">
            <button onClick={() => setShowIncidenciaModal(false)} disabled={isSubmittingIncidencia} className="px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-2xl bg-white/80 text-gray-600 border-2 border-gray-200/50">Cancelar</button>
            <button onClick={handleSubmitIncidencia} disabled={isSubmittingIncidencia} className="px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-2xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 text-white">{isSubmittingIncidencia ? 'Registrando...' : 'Registrar Ausencia'}</button>
          </div>
        </div>
      </Modal>
      

      
      {/* Dialog de Confirmare pentru Ștergere */}
      {deleteConfirmDialog.isOpen && (
        <Notification
          type="error"
          title="Confirmar Eliminación"
          message="¿Seguro que quieres borrar este registro? Esta acción no se puede deshacer."
          isConfirmDialog={true}
          onConfirm={() => {
            confirmDelete();
            setDeleteConfirmDialog({ isOpen: false, registroIndex: null });
          }}
          onCancel={() => setDeleteConfirmDialog({ isOpen: false, registroIndex: null })}
          confirmText="Eliminar"
          cancelText="Cancelar"
          duration={0}
        />
      )}
      
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