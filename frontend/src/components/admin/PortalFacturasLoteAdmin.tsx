import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { routes } from '../../utils/routes';

const GRUPOS_GESTION = ['Developer', 'Admin', 'Manager', 'Supervisor'];

type ClienteOpt = {
  id: number;
  NIF?: string | null;
  NOMBRE_O_RAZON_SOCIAL?: string | null;
  'NOMBRE O RAZON SOCIAL'?: string | null;
};

type PageMatchApi = {
  pageIndex: number;
  cifDetectado: string | null;
  nombreDetectado: string | null;
  fechaEmisionDetectada?: string | null;
  fechaVencimientoDetectada?: string | null;
  numeroFacturaDetectado?: string | null;
  importeDetectado?: string | null;
  textoMuestra: string;
  clienteSugerido: {
    id: number;
    nif: string | null;
    nombre: string | null;
    score: number;
  } | null;
  nombreCoincide: boolean | null;
};

type PageRow = PageMatchApi & {
  clienteId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  importe: string;
  numeroFactura: string;
};

function defaultFechaEmision(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function nombreCliente(c: ClienteOpt): string {
  return (
    c.NOMBRE_O_RAZON_SOCIAL ||
    c['NOMBRE O RAZON SOCIAL'] ||
    c.NIF ||
    `Cliente #${c.id}`
  );
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
}

function rawItemHasId(c: unknown): c is Record<string, unknown> & { id: unknown } {
  return typeof c === 'object' && c !== null && (c as Record<string, unknown>).id != null;
}

export default function PortalFacturasLoteAdmin() {
  const { authToken, user: authUser } = useAuth();
  const grupo = String(authUser?.GRUPO || authUser?.grupo || '').trim();
  const allowed = GRUPOS_GESTION.includes(grupo);

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<PageRow[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<{ batchId: string; pageIndex: number; url: string } | null>(null);

  const loadClientes = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(routes.getClientes, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setClientes(
        list
          .filter(rawItemHasId)
          .map((c) => ({
            id: Number(c.id),
            NIF: strOrNull(c.NIF),
            NOMBRE_O_RAZON_SOCIAL:
              strOrNull(c.NOMBRE_O_RAZON_SOCIAL) ?? strOrNull(c['NOMBRE O RAZON SOCIAL']),
            'NOMBRE O RAZON SOCIAL': strOrNull(c['NOMBRE O RAZON SOCIAL']),
          })),
      );
    } catch {
      setClientes([]);
    }
  }, [authToken]);

  useEffect(() => {
    if (allowed) loadClientes();
  }, [allowed, loadClientes]);

  const clientesSorted = useMemo(() => {
    return [...clientes].sort((a, b) =>
      nombreCliente(a).localeCompare(nombreCliente(b), 'es'),
    );
  }, [clientes]);

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const openPreview = async (bId: string, pageIndex: number) => {
    if (!authToken) return;
    closePreview();
    setErr('');
    try {
      const res = await fetch(routes.adminPortalFacturasLotePreview(bId, pageIndex), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreview({ batchId: bId, pageIndex, url });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al cargar vista previa');
    }
  };

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !file) {
      setErr('Selecciona un PDF.');
      return;
    }
    setErr('');
    setMsg('');
    setAnalyzing(true);
    setBatchId(null);
    setRows([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(routes.adminPortalFacturasLoteAnalizar, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      const bid = json.batchId as string;
      const pages = (json.pages || []) as PageMatchApi[];
      if (!bid || !pages.length) {
        throw new Error('Respuesta inválida del servidor');
      }
      setBatchId(bid);
      setRows(
        pages.map((p) => ({
          ...p,
          clienteId: String(p.clienteSugerido?.id ?? ''),
          fechaEmision: p.fechaEmisionDetectada || defaultFechaEmision(),
          fechaVencimiento: p.fechaVencimientoDetectada || '',
          importe: p.importeDetectado ?? '',
          numeroFactura: p.numeroFacturaDetectado ?? '',
        })),
      );
      setMsg(
        `Análisis listo: ${pages.length} página(s). Revisa CIF/nombre y el cliente asignado antes de confirmar.`,
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  };

  const setRowCliente = (pageIndex: number, clienteId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.pageIndex === pageIndex ? { ...r, clienteId } : r)),
    );
  };

  const setRowFecha = (pageIndex: number, fechaEmision: string) => {
    setRows((prev) =>
      prev.map((r) => (r.pageIndex === pageIndex ? { ...r, fechaEmision } : r)),
    );
  };

  const setRowFechaVencimiento = (pageIndex: number, fechaVencimiento: string) => {
    setRows((prev) =>
      prev.map((r) => (r.pageIndex === pageIndex ? { ...r, fechaVencimiento } : r)),
    );
  };

  const setRowImporte = (pageIndex: number, importe: string) => {
    setRows((prev) =>
      prev.map((r) => (r.pageIndex === pageIndex ? { ...r, importe } : r)),
    );
  };

  const setRowNumeroFactura = (pageIndex: number, numeroFactura: string) => {
    setRows((prev) =>
      prev.map((r) => (r.pageIndex === pageIndex ? { ...r, numeroFactura } : r)),
    );
  };

  const onConfirm = async () => {
    if (!authToken || !batchId) return;
    const assignments = rows
      .filter((r) => r.clienteId && Number(r.clienteId) > 0)
      .map((r) => ({
        pageIndex: r.pageIndex,
        cliente_id: Number(r.clienteId),
        fecha_emision: r.fechaEmision,
        fecha_vencimiento: r.fechaVencimiento.trim() || undefined,
        importe: r.importe.trim() || undefined,
        numero_factura: r.numeroFactura.trim() || undefined,
      }));
    if (!assignments.length) {
      setErr('Asigna al menos un cliente a una página (selector por fila).');
      return;
    }
    setErr('');
    setMsg('');
    setConfirming(true);
    try {
      const res = await fetch(routes.adminPortalFacturasLoteConfirmar(batchId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignments }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      setMsg(
        `Guardadas ${json.created ?? assignments.length} factura(s) en el área de clientes (portal).`,
      );
      setBatchId(null);
      setRows([]);
      setFile(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Tu rol no incluye esta función.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Facturas mensuales (import PDF multipágina)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Sube un PDF tipo «para imprimir» con una factura por página. El sistema intenta
          detectar el <strong>CIF/NIF</strong>, <strong>nº factura</strong>, <strong>fechas</strong>,{' '}
          <strong>importe total (IVA)</strong> si constan en el PDF, y la <strong>razón social</strong>;
          sugiere el cliente y permite revisar cada página (vista previa) antes de guardar en{' '}
          <strong>facturas del portal</strong> por cliente.
        </p>

        <form onSubmit={onAnalyze} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              PDF (máx. ~35 MB, hasta 120 páginas)
            </label>
            <input
              type="file"
              accept="application/pdf"
              className="block w-full text-sm text-gray-700"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={analyzing || !file}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {analyzing ? 'Analizando…' : 'Analizar PDF'}
            </button>
          </div>
        </form>
      </div>

      {msg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {rows.length > 0 && batchId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-base font-bold text-gray-900">Resultado del análisis</h3>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {confirming ? 'Guardando…' : 'Confirmar e importar'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">Pág.</th>
                  <th className="py-2 pr-2">CIF detectado</th>
                  <th className="py-2 pr-2 whitespace-nowrap">Fecha emisión</th>
                  <th className="py-2 pr-2 whitespace-nowrap">Vencimiento</th>
                  <th className="py-2 pr-2 min-w-[100px]">Nº factura</th>
                  <th className="py-2 pr-2 whitespace-nowrap">Importe €</th>
                  <th className="py-2 pr-2">Nombre detectado</th>
                  <th className="py-2 pr-2">Cliente (asignar)</th>
                  <th className="py-2 pr-2">Match</th>
                  <th className="py-2 pr-2 text-right">Vista previa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pageIndex} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-2 whitespace-nowrap">{r.pageIndex + 1}</td>
                    <td className="py-2 pr-2 max-w-[120px] break-all">
                      {r.cifDetectado || '—'}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <input
                        type="date"
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs max-w-[140px]"
                        value={r.fechaEmision}
                        onChange={(e) => setRowFecha(r.pageIndex, e.target.value)}
                        title={
                          r.fechaEmisionDetectada
                            ? `Detectada en PDF: ${r.fechaEmisionDetectada}`
                            : 'No detectada en PDF; revisa la fecha'
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <input
                        type="date"
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs max-w-[140px]"
                        value={r.fechaVencimiento}
                        onChange={(e) =>
                          setRowFechaVencimiento(r.pageIndex, e.target.value)
                        }
                        title={
                          r.fechaVencimientoDetectada
                            ? `Detectada: ${r.fechaVencimientoDetectada}`
                            : 'Opcional — vacío usa texto del PDF si existe'
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        className="w-full min-w-[90px] rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        value={r.numeroFactura}
                        onChange={(e) =>
                          setRowNumeroFactura(r.pageIndex, e.target.value)
                        }
                        placeholder="—"
                        title={r.numeroFacturaDetectado || 'Número de factura'}
                      />
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full max-w-[100px] rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        value={r.importe}
                        onChange={(e) => setRowImporte(r.pageIndex, e.target.value)}
                        placeholder="—"
                        title={
                          r.importeDetectado
                            ? `Detectado: ${r.importeDetectado} €`
                            : 'Total con IVA (ej. 6140.75 o 6140,75)'
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 max-w-[200px]" title={r.nombreDetectado || ''}>
                      <div className="truncate">{r.nombreDetectado || '—'}</div>
                      <div className="text-xs text-gray-400 truncate" title={r.textoMuestra}>
                        {r.textoMuestra.slice(0, 80)}…
                      </div>
                    </td>
                    <td className="py-2 pr-2 min-w-[200px]">
                      <select
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        value={r.clienteId}
                        onChange={(e) => setRowCliente(r.pageIndex, e.target.value)}
                      >
                        <option value="">— Sin asignar —</option>
                        {clientesSorted.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {nombreCliente(c)} {c.NIF ? `(${c.NIF})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-xs">
                      {r.clienteSugerido ? (
                        <span
                          className={
                            r.nombreCoincide === true
                              ? 'text-emerald-700'
                              : r.nombreCoincide === false
                                ? 'text-amber-700'
                                : 'text-gray-600'
                          }
                        >
                          Sugerido: {r.clienteSugerido.nombre?.slice(0, 28) || r.clienteSugerido.nif}
                          <br />
                          Score {r.clienteSugerido.score}
                          {r.nombreCoincide === true && ' · nombre OK'}
                          {r.nombreCoincide === false && ' · revisar nombre'}
                        </span>
                      ) : (
                        <span className="text-gray-400">Sin match CIF</span>
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-red-700 hover:underline text-sm"
                        onClick={() => openPreview(batchId, r.pageIndex)}
                      >
                        Ver PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-semibold text-gray-900">
                Vista previa — página {preview.pageIndex + 1}
              </span>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900"
                onClick={closePreview}
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 min-h-[60vh] p-2">
              <iframe
                title="Preview factura"
                src={preview.url}
                className="w-full h-[70vh] border border-gray-200 rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
