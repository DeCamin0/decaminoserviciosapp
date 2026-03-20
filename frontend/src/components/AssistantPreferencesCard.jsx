import { useCallback, useEffect, useState } from 'react';
import { routes } from '../utils/routes.js';
import { Button, Select } from './ui';

const HEADERS_JSON = () => {
  const token = localStorage.getItem('auth_token');
  const h = {
    'Content-Type': 'application/json',
    'X-App-Source': 'DeCamino-Web-App',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/**
 * Preferencias explícitas del asistente (GET/PUT /api/assistant/preferences).
 * Integrado en Datos personales; no afecta al ChatBot salvo las respuestas del backend.
 */
export default function AssistantPreferencesCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [optedIn, setOptedIn] = useState(false);
  const [locale, setLocale] = useState('es');
  const [responseStyle, setResponseStyle] = useState('normal');
  const [tone, setTone] = useState('professional');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(routes.assistantPreferences, {
        method: 'GET',
        headers: HEADERS_JSON(),
        cache: 'no-store',
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOptedIn(Boolean(data.opted_in));
      setLocale(data.locale || 'es');
      setResponseStyle(data.response_style || 'normal');
      setTone(data.tone || 'professional');
    } catch (e) {
      setLoadError(
        e?.message || 'No se pudieron cargar las preferencias. Inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSuccessMsg('');
    const payload = {
      opted_in: optedIn,
      locale: locale || 'es',
      response_style: responseStyle || 'normal',
      tone: tone || 'professional',
    };
    try {
      const res = await fetch(routes.assistantPreferences, {
        method: 'PUT',
        headers: HEADERS_JSON(),
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          msg = err.message || err.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data = await res.json();
      setOptedIn(Boolean(data.opted_in));
      setLocale(data.locale || 'es');
      setResponseStyle(data.response_style || 'normal');
      setTone(data.tone || 'professional');
      setSuccessMsg('Preferencias guardadas');
    } catch (e) {
      setSaveError(
        e?.message || 'No se pudo guardar. Revisa la conexión e inténtalo otra vez.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border border-gray-200 dark:border-gray-600 shadow-sm">
      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Preferencias del asistente
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Ajusta cómo responde el asistente de la app (idioma, extensión y tono). Solo
            se aplican si las activas explícitamente; no guardamos conversaciones ni
            deducimos preferencias automáticamente.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            Cargando preferencias…
          </div>
        ) : null}

        {loadError ? (
          <div
            className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            {loadError}
            <button
              type="button"
              onClick={load}
              className="ml-2 underline font-medium"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && !loadError ? (
          <>
            <div
              className={`rounded-xl border px-4 py-3 transition-colors ${
                optedIn
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20'
                  : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/15'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={optedIn}
                    onClick={() => setOptedIn((v) => !v)}
                    disabled={saving}
                    className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 ${
                      optedIn ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-1 ${
                        optedIn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                      Preferencias personalizadas
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                      {optedIn
                        ? 'Activadas: el asistente usará idioma, estilo y tono indicados abajo.'
                        : 'Desactivadas: el asistente usa el comportamiento estándar (español, respuestas habituales).'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-opacity ${
                optedIn ? '' : 'opacity-60'
              }`}
            >
              <Select
                label="Idioma de las respuestas"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                disabled={saving}
                options={[
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'English' },
                  { value: 'ro', label: 'Română' },
                ]}
              />
              <Select
                label="Estilo"
                value={responseStyle}
                onChange={(e) => setResponseStyle(e.target.value)}
                disabled={saving}
                options={[
                  { value: 'short', label: 'Breve' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'detailed', label: 'Detallado' },
                ]}
              />
              <Select
                label="Tono"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={saving}
                options={[
                  { value: 'professional', label: 'Profesional' },
                  { value: 'friendly', label: 'Cercano' },
                ]}
              />
            </div>

            {!optedIn ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Puedes editar idioma, estilo y tono antes de activar; hasta entonces no
                se aplican al asistente.
              </p>
            ) : null}

            {saveError ? (
              <div
                className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200"
                role="alert"
              >
                {saveError}
              </div>
            ) : null}

            {successMsg ? (
              <p
                className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
                role="status"
              >
                {successMsg}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="min-w-[140px]"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando…
                  </span>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
