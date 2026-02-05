import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContextBase';
import { useLocation } from '../contexts/LocationContextBase';
import { useApi } from '../hooks/useApi';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { usePermissions } from '../hooks/usePermissions';
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
import { debug as loggerDebug, warn, error as logError, success, demo, info } from '../utils/logger';
import ConfirmarJornadaModal from '../components/ConfirmarJornadaModal';

// Cache global pentru checkConfirmation - previne apeluri duplicate pentru aceeași combinație codigo + data
const checkConfirmationCache = new Map(); // key: "codigo_data", value: { promise, timestamp, result }
const CACHE_DURATION = 5 * 60 * 1000; // 5 minute cache pentru a preveni apeluri duplicate

// Flag global pentru a preveni apelurile simultane de checkConfirmation
let isCheckingConfirmation = false;
const CHECK_CONFIRMATION_DEBOUNCE = 2000; // 2 secunde debounce între apeluri
let lastCheckTime = 0;

// Funcție helper pentru a obține sau crea un promise pentru checkConfirmation
// IMPORTANT: Această funcție trebuie să primească isAuthenticated pentru a preveni apelurile după logout
const getCheckConfirmationPromise = (callApi, codigo, data, isAuthenticated = true) => {
  // Dacă utilizatorul nu este autentificat, nu facem apelul
  if (!isAuthenticated) {
    return Promise.reject(new Error('User not authenticated'));
  }
  
  const cacheKey = `${codigo}_${data}`;
  const now = Date.now();
  
  // Verifică dacă există un cache valid (nu mai vechi de 5 minute)
  const cached = checkConfirmationCache.get(cacheKey);
  if (cached) {
    // Dacă cache-ul este încă valid (mai puțin de 5 minute), returnăm rezultatul sau promise-ul
    if (now - cached.timestamp < CACHE_DURATION) {
      // Dacă avem deja rezultatul, returnăm un promise rezolvat cu rezultatul
      if (cached.result) {
        return Promise.resolve(cached.result);
      }
      // Altfel, returnăm promise-ul în curs
      return cached.promise;
    } else {
      // Cache-ul a expirat, ștergem
      checkConfirmationCache.delete(cacheKey);
    }
  }
  
  // Creăm un nou promise și îl adăugăm în cache
  const promise = callApi(routes.checkConfirmation(codigo, data))
    .then(result => {
      // Salvează rezultatul în cache pentru reuse
      const cached = checkConfirmationCache.get(cacheKey);
      if (cached) {
        cached.result = result;
      }
      return result;
    })
    .catch(error => {
      // La eroare 401 (Unauthorized), ștergem cache-ul și nu mai încercăm
      if (error?.response?.status === 401 || error?.status === 401) {
        // Ștergem toate cache-urile pentru a preveni apelurile duplicate după logout
        checkConfirmationCache.clear();
        return Promise.reject(new Error('Unauthorized - user logged out'));
      }
      // La alte erori, ștergem doar cache-ul pentru acest codigo+data
      checkConfirmationCache.delete(cacheKey);
      throw error;
    });
  
  // Salvează promise-ul și timestamp-ul în cache
  checkConfirmationCache.set(cacheKey, { promise, timestamp: now, result: null });
  
  return promise;
};

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
  loggerDebug('calculateDaysFromCombinedDate called with:', fechaCombinada);
  if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') {
    loggerDebug('Empty fecha, returning 0');
    return 0;
  }
  try {
    // Verifică dacă FECHA conține " - " (format combinat)
    if (fechaCombinada.includes(' - ')) {
      const [fechaInicio, fechaFin] = fechaCombinada.split(' - ');
      loggerDebug('Split dates:', fechaInicio, fechaFin);
      const start = new Date(fechaInicio.trim());
      const end = new Date(fechaFin.trim());
      loggerDebug('Parsed dates:', start, end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        loggerDebug('Invalid dates, returning 0');
        return 0;
      }
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      loggerDebug('Calculated days:', days);
      return days;
    }
    // Dacă nu e format combinat, returnează 1 zi
    loggerDebug('Not combined format, returning 1');
    return 1;
  } catch (error) {
    loggerDebug('Error calculating days:', error);
    return 0;
  }
}

// Funcție pentru formatarea datelor cu liniuță
function formatDateRange(fechaCombinada) {
  loggerDebug('formatDateRange called with:', fechaCombinada);
  if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') {
    loggerDebug('Empty fecha, returning —');
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
      loggerDebug('Split dates for formatting:', fechaInicio, fechaFin);
      
      // Verifică dacă este aceeași dată
      if (fechaInicio.trim() === fechaFin.trim()) {
        // Dacă este aceeași dată, returnează doar data formatată o singură dată
        const formatted = fechaInicio.trim().split('-').reverse().join('/');
        loggerDebug('Single date (same start/end):', formatted);
        return formatted;
      }
      
      const startFormatted = fechaInicio.trim().split('-').reverse().join('/');
      const endFormatted = fechaFin.trim().split('-').reverse().join('/');
      const result = `${startFormatted} - ${endFormatted}`;
      loggerDebug('Formatted interval result:', result);
      return result;
    }
    
    // Dacă nu e format combinat, formatează data normală
    const result = fechaNormalized.split('-').reverse().join('/');
    loggerDebug('Single date formatted:', result);
    return result;
  } catch (error) {
    loggerDebug('Error formatting date:', error);
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
  'Ausencias justificada',
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
      } catch {
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
        demo('Using local time instead of worldtimeapi');
        baseEpoch = Date.now();
        basePerf = performance.now();
        update();
        setSyncing(false);
        return;
      }
      
      // Folosim ora locală convertită la timezone-ul Europe/Madrid (fără request extern)
      // JavaScript nativ poate calcula ora în orice timezone fără API extern
      // Eliminăm request-ul către worldtimeapi.org pentru a evita erorile de conexiune
      baseEpoch = Date.now();
      basePerf = performance.now();
      update();
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

// Component pentru item-ul de ausencia pe mobile (compact, similar cu TimeCheck)
function MobileAusenciaItem({ item, getAusenciaDurationDisplay, formatDateRange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const durationDisplay = getAusenciaDurationDisplay(item);
  
  // Formatează data
  const formattedDate = item.FECHA 
    ? formatDateRange(item.FECHA) 
    : (item.fecha_inicio && item.fecha_fin 
      ? formatDateRange(`${item.fecha_inicio} - ${item.fecha_fin}`)
      : (item.data ? item.data.split('-').reverse().join('/') : '—'));
  
  // Determină tipul și culoarea
  const getTipoColor = () => {
    if (item.tipo === 'Salida del Centro') return 'bg-orange-500';
    if (item.tipo === 'Regreso al Centro') return 'bg-blue-500';
    return 'bg-purple-500';
  };
  
  // Scurtează tipul pentru afișare compactă
  const getTipoShort = () => {
    if (item.tipo === 'Salida del Centro') return 'Sal.';
    if (item.tipo === 'Regreso al Centro') return 'Reg.';
    return item.tipo?.substring(0, 4) || 'Aus.';
  };
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (portocaliu/albastru/violet) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getTipoColor()}`}></div>
        
        {/* Data - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate.length > 12 ? formattedDate.substring(0, 12) + '...' : formattedDate}
        </span>
        
        {/* Duration - text mic */}
        <span className={`text-[10px] font-medium min-w-[45px] ${
          durationDisplay.isDayBased 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-purple-600 dark:text-purple-400'
        }`}>
          {durationDisplay.text}
        </span>
        
        {/* Tipo - text mic, scurtat */}
        <span className="text-[11px] font-semibold flex-1 text-gray-700 dark:text-gray-300">
          {getTipoShort()}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              {item.tipo}
            </span>
          </div>
          
          {/* Duration complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {durationDisplay.isDayBased ? '📅' : '⏱️'} Duración:
            </span>
            <span className={`text-[10px] font-medium ${
              durationDisplay.isDayBased 
                ? 'text-blue-700 dark:text-blue-300' 
                : 'text-purple-700 dark:text-purple-300'
            }`}>
              {durationDisplay.text}
            </span>
          </div>
          
          {/* Motivo */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mb-1">📝 Motivo</div>
            <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">
              {item.motivo || 'Sin motivo especificado'}
            </p>
          </div>
          
          {/* Locație */}
          {item.locatia && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1">📍 Ubicación</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words mb-2">
                {item.locatia}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const encodedAddress = encodeURIComponent(item.locatia);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                🌍 Ver en Google Maps
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Component pentru item-ul de registru pe mobile (compact, similar cu TimeCheck)
function MobileRegistroItem({ item, authUser, isManager, callApi, setNotification, fetchLogs, selectedMonth, setConfirmarJornadaData, setShowConfirmarJornadaModal, routes }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedDate = item.data ? item.data.split('-').reverse().join('/') : '—';
  const isEntrada = item.tipo === 'Entrada';
  
  const handleRegularizar = async (e) => {
    e.stopPropagation();
    try {
      const employeeCodigo = item.codigo || item.CODIGO;
      const userCodigo = authUser?.CODIGO || authUser?.codigo;
      const isOwnRecord = employeeCodigo && userCodigo && employeeCodigo.toString() === userCodigo.toString();
      
      if (isManager && !isOwnRecord) {
        const result = await callApi(routes.requestRegularizacion, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
            fecha: item.data,
          }),
        });
        if (result.success) {
          setNotification({
            type: 'success',
            title: 'Regularización solicitada',
            message: 'El empleado recibirá una notificación para confirmar.',
          });
          fetchLogs(selectedMonth).catch(err => {
            console.error('Error reloading logs:', err);
          });
        }
      } else {
        const checkResult = await getCheckConfirmationPromise(callApi, item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo, item.data, !!authUser);
        const resultData = checkResult.data || checkResult;
        
        // Verifică dacă există program prevăzut (scheduled_minutes > 0) și dacă necesită confirmare
        if (checkResult.success && resultData.needs_confirmation && resultData.scheduled_minutes > 0) {
          setConfirmarJornadaData({
            ...resultData,
            fecha: item.data,
            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
          });
          setShowConfirmarJornadaModal(true);
        } else if (checkResult.success && resultData.scheduled_minutes === 0) {
          // Nu există program prevăzut - nu se permite regularizarea
          setNotification({
            type: 'info',
            title: 'No se puede regularizar',
            message: 'No hay horario previsto para este día. No se puede regularizar.',
          });
        } else {
          setNotification({
            type: 'error',
            title: 'Error',
            message: 'No se pudo verificar la diferencia. Intenta de nuevo.',
          });
        }
      }
    } catch (err) {
      console.error('Error regularizando:', err);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al solicitar regularización. Intenta de nuevo.',
      });
    }
  };
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/roșu) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isEntrada ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        
        {/* Data - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate}
        </span>
        
        {/* Timp - text mic */}
        <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold min-w-[50px]">
          {item.hora}
        </span>
        
        {/* Tipo - text mic, scurtat */}
        <span className={`text-[11px] font-semibold flex-1 ${
          isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
        }`}>
          {isEntrada ? 'E' : 'S'}
        </span>
        
        {/* Duration (doar pentru Salida) - text foarte mic */}
        {item.tipo === 'Salida' && item.duration && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 min-w-[45px]">
            {item.duration}
          </span>
        )}
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className={`text-[10px] font-semibold ${
              isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {item.tipo}
            </span>
          </div>
          
          {/* Duration detaliat (pentru Salida) */}
          {item.tipo === 'Salida' && (
            <div className="space-y-1">
              {item.duration && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">⏱ Registrado:</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300">{item.duration}</span>
                </div>
              )}
              {item.effective_duration && item.effective_duration.trim() !== '' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-green-600 dark:text-green-400">✅ Efectivo:</span>
                  <span className="text-[10px] text-green-700 dark:text-green-300 font-medium">{item.effective_duration}</span>
                </div>
              )}
              {!item.duration && (!item.effective_duration || item.effective_duration.trim() === '') && (
                <span className="text-[10px] text-red-600 dark:text-red-400">⚠️ Sin duración</span>
              )}
              {/* Buton Regularizar */}
              {item.duration && 
                !(item.effective_duration && item.effective_duration.trim() !== '') && 
                !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1') && (
                <button
                  onClick={handleRegularizar}
                  className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors"
                >
                  🔄 Regularizar
                </button>
              )}
            </div>
          )}
          
          {/* Locație */}
          {(item.address || item.loc) && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">📍 Ubicación</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">
                {item.address || `${item.loc?.latitude?.toFixed(5)}, ${item.loc?.longitude?.toFixed(5)}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente para el fichaje personal (Mi Fichaje)
function MiFichajeScreen({ onFicharIncidencia, incidenciaMessage, onLogsUpdate, setNotification, horarioAsignado, loadingHorario, cuadranteAsignado, loadingCuadrante, isTimeWithinSchedule, getTimeRestrictionMessage, horarioMulticentroAsignado = null }) {
  const { t } = useTranslation();
  const { user: authUser, isAuthenticated } = useAuth();
  const { callApi } = useApi();
  const { isMobile } = useBreakpoint();
  
  // Calculează orarul zilei curente (similar cu componenta părinte, dar folosind props-urile)
  const currentDaySchedule = useMemo(() => {
    if (cuadranteAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        if (daySchedule.includes(',')) {
          const matches = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g);
          if (matches && matches.length > 0) {
            return matches.map(match => match).join(' / ');
          }
        } else {
          const match = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
          if (match) {
            return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
          }
        }
      }
      return null;
    } else if (horarioMulticentroAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = horarioMulticentroAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '' && daySchedule !== '0' && daySchedule !== '0h') {
        if (typeof daySchedule === 'string' && daySchedule.includes('-')) {
          const match = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
          if (match) {
            return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
          }
        } else if (typeof daySchedule === 'string' && !isNaN(parseFloat(daySchedule))) {
          const hours = parseFloat(daySchedule);
          return `${hours}h`;
        }
      }
      return null;
    } else if (horarioAsignado && horarioAsignado.days) {
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      
      if (!daySchedule) {
        return null;
      }
      
      const intervals = [];
      const isValidTime = (time) => {
        return typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time);
      };
      
      if (isValidTime(daySchedule.in1) && isValidTime(daySchedule.out1)) {
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
      
      if (intervals.length > 0) {
        return intervals.join(' / ');
      }
      
      return null;
    }
    return null;
  }, [cuadranteAsignado, horarioMulticentroAsignado, horarioAsignado]);

  // Funcție pentru a calcula orele zilnice din orarul curent
  const getCurrentDayHours = () => {
    if (cuadranteAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        // Folosește helper-ul comun pentru calculul orelor (suportă ambele formate: T1 07:00-15:00 și "12")
        const hours = calculateCuadranteHours(daySchedule);
        return hours > 0 ? hours.toFixed(2) : '0.00';
      }
      return '0.00';
    } else if (horarioMulticentroAsignado) {
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = horarioMulticentroAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '' && daySchedule !== '0' && daySchedule !== '0h') {
        // Folosește helper-ul comun pentru calculul orelor (suportă ambele formate: T1 07:00-15:00 și "12")
        const hours = calculateCuadranteHours(daySchedule);
        return hours > 0 ? hours.toFixed(2) : '0.00';
      }
      return '0.00';
    } else if (horarioAsignado && horarioAsignado.days) {
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      
      if (daySchedule) {
        const hours = calculateHorarioHours(daySchedule);
        return hours > 0 ? hours.toFixed(2) : '0.00';
      }
    }
    return '0.00';
  };
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;
  const [logs, setLogs] = useState([]);
  const [now, setNow] = useState(new Date());
  // Hora oficial Madrid pentru ceasul principal (cu resync periodic)
  const { timeStr: madridTimeStr, epochMs: madridNowMs } = useMadridClock(5 * 60 * 1000, authUser);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [fichando, setFichando] = useState(false);
  const [lastFichaje, setLastFichaje] = useState(null);
  // State pentru ultimul marcaj global (indiferent de lună) - folosit pentru a verifica dacă există un turn deschis
  const [ultimoMarcajeGlobal, setUltimoMarcajeGlobal] = useState(null);
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
    // Folosim locationContextRef.current pentru a evita dependența directă
    const ctx = locationContextRef.current;
    if (ctx?.currentLocation) {
      info('Fichaje: Using existing cached location');
      locationRequestedOnMountRef.current = true;
      return;
    }

    const requestLocationOnPageAccess = async () => {
      try {
        locationRequestedOnMountRef.current = true; // Marchează că am cerut deja
        info('Fichaje page accessed - requesting location (using cache if available)...');
        // Cere locația folosind contextul global prin ref pentru a evita dependența în useEffect
        // maximumAge: 600000 (10 min) înseamnă că dacă avem locație cache-uită mai recentă de 10 min, o folosește
        // Browser-ul returnează locația cached fără să activeze GPS-ul, reducând warning-urile
        const ctx = locationContextRef.current;
        await ctx.getCurrentLocation();
        success('Location obtained on Fichaje page access');
      } catch (error) {
        warn('Could not get location on page access:', error);
        locationRequestedOnMountRef.current = false; // Permite retry dacă eșuează
        // Nu aruncăm eroare - continuăm fără locație, utilizatorul poate încerca din nou la check-in
      }
    };

    // Cere locația când se montează componenta (la accesarea paginii)
    requestLocationOnPageAccess();
    // Empty deps array - rulează doar la mount (o singură dată)
    // locationContext este accesat prin locationContextRef.current pentru a evita dependența
  }, []); // locationContextRef este un ref stabil, currentLocation este folosit doar pentru verificare inițială

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
  
  // State pentru modal "Anunciar Baja Médica"
  const [showBajaMedicaModal, setShowBajaMedicaModal] = useState(false);
  const [bajaMedicaForm, setBajaMedicaForm] = useState({
    fechaBaja: '',
    fechaAlta: '',
    tipo: '',
    recaida: false,
  });
  const [bajaMedicaDocumento, setBajaMedicaDocumento] = useState(null); // Fișier pentru baja médica
  const [submittingBajaMedica, setSubmittingBajaMedica] = useState(false);
  
  // State pentru festivos
  const [festivos, setFestivos] = useState([]);
  const [isTodayFestivo, setIsTodayFestivo] = useState(false);

  // State pentru modal-ul de confirmare fichaje
  const [showFichajeConfirmModal, setShowFichajeConfirmModal] = useState(false);
  const [fichajeTipo, setFichajeTipo] = useState('');
  const [fichajeCustomMotivo, setFichajeCustomMotivo] = useState('');
  const [showConfirmarJornadaModal, setShowConfirmarJornadaModal] = useState(false);
  const [confirmarJornadaData, setConfirmarJornadaData] = useState(null);
  // State pentru a stoca dacă fiecare fichaje necesită regularizare (pentru a ascunde butonul când nu este necesar)
  // eslint-disable-next-line no-unused-vars
  const [_needsRegularizationMap, setNeedsRegularizationMap] = useState({});

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
    const now = new Date();
    // Folosește data locală, nu UTC, pentru a evita problemele de timezone
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`; // YYYY-MM-DD (local timezone)

    // Comparăm doar date (fără oră) ca să putem include corect ziua de "Fecha alta"
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    loggerDebug('Checking absence status for today:', todayStr);
    loggerDebug('Available ausencias:', ausencias);
    
    // Verifică mai întâi baja médica (prioritate)
    let currentBaja = null;
    if (bajasMedicas && bajasMedicas.length > 0) {
      currentBaja = bajasMedicas.find((baja) => {
        if (!baja || typeof baja !== 'object') return false;
        
        const fechaInicio = baja.fecha_inicio || baja.fechaInicio || baja.FECHA_INICIO || baja['Fecha baja'] || baja['Fecha Baja'] || baja['Fecha de baja'] || baja.fecha_baja || baja.fechaBaja || baja['FECHA BAJA'] || '';
        const fechaFin = baja.fecha_fin || baja.fechaFin || baja.FECHA_FIN || baja['Fecha de alta'] || baja['Fecha de Alta'] || baja['Fecha alta'] || baja['Fecha Alta'] || baja.fecha_alta || baja.fechaAlta || baja['FECHA ALTA'] || '';
        
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
          if (todayDate > finDate) {
            success('Baja médica cu fecha_alta în trecut - nu este activă:', { fechaFin: fin, today: todayStr });
            return false;
          }
          
          // Verifică dacă ziua curentă este în intervalul [inicio, fin] (inclusiv fin)
        return todayDate >= inicioDate && todayDate <= finDate;
        } else {
          // Dacă nu există fechaFin, consideră activă până în prezent
          return todayDate >= inicioDate;
        }
      });
    }
    
    if (currentBaja) {
      setIsOnBajaMedica(true);
      setIsOnVacationOrAbsence(true);
      setCurrentAbsenceType('Baja Médica');
      setCurrentBajaMedica({
        startDate: normalizeDateInput(currentBaja.fecha_inicio || currentBaja.fechaInicio || currentBaja.FECHA_INICIO || currentBaja['Fecha baja'] || currentBaja['Fecha Baja'] || currentBaja['Fecha de baja'] || currentBaja.fecha_baja || currentBaja.fechaBaja || currentBaja['FECHA BAJA'] || ''),
        endDate: normalizeDateInput(currentBaja.fecha_fin || currentBaja.fechaFin || currentBaja.FECHA_FIN || currentBaja['Fecha de alta'] || currentBaja['Fecha de Alta'] || currentBaja['Fecha alta'] || currentBaja['Fecha Alta'] || currentBaja.fecha_alta || currentBaja.fechaAlta || currentBaja['FECHA ALTA'] || ''),
        situacion: currentBaja.Situacion || currentBaja.situacion || currentBaja['Situación'] || currentBaja.estado || '',
        motivo: currentBaja.Motivo || currentBaja.motivo || 'Baja médica'
      });
      warn('Utilizatorul este în baja médica:', currentBaja);
      return;
    }
    
    setIsOnBajaMedica(false);
    setCurrentBajaMedica(null);
    
    // Caută în ausencias pentru ziua curentă
    const currentAbsence = ausencias.find(a => {
      const ausenciaFecha = a.FECHA || a.fecha || a.data;
      const fechaInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;
      const fechaFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;
      
      loggerDebug('Checking ausencia:', {
        ausenciaFecha,
        fechaInicio,
        fechaFin,
        TIPO: a.TIPO || a.tipo
      });
      
      // Verifică data exactă
      if (ausenciaFecha && ausenciaFecha.startsWith(todayStr)) {
        success('Found exact date match:', ausenciaFecha);
        return true;
      }
      
      // Verifică interval de date
      if (fechaInicio && fechaFin) {
        // Normalizează datele pentru a compara doar partea de dată (YYYY-MM-DD)
        const inicioDateStr = fechaInicio.split('T')[0]; // Ia doar partea de dată, ignoră ora
        const finDateStr = fechaFin.split('T')[0];
        
        // Dacă absența este pe o singură zi (fechaInicio === fechaFin), verifică doar dacă este exact ziua de astăzi
        if (inicioDateStr === finDateStr) {
          const isExactMatch = todayStr === inicioDateStr;
          loggerDebug('Single day check:', {
            inicioDateStr,
            finDateStr,
            today: todayStr,
            isExactMatch
          });
          return isExactMatch;
        }
        
        // Pentru absențe pe mai multe zile, verifică intervalul
        const todayDateOnly = new Date(todayDate);
        const inicioDateOnly = new Date(inicioDateStr);
        const finDateOnly = new Date(finDateStr);
        
        // Setează ora la 00:00:00 pentru comparație corectă
        inicioDateOnly.setHours(0, 0, 0, 0);
        finDateOnly.setHours(23, 59, 59, 999); // Include toată ziua de sfârșit
        todayDateOnly.setHours(0, 0, 0, 0);
        
        const isInRange = todayDateOnly >= inicioDateOnly && todayDateOnly <= finDateOnly;
        loggerDebug('Range check:', {
          inicioDateStr,
          finDateStr,
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
        const todayDateOnly = new Date(todayDate);
        const inicioDateOnly = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const finDateOnly = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
        
        const isInRange = todayDateOnly >= inicioDateOnly && todayDateOnly <= finDateOnly;
        loggerDebug('Range check from ausenciaFecha:', {
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
      warn('Utilizatorul este în absență:', absenceType, currentAbsence);
    } else {
      setIsOnVacationOrAbsence(false);
      setCurrentAbsenceType('');
      success('Utilizatorul nu este în absență pentru ziua curentă');
    }
  }, [ausencias, bajasMedicas, normalizeDateInput]);


  // Funcție pentru a încărca festivos pentru anul curent
  const fetchFestivos = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const url = `${routes.getFestivos}?accion=get&ano=${currentYear}`;
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      loggerDebug('🔍 Fetching festivos from:', url);
      const res = await fetch(url, { headers });
      const data = await res.json();
      const festivosList = Array.isArray(data) ? data : [];
      loggerDebug('✅ Festivos loaded for year', currentYear, ':', festivosList.length, 'festivos');
      loggerDebug('📋 Festivos list:', festivosList);
      setFestivos(festivosList);
    } catch (error) {
      logError('❌ Error fetching festivos:', error);
      setFestivos([]);
    }
  }, []);
  
  // Verifică dacă ziua curentă este festivo
  const checkTodayFestivo = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    loggerDebug('🔍 Checking if today is festivo:', todayStr);
    loggerDebug('🔍 Festivos list:', festivos);
    loggerDebug('🔍 Festivos count:', festivos.length);
    
    const isFestivo = festivos.some(festivo => {
      const festivoDate = festivo.date || festivo.fecha || festivo.DATE || festivo.FECHA;
      const observedDate = festivo.observed_date || festivo.fechaObservada || festivo.OBSERVED_DATE || festivo.FECHA_OBSERVADA;
      
      loggerDebug('🔍 Checking festivo:', { festivoDate, observedDate, festivo });
      
      // Verifică data oficială sau data observată
      const festivoDateStr = festivoDate ? normalizeDateInput(festivoDate) : null;
      const observedDateStr = observedDate ? normalizeDateInput(observedDate) : null;
      
      const matches = festivoDateStr === todayStr || observedDateStr === todayStr;
      if (matches) {
        loggerDebug('✅ Found matching festivo:', { festivoDateStr, observedDateStr, todayStr });
      }
      
      return matches;
    });
    
    loggerDebug('🔍 Final result - isTodayFestivo:', isFestivo, 'for date:', todayStr);
    setIsTodayFestivo(isFestivo);
    
    // Log și informații despre TrabajaFestivos
    if (isFestivo) {
      const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
      loggerDebug('🔍 Today is festivo. TrabajaFestivos:', trabajaFestivos);
    }
    
    return isFestivo;
  }, [festivos, normalizeDateInput, authUser]);

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
        
        info('[Fichaje] Folosind backend-ul nou (getBajasMedicas):', url);
        
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

        success(`[Fichaje] Bajas médicas primite din backend: ${listaArray.length} items`);
        setBajasMedicas(listaArray);
      } catch (error) {
        error('Error fetching bajas médicas:', error);
        setBajasMedicas([]);
      }
    }

    fetchBajasMedicasEmpleado();
  }, [authUser]);

  // Verifică statusul de absență când se încarcă ausencias sau bajas médicas
  useEffect(() => {
    loggerDebug('Ausencias loaded:', ausencias.length, 'items');
    loggerDebug('Bajas médicas loaded:', bajasMedicas.length, 'items');
    checkCurrentAbsenceStatus();
  }, [ausencias, bajasMedicas, checkCurrentAbsenceStatus]); // checkCurrentAbsenceStatus este memoizat cu useCallback
  
  // Încarcă festivos pentru anul curent
  useEffect(() => {
    if (authUser && !authUser?.isDemo) {
      fetchFestivos();
    }
  }, [authUser, fetchFestivos]);
  
  // Verifică dacă ziua curentă este festivo când se schimbă festivos
  useEffect(() => {
    if (festivos.length > 0) {
      checkTodayFestivo();
    }
  }, [festivos, checkTodayFestivo]);

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
      demo('Skipping fetchAusencias');
      setLoadingAusencias(false);
      return;
    }
    
    try {
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      if (!userCode) {
        logError('No user code available for fetching ausencias');
        setAusencias([]);
        setLoadingAusencias(false);
        return;
      }

      // Folosim backend-ul nou (fără n8n)
      const url = `${routes.getAusencias}?codigo=${encodeURIComponent(userCode)}`;
      info('[Fichaje] Folosind backend-ul nou (getAusencias):', url);
      
      const token = localStorage.getItem('auth_token');
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const result = await callApi(url, { headers });
      
      if (result.success) {
        const rawData = Array.isArray(result.data) ? result.data : [result.data];
        loggerDebug('Ausencias raw data received:', rawData);
        
        // Mapăm datele pentru a fi siguri că au structura corectă
        const mappedData = rawData.map(item => {
          loggerDebug('Mapping item:', item);
          
          // Caută câmpul pentru oră în toate variantele posibile
          const hora = item.hora || item.HORA || item.time || item.hora_registro || 
                      item.HORA_REGISTRO || item.TIMESTAMP || item.timestamp || 
                      item.HORA_DE_REGISTRO || item.creado_at || item.CREADO_AT || '';
          
          loggerDebug('Found hora:', hora);
          
          const fechaCombinada = item.FECHA || item.fecha || item.data || item.DATA || item.date || '';
          loggerDebug('Found FECHA:', fechaCombinada);
          
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
            loggerDebug('Sorting by ID - A:', a.id, 'B:', b.id);
            return (b.id || 0) - (a.id || 0);
          }
          
          // Verifică dacă datele sunt valide
          if (!a.data || !b.data) {
            loggerDebug('Sorting - invalid data:', { a: a.data, b: b.data });
            return (b.id || 0) - (a.id || 0);
          }
          
          // Combinăm data și ora pentru a crea un timestamp complet
          const dateTimeA = `${a.data} ${a.hora}`;
          const dateTimeB = `${b.data} ${b.hora}`;
          
          loggerDebug('Sorting - A:', dateTimeA, 'B:', dateTimeB);
          
          // Încearcă să parseze data în format ISO
          let dateA, dateB;
          
          try {
            // Dacă data este în format YYYY-MM-DD, adaugă T pentru ISO
            const isoA = a.data.includes('T') ? dateTimeA : `${a.data}T${a.hora}`;
            const isoB = b.data.includes('T') ? dateTimeB : `${b.data}T${b.hora}`;
            
            dateA = new Date(isoA);
            dateB = new Date(isoB);
            
            loggerDebug('Sorting - dateA:', dateA, 'dateB:', dateB);
            loggerDebug('Sorting - dateB - dateA:', dateB - dateA);
            
            // Sortăm descendent (cele mai recente primul)
            return dateB - dateA;
          } catch (error) {
            error('Sorting error:', error);
            // Fallback la sortare după ID
            return (b.id || 0) - (a.id || 0);
          }
        });
        
        loggerDebug('Ausencias mapped and sorted data:', sortedData);
        
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
        
        loggerDebug('Total ausencia duration:', totalDuration, 'seconds:', totalSeconds);
        setTotalAusenciaDuration(totalDuration);
        
        // Calculează totalul de zile pentru Asunto Propio
        let totalAsuntoPropioDays = 0;
        sortedData.forEach(item => {
          if (item.tipo === 'Asunto Propio') {
            const days = getApprovedDaysCount(item);
            totalAsuntoPropioDays += days;
            loggerDebug('Asunto Propio item:', item.FECHA, 'approved days:', days);
          }
        });
        
        loggerDebug('Total Asunto Propio days:', totalAsuntoPropioDays);
        setTotalAsuntoPropioDays(totalAsuntoPropioDays);
        
        // Calculează totalul de zile pentru Vacaciones
        let totalVacacionesDays = 0;
        sortedData.forEach(item => {
          if (item.tipo === 'Vacaciones') {
            const days = getApprovedDaysCount(item);
            totalVacacionesDays += days;
            loggerDebug('Vacaciones item:', item.FECHA, 'approved days:', days);
          }
        });
        
        loggerDebug('Total Vacaciones days:', totalVacacionesDays);
        setTotalVacacionesDays(totalVacacionesDays);
        
        // Log all ausencias data
        loggerDebug('All ausencias loaded:', sortedData.length, 'items');
        
        setAusencias(sortedData);
      } else {
        logError('Error fetching ausencias:', result.error);
        setAusencias([]);
        setTotalAusenciaDuration(null);
        setTotalAsuntoPropioDays(null);
        setTotalVacacionesDays(null);
      }
    } catch (error) {
      logError('Error fetching ausencias:', error);
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
      loggerDebug('Fetching ausencias for button blocking');
      fetchAusencias();
    }
  }, [isAuthenticated, authUser, fetchAusencias]);

  // Încarcă din nou ausencias când se schimbă tab-ul la "ausencias" pentru afișare
  useEffect(() => {
    loggerDebug('useEffect triggered - activeTab:', activeTab);
    if (activeTab === 'ausencias' && isAuthenticated && authUser) {
      loggerDebug('Refreshing ausencias for display');
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

  // Funcție pentru a obține ultimul marcaj global (indiferent de lună)
  const fetchUltimoMarcajeGlobal = useCallback(async () => {
    const userCode = authUser?.['CODIGO'] || authUser?.codigo;
    if (!userCode) {
      setUltimoMarcajeGlobal(null);
      return;
    }

    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      demo('Skipping fetchUltimoMarcajeGlobal');
      return;
    }

    try {
      const url = `${API_ENDPOINTS.ULTIMO_REGISTRO}?codigo=${encodeURIComponent(userCode)}`;
      const result = await callApi(url);
      if (result.success && result.data) {
        setUltimoMarcajeGlobal(result.data);
        success('Ultimo marcaje global retrieved:', result.data);
      } else {
        setUltimoMarcajeGlobal(null);
      }
    } catch (error) {
      logError('Error fetching ultimo marcaje global:', error);
      setUltimoMarcajeGlobal(null);
    }
  }, [authUser, callApi]);

  // Fetch ultimul marcaj global când se schimbă userCode sau după un fichaje nou
  useEffect(() => {
    fetchUltimoMarcajeGlobal();
  }, [fetchUltimoMarcajeGlobal]);

  const canUseIncidenceExit = useMemo(() => {
    // Permite "Salida para incidencia" dacă există un turn deschis (ultimul marcaj este "Entrada")
    // Acest buton trebuie să fie deblocat pentru a permite închiderea unui turn deschis,
    // chiar dacă butonul normal "Salida" este blocat din cauza restricțiilor de orar
    // Folosim ultimoMarcajeGlobal pentru a verifica indiferent de lună
    if (ultimoMarcajeGlobal) {
      const tipo = ultimoMarcajeGlobal.tipo || ultimoMarcajeGlobal.TIPO;
      // Returnează true dacă ultimul marcaj este "Entrada" (turn deschis)
      // Astfel, utilizatorul poate închide turnul deschis folosind "Salida para incidencia"
      return tipo === 'Entrada';
    }
    
    // Fallback: verifică și în logs dacă ultimoMarcajeGlobal nu este disponibil
    if (!logs || logs.length === 0) return false;
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(`${a.data} ${a.hora}`);
      const dateB = new Date(`${b.data} ${b.hora}`);
      return dateB - dateA;
    });
    const ultimoMarcaje = sortedLogs[0];
    return ultimoMarcaje && ultimoMarcaje.tipo === 'Entrada';
  }, [ultimoMarcajeGlobal, logs]);

  const fetchLogs = useCallback(async (month = selectedMonth) => {
    // IMPORTANT: Verifică autentificarea ÎNAINTE de a face orice apel API
    if (!isAuthenticated || !authUser) {
      loggerDebug('Skipping fetchLogs - user not authenticated');
      setLoadingLogs(false);
      setChangingMonth(false);
      return [];
    }
    
    setLoadingLogs(true);
    setChangingMonth(month !== selectedMonth);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      demo('Skipping fetchLogs');
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
          info('[Fichaje] Folosind backend-ul nou (getRegistros):', url);
          
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
        info('[Fichaje] Folosind backend-ul nou (getRegistros):', url);
        
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
        const mapped = allLogs.map(item => {
          // Debug: verifică dacă există effective_duration în item
          if (item.effective_duration || item.EFFECTIVE_DURATION || item.effective_minutes || item.EFFECTIVE_MINUTES) {
            loggerDebug('🔍 Item with effective_duration:', {
              FECHA: item.FECHA,
              TIPO: item.TIPO,
              effective_duration: item.effective_duration || item.EFFECTIVE_DURATION,
              effective_minutes: item.effective_minutes || item.EFFECTIVE_MINUTES,
            });
          }
          
          return {
            tipo: item.TIPO || item.tipo,
            hora: item.HORA || item.hora,
            address: item.DIRECCION || item.address,
            modificatDe: item.MODIFICADO_POR || item.modificatDe,
            codigo: item.CODIGO || item.codigo,
            duration: item.DURACION || item.duration, // Ora originală
            effective_duration: item.effective_duration || item.EFFECTIVE_DURATION || null, // Ora regularizată
            effective_minutes: item.effective_minutes || item.EFFECTIVE_MINUTES || null, // Minute efective (pentru calcul)
            has_regularizacion: item.has_regularizacion || item.HAS_REGULARIZACION || 0, // 1 dacă există regularizare, 0 altfel
            data: item.FECHA || item.data,
          };
        });

        // Deduplicare: elimină duplicatele după o combinație unică de CODIGO + FECHA + TIPO + HORA
        const uniqueLogs = [];
        const seenKeys = new Set();
        for (const item of mapped) {
          const key = `${item.codigo || item.CODIGO || ''}_${item.data || item.FECHA || ''}_${item.tipo || item.TIPO || ''}_${item.hora || item.HORA || ''}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueLogs.push(item);
          }
        }
        
        // Ordenación correcta: combina fecha y hora para una ordenación cronológica precisa
        const sortedLogs = [...uniqueLogs].sort((a, b) => {
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
        // Calculăm separat: total original (raw DURACION) și total regularizat (effective_minutes)
        let totalOriginalSeconds = 0;
        let totalRegularizedSeconds = 0;
        const effectiveMinutesByDate = {}; // Agregă effective_minutes pe zi (workday_date)
        const rawDurationByDate = {}; // Agregă raw DURACION pe zi (pentru fallback)
        
        // Prima trecere: colectează effective_minutes și raw duration pe zi
        sortedLogs.forEach(item => {
          const fecha = item.data || item.fecha;
          if (!fecha) return;
          
          // Dacă există effective_minutes, salvează pentru acea zi (workday_date = data)
          if (item.effective_minutes !== null && item.effective_minutes !== undefined) {
            if (!effectiveMinutesByDate[fecha]) {
              effectiveMinutesByDate[fecha] = item.effective_minutes;
            }
          }
          
          // Colectează raw duration pentru fiecare Salida (pentru total original)
          if (item.tipo === 'Salida' && item.duration && item.duration !== null && item.duration !== '') {
            const timeParts = item.duration.split(':');
            if (timeParts.length === 3) {
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseInt(timeParts[2]) || 0;
              const itemSeconds = hours * 3600 + minutes * 60 + seconds;
              
              if (!rawDurationByDate[fecha]) {
                rawDurationByDate[fecha] = 0;
              }
              rawDurationByDate[fecha] += itemSeconds;
            }
          }
        });
        
        // Calculează total original (suma tuturor raw DURACION)
        Object.keys(rawDurationByDate).forEach(fecha => {
          totalOriginalSeconds += rawDurationByDate[fecha];
        });
        
        // Calculează total regularizat (effective_minutes când există, altfel raw duration)
        Object.keys(effectiveMinutesByDate).forEach(fecha => {
          // Folosește effective_minutes (regularizat)
          totalRegularizedSeconds += effectiveMinutesByDate[fecha] * 60;
        });
        
        // Pentru zilele fără regularizare, folosește raw duration în total regularizat
        Object.keys(rawDurationByDate).forEach(fecha => {
          if (!effectiveMinutesByDate[fecha]) {
            // Nu există regularizare pentru această zi, folosește raw duration
            totalRegularizedSeconds += rawDurationByDate[fecha];
          }
        });
        
        // Convertește înapoi în format HH:MM:SS
        const formatSecondsToHHMMSS = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const totalOriginalDuration = formatSecondsToHHMMSS(totalOriginalSeconds);
        const totalRegularizedDuration = formatSecondsToHHMMSS(totalRegularizedSeconds);
        
        loggerDebug('Total original:', totalOriginalDuration, 'seconds:', totalOriginalSeconds);
        loggerDebug('Total regularizat:', totalRegularizedDuration, 'seconds:', totalRegularizedSeconds);
        
        // Setăm ambele totaluri (folosim un obiect pentru a păstra ambele)
        setTotalFichajeDuration({
          original: totalOriginalDuration,
          regularized: totalRegularizedDuration,
          hasRegularization: Object.keys(effectiveMinutesByDate).length > 0
        });

        setLogs(sortedLogs);
        
        // Verifică asincron pentru fiecare fichaje dacă necesită regularizare (doar pentru Salida fără effective_duration)
        // IMPORTANT: Nu așteptăm toate request-urile - actualizăm map-ul incremental pentru a nu bloca UI-ul
        // IMPORTANT: Resetăm loading-ul imediat după ce datele sunt procesate, înainte de verificările asincrone
        setLoadingLogs(false);
        setChangingMonth(false);
        
        // IMPORTANT: Verifică autentificarea ÎNAINTE de a procesa itemsToCheck
        // IMPORTANT: Debounce pentru a preveni apelurile repetate
        if (!isAuthenticated || !authUser) {
          loggerDebug('Skipping check confirmation - user not authenticated (fetchLogs)');
          return sortedLogs;
        } else {
          const now = Date.now();
          // Verifică dacă trebuie să așteptăm (debounce)
          if (isCheckingConfirmation || (now - lastCheckTime < CHECK_CONFIRMATION_DEBOUNCE)) {
            loggerDebug('Skipping check confirmation - debounce active or already checking');
            return sortedLogs;
          }
          
          const itemsToCheck = sortedLogs.filter(item => 
            item.tipo === 'Salida' && 
            item.duration && 
            !(item.effective_duration && item.effective_duration.trim() !== '') && 
            !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1')
          );
          
          // Dacă nu există items de verificat, nu facem apeluri
          if (itemsToCheck.length === 0) {
            loggerDebug('No items to check for confirmation');
            return sortedLogs;
          }
          
          // DEDUPLICARE: Un singur apel API per codigo + data (nu per registru)
          // Folosim un Set pentru a stoca combinațiile unice de codigo + data
          const uniqueChecks = new Map();
          const userCodigo = authUser?.CODIGO || authUser?.codigo;
          for (const item of itemsToCheck) {
            const codigo = item.codigo || item.CODIGO || userCodigo;
            const data = item.data;
            if (codigo && data) {
              const uniqueKey = `${codigo}_${data}`;
              if (!uniqueChecks.has(uniqueKey)) {
                uniqueChecks.set(uniqueKey, { codigo, data });
              }
            }
          }
          
          // Marchează că verificăm
          isCheckingConfirmation = true;
          lastCheckTime = now;
          
          // Procesează secvențial cu delay între request-uri pentru a evita rate limiting
          // IMPORTANT: Batch update pentru a evita re-render-uri multiple
          // IMPORTANT: Verifică autentificarea înainte de a face apelurile
          (async () => {
            try {
              // Verifică din nou dacă utilizatorul este încă autentificat
              if (!isAuthenticated || !authUser) {
                loggerDebug('Skipping check confirmation - user not authenticated');
                return;
              }
            
            const updates = {}; // Colectează toate update-urile într-un singur batch
            
            for (const { codigo, data } of uniqueChecks.values()) {
              // Verifică din nou autentificarea înainte de fiecare apel
              if (!isAuthenticated || !authUser) {
                loggerDebug('Stopping check confirmation - user logged out during processing');
                break;
              }
              
              try {
                const checkResult = await getCheckConfirmationPromise(callApi, codigo, data, isAuthenticated);
                const resultData = checkResult.data || checkResult; // callApi returnează { success: true, data }
                
                // Actualizează map-ul pentru TOATE registrele din aceeași zi pentru același angajat
                // Căutăm toate registrele care corespund acestui codigo + data
                const matchingItems = itemsToCheck.filter(item => 
                  (item.codigo || item.CODIGO || userCodigo) === codigo && item.data === data
                );
                
                for (const item of matchingItems) {
                  const key = `${item.codigo || item.CODIGO || userCodigo}_${item.data}_${item.tipo}`;
                  updates[key] = checkResult.success && resultData.needs_confirmation;
                }
              } catch (error) {
                // Dacă eroarea este 401 (Unauthorized), oprim procesarea
                if (error?.message?.includes('Unauthorized') || error?.response?.status === 401 || error?.status === 401) {
                  loggerDebug('Stopping check confirmation - unauthorized error');
                  break;
                }
                // Dacă verificarea eșuează din alte motive, considerăm că necesită regularizare (afișăm butonul pentru siguranță)
                const matchingItems = itemsToCheck.filter(item => 
                  (item.codigo || item.CODIGO || userCodigo) === codigo && item.data === data
                );
                for (const item of matchingItems) {
                  const key = `${item.codigo || item.CODIGO || userCodigo}_${item.data}_${item.tipo}`;
                  updates[key] = true;
                }
              }
              // Delay între fiecare request pentru a evita rate limiting
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay între request-uri
            }
            
              // Aplică toate update-urile într-un singur batch pentru a evita re-render-uri multiple
              if (Object.keys(updates).length > 0) {
                setNeedsRegularizationMap(prev => ({ ...prev, ...updates }));
              }
            } finally {
              // Resetăm flag-ul
              isCheckingConfirmation = false;
            }
          })().catch(err => {
            loggerDebug('Error checking needs regularization:', err);
            isCheckingConfirmation = false;
          });
        }
        
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
      logError('Error fetching logs:', error);
      setLogs([]);
      setTotalFichajeDuration(null);
    }
    setLoadingLogs(false);
    setChangingMonth(false);
    return [];
  }, [authUser, callApi, selectedMonth, isAuthenticated]);

  // Încarcă marcajele la montarea componentei și când se schimbă luna
  useEffect(() => {
    if (!isAuthenticated || !authUser) {
      return;
    }

    if (authUser?.isDemo) {
      demo('Using demo fichajes data instead of fetching from backend');
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
      
      info('[Fichaje] Folosind backend-ul nou (getHorasAsignadas):', url);
      
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
      logError('Error fetching horas asignadas:', error);
      return 162; // Default en caso de error
    }
  };

  // Funcție pentru a converti timpul (HH:MM) în minute
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };


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
        info('No location cached, requesting now...');
        loc = await locationContext.getCurrentLocation();
        // Obține adresa prin reverse geocoding folosind funcția din context
        if (loc) {
          try {
            address = await locationContext.getAddressFromCoords(loc.latitude, loc.longitude) || currentAddress;
          } catch {
            // Ignoră erorile de geocodare - continuă fără adresă
            address = currentAddress;
          }
        }
      } catch (error) {
        warn('Geolocation not available or denied:', error);
        // Continuă fără locație - marcajul se salvează oricum
      }
    } else {
      // Avem locație cached - folosim-o direct
      success('Using cached location from page access');
    }
    
    // Salvează marcajul în backend (cu sau fără locație)
    try {
      await saveFichaje(tipo, loc, address, fichajeCustomMotivo);
    } catch (error) {
      logError('Error saving fichaje:', error);
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
        logError('Missing user data:', {
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
      } catch {
        warn('Timeout sau eroare la calculul orelor lunare, continuăm cu valori default');
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

      info('[Fichaje] Folosind backend-ul nou (addFichaje):', API_ENDPOINTS.FICHAJE_ADD);
      
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
          warn('Error logging activity (non-blocking):', error);
        });
        
        // ============================================================================
        // ARCHIVED: Auto-regularizare și modal logic (commented for future use)
        // ============================================================================
        // PREVIOUS BEHAVIOR: Auto-send notification and modal for confirmation
        // Both behaviors were removed. Now at Salida we only INFORM, we don't ask for action.
        // Regularizarea is now exclusively on-demand, initiated by the employee.
        //
        // To re-enable auto-send notification, uncomment:
        // if (tipo === 'Salida' && result.data?.auto_sent_for_review) {
        //   setNotification({
        //     type: 'success',
        //     title: 'Enviado a aprobación',
        //     message: 'La diferencia supera 15 minutos. Se ha enviado automáticamente para revisión.',
        //     duration: 6000,
        //   });
        // }
        //
        // To re-enable modal, uncomment:
        // if (tipo === 'Salida' && result.data?.needs_confirmation && result.data?.confirmation_data && result.data?.confirmation_data?.scheduled_minutes > 0) {
        //   setConfirmarJornadaData({
        //     ...result.data.confirmation_data,
        //     fecha: fechaMadrid,
        //     employee_codigo: userCode,
        //   });
        //   setShowConfirmarJornadaModal(true);
        // }
        // ============================================================================
        // END ARCHIVED: Auto-regularizare și modal logic
        // ============================================================================
        
        // CURRENT BEHAVIOR: At Salida, we only INFORM about the difference (if exists)
        // No modal, no auto-send, just informational notification
        // Regularizarea is now exclusively on-demand, initiated by the employee through a separate action
        if (tipo === 'Salida' && result.data?.confirmation_data) {
          const confData = result.data.confirmation_data;
          const delta = confData.delta_minutes || 0;
          const absDelta = Math.abs(delta);
          
          // Informăm doar dacă există o diferență semnificativă (> 15 min)
          if (absDelta > 15 && confData.scheduled_minutes > 0) {
            const formatMinutes = (mins) => {
              const h = Math.floor(Math.abs(mins) / 60);
              const m = Math.round(Math.abs(mins) % 60);
              return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };
            
            const deltaFormatted = formatMinutes(delta);
            const isPositive = delta > 0;
            
            const formatMinutesConsistent = (mins) => {
              const h = Math.floor(Math.abs(mins) / 60);
              const m = Math.round(Math.abs(mins) % 60);
              // Afișăm întotdeauna formatul "Xh Ym" pentru consistență (chiar și "0h Ym" când sunt doar minute)
              return `${h}h ${String(m).padStart(2, '0')}m`;
            };
            
            setNotification({
              type: 'info',
              title: 'Diferencia de horas',
              message: `Has registrado ${formatMinutesConsistent(confData.punched_minutes)} de ${formatMinutesConsistent(confData.scheduled_minutes)} previstas.\nDiferencia: ${isPositive ? '+' : '-'}${deltaFormatted}.\nSi corresponde, puedes solicitar una regularización desde Registros (botón "Regularizar").`,
              duration: 8000,
            });
          }
        }

        // Verifică warning pentru Entrada tardía
        if (tipo === 'Entrada' && result.data?.entrada_warning) {
          const warning = result.data.entrada_warning;
          setNotification({
            type: 'warning',
            title: 'Entrada tardía',
            message: `${warning.message} ${warning.suggestion}`,
            duration: 8000, // 8 secunde pentru a avea timp să citească
          });
        }
        
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

        // Reîncarcă ultimul marcaj global pentru a actualiza starea butonului "Salida para incidencia"
        fetchUltimoMarcajeGlobal().catch(err => {
          warn('Error reloading ultimo marcaje global after fichaje:', err);
        });

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
              warn('Error reloading logs:', error);
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
        logError('Error from API:', result.error);
        loggerDebug('[Fichaje] Full error object:', JSON.stringify(result, null, 2));
        
        // Detectăm eroarea specifică despre fichajes consecutive
        let errorTitle = t('error.saveError');
        let errorMessage = t('error.saveErrorDetails');
        
        const errorText = (result.error || '').toLowerCase();
        loggerDebug('[Fichaje] Error text (lowercase):', errorText);
        loggerDebug('[Fichaje] Error text length:', errorText.length);
        
        // Verifică dacă este eroarea despre fichajes consecutive
        // Verifică mai multe variante ale mesajului
        const hasNuSePot = errorText.includes('nu se pot înregistra');
        const has2Entrada2Salida = errorText.includes('2 entrada/2 salida consecutive');
        const hasEntrada2Salida = errorText.includes('entrada/2 salida consecutive');
        const hasEntradaConsecutiv = errorText.includes('entrada consecutiv');
        const hasSalidaConsecutiv = errorText.includes('salida consecutiv');
        const hasConsecutive = errorText.includes('consecutive');
        
        loggerDebug('[Fichaje] Checking conditions:', {
          hasNuSePot,
          has2Entrada2Salida,
          hasEntrada2Salida,
          hasEntradaConsecutiv,
          hasSalidaConsecutiv,
          hasConsecutive
        });
        
        if (hasNuSePot || has2Entrada2Salida || hasEntrada2Salida || 
            hasEntradaConsecutiv || hasSalidaConsecutiv || hasConsecutive) {
          errorTitle = 'Error al Registrar';
          
          // Detectează tipul specific de eroare
          if (errorText.includes('2 entrada') && !errorText.includes('2 salida')) {
            // Doar Entrada consecutivă - înseamnă că există deja un turn deschis
            errorMessage = 'No se pueden registrar 2 Entradas consecutivas. Es posible que hayas olvidado cerrar la entrada anterior. Por favor, verifica tus registros. Puedes usar "Salida para incidencia" para cerrar el turno abierto.';
            // Forțează reîncărcarea logs și ultimul marcaj global pentru a actualiza starea butonului "Salida para incidencia"
            setTimeout(() => {
              fetchLogs(selectedMonth).catch(err => {
                warn('Error reloading logs after consecutive entrada error:', err);
              });
              fetchUltimoMarcajeGlobal().catch(err => {
                warn('Error reloading ultimo marcaje global after consecutive entrada error:', err);
              });
            }, 500);
          } else if (errorText.includes('2 salida') && !errorText.includes('2 entrada')) {
            // Doar Salida consecutivă
            errorMessage = 'No se pueden registrar 2 Salidas consecutivas. Es posible que hayas olvidado cerrar la salida anterior. Por favor, verifica tus registros.';
          } else {
            // Ambele tipuri sau mesaj generic
            errorMessage = 'No se pueden registrar 2 fichajes del mismo tipo consecutivos. Es posible que hayas olvidado cerrar el registro anterior. Por favor, verifica tus registros.';
            // Pentru cazul generic, verificăm dacă este vorba despre 2 Entrada și forțăm reîncărcarea
            if (errorText.includes('entrada')) {
              setTimeout(() => {
                fetchLogs(selectedMonth).catch(err => {
                  warn('Error reloading logs after consecutive fichaje error:', err);
                });
                fetchUltimoMarcajeGlobal().catch(err => {
                  warn('Error reloading ultimo marcaje global after consecutive fichaje error:', err);
                });
              }, 500);
            }
          }
          success('[Fichaje] Detected consecutive fichaje error, showing message:', errorMessage);
        } else {
          warn('[Fichaje] Error not recognized as consecutive fichaje error');
        }
        
        setNotification({
          type: 'error',
          title: errorTitle,
          message: errorMessage
        });
      }
    } catch (error) {
      logError('Error saving fichaje:', error);
      
      // Detectăm eroarea specifică despre fichajes consecutive
      let errorTitle = t('error.saveError');
      let errorMessage = t('error.saveErrorDetails');
      
      const errorText = (error?.message || error?.toString() || '').toLowerCase();
      
      // Verifică dacă este eroarea despre fichajes consecutive
      if (errorText.includes('nu se pot înregistra') || 
          errorText.includes('2 entrada/2 salida consecutive') ||
          errorText.includes('consecutive')) {
        errorTitle = 'Error al Registrar';
        
        // Detectează tipul specific de eroare
        if (errorText.includes('2 entrada') && !errorText.includes('2 salida')) {
          // Doar Entrada consecutivă
          errorMessage = 'No se pueden registrar 2 Entradas consecutivas. Es posible que hayas olvidado cerrar la entrada anterior. Por favor, verifica tus registros.';
        } else if (errorText.includes('2 salida') && !errorText.includes('2 entrada')) {
          // Doar Salida consecutivă
          errorMessage = 'No se pueden registrar 2 Salidas consecutivas. Es posible que hayas olvidado cerrar la salida anterior. Por favor, verifica tus registros.';
        } else {
          // Ambele tipuri sau mesaj generic
          errorMessage = 'No se pueden registrar 2 fichajes del mismo tipo consecutivos. Es posible que hayas olvidado cerrar el registro anterior. Por favor, verifica tus registros.';
        }
      }
      
      setNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage
      });
    } finally {
      // Aseguramos que fichando se resetee SIEMPRE, sin importar el resultado
      setFichando(false);
    }
    
    // Închide modal-ul
    setShowFichajeConfirmModal(false);
    setFichajeTipo('');
  };

  // Memoizează rezultatele pentru Entrada și Salida pentru a evita recalculări inutile
  // Recalculează doar când se schimbă horarioAsignado sau cuadranteAsignado

  // Verifică dacă tura este completă (s-au făcut ambele, Entrada și Salida)
  const isShiftComplete = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const hasEntradaToday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
    });
    const hasSalidaToday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Salida';
    });
    
    // Pentru ture nocturne: verifică dacă există Entrada ieri seara
    const hasEntradaYesterday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(yesterdayStr) && (log.tipo || log.TIPO) === 'Entrada';
    });
    
    // Verifică dacă este tură nocturnă (pentru cuadrante)
    let isOvernightShiftToday = false;
    if (cuadranteAsignado) {
      const currentDay = new Date().getDate();
      const dayKey = `ZI_${currentDay}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        let intervals = [];
        if (daySchedule.includes('T1') || daySchedule.includes('T2') || daySchedule.includes('T3')) {
          const match = daySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
          if (match) {
            intervals = [{ start: match[1], end: match[2] }];
          }
        } else {
          intervals = daySchedule.split(',').map(interval => {
            const [start, end] = interval.trim().split('-');
            return { start: start?.trim(), end: end?.trim() };
          }).filter(interval => interval.start && interval.end);
        }
        
        if (intervals.length > 0) {
          const firstInterval = intervals[0];
          const startTime = (parseInt(firstInterval.start.split(':')[0]) || 0) * 60 + (parseInt(firstInterval.start.split(':')[1]) || 0);
          const endTime = (parseInt(firstInterval.end.split(':')[0]) || 0) * 60 + (parseInt(firstInterval.end.split(':')[1]) || 0);
          isOvernightShiftToday = endTime < startTime;
        }
      }
    }
    
    // Tura este completă dacă:
    // 1. Ambele făcute astăzi (tură normală), SAU
    // 2. Salida astăzi + Entrada ieri + este tură nocturnă (tură nocturnă care s-a terminat dimineața)
    return (hasEntradaToday && hasSalidaToday) || 
           (hasSalidaToday && hasEntradaYesterday && isOvernightShiftToday);
  }, [logs, cuadranteAsignado]);

  const isEntradaAllowed = useMemo(() => {
    // Verifică dacă ziua curentă este festivo și utilizatorul nu lucrează în festivos
    if (isTodayFestivo) {
      const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
      const trabajaFestivosLower = String(trabajaFestivos).toLowerCase().trim();
      const trabajaEnFestivos = ['si', 'sí', 's', '1', 'true', 'da', 'y', 'yes'].includes(trabajaFestivosLower);
      loggerDebug('🔍 isEntradaAllowed - isTodayFestivo:', isTodayFestivo, 'trabajaFestivos:', trabajaFestivos, 'trabajaEnFestivos:', trabajaEnFestivos);
      if (!trabajaEnFestivos) {
        loggerDebug('❌ Today is festivo and user does not work on festivos - blocking Entrada');
        return false; // Nu permite fichar în zile de sărbătoare dacă nu lucrează în festivos
      } else {
        loggerDebug('✅ Today is festivo but user works on festivos - allowing Entrada');
      }
    }
    
    // Verifică dacă există orar/cuadrante pentru ziua curentă
    // Dacă nu există orar pentru ziua curentă, NU permite fichar
    if (!horarioAsignado && !cuadranteAsignado) {
      return false; // Nu permite fichar fără orar/cuadrante
    }
    
    // Verifică dacă există orar pentru ziua curentă (pentru horario)
    if (horarioAsignado && !cuadranteAsignado) {
      const now = new Date();
      const currentDay = now.getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][currentDay];
      const daySchedule = horarioAsignado.days?.[dayKey];
      
      // Dacă nu există orar pentru ziua curentă sau nu are intervale valide, NU permite
      if (!daySchedule) {
        return false;
      }
      const hasIntervals = (daySchedule.in1 && daySchedule.out1) || 
                          (daySchedule.in2 && daySchedule.out2) || 
                          (daySchedule.in3 && daySchedule.out3);
      if (!hasIntervals) {
        return false; // Nu are intervale valide pentru ziua curentă
      }
    }
    
    // Dacă tura este completă, verifică doar dacă este timpul corect pentru următoarea tură
    if (isShiftComplete) {
      return isTimeWithinSchedule('Entrada');
    }
    // Dacă tura nu este completă și există orar, permite oricând (pentru cazul când uită să ficheze)
    return true;
  }, [isTimeWithinSchedule, isShiftComplete, horarioAsignado, cuadranteAsignado, isTodayFestivo, authUser]);

  const isSalidaAllowed = useMemo(() => {
    // Verifică dacă ziua curentă este festivo și utilizatorul nu lucrează în festivos
    if (isTodayFestivo) {
      const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
      const trabajaFestivosLower = String(trabajaFestivos).toLowerCase().trim();
      const trabajaEnFestivos = ['si', 'sí', 's', '1', 'true', 'da', 'y', 'yes'].includes(trabajaFestivosLower);
      loggerDebug('🔍 isSalidaAllowed - isTodayFestivo:', isTodayFestivo, 'trabajaFestivos:', trabajaFestivos, 'trabajaEnFestivos:', trabajaEnFestivos);
      if (!trabajaEnFestivos) {
        loggerDebug('❌ Today is festivo and user does not work on festivos - blocking Salida');
        return false; // Nu permite fichar în zile de sărbătoare dacă nu lucrează în festivos
      } else {
        loggerDebug('✅ Today is festivo but user works on festivos - allowing Salida');
      }
    }
    
    // Pentru turnurile compartite (horarioAsignado cu mai multe intervale), nu folosim isShiftComplete global
    // ci verificăm fiecare interval individual prin isTimeWithinSchedule
    if (horarioAsignado && !cuadranteAsignado) {
      const now = new Date();
      const currentDay = now.getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][currentDay];
      const daySchedule = horarioAsignado.days?.[dayKey];
      
      if (daySchedule) {
        // Verifică câte intervale există
        let intervalCount = 0;
        if (daySchedule.in1 && daySchedule.out1) intervalCount++;
        if (daySchedule.in2 && daySchedule.out2) intervalCount++;
        if (daySchedule.in3 && daySchedule.out3) intervalCount++;
        
        // Dacă există mai mult de un interval (turn compartit), nu folosim isShiftComplete global
        if (intervalCount > 1) {
          return isTimeWithinSchedule('Salida');
        }
      }
    }
    
    // Pentru ture simple sau cuadrante, folosim logica veche
    // Dacă tura este completă, Salida este dezactivată (tura s-a terminat)
    if (isShiftComplete) {
      return false;
    }
    // Dacă tura nu este completă, verifică programul normal
    return isTimeWithinSchedule('Salida');
  }, [isTimeWithinSchedule, isShiftComplete, isTodayFestivo, authUser, horarioAsignado, cuadranteAsignado]);

  // Memoizează rezultatul calculului pentru mesajul informativ (evită recalculare la fiecare secundă)
  const timeRestrictionMessage = useMemo(() => {
    if (!horarioAsignado && !cuadranteAsignado) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const hasEntradaToday = logs.some(log => {
      const logDate = log.data || log.FECHA || log.fecha;
      return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
    });
    
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
      const todayDayOfWeek = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][todayDayOfWeek];
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
    
    // Folosește isShiftComplete calculat anterior (verifică corect și pentru ture nocturne)
    
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
        const todayDayOfWeek = new Date().getDay();
        const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][todayDayOfWeek];
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
    
    if (isShiftComplete && (horarioAsignado || cuadranteAsignado)) {
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
    
    // Dacă tura este completă (ambele făcute), arată MEREU mesajul pentru următoarea Entrada
    if (isShiftComplete) {
      // Tura completă - arată când este următoarea Entrada
      const entradaMessage = getTimeRestrictionMessage('Entrada');
      if (entradaMessage) {
        return `Entrada: ${entradaMessage}`;
      }
      return 'Entrada: Consulta tu horario asignado';
    }
    
    // Dacă nu s-a completat tura, verifică restricțiile
    if (hasEntradaToday) {
      // Doar Entrada făcută - arată mesajul pentru Salida
      if (!isSalidaAllowed) {
        return `Salida: ${getTimeRestrictionMessage('Salida') || 'No permitida en este momento'}`;
      }
    } else {
      // Nu s-a făcut încă Entrada - arată mesajul pentru Entrada
      if (!isEntradaAllowed && !isSalidaAllowed) {
        return `${getTimeRestrictionMessage('Entrada') || 'Consulta tu horario asignado'}`;
      } else if (!isEntradaAllowed) {
        return `Entrada: ${getTimeRestrictionMessage('Entrada') || 'No permitida en este momento'}`;
      } else {
        return `Salida: ${getTimeRestrictionMessage('Salida') || 'No permitida en este momento'}`;
      }
    }
    
    return null;
  }, [logs, cuadranteAsignado, horarioAsignado, isEntradaAllowed, isSalidaAllowed, isShiftComplete, getTimeRestrictionMessage]);

  // Dacă utilizatorul nu este autentificat, afișează un mesaj
  return (
    <div className="space-y-6">
      {loadingAlerts && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-sm text-yellow-700">
          <div className="h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>Comprobando alertas mensuales...</span>
        </div>
      )}

      {!loadingAlerts && monthlyAlerts && monthlyAlerts.total > 0 && (
        <div className={`bg-yellow-50 border border-yellow-200 rounded-xl ${isMobile ? 'p-3' : 'p-4'} shadow-md flex items-start gap-3`}>
          <div className={isMobile ? 'text-xl' : 'text-2xl'}>⚠️</div>
          <div>
            <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-semibold text-yellow-800`}>Alertas mensuales detectadas</h3>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-yellow-700`}>
              {(() => {
                const parts = [];
                if (monthlyAlerts.positivos > 0) {
                  parts.push(
                    <span key="exceso">
                      <span className="font-semibold text-red-600">{monthlyAlerts.positivos} día{monthlyAlerts.positivos > 1 ? 's' : ''}</span> con exceso (has trabajado más horas de las previstas)
                    </span>
                  );
                }
                if (monthlyAlerts.negativos > 0) {
                  parts.push(
                    <span key="deficit">
                      <span className="font-semibold text-yellow-600">{monthlyAlerts.negativos} día{monthlyAlerts.negativos > 1 ? 's' : ''}</span> con déficit (no has fichado o has trabajado menos horas de las previstas)
                    </span>
                  );
                }
                if (parts.length === 0) {
                  return (
                    <>
                      Tienes {monthlyAlerts.total} días con alertas este mes. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
                    </>
                  );
                }
                return (
                  <>
                    Tienes {monthlyAlerts.total} día{monthlyAlerts.total > 1 ? 's' : ''} con alertas este mes: {parts.length > 1 ? (
                      <>
                        {parts[0]} y {parts[1]}
                      </>
                    ) : parts[0]}. Revisa el tab <span className="font-semibold">Horas Trabajadas → Alertas</span> para ver los detalles.
                  </>
                );
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Card cu ceas și butoane */}
      <Card>
        <div className="text-center">
          <div className={`${isMobile ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'} bg-red-100 rounded-full flex items-center justify-center mx-auto`}>
            <span className={`text-red-600 ${isMobile ? 'text-xl' : 'text-2xl'}`}>🕒</span>
          </div>
          <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 mb-2`}>
            {madridTimeStr || now.toLocaleTimeString()}
          </div>
          <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 mb-6`}>Hora (Europe/Madrid)</div>
          {/* Locația curentă afișată sub ceas - se obține doar când utilizatorul apasă Fichar (GDPR compliant) */}
          <div className={`mb-6 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
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
              <div className={`flex items-center justify-center gap-2 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando horario...</span>
              </div>
            ) : cuadranteAsignado ? (
              <div className={`bg-green-50 border border-green-200 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">📋</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-green-800`}>Cuadrantes Asignado</span>
                </div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-700`}>
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
              <div className={`bg-blue-50 border border-blue-200 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600">📅</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-blue-800`}>Horario Asignado</span>
                </div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-700`}>
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
            ) : horarioMulticentroAsignado ? (
              // Afișează informații despre horario_multicentro dacă există
              <div className={`bg-purple-50 border border-purple-200 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-purple-600">📅</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-purple-800`}>Horario Multicentro</span>
                </div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-purple-700 space-y-1`}>
                  <div><strong>Cliente:</strong> {horarioMulticentroAsignado.CLIENTE || 'N/A'}</div>
                  <div><strong>Horario:</strong> {horarioMulticentroAsignado.HORARIO || 'N/A'}</div>
                  <div><strong>Mes:</strong> {horarioMulticentroAsignado.LUNA || 'N/A'}</div>
                  {currentDaySchedule && (
                    <div className="mt-2 pt-2 border-t border-purple-300">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-purple-800 rounded-md">
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
                  {!currentDaySchedule && (
                    <div className="mt-2 pt-2 border-t border-purple-300 text-yellow-700">
                      <span className="text-xs">⚠️ No tienes horario asignado para hoy</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Afișează avertismentul doar dacă NU există orar pentru ziua CURENTĂ
              // Verifică dacă există orar în cuadrante, horario_multicentro, sau horarios normal pentru ziua de astăzi
              !currentDaySchedule ? (
                <div className={`bg-yellow-50 border border-yellow-200 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-yellow-800`}>Sin Horario Asignado</span>
                  </div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-yellow-700`}>
                    No se ha encontrado un horario específico para hoy.
                  </div>
                </div>
              ) : null
            )}
          </div>
          
          {/* Mesaj informativ când butoanele sunt blocate */}
          {/* Avertisment pentru Baja Médica */}
          {isOnBajaMedica && currentBajaMedica && (
            <div className={`mb-4 ${isMobile ? 'p-3' : 'p-4'} bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl shadow-lg`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md`}>
                    <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'}`}>🏥</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-rose-800 mb-1`}>
                    ⚠️ Estás en Baja Médica
                  </h3>
                  <p className={`text-rose-700 ${isMobile ? 'text-xs' : 'text-sm'} mb-2`}>
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

          {/* Avertisment pentru festivo */}
          {isTodayFestivo && !isOnVacationOrAbsence && !isOnBajaMedica && (() => {
            const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
            const trabajaFestivosLower = String(trabajaFestivos).toLowerCase().trim();
            const trabajaEnFestivos = ['si', 'sí', 's', '1', 'true', 'da', 'y', 'yes'].includes(trabajaFestivosLower);
            if (!trabajaEnFestivos) {
              return (
                <div className={`mb-4 ${isMobile ? 'p-3' : 'p-4'} bg-blue-50 border border-blue-200 rounded-xl`}>
                  <div className="flex items-center gap-3">
                    <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-blue-100 rounded-lg flex items-center justify-center`}>
                      <span className={`text-blue-600 ${isMobile ? 'text-base' : 'text-lg'}`}>🎉</span>
                    </div>
                    <div>
                      <p className={`text-blue-800 ${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
                        Hoy es día festivo
                      </p>
                      <p className={`text-blue-600 ${isMobile ? 'text-[10px]' : 'text-sm'} mt-1`}>
                        Según nuestros datos, no trabajas en días festivos, por lo que no necesitas fichar hoy. ¡Disfruta del día!
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Avertisment pentru alte absențe */}
          {isOnVacationOrAbsence && !isOnBajaMedica && (
            <div className={`mb-4 ${isMobile ? 'p-3' : 'p-4'} bg-yellow-50 border border-yellow-200 rounded-xl`}>
              <div className="flex items-center gap-3">
                <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-yellow-100 rounded-lg flex items-center justify-center`}>
                  <span className={`text-yellow-600 ${isMobile ? 'text-base' : 'text-lg'}`}>⚠️</span>
                </div>
                <div>
                  <p className={`text-yellow-800 ${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
                    No puedes fichar durante {currentAbsenceType}
                  </p>
                  <p className={`text-yellow-600 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                    Los botones de Entrada y Salida están deshabilitados
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mesaj informativ când butoanele sunt blocate din cauza orarului SAU când s-a completat tura */}
          {!isOnVacationOrAbsence && (horarioAsignado || cuadranteAsignado) && (
            <div className={`mb-4 ${isMobile ? 'p-3' : 'p-4'} bg-blue-50 border border-blue-200 rounded-xl`}>
              <div className="flex items-center gap-3">
                <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-blue-100 rounded-lg flex items-center justify-center`}>
                  <span className={`text-blue-600 ${isMobile ? 'text-base' : 'text-lg'}`}>⏰</span>
                </div>
                <div>
                  <p className={`text-blue-800 ${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
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
              className={`group relative ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isEntradaAllowed)
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : isTodayFestivo && (() => {
                      const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
                      const trabajaFestivosLower = String(trabajaFestivos).toLowerCase().trim();
                      const trabajaEnFestivos = ['si', 'sí', 's', '1', 'true', 'da', 'y', 'yes'].includes(trabajaFestivosLower);
                      return !trabajaEnFestivos;
                    })()
                    ? 'No puedes fichar durante fiesta'
                    : ((horarioAsignado || cuadranteAsignado) && !isEntradaAllowed)
                      ? getTimeRestrictionMessage('Entrada') || 'Entrada no permitida en este momento'
                      : 'Iniciar jornada'
              }
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                  <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'} group-hover:scale-110 transition-transform duration-300`}>🚪</span>
                </div>
                <div className="text-left">
                  <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>{fichando ? 'Marcando...' : 'Entrada'}</div>
                  <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Iniciar jornada</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handleFichar('Salida')}
              disabled={fichando || isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)}
              className={`group relative ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : isTodayFestivo && (() => {
                      const trabajaFestivos = authUser?.['TrabajaFestivos'] || authUser?.trabajaFestivos || 'NO';
                      const trabajaFestivosLower = String(trabajaFestivos).toLowerCase().trim();
                      const trabajaEnFestivos = ['si', 'sí', 's', '1', 'true', 'da', 'y', 'yes'].includes(trabajaFestivosLower);
                      return !trabajaEnFestivos;
                    })()
                    ? 'No puedes fichar durante fiesta'
                    : ((horarioAsignado || cuadranteAsignado) && !isSalidaAllowed)
                      ? getTimeRestrictionMessage('Salida') || 'Salida no permitida en este momento'
                      : 'Finalizar jornada'
              }
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                  <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'} group-hover:scale-110 transition-transform duration-300`}>🚪</span>
                </div>
                <div className="text-left">
                  <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>{fichando ? 'Marcando...' : 'Salida'}</div>
                  <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Finalizar jornada</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleFichar('Salida', 'Salida para incidencia', { bypassSchedule: true })}
              disabled={fichando || isOnVacationOrAbsence || !canUseIncidenceExit}
              className={`group relative ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
                isOnVacationOrAbsence || !canUseIncidenceExit
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-200 opacity-60 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              }`}
              title={
                isOnVacationOrAbsence 
                  ? `No puedes fichar durante ${currentAbsenceType}` 
                  : !canUseIncidenceExit
                    ? 'Debes registrar una entrada antes de usar esta salida para cerrar el turno abierto'
                    : 'Salida imprevista para incidencia. Permite cerrar un turno abierto incluso si el botón normal de Salida está bloqueado.'
              }
            >
              <div className="absolute inset-0 rounded-xl bg-amber-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                  <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'} group-hover:scale-110 transition-transform duration-300`}>⚡</span>
                </div>
                <div className="text-left">
                  <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>{fichando ? 'Marcando...' : 'Salida Incidencia'}</div>
                  <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Salida imprevista</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={hasCompletedCycle ? onFicharIncidencia : null}
              disabled={fichando || !hasCompletedCycle}
              className={`group relative ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform shadow-lg ${
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
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                  <span className={`${isMobile ? 'text-base' : 'text-xl'} transition-transform duration-300 ${
                    hasCompletedCycle && !fichando ? 'group-hover:scale-110' : ''
                  }`}>
                    {!hasCompletedCycle ? '🔒' : '⚠️'}
                  </span>
                </div>
                <div className="text-left">
                  <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>
                    Registrar Ausencia
                  </div>
                  <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>
                    {!hasCompletedCycle ? 'Completa ciclo primero' : 'Registro especial'}
                  </div>
                </div>
              </div>
            </button>
            
            {/* Buton "Anunciar Baja Médica" */}
            <button
              onClick={() => setShowBajaMedicaModal(true)}
              disabled={fichando}
              className={`group relative ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform shadow-lg hover:scale-105 hover:shadow-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              title="Anunciar baja médica"
            >
              <div className="absolute inset-0 rounded-xl bg-rose-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                  <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'} group-hover:scale-110 transition-transform duration-300`}>🩺</span>
                </div>
                <div className="text-left">
                  <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>Anunciar Baja Médica</div>
                  <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Registro médico</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* Mensaje explicativo para incidencia */}
          {!hasCompletedCycle && (
            <div className={`mt-4 ${isMobile ? 'p-3' : 'p-4'} bg-amber-50 border border-amber-200 rounded-lg`}>
              <div className="flex items-center">
                <span className={`text-amber-600 ${isMobile ? 'text-base' : 'text-lg'} mr-3`}>ℹ️</span>
                <div>
                  <p className={`text-amber-800 ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
                    Para registrar una ausencia médica o personal
                  </p>
                  <p className={`text-amber-600 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                    Primero debes hacer <strong>Salida</strong> para terminar tu jornada
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Feedback pentru ultimul marcaj */}
          {lastFichaje && (
            <div className={`mt-4 ${isMobile ? 'p-3' : 'p-4'} bg-green-50 border border-green-200 rounded-lg`}>
              <div className="flex items-center">
                <span className={`text-green-600 ${isMobile ? 'text-base' : 'text-lg'} mr-2`}>✅</span>
                <div>
                  <p className={`text-green-800 ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
                    {lastFichaje.tipo} marcado a las {lastFichaje.hora}
                  </p>
                  {lastFichaje.address && (
                    <p className={`text-green-600 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{lastFichaje.address}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback pentru incidencia */}
          {incidenciaMessage && (
            <div className={`mt-4 ${isMobile ? 'p-3' : 'p-4'} border rounded-lg ${
              incidenciaMessage.includes('succes') 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <span className={`${isMobile ? 'text-base' : 'text-lg'} mr-2 ${
                  incidenciaMessage.includes('succes') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {incidenciaMessage.includes('succes') ? '✅' : '❌'}
                </span>
                <div>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium ${
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
                  <div className="text-sm text-gray-600">
                    {changingMonth ? 'Cargando...' : 
                     activeTab === 'registros' ? 'Historial de fichajes del mes seleccionado' : 
                     activeTab === 'ausencias' ? 'Registros de ausencias de todo el año' :
                     'Resumen mensual y anual de tus horas trabajadas'}
                    {activeTab === 'registros' && totalFichajeDuration && (
                      <div className="ml-2 inline-flex items-center gap-2 flex-wrap">
                        {typeof totalFichajeDuration === 'object' && totalFichajeDuration.original ? (
                          <>
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                              ⏱ Registrado: {totalFichajeDuration.original}
                            </span>
                            {totalFichajeDuration.hasRegularization && (
                              <span 
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300 cursor-help"
                                title="El tiempo efectivo es el que se tiene en cuenta según el horario confirmado."
                              >
                                ✅ Tiempo efectivo: {totalFichajeDuration.regularized}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                            ⏱️ Total: {totalFichajeDuration}
                          </span>
                        )}
                      </div>
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
                  </div>
                </div>
              </div>
              
              {/* Tab switcher - Optimizat pentru mobile */}
              <div className={`flex w-full ${isMobile ? 'justify-between' : 'flex-wrap sm:flex-nowrap'} bg-gray-100 dark:bg-gray-800 rounded-xl ${isMobile ? 'p-0.5' : 'p-1'} ${isMobile ? 'gap-0.5' : 'gap-2 sm:w-auto sm:gap-1'}`}>
                <button
                  onClick={() => setActiveTab('registros')}
                  className={`${isMobile ? 'flex-1 flex flex-col items-center justify-center px-2 py-2' : 'flex-1 sm:flex-none text-center px-4 py-2'} rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'registros'
                      ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={isMobile ? 'text-base' : ''}>📊</span>
                  <span className={`${isMobile ? 'text-[10px] mt-0.5' : ''}`}>
                    {isMobile ? 'Reg.' : 'Registros'}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('ausencias')}
                  className={`${isMobile ? 'flex-1 flex flex-col items-center justify-center px-2 py-2' : 'flex-1 sm:flex-none text-center px-4 py-2'} rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'ausencias'
                      ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={isMobile ? 'text-base' : ''}>⚠️</span>
                  <span className={`${isMobile ? 'text-[10px] mt-0.5' : ''}`}>
                    {isMobile ? 'Aus.' : 'Ausencias'}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('horas-trabajadas')}
                  className={`${isMobile ? 'flex-1 flex flex-col items-center justify-center px-2 py-2' : 'flex-1 sm:flex-none text-center px-4 py-2'} rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'horas-trabajadas'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={isMobile ? 'text-base' : ''}>⏰</span>
                  <span className={`${isMobile ? 'text-[10px] mt-0.5' : ''}`}>
                    {isMobile ? 'Horas' : 'Horas Trabajadas'}
                  </span>
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
                        loggerDebug('Month changed from', selectedMonth, 'to', e.target.value);
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
                          <option key={`month-${i}-${value}`} value={value} className="py-2">
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
                
                {/* Buton ULTRA MODERN "Hoy" - 3D + Glassmorphism - RESPONSIVE - Ascuns pe mobile */}
                {!isMobile && (
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
                )}
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
                ) : isMobile ? (
                  // Mobile: Listă compactă (similar cu TimeCheck)
                  <div className="space-y-1.5">
                    {logs.map((item, index) => (
                      <MobileRegistroItem
                        key={index}
                        item={item}
                        authUser={authUser}
                        isManager={isManager}
                        callApi={callApi}
                        setNotification={setNotification}
                        fetchLogs={fetchLogs}
                        selectedMonth={selectedMonth}
                        setConfirmarJornadaData={setConfirmarJornadaData}
                        setShowConfirmarJornadaModal={setShowConfirmarJornadaModal}
                        routes={routes}
                      />
                    ))}
                  </div>
                ) : (
                // Desktop: Layout original (carduri mari)
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
                          {item.tipo === 'Salida' && (
                            <>
                              {item.duration && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                                  ⏱ Registrado: {item.duration}
                                </span>
                              )}
                              {item.effective_duration && item.effective_duration.trim() !== '' && (
                                <span 
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300 cursor-help"
                                  title="El tiempo efectivo es el que se tiene en cuenta según el horario confirmado."
                                >
                                  ✅ Tiempo efectivo: {item.effective_duration}
                                </span>
                              )}
                              {!item.duration && (!item.effective_duration || item.effective_duration.trim() === '') && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                                  ⚠️ Sin duración
                                </span>
                              )}
                              {/* Buton Regularizar - apare mereu dacă are duration dar nu există regularizare */}
                              {item.duration && 
                                !(item.effective_duration && item.effective_duration.trim() !== '') && 
                                !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1') && (
                                <button
                                  onClick={async () => {
                                    try {
                                      // Verifică dacă managerul încearcă să-și regularizeze propriul registru
                                      const employeeCodigo = item.codigo || item.CODIGO;
                                      const userCodigo = authUser?.CODIGO || authUser?.codigo;
                                      const isOwnRecord = employeeCodigo && userCodigo && employeeCodigo.toString() === userCodigo.toString();
                                      
                                      if (isManager && !isOwnRecord) {
                                        // Supervisor: solicită regularizare pentru alt angajat (creează NEEDS_REVIEW)
                                        const result = await callApi(routes.requestRegularizacion, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
                                            fecha: item.data,
                                          }),
                                        });
                                        if (result.success) {
                                          setNotification({
                                            type: 'success',
                                            title: 'Regularización solicitada',
                                            message: 'El empleado recibirá una notificación para confirmar.',
                                          });
                                          // Reîncarcă logs
                                          fetchLogs(selectedMonth).catch(err => {
                                            console.error('Error reloading logs:', err);
                                          });
                                        }
                                      } else {
                                        // Angajat sau manager care își regularizează propriul registru: deschide modalul de confirmare
                                        const checkResult = await getCheckConfirmationPromise(callApi, item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo, item.data, !!authUser);
                                        const resultData = checkResult.data || checkResult;
                                        
                                        // Verifică dacă există program prevăzut (scheduled_minutes > 0) și dacă necesită confirmare
                                        if (checkResult.success && resultData.needs_confirmation && resultData.scheduled_minutes > 0) {
                                          setConfirmarJornadaData({
                                            ...resultData,
                                            fecha: item.data,
                                            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
                                          });
                                          setShowConfirmarJornadaModal(true);
                                        } else if (checkResult.success && resultData.scheduled_minutes === 0) {
                                          // Nu există program prevăzut - nu se permite regularizarea
                                          setNotification({
                                            type: 'info',
                                            title: 'No se puede regularizar',
                                            message: 'No hay horario previsto para este día. No se puede regularizar.',
                                          });
                                        } else {
                                          setNotification({
                                            type: 'error',
                                            title: 'Error',
                                            message: 'No se pudo verificar la diferencia. Intenta de nuevo.',
                                          });
                                        }
                                      }
                                    } catch (err) {
                                      console.error('Error regularizando:', err);
                                      setNotification({
                                        type: 'error',
                                        title: 'Error',
                                        message: 'Error al solicitar regularización. Intenta de nuevo.',
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors"
                                >
                                  🔄 Regularizar
                                </button>
                              )}
                            </>
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
                ) : isMobile ? (
                  // Mobile: Listă compactă (similar cu lista de registros)
                  <div className="space-y-1.5">
                    {ausencias.map((item, index) => (
                      <MobileAusenciaItem
                        key={index}
                        item={item}
                        getAusenciaDurationDisplay={getAusenciaDurationDisplay}
                        formatDateRange={formatDateRange}
                      />
                    ))}
                  </div>
                ) : (
                // Desktop: Layout original (carduri mari)
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
                <div className={isMobile ? "mt-2" : "mt-4"}>
                  {loggerDebug('HorasTrabajadas props:', { empleadoId: authUser?.CODIGO, soloEmpleado: true, authUser })}
                  {authUser && authUser.CODIGO ? (
                    <div className={isMobile ? "space-y-2" : ""}>
                      <HorasTrabajadas 
                        empleadoId={authUser.CODIGO} 
                        soloEmpleado={true}
                        codigo={authUser.CODIGO || authUser.codigo}
                        empleadoNombre={authUser['NOMBRE / APELLIDOS'] || authUser.NOMBRE || authUser.nombre}
                        isMobile={isMobile}
                      />
                    </div>
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

      {/* Modal Confirmar Jornada */}
      <ConfirmarJornadaModal
        isOpen={showConfirmarJornadaModal}
        onClose={() => {
          setShowConfirmarJornadaModal(false);
          setConfirmarJornadaData(null);
        }}
        onConfirm={() => {
          // Reîncarcă logs după confirmare
          fetchLogs(selectedMonth).catch(err => {
            warn('Error reloading logs after confirmation:', err);
          });
        }}
        data={confirmarJornadaData}
      />

      {/* Modal Anunciar Baja Médica */}
      <Modal
        isOpen={showBajaMedicaModal}
        onClose={() => {
          setShowBajaMedicaModal(false);
          setBajaMedicaForm({
            fechaBaja: '',
            fechaAlta: '',
            tipo: '',
            recaida: false,
          });
        }}
        title="🩺 Anunciar Baja Médica"
        size="md"
      >
        <div className="space-y-5">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
            <p className="font-semibold mb-2">Información importante:</p>
            <p>Anuncia tu baja médica. El sistema registrará automáticamente tu ausencia por motivos médicos.</p>
            <p className="mt-2 text-xs">Esta información será visible para los gestores y se sincronizará con el sistema de bajas médicas.</p>
          </div>

          <div>
            <label htmlFor="baja-fecha-baja" className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha de baja <span className="text-red-500">*</span>
            </label>
            <input
              id="baja-fecha-baja"
              type="date"
              value={bajaMedicaForm.fechaBaja}
              onChange={(e) => setBajaMedicaForm({ ...bajaMedicaForm, fechaBaja: e.target.value })}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
            />
          </div>

          <div>
            <label htmlFor="baja-fecha-alta" className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha de alta (opcional)
            </label>
            <input
              id="baja-fecha-alta"
              type="date"
              value={bajaMedicaForm.fechaAlta}
              onChange={(e) => setBajaMedicaForm({ ...bajaMedicaForm, fechaAlta: e.target.value })}
              min={bajaMedicaForm.fechaBaja}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Si no conoces la fecha de alta, déjala vacía</p>
          </div>

          <div>
            <label htmlFor="baja-tipo" className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de baja (opcional)
            </label>
            <input
              id="baja-tipo"
              type="text"
              value={bajaMedicaForm.tipo}
              onChange={(e) => setBajaMedicaForm({ ...bajaMedicaForm, tipo: e.target.value })}
              placeholder="Ej: Baja médica común, Accidente laboral..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="baja-recaida"
              type="checkbox"
              checked={bajaMedicaForm.recaida}
              onChange={(e) => setBajaMedicaForm({ ...bajaMedicaForm, recaida: e.target.checked })}
              className="w-5 h-5 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
            />
            <label htmlFor="baja-recaida" className="text-sm font-semibold text-gray-700">
              Es una recaída
            </label>
          </div>

          {/* Upload documento médico (opcional) */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <label htmlFor="baja-medica-documento" className="block text-sm font-semibold text-gray-700 mb-2">
              📄 Foaie medicală (opțional)
            </label>
            <input
              id="baja-medica-documento"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Verifică dimensiunea (max 10MB)
                  if (file.size > 10 * 1024 * 1024) {
                    setNotification({
                      type: 'error',
                      message: 'El archivo es demasiado grande. Máximo 10MB.',
                    });
                    return;
                  }
                  setBajaMedicaDocumento(file);
                } else {
                  setBajaMedicaDocumento(null);
                }
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 bg-white text-sm"
            />
            {bajaMedicaDocumento && (
              <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                <span>✅</span>
                <span>{bajaMedicaDocumento.name} ({(bajaMedicaDocumento.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Puedes subir el documento médico si lo tienes disponible</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setShowBajaMedicaModal(false);
                setBajaMedicaForm({
                  fechaBaja: '',
                  fechaAlta: '',
                  tipo: '',
                  recaida: false,
                });
                setBajaMedicaDocumento(null);
              }}
              className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl transition-colors duration-200 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!bajaMedicaForm.fechaBaja) {
                  setNotification({
                    type: 'error',
                    message: 'La fecha de baja es obligatoria',
                  });
                  return;
                }

                setSubmittingBajaMedica(true);
                try {
                  const token = localStorage.getItem('auth_token');
                  
                  // 1. Creează baja médica
                  const response = await fetch(routes.createBajaMedicaEmpleado, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                      fechaBaja: bajaMedicaForm.fechaBaja,
                      fechaAlta: bajaMedicaForm.fechaAlta || undefined,
                      tipo: bajaMedicaForm.tipo || undefined,
                      recaida: bajaMedicaForm.recaida || undefined,
                    }),
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `HTTP ${response.status}`);
                  }

                  const result = await response.json();
                  if (!result?.success) {
                    throw new Error(result?.message || 'No se pudo crear la baja médica');
                  }

                  // 2. Dacă există document, îl încarcă
                  if (bajaMedicaDocumento) {
                    try {
                      const codigoEmpleado = authUser?.['CODIGO'] || authUser?.codigo || '';
                      if (codigoEmpleado) {
                        const formData = new FormData();
                        formData.append('archivo_0', bajaMedicaDocumento);
                        formData.append('empleado_id', codigoEmpleado);
                        formData.append('empleado_nombre', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Sin nombre');
                        formData.append('empleado_email', authUser?.['CORREO ELECTRONICO'] || authUser?.email || '');
                        formData.append('tipo_documento', 'Baja Médica');
                        formData.append('fecha_upload', new Date().toLocaleString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          timeZone: 'Europe/Madrid'
                        }));
                        formData.append('archivo_0_nombre', bajaMedicaDocumento.name);
                        formData.append('archivo_0_tamaño', bajaMedicaDocumento.size.toString());
                        formData.append('archivo_0_tipo', bajaMedicaDocumento.type);

                        const uploadResponse = await fetch(routes.uploadDocumento, {
                          method: 'POST',
                          headers: {
                            ...(token && { Authorization: `Bearer ${token}` }),
                          },
                          body: formData,
                        });

                        if (!uploadResponse.ok) {
                          // Nu aruncăm eroare dacă upload-ul eșuează, doar logăm
                          warn('Error al subir el documento médico, pero la baja médica se creó correctamente');
                        }
                      }
                    } catch (uploadError) {
                      // Nu aruncăm eroare dacă upload-ul eșuează, doar logăm
                      warn('Error al subir el documento médico:', uploadError);
                    }
                  }

                  setNotification({
                    type: 'success',
                    message: result?.message || 'Baja médica anunciada correctamente',
                  });

                  setShowBajaMedicaModal(false);
                  setBajaMedicaForm({
                    fechaBaja: '',
                    fechaAlta: '',
                    tipo: '',
                    recaida: false,
                  });
                  setBajaMedicaDocumento(null);

                  // Reîncarcă bajas medicas pentru a actualiza status-ul
                  // Reîncarcă bajas medicas folosind funcția locală
                  const empleadoCodigo = String(authUser?.CODIGO || authUser?.codigo || '').trim();
                  if (empleadoCodigo && routes.getBajasMedicas) {
                    try {
                      const token = localStorage.getItem('auth_token');
                      const url = `${routes.getBajasMedicas}${routes.getBajasMedicas.includes('?') ? '&' : '?'}codigo=${encodeURIComponent(empleadoCodigo)}`;
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
                      if (response.ok) {
                        const lista = await response.json();
                        const listaArray = Array.isArray(lista) ? lista : [];
                        setBajasMedicas(listaArray);
                      }
                    } catch (err) {
                      warn('Error reloading bajas medicas:', err);
                    }
                  }
                } catch (error) {
                  setNotification({
                    type: 'error',
                    message: error.message || 'Error al anunciar la baja médica',
                  });
                } finally {
                  setSubmittingBajaMedica(false);
                }
              }}
              disabled={submittingBajaMedica || !bajaMedicaForm.fechaBaja}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingBajaMedica ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>🩺</span>
                  <span>Anunciar Baja Médica</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
// Component pentru item-ul de registru empleado pe mobile (compact, similar cu TimeCheck)
function MobileRegistroEmpleadoItem({ item, index, authUser, isManager, callApi, setNotification, fetchRegistros, selectedMonth, setConfirmarJornadaData, setShowConfirmarJornadaModal, routes, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedDate = item.data ? item.data.split('-').reverse().join('/') : '—';
  const isEntrada = item.tipo === 'Entrada';
  
  const handleRegularizar = async (e) => {
    e.stopPropagation();
    try {
      const employeeCodigo = item.codigo || item.CODIGO;
      const userCodigo = authUser?.CODIGO || authUser?.codigo;
      const isOwnRecord = employeeCodigo && userCodigo && employeeCodigo.toString() === userCodigo.toString();
      
      if (isManager && !isOwnRecord) {
        const result = await callApi(routes.requestRegularizacion, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
            fecha: item.data,
          }),
        });
        if (result.success) {
          setNotification({
            type: 'success',
            title: 'Regularización solicitada',
            message: 'El empleado recibirá una notificación para confirmar.',
          });
          fetchRegistros(selectedMonth).catch(err => {
            console.error('Error reloading registros:', err);
          });
        }
      } else {
        const checkResult = await getCheckConfirmationPromise(callApi, item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo, item.data, !!authUser);
        const resultData = checkResult.data || checkResult;
        
        // Verifică dacă există program prevăzut (scheduled_minutes > 0) și dacă necesită confirmare
        if (checkResult.success && resultData.needs_confirmation && resultData.scheduled_minutes > 0) {
          setConfirmarJornadaData({
            ...resultData,
            fecha: item.data,
            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
          });
          setShowConfirmarJornadaModal(true);
        } else if (checkResult.success && resultData.scheduled_minutes === 0) {
          // Nu există program prevăzut - nu se permite regularizarea
          setNotification({
            type: 'info',
            title: 'No se puede regularizar',
            message: 'No hay horario previsto para este día. No se puede regularizar.',
          });
        } else {
          setNotification({
            type: 'error',
            title: 'Error',
            message: 'No se pudo verificar la diferencia. Intenta de nuevo.',
          });
        }
      }
    } catch (err) {
      console.error('Error regularizando:', err);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Error al solicitar regularización. Intenta de nuevo.',
      });
    }
  };
  
  // Extrage inițialele din numele complet
  const getEmpleadoInitials = () => {
    if (!item.empleado) return '—';
    const parts = item.empleado.trim().split(' ').filter(part => part.length > 0);
    if (parts.length === 0) return '—';
    
    // Dacă are un singur cuvânt, returnează primele 2-3 caractere
    if (parts.length === 1) {
      return parts[0].substring(0, 3).toUpperCase();
    }
    
    // Pentru mai multe cuvinte, extrage prima literă din fiecare
    return parts.map(part => part.charAt(0).toUpperCase()).join('.');
  };
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/roșu) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isEntrada ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        
        {/* Empleado - inițiale */}
        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium min-w-[50px] truncate">
          {getEmpleadoInitials()}
        </span>
        
        {/* Data - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate}
        </span>
        
        {/* Timp - text mic */}
        <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold min-w-[50px]">
          {item.hora}
        </span>
        
        {/* Tipo - text mic, scurtat */}
        <span className={`text-[11px] font-semibold flex-1 ${
          isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
        }`}>
          {isEntrada ? 'E' : 'S'}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Empleado complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Empleado:</span>
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
              {item.empleado || '—'}
            </span>
          </div>
          
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className={`text-[10px] font-semibold ${
              isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {item.tipo}
            </span>
          </div>
          
          {/* Duration detaliat (pentru Salida) */}
          {item.tipo === 'Salida' && (
            <div className="space-y-1">
              {item.duration && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">⏱ Registrado:</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300">{item.duration}</span>
                </div>
              )}
              {item.effective_duration && item.effective_duration.trim() !== '' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-green-600 dark:text-green-400">✅ Efectivo:</span>
                  <span className="text-[10px] text-green-700 dark:text-green-300 font-medium">{item.effective_duration}</span>
                </div>
              )}
              {!item.duration && (!item.effective_duration || item.effective_duration.trim() === '') && (
                <span className="text-[10px] text-red-600 dark:text-red-400">⚠️ Sin duración</span>
              )}
              {/* Buton Regularizar */}
              {item.duration && 
                !(item.effective_duration && item.effective_duration.trim() !== '') && 
                !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1') && (
                <button
                  onClick={handleRegularizar}
                  className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors"
                >
                  🔄 Regularizar
                </button>
              )}
            </div>
          )}
          
          {/* Locație */}
          {(item.address || item.loc) && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1">📍 Ubicación</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words mb-2">
                {item.address || item.loc}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const encodedAddress = encodeURIComponent(item.address || item.loc);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                🌍 Ver en Google Maps
              </button>
            </div>
          )}
          
          {/* Modificado por */}
          {item.modificatDe && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Modificado por:</span>
              <span className="text-[10px] text-gray-700 dark:text-gray-300">{item.modificatDe}</span>
            </div>
          )}
          
          {/* Acțiuni */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(index);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors"
            >
              ✏️ Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 transition-colors"
            >
              🗑️ Eliminar
            </button>
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
  const { isMobile } = useBreakpoint();
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;
  
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [registros, setRegistros] = useState([]);
  const [registrosBrutos, setRegistrosBrutos] = useState([]);
  // State pentru a stoca dacă fiecare fichaje necesită regularizare (pentru a ascunde butonul când nu este necesar)
  // eslint-disable-next-line no-unused-vars
  const [_needsRegularizationMap, setNeedsRegularizationMap] = useState({});
  // State pentru modal-ul de confirmare jornada
  const [showConfirmarJornadaModal, setShowConfirmarJornadaModal] = useState(false);
  const [confirmarJornadaData, setConfirmarJornadaData] = useState(null);
  
  // State pentru selectorul de lună
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // State pentru loading când se schimbă luna
  const [changingMonth, setChangingMonth] = useState(false);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  
  // Ref pentru a detecta dacă este prima montare (pentru a evita încărcarea toată luna la montare)
  const isFirstMount = useRef(true);
  
  // State pentru selecția perioadei
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [isPeriodMode, setIsPeriodMode] = useState(false);
  // State pentru tipul de selecție în modal (mes sau rango)
  const [periodSelectorMode, setPeriodSelectorMode] = useState('mes'); // 'mes' sau 'rango'
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ empleado: '', tipo: 'Entrada', hora: '', address: '', data: '' });
  const [filterModal, setFilterModal] = useState(null);
  const [filter, setFilter] = useState({ empleado: '', luna: '', an: '', de: '', pana: '' });
  const [filtered, setFiltered] = useState([]);
  const [saving, setSaving] = useState(false);

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
                  success('Empleado encontrado por código (sin email):', nombreEmpleado);
                } else {
                  warn('No se encontró empleado por código:', codigoRegistro);
                }
              } else {
                warn('No email ni código found in registro:', item);
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
          effective_duration: item.effective_duration || item.EFFECTIVE_DURATION || null, // Ora regularizată
          effective_minutes: item.effective_minutes || item.EFFECTIVE_MINUTES || null, // Minute efective (pentru calcul)
          has_regularizacion: item.has_regularizacion || item.HAS_REGULARIZACION || 0, // 1 dacă există regularizare, 0 altfel
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
      demo('Skipping fetchEmpleados in Fichaje');
      setLoadingEmpleados(false);
      return;
    }
    
    try {
      // Folosește endpoint-ul existent pentru lista completă de angajați
      const result = await callApi(API_ENDPOINTS.USERS);
      
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        
        // Debug: afișează structura datelor primite
        loggerDebug('Empleados completos raw data:', data);
        
        // Mapează direct angajații din endpoint-ul existent
        const mappedEmpleados = data.map(empleado => ({
          nombre: empleado['NOMBRE / APELLIDOS'] || empleado.nombre || empleado.NOMBRE || 'Sin nombre',
          email: empleado['CORREO ELECTRONIC'] || empleado.EMAIL || empleado.email || empleado['CORREO ELECTRONICO'] || '',
          codigo: empleado.CODIGO || empleado.codigo || '',
          grupo: empleado.GRUPO || empleado.grupo || ''
        }));
        
        // Debug: afișează angajații mappați
        loggerDebug('Empleados completos mapeados:', mappedEmpleados);
        
        setEmpleados(mappedEmpleados);
      } else {
        logError('Error fetching empleados:', result.error);
        // Afișează eroarea specifică pentru CORS în producție
        if (result.error && result.error.includes('CORS')) {
          logError('CORS Error: Lista de angajați nu poate fi încărcată în producție. Verifică configurația CORS în n8n.');
        }
      }
    } catch (error) {
      logError('Error fetching empleados:', error);
      // Verifică dacă este o eroare de CORS
      if (error.message && (error.message.includes('CORS') || error.message.includes('blocked'))) {
        logError('CORS Error: Lista de angajați nu poate fi încărcată în producție. Verifică configurația CORS în n8n.');
      }
    }
    setLoadingEmpleados(false);
  }, [authUser, callApi]);



  const fetchRegistros = useCallback(async (month = selectedMonth, useCurrentDay = false) => {
    // IMPORTANT: Verifică autentificarea ÎNAINTE de a face orice apel API
    if (!authUser) {
      loggerDebug('Skipping fetchRegistros - user not authenticated');
      setLoadingRegistros(false);
      setChangingMonth(false);
      return;
    }
    
    setLoadingRegistros(true);
    setChangingMonth(month !== selectedMonth);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      demo('Skipping fetchRegistros');
      setLoadingRegistros(false);
      return;
    }
    
    try {
      let url;
      
      if (useCurrentDay) {
        // Încarcă doar ziua curentă folosind endpoint-ul pentru perioadă
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        // Folosim endpoint-ul pentru perioadă care acceptă fecha_inicio și fecha_fin
        url = `${API_ENDPOINTS.REGISTROS_PERIODO}?fecha_inicio=${encodeURIComponent(todayStr)}&fecha_fin=${encodeURIComponent(todayStr)}`;
        info('[Fichaje] Folosind backend-ul nou (getRegistrosPeriodo - ziua curentă):', url);
      } else {
        // Para manager/supervisor - retorna todos los registros con filtro de mes
        loggerDebug('Fetching registros for month:', month);
        
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
          warn('Month parameter invalid, using current month:', month);
        }
        
        loggerDebug('Month number:', monthNumber, 'Year:', year);
        loggerDebug('Month parameter:', month);
        
        // Folosim REGISTROS_EMPLEADOS pentru a obține toate registrele pentru luna selectată
        // Trimitem doar luna în format YYYY-MM
        url = `${API_ENDPOINTS.REGISTROS_EMPLEADOS}?mes=${encodeURIComponent(month)}`;
        info('[Fichaje] Folosind backend-ul nou (getRegistrosEmpleados):', url);
      }
      
      // IMPORTANT: Resetăm datele înainte de a încărca noi date pentru a evita acumularea
      setRegistrosBrutos([]);
      setRegistros([]);
      setFiltered([]);
      
      const token = localStorage.getItem('auth_token');
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const result = await callApi(url, { headers });
      
      if (result.success) {
        // Verifică dacă răspunsul este "not-modified" - nu șterge datele existente
        if (result.data && typeof result.data === 'object' && result.data.status === 'not-modified') {
          success('Registros not-modified - păstrăm datele existente');
          // Nu facem nimic, păstrăm datele existente
          setLoadingRegistros(false);
          setChangingMonth(false);
          return;
        }
        
        const data = Array.isArray(result.data) ? result.data : [result.data];
        
        // Debug: afișează structura datelor primite
        loggerDebug('Registros raw data:', data);
        loggerDebug('Primer registro sample:', data[0]);
        loggerDebug('Total registros received:', data.length);
        
        // Debug: verifică dacă există effective_duration în datele primite
        const withEffective = data.filter(item => item.effective_duration || item.EFFECTIVE_DURATION || item.effective_minutes || item.EFFECTIVE_MINUTES);
        if (withEffective.length > 0) {
          loggerDebug(`🔍 Found ${withEffective.length} registros with effective_duration in raw data`);
          loggerDebug('Sample registro with effective_duration:', withEffective[0]);
          
          // Debug specific pentru registrul problematic (fichaje_pk: 2274 sau ID: FIC_1767527804648_b00jks0t0)
          const problematicReg = data.find(item => item.fichaje_pk === 2274 || item.ID === 'FIC_1767527804648_b00jks0t0');
          if (problematicReg) {
            loggerDebug(`🔍 DEBUG SPECIFIC pentru registrul problematic în raw data:`, {
              fichaje_pk: problematicReg.fichaje_pk,
              ID: problematicReg.ID,
              CODIGO: problematicReg.CODIGO,
              FECHA: problematicReg.FECHA,
              TIPO: problematicReg.TIPO,
              DURACION: problematicReg.DURACION,
              effective_duration: problematicReg.effective_duration,
              EFFECTIVE_DURATION: problematicReg.EFFECTIVE_DURATION,
              effective_minutes: problematicReg.effective_minutes,
              EFFECTIVE_MINUTES: problematicReg.EFFECTIVE_MINUTES,
              all_keys: Object.keys(problematicReg)
            });
          }
        } else {
          loggerDebug('⚠️ No registros with effective_duration found in raw data');
        }
        
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
          success('No valid registros after filtering - păstrăm datele existente');
          return;
        }
        
        loggerDebug('Valid registros after filtering:', validData.length);
        
        // Mapeo a la estructura UI
        const mapped = validData.map(item => {
          // Debug pentru înregistrarea problematică
          if (item.CODIGO === '10000001' && item.FECHA === '2026-01-04' && item.TIPO === 'Salida') {
            console.log('🔍 DEBUG Mapping item pentru 10000001:', {
              item_keys: Object.keys(item),
              effective_duration: item.effective_duration,
              EFFECTIVE_DURATION: item.EFFECTIVE_DURATION,
              has_regularizacion: item.has_regularizacion,
              HAS_REGULARIZACION: item.HAS_REGULARIZACION,
              full_item: item
            });
          }
          
          const mappedItem = {
            id: item.ID || item.id || item._id || null,
            // Prioriză NOMBRE / APELLIDOS care vine direct din backend
            empleado: item['NOMBRE / APELLIDOS'] || item['NOMBRE'] || item.NOMBRE || item.empleado || item.nombre || 'Sin nombre',
            tipo: item.TIPO || item.tipo,
            hora: item.HORA || item.hora,
            address: item.DIRECCION || item.address,
            modificatDe: item.MODIFICADO_POR || item.modificatDe,
            codigo: item.CODIGO || item.codigo,
            duration: item.DURACION || item.duration, // Ora originală
            effective_duration: item.effective_duration || item.EFFECTIVE_DURATION || null, // Ora regularizată
            effective_minutes: item.effective_minutes || item.EFFECTIVE_MINUTES || null, // Minute efective (pentru calcul)
            has_regularizacion: item.has_regularizacion || item.HAS_REGULARIZACION || 0, // 1 dacă există regularizare, 0 altfel
            data: item.FECHA || item.data,
            email: item['CORREO ELECTRONIC'] || item.EMAIL || item.email || item['CORREO ELECTRONICO'] || ''
          };
          
          // Debug pentru înregistrarea problematică - după mapping
          if (mappedItem.codigo === '10000001' && mappedItem.data === '2026-01-04' && mappedItem.tipo === 'Salida') {
            console.log('🔍 DEBUG Mapped item pentru 10000001:', {
              effective_duration: mappedItem.effective_duration,
              has_regularizacion: mappedItem.has_regularizacion,
              mapped_item: mappedItem
            });
          }
          
          // Debug pentru registre cu duration dar fără effective_duration (pentru a identifica probleme)
          if (mappedItem.duration && !mappedItem.effective_duration && mappedItem.tipo === 'Salida') {
            loggerDebug(`⚠️ Registro cu duration dar fără effective_duration:`, {
              id: mappedItem.id,
              codigo: mappedItem.codigo,
              fecha: mappedItem.data,
              duration: mappedItem.duration,
              effective_duration: mappedItem.effective_duration,
              raw_item: item,
              raw_effective_duration: item.effective_duration,
              raw_EFFECTIVE_DURATION: item.EFFECTIVE_DURATION,
              raw_effective_minutes: item.effective_minutes,
              raw_EFFECTIVE_MINUTES: item.EFFECTIVE_MINUTES,
              all_keys: Object.keys(item)
            });
          }
          
          // Debug pentru registre cu effective_duration (pentru a verifica că se mapează corect)
          if (mappedItem.effective_duration && mappedItem.tipo === 'Salida') {
            loggerDebug(`✅ Registro cu effective_duration mapeado corect:`, {
              id: mappedItem.id,
              codigo: mappedItem.codigo,
              fecha: mappedItem.data,
              duration: mappedItem.duration,
              effective_duration: mappedItem.effective_duration,
              effective_minutes: mappedItem.effective_minutes
            });
          }
          
          // Debug specific pentru registrul problematic (fichaje_pk: 2274 sau ID: FIC_1767527804648_b00jks0t0)
          if ((item.fichaje_pk === 2274 || item.ID === 'FIC_1767527804648_b00jks0t0' || mappedItem.id === 'FIC_1767527804648_b00jks0t0') && mappedItem.tipo === 'Salida') {
            loggerDebug(`🔍 DEBUG SPECIFIC pentru registrul problematic:`, {
              mappedItem: mappedItem,
              raw_item: item,
              has_effective_duration: !!mappedItem.effective_duration,
              effective_duration_value: mappedItem.effective_duration,
              raw_effective_duration: item.effective_duration,
              raw_EFFECTIVE_DURATION: item.EFFECTIVE_DURATION
            });
          }
          
          return mappedItem;
        });

        // Filtrare pe lună (dacă API-ul nu filtrează corect)
        const filteredData = mapped.filter(registro => {
          if (!registro.data) return false;
          const registroMonth = registro.data.substring(0, 7); // YYYY-MM
          // console.log('🔍 Registro date:', registro.data, 'Month:', registroMonth, 'Expected:', month);
          return registroMonth === month;
        });

        loggerDebug('Filtered registros for month', month, ':', filteredData.length);

        // Deduplicare: elimină duplicatele după o combinație unică de CODIGO + FECHA + TIPO + HORA
        const uniqueRegistros = [];
        const seenRegistroKeys = new Set();
        for (const item of filteredData) {
          const key = `${item.codigo || item.CODIGO || ''}_${item.data || item.FECHA || ''}_${item.tipo || item.TIPO || ''}_${item.hora || item.HORA || ''}_${item.id || item.ID || ''}`;
          if (!seenRegistroKeys.has(key)) {
            seenRegistroKeys.add(key);
            uniqueRegistros.push(item);
          }
        }
        
        loggerDebug('Unique registros after deduplication:', uniqueRegistros.length, 'from', filteredData.length);

        // Ordenación correcta: combina fecha y hora para una ordenación cronológica precisa (más reciente primero)
        const sortedRegistros = [...uniqueRegistros].sort((a, b) => {
          const dataA = a.data || a.fecha || '';
          const dataB = b.data || b.fecha || '';
          const horaA = padTime(a.hora || '');
          const horaB = padTime(b.hora || '');

          if (!dataA || !dataB || !horaA || !horaB) return 0;

          const dateTimeA = new Date(`${dataA}T${horaA}`);
          const dateTimeB = new Date(`${dataB}T${horaB}`);
          return dateTimeB - dateTimeA; // Más reciente primero (descending)
        });

        loggerDebug('Sorted registros for month', month, ':', sortedRegistros.length);
        
        // Registros fetched successfully
        
        // IMPORTANT: Actualizează datele doar dacă avem date valide
        // Nu ștergem datele existente dacă nu găsim date pentru luna selectată
        // (poate fi o problemă temporară sau o lună fără registros)
        if (sortedRegistros.length > 0) {
          // Salvează datele mapate și sortate
          setRegistrosBrutos(sortedRegistros);
          
          // OPTIMIZARE: Setează loading false IMEDIAT după ce datele sunt procesate
          // Nu așteptăm verificările de regularizare - ele se fac asincron în background
          setLoadingRegistros(false);
          setChangingMonth(false);
          
          // Verifică asincron pentru fiecare fichaje dacă necesită regularizare (doar pentru Salida fără effective_duration)
          // IMPORTANT: Nu așteptăm toate request-urile - actualizăm map-ul incremental pentru a nu bloca UI-ul
          // IMPORTANT: Verifică autentificarea ÎNAINTE de a procesa itemsToCheck
          if (!authUser) {
            loggerDebug('Skipping check confirmation - user not authenticated (fetchRegistros)');
          } else {
            const itemsToCheck = sortedRegistros.filter(item => 
              item.tipo === 'Salida' && 
              item.duration && 
              !(item.effective_duration && item.effective_duration.trim() !== '') && 
              !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1')
            );
            
            // DEDUPLICARE: Un singur apel API per codigo + data (nu per registru)
            // Folosim un Set pentru a stoca combinațiile unice de codigo + data
            const uniqueChecks = new Map();
            for (const item of itemsToCheck) {
              const codigo = item.codigo || item.CODIGO;
              const data = item.data;
              if (codigo && data) {
                const uniqueKey = `${codigo}_${data}`;
                if (!uniqueChecks.has(uniqueKey)) {
                  uniqueChecks.set(uniqueKey, { codigo, data });
                }
              }
            }
            
            // Verifică debounce înainte de a începe verificarea
            const now = Date.now();
            if (isCheckingConfirmation || (now - lastCheckTime < CHECK_CONFIRMATION_DEBOUNCE)) {
              loggerDebug('Skipping check confirmation - debounce active or already checking (second location)');
              return;
            }
            
            // Marchează că verificăm
            isCheckingConfirmation = true;
            lastCheckTime = now;
            
            // Procesează secvențial cu delay între request-uri pentru a evita rate limiting
            // IMPORTANT: Batch update pentru a evita re-render-uri multiple
            // IMPORTANT: Verifică autentificarea înainte de a face apelurile
            (async () => {
              try {
                // Verifică din nou dacă utilizatorul este încă autentificat
                if (!authUser) {
                  loggerDebug('Skipping check confirmation - user not authenticated');
                  return;
                }
              
              const updates = {}; // Colectează toate update-urile într-un singur batch
              
              for (const { codigo, data } of uniqueChecks.values()) {
                // Verifică din nou autentificarea înainte de fiecare apel
                if (!authUser) {
                  loggerDebug('Stopping check confirmation - user logged out during processing');
                  break;
                }
                
                try {
                  const checkResult = await getCheckConfirmationPromise(callApi, codigo, data, !!authUser);
                  const resultData = checkResult.data || checkResult; // callApi returnează { success: true, data }
                  
                  // Actualizează map-ul pentru TOATE registrele din aceeași zi pentru același angajat
                  // Căutăm toate registrele care corespund acestui codigo + data
                  const matchingItems = itemsToCheck.filter(item => 
                    (item.codigo || item.CODIGO) === codigo && item.data === data
                  );
                  
                  for (const item of matchingItems) {
                    const key = `${item.codigo || item.CODIGO}_${item.data}_${item.tipo}`;
                    updates[key] = checkResult.success && resultData.needs_confirmation;
                  }
                } catch (error) {
                  // Dacă eroarea este 401 (Unauthorized), oprim procesarea
                  if (error?.message?.includes('Unauthorized') || error?.response?.status === 401 || error?.status === 401) {
                    loggerDebug('Stopping check confirmation - unauthorized error');
                    break;
                  }
                  // Dacă verificarea eșuează din alte motive, considerăm că necesită regularizare (afișăm butonul pentru siguranță)
                  const matchingItems = itemsToCheck.filter(item => 
                    (item.codigo || item.CODIGO) === codigo && item.data === data
                  );
                  for (const item of matchingItems) {
                    const key = `${item.codigo || item.CODIGO}_${item.data}_${item.tipo}`;
                    updates[key] = true;
                  }
                }
                // Delay între fiecare request pentru a evita rate limiting
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay între request-uri
              }
              
                // Aplică toate update-urile într-un singur batch pentru a evita re-render-uri multiple
                if (Object.keys(updates).length > 0) {
                  setNeedsRegularizationMap(prev => ({ ...prev, ...updates }));
                }
              } finally {
                // Resetăm flag-ul
                isCheckingConfirmation = false;
              }
            })().catch(err => {
              loggerDebug('Error checking needs regularization:', err);
              isCheckingConfirmation = false;
            });
          }
        } else {
          warn('No registros found for month', month, '- păstrăm datele existente (nu ștergem)');
          // Nu ștergem datele existente - poate fi o problemă temporară sau o lună fără registros
          setLoadingRegistros(false);
          setChangingMonth(false);
        }
      } else {
        logError('[DEBUG] fetchRegistros failed:', result.error);
        // Reset și la eroare
        setRegistrosBrutos([]);
        setRegistros([]);
        setFiltered([]);
        setLoadingRegistros(false);
        setChangingMonth(false);
      }
    } catch (error) {
      logError('Error fetching registros:', error);
      // Reset și la catch
      setRegistrosBrutos([]);
      setRegistros([]);
      setFiltered([]);
      setLoadingRegistros(false);
      setChangingMonth(false);
    }
  }, [authUser, callApi, selectedMonth]);

  // Încarcă angajații și registrele la montarea componentei
  // IMPORTANT: Încarcă doar ziua curentă la montare pentru a evita acumularea de date
  useEffect(() => {
    if (!authUser) {
      return;
    }

    const loadData = async () => {
      await fetchEmpleados();
      // Încarcă doar ziua curentă când se deschide tab-ul
      await fetchRegistros(selectedMonth, true);
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
      
      info('[Fichaje] Folosind backend-ul nou (getRegistrosPeriodo):', url);
      
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
      loggerDebug('Response from period endpoint:', result);
      loggerDebug('Response type:', typeof result);
      loggerDebug('Response is array:', Array.isArray(result));
      
      // Verifică dacă răspunsul conține datele așteptate
      let periodData = [];
      if (result && Array.isArray(result)) {
        periodData = result;
        success('Using result directly as array, length:', periodData.length);
      } else if (result && result.data && Array.isArray(result.data)) {
        periodData = result.data;
        success('Using result.data as array, length:', periodData.length);
      } else if (result && result.registros && Array.isArray(result.registros)) {
        periodData = result.registros;
        success('Using result.registros as array, length:', periodData.length);
      } else {
        warn('Unexpected response format:', result);
        loggerDebug('Available keys:', result ? Object.keys(result) : 'result is null/undefined');
        periodData = [];
      }
      
      // Mapează datele la formatul așteptat (folosind câmpurile din backend)
      const mappedData = periodData.map(item => ({
        id: item.ID || item.id || item._id || null, // Păstrează ID-ul original din backend
        empleado: item['NOMBRE / APELLIDOS'] || item.nombre || item.empleado || item.employee || '',
        data: item.FECHA || item.DATA || item.data || item.fecha || item.date || '',
        tipo: item.TIPO || item.tipo || item.type || '',
        hora: item.HORA || item.hora || item.time || '',
        duration: item.DURACION || item.duration || item.duracion || '', // Ora originală
        effective_duration: item.effective_duration || item.EFFECTIVE_DURATION || null, // Ora regularizată
        effective_minutes: item.effective_minutes || item.EFFECTIVE_MINUTES || null, // Minute efective (pentru calcul)
        has_regularizacion: item.has_regularizacion || item.HAS_REGULARIZACION || 0, // 1 dacă există regularizare, 0 altfel
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
      
      loggerDebug('Mapped data:', sortedMappedData);
      loggerDebug('Mapped data length:', sortedMappedData.length);
      loggerDebug('First mapped item:', sortedMappedData[0]);
      loggerDebug('ID check - First item has ID:', !!sortedMappedData[0]?.id, 'ID value:', sortedMappedData[0]?.id);
      
      setRegistros(sortedMappedData);
      setFiltered(sortedMappedData);
      setShowPeriodSelector(false);
      
      setNotification({
        type: 'success',
        title: 'Período Aplicado',
        message: `Mostrando ${mappedData.length} registros del ${periodStart} al ${periodEnd}`
      });
    } catch (error) {
      logError('Error fetching period data:', error);
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

  // Reîncarcă datele când se schimbă luna (doar dacă utilizatorul schimbă manual luna)
  // Nu se declanșează la montare pentru a evita apeluri duplicate
  useEffect(() => {
    if (!authUser) return;
    
    // La prima montare, nu facem nimic (datele sunt deja încărcate de primul useEffect cu ziua curentă)
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    
    // Doar dacă selectedMonth s-a schimbat manual (nu la montare inițială)
    const loadMonthData = async () => {
      try {
        await fetchRegistros(selectedMonth, false); // Încarcă toată luna când utilizatorul schimbă manual
      } catch (error) {
        warn('[Fichaje] No se pudieron recargar los registros actuales:', error);
      }
    };
    
    loadMonthData();
  }, [selectedMonth, authUser, fetchRegistros]); // Doar când selectedMonth se schimbă manual

  // Debug: afișează form-ul când se deschide modalul
  useEffect(() => {
    if (modalVisible) {
      loggerDebug('Modal opened, form content:', form);
      loggerDebug('editIdx:', editIdx);
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
                [{ text: 'Teléfono: 910 440 275', style: 'companyDetails' }],
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
      logError('Error exporting PDF:', error);
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
      logError('Error exporting to Excel:', error);
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
        loggerDebug('Intentando obtener ubicación...');
      const coords = await locationContext.getCurrentLocation();
      success('Ubicación obtenida:', coords);
        
      // Obține adresa prin reverse geocoding folosind funcția din context
        try {
          loggerDebug('Obteniendo dirección...');
        currentAddress = await locationContext.getAddressFromCoords(coords.latitude, coords.longitude);
        if (currentAddress) {
            success('Dirección obtenida:', currentAddress);
            // Actualizează form-ul cu noua adresă
            setForm(prev => ({ 
              ...prev, 
              address: currentAddress 
            }));
          } else {
            throw new Error('No se encontró dirección en la respuesta');
          }
        } catch {
          warn('No se pudo obtener la dirección, usando coordenadas');
        currentAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
          setForm(prev => ({ 
            ...prev, 
            address: currentAddress 
          }));
      }
    } catch (error) {
      logError('Error obteniendo ubicación:', error);
      
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
    loggerDebug('openEdit called with idx:', idx);
    
    // IMPORTANT: Folosește 'filtered' în loc de 'registros' pentru a obține datele corecte din lista afișată
    const displayedRegistros = selectedEmpleado 
      ? filtered.filter(item => item.empleado === selectedEmpleado)
      : filtered;
    
    loggerDebug('displayedRegistros[idx]:', displayedRegistros[idx]);
    loggerDebug('selectedEmpleado:', selectedEmpleado);
    loggerDebug('form.empleado before set:', displayedRegistros[idx]?.empleado);
    
    // Deschide modalul imediat cu datele existente
    const registroData = displayedRegistros[idx];
    
    // Debug: verifică dacă există angajat în form
    if (!registroData) {
      logError('No data found at index:', idx);
      return;
    }
    
    loggerDebug('Setting form with:', {
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
        } catch {
          warn('No se pudo obtener la dirección, usando coordenadas');
        currentAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
          setForm(prev => ({ 
            ...prev, 
            address: currentAddress 
          }));
      }
    } catch (error) {
      logError('Error obteniendo ubicación para edición:', error);
      
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
    
    setSaving(true);
    try {
      // Găsește angajatul selectat pentru a obține codigo și email
      const empleadoSeleccionado = empleados.find(emp => emp.nombre === form.empleado);
      if (!empleadoSeleccionado) {
        setNotification({
          type: 'error',
          title: 'Error de Empleado',
          message: '¡No se encontró el empleado seleccionado!'
        });
        setSaving(false);
        return;
      }

      // Preia ID-ul corect pentru editare
      let registroId = null;
      if (editIdx !== null) {
        registroId = form.id || registros[editIdx]?.id || null;
        
        // Debug: verifică dacă ID-ul este inclus
        loggerDebug('Edit mode - ID check:', {
          formId: form.id,
          registroId: registros[editIdx]?.id,
          finalId: registroId,
          hasId: !!registroId,
          registroOriginal: registros[editIdx]
        });
        
        // Dacă ID-ul lipsește complet, nu putem continua
        if (!registroId) {
          logError('CRITICAL: ID lipsește complet pentru registrul de editat!');
          setNotification({
            type: 'error',
            title: 'Error de Identificación',
            message: 'No se pudo identificar el registro. Por favor, recarga la página e intenta de nuevo.'
          });
          setSaving(false);
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
          info('Eliminada duración (Salida → Entrada)');
        }
        
        // Duration is now calculated by database triggers - no need for frontend calculation
        
        // Duration is now calculated by database triggers - no need for frontend calculation
      }
      
      // Debug: afișează datele care se trimit
      loggerDebug('Saving registro:', {
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
      
      info(`[Fichaje] Folosind backend-ul nou (${editIdx !== null ? 'updateFichaje' : 'addFichaje'}):`, endpoint);
      loggerDebug('Sending request to:', endpoint, 'Method:', method);
      loggerDebug('Request body:', JSON.stringify(newReg, null, 2));
      loggerDebug('ID in request:', newReg.id);
      
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
      loggerDebug('Response received:', result);
      loggerDebug('Response ID:', result?.data?.id || result?.id);

      if (result.success) {
        // Log crear/actualizar el registro
        if (editIdx !== null) {
          await activityLogger.logFichajeUpdated(newReg, authUser);
          
          // Debug: verifică dacă ID-ul din răspuns este diferit
          if (result?.data?.id && result.data.id !== '[Execute previous nodes for preview]') {
            success('Update successful, ID from response:', result.data.id);
          } else {
            warn('Response ID invalid, using original ID:', newReg.id);
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
        // Detectăm eroarea specifică despre fichajes consecutive
        let errorTitle = 'Error de Guardado';
        let errorMessage = result.error || 'No se pudo guardar el registro. Por favor, intenta de nuevo.';
        
        const errorText = (result.error || '').toLowerCase();
        
        // Verifică dacă este eroarea despre fichajes consecutive
        if (errorText.includes('nu se pot înregistra') || 
            errorText.includes('2 entrada/2 salida consecutive') ||
            errorText.includes('consecutive')) {
          errorTitle = 'Error al Registrar';
          
          // Detectează tipul specific de eroare
          if (errorText.includes('2 entrada') && !errorText.includes('2 salida')) {
            // Doar Entrada consecutivă
            errorMessage = 'No se pueden registrar 2 Entradas consecutivas. Es posible que hayas olvidado cerrar la entrada anterior. Por favor, verifica tus registros.';
          } else if (errorText.includes('2 salida') && !errorText.includes('2 entrada')) {
            // Doar Salida consecutivă
            errorMessage = 'No se pueden registrar 2 Salidas consecutivas. Es posible que hayas olvidado cerrar la salida anterior. Por favor, verifica tus registros.';
          } else {
            // Ambele tipuri sau mesaj generic
            errorMessage = 'No se pueden registrar 2 fichajes del mismo tipo consecutivos. Es posible que hayas olvidado cerrar el registro anterior. Por favor, verifica tus registros.';
          }
        }
        
        setNotification({
          type: 'error',
          title: errorTitle,
          message: errorMessage
        });
      }
    } catch (error) {
      logError('Error saving registro:', error);
      
      // Detectăm eroarea specifică despre fichajes consecutive
      let errorTitle = t('error.saveError');
      let errorMessage = t('error.saveErrorSimple');
      
      const errorText = error?.message || error?.toString() || '';
      if (errorText.includes('Nu se pot înregistra 2 Entrada') || 
          errorText.includes('Nu se pot înregistra 2 Salida') ||
          errorText.includes('2 Entrada/2 Salida consecutive') ||
          errorText.includes('consecutive')) {
        errorTitle = 'Error al Registrar';
        if (errorText.includes('Entrada')) {
          errorMessage = 'No se pueden registrar 2 Entradas consecutivas. Es posible que hayas olvidado cerrar la entrada anterior. Por favor, verifica tus registros.';
        } else if (errorText.includes('Salida')) {
          errorMessage = 'No se pueden registrar 2 Salidas consecutivas. Es posible que hayas olvidado cerrar la salida anterior. Por favor, verifica tus registros.';
        } else {
          errorMessage = 'No se pueden registrar 2 fichajes del mismo tipo consecutivos. Es posible que hayas olvidado cerrar el registro anterior. Por favor, verifica tus registros.';
        }
      }
      
      setNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (idx) => {
    // Verificăm dacă registro-ul există
    if (idx < 0 || idx >= registros.length) {
      logError('Invalid registro index:', idx);
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
      <div className={`flex items-center gap-4 mb-6`}>
        <div className="relative">
          <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg`}>
            <span className={`text-white ${isMobile ? 'text-lg' : 'text-xl'}`}>👥</span>
          </div>
          {/* Glow effect */}
          <div className={`absolute inset-0 ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-blue-400 rounded-xl opacity-20 blur-md animate-pulse`}></div>
        </div>
        <div>
          <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>
            Registros de Empleados
          </h1>
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
            Administra y supervisa los marcajes del equipo
          </p>
        </div>
      </div>

      {/* Butoane de export și refresh - Modernos */}
      <div className={`flex flex-wrap gap-4 mb-6`}>
        <button
          onClick={() => {
            // Actualizează cu luna curentă, nu cu luna selectată
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            loggerDebug('Actualizando con luna actual:', currentMonth);
            fetchRegistros(currentMonth);
            // Actualizează și selectorul de lună la luna curentă
            setSelectedMonth(currentMonth);
          }}
          className={`group relative ${isMobile ? 'px-4 py-2' : 'px-6 py-3'} rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200`}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className={`${isMobile ? 'text-base' : 'text-lg'} group-hover:scale-110 transition-transform duration-300`}>🔄</span>
            <span className={isMobile ? 'text-xs' : 'text-sm'}>Actualizar</span>
          </div>
        </button>
        
        <button
          onClick={handleExportPDF}
          className={`group relative ${isMobile ? 'px-4 py-2' : 'px-6 py-3'} rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200`}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className={`${isMobile ? 'text-base' : 'text-lg'} group-hover:scale-110 transition-transform duration-300`}>📄</span>
            <span className={isMobile ? 'text-xs' : 'text-sm'}>{isMobile ? 'PDF' : 'Exportar PDF'}</span>
          </div>
        </button>
        
        <button
          onClick={handleExportExcel}
          className={`group relative ${isMobile ? 'px-4 py-2' : 'px-6 py-3'} rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200`}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-emerald-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <span className={`${isMobile ? 'text-base' : 'text-lg'} group-hover:scale-110 transition-transform duration-300`}>📊</span>
            <span className={isMobile ? 'text-xs' : 'text-sm'}>{isMobile ? 'Excel' : 'Exportar Excel'}</span>
          </div>
        </button>
      </div>

      {/* Buton adăugare - Moderno */}
      <button
        onClick={openAdd}
        className={`group relative w-full ${isMobile ? 'px-4 py-3' : 'px-8 py-4'} rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
        <div className="relative flex items-center justify-center gap-3">
          <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
            <span className={`text-white ${isMobile ? 'text-base' : 'text-xl'} group-hover:scale-110 transition-transform duration-300`}>➕</span>
          </div>
          <div className="text-left">
            <div className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>Añadir Registro</div>
            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Crear nuevo fichaje</div>
          </div>
        </div>
      </button>

      {/* Buton pentru afișarea/ascunderea listei de angajați - Moderno */}
      <button
        onClick={() => setShowEmpleados(!showEmpleados)}
        className={`group relative w-full ${isMobile ? 'px-4 py-2' : 'px-6 py-3'} rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-20 blur-md animate-pulse group-hover:opacity-30 transition-all duration-300"></div>
        <div className="relative flex items-center justify-center gap-2">
          <span className={`${isMobile ? 'text-base' : 'text-lg'} group-hover:scale-110 transition-transform duration-300`}>
            {showEmpleados ? '🔼' : '🔽'}
          </span>
          <span className={isMobile ? 'text-xs' : 'text-sm'}>{showEmpleados ? (isMobile ? 'Ocultar' : 'Ocultar Lista de Empleados') : (isMobile ? 'Mostrar Empleados' : 'Mostrar Lista de Empleados')}</span>
        </div>
      </button>

      {/* Lista angajați - ascunsă/afișată */}
      {showEmpleados && (
        <Card>
          <h2 className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-red-600 mb-4`}>Lista de empleados</h2>
          
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
                        className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors`}
                        onClick={() => setSelectedEmpleado(item.nombre)}
                      >
                        <div>
                          <p className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-red-600`}>{item.nombre}</p>
                          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>{item.email}</p>
                          {item.grupo && (
                            <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500`}>Grupo: {item.grupo}</p>
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
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center transition-all duration-300 ${
              changingMonth ? 'bg-yellow-100 animate-pulse' : 'bg-red-100'
            }`}>
              <span className={`${isMobile ? 'text-base' : 'text-lg'} transition-all duration-300 ${
                changingMonth ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {changingMonth ? '⏳' : '📊'}
              </span>
            </div>
            <div>
          <h2 className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-red-600`}>
                {selectedEmpleado ? (isMobile ? `Marcajes: ${selectedEmpleado.length > 15 ? selectedEmpleado.substring(0, 15) + '...' : selectedEmpleado}` : `Marcajes para: ${selectedEmpleado}`) : (isMobile ? `Registros ${new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}` : `Registros de ${new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`)}
                {!changingMonth && filtered.length > 0 && (
                  <span className={`ml-3 px-3 py-1 bg-blue-100 text-blue-700 rounded-full ${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
                    {selectedEmpleado 
                      ? (() => {
                          const empleadoRegistros = filtered.filter(item => item.empleado === selectedEmpleado);
                          return `${empleadoRegistros.length} ${empleadoRegistros.length === 1 ? 'reg.' : 'regs.'}`;
                        })()
                      : `${filtered.length} ${filtered.length === 1 ? 'reg.' : 'regs.'}`
                    }
                  </span>
                )}
          </h2>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                {changingMonth ? 'Cargando registros...' : (isMobile ? 'Administra marcajes' : 'Administra los marcajes de los empleados')}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Afișează ziua curentă/perioada activă */}
            {!isPeriodMode ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {(() => {
                    const today = new Date();
                    const day = today.getDate();
                    const monthName = today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                    return `${day} de ${monthName}`;
                  })()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {periodStart} - {periodEnd}
                </span>
              </div>
            )}

            {/* Buton pentru selecția perioadei/mes */}
            <button
              onClick={() => setShowPeriodSelector(!showPeriodSelector)}
              disabled={changingMonth}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
                changingMonth ? 'opacity-50 cursor-not-allowed transform-none' : ''
              } ${isPeriodMode ? 'ring-2 ring-red-300' : ''}`}
              title={isPeriodMode ? 'Período personalizado activo' : 'Seleccionar período o mes'}
            >
              <span className="text-lg">📅</span>
              {isPeriodMode ? 'Período Activo' : 'Filtrar'}
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
            
            {/* Buton ULTRA MODERN "Hoy" - 3D + Glassmorphism - RESPONSIVE - Ascuns pe mobile */}
            {!isMobile && (
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
            )}
            
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
                        Duración regularizada
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
                        {item.tipo === 'Salida' ? (
                          item.duration ? (
                            <span className="inline-flex items-center gap-1 text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded text-xs whitespace-nowrap">
                              ⏱ {item.duration}
                            </span>
                          ) : (
                            <span className="text-red-600 text-xs">⚠️ Sin duración</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.tipo === 'Salida' ? (
                          <div className="flex flex-col gap-1">
                            {/* Debug log removed - was causing repeated executions on every render */}
                            {item.effective_duration && item.effective_duration.trim() !== '' ? (
                              <span 
                                className="inline-flex items-center gap-1 text-green-700 font-bold bg-green-100 px-2 py-1 rounded text-xs whitespace-nowrap cursor-help"
                                title="El tiempo efectivo es el que se tiene en cuenta según el horario confirmado."
                              >
                                ✅ {item.effective_duration}
                              </span>
                            ) : (
                              <>
                                <span className="text-gray-400 text-xs">-</span>
                                {/* Buton Regularizar pentru managers - apare mereu dacă are duration dar nu există regularizare */}
                                {item.duration && 
                                  !(item.effective_duration && item.effective_duration.trim() !== '') && 
                                  !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1') && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        // Verifică dacă managerul încearcă să-și regularizeze propriul registru
                                        const employeeCodigo = item.codigo || item.CODIGO;
                                        const userCodigo = authUser?.CODIGO || authUser?.codigo;
                                        const isOwnRecord = employeeCodigo && userCodigo && employeeCodigo.toString() === userCodigo.toString();
                                        
                                        if (isManager && !isOwnRecord) {
                                          // Supervisor: solicită regularizare pentru alt angajat (creează NEEDS_REVIEW)
                                          const result = await callApi(routes.requestRegularizacion, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
                                              fecha: item.data,
                                            }),
                                          });
                                          if (result.success) {
                                            setNotification({
                                              type: 'success',
                                              title: 'Regularización solicitada',
                                              message: 'El empleado recibirá una notificación para confirmar.',
                                            });
                                            fetchRegistros(selectedMonth).catch(err => {
                                              console.error('Error reloading registros:', err);
                                            });
                                          }
                                      } else {
                                        // Angajat sau manager care își regularizează propriul registru: deschide modalul de confirmare
                                        const checkResult = await getCheckConfirmationPromise(callApi, item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo, item.data, !!authUser);
                                        const resultData = checkResult.data || checkResult;
                                        
                                        // Verifică dacă există program prevăzut (scheduled_minutes > 0) și dacă necesită confirmare
                                        if (checkResult.success && resultData.needs_confirmation && resultData.scheduled_minutes > 0) {
                                          setConfirmarJornadaData({
                                            ...resultData,
                                            fecha: item.data,
                                            employee_codigo: item.codigo || item.empleado || authUser?.CODIGO || authUser?.codigo,
                                          });
                                          setShowConfirmarJornadaModal(true);
                                        } else if (checkResult.success && resultData.scheduled_minutes === 0) {
                                          // Nu există program prevăzut - nu se permite regularizarea
                                          setNotification({
                                            type: 'info',
                                            title: 'No se puede regularizar',
                                            message: 'No hay horario previsto para este día. No se puede regularizar.',
                                          });
                                        } else {
                                          setNotification({
                                            type: 'error',
                                            title: 'Error',
                                            message: 'No se pudo verificar la diferencia. Intenta de nuevo.',
                                          });
                                        }
                                      }
                                      } catch (err) {
                                        console.error('Error regularizando:', err);
                                        setNotification({
                                          type: 'error',
                                          title: 'Error',
                                          message: 'Error al solicitar regularización. Intenta de nuevo.',
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors whitespace-nowrap"
                                  >
                                    🔄 Regularizar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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

            {/* Mobile: Lista compactă similară cu Mi Fichaje */}
            <div className="lg:hidden space-y-2">
              {(selectedEmpleado 
                ? filtered.filter(item => item.empleado === selectedEmpleado)
                : filtered
              ).map((item, index) => (
                <MobileRegistroEmpleadoItem
                  key={index}
                  item={item}
                  index={index}
                  authUser={authUser}
                  isManager={isManager}
                  callApi={callApi}
                  setNotification={setNotification}
                  fetchRegistros={fetchRegistros}
                  selectedMonth={selectedMonth}
                  setConfirmarJornadaData={setConfirmarJornadaData}
                  setShowConfirmarJornadaModal={setShowConfirmarJornadaModal}
                  routes={routes}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            
            {/* Mobile: Carduri (vechi - păstrat pentru referință, dar nu se mai folosește) */}
            <div className="lg:hidden space-y-3 hidden">
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
                      <div className="text-sm font-semibold text-gray-900">
                        {item.tipo === 'Salida' ? (
                          item.duration ? (
                            <span className="text-gray-700">⏱ {item.duration}</span>
                          ) : (
                            <span className="text-red-600 text-xs">⚠️ Sin duración</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="block text-xs font-medium text-gray-600 mb-1">Duración regularizada</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {item.tipo === 'Salida' ? (
                          item.effective_duration && item.effective_duration.trim() !== '' ? (
                            <span 
                              className="inline-flex items-center gap-1 text-green-700 font-bold cursor-help"
                              title="El tiempo efectivo es el que se tiene en cuenta según el horario confirmado."
                            >
                              ✅ {item.effective_duration}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-400 text-xs">-</span>
                              {/* Buton Regularizar pentru managers - apare mereu dacă are duration dar nu există regularizare */}
                              {item.duration && 
                                !(item.effective_duration && item.effective_duration.trim() !== '') && 
                                !(item.has_regularizacion === 1 || item.has_regularizacion === true || item.has_regularizacion === '1') && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const result = await callApi(routes.requestRegularizacion, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          employee_codigo: item.empleado || item.codigo,
                                          fecha: item.data,
                                        }),
                                      });
                                      if (result.success) {
                                        setNotification({
                                          type: 'success',
                                          title: 'Regularización solicitada',
                                          message: 'El empleado recibirá una notificación para confirmar.',
                                        });
                                        // Reîncarcă registros
                                        fetchRegistros(selectedMonth).catch(err => {
                                          console.error('Error reloading registros:', err);
                                        });
                                      }
                                    } catch (err) {
                                      console.error('Error regularizando:', err);
                                      setNotification({
                                        type: 'error',
                                        title: 'Error',
                                        message: 'Error al solicitar regularización. Intenta de nuevo.',
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors"
                                >
                                  🔄 Regularizar
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 mb-3">
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
                              loggerDebug('Setting empleado from dropdown:', empleado.nombre);
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
              <span className="flex items-center gap-2">
                Ubicación del Registro
                <div className="group relative">
                  <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                    <div className="text-center">
                      Este permiso es obligatorio para fichar. La ubicación solo se usa al registrar la jornada.
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </span>
            </h4>
            <div className="space-y-2">
              {/* Input editabil pentru direcție */}
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección del registro..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
              />
              
              {/* Buton pentru obținere automată direcție */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <span>📍</span>
                  La ubicación se actualiza automáticamente con tu posición actual
                </p>
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
                        } catch {
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
                  className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg border border-blue-300 transition-colors flex items-center gap-1"
                  title="Obtener ubicación automáticamente"
                >
                  {form.address === 'Obteniendo ubicación...' ? (
                    <>
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Obteniendo...
                    </>
                  ) : (
                    <>
                      📍 Obtener Ubicación
                    </>
                  )}
                </button>
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
              disabled={saving}
              className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
              <div className="relative flex items-center gap-2">
                <span className="text-lg group-hover:scale-110 transition-transform duration-300">
                  {saving ? '⏳' : editIdx !== null ? '💾' : '✅'}
                </span>
                <span>
                  {saving ? 'Guardando...' : editIdx !== null ? 'Guardar Cambios' : 'Guardar Registro'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru selecția perioadei/mes */}
      {showPeriodSelector && (
        <Modal isOpen={showPeriodSelector} onClose={() => setShowPeriodSelector(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Seleccionar Período</h2>
            
            {/* Toggle între Mes și Rango de fechas */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button
                onClick={() => setPeriodSelectorMode('mes')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  periodSelectorMode === 'mes'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                📅 Por Mes
              </button>
              <button
                onClick={() => setPeriodSelectorMode('rango')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  periodSelectorMode === 'rango'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                📆 Por Rango
              </button>
            </div>
            
            {/* Conținut în funcție de modul selectat */}
            {periodSelectorMode === 'mes' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Selecciona un mes para filtrar los registros
                </p>
                
                <div>
                  <label htmlFor="modal-month-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Mes
                  </label>
                  <div className="relative">
                    <select
                      id="modal-month-select"
                      name="modal-month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={changingMonth}
                      className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 w-full text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                          <option key={`modal-month-${i}-${value}`} value={value}>
                            {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
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
                    onClick={() => {
                      setIsPeriodMode(false);
                      setPeriodStart('');
                      setPeriodEnd('');
                      fetchRegistros(selectedMonth, false);
                      setShowPeriodSelector(false);
                    }}
                    loading={changingMonth}
                  >
                    Aplicar Mes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                    Aplicar Rango
                  </Button>
                </div>
              </div>
            )}
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

      {/* Modal Confirmar Jornada */}
      <ConfirmarJornadaModal
        isOpen={showConfirmarJornadaModal}
        onClose={() => {
          setShowConfirmarJornadaModal(false);
          setConfirmarJornadaData(null);
        }}
        onConfirm={() => {
          // Reîncarcă registros după confirmare
          fetchRegistros(selectedMonth).catch(err => {
            warn('Error reloading registros after confirmation:', err);
          });
        }}
        data={confirmarJornadaData}
      />
    </div>
  );
}
export default function FichajePage() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  const { isMobile } = useBreakpoint();
  
  // Permisiuni din backend pentru fichar - folosim DOAR permisiunile din backend
  const { hasPermission, loading: loadingPermissions, hasBackendPermissions } = usePermissions();
  
  // Verifică permisiunile - SIMPLU:
  // fichar-empleados = doar 1 tab (MiFichajeScreen)
  // fichar-admin = acces total (toate tab-urile)
  // Folosim DOAR permisiunile din backend - fără fallback la isManager
  const hasFicharEmpleadosPermission = hasBackendPermissions ? hasPermission('fichar-empleados') : false;
  const hasFicharAdminPermission = hasBackendPermissions ? hasPermission('fichar-admin') : false;
  
  // Acces la pagină = are cel puțin una dintre permisiuni (DOAR din backend)
  const canAccessPage = hasFicharEmpleadosPermission || hasFicharAdminPermission;
  
  // Acces la toate tab-urile = doar fichar-admin
  const canAccessAllTabs = hasFicharAdminPermission;
  
  // activeTab pentru manageri (personal/empleados/horas/permitidas)
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
  
  // State pentru ausencias (folosit pentru verificarea "Ausencias justificada" în modal)
  const [ausenciasForModal, setAusenciasForModal] = useState([]);
  
  // Verifică dacă există "Ausencias justificada" pentru ziua curentă
  const hasAusenciaJustificadaHoy = useMemo(() => {
    if (!ausenciasForModal || ausenciasForModal.length === 0) return false;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    return ausenciasForModal.some(a => {
      const tipo = (a.TIPO || a.tipo || '').toLowerCase();
      const esAusenciaJustificada = tipo.includes('ausencia') && tipo.includes('justificada');
      
      if (!esAusenciaJustificada) return false;
      
      const ausenciaFecha = a.FECHA || a.fecha || a.data;
      const fechaInicio = a.fecha_inicio || a.fechaInicio || a.FECHA_INICIO;
      const fechaFin = a.fecha_fin || a.fechaFin || a.FECHA_FIN;
      
      // Verifică data exactă
      if (ausenciaFecha && ausenciaFecha.startsWith(todayStr)) {
        return true;
      }
      
      // Verifică interval de date
      if (fechaInicio && fechaFin) {
        const inicioDateStr = fechaInicio.split('T')[0];
        const finDateStr = fechaFin.split('T')[0];
        
        if (inicioDateStr === finDateStr) {
          return todayStr === inicioDateStr;
        }
        
        const todayDateOnly = new Date(todayStr);
        const inicioDateOnly = new Date(inicioDateStr);
        const finDateOnly = new Date(finDateStr);
        
        todayDateOnly.setHours(0, 0, 0, 0);
        inicioDateOnly.setHours(0, 0, 0, 0);
        finDateOnly.setHours(23, 59, 59, 999);
        
        return todayDateOnly >= inicioDateOnly && todayDateOnly <= finDateOnly;
      }
      
      // Verifică interval din ausenciaFecha
      if (ausenciaFecha && ausenciaFecha.includes(' - ')) {
        const [fechaInicioStr, fechaFinStr] = ausenciaFecha.split(' - ');
        const inicio = new Date(fechaInicioStr);
        const fin = new Date(fechaFinStr);
        
        const todayDateOnly = new Date(today);
        const inicioDateOnly = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const finDateOnly = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
        
        todayDateOnly.setHours(0, 0, 0, 0);
        inicioDateOnly.setHours(0, 0, 0, 0);
        finDateOnly.setHours(23, 59, 59, 999);
        
        return todayDateOnly >= inicioDateOnly && todayDateOnly <= finDateOnly;
      }
      
      return false;
    });
  }, [ausenciasForModal]);
  
  // Încarcă ausencias pentru modal (pentru verificarea "Ausencias justificada")
  useEffect(() => {
    const fetchAusenciasForModal = async () => {
      if (!authUser?.CODIGO) return;
      
      try {
        const token = localStorage.getItem('auth_token');
        const url = `${routes.getAusencias}?codigo=${encodeURIComponent(authUser.CODIGO)}`;
        const headers = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const result = await callApi(url, { headers });
        
        if (result.success) {
          const rawData = Array.isArray(result.data) ? result.data : [result.data];
          setAusenciasForModal(rawData);
        }
      } catch (error) {
        loggerDebug('Error fetching ausencias for modal:', error);
      }
    };
    
    fetchAusenciasForModal();
  }, [authUser?.CODIGO, callApi]);
  
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
  
  // State pentru horario_multicentro asignat
  const [horarioMulticentroAsignado, setHorarioMulticentroAsignado] = useState(null);
  const [loadingHorarioMulticentro, setLoadingHorarioMulticentro] = useState(false);
  
  // State pentru datele complete ale utilizatorului
  const [userData, setUserData] = useState(null);
  
  // Ref pentru a preveni re-apelurile inutile ale fetchHorarioAsignado
  const lastHorarioFetchRef = useRef({ centro: null, grupo: null });
  
  // Ref pentru a preveni re-apelurile inutile ale fetchCuadranteAsignado
  const lastCuadranteFetchRef = useRef({ codigo: null, month: null });
  
  // Ref pentru a preveni re-apelurile inutile ale fetchHorarioMulticentroAsignado
  const lastHorarioMulticentroFetchRef = useRef({ codigo: null, month: null });
  
  // Folosim locația globală din LocationContext pentru funcțiile handleOpenIncidenciaModal și handleFicharIncidencia
  const locationContext = useLocation();
  const locationContextRef = useRef(locationContext);
  
  // Actualizează ref-ul când locationContext se schimbă
  useEffect(() => {
    locationContextRef.current = locationContext;
  }, [locationContext]);

  // Funcție pentru încărcarea datelor complete ale utilizatorului
  const fetchUserData = useCallback(async () => {
    try {
      const email = authUser?.email;
      if (!email) return;

      // Skip real data fetch in DEMO mode
      if (authUser?.isDemo) {
        demo('Using demo user data instead of fetching from backend');
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
      loggerDebug('FichajePage raw data from backend:', users);
      
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
          'TrabajaFestivos': found['TrabajaFestivos'] || found.trabajaFestivos || found.TRABAJA_FESTIVOS || 'NO',
        };
        loggerDebug('FichajePage mapped user:', mappedUser);
        setUserData(mappedUser);
      } else {
        setUserData(found);
      }
    } catch (e) {
      logError('Error fetching user data:', e);
    }
  }, [authUser]);

  // Funcție pentru a încărca cuadrantul asignat
  const fetchCuadranteAsignado = useCallback(async () => {
    const codigoEmpleado = authUser?.CODIGO || authUser?.codigo || '';
    if (!codigoEmpleado) {
      loggerDebug('Nu există codigo pentru cuadrante');
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
      
      loggerDebug('Cuadrantes primite din backend:', lista);
      loggerDebug('Primul cuadrante (exemplu):', lista[0]);
      loggerDebug('Toate câmpurile primului cuadrante:', lista[0] ? Object.keys(lista[0]) : 'Nu există cuadrante');
      
      if (lista.length > 0) {
        loggerDebug('Căutare cuadrante pentru luna:', currentMonthFormatted);
        loggerDebug('Toate lunile din cuadrantes:', lista.map(c => ({ 
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
          success('Cuadrante găsit pentru luna curentă:', cuadranteMatch);
          setCuadranteAsignado(cuadranteMatch);
        } else {
          warn('Nu s-a găsit cuadrante pentru luna curentă');
          setCuadranteAsignado(null);
        }
      } else {
        warn('Nu există cuadrantes pentru acest angajat');
        setCuadranteAsignado(null);
      }
    } catch (error) {
      logError('Eroare la încărcarea cuadrantului asignat:', error);
      setCuadranteAsignado(null);
    } finally {
      setLoadingCuadrante(false);
    }
  }, [authUser, loadingCuadrante]);

  // Funcție pentru a încărca horario_multicentro asignat
  const fetchHorarioMulticentroAsignado = useCallback(async () => {
    loggerDebug('🔍 fetchHorarioMulticentroAsignado - Apelat');
    const codigoEmpleado = authUser?.CODIGO || authUser?.codigo || '';
    if (!codigoEmpleado) {
      loggerDebug('Nu există codigo pentru horario_multicentro');
      setHorarioMulticentroAsignado(null);
      return;
    }

    // Găsește horario_multicentro pentru luna curentă
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    loggerDebug(`🔍 fetchHorarioMulticentroAsignado - CODIGO: ${codigoEmpleado}, LUNA: ${currentMonthFormatted}`);
    
    // Previne re-apelurile inutile dacă codigo și luna nu s-au schimbat
    if (lastHorarioMulticentroFetchRef.current.codigo === codigoEmpleado && 
        lastHorarioMulticentroFetchRef.current.month === currentMonthFormatted &&
        !loadingHorarioMulticentro) {
      return;
    }
    
    lastHorarioMulticentroFetchRef.current = { codigo: codigoEmpleado, month: currentMonthFormatted };
    
    setLoadingHorarioMulticentro(true);
    try {
      const token = localStorage.getItem('auth_token');
      const url = `${routes.baseUrl}/api/horarios/multicentro?codigo=${encodeURIComponent(codigoEmpleado)}&mes=${currentMonthFormatted}`;
      loggerDebug(`🔍 fetchHorarioMulticentroAsignado - URL: ${url}`);
      loggerDebug(`🔍 fetchHorarioMulticentroAsignado - Token exists: ${!!token}`);
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      loggerDebug(`🔍 fetchHorarioMulticentroAsignado - Headers:`, headers);
      const res = await fetch(url, {
        method: 'GET',
        headers: headers,
      });
      loggerDebug(`🔍 fetchHorarioMulticentroAsignado - Response status: ${res.status}, statusText: ${res.statusText}`);

      // Verifică dacă răspunsul este OK și este JSON
      if (!res.ok) {
        const text = await res.text();
        logError(`❌ Error ${res.status} la fetchHorarioMulticentroAsignado: ${text.substring(0, 200)}`);
        setHorarioMulticentroAsignado(null);
        return;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        logError(`❌ Răspunsul nu este JSON: ${contentType} - ${text.substring(0, 200)}`);
        setHorarioMulticentroAsignado(null);
        return;
      }

      const data = await res.json();
      const lista = Array.isArray(data.horarios) ? data.horarios : [];
      
      loggerDebug('Horarios_multicentro primite din backend:', lista);
      
      if (lista.length > 0) {
        // Pentru ziua curentă, combinăm toate horarios_multicentro într-un singur obiect
        const today = new Date().getDate();
        const dayKey = `ZI_${today}`;
        
        loggerDebug(`🔍 Căutăm orar pentru ziua ${today} (${dayKey}) în ${lista.length} horarios_multicentro`);
        
        // Găsește primul horario_multicentro care are orar pentru ziua curentă (nu LIBRE)
        const horarioMatch = lista.find(horario => {
          // Verifică toate variantele posibile de nume pentru câmp (lowercase/uppercase)
          const daySchedule = horario[dayKey] || horario[dayKey.toLowerCase()] || horario[dayKey.toUpperCase()];
          loggerDebug(`  - Verific ${horario.CLIENTE || 'N/A'} - ${horario.HORARIO || 'N/A'}: ZI_${today} = ${daySchedule} (type: ${typeof daySchedule}), exists: ${!!daySchedule}`);
          // Listă toate cheile disponibile pentru debugging
          const allKeys = Object.keys(horario).filter(k => k.toUpperCase().startsWith('ZI_'));
          loggerDebug(`    All ZI keys in horario: ${allKeys.join(', ')}`);
          if (daySchedule) {
            const trimmed = String(daySchedule).trim();
            const isValid = trimmed !== '' && trimmed !== 'LIBRE' && trimmed !== '0' && trimmed !== '0h';
            loggerDebug(`    Valid? ${isValid} (trimmed: "${trimmed}")`);
            return isValid;
          }
          return false;
        });
        
        if (horarioMatch) {
          loggerDebug(`✅ Horario_multicentro găsit pentru ziua ${today}: ${horarioMatch.CLIENTE} - ${horarioMatch.HORARIO} - ZI_${today} = ${horarioMatch[dayKey]}`);
          success('Horario_multicentro găsit pentru luna curentă:', horarioMatch);
          setHorarioMulticentroAsignado(horarioMatch);
        } else {
          // Dacă nu există orar pentru ziua curentă, dar există pentru luna curentă, nu setăm fallback
          // pentru că ar genera confuzie - utilizatorul nu are orar pentru ziua de astăzi
          loggerDebug(`⚠️ Nu s-a găsit horario_multicentro pentru ziua ${today} în ${lista.length} înregistrări disponibile`);
          loggerDebug(`  Primele 3 înregistrări:`, lista.slice(0, 3).map(h => ({
            cliente: h.CLIENTE,
            horario: h.HORARIO,
            [`ZI_${today}`]: h[dayKey]
          })));
          setHorarioMulticentroAsignado(null);
        }
      } else {
        warn('Nu există horarios_multicentro pentru acest angajat');
        setHorarioMulticentroAsignado(null);
      }
    } catch (error) {
      logError('Eroare la încărcarea horario_multicentro asignat:', error);
      setHorarioMulticentroAsignado(null);
    } finally {
      setLoadingHorarioMulticentro(false);
    }
  }, [authUser, loadingHorarioMulticentro]);

  // State pentru verificarea existenței orarului (cuadrante, horario_multicentro, sau horarios normal)
  const [hasAnySchedule, setHasAnySchedule] = useState(false);
  
  // Funcție pentru a verifica dacă angajatul are orar (orice tip)
  // Returnează true/false direct pentru a fi folosit în callback-uri
  const checkHasSchedule = useCallback(async () => {
    if (!authUser?.CODIGO) {
      setHasAnySchedule(false);
      return false;
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      const response = await fetch(`${routes.baseUrl}/api/horarios/has-schedule?codigo=${encodeURIComponent(authUser.CODIGO)}&mes=${currentMonth}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const hasSchedule = result.hasSchedule || false;
      setHasAnySchedule(hasSchedule);
      return hasSchedule;
    } catch (error) {
      loggerDebug('Eroare la verificarea orarului:', error);
      setHasAnySchedule(false);
      return false;
    }
  }, [authUser?.CODIGO]);

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
        loggerDebug('Răspuns complet din backend:', response);
        loggerDebug('Toate orarele din backend (complet):', response.data);
        loggerDebug('Primul orar din backend (exemplu):', response.data[0]);
        
        loggerDebug('Utilizator:', { centroUsuario, grupoUsuario });
        loggerDebug('Toate câmpurile utilizatorului:', userData || authUser);
        loggerDebug('Orare din backend (simplificat):', response.data.map(h => ({ 
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
          success('Orar găsit (COMPLET):', horarioMatch);
          loggerDebug('Orar găsit - days:', horarioMatch.days);
          loggerDebug('Orar găsit - Luni:', horarioMatch.days?.L);
          loggerDebug('Orar găsit - Martes:', horarioMatch.days?.M);
          setHorarioAsignado(horarioMatch);
        } else {
          // Verifică dacă există cuadrante sau horario_multicentro
          // Dacă există, nu afișăm avertismentul "Sin Horario Asignado"
          const hasScheduleResult = await checkHasSchedule();
          
          // Afișează avertismentul doar dacă NU există nici cuadrante, nici horario_multicentro, nici horarios normal
          if (!cuadranteAsignado && !hasScheduleResult) {
            warn('Nu s-a găsit orar pentru:', { centroUsuario, grupoUsuario });
            loggerDebug('Toate orarele disponibile:', response.data.map(h => ({
              nombre: h.nombre,
              centroNombre: h.centroNombre,
              grupoNombre: h.grupoNombre
            })));
          } else {
            loggerDebug('Orar nu găsit în horarios normal, dar există cuadrante sau horario_multicentro');
          }
          setHorarioAsignado(null);
        }
      }
    } catch (error) {
      logError('Eroare la încărcarea orarului asignat:', error);
      setHorarioAsignado(null);
    } finally {
      setLoadingHorario(false);
    }
  }, [authUser, userData, loadingHorario, cuadranteAsignado, checkHasSchedule]);
  
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
  }, [authUser, fetchCuadranteAsignado]); // fetchCuadranteAsignado este memoizat cu useCallback

  // Verifică dacă există orar (cuadrante, horario_multicentro, sau horarios normal) când se încarcă utilizatorul
  useEffect(() => {
    if (authUser?.CODIGO && !authUser?.isDemo) {
      checkHasSchedule();
    }
  }, [authUser?.CODIGO, authUser?.isDemo, checkHasSchedule]);

  // Încarcă orarul când se încarcă utilizatorul sau când se schimbă userData
  useEffect(() => {
    if (authUser && !authUser?.isDemo && userData) {
      fetchHorarioAsignado();
    }
  }, [authUser, userData, fetchHorarioAsignado]); // fetchHorarioAsignado este memoizat cu useCallback

  // Încarcă horario_multicentro când se încarcă utilizatorul
  useEffect(() => {
    loggerDebug(`🔍 useEffect fetchHorarioMulticentroAsignado - authUser: ${!!authUser}, isDemo: ${authUser?.isDemo}`);
    if (authUser && !authUser?.isDemo) {
      loggerDebug('✅ Apelând fetchHorarioMulticentroAsignado...');
      fetchHorarioMulticentroAsignado();
    } else {
      loggerDebug('❌ Nu apelăm fetchHorarioMulticentroAsignado - condiții neîndeplinite');
    }
  }, [authUser, fetchHorarioMulticentroAsignado]); // fetchHorarioMulticentroAsignado este memoizat cu useCallback

  // ============================================
  // Helper functions for WhatsApp error report
  // ============================================
  // NOTE: These are defined here (after all hooks) to have access to currentDaySchedule
  
  // Helper: escape safe strings
  const safe = (v) => (v === null || v === undefined ? "" : String(v).trim());

  // Helper: format date/time in Spanish (Europe/Madrid)
  const formatDateTimeES = (d = new Date()) => {
    try {
      return new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      // fallback
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  };

  // Helper: format a fichaje row (logs use: tipo, hora, data)
  const formatFichajeLine = (row) => {
    if (!row) return null;

    // Logs structure: { tipo, hora, data, codigo, ... }
    const fecha = safe(row.data || row.FECHA || row.fecha || row.dia || row.date);
    const hora = safe(row.hora || row.HORA || row.time);
    const tipo = safe(row.tipo || row.TIPO || row.movimiento || row.evento);

    const pieces = [fecha, hora, tipo].filter(Boolean);
    return pieces.length ? `- ${pieces.join(" ")}` : null;
  };

  // Helper: format schedule for today (currentDaySchedule is already a formatted string or null)
  const formatScheduleToday = (schedule) => {
    // schedule is already calculated and formatted (e.g., "08:00 - 16:00" or "08:00 - 12:00 / 14:00 - 18:00")
    if (!schedule) return "No hay horario asignado";
    
    // It's already a string, return as is
    if (typeof schedule === "string") {
      return schedule.trim() || "No hay horario asignado";
    }

    // Fallback: try to extract from object if needed
    const inicio = safe(schedule.inicio || schedule.start || schedule.entrada || schedule.horaInicio);
    const fin = safe(schedule.fin || schedule.end || schedule.salida || schedule.horaFin);

    if (inicio && fin) return `${inicio} – ${fin}`;
    if (inicio) return `Inicio: ${inicio}`;
    if (fin) return `Fin: ${fin}`;

    return "No hay horario asignado";
  };

  // Main function: build enriched WhatsApp error report message
  // Defined as a regular function (not useCallback) to have access to currentDaySchedule from closure
  // This is safe because it's only called on button click, not during render
  const buildErrorReportMessage = () => {
    const now = formatDateTimeES(new Date());

    // User data (best effort - multiple fallbacks)
    const codigo = safe(authUser?.CODIGO || authUser?.codigo || userData?.CODIGO || userData?.codigo);
    const nombre = safe(
      authUser?.['NOMBRE / APELLIDOS'] || 
      authUser?.NOMBRE || 
      authUser?.nombre || 
      userData?.['NOMBRE / APELLIDOS'] || 
      userData?.NOMBRE || 
      userData?.nombre
    ) || "—";
    const centro = safe(
      authUser?.['CENTRO TRABAJO'] || 
      authUser?.CENTRO_TRABAJO || 
      authUser?.centro || 
      userData?.['CENTRO TRABAJO']
    );
    const grupo = safe(
      authUser?.GRUPO || 
      authUser?.grupo || 
      userData?.GRUPO
    );

    // Last fichajes: take last 3 from logs (logs is already an array)
    const last3 = Array.isArray(logs) ? logs.slice(0, 3) : [];
    const lastLines = last3.map(formatFichajeLine).filter(Boolean);

    // Calculate today's schedule directly (same logic as MiFichajeScreen)
    let todaySchedule = null;
    let scheduleInfo = null; // Info about cuadrante/horario asignado
    
    if (cuadranteAsignado) {
      const cuadranteNombre = safe(cuadranteAsignado.NOMBRE || cuadranteAsignado.nombre);
      const cuadranteMes = safe(cuadranteAsignado.LUNA || cuadranteAsignado.luna);
      if (cuadranteNombre || cuadranteMes) {
        scheduleInfo = `Cuadrante: ${cuadranteNombre || 'N/A'}${cuadranteMes ? ` (${cuadranteMes})` : ''}`;
      }
      
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        if (daySchedule.includes(',')) {
          const matches = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g);
          if (matches && matches.length > 0) {
            todaySchedule = matches.map(match => match).join(' / ');
          }
        } else {
          const match = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
          if (match) {
            todaySchedule = `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
          }
        }
      }
    } else if (horarioMulticentroAsignado) {
      const horarioNombre = safe(horarioMulticentroAsignado.nombre || horarioMulticentroAsignado.NOMBRE);
      if (horarioNombre) {
        scheduleInfo = `Horario Multicentro: ${horarioNombre}`;
      }
      
      const today = new Date().getDate();
      const dayKey = `ZI_${today}`;
      const daySchedule = horarioMulticentroAsignado[dayKey];
      
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '' && daySchedule !== '0' && daySchedule !== '0h') {
        if (typeof daySchedule === 'string' && daySchedule.includes('-')) {
          const match = daySchedule.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
          if (match) {
            todaySchedule = `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
          }
        } else if (typeof daySchedule === 'string' && !isNaN(parseFloat(daySchedule))) {
          const hours = parseFloat(daySchedule);
          todaySchedule = `${hours}h`;
        }
      }
    } else if (horarioAsignado && horarioAsignado.days) {
      const horarioNombre = safe(horarioAsignado.nombre || horarioAsignado.NOMBRE);
      if (horarioNombre) {
        scheduleInfo = `Horario: ${horarioNombre}`;
      }
      
      const today = new Date().getDay();
      const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][today];
      const daySchedule = horarioAsignado.days[dayKey];
      
      if (daySchedule) {
        const intervals = [];
        const isValidTime = (time) => {
          return typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time);
        };
        
        if (isValidTime(daySchedule.in1) && isValidTime(daySchedule.out1)) {
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
        
        if (intervals.length > 0) {
          todaySchedule = intervals.join(' / ');
        }
      }
    }

    const scheduleToday = formatScheduleToday(todaySchedule);

    // Build message in Spanish, clear and concise
    const msg = [
      "Hola, tengo un problema con el sistema de registro de jornada.",
      "",
      `📋 PAGINA: Registro de Jornada`,
      `👤 EMPLEADO: ${nombre}${codigo ? ` (Código: ${codigo})` : ""}`,
      `📅 FECHA: ${now}`,
      centro || grupo ? `🏢 CENTRO: ${[centro, grupo].filter(Boolean).join(" / ")}` : null,
      scheduleInfo ? `📌 ASIGNADO: ${scheduleInfo}` : null,
      "",
      "⏰ HORARIO planificado para hoy:",
      scheduleToday ? `  • ${scheduleToday}` : "  • No hay horario asignado",
      "",
      "📝 Últimos FICHAJES recientes:",
      lastLines.length ? lastLines.map(line => `  ${line}`).join("\n") : "  • No hay registros recientes",
    ]
      .filter(Boolean)
      .join("\n");

    return msg;
  };

  // Funcție pentru a verifica dacă timpul curent este în intervalul permis pentru cuadrante
  // Memoizată pentru a evita recalculări inutile
  const isTimeWithinCuadrante = useCallback((tipo) => {
    if (!cuadranteAsignado) {
      return true;
    }

    const now = new Date();
    const currentDay = now.getDate(); // Ziua din lună (1-31)
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Timpul curent în minute
    const today = now.toISOString().split('T')[0];
    
    // Pentru Salida în ture nocturne, verifică și ziua de ieri pentru a găsi începutul turei
    let daySchedule = null;
    let intervals = [];
    
    // Încearcă mai întâi ziua curentă
    const dayKey = `ZI_${currentDay}`;
    daySchedule = cuadranteAsignado[dayKey];
    
    // Dacă ziua nu este definită în cuadrante (nu există cheia), NU permite fichar
    // Pentru că dacă există cuadranteAsignado, înseamnă că utilizatorul ARE program,
    // și dacă ziua nu e definită, înseamnă că nu trebuie să muncească
    if (daySchedule === undefined || daySchedule === null) {
      return false; // Ziua nu este în cuadrante, NU permite fichar
    }
    
    // Dacă ziua este goală sau LIBRE, nu permite fichar
    if (daySchedule === 'LIBRE' || daySchedule === '' || daySchedule.trim() === '') {
      return false; // Zi liberă explicită sau goală, NU permite fichar
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

    // Dacă nu s-au găsit intervale valide după parsare, nu permite fichar
    // (ziua există în cuadrante dar formatul e invalid sau nu are intervale)
    if (intervals.length === 0) {
      return false;
    }

    // Funcție helper pentru a verifica dacă un interval specific este completat
    const isIntervalComplete = (intervalStart, intervalEnd) => {
      const startTime = parseTimeToMinutes(intervalStart);
      const endTime = parseTimeToMinutes(intervalEnd);
      
      // Caută Entrada pentru acest interval (în jurul timpului de intrare, ±30 min)
      const hasEntradaForInterval = logs.some(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        if (!logDate || !logDate.startsWith(today) || (log.tipo || log.TIPO) !== 'Entrada') {
          return false;
        }
        const logTime = log.hora || log.HORA || log.hora_fichaje;
        if (!logTime) return false;
        const logTimeMinutes = parseTimeToMinutes(logTime);
        return Math.abs(logTimeMinutes - startTime) <= 30;
      });
      
      // Caută Salida pentru acest interval (în jurul timpului de ieșire, ±30 min)
      const hasSalidaForInterval = logs.some(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        if (!logDate || !logDate.startsWith(today) || (log.tipo || log.TIPO) !== 'Salida') {
          return false;
        }
        const logTime = log.hora || log.HORA || log.hora_fichaje;
        if (!logTime) return false;
        const logTimeMinutes = parseTimeToMinutes(logTime);
        return Math.abs(logTimeMinutes - endTime) <= 30;
      });
      
      return hasEntradaForInterval && hasSalidaForInterval;
    };

    // Verifică fiecare interval individual pentru turnurile compartite
    for (const interval of intervals) {
      const startTime = parseTimeToMinutes(interval.start);
      let endTime = parseTimeToMinutes(interval.end);
      
      // Detectează dacă tură este nocturnă (peste miezul nopții)
      const isOvernightShift = endTime < startTime;
      const isComplete = isIntervalComplete(interval.start, interval.end);
      
      if (tipo === 'Entrada') {
        // Pentru Entrada: permite dacă intervalul nu este completat și timpul este corect
        if (!isComplete) {
          const marginBefore = 10; // 10 minute înainte
          const marginAfter = 120; // 2 ore după pentru a permite Entrada târziu
          let allowedStart = startTime - marginBefore;
          let allowedEnd = startTime + marginAfter;
          
          if (isOvernightShift) {
            // Pentru ture nocturne (ex: 19:30-07:30), Entrada se face seara
            if (allowedStart < 0) {
              allowedStart = 0;
            }
            if (allowedEnd >= 24 * 60) {
              allowedEnd = 4 * 60; // Max 04:00 dimineața
            }
            
            // Permite doar în intervalul permis
            if (currentTime >= allowedStart && currentTime <= allowedEnd) {
              return true;
            }
            // Dacă este după timpul permis, permite pentru a putea ficha târziu
            if (currentTime > allowedEnd) {
              return true;
            }
          } else {
            // Tură normală în aceeași zi
            if (allowedStart < 0) {
              allowedStart = 0;
            }
            if (allowedEnd >= 24 * 60) {
              allowedEnd = 24 * 60 - 1;
            }
            
            // Permite dacă este în intervalul permis
            if (currentTime >= allowedStart && currentTime <= allowedEnd) {
              return true;
            }
            // Dacă este după timpul permis, permite pentru a putea ficha târziu
            if (currentTime > allowedEnd) {
              return true;
            }
          }
        }
      } else if (tipo === 'Salida') {
        // Pentru Salida: permite dacă timpul este în intervalul permis
        // Verifică dacă există Entrada pentru acest interval (opțional - pentru validare)
        const hasEntradaForInterval = logs.some(log => {
          const logDate = log.data || log.FECHA || log.fecha;
          if (!logDate || !logDate.startsWith(today) || (log.tipo || log.TIPO) !== 'Entrada') {
            return false;
          }
          const logTime = log.hora || log.HORA || log.hora_fichaje;
          if (!logTime) return false;
          const logTimeMinutes = parseTimeToMinutes(logTime);
          return Math.abs(logTimeMinutes - startTime) <= 30;
        });
        
        // Verifică dacă există orice Entrada în ziua curentă (pentru cazuri când utilizatorul uită să ficheze Entrada exact la timp)
        const hasAnyEntradaToday = logs.some(log => {
          const logDate = log.data || log.FECHA || log.fecha;
          return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
        });
        
        // Permite Salida dacă:
        // 1. Intervalul nu este completat (nu există deja Salida pentru acest interval)
        // 2. ȘI (există Entrada pentru acest interval SAU există orice Entrada în ziua curentă)
        // 3. ȘI timpul curent este în intervalul permis
        if (!isComplete && (hasEntradaForInterval || hasAnyEntradaToday)) {
          let allowedStart, allowedEnd;
          
          if (isOvernightShift) {
            // Pentru ture nocturne, Salida se face a doua zi
            allowedStart = endTime - 10; // 10 minute înainte
            allowedEnd = endTime + 120; // 2 ore după pentru a permite Salida târziu
            
            if (allowedStart < 0) allowedStart = 0;
            if (allowedEnd >= 24 * 60) allowedEnd = 24 * 60 - 1;
          } else {
            // Tură normală în aceeași zi
            allowedStart = endTime - 10; // 10 minute înainte
            allowedEnd = endTime + 120; // 2 ore după pentru a permite Salida târziu
          }
          
          // Permite dacă este în intervalul permis
          if (currentTime >= allowedStart && currentTime <= allowedEnd) {
            return true;
          }
          // Dacă este după timpul permis, permite pentru a putea ficha târziu
          if (currentTime > allowedEnd) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [cuadranteAsignado, logs]); // Adăugat logs pentru a verifica intervalele individuale

  // Funcție pentru a verifica dacă timpul curent este în intervalul permis pentru orar
  // Memoizată pentru a evita recalculări inutile
  const isTimeWithinSchedule = useCallback((tipo) => {
    // PRIORITATE: Cuadrante > Horario
    if (cuadranteAsignado) {
      // Folosește isShiftComplete calculat anterior (verifică corect și pentru ture nocturne)
      // Trebuie să-l calculez aici pentru că useCallback nu poate accesa useMemo direct
      // Note: today and yesterdayStr were used in archived logic
      // const today = new Date().toISOString().split('T')[0];
      // const yesterday = new Date();
      // yesterday.setDate(yesterday.getDate() - 1);
      // const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Note: These variables were used in archived logic
      // const hasEntradaToday = logs.some(log => {
      //   const logDate = log.data || log.FECHA || log.fecha;
      //   return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Entrada';
      // });
      // const hasSalidaToday = logs.some(log => {
      //   const logDate = log.data || log.FECHA || log.fecha;
      //   return logDate && logDate.startsWith(today) && (log.tipo || log.TIPO) === 'Salida';
      // });
      // const hasEntradaYesterday = logs.some(log => {
      //   const logDate = log.data || log.FECHA || log.fecha;
      //   return logDate && logDate.startsWith(yesterdayStr) && (log.tipo || log.TIPO) === 'Entrada';
      // });
      
      // Verifică dacă este tură nocturnă (archived logic)
      // let isOvernightShiftToday = false;
      const currentDay = new Date().getDate();
      const dayKey = `ZI_${currentDay}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      // Note: intervals calculation was used in archived logic for isOvernightShiftToday
      if (daySchedule && daySchedule !== 'LIBRE' && daySchedule.trim() !== '') {
        // let intervals = [];
        // if (daySchedule.includes('T1') || daySchedule.includes('T2') || daySchedule.includes('T3')) {
        //   const match = daySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        //   if (match) {
        //     intervals = [{ start: match[1], end: match[2] }];
        //   }
        // } else {
        //   intervals = daySchedule.split(',').map(interval => {
        //     const [start, end] = interval.trim().split('-');
        //     return { start: start?.trim(), end: end?.trim() };
        //   }).filter(interval => interval.start && interval.end);
        // }
        
        // Note: isOvernightShiftToday calculation was used in archived logic
        // if (intervals.length > 0) {
        //   const firstInterval = intervals[0];
        //   const startTime = (parseInt(firstInterval.start.split(':')[0]) || 0) * 60 + (parseInt(firstInterval.start.split(':')[1]) || 0);
        //   const endTime = (parseInt(firstInterval.end.split(':')[0]) || 0) * 60 + (parseInt(firstInterval.end.split(':')[1]) || 0);
        //   isOvernightShiftToday = endTime < startTime;
        // }
      }
      
      // Pentru turnurile compartite, nu folosim isShiftCompleteLocal global
      // ci verificăm fiecare interval individual în isTimeWithinCuadrante
      return isTimeWithinCuadrante(tipo);
    }
    
    // Dacă nu există nici cuadrante, nici horario, NU permite fichar (utilizatorul nu are program)
    if (!horarioAsignado) {
      return false; // Nu permite fichar fără orar/cuadrante
    }
    
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Duminică, 1 = Luni, etc.
    const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][currentDay];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Timpul curent în minute
    
    // Verifică dacă există orar pentru această zi
    const daySchedule = horarioAsignado.days?.[dayKey];
    if (!daySchedule) {
      return false; // Dacă nu există orar pentru această zi, NU permite fichar
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
    
    // Dacă există daySchedule dar nu are intervale valide (toate sunt null),
    // înseamnă că ziua nu este în program - dezactivează butoanele
    if (intervals.length === 0) {
      return false; // Nu permite fichar dacă nu există intervale valide pentru ziua curentă
    }
    
    // Funcție helper pentru a verifica dacă un interval specific este completat
    const isIntervalComplete = (intervalIn, intervalOut) => {
      const today = new Date().toISOString().split('T')[0];
      const inTime = parseTimeToMinutes(intervalIn);
      const outTime = parseTimeToMinutes(intervalOut);
      
      // Caută Entrada pentru acest interval (în jurul timpului de intrare, ±30 min)
      const hasEntradaForInterval = logs.some(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        if (!logDate || !logDate.startsWith(today) || (log.tipo || log.TIPO) !== 'Entrada') {
          return false;
        }
        const logTime = log.hora || log.HORA || log.hora_fichaje;
        if (!logTime) return false;
        const logTimeMinutes = parseTimeToMinutes(logTime);
        // Verifică dacă timpul este în jurul timpului programat (±30 min)
        return Math.abs(logTimeMinutes - inTime) <= 30;
      });
      
      // Caută Salida pentru acest interval (în jurul timpului de ieșire, ±30 min)
      const hasSalidaForInterval = logs.some(log => {
        const logDate = log.data || log.FECHA || log.fecha;
        if (!logDate || !logDate.startsWith(today) || (log.tipo || log.TIPO) !== 'Salida') {
          return false;
        }
        const logTime = log.hora || log.HORA || log.hora_fichaje;
        if (!logTime) return false;
        const logTimeMinutes = parseTimeToMinutes(logTime);
        // Verifică dacă timpul este în jurul timpului programat (±30 min)
        return Math.abs(logTimeMinutes - outTime) <= 30;
      });
      
      return hasEntradaForInterval && hasSalidaForInterval;
    };
    
    // Verifică fiecare interval individual pentru turnurile compartite
    for (const interval of intervals) {
      const inTime = parseTimeToMinutes(interval.in);
      const outTime = parseTimeToMinutes(interval.out);
      const isComplete = isIntervalComplete(interval.in, interval.out);
      
      if (tipo === 'Entrada') {
        // Pentru Entrada: permite dacă intervalul nu este completat și timpul este corect
        if (!isComplete) {
          const marginBefore = 10; // 10 minute înainte
          const marginAfter = 120; // 2 ore după pentru a permite Entrada târziu
          const allowedStart = inTime - marginBefore;
          const allowedEnd = inTime + marginAfter;
          
          // Permite dacă este în intervalul permis
          if (currentTime >= allowedStart && currentTime <= allowedEnd) {
            return true;
          }
          // Dacă este după timpul permis, permite pentru a putea ficha târziu
          if (currentTime > allowedEnd) {
            return true;
          }
        }
      } else if (tipo === 'Salida') {
        // Pentru Salida: permite dacă timpul este în intervalul permis
        // Pentru turnurile compartite, permitem Salida dacă intervalul nu este completat
        // și timpul curent este în intervalul permis (chiar dacă nu găsim exact Entrada pentru acel interval)
        if (!isComplete) {
          const marginBefore = 10; // 10 minute înainte
          const marginAfter = 120; // 2 ore după pentru a permite Salida târziu
          const allowedStart = outTime - marginBefore;
          const allowedEnd = outTime + marginAfter;
          
          // Permite dacă este în intervalul permis
          if (currentTime >= allowedStart && currentTime <= allowedEnd) {
            return true;
          }
          // Dacă este după timpul permis, permite pentru a putea ficha târziu
          if (currentTime > allowedEnd) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [cuadranteAsignado, horarioAsignado, isTimeWithinCuadrante, logs]);

  // Funcție pentru a converti timpul (HH:MM) în minute
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  // Funcție pentru a obține mesajul de restricție
  const getTimeRestrictionMessage = (tipo) => {
    // PRIORITATE: Cuadrante > Horario
    if (cuadranteAsignado) {
      const now = new Date();
      const currentDay = now.getDate();
      const dayKey = `ZI_${currentDay}`;
      const daySchedule = cuadranteAsignado[dayKey];
      
      if (!daySchedule || daySchedule === 'LIBRE' || daySchedule.trim() === '') {
        return null;
      }
      
      let intervals = [];
      
      // Parsează orarul din cuadrante (format: "T1 09:00-17:00" sau "09:00-12:00,14:00-18:00" sau "19:30-07:30")
      if (daySchedule.includes('T1') || daySchedule.includes('T2') || daySchedule.includes('T3')) {
        // Format cuadrante: "T1 09:00-17:00"
        const match = daySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        if (match) {
          intervals = [{ start: match[1], end: match[2] }];
        }
      } else {
        // Format clasic: "08:00-12:00,14:00-18:00" sau "19:30-07:30"
        intervals = daySchedule.split(',').map(interval => {
          const [start, end] = interval.trim().split('-');
          return { start: start?.trim(), end: end?.trim() };
        }).filter(interval => interval.start && interval.end);
      }
      
      if (intervals.length === 0) return null;
      
      // Pentru Salida în ture nocturne, verifică și ziua de ieri
      if (tipo === 'Salida' && intervals.length > 0) {
        const lastInterval = intervals[intervals.length - 1];
        const startTime = parseTimeToMinutes(lastInterval.start);
        const endTime = parseTimeToMinutes(lastInterval.end);
        
        // Dacă detectează tură nocturnă (19:30-07:30), verifică și ziua de ieri
        if (endTime < startTime) {
          const yesterdayDay = currentDay - 1;
          const yesterdayKey = `ZI_${yesterdayDay}`;
          const yesterdaySchedule = cuadranteAsignado[yesterdayKey];
          
          if (yesterdaySchedule && yesterdaySchedule !== 'LIBRE' && yesterdaySchedule.trim() !== '') {
            let yesterdayIntervals = [];
            if (yesterdaySchedule.includes('T1') || yesterdaySchedule.includes('T2') || yesterdaySchedule.includes('T3')) {
              const match = yesterdaySchedule.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
              if (match) {
                yesterdayIntervals = [{ start: match[1], end: match[2] }];
              }
            }
            
            if (yesterdayIntervals.length > 0) {
              const yesterStartTime = parseTimeToMinutes(yesterdayIntervals[0].start);
              const yesterEndTime = parseTimeToMinutes(yesterdayIntervals[0].end);
              
              if (yesterEndTime < yesterStartTime) {
                intervals = yesterdayIntervals;
              }
            }
          }
        }
      }
      
      // Găsește primul interval relevant
      const relevantInterval = intervals[0];
      if (!relevantInterval) return null;
      
      const startTime = parseTimeToMinutes(relevantInterval.start);
      const endTime = parseTimeToMinutes(relevantInterval.end);
      const isOvernightShift = endTime < startTime;
      
      if (tipo === 'Entrada') {
        // Pentru Entrada, folosește START TIME (19:30 pentru tură nocturnă)
        return `Entrada permitida: ${relevantInterval.start} (±10 min)`;
      } else if (tipo === 'Salida') {
        // Pentru Salida, folosește END TIME (07:30 pentru tură nocturnă)
        if (isOvernightShift) {
          return `Salida permitida: ${relevantInterval.end} (±10 min) - día siguiente`;
        }
        return `Salida permitida: ${relevantInterval.end} (±10 min)`;
      }
      
      return null;
    }
    
    // Fallback la horarioAsignado
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
    } catch {
      setMadridTime(new Date().toLocaleTimeString());
      setMadridDate(new Date().toLocaleDateString());
    }
  };

  useEffect(() => {
    if (showIncidenciaModal) {
      // Initialize Madrid time from local time converted to Europe/Madrid timezone
      // JavaScript nativ poate calcula ora în orice timezone fără API extern
      // Eliminăm request-ul către worldtimeapi.org pentru a evita erorile de conexiune
      const base = Date.now();
      setMadridNowMs(base);
      updateMadridTimeFromMs(base);
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
          } catch {
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
      logError('Error deleting registro:', error);
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
    loggerDebug('handleFicharIncidencia - logs din componenta principala:', logs);
    loggerDebug('handleFicharIncidencia - logs[0]:', logs[0]);
    
    const ultimoMarcaje = logs[0]; // El primero de la lista es el más reciente
    let tipoIncidencia = 'Entrada'; // Default
    
    if (ultimoMarcaje) {
      // Dacă ultimul marcaj este 'Entrada', atunci incidența va fi 'Salida'
      // Dacă ultimul marcaje este 'Salida', atunci incidența va fi 'Entrada'
      tipoIncidencia = ultimoMarcaje.tipo === 'Entrada' ? 'Salida' : 'Entrada';
      loggerDebug('handleFicharIncidencia - ultimoMarcaje.tipo:', ultimoMarcaje.tipo);
      loggerDebug('handleFicharIncidencia - tipoIncidencia setat:', tipoIncidencia);
    } else {
      loggerDebug('handleFicharIncidencia - nu sunt marcaje, folosesc default:', tipoIncidencia);
    }
    
    setIncidenciaForm(f => ({
      ...f,
      tipo: tipoIncidencia,
      permisoFechaInicio: '',
      permisoFechaFin: ''
    }));
    
    loggerDebug('handleFicharIncidencia - incidenciaForm actualizat:', { tipo: tipoIncidencia });
    
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
        logError('Missing user data:', {
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

      // Validación: Debe seleccionar un tipo de ausencia
      const tiposValidos = ['Salida del Centro', 'Regreso al Centro', 'Salida Sin Regreso'];
      if (!incidenciaForm.tipo || !tiposValidos.includes(incidenciaForm.tipo)) {
        setIncidenciaMessage('⚠️ Debes seleccionar un tipo de ausencia antes de registrar. Por favor, elige una opción: "Salida del Centro", "Regreso al Centro" o "Salida Sin Regreso".');
        setIsSubmittingIncidencia(false);
        return;
      }

      // "Permiso Retribuido" și "Ausencias justificada" au fost mutate în "Nueva Solicitud"
      if (incidenciaForm.tipo === 'Permiso Retribuido' || incidenciaForm.tipo === 'Ausencias justificada') {
        setIncidenciaMessage('Este tipo de ausencia debe solicitarse en "Nueva Solicitud" en la página de Solicitudes.');
        setIsSubmittingIncidencia(false);
        return;
      }

      // Obtiene la ubicación (opcional) folosind contextul global
      let loc = null;
      let address = null;
      
      const ctx = locationContextRef.current;
      try {
        loc = await ctx.getCurrentLocation();
          
          // Intentamos obtener la dirección a través de geocodificación inversa
          try {
          address = await ctx.getAddressFromCoords(loc.latitude, loc.longitude);
          } catch (e) {
          // No se pudo obtener la dirección, continuamos sin ella
          warn('No se pudo obtener la dirección:', e);
        }
      } catch (error) {
        // Error al obtener la ubicación, continuamos sin ella
        warn('Error al obtener la ubicación:', error);
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
      // "Permiso Retribuido" și "Ausencias justificada" au fost mutate în "Nueva Solicitud"
      // Nu mai procesăm aceste tipuri aici

      info('[Fichaje] Folosind backend-ul nou (addAusencia):', ausenciaEndpoint);
      
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
        logError('Error submitting incidencia:', apiError);
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
      logError('Error in handleSubmitIncidencia:', outerError);
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
              Registro de Jornada
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Sistema de registro de jornada para empleados
            </p>
          </div>
        </div>
      </div>

      {/* Botón Reportar Error */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={async () => {
            const phone = "34635289087"; // Número de soporte
            const message = buildErrorReportMessage();
            const text = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${phone}?text=${text}`;
            
            // Trimite o copie pe Telegram (bot general) - non-blocking
            const baseUrl = import.meta.env.DEV 
              ? 'http://localhost:3000' 
              : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
            
            const token = localStorage.getItem('auth_token');
            if (token) {
              // Trimite pe Telegram în paralel (non-blocking)
              fetch(`${baseUrl}/api/monitoring/telegram`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  message: message,
                  botType: 'general', // Bot general pentru erori
                }),
              }).catch((error) => {
                // Nu afișăm eroare utilizatorului, doar logăm
                console.warn('Error sending to Telegram:', error);
              });
            }
            
            // Try WhatsApp Desktop protocol first (opens in app, not browser)
            // This avoids opening a new browser tab
            const whatsappDesktopUrl = `whatsapp://send?phone=${phone}&text=${text}`;
            
            // Create a temporary link to try WhatsApp Desktop
            const link = document.createElement('a');
            link.href = whatsappDesktopUrl;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Fallback to web WhatsApp after a delay
            // If Desktop is installed, this won't execute
            // If not, it opens in the same tab to avoid leaving a new tab open
            setTimeout(() => {
              // Check if we're still on the same page (Desktop didn't open)
              if (document.hasFocus()) {
                window.location.href = whatsappUrl;
              }
            }, 1000);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span className="text-base">📱</span>
          Reportar error
        </button>
      </div>

      {/* Verifică dacă utilizatorul are acces la pagină */}
      {loadingPermissions && (
        <Card>
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Cargando permisos...</p>
          </div>
        </Card>
      )}

      {/* Dacă nu are permisiuni în backend sau nu are permisiuni pentru fichar */}
      {!loadingPermissions && !canAccessPage && (
        <Card>
          <div className="text-center py-8">
            <div className="max-w-md mx-auto">
              <p className="text-gray-800 text-lg font-semibold mb-2">
                No tienes acceso a esta página
              </p>
              <p className="text-gray-600 mb-4">
                No tienes permisos configurados para acceder a la página de Fichaje.
              </p>
              <p className="text-gray-600">
                Por favor, contacta con tu supervisor para que te asigne los permisos necesarios.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Para empleado - solo MiFichaje (fichar-empleados) */}
      {canAccessPage && !canAccessAllTabs && (
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
            hasAnySchedule={hasAnySchedule}
            horarioMulticentroAsignado={horarioMulticentroAsignado}
            onLogsUpdate={(logs) => {
              loggerDebug('onLogsUpdate - logs primit:', logs);
              setLogs(logs);
            }}
          />
        </Card>
      )}

      {/* Para manager/admin - tabs con MiFichaje y Registros Empleados (fichar-admin) */}
      {canAccessAllTabs && (
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
              hasAnySchedule={hasAnySchedule}
              horarioMulticentroAsignado={horarioMulticentroAsignado}
              onLogsUpdate={(logs) => {
                loggerDebug('onLogsUpdate - logs primit:', logs);
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
            <HorasTrabajadas isMobile={isMobile} />
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
            {/* Mesaj de avertizare dacă nu există "Ausencias justificada" pentru ziua curentă */}
            {!hasAusenciaJustificadaHoy && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-red-600 text-xl">⚠️</span>
                  <div>
                    <h3 className="text-sm font-bold text-red-800 mb-1">
                      Debes registrar primero una &quot;Ausencias justificada&quot;
                    </h3>
                    <p className="text-sm text-red-700">
                      Para poder registrar &quot;Salida del Centro&quot;, &quot;Regreso al Centro&quot; o &quot;Salida Sin Regreso&quot;, primero debes registrar una &quot;Ausencias justificada&quot; para el día de hoy.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() =>
                  setIncidenciaForm(f => ({
                    ...f,
                    tipo: 'Salida del Centro',
                    permisoFechaInicio: '',
                    permisoFechaFin: ''
                  }))
                }
                disabled={!hasAusenciaJustificadaHoy}
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                  !hasAusenciaJustificadaHoy
                    ? 'bg-gray-300 text-gray-500 border-2 border-gray-300 cursor-not-allowed opacity-60'
                    : incidenciaForm.tipo === 'Salida del Centro'
                    ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white hover:shadow-xl'
                    : 'bg-white/90 text-orange-700 border-2 border-orange-300/50 hover:border-orange-400 hover:shadow-xl'
                }`}
                title={!hasAusenciaJustificadaHoy ? 'Debes registrar primero una "Ausencias justificada" para el día de hoy' : ''}
              >
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
                disabled={!hasAusenciaJustificadaHoy}
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                  !hasAusenciaJustificadaHoy
                    ? 'bg-gray-300 text-gray-500 border-2 border-gray-300 cursor-not-allowed opacity-60'
                    : incidenciaForm.tipo === 'Regreso al Centro'
                    ? 'bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 text-white hover:shadow-xl'
                    : 'bg-white/90 text-blue-700 border-2 border-blue-300/50 hover:border-blue-400 hover:shadow-xl'
                }`}
                title={!hasAusenciaJustificadaHoy ? 'Debes registrar primero una "Ausencias justificada" para el día de hoy' : ''}
              >
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
                disabled={!hasAusenciaJustificadaHoy}
                className={`p-4 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                  !hasAusenciaJustificadaHoy
                    ? 'bg-gray-300 text-gray-500 border-2 border-gray-300 cursor-not-allowed opacity-60'
                    : incidenciaForm.tipo === 'Salida Sin Regreso'
                    ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white hover:shadow-xl'
                    : 'bg-white/90 text-purple-700 border-2 border-purple-300/50 hover:border-purple-400 hover:shadow-xl'
                }`}
                title={!hasAusenciaJustificadaHoy ? 'Debes registrar primero una "Ausencias justificada" para el día de hoy' : ''}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">🏠</span>
                  <div className="text-lg font-extrabold">Salida Sin Regreso</div>
                  <div className={`text-xs mt-1 ${incidenciaForm.tipo === 'Salida Sin Regreso' ? 'text-white/90' : 'text-purple-600'}`}>No regresa hoy</div>
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
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-2">
            <button onClick={() => setShowIncidenciaModal(false)} disabled={isSubmittingIncidencia} className="px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-2xl bg-white/80 text-gray-600 border-2 border-gray-200/50">Cancelar</button>
            {(() => {
              const tiposValidos = ['Salida del Centro', 'Regreso al Centro', 'Salida Sin Regreso'];
              const tieneTipoSeleccionado = incidenciaForm.tipo && tiposValidos.includes(incidenciaForm.tipo);
              const isDisabled = isSubmittingIncidencia || !tieneTipoSeleccionado;
              
              return (
                <button 
                  onClick={handleSubmitIncidencia} 
                  disabled={isDisabled} 
                  className={`px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-2xl ${
                    isDisabled 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60' 
                      : 'bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 text-white hover:shadow-xl'
                  }`}
                  title={!tieneTipoSeleccionado ? 'Debes seleccionar un tipo de ausencia antes de registrar' : ''}
                >
                  {isSubmittingIncidencia ? 'Registrando...' : 'Registrar Ausencia'}
                </button>
              );
            })()}
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