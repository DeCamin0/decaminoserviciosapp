import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import Back3DButton from '../components/Back3DButton.jsx';
import { config } from '../config/env';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token && token !== 'null') {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/** Super-admin UI: display + API calls only. Status, health, and rules come from the backend. */
export default function SuperAdminTenantsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const canSuperAdmin =
    authUser?.isSuperAdminControlPlane === true ||
    authUser?.GRUPO === 'Developer' ||
    authUser?.grupo === 'Developer';

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    client_name: '',
    client_slug: '',
    timezone: 'Europe/Madrid',
    api_public_url: '',
    environment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [oncePassword, setOncePassword] = useState(null);
  const [onceMeta, setOnceMeta] = useState(null);
  const [logsTenant, setLogsTenant] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [metaForm, setMetaForm] = useState({ api_public_url: '', environment: '' });
  const [metaSaving, setMetaSaving] = useState(false);

  const loadTenants = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(routes.superAdminTenants, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.message === 'string'
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join(' ')
              : data.error || res.statusText;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      setTenants(data.tenants || []);
    } catch (e) {
      const msg = e?.message || 'Error loading tenants';
      const st = typeof e?.status === 'number' ? e.status : null;
      if (st === 503 || /tenant registry|not configured/i.test(msg)) {
        setError(
          'Registry de tenants no configurado en el servidor. Añade TENANT_REGISTRY_DATABASE_URL en backend/.env, ejecuta migrations/tenant_registry_tables.sql y reinicia. Ver docs/SUPER-ADMIN-TENANTS.md',
        );
      } else {
        setError(msg);
      }
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !canSuperAdmin || config.IS_HERA) return;
    loadTenants();
  }, [authLoading, canSuperAdmin, loadTenants]);

  const openLogs = async (id) => {
    setLogsTenant(id);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await fetch(routes.superAdminTenantLogs(id), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const setTenantLifecycle = async (id, status) => {
    try {
      const res = await fetch(routes.superAdminTenant(id), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.message === 'string'
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join(' ')
              : data.error || res.statusText;
        alert(msg);
        return;
      }
      await loadTenants();
    } catch (e) {
      alert(e.message || 'Error');
    }
  };

  const saveMeta = async () => {
    if (!editingTenant?.id) return;
    setMetaSaving(true);
    try {
      const res = await fetch(routes.superAdminTenant(editingTenant.id), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          api_public_url: metaForm.api_public_url.trim(),
          environment: metaForm.environment.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(
          typeof data.message === 'string'
            ? data.message
            : data.error || res.statusText,
        );
        return;
      }
      setEditingTenant(null);
      await loadTenants();
    } catch (e) {
      alert(e.message || 'Error');
    } finally {
      setMetaSaving(false);
    }
  };

  const startEditMeta = (t) => {
    setEditingTenant(t);
    setMetaForm({
      api_public_url: t.api_public_url || '',
      environment: t.environment || '',
    });
  };

  const retryProvision = async (id) => {
    try {
      const res = await fetch(routes.superAdminTenantRetry(id), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || 'Retry failed');
        return;
      }
      await loadTenants();
    } catch (e) {
      alert(e.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setOncePassword(null);
    setOnceMeta(null);
    setError('');
    try {
      const body = {
        client_name: form.client_name.trim(),
        client_slug: form.client_slug.trim().toLowerCase(),
        timezone: form.timezone.trim(),
      };
      if (form.api_public_url.trim()) {
        body.api_public_url = form.api_public_url.trim();
      }
      if (form.environment.trim()) {
        body.environment = form.environment.trim();
      }

      const res = await fetch(routes.superAdminTenants, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message ||
            (Array.isArray(data.message) ? data.message.join(', ') : null) ||
            data.error ||
            res.statusText,
        );
      }
      setOncePassword(data.db_password_once || null);
      setOnceMeta({
        database_name: data.database_name,
        database_user: data.database_user,
        tenant_id: data.tenant_id,
      });
      setForm((f) => ({
        ...f,
        client_name: '',
        client_slug: '',
        api_public_url: '',
        environment: '',
      }));
      await loadTenants();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600" />
      </div>
    );
  }

  if (config.IS_HERA) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-slate-700 font-semibold mb-4 text-center max-w-md">
          El panel super-admin (tenants / registry) no está disponible en esta
          instancia. Usa el frontend DeCamino y la ruta{' '}
          <code className="text-sm bg-slate-200 px-1 rounded">/superadmin/tenants</code>.
        </p>
        <Link to="/inicio" className="text-red-600 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!canSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-slate-700 font-semibold mb-4 text-center max-w-md">
          Sin acceso. Se requiere grupo Developer o email autorizado
          (SUPER_ADMIN_EMAILS en el servidor).
        </p>
        <Link to="/inicio" className="text-red-600 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Back3DButton to="/inicio" title="Inicio" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Super-admin · Tenants
            </h1>
            <p className="text-sm text-slate-600">
              Control plane: registry + provisioning. Health = GET API/health (servidor).
            </p>
          </div>
        </div>

        {oncePassword && (
          <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm">
            <p className="font-bold text-amber-900 mb-2">
              Guarda la contraseña de la app DB ahora — no se volverá a mostrar
            </p>
            <pre className="bg-white p-3 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(
                {
                  ...onceMeta,
                  db_password_once: oncePassword,
                },
                null,
                2,
              )}
            </pre>
            <button
              type="button"
              className="mt-2 text-amber-800 underline text-xs"
              onClick={() => {
                setOncePassword(null);
                setOnceMeta(null);
              }}
            >
              Ocultar (la contraseña sigue cifrada en el registry)
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-8">
          <form
            onSubmit={onSubmit}
            className="lg:col-span-2 bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-4"
          >
            <h2 className="font-semibold text-lg">Crear tenant</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre *
              </label>
              <input
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.client_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Slug * (a-z, 0-9, _ máx 24)
              </label>
              <input
                required
                pattern="[a-z0-9_]{1,24}"
                title="solo minúsculas, números, guión bajo"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                value={form.client_slug}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    client_slug: e.target.value.toLowerCase(),
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Zona horaria *
              </label>
              <input
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.timezone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timezone: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                API pública (https://…) — opcional, para health
              </label>
              <input
                type="url"
                placeholder="https://api.ejemplo.com"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.api_public_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, api_public_url: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Entorno — opcional (ej. production)
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.environment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, environment: e.target.value }))
                }
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? 'Creando…' : 'Crear + provisionar'}
            </button>
          </form>

          <div className="lg:col-span-3 bg-white rounded-2xl shadow border border-slate-200 p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg">Clientes</h2>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadTenants();
                }}
                className="text-sm text-red-600 font-medium"
              >
                Actualizar
              </button>
            </div>

            {editingTenant && (
              <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm space-y-2">
                <div className="font-medium">
                  Editar URL / entorno: {editingTenant.name}
                </div>
                <input
                  className="w-full border rounded px-2 py-1 text-xs"
                  placeholder="https://api…"
                  value={metaForm.api_public_url}
                  onChange={(e) =>
                    setMetaForm((m) => ({ ...m, api_public_url: e.target.value }))
                  }
                />
                <input
                  className="w-full border rounded px-2 py-1 text-xs"
                  placeholder="production"
                  value={metaForm.environment}
                  onChange={(e) =>
                    setMetaForm((m) => ({ ...m, environment: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={metaSaving}
                    className="px-3 py-1 bg-slate-800 text-white rounded text-xs"
                    onClick={saveMeta}
                  >
                    {metaSaving ? '…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 border rounded text-xs"
                    onClick={() => setEditingTenant(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-slate-500">Ningún tenant todavía.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Slug</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">API pública</th>
                    <th className="py-2 pr-2">Entorno</th>
                    <th className="py-2 pr-2">Health</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-2 font-medium">{t.name}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{t.slug}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{t.status}</td>
                      <td className="py-2 pr-2 text-xs break-all max-w-[140px]">
                        {t.api_public_url || '—'}
                      </td>
                      <td className="py-2 pr-2 text-xs">{t.environment || '—'}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {t.api_health ?? '—'}
                      </td>
                      <td className="py-2 text-xs space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-blue-600 underline"
                          onClick={() => openLogs(t.id)}
                        >
                          Logs
                        </button>
                        <button
                          type="button"
                          className="text-slate-600 underline"
                          onClick={() => startEditMeta(t)}
                        >
                          URL
                        </button>
                        {t.status !== 'inactive' && (
                          <button
                            type="button"
                            className="text-rose-600 underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  '¿Desactivar en el registro? (No borra la base de datos.)',
                                )
                              ) {
                                setTenantLifecycle(t.id, 'inactive');
                              }
                            }}
                          >
                            Off
                          </button>
                        )}
                        {t.status === 'inactive' && (
                          <button
                            type="button"
                            className="text-emerald-700 underline"
                            onClick={() => setTenantLifecycle(t.id, 'active')}
                          >
                            On
                          </button>
                        )}
                        {t.status === 'failed' && (
                          <button
                            type="button"
                            className="text-orange-600 underline"
                            onClick={() => retryProvision(t.id)}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tenants.some((t) => t.last_error) && (
              <div className="mt-4 text-xs text-red-700 space-y-1">
                {tenants
                  .filter((t) => t.last_error)
                  .map((t) => (
                    <div key={`err-${t.id}`}>
                      <span className="font-mono">{t.slug}</span>: {t.last_error}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {logsTenant && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          role="dialog"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-semibold">Logs provision</span>
              <button
                type="button"
                className="text-slate-500"
                onClick={() => setLogsTenant(null)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-xs font-mono space-y-2">
              {logsLoading ? (
                <p>Cargando…</p>
              ) : logs.length === 0 ? (
                <p className="text-slate-500">Sin entradas.</p>
              ) : (
                [...logs]
                  .reverse()
                  .map((l) => (
                    <div
                      key={l.id}
                      className={`p-2 rounded ${
                        l.level === 'error'
                          ? 'bg-red-50 text-red-900'
                          : l.level === 'warn'
                            ? 'bg-amber-50'
                            : 'bg-slate-50'
                      }`}
                    >
                      <span className="text-slate-400">
                        {l.level} · {new Date(l.created_at).toLocaleString()}
                      </span>
                      <div className="whitespace-pre-wrap">{l.message}</div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
