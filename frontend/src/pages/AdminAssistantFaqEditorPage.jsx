import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import Back3DButton from '../components/Back3DButton.jsx';
import { Card, Button, Input } from '../components/ui';
import { routes } from '../utils/routes';

const DRAFT_KEY = 'assistantFaqReviewDraft';
const DEFAULT_INTENT = '__ANY__';
const DEFAULT_LOCALE = 'es';

function buildAssistantAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function AdminAssistantFaqEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hashFromUrl = (searchParams.get('hash') || '').trim();
  const sourceFromUrl = (searchParams.get('source') || '').trim();

  const [normalizedQuestion, setNormalizedQuestion] = useState('');
  const [replyText, setReplyText] = useState('');
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [computedHash, setComputedHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const sourceLabel = useMemo(() => {
    if (sourceFromUrl === 'procedimientos_kb_empty') {
      return 'Origen analytics: procedimientos · KB vacía';
    }
    if (sourceFromUrl === 'candidate') {
      return 'Origen analytics: candidato (sin FAQ en tools)';
    }
    return null;
  }, [sourceFromUrl]);

  const loadDraft = useCallback(() => {
    if (!hashFromUrl) return null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d && d.questionHash === hashFromUrl) {
        return d;
      }
    } catch {
      return null;
    }
    return null;
  }, [hashFromUrl]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setSuccess(null);
      if (!hashFromUrl) {
        setLoading(false);
        setError('Falta el parámetro hash en la URL. Vuelve a analytics y usa «Editar FAQ».');
        return;
      }
      const draft = loadDraft();
      if (draft?.normalizedQuestion) {
        setNormalizedQuestion(draft.normalizedQuestion);
      }
      const headers = buildAssistantAuthHeaders();
      if (!headers) {
        setLoading(false);
        setError('No estás autenticado.');
        return;
      }
      const qs = new URLSearchParams({
        question_hash: hashFromUrl,
        intent: DEFAULT_INTENT,
        locale: DEFAULT_LOCALE,
      });
      const url = `${routes.assistantAdminValidatedFaq}?${qs.toString()}`;
      try {
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          if (draft?.normalizedQuestion) {
            setNormalizedQuestion(draft.normalizedQuestion);
          }
          setReplyText('');
          setComputedHash(hashFromUrl);
        } else if (!res.ok) {
          throw new Error(data.message || data.error || `Error ${res.status}`);
        } else {
          setNormalizedQuestion(data.normalizedQuestion ?? '');
          setReplyText(data.replyText ?? '');
          setIntent(data.intent ?? DEFAULT_INTENT);
          setLocale(data.locale ?? DEFAULT_LOCALE);
          setActive(data.active !== false);
          setPriority(Number(data.priority) || 0);
          setComputedHash(data.questionHash ?? hashFromUrl);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Error al cargar FAQ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [hashFromUrl, loadDraft]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const headers = buildAssistantAuthHeaders();
    if (!headers) {
      setError('No estás autenticado.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        normalizedQuestion,
        replyText,
        intent: intent || DEFAULT_INTENT,
        locale: (locale || DEFAULT_LOCALE).toLowerCase(),
        active,
        priority: Number.isFinite(Number(priority)) ? Math.trunc(Number(priority)) : 0,
      };
      if (sourceFromUrl === 'candidate' || sourceFromUrl === 'procedimientos_kb_empty') {
        body.source = sourceFromUrl;
      }
      const res = await fetch(routes.assistantAdminValidatedFaq, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      const newHash = data.questionHash || '';
      setComputedHash(newHash);
      setSuccess('FAQ guardada correctamente.');
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      if (newHash && newHash !== hashFromUrl) {
        const sp = new URLSearchParams();
        sp.set('hash', newHash);
        if (sourceFromUrl) sp.set('source', sourceFromUrl);
        navigate(`/admin/assistant/faq?${sp.toString()}`, { replace: true });
      }
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-10">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editor FAQ (asistente)
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Clave única: hash de pregunta normalizada + intent + locale. El hash
              se recalcula en el servidor al guardar.
            </p>
          </div>
          <Back3DButton />
        </div>

        {sourceLabel && (
          <p className="text-xs text-gray-500 mb-4">{sourceLabel}</p>
        )}

        <div className="mb-4">
          <Link
            to="/admin/analytics"
            className="text-sm text-red-700 hover:underline font-medium"
          >
            ← Volver a analytics
          </Link>
        </div>

        {loading && (
          <Card padding="p-4">
            <p className="text-sm text-gray-600">Cargando…</p>
          </Card>
        )}

        {!loading && error && (
          <Card padding="p-4" className="mb-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-800">{error}</p>
          </Card>
        )}

        {!loading && success && (
          <Card padding="p-4" className="mb-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm text-emerald-900">{success}</p>
          </Card>
        )}

        {!loading && hashFromUrl && (
          <Card padding="p-4">
            {computedHash && (
              <p className="text-xs text-gray-500 mb-4 font-mono break-all">
                question_hash (referencia): {computedHash}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pregunta normalizada
                </label>
                <textarea
                  className="w-full min-h-[88px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  value={normalizedQuestion}
                  onChange={(e) => setNormalizedQuestion(e.target.value)}
                  placeholder="Texto normalizado (el servidor aplica la misma normalización que el chat)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Respuesta (reply_text)
                </label>
                <textarea
                  className="w-full min-h-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Respuesta corta que verá el usuario cuando coincida el FAQ"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intent
                  </label>
                  <Input
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder={DEFAULT_INTENT}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locale
                  </label>
                  <Input
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    placeholder={DEFAULT_LOCALE}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Activo
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridad
                  </label>
                  <Input
                    type="number"
                    value={String(priority)}
                    onChange={(e) =>
                      setPriority(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Guardando…' : 'Guardar FAQ'}
                </Button>
                <Button as={Link} to="/admin/analytics" variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
