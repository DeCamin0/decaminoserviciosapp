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

export default function MisTareasPage() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [nota, setNota] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson(routes.tareasMias, { headers: authHeaders() });
      setTareas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las tareas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    activityLogger.logPageAccess('mis-tareas', user);
    load();
  }, [load, user]);

  const markEnCurso = async (id) => {
    setBusyId(id);
    try {
      await apiJson(routes.tarea(id), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ estado: 'en_curso' }),
      });
      await load();
    } catch (e) {
      setError(e.message || 'No se pudo actualizar');
    } finally {
      setBusyId(null);
    }
  };

  const openCompletar = (tarea) => {
    setCompleting(tarea);
    setNota('');
    setFiles([]);
  };

  const submitCompletar = async () => {
    if (!completing) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (nota.trim()) fd.append('nota_completado', nota.trim());
      for (const f of files) fd.append('files', f);
      await apiJson(routes.tareaCompletar(completing.id), {
        method: 'POST',
        headers: authHeaders(false),
        body: fd,
      });
      setCompleting(null);
      await load();
    } catch (e) {
      setError(e.message || 'No se pudo completar la tarea');
    } finally {
      setSubmitting(false);
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

  const activas = tareas.filter((t) => t.estado === 'pendiente' || t.estado === 'en_curso');
  const historial = tareas.filter((t) => t.estado === 'hecha' || t.estado === 'cancelada');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Back3DButton />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mis tareas</h1>
            <p className="text-sm text-slate-600">Confirma y documenta el trabajo asignado</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-500">Cargando tareas…</div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                Pendientes ({activas.length})
              </h2>
              {activas.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">No tienes tareas pendientes.</p>
              ) : (
                <ul className="space-y-3">
                  {activas.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900">{t.titulo}</h3>
                        <div className="flex gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${estadoClass(t.estado)}`}>
                            {ESTADO_LABEL[t.estado] || t.estado}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadClass(t.prioridad)}`}>
                            {PRIORIDAD_LABEL[t.prioridad] || t.prioridad}
                          </span>
                        </div>
                      </div>
                      {t.descripcion && (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap mb-2">{t.descripcion}</p>
                      )}
                      <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                        {(t.centro || t.zona) && (
                          <p>
                            {[t.centro, t.zona].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {t.fecha_limite && (
                          <p>Límite: {new Date(t.fecha_limite).toLocaleString()}</p>
                        )}
                        {t.nombre_creador && <p>Asignada por: {t.nombre_creador}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.estado === 'pendiente' && (
                          <Button
                            variant="secondary"
                            onClick={() => markEnCurso(t.id)}
                            disabled={busyId === t.id}
                            loading={busyId === t.id}
                          >
                            Empezar
                          </Button>
                        )}
                        <Button variant="primary" onClick={() => openCompletar(t)}>
                          Completar con fotos
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                Historial ({historial.length})
              </h2>
              {historial.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">Sin historial aún.</p>
              ) : (
                <ul className="space-y-3">
                  {historial.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-slate-800">{t.titulo}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoClass(t.estado)}`}>
                          {ESTADO_LABEL[t.estado] || t.estado}
                        </span>
                      </div>
                      {t.nota_completado && (
                        <p className="text-sm text-slate-600 mt-1">{t.nota_completado}</p>
                      )}
                      {t.fotos?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {t.fotos.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => openFoto(t.id, f.id)}
                              className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-sky-700 hover:bg-sky-50"
                            >
                              Ver foto {f.id}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <Modal
        isOpen={Boolean(completing)}
        onClose={() => !submitting && setCompleting(null)}
        title="Completar tarea"
        size="md"
      >
        {completing && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-800">{completing.titulo}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                placeholder="Qué se hizo, observaciones…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fotos (recomendado)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-slate-600"
              />
              {files.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{files.length} archivo(s)</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCompleting(null)} disabled={submitting}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={submitCompletar} loading={submitting} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Marcar hecha'}
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
