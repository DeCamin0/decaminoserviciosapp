import { useCallback, useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

import { routes } from '../../utils/routes';

// ✅ MIGRAT: folosim backend /api/horas-trabajadas în loc de n8n
const STATUS_ENDPOINT = routes.getHorasTrabajadas;

// ✅ MIGRAT: folosim backend /api/ausencias în loc de n8n
const AUSENCIAS_ENDPOINT = routes.getAusencias;

// ✅ MIGRAT: folosim backend /api/estadisticas în loc de n8n
const RENDIMIENTO_ENDPOINT = routes.getEstadisticas;

const getMonthName = (monthNumber) => MONTH_NAMES[monthNumber - 1] || 'Mes';

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

const ChartsSection = ({
  stats,
  empleados = [],
  selectedCentro = 'todos',
  selectedPeriod = 'mensual',
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth() + 1
}) => {
  const [activeTab, setActiveTab] = useState('centros');
  const [employeeStatus, setEmployeeStatus] = useState({ ok: 0, enRiesgo: 0, excedido: 0 });
  const [statusLoading, setStatusLoading] = useState(false);

  const [topProductivos, setTopProductivos] = useState([]);
  const [productivosLoading, setProductivosLoading] = useState(false);

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
        
        let horasDecimal = 0;
        if (horasRaw) {
          if (typeof horasRaw === 'number') {
            horasDecimal = horasRaw;
          } else if (typeof horasRaw === 'string') {
            horasDecimal = convertToDecimal(horasRaw);
          }
        }
        
        const result = {
          nombre,
          horas: horasDecimal,
          estado: item.estado || item.ESTADO || item.Estado || 'OK',
          rawItem: item // Păstrăm item-ul original pentru debugging
        };
        
        console.log('📊 [ChartsSection] Processing item:', {
          nombre,
          horasRaw,
          horasDecimal,
          estado: result.estado,
          allKeys: Object.keys(item)
        });
        
        return result;
      });

      console.log('📊 [ChartsSection] Mapped items before filtering:', mapped.length);
      console.log('📊 [ChartsSection] Items with hours > 0:', mapped.filter(item => item.horas > 0).length);

      const result = mapped
        .filter((item) => {
          const hasHours = item.horas > 0;
          if (!hasHours) {
            console.log('📊 [ChartsSection] Filtered out item (no hours):', item.nombre, 'horasRaw:', item.rawItem?.horasTrabajadas || item.rawItem?.horasTrabajadasAnuales || 'not found');
          }
          return hasHours;
        })
        .sort((a, b) => b.horas - a.horas)
        // Nu mai limităm la 10, afișăm toți angajații
        // eslint-disable-next-line no-unused-vars
        .map(({ rawItem, ...rest }) => rest); // Elimină rawItem din rezultatul final

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
  }, [fetchEmployeesDataset, filterByCentro, selectedPeriod, selectedCentro]);

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
      const ahora = new Date();
      const payload = {
        tipo: 'mensual',
        ano: ahora.getFullYear(),
        mes: ahora.getMonth() + 1,
        centro: selectedCentro || 'todos',
        tipoRaport: 'horasTrabajadasMensuales'
      };

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(RENDIMIENTO_ENDPOINT, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener el rendimiento mensual');
      }

      const data = await response.json();
      const array = normaliseEmployeesResponse(data);

      const mapped = array
        .map((item) => {
          let numeroMes = 0;
          if (typeof item.luna === 'string') {
            const [, mes] = item.luna.split('-');
            numeroMes = parseInt(mes, 10);
          } else if (typeof item.mesNumero === 'number') {
            numeroMes = item.mesNumero;
          }

          if (!numeroMes || numeroMes < 1 || numeroMes > 12) {
            return null;
          }

          const horas = item.ore_lucrate ?? item.totalHoras;
          const valor = typeof horas === 'number' ? horas : parseFloat(horas || '0');

          return {
            x: MONTH_NAMES_SHORT[numeroMes - 1],
            y: Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0
          };
        })
        .filter(Boolean);

      setRendimientoMensual(mapped);
    } catch (error) {
      console.error('[ChartsSection] Error loading rendimiento mensual', error);
      setRendimientoMensual([]);
    } finally {
      setRendimientoLoading(false);
    }
  }, [selectedCentro]);

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

    return Array.from(conteo.entries()).map(([centro, count]) => ({ x: centro, y: count }));
  }, [empleados]);

  const employeeStatusChartData = useMemo(() => ({
    series: [
      {
        name: 'Empleados',
        data: [employeeStatus.ok, employeeStatus.enRiesgo, employeeStatus.excedido]
      }
    ],
    options: {
      chart: { type: 'bar', height: 350, toolbar: { show: true } },
      colors: ['#10b981', '#f59e0b', '#ef4444'],
      plotOptions: {
        bar: { horizontal: false, columnWidth: '55%', borderRadius: 8 }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${val}h`
      },
      xaxis: {
        categories: ['OK', 'Alerta', 'Excedido'],
        title: { text: 'Estado de Cumplimiento' }
      },
      yaxis: {
        title: { text: 'Número de Empleados' },
        labels: {
          formatter: (val) => `${val} empleados`
        }
      },
      title: { text: 'Estado de Cumplimiento de Horas', align: 'center' },
      subtitle: {
        text:
          selectedPeriod === 'mensual'
            ? `${getMonthName(selectedMonth)} ${selectedYear}`
            : selectedPeriod === 'anual'
            ? `Año ${selectedYear}`
            : 'Período personalizado',
        align: 'center'
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
      chart: { type: 'donut', height: 350, toolbar: { show: true } },
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
            size: '70%',
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
      legend: { show: true, position: 'bottom' },
      title: { text: 'Distribución de Empleados', align: 'center' }
    }
  }), [employeeDistribution, selectedCentro]);

  const centrosDistributionData = useMemo(() => ({
    series: [
      {
        name: 'Empleados',
        data: centrosDistribution
      }
    ],
    options: {
      chart: {
        type: 'bar',
        height: Math.max(400, centrosDistribution.length * 40),
        toolbar: { show: true }
      },
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: '60%' }
      },
      dataLabels: { enabled: true },
      xaxis: { title: { text: 'Número de Empleados' } },
      yaxis: { title: { text: 'Centros de Trabajo' } },
      title: { text: 'Distribución por Centros de Trabajo', align: 'center' }
    }
  }), [centrosDistribution]);

  const topProductivosData = useMemo(() => ({
    series: [
      {
        name: 'Horas Trabajadas',
        data: topProductivos.map((emp) => ({ x: emp.nombre, y: emp.horas }))
      }
    ],
    options: {
      chart: {
        type: 'bar',
        height: Math.max(400, topProductivos.length * 35),
        toolbar: { show: true },
        scrollbar: {
          enabled: true,
          offsetY: 0,
          offsetX: 0,
          height: 10,
          barHeight: 10,
          track: {
            height: 10,
            background: '#f0f0f0',
            strokeWidth: 0,
            opacity: 0.5
          },
          thumb: {
            height: 10,
            background: '#888',
            strokeWidth: 0
          }
        }
      },
      plotOptions: {
        bar: { 
          horizontal: true, 
          borderRadius: 4, 
          distributed: true, 
          barHeight: '70%',
          dataLabels: {
            position: 'right'
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${val.toFixed(1)}h`,
        style: {
          fontSize: '12px',
          fontWeight: 600
        }
      },
      xaxis: { 
        title: { text: 'Horas Trabajadas' },
        min: 0
      },
      yaxis: { 
        title: { text: 'Empleados' },
        labels: {
          maxWidth: 200,
          style: {
            fontSize: '11px'
          }
        }
      },
      title: { 
        text: `Top ${topProductivos.length} Empleados más Productivos`, 
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 600
        }
      },
      colors: topProductivos.map((emp) => {
        const estado = emp.estado?.toUpperCase();
        if (estado === 'OK') return '#10b981';
        if (estado === 'ALERTA') return '#f59e0b';
        if (estado === 'EXCEDIDO') return '#ef4444';
        return '#6b7280';
      }),
      tooltip: {
        y: {
          formatter: (val) => `${val.toFixed(1)} horas`
        }
      }
    }
  }), [topProductivos]);

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
      title: { text: 'Solicitudes por Tipo y Mes', align: 'center' }
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
      markers: { size: 6 },
      dataLabels: { enabled: true, formatter: (val) => `${val}h` },
      xaxis: { title: { text: 'Meses' } },
      yaxis: { title: { text: 'Horas Trabajadas' } },
      title: { text: 'Rendimiento por Mes', align: 'center' }
    }
  }), [rendimientoMensual]);

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

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-2">
          📊 Gráficos Interactivos
        </h2>
        <p className="text-gray-600 mb-4">Análisis visual del rendimiento y las tendencias</p>
        <div className="flex justify-center">
          <button
            onClick={exportAllChartsToPDF}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            📄 Exportar Todos los Gráficos en PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Estado de Cumplimiento de Horas</h3>
            <button
              onClick={() => exportToPDF('monthly-hours-chart', 'Estado de Cumplimiento de Horas')}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1"
            >
              📄 PDF
            </button>
          </div>
          <div id="monthly-hours-chart">
            {statusLoading ? (
              <div className="flex items-center justify-center h-[350px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando datos...</p>
                </div>
              </div>
            ) : (
              <Chart options={employeeStatusChartData.options} series={employeeStatusChartData.series} type="bar" height={350} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Distribución de Empleados</h3>
            <button
              onClick={() => exportToPDF('employee-chart', 'Distribución de Empleados')}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1"
            >
              📄 PDF
            </button>
          </div>
          <div id="employee-chart">
            <Chart options={employeeDistributionData.options} series={employeeDistributionData.series} type="donut" height={350} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Análisis Avanzado</h3>
          <button
            onClick={() => exportToPDF('advanced-chart', 'Análisis Avanzado')}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1"
          >
            📄 PDF
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'centros', label: 'Centros', icon: '🏢' },
            { id: 'productivos', label: 'Top Productivos', icon: '⭐' },
            { id: 'dias', label: 'Ausencias', icon: '📅' },
            { id: 'mensual', label: 'Mensual', icon: '📈' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div id="advanced-chart">
          {activeTab === 'centros' && (
            <Chart
              options={centrosDistributionData.options}
              series={centrosDistributionData.series}
              type="bar"
              height={centrosDistributionData.options.chart.height}
            />
          )}

          {activeTab === 'productivos' && (
            productivosLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando datos de productividad...</p>
                </div>
              </div>
            ) : topProductivos.length === 0 ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-600 text-lg font-semibold mb-2">No hay datos disponibles</p>
                  <p className="text-gray-500 text-sm">No se encontraron empleados con horas trabajadas para el período seleccionado.</p>
                </div>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Chart
                    options={topProductivosData.options}
                    series={topProductivosData.series}
                    type="bar"
                    height={Math.max(400, topProductivos.length * 40)}
                  />
                </div>
              </div>
            )
          )}

          {activeTab === 'dias' && (
            ausenciasLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando datos de ausencias...</p>
                </div>
              </div>
            ) : (
              <Chart
                options={ausenciasChartData.options}
                series={ausenciasChartData.series}
                type="bar"
                height={ausenciasChartData.options.chart.height}
              />
            )
          )}

          {activeTab === 'mensual' && (
            rendimientoLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando datos de rendimiento mensual...</p>
                </div>
              </div>
            ) : (
              <Chart
                options={rendimientoMensualChartData.options}
                series={rendimientoMensualChartData.series}
                type="line"
                height={350}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartsSection;
