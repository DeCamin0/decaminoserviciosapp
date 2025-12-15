import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from './ui';
import EmployeeMonthlyTable from './EmployeeMonthlyTable';
import EmployeeDetailDrawer from './EmployeeDetailDrawer';
import EmployeeAlertsTable from './EmployeeAlertsTable';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { routes } from '../utils/routes';

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

interface SpaceProps {
  children: React.ReactNode;
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

const Space = ({ children, className, ...props }: SpaceProps) => (
  <div className={`flex gap-2 ${className || ''}`} {...props}>{children}</div>
);

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
      const parseOptionalNumber = (value: any) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);
        return isNaN(num) ? undefined : num;
      };

      const mapItemToResumen = (item: any, mesParam: string, tipoParam: 'mensual' | 'anual', empleadoIdParam?: number, empleadoNombreParam?: string) => {
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
          const sumaExcedente = item.detalii_zilnice.reduce((sum: number, detalle: any) => {
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
      // Folosim endpoint-ul de producție
      const baseUrl = import.meta.env.DEV 
        ? '/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5'
        : 'https://n8n.decaminoservicios.com/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5';
      const params = new URLSearchParams({
        tipo: 'detallemensual',
        empleadoId: codigo,
        empleadoNombre: empleadoNombre, // URLSearchParams face encoding automat
        mes: mes,
        lunaselectata: mes
      });
      url = `${baseUrl}?${params.toString()}`;
    } else {
      // Endpoint pentru detalleanual
      const baseUrl = import.meta.env.DEV 
        ? '/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b'
        : 'https://n8n.decaminoservicios.com/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b';
      const params = new URLSearchParams({
        tipo: 'detalleanual',
        empleadoId: String(empleadoId),
        empleadoNombre: empleadoNombre, // URLSearchParams face encoding automat
        ano: mes.split('-')[0],
        codigo: codigoEmpleado || String(empleadoId)
      });
      url = `${baseUrl}?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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
        const normalizeField = (value: any, fallback = '--:--') => {
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
        const dias = data.detalii_zilnice.map((detalle: any) => {
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
        
        const parseNumber = (value: any, fallback = 0) => {
          if (value === undefined || value === null || value === '') return fallback;
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? fallback : num;
        };
        
        const resultadoDetalle: DetalleEmpleado = {
          empleadoId: data.empleadoId || empleadoId,
          empleadoNombre: data.empleadoNombre || empleadoNombre,
          mes: data.luna_selectata || mes,
          horasTrabajadas: parseNumber(data.horas_trabajadas_mes ?? data.horasTrabajadas ?? data.total_trabajadas, 0),
          horasContrato: parseNumber(data.horas_contrato_mes ?? data.horasContrato ?? data.total_plan, 0),
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
            // Folosim același endpoint ca la mensual, dar cu tipo=detalleanual
            const baseUrl = import.meta.env.DEV 
              ? '/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5'
              : 'https://n8n.decaminoservicios.com/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5';
            const registrosParams = new URLSearchParams({
              tipo: 'detalleanual',
              empleadoId: codigo,
              empleadoNombre: empleadoNombre, // URLSearchParams face encoding automat
              ano: mes.split('-')[0],
              codigo: codigo
            });
            const registrosUrl = `${baseUrl}?${registrosParams.toString()}`;
            console.log('📝 Fetching registros anuales desde:', registrosUrl);
            const registrosResp = await fetch(registrosUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });

            const registrosText = await registrosResp.text();
            console.log('📝 Registros anual response length:', registrosText.length);

            if (registrosResp.ok && registrosText.trim()) {
              const registrosData = JSON.parse(registrosText);
              console.log('📝 Registros anual parsed sample:', Array.isArray(registrosData) ? registrosData.slice(0, 5) : registrosData);

              if (Array.isArray(registrosData)) {
                const registrosNormalizados = registrosData.map((item: any) => ({
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

async function fetchRegistrosEmpleado(codigo: string, mes?: string, empleadoNombre?: string) {
  if (!codigo) {
    console.warn('⚠️ fetchRegistrosEmpleado called without codigo');
    return [];
  }

  // Folosim endpoint-ul de producție (același ca fetchDetalle)
  const baseUrl = import.meta.env.DEV 
    ? '/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5'
    : 'https://n8n.decaminoservicios.com/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5';
  
  const params = new URLSearchParams({
    tipo: 'detallemensual',
    empleadoId: codigo,
    empleadoNombre: empleadoNombre || '', // URLSearchParams face encoding automat
    mes: mes || '',
    lunaselectata: mes || ''
  });

  const url = `${baseUrl}?${params.toString()}`;
  console.log('📝 fetchRegistrosEmpleado URL:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
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

  return data.map((item: any) => ({
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
}

const HorasTrabajadas: React.FC<HorasTrabajadasProps> = ({ empleadoId, soloEmpleado = false, codigo, empleadoNombre }) => {
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
  
  // Error handling
  const { handleApiError, handleNetworkError } = useErrorHandler();

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
  }, [selectedMes, tipoReporte, empleadoId, soloEmpleado, codigo, empleadoNombre]);

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
      const parseOptionalNumber = (value: any) => {
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
          (empleado as any).codigo || (empleado as any).CODIGO || String(empleado.empleadoId)
        );
        const mergedDetalle: DetalleEmpleado = {
          ...detalle,
          ...detalleBackend,
          dias: detalleBackend.dias,
          detaliiZilnice: (detalleBackend as any).detaliiZilnice
            ? (detalleBackend as any).detaliiZilnice
            : (detalleBackend as any).detalii_zilnice
              ? (detalleBackend as any).detalii_zilnice
              : (detalle.detaliiZilnice || []),
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
          mergedDetalle.horasCuadranteAnual ?? (detalleBackend as any).horasCuadranteAnual ?? (detalleBackend as any).horas_cuadrante_anual
        );
        mergedDetalle.horasHorarioAnual = parseOptionalNumber(
          mergedDetalle.horasHorarioAnual ?? (detalleBackend as any).horasHorarioAnual ?? (detalleBackend as any).horas_horario_anual
        );
        mergedDetalle.horasTrabajadasAnual = mergedDetalle.horasTrabajadasAnual
          ?? detalleBackend.horasTrabajadasAnual
          ?? detalleBackend.horasTrabajadas
          ?? detalleBackend.totalTrabajadas;
        mergedDetalle.horasContratoAnual = parseOptionalNumber(
          mergedDetalle.horasContratoAnual
            ?? detalleBackend.horasContratoAnual
            ?? (detalleBackend as any).horas_contrato_anual
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
          mergedDetalle.horasPermitidasAnual ?? detalleBackend.horasPermitidasAnual ?? (detalleBackend as any).horas_permitidas_interval ?? detalleBackend.totalPermitidasAnual ?? detalleBackend.totalPermitidas
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
          (empleado as any).codigo || (empleado as any).CODIGO || String(empleado.empleadoId),
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


  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            Horas Trabajadas
          </Title>
          <Text style={{ color: '#777', fontSize: '14px' }}>
            {tablaActiva === 'resumen'
              ? (tipoReporte === 'mensual' 
                  ? 'Resumen mensual de horas trabajadas por empleado'
                  : 'Resumen anual de horas trabajadas por empleado')
              : 'Visor de alertas por empleado (días con excedentes positivos o negativos)'}
          </Text>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTablaActiva('resumen')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                tablaActiva === 'resumen'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              📊 Resumen
            </button>
            <button
              onClick={() => setTablaActiva('alertas')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                tablaActiva === 'alertas'
                  ? 'bg-white text-red-600 shadow'
                  : 'text-gray-600 hover:text-red-600'
              }`}
            >
              ⚠️ Alertas
            </button>
          </div>
          {/* Buton Registros Anuales */}
          <button
            onClick={() => setTipoReporte(tipoReporte === 'mensual' ? 'anual' : 'mensual')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              tipoReporte === 'anual'
                ? 'bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            📊 {tipoReporte === 'mensual' ? 'Registros Anuales' : 'Registros Mensuales'}
          </button>
          <div className="relative month-selector">
            <button
              onClick={() => setShowMonthSelector(!showMonthSelector)}
              disabled={changingMonth}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 transition-all duration-300 ${
                changingMonth 
                  ? 'bg-blue-100 border border-blue-300 cursor-not-allowed' 
                  : 'bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer'
              }`}
            >
              {changingMonth ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <span className="text-blue-600">📅</span>
              )}
              <span className={`font-medium transition-colors ${
                changingMonth ? 'text-blue-500' : 'text-blue-700'
              }`}>
                {tipoReporte === 'mensual' 
                  ? (selectedMes ? new Date(selectedMes + '-01').toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long' 
                    }) : 'Seleccionar mes')
                  : (selectedMes ? selectedMes.split('-')[0] : 'Seleccionar año')
                }
              </span>
              <span className={`transition-colors ${changingMonth ? 'text-blue-400' : 'text-blue-500'}`}>
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
                          const month = new Date(2024, i).toLocaleDateString('es-ES', { month: 'short' });
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

      {/* Tabla de resumen / alertas */}
      <Card>
        {tablaActiva === 'resumen' ? (
          <EmployeeMonthlyTable 
            data={resumenData} 
            onVerDetalle={handleVerDetalle}
            loading={loading}
          />
        ) : (
          <EmployeeAlertsTable
            data={resumenData}
            onVerDetalle={handleVerDetalle}
            onDescargarPDF={handleDescargarPDF}
            loading={loading}
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
      />
    </div>
  );
};

export default HorasTrabajadas;
