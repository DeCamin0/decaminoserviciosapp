import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import activityLogger from '../utils/activityLogger';
import { Button, Card, Input, Select, Modal } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes.js';
import ScheduleEditor from '../components/ScheduleEditor';
import Back3DButton from '../components/Back3DButton';
import { toMinutes } from '../types/schedule';
import { Loader2, RotateCcw, Pencil, Trash2, Plus } from 'lucide-react';

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
  
  console.log('CuadrantesPage rendering, authUser:', authUser);
  
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
  const [cuadrantesLista, setCuadrantesLista] = useState([]);
  const [error, setError] = useState('');

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
  const handleEditDay = (cuadranteIndex, dayNumber, currentValue) => {
    const cuadrante = cuadrantesLista[cuadranteIndex];
    if (!cuadrante) return;

    // Extraer turnurile unice din cuadrante
    const shifts = new Set();
    shifts.add('LIBRE'); // Adăugăm întotdeauna LIBRE
    
    for (let i = 1; i <= 31; i++) {
      const ziKey = `ZI_${i}`;
      const value = cuadrante[ziKey];
      if (value && value !== 'LIBRE' && value.trim() !== '') {
        shifts.add(value);
      }
    }

    // Convertir a array y ordenar
    const shiftsArray = Array.from(shifts).sort();
    
    setAvailableShifts(shiftsArray);
    setEditingDay({
      cuadranteIndex,
      dayNumber,
      currentValue: currentValue || '',
      empleado: cuadrante.NOMBRE || cuadrante.nombre || 'N/A'
    });
    setShowEditModal(true);
  };

  // Funcție pentru a salva modificarea din modal
  const handleSaveDayEdit = (newValue) => {
    if (!editingDay) return;
    
    const { cuadranteIndex, dayNumber } = editingDay;
    const cuadranteKey = `${cuadranteIndex}_${dayNumber}`;
    
    setEditedCuadrantes(prev => ({
      ...prev,
      [cuadranteKey]: newValue
    }));
    setHasChanges(true);
    setShowEditModal(false);
    setEditingDay(null);
  };

  // Funcție pentru a salva modificările
  const handleSaveChanges = async () => {
    try {
      setLoading(true);
      
      // Construir payload cu modificările și metadata completă
      const cuadrantesToSave = cuadrantesLista.map((cuadrante, index) => {
        const modifiedCuadrante = { ...cuadrante };
        
        // Aplicar modificările pentru acest cuadrante
        for (let day = 1; day <= 31; day++) {
          const key = `${index}_${day}`;
          if (editedCuadrantes[key] !== undefined) {
            modifiedCuadrante[`ZI_${day}`] = editedCuadrantes[key];
          }
        }
        
        // Asegurar que todos los campos necesarios están presentes
        return {
          ...modifiedCuadrante,
          CODIGO: modifiedCuadrante.CODIGO || '',
          NOMBRE: modifiedCuadrante.NOMBRE || modifiedCuadrante.nombre || '',
          EMAIL: modifiedCuadrante.EMAIL || modifiedCuadrante.email || '',
          CENTRO: modifiedCuadrante.CENTRO || selectedCentro || '',
          LUNA: modifiedCuadrante.LUNA || selectedMesAno || '',
          updated_at: new Date().toISOString(),
          updated_by: authUser?.email || authUser?.['CORREO ELECTRONICO'] || 'unknown'
        };
      });

      console.log('💾 Salvando modificările:', cuadrantesToSave);

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
  const [editedCuadrantes, setEditedCuadrantes] = useState({}); // Para trackear modificările
  const [hasChanges, setHasChanges] = useState(false); // Para afișa butonul de salvare
  const [showEditModal, setShowEditModal] = useState(false); // Para modal de editare
  const [editingDay, setEditingDay] = useState(null); // {cuadranteIndex, dayNumber, currentValue, empleado}
  const [availableShifts, setAvailableShifts] = useState([]); // Turnurile disponibile din cuadrante
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

  // Reset search term când se schimbă selectedCentro din altă parte
  useEffect(() => {
    if (selectedCentro && !centroSearchTerm && !centroSearchTermLista) {
      // Nu face nimic dacă search term-ul este deja gol
      return;
    }
    // Dacă selectedCentro se schimbă și nu este în search term, resetează search term-urile
    if (selectedCentro && centroSearchTerm && centroSearchTerm !== selectedCentro) {
      setCentroSearchTerm('');
    }
    if (selectedCentro && centroSearchTermLista && centroSearchTermLista !== selectedCentro) {
      setCentroSearchTermLista('');
    }
  }, [selectedCentro, centroSearchTerm, centroSearchTermLista]);
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
      console.log('🎭 DEMO mode: Skipping fetchClientes in CuadrantesPage');
      return;
    }

    try {
      console.log('📥 Fetching clientes from:', routes.getClientes);
      const response = await fetch(routes.getClientes);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Clientes data received:', data);
      
      const clientesData = Array.isArray(data) ? data : [];
      
      // Extrage numele clienților (NOMBRE O RAZON SOCIAL) și filtrează duplicates și invalide
      const clientesNombres = [...new Set(
        clientesData
          .map(c => c['NOMBRE O RAZON SOCIAL'] || '')
          .filter(nombre => nombre && nombre.trim() !== '' && nombre !== 'N/A')
      )].sort((a, b) => a.localeCompare(b, 'es'));
      
      console.log('📍 Clientes únicos cargados:', clientesNombres.length);
      console.log('📋 Lista clientes:', clientesNombres);
      
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
          if (activeTab === 'festivos') {
            console.log('📥 Festivos response from backend:', {
              url: festivosUrl,
              raw,
            });
          }
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
    [activeTab],
  );

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
      console.log('🔄 Enviando edición de festivo:', editUrl);
      
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
      } catch (parseError) {
        console.warn('Respuesta de festivo sin JSON:', text);
      }

      if (
        parsed &&
        Array.isArray(parsed) &&
        parsed[0] &&
        (parsed[0].success === true || parsed[0].success === 'true')
      ) {
        console.log('✅ Festivo actualizado correctamente:', parsed);
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
      console.log('🗑️ Eliminando festivo:', deleteUrl);
      
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
      } catch (parseError) {
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
      console.log('🎭 DEMO mode: Skipping fetchAngajati in CuadrantesPage');
      return;
    }

    try {
      console.log('📥 Fetching angajati from:', routes.getEmpleados);
      
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
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Angajati data received:', data);
      
      const lista = Array.isArray(data) ? data : [data];
      console.log('📊 Angajati lista length:', lista.length);
      
      setAngajati(lista);
      
      // Extrage grupurile unice
      const gruposUnicos = [...new Set(lista.map(a => a['GRUPO'] || '').filter(g => g))];
      console.log('👥 Grupos unicos:', gruposUnicos);
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
      console.log('Nu există utilizator autentificat');
      return;
    }

    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo data instead of fetching from backend');
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

  // Încarcă datele pentru horarios
  const loadHorariosData = useCallback(async () => {
    setHorariosLoading(true);
    try {
      console.log('📋 Loading horarios data:', { centros, grupos });
      
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
    console.log('🔍 Filtrare angajați:', { 
      selectedCentro, 
      selectedGrupo, 
      selectedEmpleado,
      angajatiLength: angajati.length, 
      emailLogat, 
      isManager 
    });
    
    if (selectedCentro) {
      console.log('✅ Centro selectat:', selectedCentro);
      
      // Debug: Arată toți centrele disponibile în date
      const todosLosCentros = [...new Set(angajati.map(a => a['CENTRO TRABAJO']))];
      console.log('📍 Todos los centros en data:', todosLosCentros);
      
      const normalizedSelectedCentro = normalizeString(selectedCentro);
      let filtrati = angajati
        .filter(a => {
          const centroTrabajo = a['CENTRO TRABAJO'] || '';
          const centroMatch = normalizeString(centroTrabajo) === normalizedSelectedCentro;
          if (!centroMatch) {
            console.log(`❌ No match centro: "${centroTrabajo}" !== "${selectedCentro}" (norm: "${normalizeString(centroTrabajo)}" !== "${normalizedSelectedCentro}")`);
          } else {
            console.log(`✅ Match centro: "${centroTrabajo}" === "${selectedCentro}"`);
          }
          return centroMatch;
        })
        .filter(a => {
          // Pentru manageri nu excludem utilizatorul curent
          if (isManager) return true;
          const emailMatch = (a['CORREO ELECTRONICO'] || '').trim().toLowerCase() !== emailLogat.toLowerCase();
          if (!emailMatch) {
            console.log(`❌ Email excluido (es el usuario actual): ${a['CORREO ELECTRONICO']}`);
          }
          return emailMatch;
        });
      
      console.log('📊 Después de filtrar centro y email:', filtrati.length);
      
      // Para managers, filtra también por grupo SOLO si está explícitamente seleccionado
      if (isManager && selectedGrupo && selectedGrupo !== 'Todos los grupos' && selectedGrupo !== '' && selectedGrupo !== 'Selecciona grupo') {
        console.log('🔍 Filtrando también por grupo:', selectedGrupo);
        filtrati = filtrati.filter(a => (a['GRUPO'] || '') === selectedGrupo);
        console.log('📊 Después de filtrar grupo:', filtrati.length);
      }
      
      // Filtrar por empleado específico si está seleccionado
      if (selectedEmpleado && selectedEmpleado !== '') {
        console.log('🔍 Filtrando por empleado específico:', selectedEmpleado);
        filtrati = filtrati.filter(a => (a['CODIGO'] || a.id) === selectedEmpleado);
        console.log('📊 Después de filtrar empleado:', filtrati.length);
      }
      
      console.log('✅ Angajați filtrați final:', filtrati.length);
      console.log('👥 Lista completa filtrati:', filtrati.map(a => ({
        nombre: a['NOMBRE / APELLIDOS'],
        email: a['CORREO ELECTRONICO'],
        centro: a['CENTRO TRABAJO'],
        grupo: a['GRUPO']
      })));
      
      // Debug: să vedem ce valori exacte au angajații pentru CENTRO TRABAJO
      console.log('🔍 DEBUG CENTRO TRABAJO VALUES:');
      const centrosUnicos = [...new Set(angajati.map(a => a['CENTRO TRABAJO']).filter(Boolean))];
      console.log('📋 Centros únicos encontrados:', centrosUnicos);
      console.log('🎯 Centro seleccionado:', selectedCentro);
      console.log('🔍 Coincidencias exactas:', angajati.filter(a => a['CENTRO TRABAJO'] === selectedCentro).length);
      setAngajatiFiltrati(filtrati);
    } else {
      console.log('⚠️ Nu este selectat centru - resetare lista');
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
    console.log('handleGenerar apelat cu:', {
      selectedMonth,
      selectedYear,
      selectedCentro,
      angajatiFiltratiLength: angajatiFiltrati.length,
      settingsKeys: Object.keys(settings)
    });
    
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
      console.log('Days in month calculated:', daysInMonth, 'for month:', selectedMonth, 'year:', selectedYear);
      console.log('Generare cuadrante pentru:', {
        daysInMonth,
        angajatiFiltratiLength: angajatiFiltrati.length,
        settingsKeys: Object.keys(settings),
        t1Start,
        t2Start,
        t3Start,
        turnoHours
      });
      
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
        console.log(`Processing employee ${a['NOMBRE / APELLIDOS']} with ID: ${id}`);
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
        console.log(`Settings for ${id}:`, s);
        console.log(`s.zi1 value: "${s.zi1}", type: ${typeof s.zi1}`);
        console.log(`daysInMonth: ${daysInMonth}, selectedMonth: ${selectedMonth}, selectedYear: ${selectedYear}`);
        let zile = [];

        if (customSeq && customSeq.length) {
          console.log(`Using custom sequence for ${id}, daysInMonth: ${daysInMonth}`);
          console.log(`Using custom sequence for ${id}:`, customSeq);
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
          console.log(`Using weekly pattern for ${id}:`, weeklyPattern);
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
          console.log(`Using fallback rotation for ${id}:`, s.tipRotatie);
          console.log(`daysInMonth for fallback: ${daysInMonth}, will loop from 1 to ${daysInMonth}`);
          // Fallback: rotație clasică trabajo/libre
          const rot = ROTATIONS.find(r => r.label === s.tipRotatie) || ROTATIONS[0];
          // Respectă setarea explicită din UI
          let etapa = s.etapa;
          // Respectă configurația utilizatorului pentru Día 1
          let mod = s.zi1 === 'M' ? 'work' : 'free';
          console.log(`s.zi1: "${s.zi1}", setting mod to: ${mod}`);
          
          console.log(`Employee ${id} starting with etapa: ${etapa} (original: ${s.etapa}), mod: ${mod}, rot: ${JSON.stringify(rot)}`);
          
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
            const oldMod = mod;
            const oldEtapa = etapa;
            if (mod === 'work' && etapa >= rot.work) { 
              etapa = 1; 
              mod = 'free'; 
              console.log(`  Day ${zi}: Switching from work to free (etapa ${oldEtapa} >= ${rot.work})`);
            } else if (mod === 'free' && etapa >= rot.free) { 
              etapa = 1; 
              mod = 'work'; 
              console.log(`  Day ${zi}: Switching from free to work (etapa ${oldEtapa} >= ${rot.free})`);
            } else {
            etapa++;
              console.log(`  Day ${zi}: Continuing ${oldMod}, etapa: ${oldEtapa} -> ${etapa}`);
            }
          }
          }
          console.log(`Generated ${zile.length} days for employee ${id}, zile:`, zile);
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
        
        console.log(`Generated cuadrante for ${id}:`, cuadranteObj);
        return cuadranteObj;
      });

      console.log('Generated result:', result);
      console.log('Generated result length:', result.length);
      if (result.length > 0) {
        console.log('First cuadrante in result:', result[0]);
        console.log('First cuadrante zile:', result[0].zile);
        console.log('First cuadrante zile length:', result[0].zile?.length);
      }

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

      console.log('Setting cuadrantePreview to:', result);
      setCuadrantePreview(result);
      setActiveTab('preview');
      console.log('✅ Preview tab activated, cuadrantePreview set');
    } catch (error) {
      console.error('Error generating cuadrante:', error);
    } finally {
      setLoading(false);
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
      } catch (e) {
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
      alert('Error al generar los cuadrantes para todo el año!');
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
        alert(`Todos los meses generados (${luniExcluse.map(l => MONTHS[l]).join(', ')}) ya existen en el sistema!\n\nPara sobrescribir, presiona nuevamente el botón "Guardar Todo el Año".`);
      } else {
        alert('No hay meses para guardar!');
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
        let mesaj = '';
        if (userChoice === true) {
          mesaj = `✅ Todos los cuadrantes para todo el año han sido guardados con éxito! (${successCount}/${totalRequests})`;
        } else {
          const luniSalvate = luniPentruSalvare.map(l => MONTHS[l]).join(', ');
          const luniSarite = luniExcluse.map(l => MONTHS[l]).join(', ');
                      mesaj = `✅ Los cuadrantes para ${luniSalvate} han sido guardados con éxito! (${successCount}/${totalRequests})`;
          if (luniExcluse.length > 0) {
                          mesaj += `\n\n⏭️ Los meses ${luniSarite} han sido omitidos (ya existen en el sistema).`;
          }
        }
        alert(mesaj);
        setActiveTab('generar');
        setCuadranteAn(null);
      } else {
        alert(`⚠️ Error al guardar anual: ${successCount} guardadas con éxito, ${failCount} fallos de ${totalRequests} total.\n\nVerifica la consola del navegador (F12) para detalles sobre errores.`);
      }
          } catch (error) {
        console.error('Eroare la salvare:', error);
        alert('❌ Error al guardar!');
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
        `Luna ${MONTHS[selectedMonth]} ${selectedYear} deja există în sistem!\n\n` +
        `Vrei să rescrii cuadrantele existente?\n\n` +
        `- Apasă "OK" pentru a rescrie\n` +
        `- Apasă "Cancel" pentru a anula`
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

        let mesaj = '';
        if (lunaExistenta) {
          mesaj = `✅ Los cuadrantes para ${MONTHS[selectedMonth]} ${selectedYear} han sido sobrescritos con éxito! (${successCount}/${totalRequests})`;
        } else {
          mesaj = `✅ Los cuadrantes para ${MONTHS[selectedMonth]} ${selectedYear} han sido guardados con éxito! (${successCount}/${totalRequests})`;
        }
        alert(mesaj);
        setActiveTab('generar');
        setCuadrantePreview([]);
      } else {
        alert(`⚠️ Error al guardar mensual: ${successCount} guardadas con éxito, ${failCount} fallos de ${totalRequests} total.\n\nVerifica la consola del navegador (F12) para detalles sobre errores.`);
      }
          } catch (error) {
        console.error('Error saving cuadrante:', error);
        alert('❌ Error al guardar!');
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
        } catch (e) {
          console.warn('No se pudo conectar con el servidor');
        }
      };
      fetchHorariosList();
    }
  }, [activeTab, callApi]);

  // Funcții pentru editare
  const handleCellClick = (employee, day, currentValue, tableType = 'preview') => {
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
                    value={centroSearchTerm || selectedCentro}
                    onChange={(e) => {
                      setCentroSearchTerm(e.target.value);
                      setCentroDropdownOpen(true);
                      if (!e.target.value) {
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
                            setCentroSearchTerm('');
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
                    {[2023, 2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
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
                <p><strong>Total angajați cargados:</strong> {angajati.length}</p>
                <p><strong>Centro seleccionado:</strong> {selectedCentro || 'Ninguno'}</p>
                <p><strong>Grupo seleccionado:</strong> {selectedGrupo || 'Ninguno'} {selectedGrupo === '' ? '(Todos los grupos)' : ''}</p>
                <p><strong>Angajați filtrados:</strong> {angajatiFiltrati.length}</p>
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
                          {a['NOMBRE / APELLIDOS'] || a.NOMBRE || a.EMAIL}
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
                
                <div className="flex justify-end">
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
                  } catch (e) {
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
                            } catch (e) {
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
                    value={centroSearchTermLista || selectedCentro}
                  onChange={(e) => {
                      setCentroSearchTermLista(e.target.value);
                      setCentroDropdownOpenLista(true);
                      if (!e.target.value) {
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
                            setCentroSearchTermLista('');
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
                  <option value="2025-01">Enero 2025</option>
                  <option value="2025-02">Febrero 2025</option>
                  <option value="2025-03">Marzo 2025</option>
                  <option value="2025-04">Abril 2025</option>
                  <option value="2025-05">Mayo 2025</option>
                  <option value="2025-06">Junio 2025</option>
                  <option value="2025-07">Julio 2025</option>
                  <option value="2025-08">Agosto 2025</option>
                  <option value="2025-09">Septiembre 2025</option>
                  <option value="2025-10">Octubre 2025</option>
                  <option value="2025-11">Noviembre 2025</option>
                  <option value="2025-12">Diciembre 2025</option>
                  <option value="2026-01">Enero 2026</option>
                  <option value="2026-02">Febrero 2026</option>
                  <option value="2026-03">Marzo 2026</option>
                  <option value="2026-04">Abril 2026</option>
                  <option value="2026-05">Mayo 2026</option>
                  <option value="2026-06">Junio 2026</option>
                  <option value="2026-07">Julio 2026</option>
                  <option value="2026-08">Agosto 2026</option>
                  <option value="2026-09">Septiembre 2026</option>
                  <option value="2026-10">Octubre 2026</option>
                  <option value="2026-11">Noviembre 2026</option>
                  <option value="2026-12">Diciembre 2026</option>
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
                          payload.nombre = empleado['NOMBRE / APELLIDOS'] || empleado.NOMBRE || empleado.EMAIL || 'Unknown';
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
                      if (payload.nombre) params.set('nombre', payload.nombre);
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
                            {Array.from({ length: 31 }, (_, i) => {
                              const dayNumber = i + 1;
                              const currentMonth = selectedMesAno ? parseInt(selectedMesAno.split('-')[1]) - 1 : selectedMonth;
                              const currentYear = selectedMesAno ? parseInt(selectedMesAno.split('-')[0]) : selectedYear;
                              const date = new Date(currentYear, currentMonth, dayNumber);
                              const dayOfWeek = date.getDay();
                              const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                              
                              return (
                                <th key={i} className="border border-gray-300 p-1 text-center text-xs font-bold min-w-[60px]">
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
                              // Construir array de zile din cuadrante
                              const zile = [];
                              for (let i = 1; i <= 31; i++) {
                                const ziKey = `ZI_${i}`;
                                const editKey = `${index}_${i}`;
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
                                    </div>
                              </td>
                                  {zile.map((z, i) => {
                                    const editKey = `${index}_${i + 1}`;
                                    const isEdited = editedCuadrantes[editKey] !== undefined;
                                    
                                    return (
                                      <td key={i} className="border border-gray-300 p-1 text-center text-xs">
                                        <span 
                                          className={`px-1 py-1 rounded text-xs cursor-pointer hover:bg-blue-100 transition-colors block ${
                                            z === 'LIBRE' || z === '' 
                                              ? 'bg-gray-100 text-gray-600' 
                                              : 'bg-green-100 text-green-700'
                                          } ${isEdited ? 'ring-1 ring-yellow-400' : ''}`}
                                          title={`Click para editar ${cuadrante.NOMBRE} - día ${i + 1}: ${z || 'Sin datos'}`}
                                          onClick={() => handleEditDay(index, i + 1, z)}
                                        >
                                          {z || '-'}
                                          {isEdited && <span className="text-yellow-600">*</span>}
                                        </span>
                                      </td>
                                    );
                                  })}
                                  <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                                    <div className="space-y-1">
                                      <div className="text-blue-600 text-sm">
                                        {zile.filter(z => z && z !== 'LIBRE').length} días
                                      </div>
                                      <div className="text-green-600 text-xs">
                                        {(() => {
                                          // Calcular total de ore cu precizie
                                          let totalHoras = 0;
                                          zile.forEach(z => {
                                            if (z && z !== 'LIBRE' && z.trim() !== '') {
                                              // Primero intentar extraer orele din formato de tiempo directo
                                              const timeMatch = z.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
                                              if (timeMatch) {
                                                const startTime = timeMatch[1].split(':');
                                                const endTime = timeMatch[2].split(':');
                                                const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
                                                let endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
                                                
                                                // Manejar cambio de día (turno nocturno)
                                                if (endMinutes < startMinutes) {
                                                  endMinutes += 24 * 60; // Agregar 24 horas
                                                }
                                                
                                                const horas = (endMinutes - startMinutes) / 60;
                                                totalHoras += horas;
                                                console.log(`📊 Calculando ${z}: ${startTime[0]}:${startTime[1]} -> ${endTime[0]}:${endTime[1]} = ${horas}h`);
                                              } else {
                                                // Fallback: usar valores por defecto pentru turnos conocidos
                                                if (z.includes('T1')) {
                                                  // T1 típico: 12 ore (07:30-19:30)
                                                  totalHoras += 12;
                                                  console.log(`📊 ${z}: T1 default = 12h`);
                                                } else if (z.includes('T2')) {
                                                  // T2 típico: 8 ore (14:30-22:30)
                                                  totalHoras += 8;
                                                  console.log(`📊 ${z}: T2 default = 8h`);
                                                } else if (z.includes('T3')) {
                                                  // T3 típico: 8 ore (22:30-06:30)
                                                  totalHoras += 8;
                                                  console.log(`📊 ${z}: T3 default = 8h`);
                                                } else {
                                                  // Otros formatos: asumir 8 ore
                                                  totalHoras += 8;
                                                  console.log(`📊 ${z}: Fallback default = 8h`);
                                                }
                                              }
                                            }
                                          });
                                          console.log(`📊 Total calculado para ${cuadrante.NOMBRE}: ${totalHoras}h`);
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
                      if (z === 'LIBRE' || !z || z === '') return total;
                      
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
                          if (z === 'LIBRE' || !z || z === '') return total;
                          
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
      {showEditModal && (
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
                    } catch (e) {
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
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDay(null);
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
    </div>
  );
} 