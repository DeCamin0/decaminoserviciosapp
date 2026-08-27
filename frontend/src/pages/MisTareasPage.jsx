import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../utils/routes';
import { PageHeader, AlertBanner, SegmentedControl, Modal } from '../components/ui';
import { RefreshCw, Play, CheckCircle, Camera, Image as ImageIcon } from 'lucide-react';
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

export default function MisTareasPage() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('pendientes');
  const [completing, setCompleting] = useState(null);
  const [nota, setNota] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

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
    setNota(tarea.nota_completado || '');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearFileInput = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitUploadFotos = async () => {
    if (!completing || files.length === 0) return;
    setUploadingFotos(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const updated = await apiJson(routes.tareaFotos(completing.id), {
        method: 'POST',
        headers: authHeaders(false),
        body: fd,
      });
      setCompleting(updated);
      clearFileInput();
      await load();
    } catch (e) {
      setError(e.message || 'No se pudieron subir las fotos');
    } finally {
      setUploadingFotos(false);
    }
  };

  const submitCompletar = async () => {
    if (!completing) return;
    if (completing.estado === 'hecha') {
      setCompleting(null);
      return;
    }
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
      clearFileInput();
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
  const fotosSubidas = completing?.fotos?.length || 0;
  const yaHecha = completing?.estado === 'hecha';
  const visibleList = activeSection === 'pendientes' ? activas : historial;

  const renderTarea = (t, isHistorial = false) => (
    <article key={t.id} className="solicitud-admin-mobile-card">
      <div className="solicitud-admin-mobile-card__head">
        <div className="min-w-0 flex-1">
          <h3 className="solicitud-admin-mobile-card__title">{t.titulo}</h3>
          {t.descripcion && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{t.descripcion}</p>
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
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mt-2">
        {(t.centro || t.zona) && <p>{[t.centro, t.zona].filter(Boolean).join(' · ')}</p>}
        {t.fecha_limite && <p>Límite: {new Date(t.fecha_limite).toLocaleString()}</p>}
        {t.nombre_creador && <p>Asignada por: {t.nombre_creador}</p>}
        {t.nota_completado && isHistorial && <p className="italic">{t.nota_completado}</p>}
        {t.fotos?.length > 0 && <p>{t.fotos.length} foto(s)</p>}
      </div>
      {t.fotos?.length > 0 && isHistorial && (
        <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
          {t.fotos.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => openFoto(t.id, f.id)}
              className="solicitud-admin-btn"
            >
              <ImageIcon className="w-4 h-4" aria-hidden />
              <span className="truncate max-w-[8rem]">{f.nombre_original || `Foto ${f.id}`}</span>
            </button>
          ))}
        </div>
      )}
      <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
        {!isHistorial && t.estado === 'pendiente' && (
          <button
            type="button"
            onClick={() => markEnCurso(t.id)}
            disabled={busyId === t.id}
            className="solicitud-admin-btn"
          >
            <Play className="w-4 h-4" aria-hidden />
            <span>{busyId === t.id ? '…' : 'Empezar'}</span>
          </button>
        )}
        {!isHistorial && (
          <button type="button" onClick={() => openCompletar(t)} className="solicitud-admin-btn solicitud-admin-btn--primary">
            <CheckCircle className="w-4 h-4" aria-hidden />
            <span>Completar</span>
          </button>
        )}
        {isHistorial && t.estado === 'hecha' && (
          <button type="button" onClick={() => openCompletar(t)} className="solicitud-admin-btn">
            <Camera className="w-4 h-4" aria-hidden />
            <span>Añadir fotos</span>
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="app-page tareas-page">
      <PageHeader
        title="Mis tareas"
        subtitle="Confirma y documenta el trabajo asignado"
        backTo="/inicio"
        actions={(
          <button type="button" onClick={load} disabled={loading} className="solicitud-admin-btn" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        )}
      />

      <SegmentedControl
        value={activeSection}
        onChange={setActiveSection}
        className="solicitud-admin-tabs"
        items={[
          { id: 'pendientes', label: `Pendientes (${activas.length})`, shortLabel: `Pend. (${activas.length})` },
          { id: 'historial', label: `Historial (${historial.length})`, shortLabel: `Hist. (${historial.length})` },
        ]}
      />

      {error && <AlertBanner variant="danger">{error}</AlertBanner>}

      {loading ? (
        <AlertBanner variant="loading" loading>Cargando tareas...</AlertBanner>
      ) : visibleList.length === 0 ? (
        <AlertBanner variant="info" title={activeSection === 'pendientes' ? 'No tienes tareas pendientes' : 'Sin historial aún'}>
          {activeSection === 'pendientes' ? 'Cuando te asignen tareas, aparecerán aquí.' : 'Las tareas completadas aparecerán en esta sección.'}
        </AlertBanner>
      ) : (
        <div className="solicitud-admin-mobile-list">
          {visibleList.map((t) => renderTarea(t, activeSection === 'historial'))}
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={Boolean(completing)}
          onClose={() => !submitting && !uploadingFotos && setCompleting(null)}
          title={yaHecha ? 'Añadir fotos' : 'Completar tarea'}
          showCloseButton={false}
          className="app-modal--form"
          footer={completing ? (
            <div className="app-modal__actions flex-wrap">
              <button type="button" onClick={() => setCompleting(null)} disabled={submitting || uploadingFotos} className="app-modal__btn">
                {yaHecha ? 'Cerrar' : 'Cancelar'}
              </button>
              <button type="button" onClick={submitUploadFotos} disabled={submitting || uploadingFotos || files.length === 0} className="app-modal__btn">
                {uploadingFotos ? 'Subiendo…' : 'Subir fotos'}
              </button>
              {!yaHecha && (
                <button type="button" onClick={submitCompletar} disabled={submitting || uploadingFotos} className="app-modal__btn app-modal__btn--ok">
                  {submitting ? 'Enviando…' : 'Marcar hecha'}
                </button>
              )}
            </div>
          ) : null}
        >
          {completing && (
            <div className="space-y-4">
              <p className="app-modal__meta font-medium">{completing.titulo}</p>
              <AlertBanner variant="info">
                Puedes subir fotos varias veces. Selecciona un lote, pulsa «Subir fotos» y repite si olvidaste alguna.
              </AlertBanner>
              {!yaHecha && (
                <div className="app-modal__field">
                  <label htmlFor="tarea-nota" className="app-modal__label">Nota (opcional)</label>
                  <textarea
                    id="tarea-nota"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={3}
                    className="app-modal__input min-h-[5rem] resize-y"
                    placeholder="Qué se hizo, observaciones…"
                  />
                </div>
              )}
              {fotosSubidas > 0 && (
                <div>
                  <p className="app-modal__label">Fotos subidas ({fotosSubidas})</p>
                  <div className="solicitud-admin-toolbar flex-wrap mt-1">
                    {completing.fotos.map((f) => (
                      <button key={f.id} type="button" onClick={() => openFoto(completing.id, f.id)} className="solicitud-admin-btn">
                        <ImageIcon className="w-4 h-4" aria-hidden />
                        <span className="truncate max-w-[8rem]">{f.nombre_original || `Foto ${f.id}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="app-modal__field">
                <label htmlFor="tarea-fotos" className="app-modal__label">Nuevas fotos</label>
                <input
                  ref={fileInputRef}
                  id="tarea-fotos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="app-modal__input py-2"
                />
                {files.length > 0 && (
                  <p className="app-modal__meta mt-1">{files.length} archivo(s) pendientes de subir</p>
                )}
              </div>
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
