import { ForbiddenException } from '@nestjs/common';
import { isImplicitAdmin } from './empleados-operation-access';

/** Tipuri pe care pagina angajatului le trimite mereu ca Pendiente. */
const EMPLOYEE_PENDING_TIPOS = new Set([
  'BAJA_VOLUNTARIA',
  'Permiso Retribuido',
  'Ausencias justificada',
]);

export type SolicitudActor = {
  userId?: string;
  email?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
  /** Bifa `solicitudes-admin`. Nu se deduce din numele grupului. */
  solicitudesAdmin?: boolean;
};

export type SolicitudRow = {
  codigo?: string | null;
  estado?: string | null;
  tipo?: string | null;
};

export function isSolicitudStaff(
  actor: SolicitudActor | null | undefined,
): boolean {
  return isImplicitAdmin(actor) || actor?.solicitudesAdmin === true;
}

function requireActor(actor: SolicitudActor | null | undefined): {
  userId: string;
  email: string;
} {
  const userId = String(actor?.userId || '').trim();
  const email = String(actor?.email || '').trim();
  if (!userId || !email) {
    throw new ForbiddenException('Sesión inválida');
  }
  return { userId, email };
}

export type SolicitudWrite = {
  codigo?: string;
  email?: string;
  nombre?: string;
  tipo?: string;
  estado?: string;
  origen?: string;
  creado_por?: string;
  creado_por_email?: string;
  motivo?: string;
  [key: string]: any;
};

export function guardSolicitudCreate<T extends SolicitudWrite>(
  actor: SolicitudActor | null | undefined,
  data: T,
): T {
  const identity = requireActor(actor);
  const next = { ...data };

  if (isSolicitudStaff(actor)) {
    next.origen = data.origen === 'MANAGER' ? 'MANAGER' : 'EMPLEADO';
    if (!next.estado) {
      next.estado = data.tipo === 'BAJA_VOLUNTARIA' ? 'Pendiente' : 'Aprobada';
    }
    return next;
  }

  next.codigo = identity.userId;
  next.email = identity.email;
  next.origen = 'EMPLEADO';
  next.creado_por = undefined;
  next.creado_por_email = undefined;

  const tipo = String(data.tipo || '').trim();
  if (EMPLOYEE_PENDING_TIPOS.has(tipo)) {
    next.estado = 'Pendiente';
  } else if (data.estado === 'Pendiente') {
    next.estado = 'Pendiente';
  } else if (!data.estado || data.estado === 'Aprobada') {
    next.estado = 'Aprobada';
  } else {
    next.estado = 'Pendiente';
  }

  return next;
}

export function guardSolicitudUpdate<T extends SolicitudWrite>(
  actor: SolicitudActor | null | undefined,
  existing: SolicitudRow | null | undefined,
  data: T,
): T {
  const identity = requireActor(actor);
  if (isSolicitudStaff(actor)) {
    return data;
  }

  const ownCodigo = String(existing?.codigo || '').trim();
  if (!existing || ownCodigo !== identity.userId) {
    throw new ForbiddenException('No puedes modificar esta solicitud');
  }

  const tipo = String(data.tipo || existing.tipo || '').trim();
  const requested = data.estado;
  if (requested === 'Rechazada') {
    throw new ForbiddenException(
      'No puedes cambiar el estado de esta solicitud',
    );
  }
  if (requested === 'Aprobada' && EMPLOYEE_PENDING_TIPOS.has(tipo)) {
    throw new ForbiddenException('No puedes aprobar esta solicitud');
  }

  const next = { ...data };
  delete next.codigo;
  delete next.email;
  delete next.nombre;
  return next;
}

export function guardSolicitudDelete(
  actor: SolicitudActor | null | undefined,
  existing: SolicitudRow | null | undefined,
  bodyCodigo?: string | null,
): string {
  const identity = requireActor(actor);
  if (isSolicitudStaff(actor)) {
    return String(bodyCodigo || existing?.codigo || '').trim();
  }

  const ownCodigo = String(existing?.codigo || '').trim();
  if (!existing || ownCodigo !== identity.userId) {
    throw new ForbiddenException('No puedes eliminar esta solicitud');
  }
  return identity.userId;
}
