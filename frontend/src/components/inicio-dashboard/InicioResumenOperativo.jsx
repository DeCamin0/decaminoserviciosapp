import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  buildOperativoPermissionFlags,
  useInicioOperativoData,
} from './useInicioOperativoData';
import './InicioResumenOperativo.css';

/**
 * Resumen operativo — only renders KPIs the user is allowed to see.
 * @param {{ hasPermission: (module: string) => boolean, compact?: boolean }} props
 */
export default function InicioResumenOperativo({ hasPermission, compact = false }) {
  const [periodo, setPeriodo] = useState('hoy');
  const navigate = useNavigate();
  const flags = useMemo(
    () => buildOperativoPermissionFlags(hasPermission),
    [hasPermission],
  );
  const { active, loading, cards, ausenciaRows } = useInicioOperativoData({
    enabled: true,
    flags,
    periodo,
  });

  if (!active) return null;

  const go = (href) => {
    if (href) navigate(href);
  };

  return (
    <section
      className={`inicio-op${compact ? ' inicio-op--compact' : ''}`}
      aria-label="Resumen operativo"
    >
      <div className="inicio-op__head">
        <h3 className="inicio-op__title">Resumen operativo</h3>
        <div className="inicio-op__toggle" role="group" aria-label="Periodo">
          <button
            type="button"
            className={`inicio-op__toggle-btn${periodo === 'hoy' ? ' inicio-op__toggle-btn--on' : ''}`}
            onClick={() => setPeriodo('hoy')}
          >
            Hoy
          </button>
          <button
            type="button"
            className={`inicio-op__toggle-btn${periodo === 'mes' ? ' inicio-op__toggle-btn--on' : ''}`}
            onClick={() => setPeriodo('mes')}
          >
            Este mes
          </button>
        </div>
      </div>

      {loading && cards.length === 0 ? (
        <p className="inicio-op__loading">Cargando resumen…</p>
      ) : null}

      {!loading && cards.length === 0 && ausenciaRows.length === 0 ? (
        <p className="inicio-op__empty">
          No hay indicadores operativos con tus permisos actuales.
        </p>
      ) : null}

      {cards.length > 0 ? (
        <div className="inicio-op__grid">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`inicio-op__card inicio-op__card--${c.tone || 'blue'}`}
              onClick={() => go(c.href)}
            >
              <span className="inicio-op__card-label">{c.label}</span>
              <span className="inicio-op__card-value">{c.value}</span>
            </button>
          ))}
        </div>
      ) : null}

      {ausenciaRows.length > 0 && !compact ? (
        <div className="inicio-op__aus">
          <p className="inicio-op__aus-title">
            Otras ausencias {periodo === 'hoy' ? 'hoy' : 'este mes'}
          </p>
          <ul className="inicio-op__aus-list">
            {ausenciaRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="inicio-op__aus-item"
                  onClick={() => go(row.href)}
                >
                  <span>{row.label}</span>
                  <span className="inicio-op__aus-count">{row.value}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ausenciaRows.length > 0 && compact ? (
        <div className="inicio-op__aus">
          <p className="inicio-op__aus-title">Otras ausencias</p>
          <ul className="inicio-op__aus-list">
            {ausenciaRows.slice(0, 4).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="inicio-op__aus-item"
                  onClick={() => go(row.href)}
                >
                  <span>{row.label}</span>
                  <span className="inicio-op__aus-count">{row.value}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
