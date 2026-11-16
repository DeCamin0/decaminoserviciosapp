import { useCallback, useEffect, useState } from 'react';
import { routes } from '../../utils/routes';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function EmpleadoCentrosExtra({ codigo, primario, clientes }) {
  const [extras, setExtras] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [schemaPending, setSchemaPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!codigo) return;
    const res = await fetch(
      `${routes.centrosEmpleado}?codigo=${encodeURIComponent(codigo)}`,
      { headers: authHeaders() },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setSchemaPending(!!data.schemaPending);
    setExtras(Array.isArray(data.extras) ? data.extras : []);
  }, [codigo]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const addCentro = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (primario && clean.toLowerCase() === String(primario).toLowerCase()) return;
    setExtras((prev) =>
      prev.some((item) => item.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, clean],
    );
    setQuery('');
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(routes.centrosEmpleado, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ codigo, centros: extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo guardar');
      setExtras(Array.isArray(data.extras) ? data.extras : extras);
      setMessage('Centros guardados');
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!codigo) return null;

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-sm font-semibold text-gray-800">Otros centros</div>
      <p className="mt-1 text-xs text-gray-500">
        Cada centro trae su horario semanal. Si las horas se pisan, en el fichaje se elige el centro de ese día.
      </p>
      {schemaPending ? (
        <p className="mt-2 text-xs text-amber-700">
          Falta la tabla. En el backend: node scripts/run-empleado-centros-migration.js .env.decamino.local y .env.hera.local
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {extras.map((centro) => (
              <button
                key={centro}
                type="button"
                className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
                onClick={() => setExtras((prev) => prev.filter((item) => item !== centro))}
              >
                {centro} ×
              </button>
            ))}
            {extras.length === 0 ? (
              <span className="text-xs text-gray-400">Sin centros extra</span>
            ) : null}
          </div>
          <div className="relative mt-2">
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Añadir centro..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
            />
            {open && query.trim().length >= 2 ? (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow">
                {(clientes || [])
                  .filter((cliente) =>
                    String(cliente['NOMBRE O RAZON SOCIAL'] || '')
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((cliente) => (
                    <button
                      key={cliente.NIF || cliente['NOMBRE O RAZON SOCIAL']}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => addCentro(cliente['NOMBRE O RAZON SOCIAL'])}
                    >
                      {cliente['NOMBRE O RAZON SOCIAL']}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-2 rounded-full bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar centros'}
          </button>
          {message ? <p className="mt-1 text-xs text-gray-600">{message}</p> : null}
        </>
      )}
    </div>
  );
}
