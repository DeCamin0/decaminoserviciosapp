import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, LogOut, RefreshCw } from 'lucide-react';
import { routes } from '../utils/routes';

const TIPOS_DOCUMENTO = [
  { value: 'EVALUACION_RIESGOS', label: 'Evaluación de Riesgos Laborales', requiereFirma: false },
  { value: 'ACTA_INFORMATIVA', label: 'Acta Informativa del Puesto', requiereFirma: true },
  { value: 'CERTIFICADO', label: 'Certificado (Art. 18 / Información recibida)', requiereFirma: true },
  { value: 'ENTREGA_EPIS', label: 'Entrega de EPIs', requiereFirma: true },
  { value: 'RENUNCIA_RM', label: 'Renuncia Reconocimiento Médico', requiereFirma: true },
  { value: 'MANUAL_TEST', label: 'Manual del Puesto + Test', requiereFirma: true },
];

const TOKEN_KEY = 'prl_matrix_share_token';
const NAME_KEY = 'prl_matrix_share_display_name';
const POLL_MS = 30000;

function normalizeMatrixSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function countDocsByEstado(empleado, estado) {
  const docs = empleado?.documentos || [];
  if (estado === 'SIN_DOC') {
    return TIPOS_DOCUMENTO.filter(
      (t) => !docs.some((d) => d.tipo_documento === t.value),
    ).length;
  }
  return docs.filter((d) => d.estado === estado).length;
}

function getEstadoColor(estado, requiereFirma) {
  if (!requiereFirma) return 'bg-gray-100 text-gray-700';
  switch (estado) {
    case 'FIRMADO':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'PENDIENTE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'NO_APLICA':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

function getEstadoLabel(estado) {
  switch (estado) {
    case 'FIRMADO':
      return 'Firmado';
    case 'PENDIENTE':
      return 'Pendiente';
    case 'NO_APLICA':
      return 'No aplica';
    case 'RECHAZADO':
      return 'Rechazado';
    case 'INFORMATIVO':
      return 'Informativo';
    default:
      return estado || '—';
  }
}

export default function PrlMatrixSharePage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(NAME_KEY) || '',
  );
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixGruposSelected, setMatrixGruposSelected] = useState([]);
  const [matrixGrupoMode, setMatrixGrupoMode] = useState('solo');
  const [matrixEstadoFilter, setMatrixEstadoFilter] = useState('todos');
  const [matrixSort, setMatrixSort] = useState([]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    setToken('');
    setDisplayName('');
    setEmpleados([]);
  }, []);

  const cargarMatrix = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(routes.prlMatrixShareMatrix, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setLoginError('Sesión expirada. Introduce la contraseña de nuevo.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setEmpleados(Array.isArray(data.empleados) ? data.empleados : []);
      if (data.displayName) {
        setDisplayName(data.displayName);
        localStorage.setItem(NAME_KEY, data.displayName);
      }
      setLastUpdated(new Date());
    } catch (e) {
      setLoadError(e.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!token) return undefined;
    cargarMatrix();
    const id = window.setInterval(() => {
      cargarMatrix();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [token, cargarMatrix]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(routes.prlMatrixShareLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Contraseña incorrecta',
        );
      }
      const access = data.access_token;
      if (!access) throw new Error('Respuesta inválida del servidor');
      localStorage.setItem(TOKEN_KEY, access);
      localStorage.setItem(NAME_KEY, data.displayName || '');
      setToken(access);
      setDisplayName(data.displayName || '');
      setPassword('');
    } catch (err) {
      setLoginError(err.message || 'Error de acceso');
    } finally {
      setLoginLoading(false);
    }
  };

  const matrixGrupos = useMemo(() => {
    const set = new Set();
    empleados.forEach((emp) => {
      const g = String(emp.grupo_nombre || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [empleados]);

  const matrixFiltrados = useMemo(() => {
    const q = normalizeMatrixSearch(matrixSearch);
    return empleados.filter((emp) => {
      if (q) {
        const hay = normalizeMatrixSearch(
          `${emp.empleado_nombre || ''} ${emp.empleado_id || ''} ${emp.grupo_nombre || ''} ${emp.empleado_dni || ''}`,
        );
        if (!hay.includes(q)) return false;
      }
      if (matrixGruposSelected.length > 0) {
        const g = String(emp.grupo_nombre || '').trim();
        const inSelected = matrixGruposSelected.includes(g);
        if (matrixGrupoMode === 'excluir') {
          if (inSelected) return false;
        } else if (!inSelected) {
          return false;
        }
      }
      if (matrixEstadoFilter === 'PENDIENTE') {
        if (countDocsByEstado(emp, 'PENDIENTE') === 0) return false;
      } else if (matrixEstadoFilter === 'FIRMADO') {
        if (countDocsByEstado(emp, 'FIRMADO') === 0) return false;
      } else if (matrixEstadoFilter === 'SIN_DOC') {
        if (countDocsByEstado(emp, 'SIN_DOC') === 0) return false;
      }
      return true;
    });
  }, [
    empleados,
    matrixSearch,
    matrixGruposSelected,
    matrixGrupoMode,
    matrixEstadoFilter,
  ]);

  const matrixVista = useMemo(() => {
    const list = [...matrixFiltrados];
    if (!matrixSort.length) return list;
    list.sort((a, b) => {
      for (const rule of matrixSort) {
        let va;
        let vb;
        if (rule.key === 'nombre') {
          va = String(a.empleado_nombre || '');
          vb = String(b.empleado_nombre || '');
        } else if (rule.key === 'grupo') {
          va = String(a.grupo_nombre || '');
          vb = String(b.grupo_nombre || '');
        } else if (rule.key === 'pendientes') {
          va = countDocsByEstado(a, 'PENDIENTE');
          vb = countDocsByEstado(b, 'PENDIENTE');
        } else if (rule.key === 'firmados') {
          va = countDocsByEstado(a, 'FIRMADO');
          vb = countDocsByEstado(b, 'FIRMADO');
        } else {
          continue;
        }
        let cmp =
          typeof va === 'number'
            ? va - vb
            : va.localeCompare(vb, 'es', { sensitivity: 'base', numeric: true });
        if (rule.dir === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return list;
  }, [matrixFiltrados, matrixSort]);

  const toggleMatrixSort = useCallback((key) => {
    setMatrixSort((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.dir === 'asc') {
          const next = [...prev];
          next[idx] = { key, dir: 'desc' };
          return next;
        }
        return prev.filter((_, i) => i !== idx);
      }
      const next = [...prev, { key, dir: 'asc' }];
      return next.slice(-2);
    });
  }, []);

  const renderMatrixSortBtn = (key, label) => {
    const ruleIdx = matrixSort.findIndex((r) => r.key === key);
    const rule = ruleIdx >= 0 ? matrixSort[ruleIdx] : null;
    const Icon = !rule ? ArrowUpDown : rule.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleMatrixSort(key)}
        className="inline-flex items-center gap-0.5 font-semibold hover:underline"
        title={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
        {ruleIdx >= 0 && (
          <span className="text-[9px] font-bold">{ruleIdx + 1}</span>
        )}
      </button>
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-xl font-bold text-slate-900">
            Matrix Estado PRL
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acceso de lectura — DeCamino Servicios
          </p>
          <label className="mt-6 block text-sm font-medium text-slate-700">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="current-password"
              required
            />
          </label>
          {loginError ? (
            <p className="mt-3 text-sm text-red-600">{loginError}</p>
          ) : null}
          <button
            type="submit"
            disabled={loginLoading}
            className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loginLoading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Matrix de Estado de Documentos PRL
            </h1>
            <p className="text-sm text-slate-600">
              Conectado:{' '}
              <span className="font-semibold text-slate-900">
                {displayName || 'Invitado'}
              </span>
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Solo procesado + diploma
              </span>
            </p>
            {lastUpdated ? (
              <p className="text-xs text-slate-400">
                Actualizado:{' '}
                {lastUpdated.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}{' '}
                (auto cada 30s)
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cargarMatrix()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Actualizar
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {loadError ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              placeholder="Buscar por nombre, código, grupo o DNI…"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'PENDIENTE', label: 'Con pendiente' },
              { id: 'FIRMADO', label: 'Con firmado' },
              { id: 'SIN_DOC', label: 'Sin algún doc' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMatrixEstadoFilter(opt.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  matrixEstadoFilter === opt.id
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'solo', label: 'Solo' },
              { id: 'excluir', label: 'Excluir' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={matrixGruposSelected.length === 0}
                onClick={() => setMatrixGrupoMode(opt.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                  matrixGrupoMode === opt.id
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {matrixGrupos.map((g) => {
              const active = matrixGruposSelected.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setMatrixGruposSelected((prev) =>
                      prev.includes(g)
                        ? prev.filter((x) => x !== g)
                        : [...prev, g],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    active
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          {loading && empleados.length === 0 ? (
            <div className="py-16 text-center text-slate-500">Cargando…</div>
          ) : (
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="sticky left-0 z-10 border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold">
                    <div className="flex flex-col gap-1">
                      {renderMatrixSortBtn('nombre', 'Empleado')}
                      <span className="text-[10px] font-normal text-gray-500">
                        {renderMatrixSortBtn('grupo', 'Grupo')}
                        {' · '}
                        {renderMatrixSortBtn('pendientes', 'Pend.')}
                        {' · '}
                        {renderMatrixSortBtn('firmados', 'Firm.')}
                      </span>
                    </div>
                  </th>
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <th
                      key={tipo.value}
                      className="border border-gray-300 px-3 py-2 text-center text-xs font-semibold"
                    >
                      {tipo.label}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-semibold whitespace-nowrap">
                    Procesado
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-xs font-semibold whitespace-nowrap">
                    Diploma
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixVista.map((empleado) => (
                  <tr key={empleado.empleado_id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 border border-gray-300 bg-white px-4 py-2 font-medium">
                      <div className="font-semibold">
                        {empleado.empleado_nombre}
                      </div>
                      <div className="text-xs text-gray-500">
                        {empleado.grupo_nombre}
                      </div>
                      {empleado.empleado_dni ? (
                        <div className="mt-0.5 text-xs text-gray-500">
                          DNI/NIE: {empleado.empleado_dni}
                        </div>
                      ) : null}
                    </td>
                    {TIPOS_DOCUMENTO.map((tipo) => {
                      const documento = (empleado.documentos || []).find(
                        (d) => d.tipo_documento === tipo.value,
                      );
                      return (
                        <td
                          key={tipo.value}
                          className="border border-gray-300 px-2 py-2 text-center"
                        >
                          {documento ? (
                            <span
                              className={`inline-block rounded border px-2 py-1 text-xs font-medium ${getEstadoColor(
                                documento.estado,
                                documento.requiere_firma,
                              )}`}
                            >
                              {getEstadoLabel(documento.estado)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!empleado.procesado}
                        onChange={async (e) => {
                          const next = e.target.checked;
                          try {
                            const res = await fetch(
                              routes.prlMatrixShareProcesado(empleado.empleado_id),
                              {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ procesado: next }),
                              },
                            );
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.message || 'Error');
                            }
                            setEmpleados((prev) =>
                              prev.map((row) =>
                                row.empleado_id === empleado.empleado_id
                                  ? { ...row, procesado: next }
                                  : row,
                              ),
                            );
                          } catch (err) {
                            e.target.checked = !next;
                            setLoadError(err.message || 'Error al guardar');
                          }
                        }}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {empleado.diplomas_count > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            {empleado.diplomas_count} diploma
                            {empleado.diplomas_count > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Sin diploma
                          </span>
                        )}
                        <label className="cursor-pointer rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50">
                          Subir
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={async (ev) => {
                              const file = ev.target.files?.[0];
                              ev.target.value = '';
                              if (!file) return;
                              try {
                                const fd = new FormData();
                                fd.append('archivo', file);
                                const res = await fetch(
                                  routes.prlMatrixShareDiploma(
                                    empleado.empleado_id,
                                  ),
                                  {
                                    method: 'POST',
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: fd,
                                  },
                                );
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({}));
                                  throw new Error(
                                    err.message || 'Error al subir',
                                  );
                                }
                                setEmpleados((prev) =>
                                  prev.map((row) =>
                                    row.empleado_id === empleado.empleado_id
                                      ? {
                                          ...row,
                                          diplomas_count:
                                            (row.diplomas_count || 0) + 1,
                                        }
                                      : row,
                                  ),
                                );
                              } catch (err) {
                                setLoadError(err.message || 'Error');
                              }
                            }}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && matrixVista.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              Ningún empleado coincide con los filtros
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
