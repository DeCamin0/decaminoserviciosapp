import { ForbiddenException } from '@nestjs/common';
import { isImplicitAdmin } from './empleados-operation-access';

export type DocumentoActor = {
  userId?: string;
  email?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

/** Doar Admin și Developer. Restul folosesc bifele din matrice. */
export function isDocumentoStaff(
  actor: DocumentoActor | null | undefined,
): boolean {
  return isImplicitAdmin(actor);
}

export function canReadDocumentos(
  actor: DocumentoActor | null | undefined,
  documentosEmpleadosPermitted: boolean,
  solicitudesAdminPermitted: boolean,
): boolean {
  return (
    isDocumentoStaff(actor) ||
    documentosEmpleadosPermitted === true ||
    solicitudesAdminPermitted === true
  );
}

export function canManageDocumentos(
  actor: DocumentoActor | null | undefined,
  documentosEmpleadosPermitted: boolean,
): boolean {
  return isDocumentoStaff(actor) || documentosEmpleadosPermitted === true;
}

function requireUserId(actor: DocumentoActor | null | undefined): string {
  const userId = String(actor?.userId || '').trim();
  if (!userId) {
    throw new ForbiddenException('Sesión inválida');
  }
  return userId;
}

export function documentosListScope(
  actor: DocumentoActor | null | undefined,
  query: { empleadoId?: string; email?: string },
  canRead: boolean,
): { empleadoId?: string; email?: string } {
  const userId = requireUserId(actor);
  if (canRead || isDocumentoStaff(actor)) {
    return { empleadoId: query.empleadoId, email: query.email };
  }
  return { empleadoId: userId };
}

export function documentosDownloadScope(
  actor: DocumentoActor | null | undefined,
  query: { empleadoId?: string; email?: string; fileName?: string },
  canRead: boolean,
): { empleadoId?: string; email?: string; fileName?: string } {
  const userId = requireUserId(actor);
  if (canRead || isDocumentoStaff(actor)) {
    return query;
  }
  return { empleadoId: userId, fileName: query.fileName };
}

export function documentosUploadOwner(
  actor: DocumentoActor | null | undefined,
  requestedEmpleadoId: string | null | undefined,
  canManage: boolean,
): string {
  const userId = requireUserId(actor);
  const requested = String(requestedEmpleadoId || '').trim();
  if (canManage || isDocumentoStaff(actor)) {
    return requested;
  }
  if (requested && requested !== userId) {
    throw new ForbiddenException(
      'No puedes subir documentos para este empleado',
    );
  }
  return userId;
}

export function assertDocumentoOwner(
  actor: DocumentoActor | null | undefined,
  ownerCodigo: string | null | undefined,
  canManage: boolean,
): void {
  if (canManage || isDocumentoStaff(actor)) return;
  const userId = requireUserId(actor);
  if (String(ownerCodigo || '').trim() !== userId) {
    throw new ForbiddenException('No puedes eliminar este documento');
  }
}
