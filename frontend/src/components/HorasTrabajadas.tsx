import React, { useState, useEffect, useMemo } from 'react';
import { Card, Modal } from './ui';
import EmployeeMonthlyTable from './EmployeeMonthlyTable';
import EmployeeDetailDrawer from './EmployeeDetailDrawer';
import EmployeeAlertsTable from './EmployeeAlertsTable';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { routes } from '../utils/routes';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContextBase';
import ExcelJS from 'exceljs';

// Declarație de tip pentru pdfMake
declare global {
  interface Window {
    pdfMake?: unknown;
  }
}

// Tipuri de date
export type ResumenEmpleado = {
  empleadoId: number;
  empleadoNombre: string;
  firmaId?: number;
  mes: string; // "2025-10"
  horasTrabajadas: string | number; // Backend returnează "HH:MM:SS" sau number
  horasContrato: string | number;
  horasExtra: string | number;
  estado: "OK" | "ALERTA" | "RIESGO";
  horasPermitidasMensuales: string | number;
  // Câmpuri noi din structura extinsă
  grupo?: string;
  centroTrabajo?: string;
  tipoContrato?: string;
  fuente?: string; // "cuadrante" sau "horario"
  difVsContrato?: number;
  difVsPermitidas?: number;
  estadoPlan?: string;
  estadoPermitidas?: string;
  estadoPlanHastaHoy?: string;
  totalOrdinarias?: number;
  totalComplementarias?: number;
  totalExtraordinarias?: number;
  totalTrabajadas?: number;
  totalPlan?: number;
  totalPermitidas?: number;
  planHastaHoy?: number;
  diffPlanHastaHoy?: number;
  diffPlanMensual?: number;
  diffPermitidas?: number;
  horasContratoMes?: number;
  horasTrabajadasMes?: string | number;
  horasMensualesPermitidas?: string | number;
  horasCuadranteMes?: string | number;
  horasHorarioMes?: string | number | null;
  horasMes?: string | number;
  centroCuadrante?: string;
  detaliiZilnice?: Array<{
    fecha: string;
    plan?: number;
    plan_fuente?: string;
    fichado?: number;
    delta?: number;
    incompleto?: number;
    ordinarias?: number;
    excedente?: number;
  }>;
  mesesConCuadrante?: number;
  mesesConHorario?: number;
  mesesMixtos?: number;
  fuenteAnual?: string;
  horasCuadranteAnual?: string | number;
  horasHorarioAnual?: string | number;
  horasTrabajadasAnual?: string | number;
  horasContratoAnual?: string | number;
  horasPlanAnual?: string | number;
  horasPermitidasAnual?: string | number;
  resumenMensualDetalle?: Array<{
    ym: string;
    horas_plan_mes?: number;
    horas_cuadrante_mes?: number;
    horas_horario_mes?: number;
    fuente_mes?: string;
  }>;
  horasTrabajadasAnualDetalle?: string | number;
  horasContratoAnualDetalle?: string | number;
  horasPermitidasAnualDetalle?: string | number;
  mesesConCuadranteDetalle?: number;
  mesesConHorarioDetalle?: number;
  mesesMixtosDetalle?: number;
  fuenteAnualDetalle?: string;
  centroCuadranteDetalle?: string;
  // Câmpuri pentru zile (baja, vacaciones, ausencia, fiesta)
  diasBaja?: number | string;
  diasVacaciones?: number | string;
  diasAusencia?: number | string;
  diasFiesta?: number | string;
};

export type DetalleDia = {
  fecha: string;     // "2025-10-01"
  entrada: string;   // "08:02"
  salida: string;    // "16:10"
  horas: number;     // 8.13
  // Câmpuri noi din structura extinsă
  plan?: number;
  planFuente?: string;
  fichado?: number;
  delta?: number;
  incompleto?: number;
  ordinarias?: number;
  excedente?: number;
};

export type DetalleEmpleado = {
  empleadoId: number;
  empleadoNombre: string;
  mes: string;
  horasTrabajadas: number;
  horasContrato: number;
  horasExtra: number;
  mediaSemanalAnual: number; // ex: 40.3
  dias: DetalleDia[];
  // Date suplimentare pentru tab-ul de detalii
  grupo?: string;
  centroTrabajo?: string;
  tipoContrato?: string;
  horasContratoSemanal?: number;
  fuente?: string;
  horasCuadranteMes?: string | number;
  horasHorarioMes?: string | number | null;
  horasMes?: string | number;
  horasContratoMes?: number;
  horasTrabajadasMes?: string | number;
  horasMensualesPermitidas?: string | number;
  centroCuadrante?: string;
  difVsContrato?: number;
  difVsPermitidas?: number;
  estadoPlanHastaHoy?: string;
  estadoPlan?: string;
  estadoPermitidas?: string;
  totalOrdinarias?: number;
  totalComplementarias?: number;
  totalExtraordinarias?: number;
  totalTrabajadas?: number;
  totalPlan?: number;
  totalPermitidas?: number;
  planHastaHoy?: number;
  diffPlanHastaHoy?: number;
  diffPlanMensual?: number;
  diffPermitidas?: number;
  detaliiZilnice?: Array<{
    fecha: string;
    plan?: number;
    plan_fuente?: string;
    fichado?: number;
    delta?: number;
    incompleto?: number;
    ordinarias?: number;
    excedente?: number;
  }>;
  // Câmpuri specifice raportului anual
  horasContratoAnual?: number;
  horasTrabajadasAnual?: number;
  horasCuadranteAnual?: number;
  horasHorarioAnual?: number;
  totalPlanAnual?: number;
  totalPermitidasAnual?: number;
  totalTrabajadasAnual?: number;
  totalContratoAnual?: number;
  totalOrdinariasAnual?: number;
  totalComplementariasAnual?: number;
  totalExtraordinariasAnual?: number;
  diffPlanAnual?: number;
  diffPermitidasAnual?: number;
  estadoPlanAnual?: string;
  estadoPermitidasAnual?: string;
  planHastaHoyAnual?: number;
  trabajadasHastaHoyAnual?: number;
  diffPlanHastaHoyAnual?: number;
  estadoPlanHastaHoyAnual?: string;
  horasAnualesPermitidas?: number;
  mesesConCuadrante?: number;
  mesesConHorario?: number;
  mesesMixtos?: number;
  resumenMensual?: Array<{
    ym: string;
    horas_plan_mes?: number;
    horas_cuadrante_mes?: number;
    horas_horario_mes?: number;
    fuente_mes?: string;
  }>;
};

// Tipuri pentru date externe
type BajaMedica = {
  CODIGO?: string;
  codigo?: string;
  Codigo_Empleado?: string;
  codigoEmpleado?: string;
  fecha_inicio?: string;
  fechaInicio?: string;
  FECHA_INICIO?: string;
  'Fecha baja'?: string;
  'Fecha Baja'?: string;
  'Fecha de baja'?: string;
  fecha_baja?: string;
  fechaBaja?: string;
  'FECHA BAJA'?: string;
  fecha_fin?: string;
  fechaFin?: string;
  FECHA_FIN?: string;
  'Fecha de alta'?: string;
  'Fecha de Alta'?: string;
  'Fecha alta'?: string;
  'Fecha Alta'?: string;
  fecha_alta?: string;
  fechaAlta?: string;
  'FECHA ALTA'?: string;
  [key: string]: unknown;
};

type ActivityLog = {
  id?: number;
  timestamp?: string;
  action?: string;
  user?: string;
  email?: string;
  grupo?: string;
  updateby?: string;
  userAgent?: string;
  url?: string;
  sessionId?: string;
  ip?: string;
  [key: string]: unknown;
};

type EmpleadoRaw = {
  CODIGO?: string | number;
  codigo?: string | number;
  'NOMBRE / APELLIDOS'?: string;
  NOMBRE?: string;
  nombre?: string;
  'CORREO ELECTRONICO'?: string;
  correo?: string;
  email?: string;
  ESTADO?: string;
  estado?: string;
  GRUPO?: string;
  grupo?: string;
  [key: string]: unknown;
};

type DetalleZilnic = {
  fecha: string;
  plan?: number;
  plan_fuente?: string;
  fichado?: number;
  delta?: number;
  incompleto?: number;
  ordinarias?: number;
  excedente?: number;
  [key: string]: unknown;
};

// Interfaces pentru componente UI
interface TitleProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

interface TextProps {
  children: React.ReactNode;
  type?: 'primary' | 'secondary';
  style?: React.CSSProperties;
  className?: string;
}

// Componente simple pentru UI
const Title = ({ level, children, style, className, ...props }: TitleProps) => {
  const Tag = level === 2 ? 'h2' : level === 3 ? 'h3' : level === 4 ? 'h4' : level === 5 ? 'h5' : 'h6';
  return React.createElement(Tag, { style, className, ...props }, children);
};

const Text = ({ children, type, style, className, ...props }: TextProps) => {
  const textClassName = type === 'secondary' ? 'text-gray-500' : '';
  const combinedClassName = className ? `${textClassName} ${className}` : textClassName;
  return <span className={combinedClassName} style={style} {...props}>{children}</span>;
};


// Interface pentru error handler
interface ErrorHandler {
  handleError: (error: Error) => void;
}

// Fetch real data from backend endpoint
async function fetchResumen(
  mes: string,
  tipo: 'mensual' | 'anual' = 'mensual',
  errorHandler?: ErrorHandler,
  empleadoId?: number,
  soloEmpleado?: boolean,
  codigo?: string,
  empleadoNombre?: string
): Promise<ResumenEmpleado[]> {
  try {
    console.log('🔍 Fetching HorasTrabajadas from endpoint...', mes, tipo);
    console.log('🔍 fetchResumen params:', { mes, tipo, empleadoId, soloEmpleado });
    
    // Construiește URL-ul exact ca MonthlyAlerts
    const token = localStorage.getItem('auth_token');
    let url = '';
    
    if (soloEmpleado && empleadoId) {
      const baseUrl = routes.getHorasTrabajadas;
      if (tipo === 'mensual') {
        const params = new URLSearchParams({
          tipo: 'mensual',
          empleadoId: String(empleadoId),
          lunaselectata: mes
        });
        if (codigo) params.append('codigo', codigo);
        if (empleadoNombre) params.append('empleadoNombre', empleadoNombre);
        params.append('t', String(Date.now()));
        url = `${baseUrl}?${params.toString()}`;
      } else {
        const ano = mes.split('-')[0];
        const params = new URLSearchParams({
          tipo: 'anual',
          ano: ano
        });
        if (codigo) params.append('codigo', codigo);
        if (empleadoNombre) params.append('empleadoNombre', empleadoNombre);
        params.append('t', String(Date.now()));
        url = `${baseUrl}?${params.toString()}`;
      }
    } else {
      const baseUrl = routes.getHorasTrabajadas;
      if (tipo === 'mensual') {
        url = `${baseUrl}?tipo=mensual&lunaselectata=${mes}&t=${Date.now()}`;
      } else {
        const ano = mes.split('-')[0];
        url = `${baseUrl}?tipo=anual&ano=${ano}&t=${Date.now()}`;
      }
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('🔍 [HorasTrabajadas] Fetching resumen from new backend:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.warn('⚠️ [HorasTrabajadas] Request failed. Status:', response.status, response.statusText);
      return [];
    }

    const text = await response.text();
    if (!text) {
      console.warn('⚠️ [HorasTrabajadas] Empty response from backend');
      return [];
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return [];
    }
      
      // Parse the data structure from your endpoint
      let empleados: ResumenEmpleado[] = [];
      
      // Helper function pentru mapare item la ResumenEmpleado
      const parseOptionalNumber = (value: unknown) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);
        return isNaN(num) ? undefined : num;
      };

      const mapItemToResumen = (item: Record<string, unknown>, mesParam: string, tipoParam: 'mensual' | 'anual', empleadoIdParam?: number, empleadoNombreParam?: string) => {
        console.log('🔍 Mapping item:', item.empleadoNombre || item.empleadoId || empleadoNombreParam);
        console.log('🔍 Item keys:', Object.keys(item));
        console.log('🔍 Item raw data:', item);
        
        // Pentru soloEmpleado, dacă nu există empleadoId sau empleadoNombre în item, folosim parametrii
        const finalEmpleadoId = item.empleadoId || empleadoIdParam;
        const finalEmpleadoNombre = item.empleadoNombre || item['NOMBRE / APELLIDOS'] || empleadoNombreParam || 'Unknown';

        if (tipoParam === 'anual') {
          console.log('📆 Annual resumen raw item:', {
            empleadoId: item.empleadoId,
            empleadoNombre: item.empleadoNombre,
            grupo: item.grupo,
            horas_contrato_anual: item.horas_contrato_anual,
            horas_trabajadas_anual: item.horas_trabajadas_anual,
            total_trabajadas_anual: item.total_trabajadas_anual,
            total_permitidas_anual: item.total_permitidas_anual,
            diff_permitidas: item.diff_permitidas,
            resumen_mensual_raw: item.resumen_mensual,
            detalii_zilnice_length: Array.isArray(item.detalii_zilnice) ? item.detalii_zilnice.length : 'N/A'
          });

          try {
            if (item.resumen_mensual) {
              const resumenMensualParsed = typeof item.resumen_mensual === 'string'
                ? JSON.parse(item.resumen_mensual)
                : item.resumen_mensual;
              console.log('📆 Annual resumen_mensual parsed length:', Array.isArray(resumenMensualParsed) ? resumenMensualParsed.length : 'N/A');
              console.log('📆 Annual resumen_mensual first entries:', Array.isArray(resumenMensualParsed) ? resumenMensualParsed.slice(0, 3) : resumenMensualParsed);
            }
          } catch (err) {
            console.error('⚠️ Error parsing resumen_mensual for annual report:', err);
          }
        }
        
        // Prioritate: pentru anual folosim total_trabajadas_anual, pentru mensual total_trabajadas
        const horasTrabajadasRaw = tipoParam === 'anual' 
          ? (item.total_trabajadas_anual !== undefined && item.total_trabajadas_anual !== null
              ? item.total_trabajadas_anual
              : (item.horas_trabajadas_anual !== undefined && item.horas_trabajadas_anual !== null
                  ? item.horas_trabajadas_anual
                  : (item.total_trabajadas || item.horasTrabajadasAnuales || 0)))
          : (item.total_trabajadas !== undefined && item.total_trabajadas !== null
              ? item.total_trabajadas 
              : (item.horas_trabajadas_mes !== undefined && item.horas_trabajadas_mes !== null
                  ? item.horas_trabajadas_mes
                  : (item.horasTrabajadas || item.horasTrabajadasAnuales || 0)));
        // Asigură-te că este number, nu string (parsează corect string-urile pentru anual)
        const horasTrabajadas = typeof horasTrabajadasRaw === 'string' 
          ? (horasTrabajadasRaw.includes(':') ? parseFloat(horasTrabajadasRaw.split(':')[0]) : (parseFloat(horasTrabajadasRaw) || 0))
          : (typeof horasTrabajadasRaw === 'number' ? (isNaN(horasTrabajadasRaw) ? 0 : horasTrabajadasRaw) : 0);
        console.log('🔍 horasTrabajadas calculated:', horasTrabajadas, 'type:', typeof horasTrabajadas, 'from:', {
          total_trabajadas: item.total_trabajadas,
          horas_trabajadas_mes: item.horas_trabajadas_mes,
          horasTrabajadas: item.horasTrabajadas,
          raw: horasTrabajadasRaw
        });
        
        // Prioritate: pentru anual folosim total_plan_anual sau horas_contrato_anual, pentru mensual horas_mes sau total_plan
        const horasContratoRaw = tipoParam === 'anual'
          ? (item.total_plan_anual !== undefined && item.total_plan_anual !== null
              ? (typeof item.total_plan_anual === 'string' ? parseFloat(item.total_plan_anual) : item.total_plan_anual)
              : (item.horas_contrato_anual !== undefined && item.horas_contrato_anual !== null
                  ? (typeof item.horas_contrato_anual === 'string' ? parseFloat(item.horas_contrato_anual) : item.horas_contrato_anual)
                  : (item.total_plan || item.horasContrato || 0)))
          : (item.horas_mes !== undefined && item.horas_mes !== null
              ? (typeof item.horas_mes === 'string' ? parseFloat(item.horas_mes) : item.horas_mes)
              : (item.total_plan !== undefined && item.total_plan !== null
                  ? item.total_plan
                  : (item.horas_contrato_mes !== undefined && item.horas_contrato_mes !== null
                      ? (typeof item.horas_contrato_mes === 'string' ? parseFloat(item.horas_contrato_mes) : item.horas_contrato_mes)
                      : (item.horasContrato || item.horasContratoSemanal || 0))));
        const horasContrato = typeof horasContratoRaw === 'number' ? (isNaN(horasContratoRaw) ? 0 : horasContratoRaw) : (parseFloat(String(horasContratoRaw)) || 0);
        console.log('🔍 horasContrato calculated:', horasContrato, 'type:', typeof horasContrato, 'from:', {
          horas_mes: item.horas_mes,
          total_plan: item.total_plan,
          horas_contrato_mes: item.horas_contrato_mes,
          horasContrato: item.horasContrato
        });
        
        // Prioritate: pentru anual folosim total_permitidas_anual sau horas_anuales_permitidas, pentru mensual total_permitidas sau horas_mensuales_permitidas
        const horasPermitidasRaw = tipoParam === 'anual'
          ? (item.total_permitidas_anual !== undefined && item.total_permitidas_anual !== null
              ? item.total_permitidas_anual
              : (item.horas_anuales_permitidas !== undefined && item.horas_anuales_permitidas !== null
                  ? item.horas_anuales_permitidas
                  : (item.horas_permitidas_interval !== undefined && item.horas_permitidas_interval !== null
                      ? item.horas_permitidas_interval
                      : (item.total_permitidas || item.horasPermitidasAnuales || 0))))
          : (item.total_permitidas !== undefined && item.total_permitidas !== null
              ? item.total_permitidas 
              : (item.horas_mensuales_permitidas !== undefined && item.horas_mensuales_permitidas !== null
                  ? item.horas_mensuales_permitidas
                  : (item.horasPermitidasMensuales || item.horasPermitidasAnuales || 0)));
        // Asigură-te că este number, nu string (parsează corect string-urile pentru anual)
        const horasPermitidas = typeof horasPermitidasRaw === 'string' 
          ? (horasPermitidasRaw.includes(':') ? parseFloat(horasPermitidasRaw.split(':')[0]) : (parseFloat(horasPermitidasRaw) || 0))
          : (typeof horasPermitidasRaw === 'number' ? (isNaN(horasPermitidasRaw) ? 0 : horasPermitidasRaw) : 0);
        console.log('🔍 horasPermitidas calculated:', horasPermitidas, 'type:', typeof horasPermitidas, 'from:', {
          total_permitidas: item.total_permitidas,
          horas_mensuales_permitidas: item.horas_mensuales_permitidas,
          horasPermitidasMensuales: item.horasPermitidasMensuales,
          raw: horasPermitidasRaw
        });
        
        // Calculează horasExtra din diferențe sau din total excedente
        let horasExtraRaw = 0;
        // Prioritate: total_extraordinarias > calculat din excedente din detalii > diff_permitidas (doar dacă pozitiv) > dif_vs_permitidas
        if (item.total_extraordinarias !== undefined && item.total_extraordinarias !== null && item.total_extraordinarias > 0) {
          horasExtraRaw = item.total_extraordinarias;
        } else if (item.detalii_zilnice && Array.isArray(item.detalii_zilnice) && item.detalii_zilnice.length > 0) {
          // Calculează din suma excedente din detalii zilnice
          const sumaExcedente = item.detalii_zilnice.reduce((sum: number, detalle: { excedente?: string | number }) => {
            const excedente = typeof detalle.excedente === 'string' ? parseFloat(detalle.excedente) : (detalle.excedente || 0);
            return sum + (typeof excedente === 'number' ? excedente : 0);
          }, 0);
          if (sumaExcedente > 0) {
            horasExtraRaw = sumaExcedente;
          }
        }
        
        // Dacă încă este 0, încearcă din alte câmpuri
        if (horasExtraRaw === 0) {
          if (item.diff_permitidas !== undefined && item.diff_permitidas !== null && item.diff_permitidas > 0) {
            horasExtraRaw = item.diff_permitidas;
          } else if (item.dif_vs_permitidas !== undefined && item.dif_vs_permitidas !== null && item.dif_vs_permitidas > 0) {
            horasExtraRaw = item.dif_vs_permitidas;
          } else {
            horasExtraRaw = item.horasExtra || item.horasExtraAnual || 0;
          }
        }
        
        // Asigură-te că este number
        const horasExtra = typeof horasExtraRaw === 'string' 
          ? (horasExtraRaw.includes(':') ? parseFloat(horasExtraRaw.split(':')[0]) : parseFloat(horasExtraRaw))
          : (typeof horasExtraRaw === 'number' ? (isNaN(horasExtraRaw) ? 0 : horasExtraRaw) : 0);
        console.log('🔍 horasExtra calculated:', horasExtra, 'type:', typeof horasExtra, 'from:', {
          total_extraordinarias: item.total_extraordinarias,
          diff_permitidas: item.diff_permitidas,
          dif_vs_permitidas: item.dif_vs_permitidas,
          horasExtra: item.horasExtra,
          raw: horasExtraRaw
        });
        
        // Determină estado din estado_plan sau estado_permitidas
        const estado = item.estado_plan || item.estado_permitidas || item.estado || "OK";
        console.log('🔍 estado calculated:', estado, 'from:', {
          estado_plan: item.estado_plan,
          estado_permitidas: item.estado_permitidas,
          estado: item.estado
        });
        
        const mapped = {
          empleadoId: finalEmpleadoId ? (typeof finalEmpleadoId === 'string' ? parseInt(finalEmpleadoId) : finalEmpleadoId) : 0,
          empleadoNombre: finalEmpleadoNombre,
          firmaId: item.firmaId,
          mes: item.luna_selectata || mesParam,
          horasTrabajadas: horasTrabajadas,
          horasContrato: horasContrato,
          horasExtra: horasExtra,
          estado: estado,
          horasPermitidasMensuales: horasPermitidas,
          // Câmpuri noi
          grupo: item.grupo,
          centroTrabajo: item.centro_trabajo,
          tipoContrato: item.tipo_contrato,
          fuente: item.fuente || item.fuente_anual,
          fuenteAnual: item.fuente_anual,
          difVsContrato: item.dif_vs_contrato || item.diff_plan_mensual,
          difVsPermitidas: item.dif_vs_permitidas || item.diff_permitidas,
          estadoPlan: item.estado_plan,
          estadoPermitidas: item.estado_permitidas,
          estadoPlanHastaHoy: item.estado_plan_hasta_hoy,
          totalOrdinarias: item.total_ordinarias,
          totalComplementarias: item.total_complementarias,
          totalExtraordinarias: item.total_extraordinarias,
          totalTrabajadas: tipoParam === 'anual' 
            ? (item.total_trabajadas_anual ?? item.total_trabajadas)
            : item.total_trabajadas,
          totalPlan: tipoParam === 'anual'
            ? (item.total_plan_anual ?? item.total_plan)
            : item.total_plan,
          totalPermitidas: tipoParam === 'anual'
            ? (item.total_permitidas_anual ?? item.total_permitidas)
            : item.total_permitidas,
          planHastaHoy: item.plan_hasta_hoy,
          diffPlanHastaHoy: item.diff_plan_hasta_hoy,
          diffPlanMensual: item.diff_plan_mensual,
          diffPermitidas: item.diff_permitidas,
          horasContratoMes: item.horas_contrato_mes,
          horasTrabajadasMes: item.horas_trabajadas_mes,
          horasMensualesPermitidas: item.horas_mensuales_permitidas,
          horasCuadranteMes: item.horas_cuadrante_mes,
          horasHorarioMes: item.horas_horario_mes,
          horasMes: item.horas_mes,
          centroCuadrante: item.centro_cuadrante,
          detaliiZilnice: item.detalii_zilnice || undefined,
          horasCuadranteAnual: parseOptionalNumber(item.horas_cuadrante_anual),
          horasHorarioAnual: parseOptionalNumber(item.horas_horario_anual),
          // Parsează string-urile pentru anual
          horasTrabajadasAnual: typeof item.horas_trabajadas_anual === 'string' 
            ? (parseFloat(item.horas_trabajadas_anual) || 0)
            : (item.horas_trabajadas_anual ?? (typeof item.total_trabajadas_anual === 'string' ? parseFloat(item.total_trabajadas_anual) : item.total_trabajadas_anual) ?? item.total_trabajadas ?? 0),
          horasContratoAnual: parseOptionalNumber(item.horas_contrato_anual ?? item.total_contrato_anual ?? item.total_plan),
          horasPlanAnual: item.horas_plan_anual ?? item.total_plan_anual ?? item.total_plan,
          // Parsează string-urile pentru horas_anuales_permitidas
          horasPermitidasAnual: typeof item.horas_anuales_permitidas === 'string'
            ? (parseFloat(item.horas_anuales_permitidas) || 0)
            : (item.horas_anuales_permitidas ?? (typeof item.horas_permitidas_interval === 'string' ? parseFloat(item.horas_permitidas_interval) : item.horas_permitidas_interval) ?? item.total_permitidas_anual ?? item.total_permitidas ?? 0),
          resumenMensual: item.resumen_mensual,
          mesesConCuadrante: item.meses_con_cuadrante,
          mesesConHorario: item.meses_con_horario,
          mesesMixtos: item.meses_mixtos,
          codigo: item.codigo || item.CODIGO || item.codEmpleado || undefined,
          // Câmpuri pentru zile (baja, vacaciones, ausencia, fiesta) - parsează string-urile în numere
          diasBaja: typeof item.dias_baja === 'string' ? (parseInt(item.dias_baja) || 0) : (item.dias_baja || item.diasBaja || 0),
          diasVacaciones: typeof item.dias_vacaciones === 'string' ? (parseInt(item.dias_vacaciones) || 0) : (item.dias_vacaciones || item.diasVacaciones || 0),
          diasAusencia: typeof item.dias_ausencia === 'string' ? (parseInt(item.dias_ausencia) || 0) : (item.dias_ausencia || item.diasAusencia || 0),
          diasFiesta: typeof item.dias_fiesta === 'string' ? (parseInt(item.dias_fiesta) || 0) : (item.dias_fiesta || item.diasFiesta || 0)
        };
        
        console.log('🔍 Mapped result for', mapped.empleadoNombre, ':', mapped);
        return mapped;
      };
      
      if (Array.isArray(data) && data.length > 0 && data[0].empleados) {
        console.log('✅ Data is array with empleados wrapper, parsing format...');
        console.log('🔍 data[0].empleados:', data[0].empleados);
        empleados = data[0].empleados.map(item => mapItemToResumen(item, mes, tipo, empleadoId, empleadoNombre));
      } else if (data.empleados && Array.isArray(data.empleados)) {
        console.log('✅ Data has empleados array');
        console.log('🔍 data.empleados:', data.empleados);
        empleados = data.empleados.map(item => mapItemToResumen(item, mes, tipo, empleadoId, empleadoNombre));
      } else if (Array.isArray(data)) {
        console.log('✅ Data is direct array, parsing format...');
        console.log('🔍 Array length:', data.length);
        console.log('🔍 First 3 items:', data.slice(0, 3));
        if (tipo === 'anual') {
          console.log('📆 Annual resumen mapped array sample:', data.slice(0, 3));
        }
        empleados = data.map(item => mapItemToResumen(item, mes, tipo, empleadoId, empleadoNombre));
      } else {
        console.log('⚠️ Unknown data structure');
        console.log('🔍 Data structure:', JSON.stringify(data, null, 2));
        return [];
      }
      
      console.log('🔍 Total empleados mapped:', empleados.length);
      console.log('🔍 Final empleados array:', empleados);
      console.log('🔍 First empleado details:', empleados[0]);
      if (tipo === 'anual') {
        console.log('📆 Annual resumen mapped result preview:', empleados.slice(0, 5));
      }

      // Pentru soloEmpleado, endpoint-ul returnează deja doar un angajat, deci nu mai facem filtrare suplimentară
      // Pentru supervizor, returnăm toți angajații
      if (soloEmpleado) {
        console.log('🔍 soloEmpleado mode: endpoint already returns filtered data, no additional filtering needed');
        console.log('🔍 Employees received:', empleados.length, 'item(s)');
      } else {
        console.log('🔍 Supervisor mode: returning all employees:', empleados.length, 'employees');
      }
      console.log('🔍 ===== END DEBUG HORAS TRABAJADAS =====');
      return empleados;
  } catch (error) {
    console.error('❌ Error fetching horas trabajadas:', error);
    
    // Gestionează eroarea cu error handler
    if (errorHandler) {
      errorHandler.handleApiError(error, 'HorasTrabajadas - fetchResumen');
    }
    
    // Return empty array instead of fallback data
    return [];
  }
}

// Fetch real detalle data from backend
async function fetchDetalle(
  empleadoId: number,
  mes: string,
  empleadoNombre: string,
  tipoReporte: 'mensual' | 'anual',
  codigoEmpleado?: string
): Promise<DetalleEmpleado> {
  try {
    console.log('🔍 Fetching detalle for empleado:', empleadoId, 'nombre:', empleadoNombre, 'mes:', mes, 'tipo:', tipoReporte);
    
    const tipoDetalle = tipoReporte === 'mensual' ? 'detallemensual' : 'detalleanual';
    let url = '';
    if (tipoDetalle === 'detallemensual') {
      const codigo = codigoEmpleado || String(empleadoId);
      // ✅ MIGRAT: folosim backend /api/monthly-alerts în loc de n8n
      const params = new URLSearchParams({
        tipo: 'detallemensual',
        empleadoId: codigo,
        mes: mes
      });
      url = `${routes.getMonthlyAlerts}?${params.toString()}`;
    } else {
      // ✅ MIGRAT: folosim backend /api/monthly-alerts pentru detalleanual
      const params = new URLSearchParams({
        tipo: 'anual',
        empleadoId: String(empleadoId),
        ano: mes.split('-')[0]
      });
      url = `${routes.getMonthlyAlerts}?${params.toString()}`;
    }
    
    // Add JWT token for backend API calls
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });

    console.log('🔍 Detalle response status:', response.status);
    console.log('🔍 Detalle response ok:', response.ok);
    console.log('🔍 Detalle URL:', url);

    if (response.ok) {
      const responseText = await response.text();
      console.log('🔍 Raw detalle response length:', responseText.length);
      console.log('🔍 Raw detalle response preview:', responseText.substring(0, 500));
      if (tipoDetalle === 'detallemensual') {
        console.log('📝 Monthly registros raw text:', responseText);
      }
      
      if (!responseText.trim()) {
        console.log('⚠️ Empty detalle response from server');
        throw new Error('Empty response from server');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔍 Detalle data received:', data);
        
        // Pentru detalleanual, răspunsul poate fi un array cu un singur obiect
        if (tipoDetalle === 'detalleanual' && Array.isArray(data) && data.length > 0) {
          console.log('📆 Detalleanual response is array, extracting first item');
          data = data[0];
        }
      } catch (parseError) {
        console.error('❌ JSON parse error for detalle:', parseError);
        throw new Error('Invalid JSON response');
      }
      
      // Endpointul de registre (detallemensual) întoarce un array simplu cu intrări/ieșiri
      if (tipoDetalle === 'detallemensual' && Array.isArray(data)) {
        const normalizeField = (value: unknown, fallback = '--:--') => {
          if (value === undefined || value === null || value === '') return fallback;
          return String(value);
        };

        const registros = data.map((item) => ({
          fecha: item.FECHA || item.fecha || '--',
          tipo: item.TIPO || item.tipo || '',
          hora: normalizeField(item.HORA || item.hora),
          direccion: item.DIRECCION || item.direccion || '',
          duracion: normalizeField(item.DURACION || item.duracion),
          idRegistro: item.ID || item.id || item.registroId || '',
          codigo: item.CODIGO || item.codigo,
          empleadoNombre: item['NOMBRE / APELLIDOS'] || item.empleadoNombre || empleadoNombre,
        }));

        console.log('📝 Monthly registros normalized:', registros.slice(0, 5));

        const parcialDetalle = {
          dias: registros.map((reg) => ({
            fecha: reg.fecha,
            entrada: reg.tipo?.toLowerCase() === 'entrada' ? reg.hora : '--:--',
            salida: reg.tipo?.toLowerCase() === 'salida' ? reg.hora : '--:--',
            horas: reg.duracion && reg.duracion !== '--:--' ? reg.duracion : undefined,
            direccion: reg.direccion,
            tipo: reg.tipo,
            duracion: reg.duracion,
            idRegistro: reg.idRegistro,
          }))
        } as Partial<DetalleEmpleado>;

        return parcialDetalle as DetalleEmpleado;
      }

      // Parse the detalle data structure - noua structură cu detalii_zilnice
      // Suportă atât pentru mensual cât și pentru anual
      if (data && (data.empleadoId || data.detalii_zilnice) && data.detalii_zilnice && Array.isArray(data.detalii_zilnice)) {
        console.log('✅ Detalle data parsed successfully (noua structură cu detalii_zilnice)');
        console.log('🔍 Data structure:', data);
        console.log('🔍 Detalii zilnice count:', data.detalii_zilnice.length);

        let resumenMensualParsed: DetalleEmpleado['resumenMensual'];
        if (data.resumen_mensual) {
          try {
            const rawResumen = typeof data.resumen_mensual === 'string'
              ? JSON.parse(data.resumen_mensual)
              : data.resumen_mensual;
            if (Array.isArray(rawResumen)) {
              resumenMensualParsed = rawResumen;
              console.log('📆 Resumen mensual parsed length:', rawResumen.length);
            }
          } catch (err) {
            console.warn('⚠️ Error parsing resumen_mensual:', err);
          }
        }

        // Mapează detalii_zilnice la formatul DetalleDia
        // Notă: în noua structură nu avem direct entrada/salida, ci doar plan/fichado
        // Trebuie să construim entrada/salida din alte surse sau să folosim plan/fichado
        const dias = data.detalii_zilnice.map((detalle) => {
          // Calculează horas din fichado sau din alte câmpuri disponibile
          const horas = detalle.fichado || detalle.plan || 0;
          
          // Pentru entrada/salida, poți folosi plan_fuente sau alte surse
          // Dacă nu sunt disponibile, lasă-le goale sau folosește placeholder-uri
          return {
            fecha: detalle.fecha,
            entrada: detalle.entrada || '--:--',
            salida: detalle.salida || '--:--',
            horas: horas,
            // Câmpuri noi
            plan: detalle.plan,
            planFuente: detalle.plan_fuente,
            fichado: detalle.fichado,
            delta: detalle.delta,
            incompleto: detalle.incompleto,
            ordinarias: detalle.ordinarias,
            excedente: detalle.excedente
          };
        });
        
        console.log('🔍 Nuevo formato - Dias procesadas:', dias.length);
        
        const parseNumber = (value: unknown, fallback = 0) => {
          if (value === undefined || value === null || value === '') return fallback;
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? fallback : num;
        };
        
        const resultadoDetalle: DetalleEmpleado = {
          empleadoId: data.empleadoId || empleadoId,
          empleadoNombre: data.empleadoNombre || empleadoNombre,
          mes: data.luna_selectata || mes,
          horasTrabajadas: parseNumber(data.horas_trabajadas_mes ?? data.horasTrabajadas ?? data.total_trabajadas, 0),
          // horasContrato trebuie să fie ore săptămânale (din HORAS DE CONTRATO din backend)
          // Backend returnează horas_contrato ca ore săptămânale direct din HORAS DE CONTRATO
          horasContrato: parseNumber(data.horas_contrato, 0),
          horasExtra: parseNumber(data.total_extraordinarias ?? data.horasExtra, 0),
          mediaSemanalAnual: parseNumber(data.mediaSemanalAnual, 0),
          dias: dias,
          grupo: data.grupo,
          centroTrabajo: data.centro_trabajo,
          tipoContrato: data.tipo_contrato,
          centroCuadrante: data.centro_cuadrante,
          fuente: data.fuente || data.fuente_anual,
          fuenteAnual: data.fuente_anual,
          horasMensualesPermitidas: data.horas_mensuales_permitidas,
          horasContratoMes: parseNumber(data.horas_contrato_mes ?? data.horasContrato, undefined),
          horasTrabajadasMes: data.horas_trabajadas_mes,
          horasCuadranteMes: data.horas_cuadrante_mes,
          horasHorarioMes: data.horas_horario_mes,
          horasMes: data.horas_mes,
          difVsContrato: parseNumber(data.dif_vs_contrato ?? data.diff_plan_mensual, 0),
          difVsPermitidas: parseNumber(data.dif_vs_permitidas ?? data.diff_permitidas, 0),
          estadoPlanHastaHoy: data.estado_plan_hasta_hoy,
          estadoPlan: data.estado_plan,
          estadoPermitidas: data.estado_permitidas,
          totalOrdinarias: parseNumber(data.total_ordinarias, 0),
          totalComplementarias: parseNumber(data.total_complementarias, 0),
          totalExtraordinarias: parseNumber(data.total_extraordinarias, 0),
          totalTrabajadas: parseNumber(data.total_trabajadas, 0),
          totalPlan: parseNumber(data.total_plan, 0),
          totalPermitidas: parseNumber(data.total_permitidas, 0),
          planHastaHoy: parseNumber(data.plan_hasta_hoy, 0),
          diffPlanHastaHoy: parseNumber(data.diff_plan_hasta_hoy, 0),
          diffPlanMensual: parseNumber(data.diff_plan_mensual, 0),
          diffPermitidas: parseNumber(data.diff_permitidas ?? data.dif_vs_permitidas, 0),
          detaliiZilnice: data.detalii_zilnice,
          horasContratoAnual: parseNumber(data.horas_contrato_anual ?? data.total_contrato_anual ?? data.total_plan_anual, 0),
          horasTrabajadasAnual: parseNumber(data.horas_trabajadas_anual ?? data.total_trabajadas_anual ?? data.total_trabajadas, 0),
          horasCuadranteAnual: parseNumber(data.horas_cuadrante_anual, 0),
          horasHorarioAnual: parseNumber(data.horas_horario_anual, 0),
          totalPlanAnual: parseNumber(data.total_plan_anual ?? data.total_plan, 0),
          totalPermitidasAnual: parseNumber(data.total_permitidas_anual ?? data.total_permitidas, 0),
          totalTrabajadasAnual: parseNumber(data.total_trabajadas_anual ?? data.total_trabajadas, 0),
          totalContratoAnual: parseNumber(data.total_contrato_anual ?? data.horas_contrato_anual ?? data.total_plan_anual ?? data.total_plan, 0),
          totalOrdinariasAnual: parseNumber(data.total_ordinarias_anual ?? data.total_ordinarias, 0),
          totalComplementariasAnual: parseNumber(data.total_complementarias_anual ?? data.total_complementarias, 0),
          totalExtraordinariasAnual: parseNumber(data.total_extraordinarias_anual ?? data.total_extraordinarias, 0),
          diffPlanAnual: parseNumber(data.diff_plan_anual ?? data.dif_plan_anual ?? data.diff_plan_intervalo ?? data.diff_plan_mensual ?? data.dif_vs_contrato, 0),
          diffPermitidasAnual: parseNumber(data.diff_permitidas_anual ?? data.dif_permitidas_anual ?? data.diff_permitidas_interval ?? data.diff_permitidas ?? data.dif_vs_permitidas, 0),
          estadoPlanAnual: data.estado_plan_anual ?? data.estado_plan,
          estadoPermitidasAnual: data.estado_permitidas_anual ?? data.estado_permitidas,
          planHastaHoyAnual: parseNumber(data.plan_hasta_hoy_anual ?? data.plan_hasta_hoy ?? data.total_plan_anual ?? data.total_plan, 0),
          trabajadasHastaHoyAnual: parseNumber(data.trabajadas_hasta_hoy_anual ?? data.trabajadas_hasta_hoy ?? data.total_trabajadas_anual ?? data.total_trabajadas, 0),
          diffPlanHastaHoyAnual: parseNumber(data.diff_plan_hasta_hoy_anual ?? data.dif_plan_hasta_hoy_anual ?? data.diff_plan_hasta_hoy ?? data.dif_plan_hasta_hoy, 0),
          estadoPlanHastaHoyAnual: data.estado_plan_hasta_hoy_anual ?? data.estado_plan_hasta_hoy,
          horasAnualesPermitidas: parseNumber(data.horas_anuales_permitidas ?? data.horas_permitidas_interval, 0),
          mesesConCuadrante: data.meses_con_cuadrante,
          mesesConHorario: data.meses_con_horario,
          mesesMixtos: data.meses_mixtos,
          resumenMensual: resumenMensualParsed
        };

        if (tipoDetalle === 'detalleanual') {
          try {
            const codigo = codigoEmpleado || String(empleadoId);
            // ✅ MIGRAT: folosim backend /api/monthly-alerts pentru detalleanual
            const registrosParams = new URLSearchParams({
              tipo: 'anual',
              empleadoId: codigo,
              ano: mes.split('-')[0]
            });
            const registrosUrl = `${routes.getMonthlyAlerts}?${registrosParams.toString()}`;
            console.log('📝 Fetching registros anuales desde:', registrosUrl);
            
            // Add JWT token for backend API calls
            const token = localStorage.getItem('auth_token');
            const headers = {
              'Content-Type': 'application/json'
            };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }

            const registrosResp = await fetch(registrosUrl, {
              method: 'GET',
              headers: headers,
              credentials: 'include'
            });

            const registrosText = await registrosResp.text();
            console.log('📝 Registros anual response length:', registrosText.length);

            if (registrosResp.ok && registrosText.trim()) {
              const registrosData = JSON.parse(registrosText);
              console.log('📝 Registros anual parsed sample:', Array.isArray(registrosData) ? registrosData.slice(0, 5) : registrosData);

              if (Array.isArray(registrosData)) {
                const registrosNormalizados = registrosData.map((item: Record<string, unknown>) => ({
                  fecha: item.FECHA || item.fecha || '--',
                  tipo: item.TIPO || item.tipo || '',
                  hora: item.HORA || item.hora || '--:--',
                  direccion: item.DIRECCION || item.direccion || '',
                  duracion: item.DURACION || item.duracion || '--:--',
                  idRegistro: item.ID || item.id || item.registroId || ''
                }));

                resultadoDetalle.dias = registrosNormalizados.map((reg) => ({
                  fecha: reg.fecha,
                  entrada: reg.tipo?.toLowerCase() === 'entrada' ? reg.hora : '--:--',
                  salida: reg.tipo?.toLowerCase() === 'salida' ? reg.hora : '--:--',
                  horas: reg.duracion && reg.duracion !== '--:--' ? reg.duracion : undefined,
                  direccion: reg.direccion,
                  tipo: reg.tipo,
                  duracion: reg.duracion,
                  idRegistro: reg.idRegistro,
                }));
              }
            }
          } catch (regError) {
            console.warn('⚠️ No se pudieron cargar registros anuales completos:', regError);
          }
        }
 
        return resultadoDetalle;
      } else if (data && data.empleadoId && data.registros && Array.isArray(data.registros)) {
        console.log('✅ Detalle data parsed successfully (object format cu registros)');
        console.log('🔍 Data structure:', data);
        console.log('🔍 Registros count:', data.registros.length);
        
        // Interface pentru registru de ore
        interface RegistroHora {
          fecha: string;
          entrada: string;
          salida: string;
          horas: number;
          empleadoId: number;
          empleadoNombre: string;
        }

        // Grupează registrele pe zile și calculează orele
        const registrosPorDia: { [fecha: string]: RegistroHora[] } = {};
        data.registros.forEach((registro: RegistroHora) => {
          if (!registrosPorDia[registro.fecha]) {
            registrosPorDia[registro.fecha] = [];
          }
          registrosPorDia[registro.fecha].push(registro);
        });
        
        console.log('🔍 Registros por dia keys:', Object.keys(registrosPorDia));
        console.log('🔍 Registros por dia:', registrosPorDia);
        
        // Afișează toate registrele individuale (nu grupate pe zile)
        const dias = data.registros.map(registro => {
          return {
            fecha: registro.fecha,
            entrada: registro.tipo === 'Entrada' ? registro.hora.substring(0, 5) : '--:--',
            salida: registro.tipo === 'Salida' ? registro.hora.substring(0, 5) : '--:--',
            horas: registro.duracion ? (() => {
              const [hours, minutes] = registro.duracion.split(':').map(Number);
              return parseFloat((hours + minutes / 60).toFixed(1));
            })() : 0,
            tipo: registro.tipo,
            direccion: registro.direccion,
            duracion: registro.duracion
          };
        });
        
        console.log('🔍 Object format - Dias procesadas:', dias.length);
        console.log('🔍 Object format - Dias:', dias);
        
        return {
          empleadoId: empleadoId,
          empleadoNombre: empleadoNombre,
          mes: mes,
          horasTrabajadas: parseFloat(data.horasTrabajadas || 0),
          horasContrato: parseFloat(data.horasContrato || 0),
          horasExtra: parseFloat(data.horasExtra || 0),
          mediaSemanalAnual: parseFloat(data.mediaSemanalAnual || 0),
          dias: dias
        };
      } else if (Array.isArray(data) && data.length > 0) {
        console.log('✅ Detalle data parsed successfully (array format)');
        console.log('🔍 Data structure:', data);
        console.log('🔍 Registros count:', data.length);
        
        // Grupează registrele pe zile și calculează orele
        const registrosPorDia: { [fecha: string]: RegistroHora[] } = {};
        data.forEach((registro: RegistroHora) => {
          if (!registrosPorDia[registro.fecha]) {
            registrosPorDia[registro.fecha] = [];
          }
          registrosPorDia[registro.fecha].push(registro);
        });
        
        console.log('🔍 Array format - Registros por dia keys:', Object.keys(registrosPorDia));
        console.log('🔍 Array format - Registros por dia:', registrosPorDia);
        
        // Afișează toate registrele individuale (nu grupate pe zile)
        const dias = data.map(registro => {
          return {
            fecha: registro.fecha,
            entrada: registro.tipo === 'Entrada' ? registro.hora.substring(0, 5) : '--:--',
            salida: registro.tipo === 'Salida' ? registro.hora.substring(0, 5) : '--:--',
            horas: registro.duracion ? (() => {
              const [hours, minutes] = registro.duracion.split(':').map(Number);
              return parseFloat((hours + minutes / 60).toFixed(1));
            })() : 0,
            tipo: registro.tipo,
            direccion: registro.direccion,
            duracion: registro.duracion
          };
        });
        
        console.log('🔍 Array format - Dias procesadas:', dias.length);
        console.log('🔍 Array format - Dias:', dias);
        
        return {
          empleadoId: empleadoId,
          empleadoNombre: empleadoNombre,
          mes: mes,
          horasTrabajadas: parseFloat(data.reduce((total, r) => {
            if (r.duracion) {
              const [hours, minutes] = r.duracion.split(':').map(Number);
              return total + hours + minutes / 60;
            }
            return total;
          }, 0).toFixed(1)),
          horasContrato: 0, // Nu avem această informație în registre
          horasExtra: 0, // Nu avem această informație în registre
          mediaSemanalAnual: 0, // Nu avem această informație în registre
          dias: dias
        };
      } else {
        console.log('⚠️ Invalid detalle data structure');
        console.log('🔍 Data structure received:', data);
        throw new Error('Invalid data structure');
      }
    } else {
      console.error('❌ Detalle response not ok:', response.status, response.statusText);
      console.log('🔍 Full response:', response);
      throw new Error(`Error fetching detalle: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error fetching detalle:', error);
    throw error;
  }
}

// TODO backend PDF: /api/horas/detalle?empleado=ID&mes=YYYY-MM&pdf=1
async function descargarPDF(empleadoId: number, mes: string): Promise<void> {
  console.log(`📄 Descargando PDF para empleado ${empleadoId}, mes ${mes}`);
  // TODO: Implementar descarga real de PDF
}

async function fetchRegistrosEmpleado(codigo: string, mes?: string) {
  if (!codigo) {
    console.warn('⚠️ fetchRegistrosEmpleado called without codigo');
    return [];
  }

  // ✅ MIGRAT: folosim backend /api/monthly-alerts în loc de n8n
  const params = new URLSearchParams({
    tipo: 'detallemensual',
    empleadoId: codigo,
    mes: mes || ''
  });

  const url = `${routes.getMonthlyAlerts}?${params.toString()}`;
  console.log('📝 fetchRegistrosEmpleado URL:', url);

  // Add JWT token for backend API calls
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
    credentials: 'include'
  });

  const rawText = await response.text();
  console.log('📝 fetchRegistrosEmpleado raw length:', rawText.length);

  if (!response.ok) {
    throw new Error(`fetchRegistrosEmpleado failed: ${response.status}`);
  }

  if (!rawText.trim()) {
    return [];
  }

  const data = JSON.parse(rawText);
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: Record<string, unknown>) => ({
    fecha: item.FECHA || item.fecha || '--',
    entrada: (item.TIPO || item.tipo || '').toLowerCase() === 'entrada' ? (item.HORA || item.hora || '--:--') : '--:--',
    salida: (item.TIPO || item.tipo || '').toLowerCase() === 'salida' ? (item.HORA || item.hora || '--:--') : '--:--',
    tipo: item.TIPO || item.tipo || '',
    duracion: item.DURACION || item.duracion || '--:--',
    direccion: item.DIRECCION || item.direccion || '',
    horas: item.DURACION || item.duracion || undefined,
    idRegistro: item.ID || item.id || item.registroId || ''
  }));
}

interface HorasTrabajadasProps {
  empleadoId?: number;
  soloEmpleado?: boolean;
  codigo?: string;
  empleadoNombre?: string;
  isMobile?: boolean;
}

const HorasTrabajadas: React.FC<HorasTrabajadasProps> = ({ empleadoId, soloEmpleado = false, codigo, empleadoNombre, isMobile = false }) => {
  console.log('🔍 HorasTrabajadas component props:', { empleadoId, soloEmpleado });
  const [selectedMes, setSelectedMes] = useState<string>(() => {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [tipoReporte, setTipoReporte] = useState<'mensual' | 'anual'>('mensual');
  const [resumenData, setResumenData] = useState<ResumenEmpleado[]>([]);
  const [detalleData, setDetalleData] = useState<DetalleEmpleado | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changingMonth, setChangingMonth] = useState(false);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [tablaActiva, setTablaActiva] = useState<'resumen' | 'alertas'>('resumen');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSinRegistrosModal, setShowSinRegistrosModal] = useState(false);
  const [empleadosSinRegistros, setEmpleadosSinRegistros] = useState<Array<{
    codigo: string, 
    nombre: string, 
    grupo?: string,
    ultimoLog?: {
      timestamp: string;
      action: string;
      url?: string;
    } | null;
  }>>([]);
  const [loadingSinRegistros, setLoadingSinRegistros] = useState(false);
  
  // Error handling
  const { handleApiError, handleNetworkError } = useErrorHandler();
  const { callApi } = useApi();
  const { user: authUser } = useAuth();
  
  // Verifică dacă utilizatorul este Admin, Supervisor sau Developer
  const canViewSinRegistros = useMemo(() => {
    if (!authUser) return false;
    const grupo = (authUser.GRUPO || authUser.grupo || '').toString().trim().toUpperCase();
    return grupo === 'ADMIN' || grupo === 'SUPERVISOR' || grupo === 'DEVELOPER';
  }, [authUser]);

  // Cargar datos cuando cambia el mes o el tipo de reporte
  useEffect(() => {
    console.log('🔍 HorasTrabajadas useEffect triggered with:', { selectedMes, tipoReporte, empleadoId, soloEmpleado });
    
    let cancelled = false;
    
    const loadResumen = async () => {
      setLoading(true);
      setChangingMonth(true);
      try {
        console.log('🔍 ===== COMPONENT DEBUG HORAS TRABAJADAS =====');
        console.log('🔍 About to call fetchResumen with params:', { selectedMes, tipoReporte, empleadoId, soloEmpleado });
        
        // fetchResumen se ocupă de verificarea duplicate requests intern
        // Dacă există deja un request în flight, va returna promise-ul existent
        const data = await fetchResumen(
          selectedMes,
          tipoReporte,
          { handleApiError, handleNetworkError },
          empleadoId,
          soloEmpleado,
          codigo,
          empleadoNombre
        );
        
        // Verifică dacă componenta a fost unmount sau dependencies s-au schimbat
        if (cancelled) {
          console.log('🔁 Request completed but component was cancelled, ignoring result');
          return;
        }
        
        console.log('🔍 ===== DATA RECEIVED IN COMPONENT =====');
        console.log('🔍 Data received from fetchResumen:', data);
        console.log('🔍 Data length:', data.length, 'items');
        
        if (data && data.length > 0) {
          console.log('🔍 First item in component:', data[0]);
        } else {
          console.log('⚠️ No data received or empty array!');
        }
        
        setResumenData(data);
        console.log('🔍 ===== END COMPONENT DEBUG =====');
      } catch (error) {
        if (cancelled) {
          console.log('🔁 Request failed but component was cancelled, ignoring error');
          return;
        }
        console.error('Error loading resumen:', error);
        handleApiError(error, 'HorasTrabajadas - loadResumen');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setChangingMonth(false);
        }
      }
    };

    loadResumen();
    
    // Cleanup: marchează că request-ul a fost anulat
    return () => {
      cancelled = true;
      console.log('🔁 useEffect cleanup: cancelled request');
    };
  }, [selectedMes, tipoReporte, empleadoId, soloEmpleado, codigo, empleadoNombre, handleApiError, handleNetworkError]);

  // Închide dropdown-ul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMonthSelector && !(event.target as Element).closest('.month-selector')) {
        setShowMonthSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthSelector]);

  const handleVerDetalle = async (empleadoId: number) => {
    setLoading(true);
    try {
      const parseOptionalNumber = (value: unknown) => {
        if (value === undefined || value === null || value === '') return undefined;
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);
        return isNaN(num) ? undefined : num;
      };

      // Găsește datele angajatului din lista principală
      const empleado = resumenData.find(emp => emp.empleadoId === empleadoId);
      if (!empleado) {
        console.error('Empleado not found in resumen data');
        return;
      }
      
      // Creează detalle cu datele reale din lista principală
      const detalle: DetalleEmpleado = {
        empleadoId: empleado.empleadoId,
        empleadoNombre: empleado.empleadoNombre,
        mes: selectedMes,
        horasTrabajadas: typeof empleado.horasTrabajadas === 'number' ? empleado.horasTrabajadas : parseFloat(String(empleado.horasTrabajadas)) || 0,
        horasContrato: typeof empleado.horasContrato === 'number' ? empleado.horasContrato : parseFloat(String(empleado.horasContrato)) || 0,
        horasExtra: typeof empleado.horasExtra === 'number' ? empleado.horasExtra : parseFloat(String(empleado.horasExtra)) || 0,
        mediaSemanalAnual: (typeof empleado.horasTrabajadas === 'number' ? empleado.horasTrabajadas : parseFloat(String(empleado.horasTrabajadas)) || 0) / 4.33,
        dias: [], // Se va popula cu datele reale din backend
        // Date suplimentare pentru tab-ul de detalii
        grupo: empleado.grupo,
        centroTrabajo: empleado.centroTrabajo,
        tipoContrato: empleado.tipoContrato,
        fuente: empleado.fuente || empleado.fuenteAnual,
        fuenteAnual: empleado.fuenteAnual,
        estadoPlanHastaHoy: empleado.estadoPlanHastaHoy,
        estadoPlan: empleado.estadoPlan,
        estadoPermitidas: empleado.estadoPermitidas,
        totalOrdinarias: empleado.totalOrdinarias,
        totalComplementarias: empleado.totalComplementarias,
        totalExtraordinarias: empleado.totalExtraordinarias,
        totalTrabajadas: empleado.totalTrabajadas,
        totalPlan: empleado.totalPlan,
        totalPermitidas: empleado.totalPermitidas,
        planHastaHoy: empleado.planHastaHoy,
        diffPlanHastaHoy: empleado.diffPlanHastaHoy,
        diffPlanMensual: empleado.diffPlanMensual,
        diffPermitidas: empleado.diffPermitidas,
        horasContratoMes: empleado.horasContratoMes,
        horasTrabajadasMes: empleado.horasTrabajadasMes,
        horasMensualesPermitidas: empleado.horasMensualesPermitidas,
        horasCuadranteMes: empleado.horasCuadranteMes,
        horasHorarioMes: empleado.horasHorarioMes,
        horasMes: empleado.horasMes,
        centroCuadrante: empleado.centroCuadrante,
        detaliiZilnice: empleado.detaliiZilnice,
        horasCuadranteAnual: parseOptionalNumber(empleado.horasCuadranteAnual),
        horasHorarioAnual: parseOptionalNumber(empleado.horasHorarioAnual),
        horasTrabajadasAnual: empleado.horasTrabajadasAnual !== undefined
          ? empleado.horasTrabajadasAnual
          : (typeof empleado.totalTrabajadas === 'number'
              ? empleado.totalTrabajadas
              : parseOptionalNumber(empleado.totalTrabajadas) ?? undefined),
        horasContratoAnual: parseOptionalNumber(
          empleado.horasContratoAnual ?? empleado.totalPlan ?? empleado.horasContrato
        ),
        horasPlanAnual: parseOptionalNumber(
          empleado.horasPlanAnual ?? empleado.totalPlan ?? empleado.horasContratoAnual ?? empleado.horasContrato
        ),
        horasPermitidasAnual: parseOptionalNumber(empleado.horasPermitidasAnual ?? empleado.totalPermitidas),
        mesesConCuadrante: empleado.mesesConCuadrante,
        mesesConHorario: empleado.mesesConHorario,
        mesesMixtos: empleado.mesesMixtos
      };
      
      // Adaugă datele reale din backend pentru registrele zilnice
      try {
        const detalleBackend = await fetchDetalle(
          empleadoId,
          selectedMes,
          empleado.empleadoNombre,
          tipoReporte,
          (empleado as ResumenEmpleado & { codigo?: string; CODIGO?: string }).codigo || 
          (empleado as ResumenEmpleado & { codigo?: string; CODIGO?: string }).CODIGO || 
          String(empleado.empleadoId)
        );
        const mergedDetalle: DetalleEmpleado = {
          ...detalle,
          ...detalleBackend,
          dias: detalleBackend.dias,
          detaliiZilnice: (() => {
            type DetalleExtended = DetalleEmpleado & { detalii_zilnice?: DetalleEmpleado['detaliiZilnice'] };
            const detalleExt = detalleBackend as DetalleExtended;
            return detalleExt.detaliiZilnice || detalleExt.detalii_zilnice || detalle.detaliiZilnice || [];
          })(),
          // Prioritate pentru datele mensual din backend
          horasTrabajadasMes: detalleBackend.horasTrabajadasMes ?? detalle.horasTrabajadasMes,
          horasMensualesPermitidas: detalleBackend.horasMensualesPermitidas ?? detalle.horasMensualesPermitidas,
          horasCuadranteMes: detalleBackend.horasCuadranteMes ?? detalle.horasCuadranteMes,
          horasHorarioMes: detalleBackend.horasHorarioMes ?? detalle.horasHorarioMes,
          horasMes: detalleBackend.horasMes ?? detalle.horasMes,
          horasContratoMes: detalleBackend.horasContratoMes ?? detalle.horasContratoMes,
          difVsContrato: detalleBackend.difVsContrato ?? detalle.difVsContrato,
          difVsPermitidas: detalleBackend.difVsPermitidas ?? detalle.difVsPermitidas
        };
        if (!mergedDetalle.mesesConCuadrante && detalleBackend.mesesConCuadrante !== undefined) {
          mergedDetalle.mesesConCuadrante = detalleBackend.mesesConCuadrante;
        }
        if (!mergedDetalle.mesesConHorario && detalleBackend.mesesConHorario !== undefined) {
          mergedDetalle.mesesConHorario = detalleBackend.mesesConHorario;
        }
        if (!mergedDetalle.mesesMixtos && detalleBackend.mesesMixtos !== undefined) {
          mergedDetalle.mesesMixtos = detalleBackend.mesesMixtos;
        }
        if (!mergedDetalle.fuente && detalleBackend.fuenteAnual) {
          mergedDetalle.fuente = detalleBackend.fuenteAnual;
        }
        mergedDetalle.fuenteAnual = mergedDetalle.fuenteAnual || detalleBackend.fuenteAnual || detalleBackend.fuente || mergedDetalle.fuente;
          mergedDetalle.horasCuadranteAnual = parseOptionalNumber(
          (() => {
            type DetalleExtended = DetalleEmpleado & { horas_cuadrante_anual?: number | string };
            const detalleExt = detalleBackend as DetalleExtended;
            return mergedDetalle.horasCuadranteAnual ?? detalleExt.horasCuadranteAnual ?? detalleExt.horas_cuadrante_anual;
          })()
        );
        mergedDetalle.horasHorarioAnual = parseOptionalNumber(
          (() => {
            type DetalleExtended = DetalleEmpleado & { horas_horario_anual?: number | string };
            const detalleExt = detalleBackend as DetalleExtended;
            return mergedDetalle.horasHorarioAnual ?? detalleExt.horasHorarioAnual ?? detalleExt.horas_horario_anual;
          })()
        );
        mergedDetalle.horasTrabajadasAnual = mergedDetalle.horasTrabajadasAnual
          ?? detalleBackend.horasTrabajadasAnual
          ?? detalleBackend.horasTrabajadas
          ?? detalleBackend.totalTrabajadas;
        mergedDetalle.horasContratoAnual = parseOptionalNumber(
          mergedDetalle.horasContratoAnual
            ?? detalleBackend.horasContratoAnual
            ?? (() => {
              type DetalleExtended = DetalleEmpleado & { horas_contrato_anual?: number | string };
              return (detalleBackend as DetalleExtended).horas_contrato_anual;
            })()
            ?? detalleBackend.totalPlanAnual
            ?? detalleBackend.totalPlan
            ?? mergedDetalle.horasContrato
        );
        mergedDetalle.horasPlanAnual = parseOptionalNumber(
          mergedDetalle.horasPlanAnual
            ?? detalleBackend.horasPlanAnual
            ?? detalleBackend.totalPlanAnual
            ?? detalleBackend.totalPlan
            ?? mergedDetalle.horasContratoAnual
        );
        mergedDetalle.horasPermitidasAnual = parseOptionalNumber(
          (() => {
            type DetalleExtended = DetalleEmpleado & { horas_permitidas_interval?: number | string };
            const detalleExt = detalleBackend as DetalleExtended;
            return mergedDetalle.horasPermitidasAnual ?? detalleExt.horasPermitidasAnual ?? detalleExt.horas_permitidas_interval ?? detalleBackend.totalPermitidasAnual ?? detalleBackend.totalPermitidas;
          })()
        );
        console.log('🔍 Detalle backend merged:', mergedDetalle);
        setDetalleData(mergedDetalle);
        setDrawerOpen(true);
        return;
      } catch (error) {
        console.error('Error fetching daily details, using empty array:', error);
        handleApiError(error, 'HorasTrabajadas - fetchDetalle');
        detalle.dias = [];
      }
      detalle.fuente = detalle.fuente || detalle.fuenteAnual;
      
      console.log('🔍 Detalle completo creado:', detalle);
      
      let finalDetalle = detalle;
      try {
        const registros = await fetchRegistrosEmpleado(
          (empleado as ResumenEmpleado & { codigo?: string; CODIGO?: string }).codigo || 
          (empleado as ResumenEmpleado & { codigo?: string; CODIGO?: string }).CODIGO || 
          String(empleado.empleadoId),
          tipoReporte === 'mensual' ? selectedMes : undefined,
          empleado.empleadoNombre
        );
        if (registros.length > 0) {
          finalDetalle = {
            ...finalDetalle,
            dias: registros
          };
        }
      } catch (regError) {
        console.warn('⚠️ fetchRegistrosEmpleado fallback (detalle base):', regError);
      }

      setDetalleData(finalDetalle);
      setDrawerOpen(true);
    } catch (error) {
      console.error('Error loading detalle:', error);
      handleApiError(error, 'HorasTrabajadas - loadDetalle');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setDetalleData(null);
  };

  const handleDescargarPDF = async (empleadoId: number, mes: string) => {
    try {
      await descargarPDF(empleadoId, mes);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  // Funcție pentru a normaliza datele (similar cu Fichaje.jsx)
  const normalizeDateInput = (dateStr: string): string | null => {
    if (!dateStr) return null;
    // Dacă este deja în format ISO (YYYY-MM-DD), returnează direct
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Încearcă să parseze alte formate
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  // Funcție pentru a verifica dacă un angajat este în baja médica activă
  const isEmpleadoEnBajaMedica = (codigo: string, bajasMedicas: BajaMedica[]): boolean => {
    if (!bajasMedicas || bajasMedicas.length === 0) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bajaActiva = bajasMedicas.find((baja: BajaMedica) => {
      // Verifică dacă baja este pentru acest angajat
      const bajaCodigo = String(baja.CODIGO || baja.codigo || baja.Codigo_Empleado || baja.codigoEmpleado || '').trim();
      if (bajaCodigo !== codigo) return false;
      
      const fechaInicio = baja.fecha_inicio || baja.fechaInicio || baja.FECHA_INICIO || baja['Fecha baja'] || baja['Fecha Baja'] || baja['Fecha de baja'] || baja.fecha_baja || baja.fechaBaja || baja['FECHA BAJA'] || baja.fechaBaja || '';
      const fechaFin = baja.fecha_fin || baja.fechaFin || baja.FECHA_FIN || baja['Fecha de alta'] || baja['Fecha de Alta'] || baja['Fecha alta'] || baja['Fecha Alta'] || baja.fecha_alta || baja.fechaAlta || baja['FECHA ALTA'] || '';
      
      if (!fechaInicio) return false;
      
      const inicio = normalizeDateInput(fechaInicio);
      const fin = fechaFin ? normalizeDateInput(fechaFin) : null;
      
      if (!inicio) return false;
      
      const inicioDate = new Date(inicio);
      inicioDate.setHours(0, 0, 0, 0);
      
      // Dacă există fechaFin (fecha_alta), verifică dacă este în trecut
      if (fin) {
        const finDate = new Date(fin);
        finDate.setHours(0, 0, 0, 0);
        
        // Dacă fechaFin este în trecut, baja médica nu este activă
        if (today > finDate) {
          return false;
        }
        
        // Verifică dacă ziua curentă este în intervalul [inicio, fin] (inclusiv fin)
        return today >= inicioDate && today <= finDate;
      } else {
        // Dacă nu există fechaFin, consideră activă până în prezent
        return today >= inicioDate;
      }
    });
    
    return !!bajaActiva;
  };

  // Funcție pentru a identifica angajații fără registre până la data curentă
  const handleBuscarSinRegistros = async () => {
    setLoadingSinRegistros(true);
    setShowSinRegistrosModal(true);
    
    try {
      // Obține lista completă de angajați
      const resultEmpleados = await callApi(routes.getEmpleados);
      
      if (!resultEmpleados.success || !resultEmpleados.data) {
        setEmpleadosSinRegistros([]);
        setLoadingSinRegistros(false);
        return;
      }
      
      const allEmpleados = Array.isArray(resultEmpleados.data) ? resultEmpleados.data : [resultEmpleados.data];
      
      // Obține lista de bajas médicas pentru toți angajații
      let bajasMedicas: BajaMedica[] = [];
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(routes.getBajasMedicas, {
          method: 'GET',
          headers: headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          bajasMedicas = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.warn('Error fetching bajas médicas (continuando sin filtrar):', error);
        // Continuăm fără să filtrăm după baja médica dacă nu putem obține datele
      }
      
      // Data curentă
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Obține anul și luna curentă din selectedMes
      const [year, month] = selectedMes.split('-');
      
      // Obține log-urile pentru toți angajații (pentru a găsi ultimul log)
      let allLogs: ActivityLog[] = [];
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const logsUrl = import.meta.env.DEV
          ? 'http://localhost:3000/api/activity-logs'
          : 'https://api.decaminoservicios.com/api/activity-logs';
        
        const logsResponse = await fetch(`${logsUrl}?limit=10000`, {
          method: 'GET',
          headers: headers,
        });
        
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          allLogs = Array.isArray(logsData.logs) ? logsData.logs : (Array.isArray(logsData) ? logsData : []);
        }
      } catch (error) {
        console.warn('Error fetching activity logs (continuando sin logs):', error);
        // Continuăm fără log-uri dacă nu putem obține datele
      }
      
      // Filtrează angajații care nu au registre până la data curentă
      const sinRegistros = allEmpleados.filter((emp: EmpleadoRaw) => {
        const codigo = String(emp.CODIGO || emp.codigo || '').trim();
        if (!codigo) return false;
        
        // Exclude angajații inactivi (doar includem cei cu ESTADO === 'ACTIVO')
        const estado = (emp.ESTADO || emp.estado || '').toString().trim().toUpperCase();
        if (estado !== 'ACTIVO') {
          return false;
        }
        
        // Exclude anumite grupuri care nu necesită registre de fichaje
        const grupo = (emp.GRUPO || emp.grupo || '').toString().trim().toUpperCase();
        const gruposExcluidos = ['ADMIN', 'DEVELOPER', 'MANAGER', 'SUPERVISOR'];
        if (gruposExcluidos.includes(grupo)) {
          return false;
        }
        
        // Exclude angajații care sunt în baja médica activă
        if (isEmpleadoEnBajaMedica(codigo, bajasMedicas)) {
          return false;
        }
        
        // Caută angajatul în resumenData
        const resumenEmpleado = resumenData.find(r => String(r.empleadoId) === codigo);
        
        // Dacă nu apare în resumenData, nu are registre
        if (!resumenEmpleado) {
          return true;
        }
        
        // Verifică dacă are detalii zilnice cu registre până la data curentă
        if (resumenEmpleado.detaliiZilnice && resumenEmpleado.detaliiZilnice.length > 0) {
          // Verifică dacă are cel puțin o zi cu fichado > 0 până la data curentă
          const tieneRegistros = resumenEmpleado.detaliiZilnice.some((detalle: DetalleZilnic) => {
            const fechaDetalle = detalle.fecha;
            // Compară doar zilele din luna curentă până la data curentă
            if (fechaDetalle && fechaDetalle.startsWith(`${year}-${month}`)) {
              const fechaDate = new Date(fechaDetalle);
              fechaDate.setHours(0, 0, 0, 0);
              if (fechaDate <= today) {
                const fichado = detalle.fichado || 0;
                return fichado > 0;
              }
            }
            return false;
          });
          
          return !tieneRegistros;
        }
        
        // Verifică dacă horasTrabajadas este 0 sau null
        const horasTrabajadas = resumenEmpleado.horasTrabajadas || resumenEmpleado.totalTrabajadas || 0;
        const horasNum = typeof horasTrabajadas === 'string' 
          ? (horasTrabajadas.includes(':') ? parseFloat(horasTrabajadas.split(':')[0]) : parseFloat(horasTrabajadas))
          : (Number(horasTrabajadas) || 0);
        
        return horasNum === 0;
      }).map((emp: EmpleadoRaw) => {
        const codigo = String(emp.CODIGO || emp.codigo || '').trim();
        const nombre = emp['NOMBRE / APELLIDOS'] || emp.NOMBRE || emp.nombre || 'Sin nombre';
        const email = emp['CORREO ELECTRONICO'] || emp.correo || emp.email || '';
        
        // Găsește ultimul log pentru acest angajat (după email sau nume)
        const logsEmpleado = allLogs.filter((log: ActivityLog) => {
          const logEmail = (log.email || '').toString().trim().toLowerCase();
          const logUser = (log.user || '').toString().trim();
          const empEmailLower = email.toLowerCase();
          const empNombreLower = nombre.toLowerCase();
          
          return (
            (logEmail && logEmail === empEmailLower) ||
            (logUser && logUser.toLowerCase().includes(empNombreLower)) ||
            (logUser && empNombreLower.includes(logUser.toLowerCase()))
          );
        });
        
        // Sortează după timestamp desc și ia primul (ultimul log)
        const ultimoLog = logsEmpleado.length > 0
          ? logsEmpleado.sort((a: ActivityLog, b: ActivityLog) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            })[0]
          : null;
        
        return {
          codigo,
          nombre,
          grupo: emp.GRUPO || emp.grupo || '',
          ultimoLog: ultimoLog ? {
            timestamp: ultimoLog.timestamp,
            action: ultimoLog.action || 'unknown',
            url: ultimoLog.url
          } : null
        };
      });
      
      setEmpleadosSinRegistros(sinRegistros);
    } catch (error) {
      console.error('Error fetching empleados sin registros:', error);
      setEmpleadosSinRegistros([]);
    } finally {
      setLoadingSinRegistros(false);
    }
  };

  const handleExportPDF = async () => {
    if (!empleadosSinRegistros || empleadosSinRegistros.length === 0) {
      alert('No hay datos para exportar a PDF.');
      return;
    }

    try {
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

      const today = new Date();
      const formattedDate = today.toLocaleDateString('es-ES');
      const formattedMonth = new Date(selectedMes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      const tableBody = [
        [{ text: 'Nº', style: 'tableHeader' }, { text: 'Nombre', style: 'tableHeader' }, { text: 'Código', style: 'tableHeader' }, { text: 'Grupo', style: 'tableHeader' }]
      ];

      empleadosSinRegistros.forEach((emp, index) => {
        tableBody.push([
          { text: (index + 1).toString(), style: 'tableCell' },
          { text: emp.nombre, style: 'tableCell' },
          { text: emp.codigo, style: 'tableCell' },
          { text: emp.grupo || '', style: 'tableCell' }
        ]);
      });

      const docDefinition = {
        content: [
          { text: 'DE CAMINO SERVICIOS AUXILIARES', style: 'companyName' },
          { text: 'Reporte de Empleados Sin Registros', style: 'reportTitle' },
          { text: `Período: ${formattedMonth} hasta ${formattedDate}`, style: 'period' },
          { text: `Total de empleados sin registros: ${empleadosSinRegistros.length}`, style: 'totalCount', margin: [0, 10, 0, 10] },
          {
            table: {
              headerRows: 1,
              widths: [30, '*', 80, 100],
              body: tableBody
            },
            layout: {
              fillColor: function (rowIndex: number) {
                return (rowIndex % 2 === 0) ? '#F9F9F9' : null;
              }
            }
          }
        ],
        styles: {
          companyName: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
          reportTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
          period: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 10] },
          totalCount: { fontSize: 12, bold: true, alignment: 'left', margin: [0, 0, 0, 5] },
          tableHeader: { fontSize: 10, bold: true, fillColor: '#EEEEEE', alignment: 'center', padding: [5, 5, 5, 5] },
          tableCell: { fontSize: 9, alignment: 'left', padding: [5, 5, 5, 5] }
        },
        defaultStyle: {
          columnGap: 20,
        }
      };

      const filename = `empleados_sin_registros_${selectedMes.replace('-', '_')}.pdf`;
      window.pdfMake.createPdf(docDefinition).download(filename);

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF. Por favor, inténtalo de nuevo.');
    }
  };

  const handleExportExcel = async () => {
    if (!empleadosSinRegistros || empleadosSinRegistros.length === 0) {
      alert('No hay datos para exportar a Excel.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Empleados Sin Registros');

      // Header
      worksheet.mergeCells('A1:D1');
      worksheet.getCell('A1').value = 'DE CAMINO SERVICIOS AUXILIARES';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:D2');
      worksheet.getCell('A2').value = 'Reporte de Empleados Sin Registros';
      worksheet.getCell('A2').font = { bold: true, size: 14 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      const today = new Date();
      const formattedDate = today.toLocaleDateString('es-ES');
      const formattedMonth = new Date(selectedMes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      worksheet.mergeCells('A3:D3');
      worksheet.getCell('A3').value = `Período: ${formattedMonth} hasta ${formattedDate}`;
      worksheet.getCell('A3').font = { size: 10 };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:D4');
      worksheet.getCell('A4').value = `Total de empleados sin registros: ${empleadosSinRegistros.length}`;
      worksheet.getCell('A4').font = { bold: true, size: 12 };
      worksheet.getCell('A4').alignment = { horizontal: 'left' };
      worksheet.getRow(4).height = 20; // Add some padding

      // Table Headers
      worksheet.getRow(6).values = ['Nº', 'Nombre', 'Código', 'Grupo'];
      worksheet.getRow(6).font = { bold: true, size: 10 };
      worksheet.getRow(6).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEEDED' } // Light gray
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'center' };
      });

      // Data Rows
      empleadosSinRegistros.forEach((emp, index) => {
        worksheet.addRow([index + 1, emp.nombre, emp.codigo, emp.grupo || '']);
        worksheet.lastRow.eachCell((cell) => {
          cell.font = { size: 9 };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Adjust column widths
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      const filename = `empleados_sin_registros_${selectedMes.replace('-', '_')}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error al exportar Excel. Por favor, inténtalo de nuevo.');
    }
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: isMobile ? '12px' : '24px', gap: isMobile ? '12px' : '0' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.5rem', fontWeight: 600 }}>
            Horas Trabajadas
          </Title>
          <Text style={{ color: '#777', fontSize: isMobile ? '11px' : '14px' }}>
            {tablaActiva === 'resumen'
              ? (tipoReporte === 'mensual' 
                  ? (isMobile ? 'Resumen mensual' : 'Resumen mensual de horas trabajadas por empleado')
                  : (isMobile ? 'Resumen anual' : 'Resumen anual de horas trabajadas por empleado'))
              : (isMobile ? 'Alertas' : 'Visor de alertas por empleado (días con excedentes positivos o negativos)')}
          </Text>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-col md:flex-row md:items-center'} gap-2`}>
          <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl ${isMobile ? 'p-0.5' : 'p-1'}`}>
            <button
              onClick={() => setTablaActiva('resumen')}
              className={`${isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-sm'} font-medium rounded-lg transition-all duration-200 ${
                tablaActiva === 'resumen'
                  ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {isMobile ? '📊 Res.' : '📊 Resumen'}
            </button>
            <button
              onClick={() => setTablaActiva('alertas')}
              className={`${isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-sm'} font-medium rounded-lg transition-all duration-200 ${
                tablaActiva === 'alertas'
                  ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              {isMobile ? '⚠️ Alert.' : '⚠️ Alertas'}
            </button>
          </div>
          {/* Buton Registros Anuales */}
          <button
            onClick={() => setTipoReporte(tipoReporte === 'mensual' ? 'anual' : 'mensual')}
            className={`${isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-4 py-2 text-sm'} rounded-lg font-medium transition-all duration-300 ${
              tipoReporte === 'anual'
                ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            📊 {isMobile ? (tipoReporte === 'mensual' ? 'Reg. Anual' : 'Reg. Mensual') : (tipoReporte === 'mensual' ? 'Registros Anuales' : 'Registros Mensuales')}
          </button>
          <div className="relative month-selector">
            <button
              onClick={() => setShowMonthSelector(!showMonthSelector)}
              disabled={changingMonth}
              className={`flex items-center gap-1.5 ${isMobile ? 'rounded-lg px-2 py-1.5' : 'rounded-xl px-4 py-2'} transition-all duration-300 ${
                changingMonth 
                  ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 cursor-not-allowed' 
                  : 'bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 cursor-pointer'
              }`}
            >
              {changingMonth ? (
                <div className={`animate-spin rounded-full ${isMobile ? 'h-3 w-3 border-b' : 'h-4 w-4 border-b-2'} border-blue-600 dark:border-blue-400`}></div>
              ) : (
                <span className={`text-blue-600 dark:text-blue-400 ${isMobile ? 'text-xs' : ''}`}>📅</span>
              )}
              <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium transition-colors ${
                changingMonth ? 'text-blue-500 dark:text-blue-400' : 'text-blue-700 dark:text-blue-300'
              }`}>
                {tipoReporte === 'mensual' 
                  ? (selectedMes ? (isMobile 
                      ? new Date(selectedMes + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
                      : new Date(selectedMes + '-01').toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })) 
                    : (isMobile ? 'Mes' : 'Seleccionar mes'))
                  : (selectedMes ? selectedMes.split('-')[0] : (isMobile ? 'Año' : 'Seleccionar año'))
                }
              </span>
              <span className={`${isMobile ? 'text-[8px]' : 'text-sm'} transition-colors ${changingMonth ? 'text-blue-400' : 'text-blue-500 dark:text-blue-400'}`}>
                {changingMonth ? '⏳' : showMonthSelector ? '▲' : '▼'}
              </span>
            </button>
            
            {/* Dropdown selector */}
            {showMonthSelector && !changingMonth && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
                <div className="p-3">
                  {tipoReporte === 'mensual' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = new Date(new Date().getFullYear(), i).toLocaleDateString('es-ES', { month: 'short' });
                          const monthValue = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedMes(monthValue);
                                setShowMonthSelector(false);
                              }}
                              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                selectedMes === monthValue 
                                  ? 'bg-blue-100 text-blue-700 font-semibold' 
                                  : 'hover:bg-gray-100 text-gray-700'
                              }`}
                            >
                              {month}
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* Anul selector */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Año:</span>
                          <select
                            value={selectedMes ? selectedMes.split('-')[0] : new Date().getFullYear()}
                            onChange={(e) => {
                              const year = e.target.value;
                              const month = selectedMes ? selectedMes.split('-')[1] : String(new Date().getMonth() + 1).padStart(2, '0');
                              setSelectedMes(`${year}-${month}`);
                            }}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - 2 + i;
                              return (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Selector pentru anul când este raport anual */
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 mb-2">Seleccionar año:</div>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        const yearValue = `${year}-01`;
                        return (
                          <button
                            key={year}
                            onClick={() => {
                              setSelectedMes(yearValue);
                              setShowMonthSelector(false);
                            }}
                            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                              selectedMes.split('-')[0] === year.toString()
                                ? 'bg-orange-100 text-orange-700 font-semibold' 
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mesaj de feedback pentru schimbarea lunii */}
      {changingMonth && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm font-medium">
              Cargando datos {tipoReporte === 'mensual' ? 'para' : 'del año'} {tipoReporte === 'mensual' ? selectedMes : selectedMes.split('-')[0]}...
            </span>
          </div>
        </div>
      )}

      {/* Buton pentru angajații fără registre - doar pentru Admin și Supervisor */}
      {canViewSinRegistros && (
        <div className={`mb-3 ${isMobile ? 'px-0' : ''}`}>
          <button
            onClick={handleBuscarSinRegistros}
            className={`w-full ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg text-orange-700 dark:text-orange-300 font-medium hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-2`}
          >
            <span>⚠️</span>
            <span>{isMobile ? 'Sin Registros' : 'Ver Empleados Sin Registros'}</span>
          </button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className={`mb-3 ${isMobile ? 'px-0' : ''}`}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={isMobile ? "Buscar..." : "Buscar por nombre, código, estado..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isMobile ? 'pl-9 pr-8 py-2 text-sm' : 'pl-10 pr-9 py-2.5'} border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchTerm && (
          <div className={`mt-1.5 ${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
            {(() => {
              const filtered = resumenData.filter(emp => {
                const searchLower = searchTerm.toLowerCase();
                return (
                  emp.empleadoNombre?.toLowerCase().includes(searchLower) ||
                  String(emp.empleadoId).includes(searchLower) ||
                  emp.estado?.toLowerCase().includes(searchLower) ||
                  emp.grupo?.toLowerCase().includes(searchLower) ||
                  emp.centroTrabajo?.toLowerCase().includes(searchLower) ||
                  emp.tipoContrato?.toLowerCase().includes(searchLower)
                );
              });
              return `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;
            })()}
          </div>
        )}
      </div>

      {/* Tabla de resumen / alertas */}
      <Card>
        {tablaActiva === 'resumen' ? (
          <EmployeeMonthlyTable 
            data={(() => {
              if (!searchTerm) return resumenData;
              const searchLower = searchTerm.toLowerCase();
              return resumenData.filter(emp => {
                return (
                  emp.empleadoNombre?.toLowerCase().includes(searchLower) ||
                  String(emp.empleadoId).includes(searchLower) ||
                  emp.estado?.toLowerCase().includes(searchLower) ||
                  emp.grupo?.toLowerCase().includes(searchLower) ||
                  emp.centroTrabajo?.toLowerCase().includes(searchLower) ||
                  emp.tipoContrato?.toLowerCase().includes(searchLower)
                );
              });
            })()} 
            onVerDetalle={handleVerDetalle}
            loading={loading}
            isMobile={isMobile}
          />
        ) : (
          <EmployeeAlertsTable
            data={(() => {
              if (!searchTerm) return resumenData;
              const searchLower = searchTerm.toLowerCase();
              return resumenData.filter(emp => {
                return (
                  emp.empleadoNombre?.toLowerCase().includes(searchLower) ||
                  String(emp.empleadoId).includes(searchLower) ||
                  emp.estado?.toLowerCase().includes(searchLower) ||
                  emp.grupo?.toLowerCase().includes(searchLower) ||
                  emp.centroTrabajo?.toLowerCase().includes(searchLower) ||
                  emp.tipoContrato?.toLowerCase().includes(searchLower)
                );
              });
            })()}
            onVerDetalle={handleVerDetalle}
            onDescargarPDF={handleDescargarPDF}
            loading={loading}
            isMobile={isMobile}
          />
        )}
      </Card>

      {/* Drawer de detalle */}
      <EmployeeDetailDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        detalle={detalleData}
        onDescargarPDF={handleDescargarPDF}
        loading={loading}
        tipoReporte={tipoReporte}
        isMobile={isMobile}
      />

      {/* Modal pentru angajații fără registre */}
      <Modal isOpen={showSinRegistrosModal} onClose={() => setShowSinRegistrosModal(false)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-800 dark:text-gray-200`}>
              Empleados Sin Registros
            </h2>
            <button
              onClick={() => setShowSinRegistrosModal(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 mb-4`}>
            Empleados que no tienen ningún registro en {selectedMes ? new Date(selectedMes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'el mes actual'} hasta la fecha actual ({new Date().toLocaleDateString('es-ES')}).
          </div>

          {loadingSinRegistros ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <span className="ml-2 text-gray-600">Cargando...</span>
            </div>
          ) : empleadosSinRegistros.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">✅</div>
              <div className={`${isMobile ? 'text-sm' : 'text-base'} font-medium`}>
                Todos los empleados tienen registros
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400`}>
                  Total: <span className="font-semibold text-orange-600 dark:text-orange-400">{empleadosSinRegistros.length}</span> empleado{empleadosSinRegistros.length !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportPDF}
                    className={`${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5`}
                    title="Exportar PDF"
                  >
                    <svg className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {!isMobile && <span>PDF</span>}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className={`${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5`}
                    title="Exportar Excel"
                  >
                    <svg className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {!isMobile && <span>Excel</span>}
                  </button>
                </div>
              </div>
              <div className={`max-h-96 overflow-y-auto space-y-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {empleadosSinRegistros.map((emp, index) => (
                  <div
                    key={emp.codigo || index}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 dark:text-orange-400 font-semibold">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {emp.nombre}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Código: {emp.codigo}
                        {emp.grupo && ` • Grupo: ${emp.grupo}`}
                      </div>
                      {emp.ultimoLog ? (
                        <div className="mt-1 text-gray-500 dark:text-gray-500 text-[10px]">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Último log: {new Date(emp.ultimoLog.timestamp).toLocaleDateString('es-ES', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} ({emp.ultimoLog.action})
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 text-gray-400 dark:text-gray-600 text-[10px]">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            Sin logs en la aplicación
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default HorasTrabajadas;
