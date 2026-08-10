import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Button } from '../components/ui';
import { Link, Navigate, useNavigate } from 'react-router';
import Back3DButton from '../components/Back3DButton.jsx';
import { routes } from '../utils/routes';
import ChartsSection from '../components/analytics/ChartsSection';
import StatCard from '../components/analytics/StatCard';
import SectionCard from '../components/analytics/SectionCard';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../utils/reportError';
import { config } from '../config/env.js';

export default function EstadisticasPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('mensual');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedCentro, setSelectedCentro] = useState('todos');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [stats, setStats] = useState({
    totalEmpleados: 0,
    empleadosActivos: 0,
    empleadosInactivos: 0,
    totalFichajes: 0,
    entradas: 0,
    salidas: 0,
    sinSalida: 0,
    horasTrabajadas: 0,
    solicitudesPendientes: 0,
    promedioHoras: 0
  });
  const [centros, setCentros] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [detailedStats, setDetailedStats] = useState({});
  const [empleados, setEmpleados] = useState([]);
  const [fichajes, setFichajes] = useState([]);
  const [registrosHoras, setRegistrosHoras] = useState([]);
  const [showSinSalidaModal, setShowSinSalidaModal] = useState(false);
  const [showSalidaIntarziataModal, setShowSalidaIntarziataModal] = useState(false);
  const chartsRef = useRef(null);

  const hasStatisticsPermission = useCallback(() => {
    // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
    const isManager = authUser?.isManager || false;
    const isAdmin = authUser?.isAdmin || authUser?.GRUPO === 'Admin';
    const isDeveloper = authUser?.isDeveloper || authUser?.GRUPO === 'Developer';

    return isManager || isAdmin || isDeveloper;
  }, [authUser]);

  const parseJsonSafe = useCallback(async (response, label) => {
    const contentType = response.headers.get('content-type');
    const status = response.status;
    const text = await response.text();
    console.log(`[Estadísticas] ${label} status: ${status} (${contentType || 'sin content-type'})`);

    if (!text) {
      console.warn(`[Estadísticas] ${label} respondió vacío (status ${status})`);
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error(`[Estadísticas] ${label} no devolvió JSON válido`, text.slice(0, 200));
      throw error;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch empleados
      const empleadosRes = await fetch(routes.getEmpleados, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': config.APP_VERSION,
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
      });
      const empleados = await parseJsonSafe(empleadosRes, 'empleados');
      const empleadosArray = Array.isArray(empleados) ? empleados : empleados ? [empleados] : [];
      
      // Extract centros
      const centrosUnicos = [...new Set(empleadosArray.map(emp => emp['CENTRO TRABAJO']).filter(Boolean))];
      setCentros(['todos', ...centrosUnicos]);
      setEmpleados(empleadosArray);
      
      // Filter empleados by centro
      const empleadosFiltrados = selectedCentro === 'todos' 
        ? empleadosArray 
        : empleadosArray.filter(emp => emp['CENTRO TRABAJO'] === selectedCentro);
      
      const totalEmpleados = empleadosFiltrados.length;

      // Fetch fichajes (backend nou, fără n8n)
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const fichajesRes = await fetch(routes.getFichajes, { headers });
      const fichajes = await parseJsonSafe(fichajesRes, 'fichajes');
      const fichajesArray = Array.isArray(fichajes) ? fichajes : fichajes ? [fichajes] : [];
      setFichajes(fichajesArray);
      
      // ChartsSection va face apelurile la endpoint-ul de ore lucrate
      // Nu mai fac apel aici pentru a evita duplicarea
      setRegistrosHoras([]);
      
      // Filter fichajes by period and centro
      let fichajesFiltrados = [];
      const hoy = new Date();
      
      switch (selectedPeriod) {
        case 'hoy': {
          const hoyStr = hoy.toISOString().split('T')[0];
          fichajesFiltrados = fichajesArray.filter(f => f.FECHA === hoyStr);
          break;
        }
        case 'semana': {
          const semanaAtras = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
          fichajesFiltrados = fichajesArray.filter(f => {
            const fecha = new Date(f.FECHA);
            return fecha >= semanaAtras;
          });
          break;
        }
        case 'mes': {
          const mesAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
          fichajesFiltrados = fichajesArray.filter(f => {
            const fecha = new Date(f.FECHA);
            return fecha >= mesAtras;
          });
          break;
        }
      }

      // Filter by centro if needed
      if (selectedCentro !== 'todos') {
        fichajesFiltrados = fichajesFiltrados.filter(f => {
          const empleado = empleadosArray.find(emp => 
            emp['CORREO ELECTRONICO'] === f['CORREO ELECTRONICO']
          );
          return empleado && empleado['CENTRO TRABAJO'] === selectedCentro;
        });
      }

      // Fetch solicitudes
      // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
      const isManager = authUser?.isManager || false;
      const emailLogat = authUser?.['CORREO ELECTRONICO'];
      
      let solicitudesUrl = routes.getSolicitudesByEmail;
      if (!isManager) {
        solicitudesUrl += `?email=${encodeURIComponent(emailLogat)}`;
      }
      
      // ✅ Adăugat JWT token pentru autentificare (folosim token-ul deja declarat mai sus)
      const solicitudesHeaders = {
        'Content-Type': 'application/json',
      };
      if (token) {
        solicitudesHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      const solicitudesRes = await fetch(solicitudesUrl, {
        headers: solicitudesHeaders,
        credentials: 'include'
      });
      const solicitudes = await parseJsonSafe(solicitudesRes, 'solicitudes');
      const solicitudesArray = Array.isArray(solicitudes) ? solicitudes : solicitudes ? [solicitudes] : [];
      
      const solicitudesPendientes = solicitudesArray.filter(s => {
        const estadoProps = [s.ESTADO, s.estado, s['ESTADO_SOLICITUD'], s['STATUS']];
        return estadoProps.some(prop => prop && prop.toString().trim().toLowerCase().replace(/\s+/g, '') === 'pendiente');
      }).length;

      // ✅ MIGRAT: Calculate detailed stats via backend /api/estadisticas (fichajes agregados)
      // Build payload based on selected period
      let payload = { tipo: 'mensual', ano: selectedYear, mes: selectedMonth, centro: selectedCentro, tipoRaport: 'fichajes' };
      if (selectedPeriod === 'anual') {
        payload = { tipo: 'anual', ano: selectedYear, centro: selectedCentro, tipoRaport: 'fichajes' };
      } else if (selectedPeriod === 'personalizado') {
        payload = { tipo: 'rango', desde: customDateFrom, hasta: customDateTo, centro: selectedCentro, tipoRaport: 'fichajes' };
      }

      // Validare parametri pentru a preveni error 500
      if (payload.tipo === 'mensual' && (!payload.ano || !payload.mes)) {
        console.warn('⚠️ Invalid payload for fichajes agregados (mensual):', payload);
        payload = { tipo: 'mensual', ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, centro: selectedCentro, tipoRaport: 'fichajes' };
      }
      if (payload.tipo === 'anual' && !payload.ano) {
        console.warn('⚠️ Invalid payload for fichajes agregados (anual):', payload);
        payload = { tipo: 'anual', ano: new Date().getFullYear(), centro: selectedCentro, tipoRaport: 'fichajes' };
      }
      if (payload.tipo === 'rango' && (!payload.desde || !payload.hasta)) {
        console.warn('⚠️ Invalid payload for fichajes agregados (rango):', payload);
        // Skip request dacă nu avem date valide pentru rango
      }

      let entradas = 0;
      let salidas = 0;
      let sinSalida = 0;
      let faraIesireDetaliat = [];
      let salidaIntarziata = 0;
      let salidaIntarziataDetaliat = [];
      
      // Doar dacă payload-ul este valid
      if ((payload.tipo === 'mensual' && payload.ano && payload.mes) ||
          (payload.tipo === 'anual' && payload.ano) ||
          (payload.tipo === 'rango' && payload.desde && payload.hasta)) {
        try {
          // ✅ Folosim token-ul deja declarat mai sus (linia 96)
          const fichajesHeaders = {
            'Content-Type': 'application/json',
          };
          if (token) {
            fichajesHeaders['Authorization'] = `Bearer ${token}`;
          }

          console.log('📊 Fetching fichajes agregados with payload:', payload);
          const resp = await fetch(routes.getEstadisticas, {
            method: 'POST',
            headers: fichajesHeaders,
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          
          if (!resp.ok) {
            const errorText = await resp.text();
            console.error('❌ Error fetching fichajes agregados:', resp.status, errorText);
            throw new Error(`HTTP ${resp.status}: ${errorText.substring(0, 200)}`);
          }
          
          const agg = await parseJsonSafe(resp, 'fichajes agregados');
          const dataAgg = Array.isArray(agg) ? (agg?.[0] || {}) : (agg || {});
          entradas = Number(dataAgg.intrari_total) || 0;
          salidas = Number(dataAgg.iesiri_total) || 0;
          sinSalida = Number(dataAgg.fara_iesire_total) || 0;
          salidaIntarziata = Number(dataAgg.salida_intarziata_total) || 0;
          
          // Parsez detaliile pentru "fara ieșire" - noua structură cu ZILE_FARA_IESIRE
          if (dataAgg.fara_iesire_detaliat) {
            try {
              faraIesireDetaliat = typeof dataAgg.fara_iesire_detaliat === 'string' 
                ? JSON.parse(dataAgg.fara_iesire_detaliat)
                : dataAgg.fara_iesire_detaliat;
              
              // Verific dacă este array
              if (Array.isArray(faraIesireDetaliat)) {
                console.log('📊 Detalii fara_iesire parsate:', faraIesireDetaliat.length, 'empleados');
              }
            } catch (parseError) {
              console.error('Error parsing fara_iesire_detaliat:', parseError);
              faraIesireDetaliat = [];
            }
          }
          
          // Parsez detaliile pentru "salida întârziată"
          if (dataAgg.salida_intarziata_detaliat) {
            try {
              salidaIntarziataDetaliat = typeof dataAgg.salida_intarziata_detaliat === 'string' 
                ? JSON.parse(dataAgg.salida_intarziata_detaliat)
                : dataAgg.salida_intarziata_detaliat;
              
              // Verific dacă este array
              if (Array.isArray(salidaIntarziataDetaliat)) {
                console.log('📊 Detalii salida_intarziata parsate:', salidaIntarziataDetaliat.length, 'empleados');
              }
            } catch (parseError) {
              console.error('Error parsing salida_intarziata_detaliat:', parseError);
              salidaIntarziataDetaliat = [];
            }
          }
        } catch (e) {
          console.error('Error fetching fichajes aggregate:', e);
        }
      }

      // Hours worked (optional here) - keep previous lightweight estimate if available
      let horasTrabajadas = 0;

      const statsData = {
        totalEmpleados,
        fichajesHoy: fichajesFiltrados.length,
        cuadrantesActivos: 0, // Will be calculated from real data
        solicitudesPendientes,
        horasTrabajadas: Math.round(horasTrabajadas * 100) / 100,
        promedioHoras: totalEmpleados > 0 ? Math.round((horasTrabajadas / totalEmpleados) * 100) / 100 : 0
      };

      setStats(statsData);

      // Detailed stats
      const solicitudesAprobadas = solicitudesArray.filter(s => {
        const estadoProps = [s.ESTADO, s.estado, s['ESTADO_SOLICITUD'], s['STATUS']];
        return estadoProps.some(prop => prop && prop.toString().trim().toLowerCase().replace(/\s+/g, '') === 'aprobada');
      }).length;

      const solicitudesRechazadas = solicitudesArray.filter(s => {
        const estadoProps = [s.ESTADO, s.estado, s['ESTADO_SOLICITUD'], s['STATUS']];
        return estadoProps.some(prop => prop && prop.toString().trim().toLowerCase().replace(/\s+/g, '') === 'rechazada');
      }).length;

      // Calculate by request type
      const asuntosPropios = solicitudesArray.filter(s => {
        const tipoProps = [s.TIPO, s.tipo, s['TIPO_SOLICITUD']];
        return tipoProps.some(prop => prop && prop.toString().trim().toLowerCase().includes('asunto propio'));
      }).length;

      const vacaciones = solicitudesArray.filter(s => {
        const tipoProps = [s.TIPO, s.tipo, s['TIPO_SOLICITUD']];
        return tipoProps.some(prop => prop && prop.toString().trim().toLowerCase().includes('vacaciones'));
      }).length;

      const detailedStatsData = {
        entradas,
        salidas,
        sinSalida,
        faraIesireDetaliat, // Detalii pentru "Sin salida"
        salidaIntarziata, // Total "Salida întârziată"
        salidaIntarziataDetaliat, // Detalii pentru "Salida întârziată"
        totalFichajes: fichajesFiltrados.length,
        empleadosActivos: new Set(fichajesFiltrados.map(f => f['CORREO ELECTRONICO'])).size,
        horasTrabajadas: Math.round(horasTrabajadas * 100) / 100,
        solicitudesPendientes,
        solicitudesAprobadas,
        solicitudesRechazadas,
        asuntosPropios,
        vacaciones,
        totalSolicitudes: solicitudesArray.length
      };

      setDetailedStats(detailedStatsData);

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [authUser, customDateFrom, customDateTo, selectedCentro, selectedMonth, selectedPeriod, selectedYear, parseJsonSafe]);

  useEffect(() => {
    if (hasStatisticsPermission()) {
      // Always fetch real data - no demo mode for statistics
      console.log('📊 Fetching real estadisticas data from backend');
      fetchStats();
    }
  }, [hasStatisticsPermission, fetchStats]);

  // Funcție pentru export PDF a modalului "Sin salida" cu header și logo firma
  const exportSinSalidaToPDF = async () => {
    try {
      const modalContent = document.getElementById('sin-salida-modal-content');
      if (!modalContent) {
        console.error('Contenido del modal no encontrado');
        return;
      }

      // Creez canvas din conținutul modalului
      const canvas = await html2canvas(modalContent, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });

      // Creez PDF
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      
      // Încarc logo-ul (folosesc logo PNG din public pentru compatibilitate jsPDF)
      let logoData = null;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        const basePath = config.BASE_PATH || '/';
        const logoPath = config.LOGO_PATH
          ? config.LOGO_PATH.replace(/\.(svg|jpg|jpeg)$/i, '.png')
          : 'logo.png';
        logoImg.src = `${basePath}${logoPath}`.replace(/\/+/g, '/'); // Folosesc PNG pentru jsPDF
        
        logoData = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Timeout cargando logo, continuando sin logo');
            resolve(null);
          }, 2000);
          
          logoImg.onload = () => {
            clearTimeout(timeout);
            const logoCanvas = document.createElement('canvas');
            logoCanvas.width = logoImg.naturalWidth || logoImg.width || 80;
            logoCanvas.height = logoImg.naturalHeight || logoImg.height || 80;
            const logoCtx = logoCanvas.getContext('2d');
            logoCtx.drawImage(logoImg, 0, 0);
            resolve(logoCanvas.toDataURL('image/png'));
          };
          
          logoImg.onerror = () => {
            clearTimeout(timeout);
            console.warn('No se pudo cargar el logo, continuando sin logo');
            resolve(null);
          };
        });
      } catch (logoError) {
        console.warn('Error cargando logo:', logoError);
        logoData = null;
      }

      let yPosition = 10;
      const margin = 10;
      const contentWidth = 190; // A4 width minus margins (210 - 20)
      const pageHeight = 287; // A4 height minus margins (297 - 10)

      // Header cu logo și informații companie
      if (logoData) {
        pdf.addImage(logoData, 'PNG', margin, yPosition, 15, 15); // Logo mic: 15x15mm
      }
      
      // Informații companie lângă logo
      pdf.setFontSize(16);
      pdf.setTextColor(220, 38, 38); // Culoare roșie (#DC2626)
      pdf.setFont('helvetica', 'bold');
      pdf.text(config.COMPANY_NAME, margin + (logoData ? 20 : 0), yPosition + 6);
      
      pdf.setFontSize(12);
      pdf.setTextColor(31, 41, 55); // Gri închis
      pdf.setFont('helvetica', 'normal');
      pdf.text('DETALLE DE EMPLEADOS SIN SALIDA', margin + (logoData ? 20 : 0), yPosition + 12);
      
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128); // Gri mediu
      const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      pdf.text(`Generado el ${fechaGeneracion} por Sistema`, margin + (logoData ? 20 : 0), yPosition + 18);
      
      // Linie separatoare
      yPosition += 25;
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, margin + contentWidth, yPosition);
      yPosition += 10;

      // Adaug conținutul (canvas)
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      let heightLeft = imgHeight;
      yPosition += imgHeight;

      // Adaug pagini suplimentare dacă este necesar
      while (heightLeft > pageHeight) {
        pdf.addPage();
        yPosition = 10;
        
        // Adaug header pe fiecare pagină
        if (logoData) {
          pdf.addImage(logoData, 'PNG', margin, yPosition, 15, 15);
        }
        pdf.setFontSize(12);
        pdf.setTextColor(220, 38, 38);
        pdf.setFont('helvetica', 'bold');
        pdf.text(config.COMPANY_NAME, margin + (logoData ? 20 : 0), yPosition + 6);
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.setFont('helvetica', 'normal');
        pdf.text('DETALLE DE EMPLEADOS SIN SALIDA', margin + (logoData ? 20 : 0), yPosition + 12);
        
        yPosition += 20;
        pdf.setDrawColor(220, 38, 38);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition, margin + contentWidth, yPosition);
        yPosition += 10;
        
        // Continuă cu restul conținutului
        const remainingHeight = heightLeft - pageHeight;
        const imgY = -(imgHeight - remainingHeight);
        pdf.addImage(imgData, 'PNG', margin, imgY, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Footer pe ultima pagină
      const totalPages = pdf.internal.pages.length - 1;
      pdf.setPage(totalPages);
      yPosition = 280;
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total: ${detailedStats.faraIesireDetaliat?.length || 0} empleado(s) sin salida`, margin, yPosition);
      pdf.text(`${detailedStats.faraIesireDetaliat?.reduce((sum, emp) => sum + (emp.ZILE_FARA_IESIRE?.length || 0), 0) || 0} registro(s) total(es)`, margin, yPosition + 5);

      // Descarcă PDF-ul
      const fechaActual = new Date().toISOString().split('T')[0];
      pdf.save(`Empleados_Sin_Salida_${fechaActual}.pdf`);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
    }
  };

  if (!hasStatisticsPermission()) {
    return <Navigate to="/inicio" replace />;
  }

  const periods = [
    { id: 'anual', label: 'Anual', icon: '📅', description: 'Selecciona el año' },
    { id: 'mensual', label: 'Mensual', icon: '📊', description: 'Selecciona el mes' },
    { id: 'personalizado', label: 'Personalizado', icon: '📈', description: 'De X a Y' }
  ];

  // Ani dinamici: ultimii 3 ani + anul curent + următorul an (dacă e necesar)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { id: 1, label: 'Enero' },
    { id: 2, label: 'Febrero' },
    { id: 3, label: 'Marzo' },
    { id: 4, label: 'Abril' },
    { id: 5, label: 'Mayo' },
    { id: 6, label: 'Junio' },
    { id: 7, label: 'Julio' },
    { id: 8, label: 'Agosto' },
    { id: 9, label: 'Septiembre' },
    { id: 10, label: 'Octubre' },
    { id: 11, label: 'Noviembre' },
    { id: 12, label: 'Diciembre' }
  ];

  const empleadosActivosCount = empleados.filter(
    (emp) => emp.ESTADO?.toString().toUpperCase() === 'ACTIVO',
  ).length;

  const periodBadgeLabel = (() => {
    if (selectedPeriod === 'mensual') {
      const monthLabel = months.find((m) => m.id === selectedMonth)?.label || '';
      return `Mes: ${monthLabel} ${selectedYear}`;
    }
    if (selectedPeriod === 'anual') return `Año: ${selectedYear}`;
    if (selectedPeriod === 'personalizado') {
      if (customDateFrom && customDateTo) return `${customDateFrom} → ${customDateTo}`;
      return 'Período personalizado';
    }
    return 'Período';
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-3"></div>
          <div className="text-red-600 font-semibold">Cargando estadísticas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-gray-200">
        <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Back3DButton to="/inicio" title="Volver al Inicio" />
              <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-sm">📊</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-red-700 truncate">
                    Estadísticas Avanzadas
                  </h1>
                  {selectedPeriod === 'mensual' || selectedPeriod === 'anual' ? (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-100 px-1.5 py-1">
                      {selectedPeriod === 'mensual' && (
                        <select
                          aria-label="Seleccionar mes"
                          value={selectedMonth}
                          onChange={(e) => {
                            setSelectedPeriod('mensual');
                            setSelectedMonth(parseInt(e.target.value, 10));
                          }}
                          className="text-xs font-medium text-red-800 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer pr-1 max-w-[9.5rem]"
                        >
                          {months.map((month) => (
                            <option key={month.id} value={month.id}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {selectedPeriod === 'anual' && (
                        <span className="text-xs font-medium text-red-800 pl-1">Año</span>
                      )}
                      <select
                        aria-label="Seleccionar año"
                        value={selectedYear}
                        onChange={(e) => {
                          setSelectedYear(parseInt(e.target.value, 10));
                        }}
                        className="text-xs font-medium text-red-800 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                      {periodBadgeLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center gap-1.5 !py-1.5 !px-3 text-sm"
              >
                <span>🔍</span>
                Filtros
              </Button>
              <button
                type="button"
                onClick={() => chartsRef.current?.exportAllChartsToPDF?.()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span>📄</span>
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  const periodNames = {
                    mensual: 'Mensual',
                    anual: 'Anual',
                    personalizado: 'Personalizado',
                  };
                  const pageData = {
                    additionalInfo: [
                      `[PERIODO] ${periodNames[selectedPeriod] || selectedPeriod}`,
                      selectedPeriod === 'mensual' ? `[MES] ${selectedMonth}/${selectedYear}` : null,
                      selectedPeriod === 'anual' ? `[AÑO] ${selectedYear}` : null,
                      selectedCentro !== 'todos' ? `[CENTRO] ${selectedCentro}` : null,
                      stats?.totalEmpleados > 0 ? `[EMPLEADOS] ${stats.totalEmpleados} total` : null,
                      stats?.totalFichajes > 0 ? `[FICHAJES] ${stats.totalFichajes} total` : null,
                    ].filter(Boolean),
                  };
                  const message = buildErrorReportMessage({
                    authUser,
                    pageName: 'Estadísticas',
                    pageData,
                  });
                  openWhatsAppErrorReport(message);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                title="Reportar Error"
              >
                <span>🐛</span>
                <span className="hidden sm:inline">Reportar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-8 py-5 space-y-5">
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-800 mb-3">Filtros avanzados</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de período</label>
              <div className="flex flex-wrap gap-2">
                {periods.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setSelectedPeriod(period.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === period.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{period.icon}</span>
                    <span>{period.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedPeriod === 'anual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona el año</label>
                  <div className="flex flex-wrap gap-2">
                    {years.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          selectedYear === year
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedPeriod === 'mensual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona el año</label>
                    <div className="flex flex-wrap gap-2">
                      {years.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => setSelectedYear(year)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            selectedYear === year
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona el mes</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      {months.map((month) => (
                        <option key={month.id} value={month.id}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {selectedPeriod === 'personalizado' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Desde la fecha</label>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hasta la fecha</label>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Centro</label>
                <select
                  value={selectedCentro}
                  onChange={(e) => setSelectedCentro(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                >
                  {centros.map((centro) => (
                    <option key={centro} value={centro}>
                      {centro === 'todos' ? 'Todos los centros' : centro}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <StatCard
            label="Total empleados"
            value={stats.totalEmpleados || empleados.length}
            icon="👥"
            accent="slate"
            title="Ver estadísticas de empleados"
            onClick={() => navigate('/estadisticas-empleados')}
          />
          <StatCard
            label="Empleados activos"
            value={empleadosActivosCount}
            icon="✅"
            accent="green"
            title="Ver estadísticas de empleados"
            onClick={() => navigate('/estadisticas-empleados')}
          />
          <StatCard
            label="Entradas"
            value={detailedStats.entradas ?? 0}
            icon="⬇️"
            accent="green"
            title="Ver detalles de registros"
            onClick={() => {
              document.getElementById('detalles-registros')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
          />
          <StatCard
            label="Salidas"
            value={detailedStats.salidas ?? 0}
            icon="⬆️"
            accent="red"
            title="Ver detalles de registros"
            onClick={() => {
              document.getElementById('detalles-registros')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
          />
          <StatCard
            label="Sin salida"
            value={detailedStats.sinSalida ?? 0}
            icon="⚠️"
            accent="amber"
            title="Ver empleados sin salida"
            onClick={() => setShowSinSalidaModal(true)}
          />
          <StatCard
            label="Salidas con retraso"
            value={detailedStats.salidaIntarziata ?? 0}
            icon="⏰"
            accent="orange"
            title="Ver salidas con retraso"
            onClick={() => setShowSalidaIntarziataModal(true)}
          />
        </div>

        <ChartsSection
          ref={chartsRef}
          stats={stats}
          centros={centros}
          selectedCentro={selectedCentro}
          selectedPeriod={selectedPeriod}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          customDateFrom={customDateFrom}
          customDateTo={customDateTo}
          empleados={empleados}
          fichajes={fichajes}
          registrosHoras={registrosHoras}
        />

        {detailedStats && detailedStats.entradas !== undefined && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 lg:gap-5">
            <SectionCard id="detalles-registros" title="Detalles de Registros" bodyClassName="!pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-green-50/80 border border-green-100">
                  <span className="text-sm text-gray-700">Entradas</span>
                  <span className="text-lg font-bold text-green-700 tabular-nums">{detailedStats.entradas || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-red-50/80 border border-red-100">
                  <span className="text-sm text-gray-700">Salidas</span>
                  <span className="text-lg font-bold text-red-700 tabular-nums">{detailedStats.salidas || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-50/80 border border-amber-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-700">Sin salida</span>
                    {detailedStats.sinSalida > 0 && detailedStats.faraIesireDetaliat?.length > 0 && (
                      <button type="button" onClick={() => setShowSinSalidaModal(true)} className="text-amber-700 hover:text-amber-800 text-xs underline">
                        Ver detalles
                      </button>
                    )}
                  </div>
                  <span className="text-lg font-bold text-amber-700 tabular-nums">{detailedStats.sinSalida || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-orange-50/80 border border-orange-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-700">Salida con retraso</span>
                    {detailedStats.salidaIntarziata > 0 && detailedStats.salidaIntarziataDetaliat?.length > 0 && (
                      <button type="button" onClick={() => setShowSalidaIntarziataModal(true)} className="text-orange-700 hover:text-orange-800 text-xs underline">
                        Ver detalles
                      </button>
                    )}
                  </div>
                  <span className="text-lg font-bold text-orange-700 tabular-nums">{detailedStats.salidaIntarziata || 0}</span>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Detalles de Solicitudes" bodyClassName="!pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-50/80 border border-blue-100">
                  <span className="text-sm text-gray-700">Asuntos propios</span>
                  <span className="text-lg font-bold text-blue-700 tabular-nums">{detailedStats.asuntosPropios || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-violet-50/80 border border-violet-100">
                  <span className="text-sm text-gray-700">Vacaciones</span>
                  <span className="text-lg font-bold text-violet-700 tabular-nums">{detailedStats.vacaciones || 0}</span>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/estadisticas-cuadrantes" className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">📋</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">Estadísticas de Cuadrantes</h3>
                <p className="text-sm text-gray-500 mt-0.5">Análisis de programas de trabajo</p>
                <span className="inline-block mt-2 text-sm font-medium text-indigo-600 group-hover:underline">Ver estadísticas →</span>
              </div>
            </div>
          </Link>
          <Link to="/estadisticas-empleados" className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-green-200 hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">👥</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">Estadísticas de Empleados</h3>
                <p className="text-sm text-gray-500 mt-0.5">Rendimiento y actividad</p>
                <span className="inline-block mt-2 text-sm font-medium text-green-600 group-hover:underline">Ver estadísticas →</span>
              </div>
            </div>
          </Link>
          <Link to="/estadisticas-fichajes" className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">⏰</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">Estadísticas de Registros</h3>
                <p className="text-sm text-gray-500 mt-0.5">Análisis de horas trabajadas</p>
                <span className="inline-block mt-2 text-sm font-medium text-orange-600 group-hover:underline">Ver estadísticas →</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Modal pentru detalii "Sin salida" */}
      {showSinSalidaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">⚠️</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Empleados Sin Salida</h2>
                  <p className="text-sm text-gray-500">Detalles de registros sin salida registrada</p>
                </div>
              </div>
              <button
                onClick={() => setShowSinSalidaModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div id="sin-salida-modal-content" className="flex-1 overflow-y-auto p-6">
              {detailedStats.faraIesireDetaliat && detailedStats.faraIesireDetaliat.length > 0 ? (
                <div className="space-y-4">
                  {detailedStats.faraIesireDetaliat.map((empleado, index) => {
                    const zileFaraIesire = empleado.ZILE_FARA_IESIRE || [];
                    const totalZile = zileFaraIesire.length;
                    
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {/* Header angajat */}
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">{totalZile}</span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{empleado.NOMBRE || '-'}</div>
                                <div className="text-xs text-gray-500">Código: {empleado.CODIGO || '-'}</div>
                              </div>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {totalZile} día{totalZile !== 1 ? 's' : ''} sin salida
                            </span>
                          </div>
                        </div>
                        
                        {/* Lista zilelor */}
                        {totalZile > 0 && (
                          <div className="divide-y divide-gray-200">
                            {zileFaraIesire.map((zile, zileIndex) => (
                              <div key={zileIndex} className="px-4 py-3 hover:bg-gray-50">
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Fecha</div>
                                    <div className="text-sm text-gray-900">
                                      {zile.FECHA ? new Date(zile.FECHA).toLocaleDateString('es-ES', { 
                                        day: '2-digit', 
                                        month: '2-digit', 
                                        year: 'numeric' 
                                      }) : '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Hora</div>
                                    <div className="text-sm text-gray-900">{zile.HORA || '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Dirección</div>
                                    <div className="text-sm text-gray-700 truncate" title={zile.DIRECCION || '-'}>
                                      {zile.DIRECCION || 'Sin dirección'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay detalles disponibles</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <div>Total: {detailedStats.faraIesireDetaliat?.length || 0} empleado(s) sin salida</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {detailedStats.faraIesireDetaliat?.reduce((sum, emp) => sum + (emp.ZILE_FARA_IESIRE?.length || 0), 0) || 0} registro(s) total(es)
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={exportSinSalidaToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar PDF
                  </button>
                  <button
                    onClick={() => setShowSinSalidaModal(false)}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru detalii "Salida întârziată" */}
      {showSalidaIntarziataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">⏰</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Salida con retraso</h2>
                  <p className="text-sm text-gray-500">Detalles de registros con salida después de 2+ días</p>
                </div>
              </div>
              <button
                onClick={() => setShowSalidaIntarziataModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailedStats.salidaIntarziataDetaliat && detailedStats.salidaIntarziataDetaliat.length > 0 ? (
                <div className="space-y-4">
                  {detailedStats.salidaIntarziataDetaliat.map((empleado, index) => {
                    const zileFaraIesire = empleado.ZILE_FARA_IESIRE || [];
                    const totalZile = zileFaraIesire.length;
                    
                    return (
                      <div key={index} className="bg-white border border-orange-200 rounded-lg overflow-hidden">
                        {/* Header angajat */}
                        <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">{totalZile}</span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{empleado.NOMBRE || '-'}</div>
                                <div className="text-xs text-gray-500">Código: {empleado.CODIGO || '-'}</div>
                              </div>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {totalZile} día{totalZile !== 1 ? 's' : ''} con salida con retraso
                            </span>
                          </div>
                        </div>
                        
                        {/* Lista zilelor */}
                        {totalZile > 0 && (
                          <div className="divide-y divide-gray-200">
                            {zileFaraIesire.map((zile, zileIndex) => {
                              // Calculează zilele între entrada și salida
                              const fechaEntrada = zile.FECHA;
                              const fechaSalida = zile.FECHA_SALIDA;
                              let diasDiferencia = null;
                              if (fechaEntrada && fechaSalida) {
                                const entrada = new Date(fechaEntrada);
                                const salida = new Date(fechaSalida);
                                const diffTime = Math.abs(salida - entrada);
                                diasDiferencia = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              }
                              
                              return (
                                <div key={zileIndex} className="px-4 py-3 hover:bg-gray-50">
                                  <div className="grid grid-cols-4 gap-4">
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Fecha Entrada</div>
                                      <div className="text-sm text-gray-900">
                                        {zile.FECHA ? new Date(zile.FECHA).toLocaleDateString('es-ES', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric' 
                                        }) : '-'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Hora</div>
                                      <div className="text-sm text-gray-900">{zile.HORA || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Fecha Salida</div>
                                      <div className="text-sm text-gray-900">
                                        {fechaSalida ? new Date(fechaSalida).toLocaleDateString('es-ES', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric' 
                                        }) : '-'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Días diferencia</div>
                                      <div className="text-sm font-semibold text-orange-600">
                                        {diasDiferencia !== null ? `${diasDiferencia} día${diasDiferencia !== 1 ? 's' : ''}` : '-'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-gray-500 mb-1">Dirección</div>
                                    <div className="text-sm text-gray-700 truncate" title={zile.DIRECCION || '-'}>
                                      {zile.DIRECCION || 'Sin dirección'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay detalles disponibles</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <div>Total: {detailedStats.salidaIntarziataDetaliat?.length || 0} empleado(s) con salida con retraso</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {detailedStats.salidaIntarziataDetaliat?.reduce((sum, emp) => sum + (emp.ZILE_FARA_IESIRE?.length || 0), 0) || 0} registro(s) total(es)
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSalidaIntarziataModal(false)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 