import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button, Input, Card, Modal } from '../components/ui';
import Notification from '../components/ui/Notification';
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
import { useWebSocket } from '../hooks/useWebSocket';

import activityLogger from '../utils/activityLogger';
import { getFormattedNombre, getEmployeeInitials } from '../utils/employeeNameHelper';
import CorregirNombresTab from '../components/employees/CorregirNombresTab';
import AddressAutocomplete from '../components/AddressAutocomplete';

// Funcție helper pentru transformare automată în majuscule
const toUpperCaseIfNeeded = (field, value) => {
  // Câmpuri care NU trebuie transformate în majuscule
  const excludeFields = [
    'DIRECCION',
    'CORREO ELECTRONICO',
    'NACIONALIDAD',
    'FECHA NACIMIENTO',
    'FECHA DE ALTA',
    'FECHA BAJA',
    'Fecha Antigüedad',
    'Antigüedad'
  ];
  
  if (excludeFields.includes(field)) {
    return value;
  }
  
  // Pentru DNI/NIE și IBAN, transformăm doar literele în majuscule
  if (field === 'D.N.I. / NIE' || field === 'Nº Cuenta') {
    return value.toUpperCase();
  }
  
  // Pentru restul câmpurilor text, transformăm totul în majuscule
  return value.toUpperCase();
};

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
  const { user: authUser, authToken, logout } = useAuth();
  const { callApi } = useApi();
  
  // State pentru estadísticas
  const [estadisticas, setEstadisticas] = useState([]);
  const [loadingEstadisticas, setLoadingEstadisticas] = useState(false);
  const [errorEstadisticas, setErrorEstadisticas] = useState(null);
  
  // State pentru sortare
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' sau 'desc'
  
  // State pentru editare inline
  const [editingCell, setEditingCell] = useState(null); // { codigo, field }
  const [editingValue, setEditingValue] = useState('');
  const [savingCell, setSavingCell] = useState(null);
  
  // State pentru liste de centre și grupuri
  const [centrosList, setCentrosList] = useState([]);
  const [gruposListForEdit, setGruposListForEdit] = useState([]);
  
  // State pentru combobox-uri (căutare/filtrare)
  const [centroSearchTerm, setCentroSearchTerm] = useState('');
  const [grupoSearchTerm, setGrupoSearchTerm] = useState('');
  const [showCentroDropdown, setShowCentroDropdown] = useState(false);
  const [showGrupoDropdown, setShowGrupoDropdown] = useState(false);

  // State pentru lista de clienți (mutat aici pentru a fi disponibil pentru fetchEstadisticas)
  const [clientes, setClientes] = useState([]);
  
  // Ref pentru a stoca valoarea curentă a clientes (pentru a preveni loop-ul în fetchEstadisticas)
  const clientesRef = useRef(clientes);
  
  // Actualizăm ref-ul când se schimbă clientes
  useEffect(() => {
    clientesRef.current = clientes;
  }, [clientes]);

  // Funcție pentru a obține estadísticas
  const fetchEstadisticas = useCallback(async () => {
    setLoadingEstadisticas(true);
    setErrorEstadisticas(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getEstadisticasEmpleados, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estadísticas');
      }
      
      const data = await response.json();
      const estadisticasData = data.estadisticas || [];
      setEstadisticas(estadisticasData);
      
      // Extrage centrele unice din statistici
      const centrosFromEstadisticas = [...new Set(estadisticasData
        .map(emp => emp.centro)
        .filter(centro => centro && centro.trim() !== '' && centro !== '-')
      )];
      
      // Combină cu centrele din clienți (folosim valoarea curentă din ref)
      const centrosFromClientes = (clientesRef.current || [])
        .map(cliente => cliente['NOMBRE O RAZON SOCIAL'] || cliente['NOMBRE O RAZÓN SOCIAL'] || cliente.nombre)
        .filter(nombre => nombre && nombre.trim() !== '');
      
      // Combină ambele liste și elimină duplicatele
      const todosLosCentros = [...new Set([...centrosFromEstadisticas, ...centrosFromClientes])]
        .filter(centro => centro && centro.trim() !== '')
        .sort();
      
      setCentrosList(todosLosCentros);
      console.log('✅ Centros cargados:', todosLosCentros.length, 'centros', todosLosCentros);
    } catch (error) {
      console.error('Error fetching estadísticas:', error);
      setErrorEstadisticas(error.message);
    } finally {
      setLoadingEstadisticas(false);
    }
  }, []); // Eliminăm clientes din dependențe pentru a preveni loop-ul

  const handleExportEstadisticasExcel = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportEstadisticasEmpleadosExcel;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Estadisticas_Empleados_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      setNotification({
        type: 'error',
        title: 'Error al Exportar',
        message: 'Error al exportar Excel: ' + err.message,
        show: true
      });
    }
  };

  const handleExportEstadisticasPDF = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportEstadisticasEmpleadosPDF;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Estadisticas_Empleados_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      setNotification({
        type: 'error',
        title: 'Error al Exportar',
        message: 'Error al exportar PDF: ' + err.message,
        show: true
      });
    }
  };

  // Funcție pentru a încărca lista de grupuri (pentru editare inline)
  const fetchGruposForEdit = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getGrupos, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener grupos');
      }
      
      const grupos = await response.json();
      setGruposListForEdit(Array.isArray(grupos) ? grupos : []);
    } catch (error) {
      console.error('Error fetching grupos for edit:', error);
      // Nu aruncăm eroare, doar logăm
    }
  };

  // Funcții pentru editare inline
  const startEditing = (codigo, field, currentValue) => {
    setEditingCell({ codigo, field });
    setEditingValue(currentValue || '');
    // Resetează termenii de căutare când începe editarea
    if (field === 'centro') {
      setCentroSearchTerm(currentValue || '');
      setShowCentroDropdown(true);
    } else if (field === 'grupo') {
      setGrupoSearchTerm(currentValue || '');
      setShowGrupoDropdown(true);
    }
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
    setCentroSearchTerm('');
    setGrupoSearchTerm('');
    setShowCentroDropdown(false);
    setShowGrupoDropdown(false);
  };
  
  // Funcții pentru filtrare combobox
  const filteredCentros = centrosList.filter(centro =>
    centro.toLowerCase().includes((centroSearchTerm || '').toLowerCase())
  );
  
  const filteredGrupos = gruposListForEdit.filter(grupo =>
    grupo.toLowerCase().includes((grupoSearchTerm || '').toLowerCase())
  );

  const saveCell = async (codigo, field, newValue) => {
    if (savingCell) return; // Previne dubluri
    
    setSavingCell({ codigo, field });
    try {
      const token = localStorage.getItem('auth_token');
      
      // Construiește body-ul pentru actualizare
      const body = { CODIGO: codigo };
      
      // Mapează field-urile la numele din backend
      if (field === 'estado') {
        body.ESTADO = newValue;
      } else if (field === 'fecha_alta') {
        body['FECHA DE ALTA'] = newValue;
      } else if (field === 'centro') {
        body['CENTRO TRABAJO'] = newValue;
      } else if (field === 'grupo') {
        body.GRUPO = newValue;
      }

      const response = await fetch(routes.updateUser, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || 'Error al actualizar');
      }

      // Actualizează local state-ul
      setEstadisticas(prev => prev.map(emp => {
        if (emp.CODIGO === codigo) {
          const updated = { ...emp };
          if (field === 'estado') {
            updated.estado = newValue;
          } else if (field === 'fecha_alta') {
            updated.fecha_alta = newValue;
          } else if (field === 'centro') {
            updated.centro = newValue;
          } else if (field === 'grupo') {
            updated.grupo = newValue;
          }
          return updated;
        }
        return emp;
      }));

      setEditingCell(null);
      setEditingValue('');
    } catch (error) {
      console.error('Error saving cell:', error);
      setNotification({
        type: 'error',
        title: 'Error al Guardar',
        message: `Error al guardar: ${error.message}`,
        show: true
      });
    } finally {
      setSavingCell(null);
    }
  };

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
    // Secuencia poate fi 00-99 (inclusiv 00 pentru unele cazuri speciale)
    if (isNaN(secuencia) || secuencia < 0 || secuencia > 99) {
      return false;
    }
    
    // Para la fecha, solo verificamos que sea un número de 4 dígitos
    // No validamos el año porque puede ser año de nacimiento o alta
    // IMPORTANTE: parseInt("0360") = 360, deci verificăm string-ul direct
    const fechaStr = numeroLimpio.substring(4, 8);
    if (!/^\d{4}$/.test(fechaStr)) {
      return false;
    }
    const fecha = parseInt(fechaStr);
    // Permitem și valori < 1000 (ex: 0360, 0123) pentru că parseInt le convertește corect
    if (isNaN(fecha) || fecha < 0 || fecha > 9999) {
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

  /**
   * Formatează IBAN-ul adăugând spații la fiecare 4 caractere
   * Exemplu: ES4014650100941740476856 -> ES40 1465 0100 9417 4047 6856
   */
  const formatearIBAN = (iban) => {
    if (!iban) return '';
    // Elimină toate spațiile existente
    const ibanLimpio = iban.replace(/\s/g, '').toUpperCase();
    // Adaugă spații la fiecare 4 caractere
    return ibanLimpio.replace(/(.{4})/g, '$1 ').trim();
  };

  const validarIBAN = (iban) => {
    if (!iban || iban.trim() === '') return null;
    
    // Elimină spațiile pentru validare
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

    // Include nuevos campos separados si existen
    if (raw.NOMBRE !== undefined) mapped.NOMBRE = raw.NOMBRE || '';
    if (raw.APELLIDO1 !== undefined) mapped.APELLIDO1 = raw.APELLIDO1 || '';
    if (raw.APELLIDO2 !== undefined) mapped.APELLIDO2 = raw.APELLIDO2 || '';
    if (raw.NOMBRE_SPLIT_CONFIANZA !== undefined) mapped.NOMBRE_SPLIT_CONFIANZA = raw.NOMBRE_SPLIT_CONFIANZA ?? 2;
    if (raw.NOMBRE_APELLIDOS_BACKUP !== undefined) mapped.NOMBRE_APELLIDOS_BACKUP = raw.NOMBRE_APELLIDOS_BACKUP || '';

    return mapped;
  };

  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'adauga' | 'inspecciones' | 'corregir-nombres' | 'estadisticas'
  const [users, setUsers] = useState([]);
  const [errorUsers, setErrorUsers] = useState(null);
  
  // Loading states centralizate
  const { setOperationLoading, isOperationLoading } = useLoadingState();
  const [editForm, setEditForm] = useState({});
  const [originalEmployeeData, setOriginalEmployeeData] = useState(null); // Datele originale pentru comparație
  const [showEditModal, setShowEditModal] = useState(false);
  const [mostrarContraseña, setMostrarContraseña] = useState(false); // State pentru afișarea parolei
  const [loadingPassword, setLoadingPassword] = useState(false); // State pentru loading la obținerea parolei

  // Formulario para añadir empleado
  const [addForm, setAddForm] = useState(() => ({
    ...Object.fromEntries(SHEET_FIELDS.map(f => [f, ''])),
    CODIGO: generateCodigo(),
    EMPRESA: 'DE CAMINO SERVICIOS AUXILIARES SL',
    ESTADO: 'PENDIENTE', // Default pentru angajați noi
    DerechoPedidos: 'NO',
    TrabajaFestivos: 'NO'
  }));
  
  // Sincronizare automată: când se completează câmpurile separate, se actualizează automat "NOMBRE / APELLIDOS"
  useEffect(() => {
    const nombre = (addForm.NOMBRE || '').trim();
    const apellido1 = (addForm.APELLIDO1 || '').trim();
    const apellido2 = (addForm.APELLIDO2 || '').trim();
    
    // Dacă există cel puțin unul din câmpurile separate completat, construim numele complet
    if (nombre || apellido1 || apellido2) {
      const parts = [nombre, apellido1, apellido2].filter(part => part && part !== '');
      const nombreCompleto = parts.length > 0 ? parts.join(' ') : '';
      
      // Actualizăm doar dacă numele complet generat este diferit de cel existent
      // sau dacă câmpul "NOMBRE / APELLIDOS" este gol
      if (nombreCompleto && (nombreCompleto !== (addForm['NOMBRE / APELLIDOS'] || '').trim())) {
        setAddForm(prev => ({
          ...prev,
          'NOMBRE / APELLIDOS': nombreCompleto
        }));
      }
    }
  }, [addForm]);

  // Sincronizare automată pentru editForm: când se completează câmpurile separate, se actualizează automat "NOMBRE / APELLIDOS"
  useEffect(() => {
    if (!editForm || Object.keys(editForm).length === 0) return;
    
    const nombre = (editForm.NOMBRE || '').trim();
    const apellido1 = (editForm.APELLIDO1 || '').trim();
    const apellido2 = (editForm.APELLIDO2 || '').trim();
    
    // Dacă există cel puțin unul din câmpurile separate completat, construim numele complet
    if (nombre || apellido1 || apellido2) {
      const parts = [nombre, apellido1, apellido2].filter(part => part && part !== '');
      const nombreCompleto = parts.length > 0 ? parts.join(' ') : '';
      
      // Actualizăm doar dacă numele complet generat este diferit de cel existent
      // sau dacă câmpul "NOMBRE / APELLIDOS" este gol
      if (nombreCompleto && (nombreCompleto !== (editForm['NOMBRE / APELLIDOS'] || '').trim())) {
        setEditForm(prev => ({
          ...prev,
          'NOMBRE / APELLIDOS': nombreCompleto
        }));
      }
    }
  }, [editForm]);

  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [notification, setNotification] = useState(null); // State pentru notificări moderne
  const [enviarAGestoria, setEnviarAGestoria] = useState(false);
  const [enviarAGestoriaEdit, setEnviarAGestoriaEdit] = useState(false); // Pentru modalul de editare
  const [retrimiteFichaEdit, setRetrimiteFichaEdit] = useState(false); // Checkbox pentru retrimitere ficha în editare
  const [mensajeAdicionalGestoria, setMensajeAdicionalGestoria] = useState(''); // Mesaj adițional pentru gestorie (addForm)
  const [archivosGestoria, setArchivosGestoria] = useState([]); // Fișiere multiple pentru gestorie (addForm)
  const [mensajeAdicionalGestoriaEdit, setMensajeAdicionalGestoriaEdit] = useState(''); // Mesaj adițional pentru gestorie (editForm)
  const [archivosGestoriaEdit, setArchivosGestoriaEdit] = useState([]); // Fișiere multiple pentru gestorie (editForm)

  // Estado para dropdowns de centro de trabajo (pentru formularul de adăugare/editare)
  const [showCentroDropdownAdd, setShowCentroDropdownAdd] = useState(false);
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
  // State pentru modalul de solicitare documente
  const [showSolicitarDocumentoModal, setShowSolicitarDocumentoModal] = useState(false);
  const [selectedUserForDocumento, setSelectedUserForDocumento] = useState(null);
  const [documentoSolicitudForm, setDocumentoSolicitudForm] = useState({
    tipo_documento: '',
    tipo_personalizado: '',
    notas: ''
  });
  const [documentoSolicitudLoading, setDocumentoSolicitudLoading] = useState(false);
  const [documentoSolicitudError, setDocumentoSolicitudError] = useState(null);
  
  // State pentru solicitare în masă (toti angajații)
  const [showSolicitarDocumentoTodosModal, setShowSolicitarDocumentoTodosModal] = useState(false);
  const [documentoTodosForm, setDocumentoTodosForm] = useState({
    tipo_documento: '',
    tipo_personalizado: '',
    notas: '',
    solo_activos: true, // Doar angajații activi
    aplicar_a_nuevos: false // Aplică la viitorii angajați activi
  });
  const [documentoTodosLoading, setDocumentoTodosLoading] = useState(false);
  const [documentoTodosProgress, setDocumentoTodosProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [documentoTodosError, setDocumentoTodosError] = useState(null);
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
  const [emailProgress, setEmailProgress] = useState(null); // { total, current, success, failed, status }
  
  // WebSocket pentru progres email
  const { socket } = useWebSocket('/notifications');

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
    // Filtru special: "sin_fecha_alta" - arată doar angajații fără Fecha Alta
    if (searchBy === 'sin_fecha_alta') {
      return users.filter((user) => {
        const fechaAlta = user['FECHA DE ALTA'] || user['FECHA_DE_ALTA'] || user.fechaAlta || '';
        return !fechaAlta || fechaAlta.toString().trim() === '';
      });
    }

    // În primul rând aplicăm filtrul de căutare
    const base = !searchTerm.trim()
      ? users
      : users.filter((user) => {
          const term = searchTerm.toLowerCase().trim();
          const nombre = getFormattedNombre(user)?.toLowerCase() || '';
          const codigo = user.CODIGO?.toLowerCase() || '';
          const email = user['CORREO ELECTRONICO']?.toLowerCase() || '';
          const grupo = (user['GRUPO'] || '').toString().toLowerCase();
          const estado = (user['ESTADO'] || '').toString().toLowerCase();
          const centro =
            (user['CENTRO TRABAJO'] || user.CENTRO_TRABAJO || '')
              .toString()
              .toLowerCase();
          const fechaAlta = (user['FECHA DE ALTA'] || user['FECHA_DE_ALTA'] || user.fechaAlta || '').toString().toLowerCase();

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
            case 'fecha_alta':
              // Caută în data de alta
              return fechaAlta.includes(term);
            case 'todos':
            default:
              return (
                nombre.includes(term) ||
                codigo.includes(term) ||
                email.includes(term) ||
                grupo.includes(term) ||
                estado.includes(term) ||
                centro.includes(term) ||
                fechaAlta.includes(term)
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

  // Separate useEffect pentru estadísticas - doar când se schimbă tab-ul
  useEffect(() => {
    if (authUser?.isDemo) {
      return;
    }
    
    if (activeTab === 'estadisticas') {
      fetchEstadisticas();
      fetchGruposForEdit(); // Încarcă lista de grupuri pentru editare
    }
  }, [activeTab, authUser, fetchEstadisticas]);

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
          loadEmployeeAvatar(user.CODIGO, getFormattedNombre(user));
        }
      });
    }
  }, [users, employeeAvatars, activeTab, getFilteredUsers, loadEmployeeAvatar, bulkAvatarsLoaded]);

  const handleAddUser = async () => {
    setAddError(null);
    setAddSuccess(false);
    
    try {
      // Normalizează IBAN-ul (elimină spațiile) înainte de salvare
      const normalizedAddForm = { ...addForm };
      if (normalizedAddForm['Nº Cuenta']) {
        normalizedAddForm['Nº Cuenta'] = normalizedAddForm['Nº Cuenta'].replace(/\s/g, '').toUpperCase();
      }
      
      // Deschide direct modalul pentru generare PDF - fără validare
      setPdfEmployeeData(normalizedAddForm);
      setShowPDFModal(true);
    } catch (error) {
      console.error('❌ Error in handleAddUser:', error);
      setAddError('Error al procesar la solicitud');
    }
  };

  // Funcția pentru succesul PDF
  const handlePDFSuccess = async () => {
    // Verifică dacă este pentru retrimitere ficha din editare
    if (retrimiteFichaEdit && pdfEmployeeData) {
      // Log retrimiterea fichei
      await activityLogger.logAction('ficha_retrimisa_gestoria', {
        empleado: getFormattedNombre(pdfEmployeeData) || pdfEmployeeData.CODIGO,
        codigo: pdfEmployeeData.CODIGO,
        user: getFormattedNombre(authUser) || authUser?.nombre,
        email: authUser?.email,
      });
      
      setAddSuccess(true);
      setShowPDFModal(false);
      setPdfEmployeeData(null);
      setEnviarAGestoria(false);
      setMensajeAdicionalGestoria('');
      setArchivosGestoria([]);
      setShowEditModal(false);
      setRetrimiteFichaEdit(false);
      
      // Reîncarcă lista după retrimitere ficha
      setTimeout(() => fetchUsers(), 500);
    } else {
      // Log crearea utilizatorului (pentru adăugare nouă)
      await activityLogger.logAction('user_created_with_pdf', {
        user: getFormattedNombre({ ...addForm, CODIGO: addForm.CODIGO }) || addForm['NOMBRE / APELLIDOS'],
        email: addForm['CORREO ELECTRONICO'],
        codigo: addForm.CODIGO,
        created_by: getFormattedNombre(authUser) || authUser?.nombre,
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
    }
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
      console.log('🔍 [handleEditUser] EDITANDO empleado:', editForm);
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

      // Construiește body-ul pentru EDITARE (PUT request), incluzând parametrii pentru email
      const updateBody = { ...editForm };
      
      // Normalizează IBAN-ul (elimină spațiile) înainte de salvare
      if (updateBody['Nº Cuenta']) {
        updateBody['Nº Cuenta'] = updateBody['Nº Cuenta'].replace(/\s/g, '').toUpperCase();
      }
      
      // Asigură-te că câmpurile separate sunt incluse chiar dacă sunt goale
      if (editForm.NOMBRE !== undefined) updateBody.NOMBRE = editForm.NOMBRE;
      if (editForm.APELLIDO1 !== undefined) updateBody.APELLIDO1 = editForm.APELLIDO1;
      if (editForm.APELLIDO2 !== undefined) updateBody.APELLIDO2 = editForm.APELLIDO2;
      if (editForm.NOMBRE_SPLIT_CONFIANZA !== undefined) updateBody.NOMBRE_SPLIT_CONFIANZA = editForm.NOMBRE_SPLIT_CONFIANZA;
      
      console.log('🔍 [handleEditUser] updateBody cu câmpuri separate:', {
        NOMBRE: updateBody.NOMBRE,
        APELLIDO1: updateBody.APELLIDO1,
        APELLIDO2: updateBody.APELLIDO2,
        NOMBRE_SPLIT_CONFIANZA: updateBody.NOMBRE_SPLIT_CONFIANZA,
        'NOMBRE / APELLIDOS': updateBody['NOMBRE / APELLIDOS']
      });
      
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
                           `Empleado: ${getFormattedNombre({ ...editForm, CODIGO: editForm.CODIGO }) || editForm['NOMBRE / APELLIDOS'] || 'N/A'}\n` +
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
        
        mensajeEmail += `Actualizado por: ${getFormattedNombre(authUser) || authUser?.nombre || 'Sistema'}\n` +
                       `Fecha: ${new Date().toLocaleString('es-ES')}`;
        
        // Adaugă mesajul adițional dacă există
        if (mensajeAdicionalGestoriaEdit && mensajeAdicionalGestoriaEdit.trim()) {
          mensajeEmail += `\n\n--- Mensaje Adicional ---\n${mensajeAdicionalGestoriaEdit}`;
        }

        updateBody.emailBody = mensajeEmail;
        updateBody.mensajeAdicionalGestoria = mensajeAdicionalGestoriaEdit || '';
        updateBody.emailSubject = `Actualización de datos - ${getFormattedNombre({ ...editForm, CODIGO: editForm.CODIGO }) || editForm['NOMBRE / APELLIDOS'] || editForm.CODIGO || 'Empleado'}`;
        updateBody.updatedBy = getFormattedNombre(authUser) || authUser?.nombre || 'Sistema';
      }

      // EDITARE angajat (PUT request) - nu salvare (POST)
      // Dacă există fișiere, folosim FormData, altfel JSON
      let requestBody;
      let requestHeaders = { ...fetchHeaders };
      
      if (enviarAGestoriaEdit && archivosGestoriaEdit.length > 0) {
        // Folosim FormData pentru a trimite fișierele
        const formData = new FormData();
        
        // Adaugă toate câmpurile din updateBody
        Object.keys(updateBody).forEach(key => {
          if (updateBody[key] !== undefined && updateBody[key] !== null) {
            formData.append(key, String(updateBody[key]));
          }
        });
        
        // Adaugă fișierele
        archivosGestoriaEdit.forEach((file) => {
          formData.append('archivosGestoria', file);
        });
        
        requestBody = formData;
        // Nu setăm Content-Type pentru FormData, browser-ul o setează automat cu boundary
        delete requestHeaders['Content-Type'];
      } else {
        // Folosim JSON normal
        requestBody = JSON.stringify(updateBody);
      }
      
      const response = await fetch(API_ENDPOINTS.UPDATE_USER, {
        method: 'PUT', // PUT = EDITARE, nu POST = salvare
        headers: requestHeaders,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [handleEditUser] Error al EDITAR empleado:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Accept { success: true } from backend
      const normalizedSuccess = result?.success === true;

      if (normalizedSuccess) {
        console.log('✅ [handleEditUser] Empleado EDITADO correctamente');
        
        // Log EDITAREA utilizatorului (nu salvare)
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
        // Fișierele sunt trimise automat în același request dacă există
        
        // Dacă checkbox-ul "Retrimite Ficha" este bifat, DUPĂ EDITARE se trimite ficha la gestorie
        if (retrimiteFichaEdit && editForm.CODIGO) {
          console.log('📄 [handleEditUser] Retrimite ficha a gestoria (después de editar)');
          try {
            // Generează mesajul automat bazat pe modificări
            let mensajeRetrimite = '';
            if (originalEmployeeData) {
              const fechaAltaAnterior = originalEmployeeData['FECHA DE ALTA'] || originalEmployeeData.FECHA_DE_ALTA || '';
              const fechaAltaNueva = editForm['FECHA DE ALTA'] || editForm.FECHA_DE_ALTA || '';
              
              if (fechaAltaAnterior !== fechaAltaNueva) {
                mensajeRetrimite = `Vamos a volver a dar de alta a este empleado.\n\n`;
                mensajeRetrimite += `Fecha de alta anterior: ${fechaAltaAnterior}\n`;
                mensajeRetrimite += `Fecha de alta nueva: ${fechaAltaNueva}\n\n`;
              }
              
              // Verifică și alte modificări importante
              const camposImportantes = ['D.N.I. / NIE', 'SEG. SOCIAL', 'Nº Cuenta', 'NACIONALIDAD'];
              const cambiosImportantes = [];
              camposImportantes.forEach(campo => {
                const valorAnterior = originalEmployeeData[campo] || '';
                const valorNuevo = editForm[campo] || '';
                if (String(valorAnterior).trim() !== String(valorNuevo).trim()) {
                  cambiosImportantes.push(`${campo}: ${valorAnterior} → ${valorNuevo}`);
                }
              });
              
              if (cambiosImportantes.length > 0) {
                mensajeRetrimite += `Otros cambios importantes:\n${cambiosImportantes.join('\n')}\n\n`;
              }
              
              if (!mensajeRetrimite) {
                mensajeRetrimite = `Se ha actualizado la información del empleado ${editForm['NOMBRE / APELLIDOS'] || editForm.CODIGO}.\n\nPor favor, revisa la ficha adjunta con los datos actualizados.`;
              }
              
              mensajeRetrimite += `\nActualizado por: ${authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre || 'Sistema'}\nFecha: ${new Date().toLocaleString('es-ES')}`;
            } else {
              mensajeRetrimite = `Se ha actualizado la información del empleado ${editForm['NOMBRE / APELLIDOS'] || editForm.CODIGO}.\n\nPor favor, revisa la ficha adjunta con los datos actualizados.`;
            }
            
            // Folosește EmployeePDFGenerator pentru a genera și trimite ficha
            // Normalizează IBAN-ul (elimină spațiile) înainte de salvare
            const normalizedEditForm = { ...editForm };
            if (normalizedEditForm['Nº Cuenta']) {
              normalizedEditForm['Nº Cuenta'] = normalizedEditForm['Nº Cuenta'].replace(/\s/g, '').toUpperCase();
            }
            setPdfEmployeeData(normalizedEditForm);
            setEnviarAGestoria(true);
            setMensajeAdicionalGestoria(mensajeRetrimite);
            setArchivosGestoria([]);
            setShowPDFModal(true);
            // Nu închidem modalul încă, așteptăm confirmarea trimiterii fichei
            // Reset checkbox-uri și date originale (modalul se va închide după trimiterea fichei)
            setEnviarAGestoriaEdit(false);
            setOriginalEmployeeData(null);
          } catch (error) {
            console.error('Error al retrimite ficha:', error);
            setAddError('Error al retrimite ficha a gestoria. El empleado se ha EDITADO correctamente.');
            setShowEditModal(false);
            setRetrimiteFichaEdit(false);
            setEnviarAGestoriaEdit(false);
            setOriginalEmployeeData(null);
            setTimeout(() => fetchUsers(), 500);
          }
        } else {
          // Dacă nu se retrimite ficha, închidem modalul normal după EDITARE
          setShowEditModal(false);
          setEnviarAGestoriaEdit(false); // Reset checkbox după editare
          setRetrimiteFichaEdit(false); // Reset checkbox retrimite ficha
          setMensajeAdicionalGestoriaEdit(''); // Reset mesaj adițional
          setArchivosGestoriaEdit([]); // Reset fișiere
          setOriginalEmployeeData(null); // Reset datele originale după editare
          // Reîncarcă lista după editare
          setTimeout(() => fetchUsers(), 500);
        }
      } else {
        setAddError('No se pudo EDITAR el empleado.');
      }
    } catch (e) {
      console.error('❌ [handleEditUser] Error al EDITAR empleado:', e);
      setAddError('No se pudo EDITAR el empleado.');
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
        setNotification({
          type: 'warning',
          title: 'Sin Datos',
          message: 'No hay datos para exportar',
          show: true
        });
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
      setNotification({
        type: 'error',
        title: 'Error al Exportar',
        message: 'Error al exportar a Excel. Por favor, inténtalo de nuevo.',
        show: true
      });
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

      // Folosește întotdeauna getFilteredUsers pentru a respecta toate filtrele (searchTerm, searchBy, statusFilter)
      const dataToExport = getFilteredUsers;
      
      if (!dataToExport || dataToExport.length === 0) {
        setNotification({
          type: 'warning',
          title: 'Sin Datos',
          message: 'No hay datos para exportar',
          show: true
        });
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
            // Avatar - imagen o emoji (exclude SVG-uri care nu sunt suportate de pdfMake)
            avatarBase64 && 
            avatarBase64.startsWith('data:image') && 
            !avatarBase64.startsWith('data:image/svg+xml')
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
            getFormattedNombre(emp) || '',
            { text: emp['CORREO ELECTRONICO'] || '', fontSize: 7 },
            emp['D.N.I. / NIE'] || '',
            emp.TELEFONO || '',
            emp.ESTADO || '',
            emp.GRUPO || ''
          ];
        })
      ];

      // Construye el título del reporte (incluye todos los filtros aplicados)
      let reportTitle = 'LISTA DE EMPLEADOS';
      const filters = [];
      
      if (searchTerm) {
        const searchByLabel = searchBy === 'nombre' ? 'Nombre' :
                              searchBy === 'codigo' ? 'Código' :
                              searchBy === 'email' ? 'Email' :
                              searchBy === 'grupo' ? 'Grupo' :
                              searchBy === 'estado' ? 'Estado' :
                              searchBy === 'centro' ? 'Centro' :
                              searchBy === 'fecha_alta' ? 'Fecha Alta' :
                              searchBy === 'sin_fecha_alta' ? 'Sin Fecha Alta' :
                              'Todos';
        filters.push(`${searchByLabel}: "${searchTerm}"`);
      }
      
      if (statusFilter && statusFilter !== 'ALL') {
        filters.push(`Estado: ${statusFilter}`);
      }
      
      if (filters.length > 0) {
        reportTitle = `LISTA DE EMPLEADOS - ${filters.join(' | ')}`;
      }

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
      setNotification({
        type: 'error',
        title: 'Error al Exportar',
        message: 'Error al exportar PDF. Por favor, inténtalo de nuevo.',
        show: true
      });
    }
  };

  const openEditModal = (user) => {
    const mappedUser = mapEmployeeRecord(user);
    setEditForm(mappedUser);
    setOriginalEmployeeData({ ...mappedUser }); // Salvează datele originale pentru comparație
    setEnviarAGestoriaEdit(false); // Reset checkbox la deschiderea modalului
    setRetrimiteFichaEdit(false); // Reset checkbox retrimite ficha
    setMensajeAdicionalGestoriaEdit(''); // Reset mesaj adițional
    setArchivosGestoriaEdit([]); // Reset fișiere
    setShowEditModal(true);
  };

  // Ascultă progresul email-urilor prin WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleEmailProgress = (notification) => {
      // Verifică dacă este un eveniment de progres email
      if (notification.type === 'email_progress') {
        console.log('📧 [Email Progress]', notification);
        setEmailProgress({
          total: notification.total,
          current: notification.current,
          success: notification.success,
          failed: notification.failed,
          status: notification.status, // 'starting', 'sending', 'completed'
        });

        // Dacă s-a finalizat, așteaptă puțin și apoi închide modalul
        if (notification.status === 'completed') {
          setTimeout(() => {
            setEmailSuccess(true);
            setEmailProgress(null);
            setTimeout(() => {
              setShowEmailModal(false);
              setEmailSuccess(false);
              setEmailProgress(null);
            }, 2000);
          }, 1000);
        }
      }
    };

    socket.on('notification', handleEmailProgress);

    return () => {
      socket.off('notification', handleEmailProgress);
    };
  }, [socket]);

  // Funcții pentru email
  const [confirmResetPassword, setConfirmResetPassword] = useState(null); // { user: {...}, show: true }

  const handleResetPassword = async (user) => {
    if (!user?.CODIGO) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'No se encontró el código del empleado',
        show: true
      });
      return;
    }

    // Afișează dialogul de confirmare
    setConfirmResetPassword({ user, show: true });
  };

  const executeResetPassword = async () => {
    if (!confirmResetPassword?.user) return;
    
    const user = confirmResetPassword.user;

    try {
      setLoadingPassword(true);
      const result = await callApi(routes.resetPassword(user.CODIGO), {
        method: 'POST'
      });

      if (result.success) {
        const emailDestinatario = user['CORREO ELECTRONICO'] || user.CODIGO;
        const isCurrentUser = user.CODIGO === authUser?.CODIGO;
        const message = isCurrentUser
          ? `La nueva contraseña ha sido generada y enviada por email a ${emailDestinatario}. Todas tus sesiones han sido cerradas por seguridad. Serás redirigido para iniciar sesión con tu nueva contraseña.`
          : `La nueva contraseña ha sido generada y enviada por email a ${emailDestinatario}. Todas las sesiones del usuario han sido cerradas por seguridad.`;
        
        setNotification({
          type: 'success',
          title: 'Contraseña Reseteada',
          message: message,
          show: true
        });
        
        // Dacă parola resetată este pentru utilizatorul curent, facem logout automat
        // (toate sesiunile sunt deja invalidate în backend)
        if (isCurrentUser && logout) {
          setTimeout(() => {
            logout();
          }, 2000);
        }
      } else {
        setNotification({
          type: 'error',
          title: 'Error',
          message: result.error || 'Error al resetear la contraseña',
          show: true
        });
      }
    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error al resetear la contraseña',
        show: true
      });
    } finally {
      setLoadingPassword(false);
      setConfirmResetPassword(null);
    }
  };

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
    setEmailProgress(null); // Reset progres
    setShowEmailModal(true);
  };

  // Funcții pentru solicitare documente
  const openSolicitarDocumentoModal = (user) => {
    setSelectedUserForDocumento(user);
    setDocumentoSolicitudForm({
      tipo_documento: '',
      tipo_personalizado: '',
      notas: ''
    });
    setDocumentoSolicitudError(null);
    setShowSolicitarDocumentoModal(true);
  };

  const handleSolicitarDocumento = async () => {
    if (!selectedUserForDocumento?.CODIGO) {
      setDocumentoSolicitudError('No se ha identificado el empleado.');
      return;
    }

    if (!documentoSolicitudForm.tipo_documento) {
      setDocumentoSolicitudError('Por favor, selecciona un tipo de documento.');
      return;
    }

    // Verifică dacă e "Otro" și are tip personalizat completat
    if (documentoSolicitudForm.tipo_documento === 'otro') {
      if (!documentoSolicitudForm.tipo_personalizado || !documentoSolicitudForm.tipo_personalizado.trim()) {
        setDocumentoSolicitudError('Por favor, especifica el tipo de documento personalizado.');
        return;
      }
    }

    setDocumentoSolicitudLoading(true);
    setDocumentoSolicitudError(null);

    try {
      // Folosește tipo_personalizado dacă este "otro", altfel folosește tipo_documento
      const tipoDocumentoFinal = documentoSolicitudForm.tipo_documento === 'otro' 
        ? documentoSolicitudForm.tipo_personalizado.trim()
        : documentoSolicitudForm.tipo_documento;

      const result = await callApi(routes.createDocumentoSolicitado, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          empleado_id: selectedUserForDocumento.CODIGO,
          tipo_documento: tipoDocumentoFinal,
          notas: documentoSolicitudForm.notas || undefined,
        }),
      });

      if (result.success || result.id) {
        setNotification({
          type: 'success',
          title: 'Solicitud Creada',
          message: `Se ha creado la solicitud de ${tipoDocumentoFinal} para ${getFormattedNombre(selectedUserForDocumento)}.`,
          show: true
        });
        setShowSolicitarDocumentoModal(false);
        setDocumentoSolicitudForm({ tipo_documento: '', tipo_personalizado: '', notas: '' });
        setSelectedUserForDocumento(null);
      } else {
        setDocumentoSolicitudError(result.error || 'Error al crear la solicitud');
      }
    } catch (error) {
      console.error('Error creando solicitud:', error);
      setDocumentoSolicitudError(error.message || 'Error al crear la solicitud');
    } finally {
      setDocumentoSolicitudLoading(false);
    }
  };

  // Funcție pentru solicitare în masă (toti angajații)
  const openSolicitarDocumentoTodosModal = () => {
    setDocumentoTodosForm({
      tipo_documento: '',
      tipo_personalizado: '',
      notas: '',
      solo_activos: true
    });
    setDocumentoTodosError(null);
    setDocumentoTodosProgress({ current: 0, total: 0, success: 0, failed: 0 });
    setShowSolicitarDocumentoTodosModal(true);
  };

  const handleSolicitarDocumentoTodos = async () => {
    if (!documentoTodosForm.tipo_documento) {
      setDocumentoTodosError('Por favor, selecciona un tipo de documento.');
      return;
    }

    // Verifică dacă e "Otro" și are tip personalizat completat
    if (documentoTodosForm.tipo_documento === 'otro') {
      if (!documentoTodosForm.tipo_personalizado || !documentoTodosForm.tipo_personalizado.trim()) {
        setDocumentoTodosError('Por favor, especifica el tipo de documento personalizado.');
        return;
      }
    }

    // Filtrează angajații: toți sau doar activi
    let empleadosParaSolicitar = documentoTodosForm.solo_activos
      ? users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO')
      : users;

    // Dacă există filtru de căutare, aplică-l
    if (searchTerm) {
      empleadosParaSolicitar = getFilteredUsers.filter(u => 
        documentoTodosForm.solo_activos 
          ? (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO'
          : true
      );
    }

    if (empleadosParaSolicitar.length === 0) {
      setDocumentoTodosError('No hay empleados para solicitar documentos.');
      return;
    }

    setDocumentoTodosLoading(true);
    setDocumentoTodosError(null);
    setDocumentoTodosProgress({ 
      current: 0, 
      total: empleadosParaSolicitar.length, 
      success: 0, 
      failed: 0 
    });

    let successCount = 0;
    let failedCount = 0;

    try {
      // Procesează în batch-uri pentru a nu suprasolicita backend-ul
      const batchSize = 10;
      for (let i = 0; i < empleadosParaSolicitar.length; i += batchSize) {
        const batch = empleadosParaSolicitar.slice(i, i + batchSize);
        
        // Procesează batch-ul în paralel
        const promises = batch.map(async (empleado) => {
          if (!empleado.CODIGO) return { success: false, empleado };
          
          try {
            const result = await callApi(routes.createDocumentoSolicitado, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                empleado_id: empleado.CODIGO,
                tipo_documento: documentoTodosForm.tipo_documento === 'otro' 
                  ? documentoTodosForm.tipo_personalizado.trim()
                  : documentoTodosForm.tipo_documento,
                notas: documentoTodosForm.notas || undefined,
                aplicar_a_nuevos: documentoTodosForm.aplicar_a_nuevos || false,
              }),
            });
            
            return { success: result.success || result.id, empleado };
          } catch (error) {
            console.error(`Error creando solicitud para ${empleado.CODIGO}:`, error);
            return { success: false, empleado, error: error.message };
          }
        });

        const results = await Promise.all(promises);
        
        results.forEach((result) => {
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        });

        setDocumentoTodosProgress({
          current: Math.min(i + batchSize, empleadosParaSolicitar.length),
          total: empleadosParaSolicitar.length,
          success: successCount,
          failed: failedCount
        });
      }

      setNotification({
        type: 'success',
        title: 'Solicitudes Creadas',
        message: `Se han creado ${successCount} solicitudes de ${documentoTodosForm.tipo_documento}${failedCount > 0 ? ` (${failedCount} fallidas)` : ''}.`,
        show: true
      });

      // Închide modalul după un scurt delay
      setTimeout(() => {
        setShowSolicitarDocumentoTodosModal(false);
        setDocumentoTodosForm({ tipo_documento: '', notas: '', solo_activos: true, aplicar_a_nuevos: false });
        setDocumentoTodosProgress({ current: 0, total: 0, success: 0, failed: 0 });
      }, 2000);

    } catch (error) {
      console.error('Error creando solicitudes en masa:', error);
      setDocumentoTodosError(error.message || 'Error al crear las solicitudes');
    } finally {
      setDocumentoTodosLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setEmailError(null);
    setEmailSuccess(false);
    setEmailProgress(null); // Reset progres
    
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
          email: authUser?.email,
          total: result.destinatari,
          successCount: result.successCount,
          failedCount: result.failedCount,
        });
        
        // Nu închidem modalul imediat - așteptăm progresul prin WebSocket
        // Progresul va fi gestionat de useEffect-ul care ascultă WebSocket-ul
        setEmailLoading(false);
        
        // Dacă nu există progres (pentru cazurile simple cu 1 email), închidem modalul
        if (!emailProgress && result.destinatari <= 1) {
          setEmailSuccess(true);
          setEmailForm({
            destinatar: 'angajat',
            grup: 'Empleado',
            subiect: '',
            mensaje: ''
          });
          setTimeout(() => {
            setShowEmailModal(false);
            setEmailSuccess(false);
          }, 2000);
        }
      } else {
        setEmailError('Ha ocurrido un problema al enviar el correo.');
        setEmailLoading(false);
      }
    } catch (error) {
      setEmailError('No se pudo enviar el correo.');
      setEmailLoading(false);
    }
  };

  // Funcție pentru sortare
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Dacă coloana e deja sortată, schimbă direcția
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Dacă e o coloană nouă, setează-o ca sortată ascendent
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Funcție helper pentru a obține valoarea de sortat
  const getSortValue = (emp, column) => {
    switch (column) {
      case 'CODIGO':
        return emp.CODIGO || '';
      case 'nombre':
        return (emp.nombre || '').toLowerCase();
      case 'email':
        return (emp.email || '').toLowerCase();
      case 'estado':
        return (emp.estado || '').toLowerCase();
      case 'fecha_alta':
        return emp.fecha_alta || '';
      case 'centro':
        return (emp.centro || '').toLowerCase();
      case 'grupo':
        return (emp.grupo || '').toLowerCase();
      case 'cuadrante':
        return emp.cuadrante === 'Sí' || emp.cuadrante === true ? 1 : 0;
      case 'horario':
        return emp.horario === 'Si' || emp.horario === 'Sí' || emp.horario === true ? 1 : 0;
      case 'centro_2':
        return emp.centro_2 === 'Si' || emp.centro_2 === 'Sí' || emp.centro_2 === true ? 1 : 0;
      case 'detalles_faltantes':
        return (emp.detalles_faltantes || '').toLowerCase();
      default:
        return '';
    }
  };

  // Date sortate
  const sortedEstadisticas = useMemo(() => {
    if (!sortColumn) {
      return estadisticas;
    }

    return [...estadisticas].sort((a, b) => {
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);

      // Comparare pentru numere
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Comparare pentru stringuri
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [estadisticas, sortColumn, sortDirection]);

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
          {canManageEmployees && (
            <button
              onClick={() => setActiveTab('corregir-nombres')}
              className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'corregir-nombres'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                  : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'corregir-nombres' 
                  ? 'bg-purple-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-purple-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <span>Corregir Nombres</span>
              </div>
            </button>
          )}
          {canManageEmployees && (
            <button
              onClick={() => setActiveTab('estadisticas')}
              className={`group relative px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                activeTab === 'estadisticas'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200'
                  : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                activeTab === 'estadisticas' 
                  ? 'bg-orange-400 opacity-30 blur-md animate-pulse' 
                  : 'bg-orange-400 opacity-0 group-hover:opacity-20 blur-md'
              }`}></div>
              <div className="relative flex items-center gap-2">
                <span className="text-xl">📊</span>
                <span>Estadísticas Empleados</span>
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
                      <label htmlFor="search-empleados" className="sr-only">
                        Buscar empleados
                      </label>
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      <input
                        id="search-empleados"
                        name="searchTerm"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={
                          searchBy === 'sin_fecha_alta'
                            ? 'Mostrando solo empleados sin Fecha Alta...'
                            : searchBy === 'fecha_alta'
                            ? 'Buscar por fecha...'
                            : 'Buscar empleados...'
                        }
                        disabled={searchBy === 'sin_fecha_alta'}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Selector tipo búsqueda */}
                    <div className="relative">
                      <label htmlFor="search-by-empleados" className="sr-only">
                        Tipo de búsqueda
                      </label>
                      <select
                        id="search-by-empleados"
                        name="searchBy"
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
                        <option value="fecha_alta">📅 Fecha Alta</option>
                        <option value="sin_fecha_alta">⚠️ Sin Fecha Alta</option>
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

                  {/* Solicitar Documento a Todos - ORANGE */}
                  <button
                    onClick={openSolicitarDocumentoTodosModal}
                    className="group relative overflow-hidden flex-1 min-w-[140px] transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(234, 88, 12, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(249, 115, 22, 0.25)',
                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.15)',
                      padding: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.15)';
                    }}
                  >
                    {/* Glow sutil en hover */}
                    <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                    
                    {/* Contenido */}
                    <div className="relative flex items-center gap-2 justify-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transform group-hover:scale-110 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                          boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)'
                        }}
                      >
                        <span className="text-base">📄</span>
                      </div>
                      <span className="text-sm font-bold text-orange-800">Solicitar Doc a Todos</span>
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
                                    alt={getFormattedNombre(user)} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-red-600 font-bold text-sm">
                                    {getEmployeeInitials(user)}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900">
                                  {getFormattedNombre(user) || 'Sin nombre'}
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
                              
                              {/* Icon Reset Password */}
                              <button
                                onClick={() => handleResetPassword(user)}
                                disabled={loadingPassword}
                                className="group relative p-1.5 rounded-lg transition-all duration-300 transform hover:scale-125 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Resetear contraseña y enviar por email"
                              >
                                <span className="text-xl relative z-10 inline-block transition-all duration-300 filter group-hover:drop-shadow-lg" style={{
                                  filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.4))',
                                }}>🔑</span>
                              </button>
                              
                              {/* Icon Solicitar Documento */}
                              <button
                                onClick={() => openSolicitarDocumentoModal(user)}
                                className="group relative p-1.5 rounded-lg transition-all duration-300 transform hover:scale-125"
                                title="Solicitar documento (DNI, Justificantes de banco, etc.)"
                              >
                                <span className="text-xl relative z-10 inline-block transition-all duration-300 filter group-hover:drop-shadow-lg" style={{
                                  filter: 'drop-shadow(0 2px 4px rgba(234, 179, 8, 0.4))',
                                }}>📄</span>
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
              {SHEET_FIELDS.filter(field => field !== 'Contraseña').map(field => {
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
                    {field === 'CuantoPuedeGastar' && '💰'} 
                    {field}
                  </label>
                  {field === 'CODIGO' ? (
                    <Input
                      id={fieldId}
                      name={field}
                      value={addForm[field]}
                      readOnly
                      className="bg-gray-100"
                    />
                  ) : field === 'NOMBRE / APELLIDOS' ? (
                    <div className="space-y-3">
                      <Input
                        id={fieldId}
                        name={field}
                        value={addForm[field]}
                        onChange={(e) => {
                          // Permitem editare manuală, dar useEffect-ul va sincroniza dacă există câmpuri separate
                          setAddForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }));
                        }}
                        placeholder="NOMBRE / APELLIDOS (se completa automáticamente al escribir en campos separados)"
                      />
                      <div className="text-xs text-gray-500 mb-2">Opcional: Campos separados (se sincronizan automáticamente)</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label htmlFor="add-nombre" className="block text-xs text-gray-600 mb-1">Nombre</label>
                          <Input
                            id="add-nombre"
                            name="NOMBRE"
                            value={addForm.NOMBRE || ''}
                            onChange={(e) => setAddForm(prev => ({ ...prev, NOMBRE: toUpperCaseIfNeeded('NOMBRE', e.target.value) }))}
                            placeholder="Nombre"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-apellido1" className="block text-xs text-gray-600 mb-1">Primer Apellido</label>
                          <Input
                            id="add-apellido1"
                            name="APELLIDO1"
                            value={addForm.APELLIDO1 || ''}
                            onChange={(e) => setAddForm(prev => ({ ...prev, APELLIDO1: toUpperCaseIfNeeded('APELLIDO1', e.target.value) }))}
                            placeholder="Primer Apellido"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-apellido2" className="block text-xs text-gray-600 mb-1">Segundo Apellido</label>
                          <Input
                            id="add-apellido2"
                            name="APELLIDO2"
                            value={addForm.APELLIDO2 || ''}
                            onChange={(e) => setAddForm(prev => ({ ...prev, APELLIDO2: toUpperCaseIfNeeded('APELLIDO2', e.target.value) }))}
                            placeholder="Segundo Apellido"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ) : field === 'D.N.I. / NIE' ? (
                    <div className="space-y-2">
                      <input
                        id={fieldId}
                        name={field}
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
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
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
                        id={fieldId}
                        name={field}
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
                        onChange={(e) => setAddForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
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
                        id={fieldId}
                        name={field}
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
                        onChange={(e) => {
                          const valor = e.target.value;
                          // Formatează automat IBAN-ul cu spații
                          const valorFormateado = formatearIBAN(valor);
                          setAddForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, valorFormateado) }));
                        }}
                        placeholder="ES91 2100 0418 4502 0005 1332 (IBAN español)"
                        maxLength={34} // 24 caractere + 5 spații = 29, dar permitem mai mult pentru flexibilitate
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
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
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
                        id={fieldId}
                        name={field}
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
                        id={fieldId}
                        name={field}
                        type="text"
                        className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                        placeholder="Buscar centro de trabajo..."
                      value={addForm[field] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddForm(prev => ({ ...prev, [field]: value }));
                          setShowCentroDropdownAdd(true);
                        }}
                        onFocus={() => setShowCentroDropdownAdd(true)}
                        onBlur={() => {
                          // Delay to allow clicking on dropdown items
                          setTimeout(() => setShowCentroDropdownAdd(false), 200);
                        }}
                      disabled={isOperationLoading('clientes')}
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      
                      {/* Dropdown de sugerencias */}
                      {showCentroDropdownAdd && addForm[field] && (
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
                                  setShowCentroDropdownAdd(false);
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
                        id={fieldId}
                        name={field}
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
                      id={fieldId}
                      name={field}
                      type="text"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                      value={addForm[field] || ''}
                      readOnly={true}
                      placeholder={`${field.toLowerCase()} (solo lectura)`}
                    />
                  ) : field === 'ESTADO' ? (
                    <select
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || 'NO'}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="NO">❌ NO</option>
                      <option value="SI">✅ SI</option>
                    </select>
                  ) : field === 'TrabajaFestivos' ? (
                    <select
                      id={fieldId}
                      name={field}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || 'NO'}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="NO">❌ NO</option>
                      <option value="SI">✅ SI</option>
                    </select>
                  ) : field === 'CuantoPuedeGastar' ? (
                    <div className="space-y-2">
                      <input
                        id={fieldId}
                        name={field}
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
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="">Seleccionar horas...</option>
                      {Array.from({ length: 40 }, (_, i) => i + 1).map(hours => (
                        <option key={hours} value={hours}>
                          {hours} {hours === 1 ? 'hora' : 'horas'}
                        </option>
                      )                      )}
                    </select>
                  ) : field === 'GRUPO' ? (
                    <select
                      id={fieldId}
                      name={field}
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
                  ) : field === 'DIRECCION' ? (
                    <AddressAutocomplete
                      id={fieldId}
                      name={field}
                      value={addForm[field] || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder="DIRECCION (escribe para buscar direcciones)"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    />
                  ) : (
                    <Input
                      id={fieldId}
                      name={field}
                      placeholder={field}
                      value={addForm[field]}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                    />
                  )}
                </div>
                );
              })}
            </div>
            
            {/* Checkbox pentru "Enviar a Gestoria" */}
            <div className="mt-6 flex items-center justify-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarAGestoria}
                  onChange={(e) => {
                    setEnviarAGestoria(e.target.checked);
                    if (!e.target.checked) {
                      // Reset câmpurile când se debifează
                      setMensajeAdicionalGestoria('');
                      setArchivosGestoria([]);
                    }
                  }}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  📧 Enviar a Gestoria
                </span>
              </label>
            </div>

            {/* Câmpuri adiționale pentru gestorie (doar când checkbox-ul este bifat) */}
            {enviarAGestoria && (
              <div className="mt-6 space-y-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje Adicional (opcional)
                  </label>
                  <textarea
                    value={mensajeAdicionalGestoria}
                    onChange={(e) => setMensajeAdicionalGestoria(e.target.value)}
                    placeholder="Escribe un mensaje adicional que se enviará junto con el PDF..."
                    rows={4}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivos Adicionales (opcional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setArchivosGestoria(files);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {archivosGestoria.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {archivosGestoria.map((file, idx) => (
                        <div key={idx} className="text-sm text-gray-600 flex items-center justify-between bg-white p-2 rounded">
                          <span>📎 {file.name}</span>
                          <button
                            onClick={() => {
                              setArchivosGestoria(archivosGestoria.filter((_, i) => i !== idx));
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
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
        ) : activeTab === 'estadisticas' && canManageEmployees ? (
          // Tab pentru estadísticas empleados
          <div className="p-6 w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">📊 Estadísticas de Empleados</h2>
            
            {loadingEstadisticas ? (
              <TableLoading columns={10} rows={5} className="p-4" />
            ) : errorEstadisticas ? (
              <div className="text-center text-red-600 font-bold py-8">{errorEstadisticas}</div>
            ) : estadisticas.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No hay estadísticas disponibles</div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full bg-white border border-gray-200 rounded-lg shadow-sm" style={{ minWidth: '1520px' }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '80px' }}
                        onClick={() => handleSort('CODIGO')}
                      >
                        <div className="flex items-center gap-1">
                          CODIGO
                          {sortColumn === 'CODIGO' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '200px' }}
                        onClick={() => handleSort('nombre')}
                      >
                        <div className="flex items-center gap-1">
                          nombre
                          {sortColumn === 'nombre' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '200px' }}
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center gap-1">
                          email
                          {sortColumn === 'email' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '100px' }}
                        onClick={() => handleSort('estado')}
                      >
                        <div className="flex items-center gap-1">
                          estado
                          {sortColumn === 'estado' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '120px' }}
                        onClick={() => handleSort('fecha_alta')}
                      >
                        <div className="flex items-center gap-1">
                          fecha alta
                          {sortColumn === 'fecha_alta' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '250px' }}
                        onClick={() => handleSort('centro')}
                      >
                        <div className="flex items-center gap-1">
                          centro
                          {sortColumn === 'centro' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '150px' }}
                        onClick={() => handleSort('grupo')}
                      >
                        <div className="flex items-center gap-1">
                          grupo
                          {sortColumn === 'grupo' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '60px' }}
                        onClick={() => handleSort('cuadrante')}
                      >
                        <div className="flex items-center gap-1">
                          cuadrante
                          {sortColumn === 'cuadrante' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '60px' }}
                        onClick={() => handleSort('horario')}
                      >
                        <div className="flex items-center gap-1">
                          horario
                          {sortColumn === 'horario' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '50px' }}
                        onClick={() => handleSort('centro_2')}
                      >
                        <div className="flex items-center gap-1">
                          centro
                          {sortColumn === 'centro_2' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b cursor-pointer hover:bg-gray-100 select-none" 
                        style={{ width: '280px' }}
                        onClick={() => handleSort('detalles_faltantes')}
                      >
                        <div className="flex items-center gap-1">
                          detalles_faltantes
                          {sortColumn === 'detalles_faltantes' && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedEstadisticas.map((emp, index) => (
                      <tr key={emp.CODIGO || index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 text-sm text-gray-900 font-mono">{emp.CODIGO || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-900 font-medium">{emp.nombre || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 break-words">{emp.email || '-'}</td>
                        <td className="px-3 py-3 text-sm">
                          {editingCell?.codigo === emp.CODIGO && editingCell?.field === 'estado' ? (
                            <div className="flex items-center gap-1">
                              <select
                                id={`estado-edit-${emp.CODIGO}`}
                                name={`estado-edit-${emp.CODIGO}`}
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'estado'}
                              >
                                <option value="ACTIVO">ACTIVO</option>
                                <option value="INACTIVO">INACTIVO</option>
                              </select>
                              <button
                                onClick={() => saveCell(emp.CODIGO, 'estado', editingValue)}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'estado'}
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                title="Guardar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'estado'}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer hover:opacity-80 ${
                                emp.estado === 'ACTIVO' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}
                              onClick={() => startEditing(emp.CODIGO, 'estado', emp.estado)}
                              title="Click para editar"
                            >
                              {emp.estado || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {editingCell?.codigo === emp.CODIGO && editingCell?.field === 'fecha_alta' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                id={`fecha-alta-edit-${emp.CODIGO}`}
                                name={`fecha-alta-edit-${emp.CODIGO}`}
                                value={editingValue || ''}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'fecha_alta'}
                              />
                              <button
                                onClick={() => saveCell(emp.CODIGO, 'fecha_alta', editingValue)}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'fecha_alta'}
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                title="Guardar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'fecha_alta'}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              className="font-mono text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded"
                              onClick={() => startEditing(emp.CODIGO, 'fecha_alta', emp.fecha_alta)}
                              title="Click para editar"
                            >
                              {emp.fecha_alta ? (
                                emp.fecha_alta
                              ) : (
                                <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">Sin fecha</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 break-words">
                          {editingCell?.codigo === emp.CODIGO && editingCell?.field === 'centro' ? (
                            <div className="flex items-center gap-1 relative centro-combobox-container">
                              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                                <input
                                  type="text"
                                  id={`centro-edit-${emp.CODIGO}`}
                                  name={`centro-edit-${emp.CODIGO}`}
                                  value={centroSearchTerm}
                                  onChange={(e) => {
                                    setCentroSearchTerm(e.target.value);
                                    setEditingValue(e.target.value);
                                    setShowCentroDropdown(true);
                                  }}
                                  onFocus={() => setShowCentroDropdown(true)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'centro'}
                                  placeholder="Buscar o escribir centro..."
                                />
                                {showCentroDropdown && filteredCentros.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                                    {filteredCentros.map((centro) => (
                                      <div
                                        key={centro}
                                        onClick={() => {
                                          setEditingValue(centro);
                                          setCentroSearchTerm(centro);
                                          setShowCentroDropdown(false);
                                        }}
                                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                                      >
                                        {centro}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  saveCell(emp.CODIGO, 'centro', editingValue);
                                  setShowCentroDropdown(false);
                                }}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'centro'}
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                title="Guardar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'centro'}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded"
                              onClick={() => startEditing(emp.CODIGO, 'centro', emp.centro)}
                              title="Click para editar"
                            >
                              {emp.centro || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {editingCell?.codigo === emp.CODIGO && editingCell?.field === 'grupo' ? (
                            <div className="flex items-center gap-1 relative grupo-combobox-container">
                              <div className="relative flex-1 min-w-[150px] max-w-[200px]">
                                <input
                                  type="text"
                                  id={`grupo-edit-${emp.CODIGO}`}
                                  name={`grupo-edit-${emp.CODIGO}`}
                                  value={grupoSearchTerm}
                                  onChange={(e) => {
                                    setGrupoSearchTerm(e.target.value);
                                    setEditingValue(e.target.value);
                                    setShowGrupoDropdown(true);
                                  }}
                                  onFocus={() => setShowGrupoDropdown(true)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'grupo'}
                                  placeholder="Buscar o escribir grupo..."
                                />
                                {showGrupoDropdown && filteredGrupos.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                                    {filteredGrupos.map((grupo) => (
                                      <div
                                        key={grupo}
                                        onClick={() => {
                                          setEditingValue(grupo);
                                          setGrupoSearchTerm(grupo);
                                          setShowGrupoDropdown(false);
                                        }}
                                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                                      >
                                        {grupo}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  saveCell(emp.CODIGO, 'grupo', editingValue);
                                  setShowGrupoDropdown(false);
                                }}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'grupo'}
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                title="Guardar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={savingCell?.codigo === emp.CODIGO && savingCell?.field === 'grupo'}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded"
                              onClick={() => startEditing(emp.CODIGO, 'grupo', emp.grupo)}
                              title="Click para editar"
                            >
                              {emp.grupo || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            emp.tiene_cuadrante === 'Sí' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {emp.tiene_cuadrante || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            emp.tiene_horario === 'Sí' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {emp.tiene_horario || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            emp.tiene_centro === 'Sí' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {emp.tiene_centro || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {emp.detalles_faltantes && emp.detalles_faltantes.trim() !== '' ? (
                            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs break-words inline-block max-w-full">
                              {emp.detalles_faltantes}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Butoane de export */}
                <div className="mt-4 flex gap-3 justify-end">
                  <button
                    onClick={handleExportEstadisticasExcel}
                    disabled={loadingEstadisticas || estadisticas.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    onClick={handleExportEstadisticasPDF}
                    disabled={loadingEstadisticas || estadisticas.length === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>📄</span>
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'corregir-nombres' && canManageEmployees ? (
          // Tab pentru corectare manuală split-uri
          <CorregirNombresTab 
            users={users}
            onSave={async (codigo, data) => {
              const token = localStorage.getItem('auth_token');
              const response = await fetch(routes.updateNombreSplit(codigo), {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({
                  CODIGO: codigo,
                  ...data,
                  NOMBRE_SPLIT_CONFIANZA: 2, // Setează confianza = 2 pentru corectare manuală
                }),
              });
              
              if (!response.ok) {
                throw new Error('Error al guardar');
              }
              
              // Reîncarcă lista
              await fetchUsers();
              return { success: true };
            }}
          />
        ) : null}
      </Card>

      {/* Modal ULTRA MODERN para editar empleado */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-gray-200 animate-in fade-in duration-300">
            {/* Header ULTRA MODERN */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200 flex-shrink-0">
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
            
            {/* Content - SCROLLABIL */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SHEET_FIELDS.filter(field => field !== 'NOMBRE' && field !== 'APELLIDO1' && field !== 'APELLIDO2' && field !== 'NOMBRE_SPLIT_CONFIANZA').map(field => {
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
                    name={field}
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
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
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
                      onChange={(e) => {
                        // Elimină spații și liniuțe în timpul input-ului
                        const cleaned = e.target.value.replace(/[\s-]/g, '');
                        setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, cleaned) }));
                      }}
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
                      id={fieldId}
                      name={field}
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
                      onChange={(e) => {
                        const valor = e.target.value;
                        // Formatează automat IBAN-ul cu spații
                        const valorFormateado = formatearIBAN(valor);
                        setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, valorFormateado) }));
                      }}
                      placeholder="ES91 2100 0418 4502 0005 1332 (IBAN español)"
                      maxLength={34} // 24 caractere + 5 spații = 29, dar permitem mai mult pentru flexibilitate
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
                    id={fieldId}
                    name={field}
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
                    id={fieldId}
                    name={field}
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
                    id={fieldId}
                    name={field}
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
                    id={fieldId}
                    name={field}
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
                      id={fieldId}
                      name={field}
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
                      id={fieldId}
                      name={field}
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
                    id={fieldId}
                    name={field}
                    type="text"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-not-allowed"
                    value={editForm[field] || 'DE CAMINO SERVICIOS AUXILIARES SL'}
                    readOnly={true}
                    placeholder="empresa (solo lectura)"
                  />
                ) : field === 'GRUPO' ? (
                  <select
                    id={fieldId}
                    name={field}
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
                      id={fieldId}
                      name={field}
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
                    id={fieldId}
                    name={field}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'ACTIVO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="ACTIVO">🟢 ACTIVO</option>
                    <option value="INACTIVO">🔴 INACTIVO</option>
                  </select>
                ) : field === 'DerechoPedidos' ? (
                  <select
                    id={fieldId}
                    name={field}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'NO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="NO">❌ NO</option>
                    <option value="SI">✅ SI</option>
                  </select>
                ) : field === 'TrabajaFestivos' ? (
                  <select
                    id={fieldId}
                    name={field}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 hover:border-gray-300"
                    value={editForm[field] || 'NO'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="NO">🚫 NO</option>
                    <option value="SI">🎉 SÍ</option>
                  </select>
                ) : field === 'Contraseña' ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        readOnly
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                        value={editForm[field] || ''}
                        placeholder={mostrarContraseña ? "No hay contraseña guardada" : "Haz clic en 'Mostrar contraseña' para verla"}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!mostrarContraseña && !editForm[field]) {
                            // Obține parola de la backend
                            setLoadingPassword(true);
                            try {
                              const codigo = editForm.CODIGO;
                              if (!codigo) {
                                setNotification({
                                  type: 'error',
                                  title: 'Error',
                                  message: 'No se encontró el código del empleado',
                                  show: true
                                });
                                return;
                              }
                              const result = await callApi(routes.getPassword(codigo));
                              if (result.success && result.data) {
                                setEditForm(prev => ({ ...prev, [field]: result.data.password || '' }));
                                setMostrarContraseña(true);
                              } else {
                                setNotification({
                                  type: 'error',
                                  title: 'Error de Permisos',
                                  message: result.error || 'Error al obtener la contraseña',
                                  show: true
                                });
                              }
                            } catch (error) {
                              console.error('Error obteniendo contraseña:', error);
                              setNotification({
                                type: 'error',
                                title: 'Error',
                                message: error.message || 'Error al obtener la contraseña',
                                show: true
                              });
                            } finally {
                              setLoadingPassword(false);
                            }
                          } else {
                            // Ascunde parola
                            setMostrarContraseña(false);
                            setEditForm(prev => ({ ...prev, [field]: '' }));
                          }
                        }}
                        disabled={loadingPassword}
                        className="px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
                      >
                        {loadingPassword ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            <span>Cargando...</span>
                          </span>
                        ) : mostrarContraseña ? (
                          'Ocultar contraseña'
                        ) : (
                          'Mostrar contraseña'
                        )}
                      </button>
                    </div>
                    {mostrarContraseña && editForm[field] && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span>🔒</span>
                        <span>La contraseña es solo de lectura y no se puede editar aquí</span>
                      </p>
                    )}
                  </div>
                ) : field === 'CuantoPuedeGastar' ? (
                  <div className="space-y-2">
                    <input
                      id={fieldId}
                      name={field}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                      placeholder="0.00"
                    />
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span>💰</span>
                      <span>Límite de gasto en EUR</span>
                    </div>
                  </div>
                ) : field === 'TIPO DE CONTRATO' ? (
                  <select
                    id={fieldId}
                    name={field}
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
                    id={fieldId}
                    name={field}
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
                ) : field === 'NOMBRE / APELLIDOS' ? (
                  <div className="space-y-3">
                    <Input
                      id={fieldId}
                      name={field}
                      value={editForm[field] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                    />
                    {/* Campos separados si existen */}
                    {(editForm?.NOMBRE || editForm?.APELLIDO1 || editForm?.APELLIDO2) && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <div>
                          <label htmlFor="edit-nombre" className="block text-xs font-medium text-gray-600 mb-1">📝 Nombre</label>
                          <Input
                            id="edit-nombre"
                            name="NOMBRE"
                            value={editForm.NOMBRE || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, NOMBRE: toUpperCaseIfNeeded('NOMBRE', e.target.value) }))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-apellido1" className="block text-xs font-medium text-gray-600 mb-1">📝 Primer Apellido</label>
                          <Input
                            id="edit-apellido1"
                            name="APELLIDO1"
                            value={editForm.APELLIDO1 || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, APELLIDO1: toUpperCaseIfNeeded('APELLIDO1', e.target.value) }))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-apellido2" className="block text-xs font-medium text-gray-600 mb-1">📝 Segundo Apellido</label>
                          <Input
                            id="edit-apellido2"
                            name="APELLIDO2"
                            value={editForm.APELLIDO2 || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, APELLIDO2: toUpperCaseIfNeeded('APELLIDO2', e.target.value) }))}
                            className="text-sm"
                          />
                        </div>
                        {editForm.NOMBRE_SPLIT_CONFIANZA !== undefined && (
                          <div>
                            <div className="block text-xs font-medium text-gray-600 mb-1">ℹ️ Confianza del Split</div>
                            <p className="text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">
                              {editForm.NOMBRE_SPLIT_CONFIANZA === 2 ? '✅ Confiado' : editForm.NOMBRE_SPLIT_CONFIANZA === 1 ? '⚠️ Incierto' : '❌ Fallido'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : field === 'DIRECCION' ? (
                  <AddressAutocomplete
                    id={fieldId}
                    name={field}
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder="DIRECCION (escribe para buscar direcciones)"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                ) : (
                  <Input
                    id={fieldId}
                    name={field}
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                  />
                )}
                </div>
                  );
                })}
              </div>
            </div>
            
            {/* Checkbox-uri și câmpuri pentru gestorie - ÎNAINTE DE FOOTER, FIX */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
            {/* Checkbox-uri pentru "Enviar a Gestoria" și "Retrimite Ficha" */}
            <div className="px-6 pt-4 pb-3 flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarAGestoriaEdit}
                  onChange={(e) => {
                    setEnviarAGestoriaEdit(e.target.checked);
                    if (!e.target.checked) {
                      // Reset câmpurile când se debifează
                      setMensajeAdicionalGestoriaEdit('');
                      setArchivosGestoriaEdit([]);
                    }
                  }}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  📧 Enviar a Gestoria
                </span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retrimiteFichaEdit}
                  onChange={(e) => setRetrimiteFichaEdit(e.target.checked)}
                  disabled={!editForm.CODIGO}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-gray-700">
                  📄 Retrimite Ficha a Gestoria
                </span>
                {retrimiteFichaEdit && (
                  <span className="text-xs text-purple-600 italic">
                    (Se enviará automáticamente al guardar)
                  </span>
                )}
              </label>
            </div>
            
            {/* Câmpuri adiționale pentru gestorie (doar când checkbox-ul "Enviar a Gestoria" este bifat) */}
            {enviarAGestoriaEdit && (
              <div className="px-6 pb-4 space-y-4 bg-blue-50 border-t border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje Adicional (opcional)
                  </label>
                  <textarea
                    value={mensajeAdicionalGestoriaEdit}
                    onChange={(e) => setMensajeAdicionalGestoriaEdit(e.target.value)}
                    placeholder="Escribe un mensaje adicional que se enviará junto con la actualización..."
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📎 Archivos Adicionales (opcional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setArchivosGestoriaEdit(files);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white"
                  />
                  {archivosGestoriaEdit.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {archivosGestoriaEdit.map((file, idx) => (
                        <div key={idx} className="text-sm text-gray-600 flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                          <span className="truncate flex-1">📎 {file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setArchivosGestoriaEdit(archivosGestoriaEdit.filter((_, i) => i !== idx));
                            }}
                            className="text-red-500 hover:text-red-700 font-bold ml-2 flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
            
            {/* Footer cu butoane ULTRA MODERN - FIX */}
            <div className="flex-shrink-0 flex gap-4 justify-end p-6 border-t border-gray-200 bg-gray-50">
              {/* Buton Cancelar */}
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEnviarAGestoriaEdit(false); // Reset checkbox la închidere
                  setRetrimiteFichaEdit(false); // Reset checkbox retrimite ficha
                  setMensajeAdicionalGestoriaEdit(''); // Reset mesaj adițional
                  setArchivosGestoriaEdit([]); // Reset fișiere
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

          {/* Bară de progres pentru trimiterea email-urilor */}
          {emailProgress && (
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900">
                    {emailProgress.status === 'starting' && '⏳ Pregătire...'}
                    {emailProgress.status === 'sending' && '📧 Se trimit email-uri...'}
                    {emailProgress.status === 'completed' && '✅ Finalizat!'}
                  </span>
                  <span className="text-sm font-bold text-blue-700">
                    {emailProgress.current} / {emailProgress.total}
                  </span>
                </div>
                
                {/* Bară de progres */}
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${(emailProgress.current / emailProgress.total) * 100}%`,
                    }}
                  />
                </div>
                
                {/* Statistici */}
                <div className="mt-3 flex items-center justify-between text-xs text-blue-700">
                  <span>✅ Reușite: {emailProgress.success}</span>
                  {emailProgress.failed > 0 && (
                    <span className="text-red-600">❌ Eșuate: {emailProgress.failed}</span>
                  )}
                  <span className="font-semibold">
                    {Math.round((emailProgress.current / emailProgress.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mensajes de feedback moderno */}
          {emailError && !emailProgress && (
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
          
          {emailSuccess && !emailProgress && (
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
            loading={emailLoading || (emailProgress && emailProgress.status !== 'completed')}
            disabled={emailLoading || (emailProgress && emailProgress.status !== 'completed')}
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

      {/* Modal pentru solicitare documente */}
      <Modal
        isOpen={showSolicitarDocumentoModal}
        onClose={() => {
          setShowSolicitarDocumentoModal(false);
          setSelectedUserForDocumento(null);
          setDocumentoSolicitudForm({ tipo_documento: '', notas: '' });
          setDocumentoSolicitudError(null);
        }}
        title="Solicitar Documento"
        size="md"
      >
        {selectedUserForDocumento && (
          <div className="space-y-6">
            {/* Info angajat */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">👤</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {getFormattedNombre(selectedUserForDocumento) || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Código: {selectedUserForDocumento.CODIGO}
                  </p>
                </div>
              </div>
            </div>

            {/* Selector tip document */}
            <div>
              <label htmlFor="solicitud-tipo-documento-select" className="block text-sm font-semibold text-gray-700 mb-3">
                Tipo de Documento <span className="text-red-500">*</span>
              </label>
              <select
                id="solicitud-tipo-documento-select"
                name="tipoDocumento"
                value={documentoSolicitudForm.tipo_documento}
                onChange={(e) => setDocumentoSolicitudForm(prev => ({ ...prev, tipo_documento: e.target.value, tipo_personalizado: e.target.value === 'otro' ? prev.tipo_personalizado : '' }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
              >
                <option value="">Selecciona un tipo...</option>
                <option value="DNI">DNI (Documento de Identidad)</option>
                <option value="Certificado de titularidad">Certificado de titularidad</option>
                <option value="otro">📎 Otro (Personalizado)</option>
              </select>
            </div>

            {/* Campo de texto personalizado si selecciona "Otro" */}
            {documentoSolicitudForm.tipo_documento === 'otro' && (
              <div>
                <label htmlFor="solicitud-tipo-personalizado-input" className="block text-sm font-semibold text-gray-700 mb-3">
                  Especifica el Tipo de Documento <span className="text-red-500">*</span>
                </label>
                <input
                  id="solicitud-tipo-personalizado-input"
                  name="tipoPersonalizado"
                  type="text"
                  value={documentoSolicitudForm.tipo_personalizado}
                  onChange={(e) => setDocumentoSolicitudForm(prev => ({ ...prev, tipo_personalizado: e.target.value }))}
                  placeholder="Ej: Certificado de Estudios, Carta de Recomendación, Justificante Médico..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            )}

            {/* Informare clară */}
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-blue-600 text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800 font-medium">
                    Los documentos se solicitan exclusivamente para la verificación de identidad y cuenta bancaria, con fines contractuales y fiscales.
                  </p>
                </div>
              </div>
            </div>

            {/* Notas opționale */}
            <div>
              <label htmlFor="solicitud-notas-textarea" className="block text-sm font-semibold text-gray-700 mb-3">
                Notas (opcional)
              </label>
              <textarea
                id="solicitud-notas-textarea"
                name="notas"
                value={documentoSolicitudForm.notas}
                onChange={(e) => setDocumentoSolicitudForm(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Añade alguna nota o instrucción adicional..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200"
                rows={4}
              />
            </div>

            {/* Error message */}
            {documentoSolicitudError && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div>
                    <p className="text-red-800 font-medium">Error</p>
                    <p className="text-red-600 text-sm">{documentoSolicitudError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Butoane */}
            <div className="flex gap-4 justify-center mt-8">
              <Button
                onClick={() => {
                  setShowSolicitarDocumentoModal(false);
                  setSelectedUserForDocumento(null);
                  setDocumentoSolicitudForm({ tipo_documento: '', tipo_personalizado: '', notas: '' });
                  setDocumentoSolicitudError(null);
                }}
                variant="outline"
                size="lg"
                className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400"
              >
                <span className="mr-2">✖️</span>
                Cancelar
              </Button>
              <Button
                onClick={handleSolicitarDocumento}
                variant="primary"
                size="lg"
                loading={documentoSolicitudLoading}
                disabled={documentoSolicitudLoading || !documentoSolicitudForm.tipo_documento || (documentoSolicitudForm.tipo_documento === 'otro' && !documentoSolicitudForm.tipo_personalizado?.trim())}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
              >
                {documentoSolicitudLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📄</span>
                    Solicitar Documento
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pentru solicitare documente în masă (toti angajații) */}
      <Modal
        isOpen={showSolicitarDocumentoTodosModal}
        onClose={() => {
          setShowSolicitarDocumentoTodosModal(false);
          setDocumentoTodosForm({ tipo_documento: '', tipo_personalizado: '', notas: '', solo_activos: true, aplicar_a_nuevos: false });
          setDocumentoTodosError(null);
          setDocumentoTodosProgress({ current: 0, total: 0, success: 0, failed: 0 });
        }}
        title="Solicitar Documento a Todos los Empleados"
        size="md"
      >
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {documentoTodosForm.solo_activos 
                    ? users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO').length
                    : users.length
                  } empleados
                </p>
                <p className="text-sm text-gray-600">
                  {documentoTodosForm.solo_activos ? 'Solo activos' : 'Todos los empleados'}
                </p>
              </div>
            </div>
          </div>

          {/* Selector tip document */}
          <div>
            <label htmlFor="solicitud-todos-tipo-documento-select" className="block text-sm font-semibold text-gray-700 mb-3">
              Tipo de Documento <span className="text-red-500">*</span>
            </label>
            <select
              id="solicitud-todos-tipo-documento-select"
              name="tipoDocumentoTodos"
              value={documentoTodosForm.tipo_documento}
              onChange={(e) => setDocumentoTodosForm(prev => ({ ...prev, tipo_documento: e.target.value, tipo_personalizado: e.target.value === 'otro' ? prev.tipo_personalizado : '' }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
            >
              <option value="">Selecciona un tipo...</option>
              <option value="DNI">DNI (Documento de Identidad)</option>
              <option value="Certificado de titularidad">Certificado de titularidad</option>
              <option value="otro">📎 Otro (Personalizado)</option>
            </select>
          </div>

          {/* Campo de texto personalizado si selecciona "Otro" */}
          {documentoTodosForm.tipo_documento === 'otro' && (
            <div>
              <label htmlFor="solicitud-todos-tipo-personalizado-input" className="block text-sm font-semibold text-gray-700 mb-3">
                Especifica el Tipo de Documento <span className="text-red-500">*</span>
              </label>
              <input
                id="solicitud-todos-tipo-personalizado-input"
                name="tipoPersonalizadoTodos"
                type="text"
                value={documentoTodosForm.tipo_personalizado}
                onChange={(e) => setDocumentoTodosForm(prev => ({ ...prev, tipo_personalizado: e.target.value }))}
                placeholder="Ej: Certificado de Estudios, Carta de Recomendación, Justificante Médico..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
              />
            </div>
          )}

          {/* Informare clară */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-blue-600 text-xl">ℹ️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800 font-medium">
                  Los documentos se solicitan exclusivamente para la verificación de identidad y cuenta bancaria, con fines contractuales y fiscales.
                </p>
              </div>
            </div>
          </div>

          {/* Checkbox pentru doar activi */}
          <div>
            <label htmlFor="solicitud-todos-solo-activos-checkbox" className="flex items-center gap-3 cursor-pointer">
              <input
                id="solicitud-todos-solo-activos-checkbox"
                name="soloActivos"
                type="checkbox"
                checked={documentoTodosForm.solo_activos}
                onChange={(e) => setDocumentoTodosForm(prev => ({ ...prev, solo_activos: e.target.checked }))}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Solo empleados activos
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-8">
              Si está desmarcado, se solicitará a todos los empleados (activos e inactivos)
            </p>
          </div>

          {/* Checkbox pentru aplicare la viitorii angajați */}
          <div>
            <label htmlFor="solicitud-todos-aplicar-a-nuevos-checkbox" className="flex items-center gap-3 cursor-pointer">
              <input
                id="solicitud-todos-aplicar-a-nuevos-checkbox"
                name="aplicarANuevos"
                type="checkbox"
                checked={documentoTodosForm.aplicar_a_nuevos}
                onChange={(e) => setDocumentoTodosForm(prev => ({ ...prev, aplicar_a_nuevos: e.target.checked }))}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Aplicar a futuros empleados activos
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-8">
              Si está marcado, esta solicitud se aplicará automáticamente a todos los empleados activos que se agreguen en el futuro
            </p>
          </div>

          {/* Notas opționale */}
          <div>
            <label htmlFor="solicitud-todos-notas-textarea" className="block text-sm font-semibold text-gray-700 mb-3">
              Notas (opcional)
            </label>
            <textarea
              id="solicitud-todos-notas-textarea"
              name="notasTodos"
              value={documentoTodosForm.notas}
              onChange={(e) => setDocumentoTodosForm(prev => ({ ...prev, notas: e.target.value }))}
              placeholder="Añade alguna nota o instrucción adicional para todos los empleados..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none transition-all duration-200"
              rows={4}
            />
          </div>

          {/* Progress bar pentru procesare în masă */}
          {documentoTodosLoading && documentoTodosProgress.total > 0 && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-orange-900">
                    Procesando solicitudes...
                  </span>
                  <span className="text-sm font-bold text-orange-700">
                    {documentoTodosProgress.current} / {documentoTodosProgress.total}
                  </span>
                </div>
                
                {/* Bară de progres */}
                <div className="w-full bg-orange-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-600 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${(documentoTodosProgress.current / documentoTodosProgress.total) * 100}%`,
                    }}
                  />
                </div>
                
                {/* Statistici */}
                <div className="mt-3 flex items-center justify-between text-xs text-orange-700">
                  <span>✅ Reușite: {documentoTodosProgress.success}</span>
                  {documentoTodosProgress.failed > 0 && (
                    <span className="text-red-600">❌ Eșuate: {documentoTodosProgress.failed}</span>
                  )}
                  <span className="font-semibold">
                    {Math.round((documentoTodosProgress.current / documentoTodosProgress.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {documentoTodosError && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 text-lg">⚠️</span>
                </div>
                <div>
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-600 text-sm">{documentoTodosError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Butoane */}
          <div className="flex gap-4 justify-center mt-8">
            <Button
              onClick={() => {
                setShowSolicitarDocumentoTodosModal(false);
                setDocumentoTodosForm({ tipo_documento: '', notas: '', solo_activos: true, aplicar_a_nuevos: false });
                setDocumentoTodosError(null);
                setDocumentoTodosProgress({ current: 0, total: 0, success: 0, failed: 0 });
              }}
              variant="outline"
              size="lg"
              className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400"
              disabled={documentoTodosLoading}
            >
              <span className="mr-2">✖️</span>
              Cancelar
            </Button>
            <Button
              onClick={handleSolicitarDocumentoTodos}
              variant="primary"
              size="lg"
              loading={documentoTodosLoading}
              disabled={documentoTodosLoading || !documentoTodosForm.tipo_documento || (documentoTodosForm.tipo_documento === 'otro' && !documentoTodosForm.tipo_personalizado?.trim())}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg"
            >
              {documentoTodosLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <span className="mr-2">📄</span>
                  Solicitar a Todos
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal pentru generare PDF */}
      <EmployeePDFGenerator
        employeeData={pdfEmployeeData}
        createdBy={authUser?.['NOMBRE / APELLIDOS'] || authUser?.nombre}
        enviarAGestoria={enviarAGestoria}
        mensajeAdicional={mensajeAdicionalGestoria}
        archivosAdicionales={archivosGestoria}
        isRetrimitere={showEditModal && pdfEmployeeData ? true : false}
        onSuccess={handlePDFSuccess}
        onError={handlePDFError}
        showModal={showPDFModal}
        setShowModal={setShowPDFModal}
      />

      {/* Notificări moderne */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          show={notification.show}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Dialog de confirmare pentru resetare parolă */}
      {confirmResetPassword && confirmResetPassword.show && (
        <Notification
          type="warning"
          title="Resetear Contraseña"
          message={`¿Estás seguro de que deseas resetear la contraseña de ${confirmResetPassword.user['NOMBRE / APELLIDOS'] || confirmResetPassword.user.CODIGO}?\n\nSe generará una nueva contraseña temporal y se enviará por email.`}
          show={true}
          isConfirmDialog={true}
          confirmText="Sí, Resetear"
          cancelText="Cancelar"
          onConfirm={() => {
            executeResetPassword();
          }}
          onCancel={() => setConfirmResetPassword(null)}
        />
      )}
    </div>
  );
} 