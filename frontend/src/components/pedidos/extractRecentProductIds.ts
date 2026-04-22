type PedidoItemLike = {
  producto_id?: number | string;
  numero_articulo?: string;
};

type PedidoLike = {
  fecha?: string;
  fecha_envio?: string;
  items?: PedidoItemLike[];
};

type CatalogNumeroLike = { id: number; numero: string };

function normalizeNumero(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Collects recent catalog product ids from pedido history.
 * Uses `producto_id` when present; otherwise maps `numero_articulo` to catalog `numero` when `catalog` is passed.
 */
export function extractRecentProductIdsFromPedidos(
  pedidos: PedidoLike[],
  max = 16,
  catalog?: CatalogNumeroLike[],
): number[] {
  const numeroToId = new Map<string, number>();
  if (catalog?.length) {
    for (const c of catalog) {
      const key = normalizeNumero(c.numero);
      if (key && !numeroToId.has(key)) numeroToId.set(key, c.id);
    }
  }

  const sorted = [...pedidos].sort((a, b) => {
    const ta = Date.parse(String(a.fecha || a.fecha_envio || '')) || 0;
    const tb = Date.parse(String(b.fecha || b.fecha_envio || '')) || 0;
    return tb - ta;
  });
  const out: number[] = [];
  const seen = new Set<number>();
  for (const p of sorted) {
    const items = Array.isArray(p.items) ? p.items : [];
    for (const it of items) {
      const fromId = Number(it.producto_id);
      let resolved: number | null = null;
      if (Number.isFinite(fromId) && fromId > 0) {
        resolved = fromId;
      } else if (numeroToId.size > 0) {
        const key = normalizeNumero(it.numero_articulo);
        if (key && numeroToId.has(key)) resolved = numeroToId.get(key)!;
      }
      if (resolved == null || seen.has(resolved)) continue;
      seen.add(resolved);
      out.push(resolved);
      if (out.length >= max) return out;
    }
  }
  return out;
}
