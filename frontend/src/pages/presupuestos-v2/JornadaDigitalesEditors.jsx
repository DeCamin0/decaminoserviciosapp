import { useState } from 'react';

/** Human jornada editor (no raw JSON). */
export function JornadaEditor({ value, onChange, disabled }) {
  const j = value || {
    horas_semana: '',
    festivos_incluidos: false,
    observacion: '',
    tramos: [],
  };
  const tramos = Array.isArray(j.tramos) ? j.tramos : [];

  const set = (patch) => onChange({ ...j, ...patch });

  const setTramo = (idx, patch) => {
    const next = tramos.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    set({ tramos: next });
  };

  const addTramo = () =>
    set({
      tramos: [
        ...tramos,
        { dias_label: '', hora_inicio: '08:00', hora_fin: '16:00', dias: [] },
      ],
    });

  const removeTramo = (idx) =>
    set({ tramos: tramos.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Jornada
      </h6>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="text-slate-600">Horas / semana</span>
          <input
            type="number"
            min={0}
            step={0.5}
            disabled={disabled}
            className="mt-1 block w-28 border rounded-lg px-2 py-1.5"
            value={j.horas_semana ?? ''}
            onChange={(e) =>
              set({
                horas_semana:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label className="text-sm flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            disabled={disabled}
            checked={!!j.festivos_incluidos}
            onChange={(e) => set({ festivos_incluidos: e.target.checked })}
          />
          <span className="text-slate-700">Festivos incluidos</span>
        </label>
      </div>
      {!j.festivos_incluidos && (
        <p className="text-xs text-slate-500">Se mostrará: Sin festivos</p>
      )}

      <div className="space-y-2">
        {tramos.map((t, idx) => (
          <div
            key={idx}
            className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
          >
            <label className="text-sm">
              <span className="text-slate-600">Días</span>
              <input
                disabled={disabled}
                className="mt-1 w-full border rounded-lg px-2 py-1.5"
                placeholder="Lunes a jueves"
                value={t.dias_label || ''}
                onChange={(e) => setTramo(idx, { dias_label: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Desde</span>
              <input
                type="time"
                disabled={disabled}
                className="mt-1 block border rounded-lg px-2 py-1.5"
                value={t.hora_inicio || ''}
                onChange={(e) => setTramo(idx, { hora_inicio: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Hasta</span>
              <input
                type="time"
                disabled={disabled}
                className="mt-1 block border rounded-lg px-2 py-1.5"
                value={t.hora_fin || ''}
                onChange={(e) => setTramo(idx, { hora_fin: e.target.value })}
              />
            </label>
            {!disabled && (
              <button
                type="button"
                className="text-xs text-red-600 border border-red-200 rounded-lg px-2 py-1.5"
                onClick={() => removeTramo(idx)}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border"
          onClick={addTramo}
        >
          + Tramo horario
        </button>
      )}
      <label className="block text-sm">
        <span className="text-slate-600">Observación</span>
        <input
          disabled={disabled}
          className="mt-1 w-full border rounded-lg px-2 py-1.5"
          value={j.observacion || ''}
          onChange={(e) => set({ observacion: e.target.value || null })}
        />
      </label>
    </div>
  );
}

export function DigitalesEditor({
  items,
  onSave,
  disabled,
  saveLabel = 'Guardar digitales',
}) {
  const [local, setLocal] = useState(() =>
    (items || []).map((d) => ({ ...d })),
  );

  const update = (idx, patch) => {
    setLocal((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const add = () =>
    setLocal((prev) => [
      ...prev,
      {
        codigo: `digital_${Date.now()}`,
        nombre: 'Nuevo servicio digital',
        precio_referencia_mensual: 25,
        descuento_pct: 100,
        descripcion: '',
        activo: true,
        orden: prev.length,
      },
    ]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          Servicios digitales
        </h3>
        {!disabled && (
          <button type="button" className="text-sm px-3 py-1.5 rounded-lg border" onClick={add}>
            + Añadir
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Vecindario u otros beneficios a nivel de documento. Con descuento 100%
        aparecen como Incluido y no suman al total.
      </p>
      {local.map((d, idx) => {
        const final =
          Math.round(
            (Number(d.precio_referencia_mensual) || 0) *
              (1 - Math.min(100, Math.max(0, Number(d.descuento_pct) || 0)) / 100) *
              100,
          ) / 100;
        const incluido = (Number(d.descuento_pct) || 0) >= 100 || final <= 0;
        return (
          <div key={d.codigo || idx} className="border border-slate-100 rounded-xl p-3 space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="text-slate-600">Nombre</span>
                <input
                  disabled={disabled}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5"
                  value={d.nombre || ''}
                  onChange={(e) => update(idx, { nombre: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Precio ref. €/mes</span>
                <input
                  type="number"
                  disabled={disabled}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5"
                  value={d.precio_referencia_mensual ?? 0}
                  onChange={(e) =>
                    update(idx, {
                      precio_referencia_mensual: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Descuento %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={disabled}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5"
                  value={d.descuento_pct ?? 0}
                  onChange={(e) =>
                    update(idx, { descuento_pct: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <div className="text-sm flex items-end pb-1.5">
                {incluido ? (
                  <span className="text-emerald-700 font-medium">Incluido</span>
                ) : (
                  <span>
                    Final: <strong>{final.toFixed(2)} €</strong>/mes
                  </span>
                )}
              </div>
            </div>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={d.activo !== false}
                onChange={(e) => update(idx, { activo: e.target.checked })}
              />
              Activo
            </label>
          </div>
        );
      })}
      {!disabled && (
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white"
          onClick={() => onSave(local)}
        >
          {saveLabel}
        </button>
      )}
    </div>
  );
}

export function formatJornadaPreview(j) {
  if (!j) return [];
  const lines = [];
  if (j.horas_semana != null && j.horas_semana !== '') {
    lines.push(`${j.horas_semana} horas/semana`);
  }
  for (const t of j.tramos || []) {
    if (t.dias_label && t.hora_inicio && t.hora_fin) {
      lines.push(`${t.dias_label}: ${t.hora_inicio}–${t.hora_fin}`);
    }
  }
  if (j.festivos_incluidos === false) lines.push('Sin festivos');
  else if (j.festivos_incluidos === true) lines.push('Festivos incluidos');
  return lines;
}
