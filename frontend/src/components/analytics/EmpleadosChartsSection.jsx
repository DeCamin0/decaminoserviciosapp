import { useCallback, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TABS = [
  { id: 'distribucion', label: 'Distribución por Centro', icon: '📊' },
  { id: 'evolucion', label: 'Evolución de Plantilla', icon: '📈' },
  { id: 'estado', label: 'Distribución por Estado', icon: '🎯' },
  { id: 'horas', label: 'Horas por Centro', icon: '⏰' },
  { id: 'actividad', label: 'Tasa de Actividad Diaria', icon: '📅' },
  { id: 'top', label: 'Top 10 Empleados Activos', icon: '🏆' },
  { id: 'ratio', label: 'Ratio Empleados/Centros', icon: '📦' },
  { id: 'rotacion', label: 'Rotación de Personal', icon: '🔄' },
  { id: 'contrato', label: 'Por Tipo de Contrato', icon: '💼' },
  { id: 'productividad', label: 'Productividad por Centro', icon: '⚡' },
  { id: 'mapa', label: 'Mapa Geográfico', icon: '📍' }
];

const parseFecha = (value) => {
  if (!value) return null;
  const normalised = value.includes('/') ? value.split('/').reverse().join('-') : value;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDuracionHoras = (value) => {
  if (!value) return 0;
  const match = value.match(/(\d+)h\s*(\d+)?m?/i);
  if (!match) return 0;
  const horas = parseInt(match[1], 10) || 0;
  const minutos = parseInt(match[2], 10) || 0;
  return horas + minutos / 60;
};

const EmpleadosChartsSection = ({
  empleados = [],
  allEmpleados = [],
  fichajes = [],
  selectedCentro = 'todos',
  selectedPeriod = 'mes'
}) => {
  const [activeTab, setActiveTab] = useState('distribucion');
  const [showCentroModal, setShowCentroModal] = useState(false);
  const [selectedCentroModal, setSelectedCentroModal] = useState(null);
  const [empleadosDelCentro, setEmpleadosDelCentro] = useState([]);

  const empleadosDistribucion = useMemo(
    () => (allEmpleados.length > 0 ? allEmpleados : empleados),
    [allEmpleados, empleados]
  );

  const empleadosFiltrados = useMemo(() => {
    if (selectedCentro === 'todos') {
      return empleados;
    }

    const centroNormalizado = selectedCentro.toString().toLowerCase();
    return empleados.filter((emp) => (
      emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro'
    ).toString().toLowerCase() === centroNormalizado);
  }, [empleados, selectedCentro]);

  const correosFiltrados = useMemo(() => {
    if (selectedCentro === 'todos') return null;
    return new Set(
      empleadosFiltrados
        .map((emp) => emp['CORREO ELECTRONICO'] || emp.EMAIL)
        .filter(Boolean)
    );
  }, [empleadosFiltrados, selectedCentro]);

  const fichajesFiltrados = useMemo(() => {
    if (!correosFiltrados) return fichajes;
    return fichajes.filter((entry) => correosFiltrados.has(entry['CORREO ELECTRONICO']));
  }, [correosFiltrados, fichajes]);

  const distribucionCentros = useMemo(() => {
    const counts = new Map();
    empleadosDistribucion.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro';
      counts.set(centro, (counts.get(centro) || 0) + 1);
    });

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return {
      categories: sorted.map(([centro]) => centro),
      values: sorted.map(([, total]) => total)
    };
  }, [empleadosDistribucion]);

  const handleCentroClick = useCallback(
    (centro) => {
      const empleadosCentro = empleadosDistribucion.filter(
        (emp) => (emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro') === centro
      );
      setSelectedCentroModal(centro);
      setEmpleadosDelCentro(empleadosCentro);
      setShowCentroModal(true);
    },
    [empleadosDistribucion]
  );

  const distribucionChart = useMemo(() => {
    const { categories, values } = distribucionCentros;

    return {
      series: [{ name: 'Empleados', data: values }],
      options: {
        chart: {
          type: 'bar',
          height: Math.max(400, categories.length * 40),
          toolbar: { show: true },
          events: {
            dataPointSelection: (_event, _ctx, config) => {
              const index = config?.dataPointIndex;
              if (index === undefined || index === null) return;
              const centro = categories[index];
              if (centro) handleCentroClick(centro);
            }
          }
        },
        colors: ['#ef4444'],
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4,
            barHeight: '60%'
          }
        },
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '12px',
            fontWeight: 'bold',
            colors: ['#fff']
          }
        },
        xaxis: {
          categories,
          title: { text: 'Número de Empleados' }
        },
        yaxis: {
          title: { text: 'Centros de Trabajo' },
          labels: {
            formatter: (value) => (value && value.length > 45 ? `${value.slice(0, 45)}…` : value)
          }
        },
        title: { text: 'Distribución de Empleados por Centro de Trabajo', align: 'center' }
      }
    };
  }, [distribucionCentros, handleCentroClick]);

  const evolucionChart = useMemo(() => {
    const altasPorMes = new Map();
    empleadosFiltrados.forEach((emp) => {
      const fechaAlta = parseFecha(emp['FECHA DE ALTA']);
      if (!fechaAlta) return;
      const key = `${fechaAlta.getFullYear()}-${String(fechaAlta.getMonth() + 1).padStart(2, '0')}`;
      altasPorMes.set(key, (altasPorMes.get(key) || 0) + 1);
    });

    const sorted = Array.from(altasPorMes.keys()).sort();
    let acumulado = 0;
    const data = sorted.map((key) => {
      acumulado += altasPorMes.get(key) || 0;
      return acumulado;
    });

    const labels = sorted.map((key) => {
      const [year, month] = key.split('-');
      return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;
    });

    return {
      series: [{ name: 'Total Empleados', data }],
      options: {
        chart: { type: 'line', height: 400, toolbar: { show: true } },
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 5 },
        xaxis: { categories: labels, title: { text: 'Mes' } },
        yaxis: { title: { text: 'Número de Empleados' }, min: 0 },
        colors: ['#dc2626'],
        title: { text: 'Evolución de Plantilla por Mes', align: 'center' }
      }
    };
  }, [empleadosFiltrados]);

  const estadoChart = useMemo(() => {
    const estadosPorCentro = new Map();
    empleadosFiltrados.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro';
      const estado = (emp['ESTADO'] || 'Pendiente').toString().toUpperCase();
      if (!estadosPorCentro.has(centro)) {
        estadosPorCentro.set(centro, { ACTIVO: 0, INACTIVO: 0, PENDIENTE: 0 });
      }
      const bucket = estadosPorCentro.get(centro);
      if (estado === 'ACTIVO') bucket.ACTIVO += 1;
      else if (estado === 'INACTIVO') bucket.INACTIVO += 1;
      else bucket.PENDIENTE += 1;
    });

    const centros = Array.from(estadosPorCentro.keys());
    const activos = centros.map((c) => estadosPorCentro.get(c).ACTIVO);
    const inactivos = centros.map((c) => estadosPorCentro.get(c).INACTIVO);
    const pendientes = centros.map((c) => estadosPorCentro.get(c).PENDIENTE);

    return {
      series: [
        { name: 'Activos', data: activos },
        { name: 'Inactivos', data: inactivos },
        { name: 'Pendientes', data: pendientes }
      ],
      options: {
        chart: { type: 'bar', height: 400, stacked: true, toolbar: { show: true } },
        colors: ['#22c55e', '#ef4444', '#f59e0b'],
        xaxis: { categories: centros, title: { text: 'Centro de Trabajo' } },
        yaxis: { title: { text: 'Número de Empleados' } },
        legend: { position: 'top' },
        title: { text: 'Distribución por Estado por Centro', align: 'center' }
      }
    };
  }, [empleadosFiltrados]);

  const horasPorCentroChart = useMemo(() => {
    const horasPorCentro = new Map();
    fichajesFiltrados.forEach((f) => {
      const email = f['CORREO ELECTRONICO'];
      const empleado = empleadosFiltrados.find(
        (emp) => (emp['CORREO ELECTRONICO'] || emp.EMAIL) === email
      );
      const centro = empleado ? empleado['CENTRO TRABAJO'] || 'Sin Centro' : 'Sin Centro';
      const horas = parseDuracionHoras(f.DURACION);
      horasPorCentro.set(centro, (horasPorCentro.get(centro) || 0) + horas);
    });

    const centros = Array.from(horasPorCentro.keys());
    const valores = Array.from(horasPorCentro.values());

    return {
      series: [{ name: 'Horas Trabajadas', data: valores.map((v) => Number(v.toFixed(2))) }],
      options: {
        chart: { type: 'bar', height: 400, toolbar: { show: true } },
        colors: ['#dc2626'],
        plotOptions: { bar: { borderRadius: 4 } },
        xaxis: { categories: centros, title: { text: 'Centro de Trabajo' } },
        yaxis: { title: { text: 'Horas' } },
        tooltip: { y: { formatter: (val) => `${val.toFixed(1)} horas` } },
        title: { text: 'Horas Trabajadas por Centro', align: 'center' }
      }
    };
  }, [empleadosFiltrados, fichajesFiltrados]);

  const actividadDiariaChart = useMemo(() => {
    const daysWindow = selectedPeriod === 'semana' ? 7 : 30;
    const today = new Date();
    const registros = new Map();

    for (let i = daysWindow - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().split('T')[0];
      registros.set(key, 0);
    }

    fichajesFiltrados.forEach((f) => {
      if (!f.FECHA) return;
      if (!registros.has(f.FECHA)) return;
      registros.set(f.FECHA, (registros.get(f.FECHA) || 0) + 1);
    });

    const labels = Array.from(registros.keys()).map((key) => {
      const date = new Date(key);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const data = Array.from(registros.values());

    return {
      series: [{ name: 'Registros Diarios', data }],
      options: {
        chart: { type: 'area', height: 400, toolbar: { show: true } },
        colors: ['#dc2626'],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
          type: 'gradient',
          gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 }
        },
        xaxis: { categories: labels, title: { text: 'Fecha' } },
        yaxis: { title: { text: 'Número de Registros' } },
        title: { text: `Tasa de Actividad Diaria (${daysWindow} días)`, align: 'center' }
      }
    };
  }, [fichajesFiltrados, selectedPeriod]);

  const topActivosChart = useMemo(() => {
    const actividad = new Map();
    fichajesFiltrados.forEach((f) => {
      const email = f['CORREO ELECTRONICO'];
      const empleado = empleadosFiltrados.find(
        (emp) => (emp['CORREO ELECTRONICO'] || emp.EMAIL) === email
      );
      const nombre = empleado ? empleado['NOMBRE / APELLIDOS'] || email : email;
      actividad.set(nombre, (actividad.get(nombre) || 0) + 1);
    });

    const top = Array.from(actividad.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const nombres = top.map(([name]) => (name.length > 20 ? `${name.slice(0, 20)}…` : name));
    const valores = top.map(([, count]) => count);

    return {
      series: [{ name: 'Registros', data: valores }],
      options: {
        chart: { type: 'bar', height: 500, toolbar: { show: true } },
        colors: ['#dc2626'],
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        xaxis: { categories: nombres, title: { text: 'Empleado' } },
        yaxis: { title: { text: 'Número de Registros' } },
        tooltip: { y: { formatter: (val) => `${val} registros` } },
        title: { text: 'Top 10 Empleados más Activos', align: 'center' }
      }
    };
  }, [empleadosFiltrados, fichajesFiltrados]);

  const ratioEmpleadosCentrosChart = useMemo(() => {
    const counts = new Map();
    empleadosFiltrados.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || emp.centroTrabajo || 'Sin Centro';
      counts.set(centro, (counts.get(centro) || 0) + 1);
    });

    const centros = Array.from(counts.keys());
    const totalEmpleados = empleadosFiltrados.length;
    const promedio = centros.length ? totalEmpleados / centros.length : 0;

    return {
      series: [
        {
          name: 'Empleados por Centro',
          data: centros.map((centro) => [centro.length || 1, counts.get(centro), counts.get(centro)])
        }
      ],
      options: {
        chart: { type: 'scatter', height: 400, toolbar: { show: true } },
        colors: ['#dc2626'],
        xaxis: { title: { text: 'Complejidad del Centro (longitud nombre)' } },
        yaxis: { title: { text: 'Número de Empleados' } },
        title: {
          text: `Ratio Empleados/Centros (Promedio: ${promedio.toFixed(1)} empleados/centro)`,
          align: 'center'
        },
        tooltip: {
          custom: ({ dataPointIndex }) => {
            const centro = centros[dataPointIndex];
            const count = counts.get(centro) || 0;
            return `<div style="padding:8px"><strong>${centro}</strong><br/>Empleados: ${count}</div>`;
          }
        }
      }
    };
  }, [empleadosFiltrados]);

  const rotacionChart = useMemo(() => {
    const altas = new Map();
    const bajas = new Map();

    empleadosFiltrados.forEach((emp) => {
      const alta = parseFecha(emp['FECHA DE ALTA']);
      if (alta) {
        const key = `${alta.getFullYear()}-${String(alta.getMonth() + 1).padStart(2, '0')}`;
        altas.set(key, (altas.get(key) || 0) + 1);
      }
      const baja = parseFecha(emp['FECHA BAJA']);
      if (baja) {
        const key = `${baja.getFullYear()}-${String(baja.getMonth() + 1).padStart(2, '0')}`;
        bajas.set(key, (bajas.get(key) || 0) + 1);
      }
    });

    const meses = Array.from(new Set([...altas.keys(), ...bajas.keys()])).sort();
    const labels = meses.map((key) => {
      const [year, month] = key.split('-');
      return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;
    });

    return {
      series: [
        { name: 'Altas', data: meses.map((m) => altas.get(m) || 0) },
        { name: 'Bajas', data: meses.map((m) => bajas.get(m) || 0) }
      ],
      options: {
        chart: { type: 'area', height: 400, stacked: true, toolbar: { show: true } },
        colors: ['#22c55e', '#ef4444'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 } },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: labels, title: { text: 'Mes' } },
        yaxis: { title: { text: 'Número de Empleados' } },
        legend: { position: 'top' },
        title: { text: 'Rotación de Personal (Altas y Bajas)', align: 'center' }
      }
    };
  }, [empleadosFiltrados]);

  const contratoChart = useMemo(() => {
    const counts = new Map();
    empleadosFiltrados.forEach((emp) => {
      const contrato = emp['TIPO DE CONTRATO'] || 'Sin Especificar';
      counts.set(contrato, (counts.get(contrato) || 0) + 1);
    });

    return {
      series: Array.from(counts.values()),
      options: {
        chart: { type: 'pie', height: 400 },
        labels: Array.from(counts.keys()),
        dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
        colors: ['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'],
        legend: { position: 'bottom' },
        tooltip: { y: { formatter: (val) => `${val} empleados` } },
        title: { text: 'Distribución por Tipo de Contrato', align: 'center' }
      }
    };
  }, [empleadosFiltrados]);

  const productividadChart = useMemo(() => {
    const empleadosPorCentro = new Map();
    const horasPorCentro = new Map();

    empleadosFiltrados.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || 'Sin Centro';
      empleadosPorCentro.set(centro, (empleadosPorCentro.get(centro) || 0) + 1);
    });

    fichajesFiltrados.forEach((f) => {
      const email = f['CORREO ELECTRONICO'];
      const empleado = empleadosFiltrados.find(
        (emp) => (emp['CORREO ELECTRONICO'] || emp.EMAIL) === email
      );
      const centro = empleado ? empleado['CENTRO TRABAJO'] || 'Sin Centro' : 'Sin Centro';
      const horas = parseDuracionHoras(f.DURACION);
      horasPorCentro.set(centro, (horasPorCentro.get(centro) || 0) + horas);
    });

    const centros = Array.from(empleadosPorCentro.keys());
    const productividad = centros.map((centro) => {
      const totalHoras = horasPorCentro.get(centro) || 0;
      const totalEmpleados = empleadosPorCentro.get(centro) || 1;
      return Number((totalHoras / totalEmpleados).toFixed(1));
    });

    return {
      series: [{ name: 'Horas por Empleado', data: productividad }],
      options: {
        chart: { type: 'bar', height: 400, toolbar: { show: true } },
        colors: ['#dc2626'],
        plotOptions: { bar: { borderRadius: 4 } },
        xaxis: { categories: centros, title: { text: 'Centro de Trabajo' } },
        yaxis: { title: { text: 'Horas por Empleado' } },
        tooltip: { y: { formatter: (val) => `${val.toFixed(1)} horas/empleado` } },
        title: { text: 'Productividad por Centro (Horas/Empleado)', align: 'center' }
      }
    };
  }, [empleadosFiltrados, fichajesFiltrados]);

  const mapaGeograficoData = useMemo(() => {
    const mapa = new Map();
    empleadosFiltrados.forEach((emp) => {
      const centro = emp['CENTRO TRABAJO'] || 'Sin Centro';
      const estado = (emp['ESTADO'] || '').toString().toUpperCase();
      const direccion = emp.DIRECCION || '';
      if (!mapa.has(centro)) {
        mapa.set(centro, { empleados: 0, activos: 0, inactivos: 0, ubicaciones: new Set() });
      }
      const entry = mapa.get(centro);
      entry.empleados += 1;
      if (estado === 'ACTIVO') entry.activos += 1;
      else if (estado === 'INACTIVO') entry.inactivos += 1;
      if (direccion) {
        const partes = direccion.split(',');
        const ciudad = partes[partes.length - 1]?.trim();
        if (ciudad) entry.ubicaciones.add(ciudad);
      }
    });

    return Array.from(mapa.entries()).map(([centro, data]) => ({
      centro,
      empleados: data.empleados,
      activos: data.activos,
      inactivos: data.inactivos,
      ubicaciones: Array.from(data.ubicaciones).slice(0, 3)
    }));
  }, [empleadosFiltrados]);

  const exportToPDF = useCallback(async (chartId, chartTitle) => {
    const node = document.getElementById(chartId);
    if (!node) return;

    const canvas = await html2canvas(node, {
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
    pdf.save(`${chartTitle.replace(/\s+/g, '_')}.pdf`);
  }, []);

  const closeModal = useCallback(() => {
    setShowCentroModal(false);
    setSelectedCentroModal(null);
    setEmpleadosDelCentro([]);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="mb-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'distribucion' && (
          <div id="chart-distribucion">
            <Chart
              options={distribucionChart.options}
              series={distribucionChart.series}
              type="bar"
              height={distribucionChart.options.chart.height}
            />
            <button
              onClick={() => exportToPDF('chart-distribucion', 'Distribucion_Centros')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'evolucion' && (
          <div id="chart-evolucion">
            <Chart options={evolucionChart.options} series={evolucionChart.series} type="line" height={400} />
            <button
              onClick={() => exportToPDF('chart-evolucion', 'Evolucion_Plantilla')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'estado' && (
          <div id="chart-estado">
            <Chart options={estadoChart.options} series={estadoChart.series} type="bar" height={400} />
            <button
              onClick={() => exportToPDF('chart-estado', 'Distribucion_Estado')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'horas' && (
          <div id="chart-horas">
            <Chart options={horasPorCentroChart.options} series={horasPorCentroChart.series} type="bar" height={400} />
            <button
              onClick={() => exportToPDF('chart-horas', 'Horas_Centro')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'actividad' && (
          <div id="chart-actividad">
            <Chart options={actividadDiariaChart.options} series={actividadDiariaChart.series} type="area" height={400} />
            <button
              onClick={() => exportToPDF('chart-actividad', 'Actividad_Diaria')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'top' && (
          <div id="chart-top">
            <Chart options={topActivosChart.options} series={topActivosChart.series} type="bar" height={500} />
            <button
              onClick={() => exportToPDF('chart-top', 'Top_10_Activos')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'ratio' && (
          <div id="chart-ratio">
            <Chart options={ratioEmpleadosCentrosChart.options} series={ratioEmpleadosCentrosChart.series} type="scatter" height={400} />
            <button
              onClick={() => exportToPDF('chart-ratio', 'Ratio_Empleados_Centros')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'rotacion' && (
          <div id="chart-rotacion">
            <Chart options={rotacionChart.options} series={rotacionChart.series} type="area" height={400} />
            <button
              onClick={() => exportToPDF('chart-rotacion', 'Rotacion_Personal')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'contrato' && (
          <div id="chart-contrato">
            <Chart options={contratoChart.options} series={contratoChart.series} type="pie" height={400} />
            <button
              onClick={() => exportToPDF('chart-contrato', 'Distribucion_Contrato')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'productividad' && (
          <div id="chart-productividad">
            <Chart options={productividadChart.options} series={productividadChart.series} type="bar" height={400} />
            <button
              onClick={() => exportToPDF('chart-productividad', 'Productividad_Centro')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}

        {activeTab === 'mapa' && (
          <div id="chart-mapa" className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Distribución Geográfica de Empleados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mapaGeograficoData.map((item) => (
                <div key={item.centro} className="bg-gradient-to-br from-red-50 to-white p-4 rounded-xl border border-red-100 shadow-sm">
                  <h4 className="font-bold text-lg text-gray-800 mb-2">{item.centro}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Empleados:</span>
                      <span className="font-bold text-gray-800">{item.empleados}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Activos:</span>
                      <span className="font-bold text-green-600">{item.activos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Inactivos:</span>
                      <span className="font-bold text-red-600">{item.inactivos}</span>
                    </div>
                    {item.ubicaciones.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-600 text-xs">📍 Ubicaciones:</span>
                        <ul className="mt-1 space-y-1">
                          {item.ubicaciones.map((ubicacion) => (
                            <li key={ubicacion} className="text-xs text-gray-500">• {ubicacion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => exportToPDF('chart-mapa', 'Mapa_Geografico')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        )}
      </div>

      {showCentroModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Empleados de: {selectedCentroModal}</h2>
                <p className="text-red-100 text-sm mt-1">Total: {empleadosDelCentro.length} empleado(s)</p>
              </div>
              <button onClick={closeModal} className="text-white hover:text-red-200 transition-colors text-2xl font-bold">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {empleadosDelCentro.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No hay empleados en este centro</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {empleadosDelCentro.map((emp, index) => {
                    const nombre = emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || 'Sin nombre';
                    const codigo = emp.CODIGO || 'Sin código';
                    const estado = (emp.ESTADO || 'Sin estado').toString();
                    const email = emp['CORREO ELECTRONICO'] || emp.EMAIL || '';
                    const telefono = emp.TELEFONO || emp.TELEFON || '';
                    const direccion = emp.DIRECCION || '';
                    const estadoUpper = estado.toUpperCase();
                    const estadoColor =
                      estadoUpper === 'ACTIVO'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : estadoUpper === 'INACTIVO'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : estadoUpper === 'PENDIENTE'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300';

                    return (
                      <div key={`${codigo}-${index}`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-800 mb-1">{nombre}</h3>
                            <p className="text-sm text-gray-600">Código: {codigo}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${estadoColor}`}>{estado}</span>
                        </div>

                        <div className="space-y-2 text-sm">
                          {email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📧</span>
                              <span className="truncate">{email}</span>
                            </div>
                          )}
                          {telefono && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📞</span>
                              <span>{telefono}</span>
                            </div>
                          )}
                          {direccion && (
                            <div className="flex items-start gap-2 text-gray-600">
                              <span>📍</span>
                              <span className="text-xs">{direccion}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-600">Total: {empleadosDelCentro.length} empleado(s)</span>
              <button onClick={closeModal} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpleadosChartsSection;
