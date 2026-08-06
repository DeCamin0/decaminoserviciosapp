import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import heic2any from 'heic2any';
import { routes } from '../utils/routes';
import Back3DButton from '../components/Back3DButton.jsx';
import FotosTrabajoImportModal from '../components/FotosTrabajoImportModal.jsx';
import { usePermissions } from '../hooks/usePermissions';

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

function isVideoMime(mime) {
  return String(mime || '').toLowerCase().startsWith('video/');
}

function isHeicFile(mime, name) {
  const m = String(mime || '').toLowerCase();
  // Already browser-safe (e.g. HEIC converted to JPEG at upload)
  if (
    m === 'image/jpeg' ||
    m === 'image/jpg' ||
    m === 'image/png' ||
    m === 'image/webp' ||
    m === 'image/gif'
  ) {
    return false;
  }
  const n = String(name || '').toLowerCase();
  return (
    m === 'image/heic' ||
    m === 'image/heif' ||
    n.endsWith('.heic') ||
    n.endsWith('.heif')
  );
}

/** Signed URL as-is for normal images; HEIC/HEIF via API + heic2any → JPEG (same as Pedidos). */
async function resolvePreviewUrl(fotoId, mime, name) {
  if (!isHeicFile(mime, name)) {
    const u = await apiJson(routes.fotosTrabajoFotoUrl(fotoId), {
      headers: authHeaders(),
    });
    if (!u?.url) throw new Error('Sin URL');
    return { url: u.url, isObjectUrl: false };
  }
  const res = await fetch(routes.fotosTrabajoFotoFile(fotoId), {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
  const b = Array.isArray(converted) ? converted[0] : converted;
  if (!b) throw new Error('HEIC conversion failed');
  return { url: URL.createObjectURL(b), isObjectUrl: true };
}

export default function FotosTrabajoPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const canAccess = hasPermission('fotos-trabajo');

  const [q, setQ] = useState('');
  const [listTab, setListTab] = useState('todas'); // 'todas' | 'con-fotos'
  const [comunidades, setComunidades] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [albumes, setAlbumes] = useState([]);
  const [album, setAlbum] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  /** fotoId → object URL created from HEIC conversion (must revoke) */
  const heicObjectUrlsRef = useRef(new Map());
  /** Bumps on each album open so stale HEIC conversions don't update UI */
  const albumLoadGenRef = useRef(0);

  const revokeHeicObjectUrl = useCallback((fotoId) => {
    const u = heicObjectUrlsRef.current.get(fotoId);
    if (u) {
      URL.revokeObjectURL(u);
      heicObjectUrlsRef.current.delete(fotoId);
    }
  }, []);

  const revokeAllHeicObjectUrls = useCallback(() => {
    for (const u of heicObjectUrlsRef.current.values()) {
      URL.revokeObjectURL(u);
    }
    heicObjectUrlsRef.current.clear();
  }, []);

  useEffect(() => () => revokeAllHeicObjectUrls(), [revokeAllHeicObjectUrls]);

  const loadComunidades = useCallback(async (term = '', tab = listTab) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (term) params.set('q', term);
      if (tab === 'con-fotos') params.set('conFotos', '1');
      const qs = params.toString();
      const url = `${routes.fotosTrabajoComunidades}${qs ? `?${qs}` : ''}`;
      const data = await apiJson(url, { headers: authHeaders() });
      setComunidades(data.comunidades || []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las comunidades');
    } finally {
      setLoading(false);
    }
  }, [listTab]);

  useEffect(() => {
    if (!permLoading && canAccess && !cliente) {
      loadComunidades(q, listTab);
    }
  }, [permLoading, canAccess, listTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCliente = async (c) => {
    setCliente(c);
    setAlbum(null);
    setFotos([]);
    revokeAllHeicObjectUrls();
    setUrls({});
    setLoading(true);
    setError('');
    try {
      const data = await apiJson(
        `${routes.fotosTrabajoAlbumes}?clienteId=${c.id}`,
        { headers: authHeaders() },
      );
      setAlbumes(data.albumes || []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los álbumes');
    } finally {
      setLoading(false);
    }
  };

  const createAlbum = async (e) => {
    e.preventDefault();
    if (!cliente || !nuevoTitulo.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiJson(routes.fotosTrabajoAlbumes, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          cliente_id: cliente.id,
          titulo: nuevoTitulo.trim(),
          fecha_servicio: nuevaFecha || null,
        }),
      });
      setNuevoTitulo('');
      setNuevaFecha('');
      setAlbumes((prev) => [data.album, ...prev]);
      await openAlbum(data.album);
    } catch (err) {
      setError(err.message || 'No se pudo crear el álbum');
    } finally {
      setLoading(false);
    }
  };

  const openAlbum = async (a) => {
    setAlbum(a);
    setLoading(true);
    setError('');
    setUrls({});
    revokeAllHeicObjectUrls();
    const loadGen = ++albumLoadGenRef.current;
    try {
      const data = await apiJson(routes.fotosTrabajoAlbumFotos(a.id), {
        headers: authHeaders(),
      });
      if (loadGen !== albumLoadGenRef.current) return;
      const list = data.fotos || [];
      setFotos(list);
      setLoading(false);

      const toLoad = list.slice(0, 40);
      const normal = toLoad.filter(
        (f) => !isHeicFile(f.mime_type, f.nombre_original),
      );
      const heic = toLoad.filter((f) =>
        isHeicFile(f.mime_type, f.nombre_original),
      );

      const applyOne = async (f) => {
        if (loadGen !== albumLoadGenRef.current) return;
        try {
          const resolved = await resolvePreviewUrl(
            f.id,
            f.mime_type,
            f.nombre_original,
          );
          if (loadGen !== albumLoadGenRef.current) {
            if (resolved.isObjectUrl) URL.revokeObjectURL(resolved.url);
            return;
          }
          if (resolved.isObjectUrl) {
            heicObjectUrlsRef.current.set(f.id, resolved.url);
          }
          setUrls((prev) => ({ ...prev, [f.id]: resolved.url }));
        } catch {
          /* ignore single url / HEIC conversion failure */
        }
      };

      // JPG/PNG/video first (fast), then HEIC a few at a time (heavy convert)
      await Promise.all(normal.map(applyOne));
      const HEIC_CONCURRENCY = 2;
      for (let i = 0; i < heic.length; i += HEIC_CONCURRENCY) {
        if (loadGen !== albumLoadGenRef.current) return;
        await Promise.all(heic.slice(i, i + HEIC_CONCURRENCY).map(applyOne));
      }
    } catch (err) {
      if (loadGen !== albumLoadGenRef.current) return;
      setError(err.message || 'No se pudieron cargar las fotos');
      setLoading(false);
    }
  };

  const onUpload = async (fileList) => {
    if (!album || !fileList?.length) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append('files', f));
      const res = await fetch(routes.fotosTrabajoAlbumFotos(album.id), {
        method: 'POST',
        headers: authHeaders(false),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `Error ${res.status}`);
      await openAlbum(album);
      setAlbumes((prev) =>
        prev.map((x) =>
          x.id === album.id
            ? { ...x, fotos_count: (x.fotos_count || 0) + (data.uploaded || 0) }
            : x,
        ),
      );
    } catch (err) {
      setError(err.message || 'Error al subir fotos');
    } finally {
      setUploading(false);
    }
  };

  const deleteFoto = async (fotoId) => {
    if (!confirm('¿Eliminar esta foto?')) return;
    try {
      await apiJson(routes.fotosTrabajoFoto(fotoId), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setFotos((prev) => prev.filter((f) => f.id !== fotoId));
      revokeHeicObjectUrl(fotoId);
      setUrls((prev) => {
        const n = { ...prev };
        delete n[fotoId];
        return n;
      });
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    }
  };

  const deleteAlbum = async (albumId) => {
    if (!confirm('¿Eliminar el álbum y todas sus fotos?')) return;
    try {
      await apiJson(routes.fotosTrabajoAlbum(albumId), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setAlbumes((prev) => prev.filter((a) => a.id !== albumId));
      if (album?.id === albumId) {
        setAlbum(null);
        setFotos([]);
      }
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el álbum');
    }
  };

  const subtitle = useMemo(() => {
    if (album) return album.titulo;
    if (cliente) return cliente.nombre || `Cliente #${cliente.id}`;
    return 'Comunidad → servicio → fotos (R2)';
  }, [album, cliente]);

  if (permLoading) {
    return <div className="p-6 text-gray-500 dark:text-gray-300">Cargando permisos…</div>;
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <Back3DButton to="/inicio" />
        <p className="mt-4 text-red-600 dark:text-red-400">No tienes permiso para Fotos Trabajo.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 text-gray-900 dark:text-white">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {album || cliente ? (
          <button
            type="button"
            onClick={() => {
              if (album) {
                setAlbum(null);
                setFotos([]);
              } else {
                setCliente(null);
                setAlbumes([]);
              }
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-white"
          >
            ← Volver
          </button>
        ) : (
          <Back3DButton to="/inicio" />
        )}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Fotos Trabajo
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-200">{subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      {!cliente && (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-600 dark:bg-gray-900/80">
            <button
              type="button"
              onClick={() => setListTab('todas')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                listTab === 'todas'
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setListTab('con-fotos')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                listTab === 'con-fotos'
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              Con fotos
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadComunidades(q, listTab)}
              placeholder="Buscar comunidad…"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => loadComunidades(q, listTab)}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              Importar
            </button>
          </div>
          {loading ? (
            <p className="text-gray-500 dark:text-gray-300">Cargando…</p>
          ) : (
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-600 dark:border-gray-600 dark:bg-gray-900/80">
              {comunidades.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCliente(c)}
                    className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {c.nombre || `Cliente #${c.id}`}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {[c.nif, c.poblacion].filter(Boolean).join(' · ')}
                      {listTab === 'con-fotos' && c.fotos_count != null
                        ? ` · ${c.fotos_count} fotos · ${c.albumes_count || 0} álbumes`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
              {!comunidades.length && (
                <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300">
                  {listTab === 'con-fotos'
                    ? 'Todavía no hay comunidades con fotos subidas'
                    : 'Sin resultados'}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {cliente && !album && (
        <div className="space-y-6">
          <form
            onSubmit={createAlbum}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-900"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-200">
              Nuevo servicio / álbum
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                required
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                placeholder="Ej. CRISTAL PADEL ROTO"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              />
              <input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-white dark:[color-scheme:dark]"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Crear
              </button>
            </div>
          </form>

          <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-600 dark:border-gray-600 dark:bg-gray-900/80">
            {albumes.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openAlbum(a)}
                >
                  <div className="truncate font-medium text-gray-900 dark:text-white">
                    {a.titulo}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {a.fecha_servicio
                      ? String(a.fecha_servicio).slice(0, 10)
                      : 'Sin fecha'}{' '}
                    · {a.fotos_count || 0} fotos
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteAlbum(a.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Eliminar
                </button>
              </li>
            ))}
            {!albumes.length && !loading && (
              <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300">
                Aún no hay álbumes para esta comunidad
              </li>
            )}
          </ul>
        </div>
      )}

      {album && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
              {uploading ? 'Subiendo…' : 'Subir fotos / vídeos'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  onUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Imagen o vídeo · máx. 100 MB / archivo · hasta 100 por subida · R2
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((f) => {
              const video = isVideoMime(f.mime_type);
              return (
              <div
                key={f.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
              >
                {urls[f.id] ? (
                  video ? (
                    <video
                      src={urls[f.id]}
                      className="aspect-square w-full object-cover bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() =>
                        setLightbox({ url: urls[f.id], mime: f.mime_type })
                      }
                    >
                      <img
                        src={urls[f.id]}
                        alt={f.nombre_original || `foto-${f.id}`}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  )
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs text-gray-400 dark:text-gray-300">
                    …
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => deleteFoto(f.id)}
                  className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                >
                  Borrar
                </button>
                {video && (
                  <span className="absolute left-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Vídeo
                  </span>
                )}
              </div>
              );
            })}
          </div>
          {!fotos.length && !loading && (
            <p className="text-sm text-gray-500 dark:text-gray-300">Sin fotos todavía. Sube la primera.</p>
          )}
        </div>
      )}

      {lightbox && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {isVideoMime(lightbox.mime) ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox.url || lightbox}
              alt="preview"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
        </button>
      )}

      <FotosTrabajoImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => {
          loadComunidades(q, listTab);
        }}
      />
    </div>
  );
}
