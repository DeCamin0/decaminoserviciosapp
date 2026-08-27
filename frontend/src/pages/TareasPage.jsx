import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../utils/routes';
import { PageHeader, AlertBanner, Modal } from '../components/ui';
import { RefreshCw, Eye, XCircle, RotateCcw } from 'lucide-react';
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

function estadoStatusClass(estado) {
  switch (estado) {
    case 'hecha':
      return 'solicitud-status--ok';
    case 'en_curso':
      return 'solicitud-status--neutral';
    case 'cancelada':
      return 'solicitud-status--anulada';
    default:
      return 'solicitud-status--pendiente';
  }
}

function prioridadTextClass(p) {
  switch (p) {
    case 'urgente':
      return 'tareas-priority--urgente';
    case 'alta':
      return 'tareas-priority--alta';
    default:
      return '';
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
    <div className="app-page tareas-page">
      <PageHeader
        title="Tareas"
        subtitle="Seguimiento de solicitudes asignadas al equipo"
        backTo="/inicio"
        actions={(
          <button type="button" onClick={load} disabled={loading} className="solicitud-admin-btn" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        )}
      />

      <div className="tareas-filter-bar app-card app-card--pad">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar título, centro, empleado…"
          aria-label="Buscar tareas"
        />
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_curso">En curso</option>
          <option value="hecha">Hecha</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {error && <AlertBanner variant="danger">{error}</AlertBanner>}

      {loading ? (
        <AlertBanner variant="loading" loading>Cargando tareas...</AlertBanner>
      ) : tareas.length === 0 ? (
        <AlertBanner variant="info" title="No hay tareas">No hay tareas con estos filtros.</AlertBanner>
      ) : (
        <div className="solicitud-admin-mobile-list">
          {tareas.map((t) => (
            <article key={t.id} className="solicitud-admin-mobile-card">
              <div className="solicitud-admin-mobile-card__head">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="solicitud-admin-mobile-card__title text-left hover:underline"
                    onClick={() => setDetail(t)}
                  >
                    {t.titulo}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-medium">{t.nombre_asignado || t.codigo_asignado}</span>
                    {(t.centro || t.zona) && (
                      <span> · {[t.centro, t.zona].filter(Boolean).join(' · ')}</span>
                    )}
                  </p>
                  {t.descripcion && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{t.descripcion}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`solicitud-status ${estadoStatusClass(t.estado)}`}>
                    {ESTADO_LABEL[t.estado] || t.estado}
                  </span>
                  {t.prioridad && t.prioridad !== 'normal' && (
                    <span className={`text-xs ${prioridadTextClass(t.prioridad)}`}>
                      {PRIORIDAD_LABEL[t.prioridad]}
                    </span>
                  )}
                </div>
              </div>
              <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
                {t.estado !== 'hecha' && t.estado !== 'cancelada' && (
                  <button
                    type="button"
                    onClick={() => patchEstado(t.id, 'cancelada')}
                    disabled={busyId === t.id}
                    className="solicitud-admin-btn"
                  >
                    <XCircle className="w-4 h-4" aria-hidden />
                    <span>Cancelar</span>
                  </button>
                )}
                {t.estado === 'cancelada' && (
                  <button
                    type="button"
                    onClick={() => patchEstado(t.id, 'pendiente')}
                    disabled={busyId === t.id}
                    className="solicitud-admin-btn"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden />
                    <span>Reabrir</span>
                  </button>
                )}
                <button type="button" onClick={() => setDetail(t)} className="solicitud-admin-btn solicitud-admin-btn--primary">
                  <Eye className="w-4 h-4" aria-hidden />
                  <span>Detalle</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={Boolean(detail)}
          onClose={() => setDetail(null)}
          title="Detalle de tarea"
          showCloseButton={false}
          size="lg"
          className="app-modal--form"
          footer={detail ? (
            <div className="app-modal__actions flex-wrap">
              {detail.estado !== 'cancelada' && detail.estado !== 'hecha' && (
                <button
                  type="button"
                  onClick={() => patchEstado(detail.id, 'cancelada')}
                  disabled={busyId === detail.id}
                  className="app-modal__btn"
                >
                  Cancelar tarea
                </button>
              )}
              <button type="button" onClick={() => setDetail(null)} className="app-modal__btn app-modal__btn--ok">
                Cerrar
              </button>
            </div>
          ) : null}
        >
          {detail && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{detail.titulo}</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`solicitud-status ${estadoStatusClass(detail.estado)}`}>
                  {ESTADO_LABEL[detail.estado] || detail.estado}
                </span>
                {detail.prioridad && (
                  <span className={`text-xs ${prioridadTextClass(detail.prioridad)}`}>
                    {PRIORIDAD_LABEL[detail.prioridad]}
                  </span>
                )}
              </div>
              {detail.descripcion && (
                <p className="app-modal__meta whitespace-pre-wrap">{detail.descripcion}</p>
              )}
              <dl className="solicitud-admin-kv">
                <div>
                  <dt>Asignado</dt>
                  <dd>{detail.nombre_asignado || detail.codigo_asignado}</dd>
                </div>
                <div>
                  <dt>Creado por</dt>
                  <dd>{detail.nombre_creador || detail.codigo_creador}</dd>
                </div>
                {(detail.centro || detail.zona) && (
                  <div>
                    <dt>Ubicación</dt>
                    <dd>{[detail.centro, detail.zona].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
                {detail.fecha_limite && (
                  <div>
                    <dt>Límite</dt>
                    <dd>{new Date(detail.fecha_limite).toLocaleString()}</dd>
                  </div>
                )}
                {detail.completado_at && (
                  <div>
                    <dt>Completado</dt>
                    <dd>{new Date(detail.completado_at).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
              {detail.nota_completado && (
                <div className="app-modal__field">
                  <span className="app-modal__label">Nota de cierre</span>
                  <p className="app-modal__meta">{detail.nota_completado}</p>
                </div>
              )}
              {detail.fotos?.length > 0 && (
                <div>
                  <p className="app-modal__label">Fotos</p>
                  <div className="solicitud-admin-toolbar flex-wrap mt-1">
                    {detail.fotos.map((f) => (
                      <button key={f.id} type="button" onClick={() => openFoto(detail.id, f.id)} className="solicitud-admin-btn">
                        <Eye className="w-4 h-4" aria-hidden />
                        <span className="truncate max-w-[8rem]">{f.nombre_original || `Foto ${f.id}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={Boolean(previewUrl)}
          onClose={() => setPreviewUrl(null)}
          title="Foto"
          showCloseButton={false}
          size="lg"
          className="app-modal--preview"
          footer={(
            <button type="button" onClick={() => setPreviewUrl(null)} className="app-modal__btn">Cerrar</button>
          )}
        >
          {previewUrl && (
            <img src={previewUrl} alt="Evidencia" className="max-h-[70vh] w-full object-contain rounded-lg" />
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
}
