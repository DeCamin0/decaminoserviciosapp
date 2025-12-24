import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useLoadingState } from '../hooks/useLoadingState';
import Back3DButton from '../components/Back3DButton.jsx';
import { Card, LoadingSpinner } from '../components/ui';
import Modal from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { routes } from '../utils/routes.js';
import { API_ENDPOINTS } from '../utils/constants.js';
import activityLogger from '../utils/activityLogger';
import { ChevronLeft, ChevronRight, Edit, Trash2, RefreshCw } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

const MONTHS = [
  'Todas las meses', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ENDPOINT = routes.getSolicitudesByEmail;
const BAJA_UPLOAD_ENDPOINT = routes.uploadBajasMedicas || '';
const BAJA_LIST_ENDPOINT = routes.getBajasMedicas || '';

const normalizeTipo = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const isBajaMedica = (value) => {
  const normalized = normalizeTipo(value);
  return normalized.includes('baja') && normalized.includes('medic');
};

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '-' || dateStr === '') return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-ES');
  } catch (error) {
    return '-';
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return value;
    return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch (error) {
    return value;
  }
};

const getSituacionColor = (situacion) => {
  const normalized = normalizeTipo(situacion);
  if (normalized.includes('alta')) {
    return 'bg-green-100 text-green-800';
  }
  if (normalized.includes('seguimiento')) {
    return 'bg-amber-100 text-amber-800';
  }
  if (normalized.includes('finalizada') || normalized.includes('cerrada')) {
    return 'bg-blue-100 text-blue-800';
  }
  return 'bg-rose-100 text-rose-800';
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (isNaN(number)) return String(value);
  return new Intl.NumberFormat('es-ES').format(number);
};


const formatBajaRecord = (item) => {
  const idCaso = item?.['Id.Caso'] ?? item?.Id_Caso ?? item?.id ?? '';
  const idPosicion = item?.['Id.Posición'] ?? item?.['Id.Posicion'] ?? item?.Id_Posici_n ?? '';
  // ID unic bazat pe Id.Caso + Id.Posición (cheia unică din baza de date)
  const uniqueId = idCaso && idPosicion ? `${idCaso}_${idPosicion}` : (item?.id ?? `baja_${Math.random().toString(36).slice(2, 9)}`);
  return {
    id: uniqueId,
    casoId: idCaso ?? '',
    trabajador:
      item?.Trabajador ??
      item?.trabajador ??
      item?.['Nombre empleado'] ??
      item?.['Nombre Empleado'] ??
      '',
    posicionId: item?.['Id.Posición'] ?? item?.['Id.Posicion'] ?? '',
    codigoEmpleado:
      item?.Codigo_Empleado ??
      item?.['Código Empleado'] ??
      item?.codigo_empleado ??
      item?.codigoEmpleado ??
      '',
    situacion: item?.['Situación'] ?? item?.Situacion ?? item?.situacion ?? '',
    diasBaja: item?.['Días de baja'] ?? item?.['Dias de baja'] ?? item?.dias_baja ?? 0,
    diasPrevistosSps:
      item?.['Días previstos Servicio Público de Salud'] ??
      item?.['Dias previstos Servicio Publico de Salud'] ??
      item?.dias_previstos_sps ??
      0,
    inicioPagoDelegado:
      item?.['Inicio pago delegado'] ?? item?.inicio_pago_delegado ?? item?.inicioPagoDelegado ?? '',
    finPagoDelegado:
      item?.['Fin pago delegado'] ?? item?.fin_pago_delegado ?? item?.finPagoDelegado ?? '',
    ultimaGestionMutua:
      item?.['Última gestión Mutua'] ?? item?.ultima_gestion_mutua ?? item?.ultimaGestionMutua ?? '',
    proximaGestionMutua:
      item?.['Próxima gestión Mutua'] ??
      item?.proxima_gestion_mutua ??
      item?.proximaGestionMutua ??
      '',
    pendienteINSS:
      item?.['Pendiente validación INSS'] ?? item?.pendiente_validacion_inss ?? item?.pendienteINSS ?? 0,
    demoraParteBaja:
      item?.['Demora recepción del parte de baja'] ??
      item?.demora_recepcion_parte_baja ??
      item?.demoraParteBaja ??
      '',
    ultimoParteConfirmacion:
      item?.['Último Parte de Confirmación'] ?? item?.ultimo_parte_confirmacion ?? '',
    diasBajaDetalle: item?.['Días de baja'] ?? item?.dias_baja ?? '',
    fechaBaja:
      item?.['Fecha baja'] ??
      item?.['Fecha Baja'] ??
      item?.fecha_baja ??
      item?.fechaBaja ??
      '',
    fechaAlta:
      item?.['Fecha de alta'] ??
      item?.['Fecha alta'] ??
      item?.['Fecha Alta'] ??
      item?.fecha_alta ??
      item?.fechaAlta ??
      '',
    fuente: item?.fuente ?? '',
    updatedAt: item?.updated_at ?? item?.updatedAt ?? '',
    tipo: 'Baja Médica',
    estado: item?.['Situación'] ?? item?.situacion ?? '',
    raw: item,
  };
};

export default function SolicitudesPage() {
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  
  const [tipo, setTipo] = useState('Asuntos Propios');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [editingSolicitud, setEditingSolicitud] = useState(null); // ID-ul solicitării în curs de editare
  const [originalSolicitudData, setOriginalSolicitudData] = useState(null); // Datele originale ale solicitării în curs de editare
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, solicitudId: null }); // Modal de confirmare ștergere
  // Loading states centralizate
  const { setOperationLoading, isOperationLoading } = useLoadingState();
  const [serverResp, setServerResp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [solicitudes, setSolicitudes] = useState([]);
  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'nueva' | 'todas'
  const [allSolicitudes, setAllSolicitudes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [totalAsuntoPropioDays, setTotalAsuntoPropioDays] = useState(0);
  const [totalVacacionesDays, setTotalVacacionesDays] = useState(0);

  // Calendar states for Vacaciones
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState([]);
  const [occupiedDates, setOccupiedDates] = useState([]);
  const [dateAvailability, setDateAvailability] = useState({}); // { date: { available: 5, total: 10, group: 'Limpiador' } }


  // Filtros para managers
  const [selectedTab, setSelectedTab] = useState('asunto'); // 'asunto' | 'vacaciones' | 'ausencias' | 'baja'
  const selectedStatus = 'Todos';
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const bajaFileInputRef = useRef(null);
  const [allBajasMedicas, setAllBajasMedicas] = useState([]);
  // State pentru editare bajas médicas
  const [editingBaja, setEditingBaja] = useState(null); // { idCaso, idPosicion, field: 'fechaBaja' | 'fechaAlta' }
  const [editingBajaValue, setEditingBajaValue] = useState('');
  
  // Ausencias states
  const [allAusencias, setAllAusencias] = useState([]);

  const email = authUser?.email || authUser?.['CORREO ELECTRONICO'] || '';
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isManager = authUser?.isManager || false;

  // Calendar functions
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateSelected = (date) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return selectedDates.includes(dateStr);
  };

  const isDateOccupied = (date) => {
    // This function is now deprecated - we use dateAvailability instead
    // Keep it for backward compatibility but it shouldn't be used for Vacaciones
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return occupiedDates.includes(dateStr);
  };

  // Check if a date is in the blocked holiday period (Dec 6 - Jan 6)
  const isInHolidayBlockPeriod = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    
    // Block from December 6 to January 6 (next year)
    if (month === 12 && date.getDate() >= 6) {
      return true; // December 6-31
    }
    if (month === 1 && date.getDate() <= 6) {
      return true; // January 1-6
    }
    
    return false;
  };

  const isDateDisabled = (date) => {
    // Disable past dates, holiday block period, and full availability
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const today = new Date();
    const currentDate = new Date(dateStr);
    
    // Check if date is full (no availability left)
    const availability = dateAvailability[dateStr];
    const isFull = availability && availability.isFull;
    
    // Când se editează o solicitare de tip Vacaciones sau Asunto Propio, ignorăm TOATE regulile de disponibilitate
    const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
      (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
    
    // For Vacaciones and Asuntos Propios, don't use occupiedDates - use availability logic instead
    if (tipo === 'Vacaciones' || tipo === 'Asunto Propio') {
      // Dacă se editează, ignorăm TOATE verificările (disponibilitatea, perioada de blocare, zilele din trecut, etc.)
      // Permitem selectarea oricărei date (trecut, prezent, viitor)
      if (isEditingVacacionesOrAsuntoPropio) {
        return false; // Nu blocăm nicio dată când se editează
      }
      return currentDate < today || isInHolidayBlockPeriod(dateStr) || isFull;
    } else {
      // For other types, use the old logic
      return currentDate < today || occupiedDates.includes(dateStr) || isInHolidayBlockPeriod(dateStr);
    }
  };

  // Calculate availability limits based on month and group
  const getAvailabilityLimit = (month, groupSize, tipo) => {
    if (tipo === 'Vacaciones') {
      const isSummerMonth = month >= 5 && month <= 7; // June (5), July (6), August (7)
      const percentage = isSummerMonth ? 0.15 : 0.10; // 15% summer, 10% other months
      return Math.max(1, Math.ceil(groupSize * percentage)); // At least 1 person
    } else if (tipo === 'Asunto Propio') {
      // For Asuntos Propios: max 4 people per day globally
      return 4; // Absolute limit of 4 people per day
    }
    return 1; // Default fallback
  };

  // Calculate date availability for each group and center
  const calculateDateAvailability = useCallback((solicitudes, users, year, month) => {
    const availability = {};
    const currentUser = authUser;
    const currentUserGroup = currentUser?.['GRUPO'] || currentUser?.grupo || '';
    // Try multiple possible field names for center - FIXED: use "CENTRO TRABAJO" (with space, not "DE")
    let currentUserCenter = '';
    if (currentUser) {
      // First, check the exact key used in DatosPage
      if (currentUser['CENTRO TRABAJO'] && String(currentUser['CENTRO TRABAJO']).trim()) {
        currentUserCenter = String(currentUser['CENTRO TRABAJO']).trim();
      } else {
        const preferredKeys = [
          'CENTRO DE TRABAJO',
          'centro de trabajo',
          'CENTRO_DE_TRABAJO',
          'centroDeTrabajo',
          'centro_trabajo',
          'CENTRO',
          'centro',
          'CENTER',
          'center',
          'DEPARTAMENTO',
          'departamento'
        ];
        for (const k of preferredKeys) {
          if (currentUser[k] && String(currentUser[k]).trim()) {
            currentUserCenter = String(currentUser[k]).trim();
            break;
          }
        }
        // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
        if (!currentUserCenter) {
          try {
            const allKeys = Object.keys(currentUser || {});
            const key = allKeys.find(key => {
              const lk = key.toLowerCase();
              return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(currentUser[key]).trim();
            });
            if (key) {
              currentUserCenter = String(currentUser[key]).trim();
            }
          } catch (e) {
            console.warn('Error in centroTrabajo heuristics:', e);
          }
        }
      }
      
      // Fallback: dacă nu s-a găsit centrul în authUser, caută în lista de utilizatori
      if (!currentUserCenter && users && users.length > 0) {
        const currentUserEmail = currentUser?.email || currentUser?.['CORREO ELECTRONICO'] || currentUser?.['CORREO ELECTRONIC'] || '';
        const currentUserCodigo = currentUser?.['CODIGO'] || currentUser?.codigo || '';
        
        const matchedUser = users.find(user => {
          const userEmail = user?.['CORREO ELECTRONICO'] || user?.EMAIL || user?.email || '';
          const userCodigo = user?.CODIGO || user?.codigo || '';
          return (currentUserEmail && userEmail && String(userEmail).toLowerCase() === String(currentUserEmail).toLowerCase()) ||
                 (currentUserCodigo && userCodigo && String(userCodigo) === String(currentUserCodigo));
        });
        
        if (matchedUser) {
          // Încearcă să găsească centrul în utilizatorul găsit
          if (matchedUser['CENTRO TRABAJO'] && String(matchedUser['CENTRO TRABAJO']).trim()) {
            currentUserCenter = String(matchedUser['CENTRO TRABAJO']).trim();
          } else {
            const preferredKeys = [
              'CENTRO DE TRABAJO',
              'centro de trabajo',
              'CENTRO_DE_TRABAJO',
              'centroDeTrabajo',
              'centro_trabajo',
              'CENTRO',
              'centro',
              'CENTER',
              'center',
              'DEPARTAMENTO',
              'departamento'
            ];
            for (const k of preferredKeys) {
              if (matchedUser[k] && String(matchedUser[k]).trim()) {
                currentUserCenter = String(matchedUser[k]).trim();
                break;
              }
            }
          }
        }
      }
    }
    
    console.log('🔍 Current user data for center:', {
      currentUser,
      currentUserGroup,
      currentUserCenter,
      allUserKeys: Object.keys(currentUser || {}),
      centerKeys: Object.keys(currentUser || {}).filter(key => 
        key.toLowerCase().includes('centro') || 
        key.toLowerCase().includes('center') ||
        key.toLowerCase().includes('trabajo') ||
        key.toLowerCase().includes('departamento')
      )
    });
    
    // Log first few users to see actual structure
    if (users && users.length > 0) {
      console.log('🔍 First user structure:', users[0]);
      console.log('🔍 All keys in first user:', Object.keys(users[0] || {}));
      
      // Look for any field that might contain center info
      const sampleUser = users[0];
      Object.keys(sampleUser || {}).forEach(key => {
        if (typeof sampleUser[key] === 'string' && sampleUser[key].length > 0) {
          console.log(`🔍 Field "${key}": "${sampleUser[key]}"`);
        }
      });
    }

    // Pentru Vacaciones: obținem toți utilizatorii din același GRUP (toate centrele)
    // Pentru Asuntos Propios: obținem utilizatorii din același grup+centru
    let relevantUsers;
    if (tipo === 'Vacaciones') {
      // Vacaciones: limita este per grup (toate centrele din grup)
      relevantUsers = users.filter(user => {
        const userGroup = user['GRUPO'] || user.grupo || '';
        return userGroup === currentUserGroup;
      });
    } else {
      // Asuntos Propios: limita este per grup+centru
      relevantUsers = users.filter(user => {
        const userGroup = user['GRUPO'] || user.grupo || '';
        const userCenter = user['CENTRO TRABAJO'] || 
                          user['CENTRO DE TRABAJO'] || 
                          user['centro de trabajo'] || 
                          user['CENTRO_DE_TRABAJO'] ||
                          user['centroDeTrabajo'] ||
                          user['centro'] ||
                          user['CENTER'] ||
                          user['center'] ||
                          user['DEPARTAMENTO'] ||
                          user['departamento'] ||
                          '';
        
        return userGroup === currentUserGroup && userCenter === currentUserCenter;
      });
    }

    const groupSize = relevantUsers.length;
    let maxAllowed;
    
    if (tipo === 'Asunto Propio') {
      // For Asuntos Propios: max 4 people globally, max 1 from same center
      maxAllowed = 4; // Global limit
    } else {
      maxAllowed = getAvailabilityLimit(month, groupSize, tipo);
    }
    
    console.log('🔍 Availability calculation:', {
      currentUserGroup,
      currentUserCenter,
      groupSize,
      maxAllowed,
      isSummerMonth: month >= 5 && month <= 7,
      totalSolicitudes: solicitudes.length,
      tipo,
      month: month + 1,
      year,
      relevantUsers: relevantUsers.map(u => ({
        name: u['NOMBRE / APELLIDOS'] || u.nombre,
        group: u['GRUPO'] || u.grupo,
        center: u['CENTRO TRABAJO'] || u['CENTRO DE TRABAJO'] || u['centro de trabajo']
      })),
      allSolicitudes: solicitudes.map(s => ({
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo,
        estado: s.estado,
        grupo: s.grupo || s['GRUPO'],
        centro: s['CENTRO TRABAJO'] || s['centro de trabajo'] || s['CENTRO DE TRABAJO'],
        fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`
      }))
    });

    // Process each day of the month
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Count approved/pending requests for this date
      let occupiedCount = 0;
      let sameCenterCount = 0; // Count people from same center
      
      solicitudes.forEach(solicitud => {
        // Exclude solicitarea care se editează din calculul disponibilității
        if (editingSolicitud !== null && solicitud.id === editingSolicitud) {
          return; // Skip solicitarea care se editează
        }
        
        if (solicitud.tipo === tipo && 
            (solicitud.estado === 'Aprobada' || solicitud.estado === 'Pendiente')) {
          
          const solicitudGroup = solicitud.grupo || solicitud['GRUPO'] || '';
          const solicitudCenter = solicitud['CENTRO TRABAJO'] || 
                                solicitud['centro de trabajo'] || 
                                solicitud['CENTRO DE TRABAJO'] || 
                                solicitud['CENTRO_DE_TRABAJO'] ||
                                solicitud['centroDeTrabajo'] ||
                                solicitud['centro'] ||
                                solicitud['CENTER'] ||
                                solicitud['center'] ||
                                solicitud['DEPARTAMENTO'] ||
                                solicitud['departamento'] ||
                                '';
          
          // Check if this date falls within the solicitud date range
          let fechaInicio = '';
          let fechaFin = '';
          
          if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
            [fechaInicio, fechaFin] = solicitud.FECHA.split(' - ');
          } else {
            fechaInicio = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha;
            fechaFin = solicitud.fecha_fin || solicitud["fecha fin"] || solicitud.fecha;
          }
          
          if (fechaInicio && fechaFin) {
            const start = new Date(fechaInicio.trim());
            const end = new Date(fechaFin.trim());
            const currentDate = new Date(dateStr);
            
            if (currentDate >= start && currentDate <= end) {
              if (tipo === 'Vacaciones') {
                // ✅ Vacaciones: limită per GRUP (toate centrele din grup) + limită per grup+centru (max 1)
                // Numărăm solicitările din ACELAȘI GRUP, indiferent de centru
                if (solicitudGroup === currentUserGroup) {
                  occupiedCount++; // Numără doar din același grup (toate centrele)
                  
                  // Count people from same group+center (pentru limita per grup+centru)
                  if (solicitudCenter === currentUserCenter) {
                    sameCenterCount++;
                  }
                }
              } else if (tipo === 'Asunto Propio') {
                // ✅ Asuntos Propios: limită globală (4) + limită per centru (1)
                occupiedCount++; // Numără toate solicitările global (din toate grupuri/centre)
                
                // Count people from same center (pentru limita per centru)
                if (solicitudGroup === currentUserGroup && solicitudCenter === currentUserCenter) {
                  sameCenterCount++;
                }
              } else {
                // Fallback: numără toate
                occupiedCount++;
              }
            }
          }
        }
      });

      // Verifică dacă ziua este complet ocupată
      // Când se editează o solicitare de tip Vacaciones sau Asunto Propio, ignorăm regulile (isFull = false)
      const isEditingVacacionesOrAsuntoPropio = editingSolicitud !== null && 
        (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios');
      
      let isFull = false;
      if (isEditingVacacionesOrAsuntoPropio) {
        // La editare, toate zilele sunt disponibile (ignorăm regulile)
        isFull = false;
      } else if (tipo === 'Asunto Propio') {
        // Asuntos Propios: limită globală de 4 + limită per centru de 1
        isFull = occupiedCount >= 4 || sameCenterCount >= 1;
      } else if (tipo === 'Vacaciones') {
        // Vacaciones: limită per grup (maxAllowed) + limită per grup+centru (max 1)
        isFull = occupiedCount >= maxAllowed || sameCenterCount >= 1;
      } else {
        // Fallback
        isFull = occupiedCount >= maxAllowed;
      }

      availability[dateStr] = {
        available: tipo === 'Asunto Propio' 
          ? Math.max(0, 4 - occupiedCount) // Show global availability
          : Math.max(0, maxAllowed - occupiedCount),
        total: tipo === 'Asunto Propio' ? 4 : maxAllowed,
        occupied: occupiedCount,
        sameCenterOccupied: sameCenterCount,
        isFull: isFull,
        group: currentUserGroup,
        center: currentUserCenter,
        maxAllowed: tipo === 'Asunto Propio' ? 4 : maxAllowed
      };
      
      // Log first few days for debugging
      if (day <= 10) {
        console.log(`🔍 Day ${day} (${dateStr}):`, {
          occupiedCount,
          sameCenterCount,
          maxAllowed,
          available: tipo === 'Asunto Propio' 
            ? Math.max(0, 4 - occupiedCount)
            : Math.max(0, maxAllowed - occupiedCount),
          isFull: tipo === 'Asunto Propio' 
            ? (occupiedCount >= 4 || sameCenterCount >= 1)
            : occupiedCount >= maxAllowed,
          tipo,
          solicitudesForDay: solicitudes.filter(s => {
            if (s.tipo !== tipo || (s.estado !== 'Aprobada' && s.estado !== 'Pendiente')) return false;
            
            const solicitudGroup = s.grupo || s['GRUPO'] || '';
            const solicitudCenter = s['CENTRO TRABAJO'] || 
                                  s['centro de trabajo'] || 
                                  s['CENTRO DE TRABAJO'] || 
                                  s['CENTRO_DE_TRABAJO'] ||
                                  s['centroDeTrabajo'] ||
                                  s['centro'] ||
                                  s['CENTER'] ||
                                  s['center'] ||
                                  s['DEPARTAMENTO'] ||
                                  s['departamento'] ||
                                  '';
            
            if (solicitudGroup !== currentUserGroup || solicitudCenter !== currentUserCenter) return false;
            
            // Check if this date falls within the solicitud date range
            let fechaInicio = '';
            let fechaFin = '';
            
            if (s.FECHA && s.FECHA.includes(' - ')) {
              [fechaInicio, fechaFin] = s.FECHA.split(' - ');
            } else {
              fechaInicio = s.fecha_inicio || s["fecha inicio"] || s.fecha;
              fechaFin = s.fecha_fin || s["fecha fin"] || s.fecha;
            }
            
            if (fechaInicio && fechaFin) {
              const start = new Date(fechaInicio.trim());
              const end = new Date(fechaFin.trim());
              const currentDate = new Date(dateStr);
              
              return currentDate >= start && currentDate <= end;
            }
            return false;
          }).map(s => ({
            id: s.id,
            nombre: s.nombre,
            grupo: s.grupo || s['GRUPO'],
            centro: s['CENTRO TRABAJO'] || s['centro de trabajo'],
            fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`,
            estado: s.estado
          }))
        });
      }
    }

    return availability;
  }, [authUser, tipo, editingSolicitud]);

  const toggleDate = (date) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        // Remove the date if it's already selected
        return prev.filter(d => d !== dateStr);
      } else {
        // Add the date, but keep only the last 2 selections
        const newSelection = [...prev, dateStr].sort();
        return newSelection.slice(-2); // Keep only the last 2 dates
      }
    });
  };

  const updateFechaFromCalendar = useCallback(() => {
    if (selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort();
      setFechaInicio(sortedDates[0]);
      setFechaFin(sortedDates[sortedDates.length - 1]);
    }
  }, [selectedDates]);



  useEffect(() => {
    updateFechaFromCalendar();
  }, [updateFechaFromCalendar]);

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    }
  };

  // Helper function to get approved requests
  const getApprovedRequests = useCallback(async (monthStr) => {
    try {
      // Remove email filter to get ALL approved requests for the month
      const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipo)}&ESTADO=Aprobada&limit=1000`;
      console.log('🔍 Fetching ALL approved requests from:', allApprovedUrl);
      const approvedResult = await callApi(allApprovedUrl);
      if (approvedResult.success) {
        const approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
        console.log('🔍 Found approved requests:', approvedData.length);
        
        // Filter to only include requests that actually fall within the current month
        const filteredData = filterSolicitudesByMonth(approvedData, monthStr);
        
        console.log('🔍 Filtered approved requests for month:', {
          original: approvedData.length,
          filtered: filteredData.length,
          monthStr
        });
        
        return filteredData;
      }
    } catch (error) {
      console.warn('Could not fetch approved requests:', error);
    }
    return [];
  }, [tipo, callApi]);

  // Helper function to filter solicitudes by month
  const filterSolicitudesByMonth = (solicitudes, targetMonthStr) => {
    return solicitudes.filter(solicitud => {
      const fechaInicio = solicitud.fecha_inicio;
      const fechaFin = solicitud.fecha_fin;
      
      if (!fechaInicio || !fechaFin) return false;
      
      const startDate = new Date(fechaInicio);
      const endDate = new Date(fechaFin);
      const [year, month] = targetMonthStr.split('-');
      const targetMonth = parseInt(month) - 1; // JavaScript months are 0-based
      const targetYear = parseInt(year);
      
      // Check if the request overlaps with the target month
      const requestStartMonth = startDate.getMonth();
      const requestStartYear = startDate.getFullYear();
      const requestEndMonth = endDate.getMonth();
      const requestEndYear = endDate.getFullYear();
      
      const overlaps = (
        (requestStartYear === targetYear && requestStartMonth === targetMonth) ||
        (requestEndYear === targetYear && requestEndMonth === targetMonth) ||
        (requestStartYear < targetYear && requestEndYear > targetYear) ||
        (requestStartYear === targetYear && requestEndYear === targetYear && requestStartMonth <= targetMonth && requestEndMonth >= targetMonth)
      );
      
      return overlaps;
    });
  };

  // Load occupied dates from backend - enhanced for all users
  const loadOccupiedDates = useCallback(async (year, month) => {
    setOperationLoading('occupiedDates', true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      // For managers: get all requests for the month
      // For employees: get their own requests plus approved ones from others
      let url;
      if (isManager) {
        // Managers can see all requests
        url = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipo)}&limit=1000`;
      } else {
        // Employees see their own requests plus all approved ones
        const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
        url = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipo)}&codigo=${encodeURIComponent(userCode)}&limit=1000`;
      }
      
      console.log('🔍 Loading occupied dates from:', url);
      const result = await callApi(url);
      
      if (result.success) {
        let data = Array.isArray(result.data) ? result.data : [result.data];
        const occupiedDatesSet = new Set();
        
        // Also get all approved vacation requests for the month (for conflict checking)
        if (!isManager) {
          try {
            const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=Vacaciones&ESTADO=Aprobada&limit=1000`;
            const approvedResult = await callApi(allApprovedUrl);
            if (approvedResult.success) {
              const approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
              data.push(...approvedData);
            }
          } catch (error) {
            console.warn('Could not fetch approved requests for conflict checking:', error);
          }
        }

        // Filter all data to only include requests that overlap with the target month
        const filteredData = filterSolicitudesByMonth(data, monthStr);
        console.log('🔍 Month filtering results:', {
          original: data.length,
          filtered: filteredData.length,
          monthStr
        });
        data = filteredData;
        
        data.forEach(solicitud => {
          // Process requests based on current tipo (Vacaciones or Asunto Propio)
          if (solicitud.tipo === tipo && (solicitud.estado === 'Aprobada' || solicitud.estado === 'Pendiente')) {
            // Handle different date formats
            let fechaInicio = '';
            let fechaFin = '';
            
            if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
              [fechaInicio, fechaFin] = solicitud.FECHA.split(' - ');
            } else {
              fechaInicio = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha;
              fechaFin = solicitud.fecha_fin || solicitud["fecha fin"] || solicitud.fecha;
            }
            
            if (fechaInicio && fechaFin) {
              // Add all dates in the range to occupiedDatesSet for backward compatibility
              const start = new Date(fechaInicio.trim());
              const end = new Date(fechaFin.trim());
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const current = new Date(start);
                while (current <= end) {
                  const dateStr = current.toISOString().split('T')[0];
                  occupiedDatesSet.add(dateStr);
                  current.setDate(current.getDate() + 1);
                }
              }
            }
          }
        });
        
        setOccupiedDates(Array.from(occupiedDatesSet));
        console.log('🔍 Loaded occupied dates:', Array.from(occupiedDatesSet));

        // Calculate availability for current user's group and center
        if (tipo === 'Vacaciones' || tipo === 'Asunto Propio') {
          // For non-managers, fetch users if not already loaded
          if (allUsers.length === 0) {
            try {
              const usersResult = await callApi(API_ENDPOINTS.USERS);
              if (usersResult.success) {
                const usersData = Array.isArray(usersResult.data) ? usersResult.data : [usersResult.data];
                setAllUsers(usersData);
                console.log('🔍 Loaded users for availability calculation:', usersData.length);
                
                // Use the loaded users for calculation
                // Get ALL approved requests - same for everyone regardless of role
                const approvedRequests = await getApprovedRequests(monthStr);
                let allSolicitudesData = [...data, ...approvedRequests];
                
                // Enrich solicitudes with user data (grupo and centro)
                const enrichedSolicitudes = allSolicitudesData.map(solicitud => {
                  if (solicitud.codigo && usersData.length > 0) {
                    const user = usersData.find(u => u['CODIGO'] === solicitud.codigo);
                    if (user) {
                      return {
                        ...solicitud,
                        grupo: user['GRUPO'] || user.grupo || '',
                        centro: user['CENTRO TRABAJO'] || user['CENTRO DE TRABAJO'] || user['centro de trabajo'] || '',
                        nombre: user['NOMBRE / APELLIDOS'] || user.nombre || solicitud.nombre
                      };
                    }
                  }
                  return solicitud;
                });
                
                allSolicitudesData = enrichedSolicitudes;
                console.log('🔍 Combined solicitudes for availability (early):', {
                  userRequests: data.length,
                  approvedRequests: approvedRequests.length,
                  total: allSolicitudesData.length,
                  isManager: isManager
                });
                const availability = calculateDateAvailability(allSolicitudesData, usersData, year, month);
                setDateAvailability(availability);
                console.log('🔍 Calculated date availability:', availability);
                return; // Exit early after setting availability
              }
            } catch (error) {
              console.warn('Could not fetch users for availability calculation:', error);
            }
          }
          
          if (allUsers.length > 0) {
            // For availability calculation, we need ALL approved requests for the month
            // This applies to EVERYONE regardless of role
            let allSolicitudesData = data;
            
            try {
              // Get ALL approved requests for the month (no email filter) - same for everyone
              const allApprovedUrl = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthStr)}&TIPO=${encodeURIComponent(tipo)}&ESTADO=Aprobada&limit=1000`;
              console.log('🔍 Fetching ALL approved requests for availability calculation:', allApprovedUrl);
              const approvedResult = await callApi(allApprovedUrl);
              if (approvedResult.success) {
                let approvedData = Array.isArray(approvedResult.data) ? approvedResult.data : [approvedResult.data];
                
                // Filter both user's own requests and approved requests to only include current month
                const filteredUserData = filterSolicitudesByMonth(data, monthStr);
                const filteredApprovedData = filterSolicitudesByMonth(approvedData, monthStr);
                
                console.log('🔍 Month filtering for availability:', {
                  userOriginal: data.length,
                  userFiltered: filteredUserData.length,
                  approvedOriginal: approvedData.length,
                  approvedFiltered: filteredApprovedData.length,
                  monthStr
                });
                
                // Combine filtered user's requests with filtered approved requests
                // Remove duplicates by id to avoid counting the same request twice
                const combinedData = [...filteredUserData, ...filteredApprovedData];
                const uniqueData = combinedData.filter((solicitud, index, self) => 
                  index === self.findIndex(s => s.id === solicitud.id)
                );
                allSolicitudesData = uniqueData;
                
                console.log('🔍 Deduplication results:', {
                  combined: combinedData.length,
                  unique: uniqueData.length,
                  duplicates: combinedData.length - uniqueData.length
                });
                console.log('🔍 Combined solicitudes for availability:', {
                  userRequests: filteredUserData.length,
                  approvedRequests: filteredApprovedData.length,
                  total: allSolicitudesData.length,
                  isManager: isManager
                });
                
                // Log first few solicitudes to see their structure
                console.log('🔍 Sample solicitudes structure:', allSolicitudesData.slice(0, 3).map(s => ({
                  id: s.id,
                  nombre: s.nombre,
                  tipo: s.tipo,
                  estado: s.estado,
                  fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`,
                  grupo: s.grupo || s['GRUPO'],
                  centro: s['CENTRO TRABAJO'] || s['centro de trabajo'] || s['CENTRO DE TRABAJO'],
                  codigo: s.codigo,
                  allKeys: Object.keys(s || {})
                })));
                
                // Enrich solicitudes with user data (grupo and centro)
                const enrichedSolicitudes = allSolicitudesData.map(solicitud => {
                  if (solicitud.codigo && allUsers.length > 0) {
                    const user = allUsers.find(u => u['CODIGO'] === solicitud.codigo);
                    if (user) {
                      return {
                        ...solicitud,
                        grupo: user['GRUPO'] || user.grupo || '',
                        centro: user['CENTRO TRABAJO'] || user['CENTRO DE TRABAJO'] || user['centro de trabajo'] || '',
                        nombre: user['NOMBRE / APELLIDOS'] || user.nombre || solicitud.nombre
                      };
                    }
                  }
                  return solicitud;
                });
                
                console.log('🔍 Enriched solicitudes sample:', enrichedSolicitudes.slice(0, 3).map(s => ({
                  id: s.id,
                  nombre: s.nombre,
                  tipo: s.tipo,
                  estado: s.estado,
                  codigo: s.codigo,
                  grupo: s.grupo,
                  centro: s.centro,
                  fecha: s.FECHA || `${s.fecha_inicio} - ${s.fecha_fin}`
                })));
                
                // Use enriched solicitudes for availability calculation
                allSolicitudesData = enrichedSolicitudes;
              }
            } catch (error) {
              console.warn('Could not fetch all approved requests for availability:', error);
            }
            
            const availability = calculateDateAvailability(allSolicitudesData, allUsers, year, month);
            setDateAvailability(availability);
            console.log('🔍 Calculated date availability:', availability);
            console.log('🔍 Using solicitudes data:', allSolicitudesData.length, 'requests');
            
            // Get current user info for logging
            const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
            const currentUserCenter = authUser?.['CENTRO TRABAJO'] || 
                                    authUser?.['CENTRO DE TRABAJO'] || 
                                    authUser?.['centro de trabajo'] || 
                                    authUser?.['CENTRO_DE_TRABAJO'] ||
                                    authUser?.['centroDeTrabajo'] ||
                                    authUser?.['centro'] ||
                                    authUser?.['CENTER'] ||
                                    authUser?.['center'] ||
                                    authUser?.['DEPARTAMENTO'] ||
                                    authUser?.['departamento'] ||
                                    '';
            console.log('🔍 Current user group:', currentUserGroup, 'center:', currentUserCenter);
          }
        } else {
          setDateAvailability({});
        }
      } else {
        console.log('🔍 Failed to load occupied dates');
        setOccupiedDates([]);
      }
    } catch (error) {
      console.error('Error loading occupied dates:', error);
      setOccupiedDates([]);
    } finally {
      setOperationLoading('occupiedDates', false);
    }
  }, [setOperationLoading, isManager, tipo, authUser, callApi, allUsers, calculateDateAvailability, getApprovedRequests]);



  // Reset calendar when tipo changes
  useEffect(() => {
    const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
    const allowedGroups = ['Limpiador', 'Developer'];

    // If user is not in allowed groups and has Asuntos Propios selected, reset to Vacaciones
    if (tipo === 'Asuntos Propios' && !allowedGroups.includes(currentUserGroup)) {
      setTipo('Vacaciones');
      return;
    }

    if (tipo !== 'Vacaciones') {
      setSelectedDates([]);
      setCalendarMonth(new Date().getMonth());
      setCalendarYear(new Date().getFullYear());
    }
  }, [tipo, authUser]);



  // Load occupied dates when calendar month/year changes or when tipo is Vacaciones o Asunto Propio
  useEffect(() => {
    const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
    const allowedGroups = ['Limpiador', 'Developer'];

    if (tipo === 'Vacaciones') {
      loadOccupiedDates(calendarYear, calendarMonth);
    } else if (tipo === 'Asunto Propio' && allowedGroups.includes(currentUserGroup)) {
      loadOccupiedDates(calendarYear, calendarMonth);
    } else {
      setOccupiedDates(prev => (prev.length === 0 ? prev : []));
      setDateAvailability(prev => (Object.keys(prev || {}).length === 0 ? prev : {}));
    }
  }, [calendarYear, calendarMonth, tipo, authUser, loadOccupiedDates]);

  // Recalculează disponibilitatea când se schimbă editingSolicitud (pentru a exclude solicitarea din calcul)
  useEffect(() => {
    if (editingSolicitud !== null && (tipo === 'Vacaciones' || tipo === 'Asunto Propio' || tipo === 'Asuntos Propios')) {
      // Recalculează disponibilitatea când se editează o solicitare
      // Asta va exclude solicitarea din calcul și va marca toate zilele ca disponibile
      if (allUsers.length > 0) {
        loadOccupiedDates(calendarYear, calendarMonth);
      }
    }
  }, [editingSolicitud, tipo, calendarYear, calendarMonth, allUsers, loadOccupiedDates]);

  // Demo solicitudes data
  const setDemoSolicitudes = useCallback(() => {
    const demoPersonalSolicitudes = [
      {
        id: 'DEMO001',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Asunto Propio',
        estado: 'Aprobada',
        motivo: 'Cita médica',
        fecha_inicio: '2024-12-15',
        fecha_fin: '2024-12-15',
        fecha_solicitud: '2024-12-10',
        duracion: 1
      },
      {
        id: 'DEMO002',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Vacaciones',
        estado: 'Pendiente',
        motivo: 'Vacaciones familiares',
        fecha_inicio: '2024-12-20',
        fecha_fin: '2024-12-27',
        fecha_solicitud: '2024-12-01',
        duracion: 8
      },
      {
        id: 'DEMO003',
        email: 'admin@demo.com',
        codigo: 'ADM001',
        nombre: 'Carlos Antonio Rodríguez',
        tipo: 'Asunto Propio',
        estado: 'Aprobada',
        motivo: 'Trámites bancarios',
        fecha_inicio: '2024-11-28',
        fecha_fin: '2024-11-28',
        fecha_solicitud: '2024-11-20',
        duracion: 1
      }
    ];

    const demoAllSolicitudes = [
      ...demoPersonalSolicitudes,
      {
        id: 'DEMO004',
        email: 'maria.gonzalez@demo.com',
        codigo: 'EMP002',
        nombre: 'María González López',
        tipo: 'Vacaciones',
        estado: 'Aprobada',
        motivo: 'Vacaciones de verano',
        fecha_inicio: '2024-08-15',
        fecha_fin: '2024-08-22',
        fecha_solicitud: '2024-07-01',
        duracion: 8
      },
      {
        id: 'DEMO005',
        email: 'juan.perez@demo.com',
        codigo: 'EMP003',
        nombre: 'Juan Pérez Martín',
        tipo: 'Asunto Propio',
        estado: 'Pendiente',
        motivo: 'Cita con abogado',
        fecha_inicio: '2024-12-30',
        fecha_fin: '2024-12-30',
        fecha_solicitud: '2024-12-25',
        duracion: 1
      },
      {
        id: 'DEMO006',
        email: 'ana.sanchez@demo.com',
        codigo: 'EMP004',
        nombre: 'Ana Sánchez Ruiz',
        tipo: 'Vacaciones',
        estado: 'Aprobada',
        motivo: 'Puente de diciembre',
        fecha_inicio: '2024-12-06',
        fecha_fin: '2024-12-09',
        fecha_solicitud: '2024-11-15',
        duracion: 4
      }
    ];

    setSolicitudes(demoPersonalSolicitudes);
    setAllSolicitudes(demoAllSolicitudes);
    
    // Calculate totals
    setTotalAsuntoPropioDays(2); // 2 days from demo data
    setTotalVacacionesDays(8); // 8 days from demo data
  }, []);

  const fetchSolicitudes = useCallback(async () => {
    setOperationLoading('solicitudes', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchSolicitudes');
      setOperationLoading('solicitudes', false);
      return;
    }
    
    try {
      // Para todos los usuarios (empleado y manager) - solicitudes personales
      const userCode = authUser?.['CODIGO'] || authUser?.codigo || '';
      const url = `${ENDPOINT}?email=${encodeURIComponent(email)}&codigo=${encodeURIComponent(userCode)}`;
      console.log('DEBUG solicitari fetch url:', url);
      const result = await callApi(url);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setSolicitudes(data);
        
        // Calculează totalul de zile pentru Asunto Propio și Vacaciones
        let totalAsuntoDays = 0;
        let totalVacacionesDays = 0;
        
        data.forEach(solicitud => {
          if (solicitud.tipo === 'Asunto Propio' && solicitud.fecha_inicio && solicitud.fecha_fin) {
            const start = new Date(solicitud.fecha_inicio);
            const end = new Date(solicitud.fecha_fin);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            totalAsuntoDays += days;
          }
          
          if (solicitud.tipo === 'Vacaciones' && solicitud.fecha_inicio && solicitud.fecha_fin) {
            const start = new Date(solicitud.fecha_inicio);
            const end = new Date(solicitud.fecha_fin);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            totalVacacionesDays += days;
          }
        });
        
        setTotalAsuntoPropioDays(totalAsuntoDays);
        setTotalVacacionesDays(totalVacacionesDays);
      }
    } catch (error) {
      console.error('Error fetching solicitudes:', error);
    }
    setOperationLoading('solicitudes', false);
  }, [authUser, email, callApi, setOperationLoading]);

  const fetchAllSolicitudes = useCallback(async () => {
    setOperationLoading('allSolicitudes', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllSolicitudes');
      setOperationLoading('allSolicitudes', false);
      return;
    }
    
    try {
      // Para managers - todas las solicitudes del sistema (sin email)
      const result = await callApi(ENDPOINT);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllSolicitudes(data);
      }
    } catch (error) {
      console.error('Error fetching all solicitudes:', error);
    }
    setOperationLoading('allSolicitudes', false);
  }, [authUser, callApi, setOperationLoading]);

  const fetchAllUsers = useCallback(async () => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllUsers');
      return;
    }
    
    try {
      const result = await callApi(API_ENDPOINTS.USERS);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setAllUsers([]);
    }
  }, [authUser, callApi]);

  const fetchAllAusencias = useCallback(async () => {
    if (!isManager) return; // Doar managers pot vedea toate ausencias-urile
    
    setOperationLoading('ausencias', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchAllAusencias');
      setOperationLoading('ausencias', false);
      return;
    }
    
    try {
      // Folosim backend-ul nou (GET /api/ausencias)
      // Pentru managers: toate ausencias-urile (fără filtru codigo)
      const url = routes.getAusencias;
      console.log('✅ [SolicitudesPage] Folosind backend-ul nou (getAusencias):', url);
      
      const result = await callApi(url);
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAllAusencias(data);
      }
    } catch (error) {
      console.error('Error fetching ausencias:', error);
      setAllAusencias([]);
    }
    setOperationLoading('ausencias', false);
  }, [authUser, isManager, callApi, setOperationLoading]);



  const fetchBajasMedicas = useCallback(async () => {
    if (!isManager) return;
    if (!BAJA_LIST_ENDPOINT) {
      console.warn('Endpoint para obtener bajas médicas no está configurado.');
      setAllBajasMedicas([]);
      return;
    }

    setOperationLoading('bajas', true);
    try {
      // Backend endpoint is GET /api/bajas-medicas (requires JWT authentication)
      const listUrl = BAJA_LIST_ENDPOINT;

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

      const response = await fetch(listUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      // Backend returns array directly, not wrapped in data property
      const data = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
        ? result
        : [];
      setAllBajasMedicas(data);
    } catch (error) {
      console.error('Error fetching bajas médicas:', error);
      setAllBajasMedicas([]);
    } finally {
      setOperationLoading('bajas', false);
    }
  }, [isManager, setOperationLoading]);

  // Funcție pentru a salva modificările la bajas médicas
  const handleSaveBajaDate = useCallback(async (idCaso, idPosicion, field, newValue) => {
    if (!isManager) return;

    setOperationLoading('updateBaja', true);
    try {
      const updateData = {
        idCaso,
        idPosicion,
        [field === 'fechaBaja' ? 'fechaBaja' : 'fechaAlta']: newValue || null,
      };

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.updateBajasMedicas, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSuccessMsg(`Fecha ${field === 'fechaBaja' ? 'baja' : 'alta'} actualizada correctamente.`);
        
        // Refreshează lista
        await fetchBajasMedicas();
        
        // Închide editarea
        setEditingBaja(null);
        setEditingBajaValue('');
      } else {
        throw new Error(result.message || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating baja médica:', error);
      setErrorMsg(
        error instanceof Error
          ? `No se pudo actualizar: ${error.message}`
          : 'No se pudo actualizar la fecha.'
      );
    } finally {
      setOperationLoading('updateBaja', false);
    }
  }, [isManager, setOperationLoading, setSuccessMsg, setErrorMsg, fetchBajasMedicas]);

  useEffect(() => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo solicitudes data instead of fetching from backend');
      setDemoSolicitudes();
      setOperationLoading('solicitudes', false);
      setOperationLoading('allSolicitudes', false);
      return;
    }

    fetchSolicitudes();

    if (isManager) {
      fetchAllSolicitudes();
      fetchAllUsers();
      fetchAllAusencias();
      fetchBajasMedicas();
    }

    activityLogger.logPageAccess('solicitudes', authUser);
  }, [authUser, isManager, fetchSolicitudes, fetchAllSolicitudes, fetchAllUsers, fetchAllAusencias, fetchBajasMedicas, setDemoSolicitudes, setOperationLoading]);
  useEffect(() => {
    if (selectedTab === 'baja' && isManager) {
      fetchBajasMedicas();
    }
  }, [selectedTab, isManager, fetchBajasMedicas]);

  const handleBajaUploadClick = useCallback(() => {
    if (!isManager) return;
    bajaFileInputRef.current?.click();
  }, [isManager]);

  const handleBajaFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!BAJA_UPLOAD_ENDPOINT) {
        setErrorMsg('Endpoint para subir bajas médicas no está configurado.');
        event.target.value = '';
        return;
      }

      setOperationLoading('uploadBajas', true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const uploadUrl = `${BAJA_UPLOAD_ENDPOINT}${
          BAJA_UPLOAD_ENDPOINT.includes('?') ? '&' : '?'
        }accion=guardar_bajas`;

        // Add JWT token for backend API calls
        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        let result = null;
        try {
          result = await response.json();
        } catch {
          // ignore parsing errors for non-JSON responses
        }

        setSuccessMsg(
          result?.message || 'Archivo de bajas médicas cargado correctamente.'
        );

        // Log upload bajas médicas
        await activityLogger.logBajaMedicaUploaded(
          { fileName: file.name, fileSize: file.size },
          authUser
        );

        if (isManager) {
          await fetchAllSolicitudes();
          await fetchAllAusencias();
          await fetchBajasMedicas();
        }
      } catch (error) {
        console.error('Error uploading bajas médicas:', error);
        setErrorMsg(
          error instanceof Error
            ? `No se pudo cargar el archivo de bajas médicas: ${error.message}`
            : 'No se pudo cargar el archivo de bajas médicas.'
        );
      } finally {
        setOperationLoading('uploadBajas', false);
        if (event.target) {
          event.target.value = '';
        }
      }
    },
    [
      authUser,
      fetchAllAusencias,
      fetchAllSolicitudes,
      isManager,
      setErrorMsg,
      setOperationLoading,
      setSuccessMsg,
      fetchBajasMedicas,
    ]
  );



  // Polling cu pause/resume automat când tab-ul nu e activ + jitter
  usePolling(() => {
    fetchSolicitudes();
    if (isManager) {
      fetchAllSolicitudes();
      fetchAllAusencias();
    }
  }, 60000, true, 12000); // 60s base + max 12s jitter

  const validateDates = () => {
    if (!fechaInicio || !fechaFin) {
      setErrorMsg('Por favor, selecciona las fechas de inicio y fin');
      return false;
    }

    // Check if dates are in the blocked holiday period (doar pentru solicitări noi, nu pentru editare)
    if (tipo === 'Vacaciones' && editingSolicitud === null && (isInHolidayBlockPeriod(fechaInicio) || isInHolidayBlockPeriod(fechaFin))) {
      setErrorMsg('No se pueden solicitar vacaciones durante el período de empleada (6 Dic - 6 Ene)');
      return false;
    }

    const [y1, m1, d1] = fechaInicio.split('-').map(Number);
    const [y2, m2, d2] = fechaFin.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculează zilele din solicitarea originală dacă se editează
    let originalDays = 0;
    if (editingSolicitud !== null && originalSolicitudData) {
      let originalFechaInicio = '';
      let originalFechaFin = '';
      
      // Gestionează FECHA combinată sau separate
      if (originalSolicitudData.FECHA && originalSolicitudData.FECHA.includes(' - ')) {
        const [inicio, fin] = originalSolicitudData.FECHA.split(' - ');
        originalFechaInicio = inicio.trim();
        originalFechaFin = fin.trim();
      } else {
        originalFechaInicio = originalSolicitudData.fecha_inicio || '';
        originalFechaFin = originalSolicitudData.fecha_fin || '';
      }
      
      if (originalFechaInicio && originalFechaFin) {
        const originalStart = new Date(originalFechaInicio);
        const originalEnd = new Date(originalFechaFin);
        originalDays = Math.ceil((originalEnd - originalStart) / (1000 * 60 * 60 * 24)) + 1;
        
        console.log('🔍 Validare editare:', {
          editingSolicitud,
          originalSolicitudData,
          originalFechaInicio,
          originalFechaFin,
          originalDays,
          tipo,
          totalVacacionesDays,
          totalAsuntoPropioDays
        });
      }
    }

    // Validare Asunto Propio
    if (tipo === 'Asuntos Propios') {
      // Când se editează o solicitare, ignorăm validările de limite (șeful poate alege orice dată)
      const isEditing = editingSolicitud !== null;
      
      if (!isEditing) {
        // Calculează totalul ajustat (exclude zilele din solicitarea originală dacă se editează și tipul se potrivește)
        const shouldExcludeOriginal = editingSolicitud !== null && 
          originalSolicitudData && 
          (originalSolicitudData.tipo === 'Asunto Propio' || originalSolicitudData.tipo === 'Asuntos Propios');
        const adjustedTotal = shouldExcludeOriginal 
          ? totalAsuntoPropioDays - originalDays 
          : totalAsuntoPropioDays;
        
        // Verifică dacă s-a ajuns la limita de 6 zile pe an
        if (adjustedTotal >= 6) {
          setErrorMsg('Has alcanzado el límite de 6 días de Asunto Propio para este año. No puedes solicitar más días de este tipo.');
          return false;
        }
        
        const diffStart = (start - today) / (1000 * 60 * 60 * 24);
        const diffZile = (end - start) / (1000 * 60 * 60 * 24) + 1;

        if (diffStart < 5) {
          setErrorMsg('No es posible solicitar un día de asunto propio con menos de 5 días de antelación.');
          return false;
        }
        if (diffZile > 6) {
          setErrorMsg('No puedes solicitar más de 6 días de asuntos propios de una vez.');
          return false;
        }
        if (diffZile < 1) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
        
        // Verifică dacă noua solicitare nu depășește limita de 6 zile pe an (folosind totalul ajustat)
        if (adjustedTotal + diffZile > 6) {
          setErrorMsg(`No puedes solicitar ${diffZile} días adicionales. Ya tienes ${adjustedTotal} días de Asunto Propio. El límite es de 6 días por año.`);
          return false;
        }
      } else {
        // La editare, doar verificăm că datele sunt valide (fecha fin >= fecha inicio)
        const diffZile = (end - start) / (1000 * 60 * 60 * 24) + 1;
        if (diffZile < 1) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
      }
    }

    // Validare Vacaciones
    if (tipo === 'Vacaciones') {
      // Când se editează o solicitare, ignorăm validările de limite (șeful poate alege orice dată)
      const isEditing = editingSolicitud !== null;
      
      if (!isEditing) {
        // Calculează totalul ajustat (exclude zilele din solicitarea originală dacă se editează și tipul se potrivește)
        const shouldExcludeOriginal = editingSolicitud !== null && 
          originalSolicitudData && 
          originalSolicitudData.tipo === 'Vacaciones';
        const adjustedTotal = shouldExcludeOriginal 
          ? totalVacacionesDays - originalDays 
          : totalVacacionesDays;
        
        // Verifică dacă s-a ajuns la limita de 31 zile
        if (adjustedTotal >= 31) {
          setErrorMsg('Has alcanzado el límite de 31 días de Vacaciones para este mes. No puedes solicitar más días de este tipo.');
          return false;
        }
        
        const diffZile = (end - start) / (1000 * 60 * 60 * 24) + 1;
        
        if ((end - start) < 0) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
        if (![15, 30, 31].includes(diffZile)) {
          setErrorMsg('Solo puedes solicitar vacaciones por quincena (15 días) o mes entero.');
          return false;
        }
        
        // Verifică dacă noua solicitare nu depășește limita de 31 zile (folosind totalul ajustat)
        if (adjustedTotal + diffZile > 31) {
          setErrorMsg(`No puedes solicitar ${diffZile} días adicionales. Ya tienes ${adjustedTotal} días de Vacaciones.`);
          return false;
        }
      } else {
        // La editare, doar verificăm că datele sunt valide (fecha fin >= fecha inicio)
        if ((end - start) < 0) {
          setErrorMsg('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
          return false;
        }
      }
    }

    return true;
  };

  const handleAdd = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setServerResp('');

    if (!validateDates()) {
      return;
    }

    // Validare motivo obligatoriu când se editează
    if (editingSolicitud !== null && !motivo.trim()) {
      setErrorMsg('El motivo es obligatorio al editar una solicitud.');
      return;
    }

    setOperationLoading('submit', true);
    
    const tipoPayload = tipo === 'Asuntos Propios' ? 'Asunto Propio' : tipo;
    const isEditing = editingSolicitud !== null;
    
    // Când se editează, folosește datele din solicitarea originală, altfel datele utilizatorului logat
    let solicitudEmail = email;
    let solicitudCodigo = authUser?.['CODIGO'] || authUser?.codigo || '';
    let solicitudNombre = authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || '';
    
    if (isEditing && originalSolicitudData) {
      // Caută solicitarea originală pentru a obține email, codigo, nombre
      const originalSolicitud = [...solicitudes, ...allSolicitudes].find(s => s.id === editingSolicitud);
      if (originalSolicitud) {
        solicitudEmail = originalSolicitud.email || email;
        solicitudCodigo = originalSolicitud.codigo || originalSolicitud.CODIGO || solicitudCodigo;
        solicitudNombre = originalSolicitud.nombre || originalSolicitud.NOMBRE || solicitudNombre;
      }
    }
    
    const data = {
      accion: isEditing ? 'update' : 'create',
      id: isEditing ? editingSolicitud : Date.now(),
      email: solicitudEmail,
      codigo: solicitudCodigo,
      nombre: solicitudNombre,
      tipo: tipoPayload,
      estado: 'Aprobada',
      motivo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };

    console.log('TRIMIT:', data);
    console.log('DEBUG authUser:', authUser);
    console.log('DEBUG codigo from authUser:', authUser?.['CODIGO'], authUser?.codigo);
    console.log('DEBUG isEditing:', isEditing);
    console.log('DEBUG accion:', data.accion);

    try {
      // Folosește backend-ul nou pentru create/update
      const endpoint = routes.getSolicitudesByEmail || (import.meta.env.DEV
        ? 'http://localhost:3000/api/solicitudes'
        : 'https://api.decaminoservicios.com/api/solicitudes');
      
      const result = await callApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      // Procesează răspunsul: poate fi array cu { status: "ok", ... } sau { success: true } sau obiect direct
      let responseData = result.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      
      console.log('🔍 Response processing:', { result, responseData, isEditing });
      
      // Verifică dacă operația a reușit
      // Pentru create: { success: true }
      // Pentru update: { status: "ok", solicitud_ok: 1 }
      // Dacă result.success este true, consideră că operația a reușit
      // Sau dacă responseData are success: true sau status: "ok"
      const isSuccess = result.success || 
        (responseData && (responseData.success === true || responseData.status === 'ok' || responseData.solicitud_ok === 1));
      
      console.log('🔍 isSuccess:', isSuccess);

      if (isSuccess) {
        // Log crearea sau actualizarea solicitării
        if (isEditing) {
          await activityLogger.logAction('solicitud_updated', {
            solicitud_id: responseData?.solicitud_id || editingSolicitud,
            data: data,
            user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
            email: authUser?.email
          });
          setSuccessMsg('Solicitud actualizada correctamente.');
        } else {
          await activityLogger.logSolicitudCreated(data, authUser);
          setSuccessMsg('Solicitud enviada correctamente.');
        }
        setServerResp(`Status: ${responseData?.status || 'ok'} - Solicitud ${isEditing ? 'actualizada' : 'guardada'} exitosamente`);
        
        // Reset form
        setTipo('Asuntos Propios');
        setFechaInicio('');
        setFechaFin('');
        setMotivo('');
        setEditingSolicitud(null);
        setOriginalSolicitudData(null);
        
        // Reîncarcă listele de solicitări
        setTimeout(() => {
          fetchSolicitudes();
          if (isManager) {
            fetchAllSolicitudes();
          }
        }, 1000);
      } else {
        setErrorMsg('No se pudo guardar la solicitud.');
        setServerResp(`Error: ${result.error || responseData?.error || 'Error desconocido'}`);
      }
    } catch (e) {
      setErrorMsg('No se pudo guardar la solicitud en línea');
      setServerResp('Error: ' + (e.message || e.toString()));
    } finally {
      // Oprește loading-ul întotdeauna, indiferent de rezultat
      setOperationLoading('submit', false);
    }
  };

  const handleExportExcel = async () => {
    try {
      // Import funcția de export Excel
      const { exportToExcelWithHeader } = await import('../utils/exportExcel');
      
      const dataToExport = isManager ? getFilteredSolicitudes : solicitudes;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }
      
      // Formatează datele pentru Excel
      const excelData = dataToExport.map(item => {
        if (selectedTab === 'ausencias') {
          return {
            id: item.id,
            nombre: item.NOMBRE || item.nombre || 'N/A',
            codigo: item.CODIGO || item.codigo || 'N/A',
            tipo: item.TIPO || item.tipo || 'N/A',
            fecha: formatDate(item.FECHA || item.fecha),
            hora: item.HORA || item.hora || 'N/A',
            ubicacion: item.LOCACION || item.locacion || 'N/A',
            motivo: item.MOTIVO || item.motivo || 'N/A',
            duracion: item.DURACION || item.duracion || 'N/A'
          };
        }

        if (selectedTab === 'baja') {
          return {
            caso_id: item.casoId || item.id,
            posicion: item.posicionId || '',
            situacion: item.situacion || '',
            dias_baja: formatNumber(item.diasBaja),
            dias_previstos_sps: formatNumber(item.diasPrevistosSps),
            inicio_pago_delegado: formatDate(item.inicioPagoDelegado),
            fin_pago_delegado: formatDate(item.finPagoDelegado),
            ultima_gestion_mutua: formatDate(item.ultimaGestionMutua),
            proxima_gestion_mutua: formatDate(item.proximaGestionMutua),
            pendiente_inss: formatNumber(item.pendienteINSS),
            demora_parte_baja: formatNumber(item.demoraParteBaja),
            fuente: item.fuente || '',
            actualizado: formatDateTime(item.updatedAt)
          };
        }

        return {
          id: item.id,
          nombre: getUserName(item.email),
          email: item.email,
          tipo: item.tipo,
          estado: item.estado,
          fecha_solicitud: formatDate(item.fecha_solicitud),
          fecha_inicio: formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha),
          fecha_fin: formatDate(item.fecha_fin || item['fecha fin']),
          duracion: `${item.FECHA ? calculateDaysFromCombinedDate(item.FECHA) : calculateDays(item.fecha_inicio || item['fecha inicio'] || item.fecha, item.fecha_fin || item['fecha fin'])} días`,
          motivo: item.motivo || ''
        };
      });

      let columns;
      if (selectedTab === 'ausencias') {
        columns = [
          { key: 'id', label: 'ID', width: 15 },
          { key: 'nombre', label: 'Empleado', width: 25 },
          { key: 'codigo', label: 'Código', width: 15 },
          { key: 'tipo', label: 'Tipo', width: 18 },
          { key: 'fecha', label: 'Fecha', width: 15 },
          { key: 'hora', label: 'Hora', width: 12 },
          { key: 'ubicacion', label: 'Ubicación', width: 25 },
          { key: 'motivo', label: 'Motivo', width: 40 },
          { key: 'duracion', label: 'Duración', width: 12 }
        ];
      } else if (selectedTab === 'baja') {
        columns = [
          { key: 'caso_id', label: 'Id. Caso', width: 15 },
          { key: 'posicion', label: 'Posición', width: 12 },
          { key: 'situacion', label: 'Situación', width: 18 },
          { key: 'dias_baja', label: 'Días de baja', width: 15 },
          { key: 'dias_previstos_sps', label: 'Previsto SPS', width: 15 },
          { key: 'inicio_pago_delegado', label: 'Inicio pago', width: 18 },
          { key: 'fin_pago_delegado', label: 'Fin pago', width: 18 },
          { key: 'ultima_gestion_mutua', label: 'Última Mutua', width: 18 },
          { key: 'proxima_gestion_mutua', label: 'Próxima Mutua', width: 18 },
          { key: 'pendiente_inss', label: 'Pendiente INSS', width: 18 },
          { key: 'demora_parte_baja', label: 'Demora parte baja', width: 20 },
          { key: 'fuente', label: 'Fuente', width: 15 },
          { key: 'actualizado', label: 'Actualizado', width: 20 }
        ];
      } else {
        columns = [
          { key: 'id', label: 'ID', width: 15 },
          { key: 'nombre', label: 'Empleado', width: 25 },
          { key: 'email', label: 'Email', width: 30 },
          { key: 'tipo', label: 'Tipo', width: 18 },
          { key: 'estado', label: 'Estado', width: 12 },
          { key: 'fecha_solicitud', label: 'Fecha Solicitud', width: 18 },
          { key: 'fecha_inicio', label: 'Fecha Inicio', width: 15 },
          { key: 'fecha_fin', label: 'Fecha Fin', width: 15 },
          { key: 'duracion', label: 'Duración', width: 12 },
          { key: 'motivo', label: 'Motivo', width: 40 }
        ];
      }
      
      // Construye el título del reporte
      const selectedTypeText =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : 'Vacaciones';

      const selectedTypeTextPdf =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : 'Vacaciones';

      const reportTitle =
        selectedTab === 'ausencias'
          ? selectedUser !== 'ALL'
            ? `AUSENCIAS - ${getUserName(selectedUser)}`
            : 'AUSENCIAS DE EMPLEADOS'
          : selectedUser !== 'ALL'
          ? `${selectedTypeTextPdf.toUpperCase()} - ${getUserName(selectedUser)}`
          : `${selectedTypeTextPdf.toUpperCase()} DE EMPLEADOS`;

      // Construye el período para mostrar
      const selectedMonthName = selectedMonth > 0 ? MONTHS[selectedMonth] : 'Todos los meses';
      const period = `${selectedTypeTextPdf} - ${selectedMonthName}`;
      
      // Mensaje informativo sobre qué se está exportando
      const filterInfo = [];
      if (selectedUser !== 'ALL') filterInfo.push(`Empleado: ${getUserName(selectedUser)}`);
      if (selectedMonth > 0) filterInfo.push(`Mes: ${selectedMonthName}`);
      filterInfo.push(`Tipo: ${selectedTypeText}`);
      if (selectedTab === 'vacaciones') filterInfo.push(`Estado: ${selectedStatus}`);
      
      console.log(`Exportando ${excelData.length} solicitudes con filtros: ${filterInfo.join(', ')}`);

      // Construye el nombre del archivo con filtros
      let filename = selectedTab === 'ausencias' ? 'ausencias' : 'solicitudes';
      
      // Agrega empleado al nombre si está seleccionado
      if (selectedUser !== 'ALL') {
        const empleadoName = getUserName(selectedUser)
          .replace(/[^a-zA-Z0-9\s]/g, '') // Elimina caracteres especiales
          .replace(/\s+/g, '_') // Reemplaza espacios con guiones bajos
          .toLowerCase();
        filename += `_${empleadoName}`;
      }
      
      // Agrega mes al nombre si está seleccionado
      if (selectedMonth > 0) {
        const mesName = MONTHS[selectedMonth].toLowerCase();
        filename += `_${mesName}`;
      }
      
      // Agrega tipo al nombre
      const tipoName =
        selectedTab === 'ausencias'
          ? 'ausencias'
          : selectedTab === 'asunto'
          ? 'asuntos'
          : selectedTab === 'baja'
          ? 'bajas'
          : 'vacaciones';
      filename += `_${tipoName}`;
      
      // Agrega estado si es vacaciones
      if (selectedTab === 'vacaciones') {
        filename += `_${selectedStatus.toLowerCase()}`;
      }

      // Export a Excel con header de la compañía
      await exportToExcelWithHeader(
        excelData,
        columns,
        reportTitle,
        filename,
        {},
        period
      );

      // Log export-ul de date
      await activityLogger.logDataExport('solicitudes_excel', {
        count: excelData.length,
        filters: {
          isManager: isManager,
          selectedTab: selectedTab,
          selectedStatus: selectedStatus,
          selectedMonth: selectedMonth,
          selectedUser: selectedUser
        }
      }, authUser);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error al exportar a Excel. Por favor, inténtalo de nuevo.');
    }
  };

  const handleExportPDF = async () => {
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
          s2.onerror = () => reject(new Error('No se pudieron cargar las fuentes pdfMake'));
          document.head.appendChild(s2);
        };
        s1.onerror = () => reject(new Error('No se pudo cargar pdfMake'));
        document.head.appendChild(s1);
      });

      await ensurePdfMake();

      const dataToExport = isManager ? getFilteredSolicitudes : solicitudes;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      // Construye el cuerpo de la tabla
      let tableBody;
      let tableWidths;
      if (selectedTab === 'ausencias') {
        tableBody = [
          ['Empleado', 'Código', 'Tipo', 'Fecha', 'Hora', 'Ubicación', 'Motivo', 'Duración'],
          ...dataToExport.map(item => [
            item.NOMBRE || item.nombre || '',
            item.CODIGO || item.codigo || '',
            item.TIPO || item.tipo || '',
            formatDate(item.FECHA || item.fecha) || '',
            item.HORA || item.hora || '',
            item.LOCACION || item.locacion || '',
            item.MOTIVO || item.motivo || '',
            getAusenciaDurationDisplay(item).text
          ])
        ];
        tableWidths = [90, 60, 60, 60, 50, 90, 120, 60];
      } else if (selectedTab === 'baja') {
        tableBody = [
          ['Caso', 'Posición', 'Situación', 'Días baja', 'Previsto SPS', 'Inicio pago', 'Fin pago', 'Última Mutua', 'Próxima Mutua', 'Pendiente INSS', 'Fuente', 'Actualizado'],
          ...dataToExport.map(item => [
            item.casoId || item.id || '',
            item.posicionId || '',
            item.situacion || '',
            formatNumber(item.diasBaja),
            formatNumber(item.diasPrevistosSps),
            formatDate(item.inicioPagoDelegado),
            formatDate(item.finPagoDelegado),
            formatDate(item.ultimaGestionMutua),
            formatDate(item.proximaGestionMutua),
            formatNumber(item.pendienteINSS),
            item.fuente || '',
            formatDateTime(item.updatedAt)
          ])
        ];
        tableWidths = [60, 50, 80, 60, 70, 70, 70, 80, 80, 70, 60, 90];
      } else {
        tableBody = [
          ['Empleado', 'Email', 'Tipo', 'Estado', 'F. Solicitud', 'F. Inicio', 'F. Fin', 'Duración', 'Motivo'],
          ...dataToExport.map(item => [
            getUserName(item.email) || '',
            item.email || '',
            item.tipo || '',
            item.estado || '',
            formatDate(item.fecha_solicitud) || '',
            formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha) || '',
            formatDate(item.fecha_fin || item['fecha fin']) || '',
            `${item.FECHA ? calculateDaysFromCombinedDate(item.FECHA) : calculateDays(item.fecha_inicio || item['fecha inicio'] || item.fecha, item.fecha_fin || item['fecha fin'])} días`,
            item.motivo || ''
          ])
        ];
        tableWidths = [80, 120, 60, 50, 60, 60, 60, 50, '*'];
      }

      const selectedTypeTextPdf =
        selectedTab === 'ausencias'
          ? 'Ausencias'
          : selectedTab === 'baja'
          ? 'Bajas Médicas'
          : selectedTab === 'asunto'
          ? 'Asuntos Propios'
          : 'Vacaciones';

      const reportTitle =
        selectedTab === 'ausencias'
          ? selectedUser !== 'ALL'
            ? `AUSENCIAS - ${getUserName(selectedUser)}`
            : 'AUSENCIAS DE EMPLEADOS'
          : selectedUser !== 'ALL'
          ? `${selectedTypeTextPdf.toUpperCase()} - ${getUserName(selectedUser)}`
          : `${selectedTypeTextPdf.toUpperCase()} DE EMPLEADOS`;

      // Construye el período para mostrar
      const selectedMonthName = selectedMonth > 0 ? MONTHS[selectedMonth] : 'Todos los meses';
      const period = `${selectedTypeTextPdf} - ${selectedMonthName}`;

      const docDefinition = {
        pageOrientation: 'landscape',
        content: [
          // Header compañía
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
          
          // Título del reporte
          { text: reportTitle, style: 'reportTitle' },
          { text: `Período: ${period}`, style: 'period', margin: [0, 0, 0, 10] },
          
          // Tabla con datos
          {
            table: { 
              headerRows: 1, 
              widths: tableWidths, 
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
            margin: [0, 0, 0, 8]
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
          }
        }
      };

      // Construye el nombre del archivo con filtros (igual que Excel)
      let filename = selectedTab === 'ausencias' ? 'ausencias' : 'solicitudes';
      
      if (selectedUser !== 'ALL') {
        const empleadoName = getUserName(selectedUser)
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .toLowerCase();
        filename += `_${empleadoName}`;
      }
      
      if (selectedMonth > 0) {
        const mesName = MONTHS[selectedMonth].toLowerCase();
        filename += `_${mesName}`;
      }
      
      const tipoName =
        selectedTab === 'ausencias'
          ? 'ausencias'
          : selectedTab === 'asunto'
          ? 'asuntos'
          : selectedTab === 'baja'
          ? 'bajas'
          : 'vacaciones';
      filename += `_${tipoName}`;
      
      if (selectedTab === 'vacaciones') {
        filename += `_${selectedStatus.toLowerCase()}`;
      }

      filename += '.pdf';

      window.pdfMake.createPdf(docDefinition).download(filename);

      // Log export-ul de date
      await activityLogger.logDataExport('solicitudes_pdf', {
        count: dataToExport.length,
        filters: {
          isManager: isManager,
          selectedTab: selectedTab,
          selectedStatus: selectedStatus,
          selectedMonth: selectedMonth,
          selectedUser: selectedUser
        }
      }, authUser);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF. Por favor, inténtalo de nuevo.');
    }
  };

  const handleEdit = (solicitud) => {
    // Populează formularul cu datele solicitării existente
    setTipo(solicitud.tipo === 'Asunto Propio' ? 'Asuntos Propios' : solicitud.tipo);
    
    // Gestionează FECHA combinată (ex: "2025-11-03 - 2025-12-02")
    let fechaInicioValue = '';
    let fechaFinValue = '';
    
    if (solicitud.FECHA && solicitud.FECHA.includes(' - ')) {
      const [inicio, fin] = solicitud.FECHA.split(' - ');
      fechaInicioValue = inicio.trim();
      fechaFinValue = fin.trim();
    } else {
      fechaInicioValue = solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha || solicitud.FECHA || '';
      fechaFinValue = solicitud.fecha_fin || solicitud["fecha fin"] || '';
    }
    
    setFechaInicio(fechaInicioValue);
    setFechaFin(fechaFinValue);
    setMotivo(solicitud.motivo || '');
    setEditingSolicitud(solicitud.id);
    
    // Salvează datele originale pentru validare
    setOriginalSolicitudData({
      tipo: solicitud.tipo,
      fecha_inicio: fechaInicioValue,
      fecha_fin: fechaFinValue,
      FECHA: solicitud.FECHA
    });
    
    // Schimbă la tab-ul de formular
    setActiveTab('nueva');
    // Scroll la formular
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleDeleteClick = (solicitudId) => {
    setDeleteConfirm({ isOpen: true, solicitudId });
  };

  const handleDelete = async (solicitudId) => {
    try {
      setOperationLoading('delete', true);
      
      // Găsește solicitarea pentru a obține codigo-ul angajatului
      const solicitudToDelete = [...solicitudes, ...allSolicitudes].find(s => s.id === solicitudId);
      const codigo = solicitudToDelete?.codigo || solicitudToDelete?.CODIGO || '';
      
      // Folosește același endpoint cu accion: 'delete'
      const data = {
        accion: 'delete',
        id: solicitudId,
        codigo: codigo
      };
      
      console.log('TRIMIT DELETE:', data);
      
      // Folosește backend-ul nou pentru delete
      const endpoint = routes.getSolicitudesByEmail || (import.meta.env.DEV
        ? 'http://localhost:3000/api/solicitudes'
        : 'https://api.decaminoservicios.com/api/solicitudes');
      
      const result = await callApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      // Procesează răspunsul: poate fi array cu { status: "ok", ... } sau { success: true } sau obiect direct
      let responseData = result.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      
      // Verifică dacă operația a reușit
      // Pentru delete: { status: "ok", solicitud_ok: 1 } sau { success: true }
      const isSuccess = result.success && (
        (responseData && responseData.success === true) ||
        (responseData && responseData.status === 'ok') || 
        (responseData && responseData.solicitud_ok === 1) ||
        result.success
      );

      if (isSuccess) {
        // Log ștergerea solicitării
        await activityLogger.logAction('solicitud_deleted', {
          solicitud_id: responseData?.deleted_id || responseData?.solicitud_id || solicitudId,
          codigo: responseData?.codigo || codigo,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          email: authUser?.email
        });
        
        setSuccessMsg('Solicitud eliminada correctamente.');
        setDeleteConfirm({ isOpen: false, solicitudId: null }); // Închide modalul
        // Reîncarcă listele
        fetchSolicitudes();
        if (isManager) {
          fetchAllSolicitudes();
        }
        setTimeout(() => setSuccessMsg(''), 2500);
      } else {
        setErrorMsg(`No se pudo eliminar la solicitud: ${result.error || responseData?.error || 'Error desconocido'}`);
        setDeleteConfirm({ isOpen: false, solicitudId: null }); // Închide modalul chiar dacă e eroare
      }
    } catch (e) {
      console.error('Error deleting solicitud:', e);
      setErrorMsg(`Error al eliminar: ${e.message}`);
      setDeleteConfirm({ isOpen: false, solicitudId: null }); // Închide modalul în caz de eroare
    } finally {
      setOperationLoading('delete', false);
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Aprobada':
        return 'bg-green-100 text-green-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rechazada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo) => {
    if (isBajaMedica(tipo)) {
      return 'bg-rose-100 text-rose-800';
    }
    switch (tipo) {
      case 'Asunto Propio':
        return 'bg-blue-100 text-blue-800';
      case 'Vacaciones':
        return 'bg-purple-100 text-purple-800';
      case 'Ausencia':
      case 'AUSENCIA':
        return 'bg-orange-100 text-orange-800';
      case 'Salida Centro':
      case 'Entrada Centro':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Formatează flexibil câmpul FECHA care poate veni fie ca o dată simplă
  // fie ca un interval "YYYY-MM-DD - YYYY-MM-DD"
  const formatFechaFlexible = (value, fallbackInicio, fallbackFin) => {
    if (value && typeof value === 'string' && value.includes(' - ')) {
      const [ini, fin] = value.split(' - ').map(s => s.trim());
      const iniFmt = formatDate(ini);
      const finFmt = formatDate(fin);
      if (iniFmt !== '-' && finFmt !== '-') return `${iniFmt} - ${finFmt}`;
    }
    // Dacă nu este combinată, încearcă să formatezi valoarea simplă
    const simple = formatDate(value);
    if (simple !== '-') return simple;
    // Fallback pe perechea (inicio, fin) dacă există separat
    const iniFmt = formatDate(fallbackInicio);
    const finFmt = formatDate(fallbackFin);
    if (iniFmt !== '-' && finFmt !== '-') return `${iniFmt} - ${finFmt}`;
    return '-';
  };

  const calculateDays = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin || fechaInicio === '-' || fechaFin === '-' || fechaInicio === '' || fechaFin === '') return 0;
    try {
      const start = new Date(fechaInicio);
      const end = new Date(fechaFin);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    } catch (error) {
      return 0;
    }
  };

  // Funcție pentru calculul zilelor din FECHA combinată (ex: "2025-10-09 - 2025-10-23")
  const calculateDaysFromCombinedDate = (fechaCombinada) => {
    if (!fechaCombinada || fechaCombinada === '-' || fechaCombinada === '') return 0;
    try {
      // Verifică dacă FECHA conține " - " (format combinat)
      if (fechaCombinada.includes(' - ')) {
        const [fechaInicio, fechaFin] = fechaCombinada.split(' - ');
        return calculateDays(fechaInicio.trim(), fechaFin.trim());
      }
      // Dacă nu e format combinat, returnează 1 zi
      return 1;
    } catch (error) {
      return 0;
    }
  };

  const formatSecondsToHHMMSS = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds)) {
      return null;
    }
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDecimalDuration = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return formatSecondsToHHMMSS(numeric * 3600);
  };

  const DAY_BASED_ABSENCE_TYPES = new Set([
    'Vacaciones',
    'Asunto Propio',
    'Asuntos Propios',
    'Permiso Retribuido',
    'Permiso Recuperable',
    'Permiso No Retribuido',
    'Permiso sin sueldo',
    'Permiso médico',
    'Permiso',
  ]);

  const getFirstValue = (item, keys) => {
    if (!item) return null;
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
        return item[key];
      }
    }
    return null;
  };

  const isDayBasedAbsenceType = (tipo = '') => {
    const normalized = String(tipo || '').trim();
    return DAY_BASED_ABSENCE_TYPES.has(normalized);
  };

  const getApprovedDaysCount = (item) => {
    if (!item) return 0;
    const diasValue = getFirstValue(item, ['dias_aprobados', 'DIAS_APROBADOS', 'diasAprobados']);
    if (diasValue !== null && diasValue !== undefined && diasValue !== '') {
      const numeric = Number(diasValue);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    const fechaInicio = getFirstValue(item, ['fecha_inicio', 'FECHA_INICIO', 'fechaInicio']);
    const fechaFin = getFirstValue(item, ['fecha_fin', 'FECHA_FIN', 'fechaFin']);
    if (fechaInicio && fechaFin) {
      return calculateDays(fechaInicio, fechaFin);
    }

    const fechaCombinada = getFirstValue(item, ['FECHA', 'fecha']);
    if (fechaCombinada) {
      return calculateDaysFromCombinedDate(fechaCombinada);
    }

    return 0;
  };

  const getApprovedHoursLabel = (item) => {
    if (!item) return null;
    const horasValue = getFirstValue(item, ['horas_aprobadas', 'HORAS_APROBADAS', 'horasAprobadas']);
    if (typeof horasValue === 'string' && horasValue.trim() !== '') {
      if (horasValue.includes(':')) {
        return horasValue;
      }
      const formatted = formatDecimalDuration(horasValue);
      if (formatted) {
        return formatted;
      }
      return horasValue;
    }
    if (typeof horasValue === 'number' && !Number.isNaN(horasValue)) {
      const formatted = formatDecimalDuration(horasValue);
      if (formatted) {
        return formatted;
      }
      return horasValue.toString();
    }

    const duracion = getFirstValue(item, ['DURACION', 'duracion']);
    if (typeof duracion === 'string' && duracion.trim() !== '') {
      if (duracion.includes(':')) {
        return duracion;
      }
      const unidad = getFirstValue(item, ['UNIDAD_DURACION', 'unidad_duracion']);
      return unidad ? `${duracion} ${unidad}` : duracion;
    }
    if (typeof duracion === 'number') {
      const formatted = formatDecimalDuration(duracion);
      if (formatted) {
        return formatted;
      }
      return duracion.toString();
    }

    return null;
  };

  const getAusenciaDurationDisplay = (item) => {
    const tipo = getFirstValue(item, ['TIPO', 'tipo']);
    const isDayBased = isDayBasedAbsenceType(tipo);

    if (isDayBased) {
      const days = getApprovedDaysCount(item);
      return {
        isDayBased: true,
        text: days > 0 ? `${days} día${days === 1 ? '' : 's'}` : 'Sin días',
      };
    }

    const hours = getApprovedHoursLabel(item);
    return {
      isDayBased: false,
      text: hours || 'Sin duración',
    };
  };

  const getUserName = useCallback((email) => {
    const user = allUsers.find(u => u['CORREO ELECTRONICO'] === email);
    return user ? (user['NOMBRE / APELLIDOS'] || email) : email;
  }, [allUsers]);

  const getFilteredSolicitudes = useMemo(() => {
    let filtered;
    
    // Selectează sursa de date în funcție de tab-ul selectat
    if (selectedTab === 'ausencias') {
      filtered = allAusencias;
    } else if (selectedTab === 'baja') {
      // Formatează și deduplică bazându-ne pe cheia unică (Id.Caso + Id.Posición)
      const formatted = allBajasMedicas.map(formatBajaRecord);
      // Elimină duplicate-urile bazându-ne pe ID-ul unic
      const seen = new Set();
      filtered = formatted.filter(item => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });
    } else {
      filtered = allSolicitudes;
    }
    
    if (selectedUser !== 'ALL') {
      if (selectedTab === 'ausencias') {
        // Pentru absențe, filtrăm după CODIGO sau NOMBRE
        filtered = filtered.filter(a => {
          const userCode = a.CODIGO || a.codigo || '';
          const userName = a.NOMBRE || a.nombre || '';
          const selectedUserData = allUsers.find(u => u['CORREO ELECTRONICO'] === selectedUser);
          if (selectedUserData) {
            const selectedUserCode = selectedUserData['CODIGO'] || selectedUserData.codigo || '';
            const selectedUserName = selectedUserData['NOMBRE / APELLIDOS'] || selectedUserData.nombre || '';
            return userCode === selectedUserCode || userName === selectedUserName;
          }
          return false;
        });
      } else {
        filtered = filtered.filter(s => s.email === selectedUser);
      }
    }
    
    if (selectedTab === 'asunto') {
      filtered = filtered.filter(s => s.tipo === 'Asunto Propio');
    } else if (selectedTab === 'vacaciones') {
      filtered = filtered.filter(s => s.tipo === 'Vacaciones');
    } else if (selectedTab === 'baja') {
      filtered = filtered.filter(s => isBajaMedica(s.tipo));
    }
    if (selectedMonth > 0) {
      filtered = filtered.filter(s => {
        // Filtrează după FECHA combinată sau fecha_inicio
        let fechaInicio = '';
        if (selectedTab === 'ausencias') {
          // Pentru absențe, folosim FECHA
          fechaInicio = s.FECHA || s.fecha || '';
        } else {
          // Pentru solicitări, folosim logica existentă
          if (s.FECHA && s.FECHA.includes(' - ')) {
            fechaInicio = s.FECHA.split(' - ')[0].trim();
          } else {
            fechaInicio = s.fecha_inicio || s["fecha inicio"] || s.fecha;
          }
        }
        if (!fechaInicio) return false;
        const luna = parseInt(fechaInicio.split('-')[1], 10);
        return luna === selectedMonth;
      });
    }
    
    // Sortare după created_at (cele mai recente sus)
    const sorted = filtered.sort((a, b) => {
      let createdA, createdB;
      if (selectedTab === 'ausencias') {
        createdA = a.created_at || a.FECHA || a.fecha || '';
        createdB = b.created_at || b.FECHA || b.fecha || '';
      } else {
        createdA = a.created_at || a.fecha_solicitud || a.fecha || '';
        createdB = b.created_at || b.fecha_solicitud || b.fecha || '';
      }
      return createdB.localeCompare(createdA); // Descendent - cele mai noi prima
    });
    return sorted;
  }, [selectedTab, selectedUser, selectedMonth, allAusencias, allSolicitudes, allBajasMedicas, allUsers]);

  // Statistici pentru bajas médicas
  const bajasStats = useMemo(() => {
    if (selectedTab !== 'baja') {
      return { total: 0, cerradas: 0, abiertas: 0 };
    }
    
    const formatted = allBajasMedicas.map(formatBajaRecord);
    // Elimină duplicate-urile
    const seen = new Set();
    const uniqueBajas = formatted.filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
    
    const total = uniqueBajas.length;
    const cerradas = uniqueBajas.filter(item => {
      const situacion = String(item.situacion || item.estado || '').toLowerCase();
      return situacion.includes('alta') && !situacion.includes('prevista');
    }).length;
    const abiertas = total - cerradas;
    
    return { total, cerradas, abiertas };
  }, [selectedTab, allBajasMedicas]);

  const userList = useMemo(
    () => allUsers.map(u => u['CORREO ELECTRONICO']).filter(Boolean),
    [allUsers]
  );
  
  // Función para filtrar usuarios por búsqueda (memoizată pentru performanță)
  const getFilteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) {
      return [
        { email: 'ALL', name: 'Todos los empleados' },
        ...userList.map(email => ({
          email,
          name: getUserName(email)
        }))
      ];
    }
    
    const searchLower = userSearchTerm.toLowerCase();
    const filtered = userList
      .map(email => ({
        email,
        name: getUserName(email)
      }))
      .filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    
    return [
      { email: 'ALL', name: 'Todos los empleados' },
      ...filtered
    ];
  }, [userSearchTerm, userList, getUserName]);

  // Mobile: control expand/collapse pentru "Motivo" per solicitud
  const [expandedMotivos, setExpandedMotivos] = useState({}); // { [id]: boolean }

  // Auto-expand pentru solicitări respinse
  useEffect(() => {
    try {
      const next = { ...expandedMotivos };
      for (const s of solicitudes || []) {
        const sid = s?.id ?? `idx_${Math.random()}`;
        if (s?.estado === 'Rechazada' && next[sid] !== true) {
          next[sid] = true;
        }
      }
      setExpandedMotivos(next);
      // eslint-disable-next-line no-empty
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes]);

  const isMotivoExpanded = (solicitud) => {
    const sid = solicitud?.id ?? 'unknown';
    return !!expandedMotivos[sid];
  };

  const toggleMotivo = (solicitud) => {
    const sid = solicitud?.id ?? 'unknown';
    setExpandedMotivos(prev => ({ ...prev, [sid]: !prev[sid] }));
  };

  const copyMotivo = async (texto) => {
    try {
      await navigator.clipboard.writeText(String(texto ?? ''));
    } catch {
      // ignore
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
              Gestión de Solicitudes
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Solicita días de asuntos propios o vacaciones
            </p>
          </div>
        </div>
      </div>

      {/* Botón Reportar Error */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de solicitudes', '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span className="text-base">📱</span>
          Reportar error
        </button>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab('lista')}
            className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'lista'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'lista' 
                ? 'bg-red-400 opacity-30 blur-md animate-pulse' 
                : 'bg-red-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                activeTab === 'lista' 
                  ? 'bg-white/20' 
                  : 'bg-red-100 group-hover:bg-red-200'
              }`}>
                <span className={`text-xl ${
                  activeTab === 'lista' ? 'text-white' : 'text-red-600'
                }`}>📋</span>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold">Mis Solicitudes</div>
                <div className={`text-xs ${
                  activeTab === 'lista' ? 'text-white/80' : 'text-red-500'
                }`}>Ver mis peticiones</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('nueva')}
            className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
              activeTab === 'nueva'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              activeTab === 'nueva' 
                ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
            }`}></div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                activeTab === 'nueva' 
                  ? 'bg-white/20' 
                  : 'bg-green-100 group-hover:bg-green-200'
              }`}>
                <span className={`text-xl ${
                  activeTab === 'nueva' ? 'text-white' : 'text-green-600'
                }`}>➕</span>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold">Nueva Solicitud</div>
                <div className={`text-xs ${
                  activeTab === 'nueva' ? 'text-white/80' : 'text-green-500'
                }`}>Crear petición</div>
              </div>
            </div>
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('todas')}
              className={`group relative px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'todas'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'todas' 
                  ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeTab === 'todas' 
                    ? 'bg-white/20' 
                    : 'bg-blue-100 group-hover:bg-blue-200'
                }`}>
                  <span className={`text-xl ${
                    activeTab === 'todas' ? 'text-white' : 'text-blue-600'
                  }`}>👥</span>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Todas las Solicitudes</div>
                  <div className={`text-xs ${
                    activeTab === 'todas' ? 'text-white/80' : 'text-blue-500'
                  }`}>Gestionar equipo</div>
                </div>
              </div>
            </button>
          )}
        </div>

        {activeTab === 'lista' ? (
          // Lista de solicitudes del usuario
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Mis Solicitudes
              </h2>
              <div className="flex gap-3">
                {totalAsuntoPropioDays > 0 && (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    📅 Asunto Propio: {totalAsuntoPropioDays} días
                  </span>
                )}
                {totalVacacionesDays > 0 && (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                    🏖️ Vacaciones: {totalVacacionesDays} días
                  </span>
                )}
              </div>
            </div>
            
            {isOperationLoading('solicitudes') ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text="Cargando solicitudes..." />
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tienes solicitudes aún.
              </div>
            ) : (
              <div className="space-y-3">
                {solicitudes.map((solicitud, index) => (
                  <div key={solicitud.id || index} className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-red-500">
                    {/* Header compact pe mobil, complet pe ecrane mari */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                          <span className="text-white text-lg">
                            {solicitud.tipo === 'Vacaciones' ? '🏖️' : '📅'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">{solicitud.tipo}</h3>
                          {/* ID și Codigo: mutat sub tip pe mobil */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              ID: {solicitud.id}
                            </span>
                            {solicitud.codigo && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                Código: {solicitud.codigo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(solicitud.estado)}`}>
                              {solicitud.estado === 'Aprobada' ? '✅' : solicitud.estado === 'Pendiente' ? '⏳' : '❌'} {solicitud.estado}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Grid: 1 col pe mobil, 2 pe tablet, 4 pe desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha Solicitud</span>
                        <p className="text-sm font-semibold text-blue-900 break-words">{formatDate(solicitud.fecha_solicitud)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Período</span>
                        <p className="text-sm font-semibold text-gray-900 break-words">{solicitud.FECHA || formatDate(solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</span>
                        <p className="text-sm font-semibold text-gray-900 break-words">{solicitud.FECHA ? (solicitud.FECHA.includes(' - ') ? solicitud.FECHA.split(' - ')[1] : solicitud.FECHA) : formatDate(solicitud.fecha_fin || solicitud["fecha fin"])}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
            <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                        <p className="text-sm font-semibold text-red-600 break-words">{solicitud.FECHA ? calculateDaysFromCombinedDate(solicitud.FECHA) : calculateDays(solicitud.fecha_inicio || solicitud["fecha inicio"] || solicitud.fecha, solicitud.fecha_fin || solicitud["fecha fin"])} días</p>
                      </div>
                    </div>
                    
                    {/* Motivo: clamp pe mobil, complet pe >= sm */}
                    {solicitud.motivo && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                            {/* Container text cu clamp pe mobil când e colapsat */}
                            <div className={`text-sm text-blue-800 break-words ${isMotivoExpanded(solicitud) ? '' : 'line-clamp-2 sm:line-clamp-none'}`}>
                              {solicitud.motivo}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Copiere motiv */}
                            <button
                              type="button"
                              onClick={() => copyMotivo(solicitud.motivo)}
                              className="hidden sm:inline-flex px-2 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                              title="Copiar"
                            >
                              Copiar
                            </button>
                            {/* Toggle doar pe mobil */}
                            <button
                              type="button"
                              onClick={() => toggleMotivo(solicitud)}
                              className="sm:hidden px-2 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              {isMotivoExpanded(solicitud) ? 'Ver menos' : 'Ver más'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'todas' ? (
          // Lista de todas las solicitudes (solo para managers)
          <div>
            {/* Header con título y botones de export */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">
              Todas las Solicitudes
            </h2>
            
              {/* Botones export compactos */}
              <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📊</span>
                    <span className="text-sm">Excel</span>
                </div>
              </button>

              <button
                onClick={handleExportPDF}
                  className="group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📄</span>
                    <span className="text-sm">PDF</span>
                </div>
              </button>
              </div>
            </div>

            {/* Filtros para managers - Layout refinado */}
            <div className="space-y-4 mb-6">
              {/* Selector usuario refinado */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-2xl border border-gray-200 shadow-lg backdrop-blur-sm user-dropdown-container relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-lg">👥</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Filtrar por Empleado</h3>
                      <p className="text-xs text-gray-500">Busca y selecciona un empleado específico</p>
                    </div>
                  </div>
                  <div className="relative flex-1 max-w-lg">
                    <div className="relative group">
                    <input
                      id="manager-user-search"
                      name="manager-user-search"
                      type="text"
                        placeholder="Escribe el nombre o email del empleado..."
                      value={userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                        className="w-full px-4 py-3 pl-12 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm transition-all duration-300 text-sm placeholder-gray-400 shadow-sm group-hover:shadow-md"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <span className="text-gray-400 text-lg group-focus-within:text-blue-500 transition-colors">🔍</span>
                    </div>
                    <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowUserDropdown(!showUserDropdown);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-all duration-200 p-1 rounded-lg hover:bg-blue-50"
                      >
                        <span className={`transform transition-transform duration-300 ${showUserDropdown ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>
                  
                    {/* Dropdown refinado */}
                  {showUserDropdown && (
                      <div className="absolute z-[9999] w-full mt-3 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto" 
                           style={{ 
                             zIndex: 9999,
                             position: 'absolute',
                             top: '100%',
                             left: 0,
                             right: 0
                           }}>
                      {allUsers.length === 0 ? (
                          <div className="px-6 py-12 text-center text-gray-500">
                            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                            <p className="text-sm font-medium">Cargando empleados...</p>
                        </div>
                      ) : (
                          <div className="p-2">
                            {getFilteredUsers.map(user => (
                        <button
                          key={user.email}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            setSelectedUser(user.email);
                            setUserSearchTerm(user.name);
                            setShowUserDropdown(false);
                          }}
                              className={`w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 flex items-center gap-3 rounded-xl mb-1 ${
                                selectedUser === user.email ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-l-4 border-l-blue-500 shadow-sm' : ''
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all duration-200 ${
                            user.email === 'ALL' 
                              ? 'bg-gradient-to-br from-gray-500 to-gray-600' 
                                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
                              }`}>
                            <span className="text-white text-sm font-bold">
                              {user.email === 'ALL' ? '👥' : user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                            {user.email !== 'ALL' && (
                              <p className="text-xs text-gray-500">{user.email}</p>
                            )}
                          </div>
                          {selectedUser === user.email && (
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                          )}
                        </button>
                            ))}
                          </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Tabs para tipo - Modernos con efectos */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedTab('asunto')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'asunto'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
                      : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'asunto' 
                      ? 'bg-red-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-red-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span>Asuntos Propios</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedTab('vacaciones')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'vacaciones'
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-200'
                      : 'bg-white text-cyan-600 border-2 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'vacaciones' 
                      ? 'bg-cyan-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-cyan-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🏖️</span>
                    <span>Vacaciones</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedTab('ausencias')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'ausencias'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                      : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
                  }`}
                >
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'ausencias' 
                      ? 'bg-orange-400 opacity-25 blur-md animate-pulse' 
                      : 'bg-orange-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🚫</span>
                    <span>Ausencias</span>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedTab('baja')}
                  className={`group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    selectedTab === 'baja'
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-200'
                      : 'bg-white text-rose-600 border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50'
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    selectedTab === 'baja'
                      ? 'bg-rose-400 opacity-25 blur-md animate-pulse'
                      : 'bg-rose-400 opacity-0 group-hover:opacity-15 blur-md'
                  }`}></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg">🩺</span>
                    <span>Bajas Médicas</span>
                  </div>
                </button>
              </div>


              {/* Selector meses - Moderno con efectos */}
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max pb-2">
                  {MONTHS.map((month, idx) => (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(idx)}
                      className={`group relative px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md whitespace-nowrap ${
                        selectedMonth === idx
                          ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-indigo-200'
                          : 'bg-white text-indigo-600 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                      }`}
                    >
                      {/* Glow effect */}
                      <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                        selectedMonth === idx 
                          ? 'bg-indigo-400 opacity-20 blur-sm animate-pulse' 
                          : 'bg-indigo-400 opacity-0 group-hover:opacity-10 blur-sm'
                      }`}></div>
                      <span className="relative flex items-center gap-1">
                        {idx === 0 && <span className="text-xs">📅</span>}
                        {month}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

              {selectedTab === 'baja' && isManager && (
                <div className="w-full mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-rose-700">
                    Sube el fichero XML/Excel con las bajas médicas para sincronizarlo con el
                    sistema. Se registrará al usuario que realiza la carga.
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBajaUploadClick}
                      disabled={
                        isOperationLoading('uploadBajas') || !BAJA_UPLOAD_ENDPOINT
                      }
                      className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 ${
                        isOperationLoading('uploadBajas') || !BAJA_UPLOAD_ENDPOINT
                          ? 'bg-rose-200 text-rose-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700'
                      }`}
                    >
                      <span>{isOperationLoading('uploadBajas') ? '⏳' : '🩺'}</span>
                      <span>
                        {isOperationLoading('uploadBajas')
                          ? 'Cargando...'
                          : 'Cargar listado'}
                      </span>
                    </button>
                    {!BAJA_UPLOAD_ENDPOINT && (
                      <span className="text-xs text-rose-500">
                        Configura `VITE_UPLOAD_BAJAS_MEDICAS` para habilitar la carga.
                      </span>
                    )}
                    <input
                      ref={bajaFileInputRef}
                      id="bajas-medicas-file"
                      name="bajas-medicas-file"
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.xml"
                      onChange={handleBajaFileChange}
                    />
                  </div>
                </div>
              )}

            {/* Panel de statistici pentru bajas médicas */}
            {selectedTab === 'baja' && isManager && (
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-6 shadow-lg mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                    <span>📊</span>
                    Estadísticas de Bajas Médicas
                  </h3>
                  <button
                    onClick={() => {
                      setOperationLoading('refreshBajas', true);
                      fetchBajasMedicas().finally(() => {
                        setOperationLoading('refreshBajas', false);
                      });
                    }}
                    disabled={isOperationLoading('refreshBajas') || isOperationLoading('bajas')}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Actualizar lista"
                  >
                    <RefreshCw 
                      className={`w-4 h-4 ${isOperationLoading('refreshBajas') || isOperationLoading('bajas') ? 'animate-spin' : ''}`} 
                    />
                    <span>Actualizar</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-md">
                    <div className="text-sm font-medium text-gray-600 mb-1">Total Casos</div>
                    <div className="text-3xl font-bold text-blue-700">{bajasStats.total}</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-md">
                    <div className="text-sm font-medium text-gray-600 mb-1">Casos Cerrados</div>
                    <div className="text-3xl font-bold text-green-700">{bajasStats.cerradas}</div>
                    <div className="text-xs text-gray-500 mt-1">Con alta médica</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-orange-200 shadow-md">
                    <div className="text-sm font-medium text-gray-600 mb-1">Casos Abiertos</div>
                    <div className="text-3xl font-bold text-orange-700">{bajasStats.abiertas}</div>
                    <div className="text-xs text-gray-500 mt-1">En seguimiento</div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista filtrada */}
            {(isOperationLoading('allSolicitudes') || (selectedTab === 'ausencias' && isOperationLoading('ausencias'))) ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text={selectedTab === 'ausencias' ? "Cargando ausencias..." : "Cargando todas las solicitudes..."} />
              </div>
            ) : (
              <div className="space-y-4">
                {successMsg && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {successMsg}
                  </div>
                )}
                
                {getFilteredSolicitudes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedTab === 'ausencias'
                      ? 'No existen ausencias para esta selección.'
                      : selectedTab === 'baja'
                      ? 'No existen bajas médicas para esta selección.'
                      : 'No existen solicitudes para esta selección.'}
                  </div>
                ) : (
                  getFilteredSolicitudes.map(item => {
                    const durationInfo = getAusenciaDurationDisplay(item);
                    return (
                    <div key={item.id || item.email} className="card hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                            <span className="text-white text-xl group-hover:scale-110 transition-transform duration-300">
                              {selectedTab === 'ausencias'
                                ? '🚫'
                                : selectedTab === 'baja' || isBajaMedica(item.tipo)
                                ? '🩺'
                                : item.tipo === 'Vacaciones'
                                ? '🏖️'
                                : '📅'}
                            </span>
                          </div>
                          <div className="flex-1">
                            {selectedTab === 'ausencias' ? (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">{item.NOMBRE || item.nombre || 'N/A'}</h3>
                                <p className="text-sm text-gray-600">{item.CODIGO || item.codigo || 'N/A'}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    ID: {item.id}
                                  </span>
                                  {item.CODIGO && (
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      Código: {item.CODIGO}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getTipoColor(item.TIPO || item.tipo)}`}>
                                    {item.TIPO || item.tipo}
                                  </span>
                                </div>
                              </>
                            ) : selectedTab === 'baja' ? (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  Caso {item.casoId || item.id}
                                </h3>
                                {item.trabajador && (
                                  <p className="text-sm text-gray-600">
                                    Trabajador: {item.trabajador}
                                  </p>
                                )}
                                <p className="text-sm text-gray-600">
                                  Posición: {item.posicionId || 'N/A'}
                                </p>
                                {item.codigoEmpleado && (
                                  <p className="text-sm text-gray-600">
                                    Código empleado: {item.codigoEmpleado}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span
                                    className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getSituacionColor(
                                      item.situacion
                                    )}`}
                                  >
                                    {item.situacion || 'Situación desconocida'}
                                  </span>
                                  {item.fuente && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-800">
                                      Fuente: {item.fuente}
                                    </span>
                                  )}
                                </div>
                                {item.updatedAt && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Última actualización: {formatDateTime(item.updatedAt)}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  {item.NOMBRE || item.nombre || getUserName(item.email)}
                                </h3>
                                <p className="text-sm text-gray-600">{item.email}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    ID: {item.id}
                                  </span>
                                  {item.codigo && (
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      Código: {item.codigo}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getTipoColor(item.tipo)}`}>
                                    {item.tipo}
                                  </span>
                                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item.estado)}`}>
                                    {item.estado === 'Aprobada' ? '✅' : item.estado === 'Pendiente' ? '⏳' : '❌'} {item.estado}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Iconițe Edit și Delete */}
                        {selectedTab !== 'ausencias' && selectedTab !== 'baja' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleEdit(item)}
                              className="group/edit relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-blue-50"
                              title="Editar solicitud"
                            >
                              <Edit className="w-5 h-5 text-blue-600 group-hover/edit:text-blue-700" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item.id)}
                              disabled={isOperationLoading('delete')}
                              className="group/delete relative p-2 rounded-lg transition-all duration-300 transform hover:scale-110 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Eliminar solicitud"
                            >
                              <Trash2 className="w-5 h-5 text-red-600 group-hover/delete:text-red-700" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {selectedTab === 'ausencias' ? (
                          <>
                            <div className="bg-blue-50 p-4 rounded-lg group-hover:bg-blue-100 transition-colors duration-300 border border-blue-200">
                            <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha</span>
                              <p className="text-sm font-bold text-blue-900">{formatFechaFlexible(item.FECHA || item.fecha, item.fecha_inicio, item.fecha_fin)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                            <span className="block text-xs font-medium text-gray-600 mb-1">Hora</span>
                              <p className="text-sm font-bold text-gray-900">{item.HORA || item.hora || 'N/A'}</p>
                            </div>
                            {(item.created_at || item.CREATED_AT || item.createdAt) && (
                              <div className="bg-green-50 p-4 rounded-lg group-hover:bg-green-100 transition-colors duration-300 border border-green-200">
                              <span className="block text-xs font-medium text-green-700 mb-1">📋 Fecha Solicitud</span>
                                <p className="text-sm font-bold text-green-900">
                                  {(() => {
                                    const createdAt = item.created_at || item.CREATED_AT || item.createdAt;
                                    if (!createdAt) return 'N/A';
                                    try {
                                      const date = new Date(createdAt.replace(' ', 'T'));
                                      if (isNaN(date.getTime())) return createdAt;
                                      return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`;
                                    } catch (e) {
                                      return createdAt;
                                    }
                                  })()}
                                </p>
                              </div>
                            )}
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Ubicación</span>
                              <p className="text-sm font-bold text-gray-900">{item.LOCACION || item.locacion || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                              <p className={`text-sm font-bold ${durationInfo.isDayBased ? 'text-blue-700' : 'text-purple-600'}`}>
                                {durationInfo.isDayBased ? `📅 ${durationInfo.text}` : `⏱️ ${durationInfo.text}`}
                              </p>
                            </div>
                          </>
                        ) : selectedTab === 'baja' ? (
                          <>
                            <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 group-hover:bg-rose-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-rose-700 mb-1">🩺 Días de baja</span>
                              <p className="text-sm font-bold text-rose-900">{formatNumber(item.diasBaja)} días</p>
                              <p className="text-xs text-rose-700 mt-1">
                                Previsto SPS: {formatNumber(item.diasPrevistosSps)} días
                              </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 group-hover:bg-gray-50 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha baja</span>
                              {editingBaja?.idCaso === item.idCaso && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaBaja' ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={editingBajaValue || ''}
                                    onChange={(e) => setEditingBajaValue(e.target.value)}
                                    className="text-sm font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onBlur={() => {
                                      if (editingBajaValue !== item.fechaBaja) {
                                        handleSaveBajaDate(item.idCaso, item.posicionId, 'fechaBaja', editingBajaValue);
                                      } else {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveBajaDate(item.idCaso, item.posicionId, 'fechaBaja', editingBajaValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p 
                                  className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => {
                                    if (isManager) {
                                      setEditingBaja({ idCaso: item.idCaso, idPosicion: item.posicionId, field: 'fechaBaja' });
                                      // Convertește data pentru input type="date" (YYYY-MM-DD)
                                      const dateStr = item.fechaBaja;
                                      if (dateStr && dateStr !== '-') {
                                        try {
                                          const date = new Date(dateStr);
                                          if (!isNaN(date.getTime())) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setEditingBajaValue(`${year}-${month}-${day}`);
                                          } else {
                                            setEditingBajaValue('');
                                          }
                                        } catch {
                                          setEditingBajaValue('');
                                        }
                                      } else {
                                        setEditingBajaValue('');
                                      }
                                    }
                                  }}
                                  title={isManager ? "Clic para editar" : ""}
                                >
                                  {formatDate(item.fechaBaja)}
                                </p>
                              )}
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 group-hover:bg-gray-50 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha alta</span>
                              {editingBaja?.idCaso === item.idCaso && editingBaja?.idPosicion === item.posicionId && editingBaja?.field === 'fechaAlta' ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={editingBajaValue || ''}
                                    onChange={(e) => setEditingBajaValue(e.target.value)}
                                    className="text-sm font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onBlur={() => {
                                      if (editingBajaValue !== item.fechaAlta) {
                                        handleSaveBajaDate(item.idCaso, item.posicionId, 'fechaAlta', editingBajaValue);
                                      } else {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveBajaDate(item.idCaso, item.posicionId, 'fechaAlta', editingBajaValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingBaja(null);
                                        setEditingBajaValue('');
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p 
                                  className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => {
                                    if (isManager) {
                                      setEditingBaja({ idCaso: item.idCaso, idPosicion: item.posicionId, field: 'fechaAlta' });
                                      // Convertește data pentru input type="date" (YYYY-MM-DD)
                                      const dateStr = item.fechaAlta;
                                      if (dateStr && dateStr !== '-') {
                                        try {
                                          const date = new Date(dateStr);
                                          if (!isNaN(date.getTime())) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setEditingBajaValue(`${year}-${month}-${day}`);
                                          } else {
                                            setEditingBajaValue('');
                                          }
                                        } catch {
                                          setEditingBajaValue('');
                                        }
                                      } else {
                                        setEditingBajaValue('');
                                      }
                                    }
                                  }}
                                  title={isManager ? "Clic para editar" : ""}
                                >
                                  {formatDate(item.fechaAlta)}
                                </p>
                              )}
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Pago delegado</span>
                              <p className="text-sm font-bold text-gray-900">Inicio: {formatDate(item.inicioPagoDelegado)}</p>
                              <p className="text-xs text-gray-600 mt-1">Fin: {formatDate(item.finPagoDelegado)}</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 group-hover:bg-blue-100 transition-colors duration-300">
                              <span className="block text-xs font-medium text-blue-700 mb-1">Gestiones Mutua</span>
                              <p className="text-sm font-bold text-blue-900">Última: {formatDate(item.ultimaGestionMutua)}</p>
                              <p className="text-xs text-blue-700 mt-1">Próxima: {formatDate(item.proximaGestionMutua)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Seguimiento INSS</span>
                              <p className="text-sm font-bold text-gray-900">
                                Pendiente validación: {formatNumber(item.pendienteINSS)}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Demora parte baja: {formatNumber(item.demoraParteBaja)} días
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-blue-50 p-4 rounded-lg group-hover:bg-blue-100 transition-colors duración-300 border border-blue-200">
                              <span className="block text-xs font-medium text-blue-700 mb-1">📅 Fecha Solicitud</span>
                              <p className="text-sm font-bold text-blue-900">{formatDate(item.fecha_solicitud)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Período</span>
                              <p className="text-sm font-bold text-gray-900">{item.FECHA || formatDate(item.fecha_inicio || item['fecha inicio'] || item.fecha)}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</span>
                              <p className="text-sm font-bold text-gray-900">{item.FECHA ? (item.FECHA.includes(' - ') ? item.FECHA.split(' - ')[1] : item.FECHA) : formatDate(item.fecha_fin || item['fecha fin'])}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg group-hover:bg-gray-100 transition-colors duración-300">
                              <span className="block text-xs font-medium text-gray-600 mb-1">Duración</span>
                              <p className="text-sm font-bold text-purple-600">
                                {item.FECHA
                                  ? calculateDaysFromCombinedDate(item.FECHA)
                                  : calculateDays(item.fecha_inicio || item['fecha inicio'] || item.fecha, item.fecha_fin || item['fecha fin'])}{' '}
                                días
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {selectedTab === 'ausencias' && (item.MOTIVO || item.motivo) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                          <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                          <p className="text-sm text-blue-800">{item.MOTIVO || item.motivo}</p>
                        </div>
                      )}

                      {selectedTab === 'baja' && (
                        <div className="bg-rose-50 p-4 rounded-lg border border-rose-200 mb-4">
                          <span className="block text-xs font-medium text-rose-700 mb-1">Información adicional</span>
                          <div className="text-sm text-rose-900 space-y-1">
                            <div>
                              Último parte de confirmación:{' '}
                              <span className="font-semibold">
                                {item.ultimoParteConfirmacion ? formatDate(item.ultimoParteConfirmacion) : 'No registrado'}
                              </span>
                            </div>
                            <div>
                              Fuente:{' '}
                              <span className="font-semibold">{item.fuente || 'No especificada'}</span>
                            </div>
                            <div>
                              Última actualización:{' '}
                              <span className="font-semibold">{formatDateTime(item.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedTab !== 'ausencias' && selectedTab !== 'baja' && item.motivo && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                          <span className="block text-xs font-medium text-blue-700 mb-1">Motivo</span>
                          <p className="text-sm text-blue-800">{item.motivo}</p>
                        </div>
                      )}
                    </div>
                  );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          // Formulario para nueva solicitud - SUPER WOW 3D MODERNIZADO ✨
          <div className="max-w-3xl mx-auto">
            {/* Header ULTRA WOW con efectos 3D */}
            <div className="relative mb-10">
              {/* Glow background animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 opacity-20 blur-3xl animate-pulse"></div>
              
              {/* Buton Volver - doar când se editează */}
              {editingSolicitud && (
                <div className="relative mb-4">
                  <button
                    onClick={() => {
                      setEditingSolicitud(null);
                      setOriginalSolicitudData(null);
                      setTipo('Asuntos Propios');
                      setFechaInicio('');
                      setFechaFin('');
                      setMotivo('');
                      // Revine la tab-ul corespunzător
                      if (isManager) {
                        setActiveTab('todas');
                      } else {
                        setActiveTab('lista');
                      }
                    }}
                    className="group flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors duration-300"
                  >
                    <svg className="w-5 h-5 text-red-600 group-hover:text-red-700 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H6" />
                      <path d="M12 19l-7-7 7-7" />
                    </svg>
                    <span className="font-semibold">Volver a Solicitudes</span>
                  </button>
                </div>
              )}
              
              <div className="relative text-center">
                {/* Icono 3D flotante con sombra y animaciones */}
                <div className="relative inline-block mb-6">
                  {/* Círculo exterior con gradiente y blur */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-lg opacity-60 animate-pulse"></div>
                  
                  {/* Círculo principal 3D */}
                  <div 
                    className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 hover:rotate-12 transition-all duration-500"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                      boxShadow: '0 20px 40px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <span className="text-4xl animate-bounce">📝</span>
                  </div>
                </div>

                {/* Título animado con gradiente */}
                <h2 
                  className="text-3xl sm:text-4xl font-black mb-3 bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent animate-pulse"
                  style={{
                    textShadow: '0 2px 20px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {editingSolicitud ? 'Editar Solicitud' : 'Nueva Solicitud'}
                </h2>
                <p className="text-gray-600 text-base sm:text-lg font-medium">
                  {editingSolicitud ? 'Modifica los datos de la solicitud' : 'Completa el formulario para enviar tu solicitud'}
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Tipo de solicitud - SUPER WOW 3D */}
              <div 
                className="relative group p-4 sm:p-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  boxShadow: '0 10px 30px rgba(168, 85, 247, 0.15)'
                }}
              >
                {/* Glow animado en hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-purple-600 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duración-500"></div>
                
                {/* Header con icono 3D */}
                <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                  <div className="flex items-center">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                      style={{
                          background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                          boxShadow: '0 8px 20px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <span className="text-2xl">📋</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Tipo de Solicitud
                    </h3>
                  </div>

                  {/* Select modernizado */}
                  <select
                    id="solicitud-tipo"
                    name="solicitud-tipo"
                    value={tipo}
                    onChange={(e) => {
                      const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                      const allowedGroups = ['Limpiador', 'Developer'];
                      
                      // Prevent selection of Asuntos Propios for non-allowed groups
                      if (e.target.value === 'Asuntos Propios' && !allowedGroups.includes(currentUserGroup)) {
                        alert('Asuntos Propios solo está disponible para usuarios de Limpiador y Developer.');
                        return;
                      }
                      
                      setTipo(e.target.value);
                      setFechaInicio('');
                      setFechaFin('');
                    }}
                    disabled={editingSolicitud !== null}
                    className="relative w-full px-4 py-4 text-base font-semibold rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-xl focus:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: editingSolicitud !== null 
                        ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                        : 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                      borderColor: editingSolicitud !== null ? '#d1d5db' : '#e9d5ff',
                      color: editingSolicitud !== null ? '#6b7280' : '#6b21a8',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      if (editingSolicitud === null) {
                        e.target.style.borderColor = '#a855f7';
                        e.target.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.2)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = editingSolicitud !== null ? '#d1d5db' : '#e9d5ff';
                      e.target.style.boxShadow = '';
                    }}
                  >
                    {(() => {
                      const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                      const allowedGroups = ['Limpiador', 'Developer'];
                      const isGroupAllowed = allowedGroups.includes(currentUserGroup);
                      
                      return (
                    <option 
                      value="Asuntos Propios" 
                          disabled={!isGroupAllowed || totalAsuntoPropioDays >= 6}
                      style={{ 
                            color: (!isGroupAllowed || totalAsuntoPropioDays >= 6) ? '#9ca3af' : '#6b21a8',
                            backgroundColor: (!isGroupAllowed || totalAsuntoPropioDays >= 6) ? '#f3f4f6' : 'transparent'
                      }}
                    >
                      📅 Asuntos Propios {totalAsuntoPropioDays >= 6 ? '(Límite alcanzado - 6/6 días)' : ''}
                    </option>
                      );
                    })()}
                    <option 
                      value="Vacaciones" 
                      disabled={totalVacacionesDays >= 31}
                      style={{ 
                        color: totalVacacionesDays >= 31 ? '#9ca3af' : '#0891b2',
                        backgroundColor: totalVacacionesDays >= 31 ? '#f3f4f6' : 'transparent'
                      }}
                    >
                      🏖️ Vacaciones {totalVacacionesDays >= 31 ? '(Límite alcanzado)' : ''}
                    </option>
                  </select>
                </div>

                {/* Período Solicitado - Calendar for Vacaciones or Asuntos Propios */}
                {tipo === 'Vacaciones' ? (
                  // Calendar for Vacaciones
                  <div 
                    className="relative group p-4 sm:p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      boxShadow: '0 10px 30px rgba(59, 130, 246, 0.15)'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Selecciona tus Vacaciones
                        </h3>
                      </div>
                      
                      {/* Month Navigation */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => navigateMonth('prev')}
                          className="w-10 h-10 bg-white border border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronLeft className="w-5 h-5 text-blue-600" />
                        </button>
                        
                        <div className="bg-white border border-blue-300 rounded-lg px-4 py-2 shadow-sm min-w-[140px] text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => navigateMonth('next')}
                          className="w-10 h-10 bg-white border border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white rounded-xl border border-blue-200 shadow-lg sm:overflow-hidden">
                      <div className="overflow-x-auto sm:overflow-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="w-full min-w-[280px] sm:min-w-[420px]">
                          {/* Days of week header */}
                          <div className="grid grid-cols-7 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                              <div key={day} className="p-2 sm:p-3 text-center text-[11px] sm:text-sm font-bold text-blue-700 border-r border-blue-200 last:border-r-0">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar days */}
                          <div className="grid grid-cols-7">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }).map((_, index) => (
                              <div key={`empty-${index}`} className="h-12 border-r border-b border-gray-100 last:border-r-0"></div>
                            ))}
                            
                            {/* Days of the month */}
                            {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => i + 1).map(day => {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const today = new Date();
                              const currentDate = new Date(dateStr);
                              const isToday = currentDate.toDateString() === today.toDateString();
                              const isPast = currentDate < today;
                              const isBlocked = isInHolidayBlockPeriod(dateStr);
                              const availability = dateAvailability[dateStr];
                              const isFull = availability && availability.isFull;
                              const isLowAvailability = availability && availability.available <= 1 && availability.available > 0;
                              // For Vacaciones and Asuntos Propios, we don't use isDateOccupied anymore - we use availability logic instead
                              const isOccupied = (tipo !== 'Vacaciones' && tipo !== 'Asunto Propio') ? isDateOccupied(day) : false;
                              
                              return (
                              <button
                                key={day}
                                  onClick={() => !isDateDisabled(day) && toggleDate(day)}
                                  disabled={isDateDisabled(day)}
                                  className={`h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0 transition-all duration-200 relative ${
                                  isDateSelected(day)
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-lg'
                                      : isBlocked
                                      ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 cursor-not-allowed'
                                      : isFull
                                      ? 'bg-gradient-to-br from-purple-200 to-purple-300 text-purple-800 cursor-not-allowed'
                                      : isOccupied
                                      ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-700 cursor-not-allowed'
                                      : isLowAvailability
                                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 hover:bg-yellow-300'
                                      : isToday
                                      ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-800 font-semibold hover:bg-green-300'
                                      : isPast
                                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  title={
                                    isBlocked
                                      ? 'Período bloqueado: 6 Dic - 6 Ene (Empleada)'
                                      : isFull
                                      ? `Sin disponibilidad (${availability?.occupied}/${availability?.total} ocupados)`
                                      : isOccupied
                                      ? 'Fecha ocupada por otra solicitud' 
                                      : isLowAvailability
                                      ? `Poca disponibilidad: ${availability?.available}/${availability?.total} libres`
                                      : availability && availability.available > 0
                                      ? `Disponibilidad: ${availability?.available}/${availability?.total} libres`
                                      : isPast 
                                      ? 'No se pueden seleccionar fechas pasadas' 
                                      : isToday 
                                      ? 'Hoy' 
                                      : ''
                                  }
                              >
                                <span className="text-xs sm:text-sm">{day}</span>
                                  {isBlocked && (
                                    <span className="absolute top-1 right-1 text-xs">🔒</span>
                                  )}
                                  {isFull && !isBlocked && (
                                    <span className="absolute top-1 right-1 text-xs">🈵</span>
                                  )}
                                  {isLowAvailability && !isBlocked && !isFull && (
                                    <span className="absolute top-1 right-1 text-xs">⚠️</span>
                                  )}
                                  {isOccupied && !isBlocked && !isFull && (
                                    <span className="absolute top-1 right-1 text-xs">🚫</span>
                                  )}
                                  {availability && !isOccupied && !isBlocked && (
                                    <span className="absolute bottom-1 right-1 text-xs font-bold" style={{ fontSize: '9px' }}>
                                      {availability.available}/{availability.total}
                                    </span>
                                  )}
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Loading indicator */}
                    {isOperationLoading('occupiedDates') && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 flex items-center">
                          <span className="animate-spin mr-2">⏳</span>
                          Cargando fechas ocupadas...
                        </p>
                      </div>
                    )}
                    
                    {/* Availability info for Vacaciones and Asuntos Propios */}
                    {!isOperationLoading('occupiedDates') && (tipo === 'Vacaciones' || tipo === 'Asunto Propio') && Object.keys(dateAvailability).length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-blue-800 mb-2">
                              📊 Disponibilidad del Grupo
                            </p>
                            {(() => {
                              const firstDate = Object.keys(dateAvailability)[0];
                              const firstAvailability = dateAvailability[firstDate];
                              return (
                                <div className="text-xs text-blue-600 space-y-1">
                                  <p><strong>Grupo:</strong> {firstAvailability.group || 'N/A'}</p>
                                  <p><strong>Centro:</strong> {firstAvailability.center || 'No definido'}</p>
                                  <p><strong>Límite por fecha:</strong> {firstAvailability.total} personas</p>
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-800 mb-2">
                              📅 Resumen del Grupo
                            </p>
                            {(() => {
                              const firstDate = Object.keys(dateAvailability)[0];
                              const firstAvailability = dateAvailability[firstDate];
                              
                              // Calculate totals from allUsers
                              // Use the center from dateAvailability which is already calculated correctly
                              const currentUserCenter = firstAvailability.center || '';
                              const currentUserGroup = authUser?.['GRUPO'] || authUser?.grupo || '';
                              
                              const totalInGroup = allUsers.filter(user => 
                                (user['GRUPO'] || user.grupo) === currentUserGroup
                              ).length;
                              
                              // Helper function to get center from user (same logic as in calculateDateAvailability)
                              const getUserCenter = (user) => {
                                if (!user) return '';
                                // First, check the exact key used in DatosPage
                                if (user['CENTRO TRABAJO'] && String(user['CENTRO TRABAJO']).trim()) {
                                  return String(user['CENTRO TRABAJO']).trim();
                                }
                                const preferredKeys = [
                                  'CENTRO DE TRABAJO',
                                  'centro de trabajo',
                                  'CENTRO_DE_TRABAJO',
                                  'centroDeTrabajo',
                                  'centro_trabajo',
                                  'CENTRO',
                                  'centro',
                                  'CENTER',
                                  'center',
                                  'DEPARTAMENTO',
                                  'departamento'
                                ];
                                for (const k of preferredKeys) {
                                  if (user[k] && String(user[k]).trim()) {
                                    return String(user[k]).trim();
                                  }
                                }
                                // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
                                try {
                                  const allKeys = Object.keys(user || {});
                                  const key = allKeys.find(key => {
                                    const lk = key.toLowerCase();
                                    return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(user[key]).trim();
                                  });
                                  if (key) {
                                    return String(user[key]).trim();
                                  }
                                } catch (e) {
                                  console.warn('Error in getUserCenter heuristics:', e);
                                }
                                return '';
                              };
                              
                              const totalInCenter = allUsers.filter(user => {
                                const userCenter = getUserCenter(user);
                                return userCenter && currentUserCenter && userCenter === currentUserCenter;
                              }).length;
                              
                              return (
                                <div className="text-xs text-blue-600 space-y-1">
                                  <p><strong>Total empleados en centro:</strong> {totalInCenter}</p>
                                  <p><strong>Total empleados en grupo:</strong> {totalInGroup}</p>
                                  <p><strong>Límite per grup:</strong> {firstAvailability.total} personas</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Occupied dates info for Asuntos Propios */}
                    {!isOperationLoading('occupiedDates') && tipo !== 'Vacaciones' && occupiedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800">
                          🚫 {occupiedDates.length} días ocupados este mes
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Las fechas en rojo están ocupadas por otras solicitudes
                        </p>
                      </div>
                    )}

                    {/* Calendar Legend */}
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-bold text-gray-800 mb-2">Leyenda del Calendario:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
                          <span className="text-gray-700">Días seleccionados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 rounded"></div>
                          <span className="text-gray-700">Hoy</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-200 to-purple-300 rounded"></div>
                          <span className="text-gray-700">Sin disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded"></div>
                          <span className="text-gray-700">Poca disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-red-100 to-red-200 rounded"></div>
                          <span className="text-gray-700">Ocupado por otras solicitudes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-orange-200 to-orange-300 rounded"></div>
                          <span className="text-gray-700">Bloqueado (Empleada)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-50 rounded"></div>
                          <span className="text-gray-700">Fechas pasadas</span>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 font-medium">
                          📊 Reglas de Disponibilidad:
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          • Verano (Jun-Ago): {tipo === 'Vacaciones' ? '15%' : '20%'} del grupo puede estar {tipo === 'Vacaciones' ? 'de vacaciones' : 'en asuntos propios'}
                        </p>
                        <p className="text-xs text-blue-600">
                          • Resto del año: {tipo === 'Vacaciones' ? '10%' : '15%'} del grupo puede estar {tipo === 'Vacaciones' ? 'de vacaciones' : 'en asuntos propios'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Selected dates info */}
                    {selectedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          📅 Días seleccionados: {selectedDates.length} días
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Desde: {fechaInicio} hasta: {fechaFin}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  // Calendar for Asuntos Propios
                  <div 
                    className="relative group p-4 sm:p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      boxShadow: '0 10px 30px rgba(168, 85, 247, 0.15)',
                      padding: 'clamp(1rem, 2vw + 0.5rem, 1.5rem)'
                    }}
                  >
                    {/* Glow animado en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-purple-600 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duración-500"></div>
                    
                    {/* Header con icono 3D */}
                    <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6">
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                          style={{
                              background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                              boxShadow: '0 8px 20px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                            Selecciona tus Asuntos Propios
                        </h3>
                      </div>

                      {/* Month Navigation */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => navigateMonth('prev')}
                          className="w-10 h-10 bg-white border border-purple-300 rounded-lg flex items-center justify-center hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronLeft className="w-5 h-5 text-purple-600" />
                        </button>
                        
                        <div className="bg-white border border-purple-300 rounded-lg px-4 py-2 shadow-sm min-w-[140px] text-center">
                          <div className="text-lg font-bold text-purple-600">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                      </div>

                        <button
                          onClick={() => navigateMonth('next')}
                          className="w-10 h-10 bg-white border border-purple-300 rounded-lg flex items-center justify-center hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ChevronRight className="w-5 h-5 text-purple-600" />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white rounded-xl border border-purple-200 shadow-lg sm:overflow-hidden">
                      <div className="overflow-x-auto sm:overflow-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="w-full min-w-[280px] sm:min-w-[420px]">
                          {/* Days of week header */}
                          <div className="grid grid-cols-7 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                              <div
                                key={day}
                                className="p-2 sm:p-3 text-center text-[11px] sm:text-sm font-bold text-purple-700 border-r border-purple-200 last:border-r-0"
                              >
                                {day}
                              </div>
                            ))}
                          </div>
                          {/* Calendar days */}
                          <div className="grid grid-cols-7">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }).map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                className="h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0"
                              ></div>
                            ))}
                            {/* Days of the month */}
                            {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => i + 1).map(day => {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const today = new Date();
                              const currentDate = new Date(dateStr);
                              const isToday = currentDate.toDateString() === today.toDateString();
                              const isPast = currentDate < today;
                              const isBlocked = isInHolidayBlockPeriod(dateStr);
                              const availability = dateAvailability[dateStr];
                              const isFull = availability && availability.isFull;
                              const isLowAvailability = availability && availability.available <= 1 && availability.available > 0;
                              // For Asuntos Propios, we don't use isDateOccupied - we use availability logic
                              const isOccupied = false;
                              return (
                                <button
                                  key={day}
                                  onClick={() => !isDateDisabled(day) && toggleDate(day)}
                                  disabled={isDateDisabled(day)}
                                  className={`h-10 sm:h-12 border-r border-b border-gray-100 last:border-r-0 transition-all duration-200 relative ${
                                    isDateSelected(day)
                                      ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold shadow-lg'
                                      : isBlocked
                                      ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 cursor-not-allowed'
                                      : isFull
                                      ? 'bg-gradient-to-br from-purple-200 to-purple-300 text-purple-800 cursor-not-allowed'
                                      : isLowAvailability
                                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 hover:bg-yellow-200'
                                      : isOccupied
                                      ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 cursor-not-allowed'
                                      : isPast
                                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : isToday
                                      ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-800 hover:bg-green-200'
                                      : 'bg-white text-gray-700 hover:bg-purple-50 hover:text-purple-800'
                                  }`}
                                  title={
                                    isPast
                                      ? 'Fecha pasada'
                                      : isBlocked
                                      ? 'Bloqueado (Empleada)'
                                      : isFull
                                      ? `Sin disponibilidad (${availability?.occupiedCount || 0}/${availability?.maxAllowed || 1})`
                                      : isLowAvailability
                                      ? `Poca disponibilidad (${availability?.available || 0}/${availability?.maxAllowed || 1})`
                                      : isOccupied
                                      ? 'Ocupado por otras solicitudes'
                                      : isToday
                                      ? 'Hoy'
                                      : availability
                                      ? `Disponible (${availability.available}/${availability.maxAllowed})`
                                      : 'Disponible'
                                  }
                                >
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <span className="text-xs sm:text-sm font-medium">{day}</span>
                                    {availability && (
                                      <span className="text-[10px] sm:text-xs opacity-75">
                                        {isFull ? '🈵' : isLowAvailability ? '⚠️' : availability.available}
                                      </span>
                                    )}
                                  </div>
                                  {/* Icons overlay */}
                                  <div className="absolute top-1 right-1">
                                    {isBlocked && <span className="text-xs">🔒</span>}
                                    {isFull && !isBlocked && <span className="text-xs">🈵</span>}
                                    {isLowAvailability && !isBlocked && !isFull && <span className="text-xs">⚠️</span>}
                                    {isOccupied && !isBlocked && !isFull && <span className="text-xs">🚫</span>}
                                    {isToday && !isBlocked && !isFull && !isOccupied && <span className="text-xs">📍</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Availability info for Asuntos Propios */}
                    {Object.keys(dateAvailability).length > 0 && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-medium text-purple-800">
                          📊 Disponibilidad de Asuntos Propios
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          Total empleados en grupo: {Object.values(dateAvailability)[0]?.groupSize || 0}
                        </p>
                        <p className="text-xs text-purple-600">
                          Límite permitido: {Object.values(dateAvailability)[0]?.maxAllowed || 0} personas
                        </p>
                        <p className="text-xs text-purple-600">
                          Días disponibles: {totalAsuntoPropioDays}/6 días (anual)
                        </p>
                      </div>
                    )}

                    {/* Calendar Legend for Asuntos Propios */}
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-gray-800">Leyenda del Calendario:</h4>
                        <div className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
                          Días disponibles: {totalAsuntoPropioDays}/6 días (anual)
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded"></div>
                          <span className="text-gray-700">Días seleccionados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 rounded"></div>
                          <span className="text-gray-700">Hoy</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-purple-200 to-purple-300 rounded"></div>
                          <span className="text-gray-700">Sin disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded"></div>
                          <span className="text-gray-700">Poca disponibilidad</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gradient-to-br from-orange-200 to-orange-300 rounded"></div>
                          <span className="text-gray-700">Bloqueado (Empleada)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-50 rounded"></div>
                          <span className="text-gray-700">Fechas pasadas</span>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                        <p className="text-xs text-purple-700 font-medium">
                          📊 Reglas para Asuntos Propios:
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          • Máximo 6 días por persona por año
                        </p>
                        <p className="text-xs text-purple-600">
                          • Máximo 4 personas por día en total
                        </p>
                        <p className="text-xs text-purple-600">
                          • Máximo 1 persona del mismo centro por día
                        </p>
                        <p className="text-xs text-purple-600">
                          • Máximo 6 días consecutivos
                        </p>
                        <p className="text-xs text-purple-600">
                          • Mínimo 5 días de adelanto
                        </p>
                      </div>
                    </div>
                    
                    {/* Selected dates info */}
                    {selectedDates.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          📅 Días seleccionados: {selectedDates.length} días
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Desde: {fechaInicio} hasta: {fechaFin}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Cálculo de días - MEGA WOW Badge */}
                {fechaInicio && fechaFin && (
                  <div 
                    className="relative group overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '2px solid rgba(34, 197, 94, 0.3)',
                      boxShadow: '0 8px 25px rgba(34, 197, 94, 0.2)',
                      padding: '1rem'
                    }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                    
                    <div className="relative flex items-center justify-between">
                      <p className="text-base font-bold text-green-800 flex items-center">
                        <span className="text-2xl mr-3">⏱️</span>
                        <span>Días solicitados:</span>
                        <span className="ml-2 text-2xl text-green-600">{calculateDays(fechaInicio, fechaFin)}</span>
                        <span className="ml-2 text-lg">días</span>
                      </p>
                    </div>
                    
                    {tipo === 'Asuntos Propios' && (
                      <div className="mt-2 ml-11">
                        <p className="text-sm text-green-700 font-medium">
                          ℹ️ Máximo 5 días consecutivos, mínimo 5 días de antelación
                        </p>
                        <p className={`text-sm font-medium mt-1 ${
                          totalAsuntoPropioDays >= 6 ? 'text-red-600' : 
                          totalAsuntoPropioDays >= 4 ? 'text-yellow-600' : 
                          'text-blue-600'
                        }`}>
                          📊 Días usados: {totalAsuntoPropioDays}/6 {totalAsuntoPropioDays >= 6 ? '(LÍMITE ALCANZADO)' : ''}
                        </p>
                      </div>
                    )}
                    {tipo === 'Vacaciones' && (
                      <p className="text-sm text-green-700 mt-2 ml-11 font-medium">
                        ℹ️ Solo quincena (15 días) o mes entero
                      </p>
                    )}
                  </div>
                )}

                {/* Motivo - SUPER WOW 3D */}
                <div 
                  className="relative group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.05) 0%, rgba(75, 85, 99, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(107, 114, 128, 0.2)',
                    boxShadow: '0 10px 30px rgba(107, 114, 128, 0.15)',
                    padding: '1.5rem'
                  }}
                >
                  {/* Glow animado en hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gray-400 to-slate-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                  
                  {/* Header con icono 3D */}
                  <div className="relative flex items-center mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                        boxShadow: '0 8px 20px rgba(107, 114, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <span className="text-2xl">💬</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Motivo <span className={`text-sm font-normal ${editingSolicitud ? 'text-red-600' : 'text-gray-500'}`}>
                        {editingSolicitud ? '(obligatorio)' : '(opcional)'}
                      </span>
                    </h3>
                  </div>

                  {/* Textarea modernizado */}
                  <textarea
                    id="solicitud-motivo"
                    name="solicitud-motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describe el motivo de tu solicitud..."
                    rows={4}
                    className="relative w-full px-4 py-4 text-base font-medium rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-lg focus:shadow-xl resize-none"
                    style={{
                      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                      borderColor: '#d1d5db',
                      color: '#374151',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6b7280';
                      e.target.style.boxShadow = '0 0 0 3px rgba(107, 114, 128, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                    }}
                  />
                </div>

                {/* Botón Enviar - MEGA ULTRA WOW 3D integrado en card */}
                <div 
                  className="relative group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
                    padding: '2rem'
                  }}
                >
                  {/* Glow animado en hover del card */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 to-pink-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
                  
                  {/* Botón centrado */}
                  <div className="relative text-center">
                    <button
                      onClick={handleAdd}
                      disabled={isOperationLoading('submit')}
                      className="group/btn relative inline-flex items-center justify-center overflow-hidden"
                    >
                      {/* Capa externa con glow animado más suave */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 via-pink-500 to-purple-500 opacity-50 blur-lg group-hover/btn:opacity-75 transition-opacity duration-300"></div>
                      
                      {/* Botón principal */}
                      <div 
                        className="relative px-10 py-4 rounded-2xl font-black text-lg text-white shadow-xl transform group-hover/btn:scale-105 group-active/btn:scale-95 transition-all duration-300"
                        style={{
                          background: isOperationLoading('submit') 
                            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)'
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
                          boxShadow: '0 12px 28px rgba(239, 68, 68, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
                        }}
                      >
                        {/* Shimmer effect */}
                        {!isOperationLoading('submit') && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000"></div>
                        )}
                        
                        {/* Contenido del botón */}
                        <div className="relative flex items-center gap-3">
                          {isOperationLoading('submit') ? (
                            <>
                              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>{editingSolicitud ? 'Actualizando...' : 'Enviando...'}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-2xl animate-bounce">{editingSolicitud ? '💾' : '📤'}</span>
                              <span>{editingSolicitud ? 'Actualizar Solicitud' : 'Enviar Solicitud'}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Partículas flotantes más discretas */}
                      {!isOperationLoading('submit') && (
                        <>
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping opacity-60"></div>
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-pink-300 rounded-full animate-ping opacity-60" style={{ animationDelay: '0.3s' }}></div>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mensajes de feedback - Modernizados */}
                {errorMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',
                      borderColor: '#fca5a5',
                      boxShadow: '0 8px 20px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">❌</span>
                      <p className="text-red-800 font-semibold">{errorMsg}</p>
                    </div>
                  </div>
                )}
                
                {successMsg && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.8) 0%, rgba(187, 247, 208, 0.8) 100%)',
                      borderColor: '#86efac',
                      boxShadow: '0 8px 20px rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">✅</span>
                      <p className="text-green-800 font-semibold">{successMsg}</p>
                    </div>
                  </div>
                )}
                
                {serverResp && (
                  <div 
                    className="relative overflow-hidden rounded-xl p-4 border-2"
                    style={{
                      background: serverResp.startsWith('Status: 2')
                        ? 'linear-gradient(135deg, rgba(220, 252, 231, 0.8) 0%, rgba(187, 247, 208, 0.8) 100%)'
                        : 'linear-gradient(135deg, rgba(254, 226, 226, 0.8) 0%, rgba(254, 202, 202, 0.8) 100%)',
                      borderColor: serverResp.startsWith('Status: 2') ? '#86efac' : '#fca5a5',
                      boxShadow: serverResp.startsWith('Status: 2')
                        ? '0 8px 20px rgba(34, 197, 94, 0.2)'
                        : '0 8px 20px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <pre className={`text-sm font-mono whitespace-pre-wrap ${
                      serverResp.startsWith('Status: 2') ? 'text-green-800' : 'text-red-800'
                    }`}>{serverResp}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de confirmare ștergere */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, solicitudId: null })}
        title=""
        size="sm"
        className="max-w-md"
      >
        <div className="text-center py-4">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          
          {/* Titlu */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            ¿Eliminar solicitud?
          </h3>
          
          {/* Mesaj */}
          <p className="text-gray-600 mb-6">
            ¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.
          </p>
          
          {/* Butoane */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDeleteConfirm({ isOpen: false, solicitudId: null })}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (deleteConfirm.solicitudId) {
                  handleDelete(deleteConfirm.solicitudId);
                }
              }}
              disabled={isOperationLoading('delete')}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOperationLoading('delete') ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 
