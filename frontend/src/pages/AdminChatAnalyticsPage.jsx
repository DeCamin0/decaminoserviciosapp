import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Back3DButton from '../components/Back3DButton.jsx';
import { Card, Button, Input } from '../components/ui';
import { TableLoading } from '../components/ui/LoadingStates';
import { routes } from '../utils/routes';

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAssistantAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

const FAQ_REVIEW_DRAFT_KEY = 'assistantFaqReviewDraft';

export default function AdminChatAnalyticsPage() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() - 7);
    return ymdLocal(t);
  }, []);
  const defaultTo = useMemo(() => ymdLocal(today), [today]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [negative, setNegative] = useState(null);
  const [appHelp, setAppHelp] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const headers = buildAssistantAuthHeaders();
    if (!headers) {
      setError('No estás autenticado.');
      setLoading(false);
      return;
    }
    const qs = new URLSearchParams();
    if (from?.trim()) qs.set('from', from.trim());
    if (to?.trim()) qs.set('to', to.trim());
    const q = qs.toString();
    const urlSummary = `${routes.assistantAdminAnalyticsSummary}${q ? `?${q}` : ''}`;
    const urlNeg = `${routes.assistantAdminAnalyticsFeedbackNegative}${q ? `?${q}&limit=50` : '?limit=50'}`;

    const qsInsights = new URLSearchParams();
    if (from?.trim()) qsInsights.set('from', from.trim());
    if (to?.trim()) qsInsights.set('to', to.trim());
    qsInsights.set('limit', '50');
    qsInsights.set('minCount', '2');
    const urlInsights = `${routes.assistantAdminAnalyticsAppHelpInsights}?${qsInsights.toString()}`;

    try {
      const [resS, resN, resI] = await Promise.all([
        fetch(urlSummary, { headers }),
        fetch(urlNeg, { headers }),
        fetch(urlInsights, { headers }),
      ]);
      const dataS = await resS.json().catch(() => ({}));
      const dataN = await resN.json().catch(() => ({}));
      const dataI = await resI.json().catch(() => ({}));
      if (!resS.ok) {
        throw new Error(
          dataS.message || dataS.error || `Resumen: error ${resS.status}`,
        );
      }
      if (!resN.ok) {
        throw new Error(
          dataN.message || dataN.error || `Feedback: error ${resN.status}`,
        );
      }
      if (!resI.ok) {
        throw new Error(
          dataI.message || dataI.error || `App-help insights: error ${resI.status}`,
        );
      }
      setSummary(dataS);
      setNegative(dataN);
      setAppHelp(dataI);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error al cargar analytics');
      setSummary(null);
      setNegative(null);
      setAppHelp(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
    // Solo carga inicial; cambios de fecha aplican con «Actualizar»
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceEntries = useMemo(() => {
    const mix = summary?.messages?.byResponseSource;
    if (!mix || typeof mix !== 'object') return [];
    return Object.entries(mix).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const totalSource = useMemo(
    () => sourceEntries.reduce((acc, [, n]) => acc + (Number(n) || 0), 0),
    [sourceEntries],
  );

  const openFaqEditor = useCallback(
    (row, source) => {
      try {
        sessionStorage.setItem(
          FAQ_REVIEW_DRAFT_KEY,
          JSON.stringify({
            questionHash: row.questionHash,
            normalizedQuestion: row.normalizedQuestion || '',
            source,
          }),
        );
      } catch (e) {
        console.warn(e);
      }
      navigate(
        `/admin/assistant/faq?hash=${encodeURIComponent(row.questionHash)}&source=${encodeURIComponent(source)}`,
      );
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-10">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Analytics — Chat asistente
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Rango en fechas (UTC si usas solo día). Mismos datos que la API de
              administración.
            </p>
          </div>
          <Back3DButton to="/admin" title="Panel Admin" />
        </div>

        <Card className="mb-6" padding="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
            <Input
              label="Desde"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 min-w-[160px]"
            />
            <Input
              label="Hasta"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 min-w-[160px]"
            />
            <Button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
            >
              {loading ? 'Cargando…' : 'Actualizar'}
            </Button>
          </div>
          {summary?.range?.timezoneNote && (
            <p className="text-xs text-gray-500 mt-3">{summary.range.timezoneNote}</p>
          )}
        </Card>

        {error && (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            role="alert"
          >
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-800 shrink-0"
              onClick={() => load()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {loading && !summary && !error && (
          <div className="py-12">
            <TableLoading />
          </div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card padding="p-4">
                <p className="text-sm font-medium text-gray-500">
                  Mensajes usuario
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.messages?.userCount ?? 0}
                </p>
              </Card>
              <Card padding="p-4">
                <p className="text-sm font-medium text-gray-500">
                  Mensajes asistente
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.messages?.assistantCount ?? 0}
                </p>
              </Card>
              <Card padding="p-4">
                <p className="text-sm font-medium text-gray-500">
                  Feedback positivo
                </p>
                <p className="text-3xl font-bold text-emerald-700 mt-1">
                  {summary.feedback?.positive ?? 0}
                </p>
              </Card>
              <Card padding="p-4">
                <p className="text-sm font-medium text-gray-500">
                  Feedback negativo
                </p>
                <p className="text-3xl font-bold text-rose-700 mt-1">
                  {summary.feedback?.negative ?? 0}
                </p>
              </Card>
            </div>

            <Card className="mb-6" padding="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Origen de respuesta (assistant)
              </h2>
              {sourceEntries.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Sin datos de origen en este rango.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sourceEntries.map(([key, count]) => {
                    const n = Number(count) || 0;
                    const pct =
                      totalSource > 0
                        ? Math.round((n / totalSource) * 1000) / 10
                        : 0;
                    return (
                      <li key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-800">
                            {key === 'null' ? '(sin origen)' : key}
                          </span>
                          <span className="text-gray-600">
                            {n}{' '}
                            <span className="text-gray-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600"
                            style={{
                              width: `${totalSource > 0 ? (n / totalSource) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {appHelp && (
              <Card className="mb-6" padding="p-4">
                {loading && (
                  <p className="text-sm text-gray-500 mb-3">
                    Actualizando datos app-help…
                  </p>
                )}
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  App-help / datos personales (auditoría)
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Segmento por heurística (mismo criterio que el chat). Fuente:{' '}
                  <code className="text-[11px] bg-gray-100 px-1 rounded">
                    assistant_audit_log
                  </code>
                  . Las tablas muestran preguntas frecuentes sin respuesta FAQ en
                  tools; &quot;FAQ en BD&quot; = existe fila activa con el mismo
                  hash.
                </p>
                {appHelp.filters?.auditScanTruncated && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Solo se analizaron las últimas{' '}
                    {appHelp.filters?.auditScanMax ?? '—'} filas del rango
                    (orden reciente; escaneadas en esta petición:{' '}
                    {appHelp.filters?.auditRowsScanned ?? '—'}). Los totales
                    pueden ser parciales.
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <p className="text-xs text-gray-500">App-help (total)</p>
                    <p className="text-xl font-bold text-gray-900">
                      {appHelp.counts?.appHelpTotal ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                    <p className="text-xs text-emerald-800">FAQ en tools</p>
                    <p className="text-xl font-bold text-emerald-800">
                      {appHelp.counts?.faqHit ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                    <p className="text-xs text-amber-900">Sin FAQ (tools)</p>
                    <p className="text-xl font-bold text-amber-900">
                      {appHelp.counts?.appHelpWithoutFaq ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
                    <p className="text-xs text-violet-900">KB vacía (proc.)</p>
                    <p className="text-xl font-bold text-violet-800">
                      {appHelp.counts?.procedimientosKbEmpty ?? 0}
                    </p>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Top preguntas — sin FAQ en la respuesta (candidatas)
                </h3>
                {!appHelp.topNormalizedQuestions?.length ? (
                  <p className="text-sm text-gray-500 mb-6">
                    Ningún bucket supera el mínimo de frecuencia en este rango.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2 mb-6">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="px-2 py-2 font-medium">Pregunta (normalizada)</th>
                          <th className="px-2 py-2 font-medium w-20">Veces</th>
                          <th className="px-2 py-2 font-medium">FAQ en BD</th>
                          <th className="px-2 py-2 font-medium w-36">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appHelp.topNormalizedQuestions.map((row) => (
                          <tr
                            key={row.questionHash}
                            className={`border-b border-gray-100 align-top ${
                              !row.inValidatedFaq
                                ? 'bg-amber-50/80'
                                : ''
                            }`}
                          >
                            <td className="px-2 py-2 text-gray-800 max-w-md">
                              <span className="line-clamp-3">
                                {row.normalizedQuestion || '—'}
                              </span>
                              {!row.inValidatedFaq && (
                                <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900">
                                  Nuevo candidato
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-gray-800 whitespace-nowrap">
                              {row.count}
                            </td>
                            <td className="px-2 py-2">
                              {row.inValidatedFaq ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                  Sí
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openFaqEditor(row, 'candidate')
                                }
                              >
                                Editar FAQ
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Top — procedimientos con KB vacía
                </h3>
                {!appHelp.topProcedimientosKbEmpty?.length ? (
                  <p className="text-sm text-gray-500">
                    Sin casos por encima del mínimo en este rango.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="px-2 py-2 font-medium">Pregunta (normalizada)</th>
                          <th className="px-2 py-2 font-medium w-20">Veces</th>
                          <th className="px-2 py-2 font-medium">FAQ en BD</th>
                          <th className="px-2 py-2 font-medium w-36">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appHelp.topProcedimientosKbEmpty.map((row) => (
                          <tr
                            key={`kb-${row.questionHash}`}
                            className={`border-b border-gray-100 align-top ${
                              !row.inValidatedFaq
                                ? 'bg-violet-50/60'
                                : ''
                            }`}
                          >
                            <td className="px-2 py-2 text-gray-800 max-w-md">
                              <span className="line-clamp-3">
                                {row.normalizedQuestion || '—'}
                              </span>
                              {!row.inValidatedFaq && (
                                <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-violet-200 text-violet-900">
                                  Revisar FAQ
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              {row.count}
                            </td>
                            <td className="px-2 py-2">
                              {row.inValidatedFaq ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                  Sí
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openFaqEditor(row, 'procedimientos_kb_empty')
                                }
                              >
                                Editar FAQ
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {appHelp.notes?.length > 0 && (
                  <ul className="mt-4 list-disc pl-5 text-xs text-gray-500 space-y-1">
                    {appHelp.notes.map((n, i) => (
                      <li key={`note-${i}`}>{n}</li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </>
        )}

        <Card padding="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Feedback negativo reciente
          </h2>
          {loading && summary && (
            <p className="text-sm text-gray-500">Actualizando tabla…</p>
          )}
          {!loading && negative && (!negative.items || negative.items.length === 0) && (
            <p className="text-sm text-gray-500">
              No hay feedback negativo en este rango.
            </p>
          )}
          {negative?.items?.length > 0 && (
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Usuario</th>
                    <th className="px-2 py-2 font-medium">Origen</th>
                    <th className="px-2 py-2 font-medium">Pregunta (prev.)</th>
                    <th className="px-2 py-2 font-medium">Respuesta</th>
                    <th className="px-2 py-2 font-medium">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {negative.items.map((row) => (
                    <tr
                      key={row.feedbackId}
                      className="border-b border-gray-100 align-top"
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-gray-700">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-gray-800">
                        {row.usuarioId}
                      </td>
                      <td className="px-2 py-2 text-gray-700">
                        {row.responseSource ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-700 max-w-[220px]">
                        <span className="line-clamp-3">
                          {row.userQuestionPreview || '—'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-700 max-w-[260px]">
                        <span className="line-clamp-3">
                          {row.assistantReplyPreview || '—'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-600 max-w-[200px]">
                        <span className="line-clamp-2">
                          {row.comment || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
