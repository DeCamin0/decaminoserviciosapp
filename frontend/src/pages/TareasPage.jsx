import { useCallback, useEffect, useState } from 'react';
import { routes } from '../utils/routes';
import Back3DButton from '../components/Back3DButton.jsx';
import { Button, Modal } from '../components/ui';
import activityLogger from '../utils/activityLogger';
import { useAuth } from '../contexts/AuthContextBase';

function authHeaders(json = true) {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  const h = {
    'X-App-Source': 'DeCamino-Web-App',
    'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Error ${res.status}`);
  }
  return data;
}

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
};

const PRIORIDAD_LABEL = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

function estadoClass(estado) {
  switch (estado) {
    case 'hecha':
      return 'bg-emerald-100 text-emerald-800';
    case 'en_curso':
      return 'bg-sky-100 text-sky-800';
    case 'cancelada':
      return 'bg-gray-200 text-gray-600';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

function prioridadClass(p) {
  switch (p) {
    case 'urgente':
      return 'bg-red-100 text-red-800';
    case 'alta':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function TareasPage() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (estadoFilter) params.set('estado', estadoFilter);
      if (q.trim()) params.set('q', q.trim());
      const url = params.toString() ? `${routes.tareas}?${params}` : routes.tareas;
      const data = await apiJson(url, { headers: authHeaders() });
      setTareas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las tareas');
    } finally {
      setLoading(false);
    }
  }, [estadoFilter, q]);

  useEffect(() => {
    activityLogger.logPageAccess('tareas', user);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const patchEstado = async (id, estado) => {
    setBusyId(id);
    try {
      await apiJson(routes.tarea(id), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ estado }),
      });
      await load();
      if (detail?.id === id) {
        setDetail((d) => (d ? { ...d, estado } : d));
      }
    } catch (e) {
      setError(e.message || 'No se pudo actualizar');
    } finally {
      setBusyId(null);
    }
  };

  const openFoto = async (tareaId, fotoId) => {
    try {
      const data = await apiJson(routes.tareaFotoUrl(tareaId, fotoId), {
        headers: authHeaders(),
      });
      if (data?.url) setPreviewUrl(data.url);
    } catch (e) {
      setError(e.message || 'No se pudo abrir la foto');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Back3DButton />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
            <p className="text-sm text-slate-600">
              Seguimiento de solicitudes asignadas al equipo
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar título, centro, empleado…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)]"
          />
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="hecha">Hecha</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Actualizar
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-500">Cargando…</div>
        ) : tareas.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No hay tareas con estos filtros.</p>
        ) : (
          <ul className="space-y-3">
            {tareas.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <button
                    type="button"
                    className="text-left font-semibold text-slate-900 hover:underline"
                    onClick={() => setDetail(t)}
                  >
                    {t.titulo}
                  </button>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${estadoClass(t.estado)}`}>
                      {ESTADO_LABEL[t.estado] || t.estado}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadClass(t.prioridad)}`}>
                      {PRIORIDAD_LABEL[t.prioridad] || t.prioridad}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-slate-600 mb-2">
                  <span className="font-medium">{t.nombre_asignado || t.codigo_asignado}</span>
                  {(t.centro || t.zona) && (
                    <span className="text-slate-400"> · {[t.centro, t.zona].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
                {t.descripcion && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">{t.descripcion}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {t.estado !== 'hecha' && t.estado !== 'cancelada' && (
                    <Button
                      variant="secondary"
                      onClick={() => patchEstado(t.id, 'cancelada')}
                      disabled={busyId === t.id}
                      loading={busyId === t.id}
                    >
                      Cancelar
                    </Button>
                  )}
                  {t.estado === 'cancelada' && (
                    <Button
                      variant="secondary"
                      onClick={() => patchEstado(t.id, 'pendiente')}
                      disabled={busyId === t.id}
                    >
                      Reabrir
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => setDetail(t)}>
                    Ver detalle
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detalle de tarea"
        size="lg"
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <h3 className="text-lg font-semibold text-slate-900">{detail.titulo}</h3>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${estadoClass(detail.estado)}`}>
                {ESTADO_LABEL[detail.estado] || detail.estado}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadClass(detail.prioridad)}`}>
                {PRIORIDAD_LABEL[detail.prioridad] || detail.prioridad}
              </span>
            </div>
            {detail.descripcion && (
              <p className="text-slate-700 whitespace-pre-wrap">{detail.descripcion}</p>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              <div>
                <dt className="text-xs uppercase text-slate-400">Asignado</dt>
                <dd>{detail.nombre_asignado || detail.codigo_asignado}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Creado por</dt>
                <dd>{detail.nombre_creador || detail.codigo_creador}</dd>
              </div>
              {(detail.centro || detail.zona) && (
                <div>
                  <dt className="text-xs uppercase text-slate-400">Ubicación</dt>
                  <dd>{[detail.centro, detail.zona].filter(Boolean).join(' · ')}</dd>
                </div>
              )}
              {detail.fecha_limite && (
                <div>
                  <dt className="text-xs uppercase text-slate-400">Límite</dt>
                  <dd>{new Date(detail.fecha_limite).toLocaleString()}</dd>
                </div>
              )}
              {detail.completado_at && (
                <div>
                  <dt className="text-xs uppercase text-slate-400">Completado</dt>
                  <dd>{new Date(detail.completado_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
            {detail.nota_completado && (
              <div>
                <p className="text-xs uppercase text-slate-400">Nota de cierre</p>
                <p className="text-slate-700">{detail.nota_completado}</p>
              </div>
            )}
            {detail.fotos?.length > 0 && (
              <div>
                <p className="text-xs uppercase text-slate-400 mb-2">Fotos</p>
                <div className="flex flex-wrap gap-2">
                  {detail.fotos.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => openFoto(detail.id, f.id)}
                      className="text-xs px-2 py-1 rounded bg-slate-50 border border-slate-200 text-sky-700 hover:bg-sky-50"
                    >
                      {f.nombre_original || `Foto ${f.id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {detail.estado !== 'cancelada' && detail.estado !== 'hecha' && (
                <Button
                  variant="secondary"
                  onClick={() => patchEstado(detail.id, 'cancelada')}
                  disabled={busyId === detail.id}
                >
                  Cancelar tarea
                </Button>
              )}
              <Button variant="primary" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(previewUrl)}
        onClose={() => setPreviewUrl(null)}
        title="Foto"
        size="lg"
      >
        {previewUrl && (
          <img src={previewUrl} alt="Evidencia" className="max-h-[70vh] w-full object-contain rounded-lg" />
        )}
      </Modal>
    </div>
  );
}
