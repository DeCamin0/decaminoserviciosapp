import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContextBase';
import activityLogger from '../utils/activityLogger';
import { Button, Card, Input, Select, Modal, Notification } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes.js';
import ScheduleEditor from '../components/ScheduleEditor';
import Back3DButton from '../components/Back3DButton';
import { toMinutes } from '../types/schedule';
import { calculateCuadranteHours } from '../utils/cuadrante-hours-helper';
import { Loader2, RotateCcw, Pencil, Trash2, Plus, Copy } from 'lucide-react';

const FESTIVOS_ENDPOINT = routes.getFestivos;
const CREATE_FESTIVO_ENDPOINT = routes.createFestivo;
const EDIT_FESTIVO_ENDPOINT = routes.editFestivo;
const DELETE_FESTIVO_ENDPOINT = routes.deleteFestivo;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ROTATIONS = [
  { label: '3cu2', work: 3, free: 2 },
  { label: '4cu3', work: 4, free: 3 },
  { label: '2cu2', work: 2, free: 2 },
  { label: '5cu2', work: 5, free: 2 },
  { label: '2cu5', work: 2, free: 5 },
  { label: '6cu3', work: 6, free: 3 },
  { label: '3cu6', work: 3, free: 6 },
  { label: '4cu4', work: 4, free: 4 },
];

const WEEKDAY_LABELS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mié' },
  { key: 4, label: 'Jue' },
  { key: 5, label: 'Vie' },
  { key: 6, label: 'Sáb' },
  { key: 7, label: 'Dom' },
];

/** Celda con prefijo MC->: el turno lo cubre otro empleado vía horario_multicentro; no son horas/días propios del titular. */
function isCuadranteMarcaMulticentro(val) {
  return val != null && String(val).trim().startsWith('MC->');
}

const CCAA_NAMES = {
  'ES-AN': 'Andalucía',
  'ES-AR': 'Aragón',
  'ES-AS': 'Asturias',
  'ES-CN': 'Canarias',
  'ES-CB': 'Cantabria',
  'ES-CM': 'Castilla-La Mancha',
  'ES-CL': 'Castilla y León',
  'ES-CT': 'Cataluña',
  'ES-EX': 'Extremadura',
  'ES-GA': 'Galicia',
  'ES-IB': 'Islas Baleares',
  'ES-RI': 'La Rioja',
  'ES-MD': 'Madrid',
  'ES-MC': 'Murcia',
  'ES-NC': 'Navarra',
  'ES-PV': 'País Vasco',
  'ES-VC': 'Comunidad Valenciana',
  'ES-CE': 'Ceuta',
  'ES-ML': 'Melilla',
};

const FESTIVO_SCOPE_OPTIONS = [
  { value: 'Nacional', label: 'Nacional' },
  { value: 'Autonómico', label: 'Autonómico' },
  { value: 'Regional', label: 'Regional' },
  { value: 'Municipal', label: 'Municipal' },
  { value: 'General', label: 'General' },
];

const FESTIVO_ACTIVE_OPTIONS = [
  { value: '1', label: 'Activo' },
  { value: '0', label: 'Inactivo' },
];

const BASE_FESTIVOS = [
  { month: 0, day: 1, name: 'Año Nuevo', scope: 'Nacional' },
  { month: 0, day: 6, name: 'Epifanía del Señor (Reyes)', scope: 'Nacional' },
  { month: 3, day: 17, name: 'Jueves Santo', scope: 'Festivo recomendado' },
  { month: 3, day: 18, name: 'Viernes Santo', scope: 'Nacional' },
  { month: 4, day: 1, name: 'Fiesta del Trabajo', scope: 'Nacional' },
  { month: 5, day: 24, name: 'San Juan', scope: 'Autonómico' },
  { month: 7, day: 15, name: 'Asunción de la Virgen', scope: 'Nacional' },
  { month: 9, day: 12, name: 'Fiesta Nacional de España', scope: 'Nacional' },
  { month: 10, day: 1, name: 'Todos los Santos', scope: 'Nacional' },
  { month: 11, day: 6, name: 'Día de la Constitución', scope: 'Nacional' },
  { month: 11, day: 8, name: 'Inmaculada Concepción', scope: 'Nacional' },
  { month: 11, day: 25, name: 'Navidad', scope: 'Nacional' },
];

const buildFestivoEntry = (year, festivo) => ({
  id: `${year}-${String(festivo.month + 1).padStart(2, '0')}-${String(festivo.day).padStart(2, '0')}-${festivo.name.replace(/\s+/g, '-').toLowerCase()}`,
  date: `${year}-${String(festivo.month + 1).padStart(2, '0')}-${String(festivo.day).padStart(2, '0')}`,
  name: festivo.name,
  scope: festivo.scope,
  ccaa: festivo.ccaa || null,
  observedDate: festivo.observedDate || null,
  notes: festivo.notes || null,
  active: festivo.active ?? 1,
});

const getFestivosFallback = (year) =>
  BASE_FESTIVOS.map((festivo) => buildFestivoEntry(year, festivo));

const getScopeLabel = (scope) => {
  if (!scope) return 'General';
  const normalized = scope.toString().toLowerCase();
  const scopes = {
    national: 'Nacional',
    nacional: 'Nacional',
    autonómico: 'Autonómico',
    autonomia: 'Autonómico',
    regional: 'Regional',
    municipal: 'Municipal',
    local: 'Local',
    general: 'General',
  };
  return scopes[normalized] || scope;
};

const getScopeBadgeClasses = (scope) => {
  const normalized = scope?.toString().toLowerCase() || '';
  if (normalized.includes('nac')) {
    return 'bg-red-100 text-red-700 border border-red-200';
  }
  if (normalized.includes('aut')) {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
  if (normalized.includes('reg')) {
    return 'bg-purple-100 text-purple-700 border border-purple-200';
  }
  if (normalized.includes('mun') || normalized.includes('loc')) {
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }
  return 'bg-gray-100 text-gray-700 border border-gray-200';
};

// Normalizează stringuri pentru comparații robuste (lowercase, fără diacritice, spații comprimate)
function normalizeString(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CuadrantesPage() {
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  
  
  // State pentru diferite secțiuni
  const [activeTab, setActiveTab] = useState('generar');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [centroSearchTerm, setCentroSearchTerm] = useState('');
  const [centroDropdownOpen, setCentroDropdownOpen] = useState(false);
  const [centroSearchTermLista, setCentroSearchTermLista] = useState('');
  const [centroDropdownOpenLista, setCentroDropdownOpenLista] = useState(false);
  const [festivosYear, setFestivosYear] = useState(new Date().getFullYear());
  const [festivosMonthFilter, setFestivosMonthFilter] = useState('all');
  const [festivosData, setFestivosData] = useState([]);
  const [festivosLoading, setFestivosLoading] = useState(false);
  const [festivosError, setFestivosError] = useState('');
  const festivosCacheRef = useRef({});
  const [festivoModalOpen, setFestivoModalOpen] = useState(false);
  const [festivoEditing, setFestivoEditing] = useState(null);
  const [festivoForm, setFestivoForm] = useState(null);
  const [festivoModalMode, setFestivoModalMode] = useState('edit'); // 'edit' | 'create'
  const [festivoToDelete, setFestivoToDelete] = useState(null);
  
  const [horariosLoading, setHorariosLoading] = useState(false);
  const [horariosLista, setHorariosLista] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [toast, setToast] = useState(null); // {type: 'success'|'error', message: string}
  const [notification, setNotification] = useState(null); // {type: 'success'|'error'|'warning', title: string, message: string}
  const [cuadrantesLista, setCuadrantesLista] = useState([]);
  const [error, setError] = useState('');
  
  // State pentru import Excel
  const [excelCuadrantesFormat, setExcelCuadrantesFormat] = useState('auto'); // auto | he_hs | celdas_multilinea | turno_horas_tabla
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState(null);
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false);
  const [savingExcel, setSavingExcel] = useState(false);
  // State pentru checkbox-uri horario_multicentro în preview cuadrantes
  const [selectedForHorarioMulticentro, setSelectedForHorarioMulticentro] = useState(new Set());
  // State pentru checkbox-uri rescriere cuadrantes existente
  const [selectedForRescriere, setSelectedForRescriere] = useState(new Set());
  
  // State pentru import Excel horario_multicentro
  const [uploadingExcelMulticentro, setUploadingExcelMulticentro] = useState(false);
  const [excelPreviewDataMulticentro, setExcelPreviewDataMulticentro] = useState(null);
  const [showExcelPreviewModalMulticentro, setShowExcelPreviewModalMulticentro] = useState(false);
  const [savingExcelMulticentro, setSavingExcelMulticentro] = useState(false);
  const [excludeHorariosCon0Horas, setExcludeHorariosCon0Horas] = useState(true); // Exclude automat rândurile cu 0 ore
  
  // State pentru afișare horarios_multicentro
  const [horariosMulticentroList, setHorariosMulticentroList] = useState([]);
  const [loadingHorariosMulticentro, setLoadingHorariosMulticentro] = useState(false);
  const [selectedMonthHorariosMulticentro, setSelectedMonthHorariosMulticentro] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  /** Zile reale în luna selectată pentru tabelul Horarios Multicentro (nu 31 fix). */
  const daysInMonthHorariosMulticentro = useMemo(() => {
    if (!selectedMonthHorariosMulticentro || !String(selectedMonthHorariosMulticentro).includes('-')) {
      return 31;
    }
    const [y, m] = selectedMonthHorariosMulticentro.split('-').map((x) => parseInt(x, 10));
    if (!y || !m) return 31;
    return getDaysInMonth(m - 1, y);
  }, [selectedMonthHorariosMulticentro]);
  const [selectedEmpleadoHorariosMulticentro, setSelectedEmpleadoHorariosMulticentro] = useState('');
  const [empleadoHorariosMulticentroSearch, setEmpleadoHorariosMulticentroSearch] = useState('');
  const [showEmpleadoHorariosMulticentroDropdown, setShowEmpleadoHorariosMulticentroDropdown] = useState(false);
  /** Cliente / comunidad (centro) para crear horario_multicentro manual */
  const [nuevoClienteMulticentro, setNuevoClienteMulticentro] = useState('');
  const [savingNuevoMulticentro, setSavingNuevoMulticentro] = useState(false);
  /** Día → texto (turno completo, horas «8», LIBRE, vacío) para crear/editar multicentro manual */
  const [multicentroManualDias, setMulticentroManualDias] = useState({});
  /** Borrador por fila listada: id horario_multicentro → { día: texto } */
  const [multicentroListEdits, setMulticentroListEdits] = useState({});
  const [savingMulticentroListId, setSavingMulticentroListId] = useState(null);

  const showToast = useCallback((arg1, arg2) => {
    const allowedTypes = new Set(['success', 'error', 'info', 'warning']);
    const type = allowedTypes.has(arg1) ? arg1 : (allowedTypes.has(arg2) ? arg2 : 'info');
    const message = allowedTypes.has(arg1) ? arg2 : arg1;

    if (!message) {
      return;
    }

    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Funcție pentru a edita o zi din cuadrante
  const handleEditDay = (cuadranteIndex, dayNumber, currentValue, cuadranteData = null) => {
    // Dacă avem datele cuadrante-ului direct, folosim-le (pentru a evita probleme cu indexul)
    let cuadrante = cuadranteData;
    
    // Dacă nu avem datele directe, găsim cuadrante-ul din lista filtrată (pentru că indexul este din lista filtrată)
    if (!cuadrante) {
      const filteredList = cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno);
      cuadrante = filteredList[cuadranteIndex];
      
      // Dacă tot nu găsim, încercăm să găsim în lista completă (fallback)
      if (!cuadrante) {
        cuadrante = cuadrantesLista[cuadranteIndex];
      }
    }
    
    if (!cuadrante) {
      console.error('❌ [handleEditDay] Cuadrante not found for index:', cuadranteIndex, 'Total cuadrantes:', cuadrantesLista.length);
      showToast('error', 'Error: No se encontró el cuadrante');
      return;
    }

    // Extraer turnurile unice din TOATE cuadrant-urile pentru luna respectivă
    const shifts = new Set();
    shifts.add('LIBRE'); // Adăugăm întotdeauna LIBRE
    
    // Parcurge toate cuadrant-urile pentru a găsi toate turele disponibile
    cuadrantesLista.forEach(cuadranteItem => {
      for (let i = 1; i <= 31; i++) {
        const ziKey = `ZI_${i}`;
        const value = cuadranteItem[ziKey];
        if (value && value !== 'LIBRE' && value.trim() !== '') {
          // Adaugă valoarea exactă așa cum este în cuadrant
          // (ex: "T1 07:30-19:30", "T2 19:30-07:30", "07:30-19:30", etc.)
          shifts.add(value.trim());
        }
      }
    });

    // Convertir a array y ordenar: LIBRE primul, apoi celelalte sortate
    const shiftsArray = Array.from(shifts).sort((a, b) => {
      if (a === 'LIBRE') return -1;
      if (b === 'LIBRE') return 1;
      return a.localeCompare(b);
    });
    
    setAvailableShifts(shiftsArray);
    // Obține numele complet al angajatului (încearcă toate variantele)
    const nombreCompleto = cuadrante['NOMBRE / APELLIDOS'] || cuadrante.NOMBRE || cuadrante.nombre || 'N/A';
    
    
    // Găsește indexul real în lista completă pentru salvare
    const realIndex = cuadrantesLista.findIndex(c => 
      (c.CODIGO && cuadrante.CODIGO && c.CODIGO === cuadrante.CODIGO) ||
      (c.EMAIL && cuadrante.EMAIL && c.EMAIL === cuadrante.EMAIL) ||
      (c.NOMBRE && cuadrante.NOMBRE && c.NOMBRE === cuadrante.NOMBRE)
    );
    
    const finalIndex = realIndex !== -1 ? realIndex : cuadranteIndex;
    
    // Evită suprapunerea cu modalul de preview (selectedCell) — același showEditModal
    setSelectedCell(null);
    setEditingSchedule(null);
    setEditingDay({
      cuadranteIndex: finalIndex, // Folosește indexul real din lista completă
      dayNumber,
      currentValue: currentValue || '',
      empleado: nombreCompleto,
      codigo: cuadrante.CODIGO || '',
      email: cuadrante.EMAIL || '',
      nombre: cuadrante.NOMBRE || cuadrante.nombre || '',
      centro: cuadrante.CENTRO || selectedCentro || '',
      cuadranteOriginal: cuadrante // Păstrăm cuadrante-ul original pentru referință
    });
    // Reset complet la deschiderea modalului pentru a evita confuzia între angajați
    setSelectedEmpleadoForDay('');
    setEmpleadoForDaySearch('');
    setShowEmpleadoForDayDropdown(false);
    setShowEditModal(true);
  };

  // Funcție helper pentru a transforma formatul complet în număr de ore (pentru horario multicentro)
  const transformaZiValueInOre = (ziValue) => {
    if (!ziValue || ziValue === '' || ziValue === 'LIBRE' || ziValue === '0' || ziValue === '0h') {
      return null; // LIBRE rămâne LIBRE
    }
    
    const ziStr = String(ziValue).trim();
    
    // Dacă este deja un număr (ex: "8", "8h", "8.0")
    if (!isNaN(parseFloat(ziStr)) && isFinite(parseFloat(ziStr))) {
      const hours = parseFloat(ziStr);
      return hours > 0 ? String(hours) : null;
    }
    
    // Format "T1 XX:XX-XX:XX", "T2 XX:XX-XX:XX", "T3 XX:XX-XX:XX"
    let turnoMatch = ziStr.match(/^T[123]\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!turnoMatch) {
      turnoMatch = ziStr.match(/^T[123](\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    }
    if (!turnoMatch) {
      turnoMatch = ziStr.match(/^T[123]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    }
    
    if (turnoMatch) {
      const startHour = parseInt(turnoMatch[1], 10);
      const startMin = parseInt(turnoMatch[2], 10);
      let endHour = parseInt(turnoMatch[4], 10);
      const endMin = parseInt(turnoMatch[5], 10);
      
      if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
        endHour += 24;
      }
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const durationMinutes = endMinutes - startMinutes;
      const durationHours = durationMinutes / 60;
      
      if (durationHours === Math.round(durationHours)) {
        return String(Math.round(durationHours));
      } else {
        return String(Math.round(durationHours * 10) / 10);
      }
    }
    
    // Format "XX:XX-XX:XX"
    const timeMatch = ziStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const startHour = parseInt(timeMatch[1], 10);
      const startMin = parseInt(timeMatch[2], 10);
      let endHour = parseInt(timeMatch[4], 10);
      const endMin = parseInt(timeMatch[5], 10);
      
      if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
        endHour += 24;
      }
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const durationMinutes = endMinutes - startMinutes;
      const durationHours = durationMinutes / 60;
      
      return String(Math.round(durationHours * 10) / 10);
    }
    
    // Dacă este doar "T1", "T2", "T3" fără ore, presupunem 8 ore
    if (ziStr.match(/^T[123]$/)) {
      return '8';
    }
    
    return null;
  };

  // Funcție helper pentru a obține identificatorul unic al unui cuadrante (consistent în toată aplicația)
  const getCuadranteIdentificator = (cuadrante) => {
    if (!cuadrante) return null;
    // Prioritate: CODIGO > EMAIL > NOMBRE > nombre
    // Folosim String() pentru a evita probleme cu null/undefined
    return String(cuadrante.CODIGO || cuadrante.EMAIL || cuadrante.NOMBRE || cuadrante.nombre || '');
  };

  // Funcție pentru a salva modificarea din modal
  const handleSaveDayEdit = async (newValue) => {
    if (!editingDay) return;
    
    const { cuadranteIndex, dayNumber, codigo, email, nombre, centro, cuadranteOriginal } = editingDay;
    // MySQL / JSON pot returna CODIGO ca număr; comparările stricte (===) eșuează vs string din UI
    const normCodigo = (v) => (v == null || v === '' ? '' : String(v).trim());
    const normClienteHm = (v) => String(v ?? '').trim();
    
    // Găsește cuadrante-ul real din lista completă folosind identificatorul
    const cuadranteReal = cuadrantesLista.find(c => 
      (codigo && normCodigo(c.CODIGO) === normCodigo(codigo)) ||
      (email && c.EMAIL === email) ||
      (nombre && (c.NOMBRE === nombre || c.nombre === nombre))
    ) || cuadranteOriginal || cuadrantesLista[cuadranteIndex];
    
    if (!cuadranteReal) {
      console.error('❌ [handleSaveDayEdit] Cuadrante not found:', { codigo, email, nombre, cuadranteIndex });
      showToast('error', 'Error: No se encontró el cuadrante');
      return;
    }
    
    // Folosește funcția helper pentru identificator consistent
    const identificator = getCuadranteIdentificator(cuadranteReal);
    if (!identificator) {
      console.error('❌ [handleSaveDayEdit] No valid identificator found for cuadrante');
      showToast('error', 'Error: No se pudo identificar el cuadrante');
      return;
    }
    
    const cuadranteKey = `${identificator}_${dayNumber}`;
    
    // Text în câmp dar fără selecție din listă → nu există CODIGO pentru multicentro
    if (empleadoForDaySearch.trim() && !normCodigo(selectedEmpleadoForDay)) {
      showToast('error', 'Selecciona un empleado de la lista (clic en un resultado). Escribir solo no asigna multicentro.');
      return;
    }
    
    // Dacă este selectat alt angajat și turnul nu este LIBRE, creează horario multicentro
    
    if (selectedEmpleadoForDay && normCodigo(selectedEmpleadoForDay) !== normCodigo(codigo) && newValue && newValue !== 'LIBRE' && newValue.trim() !== '') {
      try {
        // Găsește informațiile despre noul angajat (folosește lista completă sau fallback)
        const listaCompleta = angajati.length > 0 ? angajati : angajatiFiltrati;
        const nuevoEmpleado = listaCompleta.find(a => normCodigo(a.CODIGO) === normCodigo(selectedEmpleadoForDay));
        if (!nuevoEmpleado) {
          showToast('error', 'Empleado no encontrado');
          return;
        }
        
        // Salvează horario multicentro
        const token = localStorage.getItem('auth_token');
        
        // Verifică dacă ziua era deja atribuită altui angajat în multicentro
        // Dacă da, actualizează marcajul în cuadrantul original al acelui angajat
        const mesAnoCheck = selectedMesAno || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const clienteCentroCheck = normClienteHm(centro || selectedCentro || 'N/A');
        
        try {
          const getResponseCheck = await fetch(
            `${routes.getHorarioMulticentro}?mes=${mesAnoCheck}`,
            {
              method: 'GET',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (getResponseCheck.ok) {
            const getDataCheck = await getResponseCheck.json().catch(() => ({ horarios: [] }));
            const horariosMulticentroCheck = Array.isArray(getDataCheck.horarios) ? getDataCheck.horarios : [];
            
            // Găsește horario_multicentro care au această zi atribuită și sunt din același centru
            const horariosConEstaZiCheck = horariosMulticentroCheck.filter(h => {
              return normClienteHm(h.CLIENTE) === clienteCentroCheck && 
                     h[`ZI_${dayNumber}`] !== undefined && 
                     h[`ZI_${dayNumber}`] !== null && 
                     h[`ZI_${dayNumber}`] !== '' &&
                     normCodigo(h.CODIGO) !== normCodigo(codigo) && // Nu este angajatul original
                     normCodigo(h.CODIGO) !== normCodigo(nuevoEmpleado.CODIGO); // Nu este noul angajat
            });
            
            // Actualizează marcajul în cuadrantul original al angajaților care au avut ziua
            horariosConEstaZiCheck.forEach(h => {
              const cuadranteConEstaZiCheck = cuadrantesLista.find(c => {
                const cIdentificator = getCuadranteIdentificator(c);
                const hIdentificator = h.CODIGO || h.EMAIL || h.NOMBRE || '';
                return cIdentificator === hIdentificator && c.LUNA === mesAnoCheck;
              });
              
              if (cuadranteConEstaZiCheck) {
                const identificatorConEstaZiCheck = getCuadranteIdentificator(cuadranteConEstaZiCheck);
                const cuadranteKeyConEstaZiCheck = `${identificatorConEstaZiCheck}_${dayNumber}`;
                
                // Șterge marcajul vechi
                setEditedCuadrantes(prev => ({
                  ...prev,
                  [cuadranteKeyConEstaZiCheck]: 'LIBRE'
                }));
              }
            });
          }
        } catch (error) {
          console.warn('⚠️ [handleSaveDayEdit] Error al verificar ziua anterioară:', error);
        }
        
        // Funcție helper pentru calculul orelor din formatul complet (pentru TotalHoras)
        const calculaOreDinFormat = (ziValue) => {
          if (!ziValue || ziValue === '' || ziValue === 'LIBRE' || ziValue === '0' || ziValue === '0h') {
            return 0;
          }
          return transformaZiValueInOre(ziValue) || 0;
        };
        
        // Construiește obiectul horario multicentro
        const mesAno = selectedMesAno || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const clienteCentro = normClienteHm(centro || selectedCentro || 'N/A');
        // Folosim numele complet (NOMBRE / APELLIDOS) dacă există, altfel fallback la NOMBRE
        const nombreCompleto = nuevoEmpleado['NOMBRE / APELLIDOS'] || nuevoEmpleado.NOMBRE_APELLIDOS || nuevoEmpleado.NOMBRE || nuevoEmpleado.nombre || '';
        
        // Citește mai întâi orarul existent pentru acest angajat, lună și centru
        let horarioExistente = [];
        try {
          const getResponse = await fetch(
            `${routes.getHorarioMulticentro}?codigo=${encodeURIComponent(codigoNuevoStr)}&mes=${encodeURIComponent(mesAno)}`,
            {
              method: 'GET',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (getResponse.ok) {
            const getData = await getResponse.json().catch(() => ({ horarios: [] }));
            horarioExistente = Array.isArray(getData.horarios) ? getData.horarios : [];
          }
        } catch (error) {
          console.warn('⚠️ [handleSaveDayEdit] Error al leer horarios existentes:', error);
          // Continuăm cu crearea unui orar nou dacă nu putem citi cel existent
        }
        
        // Găsește orarul existent pentru acest centru (fără să verificăm HORARIO, deoarece în multicentro salvăm doar orele)
        // Folosim un HORARIO generic "MULTICENTRO" pentru toate zilele atribuite aceluiași angajat în același centru/lună
        let horarioExistenteParaCentro = horarioExistente.find(
          h => normClienteHm(h.CLIENTE) === clienteCentro
        );
        
        // Construiește obiectul horario multicentro cu toate zilele
        // HORARIO și SERVICIO sunt generice pentru multicentro (nu depind de tipul de turn specific)
        const codigoNuevoStr = String(nuevoEmpleado.CODIGO ?? '').trim();
        if (!codigoNuevoStr) {
          showToast('error', 'El empleado seleccionado no tiene CODIGO en DatosEmpleados');
          return;
        }
        const horarioMulticentro = {
          CODIGO: codigoNuevoStr,
          EMAIL: nuevoEmpleado['CORREO ELECTRONICO'] || nuevoEmpleado.EMAIL || '',
          NOMBRE: nombreCompleto, // Folosim numele complet
          LUNA: mesAno,
          CLIENTE: clienteCentro,
          HORARIO: 'MULTICENTRO', // Generic pentru toate zilele atribuite în multicentro
          SERVICIO: 'MULTICENTRO', // Generic pentru toate zilele atribuite în multicentro
        };
        
        // Dacă există un orar existent, păstrează toate zilele existente și actualizează doar ziua nouă
        if (horarioExistenteParaCentro) {
          // Copiază toate zilele existente - PĂSTRĂM FORMATUL COMPLET
          for (let i = 1; i <= 31; i++) {
            const ziKey = `ZI_${i}`;
            const ziValue = horarioExistenteParaCentro[ziKey];
            if (ziValue !== undefined && ziValue !== null && ziValue !== '') {
              // Păstrăm formatul complet (T1 07:00-15:00 sau doar "12")
              horarioMulticentro[ziKey] = String(ziValue).trim();
            }
          }
          // Actualizează ziua nouă cu formatul complet (T1 07:00-15:00)
          horarioMulticentro[`ZI_${dayNumber}`] = newValue && newValue !== 'LIBRE' ? String(newValue).trim() : null;
          
          // Recalculează TotalHoras din formatul complet
          let totalHoras = 0;
          for (let i = 1; i <= 31; i++) {
            const ziKey = `ZI_${i}`;
            const ziValue = horarioMulticentro[ziKey];
            if (ziValue) {
              const horasDia = calculaOreDinFormat(ziValue);
              if (typeof horasDia === 'number' && !isNaN(horasDia)) {
                totalHoras += horasDia;
              }
            }
          }
          horarioMulticentro.TotalHoras = totalHoras > 0 ? String(totalHoras.toFixed(2)) : null;
        } else {
          // Creează un orar nou cu doar ziua nouă - PĂSTRĂM FORMATUL COMPLET (T1 07:00-15:00)
          horarioMulticentro[`ZI_${dayNumber}`] = newValue && newValue !== 'LIBRE' ? String(newValue).trim() : null;
          const horasDia = calculaOreDinFormat(newValue);
          horarioMulticentro.TotalHoras = (typeof horasDia === 'number' && !isNaN(horasDia) && horasDia > 0) ? String(horasDia.toFixed(2)) : null;
        }
        
        
        const response = await fetch(routes.saveHorariosMulticentro, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            horarios: [horarioMulticentro],
          }),
        });
        
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error('❌ [handleSaveDayEdit] Error response:', errorData);
          throw new Error(errorData.message || 'Error al guardar horario multicentro');
        }
        
        const saveBody = await response.json().catch(() => ({}));
        if (typeof saveBody.updated === 'number' && saveBody.updated < 1) {
          console.error('❌ [handleSaveDayEdit] save-multicentro sin filas guardadas:', saveBody);
          showToast('error', 'No se guardó en horario_multicentro (revisa logs del servidor o datos del empleado/centro).');
          return;
        }
        
        showToast('success', `Turno asignado a ${nuevoEmpleado.NOMBRE || nuevoEmpleado.nombre} en horario multicentro`);
        
        // Setează ziua cu marcaj special "MC->[NUME_ANGAJAT]" în cuadrantele originale pentru a indica că este în multicentro
        // Folosim "->" în loc de "→" pentru compatibilitate cu encoding-ul bazei de date
        const nombreCorto = (nuevoEmpleado.NOMBRE || nuevoEmpleado.nombre || '').split(' ').slice(0, 2).join(' '); // Primele 2 cuvinte din nume
        const marcaMulticentro = `MC->${nombreCorto}`;
        setEditedCuadrantes(prev => ({
          ...prev,
          [cuadranteKey]: marcaMulticentro
        }));
        setHasChanges(true);
        
        
      } catch (error) {
        console.error('❌ Error al guardar horario multicentro:', error);
        showToast('error', `Error: ${error.message}`);
        return;
      }
    } else {
      // Comportament normal: actualizează cuadrantele (folosind identificatorul unic)
      // DAR: dacă ziua a fost atribuită anterior unui alt angajat în multicentro, trebuie să o ștergem de acolo
      const mesAno = selectedMesAno || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const clienteCentro = normClienteHm(centro || selectedCentro || 'N/A');
      const token = localStorage.getItem('auth_token');
      
      // Căutăm în toate horario_multicentro pentru acest centru și lună dacă există ziua atribuită altui angajat
      try {
        const getResponse = await fetch(
          `${routes.getHorarioMulticentro}?mes=${mesAno}`,
          {
            method: 'GET',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (getResponse.ok) {
          const getData = await getResponse.json().catch(() => ({ horarios: [] }));
          const horariosMulticentro = Array.isArray(getData.horarios) ? getData.horarios : [];
          
          // Găsește toate horario_multicentro care au această zi atribuită și sunt din același centru
          const horariosConEstaZi = horariosMulticentro.filter(h => {
            // Verifică dacă este din același centru și dacă ziua respectivă are o valoare
            return normClienteHm(h.CLIENTE) === clienteCentro && 
                   h[`ZI_${dayNumber}`] !== undefined && 
                   h[`ZI_${dayNumber}`] !== null && 
                   h[`ZI_${dayNumber}`] !== '' &&
                   normCodigo(h.CODIGO) !== normCodigo(codigo); // Nu este angajatul original
          });
          
          // Dacă există horario_multicentro cu această zi atribuită, o ștergem
          if (horariosConEstaZi.length > 0) {
            
            // Pentru fiecare horario_multicentro găsit, ștergem ziua respectivă
            const horariosParaActualizar = horariosConEstaZi.map(h => {
              const horarioActualizado = { ...h };
              // Setăm ziua la NULL
              horarioActualizado[`ZI_${dayNumber}`] = null;
              
              // Recalculăm TotalHoras
              let totalHoras = 0;
              for (let i = 1; i <= 31; i++) {
                const ziKey = `ZI_${i}`;
                const ziValue = horarioActualizado[ziKey];
                if (ziValue !== undefined && ziValue !== null && ziValue !== '' && i !== dayNumber) {
                  const ziValueNum = parseFloat(ziValue);
                  if (!isNaN(ziValueNum)) {
                    totalHoras += ziValueNum;
                  }
                }
              }
              horarioActualizado.TotalHoras = totalHoras > 0 ? totalHoras : null;
              
              return horarioActualizado;
            });
            
            // Salvează horarios actualizados
            const responseMulticentro = await fetch(routes.saveHorariosMulticentro, {
              method: 'POST',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                horarios: horariosParaActualizar,
              }),
            });
            
            if (responseMulticentro.ok) {
              
              // Ștergem marcajul "MC->..." din cuadrantul original al angajaților care au avut ziua
              // Căutăm în cuadrantesLista pentru a găsi cuadrantul acelor angajați
              horariosConEstaZi.forEach(h => {
                const cuadranteConEstaZi = cuadrantesLista.find(c => {
                  const cIdentificator = getCuadranteIdentificator(c);
                  const hIdentificator = h.CODIGO || h.EMAIL || h.NOMBRE || '';
                  return cIdentificator === hIdentificator && c.LUNA === mesAno;
                });
                
                if (cuadranteConEstaZi) {
                  const identificatorConEstaZi = getCuadranteIdentificator(cuadranteConEstaZi);
                  const cuadranteKeyConEstaZi = `${identificatorConEstaZi}_${dayNumber}`;
                  
                  // Verifică dacă ziua are marcajul "MC->..." și o ștergem
                  const currentValue = editedCuadrantes[cuadranteKeyConEstaZi] || cuadranteConEstaZi[`ZI_${dayNumber}`] || '';
                  if (String(currentValue).startsWith('MC->')) {
                    setEditedCuadrantes(prev => ({
                      ...prev,
                      [cuadranteKeyConEstaZi]: 'LIBRE'
                    }));
                  }
                }
              });
            } else {
              console.warn('⚠️ [handleSaveDayEdit] Error al eliminar ziua de la horario_multicentro');
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ [handleSaveDayEdit] Error al verificar/eliminar ziua de la horario_multicentro:', error);
        // Continuăm cu actualizarea cuadrantului chiar dacă nu putem șterge din multicentro
      }
      
      // Dacă newValue este "LIBRE" sau gol, și ziua avea marcajul "MC->...", îl ștergem
      const currentValue = editedCuadrantes[cuadranteKey] || cuadranteReal?.[`ZI_${dayNumber}`] || '';
      if ((newValue === 'LIBRE' || newValue === '') && String(currentValue).startsWith('MC->')) {
        // Ziua este returnată, ștergem marcajul
        setEditedCuadrantes(prev => ({
          ...prev,
          [cuadranteKey]: newValue || 'LIBRE'
        }));
      } else {
        setEditedCuadrantes(prev => ({
          ...prev,
          [cuadranteKey]: newValue
        }));
      }
      setHasChanges(true);
      
    }
    
    setShowEditModal(false);
    setEditingDay(null);
    setSelectedEmpleadoForDay('');
    setEmpleadoForDaySearch('');
    setShowEmpleadoForDayDropdown(false);
  };

  // Funcție pentru a salva modificările
  const handleSaveChanges = async () => {
    try {
      setLoading(true);
      
      // Construir payload cu SOLO los cuadrantes modificados
      const cuadrantesToSave = [];
      
      // Agrupar modificările por cuadrante (folosim key unic: identificator_luna)
      const modificariPorCuadrante = {};
      const lunaSelectata = selectedMesAno || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      
      // Recopilar todas las modificaciones
      Object.keys(editedCuadrantes).forEach(key => {
        // Parsează key-ul corect: identificator_ziua
        // Folosim lastIndexOf pentru a găsi ultimul '_' care separă identificatorul de ziua
        // (pentru că identificatorul poate conține '_' în nume/email)
        const lastUnderscoreIndex = key.lastIndexOf('_');
        if (lastUnderscoreIndex === -1) {
          console.warn('⚠️ [handleSaveChanges] Invalid key format:', key);
          return;
        }
        
        const identificadorStr = key.substring(0, lastUnderscoreIndex);
        const dayStr = key.substring(lastUnderscoreIndex + 1);
        const day = parseInt(dayStr, 10);
        
        if (isNaN(day) || day < 1 || day > 31) {
          console.warn('⚠️ [handleSaveChanges] Invalid day number:', dayStr, 'from key:', key);
          return;
        }
        
        // Încearcă să găsească cuadrante-ul după identificator (CODIGO, EMAIL, NOMBRE)
        let cuadrante = null;
        let index = -1;
        
        // Caută după identificator unic ȘI luna selectată folosind funcția helper
        // IMPORTANT: Trebuie să găsim cuadrante-ul pentru luna selectată, nu primul care se potrivește
        cuadrante = cuadrantesLista.find(c => {
          const cIdentificator = getCuadranteIdentificator(c);
          const cLuna = c.LUNA || '';
          return cIdentificator && cIdentificator === identificadorStr && cLuna === lunaSelectata;
        });
        
        // Dacă nu găsim cu luna, încercăm fără luna (fallback pentru compatibilitate)
        if (!cuadrante) {
          cuadrante = cuadrantesLista.find(c => {
            const cIdentificator = getCuadranteIdentificator(c);
            return cIdentificator && cIdentificator === identificadorStr;
          });
        }
        
        if (cuadrante) {
          index = cuadrantesLista.findIndex(c => c === cuadrante);
        } else {
          // Fallback: încearcă să parseze ca index numeric (pentru compatibilitate cu key-uri vechi)
          const indexNum = parseInt(identificadorStr, 10);
          if (!isNaN(indexNum) && cuadrantesLista[indexNum]) {
            cuadrante = cuadrantesLista[indexNum];
            index = indexNum;
          }
        }
        
        if (cuadrante && index !== -1) {
          // Folosim key unic: identificator_luna pentru a evita confuzia între cuadrantes diferite
          const cuadranteKey = `${identificadorStr}_${lunaSelectata}`;
          
          if (!modificariPorCuadrante[cuadranteKey]) {
            modificariPorCuadrante[cuadranteKey] = {
              cuadrante: cuadrante,
              modificari: {},
              index: index // Păstrăm indexul pentru referință
            };
          }
          modificariPorCuadrante[cuadranteKey].modificari[day] = editedCuadrantes[key];
          
          console.log('✅ [handleSaveChanges] Modificare găsită:', {
            key,
            identificadorStr,
            day,
            value: editedCuadrantes[key],
            cuadranteIdentificator: getCuadranteIdentificator(cuadrante),
            cuadranteCODIGO: cuadrante.CODIGO,
            cuadranteLUNA: cuadrante.LUNA,
            lunaSelectata: lunaSelectata,
            matchLuna: cuadrante.LUNA === lunaSelectata
          });
        } else {
          console.warn('⚠️ [handleSaveChanges] Cuadrante not found for key:', key, {
            identificadorStr,
            day,
            totalCuadrantes: cuadrantesLista.length
          });
        }
      });
      
      // Construir solo los cuadrantes que tienen modificaciones
      // IMPORTANT: Construim un obiect NOU cu DOAR metadata și zilele modificate
      // Nu includem toate zilele din cuadrantele existente pentru a evita inversări
      Object.keys(modificariPorCuadrante).forEach(cuadranteKey => {
        const { cuadrante, modificari } = modificariPorCuadrante[cuadranteKey];
        
        if (!cuadrante) return;
        
        // Construir LUNA din selectedMonth și selectedYear (sau selectedMesAno dacă este setat)
        // IMPORTANT: Nu folosim cuadrante.LUNA pentru că poate fi din altă lună
        const lunaParaGuardar = selectedMesAno || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        
        // Construim un obiect cu TOATE zilele din cuadrante-ul original
        // Aplicăm modificările peste zilele originale pentru a evita ștergerea zilelor nemodificate
        const cuadranteParaGuardar = {
          CODIGO: cuadrante.CODIGO || '',
          NOMBRE: cuadrante.NOMBRE || cuadrante.nombre || '',
          EMAIL: cuadrante.EMAIL || cuadrante.email || '',
          CENTRO: cuadrante.CENTRO || selectedCentro || '',
          LUNA: lunaParaGuardar, // Folosim luna selectată, nu cea din cuadrantele existente
        };
        
        // Adăugăm TOATE zilele din cuadrante-ul original (1-31)
        // Aplicăm modificările peste zilele originale
        for (let i = 1; i <= 31; i++) {
          const ziKey = `ZI_${i}`;
          // Dacă ziua a fost modificată, folosește valoarea modificată
          // Altfel, folosește valoarea originală din cuadrante
          if (modificari[i] !== undefined) {
            cuadranteParaGuardar[ziKey] = modificari[i];
          } else {
            // Folosește valoarea originală din cuadrante (sau null dacă nu există)
            const originalValue = cuadrante[ziKey];
            cuadranteParaGuardar[ziKey] = (originalValue !== undefined && originalValue !== null && originalValue !== '') 
              ? originalValue 
              : null;
          }
        }
        
        // Calculăm TotalHoras sumând orele din toate zilele
        const getHorasFromTurno = (turno) => {
          if (!turno || turno === '' || turno === null || turno === 'LIBRE') {
            return 0;
          }
          if (isCuadranteMarcaMulticentro(turno)) {
            return 0;
          }
          
          // Format: "T2 19:30-07:30" sau "T1 07:00-15:00"
          const timeMatch = turno.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const startHour = parseInt(timeMatch[1], 10);
            const startMin = parseInt(timeMatch[2], 10);
            const endHour = parseInt(timeMatch[3], 10);
            const endMin = parseInt(timeMatch[4], 10);
            
            let startMinutes = startHour * 60 + startMin;
            let endMinutes = endHour * 60 + endMin;
            
            // Pentru ture nocturne (peste miezul nopții)
            if (endMinutes < startMinutes) {
              endMinutes += 24 * 60;
            }
            
            const diffMinutes = endMinutes - startMinutes;
            return diffMinutes / 60;
          }
          
          // T1, T2, T3 fără ore = 8 ore standard
          if (turno === 'T1' || turno === 'T2' || turno === 'T3') {
            return 8;
          }
          
          // Dacă turno conține "T1", "T2", "T3" dar fără ore
          if (turno.includes('T1') && !turno.includes(':')) return 8;
          if (turno.includes('T2') && !turno.includes(':')) return 8;
          if (turno.includes('T3') && !turno.includes(':')) return 8;
          
          // Fallback: 8 ore
          return 8;
        };
        
        let totalHoras = 0;
        for (let i = 1; i <= 31; i++) {
          const ziKey = `ZI_${i}`;
          const turno = cuadranteParaGuardar[ziKey];
          totalHoras += getHorasFromTurno(turno);
        }
        cuadranteParaGuardar.TotalHoras = totalHoras > 0 ? totalHoras.toFixed(2) : null;
        
        cuadrantesToSave.push(cuadranteParaGuardar);
      });
      
      // Si no hay modificaciones, no hacer nada
      if (cuadrantesToSave.length === 0) {
        setLoading(false);
        return;
      }


      // Add JWT token for authentication
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Trimite la backend cu endpoint-ul de update
      const response = await fetch(routes.updateCuadrantes, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cuadrantes: cuadrantesToSave,
          centro: selectedCentro,
          mesAno: selectedMesAno || 'todos',
          action: 'update_cuadrantes',
          timestamp: new Date().toISOString(),
          user: authUser?.email || authUser?.['CORREO ELECTRONICO'] || 'unknown'
        })
      });

      if (response.ok) {
        showToast('success', 'Cuadrantes salvados correctamente');
        setHasChanges(false);
        setEditedCuadrantes({});
        // Recargar cuadrantes
        // Trigger reload by calling the load function again
        document.querySelector('button[onclick*="Cargar Cuadrantes"]')?.click();
      } else {
        showToast('error', 'Error al salvar cuadrantes');
      }
    } catch (error) {
      console.error('❌ Error al salvar:', error);
      showToast('error', 'Error de conexión al salvar');
    } finally {
      setLoading(false);
    }
  };
  const [selectedEmpleado, setSelectedEmpleado] = useState(''); // Nuevo selector de empleado
  const [selectedMesAno, setSelectedMesAno] = useState(''); // Selector de mes/año para filtrar cuadrantes
  /** Zile reale pentru „Cuadrantes Consolidados” / lista (lună din filtru sau selector principal). */
  const daysInMonthListaCuadrantes = useMemo(() => {
    const monthIndex = selectedMesAno
      ? parseInt(selectedMesAno.split('-')[1], 10) - 1
      : selectedMonth;
    const year = selectedMesAno ? parseInt(selectedMesAno.split('-')[0], 10) : selectedYear;
    return getDaysInMonth(monthIndex, year);
  }, [selectedMesAno, selectedMonth, selectedYear]);
  const [editedCuadrantes, setEditedCuadrantes] = useState({}); // Para trackear modificările
  const [hasChanges, setHasChanges] = useState(false); // Para afișa butonul de salvare
  const [showEditModal, setShowEditModal] = useState(false); // Para modal de editare
  const [editingDay, setEditingDay] = useState(null); // {cuadranteIndex, dayNumber, currentValue, empleado, codigo, centro}
  const [availableShifts, setAvailableShifts] = useState([]); // Turnurile disponibile din cuadrante
  const [selectedEmpleadoForDay, setSelectedEmpleadoForDay] = useState(''); // Angajatul selectat pentru asignare (opțional)
  const [empleadoForDaySearch, setEmpleadoForDaySearch] = useState(''); // Search term pentru angajat
  const [showEmpleadoForDayDropdown, setShowEmpleadoForDayDropdown] = useState(false); // Dropdown visibility
  const [showShiftsEditor, setShowShiftsEditor] = useState(false); // Pentru afișarea editorului de ture
  const [editingShift, setEditingShift] = useState(null); // Tura curentă în editare {shift: "T1 07:00-15:00", newStart: "08:00", newEnd: "16:00"}
  
  // Funcție pentru a extrage toate turele unice din cuadrantele încărcate
  const getAllUniqueShifts = useMemo(() => {
    const shifts = new Set();
    const shiftCounts = new Map(); // Pentru a număra aparițiile
    
    // Funcție pentru normalizarea formatării turnurilor
    const normalizeShift = (shiftValue) => {
      if (!shiftValue) return null;
      
      // Elimină spațiile multiple și normalizează formatul
      let normalized = shiftValue.trim().replace(/\s+/g, ' ');
      
      // Normalizează formatul "T1 09:00-17:00" (un singur spațiu între T1 și ore)
      const match = normalized.match(/^(T[123])\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        // Reconstruiește cu format standard: "T1 09:00-17:00"
        return `${match[1]} ${match[2]}:${match[3]}-${match[4]}:${match[5]}`;
      }
      
      // Dacă este doar "T1", "T2", "T3" fără ore, returnează așa cum este
      const typeMatch = normalized.match(/^(T[123])$/);
      if (typeMatch) {
        return typeMatch[1];
      }
      
      // Altfel, returnează normalizat (fără spații multiple)
      return normalized;
    };
    
    // Filtrează cuadrantele după filtrele active
    const filteredCuadrantes = cuadrantesLista.filter(cuadrante => {
      // Filtrare după luna selectată
      if (selectedMesAno && cuadrante.LUNA !== selectedMesAno) {
        return false;
      }
      
      // Filtrare după angajat selectat (dacă este setat)
      if (selectedEmpleado && selectedEmpleado.trim() !== '') {
        const empleadoMatch = cuadrante.CODIGO === selectedEmpleado ||
                             cuadrante.EMAIL?.toLowerCase() === selectedEmpleado.toLowerCase() ||
                             cuadrante.NOMBRE?.toLowerCase().includes(selectedEmpleado.toLowerCase());
        if (!empleadoMatch) {
          return false;
        }
      }
      
      return true;
    });
    
    // Parcurge doar cuadrantele filtrate (inclusiv modificările din editedCuadrantes)
    const dayLimit = selectedMesAno ? daysInMonthListaCuadrantes : 31;
    filteredCuadrantes.forEach(cuadrante => {
      for (let i = 1; i <= dayLimit; i++) {
        const ziKey = `ZI_${i}`;
        const identificator = getCuadranteIdentificator(cuadrante);
        const editKey = `${identificator}_${i}`;
        
        // Folosește valoarea editată dacă există, altfel valoarea originală
        const value = editedCuadrantes[editKey] !== undefined 
          ? editedCuadrantes[editKey] 
          : (cuadrante[ziKey] || '');
        
        if (value && value !== 'LIBRE' && value.trim() !== '' && !value.startsWith('MC->')) {
          const normalizedShift = normalizeShift(value);
          if (normalizedShift) {
            shifts.add(normalizedShift);
            shiftCounts.set(normalizedShift, (shiftCounts.get(normalizedShift) || 0) + 1);
          }
        }
      }
    });
    
    // Returnează array sortat cu informații despre fiecare tură
    return Array.from(shifts).map(shift => {
      // Extrage tipul turei (T1, T2, T3) și orele
      const match = shift.match(/^(T[123])\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        return {
          shift,
          type: match[1], // T1, T2, sau T3
          start: `${match[2]}:${match[3]}`,
          end: `${match[4]}:${match[5]}`,
          count: shiftCounts.get(shift) || 0
        };
      }
      // Dacă nu are format complet, încercă să extragă doar tipul
      const typeMatch = shift.match(/^(T[123])/);
      return {
        shift,
        type: typeMatch ? typeMatch[1] : 'OTRO',
        start: null,
        end: null,
        count: shiftCounts.get(shift) || 0
      };
    }).sort((a, b) => {
      // Sortează: T1, T2, T3, apoi altele
      if (a.type !== b.type) {
        if (a.type === 'T1') return -1;
        if (b.type === 'T1') return 1;
        if (a.type === 'T2') return -1;
        if (b.type === 'T2') return 1;
        if (a.type === 'T3') return -1;
        if (b.type === 'T3') return 1;
      }
      return a.shift.localeCompare(b.shift);
    });
  }, [cuadrantesLista, editedCuadrantes, selectedMesAno, selectedEmpleado, daysInMonthListaCuadrantes]);
  
  // Funcție pentru a actualiza toate aparițiile unei ture cu noile ore
  const handleUpdateShiftHours = (oldShift, newStart, newEnd) => {
    if (!oldShift || !newStart || !newEnd) return;
    
    // Normalizează turnul vechi pentru a găsi toate variantele
    const normalizeShift = (shiftValue) => {
      if (!shiftValue) return null;
      let normalized = shiftValue.trim().replace(/\s+/g, ' ');
      const match = normalized.match(/^(T[123])\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1]} ${match[2]}:${match[3]}-${match[4]}:${match[5]}`;
      }
      const typeMatch = normalized.match(/^(T[123])$/);
      if (typeMatch) {
        return typeMatch[1];
      }
      return normalized;
    };
    
    // Extrage tipul turei (T1, T2, T3)
    const typeMatch = oldShift.match(/^(T[123])/);
    if (!typeMatch) return;
    
    const shiftType = typeMatch[1]; // T1, T2, sau T3
    const newShift = `${shiftType} ${newStart}-${newEnd}`;
    const normalizedOldShift = normalizeShift(oldShift);
    
    // Actualizează toate aparițiile în editedCuadrantes
    const updated = { ...editedCuadrantes };
    let updatedCount = 0;
    
    // Filtrează cuadrantele după filtrele active (la fel ca în getAllUniqueShifts)
    const filteredCuadrantes = cuadrantesLista.filter(cuadrante => {
      if (selectedMesAno && cuadrante.LUNA !== selectedMesAno) {
        return false;
      }
      if (selectedEmpleado && selectedEmpleado.trim() !== '') {
        const empleadoMatch = cuadrante.CODIGO === selectedEmpleado ||
                             cuadrante.EMAIL?.toLowerCase() === selectedEmpleado.toLowerCase() ||
                             cuadrante.NOMBRE?.toLowerCase().includes(selectedEmpleado.toLowerCase());
        if (!empleadoMatch) {
          return false;
        }
      }
      return true;
    });
    
    // Parcurge doar cuadrantele filtrate și actualizează turele
    filteredCuadrantes.forEach(cuadrante => {
      const identificator = getCuadranteIdentificator(cuadrante);
      
      for (let i = 1; i <= 31; i++) {
        const editKey = `${identificator}_${i}`;
        const currentValue = updated[editKey] !== undefined 
          ? updated[editKey] 
          : (cuadrante[`ZI_${i}`] || '');
        
        // Normalizează valoarea curentă și compară cu tura veche normalizată
        if (currentValue && currentValue !== 'LIBRE' && currentValue.trim() !== '' && !currentValue.startsWith('MC->')) {
          const normalizedCurrent = normalizeShift(currentValue);
          if (normalizedCurrent === normalizedOldShift) {
            updated[editKey] = newShift;
            updatedCount++;
          }
        }
      }
    });
    
    if (updatedCount > 0) {
      setEditedCuadrantes(updated);
      setHasChanges(true);
      showToast('success', `✅ Actualizadas ${updatedCount} apariții de "${oldShift}" → "${newShift}"`);
    } else {
      showToast('warning', '⚠️ No se encontraron apariții para actualizar');
    }
    
    setEditingShift(null);
  };
  
  const [angajati, setAngajati] = useState([]);
  const [angajatiFiltrati, setAngajatiFiltrati] = useState([]);
  const [centros, setCentros] = useState([]);
  const [grupos, setGrupos] = useState([]);

  // Filtrare centre pe baza search term-ului
  const filteredCentros = useMemo(() => {
    if (!centroSearchTerm.trim()) {
      return centros;
    }
    const searchLower = centroSearchTerm.toLowerCase();
    return centros.filter(centro => 
      centro.toLowerCase().includes(searchLower)
    );
  }, [centros, centroSearchTerm]);

  const filteredCentrosLista = useMemo(() => {
    if (!centroSearchTermLista.trim()) {
      return centros;
    }
    const searchLower = centroSearchTermLista.toLowerCase();
    return centros.filter(centro => 
      centro.toLowerCase().includes(searchLower)
    );
  }, [centros, centroSearchTermLista]);

  // Nu mai sincronizăm automat search term-urile cu selectedCentro
  // pentru a permite utilizatorului să șteargă complet textul și să facă o nouă căutare
  const [horariosCentros, setHorariosCentros] = useState([]);
  const [horariosGrupos, setHorariosGrupos] = useState([]);
  const [settings, setSettings] = useState({});
  const [cuadrantePreview, setCuadrantePreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lunaExistenta, setLunaExistenta] = useState(false);
  const [cuadranteExistente, setCuadranteExistente] = useState([]);
  const [showExistentPreview, setShowExistentPreview] = useState(false);
  const [cuadranteAn, setCuadranteAn] = useState(null);
  const [lunaPreview, setLunaPreview] = useState(selectedMonth);
  const [luniExistentaAn, setLuniExistentaAn] = useState([]);
  const [userChoice, setUserChoice] = useState(null);
  // State pentru editare
  const [selectedCell, setSelectedCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editEmployee, setEditEmployee] = useState('');

  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  const emailLogat = authUser?.['CORREO ELECTRONICO'] || '';
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;

  const festivosToDisplay = useMemo(() => {
    const monthFilter =
      festivosMonthFilter === 'all' ? null : Number(festivosMonthFilter);

    return (festivosData || [])
      .filter((festivo) => {
        if (!festivo?.date) return false;
        const dateObj = new Date(festivo.date);
        if (Number.isNaN(dateObj.getTime())) return false;
        if (dateObj.getFullYear() !== festivosYear) return false;
        if (monthFilter === null) return true;
        return dateObj.getMonth() === monthFilter;
      })
      .sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        return aTime - bTime;
      });
  }, [festivosData, festivosMonthFilter, festivosYear]);

  const festivosYearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const baseYears = new Set([festivosYear - 1, festivosYear, festivosYear + 1, current]);
    return Array.from(baseYears)
      .filter((year) => year >= 2023 && year <= current + 5)
      .sort((a, b) => a - b);
  }, [festivosYear]);

  const festivoCcaaOptions = useMemo(
    () => [
      { value: '', label: 'General' },
      ...Object.entries(CCAA_NAMES).map(([code, name]) => ({
        value: code,
        label: name,
      })),
    ],
    [],
  );

  const openFestivoModal = useCallback(
    (festivo, mode = 'edit') => {
      const toInputDate = (value) => {
        if (!value) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }
        const dateObj = new Date(value);
        if (!Number.isNaN(dateObj.getTime())) {
          return dateObj.toISOString().slice(0, 10);
        }
        return value?.toString().split('T')[0] || '';
      };

      const year = festivosYear || new Date().getFullYear();
      const baseDate = `${year}-01-01`;
      const source = festivo || {
        id: '',
        date: baseDate,
        name: '',
        scope: 'Nacional',
        ccaa: '',
        observedDate: '',
        notes: '',
        active: 1,
      };

      setFestivoModalMode(mode);
      setFestivoEditing(festivo || null);
      setFestivoForm({
        id: source.id || '',
        date: toInputDate(source.date),
        name: source.name || '',
        scope: getScopeLabel(source.scope) || '',
        ccaa: source.ccaa || '',
        observedDate: toInputDate(source.observedDate),
        notes: source.notes || '',
        active:
          typeof source.active === 'number'
            ? String(source.active)
            : source.active === false
            ? '0'
            : '1',
      });
      setFestivoModalOpen(true);
    },
    [festivosYear],
  );

  const closeFestivoModal = useCallback(() => {
    setFestivoModalOpen(false);
    setFestivoEditing(null);
    setFestivoForm(null);
    setFestivoModalMode('edit');
  }, []);

  const handleFestivoFormChange = useCallback((field, value) => {
    setFestivoForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  // Generator configurabil (fără listă predeterminată)
  const [seqText, setSeqText] = useState(''); // ex: "2xT1,2xT2,2xT3,2xLIBRE"
  const [t1Start, setT1Start] = useState('08:00');
  const [t2Start, setT2Start] = useState('16:00');
  const [t3Start, setT3Start] = useState('00:00');
  const [turnoHours, setTurnoHours] = useState(8);
  const hasCustomSeq = (seqText || '').trim().length > 0;
  // Weekly pattern (L-D). Keys 1..7: 1=Lunes, ..., 7=Domingo. Values: 'T1'|'T2'|'T3'|'LIBRE'
  const [weeklyPattern, setWeeklyPattern] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' });
  const hasWeeklyPattern = Object.values(weeklyPattern).some(v => v && v.length);

  // Demo data for CuadrantesPage
  const setDemoData = useCallback(() => {
    const demoEmpleados = [
      {
        'NOMBRE / APELLIDOS': 'Carlos Antonio Rodríguez',
        'CODIGO': 'ADM001',
        'CORREO ELECTRONICO': 'admin@demo.com',
        'GRUPO': 'Admin',
        'ESTADO': 'Activo',
        'CENTRO TRABAJO': 'Madrid Centro',
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
        'CENTRO TRABAJO': 'Madrid Centro',
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
        'CENTRO TRABAJO': 'Madrid Centro',
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
        'CENTRO TRABAJO': 'Madrid Centro',
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
        'CENTRO TRABAJO': 'Madrid Centro',
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
        'CENTRO TRABAJO': 'Madrid Centro',
        'TELEFONO': '+34 600 678 901',
        'FECHA DE ALTA': '2023-06-01',
        'CARGO': 'Técnica de Jardinería',
        'DEPARTAMENTO': 'Jardinería'
      },
      {
        'NOMBRE / APELLIDOS': 'Carlos Ruiz García',
        'CODIGO': 'EMP007',
        'CORREO ELECTRONICO': 'carlos.ruiz@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO TRABAJO': 'Barcelona Norte',
        'TELEFONO': '+34 600 789 012',
        'FECHA DE ALTA': '2023-07-01',
        'CARGO': 'Técnico de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Elena Morales Torres',
        'CODIGO': 'EMP008',
        'CORREO ELECTRONICO': 'elena.morales@demo.com',
        'GRUPO': 'Supervisor',
        'ESTADO': 'Activo',
        'CENTRO TRABAJO': 'Barcelona Norte',
        'TELEFONO': '+34 600 890 123',
        'FECHA DE ALTA': '2023-08-01',
        'CARGO': 'Supervisora de Mantenimiento',
        'DEPARTAMENTO': 'Mantenimiento'
      },
      {
        'NOMBRE / APELLIDOS': 'Miguel Hernández López',
        'CODIGO': 'EMP009',
        'CORREO ELECTRONICO': 'miguel.hernandez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO TRABAJO': 'Valencia Sur',
        'TELEFONO': '+34 600 901 234',
        'FECHA DE ALTA': '2023-09-01',
        'CARGO': 'Técnico de Jardinería',
        'DEPARTAMENTO': 'Jardinería'
      }
    ];

    const demoClientes = ['Madrid Centro', 'Barcelona Norte', 'Valencia Sur'];

    setAngajati(demoEmpleados);
    setAngajatiFiltrati(demoEmpleados);
    setCentros(demoClientes);
    setGrupos(['Admin', 'Supervisor', 'Empleado', 'Developer']);
  }, []);

  // Funcție pentru încărcarea clienților
  const fetchClientes = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      return;
    }

    try {
      const response = await fetch(routes.getClientes);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const clientesData = Array.isArray(data) ? data : [];
      
      // Extrage numele clienților (NOMBRE O RAZON SOCIAL) și filtrează duplicates și invalide
      const clientesNombres = [...new Set(
        clientesData
          .map(c => c['NOMBRE O RAZON SOCIAL'] || '')
          .filter(nombre => nombre && nombre.trim() !== '' && nombre !== 'N/A')
      )].sort((a, b) => a.localeCompare(b, 'es'));
      
      
      setCentros(clientesNombres);
    } catch (error) {
      console.error('❌ Error fetching clientes:', error);
    }
  }, [authUser?.isDemo]);

  const loadFestivos = useCallback(
    async (year, options = {}) => {
      const { force = false } = options;
      if (!year) return;

      if (!force && festivosCacheRef.current[year]) {
        setFestivosData(festivosCacheRef.current[year]);
        return;
      }

      if (force && festivosCacheRef.current[year]) {
        delete festivosCacheRef.current[year];
      }

      setFestivosLoading(true);
      setFestivosError('');

      try {
        if (FESTIVOS_ENDPOINT) {
          const separator = FESTIVOS_ENDPOINT.includes('?') ? '&' : '?';
          const festivosUrl = `${FESTIVOS_ENDPOINT}${separator}accion=get&year=${encodeURIComponent(
            year,
          )}`;
          
          // Add JWT token for authentication
          const token = localStorage.getItem('auth_token');
          const headers = {
            'Content-Type': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(festivosUrl, {
            method: 'GET',
            headers,
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const raw = await response.json();
          const festivosList = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.festivos)
            ? raw.festivos
            : [];

          // Nu aruncăm eroare dacă array-ul este gol - poate anul nu are festivos în baza de date
          // if (!festivosList.length) {
          //   throw new Error('No festivos received');
          // }

          const normalized = festivosList.map((item, index) => {
            const inferredMonth =
              item.month ??
              item.mes ??
              (item.date || item.fecha
                ? new Date(item.date || item.fecha).getMonth() + 1
                : 1);
            const inferredDay =
              item.day ??
              item.dia ??
              (item.date || item.fecha
                ? new Date(item.date || item.fecha).getDate()
                : 1);

            const dateString =
              item.date ||
              item.fecha ||
              `${year}-${String(inferredMonth).padStart(2, '0')}-${String(
                inferredDay,
              ).padStart(2, '0')}`;

            return {
              id:
                item.id ??
                item.ID ??
                item.identifier ??
                `${dateString}-${index}`,
              date: dateString,
              name: item.name || item.nombre || item.titulo || 'Festivo',
              scope:
                (item.scope || item.ambito || item.tipo || 'General')?.toString() ??
                'General',
              ccaa: item.ccaa_code || item.ccaa || item.comunidad || null,
              observedDate: item.observed_date || item.observedDate || null,
              notes: item.notes || item.descripcion || null,
              active:
                typeof item.active === 'number'
                  ? item.active
                  : item.active === false
                  ? 0
                  : 1,
            };
          });

          festivosCacheRef.current[year] = normalized;
          setFestivosData(normalized);
        } else {
          throw new Error('Festivos endpoint not configured');
        }
      } catch (error) {
        console.warn(
          '⚠️ Usando datos de festivos de fallback por ahora:',
          error,
        );
        if (!force && festivosCacheRef.current[year]) {
          setFestivosData(festivosCacheRef.current[year]);
        } else {
          const fallbackFestivos = getFestivosFallback(year);
          festivosCacheRef.current[year] = fallbackFestivos;
          setFestivosData(fallbackFestivos);
        }
        setFestivosError(
          'Mostrando calendario festivo aproximado hasta conectar el endpoint real.',
        );
      } finally {
        setFestivosLoading(false);
      }
    },
    [],
  );

  const handleCreateFestivoNextYear = useCallback((festivo) => {
    if (!festivo || !festivo.date) {
      showToast('error', 'No se puede crear el festivo para el año siguiente: fecha inválida');
      return;
    }

    // Normalizează data (similar cu toInputDate din openFestivoModal)
    const toInputDate = (value) => {
      if (!value) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      const dateObj = new Date(value);
      if (!Number.isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
      return value?.toString().split('T')[0] || '';
    };

    const normalizedDate = toInputDate(festivo.date);
    if (!normalizedDate) {
      showToast('error', 'Fecha inválida: no se pudo normalizar la fecha');
      return;
    }

    // Parsează direct string-ul YYYY-MM-DD pentru a evita probleme cu timezone
    const dateMatch = normalizedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      showToast('error', 'Fecha inválida: formato debe ser YYYY-MM-DD');
      return;
    }

    const [, yearStr, monthStr, dayStr] = dateMatch;
    const currentYear = parseInt(yearStr, 10);

    // Calculează data pentru anul următor (păstrând ziua și luna)
    const nextYear = currentYear + 1;
    const nextYearDateStr = `${nextYear}-${monthStr}-${dayStr}`; // YYYY-MM-DD

    // Calculează observedDate pentru anul următor dacă există
    let nextYearObservedDateStr = '';
    if (festivo.observedDate) {
      const normalizedObservedDate = toInputDate(festivo.observedDate);
      if (normalizedObservedDate) {
        const observedDateMatch = normalizedObservedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (observedDateMatch) {
          const [, , obsMonthStr, obsDayStr] = observedDateMatch;
          nextYearObservedDateStr = `${nextYear}-${obsMonthStr}-${obsDayStr}`;
        }
      }
    }

    // Creează obiectul festivo precompletat pentru anul următor
    const nextYearFestivo = {
      id: '', // Lăsăm gol pentru autogenerare
      date: nextYearDateStr,
      name: festivo.name || '',
      scope: festivo.scope || 'Nacional',
      ccaa: festivo.ccaa || '',
      observedDate: nextYearObservedDateStr,
      notes: festivo.notes || '',
      active: festivo.active ?? 1,
    };

    // Deschide modalul de creare cu datele precompletate
    openFestivoModal(nextYearFestivo, 'create');
  }, [openFestivoModal, showToast]);

  const handleFestivoSave = useCallback(async () => {
    if (!festivoForm) {
      closeFestivoModal();
      return;
    }
    if (festivoModalMode === 'edit' && !festivoEditing) {
      closeFestivoModal();
      return;
    }

    const params = new URLSearchParams();
    params.set('accion', festivoModalMode === 'create' ? 'nueva fiesta' : 'edit');
    const normalizedName = (festivoForm.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'festivo';
    const fallbackDate = festivoForm.date || `${festivosYear || new Date().getFullYear()}-01-01`;
    const autogeneratedId = `${fallbackDate}-${normalizedName}`;
    const festivoId =
      (typeof festivoForm.id === 'string' ? festivoForm.id.trim() : '') ||
      festivoEditing?.id ||
      (festivoModalMode === 'create' ? autogeneratedId : '');
    params.set('id', festivoId);
    params.set('fecha', festivoForm.date || '');
    params.set('nombre', festivoForm.name || '');
    if (festivoForm.scope) {
      params.set('scope', festivoForm.scope);
    }
    if (festivoForm.ccaa) {
      params.set('ccaa', festivoForm.ccaa);
    }
    if (festivoForm.observedDate) {
      params.set('observedDate', festivoForm.observedDate);
    }
    if (festivoForm.notes) {
      params.set('notes', festivoForm.notes);
    }
    params.set('active', festivoForm.active ?? '1');

    const endpointBase =
      festivoModalMode === 'create' ? CREATE_FESTIVO_ENDPOINT : EDIT_FESTIVO_ENDPOINT;
    const editUrl = `${endpointBase}?${params.toString()}`;

    try {
      
      // Add JWT token for authentication
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(editUrl, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      // eslint-disable-next-line no-unused-vars
      } catch (_parseError) {
        console.warn('Respuesta de festivo sin JSON:', text);
      }

      if (
        parsed &&
        Array.isArray(parsed) &&
        parsed[0] &&
        (parsed[0].success === true || parsed[0].success === 'true')
      ) {
        showToast('success', 'Festivo actualizado correctamente');
        if (festivoModalMode === 'create' && festivoForm) {
          setFestivoForm((prev) => (prev ? { ...prev, id: festivoId } : prev));
        }
        await loadFestivos(festivosYear, { force: true });
      } else {
        throw new Error(`Respuesta inesperada: ${text}`);
      }
    } catch (error) {
      console.error('❌ Error actualizando festivo:', error);
      showToast('error', 'No se pudo actualizar el festivo');
    } finally {
      closeFestivoModal();
    }
  }, [
    closeFestivoModal,
    festivoForm,
    festivosYear,
    festivoModalMode,
    festivoEditing,
    loadFestivos,
    showToast,
  ]);

  const handleFestivoDelete = useCallback(
    async (festivo) => {
      if (!festivo || !festivo.id) return;
      setFestivoToDelete(festivo);
    },
    [],
  );

  const confirmFestivoDelete = useCallback(async () => {
    if (!festivoToDelete || !festivoToDelete.id) {
      setFestivoToDelete(null);
      return;
    }

    const festivo = festivoToDelete;
    const params = new URLSearchParams();
    params.set('accion', 'delete');
    params.set('id', festivo.id);
    params.set('fecha', festivo.date || '');
    params.set('nombre', festivo.name || '');
    if (festivo.scope) {
      params.set('scope', festivo.scope);
    }
    if (festivo.ccaa) {
      params.set('ccaa', festivo.ccaa);
    }
    if (festivo.observedDate) {
      params.set('observedDate', festivo.observedDate);
    }
    if (festivo.notes) {
      params.set('notes', festivo.notes);
    }
    params.set('active', festivo.active ?? '1');

    const deleteUrl = `${DELETE_FESTIVO_ENDPOINT}?${params.toString()}`;

    try {
      
      // Add JWT token for authentication
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(deleteUrl, { 
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      // eslint-disable-next-line no-unused-vars
      } catch (_parseError) {
        console.warn('Respuesta de borrado sin JSON:', text);
      }

      if (
        parsed &&
        Array.isArray(parsed) &&
        parsed[0] &&
        (parsed[0].success === true || parsed[0].success === 'true')
      ) {
        showToast('success', 'Festivo eliminado correctamente');
        await loadFestivos(festivosYear, { force: true });
      } else {
        throw new Error(`Respuesta inesperada: ${text}`);
      }
    } catch (error) {
      console.error('❌ Error eliminando festivo:', error);
      showToast('error', 'No se pudo eliminar el festivo');
    }
    setFestivoToDelete(null);
  }, [festivosYear, festivoToDelete, loadFestivos, showToast]);

  // Obține angajații
  const fetchAngajati = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      return;
    }

    try {
      
      // Use same authenticated headers pattern as useAdminApi.getAllUsers
      const response = await fetch(routes.getEmpleados, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const lista = Array.isArray(data) ? data : [data];
      
      setAngajati(lista);
      
      // Extrage grupurile unice
      const gruposUnicos = [...new Set(lista.map(a => a['GRUPO'] || '').filter(g => g))];
      setGrupos(gruposUnicos);
      
      // Nu seta automat grupul - lasă utilizatorul să aleagă
      // if (gruposUnicos.length > 0 && !selectedGrupo && isManager) {
      //   setSelectedGrupo(gruposUnicos[0]);
      // }
    } catch (error) {
      console.error('❌ Error fetching angajati:', error);
      alert(`Error al cargar empleados: ${error.message}`);
    }
  }, [authUser?.isDemo]);

  // Fetch angajați și clienți la mount
  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (authUser?.isDemo) {
      setDemoData();
      return;
    }

    fetchAngajati();
    fetchClientes();
  }, [authUser, fetchAngajati, fetchClientes, setDemoData]);

  useEffect(() => {
    if (activeTab !== 'festivos') {
      return;
    }
    setFestivosMonthFilter('all');
    loadFestivos(festivosYear);
  }, [activeTab, festivosYear, loadFestivos]);

  useEffect(() => {
    setMulticentroManualDias({});
    setMulticentroListEdits({});
  }, [selectedMonthHorariosMulticentro]);

  // Încarcă datele pentru horarios
  const loadHorariosData = useCallback(async () => {
    setHorariosLoading(true);
    try {
      
      const centrosMapped = centros.map((centro, index) => ({
        id: index + 1,
        nombre: centro
      }));
      const gruposMapped = grupos.map((grupo, index) => ({
        id: index + 1,
        nombre: grupo
      }));
      
      setHorariosCentros(centrosMapped);
      setHorariosGrupos(gruposMapped);
      
      console.log('✅ Horarios data loaded:', { centros: centrosMapped, grupos: gruposMapped });
    } catch (error) {
      console.error('Error loading horarios data:', error);
    } finally {
      setHorariosLoading(false);
    }
  }, [centros, grupos]);

  // Filtrează angajații după centru, grup și angajat selectat
  useEffect(() => {
    if (selectedCentro) {
      // Debug: Arată toți centrele disponibile în date
      // const todosLosCentros = [...new Set(angajati.map(a => a['CENTRO TRABAJO']))];
      
      const normalizedSelectedCentro = normalizeString(selectedCentro);
      let filtrati = angajati
        .filter(a => {
          const centroTrabajo = a['CENTRO TRABAJO'] || '';
          const centroMatch = normalizeString(centroTrabajo) === normalizedSelectedCentro;
          return centroMatch;
        })
        .filter(a => {
          // Filtrează doar angajații activi
          const estado = (a['ESTADO'] || a.estado || '').toString().trim().toUpperCase();
          const isActivo = estado === 'ACTIVO';
          // Filtru pentru angajați activi
          return isActivo;
        })
        .filter(a => {
          // Pentru manageri nu excludem utilizatorul curent
          if (isManager) return true;
          const emailMatch = (a['CORREO ELECTRONICO'] || '').trim().toLowerCase() !== emailLogat.toLowerCase();
          return emailMatch;
        });
      
      // Para managers, filtra también por grupo SOLO si está explícitamente seleccionado
      if (isManager && selectedGrupo && selectedGrupo !== 'Todos los grupos' && selectedGrupo !== '' && selectedGrupo !== 'Selecciona grupo') {
        filtrati = filtrati.filter(a => (a['GRUPO'] || '') === selectedGrupo);
      }
      
      // Filtrar por empleado específico si está seleccionado
      if (selectedEmpleado && selectedEmpleado !== '') {
        filtrati = filtrati.filter(a => (a['CODIGO'] || a.id) === selectedEmpleado);
      }
      setAngajatiFiltrati(filtrati);
    } else {
      setAngajatiFiltrati([]);
    }
  }, [selectedCentro, selectedGrupo, selectedEmpleado, angajati, emailLogat, isManager]);

  // Setări inițiale pentru fiecare angajat
  useEffect(() => {
    setSettings((prevSettings) => {
      const initial = {};

      angajatiFiltrati.forEach(a => {
        const id = a['CODIGO'] || a.id;
        initial[id] = prevSettings[id] || {
          zi1: 'M', // Muncă sau L (Liber)
          etapa: 1,
          total: isManager ? 3 : 3, // Pentru angajați și manageri
          tipRotatie: '3cu2',
          oreTura: 8,
          oraStart: '08:00',
          seqOffset: 0,
        };
      });

      return initial;
    });
  }, [angajatiFiltrati, isManager]);

  // Verifică dacă luna există deja în sistem
  const verificaLunaExistenta = async () => {
    try {
      const lunaKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const angajatiDinCuadrante = angajatiFiltrati.map(a => (a['CORREO ELECTRONICO'] || '').trim().toLowerCase());
      
      let existente = [];
      
      // Pentru fiecare angajat, verifică dacă are cuadrante salvate
      for (const emailAngajat of angajatiDinCuadrante) {
        try {
          // Add JWT token for authentication
          const token = localStorage.getItem('auth_token');
          const headers = {
            'Content-Type': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const resp = await fetch(routes.getCuadrantes, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email: emailAngajat })
          });
          
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          
          const data = await resp.json();
          const cuadranteAngajat = Array.isArray(data) ? data : [data];
          existente = existente.concat(cuadranteAngajat);
        } catch (e) {
          console.error(`Eroare la verificarea pentru ${emailAngajat}:`, e);
        }
      }
      
      setCuadranteExistente(existente);
      
      // Verifică dacă luna curentă există pentru toți angajații
      const existaPentruToate = angajatiDinCuadrante.every(emailAngajat => {
        const existaPentruAngajat = existente.some(c => {
          const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailAngajat;
          
          let lunaMatch = false;
          const lunaDinDB = c.LUNA;
          if (lunaDinDB) {
            if (typeof lunaDinDB === 'number') {
              const date = new Date((lunaDinDB - 25569) * 86400 * 1000);
              const lunaDinDBString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              lunaMatch = lunaDinDBString === lunaKey;
            } else {
              lunaMatch = lunaDinDB.toString() === lunaKey;
            }
          }
          
          return emailMatch && lunaMatch;
        });
        return existaPentruAngajat;
      });
      
      setLunaExistenta(existaPentruToate && angajatiDinCuadrante.length > 0);
      
      // Calculează lunile existente din an
      const luniExistenta = [];
      for (let luna = 0; luna < 12; luna++) {
        const lunaKeyAn = `${selectedYear}-${String(luna + 1).padStart(2, '0')}`;
        const existaPentruLuna = angajatiDinCuadrante.every(emailAngajat => 
          existente.some(c => {
            const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailAngajat;
            
            let lunaMatch = false;
            const lunaDinDB = c.LUNA;
            if (lunaDinDB) {
              if (typeof lunaDinDB === 'number') {
                const date = new Date((lunaDinDB - 25569) * 86400 * 1000);
                const lunaDinDBString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                lunaMatch = lunaDinDBString === lunaKeyAn;
              } else {
                lunaMatch = lunaDinDB.toString() === lunaKeyAn;
              }
            }
            
            return emailMatch && lunaMatch;
          })
        );
        if (existaPentruLuna && angajatiDinCuadrante.length > 0) {
          luniExistenta.push(luna);
        }
      }
      setLuniExistentaAn(luniExistenta);
    } catch (error) {
      console.error('Eroare la verificarea lunii existente:', error);
      setLunaExistenta(false);
      setLuniExistentaAn([]);
    }
  };

  // Generează cuadrantul pentru o lună
  const handleGenerar = async () => {
    // Validare pentru selectedMonth și selectedYear
    if (isNaN(selectedMonth) || selectedMonth < 0 || selectedMonth > 11) {
      console.error('❌ Invalid selectedMonth:', selectedMonth);
      alert('Error: Mes inválido. Por favor, selecciona un mes válido.');
      return;
    }
    
    if (isNaN(selectedYear) || selectedYear < 2000 || selectedYear > 2100) {
      console.error('❌ Invalid selectedYear:', selectedYear);
      alert('Error: Año inválido. Por favor, selecciona un año válido.');
      return;
    }
    
    if (!selectedCentro) {
      alert('Por favor selecciona un centro antes de generar los cuadrantes!');
      return;
    }
    
    if (angajatiFiltrati.length === 0) {
      alert('No hay empleados disponibles para el centro seleccionado!');
      return;
    }
    
    setLoading(true);
    try {
      // Verifică dacă luna există deja
      await verificaLunaExistenta();
      
      const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
      
      const parseSequence = (text) => {
        // "2xT1,2xT2,2xT3,2xLIBRE" => [{type:'T1',count:2},...]
        if (!text) return null;
        try {
          const tokens = text.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
          const seq = tokens.map(tok => {
            const m = tok.match(/^(\d+)x\s*(T1|T2|T3|LIBRE)$/i);
            if (!m) throw new Error('Formato inválido en secuencia');
            return { count: Number(m[1]), type: m[2].toUpperCase() };
          });
          return seq.length ? seq : null;
        } catch (e) {
          console.warn('Secuencia inválida, se ignora:', e);
          return null;
        }
      };

      const customSeq = parseSequence(seqText);

      const result = angajatiFiltrati.map((a) => {
        const id = a['CODIGO'] || a.id;
        const s = settings[id] || {
          zi1: 'M', // Default: Trabajo
          etapa: 1,
          total: 3,
          tipRotatie: '3cu2',
          oreTura: 8,
          oraStart: '08:00'
        };
        
        // Forțează zi1 la 'M' dacă nu este setat
        if (!s.zi1) {
          s.zi1 = 'M';
        }
        let zile = [];

        if (customSeq && customSeq.length) {
          // Construiește după secvența personalizată
          const seqFlat = [];
          customSeq.forEach(({ count, type }) => {
            for (let i = 0; i < count; i++) seqFlat.push(type);
          });
          const offset = Number((settings[id]?.seqOffset || 0) % Math.max(seqFlat.length,1));
          for (let zi = 0; zi < daysInMonth; zi++) {
            const token = seqFlat[(zi + offset) % seqFlat.length];
            if (token === 'LIBRE') {
              zile.push('LIBRE');
            } else {
              const start = token === 'T1' ? t1Start : token === 'T2' ? t2Start : t3Start;
              const hours = Number(turnoHours) || 8;
              const [h, m] = String(start || '08:00').split(':').map(Number);
              const end = new Date(2000, 0, 1, h, (m || 0) + hours * 60);
              const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
              zile.push(`${token} ${start}-${oraEnd}`);
            }
          }
        } else if (Object.values(weeklyPattern).some(v => v && v.length)) {
          // Pattern săptămânal: aplică T1/T2/T3/LIBRE în funcție de ziua săptămânii
          for (let zi = 1; zi <= daysInMonth; zi++) {
            const jsDay = new Date(selectedYear, selectedMonth, zi).getDay(); // 0=Sun..6=Sat
            const weekIndex = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
            const token = (weeklyPattern[weekIndex] || '').toUpperCase();
            if (!token || token === 'LIBRE') {
              zile.push('LIBRE');
            } else {
              const start = token === 'T1' ? t1Start : token === 'T2' ? t2Start : t3Start;
              const hours = Number(turnoHours) || 8;
              const [h, m] = String(start || '08:00').split(':').map(Number);
              const end = new Date(2000, 0, 1, h, (m || 0) + hours * 60);
              const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
              zile.push(`${token} ${start}-${oraEnd}`);
            }
          }
        } else {
          // Fallback: rotație clasică trabajo/libre
          const rot = ROTATIONS.find(r => r.label === s.tipRotatie) || ROTATIONS[0];
          // Respectă setarea explicită din UI
          let etapa = s.etapa;
          // Respectă configurația utilizatorului pentru Día 1
          let mod = s.zi1 === 'M' ? 'work' : 'free';
          
          if (isNaN(daysInMonth) || daysInMonth <= 0) {
            console.error(`❌ Invalid daysInMonth: ${daysInMonth} for employee ${id}`);
            zile = [];
          } else {
            for (let zi = 1; zi <= daysInMonth; zi++) {
            // Pentru ziua 1, respectă întotdeauna configurația utilizatorului
            if (zi === 1) {
              if (s.zi1 === 'M') {
                // Configurația utilizatorului: Trabajo
                const oraStart = s.oraStart || '08:00';
                const oreTura = s.oreTura || 8;
                const [h, m] = oraStart.split(':').map(Number);
                const end = new Date(2000, 0, 1, h, m + oreTura * 60);
                const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                
              let turnType = 'T1';
              if (oreTura === 12) {
                turnType = h < 12 ? 'T1' : 'T2';
              } else if (oreTura === 8) {
                  if (h >= 6 && h < 14) {
                    turnType = 'T1';
                  } else if (h >= 14 && h < 22) {
                    turnType = 'T2';
                  } else {
                    turnType = 'T3';
                  }
              }
              
              zile.push(`${turnType} ${oraStart}-${oraEnd}`);
              } else {
                // Configurația utilizatorului: Libre sau default
                zile.push('LIBRE');
              }
            } else if (mod === 'work') {
              const oraStart = s.oraStart || '08:00';
              const oreTura = s.oreTura || 8;
              const [h, m] = oraStart.split(':').map(Number);
              const end = new Date(2000, 0, 1, h, m + oreTura * 60);
              const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                
                // Determină tipul de tură în funcție de configurația angajatului
              let turnType = 'T1';
              if (oreTura === 12) {
                turnType = h < 12 ? 'T1' : 'T2';
              } else if (oreTura === 8) {
                  if (h >= 6 && h < 14) {
                    turnType = 'T1';
                  } else if (h >= 14 && h < 22) {
                    turnType = 'T2';
                  } else {
                    turnType = 'T3';
                  }
              }
              
              zile.push(`${turnType} ${oraStart}-${oraEnd}`);
            } else {
              zile.push('LIBRE');
            }
            
            // Logica corectă de rotație
            if (mod === 'work' && etapa >= rot.work) { 
              etapa = 1; 
              mod = 'free'; 
            } else if (mod === 'free' && etapa >= rot.free) { 
              etapa = 1; 
              mod = 'work'; 
            } else {
            etapa++;
            }
          }
          }
        }
        
        if (zile.length === 0) {
          console.error(`❌ No days generated for employee ${id}! daysInMonth: ${daysInMonth}, selectedMonth: ${selectedMonth}`);
        }
        
        const cuadranteObj = {
          CODIGO: a['CODIGO'] || '',
          EMAIL: a['CORREO ELECTRONICO'] || '',
          NOMBRE: a['NOMBRE / APELLIDOS'] || '',
          LUNA: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
          CENTRO: selectedCentro,
          zile: zile
        };
        
        for (let zi = 1; zi <= daysInMonth; zi++) {
          cuadranteObj[`ZI_${zi}`] = zile[zi - 1];
        }
        
        // Calculăm TotalHoras sumând orele din toate zilele
        const getHorasFromTurno = (turno) => {
          if (!turno || turno === '' || turno === null || turno === 'LIBRE') {
            return 0;
          }
          if (isCuadranteMarcaMulticentro(turno)) {
            return 0;
          }
          
          // Format: "T2 19:30-07:30" sau "T1 07:00-15:00"
          const timeMatch = turno.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const startHour = parseInt(timeMatch[1], 10);
            const startMin = parseInt(timeMatch[2], 10);
            const endHour = parseInt(timeMatch[3], 10);
            const endMin = parseInt(timeMatch[4], 10);
            
            let startMinutes = startHour * 60 + startMin;
            let endMinutes = endHour * 60 + endMin;
            
            // Pentru ture nocturne (peste miezul nopții)
            if (endMinutes < startMinutes) {
              endMinutes += 24 * 60;
            }
            
            const diffMinutes = endMinutes - startMinutes;
            return diffMinutes / 60;
          }
          
          // T1, T2, T3 fără ore = 8 ore standard
          if (turno === 'T1' || turno === 'T2' || turno === 'T3') {
            return 8;
          }
          
          // Dacă turno conține "T1", "T2", "T3" dar fără ore
          if (turno.includes('T1') && !turno.includes(':')) return 8;
          if (turno.includes('T2') && !turno.includes(':')) return 8;
          if (turno.includes('T3') && !turno.includes(':')) return 8;
          
          // Fallback: 8 ore
          return 8;
        };

        let totalHoras = 0;
        for (let zi = 1; zi <= daysInMonth; zi++) {
          const turno = cuadranteObj[`ZI_${zi}`];
          totalHoras += getHorasFromTurno(turno);
        }
        cuadranteObj.TotalHoras = totalHoras.toFixed(2);
        
        return cuadranteObj;
      });


      // Verifică dacă result este gol sau nu are date
      if (!result || result.length === 0) {
        console.error('❌ Generated result is empty!');
        alert('Error: No se generaron cuadrantes. Por favor, verifica la configuración.');
        return;
      }

      // Verifică dacă toate cuadrantele au zile populate
      const cuadrantesSinZile = result.filter(c => !c.zile || c.zile.length === 0);
      if (cuadrantesSinZile.length > 0) {
        console.warn('⚠️ Some cuadrantes have empty zile:', cuadrantesSinZile);
      }

      // Log generarea cuadrante
      await activityLogger.logCuadranteGenerated({
        month: selectedMonth + 1,
        year: selectedYear,
        employees: angajatiFiltrati.length,
        center: selectedCentro
      }, authUser);

      setCuadrantePreview(result);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error generating cuadrante:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload Excel pentru import horario_multicentro
  const handleFileUploadMulticentro = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Solo se permiten archivos Excel (.xlsx, .xls)');
      return;
    }

    setUploadingExcelMulticentro(true);
    setError(null);
    setExcelPreviewDataMulticentro(null);

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);
      // mes este opțional - se detectează din Excel
      if (selectedYear && selectedMonth !== null) {
        formData.append('mes', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`);
      }

      const response = await fetch(routes.uploadHorarioMulticentroExcel, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar Excel');
      }

      const result = await response.json();
      
      // Afișăm preview înainte de salvare
      if (result.horarios && result.horarios.length > 0) {
        setExcelPreviewDataMulticentro(result);
        setShowExcelPreviewModalMulticentro(true);
      } else {
        showToast('warning', 'No se encontraron horarios en el Excel');
      }
    } catch (err) {
      console.error('Error uploading Excel horario_multicentro:', err);
      showToast('error', err.message || 'Error al procesar Excel');
    } finally {
      setUploadingExcelMulticentro(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Upload Excel pentru import cuadrantes
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Solo se permiten archivos Excel (.xlsx, .xls)');
      return;
    }

    if (!selectedCentro) {
      showToast('error', 'Por favor selecciona un centro antes de importar');
      return;
    }

    setUploadingExcel(true);
    setError(null);
    setExcelPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mes', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`);
      formData.append('centro', selectedCentro);
      formData.append('excelFormat', excelCuadrantesFormat);

      const response = await fetch(routes.uploadCuadrantesExcel, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar Excel');
      }

      const result = await response.json();
      
      // Afișăm preview înainte de salvare
      if (result.cuadrantes && result.cuadrantes.length > 0) {
        // Verifică pentru fiecare cuadrante dacă există deja
        const mesAno = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        console.log(`🔍 Verificando existencia para ${result.cuadrantes.length} cuadrantes, mes: ${mesAno}, centro: ${selectedCentro}`);
        
        const cuadrantesConVerificare = await Promise.all(
          result.cuadrantes.map(async (cuadrante) => {
            if (!cuadrante.CODIGO) {
              console.log(`⚠️ Cuadrante sin CODIGO: ${cuadrante.NOMBRE || 'N/A'}`);
              return { ...cuadrante, yaExiste: false, tipoExistente: null };
            }

            try {
              const checkParams = new URLSearchParams({
                codigo: cuadrante.CODIGO,
                mes: mesAno,
              });
              // Folosim CENTRO din cuadrante dacă există, altfel selectedCentro
              const centroParaVerificar = cuadrante.CENTRO || selectedCentro;
              if (centroParaVerificar) {
                checkParams.append('centro', centroParaVerificar);
              }

              console.log(`🔍 Verificando: CODIGO=${cuadrante.CODIGO}, MES=${mesAno}, CENTRO=${centroParaVerificar || 'N/A'}`);

              const checkResponse = await fetch(`${routes.checkExistingCuadrante}?${checkParams.toString()}`, {
                method: 'GET',
                headers: {
                  'Authorization': token ? `Bearer ${token}` : '',
                },
              });

              if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                console.log(`✅ Respuesta para ${cuadrante.CODIGO}:`, checkData);
                const yaExiste = checkData.hasCuadrante || checkData.hasHorarioMulticentro;
                const tipoExistente = [];
                if (checkData.hasCuadrante) tipoExistente.push('Cuadrante');
                if (checkData.hasHorarioMulticentro) tipoExistente.push('Horario Multicentro');
                if (yaExiste) {
                  console.log(`⚠️ Ya existe para ${cuadrante.CODIGO}: ${tipoExistente.join(', ')}`);
                }
                return { ...cuadrante, yaExiste, tipoExistente };
              } else {
                console.error(`❌ Error HTTP ${checkResponse.status} verificando ${cuadrante.CODIGO}`);
              }
            } catch (err) {
              console.error(`❌ Error verificando existencia para ${cuadrante.CODIGO}:`, err);
            }

            return { ...cuadrante, yaExiste: false, tipoExistente: null };
          })
        );
        
        const existentes = cuadrantesConVerificare.filter(c => c.yaExiste);
        console.log(`📊 Resumen: ${existentes.length} de ${cuadrantesConVerificare.length} cuadrantes ya existen`);

        setExcelPreviewData({ ...result, cuadrantes: cuadrantesConVerificare });
        if (excelCuadrantesFormat === 'auto' && result.excelFormatUsed) {
          const fmtLabels = {
            turno_horas_tabla: 'Tabla Nombre/Código + Turno/Horas',
            he_hs: 'Estándar (M/T + HE/HS)',
            celdas_multilinea: 'Celdas multilínea',
          };
          showToast(
            'success',
            `Formato detectado: ${fmtLabels[result.excelFormatUsed] || result.excelFormatUsed}`,
          );
        }
        setSelectedForHorarioMulticentro(new Set()); // Reset checkbox-uri la încărcare nouă
        // Reset checkbox-uri rescriere - selectează automat toate cuadrantesle existente pentru rescriere
        const existentesKeys = cuadrantesConVerificare
          .filter(c => c.yaExiste)
          .map(c => c.CODIGO || c.EMAIL || cuadrantesConVerificare.indexOf(c));
        setSelectedForRescriere(new Set(existentesKeys));
        setShowExcelPreviewModal(true);
      } else {
        showToast('warning', 'No se encontraron cuadrantes en el Excel');
      }
    } catch (err) {
      console.error('Error uploading Excel:', err);
      showToast('error', err.message || 'Error al procesar Excel');
    } finally {
      setUploadingExcel(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Generează cuadrante pe tot anul
  const handleGenerarAn = async () => {
    setLoading(true);
    try {
      let cuadranteExistente = [];
      let stareStart = {};
      let localUserChoice = null;
      
      try {
        const angajatiDinCuadrante = angajatiFiltrati.map(a => (a['CORREO ELECTRONICO'] || '').trim().toLowerCase());
        
        // Pentru fiecare angajat, verifică dacă are cuadrante salvate
        for (const emailAngajat of angajatiDinCuadrante) {
          try {
            // Add JWT token for authentication
            const token = localStorage.getItem('auth_token');
            const headers = {
              'Content-Type': 'application/json',
              'X-App-Source': 'DeCamino-Web-App',
              'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
              'X-Client-Type': 'web-browser',
              'User-Agent': 'DeCamino-Web-Client/1.0',
            };
            
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const resp = await fetch(routes.getCuadrantes, {
              method: 'POST',
              headers,
              body: JSON.stringify({ email: emailAngajat })
            });
            
            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status}`);
            }
            
            const data = await resp.json();
            const cuadranteAngajat = Array.isArray(data) ? data : [data];
            cuadranteExistente = cuadranteExistente.concat(cuadranteAngajat);
          } catch (e) {
            console.error(`Eroare la verificarea pentru ${emailAngajat}:`, e);
          }
        }
        
        const lunaKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const lunaExista = angajatiDinCuadrante.every(emailAngajat => 
          cuadranteExistente.some(c => {
            const emailMatch = (c.EMAIL || '').trim().toLowerCase() === emailAngajat;
            let lunaMatch = false;
            const lunaDinDB = c.LUNA;
            if (lunaDinDB) {
              if (typeof lunaDinDB === 'number') {
                const date = new Date((lunaDinDB - 25569) * 86400 * 1000);
                const lunaDinDBString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                lunaMatch = lunaDinDBString === lunaKey;
              } else {
                lunaMatch = lunaDinDB.toString() === lunaKey;
              }
            }
            return emailMatch && lunaMatch;
          })
        );
        
        if (lunaExista) {
          localUserChoice = confirm(
            `El mes ${MONTHS[selectedMonth]} ${selectedYear} ya existe en el sistema.\n\n` +
            'Elige:\n' +
            'OK = Genera todo el año comenzando desde el mes actual con tu lógica\n' +
            'Cancel = Genera todo el año continuando desde los cuadrantes existentes'
          );
          
          setUserChoice(localUserChoice);
          
          if (localUserChoice) {
            stareStart = {};
          } else {
            // Calculează starea de start din cuadrantele existente
            angajatiDinCuadrante.forEach(emailAngajat => {
              const angajat = angajatiFiltrati.find(a => (a['CORREO ELECTRONICO'] || '').trim().toLowerCase() === emailAngajat);
              if (angajat) {
                const id = angajat['CODIGO'] || angajat.id;
                const cuadranteAngajat = cuadranteExistente.filter(c => 
                  (c.EMAIL || '').trim().toLowerCase() === emailAngajat
                ).sort((a, b) => {
                  const lunaA = typeof a.LUNA === 'number' ? a.LUNA : new Date(a.LUNA).getTime();
                  const lunaB = typeof b.LUNA === 'number' ? b.LUNA : new Date(b.LUNA).getTime();
                  return lunaB - lunaA;
                });
                
                if (cuadranteAngajat.length > 0) {
                  // Pentru cuadrantele existente, calculează etapa de continuare
                  const ultimulCuadrant = cuadranteAngajat[cuadranteAngajat.length - 1];
                  const zile = ultimulCuadrant.zile || [];
                  const ultimaZi = zile[zile.length - 1];
                  
                  // Calculează etapa și mod bazat pe ultima zi
                  let etapa = 1;
                  let mod = 'work';
                  
                  if (ultimaZi === 'LIBRE') {
                    mod = 'free';
                    // Numără zilele libere consecutive de la sfârșitul lunii
                    let zileLibere = 0;
                    for (let i = zile.length - 1; i >= 0 && zile[i] === 'LIBRE'; i--) {
                      zileLibere++;
                    }
                    etapa = zileLibere;
                  } else {
                    mod = 'work';
                    // Numără zilele de lucru consecutive de la sfârșitul lunii
                    let zileLucru = 0;
                    for (let i = zile.length - 1; i >= 0 && zile[i] !== 'LIBRE'; i--) {
                      zileLucru++;
                    }
                    etapa = zileLucru;
                  }
                  
                  // Corectează etapa pentru a respecta pattern-ul 5cu2
                  const employeeSettings = settings[id] || { tipRotatie: '3cu2' };
                  const rot = ROTATIONS.find(r => r.label === employeeSettings.tipRotatie) || ROTATIONS[0];
                  
                  if (mod === 'work' && etapa >= rot.work) {
                    // Dacă s-a terminat cu 5 zile de muncă, următoarea etapă trebuie să fie 'free'
                    etapa = 1;
                    mod = 'free';
                  } else if (mod === 'free' && etapa >= rot.free) {
                    // Dacă s-a terminat cu 2 zile libere, următoarea etapă trebuie să fie 'work'
                    etapa = 1;
                    mod = 'work';
                  }
                  
                  stareStart[id] = { etapa, mod };
                  console.log(`🔍 Employee ${id} - Calculat stareStart din cuadrante existente: etapa=${etapa}, mod=${mod}`);
                }
              }
            });
          }
        }
      // eslint-disable-next-line no-unused-vars
      } catch (_e) {
        cuadranteExistente = [];
      }

      // Construiește un map pentru cuadrantele existente
      const cuadrantMap = {};
      cuadranteExistente.forEach(c => {
        const email = (c.EMAIL || c.email || '').trim().toLowerCase();
        const luna = (c.LUNA || c.luna || '').toString();
        cuadrantMap[`${email}_${luna}`] = c;
      });

      // Generează doar lunile viitoare (de la luna curentă înainte)
      let cuadranteAnNou = {};
      console.log('🔍 DEBUG - stareStart initial:', stareStart);
      
      // Determină luna de start: ia în considerare anul selectat
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      let startMonth = 0; // Implicit, începe cu ianuarie
      let endMonth = 11; // Până la decembrie
      
      if (selectedYear > currentYear) {
        // Dacă anul selectat este în viitor, generează toate cele 12 luni ale anului selectat
        startMonth = 0;
        endMonth = 11;
        console.log(`🔍 DEBUG - Anul selectat (${selectedYear}) este în viitor. Generează toate cele 12 luni.`);
      } else if (selectedYear === currentYear) {
        // Dacă este același an, generează de la luna curentă sau luna selectată (care este mai mare)
        startMonth = selectedMonth >= currentMonth ? selectedMonth : currentMonth;
        endMonth = 11;
        console.log(`🔍 DEBUG - Același an (${selectedYear}). Generează de la luna ${MONTHS[startMonth]} (${startMonth}) până la Decembrie.`);
      } else {
        // Anul selectat este în trecut - ar trebui să fie deja gestionat, dar pentru siguranță
        startMonth = 0;
        endMonth = 11;
        console.log(`🔍 DEBUG - Anul selectat (${selectedYear}) este în trecut. Generează toate cele 12 luni.`);
      }
      
      for (let luna = startMonth; luna <= endMonth; luna++) {
        const daysInMonth = getDaysInMonth(luna, selectedYear);
        const result = [];
        
        angajatiFiltrati.forEach(a => {
          const id = a['CODIGO'] || a.id;
          const email = (a['CORREO ELECTRONICO'] || a.id || '').trim().toLowerCase();
          const lunaKey = `${selectedYear}-${String(luna + 1).padStart(2, '0')}`;
          const mapKey = `${email}_${lunaKey}`;
          
          // Pentru luna curentă, dacă se alege rescrierea, folosește cuadrantele generate
          if (luna === selectedMonth && localUserChoice === true) {
            const cuadrantGenerat = cuadrantePreview.find(c => (c.EMAIL || '').trim().toLowerCase() === email);
            if (cuadrantGenerat) {
              result.push({ ...cuadrantGenerat });
              return;
            }
          }
          
          if (cuadrantMap[mapKey]) {
            // Folosește cuadrantul din backend
            const c = cuadrantMap[mapKey];
            const zile = Array.from({ length: daysInMonth }, (_, i) => c[`ZI_${i+1}`] || '');
            console.log(`🔍 Employee ${id} - Luna ${MONTHS[luna]}: FOLOSESTE cuadrantul din backend`);
            result.push({ ...c, zile });
          } else {
            // Generează local
            console.log(`🔍 Employee ${id} - Luna ${MONTHS[luna]}: GENEREAZA local`);
            const s = settings[id] || {
              zi1: 'M',
              etapa: 1,
              total: 3,
              tipRotatie: '3cu2',
              oreTura: 8,
              oraStart: '08:00'
            };
            const rot = ROTATIONS.find(r => r.label === s.tipRotatie) || ROTATIONS[0];
            let zile = [];
            // Calculează etapa de start bazată pe cuadrantele existente
            let etapa = s.etapa;
            let mod = s.zi1 === 'M' ? 'work' : 'free';
            
            // Dacă există cuadrante salvate, calculează etapa de continuare
            if (stareStart[id]) {
              etapa = stareStart[id].etapa;
              mod = stareStart[id].mod;
              console.log(`🔍 Employee ${id} - Luna ${MONTHS[luna]}: CONTINUAND de la etapa=${etapa}, mod=${mod}`);
            } else {
              console.log(`🔍 Employee ${id} - Luna ${MONTHS[luna]}: NOU cu etapa=${etapa}, mod=${mod}`);
            }
            
            for (let zi = 1; zi <= daysInMonth; zi++) {
              // Pentru ziua 1, continuă de la luna precedentă (nu respectă configurația utilizatorului)
              if (zi === 1) {
                if (mod === 'work') {
                  // Continuă cu ziua de lucru
                  const oraStart = s.oraStart || '08:00';
                  const oreTura = s.oreTura || 8;
                  const [h, m] = oraStart.split(':').map(Number);
                  const end = new Date(2000, 0, 1, h, m + oreTura * 60);
                  const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                  
                let turnType = 'T1';
                if (oreTura === 12) {
                  turnType = h < 12 ? 'T1' : 'T2';
                } else if (oreTura === 8) {
                    if (h >= 6 && h < 14) {
                      turnType = 'T1';
                    } else if (h >= 14 && h < 22) {
                      turnType = 'T2';
                    } else {
                      turnType = 'T3';
                    }
                  }
                  
                  zile.push(`${turnType} ${oraStart}-${oraEnd}`);
                } else {
                  // Continuă cu ziua liberă
                  zile.push('LIBRE');
                }
              } else if (mod === 'work') {
                const oraStart = s.oraStart || '08:00';
                const oreTura = s.oreTura || 8;
                const [h, m] = oraStart.split(':').map(Number);
                const end = new Date(2000, 0, 1, h, m + oreTura * 60);
                const oraEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                
                let turnType = 'T1';
                if (oreTura === 12) {
                  turnType = h < 12 ? 'T1' : 'T2';
                } else if (oreTura === 8) {
                  if (h >= 6 && h < 14) {
                    turnType = 'T1';
                  } else if (h >= 14 && h < 22) {
                    turnType = 'T2';
                  } else {
                    turnType = 'T3';
                  }
                }
                
                zile.push(`${turnType} ${oraStart}-${oraEnd}`);
              } else {
                zile.push('LIBRE');
              }
              
              // Logica corectă de rotație
              if (mod === 'work' && etapa >= rot.work) { 
                etapa = 1; 
                mod = 'free'; 
                console.log(`  Day ${zi}: Switching from work to free (etapa ${etapa-1} >= ${rot.work})`);
              } else if (mod === 'free' && etapa >= rot.free) { 
                etapa = 1; 
                mod = 'work'; 
                console.log(`  Day ${zi}: Switching from free to work (etapa ${etapa-1} >= ${rot.free})`);
              } else {
                etapa++;
                console.log(`  Day ${zi}: Continuing ${mod}, etapa: ${etapa-1} -> ${etapa}`);
              }
            }
            
            const cuadranteObj = {
              CODIGO: a['CODIGO'] || '',
              EMAIL: a['CORREO ELECTRONICO'] || '',
              NOMBRE: a['NOMBRE / APELLIDOS'] || '',
              LUNA: lunaKey,
              CENTRO: selectedCentro,
            };
            
            for (let zi = 1; zi <= daysInMonth; zi++) {
              cuadranteObj[`ZI_${zi}`] = zile[zi - 1];
            }
            cuadranteObj.zile = zile;
            
            // Calculăm TotalHoras sumând orele din toate zilele
            const getHorasFromTurnoAn = (turno) => {
              if (!turno || turno === '' || turno === null || turno === 'LIBRE') {
                return 0;
              }
              if (isCuadranteMarcaMulticentro(turno)) {
                return 0;
              }
              
              // Format: "T2 19:30-07:30" sau "T1 07:00-15:00"
              const timeMatch = turno.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
              if (timeMatch) {
                const startHour = parseInt(timeMatch[1], 10);
                const startMin = parseInt(timeMatch[2], 10);
                const endHour = parseInt(timeMatch[3], 10);
                const endMin = parseInt(timeMatch[4], 10);
                
                let startMinutes = startHour * 60 + startMin;
                let endMinutes = endHour * 60 + endMin;
                
                // Pentru ture nocturne (peste miezul nopții)
                if (endMinutes < startMinutes) {
                  endMinutes += 24 * 60;
                }
                
                const diffMinutes = endMinutes - startMinutes;
                return diffMinutes / 60;
              }
              
              // T1, T2, T3 fără ore = 8 ore standard
              if (turno === 'T1' || turno === 'T2' || turno === 'T3') {
                return 8;
              }
              
              // Dacă turno conține "T1", "T2", "T3" dar fără ore
              if (turno.includes('T1') && !turno.includes(':')) return 8;
              if (turno.includes('T2') && !turno.includes(':')) return 8;
              if (turno.includes('T3') && !turno.includes(':')) return 8;
              
              // Fallback: 8 ore
              return 8;
            };

            let totalHoras = 0;
            for (let zi = 1; zi <= daysInMonth; zi++) {
              const turno = cuadranteObj[`ZI_${zi}`];
              totalHoras += getHorasFromTurnoAn(turno);
            }
            cuadranteObj.TotalHoras = totalHoras.toFixed(2);
            
            result.push(cuadranteObj);
            console.log(`🔍 Employee ${id} - Luna ${MONTHS[luna]} FINAL: etapa=${etapa}, mod=${mod}`);
            stareStart[id] = { etapa, mod };
          }
        });
        cuadranteAnNou[luna] = result;
      }
      
      setCuadranteAn(cuadranteAnNou);
      setLunaPreview(selectedMonth);
    } catch (error) {
      console.error('Eroare la generarea anului:', error);
      setNotification({
        type: 'error',
        title: '❌ Error al Generar',
        message: 'Error al generar los cuadrantes para todo el año. Por favor, intenta de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Salvează tot anul cu delay între request-uri
  const handleSalveazaAn = async () => {
    if (!cuadranteAn) return;
    
    setLoading(true);
    
    // Determină ce luni să salvezi
    let luniPentruSalvare = [];
    let luniExcluse = [];
    
    if (userChoice === true) {
      // Salvează toate lunile (rescrie) - doar dacă utilizatorul a ales explicit
      luniPentruSalvare = Object.keys(cuadranteAn).map(Number);
    } else {
      // Exclude lunile care deja există (comportament implicit)
      const toateLunile = Object.keys(cuadranteAn).map(Number);
      luniPentruSalvare = toateLunile.filter(luna => !luniExistentaAn.includes(luna));
      luniExcluse = toateLunile.filter(luna => luniExistentaAn.includes(luna));
    }
    
    // Filtrează cuadrantele pentru lunile care trebuie salvate
    const toateLiniile = luniPentruSalvare.flatMap(luna => cuadranteAn[luna] || []);
    
    if (toateLiniile.length === 0) {
      if (luniExcluse.length > 0) {
        setNotification({
          type: 'warning',
          title: '⚠️ Meses Ya Existentes',
          message: `Todos los meses generados (${luniExcluse.map(l => MONTHS[l]).join(', ')}) ya existen en el sistema!\n\nPara sobrescribir, presiona nuevamente el botón "Guardar Todo el Año".`,
        });
        } else {
        setNotification({
          type: 'warning',
          title: '⚠️ Sin Meses para Guardar',
          message: 'No hay meses para guardar. Todos los meses ya existen en el sistema.',
        });
      }
      setLoading(false);
      return;
    }
    
            setProgress({ current: 0, total: toateLiniile.length, message: 'Se están guardando los cuadrantes para todo el año...' });
    
    try {
      let successCount = 0;
      let failCount = 0;
      const totalRequests = toateLiniile.length;
      
      for (let i = 0; i < toateLiniile.length; i++) {
        const linie = toateLiniile[i];
        
        const delayTime = i > 50 ? 2500 : 1500;
        setProgress({ 
          current: i + 1, 
          total: totalRequests, 
          message: `Se está guardando el cuadrante para ${linie.NOMBRE} - ${linie.LUNA}... (delay: ${delayTime}ms)` 
        });
        
        try {
          const { ...liniePentruSalvare } = linie;
          
          // Add JWT token for authentication
          const token = localStorage.getItem('auth_token');
          const headers = {
            'Content-Type': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(routes.saveCuadrante, {
            method: 'POST',
            headers,
            body: JSON.stringify(liniePentruSalvare)
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            const errorText = await response.text();
            console.error(`Eroare la salvare anuală pentru ${linie.NOMBRE} - ${linie.LUNA}:`, response.status, errorText);
          }
          
          // Delay progresiv între request-uri pentru salvare pe tot anul (mai multe date)
          if (i < toateLiniile.length - 1) {
            const delayTime = i > 50 ? 2500 : 1500; // Delay mai mare după 50 de request-uri
            await delay(delayTime);
          }
          
        } catch (e) {
          failCount++;
          console.error(`Eroare la salvare anuală pentru ${linie.NOMBRE} - ${linie.LUNA}:`, e);
        }
      }
      
      setProgress({ current: 0, total: 0, message: '' });
      
      if (failCount === 0) {
        let title = '';
        let message = '';
        if (userChoice === true) {
          title = '✅ ¡Cuadrantes Guardados!';
          message = `Todos los cuadrantes para todo el año han sido guardados con éxito! (${successCount}/${totalRequests})`;
        } else {
          const luniSalvate = luniPentruSalvare.map(l => MONTHS[l]).join(', ');
          const luniSarite = luniExcluse.map(l => MONTHS[l]).join(', ');
          title = '✅ ¡Cuadrantes Guardados!';
          message = `Los cuadrantes para ${luniSalvate} han sido guardados con éxito! (${successCount}/${totalRequests})`;
          if (luniExcluse.length > 0) {
            message += `\n\n⏭️ Los meses ${luniSarite} han sido omitidos (ya existen en el sistema).`;
          }
        }
        setNotification({
          type: 'success',
          title: title,
          message: message,
        });
        setActiveTab('generar');
        setCuadranteAn(null);
      } else {
        setNotification({
          type: 'error',
          title: '⚠️ Error al Guardar',
          message: `${successCount} guardadas con éxito, ${failCount} fallos de ${totalRequests} total.\n\nVerifica la consola del navegador (F12) para detalles sobre errores.`,
        });
      }
          } catch (error) {
        console.error('Eroare la salvare:', error);
        setNotification({
          type: 'error',
          title: '❌ Error al Guardar',
          message: 'Ha ocurrido un error al guardar los cuadrantes. Por favor, intenta de nuevo.',
        });
        setProgress({ current: 0, total: 0, message: '' });
    } finally {
      setLoading(false);
    }
  };

  // Funcție pentru delay între request-uri
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Salvează cuadrantele cu delay între request-uri
  const handleSalveaza = async () => {
    if (!cuadrantePreview.length) return;
    
    // Verifică din nou dacă luna există înainte de salvare
    await verificaLunaExistenta();
    
    // Verifică dacă luna există deja și dacă utilizatorul vrea să rescrie
    console.log('Verificare luna existentă:', { lunaExistenta, selectedMonth, selectedYear });
    
    if (lunaExistenta) {
      const confirmRescrie = confirm(
        `El mes ${MONTHS[selectedMonth]} ${selectedYear} ya existe en el sistema.\n\n` +
        `¿Quieres sobrescribir los cuadrantes existentes?\n\n` +
        `- Pulsa "Aceptar" para sobrescribir\n` +
        `- Pulsa "Cancelar" para anular`
      );
      
      if (!confirmRescrie) {
        console.log('Salvarea a fost anulată de utilizator');
        return;
      }
      console.log('Utilizatorul a confirmat rescrierea');
    }
    
    setLoading(true);
            setProgress({ current: 0, total: cuadrantePreview.length, message: 'Se están guardando los cuadrantes...' });
    
    try {
      let successCount = 0;
      let failCount = 0;
      const totalRequests = cuadrantePreview.length;
      
      // Verifică pentru fiecare cuadrante dacă există deja
      const cuadrantesConVerificare = [];
      const mesAno = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const token = localStorage.getItem('auth_token');
      
      for (let i = 0; i < cuadrantePreview.length; i++) {
        const cuadrante = cuadrantePreview[i];
        
        // Verifică dacă există deja
        let yaExiste = false;
        let tipoExistente = [];
        
        if (cuadrante.CODIGO) {
          try {
            const checkParams = new URLSearchParams({
              codigo: cuadrante.CODIGO,
              mes: mesAno,
            });
            if (selectedCentro) {
              checkParams.append('centro', selectedCentro);
            }

            const checkResponse = await fetch(`${routes.checkExistingCuadrante}?${checkParams.toString()}`, {
              method: 'GET',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
              },
            });

            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              yaExiste = checkData.hasCuadrante || checkData.hasHorarioMulticentro;
              if (checkData.hasCuadrante) tipoExistente.push('Cuadrante');
              if (checkData.hasHorarioMulticentro) tipoExistente.push('Horario Multicentro');
            }
          } catch (err) {
            console.error(`Error verificando existencia para ${cuadrante.CODIGO}:`, err);
          }
        }
        
        cuadrantesConVerificare.push({ ...cuadrante, yaExiste, tipoExistente });
      }
      
      // Dacă există cuadrantes deja existente, întreabă utilizatorul
      const cuadrantesExistentes = cuadrantesConVerificare.filter(c => c.yaExiste);
      if (cuadrantesExistentes.length > 0) {
        const listaExistentes = cuadrantesExistentes.map(c => 
          `- ${c.NOMBRE} (${c.CODIGO}): ${c.tipoExistente.join(', ')}`
        ).join('\n');
        
        const confirmRescrie = confirm(
          `⚠️ Atención: ${cuadrantesExistentes.length} cuadrante(s) ya existe(n) en el sistema:\n\n${listaExistentes}\n\n` +
          `¿Deseas sobrescribir los cuadrantes existentes?\n\n` +
          `- Presiona "OK" para sobrescribir\n` +
          `- Presiona "Cancel" para cancelar`
        );
        
        if (!confirmRescrie) {
          console.log('Salvarea a fost anulată de utilizator - există cuadrantes duplicate');
          setLoading(false);
          setProgress(null);
          showToast('info', 'Operación cancelada - existen cuadrantes duplicados');
          return;
        }
      }
      
      for (let i = 0; i < cuadrantePreview.length; i++) {
        const cuadrante = cuadrantePreview[i];
        
        const delayTime = i > 30 ? 2000 : 1000;
        setProgress({ 
          current: i + 1, 
          total: totalRequests, 
          message: `Se está guardando el cuadrante para ${cuadrante.NOMBRE}... (delay: ${delayTime}ms)` 
        });
        
        try {
          const { ...cuadrantePentruSalvare } = cuadrante;
          
          // Add JWT token for authentication
          const token = localStorage.getItem('auth_token');
          const headers = {
            'Content-Type': 'application/json',
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(routes.saveCuadrante, {
            method: 'POST',
            headers,
            body: JSON.stringify(cuadrantePentruSalvare)
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            const errorText = await response.text();
            console.error(`Eroare la salvare pentru ${cuadrante.NOMBRE}:`, response.status, errorText);
          }
          
          // Delay progresiv între request-uri pentru a nu supraîncărca Google Sheets
          if (i < cuadrantePreview.length - 1) {
            const delayTime = i > 30 ? 2000 : 1000; // Delay mai mare după 30 de request-uri
            await delay(delayTime);
          }
          
        } catch (e) {
          failCount++;
          console.error(`Eroare la salvare pentru ${cuadrante.NOMBRE}:`, e);
        }
      }
      
      setProgress({ current: 0, total: 0, message: '' });
      
      if (failCount === 0) {
        // Log salvarea cuadrantelor
        await activityLogger.logCuadranteSaved({
          month: selectedMonth + 1,
          year: selectedYear,
          employees: successCount,
          center: selectedCentro,
          overwritten: lunaExistenta
        }, authUser);

        const title = lunaExistenta 
          ? '✅ ¡Cuadrantes Sobrescritos!'
          : '✅ ¡Cuadrantes Guardados!';
        const message = lunaExistenta
          ? `Los cuadrantes para ${MONTHS[selectedMonth]} ${selectedYear} han sido sobrescritos con éxito! (${successCount}/${totalRequests})`
          : `Los cuadrantes para ${MONTHS[selectedMonth]} ${selectedYear} han sido guardados con éxito! (${successCount}/${totalRequests})`;
        
        setNotification({
          type: 'success',
          title: title,
          message: message,
        });
        setActiveTab('generar');
        setCuadrantePreview([]);
      } else {
        setNotification({
          type: 'error',
          title: '⚠️ Error al Guardar',
          message: `${successCount} guardadas con éxito, ${failCount} fallos de ${totalRequests} total.\n\nVerifica la consola del navegador (F12) para detalles sobre errores.`,
        });
      }
          } catch (error) {
        console.error('Error saving cuadrante:', error);
        setNotification({
          type: 'error',
          title: '❌ Error al Guardar',
          message: 'Ha ocurrido un error al guardar los cuadrantes. Por favor, intenta de nuevo.',
        });
        setProgress({ current: 0, total: 0, message: '' });
    } finally {
      setLoading(false);
    }
  };

  // Încarcă datele pentru horarios când se schimbă centros și grupos
  useEffect(() => {
    if (centros.length > 0 && grupos.length > 0) {
      loadHorariosData();
    }
  }, [centros, grupos, loadHorariosData]);

  // Încarcă automat lista de horarios când se accesează tabul "Lista Horarios"
  useEffect(() => {
    if (activeTab === 'lista_horarios') {
      const fetchHorariosList = async () => {
        try {
          const res = await import('../api/schedules');
          const { listSchedules } = res;
          const r = await listSchedules(callApi);
          if (r.success) {
            setHorariosLista(Array.isArray(r.data) ? r.data : []);
          } else {
            console.warn(r.message || 'Error al listar horarios');
          }
        // eslint-disable-next-line no-unused-vars
        } catch (_e) {
          console.warn('No se pudo conectar con el servidor');
        }
      };
      fetchHorariosList();
    }
  }, [activeTab, callApi]);

  // Funcții pentru editare
  const handleCellClick = (employee, day, currentValue, tableType = 'preview') => {
    setEditingDay(null);
    setEditingSchedule(null);
    setSelectedCell({ employee, day, currentValue, tableType });
    setEditValue(currentValue);
    setEditNote('');
    setEditEmployee(employee);

    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCell) return;

    const { employee, day, tableType } = selectedCell;
    
    if (tableType === 'preview') {
      // Editează cuadrantePreview
      const updatedCuadrante = cuadrantePreview.map(c => {
        if ((c.NOMBRE || c.EMAIL) === employee) {
          const updated = { ...c };
          updated[`ZI_${day}`] = editValue;
          if (editNote) {
            updated[`NOTA_${day}`] = editNote;
          }
          return updated;
        }
        return c;
      });
      
      // Dacă s-a schimbat angajatul, mută tura la noul angajat
      if (editEmployee !== employee) {
        // Șterge tura de la vechiul angajat
        const cuadranteFaraTura = updatedCuadrante.map(c => {
          if ((c.NOMBRE || c.EMAIL) === employee) {
            const updated = { ...c };
            updated[`ZI_${day}`] = 'LIBRE'; // Șterge tura
            delete updated[`NOTA_${day}`]; // Șterge notița
            return updated;
          }
          return c;
        });
        
        // Verifică dacă noul angajat există deja în cuadrante
        const angajatExistent = cuadranteFaraTura.find(c => (c.NOMBRE || c.EMAIL) === editEmployee);
        
        if (angajatExistent) {
          // Adaugă tura la noul angajat existent
          const cuadranteFinale = cuadranteFaraTura.map(c => {
            if ((c.NOMBRE || c.EMAIL) === editEmployee) {
              const updated = { ...c };
              updated[`ZI_${day}`] = editValue;
              if (editNote) {
                updated[`NOTA_${day}`] = editNote;
              }
              return updated;
            }
            return c;
          });
          setCuadrantePreview(cuadranteFinale);
        } else {
          // Adaugă noul angajat în cuadrante
          const angajatNou = angajatiFiltrati.find(a => (a.NOMBRE || a['NOMBRE / APELLIDOS']) === editEmployee);
          if (angajatNou) {
            const cuadranteNou = {
              CODIGO: angajatNou['CODIGO'] || '',
              EMAIL: angajatNou['CORREO ELECTRONICO'] || '',
              NOMBRE: angajatNou['NOMBRE / APELLIDOS'] || '',
              LUNA: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
              CENTRO: selectedCentro,
              [`ZI_${day}`]: editValue,
              ...(editNote && { [`NOTA_${day}`]: editNote })
            };
            
            // Adaugă zilele goale pentru restul lunii
            for (let zi = 1; zi <= getDaysInMonth(selectedMonth, selectedYear); zi++) {
              if (zi !== day) {
                cuadranteNou[`ZI_${zi}`] = 'LIBRE';
              }
            }
            
            setCuadrantePreview([...cuadranteFaraTura, cuadranteNou]);
          }
        }
      } else {
        setCuadrantePreview(updatedCuadrante);
      }
    } else if (tableType === 'annual') {
      // Editează cuadranteAn
      const updatedCuadranteAn = { ...cuadranteAn };
      if (updatedCuadranteAn[lunaPreview]) {
        let cuadranteLuna = updatedCuadranteAn[lunaPreview].map(c => {
          if ((c.NOMBRE || c.EMAIL) === employee) {
            const updated = { ...c };
            updated[`ZI_${day}`] = editValue;
            if (editNote) {
              updated[`NOTA_${day}`] = editNote;
            }
            return updated;
          }
          return c;
        });
        
        // Dacă s-a schimbat angajatul, mută tura la noul angajat
        if (editEmployee !== employee) {
          // Șterge tura de la vechiul angajat
          cuadranteLuna = cuadranteLuna.map(c => {
            if ((c.NOMBRE || c.EMAIL) === employee) {
              const updated = { ...c };
              updated[`ZI_${day}`] = 'LIBRE'; // Șterge tura
              delete updated[`NOTA_${day}`]; // Șterge notița
              return updated;
            }
            return c;
          });
          
          // Verifică dacă noul angajat există deja în cuadrante
          const angajatExistent = cuadranteLuna.find(c => (c.NOMBRE || c.EMAIL) === editEmployee);
          
          if (angajatExistent) {
            // Adaugă tura la noul angajat existent
            cuadranteLuna = cuadranteLuna.map(c => {
              if ((c.NOMBRE || c.EMAIL) === editEmployee) {
                const updated = { ...c };
                updated[`ZI_${day}`] = editValue;
                if (editNote) {
                  updated[`NOTA_${day}`] = editNote;
                }
                return updated;
              }
              return c;
            });
          } else {
            // Adaugă noul angajat în cuadrante
            const angajatNou = angajatiFiltrati.find(a => (a.NOMBRE || a['NOMBRE / APELLIDOS']) === editEmployee);
            if (angajatNou) {
              const cuadranteNou = {
                CODIGO: angajatNou['CODIGO'] || '',
                EMAIL: angajatNou['CORREO ELECTRONICO'] || '',
                NOMBRE: angajatNou['NOMBRE / APELLIDOS'] || '',
                LUNA: `${selectedYear}-${String(lunaPreview + 1).padStart(2, '0')}`,
                CENTRO: selectedCentro,
                [`ZI_${day}`]: editValue,
                ...(editNote && { [`NOTA_${day}`]: editNote })
              };
              
              // Adaugă zilele goale pentru restul lunii
              for (let zi = 1; zi <= getDaysInMonth(lunaPreview, selectedYear); zi++) {
                if (zi !== day) {
                  cuadranteNou[`ZI_${zi}`] = 'LIBRE';
                }
              }
              
              cuadranteLuna.push(cuadranteNou);
            }
          }
        }
        
        updatedCuadranteAn[lunaPreview] = cuadranteLuna;
        setCuadranteAn(updatedCuadranteAn);
      }
    }

    setShowEditModal(false);
    setSelectedCell(null);
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setSelectedCell(null);
    setEditValue('');
    setEditNote('');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={
            `flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors ${
              toast.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : toast.type === 'warning'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`
          }
          role="status"
          aria-live="polite"
        >
          <span className="text-lg">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <div>
            <p className="font-medium leading-snug">{toast.message}</p>
          </div>
        </div>
      )}
      {/* Header cu buton regresar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton 
            to="/inicio"
            title="Regresar a Inicio"
          />
        <div>
          <h1 className="text-2xl font-bold text-red-600">
            Cuadrantes
          </h1>
          <p className="text-gray-600">
            Gestiona los horarios de trabajo para empleados
          </p>
        </div>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('generar')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'generar'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Generar Cuadrante
          </button>
          <button
            onClick={() => setActiveTab('lista_cuadrantes')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'lista_cuadrantes'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Lista Cuadrantes
          </button>
          <button
            onClick={() => setActiveTab('lista_horarios')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'lista_horarios'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Lista Horarios
          </button>
          <button
            onClick={() => setActiveTab('horarios')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'horarios'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Crear Horario
          </button>
          <button
            onClick={() => setActiveTab('festivos')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'festivos'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Festivos
          </button>
          <button
            onClick={() => setActiveTab('horario_multicentro')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'horario_multicentro'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            Horario Multicentro
          </button>
        </div>

        {activeTab === 'generar' && (
          <div className="space-y-6">
            {/* Configurare lună și centru */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label
                  htmlFor="generar-mes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Mes
                </label>
                <select
                  id="generar-mes"
                  name="mes"
                  value={selectedMonth}
                  onChange={(e) => {
                    const monthValue = Number(e.target.value);
                    if (!isNaN(monthValue) && monthValue >= 0 && monthValue <= 11) {
                      setSelectedMonth(monthValue);
                    } else {
                      console.error('Invalid month value:', e.target.value);
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <label
                  htmlFor="generar-centro"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Centro
                </label>
                <div className="relative">
                  <input
                    id="generar-centro"
                    name="centro"
                    type="text"
                    value={centroSearchTerm}
                    readOnly={false}
                    disabled={false}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCentroSearchTerm(newValue);
                      setCentroDropdownOpen(true);
                      if (!newValue.trim()) {
                        setSelectedCentro('');
                      }
                    }}
                    onFocus={() => setCentroDropdownOpen(true)}
                    onBlur={() => {
                      // Delay pentru a permite click pe opțiune
                      setTimeout(() => setCentroDropdownOpen(false), 200);
                    }}
                    placeholder="Buscar o escribir centro..."
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  {centroDropdownOpen && filteredCentros.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCentros.map(centro => (
                        <div
                          key={centro}
                          onClick={() => {
                            setSelectedCentro(centro);
                            setCentroSearchTerm(centro);
                            setCentroDropdownOpen(false);
                          }}
                          className="p-2 hover:bg-red-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                      {centro}
                        </div>
                  ))}
                    </div>
                  )}
                  {centroDropdownOpen && filteredCentros.length === 0 && centroSearchTerm && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 text-gray-500">
                      No se encontraron centros
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label
                  htmlFor="generar-grupo"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  👥 Grupo
                </label>
                <select
                  id="generar-grupo"
                  name="grupo"
                  value={selectedGrupo}
                  onChange={(e) => setSelectedGrupo(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Todos los grupos</option>
                  {grupos.map(grupo => (
                    <option key={grupo} value={grupo}>
                      {grupo}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label
                  htmlFor="generar-year"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Año
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                    onClick={() => setSelectedMonth(m => (m === 0 ? 11 : m - 1)) || setSelectedYear(y => (selectedMonth === 0 ? y - 1 : y))}
                    title="Mes anterior"
                  >
                    ←
                  </button>
                  <select
                    id="generar-year"
                    name="year"
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>{year}</option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                    onClick={() => setSelectedMonth(m => (m === 11 ? 0 : m + 1)) || setSelectedYear(y => (selectedMonth === 11 ? y + 1 : y))}
                    title="Mes siguiente"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>


            {/* Selector de EMPLEADO - NUEVO */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label
                htmlFor="generar-empleado"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                👤 Empleado
              </label>
              <select
                id="generar-empleado"
                name="empleado"
                value={selectedEmpleado}
                onChange={(e) => setSelectedEmpleado(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium"
              >
                <option value="">Todos los empleados ({angajatiFiltrati.length})</option>
                {angajatiFiltrati.map(emp => (
                  <option key={emp.CODIGO} value={emp.CODIGO}>
                    {emp['NOMBRE / APELLIDOS']} - {emp.CODIGO}
                  </option>
                ))}
              </select>
              
              {angajatiFiltrati.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  ℹ️ Selecciona un Centro para ver los empleados disponibles
                </p>
              )}
            </div>

            {/* DEBUG: Mostrar información de filtrado */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-bold text-blue-900 mb-2">📊 Debug Información:</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Total empleados cargados:</strong> {angajati.length}</p>
                <p><strong>Centro seleccionado:</strong> {selectedCentro || 'Ninguno'}</p>
                <p><strong>Grupo seleccionado:</strong> {selectedGrupo || 'Ninguno'} {selectedGrupo === '' ? '(Todos los grupos)' : ''}</p>
                <p><strong>Empleados filtrados:</strong> {angajatiFiltrati.length}</p>
                {angajatiFiltrati.length === 0 && selectedCentro && (
                  <p className="text-red-600 font-bold mt-2">
                    ⚠️ No hay empleados con CENTRO TRABAJO = &quot;{selectedCentro}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Herramientas de generación avanzada */}
            <Card className="border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">⚙️ Generador avanzado</h3>
                  <p className="text-sm text-gray-500">
                    Personaliza la secuencia de turnos y los horarios base. Usa formato <span className="font-mono">&quot;2xT1,2xT2,2xLIBRE&quot;</span> para las secuencias o define un patrón semanal rápido.
                  </p>
                </div>
                {(hasCustomSeq || hasWeeklyPattern) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSeqText('');
                      setWeeklyPattern({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' });
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Reiniciar ajustes
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="generar-secuencia-personalizada"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Secuencia personalizada
                  </label>
                  <Input
                    id="generar-secuencia-personalizada"
                    name="secuenciaPersonalizada"
                    value={seqText}
                    onChange={(e) => setSeqText(e.target.value)}
                    placeholder="Ej: 3xT1,2xT2,1xLIBRE"
                  />
                  <p className="text-xs text-gray-500">
                    Si la secuencia está presente se usará antes que la rotación clásica. T1, T2, T3 y LIBRE son válidos.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="generar-horas-turno"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Horas por turno
                    </label>
                    <Input
                      id="generar-horas-turno"
                      name="horasTurno"
                      type="number"
                      min={1}
                      max={24}
                      value={turnoHours}
                      onChange={(e) => setTurnoHours(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="generar-inicio-t1"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Inicio turno T1
                    </label>
                    <Input
                      id="generar-inicio-t1"
                      name="inicioTurnoT1"
                      type="time"
                      value={t1Start}
                      onChange={(e) => setT1Start(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="generar-inicio-t2"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Inicio turno T2
                    </label>
                    <Input
                      id="generar-inicio-t2"
                      name="inicioTurnoT2"
                      type="time"
                      value={t2Start}
                      onChange={(e) => setT2Start(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="generar-inicio-t3"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Inicio turno T3
                    </label>
                    <Input
                      id="generar-inicio-t3"
                      name="inicioTurnoT3"
                      type="time"
                      value={t3Start}
                      onChange={(e) => setT3Start(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="block text-sm font-medium text-gray-700 mb-2">
                  Patrón semanal (opcional)
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
                  {WEEKDAY_LABELS.map((day) => {
                    const daySelectId = `weekly-pattern-${day.key}`;
                    return (
                    <div key={day.key} className="space-y-1">
                      <label
                        htmlFor={daySelectId}
                        className="block text-xs font-medium text-gray-500 text-center"
                      >
                        {day.label}
                      </label>
                      <select
                        id={daySelectId}
                        name={daySelectId}
                        value={weeklyPattern[day.key] || ''}
                        onChange={(e) =>
                          setWeeklyPattern((prev) => ({
                            ...prev,
                            [day.key]: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="">—</option>
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                        <option value="LIBRE">LIBRE</option>
                      </select>
                    </div>
                  )})}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Completar celdas aplicará el patrón semanal. Si se deja vacío se seguirá usando la rotación o la secuencia personalizada.
                </p>
              </div>
            </Card>

            {/* Buton Import Excel - vizibil oricând */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end gap-3 mb-6">
              <div className="flex flex-col gap-1 sm:mr-auto">
                <label htmlFor="excel-format-cuadrantes" className="text-sm font-medium text-gray-700">
                  Formato Excel
                </label>
                <select
                  id="excel-format-cuadrantes"
                  value={excelCuadrantesFormat}
                  onChange={(e) => setExcelCuadrantesFormat(e.target.value)}
                  disabled={uploadingExcel || !selectedCentro}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-md"
                >
                  <option value="auto">Detectar automáticamente (recomendado)</option>
                  <option value="he_hs">Estándar (M/T + HE/HS)</option>
                  <option value="turno_horas_tabla">Tabla Nombre/Código + Turno y Horas por día</option>
                  <option value="celdas_multilinea">Celdas con varias horas (p. ej. 4 líneas → dos tramos)</option>
                </select>
                <p className="text-xs text-gray-500 max-w-md">
                  Con <strong>Detectar automáticamente</strong> el servidor elige entre tabla ancha (Turno/Horas o HE/HS por día), plantilla M/T+HE/HS o celdas multilínea según las cabeceras y las filas.
                  <br />
                  <strong>Tabla Turno/Horas:</strong> cabecera con pares Turno | Horas por cada día; columnas Nombre, Código, Email, Centro. Si el código está solo en &quot;Nombre&quot; (número), también se busca por CODIGO.
                  <br />
                  <strong>Celdas multilínea:</strong> guarda <code className="bg-gray-100 px-1 rounded">19:00-22:00 / 23:00-06:00</code> cuando la celda tiene cuatro horarios.
                </p>
              </div>
              <input
                id="excel-upload-cuadrantes"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingExcel || !selectedCentro}
              />
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={uploadingExcel || !selectedCentro}
                loading={uploadingExcel}
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                onClick={() => {
                  const fileInput = document.getElementById('excel-upload-cuadrantes');
                  if (fileInput && !uploadingExcel && selectedCentro) {
                    fileInput.click();
                  }
                }}
              >
                {uploadingExcel ? 'Cargando...' : '📥 Importar desde Excel'}
              </Button>
            </div>

            {/* Setări pentru angajați */}
            {angajatiFiltrati.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {isManager ? `Configuración para empleados (${angajatiFiltrati.length})` : `Tus compañeros de ${selectedCentro} (${angajatiFiltrati.length})`}
                </h3>
                
                {angajatiFiltrati.map(a => {
                  const id = a['CODIGO'] || a.id;
                  const s = settings[id] || {
                    zi1: 'M',
                    etapa: 1,
                    total: 3,
                    tipRotatie: '3cu2',
                    oreTura: 8,
                    oraStart: '08:00',
                    seqOffset: 0
                  };
                  
                  return (
                    <Card key={id} className="p-4">
                      <div className={`${isManager ? 'flex items-center gap-4 mb-4' : 'flex items-center justify-between'}`}>
                        <h4 className="font-bold text-gray-800 min-w-[120px]">
                          {(() => {
                            const nombre = a.NOMBRE && a.APELLIDO1 
                              ? [a.NOMBRE, a.APELLIDO1, a.APELLIDO2].filter(p => p).join(' ')
                              : a['NOMBRE / APELLIDOS'] || a.NOMBRE || a.EMAIL;
                            return nombre;
                          })()}
                        </h4>
                        
                        {isManager && (
                          <div className="flex-1">
                            {/* Modul clasic (fallback) - afișat doar când NU există secvență și NU există pattern săptămânal */}
                            {!hasCustomSeq && !hasWeeklyPattern && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Primera fila - Día 1 y Rotación */}
                              <div className="space-y-2">
                                <label
                                  htmlFor={`empleado-${id}-dia1`}
                                  className="block text-sm font-semibold text-gray-700"
                                >
                                  📅 Día 1
                                </label>
                              <select
                                id={`empleado-${id}-dia1`}
                                name={`empleado-${id}-dia1`}
                                value={s.zi1}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].zi1 = e.target.value;
                                  setSettings(newSettings);
                                }}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              >
                                  <option value="M">🟢 Trabajo</option>
                                  <option value="L">🔴 Libre</option>
                              </select>
                              </div>

                              <div className="space-y-2">
                                <label
                                  htmlFor={`empleado-${id}-rotacion`}
                                  className="block text-sm font-semibold text-gray-700"
                                >
                                  🔄 Tipo de Rotación
                                </label>
                                <select
                                  id={`empleado-${id}-rotacion`}
                                  name={`empleado-${id}-rotacion`}
                                  value={s.tipRotatie}
                                  onChange={(e) => {
                                    const newSettings = { ...settings };
                                    if (!newSettings[id]) newSettings[id] = {};
                                    newSettings[id].tipRotatie = e.target.value;
                                    setSettings(newSettings);
                                  }}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                >
                                  {ROTATIONS.map(rot => (
                                    <option key={rot.label} value={rot.label}>
                                      {rot.label} ({rot.work} días trabajo, {rot.free} días libre)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Segunda fila - Etapa rotación */}
                              <div className="space-y-2">
                                <label
                                  htmlFor={`empleado-${id}-etapa`}
                                  className="block text-sm font-semibold text-gray-700"
                                >
                                  🎯 Etapa de Rotación Actual
                                </label>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`empleado-${id}-etapa`}
                                      className="block text-xs text-gray-500 mb-1"
                                    >
                                      Etapa actual:
                                    </label>
                              <Input
                                id={`empleado-${id}-etapa`}
                                name={`empleado-${id}-etapa`}
                                type="number"
                                min={1}
                                max={s.zi1 === 'M' ? s.total || 3 : s.total || 2}
                                value={s.etapa}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].etapa = Number(e.target.value);
                                  setSettings(newSettings);
                                }}
                                      className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              />
                                  </div>
                                  <div className="text-gray-400 text-lg font-bold">/</div>
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`empleado-${id}-total-etapas`}
                                      className="block text-xs text-gray-500 mb-1"
                                    >
                                      Total etapas:
                                    </label>
                              <Input
                                id={`empleado-${id}-total-etapas`}
                                name={`empleado-${id}-total-etapas`}
                                type="number"
                                min={1}
                                max={10}
                                value={s.total}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].total = Number(e.target.value);
                                  setSettings(newSettings);
                                }}
                                      className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Tercera fila - Horas y Hora inicio */}
                              <div className="space-y-2">
                                <label
                                  htmlFor={`empleado-${id}-horario-horas`}
                                  className="block text-sm font-semibold text-gray-700"
                                >
                                  ⏰ Configuración de Horario
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label
                                      htmlFor={`empleado-${id}-horas-turno-config`}
                                      className="block text-xs text-gray-500 mb-1"
                                    >
                                      Horas por turno:
                                    </label>
                              <Input
                                id={`empleado-${id}-horas-turno-config`}
                                name={`empleado-${id}-horas-turno-config`}
                                type="number"
                                min={1}
                                max={24}
                                value={s.oreTura}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].oreTura = Number(e.target.value);
                                  setSettings(newSettings);
                                }}
                                      className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                      placeholder="8"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor={`empleado-${id}-hora-inicio-config`}
                                      className="block text-xs text-gray-500 mb-1"
                                    >
                                      Hora de inicio:
                                    </label>
                              <Input
                                id={`empleado-${id}-hora-inicio-config`}
                                name={`empleado-${id}-hora-inicio-config`}
                                type="time"
                                value={s.oraStart}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].oraStart = e.target.value;
                                  setSettings(newSettings);
                                }}
                                      className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              />
                                  </div>
                                </div>
                              </div>
                            </div>) }

                            {/* Offset în secvență pentru prima zi (custom sequence) */}
                            {(hasCustomSeq || hasWeeklyPattern) && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Offset inicio (día 1):</span>
                              <Input
                                type="number"
                                min={0}
                                max={31}
                                value={s.seqOffset || 0}
                                onChange={(e) => {
                                  const newSettings = { ...settings };
                                  if (!newSettings[id]) newSettings[id] = {};
                                  newSettings[id].seqOffset = Number(e.target.value) || 0;
                                  setSettings(newSettings);
                                }}
                                className="w-16 text-sm"
                                placeholder="0"
                              />
                            </div>) }
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
                
                <div className="flex justify-end gap-3">
                  <Button
                    onClick={handleGenerar}
                    variant="primary"
                    size="lg"
                    disabled={loading || !selectedCentro}
                    loading={loading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {loading ? 'Se está generando...' : (isManager ? 'Generar Cuadrante' : 'Ver Programa')}
                  </Button>
                  {/* Debug info */}
                  <div className="text-xs text-gray-500 mt-2">
                    Debug: loading={loading.toString()}, selectedCentro={selectedCentro || 'none'}, 
                    angajatiFiltrati={angajatiFiltrati.length}, centros={centros.length}, 
                    isManager={isManager.toString()}, authUser={authUser ? 'logged' : 'not logged'}
                    <br/>
                    Buton disabled: {loading || !selectedCentro ? 'DA' : 'NU'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'lista_horarios' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Horarios creados</h3>
              <button
                onClick={async () => {
                  try {
                    const res = await import('../api/schedules');
                    const { listSchedules } = res;
                    const r = await listSchedules(callApi);
                    if (r.success) {
                      setHorariosLista(Array.isArray(r.data) ? r.data : []);
                      // opțional: feedback discret prin schimbarea butonului
                    } else {
                      console.warn(r.message || 'Error al listar horarios');
                    }
                  // eslint-disable-next-line no-unused-vars
                  } catch (_e) {
                    console.warn('No se pudo conectar con el servidor');
                  }
                }}
                className="group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-blue-500/50 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                  boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
                title="Actualizar lista"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {/* Icon con animație de rotire */}
                <div className="relative flex items-center justify-center h-full">
                  <span className="text-2xl transform group-hover:rotate-180 transition-transform duration-500">🔄</span>
                </div>
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Nombre</th>
                    <th className="text-left p-3">Centro</th>
                    <th className="text-left p-3">Grupo</th>
                    <th className="text-left p-3">Vigencia</th>
                    <th className="text-right p-3">Horas Diarias</th>
                    <th className="text-right p-3">Horas Semanales</th>
                    <th className="text-right p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(horariosLista || []).map((h, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3 font-medium text-gray-800">{h.nombre || '-'}</td>
                      <td className="p-3">{h.centroNombre || '-'}</td>
                      <td className="p-3">{h.grupoNombre || '-'}</td>
                      <td className="p-3">{(h.vigenteDesde || '-') + ' → ' + (h.vigenteHasta || '-')}</td>
                      <td className="p-3 text-right">
                        {(() => {
                          // IMPORTANT: Afișează numărul de ture și orele per turn
                          if (!h.days || typeof h.totalWeekHours !== 'number') {
                            return '-';
                          }

                          // Calculează orele pe o zi luată ca exemplu (Lunes)
                          const lunes = h.days.L;
                          let totalDailyHours = 0;
                          let shiftCount = 0;
                          const shiftsInfo = [];
                          
                          if (lunes && Array.isArray(lunes.intervals)) {
                            // Folosește structura nouă cu intervals
                            lunes.intervals.forEach((interval) => {
                              if (interval.in && interval.out) {
                                const inMinutes = toMinutes(interval.in);
                                const outMinutes = toMinutes(interval.out);
                                
                                if (inMinutes !== null && outMinutes !== null) {
                                  let duration = outMinutes - inMinutes;
                                  // Pentru ture nocturne (peste miezul nopții)
                                  if (duration < 0) {
                                    duration = (24 * 60) + outMinutes - inMinutes;
                                  }
                                  const hoursPerShift = duration / 60;
                                  totalDailyHours += hoursPerShift;
                                  shiftCount++;
                                  shiftsInfo.push(hoursPerShift);
                                }
                              }
                            });
                          } else if (lunes) {
                            // Compatibilitate cu structura veche (in1, out1, in2, out2, in3, out3)
                            const calculateInterval = (inTime, outTime) => {
                              if (!inTime || !outTime) return 0;
                              const inMin = toMinutes(inTime);
                              const outMin = toMinutes(outTime);
                              if (inMin === null || outMin === null) return 0;
                              
                              let duration = outMin - inMin;
                              if (duration < 0) {
                                duration = (24 * 60) + outMin - inMin; // Tura nocturnă
                              }
                              return duration / 60;
                            };
                            
                            const shift1 = calculateInterval(lunes.in1, lunes.out1);
                            const shift2 = calculateInterval(lunes.in2, lunes.out2);
                            const shift3 = calculateInterval(lunes.in3, lunes.out3);
                            
                            if (shift1 > 0) { totalDailyHours += shift1; shiftCount++; shiftsInfo.push(shift1); }
                            if (shift2 > 0) { totalDailyHours += shift2; shiftCount++; shiftsInfo.push(shift2); }
                            if (shift3 > 0) { totalDailyHours += shift3; shiftCount++; shiftsInfo.push(shift3); }
                          }
                          
                          // Dacă nu am putut calcula orele zilnice, folosește medie
                          if (totalDailyHours === 0) {
                            let workingDays = 0;
                            const dayKeys = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                            dayKeys.forEach(key => {
                              const day = h.days[key];
                              if (day && (day.in1 || day.in2)) {
                                workingDays++;
                              }
                            });
                            const daysToUse = workingDays || 5;
                            totalDailyHours = h.totalWeekHours / daysToUse;
                            shiftCount = 1; // Asumăm 1 tură pentru retrocompatibilitate
                          }
                          
                          // Afișează format diferit pentru mai multe ture
                          if (shiftCount > 1) {
                            // Calculează dacă toate turele au aceeași durată
                            const firstShiftHours = shiftsInfo[0];
                            const allSameHours = shiftsInfo.every(h => Math.abs(h - firstShiftHours) < 0.01);
                            
                            if (allSameHours) {
                              // Ex: "24h (3×8h)" pentru 3 ture identice de 8 ore
                              return `${totalDailyHours.toFixed(0)}h (${shiftCount}×${firstShiftHours.toFixed(0)}h)`;
                            } else {
                              // Ex: "20h (8h+4h+8h)" pentru ture cu ore diferite
                              const shiftsText = shiftsInfo.map(h => `${h.toFixed(0)}h`).join('+');
                              return `${totalDailyHours.toFixed(0)}h (${shiftsText})`;
                            }
                          } else {
                            // O singură tură: afișează doar orele
                            return `${totalDailyHours.toFixed(2)}h`;
                          }
                        })()}
                      </td>
                      <td className="p-3 text-right">{typeof h.totalWeekHours === 'number' ? `${h.totalWeekHours.toFixed(2)}h` : '-'}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            // Pre-populează formularul cu datele existente
                            const convertDaysToIntervals = (days) => {
                              const result = {};
                              const dayKeys = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                              
                              dayKeys.forEach((dayKey) => {
                                const dayData = days[dayKey] || {};
                                
                                const intervals = [];
                                for (let i = 1; i <= 3; i++) {
                                  const inTime = dayData[`in${i}`];
                                  const outTime = dayData[`out${i}`];
                                  if (inTime && outTime) {
                                    intervals.push({ in: inTime, out: outTime });
                                  } else {
                                    intervals.push({});
                                  }
                                }
                                
                                result[dayKey] = { intervals };
                              });
                              
                              return result;
                            };

                            // Helper pentru a normaliza datele ISO la format YYYY-MM-DD pentru input-uri de tip date
                            const normalizeDateForInput = (date) => {
                              if (!date) return null;
                              // Dacă e deja în format YYYY-MM-DD, returnează-l direct
                              if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
                              // Dacă e în format ISO (2025-12-18T00:00:00.000Z), extrage doar partea de dată
                              if (date.includes('T')) {
                                return date.split('T')[0];
                              }
                              return date;
                            };

                            const scheduleData = {
                              id: h.id || h._id || h.nombre, // Adaugă ID-ul pentru update
                              nombre: h.nombre || '',
                              centroId: horariosCentros.find(c => c.nombre === h.centroNombre)?.id || null,
                              grupoId: horariosGrupos.find(g => g.nombre === h.grupoNombre)?.id || null,
                              vigenteDesde: normalizeDateForInput(h.vigenteDesde),
                              vigenteHasta: normalizeDateForInput(h.vigenteHasta),
                              weeklyBreakMinutes: h.weeklyBreakMinutes || 0,
                              entryMarginMinutes: h.entryMarginMinutes || 0,
                              exitMarginMinutes: h.exitMarginMinutes || 0,
                              days: h.days ? convertDaysToIntervals(h.days) : {
                                L: { intervals: [{}, {}, {}] },
                                M: { intervals: [{}, {}, {}] },
                                X: { intervals: [{}, {}, {}] },
                                J: { intervals: [{}, {}, {}] },
                                V: { intervals: [{}, {}, {}] },
                                S: { intervals: [{}, {}, {}] },
                                D: { intervals: [{}, {}, {}] }
                              }
                            };
                            setEditingSchedule(scheduleData);
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1 rounded-lg text-blue-700 border border-blue-200 hover:bg-blue-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('¿Eliminar este horario?')) return;
                            try {
                              const res = await import('../api/schedules');
                              const { deleteSchedule } = res;
                              const resp = await deleteSchedule(callApi, h.id || h._id || h.nombre, h.centroNombre || '');
                              if (resp.success) {
                                // feedback discret în consolă
                                console.log(resp.message || 'Horario eliminado');
                                setHorariosLista((prev) => prev.filter((x) => x !== h));
                              } else {
                                console.warn(resp.message || 'No se pudo eliminar');
                              }
                            // eslint-disable-next-line no-unused-vars
                            } catch (_e) {
                              console.warn('No se pudo conectar con el servidor');
                            }
                          }}
                          className="px-3 py-1 rounded-lg text-red-700 border border-red-200 hover:bg-red-50"
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!horariosLista || horariosLista.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-500">No hay horarios todavía</td>
                    </tr>
                  )}
                </tbody>
              </table>
                </div>
            </div>
        )}

        {activeTab === 'festivos' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor="festivos-year"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Año
                </label>
                <select
                  id="festivos-year"
                  name="festivosYear"
                  value={festivosYear}
                  onChange={(e) => setFestivosYear(Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {festivosYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="festivos-month"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Mes
                </label>
                <select
                  id="festivos-month"
                  name="festivosMonth"
                  value={festivosMonthFilter}
                  onChange={(e) => setFestivosMonthFilter(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">Todos los meses</option>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={String(index)}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="text-sm text-gray-500">
                  Consulta los festivos nacionales y autonómicos planificados
                  para organizar cuadrantes especiales.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => loadFestivos(festivosYear, { force: true })}
                    disabled={festivosLoading}
                    className="p-2 rounded-full"
                    aria-label="Actualizar festivos"
                  >
                    {festivosLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                    ) : (
                      <RotateCcw className="h-5 w-5 text-red-600" />
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => openFestivoModal(null, 'create')}
                    className="p-2 rounded-full"
                    aria-label="Añadir festivo"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

          {festivosError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              {festivosError}
            </div>
          )}

          <Card>
            {festivosLoading ? (
              <div className="py-12 text-center text-gray-600">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-red-600"></div>
                Cargando calendario festivo...
              </div>
            ) : festivosToDisplay.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                No se han encontrado festivos para el año seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Día
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Festividad
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Ámbito / Comunidad
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Observaciones
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {festivosToDisplay.map((festivo) => {
                      const dateObj = new Date(festivo.date);
                      const formattedDate = Number.isNaN(dateObj.getTime())
                        ? festivo.date
                        : dateObj.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                      const formattedWeekday = Number.isNaN(dateObj.getTime())
                        ? '-'
                        : dateObj.toLocaleDateString('es-ES', {
                            weekday: 'long',
                          });

                      return (
                        <tr
                          key={festivo.id}
                          className={festivo.active === 0 ? 'opacity-60' : ''}
                        >
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {formattedDate}
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-600">
                            {formattedWeekday}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {festivo.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getScopeBadgeClasses(
                                  festivo.scope,
                                )}`}
                              >
                                {getScopeLabel(festivo.scope)}
                              </span>
                              {festivo.ccaa && (
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                  {CCAA_NAMES[festivo.ccaa] || festivo.ccaa}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {festivo.observedDate && (
                              <div className="text-xs text-gray-500">
                                Observado el{' '}
                                {new Date(festivo.observedDate).toLocaleDateString(
                                  'es-ES',
                                  {
                                    day: '2-digit',
                                    month: 'long',
                                  },
                                )}
                              </div>
                            )}
                            {festivo.notes ? festivo.notes : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                aria-label="Crear para el año siguiente"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-green-50 hover:text-green-600"
                                onClick={() => handleCreateFestivoNextYear(festivo)}
                                title="Crear este festivo para el año siguiente"
                              >
                                <Copy className="h-4 w-4" />
                                <span className="sr-only">Crear para el año siguiente</span>
                              </button>
                              <button
                                type="button"
                                aria-label="Editar festivo"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                                onClick={() => openFestivoModal(festivo)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Editar festivo</span>
                              </button>
                              <Button
                                variant="outlineDanger"
                                className="h-9 w-9 rounded-full p-0"
                                onClick={() => handleFestivoDelete(festivo)}
                                aria-label="Eliminar festivo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {festivoModalOpen && festivoForm && (
            <Modal
              isOpen={festivoModalOpen}
              onClose={closeFestivoModal}
              title={festivoModalMode === 'create' ? 'Crear festivo' : 'Editar festivo'}
              size="lg"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="ID interno"
                    value={festivoForm.id || ''}
                    onChange={(e) => handleFestivoFormChange('id', e.target.value)}
                    placeholder="Opcional: dejar en blanco para autogenerar"
                  />
                  <Input
                    label="Fecha"
                    type="date"
                    value={festivoForm.date || ''}
                    onChange={(e) => handleFestivoFormChange('date', e.target.value)}
                  />
                  <Input
                    label="Nombre"
                    value={festivoForm.name || ''}
                    onChange={(e) => handleFestivoFormChange('name', e.target.value)}
                  />
                  <Select
                    label="Ámbito / Tipo"
                    value={festivoForm.scope || ''}
                    onChange={(e) => handleFestivoFormChange('scope', e.target.value)}
                    options={FESTIVO_SCOPE_OPTIONS}
                  />
                  <Select
                    label="Comunidad Autónoma"
                    value={festivoForm.ccaa || ''}
                    onChange={(e) => handleFestivoFormChange('ccaa', e.target.value)}
                    options={festivoCcaaOptions}
                  />
                  <Input
                    label="Fecha observada"
                    type="date"
                    value={festivoForm.observedDate || ''}
                    onChange={(e) =>
                      handleFestivoFormChange('observedDate', e.target.value)
                    }
                  />
                  <Select
                    label="Estado"
                    value={festivoForm.active ?? '1'}
                    onChange={(e) => handleFestivoFormChange('active', e.target.value)}
                    options={FESTIVO_ACTIVE_OPTIONS}
                  />
                </div>
                <Input
                  label="Notas"
                  multiline
                  rows={4}
                  value={festivoForm.notes || ''}
                  onChange={(e) => handleFestivoFormChange('notes', e.target.value)}
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>ID interno: {festivoForm.id}</span>
                  <span>
                    Ámbito original: {festivoEditing ? festivoEditing.scope || 'N/A' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={closeFestivoModal}>
                    Cancelar
                  </Button>
                  <Button onClick={handleFestivoSave}>Guardar cambios</Button>
                </div>
              </div>
            </Modal>
          )}
          {festivoToDelete && (
            <Modal
              isOpen={!!festivoToDelete}
              onClose={() => setFestivoToDelete(null)}
              title="Eliminar festivo"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  ¿Seguro que deseas eliminar el festivo{' '}
                  <span className="font-semibold text-gray-900">
                    {festivoToDelete.name || 'sin nombre'}
                  </span>{' '}
                  del día{' '}
                  <span className="font-semibold text-gray-900">
                    {festivoToDelete.date
                      ? new Date(festivoToDelete.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : 'sin fecha'}
                  </span>
                  ?
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  <div>
                    Ámbito:{' '}
                    <span className="font-medium text-gray-700">
                      {getScopeLabel(festivoToDelete.scope)}
                    </span>
                  </div>
                  {festivoToDelete.ccaa && (
                    <div>
                      Comunidad:{' '}
                      <span className="font-medium text-gray-700">
                        {CCAA_NAMES[festivoToDelete.ccaa] || festivoToDelete.ccaa}
                      </span>
                    </div>
                  )}
                  {festivoToDelete.notes && (
                    <div>
                      Notas:{' '}
                      <span className="font-medium text-gray-700">
                        {festivoToDelete.notes}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setFestivoToDelete(null)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={confirmFestivoDelete}>
                    Eliminar
                  </Button>
                </div>
              </div>
            </Modal>
          )}
          </div>
        )}

        {activeTab === 'lista_cuadrantes' && (
          <div className="space-y-6">
            {/* Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <label
                  htmlFor="lista-centro"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Centro de Trabajo:
                </label>
                <div className="relative">
                  <input
                    id="lista-centro"
                    name="listaCentro"
                    type="text"
                    value={centroSearchTermLista}
                    readOnly={false}
                    disabled={false}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCentroSearchTermLista(newValue);
                      setCentroDropdownOpenLista(true);
                      if (!newValue.trim()) {
                        setSelectedCentro('');
                        setSelectedEmpleado('');
                      }
                    }}
                    onFocus={() => setCentroDropdownOpenLista(true)}
                    onBlur={() => {
                      // Delay pentru a permite click pe opțiune
                      setTimeout(() => setCentroDropdownOpenLista(false), 200);
                    }}
                    placeholder="Buscar o escribir centro..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  {centroDropdownOpenLista && filteredCentrosLista.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredCentrosLista.map(centro => (
                        <div
                          key={centro}
                          onClick={() => {
                            setSelectedCentro(centro);
                            setSelectedEmpleado('');
                            setCentroSearchTermLista(centro);
                            setCentroDropdownOpenLista(false);
                          }}
                          className="p-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                      {centro}
                        </div>
                ))}
                    </div>
                  )}
                  {centroDropdownOpenLista && filteredCentrosLista.length === 0 && centroSearchTermLista && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-gray-500">
                      No se encontraron centros
                    </div>
                  )}
                </div>
            </div>
              
              <div>
                <label
                  htmlFor="lista-empleado"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Empleado:
                </label>
                <select
                  id="lista-empleado"
                  name="listaEmpleado"
                  value={selectedEmpleado}
                  onChange={(e) => setSelectedEmpleado(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={!selectedCentro}
                >
                  <option value="">Selecciona un empleado...</option>
                  {angajatiFiltrati.map(emp => {
                    const name = emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || emp.EMAIL || 'Unknown';
                    return (
                      <option key={emp['CODIGO'] || emp.id} value={emp['CODIGO'] || emp.id}>
                        {name}
                      </option>
                    );
                  })}
                </select>
          </div>

              <div>
                <label
                  htmlFor="lista-mes-ano"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Mes/Año:
                </label>
                <div className="flex gap-2">
                  <select
                    id="lista-mes-ano"
                    name="listaMesAno"
                    value={selectedMesAno}
                    onChange={(e) => setSelectedMesAno(e.target.value)}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                  <option value="">Todos los meses</option>
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth(); // 0-11
                    const options = [];
                    
                    // Adăugăm toate lunile din anul curent
                    for (let month = 0; month <= 11; month++) {
                      const date = new Date(currentYear, month, 1);
                      const monthStr = String(month + 1).padStart(2, '0');
                      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                      const value = `${currentYear}-${monthStr}`;
                      options.push({
                        value,
                        label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                        year: currentYear,
                        month: month
                      });
                    }
                    
                    // Adăugăm luna anterioară (dacă nu este deja în anul curent)
                    if (currentMonth === 0) {
                      // Dacă suntem în ianuarie, adăugăm decembrie anul trecut
                      const prevYear = currentYear - 1;
                      const date = new Date(prevYear, 11, 1); // Decembrie
                      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                      const value = `${prevYear}-12`;
                      options.unshift({
                        value,
                        label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                        year: prevYear,
                        month: 11
                      });
                    }
                    
                    // Sortăm descrescător (luna curentă primul, apoi restul)
                    // Anul mai mare primul, apoi luna mai mare primul
                    options.sort((a, b) => {
                      if (a.year !== b.year) {
                        return b.year - a.year; // Anul mai mare primul
                      }
                      return b.month - a.month; // Luna mai mare primul
                    });
                    
                    return options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ));
                  })()}
                </select>
                {selectedMesAno && (
                  <button
                    onClick={() => setSelectedMesAno('')}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                    title="Limpiar filtro de mes/año"
                  >
                    ✕
                  </button>
                )}
                </div>
              </div>
            </div>
            
            {/* Cuadrantes List */}
            <div className="space-y-4">
              {/* Botón para cargar cuadrantes */}
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    if (!selectedCentro) {
                      alert('Por favor selecciona un centro de trabajo');
                      return;
                    }
                    
                    try {
                      setLoading(true);
                      setError('');
                      
                      // Preparar payload basado en selecciones
                      const payload = {
                        centro: selectedCentro
                      };
                      
                      // Si también está seleccionado un empleado, agregarlo al payload
                      if (selectedEmpleado) {
                        const empleado = angajatiFiltrati.find(emp => (emp['CODIGO'] || emp.id) === selectedEmpleado);
                        if (empleado) {
                          payload.empleado = empleado['CODIGO'] || empleado.id;
                          // NOMBRE eliminat - se filtrează doar pe CODIGO și CENTRO
                        }
                      }
                      
                      // Si está seleccionado un mes/año específico, agregarlo al payload
                      if (selectedMesAno) {
                        payload.mesAno = selectedMesAno;
                      }
                      
                      console.log('📋 Cargando cuadrantes con payload:', payload);
                      
                      // Add JWT token for authentication
                      const token = localStorage.getItem('auth_token');
                      const headers = {
                        'Content-Type': 'application/json',
                        'X-App-Source': 'DeCamino-Web-App',
                        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
                        'X-Client-Type': 'web-browser',
                        'User-Agent': 'DeCamino-Web-Client/1.0',
                      };
                      
                      if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                      }
                      
                      // Construiește URL-ul pentru backend
                      const params = new URLSearchParams();
                      if (payload.centro) params.set('centro', payload.centro);
                      if (payload.empleado) params.set('empleado', payload.empleado);
                      // nombre eliminat - filtrare doar pe CODIGO și CENTRO
                      if (payload.mesAno) params.set('mesAno', payload.mesAno);
                      
                      const endpoint = `${routes.getCuadrantes}${params.toString() ? '?' + params.toString() : ''}`;
                      console.log('🔗 Endpoint cuadrantes:', endpoint);
                      console.log('📋 Parámetros enviados:', payload);
                      
                      const response = await fetch(endpoint, {
                        method: 'GET',
                        headers
                      });
                      
                      console.log('📡 Response status:', response.status);
                      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
                      
                      const data = await response.json();
                      console.log('📦 Respuesta cuadrantes RAW:', data);
                      console.log('📊 Tipo de respuesta:', typeof data);
                      console.log('📊 Es array?', Array.isArray(data));
                      console.log('📊 Longitud:', Array.isArray(data) ? data.length : 'No es array');
                      
                      // Debug: verificar si la respuesta viene con información de filtrado
                      if (response.status !== 200) {
                        console.error('❌ Error HTTP:', response.status, data);
                      }
                      
                      if (response.ok) {
                        // Debug: analizar estructura de cada cuadrante
                        if (Array.isArray(data) && data.length > 0) {
                          console.log('🔍 Estructura primer cuadrante:', data[0]);
                          console.log('🔑 Claves disponibles:', Object.keys(data[0]));
                          
                          // Verificar campos específicos
                          const primerCuadrante = data[0];
                          console.log('👤 Empleado:', {
                            codigo: primerCuadrante.CODIGO,
                            nombre: primerCuadrante.NOMBRE,
                            email: primerCuadrante.EMAIL,
                            centro: primerCuadrante.CENTRO,
                            luna: primerCuadrante.LUNA
                          });
                          
                          // Verificar días del mes
                          const diasConDatos = Object.keys(primerCuadrante).filter(key => key.startsWith('ZI_'));
                          console.log('📅 Días con datos:', diasConDatos.length);
                          console.log('📅 Primeros 5 días:', diasConDatos.slice(0, 5).map(dia => ({
                            dia,
                            valor: primerCuadrante[dia]
                          })));
                        }
                        
                        setCuadrantesLista(Array.isArray(data) ? data : [data]);
                        showToast('Cuadrantes cargados correctamente', 'success');
                      } else {
                        setError('Error al cargar cuadrantes: ' + (data.message || 'Error desconocido'));
                        showToast('Error al cargar cuadrantes', 'error');
                      }
                      
                    } catch (error) {
                      console.error('❌ Error al cargar cuadrantes:', error);
                      setError('Error de conexión al cargar cuadrantes');
                      showToast('Error de conexión', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={!selectedCentro || loading}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Cargando...' : 'Cargar Cuadrantes'}
                </button>
                
                {selectedCentro && (
                  <div className="text-sm text-gray-600 flex items-center">
                    📍 Centro: <span className="font-semibold ml-1">{selectedCentro}</span>
                    {selectedEmpleado && (
                      <>
                        <span className="mx-2">•</span>
                        👤 Empleado: <span className="font-semibold ml-1">
                          {angajatiFiltrati.find(emp => (emp['CODIGO'] || emp.id) === selectedEmpleado)?.['NOMBRE / APELLIDOS'] || selectedEmpleado}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              
              {cuadrantesLista.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800">
                    Cuadrantes encontrados: {selectedMesAno ? cuadrantesLista.filter(c => c.LUNA === selectedMesAno).length : cuadrantesLista.length}
                    {selectedMesAno && ` (filtrados por ${selectedMesAno})`}
                  </h3>
                  
                  {/* Secțiune pentru gestionarea turelor */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 text-lg">🕐</span>
                        <h4 className="text-md font-bold text-gray-800">
                          Gestionar Turnos (T1, T2, T3)
                        </h4>
                        <span className="text-sm text-gray-600">
                          ({getAllUniqueShifts.length} turnos únicos encontrados)
                        </span>
                      </div>
                      <button
                        onClick={() => setShowShiftsEditor(!showShiftsEditor)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                      >
                        {showShiftsEditor ? 'Ocultar' : 'Mostrar'} Turnos
                      </button>
                    </div>
                    
                    {showShiftsEditor && (
                      <div className="mt-4 space-y-3">
                        {getAllUniqueShifts.length === 0 ? (
                          <p className="text-gray-600 text-sm">No hay turnos para mostrar</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {getAllUniqueShifts.map((shiftInfo, idx) => (
                              <div key={idx} className="bg-white border border-gray-300 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                      shiftInfo.type === 'T1' ? 'bg-blue-100 text-blue-700' :
                                      shiftInfo.type === 'T2' ? 'bg-green-100 text-green-700' :
                                      shiftInfo.type === 'T3' ? 'bg-purple-100 text-purple-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {shiftInfo.type}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      ({shiftInfo.count} apariții)
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (shiftInfo.start && shiftInfo.end) {
                                        setEditingShift({
                                          shift: shiftInfo.shift,
                                          type: shiftInfo.type,
                                          start: shiftInfo.start,
                                          end: shiftInfo.end
                                        });
                                      } else {
                                        // Dacă nu are ore, permite adăugarea
                                        setEditingShift({
                                          shift: shiftInfo.shift,
                                          type: shiftInfo.type,
                                          start: '08:00',
                                          end: '16:00'
                                        });
                                      }
                                    }}
                                    className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                                  >
                                    ✏️ Editar
                                  </button>
                                </div>
                                <div className="text-sm text-gray-700">
                                  {shiftInfo.start && shiftInfo.end ? (
                                    <span>{shiftInfo.start} - {shiftInfo.end}</span>
                                  ) : (
                                    <span className="text-gray-400 italic">Sin horas definidas</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 font-mono">
                                  {shiftInfo.shift}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Modal pentru editarea orelor turei */}
                  {editingShift && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold mb-4">
                          Editar Horas del Turno: {editingShift.type}
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Hora Inicio:
                            </label>
                            <input
                              type="time"
                              value={editingShift.start}
                              onChange={(e) => setEditingShift({...editingShift, start: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Hora Fin:
                            </label>
                            <input
                              type="time"
                              value={editingShift.end}
                              onChange={(e) => setEditingShift({...editingShift, end: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Turno actual:</strong> {editingShift.shift}
                            <br />
                            <strong>Nuevo turno:</strong> {editingShift.type} {editingShift.start}-{editingShift.end}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingShift(null)}
                              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => {
                                handleUpdateShiftHours(editingShift.shift, editingShift.start, editingShift.end);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Aplicar a Todas las Apariții
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Buton de salvare (apare când sunt modificări) */}
                  {hasChanges && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-600">⚠️</span>
                          <span className="text-yellow-800 font-medium">Tienes cambios sin guardar</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditedCuadrantes({});
                              setHasChanges(false);
                            }}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveChanges}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                          >
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabel consolidat cu toți angajații */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <h4 className="text-lg font-bold text-gray-800">
                        Cuadrantes Consolidados - {selectedCentro}
                      </h4>
                      <div className="flex gap-4 text-sm text-gray-600 mt-2">
                        <span><strong>Mes/Año:</strong> {selectedMesAno || 'Todos'}</span>
                        <span><strong>Total empleados:</strong> {cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno).length}</span>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-center font-bold min-w-[200px]">Empleado</th>
                            <th className="border border-gray-300 p-2 text-center font-bold min-w-[80px] bg-yellow-50">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs">Visible</span>
                                {cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno).length > 0 && (
                                  <input
                                    type="checkbox"
                                    checked={(() => {
                                      const filtered = cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno);
                                      return filtered.length > 0 && filtered.every(c => c.visible !== false && c.visible !== 0 && c.visible !== '0');
                                    })()}
                                    onChange={async (e) => {
                                      const newVisible = e.target.checked;
                                      const filtered = cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno);
                                      
                                      console.log('🔄 Toggling all visibility:', {
                                        count: filtered.length,
                                        newVisible: newVisible
                                      });
                                      
                                      try {
                                        const token = localStorage.getItem('auth_token');
                                        const apiUrl = routes.toggleCuadranteVisible;
                                        
                                        // Actualizăm toate cuadrantele cu delay între request-uri pentru a evita throttling
                                        // eslint-disable-next-line no-unused-vars
                                        let successCount = 0;
                                        let failCount = 0;
                                        
                                        for (let i = 0; i < filtered.length; i++) {
                                          const cuadrante = filtered[i];
                                          
                                          try {
                                            const response = await fetch(apiUrl, {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': token ? `Bearer ${token}` : '',
                                              },
                                              body: JSON.stringify({
                                                CODIGO: cuadrante.CODIGO,
                                                LUNA: cuadrante.LUNA,
                                                visible: newVisible
                                              })
                                            });
                                            
                                            if (response.ok) {
                                              // successCount++; // Comentat - nu este folosit
                                            } else {
                                              failCount++;
                                              console.error(`❌ Error updating cuadrante ${cuadrante.CODIGO} ${cuadrante.LUNA}:`, response.status);
                                            }
                                          } catch (error) {
                                            failCount++;
                                            console.error(`❌ Error updating cuadrante ${cuadrante.CODIGO} ${cuadrante.LUNA}:`, error);
                                          }
                                          
                                          // Delay între request-uri (100ms pentru a evita throttling)
                                          if (i < filtered.length - 1) {
                                            await new Promise(resolve => setTimeout(resolve, 100));
                                          }
                                        }
                                        
                                        if (failCount > 0) {
                                          throw new Error(`${failCount} de ${filtered.length} cuadrantes nu s-au putut actualiza`);
                                        }
                                        
                                        // Actualizăm starea locală pentru toate cuadrantele
                                        setCuadrantesLista(prev => prev.map(c => {
                                          const shouldUpdate = !selectedMesAno || c.LUNA === selectedMesAno;
                                          return shouldUpdate ? { ...c, visible: newVisible } : c;
                                        }));
                                        
                                        setNotification({
                                          type: 'success',
                                          title: 'Visibilidad actualizada',
                                          message: `${filtered.length} cuadrante${filtered.length !== 1 ? 's' : ''} ${newVisible ? 'visibles' : 'ocultos'} para los empleados.`
                                        });
                                      } catch (error) {
                                        console.error('❌ Error toggling all visibility:', error);
                                        setNotification({
                                          type: 'error',
                                          title: 'Error',
                                          message: error.message || 'No se pudieron actualizar todos los cuadrantes.'
                                        });
                                        // Revert checkbox
                                        e.target.checked = !newVisible;
                                      }
                                    }}
                                    className="w-4 h-4 cursor-pointer"
                                    title={(() => {
                                      const filtered = cuadrantesLista.filter(c => !selectedMesAno || c.LUNA === selectedMesAno);
                                      const allVisible = filtered.every(c => c.visible !== false && c.visible !== 0 && c.visible !== '0');
                                      return allVisible ? "Desmarcar todos" : "Marcar todos como visibles";
                                    })()}
                                  />
                                )}
                              </div>
                            </th>
                            {Array.from({ length: daysInMonthListaCuadrantes }, (_, i) => {
                              const dayNumber = i + 1;
                              const currentMonth = selectedMesAno ? parseInt(selectedMesAno.split('-')[1], 10) - 1 : selectedMonth;
                              const currentYear = selectedMesAno ? parseInt(selectedMesAno.split('-')[0], 10) : selectedYear;
                              const date = new Date(currentYear, currentMonth, dayNumber);
                              const dayOfWeek = date.getDay();
                              const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                              
                              return (
                                <th key={dayNumber} className="border border-gray-300 p-1 text-center text-xs font-bold min-w-[60px]">
                                  <div className="space-y-1">
                                    <div className="text-gray-800">{dayNumber}</div>
                                    <div className={`text-xs font-normal ${
                                      dayOfWeek === 0 || dayOfWeek === 6 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                      {dayNames[dayOfWeek]}
                                    </div>
                                  </div>
                                </th>
                              );
                            })}
                            <th className="border border-gray-300 p-3 text-center font-bold bg-blue-50">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuadrantesLista
                            .filter(cuadrante => !selectedMesAno || cuadrante.LUNA === selectedMesAno)
                            .map((cuadrante, index) => {
                              // Folosește funcția helper pentru identificator consistent
                              const identificator = getCuadranteIdentificator(cuadrante) || String(index);
                              
                              // Construir array de zile din cuadrante (doar zilele lunii curente, nu 31 fix)
                              const zile = [];
                              for (let i = 1; i <= daysInMonthListaCuadrantes; i++) {
                                const ziKey = `ZI_${i}`;
                                const editKey = `${identificator}_${i}`;
                                // Folosește valoarea editată dacă există, altfel valoarea originală
                                zile.push(editedCuadrantes[editKey] !== undefined ? editedCuadrantes[editKey] : (cuadrante[ziKey] || ''));
                              }
                              
                              return (
                            <tr key={index} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 p-3 font-medium">
                                    <div className="space-y-1">
                                      <div className="font-bold text-gray-800">
                                        {cuadrante.NOMBRE || cuadrante.nombre || 'N/A'}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {cuadrante.EMAIL || 'N/A'}
                                      </div>
                                      {cuadrante.LUNA && (
                                        <div className="text-xs text-blue-600 font-semibold mt-1">
                                          📅 {(() => {
                                            const luna = cuadrante.LUNA;
                                            if (typeof luna === 'number') {
                                              const date = new Date(Math.round((luna - 25569) * 86400 * 1000));
                                              const year = date.getUTCFullYear();
                                              const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                              return `${year}-${month}`;
                                            }
                                            if (typeof luna === 'string' && luna.includes('-')) {
                                              const [year, month] = luna.split('-');
                                              const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                              return `${monthNames[parseInt(month) - 1]} ${year}`;
                                            }
                                            return luna;
                                          })()}
                                        </div>
                                      )}
                                    </div>
                              </td>
                                  <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                                    <input
                                      type="checkbox"
                                      checked={cuadrante.visible !== false && cuadrante.visible !== 0 && cuadrante.visible !== '0'}
                                      onChange={async (e) => {
                                        const newVisible = e.target.checked;
                                        console.log('🔄 Toggling visibility:', {
                                          CODIGO: cuadrante.CODIGO,
                                          LUNA: cuadrante.LUNA,
                                          current: cuadrante.visible,
                                          new: newVisible
                                        });
                                        
                                        try {
                                          const token = localStorage.getItem('auth_token');
                                          const apiUrl = routes.toggleCuadranteVisible;
                                          console.log('📡 API URL:', apiUrl);
                                          
                                          const response = await fetch(apiUrl, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': token ? `Bearer ${token}` : '',
                                            },
                                            body: JSON.stringify({
                                              CODIGO: cuadrante.CODIGO,
                                              LUNA: cuadrante.LUNA,
                                              visible: newVisible
                                            })
                                          });
                                          
                                          console.log('📥 Response status:', response.status);
                                          
                                          if (!response.ok) {
                                            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                                            console.error('❌ Error response:', errorData);
                                            throw new Error(errorData.message || 'Error al actualizar visibilidad');
                                          }
                                          
                                          const result = await response.json().catch(() => ({}));
                                          console.log('✅ Success:', result);
                                          
                                          // Actualizăm starea locală
                                          setCuadrantesLista(prev => prev.map(c => 
                                            (c.CODIGO === cuadrante.CODIGO && c.LUNA === cuadrante.LUNA)
                                              ? { ...c, visible: newVisible }
                                              : c
                                          ));
                                          
                                          setNotification({
                                            type: 'success',
                                            title: 'Visibilidad actualizada',
                                            message: `El cuadrante de ${cuadrante.NOMBRE} ahora es ${newVisible ? 'visible' : 'oculto'} para los empleados.`
                                          });
                                        } catch (error) {
                                          console.error('❌ Error toggling visibility:', error);
                                          setNotification({
                                            type: 'error',
                                            title: 'Error',
                                            message: error.message || 'No se pudo actualizar la visibilidad del cuadrante.'
                                          });
                                          // Revert checkbox - forțăm re-render
                                          setCuadrantesLista(prev => [...prev]);
                                        }
                                      }}
                                      className="w-5 h-5 cursor-pointer"
                                      title={cuadrante.visible !== false && cuadrante.visible !== 0 && cuadrante.visible !== '0' ? "Visible para empleados" : "Oculto para empleados"}
                                    />
                                  </td>
                                  {zile.map((z, i) => {
                                    const editKey = `${identificator}_${i + 1}`;
                                    const isEdited = editedCuadrantes[editKey] !== undefined;
                                    
                                    // Verifică dacă ziua este marcată ca multicentro
                                    const esMulticentro = isCuadranteMarcaMulticentro(z);
                                    
                                    // Calculează ziua săptămânii pentru luna acestui cuadrante
                                    const getDayOfWeek = (dayNumber, lunaStr) => {
                                      if (!lunaStr || !lunaStr.includes('-')) return '';
                                      try {
                                        const [year, month] = lunaStr.split('-');
                                        const date = new Date(parseInt(year), parseInt(month) - 1, dayNumber);
                                        const dayOfWeek = date.getDay();
                                        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                        return dayNames[dayOfWeek];
                                      // eslint-disable-next-line no-unused-vars
                                      } catch (_e) {
                                        return '';
                                      }
                                    };
                                    
                                    const dayOfWeek = getDayOfWeek(i + 1, cuadrante.LUNA);
                                    
                                    return (
                                      <td key={i} className="border border-gray-300 p-1 text-center text-xs">
                                        <div className="flex flex-col items-center gap-0.5">
                                          {dayOfWeek && (
                                            <div className={`text-[10px] font-semibold ${
                                              dayOfWeek === 'Dom' || dayOfWeek === 'Sáb' ? 'text-red-500' : 'text-gray-500'
                                            }`}>
                                              {dayOfWeek}
                                            </div>
                                          )}
                                          <span 
                                            className={`px-1 py-1 rounded text-xs cursor-pointer hover:bg-blue-100 transition-colors block w-full ${
                                              z === 'LIBRE' || z === '' 
                                                ? 'bg-gray-100 text-gray-600' 
                                                : esMulticentro
                                                ? 'bg-purple-100 text-purple-700 font-medium'
                                                : 'bg-green-100 text-green-700'
                                            } ${isEdited ? 'ring-1 ring-yellow-400' : ''}`}
                                            title={`Click para editar ${cuadrante.NOMBRE} - día ${i + 1} (${dayOfWeek || 'N/A'}): ${z || 'Sin datos'}${esMulticentro ? ' (Multicentro)' : ''}`}
                                            onClick={() => handleEditDay(index, i + 1, z, cuadrante)}
                                          >
                                            {z || '-'}
                                            {isEdited && <span className="text-yellow-600">*</span>}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                                    <div className="space-y-1">
                                      <div className="text-blue-600 text-sm">
                                        {zile.filter(
                                          (z) => z && z !== 'LIBRE' && !isCuadranteMarcaMulticentro(z)
                                        ).length}{' '}
                                        días
                                      </div>
                                      <div className="text-green-600 text-xs">
                                        {(() => {
                                          let totalHoras = 0;
                                          zile.forEach((z) => {
                                            if (z && z !== 'LIBRE' && z.trim() !== '' && !isCuadranteMarcaMulticentro(z)) {
                                              totalHoras += calculateCuadranteHours(z);
                                            }
                                          });
                                          return `${totalHoras.toFixed(1)}h`;
                                        })()}
                                      </div>
                                    </div>
                                    {Object.keys(editedCuadrantes).some(key => key.startsWith(`${index}_`)) && (
                                      <div className="text-xs text-yellow-600">*</div>
                                    )}
                              </td>
                            </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {cuadrantesLista.length === 0 && selectedCentro && (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay cuadrantes cargados. Haz clic en &quot;Cargar Cuadrantes&quot; para buscar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'horarios' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Gestión de Horarios de Trabajo
              </h3>
              <p className="text-gray-600">
                Crea y gestiona horarios específicos para cada centro y grupo de empleados
              </p>
            </div>
            
            {horariosLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando datos...</p>
                </div>
              </div>
            ) : (
              <ScheduleEditor
                centros={horariosCentros}
                grupos={horariosGrupos}
                callApi={callApi}
                onSave={(schedule) => {
                  console.log('✅ Horario guardado:', schedule);
                  alert('Horario guardado con éxito!');
                }}
                onError={(error) => {
                  console.error('❌ Error al guardar horario:', error);
                  alert(`Error al guardar horario: ${error}`);
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'horario_multicentro' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-2">
                📋 Horario Multicentro
              </h3>
              <p className="text-blue-800">
                Importa horarios especiales para empleados que trabajan en múltiples centros, o{' '}
                <strong>crea un registro manual</strong> con el editor de días (turno u horas) más abajo, o importa Excel.
              </p>
              <p className="text-sm text-blue-700 mt-2">
                <strong>Formato Excel esperado:</strong> Nome empleado (Row 2), Luna (Row 3), 
                Header: CLIENTE, HORARIO, SERVICIO, Nº DE HORAS, 1-31 (Row 4), 
                Date: Centro + Turno + Ore pe zile (Row 5+)
              </p>
            </div>

            {/* Selectori pentru Lună și Angajat */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label htmlFor="horario-multicentro-mes" className="block text-sm font-medium text-gray-700 mb-2">
                  📅 Mes
                </label>
                <input
                  id="horario-multicentro-mes"
                  type="month"
                  value={selectedMonthHorariosMulticentro}
                  onChange={(e) => setSelectedMonthHorariosMulticentro(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="relative">
                <label htmlFor="horario-multicentro-empleado" className="block text-sm font-medium text-gray-700 mb-2">
                  👤 Empleado (opcional - puedes escribir o seleccionar)
                </label>
                <div className="relative">
                  <input
                    id="horario-multicentro-empleado"
                    type="text"
                    value={empleadoHorariosMulticentroSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmpleadoHorariosMulticentroSearch(value);
                      setShowEmpleadoHorariosMulticentroDropdown(true);
                      
                      // Dacă utilizatorul șterge textul, resetează și codigo-ul
                      if (!value) {
                        setSelectedEmpleadoHorariosMulticentro('');
                      }
                    }}
                    onFocus={() => setShowEmpleadoHorariosMulticentroDropdown(true)}
                    onBlur={() => {
                      // Delay pentru a permite click-ul pe dropdown
                      setTimeout(() => setShowEmpleadoHorariosMulticentroDropdown(false), 200);
                    }}
                    placeholder="Escribe el nombre o código del empleado..."
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  
                  {/* Dropdown cu sugestii */}
                  {showEmpleadoHorariosMulticentroDropdown && empleadoHorariosMulticentroSearch && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(() => {
                        const searchLower = empleadoHorariosMulticentroSearch.toLowerCase();
                        const filtered = angajati.filter(emp => {
                          const nombre = (emp['NOMBRE / APELLIDOS'] || '').toLowerCase();
                          const codigo = (emp.CODIGO || '').toLowerCase();
                          return nombre.includes(searchLower) || codigo.includes(searchLower);
                        });
                        
                        if (filtered.length === 0) {
                          return (
                            <div className="px-4 py-3 text-gray-500 text-sm">
                              No se encontraron empleados
                            </div>
                          );
                        }
                        
                        return (
                          <div className="p-2">
                            {filtered.slice(0, 20).map((emp) => {
                              const nombre = emp['NOMBRE / APELLIDOS'] || 'Sin nombre';
                              const codigo = emp.CODIGO || '';
                              return (
                                <button
                                  key={codigo}
                                  type="button"
                                  onClick={() => {
                                    setEmpleadoHorariosMulticentroSearch(`${nombre} - ${codigo}`);
                                    setSelectedEmpleadoHorariosMulticentro(codigo);
                                    setShowEmpleadoHorariosMulticentroDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <div className="font-medium text-gray-900">{nombre}</div>
                                  <div className="text-sm text-gray-600">{codigo}</div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Opțiune pentru a șterge selecția */}
                  {empleadoHorariosMulticentroSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpleadoHorariosMulticentroSearch('');
                        setSelectedEmpleadoHorariosMulticentro('');
                        setShowEmpleadoHorariosMulticentroDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="Limpiar selección"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!selectedMonthHorariosMulticentro) {
                      showToast('error', 'Por favor selecciona un mes');
                      return;
                    }
                    
                    setLoadingHorariosMulticentro(true);
                    try {
                      const token = localStorage.getItem('auth_token');
                      const params = new URLSearchParams({
                        mes: selectedMonthHorariosMulticentro,
                      });
                      
                      // Dacă utilizatorul a introdus text manual, încercăm să extragem codigo-ul
                      // Altfel folosim codigo-ul selectat
                      let codigoParaBuscar = selectedEmpleadoHorariosMulticentro;
                      
                      if (!codigoParaBuscar && empleadoHorariosMulticentroSearch) {
                        // Încearcă să găsească codigo după nume sau text introdus
                        const searchLower = empleadoHorariosMulticentroSearch.toLowerCase();
                        const encontrado = angajati.find(emp => {
                          const nombre = (emp['NOMBRE / APELLIDOS'] || '').toLowerCase();
                          const codigo = (emp.CODIGO || '').toLowerCase();
                          return nombre.includes(searchLower) || codigo.includes(searchLower);
                        });
                        if (encontrado && encontrado.CODIGO) {
                          codigoParaBuscar = encontrado.CODIGO;
                        }
                      }
                      
                      if (codigoParaBuscar) {
                        params.append('codigo', codigoParaBuscar);
                      }
                      
                      const response = await fetch(`${routes.getHorarioMulticentro}?${params.toString()}`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': token ? `Bearer ${token}` : '',
                        },
                      });
                      
                      if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                      }
                      
                      const data = await response.json();
                      if (data.success && Array.isArray(data.horarios)) {
                        setHorariosMulticentroList(data.horarios);
                        setMulticentroListEdits({});
                        showToast('success', `Se encontraron ${data.horarios.length} horarios multicentro`);
                      } else {
                        setHorariosMulticentroList([]);
                        setMulticentroListEdits({});
                        showToast('info', 'No se encontraron horarios multicentro para los filtros seleccionados');
                      }
                    } catch (error) {
                      console.error('Error fetching horarios multicentro:', error);
                      showToast('error', `Error al cargar horarios multicentro: ${error.message}`);
                      setHorariosMulticentroList([]);
                      setMulticentroListEdits({});
                    } finally {
                      setLoadingHorariosMulticentro(false);
                    }
                  }}
                  disabled={loadingHorariosMulticentro || !selectedMonthHorariosMulticentro}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loadingHorariosMulticentro ? 'Cargando...' : '🔍 Buscar Horarios'}
                </Button>
              </div>
            </div>

            {/* Crear horario multicentro: empleado + cliente + editor de días */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h4 className="text-lg font-bold text-green-900 mb-1">
                ➕ Crear horario multicentro (manual)
              </h4>
              <p className="text-sm text-green-800 mb-3">
                Mes y empleado arriba. Indica el <strong>cliente / comunidad</strong> y, para cada día del mes, el{' '}
                <strong>turno</strong> (ej. <code>T1 07:30-15:00</code>) o solo <strong>horas</strong> (ej.{' '}
                <code>8</code>). Deja en blanco los días libres. Pulsa <strong>Guardar horario</strong> (se exige al menos
                un día con dato).
              </p>
              <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="nuevo-cliente-multicentro"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cliente / centro (comunidad)
                  </label>
                  <input
                    id="nuevo-cliente-multicentro"
                    type="text"
                    list="centros-datalist-multicentro-crear"
                    value={nuevoClienteMulticentro}
                    onChange={(e) => setNuevoClienteMulticentro(e.target.value)}
                    placeholder="Ej. COMUNIDAD DE PROPIETARIOS…"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <datalist id="centros-datalist-multicentro-crear">
                    {centros.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-gray-400 whitespace-nowrap"
                  onClick={() => setMulticentroManualDias({})}
                >
                  Limpiar días
                </Button>
                <Button
                  type="button"
                  disabled={
                    savingNuevoMulticentro ||
                    !selectedMonthHorariosMulticentro ||
                    !nuevoClienteMulticentro.trim() ||
                    !Object.values(multicentroManualDias).some(
                      (v) => v != null && String(v).trim() !== '',
                    )
                  }
                  loading={savingNuevoMulticentro}
                  className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                  onClick={async () => {
                    if (!selectedMonthHorariosMulticentro) {
                      showToast('error', 'Selecciona un mes');
                      return;
                    }
                    let codigoParaCrear = selectedEmpleadoHorariosMulticentro;
                    if (!codigoParaCrear && empleadoHorariosMulticentroSearch) {
                      const searchLower = empleadoHorariosMulticentroSearch.toLowerCase();
                      const encontrado = angajati.find((emp) => {
                        const nombre = (emp['NOMBRE / APELLIDOS'] || '').toLowerCase();
                        const cod = (emp.CODIGO || '').toLowerCase();
                        return nombre.includes(searchLower) || cod.includes(searchLower);
                      });
                      if (encontrado?.CODIGO) {
                        codigoParaCrear = String(encontrado.CODIGO);
                      }
                    }
                    if (!codigoParaCrear) {
                      showToast('error', 'Selecciona o busca un empleado');
                      return;
                    }
                    const clienteTrim = nuevoClienteMulticentro.trim();
                    if (!clienteTrim) {
                      showToast('error', 'Indica el cliente / centro');
                      return;
                    }
                    const hasDia = Object.values(multicentroManualDias).some(
                      (v) => v != null && String(v).trim() !== '',
                    );
                    if (!hasDia) {
                      showToast('error', 'Rellena al menos un día');
                      return;
                    }
                    const emp = angajati.find((e) => String(e.CODIGO) === String(codigoParaCrear));
                    setSavingNuevoMulticentro(true);
                    try {
                      const token = localStorage.getItem('auth_token');
                      const horarioRow = {
                        CODIGO: String(codigoParaCrear),
                        EMAIL: emp?.['CORREO ELECTRONICO'] || emp?.EMAIL || '',
                        NOMBRE: emp?.['NOMBRE / APELLIDOS'] || emp?.NOMBRE || '',
                        LUNA: selectedMonthHorariosMulticentro,
                        CLIENTE: clienteTrim,
                        HORARIO: 'MULTICENTRO',
                        SERVICIO: 'MULTICENTRO',
                      };
                      for (let d = 1; d <= 31; d++) {
                        const raw = multicentroManualDias[d];
                        if (raw == null || String(raw).trim() === '') continue;
                        const t = String(raw).trim();
                        if (t.toUpperCase() === 'LIBRE') {
                          horarioRow[`ZI_${d}`] = null;
                        } else {
                          horarioRow[`ZI_${d}`] = t;
                        }
                      }
                      let totalSum = 0;
                      for (let d = 1; d <= 31; d++) {
                        const cell = multicentroManualDias[d];
                        if (cell == null || String(cell).trim() === '') continue;
                        const t = String(cell).trim();
                        if (t.toUpperCase() === 'LIBRE') continue;
                        const oreStr = transformaZiValueInOre(t);
                        if (oreStr) totalSum += parseFloat(oreStr) || 0;
                      }
                      if (totalSum > 0) {
                        horarioRow.TotalHoras = totalSum.toFixed(1);
                      }
                      const response = await fetch(routes.saveHorariosMulticentro, {
                        method: 'POST',
                        headers: {
                          Authorization: token ? `Bearer ${token}` : '',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          horarios: [horarioRow],
                        }),
                      });
                      if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        throw new Error(err.message || 'Error al guardar horario multicentro');
                      }
                      const data = await response.json().catch(() => ({}));
                      showToast(
                        'success',
                        `Horario guardado (${data.updated ?? 1}). Puedes pulsar «Buscar Horarios» para verlo.`,
                      );
                      setNuevoClienteMulticentro('');
                      setMulticentroManualDias({});
                      const params = new URLSearchParams({
                        mes: selectedMonthHorariosMulticentro,
                        codigo: String(codigoParaCrear),
                      });
                      const refresh = await fetch(`${routes.getHorarioMulticentro}?${params.toString()}`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: token ? `Bearer ${token}` : '',
                        },
                      });
                      if (refresh.ok) {
                        const j = await refresh.json();
                        if (j.success && Array.isArray(j.horarios)) {
                          setHorariosMulticentroList(j.horarios);
                        }
                      }
                    } catch (err) {
                      console.error(err);
                      showToast('error', err?.message || 'Error al guardar');
                    } finally {
                      setSavingNuevoMulticentro(false);
                    }
                  }}
                >
                  Guardar horario
                </Button>
              </div>
              <div className="border-t border-green-200 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Días del mes ({daysInMonthHorariosMulticentro} días)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                  {Array.from({ length: daysInMonthHorariosMulticentro }, (_, i) => {
                    const day = i + 1;
                    const mesParts = selectedMonthHorariosMulticentro.split('-');
                    const y = parseInt(mesParts[0], 10);
                    const m = parseInt(mesParts[1], 10) - 1;
                    const dow = new Date(y, m, day).getDay();
                    const dowShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dow];
                    return (
                      <div key={day} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-600">
                          {day} · {dowShort}
                        </span>
                        <input
                          type="text"
                          className="w-full text-xs p-1.5 border border-gray-300 rounded-md bg-white"
                          value={multicentroManualDias[day] ?? ''}
                          onChange={(e) =>
                            setMulticentroManualDias((prev) => ({
                              ...prev,
                              [day]: e.target.value,
                            }))
                          }
                          placeholder="T1… / 8"
                          title="Turno (T1 08:00-16:00) u horas (8)"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Afișare Horarios Multicentro grupate după Centru */}
            {horariosMulticentroList.length > 0 && (() => {
              // Funcție helper pentru calculul orelor din formatul complet (T1 07:30-19:30 sau doar "12")
              const calculaOreDinFormat = (horasStr) => {
                if (!horasStr || horasStr === '' || horasStr === 'LIBRE' || horasStr === '0' || horasStr === '0h') {
                  return 0;
                }

                const str = String(horasStr).trim();

                // Dacă este deja un număr (ex: "8", "8h", "8.0")
                if (!isNaN(parseFloat(str)) && isFinite(parseFloat(str))) {
                  const hours = parseFloat(str);
                  return hours > 0 ? hours : 0;
                }

                // Dacă este format "T1 XX:XX:XX - XX:XX:XX", "T2 XX:XX:XX - XX:XX:XX", "T3 XX:XX:XX - XX:XX:XX"
                let turnoMatch = str.match(
                  /^T[123]\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                );
                if (!turnoMatch) {
                  turnoMatch = str.match(
                    /^T[123](\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                  );
                }
                if (!turnoMatch) {
                  turnoMatch = str.match(
                    /^T[123]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                  );
                }

                if (turnoMatch) {
                  const startHour = parseInt(turnoMatch[1], 10);
                  const startMin = parseInt(turnoMatch[2], 10);
                  let endHour = parseInt(turnoMatch[4], 10);
                  const endMin = parseInt(turnoMatch[5], 10);

                  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
                    endHour += 24;
                  }

                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;
                  const durationMinutes = endMinutes - startMinutes;
                  const durationHours = durationMinutes / 60;

                  return durationHours;
                }

                // Dacă este format "XX:XX:XX - XX:XX:XX" (fără T1/T2/T3)
                const timeMatch = str.match(
                  /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                );
                if (timeMatch) {
                  const startHour = parseInt(timeMatch[1], 10);
                  const startMin = parseInt(timeMatch[2], 10);
                  let endHour = parseInt(timeMatch[4], 10);
                  const endMin = parseInt(timeMatch[5], 10);

                  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
                    endHour += 24;
                  }

                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;
                  const durationMinutes = endMinutes - startMinutes;
                  const durationHours = durationMinutes / 60;

                  return durationHours;
                }

                // Dacă este doar "T1", "T2", "T3" fără ore, presupunem 8 ore
                if (str.match(/^T[123]$/)) {
                  return 8;
                }

                // Fallback: încercăm să extragem orice format de orar
                const anyTimeMatch = str.match(
                  /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                );
                if (anyTimeMatch) {
                  const startHour = parseInt(anyTimeMatch[1], 10);
                  const startMin = parseInt(anyTimeMatch[2], 10);
                  let endHour = parseInt(anyTimeMatch[4], 10);
                  const endMin = parseInt(anyTimeMatch[5], 10);

                  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
                    endHour += 24;
                  }

                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;
                  const durationMinutes = endMinutes - startMinutes;
                  const durationHours = durationMinutes / 60;

                  return durationHours;
                }

                return 0;
              };

              // Grupează după CLIENTE (Centro)
              const groupedByCentro = horariosMulticentroList.reduce((acc, horario) => {
                const centro = horario.CLIENTE || horario.cliente || 'Sin centro';
                if (!acc[centro]) {
                  acc[centro] = [];
                }
                acc[centro].push(horario);
                return acc;
              }, {});

              return (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    📊 Horarios Multicentro agrupados por Centro ({Object.keys(groupedByCentro).length} centros)
                  </h3>
                  
                  {Object.entries(groupedByCentro).map(([centro, horarios]) => (
                    <div key={centro} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-blue-600 text-white px-6 py-3 font-bold text-lg">
                        🏢 {centro} ({horarios.length} horario{horarios.length !== 1 ? 's' : ''})
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left border border-gray-200">Empleado</th>
                              <th className="px-3 py-2 text-left border border-gray-200">Código</th>
                              <th className="px-3 py-2 text-left border border-gray-200">Horario</th>
                              <th className="px-3 py-2 text-left border border-gray-200">Servicio</th>
                              {Array.from({ length: daysInMonthHorariosMulticentro }, (_, i) => {
                                const dayNumber = i + 1;
                                return (
                                  <th 
                                    key={`day-header-${dayNumber}`} 
                                    className="px-1 py-2 text-center border border-gray-200 min-w-[60px]"
                                  >
                                    {dayNumber}
                                  </th>
                                );
                              })}
                              <th className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold">Total Horas</th>
                              <th className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {horarios.map((horario, idx) => {
                              const rowId = horario.id;
                              let totalHoras = 0;
                              for (let i = 1; i <= daysInMonthHorariosMulticentro; i++) {
                                const baseStr = String(horario[`ZI_${i}`] ?? horario[`zi_${i}`] ?? '');
                                const merged =
                                  rowId != null && multicentroListEdits[rowId]?.[i] !== undefined
                                    ? multicentroListEdits[rowId][i]
                                    : baseStr;
                                totalHoras += calculaOreDinFormat(merged);
                              }

                              return (
                                <tr key={rowId ?? `${centro}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 border border-gray-200 font-medium">
                                    {horario.NOMBRE || horario.nombre || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 border border-gray-200 text-gray-600">
                                    {horario.CODIGO || horario.codigo || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 border border-gray-200">
                                    {horario.HORARIO || horario.horario || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 border border-gray-200">
                                    {horario.SERVICIO || horario.servicio || 'N/A'}
                                  </td>
                                  {Array.from({ length: daysInMonthHorariosMulticentro }, (_, dayIdx) => {
                                    const day = dayIdx + 1;
                                    const baseStr = String(horario[`ZI_${day}`] ?? horario[`zi_${day}`] ?? '');
                                    const merged =
                                      rowId != null && multicentroListEdits[rowId]?.[day] !== undefined
                                        ? multicentroListEdits[rowId][day]
                                        : baseStr;
                                    const h = merged;
                                    const isEmpty =
                                      h === '' ||
                                      h === 'LIBRE' ||
                                      h === '0' ||
                                      h === '0h' ||
                                      String(h).trim() === '';
                                    return (
                                      <td
                                        key={`day-${day}`}
                                        className="px-0.5 py-1 border border-gray-200 align-top"
                                      >
                                        <input
                                          type="text"
                                          className={`w-full min-w-[48px] max-w-[92px] text-[10px] leading-tight p-1 border rounded box-border ${
                                            isEmpty
                                              ? 'bg-gray-50 text-gray-500 border-gray-200'
                                              : 'bg-green-50 text-green-800 border-green-200 font-medium'
                                          }`}
                                          value={h}
                                          title={h || '—'}
                                          placeholder="—"
                                          disabled={rowId == null || savingMulticentroListId === rowId}
                                          onChange={(e) => {
                                            if (rowId == null) return;
                                            setMulticentroListEdits((prev) => ({
                                              ...prev,
                                              [rowId]: {
                                                ...(prev[rowId] || {}),
                                                [day]: e.target.value,
                                              },
                                            }));
                                          }}
                                        />
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center border border-gray-200 font-bold bg-blue-50">
                                    {totalHoras > 0 ? `${totalHoras.toFixed(1)}h` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-center border border-gray-200">
                                    <div className="flex flex-wrap gap-2 justify-center">
                                      <button
                                        type="button"
                                        disabled={
                                          rowId == null ||
                                          savingMulticentroListId === rowId
                                        }
                                        onClick={async () => {
                                          if (!horario.id) {
                                            showToast(
                                              'error',
                                              'No se puede guardar: falta id del registro',
                                            );
                                            return;
                                          }
                                          setSavingMulticentroListId(horario.id);
                                          try {
                                            const token = localStorage.getItem('auth_token');
                                            const updateData = {};
                                            for (let zi = 1; zi <= 31; zi++) {
                                              const baseZi = String(
                                                horario[`ZI_${zi}`] ?? horario[`zi_${zi}`] ?? '',
                                              );
                                              const mergedZi =
                                                multicentroListEdits[horario.id]?.[zi] !== undefined
                                                  ? multicentroListEdits[horario.id][zi]
                                                  : baseZi;
                                              const t = String(mergedZi).trim();
                                              updateData[`ZI_${zi}`] =
                                                t === '' || t.toUpperCase() === 'LIBRE' ? null : t;
                                            }
                                            const updateResponse = await fetch(
                                              `${routes.updateHorarioMulticentro}/${horario.id}`,
                                              {
                                                method: 'PUT',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  Authorization: token ? `Bearer ${token}` : '',
                                                },
                                                body: JSON.stringify(updateData),
                                              },
                                            );
                                            if (!updateResponse.ok) {
                                              throw new Error(
                                                `HTTP error! status: ${updateResponse.status}`,
                                              );
                                            }
                                            const mes =
                                              horario.LUNA ||
                                              horario.luna ||
                                              selectedMonthHorariosMulticentro;
                                            const codigo = horario.CODIGO || horario.codigo;
                                            const refreshResponse = await fetch(
                                              `${routes.getHorarioMulticentro}?mes=${mes}${codigo ? `&codigo=${codigo}` : ''}`,
                                              {
                                                method: 'GET',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  Authorization: token ? `Bearer ${token}` : '',
                                                },
                                              },
                                            );
                                            if (refreshResponse.ok) {
                                              const refreshData = await refreshResponse.json();
                                              if (
                                                refreshData.success &&
                                                Array.isArray(refreshData.horarios)
                                              ) {
                                                setHorariosMulticentroList(refreshData.horarios);
                                                setMulticentroListEdits((prev) => {
                                                  const next = { ...prev };
                                                  delete next[horario.id];
                                                  return next;
                                                });
                                                showToast('success', 'Horario multicentro guardado');
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Error guardando horario multicentro:', error);
                                            showToast(
                                              'error',
                                              `Error al guardar: ${error.message}`,
                                            );
                                          } finally {
                                            setSavingMulticentroListId(null);
                                          }
                                        }}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs rounded"
                                        title="Guardar cambios de esta fila"
                                      >
                                        {savingMulticentroListId === horario.id ? '…' : '💾'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingMulticentroListId === horario.id}
                                        onClick={async () => {
                                          // Preia ture din cuadrante
                                          try {
                                            const token = localStorage.getItem('auth_token');
                                            const codigo = horario.CODIGO || horario.codigo;
                                            const mes = horario.LUNA || horario.luna || selectedMonthHorariosMulticentro;
                                            const centroNombre = horario.CLIENTE || horario.cliente || centro;

                                            if (!codigo || !mes || !centroNombre) {
                                              showToast('error', 'Faltan datos para obtener turnos del cuadrante');
                                              return;
                                            }

                                            const params = new URLSearchParams({
                                              codigo: codigo,
                                              mes: mes,
                                              centro: centroNombre,
                                            });

                                            const response = await fetch(`${routes.getTurnosFromCuadrante}?${params.toString()}`, {
                                              method: 'GET',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': token ? `Bearer ${token}` : '',
                                              },
                                            });

                                            if (!response.ok) {
                                              throw new Error(`HTTP error! status: ${response.status}`);
                                            }

                                            const data = await response.json();
                                            if (data.success && data.cuadrante) {
                                              // Actualizează horario_multicentro cu turele din cuadrante
                                              const updateData = {};
                                              for (let i = 1; i <= 31; i++) {
                                                const ziKey = `ZI_${i}`;
                                                if (data.cuadrante[ziKey] !== undefined) {
                                                  updateData[ziKey] = data.cuadrante[ziKey] || null;
                                                }
                                              }

                                              // Actualizează în backend
                                              const updateResponse = await fetch(`${routes.updateHorarioMulticentro}/${horario.id}`, {
                                                method: 'PUT',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  'Authorization': token ? `Bearer ${token}` : '',
                                                },
                                                body: JSON.stringify(updateData),
                                              });

                                              if (!updateResponse.ok) {
                                                throw new Error(`HTTP error! status: ${updateResponse.status}`);
                                              }

                                              // Reîncarcă lista
                                              const refreshResponse = await fetch(`${routes.getHorarioMulticentro}?mes=${mes}${codigo ? `&codigo=${codigo}` : ''}`, {
                                                method: 'GET',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  'Authorization': token ? `Bearer ${token}` : '',
                                                },
                                              });

                                              if (refreshResponse.ok) {
                                                const refreshData = await refreshResponse.json();
                                                if (refreshData.success && Array.isArray(refreshData.horarios)) {
                                                  setHorariosMulticentroList(refreshData.horarios);
                                                  setMulticentroListEdits((prev) => {
                                                    const next = { ...prev };
                                                    if (horario.id != null) delete next[horario.id];
                                                    return next;
                                                  });
                                                  showToast('success', 'Turnos importados desde cuadrante correctamente');
                                                }
                                              }
                                            } else {
                                              showToast('warning', data.message || 'No se encontró cuadrante para estos datos');
                                            }
                                          } catch (error) {
                                            console.error('Error importing turnos from cuadrante:', error);
                                            showToast('error', `Error al importar turnos: ${error.message}`);
                                          }
                                        }}
                                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                                        title="Tomar turnos del cuadrante"
                                      >
                                        📥
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Buton Import Excel */}
            <div className="flex justify-end gap-3 mb-6 border-t pt-6">
              <input
                id="excel-upload-horario-multicentro"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUploadMulticentro}
                disabled={uploadingExcelMulticentro}
              />
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={uploadingExcelMulticentro}
                loading={uploadingExcelMulticentro}
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                onClick={() => {
                  const fileInput = document.getElementById('excel-upload-horario-multicentro');
                  if (fileInput && !uploadingExcelMulticentro) {
                    fileInput.click();
                  }
                }}
              >
                {uploadingExcelMulticentro ? 'Cargando...' : '📥 Importar Horario Multicentro desde Excel'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'preview' && cuadrantePreview.length > 0 && (
          <div className="space-y-6">
            {/* Avertizare pentru luna existentă */}
            {lunaExistenta && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-600 text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h3 className="text-yellow-800 font-bold text-lg mb-2">
                      ¡Atención! El mes {MONTHS[selectedMonth]} {selectedYear} ya está guardado en el sistema.
                    </h3>
                    <p className="text-yellow-700 mb-3">
                      Si guardas de nuevo, sobrescribirás los datos existentes.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setShowExistentPreview(!showExistentPreview)}
                        variant="secondary"
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        {showExistentPreview ? 'Ocultar' : 'Ver'} cuadrantes existentes
                      </Button>
                      <Button
                        onClick={() => {
                          if (confirm('¿Seguro que quieres sobrescribir los cuadrantes existentes? Esta acción no se puede deshacer.')) {
                            handleSalveaza();
                          }
                        }}
                        variant="primary"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Sobrescribir cuadrantes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview pentru cuadrantele existente */}
            {lunaExistenta && showExistentPreview && cuadranteExistente.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-yellow-800 mb-4">
                  Cuadrantes existentes en el sistema - {MONTHS[selectedMonth]} {selectedYear}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 bg-yellow-50 text-yellow-800 font-bold p-3">Nombre</th>
                        {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => {
                          const dayNumber = i + 1;
                          const date = new Date(selectedYear, selectedMonth, dayNumber);
                          const dayOfWeek = date.getDay();
                          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                          
                          return (
                            <th key={i + 1} className="border border-gray-300 bg-yellow-50 text-yellow-800 font-bold p-1 text-center min-w-[60px]">
                              <div className="space-y-1">
                                <div className="text-yellow-800">{dayNumber}</div>
                                <div className={`text-xs font-normal ${
                                  dayOfWeek === 0 || dayOfWeek === 6 ? 'text-red-600' : 'text-yellow-700'
                                }`}>
                                  {dayNames[dayOfWeek]}
                                </div>
                              </div>
                          </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {cuadranteExistente
                        .filter(c => {
                          const emailMatch = cuadrantePreview.some(cp => 
                            (cp.EMAIL || '').trim().toLowerCase() === (c.EMAIL || '').trim().toLowerCase()
                          );
                          const lunaKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                          let lunaMatch = false;
                          const lunaDinDB = c.LUNA;
                          if (lunaDinDB) {
                            if (typeof lunaDinDB === 'number') {
                              const date = new Date((lunaDinDB - 25569) * 86400 * 1000);
                              const lunaDinDBString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                              lunaMatch = lunaDinDBString === lunaKey;
                            } else {
                              lunaMatch = lunaDinDB.toString() === lunaKey;
                            }
                          }
                          return emailMatch && lunaMatch;
                        })
                        .map((row, idx) => {
                          const zile = [];
                          for (let zi = 1; zi <= getDaysInMonth(selectedMonth, selectedYear); zi++) {
                            zile.push(row[`ZI_${zi}`] || '');
                          }
                          return (
                            <tr key={row.NOMBRE || row.EMAIL || idx}>
                              <td className="border border-gray-300 p-3 font-medium">
                                {row.NOMBRE || row.EMAIL}
                              </td>
                              {zile.map((z, i) => (
                                <td key={i} className="border border-gray-300 p-2 text-center text-sm">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    z === 'LIBRE' 
                                      ? 'bg-gray-100 text-gray-600' 
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {z}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-600">
                Preview - {MONTHS[selectedMonth]} {selectedYear} - {selectedCentro}
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setActiveTab('generar')}
                  variant="secondary"
                  size="sm"
                >
                  ← Atrás
                </Button>
                <Button
                  onClick={handleSalveaza}
                  variant="primary"
                  size="sm"
                  disabled={loading}
                  loading={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Se está guardando...' : '💾 Guardar Mes'}
                </Button>
                <Button
                  onClick={handleGenerarAn}
                  variant="primary"
                  size="sm"
                  disabled={loading}
                  loading={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Se está generando...' : '📅 Generar Todo el Año'}
                </Button>
              </div>
            </div>

            {/* Tabel preview */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-red-50 text-red-600 font-bold p-3">Nombre</th>
                    {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => {
                      const dayNumber = i + 1;
                      const date = new Date(selectedYear, selectedMonth, dayNumber);
                      const dayOfWeek = date.getDay();
                      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                      
                      return (
                        <th key={i + 1} className="border border-gray-300 bg-red-50 text-red-600 font-bold p-1 text-center min-w-[60px]">
                          <div className="space-y-1">
                            <div className="text-red-600">{dayNumber}</div>
                            <div className={`text-xs font-normal ${
                              dayOfWeek === 0 || dayOfWeek === 6 ? 'text-red-600' : 'text-red-500'
                            }`}>
                              {dayNames[dayOfWeek]}
                            </div>
                          </div>
                      </th>
                      );
                    })}
                    <th className="border border-gray-300 bg-blue-50 text-blue-600 font-bold p-3 text-center">
                      ⏱️ Total Horas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cuadrantePreview.map((row, idx) => {
                    // Calculează totalul de ore pentru fiecare angajat
                    // Verifică dacă row.zile există și nu este gol
                    const zile = row.zile || [];
                    const totalHoras = zile.length > 0 ? zile.reduce((total, z) => {
                      if (z === 'LIBRE' || !z || z === '' || isCuadranteMarcaMulticentro(z)) return total;
                      
                      // Extrage orele din formatul "T1 19:30-07:30"
                      const match = z.match(/T\d+\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
                      if (match) {
                        const [, startHour, startMin, endHour, endMin] = match;
                        const start = parseInt(startHour) * 60 + parseInt(startMin);
                        let end = parseInt(endHour) * 60 + parseInt(endMin);
                        
                        // Dacă ora de sfârșit este mai mică decât cea de început, înseamnă că trece peste miezul nopții
                        if (end < start) {
                          end += 24 * 60; // Adaugă 24 de ore în minute
                        }
                        
                        const durationMinutes = end - start;
                        return total + durationMinutes / 60; // Convertește în ore
                      }
                      
                      return total;
                    }, 0) : 0;
                    
                    return (
                    <tr key={row.NOMBRE || idx}>
                      <td className="border border-gray-300 p-3 font-medium">
                        {row.NOMBRE}
                      </td>
                      {zile.map((z, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center text-sm">
                          <span 
                            className={`px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-50 transition-colors ${
                              z === 'LIBRE' 
                                ? 'bg-gray-100 text-gray-600' 
                                : 'bg-green-100 text-green-700'
                            }`}
                            onClick={() => handleCellClick(row.NOMBRE, i + 1, z, 'preview')}
                            title="Click para editar"
                          >
                            {z}
                            {row[`NOTA_${i + 1}`] && (
                              <div className="text-xs text-gray-500 mt-1">
                                📝 {row[`NOTA_${i + 1}`]}
                              </div>
                            )}
                          </span>
                        </td>
                      ))}
                        <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                          <span className={totalHoras > 164 ? "text-red-600" : "text-blue-600"}>
                            {totalHoras.toFixed(1)}h
                          </span>
                        </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preview pentru tot anul */}
            {cuadranteAn && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-red-600">
                    Vista Previa Cuadrantes Todo el Año {selectedYear}
                  </h3>
                  <Button
                    onClick={handleSalveazaAn}
                    variant="primary"
                    size="sm"
                    disabled={loading}
                    loading={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading ? 'Se está guardando...' : '💾 Guardar Todo el Año'}
                  </Button>
                </div>

                {/* Avertizare pentru lunile existente din an */}
                {luniExistentaAn.length > 0 && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-600 text-2xl">⚠️</span>
                      <div>
                        <h4 className="text-yellow-800 font-bold mb-2">
                          ¡Atención! Los siguientes meses ya están guardados en el sistema:
                        </h4>
                        <p className="text-yellow-700">
                          {luniExistentaAn.map(luna => MONTHS[luna]).join(', ')}
                        </p>
                        <p className="text-yellow-700 mt-2">
                          Si guardas todo el año, sobrescribirás los datos existentes para estos meses.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selector de meses */}
                <div className="flex gap-2 flex-wrap">
                  {MONTHS.map((m, idx) => {
                    const isExistenta = luniExistentaAn.includes(idx);
                    return (
                      <button 
                        key={m} 
                        onClick={() => setLunaPreview(idx)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
                          lunaPreview === idx
                            ? 'bg-red-600 text-white'
                            : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
                        } ${isExistenta ? 'border-2 border-yellow-500' : ''}`}
                      >
                        {m}
                        {isExistenta && (
                          <span className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                            !
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tabla para el mes seleccionado */}
                <div className="overflow-x-auto">
                  <h4 className="text-lg font-bold text-red-600 mb-4">
                    Mes: {MONTHS[lunaPreview]}
                  </h4>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 bg-red-50 text-red-600 font-bold p-3">Nombre</th>
                        {cuadranteAn[lunaPreview] && Array.from({ length: getDaysInMonth(lunaPreview, selectedYear) }, (_, i) => {
                          const dayNumber = i + 1;
                          const date = new Date(selectedYear, lunaPreview, dayNumber);
                          const dayOfWeek = date.getDay();
                          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                          
                          return (
                            <th key={i + 1} className="border border-gray-300 bg-red-50 text-red-600 font-bold p-1 text-center min-w-[60px]">
                              <div className="space-y-1">
                                <div className="text-red-600">{dayNumber}</div>
                                <div className={`text-xs font-normal ${
                                  dayOfWeek === 0 || dayOfWeek === 6 ? 'text-red-600' : 'text-red-500'
                                }`}>
                                  {dayNames[dayOfWeek]}
                                </div>
                              </div>
                          </th>
                          );
                        })}
                        <th className="border border-gray-300 bg-blue-50 text-blue-600 font-bold p-3 text-center">
                          ⏱️ Total Horas
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadranteAn[lunaPreview] && cuadranteAn[lunaPreview].map((row, idx) => {
                        // Calculează totalul de ore pentru fiecare angajat
                        const totalHoras = row.zile.reduce((total, z) => {
                          if (z === 'LIBRE' || !z || z === '' || isCuadranteMarcaMulticentro(z)) return total;
                          
                          // Extrage orele din formatul "T1 19:30-07:30"
                          const match = z.match(/T\d+\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
                          if (match) {
                            const [, startHour, startMin, endHour, endMin] = match;
                            const start = parseInt(startHour) * 60 + parseInt(startMin);
                            let end = parseInt(endHour) * 60 + parseInt(endMin);
                            
                            // Dacă ora de sfârșit este mai mică decât cea de început, înseamnă că trece peste miezul nopții
                            if (end < start) {
                              end += 24 * 60; // Adaugă 24 de ore în minute
                            }
                            
                            const durationMinutes = end - start;
                            return total + durationMinutes / 60; // Convertește în ore
                          }
                          
                          return total;
                        }, 0);
                        
                        return (
                        <tr key={row.NOMBRE || idx}>
                          <td className="border border-gray-300 p-3 font-medium">
                            {row.NOMBRE}
                          </td>
                          {row.zile.map((z, i) => (
                            <td key={i} className="border border-gray-300 p-2 text-center text-sm">
                              <span 
                                className={`px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-50 transition-colors ${
                                  z === 'LIBRE' 
                                    ? 'bg-gray-100 text-gray-600' 
                                    : 'bg-green-100 text-green-700'
                                }`}
                                onClick={() => handleCellClick(row.NOMBRE, i + 1, z, 'annual')}
                                title="Click para editar"
                              >
                                {z}
                                {row[`NOTA_${i + 1}`] && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    📝 {row[`NOTA_${i + 1}`]}
                                  </div>
                                )}
                              </span>
                            </td>
                          ))}
                            <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                              <span className={totalHoras > 164 ? "text-red-600" : "text-blue-600"}>
                                {totalHoras.toFixed(1)}h
                              </span>
                            </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Indicador de progreso */}
            {progress.total > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    {progress.message}
                  </span>
                  <span className="text-sm text-blue-600">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modal para editar */}
      {showEditModal && selectedCell && !editingDay && !editingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-4">
              Editar Día {selectedCell?.day} - {selectedCell?.employee}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="edit-dia-turno"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Turno:
                </label>
                <select 
                  id="edit-dia-turno"
                  name="editDiaTurno"
                  value={editValue} 
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {(() => {
                    // Extrage toate turele unice din întregul cuadrant (toți angajații)
                    const allShifts = new Set();
                    
                    cuadrantePreview.forEach(employee => {
                      if (employee.zile) {
                        employee.zile.forEach(shift => {
                          if (shift && shift.trim() !== '') {
                            allShifts.add(shift);
                          }
                        });
                      }
                    });
                    
                    // Adaugă LIBRE întotdeauna
                    allShifts.add('LIBRE');
                    
                    // Generează opțiunile cu toate turele din cuadrant
                    const options = [];
                    
                    // Sortează turele pentru a avea LIBRE primul, apoi celelalte
                    const sortedShifts = Array.from(allShifts).sort((a, b) => {
                      if (a === 'LIBRE') return -1;
                      if (b === 'LIBRE') return 1;
                      return a.localeCompare(b);
                    });
                    
                    sortedShifts.forEach((shift, index) => {
                      options.push(<option key={`shift_${index}`} value={shift}>{shift}</option>);
                    });
                    
                    return options;
                  })()}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <Button
                onClick={handleCancelEdit}
                variant="secondary"
                size="sm"
              >
                Cancelar
              </Button>
              
              <Button
                onClick={handleSaveEdit}
                variant="primary"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru editarea orarului */}
      {showEditModal && editingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-red-600">
                  Editar Horario: {editingSchedule.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <ScheduleEditor
                centros={horariosCentros}
                grupos={horariosGrupos}
                callApi={callApi}
                initialData={editingSchedule}
                isEditMode={true}
                onSave={(schedule) => {
                  console.log('✅ Horario actualizado:', schedule);
                  alert('Horario actualizado con éxito!');
                  setShowEditModal(false);
                  setEditingSchedule(null);
                  // Reîncarcă lista
                  const fetchHorariosList = async () => {
                    try {
                      const res = await import('../api/schedules');
                      const { listSchedules } = res;
                      const r = await listSchedules(callApi);
                      if (r.success) {
                        setHorariosLista(Array.isArray(r.data) ? r.data : []);
                      }
                    // eslint-disable-next-line no-unused-vars
                    } catch (_e) {
                      console.warn('No se pudo conectar con el servidor');
                    }
                  };
                  fetchHorariosList();
                }}
                onError={(error) => {
                  console.error('❌ Error al actualizar horario:', error);
                  alert(`Error al actualizar horario: ${error}`);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru editarea zilelor */}
      {showEditModal && editingDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Editar Día {editingDay.dayNumber} - {editingDay.empleado}
            </h3>
            
            <div className="mb-4">
              <label
                htmlFor="edit-cuadrante-turno"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Turno:
              </label>
              <select
                id="edit-cuadrante-turno"
                name="editCuadranteTurno"
                value={editingDay.currentValue}
                onChange={(e) => setEditingDay(prev => ({ ...prev, currentValue: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {availableShifts.map((shift, index) => (
                  <option key={index} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label
                htmlFor="edit-cuadrante-empleado"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Asignar a otro empleado (opcional - puedes escribir o seleccionar):
              </label>
              <div className="relative">
                <input
                  id="edit-cuadrante-empleado"
                  type="text"
                  value={empleadoForDaySearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmpleadoForDaySearch(value);
                    setShowEmpleadoForDayDropdown(true);
                    
                    // Dacă utilizatorul șterge textul, resetează și codigo-ul
                    if (!value) {
                      setSelectedEmpleadoForDay('');
                    }
                  }}
                  onFocus={() => setShowEmpleadoForDayDropdown(true)}
                  onBlur={() => {
                    // Delay pentru a permite click-ul pe dropdown
                    setTimeout(() => setShowEmpleadoForDayDropdown(false), 200);
                  }}
                  placeholder={editingDay ? `Mantener en ${editingDay.empleado} o escribir para buscar...` : 'Escribir para buscar empleado...'}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                
                {/* Dropdown cu sugestii */}
                {showEmpleadoForDayDropdown && empleadoForDaySearch && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {(() => {
                      const searchLower = empleadoForDaySearch.toLowerCase();
                      // Folosește lista completă de angajați (angajati) sau fallback la angajatiFiltrati dacă lista completă este goală
                      const listaCompleta = angajati.length > 0 ? angajati : angajatiFiltrati;
                      const filtered = listaCompleta.filter(emp => {
                        // Exclude angajatul curent (CODIGO poate fi număr în API, string în modal)
                        if (String(emp.CODIGO ?? '').trim() === String(editingDay.codigo ?? '').trim()) return false;
                        
                        const nombre = (emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || emp.nombre || '').toLowerCase();
                        const codigo = (emp.CODIGO || '').toLowerCase();
                        return nombre.includes(searchLower) || codigo.includes(searchLower);
                      });
                      
                      if (filtered.length === 0) {
                        return (
                          <div className="px-4 py-3 text-gray-500 text-sm">
                            No se encontraron empleados
                          </div>
                        );
                      }
                      
                      return (
                        <div>
                          {filtered.slice(0, 20).map((emp) => {
                            const nombre = emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || emp.nombre || 'Sin nombre';
                            const codigo = emp.CODIGO || '';
                            return (
                              <button
                                key={codigo}
                                type="button"
                                onClick={() => {
                                  setEmpleadoForDaySearch(`${nombre} - ${codigo}`);
                                  setSelectedEmpleadoForDay(String(emp.CODIGO ?? '').trim());
                                  setShowEmpleadoForDayDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <div className="font-medium text-gray-900">{nombre}</div>
                                <div className="text-sm text-gray-600">{codigo}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {/* Opțiune pentru a șterge selecția */}
                {empleadoForDaySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmpleadoForDaySearch('');
                      setSelectedEmpleadoForDay('');
                      setShowEmpleadoForDayDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              {selectedEmpleadoForDay && (
                <p className="mt-2 text-sm text-blue-600">
                  ℹ️ Se creará un horario multicentro para el empleado seleccionado
                </p>
              )}
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDay(null);
                  setSelectedEmpleadoForDay('');
                  setEmpleadoForDaySearch('');
                  setShowEmpleadoForDayDropdown(false);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveDayEdit(editingDay.currentValue)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Componenta de Notificări Moderne */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Modal Preview Excel Cuadrantes */}
      {showExcelPreviewModal && excelPreviewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExcelPreviewModal(false);
              setExcelPreviewData(null);
              setSelectedForHorarioMulticentro(new Set());
              setSelectedForRescriere(new Set());
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de Cuadrantes desde Excel
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los cuadrantes importados antes de confirmar la subida
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {excelPreviewData.cuadrantes?.length || 0} cuadrantes procesados
                  </p>
                  <p className="text-xs text-gray-600 mt-1 font-medium">
                    📅 Mes: {MONTHS[selectedMonth]} {selectedYear} | Centro: {selectedCentro || 'N/A'}
                    {excelPreviewData.excelFormatUsed ? (
                      <span className="ml-2 text-indigo-700">
                        | Formato:{' '}
                        {{
                          turno_horas_tabla: 'Tabla Turno/Horas',
                          he_hs: 'M/T + HE/HS',
                          celdas_multilinea: 'Multilínea',
                        }[excelPreviewData.excelFormatUsed] || excelPreviewData.excelFormatUsed}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2 max-w-3xl">
                    <strong>Un campo por día en el sistema:</strong> la columna <strong>Turno</strong> es lo que se guarda (puede incluir varios tramos con <code className="bg-white px-0.5 rounded"> / </code>).
                    Si el Excel tiene <strong>dos pares Turno+Horas por día</strong> (o cabecera <strong>HE, HS, HE, HS</strong> por día), el import los une en un solo valor por día.
                    <strong> Horas</strong> es la suma calculada de ese texto (no son dos celdas independientes en la base de datos).
                    <span className="block mt-1">
                      <strong>Celdas unidas (nombre):</strong> si <strong>Nombre / TRABAJADOR</strong> queda vacío en filas con turno <strong>M</strong> o <strong>T</strong>, el import reutiliza el empleado de la fila anterior (típico en Excel con celdas fusionadas).
                    </span>
                    <span className="block mt-1">
                      <strong>Fila HS sin M/T:</strong> si la columna <strong>TURNO</strong> está vacía en la fila de <strong>HS</strong> (después de una fila con <strong>M</strong> o <strong>T</strong>), se asigna a la misma banda mañana/tarde (plantilla Bosquepino).
                    </span>
                    <span className="block mt-1">
                      <strong>Castillo Oropesa (bloque tarde sin M/T):</strong> cuando ya hay un par <strong>HE+HS</strong> en mañana, las filas siguientes con <strong>TURNO</strong> vacío y <strong>HE/HS</strong> se tratan como <strong>tarde</strong> hasta que aparezca <strong>T</strong> explícito (no se mezclan con M).
                    </span>
                    <span className="block mt-1">
                      <strong>Turno compartido (2+2 HE/HS):</strong> si en la misma banda <strong>M</strong> o <strong>T</strong> hay <strong>varias filas HE</strong> y el mismo número de <strong>HS</strong>, se leen <strong>todas las parejas</strong> y se guardan en un solo día separadas por <strong> / </strong> (ej. mañana + tarde + noche en columnas del mismo día). Bosquepino sigue siendo <strong>una pareja</strong> por banda.
                    </span>
                    <span className="block mt-1">
                      <strong>Celdas unidas (horas):</strong> si la fila <strong>HS</strong> está vacía: (1) si <strong>HE</strong> trae un rango o dos horas en texto, se usan; (2) si solo hay <strong>una</strong> hora de entrada y hay dos filas M/T (HE+HS), se asume salida <strong>+8 h</strong> para formar el intervalo guardado.
                    </span>
                  </p>
                </div>
                <button
                onClick={() => {
                  setShowExcelPreviewModal(false);
                  setExcelPreviewData(null);
                  setSelectedForHorarioMulticentro(new Set());
                  setSelectedForRescriere(new Set());
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {excelPreviewData.cuadrantes && excelPreviewData.cuadrantes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left border border-gray-200" rowSpan={2}>Nombre</th>
                        <th className="px-3 py-2 text-left border border-gray-200" rowSpan={2}>Código</th>
                        <th className="px-3 py-2 text-left border border-gray-200" rowSpan={2}>Email</th>
                        <th className="px-3 py-2 text-left border border-gray-200" rowSpan={2}>Centro</th>
                        <th className="px-3 py-2 text-center border border-gray-200" rowSpan={2}>Estado</th>
                        <th className="px-3 py-2 text-center border border-gray-200" rowSpan={2} title="Indica si ya existe cuadrante o horario_multicentro">
                          📊 Ya existe
                        </th>
                        <th className="px-3 py-2 text-center border border-gray-200 bg-blue-50" rowSpan={2} title="Guardar en Horario Multicentro">
                          📋 Multicentro
                        </th>
                        {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => {
                          const dayNumber = i + 1;
                          const date = new Date(selectedYear, selectedMonth, dayNumber);
                          const dayOfWeek = date.getDay();
                          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                          
                          return (
                            <th 
                              key={i + 1} 
                              className="px-1 py-2 text-center border border-gray-200 min-w-[80px]"
                              colSpan={2}
                              title={`${dayNumber} ${dayNames[dayOfWeek]}`}
                            >
                              <div className="space-y-0.5">
                                <div className="text-xs font-bold">{dayNumber}</div>
                                <div className={`text-xs ${dayOfWeek === 0 || dayOfWeek === 6 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {dayNames[dayOfWeek]}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                        <th className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold" rowSpan={2}>Total</th>
                      </tr>
                      <tr>
                        {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => (
                          <React.Fragment key={`day-header-${i}`}>
                            <th className="px-1 py-1 text-center border border-gray-200 bg-gray-100 text-xs font-medium">
                              Turno
                            </th>
                            <th className="px-1 py-1 text-center border border-gray-200 bg-gray-100 text-xs font-medium">
                              Horas
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreviewData.cuadrantes.map((cuadrante, idx) => {
                        const zile = [];
                        const horas = [];
                        let totalHoras = 0;
                        
                        /**
                         * Ore pentru preview: un singur ZI_* poate fi "T1 08:00-14:00 / T3 23:00-06:00"
                         * → sumăm fiecare parte (aliniat cu backend horasFromZiCellValue).
                         */
                        const previewHorasFromZiPart = (partRaw) => {
                          const part = String(partRaw ?? '').trim();
                          if (!part || part === 'LIBRE') return 0;
                          if (isCuadranteMarcaMulticentro(part)) return 0;
                          const tOre = transformaZiValueInOre(part);
                          if (tOre != null) {
                            const n = parseFloat(String(tOre).replace(',', '.'));
                            return !isNaN(n) && n > 0 ? n : 0;
                          }
                          const tm = part.match(/^T[123]\s+(\d+(?:[.,]\d+)?)\s*h?$/i);
                          if (tm) {
                            const n = parseFloat(tm[1].replace(',', '.'));
                            return !isNaN(n) && n > 0 ? n : 8;
                          }
                          const solo = part.match(/^(\d+(?:[.,]\d+)?)\s*h?$/i);
                          if (solo) {
                            const n = parseFloat(solo[1].replace(',', '.'));
                            return !isNaN(n) && n > 0 ? n : 0;
                          }
                          if (/^T[123]$/i.test(part)) return 8;
                          const timeMatch = part.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
                          if (timeMatch) {
                            const startHour = parseInt(timeMatch[1], 10);
                            const startMin = parseInt(timeMatch[2], 10);
                            const endHour = parseInt(timeMatch[3], 10);
                            const endMin = parseInt(timeMatch[4], 10);
                            let startMinutes = startHour * 60 + startMin;
                            let endMinutes = endHour * 60 + endMin;
                            if (endMinutes < startMinutes) endMinutes += 24 * 60;
                            return (endMinutes - startMinutes) / 60;
                          }
                          return 0;
                        };

                        const previewHorasFromZi = (turno) => {
                          if (!turno || turno === '' || turno === null || turno === 'LIBRE') {
                            return 0;
                          }
                          const s = String(turno).trim();
                          if (s.includes(' / ')) {
                            return s
                              .split(' / ')
                              .reduce((acc, p) => acc + previewHorasFromZiPart(p.trim()), 0);
                          }
                          return previewHorasFromZiPart(s);
                        };

                        for (let i = 1; i <= getDaysInMonth(selectedMonth, selectedYear); i++) {
                          const turno = cuadrante[`ZI_${i}`] || '';
                          zile.push(turno);

                          const horasDia = previewHorasFromZi(turno);
                          horas.push(horasDia);
                          totalHoras += horasDia;
                        }
                        
                        return (
                          <tr 
                            key={idx} 
                            className={`border-b border-gray-100 ${
                              !cuadrante.empleado_encontrado ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-3 py-2 border border-gray-200 font-medium">
                              {cuadrante.NOMBRE || 'N/A'}
                            </td>
                            <td className="px-3 py-2 border border-gray-200">
                              {cuadrante.CODIGO ? (
                                <span className={!cuadrante.empleado_encontrado ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                                  {cuadrante.CODIGO}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-sm">
                              {cuadrante.EMAIL ? (
                                <span className="text-gray-700">{cuadrante.EMAIL}</span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-sm">
                              {cuadrante.CENTRO ? (
                                <span className="text-gray-700">{cuadrante.CENTRO}</span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center">
                              {cuadrante.empleado_encontrado ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  ✅ {cuadrante.confianza ? `${cuadrante.confianza}%` : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  ⚠️ {cuadrante.confianza ? `${cuadrante.confianza}%` : 'No encontrado'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center">
                              {cuadrante.yaExiste ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800" title={`Ya existe: ${cuadrante.tipoExistente?.join(', ') || 'Cuadrante'}`}>
                                    ⚠️ Ya existe {cuadrante.tipoExistente?.length > 0 ? `(${cuadrante.tipoExistente.join(', ')})` : ''}
                                  </span>
                                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={selectedForRescriere.has(cuadrante.CODIGO || cuadrante.EMAIL || idx)}
                                      onChange={(e) => {
                                        const key = cuadrante.CODIGO || cuadrante.EMAIL || idx;
                                        setSelectedForRescriere(prev => {
                                          const newSet = new Set(prev);
                                          if (e.target.checked) {
                                            newSet.add(key);
                                          } else {
                                            newSet.delete(key);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-gray-700">Rescribir</span>
                                  </label>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                  ➕ Nuevo
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center bg-blue-50">
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedForHorarioMulticentro.has(cuadrante.CODIGO || cuadrante.EMAIL || idx)}
                                  onChange={(e) => {
                                    const key = cuadrante.CODIGO || cuadrante.EMAIL || idx;
                                    setSelectedForHorarioMulticentro(prev => {
                                      const newSet = new Set(prev);
                                      if (e.target.checked) {
                                        newSet.add(key);
                                      } else {
                                        newSet.delete(key);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  title="Marcar para guardar en Horario Multicentro"
                                />
                              </label>
                            </td>
                            {zile.map((z, i) => (
                              <React.Fragment key={`day-${idx}-${i}`}>
                                <td 
                                  className="px-1 py-2 text-center border border-gray-200 text-xs align-top max-w-[140px]"
                                >
                                  {z && z !== '' && z !== null ? (
                                    <span 
                                      className={`inline-block px-1 py-0.5 rounded text-left whitespace-pre-wrap break-words ${
                                        z === 'LIBRE' 
                                          ? 'bg-gray-100 text-gray-700' 
                                          : 'bg-blue-100 text-blue-700'
                                      }`}
                                      title={String(z).length > 40 ? String(z) : undefined}
                                    >
                                      {z}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td 
                                  className="px-1 py-2 text-center border border-gray-200 text-xs font-medium"
                                >
                                  {horas[i] > 0 ? (
                                    <span className="text-gray-700">{horas[i].toFixed(1)}h</span>
                                  ) : (
                                    <span className="text-gray-300">0h</span>
                                  )}
                                </td>
                              </React.Fragment>
                            ))}
                            <td className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold text-blue-700">
                              {totalHoras.toFixed(1)}h
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No hay cuadrantes para mostrar</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExcelPreviewModal(false);
                  setExcelPreviewData(null);
                  setSelectedForHorarioMulticentro(new Set());
                  setSelectedForRescriere(new Set());
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!excelPreviewData.cuadrantes || excelPreviewData.cuadrantes.length === 0) {
                    showToast('warning', 'No hay cuadrantes para guardar');
                    return;
                  }

                  setSavingExcel(true);
                  try {
                    const token = localStorage.getItem('auth_token');
                    const mesAno = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                    
                    // Filtrează cuadrantesle existente care nu au checkbox-ul de rescriere bifat
                    const cuadrantesParaGuardar = excelPreviewData.cuadrantes.filter(c => {
                      const key = c.CODIGO || c.EMAIL || excelPreviewData.cuadrantes.indexOf(c);
                      // Dacă există deja și nu are checkbox-ul de rescriere bifat, sări peste
                      if (c.yaExiste && !selectedForRescriere.has(key)) {
                        return false;
                      }
                      return true;
                    });
                    
                    if (cuadrantesParaGuardar.length === 0) {
                      showToast('info', 'No hay cuadrantes para guardar (todos los existentes fueron excluidos)');
                      setSavingExcel(false);
                      return;
                    }
                    
                    // Separăm cuadrantes normale de cele pentru horario_multicentro
                    const cuadrantesNormales = cuadrantesParaGuardar.filter(c => {
                      const key = c.CODIGO || c.EMAIL || cuadrantesParaGuardar.indexOf(c);
                      return !selectedForHorarioMulticentro.has(key);
                    });
                    
                    const cuadrantesMulticentro = cuadrantesParaGuardar.filter(c => {
                      const key = c.CODIGO || c.EMAIL || cuadrantesParaGuardar.indexOf(c);
                      return selectedForHorarioMulticentro.has(key);
                    });
                    
                    // Salvează cuadrantes normale
                    if (cuadrantesNormales.length > 0) {
                      const response = await fetch(routes.updateCuadrantes, {
                        method: 'POST',
                        headers: {
                          'Authorization': token ? `Bearer ${token}` : '',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          cuadrantes: cuadrantesNormales.map(c => ({
                            CODIGO: c.CODIGO,
                            EMAIL: c.EMAIL,
                            NOMBRE: c.NOMBRE,
                            LUNA: c.LUNA,
                            CENTRO: c.CENTRO,
                            ...Object.fromEntries(
                              Array.from({ length: 31 }, (_, i) => [
                                `ZI_${i + 1}`,
                                c[`ZI_${i + 1}`] || null
                              ])
                            ),
                            TotalHoras: c.TotalHoras || null,
                          })),
                          centro: selectedCentro,
                          mesAno: mesAno,
                        }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al guardar cuadrantes');
                      }
                    }
                    
                    // Salvează cuadrantes în horario_multicentro
                    if (cuadrantesMulticentro.length > 0) {
                      // Același comportament ca la editarea manuală a zilei: păstrăm **orarul complet** (ex. T1 07:30-15:00),
                      // nu îl reducem la ore. TotalHoras se recalculează din aceste string-uri (folosind transformaZiValueInOre doar pentru sumă).
                      const horariosMulticentro = cuadrantesMulticentro.map((c) => {
                        const ziPreserved = {};
                        for (let i = 1; i <= 31; i++) {
                          const ziKey = `ZI_${i}`;
                          const raw =
                            c[ziKey] ??
                            c[ziKey.toLowerCase()] ??
                            c[ziKey.toUpperCase()] ??
                            null;
                          if (
                            raw == null ||
                            raw === '' ||
                            String(raw).trim() === '' ||
                            String(raw).trim().toUpperCase() === 'LIBRE'
                          ) {
                            ziPreserved[ziKey] = null;
                            continue;
                          }
                          ziPreserved[ziKey] = String(raw).trim();
                        }
                        let totalSum = 0;
                        for (let i = 1; i <= 31; i++) {
                          const ziKey = `ZI_${i}`;
                          const cell = ziPreserved[ziKey];
                          if (!cell) continue;
                          const oreStr = transformaZiValueInOre(cell);
                          if (oreStr) {
                            const n = parseFloat(oreStr);
                            if (!isNaN(n)) totalSum += n;
                          }
                        }
                        return {
                          CODIGO: c.CODIGO,
                          EMAIL: c.EMAIL,
                          NOMBRE: c.NOMBRE,
                          LUNA: c.LUNA || mesAno,
                          CLIENTE: c.CENTRO || selectedCentro || 'N/A',
                          HORARIO: 'MULTICENTRO',
                          SERVICIO: 'MULTICENTRO',
                          ...ziPreserved,
                          TotalHoras:
                            totalSum > 0 ? totalSum.toFixed(1) : c.TotalHoras || null,
                        };
                      });
                      
                      const responseMulticentro = await fetch(routes.saveHorariosMulticentro, {
                        method: 'POST',
                        headers: {
                          'Authorization': token ? `Bearer ${token}` : '',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          horarios: horariosMulticentro,
                        }),
                      });

                      if (!responseMulticentro.ok) {
                        const errorData = await responseMulticentro.json();
                        throw new Error(errorData.message || 'Error al guardar horarios multicentro');
                      }
                    }

                    const mensaje = [];
                    if (cuadrantesNormales.length > 0) {
                      mensaje.push(`${cuadrantesNormales.length} cuadrante${cuadrantesNormales.length !== 1 ? 's' : ''} normal${cuadrantesNormales.length !== 1 ? 'es' : ''}`);
                    }
                    if (cuadrantesMulticentro.length > 0) {
                      mensaje.push(`${cuadrantesMulticentro.length} horario${cuadrantesMulticentro.length !== 1 ? 's' : ''} multicentro`);
                    }
                    
                    showToast('success', `✅ ${mensaje.join(' y ')} guardados correctamente`);
                    setShowExcelPreviewModal(false);
                    setExcelPreviewData(null);
                    setSelectedForHorarioMulticentro(new Set());
                    setSelectedForRescriere(new Set());
                    
                    // Recărcăm lista de cuadrantes - doar dacă suntem pe tab-ul "lista"
                    if (activeTab === 'lista') {
                      // Re-trigger load pentru lista
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error('Error saving cuadrantes:', err);
                    showToast('error', err.message || 'Error al guardar cuadrantes');
                  } finally {
                    setSavingExcel(false);
                  }
                }}
                disabled={savingExcel || !excelPreviewData.cuadrantes || excelPreviewData.cuadrantes.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingExcel ? 'Guardando...' : (() => {
                  const cuadrantesParaGuardar = excelPreviewData.cuadrantes.filter(c => {
                    const key = c.CODIGO || c.EMAIL || excelPreviewData.cuadrantes.indexOf(c);
                    if (c.yaExiste && !selectedForRescriere.has(key)) {
                      return false;
                    }
                    return true;
                  });
                  return `✅ Confirmar y Guardar (${cuadrantesParaGuardar.length}${cuadrantesParaGuardar.length !== excelPreviewData.cuadrantes.length ? ` de ${excelPreviewData.cuadrantes.length}` : ''})`;
                })()}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Preview Excel Horario Multicentro */}
      {showExcelPreviewModalMulticentro && excelPreviewDataMulticentro && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExcelPreviewModalMulticentro(false);
              setExcelPreviewDataMulticentro(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[95vh] flex flex-col"
            style={{ width: '95vw', height: '95vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de Horarios Multicentro desde Excel
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los horarios importados antes de confirmar la subida
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {excelPreviewDataMulticentro.horarios?.length || 0} horarios procesados
                  </p>
                  {excelPreviewDataMulticentro.horarios && excelPreviewDataMulticentro.horarios.length > 0 && (
                    <>
                      <p className="text-xs text-gray-600 mt-1 font-medium">
                        📅 Mes: {excelPreviewDataMulticentro.horarios[0].LUNA || 'N/A'} | 
                        Empleado: {excelPreviewDataMulticentro.horarios[0].NOMBRE || 'N/A'}
                      </p>
                      {(() => {
                        const horariosCon0Horas = excelPreviewDataMulticentro.horarios.filter(h => {
                          let totalHoras = 0;
                          for (let i = 1; i <= 31; i++) {
                            const horasStr = h[`ZI_${i}`];
                            let horasNum = 0;
                            if (horasStr && horasStr !== '' && horasStr !== null) {
                              horasNum = parseFloat(String(horasStr));
                              if (isNaN(horasNum)) horasNum = 0;
                            }
                            totalHoras += horasNum;
                          }
                          return totalHoras === 0;
                        });
                        const horariosAFiltrar = excludeHorariosCon0Horas ? excelPreviewDataMulticentro.horarios.filter(h => {
                          let totalHoras = 0;
                          for (let i = 1; i <= 31; i++) {
                            const horasStr = h[`ZI_${i}`];
                            let horasNum = 0;
                            if (horasStr && horasStr !== '' && horasStr !== null) {
                              horasNum = parseFloat(String(horasStr));
                              if (isNaN(horasNum)) horasNum = 0;
                            }
                            totalHoras += horasNum;
                          }
                          return totalHoras > 0;
                        }) : excelPreviewDataMulticentro.horarios;
                        return (
                          <div className="mt-2 flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={excludeHorariosCon0Horas}
                                onChange={(e) => setExcludeHorariosCon0Horas(e.target.checked)}
                                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              />
                              <span className="text-xs text-gray-700 font-medium">
                                Excluir horarios con 0 horas ({horariosCon0Horas.length})
                              </span>
                            </label>
                            <span className="text-xs text-gray-500">
                              Se guardarán: {horariosAFiltrar.length} de {excelPreviewDataMulticentro.horarios.length}
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowExcelPreviewModalMulticentro(false);
                    setExcelPreviewDataMulticentro(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {excelPreviewDataMulticentro.horarios && excelPreviewDataMulticentro.horarios.length > 0 ? (() => {
                // Filtrează rândurile cu 0 ore dacă opțiunea este activată
                const horariosAFiltrar = excludeHorariosCon0Horas ? excelPreviewDataMulticentro.horarios.filter(h => {
                  let totalHoras = 0;
                  for (let i = 1; i <= 31; i++) {
                    const horasStr = h[`ZI_${i}`];
                    let horasNum = 0;
                    if (horasStr && horasStr !== '' && horasStr !== null) {
                      horasNum = parseFloat(String(horasStr));
                      if (isNaN(horasNum)) horasNum = 0;
                    }
                    totalHoras += horasNum;
                  }
                  return totalHoras > 0;
                }) : excelPreviewDataMulticentro.horarios;

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left border border-gray-200">Centro</th>
                          <th className="px-3 py-2 text-left border border-gray-200">Horario</th>
                          <th className="px-3 py-2 text-left border border-gray-200">Servicio</th>
                          <th className="px-3 py-2 text-left border border-gray-200">Estado</th>
                          {Array.from({ length: 31 }, (_, i) => {
                            const dayNumber = i + 1;
                            return (
                              <th 
                                key={`day-header-${i + 1}`} 
                                className="px-1 py-2 text-center border border-gray-200 min-w-[50px]"
                              >
                                {dayNumber}
                              </th>
                            );
                          })}
                          <th className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold">Total Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {horariosAFiltrar.map((horario, idx) => {
                        const horas = [];
                        let totalHoras = 0;

                        for (let i = 1; i <= 31; i++) {
                          const horasStr = horario[`ZI_${i}`];
                          let horasNum = 0;
                          if (horasStr && horasStr !== '' && horasStr !== null) {
                            horasNum = parseFloat(String(horasStr));
                            if (isNaN(horasNum)) horasNum = 0;
                          }
                          horas.push(horasNum);
                          totalHoras += horasNum;
                        }
                        
                        return (
                          <tr 
                            key={`horario-row-${idx}`} 
                            className={`border-b border-gray-100 ${
                              !horario.empleado_encontrado && !horario.cliente_encontrado ? 'bg-red-50' :
                              !horario.empleado_encontrado || !horario.cliente_encontrado ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-3 py-2 border border-gray-200 font-medium">
                              {horario.CLIENTE || 'N/A'}
                            </td>
                            <td className="px-3 py-2 border border-gray-200">
                              {horario.HORARIO || 'N/A'}
                            </td>
                            <td className="px-3 py-2 border border-gray-200">
                              {horario.SERVICIO || '-'}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center">
                              <div className="space-y-1">
                                {/* Estado Empleado */}
                                <div>
                                  {horario.empleado_encontrado ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800" title="Empleado">
                                      👤 {horario.confianza ? `${horario.confianza}%` : ''}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800" title="Empleado">
                                      👤 {horario.confianza ? `${horario.confianza}%` : 'No encontrado'}
                                    </span>
                                  )}
                                </div>
                                {/* Estado Cliente */}
                                <div>
                                  {horario.cliente_encontrado ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800" title="Cliente">
                                      🏢 {horario.cliente_confianza ? `${horario.cliente_confianza}%` : ''}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800" title="Cliente">
                                      🏢 {horario.cliente_confianza ? `${horario.cliente_confianza}%` : 'No encontrado'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            {horas.map((h, i) => (
                              <td 
                                key={`day-${idx}-${i}`} 
                                className="px-1 py-2 text-center border border-gray-200 text-xs font-medium"
                              >
                                {h > 0 ? (
                                  <span className="text-gray-700">{h}h</span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center border border-gray-200 bg-blue-50 font-bold text-blue-700">
                              {totalHoras > 0 ? `${totalHoras}h` : '0h'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Row de total general */}
                      {horariosAFiltrar && horariosAFiltrar.length > 0 && (() => {
                        let totalGeneral = 0;
                        const totalesPorDia = Array(31).fill(0);
                        
                        horariosAFiltrar.forEach((horario) => {
                          for (let i = 1; i <= 31; i++) {
                            const horasStr = horario[`ZI_${i}`];
                            let horasNum = 0;
                            if (horasStr && horasStr !== '' && horasStr !== null) {
                              horasNum = parseFloat(String(horasStr));
                              if (isNaN(horasNum)) horasNum = 0;
                            }
                            totalesPorDia[i - 1] += horasNum;
                            totalGeneral += horasNum;
                          }
                        });
                        
                        return (
                          <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                            <td colSpan={4} className="px-3 py-3 text-right border border-gray-300">
                              <span className="text-gray-800">TOTAL GENERAL:</span>
                            </td>
                            {totalesPorDia.map((totalDia, i) => (
                              <td 
                                key={`total-day-${i}`} 
                                className="px-1 py-3 text-center border border-gray-300 text-xs font-bold text-gray-800"
                              >
                                {totalDia > 0 ? `${totalDia}h` : '-'}
                              </td>
                            ))}
                            <td className="px-3 py-3 text-center border border-gray-300 bg-green-100 font-bold text-green-800 text-base">
                              {totalGeneral > 0 ? `${totalGeneral}h` : '0h'}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                );
              })() : (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron horarios en el Excel
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExcelPreviewModalMulticentro(false);
                  setExcelPreviewDataMulticentro(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!excelPreviewDataMulticentro.horarios || excelPreviewDataMulticentro.horarios.length === 0) {
                    showToast('warning', 'No hay horarios para guardar');
                    return;
                  }

                  // Filtrează rândurile cu 0 ore dacă opțiunea este activată
                  const horariosAFiltrar = excludeHorariosCon0Horas ? excelPreviewDataMulticentro.horarios.filter(h => {
                    let totalHoras = 0;
                    for (let i = 1; i <= 31; i++) {
                      const horasStr = h[`ZI_${i}`];
                      let horasNum = 0;
                      if (horasStr && horasStr !== '' && horasStr !== null) {
                        horasNum = parseFloat(String(horasStr));
                        if (isNaN(horasNum)) horasNum = 0;
                      }
                      totalHoras += horasNum;
                    }
                    return totalHoras > 0;
                  }) : excelPreviewDataMulticentro.horarios;

                  if (horariosAFiltrar.length === 0) {
                    showToast('warning', 'No hay horarios para guardar (todos tienen 0 horas)');
                    return;
                  }

                  setSavingExcelMulticentro(true);
                  try {
                    const token = localStorage.getItem('auth_token');
                    const response = await fetch(routes.saveHorariosMulticentro, {
                      method: 'POST',
                      headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        horarios: horariosAFiltrar.map(h => ({
                          CODIGO: h.CODIGO,
                          EMAIL: h.EMAIL,
                          NOMBRE: h.NOMBRE,
                          LUNA: h.LUNA,
                          CLIENTE: h.CLIENTE,
                          HORARIO: h.HORARIO,
                          SERVICIO: h.SERVICIO,
                          ...Object.fromEntries(
                            Array.from({ length: 31 }, (_, i) => [
                              `ZI_${i + 1}`,
                              h[`ZI_${i + 1}`] || null
                            ])
                          ),
                          TotalHoras: h.TotalHoras || null,
                        })),
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || 'Error al guardar horarios');
                    }

                    const result = await response.json();

                    const horariosExcluidos = excelPreviewDataMulticentro.horarios.length - horariosAFiltrar.length;
                    const mensaje = horariosExcluidos > 0 
                      ? `✅ ${result.updated || horariosAFiltrar.length} horarios guardados correctamente (${horariosExcluidos} excluidos con 0 horas)`
                      : `✅ ${result.updated || horariosAFiltrar.length} horarios guardados correctamente`;
                    showToast('success', mensaje);
                    setShowExcelPreviewModalMulticentro(false);
                    setExcelPreviewDataMulticentro(null);
                  } catch (err) {
                    console.error('Error saving horarios_multicentro:', err);
                    showToast('error', err.message || 'Error al guardar horarios');
                  } finally {
                    setSavingExcelMulticentro(false);
                  }
                }}
                disabled={savingExcelMulticentro || !excelPreviewDataMulticentro.horarios || excelPreviewDataMulticentro.horarios.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingExcelMulticentro ? 'Guardando...' : (() => {
                  const horariosAFiltrar = excludeHorariosCon0Horas ? excelPreviewDataMulticentro.horarios.filter(h => {
                    let totalHoras = 0;
                    for (let i = 1; i <= 31; i++) {
                      const horasStr = h[`ZI_${i}`];
                      let horasNum = 0;
                      if (horasStr && horasStr !== '' && horasStr !== null) {
                        horasNum = parseFloat(String(horasStr));
                        if (isNaN(horasNum)) horasNum = 0;
                      }
                      totalHoras += horasNum;
                    }
                    return totalHoras > 0;
                  }) : excelPreviewDataMulticentro.horarios;
                  return `✅ Confirmar y Guardar (${horariosAFiltrar.length}${excludeHorariosCon0Horas && excelPreviewDataMulticentro.horarios.length > horariosAFiltrar.length ? ` de ${excelPreviewDataMulticentro.horarios.length}` : ''})`;
                })()}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
} 