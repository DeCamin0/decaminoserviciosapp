import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { useInicioSummaryData } from './useInicioSummaryData';
import InicioResumenOperativo from './InicioResumenOperativo';
import { buildOperativoPermissionFlags } from './useInicioOperativoData';
import './InicioMiResumen.css';

/**
 * Compact collapsible summary for phone only (≤767px).
 * Does not replace Acceso rápido grid.
 */
export default function InicioMiResumen({
  user,
  monthlyAlerts = null,
  badgeCounts = {},
  flags = {},
  hasPermission,
}) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const opFlags = useMemo(
    () =>
      typeof hasPermission === 'function'
        ? buildOperativoPermissionFlags(hasPermission)
        : {},
    [hasPermission],
  );
  const showOperativo = Object.values(opFlags).some(Boolean);
  // Operativo owns empleados/aprobaciones fetches — avoid duplicate 429 storms
  const summaryFlags = useMemo(
    () =>
      showOperativo
        ? { ...flags, canEmpleados: false, canAprobaciones: false }
        : flags,
    [flags, showOperativo],
  );

  const { loading, jornada, vacacionesSaldo, attention, kpis } = useInicioSummaryData({
    user,
    enabled: true,
    flags: summaryFlags,
    monthlyAlerts,
    badgeCounts,
  });

  const fmtVac = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
  };

  const rows = [];

  if (flags.canJornada && jornada) {
    rows.push({
      id: 'jornada',
      label: jornada.isLibre ? 'Jornada hoy' : 'Mi jornada',
      value: jornada.isLibre
        ? 'Libre'
        : jornada.label || `${jornada.entrada || '—'} → ${jornada.salida || '—'}`,
      href: '/fichaje',
    });
    if (jornada.proximoTurno && !jornada.isLibre) {
      rows.push({
        id: 'turno',
        label: 'Próximo turno',
        value: jornada.proximoTurno,
        href: '/cuadrantes-empleado',
      });
    }
  }

  if (flags.canVacaciones && vacacionesSaldo) {
    const tieneDisponibles = Number(vacacionesSaldo.restantes) > 0;
    rows.push({
      id: 'vac',
      label: 'Vacaciones tomadas',
      value: tieneDisponibles
        ? `${fmtVac(vacacionesSaldo.consumidos)} · aún tienes disponibles`
        : `${fmtVac(vacacionesSaldo.consumidos)} · sin disponibles`,
      href: '/solicitudes',
    });
  }

  // Operational / attention rows (manager) + personal badges
  const seen = new Set(rows.map((r) => r.id));
  for (const kpi of kpis) {
    if (kpi.id === 'vacaciones' || kpi.id === 'proximo-turno') continue;
    if (seen.has(kpi.id)) continue;
    rows.push({
      id: kpi.id,
      label: kpi.label,
      value: kpi.value,
      href: kpi.href,
    });
    seen.add(kpi.id);
  }
  for (const att of attention) {
    if (seen.has(att.id)) continue;
    rows.push({
      id: att.id,
      label: att.label,
      value: att.count,
      href: att.href,
    });
    seen.add(att.id);
  }

  return (
    <section className="inicio-resumen" aria-label="Mi resumen">
      <button
        type="button"
        className="inicio-resumen__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="inicio-resumen__toggle-title">Mi resumen</p>
          <p className="inicio-resumen__toggle-sub">
            {loading ? 'Cargando…' : 'Información personalizada'}
          </p>
        </div>
        <ChevronDown
          className={`inicio-resumen__chevron${open ? ' inicio-resumen__chevron--open' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="inicio-resumen__body">
          {rows.length === 0 && !showOperativo ? (
            <p className="inicio-resumen__empty">
              No hay indicadores disponibles con tus permisos actuales.
            </p>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="inicio-resumen__row"
                style={{ width: '100%' }}
                onClick={() => row.href && navigate(row.href)}
              >
                <span className="inicio-resumen__row-label">{row.label}</span>
                <span className="inicio-resumen__row-value">{row.value}</span>
              </button>
            ))
          )}
          {showOperativo && typeof hasPermission === 'function' ? (
            <InicioResumenOperativo hasPermission={hasPermission} compact />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
