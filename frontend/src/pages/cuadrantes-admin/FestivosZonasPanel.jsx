import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { routes } from '../../utils/routes';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function FestivosZonasPanel({ onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${routes.getFestivos}?accion=zonas`, {
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || 'No se pudieron cargar las zonas');
        if (cancelled) return;
        setSchemaPending(!!data.schemaPending);
        setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
        setSelected((Array.isArray(data.zonas) ? data.zonas : []).map((zona) => zona.ine));
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar las zonas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedItems = useMemo(
    () => catalog.filter((item) => selected.includes(item.ine)),
    [catalog, selected],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    if (needle.length < 2) return [];
    return catalog
      .filter((item) => item.nombre.toLocaleLowerCase('es').includes(needle))
      .slice(0, 12);
  }, [catalog, query]);

  const toggle = (ine) => {
    setSelected((current) =>
      current.includes(ine) ? current.filter((item) => item !== ine) : [...current, ine],
    );
    setNotice('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${routes.getFestivos}?accion=zonas`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ines: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'No se pudieron guardar las zonas');
      const local = data.local;
      setNotice(
        local
          ? `Zonas guardadas. Festivos locales: ${local.inserted} nuevos, ${local.updated} actualizados.`
          : 'Zonas guardadas.',
      );
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-card app-card--pad space-y-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Zonas de actividad</h3>
        <p className="text-sm text-gray-600">
          Marca los municipios donde trabaja la empresa. Ahí se cargan los festivos locales.
          Con un solo municipio, ese festivo vale para toda la empresa. Con varios, cada
          centro usa el de su localidad; quien no tiene centro elige la zona al fichar.
        </p>
      </div>

      {schemaPending ? (
        <p className="text-sm text-amber-800">
          Falta la migración en esta base. Desde backend:
          node scripts/run-festivo-zonas-migration.js .env.decamino.local
          y el mismo comando con .env.hera.local
        </p>
      ) : null}

      {!schemaPending && loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Cargando municipios…
        </div>
      ) : !schemaPending && ready ? (
        <>
          <div className="flex flex-wrap gap-2">
            {selectedItems.length === 0 ? (
              <span className="text-sm text-gray-500">Ningún municipio seleccionado.</span>
            ) : (
              selectedItems.map((item) => (
                <button
                  key={item.ine}
                  type="button"
                  onClick={() => toggle(item.ine)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800"
                >
                  {item.nombre} ×
                </button>
              ))
            )}
          </div>

          <label className="block text-sm font-medium text-gray-700" htmlFor="festivo-zona-buscar">
            Añadir municipio
          </label>
          <input
            id="festivo-zona-buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribe al menos 2 letras, por ejemplo Alcalá"
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          />
          {matches.length > 0 ? (
            <ul className="max-h-48 overflow-auto rounded-lg border border-gray-200">
              {matches.map((item) => {
                const on = selected.includes(item.ine);
                return (
                  <li key={item.ine}>
                    <button
                      type="button"
                      onClick={() => toggle(item.ine)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span>{item.nombre}</span>
                      <span className="text-xs text-gray-500">{on ? 'Añadido' : 'Añadir'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar zonas'}
            </button>
            {notice ? <span className="text-sm text-emerald-700">{notice}</span> : null}
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
