export type JwtAccessDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing-user'
        | 'version-mismatch'
        | 'lookup-failed'
        | 'inactive';
    };

export function decideJwtAccess(input: {
  lookupFailed: boolean;
  userFound: boolean;
  tokenAuthVersion: number;
  storedAuthVersion: number;
  estado?: string | null;
  impersonation?: boolean;
}): JwtAccessDecision {
  if (input.lookupFailed) return { ok: false, reason: 'lookup-failed' };
  if (!input.userFound) return { ok: false, reason: 'missing-user' };
  if (input.tokenAuthVersion !== input.storedAuthVersion) {
    return { ok: false, reason: 'version-mismatch' };
  }
  const estado = String(input.estado || '')
    .trim()
    .toUpperCase();
  if (estado && estado !== 'ACTIVO' && input.impersonation !== true) {
    return { ok: false, reason: 'inactive' };
  }
  return { ok: true };
}
