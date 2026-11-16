export type HallOfFameActor = {
  grupo?: string;
  GRUPO?: string;
  role?: string;
};

/** Același cerc ca la calculul scorurilor: doar Developer. */
export function canDebugCuadrante(
  actor: HallOfFameActor | null | undefined,
): boolean {
  const grupo = String(actor?.grupo || actor?.GRUPO || '').trim();
  const role = String(actor?.role || '')
    .trim()
    .toUpperCase();
  return grupo === 'Developer' || role === 'DEVELOPER';
}
