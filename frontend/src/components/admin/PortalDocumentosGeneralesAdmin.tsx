import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { routes } from '../../utils/routes';

const GRUPOS_GESTION = ['Developer', 'Admin', 'Manager', 'Supervisor'];

/** Valores guardados en `tipo_documento` (misma clave = reemplazo de versión activa). */
const TIPOS_DOCUMENTO_GENERAL = [
  { value: 'certificado_aeat', label: 'Certificado / acreditación AEAT' },
  { value: 'certificado_seguridad_social', label: 'Certificado Seguridad Social' },
  { value: 'seguro_responsabilidad_civil', label: 'Seguro responsabilidad civil (RC)' },
  { value: 'certificado_mutua', label: 'Certificado Mutua (PRL / colaboración)' },
  { value: 'plan_prevencion_riesgos', label: 'Plan de prevención de riesgos laborales' },
  { value: 'licencia_actividad', label: 'Licencia de actividad o comunicación responsable' },
  { value: 'certificado_subvenciones', label: 'Certificado de hallarse al corriente (subvenciones / concursos)' },
  { value: 'otro', label: 'Otro (especificar)' },
] as const;

type DocRow = {
  id: number;
  tipo_documento: string;
  nombre_documento: string;
  mime_type: string | null;
  fecha_subida: string;
  fecha_validez: string | null;
  estado: string;
  created_by: string | null;
};

export default function PortalDocumentosGeneralesAdmin() {
  const { authToken, user: authUser } = useAuth();
  const grupo = String(authUser?.GRUPO || authUser?.grupo || '').trim();
  const allowed = GRUPOS_GESTION.includes(grupo);

  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [tipoPreset, setTipoPreset] = useState<string>('');
  const [tipoOtro, setTipoOtro] = useState('');
  const [nombre, setNombre] = useState('');
  const [fechaValidez, setFechaValidez] = useState('');
  const [reemplazar, setReemplazar] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!authToken || !allowed) return;
    setLoading(true);
    setErr('');
    try {
      const q =
        estadoFiltro && estadoFiltro.trim()
          ? `?estado=${encodeURIComponent(estadoFiltro.trim())}`
          : '';
      const res = await fetch(`${routes.adminPortalDocumentosGenerales}${q}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: unknown) {
      setRows([]);
      setErr(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [authToken, allowed, estadoFiltro]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (id: number, label: string) => {
    if (!authToken) return;
    setErr('');
    try {
      const res = await fetch(routes.adminPortalDocumentoGeneralArchivo(id), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.slice(0, 120)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error descarga');
    }
  };

  const patchEstado = async (id: number, estado: string) => {
    if (!authToken) return;
    setErr('');
    setMsg('');
    try {
      const res = await fetch(routes.adminPortalDocumentoGeneralEstado(id), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      setMsg('Estado actualizado.');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const onSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setErr('');
    setMsg('');
    if (!file) {
      setErr('Selecciona un archivo.');
      return;
    }
    const tipoFinal =
      tipoPreset === 'otro'
        ? tipoOtro.trim()
        : tipoPreset.trim();
    if (!tipoFinal || !nombre.trim()) {
      setErr(
        !tipoFinal
          ? 'Selecciona un tipo de documento (o especifica uno en Otro).'
          : 'El nombre es obligatorio.',
      );
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo_documento', tipoFinal);
      fd.append('nombre_documento', nombre.trim());
      if (fechaValidez.trim()) {
        fd.append('fecha_validez', fechaValidez.trim());
      }
      fd.append('reemplazar_version_anterior', reemplazar ? 'true' : 'false');
      const res = await fetch(routes.adminPortalDocumentosGenerales, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      setMsg('Documento subido correctamente.');
      setFile(null);
      setTipoPreset('');
      setTipoOtro('');
      setNombre('');
      setFechaValidez('');
      setReemplazar(true);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Tu rol no incluye la gestión de documentación general del portal (Developer,
        Admin, Manager o Supervisor).
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Subir documentación general (portal clientes)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Visible para todos los contactos del portal. Si marcas reemplazar, la versión
          activa anterior del mismo tipo pasa a histórico.
        </p>
        <form onSubmit={onSubmitUpload} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Archivo
            </label>
            <input
              type="file"
              className="block w-full text-sm text-gray-700"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tipo de documento
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              value={tipoPreset}
              onChange={(e) => {
                const v = e.target.value;
                setTipoPreset(v);
                if (v !== 'otro') setTipoOtro('');
              }}
            >
              <option value="">— Selecciona un tipo —</option>
              {TIPOS_DOCUMENTO_GENERAL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {tipoPreset === 'otro' && (
              <div className="mt-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Código o nombre del tipo (sin espacios al inicio/fin; se usa para versiones)
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={tipoOtro}
                  onChange={(e) => setTipoOtro(e.target.value)}
                  placeholder="p. ej. certificado_iso_9001"
                />
              </div>
            )}
            <p className="mt-1.5 text-xs text-gray-500">
              AEAT, Seguridad Social y RC están en la lista; elige <strong>Otro</strong> para
              tipos personalizados.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre / descripción
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Certificado trimestral Q1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Fecha validez (opcional)
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={fechaValidez}
              onChange={(e) => setFechaValidez(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={reemplazar}
                onChange={(e) => setReemplazar(e.target.checked)}
              />
              Reemplazar versión activa del mismo tipo
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {uploading ? 'Subiendo…' : 'Subir documento'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Listado e histórico</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Filtrar estado</label>
            <select
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="historico">Histórico</option>
              <option value="inactivo">Inactivo</option>
            </select>
            <button
              type="button"
              onClick={() => load()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Actualizar
            </button>
          </div>
        </div>
        {msg && (
          <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : !rows.length ? (
          <p className="text-sm text-gray-500">No hay registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Subida</th>
                  <th className="py-2 pr-3">Validez</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.id}</td>
                    <td className="py-2 pr-3 max-w-[140px] truncate" title={r.tipo_documento}>
                      {r.tipo_documento}
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={r.nombre_documento}>
                      {r.nombre_documento}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {r.fecha_subida
                        ? new Date(r.fecha_subida).toLocaleString('es-ES')
                        : '—'}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {r.fecha_validez
                        ? new Date(r.fecha_validez).toLocaleDateString('es-ES')
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.estado === 'historico'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-red-700 hover:underline mr-2"
                        onClick={() =>
                          download(
                            r.id,
                            r.nombre_documento || r.tipo_documento || `doc-${r.id}`,
                          )
                        }
                      >
                        Descargar
                      </button>
                      {r.estado !== 'activo' && (
                        <button
                          type="button"
                          className="text-gray-700 hover:underline mr-2"
                          onClick={() => patchEstado(r.id, 'activo')}
                        >
                          Activar
                        </button>
                      )}
                      {r.estado !== 'historico' && (
                        <button
                          type="button"
                          className="text-gray-700 hover:underline mr-2"
                          onClick={() => patchEstado(r.id, 'historico')}
                        >
                          Histórico
                        </button>
                      )}
                      {r.estado !== 'inactivo' && (
                        <button
                          type="button"
                          className="text-gray-700 hover:underline"
                          onClick={() => patchEstado(r.id, 'inactivo')}
                        >
                          Inactivo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
