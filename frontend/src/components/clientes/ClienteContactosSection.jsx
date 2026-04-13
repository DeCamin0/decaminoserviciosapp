import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '../ui';
import { routes } from '../../utils/routes';
import { buildPortalGestoresUrl } from '../../config/env';
import { Users, Plus, Pencil, Trash2, Shield, Bell, Star } from 'lucide-react';

const CARGO_OPTIONS = [
  { value: '', label: '— Rol —' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'presidente', label: 'Presidente' },
  { value: 'vicepresidente', label: 'Vicepresidente' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'junta', label: 'Junta directiva' },
  { value: 'otro', label: 'Otro (texto libre)' },
];

const emptyForm = () => ({
  nombre: '',
  cargo_codigo: '',
  cargo_libre: '',
  email: '',
  telefono: '',
  acceso_portal: false,
  recibe_notificaciones: false,
  es_principal: false,
  estado: 'activo',
});

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function ClienteContactosSection({ clienteId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const urlBase = routes.clienteContactos(clienteId);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(urlBase, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e.message || 'Error al cargar contactos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, urlBase]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre || '',
      cargo_codigo: row.cargo_codigo || '',
      cargo_libre: row.cargo_libre || '',
      email: row.email || '',
      telefono: row.telefono || '',
      acceso_portal: Boolean(row.acceso_portal),
      recibe_notificaciones: Boolean(row.recibe_notificaciones),
      es_principal: Boolean(row.es_principal),
      estado: row.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!clienteId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        cargo_codigo: form.cargo_codigo || null,
        cargo_libre: form.cargo_libre.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        acceso_portal: form.acceso_portal,
        recibe_notificaciones: form.recibe_notificaciones,
        es_principal: form.es_principal,
        estado: form.estado,
      };
      const url = editingId ? `${urlBase}/${editingId}` : urlBase;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json.message ||
          (Array.isArray(json.message) ? json.message.join(', ') : null) ||
          json.error ||
          `Error ${res.status}`;
        throw new Error(msg);
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!clienteId || !window.confirm('¿Eliminar este contacto?')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${urlBase}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || `Error ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  const labelCargo = (row) => {
    if (row.cargo_libre) return row.cargo_libre;
    const opt = CARGO_OPTIONS.find((o) => o.value === row.cargo_codigo);
    return opt?.label || row.cargo_codigo || '—';
  };

  if (!clienteId) {
    return (
      <Card>
        <div className="p-4 text-sm text-amber-700">
          Este cliente no tiene id numérico en la base de datos; no se pueden
          gestionar contactos aquí.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contactos comunidad
        </h3>
        <Button type="button" size="sm" onClick={openNew} disabled={saving}>
          <Plus className="h-4 w-4 mr-1" />
          Añadir contacto
        </Button>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Personas de contacto (junta, administrador de fincas…). El acceso al
          portal es siempre por el <strong>enlace/QR de esta comunidad</strong>:
          el mismo email puede repetirse en <strong>otras</strong> comunidades.
          No dupliques el mismo email con portal <strong>dentro</strong> de la
          misma comunidad. Marca <strong>principal</strong> para el contacto de
          referencia.{' '}
          <span className="block mt-2 text-xs text-gray-500">
            Rol <strong>Administrador</strong> con portal: si gestionas varias
            comunidades, puedes usar también el{' '}
            <a
              className="text-red-700 underline break-all"
              href={buildPortalGestoresUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              portal general (gestores)
            </a>
            .
          </span>
        </p>

        {error && (
          <div className="rounded-md bg-red-50 text-red-800 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={submit}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Nombre *
                </label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Rol</label>
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.cargo_codigo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cargo_codigo: e.target.value }))
                  }
                >
                  {CARGO_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">
                  Cargo (texto libre, opcional)
                </label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.cargo_libre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cargo_libre: e.target.value }))
                  }
                  placeholder="Ej. Vocal 2ª planta"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Teléfono
                </label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.telefono}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, telefono: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acceso_portal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, acceso_portal: e.target.checked }))
                  }
                />
                <Shield className="h-4 w-4 text-gray-500" />
                Acceso portal (OTP)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.recibe_notificaciones}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      recibe_notificaciones: e.target.checked,
                    }))
                  }
                />
                <Bell className="h-4 w-4 text-gray-500" />
                Recibe notificaciones
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.es_principal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, es_principal: e.target.checked }))
                  }
                />
                <Star className="h-4 w-4 text-gray-500" />
                Principal
              </label>
              <label className="inline-flex items-center gap-2">
                <span className="text-gray-600">Estado:</span>
                <select
                  className="rounded border border-gray-300 px-2 py-1"
                  value={form.estado}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estado: e.target.value }))
                  }
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" size="sm" disabled={saving}>
                {editingId ? 'Guardar cambios' : 'Crear contacto'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Cargando contactos…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">
            No hay contactos. Pulsa «Añadir contacto».
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Tel.</th>
                  <th className="px-3 py-2">Flags</th>
                  <th className="px-3 py-2 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {row.nombre}
                      {row.es_principal && (
                        <Badge className="ml-2 text-xs bg-amber-100 text-amber-900">
                          Principal
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{labelCargo(row)}</td>
                    <td className="px-3 py-2 text-gray-700">{row.email || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.telefono || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.acceso_portal && (
                          <Badge variant="secondary" className="text-xs">
                            Portal
                          </Badge>
                        )}
                        {row.recibe_notificaciones && (
                          <Badge variant="secondary" className="text-xs">
                            Avisos
                          </Badge>
                        )}
                        {row.estado === 'inactivo' && (
                          <Badge className="text-xs bg-gray-200 text-gray-700">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(row)}
                          disabled={saving}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600"
                          onClick={() => remove(row.id)}
                          disabled={saving}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
