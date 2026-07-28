import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import Back3DButton from '../components/Back3DButton.jsx';
import { useAuth } from '../contexts/AuthContextBase';
import { config } from '../config/env';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Debe superar ligeramente el timeout del backend (spawn + scraper). */
const SCRAPE_FETCH_TIMEOUT_MS = {
  auto: 450_000,
  google_discovery: 280_000,
  google: 280_000,
  /** Backend empresite: 300s (light) / 600s (full) — ver `empresiteFullMode` */
  empresite_light: 320_000,
  empresite_full: 620_000,
  /** Backend cylex: 120s */
  cylex: 130_000,
  paginas_amarillas: 220_000,
};

function scrapeFetchTimeoutMs(source, empresiteFullMode) {
  const s = (source || '').toLowerCase();
  if (s === 'empresite') {
    return empresiteFullMode
      ? SCRAPE_FETCH_TIMEOUT_MS.empresite_full
      : SCRAPE_FETCH_TIMEOUT_MS.empresite_light;
  }
  return SCRAPE_FETCH_TIMEOUT_MS[s] ?? 220_000;
}

const EMPRESITE_BLOCK_CODES = new Set([
  'blocked',
  'source_rate_limited',
  'source_ip_blocked_or_throttled',
]);

/** Fragmento típico en mensajes de rate limit Empresite (detección UI). */
const EMPRESITE_RATE_LIMIT_SNIPPET = 'Empresite is rate-limiting';

/** Estado final tras respuesta; durante `fetch` se usa running/retrying por tiempo. */
function inferScrapePhase({ resOk, data, abort }) {
  if (abort) return 'timed_out';
  if (!resOk) return 'error';
  if (data?.success === false) {
    const m = String(data.message || '').toLowerCase();
    if (m.includes('bloque') || m.includes('anti-bot')) return 'blocked';
    return 'error';
  }
  const bd = data?.sourceBreakdown;
  if (bd && typeof bd === 'object') {
    for (const row of Object.values(bd)) {
      if (row?.blocked) return 'blocked';
      const z = row?.zeroReasonCode;
      if (typeof z === 'string' && EMPRESITE_BLOCK_CODES.has(z)) return 'blocked';
    }
  }
  return 'finished';
}

function scrapePhaseBadgeClass(phase) {
  switch (phase) {
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'retrying':
      return 'bg-amber-100 text-amber-900';
    case 'blocked':
      return 'bg-orange-100 text-orange-900';
    case 'finished':
      return 'bg-green-100 text-green-800';
    case 'timed_out':
      return 'bg-red-100 text-red-800';
    case 'error':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function scrapePhaseLabelEs(phase) {
  switch (phase) {
    case 'running':
      return 'En curso';
    case 'retrying':
      return 'Reintentando';
    case 'blocked':
      return 'Bloqueado';
    case 'finished':
      return 'Finalizado';
    case 'timed_out':
      return 'Tiempo agotado';
    case 'error':
      return 'Error';
    case 'idle':
    default:
      return '—';
  }
}

/** Fuentes con adaptador de red (no stubs). Infobel/Kompass: manual hasta validar. */
const SCRAPE_SELECTABLE_SOURCE_IDS = new Set([
  'paginas_amarillas',
  'empresite',
  'cylex',
  'infobel',
  'kompass',
  'yalwa',
  'europages',
  'google_discovery',
]);

function canAccessLeads(user) {
  const g = user?.GRUPO || user?.grupo;
  return g === 'Admin' || g === 'Developer';
}

function splitCommaList(s) {
  return (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildQuery(params) {
  const q = new URLSearchParams();
  if (params.country?.trim()) q.set('country', params.country.trim());
  if (params.province?.trim()) q.set('province', params.province.trim());
  if (params.city?.trim()) q.set('city', params.city.trim());
  if (params.category?.trim()) q.set('category', params.category.trim());
  if (params.q?.trim()) q.set('q', params.q.trim());
  q.set('page', String(params.page));
  q.set('pageSize', String(params.pageSize));
  return q.toString();
}

export default function LeadsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const allowed = useMemo(() => canAccessLeads(authUser), [authUser]);

  const [country, setCountry] = useState('ES');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const [scrapeCountry, setScrapeCountry] = useState('ES');
  const [scrapeProvince, setScrapeProvince] = useState('');
  const [scrapeCity, setScrapeCity] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('limpieza');
  const [scrapeSource, setScrapeSource] = useState('auto');
  const [scrapeMaxPages, setScrapeMaxPages] = useState(1);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  /** idle | running | retrying | blocked | finished | timed_out | error — retrying también es heurístico en curso */
  const [scrapePhase, setScrapePhase] = useState('idle');
  const [scrapeElapsedSec, setScrapeElapsedSec] = useState(0);
  /** Solo Empresite: false = modo MVP rápido (por defecto); true = modo completo */
  const [empresiteFullMode, setEmpresiteFullMode] = useState(false);
  const [scrapeFeedback, setScrapeFeedback] = useState('');
  const [scrapeRegistry, setScrapeRegistry] = useState([]);
  const [scrapeShowAdvanced, setScrapeShowAdvanced] = useState(false);
  const [scrapeSynonyms, setScrapeSynonyms] = useState('');
  const [scrapeFreeText, setScrapeFreeText] = useState('');
  const [scrapeCodes, setScrapeCodes] = useState('');
  const [scrapeEnrich, setScrapeEnrich] = useState(false);
  const [scrapeSourceBreakdown, setScrapeSourceBreakdown] = useState(null);
  const [scrapeCriteriaSummary, setScrapeCriteriaSummary] = useState('');
  const htmlFileRef = useRef(null);
  const [htmlReady, setHtmlReady] = useState(false);

  const fetchLeads = useCallback(
    async (opts) => {
      const token = localStorage.getItem('auth_token');
      if (!token || !allowed) return;
      const effectivePage = opts?.page ?? page;
      const effectiveSize = opts?.pageSize ?? pageSize;
      const f = opts?.filters;
      setLoading(true);
      setError('');
      try {
        const qs = buildQuery({
          country: f?.country ?? country,
          province: f?.province ?? province,
          city: f?.city ?? city,
          category: f?.category ?? category,
          q: f?.q ?? q,
          page: effectivePage,
          pageSize: effectiveSize,
        });
        const url = `${config.BACKEND_BASE}/api/leads?${qs}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const m = data?.message;
          const msg = Array.isArray(m) ? m.join(', ') : m;
          throw new Error(msg || res.statusText || 'Error al cargar leads');
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      } catch (e) {
        setError(e?.message || 'Error de red');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [allowed, country, province, city, category, q, page, pageSize],
  );

  useEffect(() => {
    if (!authLoading && allowed) {
      fetchLeads();
    }
  }, [authLoading, allowed, fetchLeads]);

  useEffect(() => {
    if (!allowed || authLoading) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${config.BACKEND_BASE}/api/leads/scrape/registry`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.sources)) {
          setScrapeRegistry(data.sources);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, authLoading]);

  useEffect(() => {
    if (scrapeSource === 'auto' || SCRAPE_SELECTABLE_SOURCE_IDS.has(scrapeSource)) return;
    setScrapeSource('auto');
  }, [scrapeSource]);

  useEffect(() => {
    if (scrapeSource !== 'empresite') setEmpresiteFullMode(false);
  }, [scrapeSource]);

  useEffect(() => {
    if (!scrapeBusy) {
      setScrapeElapsedSec(0);
      return;
    }
    setScrapeElapsedSec(0);
    const id = setInterval(() => setScrapeElapsedSec((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [scrapeBusy]);

  const scrapePhaseActive = useMemo(() => {
    if (!scrapeBusy) return scrapePhase;
    if (scrapeSource === 'empresite' && scrapeElapsedSec > 15) return 'retrying';
    return 'running';
  }, [scrapeBusy, scrapePhase, scrapeSource, scrapeElapsedSec]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads({ page: 1 });
  };

  const onScrapeSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setScrapeBusy(true);
    setScrapePhase('running');
    setScrapeFeedback('');
    setScrapeSourceBreakdown(null);
    setScrapeCriteriaSummary('');
    setError('');
    const timeoutMs = scrapeFetchTimeoutMs(scrapeSource, empresiteFullMode);
    const ac = new AbortController();
    let timeoutId = null;
    try {
      const synonyms = splitCommaList(scrapeSynonyms);
      const classificationCodes = splitCommaList(scrapeCodes);
      timeoutId = setTimeout(() => ac.abort(), timeoutMs);
      const body = {
        country: scrapeCountry.trim() || 'ES',
        province: scrapeProvince.trim() || undefined,
        city: scrapeCity.trim() || undefined,
        category: scrapeCategory.trim(),
        source: scrapeSource,
        maxPages: Math.min(25, Math.max(1, Number(scrapeMaxPages) || 1)),
        synonyms: synonyms.length ? synonyms : undefined,
        freeText: scrapeFreeText.trim() || undefined,
        classificationCodes: classificationCodes.length ? classificationCodes : undefined,
        enrichContactPages: scrapeEnrich || undefined,
      };
      if (scrapeSource === 'empresite') {
        body.lightMode = !empresiteFullMode;
      }
      const res = await fetch(`${config.BACKEND_BASE}/api/leads/scrape`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: ac.signal,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = data?.message;
        const msg = Array.isArray(m) ? m.join(', ') : m;
        setScrapePhase(inferScrapePhase({ resOk: false, data }));
        throw new Error(msg || res.statusText || 'Error al extraer');
      }
      if (data.success === false) {
        setScrapePhase(inferScrapePhase({ resOk: true, data }));
        const parts = [data.message, data.stderr].filter(Boolean);
        setScrapeFeedback(parts.join('\n') || 'Extracción no completada');
        setScrapeSourceBreakdown(null);
        return;
      }
      setScrapePhase(inferScrapePhase({ resOk: true, data }));
      const warn = [data.message, data.stderr].filter(Boolean).join(' — ');
      const dedupeLine =
        data.mergedUnique != null && data.mergedUnique !== data.scrapedCount
          ? ` · Únicos (dedupe): ${data.mergedUnique}`
          : '';
      const critLine = data.scrapeCriteriaSummary ? ` · Criterios: ${data.scrapeCriteriaSummary}` : '';
      const diagLine = data.message ? `\n${data.message}` : '';
      setScrapeFeedback(
        `Filas por fuente (bruto): ${data.scrapedCount ?? 0}${dedupeLine} · Insertadas (total): ${data.inserted ?? 0} · Duplicados omitidos (total): ${data.skippedDuplicates ?? 0}${critLine}${warn ? ` · ${warn}` : ''}${diagLine}`,
      );
      if (data.scrapeCriteriaSummary) setScrapeCriteriaSummary(data.scrapeCriteriaSummary);
      if (data.sourceBreakdown && typeof data.sourceBreakdown === 'object') {
        setScrapeSourceBreakdown(data.sourceBreakdown);
      }
      setCountry(scrapeCountry.trim() || 'ES');
      setProvince(scrapeProvince.trim());
      setCity(scrapeCity.trim());
      setCategory(scrapeCategory.trim());
      setQ('');
      setPage(1);
      fetchLeads({
        page: 1,
        filters: {
          country: scrapeCountry.trim() || 'ES',
          province: scrapeProvince.trim(),
          city: scrapeCity.trim(),
          category: scrapeCategory.trim(),
          q: '',
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        setScrapePhase('timed_out');
        setScrapeFeedback(
          `Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s). El navegador ha dejado de esperar; en el servidor puede seguir unos segundos (revisa logs Nest: líneas [scraper]). Modo «auto» ejecuta varias fuentes; prueba una sola fuente, Empresite en modo rápido o HTML guardado de PA.`,
        );
      } else {
        setScrapePhase((p) => (p === 'running' || p === 'retrying' ? 'error' : p));
        setScrapeFeedback(err?.message || 'Error de red');
      }
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
      setScrapeBusy(false);
    }
  };

  const onScrapeFromSavedHtml = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const file = htmlFileRef.current?.files?.[0];
    if (!token || !file) {
      setScrapeFeedback('Selecciona un archivo HTML (página guardada desde el navegador).');
      return;
    }
    setScrapeBusy(true);
    setScrapeFeedback('');
    setScrapeSourceBreakdown(null);
    setScrapeCriteriaSummary('');
    setError('');
    const htmlTimeoutMs = 150_000;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), htmlTimeoutMs);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('country', scrapeCountry.trim() || 'ES');
      fd.append('province', scrapeProvince.trim());
      fd.append('city', scrapeCity.trim());
      fd.append('category', scrapeCategory.trim());
      fd.append('source', 'paginas_amarillas');
      fd.append('synonyms', scrapeSynonyms);
      fd.append('freeText', scrapeFreeText.trim());
      fd.append('classificationCodes', scrapeCodes);
      fd.append('enrichContactPages', scrapeEnrich ? 'true' : 'false');

      const res = await fetch(`${config.BACKEND_BASE}/api/leads/scrape/from-html`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = data?.message;
        const msg = Array.isArray(m) ? m.join(', ') : m;
        throw new Error(msg || res.statusText || 'Error al procesar HTML');
      }
      if (data.success === false) {
        const parts = [data.message, data.stderr].filter(Boolean);
        setScrapeFeedback(parts.join('\n') || 'No se pudieron extraer empresas del HTML');
        setScrapeSourceBreakdown(null);
        return;
      }
      const warn = [data.message, data.stderr].filter(Boolean).join(' — ');
      const critLine = data.scrapeCriteriaSummary ? ` · ${data.scrapeCriteriaSummary}` : '';
      const diagLine = data.message ? `\n${data.message}` : '';
      setScrapeFeedback(
        `[Desde HTML] Filas: ${data.scrapedCount ?? 0} · Insertadas: ${data.inserted ?? 0} · Duplicados omitidos: ${data.skippedDuplicates ?? 0}${critLine}${warn ? ` · ${warn}` : ''}${diagLine}`,
      );
      if (data.scrapeCriteriaSummary) setScrapeCriteriaSummary(data.scrapeCriteriaSummary);
      if (data.sourceBreakdown && typeof data.sourceBreakdown === 'object') {
        setScrapeSourceBreakdown(data.sourceBreakdown);
      }
      setCountry(scrapeCountry.trim() || 'ES');
      setProvince(scrapeProvince.trim());
      setCity(scrapeCity.trim());
      setCategory(scrapeCategory.trim());
      setQ('');
      setPage(1);
      fetchLeads({
        page: 1,
        filters: {
          country: scrapeCountry.trim() || 'ES',
          province: scrapeProvince.trim(),
          city: scrapeCity.trim(),
          category: scrapeCategory.trim(),
          q: '',
        },
      });
      if (htmlFileRef.current) htmlFileRef.current.value = '';
      setHtmlReady(false);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setScrapeFeedback(
          `Tiempo de espera agotado (${Math.round(htmlTimeoutMs / 1000)}s) al procesar el HTML.`,
        );
      } else {
        setScrapeFeedback(err?.message || 'Error de red');
      }
    } finally {
      clearTimeout(timeoutId);
      setScrapeBusy(false);
    }
  };

  const importJsonBody = async () => {
    const raw = window.prompt(
      'Pega JSON: array de objetos o { "leads": [...] } (máx. recomendado vía archivo)',
      '',
    );
    if (raw === null) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setImportBusy(true);
    setImportMsg('');
    try {
      const body = JSON.parse(raw);
      const leads = Array.isArray(body) ? body : body?.leads;
      if (!Array.isArray(leads)) {
        throw new Error('JSON inválido: se espera array o { leads: [] }');
      }
      const res = await fetch(`${config.BACKEND_BASE}/api/leads/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = data?.message;
        const msg = Array.isArray(m) ? m.join(', ') : m;
        throw new Error(msg || 'Import falló');
      }
      setImportMsg(
        `Insertados: ${data.inserted}, duplicados omitidos: ${data.skippedDuplicates}, inválidos: ${data.invalid}`,
      );
      setPage(1);
      fetchLeads({ page: 1 });
    } catch (e) {
      setImportMsg(e?.message || 'Error');
    } finally {
      setImportBusy(false);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setImportBusy(true);
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${config.BACKEND_BASE}/api/leads/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = data?.message;
        const msg = Array.isArray(m) ? m.join(', ') : m;
        throw new Error(msg || 'Import falló');
      }
      setImportMsg(
        `Insertados: ${data.inserted}, duplicados omitidos: ${data.skippedDuplicates}, inválidos: ${data.invalid}`,
      );
      setPage(1);
      fetchLeads({ page: 1 });
    } catch (err) {
      setImportMsg(err?.message || 'Error');
    } finally {
      setImportBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <p className="mb-4 text-center text-gray-700">Acceso restringido (solo Admin / Developer).</p>
        <Link to="/admin" className="text-red-600 underline">
          Volver al panel admin
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Back3DButton to="/admin" />
          <h1 className="text-2xl font-semibold text-gray-900">Leads (España)</h1>
        </div>

        {scrapeRegistry.length > 0 ? (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Fuentes — registro y estado</h2>
            <p className="mb-3 text-xs text-gray-500">
              Config:{' '}
              <code className="rounded bg-gray-100 px-1">tools/spanish-leads-scraper/sources/sources_config.json</code>.
              «Auto pipeline» = fuentes que el modo <strong>auto</strong> ejecutaría ahora (salud + flags). Última
              ejecución: pendiente de persistir (<code className="rounded bg-gray-100 px-1">lastRunStats</code>).
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-gray-800">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Fuente</th>
                    <th className="px-2 py-2 font-semibold">id</th>
                    <th className="px-2 py-2 font-semibold">Activo</th>
                    <th className="px-2 py-2 font-semibold">Auto pipeline</th>
                    <th className="px-2 py-2 font-semibold">Salud</th>
                    <th className="px-2 py-2 font-semibold">Tier</th>
                    <th className="px-2 py-2 font-semibold">Incl. auto</th>
                    <th className="px-2 py-2 font-semibold">Adaptador</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeRegistry.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="max-w-[140px] px-2 py-1.5 font-medium">{row.displayName}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-gray-600">{row.id}</td>
                      <td className="px-2 py-1.5">{row.enabled ? 'Sí' : 'No'}</td>
                      <td className="px-2 py-1.5">
                        {row.inAutoPipeline ? (
                          <span className="text-green-700">Sí</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{row.healthStatus ?? '—'}</td>
                      <td className="px-2 py-1.5">{row.tier != null ? row.tier : '—'}</td>
                      <td className="px-2 py-1.5">{row.includeInAuto ? 'Sí' : 'No'}</td>
                      <td className="max-w-[200px] truncate px-2 py-1.5 font-mono text-[10px] text-gray-600" title={row.adapterPath}>
                        {row.adapterPath ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={onScrapeSubmit}
          className="mb-6 rounded-lg border border-red-100 bg-white p-4 shadow-sm ring-1 ring-red-100"
        >
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Extraer desde internet</h2>
          <p className="mb-3 text-xs text-gray-500">
            <strong>Red:</strong> «auto» usa solo fuentes con salud permitida en config (por defecto suele ser solo{' '}
            <strong>Empresite</strong>). También puedes elegir una fuente concreta en el desplegable.
            PA y Google suelen bloquear bots.
            <strong className="ml-1">Plan B (solo PA):</strong> guarda la página de resultados en Chrome («Página web, completa») y úsala abajo.
          </p>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">País</label>
              <select
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={scrapeCountry}
                onChange={(ev) => setScrapeCountry(ev.target.value)}
                disabled={scrapeBusy}
              >
                <option value="ES">España (ES)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Provincia <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Vacío = toda España (recom. Europages)"
                value={scrapeProvince}
                onChange={(ev) => setScrapeProvince(ev.target.value)}
                disabled={scrapeBusy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Ciudad <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="ej. Madrid — opcional"
                value={scrapeCity}
                onChange={(ev) => setScrapeCity(ev.target.value)}
                disabled={scrapeBusy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Categoría / actividad</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="limpieza, mantenimiento…"
                value={scrapeCategory}
                onChange={(ev) => setScrapeCategory(ev.target.value)}
                disabled={scrapeBusy}
              />
              <p className="mt-1 text-xs text-gray-500">
                El servidor amplía la búsqueda (frases y CNAE según perfil en{' '}
                <code className="rounded bg-gray-100 px-1">category_search_profiles.json</code>) sin que tengas
                que listar sinónimos aquí.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fuente</label>
              <select
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={scrapeSource}
                onChange={(ev) => setScrapeSource(ev.target.value)}
                disabled={scrapeBusy}
              >
                <option value="auto">Auto (registro)</option>
                {scrapeRegistry.length ? (
                  scrapeRegistry
                    .filter((s) => SCRAPE_SELECTABLE_SOURCE_IDS.has(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                        {s.enabled ? '' : ' · off en auto'}
                      </option>
                    ))
                ) : (
                  <>
                    <option value="paginas_amarillas">Páginas Amarillas</option>
                    <option value="empresite">Empresite</option>
                    <option value="google_discovery">Google (descubrimiento)</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Máx. páginas (solo Páginas Amarillas)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={scrapeMaxPages}
                onChange={(ev) => setScrapeMaxPages(Number(ev.target.value))}
                disabled={scrapeBusy}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={scrapeShowAdvanced}
                onChange={(ev) => setScrapeShowAdvanced(ev.target.checked)}
                disabled={scrapeBusy}
              />
              Criterios avanzados (sinónimos, texto libre, códigos, enriquecer /contacto)
            </label>
          </div>

          {scrapeShowAdvanced ? (
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-dashed border-gray-200 bg-gray-50/80 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Sinónimos (coma)
                </label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="limpieza industrial, servicios de limpieza"
                  value={scrapeSynonyms}
                  onChange={(ev) => setScrapeSynonyms(ev.target.value)}
                  disabled={scrapeBusy}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Texto libre</label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Se añade a la consulta (p. ej. Google / Empresite)"
                  value={scrapeFreeText}
                  onChange={(ev) => setScrapeFreeText(ev.target.value)}
                  disabled={scrapeBusy}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Códigos / clasificación (coma)
                </label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="CNAE, NACE…"
                  value={scrapeCodes}
                  onChange={(ev) => setScrapeCodes(ev.target.value)}
                  disabled={scrapeBusy}
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={scrapeEnrich}
                    onChange={(ev) => setScrapeEnrich(ev.target.checked)}
                    disabled={scrapeBusy}
                  />
                  Enriquecer con /contacto (solo Google)
                </label>
              </div>
            </div>
          ) : null}

          {scrapeSource === 'empresite' ? (
            <div className="mb-3 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={empresiteFullMode}
                  onChange={(ev) => setEmpresiteFullMode(ev.target.checked)}
                  disabled={scrapeBusy}
                />
                Modo completo (más lento, más URLs y reintentos)
              </label>
              <p className="mt-1 text-xs text-amber-900/85">
                Por defecto: modo rápido para pruebas (menos URLs, menos reintentos, timeout ~5 min). Marca la casilla
                para extracción larga (~10 min).
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={scrapeBusy || !scrapeCategory.trim()}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {scrapeBusy
                ? scrapePhaseActive === 'retrying'
                  ? 'Reintentando…'
                  : 'Extrayendo…'
                : 'Extraer empresas (red)'}
            </button>
            {scrapeBusy ? (
              <span
                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${scrapePhaseBadgeClass(scrapePhaseActive)}`}
                role="status"
                aria-live="polite"
              >
                {scrapePhaseLabelEs(scrapePhaseActive)}
                {scrapeSource === 'empresite' ? ` · ${scrapeElapsedSec}s` : ''}
              </span>
            ) : scrapePhase !== 'idle' ? (
              <span
                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${scrapePhaseBadgeClass(scrapePhase)}`}
                role="status"
              >
                Último: {scrapePhaseLabelEs(scrapePhase)}
              </span>
            ) : null}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
              Desde HTML guardado (recomendado si hay bloqueo)
            </h3>
            <p className="mb-2 text-xs text-gray-500">
              Mismos campos de arriba definen categoría y ubicación en BD. El fichero debe ser la página de resultados ya cargada.
              <span className="block text-amber-800/90">
                Para HTML guardado (PA) sigue haciendo falta al menos provincia o ciudad; la extracción en red admite solo país + categoría.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={htmlFileRef}
                type="file"
                accept=".html,.htm,text/html"
                disabled={scrapeBusy}
                onChange={(ev) => setHtmlReady(!!ev.target.files?.length)}
                className="max-w-full text-sm text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
              />
              <button
                type="button"
                disabled={
                  scrapeBusy ||
                  !htmlReady ||
                  !scrapeCategory.trim() ||
                  (!scrapeProvince.trim() && !scrapeCity.trim())
                }
                onClick={onScrapeFromSavedHtml}
                className="rounded-lg border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                {scrapeBusy ? 'Procesando…' : 'Extraer desde este HTML'}
              </button>
            </div>
          </div>

          {scrapeFeedback ? (
            <p
              className={`mt-3 whitespace-pre-wrap text-sm ${
                scrapeFeedback.includes(EMPRESITE_RATE_LIMIT_SNIPPET)
                  ? 'rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950'
                  : 'text-gray-800'
              }`}
              role="status"
            >
              {scrapeFeedback}
            </p>
          ) : null}
          {scrapeCriteriaSummary ? (
            <p className="mt-2 text-xs text-gray-500">
              <strong>Última búsqueda:</strong> {scrapeCriteriaSummary}
            </p>
          ) : null}

          {scrapeSourceBreakdown && Object.keys(scrapeSourceBreakdown).length ? (
            <div className="mt-4 overflow-x-auto rounded border border-gray-200 bg-white">
              <table className="min-w-full text-left text-xs text-gray-800">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Fuente</th>
                    <th className="px-3 py-2 font-semibold">Salud (reg.)</th>
                    <th className="px-3 py-2 font-semibold">Tier</th>
                    <th className="px-3 py-2 font-semibold">Estado</th>
                    <th className="px-3 py-2 font-semibold">Código</th>
                    <th className="px-3 py-2 font-semibold">Motivo</th>
                    <th className="px-3 py-2 font-semibold">Bloqueo</th>
                    <th className="px-3 py-2 font-semibold">Scraped</th>
                    <th className="px-3 py-2 font-semibold">Insert.</th>
                    <th className="px-3 py-2 font-semibold">Dup</th>
                    <th className="px-3 py-2 font-semibold">Debug</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(scrapeSourceBreakdown).map(([id, row]) => (
                    <tr key={id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.displayName || id}</span>
                        <span className="ml-1 text-gray-400">({id})</span>
                      </td>
                      <td className="max-w-[100px] px-3 py-2 text-gray-700">
                        {row.registryHealth ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.registryTier != null ? row.registryTier : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.blocked ? (
                          <span className="text-red-700">Bloqueada</span>
                        ) : row.failed ? (
                          <span className="text-amber-700">Falló</span>
                        ) : (
                          <span className="text-green-700">OK</span>
                        )}
                        {row.error ? (
                          <span className="mt-0.5 block max-w-xs truncate text-gray-500" title={row.error}>
                            {row.error}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[10px] text-gray-600">
                        {row.zeroReasonCode ?? '—'}
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-gray-700">{row.hint ?? '—'}</td>
                      <td className="px-3 py-2">{row.blocked ? 'Sí' : 'No'}</td>
                      <td className="px-3 py-2">{row.scraped ?? 0}</td>
                      <td className="px-3 py-2">{row.inserted ?? 0}</td>
                      <td className="px-3 py-2">{row.skippedDuplicates ?? 0}</td>
                      <td className="px-3 py-2 align-top">
                        {row.debug ? (
                          <details className="max-w-[200px]">
                            <summary className="cursor-pointer text-red-700">ver</summary>
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-gray-600">
                              {JSON.stringify(row.debug, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </form>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Importar</h2>
          <p className="mb-3 text-xs text-gray-500">
            Ejecuta el scraper en <code className="rounded bg-gray-100 px-1">tools/spanish-leads-scraper</code>, guarda
            CSV/JSON/JSONL e impórtalo aquí. Dedupe por <code className="rounded bg-gray-100 px-1">dedupe_key</code>.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              <input
                type="file"
                accept=".csv,.json,.jsonl,text/csv,application/json"
                className="hidden"
                disabled={importBusy || scrapeBusy}
                onChange={onFileChange}
              />
              {importBusy ? 'Importando…' : 'Elegir archivo (CSV / JSON / JSONL)'}
            </label>
            <button
              type="button"
              disabled={importBusy || scrapeBusy}
              onClick={importJsonBody}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Pegar JSON (pequeño)
            </button>
          </div>
          {importMsg ? (
            <p className="mt-2 text-sm text-gray-700" role="status">
              {importMsg}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={onSearchSubmit}
          className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6"
        >
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="País (ej. ES)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Provincia"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Ciudad"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Buscar nombre empresa"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Aplicar filtros
            </button>
            <select
              className="rounded border border-gray-300 px-2 py-2 text-sm"
              value={pageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPageSize(n);
                setPage(1);
                fetchLeads({ page: 1, pageSize: n });
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / página
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">
              Total: {total} · Página {page} de {totalPages}
            </span>
          </div>
        </form>

        {error ? (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando…</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">Empresa</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Email</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Teléfono</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Web</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Cat.</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Ubicación</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Fuente</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      No hay leads. Usa «Extraer desde internet» o importa un archivo.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-900">
                        {row.companyName}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">{row.email || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.phone || '—'}</td>
                      <td className="max-w-[160px] truncate px-3 py-2">
                        {row.website ? (
                          <a
                            href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:underline"
                          >
                            {row.website}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.category || '—'}</td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-gray-600">
                        {[row.city, row.province, row.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-gray-500">{row.sourceName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
