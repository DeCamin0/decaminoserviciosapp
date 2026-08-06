import { useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../utils/routes';

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

function friendlyFetchError(e) {
  const msg = String(e?.message || e || '');
  if (
    e?.name === 'AbortError' ||
    /aborted|abort/i.test(msg) ||
    /signal is aborted/i.test(msg)
  ) {
    return 'La subida se canceló (timeout o conexión). Reintenta: el import ZIP ahora sube carpeta por carpeta.';
  }
  return msg || 'Error desconocido';
}

const BATCH = 15;

function normalizeSearch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Searchable client picker (type to filter). */
function ClientSearchSelect({ clientes, value, onChange, disabled }) {
  const wrapRef = useRef(null);
  const selected = clientes.find((c) => String(c.id) === String(value || ''));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const closePicker = () => {
    setOpen(false);
    setQ('');
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const nq = normalizeSearch(q);
    if (!nq) return clientes.slice(0, 80);
    return clientes
      .filter((c) => {
        const hay = normalizeSearch(`${c.nombre || ''} ${c.nif || ''} ${c.id}`);
        return hay.includes(nq);
      })
      .slice(0, 80);
  }, [clientes, q]);

  const label = selected
    ? selected.nombre || `#${selected.id}`
    : '— Saltar —';

  return (
    <div ref={wrapRef} className="relative w-full min-w-[280px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (open) closePicker();
          else setOpen(true);
        }}
        className="flex w-full items-start justify-between gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-xs text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
        title={label}
      >
        <span className="whitespace-normal break-words leading-snug">{label}</span>
        <span className="shrink-0 text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[min(100vw-3rem,420px)] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-200 p-2 dark:border-gray-600">
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar comunidad…"
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1 text-xs">
            <li>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  onChange('');
                  closePicker();
                }}
              >
                — Saltar —
              </button>
            </li>
            {filtered.map((cl) => (
              <li key={cl.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-1.5 text-left hover:bg-sky-50 dark:hover:bg-gray-800 ${
                    String(cl.id) === String(value)
                      ? 'bg-sky-100 dark:bg-sky-950/50'
                      : ''
                  }`}
                  onClick={() => {
                    onChange(String(cl.id));
                    closePicker();
                  }}
                >
                  <span className="block whitespace-normal break-words font-medium text-gray-900 dark:text-gray-100">
                    {cl.nombre || `#${cl.id}`}
                  </span>
                  {cl.nif && (
                    <span className="block text-[10px] text-gray-500">
                      {cl.nif}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!filtered.length && (
              <li className="px-3 py-2 text-gray-500">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Modal: import Synology-style tree (folder or ZIP) → map clients → R2.
 */
export default function FotosTrabajoImportModal({ open, onClose, onDone }) {
  const folderRef = useRef(null);
  const zipRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | review | running | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'folder' | 'zip'
  const [jobId, setJobId] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientesLite, setClientesLite] = useState([]);
  const [skipped, setSkipped] = useState(0);
  const [stats, setStats] = useState(null);
  const [mapping, setMapping] = useState({}); // folder → clienteId | ''
  const [folderFiles, setFolderFiles] = useState([]); // File[] with webkitRelativePath
  const [progress, setProgress] = useState({ label: '', current: 0, total: 0 });
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('pick');
    setBusy(false);
    setError('');
    setMode(null);
    setJobId(null);
    setClients([]);
    setClientesLite([]);
    setSkipped(0);
    setStats(null);
    setMapping({});
    setFolderFiles([]);
    setProgress({ label: '', current: 0, total: 0 });
    setResult(null);
    if (folderRef.current) folderRef.current.value = '';
    if (zipRef.current) zipRef.current.value = '';
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose?.();
  };

  const applyPreview = (data, sourceMode) => {
    setMode(sourceMode);
    setJobId(data.job_id || null);
    setClients(data.clients || []);
    setClientesLite(data.clientes || []);
    setSkipped(data.skipped || 0);
    setStats(data.stats || null);
    const map = {};
    for (const c of data.clients || []) {
      map[c.folder] =
        c.match?.suggested_cliente_id != null
          ? String(c.match.suggested_cliente_id)
          : '';
    }
    setMapping(map);
    setStep('review');
  };

  const onPickFolder = async (fileList) => {
    if (!fileList?.length) return;
    setBusy(true);
    setError('');
    try {
      const files = Array.from(fileList);
      setFolderFiles(files);
      const paths = files
        .filter((f) => f.webkitRelativePath)
        .map((f) => ({
          relativePath: f.webkitRelativePath,
          size: f.size,
        }));
      const data = await apiJson(routes.fotosTrabajoImportPreviewPaths, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ paths }),
      });
      applyPreview(data, 'folder');
    } catch (e) {
      setError(e.message || 'Error al analizar la carpeta');
    } finally {
      setBusy(false);
    }
  };

  const onPickZip = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('zip', file);
      const res = await fetch(routes.fotosTrabajoImportZip, {
        method: 'POST',
        headers: authHeaders(false),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Error ${res.status}`);
      }
      setFolderFiles([]);
      applyPreview(data, 'zip');
    } catch (e) {
      setError(e.message || 'Error al analizar el ZIP');
    } finally {
      setBusy(false);
    }
  };

  const mappedCount = useMemo(
    () => Object.values(mapping).filter((v) => v && String(v).trim()).length,
    [mapping],
  );

  const commitFolder = async () => {
    const byPath = new Map();
    for (const f of folderFiles) {
      if (f.webkitRelativePath) byPath.set(f.webkitRelativePath.replace(/\\/g, '/'), f);
    }

    let albumsCreated = 0;
    let fotosUploaded = 0;
    let foldersSkipped = 0;
    let skippedDuplicates = 0;
    const errors = [];

    const work = clients.filter((c) => mapping[c.folder]);
    const totalAlbums = work.reduce((n, c) => n + (c.albumes?.length || 0), 0);
    let doneAlbums = 0;

    for (const c of clients) {
      const clienteId = Number(mapping[c.folder]);
      if (!clienteId) {
        foldersSkipped += 1;
        continue;
      }
      for (const alb of c.albumes || []) {
        setProgress({
          label: `${c.folder} → ${alb.album_title}`,
          current: doneAlbums,
          total: totalAlbums || 1,
        });
        try {
          const created = await apiJson(routes.fotosTrabajoAlbumes, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              cliente_id: clienteId,
              titulo: alb.album_title,
              notas: `Import carpeta: ${c.folder}`,
              reuse_if_exists: true,
            }),
          });
          const albumId = created.album?.id;
          albumsCreated += 1;
          if (!albumId) throw new Error('Sin id de álbum');

          const files = [];
          for (const meta of alb.files || []) {
            const file = byPath.get(meta.relativePath);
            if (file) files.push(file);
          }
          for (let i = 0; i < files.length; i += BATCH) {
            const chunk = files.slice(i, i + BATCH);
            const fd = new FormData();
            chunk.forEach((f) => fd.append('files', f));
            const res = await fetch(routes.fotosTrabajoAlbumFotos(albumId), {
              method: 'POST',
              headers: authHeaders(false),
              body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data?.message || `Upload ${res.status}`);
            }
            fotosUploaded += data.uploaded || 0;
            skippedDuplicates += data.skipped_duplicates || 0;
          }
        } catch (e) {
          errors.push(`${c.folder} / ${alb.album_title}: ${e.message}`);
        }
        doneAlbums += 1;
        setProgress({
          label: `${c.folder} → ${alb.album_title}`,
          current: doneAlbums,
          total: totalAlbums || 1,
        });
      }
    }

    return {
      albums_created: albumsCreated,
      fotos_uploaded: fotosUploaded,
      folders_skipped: foldersSkipped,
      skipped_duplicates: skippedDuplicates,
      errors,
    };
  };

  const commitZip = async () => {
    const folders = clients.filter((c) => mapping[c.folder]);
    let albumsCreated = 0;
    let fotosUploaded = 0;
    let foldersSkipped = clients.length - folders.length;
    let skippedDuplicates = 0;
    const errors = [];

    for (let i = 0; i < folders.length; i++) {
      const c = folders[i];
      setProgress({
        label: `R2: ${c.folder}`,
        current: i,
        total: folders.length,
      });
      const bodyMapping = { [c.folder]: Number(mapping[c.folder]) };
      try {
        const res = await apiJson(routes.fotosTrabajoImportCommit, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            job_id: jobId,
            folder: c.folder,
            mapping: bodyMapping,
            finalize: false,
          }),
        });
        albumsCreated += res.albums_created || 0;
        fotosUploaded += res.fotos_uploaded || 0;
        foldersSkipped += res.folders_skipped || 0;
        skippedDuplicates += res.skipped_duplicates || 0;
        if (res.errors?.length) errors.push(...res.errors);
      } catch (e) {
        errors.push(`${c.folder}: ${friendlyFetchError(e)}`);
      }
      setProgress({
        label: `R2: ${c.folder}`,
        current: i + 1,
        total: folders.length,
      });
    }

    try {
      await apiJson(routes.fotosTrabajoImportCleanup, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch {
      /* ignore cleanup errors */
    }

    return {
      albums_created: albumsCreated,
      fotos_uploaded: fotosUploaded,
      folders_skipped: foldersSkipped,
      skipped_duplicates: skippedDuplicates,
      errors,
    };
  };

  const onConfirm = async () => {
    if (!mappedCount) {
      setError('Asigna al menos un cliente o cancela carpetas no deseadas.');
      return;
    }
    setBusy(true);
    setError('');
    setStep('running');
    try {
      const res = mode === 'zip' ? await commitZip() : await commitFolder();
      setResult(res);
      setStep('done');
      onDone?.(res);
    } catch (e) {
      setError(friendlyFetchError(e));
      setStep('review');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-600 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Importar Fotos Trabajo
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Carpeta o ZIP: comunidad → servicio → fotos. Sin match claro, eliges el cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            disabled={busy}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 'pick' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Estructura esperada: <code className="text-xs">FotosTrabajo / CP NOMBRE / servicio / foto.jpg</code>
              . ZIP máx. ~1,5 GB; para volúmenes mayores, parte en varios ZIP.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {busy ? 'Analizando…' : 'Elegir carpeta'}
                <input
                  ref={(node) => {
                    folderRef.current = node;
                    if (node) {
                      node.setAttribute('webkitdirectory', '');
                      node.setAttribute('directory', '');
                    }
                  }}
                  type="file"
                  className="hidden"
                  disabled={busy}
                  multiple
                  onChange={(e) => {
                    onPickFolder(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-800">
                {busy ? 'Analizando…' : 'Elegir ZIP'}
                <input
                  ref={zipRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    onPickZip(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {clients.length} carpetas · {stats?.with_media ?? '—'} con fotos ·{' '}
              {stats?.without_media ?? 0} sin media · {stats?.media_files ?? '—'} ficheros
              media · {skipped} ignorados
              {mode === 'zip' && jobId ? ` · job ${jobId.slice(0, 8)}…` : ''}
            </p>
            {stats?.without_media > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Las carpetas con 0 fotos no tenían imagen/vídeo reconocido (vacías u otros
                formatos). Aún puedes asignarlas o saltarlas.
              </p>
            )}
            <div className="rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">Carpeta</th>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">Álbumes / fotos</th>
                    <th className="px-3 py-2 w-[38%]">Cliente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {clients.map((c) => (
                    <tr key={c.folder} className="text-gray-900 dark:text-gray-100">
                      <td className="px-3 py-2 font-medium">{c.folder}</td>
                      <td className="px-3 py-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                        {c.match?.status || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                        {c.albumes?.length || 0} álb. · {c.file_count || 0} fich.
                      </td>
                      <td className="px-3 py-2">
                        <ClientSearchSelect
                          clientes={clientesLite}
                          value={mapping[c.folder] ?? ''}
                          disabled={busy}
                          onChange={(id) =>
                            setMapping((prev) => ({
                              ...prev,
                              [c.folder]: id,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-500"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || !mappedCount}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirmar import
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-200">{progress.label || 'Importando…'}</p>
            <p className="text-xs text-gray-500">
              {progress.current} / {progress.total || '…'}
            </p>
            <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{
                  width: `${
                    progress.total
                      ? Math.min(100, (100 * progress.current) / progress.total)
                      : 30
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Import terminado: {result.albums_created || 0} álbumes,{' '}
              {result.fotos_uploaded || 0} fotos
              {result.skipped_duplicates
                ? `, ${result.skipped_duplicates} duplicados omitidos`
                : ''}
              {result.folders_skipped
                ? `, ${result.folders_skipped} carpetas saltadas`
                : ''}
              .
            </p>
            {!!result.errors?.length && (
              <ul className="max-h-40 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {result.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
