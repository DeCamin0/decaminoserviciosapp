export type PermissionsActor = {
  grupo?: string;
  role?: string;
};

function isMatrixAdmin(actor: PermissionsActor): boolean {
  const grupo = String(actor.grupo || '').trim();
  const role = String(actor.role || '')
    .trim()
    .toUpperCase();
  return (
    grupo === 'Admin' ||
    grupo === 'Developer' ||
    role === 'ADMIN' ||
    role === 'DEVELOPER'
  );
}

/**
 * Scrierea matricei: Admin, Developer, sau grupul care are deja modulul `admin`
 * (același criteriu cu care se deschide ecranul de administrare).
 */
export function canWritePermissions(
  actor: PermissionsActor | null | undefined,
  adminModulePermitted: boolean,
): boolean {
  if (!actor) return false;
  return isMatrixAdmin(actor) || adminModulePermitted === true;
}

export function canReadAllPermissions(
  actor: PermissionsActor | null | undefined,
  adminModulePermitted: boolean,
): boolean {
  return canWritePermissions(actor, adminModulePermitted);
}
