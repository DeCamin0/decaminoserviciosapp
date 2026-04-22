/** Minimal line shape for quantity helpers (compatible with page LineaPedido types). */
export type LineaPedidoLike = {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_linea?: number;
  iva_porcentaje?: number;
};

/** Sum quantity in cart for a product (handles duplicate legacy lines). */
export function sumQtyForProduct(lineas: LineaPedidoLike[], productoId: number): number {
  return lineas
    .filter((l) => l.producto_id === productoId)
    .reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
}

export type ProductoMin = {
  id: number;
  precio: number;
};

/**
 * Replace all lines for product with a single line at newQty, or remove all when newQty <= 0.
 */
export function lineasAfterSetProductQty(
  lineas: LineaPedidoLike[],
  producto: ProductoMin,
  newQty: number,
  defaultIva = 21,
): LineaPedidoLike[] {
  const q = Math.max(0, Math.floor(Number(newQty) || 0));
  const rest = lineas.filter((l) => l.producto_id !== producto.id);
  if (q <= 0) return rest;
  const existing = lineas.find((l) => l.producto_id === producto.id);
  const precio = existing?.precio_unitario ?? producto.precio;
  return [
    ...rest,
    {
      producto_id: producto.id,
      cantidad: q,
      precio_unitario: precio,
      descuento_linea: existing?.descuento_linea ?? 0,
      iva_porcentaje: existing?.iva_porcentaje ?? defaultIva,
    },
  ];
}
