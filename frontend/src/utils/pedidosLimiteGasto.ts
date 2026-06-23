/** Límite de gasto del cliente (CuantoPuedeGastar) — alineado con pedidos.service.ts */

export function parseLimiteGastoCliente(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

const LIMITE_GASTO_BYPASS_GRUPOS = new Set([
  'developer',
  'admin',
  'administrador',
  'administrator',
  'administrativ',
  'administrativo',
  'supervisor',
  'manager',
]);

/** Empleados sí respetan el límite; conducerea puede superarlo (igual que backend). */
export function shouldEnforcePedidoLimiteGasto(
  user?: Record<string, unknown> | null,
): boolean {
  if (!user) return true;
  if (user.isManager === true) return false;
  const grupo = String(user.GRUPO ?? user.grupo ?? '')
    .trim()
    .toLowerCase();
  if (grupo && LIMITE_GASTO_BYPASS_GRUPOS.has(grupo)) return false;
  return true;
}

export function subtotalExceedsLimiteGasto(subtotal: number, limite: number): boolean {
  const sub = Math.round(subtotal * 100) / 100;
  const lim = Math.round(limite * 100) / 100;
  return sub - lim > 0.02;
}

export function pedidoLimiteExcedidoFlags(
  subtotal: number,
  limite: number | null,
): { limite_excedido: boolean; exceso_limite: number } {
  if (limite == null) return { limite_excedido: false, exceso_limite: 0 };
  const exceeded = subtotalExceedsLimiteGasto(subtotal, limite);
  return { limite_excedido: exceeded, exceso_limite: exceeded ? 1 : 0 };
}
