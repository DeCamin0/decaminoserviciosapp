import React, { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import type { ResumenEmpleado } from './HorasTrabajadas';

export type EmployeeMonthlyTableProps = {
  data: ResumenEmpleado[];
  onVerDetalle: (empleadoId: number) => void;
  loading?: boolean;
  isMobile?: boolean;
};

// Component pentru item-ul de horas pe mobile (compact, similar cu TimeCheck)
const MobileHorasItem: React.FC<{ 
  empleado: ResumenEmpleado; 
  onVerDetalle: (empleadoId: number) => void;
  formatHours: (value: string | number | undefined) => string;
  getEstadoColor: (estado: string) => string;
}> = ({ empleado, onVerDetalle, formatHours, getEstadoColor }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const estadoColor = getEstadoColor(empleado.estado || 'OK');
  const horasTrabajadas = formatHours(empleado.horasTrabajadas || empleado.totalTrabajadas);
  const horasPlan = formatHours(empleado.totalPlan || empleado.horasContrato);
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/galben/roșu) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          empleado.estado === 'OK' ? 'bg-green-500' :
          empleado.estado === 'ALERTA' ? 'bg-yellow-500' :
          'bg-red-500'
        }`}></div>
        
        {/* Nume - text mic */}
        <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold flex-1 truncate">
          {empleado.empleadoNombre}
        </span>
        
        {/* Horas Trabajadas - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[50px]">
          {horasTrabajadas}
        </span>
        
        {/* Estado - badge mic */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${estadoColor} min-w-[45px] text-center`}>
          {empleado.estado || 'OK'}
        </span>
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Horas Trabajadas */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Trabajadas:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{horasTrabajadas}</span>
          </div>
          
          {/* Horas Plan */}
          {horasPlan && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Plan:</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{horasPlan}</span>
            </div>
          )}
          
          {/* Horas Permitidas */}
          {empleado.totalPermitidas && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Permitidas:</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{formatHours(empleado.totalPermitidas)}</span>
            </div>
          )}
          
          {/* Estado complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Estado:</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${estadoColor}`}>
              {empleado.estado || 'OK'}
            </span>
          </div>
          
          {/* Buton Ver Detalle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerDetalle(empleado.empleadoId);
            }}
            className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            👁️ Ver Detalle
          </button>
        </div>
      )}
    </div>
  );
};

const EmployeeMonthlyTable: React.FC<EmployeeMonthlyTableProps> = ({ 
  data, 
  onVerDetalle, 
  loading = false,
  isMobile = false
}) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const updateWidth = () => {
      const container = tableScrollRef.current;
      if (!container) {
        return;
      }

      const contentWidth = container.scrollWidth;
      const visibleWidth = container.clientWidth;

      setTableScrollWidth(contentWidth);
      setHasOverflow(contentWidth > visibleWidth + 1);
    };

    const rafId = requestAnimationFrame(updateWidth);
    window.addEventListener('resize', updateWidth);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateWidth);
    };
  }, [data]);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;

    if (!topEl || !tableEl) {
      return;
    }

    let syncingFromTop = false;
    let syncingFromTable = false;

    const handleTopScroll = () => {
      if (syncingFromTable) {
        syncingFromTable = false;
        return;
      }
      if (!tableScrollRef.current) {
        return;
      }
      syncingFromTop = true;
      tableScrollRef.current.scrollLeft = topEl.scrollLeft;
    };

    const handleTableScroll = () => {
      if (syncingFromTop) {
        syncingFromTop = false;
        return;
      }
      if (!topScrollRef.current) {
        return;
      }
      syncingFromTable = true;
      topScrollRef.current.scrollLeft = tableEl.scrollLeft;
    };

    topEl.addEventListener('scroll', handleTopScroll);
    tableEl.addEventListener('scroll', handleTableScroll);

    return () => {
      topEl.removeEventListener('scroll', handleTopScroll);
      tableEl.removeEventListener('scroll', handleTableScroll);
    };
  }, [data.length]);

  const topScrollContentWidth = tableScrollWidth > 0 ? `${tableScrollWidth}px` : '100%';

  // Funcție pentru formatarea orelor (number sau string) în format ore
  const formatHours = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') {
      return '0:00:00';
    }
    
    // Dacă este deja în format "HH:MM:SS", returnează direct
    if (typeof value === 'string' && value.includes(':')) {
      return value;
    }
    
    // Convertim la number
    const hours = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(hours) || hours === 0) {
      return '0:00:00';
    }
    
    // Convertim orele în format HH:MM:SS
    const h = Math.floor(hours);
    const minutes = Math.floor((hours - h) * 60);
    const seconds = Math.floor(((hours - h) * 60 - minutes) * 60);
    
    return `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Funcție pentru formatarea numerelor cu 2 zecimale
  const formatNumber = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') {
      return '0.00';
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };
  
  const getEstadoColor = (estado: 'OK' | 'ALERTA' | 'RIESGO' | string) => {
    switch (estado) {
      case 'OK': return 'bg-green-100 text-green-800';
      case 'ALERTA': return 'bg-yellow-100 text-yellow-800';
      case 'RIESGO': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Debug: log primul item pentru a vedea ce date primește
  if (data && data.length > 0) {
    console.log('🔍 EmployeeMonthlyTable - First item:', data[0]);
    console.log('🔍 EmployeeMonthlyTable - horasTrabajadas:', data[0].horasTrabajadas, 'type:', typeof data[0].horasTrabajadas);
    console.log('🔍 EmployeeMonthlyTable - horasContrato:', data[0].horasContrato, 'type:', typeof data[0].horasContrato);
    console.log('🔍 EmployeeMonthlyTable - horasPermitidasMensuales:', data[0].horasPermitidasMensuales, 'type:', typeof data[0].horasPermitidasMensuales);
    console.log('🔍 EmployeeMonthlyTable - estado:', data[0].estado);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando...</span>
      </div>
    );
  }

  // Pe mobile, afișează listă verticală compactă
  if (isMobile) {
    return (
      <div className="space-y-1.5">
        {data.map((empleado) => (
          <MobileHorasItem
            key={empleado.empleadoId}
            empleado={empleado}
            onVerDetalle={onVerDetalle}
            formatHours={formatHours}
            getEstadoColor={getEstadoColor}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={topScrollRef}
        className="overflow-x-auto mb-2"
        style={{
          height: hasOverflow ? 20 : 0,
          borderRadius: hasOverflow ? 8 : 0,
          border: hasOverflow ? '1px solid #e5e7eb' : 'none',
          backgroundColor: hasOverflow ? '#f9fafb' : 'transparent',
          boxShadow: hasOverflow ? 'inset 0 1px 2px rgba(15, 23, 42, 0.04)' : 'none',
          overflow: hasOverflow ? 'auto' : 'hidden'
        }}
        aria-hidden="true"
      >
        <div style={{ width: topScrollContentWidth, height: 1 }} />
      </div>

      <div ref={tableScrollRef} className="overflow-x-auto w-full">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm relative">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-sm">Empleado</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Plan Hasta Hoy</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Plan</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Permitidas</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Ordinarias</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Complementarias</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Extraordinarias</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Trabajadas</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Plan</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Permitidas</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Baja</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Vacaciones</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Ausencia</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Fiesta</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Hasta Hoy</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Diff Plan Hasta Hoy</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Diff Plan Mensual</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Diff Permitidas</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 shadow-sm">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((empleado) => (
            <tr key={empleado.empleadoId} className="hover:bg-gray-50">
              <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white z-10 shadow-sm">
                <div className="font-medium text-gray-900">{empleado.empleadoNombre}</div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(empleado.estadoPlanHastaHoy || 'OK')}`}>
                  {empleado.estadoPlanHastaHoy || 'OK'}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(empleado.estadoPlan || 'OK')}`}>
                  {empleado.estadoPlan || 'OK'}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(empleado.estadoPermitidas || 'OK')}`}>
                  {empleado.estadoPermitidas || 'OK'}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {formatHours(empleado.totalOrdinarias)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {formatHours(empleado.totalComplementarias)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`font-semibold ${(() => {
                  const horas = empleado.totalExtraordinarias || 0;
                  const horasNum = typeof horas === 'string' 
                    ? (horas.includes(':') ? parseFloat(horas.split(':')[0]) : parseFloat(horas))
                    : (Number(horas) || 0);
                  return horasNum > 0 ? 'text-blue-600' : 'text-gray-600';
                })()}`}>
                  {formatHours(empleado.totalExtraordinarias)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="font-semibold text-gray-900">
                  {formatHours(empleado.totalTrabajadas)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {formatHours(empleado.totalPlan)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-blue-600 font-semibold">
                  {formatHours(empleado.totalPermitidas)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {typeof empleado.diasBaja === 'number' ? empleado.diasBaja : (empleado.diasBaja || '0')}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {typeof empleado.diasVacaciones === 'number' ? empleado.diasVacaciones : (empleado.diasVacaciones || '0')}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {typeof empleado.diasAusencia === 'number' ? empleado.diasAusencia : (empleado.diasAusencia || '0')}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {typeof empleado.diasFiesta === 'number' ? empleado.diasFiesta : (empleado.diasFiesta || '0')}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className="text-gray-700">
                  {formatHours(empleado.planHastaHoy)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`font-semibold ${(() => {
                  const diff = empleado.diffPlanHastaHoy || 0;
                  const diffNum = typeof diff === 'number' ? diff : parseFloat(String(diff)) || 0;
                  return diffNum < 0 ? 'text-red-600' : (diffNum > 0 ? 'text-green-600' : 'text-gray-600');
                })()}`}>
                  {formatNumber(empleado.diffPlanHastaHoy)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`font-semibold ${(() => {
                  const diff = empleado.diffPlanMensual || 0;
                  const diffNum = typeof diff === 'number' ? diff : parseFloat(String(diff)) || 0;
                  return diffNum < 0 ? 'text-red-600' : (diffNum > 0 ? 'text-green-600' : 'text-gray-600');
                })()}`}>
                  {formatNumber(empleado.diffPlanMensual)}
                </span>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center">
                <span className={`font-semibold ${(() => {
                  const diff = empleado.diffPermitidas || 0;
                  const diffNum = typeof diff === 'number' ? diff : parseFloat(String(diff)) || 0;
                  return diffNum < 0 ? 'text-red-600' : (diffNum > 0 ? 'text-green-600' : 'text-gray-600');
                })()}`}>
                  {formatNumber(empleado.diffPermitidas)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center sticky right-0 bg-white z-10 shadow-sm">
                <button
                  onClick={() => onVerDetalle(empleado.empleadoId)}
                  className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors duration-200 cursor-pointer"
                  title="Ver detalle"
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {!loading && data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay datos disponibles
        </div>
      )}
      </div>
    </div>
  );
};

export default EmployeeMonthlyTable;
