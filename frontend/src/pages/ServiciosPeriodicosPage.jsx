import { useCallback, useEffect, useMemo, useState } from 'react';
import { routes } from '../utils/routes';
import { useAuth } from '../contexts/AuthContextBase';
import Back3DButton from '../components/Back3DButton.jsx';

const MESES = [
  { n: 1, short: 'Ene' },
  { n: 2, short: 'Feb' },
  { n: 3, short: 'Mar' },
  { n: 4, short: 'Abr' },
  { n: 5, short: 'May' },
  { n: 6, short: 'Jun' },
  { n: 7, short: 'Jul' },
  { n: 8, short: 'Ago' },
  { n: 9, short: 'Sep' },
  { n: 10, short: 'Oct' },
  { n: 11, short: 'Nov' },
  { n: 12, short: 'Dic' },
];

const FALLBACK_COLORS = [
  '#0ea5e9',
  '#f59e0b',
  '#a855f7',
  '#14b8a6',
  '#f43f5e',
  '#22c55e',
  '#f97316',
  '#6366f1',
];

function tipoColor(tipo, index = 0) {
  const c = (tipo?.color || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function authHeaders() {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function checkKey(clienteId, tipoId, mes) {
  return `${clienteId}:${tipoId}:${mes}`;
}

export default function ServiciosPeriodicosPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [an, setAn] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tipos, setTipos] = useState([]);
  const [tiposAll, setTiposAll] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [checksMap, setChecksMap] = useState(() => new Map());
  const [search, setSearch] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [cellModal, setCellModal] = useState(null);
  const [tiposModal, setTiposModal] = useState(false);
  const [newTipoNombre, setNewTipoNombre] = useState('');
  const [newTipoColor, setNewTipoColor] = useState('#0ea5e9');
  const [tiposBusy, setTiposBusy] = useState(false);

  const loadMatrix = useCallback(async (year) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${routes.serviciosPeriodicosMatrix}?an=${year}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setTipos(Array.isArray(data.tipos) ? data.tipos : []);
      setClientes(Array.isArray(data.clientes) ? data.clientes : []);
      const map = new Map();
      (data.checks || []).forEach((ch) => {
        if (ch.hecho) {
          map.set(checkKey(ch.cliente_id, ch.tipo_id, ch.mes), ch);
        }
      });
      setChecksMap(map);
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo cargar la matriz');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTiposAll = useCallback(async () => {
    try {
      const res = await fetch(`${routes.serviciosPeriodicosTipos}?all=1`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setTiposAll(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadMatrix(an);
  }, [an, loadMatrix]);

  const filteredClientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.nif || '').toLowerCase().includes(q) ||
        (c.poblacion || '').toLowerCase().includes(q),
    );
  }, [clientes, search]);

  const isHecho = (clienteId, tipoId, mes) =>
    checksMap.has(checkKey(clienteId, tipoId, mes));

  const doneCountForCell = (clienteId, mes) =>
    tipos.reduce((n, t) => n + (isHecho(clienteId, t.id, mes) ? 1 : 0), 0);

  const toggleCheck = async (clienteId, tipoId, mes, hecho) => {
    const key = checkKey(clienteId, tipoId, mes);
    setSavingKey(key);
    try {
      const res = await fetch(routes.serviciosPeriodicosChecks, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          cliente_id: clienteId,
          tipo_id: tipoId,
          an,
          mes,
          hecho,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const saved = await res.json();
      setChecksMap((prev) => {
        const next = new Map(prev);
        if (hecho) next.set(key, saved);
        else next.delete(key);
        return next;
      });
    } catch (e) {
      console.error(e);
      alert(e.message || 'Error al guardar');
    } finally {
      setSavingKey('');
    }
  };

  const openTiposModal = async () => {
    setTiposModal(true);
    await loadTiposAll();
  };

  const handleCreateTipo = async () => {
    const nombre = newTipoNombre.trim();
    if (!nombre) return;
    setTiposBusy(true);
    try {
      const res = await fetch(routes.serviciosPeriodicosTipos, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ nombre, color: newTipoColor }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      setNewTipoNombre('');
      setNewTipoColor('#0ea5e9');
      await loadTiposAll();
      await loadMatrix(an);
    } catch (e) {
      alert(e.message || 'Error al crear tipo');
    } finally {
      setTiposBusy(false);
    }
  };

  const handleChangeTipoColor = async (tipo, color) => {
    setTiposBusy(true);
    try {
      const res = await fetch(routes.serviciosPeriodicoTipo(tipo.id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      await loadTiposAll();
      await loadMatrix(an);
    } catch (e) {
      alert(e.message || 'Error al cambiar color');
    } finally {
      setTiposBusy(false);
    }
  };

  const handleToggleTipoActivo = async (tipo) => {
    setTiposBusy(true);
    try {
      const res = await fetch(routes.serviciosPeriodicoTipo(tipo.id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ activo: !tipo.activo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      await loadTiposAll();
      await loadMatrix(an);
    } catch (e) {
      alert(e.message || 'Error al actualizar tipo');
    } finally {
      setTiposBusy(false);
    }
  };

  const handleRenameTipo = async (tipo) => {
    const nombre = window.prompt('Nuevo nombre del tipo:', tipo.nombre);
    if (nombre == null) return;
    const trimmed = nombre.trim();
    if (!trimmed || trimmed === tipo.nombre) return;
    setTiposBusy(true);
    try {
      const res = await fetch(routes.serviciosPeriodicoTipo(tipo.id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ nombre: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      await loadTiposAll();
      await loadMatrix(an);
    } catch (e) {
      alert(e.message || 'Error al renombrar');
    } finally {
      setTiposBusy(false);
    }
  };

  const years = useMemo(() => {
    const list = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y -= 1) list.push(y);
    return list;
  }, [currentYear]);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servicios periódicos</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Seguimiento mensual por comunidad (cristales, garajes, abrillantado…).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
            Año
            <select
              value={an}
              onChange={(e) => setAn(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={openTiposModal}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Gestionar tipos
          </button>
          <button
            type="button"
            onClick={() => loadMatrix(an)}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Actualizar
          </button>
        </div>
      </div>

      {tipos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tipos.map((t, i) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tipoColor(t, i) }}
              />
              {t.nombre}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar comunidad, NIF o población…"
          className="w-full md:w-96 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Cargando matriz…</div>
      ) : filteredClientes.length === 0 ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          No hay comunidades{search ? ' con ese filtro' : ''}.
        </div>
      ) : (
        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm max-h-[70vh]">
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 text-left px-3 py-2 border-b border-r border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 min-w-[220px]">
                  Comunidad ({filteredClientes.length})
                </th>
                {MESES.map((m) => (
                  <th
                    key={m.n}
                    className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-center min-w-[72px]"
                  >
                    {m.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClientes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/80">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 border-b border-r border-gray-100 dark:border-gray-800 align-top">
                    <div className="font-medium text-gray-900 dark:text-gray-100 leading-snug">{c.nombre}</div>
                    {(c.poblacion || c.nif) && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {[c.poblacion, c.nif].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  {MESES.map((m) => {
                    const done = doneCountForCell(c.id, m.n);
                    const total = tipos.length || 1;
                    return (
                      <td key={m.n} className="px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setCellModal({ cliente: c, mes: m.n })}
                          className={`w-full min-h-[40px] rounded-lg border px-1 py-1 transition ${
                            done === 0
                              ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                              : done >= total
                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:border-emerald-400'
                                : 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:border-amber-300'
                          }`}
                          title={`${done}/${tipos.length} servicios`}
                        >
                          <div className="flex flex-wrap justify-center gap-0.5">
                            {tipos.length === 0 ? (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">—</span>
                            ) : (
                              tipos.map((t, i) => {
                                const doneDot = isHecho(c.id, t.id, m.n);
                                return (
                                  <span
                                    key={t.id}
                                    className={`w-2 h-2 rounded-full ${doneDot ? '' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    style={doneDot ? { backgroundColor: tipoColor(t, i) } : undefined}
                                    title={t.nombre}
                                  />
                                );
                              })
                            )}
                          </div>
                          {tipos.length > 0 && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {done}/{tipos.length}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cellModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setCellModal(null)}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-5 border border-transparent dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{cellModal.cliente.nombre}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {MESES.find((m) => m.n === cellModal.mes)?.short} {an}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCellModal(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            {tipos.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay tipos activos. Usa «Gestionar tipos» para añadirlos.
              </p>
            ) : (
              <ul className="space-y-2">
                {tipos.map((t, i) => {
                  const hecho = isHecho(cellModal.cliente.id, t.id, cellModal.mes);
                  const key = checkKey(cellModal.cliente.id, t.id, cellModal.mes);
                  const busy = savingKey === key;
                  return (
                    <li key={t.id}>
                      <label
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          hecho
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        } ${busy ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={hecho}
                          disabled={busy}
                          onChange={(e) =>
                            toggleCheck(
                              cellModal.cliente.id,
                              t.id,
                              cellModal.mes,
                              e.target.checked,
                            )
                          }
                          className="w-4 h-4"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tipoColor(t, i) }}
                        />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{t.nombre}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4">
              {user?.CODIGO || user?.['NOMBRE / APELLIDOS'] || ''} — los cambios se guardan al marcar.
            </p>
          </div>
        </div>
      )}

      {tiposModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setTiposModal(false)}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[85vh] overflow-auto border border-transparent dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">Tipos de servicio</h2>
              <button
                type="button"
                onClick={() => setTiposModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex gap-2 mb-4 items-center">
              <input
                type="color"
                value={newTipoColor}
                onChange={(e) => setNewTipoColor(e.target.value)}
                title="Color"
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={newTipoNombre}
                onChange={(e) => setNewTipoNombre(e.target.value)}
                placeholder="Nuevo tipo (ej. Limpieza de azotea)"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTipo();
                }}
              />
              <button
                type="button"
                disabled={tiposBusy || !newTipoNombre.trim()}
                onClick={handleCreateTipo}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>

            <ul className="space-y-2">
              {tiposAll.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Sin tipos todavía.</li>
              ) : (
                tiposAll.map((t, i) => (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                      t.activo
                        ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="color"
                        value={tipoColor(t, i)}
                        disabled={tiposBusy}
                        onChange={(e) => handleChangeTipoColor(t, e.target.value)}
                        title="Cambiar color"
                        className="w-9 h-9 rounded border border-gray-300 dark:border-gray-600 bg-transparent cursor-pointer shrink-0 disabled:opacity-50"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.nombre}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {t.activo ? 'Activo' : 'Inactivo'} · orden {t.orden}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={tiposBusy}
                        onClick={() => handleRenameTipo(t)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        disabled={tiposBusy}
                        onClick={() => handleToggleTipoActivo(t)}
                        className={`px-2 py-1 text-xs rounded border ${
                          t.activo
                            ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                            : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        {t.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4">
              Desactivar oculta el tipo de la matriz pero conserva el historial marcado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
