import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useInicioSummaryData } from './useInicioSummaryData';
import InicioResumenOperativo from './InicioResumenOperativo';
import { buildOperativoPermissionFlags } from './useInicioOperativoData';
import { pickFrequentAccess } from './categorizeQuickAccess';
import {
  getTopModuleIds,
  resolveTenantId,
} from '../../utils/frequentModulesStorage';
import './InicioDesktopDashboard.css';

function formatLongDate(d = new Date()) {
  try {
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d.toLocaleDateString();
  }
}

function firstName(user) {
  const full =
    user?.['NOMBRE / APELLIDOS'] ||
    user?.NOMBRE ||
    user?.nombre ||
    user?.name ||
    '';
  const part = String(full).trim().split(/\s+/)[0];
  return part || 'equipo';
}

/**
 * Desktop (≥1200) Inicio dashboard — isolated from QuickAccessOrb / mobile.
 */
export default function InicioDesktopDashboard({
  user,
  items = [],
  monthlyAlerts = null,
  badgeCounts = {},
  flags = {},
  hasPermission,
}) {
  const navigate = useNavigate();
  const opActive = useMemo(() => {
    if (typeof hasPermission !== 'function') return false;
    return Object.values(buildOperativoPermissionFlags(hasPermission)).some(Boolean);
  }, [hasPermission]);
  // Operativo owns empleados/aprobaciones fetches — avoid duplicate 429 storms
  const summaryFlags = useMemo(
    () =>
      opActive
        ? { ...flags, canEmpleados: false, canAprobaciones: false }
        : flags,
    [flags, opActive],
  );
  const { loading, jornada, kpis, attention } = useInicioSummaryData({
    user,
    enabled: true,
    flags: summaryFlags,
    monthlyAlerts,
    badgeCounts,
  });

  const frequent = useMemo(() => {
    const codigo = user?.CODIGO || user?.codigo || '';
    const ranked = codigo ? getTopModuleIds(resolveTenantId(), codigo, 6) : [];
    return pickFrequentAccess(items, 6, ranked);
  }, [items, user?.CODIGO, user?.codigo]);

  const go = (href) => {
    if (href) navigate(href);
  };

  const hour = new Date().getHours();
  const saludo =
    hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const statusClass =
    jornada?.status === 'En horario'
      ? ''
      : jornada?.status === 'Libre'
        ? 'inicio-desktop__status--muted'
        : 'inicio-desktop__status--warn';

  return (
    <section className="inicio-desktop" aria-label="Panel de inicio escritorio">
      <header className="inicio-desktop__header">
        <div>
          <h2 className="inicio-desktop__hello">
            {saludo}, {firstName(user)}
          </h2>
          <p className="inicio-desktop__sub">
            Resumen de actividad y accesos principales
          </p>
        </div>
        <time className="inicio-desktop__date" dateTime={new Date().toISOString()}>
          {formatLongDate()}
        </time>
      </header>

      {typeof hasPermission === 'function' ? (
        <InicioResumenOperativo hasPermission={hasPermission} />
      ) : null}

      {loading && kpis.length === 0 ? (
        <p className="inicio-desktop__loading">Cargando indicadores…</p>
      ) : null}

      {kpis.length > 0 ? (
        <div className="inicio-desktop__kpis" role="list">
          {kpis.slice(0, 8).map((kpi) => (
            <button
              key={kpi.id}
              type="button"
              role="listitem"
              className={`inicio-desktop__kpi inicio-desktop__kpi--${kpi.tone || 'blue'}`}
              onClick={() => go(kpi.href)}
            >
              <span className="inicio-desktop__kpi-label">{kpi.label}</span>
              <span className="inicio-desktop__kpi-value">{kpi.value}</span>
              {kpi.hint ? (
                <span className="inicio-desktop__kpi-hint">{kpi.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {flags.canJornada && jornada ? (
        <div className="inicio-desktop__jornada">
          <div className="inicio-desktop__jornada-top">
            <h3 className="inicio-desktop__panel-title" style={{ margin: 0 }}>
              Mi jornada de hoy
            </h3>
            {jornada.status ? (
              <span className={`inicio-desktop__status ${statusClass}`}>
                {jornada.status}
              </span>
            ) : null}
          </div>
          {jornada.isLibre ? (
            <p className="inicio-desktop__jornada-foot">Hoy no tienes turno asignado.</p>
          ) : (
            <>
              <div className="inicio-desktop__jornada-times">
                {jornada.entrada ? (
                  <span>
                    Entrada prevista <strong>{jornada.entrada}</strong>
                  </span>
                ) : null}
                {jornada.salida ? (
                  <span>
                    Salida prevista <strong>{jornada.salida}</strong>
                  </span>
                ) : null}
                {!jornada.entrada && jornada.label ? (
                  <span>
                    Horario <strong>{jornada.label}</strong>
                  </span>
                ) : null}
              </div>
              {jornada.plannedHours != null ? (
                <p className="inicio-desktop__jornada-foot">
                  Jornada planificada: {jornada.plannedHours} horas
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="inicio-desktop__mid">
        <div className="inicio-desktop__panel">
          <h3 className="inicio-desktop__panel-title">Accesos frecuentes</h3>
          <div className="inicio-desktop__freq-grid">
            {frequent.map((item) => (
              <button
                key={item.id}
                type="button"
                className="inicio-desktop__freq-btn"
                onClick={() => go(item.href)}
                disabled={item.disabled}
              >
                {item.notificationCount > 0 ? (
                  <span className="inicio-desktop__badge">{item.notificationCount}</span>
                ) : null}
                <span className="inicio-desktop__freq-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="inicio-desktop__freq-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="inicio-desktop__panel">
          <h3 className="inicio-desktop__panel-title">Pendiente de atención</h3>
          {attention.length === 0 ? (
            <p className="inicio-desktop__attention-empty">
              No tienes pendientes urgentes ahora.
            </p>
          ) : (
            <ul className="inicio-desktop__attention-list">
              {attention.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="inicio-desktop__attention-item"
                    style={{ width: '100%' }}
                    onClick={() => go(row.href)}
                  >
                    <span className="inicio-desktop__attention-label">{row.label}</span>
                    <span className="inicio-desktop__attention-count">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
