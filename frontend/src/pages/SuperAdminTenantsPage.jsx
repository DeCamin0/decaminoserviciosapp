import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import Back3DButton from '../components/Back3DButton.jsx';

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

export default function SuperAdminTenantsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const isDeveloper =
    authUser?.GRUPO === 'Developer' || authUser?.grupo === 'Developer';

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    client_name: '',
    client_slug: '',
    timezone: 'Europe/Madrid',
    notes: '',
    plan: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [oncePassword, setOncePassword] = useState(null);
  const [onceMeta, setOnceMeta] = useState(null);
  const [logsTenant, setLogsTenant] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

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
    if (authLoading || !isDeveloper) return;
    loadTenants();
  }, [authLoading, isDeveloper, loadTenants]);

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
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.plan.trim()) body.plan = form.plan.trim();

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
        notes: '',
        plan: '',
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

  if (!isDeveloper) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-slate-700 font-semibold mb-4">
          Solo el grupo Developer puede gestionar tenants.
        </p>
        <Link to="/admin" className="text-red-600 underline">
          Volver al Admin Panel
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Back3DButton to="/admin" title="Admin Panel" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Super-admin · Tenants
            </h1>
            <p className="text-sm text-slate-600">
              Registry + provisioning (DB nueva, usuario, schema sin seed).{' '}
              <span className="text-slate-500">
                Desactivar = solo marca inactivo en el registro (no apaga el servidor).
              </span>
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

        <div className="grid md:grid-cols-2 gap-8">
          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-4"
          >
            <h2 className="font-semibold text-lg">Añadir cliente</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre (client_name) *
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
                Slug * (a-z, 0-9, _ máx 24) → DB{' '}
                <code className="text-xs">tenant_…</code> / user{' '}
                <code className="text-xs">app_…</code>
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
                Notas (opcional)
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Plan (opcional)
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.plan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plan: e.target.value }))
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

          <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
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
            {loading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-slate-500">Ningún tenant todavía.</p>
            ) : (
              <ul className="space-y-3 max-h-[480px] overflow-y-auto">
                {tenants.map((t) => (
                  <li
                    key={t.id}
                    className="border border-slate-100 rounded-lg p-3 text-sm"
                  >
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {t.slug} · {t.database_name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 items-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : t.status === 'inactive'
                              ? 'bg-slate-200 text-slate-700'
                              : t.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {t.status}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={() => openLogs(t.id)}
                      >
                        Logs
                      </button>
                      {t.status !== 'inactive' && (
                        <button
                          type="button"
                          className="text-xs text-rose-600 font-medium underline"
                          onClick={() => {
                            if (
                              window.confirm(
                                '¿Desactivar este cliente en el registro? (No borra la base de datos; solo marca inactivo en la lista.)',
                              )
                            ) {
                              setTenantLifecycle(t.id, 'inactive');
                            }
                          }}
                        >
                          Desactivar
                        </button>
                      )}
                      {t.status === 'inactive' && (
                        <button
                          type="button"
                          className="text-xs text-emerald-700 font-medium underline"
                          onClick={() => setTenantLifecycle(t.id, 'active')}
                        >
                          Activar
                        </button>
                      )}
                      {t.status === 'failed' && (
                        <button
                          type="button"
                          className="text-xs text-orange-600 underline"
                          onClick={() => retryProvision(t.id)}
                        >
                          Reintentar
                        </button>
                      )}
                    </div>
                    {t.last_error && (
                      <p className="text-xs text-red-600 mt-1 line-clamp-2">
                        {t.last_error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
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
