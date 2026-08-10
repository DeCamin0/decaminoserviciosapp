import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SectionCard from './SectionCard';
import ConfirmModal from '../ui/ConfirmModal';
import { getPdfMake } from '../../utils/getPdfMake';
import { routes } from '../../utils/routes';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ✅ MIGRAT: folosim backend /api/horas-trabajadas în loc de n8n
const STATUS_ENDPOINT = routes.getHorasTrabajadas;

// ✅ MIGRAT: folosim backend /api/ausencias în loc de n8n
const AUSENCIAS_ENDPOINT = routes.getAusencias;

// ✅ MIGRAT: folosim backend /api/estadisticas în loc de n8n
const RENDIMIENTO_ENDPOINT = routes.getEstadisticas;

const getMonthName = (monthNumber) => MONTH_NAMES[monthNumber - 1] || 'Mes';

/** Duración de un único fichaje por encima de esto = anómala (olvido de salida, etc.) */
const DURACION_ANOMALA_HORAS = 16;

/**
 * Umbral de alerta vs plan en Top Productivos (exceso / déficit).
 * Diferencias menores (ej. +0.2h por minutos de fichaje) no cuentan como alerta.
 */
const ALERTA_DIFF_HORAS = 1;

const convertToDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parts = value.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
  return hours + minutes / 60 + seconds / 3600;
};

const isDuracionAnomala = (duracion) => {
  if (!duracion) return false;
  return convertToDecimal(String(duracion)) >= DURACION_ANOMALA_HORAS;
};

const normaliseEmployeesResponse = (rawData) => {
  if (!rawData) return [];
  if (Array.isArray(rawData)) {
    if (rawData.length > 0 && Array.isArray(rawData[0])) {
      return rawData[0];
    }
    if (rawData.length > 0 && rawData[0]?.empleados) {
      return rawData[0].empleados;
    }
    return rawData;
  }

  if (Array.isArray(rawData.empleados)) {
    return rawData.empleados;
  }

  const arrayProp = Object.values(rawData).find((value) => Array.isArray(value));
  return Array.isArray(arrayProp) ? arrayProp : [];
};

const ChartsSection = forwardRef(({
  stats,
  empleados = [],
  fichajes = [],
  selectedCentro = 'todos',
  selectedPeriod = 'mensual',
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth() + 1
}, ref) => {
  const [activeTab, setActiveTab] = useState('centros');
  const [employeeStatus, setEmployeeStatus] = useState({ ok: 0, enRiesgo: 0, excedido: 0 });
  const [statusLoading, setStatusLoading] = useState(false);

  const [topProductivos, setTopProductivos] = useState([]);
  const [productivosLoading, setProductivosLoading] = useState(false);
  /** Solo presentación: 10 | 20 | 'all' — no cambia backend */
  const [productivosLimit, setProductivosLimit] = useState(10);
  /** Filtro por GRUPO (limpieza, conserje, etc.) — 'todos' = secciones por grupo */
  const [productivosGrupo, setProductivosGrupo] = useState('todos');
  const [productivoModal, setProductivoModal] = useState(null); // { nombre, codigo, horas }
  const [productivoRegistros, setProductivoRegistros] = useState([]);
  const [productivoRegistrosLoading, setProductivoRegistrosLoading] = useState(false);
  const [productivoRegistrosError, setProductivoRegistrosError] = useState(null);
  const [sendFichaLoading, setSendFichaLoading] = useState(false);
  const [sendFichaFeedback, setSendFichaFeedback] = useState(null); // { type: 'ok'|'error', text }
  const [showSendFichaConfirm, setShowSendFichaConfirm] = useState(false);
  /** Envío masivo por grupo: { grupo, destinatarios } | null */
  const [bulkFichaConfirm, setBulkFichaConfirm] = useState(null);
  /** { grupo, current, total, ok, fail, running } | null */
  const [bulkFichaProgress, setBulkFichaProgress] = useState(null);
  const openProductivoModalRef = useRef(null);

  const [ausencias, setAusencias] = useState({ series: [], categories: [] });
  const [ausenciasLoading, setAusenciasLoading] = useState(false);

  const [rendimientoMensual, setRendimientoMensual] = useState([]);
  const [rendimientoLoading, setRendimientoLoading] = useState(false);

  const statusUrl = useMemo(() => {
    const now = new Date();
    const year = selectedYear || now.getFullYear();
    const month = selectedMonth || now.getMonth() + 1;

    if (selectedPeriod === 'anual') {
      return `${STATUS_ENDPOINT}?tipo=anual&ano=${year}`;
    }

    const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;
    return `${STATUS_ENDPOINT}?tipo=mensual&lunaselectata=${formattedMonth}`;
  }, [selectedMonth, selectedPeriod, selectedYear]);

  const filterByCentro = useCallback(
    (dataset) => {
      if (selectedCentro === 'todos') {
        return dataset;
      }

      return dataset.filter((item) => {
        const match = empleados.find((emp) => {
          const sameId = emp.id === item.empleadoId || emp.ID === item.empleadoId;
          const sameCode = emp.CODIGO === item.codigo || emp.codigo === item.codigo;
          return sameId || sameCode;
        });

        if (!match) return false;
        const employeeCentro = (
          match['CENTRO TRABAJO'] ||
          match.centroTrabajo ||
          match.centro ||
          ''
        )
          .toString()
          .toLowerCase();

        return employeeCentro === selectedCentro.toString().toLowerCase();
      });
    },
    [empleados, selectedCentro]
  );

  const fetchEmployeesDataset = useCallback(async () => {
    // Add JWT token for backend API calls
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      // Removed Cache-Control and Pragma headers - they cause CORS issues
      // Browser will handle caching automatically
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[ChartsSection] Fetching employee status from:', statusUrl);
    console.log('[ChartsSection] Headers:', headers);
    console.log('[ChartsSection] Token present:', !!headers['Authorization']);

    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        cache: 'no-store'
      });

      console.log('[ChartsSection] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChartsSection] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('[ChartsSection] Response data type:', typeof data, 'isArray:', Array.isArray(data));
      return normaliseEmployeesResponse(data);
    } catch (error) {
      console.error('[ChartsSection] Fetch error:', error);
      console.error('[ChartsSection] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200)
      });
      // Check if it's a network error (backend not running or CORS issue)
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        console.warn('[ChartsSection] Network error - backend might not be running or CORS issue');
      }
      throw error;
    }
  }, [statusUrl]);

  const calculateStatusFromDataset = useCallback((dataset) => {
    let ok = 0;
    let enRiesgo = 0;
    let excedido = 0;

    dataset.forEach((emp) => {
      const estado = typeof emp.estado === 'string' ? emp.estado.toUpperCase() : '';
      if (estado === 'OK') {
        ok += 1;
        return;
      }
      if (estado === 'ALERTA') {
        enRiesgo += 1;
        return;
      }
      if (estado === 'EXCEDIDO') {
        excedido += 1;
        return;
      }

      const horasTrabajadas = convertToDecimal(
        emp.horasTrabajadas ?? emp.horasTrabajadasAnuales ?? emp.horasTrabajadasMensuales
      );
      const horasPermitidas = convertToDecimal(
        emp.horasPermitidas ?? emp.horasPermitidasAnuales ?? emp.horasPermitidasMensuales
      );

      if (horasPermitidas <= 0) {
        ok += 1;
        return;
      }

      const ratio = (horasTrabajadas / horasPermitidas) * 100;
      if (ratio >= 100) {
        excedido += 1;
      } else if (ratio >= 80) {
        enRiesgo += 1;
      } else {
        ok += 1;
      }
    });

    return { ok, enRiesgo, excedido };
  }, []);

  const loadEmployeeStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const dataset = await fetchEmployeesDataset();
      const filtered = filterByCentro(dataset);
      setEmployeeStatus(calculateStatusFromDataset(filtered));
    } catch (error) {
      console.error('[ChartsSection] Error loading employee status', error);
      // Set default values instead of zeros to avoid breaking the UI
      // The error might be temporary (backend not ready, network issue, etc.)
      setEmployeeStatus({ ok: 0, enRiesgo: 0, excedido: 0 });
      // Don't throw - allow the component to continue rendering
    } finally {
      setStatusLoading(false);
    }
  }, [calculateStatusFromDataset, fetchEmployeesDataset, filterByCentro]);

  const loadTopProductivos = useCallback(async () => {
    setProductivosLoading(true);
    try {
      console.log('📊 [ChartsSection] Loading top productivos, selectedPeriod:', selectedPeriod);
      console.log('📊 [ChartsSection] selectedCentro:', selectedCentro);
      const dataset = await fetchEmployeesDataset();
      console.log('📊 [ChartsSection] Dataset received:', dataset?.length, 'items');
      console.log('📊 [ChartsSection] Full dataset:', dataset);
      console.log('📊 [ChartsSection] First item sample:', dataset?.[0]);
      console.log('📊 [ChartsSection] All keys in first item:', dataset?.[0] ? Object.keys(dataset[0]) : 'no items');
      
      const filtered = filterByCentro(dataset);
      console.log('📊 [ChartsSection] Filtered dataset:', filtered?.length, 'items');
      console.log('📊 [ChartsSection] Filtered dataset sample:', filtered?.[0]);

      if (!filtered || filtered.length === 0) {
        console.warn('📊 [ChartsSection] No data after filtering by centro');
        setTopProductivos([]);
        return;
      }

      const mapped = filtered.map((item) => {
        // Încearcă mai multe variante de câmpuri pentru orele lucrate
        // Pentru perioada MENSUALĂ, endpoint-ul trimite câmpuri agregate numerice precum:
        // total_trabajadas, total_ordinarias, plan, fichado etc.
        let horasRaw;
        if (selectedPeriod === 'anual') {
          horasRaw =
            item.total_trabajadas_anuales ??
            item.total_trabajadas ??
            item.horasTrabajadasAnuales ??
            item.horas_trabajadas_anuales ??
            item['Horas Trabajadas Anuales'] ??
            item['HORAS_TRABAJADAS_ANUALES'] ??
            item.horasAnuales ??
            item.HORAS_ANUALES;
        } else {
          horasRaw =
            item.total_trabajadas ??
            item.total_ordinarias ??
            item.ordinarias ??
            item.horasTrabajadas ??
            item.horas_trabajadas ??
            item['Horas Trabajadas'] ??
            item['HORAS_TRABAJADAS'] ??
            item.horas ??
            item.HORAS ??
            item.horasMensuales ??
            item.HORAS_MENSUALES;
        }
        
        // Încearcă mai multe variante pentru nume
        const nombre = item.empleadoNombre || item.empleado_nombre || item['Empleado Nombre'] || item['NOMBRE / APELLIDOS'] || item.nombre || item.NOMBRE || item.trabajador || item.Trabajador || item['Nombre empleado'] || item['Nombre Empleado'] || 'Sin nombre';
        
        const toHours = (raw) => {
          if (raw == null || raw === '') return 0;
          if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
          if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (!trimmed) return 0;
            if (trimmed.includes(':')) return convertToDecimal(trimmed);
            const n = Number(trimmed.replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
          }
          return 0;
        };

        const horasDecimal = toHours(horasRaw);

        const now = new Date();
        const dayOfMonth = now.getDate();
        const isMesEnCurso =
          selectedPeriod !== 'anual' &&
          Number(selectedYear) === now.getFullYear() &&
          Number(selectedMonth) === now.getMonth() + 1;
        const isAnoEnCurso =
          selectedPeriod === 'anual' && Number(selectedYear) === now.getFullYear();

        let horasPlan = 0;
        let horasPermitidas = 0;
        let horasContratoPeriodo = 0;
        const horasContratoSemanal = toHours(
          item.horas_contrato ?? item['HORAS DE CONTRATO'] ?? item.horasContrato
        );
        const planHastaHoyRaw = item.plan_hasta_hoy ?? item.planHastaHoy;
        const hasPlanHastaHoyField =
          planHastaHoyRaw != null && planHastaHoyRaw !== '';
        const planHastaHoy = toHours(planHastaHoyRaw);
        let planLegitimatelyZero = false;

        let detaliiZilnice = item.detalii_zilnice ?? item.detalles_diarios ?? null;
        if (typeof detaliiZilnice === 'string') {
          try {
            detaliiZilnice = JSON.parse(detaliiZilnice || '[]');
          } catch {
            detaliiZilnice = null;
          }
        }
        const hasDetaliiZilnice = Array.isArray(detaliiZilnice) && detaliiZilnice.length > 0;

        if (selectedPeriod === 'anual') {
          // Año en curso: plan_hasta_hoy (incluido 0 = baja/vac/fiesta hasta hoy)
          if (isAnoEnCurso && hasPlanHastaHoyField) {
            horasPlan = planHastaHoy;
            planLegitimatelyZero = planHastaHoy <= 0;
          } else {
            horasPlan = toHours(
              item.total_plan_anual ?? item.total_plan ?? item.horas_plan_anual ?? item.horas_mes
            );
          }
          horasPermitidas = toHours(
            item.total_permitidas_anual ??
              item.total_permitidas ??
              item.horas_anuales_permitidas ??
              item.horasPermitidasAnuales
          );
          horasContratoPeriodo = toHours(
            item.horas_contrato_anual ?? item.horas_contrato_anuales
          );
          if (horasContratoPeriodo <= 0 && horasContratoSemanal > 0) {
            horasContratoPeriodo = +(horasContratoSemanal * 52.14).toFixed(2);
          }
          if (isAnoEnCurso) {
            const start = new Date(selectedYear, 0, 1);
            const dayOfYear =
              Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
            const daysInYear =
              (selectedYear % 4 === 0 && selectedYear % 100 !== 0) ||
              selectedYear % 400 === 0
                ? 366
                : 365;
            if (horasPermitidas > 0) {
              horasPermitidas = +((horasPermitidas * dayOfYear) / daysInYear).toFixed(2);
            }
            if (horasContratoPeriodo > 0 && !(planHastaHoy > 0)) {
              horasContratoPeriodo = +((horasContratoPeriodo * dayOfYear) / daysInYear).toFixed(2);
            }
          }
        } else {
          // Mes: en curso → plan_hasta_hoy (o prorrateo); meses cerrados → plan completo
          const planMesCompleto = toHours(
            item.total_plan ?? item.horas_mes ?? item.horas_cuadrante_mes ?? item.plan
          );
          const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
          const day = dayOfMonth;

          if (isMesEnCurso) {
            // plan_hasta_hoy=0 es válido (toda la baja/vacaciones): NO prorratear total_plan bruto
            if (hasPlanHastaHoyField || hasDetaliiZilnice) {
              horasPlan = planHastaHoy;
              planLegitimatelyZero = planHastaHoy <= 0;
            } else if (planMesCompleto > 0) {
              horasPlan = +((planMesCompleto * day) / daysInMonth).toFixed(2);
            }
          } else {
            horasPlan = planMesCompleto;
            planLegitimatelyZero = hasDetaliiZilnice && planMesCompleto <= 0;
          }

          horasPermitidas = toHours(
            item.total_permitidas ??
              item.horas_mensuales_permitidas ??
              item.horasPermitidas ??
              item.horasPermitidasMensuales
          );
          horasContratoPeriodo = toHours(item.horas_contrato_mes);
          if (horasContratoPeriodo <= 0 && horasContratoSemanal > 0) {
            horasContratoPeriodo = +((horasContratoSemanal * daysInMonth) / 7).toFixed(2);
          }
          // Fallback permitidas/contrato en mes en curso: prorrateo por día
          if (isMesEnCurso) {
            if (horasPermitidas > 0) {
              horasPermitidas = +((horasPermitidas * day) / daysInMonth).toFixed(2);
            }
            if (horasContratoPeriodo > 0) {
              horasContratoPeriodo = +((horasContratoPeriodo * day) / daysInMonth).toFixed(2);
            }
          }
        }

        // Previstas: plan (hasta hoy) → si plan=0 por baja/vac no usar contrato/permitidas
        let horasPrevistas = 0;
        let fuentePrevistas = null;
        if (horasPlan > 0) {
          horasPrevistas = horasPlan;
          fuentePrevistas =
            isMesEnCurso || isAnoEnCurso ? 'plan hasta hoy' : 'plan';
        } else if (planLegitimatelyZero) {
          horasPrevistas = 0;
          fuentePrevistas = 'plan (0)';
        } else if (horasPermitidas > 0) {
          horasPrevistas = horasPermitidas;
          fuentePrevistas =
            isMesEnCurso || isAnoEnCurso ? 'permitidas (prorrateado)' : 'permitidas';
        } else if (horasContratoPeriodo > 0) {
          horasPrevistas = horasContratoPeriodo;
          fuentePrevistas =
            isMesEnCurso || isAnoEnCurso ? 'contrato (prorrateado)' : 'contrato';
        }

        // Mes en curso: si la jornada de HOY aún no está cerrada (fichado < plan del día),
        // no contar el plan de hoy como déficit (ej. Entrada sin Salida).
        const EPS = 0.05;
        let planHoy = 0;
        let fichadoHoy = 0;
        let jornadaHoyAbierta = false;
        if (isMesEnCurso && horasPrevistas > 0) {
          let todayPlanKnown = false;
          try {
            if (hasDetaliiZilnice) {
              const todayNum = now.getDate();
              const todayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(todayNum).padStart(2, '0')}`;
              const todayZ = detaliiZilnice.find((z) => {
                const zi = Number(z.zi ?? z.dia ?? z.day);
                if (Number.isFinite(zi) && zi === todayNum) return true;
                const ds = String(z.data || z.fecha || z.date || '');
                return ds === todayStr || ds.startsWith(todayStr);
              });
              if (todayZ) {
                planHoy = Number(todayZ.plan ?? 0) || 0;
                fichadoHoy = Number(todayZ.fichado ?? todayZ.trabajadas ?? 0) || 0;
                todayPlanKnown = true;
              }
            }
          } catch {
            /* ignore */
          }
          // Solo inventar plan de hoy si no hay detalle diario del día
          if (!todayPlanKnown && planHoy <= 0 && dayOfMonth > 0) {
            planHoy = +(horasPrevistas / dayOfMonth).toFixed(2);
          }
          jornadaHoyAbierta = planHoy > EPS && fichadoHoy < planHoy - EPS;
          if (jornadaHoyAbierta) {
            horasPrevistas = Math.max(0, +(horasPrevistas - planHoy).toFixed(2));
            fuentePrevistas = 'plan hasta ayer';
          }
        }

        const diff =
          horasPrevistas > 0 ? +(horasDecimal - horasPrevistas).toFixed(2) : null;
        // Alertas solo si la diferencia supera 1h (evita ruido de minutos)
        const supera =
          horasPrevistas > 0 &&
          horasDecimal - horasPrevistas > ALERTA_DIFF_HORAS;
        const bajoPlan =
          horasPrevistas > 0 &&
          horasPrevistas - horasDecimal > ALERTA_DIFF_HORAS;
        const sinFichajes = bajoPlan && horasDecimal <= EPS;
        // Barras: dentro de ±1h se muestra todo en verde (sin exceso/déficit visual)
        let dentroPlan;
        let exceso;
        let deficit;
        if (horasPrevistas <= 0) {
          dentroPlan = horasDecimal;
          exceso = 0;
          deficit = 0;
        } else if (supera) {
          dentroPlan = horasPrevistas;
          exceso = +(horasDecimal - horasPrevistas).toFixed(2);
          deficit = 0;
        } else if (bajoPlan) {
          dentroPlan = horasDecimal;
          exceso = 0;
          deficit = +(horasPrevistas - horasDecimal).toFixed(2);
        } else {
          dentroPlan = horasDecimal;
          exceso = 0;
          deficit = 0;
        }

        const codigo = String(
          item.empleadoId ?? item.CODIGO ?? item.codigo ?? item.Codigo ?? ''
        ).trim();

        const matchEmp = empleados.find((emp) => {
          const code = String(emp.CODIGO ?? emp.codigo ?? '').trim();
          return (
            (codigo && code && code === codigo) ||
            emp.id === item.empleadoId ||
            emp.ID === item.empleadoId
          );
        });

        const grupoRaw =
          item.grupo ??
          item.GRUPO ??
          item.Grupo ??
          matchEmp?.GRUPO ??
          matchEmp?.grupo ??
          item.departamento ??
          item.DEPARTAMENTO ??
          matchEmp?.DEPARTAMENTO ??
          matchEmp?.departamento ??
          '';
        const grupo = String(grupoRaw || '').trim() || 'Sin grupo';
        const isExtrabajador =
          grupo.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
          'EXTRABAJADOR';

        const result = {
          nombre,
          horas: horasDecimal,
          horasPrevistas,
          horasPlan,
          horasPermitidas,
          horasContrato: horasContratoPeriodo,
          fuentePrevistas,
          diff,
          supera,
          bajoPlan,
          sinFichajes,
          jornadaHoyAbierta,
          planHoy: +planHoy.toFixed(2),
          fichadoHoy: +fichadoHoy.toFixed(2),
          dentroPlan: +dentroPlan.toFixed(2),
          exceso: +exceso.toFixed(2),
          deficit: +deficit.toFixed(2),
          diasVacaciones: Number(item.dias_vacaciones ?? item.diasVacaciones ?? 0) || 0,
          diasAusencia: Number(item.dias_ausencia ?? item.diasAusencia ?? 0) || 0,
          diasBaja: Number(item.dias_baja ?? item.diasBaja ?? 0) || 0,
          diasFiesta: Number(item.dias_fiesta ?? item.diasFiesta ?? 0) || 0,
          estado: supera ? 'EXCEDIDO' : bajoPlan ? (sinFichajes ? 'SIN_FICHAJES' : 'BAJO') : 'OK',
          codigo,
          grupo,
          isExtrabajador,
          rawItem: item
        };

        console.log('📊 [ChartsSection] Processing item:', {
          nombre,
          codigo,
          horasRaw,
          horasDecimal,
          horasPrevistas,
          supera,
          estado: result.estado
        });

        return result;
      });

      console.log('📊 [ChartsSection] Mapped items before filtering:', mapped.length);
      console.log('📊 [ChartsSection] Items with hours > 0:', mapped.filter(item => item.horas > 0).length);

      const result = mapped
        .filter((item) => {
          // EXTRABAJADOR = inactivos / pool extra → fuera de Top Productivos y envíos
          if (item.isExtrabajador) return false;
          // Incluye: con horas trabajadas, o con previstas pero sin/pocos fichajes (alerta amarilla)
          return item.horas > 0 || item.horasPrevistas > 0;
        })
        .sort((a, b) => b.horas - a.horas)
        // eslint-disable-next-line no-unused-vars
        .map(({ rawItem, isExtrabajador, ...rest }) => rest);

      console.log('📊 [ChartsSection] Top productivos result:', result);
      console.log('📊 [ChartsSection] Result length:', result.length);
      setTopProductivos(result);
    } catch (error) {
      console.error('[ChartsSection] Error loading top employees', error);
      console.error('[ChartsSection] Error stack:', error.stack);
      setTopProductivos([]);
    } finally {
      setProductivosLoading(false);
    }
  }, [fetchEmployeesDataset, filterByCentro, selectedPeriod, selectedCentro, selectedMonth, selectedYear, empleados]);

  const loadAusencias = useCallback(async () => {
    if (ausencias.series.length > 0) return;

    setAusenciasLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(AUSENCIAS_ENDPOINT, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('No se pudieron obtener las ausencias');
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        setAusencias({ series: [], categories: [] });
        return;
      }

      const months = [...MONTH_NAMES];
      const acumulado = new Map();
      const tipos = new Set();

      data.forEach((item) => {
        const tipo = item.TIPO;
        if (!tipo) return;

        let fechaReferencia;
        if (item.FECHA) {
          const [date] = item.FECHA.split(' - ');
          fechaReferencia = new Date(date);
        } else if (item.created_at) {
          fechaReferencia = new Date(item.created_at);
        }

        if (!fechaReferencia || Number.isNaN(fechaReferencia.getTime())) return;

        const mes = months[fechaReferencia.getMonth()];
        if (!mes) return;

        tipos.add(tipo);
        const key = `${tipo}-${mes}`;
        acumulado.set(key, (acumulado.get(key) || 0) + 1);
      });

      const tiposOrdenados = Array.from(tipos);
      const series = tiposOrdenados.map((tipo) => ({
        name: tipo,
        data: months.map((mes) => acumulado.get(`${tipo}-${mes}`) || 0)
      }));

      setAusencias({ series, categories: months });
    } catch (error) {
      console.error('[ChartsSection] Error loading ausencias', error);
      setAusencias({ series: [], categories: [] });
    } finally {
      setAusenciasLoading(false);
    }
  }, [ausencias.series.length]);

  const loadRendimientoMensual = useCallback(async () => {
    setRendimientoLoading(true);
    try {
      const year = selectedYear || new Date().getFullYear();
      const now = new Date();
      const maxMonth =
        year === now.getFullYear() ? now.getMonth() + 1 : 12;

      // Agregare pe luni din fichajes deja încărcate (graficul e „ore pe lună”, nu pe angajat).
      const codigosCentro =
        selectedCentro && selectedCentro !== 'todos'
          ? new Set(
              empleados
                .filter(
                  (emp) =>
                    (
                      emp['CENTRO TRABAJO'] ||
                      emp.centroTrabajo ||
                      ''
                    )
                      .toString()
                      .toLowerCase() === selectedCentro.toString().toLowerCase(),
                )
                .map((emp) =>
                  String(emp.CODIGO || emp.codigo || emp.id || '').trim(),
                )
                .filter(Boolean),
            )
          : null;

      const emailsCentro =
        selectedCentro && selectedCentro !== 'todos'
          ? new Set(
              empleados
                .filter(
                  (emp) =>
                    (
                      emp['CENTRO TRABAJO'] ||
                      emp.centroTrabajo ||
                      ''
                    )
                      .toString()
                      .toLowerCase() === selectedCentro.toString().toLowerCase(),
                )
                .map((emp) =>
                  String(emp['CORREO ELECTRONICO'] || emp.email || '')
                    .trim()
                    .toLowerCase(),
                )
                .filter(Boolean),
            )
          : null;

      const totalsByMonth = Array.from({ length: 12 }, () => 0);
      let usedFichajes = false;

      if (Array.isArray(fichajes) && fichajes.length > 0) {
        for (const f of fichajes) {
          const fecha = String(f.FECHA || f.fecha || '');
          if (!fecha.startsWith(`${year}-`)) continue;

          if (codigosCentro || emailsCentro) {
            const codigo = String(f.CODIGO || f.codigo || '').trim();
            const email = String(
              f['CORREO ELECTRONICO'] || f.email || '',
            )
              .trim()
              .toLowerCase();
            const okCodigo = codigo && codigosCentro?.has(codigo);
            const okEmail = email && emailsCentro?.has(email);
            if (!okCodigo && !okEmail) continue;
          }

          const mesNum = parseInt(fecha.slice(5, 7), 10);
          if (!mesNum || mesNum < 1 || mesNum > 12) continue;

          // Ore pe DURACION (de obicei pe Salida); evităm dublarea pe Entrada fără durată
          const dur = convertToDecimal(f.DURACION || f.duracion || '0');
          if (dur > 0) {
            totalsByMonth[mesNum - 1] += dur;
            usedFichajes = true;
          }
        }
      }

      // Fallback: un singur request pe luna curentă din filtrul paginii (sumă pe angajați)
      if (!usedFichajes) {
        const token = localStorage.getItem('auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const monthToFetch = selectedMonth || maxMonth;
        const response = await fetch(RENDIMIENTO_ENDPOINT, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            tipo: 'mensual',
            ano: year,
            mes: monthToFetch,
            centro: selectedCentro || 'todos',
            tipoRaport: 'horasTrabajadasMensuales',
          }),
        });

        if (!response.ok) {
          throw new Error('No se pudo obtener el rendimiento mensual');
        }

        const data = await response.json();
        const array = normaliseEmployeesResponse(data);
        const total = array.reduce((sum, item) => {
          const horas =
            item.ore_lucrate ??
            item.totalHoras ??
            item.horasTrabajadas ??
            0;
          const valor =
            typeof horas === 'number' ? horas : parseFloat(horas || '0');
          return sum + (Number.isFinite(valor) ? valor : 0);
        }, 0);
        totalsByMonth[monthToFetch - 1] = Math.round(total * 100) / 100;
      }

      const mapped = [];
      for (let m = 1; m <= maxMonth; m += 1) {
        mapped.push({
          x: MONTH_NAMES_SHORT[m - 1],
          y: Math.round(totalsByMonth[m - 1] * 100) / 100,
        });
      }

      setRendimientoMensual(mapped);
    } catch (error) {
      console.error('[ChartsSection] Error loading rendimiento mensual', error);
      setRendimientoMensual([]);
    } finally {
      setRendimientoLoading(false);
    }
  }, [empleados, fichajes, selectedCentro, selectedMonth, selectedYear]);

  useEffect(() => {
    loadEmployeeStatus();
  }, [loadEmployeeStatus]);

  useEffect(() => {
    if (activeTab === 'productivos') {
      loadTopProductivos();
    }
  }, [activeTab, loadTopProductivos]);

  useEffect(() => {
    if (activeTab === 'dias') {
      loadAusencias();
    }
  }, [activeTab, loadAusencias]);

  useEffect(() => {
    if (activeTab === 'mensual') {
      loadRendimientoMensual();
    }
  }, [activeTab, loadRendimientoMensual]);

  const employeeDistribution = useMemo(() => {
    if (!empleados.length) {
      return {
        activos: stats.empleadosActivos || 0,
        inactivos: stats.empleadosInactivos || 0,
        pendientes: 0
      };
    }

    const filtered = selectedCentro === 'todos'
      ? empleados
      : empleados.filter(
          (emp) => (emp['CENTRO TRABAJO'] || emp.centroTrabajo || '').toString().toLowerCase() === selectedCentro.toString().toLowerCase()
        );

    const activos = filtered.filter((emp) => emp.ESTADO?.toString().toUpperCase() === 'ACTIVO').length;
    const inactivos = filtered.filter((emp) => emp.ESTADO?.toString().toUpperCase() === 'INACTIVO').length;
    const pendientes = filtered.filter((emp) => emp.ESTADO?.toString().toUpperCase() === 'PENDIENTE').length;

    return { activos, inactivos, pendientes };
  }, [empleados, selectedCentro, stats.empleadosActivos, stats.empleadosInactivos]);

  const centrosDistribution = useMemo(() => {
    const conteo = new Map();
    empleados.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro';
      conteo.set(centro, (conteo.get(centro) || 0) + 1);
    });

    let sinCentro = 0;
    const centros = [];
    for (const [centro, count] of conteo.entries()) {
      if (centro === 'Sin Centro') {
        sinCentro = count;
      } else {
        centros.push({ x: centro, y: count });
      }
    }
    centros.sort((a, b) => b.y - a.y);
    return { sinCentro, centros };
  }, [empleados]);

  const productivosGruposDisponibles = useMemo(() => {
    const set = new Set();
    topProductivos.forEach((e) => {
      if (e.grupo) set.add(e.grupo);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [topProductivos]);

  const applyProductivosLimit = useCallback((list) => {
    if (productivosLimit === 'all') return list;
    return list.slice(0, Number(productivosLimit));
  }, [productivosLimit]);

  /** Secciones: un bloque por grupo (o uno solo si hay filtro). Top N se aplica dentro de cada grupo. */
  const productivosSections = useMemo(() => {
    const byGrupo = new Map();
    topProductivos.forEach((emp) => {
      const g = emp.grupo || 'Sin grupo';
      if (!byGrupo.has(g)) byGrupo.set(g, []);
      byGrupo.get(g).push(emp);
    });

    const groupNames =
      productivosGrupo === 'todos'
        ? productivosGruposDisponibles
        : productivosGruposDisponibles.filter((g) => g === productivosGrupo);

    return groupNames
      .map((grupo) => {
        const full = (byGrupo.get(grupo) || []).slice().sort((a, b) => b.horas - a.horas);
        const items = applyProductivosLimit(full);
        const alertados = full.filter((e) => e.supera || e.bajoPlan);
        return {
          grupo,
          totalEnGrupo: full.length,
          items,
          alertados,
          alertas: alertados.filter((e) => e.supera).length,
          alertasBajo: alertados.filter((e) => e.bajoPlan).length
        };
      })
      .filter((s) => s.items.length > 0);
  }, [
    topProductivos,
    productivosGrupo,
    productivosGruposDisponibles,
    applyProductivosLimit
  ]);

  const displayedProductivos = useMemo(
    () => productivosSections.flatMap((s) => s.items),
    [productivosSections]
  );

  const buildProductivosChart = useCallback((list, titleSuffix = '') => {
    const categories = list.map((emp) => emp.nombre);
    return {
      series: [
        {
          name: 'Dentro del plan',
          data: list.map((emp) => emp.dentroPlan ?? emp.horas ?? 0)
        },
        {
          name: 'Déficit (faltan horas)',
          data: list.map((emp) => emp.deficit ?? 0)
        },
        {
          name: 'Exceso (alerta)',
          data: list.map((emp) => emp.exceso ?? 0)
        }
      ],
      options: {
        chart: {
          type: 'bar',
          stacked: true,
          height: Math.max(280, Math.max(list.length, 1) * 36),
          toolbar: { show: true },
          events: {
            click: (_event, _chartContext, config) => {
              const idx = config?.dataPointIndex;
              if (idx == null || idx < 0) return;
              const emp = list[idx];
              if (emp) openProductivoModalRef.current?.(emp);
            }
          }
        },
        colors: ['#10b981', '#eab308', '#ef4444'],
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 3,
            barHeight: '70%',
            dataLabels: {
              total: {
                enabled: true,
                offsetX: 8,
                style: {
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#374151'
                },
                formatter: (_val, opts) => {
                  const emp = list[opts.dataPointIndex];
                  if (!emp) return '';
                  if (emp.sinFichajes) {
                    return `0h (sin fichajes)`;
                  }
                  if (emp.supera && emp.diff != null) {
                    return `${emp.horas.toFixed(1)}h (+${emp.diff.toFixed(1)})`;
                  }
                  if (emp.bajoPlan && emp.diff != null) {
                    return `${emp.horas.toFixed(1)}h (${emp.diff.toFixed(1)})`;
                  }
                  return `${Number(emp.horas || 0).toFixed(1)}h`;
                }
              }
            }
          }
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories,
          title: { text: 'Horas trabajadas vs previstas' },
          min: 0
        },
        yaxis: {
          labels: {
            maxWidth: 220,
            trim: false,
            style: { fontSize: '11px' }
          }
        },
        title: {
          text: titleSuffix
            ? `${titleSuffix} · Top ${list.length}`
            : `Top ${list.length} Empleados más Productivos`,
          align: 'left',
          style: { fontSize: '14px', fontWeight: 600 }
        },
        legend: {
          show: true,
          position: 'top',
          horizontalAlign: 'left',
          fontSize: '12px'
        },
        tooltip: {
          shared: true,
          intersect: false,
          custom: ({ dataPointIndex }) => {
            const emp = list[dataPointIndex];
            if (!emp) return '';
            const fuenteLabel =
              emp.fuentePrevistas === 'plan'
                ? 'plan'
                : emp.fuentePrevistas === 'plan hasta hoy'
                  ? 'plan hasta hoy'
                  : emp.fuentePrevistas === 'plan hasta ayer'
                    ? 'plan hasta ayer (hoy en curso)'
                  : emp.fuentePrevistas === 'permitidas'
                    ? 'permitidas'
                    : emp.fuentePrevistas === 'permitidas (prorrateado)'
                      ? 'permitidas hasta hoy'
                      : emp.fuentePrevistas === 'contrato'
                        ? 'media contrato'
                        : emp.fuentePrevistas === 'contrato (prorrateado)'
                          ? 'contrato hasta hoy'
                          : emp.fuentePrevistas || '';
            const previstasLabel =
              emp.horasPrevistas > 0
                ? `${emp.horasPrevistas.toFixed(1)}h (${fuenteLabel})`
                : 'Sin horas previstas';
            const diffLabel =
              emp.diff == null
                ? '—'
                : `${emp.diff > 0 ? '+' : ''}${emp.diff.toFixed(1)}h`;
            const diffColor = emp.supera
              ? '#b91c1c'
              : emp.bajoPlan
                ? '#a16207'
                : '#047857';
            let alerta = '';
            if (emp.jornadaHoyAbierta) {
              alerta =
                '<div style="margin-top:6px;color:#0369a1;font-weight:600">⏱ Jornada de hoy en curso — no cuenta como déficit</div>';
            }
            if (emp.sinFichajes) {
              alerta +=
                '<div style="margin-top:6px;color:#a16207;font-weight:700">⚠ Tiene horas previstas pero sin fichajes</div>';
            } else if (emp.supera) {
              alerta +=
                '<div style="margin-top:6px;color:#b91c1c;font-weight:700">⚠ Supera horas previstas</div>';
            } else if (emp.bajoPlan) {
              alerta +=
                '<div style="margin-top:6px;color:#a16207;font-weight:700">⚠ Por debajo de horas previstas</div>';
            }
            const diasBits = [];
            if (emp.diasVacaciones > 0) diasBits.push(`${emp.diasVacaciones} vacaciones`);
            if (emp.diasAusencia > 0) diasBits.push(`${emp.diasAusencia} ausencias`);
            if (emp.diasBaja > 0) diasBits.push(`${emp.diasBaja} baja`);
            if (emp.diasFiesta > 0) diasBits.push(`${emp.diasFiesta} fiesta`);
            const diasHtml = diasBits.length
              ? `<div style="margin-top:6px;font-size:11px;color:#6b7280">Ya descontado del plan: ${diasBits.join(' · ')}</div>`
              : `<div style="margin-top:6px;font-size:11px;color:#6b7280">Vacaciones/ausencias/baja ya restan del plan previsto</div>`;
            return `
              <div style="padding:10px 12px;min-width:200px">
                <div style="font-weight:700;margin-bottom:4px">${emp.nombre}</div>
                <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${emp.grupo || 'Sin grupo'}</div>
                <div>Trabajadas: <b>${emp.horas.toFixed(1)}h</b></div>
                <div>Previstas: <b>${previstasLabel}</b></div>
                <div>Diferencia: <b style="color:${diffColor}">${diffLabel}</b></div>
                ${alerta}
                ${diasHtml}
                <div style="margin-top:8px;font-size:11px;color:#6b7280">Clic para ver registros</div>
              </div>
            `;
          }
        },
        states: {
          active: { filter: { type: 'none' } }
        }
      }
    };
  }, []);

  const productivosSectionsCharts = useMemo(
    () =>
      productivosSections.map((section) => ({
        ...section,
        chart: buildProductivosChart(section.items, section.grupo)
      })),
    [productivosSections, buildProductivosChart]
  );

  const closeProductivoModal = useCallback(() => {
    setProductivoModal(null);
    setProductivoRegistros([]);
    setProductivoRegistrosError(null);
    setProductivoRegistrosLoading(false);
    setSendFichaLoading(false);
    setSendFichaFeedback(null);
    setShowSendFichaConfirm(false);
  }, []);

  useEffect(() => {
    if (!productivoModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeProductivoModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [productivoModal, closeProductivoModal]);

  const openProductivoModal = useCallback(async (emp) => {
    if (!emp?.codigo) {
      setProductivoModal({ ...emp, codigo: '' });
      setProductivoRegistros([]);
      setProductivoRegistrosError('No se encontró el código del empleado');
      return;
    }

    setProductivoModal(emp);
    setProductivoRegistros([]);
    setProductivoRegistrosError(null);
    setProductivoRegistrosLoading(true);
    setSendFichaFeedback(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      let url;
      if (selectedPeriod === 'anual') {
        url = `${routes.getRegistrosPeriodo}?fecha_inicio=${selectedYear}-01-01&fecha_fin=${selectedYear}-12-31&codigo=${encodeURIComponent(emp.codigo)}`;
      } else {
        const mes = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(emp.codigo)}&MES=${encodeURIComponent(mes)}`;
      }

      const response = await fetch(url, { headers, credentials: 'include', cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Error ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data ? [data] : [];

      const mapped = list.map((item) => ({
        id: item.ID ?? item.id ?? null,
        codigo: item.CODIGO ?? item.codigo ?? emp.codigo,
        tipo: item.TIPO ?? item.tipo ?? '-',
        fecha: item.FECHA ?? item.fecha ?? item.data ?? '',
        hora: item.HORA ?? item.hora ?? '-',
        duracion: item.effective_duration || item.EFFECTIVE_DURATION || item.DURACION || item.duracion || item.duration || '',
        duracionOriginal: item.DURACION || item.duracion || '',
        direccion: item.DIRECCION || item.address || item.direccion || '',
        hasRegularizacion: Number(item.has_regularizacion || item.HAS_REGULARIZACION || 0) === 1
      }));

      mapped.sort((a, b) => {
        const da = `${a.fecha || ''} ${a.hora || ''}`;
        const db = `${b.fecha || ''} ${b.hora || ''}`;
        return db.localeCompare(da);
      });

      setProductivoRegistros(mapped);
    } catch (error) {
      console.error('[ChartsSection] Error loading registros productivo:', error);
      setProductivoRegistrosError(error.message || 'No se pudieron cargar los registros');
      setProductivoRegistros([]);
    } finally {
      setProductivoRegistrosLoading(false);
    }
  }, [selectedMonth, selectedPeriod, selectedYear]);

  useEffect(() => {
    openProductivoModalRef.current = openProductivoModal;
  }, [openProductivoModal]);

  const productivoPeriodLabel = useMemo(() => {
    if (selectedPeriod === 'anual') return `Año ${selectedYear}`;
    return `${getMonthName(selectedMonth)} ${selectedYear}`;
  }, [selectedMonth, selectedPeriod, selectedYear]);

  const productivoTotalHoras = useMemo(() => {
    return productivoRegistros.reduce((sum, r) => {
      if (!r.duracion) return sum;
      return sum + convertToDecimal(String(r.duracion));
    }, 0);
  }, [productivoRegistros]);

  const productivoRegistrosAnomalos = useMemo(
    () => productivoRegistros.filter((r) => isDuracionAnomala(r.duracion)),
    [productivoRegistros]
  );

  const buildFichaRegularizacionMessage = useCallback((emp, registros = []) => {
    const periodo = productivoPeriodLabel;
    const trabajadas = Number(emp?.horas || 0).toFixed(1);
    const nReg = registros.length;
    const diff = emp?.diff;
    const previstas =
      emp?.horasPrevistas > 0
        ? `${emp.horasPrevistas.toFixed(1)} h (${
            emp.fuentePrevistas === 'contrato' ||
            emp.fuentePrevistas === 'contrato (prorrateado)'
              ? 'media de contrato'
              : emp.fuentePrevistas === 'permitidas' ||
                  emp.fuentePrevistas === 'permitidas (prorrateado)'
                ? 'horas permitidas'
                : emp.fuentePrevistas === 'plan hasta hoy' ||
                    emp.fuentePrevistas === 'plan hasta ayer'
                  ? emp.fuentePrevistas
                  : 'plan / horario'
          })`
        : null;

    let situacionHtml;
    if (diff != null && emp?.supera) {
      situacionHtml = `<p>En este período has acumulado <strong>${trabajadas} h trabajadas</strong>${
        previstas ? ` frente a <strong>${previstas}</strong>` : ''
      }. Eso supone un <strong style="color:#b91c1c;">exceso de +${Number(diff).toFixed(1)} h</strong> respecto a lo previsto.</p>`;
    } else if (diff != null && diff < -0.05 && previstas) {
      situacionHtml = `<p>En este período has acumulado <strong>${trabajadas} h trabajadas</strong> frente a <strong>${previstas}</strong>. Por ahora vas <strong style="color:#a16207;">${Math.abs(Number(diff)).toFixed(1)} h por debajo</strong> de lo previsto.</p>`;
    } else if (previstas) {
      situacionHtml = `<p>En este período has acumulado <strong>${trabajadas} h trabajadas</strong>, en línea con las <strong>${previstas}</strong>.</p>`;
    } else {
      situacionHtml = `<p>En este período has acumulado <strong>${trabajadas} h trabajadas</strong> (${nReg} registro${nReg === 1 ? '' : 's'}).</p>`;
    }

    return [
      `<p>Te escribimos para explicarte con claridad tu situación de fichajes de <strong>${periodo}</strong>.</p>`,
      situacionHtml,
      `<p>Adjunto encontrarás un <strong>PDF con el detalle completo de tus registros</strong> (fecha, hora, tipo, duración y dirección) para que puedas revisarlo con calma.</p>`,
      `<p><strong>Recuerdo importante sobre la regularización:</strong><br>Si ves fichajes incompletos, duraciones incorrectas u olvidos de entrada/salida, entra en la aplicación → <strong>Registros</strong> y usa el botón <strong>«Regularizar»</strong> cuando corresponda. Así queda reflejado correctamente tu tiempo efectivo de trabajo.</p>`,
      registros.some((r) => isDuracionAnomala(r.duracion))
        ? `<p><strong style="color:#b91c1c;">Atención:</strong> hay al menos un fichaje con <strong>duración anómala</strong> (más de ${DURACION_ANOMALA_HORAS} h). Suele deberse a un olvido de salida. Revísalo en el PDF adjunto (filas marcadas) y regularízalo.</p>`
        : '',
      `<p>Si tienes cualquier duda, habla con tu supervisor/a. Estamos para ayudarte.</p>`,
      `<p>Un saludo.</p>`
    ]
      .filter(Boolean)
      .join('');
  }, [productivoPeriodLabel]);

  const buildFichaRegistrosPdfFile = useCallback(async (emp, registros = []) => {
    const pdfMake = await getPdfMake();
    const nombre = emp?.nombre || 'Empleado';
    const codigo = emp?.codigo || '';
    const periodo = productivoPeriodLabel;
    const trabajadas = Number(emp?.horas || 0).toFixed(1);
    const previstas =
      emp?.horasPrevistas > 0 ? `${emp.horasPrevistas.toFixed(1)} h` : '—';
    const diffLabel =
      emp?.diff == null
        ? '—'
        : `${emp.diff > 0 ? '+' : ''}${emp.diff.toFixed(1)} h`;

    const formatFecha = (fecha) => {
      if (!fecha) return '-';
      const d = new Date(fecha);
      if (Number.isNaN(d.getTime())) return String(fecha);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const sorted = [...registros].sort((a, b) => {
      const da = `${a.fecha || ''} ${a.hora || ''}`;
      const db = `${b.fecha || ''} ${b.hora || ''}`;
      return da.localeCompare(db);
    });

    const tableBody = [
      [
        { text: 'Fecha', style: 'tableHeader' },
        { text: 'Hora', style: 'tableHeader' },
        { text: 'Tipo', style: 'tableHeader' },
        { text: 'Duración', style: 'tableHeader' },
        { text: 'Dirección', style: 'tableHeader' }
      ],
      ...sorted.map((r) => {
        const anomala = isDuracionAnomala(r.duracion);
        const durText = anomala
          ? `${r.duracion || '—'} ⚠ ANÓMALA`
          : r.duracion || '—';
        return [
          formatFecha(r.fecha),
          r.hora || '-',
          r.tipo || '-',
          { text: durText, bold: anomala, color: anomala ? '#b91c1c' : '#111827' },
          r.direccion || 'Sin dirección'
        ];
      })
    ];

    const anomCount = sorted.filter((r) => isDuracionAnomala(r.duracion)).length;

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [28, 28, 28, 36],
      content: [
        { text: 'DE CAMINO SERVICIOS AUXILIARES SL', style: 'company' },
        { text: 'Ficha de registros de fichaje', style: 'title' },
        {
          text: [
            { text: 'Empleado: ', bold: true },
            `${nombre}`,
            codigo ? `  ·  Código ${codigo}` : '',
            emp?.grupo ? `  ·  ${emp.grupo}` : ''
          ],
          margin: [0, 4, 0, 2],
          fontSize: 10
        },
        {
          text: [
            { text: 'Período: ', bold: true },
            periodo,
            '  ·  ',
            { text: 'Trabajadas: ', bold: true },
            `${trabajadas} h`,
            '  ·  ',
            { text: 'Previstas: ', bold: true },
            previstas,
            '  ·  ',
            { text: 'Diferencia: ', bold: true },
            diffLabel
          ],
          margin: [0, 0, 0, anomCount > 0 ? 4 : 10],
          fontSize: 10
        },
        ...(anomCount > 0
          ? [
              {
                text: `⚠ ${anomCount} registro(s) con duración anómala (>${DURACION_ANOMALA_HORAS}h) — revisar / regularizar (posible olvido de salida).`,
                color: '#b91c1c',
                bold: true,
                fontSize: 9,
                margin: [0, 0, 0, 8]
              }
            ]
          : []),
        sorted.length === 0
          ? { text: 'No hay registros en este período.', italics: true, color: '#666' }
          : {
              table: {
                headerRows: 1,
                widths: [70, 60, 55, 70, '*'],
                body: tableBody
              },
              layout: {
                fillColor: (rowIndex) => {
                  if (rowIndex === 0) return '#f3f4f6';
                  const r = sorted[rowIndex - 1];
                  return r && isDuracionAnomala(r.duracion) ? '#fee2e2' : null;
                },
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#d1d5db',
                vLineColor: () => '#d1d5db'
              }
            },
        {
          text: 'Documento generado desde Estadísticas · Top Productivos. Revisa y regulariza en la app si corresponde.',
          style: 'footerNote',
          margin: [0, 12, 0, 0]
        }
      ],
      styles: {
        company: { fontSize: 9, color: '#6b7280', margin: [0, 0, 0, 2] },
        title: { fontSize: 16, bold: true, color: '#111827', margin: [0, 0, 0, 6] },
        tableHeader: { bold: true, fontSize: 9, color: '#111827' },
        footerNote: { fontSize: 8, color: '#9ca3af', italics: true }
      },
      defaultStyle: { fontSize: 9 }
    };

    const blob = await new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).getBlob(resolve);
      } catch (err) {
        reject(err);
      }
    });

    const safeName = String(nombre)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const safePeriodo = String(periodo).replace(/\s+/g, '-');
    return new File(
      [blob],
      `Ficha_registros_${safeName || codigo}_${safePeriodo}.pdf`,
      { type: 'application/pdf' }
    );
  }, [productivoPeriodLabel]);

  const fetchRegistrosForCodigo = useCallback(
    async (codigo) => {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      let url;
      if (selectedPeriod === 'anual') {
        url = `${routes.getRegistrosPeriodo}?fecha_inicio=${selectedYear}-01-01&fecha_fin=${selectedYear}-12-31&codigo=${encodeURIComponent(codigo)}`;
      } else {
        const mes = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        url = `${routes.getRegistros}?CODIGO=${encodeURIComponent(codigo)}&MES=${encodeURIComponent(mes)}`;
      }

      const response = await fetch(url, { headers, credentials: 'include', cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Error ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : data ? [data] : [];
      return list.map((item) => ({
        id: item.ID ?? item.id ?? null,
        codigo: item.CODIGO ?? item.codigo ?? codigo,
        tipo: item.TIPO ?? item.tipo ?? '-',
        fecha: item.FECHA ?? item.fecha ?? item.data ?? '',
        hora: item.HORA ?? item.hora ?? '-',
        duracion:
          item.effective_duration ||
          item.EFFECTIVE_DURATION ||
          item.DURACION ||
          item.duracion ||
          item.duration ||
          '',
        duracionOriginal: item.DURACION || item.duracion || '',
        direccion: item.DIRECCION || item.address || item.direccion || '',
        hasRegularizacion: Number(item.has_regularizacion || item.HAS_REGULARIZACION || 0) === 1
      }));
    },
    [selectedMonth, selectedPeriod, selectedYear]
  );

  const sendFichaToEmpleado = useCallback(
    async (emp, registrosPrefetched = null) => {
      if (!emp?.codigo) {
        return { ok: false, errors: ['Sin código'] };
      }
      const grupoNorm = String(emp.grupo || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (grupoNorm === 'EXTRABAJADOR') {
        return { ok: false, errors: ['EXTRABAJADOR excluido del envío'] };
      }

      const token = localStorage.getItem('auth_token');
      const headersJson = { 'Content-Type': 'application/json' };
      if (token) headersJson.Authorization = `Bearer ${token}`;

      const periodo = productivoPeriodLabel;
      let registros = Array.isArray(registrosPrefetched) ? registrosPrefetched : null;
      if (!registros) {
        try {
          registros = await fetchRegistrosForCodigo(emp.codigo);
        } catch (e) {
          console.warn('[ChartsSection] Registros no cargados para', emp.codigo, e);
          registros = [];
        }
      }

      const subject = `Ficha de registros ${periodo} · recuerdo de regularización`;
      const message = buildFichaRegularizacionMessage(emp, registros);
      const notifTitle = `Ficha de registros · ${periodo}`;
      const notifMessage =
        emp.supera && emp.diff != null
          ? `Te hemos enviado por email el resumen de fichajes (${periodo}) con PDF adjunto. Exceso: +${Number(emp.diff).toFixed(1)}h. Revisa y regulariza si corresponde.`
          : emp.bajoPlan && emp.diff != null
            ? `Te hemos enviado por email el resumen de fichajes (${periodo}) con PDF adjunto. Déficit: ${Number(emp.diff).toFixed(1)}h. Revisa y regulariza si hace falta.`
            : `Te hemos enviado por email el resumen de fichajes (${periodo}) con PDF adjunto. Revisa tus registros y regulariza si hace falta.`;

      const results = { notif: false, email: false, errors: [] };

      try {
        const notifRes = await fetch(routes.sendNotification, {
          method: 'POST',
          headers: headersJson,
          credentials: 'include',
          body: JSON.stringify({
            userId: String(emp.codigo),
            title: notifTitle,
            message: notifMessage,
            type: 'warning',
            data: {
              kind: 'ficha_registros_regularizacion',
              codigo: emp.codigo,
              periodo,
              link: '/fichaje'
            }
          })
        });
        const notifJson = await notifRes.json().catch(() => ({}));
        if (notifRes.ok && notifJson.success !== false) {
          results.notif = true;
        } else {
          results.errors.push(notifJson.message || `Notificación: error ${notifRes.status}`);
        }
      } catch (e) {
        results.errors.push(e.message || 'Error al enviar notificación');
      }

      try {
        let pdfFile = null;
        try {
          pdfFile = await buildFichaRegistrosPdfFile(emp, registros);
        } catch (pdfErr) {
          console.error('[ChartsSection] Error generating PDF ficha:', pdfErr);
          results.errors.push('No se pudo generar el PDF');
        }

        const formData = new FormData();
        formData.append('recipientType', 'empleado');
        formData.append('recipientId', String(emp.codigo));
        formData.append('subject', subject);
        formData.append('message', message);
        if (pdfFile) formData.append('attachments', pdfFile);

        const emailHeaders = {};
        if (token) emailHeaders.Authorization = `Bearer ${token}`;

        const emailRes = await fetch(routes.sendEmail, {
          method: 'POST',
          headers: emailHeaders,
          credentials: 'include',
          body: formData
        });
        const emailJson = await emailRes.json().catch(() => ({}));
        if (emailRes.ok && emailJson.success !== false) {
          results.email = true;
        } else {
          results.errors.push(emailJson.message || `Email: error ${emailRes.status}`);
        }
      } catch (e) {
        results.errors.push(e.message || 'Error al enviar email');
      }

      return {
        ok: results.notif || results.email,
        ...results
      };
    },
    [
      buildFichaRegularizacionMessage,
      buildFichaRegistrosPdfFile,
      fetchRegistrosForCodigo,
      productivoPeriodLabel
    ]
  );

  const handleEnviarFichaRegularizacion = useCallback(async () => {
    if (!productivoModal?.codigo || sendFichaLoading) return;

    setSendFichaLoading(true);
    setSendFichaFeedback(null);

    const results = await sendFichaToEmpleado(productivoModal, productivoRegistros);

    setSendFichaLoading(false);

    if (results.ok) {
      const parts = [];
      if (results.notif) parts.push('notificación');
      if (results.email) {
        parts.push(results.errors.some((x) => /PDF/i.test(x)) ? 'email' : 'email + PDF');
      }
      setSendFichaFeedback({
        type: 'ok',
        text: `Enviado: ${parts.join(' + ')}.${
          results.errors.length ? ` Aviso: ${results.errors.join(' · ')}` : ''
        }`
      });
    } else {
      setSendFichaFeedback({
        type: 'error',
        text: results.errors.join(' · ') || 'No se pudo enviar el mensaje'
      });
    }
  }, [productivoModal, productivoRegistros, sendFichaLoading, sendFichaToEmpleado]);

  const requestEnviarFichaRegularizacion = useCallback(() => {
    if (!productivoModal?.codigo || sendFichaLoading || productivoRegistrosLoading) return;
    setShowSendFichaConfirm(true);
  }, [productivoModal?.codigo, sendFichaLoading, productivoRegistrosLoading]);

  const requestBulkEnviarGrupo = useCallback(
    (section) => {
      if (!section?.alertados?.length || bulkFichaProgress?.running) return;
      setBulkFichaConfirm({
        grupo: section.grupo,
        destinatarios: section.alertados
      });
    },
    [bulkFichaProgress?.running]
  );

  const handleBulkEnviarFichas = useCallback(async () => {
    const grupo = bulkFichaConfirm?.grupo;
    const destinatarios = bulkFichaConfirm?.destinatarios;
    if (!destinatarios?.length || bulkFichaProgress?.running) return;

    setBulkFichaProgress({
      grupo,
      current: 0,
      total: destinatarios.length,
      ok: 0,
      fail: 0,
      running: true,
      done: false
    });

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < destinatarios.length; i += 1) {
      const emp = destinatarios[i];
      setBulkFichaProgress((prev) =>
        prev
          ? { ...prev, current: i + 1, ok, fail }
          : prev
      );
      try {
        const result = await sendFichaToEmpleado(emp);
        if (result.ok) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
      // Evitar saturar API / SMTP
      await new Promise((r) => setTimeout(r, 400));
    }

    setBulkFichaProgress({
      grupo,
      current: destinatarios.length,
      total: destinatarios.length,
      ok,
      fail,
      running: false,
      done: true
    });
  }, [bulkFichaConfirm, bulkFichaProgress?.running, sendFichaToEmpleado]);

  const employeeStatusChartData = useMemo(() => ({
    series: [
      {
        name: 'Empleados',
        data: [employeeStatus.ok, employeeStatus.enRiesgo, employeeStatus.excedido]
      }
    ],
    options: {
      chart: { type: 'bar', height: 320, toolbar: { show: true }, parentHeightOffset: 0 },
      colors: ['#10b981', '#f59e0b', '#ef4444'],
      plotOptions: {
        bar: { horizontal: false, columnWidth: '50%', borderRadius: 6 }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${val}`
      },
      xaxis: {
        categories: ['OK', 'Alerta', 'Excedido'],
        title: { text: 'Estado de Cumplimiento' }
      },
      yaxis: {
        title: { text: 'Número de Empleados' },
        labels: {
          formatter: (val) => `${val}`
        }
      },
      title: { text: 'Estado de Cumplimiento de Horas', align: 'left', style: { fontSize: '14px' } },
      subtitle: {
        text:
          selectedPeriod === 'mensual'
            ? `${getMonthName(selectedMonth)} ${selectedYear}`
            : selectedPeriod === 'anual'
            ? `Año ${selectedYear}`
            : 'Período personalizado',
        align: 'left'
      },
      noData: { text: statusLoading ? 'Cargando datos...' : 'No hay datos disponibles' }
    }
  }), [employeeStatus, selectedMonth, selectedPeriod, selectedYear, statusLoading]);

  const employeeDistributionData = useMemo(() => ({
    series: [
      employeeDistribution.activos,
      employeeDistribution.inactivos,
      employeeDistribution.pendientes
    ],
    options: {
      chart: { type: 'donut', height: 320, toolbar: { show: true } },
      labels: ['Empleados Activos', 'Empleados Inactivos', 'Empleados Pendientes'],
      colors: ['#10b981', '#ef4444', '#f59e0b'],
      dataLabels: {
        enabled: true,
        formatter: (val, opts) => {
          const quantity = opts.w.config.series[opts.seriesIndex];
          return `${quantity} (${val.toFixed(1)}%)`;
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: selectedCentro === 'todos' ? 'Total Empleados' : `Total ${selectedCentro}`,
                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
              }
            }
          }
        }
      },
      legend: { show: true, position: 'bottom', fontSize: '12px' },
      title: { text: 'Distribución de Empleados', align: 'left', style: { fontSize: '14px' } }
    }
  }), [employeeDistribution, selectedCentro]);

  const centrosDistributionData = useMemo(() => {
    const data = centrosDistribution.centros;
    return {
      series: [
        {
          name: 'Empleados',
          data
        }
      ],
      options: {
        chart: {
          type: 'bar',
          height: Math.max(360, Math.max(data.length, 1) * 36),
          toolbar: { show: true }
        },
        plotOptions: {
          bar: { horizontal: true, borderRadius: 4, barHeight: '65%' }
        },
        dataLabels: { enabled: true },
        tooltip: {
          y: { formatter: (val) => `${val} empleados` },
          x: {
            formatter: (_val, opts) => {
              const point = opts?.w?.config?.series?.[0]?.data?.[opts.dataPointIndex];
              return point?.x || '';
            }
          }
        },
        xaxis: { title: { text: 'Número de Empleados' } },
        yaxis: {
          labels: {
            maxWidth: 280,
            trim: false,
            style: { fontSize: '11px' }
          }
        },
        title: {
          text: 'Distribución por Centros de Trabajo',
          align: 'left',
          style: { fontSize: '14px' }
        },
        noData: { text: 'No hay centros con empleados asignados' }
      }
    };
  }, [centrosDistribution]);

  const productivosConAlerta = useMemo(
    () => displayedProductivos.filter((e) => e.supera).length,
    [displayedProductivos]
  );

  const productivosConDeficit = useMemo(
    () => displayedProductivos.filter((e) => e.bajoPlan).length,
    [displayedProductivos]
  );

  const ausenciasChartData = useMemo(() => ({
    series: ausencias.series,
    options: {
      chart: { type: 'bar', height: 400, stacked: true, toolbar: { show: true } },
      colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
      plotOptions: { bar: { borderRadius: 4 } },
      dataLabels: {
        enabled: true,
        formatter: (val) => (val > 0 ? String(val) : '')
      },
      xaxis: { categories: ausencias.categories, title: { text: 'Meses del Año' } },
      yaxis: { title: { text: 'Número de Solicitudes' } },
      title: { text: 'Solicitudes por Tipo y Mes', align: 'left', style: { fontSize: '14px' } }
    }
  }), [ausencias.categories, ausencias.series]);

  const rendimientoMensualChartData = useMemo(() => ({
    series: [
      {
        name: 'Horas Trabajadas',
        data: rendimientoMensual
      }
    ],
    options: {
      chart: { type: 'line', height: 350, toolbar: { show: true } },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 5 },
      dataLabels: { enabled: true, formatter: (val) => `${val}h` },
      xaxis: { title: { text: 'Meses' } },
      yaxis: {
        title: { text: 'Horas Trabajadas' },
        min: 0,
        forceNiceScale: true,
      },
      title: {
        text: `Rendimiento por Mes · ${selectedYear}`,
        align: 'left',
        style: { fontSize: '14px' },
      },
      noData: { text: 'No hay datos de horas para este año' },
    }
  }), [rendimientoMensual, selectedYear]);

  const exportToPDF = useCallback(async (chartId, chartTitle) => {
    const element = document.getElementById(chartId);
    if (!element) return;

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.setFontSize(16);
    pdf.text(chartTitle, 20, 20);
    pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    pdf.save(`${chartTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }, []);

  const exportAllChartsToPDF = useCallback(async () => {
    const charts = [
      { id: 'monthly-hours-chart', title: 'Horas Trabajadas por Mes' },
      { id: 'employee-chart', title: 'Distribución de Empleados' },
      { id: 'advanced-chart', title: 'Análisis Avanzado' }
    ];

    const pdf = new jsPDF('landscape', 'mm', 'a4');
    let firstPage = true;

    for (const chart of charts) {
      const element = document.getElementById(chart.id);
      if (!element) continue;

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (!firstPage) {
        pdf.addPage();
      }
      firstPage = false;

      pdf.setFontSize(16);
      pdf.text(chart.title, 20, 20);
      pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    }

    pdf.save(`Reporte_Estadisticas_${new Date().toISOString().split('T')[0]}.pdf`);
  }, []);

  useImperativeHandle(ref, () => ({
    exportAllChartsToPDF,
  }), [exportAllChartsToPDF]);

  const pdfBtnClass =
    'bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)] gap-4 lg:gap-5">
        <SectionCard
          title="Estado de Cumplimiento de Horas"
          actions={
            <button
              type="button"
              onClick={() => exportToPDF('monthly-hours-chart', 'Estado de Cumplimiento de Horas')}
              className={pdfBtnClass}
            >
              📄 PDF
            </button>
          }
        >
          <div id="monthly-hours-chart">
            {statusLoading ? (
              <div className="flex items-center justify-center h-[320px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Cargando datos...</p>
                </div>
              </div>
            ) : (
              <Chart options={employeeStatusChartData.options} series={employeeStatusChartData.series} type="bar" height={320} width="100%" />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Distribución de Empleados"
          actions={
            <button
              type="button"
              onClick={() => exportToPDF('employee-chart', 'Distribución de Empleados')}
              className={pdfBtnClass}
            >
              📄 PDF
            </button>
          }
        >
          <div id="employee-chart">
            <Chart options={employeeDistributionData.options} series={employeeDistributionData.series} type="donut" height={320} width="100%" />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Análisis Avanzado"
        actions={
          <button
            type="button"
            onClick={() => exportToPDF('advanced-chart', 'Análisis Avanzado')}
            className={pdfBtnClass}
          >
            📄 PDF
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'centros', label: 'Centros', icon: '🏢' },
            { id: 'productivos', label: 'Top Productivos', icon: '⭐' },
            { id: 'dias', label: 'Ausencias', icon: '📅' },
            { id: 'mensual', label: 'Mensual', icon: '📈' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div id="advanced-chart" className="w-full">
          {activeTab === 'centros' && (
            <div>
              {centrosDistribution.sinCentro > 0 && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span className="font-semibold">Sin Centro:</span>
                  <span className="tabular-nums font-bold">{centrosDistribution.sinCentro}</span>
                  <span className="text-amber-700/80 text-xs">empleados (excluido del gráfico)</span>
                </div>
              )}
              <Chart
                options={centrosDistributionData.options}
                series={centrosDistributionData.series}
                type="bar"
                height={centrosDistributionData.options.chart.height}
                width="100%"
              />
            </div>
          )}

          {activeTab === 'productivos' && (
            productivosLoading ? (
              <div className="flex items-center justify-center h-[360px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Cargando datos de productividad...</p>
                </div>
              </div>
            ) : topProductivos.length === 0 ? (
              <div className="flex items-center justify-center h-[280px]">
                <div className="text-center">
                  <p className="text-gray-600 font-semibold mb-1">No hay datos disponibles</p>
                  <p className="text-gray-500 text-sm">No se encontraron empleados con horas trabajadas para el período seleccionado.</p>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {[
                    { id: 10, label: 'Top 10' },
                    { id: 20, label: 'Top 20' },
                    { id: 'all', label: 'Todos' }
                  ].map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setProductivosLimit(opt.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        productivosLimit === opt.id
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {productivosConAlerta > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                      ⚠ {productivosConAlerta} supera{productivosConAlerta === 1 ? '' : 'n'} horas previstas
                    </span>
                  )}
                  {productivosConDeficit > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      ⚠ {productivosConDeficit} por debajo / sin fichajes
                    </span>
                  )}
                </div>

                {productivosGruposDisponibles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">
                      Grupo
                    </span>
                    <button
                      type="button"
                      onClick={() => setProductivosGrupo('todos')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        productivosGrupo === 'todos'
                          ? 'bg-slate-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Todos los grupos
                    </button>
                    {productivosGruposDisponibles.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProductivosGrupo(g)}
                        className={`px-3 py-1 rounded-md text-xs font-medium max-w-[220px] truncate ${
                          productivosGrupo === g
                            ? 'bg-slate-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={g}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                {bulkFichaProgress && (
                  <div
                    className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${
                      bulkFichaProgress.running
                        ? 'border-sky-200 bg-sky-50 text-sky-900'
                        : bulkFichaProgress.fail > 0
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    {bulkFichaProgress.running ? (
                      <p>
                        Enviando fichas a alertados de{' '}
                        <strong>{bulkFichaProgress.grupo}</strong>…{' '}
                        {bulkFichaProgress.current}/{bulkFichaProgress.total}
                        {' · '}
                        OK {bulkFichaProgress.ok}
                        {bulkFichaProgress.fail > 0
                          ? ` · fallos ${bulkFichaProgress.fail}`
                          : ''}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          Envío masivo ({bulkFichaProgress.grupo}):{' '}
                          <strong>{bulkFichaProgress.ok}</strong> OK
                          {bulkFichaProgress.fail > 0
                            ? ` · ${bulkFichaProgress.fail} fallos`
                            : ''}{' '}
                          de {bulkFichaProgress.total}.
                        </p>
                        <button
                          type="button"
                          onClick={() => setBulkFichaProgress(null)}
                          className="text-xs font-medium underline underline-offset-2"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-6">
                  {productivosSectionsCharts.map((section) => (
                    <div
                      key={section.grupo}
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{section.grupo}</h3>
                          <p className="text-xs text-gray-500">
                            Mostrando {section.items.length}
                            {productivosLimit !== 'all' ? ` (top ${productivosLimit})` : ''}
                            {' '}de {section.totalEnGrupo} en el grupo
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {section.alertas > 0 && (
                            <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              ⚠ {section.alertas} exceso
                            </span>
                          )}
                          {section.alertasBajo > 0 && (
                            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              ⚠ {section.alertasBajo} déficit
                            </span>
                          )}
                          {section.alertados?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => requestBulkEnviarGrupo(section)}
                              disabled={!!bulkFichaProgress?.running}
                              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title={`Email + notificación a ${section.alertados.length} con exceso o déficit`}
                            >
                              📧 Enviar a alertados ({section.alertados.length})
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-2 cursor-pointer" title="Clic en un empleado para ver sus registros">
                        <Chart
                          options={section.chart.options}
                          series={section.chart.series}
                          type="bar"
                          height={Math.max(280, section.items.length * 36)}
                          width="100%"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Agrupado por GRUPO · En el mes/año en curso se compara con el plan hasta hoy · Verde = plan · Amarillo/rojo solo si la diferencia supera {ALERTA_DIFF_HORAS}h · Clic para registros.
                </p>
              </div>
            )
          )}

          {activeTab === 'dias' && (
            ausenciasLoading ? (
              <div className="flex items-center justify-center h-[360px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Cargando datos de ausencias...</p>
                </div>
              </div>
            ) : (
              <Chart
                options={ausenciasChartData.options}
                series={ausenciasChartData.series}
                type="bar"
                height={ausenciasChartData.options.chart.height}
                width="100%"
              />
            )
          )}

          {activeTab === 'mensual' && (
            rendimientoLoading ? (
              <div className="flex items-center justify-center h-[320px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Cargando datos de rendimiento mensual...</p>
                </div>
              </div>
            ) : (
              <Chart
                options={rendimientoMensualChartData.options}
                series={rendimientoMensualChartData.series}
                type="line"
                height={320}
                width="100%"
              />
            )
          )}
        </div>
      </SectionCard>

      {productivoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeProductivoModal}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="productivo-modal-title"
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200">
              <div className="min-w-0">
                <h2 id="productivo-modal-title" className="text-xl font-bold text-gray-900 truncate">
                  {productivoModal.nombre}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Registros · {productivoPeriodLabel}
                  {productivoModal.grupo ? (
                    <span className="text-gray-400"> · {productivoModal.grupo}</span>
                  ) : null}
                  {productivoModal.codigo ? (
                    <span className="text-gray-400"> · Código {productivoModal.codigo}</span>
                  ) : null}
                </p>
                {(productivoModal.horasPrevistas > 0 || productivoModal.supera) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1 text-gray-700">
                      Trabajadas: <b className="tabular-nums">{Number(productivoModal.horas || 0).toFixed(1)}h</b>
                    </span>
                    {productivoModal.horasPrevistas > 0 && (
                      <span className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1 text-gray-700">
                        Previstas: <b className="tabular-nums">{productivoModal.horasPrevistas.toFixed(1)}h</b>
                        <span className="text-gray-400">
                          {' '}
                          (
                          {productivoModal.fuentePrevistas === 'contrato' ||
                          productivoModal.fuentePrevistas === 'contrato (prorrateado)'
                            ? 'media contrato'
                            : productivoModal.fuentePrevistas === 'plan hasta hoy'
                              ? 'plan hasta hoy'
                              : productivoModal.fuentePrevistas === 'plan hasta ayer'
                                ? 'plan hasta ayer'
                              : productivoModal.fuentePrevistas}
                          )
                        </span>
                      </span>
                    )}
                    {productivoModal.diff != null && (
                      <span
                        className={`rounded-md border px-2 py-1 font-medium ${
                          productivoModal.supera
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : productivoModal.bajoPlan
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        {productivoModal.sinFichajes
                          ? '⚠ Sin fichajes '
                          : productivoModal.supera
                            ? '⚠ Exceso '
                            : productivoModal.bajoPlan
                              ? '⚠ Déficit '
                              : 'Diferencia '}
                        <b className="tabular-nums">
                          {productivoModal.diff > 0 ? '+' : ''}
                          {productivoModal.diff.toFixed(1)}h
                        </b>
                      </span>
                    )}
                    {(productivoModal.diasVacaciones > 0 ||
                      productivoModal.diasAusencia > 0 ||
                      productivoModal.diasBaja > 0 ||
                      productivoModal.diasFiesta > 0) && (
                      <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-violet-800">
                        Descontado del plan:
                        {productivoModal.diasVacaciones > 0
                          ? ` ${productivoModal.diasVacaciones} vac.`
                          : ''}
                        {productivoModal.diasAusencia > 0
                          ? ` ${productivoModal.diasAusencia} aus.`
                          : ''}
                        {productivoModal.diasBaja > 0
                          ? ` ${productivoModal.diasBaja} baja`
                          : ''}
                        {productivoModal.diasFiesta > 0
                          ? ` ${productivoModal.diasFiesta} fiesta`
                          : ''}
                      </span>
                    )}
                    {productivoModal.jornadaHoyAbierta && (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                        ⏱ Jornada de hoy en curso (no cuenta como déficit)
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                  El plan previsto ya descuenta vacaciones, ausencias por días, baja médica y festivos.
                  Las ausencias por horas se restan del plan del día. Si la jornada de hoy aún no está
                  cerrada (entrada sin salida), ese día no se marca como déficit.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductivoModal}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {productivoRegistrosLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">Cargando registros...</p>
                  </div>
                </div>
              ) : productivoRegistrosError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {productivoRegistrosError}
                </div>
              ) : productivoRegistros.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay registros para este período.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5">
                      <span className="text-gray-500">Registros</span>
                      <span className="font-semibold tabular-nums text-gray-900">{productivoRegistros.length}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5">
                      <span className="text-emerald-700/80">Duración total</span>
                      <span className="font-semibold tabular-nums text-emerald-800">
                        {productivoTotalHoras.toFixed(1)}h
                      </span>
                    </span>
                    {typeof productivoModal.horas === 'number' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5">
                        <span className="text-blue-700/80">Top productivos</span>
                        <span className="font-semibold tabular-nums text-blue-800">
                          {productivoModal.horas.toFixed(1)}h
                        </span>
                      </span>
                    ) : null}
                    {productivoRegistrosAnomalos.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-red-800">
                        <span className="font-semibold">⚠ {productivoRegistrosAnomalos.length}</span>
                        <span>
                          duración{productivoRegistrosAnomalos.length === 1 ? '' : 'es'} anómala
                          {productivoRegistrosAnomalos.length === 1 ? '' : 's'}
                          {' '}(&gt;{DURACION_ANOMALA_HORAS}h)
                        </span>
                      </span>
                    )}
                  </div>

                  {productivoRegistrosAnomalos.length > 0 && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 leading-relaxed">
                      Hay fichaje(s) con duración imposible (p. ej. olvido de salida).
                      Esas filas están en rojo — suelen explicar un exceso enorme frente al plan.
                      Conviene regularizarlas desde Registros.
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2.5">Fecha</th>
                          <th className="px-3 py-2.5">Hora</th>
                          <th className="px-3 py-2.5">Tipo</th>
                          <th className="px-3 py-2.5">Duración</th>
                          <th className="px-3 py-2.5">Dirección</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {productivoRegistros.map((r, idx) => {
                          let fechaLabel = r.fecha || '-';
                          if (r.fecha) {
                            const d = new Date(r.fecha);
                            if (!Number.isNaN(d.getTime())) {
                              fechaLabel = d.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              });
                            }
                          }
                          const tipoLower = String(r.tipo || '').toLowerCase();
                          const tipoClass =
                            tipoLower.includes('entrada')
                              ? 'bg-green-100 text-green-800'
                              : tipoLower.includes('salida')
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-700';
                          const anomala = isDuracionAnomala(r.duracion);
                          const horasDur = anomala ? convertToDecimal(String(r.duracion)) : 0;

                          return (
                            <tr
                              key={r.id ?? `${r.fecha}-${r.hora}-${idx}`}
                              className={
                                anomala
                                  ? 'bg-red-50 hover:bg-red-100/80 ring-1 ring-inset ring-red-200'
                                  : 'hover:bg-gray-50/80'
                              }
                            >
                              <td className="px-3 py-2.5 whitespace-nowrap text-gray-900">{fechaLabel}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-gray-800">{r.hora || '-'}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tipoClass}`}>
                                  {r.tipo || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                                <span className={anomala ? 'font-bold text-red-700' : 'text-gray-800'}>
                                  {r.duracion || '—'}
                                </span>
                                {anomala ? (
                                  <span className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                                    anómala · {horasDur.toFixed(0)}h
                                  </span>
                                ) : null}
                                {r.hasRegularizacion ? (
                                  <span className="ml-1 text-[10px] text-amber-600 font-medium">reg.</span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700 max-w-[280px] truncate" title={r.direccion || ''}>
                                {r.direccion || 'Sin dirección'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {!productivoRegistrosLoading && !productivoRegistrosError && (
              <div className="mx-5 mb-1 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white px-4 py-3">
                <p className="text-sm font-semibold text-sky-900">
                  Enviar ficha y recuerdo de regularización
                </p>
                <p className="mt-1 text-xs leading-relaxed text-sky-800/90">
                  Se enviará un email claro explicando su situación de horas en{' '}
                  {productivoPeriodLabel}, con un <strong>PDF adjunto</strong> de
                  todos los registros (fecha, hora, tipo, duración y dirección),
                  más un recuerdo amable para regularizar desde Registros si
                  corresponde. También recibe notificación en la app.
                </p>
                {sendFichaFeedback && (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      sendFichaFeedback.type === 'ok' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {sendFichaFeedback.text}
                  </p>
                )}
              </div>
            )}

            <div className="px-5 py-3 border-t border-gray-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={requestEnviarFichaRegularizacion}
                disabled={
                  !productivoModal?.codigo ||
                  sendFichaLoading ||
                  productivoRegistrosLoading
                }
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {sendFichaLoading ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>📧 Enviar ficha de registros y recuerdo de regularización</>
                )}
              </button>
              <button
                type="button"
                onClick={closeProductivoModal}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showSendFichaConfirm}
        onClose={() => setShowSendFichaConfirm(false)}
        onConfirm={handleEnviarFichaRegularizacion}
        title="Enviar ficha y recuerdo"
        message={
          productivoModal
            ? `¿Enviar a ${productivoModal.nombre} un email explicando su situación de ${productivoPeriodLabel}, con el PDF de todos los registros y el recuerdo de regularización? También se enviará notificación en la app.`
            : '¿Confirmas el envío?'
        }
        confirmText="Enviar ahora"
        cancelText="Cancelar"
        type="warning"
        overlayZIndex={10050}
      />

      <ConfirmModal
        isOpen={!!bulkFichaConfirm}
        onClose={() => setBulkFichaConfirm(null)}
        onConfirm={handleBulkEnviarFichas}
        title="Envío masivo a alertados"
        message={
          bulkFichaConfirm
            ? `¿Enviar email (con PDF) + notificación a ${bulkFichaConfirm.destinatarios.length} empleados de «${bulkFichaConfirm.grupo}» con exceso o déficit en ${productivoPeriodLabel}? Se envía uno a uno; puede tardar unos minutos.`
            : '¿Confirmas el envío masivo?'
        }
        confirmText={`Enviar a ${bulkFichaConfirm?.destinatarios?.length || 0}`}
        cancelText="Cancelar"
        type="warning"
        overlayZIndex={10050}
      />
    </div>
  );
});

ChartsSection.displayName = 'ChartsSection';

export default ChartsSection;
