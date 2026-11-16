import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { EmpleadoGrupoScopeFilter } from './empleado-grupo-scope.service';
import { permissionFlag } from './pedidos-access-policy';

export const EMPLEADO_OPERATION_MODULES = [
  'empleados',
  'fichar-admin',
  'fichar-empleados',
  'aprobaciones',
  'admin',
] as const;

export type EmpleadoActor = {
  userId?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

export type EmpleadoModuleFlags = {
  empleados: boolean;
  ficharAdmin: boolean;
  ficharEmpleados: boolean;
  aprobaciones: boolean;
  admin: boolean;
};

export type PermissionRow = {
  grupo_module?: string | null;
  permitted?: unknown;
};

const EMPTY_FLAGS: EmpleadoModuleFlags = {
  empleados: false,
  ficharAdmin: false,
  ficharEmpleados: false,
  aprobaciones: false,
  admin: false,
};

/** Câmpuri administrative scoase din lista văzută doar cu fichar-admin. */
const FICHAR_HIDDEN_FIELDS = [
  'NACIONALIDAD',
  'DIRECCION',
  'D.N.I. / NIE',
  'DNI_NIE',
  'SEG. SOCIAL',
  'SEG_SOCIAL',
  'Nº Cuenta',
  'NUMERO_CUENTA',
  'TELEFONO',
  'FECHA NACIMIENTO',
  'FECHA_NACIMIENTO',
  'TIPO DE CONTRATO',
  'SUELDO BRUTO MENSUAL',
  'SUELDO_BRUTO_MENSUAL',
  'HORAS DE CONTRATO',
  'HORAS_CONTRATO',
  'EMPRESA',
  'DerechoPedidos',
  'certificado_handicap_confirmado',
  'fecha_baja_programada',
  'VACACIONES_RESTANTES_ANO_ANTERIOR',
  'NOMBRE_APELLIDOS_BACKUP',
  'Contraseña',
  'CONTRASEÑA',
] as const;

export function toEmpleadoActor(user: any): EmpleadoActor {
  return {
    userId: String(user?.userId || user?.CODIGO || user?.codigo || '').trim(),
    grupo: user?.grupo ?? user?.GRUPO,
    role: user?.role,
    isManager: user?.isManager === true,
  };
}

/**
 * Doar Admin și Developer. Bifele din matrice, inclusiv `false`, nu îi limitează.
 * `isManager` și numele Manager/Supervisor/RRHH/Jefe nu intră aici.
 */
export function isImplicitAdmin(
  actor: EmpleadoActor | null | undefined,
): boolean {
  if (!actor) return false;
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

export function emptyEmpleadoModuleFlags(): EmpleadoModuleFlags {
  return { ...EMPTY_FLAGS };
}

export function flagsFromPermissionRows(
  grupo: string,
  rows: PermissionRow[],
): EmpleadoModuleFlags {
  const flags = emptyEmpleadoModuleFlags();
  const prefix = `${String(grupo || '').trim()}_`;
  if (prefix === '_') return flags;
  for (const row of rows) {
    const key = String(row.grupo_module || '');
    if (!key.startsWith(prefix)) continue;
    if (!permissionFlag(row.permitted)) continue;
    const moduleName = key.slice(prefix.length);
    if (moduleName === 'empleados') flags.empleados = true;
    else if (moduleName === 'fichar-admin') flags.ficharAdmin = true;
    else if (moduleName === 'fichar-empleados') flags.ficharEmpleados = true;
    else if (moduleName === 'aprobaciones') flags.aprobaciones = true;
    else if (moduleName === 'admin') flags.admin = true;
  }
  return flags;
}

export async function loadEmpleadoModuleFlags(
  grupo: string | null | undefined,
  findRows: (keys: string[]) => Promise<PermissionRow[]>,
): Promise<EmpleadoModuleFlags> {
  const name = String(grupo || '').trim();
  if (!name) return emptyEmpleadoModuleFlags();
  const keys = EMPLEADO_OPERATION_MODULES.map(
    (moduleName) => `${name}_${moduleName}`,
  );
  try {
    const rows = await findRows(keys);
    return flagsFromPermissionRows(name, rows);
  } catch {
    return emptyEmpleadoModuleFlags();
  }
}

/** Admin/Developer sau bifa explicită `empleados`. */
export function canWriteEmployeeFile(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return isImplicitAdmin(actor) || flags.empleados === true;
}

/** Admin/Developer sau bifa `aprobaciones`. `empleados` nu aprobă singur. */
export function canApproveEmployeeChange(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return isImplicitAdmin(actor) || flags.aprobaciones === true;
}

/** Admin/Developer, `empleados` sau `fichar-admin`. */
export function canReadEmployeeDirectory(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return (
    isImplicitAdmin(actor) ||
    flags.empleados === true ||
    flags.ficharAdmin === true
  );
}

/**
 * Fișă completă pentru Admin/Developer și pentru modulul `empleados`.
 * Doar `fichar-admin` primește proiecția de pontaj.
 */
export function employeeDirectoryProjection(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): 'full' | 'fichar' {
  if (isImplicitAdmin(actor) || flags.empleados === true) return 'full';
  if (flags.ficharAdmin === true) return 'fichar';
  return 'full';
}

/** Estado Empleados: Admin/Developer sau bifa `admin`. Nu deschide scrierea fișei. */
export function canReadEmpleadoStatus(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return isImplicitAdmin(actor) || flags.admin === true;
}

/** Admin/Developer sau `fichar-admin`. */
export function canManageOtherFichajes(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return isImplicitAdmin(actor) || flags.ficharAdmin === true;
}

/** Pontaj propriu: Admin/Developer, `fichar-empleados` sau `fichar-admin`. */
export function canWriteOwnFichaje(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): boolean {
  return canManageOtherFichajes(actor, flags) || flags.ficharEmpleados === true;
}

export type OperationAudience = 'all' | 'scope' | 'self';

/**
 * Scope-ul limitează. Nu acordă firmei unui utilizator fără dreptul de operațiune.
 * Admin/Developer (bypass) rămân pe toată firma, chiar dacă au rânduri.
 */
export function operationAudience(input: {
  bypass: boolean;
  hasScopeRows: boolean;
  companyRight: boolean;
}): OperationAudience {
  if (input.bypass) return 'all';
  if (input.hasScopeRows) return input.companyRight ? 'scope' : 'self';
  return input.companyRight ? 'all' : 'self';
}

export function resolveDirectoryListAccess(
  actor: EmpleadoActor | null | undefined,
  scope: EmpleadoGrupoScopeFilter | null,
  flags: EmpleadoModuleFlags,
):
  | { kind: 'all' }
  | { kind: 'scope'; scope: EmpleadoGrupoScopeFilter }
  | { kind: 'self'; codigo: string } {
  const codigo = String(actor?.userId || '').trim();
  if (!codigo) {
    throw new UnauthorizedException('Sesión inválida');
  }
  if (isImplicitAdmin(actor)) {
    return { kind: 'all' };
  }
  const directory = canReadEmployeeDirectory(actor, flags);
  if (scope?.grupos?.length && directory) {
    return { kind: 'scope', scope };
  }
  if (directory && !scope?.grupos?.length) {
    return { kind: 'all' };
  }
  return { kind: 'self', codigo };
}

export function projectEmpleadoForFicharAdmin<T extends Record<string, any>>(
  row: T,
): T {
  const copy: Record<string, any> = { ...row };
  for (const key of FICHAR_HIDDEN_FIELDS) {
    delete copy[key];
  }
  return copy as T;
}

export function projectEmpleadoList(
  rows: unknown,
  projection: 'full' | 'fichar',
): unknown {
  if (projection !== 'fichar' || !Array.isArray(rows)) return rows;
  return rows.map((row) =>
    row && typeof row === 'object'
      ? projectEmpleadoForFicharAdmin(row as Record<string, any>)
      : row,
  );
}

export function assertEmployeeFileWrite(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): void {
  if (!canWriteEmployeeFile(actor, flags)) {
    throw new ForbiddenException(
      'No tienes permiso para modificar datos administrativos de empleados.',
    );
  }
}

export function assertCanReadEmpleadoStatus(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): void {
  if (!canReadEmpleadoStatus(actor, flags)) {
    throw new ForbiddenException(
      'No tienes permiso para ver el estado de los empleados.',
    );
  }
}

export function assertCanApproveEmployeeChange(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): void {
  if (!canApproveEmployeeChange(actor, flags)) {
    throw new ForbiddenException(
      'No tienes permiso para aprobar cambios de empleados.',
    );
  }
}

export function assertFichajeWrite(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
  targetCodigo: string | null | undefined,
): void {
  const self = String(actor?.userId || '').trim();
  if (!self) throw new UnauthorizedException('Sesión inválida');
  const target = String(targetCodigo || '').trim();
  if (target && target === self) {
    if (!canWriteOwnFichaje(actor, flags)) {
      throw new ForbiddenException(
        'No tienes permiso para registrar fichajes.',
      );
    }
    return;
  }
  if (!canManageOtherFichajes(actor, flags)) {
    throw new ForbiddenException(
      'No tienes permiso para gestionar fichajes de otros empleados.',
    );
  }
}

/**
 * null = toată firma. Lista cu propriul cod = doar el.
 * Lista goală = nicio scriere (nici propriul pontaj).
 */
export async function resolvePunchReadCodigos(input: {
  actor: EmpleadoActor;
  flags: EmpleadoModuleFlags;
  bypass: boolean;
  scope: EmpleadoGrupoScopeFilter | null;
  listScopeCodigos: () => Promise<string[]>;
}): Promise<string[] | null> {
  const audience = operationAudience({
    bypass: input.bypass,
    hasScopeRows: !!input.scope?.grupos?.length,
    companyRight: canManageOtherFichajes(input.actor, input.flags),
  });
  if (audience === 'all') return null;
  if (audience === 'scope') return input.listScopeCodigos();
  const codigo = String(input.actor.userId || '').trim();
  if (!codigo) throw new UnauthorizedException('Sesión inválida');
  return [codigo];
}

export async function resolvePunchWriteCodigos(input: {
  actor: EmpleadoActor;
  flags: EmpleadoModuleFlags;
  bypass: boolean;
  scope: EmpleadoGrupoScopeFilter | null;
  listScopeCodigos: () => Promise<string[]>;
}): Promise<string[] | null> {
  const self = String(input.actor.userId || '').trim();
  if (!self) throw new UnauthorizedException('Sesión inválida');
  if (!canWriteOwnFichaje(input.actor, input.flags)) return [];
  if (!canManageOtherFichajes(input.actor, input.flags)) return [self];
  return resolvePunchReadCodigos(input);
}

export function bindOwnChangeRequest(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
  bodyCodigo: unknown,
): { codigo: string; estado: 'pendiente' } {
  const self = String(actor?.userId || '').trim();
  if (!self) throw new UnauthorizedException('Sesión inválida');
  const codigo = String(bodyCodigo || '').trim();
  if (!canWriteEmployeeFile(actor, flags) && codigo !== self) {
    throw new ForbiddenException(
      'Solo puedes solicitar cambios sobre tu propia ficha.',
    );
  }
  if (!codigo) {
    throw new ForbiddenException(
      'Solo puedes solicitar cambios sobre tu propia ficha.',
    );
  }
  return { codigo, estado: 'pendiente' };
}

export function filterRowsByCodigos<T>(
  rows: T[],
  allowed: string[] | null,
  codigoOf: (row: T) => string,
): T[] {
  if (!allowed) return rows;
  const set = new Set(allowed.map((codigo) => String(codigo).trim()));
  return rows.filter((row) => set.has(String(codigoOf(row) || '').trim()));
}

type PermissionLookup = {
  permissions: {
    findFirst: (args: {
      where: { grupo_module: string };
      select: { permitted: true };
    }) => Promise<{ permitted?: unknown } | null>;
  };
};

/** Doar bifa din matrice. Admin și Developer se verifică separat cu isImplicitAdmin. */
export async function matrixModuleEnabled(
  prisma: PermissionLookup,
  grupo: string | undefined,
  module: string,
): Promise<boolean> {
  const name = String(grupo || '').trim();
  if (!name || !module) return false;
  const row = await prisma.permissions.findFirst({
    where: { grupo_module: `${name}_${module}` },
    select: { permitted: true },
  });
  return permissionFlag(row?.permitted);
}
