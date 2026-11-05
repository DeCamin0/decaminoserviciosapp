import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../utils/routes';
import {
  authHeaders,
  countDaysInWindow,
  currentMonthKey,
  monthWindow,
  parseFechaRange,
  rangesOverlap,
  toYmd,
  ymdInRange,
} from './operativoDateUtils';

/**
 * Effective-permission gates for operational KPIs (not role names).
 * Each flag must be true before that KPI is fetched or shown.
 */
export function buildOperativoPermissionFlags(hasPermission) {
  const p = typeof hasPermission === 'function' ? hasPermission : () => false;
  return {
    /** Empleados activos — módulo empleados */
    canEmpleadosActivos: p('empleados') === true,
    /** Vacaciones / ausencias equipo — solicitudes-admin (vista de equipo) */
    canVacacionesEquipo: p('solicitudes-admin') === true,
    canAusenciasEquipo: p('solicitudes-admin') === true,
    canBajasEquipo: p('solicitudes-admin') === true,
    /** Pendientes de aprobación / regularizaciones */
    canAprobaciones: p('aprobaciones') === true,
    /** Programados hoy / pendientes fichar — fichar-admin o empleados (BE + EmpleadoGrupoScope) */
    canProgramadosFichar:
      p('fichar-admin') === true || p('empleados') === true,
  };
}

function codeOf(row) {
  return String(row?.CODIGO ?? row?.codigo ?? row?.employee_codigo ?? '').trim();
}

function filterByAllowed(rows, allowedSet) {
  if (!allowedSet) return rows;
  return (rows || []).filter((r) => {
    const c = codeOf(r);
    return c && allowedSet.has(c);
  });
}

/**
 * Resumen operativo — fetches only for granted permission flags.
 * When `empleados` is granted, estadisticas (scoped on BE) defines the allowed CODIGO set
 * used to filter solicitudes/ausencias/bajas on the client (defense in depth).
 */
export function useInicioOperativoData({
  enabled = true,
  flags = {},
  periodo = 'hoy', // 'hoy' | 'mes'
}) {
  const [loading, setLoading] = useState(false);
  const [empleadosActivos, setEmpleadosActivos] = useState(null);
  const [allowedCodes, setAllowedCodes] = useState(null); // Set | null (null = no filter from empleados)
  const [vacacionesPersonas, setVacacionesPersonas] = useState(null);
  const [vacacionesDias, setVacacionesDias] = useState(null);
  const [bajasHoy, setBajasHoy] = useState(null);
  const [ausenciasPorTipo, setAusenciasPorTipo] = useState(null);
  const [cambiosPendientes, setCambiosPendientes] = useState(null);
  const [regularizacionesPendientes, setRegularizacionesPendientes] = useState(null);
  const [programadosHoy, setProgramadosHoy] = useState(null);
  const [pendientesFichar, setPendientesFichar] = useState(null);
  const fetchedRef = useRef('');
  const inFlightRef = useRef(false);

  const canEmpleadosActivos = Boolean(flags.canEmpleadosActivos);
  const canVacacionesEquipo = Boolean(flags.canVacacionesEquipo);
  const canAusenciasEquipo = Boolean(flags.canAusenciasEquipo);
  const canBajasEquipo = Boolean(flags.canBajasEquipo);
  const canAprobaciones = Boolean(flags.canAprobaciones);
  const canProgramadosFichar = Boolean(flags.canProgramadosFichar);

  const active =
    enabled &&
    (canEmpleadosActivos ||
      canVacacionesEquipo ||
      canAusenciasEquipo ||
      canBajasEquipo ||
      canAprobaciones ||
      canProgramadosFichar);

  const fetchKey = [
    enabled,
    periodo,
    canEmpleadosActivos,
    canVacacionesEquipo,
    canAusenciasEquipo,
    canBajasEquipo,
    canAprobaciones,
    canProgramadosFichar,
  ].join('|');

  const load = useCallback(async () => {
    if (!active) {
      setEmpleadosActivos(null);
      setVacacionesPersonas(null);
      setVacacionesDias(null);
      setBajasHoy(null);
      setAusenciasPorTipo(null);
      setCambiosPendientes(null);
      setRegularizacionesPendientes(null);
      setProgramadosHoy(null);
      setPendientesFichar(null);
      return;
    }

    const key = fetchKey;
    if (fetchedRef.current === key || inFlightRef.current) return;
    inFlightRef.current = true;
    fetchedRef.current = key;
    setLoading(true);

    try {
    const today = toYmd(new Date());
    const monthKey = currentMonthKey();
    // periodo is encoded in fetchKey; read from latest closure when key changes
    const win =
      periodo === 'mes'
        ? monthWindow(monthKey)
        : { start: today, end: today };

    let codeSet = null;

    // 1) Empleados activos + scope codes (BE already applies EmpleadoGrupoScope)
    if (canEmpleadosActivos) {
      try {
        const res = await fetch(routes.getEstadisticasEmpleados, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.estadisticas)
            ? data.estadisticas
            : Array.isArray(data)
              ? data
              : [];
          codeSet = new Set(
            list.map((e) => String(e.CODIGO || e.codigo || '').trim()).filter(Boolean),
          );
          setAllowedCodes(codeSet);
          const activos = list.filter(
            (e) =>
              String(e.estado || e.ESTADO || '')
                .trim()
                .toUpperCase() === 'ACTIVO',
          ).length;
          setEmpleadosActivos(activos);
        } else {
          setEmpleadosActivos(null);
        }
      } catch {
        setEmpleadosActivos(null);
      }
    } else {
      setEmpleadosActivos(null);
      setAllowedCodes(null);
    }

    // 2) Vacaciones equipo
    if (canVacacionesEquipo && win) {
      try {
        const url = `${routes.getSolicitudesByEmail}?MES=${encodeURIComponent(monthKey)}&TIPO=Vacaciones&ESTADO=Aprobada&limit=1000`;
        const res = await fetch(url, { method: 'GET', headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          let list = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.solicitudes)
                ? data.solicitudes
                : [];
          list = filterByAllowed(list, codeSet);
          const personas = new Set();
          let dias = 0;
          for (const s of list) {
            const start =
              String(s.fecha_inicio || s['fecha inicio'] || '').slice(0, 10) ||
              parseFechaRange(s.FECHA || s.fecha)?.start;
            const end =
              String(s.fecha_fin || s['fecha fin'] || '').slice(0, 10) ||
              parseFechaRange(s.FECHA || s.fecha)?.end ||
              start;
            if (!start || !end) continue;
            if (!rangesOverlap(start, end, win.start, win.end)) continue;
            const c = codeOf(s);
            if (c) personas.add(c);
            dias += countDaysInWindow(start, end, win.start, win.end);
          }
          setVacacionesPersonas(personas.size);
          setVacacionesDias(dias);
        } else {
          setVacacionesPersonas(null);
          setVacacionesDias(null);
        }
      } catch {
        setVacacionesPersonas(null);
        setVacacionesDias(null);
      }
    } else {
      setVacacionesPersonas(null);
      setVacacionesDias(null);
    }

    // 3) Bajas médicas (hoy always for "hoy"; for "mes" = overlapping month)
    if (canBajasEquipo && win) {
      try {
        const res = await fetch(routes.getBajasMedicas, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          let list = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.bajas)
                ? data.bajas
                : [];
          list = filterByAllowed(list, codeSet);
          const personas = new Set();
          for (const b of list) {
            const baja = String(
              b.fechaBaja || b.fecha_baja || b['Fecha Baja'] || b.FECHA_BAJA || '',
            ).slice(0, 10);
            const altaRaw =
              b.fechaAlta || b.fecha_alta || b['Fecha Alta'] || b.FECHA_ALTA || '';
            const alta = altaRaw ? String(altaRaw).slice(0, 10) : null;
            if (!baja) continue;
            // Activa en ventana: baja <= winEnd && (!alta || alta >= winStart)
            if (baja <= win.end && (!alta || alta >= win.start)) {
              const c = codeOf(b) || String(b.codigoEmpleado || b.CODIGO || '').trim();
              if (c) personas.add(c);
            }
          }
          setBajasHoy(personas.size);
        } else {
          setBajasHoy(null);
        }
      } catch {
        setBajasHoy(null);
      }
    } else {
      setBajasHoy(null);
    }

    // 4) Otras ausencias por tipo (exclude Vacaciones)
    if (canAusenciasEquipo) {
      try {
        const url = `${routes.getAusencias}?MES=${encodeURIComponent(monthKey)}`;
        const res = await fetch(url, { method: 'GET', headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          let list = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.ausencias)
                ? data.ausencias
                : [];
          list = filterByAllowed(list, codeSet);
          const byTipo = {};
          for (const a of list) {
            const tipo = String(a.TIPO || a.tipo || 'Otro').trim() || 'Otro';
            if (/vacacion/i.test(tipo)) continue;
            const range =
              parseFechaRange(a.FECHA || a.fecha) ||
              (a.fecha_inicio
                ? {
                    start: String(a.fecha_inicio).slice(0, 10),
                    end: String(a.fecha_fin || a.fecha_inicio).slice(0, 10),
                  }
                : null);
            if (!range || !win) continue;
            const hits =
              periodo === 'hoy'
                ? ymdInRange(today, range.start, range.end)
                : rangesOverlap(range.start, range.end, win.start, win.end);
            if (!hits) continue;
            byTipo[tipo] = (byTipo[tipo] || 0) + 1;
          }
          setAusenciasPorTipo(byTipo);
        } else {
          setAusenciasPorTipo(null);
        }
      } catch {
        setAusenciasPorTipo(null);
      }
    } else {
      setAusenciasPorTipo(null);
    }

    // 5) Aprobaciones pendientes
    if (canAprobaciones) {
      try {
        const res = await fetch(routes.getCambiosPendientes, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (!(data && data.status === 'not-modified')) {
            const rawArray = Array.isArray(data) ? data : data ? [data] : [];
            const list = rawArray.filter((item) => {
              if (!item || typeof item !== 'object') return false;
              return Boolean(
                item.NOMBRE ||
                  item.nombre ||
                  item.CAMPO_MODIFICADO ||
                  item.campo ||
                  item.VALOR_NUEVO ||
                  item.email,
              );
            });
            setCambiosPendientes(list.length);
          }
        } else {
          setCambiosPendientes(null);
        }
      } catch {
        setCambiosPendientes(null);
      }
      try {
        const res = await fetch(routes.getRegularizacionesPendientes, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.pendientes) ? data.pendientes : [];
          setRegularizacionesPendientes(list.length);
        } else {
          setRegularizacionesPendientes(null);
        }
      } catch {
        setRegularizacionesPendientes(null);
      }
    } else {
      setCambiosPendientes(null);
      setRegularizacionesPendientes(null);
    }

    // 6) Programados hoy + pendientes fichar (endpoint agregat BE — fără N+1)
    if (canProgramadosFichar) {
      try {
        const url = `${routes.getInicioResumenOperativo}?periodo=${encodeURIComponent(periodo === 'mes' ? 'mes' : 'hoy')}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const omitted = Array.isArray(data?.omitted) ? data.omitted : [];
          if (omitted.includes('programadosHoy')) {
            setProgramadosHoy(null);
          } else {
            const n = data?.kpis?.programadosHoy?.count;
            setProgramadosHoy(Number.isFinite(Number(n)) ? Number(n) : null);
          }
          if (omitted.includes('pendientesFichar')) {
            setPendientesFichar(null);
          } else {
            const n = data?.kpis?.pendientesFichar?.count;
            setPendientesFichar(Number.isFinite(Number(n)) ? Number(n) : null);
          }
        } else {
          setProgramadosHoy(null);
          setPendientesFichar(null);
        }
      } catch {
        setProgramadosHoy(null);
        setPendientesFichar(null);
      }
    } else {
      setProgramadosHoy(null);
      setPendientesFichar(null);
    }
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [
    active,
    fetchKey,
    periodo,
    canEmpleadosActivos,
    canVacacionesEquipo,
    canAusenciasEquipo,
    canBajasEquipo,
    canAprobaciones,
    canProgramadosFichar,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const periodoQ = periodo === 'mes' ? 'mes' : 'hoy';

  const cards = useMemo(() => {
    const list = [];
    if (canEmpleadosActivos && empleadosActivos != null) {
      list.push({
        id: 'op-activos',
        label: 'Empleados activos',
        value: empleadosActivos,
        href: '/empleados?estado=ACTIVO',
        tone: 'blue',
        periodo: 'both',
      });
    }
    if (canVacacionesEquipo && vacacionesPersonas != null) {
      list.push({
        id: 'op-vac-pers',
        label:
          periodo === 'hoy'
            ? 'De vacaciones hoy'
            : 'De vacaciones este mes',
        value: vacacionesPersonas,
        href: `/solicitudes?vista=todas&seccion=vacaciones&periodo=${periodoQ}&estado=Aprobada`,
        tone: 'green',
        periodo: 'both',
      });
    }
    if (canVacacionesEquipo && vacacionesDias != null) {
      list.push({
        id: 'op-vac-dias',
        label:
          periodo === 'hoy'
            ? 'Días vacaciones hoy'
            : 'Días vacaciones este mes',
        value: vacacionesDias,
        href: `/solicitudes?vista=todas&seccion=vacaciones&periodo=${periodoQ}&estado=Aprobada`,
        tone: 'teal',
        periodo: 'both',
      });
    }
    if (canBajasEquipo && bajasHoy != null) {
      list.push({
        id: 'op-bajas',
        label:
          periodo === 'hoy'
            ? 'Baja médica hoy'
            : 'Baja médica (mes)',
        value: bajasHoy,
        href: `/solicitudes?vista=todas&seccion=baja&periodo=${periodoQ}`,
        tone: 'red',
        periodo: 'both',
      });
    }
    if (canAprobaciones && cambiosPendientes != null) {
      list.push({
        id: 'op-cambios',
        label: 'Cambios pendientes',
        value: cambiosPendientes,
        href: '/aprobaciones?tab=cambios',
        tone: 'purple',
        periodo: 'both',
      });
    }
    if (canAprobaciones && regularizacionesPendientes != null) {
      list.push({
        id: 'op-reg',
        label: 'Regularizaciones',
        value: regularizacionesPendientes,
        href: '/aprobaciones?tab=regularizaciones',
        tone: 'orange',
        periodo: 'both',
      });
    }
    // Phase E: always Madrid «hoy» (independent of Hoy/Mes toggle labels for other KPIs)
    if (canProgramadosFichar && programadosHoy != null) {
      list.push({
        id: 'op-programados',
        label: 'Previstos a trabajar hoy',
        value: programadosHoy,
        href: '/cuadrantes',
        tone: 'sky',
        periodo: 'both',
      });
    }
    if (canProgramadosFichar && pendientesFichar != null) {
      list.push({
        id: 'op-pend-fichar',
        label: 'Pendientes de fichar hoy',
        value: pendientesFichar,
        href: '/fichaje',
        tone: 'amber',
        periodo: 'both',
      });
    }
    return list;
  }, [
    canEmpleadosActivos,
    canVacacionesEquipo,
    canBajasEquipo,
    canAprobaciones,
    canProgramadosFichar,
    empleadosActivos,
    vacacionesPersonas,
    vacacionesDias,
    bajasHoy,
    cambiosPendientes,
    regularizacionesPendientes,
    programadosHoy,
    pendientesFichar,
    periodo,
    periodoQ,
  ]);

  const ausenciaRows = useMemo(() => {
    if (!canAusenciasEquipo || !ausenciasPorTipo) return [];
    return Object.entries(ausenciasPorTipo)
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, count]) => ({
        id: `aus-${tipo}`,
        label: tipo,
        value: count,
        href: `/solicitudes?vista=todas&seccion=ausencias&periodo=${periodoQ}&tipoAusencia=${encodeURIComponent(tipo)}`,
      }));
  }, [canAusenciasEquipo, ausenciasPorTipo, periodoQ]);

  return {
    active,
    loading,
    cards,
    ausenciaRows,
    allowedCodes,
  };
}
