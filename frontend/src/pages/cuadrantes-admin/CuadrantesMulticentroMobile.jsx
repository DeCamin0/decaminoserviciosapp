import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useState } from 'react';

function calcHours(str, calculaOreDinFormat) {
  return calculaOreDinFormat(str);
}

export default function CuadrantesMulticentroMobile({
  groupedByCentro,
  daysInMonth,
  multicentroListEdits,
  savingMulticentroListId,
  calculaOreDinFormat,
  onDayChange,
  onSaveRow,
}) {
  const [expanded, setExpanded] = useState(null);

  const entries = Object.entries(groupedByCentro || {});
  if (!entries.length) return null;

  return (
    <div className="cuadrantes-multicentro-mobile solicitud-admin-mobile-list">
      {entries.map(([centro, horarios]) => (
        <section key={centro} className="app-card app-card--pad">
          <h4 className="cuadrantes-multicentro-mobile__centro">{centro}</h4>
          <p className="text-xs text-gray-500 mb-3">{horarios.length} horario{horarios.length !== 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {horarios.map((horario, idx) => {
              const rowId = horario.id;
              const key = rowId ?? `${centro}-${idx}`;
              const open = expanded === key;
              const name = horario.NOMBRE || horario.nombre || 'N/A';
              let totalHoras = 0;
              for (let i = 1; i <= daysInMonth; i++) {
                const baseStr = String(horario[`ZI_${i}`] ?? horario[`zi_${i}`] ?? '');
                const merged = rowId != null && multicentroListEdits[rowId]?.[i] !== undefined
                  ? multicentroListEdits[rowId][i]
                  : baseStr;
                totalHoras += calcHours(merged, calculaOreDinFormat);
              }

              return (
                <article key={key} className="cuadrantes-multicentro-row app-card app-card--pad solicitud-admin-mobile-card">
                  <button
                    type="button"
                    className="cuadrantes-mobile-card__toggle w-full"
                    onClick={() => setExpanded(open ? null : key)}
                    aria-expanded={open}
                  >
                    <div className="text-left min-w-0">
                      <p className="cuadrantes-mobile-card__name">{name}</p>
                      <p className="cuadrantes-mobile-card__meta">
                        {horario.CODIGO || horario.codigo || '—'}
                        {horario.HORARIO ? ` · ${horario.HORARIO || horario.horario}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="cuadrantes-badge cuadrantes-badge--visible">{totalHoras > 0 ? `${totalHoras.toFixed(1)}h` : '—'}</span>
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {open ? (
                    <>
                      <div className="cuadrantes-mobile-days mt-3">
                        {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                          const day = dayIdx + 1;
                          const baseStr = String(horario[`ZI_${day}`] ?? horario[`zi_${day}`] ?? '');
                          const merged = rowId != null && multicentroListEdits[rowId]?.[day] !== undefined
                            ? multicentroListEdits[rowId][day]
                            : baseStr;
                          return (
                            <label key={day} className="cuadrantes-multicentro-day-field">
                              <span className="cuadrantes-multicentro-day-field__label">{day}</span>
                              <input
                                type="text"
                                className="cuadrantes-multicentro-day-field__input"
                                value={merged}
                                disabled={rowId == null || savingMulticentroListId === rowId}
                                onChange={(e) => onDayChange(rowId, day, e.target.value)}
                                placeholder="—"
                              />
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="solicitud-admin-btn solicitud-admin-btn--primary w-full mt-3 min-h-[44px]"
                        disabled={rowId == null || savingMulticentroListId === rowId}
                        onClick={() => onSaveRow(horario)}
                      >
                        <Save className="w-4 h-4" aria-hidden />
                        <span>{savingMulticentroListId === rowId ? 'Guardando…' : 'Guardar fila'}</span>
                      </button>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
