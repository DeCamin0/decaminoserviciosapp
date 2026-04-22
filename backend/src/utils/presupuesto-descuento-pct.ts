/**
 * % «Descuento por fidelidad» sobre la oferta: 0–100 con hasta 2 decimales (ej. 7.5, 8.25).
 */
export function clampPresupuestoDescuentoGlobalPct(raw: unknown): number {
  const s =
    raw === null || raw === undefined
      ? ''
      : typeof raw === 'string'
        ? raw.trim().replace(',', '.')
        : String(raw).trim().replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(100, Math.max(0, n));
  return Math.round(clamped * 100) / 100;
}
