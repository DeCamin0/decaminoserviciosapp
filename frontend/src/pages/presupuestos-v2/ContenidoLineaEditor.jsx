import { useEffect, useState } from 'react';

function emptyContenido() {
  return {
    titulo_comercial: '',
    descripcion_comercial: '',
    operativa: [],
    tareas: [],
    tareas_auxiliares: [],
    tareas_limpieza: [],
    servicios_periodicos: [],
    condiciones_especificas: [],
    periodicidad: '',
    template_key: '',
  };
}

function LinesEditor({ label, items, onChange, disabled, placeholder }) {
  const list = Array.isArray(items) ? items : [];
  const setAt = (idx, value) => {
    const next = list.map((x, i) => (i === idx ? value : x));
    onChange(next);
  };
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </h6>
        {!disabled && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border"
            onClick={() => onChange([...list, ''])}
          >
            + Añadir
          </button>
        )}
      </div>
      {list.length === 0 && (
        <p className="text-xs text-slate-400">Ningún elemento</p>
      )}
      {list.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <textarea
            disabled={disabled}
            rows={2}
            className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            placeholder={placeholder || 'Texto'}
            value={item}
            onChange={(e) => setAt(idx, e.target.value)}
          />
          {!disabled && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="text-xs px-1.5 py-0.5 border rounded"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="text-xs px-1.5 py-0.5 border rounded"
                onClick={() => move(idx, 1)}
                disabled={idx === list.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                className="text-xs px-1.5 py-0.5 border rounded text-red-600"
                onClick={() => remove(idx)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PeriodicosEditor({ items, onChange, disabled }) {
  const list = Array.isArray(items) ? items : [];
  const setAt = (idx, patch) => {
    onChange(list.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next.map((p, i) => ({ ...p, orden: i })));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Servicios periódicos incluidos
        </h6>
        {!disabled && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border"
            onClick={() =>
              onChange([
                ...list,
                {
                  nombre: '',
                  periodicidad: '',
                  descripcion: '',
                  orden: list.length,
                },
              ])
            }
          >
            + Añadir
          </button>
        )}
      </div>
      {list.map((p, idx) => (
        <div
          key={idx}
          className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 border border-slate-100 rounded-lg p-2"
        >
          <input
            disabled={disabled}
            className="border rounded-lg px-2 py-1.5 text-sm"
            placeholder="Nombre (ej. Cristales)"
            value={p.nombre || ''}
            onChange={(e) => setAt(idx, { nombre: e.target.value })}
          />
          <input
            disabled={disabled}
            className="border rounded-lg px-2 py-1.5 text-sm"
            placeholder="Periodicidad (ej. trimestral)"
            value={p.periodicidad || ''}
            onChange={(e) => setAt(idx, { periodicidad: e.target.value })}
          />
          {!disabled && (
            <div className="flex gap-1 items-center">
              <button
                type="button"
                className="text-xs px-1.5 py-1 border rounded"
                onClick={() => move(idx, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="text-xs px-1.5 py-1 border rounded"
                onClick={() => move(idx, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="text-xs px-1.5 py-1 border rounded text-red-600"
                onClick={() => remove(idx)}
              >
                ×
              </button>
            </div>
          )}
          <input
            disabled={disabled}
            className="sm:col-span-3 border rounded-lg px-2 py-1.5 text-sm"
            placeholder="Descripción (opcional)"
            value={p.descripcion || ''}
            onChange={(e) => setAt(idx, { descripcion: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

/** Human editor for per-presupuesto commercial content (not catalog). */
export function ContenidoLineaEditor({
  value,
  personalizado,
  disabled,
  onSave,
  onRestore,
}) {
  const [local, setLocal] = useState(() => ({
    ...emptyContenido(),
    ...(value || {}),
  }));

  useEffect(() => {
    setLocal({ ...emptyContenido(), ...(value || {}) });
  }, [value]);

  const set = (patch) => setLocal((prev) => ({ ...prev, ...patch }));

  const isCombined =
    (local.tareas_auxiliares || []).length > 0 ||
    (local.tareas_limpieza || []).length > 0 ||
    local.template_key === 'auxiliar_limpieza';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-slate-800">
          Contenido del servicio
        </h5>
        {personalizado && (
          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            Personalizado para este presupuesto
          </span>
        )}
      </div>

      <label className="block text-sm">
        <span className="text-slate-600">Título comercial</span>
        <input
          disabled={disabled}
          className="mt-1 w-full border rounded-lg px-2 py-1.5"
          value={local.titulo_comercial || ''}
          onChange={(e) => set({ titulo_comercial: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">Descripción</span>
        <textarea
          disabled={disabled}
          rows={2}
          className="mt-1 w-full border rounded-lg px-2 py-1.5"
          value={local.descripcion_comercial || ''}
          onChange={(e) => set({ descripcion_comercial: e.target.value })}
        />
      </label>

      <LinesEditor
        label="Operativa"
        items={local.operativa}
        disabled={disabled}
        onChange={(operativa) => set({ operativa })}
      />

      {isCombined ? (
        <>
          <LinesEditor
            label="Tareas de Auxiliar de Servicios"
            items={local.tareas_auxiliares}
            disabled={disabled}
            onChange={(tareas_auxiliares) => set({ tareas_auxiliares })}
          />
          <LinesEditor
            label="Tareas de Limpieza"
            items={local.tareas_limpieza}
            disabled={disabled}
            onChange={(tareas_limpieza) => set({ tareas_limpieza })}
          />
        </>
      ) : (
        <LinesEditor
          label="Tareas"
          items={local.tareas}
          disabled={disabled}
          onChange={(tareas) => set({ tareas })}
        />
      )}

      <PeriodicosEditor
        items={local.servicios_periodicos}
        disabled={disabled}
        onChange={(servicios_periodicos) => set({ servicios_periodicos })}
      />

      <LinesEditor
        label="Condiciones específicas"
        items={local.condiciones_especificas}
        disabled={disabled}
        onChange={(condiciones_especificas) =>
          set({ condiciones_especificas })
        }
      />

      {!disabled && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white"
            onClick={() => onSave(local)}
          >
            Guardar contenido
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300"
            onClick={() => {
              if (
                window.confirm(
                  '¿Restaurar el contenido desde la plantilla actual de Configuración? Se perderán los cambios locales de este servicio.',
                )
              ) {
                onRestore();
              }
            }}
          >
            Restaurar desde plantilla
          </button>
        </div>
      )}
    </div>
  );
}
