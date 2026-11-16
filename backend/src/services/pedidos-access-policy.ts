import { isImplicitAdmin } from './empleados-operation-access';

export type PedidosActor = {
  userId?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

export type PedidosScope = 'all' | 'centro' | 'none';

export type PedidoScopeRow = {
  empleadoId?: string | null;
  comunidadNombre?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** Doar Admin și Developer. `pedidos-admin` deschide restul grupurilor. */
export function isPedidosFullStaff(
  actor: PedidosActor | null | undefined,
): boolean {
  return isImplicitAdmin(actor);
}

/**
 * Complet: staff sau `pedidos-admin`.
 * Centru: `pedidos-empleados` sau permisiunea veche `pedidos`.
 * Altfel: niciun acces la comenzi.
 */
export function pedidosScope(input: {
  actor: PedidosActor | null | undefined;
  pedidosAdmin: boolean;
  pedidosEmpleados: boolean;
  pedidosLegacy: boolean;
}): PedidosScope {
  const actor = input.actor;
  if (!actor?.userId) return 'none';
  if (isPedidosFullStaff(actor) || input.pedidosAdmin === true) return 'all';
  if (input.pedidosEmpleados === true || input.pedidosLegacy === true) {
    return 'centro';
  }
  return 'none';
}

export function pedidoInScope(
  scope: PedidosScope,
  actorUserId: string | undefined,
  centroNombre: string | undefined,
  pedido: PedidoScopeRow,
): boolean {
  if (scope === 'all') return true;
  if (scope === 'none') return false;
  const own =
    !!actorUserId &&
    normalize(pedido.empleadoId) !== '' &&
    normalize(pedido.empleadoId) === normalize(actorUserId);
  const centro =
    normalize(centroNombre) !== '' &&
    normalize(pedido.comunidadNombre) === normalize(centroNombre);
  return own || centro;
}

export function canCreatePedido(
  scope: PedidosScope,
  actorUserId: string | undefined,
  bodyEmpleadoId: unknown,
): boolean {
  if (scope === 'all') return true;
  if (scope !== 'centro') return false;
  return !!actorUserId && normalize(bodyEmpleadoId) === normalize(actorUserId);
}

export function canReadPedidosNotas(scope: PedidosScope): boolean {
  return scope === 'all' || scope === 'centro';
}

export function canWritePedidosNotas(scope: PedidosScope): boolean {
  return scope === 'all';
}

export function permissionFlag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 'TRUE'
  );
}

export async function resolvePedidosAccessFromUser(
  user:
    | {
        userId?: string;
        codigo?: string;
        grupo?: string;
        GRUPO?: string;
        role?: string;
        isManager?: boolean;
      }
    | null
    | undefined,
  loadFlags: (grupo: string) => Promise<{
    pedidosAdmin: boolean;
    pedidosEmpleados: boolean;
    pedidosLegacy: boolean;
  }>,
  loadCentro: (codigo: string) => Promise<string>,
): Promise<{ scope: PedidosScope; userId: string; centro: string }> {
  const actor: PedidosActor = {
    userId: String(user?.userId || user?.codigo || '').trim() || undefined,
    grupo: user?.grupo ?? user?.GRUPO,
    role: user?.role,
    isManager: user?.isManager === true,
  };
  const grupo = String(actor.grupo || '').trim();
  let flags = {
    pedidosAdmin: false,
    pedidosEmpleados: false,
    pedidosLegacy: false,
  };
  if (grupo) {
    try {
      flags = await loadFlags(grupo);
    } catch {
      flags = {
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      };
    }
  }
  const scope = pedidosScope({ actor, ...flags });
  let centro = '';
  if (scope === 'centro' && actor.userId) {
    try {
      centro = String((await loadCentro(actor.userId)) || '').trim();
    } catch {
      centro = '';
    }
  }
  return { scope, userId: actor.userId || '', centro };
}
