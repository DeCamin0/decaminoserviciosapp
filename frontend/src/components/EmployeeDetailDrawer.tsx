import React, { useState } from 'react';
import { Button, Card } from './ui';
import type { DetalleEmpleado, DetalleDia } from './HorasTrabajadas';
import HorasTrabajadasPDF from './HorasTrabajadasPDF';
import { pdf } from '@react-pdf/renderer';
import DeclararNoPunchModal from './DeclararNoPunchModal';
import { success } from '../utils/logger';
import { useBreakpoint } from '../hooks/useBreakpoint';

// Component pentru item-ul de detalle diario pe mobile (Plan vs Fichado)
const MobileDetalleDiarioItem: React.FC<{
  detalleDia: DetalleDia & {
    plan?: number;
    plan_fuente?: string;
    fichado?: number;
    delta?: number;
    incompleto?: boolean | number;
    ordinarias?: number;
    excedente?: number;
  };
  parseNumeric: (val: unknown) => number | undefined;
  formatDiffValue: (val: unknown) => string;
  getDailyContractHours: (fecha: string) => number;
  onRegularizar: (fecha: string, plan: number) => void;
}> = ({ detalleDia, parseNumeric, formatDiffValue, getDailyContractHours, onRegularizar }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const fichadoValue = parseNumeric(detalleDia.fichado) ?? 0;
  const deltaValue = parseNumeric(detalleDia.delta);
  const excedenteValue = Number.isFinite(deltaValue)
    ? Number(deltaValue)
    : (parseNumeric(detalleDia.excedente) ?? 0);
  const hasFichado = fichadoValue > 0;
  const positiveExcedente = Number.isFinite(excedenteValue) ? Math.max(0, excedenteValue) : 0;
  const ordinariasValue = hasFichado
    ? parseFloat((fichadoValue - positiveExcedente).toFixed(2))
    : 0;

  const planValue = parseNumeric(detalleDia.plan);
  const planFuente = detalleDia.plan_fuente || '';
  const hasNoSchedule = planFuente === 'none' || !planFuente || (planFuente !== 'cuadrante' && planFuente !== 'horario');
  const contractFallback = hasNoSchedule ? getDailyContractHours(detalleDia.fecha) : 0;
  const finalPlan = (planValue !== undefined && planValue !== null) ? planValue : (contractFallback > 0 ? contractFallback : 0);
  const finalPlanFuente = (planValue !== undefined && planValue !== null) ? planFuente : (contractFallback > 0 ? 'contrato' : 'N/A');
  const finalDelta = fichadoValue - finalPlan;

  const formattedDate = new Date(detalleDia.fecha).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const deltaColor = finalDelta < 0 ? 'text-red-700 dark:text-red-400' : finalDelta > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-400';
  const excedenteColor = excedenteValue > 0 ? 'text-red-700 dark:text-red-400' : excedenteValue < 0 ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-400';

  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Data */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate}
        </span>
        
        {/* Plan */}
        <span className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold min-w-[40px]">
          {finalPlan.toFixed(2)}
        </span>
        
        {/* Fuente Plan - scurtat */}
        <span className="text-[10px] text-gray-600 dark:text-gray-400 min-w-[50px] truncate">
          {finalPlanFuente === 'cuadrante' ? 'Cuad.' : finalPlanFuente === 'horario' ? 'Hor.' : finalPlanFuente === 'contrato' ? 'Cont.' : finalPlanFuente}
        </span>
        
        {/* Fichado */}
        <span className="text-[11px] text-green-700 dark:text-green-400 font-semibold min-w-[40px]">
          {detalleDia.fichado !== undefined ? detalleDia.fichado : '0'}
        </span>
        
        {/* Delta - colorat */}
        <span className={`text-[11px] font-semibold min-w-[45px] ${deltaColor}`}>
          {formatDiffValue(finalDelta)}
        </span>
        
        {/* Chevron */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Plan complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Plan:</span>
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">{finalPlan.toFixed(2)}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">({finalPlanFuente})</span>
          </div>
          
          {/* Fichado complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Fichado:</span>
            <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">{detalleDia.fichado !== undefined ? detalleDia.fichado : '0'}</span>
          </div>
          
          {/* Delta */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Delta:</span>
            <span className={`text-[10px] font-semibold ${deltaColor}`}>{formatDiffValue(finalDelta)}</span>
          </div>
          
          {/* Ordinarias */}
          {Number.isFinite(ordinariasValue) && ordinariasValue > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Ordinarias:</span>
              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">{ordinariasValue.toFixed(2)}</span>
            </div>
          )}
          
          {/* Excedente */}
          {Number.isFinite(excedenteValue) && excedenteValue !== 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Excedente:</span>
              <span className={`text-[10px] font-semibold ${excedenteColor}`}>{excedenteValue.toFixed(2)}</span>
            </div>
          )}
          
          {/* Incompleto */}
          {detalleDia.incompleto && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Incompleto:</span>
              <span className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">⚠️ Sí</span>
            </div>
          )}
          
          {/* Estado / Regularizar */}
          {(() => {
            const plan = detalleDia.plan || 0;
            const fichado = detalleDia.fichado || 0;
            const tienePlan = plan > 0;
            const tieneFichado = fichado > 0;
            
            if (tienePlan && !tieneFichado) {
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegularizar(detalleDia.fecha, plan);
                  }}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  📝 Regularizar
                </button>
              );
            }
            
            const deltaNum = parseNumeric(detalleDia.delta) ?? 0;
            if (deltaNum < 0) {
              return (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">🚫 Deficit</span>
                </div>
              );
            } else if (deltaNum > 0) {
              return (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                  <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">✅ Excedente</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};

// Component pentru item-ul de registru pe mobile (compact, similar cu TimeCheck)
const MobileRegistroDetailItem: React.FC<{ 
  dia: DetalleDia; 
}> = ({ dia }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedDate = new Date(dia.fecha).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const isEntrada = dia.tipo === 'Entrada';
  
  return (
    <div className="relative">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        {/* Indicator mic (verde/roșu) */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isEntrada ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        
        {/* Data - text mic */}
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium min-w-[65px]">
          {formattedDate}
        </span>
        
        {/* Timp - text mic */}
        <span className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold min-w-[50px]">
          {isEntrada ? dia.entrada : dia.salida}
        </span>
        
        {/* Tipo - text mic, scurtat */}
        <span className={`text-[11px] font-semibold flex-1 ${
          isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
        }`}>
          {isEntrada ? 'E' : 'S'}
        </span>
        
        {/* Duration - text foarte mic */}
        {dia.duracion && dia.duracion !== '--:--' && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 min-w-[45px]">
            {dia.duracion}
          </span>
        )}
        
        {/* Chevron pentru expand */}
        <span className={`text-gray-400 text-[10px] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* Detalii expandate */}
      {isExpanded && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
          {/* Tipo complet */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
            <span className={`text-[10px] font-semibold ${
              isEntrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {dia.tipo}
            </span>
          </div>
          
          {/* Hora completă */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Hora:</span>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              {isEntrada ? dia.entrada : dia.salida}
            </span>
          </div>
          
          {/* Duración */}
          {dia.duracion && dia.duracion !== '--:--' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">⏱ Duración:</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{dia.duracion}</span>
            </div>
          )}
          
          {/* Dirección */}
          {dia.direccion && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">📍 Dirección</div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">
                {dia.direccion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type TitleProps = {
  level?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  [key: string]: unknown;
};

type TextProps = {
  children?: React.ReactNode;
  type?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
};

// Componente simple pentru UI
const Title = ({ level, children, style, ...props }: TitleProps) => {
  const Tag = level === 2 ? 'h2' : level === 3 ? 'h3' : level === 4 ? 'h4' : level === 5 ? 'h5' : 'h6';
  return React.createElement(Tag, { style, ...props }, children);
};

const Text = ({ children, type, style, ...props }: TextProps) => {
  const className = type === 'secondary' ? 'text-gray-500' : '';
  return <span className={className} style={style} {...props}>{children}</span>;
};

export type EmployeeDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  detalle: DetalleEmpleado | null;
  onDescargarPDF: (empleadoId: number, mes: string) => void;
  loading?: boolean;
  tipoReporte?: 'mensual' | 'anual';
  isMobile?: boolean;
};

const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({
  open,
  onClose,
  detalle,
  onDescargarPDF,
  loading = false,
  tipoReporte = 'mensual',
  isMobile: isMobileProp = false
}) => {
  const { isMobile: isMobileBreakpoint } = useBreakpoint();
  const isMobile = isMobileProp || isMobileBreakpoint;
  const [activeTab, setActiveTab] = React.useState<'registros' | 'detalles'>('registros');
  const isAnual = tipoReporte === 'anual';
  
  // State pentru modaluri de regularizare
  const [showDeclararNoPunchModal, setShowDeclararNoPunchModal] = useState(false);
  const [selectedDayForRegularization, setSelectedDayForRegularization] = useState<{
    fecha: string;
    plan?: number;
  } | null>(null);

  const formatHoursValue = React.useCallback((value: string | number | null | undefined, decimals = 2) => {
    if (value === undefined || value === null || value === '') return 'N/A';
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      if (isNaN(value)) {
        return 'N/A';
      }
      return value.toFixed(decimals);
    }
    return 'N/A';
  }, []);

  const formatDiffValue = React.useCallback((value: string | number | null | undefined) => {
    if (value === undefined || value === null) return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }, []);

  const parseNumeric = React.useCallback((value: unknown) => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(num) ? num : undefined;
  }, []);

  const parseHoursToDecimal = React.useCallback((value: string | number | null | undefined): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      if (value.includes(':')) {
        const parts = value.split(':').map(p => parseFloat(p));
        if (parts.length === 3 && parts.every(num => Number.isFinite(num))) {
          const [hh, mm, ss] = parts;
          return hh + mm / 60 + ss / 3600;
        }
        if (parts.length === 2 && parts.every(num => Number.isFinite(num))) {
          const [hh, mm] = parts;
          return hh + mm / 60;
        }
      }
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  // Helper pentru a calcula orele zilnice din contract ca fallback
  const getDailyContractHours = React.useCallback((fecha: string): number => {
    if (!detalle) return 0;
    
    // Prioritate 1: folosește horasContratoSemanal dacă există (ore săptămânale / 5 zile lucrătoare)
    if (detalle.horasContratoSemanal && detalle.horasContratoSemanal > 0) {
      return Number((detalle.horasContratoSemanal / 5).toFixed(2));
    }
    
    // Prioritate 2: folosește horasContrato (ore săptămânale din detaliile angajatului) / 5 zile lucrătoare
    const horasContrato = parseHoursToDecimal(detalle.horasContrato);
    if (horasContrato > 0) {
      return Number((horasContrato / 5).toFixed(2));
    }
    
    // Prioritate 3: folosește horasContratoMes împărțit la zile lucrătoare din lună
    const horasContratoMes = parseHoursToDecimal(detalle.horasContratoMes);
    if (horasContratoMes > 0) {
      try {
        const fechaDate = new Date(fecha);
        const year = fechaDate.getFullYear();
        const month = fechaDate.getMonth();
        
        // Calculează zile lucrătoare din lună (excludem duminicile)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let workingDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          if (date.getDay() !== 0) { // Nu e duminică
            workingDays++;
          }
        }
        return workingDays > 0 ? Number((horasContratoMes / workingDays).toFixed(2)) : 0;
      } catch {
        return 0;
      }
    }
    
    return 0;
  }, [detalle, parseHoursToDecimal]);

  const formatDecimalHours = React.useCallback((hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) {
      return '00:00:00';
    }
    const totalSeconds = Math.max(0, Math.round(hours * 3600));
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }, []);

  const detaliiTotals = React.useMemo(() => {
    const lista = detalle?.detaliiZilnice;
    if (!Array.isArray(lista) || lista.length === 0) {
      return undefined;
    }

    let plan = 0;
    let fichado = 0;
    let delta = 0;
    let ordinarias = 0;
    let excedente = 0;
    let incompletos = 0;

    lista.forEach((detalleDia) => {
      const planVal = parseNumeric(detalleDia?.plan);
      if (Number.isFinite(planVal)) {
        plan += Number(planVal);
      }

      const fichadoValue = parseNumeric(detalleDia?.fichado) ?? 0;
      if (Number.isFinite(fichadoValue)) {
        fichado += Number(fichadoValue);
      }

      const deltaValue = parseNumeric(detalleDia?.delta);
      if (Number.isFinite(deltaValue)) {
        delta += Number(deltaValue);
      }

      const excedenteValue = Number.isFinite(deltaValue)
        ? Number(deltaValue)
        : (parseNumeric(detalleDia?.excedente) ?? 0);
      if (Number.isFinite(excedenteValue)) {
        excedente += Number(excedenteValue);
      }

      const hasFichado = Number.isFinite(fichadoValue) && Number(fichadoValue) > 0;
      const positiveExcedente = Number.isFinite(excedenteValue) ? Math.max(0, Number(excedenteValue)) : 0;
      const ordinariasValue = hasFichado
        ? Number.parseFloat((Number(fichadoValue) - positiveExcedente).toFixed(2))
        : 0;
      if (Number.isFinite(ordinariasValue)) {
        ordinarias += ordinariasValue;
      }

      if (detalleDia?.incompleto) {
        incompletos += 1;
      }
    });

    return {
      plan,
      fichado,
      delta,
      ordinarias,
      excedente,
      incompletos
    };
  }, [detalle, parseNumeric]);

  const diasAlerta = React.useMemo(() => {
    const detalles = detalle?.detaliiZilnice;
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return { total: 0, positivos: 0, negativos: 0 };
    }

    let positivos = 0;
    let negativos = 0;

    detalles.forEach((dia) => {
      const deltaValue = parseNumeric(dia?.delta);
      const excedenteValue = Number.isFinite(deltaValue)
        ? Number(deltaValue)
        : (parseNumeric(dia?.excedente) ?? 0);

      if (Number.isFinite(excedenteValue) && excedenteValue !== 0) {
        if (excedenteValue > 0) {
          positivos += 1;
        } else {
          negativos += 1;
        }
      }
    });

    return {
      total: positivos + negativos,
      positivos,
      negativos
    };
  }, [detalle, parseNumeric]);

  const infoLabel = React.useCallback(
    (anual: string, mensual: string) => (isAnual ? anual : mensual),
    [isAnual]
  );

  const resumenMensualData = React.useMemo(() => {
    if (!detalle?.resumenMensual) return undefined;
    return Array.isArray(detalle.resumenMensual) ? detalle.resumenMensual : undefined;
  }, [detalle]);

  const formatMonthLabel = React.useCallback((ym: string) => {
    if (!ym) return ym;
    try {
      return new Date(`${ym}-01`).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return ym;
    }
  }, []);

  React.useEffect(() => {
    if (detalle && isAnual) {
      console.log('📆 Drawer anual meses info:', {
        mesesConCuadrante: detalle.mesesConCuadrante,
        mesesConHorario: detalle.mesesConHorario,
        mesesMixtos: detalle.mesesMixtos
      });
    }
  }, [detalle, isAnual]);

  const periodoTexto = React.useMemo(() => {
    if (!detalle?.mes) return '';
    if (isAnual) {
      const year = detalle.mes.split('-')[0] || detalle.mes;
      return `Año ${year}`;
    }
    try {
      return new Date(`${detalle.mes}-01`).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return detalle.mes;
    }
  }, [detalle.mes, isAnual]);

  // Reset tab când se deschide drawer-ul
  React.useEffect(() => {
    if (open) {
      setActiveTab('registros');
    }
  }, [open]);

  const handleDescargarPDF = async () => {
    if (detalle) {
      try {
        console.log('📄 Generando PDF para empleado:', detalle.empleadoId, 'Tab:', activeTab);
        
        // Generează PDF-ul folosind componenta HorasTrabajadasPDF cu tab-ul activ
        const blob = await pdf(<HorasTrabajadasPDF detalle={detalle} tipoReporte={tipoReporte} tabActivo={activeTab} />).toBlob();
        
        // Creează link-ul de descărcare
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const nombreArchivo = activeTab === 'detalles' 
          ? `Detalle_Horas_Detalles_${detalle.empleadoNombre.replace(/\s+/g, '_')}_${detalle.mes}.pdf`
          : `Detalle_Horas_Registros_${detalle.empleadoNombre.replace(/\s+/g, '_')}_${detalle.mes}.pdf`;
        link.download = nombreArchivo;
        
        // Descarcă fișierul
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Eliberează URL-ul
        URL.revokeObjectURL(url);
        
        console.log('✅ PDF generado y descargado exitosamente');
      } catch (error) {
        console.error('❌ Error generando PDF:', error);
        // Fallback la funcția original
        onDescargarPDF(detalle.empleadoId, detalle.mes);
      }
    }
  };

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] overflow-y-auto shadow-2xl rounded-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <Title level={3} style={{ margin: 0, marginBottom: '8px', color: '#1e40af' }}>
                📊 Detalle de Horas - {detalle ? detalle.empleadoNombre : 'Cargando...'}
              </Title>
              {detalle && (
                <div className="flex items-center gap-4">
                  <Text type="secondary" style={{ fontSize: '16px', fontWeight: 500 }}>
                    📅 Período: {periodoTexto || detalle.mes}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    🆔 ID: {detalle.empleadoId}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Días con alerta:
                    <span style={{ color: '#111', fontWeight: 600 }}>{diasAlerta.total}</span>
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>+{diasAlerta.positivos}</span>
                    <span style={{ color: '#ca8a04', fontWeight: 600 }}>-{diasAlerta.negativos}</span>
                  </Text>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-2xl bg-gray-100 hover:bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        {detalle && (
          <div className="border-b border-gray-200 px-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('registros')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'registros'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Registros
              </button>
              <button
                onClick={() => setActiveTab('detalles')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'detalles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Detalles
              </button>
            </nav>
          </div>
        )}
        
        {/* Content */}
        <div className="p-8">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <div className="mt-4 text-gray-600">
                Cargando detalles...
              </div>
            </div>
          ) : detalle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {activeTab === 'registros' && (
            <>
          {/* Resumen */}
          <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
            <Title level={5} style={{ 
              margin: 0, 
              marginBottom: '16px', 
              fontWeight: 600, 
              fontSize: '0.9rem', 
              color: '#555' 
            }}>
              {isAnual ? 'Resumen Anual' : 'Resumen Mensual'}
            </Title>
            
            {/* Calcul total interval din suma duracion incl. secunde */}
            {detalle && (() => {
              const toSeconds = (s: string) => {
                if (!s || s === '--:--') return 0;
                const parts = s.split(':');
                if (parts.length === 3) {
                  const [hh, mm, ss] = parts.map(Number);
                  return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
                } else if (parts.length === 2) {
                  const [hh, mm] = parts.map(Number);
                  return (hh || 0) * 3600 + (mm || 0) * 60;
                }
                return 0;
              };

              const totalSec = (detalle.dias || []).reduce((acc, d) => acc + toSeconds(d.duracion || '0:00:00'), 0);
              const totalHH = Math.floor(totalSec / 3600);
              const rem = totalSec % 3600;
              const totalMM = Math.floor(rem / 60);
              const totalSS = rem % 60;
              const totalFormato = `${String(totalHH).padStart(2,'0')}:${String(totalMM).padStart(2,'0')}:${String(totalSS).padStart(2,'0')}`;
              const label = isAnual ? 'Total duración del año' : 'Total duración del mes';

              return (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-700 font-semibold">{label}:</span>
                  <span className="ml-2 font-mono text-blue-900 text-base">{totalHH}h</span>
                  <span className="ml-3 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-mono align-middle">
                    {totalFormato}
                  </span>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {isAnual ? 'Horas trabajadas acumuladas' : 'Horas trabajadas'}
                </Text>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#1890ff' }}>
                  {formatHoursValue(isAnual ? (detalle.totalTrabajadasAnual ?? detalle.totalTrabajadas ?? detalle.horasTrabajadas) : detalle.horasTrabajadas)}
                </div>
              </div>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Horas extra</Text>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  color: (() => {
                    const rawExtra: string | number | undefined = isAnual
                      ? (detalle.totalExtraordinarias ?? detalle.horasExtra)
                      : detalle.horasExtra;
                    const isPos = (typeof rawExtra === 'string')
                      ? (rawExtra !== '0:00:00')
                      : ((Number(rawExtra) || 0) > 0);
                    return isPos ? '#52c41a' : '#666';
                  })()
                }}>
                  {(() => {
                    const rawExtra: string | number | undefined = isAnual
                      ? (detalle.totalExtraordinarias ?? detalle.horasExtra)
                      : detalle.horasExtra;
                    if (typeof rawExtra === 'string') {
                      return rawExtra.startsWith('-') ? '0:00:00' : rawExtra;
                    }
                    const num = Number(rawExtra) || 0;
                    return num < 0 ? '0:00:00' : String(num);
                  })()}
                </div>
              </div>
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {isAnual ? 'Media semanal anual' : 'Media semanal'}
                </Text>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#722ed1' }}>
                  {(() => {
                    const mediaBackend = isAnual
                      ? (detalle as DetalleEmpleado & { mediaSemanalAnual?: string | number; mediaSemanal?: string | number }).mediaSemanalAnual ?? 
                        (detalle as DetalleEmpleado & { mediaSemanalAnual?: string | number; mediaSemanal?: string | number }).mediaSemanal
                      : (detalle as DetalleEmpleado & { mediaSemanalAnual?: string | number; mediaSemanal?: string | number }).mediaSemanal ?? 
                        (detalle as DetalleEmpleado & { mediaSemanalAnual?: string | number; mediaSemanal?: string | number }).mediaSemanalAnual;

                    if (typeof mediaBackend === 'string' && mediaBackend.includes(':')) {
                      return `${mediaBackend}/semana`;
                    }

                    const mediaBackendDecimal = parseHoursToDecimal(mediaBackend);
                    if (mediaBackendDecimal > 0) {
                      return `${formatDecimalHours(mediaBackendDecimal)}/semana`;
                    }

                    type DetalleExtended = DetalleEmpleado & {
                      horasTrabajadasAnual?: string | number;
                      totalTrabajadasAnual?: string | number;
                      totalTrabajadas?: string | number;
                      horasTrabajadas?: string | number;
                      horasTrabajadasMes?: string | number;
                    };
                    const detalleExt = detalle as DetalleExtended;
                    const horasBase = isAnual
                      ? parseHoursToDecimal(
                          detalleExt.horasTrabajadasAnual ??
                          detalleExt.totalTrabajadasAnual ??
                          detalleExt.totalTrabajadas ??
                          detalleExt.horasTrabajadas ??
                          detalleExt.horasTrabajadasMes
                        )
                      : parseHoursToDecimal(
                          detalleExt.horasTrabajadasMes ??
                          detalleExt.horasTrabajadas ??
                          detalleExt.totalTrabajadas ??
                          detalleExt.totalTrabajadasAnual ??
                          detalleExt.horasTrabajadasAnual
                        );

                    if (!horasBase || horasBase <= 0) {
                      return '00:00:00/semana';
                    }

                    const diasFuente = (() => {
                      if (Array.isArray(detalle.detaliiZilnice) && detalle.detaliiZilnice.length > 0) {
                        const dias = new Set(detalle.detaliiZilnice.map((d) => d?.fecha).filter(Boolean));
                        return dias.size;
                      }
                      if (Array.isArray(detalle.dias) && detalle.dias.length > 0) {
                        const dias = new Set(detalle.dias.map((d) => d?.fecha).filter(Boolean));
                        return dias.size;
                      }

                      const mesSeleccionado = detalle.mes;
                      if (!mesSeleccionado) return 0;

                      const partes = mesSeleccionado.split('-');
                      const year = parseInt(partes[0], 10);
                      if (!Number.isFinite(year)) return 0;

                      if (isAnual) {
                        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
                        return isLeap ? 366 : 365;
                      }

                      if (partes.length > 1) {
                        const month = parseInt(partes[1], 10);
                        if (Number.isFinite(month)) {
                          return new Date(year, month, 0).getDate();
                        }
                      }

                      return 0;
                    })();

                    const semanas = diasFuente > 0 ? Math.max(diasFuente / 7, 1) : (isAnual ? 52 : 4.348);
                    const horasSemana = horasBase / semanas;
                    return `${formatDecimalHours(horasSemana)}/semana`;
                  })()}
                </div>
              </div>
            </div>
          </Card>

          {/* Detalle diario */}
          <div>
            <Title level={5} style={{ 
              margin: 0, 
              marginBottom: isMobile ? '12px' : '16px', 
              fontWeight: 600, 
              fontSize: isMobile ? '0.8rem' : '0.9rem', 
              color: '#555' 
            }}>
              Detalle diario
            </Title>
            
            {isMobile ? (
              // Mobile: Listă verticală compactă (similar cu celelalte liste)
              <div className="space-y-1.5">
                {detalle.dias.map((dia, index) => (
                  <MobileRegistroDetailItem
                    key={`${dia.fecha}-${index}`}
                    dia={dia}
                  />
                ))}
              </div>
            ) : (
              // Desktop: Tabela orizontală originală
              <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white">📅 Fecha</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">🕐 Hora</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">🏷️ Tipo</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">⏱️ Duración</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white">📍 Dirección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {console.log('🔍 EmployeeDetailDrawer - Dias count:', detalle.dias.length, detalle.dias)}
                    {detalle.dias.map((dia, index) => (
                      <tr key={`${dia.fecha}-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(dia.fecha).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg border">
                            {dia.tipo === 'Entrada' ? dia.entrada : dia.salida}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                            dia.tipo === 'Entrada' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {dia.tipo === 'Entrada' ? '✅ Entrada' : '❌ Salida'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="font-mono text-sm bg-blue-100 px-3 py-1 rounded-lg border border-blue-200">
                            {dia.duracion || '--:--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md" title={dia.direccion}>
                          <div className="truncate">
                            {dia.direccion}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

            {/* Botón descargar PDF */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button
                variant="primary"
                onClick={handleDescargarPDF}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200"
                size="lg"
              >
                📄 Descargar PDF oficial
              </Button>
            </div>
            </>
          )}
          
          {activeTab === 'detalles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Información del Empleado */}
              <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
                <Title level={5} style={{ 
                  margin: 0, 
                  marginBottom: '16px', 
                  fontWeight: 600, 
                  fontSize: '0.9rem', 
                  color: '#555' 
                }}>
                  Información del Empleado
                </Title>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Grupo</Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      {detalle.grupo || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Centro de Trabajo</Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      {detalle.centroTrabajo || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Tipo de Contrato</Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      {detalle.tipoContrato || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Fuente</Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      {detalle.fuente || detalle.fuenteAnual || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Centro Cuadrante</Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      {detalle.centroCuadrante || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {infoLabel('Horas Trabajadas Año', 'Horas Trabajadas Mes')}
                    </Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#1890ff' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalTrabajadasAnual ?? detalle.totalTrabajadas ?? detalle.horasTrabajadasAnual ?? detalle.horasTrabajadas)
                          : (detalle.horasTrabajadasMes ?? detalle.horasTrabajadas)
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {infoLabel('Horas Permitidas Año', 'Horas Mensuales Permitidas')}
                    </Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#52c41a' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalPermitidasAnual ?? detalle.horasAnualesPermitidas ?? detalle.totalPermitidas)
                          : detalle.horasMensualesPermitidas
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {infoLabel('Horas Cuadrante Año', 'Horas Cuadrante Mes')}
                    </Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.horasCuadranteAnual ?? detalle.horasCuadranteMes)
                          : detalle.horasCuadranteMes
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {infoLabel('Horas Horario Año', 'Horas Horario Mes')}
                    </Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.horasHorarioAnual ?? detalle.horasHorarioMes)
                          : detalle.horasHorarioMes
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {infoLabel('Horas Planificadas Año', 'Horas Mes')}
                    </Text>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalPlanAnual ?? detalle.horasMes ?? detalle.totalPlan)
                          : detalle.horasMes
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Diff vs Contrato</Text>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 600, 
                      color: (() => {
                        const valor = isAnual
                          ? (detalle.diffPlanAnual ?? detalle.difVsContrato ?? detalle.diffPlanMensual ?? 0)
                          : (detalle.difVsContrato ?? 0);
                        return valor < 0 ? '#ff4d4f' : (valor > 0 ? '#52c41a' : '#666');
                      })()
                    }}>
                      {formatDiffValue(
                        isAnual
                          ? (detalle.diffPlanAnual ?? detalle.difVsContrato ?? detalle.diffPlanMensual)
                          : detalle.difVsContrato
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Diff vs Permitidas</Text>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 600, 
                      color: (() => {
                        const valor = isAnual
                          ? (detalle.diffPermitidasAnual ?? detalle.difVsPermitidas ?? detalle.diffPermitidas ?? 0)
                          : (detalle.difVsPermitidas ?? detalle.diffPermitidas ?? 0);
                        return valor < 0 ? '#ff4d4f' : (valor > 0 ? '#52c41a' : '#666');
                      })()
                    }}>
                      {formatDiffValue(
                        isAnual
                          ? (detalle.diffPermitidasAnual ?? detalle.difVsPermitidas ?? detalle.diffPermitidas)
                          : (detalle.difVsPermitidas ?? detalle.diffPermitidas)
                      )}
                    </div>
                  </div>

                  {isAnual && (
                    <>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Meses con Cuadrante</Text>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                          {detalle.mesesConCuadrante ?? 'N/A'}
                        </div>
                      </div>

                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Meses con Horario</Text>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                          {detalle.mesesConHorario ?? 'N/A'}
                        </div>
                      </div>

                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Meses Mixtos</Text>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>
                          {detalle.mesesMixtos ?? 'N/A'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>

            {isAnual && resumenMensualData && resumenMensualData.length > 0 && (
              <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
                <Title
                  level={5}
                  style={{
                    margin: 0,
                    marginBottom: '16px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#555'
                  }}
                >
                  Resumen Mensual
                </Title>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Mes</th>
                        <th className="px-4 py-3 text-center font-semibold">Horas plan</th>
                        <th className="px-4 py-3 text-center font-semibold">Horas cuadrante</th>
                        <th className="px-4 py-3 text-center font-semibold">Horas horario</th>
                        <th className="px-4 py-3 text-center font-semibold">Fuente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {resumenMensualData.map((item, index: number) => (
                        <tr key={`${item.ym}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-left font-medium text-gray-800">
                            {formatMonthLabel(item.ym)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-gray-700">
                            {formatHoursValue(item.horas_plan_mes)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-gray-700">
                            {formatHoursValue(item.horas_cuadrante_mes)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-gray-700">
                            {formatHoursValue(item.horas_horario_mes)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                              {item.fuente_mes || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

              {/* Resumen de Horas */}
              <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
                <Title level={5} className={`${isMobile ? 'text-sm mb-3' : 'mb-4'}`} style={{ 
                  margin: 0, 
                  fontWeight: 600, 
                  color: '#555' 
                }}>
                  Resumen de Horas
                </Title>
                
                <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-4 gap-4'}`}>
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Est. Plan Hoy' : 'Estado Plan Hasta Hoy'}
                    </Text>
                    {(() => {
                      const estado = isAnual
                        ? (detalle.estadoPlanHastaHoyAnual ?? detalle.estadoPlanHastaHoy)
                        : detalle.estadoPlanHastaHoy;
                      return (
                        <div className={`inline-flex ${isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-xs'} font-semibold rounded-full ${
                          estado === 'OK' ? 'bg-green-100 text-green-800' :
                          estado === 'ALERTA' ? 'bg-yellow-100 text-yellow-800' :
                          estado === 'RIESGO' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {estado || 'OK'}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Est. Plan' : 'Estado Plan'}
                    </Text>
                    {(() => {
                      const estado = isAnual
                        ? (detalle.estadoPlanAnual ?? detalle.estadoPlan)
                        : detalle.estadoPlan;
                      return (
                        <div className={`inline-flex ${isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-xs'} font-semibold rounded-full ${
                          estado === 'OK' ? 'bg-green-100 text-green-800' :
                          estado === 'ALERTA' ? 'bg-yellow-100 text-yellow-800' :
                          estado === 'RIESGO' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {estado || 'OK'}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Est. Permit.' : 'Estado Permitidas'}
                    </Text>
                    {(() => {
                      const estado = isAnual
                        ? (detalle.estadoPermitidasAnual ?? detalle.estadoPermitidas)
                        : detalle.estadoPermitidas;
                      return (
                        <div className={`inline-flex ${isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-xs'} font-semibold rounded-full ${
                          estado === 'OK' ? 'bg-green-100 text-green-800' :
                          estado === 'ALERTA' ? 'bg-yellow-100 text-yellow-800' :
                          estado === 'RIESGO' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {estado || 'OK'}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? (isAnual ? 'Trab. Anual' : 'Total Trab.') : (isAnual ? 'Total Trabajadas Anuales' : 'Total Trabajadas')}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#1890ff' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalTrabajadasAnual ?? detalle.totalTrabajadas ?? detalle.horasTrabajadas)
                          : (detalle.totalTrabajadas ?? detalle.horasTrabajadas)
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? (isAnual ? 'Plan Anual' : 'Total Plan') : (isAnual ? 'Total Plan Anual' : 'Total Plan')}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#666' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalPlanAnual ?? detalle.totalContratoAnual ?? detalle.horasContratoAnual ?? detalle.totalPlan ?? detalle.horasContrato)
                          : (detalle.totalPlan ?? 0)
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? (isAnual ? 'Perm. Anual' : 'Total Perm.') : (isAnual ? 'Total Permitidas Anuales' : 'Total Permitidas')}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#52c41a' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.totalPermitidasAnual ?? detalle.totalPermitidas ?? detalle.horasAnualesPermitidas)
                          : (detalle.totalPermitidas ?? 0)
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? (isAnual ? 'Plan Acum.' : 'Plan Hoy') : (isAnual ? 'Plan Acumulado' : 'Plan Hasta Hoy')}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#666' }}>
                      {formatHoursValue(
                        isAnual
                          ? (detalle.planHastaHoyAnual ?? detalle.totalPlanAnual ?? detalle.totalContratoAnual ?? detalle.horasContratoAnual ?? detalle.planHastaHoy ?? detalle.horasContrato)
                          : (detalle.planHastaHoy ?? 0)
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Ord.' : 'Total Ordinarias'}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#666' }}>
                      {isAnual
                        ? (detalle.totalOrdinariasAnual ?? detalle.totalOrdinarias ?? 0)
                        : (detalle.totalOrdinarias ?? 0)}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Comp.' : 'Total Complementarias'}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#666' }}>
                      {isAnual
                        ? (detalle.totalComplementariasAnual ?? detalle.totalComplementarias ?? 0)
                        : (detalle.totalComplementarias ?? 0)}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Extra.' : 'Total Extraordinarias'}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color: '#1890ff' }}>
                      {isAnual
                        ? (detalle.totalExtraordinariasAnual ?? detalle.totalExtraordinarias ?? 0)
                        : (detalle.totalExtraordinarias ?? 0)}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Diff Plan Hoy' : 'Diff Plan Hasta Hoy'}
                    </Text>
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ 
                      color: (() => {
                        const valor = isAnual
                          ? (detalle.diffPlanHastaHoyAnual ?? detalle.diffPlanHastaHoy ?? 0)
                          : (detalle.diffPlanHastaHoy ?? 0);
                        return valor < 0 ? '#ff4d4f' : (valor > 0 ? '#52c41a' : '#666');
                      })()
                    }}>
                      {formatDiffValue(isAnual ? (detalle.diffPlanHastaHoyAnual ?? detalle.diffPlanHastaHoy) : detalle.diffPlanHastaHoy)}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? (isAnual ? 'Diff Plan A' : 'Diff Plan M') : (isAnual ? 'Diff Plan Anual' : 'Diff Plan Mensual')}
                    </Text>
                    {(() => {
                      const diffPlanValue = isAnual
                        ? (detalle.diffPlanAnual ?? detalle.difVsContrato ?? detalle.diffPlanMensual ?? 0)
                        : (detalle.diffPlanMensual ?? 0);
                      const color = diffPlanValue < 0 ? '#ff4d4f' : (diffPlanValue > 0 ? '#52c41a' : '#666');
                      return (
                    <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color }}>
                      {formatDiffValue(isAnual ? (detalle.diffPlanAnual ?? detalle.difVsContrato ?? detalle.diffPlanMensual) : detalle.diffPlanMensual)}
                    </div>
                    );
                    })()}
                  </div>
                  
                  <div>
                    <Text type="secondary" className={isMobile ? 'text-[10px]' : 'text-xs'}>
                      {isMobile ? 'Diff Perm.' : 'Diff Permitidas'}
                    </Text>
                    {(() => {
                      const diffPermValue = isAnual
                        ? (detalle.diffPermitidasAnual ?? detalle.difVsPermitidas ?? detalle.diffPermitidas ?? 0)
                        : (detalle.diffPermitidas ?? 0);
                      const color = diffPermValue < 0 ? '#ff4d4f' : (diffPermValue > 0 ? '#52c41a' : '#666');
                      return (
                      <div className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold`} style={{ color }}>
                        {formatDiffValue(isAnual ? (detalle.diffPermitidasAnual ?? detalle.difVsPermitidas ?? detalle.diffPermitidas) : detalle.diffPermitidas)}
                      </div>
                      );
                    })()}
                  </div>
                </div>
              </Card>

              {/* Detalle Diario (detalii_zilnice) */}
              {detalle.detaliiZilnice && detalle.detaliiZilnice.length > 0 && (
                <div>
                  <Title level={5} className={`${isMobile ? 'text-sm mb-3' : 'mb-4'}`} style={{ 
                    margin: 0, 
                    fontWeight: 600, 
                    color: '#555' 
                  }}>
                    Detalle Diario (Plan vs Fichado)
                  </Title>
                  
                  {isMobile ? (
                    // Mobile: Listă verticală compactă
                    <div className="space-y-1.5">
                      {detalle.detaliiZilnice.map((detalleDia, index) => (
                        <MobileDetalleDiarioItem
                          key={`${detalleDia.fecha}-${index}`}
                          detalleDia={detalleDia}
                          index={index}
                          parseNumeric={parseNumeric}
                          formatDiffValue={formatDiffValue}
                          getDailyContractHours={getDailyContractHours}
                          onRegularizar={(fecha, plan) => {
                            setSelectedDayForRegularization({ fecha, plan });
                            setShowDeclararNoPunchModal(true);
                          }}
                        />
                      ))}
                      {/* Totaluri pe mobile */}
                      {detaliiTotals && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="text-[11px] font-semibold text-purple-900 dark:text-purple-300 mb-2">Totales</div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                              <span className="ml-1 font-semibold text-blue-700 dark:text-blue-400">{detaliiTotals.plan.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Fichado:</span>
                              <span className="ml-1 font-semibold text-green-700 dark:text-green-400">{detaliiTotals.fichado.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Delta:</span>
                              <span className={`ml-1 font-semibold ${
                                detaliiTotals.delta < 0 ? 'text-red-600 dark:text-red-400' :
                                detaliiTotals.delta > 0 ? 'text-green-600 dark:text-green-400' :
                                'text-gray-600 dark:text-gray-400'
                              }`}>
                                {detaliiTotals.delta.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Ordinarias:</span>
                              <span className="ml-1 font-semibold text-purple-700 dark:text-purple-400">{detaliiTotals.ordinarias.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Desktop: Tabela orizontală
                    <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
                      <table className="min-w-full bg-white">
                      <thead className="bg-gradient-to-r from-purple-600 to-indigo-600">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white">📅 Fecha</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">📋 Plan</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">📍 Fuente Plan</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">⏱️ Fichado</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">📊 Delta</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">⚠️ Incompleto</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">⏰ Ordinarias</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">➕ Excedente</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-white">🚫 Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {detalle.detaliiZilnice.map((detalleDia, index) => {
                          const fichadoValue = parseNumeric(detalleDia.fichado) ?? 0;
                          const deltaValue = parseNumeric(detalleDia.delta);
                          const excedenteValue = Number.isFinite(deltaValue)
                            ? Number(deltaValue)
                            : (parseNumeric(detalleDia.excedente) ?? 0);
                          const hasFichado = fichadoValue > 0;
                          const positiveExcedente = Number.isFinite(excedenteValue) ? Math.max(0, excedenteValue) : 0;
                          const ordinariasValue = hasFichado
                            ? parseFloat((fichadoValue - positiveExcedente).toFixed(2))
                            : 0;

                          // Fallback la orele din contract DOAR dacă nu există nici cuadrante nici horario
                          const planValue = parseNumeric(detalleDia.plan);
                          const planFuente = detalleDia.plan_fuente || '';
                          // Verifică dacă nu există orar/cuadrante (plan_fuente este 'none' sau nu există)
                          // IMPORTANT: Nu verificăm planValue === 0 pentru că poate fi o zi liberă în orar/cuadrante
                          const hasNoSchedule = planFuente === 'none' || !planFuente || (planFuente !== 'cuadrante' && planFuente !== 'horario');
                          const contractFallback = hasNoSchedule ? getDailyContractHours(detalleDia.fecha) : 0;
                          // Folosim planValue dacă există (chiar dacă este 0), altfel fallback la contract
                          const finalPlan = (planValue !== undefined && planValue !== null) ? planValue : (contractFallback > 0 ? contractFallback : 0);
                          const finalPlanFuente = (planValue !== undefined && planValue !== null) ? planFuente : (contractFallback > 0 ? 'contrato' : 'N/A');
                          
                          // Recalculează delta cu plan-ul final (cu fallback)
                          const finalDelta = fichadoValue - finalPlan;

                          return (
                          <tr key={`${detalleDia.fecha}-${index}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {new Date(detalleDia.fecha).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="font-mono text-sm bg-blue-100 px-3 py-1 rounded-lg border border-blue-200">
                                {finalPlan.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {finalPlanFuente}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="font-mono text-sm bg-green-100 px-3 py-1 rounded-lg border border-green-200">
                                {detalleDia.fichado !== undefined ? detalleDia.fichado : '0'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`font-mono text-sm px-3 py-1 rounded-lg border ${
                                finalDelta < 0 
                                  ? 'bg-red-100 border-red-200 text-red-800' 
                                  : finalDelta > 0 
                                    ? 'bg-green-100 border-green-200 text-green-800'
                                    : 'bg-gray-100 border-gray-200 text-gray-800'
                              }`}>
                                {formatDiffValue(finalDelta)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {detalleDia.incompleto ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                  ⚠️ Sí
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="font-mono text-sm bg-purple-100 px-3 py-1 rounded-lg border border-purple-200">
                                {Number.isFinite(ordinariasValue) ? ordinariasValue.toFixed(2) : (detalleDia.ordinarias ?? '0')}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`font-mono text-sm px-3 py-1 rounded-lg border ${
                                excedenteValue > 0 
                                  ? 'bg-red-100 border-red-200 text-red-800' 
                                  : excedenteValue < 0
                                    ? 'bg-yellow-100 border-yellow-200 text-yellow-800'
                                    : 'bg-gray-100 border-gray-200 text-gray-800'
                              }`}>
                                {Number.isFinite(excedenteValue) ? excedenteValue.toFixed(2) : (parseNumeric(detalleDia.excedente)?.toFixed(2) ?? '0.00')}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {(() => {
                                const plan = detalleDia.plan || 0;
                                const fichado = detalleDia.fichado || 0;
                                const tienePlan = plan > 0;
                                const tieneFichado = fichado > 0;
                                
                                // Dacă există plan dar nu există fichado, afișează "Sin fichar" cu buton de regularizare
                                if (tienePlan && !tieneFichado) {
                                  return (
                                    <div className="flex flex-col items-center gap-2">
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
                                        🚫 Sin fichar
                                      </span>
                                      <button
                                        onClick={() => {
                                          setSelectedDayForRegularization({
                                            fecha: detalleDia.fecha,
                                            plan: plan,
                                          });
                                          setShowDeclararNoPunchModal(true);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                        title="Regularizar esta fecha"
                                      >
                                        📝 Regularizar
                                      </button>
                                    </div>
                                  );
                                }
                                
                                // Calculează delta pentru a determina estado
                                const deltaNum = parseNumeric(detalleDia.delta) ?? 0;
                                
                                if (deltaNum < 0) {
                                  // Excedente negativos (deficit)
                                  return (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
                                      ⚠️ Excedente Negativos
                                    </span>
                                  );
                                } else if (deltaNum > 0) {
                                  // Excedente positivo (exceso)
                                  return (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                      ✅ Excedente Positivo
                                    </span>
                                  );
                                } else {
                                  // OK (delta = 0)
                                  return (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                      ✓ OK
                                    </span>
                                  );
                                }
                              })()}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                      {detaliiTotals && (
                        <tfoot className="bg-purple-50 border-t border-purple-200">
                          <tr>
                            <td className="px-4 py-3 text-sm font-semibold text-purple-900 text-left">
                              Totales
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-blue-700">
                              {detaliiTotals.plan.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-gray-500">
                              —
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-green-700">
                              {detaliiTotals.fichado.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm font-semibold text-center ${
                                detaliiTotals.delta < 0
                                  ? 'text-red-600'
                                  : detaliiTotals.delta > 0
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {detaliiTotals.delta.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-yellow-600">
                              {detaliiTotals.incompletos}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-purple-700">
                              {detaliiTotals.ordinarias.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm font-semibold text-center ${
                                detaliiTotals.excedente > 0
                                  ? 'text-red-600'
                                  : detaliiTotals.excedente < 0
                                    ? 'text-yellow-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {detaliiTotals.excedente.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-gray-400">
                              —
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  )}
                </div>
              )}
              
              {/* Botón descargar PDF */}
              <div className={`pt-6 border-t border-gray-200 dark:border-gray-700 ${isMobile ? 'mt-4' : 'mt-8'}`}>
                <Button
                  variant="primary"
                  onClick={handleDescargarPDF}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200"
                  size="lg"
                >
                  📄 Descargar PDF oficial
                </Button>
              </div>
            </div>
          )}
        </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay datos disponibles
            </div>
          )}
        </div>
      </div>
    </div>
    
    {/* Modal pentru declarare no punch */}
    {detalle && (
      <DeclararNoPunchModal
        isOpen={showDeclararNoPunchModal}
        onClose={() => {
          setShowDeclararNoPunchModal(false);
          setSelectedDayForRegularization(null);
        }}
        onConfirm={async () => {
          success('Motivo registrado correctamente. La regularización será revisada por el supervisor.');
          setShowDeclararNoPunchModal(false);
          setSelectedDayForRegularization(null);
          // Opțional: reîncarcă datele pentru a actualiza UI-ul
          // Poți adăuga un callback onRefresh dacă este necesar
        }}
        data={{
          workday_date: selectedDayForRegularization?.fecha || '',
          scheduled_hours: selectedDayForRegularization?.plan 
            ? `${selectedDayForRegularization.plan}h` 
            : undefined,
          // Pentru admin care regularizează pentru alt angajat, folosim empleadoId ca codigo
          employee_codigo: detalle?.empleadoId ? String(detalle.empleadoId) : undefined,
        }}
      />
    )}
    </>
  );
};

export default EmployeeDetailDrawer;
