import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

function isVisible(cuadrante) {
  return cuadrante.visible !== false && cuadrante.visible !== 0 && cuadrante.visible !== '0';
}

function shiftClass(value, esMulticentro) {
  if (!value || value === 'LIBRE') return 'cuadrantes-mobile-day--libre';
  if (esMulticentro) return 'cuadrantes-mobile-day--multi';
  return 'cuadrantes-mobile-day--work';
}

export default function CuadrantesMobileMatrix({
  rows,
  daysInMonth,
  onEditDay,
  isMulticentro,
}) {
  const [expanded, setExpanded] = useState(null);

  if (!rows.length) {
    return (
      <div className="cuadrantes-mobile-empty app-card app-card--pad">
        <p className="text-sm text-gray-600 dark:text-gray-400">No hay cuadrantes para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="cuadrantes-mobile-list solicitud-admin-mobile-list">
      {rows.map(({ cuadrante, zile, identificator, index }) => {
        const key = identificator || String(index);
        const open = expanded === key;
        const visible = isVisible(cuadrante);
        const name = cuadrante.NOMBRE || cuadrante.nombre || 'N/A';

        return (
          <article key={key} className="cuadrantes-mobile-card app-card app-card--pad solicitud-admin-mobile-card">
            <button
              type="button"
              className="cuadrantes-mobile-card__toggle"
              onClick={() => setExpanded(open ? null : key)}
              aria-expanded={open}
            >
              <div className="cuadrantes-mobile-card__main">
                <p className="cuadrantes-mobile-card__name">{name}</p>
                <p className="cuadrantes-mobile-card__meta">
                  {cuadrante.LUNA || ''}
                  {cuadrante.EMAIL ? ` · ${cuadrante.EMAIL}` : ''}
                </p>
              </div>
              <div className="cuadrantes-mobile-card__badges">
                <span className={`cuadrantes-badge ${visible ? 'cuadrantes-badge--visible' : 'cuadrantes-badge--hidden'}`}>
                  {visible ? <Eye className="w-3 h-3" aria-hidden /> : <EyeOff className="w-3 h-3" aria-hidden />}
                  {visible ? 'Visible' : 'Oculto'}
                </span>
                {open ? <ChevronUp className="w-4 h-4 shrink-0" aria-hidden /> : <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />}
              </div>
            </button>

            {open ? (
              <div className="cuadrantes-mobile-days">
                {zile.map((z, i) => {
                  const day = i + 1;
                  const esMulti = isMulticentro?.(z);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`cuadrantes-mobile-day ${shiftClass(z, esMulti)}`}
                      onClick={() => onEditDay(index, day, z, cuadrante)}
                    >
                      <span className="cuadrantes-mobile-day__num">{day}</span>
                      <span className="cuadrantes-mobile-day__val">{z || '—'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="cuadrantes-mobile-preview solicitud-admin-month-grid">
                {zile.slice(0, Math.min(8, daysInMonth)).map((z, i) => (
                  <span key={i + 1} className={`solicitud-admin-month-pill ${z && z !== 'LIBRE' ? 'solicitud-admin-month-pill--ok' : ''}`}>
                    <strong>{i + 1}</strong>
                    <br />
                    {(z || '—').slice(0, 6)}
                  </span>
                ))}
                {daysInMonth > 8 ? (
                  <span className="solicitud-admin-month-pill">+{daysInMonth - 8}</span>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
