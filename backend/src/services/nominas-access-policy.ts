import { ForbiddenException } from '@nestjs/common';
import { isImplicitAdmin } from './empleados-operation-access';

export type NominaActor = {
  userId?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

/** Doar Admin și Developer. Numele de grup și isManager nu deschid nóminas. */
export function isNominaStaff(actor: NominaActor | null | undefined): boolean {
  return isImplicitAdmin(actor);
}

/**
 * Staff-ul cunoscut, sau grupul care are în matrice modulul documentos-empleados.
 * Lipsa rândului nu acordă acces la nóminele altora.
 */
export function canManageNominas(
  actor: NominaActor | null | undefined,
  documentosEmpleadosPermitted: boolean,
): boolean {
  return isNominaStaff(actor) || documentosEmpleadosPermitted === true;
}

export function nominasListScope(
  actor: NominaActor | null | undefined,
  query: { nombre?: string; codigo?: string },
  canManage: boolean,
): { nombre?: string; codigo?: string } {
  const userId = String(actor?.userId || '').trim();
  if (!userId) {
    throw new ForbiddenException('Sesión inválida');
  }
  if (canManage || isNominaStaff(actor)) {
    return { nombre: query.nombre, codigo: query.codigo };
  }
  return { codigo: userId };
}

export function assertNominaRowAccess(
  actor: NominaActor | null | undefined,
  row: { codigo_empleado?: string | null },
  canManage: boolean,
  sameNameCodigos?: string[],
): void {
  if (canManage || isNominaStaff(actor)) return;
  const userId = String(actor?.userId || '').trim();
  if (!userId) {
    throw new ForbiddenException('Sesión inválida');
  }
  const codigo = String(row?.codigo_empleado || '').trim();
  if (codigo) {
    if (codigo !== userId) {
      throw new ForbiddenException('No puedes acceder a esta nómina');
    }
    return;
  }

  const owners = [
    ...new Set(
      (sameNameCodigos || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  ];
  if (owners.length === 1 && owners[0] === userId) return;
  throw new ForbiddenException('No puedes acceder a esta nómina');
}

export function personNameFromNomina(storedNombre: string): string {
  return String(storedNombre || '')
    .trim()
    .replace(/^finiquito\s*-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nominaNombreMatchesOwner(
  storedNombre: string,
  ownerName: string,
): boolean {
  const norm = (value: string) =>
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  const stored = norm(storedNombre);
  const owner = norm(ownerName);
  if (!stored || !owner) return false;
  if (stored === owner) return true;
  if (stored === norm(`FINIQUITO - ${ownerName}`)) return true;
  return personNameFromNomina(stored) === owner;
}

export function assertCanMutateNominas(
  actor: NominaActor | null | undefined,
  canManage: boolean,
): void {
  const userId = String(actor?.userId || '').trim();
  if (!userId) {
    throw new ForbiddenException('Sesión inválida');
  }
  if (canManage || isNominaStaff(actor)) return;
  throw new ForbiddenException('No puedes modificar nóminas');
}

export function assertExportAllNominas(
  actor: NominaActor | null | undefined,
  canManage: boolean,
): void {
  assertCanMutateNominas(actor, canManage);
}

export function assertUnscopedEmployeeExport(
  actor: NominaActor | null | undefined,
  targetCodigo: string,
  canManage: boolean,
): void {
  const userId = String(actor?.userId || '').trim();
  const target = String(targetCodigo || '').trim();
  if (!userId) {
    throw new ForbiddenException('Sesión inválida');
  }
  if (target && target === userId) return;
  if (canManage || isNominaStaff(actor)) return;
  throw new ForbiddenException(
    'No puedes exportar los documentos de este empleado',
  );
}

export function assertOwnOrManagedNombre(
  actor: NominaActor | null | undefined,
  requestedNombre: string,
  ownerName: string | null | undefined,
  canManage: boolean,
): void {
  if (canManage || isNominaStaff(actor)) return;
  const userId = String(actor?.userId || '').trim();
  if (!userId || !ownerName) {
    throw new ForbiddenException('No puedes acceder a esta nómina');
  }
  if (!nominaNombreMatchesOwner(requestedNombre, ownerName)) {
    throw new ForbiddenException('No puedes acceder a esta nómina');
  }
}
