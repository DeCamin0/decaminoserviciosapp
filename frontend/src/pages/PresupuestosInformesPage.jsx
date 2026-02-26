import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Card, Button, Input, Modal, Notification } from '../components/ui';
import AddressAutocomplete from '../components/AddressAutocomplete';
import Back3DButton from '../components/Back3DButton';
import { useNavigate } from 'react-router-dom';
import { routes } from '../utils/routes';
import { Edit2, Trash2, Plus, CheckCircle2, XCircle, Eye, Upload } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import QuillBetterTable from 'quill-better-table';
import 'quill-better-table/dist/quill-better-table.css';
import mammoth from 'mammoth';

// Register table module
if (!ReactQuill.Quill.imports['modules/better-table']) {
  ReactQuill.Quill.register('modules/better-table', QuillBetterTable);
}

export default function PresupuestosInformesPage() {
  useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('servicios');
  const [informesSubTab, setInformesSubTab] = useState('factura');
  const [informesItems, setInformesItems] = useState([]);
  const [loadingInformesItems, setLoadingInformesItems] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    item_id: '',
    nombre: '',
    descripcion: '',
    precio: '',
    observaciones: '',
    activo: true,
  });
  const [, setFacturaConfig] = useState(null);
  const [loadingFacturaConfig, setLoadingFacturaConfig] = useState(false);
  /** Cliente seleccionado en el tab Factura (para quién es el presupuesto) */
  const [facturaClienteId, setFacturaClienteId] = useState(null);
  const [facturaForm, setFacturaForm] = useState({
    tasa_iva: 21,
    tasa_descuento: 0,
    incluir_descripcion: true,
    filas_articulo: 3,
    titulo_empresa: 'DE CAMINO SERVICIOS AUXILIARES, S.L.',
    direccion_empresa: 'Avda. Euzkadi 14, Local 5',
    cp_poblacion_empresa: '28702 - San Sebastián de los Reyes',
    email_empresa: 'info@decaminoservicios.com',
    telefono_empresa: '645 111 999',
    informe_final_temporada: false,
  });
  /** Lista de presupuestos guardados cargada en tab Factura (para mostrar último Presupuesto nr del cliente) */
  const [facturaPresupuestosList, setFacturaPresupuestosList] = useState([]);
  /** Lista de informes guardados (informes_factura_config) para subtab Informes */
  const [informesList, setInformesList] = useState([]);
  const [loadingInformesList, setLoadingInformesList] = useState(false);
  /** Líneas de factura (items): Descripción, Precio unit., Cant. → Total por línea; SUB TOTAL, IVA, TOTAL */
  const [facturaLineas, setFacturaLineas] = useState([]); // [{ id, descripcion, precioUnitario, cantidad }, ...]
  /** Si estamos editando un informe existente (id) desde la lista Informes */
  const [editingInformeId, setEditingInformeId] = useState(null);

  const quillRefNombre = useRef(null);
  const quillRefDescripcion = useRef(null);
  const [modalKey, setModalKey] = useState(0);
  
  const [servicios, setServicios] = useState([]);
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [showServicioModal, setShowServicioModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewServicio, setPreviewServicio] = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);
  const [servicioForm, setServicioForm] = useState({
    nombre: '',
    descripcion_operativa: '',
    tipo: 'servicio_presupuesto',
    activo: true,
  });
  const [notification, setNotification] = useState(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableConfig, setTableConfig] = useState({ rows: 3, cols: 2 });
  
  // State pentru template-uri (plantillas)
  const [plantillas, setPlantillas] = useState([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [showPlantillaModal, setShowPlantillaModal] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState(null);
  const [plantillaForm, setPlantillaForm] = useState({
    nombre: '',
    descripcion_operativa: '',
    activo: true,
    servicios_seleccionados: [], // Array de ID-uri de servicii
  });

  // Estado para Presupuestos: formulario de cálculo (sistema COSTE 2026)
  const [showNuevoPresupuestoForm, setShowNuevoPresupuestoForm] = useState(false);
  // Modal: seleccionar servicio para el presupuesto (al pulsar Crear nuevo presupuesto)
  const [showModalSeleccionServicioPresupuesto, setShowModalSeleccionServicioPresupuesto] = useState(false);
  // Servicios elegidos para el presupuesto (pueden ser 1, 2 o los 3)
  const [selectedServiciosPresupuesto, setSelectedServiciosPresupuesto] = useState([]); // [{ id, nombre, ... }, ...]
  // En el modal: IDs de servicios con checkbox marcado (antes de Continuar)
  const [servicioSeleccionadosEnModal, setServicioSeleccionadosEnModal] = useState([]); // number[]
  // true cuando se abrió el modal con "Añadir otro servicio" → al Continuar hacemos merge en lugar de reemplazar
  const modalAnadirOtroServicioRef = useRef(false);
  // true cuando se abrió desde "Crear nuevo presupuesto piscina" → solo se elige cliente, servicio fijo piscina
  const [presupuestoPiscinaMode, setPresupuestoPiscinaMode] = useState(false);
  // Cliente del presupuesto: selección en el modal
  const [clientesList, setClientesList] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [presupuestoClienteId, setPresupuestoClienteId] = useState(null); // id (number) o null si es nuevo
  const [presupuestoClienteNombre, setPresupuestoClienteNombre] = useState(''); // nombre para mostrar (existente o nuevo)
  const [presupuestoClienteEsNuevo, setPresupuestoClienteEsNuevo] = useState(false);
  const [presupuestoClienteNuevoNombre, setPresupuestoClienteNuevoNombre] = useState('');
  // Dirección del cliente nuevo (para PDF; se guarda en payload)
  const [presupuestoClienteDireccion, setPresupuestoClienteDireccion] = useState('');
  const [presupuestoClienteCodigoPostal, setPresupuestoClienteCodigoPostal] = useState('');
  const [presupuestoClientePoblacion, setPresupuestoClientePoblacion] = useState('');
  const [presupuestoClienteProvincia, setPresupuestoClienteProvincia] = useState('');
  // Tipo(s) de servicio: se deducen de los elegidos → 'auxiliares' | 'limpieza' | 'jardineria'
  const [, setTipoServicioPresupuesto] = useState('auxiliares');
  const [presupuestoCalculo, setPresupuestoCalculo] = useState({
    nombre: '',
    convenioBase: 1221,
    horasDiarias: 8,
    diasPorSemana: 7,
    horasACubrirPorSemana: 168, // h/sem a cubrir → calculamos nº conserje necesarios
    aplicaNocturnidad: false,
    nocturnidad: { b: 0, c: 0.77 },
    aplicaFinDeSemana: false,
    finDeSemana: { b: 952, c: 0.22 },
    aplicaServiciosExtra: false,
    serviciosExtraHoras: 0,
    aplicaUniformidadAuto: true, // Nº empleados = floor(conserje), Nº uniformes = empleados + 1
    numEmpleadosManual: 0, // folosit când aplicaUniformidadAuto e false
    uniformidad: { b: 150, c: 2 },
    aplicaGestoriaAuto: true, // Nº empleados = floor(conserje)
    gestoria: { b: 120, c: 2 }, // b = precio, c = nº empleados (manual)
    productosLimpieza: { b: 30, c: 12 },
    limpiezaGajare: { b: 300, c: 0 },
    acristalado: { b: 125, c: 0 },
    cristalero: { b: 90, c: 0 },
    cubos: { b: 15, c: 0 },
    telefono: { b: 22, c: 1 },
    vigilancia: { b: 8.4, c: 1 },
    gastosFijoHoras: { b: 1.1, c: 0 },
    beneficioEmpresarial: { b: 0, c: 1 },
    extra: 0, // suma extra (€/mes) que se añade a totales en OFERTA ECONOMICA
  });

  // Variantes auxiliares: un calculo por cada entrada "auxiliares" además del primero (presupuestoCalculo)
  const [presupuestoCalculoAuxiliaresRest, setPresupuestoCalculoAuxiliaresRest] = useState([]);

  // Estado para bloque Limpieza (Datos base: convenio; operarias × h/día × días → B4; D4 = D2×12)
  const [presupuestoCalculoLimpieza, setPresupuestoCalculoLimpieza] = useState({
    convenioBase: 1485,
    numOperarias: 2,
    horasPorDiaPorOperaria: 4,
    diasLaborablesSemana: 5, // lunes a viernes
    serviciosExtraHoras: 12, // C12 — horas extra anual
    uniformidad: { b: 150, c: 2 }, // D20 = B×C
    gestoria: { b: 120, c: 2 }, // D22 = B×C
    productosLimpieza: { b: 150, c: 12 }, // D24 = B×C
    aplicaLimpiezaGajare: true, // D26 bifable, default bifat
    limpiezaGajare: { b: 450, c: 2 }, // D26 = B×C
    acristalado: { b: 250, c: 1 }, // D28 = B×C
    cristalero: { b: 90, c: 0 }, // D30 = B×C
    cubos: { b: 8, c: 0 }, // D32 = B×C
    telefono: { b: 22, c: 0 }, // D34 = B×C×12
    vigilancia: { b: 8.4, c: 2 }, // D36 = B×C×12
    gastosFijoHoras: { b: 1.1 }, // D38 = B38×B4×4.33×12, C38 = B4 (horas/sem)
    beneficioEmpresarial: { b: 150, c: 1 }, // D40 = B×C×12
    d48Manual: null, // D48 override: si está vacío se usa D48 calculado; si se rellena, Precio final = d48Manual×12
    extra: 0, // suma extra (€/mes) que se añade a totales en OFERTA ECONOMICA
  });
  const [presupuestoCalculoLimpiezaRest, setPresupuestoCalculoLimpiezaRest] = useState([]);

  // Estado para bloque Jardinería (calcul simple: precio sin IVA + IVA 21% automático)
  const [presupuestoCalculoJardineria, setPresupuestoCalculoJardineria] = useState({
    concepto: '',
    precioSinIva: '',
  });
  const [presupuestoCalculoJardineriaRest, setPresupuestoCalculoJardineriaRest] = useState([]);

  // Estado para Gestión Cubos de Basura (solo precio, como jardinería)
  const [presupuestoCalculoCubos, setPresupuestoCalculoCubos] = useState({
    concepto: 'Gestión cubos de basura',
    precioSinIva: '',
  });
  const [presupuestoCalculoCubosRest, setPresupuestoCalculoCubosRest] = useState([]);

  // Estado para Piscina (mantenimiento verano: horas, días, precio mensual, horarioPeriodos por variante)
  const [presupuestoCalculoPiscina, setPresupuestoCalculoPiscina] = useState({
    concepto: 'Mantenimiento integral en piscina comunitaria',
    horas: '',
    dias: '',
    precioSinIva: '',
    horarioPeriodos: [],
  });
  const [presupuestoCalculoPiscinaRest, setPresupuestoCalculoPiscinaRest] = useState([]);
  // Horario piscina (una sola vez al final del presupuesto, orientativo) — no por variante
  const [presupuestoHorarioPiscina, setPresupuestoHorarioPiscina] = useState([]);

  // Presupuestos guardados: listă, încărcare, editare, vista previa
  const [presupuestosGuardadosList, setPresupuestosGuardadosList] = useState([]);
  const [loadingPresupuestosGuardados, setLoadingPresupuestosGuardados] = useState(false);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [presupuestoGuardadoEditarId, setPresupuestoGuardadoEditarId] = useState(null); // id când edităm unul salvat
  const [showPresupuestoPreviewModal, setShowPresupuestoPreviewModal] = useState(false);
  const [previewPresupuestoNombre, setPreviewPresupuestoNombre] = useState('');
  // Modal Enviar Presupuesto por email
  const [showEnviarPresupuestoModal, setShowEnviarPresupuestoModal] = useState(false);
  const [enviarPresupuestoItem, setEnviarPresupuestoItem] = useState(null);
  const [enviarPresupuestoEmail, setEnviarPresupuestoEmail] = useState('');
  const [enviarPresupuestoMensaje, setEnviarPresupuestoMensaje] = useState('');
  const [sendingEnviarPresupuesto, setSendingEnviarPresupuesto] = useState(false);
  // Modal Enviar Informe por email
  const [showEnviarInformeModal, setShowEnviarInformeModal] = useState(false);
  const [enviarInformeItem, setEnviarInformeItem] = useState(null);
  const [enviarInformeEmail, setEnviarInformeEmail] = useState('');
  const [enviarInformeMensaje, setEnviarInformeMensaje] = useState('');
  const [sendingEnviarInforme, setSendingEnviarInforme] = useState(false);

  // Nombre en texto plano desde HTML (Quill)
  const servicioNombreTexto = (nombre) => {
    if (!nombre) return '';
    const s = String(nombre);
    if (s.startsWith('<')) {
      if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.innerHTML = s;
        return (div.textContent || div.innerText || '').trim();
      }
      return s.replace(/<[^>]*>/g, '').trim();
    }
    return s.trim();
  };
  // Derivar tipo de cálculo desde el nombre del servicio
  const derivarTipoDesdeServicio = (nombre) => {
    const n = servicioNombreTexto(nombre).toLowerCase();
    if (/limpieza/.test(n)) return 'limpieza';
    if (/jardin/.test(n)) return 'jardineria';
    if (/cubos|basura/.test(n)) return 'cubos';
    if (/piscina/.test(n)) return 'piscina';
    return 'auxiliares';
  };

  // Convertește listele numerotate (ol) în liste cu puncte (ul) în HTML
  const htmlListasNumeradasAPuntos = (html) => {
    if (!html || typeof html !== 'string') return html || '';
    return html
      .replace(/<ol(\s[^>]*)?>/gi, '<ul$1>')
      .replace(/<\/ol>/gi, '</ul>');
  };

  const fetchServicios = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const url = `${routes.getGruposCompletos}?tipo=servicio_presupuesto`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar servicios');
      }

      const data = await response.json();
      
      if (data.success && data.grupos) {
        // Sortează serviciile după ID (crescător)
        const sortedServicios = [...data.grupos].sort((a, b) => {
          return (a.id || 0) - (b.id || 0);
        });
        setServicios(sortedServicios);
      } else {
        setServicios([]);
      }
    } catch (error) {
      console.error('❌ Error fetching servicios:', error);
      setNotification({
        message: 'Error al cargar servicios',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Funcție pentru a încărca template-urile (plantillas)
  const fetchPlantillas = async () => {
    try {
      setLoadingPlantillas(true);
      const token = localStorage.getItem('auth_token');
      const url = routes.getPlantillas;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar plantillas');
      }

      const data = await response.json();
      
      if (data.success) {
        // Backend-ul returnează direct array-ul în data
        const sortedPlantillas = [...(data.data || [])].sort((a, b) => {
          return (a.id || 0) - (b.id || 0);
        });
        setPlantillas(sortedPlantillas);
      } else {
        setPlantillas([]);
      }
    } catch (error) {
      console.error('❌ Error fetching plantillas:', error);
      setNotification({
        message: 'Error al cargar plantillas',
        type: 'error',
      });
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const fetchPresupuestosGuardados = async () => {
    try {
      setLoadingPresupuestosGuardados(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getPresupuestosGuardados, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Error al cargar presupuestos guardados');
      const data = await response.json();
      setPresupuestosGuardadosList(data.data || []);
    } catch (error) {
      console.error('Error fetching presupuestos guardados:', error);
      setNotification({ message: 'Error al cargar presupuestos guardados', type: 'error' });
    } finally {
      setLoadingPresupuestosGuardados(false);
    }
  };

  // Normalizar Jardinería para evitar 500 → 499,98 (float / JSON): precioSinIva siempre como string
  const normalizarJardineriaParaPayload = (j) => {
    if (!j) return j;
    const precio = j.precioSinIva;
    const precioStr =
      typeof precio === 'number'
        ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
        : (precio ?? '');
    return { ...j, precioSinIva: precioStr, concepto: j.concepto ?? '' };
  };

  const normalizarCubosParaPayload = (c) => {
    if (!c) return c;
    const precio = c.precioSinIva;
    const precioStr =
      typeof precio === 'number'
        ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
        : (precio ?? '');
    return { ...c, precioSinIva: precioStr, concepto: c.concepto ?? 'Gestión cubos de basura' };
  };
  // Convierte YYYY-MM-DD (input date) a DD/MM para el PDF
  const dateToDDMM = (yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '';
    const parts = yyyyMmDd.trim().split('-');
    if (parts.length !== 3) return yyyyMmDd;
    const [, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}`;
  };
  // Convierte DD/MM o YYYY-MM-DD a YYYY-MM-DD para <input type="date"> (año actual si solo DD/MM)
  const toDateInputValue = (val) => {
    if (!val || typeof val !== 'string') return '';
    const v = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const match = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!match) return '';
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3] || new Date().getFullYear();
    return `${y}-${m}-${d}`;
  };
  // Construye string horario para PDF desde los 4 campos de tiempo
  const buildHorarioString = (t1d, t1h, t2d, t2h) => {
    const a = [t1d, t1h].filter(Boolean).join(' - ');
    const b = [t2d, t2h].filter(Boolean).join(' - ');
    if (a && b) return `${a} / ${b}`;
    return a || b || '';
  };
  // Días entre fechaDesde y fechaHasta (YYYY-MM-DD), inclusivo; devuelve null si falta alguna
  const diasEntreFechas = (fechaDesde, fechaHasta) => {
    if (!fechaDesde || !fechaHasta || typeof fechaDesde !== 'string' || typeof fechaHasta !== 'string') return null;
    const d1 = new Date(fechaDesde.trim());
    const d2 = new Date(fechaHasta.trim());
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : null;
  };
  // Horas entre dos horas "HH:MM"; devuelve null si falta alguna o es inválida
  const horasEntreHoras = (desde, hasta) => {
    if (!desde || !hasta || typeof desde !== 'string' || typeof hasta !== 'string') return null;
    const toMins = (h) => {
      const parts = h.trim().split(':');
      if (parts.length < 2) return null;
      const m = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      return Number.isNaN(m) ? null : m;
    };
    const m1 = toMins(desde);
    const m2 = toMins(hasta);
    if (m1 == null || m2 == null) return null;
    const diff = m2 - m1;
    return diff >= 0 ? Math.round((diff / 60) * 10) / 10 : null;
  };

  // Parsea "12:00 - 15:00 / 16:30 - 21:30" a { turn1Desde, turn1Hasta, turn2Desde, turn2Hasta }
  const parseHorarioString = (s) => {
    if (!s || typeof s !== 'string') return { turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' };
    const parts = s.split('/').map((x) => x.trim());
    const [p1, p2] = parts;
    const parseTurn = (str) => {
      const m = (str || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      return m ? { desde: m[1].length === 4 ? '0' + m[1] : m[1], hasta: m[2].length === 4 ? '0' + m[2] : m[2] } : { desde: '', hasta: '' };
    };
    const t1 = parseTurn(p1);
    const t2 = p2 ? parseTurn(p2) : { desde: '', hasta: '' };
    return { turn1Desde: t1.desde, turn1Hasta: t1.hasta, turn2Desde: t2.desde, turn2Hasta: t2.hasta };
  };

  const normalizarPiscinaParaPayload = (p) => {
    if (!p) return p;
    const precioNum = parsePrecioEurosSpanish(p.precioSinIva);
    const precioStr = Number.isInteger(precioNum) ? String(precioNum) : precioNum.toFixed(2);
    const horas = p.horas != null && p.horas !== '' ? Number(p.horas) : undefined;
    const dias = p.dias != null && p.dias !== '' ? Number(p.dias) : undefined;
    const horarioPeriodos = (p.horarioPeriodos || []).map((periodo) => {
      const fechaDesde = (periodo.fechaDesde || '').trim();
      const fechaHasta = (periodo.fechaHasta || '').trim();
      const horario = periodo.turn1Desde != null || periodo.turn1Hasta != null || periodo.turn2Desde != null || periodo.turn2Hasta != null
        ? buildHorarioString(periodo.turn1Desde, periodo.turn1Hasta, periodo.turn2Desde, periodo.turn2Hasta)
        : (periodo.horario || '').trim();
      return {
        fechaDesde: fechaDesde ? (fechaDesde.includes('-') ? dateToDDMM(fechaDesde) : fechaDesde) : '',
        fechaHasta: fechaHasta ? (fechaHasta.includes('-') ? dateToDDMM(fechaHasta) : fechaHasta) : '',
        horario,
      };
    }).filter((h) => h.fechaDesde || h.fechaHasta || h.horario);
    return {
      ...p,
      precioSinIva: precioStr,
      concepto: p.concepto ?? 'Mantenimiento integral en piscina comunitaria',
      horas: horas,
      dias: dias,
      horarioPeriodos,
    };
  };
  const descripcionPiscina = (calc) => {
    const h = calc?.horas != null && calc?.horas !== '';
    const d = calc?.dias != null && calc?.dias !== '';
    if (h && d) return `Mantenimiento verano: ${calc.horas} horas – ${calc.dias} días`;
    return (calc?.concepto && String(calc.concepto).trim()) || 'Mantenimiento integral en piscina comunitaria';
  };
  // Formato español: punto = miles, coma = decimal (12.600 = 12600; 1.234,56 = 1234.56)
  const parsePrecioEurosSpanish = (val) => {
    if (val == null || val === '') return 0;
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    const s = String(val).trim().replace(/\s/g, '');
    if (!s) return 0;
    const sinMiles = s.replace(/\./g, '');
    const conDecimal = sinMiles.replace(',', '.');
    const n = parseFloat(conDecimal);
    return Number.isNaN(n) ? 0 : n;
  };

  const buildOfertaEconomica = () => {
    return selectedServiciosPresupuesto.map((s, index) => {
      const tipo = derivarTipoDesdeServicio(s.nombre);
      const variantIndexAuxiliares = tipo === 'auxiliares'
        ? selectedServiciosPresupuesto.slice(0, index).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'auxiliares').length
        : 0;
      let descripcion = servicioNombreTexto(s.nombre);
      let mensualidadSinIva = 0, mensualidadConIva = 0, anualidadSinIva = 0, anualidadConIva = 0;
      if (tipo === 'auxiliares') {
        const calcAux = presupuestoCalculoAuxiliaresAll[variantIndexAuxiliares];
        const resAux = presupuestoResultadoAuxiliares[variantIndexAuxiliares];
        const extraAux = (calcAux && calcAux.extra) ?? 0;
        descripcion = `${servicioNombreTexto(s.nombre)} – ${(calcAux && calcAux.horasDiarias) || 0}h/día los 365 días`;
        mensualidadSinIva = (resAux ? resAux.D52 : 0) + extraAux;
        anualidadSinIva = (resAux ? resAux.precioFinalACliente : 0) + extraAux * 12;
        mensualidadConIva = mensualidadSinIva * 1.21;
        anualidadConIva = anualidadSinIva * 1.21;
      } else if (tipo === 'limpieza') {
        const variantIndexLimpieza = selectedServiciosPresupuesto.slice(0, index).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'limpieza').length;
        const calcLimp = presupuestoCalculoLimpiezaAll[variantIndexLimpieza];
        const resLimp = presupuestoResultadoLimpiezaAll[variantIndexLimpieza];
        const extraLimp = (calcLimp && calcLimp.extra) ?? 0;
        descripcion = `Limpieza - ${(resLimp && resLimp.descripcionLimpieza) || ''}`;
        mensualidadSinIva = (resLimp ? resLimp.D48 : 0) + extraLimp;
        anualidadSinIva = (resLimp ? resLimp.D48 : 0) * 12 + extraLimp * 12;
        mensualidadConIva = mensualidadSinIva * 1.21;
        anualidadConIva = anualidadSinIva * 1.21;
      } else if (tipo === 'jardineria') {
        const variantIndexJardineria = selectedServiciosPresupuesto.slice(0, index).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'jardineria').length;
        const calcJard = presupuestoCalculoJardineriaAll[variantIndexJardineria];
        const precioSinIvaMes = parseFloat(calcJard?.precioSinIva) || 0;
        descripcion = calcJard?.concepto ? `Jardinería - ${calcJard.concepto}` : 'Jardinería';
        mensualidadSinIva = precioSinIvaMes;
        mensualidadConIva = precioSinIvaMes * 1.21;
        anualidadSinIva = precioSinIvaMes * 12;
        anualidadConIva = precioSinIvaMes * 12 * 1.21;
      } else if (tipo === 'cubos') {
        const variantIndexCubos = selectedServiciosPresupuesto.slice(0, index).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'cubos').length;
        const calcCubos = presupuestoCalculoCubosAll[variantIndexCubos];
        const precioSinIvaMes = parseFloat(calcCubos?.precioSinIva) || 0;
        descripcion = calcCubos?.concepto ? `Gestión cubos - ${calcCubos.concepto}` : 'Gestión cubos de basura';
        mensualidadSinIva = precioSinIvaMes;
        mensualidadConIva = precioSinIvaMes * 1.21;
        anualidadSinIva = precioSinIvaMes * 12;
        anualidadConIva = precioSinIvaMes * 12 * 1.21;
      } else if (tipo === 'piscina') {
        const variantIndexPiscina = selectedServiciosPresupuesto.slice(0, index).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'piscina').length;
        const calcPiscina = presupuestoCalculoPiscinaAll[variantIndexPiscina];
        const precioSinIvaMes = parsePrecioEurosSpanish(calcPiscina?.precioSinIva);
        descripcion = `Piscina - ${descripcionPiscina(calcPiscina)}`;
        mensualidadSinIva = precioSinIvaMes;
        mensualidadConIva = precioSinIvaMes * 1.21;
        anualidadSinIva = precioSinIvaMes * 12;
        anualidadConIva = precioSinIvaMes * 12 * 1.21;
      }
      return { descripcion, mensualidadSinIva, mensualidadConIva, anualidadSinIva, anualidadConIva };
    });
  };

  const buildPayload = () => ({
    selectedServiciosPresupuesto,
    presupuestoCalculo,
    presupuestoCalculoAuxiliaresRest,
    presupuestoCalculoLimpieza,
    presupuestoCalculoLimpiezaRest,
    presupuestoCalculoJardineria: normalizarJardineriaParaPayload(presupuestoCalculoJardineria),
    presupuestoCalculoJardineriaRest: presupuestoCalculoJardineriaRest.map(normalizarJardineriaParaPayload),
    presupuestoCalculoCubos: normalizarCubosParaPayload(presupuestoCalculoCubos),
    presupuestoCalculoCubosRest: presupuestoCalculoCubosRest.map(normalizarCubosParaPayload),
    presupuestoCalculoPiscina: normalizarPiscinaParaPayload(presupuestoCalculoPiscina),
    presupuestoCalculoPiscinaRest: presupuestoCalculoPiscinaRest.map(normalizarPiscinaParaPayload),
    presupuestoHorarioPiscina: (presupuestoHorarioPiscina || []).map((p) => ({
      fechaDesde: (p.fechaDesde || '').trim() ? (p.fechaDesde.includes('-') ? dateToDDMM(p.fechaDesde) : p.fechaDesde.trim()) : '',
      fechaHasta: (p.fechaHasta || '').trim() ? (p.fechaHasta.includes('-') ? dateToDDMM(p.fechaHasta) : p.fechaHasta.trim()) : '',
      horario: buildHorarioString(p.turn1Desde, p.turn1Hasta, p.turn2Desde, p.turn2Hasta) || (p.horario || '').trim(),
    })).filter((h) => h.fechaDesde || h.fechaHasta || h.horario),
    presupuestoClienteId,
    presupuestoClienteNombre,
    presupuestoClienteEsNuevo,
    presupuestoClienteNuevoNombre,
    presupuestoClienteDireccion: presupuestoClienteDireccion?.trim() || '',
    presupuestoClienteCodigoPostal: presupuestoClienteCodigoPostal?.trim() || '',
    presupuestoClientePoblacion: presupuestoClientePoblacion?.trim() || '',
    presupuestoClienteProvincia: presupuestoClienteProvincia?.trim() || '',
    ofertaEconomica: buildOfertaEconomica(),
  });

  const handleGuardarPresupuesto = async () => {
    const clienteNombre = presupuestoClienteEsNuevo ? presupuestoClienteNuevoNombre : presupuestoClienteNombre;
    const clientePart = (clienteNombre || '').trim() || 'Cliente';
    const serviciosPart = selectedServiciosPresupuesto.length
      ? selectedServiciosPresupuesto.map((s) => servicioNombreTexto(s.nombre)).join(', ')
      : 'Servicios';
    // Sempre salvar en formato: DE CAMINO - PRESUPUESTO 2026 - cliente - servicios
    const nombre = `DE CAMINO - PRESUPUESTO ${new Date().getFullYear()} - ${clientePart} - ${serviciosPart}`;
    const payload = buildPayload();
    try {
      setSavingPresupuesto(true);
      const token = localStorage.getItem('auth_token');
      const body = {
        nombre,
        cliente_id: presupuestoClienteId ?? null,
        cliente_nombre: (clienteNombre || '').trim() || null,
        payload,
      };
      if (presupuestoGuardadoEditarId) {
        const response = await fetch(routes.updatePresupuestoGuardado(presupuestoGuardadoEditarId), {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Error al actualizar presupuesto');
        setNotification({ message: 'Presupuesto actualizado correctamente', type: 'success' });
        fetchPresupuestosGuardados();
        // Al actualizar no cerramos el formulario ni borramos la selección (queda editando con ambos servicios)
      } else {
        const response = await fetch(routes.createPresupuestoGuardado, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Error al guardar presupuesto');
        const data = await response.json();
        if (data.data?.id) setPresupuestoGuardadoEditarId(data.data.id);
        setNotification({ message: 'Presupuesto guardado correctamente', type: 'success' });
        fetchPresupuestosGuardados();
        setShowNuevoPresupuestoForm(false);
        setSelectedServiciosPresupuesto([]);
        setPresupuestoGuardadoEditarId(null);
      }
    } catch (error) {
      setNotification({ message: error.message || 'Error al guardar presupuesto', type: 'error' });
    } finally {
      setSavingPresupuesto(false);
    }
  };

  const handleCargarPresupuesto = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getPresupuestoGuardado(id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al cargar presupuesto');
      const data = await response.json();
      const p = data.data?.payload || {};
      setSelectedServiciosPresupuesto(p.selectedServiciosPresupuesto || []);
      if (p.presupuestoCalculo) setPresupuestoCalculo(p.presupuestoCalculo);
      if (Array.isArray(p.presupuestoCalculoAuxiliaresRest)) {
        setPresupuestoCalculoAuxiliaresRest(p.presupuestoCalculoAuxiliaresRest);
      } else {
        const list = p.selectedServiciosPresupuesto || [];
        const nAux = list.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'auxiliares').length;
        if (nAux > 1 && p.presupuestoCalculo) {
          setPresupuestoCalculoAuxiliaresRest(Array(nAux - 1).fill(null).map(() => ({ ...p.presupuestoCalculo })));
        } else {
          setPresupuestoCalculoAuxiliaresRest([]);
        }
      }
      if (p.presupuestoCalculoLimpieza) setPresupuestoCalculoLimpieza(p.presupuestoCalculoLimpieza);
      if (Array.isArray(p.presupuestoCalculoLimpiezaRest)) {
        setPresupuestoCalculoLimpiezaRest(p.presupuestoCalculoLimpiezaRest);
      } else {
        const listL = p.selectedServiciosPresupuesto || [];
        const nLimp = listL.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'limpieza').length;
        if (nLimp > 1 && p.presupuestoCalculoLimpieza) {
          setPresupuestoCalculoLimpiezaRest(Array(nLimp - 1).fill(null).map(() => ({ ...p.presupuestoCalculoLimpieza })));
        } else {
          setPresupuestoCalculoLimpiezaRest([]);
        }
      }
      if (p.presupuestoCalculoJardineria) {
        const j = p.presupuestoCalculoJardineria;
        const precio = j.precioSinIva;
        const precioStr =
          typeof precio === 'number'
            ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
            : (String(precio ?? '').trim());
        setPresupuestoCalculoJardineria({
          concepto: j.concepto ?? '',
          precioSinIva: precioStr,
        });
      }
      if (Array.isArray(p.presupuestoCalculoJardineriaRest)) {
        setPresupuestoCalculoJardineriaRest(p.presupuestoCalculoJardineriaRest.map((j) => {
          const precio = j.precioSinIva;
          const precioStr = typeof precio === 'number' ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2)) : (String(precio ?? '').trim());
          return { concepto: j.concepto ?? '', precioSinIva: precioStr };
        }));
      } else {
        const list = p.selectedServiciosPresupuesto || [];
        const nJard = list.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'jardineria').length;
        if (nJard > 1 && p.presupuestoCalculoJardineria) {
          const j = p.presupuestoCalculoJardineria;
          const precioStr = typeof j.precioSinIva === 'number' ? (Number.isInteger(j.precioSinIva) ? String(j.precioSinIva) : j.precioSinIva.toFixed(2)) : (String(j.precioSinIva ?? '').trim());
          setPresupuestoCalculoJardineriaRest(Array(nJard - 1).fill(null).map(() => ({ concepto: j.concepto ?? '', precioSinIva: precioStr })));
        } else {
          setPresupuestoCalculoJardineriaRest([]);
        }
      }
      if (p.presupuestoCalculoCubos) {
        const c = p.presupuestoCalculoCubos;
        const precio = c.precioSinIva;
        const precioStr =
          typeof precio === 'number'
            ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
            : (String(precio ?? '').trim());
        setPresupuestoCalculoCubos({
          concepto: c.concepto ?? 'Gestión cubos de basura',
          precioSinIva: precioStr,
        });
      }
      if (Array.isArray(p.presupuestoCalculoCubosRest)) {
        setPresupuestoCalculoCubosRest(p.presupuestoCalculoCubosRest.map((c) => {
          const precio = c.precioSinIva;
          const precioStr = typeof precio === 'number' ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2)) : (String(precio ?? '').trim());
          return { concepto: c.concepto ?? 'Gestión cubos de basura', precioSinIva: precioStr };
        }));
      } else {
        const listC = p.selectedServiciosPresupuesto || [];
        const nCubos = listC.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'cubos').length;
        if (nCubos > 1 && p.presupuestoCalculoCubos) {
          const c = p.presupuestoCalculoCubos;
          const precioStr = typeof c.precioSinIva === 'number' ? (Number.isInteger(c.precioSinIva) ? String(c.precioSinIva) : c.precioSinIva.toFixed(2)) : (String(c.precioSinIva ?? '').trim());
          setPresupuestoCalculoCubosRest(Array(nCubos - 1).fill(null).map(() => ({ concepto: c.concepto ?? 'Gestión cubos de basura', precioSinIva: precioStr })));
        } else {
          setPresupuestoCalculoCubosRest([]);
        }
      }
      if (p.presupuestoCalculoPiscina) {
        const pi = p.presupuestoCalculoPiscina;
        const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
        setPresupuestoCalculoPiscina({
          concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
          horas: pi.horas ?? '',
          dias: pi.dias ?? '',
          precioSinIva: precioStr,
          horarioPeriodos: Array.isArray(pi.horarioPeriodos) ? pi.horarioPeriodos.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }) : [],
        });
      }
      if (Array.isArray(p.presupuestoCalculoPiscinaRest)) {
        setPresupuestoCalculoPiscinaRest(p.presupuestoCalculoPiscinaRest.map((pi) => {
          const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
          return {
            concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
            horas: pi.horas ?? '',
            dias: pi.dias ?? '',
            precioSinIva: precioStr,
            horarioPeriodos: Array.isArray(pi.horarioPeriodos) ? pi.horarioPeriodos.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }) : [],
          };
        }));
      } else {
        const listPi = p.selectedServiciosPresupuesto || [];
        const nPiscina = listPi.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'piscina').length;
        if (nPiscina > 1 && p.presupuestoCalculoPiscina) {
          const pi = p.presupuestoCalculoPiscina;
          const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
          setPresupuestoCalculoPiscinaRest(Array(nPiscina - 1).fill(null).map(() => ({
            concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
            horas: pi.horas ?? '',
            dias: pi.dias ?? '',
            precioSinIva: precioStr,
            horarioPeriodos: [],
          })));
        } else {
          setPresupuestoCalculoPiscinaRest([]);
        }
      }
      if (Array.isArray(p.presupuestoHorarioPiscina)) {
        setPresupuestoHorarioPiscina(p.presupuestoHorarioPiscina.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }));
      } else {
        setPresupuestoHorarioPiscina([]);
      }
      if (p.presupuestoClienteId !== undefined) setPresupuestoClienteId(p.presupuestoClienteId);
      if (p.presupuestoClienteNombre !== undefined) setPresupuestoClienteNombre(p.presupuestoClienteNombre);
      if (p.presupuestoClienteEsNuevo !== undefined) setPresupuestoClienteEsNuevo(p.presupuestoClienteEsNuevo);
      if (p.presupuestoClienteNuevoNombre !== undefined) setPresupuestoClienteNuevoNombre(p.presupuestoClienteNuevoNombre);
      if (p.presupuestoClienteDireccion !== undefined) setPresupuestoClienteDireccion(p.presupuestoClienteDireccion || '');
      if (p.presupuestoClienteCodigoPostal !== undefined) setPresupuestoClienteCodigoPostal(p.presupuestoClienteCodigoPostal || '');
      if (p.presupuestoClientePoblacion !== undefined) setPresupuestoClientePoblacion(p.presupuestoClientePoblacion || '');
      if (p.presupuestoClienteProvincia !== undefined) setPresupuestoClienteProvincia(p.presupuestoClienteProvincia || '');
      // Si el cliente es existente (no nuevo), cargar dirección desde API clientes para mostrarla
      const clienteId = p.presupuestoClienteId != null && p.presupuestoClienteId !== '' ? Number(p.presupuestoClienteId) : null;
      if (clienteId != null && !p.presupuestoClienteEsNuevo) {
        try {
          const resClientes = await fetch(routes.getClientes, { headers: { Authorization: `Bearer ${token}` } });
          const dataClientes = await resClientes.json();
          const list = Array.isArray(dataClientes) ? dataClientes : (dataClientes?.data ?? []);
          const cliente = list.find((c) => Number(c.id) === clienteId);
          if (cliente) {
            setPresupuestoClienteDireccion(cliente.DIRECCION ?? '');
            setPresupuestoClienteCodigoPostal(cliente.CODIGO_POSTAL ?? '');
            setPresupuestoClientePoblacion(cliente.POBLACION ?? '');
            setPresupuestoClienteProvincia(cliente.PROVINCIA ?? '');
          }
        } catch {
          // ignore
        }
      }
      setPresupuestoGuardadoEditarId(id);
      setShowNuevoPresupuestoForm(true);
      setNotification({ message: 'Presupuesto cargado. Puedes editarlo y pulsar Actualizar.', type: 'success' });
    } catch (error) {
      setNotification({ message: error.message || 'Error al cargar presupuesto', type: 'error' });
    }
  };

  const handleEliminarPresupuesto = async (id) => {
    if (!window.confirm('¿Eliminar este presupuesto guardado?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.deletePresupuestoGuardado(id), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Error al eliminar');
      setPresupuestosGuardadosList((prev) => prev.filter((x) => x.id !== id));
      if (presupuestoGuardadoEditarId === id) setPresupuestoGuardadoEditarId(null);
      setNotification({ message: 'Presupuesto eliminado', type: 'success' });
    } catch (error) {
      setNotification({ message: error.message || 'Error al eliminar', type: 'error' });
    }
  };

  const handleGenerarPresupuesto = async (item, format = 'docx') => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getPresupuestoGenerarDocumento(item.id, format), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error al generar documento');
      }
      const blob = await response.blob();
      const nombreSanit = (item.nombre || '').trim().replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200);
      const ext = format === 'pdf' ? '.pdf' : '.docx';
      let filename = nombreSanit ? `${nombreSanit}${ext}` : (format === 'pdf' ? 'Presupuesto.pdf' : 'Presupuesto.docx');
      const disp = response.headers.get('Content-Disposition');
      if (disp) {
        const match = disp.match(/filename\*=(?:UTF-8'')([^";\n]+)/i) || disp.match(/filename="([^"]+)"/);
        if (match && match[1]) filename = decodeURIComponent(match[1].trim());
      }
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('wordprocessingml') && filename.endsWith('.pdf'))
        filename = filename.slice(0, -4) + '.docx';
      if (contentType.includes('pdf') && filename.endsWith('.docx'))
        filename = filename.slice(0, -5) + '.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotification({ message: format === 'pdf' ? 'PDF descargado' : 'Documento descargado', type: 'success' });
    } catch (error) {
      setNotification({ message: error.message || 'Error al generar presupuesto', type: 'error' });
    }
  };

  const handleVerPdfFirmado = async (item) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getPresupuestoPdfFirmado(item.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 404) {
          setNotification({ message: 'No hay PDF firmado disponible para este presupuesto', type: 'error' });
          return;
        }
        throw new Error('Error al cargar PDF firmado');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = `presupuesto-firmado-${item.numero_presupuesto || item.id}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotification({ message: 'PDF firmado descargado', type: 'success' });
    } catch (error) {
      setNotification({ message: error.message || 'Error al descargar PDF firmado', type: 'error' });
    }
  };

  const handleOpenEnviarPresupuesto = (item) => {
    const cliente = item.cliente_id != null ? clientesList.find((c) => Number(c.id) === Number(item.cliente_id)) : null;
    const email = cliente?.EMAIL ?? cliente?.email ?? '';
    setEnviarPresupuestoItem(item);
    setEnviarPresupuestoEmail(email);
    setShowEnviarPresupuestoModal(true);
  };

  const handleEnviarPresupuestoSubmit = async () => {
    if (!enviarPresupuestoItem || !enviarPresupuestoEmail.trim()) {
      setNotification({ message: 'Introduce la dirección de email', type: 'error' });
      return;
    }
    setSendingEnviarPresupuesto(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(routes.enviarPresupuestoEmail(enviarPresupuestoItem.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: enviarPresupuestoEmail.trim(), mensaje: enviarPresupuestoMensaje.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Error al enviar el presupuesto por email');
      }
      setNotification({ message: data.message || 'Presupuesto enviado correctamente', type: 'success' });
      setShowEnviarPresupuestoModal(false);
      setEnviarPresupuestoItem(null);
      setEnviarPresupuestoEmail('');
      setEnviarPresupuestoMensaje('');
    } catch (e) {
      setNotification({ message: e.message || 'Error al enviar', type: 'error' });
    } finally {
      setSendingEnviarPresupuesto(false);
    }
  };

  const handleOpenEnviarInforme = (inf) => {
    const cliente = inf.cliente_id != null ? clientesList.find((c) => Number(c.id) === Number(inf.cliente_id)) : null;
    const email = cliente?.EMAIL ?? cliente?.email ?? inf.email_empresa ?? '';
    setEnviarInformeItem(inf);
    setEnviarInformeEmail(email);
    setShowEnviarInformeModal(true);
  };

  const handleEnviarInformeSubmit = async () => {
    if (!enviarInformeItem || !enviarInformeEmail.trim()) {
      setNotification({ message: 'Introduce la dirección de email', type: 'error' });
      return;
    }
    setSendingEnviarInforme(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(routes.enviarInformeEmail(enviarInformeItem.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: enviarInformeEmail.trim(), mensaje: enviarInformeMensaje.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Error al enviar el informe por email');
      }
      setNotification({ message: data.message || 'Informe enviado correctamente', type: 'success' });
      setShowEnviarInformeModal(false);
      setEnviarInformeItem(null);
      setEnviarInformeEmail('');
      setEnviarInformeMensaje('');
    } catch (e) {
      setNotification({ message: e.message || 'Error al enviar', type: 'error' });
    } finally {
      setSendingEnviarInforme(false);
    }
  };

  const handlePreviuPresupuesto = async (item) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getPresupuestoGuardado(item.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al cargar presupuesto');
      const data = await response.json();
      const p = data.data?.payload || {};
      setSelectedServiciosPresupuesto(p.selectedServiciosPresupuesto || []);
      if (p.presupuestoCalculo) setPresupuestoCalculo(p.presupuestoCalculo);
      if (Array.isArray(p.presupuestoCalculoAuxiliaresRest)) {
        setPresupuestoCalculoAuxiliaresRest(p.presupuestoCalculoAuxiliaresRest);
      } else {
        const list = p.selectedServiciosPresupuesto || [];
        const nAux = list.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'auxiliares').length;
        if (nAux > 1 && p.presupuestoCalculo) {
          setPresupuestoCalculoAuxiliaresRest(Array(nAux - 1).fill(null).map(() => ({ ...p.presupuestoCalculo })));
        } else {
          setPresupuestoCalculoAuxiliaresRest([]);
        }
      }
      if (p.presupuestoCalculoLimpieza) setPresupuestoCalculoLimpieza(p.presupuestoCalculoLimpieza);
      if (Array.isArray(p.presupuestoCalculoLimpiezaRest)) {
        setPresupuestoCalculoLimpiezaRest(p.presupuestoCalculoLimpiezaRest);
      } else {
        const listL = p.selectedServiciosPresupuesto || [];
        const nLimp = listL.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'limpieza').length;
        if (nLimp > 1 && p.presupuestoCalculoLimpieza) {
          setPresupuestoCalculoLimpiezaRest(Array(nLimp - 1).fill(null).map(() => ({ ...p.presupuestoCalculoLimpieza })));
        } else {
          setPresupuestoCalculoLimpiezaRest([]);
        }
      }
      if (p.presupuestoCalculoJardineria) {
        const j = p.presupuestoCalculoJardineria;
        const precio = j.precioSinIva;
        const precioStr =
          typeof precio === 'number'
            ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
            : (String(precio ?? '').trim());
        setPresupuestoCalculoJardineria({ concepto: j.concepto ?? '', precioSinIva: precioStr });
      }
      if (Array.isArray(p.presupuestoCalculoJardineriaRest)) {
        setPresupuestoCalculoJardineriaRest(p.presupuestoCalculoJardineriaRest.map((j) => {
          const precio = j.precioSinIva;
          const precioStr = typeof precio === 'number' ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2)) : (String(precio ?? '').trim());
          return { concepto: j.concepto ?? '', precioSinIva: precioStr };
        }));
      } else {
        const list = p.selectedServiciosPresupuesto || [];
        const nJard = list.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'jardineria').length;
        if (nJard > 1 && p.presupuestoCalculoJardineria) {
          const j = p.presupuestoCalculoJardineria;
          const precioStr = typeof j.precioSinIva === 'number' ? (Number.isInteger(j.precioSinIva) ? String(j.precioSinIva) : j.precioSinIva.toFixed(2)) : (String(j.precioSinIva ?? '').trim());
          setPresupuestoCalculoJardineriaRest(Array(nJard - 1).fill(null).map(() => ({ concepto: j.concepto ?? '', precioSinIva: precioStr })));
        } else {
          setPresupuestoCalculoJardineriaRest([]);
        }
      }
      if (p.presupuestoCalculoCubos) {
        const c = p.presupuestoCalculoCubos;
        const precio = c.precioSinIva;
        const precioStr =
          typeof precio === 'number'
            ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2))
            : (String(precio ?? '').trim());
        setPresupuestoCalculoCubos({
          concepto: c.concepto ?? 'Gestión cubos de basura',
          precioSinIva: precioStr,
        });
      }
      if (Array.isArray(p.presupuestoCalculoCubosRest)) {
        setPresupuestoCalculoCubosRest(p.presupuestoCalculoCubosRest.map((c) => {
          const precio = c.precioSinIva;
          const precioStr = typeof precio === 'number' ? (Number.isInteger(precio) ? String(precio) : precio.toFixed(2)) : (String(precio ?? '').trim());
          return { concepto: c.concepto ?? 'Gestión cubos de basura', precioSinIva: precioStr };
        }));
      } else {
        const listC = p.selectedServiciosPresupuesto || [];
        const nCubos = listC.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'cubos').length;
        if (nCubos > 1 && p.presupuestoCalculoCubos) {
          const c = p.presupuestoCalculoCubos;
          const precioStr = typeof c.precioSinIva === 'number' ? (Number.isInteger(c.precioSinIva) ? String(c.precioSinIva) : c.precioSinIva.toFixed(2)) : (String(c.precioSinIva ?? '').trim());
          setPresupuestoCalculoCubosRest(Array(nCubos - 1).fill(null).map(() => ({ concepto: c.concepto ?? 'Gestión cubos de basura', precioSinIva: precioStr })));
        } else {
          setPresupuestoCalculoCubosRest([]);
        }
      }
      if (p.presupuestoCalculoPiscina) {
        const pi = p.presupuestoCalculoPiscina;
        const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
        setPresupuestoCalculoPiscina({
          concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
          horas: pi.horas ?? '',
          dias: pi.dias ?? '',
          precioSinIva: precioStr,
          horarioPeriodos: Array.isArray(pi.horarioPeriodos) ? pi.horarioPeriodos.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }) : [],
        });
      }
      if (Array.isArray(p.presupuestoCalculoPiscinaRest)) {
        setPresupuestoCalculoPiscinaRest(p.presupuestoCalculoPiscinaRest.map((pi) => {
          const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
          return {
            concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
            horas: pi.horas ?? '',
            dias: pi.dias ?? '',
            precioSinIva: precioStr,
            horarioPeriodos: Array.isArray(pi.horarioPeriodos) ? pi.horarioPeriodos.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }) : [],
          };
        }));
      } else {
        const listPi = p.selectedServiciosPresupuesto || [];
        const nPiscina = listPi.filter((s) => derivarTipoDesdeServicio(s.nombre) === 'piscina').length;
        if (nPiscina > 1 && p.presupuestoCalculoPiscina) {
          const pi = p.presupuestoCalculoPiscina;
          const precioStr = typeof pi.precioSinIva === 'number' ? (Number.isInteger(pi.precioSinIva) ? String(pi.precioSinIva) : pi.precioSinIva.toFixed(2)) : (String(pi.precioSinIva ?? '').trim());
          setPresupuestoCalculoPiscinaRest(Array(nPiscina - 1).fill(null).map(() => ({
            concepto: pi.concepto ?? 'Mantenimiento integral en piscina comunitaria',
            horas: pi.horas ?? '',
            dias: pi.dias ?? '',
            precioSinIva: precioStr,
            horarioPeriodos: [],
          })));
        } else {
          setPresupuestoCalculoPiscinaRest([]);
        }
      }
      if (Array.isArray(p.presupuestoHorarioPiscina)) {
        setPresupuestoHorarioPiscina(p.presupuestoHorarioPiscina.map((h) => {
          const turns = parseHorarioString(h.horario);
          return {
            fechaDesde: toDateInputValue(h.fechaDesde ?? ''),
            fechaHasta: toDateInputValue(h.fechaHasta ?? ''),
            horario: h.horario ?? '',
            ...turns,
          };
        }));
      } else {
        setPresupuestoHorarioPiscina([]);
      }
      if (p.presupuestoClienteId !== undefined) setPresupuestoClienteId(p.presupuestoClienteId);
      if (p.presupuestoClienteNombre !== undefined) setPresupuestoClienteNombre(p.presupuestoClienteNombre);
      if (p.presupuestoClienteEsNuevo !== undefined) setPresupuestoClienteEsNuevo(p.presupuestoClienteEsNuevo);
      if (p.presupuestoClienteNuevoNombre !== undefined) setPresupuestoClienteNuevoNombre(p.presupuestoClienteNuevoNombre);
      setPreviewPresupuestoNombre(item.nombre || '');
      setShowPresupuestoPreviewModal(true);
    } catch (error) {
      setNotification({ message: error.message || 'Error al cargar vista previa', type: 'error' });
    }
  };

  useEffect(() => {
    if (activeTab === 'servicios') {
      fetchServicios();
    } else if (activeTab === 'plantillas') {
      fetchPlantillas();
      fetchServicios(); // Necesităm serviciile pentru a le selecta în template
    } else if (activeTab === 'presupuestos') {
      fetchServicios(); // Para poder elegir servicio en el modal "Crear nuevo presupuesto"
      fetchPresupuestosGuardados();
      // Cargar clientes para poder rellenar el email en el modal "Enviar Presupuesto"
      const token = localStorage.getItem('auth_token');
      fetch(routes.getClientes, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setClientesList(Array.isArray(data) ? data : (data?.data ?? [])))
        .catch(() => setClientesList([]));
    } else if (activeTab === 'clientes') {
      setLoadingClientes(true);
      const token = localStorage.getItem('auth_token');
      fetch(routes.getClientes, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setClientesList(Array.isArray(data) ? data : (data?.data ?? [])))
        .catch(() => setClientesList([]))
        .finally(() => setLoadingClientes(false));
    }
  }, [activeTab]);

  const fetchInformesItems = async () => {
    setLoadingInformesItems(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getInformesItems, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al cargar ítems');
      const json = await response.json();
      setInformesItems(json.data || []);
    } catch (e) {
      setNotification({ message: e.message || 'Error al cargar lista de ítems', type: 'error' });
      setInformesItems([]);
    } finally {
      setLoadingInformesItems(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'informes' && (informesSubTab === 'items' || informesSubTab === 'factura')) {
      fetchInformesItems();
    }
  }, [activeTab, informesSubTab]);

  const fetchFacturaConfig = async () => {
    setLoadingFacturaConfig(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(routes.getInformesFacturaConfig, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar configuración');
      const json = await res.json();
      const d = json.data || {};
      setFacturaConfig(d);
      // No cargar lo guardado en el formulario: el tab Factura debe empezar siempre vacío.
      // Los datos guardados solo se muestran en el subtab Informes.
    } catch (e) {
      setNotification({ message: e.message || 'Error al cargar configuración factura', type: 'error' });
    } finally {
      setLoadingFacturaConfig(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'informes') {
      const token = localStorage.getItem('auth_token');
      // Factura y Informes comparten config y clientes
      if (informesSubTab === 'factura' || informesSubTab === 'informes') {
        fetchFacturaConfig();
        setLoadingClientes(informesSubTab === 'factura');
        if (informesSubTab === 'informes') setLoadingInformesList(true);
        fetch(routes.getClientes, { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => setClientesList(Array.isArray(data) ? data : (data?.data ?? [])))
          .catch(() => setClientesList([]))
          .finally(() => {
            if (informesSubTab === 'factura') setLoadingClientes(false);
          });
      }
      if (informesSubTab === 'informes') {
        fetch(routes.getInformesFacturaConfigList, { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => (res.ok ? res.json() : {}))
          .then((data) => setInformesList(Array.isArray(data?.data) ? data.data : []))
          .catch(() => setInformesList([]))
          .finally(() => setLoadingInformesList(false));
      }
      // Solo en Factura: cargar presupuestos guardados (para último nr del cliente)
      if (informesSubTab === 'factura') {
        fetch(routes.getPresupuestosGuardados, { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => (res.ok ? res.json() : {}))
          .then((data) => setFacturaPresupuestosList(data?.data ?? []))
          .catch(() => setFacturaPresupuestosList([]));
      }
    }
  }, [activeTab, informesSubTab]);

  const saveFacturaConfig = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const lineasParaGuardar = facturaLineas.map((l) => ({
        id: l.id,
        itemId: l.itemId ?? null,
        nombre: l.nombre ?? '',
        descripcion: l.descripcion ?? '',
        precioUnitario: l.precioUnitario,
        cantidad: l.cantidad ?? 1,
      }));
      const body = {
        ...facturaForm,
        cliente_id: facturaClienteId ?? null,
        lineas_json: lineasParaGuardar,
      };
      const url = editingInformeId ? routes.updateInformeById(editingInformeId) : routes.createInformeFacturaConfig;
      const method = editingInformeId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setNotification({
        message: editingInformeId ? 'Informe actualizado correctamente.' : 'Informe guardado correctamente. Aparecerá en la lista del subtab Informes.',
        type: 'success',
      });
      setEditingInformeId(null);
      const refreshList = () => {
        fetch(routes.getInformesFacturaConfigList, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : {}))
          .then((data) => setInformesList(Array.isArray(data?.data) ? data.data : []))
          .catch(() => {});
      };
      if (activeTab === 'informes' && informesSubTab === 'informes') refreshList();
    } catch (e) {
      setNotification({ message: e.message || 'Error al guardar informe', type: 'error' });
    }
  };

  const handleEditInforme = async (inf) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(routes.getInformeById(inf.id), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al cargar informe');
      const json = await res.json();
      const d = json.data || {};
      setFacturaForm({
        tasa_iva: Number.isFinite(Number(d.tasa_iva)) ? Number(d.tasa_iva) : 21,
        tasa_descuento: Number.isFinite(Number(d.tasa_descuento)) ? Number(d.tasa_descuento) : 0,
        incluir_descripcion: d.incluir_descripcion ?? true,
        filas_articulo: Number.isFinite(Number(d.filas_articulo)) ? Number(d.filas_articulo) : 3,
        titulo_empresa: (d.titulo_empresa && String(d.titulo_empresa).trim()) ? d.titulo_empresa : facturaForm.titulo_empresa,
        direccion_empresa: (d.direccion_empresa && String(d.direccion_empresa).trim()) ? d.direccion_empresa : facturaForm.direccion_empresa,
        cp_poblacion_empresa: (d.cp_poblacion_empresa && String(d.cp_poblacion_empresa).trim()) ? d.cp_poblacion_empresa : facturaForm.cp_poblacion_empresa,
        email_empresa: (d.email_empresa && String(d.email_empresa).trim()) ? d.email_empresa : facturaForm.email_empresa,
        telefono_empresa: (d.telefono_empresa && String(d.telefono_empresa).trim()) ? d.telefono_empresa : facturaForm.telefono_empresa,
        informe_final_temporada: !!d.informe_final_temporada,
      });
      setFacturaClienteId(d.cliente_id != null ? Number(d.cliente_id) : null);
      const lineas = d.lineas_json;
      if (Array.isArray(lineas) && lineas.length > 0) {
        setFacturaLineas(lineas.map((l, i) => ({
          id: l.id ?? Date.now() + i,
          itemId: l.itemId ?? null,
          nombre: l.nombre ?? '',
          descripcion: l.descripcion ?? '',
          precioUnitario: l.precioUnitario ?? '',
          cantidad: l.cantidad ?? 1,
        })));
      } else {
        setFacturaLineas([]);
      }
      setEditingInformeId(inf.id);
      setInformesSubTab('factura');
    } catch (e) {
      setNotification({ message: e.message || 'Error al cargar informe', type: 'error' });
    }
  };

  const handleDeleteInforme = async (id) => {
    if (!window.confirm('¿Eliminar este informe?')) return;
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(routes.deleteInformeById(id), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al eliminar');
      setNotification({ message: 'Informe eliminado.', type: 'success' });
      fetch(routes.getInformesFacturaConfigList, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : {}))
        .then((data) => setInformesList(Array.isArray(data?.data) ? data.data : []))
        .catch(() => {});
    } catch (e) {
      setNotification({ message: e.message || 'Error al eliminar informe', type: 'error' });
    }
  };

  const handleDownloadInformePdf = async (id) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(routes.getInformePdf(id), { headers: { Authorization: `Bearer ${token}` } });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setNotification({ message: 'PDF descargado.', type: 'success' });
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setNotification({ message: json.message || 'Error al descargar PDF', type: 'error' });
        return;
      }
      setNotification({ message: 'Descarga de PDF próximamente.', type: 'info' });
    } catch (e) {
      setNotification({ message: e.message || 'Error al descargar PDF', type: 'error' });
    }
  };

  const handleDownloadInformePdfFirmado = async (id) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(routes.getInformePdfFirmado(id), { headers: { Authorization: `Bearer ${token}` } });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-${id}-firmado.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setNotification({ message: 'PDF firmado descargado.', type: 'success' });
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setNotification({ message: json.message || 'No hay PDF firmado.', type: 'error' });
      }
    } catch (e) {
      setNotification({ message: e.message || 'Error al descargar PDF firmado', type: 'error' });
    }
  };

  const openModalNuevoItem = () => {
    setEditingItem(null);
    setItemForm({
      item_id: '',
      nombre: '',
      descripcion: '',
      precio: '',
      observaciones: '',
      activo: true,
    });
    setShowItemModal(true);
  };

  const openModalEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      item_id: item.item_id,
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      precio: item.precio != null ? String(item.precio) : '',
      observaciones: item.observaciones || '',
      activo: item.activo ?? true,
    });
    setShowItemModal(true);
  };

  const saveItemForm = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      if (editingItem) {
        const payload = {
          nombre: itemForm.nombre.trim(),
          descripcion: itemForm.descripcion.trim() || null,
          precio: Number(itemForm.precio),
          observaciones: itemForm.observaciones.trim() || null,
          activo: itemForm.activo,
        };
        const response = await fetch(routes.updateInformesItem(editingItem.id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Error al actualizar ítem');
        }
        setNotification({ message: 'Ítem actualizado correctamente', type: 'success' });
      } else {
        if (!itemForm.item_id.trim() || !itemForm.nombre.trim()) {
          setNotification({ message: 'ID e Nombre son obligatorios', type: 'error' });
          return;
        }
        const payload = {
          item_id: itemForm.item_id.trim(),
          nombre: itemForm.nombre.trim(),
          descripcion: itemForm.descripcion.trim() || null,
          precio: Number(itemForm.precio) || 0,
          observaciones: itemForm.observaciones.trim() || null,
          activo: itemForm.activo,
        };
        const response = await fetch(routes.createInformesItem, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Error al crear ítem');
        }
        setNotification({ message: 'Ítem creado correctamente', type: 'success' });
      }
      setShowItemModal(false);
      fetchInformesItems();
    } catch (e) {
      setNotification({ message: e.message || 'Error al guardar ítem', type: 'error' });
    }
  };

  // Suprimă warning-ul findDOMNode din ReactQuill
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) {
        return; // Suprimă acest warning specific
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) {
        return; // Suprimă acest error specific
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Reset modal key when modal opens or editingServicio changes to force ReactQuill remount
  useEffect(() => {
    if (showServicioModal) {
      setModalKey(prev => prev + 1);
    }
  }, [showServicioModal, editingServicio?.id]);

  // Cargar clientes al abrir el modal de selección de servicios
  useEffect(() => {
    if (!showModalSeleccionServicioPresupuesto) return;
    let cancelled = false;
    setLoadingClientes(true);
    fetch(routes.getClientes, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (!cancelled) setClientesList(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setClientesList([]); })
      .finally(() => { if (!cancelled) setLoadingClientes(false); });
    return () => { cancelled = true; };
  }, [showModalSeleccionServicioPresupuesto]);

  // En modo piscina, asegurar que exista el servicio de piscina (crearlo si no está)
  const piscinaServiceEnsureRef = useRef(false);
  useEffect(() => {
    if (!showModalSeleccionServicioPresupuesto || !presupuestoPiscinaMode) {
      piscinaServiceEnsureRef.current = false;
      return;
    }
    const hasPiscina = servicios.some((s) => servicioNombreTexto(s.nombre).toLowerCase().includes('piscina'));
    if (hasPiscina) return;
    if (piscinaServiceEnsureRef.current) return;
    piscinaServiceEnsureRef.current = true;
    createPiscinaServicio();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when piscina needed; createPiscinaServicio is stable enough
  }, [showModalSeleccionServicioPresupuesto, presupuestoPiscinaMode, servicios]);

  // Fin de semana B = horasDiarias×2×52 + horasDiarias×15 — actualizar B cuando cambian horas diarias (si está aplicado)
  useEffect(() => {
    if (!presupuestoCalculo.aplicaFinDeSemana) return;
    const h = Number(presupuestoCalculo.horasDiarias) || 0;
    const bAuto = h * 2 * 52 + h * 15;
    setPresupuestoCalculo(prev => {
      if (prev.finDeSemana.b === bAuto) return prev;
      return { ...prev, finDeSemana: { ...prev.finDeSemana, b: bAuto } };
    });
  }, [presupuestoCalculo.horasDiarias, presupuestoCalculo.aplicaFinDeSemana]);

  // Función pura: resultado auxiliares a partir de un objeto calculo (para variantes)
  const calcResultadoAuxiliares = (p) => {
    if (!p) return { B4: 0, numConserjeNecesarios: 0, numEmpleados: 0, numUniformes: 0, numEmpleadosGestoria: 0, horasACubrirPorSemana: 0, D4: 0, D6: 0, D8: 0, D10: 0, D12: 0, D14: 0, C16: 0, D16: 0, D18: 0, D20: 0, D22: 0, D24: 0, D26: 0, D28: 0, D30: 0, D32: 0, D34: 0, D36: 0, D38: 0, D40: 0, D42: 0, D44: 0, D46: 0, D48: 0, D50: 0, D52: 0, precioFinalACliente: 0, costeTotalEmpleadoMesUnifGestoria: 0 };
    const D2 = Number(p.convenioBase) || 0;
    const B4 = (Number(p.horasDiarias) || 0) * (Number(p.diasPorSemana) || 0);
    const horasACubrir = Number(p.horasACubrirPorSemana) || 168;
    const HORAS_SEMANALES_MAX_LEGAL = 40;
    const numConserjeNecesarios = HORAS_SEMANALES_MAX_LEGAL > 0 ? horasACubrir / HORAS_SEMANALES_MAX_LEGAL : 0;
    const D4 = D2 * 14;
    const D6 = (D4 / 40) * B4;
    const D8 = D6 / 12;
    const D10 = D8 / 12;
    const D12 = p.aplicaNocturnidad ? (p.nocturnidad.b ?? 0) * (p.nocturnidad.c ?? 0) : 0;
    const B14 = (p.finDeSemana.b ?? 0);
    const C14 = (p.finDeSemana.c ?? 0);
    const D14 = p.aplicaFinDeSemana ? B14 * C14 : 0;
    const C16 = D6 / 156;
    const B16 = Number(p.serviciosExtraHoras) || 0;
    const D16 = p.aplicaServiciosExtra ? B16 * C16 : 0;
    const D18 = D6 + D8 + D10 + D12 + D14 + D16;
    const D20 = (D6 + D8 + D10) * 0.37;
    const D22 = D18 + D20;
    const numEmpleados = p.aplicaUniformidadAuto ? Math.floor(numConserjeNecesarios) : (Number(p.numEmpleadosManual) || 0);
    const numUniformes = p.aplicaUniformidadAuto ? numEmpleados + 1 : (Number(p.uniformidad.c) || 0);
    const D24 = (p.uniformidad.b ?? 0) * numUniformes;
    const numEmpleadosGestoria = p.aplicaGestoriaAuto ? Math.floor(numConserjeNecesarios) : (Number(p.gestoria.c) || 0);
    const D26 = (p.gestoria.b ?? 0) * numEmpleadosGestoria;
    const D28 = (p.productosLimpieza.b ?? 0) * (p.productosLimpieza.c ?? 0);
    const D30 = (p.limpiezaGajare.b ?? 0) * (p.limpiezaGajare.c ?? 0);
    const D32 = (p.acristalado.b ?? 0) * (p.acristalado.c ?? 0);
    const D34 = (p.cristalero.b ?? 0) * (p.cristalero.c ?? 0);
    const D36 = (p.cubos.b ?? 0) * (p.cubos.c ?? 0);
    const D38 = (p.telefono.b ?? 0) * (p.telefono.c ?? 0) * 12;
    const D40 = (p.vigilancia.b ?? 0) * (p.vigilancia.c ?? 0) * 12;
    const D42 = (p.gastosFijoHoras.b ?? 0) * (p.gastosFijoHoras.c ?? 0) * 4.33 * 12;
    const D44 = (p.beneficioEmpresarial.c ?? 0) * (p.beneficioEmpresarial.b ?? 0) * 12;
    const D46 = D24 + D26 + D28 + D30 + D32 + D34 + D36 + D38 + D40 + D42 + D44;
    const D48 = (D22 + D46) * 0.21;
    const D50 = D22 + D46 + D48;
    const D52 = D50 / 1.21 / 12;
    const precioFinalACliente = D52 * 12;
    const costeTotalEmpleadoMesUnifGestoria = D22 / 12 + (D24 + D26) / 12;
    return { B4, numConserjeNecesarios, numEmpleados, numUniformes, numEmpleadosGestoria, horasACubrirPorSemana: horasACubrir, D4, D6, D8, D10, D12, D14, C16, D16, D18, D20, D22, D24, D26, D28, D30, D32, D34, D36, D38, D40, D42, D44, D46, D48, D50, D52, precioFinalACliente, costeTotalEmpleadoMesUnifGestoria };
  };

  const presupuestoCalculoAuxiliaresAll = useMemo(() => [presupuestoCalculo, ...presupuestoCalculoAuxiliaresRest], [presupuestoCalculo, presupuestoCalculoAuxiliaresRest]);
  const presupuestoResultadoAuxiliares = useMemo(() => presupuestoCalculoAuxiliaresAll.map(calcResultadoAuxiliares), [presupuestoCalculoAuxiliaresAll]);

  const presupuestoCalculoJardineriaAll = useMemo(() => [presupuestoCalculoJardineria, ...presupuestoCalculoJardineriaRest], [presupuestoCalculoJardineria, presupuestoCalculoJardineriaRest]);

  const presupuestoCalculoCubosAll = useMemo(() => [presupuestoCalculoCubos, ...presupuestoCalculoCubosRest], [presupuestoCalculoCubos, presupuestoCalculoCubosRest]);

  const presupuestoCalculoPiscinaAll = useMemo(() => [presupuestoCalculoPiscina, ...presupuestoCalculoPiscinaRest], [presupuestoCalculoPiscina, presupuestoCalculoPiscinaRest]);

  const presupuestoCalculoLimpiezaAll = useMemo(() => [presupuestoCalculoLimpieza, ...presupuestoCalculoLimpiezaRest], [presupuestoCalculoLimpieza, presupuestoCalculoLimpiezaRest]);

  const calcResultadoLimpieza = (p) => {
    if (!p) return { D46: 0, D48: 0, d48ParaPrecio: 0, precioFinalACliente: 0, descripcionLimpieza: '' };
    const B4 = (p.numOperarias || 0) * (p.horasPorDiaPorOperaria || 0) * (p.diasLaborablesSemana || 0);
    const D4 = (p.convenioBase || 0) * 12;
    const D6 = B4 > 0 ? (D4 / 39) * B4 : 0;
    const D8 = D6 / 12 / 30 * 31;
    const D10 = D8 / 12;
    const D12 = (D6 > 0 ? D6 / 156 : 0) * (p.serviciosExtraHoras ?? 0);
    const D14 = D6 + D8 + D10 + D12;
    const D16 = (D6 + D8 + D10) * 0.35;
    const D18 = D14 + D16;
    const D20 = (p.uniformidad?.b ?? 150) * (p.uniformidad?.c ?? 2);
    const D22 = (p.gestoria?.b ?? 120) * (p.gestoria?.c ?? 2);
    const D24 = (p.productosLimpieza?.b ?? 150) * (p.productosLimpieza?.c ?? 12);
    const D26 = p.aplicaLimpiezaGajare ? (p.limpiezaGajare?.b ?? 450) * (p.limpiezaGajare?.c ?? 2) : 0;
    const D28 = (p.acristalado?.b ?? 250) * (p.acristalado?.c ?? 1);
    const D30 = (p.cristalero?.b ?? 90) * (p.cristalero?.c ?? 0);
    const D32 = (p.cubos?.b ?? 8) * (p.cubos?.c ?? 0);
    const D34 = (p.telefono?.b ?? 22) * (p.telefono?.c ?? 0) * 12;
    const D36 = (p.vigilancia?.b ?? 8.4) * (p.vigilancia?.c ?? 2) * 12;
    const D38 = (p.gastosFijoHoras?.b ?? 1.1) * B4 * 4.33 * 12;
    const D40 = (p.beneficioEmpresarial?.b ?? 150) * (p.beneficioEmpresarial?.c ?? 1) * 12;
    const D42 = D20 + D22 + D24 + D26 + D28 + D30 + D32 + D34 + D36 + D38 + D40;
    const D44 = (D18 + D42) * 0.21;
    const D46 = D18 + D42 + D44;
    const D48 = D46 / 1.21 / 12 + 1.98;
    const d48ManualNum = p.d48Manual != null && p.d48Manual !== '' ? Number(p.d48Manual) : NaN;
    const d48ParaPrecio = (!isNaN(d48ManualNum) && d48ManualNum >= 0) ? d48ManualNum : D48;
    const precioFinalACliente = d48ParaPrecio * 12;
    const numOp = p.numOperarias || 0;
    const horasTot = numOp * (p.horasPorDiaPorOperaria || 0);
    const descripcion = `${numOp} operaria${numOp !== 1 ? 's' : ''}, ${horasTot}h de lunes a viernes (festivo no incluido)`;
    return { D46, D48, d48ParaPrecio, precioFinalACliente, descripcionLimpieza: descripcion };
  };
  const presupuestoResultadoLimpiezaAll = useMemo(() => presupuestoCalculoLimpiezaAll.map(calcResultadoLimpieza), [presupuestoCalculoLimpiezaAll]);

  // Populează editorii ReactQuill când se deschide modalul pentru editare
  useEffect(() => {
    if (showServicioModal && editingServicio && servicioForm.nombre) {
      // Așteaptă ca ReactQuill să fie montat complet
      const timer = setTimeout(() => {
        if (quillRefNombre.current) {
          const quillNombre = quillRefNombre.current.getEditor();
          if (quillNombre) {
            // Șterge conținutul existent și setează cel nou
            quillNombre.setContents([]);
            quillNombre.clipboard.dangerouslyPasteHTML(0, servicioForm.nombre);
          }
        }
        if (quillRefDescripcion.current) {
          const quillDescripcion = quillRefDescripcion.current.getEditor();
          if (quillDescripcion && servicioForm.descripcion_operativa) {
            // Șterge conținutul existent și setează cel nou
            quillDescripcion.setContents([]);
            quillDescripcion.clipboard.dangerouslyPasteHTML(0, servicioForm.descripcion_operativa);
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when modal/key changes to avoid overwriting form while typing
  }, [showServicioModal, editingServicio?.id, modalKey]);

  // Add tooltips to toolbar buttons
  useEffect(() => {
    if (!showServicioModal) return;

    const addTooltips = () => {
      // Tooltips pentru Nombre toolbar
      const nombreToolbar = document.querySelector('.quill-wrapper-nombre .ql-toolbar');
      if (nombreToolbar) {
        const nombreButtons = nombreToolbar.querySelectorAll('button, .ql-picker');
        nombreButtons.forEach(btn => {
          const classes = btn.className || '';
          if (classes.includes('ql-bold')) btn.setAttribute('title', 'Negrita (Ctrl+B)');
          else if (classes.includes('ql-italic')) btn.setAttribute('title', 'Cursiva (Ctrl+I)');
          else if (classes.includes('ql-underline')) btn.setAttribute('title', 'Subrayado (Ctrl+U)');
          else if (classes.includes('ql-color')) btn.setAttribute('title', 'Color de texto');
          else if (classes.includes('ql-clean')) btn.setAttribute('title', 'Limpiar formato');
        });
      }

      // Tooltips pentru Descripción toolbar
      const descripcionToolbar = document.querySelector('.quill-wrapper-descripcion .ql-toolbar');
      if (descripcionToolbar) {
        const descripcionButtons = descripcionToolbar.querySelectorAll('button, .ql-picker');
        descripcionButtons.forEach(btn => {
          const classes = btn.className || '';
          if (classes.includes('ql-header')) btn.setAttribute('title', 'Tamaño de texto');
          else if (classes.includes('ql-bold')) btn.setAttribute('title', 'Negrita (Ctrl+B)');
          else if (classes.includes('ql-italic')) btn.setAttribute('title', 'Cursiva (Ctrl+I)');
          else if (classes.includes('ql-underline')) btn.setAttribute('title', 'Subrayado (Ctrl+U)');
          else if (classes.includes('ql-strike')) btn.setAttribute('title', 'Tachado');
          else if (classes.includes('ql-list') && btn.getAttribute('value') === 'ordered') btn.setAttribute('title', 'Lista numerada');
          else if (classes.includes('ql-list') && btn.getAttribute('value') === 'bullet') btn.setAttribute('title', 'Lista con viñetas');
          else if (classes.includes('ql-indent') && btn.getAttribute('value') === '-1') btn.setAttribute('title', 'Disminuir sangría');
          else if (classes.includes('ql-indent') && btn.getAttribute('value') === '+1') btn.setAttribute('title', 'Aumentar sangría');
          else if (classes.includes('ql-color')) btn.setAttribute('title', 'Color de texto');
          else if (classes.includes('ql-background')) btn.setAttribute('title', 'Color de fondo');
          else if (classes.includes('ql-align')) btn.setAttribute('title', 'Alineación de texto');
          else if (classes.includes('ql-link')) btn.setAttribute('title', 'Insertar enlace');
          else if (classes.includes('ql-addTable')) btn.setAttribute('title', 'Añadir tabla');
          else if (classes.includes('ql-clean')) btn.setAttribute('title', 'Limpiar formato');
        });
      }
    };

    // Adaugă tooltips după ce editorii sunt montați
    const timeout1 = setTimeout(addTooltips, 200);
    const timeout2 = setTimeout(addTooltips, 500);
    const timeout3 = setTimeout(addTooltips, 1000);
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [showServicioModal, modalKey]);

  // Populează editorii ReactQuill când se deschide modalul pentru editare plantilla
  useEffect(() => {
    if (showPlantillaModal && editingPlantilla && plantillaForm.nombre) {
      // Așteaptă ca ReactQuill să fie montat complet
      const timer = setTimeout(() => {
        if (quillRefNombre.current) {
          const quillNombre = quillRefNombre.current.getEditor();
          if (quillNombre) {
            // Șterge conținutul existent și setează cel nou
            quillNombre.setContents([]);
            setTimeout(() => {
              try {
                quillNombre.clipboard.dangerouslyPasteHTML(0, plantillaForm.nombre, 'user');
              } catch (err) {
                console.warn('⚠️ Error pasting plantilla nombre HTML:', err);
                quillNombre.clipboard.dangerouslyPasteHTML(0, plantillaForm.nombre, 'user');
              }
            }, 50);
          }
        }
        if (quillRefDescripcion.current) {
          const quillDescripcion = quillRefDescripcion.current.getEditor();
          if (quillDescripcion && plantillaForm.descripcion_operativa) {
            // Șterge conținutul existent și setează cel nou
            quillDescripcion.setContents([]);
            setTimeout(() => {
              try {
                quillDescripcion.clipboard.dangerouslyPasteHTML(0, plantillaForm.descripcion_operativa, 'user');
              } catch (err) {
                console.warn('⚠️ Error pasting plantilla descripcion HTML:', err);
                quillDescripcion.clipboard.dangerouslyPasteHTML(0, plantillaForm.descripcion_operativa, 'user');
              }
            }, 50);
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when modal/key changes to avoid overwriting form while typing
  }, [showPlantillaModal, editingPlantilla?.id, modalKey]);

  // Memoize modules pentru a preveni re-render-uri inutile
  const nombreModules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }],
      ['clean']
    ],
  }), []);

  // Funcție pentru inserarea tabelului
  const insertTable = (rows, cols) => {
    console.log('🔧 insertTable called with:', { rows, cols });
    try {
      const quill = quillRefDescripcion.current?.getEditor();
      if (!quill) {
        console.warn('⚠️ Quill editor not found');
            return;
          }

      // Obține selecția curentă
      let range = quill.getSelection(true);
      let insertIndex = 0;

      if (range && range.index !== null && range.index >= 0) {
        insertIndex = range.index;
      } else {
        const length = quill.getLength();
        insertIndex = Math.max(0, length - 1);
      }

      // Încearcă să folosească API-ul better-table direct
      const betterTableModule = quill.getModule('better-table');
      console.log('🔍 Better-table module:', betterTableModule);
      console.log('🔍 Better-table methods:', Object.keys(betterTableModule || {}));
      
      // Setează selecția înainte de a insera tabelul
      quill.setSelection(insertIndex, 0, 'user');
      
      if (betterTableModule) {
        // Verifică dacă există metoda insertTable
        if (typeof betterTableModule.insertTable === 'function') {
          console.log('📤 Using better-table.insertTable API');
          try {
            // Folosește API-ul better-table pentru a insera tabelul
            betterTableModule.insertTable(rows, cols);
            console.log('✅ Table inserted using better-table API');
            
            // Verifică dacă tabelul a fost inserat
            setTimeout(() => {
              const tables = quill.root.querySelectorAll('table, .qlbt-table');
              console.log('🔍 Tables after insertion:', tables.length);
              if (tables.length > 0) {
                console.log('✅ Table found in editor');
                const firstTable = tables[0];
                firstTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
                // Forțează vizibilitatea
                firstTable.style.display = 'table';
                firstTable.style.visibility = 'visible';
                firstTable.style.border = '2px solid #333';
                firstTable.style.width = '100%';
              } else {
                console.warn('⚠️ Table not found after better-table.insertTable');
                // Fallback la HTML
                console.log('📤 Falling back to HTML method');
                insertTableHTML(quill, insertIndex, rows, cols);
              }
            }, 300);
            return;
          } catch (error) {
            console.warn('⚠️ Error using better-table API:', error);
            // Fallback la HTML
            console.log('📤 Falling back to HTML method after error');
            insertTableHTML(quill, insertIndex, rows, cols);
            return;
          }
        } else {
          console.warn('⚠️ better-table.insertTable is not a function');
          console.log('📤 Available methods:', Object.getOwnPropertyNames(betterTableModule));
        }
      }
      
      // Fallback: folosește HTML direct
      console.log('📤 Inserting table using HTML method (fallback)');
      insertTableHTML(quill, insertIndex, rows, cols);
      
      // Verifică dacă tabelul a fost inserat corect
      setTimeout(() => {
        quill.update();
        const editorContent = quill.root.innerHTML;
        const hasTable = editorContent.includes('<table') || editorContent.includes('ql-table') || editorContent.includes('qlbt-table');
        console.log('🔍 Table check:', { hasTable, contentLength: editorContent.length });
        if (hasTable) {
          console.log('✅ Table found in editor content');
        } else {
          console.warn('⚠️ Table not found in editor content');
          console.log('📄 Editor content sample:', editorContent.substring(0, 500));
        }
      }, 300);

      // Plasează cursorul în prima celulă
      setTimeout(() => {
        try {
          if (!quillRefDescripcion.current) return;
          const currentQuill = quillRefDescripcion.current.getEditor();
          if (!currentQuill) return;

          const length = currentQuill.getLength();
          const newIndex = Math.min(insertIndex + 5, length - 1);

          if (newIndex >= 0 && newIndex < length) {
            currentQuill.setSelection(newIndex, 0, 'user');
          }
        } catch (error) {
          console.warn('⚠️ Error setting cursor:', error);
        }
      }, 150);
    } catch (error) {
      console.warn('⚠️ Error inserting table:', error);
    }
  };
  
  // Funcție helper pentru a crea HTML-ul tabelului (fără better-table classes)
  const createTableHTML = (rows, cols) => {
    // Folosim tabel HTML standard, fără clasele better-table care transformă structura
    // Quill va accepta tabelul dacă este HTML valid
    let html = '<table style="width: 100%; border-collapse: collapse; margin: 15px 0; border: 2px solid #333; background: white; display: table;"><tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr style="display: table-row;">';
      for (let j = 0; j < cols; j++) {
        html += '<td style="border: 2px solid #333; padding: 12px; min-width: 100px; min-height: 40px; vertical-align: top; width: ' + (100 / cols) + '%; background: white; display: table-cell;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  };
  
  // Funcție helper pentru a insera tabelul HTML
  const insertTableHTML = (quill, insertIndex, rows, cols) => {
    const tableHTML = createTableHTML(rows, cols);
    console.log('📤 Inserting table HTML at index:', insertIndex);
    console.log('📄 Table HTML:', tableHTML.substring(0, 200));
    
    try {
      // Folosim dangerouslyPasteHTML pentru a insera tabelul
      // dar mai întâi setăm cursorul la poziția corectă
      const length = quill.getLength();
      const safeIndex = Math.min(insertIndex, length - 1);
      
      // Setăm selecția la poziția de inserare
      quill.setSelection(safeIndex, 0, 'user');
      
      // Inserează tabelul folosind clipboard-ul Quill
      // Acest lucru va permite Quill să proceseze tabelul corect
      quill.clipboard.dangerouslyPasteHTML(safeIndex, tableHTML);
      
      console.log('✅ Table inserted using dangerouslyPasteHTML');
      
      // Verifică dacă tabelul este vizibil după inserare
      setTimeout(() => {
        const tables = quill.root.querySelectorAll('table');
        console.log('🔍 Tables after insertion:', tables.length);
        
        if (tables.length > 0) {
          const firstTable = tables[0];
          const allCells = firstTable.querySelectorAll('td');
          const allRows = firstTable.querySelectorAll('tr');
          
          console.log('🔍 Table structure after insertion:', {
            cells: allCells.length,
            rows: allRows.length,
            tableHTML: firstTable.outerHTML.substring(0, 400)
          });
          
          // Forțează vizibilitatea pentru tabel și toate elementele
          firstTable.style.display = 'table';
          firstTable.style.visibility = 'visible';
          firstTable.style.opacity = '1';
          firstTable.style.border = '2px solid #333';
          firstTable.style.background = 'white';
          firstTable.style.width = '100%';
          firstTable.style.borderCollapse = 'collapse';
          
          // Forțează vizibilitatea pentru toate celulele
          allCells.forEach((cell) => {
            cell.style.display = 'table-cell';
            cell.style.visibility = 'visible';
            cell.style.opacity = '1';
            cell.style.border = '2px solid #333';
            cell.style.background = 'white';
            cell.style.padding = '12px';
            cell.style.minWidth = '100px';
            cell.style.minHeight = '40px';
          });
          
          // Forțează vizibilitatea pentru toate rândurile
          allRows.forEach((row) => {
            row.style.display = 'table-row';
            row.style.visibility = 'visible';
            row.style.opacity = '1';
          });
          
          // Scroll la tabel
          firstTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          
          console.log('✅ Table visibility forced');
    } else {
          console.warn('⚠️ Table not found after insertion');
        }
      }, 200);
    } catch (error) {
      console.warn('⚠️ Error inserting table:', error);
    }
  };

  const descripcionModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link'],
        ['addTable'],
        ['clean']
      ],
      handlers: {
        'addTable': function() {
          console.log('🔧 addTable handler called');
          // Deschide dialog-ul pentru selectarea numărului de coloane și rânduri
          setShowTableDialog(true);
        }
      }
    },
    table: false,
    'better-table': {
      operationMenu: {
        items: {
          unmergeCells: { text: 'Deshacer combinación de celdas' },
          insertColumnLeft: { text: 'Insertar columna a la izquierda' },
          insertColumnRight: { text: 'Insertar columna a la derecha' },
          insertRowUp: { text: 'Insertar fila arriba' },
          insertRowDown: { text: 'Insertar fila abajo' },
          deleteColumn: { text: 'Eliminar columna' },
          deleteRow: { text: 'Eliminar fila' },
          deleteTable: { text: 'Eliminar tabla' }
        }
      }
    },
  }), [setShowTableDialog]);

  // Funcție helper pentru a crea serviciul AUXILIARES (titlu + descriere ca în pagina PDF)
  const createAuxiliaresServicio = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      
      const nombreHTML = '<p><strong>SERVICIO DE AUXILIARES DE SERVICIOS</strong></p>';
      
      const descripcionHTML = `
        <p>Nuestro servicio de Auxiliares de Servicios está orientado a garantizar la tranquilidad, el control diario y la correcta convivencia dentro de la comunidad, actuando como punto de apoyo permanente para vecinos, administración y proveedores.</p>
        <p>El auxiliar se convierte en la figura visible de la comunidad, previniendo incidencias antes de que se conviertan en problemas y ofreciendo una atención cercana y profesional.</p>
        <p><br></p>
        <p><strong>Funciones principales</strong></p>
        <ul>
          <li>Control de accesos y supervisión de personas ajenas a la finca.</li>
          <li>Supervisión y seguimiento de trabajos realizados por proveedores.</li>
          <li>Atención y asistencia a residentes que requieran su presencia.</li>
          <li>Realización de rondas preventivas en diferentes horarios.</li>
          <li>Comunicación inmediata de desperfectos o averías a la administración.</li>
          <li>Aviso a servicios técnicos o de emergencia cuando sea necesario.</li>
          <li>Apoyo en situaciones de molestias o incidencias vecinales.</li>
          <li>Supervisión básica de instalaciones comunes (garajes, zonas comunes, sistemas comunitarios).</li>
        </ul>
        <p><br></p>
        <p><strong>Apoyo al mantenimiento</strong></p>
        <ul>
          <li>Sustitución de bombillas y luminarias (material a cargo de la comunidad).</li>
          <li>Revisión y limpieza básica de rejillas de desagüe obstruidas.</li>
          <li>Conocimiento de la ubicación de llaves de corte de agua, luz y gas para casos de emergencia.</li>
          <li>Información periódica a la Junta de Gobierno sobre incidencias y estado general de la finca.</li>
        </ul>
        <p><br></p>
        <p><strong>Beneficios para la comunidad</strong></p>
        <ul>
          <li>Mayor tranquilidad y control diario</li>
          <li>Prevención de conflictos y actos vandálicos</li>
          <li>Mejora de la convivencia vecinal</li>
          <li>Supervisión constante del estado del edificio</li>
          <li>Imagen cuidada y profesional de la comunidad</li>
        </ul>
        <p><br></p>
        <p><strong>Marco legal</strong></p>
        <p>El servicio se presta conforme a la normativa vigente, sin realizar funciones reservadas al personal de seguridad privada según lo establecido en la legislación aplicable, incluyendo el Real Decreto 2364/1994 y normativa complementaria.</p>
      `;

      const sanitizedNombre = DOMPurify.sanitize(nombreHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
        ALLOWED_ATTR: [],
      });

      const sanitizedDescripcion = DOMPurify.sanitize(descripcionHTML, {
ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
      });

      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        tipo: 'servicio_presupuesto',
        activo: true,
      };
      
      const response = await fetch(routes.createGrupo, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear servicio');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotification({
          message: 'Servicio SERVICIO DE AUXILIARES DE SERVICIOS creado correctamente',
          type: 'success',
        });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error creating AUXILIARES servicio:', error);
      setNotification({
        message: error.message || 'Error al crear servicio',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Crear servicio GESTIÓN DE CUBOS DE BASURA (titlu + descriere completă ca în PDF)
  const createCubosServicio = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const nombreHTML = '<p><strong>GESTIÓN DE CUBOS DE BASURA</strong></p>';
      const descripcionHTML = `
        <p>El servicio de gestión de cubos está orientado a mantener la zona de residuos organizada, limpia y sin molestias para los vecinos, evitando acumulaciones, malos olores y sanciones por incumplimiento de horarios municipales.</p>
        <p>Nos encargamos de la correcta retirada y colocación de los contenedores según la normativa local, garantizando comodidad para la comunidad y una buena imagen del edificio.</p>
        <p><br></p>
        <p><strong>Funcionamiento del servicio</strong></p>
        <p>El personal asignado realiza la retirada y reposición de cubos en los horarios establecidos por la ordenanza municipal, asegurando que los vecinos siempre dispongan de acceso a los contenedores sin tener que manipularlos.</p>
        <p><br></p>
        <p><strong>Tareas incluidas</strong></p>
        <ul>
          <li>Salida de cubos en horario permitido</li>
          <li>Entrada de cubos tras la recogida municipal</li>
          <li>Colocación correcta en la zona asignada</li>
          <li>Cierre de tapas y ordenación del área de residuos</li>
          <li>Limpieza básica del entorno inmediato</li>
          <li>Aviso de incidencias (roturas, suciedad excesiva, vandalismo)</li>
        </ul>
        <p><br></p>
        <p><strong>Beneficios para la comunidad</strong></p>
        <ul>
          <li>Evita sanciones municipales</li>
          <li>Elimina molestias para los vecinos</li>
          <li>Mejora la higiene del acceso a la finca</li>
          <li>Previene malos olores y suciedad</li>
          <li>Mayor comodidad diaria</li>
        </ul>
        <p><br></p>
        <p><strong>Condiciones</strong></p>
        <p>El servicio se realizará conforme a la normativa municipal vigente de recogida de residuos.</p>
      `;
      const sanitizedNombre = DOMPurify.sanitize(nombreHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
        ALLOWED_ATTR: [],
      });
      const sanitizedDescripcion = DOMPurify.sanitize(descripcionHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: [],
      });
      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        tipo: 'servicio_presupuesto',
        activo: true,
      };
      const response = await fetch(routes.createGrupo, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear servicio');
      }
      const data = await response.json();
      if (data.success) {
        setNotification({ message: 'Servicio GESTIÓN DE CUBOS DE BASURA creado correctamente', type: 'success' });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error creating GESTIÓN DE CUBOS DE BASURA:', error);
      setNotification({ message: error.message || 'Error al crear servicio', type: 'error' });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Crear servicio PISCINA (mantenimiento integral piscina comunitaria)
  const createPiscinaServicio = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const nombreHTML = '<p><strong>SERVICIO DE MANTENIMIENTO INTEGRAL EN PISCINA COMUNITARIA</strong></p>';
      const descripcionHTML = `
        <p>El servicio de mantenimiento integral en piscina comunitaria está orientado a garantizar el correcto estado del agua, las instalaciones y el entorno de la piscina durante la temporada de uso.</p>
        <p><br></p>
        <p><strong>Actuaciones incluidas</strong></p>
        <ul>
          <li>Control y tratamiento del agua (cloración, pH, filtrado)</li>
          <li>Limpieza de vaso, skimmers y prefiltros</li>
          <li>Revisión de bombas, filtros e instalación</li>
          <li>Limpieza del perímetro y zona de solarium</li>
          <li>Aviso de incidencias y coordinación con técnicos si procede</li>
        </ul>
        <p><br></p>
        <p><strong>Beneficios para la comunidad</strong></p>
        <ul>
          <li>Piscina en condiciones óptimas de uso</li>
          <li>Cumplimiento de normativa sanitaria</li>
          <li>Mayor durabilidad de las instalaciones</li>
        </ul>
      `;
      const sanitizedNombre = DOMPurify.sanitize(nombreHTML, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'], ALLOWED_ATTR: [] });
      const sanitizedDescripcion = DOMPurify.sanitize(descripcionHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: [],
      });
      const response = await fetch(routes.createGrupo, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: sanitizedNombre,
          descripcion_operativa: sanitizedDescripcion,
          tipo: 'servicio_presupuesto',
          activo: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear servicio');
      }
      const data = await response.json();
      if (data.success) {
        setNotification({ message: 'Servicio PISCINA COMUNITARIA creado correctamente', type: 'success' });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error creating PISCINA servicio:', error);
      setNotification({ message: error.message || 'Error al crear servicio', type: 'error' });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Crear servicio JARDINERÍA (título + descripción como en la página PDF)
  const createJardineriaServicio = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      
      const nombreHTML = '<p><strong>SERVICIO DE JARDINERÍA</strong></p>';
      
      const descripcionHTML = `
        <p>El servicio de jardinería está orientado a la conservación estética y sanitaria de las zonas verdes, garantizando durante todo el año un correcto estado del jardín y evitando su deterioro progresivo.</p>
        <p>El mantenimiento se realiza de forma periódica, adaptándose a las estaciones y necesidades de cada zona ajardinada.</p>
        <p><br></p>
        <p><strong>Trabajos de mantenimiento</strong></p>
        <ul>
          <li>Eliminación de malas hierbas mediante medios manuales o mecánicos según superficie</li>
          <li>Recorte y perfilado de zonas verdes</li>
          <li>Limpieza de hojas y restos vegetales</li>
          <li>Retirada de brotes no deseados (chupones)</li>
          <li>Control y revisión del sistema de riego</li>
          <li>Aviso de averías y posibilidad de reparación (materiales no incluidos)</li>
        </ul>
        <p><br></p>
        <p><strong>Tratamientos y conservación</strong></p>
        <ul>
          <li>Dos tratamientos fitosanitarios preventivos anuales con productos homologados (incluidos)</li>
          <li>Abonado orgánico anual incluido</li>
          <li>Poda anual de arbolado hasta 3 metros de altura</li>
        </ul>
        <p><br></p>
        <p><strong>Beneficios para la comunidad</strong></p>
        <ul>
          <li>Jardín cuidado durante todo el año</li>
          <li>Prevención de plagas y deterioro</li>
          <li>Mejora estética de la finca</li>
          <li>Mayor durabilidad de plantas y césped</li>
          <li>Reducción de incidencias por riego o suciedad</li>
        </ul>
        <p><br></p>
        <p><strong>Condiciones</strong></p>
        <ul>
          <li>El consumo de agua será por cuenta de la comunidad</li>
          <li>La retirada de restos de poda mediante camión no está incluida</li>
        </ul>
      `;

      const sanitizedNombre = DOMPurify.sanitize(nombreHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
        ALLOWED_ATTR: [],
      });

      const sanitizedDescripcion = DOMPurify.sanitize(descripcionHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: [],
      });

      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        tipo: 'servicio_presupuesto',
        activo: true,
      };
      
      const response = await fetch(routes.createGrupo, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear servicio');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotification({
          message: 'Servicio SERVICIO DE JARDINERÍA creado correctamente',
          type: 'success',
        });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error creating JARDINERÍA servicio:', error);
      setNotification({
        message: error.message || 'Error al crear servicio',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Crear servicio LIMPIEZA (título + descripción como en la página PDF)
  const createLimpiezaServicio = async () => {
    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      
      const nombreHTML = '<p><strong>SERVICIO DE LIMPIEZA DE COMUNIDADES</strong></p>';
      
      const descripcionHTML = `
        <p>El servicio de limpieza está diseñado para mantener la finca en condiciones óptimas de higiene, imagen y salubridad, garantizando un mantenimiento continuo de las zonas comunes y evitando la acumulación de suciedad o deterioro prematuro de las instalaciones.</p>
        <p>Nuestro objetivo es que la comunidad permanezca siempre en buen estado, sin depender de avisos constantes por parte de vecinos o administradores.</p>
        <p><br></p>
        <p><strong>Funcionamiento del servicio</strong></p>
        <p>El personal asignado realiza un mantenimiento periódico siguiendo un plan de trabajo establecido, adaptado a las características del edificio y supervisado regularmente para asegurar la calidad del servicio.</p>
        <p>Las tareas pueden ajustarse según necesidades de la comunidad.</p>
        <p><br></p>
        <p><strong>Tareas habituales</strong></p>
        <p><strong>Frecuencia diaria</strong></p>
        <ul>
          <li>Barrido y fregado de suelos</li>
          <li>Limpieza de escaleras interiores</li>
          <li>Limpieza de ascensor</li>
          <li>Limpieza de huellas en barandillas, buzones e interruptores</li>
          <li>Limpieza de cristales de acceso</li>
          <li>Vaciado de publicidad</li>
        </ul>
        <p><strong>Frecuencia alterna</strong></p>
        <ul>
          <li>Limpieza de puerta de acceso</li>
          <li>Desempolvado de puntos de luz</li>
          <li>Limpieza de elementos decorativos</li>
          <li>Limpieza de patios</li>
        </ul>
        <p><br></p>
        <p><strong>Beneficios para la comunidad</strong></p>
        <ul>
          <li>Mejora de la imagen del edificio</li>
          <li>Prevención de malos olores y suciedad acumulada</li>
          <li>Reducción de quejas vecinales</li>
          <li>Mayor conservación de las instalaciones</li>
          <li>Servicio estable sin depender de una sola persona</li>
        </ul>
        <p><br></p>
        <p>El plan de trabajo puede adaptarse a las necesidades específicas de cada comunidad.</p>
      `;

      const sanitizedNombre = DOMPurify.sanitize(nombreHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
        ALLOWED_ATTR: [],
      });

      const sanitizedDescripcion = DOMPurify.sanitize(descripcionHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: [],
      });

      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        tipo: 'servicio_presupuesto',
        activo: true,
      };
      
      const response = await fetch(routes.createGrupo, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear servicio');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotification({
          message: 'Servicio SERVICIO DE LIMPIEZA DE COMUNIDADES creado correctamente',
          type: 'success',
        });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error creating LIMPIEZA servicio:', error);
      setNotification({
        message: error.message || 'Error al crear servicio',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  const handleSaveServicio = async () => {
    if (!servicioForm.nombre.trim()) {
      setNotification({
        message: 'El nombre del servicio es requerido',
        type: 'error',
      });
      return;
    }

    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const url = editingServicio
        ? routes.updateGrupo(editingServicio.id)
        : routes.createGrupo;
      const method = editingServicio ? 'PUT' : 'POST';

      const sanitizedNombre = servicioForm.nombre
        ? DOMPurify.sanitize(servicioForm.nombre, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
            ALLOWED_ATTR: [],
          })
        : '';

      const sanitizedDescripcion = servicioForm.descripcion_operativa
        ? DOMPurify.sanitize(servicioForm.descripcion_operativa, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
          })
        : '';

      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        tipo: 'servicio_presupuesto',
        activo: servicioForm.activo,
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al guardar servicio');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotification({
          message: editingServicio
            ? 'Servicio actualizado correctamente'
            : 'Servicio creado correctamente',
          type: 'success',
        });
        setShowServicioModal(false);
        setEditingServicio(null);
        setServicioForm({ nombre: '', descripcion_operativa: '', tipo: 'servicio_presupuesto', activo: true });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error saving servicio:', error);
      setNotification({
        message: error.message || 'Error al guardar servicio',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  const handleDeleteServicio = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este servicio?')) {
      return;
    }

    try {
      setLoadingServicios(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.deleteGrupo(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al eliminar servicio');
      }

      const data = await response.json();
      if (data.success) {
        setNotification({
          message: 'Servicio eliminado correctamente',
          type: 'success',
        });
        fetchServicios();
      }
    } catch (error) {
      console.error('Error deleting servicio:', error);
      setNotification({
        message: error.message || 'Error al eliminar servicio',
        type: 'error',
      });
    } finally {
      setLoadingServicios(false);
    }
  };

  // Funcții pentru gestionarea template-urilor (plantillas)
  const handleSavePlantilla = async () => {
    if (!plantillaForm.nombre.trim()) {
      setNotification({
        message: 'El nombre de la plantilla es requerido',
        type: 'error',
      });
      return;
    }

    try {
      setLoadingPlantillas(true);
      const token = localStorage.getItem('auth_token');
      const url = editingPlantilla
        ? routes.updatePlantilla(editingPlantilla.id)
        : routes.createPlantilla;
      const method = editingPlantilla ? 'PUT' : 'POST';

      const sanitizedNombre = plantillaForm.nombre
        ? DOMPurify.sanitize(plantillaForm.nombre, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
            ALLOWED_ATTR: [],
          })
        : '';

      const sanitizedDescripcion = plantillaForm.descripcion_operativa
        ? DOMPurify.sanitize(plantillaForm.descripcion_operativa, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
          })
        : '';

      const payload = {
        nombre: sanitizedNombre,
        descripcion_operativa: sanitizedDescripcion,
        activo: plantillaForm.activo,
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al guardar plantilla');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotification({
          message: editingPlantilla
            ? 'Plantilla actualizada correctamente'
            : 'Plantilla creada correctamente',
          type: 'success',
        });
        setShowPlantillaModal(false);
        setEditingPlantilla(null);
        setPlantillaForm({ nombre: '', descripcion_operativa: '', activo: true, servicios_seleccionados: [] });
        fetchPlantillas();
      }
    } catch (error) {
      console.error('Error saving plantilla:', error);
      setNotification({
        message: error.message || 'Error al guardar plantilla',
        type: 'error',
      });
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const handleDeletePlantilla = async (id) => {
      try {
        setLoadingPlantillas(true);
        const token = localStorage.getItem('auth_token');
        const response = await fetch(routes.deletePlantilla(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al eliminar plantilla');
      }

      const data = await response.json();
      if (data.success) {
        setNotification({
          message: 'Plantilla eliminada correctamente',
          type: 'success',
        });
        fetchPlantillas();
      }
    } catch (error) {
      console.error('Error deleting plantilla:', error);
      setNotification({
        message: error.message || 'Error al eliminar plantilla',
        type: 'error',
      });
    } finally {
      setLoadingPlantillas(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Back3DButton onClick={() => navigate('/inicio')} />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Presupuestos y Informes
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Genera presupuestos e informes de forma automatizada
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('servicios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'servicios'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔧 Servicios
            </button>
            <button
              onClick={() => setActiveTab('plantillas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'plantillas'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📄 Plantillas
            </button>
            <button
              onClick={() => setActiveTab('presupuestos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'presupuestos'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Presupuestos
            </button>
            <button
              onClick={() => setActiveTab('informes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'informes'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Informes
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'clientes'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Clientes
            </button>
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'servicios' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Gestión de Servicios
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={createLimpiezaServicio}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    disabled={loadingServicios}
                  >
                    <Plus className="h-4 w-4" />
                    Crear LIMPIEZA
                  </Button>
                  <Button
                    onClick={createJardineriaServicio}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={loadingServicios}
                  >
                    <Plus className="h-4 w-4" />
                    Crear JARDINERIA
                  </Button>
                  <Button
                    onClick={createAuxiliaresServicio}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    disabled={loadingServicios}
                  >
                    <Plus className="h-4 w-4" />
                    Crear AUXILIARES
                  </Button>
                  <Button
                    onClick={createCubosServicio}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
                    disabled={loadingServicios}
                  >
                    <Plus className="h-4 w-4" />
                    Crear CUBOS BASURA
                  </Button>
                <Button
                  onClick={() => {
                    setEditingServicio(null);
                    setServicioForm({ nombre: '', descripcion_operativa: '', tipo: 'servicio_presupuesto', activo: true });
                    setShowServicioModal(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Servicio
                </Button>
                </div>
              </div>

              {loadingServicios ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando servicios...
                </div>
              ) : servicios.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay servicios registrados. Crea el primero haciendo clic en &quot;Nuevo Servicio&quot;.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción Operativa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {servicios.map((servicio) => (
                        <tr key={servicio.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div 
                              className="text-sm font-medium text-gray-900"
                              dangerouslySetInnerHTML={{ 
                                __html: DOMPurify.sanitize(servicio.nombre || '', {
                                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
                                  ALLOWED_ATTR: [],
                                })
                              }} 
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div 
                              className="text-sm text-gray-500 max-w-md"
                              style={{ 
                                maxHeight: '100px', 
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              }}
                            >
                              {servicio.descripcion_operativa ? (
                                <div 
                                  dangerouslySetInnerHTML={{ 
                                    __html: DOMPurify.sanitize(
                                      servicio.descripcion_operativa.length > 200 
                                        ? servicio.descripcion_operativa.substring(0, 200) + '...' 
                                        : servicio.descripcion_operativa,
                                      {
                                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
                                        ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
                                      }
                                    )
                                  }} 
                                  className="prose prose-sm max-w-none"
                                />
                              ) : (
                                <span className="italic text-gray-400">Sin descripción</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {servicio.activo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3" />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setPreviewServicio(servicio);
                                  setShowPreviewModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingServicio(servicio);
                                  setServicioForm({
                                    nombre: servicio.nombre,
                                    descripcion_operativa: htmlListasNumeradasAPuntos(servicio.descripcion_operativa || ''),
                                    tipo: servicio.tipo || 'servicio_presupuesto',
                                    activo: servicio.activo,
                                  });
                                  setShowServicioModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteServicio(servicio.id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'plantillas' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Gestión de Plantillas
                </h2>
                <Button
                  onClick={() => {
                    setEditingPlantilla(null);
                    setPlantillaForm({ 
                      nombre: '', 
                      descripcion_operativa: '', 
                      activo: true,
                      servicios_seleccionados: []
                    });
                    setShowPlantillaModal(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Plantilla
                </Button>
              </div>

              {loadingPlantillas ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando plantillas...
                </div>
              ) : plantillas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay plantillas registradas. Crea la primera haciendo clic en &quot;Nueva Plantilla&quot;.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {plantillas.map((plantilla) => (
                        <tr key={plantilla.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div 
                              className="text-sm font-medium text-gray-900"
                              dangerouslySetInnerHTML={{ 
                                __html: DOMPurify.sanitize(plantilla.nombre, {
                                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
                                  ALLOWED_ATTR: [],
                                })
                              }} 
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div 
                              className="text-sm text-gray-500 max-w-md"
                              style={{ 
                                maxHeight: '100px', 
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              }}
                              dangerouslySetInnerHTML={{ 
                                __html: DOMPurify.sanitize(
                                  plantilla.descripcion_operativa?.length > 200 
                                    ? plantilla.descripcion_operativa.substring(0, 200) + '...' 
                                    : plantilla.descripcion_operativa || '',
                                  {
                                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
                                    ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
                                  }
                                )
                              }} 
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {plantilla.activo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3" />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setPreviewServicio(plantilla);
                                  setShowPreviewModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPlantilla(plantilla);
                                  setPlantillaForm({
                                    nombre: plantilla.nombre,
                                    descripcion_operativa: htmlListasNumeradasAPuntos(plantilla.descripcion_operativa || ''),
                                    activo: plantilla.activo,
                                    servicios_seleccionados: [], // TODO: Parse din descripcion_operativa sau adaugă câmp separat
                                  });
                                  setShowPlantillaModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) {
                                    handleDeletePlantilla(plantilla.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'presupuestos' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Gestión de Presupuestos
                </h2>
                {!showNuevoPresupuestoForm ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setPresupuestoPiscinaMode(false);
                        modalAnadirOtroServicioRef.current = false;
                        setShowModalSeleccionServicioPresupuesto(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Crear nuevo presupuesto
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPresupuestoPiscinaMode(true);
                        modalAnadirOtroServicioRef.current = false;
                        setShowModalSeleccionServicioPresupuesto(true);
                      }}
                      className="flex items-center gap-2"
                      title="Solo servicio de mantenimiento integral en piscina comunitaria"
                    >
                      <Plus className="h-4 w-4" />
                      Crear nuevo presupuesto piscina
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNuevoPresupuestoForm(false);
                      setSelectedServiciosPresupuesto([]);
                      setPresupuestoGuardadoEditarId(null);
                    }}
                  >
                    Volver a la lista
                  </Button>
                )}
              </div>

              {showNuevoPresupuestoForm ? (
                <div className="space-y-8">
                  {/* Presupuesto nr y Fecha emisión cuando se edita uno guardado */}
                  {presupuestoGuardadoEditarId && (() => {
                    const item = presupuestosGuardadosList.find((p) => p.id === presupuestoGuardadoEditarId);
                    if (!item) return null;
                    return (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap gap-4 text-sm">
                        <span><strong>Presupuesto nr:</strong> {item.numero_presupuesto || '—'}</span>
                        <span><strong>Fecha emisión:</strong> {item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                      </div>
                    );
                  })()}
                  {/* Servicios elegidos en el modal */}
                  {selectedServiciosPresupuesto.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                      <div>
                        <label htmlFor="presupuesto-nombre-guardar" className="block text-sm font-medium text-gray-700 mb-1">Nombre para guardar</label>
                        <Input
                          id="presupuesto-nombre-guardar"
                          value={presupuestoCalculo.nombre}
                          onChange={(e) => setPresupuestoCalculo(prev => ({ ...prev, nombre: e.target.value }))}
                          placeholder="Ej: Oferta CP Los Juncos 2026"
                          className="max-w-md border-red-200 bg-white"
                        />
                      </div>
                      {(presupuestoClienteNombre || presupuestoClienteNuevoNombre) && (
                        <div className="space-y-0.5">
                          <p className="text-sm text-gray-600">Cliente: <span className="font-medium text-gray-900">{presupuestoClienteEsNuevo ? presupuestoClienteNuevoNombre : presupuestoClienteNombre}</span></p>
                          <div className="space-y-1">
                            <label htmlFor="presupuesto-direccion-editable" className="block text-sm font-medium text-gray-600">Dirección</label>
                            <Input
                              id="presupuesto-direccion-editable"
                              value={[presupuestoClienteDireccion, [presupuestoClienteCodigoPostal, presupuestoClientePoblacion].filter(Boolean).join(' '), presupuestoClienteProvincia].filter(Boolean).join(', ')}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPresupuestoClienteDireccion(v);
                                setPresupuestoClienteCodigoPostal('');
                                setPresupuestoClientePoblacion('');
                                setPresupuestoClienteProvincia('');
                              }}
                              placeholder="Dirección del cliente (para el PDF)"
                              className="text-sm border-gray-300 bg-white max-w-2xl"
                            />
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-gray-600">Presupuesto para:</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedServiciosPresupuesto.map((s, idx) => {
                          const tipo = derivarTipoDesdeServicio(s.nombre);
                          const auxiliaresVariantIndex = tipo === 'auxiliares'
                            ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'auxiliares').length
                            : 0;
                          const jardineriaVariantIndex = tipo === 'jardineria'
                            ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'jardineria').length
                            : 0;
                          const limpiezaVariantIndex = tipo === 'limpieza'
                            ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'limpieza').length
                            : 0;
                          const cubosVariantIndex = tipo === 'cubos'
                            ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'cubos').length
                            : 0;
                          const piscinaVariantIndex = tipo === 'piscina'
                            ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'piscina').length
                            : 0;
                          return (
                          <span key={`${s.id}-${idx}`} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                            <span className="font-medium text-gray-900">{servicioNombreTexto(s.nombre)}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="!py-0.5 !px-1.5 text-xs"
                              onClick={() => {
                                setSelectedServiciosPresupuesto(prev => [...prev, { ...s }]);
                                if (tipo === 'auxiliares') {
                                  const last = presupuestoCalculoAuxiliaresRest.length > 0
                                    ? presupuestoCalculoAuxiliaresRest[presupuestoCalculoAuxiliaresRest.length - 1]
                                    : presupuestoCalculo;
                                  setPresupuestoCalculoAuxiliaresRest(prev => [...prev, { ...last }]);
                                }
                                if (tipo === 'jardineria') {
                                  const last = presupuestoCalculoJardineriaRest.length > 0
                                    ? presupuestoCalculoJardineriaRest[presupuestoCalculoJardineriaRest.length - 1]
                                    : presupuestoCalculoJardineria;
                                  setPresupuestoCalculoJardineriaRest(prev => [...prev, { ...last }]);
                                }
                                if (tipo === 'limpieza') {
                                  const last = presupuestoCalculoLimpiezaRest.length > 0
                                    ? presupuestoCalculoLimpiezaRest[presupuestoCalculoLimpiezaRest.length - 1]
                                    : presupuestoCalculoLimpieza;
                                  setPresupuestoCalculoLimpiezaRest(prev => [...prev, { ...last }]);
                                }
                                if (tipo === 'cubos') {
                                  const last = presupuestoCalculoCubosRest.length > 0
                                    ? presupuestoCalculoCubosRest[presupuestoCalculoCubosRest.length - 1]
                                    : presupuestoCalculoCubos;
                                  setPresupuestoCalculoCubosRest(prev => [...prev, { ...last }]);
                                }
                                if (tipo === 'piscina') {
                                  const last = presupuestoCalculoPiscinaRest.length > 0
                                    ? presupuestoCalculoPiscinaRest[presupuestoCalculoPiscinaRest.length - 1]
                                    : presupuestoCalculoPiscina;
                                  setPresupuestoCalculoPiscinaRest(prev => [...prev, { ...last, horarioPeriodos: Array.isArray(last.horarioPeriodos) ? [...last.horarioPeriodos] : [] }]);
                                }
                              }}
                              title="Añadir otra variante del mismo servicio (formulario independiente)"
                            >
                              + variante
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="!py-0.5 !px-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                setSelectedServiciosPresupuesto(prev => prev.filter((_, i) => i !== idx));
                                if (tipo === 'auxiliares') {
                                  if (auxiliaresVariantIndex === 0) {
                                    if (presupuestoCalculoAuxiliaresRest.length > 0) {
                                      setPresupuestoCalculo(presupuestoCalculoAuxiliaresRest[0]);
                                      setPresupuestoCalculoAuxiliaresRest(prev => prev.slice(1));
                                    }
                                  } else {
                                    setPresupuestoCalculoAuxiliaresRest(prev => prev.filter((_, i) => i !== auxiliaresVariantIndex - 1));
                                  }
                                }
                                if (tipo === 'jardineria') {
                                  if (jardineriaVariantIndex === 0) {
                                    if (presupuestoCalculoJardineriaRest.length > 0) {
                                      setPresupuestoCalculoJardineria(presupuestoCalculoJardineriaRest[0]);
                                      setPresupuestoCalculoJardineriaRest(prev => prev.slice(1));
                                    }
                                  } else {
                                    setPresupuestoCalculoJardineriaRest(prev => prev.filter((_, i) => i !== jardineriaVariantIndex - 1));
                                  }
                                }
                                if (tipo === 'limpieza') {
                                  if (limpiezaVariantIndex === 0) {
                                    if (presupuestoCalculoLimpiezaRest.length > 0) {
                                      setPresupuestoCalculoLimpieza(presupuestoCalculoLimpiezaRest[0]);
                                      setPresupuestoCalculoLimpiezaRest(prev => prev.slice(1));
                                    }
                                  } else {
                                    setPresupuestoCalculoLimpiezaRest(prev => prev.filter((_, i) => i !== limpiezaVariantIndex - 1));
                                  }
                                }
                                if (tipo === 'cubos') {
                                  if (cubosVariantIndex === 0) {
                                    if (presupuestoCalculoCubosRest.length > 0) {
                                      setPresupuestoCalculoCubos(presupuestoCalculoCubosRest[0]);
                                      setPresupuestoCalculoCubosRest(prev => prev.slice(1));
                                    }
                                  } else {
                                    setPresupuestoCalculoCubosRest(prev => prev.filter((_, i) => i !== cubosVariantIndex - 1));
                                  }
                                }
                                if (tipo === 'piscina') {
                                  if (piscinaVariantIndex === 0) {
                                    if (presupuestoCalculoPiscinaRest.length > 0) {
                                      setPresupuestoCalculoPiscina(presupuestoCalculoPiscinaRest[0]);
                                      setPresupuestoCalculoPiscinaRest(prev => prev.slice(1));
                                    }
                                  } else {
                                    setPresupuestoCalculoPiscinaRest(prev => prev.filter((_, i) => i !== piscinaVariantIndex - 1));
                                  }
                                }
                              }}
                              title="Eliminar este servicio / variante"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </span>
                          );
                        })}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            modalAnadirOtroServicioRef.current = true;
                            const currentIds = selectedServiciosPresupuesto
                              .map((s) => Number(s.id))
                              .filter((id) => id != null && !Number.isNaN(id));
                            setServicioSeleccionadosEnModal(currentIds);
                            setShowModalSeleccionServicioPresupuesto(true);
                          }}
                        >
                          Añadir otro servicio
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tipos únicos seleccionados para mostrar un bloque de cálculo por tipo */}
                  {[...new Set(selectedServiciosPresupuesto.map(s => derivarTipoDesdeServicio(s.nombre)))].includes('auxiliares') && (
                    <>
                  {presupuestoCalculoAuxiliaresAll.map((calculo, variantIndex) => {
                    const setAuxiliaresCalculoAt = (updater) => {
                      if (variantIndex === 0) setPresupuestoCalculo(prev => typeof updater === 'function' ? updater(prev) : updater);
                      else setPresupuestoCalculoAuxiliaresRest(prev => prev.map((c, j) => j === variantIndex - 1 ? (typeof updater === 'function' ? updater(c) : updater) : c));
                    };
                    const resultado = presupuestoResultadoAuxiliares[variantIndex] || {};
                    return (
                  <div key={variantIndex} className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <h3 className="text-lg font-medium text-gray-800">Auxiliares — Variante {variantIndex + 1}</h3>
                  {/* Datos base - solo Auxiliares */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="md:col-span-2 text-base font-medium text-gray-700">Datos base (Convenio y horas)</h4>
                    <div>
                      <span className="block text-sm font-medium text-gray-700 mb-1">Nombre presupuesto</span>
                      <p className="py-2 px-3 bg-white border border-gray-200 rounded text-gray-900 font-medium">
                        {servicioNombreTexto(selectedServiciosPresupuesto.filter(s => derivarTipoDesdeServicio(s.nombre) === 'auxiliares')[variantIndex]?.nombre) || '—'}
                      </p>
                    </div>
                    <div>
                      <label htmlFor={`presupuesto-aux-convenio-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Convenio base (D2)</label>
                      <Input
                        id={`presupuesto-aux-convenio-${variantIndex}`}
                        type="number"
                        value={calculo.convenioBase}
                        onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, convenioBase: +e.target.value || 0 }))}
                      />
                    </div>
                    <div>
                      <label htmlFor={`presupuesto-aux-horas-diarias-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Horas diarias</label>
                      <Input
                        id={`presupuesto-aux-horas-diarias-${variantIndex}`}
                        type="number"
                        min={0}
                        step={0.5}
                        value={calculo.horasDiarias}
                        onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, horasDiarias: +e.target.value || 0 }))}
                        placeholder="Ej: 8"
                      />
                    </div>
                    <div>
                      <label htmlFor={`presupuesto-aux-dias-semana-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Días por semana</label>
                      <Input
                        id={`presupuesto-aux-dias-semana-${variantIndex}`}
                        type="number"
                        min={0}
                        max={7}
                        value={calculo.diasPorSemana}
                        onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, diasPorSemana: Math.min(7, Math.max(0, +e.target.value || 0)) }))}
                        placeholder="Ej: 7"
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-gray-600">Total horas/semana (B4):</span>
                      <span className="font-semibold text-gray-900">{resultado.B4 ?? 0} h</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">D4 (Convenio base × 14):</span>
                      <span className="font-semibold text-gray-900">{(resultado.D4 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând: Salario anual — X conserje para cubrir Y h/sem (calculat automat) */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <div>
                        <label htmlFor={`presupuesto-aux-horas-cubrir-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Horas a cubrir/semana (servicio)</label>
                        <Input
                          id={`presupuesto-aux-horas-cubrir-${variantIndex}`}
                          type="number"
                          min={0}
                          value={calculo.horasACubrirPorSemana}
                          onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, horasACubrirPorSemana: +e.target.value || 0 }))}
                          placeholder="168"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-gray-600">Nº conserje necesarios:</span>
                        <span className="font-bold text-red-600">{(resultado.numConserjeNecesarios ?? 0).toFixed(2)}</span>
                        <span className="text-gray-500">(para cubrir {resultado.horasACubrirPorSemana ?? 0} h/sem a 40 h máx./trabajador)</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-800">
                        Salario anual (1 conserje) — {(resultado.numConserjeNecesarios ?? 0).toFixed(2)} conserje para cubrir {resultado.horasACubrirPorSemana ?? 0} h/sem de servicio
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{(resultado.D6 ?? 0).toFixed(2)} €</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Fórmula: (Convenio base × 14 ÷ 40) × Horas/semana del conserje = (D4÷40)×B4. Este importe es por 1 conserje que trabaja {resultado.B4 ?? 0} h/semana. Si B4 es mayor que 40, revisa &quot;Horas diarias&quot; y &quot;Días por semana&quot; (deben ser las de un solo trabajador, ej. 8×5=40 o 8×7=56).
                      </p>
                    </div>
                  </div>

                  {/* Rând 8: MES DE VACACIONES CONSERJE (1/12) — D8 = D6/12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">
                      Mes de vacaciones conserje (1/12)
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D8 = D6 ÷ 12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D8 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 10: VACACIONES SUPLENTE-LIQUIDACION (1/12) — D10 = D8/12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">
                      Vacaciones suplente-liquidación (1/12)
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D10 = D8 ÷ 12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D10 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 12: NOCTURNIDAD — D12 = B×C (opcional con checkbox) */}
                  <div className={`p-4 bg-white border rounded-lg flex flex-wrap items-center gap-4 ${calculo.aplicaNocturnidad ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                    <label className="flex items-center gap-2 cursor-pointer min-w-[140px]">
                      <input
                        type="checkbox"
                        checked={!!calculo.aplicaNocturnidad}
                        onChange={(e) => setAuxiliaresCalculoAt(prev => ({
                          ...prev,
                          aplicaNocturnidad: e.target.checked,
                          nocturnidad: e.target.checked ? { ...prev.nocturnidad, b: 8 * 365 } : prev.nocturnidad,
                        }))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Nocturnidad</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" placeholder="B" className="w-20" value={calculo.nocturnidad.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, nocturnidad: { ...prev.nocturnidad, b: +e.target.value || 0 } }))} disabled={!calculo.aplicaNocturnidad} />
                      <span className="text-gray-400">×</span>
                      <Input type="number" step="0.01" placeholder="C" className="w-20" value={calculo.nocturnidad.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, nocturnidad: { ...prev.nocturnidad, c: +e.target.value || 0 } }))} disabled={!calculo.aplicaNocturnidad} />
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D12 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D12 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 14: FIN DE SEMANA Y FESTIVOS — D14 = B×C (bifabil) */}
                  <div className={`p-4 rounded-lg flex flex-wrap items-center gap-4 ${calculo.aplicaFinDeSemana ? 'bg-white border border-gray-200' : 'bg-gray-50 border border-gray-100'}`}>
                    <label className="flex items-center gap-2 cursor-pointer min-w-[180px]">
                      <input
                        type="checkbox"
                        checked={!!calculo.aplicaFinDeSemana}
                        onChange={(e) => {
                          const h = Number(calculo.horasDiarias) || 0;
                          const bAuto = h * 2 * 52 + h * 15;
                          setAuxiliaresCalculoAt(prev => ({
                            ...prev,
                            aplicaFinDeSemana: e.target.checked,
                            finDeSemana: e.target.checked ? { ...prev.finDeSemana, b: bAuto } : prev.finDeSemana,
                          }));
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Fin de semana y festivos</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" placeholder="B" className="w-24" value={calculo.finDeSemana.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, finDeSemana: { ...prev.finDeSemana, b: +e.target.value || 0 } }))} disabled={!calculo.aplicaFinDeSemana} title={calculo.aplicaFinDeSemana ? 'Horas diarias × 2 × 52 + horas diarias × 15' : ''} />
                      <span className="text-gray-400">×</span>
                      <Input type="number" step="0.01" placeholder="C" className="w-24" value={calculo.finDeSemana.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, finDeSemana: { ...prev.finDeSemana, c: +e.target.value || 0 } }))} disabled={!calculo.aplicaFinDeSemana} />
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D14 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D14 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 16: SERVICIOS EXTRA-VARIOS (HORAS EXTRA ANUAL) — bifabil, B default 0 */}
                  <div className={`p-4 rounded-lg flex flex-wrap items-center gap-4 ${calculo.aplicaServiciosExtra ? 'bg-white border border-gray-200' : 'bg-gray-50 border border-gray-100'}`}>
                    <label className="flex items-center gap-2 cursor-pointer min-w-[200px]">
                      <input
                        type="checkbox"
                        checked={!!calculo.aplicaServiciosExtra}
                        onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, aplicaServiciosExtra: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Servicios extra-varios (horas extra anual, etc.)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">B (horas):</span>
                      <Input type="number" min={0} placeholder="0" className="w-24" value={calculo.serviciosExtraHoras} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, serviciosExtraHoras: +e.target.value || 0 }))} disabled={!calculo.aplicaServiciosExtra} />
                      <span className="text-gray-400">×</span>
                      <span className="text-xs text-gray-500">C (D6÷156):</span>
                      <span className="font-mono text-sm text-gray-700 min-w-[4rem]">{(resultado.C16 ?? 0).toFixed(2)} €/h</span>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D16 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D16 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 18: TOTAL SALARIOS — D18 = D6+D8+D10+D12+D14+D16 */}
                  <div className="p-4 bg-white border-2 border-gray-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-800">Total salarios</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D18 = D6+D8+D10+D12+D14+D16</span>
                      <span className="text-xl font-bold text-gray-900">{(resultado.D18 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 20: CUOTAS SEGURIDAD SOCIAL ANUAL (37%) — D20 = (D6+D8+D10)×0.37 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">Cuotas Seguridad Social anual (37%)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D20 = (D6+D8+D10)×0,37</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D20 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 22: TOTAL COSTE SALARIAL POR EMPLEADO AÑO — D22 = D18+D20 + por mes */}
                  <div className="p-4 bg-white border-2 border-gray-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Total coste salarial por empleado/año</p>
                      <p className="text-xs text-gray-500 mt-1">Por mes: {((resultado.D22 ?? 0) / 12).toFixed(2)} €</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-gray-500">D22 = D18+D20</span>
                        <span className="text-xl font-bold text-gray-900">{(resultado.D22 ?? 0).toFixed(2)} €</span>
                      </div>
                      <span className="text-xs text-gray-500">D22 ÷ 12</span>
                    </div>
                  </div>

                  {/* Rând 24: UNIFORMIDAD ANUAL — precio × (empleados + 1 suplente); empleados = floor(conserje), editabil sau automat */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[160px]">Uniformidad anual</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-aux-unif-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-aux-unif-b" type="number" step="0.01" placeholder="150" className="w-20" value={calculo.uniformidad.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, uniformidad: { ...prev.uniformidad, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-500 flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!calculo.aplicaUniformidadAuto}
                            onChange={(e) => {
                              const auto = e.target.checked;
                              const nEmp = Math.floor(resultado.numConserjeNecesarios ?? 0);
                              setAuxiliaresCalculoAt(prev => ({
                                ...prev,
                                aplicaUniformidadAuto: auto,
                                numEmpleadosManual: auto ? prev.numEmpleadosManual : nEmp,
                                uniformidad: auto ? prev.uniformidad : { ...prev.uniformidad, c: nEmp + 1 },
                              }));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-red-600"
                          />
                          Auto (empleados = floor(conserje), uniformes = empleados + 1)
                        </label>
                        {calculo.aplicaUniformidadAuto ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-500">Nº empleados:</span>
                            <span className="font-mono text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50 w-14 text-center">{resultado.numEmpleados ?? 0}</span>
                            <span className="text-xs text-gray-500">Nº uniformes:</span>
                            <span className="font-mono text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50 w-14 text-center">{resultado.numUniformes ?? 0}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div>
                              <label htmlFor="presupuesto-aux-num-empleados" className="text-xs text-gray-500 block">Nº empleados</label>
                              <Input type="number" min={0} step="1" className="w-20" id="presupuesto-aux-num-empleados" value={calculo.numEmpleadosManual} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, numEmpleadosManual: +e.target.value || 0 }))} />
                            </div>
                            <div>
                              <label htmlFor="presupuesto-aux-unif-c" className="text-xs text-gray-500 block">Nº uniformes</label>
                              <Input type="number" min={0} step="1" placeholder="empleados+1" className="w-20" id="presupuesto-aux-unif-c" value={calculo.uniformidad.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, uniformidad: { ...prev.uniformidad, c: +e.target.value || 0 } }))} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D24 = precio × nº uniformes</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D24 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 26: GESTORÍA ANUAL — precio × nº empleados (auto = floor(conserje) sau manual) */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[160px]">Gestoría anual</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-aux-gest-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-aux-gest-b" type="number" step="0.01" placeholder="120" className="w-20" value={calculo.gestoria.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, gestoria: { ...prev.gestoria, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-500 flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!calculo.aplicaGestoriaAuto}
                            onChange={(e) => {
                              const auto = e.target.checked;
                              const nEmp = Math.floor(resultado.numConserjeNecesarios ?? 0);
                              setAuxiliaresCalculoAt(prev => ({
                                ...prev,
                                aplicaGestoriaAuto: auto,
                                gestoria: auto ? prev.gestoria : { ...prev.gestoria, c: nEmp },
                              }));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-red-600"
                          />
                          Auto (empleados = floor(conserje))
                        </label>
                        {calculo.aplicaGestoriaAuto ? (
                          <span className="font-mono text-sm border border-gray-200 rounded px-2 py-1.5 bg-gray-50 w-20 text-center">{resultado.numEmpleadosGestoria ?? 0}</span>
                        ) : (
                          <>
                            <label htmlFor="presupuesto-aux-gest-c" className="text-xs text-gray-500 block">Nº empleados</label>
                            <Input type="number" min={0} step="1" placeholder="4" className="w-20" id="presupuesto-aux-gest-c" value={calculo.gestoria.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, gestoria: { ...prev.gestoria, c: +e.target.value || 0 } }))} />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D26 = precio × empleados</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D26 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Coste total empleado/mes (uniforme + gestoría incl.) */}
                  <div className="p-4 bg-white border-2 border-gray-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Coste total empleado/mes (uniforme + gestoría incl.)</p>
                      <p className="text-xs text-gray-500 mt-1">(Uniformidad anual + Gestoría anual) ÷ 12 + Total coste salarial por empleado/mes</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-gray-500">(D24+D26)÷12 + D22÷12 = ({((resultado.D24 ?? 0) + (resultado.D26 ?? 0)).toFixed(2)} ÷ 12) + ({((resultado.D22 ?? 0) / 12).toFixed(2)})</span>
                      <span className="text-xl font-bold text-gray-900">{(resultado.costeTotalEmpleadoMesUnifGestoria ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 28: PRODUCTOS LIMPIEZA ANUAL — D28 = B×C */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[180px]">Productos limpieza anual</p>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" placeholder="B" className="w-20" value={calculo.productosLimpieza.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, productosLimpieza: { ...prev.productosLimpieza, b: +e.target.value || 0 } }))} />
                      <span className="text-gray-400">×</span>
                      <Input type="number" step="0.01" placeholder="C" className="w-20" value={calculo.productosLimpieza.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, productosLimpieza: { ...prev.productosLimpieza, c: +e.target.value || 0 } }))} />
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D28 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D28 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 30: LIMPIEZA GAJARE (250 €/LIMPIEZA) — D30 = B×C */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[220px]">Limpieza Gajare (250 €/limpieza)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-gajare-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-lim-gajare-b" type="number" step="0.01" placeholder="300" className="w-20" value={calculo.limpiezaGajare.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, limpiezaGajare: { ...prev.limpiezaGajare, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-gajare-c" className="text-xs text-gray-500">Nº limpiezas</label>
                        <Input id="presupuesto-lim-gajare-c" type="number" min={0} step="1" placeholder="0" className="w-20" value={calculo.limpiezaGajare.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, limpiezaGajare: { ...prev.limpiezaGajare, c: +e.target.value || 0 } }))} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D30 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D30 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 32: ACRISTALADO (125 €/ACRISTALADO) — D32 = B×C */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[240px]">Acristalado (125 €/acristalado)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-acrist-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-lim-acrist-b" type="number" step="0.01" placeholder="125" className="w-20" value={calculo.acristalado.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, acristalado: { ...prev.acristalado, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-acrist-c" className="text-xs text-gray-500">Nº acristalados</label>
                        <Input id="presupuesto-lim-acrist-c" type="number" min={0} step="1" placeholder="0" className="w-20" value={calculo.acristalado.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, acristalado: { ...prev.acristalado, c: +e.target.value || 0 } }))} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D32 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D32 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 34: CRISTALERO — D34 = B×C */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[160px]">Cristalero</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-cristalero-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-lim-cristalero-b" type="number" step="0.01" placeholder="90" className="w-20" value={calculo.cristalero.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, cristalero: { ...prev.cristalero, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-cristalero-c" className="text-xs text-gray-500">Cantidad</label>
                        <Input id="presupuesto-lim-cristalero-c" type="number" min={0} step="1" placeholder="0" className="w-20" value={calculo.cristalero.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, cristalero: { ...prev.cristalero, c: +e.target.value || 0 } }))} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D34 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D34 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 36: CUBOS — D36 = B×C */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[120px]">Cubos</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-cubos-b" className="text-xs text-gray-500">Precio (€)</label>
                        <Input id="presupuesto-lim-cubos-b" type="number" step="0.01" placeholder="15" className="w-20" value={calculo.cubos.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, cubos: { ...prev.cubos, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-cubos-c" className="text-xs text-gray-500">Cantidad</label>
                        <Input id="presupuesto-lim-cubos-c" type="number" min={0} step="1" placeholder="0" className="w-20" value={calculo.cubos.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, cubos: { ...prev.cubos, c: +e.target.value || 0 } }))} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D36 = B×C</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D36 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 38: TELEFONO — D38 = B×C×12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[120px]">Teléfono</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-telefono-b" className="text-xs text-gray-500">Precio/mes (€)</label>
                        <Input id="presupuesto-lim-telefono-b" type="number" step="0.01" placeholder="22" className="w-20" value={calculo.telefono.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, telefono: { ...prev.telefono, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-telefono-c" className="text-xs text-gray-500">Cantidad</label>
                        <Input id="presupuesto-lim-telefono-c" type="number" min={0} step="1" placeholder="1" className="w-20" value={calculo.telefono.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, telefono: { ...prev.telefono, c: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-500 text-xs mt-4">× 12</span>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D38 = B×C×12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D38 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 40: VIGILANT (Vigilancia) — D40 = B×C×12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[120px]">Vigilant (Vigilancia)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-vigilancia-b" className="text-xs text-gray-500">Precio/mes (€)</label>
                        <Input id="presupuesto-lim-vigilancia-b" type="number" step="0.01" placeholder="8.4" className="w-20" value={calculo.vigilancia.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, vigilancia: { ...prev.vigilancia, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-vigilancia-c" className="text-xs text-gray-500">Cantidad</label>
                        <Input id="presupuesto-lim-vigilancia-c" type="number" min={0} step="1" placeholder="1" className="w-20" value={calculo.vigilancia.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, vigilancia: { ...prev.vigilancia, c: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-500 text-xs mt-4">× 12</span>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D40 = B×C×12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D40 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 42: GASTOS FIJO/HORAS SERVICIO (ANUAL) — D42 = B×C×4.33×12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[240px]">Gastos fijo/horas servicio (anual)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-gastos-b" className="text-xs text-gray-500">B (€/h)</label>
                        <Input id="presupuesto-lim-gastos-b" type="number" step="0.01" placeholder="1.1" className="w-20" value={calculo.gastosFijoHoras.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, gastosFijoHoras: { ...prev.gastosFijoHoras, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-gastos-c" className="text-xs text-gray-500">C (horas/sem)</label>
                        <Input id="presupuesto-lim-gastos-c" type="number" step="0.01" placeholder="0" className="w-20" value={calculo.gastosFijoHoras.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, gastosFijoHoras: { ...prev.gastosFijoHoras, c: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-500 text-xs mt-4">× 4.33 × 12</span>
                    </div>
                    <div className="flex items-baseline gap-2 ml-auto">
                      <span className="text-xs text-gray-500">D42 = B×C×4.33×12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D42 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 44: BENEFICIO EMPRESARIAL (ANUAL) — D44 = C×B×12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
                    <p className="text-sm font-medium text-gray-800 min-w-[220px]">Beneficio empresarial (anual)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-benef-b" className="text-xs text-gray-500">B (€/mes)</label>
                        <Input id="presupuesto-lim-benef-b" type="number" step="0.01" placeholder="0" className="w-20" value={calculo.beneficioEmpresarial.b} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, beneficioEmpresarial: { ...prev.beneficioEmpresarial, b: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-400 mt-4">×</span>
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="presupuesto-lim-benef-c" className="text-xs text-gray-500">C (cantidad)</label>
                        <Input id="presupuesto-lim-benef-c" type="number" min={0} step="1" placeholder="1" className="w-20" value={calculo.beneficioEmpresarial.c} onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, beneficioEmpresarial: { ...prev.beneficioEmpresarial, c: +e.target.value || 0 } }))} />
                      </div>
                      <span className="text-gray-500 text-xs mt-4">× 12</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 ml-auto">
                      <span className="text-xs text-gray-500">D44 = B (€/mes) × C × 12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D44 ?? 0).toFixed(2)} €</span>
                      <span className="text-xs text-gray-400">Beneficio por mes × cantidad × 12 meses</span>
                    </div>
                  </div>

                  {/* Rând 46: SUMA VARIOS — D46 = D24+D26+...+D44 */}
                  <div className="p-4 bg-white border-2 border-gray-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-800">Suma varios</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D46 = D24+D26+D28+D30+D32+D34+D36+D38+D40+D42+D44</span>
                      <span className="text-xl font-bold text-gray-900">{(resultado.D46 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 48: IVA (21%) — D48 = (D22+D46)×0.21 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">IVA (21%)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D48 = (D22+D46)×0,21</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D48 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 50: TOTAL PRESUPUESTO POR AÑO (IVA INCLUIDO) — D50 = D22+D46+D48 */}
                  <div className="p-4 bg-white border-2 border-red-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-800">Total presupuesto por año (IVA incluido)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D50 = D22+D46+D48</span>
                      <span className="text-xl font-bold text-red-600">{(resultado.D50 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Rând 52: PRESUPUESTO POR MES SIN IVA — D52 = D50÷1.21÷12 */}
                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">Presupuesto por mes sin IVA</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D52 = D50 ÷ 1,21 ÷ 12</span>
                      <span className="text-lg font-semibold text-gray-900">{(resultado.D52 ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Precio final a cliente = Presupuesto por mes sin IVA × 12 */}
                  <div className="p-4 bg-white border-2 border-green-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-800">Precio final a cliente</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">D52 × 12 (anual sin IVA)</span>
                      <span className="text-xl font-bold text-green-700">{(resultado.precioFinalACliente ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Resumen calculado - solo detalle numérico; el único tabla Descripción/Mensualidad/Anualidad es OFERTA ECONOMICA al final */}
                  <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Resumen del cálculo (sistema automático 2026)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Total salarios (anual):</span><span className="font-medium">{(resultado.D18 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Seguridad Social 37%:</span><span className="font-medium">{(resultado.D20 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Total coste salarial empleado/año:</span><span className="font-medium">{(resultado.D22 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Suma varios:</span><span className="font-medium">{(resultado.D46 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">IVA 21%:</span><span className="font-medium">{(resultado.D48 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-700 font-semibold">Total presupuesto/año (IVA incl.):</span><span className="font-bold text-red-600">{(resultado.D50 ?? 0).toFixed(2)} €</span></div>
                      <div className="flex justify-between"><span className="text-gray-700 font-semibold">Presupuesto/mes sin IVA:</span><span className="font-bold">{(resultado.D52 ?? 0).toFixed(2)} €</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">Extra (€/mes, se suma a totales en oferta económica)</p>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={calculo.extra ?? 0}
                      onChange={(e) => setAuxiliaresCalculoAt(prev => ({ ...prev, extra: +e.target.value || 0 }))}
                      className="w-32"
                    />
                  </div>
                  </div>
                  );
                  })}
                    </>
                  )}

                  {[...new Set(selectedServiciosPresupuesto.map(s => derivarTipoDesdeServicio(s.nombre)))].includes('limpieza') && presupuestoCalculoLimpiezaAll.map((calculo, variantIndex) => {
                    const setLimpiezaCalculoAt = (updater) => {
                      if (variantIndex === 0) setPresupuestoCalculoLimpieza(prev => typeof updater === 'function' ? updater(prev) : updater);
                      else setPresupuestoCalculoLimpiezaRest(prev => prev.map((c, j) => j === variantIndex - 1 ? (typeof updater === 'function' ? updater(c) : updater) : c));
                    };
                    const limpiezaServicios = selectedServiciosPresupuesto.filter(s => derivarTipoDesdeServicio(s.nombre) === 'limpieza');
                    const nombreVariante = (limpiezaServicios[variantIndex] && servicioNombreTexto(limpiezaServicios[variantIndex].nombre)) || '—';
                    return (
                    <div key={variantIndex} className="p-6 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                      <h3 className="text-lg font-medium text-amber-800">Limpieza — Variante {variantIndex + 1}</h3>
                      {/* Datos base (Convenio y horas) — igual que Auxiliares; en Excel Limpieza D4 = D2×12 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/80 rounded-lg border border-amber-200">
                        <h4 className="md:col-span-2 text-base font-medium text-gray-800">Datos base (Convenio y horas)</h4>
                        <div>
                          <span className="block text-sm font-medium text-gray-700 mb-1">Nombre presupuesto</span>
                          <p className="py-2 px-3 bg-gray-50 border border-amber-200 rounded text-gray-900 font-medium">
                            {nombreVariante}
                          </p>
                        </div>
                        <div>
                          <label htmlFor={`presupuesto-lim-convenio-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Convenio base (D2)</label>
                          <Input
                            id={`presupuesto-lim-convenio-${variantIndex}`}
                            type="number"
                            value={calculo.convenioBase}
                            onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, convenioBase: +e.target.value || 0 }))}
                          />
                        </div>
                        <div>
                          <label htmlFor={`presupuesto-lim-operarias-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Nº operarias</label>
                          <Input
                            id={`presupuesto-lim-operarias-${variantIndex}`}
                            type="number"
                            min={1}
                            value={calculo.numOperarias}
                            onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, numOperarias: Math.max(1, +e.target.value || 0) }))}
                            placeholder="2"
                          />
                        </div>
                        <div>
                          <label htmlFor={`presupuesto-lim-horas-dia-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Horas/día por operaria</label>
                          <Input
                            id={`presupuesto-lim-horas-dia-${variantIndex}`}
                            type="number"
                            min={0}
                            step={0.5}
                            value={calculo.horasPorDiaPorOperaria}
                            onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, horasPorDiaPorOperaria: +e.target.value || 0 }))}
                            placeholder="4"
                          />
                        </div>
                        <div>
                          <label htmlFor={`presupuesto-lim-dias-lab-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Días laborables/semana</label>
                          <Input
                            id={`presupuesto-lim-dias-lab-${variantIndex}`}
                            type="number"
                            min={0}
                            max={7}
                            value={calculo.diasLaborablesSemana}
                            onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, diasLaborablesSemana: Math.min(7, Math.max(0, +e.target.value || 0)) }))}
                            placeholder="5"
                            title="5 = de lunes a viernes"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-700 py-2 px-3 bg-amber-50/80 border border-amber-200 rounded">
                            <strong>Descripción:</strong>{' '}
                            {calculo.numOperarias || 0} operaria{(calculo.numOperarias || 0) !== 1 ? 's' : ''},{' '}
                            {(calculo.horasPorDiaPorOperaria || 0)} h/día c/u,{' '}
                            {(calculo.diasLaborablesSemana || 0) === 5
                              ? 'de lunes a viernes'
                              : `${calculo.diasLaborablesSemana || 0} días/semana`}
                            {' '}(festivos no incluidos).
                          </p>
                        </div>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm">
                          <span className="text-gray-600">Total horas/semana (B4):</span>
                          <span className="font-semibold text-gray-900">
                            {(calculo.numOperarias || 0) * (calculo.horasPorDiaPorOperaria || 0) * (calculo.diasLaborablesSemana || 0)} h
                          </span>
                          <span className="text-gray-400">|</span>
                          <span className="text-gray-600">D4 (Convenio base × 12):</span>
                          <span className="font-semibold text-gray-900">
                            {((calculo.convenioBase || 0) * 12).toFixed(2)} €
                          </span>
                        </div>
                        <div className="md:col-span-2 text-sm py-2 px-3 bg-gray-50 border border-amber-200 rounded">
                          <span className="text-gray-600">SMI ANUAL (40 H./SEMANA - 1.000 €/MES 14 PAGAS):</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {((calculo.convenioBase || 0) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </span>
                        </div>
                        {/* D6 = D4/39*B4 — Salario anual 1 operario para cubrir B4 h/sem */}
                        {(() => {
                          const B4 = (calculo.numOperarias || 0) * (calculo.horasPorDiaPorOperaria || 0) * (calculo.diasLaborablesSemana || 0);
                          const D4 = (calculo.convenioBase || 0) * 12;
                          const D6 = B4 > 0 ? (D4 / 39) * B4 : 0;
                          const D8 = D6 / 12 / 30 * 31;
                          const D10 = D8 / 12;
                          const D12 = (() => {
                            const C12 = calculo.serviciosExtraHoras ?? 0;
                            const B12 = D6 > 0 ? D6 / 156 : 0;
                            return B12 * C12;
                          })();
                          const D14 = D6 + D8 + D10 + D12;
                          const D16 = (D6 + D8 + D10) * 0.35;
                          const D18 = D14 + D16;
                          return (
                            <>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  SALARIO ANUAL 1 OPERARIO PARA CUBRIR <strong>{B4}</strong> H./SEM DE SERVICIO
                                  <span className="text-gray-500 text-xs ml-1">(D6 = D4÷39×B4)</span>
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {D6.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  MES DE VACACIONES CONSERJE (1/12)
                                  <span className="text-gray-500 text-xs ml-1">(D8 = D6÷12÷30×31)</span>
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {D8.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  VACACIONES SUPLENTE-LIQUIDACION (1/12)
                                  <span className="text-gray-500 text-xs ml-1">(D10 = D8÷12)</span>
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {D10.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              {/* D12 = B12×C12, B12 = D6÷156 */}
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  SERVICIOS EXTRA-VARIOS (HORAS EXTRA ANUAL, ETC.)
                                  <span className="text-gray-500 text-xs ml-1">(B12 = D6÷156, D12 = B12×C12)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-3">
                                  <label htmlFor={`presupuesto-lim-horas-anual-c12-${variantIndex}`} className="text-gray-600 text-xs">Horas anual (C12):</label>
                                  <Input
                                    id={`presupuesto-lim-horas-anual-c12-${variantIndex}`}
                                    type="number"
                                    min={0}
                                    step={1}
                                    className="w-20 h-8 text-sm"
                                    value={calculo.serviciosExtraHoras}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, serviciosExtraHoras: +e.target.value || 0 }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {D12.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-amber-100 border-2 border-amber-300 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-800 font-medium">
                                  TOTAL SALARIOS:
                                  <span className="text-gray-500 text-xs ml-1 font-normal">(D14 = D6+D8+D10+D12)</span>
                                </span>
                                <span className="font-bold text-gray-900">
                                  {D14.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  CUOTAS SEGURIDAD SOCIAL ANUAL (35%)
                                  <span className="text-gray-500 text-xs ml-1">(D16 = (D6+D8+D10)×0,35)</span>
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {D16.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-amber-100 border-2 border-amber-300 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-800 font-medium">
                                  TOTAL COSTE SALARIAL POR EMPLEADO AÑO:
                                  <span className="text-gray-500 text-xs ml-1 font-normal">(D18 = D14+D16)</span>
                                </span>
                                <span className="font-bold text-gray-900">
                                  {D18.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">COSTE TOTAL SALARIO MES</span>
                                <span className="font-semibold text-gray-900">
                                  {(D18 / 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </div>
                              {(() => {
                                const D20Unif = (calculo.uniformidad?.b ?? 150) * (calculo.uniformidad?.c ?? 2);
                                const D22Gest = (calculo.gestoria?.b ?? 120) * (calculo.gestoria?.c ?? 2);
                                const costeTotalEmpleadoMesUnifGestoria = D18 / 12 + (D20Unif + D22Gest) / 12;
                                return (
                                  <div className="md:col-span-2 text-sm py-2 px-3 bg-amber-100 border-2 border-amber-300 rounded flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <span className="text-gray-800 font-medium">COSTE TOTAL EMPLEADO/MES UNIFORME + GESTORIA INCL.</span>
                                      <p className="text-gray-500 text-xs mt-0.5">(Uniformidad anual + Gestoría anual) ÷ 12 + Total coste salarial por empleado/mes</p>
                                    </div>
                                    <span className="font-bold text-gray-900">
                                      {costeTotalEmpleadoMesUnifGestoria.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                    </span>
                                  </div>
                                );
                              })()}
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  UNIFORMIDAD ANUAL
                                  <span className="text-gray-500 text-xs ml-1">(D20 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.uniformidad?.b ?? 150}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, uniformidad: { ...(prev.uniformidad || { b: 150, c: 2 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.uniformidad?.c ?? 2}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, uniformidad: { ...(prev.uniformidad || { b: 150, c: 2 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.uniformidad?.b ?? 150) * (calculo.uniformidad?.c ?? 2)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  GESTORÍA ANUAL
                                  <span className="text-gray-500 text-xs ml-1">(D22 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.gestoria?.b ?? 120}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, gestoria: { ...(prev.gestoria || { b: 120, c: 2 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.gestoria?.c ?? 2}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, gestoria: { ...(prev.gestoria || { b: 120, c: 2 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.gestoria?.b ?? 120) * (calculo.gestoria?.c ?? 2)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  PRODUCTOS LIMPIEZA ANUAL
                                  <span className="text-gray-500 text-xs ml-1">(D24 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.productosLimpieza?.b ?? 150}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, productosLimpieza: { ...(prev.productosLimpieza || { b: 150, c: 12 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.productosLimpieza?.c ?? 12}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, productosLimpieza: { ...(prev.productosLimpieza || { b: 150, c: 12 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.productosLimpieza?.b ?? 150) * (calculo.productosLimpieza?.c ?? 12)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className={`md:col-span-2 text-sm py-2 px-3 border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2 ${calculo.aplicaLimpiezaGajare ? 'bg-white' : 'bg-gray-50'}`}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!calculo.aplicaLimpiezaGajare}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, aplicaLimpiezaGajare: e.target.checked }))}
                                    className="rounded border-amber-300"
                                  />
                                  <span className="text-gray-700">
                                    LIMPIEZA GAJARE (450 €/LIMPIEZA)
                                    <span className="text-gray-500 text-xs ml-1">(D26 = B×C)</span>
                                  </span>
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="450"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.limpiezaGajare?.b ?? 450}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, limpiezaGajare: { ...(prev.limpiezaGajare || { b: 450, c: 2 }), b: +e.target.value || 0 } }))}
                                    disabled={!calculo.aplicaLimpiezaGajare}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.limpiezaGajare?.c ?? 2}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, limpiezaGajare: { ...(prev.limpiezaGajare || { b: 450, c: 2 }), c: +e.target.value || 0 } }))}
                                    disabled={!calculo.aplicaLimpiezaGajare}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {(calculo.aplicaLimpiezaGajare
                                      ? ((calculo.limpiezaGajare?.b ?? 450) * (calculo.limpiezaGajare?.c ?? 2))
                                      : 0
                                    ).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  ACRISTALADO (250 €/ACRISTALADO)
                                  <span className="text-gray-500 text-xs ml-1">(D28 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.acristalado?.b ?? 250}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, acristalado: { ...(prev.acristalado || { b: 250, c: 1 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.acristalado?.c ?? 1}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, acristalado: { ...(prev.acristalado || { b: 250, c: 1 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.acristalado?.b ?? 250) * (calculo.acristalado?.c ?? 1)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  CRISTALERO
                                  <span className="text-gray-500 text-xs ml-1">(D30 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.cristalero?.b ?? 90}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, cristalero: { ...(prev.cristalero || { b: 90, c: 0 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.cristalero?.c ?? 0}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, cristalero: { ...(prev.cristalero || { b: 90, c: 0 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.cristalero?.b ?? 90) * (calculo.cristalero?.c ?? 0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  CUBOS
                                  <span className="text-gray-500 text-xs ml-1">(D32 = B×C)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.cubos?.b ?? 8}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, cubos: { ...(prev.cubos || { b: 8, c: 0 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.cubos?.c ?? 0}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, cubos: { ...(prev.cubos || { b: 8, c: 0 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.cubos?.b ?? 8) * (calculo.cubos?.c ?? 0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  TELEFONO
                                  <span className="text-gray-500 text-xs ml-1">(D34 = B×C×12)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.telefono?.b ?? 22}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, telefono: { ...(prev.telefono || { b: 22, c: 0 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.telefono?.c ?? 0}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, telefono: { ...(prev.telefono || { b: 22, c: 0 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400 text-xs">×12</span>
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.telefono?.b ?? 22) * (calculo.telefono?.c ?? 0) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  VIGILANT
                                  <span className="text-gray-500 text-xs ml-1">(D36 = B×C×12)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.vigilancia?.b ?? 8.4}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, vigilancia: { ...(prev.vigilancia || { b: 8.4, c: 2 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.vigilancia?.c ?? 2}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, vigilancia: { ...(prev.vigilancia || { b: 8.4, c: 2 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400 text-xs">×12</span>
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.vigilancia?.b ?? 8.4) * (calculo.vigilancia?.c ?? 2) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              {(() => {
                                const B4 = (calculo.numOperarias || 0) * (calculo.horasPorDiaPorOperaria || 0) * (calculo.diasLaborablesSemana || 0);
                                const B38 = calculo.gastosFijoHoras?.b ?? 1.1;
                                const D38 = B38 * B4 * 4.33 * 12;
                                return (
                                  <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-gray-700">
                                      GASTOS FIJO/HORAS SERVICIO (ANUAL)
                                      <span className="text-gray-500 text-xs ml-1">(D38 = B38×B4×4,33×12, C38=B4)</span>
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        placeholder="B"
                                        className="w-20 h-8 text-sm"
                                        value={calculo.gastosFijoHoras?.b ?? 1.1}
                                        onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, gastosFijoHoras: { ...(prev.gastosFijoHoras || { b: 1.1 }), b: +e.target.value || 0 } }))}
                                      />
                                      <span className="text-gray-500 text-xs">× {B4} h/sem × 4,33×12</span>
                                      <span className="font-semibold text-gray-900">
                                        {D38.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                <span className="text-gray-700">
                                  BENEFICIO EMPRESARIAL (ANUAL)
                                  <span className="text-gray-500 text-xs ml-1">(D40 = B×C×12)</span>
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="B"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.beneficioEmpresarial?.b ?? 150}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, beneficioEmpresarial: { ...(prev.beneficioEmpresarial || { b: 150, c: 1 }), b: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="C"
                                    className="w-20 h-8 text-sm"
                                    value={calculo.beneficioEmpresarial?.c ?? 1}
                                    onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, beneficioEmpresarial: { ...(prev.beneficioEmpresarial || { b: 150, c: 1 }), c: +e.target.value || 0 } }))}
                                  />
                                  <span className="text-gray-400 text-xs">×12</span>
                                  <span className="font-semibold text-gray-900">
                                    {((calculo.beneficioEmpresarial?.b ?? 150) * (calculo.beneficioEmpresarial?.c ?? 1) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                </div>
                              </div>
                              {(() => {
                                const D20 = (calculo.uniformidad?.b ?? 150) * (calculo.uniformidad?.c ?? 2);
                                const D22 = (calculo.gestoria?.b ?? 120) * (calculo.gestoria?.c ?? 2);
                                const D24 = (calculo.productosLimpieza?.b ?? 150) * (calculo.productosLimpieza?.c ?? 12);
                                const D26 = calculo.aplicaLimpiezaGajare ? (calculo.limpiezaGajare?.b ?? 450) * (calculo.limpiezaGajare?.c ?? 2) : 0;
                                const D28 = (calculo.acristalado?.b ?? 250) * (calculo.acristalado?.c ?? 1);
                                const D30 = (calculo.cristalero?.b ?? 90) * (calculo.cristalero?.c ?? 0);
                                const D32 = (calculo.cubos?.b ?? 8) * (calculo.cubos?.c ?? 0);
                                const D34 = (calculo.telefono?.b ?? 22) * (calculo.telefono?.c ?? 0) * 12;
                                const D36 = (calculo.vigilancia?.b ?? 8.4) * (calculo.vigilancia?.c ?? 2) * 12;
                                const B4Varios = (calculo.numOperarias || 0) * (calculo.horasPorDiaPorOperaria || 0) * (calculo.diasLaborablesSemana || 0);
                                const D38 = (calculo.gastosFijoHoras?.b ?? 1.1) * B4Varios * 4.33 * 12;
                                const D40 = (calculo.beneficioEmpresarial?.b ?? 150) * (calculo.beneficioEmpresarial?.c ?? 1) * 12;
                                const D42 = D20 + D22 + D24 + D26 + D28 + D30 + D32 + D34 + D36 + D38 + D40;
                                const D4V = (calculo.convenioBase || 0) * 12;
                                const D6V = B4Varios > 0 ? (D4V / 39) * B4Varios : 0;
                                const D8V = D6V / 12 / 30 * 31;
                                const D10V = D8V / 12;
                                const D12V = (D6V > 0 ? D6V / 156 : 0) * (calculo.serviciosExtraHoras ?? 0);
                                const D14V = D6V + D8V + D10V + D12V;
                                const D16V = (D6V + D8V + D10V) * 0.35;
                                const D18V = D14V + D16V;
                                const D44 = (D18V + D42) * 0.21;
                                const D46 = D18V + D42 + D44;
                                const D48 = D46 / 1.21 / 12 + 1.98;
                                const d48ManualNum = calculo.d48Manual != null && calculo.d48Manual !== '' ? Number(calculo.d48Manual) : NaN;
                                const d48ParaPrecio = (!isNaN(d48ManualNum) && d48ManualNum >= 0) ? d48ManualNum : D48;
                                const precioFinalAClienteLimpieza = d48ParaPrecio * 12; // anual sin IVA
                                return (
                                  <>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-amber-100 border-2 border-amber-300 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-800 font-medium">
                                        SUMA VARIOS
                                        <span className="text-gray-500 text-xs ml-1 font-normal">(D42 = SUM(D20:D40))</span>
                                      </span>
                                      <span className="font-bold text-gray-900">
                                        {D42.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-700">
                                        IVA (21%)
                                        <span className="text-gray-500 text-xs ml-1">(D44 = (D18+D42)×0,21)</span>
                                      </span>
                                      <span className="font-semibold text-gray-900">
                                        {D44.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-amber-100 border-2 border-amber-300 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-800 font-medium">
                                        TOTAL PRESUPUESTO POR AÑO (IVA INCLUIDO)
                                        <span className="text-gray-500 text-xs ml-1 font-normal">(D46 = D18+D42+D44)</span>
                                      </span>
                                      <span className="font-bold text-gray-900">
                                        {D46.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-700">
                                        PRESUPUESTO POR MES SIN IVA
                                        <span className="text-gray-500 text-xs ml-1">(D48 = D46÷1,21÷12+1,98)</span>
                                      </span>
                                      <span className="font-semibold text-gray-900">
                                        {D48.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-white border border-amber-200 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-700">D48 (Presupuesto por mes sin IVA)</span>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Input
                                          type="number"
                                          min={0}
                                          step={0.01}
                                          placeholder={D48.toFixed(2)}
                                          className="w-28 h-8 text-sm"
                                          value={calculo.d48Manual ?? ''}
                                          onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, d48Manual: e.target.value === '' ? null : e.target.value }))}
                                        />
                                        <span className="text-gray-500 text-xs">€/mes (vacío = calculado)</span>
                                      </div>
                                    </div>
                                    <div className="md:col-span-2 text-sm py-2 px-3 bg-green-50 border-2 border-green-200 rounded flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-gray-800 font-medium">
                                        PRECIO FINAL A CLIENTE
                                        <span className="text-gray-500 text-xs ml-1 font-normal">(anual sin IVA = D48×12)</span>
                                      </span>
                                      <span className="font-bold text-green-800">
                                        {precioFinalAClienteLimpieza.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-amber-800 text-sm">
                        Resto de conceptos (productos, varios, IVA, presupuesto mes/año) se implementarán según COSTE 2026 limpieza.xlsx.
                      </p>
                      <div className="p-4 bg-white border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-800">Extra (€/mes, se suma a totales en oferta económica)</p>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={calculo.extra ?? 0}
                          onChange={(e) => setLimpiezaCalculoAt(prev => ({ ...prev, extra: +e.target.value || 0 }))}
                          className="w-32 border-amber-200"
                        />
                      </div>
                    </div>
                    );
                  })}

                  {[...new Set(selectedServiciosPresupuesto.map(s => derivarTipoDesdeServicio(s.nombre)))].includes('jardineria') && (
                    <div className="space-y-4">
                      {presupuestoCalculoJardineriaAll.map((calculo, variantIndex) => {
                        const setJardineriaCalculoAt = (updater) => {
                          if (variantIndex === 0) setPresupuestoCalculoJardineria(prev => typeof updater === 'function' ? updater(prev) : updater);
                          else setPresupuestoCalculoJardineriaRest(prev => prev.map((c, j) => j === variantIndex - 1 ? (typeof updater === 'function' ? updater(c) : updater) : c));
                        };
                        return (
                        <div key={variantIndex} className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg space-y-4">
                          <h3 className="text-lg font-medium text-emerald-800">Jardinería — Variante {variantIndex + 1}</h3>
                          <p className="text-sm font-medium text-gray-700 mb-1">Nombre presupuesto</p>
                          <p className="py-2 px-3 bg-white border border-emerald-200 rounded text-gray-900 font-medium mb-4">
                            {servicioNombreTexto(selectedServiciosPresupuesto.filter(s => derivarTipoDesdeServicio(s.nombre) === 'jardineria')[variantIndex]?.nombre) || '—'}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/80 rounded-lg border border-emerald-200">
                            <div>
                              <label htmlFor={`presupuesto-jard-concepto-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Concepto de jardinería</label>
                              <Input
                                id={`presupuesto-jard-concepto-${variantIndex}`}
                                value={calculo.concepto}
                                onChange={(e) => setJardineriaCalculoAt(prev => ({ ...prev, concepto: e.target.value }))}
                                placeholder="Ej: Mantenimiento zonas verdes"
                                className="border-emerald-200"
                              />
                            </div>
                            <div>
                              <label htmlFor={`presupuesto-jard-precio-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Precio sin IVA (€/mes)</label>
                              <Input
                                id={`presupuesto-jard-precio-${variantIndex}`}
                                type="number"
                                min={0}
                                step={0.01}
                                value={calculo.precioSinIva}
                                onChange={(e) => setJardineriaCalculoAt(prev => ({ ...prev, precioSinIva: e.target.value }))}
                                placeholder="0"
                                className="border-emerald-200"
                              />
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm py-2 px-3 bg-emerald-50 border border-emerald-200 rounded">
                              <span className="text-gray-700">IVA (21% calculado automático, mensual):</span>
                              <span className="font-semibold text-gray-900">
                                {((parseFloat(calculo.precioSinIva) || 0) * 0.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-700">Total con IVA (mensual):</span>
                              <span className="font-bold text-emerald-800">
                                {((parseFloat(calculo.precioSinIva) || 0) * 1.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm py-2 px-3 bg-white border-2 border-emerald-200 rounded">
                              <span className="text-gray-700">Anual sin IVA:</span>
                              <span className="font-semibold text-gray-900">
                                {((parseFloat(calculo.precioSinIva) || 0) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-700">Anual con IVA:</span>
                              <span className="font-bold text-emerald-800">
                                {((parseFloat(calculo.precioSinIva) || 0) * 12 * 1.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {[...new Set(selectedServiciosPresupuesto.map(s => derivarTipoDesdeServicio(s.nombre)))].includes('cubos') && (
                    <div className="space-y-4">
                      {presupuestoCalculoCubosAll.map((calculo, variantIndex) => {
                        const setCubosCalculoAt = (updater) => {
                          if (variantIndex === 0) setPresupuestoCalculoCubos(prev => typeof updater === 'function' ? updater(prev) : updater);
                          else setPresupuestoCalculoCubosRest(prev => prev.map((c, j) => j === variantIndex - 1 ? (typeof updater === 'function' ? updater(c) : updater) : c));
                        };
                        return (
                        <div key={variantIndex} className="p-6 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                          <h3 className="text-lg font-medium text-amber-800">Gestión Cubos de Basura — Variante {variantIndex + 1}</h3>
                          <p className="text-sm font-medium text-gray-700 mb-1">Nombre presupuesto</p>
                          <p className="py-2 px-3 bg-white border border-amber-200 rounded text-gray-900 font-medium mb-4">
                            {servicioNombreTexto(selectedServiciosPresupuesto.filter(s => derivarTipoDesdeServicio(s.nombre) === 'cubos')[variantIndex]?.nombre) || '—'}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/80 rounded-lg border border-amber-200">
                            <div>
                              <label htmlFor={`presupuesto-cubos-concepto-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                              <Input
                                id={`presupuesto-cubos-concepto-${variantIndex}`}
                                value={calculo.concepto}
                                onChange={(e) => setCubosCalculoAt(prev => ({ ...prev, concepto: e.target.value }))}
                                placeholder="Ej: Gestión cubos de basura"
                                className="border-amber-200"
                              />
                            </div>
                            <div>
                              <label htmlFor={`presupuesto-cubos-precio-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Precio sin IVA (€/mes)</label>
                              <Input
                                id={`presupuesto-cubos-precio-${variantIndex}`}
                                type="number"
                                min={0}
                                step={0.01}
                                value={calculo.precioSinIva}
                                onChange={(e) => setCubosCalculoAt(prev => ({ ...prev, precioSinIva: e.target.value }))}
                                placeholder="0"
                                className="border-amber-200"
                              />
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm py-2 px-3 bg-amber-50 border border-amber-200 rounded">
                              <span className="text-gray-700">IVA (21%):</span>
                              <span className="font-semibold text-gray-900">
                                {((parseFloat(calculo.precioSinIva) || 0) * 0.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-700">Total con IVA (mensual):</span>
                              <span className="font-bold text-amber-800">
                                {((parseFloat(calculo.precioSinIva) || 0) * 1.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm py-2 px-3 bg-white border-2 border-amber-200 rounded">
                              <span className="text-gray-700">Anual sin IVA:</span>
                              <span className="font-semibold text-gray-900">
                                {((parseFloat(calculo.precioSinIva) || 0) * 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-700">Anual con IVA:</span>
                              <span className="font-bold text-amber-800">
                                {((parseFloat(calculo.precioSinIva) || 0) * 12 * 1.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {[...new Set(selectedServiciosPresupuesto.map(s => derivarTipoDesdeServicio(s.nombre)))].includes('piscina') && (
                    <div className="space-y-4">
                      {presupuestoCalculoPiscinaAll.map((calculo, variantIndex) => {
                        const setPiscinaCalculoAt = (updater) => {
                          if (variantIndex === 0) setPresupuestoCalculoPiscina(prev => typeof updater === 'function' ? updater(prev) : updater);
                          else setPresupuestoCalculoPiscinaRest(prev => prev.map((c, j) => j === variantIndex - 1 ? (typeof updater === 'function' ? updater(c) : updater) : c));
                        };
                        return (
                        <div key={variantIndex} className="p-6 bg-sky-50 border border-sky-200 rounded-lg space-y-4">
                          <h3 className="text-lg font-medium text-sky-800">
                            Mantenimiento integral piscina comunitaria
                            {presupuestoCalculoPiscinaAll.length > 1 && (
                              <span className="ml-2 text-sky-600 font-normal">— Variante {variantIndex + 1}</span>
                            )}
                          </h3>
                          <p className="py-2 px-3 bg-white border border-sky-200 rounded text-gray-900 font-medium mb-4">
                            {servicioNombreTexto(selectedServiciosPresupuesto.filter(s => derivarTipoDesdeServicio(s.nombre) === 'piscina')[variantIndex]?.nombre) || '—'}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/80 rounded-lg border border-sky-200">
                            <div>
                              <label htmlFor={`presupuesto-piscina-concepto-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                              <Input
                                id={`presupuesto-piscina-concepto-${variantIndex}`}
                                value={calculo.concepto}
                                onChange={(e) => setPiscinaCalculoAt(prev => ({ ...prev, concepto: e.target.value }))}
                                placeholder="Ej: Mantenimiento integral en piscina comunitaria"
                                className="border-sky-200"
                              />
                            </div>
                            <div>
                              <label htmlFor={`presupuesto-piscina-horas-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                              <Input
                                id={`presupuesto-piscina-horas-${variantIndex}`}
                                type="number"
                                min={0}
                                step={1}
                                value={calculo.horas ?? ''}
                                onChange={(e) => setPiscinaCalculoAt(prev => ({ ...prev, horas: e.target.value }))}
                                placeholder="Ej: 8"
                                className="border-sky-200"
                              />
                            </div>
                            <div>
                              <label htmlFor={`presupuesto-piscina-dias-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Días</label>
                              <Input
                                id={`presupuesto-piscina-dias-${variantIndex}`}
                                type="number"
                                min={0}
                                step={1}
                                value={calculo.dias ?? ''}
                                onChange={(e) => setPiscinaCalculoAt(prev => ({ ...prev, dias: e.target.value }))}
                                placeholder="Ej: 93"
                                className="border-sky-200"
                              />
                            </div>
                            <div>
                              <label htmlFor={`presupuesto-piscina-precio-${variantIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Precio sin IVA (€/temporada)</label>
                              <Input
                                id={`presupuesto-piscina-precio-${variantIndex}`}
                                type="text"
                                inputMode="decimal"
                                value={calculo.precioSinIva}
                                onChange={(e) => setPiscinaCalculoAt(prev => ({ ...prev, precioSinIva: e.target.value }))}
                                placeholder="Ej: 12600 o 12.600"
                                className="border-sky-200"
                              />
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm py-2 px-3 bg-sky-50 border border-sky-200 rounded">
                              <span className="text-gray-700">IVA (21%):</span>
                              <span className="font-semibold text-gray-900">
                                {(parsePrecioEurosSpanish(calculo.precioSinIva) * 0.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-700">Total con IVA (temporada):</span>
                              <span className="font-bold text-sky-800">
                                {(parsePrecioEurosSpanish(calculo.precioSinIva) * 1.21).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>
                          </div>
                        </div>
                        );
                      })}

                      {/* Horario por periodos (opcional) — una sola vez al final, orientativo; se refleja en el PDF 2.7 */}
                      <div className="mt-6 p-4 bg-sky-50/80 border border-sky-200 rounded-lg">
                        <h4 className="text-sm font-semibold text-sky-800 mb-1">Horario por periodos (opcional)</h4>
                        <p className="text-xs text-gray-600 mb-2">
                          Añade periodos con fechas y dos turnos de horario. Es orientativo y se muestra una sola vez en el PDF 2.7 (sección Horario).
                        </p>
                        <div className="space-y-3">
                          {(() => {
                            const horarioList = (presupuestoHorarioPiscina?.length) ? presupuestoHorarioPiscina : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                            return horarioList.map((periodo, idx) => {
                              const dias = diasEntreFechas(periodo.fechaDesde, periodo.fechaHasta);
                              const h1 = horasEntreHoras(periodo.turn1Desde, periodo.turn1Hasta);
                              const h2 = horasEntreHoras(periodo.turn2Desde, periodo.turn2Hasta);
                              const horasTotal = (h1 != null ? h1 : 0) + (h2 != null ? h2 : 0);
                              return (
                              <div key={idx} className="p-3 bg-white border border-sky-200 rounded space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="text-xs text-gray-600 w-full">Fechas</label>
                                  <input
                                    type="date"
                                    className="min-w-[130px] border border-gray-300 rounded px-2 py-1.5 text-sm"
                                    value={periodo.fechaDesde ?? ''}
                                    onChange={(e) => {
                                      const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                      const empty = { fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' };
                                      if (list[idx]) list[idx] = { ...list[idx], fechaDesde: e.target.value };
                                      else list[idx] = { ...empty, fechaDesde: e.target.value };
                                      const hasAny = list.some((x) => x.fechaDesde || x.fechaHasta || x.turn1Desde || x.turn1Hasta || x.turn2Desde || x.turn2Hasta);
                                      setPresupuestoHorarioPiscina(hasAny ? list : [{ ...empty, fechaDesde: e.target.value }]);
                                    }}
                                  />
                                  <span className="text-gray-400">→</span>
                                  <input
                                    type="date"
                                    className="min-w-[130px] border border-gray-300 rounded px-2 py-1.5 text-sm"
                                    value={periodo.fechaHasta ?? ''}
                                    onChange={(e) => {
                                      const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                      const empty = { fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' };
                                      if (list[idx]) list[idx] = { ...list[idx], fechaHasta: e.target.value };
                                      else list[idx] = { ...empty, fechaHasta: e.target.value };
                                      const hasAny = list.some((x) => x.fechaDesde || x.fechaHasta || x.turn1Desde || x.turn1Hasta || x.turn2Desde || x.turn2Hasta);
                                      setPresupuestoHorarioPiscina(hasAny ? list : [{ ...empty, fechaHasta: e.target.value }]);
                                    }}
                                  />
                                  {dias != null && (
                                    <span className="text-sm font-medium text-sky-700 whitespace-nowrap">({dias} días)</span>
                                  )}
                                  {(presupuestoHorarioPiscina?.length > 0) && (
                                    <button
                                      type="button"
                                      onClick={() => setPresupuestoHorarioPiscina((prev) => (prev || []).filter((_, i) => i !== idx))}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-auto"
                                      title="Eliminar periodo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-sky-100">
                                  <div>
                                    <label className="text-xs text-gray-600 block mb-0.5">
                                      Turno 1 {h1 != null && <span className="ml-1 font-medium text-sky-700">({h1} h)</span>}
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="time"
                                        className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
                                        value={periodo.turn1Desde ?? ''}
                                        onChange={(e) => {
                                          const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                          if (list[idx]) list[idx] = { ...list[idx], turn1Desde: e.target.value };
                                          else list[idx] = { ...list[idx] || {}, turn1Desde: e.target.value };
                                          setPresupuestoHorarioPiscina(list);
                                        }}
                                      />
                                      <span className="text-gray-400">-</span>
                                      <input
                                        type="time"
                                        className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
                                        value={periodo.turn1Hasta ?? ''}
                                        onChange={(e) => {
                                          const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                          if (list[idx]) list[idx] = { ...list[idx], turn1Hasta: e.target.value };
                                          else list[idx] = { ...list[idx] || {}, turn1Hasta: e.target.value };
                                          setPresupuestoHorarioPiscina(list);
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600 block mb-0.5">
                                      Turno 2 {h2 != null && <span className="ml-1 font-medium text-sky-700">({h2} h)</span>}
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="time"
                                        className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
                                        value={periodo.turn2Desde ?? ''}
                                        onChange={(e) => {
                                          const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                          if (list[idx]) list[idx] = { ...list[idx], turn2Desde: e.target.value };
                                          else list[idx] = { ...list[idx] || {}, turn2Desde: e.target.value };
                                          setPresupuestoHorarioPiscina(list);
                                        }}
                                      />
                                      <span className="text-gray-400">-</span>
                                      <input
                                        type="time"
                                        className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
                                        value={periodo.turn2Hasta ?? ''}
                                        onChange={(e) => {
                                          const list = presupuestoHorarioPiscina?.length ? [...presupuestoHorarioPiscina] : [{ fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }];
                                          if (list[idx]) list[idx] = { ...list[idx], turn2Hasta: e.target.value };
                                          else list[idx] = { ...list[idx] || {}, turn2Hasta: e.target.value };
                                          setPresupuestoHorarioPiscina(list);
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                {horasTotal > 0 && (
                                  <p className="text-xs text-gray-600 pt-0.5 border-t border-sky-100">
                                    Total por día: <span className="font-semibold text-sky-700">{horasTotal} h</span>
                                    {dias != null && dias > 0 && (
                                      <span className="ml-2">· En el periodo: <span className="font-semibold text-sky-700">{Math.round(horasTotal * dias * 10) / 10} h</span></span>
                                    )}
                                  </p>
                                )}
                              </div>
                              );
                            });
                          } )() }
                          <button
                            type="button"
                            onClick={() => setPresupuestoHorarioPiscina([...(presupuestoHorarioPiscina || []), { fechaDesde: '', fechaHasta: '', turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' }])}
                            className="text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Añadir otro periodo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OFERTA ECONOMICA — tabla con todos los servicios seleccionados; solo 2 columnas (DESCRIPCION, MENSUALIDAD) si todo es piscina */}
                  {selectedServiciosPresupuesto.length > 0 && (() => {
                    const ofertaSoloPiscina = selectedServiciosPresupuesto.every((s) => derivarTipoDesdeServicio(s.nombre) === 'piscina');
                    return (
                    <div className="p-6 bg-white border-2 border-gray-300 rounded-lg shadow-sm mt-6">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">OFERTA ECONOMICA</h3>
                      <p className="text-gray-700 mb-4">El precio de los servicios, en base a todo lo anteriormente expuesto es el siguiente:</p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">DESCRIPCION</th>
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">{ofertaSoloPiscina ? 'TEMPORADA' : 'MENSUALIDAD'}</th>
                              {!ofertaSoloPiscina && <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">ANUALIDAD</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedServiciosPresupuesto.map((s, idx) => {
                              const tipo = derivarTipoDesdeServicio(s.nombre);
                              const variantIndexAuxiliares = tipo === 'auxiliares' ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'auxiliares').length : 0;
                              const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              let descripcion = servicioNombreTexto(s.nombre);
                              let mensualidadSinIva = 0, mensualidadConIva = 0, anualidadSinIva = 0, anualidadConIva = 0;
                              if (tipo === 'auxiliares') {
                                const calcAux = presupuestoCalculoAuxiliaresAll[variantIndexAuxiliares];
                                const resAux = presupuestoResultadoAuxiliares[variantIndexAuxiliares];
                                const extraAux = (calcAux && calcAux.extra) ?? 0; // €/mes
                                descripcion = `${servicioNombreTexto(s.nombre)} – ${(calcAux && calcAux.horasDiarias) || 0}h/día los 365 días`;
                                mensualidadSinIva = (resAux ? resAux.D52 : 0) + extraAux;
                                anualidadSinIva = (resAux ? resAux.precioFinalACliente : 0) + extraAux * 12;
                                mensualidadConIva = mensualidadSinIva * 1.21;
                                anualidadConIva = mensualidadSinIva * 1.21;
                              } else if (tipo === 'limpieza') {
                                const variantIndexLimpieza = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'limpieza').length;
                                const resLimp = presupuestoResultadoLimpiezaAll[variantIndexLimpieza];
                                const calcLimp = presupuestoCalculoLimpiezaAll[variantIndexLimpieza];
                                const extraLimp = (calcLimp && calcLimp.extra) ?? 0; // €/mes
                                descripcion = `Limpieza - ${(resLimp && resLimp.descripcionLimpieza) || ''}`;
                                mensualidadSinIva = (resLimp ? resLimp.D48 : 0) + extraLimp;
                                anualidadSinIva = (resLimp ? resLimp.D48 : 0) * 12 + extraLimp * 12;
                                mensualidadConIva = mensualidadSinIva * 1.21;
                                anualidadConIva = anualidadSinIva * 1.21;
                              } else if (tipo === 'jardineria') {
                                const variantIndexJardineria = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'jardineria').length;
                                const calcJard = presupuestoCalculoJardineriaAll[variantIndexJardineria];
                                const precioSinIvaMes = parseFloat(calcJard?.precioSinIva) || 0; // €/mes
                                descripcion = calcJard?.concepto ? `Jardinería - ${calcJard.concepto}` : 'Jardinería';
                                mensualidadSinIva = precioSinIvaMes;
                                mensualidadConIva = precioSinIvaMes * 1.21;
                                anualidadSinIva = precioSinIvaMes * 12;
                                anualidadConIva = precioSinIvaMes * 12 * 1.21;
                              } else if (tipo === 'cubos') {
                                const variantIndexCubos = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'cubos').length;
                                const calcCubos = presupuestoCalculoCubosAll[variantIndexCubos];
                                const precioSinIvaMes = parseFloat(calcCubos?.precioSinIva) || 0;
                                descripcion = calcCubos?.concepto ? `Gestión cubos - ${calcCubos.concepto}` : 'Gestión cubos de basura';
                                mensualidadSinIva = precioSinIvaMes;
                                mensualidadConIva = precioSinIvaMes * 1.21;
                                anualidadSinIva = precioSinIvaMes * 12;
                                anualidadConIva = precioSinIvaMes * 12 * 1.21;
                              } else if (tipo === 'piscina') {
                                const variantIndexPiscina = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'piscina').length;
                                const calcPiscina = presupuestoCalculoPiscinaAll[variantIndexPiscina];
                                const precioSinIvaMes = parsePrecioEurosSpanish(calcPiscina?.precioSinIva);
                                descripcion = `Piscina - ${descripcionPiscina(calcPiscina)}`;
                                mensualidadSinIva = precioSinIvaMes;
                                mensualidadConIva = precioSinIvaMes * 1.21;
                                anualidadSinIva = precioSinIvaMes * 12;
                                anualidadConIva = precioSinIvaMes * 12 * 1.21;
                              }
                              return (
                                <tr key={`${s.id}-${idx}`} className="border-b border-gray-200">
                                  <td className="border border-gray-300 px-3 py-2 text-gray-800">{descripcion}</td>
                                  <td className="border border-gray-300 px-3 py-2">
                                    <div>{fmt(mensualidadSinIva)} €+IVA</div>
                                    <div className="text-gray-600">{fmt(mensualidadConIva)} € IVA incluido</div>
                                  </td>
                                  {!ofertaSoloPiscina && (
                                    <td className="border border-gray-300 px-3 py-2">
                                      <div>{fmt(anualidadSinIva)} €+IVA</div>
                                      <div className="text-gray-600">{fmt(anualidadConIva)} € IVA incluido</div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Guardar / Actualizar presupuesto */}
                  {selectedServiciosPresupuesto.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                      <Button
                        onClick={handleGuardarPresupuesto}
                        disabled={savingPresupuesto}
                        className="flex items-center gap-2"
                      >
                        {savingPresupuesto ? 'Guardando…' : presupuestoGuardadoEditarId ? 'Actualizar presupuesto' : 'Guardar presupuesto'}
                      </Button>
                      {presupuestoGuardadoEditarId && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPresupuestoGuardadoEditarId(null);
                              setShowNuevoPresupuestoForm(false);
                              setSelectedServiciosPresupuesto([]);
                            }}
                            disabled={savingPresupuesto}
                            className="flex items-center gap-2"
                          >
                            Cancelar
                          </Button>
                          <span className="text-sm text-gray-500">Editando presupuesto guardado</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingPresupuestosGuardados ? (
                    <p className="text-gray-600">Cargando presupuestos guardados…</p>
                  ) : presupuestosGuardadosList.length === 0 ? (
                    <p className="text-gray-600">
                      No hay presupuestos guardados. Pulsa &quot;Crear nuevo presupuesto&quot; para crear uno y guardarlo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Presupuestos guardados</p>
                      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden bg-white">
                        {presupuestosGuardadosList.map((item) => (
                          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50">
                            <div>
                              <span className="font-medium text-gray-900">{item.nombre}</span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-600">
                                <span><strong>Presupuesto nr:</strong> {item.numero_presupuesto || '—'}</span>
                                <span><strong>Fecha emisión:</strong> {item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                              </div>
                              {item.cliente_nombre && (
                                <span className="text-gray-500 text-sm ml-0 mt-0.5 block">— {item.cliente_nombre}</span>
                              )}
                              <span className="text-gray-400 text-xs ml-0 mt-0.5 block">
                                {item.updated_at ? `Actualizado: ${new Date(item.updated_at).toLocaleDateString('es-ES')}` : ''}
                              </span>
                              {(item.firma_fecha || item.firma_at) && (
                                <span className="inline-flex items-center ml-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Presupuesto firmado electrónicamente">
                                  Firmado el {(item.firma_fecha ? new Date(item.firma_fecha) : new Date(item.firma_at)).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {(item.firma_fecha || item.firma_at) && (
                                <Button variant="outline" size="sm" onClick={() => handleVerPdfFirmado(item)} className="text-green-700 border-green-300 hover:bg-green-50">
                                  Ver PDF firmado
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handlePreviuPresupuesto(item)}>
                                Vista previa
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleGenerarPresupuesto(item, 'docx')}>
                                DOCX
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleGenerarPresupuesto(item, 'pdf')}>
                                PDF
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEnviarPresupuesto(item)} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                                {(item.firma_fecha || item.firma_at) ? 'Enviar Presupuesto firmado' : 'Enviar Presupuesto'}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleCargarPresupuesto(item.id)}>
                                Cargar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEliminarPresupuesto(item.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                                Eliminar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

        {/* Modal Vista previa presupuesto */}
        <Modal
          isOpen={showPresupuestoPreviewModal}
          onClose={() => setShowPresupuestoPreviewModal(false)}
          title={`Vista previa — ${previewPresupuestoNombre || 'Presupuesto'}`}
        >
          <div className="space-y-4">
            {selectedServiciosPresupuesto.length > 0 ? (() => {
              const ofertaSoloPiscina = selectedServiciosPresupuesto.every((s) => derivarTipoDesdeServicio(s.nombre) === 'piscina');
              return (
              <>
                <p className="text-gray-700">El precio de los servicios, en base a todo lo anteriormente expuesto es el siguiente:</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">DESCRIPCION</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">{ofertaSoloPiscina ? 'TEMPORADA' : 'MENSUALIDAD'}</th>
                        {!ofertaSoloPiscina && <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">ANUALIDAD</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServiciosPresupuesto.map((s, idx) => {
                        const tipo = derivarTipoDesdeServicio(s.nombre);
                        const variantIndexAuxiliares = tipo === 'auxiliares' ? selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'auxiliares').length : 0;
                        const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        let descripcion = servicioNombreTexto(s.nombre);
                        let mensualidadSinIva = 0, mensualidadConIva = 0, anualidadSinIva = 0, anualidadConIva = 0;
                        if (tipo === 'auxiliares') {
                          const calcAux = presupuestoCalculoAuxiliaresAll[variantIndexAuxiliares];
                          const resAux = presupuestoResultadoAuxiliares[variantIndexAuxiliares];
                          const extraAux = (calcAux && calcAux.extra) ?? 0;
                          descripcion = `${servicioNombreTexto(s.nombre)} – ${(calcAux && calcAux.horasDiarias) || 0}h/día los 365 días`;
                          mensualidadSinIva = (resAux ? resAux.D52 : 0) + extraAux;
                          anualidadSinIva = (resAux ? resAux.precioFinalACliente : 0) + extraAux * 12;
                          mensualidadConIva = mensualidadSinIva * 1.21;
                          anualidadConIva = mensualidadSinIva * 1.21;
                        } else if (tipo === 'limpieza') {
                          const variantIndexLimpieza = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'limpieza').length;
                          const resLimp = presupuestoResultadoLimpiezaAll[variantIndexLimpieza];
                          const calcLimp = presupuestoCalculoLimpiezaAll[variantIndexLimpieza];
                          const extraLimp = (calcLimp && calcLimp.extra) ?? 0;
                          descripcion = `Limpieza - ${(resLimp && resLimp.descripcionLimpieza) || ''}`;
                          mensualidadSinIva = (resLimp ? resLimp.D48 : 0) + extraLimp;
                          anualidadSinIva = (resLimp ? resLimp.D48 : 0) * 12 + extraLimp * 12;
                          mensualidadConIva = mensualidadSinIva * 1.21;
                          anualidadConIva = anualidadSinIva * 1.21;
                        } else if (tipo === 'jardineria') {
                          const variantIndexJardineria = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'jardineria').length;
                          const calcJard = presupuestoCalculoJardineriaAll[variantIndexJardineria];
                          const precioSinIvaMes = parseFloat(calcJard?.precioSinIva) || 0;
                          descripcion = calcJard?.concepto ? `Jardinería - ${calcJard.concepto}` : 'Jardinería';
                          mensualidadSinIva = precioSinIvaMes;
                          mensualidadConIva = precioSinIvaMes * 1.21;
                          anualidadSinIva = precioSinIvaMes * 12;
                          anualidadConIva = precioSinIvaMes * 12 * 1.21;
                        } else if (tipo === 'cubos') {
                          const variantIndexCubos = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'cubos').length;
                          const calcCubos = presupuestoCalculoCubosAll[variantIndexCubos];
                          const precioSinIvaMes = parseFloat(calcCubos?.precioSinIva) || 0;
                          descripcion = calcCubos?.concepto ? `Gestión cubos - ${calcCubos.concepto}` : 'Gestión cubos de basura';
                          mensualidadSinIva = precioSinIvaMes;
                          mensualidadConIva = precioSinIvaMes * 1.21;
                          anualidadSinIva = precioSinIvaMes * 12;
                          anualidadConIva = precioSinIvaMes * 12 * 1.21;
                        } else if (tipo === 'piscina') {
                          const variantIndexPiscina = selectedServiciosPresupuesto.slice(0, idx).filter((x) => derivarTipoDesdeServicio(x.nombre) === 'piscina').length;
                          const calcPiscina = presupuestoCalculoPiscinaAll[variantIndexPiscina];
                          const precioSinIvaMes = parsePrecioEurosSpanish(calcPiscina?.precioSinIva);
                          descripcion = `Piscina - ${descripcionPiscina(calcPiscina)}`;
                          mensualidadSinIva = precioSinIvaMes;
                          mensualidadConIva = precioSinIvaMes * 1.21;
                          anualidadSinIva = precioSinIvaMes * 12;
                          anualidadConIva = precioSinIvaMes * 12 * 1.21;
                        }
                        return (
                          <tr key={`${s.id}-${idx}`} className="border-b border-gray-200">
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{descripcion}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              <div>{fmt(mensualidadSinIva)} €+IVA</div>
                              <div className="text-gray-600">{fmt(mensualidadConIva)} € IVA incluido</div>
                            </td>
                            {!ofertaSoloPiscina && (
                              <td className="border border-gray-300 px-3 py-2">
                                <div>{fmt(anualidadSinIva)} €+IVA</div>
                                <div className="text-gray-600">{fmt(anualidadConIva)} € IVA incluido</div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
              );
            })() : (
              <p className="text-gray-500">Cargando vista previa…</p>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowPresupuestoPreviewModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Enviar Presupuesto por email */}
        <Modal
          isOpen={showEnviarPresupuestoModal}
          onClose={() => { setShowEnviarPresupuestoModal(false); setEnviarPresupuestoItem(null); setEnviarPresupuestoEmail(''); setEnviarPresupuestoMensaje(''); }}
          title={enviarPresupuestoItem && (enviarPresupuestoItem.firma_fecha || enviarPresupuestoItem.firma_at) ? 'Enviar Presupuesto firmado por email' : 'Enviar Presupuesto por email'}
        >
          <div className="space-y-4">
            {enviarPresupuestoItem && (
              <>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Cliente:</span>{' '}
                  {enviarPresupuestoItem.cliente_nombre || '—'}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de destino</label>
                  <Input
                    type="email"
                    value={enviarPresupuestoEmail}
                    onChange={(e) => setEnviarPresupuestoEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje adicional (opcional)</label>
                  <textarea
                    value={enviarPresupuestoMensaje}
                    onChange={(e) => setEnviarPresupuestoMensaje(e.target.value)}
                    placeholder="Añade un mensaje personalizado al correo si lo deseas..."
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {enviarPresupuestoItem && (enviarPresupuestoItem.firma_fecha || enviarPresupuestoItem.firma_at)
                    ? 'Se enviará el PDF del presupuesto firmado a la dirección indicada. Confirma antes de enviar.'
                    : 'Se enviará el PDF del presupuesto a la dirección indicada. Confirma antes de enviar.'}
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setShowEnviarPresupuestoModal(false); setEnviarPresupuestoItem(null); setEnviarPresupuestoMensaje(''); }} disabled={sendingEnviarPresupuesto}>
                    Cancelar
                  </Button>
                  <Button onClick={handleEnviarPresupuestoSubmit} disabled={sendingEnviarPresupuesto || !enviarPresupuestoEmail.trim()}>
                    {sendingEnviarPresupuesto ? 'Enviando…' : 'Enviar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>

        {/* Modal Enviar Informe por email */}
        <Modal
          isOpen={showEnviarInformeModal}
          onClose={() => { setShowEnviarInformeModal(false); setEnviarInformeItem(null); setEnviarInformeEmail(''); setEnviarInformeMensaje(''); }}
          title="Enviar Informe por email"
        >
          <div className="space-y-4">
            {enviarInformeItem && (
              <>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Cliente:</span>{' '}
                  {(() => {
                    const c = clientesList.find((x) => Number(x.id) === Number(enviarInformeItem.cliente_id));
                    return c ? (c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? `Cliente ${enviarInformeItem.cliente_id}`) : (enviarInformeItem.cliente_id != null ? `Cliente ID ${enviarInformeItem.cliente_id}` : '— Sin asignar');
                  })()}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de destino</label>
                  <Input
                    type="email"
                    value={enviarInformeEmail}
                    onChange={(e) => setEnviarInformeEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje adicional (opcional)</label>
                  <textarea
                    value={enviarInformeMensaje}
                    onChange={(e) => setEnviarInformeMensaje(e.target.value)}
                    placeholder="Añade un mensaje personalizado al correo si lo deseas..."
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
                <p className="text-xs text-gray-500">Se enviará el PDF del informe a la dirección indicada. Confirma antes de enviar.</p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setShowEnviarInformeModal(false); setEnviarInformeItem(null); setEnviarInformeMensaje(''); }} disabled={sendingEnviarInforme}>
                    Cancelar
                  </Button>
                  <Button onClick={handleEnviarInformeSubmit} disabled={sendingEnviarInforme || !enviarInformeEmail.trim()}>
                    {sendingEnviarInforme ? 'Enviando…' : 'Enviar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>

        {/* Modal: seleccionar servicio para el presupuesto */}
        <Modal
          isOpen={showModalSeleccionServicioPresupuesto}
          onClose={() => {
            setPresupuestoPiscinaMode(false);
            modalAnadirOtroServicioRef.current = false;
            setShowModalSeleccionServicioPresupuesto(false);
            setServicioSeleccionadosEnModal([]);
            setPresupuestoClienteId(null);
            setPresupuestoClienteNombre('');
            setPresupuestoClienteEsNuevo(false);
            setPresupuestoClienteNuevoNombre('');
            setPresupuestoClienteDireccion('');
            setPresupuestoClienteCodigoPostal('');
            setPresupuestoClientePoblacion('');
            setPresupuestoClienteProvincia('');
          }}
          title={presupuestoPiscinaMode ? 'Nuevo presupuesto piscina' : 'Seleccionar servicios para el presupuesto'}
          showCloseButton={false}
        >
          {/* Cliente */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
            {loadingClientes ? (
              <p className="text-gray-500 text-sm">Cargando clientes...</p>
            ) : (
              <>
                <select
                  value={presupuestoClienteEsNuevo ? 'nuevo' : (presupuestoClienteId ?? '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'nuevo') {
                      setPresupuestoClienteEsNuevo(true);
                      setPresupuestoClienteId(null);
                      setPresupuestoClienteNombre(presupuestoClienteNuevoNombre);
                    } else if (v === '') {
                      setPresupuestoClienteEsNuevo(false);
                      setPresupuestoClienteId(null);
                      setPresupuestoClienteNombre('');
                    } else {
                      const id = Number(v);
                      const c = clientesList.find((x) => x.id === id);
                      setPresupuestoClienteEsNuevo(false);
                      setPresupuestoClienteId(id);
                      setPresupuestoClienteNombre(c ? (c.NOMBRE_O_RAZON_SOCIAL || c['NOMBRE O RAZON SOCIAL'] || '') : '');
                    }
                  }}
                  className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">— Seleccionar cliente —</option>
                  {clientesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? `Cliente #${c.id}`}
                    </option>
                  ))}
                  <option value="nuevo">+ Nuevo cliente</option>
                </select>
                {presupuestoClienteEsNuevo && (
                  <div className="mt-2 space-y-3">
                    <div>
                      <label htmlFor="presupuesto-cliente-nuevo-nombre" className="block text-xs text-gray-500 mb-1">Nombre del cliente</label>
                      <Input
                        id="presupuesto-cliente-nuevo-nombre"
                        value={presupuestoClienteNuevoNombre}
                        onChange={(e) => {
                          setPresupuestoClienteNuevoNombre(e.target.value);
                          setPresupuestoClienteNombre(e.target.value);
                        }}
                        placeholder="Escriba el nombre del cliente"
                        className="max-w-md border-gray-300"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Dirección (para el PDF del presupuesto)</p>
                    <div>
                      <label htmlFor="presupuesto-cliente-direccion" className="block text-xs text-gray-500 mb-1">Dirección</label>
                      <AddressAutocomplete
                        id="presupuesto-cliente-direccion"
                        name="presupuestoClienteDireccion"
                        value={presupuestoClienteDireccion}
                        onChange={(e) => setPresupuestoClienteDireccion(e.target.value)}
                        onAddressSelected={({ displayName, postcode, city, state }) => {
                          setPresupuestoClienteDireccion(displayName || '');
                          if (postcode) setPresupuestoClienteCodigoPostal(postcode);
                          if (city) setPresupuestoClientePoblacion(city);
                          if (state) setPresupuestoClienteProvincia(state);
                        }}
                        placeholder="Escribe para buscar dirección (calle, número, ciudad...)"
                        className="max-w-md border border-gray-300 rounded px-3 py-2 text-sm w-full focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                      <div>
                        <label htmlFor="presupuesto-cliente-cp" className="block text-xs text-gray-500 mb-1">Código postal</label>
                        <Input
                          id="presupuesto-cliente-cp"
                          value={presupuestoClienteCodigoPostal}
                          onChange={(e) => setPresupuestoClienteCodigoPostal(e.target.value)}
                          placeholder="28001"
                          className="border-gray-300"
                        />
                      </div>
                      <div>
                        <label htmlFor="presupuesto-cliente-poblacion" className="block text-xs text-gray-500 mb-1">Población</label>
                        <Input
                          id="presupuesto-cliente-poblacion"
                          value={presupuestoClientePoblacion}
                          onChange={(e) => setPresupuestoClientePoblacion(e.target.value)}
                          placeholder="Madrid"
                          className="border-gray-300"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="presupuesto-cliente-provincia" className="block text-xs text-gray-500 mb-1">Provincia</label>
                      <Input
                        id="presupuesto-cliente-provincia"
                        value={presupuestoClienteProvincia}
                        onChange={(e) => setPresupuestoClienteProvincia(e.target.value)}
                        placeholder="Madrid"
                        className="max-w-md border-gray-300"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {presupuestoPiscinaMode ? (
            <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <p className="text-sm font-medium text-sky-800">Servicio incluido:</p>
              <p className="text-gray-800 mt-1">SERVICIO DE MANTENIMIENTO INTEGRAL EN PISCINA COMUNITARIA</p>
              <p className="text-xs text-gray-600 mt-2">Solo tiene que elegir el cliente y pulsar Continuar.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Marca los servicios que incluye este presupuesto (puedes elegir 1, 2 o los 3). En función de la elección se cargarán los conceptos y el sistema de cálculo correspondiente a cada uno.
              </p>
              {loadingServicios ? (
                <p className="text-gray-500 py-4">Cargando servicios...</p>
              ) : servicios.length === 0 ? (
                <p className="text-gray-500 py-4">No hay servicios. Crea primero servicios en la pestaña &quot;Servicios&quot;.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {servicios.map((s) => {
                    const nombreTexto = servicioNombreTexto(s.nombre);
                    const sid = Number(s.id);
                    const isChecked = servicioSeleccionadosEnModal.map(Number).includes(sid);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isChecked ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setServicioSeleccionadosEnModal(prev => {
                            const prevIds = prev.map(Number);
                            return prevIds.includes(sid) ? prev.filter(id => Number(id) !== sid) : [...prev, sid];
                          })}
                          className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="font-medium text-gray-900">{nombreTexto || `Servicio #${s.id}`}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setPresupuestoPiscinaMode(false); modalAnadirOtroServicioRef.current = false; setShowModalSeleccionServicioPresupuesto(false); setServicioSeleccionadosEnModal([]); }}>
              Cancelar
            </Button>
            <Button
              disabled={presupuestoPiscinaMode ? !servicios.some((s) => servicioNombreTexto(s.nombre).toLowerCase().includes('piscina')) : servicioSeleccionadosEnModal.length === 0}
              onClick={() => {
                let selectedFromModal;
                if (presupuestoPiscinaMode) {
                  selectedFromModal = servicios.filter((s) => servicioNombreTexto(s.nombre).toLowerCase().includes('piscina'));
                  if (selectedFromModal.length === 0) {
                    setNotification({ message: 'No existe el servicio de piscina. Créalo en la pestaña Servicios o intente de nuevo.', type: 'error' });
                    return;
                  }
                  selectedFromModal = [selectedFromModal[0]];
                  setPresupuestoPiscinaMode(false);
                } else {
                  const modalIds = servicioSeleccionadosEnModal.map((id) => Number(id)).filter((id) => id != null && !Number.isNaN(id));
                  selectedFromModal = servicios.filter((s) => modalIds.includes(Number(s.id)));
                  if (selectedFromModal.length === 0) return;
                }

                if (modalAnadirOtroServicioRef.current) {
                  modalAnadirOtroServicioRef.current = false;
                  const existingIds = selectedServiciosPresupuesto.map((s) => Number(s.id)).filter((id) => id != null && !Number.isNaN(id));
                  const newSelected = [...selectedServiciosPresupuesto];
                  for (const s of selectedFromModal) {
                    const sid = Number(s.id);
                    if (!existingIds.includes(sid)) {
                      newSelected.push(s);
                      existingIds.push(sid);
                      const tipo = derivarTipoDesdeServicio(s.nombre);
                      if (tipo === 'cubos') {
                        const prevCubos = newSelected.filter((x) => derivarTipoDesdeServicio(x.nombre) === 'cubos').length;
                        if (prevCubos === 1) setPresupuestoCalculoCubos((p) => ({ concepto: p?.concepto ?? 'Gestión cubos de basura', precioSinIva: p?.precioSinIva ?? '' }));
                        else setPresupuestoCalculoCubosRest((prev) => [...prev, { concepto: 'Gestión cubos de basura', precioSinIva: '' }]);
                      } else if (tipo === 'jardineria') {
                        const prevJard = newSelected.filter((x) => derivarTipoDesdeServicio(x.nombre) === 'jardineria').length;
                        if (prevJard === 1) setPresupuestoCalculoJardineria((p) => ({ concepto: p?.concepto ?? '', precioSinIva: p?.precioSinIva ?? '' }));
                        else setPresupuestoCalculoJardineriaRest((prev) => [...prev, { concepto: '', precioSinIva: '' }]);
                      } else if (tipo === 'limpieza') {
                        const prevLimp = newSelected.filter((x) => derivarTipoDesdeServicio(x.nombre) === 'limpieza').length;
                        if (prevLimp > 1) setPresupuestoCalculoLimpiezaRest((prev) => [...prev, { ...presupuestoCalculoLimpieza }]);
                      } else if (tipo === 'auxiliares') {
                        const prevAux = newSelected.filter((x) => derivarTipoDesdeServicio(x.nombre) === 'auxiliares').length;
                        if (prevAux > 1) setPresupuestoCalculoAuxiliaresRest((prev) => [...prev, { ...presupuestoCalculo }]);
                      } else if (tipo === 'piscina') {
                        const prevPiscina = newSelected.filter((x) => derivarTipoDesdeServicio(x.nombre) === 'piscina').length;
                        if (prevPiscina === 1) setPresupuestoCalculoPiscina((p) => ({ concepto: p?.concepto ?? 'Mantenimiento integral en piscina comunitaria', horas: p?.horas ?? '', dias: p?.dias ?? '', precioSinIva: p?.precioSinIva ?? '' }));
                        else setPresupuestoCalculoPiscinaRest((prev) => [...prev, { concepto: 'Mantenimiento integral en piscina comunitaria', horas: '', dias: '', precioSinIva: '', horarioPeriodos: [] }]);
                      }
                    }
                  }
                  setSelectedServiciosPresupuesto(newSelected);
                  setPresupuestoCalculo((prev) => ({ ...prev, nombre: newSelected.map((s) => servicioNombreTexto(s.nombre)).join(', ') }));
                } else {
                  setSelectedServiciosPresupuesto(selectedFromModal);
                  setTipoServicioPresupuesto(derivarTipoDesdeServicio(selectedFromModal[0].nombre));
                  setPresupuestoCalculo((prev) => ({ ...prev, nombre: selectedFromModal.map((s) => servicioNombreTexto(s.nombre)).join(', ') }));
                  if (derivarTipoDesdeServicio(selectedFromModal[0].nombre) === 'piscina') {
                    setPresupuestoCalculoPiscina((p) => ({ concepto: p?.concepto ?? 'Mantenimiento integral en piscina comunitaria', horas: p?.horas ?? '', dias: p?.dias ?? '', precioSinIva: p?.precioSinIva ?? '' }));
                  }
                }
                setShowModalSeleccionServicioPresupuesto(false);
                setServicioSeleccionadosEnModal([]);
                setShowNuevoPresupuestoForm(true);
              }}
            >
              Continuar
            </Button>
          </div>
        </Modal>

          {activeTab === 'informes' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Gestión de Informes
              </h2>
              <nav className="flex space-x-6 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setInformesSubTab('factura')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    informesSubTab === 'factura'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Factura
                </button>
                <button
                  onClick={() => setInformesSubTab('items')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    informesSubTab === 'items'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Ítems
                </button>
                <button
                  onClick={() => setInformesSubTab('moneda')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    informesSubTab === 'moneda'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Moneda
                </button>
                <button
                  onClick={() => setInformesSubTab('informes')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    informesSubTab === 'informes'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Informes
                </button>
              </nav>
              {informesSubTab === 'factura' && (
                <div className="py-4">
                  <p className="text-gray-600 mb-6">
                    Configuración de factura / presupuesto por ítems. Pasos:
                  </p>

                  {/* Cliente + Datos de empresa: unul lângă altul sus */}
                  <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Paso 1: Cliente del presupuesto */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Paso 1 — Cliente del presupuesto</h3>
                      <p className="text-gray-600 text-sm mb-3">Seleccione el cliente para quien es este presupuesto / factura.</p>
                      {loadingClientes ? (
                        <p className="text-gray-500 text-sm">Cargando lista de clientes...</p>
                      ) : (
                        <>
                          <select
                            value={facturaClienteId ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFacturaClienteId(v === '' ? null : Number(v));
                            }}
                            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          >
                            <option value="">— Seleccione un cliente —</option>
                            {clientesList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? `Cliente ${c.id}`}
                              </option>
                            ))}
                          </select>
                          {facturaClienteId != null && (() => {
                            const c = clientesList.find((x) => Number(x.id) === facturaClienteId);
                            if (!c) return null;
                            return (
                              <div className="mt-3 text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
                                <div><strong>{c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? '—'}</strong></div>
                                {c.NIF && <div>NIF: {c.NIF}</div>}
                                {c.DIRECCION && <div>Dirección: {c.DIRECCION}</div>}
                                {(c.CODIGO_POSTAL || c.POBLACION) && (
                                  <div>{[c.CODIGO_POSTAL, c.POBLACION].filter(Boolean).join(' — ')}</div>
                                )}
                                {c.PROVINCIA && <div>{c.PROVINCIA}</div>}
                                {(c.EMAIL || c.email) && <div>Email: {c.EMAIL ?? c.email}</div>}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {/* Datos de empresa (cabecera factura) — lângă cliente */}
                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Datos de empresa (cabecera factura)</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título / Razón social</label>
                            <Input
                              value={facturaForm.titulo_empresa}
                              onChange={(e) => setFacturaForm(prev => ({ ...prev, titulo_empresa: e.target.value }))}
                              placeholder="Ej: DE CAMINO SERVICIOS AUXILIARES, S.L."
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                            <Input
                              value={facturaForm.direccion_empresa}
                              onChange={(e) => setFacturaForm(prev => ({ ...prev, direccion_empresa: e.target.value }))}
                              placeholder="Ej: Avda. Euzkadi 14, Local 5"
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CP y Población</label>
                            <Input
                              value={facturaForm.cp_poblacion_empresa}
                              onChange={(e) => setFacturaForm(prev => ({ ...prev, cp_poblacion_empresa: e.target.value }))}
                              placeholder="Ej: 28700 - San Sebastian de los Reyes"
                              className="w-full"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <Input
                                type="email"
                                value={facturaForm.email_empresa}
                                onChange={(e) => setFacturaForm(prev => ({ ...prev, email_empresa: e.target.value }))}
                                placeholder="info@decaminoservicios.com"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                              <Input
                                value={facturaForm.telefono_empresa}
                                onChange={(e) => setFacturaForm(prev => ({ ...prev, telefono_empresa: e.target.value }))}
                                placeholder="645 111 999"
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Presupuesto nr y Fecha emisión — visibles en tab Factura */}
                  <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Presupuesto nr y Fecha emisión</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto nr</label>
                        <div className="text-gray-900 font-medium">
                          {facturaClienteId != null
                            ? (() => {
                                const lastForCliente = facturaPresupuestosList
                                  .filter((p) => p.cliente_id === facturaClienteId)
                                  .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
                                return lastForCliente?.numero_presupuesto || 'Se asignará al guardar en Presupuestos (ej: MAD2026XXXX)';
                              })()
                            : 'Seleccione un cliente para ver el último número'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha emisión</label>
                        <div className="text-gray-900">
                          En el documento se usará la <strong>fecha de creación</strong> del presupuesto al guardarlo en la pestaña Presupuestos.
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Referencia hoy: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {loadingFacturaConfig ? (
                    <p className="text-gray-600">Cargando configuración...</p>
                  ) : (
                    <div className="space-y-6 max-w-6xl">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Paso 2 — Parámetros</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tasa IVA (%)</label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={facturaForm.tasa_iva}
                              onChange={(e) => setFacturaForm(prev => ({ ...prev, tasa_iva: e.target.value }))}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tasa descuento (%)</label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={facturaForm.tasa_descuento}
                              onChange={(e) => setFacturaForm(prev => ({ ...prev, tasa_descuento: e.target.value }))}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Líneas de factura: tabla Descripción, Precio unit., Cant., Total + SUB TOTAL, IVA, TOTAL */}
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm w-full">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Líneas de factura</h3>
                        <div className="overflow-x-auto w-full">
                          <table className="w-full min-w-[600px] border-collapse border border-gray-300 text-sm table-fixed">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800 w-[50%]">Descripción</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800 w-32">Precio unit.</th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-800 w-24">Cant.</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800 w-32">Total</th>
                                <th className="border border-gray-300 px-3 py-2 w-12"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {facturaLineas.map((linia, index) => {
                                const total = (Number(linia.precioUnitario) || 0) * (Number(linia.cantidad) || 0);
                                return (
                                  <tr key={linia.id ?? index} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-3 py-2">
                                      <select
                                        value={linia.itemId ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '') {
                                            setFacturaLineas(prev => prev.map((l, i) => i === index ? { ...l, itemId: null, nombre: '', descripcion: '', precioUnitario: '' } : l));
                                            return;
                                          }
                                          const item = informesItems.find((it) => String(it.id) === val || String(it.item_id) === val);
                                          if (item) {
                                            const nombre = item.nombre ?? item.descripcion ?? '';
                                            const descripcionLarga = item.descripcion ?? '';
                                            const precio = item.precio != null ? Number(item.precio) : '';
                                            setFacturaLineas(prev => prev.map((l, i) => i === index ? { ...l, itemId: val, nombre, descripcion: descripcionLarga, precioUnitario: precio } : l));
                                          }
                                        }}
                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                      >
                                        <option value="">— Seleccionar ítem —</option>
                                        {informesItems.filter((it) => it.activo !== false).map((it) => (
                                          <option key={it.id} value={it.id}>
                                            {(it.nombre || it.descripcion || it.item_id || '').substring(0, 80)}{(it.nombre || it.descripcion || '').length > 80 ? '…' : ''} {it.precio != null ? `(${Number(it.precio).toFixed(2)} €)` : ''}
                                          </option>
                                        ))}
                                      </select>
                                      {informesItems.length === 0 && !loadingInformesItems && (
                                        <p className="text-xs text-amber-600 mt-1">Añade ítems en la pestaña Items.</p>
                                      )}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={linia.precioUnitario ?? ''}
                                        onChange={(e) => setFacturaLineas(prev => prev.map((l, i) => i === index ? { ...l, precioUnitario: e.target.value } : l))}
                                        className="border-0 border-b border-gray-200 focus:ring-0 py-1 text-sm text-right w-full"
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                      <Input
                                        type="number"
                                        min="1"
                                        value={linia.cantidad ?? 1}
                                        onChange={(e) => setFacturaLineas(prev => prev.map((l, i) => i === index ? { ...l, cantidad: e.target.value } : l))}
                                        className="border-0 border-b border-gray-200 focus:ring-0 py-1 text-sm text-center w-full"
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-medium">
                                      {total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1">
                                      <button
                                        type="button"
                                        onClick={() => setFacturaLineas(prev => prev.filter((_, i) => i !== index))}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        title="Eliminar línea"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setFacturaLineas(prev => [...prev, { id: Date.now(), nombre: '', descripcion: '', precioUnitario: '', cantidad: 1 }])}
                        >
                          <Plus className="w-4 h-4 inline mr-1" />
                          Añadir línea
                        </Button>

                        {/* SUB TOTAL, IVA, TOTAL */}
                        {facturaLineas.length > 0 && (() => {
                          const subtotal = facturaLineas.reduce((sum, l) => sum + (Number(l.precioUnitario) || 0) * (Number(l.cantidad) || 0), 0);
                          const tasaIva = Number(facturaForm.tasa_iva) || 21;
                          const iva = subtotal * (tasaIva / 100);
                          const total = subtotal + iva;
                          const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          return (
                            <div className="mt-4 pt-4 border-t border-gray-200 text-right max-w-xs ml-auto space-y-1">
                              <div className="flex justify-between gap-4"><span className="text-gray-700">SUB TOTAL:</span><span className="font-medium">{fmt(subtotal)} €</span></div>
                              <div className="flex justify-between gap-4"><span className="text-gray-700">{tasaIva}% I.V.A.</span><span className="font-medium">{fmt(iva)} €</span></div>
                              <div className="flex justify-between gap-4 pt-2 border-t border-gray-300"><span className="font-semibold text-gray-900">TOTAL:</span><span className="font-semibold text-lg">{fmt(total)} €</span></div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-6">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!facturaForm.informe_final_temporada}
                            onChange={(e) => setFacturaForm((prev) => ({ ...prev, informe_final_temporada: e.target.checked }))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">Informe final temporada</span>
                        </label>
                        <Button variant="primary" onClick={saveFacturaConfig}>
                          {editingInformeId ? 'Actualizar informe' : 'Guardar informe'}
                        </Button>
                        {editingInformeId && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingInformeId(null);
                              setFacturaClienteId(null);
                              setFacturaLineas([]);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {informesSubTab === 'items' && (
                <div className="py-4">
                  {loadingInformesItems ? (
                    <p className="text-gray-600">Cargando ítems...</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-gray-600">
                          {informesItems.length} ítems para presupuestos (importados desde Excel).
                        </p>
                        <Button onClick={openModalNuevoItem} variant="primary" className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Añadir nuevo ítem
                        </Button>
                      </div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">ID</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Nombre</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Descripción</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Precio (€)</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Observaciones</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase w-24">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {informesItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{item.item_id}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate" title={item.nombre}>{item.nombre}</td>
                                <td className="px-4 py-2 text-sm text-gray-600 max-w-md truncate" title={item.descripcion || ''}>{item.descripcion || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right whitespace-nowrap">
                                  {Number(item.precio).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate" title={item.observaciones || ''}>{item.observaciones || '—'}</td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openModalEditItem(item)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Editar ítem"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {informesItems.length === 0 && !loadingInformesItems && (
                        <p className="text-gray-500 mt-2">No hay ítems. Ejecuta el script de importación desde Excel.</p>
                      )}
                    </>
                  )}
                </div>
              )}
              {informesSubTab === 'moneda' && (
                <div className="py-4">
                  <p className="text-gray-600">
                    Se trabaja únicamente en España. La moneda utilizada en presupuestos e informes es <strong>EUR (Euro)</strong>. No es necesaria ninguna configuración.
                  </p>
                </div>
              )}
              {informesSubTab === 'informes' && (
                <div className="py-4">
                  <p className="text-gray-600 mb-4">
                    Todos los informes guardados (tabla <code className="text-xs bg-gray-100 px-1 rounded">informes_factura_config</code>). Cada &quot;Guardar informe&quot; en el subtab Factura añade uno nuevo.
                  </p>
                  {loadingInformesList && (
                    <p className="text-gray-500 py-4">Cargando lista de informes…</p>
                  )}
                  {!loadingInformesList && informesList.length === 0 && (
                    <p className="text-gray-500 py-4">No hay informes guardados. Ve al subtab Factura, rellena cliente y líneas y pulsa &quot;Guardar informe&quot;.</p>
                  )}
                  {!loadingInformesList && informesList.length > 0 && (
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {informesList.map((inf) => (
                        <li key={inf.id} className="p-4 hover:bg-gray-50">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {inf.informe_final_temporada && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Final temporada</span>
                                )}
                                {inf.firmas && inf.firmas[0] && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Informe firmado electrónicamente">
                                    Firmado el {new Date(inf.firmas[0].created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Cliente:</span>{' '}
                                {inf.cliente_id != null
                                  ? (() => {
                                      const c = clientesList.find((x) => Number(x.id) === Number(inf.cliente_id));
                                      return c ? (c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? `Cliente ${inf.cliente_id}`) : `Cliente ID ${inf.cliente_id}`;
                                    })()
                                  : '— Sin asignar'}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Líneas:</span>{' '}
                                {Array.isArray(inf.lineas_json) ? inf.lineas_json.length : 0} líneas
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Última actualización:</span>{' '}
                                {inf.updated_at ? new Date(inf.updated_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </div>
                              {inf.titulo_empresa && (
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Título empresa:</span>{' '}
                                  <span className="text-gray-600">{inf.titulo_empresa}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => handleDownloadInformePdf(inf.id)}>
                                Descargar PDF
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEnviarInforme(inf)} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                                Enviar Informe
                              </Button>
                              {inf.firmas && inf.firmas[0] && (
                                <Button variant="outline" size="sm" onClick={() => handleDownloadInformePdfFirmado(inf.id)}>
                                  Ver PDF firmado
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handleEditInforme(inf)}>
                                Editar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteInforme(inf.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                                Eliminar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { setEditingInformeId(null); setInformesSubTab('factura'); }}>
                                Ir a Factura
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'clientes' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Clientes
              </h2>
              <p className="text-gray-600 mb-4">
                Lista de clientes reutilizada para presupuestos e informes.
              </p>
              {loadingClientes ? (
                <p className="text-gray-600">Cargando clientes...</p>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Nombre / Razón social</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">NIF</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Teléfono</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Dirección</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Población</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Provincia</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {clientesList.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate" title={c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? ''}>
                              {c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">{c.NIF ?? '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">{c.TELEFONO ?? c.MOVIL ?? '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate" title={c.DIRECCION ?? ''}>{c.DIRECCION ?? '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">{c.POBLACION ?? '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">{c.PROVINCIA ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {clientesList.length === 0 && !loadingClientes && (
                    <p className="text-gray-500 mt-4">No hay clientes en la base de datos.</p>
                  )}
                </>
              )}
            </Card>
          )}
        </div>

        {/* Modal Ítem (Informes) */}
        {showItemModal && (
          <Modal
            isOpen={showItemModal}
            onClose={() => {
              setShowItemModal(false);
              setEditingItem(null);
              setItemForm({ item_id: '', nombre: '', descripcion: '', precio: '', observaciones: '', activo: true });
            }}
            title={editingItem ? 'Editar ítem' : 'Añadir nuevo ítem'}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID ítem *</label>
                <Input
                  value={itemForm.item_id}
                  onChange={(e) => setItemForm(prev => ({ ...prev, item_id: e.target.value }))}
                  placeholder="Ej: ITEM-001"
                  disabled={!!editingItem}
                  className="w-full"
                />
                {editingItem && <p className="text-xs text-gray-500 mt-1">El ID no se puede modificar al editar.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <Input
                  value={itemForm.nombre}
                  onChange={(e) => setItemForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del ítem"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={itemForm.descripcion}
                  onChange={(e) => setItemForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción opcional"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemForm.precio}
                  onChange={(e) => setItemForm(prev => ({ ...prev, precio: e.target.value }))}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <Input
                  value={itemForm.observaciones}
                  onChange={(e) => setItemForm(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Observaciones opcionales"
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="item-activo"
                  checked={itemForm.activo}
                  onChange={(e) => setItemForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="item-activo" className="text-sm text-gray-700">Activo</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowItemModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={saveItemForm}>
                {editingItem ? 'Guardar cambios' : 'Crear ítem'}
              </Button>
            </div>
          </Modal>
        )}

        {/* Modal Servicio */}
        {showServicioModal && (
          <Modal
            isOpen={showServicioModal}
            onClose={() => {
              setShowServicioModal(false);
              setEditingServicio(null);
              setServicioForm({ nombre: '', descripcion_operativa: '', tipo: 'servicio_presupuesto', activo: true });
            }}
            title={editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Servicio *
                </label>
                <div className="quill-wrapper-nombre">
                  <ReactQuill
                    key={`nombre-${modalKey}-${editingServicio?.id || 'new'}`}
                    ref={quillRefNombre}
                    theme="snow"
                    value={servicioForm.nombre || ''}
                    onChange={(value) =>
                      setServicioForm(prev => ({ ...prev, nombre: value }))
                    }
                    placeholder="Ej: Auxiliar de Servicios, Limpieza y Jardinería"
                    bounds="self"
                    preserveWhitespace={false}
                    modules={nombreModules}
                    formats={['bold', 'italic', 'underline', 'color']}
                    style={{ minHeight: '80px', marginBottom: '42px' }}
                  />
                </div>
                <style>{`
                  .quill-wrapper-nombre {
                    border: 1px solid #d1d5db !important;
                    border-radius: 0.5rem !important;
                    overflow: hidden !important;
                  }
                  .quill-wrapper-nombre:focus-within {
                    border-color: #ef4444 !important;
                  }
                  .quill-wrapper-nombre .ql-container,
                  .quill-wrapper-nombre .ql-container.ql-snow,
                  .quill-wrapper-nombre .ql-container.ql-focused,
                  .quill-wrapper-nombre .ql-container:hover,
                  .quill-wrapper-nombre .ql-container:focus {
                    border: none !important;
                    min-height: 80px !important;
                    box-sizing: border-box !important;
                  }
                  .quill-wrapper-nombre .ql-toolbar,
                  .quill-wrapper-nombre .ql-toolbar.ql-snow,
                  .quill-wrapper-nombre .ql-toolbar.ql-focused,
                  .quill-wrapper-nombre .ql-toolbar:hover {
                    border: none !important;
                    border-bottom: 1px solid #d1d5db !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                  }
                  .quill-wrapper-nombre .ql-toolbar button svg,
                  .quill-wrapper-nombre .ql-toolbar .ql-picker svg {
                    display: block !important;
                    width: 18px !important;
                    height: 18px !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                  .quill-wrapper-nombre .ql-toolbar button::before {
                    display: inline-block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                  .quill-wrapper-nombre:focus-within .ql-toolbar {
                    border-bottom-color: #ef4444 !important;
                  }
                  .quill-wrapper-nombre .ql-editor {
                    min-height: 80px !important;
                    padding: 12px !important;
                  }
                  .quill-wrapper-nombre .ql-editor.ql-blank::before {
                    color: #9ca3af !important;
                    font-style: normal !important;
                  }
                `}</style>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción Operativa
                </label>
                <div className="quill-wrapper-descripcion">
                  <ReactQuill
                    key={`descripcion-${modalKey}-${editingServicio?.id || 'new'}`}
                    ref={quillRefDescripcion}
                    theme="snow"
                    value={servicioForm.descripcion_operativa || ''}
                    onChange={(value) =>
                      setServicioForm(prev => ({
                        ...prev,
                        descripcion_operativa: value,
                      }))
                    }
                    placeholder="Describe las operaciones y tareas incluidas en este servicio..."
                    bounds="self"
                    preserveWhitespace={false}
                    modules={descripcionModules}
                    formats={[
                      'header',
                      'bold', 'italic', 'underline', 'strike',
                      'list', 'indent',
                      'color', 'background',
                      'align',
                      'link',
                      'table'
                    ]}
                    style={{ minHeight: '200px', marginBottom: '50px' }}
                  />
                </div>
                <style>{`
                  /* Stil pentru tabel - better-table - FORȚAT VIZIBILITATE */
                  .quill-wrapper-descripcion table,
                  .quill-wrapper-descripcion .ql-table,
                  .quill-wrapper-descripcion table.ql-table,
                  .quill-wrapper-descripcion .qlbt-table,
                  .quill-wrapper-descripcion table.qlbt-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin: 15px 0 !important;
                    border: 2px solid #333 !important;
                    display: table !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    background: white !important;
                    position: relative !important;
                    z-index: 1 !important;
                  }
                  .quill-wrapper-descripcion table td,
                  .quill-wrapper-descripcion .ql-table td,
                  .quill-wrapper-descripcion .qlbt-table td,
                  .quill-wrapper-descripcion .qlbt-cell {
                    border: 2px solid #333 !important;
                    padding: 12px !important;
                    vertical-align: top !important;
                    min-width: 100px !important;
                    min-height: 40px !important;
                    display: table-cell !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    background: white !important;
                    position: relative !important;
                  }
                  .quill-wrapper-descripcion table tr,
                  .quill-wrapper-descripcion .ql-table tr,
                  .quill-wrapper-descripcion .qlbt-table tr,
                  .quill-wrapper-descripcion .qlbt-row {
                    display: table-row !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    background: white !important;
                  }
                  .quill-wrapper-descripcion table tbody,
                  .quill-wrapper-descripcion .ql-table tbody,
                  .quill-wrapper-descripcion .qlbt-table tbody {
                    display: table-row-group !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    background: white !important;
                  }
                  /* Icon pentru butonul addTable */
                  .quill-wrapper-descripcion .ql-addTable::before {
                    content: '⊞' !important;
                    font-size: 16px !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button.ql-addTable {
                    width: 28px !important;
                    height: 28px !important;
                  }
                  .quill-wrapper-descripcion {
                    border: 1px solid #d1d5db !important;
                    border-radius: 0.5rem !important;
                    overflow: hidden !important;
                  }
                  .quill-wrapper-descripcion:focus-within {
                    border-color: #ef4444 !important;
                  }
                  .quill-wrapper-descripcion .ql-container,
                  .quill-wrapper-descripcion .ql-container.ql-snow,
                  .quill-wrapper-descripcion .ql-container.ql-focused,
                  .quill-wrapper-descripcion .ql-container:hover,
                  .quill-wrapper-descripcion .ql-container:focus {
                    border: none !important;
                    min-height: 200px !important;
                    box-sizing: border-box !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar,
                  .quill-wrapper-descripcion .ql-toolbar.ql-snow,
                  .quill-wrapper-descripcion .ql-toolbar.ql-focused,
                  .quill-wrapper-descripcion .ql-toolbar:hover {
                    border: none !important;
                    border-bottom: 1px solid #d1d5db !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    gap: 2px !important;
                    padding: 8px !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar .ql-formats {
                    display: flex !important;
                    align-items: center !important;
                    gap: 2px !important;
                    margin-right: 4px !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button,
                  .quill-wrapper-descripcion .ql-toolbar .ql-picker {
                    margin: 0 1px !important;
                    padding: 4px !important;
                    width: auto !important;
                    min-width: 28px !important;
                    height: 28px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button svg,
                  .quill-wrapper-descripcion .ql-toolbar .ql-picker svg {
                    display: block !important;
                    width: 18px !important;
                    height: 18px !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button::before {
                    display: inline-block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    font-family: 'QuillIcons' !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar .ql-picker-label {
                    padding: 4px 8px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar .ql-stroke {
                    fill: none !important;
                    stroke: #444 !important;
                    stroke-width: 2 !important;
                    stroke-linecap: round !important;
                    stroke-linejoin: round !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar .ql-fill {
                    fill: #444 !important;
                    stroke: none !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button:hover .ql-stroke,
                  .quill-wrapper-descripcion .ql-toolbar button.ql-active .ql-stroke {
                    stroke: #06c !important;
                  }
                  .quill-wrapper-descripcion .ql-toolbar button:hover .ql-fill,
                  .quill-wrapper-descripcion .ql-toolbar button.ql-active .ql-fill {
                    fill: #06c !important;
                  }
                  .quill-wrapper-descripcion:focus-within .ql-toolbar {
                    border-bottom-color: #ef4444 !important;
                  }
                  /* Stiluri pentru imagini în editor */
                  .quill-wrapper-descripcion .ql-editor img,
                  .quill-wrapper-descripcion .ql-container img {
                    max-width: 100% !important;
                    height: auto !important;
                    display: block !important;
                    margin: 10px 0 !important;
                    border: 1px solid #ddd !important;
                    border-radius: 4px !important;
                  }
                  /* Asigură că imaginile din tabele sunt și ele responsive */
                  .quill-wrapper-descripcion .ql-editor table img,
                  .quill-wrapper-descripcion .ql-container table img {
                    max-width: 200px !important;
                    height: auto !important;
                  }
                  .quill-wrapper-descripcion .ql-editor {
                    min-height: 200px !important;
                    padding: 12px !important;
                  }
                  .quill-wrapper-descripcion .ql-editor.ql-blank::before {
                    color: #9ca3af !important;
                    font-style: normal !important;
                  }
                `}</style>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activo"
                  checked={servicioForm.activo}
                  onChange={(e) =>
                    setServicioForm(prev => ({ ...prev, activo: e.target.checked }))
                  }
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">
                  Servicio activo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowServicioModal(false);
                    setEditingServicio(null);
                    setServicioForm({ nombre: '', descripcion_operativa: '', tipo: 'servicio_presupuesto', activo: true });
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveServicio}
                  disabled={!servicioForm.nombre.trim() || loadingServicios}
                >
                  {loadingServicios ? 'Guardando...' : editingServicio ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal Plantilla */}
        {showPlantillaModal && (
          <Modal
            isOpen={showPlantillaModal}
            onClose={() => {
              setShowPlantillaModal(false);
              setEditingPlantilla(null);
              setPlantillaForm({ nombre: '', descripcion_operativa: '', activo: true, servicios_seleccionados: [] });
            }}
            title={editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'}
          >
            <div className="space-y-4">
              {/* Buton pentru încărcarea din fișier */}
              <div className="flex justify-end mb-2">
                <input
                  type="file"
                  id="plantilla-file-upload"
                  accept=".docx,.doc,.txt,.html"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                      setLoadingPlantillas(true);
                      let content = '';
                      let fileName = file.name.replace(/\.[^/.]+$/, ''); // Nume fără extensie

                      // Parsează fișierul în funcție de tip
                      if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
                        // Folosește mammoth pentru .docx cu opțiuni pentru a păstra tot conținutul
                        const arrayBuffer = await file.arrayBuffer();
                        
                        // Opțiuni pentru a păstra formatarea completă (tabele, liste, stiluri, numerotare, etc.)
                        const options = {
                          styleMap: [
                            // Păstrează stilurile de paragraf
                            "p[style-name='Heading 1'] => h1:fresh",
                            "p[style-name='Heading 2'] => h2:fresh",
                            "p[style-name='Heading 3'] => h3:fresh",
                            "p[style-name='Title'] => h1.title:fresh",
                            // Păstrează tabelele
                            "table => table",
                            // Păstrează listele numerotate și cu bullet points
                            "p[style-name='List Paragraph'] => p.list:fresh",
                            "p[style-name^='List'] => p:fresh",
                            // Păstrează numerotarea (1., 2., 2.1, etc.)
                            "p[style-name*='Numbering'] => ol > li:fresh",
                            "p[style-name*='List Number'] => ol > li:fresh",
                          ],
                          includeDefaultStyleMap: true,
                          ignoreEmptyParagraphs: false, // Păstrează paragrafele goale pentru structură
                          // Convertește imaginile (logouri, poze) în base64 pentru a le păstra în HTML
                          convertImage: mammoth.images.imgElement(function(image) {
                            return image.read("base64").then(function(imageBuffer) {
                              const base64String = imageBuffer.toString("base64");
                              return {
                                src: "data:" + image.contentType + ";base64," + base64String,
                                style: "max-width: 100%; height: auto; display: block; margin: 10px auto;"
                              };
                            }).catch(function(error) {
                              console.error('❌ Error converting image:', error);
                              // Returnează un placeholder dacă conversia eșuează
                              return {
                                src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                                alt: "Image conversion failed"
                              };
                            });
                          }),
                        };
                        
                        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
                        content = result.value;
                        
                        // Post-procesare pentru a păstra numerotarea manuală (2., 2.1, 2.2, etc.)
                        // Detectează pattern-uri de numerotare manuală în paragrafe
                        const numberedPattern = /<p[^>]*>(\s*)(\d+\.\s*\d*\.?\s*[A-Z][^<]*)<\/p>/gi;
                        const hasManualNumbering = numberedPattern.test(content);
                        
                        if (hasManualNumbering) {
                          // Păstrează numerotarea manuală marcând-o cu bold
                          content = content.replace(/(<p[^>]*>)(\s*)(\d+\.\s*\d*\.?\s*[A-Z][^<]*)(<\/p>)/gi, 
                            (match, openTag, spaces, numberedText, closeTag) => {
                              // Dacă nu este deja bold, adaugă bold la numerotare
                              if (!numberedText.includes('<strong>') && !numberedText.includes('<b>')) {
                                return `${openTag}${spaces}<strong>${numberedText}</strong>${closeTag}`;
                              }
                              return match;
                            }
                          );
                        }
                        
                        // Numără și analizează imaginile din conținut
                        const imageMatches = content.match(/<img[^>]*>/gi) || [];
                        const imageCount = imageMatches.length;
                        const imageDetails = imageMatches.map((img, index) => {
                          const srcMatch = img.match(/src="([^"]*)"/i);
                          const altMatch = img.match(/alt="([^"]*)"/i);
                          return {
                            index: index + 1,
                            srcPreview: srcMatch ? (srcMatch[1].length > 80 ? srcMatch[1].substring(0, 80) + '...' : srcMatch[1]) : 'no src',
                            alt: altMatch ? altMatch[1] : 'no alt',
                            isBase64: srcMatch ? srcMatch[1].includes('data:image') : false
                          };
                        });
                        
                        // Log detaliat despre conversie
                        console.log('📄 DOCX convertit:', {
                          fileName: file.name,
                          contentLength: content.length,
                          hasTables: content.includes('<table'),
                          hasLists: content.includes('<ul') || content.includes('<ol'),
                          hasNumberedLists: content.includes('<ol'),
                          hasManualNumbering: hasManualNumbering,
                          hasImages: content.includes('<img'),
                          imageCount: imageCount,
                          images: imageDetails,
                          sampleContent: content.substring(0, 1000), // Primele 1000 caractere pentru debug
                        });
                        
                        // Dacă nu sunt imagini detectate, avertisment
                        if (imageCount === 0 && file.name.endsWith('.docx')) {
                          console.warn('⚠️ Nu s-au detectat imagini în document. Logo-ul de fundal (watermark) nu poate fi extras cu mammoth - trebuie adăugat programatic la generarea presupuesto-ului.');
                        }
                        
                        // Adaugă mesaje de avertisment dacă există
                        if (result.messages && result.messages.length > 0) {
                          console.warn('⚠️ Mammoth warnings:', result.messages);
                          // Adaugă warnings în notificare dacă sunt importante
                          const importantWarnings = result.messages.filter(m => 
                            m.type === 'error' || m.message.includes('image')
                          );
                          if (importantWarnings.length > 0) {
                            console.warn('⚠️ Warnings importante:', importantWarnings);
                          }
                        }
                        
                        // Extrage numele din primul paragraf/titlu sau folosește numele fișierului
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = content;
                        const title = tempDiv.querySelector('h1, h2, h3, p');
                        if (title && title.textContent.trim()) {
                          fileName = title.textContent.trim().substring(0, 100);
                        }
                      } else if (file.name.endsWith('.txt')) {
                        // Citește ca text simplu și păstrează structura completă
                        const textContent = await file.text();
                        const lines = textContent.split('\n');
                        
                        if (lines[0] && lines[0].trim()) {
                          fileName = lines[0].trim().substring(0, 100);
                        }
                        
                        // Convertește textul în HTML păstrând structura:
                        // - Liniile goale devin <br>
                        // - Liniile cu tab-uri devin paragrafe cu indentare
                        // - Liniile cu spații multiple păstrează spațiile
                        content = lines.map(line => {
                          if (!line.trim()) {
                            return '<p><br></p>'; // Linie goală
                          }
                          // Detectează indentare (tab-uri sau spații multiple)
                          const trimmed = line.trim();
                          const indent = line.length - trimmed.length;
                          if (indent > 0) {
                            // Linie indentată - păstrează indentarea
                            const indentSpaces = '&nbsp;'.repeat(Math.min(indent, 20));
                            return `<p>${indentSpaces}${trimmed.replace(/ /g, '&nbsp;')}</p>`;
                          }
                          // Linie normală
                          return `<p>${trimmed.replace(/ /g, '&nbsp;')}</p>`;
                        }).join('');
                      } else if (file.name.endsWith('.html')) {
                        // Citește ca HTML și păstrează tot conținutul
                        content = await file.text();
                        
                        // Extrage numele din <title>, <h1>, <h2> sau primul paragraf
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = content;
                        const title = tempDiv.querySelector('title, h1, h2, h3');
                        if (title && title.textContent.trim()) {
                          fileName = title.textContent.trim().substring(0, 100);
                        } else {
                          const firstP = tempDiv.querySelector('p');
                          if (firstP && firstP.textContent.trim()) {
                            fileName = firstP.textContent.trim().substring(0, 100);
                          }
                        }
                        
                        // Dacă HTML-ul are <body>, extrage doar conținutul din body
                        const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                        if (bodyMatch) {
                          content = bodyMatch[1];
                        }
                      }

                      // Populează formularul cu conținutul extras
                      const nombreHTML = `<p><strong>${fileName}</strong></p>`;
                      setPlantillaForm(prev => ({
                        ...prev,
                        nombre: nombreHTML,
                        descripcion_operativa: content,
                      }));

                      // Populează explicit editorii ReactQuill după un mic delay
                      setTimeout(() => {
                        try {
                          if (quillRefNombre.current) {
                            const quillNombre = quillRefNombre.current.getEditor();
                            if (quillNombre) {
                              // Șterge conținutul existent
                              quillNombre.setContents([]);
                              // Așteaptă puțin pentru ca editorul să fie gata
                              setTimeout(() => {
                                try {
                                  // Folosește 'user' source pentru a evita eroarea addRange
                                  quillNombre.clipboard.dangerouslyPasteHTML(0, nombreHTML, 'user');
                                } catch (err) {
                                  console.warn('⚠️ Error pasting nombre HTML:', err);
                                  // Fallback: setează direct HTML-ul în root
                                  try {
                                    const root = quillNombre.root;
                                    root.innerHTML = nombreHTML;
                                    quillNombre.update();
                                  } catch (e) {
                                    console.error('❌ Fallback failed:', e);
                                  }
                                }
                              }, 50);
                            }
                          }
                          if (quillRefDescripcion.current) {
                            const quillDescripcion = quillRefDescripcion.current.getEditor();
                            if (quillDescripcion && content) {
                              // Șterge conținutul existent
                              quillDescripcion.setContents([]);
                              // Așteaptă puțin pentru ca editorul să fie gata
                              setTimeout(() => {
                                try {
                                  // Folosește 'user' source pentru a evita eroarea addRange
                                  quillDescripcion.clipboard.dangerouslyPasteHTML(0, content, 'user');
                                } catch (err) {
                                  console.warn('⚠️ Error pasting descripcion HTML:', err);
                                  // Fallback: setează direct HTML-ul în root
                                  try {
                                    const root = quillDescripcion.root;
                                    root.innerHTML = content;
                                    quillDescripcion.update();
                                  } catch (e) {
                                    console.error('❌ Fallback failed:', e);
                                  }
                                }
                              }, 50);
                            }
                          }
                        } catch (error) {
                          console.error('❌ Error populating editors:', error);
                        }
                      }, 300); // Mărit delay-ul pentru a fi sigur că editorii sunt gata

                      // Log final despre ce s-a încărcat
                      console.log('✅ Plantilla încărcată:', {
                        fileName: file.name,
                        nombre: fileName,
                        contentLength: content.length,
                        contentType: file.type,
                      });
                      
                      setNotification({
                        message: `Plantilla cargada desde archivo correctamente (${(content.length / 1024).toFixed(1)} KB)`,
                        type: 'success',
                      });
                    } catch (error) {
                      console.error('Error loading file:', error);
                      setNotification({
                        message: 'Error al cargar el archivo: ' + error.message,
                        type: 'error',
                      });
                    } finally {
                      setLoadingPlantillas(false);
                      // Resetează input-ul pentru a permite re-încărcarea aceluiași fișier
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => document.getElementById('plantilla-file-upload')?.click()}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={loadingPlantillas}
                >
                  <Upload className="h-4 w-4" />
                  {loadingPlantillas ? 'Cargando...' : 'Cargar desde archivo'}
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Plantilla *
                </label>
                <div className="quill-wrapper-nombre">
                  <ReactQuill
                    key={`plantilla-nombre-${modalKey}-${editingPlantilla?.id || 'new'}`}
                    ref={quillRefNombre}
                    theme="snow"
                    value={plantillaForm.nombre || ''}
                    onChange={(value) =>
                      setPlantillaForm(prev => ({ ...prev, nombre: value }))
                    }
                    placeholder="Ej: Plantilla Completa - Limpieza + Jardinería + Auxiliares"
                    bounds="self"
                    preserveWhitespace={false}
                    modules={nombreModules}
                    formats={['bold', 'italic', 'underline', 'color']}
                    style={{ minHeight: '80px', marginBottom: '42px' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción de la Plantilla
                </label>
                <div className="quill-wrapper-descripcion">
                  <ReactQuill
                    key={`plantilla-descripcion-${modalKey}-${editingPlantilla?.id || 'new'}`}
                    ref={quillRefDescripcion}
                    theme="snow"
                    value={plantillaForm.descripcion_operativa || ''}
                    onChange={(value) =>
                      setPlantillaForm(prev => ({
                        ...prev,
                        descripcion_operativa: value,
                      }))
                    }
                    placeholder="Describe la estructura del presupuesto que incluirá esta plantilla. Puedes incluir servicios, precios, condiciones, etc..."
                    bounds="self"
                    preserveWhitespace={false}
                    modules={descripcionModules}
                    formats={['header', 'bold', 'italic', 'underline', 'strike', 'list', 'indent', 'link', 'color', 'background', 'align', 'table']}
                    style={{ minHeight: '300px', marginBottom: '42px' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="plantilla-activo"
                  checked={plantillaForm.activo}
                  onChange={(e) =>
                    setPlantillaForm(prev => ({ ...prev, activo: e.target.checked }))
                  }
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="plantilla-activo" className="text-sm font-medium text-gray-700">
                  Plantilla activa
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowPlantillaModal(false);
                    setEditingPlantilla(null);
                    setPlantillaForm({ nombre: '', descripcion_operativa: '', activo: true, servicios_seleccionados: [] });
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePlantilla}
                  disabled={!plantillaForm.nombre.trim() || loadingPlantillas}
                >
                  {loadingPlantillas ? 'Guardando...' : editingPlantilla ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal Preview Servicio */}
        {showPreviewModal && previewServicio && (
          <Modal
            isOpen={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false);
              setPreviewServicio(null);
            }}
            title="Vista Previa del Servicio"
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Servicio
                </label>
                <div 
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(previewServicio.nombre || '', {
                      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
                      ALLOWED_ATTR: [],
                    })
                  }} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción Operativa
                </label>
                <div 
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[200px] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(
                      previewServicio.descripcion_operativa || 'Sin descripción',
                      {
                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style', 'class'],
                      }
                    )
                  }} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {previewServicio.activo ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      <XCircle className="h-4 w-4" />
                      Inactivo
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewServicio(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Dialog pentru selectarea tabelului */}
        {showTableDialog && (
          <Modal
            isOpen={showTableDialog}
            onClose={() => setShowTableDialog(false)}
            title="Añadir Tabla"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Filas
                </label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={tableConfig.rows}
                  onChange={(e) => setTableConfig(prev => ({ ...prev, rows: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Columnas
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={tableConfig.cols}
                  onChange={(e) => setTableConfig(prev => ({ ...prev, cols: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={() => setShowTableDialog(false)}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    insertTable(tableConfig.rows, tableConfig.cols);
                    setShowTableDialog(false);
                  }}
                >
                  Insertar Tabla
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </div>
  );
}
