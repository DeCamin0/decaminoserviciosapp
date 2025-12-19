import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, Input, Card, Modal } from '../components/ui';
import { useLoadingState } from '../hooks/useLoadingState';
import { 
  TableLoading
} from '../components/ui/LoadingStates';
import { useApi } from '../hooks/useApi';
import { SHEET_FIELDS, API_ENDPOINTS } from '../utils/constants';
import { routes } from '../utils/routes';
import Back3DButton from '../components/Back3DButton.jsx';
import EmployeePDFGenerator from '../components/employees/EmployeePDFGenerator.jsx';
import { fetchAvatarOnce, getCachedAvatar, setCachedAvatar, DEFAULT_AVATAR } from '../utils/avatarCache';

import activityLogger from '../utils/activityLogger';

// Función para generar el código
const generateCodigo = () => {
  return Date.now().toString().slice(-8); // Usa timestamp en lugar de random
};

// Función para calcular la antigüedad
const calcularAntiguedad = (fechaAntiguedad, fechaBaja) => {
  if (!fechaAntiguedad) return '';
  
  try {
    // Parsează data de start (formato dd-mm-yyyy sau dd/mm/yyyy)
    let fechaInicio;
    if (fechaAntiguedad.includes('/')) {
      const [dd, mm, yyyy] = fechaAntiguedad.split('/');
      fechaInicio = new Date(yyyy, mm - 1, dd);
    } else if (fechaAntiguedad.includes('-')) {
      const [dd, mm, yyyy] = fechaAntiguedad.split('-');
      fechaInicio = new Date(yyyy, mm - 1, dd);
    } else {
      return '';
    }
    
    // Data de final (fecha baja sau hoy)
    let fechaFinal;
    if (fechaBaja) {
      if (fechaBaja.includes('/')) {
        const [dd2, mm2, yyyy2] = fechaBaja.split('/');
        fechaFinal = new Date(yyyy2, mm2 - 1, dd2);
      } else if (fechaBaja.includes('-')) {
        const [dd2, mm2, yyyy2] = fechaBaja.split('-');
        fechaFinal = new Date(yyyy2, mm2 - 1, dd2);
      } else {
        fechaFinal = new Date();
      }
    } else {
      fechaFinal = new Date();
    }
    
    // Calculează diferența
    let years = fechaFinal.getFullYear() - fechaInicio.getFullYear();
    let months = fechaFinal.getMonth() - fechaInicio.getMonth();
    let days = fechaFinal.getDate() - fechaInicio.getDate();
    
    // Ajustează dacă e necesar
    if (days < 0) {
      months--;
      const prevMonth = new Date(fechaFinal.getFullYear(), fechaFinal.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // Format frumos
    const partsText = [];
    if (years > 0) partsText.push(`${years} año${years !== 1 ? 's' : ''}`);
    if (months > 0) partsText.push(`${months} mes${months !== 1 ? 'es' : ''}`);
    if (days > 0 && years === 0) partsText.push(`${days} día${days !== 1 ? 's' : ''}`);
    
    return partsText.join(', ') || '0 días';
  } catch (error) {
    return '';
  }
};

export default function EmpleadosPage() {
  const { user: authUser, authToken } = useAuth();
  const { callApi } = useApi();

  // Funcții pentru validarea documentelor spaniole
  const validarSeguridadSocial = (numero) => {
    if (!numero || numero.trim() === '') return null;
    
    const numeroLimpio = numero.replace(/[\s-]/g, '');
    
    // Verificar que tenga exactamente 12 dígitos
    if (!/^\d{12}$/.test(numeroLimpio)) {
      return false;
    }
    
    // Estructura: XX XX XXXX XXX X
    // Provincia (2) + Secuencia (2) + Fecha (4) + Orden (3) + Control (1)
    
    const provincia = parseInt(numeroLimpio.substring(0, 2));
    if (provincia < 1 || provincia > 52) {
      return false;
    }
    
    const secuencia = parseInt(numeroLimpio.substring(2, 4));
    if (secuencia < 1 || secuencia > 99) {
      return false;
    }
    
    // Para la fecha, solo verificamos que sea un número de 4 dígitos
    // No validamos el año porque puede ser año de nacimiento o alta
    const fecha = parseInt(numeroLimpio.substring(4, 8));
    if (fecha < 1000 || fecha > 9999) {
      return false;
    }
    
    const orden = parseInt(numeroLimpio.substring(8, 11));
    if (orden < 1 || orden > 999) {
      return false;
    }
    
    // Validación más permisiva: solo verificar que la cifra de control sea un dígito
    // Muchos números de SS existentes no siguen el algoritmo oficial exacto
    const cifraControl = parseInt(numeroLimpio.substring(11, 12));
    if (isNaN(cifraControl) || cifraControl < 0 || cifraControl > 9) {
      return false;
    }
    
    // Si pasa todas las validaciones de estructura, considerarlo válido
    return true;
  };

  const validarIBAN = (iban) => {
    if (!iban || iban.trim() === '') return null;
    
    const ibanLimpio = iban.replace(/\s/g, '').toUpperCase();
    
    if (!/^ES\d{22}$/.test(ibanLimpio)) {
      return false;
    }
    
    const cifrasControl = ibanLimpio.substring(2, 4);
    const numeroReorganizado = ibanLimpio.substring(4) + 'ES' + cifrasControl;
    
    let numeroParaValidacion = '';
    for (let i = 0; i < numeroReorganizado.length; i++) {
      const char = numeroReorganizado[i];
      if (/[A-Z]/.test(char)) {
        numeroParaValidacion += (char.charCodeAt(0) - 55).toString();
      } else {
        numeroParaValidacion += char;
      }
    }
    
    let resto = 0;
    for (let i = 0; i < numeroParaValidacion.length; i++) {
      resto = (resto * 10 + parseInt(numeroParaValidacion[i])) % 97;
    }
    
    return resto === 1;
  };

  const validarDNINIE = (documento) => {
    if (!documento || documento.trim() === '') return null;
    
    const documentoLimpio = documento.replace(/\s/g, '').toUpperCase();
    
    const formatoDNI = /^\d{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
    const formatoNIE = /^[XYZ]\d{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
    
    if (!formatoDNI.test(documentoLimpio) && !formatoNIE.test(documentoLimpio)) {
      return false;
    }
    
    let numero, letraControl;
    
    if (formatoDNI.test(documentoLimpio)) {
      numero = documentoLimpio.substring(0, 8);
      letraControl = documentoLimpio.substring(8, 9);
    } else {
      const prefijo = documentoLimpio.substring(0, 1);
      const cifras = documentoLimpio.substring(1, 8);
      letraControl = documentoLimpio.substring(8, 9);
      
      const prefijosNIE = { 'X': '0', 'Y': '1', 'Z': '2' };
      numero = prefijosNIE[prefijo] + cifras;
    }
    
    const letrasControl = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const numeroCalculado = parseInt(numero);
    const letraCorrecta = letrasControl[numeroCalculado % 23];
    
    return letraControl === letraCorrecta;
  };
  
  const normalizeYesNoValue = (value) => {
    if (value === null || value === undefined) return '';
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) return '';

    const yesValues = ['si', 'sí', 'yes', 'true', '1', 's', 'y'];
    const noValues = ['no', 'false', '0', 'n'];

    if (yesValues.includes(normalized)) return 'SI';
    if (noValues.includes(normalized)) return 'NO';

    return value.toString().trim();
  };

  const getFirstAvailable = (source = {}, keys = []) => {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        return source[key];
      }
    }
    return '';
  };

  const mapEmployeeRecord = (raw = {}) => {
    const fieldMappings = {
      'CODIGO': ['CODIGO', 'codigo', 'Codigo'],
      'NOMBRE / APELLIDOS': ['NOMBRE / APELLIDOS', 'nombre', 'NOMBRE'],
      'CORREO ELECTRONICO': ['CORREO ELECTRONICO', 'CORREO ELECTRÓNICO', 'email', 'EMAIL'],
      'NACIONALIDAD': ['NACIONALIDAD', 'nacionalidad'],
      'DIRECCION': ['DIRECCION', 'dirección', 'DIRECCIÓN', 'direccion'],
      'D.N.I. / NIE': ['D.N.I. / NIE', 'dni', 'DNI', 'nie', 'NIE'],
      'SEG. SOCIAL': ['SEG. SOCIAL', 'SEGURIDAD SOCIAL', 'seguridad_social', 'seg_social'],
      'Nº Cuenta': ['Nº Cuenta', 'cuenta', 'CUENTA', 'numero_cuenta'],
      'TELEFONO': ['TELEFONO', 'telefono', 'phone', 'TELÉFONO'],
      'FECHA NACIMIENTO': ['FECHA NACIMIENTO', 'fecha_nacimiento', 'fechaNacimiento', 'FECHA DE NACIMIENTO'],
      'FECHA DE ALTA': ['FECHA DE ALTA', 'FECHA_DE_ALTA', 'fecha_alta', 'fechaAlta', 'fecha_de_alta'],
      'CENTRO TRABAJO': ['CENTRO TRABAJO', 'centro_trabajo', 'centroTrabajo', 'centro'],
      'TIPO DE CONTRATO': ['TIPO DE CONTRATO', 'tipo_contrato', 'tipoContrato', 'TIPO_DE_CONTRATO'],
      'SUELDO BRUTO MENSUAL': ['SUELDO BRUTO MENSUAL', 'sueldo', 'SUELDO', 'sueldo_bruto'],
      'HORAS DE CONTRATO': ['HORAS DE CONTRATO', 'horas_contrato', 'horasContrato', 'HORAS_DE_CONTRATO'],
      'EMPRESA': ['EMPRESA', 'empresa'],
      'GRUPO': ['GRUPO', 'grupo'],
      'ESTADO': ['ESTADO', 'estado'],
      'FECHA BAJA': ['FECHA BAJA', 'fecha_baja', 'fechaBaja', 'FECHA_BAJA'],
      'Fecha Antigüedad': ['Fecha Antigüedad', 'fecha_antiguedad', 'fechaAntiguedad'],
      'Antigüedad': ['Antigüedad', 'antiguedad'],
      'DerechoPedidos': ['DerechoPedidos', 'derechoPedidos', 'derecho_pedidos'],
      'TrabajaFestivos': ['TrabajaFestivos', 'trabajaFestivos', 'trabaja_festivos'],
      'Contraseña': ['Contraseña', 'CONTRASEÑA', 'contraseña', 'contrasena', 'Contraseña ', 'password', 'PASSWORD'],
      'CuantoPuedeGastar': ['CuantoPuedeGastar', 'cuantoPuedeGastar', 'cuanto_puede_gastar'],
    };

    const mapped = { ...raw };

    SHEET_FIELDS.forEach(field => {
      const value = getFirstAvailable(raw, fieldMappings[field] || [field]);
      if (field === 'DerechoPedidos' || field === 'TrabajaFestivos') {
        mapped[field] = normalizeYesNoValue(value);
      } else {
        mapped[field] = value ?? '';
      }
    });

    return mapped;
  };

  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'adauga' | 'inspecciones'
  const [users, setUsers] = useState([]);
  const [errorUsers, setErrorUsers] = useState(null);
  
  // Loading states centralizate
  const { setOperationLoading, isOperationLoading } = useLoadingState();
  const [editForm, setEditForm] = useState({});
  const [originalEmployeeData, setOriginalEmployeeData] = useState(null); // Datele originale pentru comparație
  const [showEditModal, setShowEditModal] = useState(false);

  // Formulario para añadir empleado
  const [addForm, setAddForm] = useState(() => ({
    ...Object.fromEntries(SHEET_FIELDS.map(f => [f, ''])),
    CODIGO: generateCodigo(),
    EMPRESA: 'DE CAMINO SERVICIOS AUXILIARES SL',
    ESTADO: 'PENDIENTE', // Default pentru angajați noi
    DerechoPedidos: 'NO',
    TrabajaFestivos: 'NO'
  }));
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [enviarAGestoria, setEnviarAGestoria] = useState(false);
  const [enviarAGestoriaEdit, setEnviarAGestoriaEdit] = useState(false); // Pentru modalul de editare

  // Estado para dropdowns de centro de trabajo
  const [showCentroDropdown, setShowCentroDropdown] = useState(false);
  const [showEditCentroDropdown, setShowEditCentroDropdown] = useState(false);
  
  // Estado para dropdowns de nacionalidad
  const [showNacionalidadDropdown, setShowNacionalidadDropdown] = useState(false);
  const [showEditNacionalidadDropdown, setShowEditNacionalidadDropdown] = useState(false);

  // Estado para PDF
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfEmployeeData, setPdfEmployeeData] = useState(null);

  // Lista de países del mundo para nacionalidad
  const paises = [
    'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudí', 'Argelia', 'Argentina', 'Armenia',
    'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice', 'Benín',
    'Bielorrusia', 'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi',
    'Bután', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China', 'Chipre',
    'Colombia', 'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica',
    'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia',
    'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada',
    'Grecia', 'Guatemala', 'Guinea', 'Guinea-Bisáu', 'Guinea Ecuatorial', 'Guyana', 'Haití', 'Honduras', 'Hungría', 'India',
    'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall', 'Islas Salomón', 'Israel', 'Italia', 'Jamaica',
    'Japón', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia',
    'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui',
    'Maldivas', 'Malí', 'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco',
    'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega',
    'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia',
    'Portugal', 'Reino Unido', 'República Centroafricana', 'República Checa', 'República del Congo', 'República Democrática del Congo', 'República Dominicana', 'Ruanda', 'Rumania', 'Rusia',
    'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona',
    'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Suazilandia', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza',
    'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán',
    'Turquía', 'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Vaticano', 'Venezuela', 'Vietnam',
    'Yemen', 'Yibuti', 'Zambia', 'Zimbabue'
  ];

  // Estado para tipurile de contract
  const [contractTypes, setContractTypes] = useState([]);

  // Estado para lista de grupuri (din backend)
  const [gruposList, setGruposList] = useState([]);

  // Estado para email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({
    destinatar: 'angajat',
    grup: 'Empleado',
    subiect: '',
    mensaje: ''
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [selectedUserForEmail, setSelectedUserForEmail] = useState(null);

  // State pentru lista de clienți
  const [clientes, setClientes] = useState([]);

  // State pentru avatares de empleados
  const [employeeAvatars, setEmployeeAvatars] = useState({});
  const [bulkAvatarsLoaded, setBulkAvatarsLoaded] = useState(false);
  const loadingAvatarsRef = useRef(new Set());
  const bulkAvatarsLoadedRef = useRef(false);

  const fetchBulkAvatars = useCallback(async () => {
    if (bulkAvatarsLoadedRef.current) {
      return;
    }

    if (authUser?.isDemo) {
      bulkAvatarsLoadedRef.current = true;
      setBulkAvatarsLoaded(true);
      return;
    }

    try {
      // Adaugă token-ul JWT dacă există
      const headers = {
        'Content-Type': 'application/json'
      };
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getAvatarBulk, {
        method: 'POST',
        headers,
        body: JSON.stringify({ motivo: 'get' })
      });

      if (!response.ok) {
        console.warn('[Empleados] Bulk avatar fetch failed:', response.status, response.statusText);
        return;
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return;
      }

      const avatarsMap = {};

      data.forEach(item => {
        if (!item) return;
        const codigo = item.CODIGO || item.codigo || item.codEmpleado || item.employeeCode;
        if (!codigo) return;

        const avatarB64 = item.AVATAR_B64 || item.avatar_b64 || item.avatarBase64;
        const avatarUrlField = item.AVATAR || item.avatar || item.url || item.imageUrl || item.imagen;

        let avatarUrl = null;

        if (avatarB64) {
          avatarUrl = `data:image/jpeg;base64,${String(avatarB64).replace(/\n/g, '')}`;
        } else if (avatarUrlField) {
          avatarUrl = avatarUrlField;
        }

        if (avatarUrl) {
          avatarsMap[codigo] = avatarUrl;
          setCachedAvatar(codigo, avatarUrl);
        } else {
          avatarsMap[codigo] = DEFAULT_AVATAR;
        }
      });

      if (Object.keys(avatarsMap).length > 0) {
        setEmployeeAvatars(prev => ({ ...avatarsMap, ...prev }));
    }
    } catch (error) {
      console.error('❌ [Empleados] Error fetching bulk avatars:', error);
    } finally {
      bulkAvatarsLoadedRef.current = true;
    setBulkAvatarsLoaded(true);
    }
  }, [authUser]);

  useEffect(() => {
    fetchBulkAvatars();
  }, [fetchBulkAvatars]);

  // Funcție pentru încărcarea avatar-ului unui angajat (cu cache global)
  const loadEmployeeAvatar = useCallback(async (codigo, nombre) => {
    if (!codigo) return;

    if (
      Object.prototype.hasOwnProperty.call(employeeAvatars, codigo) ||
      loadingAvatarsRef.current.has(codigo)
    ) {
      return;
    }

    loadingAvatarsRef.current.add(codigo);

    // Skip real avatar loading in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping loadEmployeeAvatar');
      loadingAvatarsRef.current.delete(codigo);
      return;
    }

    try {
      // 1) cache local
      const cachedPayload = getCachedAvatar(codigo);
      const cachedUrl = cachedPayload?.url || cachedPayload || null;
      if (cachedUrl) {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: cachedUrl }));
        return;
      }

      // 2) fetch o singură dată cu guard
      const avatarUrl = await fetchAvatarOnce({
        codigo,
        nombre: nombre || '',
        endpoint: routes.getAvatar,
      });

      if (avatarUrl) {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: avatarUrl }));
      } else {
        setEmployeeAvatars(prev => ({ ...prev, [codigo]: DEFAULT_AVATAR }));
      }
    } catch (error) {
      console.error(`❌ Error al cargar avatar para ${codigo}:`, error);
      setEmployeeAvatars(prev => ({ ...prev, [codigo]: DEFAULT_AVATAR }));
    } finally {
      loadingAvatarsRef.current.delete(codigo);
    }
  }, [authUser, employeeAvatars]);

  // Demo empleados data
  const setDemoEmpleados = () => {
    const demoEmpleados = [
      {
        'NOMBRE / APELLIDOS': 'Carlos Antonio Rodríguez',
        'CODIGO': 'ADM001',
        'CORREO ELECTRONICO': 'admin@demo.com',
        'GRUPO': 'Admin',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
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
        'CENTRO': 'Madrid',
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
        'CENTRO': 'Madrid',
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
        'CENTRO': 'Madrid',
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
        'CENTRO': 'Madrid',
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
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 678 901',
        'FECHA DE ALTA': '2023-06-01',
        'CARGO': 'Técnica de Jardinería',
        'DEPARTAMENTO': 'Jardinería'
      },
      {
        'NOMBRE / APELLIDOS': 'Miguel Rodríguez Silva',
        'CODIGO': 'EMP007',
        'CORREO ELECTRONICO': 'miguel.rodriguez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 789 012',
        'FECHA DE ALTA': '2023-07-15',
        'CARGO': 'Supervisor de Turno',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Carmen López Herrera',
        'CODIGO': 'EMP008',
        'CORREO ELECTRONICO': 'carmen.lopez@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 890 123',
        'FECHA DE ALTA': '2023-08-01',
        'CARGO': 'Técnica de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'David García Moreno',
        'CODIGO': 'EMP009',
        'CORREO ELECTRONICO': 'david.garcia@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 901 234',
        'FECHA DE ALTA': '2023-09-15',
        'CARGO': 'Técnico de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      },
      {
        'NOMBRE / APELLIDOS': 'Isabel Torres Jiménez',
        'CODIGO': 'EMP010',
        'CORREO ELECTRONICO': 'isabel.torres@demo.com',
        'GRUPO': 'Empleado',
        'ESTADO': 'Activo',
        'CENTRO': 'Madrid',
        'TELEFONO': '+34 600 012 345',
        'FECHA DE ALTA': '2023-10-01',
        'CARGO': 'Técnica de Limpieza',
        'DEPARTAMENTO': 'Limpieza'
      }
    ];

    setUsers(demoEmpleados);
    setClientes([]); // Empty clientes for demo
  };

  // Funcție pentru încărcarea clienților
  const fetchClientes = useCallback(async () => {
    setOperationLoading('clientes', true);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchClientes in EmpleadosPage');
      setOperationLoading('clientes', false);
      return;
    }
    
    try {
      console.log('Fetching clientes from:', routes.getClientes);
      const response = await fetch(routes.getClientes);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Clientes data received:', data);
      
      const clientesData = Array.isArray(data) ? data : [];
      // Filtrează doar clienții (nu furnizorii)
      const soloClientes = clientesData.filter(item => item.tipo !== 'proveedor');
      setClientes(soloClientes);
      
    } catch (e) {
      console.error('Error fetching clientes:', e);
    }
    setOperationLoading('clientes', false);
  }, [authUser, setOperationLoading]);

  // Funcție pentru încărcarea tipurilor de contract din backend
  const fetchContractTypes = useCallback(async () => {
    setOperationLoading('contractTypes', true);
    
    try {
      console.log('Fetching contract types from:', routes.getContractTypes);
      const response = await fetch(routes.getContractTypes, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Contract types data received:', data);
      
      // Dacă backend-ul returnează un obiect cu success: false, aruncă eroare
      if (data.success === false) {
        throw new Error(data.error || 'Failed to load contract types');
      }
      
      // Backend-ul returnează un array direct
      const contractTypesData = Array.isArray(data) ? data : [];
      setContractTypes(contractTypesData);
      
    } catch (e) {
      console.error('Error fetching contract types:', e);
      // Fallback cu datele statice doar dacă nu reușește să facă request-ul
      setContractTypes([
        { id: 5, tipo: "FIJO DISCONTINUO" },
        { id: 4, tipo: "Formación" },
        { id: 1, tipo: "Indefinido" },
        { id: 6, tipo: "INTERINIDAD" },
        { id: 3, tipo: "Parcial" },
        { id: 2, tipo: "Temporal" }
      ]);
    }
    setOperationLoading('contractTypes', false);
  }, [setOperationLoading]);

  // Funcție pentru preluarea listei de grupuri din backend
  const fetchGrupos = useCallback(async () => {
    setOperationLoading('grupos', true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getGrupos, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Backend-ul returnează un array direct de string-uri (numele grupurilor)
      const gruposData = Array.isArray(data) ? data : [];
      setGruposList(gruposData);
      console.log('✅ Grupos loaded from backend:', gruposData.length, 'grupos');
      
    } catch (e) {
      console.error('Error fetching grupos:', e);
      // Fallback cu lista hardcodată doar dacă nu reușește să facă request-ul
      setGruposList([
        'Administrativ',
        'Auxiliar De Servicios - C',
        'Auxiliar De Servicios - L',
        'Comercial',
        'Developer',
        'Especialista',
        'Informatico',
        'Limpiador',
        'Socorrista',
        'Supervisor'
      ]);
    }
    setOperationLoading('grupos', false);
  }, [setOperationLoading]);

  const fetchUsers = useCallback(async () => {
    setOperationLoading('users', true);
    setErrorUsers(null);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchUsers in EmpleadosPage');
      setOperationLoading('users', false);
      return;
    }
    
    const result = await callApi(API_ENDPOINTS.USERS);
    
    if (result.success) {
      // DEBUG: Logăm exact ce primim
      console.log('🔍 [EmpleadosPage] Raw result.data:', result.data);
      console.log('🔍 [EmpleadosPage] result.data type:', typeof result.data, 'isArray:', Array.isArray(result.data));
      if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
        console.log('🔍 [EmpleadosPage] result.data keys:', Object.keys(result.data));
      }
      
      // Verificăm dacă răspunsul este "not-modified" - verificare prioritara
      if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
        // Caz 1: obiect direct cu status: 'not-modified' (fără CODIGO)
        if (result.data.status === 'not-modified' && !result.data.CODIGO) {
          console.log('✅ [EmpleadosPage] Response is status:not-modified (object) - păstrez lista existentă.');
          // Dacă nu avem lista existentă, nu facem nimic (nu setăm lista la array gol)
          if (users.length === 0) {
            console.log('⚠️ [EmpleadosPage] Lista este goală și am primit not-modified - aștept răspuns valid.');
            setOperationLoading('users', false);
            return;
          }
          setOperationLoading('users', false);
          return;
        }
      }
      
      // Verificăm dacă este array direct sau obiect care trebuie transformat în array
      let usersData;
      if (Array.isArray(result.data)) {
        // Dacă este array, verificăm dacă are un singur element cu status not-modified
        if (result.data.length === 1 && result.data[0] && result.data[0].status === 'not-modified' && !result.data[0].CODIGO) {
          console.log('✅ [EmpleadosPage] Response is status:not-modified (array with not-modified object) - păstrez lista existentă.');
          setOperationLoading('users', false);
          return;
        }
        usersData = result.data;
      } else if (result.data && typeof result.data === 'object') {
        // Dacă este obiect (nu array), transformăm în array doar dacă are CODIGO (nu doar status)
        if (result.data.CODIGO) {
          usersData = [result.data];
        } else {
          // Nu are CODIGO - probabil este un obiect de eroare sau not-modified
          console.log('⚠️ [EmpleadosPage] Obiectul nu are CODIGO, păstrez lista existentă.');
          setOperationLoading('users', false);
          return;
        }
      } else {
        // Nu avem date valide
        console.log('⚠️ [EmpleadosPage] Nu avem date valide, păstrez lista existentă.');
        setOperationLoading('users', false);
        return;
      }
      
      // Filtrează răspunsuri invalide (ex: obiecte cu status not-modified, fără CODIGO)
      const validUsers = usersData.filter(user => {
        if (!user || typeof user !== 'object') return false;
        if (user.status === 'not-modified') return false;
        if (!user.CODIGO) return false;
        return true;
      });
      
      // Dacă după filtru lista este goală și avem deja o listă existentă, păstrăm lista existentă
      if (validUsers.length === 0 && users.length > 0) {
        console.log('✅ [EmpleadosPage] Lista filtrată este goală, dar avem lista existentă - o păstrăm.');
        setOperationLoading('users', false);
        return;
      }
      
      // Setăm lista doar dacă avem utilizatori valizi
      if (validUsers.length > 0) {
        setUsers(validUsers);
        console.log('✅ [EmpleadosPage] Lista empleados actualizată:', validUsers.length, 'utilizatori');
      } else {
        console.log('⚠️ [EmpleadosPage] Nu am găsit utilizatori valizi în răspuns.');
      }
    } else {
      setErrorUsers('No se pudieron cargar los empleados.');
    }
    
    setOperationLoading('users', false);
  }, [authUser, callApi, setOperationLoading, users.length]);

  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  // 'nombre', 'codigo', 'email', 'grupo', 'estado', 'centro', 'todos'
  const [searchBy, setSearchBy] = useState('nombre');
  // Filtru rapid după status ("ALL" | "ACTIVO" | "PENDIENTE")
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Verifica si el usuario es manager
  // Verifica si el usuario tiene acceso para gestión - FORȚEZ TRUE pentru testare
  const canManageEmployees = true;

  // Lista de CODIGO care au cel puțin o conexiune WebSocket activă (online)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // Fetch periodic al utilizatorilor online (doar pentru Admin/Developer/Manager/Supervisor)
  useEffect(() => {
    const grupo = authUser?.GRUPO || authUser?.grupo || '';
    const canSeeOnline =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!canSeeOnline || !authToken) {
      return;
    }

    let isCancelled = false;

    const fetchOnlineUsers = async () => {
      try {
        const res = await fetch(routes.getOnlineUsers, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!res.ok) {
          console.error(
            '[EmpleadosPage] Error fetching online users:',
            res.status,
          );
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];

        if (!isCancelled) {
          setOnlineUserIds(
            new Set(items.map((item) => String(item.userId || '').trim())),
          );
        }
      } catch (err) {
        console.error('[EmpleadosPage] Error fetching online users:', err);
      }
    };

    // Fetch imediat
    fetchOnlineUsers();
    // Reîncarcă la fiecare 30 de secunde
    const intervalId = setInterval(fetchOnlineUsers, 30000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [authUser?.GRUPO, authUser?.grupo, authToken]);

  // Funcție pentru filtrarea angajaților (memoizată pentru performanță)
  const getFilteredUsers = useMemo(() => {
    // În primul rând aplicăm filtrul de căutare
    const base = !searchTerm.trim()
      ? users
      : users.filter((user) => {
          const term = searchTerm.toLowerCase().trim();
          const nombre = user['NOMBRE / APELLIDOS']?.toLowerCase() || '';
          const codigo = user.CODIGO?.toLowerCase() || '';
          const email = user['CORREO ELECTRONICO']?.toLowerCase() || '';
          const grupo = (user['GRUPO'] || '').toString().toLowerCase();
          const estado = (user['ESTADO'] || '').toString().toLowerCase();
          const centro =
            (user['CENTRO TRABAJO'] || user.CENTRO_TRABAJO || '')
              .toString()
              .toLowerCase();

          switch (searchBy) {
            case 'nombre':
              return nombre.includes(term);
            case 'codigo':
              return codigo.includes(term);
            case 'email':
              return email.includes(term);
            case 'grupo':
              return grupo.includes(term);
            case 'estado':
              return estado.includes(term);
            case 'centro':
              return centro.includes(term);
            case 'todos':
            default:
              return (
                nombre.includes(term) ||
                codigo.includes(term) ||
                email.includes(term) ||
                grupo.includes(term) ||
                estado.includes(term) ||
                centro.includes(term)
              );
          }
        });

    // Apoi aplicăm filtrul de status, dacă este setat
    if (statusFilter === 'ALL') return base;

    // Status special: ONLINE - filtrează după lista de userId online
    if (statusFilter === 'ONLINE') {
      return base.filter((u) => {
        const codigo = (u['CODIGO'] || '').toString().trim();
        return codigo && onlineUserIds.has(codigo);
      });
    }

    const target = statusFilter.toUpperCase();
    return base.filter(
      (u) =>
        (u['ESTADO'] || u.ESTADO || '')
          .toString()
          .trim()
          .toUpperCase() === target,
    );
  }, [users, searchTerm, searchBy, statusFilter, onlineUserIds]);

  useEffect(() => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo empleados data instead of fetching from backend');
      setDemoEmpleados();
      setOperationLoading('users', false);
      setOperationLoading('clientes', false);
      return;
    }
    
    if (activeTab === 'lista') {
      fetchUsers();
    }
    fetchClientes();
    fetchContractTypes();
    fetchGrupos();
    
    activityLogger.logPageAccess('empleados', authUser);
  }, [activeTab, authUser, fetchUsers, fetchClientes, fetchContractTypes, fetchGrupos, setOperationLoading]);

  // Cargar avatares para los empleados visibles
  useEffect(() => {
    if (!bulkAvatarsLoaded) return;

    if (users.length > 0 && activeTab === 'lista') {
      const filteredUsers = getFilteredUsers;
      // Cargar solo primeros 20 avatares para evitar sobrecarga
      const usersToLoad = filteredUsers.slice(0, 20);
      
      usersToLoad.forEach(user => {
        if (
          user.CODIGO &&
          !Object.prototype.hasOwnProperty.call(employeeAvatars, user.CODIGO) &&
          !loadingAvatarsRef.current.has(user.CODIGO)
        ) {
          loadEmployeeAvatar(user.CODIGO, user['NOMBRE / APELLIDOS']);
        }
      });
    }
  }, [users, employeeAvatars, activeTab, getFilteredUsers, loadEmployeeAvatar, bulkAvatarsLoaded]);

  const handleAddUser = async () => {
    setAddError(null);
    setAddSuccess(false);
    
    try {
      // Deschide direct modalul pentru generare PDF - fără validare
      setPdfEmployeeData({ ...addForm });
      setShowPDFModal(true);
    } catch (error) {
      console.error('❌ Error in handleAddUser:', error);
      setAddError('Error al procesar la solicitud');
    }
  };

  // Funcția pentru succesul PDF
  const handlePDFSuccess = async () => {
    // Log crearea utilizatorului
    await activityLogger.logAction('user_created_with_pdf', {
      user: addForm['NOMBRE / APELLIDOS'],
      email: addForm['CORREO ELECTRONICO'],
      codigo: addForm.CODIGO,
      created_by: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
      created_by_email: authUser?.email,
      pdf_generated: true
    });
    
    setAddForm({
      ...Object.fromEntries(SHEET_FIELDS.map(f => [f, ''])),
      CODIGO: generateCodigo(),
      EMPRESA: 'DE CAMINO SERVICIOS AUXILIARES SL',
      ESTADO: 'PENDIENTE', // Default pentru angajați noi
      DerechoPedidos: 'NO',
      TrabajaFestivos: 'NO'
    });
    setAddSuccess(true);
    setShowPDFModal(false);
    setPdfEmployeeData(null);
    
    // Reîncarcă lista după adăugare cu cleanup
    const reloadTimeoutId = setTimeout(() => fetchUsers(), 1000);
    // Cleanup timeout-ul dacă componenta se unmount
    return () => clearTimeout(reloadTimeoutId);
  };

  // Funcția pentru eroarea PDF
  const handlePDFError = (error) => {
    setAddError(error);
    setShowPDFModal(false);
    setPdfEmployeeData(null);
  };

  const handleEditUser = async () => {
    setAddLoading(true);
    
    try {
      console.log('🔍 [handleEditUser] editForm:', editForm);
      console.log('🔍 [handleEditUser] CODIGO:', editForm?.CODIGO);
      console.log('🔍 [handleEditUser] Body stringified:', JSON.stringify(editForm));

      // Folosim fetch direct pentru a avea control complet asupra header-elor
      const token = localStorage.getItem('auth_token');
      const fetchHeaders = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0',
      };
      
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Construiește body-ul pentru request, incluzând parametrii pentru email
      const updateBody = { ...editForm };
      
      // Dacă trebuie să trimitem email la gestorie, adaugă parametrii necesari
      if (enviarAGestoriaEdit && originalEmployeeData) {
        updateBody.enviarAGestoria = 'true';
        
        // Compară datele originale cu cele noi pentru a identifica doar câmpurile modificate
        const camposModificados = [];
        Object.keys(editForm).forEach(key => {
          const valorAnterior = originalEmployeeData[key] || '';
          const valorNuevo = editForm[key] || '';
          const valAntNormalizado = String(valorAnterior).trim();
          const valNuevoNormalizado = String(valorNuevo).trim();
          
          if (key !== 'CODIGO' && valAntNormalizado !== valNuevoNormalizado) {
            camposModificados.push({
              campo: key,
              valorAnterior: valorAnterior || '(vacío)',
              valorNuevo: valorNuevo || '(vacío)'
            });
          }
        });

        // Construiește mesajul email
        let mensajeEmail = `Se ha actualizado la información del empleado:\n\n` +
                           `Empleado: ${editForm['NOMBRE / APELLIDOS'] || 'N/A'}\n` +
                           `Código: ${editForm.CODIGO || 'N/A'}\n` +
                           `Email: ${editForm['CORREO ELECTRONICO'] || 'N/A'}\n\n`;
        
        if (camposModificados.length > 0) {
          mensajeEmail += `Campos actualizados:\n\n`;
          camposModificados.forEach(campo => {
            mensajeEmail += `• ${campo.campo}:\n` +
                           `  - Valor anterior: ${campo.valorAnterior}\n` +
                           `  - Valor nuevo: ${campo.valorNuevo}\n\n`;
          });
        } else {
          mensajeEmail += `No se detectaron cambios en los campos.\n\n`;
        }
        
        mensajeEmail += `Actualizado por: ${authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Sistema'}\n` +
                       `Fecha: ${new Date().toLocaleString('es-ES')}`;

        updateBody.emailBody = mensajeEmail;
        updateBody.emailSubject = `Actualización de datos - ${editForm['NOMBRE / APELLIDOS'] || editForm.CODIGO || 'Empleado'}`;
        updateBody.updatedBy = authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Sistema';
      }

      const response = await fetch(API_ENDPOINTS.UPDATE_USER, {
        method: 'PUT',
        headers: fetchHeaders,
        body: JSON.stringify(updateBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [handleEditUser] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Accept { success: true } from backend
      const normalizedSuccess = result?.success === true;

      if (normalizedSuccess) {
        // Log actualizarea utilizatorului
        await activityLogger.logAction('user_updated', {
          user: editForm['NOMBRE / APELLIDOS'],
          email: editForm['CORREO ELECTRONICO'],
          codigo: editForm.CODIGO,
          updated_by: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          updated_by_email: authUser?.email
        });
        
        // Email-ul la gestorie se trimite automat prin backend dacă enviarAGestoriaEdit este true
        // Backend-ul verifică parametrul enviarAGestoria în body și trimite email-ul la:
        // - TO: altemprado@gmail.com (gestoria)
        // - BCC: info@decaminoservicios.com, mirisjm@gmail.com
        
        setShowEditModal(false);
        setEnviarAGestoriaEdit(false); // Reset checkbox după salvare
        setOriginalEmployeeData(null); // Reset datele originale după salvare
        // Reîncarcă lista după editare
        setTimeout(() => fetchUsers(), 500);
      } else {
        setAddError('No se pudo actualizar el usuario.');
      }
    } catch (e) {
      setAddError('No se pudo actualizar el usuario.');
    } finally {
      // Asigură deblocarea butonului în toate cazurile
      setAddLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const { exportToExcelWithHeader } = await import('../utils/exportExcel');
      
      const dataToExport = searchTerm ? getFilteredUsers : users;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      // Collect all unique keys from all employee records
      const allKeys = new Set();
      dataToExport.forEach(user => {
        Object.keys(user).forEach(key => allKeys.add(key));
      });

      // Create columns dynamically from all available keys
      // Prioritize important columns first, then add the rest
      const priorityColumns = [
        'CODIGO', 'NOMBRE / APELLIDOS', 'CORREO ELECTRONICO', 'D.N.I. / NIE',
        'TELEFONO', 'NACIONALIDAD', 'DIRECCION', 'SEG. SOCIAL', 'Nº Cuenta',
        'FECHA NACIMIENTO', 'FECHA DE ALTA', 'FECHA BAJA', 'CENTRO TRABAJO',
        'TIPO DE CONTRATO', 'HORAS DE CONTRATO', 'SUELDO BRUTO MENSUAL',
        'EMPRESA', 'GRUPO', 'ESTADO'
      ];

      const columns = [];
      
      // Add priority columns first
      priorityColumns.forEach(key => {
        if (allKeys.has(key)) {
          columns.push({
            key: key,
            label: key,
            width: key.length > 20 ? 30 : key.length > 15 ? 20 : 15
          });
          allKeys.delete(key);
        }
      });

      // Add remaining columns
      Array.from(allKeys).sort().forEach(key => {
        columns.push({
          key: key,
          label: key,
          width: key.length > 20 ? 30 : key.length > 15 ? 20 : 15
        });
      });

      console.log('📊 Exporting with columns:', columns.map(c => c.key));

      // Export data
      await exportToExcelWithHeader(
        dataToExport,
        columns,
        'LISTA DE EMPLEADOS',
        'empleados',
        {},
        new Date().toLocaleDateString('es-ES')
      );

      // Log export
      await activityLogger.logDataExport('empleados_excel', {
        count: dataToExport.length,
        filters: { searchTerm, searchBy },
        columnsExported: columns.length
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

      const dataToExport = searchTerm ? getFilteredUsers : users;
      
      if (!dataToExport || dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      // Construye el cuerpo de la tabla CON AVATARES
      const tableBody = [
        // Headers
        [
          { text: 'Avatar', style: 'tableHeader' },
          { text: 'Código', style: 'tableHeader' },
          { text: 'Nombre', style: 'tableHeader' },
          { text: 'Email', style: 'tableHeader' },
          { text: 'DNI/NIE', style: 'tableHeader' },
          { text: 'Teléfono', style: 'tableHeader' },
          { text: 'Estado', style: 'tableHeader' },
          { text: 'Grupo', style: 'tableHeader' }
        ],
        // Datos con avatares
        ...dataToExport.map(emp => {
          const avatarBase64 = employeeAvatars[emp.CODIGO];
          
          return [
            // Avatar - imagen o emoji
            avatarBase64 && avatarBase64.startsWith('data:image')
              ? { 
                  image: avatarBase64, 
                  width: 30, 
                  height: 30,
                  alignment: 'center'
                }
              : { 
                  text: '👤', 
                  fontSize: 16, 
                  alignment: 'center' 
                },
            emp.CODIGO || '',
            emp['NOMBRE / APELLIDOS'] || '',
            { text: emp['CORREO ELECTRONICO'] || '', fontSize: 7 },
            emp['D.N.I. / NIE'] || '',
            emp.TELEFONO || '',
            emp.ESTADO || '',
            emp.GRUPO || ''
          ];
        })
      ];

      // Construye el título del reporte
      const reportTitle = searchTerm 
        ? `LISTA DE EMPLEADOS - Búsqueda: "${searchTerm}"`
        : 'LISTA DE EMPLEADOS';

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
          { text: `Fecha: ${new Date().toLocaleDateString('es-ES')}`, style: 'period', margin: [0, 0, 0, 10] },
          
          // Tabla con datos CON AVATAR
          {
            table: { 
              headerRows: 1, 
              widths: [40, 55, '*', 110, 65, 65, 45, 55], // Avatar + 7 columnas
              body: tableBody 
            },
            layout: 'lightHorizontalLines',
            fontSize: 8
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
          },
          tableHeader: {
            fontSize: 9,
            bold: true,
            fillColor: '#EEEEEE',
            alignment: 'center'
          }
        }
      };

      // Construye el nombre del archivo
      const filename = searchTerm 
        ? `empleados_busqueda_${searchTerm.toLowerCase().replace(/\s+/g, '_')}.pdf`
        : 'empleados.pdf';

      window.pdfMake.createPdf(docDefinition).download(filename);

      // Log export-ul de date
      await activityLogger.logDataExport('empleados_pdf', {
        count: dataToExport.length,
        filters: {
          searchTerm: searchTerm,
          searchBy: searchBy
        }
      }, authUser);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF. Por favor, inténtalo de nuevo.');
    }
  };

  const openEditModal = (user) => {
    const mappedUser = mapEmployeeRecord(user);
    setEditForm(mappedUser);
    setOriginalEmployeeData({ ...mappedUser }); // Salvează datele originale pentru comparație
    setEnviarAGestoriaEdit(false); // Reset checkbox la deschiderea modalului
    setShowEditModal(true);
  };

  // Funcții pentru email
  const openEmailModal = (user) => {
    console.log('Deschid modal email pentru:', user);
    setSelectedUserForEmail(user);
    setEmailForm({
      destinatar: 'angajat',
      grup: gruposList.length > 0 ? gruposList[0] : 'Empleado',
      subiect: '',
      mensaje: ''
    });
    setEmailError(null);
    setEmailSuccess(false);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    setEmailError(null);
    setEmailSuccess(false);
    
    if (!emailForm.mensaje.trim()) {
      setEmailError('Por favor, escribe un mensaje.');
      return;
    }
    
    if (emailForm.destinatar === 'angajat' && !selectedUserForEmail) {
      setEmailError('No se ha identificado el empleado.');
      return;
    }
    
    setEmailLoading(true);
    
    try {
      const emailData = {
        mesaj: emailForm.mensaje,
        subiect: emailForm.subiect,
        destinatar: emailForm.destinatar,
        // Pentru destinatar individual trimitem grupul real al angajatului
        grup: emailForm.destinatar === 'angajat' ? (selectedUserForEmail?.GRUPO || selectedUserForEmail?.grupo) : emailForm.grup,
        codigo: emailForm.destinatar === 'angajat' ? selectedUserForEmail?.CODIGO : undefined
      };
      
      // Production/dev aware endpoint via routes (absolute in PROD, proxied in DEV)
      const response = await fetch(routes.sendNotificacion, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify(emailData)
      });

      const result = response.ok ? await response.json() : { success: false };

      if (result && result.success) {
        // Log trimiterea email-ului
        await activityLogger.logAction('email_sent', {
          destinatar: emailForm.destinatar,
          grup: emailForm.grup,
          subiect: emailForm.subiect,
          codigo: emailForm.destinatar === 'angajat' ? selectedUserForEmail?.CODIGO : undefined,
          user: authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre,
          email: authUser?.email
        });
        
        setEmailSuccess(true);
        setEmailForm({
          destinatar: 'angajat',
          grup: 'Empleado',
          subiect: '',
          mensaje: ''
        });
        const emailTimeoutId = setTimeout(() => {
          setShowEmailModal(false);
          setEmailSuccess(false);
        }, 2000);
        // Cleanup timeout-ul dacă componenta se unmount
        return () => clearTimeout(emailTimeoutId);
      } else {
        setEmailError('Ha ocurrido un problema al enviar el correo.');
      }
    } catch (error) {
      setEmailError('No se pudo enviar el correo.');
    }
    
    setEmailLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header ULTRA MODERN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {canManageEmployees ? 'Gestión de Empleados' : 'Mis Inspecciones'}
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              {canManageEmployees 
                ? 'Administra la lista de empleados y añade nuevos usuarios'
                : 'Consulta tus inspecciones programadas'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tabs ULTRA MODERN */}
      <Card>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6">
          {canManageEmployees && (
            <button
              onClick={() => setActiveTab('lista')}
              className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'lista'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'lista' 
                  ? 'bg-blue-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-blue-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">👥</span>
                <span>Lista de empleados</span>
              </div>
            </button>
          )}
          {(
            <button
              onClick={() => {
                console.log('🔄 Switching to adauga tab');
                setActiveTab('adauga');
              }}
              className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'adauga'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                  : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'adauga' 
                  ? 'bg-green-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-green-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">➕</span>
                <span>Añadir empleado</span>
              </div>
            </button>
          )}

        </div>

        {activeTab === 'lista' && canManageEmployees ? (
          // Lista de angajați
          <div>
            {isOperationLoading('users') ? (
              <TableLoading columns={6} rows={5} className="p-4" />
            ) : errorUsers ? (
              <div className="text-center text-red-600 font-bold py-8">{errorUsers}</div>
            ) : (
              <>
                {/* Estadísticas SUPER ELEGANTES y compactas */}
                <div className="flex flex-wrap gap-3 mb-5">
                  {/* Card 1 - Total Empleados - BLUE */}
                  <div 
                    className="group relative overflow-hidden flex-1 min-w-[140px] cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.12)',
                      padding: '1rem'
                    }}
                  onClick={() => setStatusFilter('ALL')}
                  role="button"
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-blue-400 opacity-0 group-hover:opacity-15 blur-lg transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        <span className="text-xl">👥</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl font-black text-blue-900">
                          {searchTerm ? getFilteredUsers.length : users.length}
                        </div>
                        <div className="text-xs font-semibold text-blue-700 truncate">
                          {searchTerm ? `de ${users.length}` : 'Total'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  </div>

                  {/* Card 2 - Activos - GREEN */}
                  <div 
                    className="group relative overflow-hidden flex-1 min-w-[140px] cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(22, 163, 74, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      boxShadow: '0 4px 15px rgba(34, 197, 94, 0.12)',
                      padding: '1rem'
                    }}
                  onClick={() => setStatusFilter('ACTIVO')}
                  role="button"
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-green-400 opacity-0 group-hover:opacity-15 blur-lg transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                        }}
                      >
                        <span className="text-xl">✅</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl font-black text-green-900">
                          {users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO').length}
                        </div>
                        <div className="text-xs font-semibold text-green-700 truncate">Activos</div>
                      </div>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  </div>

                  {/* Card 3 - Pendientes - YELLOW */}
                  <div 
                    className="group relative overflow-hidden flex-1 min-w-[140px] cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(251, 191, 36, 0.2)',
                      boxShadow: '0 4px 15px rgba(251, 191, 36, 0.12)',
                      padding: '1rem'
                    }}
                  onClick={() => setStatusFilter('PENDIENTE')}
                  role="button"
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-yellow-400 opacity-0 group-hover:opacity-15 blur-lg transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
                        }}
                      >
                        <span className="text-xl">🕒</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl font-black text-yellow-900">
                          {users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'PENDIENTE').length}
                        </div>
                        <div className="text-xs font-semibold text-yellow-700 truncate">Pendientes</div>
                      </div>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  </div>

                  {/* Card 4 - Online - TEAL */}
                  <div
                    className="group relative overflow-hidden flex-1 min-w-[140px] cursor-pointer"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, rgba(20, 184, 166, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(45, 212, 191, 0.2)',
                      boxShadow: '0 4px 15px rgba(45, 212, 191, 0.12)',
                      padding: '1rem',
                    }}
                  onClick={() => setStatusFilter('ONLINE')}
                  role="button"
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-2xl bg-teal-400 opacity-0 group-hover:opacity-15 blur-lg transition-opacity duration-300"></div>

                    {/* Contenido */}
                    <div className="relative flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                        style={{
                          background:
                            'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                          boxShadow: '0 4px 12px rgba(45, 212, 191, 0.3)',
                        }}
                      >
                        <span className="text-xl">🟢</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl font-black text-teal-900">
                          {onlineUserIds.size}
                        </div>
                        <div className="text-xs font-semibold text-teal-700 truncate">
                          Online
                        </div>
                      </div>
                    </div>

                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  </div>
                </div>

                {/* Barra de búsqueda moderna */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Input búsqueda */}
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar empleados..."
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Selector tipo búsqueda */}
                    <div className="relative">
                      <select
                        value={searchBy}
                        onChange={(e) => setSearchBy(e.target.value)}
                        className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-white"
                      >
                        <option value="nombre">👤 Nombre</option>
                        <option value="codigo">🔢 Código</option>
                        <option value="email">📧 Email</option>
                        <option value="grupo">👥 Grupo</option>
                        <option value="estado">✅ Estado</option>
                        <option value="centro">📍 Centro</option>
                        <option value="todos">🔍 Todos</option>
                      </select>
                    </div>
                    
                    {/* Botón clear */}
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors duration-200"
                      >
                        ✖️ Clear
                      </button>
                    )}
                  </div>
                  
                  {/* Resultados búsqueda */}
                  {searchTerm && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 text-sm">
                        <span className="font-medium">{getFilteredUsers.length}</span> resultados para &quot;{searchTerm}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* Botones ELEGANTES y compactos */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {/* Exportar Excel - GREEN */}
                  <button
                    onClick={handleExportExcel}
                    className="group relative overflow-hidden flex-1 min-w-[120px] transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                      padding: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                    }}
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-xl bg-emerald-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-2 justify-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transform group-hover:scale-110 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <span className="text-base">📊</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-800">Exportar Excel</span>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                  </button>

                  {/* Exportar PDF - PURPLE */}
                  <button
                    onClick={handleExportPDF}
                    className="group relative overflow-hidden flex-1 min-w-[120px] transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.15)',
                      padding: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(139, 92, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.15)';
                    }}
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-2 justify-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transform group-hover:scale-110 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                        }}
                      >
                        <span className="text-base">📋</span>
                      </div>
                      <span className="text-sm font-bold text-purple-800">Exportar PDF</span>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                  </button>

                  {/* Actualizar - BLUE */}
                  <button
                    onClick={fetchUsers}
                    className="group relative overflow-hidden flex-1 min-w-[120px] transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                      padding: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    }}
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-2 justify-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transform group-hover:scale-110 group-hover:rotate-180 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        <span className="text-base">🔄</span>
                      </div>
                      <span className="text-sm font-bold text-blue-800">Actualizar</span>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                  </button>
                </div>

                {/* Lista empleados */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <div className="divide-y divide-gray-200">
                      {getFilteredUsers.map((user, idx) => {
                        const codigo = (user['CODIGO'] || '').toString().trim();
                        const isOnline = codigo && onlineUserIds.has(codigo);

                        return (
                        <div key={user['CODIGO'] || idx} className="p-4 hover:bg-gray-50 transition-colors">
                          {/* Header - Avatar + Nume */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Avatar con imagen o iniciales */}
                            <div className="relative group/avatar">
                              {/* Glow sutil en hover */}
                              <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-sm opacity-0 group-hover/avatar:opacity-40 transition-opacity duration-300"></div>
                              
                              <div 
                                className="relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shadow-md transform group-hover/avatar:scale-110 transition-all duration-300"
                                style={{
                                  background: employeeAvatars[user['CODIGO']] 
                                    ? 'transparent' 
                                    : 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
                                  border: '2px solid rgba(239, 68, 68, 0.2)'
                                }}
                              >
                                {employeeAvatars[user['CODIGO']] ? (
                                  <img 
                                    src={employeeAvatars[user['CODIGO']]} 
                                    alt={user['NOMBRE / APELLIDOS']} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-red-600 font-bold text-sm">
                                    {user['NOMBRE / APELLIDOS']?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900">
                                  {user['NOMBRE / APELLIDOS'] || 'Sin nombre'}
                                </h3>
                                {codigo && (
                                  <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                                    <span
                                      className={`inline-block h-2 w-2 rounded-full ${
                                        isOnline
                                          ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.3)]'
                                          : 'bg-gray-300'
                                      }`}
                                    />
                                    <span className="uppercase tracking-wide">
                                      {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Info - Cod + Email */}
                          <div className="ml-13 mb-3">
                            <p className="text-sm text-gray-600">Cod: {user['CODIGO']}</p>
                            <p className="text-sm text-gray-500">{user['CORREO ELECTRONICO']}</p>
                          </div>

                          {/* Bottom - Rol + Status + Butoane */}
                          <div className="ml-13 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            {/* Rol și Status */}
                            <div className="flex flex-wrap gap-2">
                              {user['GRUPO'] && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  user['GRUPO'] === 'Manager' || user['GRUPO'] === 'Supervisor'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {user['GRUPO']}
                                </span>
                              )}
                              {user['ESTADO'] && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  (user['ESTADO'] || '').toString().toUpperCase() === 'ACTIVO'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {(user['ESTADO'] || '').toString().toUpperCase()}
                                </span>
                              )}
                            </div>
                            
                            {/* Butoane */}
                            <div className="flex gap-2">
                              {/* Icon MODERN Editar */}
                              <button
                                onClick={() => openEditModal(user)}
                                className="group relative p-1.5 rounded-lg transition-all duration-300 transform hover:scale-125 hover:rotate-12"
                                title="Modificar datos"
                              >
                                <span className="text-xl relative z-10 inline-block transition-all duration-300 filter group-hover:drop-shadow-lg" style={{
                                  filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))',
                                }}>⚙️</span>
                              </button>
                              
                              {/* Icon MODERN Email */}
                              <button
                                onClick={() => openEmailModal(user)}
                                className="group relative p-1.5 rounded-lg transition-all duration-300 transform hover:scale-125"
                                title="Enviar email"
                              >
                                <span className="text-xl relative z-10 inline-block transition-all duration-300 filter group-hover:drop-shadow-lg" style={{
                                  filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))',
                                }}>📧</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'adauga' ? (
          // Formulario añadir empleado
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
              Añadir Nuevo Empleado
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SHEET_FIELDS.map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field === 'CODIGO' && '🆔'} 
                    {field === 'NOMBRE / APELLIDOS' && '👤'} 
                    {field === 'CORREO ELECTRONICO' && '📧'} 
                    {field === 'NACIONALIDAD' && '🌍'} 
                    {field === 'DIRECCION' && '🏠'} 
                    {field === 'D.N.I. / NIE' && '📄'} 
                    {field === 'SEG. SOCIAL' && '🏥'} 
                    {field === 'Nº Cuenta' && '💳'} 
                    {field === 'TELEFONO' && '📞'} 
                    {field === 'FECHA NACIMIENTO' && '🎂'} 
                    {field === 'FECHA DE ALTA' && '📅'} 
                    {field === 'FECHA BAJA' && '🚪'} 
                    {field === 'Fecha Antigüedad' && '📆'} 
                    {field === 'Antigüedad' && '🎯'} 
                    {field === 'CENTRO TRABAJO' && '🏢'} 
                    {field === 'TIPO DE CONTRATO' && '📋'} 
                    {field === 'SUELDO BRUTO MENSUAL' && '💰'} 
                    {field === 'HORAS DE CONTRATO' && '⏰'} 
                    {field === 'EMPRESA' && '🏢'} 
                    {field === 'GRUPO' && '👥'} 
                    {field === 'ESTADO' && '📊'} 
                    {field === 'DerechoPedidos' && '🛒'} 
                    {field === 'TrabajaFestivos' && '🎉'} 
                    {field === 'Contraseña' && '🔑'} 
                    {field === 'CuantoPuedeGastar' && '💰'} 
                    {field}
                  </label>
                  {field === 'CODIGO' ? (
                    <Input
                      value={addForm[field]}
                      readOnly
                      className="bg-gray-100"
                    />
                  ) : field === 'D.N.I. / NIE' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                          addForm[field] ? (
                            validarDNINIE(addForm[field]) === true 
                              ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                              : validarDNINIE(addForm[field]) === false 
                                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                          ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        }`}
                        value={addForm[field] || ''}
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="12345678A (DNI) sau X1234567A (NIE)"
                        maxLength="9"
                      />
                      {addForm[field] && addForm[field].trim() !== '' && (
                        <div className="flex items-center gap-2 text-sm">
                          {validarDNINIE(addForm[field]) === true ? (
                            <>
                              <span className="text-green-600">✅</span>
                              <span className="text-green-600 font-medium">DNI/NIE español válido</span>
                            </>
                          ) : validarDNINIE(addForm[field]) === false ? (
                            <>
                              <span className="text-red-600">❌</span>
                              <span className="text-red-600 font-medium">DNI/NIE español inválido</span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : field === 'SEG. SOCIAL' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                          addForm[field] ? (
                            validarSeguridadSocial(addForm[field]) === true 
                              ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                              : validarSeguridadSocial(addForm[field]) === false 
                                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                          ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        }`}
                        value={addForm[field] || ''}
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="123456789012 (12 cifras)"
                        maxLength="12"
                      />
                      {addForm[field] && addForm[field].trim() !== '' && (
                        <div className="flex items-center gap-2 text-sm">
                          {validarSeguridadSocial(addForm[field]) === true ? (
                            <>
                              <span className="text-green-600">✅</span>
                              <span className="text-green-600 font-medium">Número de Seguridad Social válido</span>
                            </>
                          ) : validarSeguridadSocial(addForm[field]) === false ? (
                            <>
                              <span className="text-red-600">❌</span>
                              <span className="text-red-600 font-medium">Número de Seguridad Social inválido</span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : field === 'Nº Cuenta' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                          addForm[field] ? (
                            validarIBAN(addForm[field]) === true 
                              ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                              : validarIBAN(addForm[field]) === false 
                                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                          ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        }`}
                        value={addForm[field] || ''}
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="ES91 2100 0418 4502 0005 1332 (IBAN español)"
                        maxLength="24"
                      />
                      {addForm[field] && addForm[field].trim() !== '' && (
                        <div className="flex items-center gap-2 text-sm">
                          {validarIBAN(addForm[field]) === true ? (
                            <>
                              <span className="text-green-600">✅</span>
                              <span className="text-green-600 font-medium">IBAN español válido</span>
                            </>
                          ) : validarIBAN(addForm[field]) === false ? (
                            <>
                              <span className="text-red-600">❌</span>
                              <span className="text-red-600 font-medium">IBAN español inválido</span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : field === 'FECHA NACIMIENTO' ? (
                    <Input
                      type="date"
                      value={addForm[field] ? (() => {
                        const date = addForm[field];
                        // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                        if (date.includes('/')) {
                          const [dd, mm, yyyy] = date.split('/');
                          return `${yyyy}-${mm}-${dd}`;
                        } else if (date.includes('-')) {
                          const parts = date.split('-');
                          if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                          const [dd, mm, yyyy] = parts;
                          return `${yyyy}-${mm}-${dd}`;
                        }
                        return date;
                      })() : ''}
                      onChange={(e) => {
                        const [yyyy, mm, dd] = e.target.value.split('-');
                        setAddForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                      }}
                    />
                  ) : field === 'FECHA DE ALTA' ? (
                    <Input
                      type="date"
                      value={addForm[field] ? (() => {
                        const date = addForm[field];
                        // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                        if (date.includes('/')) {
                          const [dd, mm, yyyy] = date.split('/');
                          return `${yyyy}-${mm}-${dd}`;
                        } else if (date.includes('-')) {
                          const parts = date.split('-');
                          if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                          const [dd, mm, yyyy] = parts;
                          return `${yyyy}-${mm}-${dd}`;
                        }
                        return date;
                      })() : ''}
                      onChange={(e) => {
                        const [yyyy, mm, dd] = e.target.value.split('-');
                        setAddForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                      }}
                    />
                  ) : field === 'FECHA BAJA' ? (
                    <Input
                      type="date"
                      value={addForm[field] ? (() => {
                        const date = addForm[field];
                        // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                        if (date.includes('/')) {
                          const [dd, mm, yyyy] = date.split('/');
                          return `${yyyy}-${mm}-${dd}`;
                        } else if (date.includes('-')) {
                          const parts = date.split('-');
                          if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                          const [dd, mm, yyyy] = parts;
                          return `${yyyy}-${mm}-${dd}`;
                        }
                        return date;
                      })() : ''}
                      onChange={(e) => {
                        const [yyyy, mm, dd] = e.target.value.split('-');
                        setAddForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                      }}
                    />
                  ) : field === 'Fecha Antigüedad' ? (
                    <Input
                      type="date"
                      value={addForm[field] ? (() => {
                        const date = addForm[field];
                        // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                        if (date.includes('/')) {
                          const [dd, mm, yyyy] = date.split('/');
                          return `${yyyy}-${mm}-${dd}`;
                        } else if (date.includes('-')) {
                          const parts = date.split('-');
                          if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                          const [dd, mm, yyyy] = parts;
                          return `${yyyy}-${mm}-${dd}`;
                        }
                        return date;
                      })() : ''}
                      onChange={(e) => {
                        const [yyyy, mm, dd] = e.target.value.split('-');
                        setAddForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                      }}
                    />
                  ) : field === 'Antigüedad' ? (
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-gray-800 bg-green-50 focus:outline-none cursor-not-allowed font-semibold"
                        value={calcularAntiguedad(addForm['Fecha Antigüedad'], addForm['FECHA BAJA'])}
                        readOnly
                        placeholder="Se calcula automáticamente"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-green-600 text-lg">🎯</span>
                      </div>
                    </div>
                  ) : field === 'CENTRO TRABAJO' ? (
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                        placeholder="Buscar centro de trabajo..."
                      value={addForm[field] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddForm(prev => ({ ...prev, [field]: value }));
                          setShowCentroDropdown(true);
                        }}
                        onFocus={() => setShowCentroDropdown(true)}
                        onBlur={() => {
                          // Delay to allow clicking on dropdown items
                          setTimeout(() => setShowCentroDropdown(false), 200);
                        }}
                      disabled={isOperationLoading('clientes')}
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      
                      {/* Dropdown de sugerencias */}
                      {showCentroDropdown && addForm[field] && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {clientes
                            .filter(cliente => 
                              cliente['NOMBRE O RAZON SOCIAL']
                                .toLowerCase()
                                .includes(addForm[field].toLowerCase())
                            )
                            .slice(0, 10) // Limitar a 10 resultados
                            .map(cliente => (
                              <button
                                key={cliente.NIF}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setAddForm(prev => ({ ...prev, [field]: cliente['NOMBRE O RAZON SOCIAL'] }));
                                  setShowCentroDropdown(false);
                                }}
                              >
                                <div className="font-medium text-gray-900">{cliente['NOMBRE O RAZON SOCIAL']}</div>
                                <div className="text-sm text-gray-500">NIF: {cliente.NIF}</div>
                              </button>
                            ))}
                          {clientes.filter(cliente => 
                            cliente['NOMBRE O RAZON SOCIAL']
                              .toLowerCase()
                              .includes(addForm[field].toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              No se encontraron centros
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : field === 'NACIONALIDAD' ? (
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                        placeholder="Buscar nacionalidad..."
                        value={addForm[field] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddForm(prev => ({ ...prev, [field]: value }));
                          setShowNacionalidadDropdown(true);
                        }}
                        onFocus={() => setShowNacionalidadDropdown(true)}
                        onBlur={() => {
                          // Delay to allow clicking on dropdown items
                          setTimeout(() => setShowNacionalidadDropdown(false), 200);
                        }}
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      
                      {/* Dropdown de sugerencias */}
                      {showNacionalidadDropdown && addForm[field] && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {paises
                            .filter(pais => 
                              pais.toLowerCase().includes(addForm[field].toLowerCase())
                            )
                            .slice(0, 15) // Limitar a 15 resultados
                            .map((pais, index) => (
                              <button
                                key={`${pais}-${index}`}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setAddForm(prev => ({ ...prev, [field]: pais }));
                                  setShowNacionalidadDropdown(false);
                                }}
                              >
                                <div className="font-medium text-gray-900">{pais}</div>
                              </button>
                            ))}
                          {paises.filter(pais => 
                            pais.toLowerCase().includes(addForm[field].toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              No se encontraron países
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : field === 'EMPRESA' ? (
                    <input
                      type="text"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                      value={addForm[field] || ''}
                      readOnly={true}
                      placeholder={`${field.toLowerCase()} (solo lectura)`}
                    />
                  ) : field === 'ESTADO' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || 'PENDIENTE'}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="PENDIENTE">🟡 PENDIENTE</option>
                      <option value="ACTIVO">🟢 ACTIVO</option>
                      <option value="INACTIVO">🔴 INACTIVO</option>
                    </select>
                  ) : field === 'DerechoPedidos' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || 'NO'}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="NO">❌ NO</option>
                      <option value="SI">✅ SI</option>
                    </select>
                  ) : field === 'TrabajaFestivos' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || 'NO'}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="NO">❌ NO</option>
                      <option value="SI">✅ SI</option>
                    </select>
                  ) : field === 'Contraseña' ? (
                    <input
                      type="text"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="Introduce la contraseña"
                    />
                  ) : field === 'CuantoPuedeGastar' ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                        value={addForm[field] || ''}
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="0.00"
                      />
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>💰</span>
                        <span>Límite de gasto en EUR</span>
                      </div>
                    </div>
                  ) : field === 'TIPO DE CONTRATO' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      disabled={isOperationLoading('contractTypes')}
                    >
                      <option value="">Seleccionar tipo de contrato...</option>
                      {isOperationLoading('contractTypes') ? (
                        <option value="" disabled>Cargando tipos...</option>
                      ) : (
                        contractTypes.map((contractType) => (
                          <option key={contractType.id} value={contractType.tipo}>
                            {contractType.tipo}
                          </option>
                        ))
                      )}
                    </select>
                  ) : field === 'HORAS DE CONTRATO' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="">Seleccionar horas...</option>
                      {Array.from({ length: 40 }, (_, i) => i + 1).map(hours => (
                        <option key={hours} value={hours}>
                          {hours} {hours === 1 ? 'hora' : 'horas'}
                        </option>
                      ))}
                    </select>
                  ) : field === 'GRUPO' ? (
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      disabled={isOperationLoading('grupos')}
                    >
                      <option value="">Selecciona un grupo...</option>
                      {isOperationLoading('grupos') ? (
                        <option value="" disabled>Cargando grupos...</option>
                      ) : (
                        gruposList.map((grupo) => (
                          <option key={grupo} value={grupo}>{grupo}</option>
                        ))
                      )}
                    </select>
                  ) : (
                    <Input
                      placeholder={field}
                      value={addForm[field]}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
            
            {/* Checkbox pentru "Enviar a Gestoria" */}
            <div className="mt-6 flex items-center justify-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarAGestoria}
                  onChange={(e) => setEnviarAGestoria(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  📧 Enviar a Gestoria
                </span>
              </label>
            </div>
            
            <div className="mt-6 text-center">
              <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddUser();
                  }}
                variant="primary"
                size="lg"
                loading={addLoading}
                disabled={addLoading}
                type="button"
              >
                Añadir Usuario
              </Button>
            </div>
            
            {addError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {addError}
              </div>
            )}
            
            {addSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                Usuario añadido correctamente.
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {/* Modal ULTRA MODERN para editar empleado */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in duration-300">
            {/* Header ULTRA MODERN */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">✏️</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Detalles del empleado</h2>
                    <p className="text-sm text-blue-600 font-medium">Modificar información del empleado</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-10 h-10 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-blue-500 text-xl">✕</span>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SHEET_FIELDS.map(field => {
                  const fieldId = `add-${field.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                  return (
                  <div key={field}>
                <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-2">
                  {field === 'CODIGO' && '🆔'} 
                  {field === 'NOMBRE / APELLIDOS' && '👤'} 
                  {field === 'CORREO ELECTRONICO' && '📧'} 
                  {field === 'NACIONALIDAD' && '🌍'} 
                  {field === 'DIRECCION' && '🏠'} 
                  {field === 'D.N.I. / NIE' && '📄'} 
                  {field === 'SEG. SOCIAL' && '🏥'} 
                  {field === 'Nº Cuenta' && '💳'} 
                  {field === 'TELEFONO' && '📞'} 
                  {field === 'Fecha Antigüedad' && '📆'} 
                  {field === 'FECHA NACIMIENTO' && '🎂'} 
                  {field === 'FECHA DE ALTA' && '📅'} 
                  {field === 'FECHA BAJA' && '🚪'} 
                  {field === 'DerechoPedidos' && '🛒'} 
                  {field === 'TrabajaFestivos' && '🎉'} 
                  {field === 'Contraseña' && '🔑'} 
                  {field === 'CuantoPuedeGastar' && '💰'} 
                  {field}
                </label>
                {field === 'CODIGO' ? (
                  <Input
                    id={fieldId}
                    value={editForm[field]}
                    readOnly
                    className="bg-gray-100"
                  />
                ) : field === 'D.N.I. / NIE' ? (
                  <div className="space-y-2">
                    <input
                      id={fieldId}
                      name={field}
                      type="text"
                      className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                        editForm[field] ? (
                          validarDNINIE(editForm[field]) === true 
                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                            : validarDNINIE(editForm[field]) === false 
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                      }`}
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="12345678A (DNI) sau X1234567A (NIE)"
                      maxLength="9"
                    />
                    {editForm[field] && editForm[field].trim() !== '' && (
                      <div className="flex items-center gap-2 text-sm">
                        {validarDNINIE(editForm[field]) === true ? (
                          <>
                            <span className="text-green-600">✅</span>
                            <span className="text-green-600 font-medium">DNI/NIE español válido</span>
                          </>
                        ) : validarDNINIE(editForm[field]) === false ? (
                          <>
                            <span className="text-red-600">❌</span>
                            <span className="text-red-600 font-medium">DNI/NIE español inválido</span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : field === 'SEG. SOCIAL' ? (
                  <div className="space-y-2">
                    <input
                      id={fieldId}
                      name={field}
                      type="text"
                      className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                        editForm[field] ? (
                          validarSeguridadSocial(editForm[field]) === true 
                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                            : validarSeguridadSocial(editForm[field]) === false 
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                      }`}
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="123456789012 (12 cifras)"
                      maxLength="12"
                    />
                    {editForm[field] && editForm[field].trim() !== '' && (
                      <div className="flex items-center gap-2 text-sm">
                        {validarSeguridadSocial(editForm[field]) === true ? (
                          <>
                            <span className="text-green-600">✅</span>
                            <span className="text-green-600 font-medium">Número de Seguridad Social válido</span>
                          </>
                        ) : validarSeguridadSocial(editForm[field]) === false ? (
                          <>
                            <span className="text-red-600">❌</span>
                            <span className="text-red-600 font-medium">Número de Seguridad Social inválido</span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : field === 'Nº Cuenta' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border-2 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                        editForm[field] ? (
                          validarIBAN(editForm[field]) === true 
                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                            : validarIBAN(editForm[field]) === false 
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                        ) : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                      }`}
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="ES91 2100 0418 4502 0005 1332 (IBAN español)"
                      maxLength="24"
                    />
                    {editForm[field] && editForm[field].trim() !== '' && (
                      <div className="flex items-center gap-2 text-sm">
                        {validarIBAN(editForm[field]) === true ? (
                          <>
                            <span className="text-green-600">✅</span>
                            <span className="text-green-600 font-medium">IBAN español válido</span>
                          </>
                        ) : validarIBAN(editForm[field]) === false ? (
                          <>
                            <span className="text-red-600">❌</span>
                            <span className="text-red-600 font-medium">IBAN español inválido</span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : field === 'FECHA NACIMIENTO' ? (
                  <input
                    type="date"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] ? (() => {
                      const date = editForm[field];
                      // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                      if (date.includes('/')) {
                        const [dd, mm, yyyy] = date.split('/');
                        return `${yyyy}-${mm}-${dd}`;
                      } else if (date.includes('-')) {
                        const parts = date.split('-');
                        if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                        const [dd, mm, yyyy] = parts;
                        return `${yyyy}-${mm}-${dd}`;
                      }
                      return date;
                    })() : ''}
                    onChange={(e) => {
                      const [yyyy, mm, dd] = e.target.value.split('-');
                      setEditForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                    }}
                  />
                ) : field === 'FECHA DE ALTA' ? (
                  <input
                    type="date"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] ? (() => {
                      const date = editForm[field];
                      // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                      if (date.includes('/')) {
                        const [dd, mm, yyyy] = date.split('/');
                        return `${yyyy}-${mm}-${dd}`;
                      } else if (date.includes('-')) {
                        const parts = date.split('-');
                        if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                        const [dd, mm, yyyy] = parts;
                        return `${yyyy}-${mm}-${dd}`;
                      }
                      return date;
                    })() : ''}
                    onChange={(e) => {
                      const [yyyy, mm, dd] = e.target.value.split('-');
                      setEditForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                    }}
                  />
                ) : field === 'FECHA BAJA' ? (
                  <input
                    type="date"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] ? (() => {
                      const date = editForm[field];
                      // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                      if (date.includes('/')) {
                        const [dd, mm, yyyy] = date.split('/');
                        return `${yyyy}-${mm}-${dd}`;
                      } else if (date.includes('-')) {
                        const parts = date.split('-');
                        if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                        const [dd, mm, yyyy] = parts;
                        return `${yyyy}-${mm}-${dd}`;
                      }
                      return date;
                    })() : ''}
                    onChange={(e) => {
                      const [yyyy, mm, dd] = e.target.value.split('-');
                      setEditForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                    }}
                  />
                ) : field === 'Fecha Antigüedad' ? (
                  <input
                    type="date"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] ? (() => {
                      const date = editForm[field];
                      // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                      if (date.includes('/')) {
                        const [dd, mm, yyyy] = date.split('/');
                        return `${yyyy}-${mm}-${dd}`;
                      } else if (date.includes('-')) {
                        const parts = date.split('-');
                        if (parts[0].length === 4) return date; // Deja e YYYY-MM-DD
                        const [dd, mm, yyyy] = parts;
                        return `${yyyy}-${mm}-${dd}`;
                      }
                      return date;
                    })() : ''}
                    onChange={(e) => {
                      const [yyyy, mm, dd] = e.target.value.split('-');
                      setEditForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                    }}
                  />
                ) : field === 'CENTRO TRABAJO' ? (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="Buscar centro de trabajo..."
                    value={editForm[field] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditForm(prev => ({ ...prev, [field]: value }));
                        setShowEditCentroDropdown(true);
                      }}
                      onFocus={() => setShowEditCentroDropdown(true)}
                      onBlur={() => {
                        // Delay to allow clicking on dropdown items
                        setTimeout(() => setShowEditCentroDropdown(false), 200);
                      }}
                    disabled={isOperationLoading('clientes')}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-lg">🔍</span>
                    </div>
                    
                    {/* Dropdown de sugerencias */}
                    {showEditCentroDropdown && editForm[field] && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {clientes
                          .filter(cliente => 
                            cliente['NOMBRE O RAZON SOCIAL']
                              .toLowerCase()
                              .includes(editForm[field].toLowerCase())
                          )
                          .slice(0, 10) // Limitar a 10 resultados
                          .map(cliente => (
                            <button
                              key={cliente.NIF}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                setEditForm(prev => ({ ...prev, [field]: cliente['NOMBRE O RAZON SOCIAL'] }));
                                setShowEditCentroDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{cliente['NOMBRE O RAZON SOCIAL']}</div>
                              <div className="text-sm text-gray-500">NIF: {cliente.NIF}</div>
                            </button>
                          ))}
                        {clientes.filter(cliente => 
                          cliente['NOMBRE O RAZON SOCIAL']
                            .toLowerCase()
                            .includes(editForm[field].toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No se encontraron centros
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : field === 'Antigüedad' ? (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-gray-800 bg-green-50 focus:outline-none cursor-not-allowed font-semibold"
                      value={calcularAntiguedad(editForm['Fecha Antigüedad'], editForm['FECHA BAJA'])}
                      readOnly
                      placeholder="Se calcula automáticamente"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-green-600 text-lg">🎯</span>
                    </div>
                  </div>
                ) : field === 'EMPRESA' ? (
                  <input
                    type="text"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-not-allowed"
                    value={editForm[field] || 'DE CAMINO SERVICIOS AUXILIARES SL'}
                    readOnly={true}
                    placeholder="empresa (solo lectura)"
                  />
                ) : field === 'GRUPO' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                    disabled={isOperationLoading('grupos')}
                  >
                    <option value="">Selecciona un grupo...</option>
                    {isOperationLoading('grupos') ? (
                      <option value="" disabled>Cargando grupos...</option>
                    ) : (
                      gruposList.map((grupo) => (
                        <option key={grupo} value={grupo}>{grupo}</option>
                      ))
                    )}
                  </select>
                ) : field === 'NACIONALIDAD' ? (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="Buscar nacionalidad..."
                      value={editForm[field] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditForm(prev => ({ ...prev, [field]: value }));
                        setShowEditNacionalidadDropdown(true);
                      }}
                      onFocus={() => setShowEditNacionalidadDropdown(true)}
                      onBlur={() => {
                        // Delay to allow clicking on dropdown items
                        setTimeout(() => setShowEditNacionalidadDropdown(false), 200);
                      }}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-lg">🔍</span>
                    </div>
                    
                    {/* Dropdown de sugerencias */}
                    {showEditNacionalidadDropdown && editForm[field] && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {paises
                          .filter(pais => 
                            pais.toLowerCase().includes(editForm[field].toLowerCase())
                          )
                          .slice(0, 15) // Limitar a 15 resultados
                          .map((pais, index) => (
                            <button
                              key={`${pais}-${index}`}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                setEditForm(prev => ({ ...prev, [field]: pais }));
                                setShowEditNacionalidadDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{pais}</div>
                            </button>
                          ))}
                        {paises.filter(pais => 
                          pais.toLowerCase().includes(editForm[field].toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No se encontraron países
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : field === 'ESTADO' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'ACTIVO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="ACTIVO">🟢 ACTIVO</option>
                    <option value="INACTIVO">🔴 INACTIVO</option>
                  </select>
                ) : field === 'DerechoPedidos' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'NO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="NO">❌ NO</option>
                    <option value="SI">✅ SI</option>
                  </select>
                ) : field === 'TrabajaFestivos' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'NO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="NO">🚫 NO</option>
                    <option value="SI">🎉 SÍ</option>
                  </select>
                ) : field === 'Contraseña' ? (
                  <input
                    type="text"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder="Introduce la contraseña"
                  />
                ) : field === 'CuantoPuedeGastar' ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="0.00"
                    />
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span>💰</span>
                      <span>Límite de gasto en EUR</span>
                    </div>
                  </div>
                ) : field === 'TIPO DE CONTRATO' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                    disabled={isOperationLoading('contractTypes')}
                  >
                    <option value="">Seleccionar tipo de contrato...</option>
                    {isOperationLoading('contractTypes') ? (
                      <option value="" disabled>Cargando tipos...</option>
                    ) : (
                      contractTypes.map((contractType) => (
                        <option key={contractType.id} value={contractType.tipo}>
                          {contractType.tipo}
                        </option>
                      ))
                    )}
                  </select>
                ) : field === 'HORAS DE CONTRATO' ? (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="">Seleccionar horas...</option>
                    {Array.from({ length: 40 }, (_, i) => i + 1).map(hours => (
                      <option key={hours} value={hours}>
                        {hours} {hours === 1 ? 'hora' : 'horas'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  />
                )}
                </div>
                  );
                })}
              </div>
            </div>
            
            {/* Checkbox pentru "Enviar a Gestoria" */}
            <div className="px-6 pb-4 flex items-center justify-center border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarAGestoriaEdit}
                  onChange={(e) => setEnviarAGestoriaEdit(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  📧 Enviar a Gestoria
                </span>
              </label>
            </div>
            
            {/* Footer cu butoane ULTRA MODERN */}
            <div className="flex gap-4 justify-end p-6 border-t border-gray-200 bg-gray-50">
              {/* Buton Cancelar */}
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEnviarAGestoriaEdit(false); // Reset checkbox la închidere
                  setOriginalEmployeeData(null); // Reset datele originale
                }}
                className="group relative px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900"
              >
                <div className="relative flex items-center gap-2">
                  <span className="text-lg group-hover:scale-110 transition-transform duration-300">❌</span>
                  <span>Cancelar</span>
                </div>
              </button>
              
              {/* Buton Guardar */}
              <button
                onClick={handleEditUser}
                disabled={addLoading}
                className={`group relative px-8 py-3 rounded-2xl font-bold transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-2xl hover:shadow-green-300/50 ${
                  addLoading ? 'opacity-50 cursor-not-allowed transform-none' : ''
                }`}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                  boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                {/* 3D depth effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-green-300 to-green-800 opacity-20 transform translate-y-1 group-active:translate-y-0 transition-transform duration-150"></div>
                
                {/* Main content */}
                <div className="relative flex items-center justify-center gap-2">
                  {addLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-black" style={{
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        background: 'linear-gradient(45deg, #ffffff, #d1fae5, #ffffff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl group-hover:scale-125 transition-all duration-500">💾</span>
                      <span className="font-black" style={{
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        background: 'linear-gradient(45deg, #ffffff, #d1fae5, #ffffff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>Guardar</span>
                    </>
                  )}
                </div>
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para enviar email - Diseño moderno */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title=""
        size="xl"
      >
        <div className="max-w-2xl mx-auto">
          {/* Header moderno */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">📧</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enviar Email</h2>
            <p className="text-gray-600">Comunicación profesional con el equipo</p>
          </div>

          {/* Información empleado seleccionado - Diseño moderno */}
          {selectedUserForEmail && emailForm.destinatar === 'angajat' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">
                    {selectedUserForEmail['NOMBRE / APELLIDOS']?.charAt(0) || 'A'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedUserForEmail['NOMBRE / APELLIDOS']}
                  </h3>
                  <p className="text-blue-600 font-medium">
                    Código: {selectedUserForEmail.CODIGO}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selector destinatario moderno */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Destinatario
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEmailForm(prev => ({ ...prev, destinatar: 'angajat' }));
                }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  emailForm.destinatar === 'angajat'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-lg'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">👤</div>
                  <div className="font-medium">Empleado</div>
                  <div className="text-xs text-gray-500 mt-1">Individual</div>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEmailForm(prev => ({ ...prev, destinatar: 'toti' }));
                }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  emailForm.destinatar === 'toti'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-lg'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-medium">Todos</div>
                  <div className="text-xs text-gray-500 mt-1">Completo</div>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Cambio destinatario a grupo');
                  setEmailForm(prev => ({ ...prev, destinatar: 'grup', grup: prev.grup || (gruposList.length > 0 ? gruposList[0] : 'Empleado') }));
                }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  emailForm.destinatar === 'grup'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-lg'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🏢</div>
                  <div className="font-medium">Grupo</div>
                  <div className="text-xs text-gray-500 mt-1">Selectivo</div>
                </div>
              </button>
            </div>
          </div>

          {/* Selector grupo moderno */}
          {emailForm.destinatar === 'grup' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Selecciona el grupo
              </label>
              <div className="relative">
                <select
                  value={emailForm.grup || (gruposList.length > 0 ? gruposList[0] : 'Empleado')}
                  onChange={(e) => {
                    console.log('Grupo seleccionado:', e.target.value);
                    setEmailForm(prev => ({ ...prev, grup: e.target.value }));
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-white"
                >
                  {gruposList.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Formulario moderno */}
          <div className="space-y-6">
            {/* Asunto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Asunto del correo
              </label>
              <div className="relative">
                <Input
                  value={emailForm.subiect}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subiect: e.target.value }))}
                  placeholder="Ej: Solicitud de documentos, Aviso importante..."
                  className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-gray-400">📝</span>
                </div>
              </div>
            </div>

            {/* Mensaje */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Contenido del mensaje
              </label>
              <div className="relative">
                <textarea
                  value={emailForm.mensaje}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, mensaje: e.target.value }))}
                  placeholder="Escribe el mensaje que quieres enviar por correo..."
                  className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all duration-200"
                  rows={6}
                />
                <div className="absolute top-4 right-4">
                  <span className="text-gray-400">💬</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensajes de feedback moderno */}
          {emailError && (
            <div className="mt-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 text-lg">⚠️</span>
                </div>
                <div>
                  <p className="text-red-800 font-medium">Error al enviar</p>
                  <p className="text-red-600 text-sm">{emailError}</p>
                </div>
              </div>
            </div>
          )}
          
          {emailSuccess && (
            <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-green-600 text-lg">✅</span>
                </div>
                <div>
                  <p className="text-green-800 font-medium">¡Correo enviado con éxito!</p>
                  <p className="text-green-600 text-sm">El mensaje ha sido enviado correctamente</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Botones modernos */}
        <div className="flex gap-4 justify-center mt-8">
          <Button
            onClick={() => setShowEmailModal(false)}
            variant="outline"
            size="lg"
            className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400"
          >
            <span className="mr-2">✖️</span>
            Cancelar
          </Button>
          <Button
            onClick={handleSendEmail}
            variant="primary"
            size="lg"
            loading={emailLoading}
            disabled={emailLoading}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg"
          >
            {emailLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Enviando...
              </>
            ) : (
              <>
                <span className="mr-2">📧</span>
                Enviar Email
              </>
            )}
          </Button>
        </div>
      </Modal>

      {/* Modal pentru generare PDF */}
      <EmployeePDFGenerator
        employeeData={pdfEmployeeData}
        createdBy={authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre}
        enviarAGestoria={enviarAGestoria}
        onSuccess={handlePDFSuccess}
        onError={handlePDFError}
        showModal={showPDFModal}
        setShowModal={setShowPDFModal}
      />
    </div>
  );
} 