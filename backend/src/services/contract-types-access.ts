import { isImplicitAdmin } from './empleados-operation-access';

export type ContractTypeActor = {
  userId?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

/** Doar Admin și Developer. Grupul cu bifa `empleados` rămâne în canManageContractTypes. */
export function isContractTypeStaff(
  actor: ContractTypeActor | null | undefined,
): boolean {
  return isImplicitAdmin(actor);
}

/**
 * Staff-ul cunoscut, sau grupul care are în matrice modulul empleados.
 * Lipsa rândului nu acordă dreptul de a crea tipuri de contract.
 */
export function canManageContractTypes(
  actor: ContractTypeActor | null | undefined,
  empleadosPermitted: boolean,
): boolean {
  if (!actor) return false;
  return isContractTypeStaff(actor) || empleadosPermitted === true;
}
