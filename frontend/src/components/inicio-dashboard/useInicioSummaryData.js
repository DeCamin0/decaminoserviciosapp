import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../utils/routes';
import {
  calculateCuadranteHours,
  formatCuadranteIntervalsForDisplay,
  parseCuadranteDayIntervals,
} from '../../utils/cuadrante-hours-helper';
import { isCuadranteRowVisible } from '../../utils/cuadranteVisible';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function excelLunaToYYYYMM(luna) {
  if (typeof luna === 'number') {
    const date = new Date(Math.round((luna - 25569) * 86400 * 1000));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return String(luna || '').trim();
}

function minutesNow() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function hmToMin(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Resolve today's schedule label + next turn + planned hours from a cuadrante row.
 */
function resolveJornadaFromCuadrante(cuadrante) {
  if (!cuadrante) {
    return {
      label: null,
      isLibre: false,
      plannedHours: null,
      entrada: null,
      salida: null,
      proximoTurno: null,
      status: null,
    };
  }
  const today = new Date().getDate();
  const dayKey = `ZI_${today}`;
  const raw = cuadrante[dayKey] ?? cuadrante[dayKey.toLowerCase()];
  if (!raw || String(raw).trim() === '' || String(raw).toUpperCase() === 'LIBRE') {
    return {
      label: 'Libre',
      isLibre: true,
      plannedHours: 0,
      entrada: null,
      salida: null,
      proximoTurno: null,
      status: 'Libre',
    };
  }
  const label = formatCuadranteIntervalsForDisplay(raw) || String(raw).trim();
  const intervals = parseCuadranteDayIntervals(raw);
  const plannedHours = calculateCuadranteHours(raw);
  const entrada = intervals[0]?.start || null;
  const salida = intervals[intervals.length - 1]?.end || null;

  const nowM = minutesNow();
  let proximoTurno = null;
  let inWindow = false;
  for (const iv of intervals) {
    const s = hmToMin(iv.start);
    const e = hmToMin(iv.end);
    if (s == null || e == null) continue;
    let endM = e;
    if (e <= s) endM = e + 1440; // overnight
    let cur = nowM;
    if (e <= s && nowM < s) cur = nowM + 1440;
    if (cur >= s && cur <= endM) inWindow = true;
    if (nowM < s && !proximoTurno) {
      proximoTurno = iv.start;
    }
  }
  if (!proximoTurno && !inWindow) {
    const tomorrow = today + 1;
    const tomKey = `ZI_${tomorrow}`;
    const tomRaw = cuadrante[tomKey];
    if (tomRaw && String(tomRaw).toUpperCase() !== 'LIBRE') {
      const tomIv = parseCuadranteDayIntervals(tomRaw);
      if (tomIv[0]?.start) proximoTurno = tomIv[0].start;
    }
  }

  let status = 'Fuera de horario';
  if (inWindow) status = 'En horario';
  else if (intervals.length && nowM < (hmToMin(intervals[0].start) ?? 0)) {
    status = 'Pendiente de entrada';
  }

  return {
    label,
    isLibre: false,
    plannedHours: plannedHours > 0 ? plannedHours : null,
    entrada,
    salida,
    proximoTurno: proximoTurno || entrada,
    status,
  };
}

/**
 * Shared summary data for desktop dashboard + mobile «Mi resumen».
 * Reuses existing endpoints only; skips fetches when permission flags are false.
 */
export function useInicioSummaryData({
  user,
  enabled = true,
  flags = {},
  monthlyAlerts = null,
  badgeCounts = {},
}) {
  const codigo = user?.CODIGO || user?.codigo || '';
  const isDemo = Boolean(user?.isDemo);
  const [jornada, setJornada] = useState(null);
  /** Annual-based saldo (not generados/devengo): tomadas + restantes de cuota anual */
  const [vacacionesSaldo, setVacacionesSaldo] = useState(null);
  const [empleadosActivos, setEmpleadosActivos] = useState(null);
  const [cambiosPendientes, setCambiosPendientes] = useState(null);
  const [regularizacionesPendientes, setRegularizacionesPendientes] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef('');

  const canJornada = Boolean(flags.canJornada);
  const canVacaciones = Boolean(flags.canVacaciones);
  const canEmpleados = Boolean(flags.canEmpleados);
  const canAprobaciones = Boolean(flags.canAprobaciones);

  const load = useCallback(async () => {
    if (!enabled || !codigo || isDemo) return;
    const key = [
      codigo,
      canJornada,
      canVacaciones,
      canEmpleados,
      canAprobaciones,
      'vac-anual-v2',
    ].join('|');
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;
    setLoading(true);

    const tasks = [];

    if (canJornada) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch(routes.getCuadrantes, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ codigo }),
            });
            const data = await res.json();
            const lista = Array.isArray(data) ? data : data ? [data] : [];
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const match = lista.find((c) => {
              const luna = excelLunaToYYYYMM(c.LUNA || c.luna);
              const code = String(c.CODIGO || c.codigo || '');
              return luna === month && code === String(codigo) && isCuadranteRowVisible(c);
            });
            setJornada(match ? resolveJornadaFromCuadrante(match) : null);
          } catch {
            setJornada(null);
          }
        })(),
      );
    }

    if (canVacaciones) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch(routes.getVacacionesSaldoEmpleado(codigo), {
              method: 'GET',
              headers: authHeaders(),
            });
            if (!res.ok) {
              setVacacionesSaldo(null);
              return;
            }
            const data = await res.json();
            const v = data?.vacaciones;
            if (!v) {
              setVacacionesSaldo(null);
              return;
            }
            const anuales = Number(v.dias_anuales) || 0;
            const anoPasado = Number(v.dias_restantes_ano_anterior) || 0;
            const consumidos = Number(v.dias_consumidos_aprobados) || 0;
            const totalAnual = anuales + anoPasado;
            // Restantes din cota anuală (nu din generados/devengo)
            const restantes = Math.max(0, totalAnual - consumidos);
            setVacacionesSaldo({
              anuales,
              anoPasado,
              totalAnual,
              consumidos,
              restantes,
            });
          } catch {
            setVacacionesSaldo(null);
          }
        })(),
      );
    }

    if (canEmpleados) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch(routes.getEstadisticasEmpleados, {
              method: 'GET',
              headers: authHeaders(),
            });
            if (!res.ok) {
              setEmpleadosActivos(null);
              return;
            }
            const data = await res.json();
            const list = Array.isArray(data?.estadisticas)
              ? data.estadisticas
              : Array.isArray(data)
                ? data
                : [];
            const activos = list.filter(
              (e) =>
                String(e.estado || e.ESTADO || '')
                  .trim()
                  .toUpperCase() === 'ACTIVO',
            ).length;
            setEmpleadosActivos(activos);
          } catch {
            setEmpleadosActivos(null);
          }
        })(),
      );
    }

    if (canAprobaciones) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch(routes.getCambiosPendientes, {
              method: 'GET',
              headers: authHeaders(),
            });
            if (!res.ok) {
              setCambiosPendientes(null);
              return;
            }
            const data = await res.json();
            if (data && typeof data === 'object' && data.status === 'not-modified') {
              return;
            }
            const rawArray = Array.isArray(data) ? data : data ? [data] : [];
            const list = rawArray.filter((item) => {
              if (!item || typeof item !== 'object') return false;
              return Boolean(
                item.NOMBRE ||
                  item.nombre ||
                  item.CAMPO_MODIFICADO ||
                  item.campo ||
                  item.VALOR_NUEVO ||
                  item.valoare_noua ||
                  item.CORREO_ELECTRONICO ||
                  item.email,
              );
            });
            setCambiosPendientes(list.length);
          } catch {
            setCambiosPendientes(null);
          }
        })(),
      );
      tasks.push(
        (async () => {
          try {
            const res = await fetch(routes.getRegularizacionesPendientes, {
              method: 'GET',
              headers: authHeaders(),
            });
            if (!res.ok) {
              setRegularizacionesPendientes(null);
              return;
            }
            const data = await res.json();
            const list = Array.isArray(data?.pendientes) ? data.pendientes : [];
            setRegularizacionesPendientes(list.length);
          } catch {
            setRegularizacionesPendientes(null);
          }
        })(),
      );
    }

    await Promise.all(tasks);
    setLoading(false);
  }, [
    enabled,
    codigo,
    isDemo,
    canJornada,
    canVacaciones,
    canEmpleados,
    canAprobaciones,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const list = [];
    if (canEmpleados && empleadosActivos != null) {
      list.push({
        id: 'empleados',
        label: 'Empleados activos',
        value: empleadosActivos,
        href: '/empleados?estado=ACTIVO',
        tone: 'blue',
      });
    }
    if (canAprobaciones && cambiosPendientes != null) {
      list.push({
        id: 'solicitudes-aprobar',
        label: 'Cambios por revisar',
        value: cambiosPendientes,
        href: '/aprobaciones?tab=cambios',
        tone: 'purple',
      });
    }
    if (canAprobaciones && regularizacionesPendientes != null) {
      list.push({
        id: 'regularizaciones',
        label: 'Regularizaciones',
        value: regularizacionesPendientes,
        href: '/aprobaciones?tab=regularizaciones',
        tone: 'orange',
      });
    }
    if (monthlyAlerts && monthlyAlerts.total > 0) {
      list.push({
        id: 'alertas-fichaje',
        label: 'Alertas de jornada',
        value: monthlyAlerts.total,
        href: '/fichaje',
        tone: 'red',
      });
    }
    if (canVacaciones && vacacionesSaldo) {
      const fmt = (n) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return '—';
        return Number.isInteger(x) ? String(x) : x.toFixed(1);
      };
      const tieneDisponibles = Number(vacacionesSaldo.restantes) > 0;
      list.push({
        id: 'vacaciones',
        label: 'Vacaciones tomadas',
        // Doar câte a luat; fără anuales și fără cifra de restante
        value: fmt(vacacionesSaldo.consumidos),
        hint: tieneDisponibles
          ? 'Aún tienes días disponibles'
          : 'Sin días disponibles',
        href: '/solicitudes',
        tone: 'teal',
      });
    }
    if (canJornada && jornada?.proximoTurno && !jornada.isLibre) {
      list.push({
        id: 'proximo-turno',
        label: 'Próximo turno',
        value: jornada.proximoTurno,
        href: '/cuadrantes-empleado',
        tone: 'sky',
      });
    }
    if (badgeCounts.misTareas > 0) {
      list.push({
        id: 'mis-tareas-kpi',
        label: 'Mis tareas',
        value: badgeCounts.misTareas,
        href: '/mis-tareas',
        tone: 'green',
      });
    }
    if (badgeCounts.documentos > 0) {
      list.push({
        id: 'documentos-kpi',
        label: 'Documentos pendientes',
        value: badgeCounts.documentos,
        href: '/documentos',
        tone: 'amber',
      });
    }
    if (badgeCounts.comunicados > 0) {
      list.push({
        id: 'comunicados-kpi',
        label: 'Comunicados',
        value: badgeCounts.comunicados,
        href: '/comunicados',
        tone: 'violet',
      });
    }
    return list;
  }, [
    canEmpleados,
    empleadosActivos,
    canAprobaciones,
    cambiosPendientes,
    regularizacionesPendientes,
    monthlyAlerts,
    canVacaciones,
    vacacionesSaldo,
    canJornada,
    jornada,
    badgeCounts,
  ]);

  const attention = useMemo(() => {
    const items = [];
    if (canAprobaciones && cambiosPendientes > 0) {
      items.push({
        id: 'att-cambios',
        label: 'Solicitudes / cambios por revisar',
        count: cambiosPendientes,
        href: '/aprobaciones?tab=cambios',
        tone: 'purple',
      });
    }
    if (canAprobaciones && regularizacionesPendientes > 0) {
      items.push({
        id: 'att-reg',
        label: 'Regularizaciones de fichaje',
        count: regularizacionesPendientes,
        href: '/aprobaciones?tab=regularizaciones',
        tone: 'orange',
      });
    }
    if (monthlyAlerts?.total > 0) {
      items.push({
        id: 'att-alerts',
        label: 'Alertas de jornada este mes',
        count: monthlyAlerts.total,
        href: '/fichaje',
        tone: 'red',
      });
    }
    if (badgeCounts.misTareas > 0) {
      items.push({
        id: 'att-tareas',
        label: 'Tareas pendientes',
        count: badgeCounts.misTareas,
        href: '/mis-tareas',
        tone: 'green',
      });
    }
    if (badgeCounts.documentos > 0) {
      items.push({
        id: 'att-docs',
        label: 'Documentos que requieren acción',
        count: badgeCounts.documentos,
        href: '/documentos',
        tone: 'amber',
      });
    }
    if (badgeCounts.comunicados > 0) {
      items.push({
        id: 'att-com',
        label: 'Comunicados sin leer',
        count: badgeCounts.comunicados,
        href: '/comunicados',
        tone: 'violet',
      });
    }
    return items;
  }, [
    canAprobaciones,
    cambiosPendientes,
    regularizacionesPendientes,
    monthlyAlerts,
    badgeCounts,
  ]);

  return {
    loading,
    jornada,
    vacacionesSaldo,
    kpis,
    attention,
  };
}
